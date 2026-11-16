/* Takes a snapshot of the Customer Service reports from ServiceMonster for the
   preview build (no booking server there). Writes
   tools/home-pros-arcade/js/office-data.js. Dates, times, towns and the
   account name of all-day jobs only.
     NODE_USE_ENV_PROXY=1 NODE_EXTRA_CA_CERTS=/root/.ccr/ca-bundle.crt node tools/rosa/office-snapshot.mjs
   Add --inbox=DIR (the folder where Rosa's run saved warranty.json and
   plan-checked.json) and --session=URL (her booking-desk session) to put her
   open questions on her desk in the arcade. */
import { writeFileSync, readFileSync, existsSync, readdirSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import '../home-pros-arcade/js/config.js';
import '../home-pros-arcade/js/schedule.js';
import '../home-pros-arcade/js/drive.js';
import '../home-pros-arcade/js/capacity.js';
const CFG = globalThis.HP_CONFIG, C = CFG.office, here = dirname(fileURLToPath(import.meta.url));
const AUTH = 'Basic ' + (process.env.SM_API_TOKEN || 'proxy-injected');
const sm = async p => { const r = await fetch('https://api.servicemonster.net/v1' + p, { headers: { Authorization: AUTH } }); if (!r.ok) throw new Error(p + ' ' + r.status); return r.json(); };
const now = globalThis.HP_SCHEDULE.localNow(CFG.business.timeZone);
const from = now.slice(0, 10);
const to = new Date(Date.parse(from + 'T00:00:00Z') + (C.daysAhead - 1) * 864e5).toISOString().slice(0, 10);
const d = await sm(`/scheduling?startDate=${from}&endDate=${to}&getJobColor=false`);
const items = d.items || d;
const names = {};
for (const i of items) if (i.accountID && !names[i.accountID] && (Date.parse(i.endDateTime + 'Z') - Date.parse(i.startDateTime + 'Z')) >= 6 * 36e5) {
  try { names[i.accountID] = (await sm(`/accounts/${i.accountID}?fields=accountName`)).accountName; } catch { }
}
const cap = globalThis.HP_CAPACITY.compute(items, { from, days: C.daysAhead, dayHours: C.dayHours, workDays: C.workDays, routes: C.routes, names });
const jayman = globalThis.HP_CAPACITY.jayman(items, { from, accounts: C.jaymanAccounts, routes: C.routes, warranty: new RegExp(C.warrantyWord, 'i'), base: C.base, roadFactor: C.roadFactor });
const arg = k => (process.argv.find(a => a.startsWith(`--${k}=`)) || '').split('=').slice(1).join('=');
let inbox = null;
const dir = arg('inbox');
if (dir) {
  const rd = f => existsSync(join(dir, f)) ? JSON.parse(readFileSync(join(dir, f), 'utf8')) : [];
  const checked = rd('plan-checked.json');
  inbox = {
    session: arg('session') || '',
    warranty: rd('warranty.json').map(w => ({ ref: w.ref, date: w.date, start: w.start, address: w.address, original: w.original, lines: (w.lines || []).map(l => ({ description: l.description, price: l.price, qty: l.qty })), subtotal: w.subtotal, total: w.total, holds: w.holds || [] })),
    drive: jayman.days.filter(d => d.drive && d.drive.saveKm >= 5 && readdirSync(dir).includes(`reorder-${d.date}.json`))
      .map(d => ({ date: d.date, saveKm: d.drive.saveKm, currentKm: d.drive.currentKm, bestKm: d.drive.bestKm, order: d.drive.order.map(c => ({ address: c.address, from: c.start, to: c.newStart })) })),
    ready: checked.filter(r => r.status === 'READY').map(r => ({ address: r.address, city: r.city, pos: r.pos, date: r.date, slot: r.slot, addedKm: r.addedKm, total: r.total })),
    held: checked.filter(r => r.status === 'HELD').map(r => ({ address: r.address, city: r.city, pos: r.pos, date: r.date, why: [...new Set(r.holds.map(h => h.replace(/^\d+ (already on WO \d+).*/, '$1')))].join('; ') })),
  };
}
const data = { generatedAt: now, capacity: cap, jayman, inbox };
writeFileSync(join(here, '../home-pros-arcade/js/office-data.js'),
  '/* Snapshot for the preview build, made by tools/rosa/office-snapshot.mjs. The live site asks the booking server instead. */\n' +
  'window.HP_OFFICE_DATA = ' + JSON.stringify(data) + ';\n');
console.log('snapshot', now, 'overbooked:', cap.summary.overbooked.map(o => `${o.date} ${o.pct}%`).join(', '), '| totals', JSON.stringify(cap.summary.routes), 'truck', cap.summary.total.pct + '%', '| jayman', JSON.stringify(jayman.totals));
