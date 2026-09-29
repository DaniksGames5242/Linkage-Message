// English UI: lists every visible piece of Russian left on each screen.
const L = require("../lib.cjs");
const H = require("../helpers.cjs");
const click = (p, sel) => p.evaluate((s) => document.querySelector(s)?.click(), sel);
const found = new Map();
async function scan(p, where) {
  await p.waitForTimeout(700);
  const hits = await p.evaluate(() => {
    const skip = ".bubble, .room-name, .room-last, #chat-title, #me-name, #profile-view-name, .msg-sender, .story-bubble-label, .pick-item-name, .search-result-name, .mention-name, .contact-card-name, .member-name, .call-name, .call-pill-name, .msg-reply-quote, .pinned-bar-text, .reply-preview-text, input, textarea";
    const out = new Set();
    const vis = (el) => { const r = el.getBoundingClientRect(); const cs = getComputedStyle(el); return r.width > 0 && r.height > 0 && cs.visibility !== "hidden" && cs.opacity !== "0" && !el.closest(".hidden"); };
    const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let n;
    while ((n = w.nextNode())) {
      const t = n.textContent.trim();
      if (!t || !/[А-Яа-яЁё]/.test(t)) continue;
      const el = n.parentElement;
      if (!el || el.closest(skip) || !vis(el)) continue;
      out.add(t.slice(0, 80));
    }
    document.querySelectorAll("[placeholder],[title],[aria-label]").forEach((el) => {
      if (!vis(el) || el.closest(".bubble")) return;
      for (const a of ["placeholder", "title", "aria-label"]) { const v = el.getAttribute(a); if (v && /[А-Яа-яЁё]/.test(v)) out.add("@" + a + ": " + v.slice(0, 80)); }
    });
    return [...out];
  });
  for (const h of hits) if (!found.has(h)) found.set(h, where);
}
(async () => {
  const tag = Date.now().toString(36).slice(-5);
  const browser = await L.launch();
  const A = await L.userContext(browser, "A", { mobile: true });
  const B = await L.userContext(browser, "B");
  await L.register(A, "ea" + tag, "Anna");
  await L.register(B, "eb" + tag, "Bob");
  await B.fill("#search-input", "ea" + tag); await B.waitForTimeout(1500);
  await B.evaluate(() => [...document.querySelectorAll("#search-result button")].find((x) => /Написать/.test(x.textContent))?.click());
  await B.waitForTimeout(1500);
  await H.send(B, "hello");
  await A.evaluate(() => document.querySelector('#tabbar .tab[data-tab="settings"]').click()); await A.waitForTimeout(600);
  await A.evaluate(() => [...document.querySelectorAll("#settings-menu [data-tab]")].find((b) => b.dataset.tab === "language")?.click()); await A.waitForTimeout(500);
  await A.evaluate(() => [...document.querySelectorAll("button, label")].find((b) => b.textContent.trim() === "English")?.click());
  await click(A, "#settings-language-save"); await A.waitForTimeout(1500);
  await A.evaluate(() => document.getElementById("settings-back-btn")?.click()); await A.waitForTimeout(500);
  const secs = await A.evaluate(() => [...document.querySelectorAll("#settings-menu [data-tab]")].map((b) => b.dataset.tab));
  for (const s of secs) {
    await A.evaluate((s) => document.querySelector(`#settings-menu [data-tab="${s}"]`).click(), s);
    await A.waitForTimeout(500);
    for (let y = 0; y < 4; y++) { await scan(A, "settings/" + s); await A.evaluate(() => document.querySelectorAll(".settings-body, .settings-tab-panel:not(.hidden)").forEach((e) => (e.scrollTop += 600))); }
    await A.evaluate(() => document.getElementById("settings-back-btn")?.click()); await A.waitForTimeout(500);
  }
  await A.evaluate(() => document.querySelector('#tabbar .tab[data-tab="chats"]').click()); await A.waitForTimeout(800);
  await scan(A, "list");
  await click(A, "#fab-new-chat"); await scan(A, "new-chat");
  await click(A, "#new-chat-group-open-btn"); await scan(A, "new-group"); await A.keyboard.press("Escape"); await A.waitForTimeout(500);
  await A.evaluate(() => [...document.querySelectorAll("#chat-list .room-item")].pop().dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, clientX: 100, clientY: 500 }))); await scan(A, "room-menu"); await A.keyboard.press("Escape");
  await A.evaluate(() => [...document.querySelectorAll("#chat-list .room-item")].pop().click()); await A.waitForTimeout(1200);
  await scan(A, "chat");
  await click(A, "#chat-menu-btn"); await scan(A, "chat-menu"); await A.keyboard.press("Escape"); await A.waitForTimeout(300);
  await click(A, "#attach-btn"); await scan(A, "attach"); await A.keyboard.press("Escape"); await A.waitForTimeout(300);
  await H.msgMenu(A, "hello", null); await scan(A, "msg-menu"); await A.keyboard.press("Escape"); await A.waitForTimeout(300);
  await click(A, "#emoji-btn"); await scan(A, "emoji"); await click(A, "#emoji-btn");
  await click(A, "#chat-header-info"); await scan(A, "profile-view"); await A.keyboard.press("Escape"); await A.waitForTimeout(400);
  await H.attach(A, "Poll").catch(() => {}); await scan(A, "poll"); await A.keyboard.press("Escape"); await A.waitForTimeout(400);
  await H.attach(A, "Checklist").catch(() => {}); await scan(A, "checklist"); await A.keyboard.press("Escape"); await A.waitForTimeout(400);
  await H.attach(A, "Contact").catch(() => {}); await scan(A, "contact"); await A.keyboard.press("Escape"); await A.waitForTimeout(400);
  await A.fill("#msg-input", "x"); await A.evaluate(() => document.getElementById("send-btn").dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, clientX: 300, clientY: 700 }))); await scan(A, "send-menu");
  await A.evaluate(() => [...document.querySelectorAll(".ctx-menu .ctx-item")].pop()?.click()); await scan(A, "schedule"); await A.keyboard.press("Escape"); await A.fill("#msg-input", "");
  await click(A, "#chat-menu-btn"); await A.waitForTimeout(300); await click(A, "#chat-menu-wall-btn"); await scan(A, "wallpaper"); await A.keyboard.press("Escape"); await A.waitForTimeout(300);
  await click(A, "#chat-menu-btn"); await A.waitForTimeout(300); await click(A, "#chat-menu-autodelete-btn"); await scan(A, "autodelete"); await A.keyboard.press("Escape");
  await click(A, "#chat-search-btn"); await scan(A, "chat-search"); await A.keyboard.press("Escape");
  const by = {};
  for (const [t, w] of found) (by[w] = by[w] || []).push(t);
  console.log(JSON.stringify(by, null, 1));
  console.log("errors", A.errors.join("\n"));
  await browser.close();
})().catch((e) => { console.error("FATAL", e); process.exit(1); });
