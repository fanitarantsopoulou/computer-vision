"""Interactive mode: turns tracking results into gestures and drives the canvas and effects.

Gestures:
- pinch (thumb + index) on empty space -> draw; on a shape -> grab and move it
- fist, then open the hand quickly -> particle burst from the palm
"""

from __future__ import annotations

import logging

import cv2
import numpy as np

from gesture_vision.features import finger_extensions, palm_center, pinch_distance, pinch_point
from gesture_vision.gestures import FistReleaseDetector, HandPose, PinchDetector, classify_pose, index_curled
from gesture_vision.interaction.drawing import AirCanvas
from gesture_vision.interaction.effects import ParticleBurst
from gesture_vision.tracking.types import TrackingResult

log = logging.getLogger(__name__)

CURSOR_SMOOTHING = 0.5  # EMA weight of the previous position
HELP = "pinch: draw / grab   fist->open: burst   (s)nap (k)olor (z)undo (c)lear (d)ebug"


class Playground:
    def __init__(self, debug: bool = False) -> None:
        self.canvas = AirCanvas()
        self.effects = ParticleBurst()
        self.debug = debug
        self._pinch = PinchDetector()
        self._fist_release = FistReleaseDetector()
        self._cursor: np.ndarray | None = None
        self._pose: HandPose | None = None
        self._extensions: np.ndarray | None = None
        self._pinch_dist: float | None = None

    def update(self, result: TrackingResult) -> None:
        size = np.array([result.frame_width, result.frame_height], dtype=np.float32)
        hand = result.hands[0] if result.hands else None

        if hand is None:
            self._cursor = self._pose = self._extensions = self._pinch_dist = None
            pinching = self._pinch.update(None)
        else:
            self._extensions = finger_extensions(hand)
            self._pose = classify_pose(self._extensions)
            self._pinch_dist = pinch_distance(hand)
            # In a fist the thumb rests on the index finger; don't treat that as a pinch.
            blocked = self._pose is HandPose.FIST or index_curled(self._extensions)
            pinching = self._pinch.update(float("inf") if blocked else self._pinch_dist)
            target = pinch_point(hand) * size
            self._cursor = target if self._cursor is None else CURSOR_SMOOTHING * self._cursor + (1 - CURSOR_SMOOTHING) * target

        self.canvas.update(self._cursor, pinching)

        if self._fist_release.update(self._pose, result.timestamp_ms):
            log.info("Burst!")
            self.effects.burst(palm_center(hand) * size)
        self.effects.update(result.timestamp_ms)

    def handle_key(self, key: int) -> None:
        if key == ord("d"):
            self.debug = not self.debug
        else:
            self.canvas.handle_key(key)

    def render(self, image: np.ndarray) -> None:
        self.canvas.render(image)
        self.effects.render(image)

        h = image.shape[0]
        status = f"{HELP}   snap:{'on' if self.canvas.snap_shapes else 'off'}"
        _text(image, status, (12, h - 16), self.canvas.color)
        if self.debug and self._extensions is not None:
            ext = " ".join(f"{e:.2f}" for e in self._extensions)
            _text(image, f"pose:{self._pose.value}  ext[i m r p]: {ext}  pinch:{self._pinch_dist:.2f}", (12, h - 44), (255, 255, 255))


def _text(image: np.ndarray, text: str, org: tuple[int, int], color) -> None:
    cv2.putText(image, text, org, cv2.FONT_HERSHEY_SIMPLEX, 0.55, (0, 0, 0), 4, cv2.LINE_AA)
    cv2.putText(image, text, org, cv2.FONT_HERSHEY_SIMPLEX, 0.55, color, 1, cv2.LINE_AA)
