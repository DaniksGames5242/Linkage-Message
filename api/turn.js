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
//   Metered.ca                METERED_DOMAIN (e.g. myapp.metered.live) + METERED_SECRET_KEY
//                             (the "sk_secret_…" key; optional METERED_SECRET_KEY_ID "sk_id_…")
//                             or METERED_DOMAIN + METERED_API_KEY (a TURN API key)
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

// Metered: either a TURN API key (METERED_API_KEY) that lists the ICE
// servers directly, or the account secret key (METERED_SECRET_KEY, "sk_secret_…")
// that first creates a temporary credential. One credential is shared by
// everyone for a few hours, so the dashboard doesn't fill up with them.
let meteredCache = null; // { iceServers, until }
const meteredBase = () => "https://" + String(process.env.METERED_DOMAIN || "").replace(/^https?:\/\//, "").replace(/\/+$/, "");

async function meteredList(apiKey) {
  const r = await fetch(`${meteredBase()}/api/v1/turn/credentials?apiKey=${encodeURIComponent(apiKey)}`);
  if (!r.ok) throw new Error("Metered TURN: list HTTP " + r.status);
  const list = asArray(await r.json());
  if (!list.length) throw new Error("Metered TURN: empty server list");
  return list;
}

async function metered() {
  if (!process.env.METERED_DOMAIN) return null;
  const apiKey = process.env.METERED_API_KEY;
  const secret = process.env.METERED_SECRET_KEY;
  if (!apiKey && !secret) return null;
  if (meteredCache && meteredCache.until > Date.now()) return meteredCache.iceServers;
  let iceServers;
  if (apiKey) {
    iceServers = await meteredList(apiKey);
  } else {
    const ttl = 6 * 3600;
    const body = JSON.stringify({ expiryInSeconds: ttl, label: "linkage-message" });
    const headers = { "Content-Type": "application/json" };
    let r = await fetch(`${meteredBase()}/api/v1/turn/credential?secretKey=${encodeURIComponent(secret)}`, { method: "POST", headers, body });
    // Some accounts pair the secret with a key id: try it as HTTP Basic auth.
    if ((r.status === 401 || r.status === 403) && process.env.METERED_SECRET_KEY_ID) {
      const basic = Buffer.from(`${process.env.METERED_SECRET_KEY_ID}:${secret}`).toString("base64");
      r = await fetch(`${meteredBase()}/api/v1/turn/credential`, { method: "POST", headers: { ...headers, Authorization: "Basic " + basic }, body });
    }
    if (!r.ok) throw new Error("Metered TURN: create credential HTTP " + r.status);
    const cred = await r.json();
    if (cred.apiKey) iceServers = await meteredList(cred.apiKey);
    else if (cred.username && cred.password) {
      const auth = { username: cred.username, credential: cred.password };
      iceServers = [
        { urls: "stun:stun.relay.metered.ca:80" },
        { urls: "turn:global.relay.metered.ca:80", ...auth },
        { urls: "turn:global.relay.metered.ca:80?transport=tcp", ...auth },
        { urls: "turn:global.relay.metered.ca:443", ...auth },
        { urls: "turns:global.relay.metered.ca:443?transport=tcp", ...auth },
      ];
    } else throw new Error("Metered TURN: unexpected credential response");
  }
  // Refresh well before the credential expires (clients cache for up to 6 h).
  meteredCache = { iceServers, until: Date.now() + (apiKey ? 3600e3 : 3 * 3600e3) };
  return iceServers;
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
    const provider = iceServers.length ? (process.env.TURN_CLOUDFLARE_KEY_ID ? "cloudflare" : process.env.METERED_DOMAIN ? "metered" : "own") : null;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ iceServers, configured: iceServers.length > 0, provider }));
  } catch (err) {
    console.error(err);
    res.statusCode = 502;
    res.end(JSON.stringify({ error: String(err.message || err) }));
  }
};
