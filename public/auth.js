import { auth, db } from "./firebase.js";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  EmailAuthProvider,
  reauthenticateWithCredential,
  updatePassword,
  deleteUser,
  signOut,
  onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  doc,
  getDoc,
  deleteDoc,
  updateDoc,
  addDoc,
  collection,
  query,
  orderBy,
  limit,
  onSnapshot,
  serverTimestamp,
  runTransaction,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { normalizeUsername, isValidUsername, colorForUid, describeDevice } from "./utils.js";

// Firebase Auth's Email/Password provider needs *something* shaped like an
// email. Users only ever see/type a username - we generate a random,
// meaningless placeholder address per account (no real email or SMS is ever
// used) and store it alongside the uid in usernames/{username}, so renaming
// a username later never has to touch the Auth account's email.
const FAKE_EMAIL_DOMAIN = "users.linkagemessage.app";

function randomAuthEmail() {
  const id = (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`).replace(/-/g, "");
  return `${id}@${FAKE_EMAIL_DOMAIN}`;
}

function friendlyAuthError(err) {
  switch (err?.code) {
    case "auth/email-already-in-use":
      return "Этот юзернейм уже занят.";
    case "auth/weak-password":
      return "Пароль слишком простой (минимум 6 символов).";
    case "auth/invalid-credential":
    case "auth/wrong-password":
    case "auth/user-not-found":
    case "auth/invalid-email":
      return "Неверный юзернейм или пароль.";
    case "auth/too-many-requests":
      return "Слишком много попыток. Попробуйте позже.";
    default:
      return err?.message || "Что-то пошло не так";
  }
}

export async function registerAccount({ username, password, confirmPassword, nickname, avatarImage }) {
  const uname = normalizeUsername(username);
  if (!isValidUsername(uname)) {
    throw new Error("Юзернейм: 3-20 символов, латиница/цифры/подчёркивание");
  }
  if (!password || password.length < 6) throw new Error("Пароль минимум 6 символов");
  if (password !== confirmPassword) throw new Error("Пароли не совпадают");

  const available = await usernameAvailable(uname);
  if (!available) throw new Error("Этот юзернейм уже занят");

  const name = (nickname || "").trim().slice(0, 40) || uname;
  const color = colorForUid(uname);
  const authEmail = randomAuthEmail();

  let user;
  try {
    const cred = await createUserWithEmailAndPassword(auth, authEmail, password);
    user = cred.user;
  } catch (err) {
    throw new Error(friendlyAuthError(err));
  }

  await runTransaction(db, async (tx) => {
    const unameRef = doc(db, "usernames", uname);
    const unameSnap = await tx.get(unameRef);
    if (unameSnap.exists() && unameSnap.data().uid !== user.uid) {
      throw new Error("Этот юзернейм уже занят");
    }
    tx.set(unameRef, { uid: user.uid, authEmail });
    tx.set(doc(db, "users", user.uid), {
      uid: user.uid,
      username: uname,
      displayName: name,
      avatarColor: color,
      avatarImage: avatarImage || null,
      bio: "",
      birthday: null,
      privacy: {
        lastSeenVisibility: "everyone",
        avatarVisibility: "everyone",
        bioVisibility: "everyone",
        birthdayVisibility: "everyone",
        typingVisibility: true,
      },
      notifications: {
        muteAll: false,
        sound: true,
        desktop: false,
        preview: true,
        groups: true,
      },
      chatPrefs: {
        sendOnEnter: true,
        fontSize: "medium",
        compact: false,
        accentColor: "blue",
      },
      language: "ru",
      createdAt: serverTimestamp(),
      lastSeenAt: serverTimestamp(),
    });
  });

  await recordSession(user.uid);
  return user;
}

export async function loginAccount({ username, password }) {
  const uname = normalizeUsername(username);
  if (!isValidUsername(uname)) throw new Error("Неверный юзернейм или пароль.");

  const unameSnap = await getDoc(doc(db, "usernames", uname));
  if (!unameSnap.exists()) throw new Error("Неверный юзернейм или пароль.");
  const { authEmail } = unameSnap.data();

  try {
    const cred = await signInWithEmailAndPassword(auth, authEmail, password);
    await recordSession(cred.user.uid);
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

// ---------- Sessions (best-effort login history, not remote-kill capable) ----------

export async function recordSession(uid) {
  try {
    const ref = await addDoc(collection(db, "users", uid, "sessions"), {
      device: describeDevice(),
      createdAt: serverTimestamp(),
    });
    try {
      sessionStorage.setItem("currentSessionId", ref.id);
    } catch (_) {
      // sessionStorage may be unavailable (private mode etc.) - non-critical
    }
    return ref.id;
  } catch (_) {
    // non-critical
    return null;
  }
}

export function listenSessions(uid, onChange) {
  const q = query(collection(db, "users", uid, "sessions"), orderBy("createdAt", "desc"), limit(20));
  return onSnapshot(q, (snap) => {
    onChange(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  });
}

export async function forgetSession(uid, sessionId) {
  await deleteDoc(doc(db, "users", uid, "sessions", sessionId));
}

// ---------- Password change / account deletion (require a fresh sign-in) ----------

async function reauthenticate(user, currentPassword) {
  const cred = EmailAuthProvider.credential(user.email, currentPassword);
  try {
    await reauthenticateWithCredential(user, cred);
  } catch (err) {
    throw new Error(friendlyAuthError(err));
  }
}

export async function changePassword(user, currentPassword, newPassword) {
  if (!newPassword || newPassword.length < 6) throw new Error("Пароль минимум 6 символов");
  await reauthenticate(user, currentPassword);
  try {
    await updatePassword(user, newPassword);
  } catch (err) {
    throw new Error(friendlyAuthError(err));
  }
}

export async function deleteAccount(user, currentPassword, username) {
  await reauthenticate(user, currentPassword);
  try {
    if (username) await deleteDoc(doc(db, "usernames", username));
    await deleteDoc(doc(db, "users", user.uid));
  } catch (_) {
    // best-effort cleanup - proceed to delete the auth account regardless
  }
  await deleteUser(user);
}
