/* Live link between Rosa and the arcade, when it runs as a claude.ai artifact.
   - Rosa's runs write her questions and the reports into this artifact's
     database: rosa/inbox and rosa/report.
   - Keith's answers go into rosa/answers, and the arcade starts the task
     "Rosa - apply Keith's arcade answers" through the Claude Code Remote
     connector. That task re-checks ServiceMonster and applies them.
   Anywhere else (a plain web page, a saved file) all of this is absent and
   the arcade falls back to the built-in snapshot.                         */
(function (root) {
  'use strict';
  const APPLY_TASK = 'trig_01RRWw3aAMFKPC6pWz4qKiGX';
  const CONNECTOR = 'Claude Code Remote';
  const has = root.claude && typeof root.claude.use === 'function';
  const dbP = has ? root.claude.use('db').catch(() => null) : Promise.resolve(null);
  const mcpP = has ? root.claude.use('mcp').catch(() => null) : Promise.resolve(null);
  const sampleP = has ? root.claude.use('sample').catch(() => null) : Promise.resolve(null);
  const assetsP = has ? root.claude.use('assets').catch(() => null) : Promise.resolve(null);
  const dlP = has ? root.claude.use('downloads').catch(() => null) : Promise.resolve(null);
  const b64 = bytes => { let s = ''; for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000)); return btoa(s); };
  const timeout = (p, ms) => Promise.race([p, new Promise(r => setTimeout(() => r(null), ms))]);
  const listeners = [];
  let inboxSub = null, lastInbox;

  async function read(id, col) {
    const db = await timeout(dbP, 10000);
    if (!db) return undefined;
    try {
      const s = await timeout(db.collection(col || 'rosa').doc(id).get(), 8000);
      return s && s.exists ? s.data() : null;
    } catch (e) { return undefined; }
  }

  root.HP_LIVE = {
    /* {report, inbox} from the database, or undefined when there is no database here. */
    async load() {
      const [report, inbox] = await Promise.all([read('report'), read('inbox')]);
      if (report === undefined && inbox === undefined) return undefined;
      watchInbox();
      return { report: report || null, inbox: inbox || null };
    },
    /* Penny's brief and this month's expenses: {brief, expenses} or undefined. */
    async penny(month) {
      const [brief, expenses, marks, accounts] = await Promise.all([read('brief', 'penny'), read('expenses-' + month, 'penny'), read('marks', 'penny'), read('accounts', 'penny')]);
      if (brief === undefined && expenses === undefined) return undefined;
      return { brief: brief || null, expenses: expenses || null, marks: marks || { jobs: {} }, accounts: accounts || { commercial: [], notCommercial: [] } };
    },
    /* Keith's answer about one job: {how: 'billed'|'paid', method, at}. */
    async markJob(wo, answer) {
      const db = await timeout(dbP, 6000);
      if (!db) throw { code: 'unavailable' };
      const ref = db.collection('penny').doc('marks'), cur = await ref.get();
      const jobs = Object.assign({}, (cur.exists && cur.data().jobs) || {});
      jobs[String(wo)] = answer;
      await ref.set({ jobs });
      return { jobs };
    },
    /* Keith's answer about one account: commercial (billed on account) or not. */
    async markAccount(acct, isCommercial) {
      const db = await timeout(dbP, 6000);
      if (!db) throw { code: 'unavailable' };
      const ref = db.collection('penny').doc('accounts'), cur = await ref.get();
      const d = cur.exists ? cur.data() : {};
      const strip = l => (l || []).filter(a => a.accountID !== acct.accountID);
      const doc = { commercial: strip(d.commercial), notCommercial: strip(d.notCommercial) };
      (isCommercial ? doc.commercial : doc.notCommercial).push({ accountID: acct.accountID, name: acct.name });
      await ref.set(doc);
      return doc;
    },
    /* Eddie's daily email check: {report, history} or undefined. */
    async eddie() {
      const [report, history] = await Promise.all([read('report', 'eddie'), read('history', 'eddie')]);
      if (report === undefined && history === undefined) return undefined;
      return { report: report || null, history: history || null };
    },
    /* Expenses for one month ('YYYY-MM'): the doc or null; undefined when there's no database here. */
    async expenses(month) { return read('expenses-' + month, 'penny'); },
    /* Expenses for several months at once: {month: doc|null}. */
    async expenseMonths(months) {
      const docs = await Promise.all(months.map(m => read('expenses-' + m, 'penny')));
      if (docs.every(d => d === undefined)) return undefined;
      const out = {}; months.forEach((m, i) => { out[m] = docs[i] || null; }); return out;
    },
    /* Which monthly reports have been emailed: {months: {'YYYY-MM': {sentAt, count, total, to}}} */
    async reportsSent() { return read('reports', 'penny'); },
    async markReportSent(month, info) {
      const db = await timeout(dbP, 6000);
      if (!db) return;
      const ref = db.collection('penny').doc('reports'), cur = await ref.get();
      const months = Object.assign({}, (cur.exists && cur.data().months) || {});
      months[month] = info;
      await ref.set({ months });
    },
    /* Email a PDF through Keith's Gmail connector. Resolves {ok} or {ok:false, error}. */
    async emailPdf({ to, subject, body, filename, bytes }) {
      const mcp = await timeout(mcpP, 6000);
      if (!mcp) return { ok: false, error: 'unavailable' };
      try {
        await mcp.callTool('Gmail', 'send_message', { to: [to], subject, body, attachments: [{ filename, mimeType: 'application/pdf', content: b64(bytes) }] });
        return { ok: true };
      } catch (e) { return { ok: false, error: (e && e.code) || 'upstream_error', message: e && e.message }; }
    },
    /* Offer the PDF as a download. Resolves true when saved. */
    async download(filename, bytes) {
      const dl = await timeout(dlP, 6000);
      if (dl) { try { await dl.save({ filename, data: new Blob([bytes], { type: 'application/pdf' }) }); return true; } catch (e) { return false; } }
      try { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' })); a.download = filename; a.click(); return true; } catch (e) { return false; }
    },
    /* Receipts. canRead: Claude can read photos here. canStore: photos can be kept. */
    async receiptAbilities() {
      const [sample, assets, db] = await Promise.all([timeout(sampleP, 6000), timeout(assetsP, 6000), timeout(dbP, 6000)]);
      let canRead = false;
      if (sample) { try { const l = await sample.limits(); canRead = !!(l && l.images); } catch (e) { } }
      return { canRead, canStore: !!assets, canSave: !!db };
    },
    /* Ask Claude to read a receipt photo. Resolves the fields it found, or rejects {code}. */
    async readReceipt(blob, categories) {
      const sample = await timeout(sampleP, 6000);
      if (!sample) throw { code: 'unavailable' };
      const prompt = 'The image is a photo of a business receipt for Home Pros Group, a furnace and duct cleaning company in Alberta, Canada. '
        + 'Read it and answer with JSON only, no other text: {"date":"YYYY-MM-DD or empty","vendor":"store name","total":number (the amount paid, including GST),'
        + '"gst":number (GST amount shown, 0 if none shown),"items":"short description of what was bought","paidWith":"cash|card|debit|e-transfer|unknown",'
        + '"category":"one of: ' + categories.join('; ') + '","sure":true or false (false if any number is hard to read),'
        + '"question":"one short question to ask the owner if something is unclear or the category could be more than one, else empty"}. '
        + 'Never guess a number you cannot read: use 0 and set sure to false.';
      return sample.json(prompt, { images: [blob], modelTier: 'default', cache: false });
    },
    /* Keep the photo. Resolves {id, url} or null. */
    async storeReceipt(blob) {
      const assets = await timeout(assetsP, 6000);
      if (!assets) return null;
      try { const r = await assets.upload(blob); return { id: r.id, url: r.url }; } catch (e) { return null; }
    },
    /* Add one expense to penny/expenses-YYYY-MM. Resolves the month's doc. */
    async saveExpense(item) {
      const db = await timeout(dbP, 6000);
      if (!db) throw { code: 'unavailable' };
      const month = item.date.slice(0, 7), ref = db.collection('penny').doc('expenses-' + month);
      const cur = await ref.get();
      const doc = cur.exists ? cur.data() : { month, items: [] };
      const items = (doc.items || []).concat([item]);
      await ref.set({ month, items });
      return { month, items };
    },
    /* Called with the new inbox whenever Rosa changes it. */
    onInbox(fn) { listeners.push(fn); if (lastInbox !== undefined) fn(lastInbox); },
    /* Save Keith's answers and start Rosa's apply task. Resolves {ok, how, error}. */
    async send(runId, answers, text) {
      const db = await timeout(dbP, 5000), mcp = await timeout(mcpP, 5000);
      if (!db || !mcp) return { ok: false, how: 'none' };
      const at = new Date().toISOString();
      try {
        await db.collection('rosa').doc('answers').set({ runId, answers, text, at });
      } catch (e) { return { ok: false, how: 'db', error: (e && e.code) || 'unavailable' }; }
      try {
        await mcp.callTool(CONNECTOR, 'fire_trigger', { trigger_id: APPLY_TASK, text: JSON.stringify({ runId, answers, text }) });
      } catch (e) { return { ok: false, how: 'task', error: (e && e.code) || 'upstream_error' }; }
      try { await db.collection('rosa').doc('inbox').update({ status: 'sent', sentAt: at }); } catch (e) { }
      return { ok: true };
    },
  };

  async function watchInbox() {
    if (inboxSub) return;
    const db = await dbP;
    if (!db || inboxSub) return;
    inboxSub = db.collection('rosa').doc('inbox').onSnapshot(s => {
      if (s.metadata && s.metadata.fromCache) return;
      lastInbox = s.exists ? s.data() : null;
      listeners.forEach(fn => { try { fn(lastInbox); } catch (e) { } });
    }, () => { });
  }
})(window);
