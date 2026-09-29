// Two-user end-to-end harness: the real app, Firebase emulators, local "Cloudinary".
const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");
const SDK = require("path").join(__dirname, "..", "node_modules", "firebase-sdk");
const BASE = "http://localhost:8765";
const uploads = new Map();
let uploadSeq = 0;

function parseMultipartFile(buf, contentType) {
  const boundary = "--" + /boundary=([^;]+)/.exec(contentType)[1];
  const parts = buf.toString("latin1").split(boundary);
  for (const p of parts) {
    if (!/name="file"/.test(p)) continue;
    const head = p.indexOf("\r\n\r\n");
    const body = p.slice(head + 4, p.lastIndexOf("\r\n"));
    const type = (/Content-Type: ([^\r\n]+)/.exec(p) || [])[1] || "application/octet-stream";
    return { data: Buffer.from(body, "latin1"), type };
  }
  return null;
}

async function launch() {
  return chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ["--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream", "--autoplay-policy=no-user-gesture-required"] });
}

async function userContext(browser, name, { mobile = false } = {}) {
  const ctx = await browser.newContext(
    mobile ? { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 } : { viewport: { width: 1400, height: 900 } }
  );
  await ctx.grantPermissions(["camera", "microphone", "clipboard-read", "clipboard-write"], { origin: BASE });
  await ctx.addInitScript(() => {
    try { localStorage.setItem("lm-emulator", "1"); } catch (_) {}
  });
  await ctx.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
  await ctx.route(/www\.gstatic\.com\/firebasejs\/10\.12\.2\/(.+\.js)$/, (r) => {
    const file = /firebasejs\/10\.12\.2\/(.+\.js)$/.exec(r.request().url())[1];
    r.fulfill({ contentType: "text/javascript", body: fs.readFileSync(path.join(SDK, file)) });
  });
  await ctx.route(/googlefonts\.github\.io|fonts\.gstatic\.com\/s\/e\/notoemoji/, (r) => r.abort());
  await ctx.route(/api\.cloudinary\.com/, async (r) => {
    const req = r.request();
    const f = parseMultipartFile(req.postDataBuffer(), req.headers()["content-type"]);
    const id = "u" + ++uploadSeq;
    const ext = (f?.type || "").includes("jpeg") ? "jpg" : (f?.type || "").split("/")[1] || "bin";
    uploads.set(id, f);
    r.fulfill({ contentType: "application/json", body: JSON.stringify({ secure_url: `${BASE}/__up/${id}.${ext}`, public_id: id }), headers: { "Access-Control-Allow-Origin": "*" } });
  });
  await ctx.route(/\/__up\//, (r) => {
    const id = /__up\/(u\d+)/.exec(r.request().url())[1];
    const f = uploads.get(id);
    r.fulfill({ status: f ? 200 : 404, contentType: f?.type || "application/octet-stream", body: f?.data || "", headers: { "Access-Control-Allow-Origin": "*" } });
  });
  // Vercel's cleanUrls: /login → login.html
  await ctx.route(/localhost:8765\/login(\?.*)?$/, (r) => r.continue({ url: r.request().url().replace("/login", "/login.html") }));
  await ctx.route(/\/api\/turn/, (r) => r.fulfill({ contentType: "application/json", body: JSON.stringify({ iceServers: [], configured: false }) }));
  await ctx.route(/\/api\/preview/, (r) => r.fulfill({ status: 204 }));
  const page = await ctx.newPage();
  page.errors = [];
  page.on("pageerror", (e) => page.errors.push(`[${name}] pageerror: ${e.message}`));
  page.on("console", (m) => {
    const t = m.text();
    if (m.type() === "error" && !/ERR_ABORTED|ERR_FAILED|fonts|favicon|Failed to load resource/.test(t)) page.errors.push(`[${name}] console.error: ${t.slice(0, 300)}`);
  });
  page.userName = name;
  pages.push(page);
  return page;
}

async function register(page, username, nickname, password = "secret123") {
  await page.goto(BASE + "/login.html");
  await page.waitForTimeout(1500);
  await page.click("#switch-mode-btn");
  await page.waitForTimeout(400);
  await page.fill("#username-input", username);
  await page.click("#auth-submit");
  await page.waitForTimeout(1200);
  await page.fill("#nickname-input", nickname);
  await page.click("#auth-submit");
  await page.waitForTimeout(700);
  await page.fill("#password-input", password);
  await page.fill("#confirm-password-input", password);
  await page.click("#auth-submit");
  await page.waitForURL((u) => !u.pathname.includes("login"), { timeout: 20000 });
  await page.waitForSelector("#app:not(.hidden)", { timeout: 20000 });
  await page.waitForTimeout(2500);
}

const pages = [];
async function dump() {
  for (const p of pages) {
    const st = await p.evaluate(() => ({
      title: document.getElementById("chat-title")?.textContent,
      msgs: [...document.querySelectorAll(".msg-row")].slice(-6).map((r) => (r.classList.contains("me") ? "me: " : "them: ") + r.innerText.split(String.fromCharCode(10)).join(" ").slice(0, 90)),
      overlays: [...document.querySelectorAll("[id$=-overlay]:not(.hidden)")].map((o) => o.id),
    })).catch((e) => ({ err: e.message }));
    console.log("     [" + p.userName + "] " + JSON.stringify(st));
    if (p.errors.length) console.log("     [" + p.userName + "] errors: " + p.errors.splice(0).join(" | ").slice(0, 600));
  }
}
let passed = 0;
const failures = [];
async function check(name, fn) {
  try {
    const r = await fn();
    if (r === false) throw new Error("condition false");
    passed++;
    console.log("  ✓ " + name);
  } catch (e) {
    failures.push(name + ": " + String(e.message || e).split("\n")[0].slice(0, 220));
    console.log("  ✗ " + name + " — " + String(e.message || e).split("\n")[0].slice(0, 220));
    await dump();
  }
}
const until = async (page, fn, arg, timeout = 8000) => page.waitForFunction(fn, arg, { timeout, polling: 150 });

module.exports = { launch, userContext, register, check, until, passed: () => passed, failures, BASE, uploads };
// Admin read straight from the emulator (bypasses rules), for assertions.
module.exports.adminQuery = async (collectionId) => {
  const r = await fetch("http://127.0.0.1:8088/v1/projects/linkage-massege/databases/(default)/documents:runQuery", {
    method: "POST",
    headers: { Authorization: "Bearer owner", "Content-Type": "application/json" },
    body: JSON.stringify({ structuredQuery: { from: [{ collectionId, allDescendants: true }] } }),
  });
  const rows = await r.json();
  const plain = (v) => (v == null ? v : "stringValue" in v ? v.stringValue : "integerValue" in v ? +v.integerValue : "booleanValue" in v ? v.booleanValue : "mapValue" in v ? Object.fromEntries(Object.entries(v.mapValue.fields || {}).map(([k, x]) => [k, plain(x)])) : "arrayValue" in v ? (v.arrayValue.values || []).map(plain) : "timestampValue" in v ? v.timestampValue : "nullValue" in v ? null : v);
  return rows.filter((x) => x.document).map((x) => ({ path: x.document.name.split("/documents/")[1], ...Object.fromEntries(Object.entries(x.document.fields || {}).map(([k, v]) => [k, plain(v)])) }));
};
