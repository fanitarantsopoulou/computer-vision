"""Tracker-agnostic data types. Everything downstream (features, gestures, events) depends only on these."""

from __future__ import annotations

from dataclasses import dataclass
from enum import IntEnum

import numpy as np

NUM_LANDMARKS = 21


class Landmark(IntEnum):
    """MediaPipe hand landmark indices."""

    WRIST = 0
    THUMB_CMC = 1
    THUMB_MCP = 2
    THUMB_IP = 3
    THUMB_TIP = 4
    INDEX_MCP = 5
    INDEX_PIP = 6
    INDEX_DIP = 7
    INDEX_TIP = 8
    MIDDLE_MCP = 9
    MIDDLE_PIP = 10
    MIDDLE_DIP = 11
    MIDDLE_TIP = 12
    RING_MCP = 13
    RING_PIP = 14
    RING_DIP = 15
    RING_TIP = 16
    PINKY_MCP = 17
    PINKY_PIP = 18
    PINKY_DIP = 19
    PINKY_TIP = 20


@dataclass(frozen=True)
class HandObservation:
    """One detected hand in one frame. All arrays are float32 of shape (21, 3)."""

    handedness: str  # "Left" | "Right" (as seen by the user when the feed is mirrored)
    handedness_score: float
    image_landmarks: np.ndarray  # x, y in [0, 1] of frame width/height; z = relative depth (wrist ~ 0)
    world_landmarks: np.ndarray  # metric (meters), origin near the hand's geometric center
    normalized_landmarks: np.ndarray  # wrist-centered, scale-invariant; see tracking.normalization

    def feature_vector(self) -> np.ndarray:
        """Flat (63,) vector of normalized landmarks; the baseline input for feature extraction / ML."""
        return self.normalized_landmarks.reshape(-1)


@dataclass(frozen=True)
class TrackingResult:
    timestamp_ms: int
    frame_width: int
    frame_height: int
    hands: tuple[HandObservation, ...]
    inference_ms: float = 0.0

    @property
    def has_hands(self) -> bool:
        return bool(self.hands)
