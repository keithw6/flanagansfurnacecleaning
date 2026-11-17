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
  // the Dust Bunny Blaster prize, if this customer won one (kept 30 days in their browser)
  const promoNow = () => { const p = root.HP_BUNNY && HP_BUNNY.prize(); return p ? { pct: p.pct, code: p.code } : null; };
  const running = () => P.quote(state.answers, state.travel, undefined, promoNow());

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
      { label: 'How do you clean my ducts?', onPick: () => openHowTo() },
      { label: promoNow() ? `Book with my ${promoNow().pct}% off` : 'Play to win up to 10% off', onPick: () => promoNow() ? ask('town') : openBunny() },
      { label: 'Just looking at prices', kind: 'ghost', onPick: browse },
    ]);
  }

  /* "How we clean" brochure on the counter: the 7 steps from homeprosgroup.com */
  let howtoBack = null;
  function openHowTo() {
    const m = $('howtoModal');
    if (!m || !root.HP_PROCESS) return;
    root.HP_PROCESS.mount($('howtoMount'));
    howtoBack = document.activeElement;
    m.hidden = false;
    m.scrollTop = 0;
    $('howtoClose').focus();
    A.select();
    if (S.mood) S.mood('talk');
    say(cfg.lines.howTo || "Here's exactly how we do it, start to finish. Tap any step to jump to it.");
  }
  function closeHowTo() {
    const m = $('howtoModal');
    if (!m || m.hidden) return;
    m.hidden = true;
    A.back();
    if (S.mood) S.mood('idle');
    if (howtoBack && howtoBack.focus) howtoBack.focus();
  }
  if ($('howtoBtn')) $('howtoBtn').onclick = openHowTo;
  if ($('howtoClose')) $('howtoClose').onclick = closeHowTo;
  if ($('howtoModal')) $('howtoModal').addEventListener('click', e => { if (e.target === $('howtoModal')) closeHowTo(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && $('howtoModal') && !$('howtoModal').hidden) { e.stopPropagation(); closeHowTo(); } }, true);

  /* Dust Bunny Blaster: the game brochure on the counter */
  let bunnyBack = null, bunnyGame = null;
  function openBunny() {
    const m = $('bunnyModal');
    if (!m || !root.HP_BUNNY) return;
    if (bunnyGame) bunnyGame.stop();
    bunnyGame = root.__bunnyGame = HP_BUNNY.mount($('bunnyMount'), {
      sound: { blip: () => A.blip(), select: () => A.select(), back: () => A.back(), error: () => A.error(), win: () => A.win() },
      onResult: (p, hits) => { if (p && hits >= HP_BUNNY.GOAL5) { S.celebrate && S.celebrate(); } },
      onBook: p => { closeBunny(); state.history = []; say(p ? `${p.pct}% off, nice shooting! Let's get your price.` : "Let's get your price."); setTimeout(() => ask('town'), 600); },
    });
    bunnyBack = document.activeElement;
    m.hidden = false; m.scrollTop = 0;
    $('bunnyClose').focus();
    A.select();
    if (S.mood) S.mood('talk');
    say(promoNow() ? `You've got ${promoNow().pct}% off saved. Play again or book it in.` : 'Those dust bunnies are breeding in the vents. Zap 15 and I\'ll knock 5% off. Zap 18 and it\'s 10%.');
  }
  function closeBunny() {
    const m = $('bunnyModal');
    if (!m || m.hidden) return;
    m.hidden = true;
    if (bunnyGame) { bunnyGame.stop(); bunnyGame = null; }
    A.back();
    if (S.mood) S.mood('idle');
    if (bunnyBack && bunnyBack.focus) bunnyBack.focus();
  }
  if ($('bunnyBtn')) $('bunnyBtn').onclick = openBunny;
  if ($('bunnyClose')) $('bunnyClose').onclick = closeBunny;
  if ($('bunnyModal')) $('bunnyModal').addEventListener('click', e => { if (e.target === $('bunnyModal')) closeBunny(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && $('bunnyModal') && !$('bunnyModal').hidden) { e.stopPropagation(); closeBunny(); } }, true);

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
      const res = await api.book({ answers: state.answers, customer, start: state.slot.start, website, promo: promoNow() });
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
    const pz = promoNow();
    if (pz && root.HP_BUNNY) HP_BUNNY.spend();
    await say(cfg.lines.booked + (pz ? ` Your ${pz.pct}% Dust Bunny Blaster prize is on the work order, and Rosa takes it off your bill.` : '') + (api.demo ? ' (Demo mode: nothing was actually booked.)' : ''));
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
    if (except !== 'eddie') list.push({ label: 'Email desk', onPick: () => emailDesk() });
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
    if (dirId === 'eddie') return emailDesk();
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
    ledger = { brief: snap, expenses: null, fromSnapshot: !!snap, marks: { jobs: {} }, accounts: { commercial: [], notCommercial: [] }, live: false };
    const month = (snap ? snap.date : new Date().toISOString()).slice(0, 7);
    const L = root.HP_LIVE ? await root.HP_LIVE.penny(month) : undefined;
    if (L && L.brief) ledger = { brief: L.brief, expenses: L.expenses, fromSnapshot: false, marks: L.marks, accounts: L.accounts, live: true };
    else if (L) Object.assign(ledger, { marks: L.marks, accounts: L.accounts, live: true });
    applyAnswers();
    if (L && !L.brief && L.expenses) ledger.expenses = L.expenses;
    return ledger;
  }
  function acctChoices(current) {
    const n = pennyQs().length;
    choices([
      ...(n || current === 'pq' ? [{ label: n ? `Penny's questions (${n})` : "Penny's questions", kind: current === 'pq' ? 'primary' : '', onPick: () => pennyQuestions() }] : []),
      { label: 'Daily brief', kind: current === 'day' ? 'primary' : '', onPick: () => acctReport('day') },
      { label: 'This month', kind: current === 'month' ? 'primary' : '', onPick: () => acctReport('month') },
      { label: 'Not paid yet', kind: current === 'unpaid' ? 'primary' : '', onPick: () => acctReport('unpaid') },
      { label: 'Profit & loss', kind: current === 'pl' ? 'primary' : '', onPick: () => profitLoss() },
      { label: 'Expenses by month', kind: current === 'exp' ? 'primary' : '', onPick: () => expenseMonth() },
      { label: 'Add a receipt', kind: current === 'rcpt' ? 'primary' : '', onPick: () => receiptForm() },
      { label: 'Card statements', kind: current === 'stmt' ? 'primary' : '', onPick: () => stmtHome() },
      { label: 'Back to the floor', kind: 'ghost', sound: 'back', isBack: true, onPick: () => floor() },
    ]);
  }
  async function acctDesk() {
    const id = clear();
    S.office.select('penny');
    nameplate('PENNY · ACCOUNTING');
    await loadLedger();
    if (id !== run) return;
    if (ledger.brief && pennyQs().length) return pennyQuestions();
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
  // The rest of Penny's nightly report, under the day's jobs.
  function fullBrief(B, E, expDay, expMonth, tot) {
    const M = B.month, P = B.lastMonth, U = B.unpaid;
    const ch = (a, b) => { const p = pct(a, b); return p == null ? '' : `<span class="${p < 0 ? 'down' : 'up'}">${p >= 0 ? '+' : ''}${p}%</span>`; };
    const mrow = (label, a, b, f) => `<tr><td>${label}</td><td>${f(a)}</td><td>${f(b)}</td><td>${ch(a, b)}</td></tr>`;
    const money = v => $$(v), km = v => '~' + v, n = v => String(v);
    const gstPaid = expMonth.reduce((t, x) => t + Number(x.gst || 0), 0);
    const cats = {}; for (const x of expMonth) cats[x.category || 'Other'] = (cats[x.category || 'Other'] || 0) + Number(x.amount || 0);
    const oldest = (U.notPaid || []).slice(0, 5);
    const big = (U.notPaid || []).filter(o => o.days > 60).sort((x, y) => y.balance - x.balance)[0];
    const looks = [
      big ? `WO ${esc(big.wo)} (${esc(big.account)}, ${$$(big.balance)}) is the biggest old balance, ${big.days} days.` : '',
      (B.notInvoiced || []).length ? `${B.notInvoiced.map(o => 'WO ' + esc(o.wo)).join(', ')} still need${B.notInvoiced.length === 1 ? 's' : ''} invoicing.` : '',
      (U.toRecord || []).length ? `${U.toRecord.length} paid-on-site job${U.toRecord.length === 1 ? '' : 's'} to enter in ServiceMonster.` : '',
      M.jobs > P.jobs && M.avgJob < P.avgJob ? 'More jobs than last month, but smaller ones (average job down).' : '',
    ].filter(Boolean);
    const Q = pennyQs().length;
    return `
      <h3>THIS MONTH · ${esc(fmtDate(M.from))} TO ${esc(fmtDate(M.to))} VS ${esc(fmtDate(P.from))} TO ${esc(fmtDate(P.to))}</h3>
      <table class="cmp"><tr><th></th><th>This month</th><th>Last month</th><th>Change</th></tr>
        ${mrow('Jobs', M.jobs, P.jobs, n)}${mrow('Revenue', M.revenue, P.revenue, money)}${mrow('Billed', M.billed, P.billed, money)}${mrow('Paid', M.paid, P.paid, money)}
        ${mrow('GST collected', M.gst, P.gst, money)}${mrow('Km', M.km, P.km, km)}${mrow('Average job', M.avgJob, P.avgJob, money)}${mrow('Revenue per km', M.revPerKm, P.revPerKm, money)}</table>
      <h3>NOT PAID YET · ${$$(U.notPaidTotal)} · ${U.notPaid.length} JOBS</h3>
      <p>Over 30 days: <b>${$$(U.over30)}</b>. Over 60 days: <b>${$$(U.over60)}</b>. Commercial, billed (waiting for payment): <b>${$$(U.commercialTotal)}</b>, ${U.commercial.length} jobs.</p>
      ${oldest.length ? `<table><tr><th>Oldest</th><th>Customer</th><th>Done</th><th>Owes</th></tr>${oldest.map(o => `<tr><td>WO ${esc(o.wo)}</td><td>${esc(o.account)}</td><td>${esc(o.completed ? fmtDate(o.completed) : '')} <small>(${o.days} days)</small></td><td>${$$(o.balance)}</td></tr>`).join('')}</table>` : ''}
      ${(U.toRecord || []).length ? `<p><b>Paid on site, enter in ServiceMonster:</b> ${U.toRecord.map(o => `WO ${esc(o.wo)} ${esc(o.account)} ${$$(o.balance)}`).join('; ')}.</p>` : ''}
      ${(B.notInvoiced || []).length ? `<p><b>Done but not invoiced:</b> ${B.notInvoiced.map(o => `WO ${esc(o.wo)}, ${esc(o.account)}, ${esc(fmtDate(o.done))}, ${$$(o.total)}`).join('; ')}.</p>` : ''}
      <h3>QUESTIONS</h3>
      <p>${Q ? `${Q} waiting for you: tap <b>Penny's questions</b>.` : 'None tonight. Everything is answered.'}</p>
      <h3>RECEIPTS AND EXPENSES</h3>
      ${expDay.length ? `<table><tr><th>Filed for ${esc(fmtDate(B.date))}</th><th>Category</th><th>Amount</th><th>GST</th></tr>${expDay.map(x => `<tr><td>${esc(x.vendor || '')}${x.photoId ? ` <a href="/_blob/${esc(x.photoId)}" target="_blank" rel="noopener">photo</a>` : ''}</td><td>${esc(x.category || '')}</td><td>${$$(x.amount)}</td><td>${$$(x.gst)}</td></tr>`).join('')}</table>` : `<p>No receipts filed for ${esc(fmtDate(B.date))} yet. Tap <b>Add a receipt</b> to add one.</p>`}
      <p>That day: <b>${$$(tot(expDay))}</b>, revenue less expenses <b>${$$(B.today.revenue - tot(expDay))}</b>.<br>
        This month: <b>${$$(tot(expMonth))}</b>${Object.keys(cats).length ? ' (' + Object.entries(cats).sort((x, y) => y[1] - x[1]).map(([c, v]) => `${esc(c)} ${$$(v)}`).join(', ') + ')' : ''}, revenue less expenses <b>${$$(M.revenue - tot(expMonth))}</b>.<br>
        GST to set aside: ${$$(M.gst)} collected less ${$$(gstPaid)} paid on receipts = <b>${$$(M.gst - gstPaid)}</b>.</p>
      ${looks.length ? `<h3>WORTH A LOOK</h3><ul>${looks.map(x => `<li>${x}</li>`).join('')}</ul>` : ''}`;
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
        ${fullBrief(B, E, expDay, expMonth, tot)}${foot}</div>`;
      const np = T.list.filter(j => j.status === 'Not paid'), bw = T.list.filter(j => /^(Billed, waiting|Commercial)/.test(j.status)), ps = T.list.filter(j => j.status === 'Paid on site');
      const words = [np.length ? `${np.length} not paid yet` : '', bw.length ? `${bw.map(j => 'WO ' + j.wo).join(', ')} billed, waiting for payment` : '', ps.length ? `${ps.map(j => 'WO ' + j.wo).join(', ')} paid on site` : ''].filter(Boolean);
      line = T.jobs ? `${T.jobs} job${T.jobs === 1 ? '' : 's'} done on ${fmtDate(B.date)}: ${$$(T.revenue)} revenue, ${$$(T.paid)} paid, about ${T.km} km.` + (words.length ? ' ' + words.join('; ') + '.' : ' Everything that should be paid is paid.') : `No completed jobs on ${fmtDate(B.date)}, boss.`;
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
      const MJ = (ledger.marks && ledger.marks.jobs) || {};
      const tbl = (l, comm) => l.map(o => `<tr><td>WO ${esc(o.wo)}</td><td>${esc(o.account)}${o.billed || comm || (MJ[String(o.wo)] || {}).how === 'billed' ? ' <span class="tag wo">BILLED</span>' : ''}${o.method ? ' (' + esc(o.method) + ')' : ''}</td><td>${esc(o.completed ? fmtDate(o.completed) : '')}</td><td>${o.days != null ? o.days + ' days' : ''}</td><td>${$$(o.balance)}</td></tr>`).join('');
      html = `<div class="report"><h3>NOT PAID YET · RUNNING TOTAL</h3>
        <div class="kpis"><div>Not paid<br><span class="big">${$$(U.notPaidTotal)}</span>${U.notPaid.length} jobs</div><div>Over 30 days<br><span class="big">${$$(U.over30)}</span></div><div>Over 60 days<br><span class="big">${$$(U.over60)}</span></div><div>Commercial, billed<br><span class="big">${$$(U.commercialTotal)}</span>${U.commercial.length} jobs</div></div>
        <table><tr><th>Job</th><th>Customer</th><th>Done</th><th>Age</th><th>Owes</th></tr>${tbl(U.notPaid)}</table>
        ${U.commercial.length ? `<h3>COMMERCIAL, BILLED · WAITING FOR PAYMENT</h3><table>${tbl(U.commercial, true)}</table>` : ''}
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

  /* Penny's questions: billed or paid on site, and commercial accounts.
     Answers are saved to the arcade's database and applied to the brief on
     screen straight away; tonight's brief recalculates from ServiceMonster. */
  function pennyQs() {
    const B = ledger && ledger.brief;
    if (!B) return [];
    const M = (ledger.marks && ledger.marks.jobs) || {}, A = ledger.accounts || {};
    const known = id => (A.commercial || []).concat(A.notCommercial || []).some(a => a.accountID === id);
    return [
      ...(B.askPaid || []).filter(j => !M[String(j.wo)]).map(j => ({ kind: 'paid', ...j })),
      ...(B.askCommercial || []).filter(a => !known(a.accountID)).map(a => ({ kind: 'comm', ...a })),
    ];
  }
  const r2c = n => Math.round(n * 100) / 100;
  // Bring the brief on screen in line with Keith's answers (the same rules as tools/penny/brief.mjs).
  function applyAnswers() {
    const B = ledger && ledger.brief;
    if (!B || !B.unpaid) return;
    const M = (ledger.marks && ledger.marks.jobs) || {}, A = ledger.accounts || {};
    const isComm = id => (A.commercial || []).some(a => a.accountID === id);
    const U = B.unpaid;
    U.toRecord = U.toRecord || []; U.commercial = U.commercial || [];
    for (const o of U.notPaid.slice()) {
      const m = M[String(o.wo)];
      if (isComm(o.accountID)) { U.notPaid.splice(U.notPaid.indexOf(o), 1); U.commercial.push(o); continue; }
      if (m && m.how === 'paid') {
        U.notPaid.splice(U.notPaid.indexOf(o), 1); U.toRecord.push({ ...o, method: m.method || '' });
        for (const s2 of [B.today, B.month]) if (s2 && o.completed >= s2.from && o.completed <= s2.to) s2.paid = r2c(s2.paid + o.balance);
      } else if (m && m.how === 'billed') o.billed = true;
    }
    for (const j of (B.today && B.today.list) || []) {
      const m = M[String(j.wo)];
      if (/^(Not paid|Commercial)/.test(j.status) && m) { j.status = m.how === 'paid' ? 'Paid on site' : 'Billed, waiting'; j.method = m.method || ''; }
      else if (j.status === 'Not paid' && (A.commercial || []).some(a => a.name === j.account)) j.status = 'Billed, waiting';
    }
    const sum = l => r2c(l.reduce((t, o) => t + o.balance, 0));
    U.notPaidTotal = sum(U.notPaid); U.commercialTotal = sum(U.commercial); U.toRecordTotal = sum(U.toRecord);
    U.over30 = sum(U.notPaid.filter(o => o.days > 30)); U.over60 = sum(U.notPaid.filter(o => o.days > 60));
    U.total = r2c(U.notPaidTotal + U.commercialTotal);
  }

  async function pennyQuestions() {
    const id = clear();
    S.office.select('penny');
    nameplate('PENNY · ACCOUNTING');
    await loadLedger();
    if (id !== run) return;
    drawPennyQs();
    const q = pennyQs(), paid = q.filter(x => x.kind === 'paid').length, comm = q.filter(x => x.kind === 'comm').length;
    await say(q.length ? `Evening, boss. ${[paid ? `${paid} job${paid === 1 ? '' : 's'} I need to check: billed, or paid on site?` : '', comm ? `And ${comm} customer${comm === 1 ? '' : 's'} that look like companies: do you bill them on account?` : ''].filter(Boolean).join(' ')}` : "That's everything, boss. Your answers are in the books.");
    if (id !== run) return;
    acctChoices('pq');
  }

  function drawPennyQs(note) {
    const B = ledger.brief, q = pennyQs(), U = B.unpaid;
    const can = ledger.live;
    const paidQs = q.filter(x => x.kind === 'paid'), commQs = q.filter(x => x.kind === 'comm');
    const btn = (k, v, label, extra) => `<button class="qa" data-q="${esc(k)}" data-v="${esc(v)}"${extra || ''}>${esc(label)}</button>`;
    let n = 0;
    const cards = [
      ...paidQs.map(j => `<div class="q"><h4>${++n}. BILLED OR PAID ON SITE?</h4><p><b>WO ${esc(j.wo)}</b>, ${esc(j.account)}, done ${esc(fmtDate(j.done))}: ServiceMonster shows <b>${$$(j.balance)}</b> owing.</p>
        <div class="qbtns">${btn('p:' + j.wo, 'billed', 'Billed, they pay later')}</div>
        <p class="small">Paid on site? How:</p><div class="qbtns">${['Cash', 'Cheque', 'Debit/credit', 'E-transfer'].map(m => btn('p:' + j.wo, 'paid:' + m, m)).join('')}</div></div>`),
      ...(commQs.length ? [`<div class="q"><h4>${++n}. COMMERCIAL ACCOUNTS?</h4><p>Do you bill these customers on account? Yes moves their unpaid jobs to the commercial list, so they're not mixed in with homeowners who haven't paid.</p>
        <table>${commQs.map(a => { const owed = U.notPaid.filter(o => o.accountID === a.accountID); return `<tr><td><b>${esc(a.name)}</b><br><small>${owed.length} job${owed.length === 1 ? '' : 's'}, ${$$(owed.reduce((t, o) => t + o.balance, 0))}</small></td><td><div class="qbtns">${btn('c:' + a.accountID, 'yes', 'Yes, billed')}${btn('c:' + a.accountID, 'no', 'No')}</div></td></tr>`; }).join('')}</table></div>`] : []),
    ];
    const answered = Object.entries((ledger.marks && ledger.marks.jobs) || {}).slice(-6).reverse();
    const done = answered.length ? `<div class="q info"><h4>YOUR ANSWERS</h4><ul>${answered.map(([wo, m]) => `<li>WO ${esc(wo)}: ${m.how === 'paid' ? 'paid on site' + (m.method ? ' (' + esc(m.method) + ')' : '') : 'billed, waiting'}</li>`).join('')}</ul></div>` : '';
    $('panel').innerHTML = `<div class="report questions"><h3>PENNY'S QUESTIONS</h3>
      ${can ? '' : '<p><b>Answering needs the arcade open in claude.ai.</b></p>'}
      ${cards.join('') || '<div class="q"><p>No questions right now. Everything is answered.</p></div>'}
      <div class="kpis"><div>Today paid<br><span class="big">${$$(B.today.paid)}</span></div><div>Not paid yet<br><span class="big">${$$(U.notPaidTotal)}</span>${U.notPaid.length} jobs</div><div>Commercial, billed<br><span class="big">${$$(U.commercialTotal)}</span></div>${(U.toRecord || []).length ? `<div>Paid on site, enter in ServiceMonster<br><span class="big">${$$(U.toRecordTotal)}</span></div>` : ''}</div>
      ${note ? `<p class="small">${esc(note)}</p>` : ''}${done}
      <p class="soon">Your answers are saved for Penny right away. Paid-on-site jobs still need the payment entered in ServiceMonster; Penny lists them until it shows paid.</p></div>`;
    $('panel').querySelectorAll('button[data-q]').forEach(b => b.onclick = async () => {
      if (!can) return;
      const [t, key] = [b.dataset.q.slice(0, 1), b.dataset.q.slice(2)], v = b.dataset.v;
      $('panel').querySelectorAll('button[data-q]').forEach(x => x.disabled = true);
      try {
        if (t === 'p') {
          const ans = v === 'billed' ? { how: 'billed', at: new Date().toISOString() } : { how: 'paid', method: v.slice(5), at: new Date().toISOString() };
          ledger.marks = await root.HP_LIVE.markJob(key, ans);
          A.select();
          applyAnswers();
          const j = (B.askPaid || []).find(x => String(x.wo) === key);
          drawPennyQs(`WO ${key} is ${ans.how === 'paid' ? 'paid on site (' + ans.method + ')' : 'billed, waiting for payment'}.`);
          say(ans.how === 'paid' ? `Got it, WO ${key} was paid on site by ${ans.method.toLowerCase()}. Today's paid is now ${$$(B.today.paid)}. Remember to enter the payment in ServiceMonster.` : `Got it, WO ${key} was billed${j ? ` to ${j.account}` : ''}. It stays on the not-paid list, marked billed.`);
        } else {
          const a = (B.askCommercial || []).find(x => x.accountID === key);
          ledger.accounts = await root.HP_LIVE.markAccount(a, v === 'yes');
          A.select();
          applyAnswers();
          drawPennyQs(`${a.name}: ${v === 'yes' ? 'commercial, billed on account' : 'not a commercial account'}.`);
          if (v === 'yes') say(`${a.name} is on the commercial list now. Not paid yet is ${$$(U.notPaidTotal)}, commercial billed is ${$$(U.commercialTotal)}.`);
        }
        acctChoices('pq');
      } catch (e) { drawPennyQs("Couldn't save that just now. Try again in a minute."); }
    });
  }

  /* Receipts: a photo from the phone, Penny reads it, asks what she needs, saves it. */
  const CATS = ['Fuel', 'Vehicle repairs and maintenance', 'Vehicle insurance and registration', 'Supplies and materials', 'Tools and equipment',
    'Advertising and marketing', 'Phone and internet', 'Office and software', 'Meals (50% deductible)', 'Subcontractors', 'Insurance', 'Rent and storage', 'Bank and card fees', 'Other'];
  const PAID = ['Company card', 'Cash', 'Personal card', 'E-transfer'];
  let rc = null, rcBack = null;   // the receipt being entered; the month to go back to

  /* ------------------------------------------------ Card statements */
  // Keith uploads a Visa (or bank) statement; Penny reads it, asks about each
  // transaction, and only the ones he says are business go into the expenses.
  let stmt = null, stmtSaveT = null;
  // whose card: business cards are business unless Keith says otherwise; the personal Mastercard is personal unless he says it was for the business
  const OWNERS = {
    'biz-keith': { label: "Business Visa (Keith's)", who: 'Keith', business: true },
    'biz-hannah': { label: "Business Visa (Hannah's)", who: 'Hannah', business: true },
    'personal-keith': { label: "Keith's personal Mastercard", who: 'Keith', business: false },
    other: { label: 'Another card or account', who: 'Keith', business: null },
  };
  const guessOwner = st => { const c = (st && st.card) || '', h = (st && st.holder) || ''; if (/master/i.test(c)) return 'personal-keith'; if (/visa/i.test(c) && /hannah/i.test(h)) return 'biz-hannah'; if (/visa/i.test(c) && /keith/i.test(h)) return 'biz-keith'; return ''; };
  function applyOwner(o) {
    stmt.owner = o;
    const O = OWNERS[o];
    for (const t of stmt.transactions) {
      if (t.decision === 'filed' || t.added) continue;
      if (O.business === true) {
        // business card: business unless it looks personal, then ask
        if (t.business === 'personal') { t.decision = ''; t.question = `This is on the business card but looks personal${t.question ? ': ' + t.question : '.'} Was it for the business?`; }
        else { t.decision = 'business'; if (!CATS.includes(t.category)) t.category = 'Other'; }
      } else if (O.business === false) {
        // personal card: ask about anything that might be business; the rest is personal
        if (t.business === 'personal') t.decision = 'personal';
        else { t.decision = ''; t.question = t.question || 'Was this for the business? If so, the business owes you this back.'; }
      }
    }
  }
  const gstOf = (amt, how) => how === 'none' ? 0 : how === 'custom' ? null : Math.round(Number(amt) * 5 / 105 * 100) / 100;
  async function stmtHome() {
    const id = clear();
    S.office.select('penny');
    nameplate('PENNY · ACCOUNTING');
    const L = root.HP_LIVE;
    const [idx, can] = L ? await Promise.all([L.statements(), L.receiptAbilities()]) : [undefined, { canRead: false, canSave: false }];
    if (id !== run) return;
    const list = (idx && idx.list) || [];
    const owedDoc = L ? await L.owed() : null;
    if (id !== run) return;
    const ow = ((owedDoc && owedDoc.items) || []).filter(x => !x.repaidAt);
    const toK = ow.filter(x => x.direction === 'toKeith'), toB = ow.filter(x => x.direction === 'toBusiness');
    const osum = l => l.reduce((a, x) => a + Number(x.amount || 0), 0);
    const owedBox = ow.length ? `<div class="q"><h4>MONEY OWED</h4>
      ${toK.length ? `<p><b>The business owes Keith ${$$(osum(toK))}</b> for ${toK.length} business purchase${toK.length === 1 ? '' : 's'} on his personal Mastercard.</p><table>${toK.map(x => `<tr><td>${esc(fmtDate(x.date))}</td><td>${esc(x.vendor)}</td><td>${$$(x.amount)}</td></tr>`).join('')}</table><div class="qbtns"><button class="qa" id="repK">Mark as paid back to Keith</button></div>` : ''}
      ${toB.length ? `<p><b>Owed to the business ${$$(osum(toB))}</b> for personal purchases on the business Visas.</p><table>${toB.map(x => `<tr><td>${esc(fmtDate(x.date))}</td><td>${esc(x.vendor)} (${esc(x.who)})</td><td>${$$(x.amount)}</td></tr>`).join('')}</table><div class="qbtns"><button class="qa" id="repB">Mark as paid back to the business</button></div>` : ''}</div>` : '';
    $('panel').innerHTML = `<div class="report questions stmts"><h3>CARD STATEMENTS</h3>${owedBox}
      <div class="q"><h4>UPLOAD A STATEMENT</h4>
        <p>A Visa, Mastercard or bank statement as a PDF, or photos of its pages. I'll read every transaction, then go through them with you: business or personal, which category, and the GST. Only the business ones go into your expenses.</p>
        ${can.canRead && can.canSave ? `<label class="qa photo">Choose the statement (PDF or photos)<input id="stFile" type="file" accept="application/pdf,image/*" multiple hidden></label>` : '<p><b>Reading statements needs the arcade open in claude.ai.</b></p>'}
        <p id="stStatus" class="small"></p></div>
      ${list.length ? `<div class="q"><h4>YOUR STATEMENTS</h4><table>${list.map(x => `<tr><td><b>${esc(x.card || x.name || 'Statement')}</b>${x.last4 ? ' ···' + esc(x.last4) : ''}${x.holder ? ` <small>(${esc(x.holder)})</small>` : ''}<br><small>${esc(x.period || '')} · ${esc(x.name || '')}</small>${x.check && x.check.ok === false ? `<br><small class="warnc">Found ${$$(x.check.foundPurchases)} of ${$$(x.check.printed)} printed: some lines may be missing</small>` : x.check && x.check.ok ? '<br><small class="okc">Matches the statement total</small>' : ''}</td><td>${x.decided}/${x.count} gone through${x.added ? `<br><small>${x.added} added to expenses</small>` : ''}</td><td><button class="qa" data-st="${esc(x.id)}">${x.decided < x.count ? 'Continue' : 'Open'}</button>${x.files == null || x.files > 1 ? `<br><button class="qa" data-reread="${esc(x.id)}">Read ${x.files ? 'the ' + x.files : 'the'} files separately</button>` : ''}</td></tr>`).join('')}</table></div>` : ''}
      <p class="soon">The statement file is kept with your records. Card statements show the total but usually not the GST: I'll assume 5% GST is included unless you tell me otherwise. Keep the receipts for anything over $30, since the CRA wants a receipt to claim the GST back.</p></div>`;
    $('panel').querySelectorAll('button[data-st]').forEach(b => b.onclick = () => stmtInterview(b.dataset.st));
    if ($('repK')) $('repK').onclick = async () => { await L.markOwedRepaid('toKeith'); A.select(); say('Marked as paid back to you.'); stmtHome(); };
    if ($('repB')) $('repB').onclick = async () => { await L.markOwedRepaid('toBusiness'); A.select(); say('Marked as paid back to the business.'); stmtHome(); };
    const f = $('stFile');
    if (f) f.onchange = async () => {
      const files = Array.from(f.files || []);
      if (files.length) await readStatements(files.map(file => ({ file })), $('stStatus'));
    };
    $('panel').querySelectorAll('button[data-reread]').forEach(b => b.onclick = async () => {
      const old = await L.statement(b.dataset.reread);
      if (!old || !(old.files || []).length) return;
      b.disabled = true;
      await readStatements(old.files.map(x => ({ assetId: x.id, name: x.name })), $('stStatus'), old.id);
    });
    await say(list.length ? 'Upload a new statement, or pick up where we left off.' : "Send me a card statement and we'll go through it together. I'll only file what you tell me is business.");
    if (id !== run) return;
    acctChoices('stmt');
  }

  // Read each statement file on its own; anything already in the expenses (receipts or an
  // earlier statement) is marked "already filed" so it can't be counted twice.
  async function readStatements(sources, st, replaces) {
    const L = root.HP_LIVE, docs = [];
    try {
      for (let k = 0; k < sources.length; k++) {
        const src = sources[k], label = `Statement ${k + 1} of ${sources.length}`;
        let file = src.file, kept = null;
        if (!file) { st.textContent = `${label}: opening ${src.name}...`; const r = await fetch('/_blob/' + src.assetId); file = new File([await r.blob()], src.name || 'statement.pdf', { type: r.headers.get('content-type') || 'application/pdf' }); kept = { id: src.assetId, name: src.name }; }
        st.textContent = `${label}: opening ${file.name || 'the file'}...`;
        const part = await HP_STATEMENT.prepare(file);
        if (!part.text && !(part.images || []).length) { st.textContent = `${label}: I couldn't open ${file.name}. Skipping it.`; continue; }
        if (!kept) { const r = await L.storeFile(file); if (r) kept = { id: r.id, name: file.name || 'statement' }; }
        const got = await HP_STATEMENT.read(part, { categories: CATS, onProgress: (a, b2, n) => { st.textContent = part.text ? `${label}: reading ${file.name || 'the statement'}...` : `${label}: reading page${b2 > a ? 's' : ''} ${a}${b2 > a ? '-' + b2 : ''} of ${n}...`; } });
        docs.push({ id: Date.now().toString(36) + k, name: file.name || 'statement', files: kept ? [kept] : [], readAs: part.text ? 'text' : 'images', uploadedAt: new Date().toISOString(), statement: got.statement, check: got.check, transactions: got.transactions, owner: '' });
      }
      if (!docs.length) { st.textContent = "I couldn't read any transactions from that."; return; }
      // already filed? (receipts and earlier statements), and the same line in two overlapping statements
      const months = [...new Set(docs.flatMap(d => d.transactions.map(t => t.date.slice(0, 7))))];
      const filed = await L.expenseMonths(months) || {};
      const have = Object.values(filed).flatMap(d => (d && d.items) || []);
      const used = new Set(), seenHere = new Set();
      for (const d of docs) for (const t of d.transactions) {
        const key = t.date + '|' + Number(t.amount).toFixed(2) + '|' + String(t.description || '').toLowerCase().slice(0, 14);
        if (seenHere.has(key)) { t.decision = 'filed'; t.match = 'also on another statement'; continue; }
        seenHere.add(key);
        const i = have.findIndex((x, j) => !used.has(j) && Math.abs(Number(x.amount) - Number(t.amount)) < 0.01 && Math.abs(Date.parse(x.date) - Date.parse(t.date)) <= 3 * 864e5);
        if (i >= 0) { used.add(i); t.decision = 'filed'; t.match = `${have[i].vendor}, ${have[i].date}`; }
        t.gstHow = 'inc5'; t.gst = gstOf(t.amount, 'inc5');
      }
      for (const d of docs) await L.saveStatement(d);
      if (replaces) await L.removeStatement(replaces);
      A.select();
      st.textContent = `Read ${docs.length} statement${docs.length === 1 ? '' : 's'}: ${docs.reduce((a, d) => a + d.transactions.length, 0)} transactions.`;
      if (docs.length === 1) stmtInterview(docs[0].id, docs[0]); else stmtHome();
    } catch (e) {
      st.textContent = e && e.code === 'not_granted' ? "Reading files was turned off. Allow it in the arcade's permissions and try again." : 'Something went wrong reading the statements. Try again, or send photos of the pages.';
    }
  }

  function stmtSave() {
    clearTimeout(stmtSaveT);
    const doc = stmt;
    stmtSaveT = setTimeout(() => root.HP_LIVE.saveStatement(doc).catch(() => {}), 600);
  }

  async function stmtInterview(sid, doc) {
    const id = clear();
    S.office.select('penny');
    nameplate('PENNY · ACCOUNTING');
    const got = doc || await root.HP_LIVE.statement(sid);
    if (id !== run) return;
    stmt = got ? JSON.parse(JSON.stringify(got)) : got;
    if (!stmt) { $('panel').innerHTML = ''; await say("I can't find that statement."); acctChoices('stmt'); return; }
    if (!stmt.owner) {
      // same card as one Keith already told us about? use that answer
      const idx = await root.HP_LIVE.statements(), st0 = stmt.statement || {};
      const same = ((idx && idx.list) || []).find(x => x.id !== stmt.id && x.owner && x.card === (st0.card || '') && (x.last4 || '') === (st0.last4 || ''));
      if (same) { applyOwner(same.owner); stmtSave(); }
      if (id !== run) return;
    }
    drawStmt();
    const T = stmt.transactions, open = T.filter(t => !t.decision).length, filed = T.filter(t => t.decision === 'filed').length;
    await say(!stmt.owner ? `I read ${T.length} transactions${filed ? `, ${filed} already filed from receipts` : ''}. First, whose card is this?` : open ? `${open} left to go through on this ${stmt.statement && stmt.statement.card || 'statement'}. Tap Business or Personal for each one.` : 'All of these are gone through. Add the business ones to your expenses when you\'re ready.');
    if (id !== run) return;
    acctChoices('stmt');
  }

  // keep = index of the card just tapped: redraw without jumping, keep that card where it was, and flash it
  function drawStmt(keep, note) {
    const T = stmt.transactions, st = stmt.statement || {};
    const keepEl = keep != null ? $('panel').querySelector(`.q.tx[data-ti="${keep}"]`) : null, keepTop = keepEl ? keepEl.getBoundingClientRect().top : null;
    if (!stmt.owner) {
      const g = guessOwner(st);
      $('panel').innerHTML = `<div class="report questions stmts"><h3>${esc((st.card || 'STATEMENT').toUpperCase())}${st.last4 ? ' ···' + esc(st.last4) : ''} · ${esc(st.period || '')}</h3>
        <div class="q"><h4>WHOSE CARD IS THIS?</h4><p>I found ${T.length} transactions. Which card is it?</p>
        <div class="qbtns">${Object.entries(OWNERS).map(([k, o]) => `<button class="qa ${g === k ? 'on' : ''}" data-owner="${k}">${esc(o.label)}</button>`).join('')}</div>
        <p class="small">Business Visas: everything is business unless you tell me otherwise. Your personal Mastercard: I'll ask about each item, and anything for the business goes into your expenses and on the list of what the business owes you.</p></div></div>`;
      $('panel').querySelectorAll('button[data-owner]').forEach(b => b.onclick = () => { A.select(); applyOwner(b.dataset.owner); stmtSave(); drawStmt();
        const O = OWNERS[b.dataset.owner], n = stmt.transactions.filter(t => !t.decision).length;
        say(O.business === true ? `Got it, business card. I've marked everything as business except ${n} that look${n === 1 ? 's' : ''} personal. Check those, and pick categories.` : O.business === false ? `Got it, your personal card. ${n} might be for the business. Tell me which, and I'll track what the business owes you.` : `Okay. Let's go through all ${n} together.`); });
      return;
    }
    const O = OWNERS[stmt.owner] || OWNERS.other;
    const left = T.filter(t => !t.decision).length, biz = T.filter(t => t.decision === 'business'), toAdd = biz.filter(t => !t.added);
    const persOnBiz = O.business === true ? T.filter(t => t.decision === 'personal' && Number(t.amount) > 0) : [];
    const sum = l => l.reduce((a, t) => a + Number(t.amount || 0), 0);
    const card = (t, i) => {
      const flag = t.decision ? '' : t.business === 'personal' ? '<span class="tag">LOOKS PERSONAL</span>' : t.business === 'maybe' ? '<span class="tag wo">ASK</span>' : '<span class="tag ok">LOOKS LIKE BUSINESS</span>';
      const decided = t.decision === 'business' ? `<span class="tag ok">BUSINESS${t.added ? ' · ADDED' : ''}</span>` : t.decision === 'personal' ? '<span class="tag">PERSONAL</span>' : t.decision === 'filed' ? `<span class="tag ok">ALREADY FILED</span> <small>${esc(t.match || '')}</small>` : t.decision === 'skip' ? '<span class="tag">SKIPPED</span>' : '';
      const body = t.decision === 'business' && !t.added ? `
        <div class="qbtns cats">${CATS.map(c => `<button class="qa ${t.category === c ? 'on' : ''}" data-i="${i}" data-cat="${esc(c)}">${esc(c)}</button>`).join('')}</div>
        <p class="small">GST on it:</p><div class="qbtns">
          <button class="qa ${t.gstHow === 'inc5' ? 'on' : ''}" data-i="${i}" data-gst="inc5">5% included (${$$(gstOf(t.amount, 'inc5'))})</button>
          <button class="qa ${t.gstHow === 'none' ? 'on' : ''}" data-i="${i}" data-gst="none">No GST</button>
          <label class="rf gstc">Other <input type="number" step="0.01" inputmode="decimal" data-i="${i}" data-gstv value="${t.gstHow === 'custom' ? esc(t.gst) : ''}"></label></div>
        <label class="rf"><span>What it was for (optional)</span><input type="text" data-i="${i}" data-note value="${esc(t.note || '')}"></label>` : '';
      const ask = !t.decision && t.question ? `<p class="pq">${esc(t.question)}</p>` : '';
      const buttons = t.added ? '' : `<div class="qbtns">${['business', 'personal', 'skip'].map(d => `<button class="qa ${t.decision === d ? 'on' + (d === 'personal' ? ' no' : '') : ''}" data-i="${i}" data-d="${d}">${d === 'business' ? 'Business' : d === 'personal' ? 'Personal' : 'Skip'}</button>`).join('')}${t.decision === 'filed' ? `<button class="qa" data-i="${i}" data-d="business">Not the same, it's business too</button>` : ''}</div>`;
      return `<div class="q tx ${t.decision ? 'done' : ''}" data-ti="${i}"><div class="txh"><span>${esc(fmtDate(t.date))}</span><b>${esc(t.description || '')}</b><span class="amt">${$$(t.amount)}</span></div>${flag}${decided}${ask}${buttons}${body}</div>`;
    };
    const firstOpen = T.findIndex(t => !t.decision);
    $('panel').innerHTML = `<div class="report questions stmts"><h3>${esc((st.card || 'STATEMENT').toUpperCase())}${st.last4 ? ' ···' + esc(st.last4) : ''} · ${esc(st.period || '')}</h3>
      <p class="small">${esc(O.label)} <button class="qa tiny" id="stOwner">change</button></p>
      ${stmt.check && stmt.check.ok === false ? `<p class="warnline">The statement's printed purchases total is ${$$(stmt.check.printed)}, but I found ${$$(stmt.check.foundPurchases)}. Some lines may be missing: compare with the statement${(stmt.files || []).length ? ' (link at the bottom)' : ''}, and tell me what I missed.</p>` : stmt.check && stmt.check.ok ? `<p class="small okc">All ${stmt.check.found} lines found: purchases add up to the statement's ${$$(stmt.check.printed)}.</p>` : ''}
      <div class="kpis"><div>Transactions<br><span class="big">${T.length}</span></div><div>Left to go through<br><span class="big">${left}</span></div><div>Business<br><span class="big">${$$(sum(biz))}</span>${biz.length} items</div><div>Personal<br><span class="big">${$$(sum(T.filter(t => t.decision === 'personal')))}</span></div>
        ${O.business === false ? `<div>Business owes ${esc(O.who)}<br><span class="big">${$$(sum(biz))}</span></div>` : ''}${persOnBiz.length ? `<div>Personal on the business card (owed to the business)<br><span class="big">${$$(sum(persOnBiz))}</span></div>` : ''}</div>
      ${T.map(card).join('')}
      <div class="q send"><p class="small">${toAdd.length ? `${toAdd.length} business item${toAdd.length === 1 ? '' : 's'} (${$$(sum(toAdd))}) ready to add. Each goes into the month of its date.` : biz.length ? 'All business items are in your expenses.' : 'Mark the business ones, then add them here.'}</p>
        <button class="qa send" id="stAdd" ${toAdd.length && !toAdd.some(t => !t.category) ? '' : 'disabled'}>Add ${toAdd.length || ''} business item${toAdd.length === 1 ? '' : 's'} to my expenses</button>
        ${toAdd.some(t => !t.category) ? '<span class="small"> Pick a category for each business item first.</span>' : ''}
        <span id="stMsg" class="small"></span></div>
      ${(stmt.files || []).length ? `<p class="soon">Statement on file: ${stmt.files.map(f => `<a href="/_blob/${esc(f.id)}" target="_blank" rel="noopener">${esc(f.name)}</a>`).join(', ')}</p>` : ''}</div>`;
    const P = $('panel');
    if ($('stOwner')) $('stOwner').onclick = () => { stmt.owner = ''; drawStmt(); };
    P.querySelectorAll('button[data-d]').forEach(b => b.onclick = () => {
      const t = T[+b.dataset.i], same = t.decision === b.dataset.d; t.decision = b.dataset.d;
      if (t.decision === 'business' && !CATS.includes(t.category)) t.category = '';
      try { A.select(); } catch (e) { }
      stmtSave();
      const word = t.decision === 'business' ? 'Business' : t.decision === 'personal' ? 'Personal' : 'Skipped';
      drawStmt(+b.dataset.i, (same ? `Already marked ${word.toLowerCase()}` : `Saved: ${word}`) + (t.decision === 'business' ? (t.category ? ` \u00b7 ${t.category}. Change the category below if it's wrong.` : '. Now pick a category below.') : '.'));
      const P2 = $('panel'), next = P2.querySelector('.q.tx:not(.done)');
      if (t.decision !== 'business' && next) next.scrollIntoView({ block: 'center', behavior: 'smooth' });
    });
    P.querySelectorAll('button[data-cat]').forEach(b => b.onclick = () => { T[+b.dataset.i].category = b.dataset.cat; try { A.select(); } catch (e) { } stmtSave(); drawStmt(+b.dataset.i, 'Saved: ' + b.dataset.cat); });
    P.querySelectorAll('button[data-gst]').forEach(b => b.onclick = () => { const t = T[+b.dataset.i]; t.gstHow = b.dataset.gst; t.gst = gstOf(t.amount, t.gstHow); stmtSave(); drawStmt(+b.dataset.i, 'Saved: ' + (t.gstHow === 'none' ? 'no GST' : 'GST ' + $$(t.gst))); });
    P.querySelectorAll('input[data-gstv]').forEach(inp => inp.onchange = () => { const t = T[+inp.dataset.i]; t.gstHow = 'custom'; t.gst = Math.round(Number(inp.value || 0) * 100) / 100; stmtSave(); drawStmt(+inp.dataset.i); });
    P.querySelectorAll('input[data-note]').forEach(inp => inp.onchange = () => { T[+inp.dataset.i].note = inp.value; stmtSave(); });
    $('stAdd').onclick = async () => {
      const add = T.filter(t => t.decision === 'business' && !t.added && t.category);
      if (!add.length) return;
      $('stAdd').disabled = true; $('stMsg').textContent = ' Filing...';
      const byMonth = {};
      for (const t of add) (byMonth[t.date.slice(0, 7)] = byMonth[t.date.slice(0, 7)] || []).push(t);
      try {
        const personalCard = O.business === false;
        for (const [m, l] of Object.entries(byMonth)) {
          await root.HP_LIVE.addExpenses(m, l.map(t => ({ date: t.date, vendor: t.description, category: t.category, amount: Math.round(Number(t.amount) * 100) / 100, gst: Number(t.gst || 0),
            paidWith: O.label + (st.last4 ? ' ' + st.last4 : ''), reimburse: personalCard ? O.who : '',
            note: [t.note, personalCard ? `Paid personally by ${O.who}: owed back to ${O.who}` : '', 'From ' + (st.card || 'card') + ' statement' + (st.period ? ' ' + st.period : '')].filter(Boolean).join('. '),
            photoId: '', statementId: stmt.id, enteredIn: 'statement', enteredAt: new Date().toISOString() })));
          l.forEach(t => { t.added = true; });
        }
        const owed = [];
        if (personalCard) add.forEach((t, k) => owed.push({ id: stmt.id + '-' + T.indexOf(t), date: t.date, vendor: t.description, amount: Math.round(Number(t.amount) * 100) / 100, who: O.who, direction: 'toKeith', statementId: stmt.id }));
        persOnBiz.filter(t => !t.owedLogged).forEach(t => { t.owedLogged = true; owed.push({ id: stmt.id + '-' + T.indexOf(t), date: t.date, vendor: t.description, amount: Math.round(Number(t.amount) * 100) / 100, who: O.who, direction: 'toBusiness', statementId: stmt.id }); });
        if (owed.length) await root.HP_LIVE.addOwed(owed);
        await root.HP_LIVE.saveStatement(stmt);
        A.select();
        drawStmt();
        say(`Filed ${add.length} business item${add.length === 1 ? '' : 's'}, ${$$(sum(add))}, into ${Object.keys(byMonth).map(monthName).join(', ')}.` + (personalCard ? ` The business now owes you ${$$(sum(add))} for these. It's on the "owed" list on the Card statements page.` : '') + (persOnBiz.length ? ` ${$$(sum(persOnBiz))} of personal purchases on the business card is listed as owed to the business.` : ''));
      } catch (e) { $('stAdd').disabled = false; $('stMsg').textContent = " Couldn't save just now. Try again in a minute."; }
    };
    const back = keep != null ? P.querySelector(`.q.tx[data-ti="${keep}"]`) : null;
    if (back) {
      if (keepTop != null) { const dy = back.getBoundingClientRect().top - keepTop; let sc = back.parentElement; while (sc && sc !== document.body && !(sc.scrollHeight > sc.clientHeight + 4 && /auto|scroll/.test(getComputedStyle(sc).overflowY))) sc = sc.parentElement; if (sc && sc !== document.body) sc.scrollTop += dy; else window.scrollBy(0, dy); }
      back.classList.remove('flash'); void back.offsetWidth; back.classList.add('flash');
      if (note) { const n = document.createElement('p'); n.className = 'savedline'; n.textContent = '\u2713 ' + note; back.querySelector('.txh').after(n); }
    } else if (keep == null && firstOpen > 2) { const el = P.querySelectorAll('.q.tx')[firstOpen]; if (el) el.scrollIntoView({ block: 'center' }); }
  }

  /* ------------------------------------------------ Profit and loss
     Revenue (before GST) from ServiceMonster via Penny's nightly brief, expenses
     (before GST) from the filed receipts and card statements, then Keith's pay:
     $2,500 take-home on the 15th and the 30th (the last day in a shorter month). */
  const OWNER_PAY = 2500;
  // Keith's pay as salary through payroll: find the gross pay that leaves $2,500
  // take-home after income tax (federal + Alberta) and CPP, using 2026 rates.
  // EI is left out: an owner with more than 40% of the voting shares can't pay into EI.
  const PAYROLL = { year: 2026, perYear: 24, ei: false,
    cpp: { rate: 0.0595, baseRate: 0.0495, exempt: 3500, ympe: 74600, cpp2Rate: 0.04, yampe: 85000 },
    eiRate: 0.0163, eiMax: 68900,
    fed: { bpa: 16452, cea: 1501, credit: 0.14, brackets: [[58523, 0.14], [117045, 0.205], [181440, 0.26], [258482, 0.29], [Infinity, 0.33]] },
    ab: { bpa: 22769, credit: 0.08, brackets: [[61200, 0.08], [154259, 0.10], [185111, 0.12], [246813, 0.13], [370220, 0.14], [Infinity, 0.15]] } };
  const payroll = (() => {
    const P = PAYROLL, band = (x, bs) => { let t = 0, prev = 0; for (const [lim, r] of bs) { t += Math.max(0, Math.min(x, lim) - prev) * r; prev = lim; } return t; };
    const year = G => {
      const cpp1 = P.cpp.rate * Math.max(0, Math.min(G, P.cpp.ympe) - P.cpp.exempt), cpp2 = P.cpp.cpp2Rate * Math.max(0, Math.min(G, P.cpp.yampe) - P.cpp.ympe);
      const ei = P.ei ? P.eiRate * Math.min(G, P.eiMax) : 0, base = cpp1 * P.cpp.baseRate / P.cpp.rate, ti = G - (cpp1 - base) - cpp2;
      const tax = Math.max(0, band(ti, P.fed.brackets) - P.fed.credit * (P.fed.bpa + base + ei + P.fed.cea)) + Math.max(0, band(ti, P.ab.brackets) - P.ab.credit * (P.ab.bpa + base + ei));
      return { gross: G, tax, cpp: cpp1 + cpp2, ei, net: G - tax - cpp1 - cpp2 - ei };
    };
    let lo = 0, hi = OWNER_PAY * P.perYear * 2;
    for (let i = 0; i < 60; i++) { const mid = (lo + hi) / 2; if (year(mid).net < OWNER_PAY * P.perYear) lo = mid; else hi = mid; }
    const y = year(hi), per = k => Math.round(y[k] / P.perYear * 100) / 100;
    const r = { gross: per('gross'), tax: per('tax'), cpp: per('cpp'), ei: per('ei') };
    r.takeHome = OWNER_PAY; r.cppEmployer = r.cpp; r.eiEmployer = Math.round(r.ei * 1.4 * 100) / 100;
    r.cost = Math.round((r.takeHome + r.tax + r.cpp + r.ei + r.cppEmployer + r.eiEmployer) * 100) / 100;
    r.remit = Math.round((r.tax + r.cpp + r.ei + r.cppEmployer + r.eiEmployer) * 100) / 100;
    return r;
  })();
  const payDays = (m, through) => {
    const [y, mo] = m.split('-').map(Number), last = new Date(Date.UTC(y, mo, 0)).getUTCDate();
    return [15, Math.min(30, last)].map(d => `${m}-${String(d).padStart(2, '0')}`).filter(d => !through || d <= through);
  };
  let plSel = null;
  async function profitLoss(month) {
    const id = clear();
    S.office.select('penny');
    nameplate('PENNY · ACCOUNTING');
    $('panel').innerHTML = '<div class="loading">Adding it all up</div>';
    await loadLedger();
    if (id !== run) return;
    const L = root.HP_LIVE, cur = nowMonth(), today = (window.HP_SCHEDULE ? HP_SCHEDULE.localNow(cfg.business.timeZone) : new Date().toISOString()).slice(0, 10);
    const rbm = ledger.brief && ledger.brief.revenueByMonth;
    plSel = month || plSel || cur;
    const year = Number(plSel.slice(0, 4));
    const months = Array.from({ length: Number(plSel.slice(5, 7)) }, (_, i) => `${year}-${String(i + 1).padStart(2, '0')}`);
    const docs = L ? await L.expenseMonths(months) : undefined;
    if (id !== run) return;
    const revKnown = !!(rbm && rbm.year === year);
    const rev = m => revKnown ? ((rbm.months || {})[m] || { revenue: 0, jobs: 0 }) : null;
    const exp = m => ((docs && docs[m]) || { items: [] }).items || [];
    const net = x => Number(x.amount || 0) - Number(x.gst || 0);
    const calc = ms => {
      const items = ms.flatMap(exp), cats = {};
      for (const x of items) cats[x.category || 'Other'] = (cats[x.category || 'Other'] || 0) + net(x);
      const revenue = revKnown ? ms.reduce((t, m) => t + Number(rev(m).revenue || 0), 0) : null;
      const jobs = revKnown ? ms.reduce((t, m) => t + Number(rev(m).jobs || 0), 0) : null;
      const expenses = Object.values(cats).reduce((a, b) => a + b, 0);
      const pays = ms.flatMap(m => payDays(m, m === cur ? today : null));
      const meals = cats['Meals (50% deductible)'] || 0;
      return { cats, revenue, jobs, expenses, profit: revenue == null ? null : revenue - expenses, pays, pay: pays.length * payroll.cost, payN: k => pays.length * payroll[k], meals, count: items.length };
    };
    const M1 = calc([plSel]), Y = calc(months);
    const allCats = [...new Set([...Object.keys(Y.cats)])].sort((a, b) => (Y.cats[b] || 0) - (Y.cats[a] || 0));
    const partial = plSel === cur;
    const through = partial ? (rbm && rbm.through && rbm.through.slice(0, 7) === cur ? rbm.through : today) : null;
    const colM = monthName(plSel) + (partial ? ' (so far)' : ''), colY = `Jan-${monthName(plSel).slice(0, 3)} ${year}`;
    const lines = [
      { head: 'REVENUE' },
      { label: `Service revenue, before GST${M1.jobs != null ? ` (${M1.jobs} jobs this month)` : ''}`, values: [M1.revenue, Y.revenue], indent: true },
      { label: 'Total revenue', values: [M1.revenue, Y.revenue], bold: true, rule: true },
      { head: 'EXPENSES (before GST)' },
      ...allCats.map(c => ({ label: c, values: [M1.cats[c] || 0, Y.cats[c] || 0], indent: true })),
      { label: 'Total expenses', values: [M1.expenses, Y.expenses], bold: true, rule: true },
      { gap: true },
      { label: 'Net profit before owner pay', values: [M1.profit, Y.profit], bold: true, rule: true },
      { head: "KEITH'S PAY (salary through payroll)" },
      { label: 'Take-home pay: $2,500 on the 15th and 30th', values: [-M1.payN('takeHome'), -Y.payN('takeHome')], indent: true, note: `${M1.pays.length} payday${M1.pays.length === 1 ? '' : 's'} this month${M1.pays.length ? ' (' + M1.pays.map(d => fmtDate(d)).join(', ') + ')' : ''}, ${Y.pays.length} this year. Gross pay ${$$(payroll.gross)} each.` },
      { label: 'Income tax withheld (federal + Alberta)', values: [-M1.payN('tax'), -Y.payN('tax')], indent: true },
      { label: 'CPP withheld (your share)', values: [-M1.payN('cpp'), -Y.payN('cpp')], indent: true },
      ...(payroll.ei ? [{ label: 'EI withheld (your share)', values: [-M1.payN('ei'), -Y.payN('ei')], indent: true }] : []),
      { label: "CPP, the business's share", values: [-M1.payN('cppEmployer'), -Y.payN('cppEmployer')], indent: true },
      ...(payroll.ei ? [{ label: "EI, the business's share", values: [-M1.payN('eiEmployer'), -Y.payN('eiEmployer')], indent: true }] : []),
      { label: 'Total cost of your pay', values: [-M1.pay, -Y.pay], bold: true, rule: true, note: `Sent to the CRA as payroll remittances: ${$$(M1.payN('remit'))} this month, ${$$(Y.payN('remit'))} this year.` },
      { label: 'Left in the business after owner pay', values: [M1.profit == null ? null : M1.profit - M1.pay, Y.profit == null ? null : Y.profit - Y.pay], bold: true, rule: true },
    ];
    const notes = [
      'Revenue is from ServiceMonster: jobs count in the month they were done, Jayman jobs always count. Revenue and expenses are before GST.',
      'Expenses are the receipts and card statement items filed with Penny. Anything not filed yet is not in here.',
      `Keith's pay: $${OWNER_PAY.toLocaleString()} take-home on the 15th and 30th, paid as salary. Gross pay ${$$(payroll.gross)} per payday is what leaves $2,500 after income tax (federal + Alberta, ${PAYROLL.year} rates, basic credits only) and CPP; the business also pays its matching CPP. These are estimates; the actual payroll figures may differ a little.`,
      ...(payroll.ei ? [] : ['EI is not included: an owner with more than 40% of the voting shares does not pay into EI.']),
      ...(Y.meals ? [`Meals are shown in full; only 50% is deductible for tax (${$$(Y.meals / 2)} of ${$$(Y.meals)} this year).`] : []),
      ...(partial ? [`${monthName(plSel)} is not over: revenue through ${fmtDate(through)}, expenses filed so far, pay days that have passed.`] : []),
    ];
    const row = l => l.head ? `<tr class="plh"><th colspan="3">${esc(l.head)}</th></tr>` : l.gap ? '<tr class="plgap"><td colspan="3"></td></tr>'
      : `<tr class="${l.bold ? 'plb' : ''}${l.rule ? ' plr' : ''}"><td class="${l.indent ? 'pli' : ''}">${esc(l.label)}${l.note ? `<br><small>${esc(l.note)}</small>` : ''}</td>${l.values.map(v => `<td class="num${v != null && v < 0 ? ' neg' : ''}">${v == null ? '—' : (v < 0 ? '-' : '') + $$(Math.abs(v))}</td>`).join('')}</tr>`;
    const chips = Array.from({ length: 12 }, (_, i) => { const m = `${year}-${String(i + 1).padStart(2, '0')}`; return `<button class="mchip ${m === plSel ? 'on' : ''}" data-m="${m}" ${m > cur ? 'disabled' : ''}><b>${monthName(m).slice(0, 3).toUpperCase()}</b></button>`; }).join('');
    $('panel').innerHTML = `<div class="report expmonths pl">
      <div class="yearbar"><button class="qa" id="yPrev">&#9664; ${year - 1}</button><h3>PROFIT &amp; LOSS · ${year}</h3>${year < Number(cur.slice(0, 4)) ? `<button class="qa" id="yNext">${year + 1} &#9654;</button>` : '<span></span>'}</div>
      <div class="mchips">${chips}</div>
      ${revKnown ? '' : `<p class="warnline">I don't have ServiceMonster revenue for ${year} yet${rbm ? ` (I have ${rbm.year})` : ''}. It comes in with my nightly brief.</p>`}
      <div class="kpis"><div>Revenue<br><span class="big">${M1.revenue == null ? '—' : $$(M1.revenue)}</span></div><div>Expenses<br><span class="big">${$$(M1.expenses)}</span></div><div>Profit before pay<br><span class="big">${M1.profit == null ? '—' : $$(M1.profit)}</span></div><div>Left after your pay<br><span class="big">${M1.profit == null ? '—' : $$(M1.profit - M1.pay)}</span></div></div>
      <table class="pltab"><tr><th></th><th class="num">${esc(colM)}</th><th class="num">${esc(colY)}</th></tr>${lines.map(row).join('')}</table>
      <div class="q send"><button class="qa send" id="plEmail">Email the P&amp;L to keith@homeprosgroup.com</button> <button class="qa" id="plPdf">Download PDF</button> <span id="plStatus" class="small"></span></div>
      ${notes.map(n => `<p class="soon">${esc(n)}</p>`).join('')}</div>`;
    $('panel').querySelectorAll('.mchip[data-m]').forEach(b => b.onclick = () => { try { A.select(); } catch (e) { } profitLoss(b.dataset.m); });
    if ($('yPrev')) $('yPrev').onclick = () => profitLoss(`${year - 1}-12`);
    if ($('yNext')) $('yNext').onclick = () => { const y2 = year + 1; profitLoss(`${y2}-${y2 === Number(cur.slice(0, 4)) ? cur.slice(5, 7) : '12'}`); };
    const made = new Date().toLocaleDateString('en-US', { timeZone: cfg.business.timeZone, month: 'short', day: 'numeric', year: 'numeric' });
    const pdf = () => HP_EXPENSE_PDF.buildPL({ title: `Profit & loss: ${monthName(plSel)}`, sub: `Prepared by Penny (Accounts), ${made}`, cols: [colM, colY], lines, notes });
    const fname = `Home-Pros-Profit-and-Loss-${plSel}.pdf`;
    $('plPdf').onclick = async () => { const ok = await L.download(fname, pdf()); $('plStatus').textContent = ok ? ' Saved.' : " Couldn't save the file here."; };
    $('plEmail').onclick = async () => {
      $('plEmail').disabled = true; $('plStatus').textContent = ' Sending to keith@homeprosgroup.com...';
      const f = v => v == null ? 'n/a' : (v < 0 ? '-' : '') + $$(Math.abs(v));
      const body = `Hi Keith,

Here's the profit and loss for ${colM}, with the year to date.

` +
        `                                ${colM}   |   ${colY}
Revenue (before GST):           ${f(M1.revenue)}   |   ${f(Y.revenue)}
Expenses (before GST):          ${f(M1.expenses)}   |   ${f(Y.expenses)}
Net profit before owner pay:    ${f(M1.profit)}   |   ${f(Y.profit)}
Your take-home ($2,500 x ${M1.pays.length} / ${Y.pays.length}):  ${f(-M1.payN('takeHome'))}   |   ${f(-Y.payN('takeHome'))}
Income tax withheld:            ${f(-M1.payN('tax'))}   |   ${f(-Y.payN('tax'))}
CPP (yours + business's):       ${f(-M1.payN('cpp') - M1.payN('cppEmployer'))}   |   ${f(-Y.payN('cpp') - Y.payN('cppEmployer'))}
Total cost of your pay:         ${f(-M1.pay)}   |   ${f(-Y.pay)}
Left in the business:           ${f(M1.profit == null ? null : M1.profit - M1.pay)}   |   ${f(Y.profit == null ? null : Y.profit - Y.pay)}

` +
        `The PDF has the expenses by category and the notes.

Penny
Accounts assistant, Home Pros Group`;
      const r = await L.emailPdf({ to: 'keith@homeprosgroup.com', subject: `Home Pros profit & loss: ${colM}`, body, filename: fname, bytes: pdf() });
      $('plEmail').disabled = false;
      if (r.ok) { try { A.select(); } catch (e) { } $('plStatus').textContent = ' Sent.'; say(`Sent. The ${monthName(plSel)} profit and loss is in your inbox.`); }
      else $('plStatus').textContent = r.error === 'server_not_connected' || r.error === 'not_in_manifest' || r.error === 'not_granted' ? ' Allow the Gmail connector for the arcade, then try again. You can also download the PDF.' : " The email didn't go through. Try again, or download the PDF.";
    };
    const left = M1.profit == null ? null : M1.profit - M1.pay;
    await say(M1.revenue == null ? `${monthName(plSel)}: ${$$(M1.expenses)} in expenses so far. Revenue comes in with my nightly brief.` :
      `${colM}: ${$$(M1.revenue)} in, ${$$(M1.expenses)} out, ${$$(M1.profit)} profit. After your ${M1.pays.length ? $$(M1.pay) + ' pay' : 'pay'}, ${left >= 0 ? $$(left) + ' stays in the business' : 'the business is short ' + $$(-left)}.`);
    if (id !== run) return;
    acctChoices('pl');
  }

  /* ------------------------------------------------ Expenses by month */
  const monthName = m => { const [y, mo] = m.split('-').map(Number); return (root.HP_EXPENSE_PDF ? HP_EXPENSE_PDF.MONTHS : ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'])[mo - 1] + ' ' + y; };
  const nowMonth = () => (window.HP_SCHEDULE ? HP_SCHEDULE.localNow(cfg.business.timeZone) : new Date().toISOString()).slice(0, 7);
  let expYear = null, expSel = null, expSrc = 'all';
  async function expenseMonth(month) {
    const id = clear();
    S.office.select('penny');
    nameplate('PENNY · ACCOUNTING');
    const cur = nowMonth();
    expSel = month || expSel || cur;
    expYear = Number(expSel.slice(0, 4));
    $('panel').innerHTML = '<div class="loading">Opening the files</div>';
    const L = root.HP_LIVE;
    const months = Array.from({ length: 12 }, (_, i) => `${expYear}-${String(i + 1).padStart(2, '0')}`).filter(m => m <= cur);
    const [docs, sent, allMonths] = L ? await Promise.all([L.expenseMonths(months), L.reportsSent(), L.allExpenseMonths()]) : [undefined, undefined, undefined];
    if (id !== run) return;
    const live = docs !== undefined;
    const items = ((docs && docs[expSel]) || { items: [] }).items || [];   // everything: the report is always combined
    const srcOf = HP_EXPENSE_PDF.sourceOf;
    const srcNames = [...new Set(items.map(srcOf))].sort((a, b) => (a === 'Receipts' ? -1 : b === 'Receipts' ? 1 : a.localeCompare(b)));
    if (expSrc !== 'all' && !srcNames.includes(expSrc)) expSrc = 'all';
    const shown = expSrc === 'all' ? items : items.filter(x => srcOf(x) === expSrc);
    const S2 = (sent && sent.months) || {};
    const tot = l => l.reduce((t, x) => t + Number(x.amount || 0), 0);
    const chips = Array.from({ length: 12 }, (_, i) => {
      const m = `${expYear}-${String(i + 1).padStart(2, '0')}`, future = m > cur, d = docs && docs[m], n = d && d.items ? d.items.length : 0;
      return `<button class="mchip ${m === expSel ? 'on' : ''}" data-m="${m}" ${future ? 'disabled' : ''}><b>${monthName(m).slice(0, 3).toUpperCase()}</b><small>${future ? '' : n ? `${n} · ${$$(tot(d.items))}` : 'none'}</small>${S2[m] ? '<i title="report emailed">&#10003;</i>' : ''}</button>`;
    }).join('');
    const cats = {}; for (const x of shown) cats[x.category || 'Other'] = (cats[x.category || 'Other'] || 0) + Number(x.amount || 0);
    const rows = shown.slice().sort((a, b) => a.date.localeCompare(b.date)).map(x => `<tr><td>${esc(fmtDate(x.date))}</td><td>${esc(x.vendor || '')}${x.photoId ? ` <a href="/_blob/${esc(x.photoId)}" target="_blank" rel="noopener">photo</a>` : ''}${expSrc === 'all' ? `<br><small>${esc(srcOf(x))}</small>` : ''}</td><td>${esc(x.category || '')}</td><td>${$$(x.amount)}</td><td>${$$(x.gst)}</td></tr>`).join('');
    const srcTot = n => items.filter(x => srcOf(x) === n);
    const srcBar = srcNames.length > 1 || (srcNames.length === 1 && srcNames[0] !== 'Receipts') ? `<div class="qbtns srcbar"><button class="qa ${expSrc === 'all' ? 'on' : ''}" data-src="all">All combined · ${$$(tot(items))}</button>${srcNames.map(n => `<button class="qa ${expSrc === n ? 'on' : ''}" data-src="${esc(n)}">${esc(n)} · ${srcTot(n).length} · ${$$(tot(srcTot(n)))}</button>`).join('')}</div>` : '';
    const sentLine = S2[expSel] ? `Report last emailed ${esc(new Date(S2[expSel].sentAt).toLocaleString('en-US', { timeZone: cfg.business.timeZone, month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }))} with ${S2[expSel].count} receipt${S2[expSel].count === 1 ? '' : 's'} (${$$(S2[expSel].total)}).` : 'This month\'s report hasn\'t been emailed yet.';
    $('panel').innerHTML = `<div class="report expmonths">
      <div class="yearbar"><button class="qa" id="yPrev">&#9664; ${expYear - 1}</button><h3>EXPENSES · ${expYear}</h3>${expYear < Number(cur.slice(0, 4)) ? `<button class="qa" id="yNext">${expYear + 1} &#9654;</button>` : '<span></span>'}</div>
      <div class="mchips">${chips}</div>
      ${(allMonths || []).filter(m => m.month.slice(0, 4) !== String(expYear)).length ? `<p class="small">Receipts on file in other years: ${(allMonths || []).filter(m => m.month.slice(0, 4) !== String(expYear)).map(m => `<button class="qa oth" data-m="${m.month}">${esc(monthName(m.month))} · ${m.count} · ${$$(m.total)}</button>`).join(' ')}</p>` : ''}
      <h3>${esc(monthName(expSel).toUpperCase())}${expSrc === 'all' ? '' : ' · ' + esc(expSrc.toUpperCase())}</h3>
      ${srcBar}
      <div class="kpis"><div>${expSrc === 'all' ? 'Items' : expSrc === 'Receipts' ? 'Receipts' : 'From this card'}<br><span class="big">${shown.length}</span></div><div>Total (incl. GST)<br><span class="big">${$$(tot(shown))}</span></div><div>GST paid<br><span class="big">${$$(shown.reduce((t, x) => t + Number(x.gst || 0), 0))}</span></div></div>
      ${expSrc === 'all' ? '' : `<p class="small">Showing only ${esc(expSrc)}. The month's report always combines everything: ${items.length} items, ${$$(tot(items))}.</p>`}
      ${Object.keys(cats).length ? `<table><tr><th>Category</th><th>Total</th></tr>${Object.entries(cats).sort((a, b) => b[1] - a[1]).map(([c, v]) => `<tr><td>${esc(c)}</td><td>${$$(v)}</td></tr>`).join('')}</table>` : ''}
      ${rows ? `<table><tr><th>Date</th><th>Where</th><th>Category</th><th>Amount</th><th>GST</th></tr>${rows}</table>` : `<p>Nothing filed for ${esc(monthName(expSel))} yet.</p>`}
      <div class="q send"><p class="small">${sentLine}</p>
        <button class="qa send" id="mAdd">+ Add a receipt to ${esc(monthName(expSel))}</button>
        <button class="qa send" id="mEmail"${items.length ? '' : ' disabled'}>Email the ${esc(monthName(expSel))} report</button>
        <button class="qa" id="mPdf"${items.length ? '' : ' disabled'}>Download PDF</button>
        <span id="mStatus" class="small"></span></div>
      ${live ? '' : '<p class="soon">Expenses are kept in the arcade\'s database, which only works when the arcade is open in claude.ai.</p>'}
      <p class="soon">Receipts are filed by their date, so a receipt dated in an earlier month lands in that month. The report goes to keith@homeprosgroup.com as a PDF with every receipt and its photo.</p></div>`;
    $('panel').querySelectorAll('.mchip[data-m], .qa.oth[data-m]').forEach(b => b.onclick = () => { A.select(); expenseMonth(b.dataset.m); });
    $('panel').querySelectorAll('button[data-src]').forEach(b => b.onclick = () => { try { A.select(); } catch (e) { } expSrc = b.dataset.src; expenseMonth(expSel); });
    if ($('yPrev')) $('yPrev').onclick = () => expenseMonth(`${expYear - 1}-12`);
    if ($('yNext')) $('yNext').onclick = () => { const y = expYear + 1; expenseMonth(`${y}-${y === Number(cur.slice(0, 4)) ? cur.slice(5, 7) : '01'}`); };
    $('mAdd').onclick = () => receiptForm(expSel === cur ? undefined : expSel + '-01', expSel);
    const makePdf = async () => {
      $('mStatus').textContent = ' Penny is putting the report together...';
      const photos = {};
      for (const x of items) if (x.photoId && !photos[x.photoId]) { try { photos[x.photoId] = await HP_EXPENSE_PDF.jpeg('/_blob/' + x.photoId); } catch (e) { } }
      const made = new Date().toLocaleDateString('en-US', { timeZone: cfg.business.timeZone, month: 'short', day: 'numeric', year: 'numeric' });
      return HP_EXPENSE_PDF.build({ month: expSel, items, photos, made });
    };
    const fname = `Home-Pros-Expenses-${expSel}.pdf`;
    $('mPdf').onclick = async () => { if (!items.length) return; const bytes = await makePdf(); const ok = await L.download(fname, bytes); $('mStatus').textContent = ok ? ' Saved.' : " Couldn't save the file here."; };
    $('mEmail').onclick = async () => {
      if (!items.length) return;
      $('mEmail').disabled = true;
      const bytes = await makePdf();
      const total = tot(items), gst = items.reduce((t, x) => t + Number(x.gst || 0), 0);
      const body = `Hi Keith,\n\nHere's the expense report for ${monthName(expSel)}: ${items.length} receipt${items.length === 1 ? '' : 's'}, ${$$(total)} including ${$$(gst)} GST.\n\n` +
        Object.entries(items.reduce((o, x) => { o[x.category || 'Other'] = (o[x.category || 'Other'] || 0) + Number(x.amount || 0); return o; }, {})).sort((a, b) => b[1] - a[1]).map(([c, v]) => `${c}: ${$$(v)}`).join('\n') +
        (srcNames.length > 1 ? '\n\nBy source:\n' + srcNames.map(n => `${n}: ${srcTot(n).length} items, ${$$(tot(srcTot(n)))}`).join('\n') : '') +
        `\n\nThe PDF has every receipt and its photo.\n\nPenny\nAccounts assistant, Home Pros Group`;
      $('mStatus').textContent = ' Sending to keith@homeprosgroup.com...';
      const r = await L.emailPdf({ to: 'keith@homeprosgroup.com', subject: `Home Pros expense report: ${monthName(expSel)} (${items.length} receipts, ${$$(total)})`, body, filename: fname, bytes });
      if (r.ok) {
        await L.markReportSent(expSel, { sentAt: new Date().toISOString(), count: items.length, total: Math.round(total * 100) / 100, to: 'keith@homeprosgroup.com' });
        A.select();
        say(`Sent. The ${monthName(expSel)} report is in your inbox at keith@homeprosgroup.com. Add more receipts any time and send it again.`);
        expenseMonth(expSel);
      } else {
        $('mEmail').disabled = false;
        $('mStatus').textContent = r.error === 'server_not_connected' || r.error === 'not_in_manifest' || r.error === 'not_granted' ? ' Allow the Gmail connector for the arcade, then try again. You can also download the PDF.' : ' The email didn\'t go through. Try again, or download the PDF.';
      }
    };
    const n = items.length;
    const fromCards = items.filter(x => srcOf(x) !== 'Receipts').length;
    await say(n ? `${monthName(expSel)}: ${n} item${n === 1 ? '' : 's'}, ${$$(tot(items))}${fromCards ? ` (${n - fromCards} receipts, ${fromCards} from card statements)` : ''}. Tap a source to see it on its own; the report combines them all.` : `Nothing filed for ${monthName(expSel)} yet. Add receipts and I'll build the report.`);
    if (id !== run) return;
    acctChoices('exp');
  }

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

  async function receiptForm(defDate, backMonth) {
    const id = clear();
    S.office.select('penny');
    nameplate('PENNY · ACCOUNTING');
    const L = root.HP_LIVE;
    const can = L ? await L.receiptAbilities() : { canRead: false, canStore: false, canSave: false };
    if (id !== run) return;
    const today = (window.HP_SCHEDULE ? HP_SCHEDULE.localNow(cfg.business.timeZone) : new Date().toISOString()).slice(0, 10);
    rcBack = backMonth || null;
    rc = { date: defDate || today, vendor: '', total: '', gst: '', category: '', paidWith: '', note: '', photo: null, preview: '', read: false, question: '' };
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
    const fileMonth = (R.date || '').slice(0, 7), expect = rcBack || nowMonth();
    const odd = R.date && fileMonth !== expect && !R.dateOk;
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
        ${odd && !missing.length ? `<p class="warnline">This receipt is dated <b>${esc(fmtDate(R.date))}${R.date.slice(0, 4) !== new Date().getFullYear().toString() ? ', ' + esc(R.date.slice(0, 4)) : ''}</b>, so it will be filed under <b>${esc(monthName(fileMonth))}</b>, not ${esc(monthName(expect))}. Is that date right? If not, fix the date above.</p>` : ''}
        <button class="qa send ${missing.length || !can.canSave ? 'dim' : ''}" id="rsave">${odd && !missing.length ? 'Yes, file it under ' + esc(monthName(fileMonth)) : 'Save receipt'}</button><span id="rsaved" class="small"></span></div></div>`;
    const panel = $('panel');
    panel.querySelectorAll('input[data-k]').forEach(i => i.oninput = () => { R[i.dataset.k] = i.value; if (i.dataset.k === 'date') R.dateOk = false; });
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
          const ageDays = R.date ? (Date.now() - Date.parse(R.date + 'T12:00:00Z')) / 864e5 : 0;
          if (ageDays > 400 || ageDays < -2) got.question = ((got.question || '') + ` I read the date as ${fmtDate(R.date)}, ${R.date.slice(0, 4)}. That's ${ageDays < 0 ? 'in the future' : 'more than a year ago'}. Please check the date.`).trim();
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
      if (odd) { R.dateOk = true; }
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
        await say(`Filed under ${monthName(doc.month)}: ${item.vendor}, ${$$(item.amount)}, ${item.category}. That's ${$$(monthTotal)} in expenses for ${monthName(doc.month)} so far.${photo ? '' : ' (No photo kept.)'} Keep the paper copy.`);
        rc = null;
        receiptAgain(item.date.slice(0, 7));
      } catch (e) { $('rsaved').textContent = " Couldn't save just now. Try again in a minute."; }
    };
  }
  function receiptAgain(month) {
    choices([
      { label: 'Add another receipt', kind: 'primary', onPick: () => receiptForm(rcBack ? month + '-01' : undefined, rcBack) },
      { label: `See ${monthName(month)}`, onPick: () => expenseMonth(month) },
      { label: 'Back to the floor', kind: 'ghost', sound: 'back', isBack: true, onPick: () => floor() },
    ]);
  }

  /* ---------------------------------------------------- Email desk (Eddie) */
  const EMAIL_MAP = [
    ['keith@homeprosgroup.com', 'Inbox', 'Keith', 'Everything else'],
    ['bookings@homeprosgroup.com', 'Rosa', 'Rosa', 'Jayman orders, booking mail, customer booking questions'],
    ['accounts@homeprosgroup.com', 'Penny', 'Penny', 'Invoices, payment notices, supplier bills'],
    ['receipts@homeprosgroup.com', 'Penny', 'Penny', 'Receipts you email or forward; Penny files them'],
  ];
  async function emailDesk() {
    const id = clear();
    S.office.select('eddie');
    nameplate('EDDIE · EMAIL MANAGER');
    $('panel').innerHTML = '<div class="loading">Checking the inbox</div>';
    const L = root.HP_LIVE ? await root.HP_LIVE.eddie() : undefined;
    if (id !== run) return;
    const R = L && L.report, H = (L && L.history && L.history.days) || [];
    const tag = st => `<span class="tag ${st === 'ok' ? 'ok' : st === 'warn' ? 'wo' : ''}">${esc(st === 'ok' ? 'OK' : st === 'warn' ? 'CHECK' : st === 'todo' ? 'NOT SET UP' : 'PROBLEM')}</span>`;
    const list = (title, items) => items && items.length ? `<h3>${esc(title)}</h3><ul>${items.map(x => `<li>${esc(typeof x === 'string' ? x : x.text || JSON.stringify(x))}</li>`).join('')}</ul>` : '';
    const map = `<h3>THE EMAIL MAP</h3><table><tr><th>Address</th><th>Gmail label</th><th>Read by</th><th>What goes there</th></tr>${EMAIL_MAP.map(r => `<tr><td>${esc(r[0])}</td><td>${esc(r[1])}</td><td>${esc(r[2])}</td><td class="why">${esc(r[3])}</td></tr>`).join('')}</table>`;
    let html, line;
    if (!R) {
      html = `<div class="report"><h3>DAILY EMAIL CHECK</h3><p>My first check runs once my daily task is set up. Each morning after Rosa's run I go through the last 24 hours: I write reply drafts for anything that needs an answer (you send them), move clear spam to the Spam folder, list what you should check over, and make sure mail reaches the right label and everything that goes out looks right.</p>${map}</div>`;
      line = "No check yet, boss. Once my daily task is on, I'll report here every morning.";
    } else {
      const checks = (R.checks || []).map(c => `<tr><td>${esc(c.name)}</td><td>${tag(c.status)}</td><td class="why">${esc(c.detail || '')}</td></tr>`).join('');
      const hist = H.slice(-14).map(d => `<span class="dot ${esc(d.status)}" title="${esc(d.date + ': ' + d.status)}"></span>`).join('');
      html = `<div class="report"><h3>DAILY EMAIL CHECK · ${esc(fmtDate(R.date).toUpperCase())}</h3>
        <div class="kpis"><div>Overall<br>${tag(R.status)}</div><div>Mail in, last day<br><span class="big">${Number(R.received || 0)}</span></div><div>Sent, last day<br><span class="big">${Number(R.sent || 0)}</span></div><div>Drafts waiting<br><span class="big">${Number(R.drafts || 0)}</span></div><div>To check over<br><span class="big">${(R.review || []).length}</span></div><div>Moved to spam<br><span class="big">${(R.spamMoved || []).length}</span></div></div>
        <table><tr><th>Check</th><th></th><th>Details</th></tr>${checks}</table>
        ${list('CHECK THESE OVER', R.review)}
        ${(R.draftsMade || []).length ? `<h3>REPLY DRAFTS WAITING FOR YOU (${R.draftsMade.length})</h3><ul>${R.draftsMade.map(d => `<li>${esc(d.text || d)}${d.url ? ` <a href="${esc(d.url)}" target="_blank" rel="noopener noreferrer">open</a>` : ''}</li>`).join('')}</ul><p class="small">Open Gmail's Drafts, check each one, and send it yourself. Eddie never sends them.</p>` : ''}
        ${list('MOVED TO SPAM (UNDO IN GMAIL\'S SPAM FOLDER FOR 30 DAYS)', R.spamMoved)}
        ${list('MISSED OR UNLABELLED', R.missed)}${list('CUSTOMERS WAITING FOR A REPLY', R.unanswered)}${list('FORMATTING', R.formatting)}${list('TEST MESSAGES', R.tests)}
        ${hist ? `<h3>LAST 14 DAYS</h3><div class="dots">${hist}</div>` : ''}
        ${map}<p class="soon">From Eddie's check made ${esc(String(R.generatedAt || '').replace('T', ' ').slice(0, 16))}. ${R.session ? `<a class="qa link" href="${esc(R.session)}" target="_blank" rel="noopener noreferrer">Open Eddie's session &#8599;</a>` : ''}</p></div>`;
      const bad = (R.checks || []).filter(c => c.status !== 'ok');
      const dm = (R.draftsMade || []).length, rv = (R.review || []).length, sp = (R.spamMoved || []).length;
      line = `${Number(R.received || 0)} emails in the last day. ${dm} reply draft${dm === 1 ? '' : 's'} waiting for you, ${rv} to check over, ${sp} moved to spam.` + (bad.length ? ` And ${bad.length} setup thing${bad.length === 1 ? '' : 's'} to look at: ${bad.map(c => c.name.toLowerCase()).join(', ')}.` : '');
    }
    $('panel').innerHTML = html;
    await say(line);
    if (id !== run) return;
    choices(boardChoices('eddie'));
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
