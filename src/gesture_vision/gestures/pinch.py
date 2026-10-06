"""Pinch gesture with hysteresis and release debouncing, so strokes don't break on landmark jitter."""

from __future__ import annotations


class PinchDetector:
    def __init__(self, start_threshold: float = 0.30, release_threshold: float = 0.45, release_frames: int = 3) -> None:
        if start_threshold >= release_threshold:
            raise ValueError("start_threshold must be below release_threshold")
        self.start_threshold = start_threshold
        self.release_threshold = release_threshold
        self.release_frames = release_frames
        self.active = False
        self._open_count = 0

    def update(self, distance: float | None) -> bool:
        """Feed this frame's pinch distance (None = no hand). Returns whether the pinch is active."""
        if distance is None:
            self.reset()
        elif not self.active:
            if distance < self.start_threshold:
                self.active = True
                self._open_count = 0
        elif distance > self.release_threshold:
            self._open_count += 1
            if self._open_count >= self.release_frames:
                self.reset()
        else:
            self._open_count = 0
        return self.active

    def reset(self) -> None:
        self.active = False
        self._open_count = 0
