# How the video is matched to the narration

The promise is simple: the finished video is exactly as long as the WAV, and
images change where the voice pauses rather than mid-word. Three mechanisms get
there.

## 1. Where each cut wants to be

Every scene carries the narration text spoken over it. `speech_weight()` scores
that text the way a voice artist reads it: syllables at roughly 4.2 per second,
plus 0.16s for a comma, 0.34s for a full stop, 0.28s for a paragraph break.
Cumulative weight across scenes, scaled to the recording's real duration, gives
each boundary a target.

Timestamps from the zip are the fallback, used for any scene with no narration
text, and always used as the *reference* for reporting. They are also what
`--prefer timestamps` switches to wholesale.

Why not just use their timestamps? Because they were written against a script,
and the recording is the script *as actually spoken* - a slower read, a retake,
a sentence dropped. Speech weight tracks the recording. The timestamps tell you
the order and the intent, which is why drift against them is reported rather
than discarded.

## 2. Finding the pauses

`silencedetect` (default `-32dB`, minimum 0.22s) returns every quiet stretch.
Short pauses give a cut point at their midpoint; pauses longer than 0.9s give a
point 0.35s in, so the new image is on screen before the next line starts rather
than hanging in dead air.

Thresholds worth changing:

- A recording made in a quiet booth: `--noise -26` finds more breaks.
- A hissy or room-toned recording: `--noise -40`, else everything reads as
  speech and no pauses are found at all.
- Music or room tone under the voice: expect few pauses. The cuts fall back to
  the speech-weight targets, which is still right, just less snappy.

## 3. Placing all the cuts at once

The obvious approach - predict each cut's absolute time from the word counts,
then snap it to the nearest pause - works for eight scenes and fails badly for
fifty. Every sentence is read a little faster or slower than predicted, those
errors add up like a random walk, and by the middle of a 12-minute take the
prediction is ten seconds out and snapping to the wrong breath. Measured on a
50-scene, 16-minute test take with known paragraph breaks, that approach put
3 of 49 cuts in the right place.

So the default (`--method segment`) asks a different question: *which pauses
divide this recording into pieces whose lengths best match each scene's text?*
Each scene is scored on its own length - `(ln(actual / expected))^2`, so running
20% long costs the same anywhere - and nothing accumulates. Longer pauses get a
small bonus, because a paragraph break is usually a longer breath than a comma.
Dynamic programming finds the exact best set of cuts.

Readers drift: most get faster or slower across a long take. After each pass the
solver measures how fast each stretch actually ran, smooths that into a pace
curve, and re-solves with the expectations bent to match (three passes).

On the same test takes:

| take | nearest-pause | segment |
|---|---|---|
| normal read, paragraph breaks longer than sentence breaks | 3/49 | **49/49** |
| adversarial: all pauses the same length, reader slows 20% | 0/49 | 44/49 |

The second row is close to the floor for anything that listens for pauses
rather than recognising words. If a take really has no difference between
sentence and paragraph pauses, check the flagged scenes in `timing.md` by ear.

`--method nearest` keeps the old behaviour (with `--window`), and the solver
falls back to it on its own when there are too few pauses to give every scene a
cut on a breath - a voice over a music bed, for instance.

## 4. Why it comes out exact

Boundaries are absolute positions, not a chain of durations, so rounding cannot
accumulate. Each is snapped to the frame grid; the last scene ends at the audio
duration itself. The final encode carries `-t <audio duration>`, so the
container is that length to the millisecond and the video track holds
`round(duration x fps)` frames.

Cross-fades would otherwise eat time - an xfade of T seconds shortens the
timeline by T at every join - so each clip is cut longer by exactly the part of
the fade it has to cover. `transition.align` chooses where the fade sits:
`center` (default) straddles the cut; `end` finishes on it, so the incoming
image is fully up the moment its narration starts and the dissolve stays inside
the outgoing scene's window. Either way the total never grows.

`verify.py` re-derives all of this from the rendered file rather than trusting
the plan.

## Reading the timing report

`work/timing.md` has a row per scene:

- **zip said** - the raw timestamp from the delivery.
- **scaled to this take** - that timestamp adjusted for the recording being
  longer or shorter overall. This is the fair comparison.
- **moved** - distance from the scaled target. Under a second is normal. Past
  ±2.5s is flagged.
- **on a pause** - whether the cut found a breath.

A flagged scene almost always means the narration text attached to it is not
what is actually spoken there - usually one sentence sitting in the wrong
scene's `narration` field. Move the sentence between scenes in
`storyboard.json` and re-run the sync. That is a real fix, and it improves
everything downstream. `--prefer timestamps` forces the cut back into place
without fixing the mismatch, which makes the cut land mid-sentence instead.

## Deliberately changing lengths

Stretching one scene and shortening another is expected, not a failure - the
person said as much. What is not acceptable:

- Trimming the narration to fit the pictures. The audio is the master.
- Padding the video past the audio. If they want a held beat at the end, they
  add silence to the WAV and you re-sync.
- Letting a scene drop under about 1.5s. Merge it with a neighbour instead;
  `verify.py` fails below 1.0s.

## Re-syncing after a new take

Drop the new WAV in and run `sync_audio.py` again, then rebuild. The storyboard
keeps the original script estimate so timestamp drift stays meaningful across
takes. Nothing about the callouts or the rendered plates needs redoing - only
the clip lengths change.
