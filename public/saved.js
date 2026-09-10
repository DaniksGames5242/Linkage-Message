import { db } from "./firebase.js";
import {
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  collection,
  query,
  orderBy,
  limit,
  onSnapshot,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

export function listenSavedMessages(uid, onChange, onError) {
  const q = query(collection(db, "users", uid, "savedMessages"), orderBy("createdAt", "asc"), limit(500));
  return onSnapshot(
    q,
    (snap) => onChange(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
    (err) => {
      console.error("listenSavedMessages failed:", err);
      if (onError) onError(err);
    }
  );
}

export async function addSavedMessage(uid, text, replyTo) {
  const trimmed = text.trim();
  if (!trimmed) return;
  const payload = {
    text: trimmed,
    createdAt: serverTimestamp(),
  };
  if (replyTo) payload.replyTo = replyTo;
  await addDoc(collection(db, "users", uid, "savedMessages"), payload);
}

export async function editSavedMessage(uid, messageId, newText) {
  const trimmed = (newText || "").trim();
  if (!trimmed) throw new Error("Сообщение не может быть пустым");
  await updateDoc(doc(db, "users", uid, "savedMessages", messageId), {
    text: trimmed,
    edited: true,
    editedAt: serverTimestamp(),
  });
}

export async function deleteSavedMessage(uid, messageId) {
  await deleteDoc(doc(db, "users", uid, "savedMessages", messageId));
}
