// PDF export: the whole history (more than one page), including encrypted 1:1 chats.
const L = require("./lib.cjs");
const H = require("./helpers.cjs");
const fs = require("fs");
(async () => {
  const browser = await L.launch();
  const tag = Date.now().toString(36).slice(-4);
  const A = await L.userContext(browser, "A");
  const B = await L.userContext(browser, "B");
  const ua = "sasha_" + tag, ub = "tanya_" + tag;
  await L.check("A registers", () => L.register(A, ua, "Саша"));
  await L.check("B registers", () => L.register(B, ub, "Таня"));
  await L.check("A creates a group with B", async () => {
    await A.fill("#search-input", ub);
    await L.until(A, (u) => [...document.querySelectorAll("#search-result .person-row")].some((r) => r.textContent.includes("@" + u)), ub);
    await A.evaluate((u) => [...document.querySelectorAll("#search-result .person-row")].find((r) => r.textContent.includes("@" + u)).querySelector('[data-act="main"]').click(), ub);
    await L.until(A, () => document.getElementById("chat-title")?.textContent.includes("Таня"));
    await H.send(A, "секретное начало");
    await H.send(A, "секретный конец");
    await H.backToList(A);
    await A.evaluate(() => document.getElementById("fab-new-chat").click());
    await A.waitForTimeout(500);
    await A.evaluate(() => document.getElementById("new-chat-group-open-btn").click());
    await A.waitForTimeout(600);
    await A.fill("#new-chat-group-name-input", "Архив");
    await A.evaluate(() => [...document.querySelectorAll("#new-chat-group-member-result .check-item")].find((b) => b.textContent.includes("Таня")).click());
    await A.evaluate(() => document.getElementById("new-chat-group-create-btn").click());
    await L.until(A, () => document.getElementById("chat-title")?.textContent.includes("Архив"), null, 10000);
  });
  await L.check("350 messages are written to the group", async () => {
    const n = await A.evaluate(async () => {
      const { db, auth } = await import("/firebase.js");
      const f = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js");
      const snap = await f.getDocs(f.query(f.collection(db, "groups"), f.where("members", "array-contains", auth.currentUser.uid)));
      const gid = snap.docs.find((d) => d.data().name === "Архив").id;
      const base = Date.now() - 400 * 60000;
      for (let k = 0; k < 350; k += 50) {
        const b = f.writeBatch(db);
        for (let i = k; i < k + 50; i++)
          b.set(f.doc(f.collection(db, "groups", gid, "messages")), { senderId: auth.currentUser.uid, text: `сообщение №${i + 1}`, createdAt: f.Timestamp.fromMillis(base + i * 60000) });
        await b.commit();
      }
      return 350;
    });
    if (n !== 350) throw new Error(n);
    await H.backToList(A);
    await H.openChatByName(A, "Архив");
    await L.until(A, () => /сообщение №350/.test(document.getElementById("messages").textContent), null, 15000);
    const shown = await A.evaluate(() => document.querySelectorAll(".msg-row").length);
    if (shown >= 350) throw new Error("expected only the last page, got " + shown);
  });
  const exportPdf = async (P, name) => {
    await P.evaluate(() => (window.__lastPdfExport = null));
    await P.click("#chat-menu-btn");
    await P.click("#chat-menu-more-btn");
    await P.click("#chat-menu-export-pdf-btn");
    await L.until(P, () => !!window.__lastPdfExport, null, 60000);
    const ex = await P.evaluate(() => window.__lastPdfExport);
    const page = await P.context().newPage();
    await page.setContent(ex.html);
    const pdf = await page.pdf({ format: "A4" });
    await page.close();
    if (pdf.slice(0, 4).toString() !== "%PDF" || pdf.length < 5000) throw new Error("bad pdf");
    if (process.env.PDF_DIR) {
      fs.writeFileSync(`${process.env.PDF_DIR}/${name}.pdf`, pdf);
      const shot = await P.context().newPage();
      await shot.setViewportSize({ width: 794, height: 1123 });
      await shot.emulateMedia({ media: "print" });
      await shot.setContent(ex.html);
      await shot.screenshot({ path: `${process.env.PDF_DIR}/${name}.png` });
      await shot.close();
    }
    return ex;
  };
  await L.check("group PDF has all 350 messages, oldest first", async () => {
    const ex = await exportPdf(A, "group");
    if (ex.rows < 350) throw new Error("rows " + ex.rows);
    if (!/сообщение №1</.test(ex.html) || !/сообщение №350</.test(ex.html)) throw new Error("missing ends");
    if (ex.html.indexOf("сообщение №1<") > ex.html.indexOf("сообщение №350<")) throw new Error("order");
  });
  await L.check("encrypted 1:1 chat exports decrypted text", async () => {
    await H.backToList(A);
    await H.openChatByName(A, "Таня");
    await L.until(A, () => /секретный конец/.test(document.getElementById("messages").textContent), null, 10000);
    const ex = await exportPdf(A, "direct");
    if (!/секретное начало/.test(ex.html) || !/секретный конец/.test(ex.html)) throw new Error("not decrypted");
  });
  console.log("\nerrors:\n" + [...A.errors, ...B.errors].join("\n"));
  console.log(`\n${L.passed()} passed, ${L.failures.length} failed`);
  await browser.close();
  process.exitCode = L.failures.length ? 1 : 0;
})();
