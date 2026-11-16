/* Takes a snapshot of the Customer Service reports from ServiceMonster for the
   preview build (no booking server there). Writes
   tools/home-pros-arcade/js/office-data.js. Dates, times, towns and the
   account name of all-day jobs only.
     NODE_USE_ENV_PROXY=1 NODE_EXTRA_CA_CERTS=/root/.ccr/ca-bundle.crt node tools/rosa/office-snapshot.mjs */
import { writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import '../home-pros-arcade/js/config.js';
import '../home-pros-arcade/js/schedule.js';
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
const jayman = globalThis.HP_CAPACITY.jobsOn(items, C.routes[C.jaymanRoute], from);
const data = { generatedAt: now, capacity: cap, jayman };
writeFileSync(join(here, '../home-pros-arcade/js/office-data.js'),
  '/* Snapshot for the preview build, made by tools/rosa/office-snapshot.mjs. The live site asks the booking server instead. */\n' +
  'window.HP_OFFICE_DATA = ' + JSON.stringify(data) + ';\n');
console.log('snapshot', now, 'overbooked:', cap.summary.overbooked.map(o => `${o.date} ${o.pct}%`).join(', '), '| totals', JSON.stringify(cap.summary.routes), 'truck', cap.summary.total.pct + '%', '| jayman jobs', jayman.length);
