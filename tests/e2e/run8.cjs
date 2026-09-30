// Extra tools: composer commands, templates, emoji shortcodes, bookmarks, message info, stats, jump to date, note, HTML export, shortcuts.
const L = require("./lib.cjs");
(async () => {
  const browser = await L.launch();
  const tag = Date.now().toString(36).slice(-4);
  const A = await L.userContext(browser, "A");
  const B = await L.userContext(browser, "B");
  const ua = "vera_" + tag, ub = "gleb_" + tag;
  await L.check("A registers", () => L.register(A, ua, "Вера"));
  await L.check("B registers", () => L.register(B, ub, "Глеб"));
  await L.check("A opens chat with B", async () => {
    await A.fill("#search-input", ub);
    await L.until(A, (u) => [...document.querySelectorAll("#search-result .person-row")].some((r) => r.textContent.includes("@" + u)), ub);
    await A.evaluate((u) => [...document.querySelectorAll("#search-result .person-row")].find((r) => r.textContent.includes("@" + u)).querySelector('[data-act="main"]').click(), ub);
    await L.until(A, () => document.getElementById("chat-title")?.textContent.includes("Глеб"));
  });
  const send = async (text) => {
    await A.fill("#msg-input", text);
    await A.press("#msg-input", "Enter");
  };
  const lastMine = () => A.evaluate(() => [...document.querySelectorAll(".msg-row.me .bubble-text")].pop()?.textContent || "");
  const sees = (re) => L.until(A, (s) => new RegExp(s).test([...document.querySelectorAll(".msg-row.me .bubble-text")].pop()?.textContent || ""), re.source);
  const result = (re) => L.until(A, (s) => new RegExp(s).test([...document.querySelectorAll("#messages .cmd-result")].pop()?.textContent || ""), re.source);
  await L.check("emoji search finds Russian words", async () => {
    await A.click("#emoji-btn");
    await A.fill("#emoji-picker .ep-search input", "огонь");
    await L.until(A, () => [...document.querySelectorAll("#emoji-picker .ep-results .emoji-option")].some((b) => b.dataset.emoji === "🔥"));
    await A.fill("#emoji-picker .ep-search input", "");
    await A.click("#emoji-btn");
  });
  await L.check("typing / lists the commands", async () => {
    await A.fill("#msg-input", "/");
    await L.until(A, () => !document.getElementById("cmd-suggest").classList.contains("hidden") && document.querySelectorAll("#cmd-suggest .cmd-item").length > 10);
    await A.fill("#msg-input", "/ro");
    await L.until(A, () => [...document.querySelectorAll("#cmd-suggest .cmd-item")].map((b) => b.dataset.cmd).join() === "roll");
    await A.fill("#msg-input", "");
  });
  await L.check("/calc sends the command, then the result from the system", async () => { await send("/calc 2*(3+4)^2"); await sees(/^\/calc 2\*\(3\+4\)\^2$/); await result(/= 98$/); });
  await L.check("a command mixed with other text is plain text", async () => { await send("/coin please"); await sees(/^\/coin please$/); });
  await L.check("/shrug appends", async () => { await send("/shrug ну ладно"); await sees(/ну ладно ¯\\_\(ツ\)_\/¯/); });
  await L.check("emoji shortcodes", async () => { await send("горит :fire: <3"); await sees(/горит 🔥 ❤️/); });
  await L.check("/roll", async () => { await send("/roll 6"); await sees(/^\/roll 6$/); await result(/^🎲 [1-6] \(1–6\)$/); });
  await L.check("/help shows a modal and sends nothing", async () => {
    const before = await A.evaluate(() => document.querySelectorAll(".msg-row.me").length);
    await send("/help");
    await L.until(A, () => document.querySelector(".x-modal h3")?.textContent.includes("Команды"));
    await A.keyboard.press("Escape");
    await L.until(A, () => !document.querySelector(".x-modal"));
    if ((await A.evaluate(() => document.querySelectorAll(".msg-row.me").length)) !== before) throw new Error("sent");
    if (await A.inputValue("#msg-input")) throw new Error("input not cleared");
  });
  await L.check("templates save and insert", async () => {
    await send("/tsave адрес ул. Ленина, 1");
    await send("/t адрес");
    await sees(/^ул\. Ленина, 1$/);
  });
  await L.check("B receives the expanded text", () =>
    L.until(B, () => [...document.querySelectorAll("#chat-list .room-item")].some((r) => r.textContent.includes("Вера")), null, 12000));
  const menuOnLast = async () => {
    const box = await A.evaluate(() => { const b = [...document.querySelectorAll(".msg-row.me .bubble")].pop().getBoundingClientRect(); return { x: b.x + b.width / 2, y: b.y + b.height / 2 }; });
    await A.mouse.click(box.x, box.y, { button: "right" });
    await L.until(A, () => !!document.querySelector(".ctx-menu"));
  };
  const findClick = (label) => A.evaluate((l) => { const m = [...document.querySelectorAll(".ctx-menu")].pop(); const b = [...(m?.querySelectorAll("button, [role=menuitem], .ctx-item") || [])].find((b) => b.textContent.trim() === l); if (b) b.click(); return !!b; }, label);
  const clickItem = async (label) => {
    if (await findClick(label)) return;
    await findClick("Ещё…");
    await A.waitForTimeout(400);
    if (!(await findClick(label))) throw new Error("no menu item " + label);
  };
  await L.check("bookmark from message menu", async () => {
    await menuOnLast();
    await clickItem("В закладки");
    await L.until(A, () => Object.values(JSON.parse(localStorage.getItem("lm-bookmarks") || "{}")).flat().length === 1);
  });
  await L.check("message details modal", async () => {
    await A.waitForTimeout(400);
    await menuOnLast();
    await clickItem("Подробнее");
    await L.until(A, () => document.querySelector(".x-modal h3")?.textContent === "О сообщении" && document.querySelector(".x-modal").textContent.includes("Вера"));
    await A.keyboard.press("Escape");
  });
  const chatMenu = async (id) => {
    await A.waitForTimeout(300);
    await A.click("#chat-menu-btn");
    if (await A.evaluate((i) => !!document.getElementById(i).closest("#chat-menu-extra.hidden"), id)) await A.click("#chat-menu-more-btn");
    await A.click("#" + id);
  };
  await L.check("bookmarks list jumps to the message", async () => {
    await chatMenu("chat-menu-bookmarks-btn");
    await L.until(A, () => document.querySelectorAll(".x-modal .x-list-item").length === 1);
    await A.click(".x-modal .x-list-item");
    await L.until(A, () => !document.querySelector(".x-modal"));
  });
  await L.check("chat statistics", async () => {
    await chatMenu("chat-menu-stats-btn");
    await L.until(A, () => /Статистика/.test(document.querySelector(".x-modal h3")?.textContent || "") && document.querySelectorAll(".x-bar").length === 24 && +document.querySelector(".x-stats b").textContent >= 5);
    await A.keyboard.press("Escape");
  });
  await L.check("jump to date", async () => {
    await chatMenu("chat-menu-date-btn");
    await A.click(".x-modal .x-go");
    await L.until(A, () => !document.querySelector(".x-modal"));
  });
  await L.check("chat note persists", async () => {
    await chatMenu("chat-menu-note-btn");
    await A.fill(".x-modal textarea", "позвонить в пятницу");
    await A.waitForTimeout(500);
    await A.keyboard.press("Escape");
    await L.until(A, () => Object.values(JSON.parse(localStorage.getItem("lm-chat-notes") || "{}")).includes("позвонить в пятницу"));
  });
  await L.check("HTML export downloads", async () => {
    const [dl] = await Promise.all([A.waitForEvent("download"), chatMenu("chat-menu-export-html-btn")]);
    if (!/\.html$/.test(dl.suggestedFilename())) throw new Error(dl.suggestedFilename());
  });
  await L.check("Ctrl+/ opens shortcuts help", async () => {
    await A.keyboard.press("Control+/");
    await L.until(A, () => document.querySelector(".x-modal h3")?.textContent === "Горячие клавиши");
    await A.keyboard.press("Escape");
  });
  console.log("\nerrors:\n" + [...A.errors, ...B.errors].join("\n"));
  console.log(`\n${L.passed()} passed, ${L.failures.length} failed`);
  await browser.close();
  process.exitCode = L.failures.length ? 1 : 0;
})();
