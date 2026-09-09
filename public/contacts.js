import { db } from "./firebase.js";
import {
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
  collection,
  onSnapshot,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { normalizeUsername, isValidUsername } from "./utils.js";

// Returns { uid, profile } | null - looks a user up by username.
export async function searchUser(rawQuery, myUid) {
  const raw = (rawQuery || "").trim();
  if (!raw) return null;

  const uname = normalizeUsername(raw);
  if (!isValidUsername(uname)) return null;

  const unameSnap = await getDoc(doc(db, "usernames", uname));
  if (!unameSnap.exists()) return null;
  const targetUid = unameSnap.data().uid;

  if (targetUid === myUid) return { uid: targetUid, profile: null, self: true };

  const profileSnap = await getDoc(doc(db, "users", targetUid));
  if (!profileSnap.exists()) return null;

  return { uid: targetUid, profile: profileSnap.data() };
}

export async function addContact(myUid, contactUid) {
  await setDoc(doc(db, "users", myUid, "contacts", contactUid), {
    addedAt: serverTimestamp(),
  });
}

export async function setContactAlias(myUid, contactUid, { firstName, lastName }) {
  await setDoc(
    doc(db, "users", myUid, "contacts", contactUid),
    {
      firstName: (firstName || "").trim().slice(0, 40),
      lastName: (lastName || "").trim().slice(0, 40),
    },
    { merge: true }
  );
}

export function contactDisplayName(contact, fallbackProfile) {
  const alias = [contact?.firstName, contact?.lastName].filter(Boolean).join(" ").trim();
  return alias || fallbackProfile?.displayName || "—";
}

export function listenContacts(myUid, onChange) {
  return onSnapshot(collection(db, "users", myUid, "contacts"), async (snap) => {
    const uids = snap.docs.map((d) => d.id);
    const profiles = await Promise.all(
      uids.map(async (uid) => {
        const s = await getDoc(doc(db, "users", uid));
        return s.exists() ? { uid, profile: s.data() } : null;
      })
    );
    const aliasByUid = new Map(snap.docs.map((d) => [d.id, d.data()]));
    onChange(
      profiles.filter(Boolean).map((entry) => ({ ...entry, alias: aliasByUid.get(entry.uid) || null }))
    );
  });
}

export async function getProfile(uid) {
  const snap = await getDoc(doc(db, "users", uid));
  return snap.exists() ? snap.data() : null;
}
