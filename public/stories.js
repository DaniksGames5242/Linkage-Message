import { db } from "./firebase.js";
import {
  doc,
  addDoc,
  deleteDoc,
  collection,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  serverTimestamp,
  Timestamp,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

export const STORY_LIFETIME_MS = 24 * 60 * 60 * 1000;

export async function addStory(uid, image) {
  await addDoc(collection(db, "stories"), {
    ownerId: uid,
    image,
    createdAt: serverTimestamp(),
  });
}

export async function deleteStory(storyId) {
  await deleteDoc(doc(db, "stories", storyId));
}

// Everyone signed in can see everyone's stories (this app has no follower
// graph - "contacts" here are just per-user aliases, not an access list),
// mirroring how profiles/usernames are already fully visible to any user.
export function listenRecentStories(onChange, onError) {
  const since = Timestamp.fromMillis(Date.now() - STORY_LIFETIME_MS);
  const q = query(collection(db, "stories"), where("createdAt", ">", since), orderBy("createdAt", "desc"), limit(300));
  return onSnapshot(
    q,
    (snap) => onChange(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
    (err) => {
      console.error("listenRecentStories failed:", err);
      if (onError) onError(err);
    }
  );
}
