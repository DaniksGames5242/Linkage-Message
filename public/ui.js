// Motion + material toolkit shared by the app and login pages: physically
// based spring easings, overlays that grow out of the tap point, panel swaps,
// FLIP list reordering, Liquid Glass lenses (real edge refraction on
// Chromium), pointer-reactive highlights and small celebratory effects.

export const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
// Safari/WebKit (and every browser on iOS) understands linear() easings but
// can't hand them to the GPU compositor, so each frame of such an animation
// is computed on the main thread and stutters whenever it's busy. There the
// springs become cubic-bezier curves, which run on the compositor.
const ua = navigator.userAgent;
export const isWebKit = /iP(hone|ad|od)/.test(ua) || (/AppleWebKit/.test(ua) && !/Chrome\/|Chromium|Edg\//.test(ua));
const supportsLinearEasing =
  !isWebKit && typeof CSS !== "undefined" && CSS.supports?.("animation-timing-function", "linear(0, 1)");

// ---------- Springs ----------

// Solves a damped harmonic oscillator and samples it into a CSS linear()
// easing, so WAAPI and CSS transitions get genuine spring motion.
export function spring({ stiffness = 200, damping = 20, mass = 1, velocity = 0 } = {}) {
  const w0 = Math.sqrt(stiffness / mass);
  const zeta = damping / (2 * Math.sqrt(stiffness * mass));
  const wd = zeta < 1 ? w0 * Math.sqrt(1 - zeta * zeta) : 0;
  const f = (t) => {
    if (zeta < 1) {
      const b = (zeta * w0 - velocity) / wd;
      return 1 - Math.exp(-zeta * w0 * t) * (Math.cos(wd * t) + b * Math.sin(wd * t));
    }
    return 1 - (1 + (w0 - velocity) * t) * Math.exp(-w0 * t);
  };
  let duration = 2;
  let calm = 0;
  for (let t = 0; t < 4; t += 1 / 120) {
    if (Math.abs(f(t) - 1) < 0.002) {
      calm += 1 / 120;
      if (calm > 0.08) {
        duration = t;
        break;
      }
    } else calm = 0;
  }
  if (!supportsLinearEasing) {
    // Overshoot roughly as much as the spring would, settle a bit sooner
    // (a bezier has no long tail to wait out).
    const easing = zeta < 0.45 ? "cubic-bezier(.3,1.7,.5,1)" : zeta < 0.75 ? "cubic-bezier(.34,1.45,.64,1)" : "cubic-bezier(.22,1,.36,1)";
    return { easing, duration: Math.round(Math.min(duration, 1.1) * 800) };
  }
  const n = Math.min(90, Math.max(24, Math.round(duration * 45)));
  const pts = [];
  for (let i = 0; i <= n; i++) pts.push(+f((i / n) * duration).toFixed(4));
  pts[n] = 1;
  return { easing: `linear(${pts.join(", ")})`, duration: Math.round(duration * 1000) };
}

export const SPRINGS = {
  bouncy: spring({ stiffness: 260, damping: 17 }),
  jelly: spring({ stiffness: 320, damping: 13 }),
  smooth: spring({ stiffness: 190, damping: 26 }),
  snappy: spring({ stiffness: 480, damping: 34 }),
  soft: spring({ stiffness: 120, damping: 20 }),
};

// Exposes the springs to CSS as --ease-* / --dur-* custom properties.
(function exportSpringsToCSS() {
  const root = document.documentElement.style;
  Object.entries(SPRINGS).forEach(([name, s]) => {
    root.setProperty(`--ease-${name}`, s.easing);
    root.setProperty(`--dur-${name}`, s.duration + "ms");
  });
  if (reducedMotion) document.documentElement.classList.add("reduced-motion");
})();

export const fxLevel = () => window.LinkageFX?.level?.() || "balanced";

// Settings → Оформление → animation speed (1 = normal, 0 = off).
let motionScale = 1;
export function setMotionScale(k) {
  motionScale = Math.max(0, Number(k) || 0);
}

export function animate(el, keyframes, opts = {}) {
  if (!el || !el.animate) return null;
  // Economy mode: animating blur is the expensive part, drop it.
  if (fxLevel() === "lite" && Array.isArray(keyframes)) {
    keyframes = keyframes.map((k) => {
      if (!("filter" in k)) return k;
      const { filter, ...rest } = k;
      return rest;
    });
  }
  // z-index can't be animated on the compositor, and one such property drags
  // the whole animation (transform included) onto the main thread: hold it
  // as a plain style for the duration instead.
  let zIndex = null;
  if (Array.isArray(keyframes) && keyframes.some((k) => k && "zIndex" in k)) {
    zIndex = keyframes.find((k) => "zIndex" in k).zIndex;
    keyframes = keyframes.map(({ zIndex: _z, ...k }) => k);
  }
  const { spring: springName, ...rest } = opts;
  const s = springName ? SPRINGS[springName] : null;
  // "backwards" holds the first frame during any delay; the last frame is
  // always the element's natural style, so nothing needs committing.
  const options = {
    duration: s ? s.duration : 300,
    easing: s ? s.easing : "cubic-bezier(.22,1,.36,1)",
    fill: "backwards",
    ...rest,
  };
  if (reducedMotion) options.duration = Math.min(options.duration, 120);
  if (motionScale !== 1) {
    options.duration = motionScale ? options.duration * motionScale : 1;
    options.delay = motionScale ? (options.delay || 0) * motionScale : 0;
  }
  const anim = el.animate(keyframes, options);
  if (zIndex !== null) {
    const prev = el.style.zIndex;
    el.style.zIndex = zIndex;
    const restore = () => (el.style.zIndex = prev);
    anim.finished.then(restore, restore);
  }
  return anim;
}

// Cascades a list of elements in with a small rise + blur, one after another.
export function stagger(elements, { y = 14, x = 0, blur = 6, step = 32, delay = 0, spring: springName = "bouncy", scale = 1 } = {}) {
  // Only what's on screen is worth animating; off-screen rows just appear.
  const vh = window.innerHeight;
  const list = Array.from(elements)
    .filter((el) => {
      if (!el) return false;
      const r = el.getBoundingClientRect();
      return (r.width || r.height) && r.bottom > -40 && r.top < vh + 40;
    })
    .slice(0, fxLevel() === "lite" ? 14 : 30);
  list.forEach((el, i) => {
    animate(
      el,
      [
        { opacity: 0, transform: `translate(${x}px, ${y}px) scale(${scale})`, filter: `blur(${blur}px)` },
        { opacity: 1, transform: "none", filter: "blur(0px)" },
      ],
      { spring: springName, delay: delay + i * step }
    );
  });
}

// ---------- Pointer tracking ----------

export const lastPointer = { x: window.innerWidth / 2, y: window.innerHeight / 2, t: 0 };
window.addEventListener(
  "pointerdown",
  (e) => {
    lastPointer.x = e.clientX;
    lastPointer.y = e.clientY;
    lastPointer.t = performance.now();
  },
  true
);

function pointerOrigin(fallbackEl) {
  if (performance.now() - lastPointer.t < 1200) return { x: lastPointer.x, y: lastPointer.y };
  if (fallbackEl) {
    const r = fallbackEl.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  }
  return { x: window.innerWidth / 2, y: window.innerHeight * 0.6 };
}

// Specular highlight that follows the cursor across glass surfaces.
const canHover = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
if (canHover) {
  // One style write per frame at most.
  let spotEl = null;
  let pending = null;
  let raf = 0;
  const flush = () => {
    raf = 0;
    const e = pending;
    if (!e || fxLevel() === "lite") return;
    const el = e.target.closest?.(".spot, .glass, button.primary, .room-item, .settings-menu-item");
    if (spotEl && spotEl !== el) spotEl.style.removeProperty("--spot-o");
    spotEl = el;
    if (!el) return;
    const r = el.getBoundingClientRect();
    el.style.setProperty("--mx", `${e.clientX - r.left}px`);
    el.style.setProperty("--my", `${e.clientY - r.top}px`);
    el.style.setProperty("--spot-o", "1");
  };
  document.addEventListener(
    "pointermove",
    (e) => {
      pending = e;
      if (!raf) raf = requestAnimationFrame(flush);
    },
    { passive: true }
  );
}

// Pauses the living backdrop while something opaque covers it.
export function pauseBackdrop(on) {
  document.dispatchEvent(new Event(on ? "lm-bg-pause" : "lm-bg-resume"));
}

// Measures real frame times once the app is idle; if they are poor in
// "auto" mode, switch to economy effects for this session.
export function probeFps(onDegrade) {
  if (fxLevel() === "lite") return;
  const times = [];
  let last = performance.now();
  const end = last + 2000;
  const tick = (now) => {
    times.push(now - last);
    last = now;
    if (now < end) return requestAnimationFrame(tick);
    times.sort((a, b) => a - b);
    const median = times[times.length >> 1] || 16;
    if (median > 26 && window.LinkageFX?.degrade?.()) onDegrade?.();
  };
  requestAnimationFrame(tick);
}

// Buttons that lean toward the cursor and spring back when it leaves.
export function magnetize(el, strength = 0.28) {
  if (!el || !canHover || reducedMotion) return;
  el.addEventListener("pointermove", (e) => {
    const r = el.getBoundingClientRect();
    const dx = (e.clientX - (r.left + r.width / 2)) * strength;
    const dy = (e.clientY - (r.top + r.height / 2)) * strength;
    el.style.translate = `${dx.toFixed(1)}px ${dy.toFixed(1)}px`;
  });
  el.addEventListener("pointerleave", () => {
    el.style.translate = "";
  });
}

// Subtle 3D tilt that follows the pointer (used for the auth card / hero orb).
export function tilt(el, max = 6) {
  if (!el || !canHover || reducedMotion) return;
  const host = el.parentElement || el;
  host.addEventListener("pointermove", (e) => {
    const r = el.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width - 0.5;
    const py = (e.clientY - r.top) / r.height - 0.5;
    el.style.setProperty("--tilt-x", `${(-py * max).toFixed(2)}deg`);
    el.style.setProperty("--tilt-y", `${(px * max).toFixed(2)}deg`);
    el.style.setProperty("--glare-x", `${((px + 0.5) * 100).toFixed(1)}%`);
    el.style.setProperty("--glare-y", `${((py + 0.5) * 100).toFixed(1)}%`);
  });
  host.addEventListener("pointerleave", () => {
    el.style.setProperty("--tilt-x", "0deg");
    el.style.setProperty("--tilt-y", "0deg");
  });
}

// ---------- Overlays ----------

const openOverlays = [];

// Opens a modal so its panel inflates out of the point the user tapped,
// like a drop of liquid glass, then settles on a spring.
export function showOverlay(overlay, { origin } = {}) {
  if (!overlay) return;
  (overlay._closeAnims || []).forEach((a) => a.cancel());
  overlay._closeAnims = null;
  const wasHidden = overlay.classList.contains("hidden") || overlay.classList.contains("is-closing");
  overlay.classList.remove("hidden", "is-closing");
  if (!overlay._bgPaused) {
    overlay._bgPaused = true;
    pauseBackdrop(true);
  }
  if (!openOverlays.includes(overlay)) openOverlays.push(overlay);
  if (!wasHidden) return;

  const panel = overlay.firstElementChild;
  // Full-screen pages (settings) slide in like a tab switch instead of popping.
  if (overlay.classList.contains("as-page")) {
    if (panel)
      animate(panel, [{ opacity: 0, transform: "translateY(14px) scale(.985)" }, { opacity: 1, transform: "none" }], { spring: "smooth" });
    return;
  }
  animate(overlay, [{ opacity: 0 }, { opacity: 1 }], { duration: 320, easing: "ease-out" });
  if (!panel) return;
  const r = panel.getBoundingClientRect();
  const o = origin || pointerOrigin();
  const dx = o.x - (r.left + r.width / 2);
  const dy = o.y - (r.top + r.height / 2);
  animate(panel, [{ transform: `translate(${dx}px, ${dy}px) scale(0.12)` }, { transform: "none" }], { spring: "bouncy" });
  animate(
    panel,
    [
      { opacity: 0, filter: "blur(18px) saturate(2)", borderRadius: "60px" },
      { opacity: 1, filter: "blur(0px) saturate(1)", borderRadius: getComputedStyle(panel).borderRadius },
    ],
    { duration: 420, easing: "cubic-bezier(.2,.9,.3,1)" }
  );
}

export function hideOverlay(overlay) {
  if (!overlay || overlay.classList.contains("hidden") || overlay.classList.contains("is-closing")) return;
  overlay.classList.add("is-closing");
  if (overlay._bgPaused) {
    overlay._bgPaused = false;
    pauseBackdrop(false);
  }
  const idx = openOverlays.indexOf(overlay);
  if (idx >= 0) openOverlays.splice(idx, 1);
  const panel = overlay.firstElementChild;
  const duration = reducedMotion ? 80 : 260;
  if (overlay.classList.contains("as-page")) {
    const a = (panel || overlay).animate([{ opacity: 1, transform: "none" }, { opacity: 0, transform: "translateY(10px) scale(.985)" }], {
      duration: reducedMotion ? 60 : 180,
      easing: "ease-in",
      fill: "forwards",
    });
    overlay._closeAnims = [a];
    a.finished.then(
      () => {
        if (!overlay.classList.contains("is-closing")) return;
        overlay.classList.add("hidden");
        overlay.classList.remove("is-closing");
        a.cancel();
        overlay._closeAnims = null;
      },
      () => {}
    );
    return;
  }
  const anims = [
    overlay.animate([{ opacity: 1 }, { opacity: 0 }], { duration, easing: "ease-in", fill: "forwards" }),
  ];
  if (panel) {
    anims.push(
      panel.animate(
        [
          { transform: "none", opacity: 1, filter: "blur(0px)" },
          { transform: "translateY(24px) scale(0.86)", opacity: 0, filter: "blur(12px)" },
        ],
        { duration, easing: "cubic-bezier(.5,0,.75,0)", fill: "forwards" }
      )
    );
  }
  overlay._closeAnims = anims;
  anims[0].finished.then(
    () => {
      if (!overlay.classList.contains("is-closing")) return;
      overlay.classList.add("hidden");
      overlay.classList.remove("is-closing");
      anims.forEach((a) => a.cancel());
      overlay._closeAnims = null;
    },
    () => {}
  );
}

export function topOverlay() {
  return openOverlays.filter((o) => !o.classList.contains("hidden")).pop() || null;
}

// ---------- Dropdowns / popovers ----------

export function showPopover(el, { originX = "right" } = {}) {
  if (!el) return;
  (el._closeAnims || []).forEach((a) => a.cancel());
  el.classList.remove("hidden", "is-closing");
  animate(
    el,
    [
      { opacity: 0, transform: "scale(.4, .2)", filter: "blur(10px)", transformOrigin: `top ${originX}` },
      { opacity: 1, transform: "none", filter: "blur(0px)", transformOrigin: `top ${originX}` },
    ],
    { spring: "bouncy" }
  );
  stagger(el.children, { y: -6, x: originX === "right" ? 10 : -10, blur: 4, step: 40, delay: 60, spring: "smooth" });
}

export function hidePopover(el) {
  if (!el || el.classList.contains("hidden") || el.classList.contains("is-closing")) return;
  el.classList.add("is-closing");
  const a = el.animate(
    [
      { opacity: 1, transform: "none", filter: "blur(0px)" },
      { opacity: 0, transform: "scale(.7, .4)", filter: "blur(8px)" },
    ],
    { duration: reducedMotion ? 60 : 180, easing: "cubic-bezier(.5,0,.75,0)", fill: "forwards" }
  );
  el._closeAnims = [a];
  a.finished.then(
    () => {
      if (!el.classList.contains("is-closing")) return;
      el.classList.add("hidden");
      el.classList.remove("is-closing");
      a.cancel();
    },
    () => {}
  );
}

// Reveals / collapses an inline block (reply preview, emoji tray, inline
// confirmations) by animating its height together with a soft blur.
const inFlow = (el) => !["absolute", "fixed"].includes(getComputedStyle(el).position);

export function reveal(el) {
  if (!el) return;
  (el._closeAnims || []).forEach((a) => a.cancel());
  el._closeAnims = null;
  if (!el.classList.contains("hidden") && !el.classList.contains("is-closing")) return;
  el.classList.remove("hidden", "is-closing");
  // Overlaid elements don't push anything around: skip the (layout-heavy)
  // height morph and keep it to transform/opacity, which run on the GPU.
  if (!inFlow(el)) {
    animate(el, [{ opacity: 0, transform: "translateY(-10px) scale(.97)" }, { opacity: 1, transform: "none" }], { spring: "smooth" });
    return;
  }
  const h = el.getBoundingClientRect().height;
  animate(
    el,
    [
      { height: "0px", opacity: 0, filter: "blur(8px)", transform: "translateY(12px) scale(.98)", overflow: "hidden" },
      { height: h + "px", opacity: 1, filter: "blur(0px)", transform: "none", overflow: "hidden" },
    ],
    { spring: "smooth" }
  );
}

export function conceal(el) {
  if (!el || el.classList.contains("hidden") || el.classList.contains("is-closing")) return;
  el.classList.add("is-closing");
  const h = el.getBoundingClientRect().height;
  const a = !inFlow(el)
    ? el.animate([{ opacity: 1, transform: "none" }, { opacity: 0, transform: "translateY(-8px) scale(.97)" }], {
        duration: reducedMotion ? 60 : 200,
        easing: "cubic-bezier(.4,0,.2,1)",
        fill: "forwards",
      })
    : el.animate(
    [
      { height: h + "px", opacity: 1, filter: "blur(0px)", overflow: "hidden" },
      { height: "0px", opacity: 0, filter: "blur(8px)", overflow: "hidden", paddingTop: "0px", paddingBottom: "0px" },
    ],
    { duration: reducedMotion ? 60 : 220, easing: "cubic-bezier(.4,0,.2,1)", fill: "forwards" }
  );
  el._closeAnims = [a];
  a.finished.then(
    () => {
      if (!el.classList.contains("is-closing")) return;
      el.classList.add("hidden");
      el.classList.remove("is-closing");
      a.cancel();
    },
    () => {}
  );
}

// ---------- Panel swaps (settings sections, new-chat steps) ----------

// Runs `mutate` (which hides the old view and shows the new one) while the
// container's height morphs on a spring, the old content slides away as a
// ghost and the new content's children cascade in from the other side.
export function swapPanels({ container, clip, outgoing, incoming, direction = 1, mutate }) {
  if (reducedMotion || !container) {
    mutate();
    return;
  }
  const before = container.getBoundingClientRect().height;
  let ghost = null;
  if (outgoing && outgoing.offsetParent !== null) {
    const r = outgoing.getBoundingClientRect();
    const c = (clip || container).getBoundingClientRect();
    ghost = outgoing.cloneNode(true);
    ghost.querySelectorAll("[id]").forEach((n) => n.removeAttribute("id"));
    ghost.removeAttribute("id");
    ghost.classList.add("swap-ghost");
    Object.assign(ghost.style, {
      position: "fixed",
      left: r.left + "px",
      top: r.top + "px",
      width: r.width + "px",
      margin: "0",
      pointerEvents: "none",
      zIndex: "70",
      clipPath: `inset(${c.top - r.top}px ${r.right - c.right}px ${r.bottom - c.bottom}px ${c.left - r.left}px)`,
    });
    document.body.appendChild(ghost);
  }
  mutate();
  const after = container.getBoundingClientRect().height;
  if (Math.abs(after - before) > 1) {
    animate(container, [{ height: before + "px" }, { height: after + "px" }], { spring: "smooth" });
  }
  if (ghost) {
    ghost
      .animate(
        [
          { transform: "none", opacity: 1 },
          { transform: `translateX(${-60 * direction}px) scale(.96)`, opacity: 0 },
        ],
        { duration: 260, easing: "cubic-bezier(.4,0,.2,1)", fill: "forwards" }
      )
      .finished.then(() => ghost.remove(), () => ghost.remove());
  }
  if (incoming) {
    animate(
      incoming,
      [
        { transform: `translateX(${70 * direction}px)`, opacity: 0 },
        { transform: "none", opacity: 1 },
      ],
      { spring: "smooth" }
    );
    stagger(incoming.children, { x: 24 * direction, y: 0, blur: 5, step: 26, delay: 40, spring: "smooth" });
  }
}

// Replaces text with a slide + blur crossfade.
export function morphText(el, text, direction = 1) {
  if (!el || el.textContent === text) return;
  el.textContent = text;
  animate(
    el,
    [
      { opacity: 0, transform: `translateX(${18 * direction}px)`, filter: "blur(6px)" },
      { opacity: 1, transform: "none", filter: "blur(0px)" },
    ],
    { spring: "smooth" }
  );
}

// "Decodes" text through random glyphs into its new value.
const SCRAMBLE_GLYPHS = "▪▫◆◇○●◐◑▲△▴▵⬡⬢∗∘≈";
export function scrambleText(el, text, { html = false } = {}) {
  if (!el) return;
  if (reducedMotion || html) {
    if (html) el.innerHTML = text;
    else el.textContent = text;
    return;
  }
  const from = el.textContent;
  if (from === text) return;
  const len = Math.max(from.length, text.length);
  const frames = 18;
  let frame = 0;
  clearInterval(el._scramble);
  el._scramble = setInterval(() => {
    frame++;
    let out = "";
    for (let i = 0; i < len; i++) {
      const settleAt = (i / len) * frames * 0.7 + frames * 0.3;
      if (frame >= settleAt) out += text[i] || "";
      else if (text[i] === " ") out += " ";
      else out += SCRAMBLE_GLYPHS[(Math.random() * SCRAMBLE_GLYPHS.length) | 0];
    }
    el.textContent = out;
    if (frame >= frames) {
      clearInterval(el._scramble);
      el.textContent = text;
    }
  }, 28);
}

// ---------- FLIP ----------

export function captureRects(container, selector = "[data-key]") {
  const map = new Map();
  container.querySelectorAll(selector).forEach((el) => {
    map.set(el.dataset.key, el.getBoundingClientRect());
  });
  return map;
}

export function playFlip(container, rects, { selector = "[data-key]", enter = true } = {}) {
  if (reducedMotion) return;
  let enterIndex = 0;
  container.querySelectorAll(selector).forEach((el) => {
    const prev = rects.get(el.dataset.key);
    const now = el.getBoundingClientRect();
    if (prev) {
      const dy = prev.top - now.top;
      if (Math.abs(dy) > 1) {
        // Items jumping up (a new message arrived) get a brief lift so the
        // reorder reads as depth rather than a teleport.
        const lift = dy > 0 ? " scale(1.03)" : "";
        animate(el, [{ transform: `translateY(${dy}px)${lift}`, zIndex: 3 }, { transform: "none", zIndex: 3 }], { spring: "bouncy" });
      }
    } else if (enter && rects.size > 0) {
      animate(
        el,
        [
          { opacity: 0, transform: "translateX(-24px) scale(.94)", filter: "blur(6px)" },
          { opacity: 1, transform: "none", filter: "blur(0px)" },
        ],
        { spring: "bouncy", delay: enterIndex++ * 40 }
      );
    }
  });
}

// ---------- Liquid Glass lens (edge refraction) ----------

// Chromium can feed an SVG filter into backdrop-filter, which lets us bend
// the backdrop near a surface's rim like a thick glass lens (with a touch of
// chromatic dispersion). Other engines keep the plain frosted material.
const isChromium = !!navigator.userAgentData?.brands?.some((b) => /Chromium|Google Chrome|Microsoft Edge/.test(b.brand));
export const lensSupported = isChromium && !reducedMotion && typeof ResizeObserver !== "undefined";
const lenses = []; // { el, apply } registered by liquidLens()
function syncLenses() {
  const on = lensSupported && fxLevel() === "max";
  document.documentElement.classList.toggle("has-lens", on);
  lenses.forEach((l) => (on ? l.apply() : l.clear()));
}
new MutationObserver(() => {
  const on = lensSupported && fxLevel() === "max";
  if (on !== document.documentElement.classList.contains("has-lens")) syncLenses();
}).observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });

let lensDefs = null;
let lensCounter = 0;

function ensureLensDefs() {
  if (lensDefs) return lensDefs;
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("width", "0");
  svg.setAttribute("height", "0");
  svg.style.position = "absolute";
  svg.style.pointerEvents = "none";
  lensDefs = document.createElementNS("http://www.w3.org/2000/svg", "defs");
  svg.appendChild(lensDefs);
  document.body.appendChild(svg);
  return lensDefs;
}

function lensMap(w, h, radius, bezel) {
  const scale = 0.5;
  const cw = Math.max(2, Math.round(w * scale));
  const ch = Math.max(2, Math.round(h * scale));
  const canvas = document.createElement("canvas");
  canvas.width = cw;
  canvas.height = ch;
  const ctx = canvas.getContext("2d");
  const img = ctx.createImageData(cw, ch);
  const hw = w / 2;
  const hh = h / 2;
  const r = Math.min(radius, hw, hh);
  for (let j = 0; j < ch; j++) {
    for (let i = 0; i < cw; i++) {
      const px = (i + 0.5) / scale - hw;
      const py = (j + 0.5) / scale - hh;
      const qx = Math.abs(px) - (hw - r);
      const qy = Math.abs(py) - (hh - r);
      const ox = Math.max(qx, 0);
      const oy = Math.max(qy, 0);
      const outside = Math.hypot(ox, oy);
      const d = outside + Math.min(Math.max(qx, qy), 0) - r; // signed distance, <0 inside
      let nx = 0;
      let ny = 0;
      if (qx > 0 && qy > 0) {
        nx = ox / (outside || 1);
        ny = oy / (outside || 1);
      } else if (qx > qy) nx = 1;
      else ny = 1;
      nx *= Math.sign(px) || 1;
      ny *= Math.sign(py) || 1;
      const depth = -d;
      let m = 0;
      if (depth < bezel) {
        const t = 1 - Math.max(depth, 0) / bezel;
        m = t * t * (1.6 - 0.6 * t); // convex lens profile: strongest at the rim
      }
      const k = (j * cw + i) * 4;
      img.data[k] = 128 - nx * m * 127;
      img.data[k + 1] = 128 - ny * m * 127;
      img.data[k + 2] = 128;
      img.data[k + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return canvas.toDataURL();
}

export function liquidLens(el, { radius, bezel = 16, strength = 38, blur = 3, saturate = 1.8 } = {}) {
  if (!lensSupported || !el) return;
  const defs = ensureLensDefs();
  const id = `lg-lens-${++lensCounter}`;
  const NS = "http://www.w3.org/2000/svg";
  const filter = document.createElementNS(NS, "filter");
  filter.setAttribute("id", id);
  filter.setAttribute("color-interpolation-filters", "sRGB");
  filter.setAttribute("filterUnits", "userSpaceOnUse");
  filter.setAttribute("primitiveUnits", "userSpaceOnUse");
  defs.appendChild(filter);

  let lastKey = "";
  const active = () => fxLevel() === "max";
  const build = () => {
    if (!active()) return;
    const w = Math.round(el.offsetWidth / 4) * 4;
    const h = Math.round(el.offsetHeight / 4) * 4;
    if (w < 8 || h < 8) return;
    const rad = radius ?? (parseFloat(getComputedStyle(el).borderTopLeftRadius) || 16);
    const key = `${w}x${h}x${rad}`;
    if (key === lastKey) return;
    lastKey = key;
    const href = lensMap(w, h, rad, bezel);
    ["x", "y"].forEach((a) => filter.setAttribute(a, "0"));
    filter.setAttribute("width", w);
    filter.setAttribute("height", h);
    const ch = (s, name, matrix) => `
      <feDisplacementMap in="blurred" in2="map" scale="${s}" xChannelSelector="R" yChannelSelector="G" result="d${name}" />
      <feColorMatrix in="d${name}" type="matrix" values="${matrix}" result="${name}" />`;
    filter.innerHTML = `
      <feGaussianBlur in="SourceGraphic" stdDeviation="${blur}" result="blurred" />
      <feImage href="${href}" x="0" y="0" width="${w}" height="${h}" preserveAspectRatio="none" result="map" />
      ${ch(strength, "r", "1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0")}
      ${ch(strength * 0.92, "g", "0 0 0 0 0  0 1 0 0 0  0 0 0 0 0  0 0 0 1 0")}
      ${ch(strength * 0.84, "b", "0 0 0 0 0  0 0 0 0 0  0 0 1 0 0  0 0 0 1 0")}
      <feBlend in="r" in2="g" mode="screen" result="rg" />
      <feBlend in="rg" in2="b" mode="screen" result="rgb" />
      <feColorMatrix in="rgb" type="saturate" values="${saturate}" />`;
    el.style.backdropFilter = el.style.webkitBackdropFilter = `url(#${id})`;
  };
  new ResizeObserver(() => requestAnimationFrame(build)).observe(el);
  lenses.push({
    el,
    apply: () => {
      lastKey = "";
      build();
    },
    clear: () => {
      el.style.backdropFilter = el.style.webkitBackdropFilter = "";
    },
  });
  syncLenses();
}

// ---------- Segmented controls (replace <select> visually) ----------

// Builds a sliding "liquid pill" segmented control in front of a native
// <select>. The select stays the source of truth (value + change events).
export function segmentize(select) {
  if (!select || select._seg) return;
  const seg = document.createElement("div");
  seg.className = "segmented";
  seg.setAttribute("role", "radiogroup");
  const pill = document.createElement("div");
  pill.className = "segmented-pill";
  seg.appendChild(pill);
  const buttons = Array.from(select.options).map((opt) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "segmented-opt";
    b.dataset.value = opt.value;
    b.textContent = opt.textContent;
    b.setAttribute("role", "radio");
    b.addEventListener("click", () => {
      if (select.value === opt.value) return;
      select.value = opt.value;
      select.dispatchEvent(new Event("change", { bubbles: true }));
      sync(true);
    });
    seg.appendChild(b);
    return b;
  });
  select.classList.add("segmented-native");
  select.insertAdjacentElement("afterend", seg);
  select.closest(".setting-row")?.classList.add("has-seg");

  let prevLeft = null;
  function sync(animated) {
    const active = buttons.find((b) => b.dataset.value === select.value) || buttons[0];
    buttons.forEach((b) => {
      b.classList.toggle("active", b === active);
      b.setAttribute("aria-checked", b === active ? "true" : "false");
    });
    if (!active || !seg.offsetParent) return;
    const left = active.offsetLeft;
    const width = active.offsetWidth;
    pill.style.width = width + "px";
    pill.style.transform = `translateX(${left}px)`;
    if (animated && prevLeft !== null && prevLeft !== left && !reducedMotion) {
      // Liquid squash-and-stretch while the pill travels.
      const dist = Math.abs(left - prevLeft);
      pill.animate(
        [
          { transform: `translateX(${prevLeft}px)`, scale: "1 1" },
          { scale: `${1 + Math.min(dist / 180, 0.45)} 0.82`, offset: 0.35 },
          { transform: `translateX(${left}px)`, scale: "1 1" },
        ],
        { ...SPRINGS.jelly }
      );
    }
    prevLeft = left;
  }
  select._seg = { sync };
  select.addEventListener("change", () => sync(true));
  new ResizeObserver(() => sync(false)).observe(seg);
  sync(false);
}

export function syncSegmented(root = document) {
  root.querySelectorAll("select").forEach((s) => s._seg?.sync(false));
}

// ---------- Micro-interactions ----------

// Emoji / spark particles that burst from a point and drift away.
export function burst(x, y, { content = null, count = 10, spread = 70, colors = null } = {}) {
  if (reducedMotion) return;
  for (let i = 0; i < count; i++) {
    const p = document.createElement("span");
    p.className = "fx-particle";
    if (content) p.textContent = content;
    else {
      p.classList.add("fx-spark");
      if (colors) p.style.background = colors[i % colors.length];
    }
    p.style.left = x + "px";
    p.style.top = y + "px";
    document.body.appendChild(p);
    const angle = (Math.PI * 2 * i) / count + Math.random() * 0.6;
    const dist = spread * (0.55 + Math.random() * 0.6);
    const dx = Math.cos(angle) * dist;
    const dy = Math.sin(angle) * dist - (content ? 40 : 10);
    const rot = (Math.random() - 0.5) * 120;
    p.animate(
      [
        { transform: "translate(-50%, -50%) scale(.2)", opacity: 1 },
        { transform: `translate(calc(-50% + ${dx * 0.7}px), calc(-50% + ${dy * 0.7}px)) scale(1.1) rotate(${rot / 2}deg)`, opacity: 1, offset: 0.5 },
        { transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy - 20}px)) scale(.6) rotate(${rot}deg)`, opacity: 0 },
      ],
      { duration: 700 + Math.random() * 300, easing: "cubic-bezier(.2,.8,.3,1)" }
    ).finished.then(() => p.remove(), () => p.remove());
  }
}

// Liquid ripple: a lens-like ring that swells from the press point.
export function ripple(el, e) {
  if (!el || reducedMotion) return;
  const r = el.getBoundingClientRect();
  const x = (e?.clientX ?? r.left + r.width / 2) - r.left;
  const y = (e?.clientY ?? r.top + r.height / 2) - r.top;
  const size = Math.hypot(Math.max(x, r.width - x), Math.max(y, r.height - y)) * 2;
  const dot = document.createElement("span");
  dot.className = "fx-ripple";
  dot.style.left = x + "px";
  dot.style.top = y + "px";
  dot.style.width = dot.style.height = size + "px";
  el.appendChild(dot);
  dot
    .animate(
      [
        { transform: "translate(-50%, -50%) scale(0)", opacity: 0.55 },
        { transform: "translate(-50%, -50%) scale(1)", opacity: 0 },
      ],
      { duration: 650, easing: "cubic-bezier(.2,.7,.2,1)" }
    )
    .finished.then(() => dot.remove(), () => dot.remove());
}

// Press ripple on tactile surfaces, app-wide.
document.addEventListener(
  "pointerdown",
  (e) => {
    const el = e.target.closest?.("button.primary, .small-btn, .settings-menu-item, .dropdown-item, .danger-btn");
    if (el && !el.disabled) ripple(el, e);
  },
  { passive: true }
);

// Morphs a button into a checkmark for a beat, then resolves.
export function successPulse(btn) {
  return new Promise((resolve) => {
    if (!btn || reducedMotion) return resolve();
    btn.classList.add("is-success");
    burst(...centerOf(btn), { count: 12, spread: 60, colors: ["#7ff0b4", "#2fcf7f", "#fff3c4", ...accentColors()] });
    setTimeout(() => {
      resolve();
      setTimeout(() => btn.classList.remove("is-success"), 400);
    }, 520);
  });
}

export function shake(el) {
  if (!el || reducedMotion) return;
  el.animate(
    [
      { transform: "translateX(0)" },
      { transform: "translateX(-7px)" },
      { transform: "translateX(6px)" },
      { transform: "translateX(-4px)" },
      { transform: "translateX(2px)" },
      { transform: "translateX(0)" },
    ],
    { duration: 420, easing: "ease-out" }
  );
}

// Makes an error/status line animate whenever its text changes.
export function watchMessages(els) {
  els.forEach((el) => {
    if (!el) return;
    new MutationObserver(() => {
      if (!el.textContent.trim()) return;
      animate(
        el,
        [
          { opacity: 0, transform: "translateY(-6px)", filter: "blur(4px)" },
          { opacity: 1, transform: "none", filter: "blur(0px)" },
        ],
        { spring: "bouncy" }
      );
      if (!el.classList.contains("ok-text")) shake(el);
    }).observe(el, { childList: true, characterData: true, subtree: true });
  });
}

// Current accent colours as rgba() strings (WAAPI keyframes can't use var()).
export function accentColors(alpha = 1) {
  const cs = getComputedStyle(document.documentElement);
  const inline = document.documentElement.style;
  return ["--accent", "--accent-2"].map((name) => {
    const v = (inline.getPropertyValue(name) || cs.getPropertyValue(name)).trim();
    let rgb = null;
    if (/^#[0-9a-f]{6}$/i.test(v)) rgb = [1, 3, 5].map((i) => parseInt(v.slice(i, i + 2), 16));
    else {
      const m = v.match(/rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)/i);
      if (m) rgb = [m[1], m[2], m[3]].map(Number);
    }
    if (!rgb) rgb = [255, 164, 27];
    return `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${alpha})`;
  });
}

export function centerOf(el) {
  const r = el.getBoundingClientRect();
  return [r.left + r.width / 2, r.top + r.height / 2];
}

// Global accent change that washes over the screen from a point, using the
// View Transitions API where available.
export function accentWave(apply, origin) {
  const o = origin || pointerOrigin();
  if (!document.startViewTransition || reducedMotion) {
    apply();
    return;
  }
  const radius = Math.hypot(Math.max(o.x, innerWidth - o.x), Math.max(o.y, innerHeight - o.y));
  const vt = document.startViewTransition(apply);
  document.documentElement.classList.add("vt-wave");
  vt.finished.finally(() => document.documentElement.classList.remove("vt-wave"));
  vt.ready
    .then(() => {
      document.documentElement.animate(
        { clipPath: [`circle(0px at ${o.x}px ${o.y}px)`, `circle(${radius}px at ${o.x}px ${o.y}px)`] },
        { duration: 900, easing: "cubic-bezier(.65,0,.2,1)", pseudoElement: "::view-transition-new(root)" }
      );
    })
    .catch(() => {});
}

// ---------- Brand mark ----------

let markCounter = 0;
export function brandMarkSVG(cls = "") {
  const id = `bm-${++markCounter}`;
  return `
  <svg class="brand-mark ${cls}" viewBox="0 0 64 64" aria-hidden="true">
    <defs>
      <linearGradient id="${id}" gradientUnits="userSpaceOnUse" x1="8" y1="14" x2="56" y2="50">
        <stop offset="0" stop-color="#FFE27A" />
        <stop offset=".45" stop-color="#FFB224" />
        <stop offset="1" stop-color="#FF5E1A" />
      </linearGradient>
    </defs>
    <circle class="bm-ring bm-a" cx="24" cy="32" r="14" stroke="url(#${id})" />
    <circle class="bm-ring bm-b" cx="40" cy="32" r="14" stroke="url(#${id})" />
    <path class="bm-gap" d="M27.62 18.48 A14 14 0 0 1 35.47 23.97" />
    <path class="bm-ring bm-link" d="M27.62 18.48 A14 14 0 0 1 35.47 23.97" stroke="url(#${id})" />
  </svg>`;
}

// ---------- Toasts ----------

let toastHost = null;
export function toast(text, { icon = "", duration = 2600, tone = "" } = {}) {
  if (!toastHost) {
    toastHost = document.createElement("div");
    toastHost.className = "toast-host";
    document.body.appendChild(toastHost);
  }
  const el = document.createElement("div");
  el.className = "toast glass" + (tone ? ` toast-${tone}` : "");
  el.innerHTML = `${icon ? `<span class="toast-icon">${icon}</span>` : ""}<span class="toast-text"></span>`;
  el.querySelector(".toast-text").textContent = text;
  toastHost.appendChild(el);
  animate(
    el,
    [
      { opacity: 0, transform: "translateY(-20px) scale(.8)", filter: "blur(8px)" },
      { opacity: 1, transform: "none", filter: "blur(0px)" },
    ],
    { spring: "bouncy" }
  );
  setTimeout(() => {
    el.animate(
      [
        { opacity: 1, transform: "none", filter: "blur(0px)" },
        { opacity: 0, transform: "translateY(-12px) scale(.9)", filter: "blur(6px)" },
      ],
      { duration: 240, easing: "cubic-bezier(.5,0,.75,0)", fill: "forwards" }
    ).finished.then(() => el.remove(), () => el.remove());
  }, duration);
}

// A toast with a live progress bar (and optional cancel) for uploads.
export function progressToast(label, { onCancel } = {}) {
  if (!toastHost) {
    toastHost = document.createElement("div");
    toastHost.className = "toast-host";
    document.body.appendChild(toastHost);
  }
  const el = document.createElement("div");
  el.className = "toast glass toast-progress";
  el.innerHTML = `
    <span class="toast-spinner"></span>
    <span class="toast-body"><span class="toast-text"></span><span class="toast-bar"><i></i></span></span>
    ${onCancel ? '<button type="button" class="toast-cancel" title="Отменить">✕</button>' : ""}`;
  el.querySelector(".toast-text").textContent = label;
  if (onCancel) el.querySelector(".toast-cancel").addEventListener("click", onCancel);
  toastHost.appendChild(el);
  animate(el, [{ opacity: 0, transform: "translateY(-20px) scale(.8)" }, { opacity: 1, transform: "none" }], { spring: "bouncy" });
  const bar = el.querySelector(".toast-bar i");
  const remove = () =>
    el
      .animate([{ opacity: 1 }, { opacity: 0, transform: "translateY(-10px) scale(.92)" }], { duration: 220, fill: "forwards" })
      .finished.then(() => el.remove(), () => el.remove());
  return {
    update(p) {
      bar.style.transform = `scaleX(${Math.max(0.02, Math.min(1, p))})`;
    },
    done() {
      bar.style.transform = "scaleX(1)";
      setTimeout(remove, 250);
    },
    fail() {
      remove();
    },
  };
}

