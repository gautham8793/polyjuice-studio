"""Build library/maps/world/countries.geojson for the documentary template's atlas maps.

Source: Natural Earth 1:50m Admin-0 countries (public domain), saved in
library/maps/world/_src/. India's shape is replaced with our own India outline
(library/maps/india/outline.geojson), which follows India's official boundary.

Output keeps only the ISO code (iso) and name per country and rounds coordinates to
0.01 degrees (~1 km), which is plenty at video scale and keeps the file small.

Run from the repo root:  python3 -I tools/make_world_map.py
"""
import json
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CONTENT = os.path.join(ROOT, "workspace") if os.path.isdir(os.path.join(ROOT, "workspace")) else ROOT
SRC = os.path.join(CONTENT, "library/maps/world/_src/ne_50m_admin_0_countries.geojson")
INDIA = os.path.join(CONTENT, "library/maps/india/outline.geojson")
OUT = os.path.join(CONTENT, "library/maps/world/countries.geojson")


def rnd(coords):
    if isinstance(coords[0], (int, float)):
        return [round(coords[0], 2), round(coords[1], 2)]
    out = [rnd(c) for c in coords]
    # drop consecutive duplicates created by rounding (rings only)
    if out and isinstance(out[0][0], (int, float)):
        dedup = [out[0]]
        for p in out[1:]:
            if p != dedup[-1]:
                dedup.append(p)
        return dedup
    return out


def main():
    src = json.load(open(SRC, encoding="utf-8"))
    india = json.load(open(INDIA, encoding="utf-8"))
    india_geom = india["features"][0]["geometry"]
    feats = []
    for f in src["features"]:
        p = f["properties"]
        iso = p.get("ADM0_A3") or p.get("ISO_A3")
        geom = india_geom if iso == "IND" else f["geometry"]
        feats.append({
            "type": "Feature",
            "properties": {"iso": iso, "name": p.get("NAME")},
            "geometry": {"type": geom["type"], "coordinates": rnd(geom["coordinates"])},
        })
    out = {"type": "FeatureCollection", "features": feats}
    with open(OUT, "w", encoding="utf-8") as fh:
        json.dump(out, fh, separators=(",", ":"), ensure_ascii=False)
    print(f"{len(feats)} countries -> {OUT} ({os.path.getsize(OUT) // 1024} KB)")


if __name__ == "__main__":
    sys.exit(main())
