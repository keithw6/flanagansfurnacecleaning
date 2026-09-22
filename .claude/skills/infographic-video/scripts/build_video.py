#!/usr/bin/env python3
"""Assemble the scenes into the finished video.

Each scene is rendered to its own clip first (bounded memory, readable errors),
then the clips are cross-faded together and the narration is muxed in a single
final encode. The final pass carries `-t <audio duration>`, so the container
duration is the narration duration - not "close to" it.

Cross-fade bookkeeping: a fade of T seconds eats T seconds of timeline per
join, so every clip is cut T longer (T/2 for the first and last) and each fade
is centred on its scene boundary. The visible scene starts and ends land
exactly where sync_audio.py put them.

Usage:
  python3 build_video.py --work work/ [--out video.mp4] [--draft] [--no-motion]
"""
from __future__ import annotations

import argparse
import subprocess
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import ivlib as iv

BG = "#0B0C0D"


def zoom_filter(idx, region, motion, nframes, fps, photo_wh):
    """Ken Burns for one photo, output sized to its region."""
    rw, rh = region[2], region[3]
    pw, ph = photo_wh
    ow, oh = min(pw, rw * 2), min(ph, rh * 2)      # oversample, then land on the region
    ow -= ow % 2
    oh -= oh % 2
    n = max(nframes, 2)
    if motion in (None, "none", ""):
        return f"[{idx}:v]scale={rw}:{rh}:flags=lanczos,setsar=1[p{idx}]"
    amt = 0.08
    if motion == "in":
        z = f"1+{amt}*on/{n - 1}"
        x, y = "iw/2-(iw/zoom/2)", "ih/2-(ih/zoom/2)"
    elif motion == "out":
        z = f"{1 + amt}-{amt}*on/{n - 1}"
        x, y = "iw/2-(iw/zoom/2)", "ih/2-(ih/zoom/2)"
    else:
        z = f"{1 + amt}"
        if motion in ("left", "right"):
            t = f"(iw-iw/zoom)*on/{n - 1}"
            x = t if motion == "right" else f"(iw-iw/zoom)-({t})"
            y = "ih/2-(ih/zoom/2)"
        else:
            t = f"(ih-ih/zoom)*on/{n - 1}"
            y = t if motion == "down" else f"(ih-ih/zoom)-({t})"
            x = "iw/2-(iw/zoom/2)"
    return (f"[{idx}:v]zoompan=z='{z}':x='{x}':y='{y}':d={n}:s={ow}x{oh}:fps={fps},"
            f"scale={rw}:{rh}:flags=lanczos,setsar=1[p{idx}]")


def build_clip(ff, work, sc, clip_len, fps, draft, motion_on, quiet, fade=0.0, is_last=False):
    from PIL import Image

    region_list = iv.layout_of(sc)["photos"]
    photos = []
    for k, region in enumerate(region_list):
        p = work / "photos" / f"{sc['id']}_{k}.jpg"
        if p.exists():
            photos.append((p, region))
    plate = work / "plates" / f"{sc['id']}.png"
    if not plate.exists():
        sys.exit(f"missing plate for {sc['id']} - run render_scenes.py first")

    n = max(2, iv.frames(clip_len, fps))
    cmd = [ff, "-y", "-hide_banner", "-loglevel", "error"]
    for p, _ in photos:
        cmd += ["-i", str(p)]
    plate_idx = len(photos)
    cmd += ["-loop", "1", "-i", str(plate)]

    parts = [f"color=c={BG}:s={iv.CANVAS['w']}x{iv.CANVAS['h']}:r={fps}[base]"]
    for i, (p, region) in enumerate(photos):
        with Image.open(p) as im:
            wh = im.size
        parts.append(zoom_filter(i, region, sc.get("motion") if motion_on else "none", n, fps, wh))
    last = "base"
    for i, (_, region) in enumerate(photos):
        out = f"b{i}"
        parts.append(f"[{last}][p{i}]overlay=x={region[0]}:y={region[1]}:eof_action=repeat[{out}]")
        last = out
    # Fade the graphics layer inside the clip, over the same span as the
    # cross-fade between clips. Dissolving two full plates against each other
    # double-prints the type for a few frames; this way the photos dissolve and
    # the words are already gone.
    plate_in = f"[{plate_idx}:v]format=rgba"
    if fade > 0.01:
        half = fade / 2.0
        # Outgoing type is gone by the midpoint of the dissolve and incoming
        # type only starts there, so the two headlines never overlap - the
        # photographs cross over, the words hand off.
        plate_in += f",fade=t=in:st={half:.3f}:d={half:.3f}:alpha=1"
        if not is_last:
            plate_in += f",fade=t=out:st={max(0.0, clip_len - fade):.3f}:d={half:.3f}:alpha=1"
    parts.append(plate_in + "[pl]")
    parts.append(f"[{last}][pl]overlay=0:0:eof_action=repeat,format=yuv420p[v]")

    out = work / "clips" / f"{sc['id']}.mp4"
    out.parent.mkdir(parents=True, exist_ok=True)
    cmd += ["-filter_complex", ";".join(parts), "-map", "[v]",
            "-frames:v", str(n), "-r", str(fps),
            "-c:v", "libx264", "-preset", "ultrafast" if draft else "veryfast",
            "-crf", "22" if draft else "16", "-pix_fmt", "yuv420p", str(out)]
    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.returncode != 0:
        print(r.stderr[-3000:])
        sys.exit(f"clip render failed for {sc['id']}")
    if not quiet:
        print(f"  clip   {sc['id']}  {clip_len:5.2f}s  {n:4d} frames  {sc.get('motion') if motion_on else 'static'}")
    return out


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--work", required=True)
    ap.add_argument("--out")
    ap.add_argument("--draft", action="store_true", help="fast, lower quality, no camera move")
    ap.add_argument("--no-motion", action="store_true")
    ap.add_argument("--quiet", action="store_true")
    args = ap.parse_args()

    work = Path(args.work).resolve()
    sb = iv.load_storyboard(work / "storyboard.json")
    scenes = sb["scenes"]
    fps = sb["canvas"]["fps"]
    ff = iv.find_ffmpeg()
    motion_on = not (args.no_motion or args.draft)

    tr = sb.get("transition") or {}
    T = 0.0 if (tr.get("type") in (None, "none", "cut")) else float(tr.get("duration", 0.4))
    dur = [max(0.1, float(s["end"]) - float(s["start"])) for s in scenes]
    T = min(T, min(dur) * 0.6) if dur else 0.0       # never fade longer than the shortest scene

    n = len(scenes)
    clip_len = []
    for i, d in enumerate(dur):
        extra = 0.0 if n == 1 else (T / 2 if i in (0, n - 1) else T)
        clip_len.append(d + extra)

    clips = [build_clip(ff, work, sc, clip_len[i], fps, args.draft, motion_on, args.quiet,
                        fade=T, is_last=(i == n - 1))
             for i, sc in enumerate(scenes)]

    audio = (sb.get("audio") or {}).get("path")
    total = float((sb.get("audio") or {}).get("duration") or sum(dur))

    cmd = [ff, "-y", "-hide_banner", "-loglevel", "error", "-stats"]
    for c in clips:
        cmd += ["-i", str(c)]
    if audio:
        cmd += ["-i", str(audio)]

    parts, last = [], "0:v"
    if n == 1:
        parts.append("[0:v]null[vout]")
        last = "vout"
    elif T <= 0.001:
        parts.append("".join(f"[{i}:v]" for i in range(n)) + f"concat=n={n}:v=1:a=0[vout]")
        last = "vout"
    else:
        offset = clip_len[0] - T
        for i in range(1, n):
            out = f"x{i}"
            parts.append(f"[{last}][{i}:v]xfade=transition=fade:duration={T:.4f}:"
                         f"offset={offset:.4f}[{out}]")
            last = out
            if i < n - 1:
                offset += clip_len[i] - T
        parts.append(f"[{last}]null[vout]")
        last = "vout"

    out_path = Path(args.out) if args.out else work / f"{sb['project']}.mp4"
    cmd += ["-filter_complex", ";".join(parts), "-map", f"[{last}]"]
    if audio:
        cmd += ["-map", f"{n}:a", "-c:a", "aac", "-b:a", "192k", "-ar", "48000"]
    cmd += ["-t", f"{total:.6f}", "-r", str(fps),
            "-c:v", "libx264", "-preset", "veryfast" if args.draft else "medium",
            "-crf", "24" if args.draft else "19", "-pix_fmt", "yuv420p",
            "-profile:v", "high", "-movflags", "+faststart", str(out_path)]

    print(f"\nassembling {n} scenes"
          + (f" against {total:.3f}s of narration" if audio else f" ({total:.2f}s, no audio yet)"))
    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.returncode != 0:
        print(r.stderr[-4000:])
        sys.exit("final assembly failed")

    sb["output"] = str(out_path)
    iv.save_storyboard(sb, work / "storyboard.json")
    size = out_path.stat().st_size / 1e6
    print(f"wrote {out_path}  ({size:.1f} MB)")
    if audio:
        print("now run verify.py - it checks the video against the narration frame for frame")


if __name__ == "__main__":
    main()
