// Record button with real touch: hold-to-send, slide-to-cancel, slide-up lock, tap switches mode.
const L = require("../lib.cjs");
const H = require("../helpers.cjs");
const path = require("path");
const OUT = process.env.OUT || "/tmp/shots";
(async () => {
  const tag = Date.now().toString(36).slice(-5);
  const browser = await L.launch();
  const A = await L.userContext(browser, "A", { mobile: true });
  const B = await L.userContext(browser, "B");
  await L.register(A, "ra" + tag, "Рита");
  await L.register(B, "rb" + tag, "Роман");
  await B.fill("#search-input", "ra" + tag); await B.waitForTimeout(1500);
  await B.evaluate(() => [...document.querySelectorAll("#search-result button")].find((x) => /Написать/.test(x.textContent))?.click());
  await B.waitForTimeout(1500);
  await H.send(B, "запиши голосовое");
  await A.waitForTimeout(1500);
  await H.openChatByName(A, "Роман");
  const cdp = await A.context().newCDPSession(A);
  const t = (type, pts) => cdp.send("Input.dispatchTouchEvent", { type, touchPoints: pts.map(([x, y]) => ({ x, y })) });
  const btn = await A.evaluate(() => { const r = document.getElementById("rec-btn").getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; });
  const mine = () => A.evaluate(() => [...document.querySelectorAll(".msg-row.me")].map((r) => (r.querySelector(".voice-player") ? "voice" : r.querySelector(".vnote") ? "circle" : r.innerText.slice(0, 20)) + (r.classList.contains("pending-upload") ? "(up)" : "")));
  const mode = () => A.evaluate(() => ({ recMode: document.getElementById("rec-btn").className, panel: !document.getElementById("rec-panel").classList.contains("hidden"), hint: document.getElementById("rec-hint")?.textContent, overlays: [...document.querySelectorAll(".circle-rec, .camera-overlay")].length }));
  // 1. hold 1.6 s, release -> voice sent
  await t("touchStart", [[btn.x, btn.y]]); await A.waitForTimeout(1600);
  console.log("holding:", await mode());
  await A.screenshot({ path: path.join(OUT, "rec-hold.png") });
  await t("touchEnd", []); await A.waitForTimeout(3000);
  console.log("after release:", await mine());
  // 2. hold, slide left -> cancel
  await t("touchStart", [[btn.x, btn.y]]); await A.waitForTimeout(900);
  for (let i = 1; i <= 12; i++) { await t("touchMove", [[btn.x - i * 18, btn.y]]); await A.waitForTimeout(20); }
  await A.screenshot({ path: path.join(OUT, "rec-slide-cancel.png") });
  await t("touchEnd", []); await A.waitForTimeout(2000);
  console.log("after slide-cancel:", await mine(), await mode());
  // 3. hold, slide up -> lock, then tap send
  await t("touchStart", [[btn.x, btn.y]]); await A.waitForTimeout(900);
  for (let i = 1; i <= 10; i++) { await t("touchMove", [[btn.x, btn.y - i * 14]]); await A.waitForTimeout(20); }
  await t("touchEnd", []); await A.waitForTimeout(1200);
  console.log("locked:", await mode());
  await A.screenshot({ path: path.join(OUT, "rec-locked.png") });
  const send = await A.evaluate(() => { const b = document.querySelector("#send-btn:not(.hidden), #rec-btn"); const r = b.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2, id: b.id }; });
  await t("touchStart", [[send.x, send.y]]); await A.waitForTimeout(60); await t("touchEnd", []); await A.waitForTimeout(3000);
  console.log("after locked send:", await mine(), await mode());
  // 4. short tap -> switch to circle mode
  await t("touchStart", [[btn.x, btn.y]]); await A.waitForTimeout(80); await t("touchEnd", []); await A.waitForTimeout(800);
  console.log("after tap:", await mode());
  await A.screenshot({ path: path.join(OUT, "rec-after-tap.png") });
  // 5. hold in circle mode -> circle recording, release -> sent
  await t("touchStart", [[btn.x, btn.y]]); await A.waitForTimeout(2200);
  console.log("circle holding:", await mode());
  await A.screenshot({ path: path.join(OUT, "circle-hold.png") });
  await t("touchEnd", []); await A.waitForTimeout(4000);
  console.log("after circle release:", await mine());
  await A.screenshot({ path: path.join(OUT, "circle-sent.png") });
  console.log("errors:", A.errors.join(" | ").slice(0, 600));
  await browser.close();
})().catch((e) => { console.error("FATAL", e); process.exit(1); });
