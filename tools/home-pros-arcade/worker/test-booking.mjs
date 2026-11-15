/* Makes ONE real test booking in ServiceMonster, exactly the way the game's
   booking server does, so you can see the job, the customer email and your
   ServiceMonster notification. Delete the test job afterwards.

   Run from tools/home-pros-arcade/worker:
     SM_API_TOKEN=<base64 of username:password> node test-booking.mjs           (dry run: shows what it would book)
     SM_API_TOKEN=... node test-booking.mjs --book --email you@example.com      (books it)
   Optional: --route <routeID>, --block <routeIDs>, --after YYYY-MM-DD. In a Claude cloud session with the
   ServiceMonster login saved as a network secret, SM_API_TOKEN can be omitted. */
import '../js/config.js';
import '../js/travel.js';
import '../js/pricing.js';
import '../js/schedule.js';

const args = process.argv.slice(2);
const opt = k => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : undefined; };
const CFG = globalThis.HP_CONFIG, SCHED = globalThis.HP_SCHEDULE;
const SM = 'https://api.servicemonster.net/v1';
const auth = 'Basic ' + (process.env.SM_API_TOKEN || 'set-by-proxy');

async function sm(path, init = {}) {
  const res = await fetch(SM + path, { ...init, headers: { 'Content-Type': 'application/json', Authorization: auth } });
  const text = await res.text();
  if (!res.ok) throw new Error(`${init.method || 'GET'} ${path} -> ${res.status}: ${text.slice(0, 300)}`);
  try { return JSON.parse(text); } catch { return text; }
}

const routesRes = await sm('/routes');
const routes = (Array.isArray(routesRes) ? routesRes : routesRes.items || []);
console.log('Routes:'); for (const r of routes) console.log('  ', r.routeID, '|', r.routeName || r.name || '', r.active === false ? '(inactive)' : '');
// One truck: book onto Edmonton Residential; a job on New Home blocks the same time.
const routeID = opt('--route') || 'ff14fbca-dc45-11e3-b8c3-d9b28ac835cd';
const blocking = (opt('--block') || '9fb1dbd4-3227-11ed-8205-8d92ba0c912a').split(',');

const answers = { furnaces: 1, ac: true, zone: false, dryer: 'no' };
const q = globalThis.HP_PRICING.quote(answers, globalThis.HP_TRAVEL.estimate('Stony Plain'));
const now = SCHED.localNow(CFG.business.timeZone);
const sched = await sm(`/scheduling?startDate=${now.slice(0, 10)}&endDate=${SCHED.fmt(SCHED.parse(now) + (CFG.schedule.daysAhead + 1) * 1440).slice(0, 10)}&getJobColor=false`);
const busy = (Array.isArray(sched) ? sched : sched.items || []).filter(i => !/cancel/i.test(i.status || ''))
  .map(i => ({ routeID: blocking.includes(i.routeID) ? routeID : i.routeID, start: i.StartDateTime || i.startDateTime, end: i.EndDateTime || i.endDateTime }))
  .filter(b => !b.routeID || b.routeID === routeID);
console.log(`Schedule: ${busy.length} items in the next ${CFG.schedule.daysAhead} days`);
const days = SCHED.availability({ cfg: CFG, now, busy, routes: [routeID], hours: q.hours });
// --after YYYY-MM-DD: first open slot on or after that date (keeps tests off tomorrow's crew sheet)
const after = opt('--after') || now.slice(0, 10);
const slot = days.flatMap(d => d.slots).find(s => s.start.slice(0, 10) > now.slice(0, 10) && s.start.slice(0, 10) >= after);
if (!slot) throw new Error('No open slot found');

const lead = {
  customerFirstName: 'TEST', customerLastName: 'Arcade Booking - DELETE ME',
  phone: '780-932-7337', email: opt('--email') || 'info@homeprosgroup.com',
  address1: '1 Test Street', city: 'Stony Plain', state: 'AB', zip: 'T7Z 1G1', country: 'Canada',
  note: ['TEST BOOKING from the Home Pros Arcade storefront. Safe to delete.', ...q.lines.map(l => `- ${l.label}: $${l.amount}`), `Total $${q.total} incl. GST`].join('\n'),
  source: 'Arcade Storefront', leadSourceName: 'Website - Arcade Storefront',
  services: 'Furnace & duct cleaning, Air conditioning', duration: q.hours,
  routeID, selectedTime: slot.start, notifyClient: true,
};
console.log('\nWould book:', slot.start, `(${slot.label})`, 'on route', routeID); console.log(lead);
if (!args.includes('--book')) { console.log('\nDry run. Add --book to create it.'); process.exit(0); }
const res = await sm('/webleads', { method: 'POST', body: JSON.stringify(lead) });
console.log('\nBOOKED. ServiceMonster replied:', JSON.stringify(res, null, 2));
