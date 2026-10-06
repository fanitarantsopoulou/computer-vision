"""Debug overlay drawing. Pure OpenCV; no MediaPipe dependency."""

from __future__ import annotations

import cv2
import numpy as np

from gesture_vision.tracking.types import Landmark, TrackingResult

# (start, end) landmark index pairs forming the hand skeleton.
HAND_CONNECTIONS: tuple[tuple[int, int], ...] = (
    (0, 1), (1, 2), (2, 3), (3, 4),          # thumb
    (0, 5), (5, 6), (6, 7), (7, 8),          # index
    (5, 9), (9, 10), (10, 11), (11, 12),     # middle
    (9, 13), (13, 14), (14, 15), (15, 16),   # ring
    (13, 17), (0, 17), (17, 18), (18, 19), (19, 20),  # pinky + palm
)  # fmt: skip

_TIPS = {Landmark.THUMB_TIP, Landmark.INDEX_TIP, Landmark.MIDDLE_TIP, Landmark.RING_TIP, Landmark.PINKY_TIP}
_COLORS = {"Left": (255, 160, 0), "Right": (0, 200, 255)}  # BGR
_FONT = cv2.FONT_HERSHEY_SIMPLEX


def draw_hands(image: np.ndarray, result: TrackingResult) -> None:
    """Draw skeleton, landmark points and handedness label in place."""
    h, w = image.shape[:2]
    for hand in result.hands:
        color = _COLORS.get(hand.handedness, (0, 255, 0))
        pts = (hand.image_landmarks[:, :2] * (w, h)).astype(int)
        for a, b in HAND_CONNECTIONS:
            cv2.line(image, tuple(pts[a]), tuple(pts[b]), (230, 230, 230), 2, cv2.LINE_AA)
        for i, (x, y) in enumerate(pts):
            radius = 6 if i in _TIPS else 4
            cv2.circle(image, (x, y), radius, color, -1, cv2.LINE_AA)
            cv2.circle(image, (x, y), radius, (40, 40, 40), 1, cv2.LINE_AA)
        wx, wy = pts[Landmark.WRIST]
        label = f"{hand.handedness} {hand.handedness_score:.2f}"
        cv2.putText(image, label, (wx - 30, wy + 30), _FONT, 0.6, color, 2, cv2.LINE_AA)


def draw_stats(image: np.ndarray, fps: float, inference_ms: float, num_hands: int) -> None:
    lines = (f"FPS {fps:5.1f}", f"Inference {inference_ms:5.1f} ms", f"Hands {num_hands}")
    cv2.rectangle(image, (8, 8), (230, 20 + 26 * len(lines)), (0, 0, 0), -1)
    for i, text in enumerate(lines):
        cv2.putText(image, text, (16, 34 + 26 * i), _FONT, 0.65, (0, 255, 0), 2, cv2.LINE_AA)
