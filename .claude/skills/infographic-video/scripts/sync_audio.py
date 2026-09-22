#!/usr/bin/env python3
"""Re-time the storyboard so it fits the recorded narration exactly.

Three things happen here, in order:

1. Every scene gets a *target* boundary. When a scene carries narration text we
   trust the speech weight of that text, because that is what the voice track
   actually does; timestamps from the zip are used where text is missing, and
   are always reported as drift so a mismatch between script and images shows up
   instead of hiding.
2. Each boundary is pulled to the nearest pause in the WAV (silencedetect), so
   images change between sentences rather than across a word.
3. Boundaries are clamped (monotonic, minimum scene length), snapped to the
   frame grid, and the last scene is set to end at the exact audio duration.

Because boundaries are absolute and the final one is the audio length, the scene
durations always sum to the narration length - no drift accumulates.

Usage:
  python3 sync_audio.py --work work/ --audio narration.wav
      [--prefer speech|timestamps] [--window 1.2] [--min 1.6] [--noise -32]
"""
from __future__ import annotations

import argparse
import shutil
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import ivlib as iv


def targets_from_speech(scenes, total):
    w = [iv.speech_weight(s.get("narration", "")) for s in scenes]
    if sum(w) <= 0:
        return None
    acc, out, s = 0.0, [0.0], sum(w)
    for x in w[:-1]:
        acc += x
        out.append(total * acc / s)
    return out


def targets_from_timestamps(scenes, total, est_total):
    ref = est_total or (max((s.get("requested_time") or 0) for s in scenes) + 4.0)
    if ref <= 0:
        return None
    k = total / ref
    return [max(0.0, (s.get("requested_time") or 0.0) * k) for s in scenes]


def pause_points(gaps):
    """One candidate cut point per pause - the middle of a short breath, just
    inside a long one so the new image is up before the next line starts."""
    pts = []
    for a, b in gaps:
        pts.append(a + 0.35 if b - a > 0.9 else (a + b) / 2.0)
    return sorted(pts)


def place_cuts(targets, pts, window, min_dur, miss_penalty=0.7):
    """Assign boundaries to pauses as one decision, not one at a time.

    Snapping each cut to its own nearest pause is greedy: an early boundary can
    take the pause a later one needed, and the later one then lands mid-sentence.
    This picks the whole set together (shortest path over candidates, kept in
    order), so total displacement is as small as it can be while every cut still
    moves forward through the track.
    """
    n = len(targets)
    if n == 0:
        return [], []
    # candidates per boundary: nearby pauses, plus staying put at a penalty
    cands = []
    for t in targets:
        opts = [(c, abs(c - t), True) for c in pts if abs(c - t) <= window]
        opts.append((t, miss_penalty, False))
        opts.sort(key=lambda o: o[0])
        cands.append(opts)

    INF = float("inf")
    best = [[o[1] for o in cands[0]]]
    back = [[-1] * len(cands[0])]
    for i in range(1, n):
        row, brow = [], []
        for j, (cv, cost, _) in enumerate(cands[i]):
            bj, bcost = -1, INF
            for k, (pv, _, _) in enumerate(cands[i - 1]):
                if cv - pv < min_dur:
                    continue
                if best[i - 1][k] < bcost:
                    bj, bcost = k, best[i - 1][k]
            row.append(cost + bcost)
            brow.append(bj)
        if all(x == INF for x in row):            # nothing legal: fall back to targets
            return list(targets), [False] * n
        best.append(row)
        back.append(brow)

    j = min(range(len(best[-1])), key=lambda k: best[-1][k])
    chosen = []
    for i in range(n - 1, -1, -1):
        chosen.append(cands[i][j])
        j = back[i][j]
        if j < 0 and i > 0:
            return list(targets), [False] * n
    chosen.reverse()
    return [c[0] for c in chosen], [c[2] for c in chosen]


def clamp(bounds, total, min_dur):
    n = len(bounds)
    bounds = list(bounds)
    bounds[0] = 0.0
    for i in range(1, n):                              # forward: keep gaps legal
        bounds[i] = max(bounds[i], bounds[i - 1] + min_dur)
    end = total
    for i in range(n - 1, 0, -1):                      # backward: leave room at the tail
        bounds[i] = min(bounds[i], end - min_dur)
        end = bounds[i]
    for i in range(1, n):                              # forward again after the squeeze
        bounds[i] = max(bounds[i], bounds[i - 1] + 0.30)
    return bounds


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--work", required=True)
    ap.add_argument("--audio", required=True)
    ap.add_argument("--prefer", choices=["speech", "timestamps"], default="speech")
    ap.add_argument("--window", type=float, default=1.6, help="how far a cut may move to find a pause")
    ap.add_argument("--min", dest="min_dur", type=float, default=1.6)
    ap.add_argument("--noise", type=float, default=-32.0, help="silence threshold in dB")
    ap.add_argument("--silence-len", type=float, default=0.22)
    args = ap.parse_args()

    work = Path(args.work).resolve()
    sb = iv.load_storyboard(work / "storyboard.json")
    scenes = sb["scenes"]
    fps = sb["canvas"]["fps"]

    audio_src = Path(args.audio).resolve()
    if not audio_src.exists():
        sys.exit(f"no such audio file: {audio_src}")
    local = work / f"narration{audio_src.suffix.lower()}"
    if audio_src != local:
        shutil.copy2(audio_src, local)
    total = iv.audio_duration(local)

    gaps = iv.detect_silences(local, args.noise, args.silence_len)
    speech_end = max((a for a, b in gaps if b >= total - 0.05), default=None)
    print(f"narration: {iv.fmt_tc(total)} ({total:.3f}s)   pauses found: {len(gaps)}"
          + (f"   speech stops at {iv.fmt_tc(speech_end)}" if speech_end else ""))

    min_dur = args.min_dur
    if min_dur * len(scenes) > total:
        min_dur = max(0.6, total / len(scenes) * 0.7)
        print(f"  ! {len(scenes)} scenes in {total:.1f}s - lowering minimum scene length to {min_dur:.2f}s")

    est = (sb.get("timing") or {}).get("estimated_total")
    if not est:                                   # re-syncing a storyboard that was already locked
        est = iv.word_count(sb.get("script", "")) / iv.WORDS_PER_SECOND or total
        est = max(est, max((s.get("requested_time") or 0) for s in scenes) + 3.0)
    t_speech = targets_from_speech(scenes, total)
    t_stamps = targets_from_timestamps(scenes, total, est)
    if args.prefer == "timestamps":
        base = t_stamps or t_speech
    else:
        base = t_speech or t_stamps
    if base is None:
        base = [total * i / len(scenes) for i in range(len(scenes))]
    if t_speech and t_stamps:                      # fill gaps where a scene has no text
        for i, s in enumerate(scenes):
            if args.prefer == "speech" and not (s.get("narration") or "").strip():
                base[i] = t_stamps[i]

    pts = pause_points(gaps)
    placed, on_pause = place_cuts(base[1:], pts, args.window, min_dur)
    bounds = clamp([0.0] + placed, total, min_dur)
    bounds = [iv.snap_to_frame(b, fps) for b in bounds]
    on_pause = [True] + on_pause

    stamp_scale = (total / est) if est else 1.0
    rows = []
    for i, s in enumerate(scenes):
        start = bounds[i]
        end = bounds[i + 1] if i + 1 < len(bounds) else total
        s["start"] = round(start, 3)
        s["end"] = round(end, 3)
        s["duration"] = round(end - start, 3)
        # Compare against the timestamp *scaled to this recording*: if the WAV
        # simply runs shorter or longer than the script estimate, every image
        # shifts together and that is not drift worth flagging. What matters is
        # whether a scene moved relative to the story around it.
        want = (s.get("requested_time") or 0.0) * stamp_scale
        drift = start - want
        rows.append({
            "id": s["id"], "requested": round(s.get("requested_time") or 0.0, 2),
            "scaled_target": round(want, 2),
            "start": round(start, 2), "end": round(end, 2), "duration": round(end - start, 2),
            "drift": round(drift, 2),
            "on_pause": on_pause[i],
            "words": iv.word_count(s.get("narration", "")),
        })

    sb["audio"] = {"path": str(local), "duration": round(total, 6),
                   "frames": iv.frames(total, fps)}
    sb["timing"] = {"locked_to_audio": True, "total": round(total, 6),
                    "estimated_total": round(est, 2), "timestamp_scale": round(stamp_scale, 4),
                    "min_scene": min_dur, "snap_window": args.window,
                    "prefer": args.prefer, "report": rows}
    iv.save_storyboard(sb, work / "storyboard.json")

    md = ["# Timing locked to narration", "",
          f"Audio: `{local.name}`  -  {iv.fmt_tc(total)} ({total:.3f}s, {iv.frames(total, fps)} frames @ {fps}fps)", "",
          f"The script estimate was {iv.fmt_tc(est or total)}, so zip timestamps are compared after scaling "
          f"them by x{stamp_scale:.3f}. 'moved' below is movement relative to the story, not the length change.", "",
          "| scene | zip said | scaled to this take | plays | length | moved | on a pause | words |",
          "|---|---|---|---|---|---|---|---|"]
    for r in rows:
        md.append(f"| {r['id']} | {iv.fmt_tc(r['requested'])} | {iv.fmt_tc(r['scaled_target'])} "
                  f"| {iv.fmt_tc(r['start'])}-{iv.fmt_tc(r['end'])} "
                  f"| {r['duration']:.2f}s | {r['drift']:+.2f}s | {'yes' if r['on_pause'] else 'no'} | {r['words']} |")
    big = [r for r in rows if abs(r["drift"]) > 2.5]
    if big:
        md += ["", "**Check these** - they moved more than 2.5s from the timestamp in the zip, "
                   "which usually means the narration and the image order disagree:", ""]
        md += [f"- {r['id']} moved {r['drift']:+.2f}s" for r in big]
    (work / "timing.md").write_text("\n".join(md) + "\n")

    print(f"\nscene lengths now sum to {sum(s['duration'] for s in scenes):.3f}s "
          f"against {total:.3f}s of audio")
    for r in rows:
        flag = "  <-- check" if abs(r["drift"]) > 2.5 else ""
        print(f"  {r['id']}  {iv.fmt_tc(r['start'])}-{iv.fmt_tc(r['end'])}  {r['duration']:5.2f}s  "
              f"drift {r['drift']:+5.2f}s  {'pause' if r['on_pause'] else 'mid-line'}{flag}")
    print(f"\nwrote {work/'timing.md'}")


if __name__ == "__main__":
    main()
