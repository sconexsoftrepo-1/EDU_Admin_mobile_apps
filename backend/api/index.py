"""Vercel entry point: every request (see vercel.json rewrites) is served by the FastAPI app."""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.asgi import app  # noqa: E402

__all__ = ["app"]
