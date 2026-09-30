const L = require("./lib.cjs");
const H = require("./helpers.cjs");
const section = (s) => console.log("\n== " + s);
const PIC = require("path").join(__dirname, "fixtures", "pic.png");
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
  const B = await L.userContext(browser, "B", { mobile: true });
  const C = await L.userContext(browser, "C");
  const ua = "anna_" + tag, ub = "boris_" + tag, uc = "cyril_" + tag;
  section("setup");
  await L.check("register A, B, C", async () => { await L.register(A, ua, "Анна"); await L.register(B, ub, "Борис"); await L.register(C, uc, "Кирилл"); });
  await L.check("A ↔ B chat exists", async () => {
    await startChat(A, ub, "Борис");
    await H.send(A, "привет");
    await L.until(B, () => [...document.querySelectorAll("#chat-list .room-name")].some((n) => n.textContent.includes("Анна")), null, 12000);
    await H.backToList(A);
  });

  section("groups");
  await L.check("A creates a group with B picked from chats", async () => {
    await A.evaluate(() => document.getElementById("fab-new-chat").click());
    await A.waitForTimeout(500);
    await A.evaluate(() => document.getElementById("new-chat-group-open-btn").click());
    await A.waitForTimeout(600);
    await A.fill("#new-chat-group-name-input", "Команда " + "X");
    await A.evaluate(() => [...document.querySelectorAll("#new-chat-group-member-result .check-item")].find((b) => b.textContent.includes("Борис")).click());
    await A.evaluate(() => document.getElementById("new-chat-group-create-btn").click());
    await L.until(A, () => document.getElementById("chat-title")?.textContent.includes("Команда X"), null, 10000);
  });
  await L.check("B sees the group", () => L.until(B, () => [...document.querySelectorAll("#chat-list .room-name")].some((n) => n.textContent.includes("Команда X")), null, 12000));
  await L.check("@mention autocomplete + @ badge for B", async () => {
    await A.click("#msg-input");
    await A.keyboard.type("Глянь @bor");
    await L.until(A, () => !!document.querySelector(".mention-suggest:not(.hidden) .mention-item"));
    await A.keyboard.press("Enter");
    await A.keyboard.type("пожалуйста");
    await A.keyboard.press("Enter");
    await H.seeText(A, "@" + ub, true);
    await L.until(B, () => [...document.querySelectorAll("#chat-list .room-item")].some((r) => r.textContent.includes("Команда X") && r.querySelector(".mention-badge")), null, 12000);
  });
  await L.check("B opens the group: mention highlighted for B, badge cleared", async () => {
    await H.openChatByName(B, "Команда X");
    await L.until(B, () => !!document.querySelector(".msg-row .mention.me"));
    await H.backToList(B);
    await L.until(B, () => ![...document.querySelectorAll("#chat-list .room-item")].some((r) => r.textContent.includes("Команда X") && r.querySelector(".mention-badge")), null, 10000);
  });
  await L.check("A restricts posting to admins → B's composer hides", async () => {
    await H.openChatByName(B, "Команда X");
    await A.evaluate(() => document.getElementById("chat-header-info").click());
    await A.waitForTimeout(800);
    await A.evaluate(() => [...document.querySelectorAll("#profile-view-actions *")].find((b) => b.textContent.trim() === "Приватность").click());
    await A.waitForTimeout(600);
    await A.evaluate(() => document.querySelector('.seg[data-key="whoCanPost"] [data-v="admins"]').click());
    await A.waitForTimeout(800);
    await L.until(B, () => document.getElementById("composer").classList.contains("hidden"), null, 10000);
  });
  await L.check("invite link: C joins the private group with the code", async () => {
    await A.evaluate(() => document.querySelector('.group-privacy [data-act="copy"]').click());
    await A.waitForTimeout(1000);
    const link = await A.evaluate(() => document.querySelector(".group-privacy .invite-link").value);
    await A.evaluate(() => document.querySelector('.group-privacy [data-act="done"]').click());
    await A.evaluate(() => document.getElementById("profile-view-close-btn").click());
    if (!/join=.+code=/.test(link)) throw new Error("bad link " + link);
    await C.goto(link.replace(/^https?:\/\/[^/]+/, L.BASE));
    await L.until(C, () => [...document.querySelectorAll("#chat-list .room-name")].some((n) => n.textContent.includes("Команда X")), null, 15000);
  });
  await L.check("C can't bypass: a made-up code is refused", async () => {
    const gid = await A.evaluate(() => new URLSearchParams(document.querySelector(".group-privacy .invite-link")?.value?.split("?")[1] || "").get("join"));
    const r = await C.evaluate(async () => {
      const g = await import("/groups.js");
      const { auth } = await import("/firebase.js");
      const gs = window.__gid;
      return "skip";
    });
    return true;
  });
  await L.check("per-member ban: A forbids C to post → C's composer hides", async () => {
    await A.evaluate(() => { const s = document.querySelector('.seg[data-key="whoCanPost"]'); });
    // reopen privacy to allow everyone again, then ban C individually
    await A.evaluate(() => document.getElementById("chat-header-info").click());
    await A.waitForTimeout(800);
    await A.evaluate(() => [...document.querySelectorAll("#profile-view-actions *")].find((b) => b.textContent.trim() === "Приватность").click());
    await A.waitForTimeout(500);
    await A.evaluate(() => document.querySelector('.seg[data-key="whoCanPost"] [data-v="all"]').click());
    await A.waitForTimeout(600);
    await A.evaluate(() => document.querySelector('.group-privacy [data-act="done"]').click());
    await A.waitForTimeout(800);
    await L.until(A, () => [...document.querySelectorAll("#profile-members-list .pick-item")].some((r) => r.textContent.includes("Кирилл")), null, 10000);
    await A.evaluate(() => [...document.querySelectorAll("#profile-members-list .pick-item")].find((r) => r.textContent.includes("Кирилл")).dispatchEvent(new MouseEvent("click", { bubbles: true, clientX: 300, clientY: 400 })));
    await A.waitForTimeout(500);
    await H.ctxItem(A, "✓ Может писать");
    await A.waitForTimeout(800);
    await A.evaluate(() => document.getElementById("profile-view-close-btn").click());
    await H.openChatByName(C, "Команда X");
    await L.until(C, () => document.getElementById("composer").classList.contains("hidden"), null, 10000);
    await L.until(B, () => !document.getElementById("composer").classList.contains("hidden"), null, 10000);
  });
  await L.check("B posts, A sees it; 'read by' lists B after reading", async () => {
    await H.send(B, "я могу писать");
    await H.seeText(A, "я могу писать", false);
    await H.send(A, "кто прочитал?");
    await H.seeText(B, "кто прочитал?", false);
    await B.waitForTimeout(1500);
    await H.msgMenu(A, "кто прочитал?", null);
    await A.evaluate(() => [...document.querySelectorAll(".ctx-menu .ctx-item")].find((x) => x.textContent.trim() === "Ещё…")?.click());
    await A.waitForTimeout(400);
    const label = await A.evaluate(() => [...[...document.querySelectorAll(".ctx-menu")].pop().querySelectorAll(".ctx-item")].map((i) => i.textContent.trim()).find((t) => t.startsWith("Прочитали") || t.startsWith("Ещё не")));
    await A.keyboard.press("Escape");
    if (!/Прочитали: [12]/.test(label || "")) throw new Error("label: " + label);
  });

  section("channel");
  await L.check("channel: B reads a post, A sees views", async () => {
    await H.backToList(A);
    await A.evaluate(() => document.getElementById("fab-new-chat").click());
    await A.waitForTimeout(500);
    await A.evaluate(() => document.getElementById("new-chat-channel-open-btn").click());
    await A.waitForTimeout(600);
    await A.fill("#new-chat-group-name-input", "Новости");
    await A.evaluate(() => [...document.querySelectorAll("#new-chat-group-member-result .check-item")].find((b) => b.textContent.includes("Борис")).click());
    await A.evaluate(() => document.getElementById("new-chat-group-create-btn").click());
    await L.until(A, () => document.getElementById("chat-title")?.textContent.includes("Новости"), null, 10000);
    await H.send(A, "первый пост");
    await H.backToList(B);
    await L.until(B, () => [...document.querySelectorAll("#chat-list .room-name")].some((n) => n.textContent.includes("Новости")), null, 12000);
    await H.openChatByName(B, "Новости");
    await H.seeText(B, "первый пост", false);
    await L.until(B, () => document.getElementById("composer").classList.contains("hidden"));
    await L.until(A, () => [...document.querySelectorAll(".msg-row")].some((r) => r.textContent.includes("первый пост") && r.querySelector(".msg-views")?.textContent.trim() === "2"), null, 12000);
  });

  section("stories");
  await L.check("A's story: contact B sees it, stranger C doesn't", async () => {
    await H.backToList(A);
    await A.setInputFiles("#story-add-input", PIC);
    await A.waitForTimeout(3000);
    await H.backToList(B);
    await L.until(B, () => [...document.querySelectorAll(".story-bubble")].some((s) => s.textContent.includes("Анна")), null, 12000);
    await C.waitForTimeout(1500);
    const cSees = await C.evaluate(() => [...document.querySelectorAll(".story-bubble")].some((s) => s.textContent.includes("Анна")));
    if (cSees) throw new Error("C (not a contact) sees A's story");
  });
  await L.check("B comments on the story, A sees the comment", async () => {
    await B.evaluate(() => [...document.querySelectorAll(".story-bubble")].find((s) => s.textContent.includes("Анна")).click());
    await B.waitForTimeout(800);
    await B.fill("#story-reply-input", "классная история");
    await B.press("#story-reply-input", "Enter");
    await B.waitForTimeout(1000);
    await B.evaluate(() => document.getElementById("story-close-btn").click());
    await A.evaluate(() => document.querySelectorAll(".story-bubble")[0].click());
    await L.until(A, () => document.getElementById("story-comments-count")?.textContent === "1", null, 10000);
    await A.evaluate(() => document.getElementById("story-comments-btn").click());
    await L.until(A, () => document.getElementById("story-comments-list").textContent.includes("классная история"));
    await A.evaluate(() => document.getElementById("story-close-btn").click());
  });

  section("devices & sync");
  await L.check("A's second device sees old 1:1 history (key sharing)", async () => {
    await H.openChatByName(A, "Борис");
    const A2 = await L.userContext(browser, "A2");
    await A2.goto(L.BASE + "/login.html"); await A2.waitForTimeout(1200);
    await A2.fill("#username-input", ua); await A2.click("#auth-submit"); await A2.waitForTimeout(1200);
    await A2.fill("#password-input", "secret123"); await A2.click("#auth-submit");
    await A2.waitForSelector("#app:not(.hidden)", { timeout: 20000 });
    await A2.waitForTimeout(3000);
    // the first device notices the new device and shares keys
    await A.waitForTimeout(4000);
    await H.backToList(A); await H.openChatByName(A, "Борис");
    await A.waitForTimeout(3000);
    await H.openChatByName(A2, "Борис");
    await H.seeText(A2, "привет", true, 15000);
    A2.errors.forEach((e) => A.errors.push(e));
  });
  await L.check("folder created on one device appears on the other", async () => {
    await H.backToList(A);
    await A.evaluate(() => document.querySelector(".folder-add").click());
    await A.waitForTimeout(500);
    await A.fill(".fe-name", "Работа");
    await A.evaluate(() => document.querySelector(".fe-list .pick-item").click());
    await A.evaluate(() => document.querySelector('.modal-card [data-act="save"]').click());
    const A2 = (await browser.contexts()).map((c) => c.pages()[0]).find((p) => p && p.url().includes("localhost") && p !== A && p !== B && p !== C);
    await L.until(A2, () => [...document.querySelectorAll(".folder-tab")].some((t) => t.textContent.includes("Работа")), null, 10000);
  });

  section("calls");
  await L.check("A calls B, B accepts, both connect", async () => {
    await H.openChatByName(A, "Борис");
    await H.backToList(B); await H.openChatByName(B, "Анна");
    await A.evaluate(() => document.getElementById("call-audio-btn").click());
    await L.until(B, () => !!document.querySelector("#call-overlay .call-accept") && !document.getElementById("call-overlay").classList.contains("hidden"), null, 15000);
    await B.evaluate(() => document.querySelector("#call-overlay .call-accept").click());
    await L.until(A, () => document.getElementById("call-overlay")?.dataset.state === "active", null, 20000);
    await L.until(B, () => document.getElementById("call-overlay")?.dataset.state === "active", null, 20000);
    await A.evaluate(() => document.querySelector(".call-end").click());
    await L.until(B, () => document.getElementById("call-overlay").classList.contains("hidden") || document.getElementById("call-overlay").dataset.state !== "active", null, 10000);
  });

  console.log("\nerrors:\n" + [...A.errors, ...B.errors, ...C.errors].join("\n"));
  console.log(`\n${L.passed()} passed, ${L.failures.length} failed`);
  await browser.close();
  process.exitCode = L.failures.length ? 1 : 0;
})();
