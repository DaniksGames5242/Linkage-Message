// Lightweight message formatting, Telegram-like markdown:
//   **bold**   __italic__   ~~strike~~   `code`   ||spoiler||
// Parsed into DOM nodes (never innerHTML), so user text can't inject markup.

const RULES = [
  { re: /`([^`\n]+)`/, tag: "code", raw: true },
  { re: /\|\|([\s\S]+?)\|\|/, tag: "spoiler" },
  { re: /\*\*([\s\S]+?)\*\*/, tag: "strong" },
  { re: /__([\s\S]+?)__/, tag: "em" },
  { re: /~~([\s\S]+?)~~/, tag: "s" },
];

// `appendPlain(parent, text)` handles unformatted runs (e.g. links).
export function appendRich(parent, text, appendPlain) {
  let best = null;
  for (const rule of RULES) {
    const m = rule.re.exec(text);
    if (m && (!best || m.index < best.m.index)) best = { rule, m };
  }
  if (!best) {
    if (text) appendPlain(parent, text);
    return;
  }
  const { rule, m } = best;
  if (m.index > 0) appendPlain(parent, text.slice(0, m.index));
  const el = document.createElement(rule.tag === "spoiler" ? "span" : rule.tag);
  if (rule.tag === "spoiler") {
    el.className = "spoiler";
    el.title = "Нажмите, чтобы показать";
    el.addEventListener("click", (e) => {
      if (el.classList.contains("revealed")) return;
      e.stopPropagation();
      el.classList.add("revealed");
    });
  }
  if (rule.raw) el.textContent = m[1];
  else appendRich(el, m[1], appendPlain);
  parent.append(el);
  appendRich(parent, text.slice(m.index + m[0].length), appendPlain);
}

// Plain-text version for chat-list previews and notifications.
export function stripRich(text) {
  return (text || "")
    .replace(/\|\|([\s\S]+?)\|\|/g, (_, s) => "▒".repeat(Math.min(Math.max(s.length, 3), 8)))
    .replace(/\*\*([\s\S]+?)\*\*/g, "$1")
    .replace(/__([\s\S]+?)__/g, "$1")
    .replace(/~~([\s\S]+?)~~/g, "$1")
    .replace(/`([^`\n]+)`/g, "$1");
}

// Wraps the textarea selection with a marker (Ctrl+B etc.).
export function wrapSelection(textarea, marker) {
  const { selectionStart: a, selectionEnd: b, value } = textarea;
  const selected = value.slice(a, b) || "текст";
  textarea.value = value.slice(0, a) + marker + selected + marker + value.slice(b);
  textarea.selectionStart = a + marker.length;
  textarea.selectionEnd = a + marker.length + selected.length;
  textarea.dispatchEvent(new Event("input"));
}
