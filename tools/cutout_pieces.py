"""Cut paper pieces off a coloured background (e.g. torn-paper collage on mustard card).

The pieces are paper: white/grey/black, i.e. low saturation. The background and its cast
shadows are a saturated colour, so a saturation key separates them cleanly. Each separate piece
is saved as its own transparent PNG (left to right), plus the whole set, plus pieces.json with
each piece's box in the original image so they can be re-assembled exactly.

Usage:
  tools/.venv/bin/python -I tools/cutout_pieces.py in.jpg out_dir [--names a,b,c] [--sat 70] [--scale 2]
"""
import argparse
import json
from pathlib import Path

import cv2
import numpy as np

ap = argparse.ArgumentParser()
ap.add_argument("src")
ap.add_argument("out")
ap.add_argument("--names", default="", help="comma-separated names for the pieces, left to right")
ap.add_argument("--sat", type=int, default=70, help="saturation (0–255) below which a pixel is paper")
ap.add_argument("--min-area", type=float, default=0.004, help="ignore blobs smaller than this share of the image")
ap.add_argument("--scale", type=float, default=2.0, help="upscale factor for the saved PNGs (Lanczos)")
args = ap.parse_args()

img = cv2.imread(args.src, cv2.IMREAD_COLOR)
h, w = img.shape[:2]
hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV)
paper = (hsv[:, :, 1] < args.sat).astype(np.uint8) * 255
paper = cv2.morphologyEx(paper, cv2.MORPH_OPEN, np.ones((3, 3), np.uint8))
paper = cv2.morphologyEx(paper, cv2.MORPH_CLOSE, np.ones((7, 7), np.uint8))

contours, _ = cv2.findContours(paper, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)
contours = [c for c in contours if cv2.contourArea(c) > args.min_area * w * h]
contours.sort(key=lambda c: cv2.boundingRect(c)[0])
names = [n for n in args.names.split(",") if n] or [f"piece-{i + 1}" for i in range(len(contours))]
if len(names) != len(contours):
    raise SystemExit(f"found {len(contours)} pieces, but {len(names)} names were given")

out = Path(args.out)
out.mkdir(parents=True, exist_ok=True)
full_alpha = np.zeros((h, w), np.uint8)
meta = {"source": Path(args.src).name, "width": w, "height": h, "pieces": {}}
for name, c in zip(names, contours):
    m = np.zeros((h, w), np.uint8)
    cv2.drawContours(m, [c], -1, 255, thickness=cv2.FILLED)  # fills holes (dark ink inside the paper)
    m = cv2.GaussianBlur(m, (3, 3), 0)  # soft, anti-aliased torn edge
    full_alpha = np.maximum(full_alpha, m)
    x, y, bw, bh = cv2.boundingRect(c)
    pad = 4
    x0, y0, x1, y1 = max(0, x - pad), max(0, y - pad), min(w, x + bw + pad), min(h, y + bh + pad)
    rgba = np.dstack([img[y0:y1, x0:x1], m[y0:y1, x0:x1]])
    if args.scale != 1:
        rgba = cv2.resize(rgba, None, fx=args.scale, fy=args.scale, interpolation=cv2.INTER_LANCZOS4)
    cv2.imwrite(str(out / f"{name}.png"), rgba)
    meta["pieces"][name] = {"x": x0, "y": y0, "w": x1 - x0, "h": y1 - y0}
    print(f"{name}: box {x0},{y0} {x1 - x0}x{y1 - y0}")

ys, xs = np.where(full_alpha > 0)
x0, y0, x1, y1 = xs.min(), ys.min(), xs.max() + 1, ys.max() + 1
full = np.dstack([img, full_alpha])[y0:y1, x0:x1]
if args.scale != 1:
    full = cv2.resize(full, None, fx=args.scale, fy=args.scale, interpolation=cv2.INTER_LANCZOS4)
cv2.imwrite(str(out / "all.png"), full)
meta["all"] = {"x": int(x0), "y": int(y0), "w": int(x1 - x0), "h": int(y1 - y0)}
for p in meta["pieces"].values():  # piece boxes relative to the cropped "all" image
    p["x"] -= int(x0)
    p["y"] -= int(y0)
(out / "pieces.json").write_text(json.dumps(meta, indent=1))
print(f"all: {x1 - x0}x{y1 - y0} -> {out}")
