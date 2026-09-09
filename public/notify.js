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

// The "Linkage Notifications" feed merges two sources client-side:
//  - users/{uid}/systemChat  - personal notices (e.g. login alerts), self-written
//  - broadcasts              - announcements from the admin account ("danik"), shared by everyone
// Listens to both and reports the merged, time-sorted list on every change.
export function listenNotificationsFeed(uid, onChange) {
  let personal = [];
  let broadcasts = [];

  function emit() {
    const merged = [...personal, ...broadcasts].sort((a, b) => {
      const ta = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
      const tb = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
      return ta - tb;
    });
    onChange(merged);
  }

  const unsubPersonal = onSnapshot(
    query(collection(db, "users", uid, "systemChat"), orderBy("createdAt", "asc"), limit(200)),
    (snap) => {
      personal = snap.docs.map((d) => ({ id: "p_" + d.id, ...d.data(), source: "personal" }));
      emit();
    }
  );

  const unsubBroadcasts = onSnapshot(
    query(collection(db, "broadcasts"), orderBy("createdAt", "asc"), limit(200)),
    (snap) => {
      broadcasts = snap.docs.map((d) => ({ id: "b_" + d.id, ...d.data(), source: "broadcast" }));
      emit();
    }
  );

  return () => {
    unsubPersonal();
    unsubBroadcasts();
  };
}

export async function addPersonalNotice(uid, text) {
  await addDoc(collection(db, "users", uid, "systemChat"), {
    text: text.trim(),
    senderId: uid,
    createdAt: serverTimestamp(),
  });
}

export async function addBroadcast(adminUid, text) {
  const trimmed = text.trim();
  if (!trimmed) return;
  await addDoc(collection(db, "broadcasts"), {
    text: trimmed,
    senderId: adminUid,
    createdAt: serverTimestamp(),
  });
}
