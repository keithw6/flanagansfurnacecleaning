/* State, persistence and the calculations everything else reads.
   All data lives in this browser (localStorage). Nothing is sent anywhere. */
window.PP = window.PP || {};

PP.KEY = 'prep-planner-v1';

PP.uid = () => Math.random().toString(36).slice(2, 10);

PP.defaultProfile = () => ({
  householdName: '', location: 'Stony Plain, Alberta',
  adults: 2, children: 0, childAges: '', seniors: 0, pets: 0, petNotes: '',
  medical: '', mobility: '', fridgeMeds: false,
  houseType: '', levels: 2, basement: 'unknown',
  heat: 'gas-forced', backupHeat: 'none', water: 'municipal',
  generator: 'none', transferSwitch: false, solar: false, coDetectors: 'unknown',
  vehicles: 1, vehicleNotes: '', winterVehicle: false,
  skills: [], pal: false,
  retreatName: '', retreatKm: '', retreatRoute: '', retreatConfirmed: false, retreatHeated: false,
  budgetLevel: 'moderate', budget: 2000, prepDays: 14,
  outOfArea: '', meetNear: '', meetFar: '', contacts: '', neighbourGroup: false,
  roles: ''
});

PP.freshState = () => ({
  version: 1,
  profile: PP.defaultProfile(),
  items: PP.CATALOG.map(c => Object.assign({}, c, { targetOverride: null, have: 0, spent: 0, expiry: '', supplierId: '', hidden: false })),
  suppliers: PP.SEED_SUPPLIERS.map(s => Object.assign({ id: PP.uid() }, s)),
  resources: PP.SEED_RESOURCES.map(r => Object.assign({ id: PP.uid() }, r)),
  checklists: PP.SEED_CHECKLISTS.map(l => ({ id: PP.uid(), title: l.title, items: l.items.map(t => ({ id: PP.uid(), text: t, done: false })) })),
  decision: { temp: -10, heat: 'ok', structure: 'ok', fallout: 'none', order: 'none', phase: 'golden', roads: 'clear', dest: 'none', daylight: 'yes', threat: 'none' },
  savedAt: null
});

PP.load = function () {
  try {
    const raw = localStorage.getItem(PP.KEY);
    if (!raw) return PP.freshState();
    return PP.migrate(JSON.parse(raw));
  } catch (e) {
    console.warn('could not load saved data', e);
    return PP.freshState();
  }
};

/* Fill anything missing from older saves or imported files. */
PP.migrate = function (s) {
  const f = PP.freshState();
  s.profile = Object.assign(f.profile, s.profile || {});
  if (!Array.isArray(s.items)) s.items = f.items;
  // add catalogue items introduced after this save
  const have = new Set(s.items.map(i => i.id));
  PP.CATALOG.forEach(c => { if (!have.has(c.id)) s.items.push(Object.assign({}, c, { targetOverride: null, have: 0, spent: 0, expiry: '', supplierId: '', hidden: false })); });
  ['suppliers', 'resources', 'checklists'].forEach(k => { if (!Array.isArray(s[k])) s[k] = f[k]; });
  s.decision = Object.assign(f.decision, s.decision || {});
  s.version = 1;
  return s;
};

PP.save = function (s) {
  s.savedAt = new Date().toISOString();
  try { localStorage.setItem(PP.KEY, JSON.stringify(s)); return true; }
  catch (e) { console.warn('save failed', e); return false; }
};

/* ---------------- household maths ---------------- */
PP.persons = p => Math.max(1, (+p.adults || 0) + (+p.children || 0) + (+p.seniors || 0));

PP.conditionMet = function (when, p) {
  switch (when) {
    case 'pets': return +p.pets > 0;
    case 'medical': return !!(p.medical && p.medical.trim()) || p.fridgeMeds;
    case 'woodStove': return p.backupHeat === 'wood' || p.heat === 'wood';
    case 'noBackupHeat': return p.backupHeat === 'none' && p.heat !== 'wood';
    case 'generator': return p.generator !== 'none';
    default: return true;
  }
};

PP.applies = (item, p) => !item.hidden && (!item.when || PP.conditionMet(item.when, p));

PP.target = function (item, p) {
  if (item.targetOverride !== null && item.targetOverride !== '' && item.targetOverride !== undefined) return +item.targetOverride;
  const n = +item.n || 0, days = +p.prepDays || 14;
  switch (item.rule) {
    case 'pd': return Math.ceil(n * PP.persons(p) * days);
    case 'pp': return Math.ceil(n * PP.persons(p));
    case 'lvl': return Math.ceil(n * Math.max(1, +p.levels || 1));
    case 'petd': return Math.ceil(n * (+p.pets || 0) * days);
    case 'veh': return Math.ceil(n * Math.max(0, +p.vehicles || 0));
    case 'meds': return Math.ceil(n * PP.persons(p));
    default: return Math.ceil(n);
  }
};

PP.perPersonLabel = function (item, p) {
  const days = +p.prepDays || 14;
  switch (item.rule) {
    case 'pd': return `${item.n} ${item.unit}/day (${+(item.n * days).toFixed(1)} for ${days} d)`;
    case 'pp': return `${item.n} ${item.unit}`;
    case 'lvl': return `${item.n} per level`;
    case 'petd': return `${item.n} per pet/day`;
    case 'veh': return `${item.n} per vehicle`;
    default: return `${item.n} ${item.unit} (household)`;
  }
};

PP.daysUntil = function (iso) {
  if (!iso) return null;
  const d = new Date(iso + 'T00:00:00');
  if (isNaN(d)) return null;
  const now = new Date(); now.setHours(0, 0, 0, 0);
  return Math.round((d - now) / 86400000);
};

PP.supplierFor = function (item, s) {
  if (item.supplierId) {
    const x = s.suppliers.find(v => v.id === item.supplierId);
    if (x) return x;
  }
  return s.suppliers.find(v => (v.types || []).includes(item.store)) || null;
};

/* Totals for the dashboard and the tracker. */
PP.summary = function (s) {
  const p = s.profile;
  const rows = s.items.filter(i => PP.applies(i, p)).map(i => {
    const t = PP.target(i, p);
    const have = +i.have || 0;
    const need = Math.max(0, t - have);
    return { item: i, target: t, have, need, pct: t ? Math.min(1, have / t) : 1, toBuy: need * (+i.cost || 0), exp: PP.daysUntil(i.expiry) };
  });
  const weight = { 'Critical': 3, 'Important': 2, 'Nice-to-have': 1 };
  let w = 0, got = 0;
  rows.forEach(r => { const k = weight[r.item.pri] || 1; w += k; got += k * r.pct; });
  const crit = rows.filter(r => r.item.pri === 'Critical');
  const spent = s.items.reduce((a, i) => a + (+i.spent || 0), 0);
  const toBuy = rows.reduce((a, r) => a + r.toBuy, 0);
  const toBuyCritical = crit.reduce((a, r) => a + r.toBuy, 0);
  const expiring = rows.filter(r => r.exp !== null && r.exp <= 60 && r.have > 0).sort((a, b) => a.exp - b.exp);
  const byCat = {};
  rows.forEach(r => { const c = byCat[r.item.cat] || (byCat[r.item.cat] = { w: 0, got: 0 }); const k = weight[r.item.pri] || 1; c.w += k; c.got += k * r.pct; });
  return {
    rows, overall: w ? got / w : 0,
    critical: crit.length ? crit.reduce((a, r) => a + r.pct, 0) / crit.length : 1,
    criticalDone: crit.filter(r => r.pct >= 1).length, criticalCount: crit.length,
    spent, toBuy, toBuyCritical, budget: +p.budget || 0, expiring, byCat,
    waterDays: (() => { const wt = rows.find(r => r.item.id === 'water'); return wt ? (wt.have / (4 * PP.persons(p))) : 0; })(),
    foodDays: (() => { const f = rows.find(r => r.item.id === 'food'); return f ? (f.have / PP.persons(p)) : 0; })()
  };
};

/* Which profile fields are still unknown - the plan lists assumptions for these. */
PP.missing = function (p) {
  const m = [];
  if (!p.householdName) m.push('Household name');
  if (p.basement === 'unknown') m.push('Basement type (assumed: unfinished concrete basement)');
  if (p.coDetectors === 'unknown') m.push('CO detectors (assumed: not on every level)');
  if (!p.houseType) m.push('House type (assumed: detached house)');
  if (!p.retreatName) m.push('Retreat option (assumed: none confirmed)');
  if (!p.outOfArea) m.push('Out-of-area contact');
  if (!p.meetNear) m.push('Meeting point near home');
  return m;
};

/* Top gaps, ranked. Draws on the profile and the tracker. */
PP.gaps = function (s, scenario) {
  const p = s.profile, sum = PP.summary(s);
  const get = id => sum.rows.find(r => r.item.id === id);
  const short = id => { const r = get(id); return r && r.pct < 1; };
  const fam = scenario ? scenario.family : ['*'];
  const g = [];
  const add = (score, text, fix) => g.push({ score, text, fix });

  if (p.coDetectors !== 'every' ) add(100, 'Battery CO detectors are not confirmed on every level.', 'Buy and install one per level and outside sleeping areas. CO is the #1 cold-weather grid-down killer.');
  if (short('water')) add(95, `Stored water covers ${sum.waterDays.toFixed(1)} of ${p.prepDays} days.`, `Bring stored water up to ${get('water').target} L.`);
  if (p.backupHeat === 'none' && p.heat !== 'wood' && (fam.includes('cold') || fam.includes('grid') || fam.includes('*'))) add(92, 'No safe backup heat source.', 'Have a wood stove professionally installed (WETT-certified inspection), or keep an indoor-rated propane heater with CO alarm. Plan the warm room.');
  if (short('bags') && (fam.some(f => ['cold', 'grid', 'nuclear', '*'].includes(f)))) add(90, 'Not everyone has a sleeping bag rated -30°C.', 'Buy one per person; it is the cheapest heat insurance there is.');
  if (p.basement === 'none' && fam.includes('nuclear')) add(89, 'No basement for fallout shelter.', 'Identify the most interior ground-floor room and a nearby building with a basement you could reach in minutes.');
  if (short('food')) add(85, `Food covers ${sum.foodDays.toFixed(1)} of ${p.prepDays} days.`, 'Build up shelf-stable food you already eat.');
  if ((p.medical && p.medical.trim()) || p.fridgeMeds) add(88, 'Medical needs in the household depend on pharmacy access or power.', 'Talk to the pharmacist and doctor about a 30-day reserve; plan cooling for fridge medications.');
  if (short('radio')) add(84, 'No emergency AM/FM radio.', 'Buy a hand-crank/battery radio; it is your main information source when cell and internet fail.');
  if (!p.outOfArea || !p.meetNear) add(80, 'Communications plan incomplete (out-of-area contact or meeting point missing).', 'Fill in the contact tree and meeting points on the profile, then print them.');
  if (short('bucket')) add(75, 'No sanitation plan without plumbing.', 'Assemble a two-bucket toilet kit with bags and cover material.');
  if (short('firstaid')) add(74, 'No comprehensive first-aid kit.', 'Buy or build one; take a Red Cross or St. John Ambulance first-aid course.');
  if (short('extinguisher')) add(72, 'Fire extinguishers missing.', 'One ABC extinguisher per level at least.');
  if (!p.retreatConfirmed && (fam.includes('grid') || fam.includes('evac') || fam.includes('*'))) add(70, 'No confirmed retreat destination.', 'Arrange a pre-agreed rural retreat with trusted people, with routes that avoid Hwy 16/16A/60.');
  if (short('gobag') && (fam.includes('evac') || fam.includes('*'))) add(78, 'Go-bags are not ready for everyone.', 'Pack one per person and keep them by the door or in the vehicle.');
  if (short('carkit') && +p.vehicles > 0) add(68, 'Winter vehicle kit missing.', 'Assemble one per vehicle; keep tanks above half in winter.');
  if (!p.neighbourGroup) add(60, 'No neighbour mutual-aid group.', 'Quietly identify 2–3 trustworthy neighbours and agree to check on each other.');
  if (p.generator !== 'none' && !p.transferSwitch) add(65, 'Generator without a transfer switch.', 'Have a licensed electrician install a transfer switch or interlock. Never back-feed through a dryer outlet. Run outdoors only, far from windows.');
  if (sum.budget && sum.spent > sum.budget) add(50, 'Spending is over budget.', 'Focus remaining money on Critical items only.');
  if (short('cash')) add(55, 'Emergency cash short of target.', 'Keep small bills in the safe.');
  return g.sort((a, b) => b.score - a.score);
};

PP.money = n => {
  const v = Math.round((+n || 0) * 100) / 100, d = Number.isInteger(v) ? 0 : 2;
  return (v < 0 ? '-$' : '$') + Math.abs(v).toLocaleString('en-CA', { minimumFractionDigits: d, maximumFractionDigits: d });
};
PP.esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
