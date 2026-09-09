import { db } from "./firebase.js";
import {
  doc,
  updateDoc,
  runTransaction,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { normalizeUsername, isValidUsername } from "./utils.js";

export async function updateProfileFields(uid, fields) {
  await updateDoc(doc(db, "users", uid), fields);
}

export async function changeUsername(uid, oldUsername, rawNewUsername) {
  const newUsername = normalizeUsername(rawNewUsername);
  if (!isValidUsername(newUsername)) {
    throw new Error("Юзернейм: 3-20 символов, латиница/цифры/подчёркивание");
  }
  if (newUsername === oldUsername) return newUsername;

  await runTransaction(db, async (tx) => {
    const newRef = doc(db, "usernames", newUsername);
    const newSnap = await tx.get(newRef);
    if (newSnap.exists()) {
      throw new Error("Этот юзернейм уже занят");
    }
    tx.set(newRef, { uid });
    if (oldUsername) {
      tx.delete(doc(db, "usernames", oldUsername));
    }
    tx.update(doc(db, "users", uid), { username: newUsername });
  });

  return newUsername;
}

export async function updatePrivacy(uid, privacy) {
  await updateDoc(doc(db, "users", uid), { privacy });
}

export async function updateNotifications(uid, notifications) {
  await updateDoc(doc(db, "users", uid), { notifications });
}
