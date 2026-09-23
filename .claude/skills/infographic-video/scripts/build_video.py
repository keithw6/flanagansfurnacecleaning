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
import os
import subprocess
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import ivlib as iv

BG = "#0B0C0D"


def zoom_filter(idx, region, motion, nframes, fps, photo_wh, amt=0.08):
    """Ken Burns for one photo, output sized to its region."""
    rw, rh = region[2], region[3]
    pw, ph = photo_wh
    ow, oh = min(pw, rw * 2), min(ph, rh * 2)      # oversample, then land on the region
    ow -= ow % 2
    oh -= oh % 2
    n = max(nframes, 2)
    if motion in (None, "none", ""):
        return f"[{idx}:v]scale={rw}:{rh}:flags=lanczos,setsar=1[p{idx}]"
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


def xfade_chain(count, lengths, T):
    """Filter-graph pieces that cross-fade inputs 0..count-1 in order."""
    parts, last = [], "0:v"
    offset = lengths[0] - T
    for i in range(1, count):
        parts.append(f"[{last}][{i}:v]xfade=transition=fade:duration={T:.4f}:"
                     f"offset={offset:.4f}[x{i}]")
        last = f"x{i}"
        offset += lengths[i] - T
    parts.append(f"[{last}]null[vout]")
    return parts, "vout"


def build_clip(ff, work, sc, clip_len, fps, draft, motion_on, quiet, fade=0.0, is_last=False,
               motion_amount=0.08):
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
        amt = float(sc.get("motion_amount", motion_amount))
        parts.append(zoom_filter(i, region, sc.get("motion") if motion_on else "none", n, fps, wh, amt))
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

    # Where each dissolve sits relative to its cut. "center" straddles the cut;
    # "end" finishes on it, so the incoming image is fully up the moment its
    # narration starts and the dissolve lives inside the outgoing scene's time.
    align = (tr.get("align") or "center").lower()
    after = 0.0 if align == "end" else (T if align == "start" else T / 2)   # part of the fade after the cut
    before = T - after

    n = len(scenes)
    clip_len = []
    for i, d in enumerate(dur):
        head = before if i > 0 else 0.0              # starts early to be the incoming side
        tail = after if i < n - 1 else 0.0           # runs on to be the outgoing side
        clip_len.append(d + (head + tail if n > 1 else 0.0))

    theme = iv.load_theme(sb)
    clips = [build_clip(ff, work, sc, clip_len[i], fps, args.draft, motion_on, args.quiet,
                        fade=T, is_last=(i == n - 1),
                        motion_amount=float(theme.get("motion_amount", 0.08)))
             for i, sc in enumerate(scenes)]

    audio = (sb.get("audio") or {}).get("path")
    total = float((sb.get("audio") or {}).get("duration") or sum(dur))

    # Join in batches. One filter graph over every clip makes ffmpeg hold frames
    # from all of them at once - 7 GB for fifty scenes - so batches of ten are
    # cross-faded into intermediates first, then the batches are joined. The
    # fade maths is identical at both levels: a batch is just a longer clip.
    inputs, lens = list(clips), list(clip_len)
    batch = int(os.environ.get("IV_BATCH", "10"))
    if T > 0.001 and len(inputs) > batch:
        grouped, glens = [], []
        for g, lo in enumerate(range(0, len(inputs), batch)):
            chunk, clen = inputs[lo:lo + batch], lens[lo:lo + batch]
            gout = work / "clips" / f"batch_{g:02d}.mp4"
            gparts, glast = xfade_chain(len(chunk), clen, T)
            gcmd = [ff, "-y", "-hide_banner", "-loglevel", "error"]
            for c in chunk:
                gcmd += ["-i", str(c)]
            gcmd += ["-filter_complex", ";".join(gparts), "-map", f"[{glast}]", "-r", str(fps),
                     "-c:v", "libx264", "-preset", "ultrafast" if args.draft else "veryfast",
                     "-crf", "22" if args.draft else "16", "-pix_fmt", "yuv420p", str(gout)]
            r = subprocess.run(gcmd, capture_output=True, text=True)
            if r.returncode != 0:
                print(r.stderr[-3000:])
                sys.exit(f"batch {g} assembly failed")
            grouped.append(gout)
            glens.append(sum(clen) - (len(clen) - 1) * T)
            if not args.quiet:
                print(f"  batch  {g:02d}  scenes {lo + 1}-{lo + len(chunk)}")
        inputs, lens = grouped, glens

    m = len(inputs)
    cmd = [ff, "-y", "-hide_banner", "-loglevel", "error", "-stats"]
    for c in inputs:
        cmd += ["-i", str(c)]
    if audio:
        cmd += ["-i", str(audio)]

    if m == 1:
        parts, last = ["[0:v]null[vout]"], "vout"
    elif T <= 0.001:
        parts = ["".join(f"[{i}:v]" for i in range(m)) + f"concat=n={m}:v=1:a=0[vout]"]
        last = "vout"
    else:
        parts, last = xfade_chain(m, lens, T)

    ef = sb.get("end_fade") or {}
    if ef.get("duration"):
        d = min(float(ef["duration"]), dur[-1] * 0.8)
        parts.append(f"[{last}]fade=t=out:st={max(0.0, total - d):.4f}:d={d:.4f}:"
                     f"color={ef.get('color', 'white')}[vend]")
        last = "vend"

    out_path = Path(args.out) if args.out else work / f"{sb['project']}.mp4"
    cmd += ["-filter_complex", ";".join(parts), "-map", f"[{last}]"]
    if audio:
        cmd += ["-map", f"{m}:a", "-c:a", "aac", "-b:a", "192k", "-ar", "48000"]
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
