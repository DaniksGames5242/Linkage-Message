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
  limitToLast,
  onSnapshot,
  serverTimestamp,
  arrayUnion,
  arrayRemove,
  increment,
  runTransaction,
  Timestamp,
  deleteField,
  writeBatch,
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
  // No orderBy here on purpose: array-contains + orderBy needs a composite
  // index, and without it the whole list silently fails to load. The client
  // sorts by lastMessageAt anyway.
  const q = query(collection(db, "groups"), where("members", "array-contains", uid));
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

export function listenGroupMessages(groupId, onChange, onError, size = 300) {
  const q = query(collection(db, "groups", groupId, "messages"), orderBy("createdAt", "asc"), limitToLast(size));
  return onSnapshot(
    q,
    (snap) => onChange(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
    (err) => {
      console.error("listenGroupMessages failed:", err);
      if (onError) onError(err);
    }
  );
}

// `extra` carries optional message metadata (forwardedFrom, call log, …).
// opts.preview / opts.previewEnc override the chat-list preview (end-to-end
// encrypted chats never store readable text there); opts.scheduleAt (ms)
// schedules the message: it is written now but stays hidden until then and
// the chat preview/unread counters are updated by publishScheduled().
export async function sendGroupMessage(groupId, senderId, text, attachment, replyTo, extra, memberUids = [], opts = {}) {
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
  if (opts.plain) Object.assign(payload, opts.plain);

  const preview = opts.preview ?? (attachment?.previewText || trimmed);
  const ref = doc(collection(db, "groups", groupId, "messages"));
  const groupRef = doc(db, "groups", groupId);
  // Every post stamps slow.<uid> in the same batch: the rules check it
  // against settings.slowMode (Firestore compares it with request.time).
  const batch = writeBatch(db);
  if (opts.scheduleAt) {
    const at = Timestamp.fromMillis(opts.scheduleAt);
    payload.scheduledAt = at;
    batch.set(ref, payload);
    const entry = { at, senderId, preview, silent: !!opts.silent };
    if (opts.previewEnc) entry.previewEnc = opts.previewEnc;
    batch.set(groupRef, { scheduled: { [ref.id]: entry }, slow: { [senderId]: serverTimestamp() } }, { merge: true });
    await batch.commit();
    return ref.id;
  }

  const others = memberUids.filter((uid) => uid && uid !== senderId);
  batch.set(ref, payload);
  batch.set(
    groupRef,
    {
      lastMessage: preview,
      lastEnc: opts.previewEnc || deleteField(),
      lastMessageAt: serverTimestamp(),
      lastMessageSenderId: senderId,
      lastSilent: !!opts.silent,
      hiddenFor: [],
      slow: { [senderId]: serverTimestamp() },
      unread: Object.fromEntries(others.map((uid) => [uid, increment(1)])),
      // Unread @mentions per member (the "@" badge in the chat list).
      ...(extra?.mentions?.length
        ? { mentions: Object.fromEntries(extra.mentions.filter((u) => others.includes(u)).map((u) => [u, increment(1)])) }
        : {}),
    },
    { merge: true }
  );
  await batch.commit();
  return ref.id;
}

// Makes a due scheduled message "arrive": bumps the preview + unread counters
// and clears the schedule entry. Any participant's client may run this; the
// transaction makes sure it happens once.
export async function publishScheduledGroup(groupId, msgId) {
  const ref = doc(db, "groups", groupId);
  return runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    const data = snap.data();
    const entry = data?.scheduled?.[msgId];
    if (!entry) return false;
    const atMs = entry.at?.toMillis?.() || 0;
    if (atMs > Date.now() + 1000) return false;
    const patch = { [`scheduled.${msgId}`]: deleteField(), hiddenFor: [] };
    ((data.members || []).filter((uid) => uid !== entry.senderId)).forEach((uid) => {
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

export async function voteGroupPoll(groupId, messageId, uid, choices) {
  await updateDoc(doc(db, "groups", groupId, "messages", messageId), {
    [`votes.${uid}`]: choices.length ? choices : deleteField(),
  });
}

export async function cancelScheduledGroup(groupId, msgId) {
  await deleteDoc(doc(db, "groups", groupId, "messages", msgId));
  await updateDoc(doc(db, "groups", groupId), { [`scheduled.${msgId}`]: deleteField() });
}

// Edit for end-to-end encrypted messages: the ciphertext is replaced as a whole.
export async function editEncryptedGroupMessage(groupId, messageId, enc) {
  await updateDoc(doc(db, "groups", groupId, "messages", messageId), {
    enc,
    edited: true,
    editedAt: serverTimestamp(),
  });
}

export async function markGroupRead(groupId, uid, receipt = true) {
  await updateDoc(doc(db, "groups", groupId), {
    [`unread.${uid}`]: 0,
    [`mentions.${uid}`]: 0,
    ...(receipt ? { [`lastRead.${uid}`]: serverTimestamp() } : {}),
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

export async function hideGroupMessageForMe(groupId, messageId, uid) {
  await updateDoc(doc(db, "groups", groupId, "messages", messageId), { hiddenFor: arrayUnion(uid) });
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

// ---------- Privacy & per-member permissions (admins only; enforced in rules) ----------

export async function updateGroupSettings(groupId, patch) {
  const data = {};
  for (const [k, v] of Object.entries(patch)) data[`settings.${k}`] = v;
  await updateDoc(doc(db, "groups", groupId), data);
}

export async function setMemberPerms(groupId, uid, perms) {
  const clean = Object.fromEntries(Object.entries(perms || {}).filter(([, v]) => v === false));
  await updateDoc(doc(db, "groups", groupId), {
    [`perms.${uid}`]: Object.keys(clean).length ? clean : deleteField(),
  });
}

export async function setGroupAdmin(groupId, uid, on) {
  await updateDoc(doc(db, "groups", groupId), { admins: on ? arrayUnion(uid) : arrayRemove(uid) });
}

export async function removeGroupMember(groupId, uid) {
  await updateDoc(doc(db, "groups", groupId), { members: arrayRemove(uid), admins: arrayRemove(uid) });
}

// Joining from an invite link: allowed by the rules when the group is public
// or the code matches the group's current invite code.
export async function joinGroup(groupId, uid, code) {
  await updateDoc(doc(db, "groups", groupId), { members: arrayUnion(uid), ...(code ? { [`joins.${uid}`]: code } : {}) });
}

export async function setGroupChecklistItem(groupId, messageId, idx, uid) {
  await updateDoc(doc(db, "groups", groupId, "messages", messageId), { [`checks.${idx}`]: uid || deleteField() });
}

export async function setGroupAutoDelete(groupId, seconds) {
  await updateDoc(doc(db, "groups", groupId), { autoDelete: seconds || deleteField() });
}
