// Quiz polls, do-not-disturb with auto-reply, sticker packs shared by link.
const L = require("./lib.cjs");
const H = require("./helpers.cjs");
const path = require("path");
(async () => {
  const browser = await L.launch();
  const tag = Date.now().toString(36).slice(-4);
  const A = await L.userContext(browser, "A");
  const B = await L.userContext(browser, "B", { mobile: true });
  const ua = "nina_" + tag, ub = "oleg_" + tag;
  await L.check("A registers", () => L.register(A, ua, "Нина"));
  await L.check("B registers (mobile)", () => L.register(B, ub, "Олег"));
  await L.check("A opens chat with B", async () => {
    await A.fill("#search-input", ub);
    await L.until(A, (u) => [...document.querySelectorAll("#search-result .person-row")].some((r) => r.textContent.includes("@" + u)), ub);
    await A.evaluate((u) => [...document.querySelectorAll("#search-result .person-row")].find((r) => r.textContent.includes("@" + u)).querySelector('[data-act="main"]').click(), ub);
    await L.until(A, () => document.getElementById("chat-title")?.textContent.includes("Олег"));
    await H.send(A, "привет");
    await L.until(B, () => [...document.querySelectorAll("#chat-list .room-name")].some((n) => n.textContent.includes("Нина")), null, 12000);
    await H.openChatByName(B, "Нина");
  });
  console.log("== quiz");
  await L.check("quiz needs a marked answer", async () => {
    await A.click("#attach-btn");
    await H.ctxItem(A, "Опрос");
    await A.waitForTimeout(500);
    await A.fill("#poll-question", "Столица Франции?");
    const inputs = A.locator("#poll-options input");
    await inputs.nth(0).fill("Лион");
    await inputs.nth(1).fill("Париж");
    await A.click("#poll-add-option");
    await inputs.nth(2).fill("Марсель");
    await A.evaluate(() => { const q = document.getElementById("poll-quiz"); q.checked = true; q.dispatchEvent(new Event("change")); });
    if (!(await A.evaluate(() => document.getElementById("poll-multi").disabled))) throw new Error("multi not disabled");
    await A.click("#poll-create");
    await L.until(A, () => /Отметьте правильный/.test(document.body.textContent), null, 4000);
  });
  await L.check("A marks the answer, adds an explanation and sends", async () => {
    await A.locator("#poll-options .poll-edit-dot").nth(1).click();
    await A.fill("#poll-explain", "Париж — столица с 987 года");
    await A.click("#poll-create");
    await L.until(A, () => !!document.querySelector(".msg-row.me .poll.quiz"), null, 10000);
  });
  await L.check("B answers wrong: sees ✕ on the choice, ✓ on the right one, explanation; no undo", async () => {
    await L.until(B, () => !!document.querySelector(".msg-row:not(.me) .poll.quiz"), null, 12000);
    await B.evaluate(() => [...document.querySelectorAll(".msg-row:not(.me) .poll.quiz .poll-opt")][0].click());
    await L.until(B, () => {
      const opts = [...document.querySelectorAll(".msg-row:not(.me) .poll.quiz .poll-opt")];
      return opts[0]?.classList.contains("wrong") && opts[1]?.classList.contains("correct") && /987/.test(document.querySelector(".msg-row:not(.me) .poll-explain")?.textContent || "");
    }, null, 10000);
    if (await B.evaluate(() => !document.querySelector(".msg-row:not(.me) .poll.quiz .poll-action").classList.contains("hidden"))) throw new Error("undo shown");
  });
  await L.check("A sees the result as well", () => L.until(A, () => /1 голос/.test(document.querySelector(".msg-row.me .poll.quiz .poll-total")?.textContent || ""), null, 10000));
  console.log("== do not disturb");
  await L.check("B turns on do-not-disturb with an auto-reply", async () => {
    await B.evaluate(() => document.getElementById("settings-away-for") && (document.getElementById("settings-away-for").value = "3600"));
    await B.fill("#settings-away-text", "На даче до вечера").catch(async () => B.evaluate(() => (document.getElementById("settings-away-text").value = "На даче до вечера")));
    await B.evaluate(() => document.getElementById("settings-away-save").click());
    await L.until(B, () => /Включено до/.test(document.getElementById("settings-away-hint").textContent), null, 8000);
  });
  await L.check("A sees the banner in the chat with B", () =>
    L.until(A, () => !document.getElementById("away-banner").classList.contains("hidden") && /Олег не беспокоить до .* · «На даче до вечера»/.test(document.getElementById("away-banner").textContent), null, 10000));
  await L.check("banner hides in other chats", async () => {
    await H.backToList(A);
    await A.evaluate(() => [...document.querySelectorAll("#chat-list .room-item")].find((r) => /Избранное/.test(r.textContent))?.click());
    await A.waitForTimeout(800);
    if (!(await A.evaluate(() => document.getElementById("away-banner").classList.contains("hidden")))) throw new Error("still visible");
  });
  await L.check("B turns it off → A's banner disappears", async () => {
    await H.openChatByName(A, "Олег");
    await L.until(A, () => !document.getElementById("away-banner").classList.contains("hidden"), null, 8000);
    await B.evaluate(() => { document.getElementById("settings-away-for").value = "0"; document.getElementById("settings-away-save").click(); });
    await L.until(A, () => document.getElementById("away-banner").classList.contains("hidden"), null, 10000);
  });
  console.log("== sticker pack by link");
  let link;
  await L.check("A adds a sticker and shares the pack", async () => {
    await A.click("#attach-btn");
    await H.ctxItem(A, "Стикеры");
    const [chooser] = await Promise.all([A.waitForEvent("filechooser"), A.click(".x-stickers .x-sticker.add")]);
    await chooser.setFiles([path.join(__dirname, "fixtures", "icon.png"), path.join(__dirname, "fixtures", "pic.png")]);
    await L.until(A, () => document.querySelectorAll(".x-stickers .x-sticker:not(.add)").length === 2, null, 10000);
    await A.evaluate(() => [...document.querySelectorAll(".x-modal-head button")].find((b) => b.textContent === "Поделиться").click());
    await L.until(A, () => /Ссылка на набор скопирована/.test(document.body.textContent), null, 8000);
    link = await A.evaluate(() => navigator.clipboard.readText());
    if (!/\?stickers=/.test(link)) throw new Error(link);
    await A.keyboard.press("Escape");
  });
  await L.check("B opens the link and adds the whole pack", async () => {
    await B.goto(link.replace(/^https?:\/\/[^/]+/, L.BASE));
    await B.waitForSelector("#app:not(.hidden)", { timeout: 20000 });
    await L.until(B, () => document.querySelectorAll(".x-modal .x-sticker").length === 2, null, 12000);
    await B.click(".x-modal .x-pack-add");
    await L.until(B, () => JSON.parse(localStorage.getItem("lm-stickers") || "[]").length === 2);
  });
  console.log("\nerrors:\n" + [...A.errors, ...B.errors].join("\n"));
  console.log(`\n${L.passed()} passed, ${L.failures.length} failed`);
  await browser.close();
  process.exitCode = L.failures.length ? 1 : 0;
})();
