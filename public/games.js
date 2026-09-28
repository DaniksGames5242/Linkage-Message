// Telegram-style mini games: send 🎲 🎯 🏀 🎰 on their own and the sender's
// client rolls a random result, which everyone sees animated.

import { animate, reducedMotion } from "./ui.js";

export const GAMES = {
  "🎲": { kind: "dice", max: 6, label: "Кубик" },
  "🎯": { kind: "darts", max: 6, label: "Дартс" },
  "🏀": { kind: "basketball", max: 5, label: "Баскетбол" },
  "🎰": { kind: "slots", max: 64, label: "Слоты" },
};

export function gameForText(text) {
  return GAMES[(text || "").trim()] || null;
}

export function rollGame(emoji) {
  const g = GAMES[emoji];
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  return { kind: g.kind, value: 1 + (buf[0] % g.max) };
}

const SLOT_SYMBOLS = ["🍋", "🍒", "🔔", "7️⃣"];
const slotReels = (v) => [(v - 1) & 3, ((v - 1) >> 2) & 3, ((v - 1) >> 4) & 3];

export function gameResultText(game) {
  const v = game.value;
  switch (game.kind) {
    case "dice":
      return `Выпало ${v}`;
    case "darts":
      return v === 6 ? "В яблочко! 🎯" : v === 1 ? "Мимо" : `${v - 1} из 5 очков`;
    case "basketball":
      return v >= 4 ? "Попадание! 🏀" : "Мимо кольца";
    case "slots": {
      const r = slotReels(v);
      if (v === 64) return "ДЖЕКПОТ! 777 🎉";
      if (r[0] === r[1] && r[1] === r[2]) return "Три в ряд!";
      return "Не повезло";
    }
    default:
      return "";
  }
}

export function isWin(game) {
  if (game.kind === "dice") return game.value === 6;
  if (game.kind === "darts") return game.value === 6;
  if (game.kind === "basketball") return game.value >= 4;
  if (game.kind === "slots") {
    const r = slotReels(game.value);
    return r[0] === r[1] && r[1] === r[2];
  }
  return false;
}

// ---------- Dice (CSS 3D cube) ----------

const PIPS = { 1: [5], 2: [1, 9], 3: [1, 5, 9], 4: [1, 3, 7, 9], 5: [1, 3, 5, 7, 9], 6: [1, 3, 4, 6, 7, 9] };
const FACE_ROT = { 1: "rotateX(0deg) rotateY(0deg)", 6: "rotateY(180deg)", 3: "rotateY(-90deg)", 4: "rotateY(90deg)", 2: "rotateX(-90deg)", 5: "rotateX(90deg)" };

function dice(game, play) {
  const el = document.createElement("div");
  el.className = "game game-dice";
  const faces = [1, 6, 3, 4, 2, 5]
    .map((n) => `<div class="die-face f${n}">${Array.from({ length: 9 }, (_, i) => `<i class="${PIPS[n].includes(i + 1) ? "on" : ""}"></i>`).join("")}</div>`)
    .join("");
  el.innerHTML = `<div class="die-scene"><div class="die">${faces}</div></div>`;
  const die = el.querySelector(".die");
  const final = FACE_ROT[game.value];
  if (play) {
    die.animate(
      [
        { transform: "translateY(-60px) rotateX(0deg) rotateY(0deg) rotateZ(0deg)" },
        { transform: "translateY(0) rotateX(540deg) rotateY(300deg) rotateZ(90deg)", offset: 0.55 },
        { transform: "translateY(-18px) rotateX(680deg) rotateY(390deg) rotateZ(160deg)", offset: 0.75 },
        { transform: `translateY(0) ${final}` },
      ],
      { duration: 1500, easing: "cubic-bezier(.3,.6,.3,1)" }
    );
  }
  die.style.transform = final;
  return el;
}

// ---------- Darts ----------

function darts(game, play) {
  const el = document.createElement("div");
  el.className = "game game-darts";
  // Landing radius per score (6 = bullseye, 1 = off the board).
  const radius = { 6: 0, 5: 13, 4: 25, 3: 37, 2: 48, 1: 66 }[game.value];
  const angle = ((game.value * 137) % 360) * (Math.PI / 180);
  const tx = 60 + Math.cos(angle) * radius;
  const ty = 60 + Math.sin(angle) * radius;
  el.innerHTML = `
    <svg viewBox="0 0 120 120" class="dart-board">
      <circle cx="60" cy="60" r="54" fill="#1b1310" stroke="#3a2a22" stroke-width="3"/>
      <circle cx="60" cy="60" r="50" fill="#f3e6cf"/><circle cx="60" cy="60" r="41" fill="#d9362b"/>
      <circle cx="60" cy="60" r="31" fill="#f3e6cf"/><circle cx="60" cy="60" r="20" fill="#1f8f4e"/>
      <circle cx="60" cy="60" r="9" fill="#d9362b"/><circle cx="60" cy="60" r="3.5" fill="#1b1310"/>
      <g class="dart" style="transform: translate(${tx}px, ${ty}px)">
        <line x1="0" y1="0" x2="16" y2="-16" stroke="#e8e2da" stroke-width="2.5" stroke-linecap="round"/>
        <path d="M13 -21 L22 -22 L21 -13 Z" fill="var(--accent)"/>
        <circle cx="0" cy="0" r="1.8" fill="#333"/>
      </g>
    </svg>`;
  const dart = el.querySelector(".dart");
  if (play) {
    dart.animate(
      [
        { transform: `translate(${tx + 70}px, ${ty + 70}px) scale(2.2)`, opacity: 0 },
        { opacity: 1, offset: 0.3 },
        { transform: `translate(${tx}px, ${ty}px) scale(1)`, opacity: 1 },
      ],
      { duration: 650, easing: "cubic-bezier(.2,.7,.3,1)" }
    );
    el.querySelector(".dart-board").animate(
      [{ transform: "none" }, { transform: "rotate(-3deg) scale(.97)" }, { transform: "none" }],
      { duration: 300, delay: 620, easing: "ease-out" }
    );
  }
  return el;
}

// ---------- Basketball ----------

function basketball(game, play) {
  const el = document.createElement("div");
  el.className = "game game-basketball";
  el.innerHTML = `
    <svg viewBox="0 0 120 120" class="hoop">
      <rect x="30" y="8" width="60" height="40" rx="4" fill="rgba(255,255,255,.9)" stroke="#c9c1b7" stroke-width="2"/>
      <rect x="48" y="22" width="24" height="16" fill="none" stroke="#e0473a" stroke-width="2"/>
      <path d="M40 48 L44 72 L76 72 L80 48" fill="none" stroke="rgba(255,255,255,.75)" stroke-width="1.5" stroke-dasharray="3 3"/>
      <ellipse cx="60" cy="48" rx="21" ry="4.5" fill="none" stroke="#e0473a" stroke-width="3"/>
    </svg>
    <span class="ball">🏀</span>`;
  const ball = el.querySelector(".ball");
  const score = game.value >= 4;
  const endX = score ? 0 : game.value % 2 ? 34 : -34;
  if (play) {
    const frames = score
      ? [
          { transform: "translate(0, 70px) scale(1.5)" },
          { transform: "translate(0, -52px) scale(.95)", offset: 0.5 },
          { transform: "translate(0, -32px) scale(.85)", offset: 0.65 },
          { transform: "translate(0, 30px) scale(.8)" },
        ]
      : [
          { transform: "translate(0, 70px) scale(1.5)" },
          { transform: `translate(${endX * 0.2}px, -48px) scale(.95)`, offset: 0.5 },
          { transform: `translate(${endX * 0.5}px, -36px) scale(.9)`, offset: 0.62 },
          { transform: `translate(${endX}px, 40px) scale(.85)` },
        ];
    ball.animate(frames, { duration: 1300, easing: "cubic-bezier(.3,.5,.4,1)", fill: "forwards" });
  } else {
    ball.style.transform = score ? "translate(0, 30px) scale(.8)" : `translate(${endX}px, 40px) scale(.85)`;
  }
  return el;
}

// ---------- Slots ----------

function slots(game, play) {
  const el = document.createElement("div");
  el.className = "game game-slots";
  const target = slotReels(game.value);
  const reelHTML = target
    .map(() => `<div class="reel"><div class="reel-strip">${Array.from({ length: 5 }, () => SLOT_SYMBOLS.map((s) => `<span>${s}</span>`).join("")).join("")}</div></div>`)
    .join("");
  el.innerHTML = `<div class="slot-machine">${reelHTML}</div>`;
  const cell = 40;
  el.querySelectorAll(".reel-strip").forEach((strip, i) => {
    const endIndex = 16 + target[i]; // stop in the 5th copy of the strip
    const end = -endIndex * cell;
    strip.style.transform = `translateY(${end}px)`;
    if (play) {
      strip.animate([{ transform: "translateY(0)" }, { transform: `translateY(${end}px)` }], {
        duration: 1100 + i * 450,
        easing: "cubic-bezier(.15,.6,.2,1.06)",
      });
    }
  });
  if (play && isWin(game)) {
    animate(el.querySelector(".slot-machine"), [{ transform: "scale(1.08)" }, { transform: "none" }], { spring: "jelly", delay: 2100 });
  }
  return el;
}

// Returns { el, duration } — duration ≈ when the result is known.
export function renderGame(game, play) {
  const doPlay = play && !reducedMotion;
  const make = { dice, darts, basketball, slots }[game.kind];
  if (!make) return null;
  const el = make(game, doPlay);
  const duration = !doPlay ? 0 : { dice: 1500, darts: 700, basketball: 1300, slots: 2100 }[game.kind];
  const caption = document.createElement("div");
  caption.className = "game-result";
  caption.textContent = gameResultText(game);
  if (isWin(game)) caption.classList.add("win");
  el.appendChild(caption);
  if (doPlay) caption.animate([{ opacity: 0, transform: "translateY(6px)" }, { opacity: 1, transform: "none" }], { duration: 400, delay: duration, fill: "backwards" });
  return { el, duration };
}
