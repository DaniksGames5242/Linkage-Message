// Group topics, voice transcription (speech API stubbed), drafts synced across devices.
const L = require("./lib.cjs");
const H = require("./helpers.cjs");
async function hold(P, sel, ms) {
  const box = await P.locator(sel).boundingBox();
  await P.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await P.mouse.down();
  await P.waitForTimeout(ms);
  await P.mouse.up();
}
(async () => {
  const browser = await L.launch();
  const tag = Date.now().toString(36).slice(-4);
  const A = await L.userContext(browser, "A");
  const B = await L.userContext(browser, "B");
  // Speech recognition needs Google's servers: a stand-in that "hears" a phrase.
  await A.context().addInitScript(() => {
    class FakeRec {
      start() {
        this._t = setTimeout(() => this.onresult?.({ resultIndex: 0, results: [Object.assign([{ transcript: "проверка расшифровки" }], { isFinal: true })] }), 400);
      }
      stop() { clearTimeout(this._t); setTimeout(() => this.onend?.(), 50); }
    }
    window.SpeechRecognition = FakeRec;
    window.webkitSpeechRecognition = FakeRec;
  });
  const ua = "petr_" + tag, ub = "rita_" + tag;
  await L.check("A registers", () => L.register(A, ua, "Пётр"));
  await L.check("B registers", () => L.register(B, ub, "Рита"));
  await L.check("A opens chat with B", async () => {
    await A.fill("#search-input", ub);
    await L.until(A, (u) => [...document.querySelectorAll("#search-result .person-row")].some((r) => r.textContent.includes("@" + u)), ub);
    await A.evaluate((u) => [...document.querySelectorAll("#search-result .person-row")].find((r) => r.textContent.includes("@" + u)).querySelector('[data-act="main"]').click(), ub);
    await L.until(A, () => document.getElementById("chat-title")?.textContent.includes("Рита"));
    await H.send(A, "привет");
    await L.until(B, () => [...document.querySelectorAll("#chat-list .room-name")].some((n) => n.textContent.includes("Пётр")), null, 12000);
    await H.openChatByName(B, "Пётр");
  });
  console.log("== voice transcription");
  await L.check("A enables transcription and records a voice message", async () => {
    await A.evaluate(() => { const t = document.getElementById("transcribe-voice"); t.checked = true; t.dispatchEvent(new Event("change")); });
    await hold(A, "#rec-btn", 2200);
    await L.until(B, () => !!document.querySelector(".msg-row:not(.me) .voice-bubble .voice-transcript-btn"), null, 15000);
  });
  await L.check("B reveals the text (sent encrypted)", async () => {
    await B.evaluate(() => [...document.querySelectorAll(".msg-row:not(.me) .voice-transcript-btn")].pop().click());
    await L.until(B, () => [...document.querySelectorAll(".voice-transcript-text:not(.hidden)")].some((t) => t.textContent === "проверка расшифровки"));
    const plain = (await L.adminQuery("messages")).filter((m) => /проверка/.test(JSON.stringify(m)));
    if (plain.length) throw new Error("transcript stored in plain text");
  });
  console.log("== drafts sync");
  let A2;
  await L.check("a draft typed on device 1 shows up on device 2", async () => {
    await A.fill("#msg-input", "черновик для второго устройства");
    await A.waitForTimeout(2500);
    A2 = await L.userContext(browser, "A2");
    await A2.goto(L.BASE + "/login.html"); await A2.waitForTimeout(1200);
    await A2.fill("#username-input", ua); await A2.click("#auth-submit"); await A2.waitForTimeout(1200);
    await A2.fill("#password-input", "secret123"); await A2.click("#auth-submit");
    await A2.waitForSelector("#app:not(.hidden)", { timeout: 20000 });
    await L.until(A2, () => Object.keys(localStorage).some((k) => k.startsWith("lm-draft:") && localStorage.getItem(k) === "черновик для второго устройства"), null, 15000);
    await H.openChatByName(A2, "Рита");
    await L.until(A2, () => document.getElementById("msg-input").value === "черновик для второго устройства", null, 8000);
  });
  await L.check("sending on device 2 clears the draft on device 1", async () => {
    await A2.press("#msg-input", "Enter");
    await A.evaluate(() => document.activeElement.blur());
    await L.until(A, () => document.getElementById("msg-input").value === "", null, 15000);
  });
  console.log("== topics");
  await L.check("A creates a group with B", async () => {
    await H.backToList(A);
    await A.evaluate(() => document.getElementById("fab-new-chat").click());
    await A.waitForTimeout(500);
    await A.evaluate(() => document.getElementById("new-chat-group-open-btn").click());
    await A.waitForTimeout(600);
    await A.fill("#new-chat-group-name-input", "Клуб");
    await A.evaluate(() => [...document.querySelectorAll("#new-chat-group-member-result .check-item")].find((b) => b.textContent.includes("Рита")).click());
    await A.evaluate(() => document.getElementById("new-chat-group-create-btn").click());
    await L.until(A, () => document.getElementById("chat-title")?.textContent.includes("Клуб"), null, 10000);
  });
  await L.check("admin adds a topic", async () => {
    await L.until(A, () => !document.getElementById("topic-bar").classList.contains("hidden"));
    A.once("dialog", (d) => d.accept("🍕 Еда"));
    await A.click("#topic-bar .topic-chip.add");
    await L.until(A, () => [...document.querySelectorAll("#topic-bar .topic-chip")].some((c) => c.textContent === "🍕 Еда"), null, 8000);
  });
  await L.check("a message in the topic, another in General", async () => {
    await A.evaluate(() => [...document.querySelectorAll("#topic-bar .topic-chip")].find((c) => c.textContent === "🍕 Еда").click());
    await H.send(A, "где пицца?");
    await A.evaluate(() => [...document.querySelectorAll("#topic-bar .topic-chip")].find((c) => /Общее/.test(c.textContent)).click());
    await H.send(A, "всем привет");
  });
  await L.check("B sees the topic bar (no add button) and filters", async () => {
    await H.backToList(B);
    await L.until(B, () => [...document.querySelectorAll("#chat-list .room-name")].some((n) => n.textContent.includes("Клуб")), null, 12000);
    await H.openChatByName(B, "Клуб");
    await L.until(B, () => [...document.querySelectorAll("#topic-bar .topic-chip")].some((c) => c.textContent === "🍕 Еда"), null, 10000);
    if (await B.evaluate(() => !!document.querySelector("#topic-bar .topic-chip.add"))) throw new Error("member sees add");
    const texts = () => B.evaluate(() => [...document.querySelectorAll(".msg-row .bubble-text")].map((b) => b.textContent).join("|"));
    await L.until(B, () => /где пицца/.test(document.body.textContent) && /всем привет/.test(document.body.textContent), null, 10000);
    await B.evaluate(() => [...document.querySelectorAll("#topic-bar .topic-chip")].find((c) => c.textContent === "🍕 Еда").click());
    await B.waitForTimeout(400);
    const t1 = await texts();
    if (!/где пицца/.test(t1) || /всем привет/.test(t1)) throw new Error("topic filter: " + t1);
    await B.evaluate(() => [...document.querySelectorAll("#topic-bar .topic-chip")].find((c) => /Общее/.test(c.textContent)).click());
    await B.waitForTimeout(400);
    const t2 = await texts();
    if (/где пицца/.test(t2) || !/всем привет/.test(t2)) throw new Error("general filter: " + t2);
    if (process.env.SHOT) { await B.evaluate(() => [...document.querySelectorAll("#topic-bar .topic-chip")][0].click()); await B.waitForTimeout(600); await B.screenshot({ path: process.env.SHOT }); }
  });
  await L.check("topic bar is hidden in a 1:1 chat", async () => {
    await H.backToList(B);
    await H.openChatByName(B, "Пётр");
    await B.waitForTimeout(500);
    if (!(await B.evaluate(() => document.getElementById("topic-bar").classList.contains("hidden")))) throw new Error("visible");
  });
  console.log("\nerrors:\n" + [...A.errors, ...B.errors, ...(A2?.errors || [])].join("\n"));
  console.log(`\n${L.passed()} passed, ${L.failures.length} failed`);
  await browser.close();
  process.exitCode = L.failures.length ? 1 : 0;
})();
