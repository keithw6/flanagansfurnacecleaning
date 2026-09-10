/* =====================================================================
   EDC Builder - the app
   ---------------------------------------------------------------------
   State is one object and every view is a pure function of it. Change
   the state, call render, done. With a catalogue this small that is
   both fast enough and much easier to reason about than keeping four
   tabs individually in sync.

   Nothing here writes user text into innerHTML. Names, board titles and
   links arrive from share URLs written by other people, so they go in
   through textContent, or through the escaper on their way into the
   board's SVG.
   ===================================================================== */
(function () {

  const $  = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const money = EDCBoard.fmtMoney, grams = EDCBoard.fmtGrams;

  /* ---- state ---------------------------------------------------------- */
  const state = {
    items: [], title: '', owner: '', url: '',
    layout: 'knoll', surface: 'slate', labels: 'full', ruler: false
  };
  const ui = { cats: new Set(), search: '', sort: 'cat' };

  const picked = () => state.items.map(id => BY_ID[id]).filter(Boolean);
  const has = id => state.items.indexOf(id) >= 0;

  function setState(next) {
    Object.assign(state, next);
    renderAll();
  }

  /* ---- tabs and theme -------------------------------------------------- */
  function showTab(name) {
    $$('.tab').forEach(t => t.setAttribute('aria-selected', String(t.dataset.panel === name)));
    $$('.panel').forEach(p => p.classList.toggle('on', p.id === 'panel-' + name));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  $$('.tab').forEach(t => t.addEventListener('click', () => showTab(t.dataset.panel)));

  $('#themeBtn').addEventListener('click', () => {
    const cur = document.documentElement.getAttribute('data-theme');
    const dark = cur ? cur === 'dark'
      : matchMedia('(prefers-color-scheme: dark)').matches;
    document.documentElement.setAttribute('data-theme', dark ? 'light' : 'dark');
  });

  /* ---- the catalogue --------------------------------------------------- */
  function matches(p) {
    if (ui.cats.size && !ui.cats.has(p.cat)) return false;
    const q = ui.search.trim().toLowerCase();
    if (!q) return true;
    return (p.name + ' ' + p.brand + ' ' + p.note + ' ' + p.tags.join(' ') + ' ' +
      CAT_BY_ID[p.cat].label).toLowerCase().includes(q);
  }

  const SORTS = {
    cat:         (a, b) => CATS.findIndex(c => c.id === a.cat) - CATS.findIndex(c => c.id === b.cat) ||
                           a.brand.localeCompare(b.brand) || a.name.localeCompare(b.name),
    priceUp:     (a, b) => a.price - b.price,
    priceDown:   (a, b) => b.price - a.price,
    weightUp:    (a, b) => a.grams - b.grams,
    weightDown:  (a, b) => b.grams - a.grams,
    name:        (a, b) => (a.brand + a.name).localeCompare(b.brand + b.name)
  };

  function card(p) {
    const el = document.createElement('article');
    el.className = 'gear' + (has(p.id) ? ' in' : '');
    el.dataset.id = p.id;
    el.innerHTML =
      `<div class="gear-art">${EDCArt.thumb(p, 260, 150)}</div>
       <div class="gear-body">
         <p class="gear-brand"></p><h4 class="gear-name"></h4>
         <p class="gear-note"></p>
         <p class="gear-spec"><span class="k-price"></span><span class="dot">&#183;</span>
            <span class="k-weight"></span><span class="dot">&#183;</span>
            <span class="k-size"></span></p>
       </div>
       <div class="gear-acts">
         <button class="btn btn-sm add" type="button"></button>
         <button class="btn btn-o btn-sm pic" type="button">Photo</button>
         <a class="find" target="_blank" rel="noopener noreferrer nofollow">Find one &#8599;</a>
         <a class="mk" target="_blank" rel="noopener noreferrer nofollow">Maker &#8599;</a>
       </div>`;
    $('.gear-brand', el).textContent = p.brand;
    $('.gear-name', el).textContent = p.name;
    $('.gear-note', el).textContent = p.note;
    $('.k-price', el).textContent = money(p.price);
    $('.k-weight', el).textContent = grams(p.grams);
    $('.k-size', el).textContent = p.mm[0] + ' × ' + p.mm[1] + ' mm';
    $('.add', el).textContent = has(p.id) ? 'Remove' : 'Add';
    if (p.url) {
      $('.mk', el).href = p.url;
      $('.mk', el).title = 'Open ' + p.brand + '’s site in a new tab';
    } else {
      $('.mk', el).remove();
    }
    const mine = EDCImages.isMine(p.id);
    if (mine) $('.pic', el).textContent = 'Remove photo';
    $('.find', el).href = photoSearch(p);
    $('.find', el).title = 'Search the web for a photo of this, then copy it and paste it in';
    if (mine) $('.find', el).remove();
    if (p.custom || mine) {
      const tag = document.createElement('span');
      tag.className = 'yours';
      tag.textContent = p.custom
        ? (mine ? 'yours · photo' : 'yours · stand-in art')
        : 'photo';
      tag.title = mine
        ? 'Using a picture you supplied, cut out and trimmed to the object.'
        : 'Your own entry. No picture yet, so it is drawn in the house style at the size you set.';
      $('.gear-art', el).appendChild(tag);
    }
    return el;
  }

  function renderCatalog() {
    const list = PRODUCTS.filter(matches).sort(SORTS[ui.sort] || SORTS.cat);
    const wrap = $('#catalog');
    wrap.textContent = '';
    $('#catalogEmpty').hidden = list.length > 0;
    $('#resultCount').textContent = list.length === PRODUCTS.length
      ? PRODUCTS.length + ' items across ' + CATS.length + ' categories'
      : list.length + ' of ' + PRODUCTS.length + ' items';

    if (ui.sort === 'cat') {
      CATS.forEach(c => {
        const inCat = list.filter(p => p.cat === c.id);
        if (!inCat.length) return;
        const sec = document.createElement('section');
        sec.className = 'catsec';
        const h = document.createElement('h3');
        h.textContent = c.label;
        const b = document.createElement('span');
        b.className = 'catblurb';
        b.textContent = c.blurb;
        h.appendChild(b);
        sec.appendChild(h);
        const grid = document.createElement('div');
        grid.className = 'grid-gear';
        inCat.forEach(p => grid.appendChild(card(p)));
        sec.appendChild(grid);
        wrap.appendChild(sec);
      });
    } else {
      const grid = document.createElement('div');
      grid.className = 'grid-gear';
      list.forEach(p => grid.appendChild(card(p)));
      wrap.appendChild(grid);
    }
  }

  $('#catalog').addEventListener('click', e => {
    const card = e.target.closest('.gear');
    if (!card) return;
    if (e.target.closest('.add')) return toggle(card.dataset.id);
    if (e.target.closest('.pic')) return photoFor(card.dataset.id);
  });

  /* One file input, retargeted, rather than 109 of them in the DOM. */
  const oneFile = document.createElement('input');
  oneFile.type = 'file';
  oneFile.accept = 'image/*';
  oneFile.hidden = true;
  document.body.appendChild(oneFile);

  function photoFor(id, replace) {
    if (EDCImages.isMine(id) && !replace) {
      EDCImages.clear(id);
      renderAll();
      return;
    }
    oneFile.value = '';
    oneFile.dataset.target = id;
    oneFile.click();
  }
  oneFile.addEventListener('change', () => {
    const f = oneFile.files && oneFile.files[0];
    const id = oneFile.dataset.target;
    if (!f || !BY_ID[id]) return;
    EDCImages.fromFile(f, picOpts())
      .then(res => {
        EDCImages.set(id, res.data);
        say($('#picsMsg'), 'Added a picture to ' + BY_ID[id].brand + ' ' + BY_ID[id].name + '. ' +
          describe(res));
        renderAll();
      })
      .catch(err => say($('#picsMsg'), 'Could not use that: ' + err.message, true));
  });

  function toggle(id) {
    if (!BY_ID[id]) return;
    state.items = has(id) ? state.items.filter(x => x !== id) : state.items.concat(id);
    renderAll();
  }

  /* ---- filters --------------------------------------------------------- */
  function renderChips() {
    const box = $('#catChips');
    box.textContent = '';
    CATS.forEach(c => {
      const n = PRODUCTS.filter(p => p.cat === c.id).length;
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'chip' + (ui.cats.has(c.id) ? ' on' : '');
      b.setAttribute('aria-pressed', String(ui.cats.has(c.id)));
      b.textContent = c.label;
      const s = document.createElement('span');
      s.textContent = n;
      b.appendChild(s);
      b.addEventListener('click', () => {
        ui.cats.has(c.id) ? ui.cats.delete(c.id) : ui.cats.add(c.id);
        renderChips(); renderCatalog();
      });
      box.appendChild(b);
    });
  }

  let searchTimer;
  $('#search').addEventListener('input', e => {
    clearTimeout(searchTimer);
    const v = e.target.value;
    searchTimer = setTimeout(() => { ui.search = v; renderCatalog(); }, 120);
  });
  $('#sortBy').addEventListener('change', e => { ui.sort = e.target.value; renderCatalog(); });
  $('#clearFilters').addEventListener('click', () => {
    ui.cats.clear(); ui.search = ''; ui.sort = 'cat';
    $('#search').value = ''; $('#sortBy').value = 'cat';
    renderChips(); renderCatalog();
  });

  /* ---- adding your own -------------------------------------------------- */
  const np = {
    url: $('#npUrl'), brand: $('#npBrand'), name: $('#npName'), cat: $('#npCat'),
    price: $('#npPrice'), grams: $('#npGrams'), w: $('#npW'), h: $('#npH'),
    note: $('#npNote'), msg: $('#npMsg'), prev: $('#npPrev')
  };
  let npImage = '';          /* the data URI, once a picture has been accepted */

  CATS.forEach(c => {
    const o = document.createElement('option');
    o.value = c.id; o.textContent = c.label;
    np.cat.appendChild(o);
  });

  function npSizeDefaults() {
    const d = EDCCustom.SIZES[np.cat.value] || [100, 40];
    np.w.placeholder = d[0]; np.h.placeholder = d[1];
  }
  np.cat.addEventListener('change', npSizeDefaults);
  npSizeDefaults();

  function say(el, text, bad) {
    el.className = 'hint' + (bad ? ' warn' : '');
    el.textContent = text;
  }

  $('#npRead').addEventListener('click', () => {
    const g = EDCCustom.guess(np.url.value);
    if (!g) return say($('#npUrlMsg'), 'That is not a web address this can read. It needs to look like https://maker.com/…', true);
    if (g.brand && !np.brand.value.trim()) np.brand.value = g.brand;
    if (g.name && !np.name.value.trim()) np.name.value = g.name;
    np.url.value = g.url;
    say($('#npUrlMsg'), 'Read ' + g.host + '. Check the brand and name, then fill in the cost and weight — ' +
      'those are on the page, which this cannot open.');
  });

  /* picture source */
  $$('input[name="npPic"]').forEach(r => r.addEventListener('change', () => {
    const v = $$('input[name="npPic"]').find(x => x.checked).value;
    $('#npPicFile').hidden = v !== 'file';
    $('#npPicUrl').hidden = v !== 'url';
    if (v === 'none') { npImage = ''; np.prev.hidden = true; np.prev.textContent = ''; }
  }));

  function tookPicture(res) {
    npImage = res.data;
    np.prev.hidden = false;
    np.prev.textContent = '';
    const i = new Image();
    i.src = npImage;
    np.prev.appendChild(i);
    say($('#npPicMsg'), 'Picture accepted, ' + res.w + '×' + res.h + ' and stored at a smaller size. ' +
      'It is held in this browser, so exporting the board still works.');
  }
  function pictureFailed(err) {
    npImage = '';
    np.prev.hidden = true;
    say($('#npPicMsg'), 'Could not use that: ' + err.message, true);
  }
  $('#npFile').addEventListener('change', e => {
    const f = e.target.files && e.target.files[0];
    if (f) EDCCustom.fromFile(f).then(tookPicture, pictureFailed);
  });
  $('#npFetch').addEventListener('click', () => {
    say($('#npPicMsg'), 'Loading…');
    EDCCustom.fromUrl($('#npImgUrl').value).then(tookPicture, pictureFailed);
  });

  function npReset() {
    [np.url, np.brand, np.name, np.price, np.grams, np.w, np.h, np.note, $('#npImgUrl')]
      .forEach(el => { el.value = ''; });
    $('#npFile').value = '';
    $$('input[name="npPic"]').forEach(r => { r.checked = r.value === 'none'; });
    $('#npPicFile').hidden = true; $('#npPicUrl').hidden = true;
    npImage = ''; np.prev.hidden = true; np.prev.textContent = '';
    np.msg.textContent = '';
    $('#npAdd').textContent = 'Add to the catalogue';
    delete $('#npAdd').dataset.editing;
  }
  $('#npClear').addEventListener('click', npReset);

  $('#npAdd').addEventListener('click', () => {
    if (!np.name.value.trim() && !np.url.value.trim())
      return say(np.msg, 'It needs at least a name or a link.', true);
    const input = {
      url: np.url.value, brand: np.brand.value, name: np.name.value, cat: np.cat.value,
      price: np.price.value, grams: np.grams.value,
      w: np.w.value || np.w.placeholder, h: np.h.value || np.h.placeholder,
      note: np.note.value, img: npImage
    };
    const editing = $('#npAdd').dataset.editing;
    try {
      const p = editing ? EDCCustom.update(editing, input) : EDCCustom.add(input);
      if (!p) return say(np.msg, 'That product is no longer here to edit.', true);
      if (!editing && !has(p.id)) state.items = state.items.concat(p.id);
      npReset();
      say(np.msg, (editing ? 'Updated ' : 'Added ') + p.brand + ' ' + p.name + '.');
      renderAll();
    } catch (err) { say(np.msg, err.message, true); }
  });

  function editCustom(p) {
    np.url.value = p.url; np.brand.value = p.brand; np.name.value = p.name;
    np.cat.value = p.cat; np.price.value = p.price; np.grams.value = p.grams;
    np.w.value = p.mm[0]; np.h.value = p.mm[1]; np.note.value = p.note;
    npImage = p.img || '';
    np.prev.hidden = !npImage;
    np.prev.textContent = '';
    if (npImage) { const i = new Image(); i.src = npImage; np.prev.appendChild(i); }
    $$('input[name="npPic"]').forEach(r => { r.checked = r.value === (npImage ? 'file' : 'none'); });
    $('#npPicFile').hidden = !npImage;
    $('#npAdd').textContent = 'Save the changes';
    $('#npAdd').dataset.editing = p.id;
    $('#addCard').open = true;
    $('#addCard').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function renderMine() {
    const mine = EDCCustom.all();
    $('#mineCard').hidden = !mine.length;
    const ul = $('#mineList');
    ul.textContent = '';
    mine.forEach(p => {
      const li = document.createElement('li');
      li.innerHTML = `<span class="pk-art">${EDCArt.thumb(p, 52, 34)}</span>
        <span class="pk-txt"><b></b><small></small></span>
        <span class="mine-acts">
          <button class="btn btn-o btn-sm ed" type="button">Edit</button>
          <button class="btn btn-o btn-sm rm" type="button">Delete</button></span>`;
      $('b', li).textContent = p.brand + ' ' + p.name;
      $('small', li).textContent = CAT_BY_ID[p.cat].label + ' · ' + money(p.price) + ' · ' +
        grams(p.grams) + ' · ' + (p.img ? 'your picture' : 'stand-in art');
      $('.ed', li).addEventListener('click', () => editCustom(p));
      $('.rm', li).addEventListener('click', () => {
        if (!confirm('Delete ' + p.brand + ' ' + p.name + '? This cannot be undone.')) return;
        EDCCustom.remove(p.id);
        state.items = state.items.filter(x => x !== p.id);
        renderAll();
      });
      ul.appendChild(li);
    });
  }

  $('#briefBtn').addEventListener('click', () => {
    const text = EDCCustom.briefAll();
    if (!text) return say(np.msg, 'Every one of your products already has a picture.', false);
    $('#briefBox').hidden = false;
    $('#briefText').value = text;
  });
  $('#briefCopy').addEventListener('click', () => {
    $('#briefText').select();
    if (navigator.clipboard) navigator.clipboard.writeText($('#briefText').value).catch(() => {});
  });

  /* ---- pictures ---------------------------------------------------------- */
  const picOpts = () => ({ knockout: $('#optKnock').checked, trim: $('#optTrim').checked });

  function describe(res) {
    const bits = [res.srcW + '×' + res.srcH + ' in, ' + res.outW + '×' + res.outH + ' out'];
    if (res.knockedOut) bits.push('background removed');
    if (res.trimmed) bits.push('trimmed to the object');
    let out = bits.join(' · ') + '.';
    if (res.busyBackground) {
      out += ' Careful: that photo has no plain backdrop, so nothing could be cut away — ' +
        'it will show as a rectangle on the board. A shot on plain white works far better.';
    }
    return out;
  }

  /* Somewhere to go and get one. The maker's own page is already linked from
     every card; this is the other half — an image search for the exact
     product, biased toward the studio shots that cut out cleanly. */
  function photoSearch(p) {
    return 'https://www.google.com/search?tbm=isch&q=' +
      encodeURIComponent('"' + p.brand + ' ' + p.name + '" product photo white background');
  }

  function picsCount() {
    const n = EDCImages.count();
    const kb = Math.round(EDCImages.bytes() / 1024);
    $('#picsCount').textContent = n
      ? n + (n === 1 ? ' picture' : ' pictures') + ' in this browser, about ' + kb + ' kB'
      : 'No pictures of your own yet.';
  }

  /* Files come in one at a time rather than all at once: a hundred
     canvases in flight is how a tab runs out of memory, and a sequential
     run can also stop the moment storage says no. */
  function takeFiles(files) {
    const list = Array.from(files).filter(f => /^image\//.test(f.type));
    if (!list.length) return say($('#picsMsg'), 'No image files in that.', true);
    const opts = picOpts();
    const done = [], missed = [], failed = [];
    let i = 0;

    say($('#picsMsg'), 'Working through ' + list.length + ' file' + (list.length === 1 ? '' : 's') + '…');

    (function next() {
      if (i >= list.length) {
        renderAll();
        const parts = [];
        if (done.length) parts.push(done.length + ' matched and added');
        if (missed.length) parts.push(missed.length + ' with no product to match: ' +
          missed.slice(0, 4).join(', ') + (missed.length > 4 ? '…' : ''));
        if (failed.length) parts.push(failed.length + ' failed: ' + failed[0]);
        say($('#picsMsg'), parts.join(' · ') || 'Nothing to do.', !done.length);
        return;
      }
      const f = list[i++];
      const id = EDCImages.match(f.name);
      if (!id) { missed.push(f.name); return next(); }
      EDCImages.fromFile(f, opts)
        .then(res => { EDCImages.set(id, res.data); done.push(id); })
        .catch(err => { failed.push(f.name + ' — ' + err.message); })
        .then(next);
    })();
  }

  /* ---- straight off a maker's site --------------------------------------
     An image address is the obvious route and the unreliable one: reading
     the pixels back out of another site's image needs that site to send
     CORS headers, and plenty do not. The clipboard has no such problem -
     the bytes are already local by the time they arrive - so copy-and-paste
     is the route that always works, and it is the one the panel leads with. */
  function fillPasteTarget() {
    const sel = $('#pasteTarget');
    const keep = sel.value;
    sel.textContent = '';
    const first = document.createElement('option');
    first.value = ''; first.textContent = 'Pick the product this picture is of…';
    sel.appendChild(first);

    const pack = new Set(state.items);
    const groups = [
      { label: 'In your pack', list: PRODUCTS.filter(p => pack.has(p.id)) },
      { label: 'Everything else', list: PRODUCTS.filter(p => !pack.has(p.id)) }
    ];
    groups.forEach(g => {
      if (!g.list.length) return;
      const og = document.createElement('optgroup');
      og.label = g.label;
      g.list.slice().sort(SORTS.cat).forEach(p => {
        const o = document.createElement('option');
        o.value = p.id;
        o.textContent = p.brand + ' ' + p.name + (EDCImages.isMine(p.id) ? ' — has one' : '');
        og.appendChild(o);
      });
      sel.appendChild(og);
    });
    if (keep && BY_ID[keep]) sel.value = keep;
  }

  /* After one lands, move to the next thing in the pack still without a
     picture, so a whole loadout can be done without touching the list. */
  function advanceTarget(afterId) {
    const queue = state.items.filter(id => id !== afterId && !EDCImages.isMine(id));
    $('#pasteTarget').value = queue.length ? queue[0] : '';
    return queue.length ? BY_ID[queue[0]] : null;
  }

  function takeOne(file, id, msgEl) {
    if (!BY_ID[id]) { say(msgEl, 'Pick which product it is first.', true); return; }
    const p = BY_ID[id];
    EDCImages.fromFile(file, picOpts())
      .then(res => {
        EDCImages.set(id, res.data);
        const next = advanceTarget(id);
        say(msgEl, 'Added to ' + p.brand + ' ' + p.name + '. ' + describe(res) +
          (next ? ' Next up: ' + next.brand + ' ' + next.name + '.' : ''), res.busyBackground);
        renderAll();
      })
      .catch(err => say(msgEl, 'Could not use that: ' + err.message, true));
  }

  document.addEventListener('paste', e => {
    const items = e.clipboardData && e.clipboardData.items;
    if (!items) return;
    let file = null;
    for (let i = 0; i < items.length; i++) {
      if (items[i].kind === 'file' && /^image\//.test(items[i].type)) { file = items[i].getAsFile(); break; }
    }
    if (!file) return;
    e.preventDefault();
    showTab('build');
    const id = $('#pasteTarget').value;
    if (!id) {
      say($('#pasteMsg'), 'Got the image. Now pick which product it is, just above, and paste again.', true);
      $('#pasteTarget').focus();
      return;
    }
    takeOne(file, id, $('#pasteMsg'));
  });

  function syncPasteFind() {
    const id = $('#pasteTarget').value;
    const a = $('#pasteFind');
    if (!a) return;
    if (id && BY_ID[id]) {
      a.href = photoSearch(BY_ID[id]);
      a.textContent = 'Find a photo of the ' + BY_ID[id].name + ' ↗';
      a.hidden = false;
    } else {
      a.hidden = true;
    }
  }
  $('#pasteTarget').addEventListener('change', syncPasteFind);

  $('#pasteFile').addEventListener('click', () => {
    const id = $('#pasteTarget').value;
    if (!id) return say($('#pasteMsg'), 'Pick the product first.', true);
    photoFor(id, true);
  });

  /* A list of addresses, one product per line. Whether it works is not
     up to this page: reading another site's image needs that site to
     allow it. So each line is reported on its own and a failure says
     which of the two failures it was, rather than the whole run dying
     on the first refusal. */
  $('#listGo').addEventListener('click', () => {
    const lines = $('#listText').value.split(/\r?\n/)
      .map(l => l.trim()).filter(Boolean)
      .map(l => {
        const m = /^(\S+)[\s,;]+(\S+)$/.exec(l);
        return m ? { id: m[1], url: m[2], line: l } : { bad: l };
      });
    if (!lines.length) return say($('#listMsg'), 'Nothing in the box.', true);

    const opts = picOpts();
    const done = [], failed = [];
    let i = 0;
    say($('#listMsg'), 'Working through ' + lines.length + ' line' + (lines.length === 1 ? '' : 's') + '…');

    (function next() {
      if (i >= lines.length) {
        renderAll();
        const parts = [];
        if (done.length) parts.push(done.length + ' added');
        if (failed.length) parts.push(failed.length + ' failed — ' + failed[0]);
        say($('#listMsg'), parts.join(' · '), !done.length);
        return;
      }
      const row = lines[i++];
      if (row.bad || !BY_ID[row.id]) {
        failed.push((row.bad || row.id) + ': ' +
          (row.bad ? 'not "id address"' : 'no product with that id'));
        return next();
      }
      EDCImages.fromUrl(row.url, opts)
        .then(res => { EDCImages.set(row.id, res.data); done.push(row.id); })
        .catch(err => { failed.push(row.id + ': ' + err.message); })
        .then(next);
    })();
  });

  $('#bulkFiles').addEventListener('change', e => {
    if (e.target.files && e.target.files.length) takeFiles(e.target.files);
    e.target.value = '';
  });
  const dz = $('#dropZone');
  ['dragenter', 'dragover'].forEach(ev => dz.addEventListener(ev, e => {
    e.preventDefault(); dz.classList.add('over');
  }));
  ['dragleave', 'drop'].forEach(ev => dz.addEventListener(ev, e => {
    e.preventDefault(); dz.classList.remove('over');
  }));
  dz.addEventListener('drop', e => {
    const dt = e.dataTransfer;
    if (!dt) return;
    if (dt.files && dt.files.length) return takeFiles(dt.files);

    /* Dragged out of another tab: what arrives is the address, not the
       image, so it can only work if that site lets this page read it. */
    const url = (dt.getData('text/uri-list') || dt.getData('text/plain') || '').trim();
    if (!url) return;
    const id = $('#pasteTarget').value;
    if (!id) return say($('#picsMsg'),
      'That is an image address rather than a file. Pick the product in the panel above first, ' +
      'then drop it again — or copy the image and paste it, which always works.', true);
    say($('#picsMsg'), 'Fetching that image…');
    EDCImages.fromUrl(url, picOpts())
      .then(res => {
        EDCImages.set(id, res.data);
        const next = advanceTarget(id);
        say($('#picsMsg'), 'Added to ' + BY_ID[id].brand + ' ' + BY_ID[id].name + '. ' + describe(res) +
          (next ? ' Next up: ' + next.brand + ' ' + next.name + '.' : ''));
        renderAll();
      })
      .catch(err => say($('#picsMsg'), 'Could not use that address: ' + err.message +
        ' Copy the image itself and paste it instead — that always works.', true));
  });
  $('#picsExport').addEventListener('click', () => {
    if (!EDCImages.count()) return say($('#picsMsg'), 'No pictures of your own to save yet.', true);
    const text = EDCImages.toManifest();
    EDCShare.download(new Blob([text], { type: 'text/javascript' }), 'manifest.js')
      .then(how => say($('#picsMsg'), (how === 'saved' ? 'Saved ' : 'Handed over ') +
        'manifest.js with ' + EDCImages.count() + ' picture' + (EDCImages.count() === 1 ? '' : 's') +
        ', about ' + Math.round(text.length / 1024) + ' kB. Put it in tools/edc-builder/media/.'))
      .catch(err => say($('#picsMsg'), 'Could not save it: ' + err.message, true));
  });
  $('#picsClear').addEventListener('click', () => {
    if (!EDCImages.count()) return;
    if (!confirm('Remove all ' + EDCImages.count() + ' of your pictures? The drawings come back.')) return;
    EDCImages.clearAll();
    renderAll();
    say($('#picsMsg'), 'Removed. Every product is drawn again.');
  });

  /* ---- the pack sidebar ------------------------------------------------- */
  let renderPack = function () {
    const items = picked(), t = EDCBoard.totals(items);
    $('#toteCost').textContent = money(t.price);
    $('#toteWeight').textContent = grams(t.grams);
    $('#toteCount').textContent = t.count;
    $('#hdrCount').textContent = t.count + (t.count === 1 ? ' item' : ' items');
    $('#toteOz').textContent = t.count
      ? EDCBoard.gramsToOz(t.grams).toFixed(1) + ' oz · ' + verdict(t.grams)
      : '';

    const ul = $('#picked');
    ul.textContent = '';
    $('#pickedEmpty').hidden = items.length > 0;
    items.forEach(p => {
      const li = document.createElement('li');
      li.innerHTML = `<span class="pk-art">${EDCArt.thumb(p, 46, 30)}</span>
        <span class="pk-txt"><b></b><small></small></span>
        <button class="x" type="button" title="Remove">&#215;</button>`;
      $('b', li).textContent = p.name;
      $('small', li).textContent = money(p.price) + ' · ' + grams(p.grams);
      $('.x', li).addEventListener('click', () => toggle(p.id));
      ul.appendChild(li);
    });
  };

  function verdict(g) {
    if (g < 300)  return 'you would forget it was on you';
    if (g < 600)  return 'an ordinary pocket load';
    if (g < 1000) return 'you will notice this by evening';
    if (g < 2000) return 'this wants a belt or a bag';
    return 'this is a bag, not a pocket';
  }

  function renderLoadouts() {
    const box = $('#loadouts');
    box.textContent = '';
    LOADOUTS.forEach(l => {
      const items = l.items.map(i => BY_ID[i]).filter(Boolean);
      const t = EDCBoard.totals(items);
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'lo';
      b.innerHTML = `<b></b><small></small><em></em>`;
      $('b', b).textContent = l.name;
      $('small', b).textContent = l.blurb;
      $('em', b).textContent = t.count + ' items · ' + money(t.price) + ' · ' + grams(t.grams);
      b.addEventListener('click', () => {
        state.items = l.items.slice();
        if (!state.title.trim()) state.title = l.name;
        $('#boardTitle').value = state.title;
        renderAll();
        showTab('board');
      });
      box.appendChild(b);
    });
  }

  $('#emptyBtn').addEventListener('click', () => { state.items = []; renderAll(); });
  $('#toBoardBtn').addEventListener('click', () => showTab('board'));
  $('#randomBtn').addEventListener('click', () => {
    /* One item from each of a handful of categories, so a random pack is
       a plausible pack rather than four knives. */
    const cats = CATS.map(c => c.id).sort(() => Math.random() - 0.5).slice(0, 7);
    state.items = cats.map(c => {
      const inCat = PRODUCTS.filter(p => p.cat === c);
      return inCat[Math.floor(Math.random() * inCat.length)].id;
    });
    renderAll();
    showTab('board');
  });

  /* ---- the board -------------------------------------------------------- */
  function boardOpts() {
    return { items: picked(), title: state.title, owner: state.owner,
             url: EDCShare.safeUrl(state.url),      /* vetted here as well as in the board */
             layout: state.layout, surface: state.surface, labels: state.labels, ruler: state.ruler };
  }
  let lastBoard = null;

  function renderBoard() {
    lastBoard = EDCBoard.render(boardOpts());
    $('#boardWrap').innerHTML = lastBoard.svg;      /* every string in here went through the escaper */

    const bad = state.url && !EDCShare.safeUrl(state.url);
    $('#urlNote').classList.toggle('warn', !!bad);
    $('#urlNote').textContent = bad
      ? 'That link is not usable. It has to be a normal http or https web address.'
      : 'Instagram, TikTok, Facebook, YouTube, X, Threads, Reddit or a personal site. ' +
        'It shows as a clickable link under the board.';

    const items = picked();
    const tbl = $('#boardTable');
    tbl.textContent = '';
    $('#boardLinksCard').hidden = !items.length;
    if (!items.length) return;
    const head = tbl.createTHead().insertRow();
    ['Item', 'Category', 'Cost', 'Weight', 'Where'].forEach((h, i) => {
      const th = document.createElement('th');
      th.textContent = h;
      if (i > 1 && i < 4) th.className = 'num';
      head.appendChild(th);
    });
    const body = tbl.createTBody();
    items.slice().sort(SORTS.cat).forEach(p => {
      const r = body.insertRow();
      const c0 = r.insertCell();
      const strong = document.createElement('b');
      strong.textContent = p.name;
      const sm = document.createElement('small');
      sm.textContent = p.brand;
      c0.append(strong, document.createElement('br'), sm);
      r.insertCell().textContent = CAT_BY_ID[p.cat].label;
      const c2 = r.insertCell(); c2.textContent = money(p.price); c2.className = 'num';
      const c3 = r.insertCell(); c3.textContent = grams(p.grams); c3.className = 'num';
      const a = document.createElement('a');
      a.href = p.url; a.target = '_blank'; a.rel = 'noopener noreferrer nofollow';
      a.textContent = 'Maker ↗';
      r.insertCell().appendChild(a);
    });
    const t = EDCBoard.totals(items);
    const foot = tbl.createTFoot().insertRow();
    const f0 = foot.insertCell(); f0.textContent = t.count + ' items'; f0.colSpan = 2;
    const f2 = foot.insertCell(); f2.textContent = money(t.price); f2.className = 'num';
    const f3 = foot.insertCell(); f3.textContent = grams(t.grams); f3.className = 'num';
    foot.insertCell();
  }

  function bindField(sel, key, ev) {
    const el = $(sel);
    el.addEventListener(ev || 'input', () => {
      state[key] = el.value;
      renderBoard(); renderShare();
    });
    return el;
  }
  bindField('#boardTitle', 'title');
  bindField('#ownerName', 'owner');
  bindField('#ownerUrl', 'url');
  bindField('#boardLayout', 'layout', 'change');
  bindField('#boardSurface', 'surface', 'change');
  bindField('#boardLabels', 'labels', 'change');
  $('#showRuler').addEventListener('change', e => {
    state.ruler = e.target.checked; renderBoard(); renderShare();
  });

  EDCBoard.surfaceList().forEach(s => {
    const o = document.createElement('option');
    o.value = s.id; o.textContent = s.label;
    $('#boardSurface').appendChild(o);
  });

  $('#pngBtn').addEventListener('click', () => {
    if (!lastBoard) return;
    const msg = $('#pngMsg');
    msg.className = 'hint';
    msg.textContent = 'Rendering…';
    EDCShare.toPNG(lastBoard.svg, lastBoard.width, lastBoard.height, 2)
      .then(blob => EDCShare.download(blob, EDCShare.slug(state.title || state.owner, 'edc') + '-board.png')
        .then(how => {
          const px = lastBoard.width * 2;
          msg.textContent =
            how === 'saved'   ? 'Saved. ' + px + ' pixels wide.' :
            how === 'declined' ? 'Left it, then. Nothing was saved.' :
            'PNG made, ' + px + ' pixels wide, and handed to the browser. If nothing arrived, ' +
            'this page is somewhere that blocks downloads — Print / PDF works either way.';
        }))
      .catch(err => { msg.className = 'hint warn'; msg.textContent = 'Could not export: ' + err.message; });
  });
  $('#printBtn').addEventListener('click', () => window.print());

  /* ---- stats ------------------------------------------------------------ */
  function bar(frac, cls) {
    return `<span class="bar ${cls}"><i style="width:${(frac * 100).toFixed(1)}%"></i></span>`;
  }

  function renderStats() {
    const items = picked(), out = $('#statsOut');
    out.textContent = '';
    if (!items.length) {
      out.innerHTML = `<div class="card"><h2>Nothing to measure yet</h2>
        <p class="sub">Pick some gear on the Build tab and the numbers turn up here.</p></div>`;
      return;
    }
    const t = EDCBoard.totals(items);
    const byCat = CATS.map(c => ({ c, list: items.filter(p => p.cat === c.id) }))
      .filter(g => g.list.length)
      .map(g => Object.assign(g, EDCBoard.totals(g.list)))
      .sort((a, b) => b.grams - a.grams);
    const maxG = Math.max.apply(null, byCat.map(g => g.grams));
    const maxP = Math.max.apply(null, byCat.map(g => g.price));
    const heaviest = items.slice().sort((a, b) => b.grams - a.grams)[0];
    const dearest  = items.slice().sort((a, b) => b.price - a.price)[0];
    const lightest = items.slice().sort((a, b) => a.grams - b.grams)[0];

    const head = document.createElement('div');
    head.className = 'card';
    head.innerHTML = `<h2>The whole pack</h2>
      <div class="bignums">
        <div><span>${money(t.price)}</span><small>total cost</small></div>
        <div><span>${grams(t.grams)}</span><small>total weight</small></div>
        <div><span>${EDCBoard.gramsToOz(t.grams).toFixed(1)} oz</span><small>in ounces</small></div>
        <div><span>${t.count}</span><small>items</small></div>
        <div><span>${byCat.length}</span><small>categories</small></div>
      </div>
      <p class="sub" style="margin-top:12px">Carried all at once that is <b>${verdict(t.grams)}</b>.
        Drop the ${EDCArt.esc(heaviest.name)} and you save ${grams(heaviest.grams)},
        ${((heaviest.grams / t.grams) * 100).toFixed(0)}% of the load.</p>`;
    out.appendChild(head);

    const split = document.createElement('div');
    split.className = 'card';
    split.innerHTML = `<h2>Where the weight and the money went</h2>
      <div class="table-scroll"><table class="tbl">
        <thead><tr><th>Category</th><th class="num">Items</th><th>Weight</th>
          <th class="num">g</th><th>Cost</th><th class="num">$</th></tr></thead>
        <tbody>${byCat.map(g => `<tr>
          <td>${EDCArt.esc(g.c.label)}</td>
          <td class="num">${g.count}</td>
          <td class="barcell">${bar(g.grams / maxG, 'w')}</td>
          <td class="num">${Math.round(g.grams)}</td>
          <td class="barcell">${bar(g.price / maxP, 'p')}</td>
          <td class="num">${Math.round(g.price)}</td></tr>`).join('')}</tbody>
      </table></div>`;
    out.appendChild(split);

    const notes = document.createElement('div');
    notes.className = 'card';
    notes.innerHTML = `<h2>Notable</h2>
      <ul class="notes">
        <li><b>Heaviest</b> ${EDCArt.esc(heaviest.brand + ' ' + heaviest.name)} at ${grams(heaviest.grams)}</li>
        <li><b>Lightest</b> ${EDCArt.esc(lightest.brand + ' ' + lightest.name)} at ${grams(lightest.grams)}</li>
        <li><b>Most expensive</b> ${EDCArt.esc(dearest.brand + ' ' + dearest.name)} at ${money(dearest.price)},
            ${((dearest.price / t.price) * 100).toFixed(0)}% of the total</li>
        <li><b>Average item</b> ${grams(t.grams / t.count)} and ${money(t.price / t.count)}</li>
      </ul>
      <p class="sub small" style="margin-top:10px">Costs are typical retail in US dollars and weights are
        published specs. Both are estimates recorded by hand, so treat the comparison between items as the
        useful part and the totals as an approximation.</p>`;
    out.appendChild(notes);
  }

  /* ---- share ------------------------------------------------------------- */
  function renderShare() {
    const link = EDCShare.linkFor(state);
    $('#shareUrl').value = link;
    if (history.replaceState) history.replaceState(null, '', '#b=' + EDCShare.encode(state));
  }

  function copy(text, msgEl) {
    const done = ok => {
      msgEl.className = 'hint' + (ok ? '' : ' warn');
      msgEl.textContent = ok ? 'Link copied to the clipboard.'
        : 'Could not reach the clipboard. Select the link below and copy it by hand.';
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(() => done(true), () => done(false));
    } else { done(false); }
  }
  $('#copyLinkBtn').addEventListener('click', () => copy($('#shareUrl').value, $('#shareMsg')));
  $('#copyLinkBtn2').addEventListener('click', () => copy(EDCShare.linkFor(state), $('#pngMsg')));

  $('#saveBtn').addEventListener('click', () => {
    const ok = EDCShare.save(state);
    $('#shareMsg').className = 'hint' + (ok ? '' : ' warn');
    $('#shareMsg').textContent = ok
      ? 'Saved in this browser. It will still be here next time on this device.'
      : 'This browser will not let the page store anything, so use the share link or the JSON instead.';
  });
  $('#loadBtn').addEventListener('click', () => {
    const st = EDCShare.load();
    $('#shareMsg').className = 'hint' + (st ? '' : ' warn');
    if (!st) { $('#shareMsg').textContent = 'There is nothing saved in this browser yet.'; return; }
    adopt(st);
    $('#shareMsg').textContent = 'Loaded the saved pack.';
  });
  $('#exportBtn').addEventListener('click', () => {
    const json = EDCShare.toJSON(state);
    $('#exportBox').hidden = false;
    $('#exportText').value = json;      /* always shown, so the file is never the only copy */
    EDCShare.download(new Blob([json], { type: 'application/json' }),
      EDCShare.slug(state.title || state.owner, 'edc') + '-pack.json')
      .then(how => {
        $('#shareMsg').className = 'hint';
        $('#shareMsg').textContent =
          how === 'saved'    ? 'Saved the JSON file.' :
          how === 'declined' ? 'Not saved. The JSON is below either way — copy it from there.' :
          'JSON handed to the browser. It is also below, so copy it from there if no file arrived.';
      })
      .catch(err => {
        $('#shareMsg').className = 'hint warn';
        $('#shareMsg').textContent = 'Could not save the file: ' + err.message +
          ' The JSON is below — copy it from there.';
      });
  });
  $('#importFile').addEventListener('change', e => {
    const f = e.target.files && e.target.files[0];
    if (!f) return;
    const r = new FileReader();
    r.onload = () => {
      const st = EDCShare.fromJSON(String(r.result));
      $('#shareMsg').className = 'hint' + (st ? '' : ' warn');
      if (!st) { $('#shareMsg').textContent = 'That file is not an EDC Builder pack.'; return; }
      adopt(st);
      $('#shareMsg').textContent = 'Imported ' + st.items.length + ' items.';
    };
    r.readAsText(f);
    e.target.value = '';
  });

  /* Take on a vetted state object from a link, a file or storage. */
  function adopt(st) {
    Object.assign(state, st);
    $('#boardTitle').value = state.title;
    $('#ownerName').value = state.owner;
    $('#ownerUrl').value = state.url;
    $('#boardLayout').value = state.layout;
    $('#boardSurface').value = state.surface;
    $('#boardLabels').value = state.labels;
    $('#showRuler').checked = !!state.ruler;
    renderAll();
  }

  /* ---- go ---------------------------------------------------------------- */
  function renderAll() {
    picsCount();
    fillPasteTarget();
    syncPasteFind();
    renderMine();
    renderCatalog();
    renderPack();
    renderBoard();
    renderStats();
    renderShare();
  }

  renderChips();
  renderLoadouts();

  /* Open on something. An empty board teaches nobody what this is, and
     the first frame is what a shared link and a skim both get. Only on a
     genuinely first visit though: a link, a saved pack, or a pack the
     user emptied on purpose all outrank it. */
  const incoming = EDCShare.fromLocation();
  const saved = EDCShare.load();
  let seeded = null;

  if (incoming && incoming.items.length) {
    adopt(incoming);
    showTab('board');
  } else if (saved && saved.items.length) {
    adopt(saved);
  } else {
    const start = LOADOUTS[2];                 /* City every day */
    seeded = start.items.slice();
    state.items = seeded.slice();
    state.title = start.name;
    $('#boardTitle').value = state.title;
    renderAll();
  }

  /* The note goes the moment the pack stops being the sample, so nobody
     is told they are looking at an example when they are not. */
  function seedNote() {
    const el = $('#seedNote');
    if (!el) return;
    const same = seeded && seeded.length === state.items.length &&
      seeded.every(id => state.items.indexOf(id) >= 0);
    el.hidden = !same;
  }
  const _renderPack = renderPack;
  renderPack = function () { _renderPack(); seedNote(); };
  seedNote();

  window.addEventListener('hashchange', () => {
    const st = EDCShare.fromLocation();
    if (st && EDCShare.encode(st) !== EDCShare.encode(state)) { adopt(st); showTab('board'); }
  });
})();
