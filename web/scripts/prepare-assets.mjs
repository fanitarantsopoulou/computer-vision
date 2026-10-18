// Copies the MediaPipe WASM runtime into public/ and downloads the model files once.
// Plain Node, no shell commands, so it works the same on Windows, macOS and Linux.
import { cp, mkdir, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const pub = join(root, "public");

const MODELS = {
  "hand_landmarker.task":
    "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task",
  "blaze_face_short_range.tflite":
    "https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite",
};

const wasmSrc = join(root, "node_modules", "@mediapipe", "tasks-vision", "wasm");
if (!existsSync(wasmSrc)) {
  console.error("Missing @mediapipe/tasks-vision. Run `npm install` first.");
  process.exit(1);
}
await cp(wasmSrc, join(pub, "wasm"), { recursive: true });

await mkdir(join(pub, "models"), { recursive: true });
for (const [name, url] of Object.entries(MODELS)) {
  const dest = join(pub, "models", name);
  if (existsSync(dest)) continue;
  console.log(`Downloading ${name} ...`);
  const res = await fetch(url);
  if (!res.ok) {
    console.error(`Failed to download ${url}: HTTP ${res.status}`);
    process.exit(1);
  }
  await writeFile(dest, Buffer.from(await res.arrayBuffer()));
}
console.log("Assets ready.");
