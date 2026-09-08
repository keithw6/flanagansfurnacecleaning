/* =====================================================================
   EDC Builder - real pictures
   ---------------------------------------------------------------------
   Any product can carry a photograph instead of its drawing: catalogue
   entries and your own alike, one store, one code path. Drop files in
   and they are matched to products by filename.

   Three things happen to every image on the way in, and all three are
   what decide whether a photograph sits on the board or floats over it
   looking like a sticker:

   1. THE BACKGROUND COMES OFF. Not by deleting white pixels - that eats
      the highlights on a steel blade and the white face of a watch.
      Instead a flood fill runs inward from the edges, so only
      background connected to the border goes and anything enclosed by
      the object stays. On a dark board surface an untrimmed white
      rectangle is the single worst thing you can put there.
   2. IT IS TRIMMED to what is left. This one is not cosmetic: the board
      fits an image inside the product's real millimetre footprint, so
      a knife centred in a square frame of empty space would be drawn
      at a third of its true size. Trimming makes the image's own edges
      the object's edges, and true scale starts working again.
   3. IT IS RE-ENCODED small, and locally. Small because this lives in
      browser storage, which is measured in low single-digit megabytes.
      Locally because an image left pointing at another site taints the
      export canvas and silently breaks Download PNG.

   For a whole catalogue's worth, browser storage is the wrong home -
   put the files in media/stills/ and run scan-media.mjs. See the README.
   ===================================================================== */

const EDCImages = (function () {

  window.EDC_MEDIA = window.EDC_MEDIA || {};

  const KEY = 'edc-builder-images-v1';
  const MAX_PX = 512;              /* longest side after processing */
  const WORK_PX = 1100;            /* longest side while doing the pixel work */
  const EDGE_TOLERANCE = 26;       /* how far from the corner colour still counts as background */

  let store = {};                  /* id -> data URI, this browser only */

  /* Whatever manifest.js declared is the baseline; stored images sit on
     top of it. Keeping them apart means clearing your own picture
     reveals the repo's again rather than leaving a hole. */
  const baseline = Object.assign({}, window.EDC_MEDIA);

  function apply() {
    Object.keys(window.EDC_MEDIA).forEach(k => { delete window.EDC_MEDIA[k]; });
    Object.assign(window.EDC_MEDIA, baseline, store);
  }

  function persist() {
    try { localStorage.setItem(KEY, JSON.stringify(store)); return true; }
    catch (e) { return false; }
  }
  function restore() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const o = JSON.parse(raw);
        if (o && typeof o === 'object') {
          Object.keys(o).forEach(id => {
            if (typeof o[id] === 'string' && /^data:image\//.test(o[id])) store[id] = o[id];
          });
        }
      }
    } catch (e) { /* storage off, or corrupt: carry on with none */ }
    apply();
  }

  /* ---- the processing ---------------------------------------------- */

  function load(src, crossOrigin) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      if (crossOrigin) img.crossOrigin = 'anonymous';
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('that image would not load'));
      img.src = src;
    });
  }

  /* Flood fill inward from every border pixel, clearing anything close
     enough in colour to the background it started from. Iterative, with
     an explicit stack - a recursive fill blows the call stack on a
     megapixel image. */
  function knockOut(data, w, h, tol) {
    const px = data.data;
    const at = (x, y) => (y * w + x) * 4;

    /* The background colour is whatever the corners agree on. If they
       disagree the picture has no flat backdrop and is left alone. */
    const corners = [[0, 0], [w - 1, 0], [0, h - 1], [w - 1, h - 1]].map(([x, y]) => {
      const i = at(x, y);
      return [px[i], px[i + 1], px[i + 2], px[i + 3]];
    });
    if (corners.some(c => c[3] < 250)) return false;      /* already has alpha - leave it */
    const [br, bg, bb] = corners[0];
    const far = corners.some(c =>
      Math.abs(c[0] - br) > 34 || Math.abs(c[1] - bg) > 34 || Math.abs(c[2] - bb) > 34);
    if (far) return false;

    /* Each pixel is marked the moment it is queued, not when it is
       popped. Marking on pop looks equivalent and is not: every pixel
       then gets queued once per neighbour, the stack grows to millions
       of entries on a megapixel image, and the import hangs. */
    const seen = new Uint8Array(w * h);
    const stack = [];
    const push = (x, y) => {
      if (x < 0 || y < 0 || x >= w || y >= h) return;
      const s = y * w + x;
      if (seen[s]) return;
      seen[s] = 1;
      stack.push(s);
    };
    for (let x = 0; x < w; x++) { push(x, 0); push(x, h - 1); }
    for (let y = 0; y < h; y++) { push(0, y); push(w - 1, y); }

    const close = i =>
      Math.abs(px[i] - br) <= tol && Math.abs(px[i + 1] - bg) <= tol && Math.abs(px[i + 2] - bb) <= tol;

    while (stack.length) {
      const s = stack.pop();
      const i = s * 4;
      if (!close(i)) continue;              /* a wall: marked, never expanded */
      px[i + 3] = 0;
      const x = s % w, y = (s - x) / w;
      push(x + 1, y); push(x - 1, y); push(x, y + 1); push(x, y - 1);
    }

    /* Soften the cut by one pixel so the edge is not a staircase. */
    const copy = new Uint8ClampedArray(px);
    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        const i = (y * w + x) * 4;
        if (copy[i + 3] === 0) continue;
        let clear = 0;
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            if (copy[((y + dy) * w + (x + dx)) * 4 + 3] === 0) clear++;
          }
        }
        if (clear) px[i + 3] = Math.round(copy[i + 3] * (1 - clear / 12));
      }
    }
    return true;
  }

  function bbox(data, w, h) {
    const px = data.data;
    let x0 = w, y0 = h, x1 = -1, y1 = -1;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        if (px[(y * w + x) * 4 + 3] > 16) {
          if (x < x0) x0 = x;
          if (x > x1) x1 = x;
          if (y < y0) y0 = y;
          if (y > y1) y1 = y;
        }
      }
    }
    return x1 < 0 ? null : { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
  }

  /* WebP with alpha is a fraction of the PNG, and browser storage is
     small enough that the difference decides how many pictures fit. */
  function encode(canvas) {
    const webp = canvas.toDataURL('image/webp', 0.88);
    if (webp.indexOf('data:image/webp') === 0) return webp;
    return canvas.toDataURL('image/png');
  }

  /* opts: { knockout, trim } - both default on */
  function process(src, opts, crossOrigin) {
    const o = opts || {};
    const wantKnock = o.knockout !== false;
    const wantTrim = o.trim !== false;

    return load(src, crossOrigin).then(img => {
      const shrink = Math.min(1, WORK_PX / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.max(1, Math.round(img.width * shrink));
      c.height = Math.max(1, Math.round(img.height * shrink));
      const ctx = c.getContext('2d', { willReadFrequently: true });
      ctx.drawImage(img, 0, 0, c.width, c.height);

      let data;
      try { data = ctx.getImageData(0, 0, c.width, c.height); }
      catch (e) {
        throw new Error('that image is served by a site that will not let this page read it. ' +
          'Download it and pick the file instead.');
      }

      const knocked = wantKnock ? knockOut(data, c.width, c.height, EDGE_TOLERANCE) : false;
      ctx.putImageData(data, 0, 0);

      let box = wantTrim ? bbox(data, c.width, c.height) : null;
      if (!box) box = { x: 0, y: 0, w: c.width, h: c.height };

      const k = Math.min(1, MAX_PX / Math.max(box.w, box.h));
      const out = document.createElement('canvas');
      out.width = Math.max(1, Math.round(box.w * k));
      out.height = Math.max(1, Math.round(box.h * k));
      out.getContext('2d').drawImage(c, box.x, box.y, box.w, box.h,
        0, 0, out.width, out.height);

      return {
        data: encode(out),
        srcW: img.width, srcH: img.height,
        outW: out.width, outH: out.height,
        knockedOut: knocked,
        trimmed: box.w !== c.width || box.h !== c.height
      };
    });
  }

  const fromFile = (file, opts) => new Promise((resolve, reject) => {
    if (!/^image\//.test(file.type)) return reject(new Error('that is not an image file'));
    const r = new FileReader();
    r.onload = () => process(String(r.result), opts, false).then(resolve, reject);
    r.onerror = () => reject(new Error('that file would not read'));
    r.readAsDataURL(file);
  });

  const fromUrl = (raw, opts) => {
    const u = EDCShare.safeUrl(raw);
    return u ? process(u, opts, true)
             : Promise.reject(new Error('that is not a usable image address'));
  };

  /* ---- matching a filename to a product ------------------------------
     Either the product id outright, or a slug of brand and name, which
     is what a folder of files someone named by hand looks like. */
  const slug = s => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '');

  function match(filename) {
    const base = String(filename).replace(/\.[a-z0-9]+$/i, '');
    if (BY_ID[base]) return base;
    const want = slug(base);
    if (!want) return null;

    let hit = PRODUCTS.find(p => slug(p.id) === want);
    if (hit) return hit.id;
    hit = PRODUCTS.find(p => slug(p.brand + p.name) === want || slug(p.name) === want);
    if (hit) return hit.id;

    /* A file that came off a camera or a download folder is rarely named
       exactly: "photo-bm535.png", "IMG_2931 benchmade bugout 535.png".
       Split on the separators and look for a product id sitting in there
       as its own word - precise, where matching an id as a bare
       substring would pair "u_ab12" with anything containing it. */
    const words = base.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
    hit = PRODUCTS.find(p => words.indexOf(p.id.toLowerCase()) >= 0);
    if (hit) return hit.id;

    /* last resort: the brand and name run together somewhere in the name */
    hit = PRODUCTS.find(p => {
      const sl = slug(p.brand + p.name);
      return sl.length > 6 && want.indexOf(sl) >= 0;
    });
    return hit ? hit.id : null;
  }

  /* ---- the store ------------------------------------------------------ */
  function set(id, dataUri) {
    if (!BY_ID[id] || !/^data:image\//.test(dataUri)) return false;
    store[id] = dataUri;
    apply();
    if (!persist()) {
      delete store[id];
      apply();
      throw new Error('this browser will not hold any more pictures. Put the files in ' +
        'media/stills/ instead — that has no limit and everyone you share with sees them.');
    }
    return true;
  }
  function clear(id) {
    if (!(id in store)) return false;
    delete store[id];
    apply();
    persist();
    return true;
  }
  function clearAll() { store = {}; apply(); persist(); }
  const get = id => store[id] || null;
  const has = id => !!(store[id] || baseline[id]);
  const isMine = id => !!store[id];
  const count = () => Object.keys(store).length;
  const ids = () => Object.keys(store);

  /* Roughly how much of the browser's allowance is gone. Reported rather
     than enforced: the real limit only shows up when a write fails. */
  function bytes() {
    return Object.keys(store).reduce((n, k) => n + store[k].length, 0);
  }

  /* Everything held here, written out as the manifest file the repo
     wants. Pictures are inlined as data URIs rather than shipped as a
     folder of files, which makes this one artefact to commit instead of
     a hundred, and means the pictures are already cut out and trimmed -
     dropping raw images into media/stills/ gives you white squares with
     a small object marooned in the middle, which is exactly what the
     import here exists to prevent. */
  function toManifest() {
    const entries = Object.keys(store).sort()
      .map(id => '  ' + JSON.stringify(id) + ': ' + JSON.stringify(store[id]));
    return '/* =====================================================================\n' +
      '   EDC Builder - the media library\n' +
      '   ---------------------------------------------------------------------\n' +
      '   Written by the app\'s picture panel. Every image below is already\n' +
      '   cut out and trimmed to the object, which is what lets the board draw\n' +
      '   it at the product\'s real size.\n\n' +
      '   Put this at tools/edc-builder/media/manifest.js and the pictures are\n' +
      '   permanent: they survive a cleared browser and everyone you share a\n' +
      '   board with sees them.\n\n' +
      '   ' + Object.keys(store).length + ' picture(s), written ' +
      new Date().toISOString().slice(0, 10) + '.\n' +
      '   ===================================================================== */\n' +
      'window.EDC_MEDIA = {' + (entries.length ? '\n' + entries.join(',\n') + '\n' : '') + '};\n';
  }

  restore();

  return { process, fromFile, fromUrl, match, set, get, clear, clearAll,
           has, isMine, count, ids, bytes, toManifest, MAX_PX };
})();
