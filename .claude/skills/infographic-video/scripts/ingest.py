#!/usr/bin/env python3
"""Turn a delivery zip (images + narration text) into storyboard.json.

The zip can carry timestamps three ways and this reads all of them, because
people rarely stick to one. Precedence, strongest first:

  1. an explicit shot list in the zip   (shots.csv / shots.txt / manifest.json)
  2. markers inside the narration text  ([0:12], {{file.jpg}}, [0:12 file.jpg])
  3. the image filename                 (00-12_trunk-line.jpg  -> 0m12s)
  4. plain file order                   (01, 02, 03 -> spread across the script)

Usage:
  python3 ingest.py --zip delivery.zip --out work/ [--project name] [--fps 30]
  python3 ingest.py --dir already-unpacked/ --out work/
"""
from __future__ import annotations

import argparse
import csv
import json
import re
import shutil
import sys
import zipfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import ivlib as iv

IMAGE_EXT = {".jpg", ".jpeg", ".png", ".webp", ".gif", ".bmp", ".tif", ".tiff", ".heic", ".heif"}
TEXT_EXT = {".txt", ".md", ".rtf"}
LIST_NAMES = {"shots", "shotlist", "shot-list", "manifest", "scenes", "timeline", "storyboard"}

# marker forms accepted inside the narration text
RE_MARK_BOTH = re.compile(r"\[\s*(\d{1,2}[:\-_]\d{1,2}(?:[.,]\d+)?|\d+s)\s+([^\]\n]+?)\s*\]")
RE_MARK_TIME = re.compile(r"\[\s*(\d{1,2}[:\-_]\d{1,2}(?:[.,]\d+)?|\d+s)\s*\]")
RE_MARK_FILE = re.compile(r"(?:\{\{\s*([^}\n]+?)\s*\}\}|\[\[\s*([^\]\n]+?)\s*\]\])")
# 00-12_name.jpg / 0_12 name.png / 1.23-name.jpg  ->  minutes,seconds
RE_FN_MMSS = re.compile(r"^(?:t|@)?(\d{1,2})[\-_.:](\d{1,2})(?:[.,](\d{1,3}))?(?=[\-_. ]|$)")
RE_FN_SECS = re.compile(r"^(?:t|@)?(\d{1,4})s(?=[\-_. ]|$)", re.I)
RE_FN_AT = re.compile(r"@\s*(\d{1,2}[:\-_]\d{1,2}(?:[.,]\d+)?)")
RE_FN_INDEX = re.compile(r"^(\d{1,3})(?=[\-_. ]|$)")

DEFAULT_CYCLE = ["full", "split-left", "full", "split-right"]


def natural_key(s: str):
    return [int(t) if t.isdigit() else t.lower() for t in re.split(r"(\d+)", s)]


def safe_extract(zip_path: Path, dest: Path) -> None:
    dest.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(zip_path) as z:
        for info in z.infolist():
            name = info.filename
            if info.is_dir() or name.startswith("__MACOSX/") or Path(name).name.startswith("._"):
                continue
            target = (dest / name).resolve()
            if not str(target).startswith(str(dest.resolve())):
                print(f"  ! skipped suspicious path in zip: {name}")
                continue
            target.parent.mkdir(parents=True, exist_ok=True)
            with z.open(info) as src, open(target, "wb") as out:
                shutil.copyfileobj(src, out)


def collect(root: Path):
    """Sort files into images / script candidates / shot lists.

    Identical images are dropped: a delivery split across several zips often
    carries the same folder twice, and a repeated slide would otherwise become
    a repeated scene.
    """
    import hashlib

    images, texts, lists, seen = [], [], [], {}
    for p in sorted(root.rglob("*"), key=lambda q: (natural_key(q.name), natural_key(str(q)))):
        if not p.is_file() or p.name.startswith("."):
            continue
        ext = p.suffix.lower()
        stem = p.stem.lower().replace("_", "-")
        if ext in IMAGE_EXT:
            digest = hashlib.sha1(p.read_bytes()).hexdigest()
            if digest in seen:
                continue
            seen[digest] = p
            images.append(p)
        elif ext in {".csv", ".json"} or (ext in TEXT_EXT and stem in LIST_NAMES):
            lists.append(p)
        elif ext in TEXT_EXT:
            texts.append(p)
    return images, texts, lists


def read_text_file(p: Path) -> str:
    raw = p.read_text(encoding="utf-8", errors="replace")
    if p.suffix.lower() == ".rtf":  # crude but keeps a pasted RTF usable
        raw = re.sub(r"\\[a-z]+-?\d* ?", " ", raw).replace("{", "").replace("}", "")
    return raw


def pick_script(texts: list[Path]) -> Path | None:
    if not texts:
        return None
    preferred = [p for p in texts if re.search(r"script|narration|voice|story|copy|vo\b", p.stem, re.I)]
    pool = preferred or texts
    return max(pool, key=lambda p: p.stat().st_size)


# --------------------------------------------------------------------------
# the three timestamp sources
# --------------------------------------------------------------------------
def from_shot_list(paths: list[Path]) -> list[dict]:
    """Rows of {file, time, layout, headline, subline, ...} from csv/json/txt."""
    rows: list[dict] = []
    for p in paths:
        try:
            if p.suffix.lower() == ".json":
                data = json.loads(p.read_text())
                items = data.get("scenes") or data.get("shots") or (data if isinstance(data, list) else [])
                for it in items:
                    if isinstance(it, dict):
                        rows.append({k.strip().lower(): v for k, v in it.items()})
            elif p.suffix.lower() == ".csv":
                with open(p, newline="", encoding="utf-8-sig", errors="replace") as fh:
                    sample = fh.read(4096); fh.seek(0)
                    try:
                        dialect = csv.Sniffer().sniff(sample, delimiters=",;\t|")
                    except csv.Error:
                        dialect = csv.excel
                    for r in csv.DictReader(fh, dialect=dialect):
                        rows.append({(k or "").strip().lower(): (v or "").strip()
                                     for k, v in r.items() if k})
            else:  # loose "00:12  file.jpg  Headline" lines
                for line in read_text_file(p).splitlines():
                    line = line.strip()
                    if not line or line.startswith("#"):
                        continue
                    parts = re.split(r"[\t,]|\s{2,}", line)
                    parts = [x.strip() for x in parts if x.strip()]
                    if len(parts) < 2:
                        continue
                    t = iv.parse_timecode(parts[0])
                    if t is None:
                        continue
                    rows.append({"time": parts[0], "file": parts[1],
                                 "headline": parts[2] if len(parts) > 2 else ""})
        except Exception as e:
            print(f"  ! could not read shot list {p.name}: {e}")
    return rows


def markers_in_script(text: str):
    """Return (clean_text, [{pos, time, file}]) for markers found in order."""
    found = []
    for m in RE_MARK_BOTH.finditer(text):
        found.append({"span": m.span(), "time": iv.parse_timecode(m.group(1)), "file": m.group(2).strip()})
    for m in RE_MARK_TIME.finditer(text):
        if any(f["span"][0] <= m.start() < f["span"][1] for f in found):
            continue
        found.append({"span": m.span(), "time": iv.parse_timecode(m.group(1)), "file": None})
    for m in RE_MARK_FILE.finditer(text):
        found.append({"span": m.span(), "time": None, "file": (m.group(1) or m.group(2)).strip()})
    found.sort(key=lambda f: f["span"][0])
    for f in found:                                  # written before the line, or after it?
        head = text[:f["span"][0]]
        f["style"] = "lead" if (not head.strip() or head.rsplit("\n", 1)[-1].strip() == "") else "trail"
    # strip markers out, tracking where each one sat in the cleaned text
    clean, cursor, shift = [], 0, 0
    for f in found:
        s, e = f["span"]
        clean.append(text[cursor:s])
        f["pos"] = s - shift
        shift += (e - s)
        cursor = e
    clean.append(text[cursor:])
    return "".join(clean), found


def time_from_filename(name: str):
    stem = Path(name).stem
    m = RE_FN_AT.search(stem)
    if m:
        return iv.parse_timecode(m.group(1)), "filename@"
    m = RE_FN_SECS.match(stem)
    if m:
        return float(m.group(1)), "filename-seconds"
    m = RE_FN_MMSS.match(stem)
    if m:
        ms = float(f"0.{m.group(3)}") if m.group(3) else 0.0
        return int(m.group(1)) * 60 + int(m.group(2)) + ms, "filename-mmss"
    return None, None


MOTIONS = {"in", "out", "left", "right", "up", "down", "none"}


def motion_from_note(note: str) -> str | None:
    """Turn an animation note ("push slowly toward the car", "move across the
    two drivers") into the nearest camera move a still can actually do."""
    t = (note or "").strip().lower()
    if not t:
        return None
    if t in MOTIONS:
        return t
    if any(w in t for w in ("widen", "pull back", "zoom out", "reveal the whole")):
        return "out"
    if any(w in t for w in ("right to left", "toward the left", "from the right")):
        return "left"
    if any(w in t for w in ("left to right", "across", "horizontal", "from left", "track", "follow")):
        return "right"
    if any(w in t for w in ("upward", "rise", "toward the top", "tilt up")):
        return "up"
    if any(w in t for w in ("downward", "tilt down", "toward the bottom")):
        return "down"
    if any(w in t for w in ("hold", "still", "static", "no movement")) and "push" not in t:
        return "in"
    return "in"


def match_file(ref: str, images: list[Path]) -> Path | None:
    if not ref:
        return None
    ref = ref.strip().strip("\"'")
    cands = {p.name.lower(): p for p in images}
    if ref.lower() in cands:
        return cands[ref.lower()]
    stems = {p.stem.lower(): p for p in images}
    if Path(ref).stem.lower() in stems:
        return stems[Path(ref).stem.lower()]
    hits = [p for p in images if Path(ref).stem.lower() in p.stem.lower()]
    return hits[0] if len(hits) == 1 else None


# --------------------------------------------------------------------------
# assembly
# --------------------------------------------------------------------------
def merge_markers(marks, text):
    """Fold "[0:19] ... {{photo.jpg}}" into one scene.

    People mix the two marker styles inside a paragraph - a time where the scene
    starts and, further along, the file they mean. Read literally that is two
    scenes, one of them imageless. Treated as one marker it is what they meant.
    """
    out, i = [], 0
    while i < len(marks):
        m = dict(marks[i])
        nxt = marks[i + 1] if i + 1 < len(marks) else None
        if (m["time"] is not None and not m["file"] and nxt and nxt["time"] is None
                and nxt["file"] and "\n\n" not in text[m["pos"]:nxt["pos"]]):
            m["file"] = nxt["file"]
            i += 1
        out.append(m)
        i += 1
    return out


def cut_positions(marks, text):
    """Where each marker's scene starts in the script.

    A marker at the head of a line opens the text that follows it. A marker
    written after a sentence is a note about the text before it, so its scene
    reaches back to the start of that paragraph instead.
    """
    cuts, prev = [], 0
    for m in marks:
        if m.get("style") == "lead":
            pos = m["pos"]
        else:
            para = text.rfind("\n\n", 0, m["pos"])
            pos = 0 if para < 0 else para + 2
        cuts.append(max(prev, pos))
        prev = cuts[-1]
    return cuts


def chunk_narration(text, cuts):
    """Split the script at cut positions, sharing a block between markers that
    resolved to the same spot (two images over one paragraph)."""
    n = len(cuts)
    chunks = [""] * n
    i = 0
    while i < n:
        j = i
        while j + 1 < n and cuts[j + 1] == cuts[i]:
            j += 1
        end = cuts[j + 1] if j + 1 < n else len(text)
        block = text[cuts[i]:end].strip()
        span = j - i + 1
        if span == 1:
            chunks[i] = block
        else:                                        # share the paragraph out by speech weight
            sents = iv.split_sentences(block) or [block]
            per = max(1, len(sents) // span)
            for k in range(span):
                lo = k * per
                hi = len(sents) if k == span - 1 else min(len(sents), (k + 1) * per)
                chunks[i + k] = " ".join(sents[lo:hi]).strip()
        i = j + 1
    return chunks


def chunk_by_time(text: str, times: list[float], total: float) -> list[str]:
    """Split the script at sentence breaks nearest each requested timestamp."""
    sents = iv.split_sentences(text)
    if not sents:
        return ["" for _ in times]
    weights = [iv.speech_weight(s) for s in sents]
    wsum = sum(weights) or 1.0
    cum, acc = [], 0.0
    for w in weights:
        acc += w
        cum.append(acc / wsum)                        # fraction of script finished
    chunks, start_idx = [], 0
    for t in times[1:]:                               # scene 1 starts at 0 by definition
        frac = min(1.0, max(0.0, t / total)) if total > 0 else 0.0
        idx = min(range(len(cum)), key=lambda i: abs(cum[i] - frac)) + 1
        idx = max(start_idx, min(idx, len(sents)))
        chunks.append(" ".join(sents[start_idx:idx]).strip())
        start_idx = idx
    chunks.append(" ".join(sents[start_idx:]).strip())
    return chunks


def build(args) -> dict:
    out = Path(args.out).resolve()
    src = out / "source"
    if args.zip:
        if src.exists():
            shutil.rmtree(src)
        for z in args.zip:                         # a big delivery often arrives in parts
            safe_extract(Path(z), src / Path(z).stem if len(args.zip) > 1 else src)
        for extra in args.add or []:               # loose files sent alongside the zips
            shutil.copy2(extra, src / Path(extra).name)
    elif args.dir:
        src = Path(args.dir).resolve()
    else:
        sys.exit("pass --zip or --dir")

    images, texts, lists = collect(src)
    if not images:
        sys.exit(f"no images found under {src}")
    script_path = pick_script(texts)
    script = read_text_file(script_path) if script_path else ""
    # Normalise whitespace *before* reading markers: stripping it afterwards
    # shifts every recorded position and the narration splits land mid-word.
    script = re.sub(r"[ \t]+\n", "\n", script).strip()
    script, marks = markers_in_script(script)
    rows = from_shot_list(lists)

    print(f"images: {len(images)}   script: {script_path.name if script_path else '(none)'} "
          f"({iv.word_count(script)} words)   shot-list rows: {len(rows)}   markers: {len(marks)}")

    scenes: list[dict] = []
    used: set[Path] = set()
    source_note = "order"

    # --- 1. explicit shot list wins -------------------------------------
    if rows:
        source_note = "shot-list"
        for r in rows:
            fname = next((r[k] for k in ("file", "filename", "image", "img", "photo") if r.get(k)), "")
            p = match_file(str(fname), images)
            if p is None:
                print(f"  ! shot list references '{fname}' - no matching image, skipped")
                continue
            t = next((iv.parse_timecode(r[k]) for k in ("time", "timestamp", "start", "at", "tc")
                      if r.get(k) not in (None, "")), None)
            callout = {k: r[k] for k in ("eyebrow", "headline", "subline", "label") if r.get(k)}
            if r.get("stat"):
                callout["stat"] = {"value": str(r.get("stat")), "label": r.get("statlabel", r.get("label", ""))}
            end = next((iv.parse_timecode(r[k]) for k in ("end", "stop", "out") if r.get(k)), None)
            note = next((r[k] for k in ("animation", "motion", "movement", "camera") if r.get(k)), "")
            scenes.append({"image_paths": [p], "requested_time": t, "requested_end": end,
                           "layout": (r.get("layout") or "").strip() or None,
                           "motion": motion_from_note(note), "note": note,
                           "title": (r.get("title") or "").strip(),
                           "callout": callout, "narration": (r.get("narration") or r.get("script") or "").strip()})
            used.add(p)

    # --- 2. markers in the script ---------------------------------------
    elif marks:
        source_note = "script-markers"
        marks = merge_markers(marks, script)
        if len(marks) > len(images):
            print(f"  ! {len(marks)} markers but only {len(images)} images - "
                  f"the last {len(marks) - len(images)} will have no picture")
        cuts = cut_positions(marks, script)
        keep = []
        for mk, cut in zip(marks, cuts):
            p = match_file(mk["file"], images) if mk["file"] else None
            if p is None:
                if mk["file"]:
                    print(f"  ! marker names '{mk['file']}' - no matching image, taking the next one")
                p = next((q for q in images if q not in used), None)
            if p is None:
                print("  ! out of images - marker ignored")
                continue
            used.add(p)
            scenes.append({"image_paths": [p], "requested_time": mk["time"],
                           "layout": None, "callout": {}, "narration": ""})
            keep.append(cut)
        for sc, ch in zip(scenes, chunk_narration(script, keep)):
            sc["narration"] = ch

    # --- 3/4. filenames, else plain order --------------------------------
    if not scenes:
        stamped = []
        for p in images:
            t, how = time_from_filename(p.name)
            stamped.append((p, t, how))
        if any(t is not None for _, t, _ in stamped):
            source_note = "filenames"
            stamped.sort(key=lambda x: (x[1] is None, x[1] if x[1] is not None else 0, natural_key(x[0].name)))
        else:
            stamped.sort(key=lambda x: natural_key(x[0].name))
        for p, t, _ in stamped:
            scenes.append({"image_paths": [p], "requested_time": t, "layout": None,
                           "callout": {}, "narration": ""})
            used.add(p)

    for p in images:
        if p not in used:
            print(f"  ! unplaced image (appended at the end): {p.name}")
            scenes.append({"image_paths": [p], "requested_time": None, "layout": None,
                           "callout": {}, "narration": ""})

    # --- timing estimate before the WAV exists ---------------------------
    est_total = max(iv.word_count(script) / iv.WORDS_PER_SECOND, 4.0 * len(scenes))
    known = [s["requested_time"] for s in scenes if s["requested_time"] is not None]
    if known:
        est_total = max(est_total, max(known) + 4.0)
    if scenes[-1].get("requested_end"):             # the shot list says how long it runs
        est_total = float(scenes[-1]["requested_end"])

    # fill any gaps in requested times so every scene has a planned start
    n = len(scenes)
    if scenes[0]["requested_time"] is None:   # pin the opening before interpolating,
        scenes[0]["requested_time"] = 0.0     # otherwise scene one comes out double length
    for i, s in enumerate(scenes):
        if s["requested_time"] is None:
            prev_i, prev_t = -1, 0.0
            for j in range(i - 1, -1, -1):
                if scenes[j]["requested_time"] is not None:
                    prev_i, prev_t = j, scenes[j]["requested_time"]
                    break
            nxt_i, nxt_t = n, est_total
            for j in range(i + 1, n):
                if scenes[j]["requested_time"] is not None:
                    nxt_i, nxt_t = j, scenes[j]["requested_time"]
                    break
            span = max(1, nxt_i - prev_i)
            s["requested_time"] = prev_t + (nxt_t - prev_t) * (i - prev_i) / span
    scenes[0]["requested_time"] = 0.0

    if not any(s["narration"] for s in scenes) and script:
        for s, ch in zip(scenes, chunk_by_time(script, [s["requested_time"] for s in scenes], est_total)):
            s["narration"] = ch

    fps = args.fps
    sb = {
        "project": args.project or Path((args.zip or [args.dir])[0]).stem,
        "canvas": {"w": iv.CANVAS["w"], "h": iv.CANVAS["h"], "fps": fps},
        "source_dir": str(src),
        "script_file": str(script_path) if script_path else None,
        "script": script,
        "timestamp_source": source_note,
        "transition": {"type": "fade", "duration": 0.4},
        "audio": None,
        "timing": {"locked_to_audio": False, "estimated_total": round(est_total, 2)},
        "scenes": [],
    }
    for i, s in enumerate(scenes):
        start = round(s["requested_time"], 3)
        end = round(scenes[i + 1]["requested_time"], 3) if i + 1 < len(scenes) else round(est_total, 3)
        sb["scenes"].append({
            "id": f"s{i + 1:02d}",
            "layout": args.layout or s["layout"] or ("title" if i == 0 else DEFAULT_CYCLE[i % len(DEFAULT_CYCLE)]),
            "images": [str(Path(p).relative_to(src)) for p in s["image_paths"]],
            "focus": "center",
            "motion": s.get("motion") or ["in", "left", "out", "right"][i % 4],
            "title": s.get("title", ""),
            "requested_time": start,
            "start": start,
            "end": max(end, start + 1.5),
            "duration": round(max(end - start, 1.5), 3),
            "narration": s["narration"],
            "callout": s["callout"] or {},
            "notes": s.get("note", ""),
        })
    return sb


def summary(sb: dict) -> str:
    lines = [f"# Storyboard - {sb['project']}", "",
             f"Timestamps read from: **{sb['timestamp_source']}**  |  "
             f"scenes: {len(sb['scenes'])}  |  estimated run: {iv.fmt_tc(sb['timing']['estimated_total'])}", ""]
    for s in sb["scenes"]:
        lines += [f"## {s['id']}  {iv.fmt_tc(s['start'])} - {iv.fmt_tc(s['end'])}  ({s['duration']:.1f}s)",
                  f"- layout: `{s['layout']}`   images: {', '.join(s['images'])}",
                  f"- callout: {json.dumps(s['callout']) if s['callout'] else '(empty - write one)'}",
                  f"- narration: {s['narration'][:300] or '(none)'}", ""]
    return "\n".join(lines)


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--zip", action="append", help="repeat for a delivery split across several zips")
    ap.add_argument("--add", action="append", help="a loose file (script, shots.csv) sent outside the zip")
    ap.add_argument("--dir")
    ap.add_argument("--layout", help="force one layout on every scene, e.g. 'plain' for finished slides")
    ap.add_argument("--out", required=True)
    ap.add_argument("--project")
    ap.add_argument("--fps", type=int, default=iv.CANVAS["fps"])
    args = ap.parse_args()

    out = Path(args.out).resolve()
    out.mkdir(parents=True, exist_ok=True)
    sb = build(args)
    iv.save_storyboard(sb, out / "storyboard.json")
    (out / "storyboard.md").write_text(summary(sb))
    print(f"\nwrote {out/'storyboard.json'} ({len(sb['scenes'])} scenes)")
    print(f"wrote {out/'storyboard.md'}  <- read this, then write the callouts")


if __name__ == "__main__":
    main()
