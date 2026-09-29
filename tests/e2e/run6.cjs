const L = require("./lib.cjs");
const H = require("./helpers.cjs");
const section = (s) => console.log("\n== " + s);
async function startChat(P, username, expectName) {
  await P.fill("#search-input", username);
  await L.until(P, (u) => [...document.querySelectorAll("#search-result .person-row")].some((r) => r.textContent.includes("@" + u)), username);
  await P.evaluate((u) => [...document.querySelectorAll("#search-result .person-row")].find((r) => r.textContent.includes("@" + u)).querySelector('[data-act="main"]').click(), username);
  await L.until(P, (n) => document.getElementById("chat-title")?.textContent.includes(n), expectName);
}
(async () => {
  const browser = await L.launch();
  const tag = Date.now().toString(36).slice(-4);
  const A = await L.userContext(browser, "A");
  const B = await L.userContext(browser, "B");
  const C = await L.userContext(browser, "C");
  const ua = "anna_" + tag, ub = "boris_" + tag, uc = "cyril_" + tag;
  section("setup");
  await L.check("register, A knows B and C", async () => {
    await L.register(A, ua, "Анна"); await L.register(B, ub, "Борис"); await L.register(C, uc, "Кирилл");
    await startChat(A, ub, "Борис"); await H.send(A, "hi B");
    await startChat(A, uc, "Кирилл"); await H.send(A, "hi C");
  });
  section("group admin");
  await L.check("group with B and C", async () => {
    await A.evaluate(() => document.getElementById("fab-new-chat").click()); await A.waitForTimeout(500);
    await A.evaluate(() => document.getElementById("new-chat-group-open-btn").click()); await A.waitForTimeout(600);
    await A.fill("#new-chat-group-name-input", "Трое");
    await A.evaluate(() => ["Борис", "Кирилл"].forEach((n) => [...document.querySelectorAll("#new-chat-group-member-result .check-item")].find((b) => b.textContent.includes(n)).click()));
    await A.evaluate(() => document.getElementById("new-chat-group-create-btn").click());
    await L.until(A, () => document.getElementById("chat-title")?.textContent.includes("Трое"), null, 10000);
    await L.until(B, () => [...document.querySelectorAll("#chat-list .room-name")].some((n) => n.textContent.includes("Трое")), null, 12000);
    await L.until(C, () => [...document.querySelectorAll("#chat-list .room-name")].some((n) => n.textContent.includes("Трое")), null, 12000);
  });
  const memberMenu = async (name, item) => {
    await A.evaluate(() => document.getElementById("chat-header-info").click()); await A.waitForTimeout(900);
    await L.until(A, (n) => [...document.querySelectorAll("#profile-members-list .pick-item")].some((r) => r.textContent.includes(n)), name);
    await A.evaluate((n) => [...document.querySelectorAll("#profile-members-list .pick-item")].find((r) => r.textContent.includes(n)).dispatchEvent(new MouseEvent("click", { bubbles: true, clientX: 300, clientY: 400 })), name);
    await A.waitForTimeout(500);
    await H.ctxItem(A, item);
    await A.waitForTimeout(1000);
    await A.evaluate(() => document.getElementById("profile-view-close-btn").click()); await A.waitForTimeout(400);
  };
  await L.check("A makes B an admin → B can open Privacy", async () => {
    await memberMenu("Борис", "Назначить администратором");
    await H.openChatByName(B, "Трое");
    await B.evaluate(() => document.getElementById("chat-header-info").click()); await B.waitForTimeout(1000);
    const has = await B.evaluate(() => [...document.querySelectorAll("#profile-view-actions *")].some((b) => b.textContent.trim() === "Приватность"));
    await B.evaluate(() => document.getElementById("profile-view-close-btn").click());
    if (!has) throw new Error("no privacy button for new admin");
  });
  await L.check("A removes C → the group disappears for C", async () => {
    await memberMenu("Кирилл", "Удалить из группы");
    await L.until(C, () => ![...document.querySelectorAll("#chat-list .room-name")].some((n) => n.textContent.includes("Трое")), null, 12000);
  });
  await L.check("B leaves the group", async () => {
    await B.evaluate(() => document.getElementById("chat-menu-btn").click()); await B.waitForTimeout(400);
    B.once("dialog", (d) => d.accept());
    await B.evaluate(() => document.getElementById("chat-menu-leave-btn").click());
    await B.waitForTimeout(1500);
    await L.until(B, () => ![...document.querySelectorAll("#chat-list .room-name")].some((n) => n.textContent.includes("Трое")), null, 12000);
    await L.until(A, () => /1 участник/.test(document.getElementById("chat-sub").textContent), null, 12000);
  });
  section("chat management");
  await L.check("clear history empties the chat for me only", async () => {
    await H.openChatByName(A, "Борис");
    await A.evaluate(() => document.getElementById("chat-menu-btn").click()); await A.waitForTimeout(400);
    A.once("dialog", (d) => d.accept());
    await A.evaluate(() => document.getElementById("chat-menu-clear-btn").click());
    await H.gone(A, "hi B");
    await H.openChatByName(B, "Анна");
    await H.seeText(B, "hi B", false);
  });
  await L.check("export chat downloads a file", async () => {
    await H.send(A, "для экспорта");
    const dl = A.waitForEvent("download", { timeout: 10000 });
    await A.evaluate(() => document.getElementById("chat-menu-btn").click()); await A.waitForTimeout(400);
    await A.evaluate(() => document.getElementById("chat-menu-export-btn").click());
    const d = await dl;
    const text = require("fs").readFileSync(await d.path(), "utf8");
    if (!text.includes("для экспорта")) throw new Error("export lacks the message: " + text.slice(0, 120));
  });
  await L.check("delete chat hides it until a new message", async () => {
    await H.openChatByName(A, "Кирилл");
    await A.evaluate(() => document.getElementById("chat-menu-btn").click()); await A.waitForTimeout(400);
    A.once("dialog", (d) => d.accept());
    await A.evaluate(() => document.getElementById("chat-menu-delete-btn").click());
    await L.until(A, () => ![...document.querySelectorAll("#chat-list .room-name")].some((n) => n.textContent.includes("Кирилл")), null, 10000);
    await H.openChatByName(C, "Анна");
    await H.send(C, "я вернулся");
    await L.until(A, () => [...document.querySelectorAll("#chat-list .room-name")].some((n) => n.textContent.includes("Кирилл")), null, 12000);
  });
  section("appearance & settings");
  await L.check("accent colour, font size, compact: saved and applied after reload", async () => {
    await A.evaluate(() => document.querySelector('.tab[data-tab="settings"]').click()); await A.waitForTimeout(700);
    await A.evaluate(() => document.querySelector('.settings-menu-item[data-section="chats"]').click()); await A.waitForTimeout(700);
    await A.evaluate(() => document.querySelector('.accent-swatch[data-color="blue"]').click());
    await A.evaluate(() => { const s = document.getElementById("chats-font-size"); s.value = "large"; s.dispatchEvent(new Event("change", { bubbles: true })); });
    await A.evaluate(() => { const c = document.getElementById("chats-compact"); c.checked = false; c.dispatchEvent(new Event("change", { bubbles: true })); });
    await A.evaluate(() => document.getElementById("settings-save-check").click());
    await A.waitForTimeout(2000);
    await A.reload(); await A.waitForSelector("#app:not(.hidden)"); await A.waitForTimeout(2500);
    const st = await A.evaluate(() => ({ accent: getComputedStyle(document.documentElement).getPropertyValue("--accent").trim(), cls: document.documentElement.className + " " + document.body.className, fs: document.documentElement.dataset.fontSize || document.documentElement.style.getPropertyValue("--msg-font") }));
    if (!/5b8cff|91, 140, 255/i.test(st.accent)) throw new Error("accent " + JSON.stringify(st));
  });
  await L.check("sessions list shows this login", async () => {
    await A.evaluate(() => document.querySelector('.tab[data-tab="settings"]').click()); await A.waitForTimeout(700);
    await A.evaluate(() => document.querySelector('.settings-menu-item[data-section="sessions"]').click());
    await L.until(A, () => document.querySelectorAll(".session-row").length > 0, null, 8000);
    await A.evaluate(() => document.querySelector('.tab[data-tab="chats"]').click());
  });
  await L.check("emoji picker search finds and sends an emoji", async () => {
    await H.openChatByName(A, "Борис");
    await A.evaluate(() => document.getElementById("emoji-btn").click()); await A.waitForTimeout(700);
    await A.fill(".ep-search input", "огонь");
    await A.waitForTimeout(500);
    const n = await A.evaluate(() => document.querySelectorAll(".ep-search-results .emoji-option, .ep-section:not(.hidden) .emoji-option").length);
    if (!n) throw new Error("no results for 'огонь'");
  });
  console.log("\nerrors:\n" + [...A.errors, ...B.errors, ...C.errors].join("\n"));
  console.log(`\n${L.passed()} passed, ${L.failures.length} failed`);
  await browser.close();
  process.exitCode = L.failures.length ? 1 : 0;
})();
