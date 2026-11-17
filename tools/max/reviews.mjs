/* Max's review requests: residential customers whose job was completed today,
   for a thank-you email asking for a 5-star Google review.
     NODE_USE_ENV_PROXY=1 NODE_EXTRA_CA_CERTS=/root/.ccr/ca-bundle.crt node tools/max/reviews.mjs
       [--date=YYYY-MM-DD] [--commercial=FILE] [--sent=FILE] [--out=DIR]
   Reads ServiceMonster only. Writes DIR/reviews.json (default ./max):
     { date, send: [{wo, orderID, accountID, name, firstName, email}], skipped: [{wo, name, reason}] }
   A job counts on the day it was completed on the calendar; an invoice with no
   calendar job counts on its Date Completed.
   Residential only. Skipped: Jayman and other builder accounts, accounts marked
   commercial in ServiceMonster or on Penny's commercial list (--commercial, the
   arcade's penny/accounts doc), accounts with a company name or a company-looking
   name, "Do not email" accounts, no email address, and anyone already asked in
   the last 365 days (--sent, the arcade's eddie/reviews doc: {sent: [{accountID, date}]}). */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
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
const us = iso => { const [y, m, d] = iso.split('-'); return `${m}/${d}/${y}`; };
const addDays = (iso, n) => new Date(Date.parse(iso + 'T12:00:00Z') + n * 864e5).toISOString().slice(0, 10);
const isoOf = s => !s ? '' : /^\d{4}-/.test(s) ? s.slice(0, 10) : (([m, d, y]) => `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`)(s.split(' ')[0].split('/'));
const yes = v => v === true || String(v).toLowerCase() === 'true';

const date = arg('date') || globalThis.HP_SCHEDULE.localNow(CFG.business.timeZone).slice(0, 10);
const jayman = new Set(O.jaymanAccounts);
const read = f => f && existsSync(f) ? JSON.parse(readFileSync(f, 'utf8')) : null;
const accts = read(arg('commercial')) || {};
const commercialIds = new Set((Array.isArray(accts) ? accts : accts.commercial || []).map(c => c.accountID));
const sentLog = (read(arg('sent')) || {}).sent || [];
const askedRecently = id => sentLog.some(s => s.accountID === id && s.date > addDays(date, -365));
const companyWord = /\b(inc|ltd|homes?|builders?|construction|management|property|properties|modular|heating|real estate|corp|group|developments?|services|condo|society|church|school|ltd\.)\b/i;

// jobs completed on the calendar today, and invoices completed today with no calendar job
const sched = await sm(`/scheduling?startDate=${date}&endDate=${date}&getJobColor=false`);
const jobs = (sched.items || sched).filter(i => i.itemType === 'Job' && /complete/i.test(i.status || '') && (i.startDateTime || '').slice(0, 10) === date && i.orderID);
const orderIds = new Set(jobs.map(j => j.orderID));
const F = 'fields=orderNumber,orderID,accountID,accountName,orderType,dateCompleted';
const done = [];
for (const id of orderIds) { try { done.push(await sm(`/orders/${id}?${F}`)); } catch (e) { } }
try {
  const inv = await sm(`/orders?wField=dateCompleted&wOperator=gt&wValue=${us(addDays(date, -1))}&${F}&pageSize=500`);
  for (const o of inv.items || []) if (!orderIds.has(o.orderID) && o.orderType === 'Invoice' && isoOf(o.dateCompleted) === date) done.push(o);
} catch (e) { }

const send = [], skipped = [], seen = new Set();
for (const o of done) {
  const wo = Number(o.orderNumber) || o.orderNumber, name = o.accountName || '';
  if (seen.has(o.accountID)) { skipped.push({ wo, name, reason: 'second job for the same customer today' }); continue; }
  seen.add(o.accountID);
  if (jayman.has(o.accountID)) { skipped.push({ wo, name, reason: 'Jayman (builder)' }); continue; }
  if (commercialIds.has(o.accountID)) { skipped.push({ wo, name, reason: "commercial (Penny's list)" }); continue; }
  let a;
  try { a = await sm(`/accounts/${o.accountID}?fields=accountName,firstName,lastName,companyName,commercial,doNotEmail,email,accountType,active`); } catch (e) { skipped.push({ wo, name, reason: 'could not read the account' }); continue; }
  const nm = a.accountName || name;
  if (yes(a.commercial)) { skipped.push({ wo, name: nm, reason: 'commercial in ServiceMonster' }); continue; }
  if ((a.companyName || '').trim() || companyWord.test(nm)) { skipped.push({ wo, name: nm, reason: 'looks like a company' }); continue; }
  if (yes(a.doNotEmail)) { skipped.push({ wo, name: nm, reason: 'Do not email' }); continue; }
  const email = String(a.email || '').split(/[;, ]+/).find(e => /^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(e));
  if (!email) { skipped.push({ wo, name: nm, reason: 'no email address' }); continue; }
  if (askedRecently(o.accountID)) { skipped.push({ wo, name: nm, reason: 'already asked for a review this past year' }); continue; }
  const first = (a.firstName || '').trim() || (nm.includes(',') ? nm.split(',')[1].trim().split(' ')[0] : nm.split(' ')[0]);
  send.push({ wo, orderID: o.orderID, accountID: o.accountID, name: nm, firstName: first.charAt(0).toUpperCase() + first.slice(1).toLowerCase(), email });
}

const out = arg('out') || 'max';
mkdirSync(out, { recursive: true });
writeFileSync(join(out, 'reviews.json'), JSON.stringify({ date, send, skipped }, null, 1));
console.log(`${date}: ${done.length} completed job(s); ${send.length} to thank, ${skipped.length} skipped`);
for (const s of send) console.log(`  SEND  WO ${s.wo}  ${s.name}`);
for (const s of skipped) console.log(`  skip  WO ${s.wo}  ${s.name}: ${s.reason}`);
console.log('wrote', join(out, 'reviews.json'));
