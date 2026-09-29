const L = require("./lib.cjs");
(async () => {
  const browser = await L.launch();
  const tag = Date.now().toString(36).slice(-4);
  const A = await L.userContext(browser, "A");
  const B = await L.userContext(browser, "B", { mobile: true });
  const ua = "anna_" + tag, ub = "boris_" + tag;
  console.log("== registration");
  await L.check("A registers", () => L.register(A, ua, "Анна"));
  await L.check("B registers (mobile)", () => L.register(B, ub, "Борис"));
  console.log("== first chat");
  await L.check("A finds B by username prefix", async () => {
    await A.fill("#search-input", ub);
    await L.until(A, (u) => [...document.querySelectorAll("#search-result .person-row")].some((r) => r.textContent.includes("@" + u)), ub);
  });
  await L.check("A opens chat with B", async () => {
    await A.evaluate((u) => [...document.querySelectorAll("#search-result .person-row")].find((r) => r.textContent.includes("@" + u)).querySelector('[data-act="main"]').click(), ub);
    await L.until(A, () => document.getElementById("chat-title")?.textContent.includes("Борис"));
  });
  await L.check("A sends a message", async () => {
    await A.fill("#msg-input", "Привет, Борис! Смотри linkage.app");
    await A.press("#msg-input", "Enter");
    await L.until(A, () => [...document.querySelectorAll(".msg-row.me .bubble-text")].some((b) => b.textContent.includes("Привет, Борис")));
  });
  await L.check("B sees the chat in the list with an unread badge", async () => {
    await L.until(B, () => [...document.querySelectorAll("#chat-list .room-item")].some((r) => r.textContent.includes("Анна") && r.querySelector(".unread-badge")), null, 12000);
  });
  await L.check("B opens and reads it (decrypted)", async () => {
    await B.evaluate(() => [...document.querySelectorAll("#chat-list .room-item")].find((r) => r.textContent.includes("Анна")).click());
    await L.until(B, () => [...document.querySelectorAll(".msg-row:not(.me) .bubble-text")].some((b) => b.textContent.includes("Привет, Борис")));
  });
  await L.check("1:1 messages are stored encrypted (no plaintext)", async () => {
    const msgs = (await L.adminQuery("messages")).filter((m) => m.path.startsWith("chats/"));
    if (!msgs.length) throw new Error("no messages");
    const leak = msgs.filter((m) => !m.enc || /Привет/.test(m.text || ""));
    if (leak.length) throw new Error("plaintext: " + JSON.stringify(leak[0]).slice(0, 200));
    const chat = (await L.adminQuery("chats"))[0];
    if (/Привет/.test(chat.lastMessage || "")) throw new Error("preview leaks: " + chat.lastMessage);
  });
  await L.check("link in message is highlighted", () => B.evaluate(() => !!document.querySelector('.msg-row:not(.me) .bubble-text a[href="https://linkage.app"]')));
  await L.check("B replies", async () => {
    await B.fill("#msg-input", "Привет, Анна 👋");
    await B.press("#msg-input", "Enter");
    await L.until(A, () => [...document.querySelectorAll(".msg-row:not(.me) .bubble-text")].some((b) => b.textContent.includes("Привет, Анна")), null, 10000);
  });
  await L.check("A sees read ticks after B read", () => L.until(A, () => !!document.querySelector('.msg-row.me .msg-tick[data-state="read"]'), null, 10000));
  console.log("\nerrors:\n" + [...A.errors, ...B.errors].join("\n"));
  console.log(`\n${L.passed()} passed, ${L.failures.length} failed`);
  await browser.close();
  process.exitCode = L.failures.length ? 1 : 0;
})();
