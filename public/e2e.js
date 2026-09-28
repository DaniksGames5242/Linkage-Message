// End-to-end encryption for one-to-one chats — on automatically, no password.
//
// Like Signal/WhatsApp, every *device* has its own ECDH P-256 key pair,
// created on first launch and kept in IndexedDB as a non-extractable
// CryptoKey (it never leaves the device). Public halves are listed on the
// profile (users/{uid}.e2eDevices).
//
// Each message is sealed once with a fresh random AES-GCM-256 key, and that
// key is wrapped separately for every device of both people:
//   wrap key = HKDF-SHA256(ECDH(sender device, recipient device), salt = chat id)
// A device can read a message if the message carries a wrapped key for it.
// When you add a device, your other devices wrap old messages' keys for it
// (shareKeys), so history shows up everywhere. Photos, videos, voice and
// files are encrypted with their own key before upload (encryptBlob).

const subtle = globalThis.crypto?.subtle;
export const e2eSupported = !!subtle && typeof indexedDB !== "undefined";

const enc = new TextEncoder();
const dec = new TextDecoder();
const b64 = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf)));
const unb64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
const publicPart = (jwk) => ({ kty: jwk.kty, crv: jwk.crv, x: jwk.x, y: jwk.y });

// ---------- IndexedDB ----------

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

// ---------- This device ----------

let device = null; // { uid, id, priv: CryptoKey, pub: JWK }

// Loads this device's key pair, creating it on first launch.
export async function initDevice(uid) {
  if (!e2eSupported) return null;
  const stored = await idbDo("readonly", (s) => s.get(`dev:${uid}`)).catch(() => null);
  if (stored?.priv && stored?.id) {
    device = { uid, id: stored.id, priv: stored.priv, pub: stored.pub };
    return device;
  }
  const pair = await subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, false, ["deriveBits"]);
  const pub = publicPart(await subtle.exportKey("jwk", pair.publicKey));
  const id = Array.from(crypto.getRandomValues(new Uint8Array(9)), (b) => b.toString(16).padStart(2, "0")).join("");
  await idbDo("readwrite", (s) => s.put({ id, priv: pair.privateKey, pub }, `dev:${uid}`));
  device = { uid, id, priv: pair.privateKey, pub };
  return device;
}

export const hasDevice = () => !!device;
export const deviceId = () => device?.id || null;
export const devicePublicKey = () => device?.pub || null;

export async function forgetDevice(uid) {
  device = null;
  wrapKeys.clear();
  await idbDo("readwrite", (s) => s.delete(`dev:${uid}`)).catch(() => {});
}

// ---------- Pairwise wrapping keys ----------

const wrapKeys = new Map(); // `${chatId}|${their x}` -> Promise<CryptoKey>

function wrapKeyFor(chatId, theirPub) {
  const id = `${chatId}|${theirPub.x}`;
  if (!wrapKeys.has(id)) {
    wrapKeys.set(
      id,
      (async () => {
        const pub = await subtle.importKey("jwk", publicPart(theirPub), { name: "ECDH", namedCurve: "P-256" }, false, []);
        const bits = await subtle.deriveBits({ name: "ECDH", public: pub }, device.priv, 256);
        const hkdf = await subtle.importKey("raw", bits, "HKDF", false, ["deriveKey"]);
        return subtle.deriveKey(
          { name: "HKDF", hash: "SHA-256", salt: enc.encode(chatId), info: enc.encode("linkage-e2e-v2") },
          hkdf,
          { name: "AES-GCM", length: 256 },
          false,
          ["encrypt", "decrypt"]
        );
      })()
    );
  }
  return wrapKeys.get(id);
}

// ---------- Sealing / opening ----------

// recipients: array of { id: deviceId, pub: JWK } — every device of both people.
export async function sealFor(chatId, recipients, content) {
  if (!device) throw new Error("E2E device key missing");
  const raw = crypto.getRandomValues(new Uint8Array(32));
  const msgKey = await subtle.importKey("raw", raw, "AES-GCM", false, ["encrypt"]);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await subtle.encrypt({ name: "AES-GCM", iv }, msgKey, enc.encode(JSON.stringify(content)));
  const keys = {};
  await Promise.all(
    recipients.map(async (r) => {
      if (!r?.id || !r?.pub?.x || keys[r.id]) return;
      const wk = await wrapKeyFor(chatId, r.pub);
      const wiv = crypto.getRandomValues(new Uint8Array(12));
      keys[r.id] = { iv: b64(wiv), ct: b64(await subtle.encrypt({ name: "AES-GCM", iv: wiv }, wk, raw)) };
    })
  );
  return { v: 2, from: device.id, iv: b64(iv), ct: b64(ct), keys };
}

export class NotForThisDevice extends Error {}

async function unwrapRaw(chatId, box, senderPub, byPub) {
  const entry = box?.keys?.[device?.id];
  if (!entry) throw new NotForThisDevice("no key for this device");
  // Keys shared later by another device (see shareKeys) name that device in `by`.
  const wk = await wrapKeyFor(chatId, entry.by ? byPub : senderPub);
  if (entry.by && !byPub) throw new Error("unknown sharing device");
  return subtle.decrypt({ name: "AES-GCM", iv: unb64(entry.iv) }, wk, unb64(entry.ct));
}

// senderPub: the public key of the device named in box.from; byPub: the key of
// the device that shared this device's entry, when it has a `by` field.
export async function openFrom(chatId, box, senderPub, byPub = null) {
  const raw = await unwrapRaw(chatId, box, senderPub, byPub);
  const msgKey = await subtle.importKey("raw", raw, "AES-GCM", false, ["decrypt"]);
  const plain = await subtle.decrypt({ name: "AES-GCM", iv: unb64(box.iv) }, msgKey, unb64(box.ct));
  return JSON.parse(dec.decode(plain));
}

// History on every device: a device that can read a message wraps its key for
// the account's other devices that were added later. Returns the new entries.
export async function shareKeys(chatId, box, senderPub, byPub, recipients) {
  const raw = await unwrapRaw(chatId, box, senderPub, byPub);
  const out = {};
  await Promise.all(
    recipients.map(async (r) => {
      if (!r?.id || !r?.pub?.x || box.keys?.[r.id] || r.id === device.id) return;
      const wk = await wrapKeyFor(chatId, r.pub);
      const wiv = crypto.getRandomValues(new Uint8Array(12));
      out[r.id] = { iv: b64(wiv), ct: b64(await subtle.encrypt({ name: "AES-GCM", iv: wiv }, wk, raw)), by: device.id };
    })
  );
  return out;
}

// ---------- Encrypted media ----------
// Files are encrypted with their own random AES-GCM key before upload; the
// key travels inside the (already end-to-end encrypted) message.

export async function encryptBlob(blob) {
  const raw = crypto.getRandomValues(new Uint8Array(32));
  const key = await subtle.importKey("raw", raw, "AES-GCM", false, ["encrypt"]);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await subtle.encrypt({ name: "AES-GCM", iv }, key, await blob.arrayBuffer());
  return { blob: new Blob([ct], { type: "application/octet-stream" }), mediaKey: { k: b64(raw), iv: b64(iv), t: blob.type || "" } };
}

export async function decryptToBlob(buf, mediaKey) {
  const key = await subtle.importKey("raw", unb64(mediaKey.k), "AES-GCM", false, ["decrypt"]);
  const plain = await subtle.decrypt({ name: "AES-GCM", iv: unb64(mediaKey.iv) }, key, buf);
  return new Blob([plain], { type: mediaKey.t || "application/octet-stream" });
}

// ---------- Safety code ----------
// Built from every device key of both people; both see the same emoji while
// nobody's keys were swapped (changes when someone adds a device).
const FP_EMOJI = Array.from(
  "🐶🐱🦊🐻🐼🐨🐯🦁🐮🐷🐸🐵🐔🐧🐦🐤🦆🦉🐺🐗🐴🦄🐝🐛🦋🐌🐞🐢🐍🦎🐙🦑🦀🐬🐳🐟🐠🦈🐊🐅🐆🦓🦍🐘🦏🐪🦒🦘🐃🐂🐎🐖🐏🐑🦙🐐🦌🐕🐩🐈🐓🦃🦚🦜🦢🌵🎄🌲🌳🌴🌱🌿🍀🍁🍄🌷🌹🌻🌼🌸🌺🍎🍐🍊🍋🍌🍉🍇🍓🍒🍑🥭🍍🥥🥝🍅🥑🍆🥕🌽🥒🥦🥜🌰🍞🥐🥖🧀🥚🍳🥞🥓🍗🍖🌭🍔🍟🍕🥪🌮🌯🥗🍝🍜🍲🍛🍣🍱🥟🍤🍙🍚🍘🍥🥮🍢🍡🍧🍨🍦🥧🧁🍰🎂🍮🍭🍬🍫🍿🍩🍪🥛🍵🥤🍶🍺🍷🍸🍹⚽🏀🏈⚾🎾🏐🏉🎱🏓🏸🥅🏒🏑🏏🏹🎣🥊🥋🎽🥌🛷🎿🏆🎖🏅🎫🎪🎭🎨🎬🎤🎧🎼🎹🥁🎷🎺🎸🎻🎲🎯🎳🎮🎰🧩🚗🚕🚙🚌🚎🏎🚓🚑🚒🚐🚚🚛🚜🛴🚲🛵🏍🚨🚔🚍🚘🚖🚡🚠🚟🚃🚋🚞🚝🚄🚅🚈🚂🚆🚇🚊🚉🛫🛬🛩💺🛰🚀🛸🚁🛶🚤🛥🛳🚢🚧🚦🚥🗺🗿🗽🗼🏰🏯🏟🎡🎢🎠🏖🏝🏜🌋🏔🗻🏕🏠🏡🏘🏚🏗🏭🏢🏬🏣🏤🏥🏦🏨🏪🏫🏩💒🏛🕌🕍🕋"
);
export async function fingerprint(pubs) {
  const parts = pubs.filter((p) => p?.x).map((p) => `${p.x}.${p.y}`).sort();
  const hash = new Uint8Array(await subtle.digest("SHA-256", enc.encode(parts.join("|"))));
  let out = "";
  for (let i = 0; i < 8; i++) out += FP_EMOJI[((hash[i * 2] << 8) | hash[i * 2 + 1]) % FP_EMOJI.length];
  return out;
}
