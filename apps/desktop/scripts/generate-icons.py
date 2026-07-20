"""Regenerate Windows ICO + tray assets from apps/desktop/zeropaste.png.

Taskbar / EXE icons need multi-size ICO (esp. 256) for HiDPI.
Tray only needs small sizes; a single 48px ICO looks fine there but blurry on the taskbar.
"""
from __future__ import annotations

import io
import struct
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
MASTER = ROOT / "zeropaste.png"
ASSETS = ROOT / "assets"


def write_png_ico(path: Path, master: Image.Image, sizes: list[int]) -> None:
    """ICO with PNG-compressed images (Vista+). Required for a sharp 256px entry."""
    blobs: list[bytes] = []
    for s in sizes:
        buf = io.BytesIO()
        master.resize((s, s), Image.Resampling.LANCZOS).save(buf, format="PNG", optimize=True)
        blobs.append(buf.getvalue())

    count = len(sizes)
    offset = 6 + 16 * count
    out = io.BytesIO()
    out.write(struct.pack("<HHH", 0, 1, count))
    for s, raw in zip(sizes, blobs):
        w = 0 if s >= 256 else s
        h = 0 if s >= 256 else s
        out.write(struct.pack("<BBBBHHII", w, h, 0, 0, 1, 32, len(raw), offset))
        offset += len(raw)
    for raw in blobs:
        out.write(raw)
    path.write_bytes(out.getvalue())
    print(f"[generate-icons] {path.name} ({path.stat().st_size} bytes) sizes={sizes}")


def main() -> None:
    if not MASTER.exists():
        raise SystemExit(f"missing master logo: {MASTER}")
    ASSETS.mkdir(exist_ok=True)
    master = Image.open(MASTER).convert("RGBA")

    write_png_ico(ASSETS / "zeropaste.ico", master, [16, 24, 32, 48, 64, 128, 256])
    write_png_ico(ASSETS / "tray.ico", master, [16, 20, 24, 32, 48])
    master.resize((32, 32), Image.Resampling.LANCZOS).save(ASSETS / "tray.png", optimize=True)
    master.resize((512, 512), Image.Resampling.LANCZOS).save(ASSETS / "zeropaste.png", optimize=True)
    print("[generate-icons] done")


if __name__ == "__main__":
    main()
