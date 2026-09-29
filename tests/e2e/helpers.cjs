const L = require("./lib.cjs");
const H = {
  async openChatByName(page, name) {
    await page.evaluate((n) => {
      const r = [...document.querySelectorAll("#chat-list .room-item")].find((x) => x.querySelector(".room-name")?.textContent.includes(n));
      if (!r) throw new Error("no chat row " + n);
      r.click();
    }, name);
    await L.until(page, (n) => document.getElementById("chat-title")?.textContent.includes(n), name);
    await page.waitForTimeout(800);
  },
  async backToList(page) {
    await page.evaluate(() => document.getElementById("back-to-list-btn")?.click());
    await page.waitForTimeout(600);
  },
  async send(page, text) {
    await page.fill("#msg-input", text);
    await page.press("#msg-input", "Enter");
    const shown = text.replace(/\*\*|__|~~|\|\||`/g, "");
    await L.until(page, (t) => [...document.querySelectorAll(".msg-row.me .bubble")].some((b) => b.textContent.includes(t)), shown);
    await page.waitForTimeout(300);
  },
  async seeText(page, text, mine = null, timeout = 10000) {
    await L.until(page, ([t, m]) => [...document.querySelectorAll(m === null ? ".msg-row .bubble" : m ? ".msg-row.me .bubble" : ".msg-row:not(.me) .bubble")].some((b) => b.textContent.includes(t)), [text, mine], timeout);
  },
  async gone(page, text, timeout = 10000) {
    await L.until(page, (t) => ![...document.querySelectorAll(".msg-row .bubble")].some((b) => b.textContent.includes(t)), text, timeout);
  },
  async msgMenu(page, text, label) {
    await page.evaluate((t) => {
      const b = [...document.querySelectorAll(".msg-row .bubble")].reverse().find((x) => x.textContent.includes(t));
      if (!b) throw new Error("no bubble " + t);
      b.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, clientX: 200, clientY: 300 }));
    }, text);
    await page.waitForTimeout(450);
    if (label === null) return;
    await page.evaluate((l) => {
      const it = [...document.querySelectorAll(".ctx-menu .ctx-item")].find((x) => x.textContent.trim().startsWith(l));
      if (!it) throw new Error("no menu item " + l + " in: " + [...document.querySelectorAll(".ctx-menu .ctx-item")].map((x) => x.textContent.trim()).join(","));
      it.click();
    }, label);
    await page.waitForTimeout(500);
  },
  async ctxItem(page, label) {
    await page.evaluate((l) => {
      const it = [...document.querySelectorAll(".ctx-menu .ctx-item")].find((x) => x.textContent.trim().startsWith(l));
      if (!it) throw new Error("no menu item " + l + " in: " + [...document.querySelectorAll(".ctx-menu .ctx-item")].map((x) => x.textContent.trim()).join(","));
      it.click();
    }, label);
    await page.waitForTimeout(500);
  },
  async attach(page, label) {
    await page.evaluate(() => document.getElementById("attach-btn").click());
    await page.waitForTimeout(400);
    await H.ctxItem(page, label);
  },
};
module.exports = H;
