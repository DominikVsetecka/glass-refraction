/**
 * Glass Edge: a refracting band at the top of the window.
 *
 * Content that scrolls underneath gets stretched like it passes under a glass
 * rod: strong stretch at the very top, a slight fan-out at the sides, a soft
 * rainbow fringe, and an optional mirrored zone. Built with one CSS
 * `backdrop-filter` and an SVG filter (`feDisplacementMap`). No dependencies.
 *
 * Works in Chromium-based browsers (Chrome, Edge, Arc, Opera, Brave). Safari
 * and Firefox don't render SVG filters in `backdrop-filter`; there the module
 * shows a simple frosted blur instead (`fallback: 'blur'`, the default).
 *
 * Usage:
 *   import { createGlassEdge } from './src/glass-edge.js'
 *   const edge = createGlassEdge({ height: 100 })
 *   edge.update({ chroma: 0.08 })
 *   edge.destroy()
 *
 * How the maps work: every pixel (x, y) shows the content from (x + dx, y + dy).
 * The shifts are stored in greyscale images: d = scale · (grey − 0.5). Only
 * grey maps are used on purpose. Chrome converts filter images into the colour
 * profile of each monitor, and a colourful map (red = x, green = y) mixes its
 * channels in that step, so the band would tilt differently on every screen.
 * Grey stays grey. The other axis reads the alpha channel (never converted),
 * and a counter-pass with a neutral map cancels whatever is left.
 */

export const defaults = {
  /** Height of the band in px. 80 to 140 looks best. Max 160 (see SCALE). */
  height: 100,
  /** Fan-out at the sides, share of the window width. 0.015 to 0.035. */
  drift: 0.025,
  /** Rainbow fringe strength. 0.02 to 0.06. Above 0.08 it looks broken. */
  chroma: 0.04,
  /** Vertical pre-blur against steps in magnified areas. 0.8 to 1.6. */
  softness: 1.1,
  /** Mirrored zone at the very top, like a real cylinder lens. */
  mirror: true,
  /** Where the mirror starts, share of the band height (0 = top edge). */
  mirrorPos: 0,
  /** Height of the mirrored part. */
  mirrorHeight: 0.2,
  /** Which row appears upside down at the very top. */
  mirrorTop: 0.76,
  /** Row at the fold. If there's only background around it, a gap appears. */
  mirrorAxis: 0.62,
  /** Length of the stretch after the fold. 0 = folds straight back. */
  mirrorGap: 0.2,
  /** Fade out the bottom of the band with a mask. */
  fade: true,
  /** 'blur' = frosted fallback outside Chromium, 'none' = nothing. */
  fallback: 'blur',
  /** z-index of the band. */
  zIndex: 35,
}

export const presets = {
  standard: {},
  subtle: { height: 80, drift: 0.015, chroma: 0.02, softness: 1, mirrorHeight: 0.15, mirrorTop: 0.7, mirrorAxis: 0.6, mirrorGap: 0.1 },
  strong: { height: 160, drift: 0.04, chroma: 0.15, softness: 2, mirrorHeight: 0.4, mirrorTop: 1, mirrorAxis: 0.3, mirrorGap: 0.1 },
  deep: { height: 140, chroma: 0.06, mirrorPos: 0.3, mirrorHeight: 0.3, mirrorTop: 0.95, mirrorAxis: 0.55, mirrorGap: 0.05 },
  noMirror: { height: 120, chroma: 0.09, softness: 1.6, mirror: false },
}

/** Range of the vertical map in px. Must be ≥ 2 × the largest shift (≈ band height). */
const SCALE = 320
const COLS = 256
const NS = 'http://www.w3.org/2000/svg'

let count = 0

/** True if the browser renders SVG filters inside `backdrop-filter`. */
export function supportsRefraction() {
  const brands = navigator.userAgentData?.brands
  return Boolean(brands?.some((b) => /Chromium/.test(b.brand)))
}

export function createGlassEdge(options = {}) {
  const id = `glass-edge-${++count}`
  let o = { ...defaults, ...options }
  const supported = supportsRefraction()

  const edge = document.createElement('div')
  edge.setAttribute('aria-hidden', 'true')
  edge.dataset.glassEdge = supported ? 'refraction' : o.fallback
  Object.assign(edge.style, {
    position: 'fixed',
    inset: '0 0 auto 0',
    pointerEvents: 'none',
    zIndex: String(o.zIndex),
  })
  document.body.append(edge)

  if (!supported) {
    applyFallback()
    return {
      supported,
      element: edge,
      update(next = {}) {
        o = { ...o, ...next }
        applyFallback()
      },
      destroy() {
        edge.remove()
      },
    }
  }

  function applyFallback() {
    edge.style.height = `${Math.round(o.height * 0.7)}px`
    edge.style.zIndex = String(o.zIndex)
    if (o.fallback === 'none') {
      edge.style.display = 'none'
      return
    }
    edge.style.display = ''
    edge.style.webkitBackdropFilter = edge.style.backdropFilter = 'blur(14px) saturate(160%)'
    edge.style.webkitMaskImage = edge.style.maskImage = 'linear-gradient(to bottom, black 0%, black 35%, transparent 100%)'
  }

  // --- SVG filter -----------------------------------------------------------
  const svg = document.createElementNS(NS, 'svg')
  svg.setAttribute('aria-hidden', 'true')
  svg.setAttribute('focusable', 'false')
  Object.assign(svg.style, { position: 'absolute', width: '0', height: '0', pointerEvents: 'none' })
  const el = (name, attrs = {}) => {
    const node = document.createElementNS(NS, name)
    for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, String(v))
    return node
  }

  const filter = el('filter', { id, x: 0, y: 0, width: '100%', height: '100%', 'color-interpolation-filters': 'sRGB' })
  const map = (result) => el('feImage', { x: 0, y: 0, width: 1440, height: 120, preserveAspectRatio: 'none', result })
  const nMap = map('nm')
  const yMap = map('ym')
  const xMap = map('xm')
  const soft = el('feGaussianBlur', { in: 'SourceGraphic', stdDeviation: '0 1.1', result: 'soft' })
  filter.append(nMap, yMap, xMap, soft)

  // Vertical stretch with a spectral fringe: counter-pass, then five passes of
  // rising strength tinted red, yellow, green, cyan, blue. They add up to white,
  // so only the edges show colour. Alpha stays 1 in each pass, otherwise the
  // premultiplied alpha darkens the result.
  filter.append(el('feDisplacementMap', { in: 'soft', in2: 'nm', scale: -SCALE, xChannelSelector: 'A', yChannelSelector: 'G', result: 'y0' }))
  const tints = [
    '0.5 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0',
    '0.5 0 0 0 0  0 0.33 0 0 0  0 0 0 0 0  0 0 0 1 0',
    '0 0 0 0 0  0 0.34 0 0 0  0 0 0 0 0  0 0 0 1 0',
    '0 0 0 0 0  0 0.33 0 0 0  0 0 0.5 0 0  0 0 0 1 0',
    '0 0 0 0 0  0 0 0 0 0  0 0 0.5 0 0  0 0 0 1 0',
  ]
  const passes = tints.map((values, i) => {
    const pass = el('feDisplacementMap', { in: 'y0', in2: 'ym', scale: SCALE, xChannelSelector: 'A', yChannelSelector: 'G', result: `d${i}` })
    filter.append(pass, el('feColorMatrix', { in: `d${i}`, type: 'matrix', values, result: `c${i}` }))
    return pass
  })
  const add = (a, b, result) => el('feComposite', { in: a, in2: b, operator: 'arithmetic', k1: 0, k2: 1, k3: 1, k4: 0, result })
  filter.append(add('c0', 'c1', 's1'), add('s1', 'c2', 's2'), add('s2', 'c3', 's3'), add('s3', 'c4', 'ys'))

  // Sideways (fan): counter-pass, then the fan map with its own small range.
  const xCancel = el('feDisplacementMap', { in: 'ys', in2: 'nm', scale: -SCALE, xChannelSelector: 'G', yChannelSelector: 'A', result: 'x0' })
  const xPass = el('feDisplacementMap', { in: 'x0', in2: 'xm', scale: SCALE, xChannelSelector: 'G', yChannelSelector: 'A', result: 'xs' })
  // Light post-blur against stepped diagonals.
  filter.append(xCancel, xPass, el('feGaussianBlur', { in: 'xs', stdDeviation: '1 1.1' }))
  svg.append(filter)
  document.body.append(svg)

  edge.style.backdropFilter = `url(#${id})`

  // --- Maps -------------------------------------------------------------------
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')

  /**
   * Grey map (R = G = B, alpha 0.5) from (x, t) → shift in px. `dither` breaks
   * up the 8-bit steps into fine noise (vertical ±1, sideways ±0.5, neutral 0).
   */
  const grayMap = (h, shift, dither = 0, scale = SCALE, cols = COLS) => {
    canvas.width = cols
    canvas.height = h
    const img = ctx.createImageData(cols, h)
    for (let y = 0; y < h; y++) {
      const t = y / (h - 1)
      for (let x = 0; x < cols; x++) {
        const v = Math.round(Math.min(1, Math.max(0, 0.5 + shift(x, t) / scale)) * 255 + (Math.random() * 2 - 1) * dither)
        const k = (y * cols + x) * 4
        img.data[k] = img.data[k + 1] = img.data[k + 2] = v
        img.data[k + 3] = 128
      }
    }
    ctx.putImageData(img, 0, 0)
    return canvas.toDataURL('image/png')
  }

  // Lens profile: row t reads from row f(t). Must always rise (otherwise the
  // content flips) and end with slope 1 (otherwise there's a visible seam).
  const lens = (t) => 0.8 + 0.2 * t ** 5

  const hermite = (t, t0, t1, y0, y1, m0, m1) => {
    const len = t1 - t0
    const u = (t - t0) / len
    const u2 = u * u
    const u3 = u2 * u
    return (2 * u3 - 3 * u2 + 1) * y0 + (u3 - 2 * u2 + u) * m0 * len + (-2 * u3 + 3 * u2) * y1 + (u3 - u2) * m1 * len
  }

  // Mirror profile, in units of the band height:
  //   [0, P]  stretch (flat at T), only if the mirror starts lower
  //   [P, A]  mirror: falls from T (top row) to X (axis)
  //   [A, B]  stretch (flat at X), the "gap"
  //   [B, 1]  back down to 1 with slope 1, seamless
  // Every row must stay inside the band: the backdrop ends at its bottom edge.
  const mirrorProfile = () => {
    const P = o.mirrorPos
    const A = Math.min(P + o.mirrorHeight, 0.9)
    const B = Math.min(A + o.mirrorGap, 0.95)
    const T = o.mirrorTop
    const X = Math.min(o.mirrorAxis, T - 0.02)
    return (t) => (t < P ? T : t < A ? hermite(t, P, A, T, X, P > 0 ? 0 : (-1.4 * (T - X)) / 0.36, 0) : t < B ? X : hermite(t, B, 1, X, 1, 0, 1))
  }

  let height = 100
  const buildY = () => {
    height = Math.round(Math.min(160, Math.max(20, o.height)))
    const g = o.mirror ? mirrorProfile() : lens
    edge.style.height = `${height}px`
    edge.style.zIndex = String(o.zIndex)
    edge.style.webkitMaskImage = edge.style.maskImage = o.fade ? 'linear-gradient(to bottom, black 0%, black 80%, transparent 100%)' : ''
    nMap.setAttribute('href', grayMap(height, () => 0))
    yMap.setAttribute('href', grayMap(height, (_, t) => height * (g(t) - t), 1))
    for (const m of [nMap, xMap, yMap]) m.setAttribute('height', String(height))
    passes.forEach((pass, i) => pass.setAttribute('scale', String(SCALE * (1 + (o.chroma * i) / 4))))
    soft.setAttribute('stdDeviation', `0 ${o.softness}`)
  }

  // The fan map depends on the window width. It gets its own value range, just
  // over 2 × its largest shift instead of the lens's 320: each 8-bit step then
  // moves ~0.3 px instead of ~1.25 px, and the curve stays smooth.
  const fit = () => {
    const width = document.documentElement.clientWidth
    const xScale = Math.max(16, Math.ceil(o.drift * width * 2.2))
    const cols = Math.max(2, Math.min(2048, width))
    xCancel.setAttribute('scale', String(-xScale))
    xPass.setAttribute('scale', String(xScale))
    xMap.setAttribute('href', grayMap(height, (x, t) => o.drift * width * (1 - (2 * x) / (cols - 1)) * (1 - t) ** 2, 0.5, xScale, cols))
    for (const m of [nMap, xMap, yMap]) m.setAttribute('width', String(width))
  }

  buildY()
  fit()

  let timer = 0
  const onResize = () => {
    clearTimeout(timer)
    timer = setTimeout(fit, 120)
  }
  window.addEventListener('resize', onResize, { passive: true })

  return {
    supported,
    element: edge,
    /** Change any option. Rebuilds the maps (a few ms). */
    update(next = {}) {
      o = { ...o, ...next }
      buildY()
      fit()
    },
    /** Current options. */
    get options() {
      return { ...o }
    },
    destroy() {
      window.removeEventListener('resize', onResize)
      clearTimeout(timer)
      edge.remove()
      svg.remove()
    },
  }
}
