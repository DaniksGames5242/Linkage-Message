// GET /api/preview?url=… — link preview (title, description, image, site)
// for a URL typed into a message, like Telegram's web page previews.
// Only signed-in users; refuses private/internal addresses.

const dns = require("dns").promises;
const net = require("net");
const { verifyUser } = require("./_auth.js");

const MAX_BYTES = 512 * 1024;

function privateIp(ip) {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split(".").map(Number);
    return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || a >= 224;
  }
  const v = ip.toLowerCase();
  if (v.startsWith("::ffff:")) return privateIp(v.slice(7));
  return v === "::1" || v === "::" || v.startsWith("fc") || v.startsWith("fd") || v.startsWith("fe80");
}

async function assertPublic(u) {
  if (!/^https?:$/.test(u.protocol)) throw new Error("bad scheme");
  if (u.username || u.password) throw new Error("credentials in url");
  const host = u.hostname.replace(/^\[|\]$/g, "");
  if (/^(localhost|.*\.local|.*\.internal)$/i.test(host)) throw new Error("private host");
  const addrs = net.isIP(host) ? [{ address: host }] : await dns.lookup(host, { all: true });
  if (!addrs.length || addrs.some((a) => privateIp(a.address))) throw new Error("private address");
}

async function fetchPage(url) {
  let u = new URL(url);
  for (let hop = 0; hop < 4; hop++) {
    await assertPublic(u);
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 5000);
    const r = await fetch(u, {
      redirect: "manual",
      signal: ctrl.signal,
      headers: { "User-Agent": "Mozilla/5.0 (compatible; LinkageBot/1.0; +link preview)", Accept: "text/html,application/xhtml+xml,image/*;q=0.8,*/*;q=0.5", "Accept-Language": "ru,en;q=0.8" },
    });
    if (r.status >= 300 && r.status < 400 && r.headers.get("location")) {
      clearTimeout(timer);
      u = new URL(r.headers.get("location"), u);
      continue;
    }
    const type = r.headers.get("content-type") || "";
    let body = "";
    if (/text\/html|xhtml/.test(type) && r.body) {
      const reader = r.body.getReader();
      const chunks = [];
      let size = 0;
      while (size < MAX_BYTES) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
        size += value.length;
      }
      reader.cancel().catch(() => {});
      body = Buffer.concat(chunks).toString("utf8");
    }
    clearTimeout(timer);
    return { finalUrl: u, type, body, ok: r.ok };
  }
  throw new Error("too many redirects");
}

const decode = (s) =>
  s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/\s+/g, " ")
    .trim();

function meta(html, names) {
  for (const name of names) {
    const re = new RegExp(`<meta[^>]+(?:property|name)=["']${name}["'][^>]*>`, "i");
    const tag = html.match(re)?.[0];
    const content = tag?.match(/content=["']([^"']*)["']/i)?.[1];
    if (content) return decode(content);
  }
  return "";
}

module.exports = async (req, res) => {
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Cache-Control", "private, max-age=3600");
  try {
    if (!(await verifyUser(req))) {
      res.statusCode = 401;
      return res.end(JSON.stringify({ error: "sign in required" }));
    }
    const raw = new URL(req.url, "http://x").searchParams.get("url") || "";
    if (raw.length > 2000) throw new Error("url too long");
    const page = await fetchPage(raw);
    const base = page.finalUrl;
    if (/^image\//.test(page.type)) {
      return res.end(JSON.stringify({ url: raw, image: base.href, site: base.hostname }));
    }
    const html = page.body;
    const title = meta(html, ["og:title", "twitter:title"]) || decode(html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1] || "");
    const description = meta(html, ["og:description", "twitter:description", "description"]);
    let image = meta(html, ["og:image:secure_url", "og:image", "twitter:image", "twitter:image:src"]);
    if (image) {
      try {
        image = new URL(image, base).href;
        if (!/^https?:/.test(image)) image = "";
      } catch {
        image = "";
      }
    }
    const site = meta(html, ["og:site_name"]) || base.hostname.replace(/^www\./, "");
    if (!title && !description && !image) {
      res.statusCode = 204;
      return res.end();
    }
    res.end(
      JSON.stringify({
        url: raw,
        title: title.slice(0, 200),
        description: description.slice(0, 300),
        image: image.slice(0, 1000),
        site: site.slice(0, 80),
      })
    );
  } catch (err) {
    res.statusCode = 422;
    res.end(JSON.stringify({ error: String(err.message || err) }));
  }
};
