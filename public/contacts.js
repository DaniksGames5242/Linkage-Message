import { db } from "./firebase.js";
import {
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
  collection,
  onSnapshot,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { normalizeEmail, isValidEmail, normalizeUsername, isValidUsername } from "./utils.js";

// Returns { uid, profile } | null. Tries email first if it looks like one, else username.
export async function searchUser(rawQuery, myUid) {
  const raw = (rawQuery || "").trim();
  if (!raw) return null;

  const email = isValidEmail(raw) ? normalizeEmail(raw) : null;
  let targetUid = null;

  if (email) {
    const emailSnap = await getDoc(doc(db, "emails", email));
    if (emailSnap.exists()) targetUid = emailSnap.data().uid;
  } else {
    const uname = normalizeUsername(raw);
    if (isValidUsername(uname)) {
      const unameSnap = await getDoc(doc(db, "usernames", uname));
      if (unameSnap.exists()) targetUid = unameSnap.data().uid;
    }
  }

  if (!targetUid) return null;
  if (targetUid === myUid) return { uid: targetUid, profile: null, self: true };

  const profileSnap = await getDoc(doc(db, "users", targetUid));
  if (!profileSnap.exists()) return null;
  const profile = profileSnap.data();

  if (email && profile.privacy?.findByEmail === "nobody") {
    return null;
  }

  return { uid: targetUid, profile };
}

export async function addContact(myUid, contactUid) {
  await setDoc(doc(db, "users", myUid, "contacts", contactUid), {
    addedAt: serverTimestamp(),
  });
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
    onChange(profiles.filter(Boolean));
  });
}

export async function getProfile(uid) {
  const snap = await getDoc(doc(db, "users", uid));
  return snap.exists() ? snap.data() : null;
}
