"""Hand tracker interface. Implementations can be swapped (MediaPipe, custom model, recorded playback...)."""

from __future__ import annotations

from abc import ABC, abstractmethod

import numpy as np

from gesture_vision.tracking.types import TrackingResult


class HandTracker(ABC):
    @abstractmethod
    def process(self, image_bgr: np.ndarray, timestamp_ms: int) -> TrackingResult:
        """Detect hands in one BGR frame. Timestamps must be strictly increasing across calls."""

    def close(self) -> None:  # noqa: B027 - optional hook
        """Release resources."""

    def __enter__(self) -> HandTracker:
        return self

    def __exit__(self, *exc) -> None:
        self.close()
