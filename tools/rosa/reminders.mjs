/* Rosa's appointment reminders: residential customers with a job scheduled
   tomorrow, for a reminder email the day before.
     NODE_USE_ENV_PROXY=1 NODE_EXTRA_CA_CERTS=/root/.ccr/ca-bundle.crt node tools/rosa/reminders.mjs
       [--date=YYYY-MM-DD (the appointment day, default tomorrow)] [--commercial=FILE] [--out=DIR]
   Reads ServiceMonster only. Writes DIR/reminders.json (default ./rosa-out):
     { date, send: [...], ask: [...], skipped: [{wo, name, reason}] }
   send / ask entries: {wo, orderID, accountID, name, firstName, email, start, end, time, day, address}
   send    residential: gets the reminder.
   ask     looks commercial (company name or company-looking name) but isn't marked
           commercial: Keith approves or denies each one.
   skipped Jayman and other builder accounts, commercial in ServiceMonster or on
           Penny's commercial list (--commercial, the arcade's penny/accounts doc),
           "Do not email", no email address, already done or cancelled.
   A customer with two jobs tomorrow gets one reminder with the first time. */
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
const addDays = (iso, n) => new Date(Date.parse(iso + 'T12:00:00Z') + n * 864e5).toISOString().slice(0, 10);
const yes = v => v === true || String(v).toLowerCase() === 'true';
const today = globalThis.HP_SCHEDULE.localNow(CFG.business.timeZone).slice(0, 10);
const date = arg('date') || addDays(today, 1);
const jayman = new Set(O.jaymanAccounts);
const read = f => f && existsSync(f) ? JSON.parse(readFileSync(f, 'utf8')) : null;
const accts = read(arg('commercial')) || {};
const commercialIds = new Set((Array.isArray(accts) ? accts : accts.commercial || []).map(c => c.accountID));
const notCommercialIds = new Set((Array.isArray(accts) ? [] : accts.notCommercial || []).map(c => c.accountID));
const companyWord = /\b(inc|ltd|homes?|builders?|construction|management|property|properties|modular|heating|real estate|corp|group|developments?|services|condo|condominium|society|church|school|apartments?|hotel|motel|restaurant|clinic|centre|center|association|county|town|city of)\b/i;
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const clock = iso => { const [h, m] = iso.slice(11, 16).split(':').map(Number); return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`; };
const dayName = iso => { const d = new Date(iso + 'T12:00:00Z'); return `${DAYS[d.getUTCDay()]}, ${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}`; };

const sched = await sm(`/scheduling?startDate=${date}&endDate=${date}&getJobColor=false`);
const jobs = (sched.items || sched).filter(i => i.itemType === 'Job' && (i.startDateTime || '').slice(0, 10) === date && i.accountID)
  .sort((a, b) => a.startDateTime.localeCompare(b.startDateTime));

const send = [], ask = [], skipped = [], seen = new Set();
for (const j of jobs) {
  let wo = '';
  try { wo = (await sm(`/orders/${j.orderID}?fields=orderNumber`)).orderNumber || ''; } catch (e) { }
  wo = Number(wo) || wo;
  let a;
  try { a = await sm(`/accounts/${j.accountID}?fields=accountName,firstName,lastName,companyName,commercial,doNotEmail,email`); } catch (e) { skipped.push({ wo, name: '', reason: 'could not read the account' }); continue; }
  const name = a.accountName || '';
  if (/complete|cancel/i.test(j.status || '')) { skipped.push({ wo, name, reason: `job is ${j.status}` }); continue; }
  if (jayman.has(j.accountID)) { skipped.push({ wo, name, reason: 'Jayman (builder)' }); continue; }
  if (seen.has(j.accountID)) { skipped.push({ wo, name, reason: 'second job for the same customer tomorrow (one reminder, first time)' }); continue; }
  seen.add(j.accountID);
  if (commercialIds.has(j.accountID)) { skipped.push({ wo, name, reason: "commercial (Penny's list)" }); continue; }
  if (yes(a.commercial)) { skipped.push({ wo, name, reason: 'commercial in ServiceMonster' }); continue; }
  if (yes(a.doNotEmail)) { skipped.push({ wo, name, reason: 'Do not email' }); continue; }
  const email = String(a.email || '').split(/[;, ]+/).find(e => /^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(e));
  if (!email) { skipped.push({ wo, name, reason: 'no email address' }); continue; }
  const first0 = (a.firstName || '').trim() || (name.includes(',') ? name.split(',')[1].trim().split(' ')[0] : name.split(' ')[0]);
  const firstName = first0.charAt(0).toUpperCase() + first0.slice(1).toLowerCase();
  const address = [j.address1, j.address2, j.city].filter(x => x && String(x).trim()).join(', ');
  const row = { wo, orderID: j.orderID, accountID: j.accountID, name, firstName, email, start: j.startDateTime, end: j.endDateTime, time: clock(j.startDateTime), day: dayName(date), address };
  const looksCommercial = !notCommercialIds.has(j.accountID) && (!!(a.companyName || '').trim() || companyWord.test(name));
  if (looksCommercial) ask.push({ ...row, why: (a.companyName || '').trim() ? `company name "${a.companyName.trim()}"` : 'the name looks like a business' });
  else send.push(row);
}

const out = arg('out') || 'rosa-out';
mkdirSync(out, { recursive: true });
writeFileSync(join(out, 'reminders.json'), JSON.stringify({ date, send, ask, skipped }, null, 1));
console.log(`${date}: ${jobs.length} job(s) scheduled; ${send.length} reminder(s), ${ask.length} to ask Keith about, ${skipped.length} skipped`);
for (const s of send) console.log(`  SEND  WO ${s.wo}  ${s.time}  ${s.name}`);
for (const s of ask) console.log(`  ASK   WO ${s.wo}  ${s.time}  ${s.name} (${s.why})`);
for (const s of skipped) console.log(`  skip  WO ${s.wo}  ${s.name}: ${s.reason}`);
console.log('wrote', join(out, 'reminders.json'));
