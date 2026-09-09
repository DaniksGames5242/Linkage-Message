import { auth, db } from "./firebase.js";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendEmailVerification,
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
import { normalizeEmail, isValidEmail, normalizeUsername, isValidUsername, colorForUid } from "./utils.js";

function friendlyAuthError(err) {
  switch (err?.code) {
    case "auth/email-already-in-use":
      return "Этот email уже зарегистрирован. Попробуйте войти.";
    case "auth/weak-password":
      return "Пароль слишком простой (минимум 6 символов).";
    case "auth/invalid-email":
      return "Некорректный email.";
    case "auth/invalid-credential":
    case "auth/wrong-password":
    case "auth/user-not-found":
      return "Неверный email или пароль.";
    case "auth/too-many-requests":
      return "Слишком много попыток. Попробуйте позже.";
    default:
      return err?.message || "Что-то пошло не так";
  }
}

export async function registerWithEmail(rawEmail, password) {
  const email = normalizeEmail(rawEmail);
  if (!isValidEmail(email)) throw new Error("Введите корректный email");
  if (!password || password.length < 6) throw new Error("Пароль минимум 6 символов");
  try {
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    sendEmailVerification(cred.user).catch((err) => console.warn("Verification email failed:", err));
    return cred.user;
  } catch (err) {
    throw new Error(friendlyAuthError(err));
  }
}

export async function resendVerificationEmail(user) {
  await sendEmailVerification(user);
}

export async function loginWithEmail(rawEmail, password) {
  const email = normalizeEmail(rawEmail);
  if (!isValidEmail(email)) throw new Error("Введите корректный email");
  try {
    const cred = await signInWithEmailAndPassword(auth, email, password);
    return cred.user;
  } catch (err) {
    throw new Error(friendlyAuthError(err));
  }
}

export async function fetchMyProfile(uid) {
  const snap = await getDoc(doc(db, "users", uid));
  return snap.exists() ? snap.data() : null;
}

export async function usernameAvailable(username) {
  const snap = await getDoc(doc(db, "usernames", username));
  return !snap.exists();
}

export async function completeProfile({ uid, email, username, displayName, avatarEmoji, avatarImage }) {
  const uname = normalizeUsername(username);
  if (!isValidUsername(uname)) {
    throw new Error("Юзернейм: 3-20 символов, латиница/цифры/подчёркивание");
  }
  const name = (displayName || "").trim().slice(0, 40) || uname;
  const color = colorForUid(uid);
  const normalizedEmail = normalizeEmail(email);

  await runTransaction(db, async (tx) => {
    const unameRef = doc(db, "usernames", uname);
    const unameSnap = await tx.get(unameRef);
    if (unameSnap.exists() && unameSnap.data().uid !== uid) {
      throw new Error("Этот юзернейм уже занят");
    }
    tx.set(unameRef, { uid });
    tx.set(doc(db, "users", uid), {
      uid,
      email: normalizedEmail,
      username: uname,
      displayName: name,
      avatarColor: color,
      avatarEmoji: avatarImage ? null : avatarEmoji || null,
      avatarImage: avatarImage || null,
      bio: "",
      privacy: {
        emailVisibility: "contacts",
        lastSeenVisibility: "everyone",
        findByEmail: "everyone",
      },
      notifications: {
        sound: true,
        desktop: false,
        preview: true,
      },
      createdAt: serverTimestamp(),
      lastSeenAt: serverTimestamp(),
    });
    if (normalizedEmail) {
      tx.set(doc(db, "emails", normalizedEmail), { uid });
    }
  });
}

export function watchAuthState(onChange) {
  return onAuthStateChanged(auth, onChange);
}

export async function logout() {
  await signOut(auth);
  window.location.href = "/login";
}

export async function touchPresence(uid) {
  try {
    await updateDoc(doc(db, "users", uid), { lastSeenAt: serverTimestamp() });
  } catch (_) {
    // profile may not exist yet - ignore
  }
}
