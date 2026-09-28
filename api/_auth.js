// Shared by the API functions: accepts only signed-in users of this Firebase
// project (a valid ID token in "Authorization: Bearer …"). Files starting
// with "_" are not exposed as routes by Vercel.
const fs = require("fs");
const path = require("path");

function firebaseApiKey() {
  if (process.env.FIREBASE_API_KEY) return process.env.FIREBASE_API_KEY;
  try {
    const src = fs.readFileSync(path.join(process.cwd(), "public", "firebase-config.js"), "utf8");
    return (src.match(/apiKey:\s*["']([^"']+)["']/) || [])[1] || null;
  } catch {
    return null;
  }
}

const cache = new Map(); // token -> { uid, until }

// Valid Firebase ID token of this project → uid (or null).
async function verifyUser(req) {
  const token = (req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  const key = firebaseApiKey();
  if (!token || !key) return null;
  const hit = cache.get(token);
  if (hit && hit.until > Date.now()) return hit.uid;
  const r = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(key)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ idToken: token }),
  });
  if (!r.ok) return null;
  const data = await r.json();
  const uid = data.users?.[0]?.localId || null;
  if (uid) {
    if (cache.size > 500) cache.clear();
    cache.set(token, { uid, until: Date.now() + 10 * 60 * 1000 });
  }
  return uid;
}

module.exports = { verifyUser };
