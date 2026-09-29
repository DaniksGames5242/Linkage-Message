// Touch-gesture walk on a phone viewport: taps, long presses and swipes are
// sent as real touch events (CDP), not mouse clicks.
const L = require("../lib.cjs");
const H = require("../helpers.cjs");
const path = require("path");
const OUT = process.env.OUT || "/tmp/shots";
let n = 0;
async function shot(p, name) {
  await p.waitForTimeout(600);
  await p.screenshot({ path: path.join(OUT, String(++n).padStart(2, "0") + "-" + name + ".png") });
  if (p.errors.length) console.log("ERR after " + name + ": " + p.errors.splice(0).join("\n  "));
}
async function touch(page) {
  const cdp = await page.context().newCDPSession(page);
  const send = (type, pts) => cdp.send("Input.dispatchTouchEvent", { type, touchPoints: pts.map(([x, y]) => ({ x, y })) });
  return {
    async tap(x, y) { await send("touchStart", [[x, y]]); await page.waitForTimeout(60); await send("touchEnd", []); },
    async hold(x, y, ms = 700) { await send("touchStart", [[x, y]]); await page.waitForTimeout(ms); await send("touchEnd", []); },
    async swipe(x0, y0, x1, y1, steps = 12, holdEnd = 0) {
      await send("touchStart", [[x0, y0]]);
      for (let i = 1; i <= steps; i++) { await send("touchMove", [[x0 + ((x1 - x0) * i) / steps, y0 + ((y1 - y0) * i) / steps]]); await page.waitForTimeout(16); }
      if (holdEnd) await page.waitForTimeout(holdEnd);
      await send("touchEnd", []);
    },
    down: (x, y) => send("touchStart", [[x, y]]),
    move: (x, y) => send("touchMove", [[x, y]]),
    up: () => send("touchEnd", []),
  };
}
const rectOf = (p, sel, text) => p.evaluate(([s, t]) => { const e = [...document.querySelectorAll(s)].filter((x) => !t || x.textContent.includes(t)).pop(); if (!e) return null; const r = e.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2, l: r.left, r: r.right, t: r.top, b: r.bottom }; }, [sel, text]);
const state = (p) => p.evaluate(() => ({ chat: document.getElementById("sidebar").classList.contains("chat-open") ? document.getElementById("chat-title").textContent : null, menu: [...document.querySelectorAll(".ctx-menu")].length, menuItems: [...document.querySelectorAll(".ctx-menu .ctx-item")].map((i) => i.textContent.trim()).slice(0, 3).join("|"), reply: !document.getElementById("reply-preview").classList.contains("hidden"), overlays: [...document.querySelectorAll("[id$=-overlay]:not(.hidden)")].map((o) => o.id).join(",") }));
(async () => {
  const tag = Date.now().toString(36).slice(-5);
  const browser = await L.launch();
  const A = await L.userContext(browser, "A", { mobile: true });
  const B = await L.userContext(browser, "B");
  await L.register(A, "ta" + tag, "Тоня");
  await L.register(B, "tb" + tag, "Тимур");
  await B.fill("#search-input", "ta" + tag); await B.waitForTimeout(1500);
  await B.evaluate(() => [...document.querySelectorAll("#search-result button")].find((x) => /Написать/.test(x.textContent))?.click());
  await B.waitForTimeout(1500);
  for (const t of ["раз", "два https://example.org", "три"]) await H.send(B, t);
  await A.waitForTimeout(2000);
  const T = await touch(A);
  let r = await rectOf(A, "#chat-list .room-item", "Тимур");
  console.log("row", !!r);
  // long press on row: exactly one menu
  await T.hold(r.x, r.y, 800); await A.waitForTimeout(500);
  console.log("after long-press row:", await state(A));
  await shot(A, "row-longpress");
  await A.keyboard.press("Escape"); await A.waitForTimeout(500);
  // next tap opens the chat
  await T.tap(r.x, r.y); await A.waitForTimeout(1200);
  console.log("after tap row:", await state(A));
  await shot(A, "chat-opened");
  // tap bubble -> menu
  let b = await rectOf(A, ".msg-row .bubble", "три");
  await T.tap(b.x, b.y); await A.waitForTimeout(700);
  console.log("after tap bubble:", await state(A));
  await shot(A, "bubble-tap");
  await A.keyboard.press("Escape"); await A.waitForTimeout(500);
  // double tap -> reaction, no menu
  await T.tap(b.x, b.y); await A.waitForTimeout(120); await T.tap(b.x, b.y); await A.waitForTimeout(900);
  console.log("after double tap:", await state(A), await A.evaluate(() => [...document.querySelectorAll(".msg-row")].pop().querySelector(".reactions, .msg-reactions")?.textContent));
  await shot(A, "double-tap");
  await A.keyboard.press("Escape"); await A.waitForTimeout(400);
  // long press bubble -> one menu
  b = await rectOf(A, ".msg-row .bubble", "раз");
  await A.evaluate(() => { window.__ev = []; const t0 = performance.now(); for (const ty of ["click", "pointerup", "pointerdown", "touchend", "contextmenu", "mousedown", "mouseup"]) document.addEventListener(ty, (e) => window.__ev.push(ty + "@" + Math.round(performance.now() - t0) + ":" + (e.target.className || e.target.tagName).toString().slice(0, 30)), true); new MutationObserver(() => window.__ev.push("menus=" + document.querySelectorAll(".ctx-menu").length + "@" + Math.round(performance.now() - t0))).observe(document.body, { childList: true }); });
  await T.down(b.x, b.y); await A.waitForTimeout(650);
  console.log("during long-press bubble:", await state(A));
  await T.up(); await A.waitForTimeout(80);
  console.log("right after release:", await state(A));
  await A.waitForTimeout(500);
  console.log("after long-press bubble:", await state(A), await A.evaluate(() => window.__ev.join(" ")));
  await A.keyboard.press("Escape"); await A.waitForTimeout(500);
  // swipe left on bubble -> reply
  b = await rectOf(A, ".msg-row .bubble", "раз");
  await T.swipe(b.x + 60, b.y, b.x - 60, b.y, 14); await A.waitForTimeout(600);
  console.log("after swipe-reply:", await state(A));
  await shot(A, "swipe-reply");
  await A.evaluate(() => document.getElementById("reply-cancel-btn").click()); await A.waitForTimeout(400);
  // tap link: should not open menu
  const link = await rectOf(A, ".msg-row .bubble a", "example");
  await A.evaluate(() => { window.__opened = []; window.open = (u) => { window.__opened.push(u); return null; }; });
  if (link) { await T.tap(link.x, link.y); await A.waitForTimeout(700); console.log("after tap link:", await state(A), await A.evaluate(() => location.href)); await shot(A, "link-tap"); await A.keyboard.press("Escape"); }
  // vertical scroll inside messages should not trigger reply
  // swipe right from left edge -> back to list
  await T.swipe(8, 400, 300, 405, 16); await A.waitForTimeout(900);
  console.log("after edge swipe:", await state(A));
  await shot(A, "edge-swipe");
  // swipe row left -> archive
  r = await rectOf(A, "#chat-list .room-item", "Тимур");
  await A.evaluate(() => { window.__ev = []; const t0 = performance.now(); for (const ty of ["click", "pointerup", "pointerdown", "pointercancel", "touchstart", "touchend", "touchcancel", "contextmenu"]) document.addEventListener(ty, (e) => window.__ev.push(ty + "@" + Math.round(performance.now() - t0) + ":" + (e.target.className || e.target.tagName).toString().slice(0, 20)), true); let tm = 0; document.addEventListener("touchmove", () => tm++, true); new MutationObserver(() => window.__ev.push("menus=" + document.querySelectorAll(".ctx-menu").length + "@" + Math.round(performance.now() - t0) + " tm=" + tm)).observe(document.body, { childList: true }); });
  if (r) { await T.swipe(r.r - 20, r.y, r.r - 260, r.y + 3, 16); await A.waitForTimeout(1200); console.log("after row swipe:", await A.evaluate(() => [...document.querySelectorAll("#chat-list .room-item .room-name")].map((x) => x.textContent).join("|") + " EV " + window.__ev.join(" "))); await shot(A, "row-swipe"); }
  // folder tabs: tap "Личные"
  const tab = await rectOf(A, "#folder-tabs button, #folder-tabs .folder-tab", "Личные");
  if (tab) { await T.tap(tab.x, tab.y); await A.waitForTimeout(700); await shot(A, "folder-personal"); }
  // tabbar taps
  for (const t of ["settings", "profile", "chats"]) { const x = await rectOf(A, `#tabbar .tab[data-tab="${t}"]`); await T.tap(x.x, x.y); await A.waitForTimeout(700); await shot(A, "tab-" + t); }
  console.log("errors", A.errors.join("\n"));
  await browser.close();
})().catch((e) => { console.error("FATAL", e); process.exit(1); });
