/* Penny's nightly brief: what got done today and this month, from ServiceMonster.
     NODE_USE_ENV_PROXY=1 NODE_EXTRA_CA_CERTS=/root/.ccr/ca-bundle.crt node tools/penny/brief.mjs [--date=YYYY-MM-DD] [--commercial=FILE] [--out=DIR]
   Reads only. Writes DIR/brief.json (default: ./penny) and prints a summary.

   Which day a job counts on: the day it was done on the calendar (a completed
   job on any route). An invoice whose Date Completed is a different day still
   counts on the calendar day. Orders with no calendar job count on their Date
   Completed. Jayman jobs always count as billed.
   Definitions:
     revenue  = subtotal before GST
     billed   = invoice totals including GST
     paid     = billed minus balance due
     GST      = tax on the invoices
     km       = shop (53 Umbach Rd) -> each completed job in time order -> shop,
                straight line x 1.3 for roads. An estimate, not odometer km.
   Jayman jobs are billed through Supply Pro and paid on Jayman's terms, so they
   are never "not paid". Non-Jayman jobs are Paid or Not paid. Accounts Keith
   says are commercial and billed go in their own "commercial, billed" list.
   --commercial=FILE: {commercial: [{accountID, name}], notCommercial: [...]}
   (the arcade's penny/accounts doc). Company-looking names in neither list
   come back in askCommercial, for Penny to ask Keith about once.
   --marks=FILE: Keith's answers about unpaid non-Jayman jobs (the arcade's
   penny/marks doc): {jobs: {"<WO>": {how: "billed"|"paid", method, at}}}.
     billed -> stays on the not-paid list, marked "billed, waiting".
     paid   -> counts as paid (paid on site); until ServiceMonster shows it
               paid, it is on the "record the payment in ServiceMonster" list.
   Recent unpaid non-Jayman jobs with no answer come back in askPaid.      */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';
import '../home-pros-arcade/js/config.js';
import '../home-pros-arcade/js/schedule.js';
import '../home-pros-arcade/js/drive.js';
const CFG = globalThis.HP_CONFIG, O = CFG.office, D = globalThis.HP_DRIVE;
const AUTH = 'Basic ' + (process.env.SM_API_TOKEN || 'proxy-injected');
const arg = k => (process.argv.find(a => a.startsWith(`--${k}=`)) || '').split('=').slice(1).join('=');
async function sm(p) {
  const r = await fetch('https://api.servicemonster.net/v1' + p, { headers: { Authorization: AUTH } });
  const t = await r.text();
  if (!r.ok) throw new Error(`GET ${p} -> ${r.status}: ${t.slice(0, 200)}`);
  return JSON.parse(t);
}
async function all(p) {
  const out = [];
  for (let i = 0; i < 100; i++) {
    const r = await sm(`${p}&pageSize=500&pageIndex=${i}`);
    const items = r.items || [];
    out.push(...items);
    if (!items.length || out.length >= (r.count || 0)) break;
  }
  return out;
}
const r2 = n => Math.round(n * 100) / 100;
const us = iso => { const [y, m, d] = iso.split('-'); return `${m}/${d}/${y}`; };
const addDays = (iso, n) => new Date(Date.parse(iso + 'T12:00:00Z') + n * 864e5).toISOString().slice(0, 10);

const now = globalThis.HP_SCHEDULE.localNow(CFG.business.timeZone);
const date = arg('date') || now.slice(0, 10);
const monthStart = date.slice(0, 8) + '01';
const lastMonthStart = new Date(Date.UTC(+date.slice(0, 4), +date.slice(5, 7) - 2, 1)).toISOString().slice(0, 10);
const lastMonthDays = new Date(Date.UTC(+date.slice(0, 4), +date.slice(5, 7) - 1, 0)).getUTCDate();
const lastMonthSameDay = lastMonthStart.slice(0, 8) + String(Math.min(+date.slice(8), lastMonthDays)).padStart(2, '0');
const jayman = new Set(O.jaymanAccounts);
const cfile = arg('commercial');
const accts = cfile && existsSync(cfile) ? JSON.parse(readFileSync(cfile, 'utf8')) : {};
const commercial = Array.isArray(accts) ? accts : accts.commercial || [];
const notCommercial = Array.isArray(accts) ? [] : accts.notCommercial || [];
const isCommercial = id => commercial.some(c => c.accountID === id);
const mfile = arg('marks');
const marks = (mfile && existsSync(mfile) ? JSON.parse(readFileSync(mfile, 'utf8')).jobs : null) || {};
const mark = o => marks[String(o.orderNumber)] || null;
const paidOnSite = o => !jayman.has(o.accountID) && o.balanceDue > 0 && (mark(o) || {}).how === 'paid';

const F = 'fields=orderNumber,orderID,accountID,accountName,subTotal,taxTotal,grandTotal,balanceDue,orderType,dateCompleted,refNumber';
const num = v => Number(v) || 0;
const norm = o => ({ ...o, orderNumber: num(o.orderNumber), subTotal: num(o.subTotal), taxTotal: num(o.taxTotal), grandTotal: num(o.grandTotal), balanceDue: num(o.balanceDue),
  RefNumber: o.RefNumber || o.refNumber || '', dateCompleted: o.dateCompleted ? (/^\d{4}-/.test(o.dateCompleted) ? o.dateCompleted.slice(0, 10) : (([m, d, y]) => `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`)(o.dateCompleted.split(' ')[0].split('/'))) : '' });
const byDate = (await all(`/orders?wField=dateCompleted&wOperator=gt&wValue=${us(addDays(lastMonthStart, -1))}&${F}`)).map(norm);

// completed calendar jobs decide the day
// look a week past the date too, so an early invoice for a later job isn't counted early
const sched = (await sm(`/scheduling?startDate=${addDays(lastMonthStart, -7)}&endDate=${addDays(date, 7)}&getJobColor=false`));
const jobs = (sched.items || sched).filter(i => i.itemType === 'Job' && /complete/i.test(i.status || ''));
const orders = new Map(byDate.map(o => [o.orderID, o]));
for (const j of jobs) if (j.orderID && !orders.has(j.orderID)) {
  try { const o = norm(await sm(`/orders/${j.orderID}`)); o.accountName = o.accountName || (await sm(`/accounts/${o.accountID}?fields=accountName`)).accountName; orders.set(j.orderID, o); } catch (e) { }
}
const onCal = new Map();
for (const j of jobs) if (j.orderID && !onCal.has(j.orderID)) onCal.set(j.orderID, j.startDateTime.slice(0, 10));
const done = [...orders.values()].map(o => ({ ...o, day: onCal.get(o.orderID) || o.dateCompleted }))
  .filter(o => o.day && o.day >= lastMonthStart && o.day <= date && (onCal.has(o.orderID) || o.orderType === 'Invoice'));
const day = iso => done.filter(o => o.day === iso);
const kmFor = iso => {
  const stops = jobs.filter(j => j.latitude && j.startDateTime.slice(0, 10) === iso).sort((a, b) => a.startDateTime.localeCompare(b.startDateTime)).map(j => ({ lat: j.latitude, lon: j.longitude }));
  return stops.length ? D.routeKm(O.base, stops, O.roadFactor) : 0;
};

const invoiced = o => o.orderType === 'Invoice' || jayman.has(o.accountID);
const kind = o => jayman.has(o.accountID) ? 'Jayman (billed)' : !invoiced(o) ? 'Not invoiced yet' :
  paidOnSite(o) ? 'Paid on site' : o.balanceDue > 0 && (mark(o) || {}).how === 'billed' ? 'Billed, waiting' : isCommercial(o.accountID) ? (o.balanceDue > 0 ? 'Commercial (billed)' : 'Paid') : (o.balanceDue > 0 ? 'Not paid' : 'Paid');
function totals(orders, from, to) {
  const s = { from, to, jobs: orders.length, revenue: 0, billed: 0, paid: 0, gst: 0, km: 0 };
  for (const o of orders) { s.revenue += o.subTotal; s.gst += o.taxTotal; if (invoiced(o)) s.billed += o.grandTotal; if (invoiced(o)) s.paid += paidOnSite(o) ? o.grandTotal : o.grandTotal - o.balanceDue; }
  for (let d = from; d <= to; d = addDays(d, 1)) s.km += kmFor(d);
  for (const k of ['revenue', 'billed', 'paid', 'gst']) s[k] = r2(s[k]);
  s.avgJob = s.jobs ? r2(s.revenue / s.jobs) : 0;
  s.revPerKm = s.km ? r2(s.revenue / s.km) : 0;
  s.jayman = orders.filter(o => jayman.has(o.accountID)).length;
  return s;
}
const inRange = (a, b) => done.filter(o => o.day >= a && o.day <= b);

const today = totals(day(date), date, date);
today.list = day(date).map(o => ({ wo: o.orderNumber, invoicedOn: o.dateCompleted !== o.day ? o.dateCompleted : '', method: (mark(o) || {}).method || '', account: o.accountName, ref: o.RefNumber || '', revenue: o.subTotal, gst: o.taxTotal, total: o.grandTotal, paid: r2(o.grandTotal - o.balanceDue), balance: o.balanceDue, status: kind(o) }));
const month = totals(inRange(monthStart, date), monthStart, date);
month.days = [];
for (let d = monthStart; d <= date; d = addDays(d, 1)) { const t = day(d); if (t.length) month.days.push({ date: d, jobs: t.length, revenue: r2(t.reduce((s, o) => s + o.subTotal, 0)), km: kmFor(d) }); }
const lastMonth = totals(inRange(lastMonthStart, lastMonthSameDay), lastMonthStart, lastMonthSameDay);

// running unpaid list: every non-Jayman invoice with a balance, any date
const owing = (await all(`/orders?wField=balanceDue&wOperator=gt&wValue=0&${F}`))
  .map(norm).filter(o => o.orderType === 'Invoice' && !jayman.has(o.accountID));
const age = o => o.dateCompleted ? Math.round((Date.parse(date) - Date.parse(o.dateCompleted.slice(0, 10))) / 864e5) : null;
const row = o => ({ wo: o.orderNumber, account: o.accountName, accountID: o.accountID, completed: onCal.get(o.orderID) || o.dateCompleted, days: age({ dateCompleted: onCal.get(o.orderID) || o.dateCompleted }), balance: o.balanceDue });
// unpaid non-Jayman jobs from the last 7 days that Keith hasn't answered about yet
const askPaid = done.filter(o => o.day > addDays(date, -7) && !jayman.has(o.accountID) && !isCommercial(o.accountID) && invoiced(o) && o.balanceDue > 0 && !mark(o))
  .map(o => ({ wo: o.orderNumber, account: o.accountName, done: o.day, balance: o.balanceDue }));
const notInvoiced = done.filter(o => !invoiced(o)).map(o => ({ wo: o.orderNumber, account: o.accountName, done: o.day, total: o.grandTotal }));
const byOld = (a, b) => (b.days || 0) - (a.days || 0);
const toRecord = owing.filter(paidOnSite).map(o => ({ ...row(o), method: mark(o).method || '' })).sort(byOld);
const homeowners = owing.filter(o => !isCommercial(o.accountID) && !paidOnSite(o)).map(o => ({ ...row(o), billed: (mark(o) || {}).how === 'billed' })).sort(byOld);
const comm = owing.filter(o => isCommercial(o.accountID)).map(row).sort(byOld);
const sum = l => r2(l.reduce((s, o) => s + o.balance, 0));
const unpaid = { toRecord, toRecordTotal: sum(toRecord), notPaid: homeowners, notPaidTotal: sum(homeowners), commercial: comm, commercialTotal: sum(comm), total: r2(sum(homeowners) + sum(comm)),
  over30: sum(homeowners.filter(o => o.days > 30)), over60: sum(homeowners.filter(o => o.days > 60)) };
// names that look like companies, not yet marked commercial: Penny asks Keith about these
const companyWord = /\b(inc|ltd|homes?|builders?|construction|management|property|properties|modular|heating|real estate|corp|group|developments?|services)\b/i;
const askCommercial = [...new Map(homeowners.filter(o => companyWord.test(o.account || '') && !notCommercial.some(n => n.accountID === o.accountID)).map(o => [o.accountID, { accountID: o.accountID, name: o.account }])).values()];

const brief = { date, generatedAt: now, today, month, lastMonth, unpaid, notInvoiced, askPaid, askCommercial, commercialAccounts: commercial,
  notes: ['Each job counts on the day it was done on the calendar. Jayman jobs always count as billed. Revenue is before GST. Billed and paid include GST. Km are estimates from job locations (straight line x 1.3), shop to shop.'] };
const out = arg('out') || 'penny';
mkdirSync(out, { recursive: true });
writeFileSync(join(out, 'brief.json'), JSON.stringify(brief));
const $ = n => '$' + n.toLocaleString('en-CA', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const line = (t, s) => `${t}: ${s.jobs} jobs (${s.jayman} Jayman) | revenue ${$(s.revenue)} | billed ${$(s.billed)} | paid ${$(s.paid)} | GST ${$(s.gst)} | ~${s.km} km | avg job ${$(s.avgJob)} | ${$(s.revPerKm)}/km`;
console.log(line('TODAY ' + date, today));
for (const j of today.list) console.log(`  WO ${j.wo}  ${j.account}  ${$(j.total)}  ${j.status}${j.balance > 0 && /Not paid|Billed/.test(j.status) ? ' (owes ' + $(j.balance) + ')' : ''}${j.method ? ' (' + j.method + ')' : ''}`);
console.log(line('MONTH ' + monthStart + '..' + date, month));
console.log(line('LAST MONTH ' + lastMonthStart + '..' + lastMonthSameDay, lastMonth));
console.log(`UNPAID (not Jayman): ${homeowners.length} not paid ${$(unpaid.notPaidTotal)} (over 30 days ${$(unpaid.over30)}, over 60 ${$(unpaid.over60)}); ${comm.length} commercial billed ${$(unpaid.commercialTotal)}`);
if (askPaid.length) console.log('ASK KEITH, billed or paid on site? ' + askPaid.map(o => `WO ${o.wo} ${o.account} ${o.done} ${$(o.balance)}`).join('; '));
if (toRecord.length) console.log('PAID ON SITE, record in ServiceMonster: ' + toRecord.map(o => `WO ${o.wo} ${o.account} ${$(o.balance)} ${o.method}`).join('; '));
if (notInvoiced.length) console.log('DONE BUT NOT INVOICED (not Jayman): ' + notInvoiced.map(o => `WO ${o.wo} ${o.account} ${o.done} ${$(o.total)}`).join('; '));
if (askCommercial.length) console.log('ASK KEITH, commercial and billed? ' + askCommercial.map(a => a.name).join('; '));
console.log('wrote', join(out, 'brief.json'));
