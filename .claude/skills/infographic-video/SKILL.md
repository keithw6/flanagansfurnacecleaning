---
name: infographic-video
description: Build a branded infographic-style 1080p video from a zip of timestamped images plus a narration script, then lock it frame-for-frame to a recorded WAV voice-over so the finished video is exactly as long as the audio. Use this whenever someone hands over a zip (or folder) of photos with times in the filenames, a shot list, or a script with [00:12] markers and wants a video, explainer, ad, reel, or "turn these into a video"; whenever they later send the voice-over, narration, WAV, or "the audio" for a video you already storyboarded; and whenever they ask to re-time, re-sync, lengthen, shorten, or fix scene timing against a voice track. Also use it when they only describe the goal - "make a video out of these job photos", "something for YouTube from this script" - and images plus text are what they have.
---

# Infographic video from timestamped images + narration

Two passes, with the person's recording arriving between them.

**Pass 1 - storyboard and draft.** The zip becomes a storyboard: one scene per
image, each with a start time, the lines of script spoken over it, and a layout.
You write the on-screen callouts, look at the still previews, fix what is wrong,
and render a draft so they can approve the look before recording.

**Pass 2 - lock to the voice.** The WAV arrives. Scene lengths are recomputed
from the actual recording - some scenes get longer, some shorter, cuts move onto
the pauses between sentences - and the final encode is trimmed to the narration's
exact duration. `verify.py` proves it rather than assuming it.

Scene lengths are *meant* to move in pass 2. The person's timestamps say where an
image belongs in the story; the recording says how long that part of the story
actually takes. Honour the order and the relative placement, let the durations
stretch.

## Setup

```bash
python3 .claude/skills/infographic-video/scripts/setup_env.py
```

Installs/checks Pillow, Playwright + Chromium, and ffmpeg. Run it once per
machine; it is a no-op afterwards. Every command below is run from the repo root
with `S=.claude/skills/infographic-video`.

## Pass 1 - zip to draft

```bash
python3 $S/scripts/ingest.py --zip delivery.zip --out work/ --project duct-story
```

Reads the images, the script, and whichever timestamp convention they used
(filenames like `00-12_trunk-line.jpg`, `[0:12]` markers in the script, or a
`shots.csv`). Writes `work/storyboard.json` and a readable `work/storyboard.md`.

A big delivery often arrives in parts: repeat `--zip` for each one, and pass a
script or shot list sent outside the zips with `--add`. Byte-identical images
are dropped, so a folder that got zipped twice does not become duplicate scenes.

```bash
python3 $S/scripts/ingest.py --zip part1.zip --zip part2.zip \
    --add Narration.txt --add Scene_Timings.csv --out work/ --project name
```
Read the `.md` - it is the fastest way to see whether the images and the script
lined up the way they intended. `references/inputs.md` covers every accepted
form and what to do when the zip is messier than expected.

**First decide whether the images are photos or finished slides.** Open a few.
If they already carry their own titles, numbers and labels - illustrated
infographics, a designed deck exported to PNG - anything drawn over them covers
their type. Ingest with `--layout plain`, set `"lower_bar": false` in the
storyboard's `theme`, and skip the callouts entirely: the job is timing and
motion, not copy. Read any README or production notes that came with them too;
they often say what the canvas colour, transitions and ending should be.

**Otherwise, write the callouts.** This is the part no script can do: edit
`work/storyboard.json` and fill in each scene's `layout` and `callout`. The
narration text for each scene is already sitting there - the callout is not a
transcript of it, it is the two or three words a viewer needs on screen while
they hear it. `references/layouts.md` has the field-by-field schema and the
writing rules; the short version:

- Headline: 3-7 words, the point of the scene, not a sentence. Wrap one word in
  `*asterisks*` to colour it with the brand accent.
- Subline: one supporting line, optional. Cut it if the headline stands alone.
- Never caption what is visible in the photo; say what the photo cannot.
- A number in the narration ("twelve pounds") wants `layout: "stat"`. A
  list of actions wants `"steps"`. A before/after pair wants `"compare"`.
- First scene `"title"`, last scene `"outro"` unless there is a reason not to.

**Look at it before rendering video.**

```bash
python3 $S/scripts/render_scenes.py --work work/
python3 $S/scripts/preview.py --work work/ --sheet
```

Then actually open `work/preview/contact-sheet.jpg` with the Read tool and look.
Overflowing headlines, a subject hidden behind the scrim, a face cropped at the
chin - all obvious in a still, all expensive to find after an encode. Fix the
storyboard (`focus`, shorter headline, different layout), re-run
`render_scenes.py --only s04`, look again.

```bash
python3 $S/scripts/build_video.py --work work/ --draft
```

A fast, motion-free cut for approval. Skip it if the voice-over is already in
hand - go straight to pass 2.

## Pass 2 - lock to the narration

```bash
python3 $S/scripts/sync_audio.py --work work/ --audio narration.wav
python3 $S/scripts/build_video.py --work work/
python3 $S/scripts/verify.py --work work/
```

`sync_audio.py` weighs each scene's narration text, finds the pauses in the WAV,
and chooses the set of pauses that splits the recording into pieces whose
lengths best fit each scene's text - solved as a whole, learning the reader's
pace as it goes, so errors do not pile up over a long take. The last scene ends
at the exact audio duration. It prints a per-scene table and writes
`work/timing.md`.

Read that table before rendering. The `moved` column is how far a scene shifted
from where their timestamp put it, *after* correcting for the recording being
longer or shorter overall. Anything past ±2.5s is flagged, and it almost always
means one thing: the narration text attached to that scene is not what is
actually spoken there. Fix the `narration` field in the storyboard (move a
sentence from one scene to its neighbour) and re-run the sync - that is a real
fix. Forcing the cut with `--prefer timestamps` only hides it.

`verify.py` must pass before the video goes anywhere. It checks the video length
against the narration to within one frame, the frame count, that the muxed audio
is the complete recording and not a truncated copy, and that no scene got
squeezed too short. It exits non-zero on failure and writes `work/verify.md`.

Deliver `work/<project>.mp4` along with what changed: which scenes stretched,
which shortened, anything you flagged.

## When both arrive together

Run ingest, write the callouts, render scenes, check the contact sheet, then go
straight to `sync_audio.py` → `build_video.py` → `verify.py`. The draft pass
exists only to get the look approved before someone spends time recording.

## Knobs worth knowing

| Situation | What to do |
|---|---|
| A cut lands one sentence early or late | Check that scene's `narration` really is what is said there; if the take has no longer pauses at paragraph breaks, fix the odd one by hand in `storyboard.json` |
| A quiet or noisy recording finds no pauses | `--noise -26` (quiet room) or `--noise -40` (hissy recording) |
| They want the image order respected over the speech | `--prefer timestamps` |
| Too many scenes for a short recording | The minimum scene length drops automatically and says so; better to merge scenes |
| Hard cuts instead of fades | Set `transition.type` to `"none"` in the storyboard |
| Dissolve must finish on the cut, not straddle it | `"transition": {"type": "fade", "duration": 0.5, "align": "end"}` |
| Fade to white/black at the very end | `"end_fade": {"color": "white", "duration": 1.5}` |
| Transparent PNGs | Flattened onto `theme.photo_bg` (default white) - never onto black |
| Images with text near the edges | `"motion_amount": 0.035` in the theme (default 0.08) so the move never crops it |
| Motion feels busy | `build_video.py --no-motion`, or set a scene's `motion` to `"none"` |
| Re-rendering one fixed scene | `render_scenes.py --only s04` then rebuild |
| Different business / colours | `--theme my-theme.json`; see `references/layouts.md` |

A full render is a few minutes for a 60-90 second piece and roughly 35-45
minutes for a 12-minute, 50-scene one - the Ken Burns pass is the slow part, so
run long builds with `run_in_background`. Use `--draft` while iterating, and
only do the full encode once the stills look right. For a long piece, render a
short sample first (copy the storyboard, keep the first five or six scenes) so
the look is approved before anyone waits on the whole thing.

Clips are joined in batches of ten and then the batches are joined, which keeps
memory flat however many scenes there are (one graph over fifty clips needed
7 GB). `IV_BATCH=n` changes the batch size.

## Reference files

- `references/inputs.md` - every timestamp convention, messy-zip recovery, what
  to ask for when the delivery is incomplete
- `references/layouts.md` - the ten layouts (including `plain` for finished slides), the callout schema for each,
  theming, and how to write copy that reads in 4 seconds
- `references/timing.md` - how the sync maths works, why durations are allowed
  to move, and how to diagnose a video that feels out of step

## Things that go wrong

- **Never hand over a video `verify.py` has not passed.** "It looks about right"
  is how a 200ms drift ships.
- **Don't pad the audio to fit the video.** If they want a beat of silence at the
  end, they add it to the WAV and you re-sync; the video follows the audio.
- **Don't rewrite their script.** Callouts are yours to write, narration is
  theirs. If a scene's text is in the wrong scene, move it - don't reword it.
- **A photo that needs explaining is the wrong photo.** Say so rather than
  burying it under a paragraph of on-screen text.
- **Flag flawed artwork, don't silently ship it.** A smudge, a scrubbed logo, a
  generation artefact - the contact sheet is where you catch it, and the person
  decides whether to replace the image.
- **A 12-minute voice-over is too big to attach as WAV.** Ask for FLAC
  (lossless, about half the size) or mono WAV. Not MP3: its encoder adds a few
  milliseconds of silence at the start, which is exactly the drift this skill
  exists to prevent.
