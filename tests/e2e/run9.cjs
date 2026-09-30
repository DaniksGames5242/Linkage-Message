// Stickers, slow mode in groups, tools synced across devices.
const L = require("./lib.cjs");
const H = require("./helpers.cjs");
const path = require("path");
(async () => {
  const browser = await L.launch();
  const tag = Date.now().toString(36).slice(-4);
  const A = await L.userContext(browser, "A");
  const B = await L.userContext(browser, "B");
  const ua = "lida_" + tag, ub = "mark_" + tag;
  await L.check("A registers", () => L.register(A, ua, "Лида"));
  await L.check("B registers", () => L.register(B, ub, "Марк"));
  await L.check("A opens chat with B", async () => {
    await A.fill("#search-input", ub);
    await L.until(A, (u) => [...document.querySelectorAll("#search-result .person-row")].some((r) => r.textContent.includes("@" + u)), ub);
    await A.evaluate((u) => [...document.querySelectorAll("#search-result .person-row")].find((r) => r.textContent.includes("@" + u)).querySelector('[data-act="main"]').click(), ub);
    await L.until(A, () => document.getElementById("chat-title")?.textContent.includes("Марк"));
    await H.send(A, "привет");
  });
  console.log("== stickers");
  await L.check("A adds a sticker to the pack", async () => {
    await A.click("#attach-btn");
    await H.ctxItem(A, "Стикеры");
    await L.until(A, () => !!document.querySelector(".x-stickers .x-sticker.add"));
    const [chooser] = await Promise.all([A.waitForEvent("filechooser"), A.click(".x-stickers .x-sticker.add")]);
    await chooser.setFiles(path.join(__dirname, "fixtures", "icon.png"));
    await L.until(A, () => document.querySelectorAll(".x-stickers .x-sticker:not(.add)").length === 1, null, 10000);
  });
  await L.check("A sends it: no bubble, just the image", async () => {
    await A.click(".x-stickers .x-sticker:not(.add)");
    await L.until(A, () => !!document.querySelector(".msg-row.me .bubble.sticker-bubble img.sticker-img"), null, 10000);
  });
  await L.check("B receives the sticker (decrypted) with a preview in the list", async () => {
    await L.until(B, () => [...document.querySelectorAll("#chat-list .room-item")].some((r) => r.textContent.includes("Стикер")), null, 12000);
    await H.openChatByName(B, "Лида");
    await L.until(B, () => !!document.querySelector(".msg-row:not(.me) .sticker-img"), null, 10000);
  });
  await L.check("B saves A's sticker into own pack", async () => {
    const box = await B.evaluate(() => { const r = document.querySelector(".msg-row:not(.me) .bubble.sticker-bubble").getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; });
    await B.mouse.click(box.x, box.y, { button: "right" });
    await H.ctxItem(B, "Сохранить стикер");
    await L.until(B, () => JSON.parse(localStorage.getItem("lm-stickers") || "[]").length === 1);
  });
  console.log("== sync across devices");
  await L.check("A saves a template and a note", async () => {
    await A.fill("#msg-input", "/tsave привет Здравствуйте, коллеги!");
    await A.press("#msg-input", "Enter");
    await A.waitForTimeout(300);
    await A.click("#chat-menu-btn");
    await A.click("#chat-menu-more-btn");
    await A.click("#chat-menu-note-btn");
    await A.fill(".x-modal textarea", "синхронная заметка");
    await A.waitForTimeout(700);
    await A.keyboard.press("Escape");
    await A.waitForTimeout(1200);
  });
  let A2;
  await L.check("A's second device gets stickers, template and note", async () => {
    A2 = await L.userContext(browser, "A2");
    await A2.goto(L.BASE + "/login.html"); await A2.waitForTimeout(1200);
    await A2.fill("#username-input", ua); await A2.click("#auth-submit"); await A2.waitForTimeout(1200);
    await A2.fill("#password-input", "secret123"); await A2.click("#auth-submit");
    await A2.waitForSelector("#app:not(.hidden)", { timeout: 20000 });
    await L.until(A2, () => {
      const t = JSON.parse(localStorage.getItem("lm-templates") || "{}");
      const n = JSON.parse(localStorage.getItem("lm-chat-notes") || "{}");
      const s = JSON.parse(localStorage.getItem("lm-stickers") || "[]");
      return t["привет"] === "Здравствуйте, коллеги!" && Object.values(n).includes("синхронная заметка") && s.length === 1;
    }, null, 15000);
  });
  await L.check("a bookmark made on device 2 appears on device 1", async () => {
    await H.openChatByName(A2, "Марк");
    await L.until(A2, () => document.querySelectorAll(".msg-row.me .bubble").length >= 2, null, 15000);
    const box = await A2.evaluate(() => { const r = [...document.querySelectorAll(".msg-row.me .bubble")][0].getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; });
    await A2.mouse.click(box.x, box.y, { button: "right" });
    await H.ctxItem(A2, "В закладки");
    await L.until(A, () => Object.values(JSON.parse(localStorage.getItem("lm-bookmarks") || "{}")).flat().length === 1, null, 10000);
  });
  console.log("== slow mode");
  await L.check("A creates a group with B", async () => {
    await H.backToList(A);
    await A.evaluate(() => document.getElementById("fab-new-chat").click());
    await A.waitForTimeout(500);
    await A.evaluate(() => document.getElementById("new-chat-group-open-btn").click());
    await A.waitForTimeout(600);
    await A.fill("#new-chat-group-name-input", "Черепахи");
    await A.evaluate(() => [...document.querySelectorAll("#new-chat-group-member-result .check-item")].find((b) => b.textContent.includes("Марк")).click());
    await A.evaluate(() => document.getElementById("new-chat-group-create-btn").click());
    await L.until(A, () => document.getElementById("chat-title")?.textContent.includes("Черепахи"), null, 10000);
  });
  await L.check("A turns slow mode on (1 min)", async () => {
    await A.evaluate(() => document.getElementById("chat-header-info").click());
    await A.waitForTimeout(800);
    await A.evaluate(() => [...document.querySelectorAll("#profile-view-actions *")].find((b) => b.textContent.trim() === "Приватность").click());
    await A.waitForTimeout(600);
    await A.click('.group-privacy [data-act="slow"]');
    await H.ctxItem(A, "1 мин");
    await L.until(A, () => /1 мин/.test(document.querySelector('.group-privacy [data-act="slow"]').textContent), null, 5000);
    await A.evaluate(() => document.querySelector('.group-privacy [data-act="done"]').click());
    await A.evaluate(() => document.getElementById("profile-view-close-btn").click());
  });
  await L.check("B posts once, the second post is held with a countdown", async () => {
    await H.backToList(B);
    await H.openChatByName(B, "Черепахи");
    await B.waitForTimeout(800);
    await H.send(B, "первое");
    await L.until(B, () => [...document.querySelectorAll(".msg-row.me .bubble-text")].some((b) => b.textContent.includes("первое")), null, 10000);
    await B.waitForTimeout(1200);
    await B.fill("#msg-input", "второе");
    await B.press("#msg-input", "Enter");
    await L.until(B, () => /Медленный режим/.test(document.body.textContent), null, 5000);
    if ((await B.inputValue("#msg-input")) !== "второе") throw new Error("text lost");
  });
  await L.check("the rules refuse a direct second write too", async () => {
    const r = await B.evaluate(async () => {
      const { db } = await import("/firebase.js");
      const fs = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js");
      const g = [...document.querySelectorAll("#chat-list .room-item")].length; // noop
      const { auth } = await import("/firebase.js");
      const snap = await fs.getDocs(fs.query(fs.collection(db, "groups"), fs.where("members", "array-contains", auth.currentUser.uid)));
      const gid = snap.docs.find((d) => d.data().name === "Черепахи").id;
      const b = fs.writeBatch(db);
      b.set(fs.doc(fs.collection(db, "groups", gid, "messages")), { senderId: auth.currentUser.uid, text: "обход", createdAt: fs.serverTimestamp() });
      b.set(fs.doc(db, "groups", gid), { slow: { [auth.currentUser.uid]: fs.serverTimestamp() } }, { merge: true });
      try { await b.commit(); return "allowed"; } catch (e) { return e.code; }
    });
    if (r !== "permission-denied") throw new Error(r);
  });
  await L.check("the admin isn't limited", async () => {
    await H.send(A, "админ 1");
    await H.send(A, "админ 2");
    await L.until(A, () => [...document.querySelectorAll(".msg-row.me .bubble-text")].some((b) => b.textContent.includes("админ 2")), null, 10000);
  });
  console.log("\nerrors:\n" + [...A.errors, ...B.errors, ...(A2?.errors || [])].join("\n"));
  console.log(`\n${L.passed()} passed, ${L.failures.length} failed`);
  await browser.close();
  process.exitCode = L.failures.length ? 1 : 0;
})();
