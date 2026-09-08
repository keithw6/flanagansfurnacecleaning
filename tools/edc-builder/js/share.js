/* =====================================================================
   EDC Builder - saving, sharing and export
   ---------------------------------------------------------------------
   There is no server, so a shared board has to travel inside its own
   URL. The whole pack packs down to a pipe-delimited record, base64url
   encoded, and lives in the fragment - the fragment specifically, so it
   is never sent to whatever is hosting the file.

   Everything coming back the other way is treated as hostile. A link
   someone pastes you is a string a stranger wrote, and it ends up in an
   href on the board and in text on the page, so: ids are looked up
   rather than trusted, the layout and surface names are checked against
   the known sets, free text is stripped of control characters and
   length-clamped, and a URL has to be http or https before it is
   allowed anywhere near the document.
   ===================================================================== */

const EDCShare = (function () {

  const VERSION = '1';
  const MAX_ITEMS = 60;
  const LIMITS = { title: 48, owner: 40, url: 200 };
  const LAYOUTS = ['knoll', 'grid', 'loadout'];
  const LABELS = ['full', 'name', 'none'];
  const STORE_KEY = 'edc-builder-pack-v1';

  /* ---- base64url, over UTF-8 ---------------------------------------- */
  function b64e(str) {
    const bytes = new TextEncoder().encode(str);
    let bin = '';
    bytes.forEach(b => { bin += String.fromCharCode(b); });
    return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }
  function b64d(str) {
    const b = str.replace(/-/g, '+').replace(/_/g, '/');
    const bin = atob(b + '==='.slice(0, (4 - b.length % 4) % 4));
    const bytes = Uint8Array.from(bin, c => c.charCodeAt(0));
    return new TextDecoder().decode(bytes);
  }

  /* ---- the one place a URL is judged ---------------------------------- */
  function safeUrl(raw) {
    const v = String(raw || '').trim();
    if (!v) return '';
    let u;
    try { u = new URL(v.includes('://') ? v : 'https://' + v); } catch (e) { return ''; }
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return '';
    if (!u.hostname || u.hostname.indexOf('.') < 0) return '';
    const out = u.href;
    return out.length > LIMITS.url ? '' : out;
  }

  /* Control characters out, then length. Both matter: the first stops a
     newline breaking a label, the second stops a pasted essay. */
  const clamp = (v, n) => String(v == null ? '' : v)
    .replace(/[\x00-\x1f\x7f]/g, '').trim().slice(0, n);
  const pick = (v, allowed) => allowed.indexOf(v) >= 0 ? v : allowed[0];
  const knownSurface = v => Object.prototype.hasOwnProperty.call(EDCBoard.SURFACES, v) ? v : 'slate';

  /* ---- state in and out ------------------------------------------------ */
  function encode(st) {
    const f = [
      VERSION,
      pick(st.layout, LAYOUTS),
      knownSurface(st.surface),
      pick(st.labels, LABELS),
      st.ruler ? '1' : '0',
      encodeURIComponent(clamp(st.title, LIMITS.title)),
      encodeURIComponent(clamp(st.owner, LIMITS.owner)),
      encodeURIComponent(safeUrl(st.url)),
      (st.items || []).slice(0, MAX_ITEMS).join(',')
    ];
    return b64e(f.join('|'));
  }

  function decode(code) {
    let f;
    try { f = b64d(String(code)).split('|'); } catch (e) { return null; }
    if (f.length < 9 || f[0] !== VERSION) return null;
    const seen = new Set();
    const ids = (f[8] || '').split(',')
      .filter(id => BY_ID[id] && !seen.has(id) && seen.add(id))   /* unknown ids just vanish */
      .slice(0, MAX_ITEMS);
    return {
      layout:  pick(f[1], LAYOUTS),
      surface: knownSurface(f[2]),
      labels:  pick(f[3], LABELS),
      ruler:   f[4] === '1',
      title:   clamp(dec(f[5]), LIMITS.title),
      owner:   clamp(dec(f[6]), LIMITS.owner),
      url:     safeUrl(dec(f[7])),
      items:   ids
    };
  }
  function dec(v) { try { return decodeURIComponent(v || ''); } catch (e) { return ''; } }

  function linkFor(st) {
    return location.href.split('#')[0] + '#b=' + encode(st);
  }
  function fromLocation() {
    const m = /[#&]b=([A-Za-z0-9\-_]+)/.exec(location.hash || '');
    return m ? decode(m[1]) : null;
  }

  /* ---- this browser only ------------------------------------------------ */
  function save(st) {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(st)); return true; }
    catch (e) { return false; }                    /* private mode, blocked storage */
  }
  function load() {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      if (!raw) return null;
      return decode(encode(JSON.parse(raw)));      /* round-trip so it is vetted like a link */
    } catch (e) { return null; }
  }

  function toJSON(st) {
    const items = st.items.map(id => BY_ID[id]).filter(Boolean);
    return JSON.stringify({
      app: 'EDC Builder', version: 1,
      board: { title: st.title, owner: st.owner, url: st.url, layout: st.layout,
               surface: st.surface, labels: st.labels, ruler: !!st.ruler },
      totals: EDCBoard.totals(items),
      items: items.map(p => ({ id: p.id, brand: p.brand, name: p.name, category: p.cat,
                               priceUsd: p.price, weightGrams: p.grams, url: p.url }))
    }, null, 2);
  }

  function fromJSON(text) {
    let o;
    try { o = JSON.parse(text); } catch (e) { return null; }
    const b = (o && o.board) || {};
    return decode(encode({
      layout: b.layout, surface: b.surface, labels: b.labels, ruler: !!b.ruler,
      title: b.title, owner: b.owner, url: b.url,
      items: Array.isArray(o && o.items) ? o.items.map(i => i && i.id).filter(Boolean) : []
    }));
  }

  /* ---- PNG ----------------------------------------------------------------
     The board is one SVG with no external references, so it rasterises in
     the page. The one thing that breaks it is a media override pointing at
     a remote image: that taints the canvas and the export throws, which is
     caught and reported rather than failing silently. */
  function toPNG(svgText, w, h, scale) {
    return new Promise((resolve, reject) => {
      const k = scale || 2;
      const blob = new Blob([svgText], { type: 'image/svg+xml;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const img = new Image();
      img.onload = () => {
        try {
          const c = document.createElement('canvas');
          c.width = Math.round(w * k); c.height = Math.round(h * k);
          c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
          URL.revokeObjectURL(url);
          c.toBlob(b => b ? resolve(b) : reject(new Error('the browser would not encode the image')), 'image/png');
        } catch (e) {
          URL.revokeObjectURL(url);
          reject(new Error('the board could not be exported, usually because an image ' +
            'override points at another site: ' + e.message));
        }
      };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('the board could not be drawn')); };
      img.src = url;
    });
  }

  function download(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  }

  function slug(s, fallback) {
    const v = String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    return v || fallback;
  }

  return { encode, decode, linkFor, fromLocation, save, load, toJSON, fromJSON,
           toPNG, download, safeUrl, slug, LIMITS, MAX_ITEMS, LAYOUTS, LABELS };
})();
