const L = require("./lib.cjs");
const H = require("./helpers.cjs");
(async () => {
  const browser = await L.launch();
  const tag = Date.now().toString(36).slice(-5);
  const A = await L.userContext(browser, "A", { mobile: true });
  const B = await L.userContext(browser, "B");
  await L.register(A, "pa" + tag, "Пётр");
  await L.register(B, "pb" + tag, "Борис");
  await B.fill("#search-input", "pa" + tag); await B.waitForTimeout(1500);
  await B.evaluate(() => [...document.querySelectorAll("#search-result button")].find((x) => /Написать/.test(x.textContent))?.click());
  await B.waitForTimeout(1500);
  for (let i = 0; i < 14; i++) await H.send(B, "Сообщение номер " + i);
  await A.waitForTimeout(1500);
  await H.openChatByName(A, "Борис").catch(() => H.openChatByName(A, "pb"));
  const probe = () => A.evaluate(() => {
    const s = document.querySelector(".date-sep"); const cs = getComputedStyle(s);
    return { top: cs.top, pos: cs.position, rect: Math.round(s.getBoundingClientRect().top), hs: getComputedStyle(document.getElementById("chat")).getPropertyValue("--header-space"), hsM: getComputedStyle(s).getPropertyValue("--header-space"), cls: document.getElementById("chat").className, scroll: document.getElementById("messages").scrollTop };
  });
  console.log("bottom", await probe());
  await H.msgMenu(A, "номер 13", "Закрепить"); await A.waitForTimeout(800);
  await A.evaluate(() => [...document.querySelectorAll(".ctx-menu .ctx-item")].find((x) => /Закрепить|У меня|Для всех/.test(x.textContent))?.click());
  await A.waitForTimeout(1200);
  console.log("pinned", await probe());
  await A.screenshot({ path: process.env.OUT + "/sticky.png" });
  await browser.close();
})();
