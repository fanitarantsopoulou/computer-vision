import { PREFECTURES } from "./data/prefectures.js";
import { Play } from "./game/play.js";
import { Pointer } from "./input.js";
import { Sound } from "./audio.js";
import { initSettingsPanel, loadSettings, saveSettings } from "./settings.js";
import { initSetup } from "./setup.js";
import { Tracker } from "./tracking/hand-tracker.js";
import { avatarSvg } from "./ui/avatar.js";
import { GreeceMap } from "./ui/map.js";
import { SCENE_SVG } from "./ui/scene.js";

const $ = (id) => document.getElementById(id);
const ENTER_HOLD_MS = 600; // someone must stay close this long before the game starts
const LEAVE_AFTER_MS = 5000; // ...and be gone this long before it returns to the idle screen
const END_SCREEN_MS = 7000;

const settings = loadSettings();
const video = $("cam");
const stage = $("stage");
const pointer = new Pointer(stage);

$("scene").innerHTML = SCENE_SVG;
const map = new GreeceMap($("map"));
const sound = new Sound(settings.sound);
const play = new Play({
  sfx: sound,
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
    if (key === "showPreview") video.classList.toggle("preview", s.showPreview);
    if (key === "cameraId") startCamera();
    if (key === "autoStart") showIdleHint();
    if (key === "sound") setSound(s.sound);
  },
});
function renderAvatar() {
  $("avatar").innerHTML = avatarSvg(settings.avatar);
}
const startGame = () => setState("playing", performance.now());
const setup = initSetup(settings, { onAvatar: renderAvatar, onStart: startGame, onSpeed: () => (play.speed = settings.speed) });
function showIdleHint() {
  $("idle-hint").textContent = settings.autoStart ? "👋 Πλησίασε για να παίξουμε!" : "Πάτα Έναρξη όταν είσαι έτοιμος/η!";
}
showIdleHint();
play.speed = settings.speed;
renderAvatar();
video.classList.toggle("preview", settings.showPreview);

// --- session state: idle -> playing -> done -> idle ---
let state = "idle";
let nearSince = 0;
let lastNearAt = 0;
let doneAt = 0;

function setState(next, now) {
  if (next === state) return;
  state = next;
  const playing = next === "playing";
  const idle = next === "idle";
  $("idle").classList.toggle("gone", !idle);
  setup.root.hidden = !idle;
  $("avatar").hidden = idle;
  $("hud").hidden = !playing;
  $("controls").hidden = !playing;
  setPaused(false);
  if (playing) sound.startMusic();
  else sound.stopMusic();
  $("cursor").hidden = !playing;
  $("end").hidden = next !== "done";
  if (playing) {
    lastNearAt = now;
    play.start({ rounds: settings.rounds, name: setup.pupilName });
  } else {
    play.stop();
    $("prompt").hidden = true;
    nearSince = 0;
  }
  if (idle) setup.clearName(); // the next pupil starts with an empty name
}
play.onFinish = ({ score, total, name }) => {
  $("end-title").textContent = name ? `Μπράβο, ${name}!` : "Μπράβο!";
  $("end-score").textContent = `Σωστές με την πρώτη: ${score} από ${total}`;
  $("end-stars").textContent = "⭐".repeat(Math.max(1, Math.round((score / total) * 5)));
  sound.victory();
  setState("done", performance.now());
  doneAt = performance.now();
};
// --- teacher controls: pause, restart, skip, stop ---
function setPaused(on) {
  play.paused = on && state === "playing";
  $("pause").hidden = !play.paused;
  $("c-pause").textContent = play.paused ? "▶" : "⏸";
  sound.pauseMusic(play.paused);
}
const togglePause = () => state === "playing" && setPaused(!play.paused);
const restart = () => {
  if (state === "done") setState("playing", performance.now());
  else if (state === "playing") {
    play.restart();
    setPaused(false);
  }
};
const stopSession = () => setState("idle", performance.now());
const click = (id, fn) =>
  $(id).addEventListener("click", (e) => {
    e.currentTarget.blur(); // a focused button would also react to Space
    fn();
  });
click("c-pause", togglePause);
click("p-resume", togglePause);
click("c-restart", restart);
click("p-restart", restart);
click("c-skip", () => state === "playing" && play.skip());
function setSound(on) {
  settings.sound = on;
  saveSettings(settings);
  sound.setEnabled(on);
  $("c-sound").textContent = on ? "🔊" : "🔇";
  panel.syncSound();
}
function nudgeSpeed(step) {
  settings.speed = Math.min(1.6, Math.max(0.5, Math.round((settings.speed + step) * 10) / 10));
  saveSettings(settings);
  play.speed = settings.speed;
  $("speed").value = settings.speed; // keep the start-screen slider in step
}
click("c-slower", () => nudgeSpeed(-0.1));
click("c-faster", () => nudgeSpeed(0.1));
click("c-sound", () => setSound(!settings.sound));
setSound(settings.sound);
// Browsers allow sound only after a click or key press.
for (const type of ["pointerdown", "keydown"]) addEventListener(type, () => sound.unlock());
function toggleFullscreen() {
  if (document.fullscreenElement) document.exitFullscreen();
  else document.documentElement.requestFullscreen?.(); // inside a blog iframe this needs allow="fullscreen"
}
click("full", toggleFullscreen);
click("c-stop", stopSession);
click("p-stop", stopSession);
click("e-replay", restart);
click("e-next", stopSession);
addEventListener("keydown", (e) => {
  if (e.target.matches("input, select, textarea") || e.ctrlKey || e.metaKey || e.altKey) return;
  if (e.key === " ") {
    e.preventDefault();
    togglePause();
  } else if (e.key.toLowerCase() === "r") restart();
  else if (e.key.toLowerCase() === "n" && state === "playing") play.skip();
  else if (e.key.toLowerCase() === "f") toggleFullscreen();
  else if (e.key === "-") nudgeSpeed(-0.1);
  else if (e.key === "+" || e.key === "=") nudgeSpeed(0.1);
  else if (e.key.toLowerCase() === "m") setSound(!settings.sound);
  else if (e.key === "Escape" && state !== "idle") stopSession();
});

// A game only starts from the Start button (or automatically when enabled), so the teacher has time to enter the pupil's details.
stage.addEventListener("pointerdown", (e) => {
  if (e.target.closest("[data-ui]")) return;
  if (state === "done") setState("idle", performance.now());
});

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
    status.textContent = "Δεν βρέθηκε κάμερα. Πάτησε Έναρξη και παίξε με το ποντίκι.";
  }
}

async function startTracker() {
  try {
    tracker = await Tracker.create();
    status.textContent = stream ? "Η κάμερα είναι έτοιμη." : status.textContent;
  } catch (e) {
    console.error(e);
    status.textContent = "Δεν φορτώθηκε το σύστημα παρακολούθησης χεριών. Πάτησε Έναρξη και παίξε με το ποντίκι.";
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
    if (near || play.paused) lastNearAt = now; // a paused session never times out
    if (state === "done") {
      // wait for the end screen to finish
    } else if (state === "idle") {
      nearSince = near && settings.autoStart ? nearSince || now : 0;
      if (nearSince && now - nearSince > ENTER_HOLD_MS) setState("playing", now);
    } else if (settings.autoStart && now - lastNearAt > LEAVE_AFTER_MS) {
      // Only for auto-started sessions; a teacher-started one ends via the end screen or the controls.
      setState("idle", now);
    }
  } else if (state === "playing" && !tracker && pointer.get(now)) {
    lastNearAt = now; // no camera: the mouse keeps the session alive
  }

  if (state === "done" && now - doneAt > END_SCREEN_MS) setState("idle", now);

  if (state === "playing") {
    const p = pointer.get(now);
    play.update(dt, p);
    cursorEl.hidden = !p || p.source === "mouse"; // the mouse keeps its normal arrow; the orange ring is for the hand
    if (p) {
      cursorEl.style.transform = `translate(${p.x}px, ${p.y}px)`;
      cursorEl.classList.toggle("pinch", p.pinching);
    }
  }
}
addEventListener("resize", () => play.resize(innerWidth, innerHeight));
requestAnimationFrame(frame);
