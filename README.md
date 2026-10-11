# Glass Refraction

A refracting glass band for the top of a web page. Content that scrolls underneath gets stretched like it passes under a glass rod: strong at the very top, a slight fan-out at the sides, a soft rainbow fringe and an optional mirrored zone.

Built with one CSS `backdrop-filter` and an SVG filter. No WebGL, no dependencies, no build step.

**[Read how it was made →](https://dominikvsetecka.com/lab/glass-edge/)**

## Demos

- `index.html`: the scroll effect, with a settings panel and presets. "Copy settings" puts a ready-to-paste `createGlassEdge({...})` call on your clipboard.
- `rod.html`: the same idea as a small WebGL shader (a floating glass rod over the words "Glass Refraction"), with sliders for lens, peak, drift, fringe and blur.

Run them locally (ES modules need a server, `file://` won't work):

```sh
./start.command        # macOS: double-click works too
# or
python3 -m http.server 8000
```

## Usage

Copy `src/glass-edge.js` into your project:

```js
import { createGlassEdge } from './glass-edge.js'

const edge = createGlassEdge({
  height: 100, // px, 80 to 140 looks best
  drift: 0.025, // fan-out at the sides, share of the width
  chroma: 0.04, // rainbow fringe
  softness: 1.1, // vertical pre-blur against steps
  mirror: true, // mirrored zone at the very top
})

edge.update({ chroma: 0.08 }) // change anything later
edge.destroy() // remove it
```

`createGlassEdge` adds a fixed element at the top of `<body>` and the SVG filter it needs. Everything else on the page stays as it is.

### Options

| Option | Default | Good range | What it does |
|---|---|---|---|
| `height` | `100` | 80 to 140 | Height of the band in px (max 160) |
| `drift` | `0.025` | 0.015 to 0.035 | Fan-out at the left and right edge |
| `chroma` | `0.04` | 0.02 to 0.06 | Rainbow fringe. Above 0.08 it looks broken |
| `softness` | `1.1` | 0.8 to 1.6 | Vertical pre-blur, hides 8-bit steps |
| `mirror` | `true` | | Upside-down zone at the top, like a real cylinder lens |
| `mirrorPos` | `0` | 0 to 0.4 | Where the mirror starts (0 = top edge) |
| `mirrorHeight` | `0.2` | 0.15 to 0.3 | Height of the mirrored part |
| `mirrorTop` | `0.76` | 0.3 to 1 | Which row appears upside down at the very top |
| `mirrorAxis` | `0.62` | 0 to 0.95 | Row at the fold |
| `mirrorGap` | `0.2` | 0 to 0.4 | Stretch after the fold (0 = folds straight back) |
| `fade` | `true` | | Fade out the bottom of the band |
| `fallback` | `'blur'` | `'blur'`, `'none'` | What Safari and Firefox get |
| `zIndex` | `35` | | Stacking order of the band |

Presets are exported too: `presets.subtle`, `presets.strong`, `presets.deep`, `presets.noMirror`.

## How it works

A fixed strip at the top uses `backdrop-filter: url(#filter)`. The SVG filter moves every pixel with `feDisplacementMap`, guided by greyscale images drawn once in a canvas. Mid-grey means "stay", lighter and darker shift the pixel.

- **Lens.** Row `t` reads from row `f(t) = 0.8 + 0.2·t⁵`. It must always rise (otherwise the content flips) and end with slope 1 (otherwise there's a seam at the bottom).
- **Fan.** Content shifts outwards at the sides, not in the middle, and only near the top.
- **Fringe.** The vertical pass runs five times, tinted red, yellow, green, cyan and blue. They add up to white, so only the edges show colour.
- **Smooth, not stepped.** A displacement map has 256 levels and isn't interpolated. Each direction gets its own value range, the maps are dithered, and a light blur hides the rest.
- **Same on every screen.** Chrome converts filter images into each monitor's colour profile. Colourful maps would mix their channels there, so the band would tilt differently per screen. Grey maps, the alpha channel for the second axis and a counter-pass keep it stable.

## Browser support

| Browser | Result |
|---|---|
| Chrome, Edge, Arc, Opera, Brave | Full glass effect |
| Safari, Firefox | Frosted blur fallback (SVG filters in `backdrop-filter` aren't supported) |

The rod demo (`rod.html`) uses WebGL and runs everywhere.

## Licence

MIT, see [LICENSE](LICENSE). Made by [Dominik Vsetecka](https://dominikvsetecka.com).
