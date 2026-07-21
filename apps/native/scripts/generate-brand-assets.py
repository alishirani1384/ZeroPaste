"""Regenerate launcher / splash assets with Android adaptive safe-zone padding."""

from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT.parent / "web" / "public" / "favicon" / "web-app-manifest-512x512.png"
OUT = ROOT / "assets"

BG = (28, 28, 30, 255)  # #1C1C1E
CLEAR = (0, 0, 0, 0)


def extract_white_mark(im: Image.Image) -> Image.Image:
  """Pull the white Ø only (no plate / noise), trimmed to content."""
  arr = np.array(im.convert("RGBA"))
  h, w = arr.shape[:2]
  lum = (
    0.2126 * arr[:, :, 0].astype(np.float32)
    + 0.7152 * arr[:, :, 1].astype(np.float32)
    + 0.0722 * arr[:, :, 2].astype(np.float32)
  )
  # Ignore near-edge noise from the source plate
  yy, xx = np.mgrid[0:h, 0:w]
  margin = int(min(h, w) * 0.04)
  in_core = (xx >= margin) & (xx < w - margin) & (yy >= margin) & (yy < h - margin)

  alpha = np.clip((lum - 150) / 60.0, 0, 1)
  alpha = np.where(in_core, alpha, 0)
  alpha_u8 = (alpha * 255).astype(np.uint8)

  out = np.zeros_like(arr)
  out[:, :, 0] = 255
  out[:, :, 1] = 255
  out[:, :, 2] = 255
  out[:, :, 3] = alpha_u8

  ys, xs = np.where(alpha_u8 > 10)
  if len(xs) == 0:
    return Image.fromarray(out, "RGBA")
  pad = 6
  x0 = max(0, int(xs.min()) - pad)
  x1 = min(w, int(xs.max()) + 1 + pad)
  y0 = max(0, int(ys.min()) - pad)
  y1 = min(h, int(ys.max()) + 1 + pad)
  return Image.fromarray(out, "RGBA").crop((x0, y0, x1, y1))


def fit_mark(size: int, scale: float, bg: tuple[int, int, int, int], mark: Image.Image) -> Image.Image:
  canvas = Image.new("RGBA", (size, size), bg)
  box = max(1, int(size * scale))
  g = mark.copy()
  g.thumbnail((box, box), Image.Resampling.LANCZOS)
  x = (size - g.size[0]) // 2
  y = (size - g.size[1]) // 2
  canvas.alpha_composite(g, (x, y))
  return canvas


def main() -> None:
  art = Image.open(SRC).convert("RGBA")
  mark = extract_white_mark(art)
  print("mark", mark.size)

  fit_mark(1024, 0.56, BG, mark).resize((512, 512), Image.Resampling.LANCZOS).save(
    OUT / "icon.png", optimize=True
  )
  fit_mark(1024, 0.52, CLEAR, mark).resize((512, 512), Image.Resampling.LANCZOS).save(
    OUT / "adaptive-icon.png", optimize=True
  )
  fit_mark(1024, 0.20, CLEAR, mark).save(OUT / "splash-icon.png", optimize=True)
  fit_mark(192, 0.56, BG, mark).resize((96, 96), Image.Resampling.LANCZOS).save(
    OUT / "favicon.png", optimize=True
  )

  for name in ("icon.png", "adaptive-icon.png", "splash-icon.png", "favicon.png"):
    p = OUT / name
    im = Image.open(p)
    print(name, im.size, im.mode, p.stat().st_size)


if __name__ == "__main__":
  main()
