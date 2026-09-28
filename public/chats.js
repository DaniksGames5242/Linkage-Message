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
  increment,
  runTransaction,
  Timestamp,
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
  // No orderBy here on purpose: array-contains + orderBy needs a composite
  // index, and without it the whole list silently fails to load. The client
  // sorts by lastMessageAt anyway.
  const q = query(collection(db, "chats"), where("participants", "array-contains", myUid));
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

// `extra` carries optional message metadata (forwardedFrom, call log, …).
// `extra` carries optional message metadata (forwardedFrom, call log, …).
// opts.preview / opts.previewEnc override the chat-list preview (end-to-end
// encrypted chats never store readable text there); opts.scheduleAt (ms)
// schedules the message: it is written now but stays hidden until then and
// the chat preview/unread counters are updated by publishScheduled().
export async function sendMessage(chatId, senderId, text, attachment, replyTo, extra, opts = {}) {
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
  // Fields that must stay readable/updatable outside the ciphertext (poll votes).
  if (opts.plain) Object.assign(payload, opts.plain);

  const preview = opts.preview ?? (attachment?.previewText || trimmed);
  const ref = doc(collection(db, "chats", chatId, "messages"));
  if (opts.scheduleAt) {
    const at = Timestamp.fromMillis(opts.scheduleAt);
    payload.scheduledAt = at;
    await setDoc(ref, payload);
    const entry = { at, senderId, preview, silent: !!opts.silent };
    if (opts.previewEnc) entry.previewEnc = opts.previewEnc;
    await setDoc(doc(db, "chats", chatId), { scheduled: { [ref.id]: entry } }, { merge: true });
    return ref.id;
  }

  const others = chatId.split("_").filter((uid) => uid && uid !== senderId);
  await setDoc(ref, payload);
  await setDoc(
    doc(db, "chats", chatId),
    {
      lastMessage: preview,
      lastEnc: opts.previewEnc || deleteField(),
      lastMessageAt: serverTimestamp(),
      lastMessageSenderId: senderId,
      lastSilent: !!opts.silent,
      typing: { [senderId]: deleteField() },
      hiddenFor: [],
      unread: Object.fromEntries(others.map((uid) => [uid, increment(1)])),
    },
    { merge: true }
  );
  return ref.id;
}

// Makes a due scheduled message "arrive": bumps the preview + unread counters
// and clears the schedule entry. Any participant's client may run this; the
// transaction makes sure it happens once.
export async function publishScheduled(chatId, msgId) {
  const ref = doc(db, "chats", chatId);
  return runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    const data = snap.data();
    const entry = data?.scheduled?.[msgId];
    if (!entry) return false;
    const atMs = entry.at?.toMillis?.() || 0;
    if (atMs > Date.now() + 1000) return false;
    const patch = { [`scheduled.${msgId}`]: deleteField(), hiddenFor: [] };
    ((data.participants || []).filter((uid) => uid !== entry.senderId)).forEach((uid) => {
      patch[`unread.${uid}`] = increment(1);
    });
    const currentLast = data.lastMessageAt?.toMillis?.() || 0;
    if (atMs >= currentLast) {
      patch.lastMessage = entry.preview || "";
      patch.lastEnc = entry.previewEnc || deleteField();
      patch.lastMessageAt = entry.at;
      patch.lastMessageSenderId = entry.senderId;
      patch.lastSilent = !!entry.silent;
    }
    tx.update(ref, patch);
    return true;
  });
}

// Poll votes: votes.{uid} = [option indexes]; an empty list removes the vote.
export async function votePoll(chatId, messageId, uid, choices) {
  await updateDoc(doc(db, "chats", chatId, "messages", messageId), {
    [`votes.${uid}`]: choices.length ? choices : deleteField(),
  });
}

export async function cancelScheduled(chatId, msgId) {
  await deleteDoc(doc(db, "chats", chatId, "messages", msgId));
  await updateDoc(doc(db, "chats", chatId), { [`scheduled.${msgId}`]: deleteField() });
}

// Edit for end-to-end encrypted messages: the ciphertext is replaced as a whole.
export async function editEncryptedMessage(chatId, messageId, enc) {
  await updateDoc(doc(db, "chats", chatId, "messages", messageId), {
    enc,
    edited: true,
    editedAt: serverTimestamp(),
  });
}

// Clears my unread counter and moves my read marker (drives ✓✓ for the
// other side).
// receipt=false (read receipts turned off) clears the counter without
// telling the other side when the chat was read.
export async function markChatRead(chatId, uid, receipt = true) {
  await updateDoc(doc(db, "chats", chatId), {
    [`unread.${uid}`]: 0,
    ...(receipt ? { [`lastRead.${uid}`]: serverTimestamp() } : {}),
  });
}

export async function setChatPinnedMessage(chatId, pinned) {
  await updateDoc(doc(db, "chats", chatId), { pinned: pinned || deleteField() });
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

// "Delete for me": the message stays for the other person.
export async function hideMessageForMe(chatId, messageId, uid) {
  await updateDoc(doc(db, "chats", chatId, "messages", messageId), { hiddenFor: arrayUnion(uid) });
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

export async function setChecklistItem(chatId, messageId, idx, uid) {
  await updateDoc(doc(db, "chats", chatId, "messages", messageId), { [`checks.${idx}`]: uid || deleteField() });
}

// Adds wrapped message keys for more of the account's devices (history sync).
export async function addMessageKeys(chatId, messageId, entries) {
  const patch = {};
  for (const [id, v] of Object.entries(entries)) patch[`enc.keys.${id}`] = v;
  if (Object.keys(patch).length) await updateDoc(doc(db, "chats", chatId, "messages", messageId), patch);
}

// Auto-delete timer (Telegram's "Автоудаление"): seconds, 0 = off.
export async function setChatAutoDelete(chatId, seconds) {
  await updateDoc(doc(db, "chats", chatId), { autoDelete: seconds || deleteField() });
}

// Firestore Timestamp for a message's expireAt (also used by a TTL policy).
export function expiryAt(ms) {
  return Timestamp.fromMillis(ms);
}
