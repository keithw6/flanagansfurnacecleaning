#!/usr/bin/env python3
"""Flatten scenes into still images you can actually look at before encoding.

Rendering video is the slow part of this pipeline, and most mistakes (a
headline that overflows, a face cropped off, a scrim that hides the subject)
are visible in a still. Run this, open the frames, fix the storyboard, and only
then build.

Usage:
  python3 preview.py --work work/ [--only s03] [--sheet]   # --sheet = contact sheet
"""
from __future__ import annotations

import argparse
import math
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import ivlib as iv


def main():
    from PIL import Image

    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--work", required=True)
    ap.add_argument("--only")
    ap.add_argument("--sheet", action="store_true")
    ap.add_argument("--width", type=int, default=960)
    args = ap.parse_args()

    work = Path(args.work).resolve()
    sb = iv.load_storyboard(work / "storyboard.json")
    out = work / "preview"
    out.mkdir(parents=True, exist_ok=True)
    only = {s.strip() for s in args.only.split(",")} if args.only else None

    made = []
    for sc in sb["scenes"]:
        if only and sc["id"] not in only:
            continue
        frame = Image.new("RGB", (iv.CANVAS["w"], iv.CANVAS["h"]), (11, 12, 13))
        for k, region in enumerate(iv.layout_of(sc)["photos"]):
            p = work / "photos" / f"{sc['id']}_{k}.jpg"
            if not p.exists():
                continue
            with Image.open(p) as im:
                frame.paste(im.resize((region[2], region[3]), Image.LANCZOS), (region[0], region[1]))
        plate = work / "plates" / f"{sc['id']}.png"
        if plate.exists():
            with Image.open(plate) as pl:
                frame.paste(pl.convert("RGBA"), (0, 0), pl.convert("RGBA"))
        dest = out / f"{sc['id']}.jpg"
        frame.resize((args.width, int(args.width * 9 / 16)), Image.LANCZOS).save(dest, quality=90)
        made.append((sc, dest, frame))
        print(f"  {sc['id']}  {sc['layout']:<12} -> {dest}")

    if args.sheet and made:
        cols = 2
        tw = 760
        th = int(tw * 9 / 16)
        rows = math.ceil(len(made) / cols)
        sheet = Image.new("RGB", (cols * tw + (cols + 1) * 16, rows * th + (rows + 1) * 16), (24, 25, 27))
        for i, (_, _, frame) in enumerate(made):
            x = 16 + (i % cols) * (tw + 16)
            y = 16 + (i // cols) * (th + 16)
            sheet.paste(frame.resize((tw, th), Image.LANCZOS), (x, y))
        sheet.save(out / "contact-sheet.jpg", quality=88)
        print(f"  contact sheet -> {out/'contact-sheet.jpg'}")


if __name__ == "__main__":
    main()
