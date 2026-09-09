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

export function listenMyChats(myUid, onChange) {
  const q = query(
    collection(db, "chats"),
    where("participants", "array-contains", myUid),
    orderBy("lastMessageAt", "desc"),
    limit(100)
  );
  return onSnapshot(q, (snap) => {
    const chats = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    const changes = snap.docChanges().map((c) => ({
      type: c.type,
      id: c.doc.id,
      data: c.doc.data(),
    }));
    onChange(chats, changes);
  });
}

export function listenMessages(chatId, onChange) {
  const q = query(
    collection(db, "chats", chatId, "messages"),
    orderBy("createdAt", "asc"),
    limit(500)
  );
  return onSnapshot(q, (snap) => {
    onChange(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  });
}

export async function sendMessage(chatId, senderId, text) {
  const trimmed = text.trim();
  if (!trimmed) return;
  await addDoc(collection(db, "chats", chatId, "messages"), {
    text: trimmed,
    senderId,
    createdAt: serverTimestamp(),
  });
  await setDoc(
    doc(db, "chats", chatId),
    {
      lastMessage: trimmed,
      lastMessageAt: serverTimestamp(),
      lastMessageSenderId: senderId,
    },
    { merge: true }
  );
}
