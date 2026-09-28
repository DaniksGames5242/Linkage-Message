// GET /api/turn — short-lived TURN credentials for voice/video calls.
//
// Calls connect peer-to-peer; on mobile networks and behind strict NATs that
// is often impossible and the media has to go through a TURN relay. The
// relay's secret stays here (Vercel → Project → Settings → Environment
// Variables); the app only ever receives temporary credentials, and only
// signed-in users of this Firebase project get them.
//
// Configure ONE of:
//   Cloudflare Realtime TURN  TURN_CLOUDFLARE_KEY_ID + TURN_CLOUDFLARE_API_TOKEN
//   Metered.ca                METERED_DOMAIN (e.g. myapp.metered.live) + METERED_API_KEY
//   Your own coturn server    TURN_URLS (comma separated) + TURN_USERNAME + TURN_CREDENTIAL
// Optional: FIREBASE_API_KEY (otherwise read from public/firebase-config.js), see _auth.js.

const { verifyUser } = require("./_auth.js");

const asArray = (x) => (Array.isArray(x) ? x : x ? [x] : []);

async function cloudflare() {
  const id = process.env.TURN_CLOUDFLARE_KEY_ID;
  const token = process.env.TURN_CLOUDFLARE_API_TOKEN;
  if (!id || !token) return null;
  const base = `https://rtc.live.cloudflare.com/v1/turn/keys/${encodeURIComponent(id)}/credentials`;
  const init = {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ ttl: 86400 }),
  };
  let r = await fetch(`${base}/generate-ice-servers`, init);
  if (!r.ok) r = await fetch(`${base}/generate`, init);
  if (!r.ok) throw new Error("Cloudflare TURN: HTTP " + r.status);
  const data = await r.json();
  return asArray(data.iceServers);
}

async function metered() {
  const domain = process.env.METERED_DOMAIN;
  const key = process.env.METERED_API_KEY;
  if (!domain || !key) return null;
  const r = await fetch(`https://${domain.replace(/^https?:\/\//, "")}/api/v1/turn/credentials?apiKey=${encodeURIComponent(key)}`);
  if (!r.ok) throw new Error("Metered TURN: HTTP " + r.status);
  return asArray(await r.json());
}

function ownServer() {
  const urls = (process.env.TURN_URLS || "").split(",").map((s) => s.trim()).filter(Boolean);
  if (!urls.length) return null;
  return [{ urls, username: process.env.TURN_USERNAME || "", credential: process.env.TURN_CREDENTIAL || "" }];
}

module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "private, no-store");
  try {
    const uid = await verifyUser(req);
    if (!uid) {
      res.statusCode = 401;
      return res.end(JSON.stringify({ error: "sign in required" }));
    }
    const iceServers = (await cloudflare()) || (await metered()) || ownServer() || [];
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ iceServers, configured: iceServers.length > 0 }));
  } catch (err) {
    console.error(err);
    res.statusCode = 502;
    res.end(JSON.stringify({ error: String(err.message || err) }));
  }
};
