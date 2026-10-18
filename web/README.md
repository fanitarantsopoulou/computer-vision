# Γνωρίζω την Ελλάδα (browser game)

Falling-clouds quiz on the capitals of Greek prefectures, played with hand gestures. Runs entirely in the browser (MediaPipe Tasks Vision); the camera feed never leaves the computer and is never shown.

## Run (Windows, macOS, Linux)

Requires Node.js 20.19+ and Chrome or Edge.

```bash
cd web
npm install
npm run dev        # http://localhost:5173 (the first run downloads ~8 MB of models)
```

`npm run build` makes a static site in `dist/`; `npm test` runs the data and gesture tests.

## How it plays
- Idle screen until someone steps close to the camera (or anyone clicks the screen).
- A boy or girl avatar (set by the teacher) replaces the pupil's image.
- Pick the capital of the prefecture on the sign: **pinch** (thumb + index) a cloud, or **hold an open hand** over it for ~1.3 s. The mouse works too (click = pinch).
- Teacher settings: gear button or `T` (avatar, start distance, camera, preview).

## Map data
`npm run build-map` regenerates `src/data/greece-map.json` from OpenStreetMap (© OpenStreetMap contributors, ODbL). The map has the 74 regional units; `src/data/prefectures.js` groups them into the classic prefectures and lists the capitals (to be verified against the textbook).
