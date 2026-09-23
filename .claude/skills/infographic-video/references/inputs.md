# What the delivery can look like

The zip rarely arrives in one tidy shape, so `ingest.py` reads four timestamp
conventions and picks the strongest one present.

## Precedence

| Rank | Source | Looks like |
|---|---|---|
| 1 | shot list in the zip | `shots.csv`, `shots.txt`, `manifest.json`, `scenes.json` |
| 2 | markers in the script | `[0:12]`, `{{trunk-line.jpg}}`, `[0:12 trunk-line.jpg]` |
| 3 | image filenames | `00-12_trunk-line.jpg`, `12s-trunk.jpg`, `trunk@0:12.jpg` |
| 4 | plain order | `01.jpg`, `02.jpg`, spread across the script by speech weight |

A stronger source wins outright - it is not merged with a weaker one. Any image
the chosen source never mentions is appended at the end and called out in the
run log, so nothing is silently dropped.

## Filenames

Read as **minutes-seconds**, so `00-12` is twelve seconds, not "shot 12":

```
00-00_title-truck.jpg      0:00
00-09_furnace-room.jpg     0:09
01-12_happy-home.jpg       1:12
```

Separators `-`, `_`, `.`, `:` all work, and `01-12.5_x.jpg` keeps the half
second. A leading number with no second part (`01_furnace.jpg`) is treated as a
running order, not a time - that ambiguity is the one worth being strict about,
because `03_x.jpg` almost never means "three seconds in".

Other accepted forms: `45s_x.jpg` (seconds), `x@1:23.jpg` (anywhere in the name).

## Markers in the script

```
Every furnace in Calgary moves the same air forty times a day. [0:09]
The truck-mounted vacuum stays on the driveway. {{trunk-line.jpg}}
Then we cut in at the trunk line. [0:31 vacuum-hookup.jpg]
```

Markers do double duty: they set the time *and* split the narration. The text
between two markers becomes that scene's spoken line, which makes them the most
accurate option - worth suggesting if they ask how to send the next one.

`{{file}}` and `[[file]]` place an image without giving a time; the scene picks
up its timing from the surrounding markers.

## Shot lists

CSV with a header row - delimiter is sniffed, column order does not matter, and
any of `time`/`timestamp`/`start`/`at` works for the time:

```csv
file,time,layout,headline,subline
00-trunk.jpg,0:12,split-left,One hole sealed properly,Not a dozen little ones
debris.jpg,0:42,stat,,
```

JSON: either a bare array or `{"scenes": [...]}` with the same keys.

Other columns that are read when present: `end` (the last row's end becomes the
planned running time), `narration` (that scene's spoken text - more reliable
than splitting the script), `title`, and `animation`/`motion`/`camera`. A free-text
animation note ("push slowly toward the car", "move across the two drivers") is
turned into the nearest camera move a still can do and kept in `notes`. Notes
that ask for things a flat image cannot do - revealing icons one at a time,
adding rain - cannot be honoured; say so rather than pretend.

Loose text: `0:12  trunk.jpg  One hole sealed properly` (tab or two-space
separated) is read too.

## The script

The largest `.txt`/`.md` in the zip, preferring a filename containing *script*,
*narration*, *voice*, *story*, *copy* or *vo*. Paragraph breaks and sentence
punctuation both matter: they decide where the narration gets split between
scenes, and they line up with the pauses a voice artist takes, which is what
`sync_audio.py` looks for later.

If there is no script at all, scenes still build - they just spread evenly and
carry no narration text, so the sync falls back to the timestamps. Say so rather
than inventing narration.

## Images

JPEG, PNG, WebP, GIF, BMP, TIFF. EXIF rotation is honoured. HEIC needs
`pip install pillow-heif`; without it those files are skipped and named in the
log - ask for JPEGs rather than guessing.

Resolution: 1920x1080 is the floor for a full-bleed scene. Smaller images still
work (the camera move is reduced so they are not blown up past ~2.4x), but a
1024px phone screenshot will look soft full-frame. Put those in a `split`
layout where they only fill part of the width.

## When the delivery is incomplete

- **No script, no timestamps** - ask for the script first. Everything downstream
  (scene length, where the cuts land, what the callouts say) comes from it.
- **More images than the script can carry** - some scenes will be under two
  seconds. Merge them or drop the weakest rather than flashing them past.
- **Timestamps past the end of the script** - the run log flags the mismatch.
  Usually the script is an older draft; ask before guessing.
- **A zip inside the zip** - unpack it yourself and use `--dir` instead of
  `--zip`.
- **Split across several zips** - `--zip a.zip --zip b.zip`, plus `--add` for a
  script or CSV that came separately. Duplicate images are skipped by content.
- **A Word document that will not open** - uploads get truncated. The text lives
  in `word/document.xml`, near the start of the file, so it usually survives:
  walk the local zip headers and inflate that one entry rather than asking for
  a re-send.
