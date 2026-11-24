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
      // a plain, editable copy: the live database can hand back read-only objects
      return s && s.exists ? JSON.parse(JSON.stringify(s.data())) : null;
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
    /* Every month that has receipts, any year: [{month, count, total}] newest first; undefined without a database. */
    async allExpenseMonths() {
      const db = await timeout(dbP, 6000);
      if (!db) return undefined;
      try {
        const snap = await timeout(db.collection('penny').get(), 8000);
        if (!snap) return undefined;
        return snap.docs.filter(d => d.exists && /^expenses-\d{4}-\d{2}$/.test(d.id)).map(d => {
          const items = (d.data().items || []);
          return { month: d.id.slice(9), count: items.length, total: items.reduce((t, x) => t + Number(x.amount || 0), 0) };
        }).filter(m => m.count).sort((a, b) => b.month.localeCompare(a.month));
      } catch (e) { return undefined; }
    },
    /* Statements: penny/statements = {list:[{id,name,card,period,uploadedAt,count,decided,added}]}, penny/stmt-<id> = the statement */
    async statements() { return read('statements', 'penny'); },
    async statement(id) { return read('stmt-' + id, 'penny'); },
    async saveStatement(doc) {
      const db = await timeout(dbP, 6000);
      if (!db) throw { code: 'unavailable' };
      await db.collection('penny').doc('stmt-' + doc.id).set(doc);
      const ref = db.collection('penny').doc('statements'), cur = await ref.get();
      const list = ((cur.exists && cur.data().list) || []).filter(x => x.id !== doc.id);
      const t = doc.transactions || [];
      list.unshift({ id: doc.id, name: doc.name, card: (doc.statement || {}).card || '', holder: (doc.statement || {}).holder || '', period: (doc.statement || {}).period || '', uploadedAt: doc.uploadedAt,
        count: t.length, decided: t.filter(x => x.decision).length, added: t.filter(x => x.added).length, files: (doc.files || []).length, check: doc.check || null, owner: doc.owner || '', last4: (doc.statement || {}).last4 || '' });
      await ref.set({ list: list.slice(0, 60) });
    },
    /* Money between Keith/Hannah and the business: penny/owed = {items:[{id, date, vendor, amount, who, direction:'toKeith'|'toBusiness', statementId, repaidAt}]} */
    async owed() { return read('owed', 'penny'); },
    async addOwed(items) {
      const db = await timeout(dbP, 6000);
      if (!db) throw { code: 'unavailable' };
      const ref = db.collection('penny').doc('owed'), cur = await ref.get();
      const have = (cur.exists && cur.data().items) || [];
      const ids = new Set(have.map(x => x.id));
      await ref.set({ items: have.concat(items.filter(x => !ids.has(x.id))) });
    },
    async markOwedRepaid(direction, who) {
      const db = await timeout(dbP, 6000);
      if (!db) throw { code: 'unavailable' };
      const ref = db.collection('penny').doc('owed'), cur = await ref.get();
      const at = new Date().toISOString();
      const items = ((cur.exists && cur.data().items) || []).map(x => (!x.repaidAt && x.direction === direction && (!who || x.who === who)) ? Object.assign({}, x, { repaidAt: at }) : x);
      await ref.set({ items });
      return { items };
    },
    /* Take a statement off the list (its expenses stay filed). */
    async removeStatement(id) {
      const db = await timeout(dbP, 6000);
      if (!db) return;
      const ref = db.collection('penny').doc('statements'), cur = await ref.get();
      await ref.set({ list: ((cur.exists && cur.data().list) || []).filter(x => x.id !== id) });
    },
    /* Add several expenses to one month at once. */
    async addExpenses(month, items) {
      const db = await timeout(dbP, 6000);
      if (!db) throw { code: 'unavailable' };
      const ref = db.collection('penny').doc('expenses-' + month), cur = await ref.get();
      const doc = cur.exists ? cur.data() : { month, items: [] };
      await ref.set({ month, items: (doc.items || []).concat(items) });
    },
    /* Keep an uploaded file (statement PDF or photo). Resolves {id, url} or null. */
    async storeFile(file) {
      const assets = await timeout(assetsP, 6000);
      if (!assets) return null;
      try { const r = await assets.upload(file); return { id: r.id, url: r.url }; } catch (e) { return null; }
    },
    /* Which monthly reports have been emailed: {months: {'YYYY-MM': {sentAt, count, total, to}}} */
    /* Hank's purchase list: hank/list = {items:[{id, name, qty, supplier, note, status, addedAt}], learned:{key:{item, supplier, n, at}}} */
    async purchasing() { return read('list', 'hank'); },
    async savePurchasing(doc) {
      const db = await timeout(dbP, 6000);
      if (!db) throw { code: 'unavailable' };
      await db.collection('hank').doc('list').set(doc);
    },
    /* Max: eddie/prospects = {contacts:[{id, type:'pm'|'agent', name, company, phone, email, area, source, addedAt}], removed:[keys], lastRun:{date, added, areas, note}}
            eddie/posts = {posts:[{id, network:'facebook'|'hpg-linkedin'|'keith-linkedin', text, photo, status:'draft'|'posted'|'skipped', createdAt, doneAt}]} */
    async max() { const [p, s, v] = await Promise.all([read('prospects', 'eddie'), read('posts', 'eddie'), read('reviews', 'eddie')]); if (p === undefined && s === undefined && v === undefined) return undefined; return { prospects: p || null, posts: s || null, reviews: v || null }; },
    /* Change one of Max's docs: re-read it first so a change made meanwhile by Max's task is kept. */
    async maxChange(docId, fn) {
      const db = await timeout(dbP, 6000);
      if (!db) throw { code: 'unavailable' };
      const ref = db.collection('eddie').doc(docId), cur = await ref.get();
      const doc = cur.exists ? JSON.parse(JSON.stringify(cur.data())) : {};
      fn(doc);
      await ref.set(doc);
      return doc;
    },
    /* Save a text file (CSV). */
    async downloadText(filename, text, type) {
      const blob = new Blob([text], { type: type || 'text/csv' });
      const dl = await timeout(dlP, 6000);
      if (dl) { try { await dl.save({ filename, data: blob }); return true; } catch (e) { return false; } }
      try { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = filename; a.click(); return true; } catch (e) { return false; }
    },
    /* A plain email through Keith's Gmail; mail to his own address is put in the inbox too. */
    async emailText({ to, subject, body }) {
      const mcp = await timeout(mcpP, 6000);
      if (!mcp) return { ok: false, error: 'unavailable' };
      try {
        const r = await mcp.callTool('Gmail', 'send_message', { to: [to], subject, body });
        const id = r && r.payload && r.payload.id;
        if (id && /@homeprosgroup\.com$/i.test(to)) { try { await mcp.callTool('Gmail', 'update_message_labels', { messageId: id, addLabelIds: ['INBOX', 'UNREAD', 'IMPORTANT'] }); } catch (e) { } }
        return { ok: true };
      } catch (e) { return { ok: false, error: (e && e.code) || 'upstream_error' }; }
    },
    /* Grace's reports: grace/morning and grace/evening = {kind, date, generatedAt, headline, sections:[{title, lines}], needsYou, problems, session} */
    /* Everything Grace needs to walk Keith through a board meeting, in one read. */
    async meeting() {
      const want = [['morning', 'grace'], ['evening', 'grace'], ['inbox', 'rosa'], ['reminders', 'rosa'], ['report', 'eddie'], ['reviews', 'eddie'], ['posts', 'eddie'], ['prospects', 'eddie'], ['brief', 'penny'], ['marks', 'penny'], ['list', 'hank'], ['notes', 'grace']];
      const got = await Promise.all(want.map(([id, col]) => read(id, col)));
      if (got.every(x => x === undefined)) return undefined;
      const out = {}; want.forEach(([id, col], i) => { out[col + '/' + id] = got[i] || null; });
      return out;
    },
    /* Ask Claude (Talk to Grace). turns: [{role, content}] starting and ending on user. Rejects {code}. */
    async ask(turns, opts) {
      const s = await timeout(sampleP, 8000);
      if (!s) throw { code: 'unavailable' };
      return s(turns, Object.assign({ cache: false }, opts || {}));
    },
    async graceReports() { const [m, e] = await Promise.all([read('morning', 'grace'), read('evening', 'grace')]); return { morning: m, evening: e }; },
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
        const r = await mcp.callTool('Gmail', 'send_message', { to: [to], subject, body, attachments: [{ filename, mimeType: 'application/pdf', content: b64(bytes) }] });
        // Sent from keith@ to keith@: Gmail keeps only the Sent copy, so put it in the inbox too
        const id = r && r.payload && r.payload.id;
        if (id && /@homeprosgroup\.com$/i.test(to)) { try { await mcp.callTool('Gmail', 'update_message_labels', { messageId: id, addLabelIds: ['INBOX', 'UNREAD', 'IMPORTANT'] }); } catch (e) { } }
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
      const today = new Date().toISOString().slice(0, 10);
      const prompt = 'The image is a photo of a business receipt for Home Pros Group, a furnace and duct cleaning company in Alberta, Canada. Today is ' + today + '. '
        + 'DATES: receipts are almost always from the last 12 months and never in the future. Many Canadian shop systems print dates year-first with a 2-digit year, e.g. Tirecraft prints "26 Sep 23" meaning 2026 Sep 23 and "26 Oct 24" meaning 2026 Oct 24; others print DD/MM/YY or MM/DD/YY. Use any other date on the receipt (inquiry date, service notes, card slip) to decide. Pick the reading that falls within the last 12 months; if more than one reading is possible and nothing settles it, set sure to false and ask about the date in "question". '
        + 'Read it and answer with JSON only, no other text: {"date":"YYYY-MM-DD or empty","vendor":"store name","total":number (the amount paid, including GST),'
        + '"gst":number (GST amount shown, 0 if none shown),"items":"short description of what was bought","paidWith":"cash|card|debit|e-transfer|unknown",'
        + '"category":"one of: ' + categories.join('; ') + '","sure":true or false (false if any number is hard to read),'
        + '"question":"one short question to ask the owner if something is unclear or the category could be more than one, else empty"}. '
        + 'Never guess a number you cannot read: use 0 and set sure to false.';
      return sample.json(prompt, { images: [blob], modelTier: 'default', cache: false });
    },
    /* Jayman cheques: penny/cheques = {items:[{id, at, photos:[{id,url}], stub, status, result, session}]} */
    async cheques() { return read('cheques', 'penny'); },
    /* Ask Claude to read a Jayman cheque stub (one or more photos). Resolves the stub, or rejects {code}. */
    async readCheque(blobs) {
      const sample = await timeout(sampleP, 6000);
      if (!sample) throw { code: 'unavailable' };
      const prompt = 'The images are photos of one Jayman Master Builders cheque remittance stub, paid to Home Pros Group (vendor b7227). '
        + 'Header: Cheque No., Cheque Date, Cheque Total. The table columns are Invoice | Date | Description | Gross Amt | Adjusts | Net Amount. '
        + 'Each purchase order takes TWO printed rows: the first has the 8-digit PO number, date and job code; the second repeats the PO number with the job ADDRESS and project name. '
        + 'Do not count the second row as a separate line. The amount block is printed offset by half a line: there is exactly one amount per PO, in order, and the last PO gets the last amount. '
        + 'The Net Amount column must add up to the Cheque Total. Each net amount divided by 1.05 is usually a round price (265, 314, 315, 363, 50...). Adjusts is normally 0.00. '
        + 'Answer with JSON only: {"chequeNo":"digits","chequeDate":"YYYY-MM-DD","chequeTotal":number,"lines":[{"po":"8 digits","address":"street address from the second row","gross":number,"adjusts":number,"net":number}],'
        + '"sure":true or false,"unclear":"which digits or fields you could not read for certain, else empty"}. '
        + 'NEVER guess a digit: if any PO digit or amount is uncertain, still give your best reading but set sure to false and name it in "unclear".';
      return sample.json(prompt, { images: blobs, modelTier: 'default', cache: false });
    },
    /* Save a cheque for Penny and start her cheque task. Resolves {ok, how, error}. */
    async sendCheque(entry) {
      const db = await timeout(dbP, 5000), mcp = await timeout(mcpP, 5000);
      if (!db) return { ok: false, how: 'none' };
      try {
        const ref = db.collection('penny').doc('cheques'), cur = await ref.get();
        const items = ((cur.exists && cur.data().items) || []).filter(x => x.id !== entry.id).concat([entry]);
        await ref.set({ items });
      } catch (e) { return { ok: false, how: 'db', error: (e && e.code) || 'unavailable' }; }
      const task = root.HP_CONFIG && root.HP_CONFIG.office && root.HP_CONFIG.office.chequeTask;
      if (!task) return { ok: false, how: 'notask' };
      if (!mcp) return { ok: false, how: 'task', error: 'unavailable' };
      try { await mcp.callTool(CONNECTOR, 'fire_trigger', { trigger_id: task, text: JSON.stringify({ chequeId: entry.id }) }); }
      catch (e) { return { ok: false, how: 'task', error: (e && e.code) || 'upstream_error' }; }
      return { ok: true };
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
