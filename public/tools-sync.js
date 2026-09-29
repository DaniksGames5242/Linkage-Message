import { db } from "./firebase.js";
import { doc, onSnapshot, setDoc, getDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// Personal tools kept in sync across my devices: bookmarks, chat notes,
// templates, reminders, sticker pack. users/{uid}/private/tools is readable
// and writable only by its owner (unlike users/{uid}, which everyone reads).
const toolsRef = (uid) => doc(db, "users", uid, "private", "tools");

export function listenTools(uid, onChange, onError) {
  return onSnapshot(toolsRef(uid), (snap) => onChange(snap.exists() ? snap.data() : {}), onError);
}

// Whole-field replace (merge: true would deep-merge maps and never drop keys).
export function saveToolsField(uid, field, value) {
  return setDoc(toolsRef(uid), { [field]: value, updatedAt: Date.now() }, { mergeFields: [field, "updatedAt"] });
}

// Shared sticker packs: stickerPacks/{ownerUid}, readable by anyone signed in.
export async function publishStickerPack(uid, name, stickers) {
  await setDoc(doc(db, "stickerPacks", uid), { ownerId: uid, name, stickers, updatedAt: Date.now() });
}

export async function getStickerPack(id) {
  const snap = await getDoc(doc(db, "stickerPacks", id));
  return snap.exists() ? snap.data() : null;
}
