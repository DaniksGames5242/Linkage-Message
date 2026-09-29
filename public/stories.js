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
  limitToLast,
  onSnapshot,
  serverTimestamp,
  Timestamp,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

export const STORY_LIFETIME_MS = 24 * 60 * 60 * 1000;

// A story is either an inline (downscaled) image or a video hosted on
// Cloudinary: addStory(uid, { image }) / addStory(uid, { videoUrl, duration }).
// audience: who may see it — the owner plus their contacts at posting time.
export async function addStory(uid, media, audience = []) {
  const payload = { ownerId: uid, audience: [...new Set([uid, ...audience])].slice(0, 2000), createdAt: serverTimestamp() };
  if (typeof media === "string") payload.image = media;
  else if (media?.videoUrl) {
    payload.videoUrl = media.videoUrl;
    payload.duration = Math.min(60, Math.max(1, Math.round(media.duration || 15)));
    if (media.poster) payload.poster = media.poster;
  } else payload.image = media?.image;
  await addDoc(collection(db, "stories"), payload);
}

export async function deleteStory(storyId) {
  await deleteDoc(doc(db, "stories", storyId));
}

// Stories are shown only to the owner's contacts (listed in `audience`,
// enforced by the Firestore rules).
export function listenRecentStories(uid, onChange, onError) {
  const since = Timestamp.fromMillis(Date.now() - STORY_LIFETIME_MS);
  const q = query(
    collection(db, "stories"),
    where("audience", "array-contains", uid),
    where("createdAt", ">", since),
    orderBy("createdAt", "desc"),
    limit(300)
  );
  return onSnapshot(
    q,
    (snap) => onChange(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
    (err) => {
      console.error("listenRecentStories failed:", err);
      if (onError) onError(err);
    }
  );
}

// ---------- Story comments ----------

export async function addStoryComment(storyId, uid, text) {
  const t = (text || "").trim().slice(0, 500);
  if (!t) return;
  await addDoc(collection(db, "stories", storyId, "comments"), { uid, text: t, createdAt: serverTimestamp() });
}

export async function deleteStoryComment(storyId, commentId) {
  await deleteDoc(doc(db, "stories", storyId, "comments", commentId));
}

export function listenStoryComments(storyId, onChange) {
  const q = query(collection(db, "stories", storyId, "comments"), orderBy("createdAt", "asc"), limitToLast(200));
  return onSnapshot(
    q,
    (snap) => onChange(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
    (err) => console.error("listenStoryComments failed:", err)
  );
}
