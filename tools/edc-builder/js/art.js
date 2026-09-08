/* =====================================================================
   EDC Builder - the artwork
   ---------------------------------------------------------------------
   Every product is drawn, not photographed. That is the answer to the
   problem that a board of ninety product photographs never blends:
   ninety photographs carry ninety backgrounds, ninety light directions
   and ninety scales, and no amount of cutting out fixes the last two.

   So: about forty generators, shared across the catalogue, all drawing
   into the item's own real millimetre footprint, all lit from the top
   left, all using the same stroke weight and the same palette. Two
   knives from different makers come out looking like two knives
   photographed on the same table, because they were drawn by the same
   function with different arguments.

   draw(product) returns SVG markup in millimetres: the x axis runs
   0..mm[0] and the y axis 0..mm[1]. The board decides the scale, so
   the same drawing is a thumbnail on a card and a poster on a board.

   An entry in media/manifest.json overrides all of this for one
   product - see media() at the bottom. That is the door for real
   photography or generated art later, and nothing else has to change.
   ===================================================================== */

const EDCArt = (function () {

  const INK = '#1b1d21';

  /* ---- colour helpers. Everything shades from the one base colour in
     the catalogue, which is what keeps a family of items consistent. */
  function rgb(h) {
    h = h.replace('#', '');
    if (h.length === 3) h = h.split('').map(c => c + c).join('');
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
  }
  function hex(a) {
    return '#' + a.map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
  }
  function shade(c, amt) {
    const a = rgb(c);
    return hex(amt >= 0 ? a.map(v => v + (255 - v) * amt) : a.map(v => v * (1 + amt)));
  }
  const dk = (c, n) => shade(c, -(n === undefined ? 0.3 : n));
  const lt = (c, n) => shade(c, n === undefined ? 0.28 : n);

  /* ---- primitives ------------------------------------------------- */
  const at = o => Object.entries(o).map(([k, v]) => `${k}="${v}"`).join(' ');

  function rr(x, y, w, h, r, fill, extra) {
    return `<rect ${at(Object.assign({ x, y, width: w, height: h, rx: r, ry: r, fill,
      stroke: dk(fill, 0.42), 'stroke-width': 0.5 }, extra || {}))}/>`;
  }
  function plain(x, y, w, h, r, fill) {
    return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" ry="${r}" fill="${fill}"/>`;
  }
  function circ(cx, cy, r, fill, extra) {
    return `<circle ${at(Object.assign({ cx, cy, r, fill,
      stroke: dk(fill, 0.4), 'stroke-width': 0.4 }, extra || {}))}/>`;
  }
  function path(d, fill, extra) {
    return `<path ${at(Object.assign({ d, fill, stroke: dk(fill, 0.42), 'stroke-width': 0.5,
      'stroke-linejoin': 'round' }, extra || {}))}/>`;
  }
  function line(x1, y1, x2, y2, col, w, extra) {
    return `<line ${at(Object.assign({ x1, y1, x2, y2, stroke: col, 'stroke-width': w,
      'stroke-linecap': 'round' }, extra || {}))}/>`;
  }
  /* The single light source. A pale band down the upper third of a body
     is doing most of the work of making these look like objects. */
  function gloss(x, y, w, h, r, strength) {
    const s = strength === undefined ? 0.22 : strength;
    return `<rect x="${x}" y="${y}" width="${w}" height="${h * 0.42}" rx="${r}" ry="${r}"
      fill="#ffffff" opacity="${s}"/>`;
  }
  function screw(cx, cy, r, col) {
    return circ(cx, cy, r, col || '#8f959c') +
      line(cx - r * 0.55, cy, cx + r * 0.55, cy, INK, r * 0.28, { opacity: 0.55 });
  }
  /* Knurling, ridges, machining marks - the same stripe routine wherever
     a surface is textured, so textures match across makers. */
  function stripes(x, y, w, h, step, col, op) {
    let s = '';
    for (let i = x + step; i < x + w - step * 0.4; i += step) {
      s += line(i, y + h * 0.12, i, y + h * 0.88, col || INK, step * 0.16, { opacity: op || 0.3 });
    }
    return s;
  }
  function pocketClip(x, y, len, wid, col) {
    const c = dk(col, 0.22);
    return path(`M${x} ${y} h${len} a${wid * 0.5} ${wid * 0.5} 0 0 1 0 ${wid} h${-len * 0.82}`,
      'none', { stroke: c, 'stroke-width': wid * 0.46, 'stroke-linecap': 'round' }) +
      path(`M${x + len * 0.06} ${y + wid * 0.16} h${len * 0.8}`, 'none',
        { stroke: lt(col, 0.35), 'stroke-width': wid * 0.12, opacity: 0.6 });
  }

  /* ---- generators -------------------------------------------------- */
  /* Each takes (W, H, a) where a is the product's art block, and draws
     inside 0..W by 0..H millimetres. */
  const K = {};

  /* --- knives ------------------------------------------------------- */
  K.folder = (W, H, a) => {
    const body = a.body, sc = a.scale || '#c3c8ce';
    let s = '';
    /* handle, with a little drop toward the butt so it is not a bar */
    s += path(`M${W * 0.03} ${H * 0.34} Q${W * 0.02} ${H * 0.1} ${W * 0.13} ${H * 0.09}
               L${W * 0.93} ${H * 0.16} Q${W} ${H * 0.2} ${W} ${H * 0.42}
               Q${W} ${H * 0.86} ${W * 0.9} ${H * 0.9}
               L${W * 0.12} ${H * 0.95} Q${W * 0.02} ${H * 0.93} ${W * 0.03} ${H * 0.34} Z`, body);
    s += `<g opacity="0.5">${gloss(W * 0.06, H * 0.13, W * 0.88, H * 0.5, H * 0.12)}</g>`;
    /* blade spine sitting down in the handle */
    s += line(W * 0.14, H * 0.28, W * 0.9, H * 0.31, sc, H * 0.09, { opacity: 0.9 });
    if (a.hole) s += circ(W * 0.22, H * 0.2, H * 0.16, sc) + circ(W * 0.22, H * 0.2, H * 0.08, dk(body, 0.5));
    else s += circ(W * 0.2, H * 0.26, H * 0.1, sc);
    s += screw(W * 0.11, H * 0.55, H * 0.12);          /* pivot */
    s += screw(W * 0.62, H * 0.6, H * 0.075);
    s += screw(W * 0.86, H * 0.58, H * 0.075);
    if (a.clip) s += pocketClip(W * 0.5, H * 0.16, W * 0.4, H * 0.13, sc);
    return s;
  };

  K.opinel = (W, H, a) => {
    let s = path(`M${W * 0.06} ${H * 0.5} Q${W * 0.06} ${H * 0.08} ${W * 0.3} ${H * 0.1}
                  L${W * 0.97} ${H * 0.26} Q${W} ${H * 0.5} ${W * 0.97} ${H * 0.74}
                  L${W * 0.3} ${H * 0.9} Q${W * 0.06} ${H * 0.92} ${W * 0.06} ${H * 0.5} Z`, a.body);
    s += `<g opacity="0.45">${gloss(W * 0.08, H * 0.12, W * 0.86, H * 0.55, H * 0.2)}</g>`;
    s += stripes(W * 0.15, H * 0.2, W * 0.75, H * 0.6, W * 0.09, dk(a.body, 0.35), 0.16);
    /* the locking collar */
    s += rr(W * 0.08, H * 0.12, W * 0.1, H * 0.76, H * 0.12, a.scale);
    s += circ(W * 0.13, H * 0.5, H * 0.1, dk(a.scale, 0.2));
    return s;
  };

  K.fixed = (W, H, a) => {
    const hx = W * 0.46;
    let s = '';
    if (a.sheath) {
      /* the sheath, lighter than the handle so the two do not merge into
         one dark lozenge, with a welt seam and a belt loop */
      const sh = a.sheath;
      s += path(`M${W * 0.02} ${H * 0.3} L${hx} ${H * 0.08} L${hx} ${H * 0.92}
                 L${W * 0.02} ${H * 0.7} Q${W * -0.01} ${H * 0.5} ${W * 0.02} ${H * 0.3} Z`, lt(sh, 0.18));
      s += `<g opacity="0.3">${gloss(W * 0.03, H * 0.12, hx - W * 0.03, H * 0.5, H * 0.1)}</g>`;
      s += line(W * 0.06, H * 0.24, W * 0.06, H * 0.76, dk(sh, 0.4), H * 0.045, { opacity: 0.7 });
      s += rr(W * 0.18, H * 0.2, W * 0.16, H * 0.6, H * 0.08, dk(sh, 0.2));   /* belt loop */
      s += line(hx - W * 0.02, H * 0.1, hx - W * 0.02, H * 0.9, dk(sh, 0.45), H * 0.03);
    } else {
      s += path(`M${W * 0.02} ${H * 0.48} L${hx} ${H * 0.2} L${hx} ${H * 0.62} Z`, '#c3c8ce');
    }
    /* a sliver of guard between sheath mouth and handle */
    s += rr(hx - W * 0.01, H * 0.16, W * 0.05, H * 0.68, H * 0.08, '#b9bfc6');
    s += path(`M${hx + W * 0.04} ${H * 0.14} L${W * 0.94} ${H * 0.18} Q${W} ${H * 0.22} ${W} ${H * 0.5}
               Q${W} ${H * 0.78} ${W * 0.94} ${H * 0.82} L${hx + W * 0.04} ${H * 0.86} Z`, a.body);
    s += `<g opacity="0.45">${gloss(hx + W * 0.04, H * 0.16, W - hx - W * 0.04, H * 0.5, H * 0.14)}</g>`;
    if (a.skeleton) {
      s += circ(W * 0.62, H * 0.5, H * 0.15, dk(a.body, 0.55));
      s += circ(W * 0.78, H * 0.5, H * 0.15, dk(a.body, 0.55));
    } else {
      s += stripes(hx + W * 0.08, H * 0.22, W * 0.4, H * 0.56, W * 0.045, dk(a.body, 0.4), 0.22);
    }
    s += circ(W * 0.96, H * 0.5, H * 0.09, dk(a.body, 0.6));
    return s;
  };

  K.sak = (W, H, a) => {
    const body = a.body;
    let s = rr(0, 0, W, H, H * 0.28, body);
    s += `<g opacity="0.45">${gloss(W * 0.02, H * 0.04, W * 0.96, H * 0.6, H * 0.24)}</g>`;
    if (a.alox) s += stripes(W * 0.05, H * 0.12, W * 0.9, H * 0.76, W * 0.045, dk(body, 0.4), 0.35);
    /* the emblem, drawn as a plain roundel rather than any maker's mark */
    if (!a.small) {
      s += circ(W * 0.3, H * 0.5, H * 0.2, '#e8e6e1', { stroke: dk(body, 0.5) });
      s += line(W * 0.3, H * 0.36, W * 0.3, H * 0.64, dk(body, 0.2), H * 0.07);
      s += line(W * 0.3 - H * 0.14, H * 0.5, W * 0.3 + H * 0.14, H * 0.5, dk(body, 0.2), H * 0.07);
    }
    /* the tool slots you can see along the edge when it is shut */
    s += line(W * 0.55, H * 0.06, W * 0.95, H * 0.06, dk(body, 0.5), H * 0.05, { opacity: 0.7 });
    s += line(W * 0.55, H * 0.94, W * 0.95, H * 0.94, dk(body, 0.5), H * 0.05, { opacity: 0.7 });
    if ((a.layers || 1) > 1) s += line(W * 0.1, H * 0.94, W * 0.5, H * 0.94, dk(body, 0.5), H * 0.045, { opacity: 0.5 });
    s += circ(W * 0.94, H * 0.5, H * 0.09, dk(body, 0.55));   /* keyring hole */
    return s;
  };

  K.multitool = (W, H, a) => {
    const h = a.handle, b = a.body;
    /* the plier nose */
    let s = path(`M${W * 0.02} ${H * 0.42} L${W * 0.2} ${H * 0.2} L${W * 0.2} ${H * 0.8}
                  L${W * 0.02} ${H * 0.58} Z`, b);
    s += line(W * 0.05, H * 0.5, W * 0.19, H * 0.5, dk(b, 0.5), H * 0.045);
    /* the two handles, folded */
    s += rr(W * 0.16, H * 0.06, W * 0.84, H * 0.42, H * 0.12, h);
    s += rr(W * 0.16, H * 0.52, W * 0.84, H * 0.42, H * 0.12, h);
    s += `<g opacity="0.4">${gloss(W * 0.18, H * 0.08, W * 0.8, H * 0.3, H * 0.1)}</g>`;
    if (a.skeleton) {
      s += circ(W * 0.5, H * 0.27, H * 0.13, dk(h, 0.5));
      s += circ(W * 0.7, H * 0.27, H * 0.13, dk(h, 0.5));
      s += circ(W * 0.5, H * 0.73, H * 0.13, dk(h, 0.5));
    }
    if (a.bits) {
      s += line(W * 0.3, H * 0.73, W * 0.9, H * 0.73, dk(h, 0.45), H * 0.09, { opacity: 0.8 });
      s += line(W * 0.3, H * 0.27, W * 0.75, H * 0.27, dk(h, 0.45), H * 0.07, { opacity: 0.6 });
    }
    s += screw(W * 0.21, H * 0.27, H * 0.07);
    s += screw(W * 0.21, H * 0.73, H * 0.07);
    s += circ(W * 0.96, H * 0.27, H * 0.07, dk(h, 0.55));
    return s;
  };

  /* --- lights -------------------------------------------------------- */
  K.lightTube = (W, H, a) => {
    const b = a.body;
    let s = rr(W * 0.06, 0, W * 0.88, H, H * 0.22, b);
    s += rr(0, H * 0.02, W * 0.12, H * 0.96, H * 0.16, a.bezel);      /* head */
    s += circ(W * 0.045, H * 0.5, H * 0.3, '#f2ead2', { stroke: dk(a.bezel, 0.3) });
    s += rr(W * 0.9, H * 0.08, W * 0.1, H * 0.84, H * 0.16, dk(b, 0.25)); /* tail */
    s += `<g opacity="0.5">${gloss(W * 0.08, H * 0.04, W * 0.84, H * 0.55, H * 0.2)}</g>`;
    if (a.knurl) s += stripes(W * 0.3, H * 0.1, W * 0.4, H * 0.8, W * 0.028, dk(b, 0.5), 0.35);
    if (a.clip) s += pocketClip(W * 0.42, H * 0.02, W * 0.44, H * 0.16, a.bezel);
    s += rr(W * 0.18, H * 0.32, W * 0.07, H * 0.36, H * 0.1, dk(b, 0.5));  /* switch */
    return s;
  };

  K.lightFlat = (W, H, a) => {
    let s = path(`M${W * 0.1} ${H * 0.06} L${W * 0.98} ${H * 0.2} Q${W} ${H * 0.5} ${W * 0.98} ${H * 0.8}
                  L${W * 0.1} ${H * 0.94} Q${W * 0.02} ${H * 0.5} ${W * 0.1} ${H * 0.06} Z`, a.body);
    s += rr(0, H * 0.22, W * 0.12, H * 0.56, H * 0.1, a.bezel);
    s += circ(W * 0.05, H * 0.5, H * 0.2, '#f2ead2');
    s += `<g opacity="0.4">${gloss(W * 0.12, H * 0.1, W * 0.82, H * 0.5, H * 0.14)}</g>`;
    s += rr(W * 0.68, H * 0.34, W * 0.14, H * 0.32, H * 0.1, dk(a.body, 0.45));
    s += stripes(W * 0.2, H * 0.2, W * 0.4, H * 0.6, W * 0.04, dk(a.body, 0.5), 0.28);
    return s;
  };

  K.lightKey = (W, H, a) => {
    let s = rr(0, 0, W, H, H * 0.22, a.body);
    s += `<g opacity="0.45">${gloss(W * 0.03, H * 0.04, W * 0.94, H * 0.6, H * 0.18)}</g>`;
    s += circ(W * 0.16, H * 0.5, H * 0.24, '#f2ead2', { stroke: dk(a.bezel, 0.2) });
    if (a.screen) s += rr(W * 0.4, H * 0.28, W * 0.34, H * 0.44, H * 0.08, '#4a5f52');
    else if (a.glow) s += rr(W * 0.4, H * 0.36, W * 0.34, H * 0.28, H * 0.08, '#6fa8c8');
    else s += rr(W * 0.42, H * 0.36, W * 0.2, H * 0.28, H * 0.06, dk(a.body, 0.45));
    s += circ(W * 0.88, H * 0.5, H * 0.14, dk(a.body, 0.6));
    return s;
  };

  K.lightAngle = (W, H, a) => {
    let s = rr(0, H * 0.18, W * 0.72, H * 0.64, H * 0.16, a.body);       /* body */
    s += rr(W * 0.66, 0, W * 0.34, H * 0.62, H * 0.12, a.body);          /* head, turned up */
    s += circ(W * 0.83, H * 0.16, H * 0.16, '#f2ead2', { stroke: dk(a.bezel, 0.3) });
    s += `<g opacity="0.45">${gloss(W * 0.02, H * 0.2, W * 0.66, H * 0.4, H * 0.14)}</g>`;
    s += stripes(W * 0.1, H * 0.24, W * 0.4, H * 0.52, W * 0.05, dk(a.body, 0.5), 0.3);
    s += pocketClip(W * 0.2, H * 0.78, W * 0.5, H * 0.14, a.bezel);
    return s;
  };

  K.headlamp = (W, H, a) => {
    let s = path(`M${W * 0.06} ${H * 0.46} Q${W * 0.5} ${H * 0.3} ${W * 0.94} ${H * 0.46}`,
      'none', { stroke: a.band, 'stroke-width': H * 0.09, 'stroke-linecap': 'round' });
    s += path(`M${W * 0.06} ${H * 0.54} Q${W * 0.5} ${H * 0.86} ${W * 0.94} ${H * 0.54}`,
      'none', { stroke: a.band, 'stroke-width': H * 0.09, 'stroke-linecap': 'round' });
    s += rr(W * 0.22, H * 0.3, W * 0.56, H * 0.4, H * 0.14, a.body);
    s += `<g opacity="0.4">${gloss(W * 0.24, H * 0.32, W * 0.52, H * 0.3, H * 0.12)}</g>`;
    s += circ(W * 0.42, H * 0.5, H * 0.11, '#f2ead2');
    s += circ(W * 0.6, H * 0.5, H * 0.08, '#c8d8e0');
    return s;
  };

  /* --- pens ---------------------------------------------------------- */
  K.pen = (W, H, a) => {
    const b = a.body;
    let s = path(`M${W * 0.04} ${H * 0.5} L${W * 0.14} ${H * 0.1} L${W * 0.9} ${H * 0.06}
                  Q${W} ${H * 0.1} ${W} ${H * 0.5} Q${W} ${H * 0.9} ${W * 0.9} ${H * 0.94}
                  L${W * 0.14} ${H * 0.9} Z`, b);
    s += path(`M0 ${H * 0.5} L${W * 0.06} ${H * 0.34} L${W * 0.06} ${H * 0.66} Z`, a.tip);
    s += `<g opacity="0.5">${gloss(W * 0.1, H * 0.08, W * 0.86, H * 0.55, H * 0.24)}</g>`;
    if (a.ridges) s += stripes(W * 0.2, H * 0.08, W * 0.62, H * 0.84, W * 0.022, dk(b, 0.45), 0.3);
    if (a.bullet) {                                    /* the screw-on cap */
      s += rr(W * 0.66, H * 0.04, W * 0.34, H * 0.92, H * 0.4, dk(b, 0.14));
      s += `<g opacity="0.4">${gloss(W * 0.68, H * 0.06, W * 0.3, H * 0.5, H * 0.3)}</g>`;
      s += line(W * 0.66, H * 0.08, W * 0.66, H * 0.92, dk(b, 0.4), W * 0.006);
    }
    if (a.bolt) s += rr(W * 0.72, H * 0.24, W * 0.06, H * 0.52, H * 0.2, dk(b, 0.4));
    if (a.clip) s += pocketClip(W * 0.55, H * 0.02, W * 0.36, H * 0.2, dk(b, 0.15));
    return s;
  };

  /* --- wallets -------------------------------------------------------- */
  K.walletCard = (W, H, a) => {
    let s = '';
    /* cards peeking out from under the plates */
    s += plain(W * 0.06, H * 0.08, W * 0.9, H * 0.86, H * 0.06, '#d8d4cc');
    s += plain(W * 0.08, H * 0.12, W * 0.88, H * 0.82, H * 0.06, '#eae7e0');
    s += rr(0, 0, W, H, H * 0.08, a.body);
    s += `<g opacity="${a.metal ? 0.3 : 0.18}">${gloss(W * 0.02, H * 0.02, W * 0.96, H * 0.55, H * 0.07)}</g>`;
    if (a.metal) s += stripes(W * 0.06, H * 0.06, W * 0.88, H * 0.88, W * 0.05, dk(a.body, 0.4), 0.12);
    s += rr(W * 0.3, -H * 0.02, W * 0.16, H * 1.04, H * 0.03, a.band);   /* the band */
    if (a.cord) s += line(W * 0.06, H * 0.5, W * 0.94, H * 0.5, dk(a.band, 0.1), H * 0.06, { opacity: 0.7 });
    if (a.fan) s += path(`M${W * 0.72} ${H * 0.3} l${W * 0.14} ${H * 0.2} l${-W * 0.14} ${H * 0.2}`,
      'none', { stroke: dk(a.body, 0.5), 'stroke-width': H * 0.05 });
    s += screw(W * 0.1, H * 0.14, H * 0.055);
    s += screw(W * 0.1, H * 0.86, H * 0.055);
    s += screw(W * 0.9, H * 0.14, H * 0.055);
    s += screw(W * 0.9, H * 0.86, H * 0.055);
    return s;
  };

  K.walletBi = (W, H, a) => {
    let s = rr(0, 0, W, H, H * 0.07, a.body);
    s += `<g opacity="0.2">${gloss(W * 0.02, H * 0.02, W * 0.96, H * 0.5, H * 0.06)}</g>`;
    s += line(W * 0.5, H * 0.04, W * 0.5, H * 0.96, dk(a.body, 0.35), W * 0.006, { opacity: 0.6 });
    const dash = { stroke: a.stitch, 'stroke-width': H * 0.014, 'stroke-dasharray': `${H * 0.035} ${H * 0.03}`, opacity: 0.85 };
    s += line(W * 0.05, H * 0.06, W * 0.95, H * 0.06, a.stitch, H * 0.014, dash);
    s += line(W * 0.05, H * 0.94, W * 0.95, H * 0.94, a.stitch, H * 0.014, dash);
    s += line(W * 0.05, H * 0.06, W * 0.05, H * 0.94, a.stitch, H * 0.014, dash);
    s += line(W * 0.95, H * 0.06, W * 0.95, H * 0.94, a.stitch, H * 0.014, dash);
    /* a card edge showing above the pocket */
    s += plain(W * 0.58, H * 0.16, W * 0.32, H * 0.2, H * 0.02, '#e6e2da');
    return s;
  };

  /* --- watches --------------------------------------------------------- */
  function strapPair(W, H, a, caseTop, caseBot) {
    const bw = W * (a.bracelet ? 0.78 : 0.62), bx = (W - bw) / 2;
    let s = plain(bx, 0, bw, caseTop + H * 0.02, W * 0.05, a.band);
    s += plain(bx, caseBot - H * 0.02, bw, H - caseBot + H * 0.02, W * 0.05, a.band);
    if (a.bracelet) {
      for (let i = 0; i < 4; i++) {
        s += line(bx, H * 0.02 + i * H * 0.045, bx + bw, H * 0.02 + i * H * 0.045, dk(a.band, 0.35), H * 0.012);
        s += line(bx, H * 0.98 - i * H * 0.045, bx + bw, H * 0.98 - i * H * 0.045, dk(a.band, 0.35), H * 0.012);
      }
    } else {
      s += line(bx, H * 0.05, bx + bw, H * 0.05, dk(a.band, 0.3), H * 0.012, { opacity: 0.7 });
      s += line(bx, H * 0.95, bx + bw, H * 0.95, dk(a.band, 0.3), H * 0.012, { opacity: 0.7 });
    }
    return s;
  }

  K.watchDigital = (W, H, a) => {
    const cy = H * 0.5, ch = W * (a.big ? 0.98 : 0.92), ct = cy - ch / 2;
    let s = strapPair(W, H, a, ct, ct + ch);
    s += rr(W * 0.02, ct, W * 0.96, ch, a.round ? ch * 0.5 : W * 0.2, a.body);
    s += `<g opacity="0.28">${gloss(W * 0.04, ct + ch * 0.02, W * 0.92, ch * 0.5, W * 0.16)}</g>`;
    const fx = W * 0.16, fy = ct + ch * 0.2, fw = W * 0.68, fh = ch * 0.56;
    s += rr(fx, fy, fw, fh, a.round ? fw * 0.5 : W * 0.06, a.face);
    /* the segments, suggested rather than spelled out */
    s += line(fx + fw * 0.12, fy + fh * 0.6, fx + fw * 0.44, fy + fh * 0.6, INK, fh * 0.2, { opacity: 0.75 });
    s += line(fx + fw * 0.54, fy + fh * 0.6, fx + fw * 0.86, fy + fh * 0.6, INK, fh * 0.2, { opacity: 0.75 });
    s += line(fx + fw * 0.2, fy + fh * 0.24, fx + fw * 0.6, fy + fh * 0.24, INK, fh * 0.1, { opacity: 0.4 });
    /* pushers */
    [0.28, 0.72].forEach(p => {
      s += rr(W * -0.01, ct + ch * p - ch * 0.05, W * 0.06, ch * 0.1, ch * 0.04, dk(a.body, 0.25));
      s += rr(W * 0.95, ct + ch * p - ch * 0.05, W * 0.06, ch * 0.1, ch * 0.04, dk(a.body, 0.25));
    });
    return s;
  };

  K.watchAnalog = (W, H, a) => {
    const cy = H * 0.5, r = W * 0.46, ct = cy - r;
    let s = strapPair(W, H, a, ct + r * 0.35, cy + r * 0.65);
    s += circ(W * 0.5, cy, r, a.body);
    s += circ(W * 0.5, cy, r * 0.82, a.face);
    s += `<g opacity="0.2">${gloss(W * 0.5 - r * 0.7, cy - r * 0.75, r * 1.4, r * 0.9, r * 0.5)}</g>`;
    const mk = a.tritium ? '#9fd9c0' : (a.face === '#e8e6e1' ? INK : '#e8e6e1');
    for (let i = 0; i < 12; i++) {
      const ang = i * Math.PI / 6, ri = r * 0.68, ro = r * 0.76;
      s += line(W * 0.5 + Math.sin(ang) * ri, cy - Math.cos(ang) * ri,
        W * 0.5 + Math.sin(ang) * ro, cy - Math.cos(ang) * ro, mk, r * (i % 3 === 0 ? 0.09 : 0.05), { opacity: 0.9 });
    }
    s += line(W * 0.5, cy, W * 0.5 + r * 0.1, cy - r * 0.42, mk, r * 0.09);   /* hour */
    s += line(W * 0.5, cy, W * 0.5 + r * 0.42, cy + r * 0.2, mk, r * 0.065);  /* minute */
    s += circ(W * 0.5, cy, r * 0.07, mk);
    s += rr(W * 0.96, cy - r * 0.12, W * 0.06, r * 0.24, r * 0.06, dk(a.body, 0.2));  /* crown */
    return s;
  };

  /* --- keys and small metal --------------------------------------------- */
  K.keyOrg = (W, H, a) => {
    let s = '';
    /* keys fanned out of the body */
    [0.1, -0.06].forEach((t, i) => {
      s += `<g transform="rotate(${t * 40} ${W * 0.2} ${H * 0.5})">` +
        plain(W * 0.28, H * (0.42 + i * 0.06), W * 0.66, H * 0.16, H * 0.06, a.keys) +
        plain(W * 0.78, H * (0.36 + i * 0.06), W * 0.2, H * 0.28, H * 0.1, a.keys) + `</g>`;
    });
    s += rr(0, H * 0.12, W * 0.6, H * 0.76, H * 0.16, a.body);
    s += `<g opacity="0.35">${gloss(W * 0.02, H * 0.14, W * 0.56, H * 0.5, H * 0.14)}</g>`;
    s += screw(W * 0.1, H * 0.5, H * 0.11);
    s += screw(W * 0.5, H * 0.5, H * 0.08);
    if (a.led) s += circ(W * 0.3, H * 0.3, H * 0.08, '#f2ead2');
    return s;
  };

  K.ring = (W, H, a) => {
    let s = circ(W * 0.5, H * 0.5, W * 0.46, 'none', { stroke: a.body, 'stroke-width': W * 0.09 });
    s += circ(W * 0.5, H * 0.5, W * 0.46, 'none',
      { stroke: '#ffffff', 'stroke-width': W * 0.03, opacity: 0.35, fill: 'none' });
    s += rr(W * 0.38, H * 0.02, W * 0.24, H * 0.16, H * 0.05, dk(a.body, 0.25));
    return s;
  };

  K.sbiner = (W, H, a) => {
    const r = H * 0.42, w = H * 0.15;
    const ring = cx => circ(cx, H * 0.5, r, 'none',
      { stroke: a.body, 'stroke-width': w, fill: 'none' }) +
      circ(cx, H * 0.5, r, 'none', { stroke: '#ffffff', 'stroke-width': w * 0.28, fill: 'none', opacity: 0.35 });
    let s = ring(W * 0.25) + ring(W * 0.75);
    s += line(W * 0.25 + r * 0.7, H * 0.5, W * 0.75 - r * 0.7, H * 0.5, a.body, w);
    /* the two gates, sprung on opposite sides */
    s += line(W * 0.25, H * 0.5 - r, W * 0.25 - r * 0.5, H * 0.5 - r * 0.55, dk(a.body, 0.3), w * 0.8);
    s += line(W * 0.75, H * 0.5 + r, W * 0.75 + r * 0.5, H * 0.5 + r * 0.55, dk(a.body, 0.3), w * 0.8);
    return s;
  };

  K.barTool = (W, H, a) => {
    let s = rr(0, H * 0.18, W, H * 0.64, H * 0.2, a.body);
    s += `<g opacity="0.35">${gloss(W * 0.02, H * 0.2, W * 0.96, H * 0.42, H * 0.18)}</g>`;
    s += stripes(W * 0.2, H * 0.24, W * 0.5, H * 0.52, W * 0.08, dk(a.body, 0.4), 0.3);
    s += circ(W * 0.9, H * 0.5, H * 0.12, dk(a.body, 0.55));
    return s;
  };

  K.pry = (W, H, a) => {
    let s = path(`M0 ${H * 0.34} L${W * 0.16} ${H * 0.2} L${W * 0.9} ${H * 0.16}
                  Q${W} ${H * 0.2} ${W} ${H * 0.5} Q${W} ${H * 0.8} ${W * 0.9} ${H * 0.84}
                  L${W * 0.16} ${H * 0.8} L0 ${H * 0.66} Z`, a.body);
    s += `<g opacity="0.35">${gloss(W * 0.06, H * 0.18, W * 0.88, H * 0.5, H * 0.16)}</g>`;
    s += path(`M0 ${H * 0.4} L${W * 0.1} ${H * 0.46} L${W * 0.1} ${H * 0.54} L0 ${H * 0.6}`,
      dk(a.body, 0.45), { 'stroke-width': 0 });                       /* the nail-puller fork */
    s += circ(W * 0.88, H * 0.5, H * 0.16, dk(a.body, 0.55));
    s += rr(W * 0.4, H * 0.36, W * 0.12, H * 0.28, H * 0.08, dk(a.body, 0.45));  /* the driver notch */
    return s;
  };

  K.shard = (W, H, a) => {
    let s = path(`M0 ${H * 0.4} L${W * 0.12} ${H * 0.24} L${W * 0.5} ${H * 0.2}
                  L${W * 0.62} ${H * 0.06} L${W * 0.78} ${H * 0.2} L${W * 0.94} ${H * 0.24}
                  Q${W} ${H * 0.5} ${W * 0.94} ${H * 0.76} L${W * 0.78} ${H * 0.8}
                  L${W * 0.62} ${H * 0.94} L${W * 0.5} ${H * 0.8} L${W * 0.12} ${H * 0.76} L0 ${H * 0.6} Z`, a.body);
    s += `<g opacity="0.28">${gloss(W * 0.06, H * 0.22, W * 0.86, H * 0.45, H * 0.1)}</g>`;
    s += circ(W * 0.86, H * 0.5, H * 0.15, lt(a.body, 0.15));
    s += line(W * 0.02, H * 0.5, W * 0.16, H * 0.5, lt(a.body, 0.3), H * 0.08, { opacity: 0.6 });
    return s;
  };

  K.bitCase = (W, H, a) => {
    let s = rr(0, 0, W, H, H * 0.12, a.body);
    s += `<g opacity="0.25">${gloss(W * 0.02, H * 0.03, W * 0.96, H * 0.5, H * 0.1)}</g>`;
    s += rr(W * 0.06, H * 0.16, W * 0.88, H * 0.34, H * 0.08, a.accent);
    for (let i = 0; i < 6; i++) {
      s += rr(W * (0.1 + i * 0.14), H * 0.58, W * 0.09, H * 0.3, H * 0.04, '#b9bfc6');
    }
    if (a.ratchet) s += circ(W * 0.5, H * 0.33, H * 0.13, '#b9bfc6');
    return s;
  };

  /* --- fire ------------------------------------------------------------- */
  K.lighterBic = (W, H, a) => {
    let s = path(`M${W * 0.12} ${H * 0.98} L${W * 0.1} ${H * 0.36} Q${W * 0.1} ${H * 0.2} ${W * 0.3} ${H * 0.2}
                  L${W * 0.72} ${H * 0.2} Q${W * 0.9} ${H * 0.2} ${W * 0.9} ${H * 0.36}
                  L${W * 0.88} ${H * 0.98} Z`, a.body);
    s += `<g opacity="0.3">${gloss(W * 0.14, H * 0.24, W * 0.7, H * 0.6, W * 0.1)}</g>`;
    s += rr(W * 0.2, H * 0.04, W * 0.6, H * 0.18, H * 0.05, '#b9bfc6');   /* hood */
    s += circ(W * 0.5, H * 0.13, H * 0.05, '#8f959c');
    s += rr(W * 0.28, H * 0.16, W * 0.44, H * 0.08, H * 0.03, '#d8534a'); /* thumb wheel guard */
    return s;
  };

  K.lighterZippo = (W, H, a) => {
    let s = rr(0, 0, W, H, W * 0.12, a.body);
    s += `<g opacity="0.4">${gloss(W * 0.02, H * 0.02, W * 0.96, H * 0.55, W * 0.1)}</g>`;
    s += line(0, H * 0.3, W, H * 0.3, dk(a.body, 0.4), H * 0.02);          /* the lid seam */
    s += rr(W * 0.06, H * 0.02, W * 0.2, H * 0.28, W * 0.04, dk(a.body, 0.2)); /* hinge */
    s += rr(W * 0.2, H * 0.42, W * 0.6, H * 0.42, W * 0.06, 'none',
      { stroke: dk(a.body, 0.25), 'stroke-width': W * 0.02, opacity: 0.6 });
    return s;
  };

  K.ferro = (W, H, a) => {
    let s = rr(0, H * 0.26, W * 0.62, H * 0.48, H * 0.22, a.body);        /* handle */
    s += `<g opacity="0.35">${gloss(W * 0.02, H * 0.28, W * 0.58, H * 0.3, H * 0.2)}</g>`;
    s += stripes(W * 0.08, H * 0.3, W * 0.44, H * 0.4, W * 0.05, dk(a.body, 0.45), 0.35);
    s += rr(W * 0.6, H * 0.36, W * 0.4, H * 0.28, H * 0.12, a.rod);        /* the rod */
    s += `<g opacity="0.4">${gloss(W * 0.62, H * 0.37, W * 0.36, H * 0.2, H * 0.1)}</g>`;
    if (a.capsule) s += line(W * 0.16, H * 0.5, W * 0.16, H * 0.5, dk(a.body, 0.6), H * 0.3);
    return s;
  };

  /* --- tech -------------------------------------------------------------- */
  K.powerBank = (W, H, a) => {
    let s = rr(0, 0, W, H, W * 0.06, a.body);
    s += `<g opacity="0.22">${gloss(W * 0.02, H * 0.02, W * 0.96, H * 0.5, W * 0.05)}</g>`;
    if (a.carbon) {
      for (let i = 0; i < 14; i++)
        s += line(W * 0.04, H * (0.06 + i * 0.066), W * 0.96, H * (0.06 + i * 0.066),
          lt(a.body, 0.12), H * 0.012, { opacity: 0.5 });
    }
    if (!a.small) {
      for (let i = 0; i < 4; i++) s += circ(W * (0.14 + i * 0.09), H * 0.84, H * 0.022, '#7fd4a0');
      s += rr(W * 0.62, H * 0.78, W * 0.24, H * 0.11, H * 0.035, dk(a.body, 0.5));  /* ports */
    } else {
      s += rr(W * 0.3, H * 0.7, W * 0.4, H * 0.16, H * 0.06, dk(a.body, 0.3));      /* fold-out plug */
    }
    s += rr(W * 0.16, H * 0.16, W * 0.68, H * 0.4, W * 0.04, a.accent, { opacity: 0.35 });
    return s;
  };

  K.charger = (W, H, a) => {
    let s = rr(0, 0, W, H, W * 0.24, a.body);
    s += `<g opacity="0.25">${gloss(W * 0.02, H * 0.02, W * 0.96, H * 0.55, W * 0.2)}</g>`;
    s += rr(W * 0.3, H * 0.62, W * 0.4, H * 0.16, H * 0.06, a.accent);
    s += line(W * 0.32, H * 0.2, W * 0.32, H * 0.42, INK, W * 0.06, { opacity: 0.7 });
    s += line(W * 0.68, H * 0.2, W * 0.68, H * 0.42, INK, W * 0.06, { opacity: 0.7 });
    return s;
  };

  K.cable = (W, H, a) => {
    let s = '';
    for (let i = 0; i < 3; i++) {
      s += circ(W * 0.5, H * 0.5, W * (0.42 - i * 0.09), 'none',
        { stroke: a.body, 'stroke-width': W * 0.05, fill: 'none' });
    }
    s += rr(W * 0.72, H * 0.08, W * 0.2, H * 0.12, H * 0.04, a.ends);
    s += rr(W * 0.08, H * 0.8, W * 0.2, H * 0.12, H * 0.04, a.ends);
    return s;
  };

  K.tracker = (W, H, a) => {
    let s = circ(W * 0.5, H * 0.5, W * 0.48, a.body);
    s += `<g opacity="0.25">${gloss(W * 0.1, H * 0.06, W * 0.8, H * 0.55, W * 0.4)}</g>`;
    s += circ(W * 0.5, H * 0.5, W * 0.3, 'none', { stroke: a.accent, 'stroke-width': W * 0.03, fill: 'none' });
    for (let i = 0; i < 8; i++) {
      const ang = i * Math.PI / 4;
      s += circ(W * 0.5 + Math.sin(ang) * W * 0.18, H * 0.5 - Math.cos(ang) * W * 0.18, W * 0.022, a.accent);
    }
    return s;
  };

  K.budCase = (W, H, a) => {
    let s = rr(0, 0, W, H, W * 0.32, a.body);
    s += `<g opacity="0.3">${gloss(W * 0.03, H * 0.03, W * 0.94, H * 0.5, W * 0.28)}</g>`;
    s += line(W * 0.06, H * 0.34, W * 0.94, H * 0.34, dk(a.body, 0.3), H * 0.016);
    s += rr(W * 0.34, H * 0.29, W * 0.32, H * 0.05, H * 0.02, dk(a.body, 0.22));   /* hinge */
    s += circ(W * 0.5, H * 0.74, W * 0.06, '#7fd4a0');                             /* charge light */
    s += `<g opacity="0.12">${plain(W * 0.14, H * 0.42, W * 0.72, H * 0.42, W * 0.24, INK)}</g>`;
    s += rr(W * 0.4, H * 0.94, W * 0.2, H * 0.06, H * 0.02, dk(a.body, 0.3));
    return s;
  };

  K.usbStick = (W, H, a) => {
    let s = rr(W * 0.18, 0, W * 0.82, H, H * 0.18, a.body);
    s += `<g opacity="0.3">${gloss(W * 0.2, H * 0.03, W * 0.78, H * 0.5, H * 0.16)}</g>`;
    s += rr(0, H * 0.24, W * 0.24, H * 0.52, H * 0.1, a.accent);
    s += circ(W * 0.9, H * 0.5, H * 0.14, dk(a.body, 0.5));
    return s;
  };

  /* --- paper ------------------------------------------------------------- */
  K.notebook = (W, H, a) => {
    let s = plain(W * 0.04, H * 0.02, W * 0.94, H * 0.97, W * 0.03, '#efece5');   /* pages */
    s += rr(0, 0, W * 0.96, H * 0.98, W * 0.03, a.body);
    s += `<g opacity="0.16">${gloss(W * 0.02, H * 0.01, W * 0.92, H * 0.5, W * 0.03)}</g>`;
    s += rr(W * 0.14, H * 0.16, W * 0.68, H * 0.24, W * 0.02, 'none',
      { stroke: a.band, 'stroke-width': W * 0.012, opacity: 0.8 });
    s += line(W * 0.2, H * 0.6, W * 0.76, H * 0.6, a.band, H * 0.008, { opacity: 0.5 });
    s += line(W * 0.2, H * 0.66, W * 0.62, H * 0.66, a.band, H * 0.008, { opacity: 0.5 });
    s += line(W * 0.03, H * 0.3, W * 0.03, H * 0.36, dk(a.body, 0.5), W * 0.02);  /* staples */
    s += line(W * 0.03, H * 0.64, W * 0.03, H * 0.7, dk(a.body, 0.5), W * 0.02);
    return s;
  };

  /* --- water --------------------------------------------------------------- */
  K.bottle = (W, H, a) => {
    const nw = W * (a.wide ? 0.62 : 0.44), nx = (W - nw) / 2;
    let s = path(`M0 ${H * 0.96} L0 ${H * 0.3} Q0 ${H * 0.2} ${nx} ${H * 0.14}
                  L${nx + nw} ${H * 0.14} Q${W} ${H * 0.2} ${W} ${H * 0.3} L${W} ${H * 0.96}
                  Q${W} ${H} ${W * 0.9} ${H} L${W * 0.1} ${H} Q0 ${H} 0 ${H * 0.96} Z`, a.body);
    s += `<g opacity="${a.translucent ? 0.34 : 0.22}">${gloss(W * 0.06, H * 0.18, W * 0.34, H * 1.5, W * 0.1)}</g>`;
    if (a.translucent) {
      for (let i = 0; i < 5; i++)
        s += line(W * 0.68, H * (0.4 + i * 0.11), W * 0.92, H * (0.4 + i * 0.11), '#ffffff', H * 0.006, { opacity: 0.55 });
    }
    s += rr(nx - W * 0.03, H * 0.02, nw + W * 0.06, H * 0.14, W * 0.04, a.cap);
    s += stripes(nx - W * 0.02, H * 0.03, nw + W * 0.04, H * 0.12, W * 0.05, dk(a.cap, 0.4), 0.35);
    s += rr(W * 0.06, H * 0.36, W * 0.88, H * 0.14, W * 0.03, dk(a.body, 0.25), { opacity: 0.35 });
    return s;
  };

  /* --- medical --------------------------------------------------------------- */
  K.tourniquet = (W, H, a) => {
    let s = rr(0, H * 0.28, W, H * 0.44, H * 0.06, a.body);
    s += `<g opacity="0.18">${gloss(W * 0.01, H * 0.29, W * 0.98, H * 0.3, H * 0.05)}</g>`;
    s += line(W * 0.02, H * 0.38, W * 0.98, H * 0.38, lt(a.body, 0.25), H * 0.03, { opacity: 0.6 });
    s += line(W * 0.02, H * 0.62, W * 0.98, H * 0.62, lt(a.body, 0.25), H * 0.03, { opacity: 0.6 });
    s += rr(W * 0.34, H * 0.04, W * 0.06, H * 0.92, H * 0.05, a.windlass);   /* windlass rod */
    s += rr(W * 0.2, H * 0.16, W * 0.34, H * 0.18, H * 0.05, dk(a.body, 0.3)); /* the clip plate */
    s += rr(W * 0.72, H * 0.34, W * 0.22, H * 0.32, H * 0.05, dk(a.body, 0.35));
    return s;
  };

  K.medPack = (W, H, a) => {
    let s = path(`M0 ${H * 0.06} L${W} ${H * 0.06} L${W} ${H * 0.94} L0 ${H * 0.94} Z`, a.body);
    s += `<g opacity="0.2">${gloss(W * 0.01, H * 0.07, W * 0.98, H * 0.5, W * 0.01)}</g>`;
    /* the crimped seal top and bottom */
    s += line(0, H * 0.1, W, H * 0.1, dk(a.body, 0.25), H * 0.03, { 'stroke-dasharray': `${W * 0.02} ${W * 0.014}` });
    s += line(0, H * 0.9, W, H * 0.9, dk(a.body, 0.25), H * 0.03, { 'stroke-dasharray': `${W * 0.02} ${W * 0.014}` });
    s += rr(W * 0.12, H * 0.26, W * 0.5, H * 0.16, H * 0.03, a.accent, { opacity: 0.85 });
    s += line(W * 0.12, H * 0.56, W * 0.7, H * 0.56, a.accent, H * 0.02, { opacity: 0.6 });
    if (a.cross) {
      s += line(W * 0.82, H * 0.62, W * 0.82, H * 0.82, a.accent, W * 0.05);
      s += line(W * 0.74, H * 0.72, W * 0.9, H * 0.72, a.accent, W * 0.05);
    }
    s += path(`M${W * 0.94} ${H * 0.06} l${W * 0.06} ${H * 0.05} l${-W * 0.06} ${H * 0.05}`,
      'none', { stroke: dk(a.body, 0.4), 'stroke-width': H * 0.014 });    /* tear notch */
    return s;
  };

  /* --- pouches ---------------------------------------------------------------- */
  K.pouch = (W, H, a) => {
    let s = rr(0, 0, W, H, H * 0.12, a.body);
    s += `<g opacity="0.18">${gloss(W * 0.02, H * 0.02, W * 0.96, H * 0.5, H * 0.1)}</g>`;
    if (a.clear) s += rr(W * 0.1, H * 0.26, W * 0.8, H * 0.5, H * 0.06, '#dfe6e8', { opacity: 0.55 });
    /* zipper round three sides, with the pull parked at a corner */
    s += path(`M${W * 0.06} ${H * 0.24} L${W * 0.94} ${H * 0.24}`, 'none',
      { stroke: a.zip, 'stroke-width': H * 0.035, 'stroke-dasharray': `${H * 0.03} ${H * 0.022}` });
    s += rr(W * 0.86, H * 0.16, W * 0.1, H * 0.1, H * 0.03, a.zip);
    s += line(W * 0.06, H * 0.94, W * 0.94, H * 0.94, dk(a.body, 0.3), H * 0.02, { opacity: 0.6 });
    if (a.big) s += line(W * 0.06, H * 0.6, W * 0.94, H * 0.6, dk(a.body, 0.28), H * 0.02, { opacity: 0.5 });
    return s;
  };

  /* --- eyewear ------------------------------------------------------------------ */
  K.shades = (W, H, a) => {
    const r = H * 0.42;
    let s = '';
    /* arms, folded back behind the lenses */
    s += line(W * 0.12, H * 0.34, W * 0.02, H * 0.24, a.body, H * 0.1);
    s += line(W * 0.88, H * 0.34, W * 0.98, H * 0.24, a.body, H * 0.1);
    [0.27, 0.73].forEach(cx => {
      s += path(`M${W * cx - r * 1.15} ${H * 0.34} h${r * 2.3} a${r * 0.5} ${r * 0.5} 0 0 1 ${-r * 0.15} ${r * 0.45}
                 q${-r * 0.9} ${r * 0.95} ${-r * 2} ${0} a${r * 0.5} ${r * 0.5} 0 0 1 ${-r * 0.15} ${-r * 0.45} Z`, a.lens);
      s += `<g opacity="0.25">${gloss(W * cx - r * 1.05, H * 0.36, r * 2.1, r * 0.9, r * 0.3)}</g>`;
    });
    s += path(`M${W * 0.4} ${H * 0.36} q${W * 0.1} ${H * 0.1} ${W * 0.2} ${0}`, 'none',
      { stroke: a.body, 'stroke-width': H * 0.09, fill: 'none' });          /* bridge */
    s += line(W * 0.12, H * 0.31, W * 0.42, H * 0.31, a.body, H * 0.08);    /* brow */
    s += line(W * 0.58, H * 0.31, W * 0.88, H * 0.31, a.body, H * 0.08);
    return s;
  };

  /* --- belts, coiled ------------------------------------------------------------- */
  K.belt = (W, H, a) => {
    let s = '';
    for (let i = 0; i < 3; i++) {
      s += circ(W * 0.5, H * 0.5, W * (0.44 - i * 0.11), 'none',
        { stroke: a.body, 'stroke-width': W * 0.085, fill: 'none' });
      s += circ(W * 0.5, H * 0.5, W * (0.44 - i * 0.11), 'none',
        { stroke: '#ffffff', 'stroke-width': W * 0.012, fill: 'none', opacity: 0.16 });
    }
    s += rr(W * 0.36, H * 0.02, W * 0.28, H * 0.16, H * 0.03, a.buckle);
    s += rr(W * 0.42, H * 0.06, W * 0.16, H * 0.08, H * 0.02, dk(a.buckle, 0.4));
    return s;
  };

  /* --- cord and tape ---------------------------------------------------------------- */
  K.tapeFlat = (W, H, a) => {
    let s = rr(0, 0, W, H, W * 0.04, a.body);
    s += `<g opacity="0.16">${gloss(W * 0.02, H * 0.02, W * 0.96, H * 0.5, W * 0.03)}</g>`;
    for (let i = 1; i < 7; i++)
      s += line(W * 0.03, H * (i / 7), W * 0.97, H * (i / 7), lt(a.body, 0.3), H * 0.012, { opacity: 0.45 });
    s += rr(W * 0.62, H * 0.36, W * 0.3, H * 0.28, H * 0.06, a.accent, { opacity: 0.8 });
    return s;
  };

  K.cordHank = (W, H, a) => {
    let s = '';
    for (let i = 0; i < 5; i++) {
      s += path(`M${W * 0.08} ${H * (0.2 + i * 0.15)} Q${W * 0.5} ${H * (0.06 + i * 0.15)} ${W * 0.92} ${H * (0.2 + i * 0.15)}`,
        'none', { stroke: a.body, 'stroke-width': H * 0.075, fill: 'none', 'stroke-linecap': 'round' });
    }
    s += rr(W * 0.42, H * 0.06, W * 0.16, H * 0.88, H * 0.06, dk(a.body, 0.3));  /* the tie */
    return s;
  };

  K.gearTie = (W, H, a) => {
    let s = path(`M${W * 0.03} ${H * 0.5} Q${W * 0.3} ${H * -0.3} ${W * 0.56} ${H * 0.5}
                  Q${W * 0.72} ${H * 1.2} ${W * 0.86} ${H * 0.5}
                  Q${W * 0.92} ${H * 0.05} ${W * 0.97} ${H * 0.5}`, 'none',
      { stroke: dk(a.body, 0.35), 'stroke-width': H * 0.72, fill: 'none', 'stroke-linecap': 'round' });
    s += path(`M${W * 0.03} ${H * 0.5} Q${W * 0.3} ${H * -0.3} ${W * 0.56} ${H * 0.5}
               Q${W * 0.72} ${H * 1.2} ${W * 0.86} ${H * 0.5}
               Q${W * 0.92} ${H * 0.05} ${W * 0.97} ${H * 0.5}`, 'none',
      { stroke: a.body, 'stroke-width': H * 0.56, fill: 'none', 'stroke-linecap': 'round' });
    return s;
  };

  /* --- navigation ----------------------------------------------------------------------- */
  function dialFace(cx, cy, r, dial) {
    let s = circ(cx, cy, r, dial);
    s += circ(cx, cy, r * 0.86, 'none', { stroke: INK, 'stroke-width': r * 0.05, fill: 'none', opacity: 0.5 });
    for (let i = 0; i < 8; i++) {
      const ang = i * Math.PI / 4;
      s += line(cx + Math.sin(ang) * r * 0.6, cy - Math.cos(ang) * r * 0.6,
        cx + Math.sin(ang) * r * 0.82, cy - Math.cos(ang) * r * 0.82, INK, r * (i % 2 ? 0.04 : 0.08), { opacity: 0.6 });
    }
    s += path(`M${cx} ${cy - r * 0.62} L${cx + r * 0.16} ${cy} L${cx} ${cy + r * 0.62} L${cx - r * 0.16} ${cy} Z`, '#c1443c');
    s += path(`M${cx} ${cy + r * 0.62} L${cx + r * 0.16} ${cy} L${cx - r * 0.16} ${cy} Z`, '#e8e6e1');
    s += circ(cx, cy, r * 0.09, INK);
    return s;
  }

  K.compass = (W, H, a) => {
    let s = rr(0, 0, W, H, W * 0.2, a.body);
    s += dialFace(W * 0.5, H * 0.5, Math.min(W, H) * 0.36, a.dial);
    s += rr(W * 0.36, H * -0.04, W * 0.28, H * 0.12, H * 0.04, dk(a.body, 0.2));
    return s;
  };

  K.compassPlate = (W, H, a) => {
    let s = rr(0, 0, W, H, W * 0.03, lt(a.body, 0.3), { opacity: 0.78 });
    s += line(W * 0.5, H * 0.02, W * 0.5, H * 0.98, '#c1443c', H * 0.02, { opacity: 0.8 });
    for (let i = 1; i < 8; i++)
      s += line(W * 0.06, H * (i / 8), W * 0.14, H * (i / 8), '#e8e6e1', H * 0.014, { opacity: 0.8 });
    s += dialFace(W * 0.62, H * 0.5, Math.min(W * 0.34, H * 0.42), a.dial);
    return s;
  };

  K.whistle = (W, H, a) => {
    let s = path(`M0 ${H * 0.36} L${W * 0.5} ${H * 0.18} Q${W} ${H * 0.2} ${W} ${H * 0.5}
                  Q${W} ${H * 0.8} ${W * 0.5} ${H * 0.82} L0 ${H * 0.64} Z`, a.body);
    s += `<g opacity="0.3">${gloss(W * 0.06, H * 0.22, W * 0.88, H * 0.4, H * 0.14)}</g>`;
    s += rr(W * 0.36, H * 0.34, W * 0.3, H * 0.14, H * 0.05, dk(a.body, 0.55));
    s += circ(W * 0.88, H * 0.5, H * 0.1, dk(a.body, 0.5));
    return s;
  };

  /* --- fidget --------------------------------------------------------------------------- */
  K.begleri = (W, H, a) => {
    const r = H * 0.5;
    let s = path(`M${W * 0.14} ${H * 0.5} Q${W * 0.5} ${H * 1.35} ${W * 0.86} ${H * 0.5}`,
      'none', { stroke: '#3a3f47', 'stroke-width': H * 0.16, fill: 'none', 'stroke-linecap': 'round' });
    [0.14, 0.86].forEach(cx => {
      s += rr(W * cx - r, H * 0.5 - r, r * 2, r * 2, r * 0.55, a.body);
      s += `<g opacity="0.32">${gloss(W * cx - r * 0.85, H * 0.5 - r * 0.85, r * 1.7, r * 1.1, r * 0.45)}</g>`;
      s += circ(W * cx, H * 0.5, r * 0.22, dk(a.body, 0.5));
    });
    return s;
  };

  K.spinner = (W, H, a) => {
    const cx = W * 0.5, cy = H * 0.5, r = Math.min(W, H) * 0.5;
    let s = '';
    for (let i = 0; i < 3; i++) {
      const ang = i * 2 * Math.PI / 3;
      s += circ(cx + Math.sin(ang) * r * 0.62, cy - Math.cos(ang) * r * 0.62, r * 0.36, a.body);
    }
    s += circ(cx, cy, r * 0.38, a.body);
    s += circ(cx, cy, r * 0.2, dk(a.body, 0.45));
    s += `<g opacity="0.25">${gloss(cx - r * 0.6, cy - r * 0.8, r * 1.2, r * 0.8, r * 0.4)}</g>`;
    return s;
  };

  /* ---- the public face ------------------------------------------------- */

  /* An override lets a photograph or a generated image replace one
     drawing without any code change. Paths stay relative to media/, so
     the library works hosted or from a folder on a desk. */
  function media(id) {
    const m = (typeof window !== 'undefined' && window.EDC_MEDIA) || {};
    return m[id] || null;
  }

  function draw(p) {
    const [W, H] = p.mm;
    const img = media(p.id);
    if (img) {
      return `<image href="${img}" x="0" y="0" width="${W}" height="${H}"
        preserveAspectRatio="xMidYMid meet"/>`;
    }
    const gen = K[p.art.kind];
    if (!gen) return rr(0, 0, W, H, Math.min(W, H) * 0.1, p.art.body || '#8e8f95');
    return gen(W, H, p.art);
  }

  /* A standalone <svg> for one product, used by the catalogue cards.
     boxW/boxH are pixels; the drawing is fitted inside with a margin. */
  function thumb(p, boxW, boxH) {
    const [W, H] = p.mm;
    const pad = 0.08;
    const k = Math.min(boxW * (1 - pad * 2) / W, boxH * (1 - pad * 2) / H);
    const ox = (boxW - W * k) / 2, oy = (boxH - H * k) / 2;
    return `<svg class="thumb" viewBox="0 0 ${boxW} ${boxH}" width="${boxW}" height="${boxH}"
      role="img" aria-label="${esc(p.brand + ' ' + p.name)}">
      <g transform="translate(${ox} ${oy}) scale(${k})">${draw(p)}</g></svg>`;
  }

  function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  return { draw, thumb, esc, kinds: Object.keys(K), shade, dk, lt };
})();
