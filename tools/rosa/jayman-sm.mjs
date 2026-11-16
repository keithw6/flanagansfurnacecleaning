/* Rosa's ServiceMonster helper for the daily Jayman booking run.

   It does the two things the jayman-booking skill can't do safely by eye:
   the duplicate check and the slot check. And, only after Keith approves,
   it books.

     node jayman-sm.mjs check plan.json    -> plan-checked.json + a table on screen
     node jayman-sm.mjs book plan-checked.json --approved
                                           -> creates the work orders, prints the
                                              Supply Pro write-back sheet

   plan.json is the list of work orders Rosa built from the Jayman emails (one
   per address, POs already grouped and priced per the skill):

   [{ "address": "36 Nerine Cres", "city": "St. Albert", "zip": "T8N 7Z7",
      "date": "2026-12-03",                       // Jayman's Est. Date Required
      "pos": ["02210518", "02210522"],             // every PO on this visit
      "refs": ["02210518-0048", "02210522-0048"],  // PO-lot for the Reference field
      "lines": [{ "item": "furnace_out", "qty": 1 }, { "item": "hrv", "qty": 2 },
                { "item": "trip", "qty": 1, "price": 50 }],
      "super": { "name": "Chris Hall", "phone": "780-699-6440", "email": "chall@jayman.com" },
      "note": "anything Keith should see on the work order" }]

   Rules (from Keith):
   - Jayman jobs go on the NEW HOME route, in the 8:00, 11:00, 1:00 and 3:00
     slots, 2 hours each, at most 4 per day. The date never moves.
   - A slot is unavailable if New Home OR Edmonton Residential has anything
     booked over it (one truck). No slot that day = HELD, never moved.
   - Any existing order whose Reference contains one of the POs = HELD.
   - Everything on either route blocks: jobs, and calendar notes too (an
     all-day note like "Calgary" may mean Keith is away). Held, not guessed.

   Run in a Claude cloud session with the ServiceMonster login saved as a
   network secret:
     NODE_USE_ENV_PROXY=1 NODE_EXTRA_CA_CERTS=/root/.ccr/ca-bundle.crt node jayman-sm.mjs ...
   Elsewhere, set SM_API_TOKEN to base64("username:password").                 */
import { readFileSync, writeFileSync } from 'fs';

const SM = 'https://api.servicemonster.net/v1';
const AUTH = 'Basic ' + (process.env.SM_API_TOKEN || 'proxy-injected');

const IDS = {
  account: '1b833231-89e7-11e7-8c1a-fec578518208',    // JAYMAN MASTER BUILDERS (all caps, sub type 158)
  salesRep: 'ff14fbcd-dc45-11e3-b8c3-d9b28ac835cd',   // Keith Wick
  tax: 'ff14fbb3-dc45-11e3-b8c3-d9b28ac835cd',        // Sales Tax 5.0%
  newHome: '9fb1dbd4-3227-11ed-8205-8d92ba0c912a',
  residential: 'ff14fbca-dc45-11e3-b8c3-d9b28ac835cd',
};
// Jayman products in ServiceMonster (group "New Homes"). Prices are the defaults;
// a line's own "price" overrides, because the PO wins.
const ITEMS = {
  furnace_edm: { id: '20dbf04a-e6a9-11e3-95c1-9a03579c48a1', name: 'Standard Furnace & Vent Clean Edmonton', price: 230 },
  furnace_out: { id: 'feafe252-e06f-11ec-b001-a93f182ae6d2', name: 'Standard Furnace & Vent Cleaning - Leduc or Sherwood park', price: 280 },
  hrv: { id: '0afe6350-a67c-11e4-b64c-edc3386bc6c1', name: 'HRV', price: 35 },
  ac: { id: 'c6b8b98d-e6a9-11e3-95c1-9a03579c48a1', name: 'Air Conditioning', price: 49 },
  zone: { id: '1b97b284-e070-11ec-b865-fddb117a77d7', name: 'Zone system', price: 49 },
  extra_furnace: { id: '5fe19b98-e806-11e3-95c1-9a03579c48a1', name: 'Extra furnace', price: 90 },
  trip: { id: 'bcd3b8a6-e380-11ed-820a-bb6f6c2a2fc5', name: 'Jayman Trip Out Of Town', price: 50 },
  rebook: { id: '091c20ea-e070-11ec-b865-fddb117a77d7', name: 'Job site not ready - Rebook fee', price: 75 },
};
const SLOTS = ['08:00', '11:00', '13:00', '15:00'];
const JOB_HOURS = 2, MAX_PER_DAY = 4;

async function sm(path, init = {}) {
  const res = await fetch(SM + path, { ...init, headers: { 'Content-Type': 'application/json', Authorization: AUTH } });
  const text = await res.text();
  if (!res.ok) throw new Error(`${init.method || 'GET'} ${path} -> ${res.status}: ${text.slice(0, 300)}`);
  try { return JSON.parse(text); } catch { return text; }
}
const list = d => (Array.isArray(d) ? d : d.items || []);
const min = s => { const [h, m] = s.split(':').map(Number); return h * 60 + m; };
const clock = s => s.slice(11, 16);

async function duplicates(pos) {
  const hits = [];
  for (const po of pos) {
    const d = await sm(`/orders?wField=RefNumber&wValue=${encodeURIComponent(po)}&wOperator=like&fields=orderNumber,RefNumber,orderType`);
    for (const o of list(d)) hits.push(`${po} already on WO ${o.orderNumber} (${o.orderType}, ref "${o.RefNumber}")`);
  }
  return hits;
}

// The control search the skill asks for: a PO known to be booked must be found.
async function controlCheck() {
  const d = await sm('/orders?wField=RefNumber&wValue=02210518&wOperator=like&fields=orderNumber');
  if (!list(d).some(o => o.orderNumber === 45769)) throw new Error('Duplicate check is broken: known PO 02210518 (WO 45769) was not found. Stopping.');
}

async function dayBusy(date) {
  const d = await sm(`/scheduling?startDate=${date}&endDate=${date}&getJobColor=false`);
  return list(d).filter(i => !/cancel/i.test(i.status || ''))
    .filter(i => i.routeID === IDS.newHome || i.routeID === IDS.residential)
    .map(i => ({ route: i.routeID === IDS.newHome ? 'New Home' : 'Residential', start: i.startDateTime, end: i.endDateTime,
      what: i.itemType === 'Job' ? (i.city || 'job') : `${i.itemType || 'item'} "${i.subject || ''}"` }))
    .filter(b => b.start && b.start.slice(0, 10) === date);
}

function pickSlot(busy, date, taken) {
  const newHomeCount = busy.filter(b => b.route === 'New Home').length + taken.length;
  if (newHomeCount >= MAX_PER_DAY) return { why: `${date} already has ${newHomeCount} New Home calls` };
  for (const s of SLOTS) {
    const a = min(s), b = a + JOB_HOURS * 60;
    const clash = busy.find(x => min(clock(x.start)) < b && min(clock(x.end)) > a) || taken.includes(s);
    if (!clash) return { slot: s };
  }
  const reasons = busy.map(x => `${x.route} ${clock(x.start)}-${clock(x.end)} ${x.what}`).join(', ');
  return { why: `no free slot on ${date} (booked: ${reasons})` };
}

function price(lines) {
  let subtotal = 0;
  const out = lines.map(l => {
    const it = ITEMS[l.item];
    if (!it) throw new Error(`Unknown item "${l.item}"`);
    const p = l.price != null ? l.price : it.price, q = l.qty || 1;
    subtotal += p * q;
    return { ...l, name: it.name, price: p, qty: q, stale: l.price != null && l.price !== it.price };
  });
  subtotal = Math.round(subtotal * 100) / 100;
  return { lines: out, subtotal, gst: Math.round(subtotal * 5) / 100, total: Math.round(subtotal * 105) / 100 };
}

async function check(file) {
  const plan = JSON.parse(readFileSync(file, 'utf8'));
  await controlCheck();
  const byDay = {};
  const out = [];
  for (const w of plan) {
    const r = { ...w, ...price(w.lines), status: 'READY', holds: [] };
    if (!w.date) r.holds.push('no date');
    if (!w.refs || w.refs.length !== (w.pos || []).length) r.holds.push('every PO needs a PO-lot reference');
    const dups = await duplicates(w.pos || []);
    if (dups.length) r.holds.push(...dups);
    if (w.date && !dups.length) {
      byDay[w.date] = byDay[w.date] || { busy: await dayBusy(w.date), taken: [] };
      const s = pickSlot(byDay[w.date].busy, w.date, byDay[w.date].taken);
      if (s.slot) { r.slot = s.slot; byDay[w.date].taken.push(s.slot); } else r.holds.push(s.why);
    }
    if (r.holds.length) r.status = 'HELD';
    out.push(r);
  }
  const outFile = file.replace(/\.json$/, '') + '-checked.json';
  writeFileSync(outFile, JSON.stringify(out, null, 2));
  console.log('| Status | Date | Slot | Address | POs | Total (incl GST) | Note |\n|---|---|---|---|---|---|---|');
  for (const r of out) console.log(`| ${r.status} | ${r.date || '-'} | ${r.slot || '-'} | ${r.address}, ${r.city} | ${(r.pos || []).join(', ')} | $${r.total.toFixed(2)} | ${r.holds.join('; ') || (r.lines.some(l => l.stale) ? 'PO price differs from ServiceMonster default' : '')} |`);
  console.log(`\nSaved ${outFile}. Nothing was booked.`);
}

async function book(file) {
  if (!process.argv.includes('--approved')) throw new Error('Refusing to book without --approved (Keith approves each run this week).');
  const plan = JSON.parse(readFileSync(file, 'utf8')).filter(r => r.status === 'READY');
  await controlCheck();
  const sheet = [];
  for (const r of plan) {
    // re-check right before creating: something may have been booked since
    const dups = await duplicates(r.pos);
    const busy = await dayBusy(r.date);
    const clash = busy.find(x => min(clock(x.start)) < min(r.slot) + JOB_HOURS * 60 && min(clock(x.end)) > min(r.slot));
    if (dups.length || clash) { console.log(`HELD at booking time: ${r.address}: ${dups.join('; ') || `slot ${r.slot} now taken (${clash.route})`}`); continue; }

    const site = await sm('/sites', { method: 'POST', body: JSON.stringify({
      accountID: IDS.account, name: r.address, address1: r.address, city: r.city, state: 'AB', zip: r.zip || '', country: 'Canada',
      note: r.super ? `Site super: ${r.super.name}${r.super.phone ? ', ' + r.super.phone : ''}${r.super.email ? ', ' + r.super.email : ''}` : '',
    }) });
    const siteID = site.recordID || site.siteID;
    const order = await sm('/orders', { method: 'POST', body: JSON.stringify({
      accountID: IDS.account, siteID, orderType: 'Work Order', RefNumber: r.refs.join(', '),
      salesRepID: IDS.salesRep, taxID: IDS.tax, note: r.note || '',
    }) });
    const orderID = order.recordID || order.orderID;
    for (const [i, l] of r.lines.entries())
      await sm('/lineitems', { method: 'POST', body: JSON.stringify({ orderID, itemID: ITEMS[l.item].id, price: l.price, quantity: l.qty, rowIndex: i }) });
    const end = String(min(r.slot) / 60 + JOB_HOURS).padStart(2, '0') + ':00';
    await sm('/jobs', { method: 'POST', body: JSON.stringify({
      accountID: IDS.account, orderID, routeID: IDS.newHome,
      estDateTimeStart: `${r.date}T${r.slot}:00`, estDateTimeEnd: `${r.date}T${end}:00`,
    }) });
    const saved = await sm(`/orders/${orderID}`);
    sheet.push({ pos: r.pos.join(', '), wo: saved.orderNumber, date: r.date, address: `${r.address}, ${r.city}`, total: saved.grandTotal });
  }
  console.log('## Booked - enter these in Supply Pro\n\n| Supply Pro order | SM work order | Acknowledged date | Address | SM total |\n|---|---|---|---|---|');
  for (const s of sheet) console.log(`| ${s.pos} | ${s.wo} | ${s.date.slice(5, 7)}/${s.date.slice(8)}/${s.date.slice(0, 4)} | ${s.address} | $${s.total} |`);
  if (!sheet.length) console.log('| (none) | | | | |');
}

const [cmd, file] = process.argv.slice(2);
if (cmd === 'check' && file) await check(file);
else if (cmd === 'book' && file) await book(file);
else console.log('usage: node jayman-sm.mjs check plan.json | book plan-checked.json --approved');
