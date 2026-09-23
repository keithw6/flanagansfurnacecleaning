"""Shared helpers for the infographic-video skill.

Everything here is deliberately dependency-light: ffmpeg is located at runtime
(system install, or the static binary that pip's imageio-ffmpeg ships), and WAV
duration is read from the file header so timing never depends on ffprobe being
present.
"""
from __future__ import annotations

import glob
import json
import math
import os
import re
import shutil
import subprocess
import sys
import wave
from pathlib import Path

CANVAS = {"w": 1920, "h": 1080, "fps": 30}

# Words-per-second used only to *estimate* narration length before the real WAV
# exists. Conversational voice-over sits around 2.4-2.8 wps.
WORDS_PER_SECOND = 2.6


def skill_dir() -> Path:
    return Path(__file__).resolve().parent.parent


# --------------------------------------------------------------------------
# tool discovery
# --------------------------------------------------------------------------
def find_ffmpeg() -> str:
    p = os.environ.get("FFMPEG") or shutil.which("ffmpeg")
    if p:
        return p
    try:
        import imageio_ffmpeg

        return imageio_ffmpeg.get_ffmpeg_exe()
    except Exception:
        pass
    sys.exit("ffmpeg not found. Run: python3 scripts/setup_env.py")


def find_ffprobe() -> str | None:
    return os.environ.get("FFPROBE") or shutil.which("ffprobe")


def find_chromium() -> str | None:
    env = os.environ.get("CHROMIUM_PATH")
    if env and Path(env).exists():
        return env
    pats = [
        "/opt/pw-browsers/chromium-*/chrome-linux/chrome",
        "/opt/pw-browsers/chromium_headless_shell-*/chrome-linux/headless_shell",
        str(Path.home()) + "/.cache/ms-playwright/chromium-*/chrome-linux/chrome",
    ]
    for pat in pats:
        hits = sorted(glob.glob(pat))
        if hits:
            return hits[-1]
    for name in ("chromium", "chromium-browser", "google-chrome"):
        p = shutil.which(name)
        if p:
            return p
    return None


def run(cmd: list[str], **kw) -> subprocess.CompletedProcess:
    return subprocess.run(cmd, capture_output=True, text=True, **kw)


# --------------------------------------------------------------------------
# media probing
# --------------------------------------------------------------------------
def wav_duration(path: str | Path) -> float:
    """Exact duration from the WAV header - frames / sample-rate."""
    with wave.open(str(path), "rb") as w:
        return w.getnframes() / float(w.getframerate())


def audio_duration(path: str | Path) -> float:
    path = str(path)
    if path.lower().endswith(".wav"):
        try:
            return wav_duration(path)
        except Exception:
            pass
    return media_duration(path)


def media_duration(path: str | Path) -> float:
    """Decode-accurate duration. Uses ffprobe when present, else ffmpeg."""
    probe = find_ffprobe()
    if probe:
        r = run([probe, "-v", "error", "-show_entries", "format=duration",
                 "-of", "default=nw=1:nk=1", str(path)])
        try:
            return float(r.stdout.strip())
        except ValueError:
            pass
    r = run([find_ffmpeg(), "-hide_banner", "-i", str(path), "-f", "null", "-"])
    times = re.findall(r"time=(\d+):(\d\d):(\d\d\.\d+)", r.stderr)
    if times:
        h, m, s = times[-1]
        return int(h) * 3600 + int(m) * 60 + float(s)
    m = re.search(r"Duration: (\d+):(\d\d):(\d\d\.\d+)", r.stderr)
    if m:
        return int(m.group(1)) * 3600 + int(m.group(2)) * 60 + float(m.group(3))
    raise RuntimeError(f"could not determine duration of {path}")


def video_frame_count(path: str | Path) -> int:
    r = run([find_ffmpeg(), "-hide_banner", "-i", str(path), "-map", "0:v:0",
             "-f", "null", "-"])
    hits = re.findall(r"frame=\s*(\d+)", r.stderr)
    return int(hits[-1]) if hits else 0


def detect_silences(path: str | Path, noise_db: float = -32.0,
                    min_dur: float = 0.22) -> list[tuple[float, float]]:
    """Return [(start, end), ...] of silent stretches in the narration."""
    r = run([find_ffmpeg(), "-hide_banner", "-i", str(path),
             "-af", f"silencedetect=noise={noise_db}dB:d={min_dur}",
             "-f", "null", "-"])
    starts = [float(x) for x in re.findall(r"silence_start: (-?[\d.]+)", r.stderr)]
    ends = [float(x) for x in re.findall(r"silence_end: ([\d.]+)", r.stderr)]
    out = []
    for i, s in enumerate(starts):
        e = ends[i] if i < len(ends) else None
        if e is None:
            continue
        out.append((max(0.0, s), e))
    return out


# --------------------------------------------------------------------------
# text helpers
# --------------------------------------------------------------------------
_VOWEL_RUN = re.compile(r"[aeiouy]+", re.I)


def syllables(word: str) -> int:
    w = re.sub(r"[^a-z]", "", word.lower())
    if not w:
        return 0
    n = len(_VOWEL_RUN.findall(w))
    if w.endswith("e") and n > 1 and not w.endswith(("le", "ee", "ye")):
        n -= 1
    return max(1, n)


def speech_weight(text: str) -> float:
    """Rough 'how long does this take to say' score, in seconds.

    Syllables carry the bulk of it; punctuation adds the pauses a voice artist
    actually takes, which is what makes scene boundaries land on real breaths.
    """
    if not text or not text.strip():
        return 0.0
    syl = sum(syllables(w) for w in re.findall(r"[A-Za-z']+", text))
    secs = syl / 4.2                      # ~4.2 syllables per second
    secs += 0.16 * len(re.findall(r"[,;:]", text))
    secs += 0.34 * len(re.findall(r"[.!?]", text))
    secs += 0.28 * len(re.findall(r"\n\s*\n", text))
    return max(0.35, secs)


def split_sentences(text: str) -> list[str]:
    parts = re.split(r"(?<=[.!?])\s+|\n\s*\n", text.strip())
    return [p.strip() for p in parts if p and p.strip()]


def word_count(text: str) -> int:
    return len(re.findall(r"[A-Za-z0-9']+", text or ""))


# --------------------------------------------------------------------------
# timecodes
# --------------------------------------------------------------------------
def parse_timecode(raw: str) -> float | None:
    """Accept 12, 12s, 0:12, 00-12, 1_23.5, 00:01:23.500, 1m23s."""
    if raw is None:
        return None
    s = str(raw).strip().lower()
    if not s:
        return None
    m = re.fullmatch(r"(?:(\d+)h)?(?:(\d+)m)?(\d+(?:\.\d+)?)s?", s)
    if m and (m.group(1) or m.group(2) or s.endswith("s")):
        h = float(m.group(1) or 0); mi = float(m.group(2) or 0); sec = float(m.group(3))
        return h * 3600 + mi * 60 + sec
    parts = re.split(r"[:\-_]", s)
    if all(re.fullmatch(r"\d+(?:[.,]\d+)?", p) for p in parts) and 1 < len(parts) <= 3:
        vals = [float(p.replace(",", ".")) for p in parts]
        while len(vals) < 3:
            vals.insert(0, 0.0)
        return vals[0] * 3600 + vals[1] * 60 + vals[2]
    if re.fullmatch(r"\d+(?:\.\d+)?", s):
        return float(s)
    return None


def fmt_tc(t: float) -> str:
    t = max(0.0, float(t))
    return f"{int(t // 60):d}:{t % 60:05.2f}"


def frames(seconds: float, fps: int) -> int:
    return int(round(seconds * fps))


def snap_to_frame(seconds: float, fps: int) -> float:
    return round(seconds * fps) / float(fps)


# --------------------------------------------------------------------------
# layouts
# --------------------------------------------------------------------------
# Each layout declares where photos sit on the 1920x1080 canvas. The HTML plate
# is drawn to the same numbers, so the panel edge always meets the photo edge.
W, H = CANVAS["w"], CANVAS["h"]
PANEL = 792  # width of the text panel in split layouts

LAYOUTS: dict[str, dict] = {
    "title":       {"photos": [(0, 0, W, H)],                              "fields": ["eyebrow", "headline", "subline"]},
    "full":        {"photos": [(0, 0, W, H)],                              "fields": ["eyebrow", "headline", "subline"]},
    "split-left":  {"photos": [(PANEL, 0, W - PANEL, H)],                  "fields": ["eyebrow", "headline", "subline", "bullets"]},
    "split-right": {"photos": [(0, 0, W - PANEL, H)],                      "fields": ["eyebrow", "headline", "subline", "bullets"]},
    "stat":        {"photos": [(0, 0, W, H)],                              "fields": ["stat", "headline", "subline"]},
    "steps":       {"photos": [(0, 0, W, H)],                              "fields": ["headline", "steps"]},
    "compare":     {"photos": [(0, 0, W // 2, H), (W // 2, 0, W // 2, H)], "fields": ["headline", "labels"]},
    "quote":       {"photos": [(0, 0, W, H)],                              "fields": ["quote", "attribution"]},
    "outro":       {"photos": [],                                          "fields": ["headline", "subline", "contact"]},
    # The image *is* the slide: finished infographics, title cards, diagrams that
    # already carry their own type. Anything drawn on top would cover it.
    "plain":       {"photos": [(0, 0, W, H)],                              "fields": []},
}


def layout_of(scene: dict) -> dict:
    return LAYOUTS.get(scene.get("layout", "full"), LAYOUTS["full"])


# --------------------------------------------------------------------------
# storyboard io
# --------------------------------------------------------------------------
def load_storyboard(path: str | Path) -> dict:
    return json.loads(Path(path).read_text())


def save_storyboard(sb: dict, path: str | Path) -> None:
    Path(path).write_text(json.dumps(sb, indent=2) + "\n")


def load_theme(sb: dict, override: str | None = None) -> dict:
    base = json.loads((skill_dir() / "assets" / "theme.json").read_text())
    for src in (sb.get("theme"), override):
        if not src:
            continue
        if isinstance(src, dict):
            base.update(src)
        else:
            p = Path(src)
            if not p.is_absolute() and not p.exists():
                p = skill_dir() / "assets" / src
            base.update(json.loads(p.read_text()))
    return base
