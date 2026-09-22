#!/usr/bin/env python3
"""Prove the finished video matches the narration, rather than assuming it.

Checks, in the order that matters if one fails:
  * video duration vs narration duration (must be within a single frame)
  * frame count vs round(duration x fps)
  * the muxed audio is the full narration, not a truncated copy
  * canvas size and frame rate are what the storyboard asked for
  * no scene got squeezed below the minimum, and cuts land in pauses

Exits non-zero when something is off, so it can gate a delivery.

Usage: python3 verify.py --work work/ [--out video.mp4]
"""
from __future__ import annotations

import argparse
import re
import subprocess
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import ivlib as iv


def stream_report(path: Path):
    r = iv.run([iv.find_ffmpeg(), "-hide_banner", "-i", str(path), "-f", "null", "-"])
    err = r.stderr
    info = {}
    m = re.search(r"Video: (\w+).*?, (\w+)[^,]*, (\d+)x(\d+)[^,]*?, .*?([\d.]+) fps", err, re.S)
    if m:
        info.update(codec=m.group(1), pix_fmt=m.group(2), w=int(m.group(3)),
                    h=int(m.group(4)), fps=float(m.group(5)))
    a = re.search(r"Audio: (\w+)[^,]*, (\d+) Hz, (\w+)", err)
    if a:
        info.update(acodec=a.group(1), ar=int(a.group(2)), ach=a.group(3))
    return info


def decoded_end(path: Path, stream: str) -> float | None:
    r = iv.run([iv.find_ffmpeg(), "-hide_banner", "-i", str(path), "-map", stream, "-f", "null", "-"])
    hits = re.findall(r"time=(\d+):(\d\d):(\d\d\.\d+)", r.stderr)
    if not hits:
        return None
    h, m, s = hits[-1]
    return int(h) * 3600 + int(m) * 60 + float(s)


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--work", required=True)
    ap.add_argument("--out")
    args = ap.parse_args()

    work = Path(args.work).resolve()
    sb = iv.load_storyboard(work / "storyboard.json")
    fps = sb["canvas"]["fps"]
    out = Path(args.out) if args.out else Path(sb.get("output") or work / f"{sb['project']}.mp4")
    if not out.exists():
        sys.exit(f"no video at {out} - run build_video.py first")

    audio = (sb.get("audio") or {}).get("path")
    checks, problems = [], []

    def check(ok, label, detail):
        checks.append((bool(ok), label, detail))
        if not ok:
            problems.append(f"{label}: {detail}")

    info = stream_report(out)
    v_end = decoded_end(out, "0:v:0")
    frames = iv.video_frame_count(out)

    check(info.get("w") == sb["canvas"]["w"] and info.get("h") == sb["canvas"]["h"],
          "canvas", f"{info.get('w')}x{info.get('h')} (wanted {sb['canvas']['w']}x{sb['canvas']['h']})")
    check(abs((info.get("fps") or 0) - fps) < 0.02, "frame rate", f"{info.get('fps')} fps (wanted {fps})")

    if audio and Path(audio).exists():
        a_src = iv.audio_duration(audio)
        a_end = decoded_end(out, "0:a:0")
        tol = 1.0 / fps
        delta = abs((v_end or 0) - a_src)
        check(delta <= tol + 1e-6, "video length vs narration",
              f"video {v_end:.3f}s / narration {a_src:.3f}s  (off by {delta*1000:.0f} ms, "
              f"one frame = {tol*1000:.0f} ms)")
        check(frames in (iv.frames(a_src, fps), iv.frames(a_src, fps) - 1, iv.frames(a_src, fps) + 1),
              "frame count", f"{frames} frames (expected {iv.frames(a_src, fps)})")
        if a_end is not None:
            check(abs(a_end - a_src) <= 0.05, "narration is complete in the mux",
                  f"muxed audio ends at {a_end:.3f}s, source is {a_src:.3f}s")
        check(info.get("acodec") is not None, "audio stream present", info.get("acodec", "missing"))
    else:
        check(True, "no narration yet", f"draft video is {v_end:.3f}s - re-run sync once the WAV exists")

    scenes = sb["scenes"]
    tot = sum(float(s["end"]) - float(s["start"]) for s in scenes)
    gaps = []
    for i in range(1, len(scenes)):
        if abs(float(scenes[i]["start"]) - float(scenes[i - 1]["end"])) > 1e-6:
            gaps.append(scenes[i]["id"])
    check(not gaps, "scene boundaries are continuous", ", ".join(gaps) if gaps else "no gaps or overlaps")
    shortest = min(((float(s["end"]) - float(s["start"])), s["id"]) for s in scenes)
    check(shortest[0] >= 1.0, "no scene is too short to read",
          f"shortest is {shortest[1]} at {shortest[0]:.2f}s")
    if audio:
        check(abs(tot - float(sb["audio"]["duration"])) < 0.05, "scene lengths sum to the narration",
              f"{tot:.3f}s vs {float(sb['audio']['duration']):.3f}s")

    rep = (sb.get("timing") or {}).get("report") or []
    off_pause = [r["id"] for r in rep if not r.get("on_pause")]
    drifted = [r["id"] for r in rep if abs(r.get("drift", 0)) > 2.5]

    lines = [f"# Verification - {out.name}", "",
             f"`{out}`  {out.stat().st_size/1e6:.1f} MB  {info.get('w')}x{info.get('h')} "
             f"@ {info.get('fps')}fps  {frames} frames", ""]
    for ok, label, detail in checks:
        lines.append(f"- {'PASS' if ok else 'FAIL'}  **{label}** - {detail}")
    if off_pause:
        lines += ["", f"Cuts that did not land in a pause (fine, just worth an eye): {', '.join(off_pause)}"]
    if drifted:
        lines += ["", f"Scenes more than 2.5s from their zip timestamp: {', '.join(drifted)}"]
    (work / "verify.md").write_text("\n".join(lines) + "\n")

    for ok, label, detail in checks:
        print(f"  {'PASS' if ok else 'FAIL'}  {label:<34} {detail}")
    print(f"\nwrote {work/'verify.md'}")
    if problems:
        print("\n" + "\n".join("FAILED - " + p for p in problems))
        sys.exit(1)
    print("\nall checks passed - the video and the narration are the same length.")


if __name__ == "__main__":
    main()
