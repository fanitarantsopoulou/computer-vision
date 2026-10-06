"""Particle burst effect with additive glow. Time-driven by frame timestamps (FPS-independent)."""

from __future__ import annotations

import cv2
import numpy as np

PARTICLES_PER_BURST = 140
SPEED_RANGE = (250.0, 900.0)  # px/s
LIFETIME_RANGE = (0.5, 1.1)  # s
DRAG = 2.5  # 1/s
GRAVITY = 300.0  # px/s^2
RING_DURATION = 0.35  # s
RING_MAX_RADIUS = 260.0  # px

_PALETTE = np.array([(0, 180, 255), (0, 90, 255), (60, 230, 255), (255, 255, 255), (255, 120, 40)], dtype=np.float32)


class ParticleBurst:
    def __init__(self, seed: int | None = None) -> None:
        self._rng = np.random.default_rng(seed)
        self.pos = np.zeros((0, 2), np.float32)
        self.vel = np.zeros((0, 2), np.float32)
        self.age = np.zeros(0, np.float32)
        self.life = np.zeros(0, np.float32)
        self.color = np.zeros((0, 3), np.float32)
        self._rings: list[tuple[np.ndarray, float]] = []  # (center, age)
        self._last_t: int | None = None

    @property
    def active(self) -> bool:
        return len(self.pos) > 0 or bool(self._rings)

    def burst(self, center: np.ndarray) -> None:
        n = PARTICLES_PER_BURST
        angle = self._rng.uniform(0, 2 * np.pi, n)
        speed = self._rng.uniform(*SPEED_RANGE, n)
        self.pos = np.vstack([self.pos, np.repeat(np.asarray(center, np.float32)[None], n, axis=0)])
        self.vel = np.vstack([self.vel, np.stack([np.cos(angle), np.sin(angle)], 1) * speed[:, None]]).astype(np.float32)
        self.age = np.concatenate([self.age, np.zeros(n, np.float32)])
        self.life = np.concatenate([self.life, self._rng.uniform(*LIFETIME_RANGE, n).astype(np.float32)])
        self.color = np.vstack([self.color, _PALETTE[self._rng.integers(0, len(_PALETTE), n)]])
        self._rings.append((np.asarray(center, np.float32), 0.0))

    def update(self, t_ms: int) -> None:
        dt = 0.0 if self._last_t is None else min((t_ms - self._last_t) / 1000.0, 0.1)
        self._last_t = t_ms
        if dt <= 0:
            return
        self.vel *= np.exp(-DRAG * dt)
        self.vel[:, 1] += GRAVITY * dt
        self.pos += self.vel * dt
        self.age += dt
        alive = self.age < self.life
        self.pos, self.vel, self.age, self.life, self.color = (
            self.pos[alive], self.vel[alive], self.age[alive], self.life[alive], self.color[alive]
        )
        self._rings = [(c, a + dt) for c, a in self._rings if a + dt < RING_DURATION]

    def render(self, image: np.ndarray) -> None:
        if not self.active:
            return
        glow = np.zeros_like(image)
        fade = 1.0 - self.age / self.life
        for (x, y), f, color in zip(self.pos.astype(int), fade, self.color):
            cv2.circle(glow, (int(x), int(y)), max(1, int(2 + 5 * f)), (color * f).tolist(), -1, cv2.LINE_AA)
        for center, age in self._rings:
            k = age / RING_DURATION
            cx, cy = center.astype(int)
            cv2.circle(glow, (int(cx), int(cy)), int(RING_MAX_RADIUS * k), (255 * (1 - k),) * 3, max(1, int(10 * (1 - k))), cv2.LINE_AA)
        cv2.add(image, glow, dst=image)
