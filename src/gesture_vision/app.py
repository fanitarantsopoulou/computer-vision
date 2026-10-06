"""Entry point: capture -> track -> visualize. Later stages (features, gestures, events) plug in here."""

from __future__ import annotations

import logging
import time

import cv2
import numpy as np

from gesture_vision.capture import CameraError, WebcamCapture
from gesture_vision.config import AppConfig, parse_args
from gesture_vision.interaction import Playground
from gesture_vision.logging_setup import setup_logging
from gesture_vision.tracking import HandTracker, TrackingResult
from gesture_vision.viz import FPSMeter, draw_hands, draw_stats

log = logging.getLogger("gesture_vision")

WINDOW_NAME = "gesture-vision (q / Esc to quit)"
LANDMARK_PRINT_INTERVAL_S = 1.0


def _log_landmarks(result: TrackingResult) -> None:
    np.set_printoptions(precision=3, suppress=True)
    for hand in result.hands:
        log.info(
            "t=%dms %s (%.2f) normalized landmarks (wrist-origin, unit palm):\n%s",
            result.timestamp_ms,
            hand.handedness,
            hand.handedness_score,
            hand.normalized_landmarks,
        )


def _window_closed() -> bool:
    try:
        return cv2.getWindowProperty(WINDOW_NAME, cv2.WND_PROP_VISIBLE) < 1
    except cv2.error:  # macOS Cocoa raises once the window is gone
        return True


def run(config: AppConfig, tracker: HandTracker) -> None:
    fps = FPSMeter()
    last_print = 0.0
    frames = 0
    playground = Playground(debug=config.log_level == "DEBUG") if config.draw else None

    with WebcamCapture(config.camera) as camera:
        while config.max_frames is None or frames < config.max_frames:
            frame = camera.read()
            result = tracker.process(frame.image, frame.timestamp_ms)
            fps.tick()
            frames += 1
            if playground:
                playground.update(result)

            if config.print_landmarks and result.has_hands and time.monotonic() - last_print > LANDMARK_PRINT_INTERVAL_S:
                _log_landmarks(result)
                last_print = time.monotonic()

            if not config.headless:
                draw_hands(frame.image, result)
                if playground:
                    playground.render(frame.image)
                draw_stats(frame.image, fps.fps, result.inference_ms, len(result.hands))
                cv2.imshow(WINDOW_NAME, frame.image)
                key = cv2.waitKey(1) & 0xFF
                if key in (ord("q"), 27):
                    break
                if playground:
                    playground.handle_key(key)
                if _window_closed():
                    break
            elif frames % 30 == 0:
                log.info("frame=%d fps=%.1f inference=%.1fms hands=%d",
                         frames, fps.fps, result.inference_ms, len(result.hands))

    log.info("Stopped after %d frames (avg fps %.1f)", frames, fps.fps)


def main(argv: list[str] | None = None) -> int:
    config = parse_args(argv)
    setup_logging(config.log_level)

    # Lazy: keeps `--help` and arg errors fast by not loading MediaPipe.
    from gesture_vision.tracking.mediapipe_tracker import MediaPipeHandTracker, ModelNotFoundError

    try:
        with MediaPipeHandTracker(config.tracker) as tracker:
            run(config, tracker)
    except (CameraError, ModelNotFoundError) as exc:
        log.error("%s", exc)
        return 1
    except KeyboardInterrupt:
        log.info("Interrupted")
    finally:
        cv2.destroyAllWindows()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
