import { db } from "./firebase.js";
import {
  doc,
  getDoc,
  setDoc,
  addDoc,
  collection,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

export async function createGroup({ type, name, avatarImage, avatarColor, ownerId, memberUids }) {
  const trimmedName = (name || "").trim().slice(0, 60);
  if (!trimmedName) throw new Error("Введите название");
  const members = Array.from(new Set([ownerId, ...memberUids]));

  const ref = await addDoc(collection(db, "groups"), {
    type,
    name: trimmedName,
    avatarColor,
    avatarImage: avatarImage || null,
    ownerId,
    admins: [ownerId],
    members,
    createdAt: serverTimestamp(),
    lastMessage: "",
    lastMessageAt: serverTimestamp(),
    lastMessageSenderId: null,
  });
  return ref.id;
}

export function listenMyGroups(uid, onChange) {
  const q = query(
    collection(db, "groups"),
    where("members", "array-contains", uid),
    orderBy("lastMessageAt", "desc"),
    limit(100)
  );
  return onSnapshot(q, (snap) => {
    onChange(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  });
}

export function listenGroupMessages(groupId, onChange) {
  const q = query(collection(db, "groups", groupId, "messages"), orderBy("createdAt", "asc"), limit(500));
  return onSnapshot(q, (snap) => {
    onChange(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  });
}

export async function sendGroupMessage(groupId, senderId, text) {
  const trimmed = text.trim();
  if (!trimmed) return;
  await addDoc(collection(db, "groups", groupId, "messages"), {
    text: trimmed,
    senderId,
    createdAt: serverTimestamp(),
  });
  await setDoc(
    doc(db, "groups", groupId),
    { lastMessage: trimmed, lastMessageAt: serverTimestamp(), lastMessageSenderId: senderId },
    { merge: true }
  );
}

export async function getGroup(groupId) {
  const snap = await getDoc(doc(db, "groups", groupId));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}
