"""OpenCV webcam capture producing timestamped BGR frames."""

from __future__ import annotations

import logging
import sys
import time
from dataclasses import dataclass

import cv2
import numpy as np

from gesture_vision.config import CameraConfig

log = logging.getLogger(__name__)


class CameraError(RuntimeError):
    pass


@dataclass(frozen=True)
class Frame:
    image: np.ndarray  # BGR, HxWx3, uint8
    timestamp_ms: int  # monotonic, strictly increasing
    index: int


class WebcamCapture:
    """Context-managed webcam reader. Tolerates a few transient read failures before giving up."""

    MAX_CONSECUTIVE_FAILURES = 30

    def __init__(self, config: CameraConfig) -> None:
        self._config = config
        self._cap: cv2.VideoCapture | None = None
        self._index = 0
        self._last_ts = -1
        self._t0 = time.monotonic()

    def open(self) -> None:
        backend = cv2.CAP_AVFOUNDATION if sys.platform == "darwin" else cv2.CAP_ANY
        cap = cv2.VideoCapture(self._config.index, backend)
        if not cap.isOpened():
            hint = (
                " On macOS, grant camera access to your terminal app in "
                "System Settings > Privacy & Security > Camera, then restart the terminal."
                if sys.platform == "darwin"
                else ""
            )
            raise CameraError(f"Could not open camera index {self._config.index}.{hint}")
        cap.set(cv2.CAP_PROP_FRAME_WIDTH, self._config.width)
        cap.set(cv2.CAP_PROP_FRAME_HEIGHT, self._config.height)
        self._cap = cap
        log.info(
            "Camera %d opened at %dx%d (requested %dx%d)",
            self._config.index,
            int(cap.get(cv2.CAP_PROP_FRAME_WIDTH)),
            int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT)),
            self._config.width,
            self._config.height,
        )

    def read(self) -> Frame:
        if self._cap is None:
            raise CameraError("Camera is not open")
        for _ in range(self.MAX_CONSECUTIVE_FAILURES):
            ok, image = self._cap.read()
            if ok and image is not None:
                break
            log.debug("Dropped frame")
            time.sleep(0.01)
        else:
            raise CameraError(f"Camera returned no frames {self.MAX_CONSECUTIVE_FAILURES} times in a row")

        if self._config.mirror:
            image = cv2.flip(image, 1)
        # MediaPipe VIDEO mode requires strictly increasing timestamps.
        ts = max(int((time.monotonic() - self._t0) * 1000), self._last_ts + 1)
        self._last_ts = ts
        frame = Frame(image=image, timestamp_ms=ts, index=self._index)
        self._index += 1
        return frame

    def close(self) -> None:
        if self._cap is not None:
            self._cap.release()
            self._cap = None

    def __enter__(self) -> WebcamCapture:
        self.open()
        return self

    def __exit__(self, *exc) -> None:
        self.close()
