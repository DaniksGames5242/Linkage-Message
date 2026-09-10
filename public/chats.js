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
  deleteField,
  arrayUnion,
  arrayRemove,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { chatIdFor } from "./utils.js";

export async function ensureChat(myUid, otherUid) {
  const chatId = chatIdFor(myUid, otherUid);
  const ref = doc(db, "chats", chatId);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    await setDoc(ref, {
      participants: [myUid, otherUid],
      createdAt: serverTimestamp(),
      lastMessage: "",
      lastMessageAt: serverTimestamp(),
      lastMessageSenderId: null,
    });
  }
  return chatId;
}

export function listenMyChats(myUid, onChange, onError) {
  const q = query(
    collection(db, "chats"),
    where("participants", "array-contains", myUid),
    orderBy("lastMessageAt", "desc"),
    limit(100)
  );
  return onSnapshot(
    q,
    (snap) => {
      const chats = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      const changes = snap.docChanges().map((c) => ({
        type: c.type,
        id: c.doc.id,
        data: c.doc.data(),
      }));
      onChange(chats, changes);
    },
    (err) => {
      console.error("listenMyChats failed:", err);
      if (onError) onError(err);
    }
  );
}

export function listenMessages(chatId, onChange, onError) {
  const q = query(collection(db, "chats", chatId, "messages"), orderBy("createdAt", "asc"), limit(500));
  return onSnapshot(
    q,
    (snap) => onChange(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
    (err) => {
      console.error("listenMessages failed:", err);
      if (onError) onError(err);
    }
  );
}

export async function sendMessage(chatId, senderId, text, attachment) {
  const trimmed = (text || "").trim();
  const payload = {
    text: trimmed || attachment?.defaultCaption || "",
    senderId,
    createdAt: serverTimestamp(),
  };
  if (!payload.text) return;
  if (attachment) Object.assign(payload, attachment.fields);

  await addDoc(collection(db, "chats", chatId, "messages"), payload);
  await setDoc(
    doc(db, "chats", chatId),
    {
      lastMessage: attachment?.previewText || trimmed,
      lastMessageAt: serverTimestamp(),
      lastMessageSenderId: senderId,
      typing: { [senderId]: deleteField() },
      hiddenFor: [],
    },
    { merge: true }
  );
}

export async function editMessage(chatId, messageId, newText) {
  const trimmed = (newText || "").trim();
  if (!trimmed) throw new Error("Сообщение не может быть пустым");
  await updateDoc(doc(db, "chats", chatId, "messages", messageId), {
    text: trimmed,
    edited: true,
    editedAt: serverTimestamp(),
  });
}

export async function deleteMessage(chatId, messageId) {
  await deleteDoc(doc(db, "chats", chatId, "messages", messageId));
}

export async function toggleReaction(chatId, messageId, emoji, uid, isAdding) {
  await updateDoc(doc(db, "chats", chatId, "messages", messageId), {
    [`reactions.${emoji}`]: isAdding ? arrayUnion(uid) : arrayRemove(uid),
  });
}

export function listenChatDoc(chatId, onChange) {
  return onSnapshot(doc(db, "chats", chatId), (snap) => {
    onChange(snap.exists() ? snap.data() : null);
  });
}

export async function setTyping(chatId, uid, isTyping) {
  try {
    await updateDoc(doc(db, "chats", chatId), {
      [`typing.${uid}`]: isTyping ? serverTimestamp() : deleteField(),
    });
  } catch (_) {
    // chat doc may not exist yet - ignore
  }
}

// ---------- Delete / clear (per-user, non-destructive for the other side) ----------

export async function hideChatForMe(chatId, uid) {
  await updateDoc(doc(db, "chats", chatId), { hiddenFor: arrayUnion(uid) });
}

export async function clearChatForMe(chatId, uid) {
  await updateDoc(doc(db, "chats", chatId), {
    [`clearedFor.${uid}`]: serverTimestamp(),
  });
}
