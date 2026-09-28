// ICE servers for voice/video calls.
//
// Public STUN is enough when both people are on ordinary home/office
// networks. Some mobile carriers and strict corporate networks block direct
// peer-to-peer connections; for those a TURN relay is required. Free TURN is
// available e.g. from https://www.metered.ca/tools/openrelay/ — paste the
// credentials it gives you into the commented entry below.
window.LINKAGE_ICE_SERVERS = [
  { urls: ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"] },
  // { urls: "turn:YOUR_TURN_HOST:443?transport=tcp", username: "USER", credential: "PASSWORD" },
];
