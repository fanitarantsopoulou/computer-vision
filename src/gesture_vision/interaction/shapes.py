"""Drawn shapes: snap a freehand stroke to a clean shape, hit-test it, and move it."""

from __future__ import annotations

from dataclasses import dataclass

import cv2
import numpy as np

MIN_POINTS = 8
LINE_MAX_DEVIATION = 0.08  # max distance from the start-end chord / chord length
CLOSED_GAP_RATIO = 0.25  # start-end gap / path length
CIRCLE_FILL_MIN = 0.75  # area / enclosing-circle area: circle ~1.0, square ~0.64, triangle ~0.41


@dataclass
class Shape:
    kind: str  # "free" | "line" | "polygon" | "circle"
    points: np.ndarray  # (N, 2) float32 pixels; for "circle": the center, shape (1, 2)
    radius: float = 0.0  # circles only

    @property
    def label(self) -> str:
        if self.kind == "polygon":
            return {3: "triangle", 4: "rectangle"}.get(len(self.points), "polygon")
        return self.kind

    @property
    def closed(self) -> bool:
        return self.kind in ("polygon", "circle")

    def translate(self, delta: np.ndarray) -> None:
        self.points = self.points + np.asarray(delta, dtype=np.float32)

    def distance_to(self, point: np.ndarray) -> float:
        """0 inside a closed shape, otherwise distance in pixels to the outline."""
        p = np.asarray(point, dtype=np.float32)
        if self.kind == "circle":
            return max(0.0, float(np.linalg.norm(p - self.points[0])) - self.radius)
        if self.kind == "polygon":
            d = cv2.pointPolygonTest(self.points.reshape(-1, 1, 2), (float(p[0]), float(p[1])), True)
            return max(0.0, -d)
        return _polyline_distance(self.points, p)


def _polyline_distance(pts: np.ndarray, p: np.ndarray) -> float:
    if len(pts) == 1:
        return float(np.linalg.norm(p - pts[0]))
    a, b = pts[:-1], pts[1:]
    ab = b - a
    t = np.clip(((p - a) * ab).sum(axis=1) / np.maximum((ab * ab).sum(axis=1), 1e-6), 0, 1)
    return float(np.linalg.norm(a + t[:, None] * ab - p, axis=1).min())


def _path_length(pts: np.ndarray) -> float:
    return float(np.linalg.norm(np.diff(pts, axis=0), axis=1).sum())


def _is_line(pts: np.ndarray) -> bool:
    chord = pts[-1] - pts[0]
    chord_len = float(np.linalg.norm(chord))
    if chord_len < 1:
        return False
    rel = pts - pts[0]
    deviation = np.abs(rel[:, 0] * chord[1] - rel[:, 1] * chord[0]) / chord_len
    return float(deviation.max()) / chord_len < LINE_MAX_DEVIATION


def recognize(points: np.ndarray) -> Shape:
    pts = np.asarray(points, dtype=np.float32)
    free = Shape("free", pts)
    if len(pts) < MIN_POINTS:
        return free
    length = _path_length(pts)
    if length < 1:
        return free

    if _is_line(pts):
        return Shape("line", np.array([pts[0], pts[-1]]))

    if np.linalg.norm(pts[-1] - pts[0]) / length > CLOSED_GAP_RATIO:
        return free

    contour = pts.reshape(-1, 1, 2)
    area = cv2.contourArea(contour)
    _, enclosing_r = cv2.minEnclosingCircle(contour)
    if enclosing_r > 0 and area / (np.pi * enclosing_r**2) > CIRCLE_FILL_MIN:
        center = pts.mean(axis=0)
        radius = float(np.linalg.norm(pts - center, axis=1).mean())
        return Shape("circle", center.reshape(1, 2), radius)

    approx = cv2.approxPolyDP(contour, 0.04 * cv2.arcLength(contour, closed=True), closed=True).reshape(-1, 2)
    if len(approx) in (3, 4):
        return Shape("polygon", approx.astype(np.float32))
    return free
