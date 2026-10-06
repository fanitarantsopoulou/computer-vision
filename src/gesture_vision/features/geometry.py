"""Per-frame geometric hand features."""

from __future__ import annotations

import numpy as np

from gesture_vision.tracking.types import HandObservation, Landmark


def pinch_distance(hand: HandObservation) -> float:
    """Thumb tip to index tip distance in palm units (wrist -> middle MCP == 1). ~0.1-0.2 when pinched."""
    lm = hand.normalized_landmarks
    return float(np.linalg.norm(lm[Landmark.THUMB_TIP] - lm[Landmark.INDEX_TIP]))


def pinch_point(hand: HandObservation) -> np.ndarray:
    """Midpoint of thumb and index tips in image coordinates ([0, 1] x, y)."""
    lm = hand.image_landmarks
    return (lm[Landmark.THUMB_TIP, :2] + lm[Landmark.INDEX_TIP, :2]) / 2


_FINGERS = (
    (Landmark.INDEX_MCP, Landmark.INDEX_TIP),
    (Landmark.MIDDLE_MCP, Landmark.MIDDLE_TIP),
    (Landmark.RING_MCP, Landmark.RING_TIP),
    (Landmark.PINKY_MCP, Landmark.PINKY_TIP),
)
_PALM = [Landmark.WRIST, Landmark.INDEX_MCP, Landmark.MIDDLE_MCP, Landmark.RING_MCP, Landmark.PINKY_MCP]


def finger_extensions(hand: HandObservation) -> np.ndarray:
    """(4,) for index, middle, ring, pinky: |wrist->tip| / |wrist->MCP|. ~2 extended, ~1 curled."""
    lm = hand.normalized_landmarks  # wrist at origin
    return np.array(
        [np.linalg.norm(lm[tip]) / max(float(np.linalg.norm(lm[mcp])), 1e-6) for mcp, tip in _FINGERS],
        dtype=np.float32,
    )


def palm_center(hand: HandObservation) -> np.ndarray:
    """Palm center in image coordinates ([0, 1] x, y)."""
    return hand.image_landmarks[_PALM, :2].mean(axis=0)
