import { db } from "./firebase.js";
import {
  addDoc,
  collection,
  query,
  orderBy,
  limit,
  onSnapshot,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

export function listenSavedMessages(uid, onChange) {
  const q = query(collection(db, "users", uid, "savedMessages"), orderBy("createdAt", "asc"), limit(500));
  return onSnapshot(q, (snap) => {
    onChange(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  });
}

export async function addSavedMessage(uid, text) {
  const trimmed = text.trim();
  if (!trimmed) return;
  await addDoc(collection(db, "users", uid, "savedMessages"), {
    text: trimmed,
    createdAt: serverTimestamp(),
  });
}
