// Random taps for a while (skipping destructive buttons), reporting any
// console/page errors and stuck states.
const L = require("../lib.cjs");
const H = require("../helpers.cjs");
const SEED = +(process.env.SEED || 1);
let seed = SEED;
const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
(async () => {
  const tag = Date.now().toString(36).slice(-5);
  const browser = await L.launch();
  const mobile = process.env.DESKTOP ? false : true;
  const A = await L.userContext(browser, "A", { mobile });
  const B = await L.userContext(browser, "B");
  await L.register(A, "ma" + tag, "Маша");
  await L.register(B, "mb" + tag, "Миша");
  await B.fill("#search-input", "ma" + tag); await B.waitForTimeout(1500);
  await B.evaluate(() => [...document.querySelectorAll("#search-result button")].find((x) => /Написать/.test(x.textContent))?.click());
  await B.waitForTimeout(1500);
  for (const t of ["привет", "как дела? https://example.com", "👍", "**жирный** и ||спойлер||"]) await H.send(B, t);
  await A.waitForTimeout(1500);
  const N = +(process.env.STEPS || 400);
  const log = [];
  for (let i = 0; i < N; i++) {
    const act = await A.evaluate((r) => {
      const bad = /Удалить|Выйти|Заблокировать|Сбросить|Delete|Log out|Block|Reset|Очистить|Clear|Экспорт|Export|Позвонить|Звонок|Видео|Call|Камера|Camera|Сменить пароль|English|Язык|Код-пароль|lock/i;
      const cands = [...document.querySelectorAll("button, .room-item, .bubble, .tab, .ctx-item, [role=button], .emoji-option, .folder-tab, a, input[type=checkbox], .seg button")].filter((e) => {
        const b = e.getBoundingClientRect();
        if (b.width < 4 || b.height < 4 || b.bottom < 0 || b.top > innerHeight || b.right < 0 || b.left > innerWidth) return false;
        if (e.closest(".hidden") || getComputedStyle(e).visibility === "hidden" || e.disabled) return false;
        const t = (e.textContent + " " + (e.title || "") + " " + (e.getAttribute("aria-label") || "") + " " + e.id).trim();
        if (bad.test(t) || /call-|rec-btn|attach-input|delete|logout|block|lock/.test(e.id + " " + e.className)) return false;
        if (e.tagName === "A" && /^http/.test(e.getAttribute("href") || "")) return false;
        const at = document.elementFromPoint(b.x + b.width / 2, b.y + b.height / 2);
        return at && (at === e || e.contains(at));
      });
      if (!cands.length) return null;
      const e = cands[Math.floor(r * cands.length)];
      const b = e.getBoundingClientRect();
      return { x: b.x + b.width / 2, y: b.y + b.height / 2, what: (e.id || e.className || e.tagName).toString().slice(0, 30) + ":" + e.textContent.trim().slice(0, 20) };
    }, rnd());
    const r = rnd();
    if (!act || r < 0.08) { await A.keyboard.press("Escape"); log.push("Esc"); }
    else if (r < 0.12 && (await A.evaluate(() => document.getElementById("sidebar").classList.contains("chat-open") || !!document.querySelector(".ctx-menu, .modal-overlay, [id$=-overlay]:not(.hidden)")))) { await A.evaluate(() => history.back()); log.push("Back"); }
    else if (r < 0.16 && (await A.$("#msg-input:visible"))) { await A.fill("#msg-input", "monkey " + i); await A.press("#msg-input", "Enter"); log.push("send"); }
    else { await A.mouse.click(act.x, act.y); log.push(act.what); }
    await A.waitForTimeout(120 + Math.floor(rnd() * 300));
    if (A.errors.length) { console.log(`step ${i} after [${log.slice(-6).join(" > ")}]:\n  ` + A.errors.splice(0).join("\n  ")); }
    if (!A.url().startsWith(L.BASE)) { console.log("left app at step", i, A.url(), log.slice(-6)); await A.goto(L.BASE + "/"); await A.waitForTimeout(2500); }
  }
  // Stuck states: overlays left half-closed, etc.
  console.log("final:", await A.evaluate(() => ({ closing: document.querySelectorAll(".is-closing").length, menus: document.querySelectorAll(".ctx-menu").length, modals: document.querySelectorAll(".modal-overlay").length, bodyOverflow: getComputedStyle(document.body).overflow })));
  console.log("done", N, "steps");
  await browser.close();
})().catch((e) => { console.error("FATAL", e); process.exit(1); });
