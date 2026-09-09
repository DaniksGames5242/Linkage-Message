import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const cfg = window.FIREBASE_CONFIG;

export const configLooksEmpty = !cfg || cfg.apiKey === "YOUR_API_KEY";

export let app = null;
export let auth = null;
export let db = null;

if (!configLooksEmpty) {
  app = initializeApp(cfg);
  auth = getAuth(app);
  db = getFirestore(app);
}
