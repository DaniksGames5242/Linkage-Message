const L = require("./lib.cjs");
const H = require("./helpers.cjs");
const path = require("path");
const OUT = process.env.OUT || "/tmp/shots";
const tag = Date.now().toString(36).slice(-5);
let n = 0;
async function shot(p, name) {
  await p.waitForTimeout(800);
  await p.screenshot({ path: path.join(OUT, String(++n).padStart(2, "0") + "-" + name + ".png") });
  if (p.errors.length) console.log("ERR after " + name + ": " + p.errors.splice(0).join("\n  "));
}
const click = (p, sel) => p.evaluate((s) => { const e = document.querySelector(s); if (!e) throw new Error("no " + s); e.click(); }, sel);
const step = async (name, fn) => { try { await fn(); } catch (e) { console.log("STEP FAIL " + name + ": " + e.message.split("\n")[0]); } };
(async () => {
  const browser = await L.launch();
  const ctxLogin = await L.userContext(browser, "L", { mobile: true });
  await ctxLogin.goto(L.BASE + "/login.html"); await shot(ctxLogin, "login");
  await ctxLogin.click("#switch-mode-btn"); await shot(ctxLogin, "register-step1");
  await ctxLogin.fill("#username-input", "x"); await ctxLogin.click("#auth-submit"); await shot(ctxLogin, "register-bad-username");
  const A = await L.userContext(browser, "A", { mobile: true });
  const B = await L.userContext(browser, "B", { mobile: true });
  await L.register(A, "ann" + tag, "Анна");
  await L.register(B, "bob" + tag, "Боб");
  await B.fill("#search-input", "ann" + tag); await B.waitForTimeout(1500);
  await B.evaluate(() => [...document.querySelectorAll("#search-result button")].find((x) => /Написать/.test(x.textContent))?.click());
  await B.waitForTimeout(1500);
  await H.send(B, "Привет");
  await A.waitForTimeout(1500);
  await H.openChatByName(A, "Боб").catch(() => H.openChatByName(A, "bob"));
  await step("pin", async () => { await H.msgMenu(A, "Привет", "Закрепить"); await A.waitForTimeout(600); await A.evaluate(() => [...document.querySelectorAll(".ctx-menu .ctx-item")].find((x) => /Закрепить|У меня|Для всех/.test(x.textContent))?.click()); await shot(A, "pinned-bar"); });
  await step("poll", async () => {
    await H.attach(A, "Опрос"); await A.fill("#poll-question", "Куда пойдём?");
    const inputs = await A.$$("#poll-options input"); await inputs[0].fill("Кино"); await inputs[1].fill("Парк");
    await click(A, "#poll-create"); await A.waitForTimeout(1500); await shot(A, "poll-msg");
  });
  await step("checklist", async () => { await H.attach(A, "Список"); await shot(A, "checklist-overlay"); await A.keyboard.press("Escape"); });
  await step("contact", async () => { await H.attach(A, "Контакт"); await shot(A, "contact-pick"); await A.keyboard.press("Escape"); await A.waitForTimeout(500); });
  await step("dice", async () => { await A.fill("#msg-input", "🎲"); await A.press("#msg-input", "Enter"); await A.waitForTimeout(2500); await shot(A, "dice"); });
  await step("block", async () => { await click(A, "#chat-menu-btn"); await A.waitForTimeout(300); await click(A, "#chat-menu-block-btn"); await A.waitForTimeout(600); await A.evaluate(() => [...document.querySelectorAll(".ctx-menu .ctx-item, .confirm-panel button, button")].find((x) => /^Заблокировать$/.test(x.textContent.trim()))?.click()); await shot(A, "blocked"); await click(A, "#blocked-bar-unblock").catch(() => {}); await A.waitForTimeout(800); });
  await step("call", async () => { await click(A, "#call-audio-btn"); await A.waitForTimeout(1500); await shot(A, "call-out"); await shot(B, "call-in"); await B.evaluate(() => document.querySelector("#call-overlay .call-accept, [data-act=accept], .call-controls-incoming button:last-child")?.click()); await A.waitForTimeout(2500); await shot(A, "call-active"); await A.evaluate(() => document.querySelector("#call-overlay .call-end")?.click()); await A.waitForTimeout(1500); await shot(A, "call-ended"); });
  await H.backToList(A);
  await step("folder", async () => { await A.evaluate(() => document.querySelector("#folder-tabs .folder-add")?.click()); await shot(A, "folder-editor"); await A.keyboard.press("Escape"); await A.waitForTimeout(500); });
  await step("archive", async () => { await A.evaluate(() => { const r = [...document.querySelectorAll("#chat-list .room-item")].pop(); r.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, clientX: 200, clientY: 500 })); }); await A.waitForTimeout(500); await H.ctxItem(A, "В архив"); await shot(A, "archived"); await A.evaluate(() => document.querySelector(".archive-row, .room-item.archive")?.click()); await shot(A, "archive-open"); });
  // English
  await step("english", async () => {
    await A.evaluate(() => document.querySelector('#tabbar .tab[data-tab="settings"]').click()); await A.waitForTimeout(600);
    await A.evaluate(() => [...document.querySelectorAll("#settings-menu [data-tab]")].find((b) => b.dataset.tab === "language" || /Язык/.test(b.textContent))?.click()); await A.waitForTimeout(500);
    await A.evaluate(() => [...document.querySelectorAll("button, label")].find((b) => b.textContent.trim() === "English")?.click());
    await A.waitForTimeout(300); await click(A, "#settings-language-save").catch(() => {}); await A.waitForTimeout(1200);
    await shot(A, "en-settings");
    await A.evaluate(() => document.querySelector('#tabbar .tab[data-tab="chats"]').click()); await shot(A, "en-list");
    await A.evaluate(() => [...document.querySelectorAll("#chat-list .room-item")].pop()?.click()); await shot(A, "en-chat");
    await click(A, "#chat-menu-btn"); await shot(A, "en-chat-menu"); await A.keyboard.press("Escape");
    await click(A, "#attach-btn"); await shot(A, "en-attach"); await A.keyboard.press("Escape");
  });
  await step("lock", async () => {
    await H.backToList(A);
    await A.evaluate(() => document.querySelector('#tabbar .tab[data-tab="settings"]').click()); await A.waitForTimeout(600);
    await A.evaluate(() => [...document.querySelectorAll("#settings-menu [data-tab]")].find((b) => b.dataset.tab === "security")?.click()); await A.waitForTimeout(500);
    await click(A, "#lock-enabled"); await shot(A, "lock-setup");
  });
  console.log("done");
  await browser.close();
})().catch((e) => { console.error("FATAL", e); process.exit(1); });
