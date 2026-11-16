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
      const [brief, expenses] = await Promise.all([read('brief', 'penny'), read('expenses-' + month, 'penny')]);
      if (brief === undefined && expenses === undefined) return undefined;
      return { brief: brief || null, expenses: expenses || null };
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
