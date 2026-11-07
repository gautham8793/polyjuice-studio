"""Cut a subject rendered on a pure black background out into a transparent PNG.

Usage:
  tools/.venv/bin/python tools/cutout.py in.png out.png [--threshold 14] [--feather 3]

For AI images prompted "isolated on a pure solid black background" (cells, objects): every
bright blob becomes opaque, holes inside a blob are filled (dark shadows on the subject stay),
the edge is feathered and the result is cropped to the subject with a small margin.
"""
import argparse

import cv2
import numpy as np

parser = argparse.ArgumentParser()
parser.add_argument("src")
parser.add_argument("dst")
parser.add_argument("--threshold", type=int, default=14, help="brightness (0–255) above which a pixel is subject")
parser.add_argument("--feather", type=int, default=3, help="edge softness in pixels")
parser.add_argument("--keep-holes", action="store_true", help="don't fill enclosed dark areas (loops of tubing, rings)")
parser.add_argument("--min-area", type=float, default=0.0008, help="ignore specks smaller than this share of the image")
args = parser.parse_args()

img = cv2.imread(args.src, cv2.IMREAD_COLOR)
h, w = img.shape[:2]
lum = img.max(axis=2)

mask = (lum > args.threshold).astype(np.uint8) * 255
mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, np.ones((5, 5), np.uint8))
contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)
filled = np.zeros_like(mask)
keep = [c for c in contours if cv2.contourArea(c) > args.min_area * w * h]
cv2.drawContours(filled, keep, -1, 255, thickness=cv2.FILLED)
if args.keep_holes:
    # cut out only big enclosed gaps (a loop of tubing); small dark patches stay part of the subject
    holes = cv2.bitwise_and(filled, cv2.bitwise_not(mask))
    n, labels, stats, _ = cv2.connectedComponentsWithStats(holes)
    for i in range(1, n):
        if stats[i, cv2.CC_STAT_AREA] > 0.02 * w * h:
            filled[labels == i] = 0

filled = cv2.erode(filled, np.ones((3, 3), np.uint8))
k = args.feather * 2 + 1
alpha = cv2.GaussianBlur(filled, (k, k), 0)
# keep the faint outer glow instead of cutting it hard
glow = np.clip((lum.astype(np.float32) - args.threshold * 0.4) * 4, 0, 255).astype(np.uint8)
alpha = np.maximum(alpha, np.minimum(glow, cv2.dilate(alpha, np.ones((9, 9), np.uint8))))

out = np.dstack([img, alpha])
ys, xs = np.where(alpha > 8)
pad = 12
y0, y1 = max(0, ys.min() - pad), min(h, ys.max() + pad)
x0, x1 = max(0, xs.min() - pad), min(w, xs.max() + pad)
cv2.imwrite(args.dst, out[y0:y1, x0:x1])
print(f"{args.dst}: {x1 - x0}x{y1 - y0}, {len(keep)} blob(s)")
