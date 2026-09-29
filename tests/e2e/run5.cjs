const L = require("./lib.cjs");
const H = require("./helpers.cjs");
const section = (s) => console.log("\n== " + s);
const DIR = require("path").join(__dirname, "fixtures");
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
  const ua = "anna_" + tag, ub = "boris_" + tag;
  section("setup");
  await L.check("register + chat", async () => {
    await L.register(A, ua, "Анна"); await L.register(B, ub, "Борис");
    await startChat(A, ub, "Борис"); await H.send(A, "привет #релиз");
    await L.until(B, () => [...document.querySelectorAll("#chat-list .room-name")].some((n) => n.textContent.includes("Анна")), null, 12000);
    await H.openChatByName(B, "Анна");
  });

  section("media & tools");
  await L.check("in-app camera: tap takes a photo that B receives", async () => {
    await H.attach(A, "Камера");
    await L.until(A, () => { const v = document.querySelector(".camera-view"); return v && v.videoWidth > 0; }, null, 10000);
    await A.evaluate(() => { const s = document.querySelector(".camera-shutter"); s.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true })); s.dispatchEvent(new PointerEvent("pointerup", { bubbles: true })); });
    await L.until(A, () => !document.getElementById("media-overlay").classList.contains("hidden"), null, 8000);
    await A.evaluate(() => document.getElementById("media-send").click());
    await L.until(B, () => [...document.querySelectorAll(".msg-row:not(.me) img.msg-image")].some((i) => i.naturalWidth > 0), null, 15000);
  });
  await L.check("music file plays in the voice player for B", async () => {
    const wav = Buffer.alloc(44 + 8000); wav.write("RIFF", 0); wav.writeUInt32LE(36 + 8000, 4); wav.write("WAVEfmt ", 8); wav.writeUInt32LE(16, 16); wav.writeUInt16LE(1, 20); wav.writeUInt16LE(1, 22); wav.writeUInt32LE(8000, 24); wav.writeUInt32LE(8000, 28); wav.writeUInt16LE(1, 32); wav.writeUInt16LE(8, 34); wav.write("data", 36); wav.writeUInt32LE(8000, 40);
    require("fs").writeFileSync(require("path").join(require("os").tmpdir(), "song.wav"), wav);
    await A.setInputFiles("#attach-input", require("path").join(require("os").tmpdir(), "song.wav"));
    await A.waitForTimeout(700);
    await A.evaluate(() => document.getElementById("media-send").click());
    await L.until(B, () => [...document.querySelectorAll(".msg-row:not(.me)")].some((r) => r.textContent.includes("song.wav") && r.querySelector(".voice-player")), null, 15000);
  });
  await L.check("PDF opens in the in-app viewer", async () => {
    await A.setInputFiles("#attach-input", DIR + "/doc.pdf");
    await A.waitForTimeout(700);
    await A.evaluate(() => document.getElementById("media-send").click());
    await L.until(B, () => [...document.querySelectorAll(".msg-row:not(.me) .msg-file-card")].some((c) => c.textContent.includes("doc.pdf")), null, 15000);
    await B.evaluate(() => [...document.querySelectorAll(".msg-row:not(.me) .msg-file-card")].find((c) => c.textContent.includes("doc.pdf")).click());
    await L.until(B, () => !!document.querySelector(".file-viewer, .fv-overlay, iframe, embed, object"), null, 8000);
    await B.keyboard.press("Escape");
    await B.waitForTimeout(500);
  });
  await L.check("hashtag tap searches the chat", async () => {
    await B.evaluate(() => document.querySelector(".msg-row .hashtag").click());
    await L.until(B, () => document.getElementById("chat-search-input").value === "#релиз" && !document.getElementById("chat-search-bar").classList.contains("hidden"));
    await B.evaluate(() => document.getElementById("chat-search-close").click());
  });
  await L.check("dice game message rolls a result for both", async () => {
    await A.fill("#msg-input", "🎲"); await A.press("#msg-input", "Enter");
    await L.until(B, () => !!document.querySelector(".msg-row:not(.me) .game-bubble"), null, 10000);
  });
  await L.check("typing indicator shows for the other side", async () => {
    await A.click("#msg-input"); await A.keyboard.type("печатаю...", { delay: 60 });
    await L.until(B, () => /печатает/.test(document.getElementById("chat-sub").textContent), null, 8000);
    await A.fill("#msg-input", "");
  });
  await L.check("encryption safety code matches on both sides", async () => {
    const code = async (P) => { await P.evaluate(() => document.getElementById("chat-header-info").click()); await P.waitForTimeout(1500); const c = await P.evaluate(() => document.getElementById("profile-view-e2e-value").textContent.trim()); await P.evaluate(() => document.getElementById("profile-view-close-btn").click()); await P.waitForTimeout(400); return c; };
    const a = await code(A), b = await code(B);
    if (!a || a !== b || /Включится/.test(a)) throw new Error(`A="${a}" B="${b}"`);
  });

  section("account");
  await L.check("profile link ?u= opens the profile", async () => {
    await A.goto(L.BASE + "/?u=" + ub);
    await L.until(A, () => document.getElementById("chat-title")?.textContent.includes("Борис"), null, 12000);
  });
  await L.check("change password, log out, log in with the new one", async () => {
    await A.evaluate(() => document.querySelector('.tab[data-tab="settings"]').click()); await A.waitForTimeout(700);
    await A.evaluate(() => document.querySelector('.settings-menu-item[data-section="sessions"]').click()); await A.waitForTimeout(700);
    await A.fill("#pw-current", "secret123"); await A.fill("#pw-new", "newsecret456"); await A.fill("#pw-confirm", "newsecret456");
    await A.evaluate(() => document.getElementById("pw-save-btn").click());
    await A.waitForTimeout(2500);
    const err = await A.evaluate(() => document.getElementById("pw-error").textContent);
    if (err && !/изменён/.test(err)) throw new Error("pw error: " + err);
    await A.evaluate(() => document.getElementById("sessions-logout-btn").click()).catch(() => {});
    await A.waitForTimeout(4000);
    if (!A.url().includes("login")) throw new Error("not logged out: " + A.url());
    await A.fill("#username-input", ua); await A.click("#auth-submit"); await A.waitForTimeout(1200);
    await A.fill("#password-input", "newsecret456"); await A.click("#auth-submit");
    await A.waitForSelector("#app:not(.hidden)", { timeout: 15000 });
  });
  await L.check("wrong password is rejected with a message", async () => {
    const P = await L.userContext(browser, "P");
    await P.goto(L.BASE + "/login.html"); await P.waitForTimeout(1200);
    await P.fill("#username-input", ua); await P.click("#auth-submit"); await P.waitForTimeout(1200);
    await P.fill("#password-input", "wrong-pass"); await P.click("#auth-submit");
    await L.until(P, () => document.getElementById("auth-error").textContent.length > 0, null, 10000);
    const t = await P.evaluate(() => document.getElementById("auth-error").textContent);
    if (/firebase|auth\//i.test(t)) throw new Error("raw error shown: " + t);
    P.errors.length = 0;
  });
  await L.check("passcode lock: set, lock now, unlock", async () => {
    await A.evaluate(() => document.querySelector('.tab[data-tab="settings"]').click()); await A.waitForTimeout(700);
    await A.evaluate(() => document.querySelector('.settings-menu-item[data-section="security"]').click()); await A.waitForTimeout(700);
    await A.evaluate(() => { const c = document.getElementById("lock-enabled"); c.checked = true; c.dispatchEvent(new Event("change", { bubbles: true })); });
    const pin = async () => { for (const d of "1357") { await A.evaluate((d) => [...document.querySelectorAll(".lock-key")].find((k) => k.textContent === d).click(), d); await A.waitForTimeout(120); } await A.waitForTimeout(700); };
    await A.waitForTimeout(700); await pin(); await pin();
    await A.evaluate(() => document.getElementById("lock-now").click());
    await L.until(A, () => !document.getElementById("lock-screen").classList.contains("hidden"));
    await pin();
    await L.until(A, () => document.getElementById("lock-screen").classList.contains("hidden"));
  });
  await L.check("delete account removes the profile", async () => {
    const C = await L.userContext(browser, "C");
    await L.register(C, "cyril_" + tag, "Кирилл");
    await C.evaluate(() => document.querySelector('.tab[data-tab="settings"]').click()); await C.waitForTimeout(700);
    await C.evaluate(() => document.querySelector('.settings-menu-item[data-section="sessions"]').click()); await C.waitForTimeout(700);
    await C.evaluate(() => document.getElementById("delete-account-open-btn").click()); await C.waitForTimeout(500);
    await C.fill("#delete-account-password", "secret123");
    await C.evaluate(() => document.getElementById("delete-account-confirm-btn").click()).catch(() => {});
    await C.waitForTimeout(5000);
    if (!C.url().includes("login")) throw new Error("still at " + C.url());
    const users = await L.adminQuery("usernames");
    if (users.some((u) => u.path.endsWith("cyril_" + tag))) throw new Error("username still taken");
  });

  console.log("\nerrors:\n" + [...A.errors, ...B.errors].join("\n"));
  console.log(`\n${L.passed()} passed, ${L.failures.length} failed`);
  await browser.close();
  process.exitCode = L.failures.length ? 1 : 0;
})();
