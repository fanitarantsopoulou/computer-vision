import { PREFECTURES } from "./data/prefectures.js";
import { Play } from "./game/play.js";
import { Pointer } from "./input.js";
import { initSettingsPanel, loadSettings } from "./settings.js";
import { Tracker } from "./tracking/hand-tracker.js";
import { avatarSvg } from "./ui/avatar.js";
import { GreeceMap } from "./ui/map.js";
import { SCENE_SVG } from "./ui/scene.js";

const $ = (id) => document.getElementById(id);
const ENTER_HOLD_MS = 600; // someone must stay close this long before the game starts
const LEAVE_AFTER_MS = 5000; // ...and be gone this long before it returns to the idle screen

const settings = loadSettings();
const video = $("cam");
const stage = $("stage");
const pointer = new Pointer(stage);

$("scene").innerHTML = SCENE_SVG;
const map = new GreeceMap($("map"));
const play = new Play({
  prefectures: PREFECTURES,
  map,
  els: {
    clouds: $("clouds"),
    prompt: $("prompt"),
    prefecture: $("prefecture"),
    bubble: $("bubble"),
    avatar: $("avatar"),
    caption: $("map-caption"),
    score: $("score"),
  },
});

const panel = initSettingsPanel(settings, {
  onChange: (s, key) => {
    if (key === "avatar") renderAvatar();
    if (key === "showPreview") video.classList.toggle("preview", s.showPreview);
    if (key === "cameraId") startCamera();
  },
});
function renderAvatar() {
  $("avatar").innerHTML = avatarSvg(settings.avatar);
}
renderAvatar();
video.classList.toggle("preview", settings.showPreview);

// --- session state: idle <-> playing ---
let state = "idle";
let nearSince = 0;
let lastNearAt = 0;

function setState(next, now) {
  if (next === state) return;
  state = next;
  const playing = next === "playing";
  $("idle").classList.toggle("gone", playing);
  $("avatar").hidden = !playing;
  $("hud").hidden = !playing;
  $("cursor").hidden = !playing;
  if (playing) {
    lastNearAt = now;
    play.start();
  } else {
    play.stop();
    $("prompt").hidden = true;
    nearSince = 0;
  }
}
// Clicking or tapping always starts a session: lets the teacher start it, and covers setups without a camera.
stage.addEventListener("pointerdown", () => setState("playing", performance.now()));

// --- camera and tracking ---
let tracker = null;
let stream = null;
const status = $("status");

async function startCamera() {
  stream?.getTracks().forEach((t) => t.stop());
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      video: { deviceId: settings.cameraId ? { exact: settings.cameraId } : undefined, width: 1280, height: 720 },
      audio: false,
    });
    video.srcObject = stream;
    await video.play();
    await panel.refreshCameras();
    status.textContent = tracker ? "Η κάμερα είναι έτοιμη." : "Φορτώνει το σύστημα παρακολούθησης χεριών…";
  } catch (e) {
    console.warn(e);
    status.textContent = "Δεν βρέθηκε κάμερα. Πάτα οπουδήποτε και παίξε με το ποντίκι.";
  }
}

async function startTracker() {
  try {
    tracker = await Tracker.create();
    status.textContent = stream ? "Η κάμερα είναι έτοιμη." : status.textContent;
  } catch (e) {
    console.error(e);
    status.textContent = "Δεν φορτώθηκε το σύστημα παρακολούθησης χεριών. Πάτα οπουδήποτε και παίξε με το ποντίκι.";
  }
}
startCamera();
startTracker();

// --- main loop ---
const cursorEl = $("cursor");
let prev = performance.now();
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.1, (now - prev) / 1000);
  prev = now;
  const { innerWidth: w, innerHeight: h } = window;

  const r = tracker?.process(video, now);
  if (r) {
    pointer.updateHand(r.hand, now, w, h);
    const near = r.faceWidth > settings.enterWidth || !!r.hand;
    if (near) lastNearAt = now;
    if (state === "idle") {
      nearSince = near ? nearSince || now : 0;
      if (nearSince && now - nearSince > ENTER_HOLD_MS) setState("playing", now);
    } else if (now - lastNearAt > LEAVE_AFTER_MS) {
      setState("idle", now);
    }
  } else if (state === "playing" && !tracker && pointer.get(now)) {
    lastNearAt = now; // no camera: the mouse keeps the session alive
  }

  if (state === "playing") {
    const p = pointer.get(now);
    play.update(dt, p);
    cursorEl.hidden = !p;
    if (p) {
      cursorEl.style.transform = `translate(${p.x}px, ${p.y}px)`;
      cursorEl.classList.toggle("pinch", p.pinching);
    }
  }
}
addEventListener("resize", () => play.resize(innerWidth, innerHeight));
requestAnimationFrame(frame);
