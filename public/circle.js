// Round video messages ("кружочки"), Telegram-style.
//
// The camera is drawn into a square canvas (centre crop, mirrored for the
// front camera — what you see is what you send) and the canvas stream plus
// the microphone are recorded with MediaRecorder. Recording through a canvas
// also lets you flip the camera mid-recording without restarting.

import { animate, toast, reducedMotion, pauseBackdrop } from "./ui.js";

const MAX_SECONDS = 60;
const SIZE = 480;

export const circlesSupported =
  typeof MediaRecorder !== "undefined" && !!navigator.mediaDevices?.getUserMedia && !!HTMLCanvasElement.prototype.captureStream;

function pickMime() {
  const options = [
    "video/mp4;codecs=avc1.42E01E,mp4a.40.2",
    "video/mp4",
    "video/webm;codecs=vp9,opus",
    "video/webm;codecs=vp8,opus",
    "video/webm",
  ];
  return options.find((m) => MediaRecorder.isTypeSupported?.(m)) || "";
}

const ICON = {
  close: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>',
  flip: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 7h-3l-2-3H9L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2z"/><path d="M9 13a3 3 0 0 1 5.2-2M15 13a3 3 0 0 1-5.2 2"/></svg>',
  send: '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/></svg>',
};

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

// ---------- Triangles ----------
// A rounded equilateral triangle (apex up) in a 0..1 box, shared by the
// recorder preview, the chat bubble and the kaleidoscope.
// Centred in its square (apex 10 %, base 90 %), so it doesn't sit high in the bubble.
export const TRI = { apexY: 0.1, baseY: 0.9, half: 0.46 };
const TRI_PATH_01 =
  "M0.5,0.1 Q0.528,0.1 0.542,0.125 L0.945,0.85 Q0.968,0.9 0.915,0.9 L0.085,0.9 Q0.032,0.9 0.055,0.85 L0.458,0.125 Q0.472,0.1 0.5,0.1Z";
const TRI_PATH_100 =
  "M50,10 Q52.8,10 54.2,12.5 L94.5,85 Q96.8,90 91.5,90 L8.5,90 Q3.2,90 5.5,85 L45.8,12.5 Q47.2,10 50,10Z";

// One <clipPath> in the document; elements use `clip-path: url(#tri-clip)`.
export function ensureTriangleClip() {
  if (document.getElementById("tri-clip")) return;
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("width", "0");
  svg.setAttribute("height", "0");
  svg.setAttribute("aria-hidden", "true");
  svg.style.position = "absolute";
  svg.innerHTML = `<defs><clipPath id="tri-clip" clipPathUnits="objectBoundingBox"><path d="${TRI_PATH_01}"/></clipPath></defs>`;
  document.body.appendChild(svg);
}

// `seekable` adds an invisible wide copy of the outline to grab and a knob.
function ringSVG(cls, triangle, seekable = false) {
  if (triangle) {
    // Same box as the clipped video; the outline is grown around the
    // triangle's incentre (x 50, y 63.3), so it hugs every edge evenly.
    const tf = 'transform="translate(50 63.33) scale(1.075) translate(-50 -63.33)"';
    return `<svg class="${cls} tri" viewBox="0 0 100 100" overflow="visible"><path pathLength="100" ${tf} d="${TRI_PATH_100}" style="stroke-dasharray:100;stroke-dashoffset:100"/>${
      seekable ? `<path class="ring-hit" ${tf} d="${TRI_PATH_100}"/><circle class="ring-knob" r="3.4" cx="50" cy="10"/>` : ""
    }</svg>`;
  }
  const C = 2 * Math.PI * 48.5;
  return `<svg class="${cls}" viewBox="0 0 100 100"><circle cx="50" cy="50" r="48.5" style="stroke-dasharray:${C};stroke-dashoffset:${C}"/>${
    seekable ? '<circle class="ring-hit" cx="50" cy="50" r="48.5"/><circle class="ring-knob" r="3.4" cx="98.5" cy="50"/>' : ""
  }</svg>`;
}
const ringLength = (triangle) => (triangle ? 100 : 2 * Math.PI * 48.5);
export const MAX_ZOOM = 4;

// Opens the recorder and returns a controller:
//   done        Promise → { blob, duration, mime } when sent, or null
//   finish(send), lock(), setZoom(z), drag(dx, dy)
// With { hold: true } it starts in "hold to record" mode (the caller tracks the
// finger): no buttons, just hints, until lock() makes it hands-free.
// Zoom: a real two-finger pinch, mouse wheel, double tap, or sliding further up
// after locking.
export function recordCircle({ hold = false, shape = "circle" } = {}) {
  let resolveDone;
  const done = new Promise((r) => (resolveDone = r));
  const triangle = shape === "triangle";
  if (triangle) ensureTriangleClip();

  const root = document.createElement("div");
  root.className = "circle-rec" + (hold ? " hold" : "") + (triangle ? " shape-triangle" : "");
  const C = ringLength(triangle);
  root.innerHTML = `
    <div class="circle-rec-stage">
      <div class="circle-rec-frame">
        <div class="circle-rec-lens"><video playsinline muted autoplay></video></div>
        ${ringSVG("circle-rec-ring", triangle)}
        <span class="circle-rec-zoom">1.0×</span>
      </div>
      <div class="circle-rec-time"><span class="circle-rec-dot"></span><span class="circle-rec-clock">0:00</span></div>
      <div class="circle-rec-hint">${triangle ? "🔺 Треугольник · " : ""}Идёт запись · до ${MAX_SECONDS} секунд · двойной тап или щипок — зум</div>
      <div class="circle-rec-hold-hints">
        <span class="crh-cancel">‹ Влево — отмена</span>
        <span class="crh-lock"><svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="18 15 12 9 6 15"/></svg>Вверх — без рук и зум</span>
        <span class="crh-send">Отпустите, чтобы отправить</span>
      </div>
    </div>
    <div class="circle-rec-controls">
      <button type="button" class="call-round circle-rec-cancel" title="Отменить">${ICON.close}</button>
      <button type="button" class="call-round circle-rec-send" title="Отправить">${ICON.send}</button>
      <button type="button" class="call-round circle-rec-flip" title="Сменить камеру">${ICON.flip}</button>
    </div>`;
  document.body.appendChild(root);
  pauseBackdrop(true);

  const video = root.querySelector("video");
  const frame = root.querySelector(".circle-rec-frame");
  const ring = root.querySelector(".circle-rec-ring circle, .circle-rec-ring path");
  const clock = root.querySelector(".circle-rec-clock");
  const zoomBadge = root.querySelector(".circle-rec-zoom");
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = SIZE;
  const ctx2d = canvas.getContext("2d");

  let camStream = null;
  let micStream = null;
  let recorder = null;
  let chunks = [];
  let facing = "user";
  let startedAt = 0;
  let raf = 0;
  let tick = 0;
  let finished = false;
  let zoom = 1; // target
  let zoomShown = 1; // eased towards the target every frame
  let badgeTimer = 0;

  animate(root, [{ opacity: 0 }, { opacity: 1 }], { duration: 250 });
  animate(frame, [{ transform: "scale(.2)" }, { transform: "none" }], { spring: "bouncy" });

  const setZoom = (z) => {
    zoom = clamp(z, 1, MAX_ZOOM);
    zoomBadge.textContent = zoom.toFixed(1) + "×";
    root.classList.add("zooming");
    clearTimeout(badgeTimer);
    badgeTimer = setTimeout(() => root.classList.remove("zooming"), 900);
  };

  const draw = () => {
    raf = requestAnimationFrame(draw);
    const vw = video.videoWidth;
    const vh = video.videoHeight;
    if (!vw || !vh) return;
    zoomShown += (zoom - zoomShown) * 0.22;
    if (Math.abs(zoom - zoomShown) < 0.002) zoomShown = zoom;
    const side = Math.min(vw, vh) / zoomShown;
    ctx2d.save();
    if (facing === "user") {
      ctx2d.translate(SIZE, 0);
      ctx2d.scale(-1, 1);
    }
    ctx2d.drawImage(video, (vw - side) / 2, (vh - side) / 2, side, side, 0, 0, SIZE, SIZE);
    ctx2d.restore();
    // The on-screen preview is the camera itself, so zoom it the same way.
    video.style.transform = `scale(${zoomShown})${facing === "user" ? " scaleX(-1)" : ""}`;
  };

  const getCamera = () =>
    navigator.mediaDevices.getUserMedia({ video: { facingMode: facing, width: { ideal: 720 }, height: { ideal: 720 } } });

  const cleanup = () => {
    cancelAnimationFrame(raf);
    clearInterval(tick);
    camStream?.getTracks().forEach((t) => t.stop());
    micStream?.getTracks().forEach((t) => t.stop());
    pauseBackdrop(false);
    root
      .animate([{ opacity: 1 }, { opacity: 0 }], { duration: reducedMotion ? 50 : 220, fill: "forwards" })
      .finished.then(() => root.remove(), () => root.remove());
    document.removeEventListener("keydown", onKey);
  };

  const finish = (send) => {
    if (finished) return;
    finished = true;
    const duration = startedAt ? Math.min(MAX_SECONDS, Math.max(1, Math.round((performance.now() - startedAt) / 1000))) : 0;
    const tooShort = startedAt && performance.now() - startedAt < 700;
    if (!send || tooShort || !recorder || recorder.state === "inactive") {
      try {
        recorder?.stop();
      } catch (_) {
        /* not started */
      }
      cleanup();
      resolveDone(null);
      return;
    }
    recorder.onstop = () => {
      const mime = recorder.mimeType || "video/webm";
      const blob = new Blob(chunks, { type: mime });
      cleanup();
      resolveDone(blob.size ? { blob, duration, mime } : null);
    };
    recorder.stop();
  };

  const lock = () => {
    if (!root.classList.contains("hold")) return;
    root.classList.remove("hold");
    root.classList.add("locked");
    animate(root.querySelector(".circle-rec-controls"), [{ opacity: 0, transform: "translateY(30px)" }, { opacity: 1, transform: "none" }], { spring: "bouncy" });
  };

  // Feedback while the finger is still on the record button.
  const drag = (dx, dy) => {
    const cancelP = clamp(-dx / 110, 0, 1);
    const lockP = clamp(-dy / 80, 0, 1);
    root.style.setProperty("--cancel", cancelP.toFixed(3));
    root.style.setProperty("--lock", lockP.toFixed(3));
  };

  const onKey = (e) => {
    if (e.key === "Escape") finish(false);
  };
  document.addEventListener("keydown", onKey);

  root.querySelector(".circle-rec-cancel").addEventListener("click", () => finish(false));
  root.querySelector(".circle-rec-send").addEventListener("click", () => finish(true));
  root.querySelector(".circle-rec-flip").addEventListener("click", async () => {
    try {
      facing = facing === "user" ? "environment" : "user";
      const fresh = await getCamera();
      camStream?.getTracks().forEach((t) => t.stop());
      camStream = fresh;
      video.srcObject = fresh;
      root.classList.toggle("back-camera", facing !== "user");
      animate(frame, [{ transform: "rotateY(90deg)" }, { transform: "none" }], { spring: "bouncy" });
    } catch (err) {
      console.error(err);
      toast("Не удалось переключить камеру", { tone: "error" });
    }
  });

  // ----- zoom gestures -----
  root.addEventListener(
    "wheel",
    (e) => {
      e.preventDefault();
      setZoom(zoom * Math.exp(-e.deltaY * 0.0018));
    },
    { passive: false }
  );
  let lastTap = 0;
  frame.addEventListener("click", () => {
    const now = performance.now();
    if (now - lastTap < 320) {
      setZoom(zoom > 1.5 ? 1 : 2);
      lastTap = 0;
    } else lastTap = now;
  });
  const pointers = new Map();
  let pinch = null;
  const stage = root.querySelector(".circle-rec-stage");
  stage.addEventListener("pointerdown", (e) => {
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      pinch = { dist: Math.hypot(a.x - b.x, a.y - b.y) || 1, zoom };
    }
  });
  stage.addEventListener("pointermove", (e) => {
    if (!pointers.has(e.pointerId)) return;
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pinch && pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      setZoom((pinch.zoom * Math.hypot(a.x - b.x, a.y - b.y)) / pinch.dist);
    }
  });
  const dropPointer = (e) => {
    pointers.delete(e.pointerId);
    if (pointers.size < 2) pinch = null;
  };
  stage.addEventListener("pointerup", dropPointer);
  stage.addEventListener("pointercancel", dropPointer);

  (async () => {
    try {
      camStream = await getCamera();
      micStream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
    } catch (err) {
      console.error(err);
      toast(err?.name === "NotAllowedError" ? "Нет доступа к камере или микрофону" : "Камера недоступна", { tone: "error" });
      finish(false);
      return;
    }
    if (finished) {
      camStream.getTracks().forEach((t) => t.stop());
      micStream.getTracks().forEach((t) => t.stop());
      return;
    }
    video.srcObject = camStream;
    await video.play().catch(() => {});
    draw();
    const out = canvas.captureStream(30);
    micStream.getAudioTracks().forEach((t) => out.addTrack(t));
    const mime = pickMime();
    recorder = new MediaRecorder(out, { ...(mime ? { mimeType: mime } : {}), videoBitsPerSecond: 1_200_000 });
    recorder.ondataavailable = (e) => e.data.size && chunks.push(e.data);
    recorder.start(1000);
    startedAt = performance.now();
    root.classList.add("recording");
    tick = setInterval(() => {
      const s = (performance.now() - startedAt) / 1000;
      clock.textContent = `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
      ring.style.strokeDashoffset = String(C * (1 - Math.min(1, s / MAX_SECONDS)));
      if (s >= MAX_SECONDS) finish(true);
    }, 200);
  })();

  return { done, finish, lock, setZoom, drag, get zoom() { return zoom; } };
}

// ---------- Playback in the chat ----------

let active = null;
let observer = null;

function watch(el) {
  if (!("IntersectionObserver" in window)) return;
  if (!observer) {
    observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          const v = e.target.querySelector("video");
          if (!v || e.target === active) return;
          // Data saver: nothing plays until it's tapped.
          if (e.isIntersecting && !document.documentElement.classList.contains("data-saver")) v.play().catch(() => {});
          else v.pause();
        });
      },
      { threshold: 0.5 }
    );
  }
  observer.observe(el);
}

function stopActive() {
  if (!active) return;
  const el = active;
  active = null;
  const v = el.querySelector("video");
  v.muted = true;
  v.loop = true;
  el.classList.remove("with-sound");
  v.play().catch(() => {});
}

// Muted looping preview; tap plays from the start with sound (bigger, with a
// progress ring), tap again pauses.
export function buildVideoNote(url, duration, fmt, shape = "circle") {
  const triangle = shape === "triangle";
  if (triangle) ensureTriangleClip();
  const C = ringLength(triangle);
  const el = document.createElement("div");
  el.className = "vnote" + (triangle ? " vnote-tri" : "");
  el.innerHTML = `
    <video playsinline muted loop preload="metadata"></video>
    ${ringSVG("vnote-ring", triangle, true)}
    <span class="vnote-meta"><span class="vnote-dur"></span><span class="vnote-mute">🔇</span></span>
    ${
      triangle
        ? `<button type="button" class="vnote-kaleido" title="Калейдоскоп"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M12 2.5l8.2 4.75v9.5L12 21.5l-8.2-4.75v-9.5z"/><path d="M12 2.5v19M3.8 7.25l16.4 9.5M20.2 7.25l-16.4 9.5"/></svg></button>`
        : ""
    }`;
  const v = el.querySelector("video");
  const ring = el.querySelector(".vnote-ring circle, .vnote-ring path");
  if (document.documentElement.classList.contains("data-saver")) {
    v.preload = "none";
    if (/res\.cloudinary\.com/.test(url)) v.poster = url.replace(/\.mp4$/i, ".jpg"); // Cloudinary thumbnail
    el.classList.add("paused");
  }
  el.querySelector(".vnote-kaleido")?.addEventListener("click", (e) => {
    e.stopPropagation();
    const from = active === el ? v.currentTime : 0;
    stopActive();
    openKaleidoscope(url, from, el);
  });
  v.src = url;
  el.querySelector(".vnote-dur").textContent = fmt(duration || 0);
  const hit = el.querySelector(".ring-hit");
  const knob = el.querySelector(".ring-knob");
  const total = () => (Number.isFinite(v.duration) && v.duration > 0 ? v.duration : duration || 0);
  const showProgress = (frac) => {
    ring.style.strokeDashoffset = String(C * (1 - frac));
    const len = hit.getTotalLength();
    const p = hit.getPointAtLength(len * Math.min(0.9999, Math.max(0, frac)));
    const m = hit.transform.baseVal.consolidate()?.matrix; // the path's own transform (triangle)
    knob.setAttribute("cx", m ? m.a * p.x + m.c * p.y + m.e : p.x);
    knob.setAttribute("cy", m ? m.b * p.x + m.d * p.y + m.f : p.y);
  };
  v.addEventListener("timeupdate", () => {
    if (el !== active || !total() || el._scrubbing) return;
    showProgress(v.currentTime / total());
  });

  // Drag along the ring to rewind / fast-forward.
  const fractionAt = (x, y) => {
    const ctm = hit.getScreenCTM();
    if (!ctm) return null;
    const len = hit.getTotalLength();
    let best = 0;
    let bestD = Infinity;
    const N = 160;
    for (let i = 0; i <= N; i++) {
      const p = hit.getPointAtLength((len * i) / N);
      const sx = ctm.a * p.x + ctm.c * p.y + ctm.e;
      const sy = ctm.b * p.x + ctm.d * p.y + ctm.f;
      const d = (sx - x) ** 2 + (sy - y) ** 2;
      if (d < bestD) {
        bestD = d;
        best = i / N;
      }
    }
    return best;
  };
  const scrubTo = (e) => {
    const frac = fractionAt(e.clientX, e.clientY);
    if (frac === null || !total()) return;
    showProgress(frac);
    v.currentTime = frac * total();
  };
  hit.addEventListener("pointerdown", (e) => {
    if (active !== el) return;
    e.stopPropagation();
    e.preventDefault();
    hit.setPointerCapture(e.pointerId);
    el._scrubbing = true;
    el.classList.add("scrubbing");
    scrubTo(e);
  });
  hit.addEventListener("pointermove", (e) => {
    if (el._scrubbing) scrubTo(e);
  });
  const endScrub = () => {
    if (!el._scrubbing) return;
    el._scrubbing = false;
    el._scrubbedAt = performance.now();
    el.classList.remove("scrubbing");
    if (v.paused && v.currentTime < total()) v.play().catch(() => {});
  };
  hit.addEventListener("pointerup", endScrub);
  hit.addEventListener("pointercancel", endScrub);
  v.addEventListener("ended", () => {
    if (el === active) stopActive();
  });
  el.addEventListener("click", (e) => {
    e.stopPropagation();
    if (performance.now() - (el._scrubbedAt || 0) < 350) return; // the end of a ring drag
    if (active === el) {
      if (v.paused) v.play().catch(() => {});
      else v.pause();
      el.classList.toggle("paused", v.paused);
      return;
    }
    stopActive();
    active = el;
    el.classList.add("with-sound");
    el.classList.remove("paused");
    v.muted = false;
    v.loop = false;
    v.currentTime = 0;
    v.play().catch(() => {});
  });
  watch(el);
  return el;
}

// ---------- Kaleidoscope (the triangle's party trick) ----------
// The triangle video is mirrored into six wedges of a hexagon and slowly
// spins; drag to spin it yourself (with inertia), tap the centre to switch
// between a calm and a "prism" mode, ✕ or Esc to close.

export function openKaleidoscope(url, startAt = 0, sourceEl = null) {
  const root = document.createElement("div");
  root.className = "kaleido";
  root.innerHTML = `
    <canvas class="kaleido-canvas"></canvas>
    <div class="kaleido-bar"><span class="kaleido-fill"></span></div>
    <div class="kaleido-hint">Крутите пальцем · нажмите в центр — сменить узор</div>
    <button type="button" class="call-round kaleido-close" title="Закрыть">${ICON.close}</button>`;
  document.body.appendChild(root);
  pauseBackdrop(true);
  const canvas = root.querySelector("canvas");
  const g = canvas.getContext("2d");
  const fill = root.querySelector(".kaleido-fill");
  const video = document.createElement("video");
  video.playsInline = true;
  video.src = url;
  video.currentTime = startAt;
  video.play().catch(() => {
    video.muted = true;
    video.play().catch(() => {});
  });

  let size = 0;
  const resize = () => {
    const dpr = Math.min(devicePixelRatio || 1, 2);
    size = Math.min(innerWidth, innerHeight) * 0.92;
    canvas.width = canvas.height = Math.round(size * dpr);
    canvas.style.width = canvas.style.height = size + "px";
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
  };
  resize();
  window.addEventListener("resize", resize);

  let angle = 0;
  let spin = 0.0035; // radians per frame
  let prism = false;
  let raf = 0;
  let dragging = false;
  const draw = () => {
    raf = requestAnimationFrame(draw);
    angle += spin;
    if (!dragging) spin += (0.0035 - spin) * 0.01; // settle back to a slow spin
    const R = size / 2;
    const h = R * Math.cos(Math.PI / 6);
    g.clearRect(0, 0, size, size);
    if (video.readyState < 2) return;
    const vw = video.videoWidth;
    const vh = video.videoHeight;
    const side = Math.min(vw, vh);
    const sx = (vw - side) / 2;
    const sy = (vh - side) / 2;
    // Video units: the triangle spans y 4..84 of 100 → scale so it fills a wedge.
    const s = h / ((TRI.baseY - TRI.apexY) * 100);
    const breathe = prism ? 1 + Math.sin(performance.now() / 700) * 0.04 : 1;
    g.save();
    g.translate(R, R);
    g.rotate(angle);
    g.scale(breathe, breathe);
    for (let k = 0; k < 6; k++) {
      g.save();
      g.rotate((k * Math.PI) / 3);
      if (k % 2) g.scale(-1, 1);
      g.beginPath();
      g.moveTo(0, 0);
      g.lineTo(-R / 2, h);
      g.lineTo(R / 2, h);
      g.closePath();
      g.clip();
      if (prism) g.filter = `hue-rotate(${k * 60}deg) saturate(1.4)`;
      g.drawImage(video, sx, sy, side, side, -50 * s, -TRI.apexY * 100 * s, 100 * s, 100 * s);
      g.restore();
    }
    g.restore();
    fill.style.transform = `scaleX(${video.duration ? video.currentTime / video.duration : 0})`;
  };
  draw();

  // Drag to spin, with inertia.
  let lastA = 0;
  let lastT = 0;
  const center = () => {
    const r = canvas.getBoundingClientRect();
    return [r.left + r.width / 2, r.top + r.height / 2];
  };
  let downAt = null;
  canvas.addEventListener("pointerdown", (e) => {
    canvas.setPointerCapture(e.pointerId);
    const [cx, cy] = center();
    dragging = true;
    lastA = Math.atan2(e.clientY - cy, e.clientX - cx);
    lastT = performance.now();
    downAt = { x: e.clientX, y: e.clientY, t: lastT };
  });
  canvas.addEventListener("pointermove", (e) => {
    if (!dragging) return;
    const [cx, cy] = center();
    const a = Math.atan2(e.clientY - cy, e.clientX - cx);
    let d = a - lastA;
    if (d > Math.PI) d -= 2 * Math.PI;
    if (d < -Math.PI) d += 2 * Math.PI;
    angle += d;
    const now = performance.now();
    spin = clamp(d / Math.max(1, (now - lastT) / 16.7), -0.25, 0.25);
    lastA = a;
    lastT = now;
  });
  canvas.addEventListener("pointerup", (e) => {
    dragging = false;
    const [cx, cy] = center();
    const tap = downAt && Math.hypot(e.clientX - downAt.x, e.clientY - downAt.y) < 8 && performance.now() - downAt.t < 300;
    if (tap && Math.hypot(e.clientX - cx, e.clientY - cy) < size * 0.18) {
      prism = !prism;
      animate(canvas, [{ transform: "scale(.9) rotate(-8deg)" }, { transform: "none" }], { spring: "jelly" });
    }
  });

  const close = () => {
    cancelAnimationFrame(raf);
    window.removeEventListener("resize", resize);
    document.removeEventListener("keydown", onKey);
    video.pause();
    video.removeAttribute("src");
    video.load();
    pauseBackdrop(false);
    root
      .animate([{ opacity: 1, transform: "none" }, { opacity: 0, transform: "scale(.85) rotate(20deg)" }], { duration: reducedMotion ? 50 : 280, easing: "ease-in", fill: "forwards" })
      .finished.then(() => root.remove(), () => root.remove());
  };
  const onKey = (e) => {
    if (e.key === "Escape") close();
  };
  document.addEventListener("keydown", onKey);
  root.querySelector(".kaleido-close").addEventListener("click", close);
  video.addEventListener("ended", () => {
    video.currentTime = 0;
    video.play().catch(() => {});
  });

  // Unfolds out of the bubble it was opened from.
  const from = sourceEl?.getBoundingClientRect();
  animate(root, [{ opacity: 0 }, { opacity: 1 }], { duration: 260 });
  if (from && !reducedMotion) {
    const dx = from.left + from.width / 2 - innerWidth / 2;
    const dy = from.top + from.height / 2 - innerHeight / 2;
    animate(canvas, [{ transform: `translate(${dx}px, ${dy}px) scale(${from.width / size}) rotate(-120deg)` }, { transform: "none" }], { spring: "bouncy" });
  }
  return close;
}
