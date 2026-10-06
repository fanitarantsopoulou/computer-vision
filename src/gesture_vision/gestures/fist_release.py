"""Temporal gesture: hold a fist, then open the hand quickly -> fires once."""

from __future__ import annotations

from gesture_vision.gestures.hand_pose import HandPose


class FistReleaseDetector:
    def __init__(self, min_fist_ms: int = 150, max_gap_ms: int = 700, cooldown_ms: int = 600) -> None:
        self.min_fist_ms = min_fist_ms
        self.max_gap_ms = max_gap_ms  # max time between the last fist frame and the open hand
        self.cooldown_ms = cooldown_ms
        self._fist_since: int | None = None
        self._last_fist: int | None = None
        self._last_fire = -(10**9)

    def update(self, pose: HandPose | None, t_ms: int) -> bool:
        """Feed this frame's pose (None = no hand). Returns True on the frame the gesture completes."""
        if pose is None:
            self._reset()
            return False
        if pose is HandPose.FIST:
            if self._fist_since is None:
                self._fist_since = t_ms
            self._last_fist = t_ms
            return False
        if self._last_fist is None:
            return False
        if t_ms - self._last_fist > self.max_gap_ms:
            self._reset()
            return False
        if (
            pose is HandPose.OPEN
            and self._last_fist - self._fist_since >= self.min_fist_ms
            and t_ms - self._last_fire >= self.cooldown_ms
        ):
            self._last_fire = t_ms
            self._reset()
            return True
        return False

    def _reset(self) -> None:
        self._fist_since = None
        self._last_fist = None
