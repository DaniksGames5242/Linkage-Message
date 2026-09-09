export const AVATAR_COLORS = [
  "#5b8cff", "#8b5cf6", "#e5484d", "#f5a623", "#3ddc84",
  "#00b8d9", "#ff6b9d", "#a3a3a3", "#c084fc", "#22c55e",
];

export function colorForUid(uid) {
  let hash = 0;
  for (let i = 0; i < uid.length; i++) {
    hash = (hash << 5) - hash + uid.charCodeAt(i);
    hash |= 0;
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

export function initials(name) {
  return (name || "?").trim().slice(0, 2).toUpperCase();
}

export function debounce(fn, ms) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}

export function normalizeUsername(raw) {
  return (raw || "").trim().toLowerCase().replace(/^@/, "");
}

export function isValidUsername(name) {
  return /^[a-z0-9_]{3,20}$/.test(name);
}

export function normalizeEmail(raw) {
  return (raw || "").trim().toLowerCase();
}

export function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function chatIdFor(uidA, uidB) {
  return [uidA, uidB].sort().join("_");
}

export function fmtTime(ts) {
  if (!ts || !ts.toDate) return "";
  return ts.toDate().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export function fmtRelative(ts) {
  if (!ts || !ts.toDate) return "";
  const diffMs = Date.now() - ts.toDate().getTime();
  const min = Math.floor(diffMs / 60000);
  if (min < 1) return "только что";
  if (min < 60) return `${min} мин. назад`;
  const hrs = Math.floor(min / 60);
  if (hrs < 24) return `${hrs} ч. назад`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days} дн. назад`;
  return ts.toDate().toLocaleDateString();
}

export function isRecentlyOnline(ts) {
  if (!ts || !ts.toDate) return false;
  return Date.now() - ts.toDate().getTime() < 90 * 1000;
}

export function escapeHTML(str) {
  const div = document.createElement("div");
  div.textContent = str ?? "";
  return div.innerHTML;
}

export function avatarHTML(profile, uid) {
  const color = profile?.avatarColor || colorForUid(uid || "?");
  const emoji = profile?.avatarEmoji;
  const label = escapeHTML(emoji || initials(profile?.displayName));
  return `<div class="avatar" style="background:${color}">${label}</div>`;
}
