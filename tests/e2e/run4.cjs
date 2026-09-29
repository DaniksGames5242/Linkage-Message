const L = require("./lib.cjs");
const H = require("./helpers.cjs");
const section = (s) => console.log("\n== " + s);
async function startChat(P, username, expectName) {
  await P.fill("#search-input", username);
  await L.until(P, (u) => [...document.querySelectorAll("#search-result .person-row")].some((r) => r.textContent.includes("@" + u)), username);
  await P.evaluate((u) => [...document.querySelectorAll("#search-result .person-row")].find((r) => r.textContent.includes("@" + u)).querySelector('[data-act="main"]').click(), username);
  await L.until(P, (n) => document.getElementById("chat-title")?.textContent.includes(n), expectName);
}
async function hold(P, sel, ms) {
  const box = await P.locator(sel).boundingBox();
  await P.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await P.mouse.down();
  await P.waitForTimeout(ms);
  await P.mouse.up();
}
async function adminPatch(docPath, fields) {
  const toV = (v) => (typeof v === "number" ? { integerValue: String(v) } : { stringValue: String(v) });
  const mask = Object.keys(fields).map((k) => "updateMask.fieldPaths=" + k).join("&");
  const r = await fetch(`http://127.0.0.1:8088/v1/projects/linkage-massege/databases/(default)/documents/${docPath}?${mask}`, {
    method: "PATCH", headers: { Authorization: "Bearer owner", "Content-Type": "application/json" },
    body: JSON.stringify({ fields: Object.fromEntries(Object.entries(fields).map(([k, v]) => [k, toV(v)])) }),
  });
  if (!r.ok) throw new Error("patch " + r.status + " " + (await r.text()).slice(0, 200));
}
(async () => {
  const browser = await L.launch();
  const tag = Date.now().toString(36).slice(-4);
  const A = await L.userContext(browser, "A");
  const B = await L.userContext(browser, "B");
  const ua = "anna_" + tag, ub = "boris_" + tag;
  section("setup");
  await L.check("register + chat", async () => {
    await L.register(A, ua, "Анна"); await L.register(B, ub, "Борис");
    await startChat(A, ub, "Борис"); await H.send(A, "начали");
    await L.until(B, () => [...document.querySelectorAll("#chat-list .room-name")].some((n) => n.textContent.includes("Анна")), null, 12000);
    await H.openChatByName(B, "Анна");
  });

  section("voice & video notes");
  await L.check("voice message (hold to record) arrives encrypted and playable", async () => {
    const before = L.uploads.size;
    await hold(A, "#rec-btn", 2200);
    await L.until(B, () => [...document.querySelectorAll(".msg-row:not(.me) .voice-player, .msg-row:not(.me) .voice-bubble")].length > 0, null, 15000);
    const up = [...L.uploads.values()].slice(before);
    if (!up.length) throw new Error("no upload");
    if (up.some((u) => /^\x1aE\xdf\xa3/.test(u.data.slice(0, 4).toString("latin1")))) throw new Error("voice uploaded as plain webm");
    const src = await B.evaluate(() => { const r = [...document.querySelectorAll(".msg-row:not(.me)")].filter((x) => x._msg?.voiceUrl).pop(); return r ? r._msg.voiceUrl : "no voice row"; });
    if (!/^blob:/.test(src)) throw new Error("voice src " + src);
  });
  await L.check("round video note (tap to switch, hold) arrives", async () => {
    await A.click("#rec-btn");
    await A.waitForTimeout(900);
    const mode = await A.evaluate(() => document.getElementById("rec-btn").dataset.mode);
    if (mode !== "video") throw new Error("mode " + mode);
    await hold(A, "#rec-btn", 2500);
    await A.waitForTimeout(3000);
    console.log("   A last rows:", await A.evaluate(() => [...document.querySelectorAll(".msg-row")].slice(-2).map((r) => r.className + " " + (r.querySelector(".vnote") ? "vnote" : "") + " " + (r._msg ? JSON.stringify({ v: r._msg.videoNoteUrl?.slice(0, 40), mk: !!r._msg.mediaKey }) : "")).join(" || ")));
    console.log("   B last rows:", await B.evaluate(() => [...document.querySelectorAll(".msg-row")].slice(-2).map((r) => r.className + " " + (r.querySelector(".vnote video") ? "vnote:" + r.querySelector(".vnote video").src.slice(0, 30) : "") + " " + (r._msg ? JSON.stringify({ v: r._msg.videoNoteUrl?.slice(0, 40), mk: !!r._msg.mediaKey }) : "")).join(" || ")));
    await L.until(B, () => [...document.querySelectorAll(".msg-row:not(.me) .vnote video")].some((v) => v.src.startsWith("blob:")), null, 20000);
  });

  section("settings visible to others");
  await L.check("A renames herself, B sees the new name", async () => {
    await A.evaluate(() => document.querySelector('.tab[data-tab="profile"]').click());
    await A.waitForTimeout(900);
    await A.fill("#settings-displayname", "Анна К.");
    await A.evaluate(() => document.getElementById("settings-save-check").click());
    await A.waitForTimeout(1500);
    await B.reload(); await B.waitForSelector("#app:not(.hidden)"); await B.waitForTimeout(2500);
    await L.until(B, () => [...document.querySelectorAll("#chat-list .room-name")].some((n) => n.textContent.includes("Анна К.")), null, 10000);
    await A.evaluate(() => document.querySelector('.tab[data-tab="chats"]').click());
  });
  await L.check("A hides last seen from everyone, B can't see it", async () => {
    await A.evaluate(() => document.querySelector('.tab[data-tab="settings"]').click());
    await A.waitForTimeout(700);
    await A.evaluate(() => document.querySelector('.settings-menu-item[data-section="privacy"]').click());
    await A.waitForTimeout(700);
    await A.evaluate(() => { const s = document.getElementById("privacy-lastseen"); s.value = "nobody"; s.dispatchEvent(new Event("change", { bubbles: true })); });
    await A.evaluate(() => document.getElementById("settings-save-check").click());
    await A.waitForTimeout(1500);
    await A.evaluate(() => document.querySelector('.tab[data-tab="chats"]').click());
    await H.openChatByName(B, "Анна");
    await B.waitForTimeout(1500);
    const sub = await B.evaluate(() => document.getElementById("chat-sub").textContent);
    if (/в сети|был/.test(sub)) throw new Error("B still sees: " + sub);
  });

  section("scheduled, auto-delete, archive, unread");
  await L.check("scheduled message: hidden until due, then delivered", async () => {
    await H.openChatByName(A, "Борис");
    await A.fill("#msg-input", "по расписанию");
    await A.evaluate(() => document.getElementById("send-btn").dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, clientX: 900, clientY: 800 })));
    await A.waitForTimeout(500);
    await H.ctxItem(A, "Отправить позже");
    await A.waitForTimeout(700);
    const due = await A.evaluate(() => {
      const d = new Date(Date.now() + 70000); d.setSeconds(0, 0); if (d.getTime() < Date.now() + 35000) d.setMinutes(d.getMinutes() + 1);
      const p = (n) => String(n).padStart(2, "0");
      document.getElementById("schedule-input").value = `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
      document.getElementById("schedule-confirm").click();
      return d.getTime();
    });
    await A.waitForTimeout(2000);
    const early = await B.evaluate(() => [...document.querySelectorAll(".msg-row .bubble")].some((b) => b.textContent.includes("по расписанию")));
    if (early) throw new Error("B sees it before it's due");
    const waitMs = due - Date.now() + 15000;
    await H.seeText(B, "по расписанию", false, Math.max(20000, waitMs));
  });
  await L.check("auto-delete: a message disappears for both after its timer", async () => {
    const me = await A.evaluate(async () => (await import("/firebase.js")).auth.currentUser.uid);
    const chats = await L.adminQuery("chats");
    const chat = chats.find((c) => (c.participants || []).includes(me));
    await adminPatch(chat.path, { autoDelete: 4 });
    await A.waitForTimeout(1500);
    await H.send(A, "самоуничтожусь");
    await H.seeText(B, "самоуничтожусь", false);
    await H.gone(A, "самоуничтожусь", 12000);
    await H.gone(B, "самоуничтожусь", 12000);
    await adminPatch(chat.path, { autoDelete: 0 });
  });
  await L.check("mark as unread shows a dot, opening clears it", async () => {
    await B.evaluate(() => [...document.querySelectorAll("#chat-list .room-item")].find((r) => r.textContent.includes("Избранное")).click());
    await B.waitForTimeout(800);
    await B.evaluate(() => [...document.querySelectorAll("#chat-list .room-item")].find((r) => r.textContent.includes("Анна")).dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, clientX: 200, clientY: 200 })));
    await B.waitForTimeout(400);
    await H.ctxItem(B, "Пометить как непрочитанное");
    await L.until(B, () => [...document.querySelectorAll("#chat-list .room-item")].some((r) => r.textContent.includes("Анна") && r.querySelector(".unread-dot")));
    await H.openChatByName(B, "Анна");
    await B.evaluate(() => [...document.querySelectorAll("#chat-list .room-item")].find((r) => r.textContent.includes("Избранное")).click());
    await L.until(B, () => ![...document.querySelectorAll("#chat-list .room-item")].some((r) => r.textContent.includes("Анна") && r.querySelector(".unread-dot")));
  });
  await L.check("archive moves the chat into Архив", async () => {
    await B.evaluate(() => [...document.querySelectorAll("#chat-list .room-item")].find((r) => r.textContent.includes("Анна")).dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, clientX: 200, clientY: 200 })));
    await B.waitForTimeout(400);
    await H.ctxItem(B, "В архив");
    await L.until(B, () => ![...document.querySelectorAll("#chat-list .room-item:not(.pinned-item) .room-name")].some((n) => n.textContent.includes("Анна")) && [...document.querySelectorAll("#chat-list .room-item")].some((r) => r.textContent.includes("Архив")));
  });

  section("blocking");
  await L.check("B blocks A → A's message is refused", async () => {
    await B.evaluate(() => [...document.querySelectorAll("#chat-list .room-item")].find((r) => r.textContent.includes("Архив")).click());
    await B.waitForTimeout(600);
    await H.openChatByName(B, "Анна");
    await B.evaluate(() => document.getElementById("chat-menu-btn").click());
    await B.waitForTimeout(400);
    B.once("dialog", (d) => d.accept());
    await B.evaluate(() => document.getElementById("chat-menu-block-btn").click());
    await B.waitForTimeout(1500);
    await A.fill("#msg-input", "ты меня слышишь?");
    await A.press("#msg-input", "Enter");
    await A.waitForTimeout(2500);
    const toast = await A.evaluate(() => [...document.querySelectorAll(".toast")].map((t) => t.textContent).join(" | "));
    if (!/не доставлено|ограничил/i.test(toast)) throw new Error("no refusal toast: " + toast);
    await B.waitForTimeout(500);
    const got = await B.evaluate(() => [...document.querySelectorAll(".msg-row .bubble")].some((b) => b.textContent.includes("ты меня слышишь")));
    if (got) throw new Error("blocked message delivered");
  });

  section("english interface");
  await L.check("English UI: no Russian left on main screens", async () => {
    await A.evaluate(() => document.querySelector('.tab[data-tab="settings"]').click());
    await A.waitForTimeout(700);
    await A.evaluate(() => document.querySelector('.settings-menu-item[data-section="language"]').click());
    await A.waitForTimeout(600);
    await A.evaluate(() => { const s = document.getElementById("settings-language"); s.value = "en"; s.dispatchEvent(new Event("change", { bubbles: true })); });
    await A.evaluate(() => document.getElementById("settings-save-check").click());
    await A.waitForTimeout(2500);
    const scan = async (label) => A.evaluate((label) => {
      const skip = ".avatar, option, .seg button, .segmented-opt, .segmented button, .bubble, .room-name, .room-last, #chat-title, #me-name, .pick-item-name, .msg-sender, .story-bubble, .mention-name, input, textarea, .msg-reply-quote, #profile-view-name, .pinned-bar-text, .search-result-name, .poll-q, .poll-label";
      const out = new Set();
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      while (walker.nextNode()) {
        const n = walker.currentNode; const el = n.parentElement;
        if (!el || el.closest(skip) || !/[а-яё]/i.test(n.textContent)) continue;
        if (!el.getClientRects().length || getComputedStyle(el).visibility === "hidden") continue;
        if (el.closest(".hidden")) continue;
        out.add(label + ": " + n.textContent.trim().slice(0, 60));
      }
      document.querySelectorAll("[placeholder],[title],[aria-label]").forEach((e) => {
        if (e.closest(".hidden") || !e.getClientRects().length) return;
        ["placeholder", "title", "aria-label"].forEach((a) => { const v = e.getAttribute(a); if (v && /[а-яё]/i.test(v)) out.add(label + " @" + a + ": " + v.slice(0, 60)); });
      });
      return [...out];
    }, label);
    let found = [];
    found.push(...(await scan("settings")));
    for (const sec of ["profile", "privacy", "security", "notifications", "chats", "data", "language", "sessions"]) {
      await A.evaluate((s) => document.querySelector(`.settings-menu-item[data-section="${s}"]`)?.click(), sec); await A.waitForTimeout(700);
      found.push(...(await scan(sec)));
      await A.evaluate(() => document.getElementById("settings-back-btn").click()); await A.waitForTimeout(600);
    }
    await A.evaluate(() => document.querySelector('.tab[data-tab="chats"]').click()); await A.waitForTimeout(800);
    found.push(...(await scan("list")));
    await H.openChatByName(A, "Борис");
    found.push(...(await scan("chat")));
    await A.evaluate(() => document.getElementById("attach-btn").click()); await A.waitForTimeout(500);
    found.push(...(await scan("attach")));
    await A.keyboard.press("Escape");
    await A.evaluate(() => document.getElementById("chat-header-info").click()); await A.waitForTimeout(900);
    found.push(...(await scan("profile view")));
    await A.evaluate(() => document.getElementById("profile-view-close-btn").click());
    found = [...new Set(found)];
    if (found.length) { console.log("UNTRANSLATED\n" + found.join("\n")); throw new Error(found.length + " untranslated"); }
  });

  console.log("\nerrors:\n" + [...A.errors, ...B.errors].join("\n"));
  console.log(`\n${L.passed()} passed, ${L.failures.length} failed`);
  await browser.close();
  process.exitCode = L.failures.length ? 1 : 0;
})();
