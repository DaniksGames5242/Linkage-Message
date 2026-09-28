// ICE servers for voice/video calls.
//
// Public STUN is enough when both people are on ordinary home/office
// networks. Mobile carriers and strict NATs need a TURN relay: configure it
// in Vercel env vars (see api/turn.js / README → Звонки) — the app fetches
// temporary TURN credentials from /api/turn and adds them to this list.
// A static TURN entry can still be added below if you prefer.
window.LINKAGE_ICE_SERVERS = [
  { urls: ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"] },
  // { urls: "turn:YOUR_TURN_HOST:443?transport=tcp", username: "USER", credential: "PASSWORD" },
];
