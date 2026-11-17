/* Grace's look at one day in ServiceMonster: every scheduled job and calendar note,
   in time order, with route, customer, address, WO, total and what kind of job it is.
     NODE_USE_ENV_PROXY=1 NODE_EXTRA_CA_CERTS=/root/.ccr/ca-bundle.crt node tools/grace/day.mjs
       [--date=YYYY-MM-DD (default today in Alberta)] [--out=DIR]
   Reads ServiceMonster only. Writes DIR/day-YYYY-MM-DD.json (default ./grace) and prints
   the day. kind: jayman | warranty | commercial | residential | note.               */
import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import '../home-pros-arcade/js/config.js';
import '../home-pros-arcade/js/schedule.js';
const CFG = globalThis.HP_CONFIG, O = CFG.office;
const AUTH = 'Basic ' + (process.env.SM_API_TOKEN || 'proxy-injected');
const arg = k => (process.argv.find(a => a.startsWith(`--${k}=`)) || '').split('=').slice(1).join('=');
async function sm(p) {
  const r = await fetch('https://api.servicemonster.net/v1' + p, { headers: { Authorization: AUTH } });
  const t = await r.text();
  if (!r.ok) throw new Error(`GET ${p} -> ${r.status}: ${t.slice(0, 200)}`);
  return JSON.parse(t);
}
const yes = v => v === true || String(v).toLowerCase() === 'true';
const date = arg('date') || globalThis.HP_SCHEDULE.localNow(CFG.business.timeZone).slice(0, 10);
const jayman = new Set(O.jaymanAccounts);
const warr = new RegExp(O.warrantyWord || 'warr[ae]nt', 'i');
const clock = iso => { const [h, m] = iso.slice(11, 16).split(':').map(Number); return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`; };

const routes = new Map(((await sm('/routes')).items || []).map(r => [r.routeID, r.name]));
const sched = await sm(`/scheduling?startDate=${date}&endDate=${date}&getJobColor=false`);
const items = (sched.items || sched).filter(i => (i.startDateTime || '').slice(0, 10) === date).sort((a, b) => a.startDateTime.localeCompare(b.startDateTime));
const acctCache = new Map();
const rows = [];
for (const i of items) {
  const row = { time: clock(i.startDateTime), end: i.endDateTime ? clock(i.endDateTime) : '', status: i.status || '', route: routes.get(i.routeID) || '', type: i.itemType,
    subject: i.subject || '', address: [i.address1, i.city].filter(Boolean).join(', '), wo: '', customer: '', total: null, balance: null, kind: 'note' };
  if (i.itemType === 'Job' && i.orderID) {
    try { const o = await sm(`/orders/${i.orderID}?fields=orderNumber,accountName,grandTotal,balanceDue,orderType`); row.wo = o.orderNumber; row.customer = o.accountName || ''; row.total = Number(o.grandTotal) || 0; row.balance = Number(o.balanceDue) || 0; row.orderType = o.orderType; } catch (e) { }
    let a = acctCache.get(i.accountID);
    if (!a && i.accountID) { try { a = await sm(`/accounts/${i.accountID}?fields=accountName,commercial,companyName`); acctCache.set(i.accountID, a); } catch (e) { a = {}; } }
    row.customer = row.customer || (a && a.accountName) || '';
    row.kind = jayman.has(i.accountID) ? (warr.test(i.subject + ' ' + (i.note || '')) ? 'warranty' : 'jayman') : (a && (yes(a.commercial) || (a.companyName || '').trim())) ? 'commercial' : 'residential';
  } else if (warr.test(i.subject || '')) row.kind = 'warranty';
  rows.push(row);
}
const jobs = rows.filter(r => r.type === 'Job');
const out = arg('out') || 'grace';
mkdirSync(out, { recursive: true });
writeFileSync(join(out, `day-${date}.json`), JSON.stringify({ date, jobs: jobs.length, items: rows }, null, 1));
console.log(`${date}: ${jobs.length} job(s), ${rows.length - jobs.length} calendar note(s)`);
for (const r of rows) console.log(`  ${r.time}${r.end ? '-' + r.end : ''}  ${r.route || '-'}  ${r.kind.toUpperCase()}  ${r.wo ? 'WO ' + r.wo + '  ' : ''}${r.customer || r.subject}  ${r.address}  ${r.status}`);
console.log('wrote', join(out, `day-${date}.json`));
