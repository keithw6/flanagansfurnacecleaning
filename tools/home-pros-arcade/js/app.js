/* The game: a small state machine. Each step has the host say something,
   then offers choices (or a form, or the calendar).                        */
(function () {
  const cfg = HP_CONFIG, P = HP_PRICING, A = HP_AUDIO, S = HP_SCENE, api = HP_API;
  const $ = id => document.getElementById(id);
  const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const money = P.money;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

  const state = {
    answers: {}, wantDryer: false, location: '', travel: null, history: [],
    customer: {}, days: null, day: null, slot: null,
  };
  let run = 0, typing = null, current = [];

  /* ---------------------------------------------------------------- setup */
  $('startBtn').disabled = true;
  S.init($('scene')).then(() => { $('startBtn').disabled = false; $('startLabel').innerHTML = '&#9654; PRESS START'; });
  $('nameplate').textContent = cfg.host.name.toUpperCase();
  $('taxLabel').textContent = cfg.tax.label;
  if (api.demo) $('demoTag').hidden = false;
  renderBoard();
  syncMute();

  function renderBoard() {
    $('boardList').innerHTML = cfg.menuBoard.map(m =>
      `<li data-k="${esc(m.key)}"><span class="n">${esc(m.name)}</span><span class="p">${m.plus ? '+' : ''}${money(cfg.prices[m.key])}</span>${m.note ? `<span class="note">${esc(m.note)}</span>` : ''}</li>`).join('');
  }
  function highlight(keys) {
    document.querySelectorAll('#boardList li').forEach(li => li.classList.toggle('on', keys.includes(li.dataset.k)));
  }

  /* -------------------------------------------------------------- dialog */
  const fill = s => s.replace('{host}', cfg.host.name).replace('{email}', state.customer.email || 'your inbox');

  function say(text) {
    const id = run;
    const target = $('say');
    text = fill(text);
    return new Promise(resolve => {
      if (reduce) { target.textContent = text; resolve(); return; }
      let i = 0;
      S.talk(true);
      target.innerHTML = '';
      const finish = () => { clearInterval(timer); typing = null; target.textContent = text; S.talk(false); resolve(); };
      const timer = setInterval(() => {
        if (id !== run) { clearInterval(timer); S.talk(false); return; }
        i++;
        target.innerHTML = esc(text.slice(0, i)) + '<span class="caret">&#9612;</span>';
        if (i % 2 === 0 && text[i] !== ' ') A.blip();
        if (i >= text.length) finish();
      }, 24);
      typing = finish;
    });
  }
  async function sayAll(lines) { for (const l of [].concat(lines)) { await say(l); if (lines.length > 1) await pause(350); } }
  const pause = ms => new Promise(r => setTimeout(r, ms));

  function clear() {
    run++;
    if (typing) { typing = null; }
    $('panel').innerHTML = ''; $('choices').innerHTML = ''; $('hint').innerHTML = '';
    current = []; onQuestions = false;
    return run;
  }

  function choices(list, hint = true) {
    const box = $('choices');
    box.innerHTML = '';
    current = list;
    list.forEach((c, i) => {
      const b = el('button', 'choice' + (c.kind ? ' ' + c.kind : ''));
      b.type = 'button';
      if (c.disabled) b.disabled = true;
      b.innerHTML = `<span class="k">${i + 1}</span><span class="lbl">${esc(c.label)}</span>${c.amt ? `<span class="amt">${esc(c.amt)}</span>` : ''}`;
      b.addEventListener('click', () => pick(i));
      box.appendChild(b);
    });
    if (hint) $('hint').innerHTML = 'Tap an answer, or press <kbd>1</kbd>-<kbd>' + list.length + '</kbd>';
    const first = box.querySelector('.choice:not([disabled])');
    if (first && matchMedia('(pointer: fine)').matches) first.focus({ preventScroll: true });
  }
  function pick(i) {
    const c = current[i];
    if (!c || c.disabled) return;
    (c.sound === 'back' ? A.back : c.sound === 'none' ? () => {} : A.select)();
    c.onPick();
  }

  document.addEventListener('keydown', e => {
    if (e.target.matches('input, textarea')) return;
    if (!$('outside').hidden && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); if (!$('startBtn').disabled) enter(); return; }
    if (typing && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); typing(); return; }
    const n = parseInt(e.key, 10);
    if (n >= 1 && n <= current.length) { e.preventDefault(); pick(n - 1); }
    if (e.key === 'Escape') { const back = current.find(c => c.isBack); if (back) back.onPick(); }
  });
  $('dialog').addEventListener('click', e => { if (typing && !e.target.closest('button, input, textarea')) typing(); });
  $('stage').addEventListener('click', e => {
    if (S.mode === 'office' && boardOpen) {
      const r = $('scene').getBoundingClientRect();
      const id = S.office.pick((e.clientX - r.left) / r.width * S.office.size.W, (e.clientY - r.top) / r.height * S.office.size.H);
      if (id === 'shop') { backToShop(); return; }
      if (id) { A.select(); talkTo(id); return; }
    }
    if (typing) typing();
  });

  /* ---------------------------------------------------------------- HUD */
  let cashShown = 0, cashAnim;
  function setCash(v) {
    const from = cashShown, to = v, t0 = performance.now(), dur = 500;
    cancelAnimationFrame(cashAnim);
    const step = now => {
      const k = Math.min(1, (now - t0) / dur);
      cashShown = from + (to - from) * k;
      $('cashNum').textContent = money(Math.round(cashShown * 100) / 100);
      $('register').textContent = cashShown.toFixed(2);
      if (k < 1) cashAnim = requestAnimationFrame(step);
    };
    cashAnim = requestAnimationFrame(step);
    if (to !== from) { const c = $('cash'); c.classList.remove('bump'); void c.offsetWidth; c.classList.add('bump'); }
  }
  const selection = () => ({ answers: state.answers, location: state.customer.city || state.location });
  const running = () => P.quote(state.answers, state.travel);

  function syncMute() {
    const b = $('muteBtn');
    b.setAttribute('aria-pressed', A.muted ? 'true' : 'false');
    b.setAttribute('aria-label', A.muted ? 'Sound off' : 'Sound on');
  }
  $('muteBtn').addEventListener('click', () => { A.toggleMute(); syncMute(); });

  /* ---------------------------------------------------------- the street */
  let entered = false;
  $('startBtn').addEventListener('click', enter);
  $('stage').addEventListener('dblclick', e => e.preventDefault());
  $('say').textContent = 'The Home Pros shop is open. Press Start to walk in.';
  function enter() {
    if (entered) return;
    entered = true;
    A.start(); A.select();
    $('startBtn').hidden = true;
    S.walkIn(async () => {
      $('fade').classList.add('on');
      await pause(450);
      S.setMode('inside');
      $('outside').hidden = true; $('inside').hidden = false;
      document.body.classList.remove('street');
      $('fade').classList.remove('on');
      await pause(300);
      greet();
    });
  }

  /* ----------------------------------------------------------- the shop */
  const STEPS = ['town', 'oneFurnace', 'furnaceCount', 'ac', 'acCount', 'zone', 'dryer', 'dryerWhere'];
  const BOARD_KEYS = {
    oneFurnace: ['base', 'extraFurnace'], furnaceCount: ['base', 'extraFurnace'],
    ac: ['airConditioner'], acCount: ['airConditioner'], zone: ['zone'], dryer: ['dryerVent'], dryerWhere: ['dryerVent'],
  };
  const pr = cfg.prices;

  function applies(id) {
    const a = state.answers;
    if (id === 'furnaceCount') return a.furnaces !== 1;
    if (id === 'acCount') return a.ac === true && a.furnaces > 1;
    if (id === 'dryerWhere') return state.wantDryer === true;
    return true;
  }
  function next(from, prefix) {
    for (let i = STEPS.indexOf(from) + 1; i < STEPS.length; i++) if (applies(STEPS[i])) return ask(STEPS[i], prefix);
    showQuote();
  }
  function back() {
    state.history.pop();
    const prev = state.history.pop();
    prev ? ask(prev) : greet(true);
  }
  const backChoice = () => ({ label: state.history.length > 1 ? 'Back a step' : 'Back', kind: 'ghost', sound: 'back', isBack: true, onPick: back });
  function answered(step, prefix) {
    A.register();
    setCash(running().subtotal);
    next(step, prefix);
  }

  async function greet(again) {
    const id = clear();
    S.mood('idle'); highlight([]);
    Object.assign(state, { answers: {}, wantDryer: false, travel: null, location: '', history: [], slot: null, days: null });
    setCash(0);
    await sayAll(again ? ['Okay, from the top.'] : cfg.lines.greet);
    if (id !== run) return;
    choices([
      { label: 'Get my flat-rate price', amt: 'from ' + money(pr.base), kind: 'primary', onPick: () => ask('town') },
      { label: 'Just looking at prices', kind: 'ghost', onPick: browse },
    ]);
  }

  async function browse() {
    const id = clear();
    highlight(cfg.menuBoard.map(m => m.key));
    await say(cfg.lines.browse);
    if (id !== run) return;
    choices([
      { label: 'Get my flat-rate price', kind: 'primary', onPick: () => ask('town') },
      { label: 'Maybe later', kind: 'ghost', onPick: decline },
    ]);
  }

  function travelLine(t) {
    if (!t.known) return cfg.lines.unknownTown;
    if (!t.fee) return cfg.lines.inArea;
    return cfg.lines.outArea.replace('{km}', t.billableKm + cfg.travel.includedKm).replace('{included}', cfg.travel.includedKm + ' km').replace('{fee}', money(t.fee));
  }

  async function ask(step, prefix) {
    const id = clear();
    if (state.history[state.history.length - 1] !== step) state.history.push(step);
    highlight(BOARD_KEYS[step] || []);
    const a = state.answers;
    const L = cfg.lines;
    const line = (prefix ? prefix + ' ' : '') + (L[step] || '');
    let list;

    if (step === 'town') {
      list = cfg.travel.serviceArea.map(t => ({
        label: t.name, kind: state.location === t.name ? 'primary' : '', sound: 'none',
        onPick: () => { state.location = t.name; state.travel = HP_TRAVEL.estimate(t.name); answered('town', L.inArea); },
      }));
      list.push({ label: 'Somewhere else', kind: 'ghost', onPick: otherTown });
    } else if (step === 'oneFurnace') {
      list = [
        { label: 'Yes, just one', sound: 'none', kind: a.furnaces === 1 ? 'primary' : '', onPick: () => { a.furnaces = 1; delete a.acCount; answered(step); } },
        { label: 'No, more than one', sound: 'none', kind: a.furnaces > 1 ? 'primary' : '', onPick: () => { if (!(a.furnaces > 1)) a.furnaces = 2; answered(step); } },
      ];
    } else if (step === 'furnaceCount') {
      list = [];
      for (let n = 2; n <= cfg.maxFurnaces; n++) list.push({
        label: n + ' furnaces', amt: '+' + money((n - 1) * pr.extraFurnace), sound: 'none', kind: a.furnaces === n ? 'primary' : '',
        onPick: () => { a.furnaces = n; if (a.acCount > n) a.acCount = n; answered(step); },
      });
      list.push({ label: 'More than ' + cfg.maxFurnaces, kind: 'ghost', onPick: tooMany });
    } else if (step === 'ac') {
      list = [
        { label: 'Yes', amt: a.furnaces === 1 ? '+' + money(pr.airConditioner) : '', sound: 'none', kind: a.ac === true ? 'primary' : '', onPick: () => { a.ac = true; answered(step); } },
        { label: 'No', sound: 'none', kind: a.ac === false ? 'primary' : '', onPick: () => { a.ac = false; delete a.acCount; answered(step); } },
      ];
    } else if (step === 'acCount') {
      list = [];
      for (let n = 1; n <= a.furnaces; n++) list.push({
        label: n === 1 ? 'Just one' : n + ' air conditioners', amt: '+' + money(n * pr.airConditioner), sound: 'none', kind: a.acCount === n ? 'primary' : '',
        onPick: () => { a.acCount = n; answered(step); },
      });
    } else if (step === 'zone') {
      list = zoneChoices();
      list.push({ label: "What's a zone system?", kind: 'ghost', onPick: explainZone });
    } else if (step === 'dryer') {
      list = [
        { label: 'Yes, add the dryer vent', amt: '+' + money(pr.dryerVent), sound: 'none', kind: state.wantDryer ? 'primary' : '', onPick: () => { state.wantDryer = true; a.dryer = 'side'; answered(step); } },
        { label: 'No thanks', sound: 'none', kind: a.dryer === 'no' ? 'primary' : '', onPick: () => { state.wantDryer = false; a.dryer = 'no'; answered(step); } },
      ];
    } else if (step === 'dryerWhere') {
      list = [
        { label: 'Side of the house', amt: '+' + money(pr.dryerVent), sound: 'none', kind: a.dryer === 'side' ? 'primary' : '', onPick: () => { a.dryer = 'side'; answered(step); } },
        { label: 'Roof of the house', sound: 'none', kind: a.dryer === 'roof' ? 'primary' : '', onPick: roofVent },
      ];
    }
    list.push(backChoice());
    await say(line);
    if (id !== run) return;
    choices(list);
  }

  function zoneChoices() {
    const a = state.answers;
    return [
      { label: 'Yes', amt: '+' + money(pr.zone), sound: 'none', kind: a.zone === true ? 'primary' : '', onPick: () => { a.zone = true; answered('zone'); } },
      { label: 'No', sound: 'none', kind: a.zone === false ? 'primary' : '', onPick: () => { a.zone = false; answered('zone'); } },
    ];
  }
  async function explainZone() {
    const id = clear();
    highlight(['zone']);
    await say(cfg.lines.zoneExplain);
    if (id !== run) return;
    const list = zoneChoices();
    list[0].label = 'Yes, more than one thermostat';
    list[1].label = 'No, just one thermostat';
    list.push({ label: 'Back', kind: 'ghost', sound: 'back', isBack: true, onPick: () => ask('zone') });
    choices(list);
  }

  async function roofVent() {
    const id = clear();
    state.answers.dryer = 'roof';
    setCash(running().subtotal);
    A.error();
    await say(cfg.lines.roof);
    if (id !== run) return;
    choices([
      { label: 'Okay, show me my price', kind: 'primary', onPick: showQuote },
      { label: 'Back a step', kind: 'ghost', sound: 'back', isBack: true, onPick: () => ask('dryerWhere') },
    ]);
  }

  async function tooMany() {
    const id = clear();
    await say(cfg.lines.tooMany);
    if (id !== run) return;
    choices(contactChoices());
  }

  async function otherTown() {
    const id = clear();
    if (state.history[state.history.length - 1] !== 'town') state.history.push('town');
    const form = el('form', 'form');
    form.innerHTML = `<label class="full">Town or full address<input name="q" autocomplete="street-address" maxlength="150" placeholder="e.g. Beaumont, or 12 Main St, Morinville"><span class="err"></span></label>`;
    $('panel').appendChild(form);
    const input = form.elements.q;
    if (state.location && !cfg.travel.serviceArea.some(t => t.name === state.location)) input.value = state.location;
    const check = async () => {
      const q = input.value.trim();
      if (q.length < 3) { A.error(); form.querySelector('.err').textContent = 'Type a town or address'; input.focus(); return; }
      const myRun = clear();
      $('panel').innerHTML = '<div class="loading">Checking the map</div>';
      let t;
      try { t = await api.travel(q); } catch (e) { t = { known: false, place: q, fee: 0, km: 0, billableKm: 0 }; }
      if (myRun !== run) return;
      state.location = q; state.travel = t;
      answered('town', travelLine(t));
    };
    form.addEventListener('submit', e => { e.preventDefault(); check(); });
    await say(cfg.lines.townOther);
    if (id !== run) return;
    choices([
      { label: 'Check my travel', kind: 'primary', onPick: check },
      { label: 'Back', kind: 'ghost', sound: 'back', isBack: true, onPick: () => ask('town') },
    ], false);
    if (matchMedia('(pointer: fine)').matches) input.focus();
  }

  function receipt(q, extra = '', title = 'HOME PROS QUOTE') {
    const rows = q.lines.map(l => `
      <div class="row"><span>${esc(l.label)}</span><span>${l.amount || l.key === 'base' ? money(l.amount) : '-'}</span></div>
      ${l.detail ? `<div class="row sub"><span>${esc(l.detail)}</span></div>` : ''}`).join('');
    return `<div class="receipt"><h3>${esc(title)}</h3>${rows}<hr>
      <div class="row"><span>Subtotal</span><span>${money(q.subtotal)}</span></div>
      <div class="row"><span>${esc(cfg.tax.label)} ${Math.round(cfg.tax.rate * 100)}%</span><span>${money(q.tax)}</span></div>
      <div class="row total"><span>TOTAL</span><span>${money(q.total)}</span></div>${extra}</div>`;
  }

  async function showQuote() {
    const id = clear();
    const q = running();
    highlight(q.lines.map(l => l.key));
    setCash(q.total);
    A.register();
    $('panel').innerHTML = receipt(q, '<div class="stamp">FLAT RATE &middot; NO SURPRISES</div>');
    await say(cfg.lines.quote);
    if (id !== run) return;
    choices([
      { label: 'Book it!', kind: 'primary', onPick: details },
      { label: 'Change my answers', sound: 'back', onPick: () => { state.history = []; ask('town'); } },
      { label: 'Not today', kind: 'ghost', sound: 'back', onPick: decline },
    ]);
  }

  /* ------------------------------------------------------------- details */
  const FIELDS = [
    { k: 'firstName', l: 'First name', ac: 'given-name' },
    { k: 'lastName', l: 'Last name', ac: 'family-name' },
    { k: 'phone', l: 'Phone', ac: 'tel', type: 'tel' },
    { k: 'email', l: 'Email (for your confirmation)', ac: 'email', type: 'email' },
    { k: 'address', l: 'Street address', ac: 'street-address', full: true },
    { k: 'city', l: 'City', ac: 'address-level2' },
    { k: 'postal', l: 'Postal code', ac: 'postal-code' },
    { k: 'notes', l: 'Anything we should know? (gate code, pets, parking) optional', full: true, area: true, optional: true },
  ];
  function validate(c) {
    const e = {};
    for (const f of FIELDS) if (!f.optional && !String(c[f.k] || '').trim()) e[f.k] = 'Needed';
    if (c.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(c.email.trim())) e.email = 'That email looks off';
    if (c.phone && c.phone.replace(/\D/g, '').length < 10) e.phone = 'Include the area code';
    if (c.postal && !/^[A-Za-z]\d[A-Za-z][ -]?\d[A-Za-z]\d$/.test(c.postal.trim())) e.postal = 'Like T2X 1A1';
    return e;
  }

  async function details() {
    const id = clear();
    const form = el('form', 'form');
    form.noValidate = true;
    form.innerHTML = FIELDS.map(f => `
      <label class="${f.full ? 'full' : ''}" data-f="${f.k}">${esc(f.l)}
        ${f.area ? `<textarea name="${f.k}" maxlength="1000"></textarea>` :
          `<input name="${f.k}" type="${f.type || 'text'}" autocomplete="${f.ac || 'off'}" maxlength="100">`}
        <span class="err"></span></label>`).join('') +
      `<div class="hp" aria-hidden="true"><label>Website <input name="website" tabindex="-1" autocomplete="off"></label></div>`;
    for (const f of FIELDS) form.elements[f.k].value = state.customer[f.k] || '';
    if (!state.customer.city && state.travel && state.travel.known) form.elements.city.value = state.travel.place;
    $('panel').appendChild(form);
    const submit = () => {
      const c = {};
      for (const f of FIELDS) c[f.k] = form.elements[f.k].value.trim();
      c.website = form.elements.website.value;
      state.customer = c;
      const errs = validate(c);
      form.querySelectorAll('label[data-f]').forEach(l => {
        const msg = errs[l.dataset.f] || '';
        l.classList.toggle('bad', !!msg); l.querySelector('.err').textContent = msg;
      });
      if (Object.keys(errs).length) { A.error(); form.querySelector('.bad input, .bad textarea').focus(); return; }
      recheckTravel();
    };
    form.addEventListener('submit', e => { e.preventDefault(); submit(); });
    form.addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.tagName === 'INPUT') { e.preventDefault(); submit(); } });
    await say(cfg.lines.details);
    if (id !== run) return;
    choices([
      { label: 'Next: pick a time', kind: 'primary', onPick: submit },
      { label: 'Back to my quote', kind: 'ghost', sound: 'back', isBack: true, onPick: showQuote },
    ], false);
    if (matchMedia('(pointer: fine)').matches) form.elements.firstName.focus();
  }

  // The booking is priced from the address on the form, so if the town there
  // is not the one we quoted, look the travel up again before going on.
  async function recheckTravel() {
    const city = state.customer.city;
    const before = state.travel;
    const same = before && HP_TRAVEL.findTown(city) && before.known && HP_TRAVEL.findTown(city).name === before.place;
    if (same) return calendar();
    const id = clear();
    $('panel').innerHTML = '<div class="loading">Checking the map</div>';
    let t;
    try { t = await api.travel(city); } catch (e) { t = { known: false, place: city, fee: 0, km: 0, billableKm: 0 }; }
    if (id !== run) return;
    state.travel = t; state.location = city;
    if (before && t.fee === before.fee && t.known === before.known) return calendar();
    const q = running();
    setCash(q.total);
    $('panel').innerHTML = receipt(q);
    const msg = !t.known ? cfg.lines.unknownTown : (t.fee ? cfg.lines.travelChanged : cfg.lines.travelFree);
    await say(msg.replace('{fee}', money(t.fee)).replace('{total}', money(q.total)));
    if (id !== run) return;
    choices([
      { label: 'Sounds good, pick a time', kind: 'primary', onPick: () => calendar(true) },
      { label: 'Back to my details', kind: 'ghost', sound: 'back', isBack: true, onPick: details },
    ]);
  }

  /* ------------------------------------------------------------ calendar */
  const dateOf = s => { const [y, m, d] = s.slice(0, 10).split('-').map(Number); return new Date(Date.UTC(y, m - 1, d)); };
  const fmtDay = (s, o) => dateOf(s).toLocaleDateString('en-CA', { timeZone: 'UTC', ...o });

  async function calendar(refresh) {
    const id = clear();
    if (refresh || !state.days) {
      state.days = null;
      $('panel').innerHTML = '<div class="loading">Checking the schedule</div>';
      try {
        const res = await api.availability(selection());
        if (id !== run) return;
        state.days = res.days || [];
      } catch (err) {
        if (id !== run) return;
        return failed(() => calendar(true));
      }
    }
    const days = state.days;
    if (!state.day || !days.find(d => d.date === state.day)) state.day = (days.find(d => d.slots.length) || {}).date;
    $('panel').innerHTML = '';
    if (!days.some(d => d.slots.length)) {
      await say("We're booked solid for the next few weeks. Give us a call and we'll squeeze you in.");
      return choices(contactChoices(() => details()));
    }
    const strip = el('div', 'days');
    strip.setAttribute('role', 'group'); strip.setAttribute('aria-label', 'Choose a day');
    const slotsBox = el('div', 'slots');
    const drawSlots = () => {
      slotsBox.innerHTML = '';
      const d = days.find(x => x.date === state.day);
      if (!d) return;
      d.slots.forEach(s => {
        const b = el('button', 'choice' + (state.slot && state.slot.start === s.start ? ' primary' : ''));
        b.type = 'button';
        b.innerHTML = `<span class="lbl">${esc(s.label)}</span>`;
        b.addEventListener('click', () => { A.select(); state.slot = s; confirm(); });
        slotsBox.appendChild(b);
      });
    };
    days.forEach(d => {
      const b = el('button', 'day' + (d.slots.length ? '' : ' full'));
      b.type = 'button';
      b.setAttribute('aria-pressed', d.date === state.day ? 'true' : 'false');
      if (!d.slots.length) b.disabled = true;
      b.innerHTML = `<div class="dw">${fmtDay(d.date, { weekday: 'short' }).toUpperCase()}</div><div class="dn">${dateOf(d.date).getUTCDate()}</div><div class="dm">${fmtDay(d.date, { month: 'short' })}</div><div class="dc">${d.slots.length ? d.slots.length + ' open' : 'full'}</div>`;
      b.addEventListener('click', () => {
        A.blip(); A.select(); state.day = d.date;
        strip.querySelectorAll('.day').forEach(x => x.setAttribute('aria-pressed', 'false'));
        b.setAttribute('aria-pressed', 'true');
        drawSlots();
      });
      strip.appendChild(b);
    });
    $('panel').append(strip, slotsBox);
    drawSlots();
    await say(cfg.lines.calendar);
    if (id !== run) return;
    choices([{ label: 'Back to my details', kind: 'ghost', sound: 'back', isBack: true, onPick: details }], false);
    $('hint').textContent = 'Scroll the days sideways for more dates.';
  }

  function describeSlot(s) {
    return `${fmtDay(s.start, { weekday: 'long', month: 'long', day: 'numeric' })}, arriving ${s.label}`;
  }

  /* ------------------------------------------------------------- confirm */
  async function confirm() {
    const id = clear();
    const q = running();
    const c = state.customer;
    const extra = `<hr>
      <div class="row"><b>${esc(describeSlot(state.slot))}</b></div>
      <div class="row sub"><span>${esc(c.firstName)} ${esc(c.lastName)} &middot; ${esc(c.phone)}</span></div>
      <div class="row sub"><span>${esc(c.address)}, ${esc(c.city)} ${esc(c.postal.toUpperCase())}</span></div>
      <div class="row sub"><span>${esc(c.email)}</span></div>`;
    $('panel').innerHTML = receipt(q, extra, 'WORK ORDER');
    await say(cfg.lines.confirm);
    if (id !== run) return;
    choices([
      { label: 'Lock it in!', kind: 'primary', onPick: book },
      { label: 'Change the time', sound: 'back', onPick: () => calendar() },
      { label: 'Edit my details', kind: 'ghost', sound: 'back', isBack: true, onPick: details },
    ]);
  }

  async function book() {
    const id = clear();
    say(cfg.lines.booking);
    $('panel').innerHTML = '<div class="loading">Booking</div>';
    const { website, ...customer } = state.customer;
    try {
      const res = await api.book({ answers: state.answers, customer, start: state.slot.start, website });
      if (id !== run) return;
      booked(res);
    } catch (err) {
      if (id !== run) return;
      if (err.code === 'slot_taken') {
        A.error();
        clear();
        await say(cfg.lines.slotTaken);
        state.slot = null;
        return calendar(true);
      }
      failed(book);
    }
  }

  async function booked(res) {
    const id = clear();
    A.win(); S.celebrate();
    const pop = el('div', 'achievement', `BOOKED!<small>${esc(describeSlot(state.slot))}</small>`);
    $('stage').appendChild(pop);
    setTimeout(() => pop.remove(), 4200);
    const q = running();
    const ref = res && res.reference ? `<div class="row sub"><span>Reference: ${esc(res.reference)}</span></div>` : '';
    $('panel').innerHTML = receipt(q, `<hr><div class="row"><b>${esc(describeSlot(state.slot))}</b></div>${ref}
      <div class="stamp">&#9733; CONFIRMED &#9733;</div>`, 'BOOKING CONFIRMED');
    await say(cfg.lines.booked + (api.demo ? ' (Demo mode: nothing was actually booked.)' : ''));
    if (id !== run) return;
    choices([
      { label: 'Thanks, ' + cfg.host.name + '!', kind: 'primary', onPick: () => { S.mood('idle'); say('Anytime. Stay warm out there.'); choices([{ label: 'Head back outside', kind: 'ghost', onPick: () => location.reload() }]); } },
    ], false);
  }

  function contactChoices(retry) {
    const list = [];
    if (retry) list.push({ label: 'Try again', kind: 'primary', onPick: retry });
    if (cfg.business.phone) list.push({ label: 'Call ' + cfg.business.phone, onPick: () => { location.href = 'tel:' + cfg.business.phone.replace(/[^\d+]/g, ''); } });
    list.push({ label: 'Start over', kind: 'ghost', sound: 'back', onPick: () => greet(true) });
    return list;
  }

  async function failed(retry) {
    const id = clear();
    A.error();
    await say(cfg.lines.error);
    if (id !== run) return;
    choices(contactChoices(retry));
  }

  async function decline() {
    const id = clear();
    S.mood('idle');
    await say(cfg.lines.decline);
    if (id !== run) return;
    const list = [{ label: 'Actually, let\'s do it', kind: 'primary', onPick: () => greet(true) }];
    if (cfg.business.phone) list.push({ label: 'Call ' + cfg.business.phone, onPick: () => { location.href = 'tel:' + cfg.business.phone.replace(/[^\d+]/g, ''); } });
    list.push({ label: 'Leave the shop', kind: 'ghost', onPick: () => location.reload() });
    choices(list);
  }
  /* ---------------------------------------------------- staff only: back office */
  const TOKEN_KEY = 'hp-owner-token';
  const store = {
    get() { try { return sessionStorage.getItem(TOKEN_KEY); } catch (e) { return null; } },
    set(v) { try { v ? sessionStorage.setItem(TOKEN_KEY, v) : sessionStorage.removeItem(TOKEN_KEY); } catch (e) {} },
  };
  let boardOpen = false;
  const nameplate = t => { $('nameplate').textContent = t; };
  const fillOwner = s => s.replace('{owner}', cfg.owner.name);

  $('staffDoor').addEventListener('click', e => { e.stopPropagation(); staffDoor(); });
  $('scene').addEventListener('mousemove', e => {
    if (S.mode !== 'office' || !boardOpen) return;
    const r = $('scene').getBoundingClientRect();
    const id = S.office.pick((e.clientX - r.left) / r.width * S.office.size.W, (e.clientY - r.top) / r.height * S.office.size.H);
    S.office.hover(id && id !== 'shop' ? id : null);
    $('scene').style.cursor = id ? 'pointer' : '';
  });
  let inMeeting = false;
  const everyone = () => [{ id: 'keith', name: cfg.owner.name, home: cfg.owner.home, seat: cfg.owner.seat }]
    .concat(cfg.directors.map(d => ({ id: d.id, name: d.name, home: d.home, seat: d.seat })));

  async function staffDoor() {
    const id = clear();
    A.door();
    S.mood('idle'); highlight([]);
    await say(cfg.lines.staffDoor);
    if (id !== run) return;
    await pause(300);
    await scene('office');
    S.office.lights(0.15);
    S.office.clear();
    const token = store.get();
    if (token) {
      try { await api.me(token); return enterBoard(); } catch (e) { store.set(null); }
    }
    loginForm();
  }

  async function scene(name) {
    $('fade').classList.add('on');
    await pause(450);
    S.setMode(name);
    $('inside').hidden = name !== 'inside';
    document.body.classList.toggle('office', name === 'office');
    $('fade').classList.remove('on');
    await pause(250);
  }

  async function loginForm(wrong) {
    const id = clear();
    boardOpen = false;
    nameplate('STAFF ONLY');
    const form = el('form', 'form');
    form.innerHTML = `<label class="full">Password<input name="pw" type="password" autocomplete="current-password" maxlength="200"><span class="err"></span></label>`;
    $('panel').appendChild(form);
    const input = form.elements.pw;
    const go = async () => {
      if (!input.value) { A.error(); input.focus(); return; }
      const myRun = clear();
      $('panel').innerHTML = '<div class="loading">Checking</div>';
      try {
        const res = await api.login(input.value);
        if (myRun !== run) return;
        store.set(res.token);
        A.door();
        enterBoard();
      } catch (e) {
        if (myRun !== run) return;
        A.error();
        loginForm(true);
      }
    };
    form.addEventListener('submit', e => { e.preventDefault(); go(); });
    await say(wrong ? cfg.lines.loginWrong : cfg.lines.login);
    if (id !== run) return;
    choices([
      { label: 'Unlock', kind: 'primary', onPick: go },
      { label: 'Back to the shop', kind: 'ghost', sound: 'back', isBack: true, onPick: backToShop },
    ], false);
    if (api.demo) $('hint').textContent = cfg.lines.loginDemo;
    if (matchMedia('(pointer: fine)').matches) input.focus();
  }

  function boardChoices(except) {
    const list = cfg.directors.filter(d => d.id !== except).map(d => ({ label: `${d.name}, ${d.title}`, onPick: () => talkTo(d.id) }));
    if (except) list.push({ label: inMeeting ? 'Back to the meeting' : 'Back to the floor', kind: 'ghost', sound: 'back', isBack: true, onPick: () => floor() });
    if (except !== 'rosa') list.push({ label: 'Customer Service desk', onPick: csDesk });
    if (except !== 'penny') list.push({ label: 'Accounting desk', onPick: () => acctDesk() });
    list.push(inMeeting
      ? { label: 'Adjourn the meeting', kind: 'primary', onPick: adjourn }
      : { label: 'Call a board meeting', kind: 'primary', onPick: callMeeting });
    list.push({ label: 'Back to the shop', kind: 'ghost', sound: 'back', isBack: !except, onPick: backToShop });
    list.push({ label: 'Log out', kind: 'ghost', sound: 'back', onPick: logout });
    return list;
  }

  async function enterBoard() {
    clear();
    boardOpen = true; inMeeting = false;
    report = null; graceKnows = false; handedOff = false;
    S.office.enter(everyone());
    floor(true);
    maybeHandOff();
  }

  async function floor(first) {
    const id = clear();
    nameplate(inMeeting ? 'BOARD MEETING' : 'HEAD OFFICE');
    S.office.select(null);
    const line = first ? cfg.lines.welcome : inMeeting ? cfg.lines.meetingOpen : 'Who do you want to talk to, {owner}?';
    await say(fillOwner(line));
    if (id !== run) return;
    choices(boardChoices());
    $('hint').textContent = 'Click anyone on the floor, or pick a name below. The door on the left goes back to the shop.';
    maybeHandOff();
  }

  async function callMeeting() {
    const id = clear();
    nameplate('BOARD MEETING');
    S.office.select(null);
    inMeeting = true;
    let seated = false;
    S.office.meeting(true, () => { seated = true; if (id === run) floor(); });
    await say(fillOwner(cfg.lines.meetingCall));
    if (id !== run || seated) return;
    $('panel').innerHTML = '<div class="loading">Everyone heading to the boardroom</div>';
  }

  async function adjourn() {
    inMeeting = false;
    S.office.meeting(false);
    const id = clear();
    nameplate('HEAD OFFICE');
    await say(cfg.lines.meetingEnd);
    if (id !== run) return;
    choices(boardChoices());
  }

  async function talkTo(dirId) {
    if (dirId === 'keith') {
      const id = clear();
      S.office.select('keith');
      nameplate(`${cfg.owner.name.toUpperCase()} · ${cfg.owner.title.toUpperCase()}`);
      await say(cfg.lines.itsYou);
      if (id !== run) return;
      return choices(boardChoices());
    }
    if (dirId === 'rosa') return csDesk();
    if (dirId === 'penny') return acctDesk();
    const d = cfg.directors.find(x => x.id === dirId);
    if (!d) return;
    const id = clear();
    S.office.select(d.id);
    nameplate(`${d.name.toUpperCase()} · ${d.title.toUpperCase()}`);
    $('panel').innerHTML = `<div class="card"><h3>WHAT I HANDLE FOR YOU</h3><ul>${d.duties.map(x => `<li>${esc(x)}</li>`).join('')}</ul><p class="soon">${esc(cfg.lines.notConnected)}</p></div>`;
    await say(d.id === 'grace' && graceKnows ? cfg.lines.graceFlag.replace('{days}', overDays()) : d.intro);
    if (id !== run) return;
    choices(boardChoices(d.id));
  }

  /* ------------------------------------------- Customer Service desk (Rosa) */
  let report = null, graceKnows = false, handedOff = false;
  const fmtDate = s => new Date(s + 'T12:00:00Z').toLocaleDateString('en-CA', { timeZone: 'UTC', weekday: 'short', month: 'short', day: 'numeric' });
  const overDays = () => report ? report.capacity.summary.overbooked.map(o => `${fmtDate(o.date)} (${o.pct}%)`).join(', ') : '';
  const bar = p => `<span class="bar"><i style="width:${Math.min(100, p)}%"></i></span>${p}%`;

  async function loadReport() {
    if (report) return report;
    try { report = await api.officeReport(store.get()); } catch (e) { report = null; }
    // In claude.ai, Rosa's runs keep a fresher copy in the arcade's database.
    const L = root.HP_LIVE ? await root.HP_LIVE.load() : undefined;
    if (L) {
      report = Object.assign({}, report || {});
      if (L.report && L.report.capacity && !report.live) Object.assign(report, L.report, { fromRosa: true });
      report.inbox = L.inbox || null;
      if (!liveHooked) {
        liveHooked = true;
        root.HP_LIVE.onInbox(ib => {
          if (!report) return;
          const was = report.inbox && report.inbox.status;
          report.inbox = ib;
          if (onQuestions) drawQuestions(report);
          if (onQuestions && was === 'sent' && ib && ib.status !== 'sent') rosaSays(resultLine(ib));
        });
      }
    }
    return report;
  }
  var liveHooked = false, onQuestions = false, root = window;

  // Once per visit: if days are overbooked, Rosa walks the report to Grace.
  async function maybeHandOff() {
    if (handedOff) return;
    const r = await loadReport();
    if (!r || !r.capacity.summary.overbooked.length || !boardOpen) return;
    handedOff = true;
    setTimeout(() => S.office.errand('rosa', 'v-gm', 5, () => { graceKnows = true; }), 2500);
  }

  async function csDesk() {
    const id = clear();
    S.office.select('rosa');
    nameplate('ROSA · CUSTOMER SERVICE');
    const d = cfg.directors.find(x => x.id === 'rosa');
    const r = await loadReport();
    if (id !== run) return;
    const n = inboxCount(r);
    if (n) return csQuestions();
    $('panel').innerHTML = `<div class="card"><h3>WHAT I HANDLE FOR YOU</h3><ul>${d.duties.map(x => `<li>${esc(x)}</li>`).join('')}</ul></div>`;
    await say(cfg.lines.csDesk);
    if (id !== run) return;
    csChoices();
  }

  /* Rosa's open questions from her morning run. Answers go back to her
     booking-desk session (the arcade can't change ServiceMonster itself). */
  const answers = {};
  let sending = false;
  const inboxCount = r => r && r.inbox && (r.inbox.status || 'open') === 'open' ? (r.inbox.warranty || []).length + (r.inbox.drive || []).length + (r.inbox.ready || []).length : 0;
  const resultLine = ib => ib && ib.results && ib.results.length ? 'Done, boss. ' + ib.results.join(' ') : (ib && ib.status === 'problem' ? 'I hit a problem and changed nothing: ' + (ib.note || 'see my session.') : 'All done.');
  async function rosaSays(line) { await say(line); }
  let answersFor = null;
  const cash = n => "$" + Number(n).toFixed(2);
  const t12 = s => { const [h, m] = s.split(':').map(Number); return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`; };

  function replyText(I) {
    const out = [];
    for (const w of I.warranty) if (answers['w:' + w.ref]) out.push(answers['w:' + w.ref] === 'yes'
      ? `Yes, turn the warranty call ${w.ref} at ${w.address} into a work order.` : `No work order for the warranty call ${w.ref} at ${w.address}.`);
    const okDays = I.drive.filter(d => answers['d:' + d.date] === 'yes'), noDays = I.drive.filter(d => answers['d:' + d.date] === 'no');
    const okBook = I.ready.filter(b => answers['b:' + b.pos.join()] === 'yes'), noBook = I.ready.filter(b => answers['b:' + b.pos.join()] === 'no');
    if (okDays.length || okBook.length) out.push('APPROVE ' + [...okBook.map(b => `booking ${b.address} (${b.pos.join(', ')})`), ...okDays.map(d => `the driving order for ${fmtDate(d.date)}`)].join(' and ') + '.');
    if (noBook.length) out.push('Do not book ' + noBook.map(b => b.address).join(', ') + '.');
    if (noDays.length) out.push('Leave the times as they are on ' + noDays.map(d => fmtDate(d.date)).join(', ') + '.');
    return out.join('\n');
  }

  function drawQuestions(r) {
    const I = r.inbox;
    if (!I) { $('panel').innerHTML = ''; return; }
    if (answersFor !== I.runId) { for (const k of Object.keys(answers)) delete answers[k]; answersFor = I.runId; }
    const when = s => s ? new Date(s).toLocaleString('en-US', { timeZone: cfg.business.timeZone, month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : '';
    if (I.status && I.status !== 'open') {
      const head = I.status === 'sent' ? `<p>Your answers went to Rosa${I.sentAt ? ' at ' + esc(when(I.sentAt)) : ''}. She is re-checking ServiceMonster and making the changes. This updates by itself when she's done.</p><div class="loading">Rosa is on it</div>`
        : I.status === 'problem' ? `<p><b>Rosa stopped and changed nothing:</b> ${esc(I.note || '')}</p>` : '<p>Nothing waiting for you. Everything from this run is handled.</p>';
      const res = (I.results || []).length ? `<div class="q"><h4>WHAT ROSA DID</h4><ul>${I.results.map(x => `<li>${esc(x)}</li>`).join('')}</ul></div>` : '';
      const held = (I.held || []).length ? `<div class="q info"><h4>HELD, NOTHING TO DO</h4><ul>${I.held.map(h => `<li><b>${esc(h.address)}</b> (${esc((h.pos || []).join(', '))}, ${esc(fmtDate(h.date))}): ${esc(h.why)}</li>`).join('')}</ul></div>` : '';
      $('panel').innerHTML = `<div class="report questions"><h3>ROSA'S QUESTIONS · ${esc(I.status === 'sent' ? 'SENT' : I.status === 'problem' ? 'STOPPED' : 'ALL ANSWERED')}</h3><div class="q">${head}</div>${res}${held}<p class="soon">From Rosa's run, ${esc((I.generatedAt || '').replace('T', ' ').slice(0, 16))}.</p></div>`;
      return;
    }
    I.warranty = I.warranty || []; I.ready = I.ready || []; I.drive = I.drive || []; I.held = I.held || [];
    const btns = (key, yes, no) => `<div class="qbtns"><button class="qa ${answers[key] === 'yes' ? 'on' : ''}" data-k="${esc(key)}" data-v="yes">${esc(yes)}</button><button class="qa ${answers[key] === 'no' ? 'on no' : ''}" data-k="${esc(key)}" data-v="no">${esc(no)}</button></div>`;
    let q = 0;
    const cards = [
      ...I.warranty.map(w => `<div class="q"><h4>${++q}. WARRANTY CALL · TIMED</h4><p>Do you want me to turn the warranty call at <b>${esc(w.address)}</b> on <b>${esc(fmtDate(w.date))} at ${esc(t12(w.start))}</b> (${esc(w.ref)}) into a work order?</p>
        <p class="small">Priced like the original cleaning${w.original ? ` (WO ${esc(w.original.wo)})` : ''}: ${w.lines.map(l => `${esc(l.description)} ${cash(l.price * l.qty)}`).join(' + ')} = <b>${cash(w.subtotal)} + GST (${cash(w.total)})</b>. It shows red in ServiceMonster with "WARRANTY - TIMED: arrive at ${esc(t12(w.start))} sharp".</p>
        ${btns('w:' + w.ref, 'Yes, make the work order', 'No')}</div>`),
      ...I.ready.map(b => `<div class="q"><h4>${++q}. NEW JAYMAN BOOKING</h4><p><b>${esc(b.address)}, ${esc(b.city)}</b> · POs ${esc(b.pos.join(', '))} · ${esc(fmtDate(b.date))} at ${esc(t12(b.slot))} · ${cash(b.total)} incl GST${b.addedKm != null ? ` · adds ${b.addedKm} km` : ''}</p>${btns('b:' + b.pos.join(), 'Approve booking', 'Don\'t book')}</div>`),
      ...I.drive.map(d => `<div class="q"><h4>${++q}. BETTER DRIVING ORDER · ${esc(fmtDate(d.date).toUpperCase())}</h4><p>Swap the times so the closest calls are back to back. Saves about <b>${d.saveKm} km</b> (${d.currentKm} km to ${d.bestKm} km).</p>
        <table>${d.order.map(c => `<tr><td><b>${esc(t12(c.to))}</b></td><td>${esc(c.address)}</td><td class="small">${c.from !== c.to ? 'was ' + esc(t12(c.from)) : 'stays'}</td></tr>`).join('')}</table>${btns('d:' + d.date, 'Approve', 'Leave it')}</div>`),
    ];
    const held = I.held.length ? `<div class="q info"><h4>HELD, NOTHING TO DO</h4><ul>${I.held.map(h => `<li><b>${esc(h.address)}</b> (${esc(h.pos.join(', '))}, ${esc(fmtDate(h.date))}): ${esc(h.why)}</li>`).join('')}</ul></div>` : '';
    const text = replyText(I), all = cards.length && Object.keys(answers).length >= cards.length;
    const send = `<div class="q send"><p class="small">The arcade can't change ServiceMonster itself. Your answers go to Rosa's booking desk, and she makes the changes there.</p>
      ${text ? `<pre class="reply">${esc(text)}</pre>` : ''}
      <button class="qa send ${text ? '' : 'dim'}" id="qsend">${all ? 'Send my answers to Rosa' : 'Send the answers I\'ve picked'}</button>${I.session && text ? ` <a class="qa link" href="${esc(I.session)}" target="_blank" rel="noopener noreferrer">Open Rosa's booking desk &#8599;</a>` : ''}<span id="qsent" class="small"></span></div>`;
    $('panel').innerHTML = `<div class="report questions"><h3>ROSA'S QUESTIONS · MORNING RUN</h3>${cards.join('')}${held}${send}<p class="soon">${esc(cfg.lines.snapshotNote.replace('{when}', fmtDate(r.generatedAt.slice(0, 10)) + ' ' + r.generatedAt.slice(11, 16)))}</p></div>`;
    $('panel').querySelectorAll('button.qa[data-k]').forEach(b => b.onclick = () => { answers[b.dataset.k] = b.dataset.v; A.select(); drawQuestions(r); });
    $('qsend').onclick = async () => {
      if (!text || sending) return;
      sending = true;
      $('qsent').textContent = ' Sending to Rosa...';
      const res = root.HP_LIVE ? await root.HP_LIVE.send(I.runId, Object.assign({}, answers), text) : { ok: false, how: 'none' };
      sending = false;
      if (res.ok) { A.select(); I.status = 'sent'; I.sentAt = new Date().toISOString(); drawQuestions(r); rosaSays("Got it, boss. I'm on it. I'll check ServiceMonster again before I change anything."); return; }
      let ok = false;
      try { await navigator.clipboard.writeText(text); ok = true; } catch (e) { }
      if (!ok) { const rg = document.createRange(); rg.selectNodeContents($('panel').querySelector('pre.reply')); const sel = getSelection(); sel.removeAllRanges(); sel.addRange(rg); try { ok = document.execCommand('copy'); } catch (e) { } }
      const why = res.how === 'task' ? (res.error === 'server_not_connected' || res.error === 'not_in_manifest' ? "I couldn't start Rosa's task: allow the Claude Code Remote connector for this page. " : "I couldn't start Rosa's task just now. ") : res.how === 'db' ? "I couldn't save your answers just now. " : '';
      $('qsent').textContent = ' ' + why + (ok ? 'Your answers are copied: open Rosa\'s booking desk and paste them there.' : 'Copy the answer text above and paste it into Rosa\'s booking desk.');
    };
  }

  async function csQuestions() {
    const id = clear();
    onQuestions = true;
    S.office.select('rosa');
    nameplate('ROSA · CUSTOMER SERVICE');
    const r = await loadReport();
    if (id !== run) return;
    const n = inboxCount(r);
    if (!n) {
      if (r && r.inbox) drawQuestions(r); else $('panel').innerHTML = '';
      await say(r && r.inbox && r.inbox.status === 'sent' ? "I'm working on your answers now, boss." : r && r.inbox && r.inbox.status === 'problem' ? "I stopped without changing anything. Have a look." : "No questions for you right now, boss. Everything is handled.");
      if (id === run) csChoices('q'); return;
    }
    drawQuestions(r);
    const I = r.inbox;
    await say(`Morning, boss. I've got ${n} question${n === 1 ? '' : 's'} for you from this morning's run.`
      + (I.held.length ? ` I also held ${I.held.length} order${I.held.length === 1 ? '' : 's'} that ${I.held.length === 1 ? 'was' : 'were'} already booked, so nothing to do there.` : '')
      + ' Tap your answers, then send them to me.');
    if (id !== run) return;
    csChoices('q');
  }

  function csChoices(current) {
    const n = inboxCount(report);
    const list = [
      ...(n || (report && report.inbox) ? [{ label: n ? `My questions (${n})` : 'My questions', kind: current === 'q' ? 'primary' : '', onPick: () => csQuestions() }] : []),
      { label: 'Jayman bookings', kind: current === 'jay' ? 'primary' : '', onPick: () => csReport('jay') },
      { label: 'Booking % by route', kind: current === 'route' ? 'primary' : '', onPick: () => csReport('route') },
      { label: 'Total booking %', kind: current === 'total' ? 'primary' : '', onPick: () => csReport('total') },
      { label: 'Back to the floor', kind: 'ghost', sound: 'back', isBack: true, onPick: () => floor() },
    ];
    choices(list);
  }

  async function csReport(kind) {
    const id = clear();
    S.office.select('rosa');
    nameplate('ROSA · CUSTOMER SERVICE');
    $('panel').innerHTML = '<div class="loading">Pulling it from ServiceMonster</div>';
    const r = await loadReport();
    if (id !== run) return;
    if (!r) {
      $('panel').innerHTML = '';
      await say("I couldn't reach ServiceMonster just now. Try again in a minute.");
      return csChoices(kind);
    }
    const cap = r.capacity, sumr = cap.summary, routes = Object.keys(cfg.office.routes);
    const days = cap.days.filter(d => d.work || d.total.hours);
    const foot = r.live || r.fromRosa ? `<p class="soon">${r.fromRosa ? 'From Rosa\'s last run' : 'Live from ServiceMonster'}, ${esc(r.generatedAt.replace('T', ' ').slice(0, 16))}.</p>`
      : `<p class="soon">${esc(cfg.lines.snapshotNote.replace('{when}', fmtDate(r.generatedAt.slice(0, 10)) + ' ' + r.generatedAt.slice(11, 16)))}</p>`;
    const head = `Next ${cfg.office.daysAhead} days · a full day is ${cfg.office.dayHours} h (4 calls x 2 h)`;
    let html = '', line = '';
    if (kind === 'jay') {
      const J = r.jayman, T = J.totals;
      const badge = c => (c.timed ? `<span class="tag">WARRANTY · TIMED ${esc(c.start)}</span>` : '')
        + (c.needsWO ? '<span class="tag wo">NEEDS WORK ORDER</span>' : '')
        + (c.done ? '<span class="tag ok">DONE</span>' : '');
      const rows = J.days.map(d => {
        const save = d.drive && d.drive.saveKm > 0
          ? `<tr class="drive"><td></td><td colspan="4">Better driving order saves about <b>${d.drive.saveKm} km</b> (${d.drive.currentKm} km to ${d.drive.bestKm} km): ${d.drive.order.map(c => `${esc(c.newStart)} ${esc(c.address)}`).join(' &rarr; ')}</td></tr>` : '';
        return `<tr class="dayrow"><td>${esc(fmtDate(d.date))}</td><td><b>${d.total}</b> call${d.total === 1 ? '' : 's'}</td><td>${d.done} done</td><td>${d.todo} to do</td><td></td></tr>`
          + d.calls.map(c => `<tr class="${c.done ? 'done' : ''}"><td></td><td>${c.timed ? '<b>' + esc(c.start) + '</b>' : esc(c.start)}</td><td>${esc(c.address || c.label)}</td><td>${esc(c.route)}</td><td>${badge(c)}</td></tr>`).join('') + save;
      }).join('');
      html = `<div class="report"><h3>JAYMAN CALLS · NEXT ${cfg.office.daysAhead} DAYS</h3>
        <div class="kpis"><div>Total<br><span class="big">${T.total}</span></div><div>Done<br><span class="big">${T.done}</span></div><div>To do<br><span class="big">${T.todo}</span></div>${T.needsWO ? `<div>Need a work order<br><span class="big">${T.needsWO}</span></div>` : ''}</div>
        <table><tr><th>Day</th><th>Calls</th><th></th><th></th><th></th></tr>${rows || '<tr><td colspan="5">Nothing booked.</td></tr>'}</table>
        <p class="soon">Every Jayman account, on any route, plus calendar activities that mention Jayman. Warranty calls are timed: the crew has to arrive at that time. All other Jayman calls only have to happen that day, so their order can change to cut driving.</p>${foot}</div>`;
      const timed = J.days.flatMap(d => d.calls).filter(c => c.timed && !c.done);
      const saves = J.days.filter(d => d.drive && d.drive.saveKm > 0);
      line = `${T.total} Jayman calls in the next two weeks: ${T.done} done, ${T.todo} to go.`
        + (timed.length ? ` ${timed.map(c => `The warranty call on ${fmtDate(c.date)} at ${c.start} is timed${c.needsWO ? '. Do you want me to turn it into a work order? I\'ll price it like the original cleaning and mark it red and timed in ServiceMonster. I\'ll ask you in my morning report' : ''}.`).join(' ')}` : '')
        + (saves.length ? ` I can save about ${saves.reduce((s, d) => s + d.drive.saveKm, 0)} km of driving by reordering ${saves.map(d => fmtDate(d.date)).join(', ')}.` : '');
    } else if (kind === 'route') {
      const rows = days.map(d => `<tr class="${routes.some(k => d.routes[k].pct > 100) ? 'over' : ''}"><td>${esc(fmtDate(d.date))}</td>${routes.map(k => `<td>${bar(d.routes[k].pct)} <small>(${d.routes[k].jobs})</small></td>`).join('')}</tr>`).join('');
      html = `<div class="report"><h3>BOOKING % BY ROUTE</h3><div class="kpis">${routes.map(k => `<div>${esc(k)}<br><span class="big">${sumr.routes[k].pct}%</span></div>`).join('')}<div>${esc(head)}</div></div>
        <table><tr><th>Day</th>${routes.map(k => `<th>${esc(k)} (calls)</th>`).join('')}</tr>${rows}</table>${foot}</div>`;
      line = routes.map(k => `${k} is ${sumr.routes[k].pct}% full`).join(', ') + ' over the next two weeks.';
    } else {
      const rows = days.map(d => `<tr class="${d.over ? 'over' : ''}"><td>${esc(fmtDate(d.date))}</td><td>${bar(d.total.pct)}${d.over ? '<span class="tag">OVERBOOKED</span>' : ''}</td><td class="why">${esc(d.over ? d.big.map(b => `${b.label}: ${b.hours} h on ${b.route}`).join(', ') : '')}${d.notes.length ? esc((d.over ? ' · ' : '') + 'Notes: ' + d.notes.join(', ')) : ''}</td></tr>`).join('');
      html = `<div class="report"><h3>TOTAL BOOKING % · ONE TRUCK</h3><div class="kpis"><div>All routes<br><span class="big">${sumr.total.pct}%</span></div><div>${esc(head)}</div></div>
        <table><tr><th>Day</th><th>Truck</th><th>Why</th></tr>${rows}</table>${foot}</div>`;
      line = sumr.overbooked.length ? cfg.lines.csOver.replace('{days}', overDays()) : cfg.lines.csFine;
    }
    $('panel').innerHTML = html;
    await say(line);
    if (id !== run) return;
    csChoices(kind);
  }

  /* ------------------------------------------------ Accounting desk (Penny) */
  let ledger = null;
  const $$ = n => '$' + Number(n || 0).toLocaleString('en-CA', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const pct = (a, b) => b ? Math.round((a - b) / b * 100) : null;
  async function loadLedger() {
    if (ledger) return ledger;
    const snap = (window.HP_OFFICE_DATA || {}).penny || null;
    ledger = { brief: snap, expenses: null, fromSnapshot: !!snap };
    const month = (snap ? snap.date : new Date().toISOString()).slice(0, 7);
    const L = root.HP_LIVE ? await root.HP_LIVE.penny(month) : undefined;
    if (L && L.brief) ledger = { brief: L.brief, expenses: L.expenses, fromSnapshot: false };
    if (L && !L.brief && L.expenses) ledger.expenses = L.expenses;
    return ledger;
  }
  function acctChoices(current) {
    choices([
      { label: 'Daily brief', kind: current === 'day' ? 'primary' : '', onPick: () => acctReport('day') },
      { label: 'This month', kind: current === 'month' ? 'primary' : '', onPick: () => acctReport('month') },
      { label: 'Not paid yet', kind: current === 'unpaid' ? 'primary' : '', onPick: () => acctReport('unpaid') },
      { label: 'Expenses', kind: current === 'exp' ? 'primary' : '', onPick: () => acctReport('exp') },
      { label: 'Add a receipt', kind: current === 'rcpt' ? 'primary' : '', onPick: () => receiptForm() },
      { label: 'Back to the floor', kind: 'ghost', sound: 'back', isBack: true, onPick: () => floor() },
    ]);
  }
  async function acctDesk() {
    const id = clear();
    S.office.select('penny');
    nameplate('PENNY · ACCOUNTING');
    await loadLedger();
    if (id !== run) return;
    if (ledger.brief) return acctReport('day');
    $('panel').innerHTML = '';
    await say("My first brief comes in tonight at 8, boss. Check back after that.");
    if (id === run) acctChoices();
  }
  function kpis(s, prev) {
    const cmp = (a, b) => { const p = pct(a, b); return p == null ? '' : `<small class="${p < 0 ? 'down' : 'up'}">${p >= 0 ? '+' : ''}${p}% vs last month</small>`; };
    return `<div class="kpis">
      <div>Jobs done<br><span class="big">${s.jobs}</span>${prev ? cmp(s.jobs, prev.jobs) : ''}</div>
      <div>Revenue<br><span class="big">${$$(s.revenue)}</span>${prev ? cmp(s.revenue, prev.revenue) : ''}</div>
      <div>Billed<br><span class="big">${$$(s.billed)}</span></div>
      <div>Paid<br><span class="big">${$$(s.paid)}</span></div>
      <div>GST collected<br><span class="big">${$$(s.gst)}</span></div>
      <div>Km driven<br><span class="big">~${s.km}</span></div>
      <div>Avg job<br><span class="big">${$$(s.avgJob)}</span>${prev ? cmp(s.avgJob, prev.avgJob) : ''}</div>
      <div>Revenue per km<br><span class="big">${$$(s.revPerKm)}</span></div></div>`;
  }
  async function acctReport(kind) {
    const id = clear();
    S.office.select('penny');
    nameplate('PENNY · ACCOUNTING');
    $('panel').innerHTML = '<div class="loading">Pulling the books</div>';
    await loadLedger();
    if (id !== run) return;
    const B = ledger.brief, E = ledger.expenses;
    if (!B) { $('panel').innerHTML = ''; await say("Nothing from me yet, boss. My first brief is tonight at 8."); if (id === run) acctChoices(kind); return; }
    const foot = `<p class="soon">${ledger.fromSnapshot ? 'Snapshot of' : 'From'} Penny's brief for ${esc(fmtDate(B.date))}, made ${esc(String(B.generatedAt).replace('T', ' ').slice(0, 16))}. ${esc((B.notes || []).join(' '))}</p>${B.session ? `<p class="soon"><a class="qa link" href="${esc(B.session)}" target="_blank" rel="noopener noreferrer">Open Penny's session (receipts, questions) &#8599;</a></p>` : ''}`;
    const expItems = E && E.items ? E.items : [];
    const expDay = expItems.filter(x => x.date === B.date), expMonth = expItems;
    const tot = l => l.reduce((s, x) => s + Number(x.amount || 0), 0);
    let html = '', line = '';
    if (kind === 'day') {
      const T = B.today;
      const rows = T.list.map(j => `<tr><td>WO ${esc(j.wo)}</td><td>${esc(j.account)}</td><td>${$$(j.total)}</td><td><span class="tag ${j.status === 'Paid' || j.status === 'Paid on site' ? 'ok' : j.status === 'Not paid' || j.status === 'Not invoiced yet' ? '' : 'wo'}">${esc(j.status.toUpperCase())}</span>${j.status === 'Not paid' || j.status === 'Billed, waiting' ? ' owes ' + $$(j.balance) : ''}${j.method ? ' (' + esc(j.method) + ')' : ''}${j.invoicedOn ? ` <small>(invoiced ${esc(fmtDate(j.invoicedOn))})</small>` : ''}</td></tr>`).join('');
      html = `<div class="report"><h3>DAILY BRIEF · ${esc(fmtDate(B.date).toUpperCase())}</h3>${kpis(T)}
        <table><tr><th>Job</th><th>Customer</th><th>Total</th><th>Paid?</th></tr>${rows || '<tr><td colspan="4">No jobs completed.</td></tr>'}</table>
        <p>Expenses today: <b>${$$(tot(expDay))}</b>${expDay.length ? ` (${expDay.length} receipt${expDay.length === 1 ? '' : 's'})` : ' (none recorded yet)'}. Revenue less expenses: <b>${$$(T.revenue - tot(expDay))}</b>.</p>${foot}</div>`;
      const np = T.list.filter(j => j.status === 'Not paid');
      line = T.jobs ? `${T.jobs} job${T.jobs === 1 ? '' : 's'} done on ${fmtDate(B.date)}: ${$$(T.revenue)} revenue, ${$$(T.paid)} paid, about ${T.km} km.` + (np.length ? ` ${np.length} not paid yet.` : ' Everything that should be paid is paid.') : `No completed jobs on ${fmtDate(B.date)}, boss.`;
    } else if (kind === 'month') {
      const M = B.month, P = B.lastMonth;
      const rows = (M.days || []).map(d => `<tr><td>${esc(fmtDate(d.date))}</td><td>${d.jobs}</td><td>${$$(d.revenue)}</td><td>~${d.km}</td></tr>`).join('');
      html = `<div class="report"><h3>THIS MONTH · ${esc(fmtDate(M.from))} TO ${esc(fmtDate(M.to))}</h3>${kpis(M, P)}
        <p>Same days last month (${esc(fmtDate(P.from))} to ${esc(fmtDate(P.to))}): ${P.jobs} jobs, ${$$(P.revenue)} revenue, ${$$(P.paid)} paid, ~${P.km} km.</p>
        <p>Expenses this month: <b>${$$(tot(expMonth))}</b>. Revenue less expenses: <b>${$$(M.revenue - tot(expMonth))}</b>. GST to set aside: <b>${$$(M.gst)}</b>${expMonth.length ? `, less GST paid on receipts ${$$(expMonth.reduce((s, x) => s + Number(x.gst || 0), 0))}` : ''}.</p>
        <table><tr><th>Day</th><th>Jobs</th><th>Revenue</th><th>Km</th></tr>${rows}</table>${foot}</div>`;
      const p = pct(M.revenue, P.revenue);
      line = `Month to date: ${M.jobs} jobs and ${$$(M.revenue)} revenue` + (p == null ? '.' : `, ${p >= 0 ? 'up' : 'down'} ${Math.abs(p)}% on the same days last month.`);
    } else if (kind === 'unpaid') {
      const U = B.unpaid;
      const tbl = l => l.map(o => `<tr><td>WO ${esc(o.wo)}</td><td>${esc(o.account)}${o.billed ? ' <span class="tag wo">BILLED</span>' : ''}${o.method ? ' (' + esc(o.method) + ')' : ''}</td><td>${esc(o.completed ? fmtDate(o.completed) : '')}</td><td>${o.days != null ? o.days + ' days' : ''}</td><td>${$$(o.balance)}</td></tr>`).join('');
      html = `<div class="report"><h3>NOT PAID YET · RUNNING TOTAL</h3>
        <div class="kpis"><div>Not paid<br><span class="big">${$$(U.notPaidTotal)}</span>${U.notPaid.length} jobs</div><div>Over 30 days<br><span class="big">${$$(U.over30)}</span></div><div>Over 60 days<br><span class="big">${$$(U.over60)}</span></div><div>Commercial, billed<br><span class="big">${$$(U.commercialTotal)}</span>${U.commercial.length} jobs</div></div>
        <table><tr><th>Job</th><th>Customer</th><th>Done</th><th>Age</th><th>Owes</th></tr>${tbl(U.notPaid)}</table>
        ${U.commercial.length ? `<h3>COMMERCIAL, BILLED</h3><table>${tbl(U.commercial)}</table>` : ''}
        ${(U.toRecord || []).length ? `<h3>PAID ON SITE · ENTER THE PAYMENT IN SERVICEMONSTER</h3><table>${tbl(U.toRecord)}</table>` : ''}
        ${(B.notInvoiced || []).length ? `<h3>DONE BUT NOT INVOICED YET</h3><table>${B.notInvoiced.map(o => `<tr><td>WO ${esc(o.wo)}</td><td>${esc(o.account)}</td><td>${esc(fmtDate(o.done))}</td><td>${$$(o.total)}</td></tr>`).join('')}</table>` : ''}
        ${(B.askCommercial || []).length ? `<p class="soon">Penny will ask you whether these are commercial accounts on billing: ${esc(B.askCommercial.map(a => a.name).join(', '))}.</p>` : ''}
        <p class="soon">Every non-Jayman invoice in ServiceMonster with a balance, oldest first. Jayman jobs are billed through Supply Pro and are not listed.</p>${foot}</div>`;
      line = `${U.notPaid.length} jobs not paid yet, ${$$(U.notPaidTotal)} in all. ${$$(U.over60)} of it is over 60 days old.` + ((U.toRecord || []).length ? ` ${U.toRecord.length === 1 ? '1 job was' : U.toRecord.length + ' jobs were'} paid on site and still need${U.toRecord.length === 1 ? 's' : ''} the payment entered in ServiceMonster.` : '') + ((B.notInvoiced || []).length ? ` And ${B.notInvoiced.length} job${B.notInvoiced.length === 1 ? ' is' : 's are'} done but not invoiced yet.` : '');
    } else {
      const cats = {}; for (const x of expMonth) cats[x.category || 'Other'] = (cats[x.category || 'Other'] || 0) + Number(x.amount || 0);
      html = `<div class="report"><h3>EXPENSES · ${esc((E && E.month) || B.date.slice(0, 7))}</h3>
        <div class="kpis"><div>Today<br><span class="big">${$$(tot(expDay))}</span></div><div>This month<br><span class="big">${$$(tot(expMonth))}</span></div><div>GST paid (ITCs)<br><span class="big">${$$(expMonth.reduce((s, x) => s + Number(x.gst || 0), 0))}</span></div></div>
        ${Object.keys(cats).length ? `<table><tr><th>Category</th><th>This month</th></tr>${Object.entries(cats).sort((a, b) => b[1] - a[1]).map(([c, v]) => `<tr><td>${esc(c)}</td><td>${$$(v)}</td></tr>`).join('')}</table>
        <table><tr><th>Date</th><th>Where</th><th>Category</th><th>Amount</th><th>GST</th></tr>${expMonth.slice().reverse().map(x => `<tr><td>${esc(fmtDate(x.date))}</td><td>${esc(x.vendor || '')}${x.photoId ? ` <a href="/_blob/${esc(x.photoId)}" target="_blank" rel="noopener">photo</a>` : ''}</td><td>${esc(x.category || '')}</td><td>${$$(x.amount)}</td><td>${$$(x.gst)}</td></tr>`).join('')}</table>` : '<p>No receipts recorded yet. Tap <b>Add a receipt</b> to snap one with your phone, or give them to Penny after her nightly brief.</p>'}${foot}</div>`;
      line = expMonth.length ? `${$$(tot(expMonth))} in expenses this month so far.` : "No receipts yet this month. I'll ask you for them each night after the brief.";
    }
    $('panel').innerHTML = html;
    await say(line);
    if (id !== run) return;
    acctChoices(kind);
  }

  /* Receipts: a photo from the phone, Penny reads it, asks what she needs, saves it. */
  const CATS = ['Fuel', 'Vehicle repairs and maintenance', 'Vehicle insurance and registration', 'Supplies and materials', 'Tools and equipment',
    'Advertising and marketing', 'Phone and internet', 'Office and software', 'Meals (50% deductible)', 'Subcontractors', 'Insurance', 'Bank and card fees', 'Other'];
  const PAID = ['Company card', 'Cash', 'Personal card', 'E-transfer'];
  let rc = null;   // the receipt being entered

  async function shrink(file) {
    try {
      const bmp = await createImageBitmap(file);
      const k = Math.min(1, 1600 / Math.max(bmp.width, bmp.height));
      const c = document.createElement('canvas');
      c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
      c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
      return await new Promise(r => c.toBlob(b => r(b || file), 'image/jpeg', 0.85));
    } catch (e) { return file; }
  }

  async function receiptForm() {
    const id = clear();
    S.office.select('penny');
    nameplate('PENNY · ACCOUNTING');
    const L = root.HP_LIVE;
    const can = L ? await L.receiptAbilities() : { canRead: false, canStore: false, canSave: false };
    if (id !== run) return;
    const today = (window.HP_SCHEDULE ? HP_SCHEDULE.localNow(cfg.business.timeZone) : new Date().toISOString()).slice(0, 10);
    rc = { date: today, vendor: '', total: '', gst: '', category: '', paidWith: '', note: '', photo: null, preview: '', read: false, question: '' };
    drawReceipt(can);
    await say(can.canSave
      ? (can.canRead ? "Snap a photo of the receipt and I'll read it, or type it in. I'll ask if anything's unclear." : "Type the receipt in and I'll file it. (Reading photos isn't available here.)")
      : "I can only save receipts when the arcade is open in claude.ai. Give them to me in my nightly session for now.");
    if (id !== run) return;
    acctChoices('rcpt');
  }

  function drawReceipt(can) {
    const R = rc, field = (k, label, type, extra) => `<label class="rf"><span>${esc(label)}</span><input data-k="${k}" type="${type}" value="${esc(R[k])}" ${extra || ''}></label>`;
    const pick = (k, list) => `<div class="qbtns">${list.map(v => `<button class="qa ${R[k] === v ? 'on' : ''}" data-pick="${k}" data-v="${esc(v)}">${esc(v)}</button>`).join('')}</div>`;
    const missing = [];
    if (!R.date) missing.push('date'); if (!R.vendor) missing.push('where'); if (!(Number(R.total) > 0)) missing.push('total');
    if (R.gst === '') missing.push('GST (0 if none)'); if (!R.category) missing.push('category'); if (!R.paidWith) missing.push('how you paid');
    $('panel').innerHTML = `<div class="report questions receipt"><h3>ADD A RECEIPT</h3>
      ${can.canSave ? '' : '<p><b>Saving needs the arcade open in claude.ai.</b></p>'}
      ${can.canRead ? `<div class="q"><h4>1. PHOTO</h4>
        <label class="qa photo">${R.preview ? 'Retake photo' : 'Take or choose a photo'}<input id="rphoto" type="file" accept="image/*" capture="environment" hidden></label>
        ${R.preview ? `<img class="rprev" src="${R.preview}" alt="Receipt photo">` : ''}
        <span id="rstatus" class="small">${R.read ? 'Penny read it. Check the numbers below.' : ''}</span></div>` : ''}
      ${R.question ? `<div class="q info"><h4>PENNY ASKS</h4><p>${esc(R.question)}</p><p class="small">Answer by picking below, or add it to the note.</p></div>` : ''}
      <div class="q"><h4>${can.canRead ? '2' : '1'}. THE RECEIPT</h4>
        <div class="rgrid">${field('date', 'Date', 'date')}${field('vendor', 'Where', 'text', 'placeholder="e.g. Shell, Home Depot"')}
        ${field('total', 'Total paid (incl. GST)', 'number', 'step="0.01" min="0" inputmode="decimal"')}${field('gst', 'GST on it', 'number', 'step="0.01" min="0" inputmode="decimal"')}</div>
        ${field('note', 'What it was for', 'text', 'placeholder="e.g. truck fuel, filters for the Viper"')}</div>
      <div class="q"><h4>${can.canRead ? '3' : '2'}. CATEGORY</h4>${pick('category', CATS)}</div>
      <div class="q"><h4>${can.canRead ? '4' : '3'}. HOW DID YOU PAY?</h4>${pick('paidWith', PAID)}</div>
      <div class="q send">${missing.length ? `<p class="small">Still needed: ${esc(missing.join(', '))}.</p>` : ''}
        <button class="qa send ${missing.length || !can.canSave ? 'dim' : ''}" id="rsave">Save receipt</button><span id="rsaved" class="small"></span></div></div>`;
    const panel = $('panel');
    panel.querySelectorAll('input[data-k]').forEach(i => i.oninput = () => { R[i.dataset.k] = i.value; });
    panel.querySelectorAll('input[data-k]').forEach(i => i.onchange = () => drawReceipt(can));
    panel.querySelectorAll('button[data-pick]').forEach(b => b.onclick = () => { R[b.dataset.pick] = b.dataset.v; A.select(); drawReceipt(can); });
    const ph = $('rphoto');
    if (ph) ph.onchange = async () => {
      const f = ph.files && ph.files[0];
      if (!f) return;
      R.photo = await shrink(f);
      R.preview = URL.createObjectURL(R.photo);
      R.read = false; R.question = '';
      drawReceipt(can);
      $('rstatus').textContent = ' Penny is reading it...';
      try {
        const got = await root.HP_LIVE.readReceipt(R.photo, CATS);
        if (got && typeof got === 'object') {
          if (/^\d{4}-\d\d-\d\d$/.test(got.date || '')) R.date = got.date;
          if (got.vendor) R.vendor = String(got.vendor).slice(0, 80);
          if (Number(got.total) > 0) R.total = String(Number(got.total).toFixed(2));
          if (got.gst !== undefined && got.gst !== null && !isNaN(Number(got.gst))) R.gst = String(Number(got.gst).toFixed(2));
          if (CATS.includes(got.category)) R.category = got.category;
          const pw = String(got.paidWith || '').toLowerCase();
          if (pw === 'cash') R.paidWith = 'Cash'; else if (pw === 'e-transfer') R.paidWith = 'E-transfer';
          if (got.items && !R.note) R.note = String(got.items).slice(0, 120);
          R.question = [got.sure === false ? "Some numbers were hard to read. Please check the total and GST." : '', got.question || '',
            !R.paidWith ? 'How did you pay for this one?' : ''].filter(Boolean).join(' ');
          R.read = true;
        }
        drawReceipt(can);
        say(R.question ? R.question : `Got it: ${R.vendor || 'the receipt'}, ${$$(R.total)}. Looks like ${R.category || 'I need a category'}. Check it and save.`);
      } catch (e) {
        drawReceipt(can);
        $('rstatus').textContent = e && e.code === 'not_granted' ? ' Reading photos was turned off. Type it in instead.' : " I couldn't read that one. Type it in, or try a clearer photo.";
      }
    };
    $('rsave').onclick = async () => {
      if (missing.length || !can.canSave) return;
      $('rsaved').textContent = ' Saving...';
      let photo = null;
      if (R.photo && can.canStore) photo = await root.HP_LIVE.storeReceipt(R.photo);
      const item = { date: R.date, vendor: R.vendor.trim(), category: R.category, amount: Math.round(Number(R.total) * 100) / 100, gst: Math.round(Number(R.gst || 0) * 100) / 100,
        paidWith: R.paidWith, note: R.note.trim(), photoId: photo ? photo.id : '', enteredIn: 'arcade', enteredAt: new Date().toISOString() };
      try {
        const doc = await root.HP_LIVE.saveExpense(item);
        if (ledger && (!ledger.expenses || ledger.expenses.month === doc.month)) ledger.expenses = doc;
        A.select();
        const monthTotal = doc.items.reduce((s2, x) => s2 + Number(x.amount || 0), 0);
        await say(`Filed: ${item.vendor}, ${$$(item.amount)} under ${item.category}. That's ${$$(monthTotal)} in expenses for ${doc.month} so far.${photo ? '' : ' (No photo kept.)'} Keep the paper copy.`);
        rc = null;
        receiptAgain();
      } catch (e) { $('rsaved').textContent = " Couldn't save just now. Try again in a minute."; }
    };
  }
  function receiptAgain() {
    choices([
      { label: 'Add another receipt', kind: 'primary', onPick: () => receiptForm() },
      { label: 'See expenses', onPick: () => acctReport('exp') },
      { label: 'Back to the floor', kind: 'ghost', sound: 'back', isBack: true, onPick: () => floor() },
    ]);
  }

  async function backToShop() {
    clear();
    boardOpen = false; inMeeting = false;
    S.office.clear();
    await scene('inside');
    nameplate(cfg.host.name.toUpperCase());
    greet(true);
  }

  function logout() {
    store.set(null);
    backToShop();
  }
})();
