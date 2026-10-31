/* UI: tabs, forms, binding, rendering. Plain DOM, no framework. */
(function () {
  const S = PP.load();
  window.PP.state = S;
  const e = PP.esc, $ = (q, r) => (r || document).querySelector(q), $$ = (q, r) => Array.from((r || document).querySelectorAll(q));
  let current = 'command';
  let saveTimer = null;
  let lastReport = PP.SCENARIOS[1].id;

  /* ------------- persistence ------------- */
  function persist() {
    clearTimeout(saveTimer);
    $('#saveStatus').textContent = 'Saving…';
    saveTimer = setTimeout(() => {
      const ok = PP.save(S);
      $('#saveStatus').textContent = ok ? 'Saved' : 'Not saved: storage full or blocked';
      $('#saveStatus').className = 'pill ' + (ok ? 'ok' : 'bad');
    }, 250);
  }

  /* ------------- path binding -------------
     data-path="profile.adults" or "items.<id>.have" or
     "checklists.<id>.items.<id>.text". Arrays are walked by id. */
  function walk(path) {
    const seg = path.split('.');
    let o = S;
    for (let i = 0; i < seg.length - 1; i++) {
      o = Array.isArray(o) ? o.find(x => x.id === seg[i]) : o[seg[i]];
      if (o == null) return null;
    }
    return { obj: o, key: seg[seg.length - 1] };
  }
  function readInput(el) {
    if (el.type === 'checkbox' && el.dataset.multi !== undefined) {
      const w = walk(el.dataset.path); const arr = Array.isArray(w.obj[w.key]) ? w.obj[w.key].slice() : [];
      const v = el.dataset.multi; const i = arr.indexOf(v);
      if (el.checked && i < 0) arr.push(v); if (!el.checked && i >= 0) arr.splice(i, 1);
      return arr;
    }
    if (el.type === 'checkbox') return el.checked;
    if (el.type === 'number') return el.value === '' ? (el.dataset.nullable !== undefined ? null : 0) : Number(el.value);
    return el.value;
  }
  function bind(el) {
    const w = walk(el.dataset.path);
    if (!w) return;
    w.obj[w.key] = readInput(el);
    persist();
  }
  document.addEventListener('input', ev => {
    const el = ev.target;
    if (!el.dataset || !el.dataset.path) return;
    bind(el);
    if (el.dataset.live !== undefined) refreshSoon();
  });
  document.addEventListener('change', ev => {
    const el = ev.target;
    if (!el.dataset || !el.dataset.path) return;
    bind(el);
    /* Nothing on the profile tab is computed from other fields. */
    if (el.dataset.norender !== undefined || current === 'profile') return;
    /* Defer until focus has moved, so the field the user is moving
       into is the one that gets focus back after the rebuild. */
    if (pointerDown) pending = true; else setTimeout(render, 0);
  });
  /* Re-rendering while a mouse button is down would swallow the click
     that caused the blur, so wait until that click has landed. */
  let pointerDown = false, pending = false;
  document.addEventListener('pointerdown', () => { pointerDown = true; }, true);
  document.addEventListener('pointerup', () => setTimeout(() => { pointerDown = false; if (pending) { pending = false; render(); } }, 0), true);
  let rTimer = null;
  function refreshSoon() { clearTimeout(rTimer); rTimer = setTimeout(render, 600); }

  /* ------------- tabs ------------- */
  function show(panel) {
    current = panel;
    $$('.tab').forEach(t => t.setAttribute('aria-selected', t.dataset.panel === panel ? 'true' : 'false'));
    $$('.panel').forEach(p => p.classList.toggle('on', p.id === 'panel-' + panel));
    if (location.hash !== '#' + panel) history.replaceState(null, '', '#' + panel);
    render();
    window.scrollTo(0, 0);
  }
  $$('.tab').forEach(t => t.addEventListener('click', () => show(t.dataset.panel)));
  document.addEventListener('click', ev => {
    const go = ev.target.closest('[data-go]');
    if (go) { ev.preventDefault(); show(go.dataset.go); }
  });

  /* ------------- render with focus kept ------------- */
  function render() {
    const a = document.activeElement;
    const key = a && a.dataset && (a.dataset.path || a.id) ? (a.dataset.path ? 'p:' + a.dataset.path + ':' + (a.dataset.multi || '') : 'i:' + a.id) : null;
    const sel = a && 'selectionStart' in a ? [a.selectionStart, a.selectionEnd] : null;
    const fn = R[current];
    if (fn) fn($('#panel-' + current));
    if (key) {
      let el = null;
      if (key.startsWith('p:')) {
        const parts = key.slice(2).split(':');
        el = $$('[data-path]').find(x => x.dataset.path === parts[0] && (x.dataset.multi || '') === parts[1] && x.offsetParent !== null);
      } else el = document.getElementById(key.slice(2));
      if (el && el !== document.activeElement) {
        el.focus({ preventScroll: true });
        try { if (sel && el.setSelectionRange && sel[0] != null) el.setSelectionRange(sel[0], sel[1]); } catch (_) { }
      }
    }
  }

  /* ------------- small builders ------------- */
  const opt = (v, label, cur) => `<option value="${e(v)}"${String(cur) === String(v) ? ' selected' : ''}>${e(label)}</option>`;
  const fld = (label, inner, cls) => `<label class="fld ${cls || ''}"><span>${label}</span>${inner}</label>`;
  const txt = (path, val, ph, extra) => `<input type="text" data-path="${path}" value="${e(val)}" placeholder="${e(ph || '')}" ${extra || ''}>`;
  const num = (path, val, extra) => `<input type="number" inputmode="decimal" data-path="${path}" value="${val === null || val === undefined ? '' : e(val)}" ${extra || ''}>`;
  const sel = (path, cur, opts) => `<select data-path="${path}">${opts.map(o => opt(o[0], o[1], cur)).join('')}</select>`;
  const chk = (path, val, label) => `<label class="chk"><input type="checkbox" data-path="${path}" ${val ? 'checked' : ''}> ${label}</label>`;
  const bar = (pct, cls) => `<div class="bar ${cls || ''}"><i style="width:${Math.round(pct * 100)}%"></i></div>`;
  const pctTxt = x => Math.round(x * 100) + '%';
  const priCls = p => ({ 'Critical': 'pri-c', 'Important': 'pri-i', 'Nice-to-have': 'pri-n' }[p] || '');

  const R = {};

  /* ================= COMMAND ================= */
  R.command = el => {
    const sum = PP.summary(S), p = S.profile, gaps = PP.gaps(S).slice(0, 5), miss = PP.missing(p);
    const d = S.decision, v = PP.decide(d, p);
    const rem = sum.budget - sum.spent;
    el.innerHTML = `
      <div class="card hero">
        <div>
          <div class="k">Household</div>
          <h1>${e(p.householdName || 'Your household')}</h1>
          <div class="sub">${PP.persons(p)} people${+p.pets ? ' · ' + p.pets + ' pet(s)' : ''} · ${e(p.location)} · ${p.prepDays}-day target</div>
          ${miss.length ? `<p class="warn-t">Profile incomplete: ${miss.length} field(s) missing. <a href="#profile" data-go="profile">Finish the profile</a> so the plans fit your home.</p>` : ''}
        </div>
        <div class="ring" style="--p:${Math.round(sum.overall * 100)}"><b>${pctTxt(sum.overall)}</b><span>ready</span></div>
      </div>

      <div class="tiles">
        <div class="tile"><div class="k">Critical items complete</div><div class="n">${sum.criticalDone}<small>/${sum.criticalCount}</small></div>${bar(sum.critical, 'crit')}</div>
        <div class="tile"><div class="k">Water stored</div><div class="n">${sum.waterDays.toFixed(1)}<small> days</small></div>${bar(Math.min(1, sum.waterDays / p.prepDays))}</div>
        <div class="tile"><div class="k">Food stored</div><div class="n">${sum.foodDays.toFixed(1)}<small> days</small></div>${bar(Math.min(1, sum.foodDays / p.prepDays))}</div>
        <div class="tile"><div class="k">Spent / budget</div><div class="n">${PP.money(sum.spent)}<small> / ${PP.money(sum.budget)}</small></div>${bar(sum.budget ? Math.min(1, sum.spent / sum.budget) : 0, sum.spent > sum.budget ? 'over' : '')}<div class="small">${rem >= 0 ? PP.money(rem) + ' left' : PP.money(-rem) + ' over'} · ${PP.money(sum.toBuy)} to finish (${PP.money(sum.toBuyCritical)} critical)</div></div>
      </div>

      <div class="cols2">
        <div class="card">
          <h2>Decision check: stay or go?</h2>
          <p class="sub">Set what is true right now. The verdict follows the stay-home-by-default rules.</p>
          <div class="grid-f">
            ${fld('Outside temp (°C)', num('decision.temp', d.temp))}
            ${fld('Home heat', sel('decision.heat', d.heat, [['ok', 'Working'], ['failing', 'Failing / falling'], ['none', 'Cannot be heated']]))}
            ${fld('Structure', sel('decision.structure', d.structure, [['ok', 'Sound'], ['damaged', 'Damaged'], ['fire', 'Fire / failing']]))}
            ${fld('Fallout', sel('decision.fallout', d.fallout, [['none', 'None'], ['warning', 'Warning, not arrived'], ['active', 'Active, first 48 h'], ['after', 'After 48 h']]))}
            ${fld('Official order', sel('decision.order', d.order, [['none', 'None'], ['alert', 'Evacuation alert (be ready)'], ['evacuate', 'Evacuation ORDER'], ['shelter', 'Shelter-in-place order']]))}
            ${fld('Event phase', sel('decision.phase', d.phase, [['golden', 'Golden window (0–24 h)'], ['chaos', 'Chaos (day 2 – week 4)'], ['stabilization', 'Stabilization (week 8+)']]))}
            ${fld('Roads', sel('decision.roads', d.roads, [['clear', 'Clear'], ['congested', 'Congested'], ['dangerous', 'Dangerous / blocked']]))}
            ${fld('Destination', sel('decision.dest', d.dest, [['none', 'None'], ['uncertain', 'Not confirmed'], ['confirmed', 'Confirmed, one leg']]))}
            ${fld('Daylight for the trip', sel('decision.daylight', d.daylight, [['yes', 'Yes'], ['no', 'No']]))}
            ${fld('Threat at home', sel('decision.threat', d.threat, [['none', 'None'], ['elevated', 'Elevated'], ['imminent', 'Threat to life']]))}
          </div>
          <div class="verdict v-${v.verdict.replace(/\s+/g, '-').toLowerCase()}"><b>${v.verdict}</b>${'<ul>' + v.reasons.map(r => `<li>${e(r)}</li>`).join('') + '</ul>'}</div>
        </div>
        <div>
          <div class="card">
            <h2>Top 5 gaps right now</h2>
            ${gaps.length ? '<ol class="gaps">' + gaps.map(g => `<li><b>${e(g.text)}</b><br><span class="small">${e(g.fix)}</span></li>`).join('') + '</ol>' : '<p>No major gaps. Keep drilling.</p>'}
          </div>
          <div class="card">
            <h2>Expiry alerts</h2>
            ${sum.expiring.length ? '<ul class="alerts">' + sum.expiring.map(r => `<li class="${r.exp < 0 ? 'bad' : r.exp <= 30 ? 'warn' : ''}"><b>${e(r.item.name)}</b> ${r.exp < 0 ? 'expired ' + (-r.exp) + ' days ago' : r.exp === 0 ? 'expires today' : 'expires in ' + r.exp + ' days'}</li>`).join('') + '</ul>' : '<p class="small">Nothing expires in the next 60 days. Add expiry dates in the purchase tracker.</p>'}
          </div>
          <div class="card">
            <h2>Readiness by category</h2>
            <table class="mini">${Object.entries(sum.byCat).map(([c, x]) => `<tr><td>${e(c)}</td><td class="w">${bar(x.w ? x.got / x.w : 0)}</td><td class="r">${pctTxt(x.w ? x.got / x.w : 0)}</td></tr>`).join('')}</table>
          </div>
        </div>
      </div>
      <div class="card quick">
        <a class="btn" href="#report" data-go="report">Build a scenario plan</a>
        <a class="btn btn-o" href="#shopping" data-go="shopping">Open shopping list</a>
        <a class="btn btn-o" href="#checklists" data-go="checklists">Checklists</a>
        <a class="btn btn-o" href="#backup" data-go="backup">Export a backup</a>
      </div>`;
  };

  /* ================= PROFILE ================= */
  R.profile = el => {
    const p = S.profile, P = k => 'profile.' + k;
    const skills = ['First aid / CPR', 'Hunting', 'Fishing', 'Mechanical', 'Electrical', 'Carpentry / trades', 'Gardening', 'Food preserving', 'Ham radio', 'Wilderness / winter survival', 'Medical professional'];
    el.innerHTML = `
      <div class="card"><h2>Household profile</h2><p class="sub">Everything else reads from this: quantities, checklists, the decision check, the gap list and every scenario plan. Saved as you type.</p></div>
      <div class="card"><h3>Household</h3><div class="grid-f">
        ${fld('Household name', txt(P('householdName'), p.householdName, 'e.g. The Smith household'), 'span2')}
        ${fld('Location', txt(P('location'), p.location), 'span2')}
        ${fld('Adults', num(P('adults'), p.adults, 'min="0"'))}
        ${fld('Children', num(P('children'), p.children, 'min="0"'))}
        ${fld('Children ages', txt(P('childAges'), p.childAges, 'e.g. 4, 9'))}
        ${fld('Seniors', num(P('seniors'), p.seniors, 'min="0"'))}
        ${fld('Pets', num(P('pets'), p.pets, 'min="0"'))}
        ${fld('Pet details', txt(P('petNotes'), p.petNotes, 'e.g. 1 dog, 2 cats'))}
        ${fld('Medical needs', txt(P('medical'), p.medical, 'e.g. insulin, CPAP, heart meds'), 'span2')}
        ${fld('Mobility needs', txt(P('mobility'), p.mobility, 'e.g. cannot use stairs'), 'span2')}
        <div class="fld span2">${chk(P('fridgeMeds'), p.fridgeMeds, 'A medication needs refrigeration')}</div>
      </div></div>
      <div class="card"><h3>Home</h3><div class="grid-f">
        ${fld('House type', sel(P('houseType'), p.houseType, [['', 'Choose…'], ['detached', 'Detached house'], ['semi', 'Semi / duplex'], ['townhouse', 'Townhouse'], ['apartment', 'Apartment / condo'], ['acreage', 'Acreage / farm'], ['mobile', 'Mobile home']]))}
        ${fld('Levels (incl. basement)', num(P('levels'), p.levels, 'min="1"'))}
        ${fld('Basement', sel(P('basement'), p.basement, [['unknown', 'Not set'], ['unfinished concrete', 'Unfinished, concrete walls'], ['finished concrete', 'Finished, concrete walls'], ['partial', 'Partial / crawlspace'], ['none', 'No basement']]))}
        ${fld('Primary heat', sel(P('heat'), p.heat, [['gas-forced', 'Natural gas forced air'], ['gas-boiler', 'Gas boiler / in-floor'], ['propane', 'Propane furnace'], ['electric', 'Electric'], ['wood', 'Wood'], ['other', 'Other']]))}
        ${fld('Backup heat', sel(P('backupHeat'), p.backupHeat, [['none', 'None'], ['wood', 'Wood stove (installed)'], ['fireplace', 'Direct-vent gas fireplace (no power needed)'], ['indoor-propane', 'Indoor-rated propane heater'], ['other', 'Other']]))}
        ${fld('Water', sel(P('water'), p.water, [['municipal', 'Municipal'], ['well', 'Well'], ['cistern', 'Cistern / hauled']]))}
        ${fld('Generator', sel(P('generator'), p.generator, [['none', 'None'], ['portable', 'Portable'], ['inverter', 'Inverter (quiet)'], ['standby', 'Standby (installed)']]))}
        ${fld('CO detectors', sel(P('coDetectors'), p.coDetectors, [['unknown', 'Not sure'], ['none', 'None'], ['some', 'Some levels'], ['every', 'Every level, battery']]))}
        <div class="fld">${chk(P('transferSwitch'), p.transferSwitch, 'Transfer switch / interlock')}</div>
        <div class="fld">${chk(P('solar'), p.solar, 'Solar on site')}</div>
      </div></div>
      <div class="card"><h3>Vehicles, skills, people</h3><div class="grid-f">
        ${fld('Vehicles', num(P('vehicles'), p.vehicles, 'min="0"'))}
        ${fld('Vehicle details', txt(P('vehicleNotes'), p.vehicleNotes, 'e.g. 4x4 truck, block heater'), 'span2')}
        <div class="fld">${chk(P('winterVehicle'), p.winterVehicle, 'Winter tyres + kit')}</div>
        <div class="fld span4"><span>Skills in the household</span><div class="chips">${skills.map(k => `<label class="chk"><input type="checkbox" data-path="profile.skills" data-multi="${e(k)}" ${p.skills.includes(k) ? 'checked' : ''}> ${e(k)}</label>`).join('')}</div></div>
        <div class="fld">${chk(P('pal'), p.pal, 'PAL holder (firearms)')}</div>
        <div class="fld">${chk(P('neighbourGroup'), p.neighbourGroup, 'Have a trusted neighbour group')}</div>
        ${fld('Household roles (who does what)', `<textarea data-path="profile.roles" rows="3" placeholder="Lead: …\nHeat & CO: …\nMedical: …">${e(p.roles)}</textarea>`, 'span4')}
      </div></div>
      <div class="card"><h3>Retreat option</h3><div class="grid-f">
        ${fld('Destination', txt(P('retreatName'), p.retreatName, "e.g. Parents' acreage near Entwistle"), 'span2')}
        ${fld('Distance (km)', num(P('retreatKm'), p.retreatKm, 'min="0"'))}
        <div class="fld">${chk(P('retreatConfirmed'), p.retreatConfirmed, 'Pre-arranged / confirmed')}<br>${chk(P('retreatHeated'), p.retreatHeated, 'Has heat without grid')}</div>
        ${fld('Routes (primary, secondary, tertiary)', `<textarea data-path="profile.retreatRoute" rows="3" placeholder="Primary: Range Rd … north to Twp Rd …\nSecondary: …\nTertiary: …">${e(p.retreatRoute)}</textarea>`, 'span4')}
      </div></div>
      <div class="card"><h3>Communications</h3><div class="grid-f">
        ${fld('Out-of-area contact', txt(P('outOfArea'), p.outOfArea, 'Name and phone, outside Alberta ideally'), 'span2')}
        ${fld('Meeting point near home', txt(P('meetNear'), p.meetNear, 'e.g. the big spruce at the end of the street'), 'span2')}
        ${fld('Meeting point outside the neighbourhood', txt(P('meetFar'), p.meetFar, 'e.g. church parking lot on …'), 'span2')}
        ${fld('Contact tree', `<textarea data-path="profile.contacts" rows="4" placeholder="Mum: 780-…  (calls Uncle Rob)\nNeighbour Jo: 780-…">${e(p.contacts)}</textarea>`, 'span4')}
      </div></div>
      <div class="card"><h3>Budget and target</h3><div class="grid-f">
        ${fld('Budget level', sel(P('budgetLevel'), p.budgetLevel, [['low', 'Low'], ['moderate', 'Moderate'], ['high', 'High']]))}
        ${fld('Prep budget (CAD)', num(P('budget'), p.budget, 'min="0" step="50"'))}
        ${fld('Days of supplies to aim for', num(P('prepDays'), p.prepDays, 'min="3" max="365"'))}
      </div><p class="small">Government of Canada guidance is at least 72 hours; 14 days is a sensible household target for Alberta winters.</p></div>`;
  };

  /* ================= TRACKER ================= */
  let trackFilter = { cat: '', pri: '', short: false };
  R.tracker = el => {
    const p = S.profile, sum = PP.summary(S);
    const rowsAll = S.items.map(i => ({ i, applies: PP.applies(i, p), r: sum.rows.find(r => r.item === i) }));
    const rows = rowsAll.filter(x => (!trackFilter.cat || x.i.cat === trackFilter.cat) && (!trackFilter.pri || x.i.pri === trackFilter.pri) && (!trackFilter.short || (x.r && x.r.need > 0)));
    const supOpts = [['', 'Auto (by store type)']].concat(S.suppliers.map(s => [s.id, s.name]));
    const cats = PP.CATEGORIES.concat(Array.from(new Set(S.items.map(i => i.cat))).filter(c => !PP.CATEGORIES.includes(c)));
    el.innerHTML = `
      <div class="card">
        <h2>Purchase tracker</h2>
        <p class="sub">Targets are worked out from your profile (${PP.persons(p)} people, ${p.prepDays} days). Override any target, record what you have, what you spent and when it expires.</p>
        <div class="tiles slim">
          <div class="tile"><div class="k">Overall</div><div class="n">${pctTxt(sum.overall)}</div>${bar(sum.overall)}</div>
          <div class="tile"><div class="k">Critical</div><div class="n">${sum.criticalDone}<small>/${sum.criticalCount}</small></div>${bar(sum.critical, 'crit')}</div>
          <div class="tile"><div class="k">Spent</div><div class="n">${PP.money(sum.spent)}<small> of ${PP.money(sum.budget)}</small></div>${bar(sum.budget ? Math.min(1, sum.spent / sum.budget) : 0, sum.spent > sum.budget ? 'over' : '')}</div>
          <div class="tile"><div class="k">To finish</div><div class="n">${PP.money(sum.toBuy)}</div><div class="small">${PP.money(sum.toBuyCritical)} of it critical${sum.budget ? ' · ' + (sum.budget - sum.spent >= sum.toBuy ? 'fits the budget' : PP.money(sum.toBuy - (sum.budget - sum.spent)) + ' over budget') : ''}</div></div>
        </div>
        <div class="row no-print">
          <label class="fld"><span>Category</span><select id="fCat">${[['', 'All']].concat(cats.map(c => [c, c])).map(o => opt(o[0], o[1], trackFilter.cat)).join('')}</select></label>
          <label class="fld"><span>Priority</span><select id="fPri">${[['', 'All'], ['Critical', 'Critical'], ['Important', 'Important'], ['Nice-to-have', 'Nice-to-have']].map(o => opt(o[0], o[1], trackFilter.pri)).join('')}</select></label>
          <label class="chk"><input type="checkbox" id="fShort" ${trackFilter.short ? 'checked' : ''}> Only items still needed</label>
          <span class="grow"></span>
          <button class="btn btn-o btn-sm" onclick="PP.printPanel('tracker')">Print</button>
        </div>
      </div>
      <div class="card tscroll">
        <table class="data tracker">
          <thead><tr><th>Item</th><th>Priority</th><th>Target</th><th>Have</th><th>Progress</th><th>Cost each</th><th>Spent</th><th>Expires</th><th>Where to buy</th><th class="no-print"></th></tr></thead>
          <tbody>
          ${cats.map(c => {
            const rs = rows.filter(x => x.i.cat === c);
            if (!rs.length) return '';
            return `<tr class="grp"><td colspan="10">${e(c)}</td></tr>` + rs.map(({ i, applies, r }) => {
              const path = 'items.' + i.id + '.';
              const t = PP.target(i, p);
              const exp = PP.daysUntil(i.expiry);
              const expCls = exp === null ? '' : exp < 0 ? 'bad' : exp <= 30 ? 'warn' : exp <= 60 ? 'soon' : '';
              return `<tr class="${applies ? '' : 'na'} ${r && r.pct >= 1 ? 'done' : ''}">
                <td class="name">${i.custom ? txt(path + 'name', i.name, 'Item') : `<b>${e(i.name)}</b>`}${i.note ? `<div class="small">${e(i.note)}</div>` : ''}${!applies ? `<div class="small">${i.hidden ? 'Hidden' : 'Not needed for your profile'}</div>` : ''}</td>
                <td>${sel(path + 'pri', i.pri, [['Critical', 'Critical'], ['Important', 'Important'], ['Nice-to-have', 'Nice']])}</td>
                <td class="nw"><input type="number" class="sm" data-path="${path}targetOverride" data-nullable value="${i.targetOverride === null || i.targetOverride === undefined ? '' : e(i.targetOverride)}" placeholder="${t}" title="Leave blank to use the profile-based target"> <span class="u">${e(i.unit)}</span></td>
                <td class="nw"><button class="step no-print" data-step="${i.id}" data-d="-1">−</button><input type="number" class="sm" data-path="${path}have" value="${e(i.have)}" min="0"><button class="step no-print" data-step="${i.id}" data-d="1">+</button></td>
                <td class="w">${applies ? bar(r ? r.pct : 0, i.pri === 'Critical' ? 'crit' : '') + `<span class="small">${r ? r.have + '/' + r.target : ''}</span>` : ''}</td>
                <td><input type="number" class="sm" step="0.01" data-path="${path}cost" value="${e(i.cost)}"></td>
                <td><input type="number" class="sm" step="0.01" data-path="${path}spent" value="${e(i.spent)}"></td>
                <td class="${expCls}"><input type="date" data-path="${path}expiry" value="${e(i.expiry)}">${exp !== null ? `<div class="small">${exp < 0 ? 'expired' : exp + ' d'}</div>` : ''}</td>
                <td>${sel(path + 'supplierId', i.supplierId, supOpts)}</td>
                <td class="no-print">${i.custom ? `<button class="x" data-del-item="${i.id}" title="Delete">✕</button>` : `<button class="x" data-hide-item="${i.id}" title="${i.hidden ? 'Show' : 'Hide (not needed)'}">${i.hidden ? '↺' : '–'}</button>`}</td>
              </tr>`;
            }).join('');
          }).join('')}
          </tbody>
        </table>
      </div>
      <div class="card no-print">
        <h3>Add an item</h3>
        <div class="row">
          <label class="fld grow"><span>Name</span><input id="niName" placeholder="e.g. Infant formula"></label>
          <label class="fld"><span>Category</span><select id="niCat">${cats.map(c => opt(c, c, 'Food')).join('')}</select></label>
          <label class="fld"><span>Priority</span><select id="niPri">${opt('Critical', 'Critical')}${opt('Important', 'Important', 'Important')}${opt('Nice-to-have', 'Nice-to-have')}</select></label>
          <label class="fld"><span>Target qty</span><input id="niQty" type="number" value="1" class="sm"></label>
          <label class="fld"><span>Unit</span><input id="niUnit" value="each" class="sm"></label>
          <label class="fld"><span>Cost each</span><input id="niCost" type="number" step="0.01" value="0" class="sm"></label>
          <label class="fld"><span>Store type</span><select id="niStore">${Object.entries(PP.STORE_TYPES).map(([k, v]) => opt(k, v, 'grocery')).join('')}</select></label>
          <button class="btn" id="niAdd">Add</button>
        </div>
      </div>`;
    $('#fCat').onchange = ev => { trackFilter.cat = ev.target.value; render(); };
    $('#fPri').onchange = ev => { trackFilter.pri = ev.target.value; render(); };
    $('#fShort').onchange = ev => { trackFilter.short = ev.target.checked; render(); };
    $('#niAdd').onclick = () => {
      const name = $('#niName').value.trim(); if (!name) { $('#niName').focus(); return; }
      S.items.push({ id: 'c-' + PP.uid(), custom: true, name, cat: $('#niCat').value, unit: $('#niUnit').value || 'each', rule: 'fx', n: +$('#niQty').value || 1, pri: $('#niPri').value, cost: +$('#niCost').value || 0, life: 0, store: $('#niStore').value, fam: ['*'], targetOverride: null, have: 0, spent: 0, expiry: '', supplierId: '', hidden: false });
      persist(); render();
    };
  };
  document.addEventListener('click', ev => {
    const st = ev.target.closest('[data-step]');
    if (st) { const i = S.items.find(x => x.id === st.dataset.step); i.have = Math.max(0, (+i.have || 0) + (+st.dataset.d)); persist(); render(); return; }
    const del = ev.target.closest('[data-del-item]');
    if (del) { if (confirm('Delete this item?')) { S.items = S.items.filter(x => x.id !== del.dataset.delItem); persist(); render(); } return; }
    const hid = ev.target.closest('[data-hide-item]');
    if (hid) { const i = S.items.find(x => x.id === hid.dataset.hideItem); i.hidden = !i.hidden; persist(); render(); }
  });

  /* ================= SHOPPING LIST ================= */
  let shopCritical = false;
  R.shopping = el => {
    const sum = PP.summary(S);
    const need = sum.rows.filter(r => r.need > 0 && (!shopCritical || r.item.pri === 'Critical'));
    const groups = new Map();
    need.forEach(r => {
      const sup = PP.supplierFor(r.item, S);
      const key = sup ? sup.id : '_none';
      if (!groups.has(key)) groups.set(key, { sup, rows: [] });
      groups.get(key).rows.push(r);
    });
    const order = { Critical: 0, Important: 1, 'Nice-to-have': 2 };
    const total = need.reduce((a, r) => a + r.toBuy, 0);
    el.innerHTML = `
      <div class="card">
        <h2>Shopping list by store</h2>
        <p class="sub">Everything still short of target, grouped by the supplier it is assigned to (or the first supplier that sells that type of item). Change assignments on the Purchases tab or edit stores on the Suppliers tab.</p>
        <div class="row no-print">
          <label class="chk"><input type="checkbox" id="shopCrit" ${shopCritical ? 'checked' : ''}> Critical items only</label>
          <span class="grow"></span>
          <b>${need.length} items · about ${PP.money(total)}</b>
          <button class="btn btn-o btn-sm" onclick="PP.printPanel('shopping')">Print list</button>
        </div>
        <div class="print-only"><b>${need.length} items · about ${PP.money(total)}</b> · printed ${new Date().toLocaleDateString('en-CA')}</div>
      </div>
      ${need.length ? Array.from(groups.values()).map(g => {
        const st = g.rows.reduce((a, r) => a + r.toBuy, 0);
        const sp = g.sup;
        return `<div class="card shop">
          <div class="shop-h"><div><h3>${sp ? e(sp.name) : 'Not linked to a store yet'}</h3>
            <div class="small">${sp ? [sp.address, sp.town, sp.phone, sp.hours].filter(Boolean).map(e).join(' · ') || 'Add address and hours on the Suppliers tab' : '<a href="#suppliers" data-go="suppliers">Add a supplier</a>'}</div></div>
            <div class="r"><b>${PP.money(st)}</b></div></div>
          <table class="data">
            <thead><tr><th></th><th>Item</th><th>Priority</th><th>Buy</th><th>Est. cost</th><th class="no-print">Bought</th></tr></thead>
            <tbody>${g.rows.sort((a, b) => order[a.item.pri] - order[b.item.pri]).map(r => `
              <tr><td><span class="box"></span></td><td>${e(r.item.name)}</td><td><span class="tag ${priCls(r.item.pri)}">${r.item.pri}</span></td>
              <td>${r.need} ${e(r.item.unit)}</td><td>${PP.money(r.toBuy)}</td>
              <td class="no-print nw"><input type="number" class="sm" step="0.01" id="paid-${r.item.id}" value="${Math.round(r.toBuy * 100) / 100}" title="Amount actually paid"><button class="btn btn-sm" data-bought="${r.item.id}">Bought</button></td></tr>`).join('')}
            </tbody></table></div>`;
      }).join('') : '<div class="card"><p>Nothing left to buy. Check the expiry alerts on the Command tab.</p></div>'}`;
    $('#shopCrit').onchange = ev => { shopCritical = ev.target.checked; render(); };
  };
  document.addEventListener('click', ev => {
    const b = ev.target.closest('[data-bought]');
    if (!b) return;
    const i = S.items.find(x => x.id === b.dataset.bought);
    const paid = +($('#paid-' + i.id) || {}).value || 0;
    i.have = PP.target(i, S.profile);
    i.spent = (+i.spent || 0) + paid;
    if (i.life && !i.expiry) { const d = new Date(); d.setMonth(d.getMonth() + i.life); i.expiry = d.toISOString().slice(0, 10); }
    persist(); render();
  });

  /* ================= CHECKLISTS ================= */
  R.checklists = el => {
    el.innerHTML = `
      <div class="card"><h2>Checklists</h2><p class="sub">Edit any line, add your own, tick as you go. Reset clears ticks for the next drill.</p>
        <div class="row no-print"><input id="newList" placeholder="New checklist name" class="grow"><button class="btn" id="addList">Add checklist</button><span class="grow"></span><button class="btn btn-o btn-sm" onclick="PP.printPanel('checklists')">Print all</button></div></div>
      <div class="lists">
      ${S.checklists.map(l => {
        const done = l.items.filter(x => x.done).length;
        return `<div class="card list">
          <div class="list-h"><input class="title" data-path="checklists.${l.id}.title" value="${e(l.title)}" data-norender><span class="small">${done}/${l.items.length}</span></div>
          ${bar(l.items.length ? done / l.items.length : 0)}
          <ul class="cl">${l.items.map(it => `<li class="${it.done ? 'done' : ''}"><input type="checkbox" data-path="checklists.${l.id}.items.${it.id}.done" ${it.done ? 'checked' : ''}><input type="text" class="t" data-path="checklists.${l.id}.items.${it.id}.text" value="${e(it.text)}" data-norender><button class="x no-print" data-del-ci="${l.id}:${it.id}" title="Remove">✕</button></li>`).join('')}</ul>
          <div class="row no-print"><input placeholder="Add an item" id="ni-${l.id}" class="grow" data-add-ci="${l.id}"><button class="btn btn-sm" data-add-ci-btn="${l.id}">Add</button></div>
          <div class="row no-print end"><button class="btn btn-o btn-sm" data-reset-list="${l.id}">Reset ticks</button><button class="btn btn-o btn-sm danger" data-del-list="${l.id}">Delete list</button></div>
        </div>`;
      }).join('')}
      </div>`;
    $('#addList').onclick = () => { const t = $('#newList').value.trim(); if (!t) return; S.checklists.push({ id: PP.uid(), title: t, items: [] }); persist(); render(); };
  };
  function addCI(id) {
    const inp = $('#ni-' + id); const t = inp.value.trim(); if (!t) return;
    S.checklists.find(l => l.id === id).items.push({ id: PP.uid(), text: t, done: false }); persist(); render();
    const again = $('#ni-' + id); if (again) again.focus();
  }
  document.addEventListener('keydown', ev => { if (ev.key === 'Enter' && ev.target.dataset && ev.target.dataset.addCi) { ev.preventDefault(); addCI(ev.target.dataset.addCi); } });
  document.addEventListener('click', ev => {
    const a = ev.target.closest('[data-add-ci-btn]'); if (a) return addCI(a.dataset.addCiBtn);
    const d = ev.target.closest('[data-del-ci]');
    if (d) { const [l, i] = d.dataset.delCi.split(':'); const L = S.checklists.find(x => x.id === l); L.items = L.items.filter(x => x.id !== i); persist(); render(); return; }
    const r = ev.target.closest('[data-reset-list]');
    if (r) { S.checklists.find(x => x.id === r.dataset.resetList).items.forEach(x => x.done = false); persist(); render(); return; }
    const dl = ev.target.closest('[data-del-list]');
    if (dl && confirm('Delete this checklist?')) { S.checklists = S.checklists.filter(x => x.id !== dl.dataset.delList); persist(); render(); }
  });

  /* ================= REPORT ================= */
  R.report = () => {
    const s = $('#scenarioSel');
    if (!s.options.length) s.innerHTML = PP.SCENARIOS.map((x, i) => opt(x.id, (i + 1) + '. ' + x.name, lastReport)).join('');
    s.value = lastReport;
    genReport();
  };
  function genReport() {
    lastReport = $('#scenarioSel').value;
    const r = PP.buildReport(S, lastReport);
    $('#reportOut').innerHTML = r.html;
    document.title = r.scenario.id + '-plan-' + new Date().toISOString().slice(0, 10);
  }
  $('#genBtn').onclick = genReport;
  $('#scenarioSel').onchange = genReport;
  $('#printReportBtn').onclick = () => { genReport(); PP.printPanel('report'); };

  /* ================= SUPPLIERS ================= */
  R.suppliers = el => {
    const sum = PP.summary(S);
    el.innerHTML = `
      <div class="card"><h2>Local suppliers directory</h2>
        <p class="sub">The stores you would buy food, medicine, fuel, radios and security gear from. Each one is linked to your shopping list: items are routed to the first store that sells that type, unless you assign a store on the Purchases tab. The starter entries are generic; replace them with your actual stores, addresses and hours.</p>
        <div class="row no-print"><button class="btn" id="addSup">Add supplier</button><span class="grow"></span><button class="btn btn-o btn-sm" onclick="PP.printPanel('suppliers')">Print</button></div></div>
      <div class="sups">
      ${S.suppliers.map(v => {
        const P = 'suppliers.' + v.id + '.';
        const linked = sum.rows.filter(r => r.need > 0 && (PP.supplierFor(r.item, S) || {}).id === v.id);
        return `<div class="card sup">
          <div class="grid-f">
            ${fld('Store name', txt(P + 'name', v.name, '', 'data-norender'), 'span2')}
            ${fld('Town', txt(P + 'town', v.town, '', 'data-norender'))}
            ${fld('Phone', txt(P + 'phone', v.phone, '', 'data-norender'))}
            ${fld('Address', txt(P + 'address', v.address, '', 'data-norender'), 'span2')}
            ${fld('Hours', txt(P + 'hours', v.hours, '', 'data-norender'), 'span2')}
            <div class="fld span4"><span>Sells</span><div class="chips">${Object.entries(PP.STORE_TYPES).map(([k, lab]) => `<label class="chk"><input type="checkbox" data-path="suppliers.${v.id}.types" data-multi="${k}" ${(v.types || []).includes(k) ? 'checked' : ''}> ${lab}</label>`).join('')}</div></div>
            ${fld('Notes', txt(P + 'notes', v.notes, '', 'data-norender'), 'span4')}
          </div>
          <div class="sup-f"><span>${linked.length ? `<b>${linked.length}</b> item(s) on your shopping list here, about <b>${PP.money(linked.reduce((a, r) => a + r.toBuy, 0))}</b>: ${linked.slice(0, 6).map(r => e(r.item.name)).join(', ')}${linked.length > 6 ? '…' : ''}` : 'Nothing on the shopping list routed here.'}</span>
          <button class="btn btn-o btn-sm danger no-print" data-del-sup="${v.id}">Delete</button></div>
        </div>`;
      }).join('')}
      </div>`;
    $('#addSup').onclick = () => { S.suppliers.push({ id: PP.uid(), name: 'New supplier', types: [], town: '', address: '', phone: '', hours: '', notes: '' }); persist(); render(); };
  };
  document.addEventListener('click', ev => {
    const d = ev.target.closest('[data-del-sup]');
    if (d && confirm('Delete this supplier? Items assigned to it will go back to automatic routing.')) {
      S.suppliers = S.suppliers.filter(x => x.id !== d.dataset.delSup);
      S.items.forEach(i => { if (i.supplierId === d.dataset.delSup) i.supplierId = ''; });
      persist(); render();
    }
  });

  /* ================= COMMUNITY ================= */
  R.community = el => {
    el.innerHTML = `
      <div class="card"><h2>Official community resources</h2>
        <p class="sub">Emergency reception centres, the food bank, alerts and the numbers to call. Short codes (911, 811, 211, 511) are province-wide. Anything marked "verify" needs checking against your Town, County or utility bill; write the confirmed details in.</p>
        <div class="row no-print"><button class="btn" id="addRes">Add resource</button><span class="grow"></span><button class="btn btn-o btn-sm" onclick="PP.printPanel('community')">Print</button></div></div>
      <div class="card tscroll"><table class="data res">
        <thead><tr><th>Resource</th><th>Type</th><th>Phone / contact</th><th>Website</th><th>Notes</th><th class="no-print"></th></tr></thead>
        <tbody>${S.resources.map(r => { const P = 'resources.' + r.id + '.'; return `<tr class="${/verify/i.test(r.contact) ? 'verify' : ''}">
          <td>${txt(P + 'name', r.name, '', 'data-norender')}</td><td>${txt(P + 'kind', r.kind, '', 'data-norender class="sm2"')}</td>
          <td>${txt(P + 'contact', r.contact, '', 'class="sm2"')}</td>
          <td>${txt(P + 'url', r.url, '', 'data-norender')}${r.url ? ` <a class="no-print" href="${e(r.url)}" target="_blank" rel="noopener">open</a>` : ''}</td>
          <td>${txt(P + 'notes', r.notes, '', 'data-norender')}</td>
          <td class="no-print"><button class="x" data-del-res="${r.id}">✕</button></td></tr>`; }).join('')}
        </tbody></table></div>`;
    $('#addRes').onclick = () => { S.resources.push({ id: PP.uid(), name: 'New resource', kind: '', contact: '', url: '', notes: '' }); persist(); render(); };
  };
  document.addEventListener('click', ev => {
    const d = ev.target.closest('[data-del-res]');
    if (d && confirm('Delete this resource?')) { S.resources = S.resources.filter(x => x.id !== d.dataset.delRes); persist(); render(); }
  });

  /* ================= BACKUP ================= */
  R.backup = el => {
    const offline = 'serviceWorker' in navigator && location.protocol.startsWith('http');
    el.innerHTML = `
      <div class="card"><h2>Backup and offline use</h2>
        <p>Your data is stored in this browser only${S.savedAt ? ', last saved ' + new Date(S.savedAt).toLocaleString('en-CA') : ''}. Clearing browser data deletes it. Export a backup after every big update and keep a copy on a USB stick.</p>
        <div class="row"><button class="btn" id="expBtn">Export backup (.json)</button>
        <label class="btn btn-o">Import backup<input type="file" id="impFile" accept="application/json,.json" hidden></label>
        <span class="grow"></span><button class="btn btn-o danger" id="resetBtn">Reset everything</button></div>
      </div>
      <div class="card"><h3>Working without internet</h3>
        <ul>
          <li>${offline ? 'This copy is cached for offline use: once loaded, it opens with no connection.' : 'Opened as a file: it already works with no connection.'}</li>
          <li>For a phone or second computer, copy the single-file version (<code>dist/prep-planner.html</code>) and open it in any browser, then import your backup.</li>
          <li>Print the scenario plans, shopping list and checklists. Paper works when batteries do not.</li>
        </ul></div>`;
    $('#expBtn').onclick = () => {
      const blob = new Blob([JSON.stringify(S, null, 2)], { type: 'application/json' });
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
      a.download = 'prep-planner-backup-' + new Date().toISOString().slice(0, 10) + '.json';
      document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    };
    $('#impFile').onchange = ev => {
      const f = ev.target.files[0]; if (!f) return;
      const rd = new FileReader();
      rd.onload = () => {
        try {
          const data = PP.migrate(JSON.parse(rd.result));
          if (!confirm('Replace everything here with the backup?')) return;
          Object.keys(S).forEach(k => delete S[k]); Object.assign(S, data);
          PP.save(S); $('#reportOut').innerHTML = ''; alert('Backup restored.'); render();
        } catch (err) { alert('That file is not a valid Prep Planner backup.'); }
      };
      rd.readAsText(f);
    };
    $('#resetBtn').onclick = () => {
      if (!confirm('Delete all your data and start over? Export a backup first if you want to keep it.')) return;
      const f = PP.freshState(); Object.keys(S).forEach(k => delete S[k]); Object.assign(S, f); PP.save(S); $('#reportOut').innerHTML = ''; show('profile');
    };
  };

  /* ------------- printing ------------- */
  PP.printPanel = key => {
    document.body.dataset.print = key;
    const done = () => { delete document.body.dataset.print; window.removeEventListener('afterprint', done); };
    window.addEventListener('afterprint', done);
    setTimeout(() => window.print(), 50);
  };
  window.addEventListener('beforeprint', () => { if (!document.body.dataset.print) document.body.dataset.print = current; if (document.body.dataset.print === 'report' && !$('#reportOut').innerHTML) genReport(); });
  window.addEventListener('afterprint', () => { setTimeout(() => delete document.body.dataset.print, 100); });

  /* ------------- network status + offline cache ------------- */
  function net() { const on = navigator.onLine; const n = $('#netStatus'); n.textContent = on ? 'Online' : 'Offline: all features work'; n.className = 'pill ' + (on ? '' : 'warn'); }
  window.addEventListener('online', net); window.addEventListener('offline', net); net();
  if ('serviceWorker' in navigator && location.protocol.startsWith('http') && !window.PP_SINGLE) {
    navigator.serviceWorker.register('sw.js').catch(err => console.warn('offline cache unavailable', err));
  }

  $('#saveStatus').textContent = S.savedAt ? 'Saved' : 'Not saved yet';
  $('#saveStatus').className = 'pill ' + (S.savedAt ? 'ok' : '');
  const start = location.hash.slice(1);
  show(R[start] ? start : (S.savedAt ? 'command' : 'profile'));
})();
