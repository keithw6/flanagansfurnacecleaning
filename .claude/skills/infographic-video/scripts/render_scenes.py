#!/usr/bin/env python3
"""Render each storyboard scene into two layers.

  photos/<id>_<k>.jpg  the photograph, cover-cropped to its region and
                       oversampled so the Ken Burns move stays smooth
  plates/<id>.png      the graphics layer (type, panels, scrims, brand bar)
                       with everything else transparent

Keeping them apart is what makes the result look designed rather than
slideshow-ish: the photo drifts, the typography stays nailed to the frame.

Usage:
  python3 render_scenes.py --work work/ [--only s03,s04] [--theme my.json]
"""
from __future__ import annotations

import argparse
import base64
import html as htmlmod
import json
import math
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import ivlib as iv

MAX_UPSCALE = 2.4  # never blow a small photo up more than this


# --------------------------------------------------------------------------
# photo layer
# --------------------------------------------------------------------------
def focus_point(focus) -> tuple[float, float]:
    if isinstance(focus, (list, tuple)) and len(focus) == 2:
        return float(focus[0]), float(focus[1])
    named = {"center": (.5, .5), "top": (.5, .22), "bottom": (.5, .80), "left": (.22, .5),
             "right": (.78, .5), "top-left": (.25, .25), "top-right": (.75, .25),
             "bottom-left": (.25, .75), "bottom-right": (.75, .75), "face": (.5, .34)}
    if isinstance(focus, str):
        s = focus.strip().lower()
        if s in named:
            return named[s]
        m = re.fullmatch(r"(\d+)%?\s*[, ]\s*(\d+)%?", s)
        if m:
            return int(m.group(1)) / 100, int(m.group(2)) / 100
    return .5, .5


def prep_photo(src: Path, region, focus, scale: float, dest: Path) -> None:
    from PIL import Image, ImageOps

    im = Image.open(src)
    im = ImageOps.exif_transpose(im)
    if im.mode not in ("RGB", "L"):
        im = im.convert("RGB")
    rw, rh = region[2], region[3]
    tw, th = int(rw * scale), int(rh * scale)
    grow = max(tw / im.width, th / im.height)
    if grow > MAX_UPSCALE:                       # small source: settle for less oversampling
        shrink = MAX_UPSCALE / grow
        tw, th = max(rw, int(tw * shrink)), max(rh, int(th * shrink))
    f = max(tw / im.width, th / im.height)
    nw, nh = max(tw, math.ceil(im.width * f)), max(th, math.ceil(im.height * f))
    im = im.resize((nw, nh), Image.LANCZOS)
    fx, fy = focus_point(focus)
    left = int(round((nw - tw) * fx))
    top = int(round((nh - th) * fy))
    im = im.crop((left, top, left + tw, top + th))
    dest.parent.mkdir(parents=True, exist_ok=True)
    im.convert("RGB").save(dest, "JPEG", quality=93, subsampling=1, optimize=True)


def embed_fonts(css: str) -> str:
    """Inline the woff2 files as data URIs.

    Chromium blocks file:// subresources for content set with set_content, so a
    plain path silently falls back to a system serif - which is exactly the kind
    of quiet wrongness that only shows up after the video is rendered.
    """
    fonts = iv.skill_dir() / "assets" / "fonts"

    def sub(m):
        f = fonts / m.group(1)
        if not f.exists():
            return "local('sans-serif')"
        return ("url(data:font/woff2;base64," +
                base64.b64encode(f.read_bytes()).decode() + ') format("woff2")')

    return re.sub(r'url\("FONT_DIR/([^"]+)"\) format\("woff2"\)', sub, css)


# --------------------------------------------------------------------------
# graphics plate
# --------------------------------------------------------------------------
def esc(s) -> str:
    """Escape, but let *stars* mark an accent-coloured word."""
    out = htmlmod.escape(str(s or "")).replace("\n", "<br>")
    return re.sub(r"\*([^*]+)\*", r"<em>\1</em>", out)


def dots(n: int, i: int) -> str:
    return '<div class="dots">' + "".join(
        f'<span class="dot{" on" if k == i else ""}"></span>' for k in range(n)) + "</div>"


def bar(theme: dict, n: int, i: int) -> str:
    c = theme.get("contact", {})
    right = []
    if c.get("phone"):
        right.append(f'<span class="phone-sm">{esc(c["phone"])}</span>')
    if theme.get("progress_dots", True):
        right.append(dots(n, i))
    return (f'<div class="bar"><div class="lockup">'
            f'<span class="a">{esc(theme.get("logo_text", ""))}</span>'
            f'<span class="b">{esc(theme.get("logo_sub", ""))}</span></div>'
            f'<div class="right">{"".join(right)}</div></div>')


def block(c: dict, big: int | None = None) -> str:
    parts = []
    if c.get("eyebrow"):
        parts.append(f'<div class="eyebrow">{esc(c["eyebrow"])}</div>')
    if c.get("headline"):
        style = f' style="font-size:{big}px"' if big else ""
        parts.append(f'<div class="headline" data-fit{style}>{esc(c["headline"])}</div>')
    if c.get("subline"):
        parts.append(f'<div class="subline">{esc(c["subline"])}</div>')
    if c.get("bullets"):
        items = "".join(f'<div class="bullet">{esc(b)}</div>' for b in c["bullets"])
        parts.append(f'<div class="bullets">{items}</div>')
    return "".join(parts)


def scene_html(scene: dict, theme: dict, n: int, idx: int) -> str:
    c = scene.get("callout") or {}
    lay = scene.get("layout", "full")
    use_bar = theme.get("lower_bar", True) and lay not in ("outro",)
    bottom = 150 if use_bar else 96
    body = []

    if lay == "title":
        body += ['<div class="scrim left"></div>', '<div class="scrim bottom"></div>',
                 ('' if use_bar else f'<div class="mark"><div class="a">{esc(theme.get("logo_text",""))}</div></div>'),
                 f'<div class="content" style="left:96px;right:560px;top:300px;bottom:{bottom}px">'
                 f'{block(c, big=104)}</div>']
    elif lay == "full":
        body += ['<div class="scrim bottom"></div>',
                 f'<div class="content" style="left:96px;right:640px;top:380px;bottom:{bottom}px">'
                 f'{block(c)}</div>']
    elif lay in ("split-left", "split-right"):
        side = "left" if lay == "split-left" else "right"
        pw = iv.PANEL
        pad = 88
        box = (f'left:{pad}px;width:{pw-2*pad}px' if side == "left"
               else f'right:{pad}px;width:{pw-2*pad}px')
        body += [f'<div class="panel {side}"></div>',
                 f'<div class="content center" style="{box};top:120px;bottom:{bottom}px">'
                 f'{block(c, big=68)}</div>']
    elif lay == "stat":
        st = c.get("stat") or {}
        if isinstance(st, str):
            st = {"value": st}
        inner = ['<div class="scrim full"></div>', '<div class="content mid" style="inset:0">']
        if c.get("eyebrow"):
            inner.append(f'<div class="eyebrow">{esc(c["eyebrow"])}</div>')
        inner.append('<div class="stat"><div class="stat-row">'
                     f'<span class="stat-value" data-fit>{esc(st.get("value",""))}</span>'
                     + (f'<span class="stat-unit">{esc(st["unit"])}</span>' if st.get("unit") else "")
                     + '</div>'
                     + (f'<div class="stat-label">{esc(st.get("label",""))}</div>' if st.get("label") else "")
                     + '</div>')
        if c.get("headline"):
            inner.append(f'<div class="subline" style="max-width:1200px;text-align:center;margin-top:26px">'
                         f'{esc(c["headline"])}</div>')
        inner.append("</div>")
        body += inner
    elif lay == "steps":
        steps = c.get("steps") or []
        cards = "".join(
            f'<div class="step"><div class="n">{esc(s.get("n", i+1))}</div>'
            f'<div class="t">{esc(s.get("t",""))}</div>'
            + (f'<div class="d">{esc(s["d"])}</div>' if s.get("d") else "") + "</div>"
            for i, s in enumerate(steps[:4]))
        body += ['<div class="scrim full"></div>',
                 f'<div class="content" style="left:96px;right:96px;top:120px;height:300px;justify-content:flex-start">'
                 f'{block(c, big=70)}</div>',
                 f'<div class="steps" style="bottom:{bottom + 18}px">{cards}</div>']
    elif lay == "compare":
        labels = c.get("labels") or ["Before", "After"]
        body += ['<div class="scrim bottom"></div>', '<div class="divider"></div>',
                 f'<div class="pill a">{esc(labels[0])}</div>',
                 f'<div class="pill b">{esc(labels[1] if len(labels) > 1 else "")}</div>',
                 f'<div class="caption-bar" style="bottom:{bottom}px">'
                 f'<div class="headline" data-fit>{esc(c.get("headline",""))}</div></div>']
    elif lay == "quote":
        body += ['<div class="scrim full"></div>',
                 f'<div class="content center" style="left:160px;right:160px;top:140px;bottom:{bottom}px">'
                 f'<div class="quote" data-fit>{esc(c.get("quote", c.get("headline","")))}</div>'
                 + (f'<div class="attribution">{esc(c["attribution"])}</div>' if c.get("attribution") else "")
                 + '</div>']
    elif lay == "outro":
        ct = {**theme.get("contact", {}), **(c.get("contact") or {})}
        body += ['<div class="outro-bg"></div>', '<div class="outro">',
                 f'<div class="lockup" style="justify-content:center">'
                 f'<span class="a" style="font-size:44px">{esc(theme.get("logo_text",""))}</span>'
                 f'<span class="b" style="font-size:26px">{esc(theme.get("logo_sub",""))}</span></div>',
                 f'<div class="headline" data-fit style="font-size:74px;text-align:center;max-width:1400px">'
                 f'{esc(c.get("headline",""))}</div>' if c.get("headline") else "",
                 f'<div class="phone">{esc(ct.get("phone",""))}</div>' if ct.get("phone") else "",
                 f'<div class="site">{esc(ct.get("site",""))}</div>' if ct.get("site") else "",
                 f'<div class="area">{esc(ct.get("area",""))}</div>' if ct.get("area") else "",
                 "</div>"]
    else:
        body += ['<div class="scrim bottom"></div>',
                 f'<div class="content" style="left:96px;right:640px;top:380px;bottom:{bottom}px">{block(c)}</div>']

    if use_bar:
        body.append(bar(theme, n, idx))

    css = embed_fonts((iv.skill_dir() / "assets" / "scene.css").read_text())
    root = (f":root{{--accent:{theme.get('accent','#E02127')};"
            f"--panel:{theme.get('panel_bg','#16181A')};"
            f"--panel-w:{iv.PANEL}px;}}")
    fit = """
      document.fonts.ready.then(() => {
        document.querySelectorAll('[data-fit]').forEach(el => {
          const box = el.closest('.content, .caption-bar, .outro') || el.parentElement;
          // A centred flex box overflows at both ends and scrollHeight never
          // reports it, so measure with the content stacked from the top.
          const keep = box.style.justifyContent;
          box.style.justifyContent = 'flex-start';
          let size = parseFloat(getComputedStyle(el).fontSize);
          const floor = size * 0.55;
          let guard = 90;
          while (guard-- > 0 && size > floor &&
                 (box.scrollHeight > box.clientHeight + 1 || el.scrollWidth > el.clientWidth + 1)) {
            size -= 2; el.style.fontSize = size + 'px';
          }
          box.style.justifyContent = keep;
        });
        window.__ready = true;
      });"""
    return (f"<!doctype html><html><head><meta charset='utf-8'><style>{css}\n{root}</style></head>"
            f"<body><div class='stage'>{''.join(body)}</div>"
            f"<script>{fit}</script></body></html>")


# --------------------------------------------------------------------------
def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--work", required=True)
    ap.add_argument("--only", help="comma separated scene ids to re-render")
    ap.add_argument("--theme")
    ap.add_argument("--keep-html", action="store_true", help="also write the plate HTML for debugging")
    args = ap.parse_args()

    work = Path(args.work).resolve()
    sb = iv.load_storyboard(work / "storyboard.json")
    theme = iv.load_theme(sb, args.theme)
    src = Path(sb["source_dir"])
    only = {s.strip() for s in args.only.split(",")} if args.only else None
    scenes = sb["scenes"]
    scale = float(theme.get("motion_scale", 2.6))

    (work / "photos").mkdir(parents=True, exist_ok=True)
    (work / "plates").mkdir(parents=True, exist_ok=True)

    # --- photos ---
    for i, sc in enumerate(scenes):
        if only and sc["id"] not in only:
            continue
        imgs = sc.get("images", [])
        if sc.get("layout") == "compare" and len(imgs) < 2:
            # one photo cannot fill a two-up comparison; fall back rather than
            # leaving half the frame empty
            print(f"  ! {sc['id']} 'compare' needs two images - using 'full' instead")
            sc["layout"] = "full"
        regions = iv.layout_of(sc)["photos"]
        if regions and not imgs:
            print(f"  ! {sc['id']} layout '{sc['layout']}' needs a photo but none is listed")
        for k, region in enumerate(regions):
            if k >= len(imgs):
                break
            prep_photo(src / imgs[k], region, sc.get("focus", "center"), scale,
                       work / "photos" / f"{sc['id']}_{k}.jpg")
        print(f"  photo  {sc['id']}  {sc['layout']:<12} {', '.join(imgs) or '(none)'}")

    # --- plates ---
    exe = iv.find_chromium()
    if not exe:
        sys.exit("No Chromium found. Run: python3 scripts/setup_env.py")
    from playwright.sync_api import sync_playwright

    with sync_playwright() as p:
        browser = p.chromium.launch(executable_path=exe,
                                    args=["--no-sandbox", "--disable-dev-shm-usage",
                                          "--force-color-profile=srgb", "--font-render-hinting=none"])
        page = browser.new_page(viewport={"width": iv.CANVAS["w"], "height": iv.CANVAS["h"]},
                                device_scale_factor=1)
        for i, sc in enumerate(scenes):
            if only and sc["id"] not in only:
                continue
            doc = scene_html(sc, theme, len(scenes), i)
            if args.keep_html:
                (work / "plates" / f"{sc['id']}.html").write_text(doc)
            page.set_content(doc, wait_until="load")
            page.wait_for_function("window.__ready === true", timeout=15000)
            page.screenshot(path=str(work / "plates" / f"{sc['id']}.png"), omit_background=True)
            print(f"  plate  {sc['id']}")
        browser.close()

    iv.save_storyboard(sb, work / "storyboard.json")
    print(f"\nrendered {len(scenes) if not only else len(only)} scene(s) into {work}")


if __name__ == "__main__":
    main()
