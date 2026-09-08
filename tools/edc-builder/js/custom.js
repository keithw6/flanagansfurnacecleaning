/* =====================================================================
   EDC Builder - products you add yourself
   ---------------------------------------------------------------------
   Paste the URL of something you found, fill in what it costs and what
   it weighs, and it joins the catalogue.

   Two things the browser genuinely cannot do here, and pretending
   otherwise would just produce a form that lies:

   - It cannot read the product page. A page on another site is not
     fetchable from this one, so price and weight have to be typed. What
     it CAN do is read the URL itself, and a maker's URL almost always
     carries the brand in the hostname and the product in the last path
     segment, so those two are guessed and left editable.
   - It cannot call an image generator. There is no server and no key,
     and a key in a public page is not a key. So art comes from one of
     three places: a file you pick, an image URL, or - by default - the
     drawing generators, which give the thing a stand-in in the house
     style immediately. See brief() for the fourth way.

   Custom products register themselves into PRODUCTS and BY_ID at load,
   so every other module treats them as ordinary catalogue entries and
   none of them needed changing. Their ids carry a "u_" prefix, which is
   what keeps them from ever colliding with a real one.
   ===================================================================== */

const EDCCustom = (function () {

  window.EDC_MEDIA = window.EDC_MEDIA || {};   /* manifest.js normally did this */

  const KEY = 'edc-builder-custom-v1';
  const MAX = 40;                  /* localStorage is small and images are not */
  const IMG_MAX_PX = 600;          /* longest side, before storing */

  /* A custom product with no image still has to sit on the board next
     to the drawn ones, so each category lends it a generator and a
     neutral colourway. A grey stand-in in the right shape beats a
     placeholder box, and it beats an empty space. */
  const STANDIN = {
    knife:   { kind: 'folder',      body: '#8a8f96', scale: '#c3c8ce', clip: 1 },
    multi:   { kind: 'multitool',   body: '#c3c8ce', handle: '#9aa1a9' },
    light:   { kind: 'lightTube',   body: '#7f858c', bezel: '#c3c8ce', clip: 1 },
    pen:     { kind: 'pen',         body: '#9aa1a9', tip: '#7f858c', clip: 1 },
    wallet:  { kind: 'walletCard',  body: '#8a8f96', band: '#5a5f66', metal: 1 },
    watch:   { kind: 'watchDigital', body: '#7f858c', face: '#5c6265', band: '#7f858c' },
    keys:    { kind: 'keyOrg',      body: '#8a8f96', keys: '#c3c8ce' },
    pry:     { kind: 'pry',         body: '#9aa1a9' },
    fire:    { kind: 'lighterBic',  body: '#9aa1a9' },
    tech:    { kind: 'powerBank',   body: '#7f858c', accent: '#9aa1a9' },
    paper:   { kind: 'notebook',    body: '#b6b2a8', band: '#7f7b72' },
    bottle:  { kind: 'bottle',      body: '#8a8f96', cap: '#5a5f66' },
    med:     { kind: 'medPack',     body: '#b6b2a8', accent: '#7f7b72' },
    pouch:   { kind: 'pouch',       body: '#7f858c', zip: '#c3c8ce' },
    eyewear: { kind: 'shades',      body: '#7f858c', lens: '#5c6265' },
    belt:    { kind: 'belt',        body: '#7f858c', buckle: '#c3c8ce' },
    cord:    { kind: 'cordHank',    body: '#8a8f96' },
    nav:     { kind: 'compass',     body: '#7f858c', dial: '#e8e6e1' },
    fidget:  { kind: 'spinner',     body: '#9aa1a9' }
  };

  /* Typical footprints, so nobody has to go and measure something to
     get it onto a board. Editable like everything else. */
  const SIZES = {
    knife: [110, 30], multi: [100, 32], light: [95, 20], pen: [140, 11],
    wallet: [95, 65], watch: [42, 74], keys: [85, 25], pry: [95, 14],
    fire: [70, 24], tech: [100, 55], paper: [89, 140], bottle: [80, 200],
    med: [140, 80], pouch: [180, 120], eyewear: [140, 48], belt: [125, 125],
    cord: [90, 35], nav: [60, 50], fidget: [60, 45]
  };

  let list = [];

  /* ---- reading a URL --------------------------------------------------- */
  /* Not a fetch - just what the string itself gives up, which is more
     than you would think. */
  const TITLE_CASE = s => s.replace(/\b[a-z]/g, c => c.toUpperCase());

  function guess(rawUrl) {
    const url = EDCShare.safeUrl(rawUrl);
    if (!url) return null;
    let u;
    try { u = new URL(url); } catch (e) { return null; }

    /* the brand out of the hostname */
    const host = u.hostname.toLowerCase().replace(/^www\./, '');
    const parts = host.split('.');
    const drop = { co: 1, com: 1, net: 1, org: 1, store: 1, shop: 1, gear: 1, us: 1, uk: 1, ca: 1, eu: 1, de: 1, au: 1 };
    let brand = parts.filter(p => !drop[p]).pop() || parts[0];
    brand = TITLE_CASE(brand.replace(/[-_]+/g, ' ')).trim();

    /* the product out of the last meaningful path segment */
    const segs = u.pathname.split('/').filter(Boolean)
      .filter(s => !/^(products?|p|item|shop|store|collections?|catalog|en|us|gb|dp|gp)$/i.test(s));
    let name = segs.pop() || '';
    name = name.replace(/\.(html?|php|aspx?)$/i, '')
               .replace(/[-_+]+/g, ' ')
               .replace(/\b(b0[a-z0-9]{8,})\b/ig, '')      /* marketplace SKUs */
               .replace(/\s{2,}/g, ' ').trim();
    if (name.length > 48) name = name.slice(0, 48).trim();
    name = TITLE_CASE(name);

    /* a brand repeated in the product name reads badly on a label */
    if (brand && name.toLowerCase().startsWith(brand.toLowerCase() + ' '))
      name = name.slice(brand.length).trim();

    return { url, brand, name, host };
  }

  /* ---- pictures ---------------------------------------------------------
     Anything that ends up as art is re-encoded through a canvas first.
     That downscales it so localStorage can hold it, and it turns a
     remote image into local pixels, which matters more than the size
     does: a remote image taints the export canvas and breaks Download
     PNG, and a local data URI does not. */
  function shrink(src, crossOrigin) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      if (crossOrigin) img.crossOrigin = 'anonymous';
      img.onload = () => {
        const k = Math.min(1, IMG_MAX_PX / Math.max(img.width, img.height));
        const c = document.createElement('canvas');
        c.width = Math.max(1, Math.round(img.width * k));
        c.height = Math.max(1, Math.round(img.height * k));
        try {
          c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
          resolve({ data: c.toDataURL('image/png'), w: img.width, h: img.height });
        } catch (e) {
          reject(new Error('that image is served by a site that will not let this page ' +
            'read it, so it cannot be stored or exported. Download it and pick the file instead.'));
        }
      };
      img.onerror = () => reject(new Error('that image would not load'));
      img.src = src;
    });
  }

  const fromFile = file => new Promise((resolve, reject) => {
    if (!/^image\//.test(file.type)) return reject(new Error('that is not an image file'));
    const r = new FileReader();
    r.onload = () => shrink(String(r.result), false).then(resolve, reject);
    r.onerror = () => reject(new Error('that file would not read'));
    r.readAsDataURL(file);
  });

  const fromUrl = raw => {
    const u = EDCShare.safeUrl(raw);
    return u ? shrink(u, true) : Promise.reject(new Error('that is not a usable image address'));
  };

  /* ---- the records -------------------------------------------------------- */
  function newId() {
    let id;
    do {
      id = 'u_' + Math.random().toString(36).slice(2, 8);
    } while (BY_ID[id]);
    return id;
  }

  const num = (v, min, max, dflt) => {
    const n = parseFloat(v);
    return isFinite(n) && n >= min && n <= max ? n : dflt;
  };

  /* Build a clean record from whatever the form (or a share link, or
     storage) had. Size arrives two ways and both have to be understood:
     the form sends w and h, while a record that has been round-tripped
     through storage or JSON sends the mm pair it was saved as. Reading
     only one of them silently reset every custom product to its
     category default on reload, which is a quiet way to lose work. */
  function make(input) {
    const cat = CAT_BY_ID[input.cat] ? input.cat : 'knife';
    const size = SIZES[cat] || [100, 40];
    const mm = Array.isArray(input.mm) ? input.mm : [];
    const w = input.w != null && input.w !== '' ? input.w : mm[0];
    const h = input.h != null && input.h !== '' ? input.h : mm[1];
    const p = {
      id: input.id && /^u_[a-z0-9]{4,10}$/.test(input.id) ? input.id : newId(),
      name:  (input.name  || 'Untitled').toString().slice(0, 40).trim() || 'Untitled',
      brand: (input.brand || 'Unbranded').toString().slice(0, 28).trim() || 'Unbranded',
      cat: cat,
      price: num(input.price, 0, 100000, 0),
      grams: num(input.grams, 0, 50000, 0),
      mm: [num(w, 3, 2000, size[0]), num(h, 3, 2000, size[1])],
      url: EDCShare.safeUrl(input.url),
      note: (input.note || '').toString().slice(0, 140).trim(),
      tags: ['yours'],
      custom: true,
      img: typeof input.img === 'string' && /^data:image\//.test(input.img) ? input.img : ''
    };
    p.art = Object.assign({}, STANDIN[cat] || STANDIN.knife);
    if (!p.note) p.note = 'Added by you from ' + (p.url ? new URL(p.url).hostname.replace(/^www\./, '') : 'your own notes') + '.';
    return p;
  }

  /* Registering is what makes the rest of the app treat these as normal
     catalogue entries. PRODUCTS and BY_ID are the two things every other
     module reads, so they are the two things kept true. */
  function register(p) {
    if (BY_ID[p.id]) unregister(p.id);
    BY_ID[p.id] = p;
    PRODUCTS.push(p);
    if (p.img) window.EDC_MEDIA[p.id] = p.img;
    return p;
  }
  function unregister(id) {
    const i = PRODUCTS.findIndex(p => p.id === id);
    if (i >= 0) PRODUCTS.splice(i, 1);
    delete BY_ID[id];
    delete window.EDC_MEDIA[id];
  }

  /* ---- storage -------------------------------------------------------------- */
  function persist() {
    try { localStorage.setItem(KEY, JSON.stringify(list)); return true; }
    catch (e) { return false; }        /* quota, or storage switched off */
  }
  function restore() {
    let raw = null;
    try { raw = localStorage.getItem(KEY); } catch (e) { return; }
    if (!raw) return;
    let arr;
    try { arr = JSON.parse(raw); } catch (e) { return; }
    if (!Array.isArray(arr)) return;
    arr.slice(0, MAX).forEach(o => { const p = make(o); list.push(p); register(p); });
  }

  function add(input) {
    if (list.length >= MAX) throw new Error('that is ' + MAX + ' of your own products, which is the limit.');
    const p = make(input);
    list.push(p);
    register(p);
    persist();
    return p;
  }
  function update(id, input) {
    const i = list.findIndex(p => p.id === id);
    if (i < 0) return null;
    const p = make(Object.assign({}, list[i], input, { id: id }));
    list[i] = p;
    register(p);
    persist();
    return p;
  }
  function remove(id) {
    const i = list.findIndex(p => p.id === id);
    if (i < 0) return false;
    list.splice(i, 1);
    unregister(id);
    persist();
    return true;
  }
  const all = () => list.slice();
  const isCustom = id => /^u_/.test(String(id));

  /* Take on custom products that arrived in a share link or a JSON file.
     Anything already here under the same id wins, so importing someone
     else's board never quietly overwrites your own entry. */
  function adopt(defs) {
    (defs || []).forEach(d => {
      if (!d || !isCustom(d.id) || BY_ID[d.id]) return;
      if (list.length >= MAX) return;
      const p = make(d);
      list.push(p);
      register(p);
    });
    persist();
  }

  /* ---- the generation brief ---------------------------------------------------
     The fourth way to get art, and the good one: hand this to an image
     model, put the result in media/, and the product is drawn like
     everything else. The wording is not decorative - square-on, top
     left light, no shadow and no background are exactly the four things
     that decide whether the result sits with the drawings or floats
     over them looking like a sticker. */
  function brief(p) {
    const cat = CAT_BY_ID[p.cat];
    return [
      'Product image of the ' + p.brand + ' ' + p.name + ', a ' + cat.one + '.',
      'One single object, centred, shown square-on from directly above, filling the frame',
      'with a small even margin. Pure white background. Soft even studio light from the',
      'top left, no cast shadow, no reflections, no gradient backdrop.',
      'No props, no hands, no packaging, no text, no logo lettering, no watermark.',
      'Realistic materials and true proportions: the object is about ' +
        p.mm[0] + ' by ' + p.mm[1] + ' millimetres.',
      p.url ? 'Reference: ' + p.url : ''
    ].filter(Boolean).join(' ');
  }

  function briefAll(items) {
    const want = (items || list).filter(p => !p.img);
    if (!want.length) return '';
    return [
      'Generate one image per product below.',
      'For each: generate, then remove the background, then save it as',
      'tools/edc-builder/media/stills/<id>.png and add "<id>": "stills/<id>.png"',
      'to tools/edc-builder/media/manifest.js.',
      '',
      'These are likenesses for a layout board, not photographs of the real',
      'article, and they should be labelled that way wherever they are shown.',
      ''
    ].join('\n') + want.map(p => '--- ' + p.id + ' ---\n' + brief(p)).join('\n\n');
  }

  restore();

  return { add, update, remove, all, adopt, guess, fromFile, fromUrl, make,
           brief, briefAll, isCustom, SIZES, STANDIN, MAX };
})();
