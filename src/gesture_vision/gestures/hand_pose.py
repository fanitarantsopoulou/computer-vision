"""Static hand pose from finger extensions. Thresholds are starting points; tune with the on-screen debug values."""

from __future__ import annotations

from enum import Enum

import numpy as np

CURLED_MAX = 1.25  # finger extension below this = curled
EXTENDED_MIN = 1.6  # finger extension above this = extended


class HandPose(str, Enum):
    OPEN = "open"
    FIST = "fist"
    OTHER = "other"


def classify_pose(extensions: np.ndarray) -> HandPose:
    """extensions: (4,) from features.finger_extensions (index, middle, ring, pinky)."""
    if (extensions < CURLED_MAX).all():
        return HandPose.FIST
    if (extensions > EXTENDED_MIN).all():
        return HandPose.OPEN
    return HandPose.OTHER


def index_curled(extensions: np.ndarray) -> bool:
    return bool(extensions[0] < CURLED_MAX)
