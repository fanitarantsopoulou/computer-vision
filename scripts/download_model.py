"""Download the MediaPipe hand landmarker model into ./models (one-time, then fully offline)."""

from __future__ import annotations

import sys
import urllib.request
from pathlib import Path

MODEL_URL = (
    "https://storage.googleapis.com/mediapipe-models/"
    "hand_landmarker/hand_landmarker/float16/latest/hand_landmarker.task"
)
DEST = Path(__file__).resolve().parent.parent / "models" / "hand_landmarker.task"


def main() -> int:
    if DEST.exists():
        print(f"Model already present: {DEST}")
        return 0
    DEST.parent.mkdir(parents=True, exist_ok=True)
    tmp = DEST.with_suffix(".part")
    print(f"Downloading {MODEL_URL}")
    try:
        urllib.request.urlretrieve(MODEL_URL, tmp)
    except OSError as exc:
        tmp.unlink(missing_ok=True)
        print(f"Download failed: {exc}", file=sys.stderr)
        return 1
    tmp.rename(DEST)
    print(f"Saved to {DEST} ({DEST.stat().st_size / 1e6:.1f} MB)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
