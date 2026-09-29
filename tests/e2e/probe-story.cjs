const L = require("./lib.cjs");
const path = require("path");
(async () => {
  const browser = await L.launch();
  const A = await L.userContext(browser, "A", { mobile: true });
  await L.register(A, "st" + Date.now().toString(36).slice(-5), "Стас");
  await A.setInputFiles("#story-add-input", path.join(__dirname, "fixtures", "pic.png"));
  await A.waitForTimeout(2500);
  await A.evaluate(() => document.querySelector("#stories-strip .story-bubble .avatar, #stories-strip .story-bubble")?.click());
  await A.waitForTimeout(400);
  console.log(await A.evaluate(() => {
    const out = {};
    for (const s of ["#story-progress-track", ".story-viewer-header", "#story-viewer-avatar", "#story-viewer-name", ".story-nav-prev", ".story-nav-next", "#story-viewer-image"]) {
      const e = document.querySelector(s); const r = e.getBoundingClientRect(); const cs = getComputedStyle(e);
      out[s] = [Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height), cs.opacity, cs.visibility, cs.zIndex, e.textContent.slice(0, 20)];
    }
    const at = document.elementFromPoint(60, 40); out.at = at && (at.id || at.className);
    out.anims = document.getAnimations().map((a) => a.effect?.target?.id || a.effect?.target?.className).slice(0, 10);
    return JSON.stringify(out, null, 1);
  }));
  await A.waitForTimeout(1500);
  await A.screenshot({ path: process.env.OUT + "/story2.png" });
  await browser.close();
})();
