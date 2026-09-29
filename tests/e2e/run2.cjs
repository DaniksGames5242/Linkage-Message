const L = require("./lib.cjs");
const H = require("./helpers.cjs");
const fs = require("fs");
const section = (s) => console.log("\n== " + s);
(async () => {
  const browser = await L.launch();
  const tag = Date.now().toString(36).slice(-4);
  const A = await L.userContext(browser, "A");
  const B = await L.userContext(browser, "B", { mobile: true });
  const ua = "anna_" + tag, ub = "boris_" + tag;
  section("setup");
  await L.check("register A, B", async () => { await L.register(A, ua, "Анна"); await L.register(B, ub, "Борис"); });
  await L.check("A opens chat with B", async () => {
    await A.fill("#search-input", ub);
    await L.until(A, (u) => [...document.querySelectorAll("#search-result .person-row")].some((r) => r.textContent.includes("@" + u)), ub);
    await A.evaluate((u) => [...document.querySelectorAll("#search-result .person-row")].find((r) => r.textContent.includes("@" + u)).querySelector('[data-act="main"]').click(), ub);
    await L.until(A, () => document.getElementById("chat-title")?.textContent.includes("Борис"));
    await H.send(A, "первое сообщение");
  });
  await L.check("B opens chat with A", async () => {
    await L.until(B, () => [...document.querySelectorAll("#chat-list .room-name")].some((n) => n.textContent.includes("Анна")), null, 12000);
    await H.openChatByName(B, "Анна");
    await H.seeText(B, "первое сообщение", false);
  });

  section("messages");
  await L.check("reply shows a quote on both sides", async () => {
    await H.msgMenu(B, "первое сообщение", "Ответить");
    await H.send(B, "это ответ");
    await L.until(A, () => [...document.querySelectorAll(".msg-row:not(.me)")].some((r) => r.textContent.includes("это ответ") && r.querySelector(".msg-reply-quote")?.textContent.includes("первое")), null, 10000);
  });
  await L.check("edit reaches the other side with (ред.)", async () => {
    await H.send(A, "опечатка тут");
    await H.msgMenu(A, "опечатка тут", "Изменить");
    await A.evaluate(() => { const t = document.querySelector(".msg-edit-box textarea"); t.value = "исправлено тут"; });
    await A.evaluate(() => [...document.querySelectorAll(".msg-edit-box button")].find((b) => /Сохран|✓|Save/.test(b.textContent) || b.classList.contains("primary") || b.classList.contains("small-btn") && !b.classList.contains("secondary"))?.click());
    await H.seeText(B, "исправлено тут", false);
    await L.until(B, () => [...document.querySelectorAll(".msg-row:not(.me)")].some((r) => r.textContent.includes("исправлено тут") && r.textContent.includes("ред.")));
  });
  await L.check("reaction appears for the sender", async () => {
    await B.evaluate(() => { const b = [...document.querySelectorAll(".msg-row:not(.me) .bubble")].find((x) => x.textContent.includes("исправлено тут")); b.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, clientX: 200, clientY: 300 })); });
    await B.waitForTimeout(400);
    await B.evaluate(() => document.querySelector(".ctx-reactions button").click());
    await L.until(A, () => [...document.querySelectorAll(".msg-row.me")].some((r) => r.textContent.includes("исправлено тут") && r.querySelector(".msg-reactions, .reaction-chip, .rx")), null, 10000);
  });
  await L.check("delete for everyone removes it on both sides", async () => {
    await H.send(A, "удали меня");
    await H.seeText(B, "удали меня", false);
    await H.msgMenu(A, "удали меня", "Удалить");
    await H.ctxItem(A, "Удалить у всех");
    await H.gone(A, "удали меня");
    await H.gone(B, "удали меня");
  });
  await L.check("delete for me hides only for me", async () => {
    await H.send(A, "скрой у себя");
    await H.seeText(B, "скрой у себя", false);
    await H.msgMenu(B, "скрой у себя", "Удалить");
    await H.ctxItem(B, "Удалить у меня");
    await H.gone(B, "скрой у себя");
    await B.waitForTimeout(1500);
    await H.seeText(A, "скрой у себя", true, 3000);
  });
  await L.check("pin shows the pinned bar for both", async () => {
    await H.msgMenu(A, "первое сообщение", "Закрепить");
    await L.until(B, () => !document.getElementById("pinned-bar").classList.contains("hidden") && document.getElementById("pinned-bar-text").textContent.includes("первое"), null, 10000);
  });
  await L.check("poll: B votes, A sees the result", async () => {
    await H.attach(A, "Опрос");
    await A.fill("#poll-question", "Пицца или суши?");
    const inputs = await A.$$("#poll-options input");
    await inputs[0].fill("Пицца"); await inputs[1].fill("Суши");
    await A.click("#poll-create");
    await L.until(B, () => [...document.querySelectorAll(".poll-q")].some((q) => q.textContent.includes("Пицца или суши")), null, 10000);
    await B.evaluate(() => [...document.querySelectorAll(".poll-opt")].find((o) => o.textContent.includes("Суши")).click());
    // Like Telegram: results stay hidden until you vote yourself; the total counts.
    await L.until(A, () => [...document.querySelectorAll(".poll-total")].some((t) => /1 голос/.test(t.textContent)), null, 10000);
    await A.evaluate(() => [...document.querySelectorAll(".poll-opt")].find((o) => o.textContent.includes("Пицца")).click());
    await L.until(A, () => [...document.querySelectorAll(".poll-opt")].some((o) => o.textContent.includes("Суши") && o.textContent.includes("50%")), null, 10000);
  });
  await L.check("checklist: B ticks an item, A sees it done", async () => {
    await H.attach(A, "Список");
    await A.fill(".cl-title", "Продукты");
    const ins = await A.$$(".cl-items input"); await ins[0].fill("Молоко"); await ins[1].fill("Хлеб");
    await A.click('.modal-card [data-act="send"]');
    await L.until(B, () => [...document.querySelectorAll(".checklist .check-label")].some((l) => l.textContent === "Хлеб"), null, 10000);
    await B.evaluate(() => [...document.querySelectorAll(".checklist .check-row")].find((r) => r.textContent.includes("Хлеб")).click());
    await L.until(A, () => [...document.querySelectorAll(".checklist .check-row.done")].some((r) => r.textContent.includes("Хлеб")), null, 10000);
  });
  await L.check("contact card opens a chat", async () => {
    await H.attach(B, "Контакт");
    await B.waitForTimeout(500);
    await B.evaluate(() => document.querySelector(".cs-list .check-item")?.click());
    await L.until(A, () => !!document.querySelector(".contact-card"), null, 10000);
  });
  await L.check("forward to Saved Messages", async () => {
    await H.msgMenu(B, "первое сообщение", "Переслать");
    await B.evaluate(() => [...document.querySelectorAll("#forward-list .pick-item")].find((p) => p.textContent.includes("Избранное")).click());
    await B.waitForTimeout(1200);
    await B.evaluate(() => document.getElementById("forward-close-btn").click());
    await H.backToList(B);
    await B.evaluate(() => [...document.querySelectorAll("#chat-list .room-item")].find((r) => r.textContent.includes("Избранное")).click());
    await H.seeText(B, "первое сообщение");
    await L.until(B, () => [...document.querySelectorAll(".msg-row")].some((r) => r.textContent.includes("Переслано от")));
    await H.backToList(B);
    await H.openChatByName(B, "Анна");
  });
  await L.check("multi-select delete (2 messages, for everyone)", async () => {
    await H.send(A, "раз-раз");
    await H.send(A, "два-два");
    await H.seeText(B, "два-два", false);
    await H.msgMenu(A, "раз-раз", "Выбрать");
    await A.evaluate(() => [...document.querySelectorAll(".msg-row .bubble")].find((b) => b.textContent.includes("два-два")).click());
    await A.waitForTimeout(300);
    const count = await A.evaluate(() => document.querySelector(".select-count").textContent);
    if (!count.includes("2")) throw new Error("count " + count);
    await A.evaluate(() => document.querySelector('.select-action[data-act="delete"]').dispatchEvent(new MouseEvent("click", { bubbles: true, clientX: 700, clientY: 800 })));
    await A.waitForTimeout(400);
    await H.ctxItem(A, "Удалить у всех");
    await H.gone(B, "раз-раз");
    await H.gone(B, "два-два");
  });

  section("encrypted media");
  await L.check("photo is uploaded encrypted and B sees it decrypted", async () => {
    const before = L.uploads.size;
    await A.setInputFiles("#attach-input", require("path").join(__dirname, "fixtures", "pic.png"));
    await A.waitForTimeout(800);
    await A.evaluate(() => { const b = document.querySelector("#media-send, #media-send-btn, .media-panel button.primary, .media-panel .small-btn:not(.secondary)"); b.click(); });
    await L.until(B, () => [...document.querySelectorAll(".msg-row:not(.me) img.msg-image")].some((i) => i.src.startsWith("blob:") && i.naturalWidth > 0), null, 15000);
    const up = [...L.uploads.values()].slice(before);
    if (!up.length) throw new Error("nothing uploaded");
    if (up.some((u) => u.data.slice(1, 4).toString() === "PNG")) throw new Error("upload is a plain PNG");
  });

  console.log("\nerrors:\n" + [...A.errors, ...B.errors].join("\n"));
  console.log(`\n${L.passed()} passed, ${L.failures.length} failed`);
  await browser.close();
  process.exitCode = L.failures.length ? 1 : 0;
})();
