# Testing

No build, no test runner. Checks:

1. `node --check src/glass-edge.js src/glass-rod.js` (syntax).
2. `./start.command`, then in Chrome:
   - `index.html`: scroll; the top band stretches the content with a fringe. Move every slider and each preset; "Copy settings" puts a `createGlassEdge(...)` call on the clipboard.
   - `rod.html`: the rod floats and cycles presets; sliders take over, Auto resumes.
3. Safari or Firefox: `index.html` shows the blur fallback and the note in the panel; `rod.html` runs normally.
4. Reduce motion on: the rod shows a still frame.
