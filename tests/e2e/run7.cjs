// Phone behaviour: real touch gestures, system Back, a flaky network and a
// long chat history.
const L = require("./lib.cjs");
const H = require("./helpers.cjs");
const path = require("path");
const section = (s) => console.log("\n== " + s);
async function touch(page) {
  const cdp = await page.context().newCDPSession(page);
  const send = (type, pts) => cdp.send("Input.dispatchTouchEvent", { type, touchPoints: pts.map(([x, y]) => ({ x, y })) });
  return {
    async tap(x, y) { await send("touchStart", [[x, y]]); await page.waitForTimeout(60); await send("touchEnd", []); },
    async hold(x, y, ms = 800) { await send("touchStart", [[x, y]]); await page.waitForTimeout(ms); await send("touchEnd", []); },
    async swipe(x0, y0, x1, y1, steps = 14) {
      await send("touchStart", [[x0, y0]]);
      for (let i = 1; i <= steps; i++) { await send("touchMove", [[x0 + ((x1 - x0) * i) / steps, y0 + ((y1 - y0) * i) / steps]]); await page.waitForTimeout(16); }
      await send("touchEnd", []);
    },
  };
}
const center = (p, sel, text) => p.evaluate(([s, t]) => { const e = [...document.querySelectorAll(s)].filter((x) => !t || x.textContent.includes(t)).pop(); if (!e) throw new Error("no " + s + " " + (t || "")); const r = e.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2, r: r.right }; }, [sel, text]);
const menus = (p) => p.evaluate(() => document.querySelectorAll(".ctx-menu").length);
const chatOpen = (p) => p.evaluate(() => document.getElementById("sidebar").classList.contains("chat-open"));
(async () => {
  const browser = await L.launch();
  const tag = Date.now().toString(36).slice(-4);
  const A = await L.userContext(browser, "A", { mobile: true });
  const B = await L.userContext(browser, "B");
  const ua = "tonya_" + tag, ub = "timur_" + tag;
  let T;
  section("setup");
  await L.check("register, B writes to A", async () => {
    await L.register(A, ua, "Тоня"); await L.register(B, ub, "Тимур");
    await B.fill("#search-input", ua);
    await L.until(B, (u) => [...document.querySelectorAll("#search-result .person-row")].some((r) => r.textContent.includes("@" + u)), ua);
    await B.evaluate((u) => [...document.querySelectorAll("#search-result .person-row")].find((r) => r.textContent.includes("@" + u)).querySelector('[data-act="main"]').click(), ua);
    await L.until(B, () => document.getElementById("chat-title")?.textContent.includes("Тоня"));
    for (const t of ["раз", "два", "три"]) await H.send(B, t);
    await L.until(A, () => [...document.querySelectorAll("#chat-list .room-name")].some((n) => n.textContent.includes("Тимур")));
    T = await touch(A);
  });

  section("touch gestures");
  await L.check("long press on a chat opens one menu; the next tap opens the chat", async () => {
    const r = await center(A, "#chat-list .room-item", "Тимур");
    await T.hold(r.x, r.y); await A.waitForTimeout(500);
    if ((await menus(A)) !== 1) throw new Error("menus: " + (await menus(A)));
    await A.keyboard.press("Escape"); await A.waitForTimeout(500);
    await T.tap(r.x, r.y);
    await L.until(A, () => document.getElementById("sidebar").classList.contains("chat-open"));
    await A.waitForTimeout(800);
  });
  await L.check("long press on a message keeps its menu open after lifting the finger", async () => {
    const b = await center(A, ".msg-row .bubble", "раз");
    await T.hold(b.x, b.y); await A.waitForTimeout(600);
    if ((await menus(A)) !== 1) throw new Error("menu closed");
    await A.keyboard.press("Escape"); await A.waitForTimeout(500);
  });
  await L.check("double tap reacts without opening the menu", async () => {
    const b = await center(A, ".msg-row .bubble", "три");
    await T.tap(b.x, b.y); await A.waitForTimeout(110); await T.tap(b.x, b.y); await A.waitForTimeout(900);
    if (await menus(A)) throw new Error("menu opened");
    await L.until(A, () => [...document.querySelectorAll(".msg-row")].pop().textContent.includes("❤"));
  });
  await L.check("swipe a message left to reply", async () => {
    const b = await center(A, ".msg-row .bubble", "два");
    await T.swipe(b.x + 60, b.y, b.x - 70, b.y); await A.waitForTimeout(600);
    await L.until(A, () => !document.getElementById("reply-preview").classList.contains("hidden"));
    await A.evaluate(() => document.getElementById("reply-cancel-btn").click()); await A.waitForTimeout(400);
  });
  await L.check("system Back closes the menu first, then the chat, and stays in the app", async () => {
    const b = await center(A, ".msg-row .bubble", "раз");
    await T.hold(b.x, b.y); await A.waitForTimeout(500);
    await A.evaluate(() => history.back()); await A.waitForTimeout(600);
    if (await menus(A)) throw new Error("menu still open");
    if (!(await chatOpen(A))) throw new Error("chat closed too early");
    await A.evaluate(() => document.body.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }))); // re-arm (a real tap would)
    await A.evaluate(() => history.back()); await A.waitForTimeout(800);
    if (await chatOpen(A)) throw new Error("chat still open");
    if (!A.url().startsWith(L.BASE + "/") || A.url().includes("login")) throw new Error("left the app: " + A.url());
  });
  await L.check("swiping a chat row archives it without opening its menu", async () => {
    const r = await center(A, "#chat-list .room-item", "Тимур");
    await T.swipe(r.r - 20, r.y, r.r - 270, r.y + 3, 16); await A.waitForTimeout(1300);
    if (await menus(A)) throw new Error("menu opened");
    await L.until(A, () => [...document.querySelectorAll("#chat-list .room-name")].some((n) => /Архив/.test(n.textContent)));
    await A.evaluate(() => [...document.querySelectorAll("#chat-list .room-item")].find((r) => /Архив/.test(r.textContent)).click()); await A.waitForTimeout(600);
    const r2 = await center(A, "#chat-list .room-item", "Тимур");
    await T.swipe(r2.r - 20, r2.y, r2.r - 270, r2.y + 3, 16); await A.waitForTimeout(1300);
    await A.evaluate(() => document.querySelector(".archive-back, #chat-list .archive-head button")?.click()); await A.waitForTimeout(600);
  });

  section("network");
  await L.check("offline: header says so, message waits with a clock and goes out on reconnect", async () => {
    await H.openChatByName(A, "Тимур");
    await A.context().setOffline(true); await A.waitForTimeout(400);
    const hdr = await A.evaluate(() => getComputedStyle(document.querySelector(".chat-header-meta"), "::after").content);
    if (!/ожидание сети/.test(hdr)) throw new Error("header: " + hdr);
    await A.fill("#msg-input", "без сети"); await A.press("#msg-input", "Enter"); await A.waitForTimeout(1200);
    const st = await A.evaluate(() => [...document.querySelectorAll(".msg-row.me")].pop().querySelector("[data-state]")?.dataset.state);
    if (st !== "pending") throw new Error("state " + st);
    await A.context().setOffline(false);
    await H.seeText(B, "без сети", false, 15000);
  });
  await L.check("offline photo: no second 'uploading' copy next to the queued message", async () => {
    await A.context().setOffline(true); await A.waitForTimeout(300);
    await A.setInputFiles("#attach-input", path.join(__dirname, "fixtures", "pic.png")); await A.waitForTimeout(800);
    await A.evaluate(() => document.getElementById("media-send").click()); await A.waitForTimeout(4000);
    const up = await A.evaluate(() => document.querySelectorAll(".msg-row.pending-upload").length);
    await A.context().setOffline(false);
    if (up) throw new Error("placeholder still shown");
    await L.until(B, () => [...document.querySelectorAll(".msg-row:not(.me) img.msg-image")].some((i) => i.naturalWidth > 0), null, 15000);
  });

  await L.check("pulling the photo viewer down closes it", async () => {
    await A.evaluate(() => [...document.querySelectorAll(".msg-row.me img.msg-image")].pop().click());
    await L.until(A, () => !document.getElementById("lightbox").classList.contains("hidden"));
    await A.waitForTimeout(600);
    await T.swipe(195, 400, 198, 620, 12);
    await L.until(A, () => document.getElementById("lightbox").classList.contains("hidden"));
  });
  await L.check("pulling a story down closes it", async () => {
    await H.backToList(A);
    await A.setInputFiles("#story-add-input", path.join(__dirname, "fixtures", "pic.png"));
    await A.waitForTimeout(2500);
    await A.evaluate(() => document.querySelector("#stories-strip .story-bubble .avatar")?.click());
    await L.until(A, () => !document.getElementById("story-viewer-overlay").classList.contains("hidden"));
    await A.waitForTimeout(700);
    await T.swipe(195, 300, 197, 560, 12);
    await L.until(A, () => document.getElementById("story-viewer-overlay").classList.contains("hidden"));
  });

  section("long history");
  const info = () => A.evaluate(() => {
    const m = document.getElementById("messages"); const b = m.getBoundingClientRect();
    const rows = [...document.querySelectorAll(".msg-row[data-msg-id]")];
    const top = rows.find((x) => x.getBoundingClientRect().bottom > b.top + 1);
    return { rows: rows.length, last: rows.at(-1)?.querySelector(".bubble-text").textContent.trim(), top: top?.querySelector(".bubble-text").textContent.trim(), off: top ? Math.round(top.getBoundingClientRect().top - b.top) : 0 };
  });
  await L.check("650 old messages: the newest are shown, a new one still arrives", async () => {
    const names = await L.adminQuery("usernames");
    const uidB = names.find((r) => r.path === "usernames/" + ub).uid;
    const chat = (await L.adminQuery("chats")).find((c) => (c.participants || []).includes(uidB));
    const base = Date.now() - 3 * 86400e3;
    const writes = [];
    for (let i = 0; i < 650; i++)
      writes.push({ update: { name: `projects/linkage-massege/databases/(default)/documents/${chat.path}/messages/old${String(i).padStart(4, "0")}`, fields: { text: { stringValue: "старое " + i }, senderId: { stringValue: uidB }, createdAt: { timestampValue: new Date(base + i * 60000).toISOString() } } } });
    for (let i = 0; i < writes.length; i += 400) {
      const r = await fetch("http://127.0.0.1:8088/v1/projects/linkage-massege/databases/(default)/documents:commit", { method: "POST", headers: { Authorization: "Bearer owner", "Content-Type": "application/json" }, body: JSON.stringify({ writes: writes.slice(i, i + 400) }) });
      if (!r.ok) throw new Error("seed " + r.status);
    }
    await H.backToList(A); await H.openChatByName(A, "Тимур"); await A.waitForTimeout(1500);
    await H.send(B, "самое новое");
    await H.seeText(A, "самое новое", false);
    const i = await info();
    if (i.rows > 320) throw new Error("rendered " + i.rows + " rows");
  });
  await L.check("scrolling to the top loads older messages and keeps the place", async () => {
    await A.evaluate(() => { const m = document.getElementById("messages"); m.dispatchEvent(new WheelEvent("wheel")); m.scrollTop = 0; });
    await A.waitForTimeout(400);
    await L.until(A, () => document.querySelectorAll(".msg-row[data-msg-id]").length > 400, null, 10000);
    await A.waitForTimeout(800);
    const i = await info();
    const n = +(/старое (\d+)/.exec(i.top) || [])[1];
    if (!(n > 300 && n < 420)) throw new Error("top after load: " + i.top);
  });
  await L.check("a new message while reading history doesn't move the view", async () => {
    const before = await info();
    await H.send(B, "пока читаю");
    await A.waitForTimeout(2000);
    const after = await info();
    if (before.top !== after.top || Math.abs(before.off - after.off) > 4) throw new Error(JSON.stringify([before, after]));
  });

  section("calls relay");
  await L.check("Settings → Security → TURN check reports its state", async () => {
    await H.backToList(A);
    await A.evaluate(() => document.querySelector('#tabbar .tab[data-tab="settings"]').click()); await A.waitForTimeout(600);
    await A.evaluate(() => document.querySelector('#settings-menu [data-section="security"]').click()); await A.waitForTimeout(500);
    await A.evaluate(() => document.getElementById("turn-check-btn").click());
    await L.until(A, () => /Не настроен/.test(document.getElementById("turn-check-status").textContent), null, 12000);
  });

  console.log("\nerrors:\n" + [...A.errors, ...B.errors].join("\n"));
  console.log(`\n${L.passed()} passed, ${L.failures.length} failed`);
  await browser.close();
  process.exitCode = L.failures.length ? 1 : 0;
})();
