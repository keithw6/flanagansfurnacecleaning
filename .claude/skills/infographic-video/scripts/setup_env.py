#!/usr/bin/env python3
"""Check (and if needed install) what the pipeline runs on: Pillow, Playwright
with a Chromium build, and ffmpeg. Safe to run repeatedly - it only installs
what is missing.

Usage: python3 setup_env.py [--check-only]
"""
from __future__ import annotations

import argparse
import subprocess
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import ivlib as iv


def pip_install(*pkgs) -> bool:
    print(f"  installing {' '.join(pkgs)} ...")
    r = subprocess.run([sys.executable, "-m", "pip", "install", "--quiet", *pkgs],
                       capture_output=True, text=True)
    if r.returncode != 0:
        print(r.stdout[-1500:], r.stderr[-1500:])
    return r.returncode == 0


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--check-only", action="store_true")
    args = ap.parse_args()
    ok = True

    try:
        import PIL
        print(f"  PASS  Pillow {PIL.__version__}")
    except ImportError:
        if args.check_only or not pip_install("pillow"):
            print("  FAIL  Pillow missing (pip install pillow)"); ok = False
        else:
            print("  PASS  Pillow installed")

    try:
        import playwright
        print("  PASS  playwright python package")
    except ImportError:
        if args.check_only or not pip_install("playwright"):
            print("  FAIL  playwright missing (pip install playwright)"); ok = False
        else:
            print("  PASS  playwright installed")

    exe = iv.find_chromium()
    if exe:
        print(f"  PASS  chromium at {exe}")
    elif args.check_only:
        print("  FAIL  no chromium found"); ok = False
    else:
        print("  installing chromium via playwright ...")
        r = subprocess.run([sys.executable, "-m", "playwright", "install", "chromium"],
                           capture_output=True, text=True)
        exe = iv.find_chromium()
        if exe:
            print(f"  PASS  chromium at {exe}")
        else:
            print("  FAIL  chromium install failed:", r.stderr[-800:]); ok = False

    try:
        ff = iv.find_ffmpeg()
        v = iv.run([ff, "-version"]).stdout.splitlines()[0]
        print(f"  PASS  {v.split(' Copyright')[0]}  ({ff})")
    except SystemExit:
        if args.check_only or not pip_install("imageio-ffmpeg"):
            print("  FAIL  no ffmpeg (pip install imageio-ffmpeg, or apt-get install ffmpeg)"); ok = False
        else:
            print(f"  PASS  ffmpeg at {iv.find_ffmpeg()}")

    fonts = list((iv.skill_dir() / "assets" / "fonts").glob("*.woff2"))
    print(f"  {'PASS' if fonts else 'WARN'}  {len(fonts)} brand font files bundled"
          + ("" if fonts else " - plates will fall back to a system sans"))

    print("\nready" if ok else "\nsomething is missing - see FAIL lines above")
    sys.exit(0 if ok else 1)


if __name__ == "__main__":
    main()
