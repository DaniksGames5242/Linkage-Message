// Living backdrop: a slow, domain-warped "molten amber" field rendered with
// WebGL at low resolution. It bends toward the pointer like a liquid and
// re-tints itself smoothly whenever the accent colour changes. Everything
// glassy in the UI refracts this layer.

(function () {
  const canvas = document.getElementById("bg-canvas");
  if (!canvas) return;
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const gl = canvas.getContext("webgl", { antialias: false, alpha: false, premultipliedAlpha: false, powerPreference: "low-power" });
  if (!gl) {
    canvas.classList.add("bg-fallback");
    return;
  }

  const vert = `
    attribute vec2 p;
    void main() { gl_Position = vec4(p, 0.0, 1.0); }
  `;
  const frag = `
    precision mediump float;
    uniform vec2 uRes;
    uniform float uTime;
    uniform vec2 uMouse;
    uniform float uPress;
    uniform vec3 uA;
    uniform vec3 uB;

    float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
    float noise(vec2 p) {
      vec2 i = floor(p), f = fract(p);
      vec2 u = f * f * (3.0 - 2.0 * f);
      return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
                 mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
    }
    float fbm(vec2 p) {
      float v = 0.0, a = 0.5;
      mat2 m = mat2(1.6, 1.2, -1.2, 1.6);
      for (int i = 0; i < 5; i++) { v += a * noise(p); p = m * p; a *= 0.5; }
      return v;
    }

    void main() {
      float s = min(uRes.x, uRes.y);
      vec2 p = (gl_FragCoord.xy - 0.5 * uRes) / s;
      vec2 m = (uMouse - 0.5) * uRes / s;

      // Pointer acts like a lens pressed into the liquid.
      vec2 dm = p - m;
      float md = dot(dm, dm);
      p -= dm * (0.18 + 0.25 * uPress) * exp(-md * 5.0);

      float t = uTime * 0.035;
      vec2 q = vec2(fbm(p * 1.25 + vec2(0.0, t)), fbm(p * 1.25 + vec2(5.2, -t)));
      vec2 r = vec2(fbm(p * 1.1 + 3.2 * q + vec2(1.7, 9.2) + t * 1.4),
                    fbm(p * 1.1 + 3.2 * q + vec2(8.3, 2.8) - t * 1.1));
      float f = fbm(p * 1.2 + 2.6 * r);

      vec3 col = vec3(0.028, 0.021, 0.017);
      col = mix(col, uB * 0.24, smoothstep(0.30, 0.95, f));
      col = mix(col, uA * 0.42, smoothstep(0.66, 1.2, f * f * 1.7 + r.x * 0.35));
      col += uA * 0.08 * smoothstep(0.55, 1.05, length(q));
      // Soft caustic filaments where the warp folds.
      float fil = smoothstep(0.05, 0.0, abs(f - 0.62)) * 0.12;
      col += mix(uA, vec3(1.0, 0.95, 0.85), 0.35) * fil;
      // Pointer glow.
      col += uA * 0.06 * exp(-md * 3.0);

      float v = smoothstep(1.5, 0.15, length(p * vec2(0.85, 1.05)));
      col *= mix(0.45, 1.0, v);
      col += (hash(gl_FragCoord.xy + fract(uTime)) - 0.5) / 255.0 * 3.0; // dither
      gl_FragColor = vec4(col, 1.0);
    }
  `;

  function compile(type, src) {
    const sh = gl.createShader(type);
    gl.shaderSource(sh, src);
    gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(sh));
    return sh;
  }

  let prog;
  try {
    prog = gl.createProgram();
    gl.attachShader(prog, compile(gl.VERTEX_SHADER, vert));
    gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, frag));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
  } catch (err) {
    console.warn("Background shader disabled:", err);
    canvas.classList.add("bg-fallback");
    return;
  }
  gl.useProgram(prog);

  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(prog, "p");
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

  const U = {};
  ["uRes", "uTime", "uMouse", "uPress", "uA", "uB"].forEach((n) => (U[n] = gl.getUniformLocation(prog, n)));

  const mobile = window.matchMedia("(max-width: 720px)").matches;
  const SCALE = mobile ? 0.28 : 0.4;
  function resize() {
    const w = Math.max(64, Math.round(window.innerWidth * SCALE));
    const h = Math.max(64, Math.round(window.innerHeight * SCALE));
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
      gl.viewport(0, 0, w, h);
    }
  }
  resize();
  window.addEventListener("resize", resize);

  // Accepts "#rrggbb" or "rgb(r, g, b)" (registered colour properties
  // compute to the latter).
  const parseColor = (value) => {
    const v = (value || "").trim();
    if (/^#[0-9a-f]{6}$/i.test(v)) return [1, 3, 5].map((i) => parseInt(v.slice(i, i + 2), 16) / 255);
    const m = v.match(/rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)/i);
    return m ? [m[1], m[2], m[3]].map((n) => Number(n) / 255) : null;
  };
  let colA = [1.0, 0.64, 0.1];
  let colB = [1.0, 0.36, 0.06];
  let targetA = colA.slice();
  let targetB = colB.slice();

  // Prefer the inline target value: the computed one is mid-transition.
  function readAccent() {
    const inline = document.documentElement.style;
    const cs = getComputedStyle(document.documentElement);
    const a = parseColor(inline.getPropertyValue("--accent") || cs.getPropertyValue("--accent"));
    const b = parseColor(inline.getPropertyValue("--accent-2") || cs.getPropertyValue("--accent-2"));
    if (a) targetA = a;
    if (b) targetB = b;
  }
  readAccent();
  colA = targetA.slice();
  colB = targetB.slice();
  new MutationObserver(readAccent).observe(document.documentElement, { attributes: true, attributeFilter: ["style", "class"] });

  const mouse = { x: 0.5, y: 0.45, tx: 0.5, ty: 0.45, press: 0, tpress: 0 };
  window.addEventListener(
    "pointermove",
    (e) => {
      mouse.tx = e.clientX / window.innerWidth;
      mouse.ty = 1 - e.clientY / window.innerHeight;
    },
    { passive: true }
  );
  window.addEventListener("pointerdown", () => (mouse.tpress = 1), { passive: true });
  window.addEventListener("pointerup", () => (mouse.tpress = 0), { passive: true });

  const start = performance.now() - Math.random() * 60000;
  let last = 0;
  let running = true;
  const FRAME_MS = mobile ? 1000 / 24 : 1000 / 40;

  function draw(now) {
    const k = 0.06;
    mouse.x += (mouse.tx - mouse.x) * k;
    mouse.y += (mouse.ty - mouse.y) * k;
    mouse.press += (mouse.tpress - mouse.press) * 0.08;
    for (let i = 0; i < 3; i++) {
      colA[i] += (targetA[i] - colA[i]) * 0.04;
      colB[i] += (targetB[i] - colB[i]) * 0.04;
    }
    gl.uniform2f(U.uRes, canvas.width, canvas.height);
    gl.uniform1f(U.uTime, (now - start) / 1000);
    gl.uniform2f(U.uMouse, mouse.x, mouse.y);
    gl.uniform1f(U.uPress, mouse.press);
    gl.uniform3fv(U.uA, colA);
    gl.uniform3fv(U.uB, colB);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  function loop(now) {
    if (!running) return;
    requestAnimationFrame(loop);
    if (now - last < FRAME_MS) return;
    last = now;
    draw(now);
  }

  if (reduced) {
    draw(performance.now());
    // Still follow accent changes, just without motion.
    new MutationObserver(() => setTimeout(() => {
      colA = targetA.slice();
      colB = targetB.slice();
      draw(performance.now());
    }, 30)).observe(document.documentElement, { attributes: true, attributeFilter: ["style"] });
  } else {
    requestAnimationFrame(loop);
    document.addEventListener("visibilitychange", () => {
      running = !document.hidden;
      if (running) requestAnimationFrame(loop);
    });
  }
  requestAnimationFrame(() => canvas.classList.add("bg-ready"));
})();
