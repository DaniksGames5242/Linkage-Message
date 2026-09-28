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

// Opens the recorder. Resolves { blob, duration, mime } when sent, or null.
export function recordCircle() {
  return new Promise((resolve) => {
    const root = document.createElement("div");
    root.className = "circle-rec";
    const C = 2 * Math.PI * 48.5;
    root.innerHTML = `
      <div class="circle-rec-stage">
        <div class="circle-rec-frame">
          <video playsinline muted autoplay></video>
          <svg class="circle-rec-ring" viewBox="0 0 100 100"><circle cx="50" cy="50" r="48.5" style="stroke-dasharray:${C};stroke-dashoffset:${C}"/></svg>
        </div>
        <div class="circle-rec-time"><span class="circle-rec-dot"></span><span class="circle-rec-clock">0:00</span></div>
        <div class="circle-rec-hint">Идёт запись · до ${MAX_SECONDS} секунд</div>
      </div>
      <div class="circle-rec-controls">
        <button type="button" class="call-round circle-rec-cancel" title="Отменить">${ICON.close}</button>
        <button type="button" class="call-round circle-rec-send" title="Отправить">${ICON.send}</button>
        <button type="button" class="call-round circle-rec-flip" title="Сменить камеру">${ICON.flip}</button>
      </div>`;
    document.body.appendChild(root);
    pauseBackdrop(true);

    const video = root.querySelector("video");
    const ring = root.querySelector(".circle-rec-ring circle");
    const clock = root.querySelector(".circle-rec-clock");
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

    animate(root, [{ opacity: 0 }, { opacity: 1 }], { duration: 250 });
    animate(root.querySelector(".circle-rec-frame"), [{ transform: "scale(.2)" }, { transform: "none" }], { spring: "bouncy" });

    const draw = () => {
      raf = requestAnimationFrame(draw);
      const vw = video.videoWidth;
      const vh = video.videoHeight;
      if (!vw || !vh) return;
      const side = Math.min(vw, vh);
      ctx2d.save();
      if (facing === "user") {
        ctx2d.translate(SIZE, 0);
        ctx2d.scale(-1, 1);
      }
      ctx2d.drawImage(video, (vw - side) / 2, (vh - side) / 2, side, side, 0, 0, SIZE, SIZE);
      ctx2d.restore();
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
      if (!send || !recorder || recorder.state === "inactive") {
        try {
          recorder?.stop();
        } catch (_) {
          /* not started */
        }
        cleanup();
        resolve(null);
        return;
      }
      recorder.onstop = () => {
        const mime = recorder.mimeType || "video/webm";
        const blob = new Blob(chunks, { type: mime });
        cleanup();
        resolve(blob.size ? { blob, duration, mime } : null);
      };
      recorder.stop();
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
        animate(root.querySelector(".circle-rec-frame"), [{ transform: "rotateY(90deg)" }, { transform: "none" }], { spring: "bouncy" });
      } catch (err) {
        console.error(err);
        toast("Не удалось переключить камеру", { tone: "error" });
      }
    });

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
  });
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
          if (e.isIntersecting) v.play().catch(() => {});
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
export function buildVideoNote(url, duration, fmt) {
  const C = 2 * Math.PI * 48.5;
  const el = document.createElement("div");
  el.className = "vnote";
  el.innerHTML = `
    <video playsinline muted loop preload="metadata"></video>
    <svg class="vnote-ring" viewBox="0 0 100 100"><circle cx="50" cy="50" r="48.5" style="stroke-dasharray:${C};stroke-dashoffset:${C}"/></svg>
    <span class="vnote-meta"><span class="vnote-dur"></span><span class="vnote-mute">🔇</span></span>`;
  const v = el.querySelector("video");
  const ring = el.querySelector(".vnote-ring circle");
  v.src = url;
  el.querySelector(".vnote-dur").textContent = fmt(duration || 0);
  v.addEventListener("timeupdate", () => {
    if (el !== active || !v.duration) return;
    ring.style.strokeDashoffset = String(C * (1 - v.currentTime / v.duration));
  });
  v.addEventListener("ended", () => {
    if (el === active) stopActive();
  });
  el.addEventListener("click", (e) => {
    e.stopPropagation();
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
