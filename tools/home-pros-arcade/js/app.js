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
    services: [], answers: { furnace: {}, dryer: {} },
    customer: { city: cfg.business.defaultCity || '' },
    days: null, day: null, slot: null, qIndex: 0,
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
      `<li data-k="${esc(m.highlight || '')}"><span class="n">${esc(m.name)}</span><span class="p">${money(m.from)}</span><span class="note">${esc(m.note || '')}</span></li>`).join('');
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
    current = [];
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
  $('stage').addEventListener('click', () => { if (typing) typing(); });

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
  const selection = () => ({ services: state.services, answers: state.answers });
  const running = () => P.quote(selection());

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
  async function greet(again) {
    const id = clear();
    S.mood('idle'); highlight([]);
    state.services = []; state.answers = { furnace: {}, dryer: {} }; state.slot = null; state.days = null;
    setCash(0);
    await sayAll(again ? ['Okay, from the top. What are we cleaning?'] : cfg.lines.greet);
    if (id !== run) return;
    serviceChoices();
  }

  function serviceChoices(withBrowse = true) {
    const f = cfg.services.furnace, d = cfg.services.dryer;
    const fromF = Math.min(...f.questions[0].options.map(o => o.price || 0)) + (f.base || 0);
    const fromD = Math.min(...d.questions[0].options.map(o => o.price || 0)) + (d.base || 0);
    const list = [
      { label: f.label, amt: 'from ' + money(fromF), onPick: () => startQuestions(['furnace']) },
      { label: d.label, amt: 'from ' + money(fromD), onPick: () => startQuestions(['dryer']) },
      { label: 'Both, and save on the dryer vent', amt: 'dryer ' + money(cfg.bundle.dryerWithFurnace), kind: 'primary', onPick: () => startQuestions(['furnace', 'dryer']) },
    ];
    if (withBrowse) list.push({ label: 'Just looking at prices', kind: 'ghost', onPick: browse });
    choices(list);
  }

  async function browse() {
    const id = clear();
    highlight(cfg.menuBoard.map(m => m.highlight));
    await say(cfg.lines.browse);
    if (id !== run) return;
    serviceChoices(false);
    current.push({ label: 'Maybe later', kind: 'ghost', onPick: decline });
    choices(current);
  }

  function questionQueue() {
    const q = [];
    for (const s of ['furnace', 'dryer']) if (state.services.includes(s)) cfg.services[s].questions.forEach((x, i) => q.push({ service: s, q: x, i }));
    return q;
  }

  function startQuestions(services) {
    state.services = services;
    highlight(services);
    ask(0);
  }

  async function ask(n) {
    const queue = questionQueue();
    if (n >= queue.length) return showQuote();
    state.qIndex = n;
    const { service, q, i } = queue[n];
    const id = clear();
    highlight([...state.services, q.id]);
    const both = state.services.length > 1;
    const intro = n === 0 || (i === 0 && both) ? (service === 'dryer' && both ? 'Now the dryer vent. ' : '') : '';
    await say(intro + q.say);
    if (id !== run) return;
    const cheapest = Math.min(...q.options.map(o => o.price || 0));
    const list = q.options.map(o => {
      let price = o.price || 0;
      if (both && service === 'dryer' && i === 0) price = cfg.bundle.dryerWithFurnace + (price - cheapest);
      const amt = i === 0 ? money(price + (cfg.services[service].base || 0)) : price ? '+' + money(price) : '';
      return {
        label: o.label, amt,
        kind: state.answers[service][q.id] === o.id ? 'primary' : '',
        sound: 'none',
        onPick: () => {
          state.answers[service][q.id] = o.id;
          A.register();
          setCash(running().subtotal);
          ask(n + 1);
        },
      };
    });
    list.push({ label: n === 0 ? 'Back' : 'Back a step', kind: 'ghost', sound: 'back', isBack: true, onPick: () => n === 0 ? greet(true) : ask(n - 1) });
    choices(list);
  }

  function receipt(q, extra = '', title = 'HOME PROS QUOTE') {
    const rows = q.lines.map(l => `
      <div class="row"><span>${esc(l.label)}</span><span>${money(l.amount)}</span></div>
      ${l.parts.map(p => `<div class="row sub"><span>${esc(p.tag)}: ${esc(p.label)}</span><span>${p.price ? money(p.price) : ''}</span></div>`).join('')}`).join('');
    return `<div class="receipt"><h3>${esc(title)}</h3>${rows}<hr>
      <div class="row"><span>Subtotal</span><span>${money(q.subtotal)}</span></div>
      <div class="row"><span>${esc(cfg.tax.label)} ${Math.round(cfg.tax.rate * 100)}%</span><span>${money(q.tax)}</span></div>
      <div class="row total"><span>TOTAL</span><span>${money(q.total)}</span></div>${extra}</div>`;
  }

  async function showQuote() {
    const id = clear();
    const q = running();
    setCash(q.total);
    A.register();
    $('panel').innerHTML = receipt(q, '<div class="stamp">FLAT RATE &middot; NO SURPRISES</div>');
    await say(cfg.lines.quote);
    if (id !== run) return;
    choices([
      { label: 'Book it!', kind: 'primary', onPick: details },
      { label: 'Change my answers', onPick: () => ask(0), sound: 'back' },
      { label: 'Add the other service', disabled: state.services.length > 1, onPick: () => { const add = state.services.includes('furnace') ? 'dryer' : 'furnace'; state.services = ['furnace', 'dryer'].filter(s => s === add || state.services.includes(s)); highlight(state.services); ask(questionQueue().findIndex(x => x.service === add)); } },
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
      calendar();
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
      const res = await api.book({ ...selection(), customer, start: state.slot.start, website });
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
})();
