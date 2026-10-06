# gesture-vision

Real-time hand tracking from a laptop webcam: the foundation for gesture-driven 3D interaction (Godot later).

**Milestone 1 (current):** webcam → MediaPipe hand tracking → 21 landmarks → normalized landmark output, plus a live overlay and FPS.

## Architecture

```
Webcam → capture/ → tracking/ → features/ → gestures/ → interaction/ → [events/] → [Godot]
                         └→ viz/ (debug overlay)
```
`[...]` = not built yet.

| Module | Role |
|---|---|
| `capture/` | OpenCV webcam → `Frame` (BGR image + monotonic timestamp). Mirrors the image for selfie view. |
| `tracking/types.py` | Tracker-agnostic data: `HandObservation`, `TrackingResult`, `Landmark` enum. Downstream code depends only on these. |
| `tracking/base.py` | `HandTracker` interface: `process(image_bgr, timestamp_ms) -> TrackingResult`. |
| `tracking/mediapipe_tracker.py` | MediaPipe Tasks `HandLandmarker` implementation (VIDEO mode = detection + inter-frame tracking). |
| `tracking/normalization.py` | Wrist-origin, unit-palm-size landmarks (position/scale invariant, orientation kept). |
| `features/` | Per-frame hand features: pinch distance/point, finger extensions, palm center. |
| `gestures/` | Static pose (open/fist), `PinchDetector` (hysteresis), `FistReleaseDetector` (temporal). |
| `interaction/` | `Playground` maps gestures to actions; `AirCanvas` (draw/move shapes), `ParticleBurst` effect. |
| `viz/` | Skeleton overlay and FPS/inference stats. No MediaPipe dependency. |
| `app.py` | Wires the loop and the CLI. |

Each hand exposes three landmark sets, all `(21, 3) float32`:
- `image_landmarks`: x, y in [0, 1] of the frame; use for on-screen position and movement.
- `world_landmarks`: metric 3D (meters); use for geometry.
- `normalized_landmarks`: world landmarks, wrist at origin, wrist→middle-MCP distance = 1. `feature_vector()` returns these as a flat (63,) vector for ML.

## Setup

Requires Python 3.10+ (developed on 3.12, macOS arm64).

```bash
python3.12 -m venv .venv
source .venv/bin/activate
pip install -e ".[dev]"
python scripts/download_model.py     # one-time, ~8 MB; runs fully offline afterwards
```

> `mediapipe` is pinned to `1.0.0`: `1.0.1` aborts on macOS during hand-landmarker init.
> Don't install `opencv-python` alongside it: MediaPipe uses `opencv-contrib-python`, and both provide `cv2`.

## Run

```bash
python -m gesture_vision                   # live window; q or Esc to quit
python -m gesture_vision --print-landmarks # also log normalized landmarks ~1x/sec
python -m gesture_vision --headless --max-frames 300   # no window; logs FPS
python -m gesture_vision --draw            # air drawing (see below)
python -m gesture_vision --help
```

### Interactive mode (`--draw`)

| Gesture | Action |
|---|---|
| Pinch (thumb + index) on empty space | Draw. On release, snaps to a **line, circle, triangle or rectangle** if close enough. |
| Pinch on a shape | Grab it and drag it (hovered shapes get a white outline). |
| Fist, then open the hand quickly | Particle burst from the palm. |

Keys: `s` toggle snapping · `k` next color · `z` undo · `c` clear · `d` debug values · `q`/`Esc` quit.

Pose thresholds (`gestures/hand_pose.py`) and pinch thresholds (`gestures/pinch.py`) are starting points; press `d` to see live finger-extension and pinch values when tuning.

On macOS, the first run asks for camera access for your terminal. If it was denied, enable it under **System Settings → Privacy & Security → Camera**, then restart the terminal.

## Tests

```bash
pytest
```
