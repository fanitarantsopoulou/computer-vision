import logging


def setup_logging(level: str = "INFO") -> None:
    # Note: MediaPipe's native (absl) startup lines go to stderr and are not controlled here.
    logging.basicConfig(
        level=level,
        format="%(asctime)s %(levelname)-7s %(name)s: %(message)s",
        datefmt="%H:%M:%S",
    )
