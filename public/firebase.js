import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, connectAuthEmulator } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore, connectFirestoreEmulator } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const cfg = window.FIREBASE_CONFIG;

export const configLooksEmpty = !cfg || cfg.apiKey === "YOUR_API_KEY";

export let app = null;
export let auth = null;
export let db = null;

if (!configLooksEmpty) {
  app = initializeApp(cfg);
  auth = getAuth(app);
  db = getFirestore(app);
  // Local end-to-end tests run against the Firebase emulators (only on
  // localhost, only when a test turns it on).
  let emulate = false;
  try {
    emulate = /^(localhost|127\.0\.0\.1)$/.test(location.hostname) && localStorage.getItem("lm-emulator") === "1";
  } catch (_) {}
  if (emulate) {
    connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
    connectFirestoreEmulator(db, "127.0.0.1", 8088);
  }
}
