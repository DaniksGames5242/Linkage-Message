// Firestore storage for end-to-end encryption keys.
//   users/{uid}.e2ePub               – public key (JWK), readable by everyone signed in
//   users/{uid}/private/e2e          – private key encrypted with a key derived
//                                      from the account password (owner-only)
import { db } from "./firebase.js";
import { doc, getDoc, setDoc, updateDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

export async function getMyKeyDoc(uid) {
  const snap = await getDoc(doc(db, "users", uid, "private", "e2e"));
  return snap.exists() ? snap.data() : null;
}

export async function saveMyKeyDoc(uid, data) {
  await setDoc(doc(db, "users", uid, "private", "e2e"), data);
}

export async function publishPublicKey(uid, jwk) {
  await updateDoc(doc(db, "users", uid), { e2ePub: jwk });
}
