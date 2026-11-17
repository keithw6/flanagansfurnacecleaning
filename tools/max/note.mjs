/* After Max's emails go out: add a note to each customer's ServiceMonster account
   (on the job's order) saying the thank-you and review request was emailed.
     NODE_USE_ENV_PROXY=1 NODE_EXTRA_CA_CERTS=/root/.ccr/ca-bundle.crt node tools/max/note.mjs --sent=FILE
   FILE: {sent: [{wo, orderID, accountID, name, date}]}, only the emails that really went out.
   This is the only thing Max writes to ServiceMonster (Keith approved it). It never
   changes or deletes anything else. Prints one line per note: ok or the error. */
import { readFileSync } from 'fs';
const AUTH = 'Basic ' + (process.env.SM_API_TOKEN || 'proxy-injected');
const arg = k => (process.argv.find(a => a.startsWith(`--${k}=`)) || '').split('=').slice(1).join('=');
const { sent = [] } = JSON.parse(readFileSync(arg('sent'), 'utf8'));
let bad = 0;
for (const s of sent) {
  const body = { accountID: s.accountID, orderID: s.orderID || undefined, activitySubType: 'Internal', subject: 'Review request emailed',
    note: `Max emailed a thank-you and a request for a 5-star Google review on ${s.date} (WO ${s.wo}).`, activityDateTime: new Date().toISOString().slice(0, 19), showOnSchedule: false };
  const r = await fetch('https://api.servicemonster.net/v1/notes', { method: 'POST', headers: { Authorization: AUTH, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const t = await r.text();
  if (r.ok) console.log(`ok    WO ${s.wo} ${s.name}`); else { bad++; console.log(`FAIL  WO ${s.wo} ${s.name}: ${r.status} ${t.slice(0, 160)}`); }
}
process.exit(bad ? 1 : 0);
