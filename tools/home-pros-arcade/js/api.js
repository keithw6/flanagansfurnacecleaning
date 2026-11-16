/* Talks to the booking server. With no apiBase set in config.js it runs in
   DEMO MODE: made-up openings, and booking does not reach ServiceMonster. */
(function (root) {
  const cfg = root.HP_CONFIG;
  const demo = !cfg.apiBase;
  const wait = ms => new Promise(r => setTimeout(r, ms));

  function demoBusy(now) {
    // a believable, repeatable pattern of already-booked jobs
    const busy = [];
    const startMin = HP_SCHEDULE.parse(now);
    const day0 = Math.floor(startMin / 1440) * 1440;
    for (let i = 0; i <= cfg.schedule.daysAhead; i++) {
      for (let s = 0; s < cfg.schedule.slots.length; s++) {
        const h = (i * 7 + s * 13) % 10;
        if (h < 3) {
          const st = day0 + i * 1440 + parseInt(cfg.schedule.slots[s].start) * 60 + 30;
          busy.push({ routeID: 'demo', start: HP_SCHEDULE.fmt(st), end: HP_SCHEDULE.fmt(st + 60) });
        }
      }
    }
    return busy;
  }

  async function call(path, init) {
    const res = await fetch(cfg.apiBase.replace(/\/$/, '') + path, init);
    let body = {};
    try { body = await res.json(); } catch (e) {}
    if (!res.ok) { const err = new Error(body.error || 'http_' + res.status); err.code = body.error; err.status = res.status; throw err; }
    return body;
  }

  root.HP_API = {
    demo,
    async availability(selection) {
      if (demo) {
        await wait(700);
        const q = HP_PRICING.quote(selection.answers, { known: false });
        const now = HP_SCHEDULE.localNow(cfg.business.timeZone);
        return { days: HP_SCHEDULE.availability({ cfg, now, busy: demoBusy(now), routes: ['demo'], hours: q.hours }) };
      }
      const qs = new URLSearchParams({ answers: JSON.stringify(selection.answers) });
      return call('/api/availability?' + qs);
    },
    // Travel fee for a town or address. Demo mode only knows the towns in travel.js.
    async travel(q) {
      if (demo) { await wait(500); return HP_TRAVEL.estimate(q); }
      return call('/api/travel?' + new URLSearchParams({ q }));
    },
    // Owner login for the Staff Only door. Demo mode lets any password in.
    async login(password) {
      if (demo) { await wait(500); return { ok: true, token: 'demo' }; }
      return call('/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password }) });
    },
    async me(token) {
      if (demo) return token === 'demo' ? { ok: true } : Promise.reject(new Error('unauthorized'));
      return call('/api/me', { headers: { Authorization: 'Bearer ' + token } });
    },
    // Customer Service reports. Demo mode shows the snapshot in js/office-data.js.
    async officeReport(token) {
      if (demo) { await wait(400); return root.HP_OFFICE_DATA || null; }
      return call('/api/office/report', { headers: { Authorization: 'Bearer ' + token } });
    },
    async book(payload) {
      if (demo) { await wait(1600); return { ok: true, demo: true, reference: 'DEMO-' + Math.floor(Math.random() * 9000 + 1000) }; }
      return call('/api/book', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    },
  };
})(window);
