// Exploratory walk: screenshots of every screen on a phone-sized viewport + console errors.
const L = require("./lib.cjs");
const H = require("./helpers.cjs");
const path = require("path");
const OUT = process.env.OUT || "/tmp/shots";
const tag = Date.now().toString(36).slice(-5);
let n = 0;
async function shot(p, name) {
  await p.waitForTimeout(700);
  await p.screenshot({ path: path.join(OUT, String(++n).padStart(2, "0") + "-" + name + ".png") });
  if (p.errors.length) console.log("ERR after " + name + ": " + p.errors.splice(0).join("\n  "));
}
const click = (p, sel) => p.evaluate((s) => { const e = document.querySelector(s); if (!e) throw new Error("no " + s); e.click(); }, sel);
(async () => {
  const browser = await L.launch();
  const A = await L.userContext(browser, "A", { mobile: true });
  const B = await L.userContext(browser, "B");
  await L.register(A, "ann" + tag, "Анна");
  await L.register(B, "bob" + tag, "Боб");
  await shot(A, "list-empty");
  // A adds B
  await click(A, "#fab-new-chat");
  await shot(A, "newchat-menu");
  await click(A, "#new-chat-contact-btn");
  await A.fill("#new-chat-username-input", "bob" + tag);
  await A.waitForTimeout(1500);
  await shot(A, "newchat-contact-result");
  await A.evaluate(() => { const i = document.querySelector("#new-chat-contact-result input"); if (i) { i.value = "Боб"; i.dispatchEvent(new Event("input", { bubbles: true })); } });
  await A.evaluate(() => { const b = [...document.querySelectorAll("#new-chat-contact-result button")].find((x) => /Написать/.test(x.textContent)); b && b.click(); });
  await A.waitForTimeout(1500);
  await shot(A, "chat-open-empty");
  await H.send(A, "Привет! Как дела? example.com @bob" + tag + " #тест");
  await A.waitForTimeout(1500);
  await H.openChatByName(B, "Анна").catch(() => {});
  await H.send(B, "Нормально, а у тебя? Это длинное сообщение чтобы проверить перенос строк и ширину пузыря на телефоне, насколько хорошо оно смотрится.");
  await H.send(B, "👍");
  await H.send(B, "**жирный** _курсив_ `код` ||спойлер||");
  await A.waitForTimeout(2000);
  await shot(A, "chat-msgs");
  await H.msgMenu(A, "Нормально", null);
  await shot(A, "msg-ctx");
  await A.keyboard.press("Escape"); await A.waitForTimeout(400);
  await click(A, "#attach-btn");
  await shot(A, "attach-menu");
  await A.keyboard.press("Escape"); await A.waitForTimeout(400);
  await click(A, "#emoji-btn");
  await shot(A, "emoji-picker");
  await click(A, "#emoji-btn");
  await click(A, "#chat-menu-btn");
  await shot(A, "chat-menu");
  await A.keyboard.press("Escape"); await A.waitForTimeout(400);
  await click(A, "#chat-header-info");
  await shot(A, "profile-view");
  await click(A, "#profile-view-close-btn");
  await A.waitForTimeout(500);
  await click(A, "#chat-search-btn").catch(() => click(A, "#chat-menu-search-btn"));
  await A.fill("#chat-search-input", "дела");
  await shot(A, "chat-search");
  await click(A, "#chat-search-close");
  await A.fill("#msg-input", "Черновик с текстом");
  await shot(A, "composer-text");
  await A.fill("#msg-input", "");
  await H.backToList(A);
  await shot(A, "list-with-chat");
  // tabs
  const tabs = await A.evaluate(() => [...document.querySelectorAll("#tabbar button, #tabbar .tab")].map((b) => b.textContent.trim() || b.id));
  console.log("tabs", tabs);
  for (let i = 0; i < tabs.length; i++) {
    await A.evaluate((i) => [...document.querySelectorAll("#tabbar button, #tabbar .tab")][i].click(), i);
    await shot(A, "tab" + i);
  }
  await A.evaluate(() => [...document.querySelectorAll("#tabbar button, #tabbar .tab")][0].click());
  await A.waitForTimeout(600);
  // settings sections
  await A.evaluate(() => [...document.querySelectorAll("#tabbar button, #tabbar .tab")][1]?.click());
  await A.waitForTimeout(800);
  const secs = await A.evaluate(() => [...document.querySelectorAll("#settings-menu [data-tab], #settings-menu button")].map((b) => b.dataset.tab || b.textContent.trim()));
  console.log("settings sections", secs);
  for (const s of secs) {
    await A.evaluate((s) => { const b = [...document.querySelectorAll("#settings-menu [data-tab], #settings-menu button")].find((x) => (x.dataset.tab || x.textContent.trim()) === s); b.click(); }, s);
    await shot(A, "settings-" + String(s).slice(0, 12).replace(/\W+/g, "_"));
    await click(A, "#settings-back-btn").catch(() => {});
    await A.waitForTimeout(600);
  }
  console.log("B errors:", B.errors.join("\n"));
  await browser.close();
})().catch((e) => { console.error("FATAL", e); process.exit(1); });
