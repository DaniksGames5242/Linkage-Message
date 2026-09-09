import { auth, db } from "./firebase.js";
import {
  RecaptchaVerifier,
  signInWithPhoneNumber,
  signOut,
  onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  doc,
  getDoc,
  updateDoc,
  runTransaction,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { normalizePhone, normalizeUsername, isValidUsername, colorForUid } from "./utils.js";

let recaptchaVerifier = null;
let confirmationResult = null;

export function getRecaptcha() {
  if (!recaptchaVerifier) {
    recaptchaVerifier = new RecaptchaVerifier(auth, "recaptcha-container", {
      size: "invisible",
    });
  }
  return recaptchaVerifier;
}

export async function requestOtp(rawPhone) {
  const phone = normalizePhone(rawPhone);
  if (!phone) throw new Error("Введите номер в формате +79991234567");
  const verifier = getRecaptcha();
  confirmationResult = await signInWithPhoneNumber(auth, phone, verifier);
  return phone;
}

export async function confirmOtp(code) {
  if (!confirmationResult) throw new Error("Сначала запросите код");
  if (!/^\d{4,8}$/.test(code)) throw new Error("Введите код из SMS");
  const cred = await confirmationResult.confirm(code);
  return cred.user;
}

export function resetOtpState() {
  confirmationResult = null;
}

export async function fetchMyProfile(uid) {
  const snap = await getDoc(doc(db, "users", uid));
  return snap.exists() ? snap.data() : null;
}

export async function usernameAvailable(username) {
  const snap = await getDoc(doc(db, "usernames", username));
  return !snap.exists();
}

export async function completeProfile({ uid, phoneNumber, username, displayName, avatarEmoji }) {
  const uname = normalizeUsername(username);
  if (!isValidUsername(uname)) {
    throw new Error("Юзернейм: 3-20 символов, латиница/цифры/подчёркивание");
  }
  const name = (displayName || "").trim().slice(0, 40) || uname;
  const color = colorForUid(uid);

  await runTransaction(db, async (tx) => {
    const unameRef = doc(db, "usernames", uname);
    const unameSnap = await tx.get(unameRef);
    if (unameSnap.exists() && unameSnap.data().uid !== uid) {
      throw new Error("Этот юзернейм уже занят");
    }
    tx.set(unameRef, { uid });
    tx.set(doc(db, "users", uid), {
      uid,
      phone: phoneNumber,
      username: uname,
      displayName: name,
      avatarColor: color,
      avatarEmoji: avatarEmoji || null,
      bio: "",
      privacy: {
        phoneVisibility: "contacts",
        lastSeenVisibility: "everyone",
        findByPhone: "everyone",
      },
      notifications: {
        sound: true,
        desktop: false,
        preview: true,
      },
      createdAt: serverTimestamp(),
      lastSeenAt: serverTimestamp(),
    });
    if (phoneNumber) {
      tx.set(doc(db, "phones", phoneNumber), { uid });
    }
  });
}

export function watchAuthState(onChange) {
  return onAuthStateChanged(auth, onChange);
}

export async function logout() {
  await signOut(auth);
  location.reload();
}

export async function touchPresence(uid) {
  try {
    await updateDoc(doc(db, "users", uid), { lastSeenAt: serverTimestamp() });
  } catch (_) {
    // profile may not exist yet - ignore
  }
}
