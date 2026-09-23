# Layouts, callouts and theming

## The storyboard scene

```json
{
  "id": "s04",
  "layout": "split-right",
  "images": ["00-31_vacuum-hookup.jpg"],
  "focus": "center",
  "motion": "right",
  "requested_time": 31.0,
  "start": 26.87, "end": 38.40, "duration": 11.53,
  "narration": "One access point, sealed properly, does the work that a dozen little holes never will.",
  "callout": {
    "eyebrow": "Step 2",
    "headline": "One hole, *sealed properly*",
    "subline": "Not a dozen little ones",
    "bullets": ["Whole system under negative pressure", "Every branch whipped and brushed"]
  }
}
```

`start`/`end`/`duration` are written by the sync - edit `narration`, `layout`,
`callout`, `focus` and `motion`, and let the timing come from the audio.

`focus` decides what survives the crop: `center`, `top`, `bottom`, `left`,
`right`, the four corners, `face` (biased above centre), or `"35%,20%"`.
Anything tall going into a wide region needs this - `top` for a person standing,
`bottom` for a floor register.

`motion` is the camera move: `in`, `out`, `left`, `right`, `up`, `down`, or
`none`. Ingest alternates them; vary it so the video does not pulse, and use
`none` on any image with text already in it (a screenshot, a certificate).

## The ten layouts

| layout | photo | use it when | callout fields |
|---|---|---|---|
| `title` | full bleed | opening card | `eyebrow`, `headline`, `subline` |
| `full` | full bleed | the photo carries the scene | `eyebrow`, `headline`, `subline` |
| `split-left` | right 1128px | the point needs a few words of support | `eyebrow`, `headline`, `subline`, `bullets` |
| `split-right` | left 1128px | same, alternating for rhythm | same |
| `stat` | full bleed, dimmed | narration says a number | `stat`, `eyebrow`, `headline` |
| `steps` | full bleed, dimmed | a sequence of actions | `headline`, `steps` |
| `compare` | two halves | before/after pair | `headline`, `labels` |
| `quote` | full bleed, dimmed | a customer line or a claim | `quote`, `attribution` |
| `outro` | none, brand card | closing card with contact | `headline`, `contact` |
| `plain` | full bleed, untouched | the image is already a finished slide | none |

`stat` takes `{"value": "12", "unit": "lbs", "label": "of dust, hair and debris"}`.
`steps` takes `[{"n": "1", "t": "Pull the blower", "d": "Check the motor"}]` -
three cards fit comfortably, four is the ceiling. `compare` needs two entries in
`images` and falls back to `full` with a warning if it only gets one.

Alternate layouts so consecutive scenes do not repeat. A whole video of `full`
is a slideshow; a whole video of `split` is a lecture.

## Writing the callouts

The viewer hears the narration and reads the screen at the same time. Repeating
the sentence they are hearing makes them do the same work twice and they stop
reading. The callout is the thing they should still remember with the sound off.

- **Headline, 3-7 words.** A claim or a result, not a label. "One hole, sealed
  properly" over "Trunk line access". No full stop.
- **One accent word.** `*asterisks*` colour a word with the brand red. One per
  headline; two is noise.
- **Subline only if it adds.** A qualifier, a number, a place. If it restates
  the headline, delete it.
- **Bullets are evidence, not sentences.** Three at most, under seven words
  each, no trailing punctuation.
- **Never caption the photograph.** The viewer can see it is a furnace. Tell
  them what it cost, how long it took, or what it means.
- **Numbers earn a `stat` scene.** "Twelve pounds" as a headline is a phrase;
  as a 300px numeral it is the thing people quote back to you.
- **4-second rule.** If it cannot be read in four seconds it is too long, and a
  short scene makes that worse - check `duration` before writing a long one.

Headlines that still overflow are shrunk automatically down to 55% of their
base size before anything clips. That safety net is for surprises, not a licence
to write paragraphs - if a headline is being shrunk, it is too long.

## Theming

`assets/theme.json` sets brand, colours, fonts, contact details and the lower
bar. Override with `--theme my-theme.json` on `render_scenes.py`, or put the
values inline under `"theme"` in the storyboard. Only the keys you set change.

```json
{
  "accent": "#E02127",
  "panel_bg": "#16181A",
  "logo_text": "FLANAGAN'S",
  "logo_sub": "FURNACE & DUCT CLEANING",
  "contact": {"phone": "403-272-0560", "site": "flanagansfurnacecleaning.com",
              "area": "Calgary, Airdrie, Chestermere & Strathmore"},
  "lower_bar": true,
  "progress_dots": true,
  "motion_scale": 2.6
}
```

`motion_scale` is how far photos are oversampled for the camera move. 2.6 keeps
a slow zoom smooth; lower it to about 1.6 to render faster when drafting.

`motion_amount` is how far the camera travels: 0.08 means an 8% zoom or pan. On
finished slides with a title near the top edge, 0.035 keeps every word in frame.
A single scene can override it with its own `motion_amount`.

`photo_bg` is the canvas under transparent images (default `#FFFFFF`). Artwork
exported with a transparent background was almost always drawn for a white
page; flattening it onto black turns dark type invisible.

Montserrat and Source Sans 3 (the website's own faces) are bundled in
`assets/fonts` and inlined into the page as data URIs - Chromium refuses
`file://` fonts in generated content and would quietly fall back to a serif,
which is the kind of mistake you only notice after the encode. If the font files
are missing the plates fall back to a system sans, never a serif.

## Changing the look

`assets/scene.css` holds every layout. The plate is a transparent 1920x1080 PNG:
anything you do not paint shows the moving photograph underneath, which is why
scrims are rgba gradients rather than solid fills. Add a layout by adding a
branch in `scene_html()` and an entry in `LAYOUTS` in `ivlib.py` - the photo
regions in that table are what both the crop and the CSS are built from, so they
stay aligned by construction.
