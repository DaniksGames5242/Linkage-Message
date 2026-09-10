import { db } from "./firebase.js";
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  addDoc,
  collection,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  serverTimestamp,
  arrayUnion,
  arrayRemove,
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

export function listenMyGroups(uid, onChange, onError) {
  const q = query(
    collection(db, "groups"),
    where("members", "array-contains", uid),
    orderBy("lastMessageAt", "desc"),
    limit(100)
  );
  return onSnapshot(
    q,
    (snap) => onChange(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
    (err) => {
      console.error("listenMyGroups failed:", err);
      if (onError) onError(err);
    }
  );
}

export function listenGroupMessages(groupId, onChange, onError) {
  const q = query(collection(db, "groups", groupId, "messages"), orderBy("createdAt", "asc"), limit(500));
  return onSnapshot(
    q,
    (snap) => onChange(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
    (err) => {
      console.error("listenGroupMessages failed:", err);
      if (onError) onError(err);
    }
  );
}

export async function sendGroupMessage(groupId, senderId, text, attachment, replyTo) {
  const trimmed = (text || "").trim();
  const payload = {
    text: trimmed || attachment?.defaultCaption || "",
    senderId,
    createdAt: serverTimestamp(),
  };
  if (!payload.text) return;
  if (attachment) Object.assign(payload, attachment.fields);
  if (replyTo) payload.replyTo = replyTo;

  await addDoc(collection(db, "groups", groupId, "messages"), payload);
  await setDoc(
    doc(db, "groups", groupId),
    {
      lastMessage: attachment?.previewText || trimmed,
      lastMessageAt: serverTimestamp(),
      lastMessageSenderId: senderId,
      hiddenFor: [],
    },
    { merge: true }
  );
}

export async function editGroupMessage(groupId, messageId, newText) {
  const trimmed = (newText || "").trim();
  if (!trimmed) throw new Error("Сообщение не может быть пустым");
  await updateDoc(doc(db, "groups", groupId, "messages", messageId), {
    text: trimmed,
    edited: true,
    editedAt: serverTimestamp(),
  });
}

export async function deleteGroupMessage(groupId, messageId) {
  await deleteDoc(doc(db, "groups", groupId, "messages", messageId));
}

export async function toggleGroupReaction(groupId, messageId, emoji, uid, isAdding) {
  await updateDoc(doc(db, "groups", groupId, "messages", messageId), {
    [`reactions.${emoji}`]: isAdding ? arrayUnion(uid) : arrayRemove(uid),
  });
}

export async function hideGroupForMe(groupId, uid) {
  await updateDoc(doc(db, "groups", groupId), { hiddenFor: arrayUnion(uid) });
}

export async function clearGroupForMe(groupId, uid) {
  await updateDoc(doc(db, "groups", groupId), {
    [`clearedFor.${uid}`]: serverTimestamp(),
  });
}

export async function getGroup(groupId) {
  const snap = await getDoc(doc(db, "groups", groupId));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}
