/**
 * Glass Rod: a small WebGL demo of the same idea as the glass edge.
 *
 * A horizontal glass rod floats slowly over a canvas and bends what's
 * underneath. Runs in every browser with WebGL (no SVG filters involved).
 *
 * - Lens: the rod magnifies its centre. Profile g(t) = t − (1 − m)·t·(1 − t)^q
 *   with g(0) = 0, g(1) = 1 and slope 1 at the edge, so there's no seam where
 *   the glass ends. m = magnification in the centre, q = how pointed it is.
 * - Drift: content spreads outwards at the sides, not at all in the middle.
 * - Fringe: red and blue bend a little less and a little more.
 * - Blur: vertical smear, strongest in the centre, growing with the rod's height.
 *
 * In auto mode the parameters cycle through presets. Pauses offscreen, in a
 * background tab and with "reduce motion" (then a calm still frame).
 *
 * Usage:
 *   import { createGlassRod } from './src/glass-rod.js'
 *   const rod = createGlassRod(canvas, { text: 'Glass Refraction' })
 *   rod.setParams({ magnify: 0.5, peak: 0.4, drift: 0.02, fringe: 0.04, blur: 0.3 })
 *   rod.setParams(null) // back to auto
 */
// Gentle on purpose: on a small canvas, strong values look broken quickly.
export const presets = [
  { magnify: 0.7, peak: 0.25, drift: 0.015, fringe: 0.03, blur: 0.35 },
  { magnify: 0.52, peak: 0.55, drift: 0.025, fringe: 0.05, blur: 0.45 },
  // now and then: extreme
  { magnify: 0.3, peak: 0.7, drift: 0.05, fringe: 0.11, blur: 0.9 },
  { magnify: 0.84, peak: 0.1, drift: 0.01, fringe: 0.02, blur: 0.2 },
  { magnify: 0.62, peak: 0.4, drift: 0.02, fringe: 0.04, blur: 0.35 },
  // now and then: extreme
  { magnify: 0.36, peak: 0.15, drift: 0.045, fringe: 0.09, blur: 0.7 },
];
const HOLD = 3.2; // s per preset
const BLEND = 2.4; // s blend
const BAND_HALF = 0.3; // half rod height, share of the canvas height
const FLOAT_PERIOD = 16; // s for one float up and down
const FLOAT_RANGE = 0.22; // rod centre floats between 28 % and 72 % of the height
const FLOAT_LOW = 0.5 - FLOAT_RANGE; // highest point (top, small y)
const FLOAT_HIGH = 0.5 + FLOAT_RANGE; // lowest point
const VERT = `
attribute vec2 aPos;
varying vec2 vUv;
void main() {
  vUv = vec2((aPos.x + 1.0) * 0.5, (1.0 - aPos.y) * 0.5);
  gl_Position = vec4(aPos, 0.0, 1.0);
}`;
const FRAG = `
precision mediump float;
uniform sampler2D uTex;
uniform float uCenter;
uniform float uHalf;
uniform float uPeak;
uniform float uMag;
uniform float uDrift;
uniform float uFringe;
uniform float uBlur;
varying vec2 vUv;

vec2 bend(vec2 uv, float k) {
  float s = (uv.y - uCenter) / uHalf;
  float t = abs(s);
  if (t >= 1.0) return uv;
  // q = how pointed: g(0) = 0, g(1) = 1, slope m in the centre, 1 at the edge.
  float q = 2.0 + uPeak * 10.0;
  float g = t - (1.0 - uMag) * t * pow(1.0 - t, q);
  float w = pow(1.0 - t, q);
  vec2 src = vec2(uv.x + uDrift * (1.0 - 2.0 * uv.x) * w, uCenter + sign(s) * g * uHalf);
  return uv + (src - uv) * (1.0 + uFringe * k);
}

// Blur like on scroll: smeared vertically (where it stretches), only slightly
// sideways, strongest in the rod's centre, zero at its edge.
vec3 sampleSoft(vec2 uv) {
  float t = abs((uv.y - uCenter) / uHalf);
  float w = t < 1.0 ? pow(1.0 - t, 1.0 + uPeak * 5.0) : 0.0;
  float r = uBlur * 0.07 * w;
  vec3 acc = vec3(0.0);
  float total = 0.0;
  // Per-pixel noise shifts the taps: a smooth smear instead of visible
  // copies (interleaved gradient noise).
  float jitter = fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715)))) - 0.5;
  for (int i = -6; i <= 6; i++) {
    float f = (float(i) + jitter) / 6.0;
    float g = exp(-2.0 * f * f);
    vec2 o = vec2(f * r * 0.35, f * r);
    float rr = texture2D(uTex, bend(uv + o, -1.0)).r;
    float gg = texture2D(uTex, bend(uv + o, 0.0)).g;
    float bb = texture2D(uTex, bend(uv + o, 1.0)).b;
    acc += vec3(rr, gg, bb) * g;
    total += g;
  }
  return acc / total;
}

void main() {
  vec3 col = sampleSoft(vUv);
  // Fine glint along the top and bottom of the rod.
  float d = abs(abs((vUv.y - uCenter) / uHalf) - 1.0);
  float glint = smoothstep(0.035, 0.0, d) * 0.07;
  gl_FragColor = vec4(col + glint, 1.0);
}`;
const lerp = (a, b, k) => a + (b - a) * k;
const ease = (k) => k * k * (3 - 2 * k);
/** Parameters at time t (s): hold each preset, then blend smoothly into the next. */
export function paramsAt(t) {
  const step = HOLD + BLEND;
  const i = Math.floor(Math.max(0, t) / step) % presets.length;
  const local = Math.max(0, t) % step;
  const k = local < HOLD ? 0 : ease((local - HOLD) / BLEND);
  const a = presets[i];
  const b = presets[(i + 1) % presets.length];
  return {
    magnify: lerp(a.magnify, b.magnify, k),
    peak: lerp(a.peak, b.peak, k),
    drift: lerp(a.drift, b.drift, k),
    fringe: lerp(a.fringe, b.fringe, k),
    blur: lerp(a.blur, b.blur, k),
    center: 0.5 + FLOAT_RANGE * Math.sin((t / FLOAT_PERIOD) * Math.PI * 2),
  };
}
export function createGlassRod(canvas, options = {}) {
  const { text = 'Glass Refraction', background = '#0b0b0b', foreground = '#f4f0ea', accent = '#dffd02', fontFamily = 'system-ui, sans-serif', onParams, } = options;
  const scene = document.createElement('canvas');
  const ctx = scene.getContext('2d');
  const gl = canvas.getContext('webgl', { antialias: false, premultipliedAlpha: false });
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  // --- Scene: grid, word, small labels (drawn once per size) ---
  const drawScene = (w, h, dpr) => {
    scene.width = w;
    scene.height = h;
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, w, h);
    const cell = 28 * dpr;
    ctx.strokeStyle = foreground;
    ctx.globalAlpha = 0.08;
    ctx.lineWidth = dpr;
    ctx.beginPath();
    for (let x = (w % cell) / 2; x < w; x += cell) {
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
    }
    for (let y = (h % cell) / 2; y < h; y += cell) {
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
    }
    ctx.stroke();
    ctx.globalAlpha = 1;
    let size = w * 0.09;
    ctx.font = `400 ${size}px ${fontFamily}`;
    const max = w * 0.86;
    const measured = ctx.measureText(text).width;
    if (measured > max) {
      size *= max / measured;
      ctx.font = `400 ${size}px ${fontFamily}`;
    }
    ctx.fillStyle = foreground;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, w / 2, h / 2);
    const mono = `${11 * dpr}px ui-monospace, SFMono-Regular, Menlo, monospace`;
    ctx.font = mono;
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = accent;
    ctx.textAlign = 'left';
    ctx.fillText('GLASS / REFRACTION', 18 * dpr, 28 * dpr);
    ctx.fillStyle = foreground;
    ctx.globalAlpha = 0.5;
    ctx.textAlign = 'right';
    ctx.fillText('LENS · DRIFT · FRINGE', w - 18 * dpr, h - 18 * dpr);
    ctx.globalAlpha = 1;
  };
  // Without WebGL: just the scene, no glass.
  if (!gl) {
    const fit = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(canvas.clientWidth * dpr);
      canvas.height = Math.round(canvas.clientHeight * dpr);
      drawScene(canvas.width, canvas.height, dpr);
      canvas.getContext('2d')?.drawImage(scene, 0, 0);
    };
    fit();
    return { destroy() { }, setParams() { }, current: () => paramsAt(0), redraw() { return this; } };
  }
  const shader = (type, src) => {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    return s;
  };
  const program = gl.createProgram();
  gl.attachShader(program, shader(gl.VERTEX_SHADER, VERT));
  gl.attachShader(program, shader(gl.FRAGMENT_SHADER, FRAG));
  gl.linkProgram(program);
  gl.useProgram(program);
  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  const aPos = gl.getAttribLocation(program, 'aPos');
  gl.enableVertexAttribArray(aPos);
  gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);
  const texture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  const u = {
    center: gl.getUniformLocation(program, 'uCenter'),
    half: gl.getUniformLocation(program, 'uHalf'),
    peak: gl.getUniformLocation(program, 'uPeak'),
    mag: gl.getUniformLocation(program, 'uMag'),
    drift: gl.getUniformLocation(program, 'uDrift'),
    fringe: gl.getUniformLocation(program, 'uFringe'),
    blur: gl.getUniformLocation(program, 'uBlur'),
  };
  const fit = () => {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.max(1, Math.round(canvas.clientWidth * dpr));
    const h = Math.max(1, Math.round(canvas.clientHeight * dpr));
    if (w === canvas.width && h === canvas.height && scene.width === w)
      return;
    canvas.width = w;
    canvas.height = h;
    gl.viewport(0, 0, w, h);
    drawScene(w, h, dpr);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, scene);
  };
  // Manual values (sliders): the rod keeps floating, parameters stay put.
  let manual = null;
  const render = (t) => {
    const auto = paramsAt(t);
    const p = manual ? { ...manual, center: auto.center } : auto;
    gl.uniform1f(u.center, p.center);
    gl.uniform1f(u.half, BAND_HALF);
    gl.uniform1f(u.peak, p.peak);
    gl.uniform1f(u.mag, p.magnify);
    gl.uniform1f(u.drift, p.drift);
    gl.uniform1f(u.fringe, p.fringe);
    // Blur follows the rod's height: sharp at the bottom, gradually stronger
    // towards the top, full value at the highest point. Like the scroll
    // effect, where the edge sits at the top of the window.
    const lift = Math.min(1, Math.max(0, (FLOAT_HIGH - p.center) / (FLOAT_HIGH - FLOAT_LOW)));
    gl.uniform1f(u.blur, p.blur * lift);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    onParams?.(p);
  };
  // --- Loop with three brakes: offscreen, background tab, reduced motion ---
  let visible = false;
  let frame = 0;
  let elapsed = 0;
  let last = 0;
  const tick = (now) => {
    frame = 0;
    elapsed += Math.min(0.1, Math.max(0, (now - last) / 1000));
    last = now;
    render(elapsed);
    schedule();
  };
  const schedule = () => {
    if (frame || !visible || document.hidden || reduced.matches)
      return;
    last = performance.now();
    frame = requestAnimationFrame(tick);
  };
  const stop = () => {
    cancelAnimationFrame(frame);
    frame = 0;
  };
  fit();
  render(0);
  const io = new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    if (visible)
      schedule();
    else
      stop();
  });
  io.observe(canvas);
  const ro = new ResizeObserver(() => {
    fit();
    render(elapsed);
  });
  ro.observe(canvas);
  const onVisibility = () => (document.hidden ? stop() : schedule());
  document.addEventListener('visibilitychange', onVisibility);
  const onMotion = () => (reduced.matches ? stop() : schedule());
  reduced.addEventListener('change', onMotion);
  return {
    /** Set manual values (null = back to cycling through the presets). */
    setParams(next) {
      manual = next;
      render(elapsed);
    },
    /** Current auto values (e.g. to fill sliders when switching to manual). */
    current: () => paramsAt(elapsed),
    /** Redraw the scene, e.g. after a font or colour change. */
    redraw(next = {}) {
      Object.assign(options, next);
      destroy();
      const fresh = createGlassRod(canvas, { ...options, ...next });
      if (manual)
        fresh.setParams(manual);
      return fresh;
    },
    destroy,
  };
  function destroy() {
    stop();
    io.disconnect();
    ro.disconnect();
    document.removeEventListener('visibilitychange', onVisibility);
    reduced.removeEventListener('change', onMotion);
  }
}
