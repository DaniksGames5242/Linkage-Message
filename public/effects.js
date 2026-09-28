// Full-screen message effects (confetti, hearts, fire, snow, fireworks).
// One transient canvas; the loop stops by itself when the particles are gone.

import { reducedMotion, fxLevel } from "./ui.js";

export const EFFECTS = {
  confetti: { emoji: "🎉", label: "Конфетти" },
  hearts: { emoji: "❤️", label: "Сердца" },
  fire: { emoji: "🔥", label: "Огонь" },
  snow: { emoji: "❄️", label: "Снег" },
  fireworks: { emoji: "🎆", label: "Салют" },
  money: { emoji: "💸", label: "Деньги" },
};

let canvas = null;
let ctx = null;
let particles = [];
let raf = 0;
let last = 0;
const glyphCache = new Map();

function ensureCanvas() {
  if (canvas) return;
  canvas = document.createElement("canvas");
  canvas.className = "fx-canvas";
  document.body.appendChild(canvas);
  ctx = canvas.getContext("2d");
  resize();
  window.addEventListener("resize", resize);
}

function resize() {
  if (!canvas) return;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = innerWidth * dpr;
  canvas.height = innerHeight * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

// Emoji are pre-rendered once into small bitmaps (drawing text every frame is slow).
function glyph(emoji, size) {
  const key = emoji + size;
  if (!glyphCache.has(key)) {
    const c = document.createElement("canvas");
    c.width = c.height = size * 1.3;
    const g = c.getContext("2d");
    g.font = `${size}px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif`;
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.fillText(emoji, c.width / 2, c.height / 2 + size * 0.05);
    glyphCache.set(key, c);
  }
  return glyphCache.get(key);
}

const rand = (a, b) => a + Math.random() * (b - a);
const COLORS = ["#ffd84a", "#ffa41b", "#ff6a1a", "#ff3d6e", "#8b5cf6", "#5ee6a0", "#5b8cff", "#ffffff"];

function spawn(kind, origin) {
  const W = innerWidth;
  const H = innerHeight;
  const lite = fxLevel() === "lite";
  const n = (count) => Math.round(count * (lite ? 0.45 : 1));
  const add = (p) => particles.push({ life: 0, rot: 0, vr: 0, ...p });

  if (kind === "confetti") {
    for (let i = 0; i < n(160); i++) {
      const fromLeft = i % 2 === 0;
      add({
        type: "rect",
        x: fromLeft ? -10 : W + 10,
        y: H * rand(0.55, 0.9),
        vx: (fromLeft ? 1 : -1) * rand(4, 13),
        vy: rand(-17, -8),
        g: 0.32,
        drag: 0.985,
        w: rand(6, 11),
        h: rand(9, 16),
        color: COLORS[i % COLORS.length],
        vr: rand(-0.3, 0.3),
        max: rand(150, 220),
      });
    }
  } else if (kind === "hearts" || kind === "fire" || kind === "money") {
    const emoji = { hearts: ["❤️", "💖", "💘", "💕"], fire: ["🔥", "🔥", "✨"], money: ["💸", "💵", "💰", "🪙"] }[kind];
    for (let i = 0; i < n(kind === "fire" ? 70 : 55); i++) {
      add({
        type: "glyph",
        img: glyph(emoji[i % emoji.length], Math.round(rand(22, 46))),
        x: origin ? origin.x + rand(-60, 60) : rand(0, W),
        y: H + rand(10, 200),
        vx: rand(-1.2, 1.2),
        vy: rand(-9, -4.5),
        g: kind === "money" ? 0.05 : -0.02,
        drag: 0.995,
        wobble: rand(0, Math.PI * 2),
        vr: rand(-0.04, 0.04),
        max: rand(120, 190),
      });
    }
  } else if (kind === "snow") {
    for (let i = 0; i < n(90); i++) {
      add({
        type: "glyph",
        img: glyph("❄️", Math.round(rand(12, 30))),
        x: rand(0, W),
        y: rand(-H * 0.6, -20),
        vx: rand(-0.6, 0.6),
        vy: rand(1.2, 3),
        g: 0,
        drag: 1,
        wobble: rand(0, Math.PI * 2),
        vr: rand(-0.02, 0.02),
        max: rand(240, 320),
      });
    }
  } else if (kind === "fireworks") {
    for (let b = 0; b < (lite ? 3 : 6); b++) {
      const cx = rand(W * 0.15, W * 0.85);
      const cy = rand(H * 0.12, H * 0.5);
      const color = COLORS[b % COLORS.length];
      const delay = b * 14;
      for (let i = 0; i < n(60); i++) {
        const a = (Math.PI * 2 * i) / 60;
        const s = rand(3, 7.5);
        add({ type: "spark", x: cx, y: cy, vx: Math.cos(a) * s, vy: Math.sin(a) * s, g: 0.07, drag: 0.97, color, r: rand(1.6, 2.8), delay, max: rand(70, 100) });
      }
    }
  }
}

function frame(now) {
  const dt = Math.min(2.5, (now - last) / 16.67 || 1);
  last = now;
  ctx.clearRect(0, 0, innerWidth, innerHeight);
  particles = particles.filter((p) => {
    if (p.delay > 0) {
      p.delay -= dt;
      return true;
    }
    p.life += dt;
    p.vx *= p.drag ?? 1;
    p.vy = p.vy * (p.drag ?? 1) + p.g * dt;
    p.x += p.vx * dt + (p.wobble !== undefined ? Math.sin(p.life * 0.05 + p.wobble) * 0.8 : 0);
    p.y += p.vy * dt;
    p.rot += p.vr * dt;
    const fade = Math.max(0, 1 - Math.max(0, p.life - p.max * 0.7) / (p.max * 0.3));
    if (p.life > p.max || fade <= 0) return false;
    ctx.globalAlpha = fade;
    if (p.type === "rect") {
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.scale(1, Math.cos(p.life * 0.2));
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
      ctx.restore();
    } else if (p.type === "glyph") {
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.drawImage(p.img, -p.img.width / 2, -p.img.height / 2);
      ctx.restore();
    } else if (p.type === "spark") {
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
    }
    return true;
  });
  ctx.globalAlpha = 1;
  if (particles.length) raf = requestAnimationFrame(frame);
  else {
    raf = 0;
    ctx.clearRect(0, 0, innerWidth, innerHeight);
  }
}

export function playEffect(kind, origin) {
  if (reducedMotion || !EFFECTS[kind]) return;
  ensureCanvas();
  spawn(kind, origin);
  if (!raf) {
    last = performance.now();
    raf = requestAnimationFrame(frame);
  }
}
