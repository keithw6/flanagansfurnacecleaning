/* Mark old unpaid invoices as paid in ServiceMonster, on Keith's instruction.
     node tools/penny/payoff.mjs plan --commercial=accounts.json        -> payoff-plan.json + table (reads only)
     node tools/penny/payoff.mjs apply payoff-plan.json --approved      -> posts one credit per invoice
   (run with NODE_USE_ENV_PROXY=1 NODE_EXTRA_CA_CERTS=/root/.ccr/ca-bundle.crt)

   Keith's rules (Nov 16, 2026):
     1. Every invoice completed before Jan 1, 2026 with a balance: mark paid (any customer).
     2. Residential invoices completed Jan 1 to Jun 30, 2026 with a balance: mark paid.
        Residential = not Jayman, not a commercial account on Penny's list (builders,
        property managers, companies Keith bills on account).
   A payment in ServiceMonster is a credit: POST /credits {accountID, amount, creditDate,
   creditMethod, memo, splits:[{orderID, amount}]}. The API cannot delete a credit, so
   apply only runs with --approved, re-reads each invoice first, pays exactly the balance
   it still shows, and skips anything that changed.                                   */
import { readFileSync, writeFileSync, existsSync } from 'fs';
import '../home-pros-arcade/js/config.js';
const O = globalThis.HP_CONFIG.office;
const AUTH = 'Basic ' + (process.env.SM_API_TOKEN || 'proxy-injected');
const arg = k => (process.argv.find(a => a.startsWith(`--${k}=`)) || '').split('=').slice(1).join('=');
async function sm(p, init = {}) {
  const r = await fetch('https://api.servicemonster.net/v1' + p, { ...init, headers: { 'Content-Type': 'application/json', Authorization: AUTH } });
  const t = await r.text();
  if (!r.ok) throw new Error(`${init.method || 'GET'} ${p} -> ${r.status}: ${t.slice(0, 300)}`);
  try { return JSON.parse(t); } catch { return t; }
}
const iso = s => !s ? '' : /^\d{4}-/.test(s) ? s.slice(0, 10) : (([m, d, y]) => `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`)(s.split(' ')[0].split('/'));
const $ = n => '$' + n.toLocaleString('en-CA', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const jayman = new Set(O.jaymanAccounts);
const BEFORE_ALL = '2026-01-01', RES_TO = '2026-06-30';
const MEMO = 'Marked paid by Penny (Home Pros back office) on Keith\'s instruction, Nov 16 2026: old balance cleared.';

const cmd = process.argv[2];
if (cmd === 'plan') {
  const cf = arg('commercial');
  const accts = cf && existsSync(cf) ? JSON.parse(readFileSync(cf, 'utf8')) : {};
  const commercial = new Set((accts.commercial || []).map(a => a.accountID));
  const F = 'fields=orderNumber,orderID,accountID,accountName,grandTotal,balanceDue,orderType,dateCompleted';
  const owing = [];
  for (let i = 0; i < 100; i++) {
    const r = await sm(`/orders?wField=balanceDue&wOperator=gt&wValue=0&${F}&pageSize=500&pageIndex=${i}`);
    owing.push(...(r.items || []));
    if (!(r.items || []).length || owing.length >= r.count) break;
  }
  const inv = owing.filter(o => o.orderType === 'Invoice').map(o => ({ ...o, done: iso(o.dateCompleted) }));
  const who = o => jayman.has(o.accountID) ? 'Jayman' : commercial.has(o.accountID) ? 'Commercial' : 'Residential';
  const rows = [], skipped = [];
  for (const o of inv) {
    const kind = who(o);
    let rule = '';
    if (o.done && o.done < BEFORE_ALL) rule = 'before 2026';
    else if (o.done && o.done <= RES_TO && kind === 'Residential') rule = 'residential, Jan-Jun 2026';
    const row = { wo: o.orderNumber, orderID: o.orderID, accountID: o.accountID, account: o.accountName, kind, done: o.done, total: o.grandTotal, balance: o.balanceDue, rule };
    if (rule) rows.push(row); else if (!o.done) skipped.push({ ...row, why: 'no completed date' });
  }
  rows.sort((a, b) => a.done.localeCompare(b.done));
  writeFileSync('payoff-plan.json', JSON.stringify({ made: new Date().toISOString(), memo: MEMO, rows, skipped }, null, 2));
  const sum = l => l.reduce((s, r) => s + r.balance, 0);
  for (const g of ['before 2026', 'residential, Jan-Jun 2026']) {
    const l = rows.filter(r => r.rule === g);
    console.log(`\n${g.toUpperCase()}: ${l.length} invoices, ${$(sum(l))}`);
    for (const k of ['Residential', 'Commercial', 'Jayman']) { const m = l.filter(r => r.kind === k); if (m.length) console.log(`  ${k}: ${m.length}, ${$(sum(m))}`); }
    for (const r of l) console.log(`  WO ${r.wo}  ${r.done}  ${r.kind.padEnd(11)} ${String(r.account).slice(0, 38).padEnd(38)} ${$(r.balance)}`);
  }
  if (skipped.length) console.log(`\nNo completed date (left alone): ${skipped.map(r => 'WO ' + r.wo).join(', ')}`);
  console.log(`\nTOTAL: ${rows.length} invoices, ${$(sum(rows))}. Saved payoff-plan.json. Nothing was changed.`);
} else if (cmd === 'apply') {
  if (!process.argv.includes('--approved')) throw new Error('Refusing to post payments without --approved (Keith approves the list first).');
  const plan = JSON.parse(readFileSync(process.argv[3], 'utf8'));
  const only = arg('only') ? new Set(arg('only').split(',').map(Number)) : null;
  const method = arg('method') || 'Other';
  const today = new Date().toISOString().slice(0, 10);
  let n = 0, total = 0;
  for (const r of plan.rows) {
    if (only && !only.has(r.wo)) continue;
    const o = await sm(`/orders/${r.orderID}`);
    const bal = Number(o.balanceDue);
    if (o.orderType !== 'Invoice' || !(bal > 0)) { console.log(`skip WO ${r.wo}: now ${o.orderType}, balance ${bal}`); continue; }
    if (Math.abs(bal - r.balance) > 0.005) { console.log(`skip WO ${r.wo}: balance changed ${r.balance} -> ${bal}`); continue; }
    const credit = { accountID: r.accountID, amount: bal, creditDate: today, creditMethod: method, memo: plan.memo, refNo: `PENNY-${r.wo}`, splits: [{ orderID: r.orderID, amount: bal }] };
    await sm('/credits', { method: 'POST', body: JSON.stringify(credit) });
    const after = await sm(`/orders/${r.orderID}`);
    console.log(`paid WO ${r.wo} ${r.account} ${$(bal)} -> balance now ${after.balanceDue}`);
    n++; total += bal;
  }
  console.log(`\nPosted ${n} payments, ${$(total)}.`);
} else {
  console.log('usage: payoff.mjs plan --commercial=accounts.json | apply payoff-plan.json --approved [--only=WO,WO] [--method=Other]');
}
