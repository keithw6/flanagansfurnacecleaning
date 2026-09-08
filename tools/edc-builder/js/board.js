/* =====================================================================
   EDC Builder - the display board
   ---------------------------------------------------------------------
   The board is one self-contained <svg>: literal colours, no CSS
   variables, no external anything. That is deliberate and it buys three
   things at once. It rasterises to PNG in the browser with no server.
   It prints. And it looks the same to whoever opens a share link as it
   did to the person who built it, which a board themed off the reader's
   own light or dark preference would not.

   Three layouts. Knolling is the real one: every item at true relative
   scale, shelf-packed, so a board of a Nalgene and a keychain light
   shows you honestly how those two compare. Grid gives every item the
   same cell, which is a worse photograph and a better catalogue.
   Loadout groups by category with headings.
   ===================================================================== */

const EDCBoard = (function () {

  const W = 1600;                 /* board width in board units */
  const GAP = 26;                 /* space between items */
  const MAXK = 3.2;               /* units per mm, capped so a two-item
                                     board does not render a pen a foot long */
  let seq = 0;                    /* def ids are namespaced per render: two
                                     boards on one page were sharing a
                                     gradient and the first one won */
  const esc = EDCArt.esc;

  /* ---- surfaces. Each is a complete little palette, because a board
     has to carry its own theme rather than inherit the page's. ------- */
  const SURFACES = {
    slate:     { label: 'Slate',      bg: '#2b2f36', bg2: '#1d2026', ink: '#f2f1ee', muted: '#a2a8b2', line: '#3d434c', shadow: 0.45 },
    workbench: { label: 'Workbench',  bg: '#7d5a3c', bg2: '#5e422a', ink: '#f7f1e6', muted: '#d3bba1', line: '#8f6b4a', shadow: 0.4,  grain: 1 },
    kraft:     { label: 'Kraft',      bg: '#c9b391', bg2: '#b39c78', ink: '#2b2318', muted: '#5f5140', line: '#b6a084', shadow: 0.28 },
    blueprint: { label: 'Blueprint',  bg: '#17385c', bg2: '#0f2742', ink: '#e6f0fa', muted: '#8fb4d8', line: '#2c5580', shadow: 0.4, grid: 1 },
    carbon:    { label: 'Carbon',     bg: '#17191d', bg2: '#0d0e11', ink: '#f0efec', muted: '#8d939c', line: '#282c32', shadow: 0.55, weave: 1 },
    canvas:    { label: 'Olive canvas', bg: '#5c6248', bg2: '#464b37', ink: '#f3f2e9', muted: '#c0c4ac', line: '#6d7457', shadow: 0.38, weave: 1 },
    studio:    { label: 'Studio white', bg: '#f2f0ec', bg2: '#e4e1db', ink: '#1b1d21', muted: '#6b7280', line: '#d5d1c9', shadow: 0.18 }
  };

  const surfaceList = () => Object.entries(SURFACES).map(([id, s]) => ({ id, label: s.label }));

  /* ---- helpers ------------------------------------------------------ */
  const fmtMoney = n => '$' + Math.round(n).toLocaleString('en-US');
  const fmtGrams = g => g >= 1000 ? (g / 1000).toFixed(2) + ' kg' : Math.round(g) + ' g';
  const gramsToOz = g => (g / 28.3495);

  function totals(items) {
    const price = items.reduce((a, p) => a + p.price, 0);
    const grams = items.reduce((a, p) => a + p.grams, 0);
    return { price, grams, count: items.length };
  }

  /* Shelf packing. Sort tall first, lay left to right, wrap. Rows get
     centred afterwards so the block does not look left-weighted. */
  function pack(cells, maxW, align) {
    const rows = [];
    let row = { items: [], w: 0, h: 0 };
    cells.forEach(c => {
      if (row.items.length && row.w + c.w + GAP > maxW) { rows.push(row); row = { items: [], w: 0, h: 0 }; }
      c.x = row.w;
      row.w += c.w + GAP;
      row.h = Math.max(row.h, c.h);
      row.items.push(c);
    });
    if (row.items.length) rows.push(row);
    let y = 0;
    rows.forEach(r => {
      r.w -= GAP;
      const off = align === 'left' ? 0 : (maxW - r.w) / 2;
      r.items.forEach(c => { c.x += off; c.y = y + (r.h - c.h); });   /* sit items on the shelf line */
      y += r.h + GAP;
    });
    return { rows, height: Math.max(0, y - GAP) };
  }

  /* A cell is one item plus the space its label needs underneath. */
  function cellFor(p, k, labels) {
    const lab = labels === 'none' ? 0 : (labels === 'full' ? 46 : 26);
    const iw = p.mm[0] * k, ih = p.mm[1] * k;
    return { p, iw, ih, lab, w: Math.max(iw, labels === 'none' ? iw : 96), h: ih + lab };
  }

  /* Choose the scale that fills the board without overflowing it. The
     search is on scale rather than on layout because true relative size
     is the one thing this layout must not compromise. */
  function fitScale(items, maxW, maxH, labels) {
    let lo = 0.05, hi = MAXK;
    if (pack(items.map(p => cellFor(p, MAXK, labels)), maxW).height <= maxH) return MAXK;
    for (let i = 0; i < 34; i++) {
      const mid = (lo + hi) / 2;
      const h = pack(items.map(p => cellFor(p, mid, labels)), maxW).height;
      if (h <= maxH) lo = mid; else hi = mid;
    }
    return lo;
  }

  /* ---- painting ------------------------------------------------------ */
  function defs(s, ns) {
    let d = `<linearGradient id="bg-${ns}" x1="0" y1="0" x2="0.35" y2="1">
      <stop offset="0" stop-color="${s.bg}"/><stop offset="1" stop-color="${s.bg2}"/></linearGradient>
      <filter id="drop-${ns}" x="-30%" y="-30%" width="180%" height="180%">
        <feDropShadow dx="0" dy="5" stdDeviation="5" flood-color="#000000" flood-opacity="${s.shadow}"/>
      </filter>
      <radialGradient id="vig-${ns}" cx="0.5" cy="0.45" r="0.78">
        <stop offset="0.55" stop-color="#000000" stop-opacity="0"/>
        <stop offset="1" stop-color="#000000" stop-opacity="0.3"/></radialGradient>`;
    if (s.grid) d += `<pattern id="tex-${ns}" width="160" height="160" patternUnits="userSpaceOnUse">
      <path d="M160 0H0V160" fill="none" stroke="${s.line}" stroke-width="2.2" opacity="0.85"/>
      <path d="M40 0V160M80 0V160M120 0V160M0 40H160M0 80H160M0 120H160"
        fill="none" stroke="${s.line}" stroke-width="1" opacity="0.45"/></pattern>`;
    if (s.weave) d += `<pattern id="tex-${ns}" width="8" height="8" patternUnits="userSpaceOnUse">
      <path d="M0 0L8 8M8 0L0 8" stroke="${s.line}" stroke-width="1" opacity="0.4"/></pattern>`;
    if (s.grain) d += `<pattern id="tex-${ns}" width="180" height="26" patternUnits="userSpaceOnUse">
      <path d="M0 5Q90 1 180 6M0 15Q90 21 180 14M0 24Q90 19 180 25"
        fill="none" stroke="${s.line}" stroke-width="2" opacity="0.5"/></pattern>`;
    return `<defs>${d}</defs>`;
  }

  function label(c, s, labels, cx, y) {
    if (labels === 'none') return '';
    const p = c.p;
    let t = `<text x="${cx}" y="${y + 17}" text-anchor="middle" font-size="15" font-weight="600"
      fill="${s.ink}" font-family="var(--bf)">${esc(p.name)}</text>`;
    if (labels === 'full') {
      t += `<text x="${cx}" y="${y + 34}" text-anchor="middle" font-size="12.5"
        fill="${s.muted}" font-family="var(--bf)">${esc(p.brand)}</text>`;
      t += `<text x="${cx}" y="${y + 50}" text-anchor="middle" font-size="12.5" font-weight="600"
        fill="${s.muted}" font-family="var(--mf)">${fmtMoney(p.price)} &#183; ${fmtGrams(p.grams)}</text>`;
    }
    return t;
  }

  function item(c, s, labels, ox, oy, ns) {
    const x = ox + c.x + (c.w - c.iw) / 2, y = oy + c.y;
    return `<g class="bi" data-id="${c.p.id}">
      <g filter="url(#drop-${ns})" transform="translate(${x} ${y}) scale(${c.iw / c.p.mm[0]})">${EDCArt.draw(c.p)}</g>
      ${label(c, s, labels, ox + c.x + c.w / 2, y + c.ih + 4)}</g>`;
  }

  function scaleBar(k, s, x, y) {
    const len = 100 * k;                      /* exactly 100 real millimetres */
    return `<g opacity="0.85">
      <line x1="${x}" y1="${y}" x2="${x + len}" y2="${y}" stroke="${s.muted}" stroke-width="2"/>
      <line x1="${x}" y1="${y - 6}" x2="${x}" y2="${y + 6}" stroke="${s.muted}" stroke-width="2"/>
      <line x1="${x + len}" y1="${y - 6}" x2="${x + len}" y2="${y + 6}" stroke="${s.muted}" stroke-width="2"/>
      <text x="${x + len / 2}" y="${y + 22}" text-anchor="middle" font-size="13" fill="${s.muted}"
        font-family="var(--mf)">100 mm &#183; 4 in</text></g>`;
  }

  /* Only these hosts get a recognised icon and a name. Anything else
     that is still http(s) shows as a plain link - see share.js, which
     is where a URL is actually vetted before it reaches here. */
  const PLATFORMS = [
    { re: /(^|\.)instagram\.com$/,  name: 'Instagram', mark: 'ig' },
    { re: /(^|\.)tiktok\.com$/,     name: 'TikTok',    mark: 'tt' },
    { re: /(^|\.)facebook\.com$/,   name: 'Facebook',  mark: 'fb' },
    { re: /(^|\.)youtube\.com$/,    name: 'YouTube',   mark: 'yt' },
    { re: /(^|\.)(x|twitter)\.com$/, name: 'X',        mark: 'x'  },
    { re: /(^|\.)threads\.(net|com)$/, name: 'Threads', mark: 'th' },
    { re: /(^|\.)reddit\.com$/,     name: 'Reddit',    mark: 'rd' }
  ];

  /* The board vets the link itself rather than trusting whoever called
     it. share.js checks a URL on the way in too, but a board rendered
     from any other caller still must not put a javascript: href in the
     document - and "new URL" happily parses one, so the protocol has to
     be checked explicitly. */
  function platformOf(url) {
    let u;
    try { u = new URL(String(url)); } catch (e) { return null; }
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
    const h = u.hostname.toLowerCase().replace(/^www\./, '');
    if (!h || h.indexOf('.') < 0) return null;
    const hit = PLATFORMS.find(p => p.re.test(h));
    return Object.assign({ href: u.href }, hit || { name: h, mark: 'link' });
  }

  /* The little glyphs. Drawn rather than loaded, same as everything
     else on the board, so the SVG stays one file. */
  function mark(kind, x, y, r, col) {
    const g = a => `<g transform="translate(${x} ${y})" fill="none" stroke="${col}"
      stroke-width="${r * 0.16}" stroke-linecap="round" stroke-linejoin="round">${a}</g>`;
    switch (kind) {
      case 'ig': return g(`<rect x="${-r}" y="${-r}" width="${r * 2}" height="${r * 2}" rx="${r * 0.62}"/>
        <circle cx="0" cy="0" r="${r * 0.44}"/><circle cx="${r * 0.55}" cy="${-r * 0.55}" r="${r * 0.08}" fill="${col}"/>`);
      case 'tt': return g(`<path d="M${r * 0.18} ${-r * 0.95} v${r * 1.35} a${r * 0.55} ${r * 0.55} 0 1 1 ${-r * 0.55} ${-r * 0.55}"/>
        <path d="M${r * 0.18} ${-r * 0.95} q${r * 0.2} ${r * 0.5} ${r * 0.72} ${r * 0.56}"/>`);
      case 'fb': return g(`<circle cx="0" cy="0" r="${r}"/>
        <path d="M${r * 0.42} ${-r * 0.5} h${-r * 0.28} q${-r * 0.28} 0 ${-r * 0.28} ${r * 0.3} v${r * 1.2}"/>
        <path d="M${-r * 0.42} ${-r * 0.02} h${r * 0.72}"/>`);
      case 'yt': return g(`<rect x="${-r}" y="${-r * 0.72}" width="${r * 2}" height="${r * 1.44}" rx="${r * 0.44}"/>
        <path d="M${-r * 0.2} ${-r * 0.34} l${r * 0.6} ${r * 0.34} l${-r * 0.6} ${r * 0.34} z" fill="${col}"/>`);
      case 'x':  return g(`<path d="M${-r * 0.72} ${-r * 0.72} L${r * 0.72} ${r * 0.72}"/>
        <path d="M${r * 0.72} ${-r * 0.72} L${-r * 0.72} ${r * 0.72}"/>`);
      case 'th': return g(`<circle cx="0" cy="0" r="${r * 0.9}"/>
        <path d="M${-r * 0.34} ${r * 0.28} q${r * 0.5} ${r * 0.3} ${r * 0.62} ${-r * 0.2}
                 q${r * 0.12} ${-r * 0.5} ${-r * 0.44} ${-r * 0.5}"/>`);
      case 'rd': return g(`<circle cx="0" cy="0" r="${r * 0.9}"/>
        <circle cx="${-r * 0.32}" cy="0" r="${r * 0.1}" fill="${col}"/>
        <circle cx="${r * 0.32}" cy="0" r="${r * 0.1}" fill="${col}"/>
        <path d="M${-r * 0.38} ${r * 0.36} q${r * 0.38} ${r * 0.26} ${r * 0.76} 0"/>`);
      default:   return g(`<path d="M${-r * 0.15} ${r * 0.35} a${r * 0.5} ${r * 0.5} 0 0 1 0 ${-r * 0.7}
        l${r * 0.35} ${-r * 0.35} a${r * 0.5} ${r * 0.5} 0 0 1 ${r * 0.7} ${r * 0.7} l${-r * 0.2} ${r * 0.2}"/>
        <path d="M${r * 0.15} ${-r * 0.35} a${r * 0.5} ${r * 0.5} 0 0 1 0 ${r * 0.7}
        l${-r * 0.35} ${r * 0.35} a${r * 0.5} ${r * 0.5} 0 0 1 ${-r * 0.7} ${-r * 0.7} l${r * 0.2} ${-r * 0.2}"/>`);
    }
  }

  /* ---- the board ------------------------------------------------------ */
  /*  opts: { items, title, owner, url, layout, surface, labels, ruler } */
  function render(opts) {
    const s = SURFACES[opts.surface] || SURFACES.slate;
    const ns = 'b' + (++seq);
    const labels = opts.labels || 'full';
    const items = opts.items || [];
    const t = totals(items);
    const PAD = 64, HEAD = items.length ? 150 : 120, FOOT = 116;
    const innerW = W - PAD * 2;

    let body = '', bodyH = 0, k = 1;

    if (!items.length) {
      bodyH = 220;
      body = `<text x="${W / 2}" y="120" text-anchor="middle" font-size="22" fill="${s.muted}"
        font-family="var(--bf)">Nothing on the board yet. Pick some gear on the Build tab.</text>`;

    } else if (opts.layout === 'grid') {
      /* Even cells. Not true scale - each item is fitted to its box. */
      const cols = Math.min(6, Math.max(3, Math.ceil(Math.sqrt(items.length * 1.35))));
      const cw = (innerW - GAP * (cols - 1)) / cols;
      const lab = labels === 'none' ? 0 : (labels === 'full' ? 46 : 26);
      const ch = cw * 0.72;
      const sorted = items.slice().sort((a, b) => a.cat.localeCompare(b.cat) || a.brand.localeCompare(b.brand));
      sorted.forEach((p, i) => {
        const cx = (i % cols) * (cw + GAP), cy = Math.floor(i / cols) * (ch + lab + GAP);
        const kk = Math.min(cw * 0.82 / p.mm[0], ch * 0.86 / p.mm[1]);
        const iw = p.mm[0] * kk, ih = p.mm[1] * kk;
        body += item({ p, x: cx, y: cy + (ch - ih), iw, ih, w: cw, h: ih + lab }, s, labels, PAD, HEAD, ns);
      });
      bodyH = Math.ceil(sorted.length / cols) * (ch + lab + GAP) - GAP;

    } else if (opts.layout === 'loadout') {
      /* Grouped by category. The label sits in a left gutter rather than
         on a line of its own, because a category holding one item was
         otherwise buying a full-width band to show a single pen in. One
         scale across every group, so the groups stay comparable. */
      const GUT = 200;
      const laneW = innerW - GUT;
      const groups = CATS.map(c => ({ c, list: items.filter(p => p.cat === c.id) })).filter(g => g.list.length);
      k = fitScale(items, laneW, 1400 - groups.length * 34, labels);
      let y = 0;
      groups.forEach((g, i) => {
        const packed = pack(g.list.map(p => cellFor(p, k, labels)), laneW, 'left');
        const bandH = Math.max(packed.height, 54);
        if (i) body += `<line x1="${PAD}" y1="${HEAD + y - 17}" x2="${W - PAD}" y2="${HEAD + y - 17}"
          stroke="${s.line}" stroke-width="1.5" opacity="0.65"/>`;
        body += `<text x="${PAD}" y="${HEAD + y + 16}" font-size="15" font-weight="700"
          letter-spacing="1.6" fill="${s.muted}" font-family="var(--hf)">${esc(g.c.label.toUpperCase())}</text>`;
        body += `<text x="${PAD}" y="${HEAD + y + 36}" font-size="12.5" fill="${s.muted}"
          font-family="var(--mf)" opacity="0.8">${g.list.length} &#183; ${
          fmtMoney(totals(g.list).price)} &#183; ${fmtGrams(totals(g.list).grams)}</text>`;
        packed.rows.forEach(r => r.items.forEach(c => { body += item(c, s, labels, PAD + GUT, HEAD + y, ns); }));
        y += bandH + 46;
      });
      bodyH = Math.max(0, y - 46);

    } else {
      /* Knolling. The default, and the only one that is honest about size. */
      k = fitScale(items, innerW, 1180, labels);
      const packed = pack(items.map(p => cellFor(p, k, labels)), innerW);
      packed.rows.forEach(r => r.items.forEach(c => { body += item(c, s, labels, PAD, HEAD, ns); }));
      bodyH = packed.height;
    }

    const H = HEAD + bodyH + FOOT;

    /* ---- header */
    const title = (opts.title || '').trim() || 'Everyday Carry';
    let head = `<text x="${PAD}" y="72" font-size="46" font-weight="700" letter-spacing="1"
      fill="${s.ink}" font-family="var(--hf)">${esc(title.toUpperCase())}</text>`;
    if (items.length) {
      head += `<text x="${PAD}" y="104" font-size="16" fill="${s.muted}" font-family="var(--bf)">${
        t.count} item${t.count === 1 ? '' : 's'} &#183; ${fmtMoney(t.price)} &#183; ${fmtGrams(t.grams)} (${
        gramsToOz(t.grams).toFixed(1)} oz)</text>`;
      /* the same three figures again, large, on the right */
      const stat = (x, big, small) =>
        `<text x="${x}" y="66" text-anchor="end" font-size="30" font-weight="700" fill="${s.ink}"
           font-family="var(--hf)">${big}</text>
         <text x="${x}" y="88" text-anchor="end" font-size="11.5" letter-spacing="1.4" fill="${s.muted}"
           font-family="var(--bf)">${small}</text>`;
      head += stat(W - PAD, fmtGrams(t.grams), 'TOTAL WEIGHT') + stat(W - PAD - 250, fmtMoney(t.price), 'TOTAL COST');
      head += `<line x1="${PAD}" y1="126" x2="${W - PAD}" y2="126" stroke="${s.line}" stroke-width="2"/>`;
    }

    /* ---- footer: the name and the profile link, which is the point of
       the whole tab and so gets real estate rather than a caption */
    const fy = HEAD + bodyH + 46;
    let foot = `<line x1="${PAD}" y1="${fy - 26}" x2="${W - PAD}" y2="${fy - 26}"
      stroke="${s.line}" stroke-width="2"/>`;
    const owner = (opts.owner || '').trim();
    if (owner) {
      foot += `<text x="${PAD}" y="${fy + 16}" font-size="27" font-weight="700" fill="${s.ink}"
        font-family="var(--hf)">${esc(owner)}</text>`;
    }
    const plat = opts.url ? platformOf(opts.url) : null;
    if (plat) {
      const lx = PAD + (owner ? 0 : 0), ly = fy + (owner ? 44 : 16);
      const handle = plat.href.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '');
      foot += `<a href="${esc(plat.href)}" target="_blank" rel="noopener noreferrer nofollow">
        ${mark(plat.mark, lx + 11, ly - 5, 11, s.ink)}
        <text x="${lx + 30}" y="${ly}" font-size="17" font-weight="600" fill="${s.ink}"
          font-family="var(--bf)" text-decoration="underline">${esc(handle)}</text></a>`;
    }
    if (opts.ruler && items.length && opts.layout !== 'grid') foot += scaleBar(k, s, W - PAD - 100 * k, fy + 6);
    foot += `<text x="${W - PAD}" y="${fy + 44}" text-anchor="end" font-size="12" letter-spacing="1.2"
      fill="${s.muted}" font-family="var(--bf)">BUILT WITH EDC BUILDER</text>`;

    const texture = (s.grid || s.weave || s.grain)
      ? `<rect width="${W}" height="${H}" fill="url(#tex-${ns})"/>` : '';

    /* var(--bf) etc are resolved here, once, so the markup above stays
       readable and the file still has no external dependency. */
    const fonts = {
      '--hf': "'Barlow Condensed','Oswald','Arial Narrow',Helvetica,sans-serif",
      '--bf': "'Helvetica Neue',Helvetica,Arial,sans-serif",
      '--mf': "'SF Mono',Menlo,Consolas,'Courier New',monospace"
    };
    let svg = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"
      viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" class="board" role="img"
      aria-label="${esc(title)} - ${t.count} items, ${fmtMoney(t.price)}, ${fmtGrams(t.grams)}">
      ${defs(s, ns)}<rect width="${W}" height="${H}" fill="url(#bg-${ns})"/>${texture}
      <rect width="${W}" height="${H}" fill="url(#vig-${ns})"/>
      ${head}${body}${foot}</svg>`;
    Object.entries(fonts).forEach(([k2, v]) => { svg = svg.split('var(' + k2 + ')').join(v); });
    return { svg, width: W, height: H, totals: t, scale: k };
  }

  return { render, SURFACES, surfaceList, totals, fmtMoney, fmtGrams, gramsToOz, platformOf, mark, W };
})();
