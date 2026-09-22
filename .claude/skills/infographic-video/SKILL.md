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
Read the `.md` - it is the fastest way to see whether the images and the script
lined up the way they intended. `references/inputs.md` covers every accepted
form and what to do when the zip is messier than expected.

**Then write the callouts.** This is the part no script can do: edit
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
places every cut in a pause where it can, and ends the last scene at the exact
audio duration. It prints a per-scene table and writes `work/timing.md`.

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
| Cuts feel late or early against the voice | `sync_audio.py --window 2.2` lets a cut travel further to find a pause |
| A quiet or noisy recording finds no pauses | `--noise -26` (quiet room) or `--noise -40` (hissy recording) |
| They want the image order respected over the speech | `--prefer timestamps` |
| Too many scenes for a short recording | The minimum scene length drops automatically and says so; better to merge scenes |
| Hard cuts instead of fades | Set `transition.type` to `"none"` in the storyboard |
| Motion feels busy | `build_video.py --no-motion`, or set a scene's `motion` to `"none"` |
| Re-rendering one fixed scene | `render_scenes.py --only s04` then rebuild |
| Different business / colours | `--theme my-theme.json`; see `references/layouts.md` |

A full render is a few minutes for a 60-90 second piece - the Ken Burns pass is
the slow part. Use `--draft` while iterating, and only do the full encode once
the stills look right.

## Reference files

- `references/inputs.md` - every timestamp convention, messy-zip recovery, what
  to ask for when the delivery is incomplete
- `references/layouts.md` - the nine layouts, the callout schema for each,
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
