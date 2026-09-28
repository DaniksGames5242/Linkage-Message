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
  increment,
  deleteField,
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
    (snap) => {
      const groups = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      const changes = snap.docChanges().map((c) => ({
        type: c.type,
        id: c.doc.id,
        data: c.doc.data(),
      }));
      onChange(groups, changes);
    },
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

export async function sendGroupMessage(groupId, senderId, text, attachment, replyTo, extra, memberUids = []) {
  const trimmed = (text || "").trim();
  const payload = {
    text: trimmed || attachment?.defaultCaption || "",
    senderId,
    createdAt: serverTimestamp(),
  };
  if (!payload.text) return;
  if (attachment) Object.assign(payload, attachment.fields);
  if (replyTo) payload.replyTo = replyTo;
  if (extra) Object.assign(payload, extra);

  const others = memberUids.filter((uid) => uid && uid !== senderId);
  await addDoc(collection(db, "groups", groupId, "messages"), payload);
  await setDoc(
    doc(db, "groups", groupId),
    {
      lastMessage: attachment?.previewText || trimmed,
      lastMessageAt: serverTimestamp(),
      lastMessageSenderId: senderId,
      hiddenFor: [],
      unread: Object.fromEntries(others.map((uid) => [uid, increment(1)])),
    },
    { merge: true }
  );
}

export async function markGroupRead(groupId, uid) {
  await updateDoc(doc(db, "groups", groupId), {
    [`unread.${uid}`]: 0,
    [`lastRead.${uid}`]: serverTimestamp(),
  });
}

export async function setGroupPinnedMessage(groupId, pinned) {
  await updateDoc(doc(db, "groups", groupId), { pinned: pinned || deleteField() });
}

export async function addGroupMembers(groupId, uids) {
  if (!uids.length) return;
  await updateDoc(doc(db, "groups", groupId), { members: arrayUnion(...uids) });
}

export async function leaveGroup(groupId, uid) {
  await updateDoc(doc(db, "groups", groupId), {
    members: arrayRemove(uid),
    admins: arrayRemove(uid),
  });
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
