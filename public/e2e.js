// End-to-end encryption for one-to-one chats.
//
// • Every account has an ECDH P-256 key pair. The public half is published
//   on the profile; the private half never leaves the browser unencrypted:
//   it is stored in Firestore wrapped with AES-GCM under a key derived from
//   the account password (PBKDF2-SHA256, 310k rounds), so any device where
//   you sign in can unwrap it, and it is cached on the device in IndexedDB
//   as a non-extractable CryptoKey.
// • Two people derive the same chat key: ECDH(my private, their public) →
//   HKDF-SHA256 (salt = chat id) → AES-GCM-256. Message content (text,
//   quotes, attachment links, …) is encrypted with it; Firestore only sees
//   ciphertext plus a "🔒" placeholder.

import { getMyKeyDoc, saveMyKeyDoc, publishPublicKey } from "./e2e-store.js";

const subtle = globalThis.crypto?.subtle;
export const e2eSupported = !!subtle && typeof indexedDB !== "undefined";

const PBKDF2_ROUNDS = 310000;
const enc = new TextEncoder();
const dec = new TextDecoder();

const b64 = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf)));
const unb64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

// ---------- IndexedDB cache of the unwrapped private key ----------

function idb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open("linkage-e2e", 1);
    req.onupgradeneeded = () => req.result.createObjectStore("keys");
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
async function idbDo(mode, fn) {
  const db = await idb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("keys", mode);
    const req = fn(tx.objectStore("keys"));
    tx.oncomplete = () => resolve(req?.result);
    tx.onerror = () => reject(tx.error);
  });
}

// ---------- Key management ----------

let mine = null; // { uid, priv: CryptoKey, pub: JWK }

async function deriveWrapKey(password, salt) {
  const base = await subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveKey"]);
  return subtle.deriveKey(
    { name: "PBKDF2", salt, iterations: PBKDF2_ROUNDS, hash: "SHA-256" },
    base,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

async function importPrivate(jwk) {
  return subtle.importKey("jwk", jwk, { name: "ECDH", namedCurve: "P-256" }, false, ["deriveBits"]);
}

const publicPart = (jwk) => ({ kty: jwk.kty, crv: jwk.crv, x: jwk.x, y: jwk.y });

async function unwrap(docData, password) {
  const key = await deriveWrapKey(password, unb64(docData.salt));
  try {
    const plain = await subtle.decrypt({ name: "AES-GCM", iv: unb64(docData.iv) }, key, unb64(docData.ct));
    return JSON.parse(dec.decode(plain));
  } catch (_) {
    throw new Error("Неверный пароль");
  }
}

async function wrap(jwk, password) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveWrapKey(password, salt);
  const ct = await subtle.encrypt({ name: "AES-GCM", iv }, key, enc.encode(JSON.stringify(jwk)));
  return { v: 1, alg: "ECDH-P256+PBKDF2-AESGCM", salt: b64(salt), iv: b64(iv), ct: b64(ct), updatedAt: Date.now() };
}

async function remember(uid, privJwk) {
  const priv = await importPrivate(privJwk);
  const pub = publicPart(privJwk);
  mine = { uid, priv, pub };
  await idbDo("readwrite", (s) => s.put({ priv, pub }, uid)).catch(() => {});
  return mine;
}

// Called with the account password (sign-in, registration, unlock prompt):
// unwraps the existing key pair or creates the first one.
export async function setupKeys(uid, password, { knownPublic } = {}) {
  if (!e2eSupported) return null;
  const docData = await getMyKeyDoc(uid);
  if (docData) {
    const jwk = await unwrap(docData, password);
    const keys = await remember(uid, jwk);
    if (!knownPublic || knownPublic.x !== keys.pub.x) await publishPublicKey(uid, keys.pub).catch(() => {});
    return keys;
  }
  const pair = await subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"]);
  const jwk = await subtle.exportKey("jwk", pair.privateKey);
  await saveMyKeyDoc(uid, await wrap(jwk, password));
  await publishPublicKey(uid, publicPart(jwk));
  return remember(uid, jwk);
}

// Re-wraps the private key after a password change.
export async function rewrapKeys(uid, oldPassword, newPassword) {
  if (!e2eSupported) return;
  const docData = await getMyKeyDoc(uid);
  if (!docData) return;
  const jwk = await unwrap(docData, oldPassword);
  await saveMyKeyDoc(uid, await wrap(jwk, newPassword));
}

export async function loadKeys(uid) {
  if (!e2eSupported) return null;
  try {
    const stored = await idbDo("readonly", (s) => s.get(uid));
    if (stored?.priv) mine = { uid, priv: stored.priv, pub: stored.pub };
  } catch (_) {
    mine = null;
  }
  return mine;
}

export async function forgetKeys(uid) {
  mine = null;
  chatKeys.clear();
  await idbDo("readwrite", (s) => s.delete(uid)).catch(() => {});
}

export const hasKeys = () => !!mine;
export const myPublicKey = () => mine?.pub || null;

// ---------- Chat keys ----------

const chatKeys = new Map(); // `${chatId}|${their x}` -> Promise<CryptoKey>

export function chatKey(chatId, theirPub) {
  if (!mine || !theirPub?.x) return null;
  const id = `${chatId}|${theirPub.x}`;
  if (!chatKeys.has(id)) {
    chatKeys.set(
      id,
      (async () => {
        const pub = await subtle.importKey("jwk", publicPart(theirPub), { name: "ECDH", namedCurve: "P-256" }, false, []);
        const bits = await subtle.deriveBits({ name: "ECDH", public: pub }, mine.priv, 256);
        const hkdf = await subtle.importKey("raw", bits, "HKDF", false, ["deriveKey"]);
        return subtle.deriveKey(
          { name: "HKDF", hash: "SHA-256", salt: enc.encode(chatId), info: enc.encode("linkage-e2e-v1") },
          hkdf,
          { name: "AES-GCM", length: 256 },
          false,
          ["encrypt", "decrypt"]
        );
      })()
    );
  }
  return chatKeys.get(id);
}

export async function seal(key, obj) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await subtle.encrypt({ name: "AES-GCM", iv }, key, enc.encode(JSON.stringify(obj)));
  return { v: 1, iv: b64(iv), ct: b64(ct) };
}

export async function open(key, box) {
  const plain = await subtle.decrypt({ name: "AES-GCM", iv: unb64(box.iv) }, key, unb64(box.ct));
  return JSON.parse(dec.decode(plain));
}

// A short code both people see identically — compare it to rule out a
// swapped key (like Telegram's secret-chat key image).
const FP_EMOJI = "🐶🐱🦊🐻🐼🐨🐯🦁🐮🐷🐸🐵🐔🐧🐦🐤🦆🦉🐺🐗🐴🦄🐝🐛🦋🐌🐞🐢🐍🦎🐙🦑🦀🐬🐳🐟🐠🦈🐊🐅🐆🦓🦍🐘🦏🐪🦒🦘🐃🐂🐎🐖🐏🐑🦙🐐🦌🐕🐩🐈🐓🦃🦚🦜🦢🌵🎄🌲🌳🌴🌱🌿🍀🍁🍄🌷🌹🌻🌼🌸🌺🍎🍐🍊🍋🍌🍉🍇🍓🍒🍑🥭🍍🥥🥝🍅🥑🍆🥕🌽🌶🥒🥦🍄🥜🌰🍞🥐🥖🧀🥚🍳🥞🥓🍗🍖🌭🍔🍟🍕🥪🌮🌯🥗🍝🍜🍲🍛🍣🍱🥟🍤🍙🍚🍘🍥🥮🍢🍡🍧🍨🍦🥧🧁🍰🎂🍮🍭🍬🍫🍿🍩🍪🥛☕🍵🥤🍶🍺🍷🍸🍹⚽🏀🏈⚾🎾🏐🏉🎱🏓🏸🥅🏒🏑🏏⛳🏹🎣🥊🥋🎽⛸🥌🛷🎿🏆🎖🏅🎫🎪🎭🎨🎬🎤🎧🎼🎹🥁🎷🎺🎸🎻🎲🎯🎳🎮🎰🧩🚗🚕🚙🚌🚎🏎🚓🚑🚒🚐🚚🚛🚜🛴🚲🛵🏍🚨🚔🚍🚘🚖🚡🚠🚟🚃🚋🚞🚝🚄🚅🚈🚂🚆🚇🚊🚉✈🛫🛬🛩💺🛰🚀🛸🚁🛶⛵🚤🛥🛳⛴🚢⚓⛽🚧🚦🚥🗺🗿🗽🗼🏰🏯🏟🎡🎢🎠⛲⛱🏖🏝🏜🌋⛰🏔🗻🏕⛺🏠🏡🏘🏚🏗🏭🏢🏬🏣🏤🏥🏦🏨🏪🏫🏩💒🏛⛪🕌🕍🕋⛩";
export async function fingerprint(pubA, pubB) {
  const parts = [pubA, pubB].map((p) => `${p.x}.${p.y}`).sort();
  const hash = new Uint8Array(await subtle.digest("SHA-256", enc.encode(parts.join("|"))));
  const emoji = Array.from(FP_EMOJI);
  let out = "";
  for (let i = 0; i < 8; i++) out += emoji[((hash[i * 2] << 8) | hash[i * 2 + 1]) % emoji.length];
  return out;
}
