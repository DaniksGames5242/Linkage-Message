// Telegram-style animated emoji.
//
// Animations are Google's "Noto Animated Emoji" (Lottie files, CC BY 4.0,
// https://googlefonts.github.io/noto-emoji-animation/) played with the
// bundled lottie-web light player. Anything that fails to load falls back to
// the plain system emoji, so nothing ever renders empty.

import { burst, reducedMotion } from "./ui.js";
import { ANIMATED_EMOJI } from "./emoji-data.js";

const BASE = "https://fonts.gstatic.com/s/e/notoemoji/latest";

let lottiePromise = null;
function loadLottie() {
  if (window.lottie) return Promise.resolve(window.lottie);
  if (!lottiePromise) {
    lottiePromise = new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = "vendor/lottie_light.min.js";
      s.onload = () => resolve(window.lottie);
      s.onerror = reject;
      document.head.appendChild(s);
    });
  }
  return lottiePromise;
}

const dataCache = new Map(); // emoji -> Promise<animationData | null>

function codepoints(emoji, keepVariation) {
  return Array.from(emoji)
    .map((c) => c.codePointAt(0).toString(16))
    .filter((cp) => keepVariation || cp !== "fe0f")
    .join("_");
}

function fetchAnimation(emoji) {
  // Only ~600 emoji have an animation; don't ask the CDN for the rest.
  if (!ANIMATED_EMOJI.has(emoji) && !ANIMATED_EMOJI.has(emoji.replace(/\uFE0F/g, ""))) return Promise.resolve(null);
  if (!dataCache.has(emoji)) {
    const get = (cp) =>
      fetch(`${BASE}/${cp}/lottie.json`)
        .then((r) => (r.ok ? r.json() : null))
        .catch(() => null);
    const plain = codepoints(emoji, false);
    const full = codepoints(emoji, true);
    dataCache.set(
      emoji,
      get(plain).then((data) => data || (full !== plain ? get(full) : null))
    );
  }
  return dataCache.get(emoji);
}

// ---------- Detecting emoji-only messages ----------

const segmenter = typeof Intl !== "undefined" && Intl.Segmenter ? new Intl.Segmenter(undefined, { granularity: "grapheme" }) : null;
const PICTO = /\p{Extended_Pictographic}|\p{Regional_Indicator}/u;

// Returns the emoji of a message made of 1..max emoji and nothing else.
export function emojiOnly(text, max = 3) {
  const compact = (text || "").replace(/\s+/g, "");
  if (!compact || !segmenter) return null;
  const parts = Array.from(segmenter.segment(compact), (s) => s.segment);
  if (parts.length > max) return null;
  return parts.every((p) => PICTO.test(p)) ? parts : null;
}

// ---------- Rendering ----------

let observer = null;
function watchVisibility(el) {
  if (!("IntersectionObserver" in window)) {
    el._play?.();
    return;
  }
  if (!observer) {
    observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (!e.isIntersecting) return;
          observer.unobserve(e.target);
          e.target._play?.();
        });
      },
      { threshold: 0.4 }
    );
  }
  observer.observe(el);
}

// Creates an element showing `emoji` at `size` px.
//   play: "visible" – once, when it scrolls into view (messages)
//         "now"     – immediately
//         false     – stay on the first frame until .replay()
export function animatedEmoji(emoji, size, { play = "visible", loop = false } = {}) {
  const wrap = document.createElement("span");
  wrap.className = "anim-emoji";
  wrap.style.width = wrap.style.height = size + "px";
  const fallback = document.createElement("span");
  fallback.className = "anim-emoji-fallback";
  fallback.textContent = emoji;
  fallback.style.fontSize = Math.round(size * 0.8) + "px";
  wrap.appendChild(fallback);

  let anim = null;
  let wantPlay = false;
  wrap._play = () => {
    wantPlay = true;
    if (anim && !reducedMotion) anim.goToAndPlay(0, true);
  };
  wrap.replay = wrap._play;
  wrap.destroy = () => anim?.destroy();

  Promise.all([loadLottie(), fetchAnimation(emoji)])
    .then(([lottie, data]) => {
      if (!data || !lottie) return;
      // lottie-web mutates animation data, so every instance gets its own copy.
      anim = lottie.loadAnimation({
        container: wrap,
        renderer: "svg",
        loop,
        autoplay: false,
        animationData: JSON.parse(JSON.stringify(data)),
        rendererSettings: { preserveAspectRatio: "xMidYMid meet" },
      });
      anim.addEventListener("DOMLoaded", () => {
        fallback.remove();
        wrap.classList.add("ready");
        if (wantPlay && !reducedMotion) anim.goToAndPlay(0, true);
        else anim.goToAndStop(0, true);
      });
    })
    .catch(() => {});

  if (play === "now") wrap._play();
  else if (play === "visible") watchVisibility(wrap);
  return wrap;
}

// A big emoji that pops at a point, plays once and fades away, with a
// spray of smaller copies (used for reactions and taps on big emoji).
export function emojiEffect(emoji, x, y, size = 120) {
  if (reducedMotion) return;
  const el = animatedEmoji(emoji, size, { play: "now" });
  el.classList.add("anim-emoji-fx");
  el.style.left = x - size / 2 + "px";
  el.style.top = y - size / 2 + "px";
  document.body.appendChild(el);
  burst(x, y, { content: emoji, count: 10, spread: size * 1.2 });
  el.animate(
    [
      { transform: "scale(.2) translateY(20px)", opacity: 0 },
      { transform: "scale(1.15) translateY(-30px)", opacity: 1, offset: 0.25 },
      { transform: "scale(1) translateY(-40px)", opacity: 1, offset: 0.8 },
      { transform: "scale(.8) translateY(-70px)", opacity: 0 },
    ],
    { duration: 1800, easing: "cubic-bezier(.2,.8,.3,1)" }
  ).finished.then(
    () => {
      el.destroy();
      el.remove();
    },
    () => el.remove()
  );
}

// Tap on a big emoji in the chat: it plays again right where it is, squashes
// like jelly and sprays small copies of itself.
export function emojiPop(el, emoji) {
  el.replay?.();
  if (reducedMotion) return;
  el.animate(
    [
      { transform: "scale(1)" },
      { transform: "scale(1.22, .82)", offset: 0.18 },
      { transform: "scale(.9, 1.12) translateY(-6px)", offset: 0.42 },
      { transform: "scale(1.05, .96)", offset: 0.68 },
      { transform: "scale(1)" },
    ],
    { duration: 700, easing: "cubic-bezier(.3,.7,.4,1)" }
  );
  const r = el.getBoundingClientRect();
  burst(r.left + r.width / 2, r.top + r.height / 2, { content: emoji, count: 14, spread: Math.max(120, r.width * 1.4) });
}
