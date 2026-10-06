"""Landmark normalization: make hand shape independent of position and size, but keep orientation.

Orientation is deliberately preserved because it carries gesture information (e.g. rotation).
Rotation-invariant canonicalization, if needed, belongs in the feature-extraction layer.
"""

from __future__ import annotations

import numpy as np

from gesture_vision.tracking.types import NUM_LANDMARKS, Landmark

_EPS = 1e-6


def normalize_landmarks(points: np.ndarray) -> np.ndarray:
    """Translate so the wrist is at the origin and scale so |wrist -> middle MCP| == 1.

    Args:
        points: (21, 3) array in any consistent metric space (e.g. MediaPipe world landmarks).
    Returns:
        (21, 3) float32 array. All zeros if the hand is degenerate.
    """
    points = np.asarray(points, dtype=np.float32)
    if points.shape != (NUM_LANDMARKS, 3):
        raise ValueError(f"Expected shape ({NUM_LANDMARKS}, 3), got {points.shape}")

    centered = points - points[Landmark.WRIST]
    scale = float(np.linalg.norm(centered[Landmark.MIDDLE_MCP]))
    if scale < _EPS:
        return np.zeros_like(centered)
    return centered / scale

