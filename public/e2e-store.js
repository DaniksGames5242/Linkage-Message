// Firestore side of end-to-end encryption: each device's public key is
// listed on the owner's profile as users/{uid}.e2eDevices.{deviceId}.
import { db } from "./firebase.js";
import { doc, updateDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

export async function publishDevice(uid, id, pub, name) {
  await updateDoc(doc(db, "users", uid), { [`e2eDevices.${id}`]: { pub, name: name || "", addedAt: serverTimestamp() } });
}
