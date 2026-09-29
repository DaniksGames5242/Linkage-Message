const L = require("../lib.cjs");
const H = require("../helpers.cjs");
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
const step = async (name, fn) => { try { await fn(); } catch (e) { console.log("STEP FAIL " + name + ": " + e.message.split("\n")[0]); } };
(async () => {
  const browser = await L.launch();
  const A = await L.userContext(browser, "A", { mobile: true });
  const B = await L.userContext(browser, "B");
  await L.register(A, "ann" + tag, "Анна");
  await L.register(B, "bob" + tag, "Боб");
  // B opens chat with A via search
  await B.fill("#search-input", "ann" + tag);
  await B.waitForTimeout(1500);
  await B.evaluate(() => { const b = [...document.querySelectorAll("#search-result button")].find((x) => /Написать/.test(x.textContent)); b && b.click(); });
  await B.waitForTimeout(1500);
  for (const t of ["Первое", "Второе сообщение", "Третье https://github.com/test"]) await H.send(B, t);
  await A.waitForTimeout(2000);
  await shot(A, "list-unread");
  await H.openChatByName(A, "bob" + tag).catch(() => H.openChatByName(A, "Боб"));
  await shot(A, "chat-from-stranger");
  await step("reply", async () => { await H.msgMenu(A, "Второе", "Ответить"); await A.fill("#msg-input", "Отвечаю"); await shot(A, "reply-preview"); await A.press("#msg-input", "Enter"); await shot(A, "reply-sent"); });
  await step("select", async () => { await H.msgMenu(A, "Первое", "Выбрать"); await A.evaluate(() => [...document.querySelectorAll(".msg-row")].find((r) => r.textContent.includes("Третье"))?.click()); await shot(A, "select-mode"); await A.keyboard.press("Escape"); });
  await step("forward", async () => { await H.msgMenu(A, "Третье", "Переслать"); await shot(A, "forward-overlay"); await A.keyboard.press("Escape"); await A.waitForTimeout(500); });
  await step("poll", async () => { await H.attach(A, "Опрос"); await shot(A, "poll-overlay"); await A.keyboard.press("Escape"); await A.waitForTimeout(500); });
  await step("schedule", async () => { await A.fill("#msg-input", "позже"); await A.evaluate(() => document.getElementById("send-btn").dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, clientX: 350, clientY: 800 }))); await shot(A, "send-menu"); await A.keyboard.press("Escape"); await A.fill("#msg-input", ""); });
  await step("photo", async () => { await A.setInputFiles("#attach-input", path.join(__dirname, "..", "fixtures", "pic.png")); await shot(A, "media-overlay"); await click(A, "#media-send"); await A.waitForTimeout(2500); await shot(A, "photo-sent"); });
  await step("lightbox", async () => { await A.evaluate(() => [...document.querySelectorAll(".msg-row img.msg-image")].pop().click()); await shot(A, "lightbox"); await A.keyboard.press("Escape"); await A.waitForTimeout(500); });
  await step("voice", async () => {
    const box = await A.locator("#rec-btn").boundingBox();
    await A.mouse.move(box.x + box.width / 2, box.y + box.height / 2); await A.mouse.down(); await A.waitForTimeout(1500); await shot(A, "recording"); await A.mouse.up(); await A.waitForTimeout(2500); await shot(A, "voice-sent");
  });
  await step("wall", async () => { await click(A, "#chat-menu-btn"); await A.waitForTimeout(300); await click(A, "#chat-menu-wall-btn"); await shot(A, "wallpaper"); await A.keyboard.press("Escape"); await A.waitForTimeout(500); });
  await step("autodel", async () => { await click(A, "#chat-menu-btn"); await A.waitForTimeout(300); await click(A, "#chat-menu-autodelete-btn"); await shot(A, "autodelete-menu"); await A.keyboard.press("Escape"); await A.waitForTimeout(500); });
  await H.backToList(A);
  // group
  await step("group", async () => {
    await click(A, "#fab-new-chat"); await A.waitForTimeout(400); await click(A, "#new-chat-group-open-btn"); await A.waitForTimeout(600);
    await shot(A, "group-create");
    await A.fill("#new-chat-group-name-input", "Тестовая группа");
    await A.evaluate(() => { const c = document.querySelector("#new-chat-group-member-result input[type=checkbox], #new-chat-group-member-result .pick-row, #new-chat-group-member-result button"); c && c.click(); });
    await A.waitForTimeout(400); await shot(A, "group-members-picked");
    await click(A, "#new-chat-group-create-btn"); await A.waitForTimeout(2500); await shot(A, "group-open");
    await H.send(A, "Всем привет @bob" + tag);
    await click(A, "#chat-header-info"); await shot(A, "group-profile"); await A.keyboard.press("Escape"); await A.waitForTimeout(500);
    await H.backToList(A);
  });
  await step("channel", async () => {
    await click(A, "#fab-new-chat"); await A.waitForTimeout(400); await click(A, "#new-chat-channel-open-btn"); await A.waitForTimeout(600);
    await A.fill("#new-chat-group-name-input", "Мой канал");
    await click(A, "#new-chat-group-create-btn"); await A.waitForTimeout(2500);
    await H.send(A, "Пост в канале");
    await shot(A, "channel-open");
    await H.backToList(A);
  });
  await step("story", async () => {
    await A.setInputFiles("#story-add-input", path.join(__dirname, "..", "fixtures", "pic.png")); await A.waitForTimeout(2500); await shot(A, "story-posted");
    await A.evaluate(() => document.querySelector("#stories-strip .story-bubble .avatar, #stories-strip .story-bubble")?.click()); await shot(A, "story-view"); await A.keyboard.press("Escape"); await A.waitForTimeout(600);
  });
  await shot(A, "list-final");
  await step("search", async () => { await A.fill("#search-input", "bob"); await A.waitForTimeout(1500); await shot(A, "global-search"); await A.fill("#search-input", ""); });
  await step("swipe-archive", async () => {
    const r = await A.evaluate(() => { const e = [...document.querySelectorAll("#chat-list .room-item")].pop().getBoundingClientRect(); return { x: e.x, y: e.y, w: e.width, h: e.height }; });
    await A.mouse.move(r.x + r.w - 30, r.y + r.h / 2); await A.mouse.down(); await A.mouse.move(r.x + r.w - 120, r.y + r.h / 2, { steps: 5 }); await shot(A, "swipe-mid"); await A.mouse.up(); await A.waitForTimeout(800);
  });
  await step("room-ctx", async () => { await A.evaluate(() => [...document.querySelectorAll("#chat-list .room-item")].pop()?.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, clientX: 200, clientY: 500 }))); await shot(A, "room-ctx"); await A.keyboard.press("Escape"); });
  // B desktop
  await B.waitForTimeout(1000);
  await shot(B, "desktop-chat");
  await step("B group", async () => { await H.openChatByName(B, "Тестовая группа"); await shot(B, "desktop-group"); });
  await step("B settings", async () => { await B.evaluate(() => document.querySelector('#tabbar .tab[data-tab="settings"]').click()); await shot(B, "desktop-settings"); });
  console.log("B errors:", B.errors.join("\n"));
  await browser.close();
})().catch((e) => { console.error("FATAL", e); process.exit(1); });
