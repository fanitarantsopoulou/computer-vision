from __future__ import annotations

import time


class FPSMeter:
    """Exponentially smoothed frames-per-second estimate."""

    def __init__(self, smoothing: float = 0.9) -> None:
        self._smoothing = smoothing
        self._last: float | None = None
        self.fps = 0.0

    def tick(self, now: float | None = None) -> float:
        now = time.perf_counter() if now is None else now
        if self._last is not None:
            dt = now - self._last
            if dt > 0:
                inst = 1.0 / dt
                self.fps = inst if self.fps == 0 else self._smoothing * self.fps + (1 - self._smoothing) * inst
        self._last = now
        return self.fps
