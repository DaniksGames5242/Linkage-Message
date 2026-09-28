// Firestore signalling for 1:1 WebRTC calls.
//
// calls/{callId}: { callerId, calleeId, chatId, kind: "audio" | "video",
//   status: "ringing" | "accepted" | "declined" | "busy" | "ended" | "missed" | "cancelled",
//   offer, answer, createdAt, answeredAt, endedAt }
// calls/{callId}/candidates/{id}: { from, candidate }  (ICE candidates)

import { db } from "./firebase.js";
import {
  doc,
  setDoc,
  updateDoc,
  addDoc,
  collection,
  query,
  where,
  onSnapshot,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

export function newCallId() {
  return doc(collection(db, "calls")).id;
}

export async function createCall(callId, data) {
  await setDoc(doc(db, "calls", callId), { ...data, createdAt: serverTimestamp() });
}

export async function updateCall(callId, fields) {
  const patch = { ...fields };
  if (fields.status === "accepted") patch.answeredAt = serverTimestamp();
  if (["ended", "declined", "missed", "cancelled", "busy"].includes(fields.status)) patch.endedAt = serverTimestamp();
  await updateDoc(doc(db, "calls", callId), patch);
}

export function listenCall(callId, onChange) {
  return onSnapshot(doc(db, "calls", callId), (snap) => onChange(snap.exists() ? { id: snap.id, ...snap.data() } : null));
}

export function listenIncomingCalls(uid, onChange, onError) {
  const q = query(collection(db, "calls"), where("calleeId", "==", uid), where("status", "==", "ringing"));
  return onSnapshot(
    q,
    (snap) => onChange(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
    (err) => {
      console.error("listenIncomingCalls failed:", err);
      if (onError) onError(err);
    }
  );
}

export async function addCandidate(callId, from, candidate) {
  await addDoc(collection(db, "calls", callId, "candidates"), { from, candidate });
}

export function listenCandidates(callId, fromUid, onCandidate) {
  const q = query(collection(db, "calls", callId, "candidates"), where("from", "==", fromUid));
  return onSnapshot(q, (snap) => {
    snap.docChanges().forEach((c) => {
      if (c.type === "added") onCandidate(c.doc.data().candidate);
    });
  });
}
