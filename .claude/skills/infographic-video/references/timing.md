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

The obvious approach - snap each boundary to its nearest pause - is greedy: an
early scene grabs a pause a later scene needed, and that later cut ends up
mid-sentence. Instead `place_cuts()` solves the whole set together as a shortest
path: candidates are the pauses within `--window` of each target plus the option
of staying put at a fixed penalty, with the constraint that cuts stay in order
and no scene falls below the minimum length.

The penalty is the interesting part. Staying put costs 0.7s of "displacement",
so a pause 0.4s away is taken and a pause 1.5s away is not - a cut is worth
moving for a breath, not worth dragging the story out of step for one.

Widen with `--window 2.2` if too many cuts read as mid-line; tighten to `0.8` if
scenes are landing noticeably off their intended moment.

## 4. Why it comes out exact

Boundaries are absolute positions, not a chain of durations, so rounding cannot
accumulate. Each is snapped to the frame grid; the last scene ends at the audio
duration itself. The final encode carries `-t <audio duration>`, so the
container is that length to the millisecond and the video track holds
`round(duration x fps)` frames.

Cross-fades would otherwise eat time - an xfade of T seconds shortens the
timeline by T at every join - so each clip is cut T longer (T/2 at the ends) and
every fade is centred on its boundary. The visible scene starts and ends land
where the sync put them.

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
