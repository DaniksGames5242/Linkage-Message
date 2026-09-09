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
  if (profile?.avatarImage) {
    return `<div class="avatar" style="background:${color}"><img src="${profile.avatarImage}" alt="" /></div>`;
  }
  const emoji = profile?.avatarEmoji;
  const label = escapeHTML(emoji || initials(profile?.displayName));
  return `<div class="avatar" style="background:${color}">${label}</div>`;
}

// Reads an image file, center-crops it to a square and downsizes it so it's
// small enough to store inline in a Firestore document (well under 1 MiB).
export function resizeImageToDataUrl(file, size = 256, quality = 0.85) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Не удалось прочитать файл"));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("Файл не похож на изображение"));
      img.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext("2d");
        const side = Math.min(img.width, img.height);
        const sx = (img.width - side) / 2;
        const sy = (img.height - side) / 2;
        ctx.drawImage(img, sx, sy, side, side, 0, 0, size, size);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

const EYE_OPEN =
  '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z"/><circle cx="12" cy="12" r="3"/></svg>';
const EYE_CLOSED =
  '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M17.94 17.94A10.94 10.94 0 0 1 12 19c-7 0-11-7-11-7a20.3 20.3 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 7 11 7a20.4 20.4 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>';

// Wires an eye-icon button to toggle an <input type="password"> field's visibility.
export function attachPasswordToggle(inputEl, btnEl) {
  btnEl.innerHTML = EYE_CLOSED;
  btnEl.addEventListener("click", () => {
    const showing = inputEl.type === "text";
    inputEl.type = showing ? "password" : "text";
    btnEl.innerHTML = showing ? EYE_CLOSED : EYE_OPEN;
  });
}

export function fmtDateTime(ts) {
  if (!ts || !ts.toDate) return "";
  return ts.toDate().toLocaleString([], { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

// Rough, best-effort "Browser on OS" label for login history entries.
export function describeDevice() {
  const ua = navigator.userAgent || "";
  let browser = "Браузер";
  if (/Edg\//.test(ua)) browser = "Edge";
  else if (/OPR\//.test(ua)) browser = "Opera";
  else if (/Chrome\//.test(ua)) browser = "Chrome";
  else if (/Firefox\//.test(ua)) browser = "Firefox";
  else if (/Safari\//.test(ua)) browser = "Safari";

  let os = "устройство";
  if (/Windows/.test(ua)) os = "Windows";
  else if (/Mac OS X/.test(ua)) os = "macOS";
  else if (/Android/.test(ua)) os = "Android";
  else if (/iPhone|iPad|iOS/.test(ua)) os = "iOS";
  else if (/Linux/.test(ua)) os = "Linux";

  return `${browser}, ${os}`;
}
