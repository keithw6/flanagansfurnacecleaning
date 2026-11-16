/* Booking percentage. Shared by the booking server (live) and the snapshot
   script (preview). Pure function of ServiceMonster /scheduling items.

   A route's day is full at `dayHours` of booked jobs (4 calls x 2 hours = 8).
   One truck works both routes, so the truck's total for a day is
   New Home + Residential hours over the same 8 hours: over 100% means
   overbooked. Calendar notes are listed but don't count as booked time.    */
(function (root) {
  const hours = i => (Date.parse(i.endDateTime + 'Z') - Date.parse(i.startDateTime + 'Z')) / 36e5;
  const pct = (h, cap) => Math.round(h / cap * 100);

  function compute(items, opts) {
    const { from, days, dayHours, workDays, routes, names } = opts;
    const keys = Object.keys(routes);
    const out = [];
    const d0 = Date.parse(from + 'T00:00:00Z');
    for (let i = 0; i < days; i++) {
      const date = new Date(d0 + i * 864e5).toISOString().slice(0, 10);
      const wd = new Date(date + 'T00:00:00Z').getUTCDay();
      const day = { date, weekday: wd, work: workDays.includes(wd), routes: {}, notes: [], big: [] };
      for (const k of keys) day.routes[k] = { hours: 0, jobs: 0 };
      out.push(day);
    }
    const byDate = Object.fromEntries(out.map(d => [d.date, d]));
    for (const it of items) {
      const day = byDate[(it.startDateTime || '').slice(0, 10)];
      const key = keys.find(k => routes[k] === it.routeID);
      if (!day || !key || /cancel/i.test(it.status || '')) continue;
      if (it.itemType && it.itemType !== 'Job') { day.notes.push(`${it.subject || it.itemType} (${it.startDateTime.slice(11, 16)}-${it.endDateTime.slice(11, 16)})`); continue; }
      const h = hours(it);
      day.routes[key].hours += h; day.routes[key].jobs++;
      if (h >= 6) day.big.push({ route: key, hours: h, label: (names && names[it.accountID]) || it.city || 'all-day job' });
    }
    for (const d of out) {
      for (const k of keys) d.routes[k].pct = pct(d.routes[k].hours, dayHours);
      d.total = { hours: keys.reduce((s, k) => s + d.routes[k].hours, 0) };
      d.total.pct = pct(d.total.hours, dayHours);
      d.over = d.total.pct > 100;
    }
    const work = out.filter(d => d.work || d.total.hours > 0);
    const summary = { routes: {}, workDays: work.length };
    for (const k of keys) {
      const h = work.reduce((s, d) => s + d.routes[k].hours, 0);
      summary.routes[k] = { hours: h, pct: pct(h, dayHours * work.length) };
    }
    const th = work.reduce((s, d) => s + d.total.hours, 0);
    summary.total = { hours: th, pct: pct(th, dayHours * work.length) };
    summary.overbooked = out.filter(d => d.over).map(d => ({ date: d.date, pct: d.total.pct, why: d.big.map(b => `${b.label} (${b.hours}h, ${b.route})`).join(', ') }));
    return { from, days: out, summary };
  }

  /* Every Jayman call in the window, on any route: jobs for a Jayman account,
     plus calendar activities that mention Jayman (warranty visits are booked
     as activities first and still need a work order). Warranty calls are
     TIMED: the crew has to arrive at that time. Other Jayman calls only have to
     happen that day, so their order is free to change for driving.          */
  function jayman(items, o) {
    const accounts = new Set(o.accounts);
    const routeName = Object.fromEntries(Object.entries(o.routes).map(([k, v]) => [v, k]));
    const isJay = i => accounts.has(i.accountID) || /jayman/i.test(`${i.subject || ''} ${i.note || ''}`);
    const list = items.filter(i => isJay(i) && !/cancel/i.test(i.status || '') && (i.startDateTime || '').slice(0, 10) >= o.from)
      .sort((a, b) => a.startDateTime.localeCompare(b.startDateTime))
      .map(i => {
        const text = `${i.subject || ''} ${i.note || ''}`;
        const warranty = o.warranty.test(text);
        const activity = i.itemType && i.itemType !== 'Job';
        const addr = i.address1 || ((i.subject || '').match(/\d{3,6}\s+[^-]+?(?:\s+(?:NW|SW|NE|SE))?(?=\s+-|$)/) || [''])[0].trim();
        return {
          id: i.itemID, date: i.startDateTime.slice(0, 10), start: i.startDateTime.slice(11, 16), end: i.endDateTime.slice(11, 16),
          // an activity's "Complete" doesn't mean the visit happened: it still needs a work order
          route: routeName[i.routeID] || 'other', status: activity ? 'Needs work order' : (i.status || ''),
          done: !activity && /complete/i.test(i.status || ''),
          kind: warranty ? 'warranty' : activity ? 'activity' : 'job', timed: warranty, needsWO: activity,
          address: addr, city: i.city || '', lat: i.latitude, lon: i.longitude, label: activity ? (i.subject || '') : '',
        };
      });
    const days = [];
    for (const c of list) {
      let d = days[days.length - 1];
      if (!d || d.date !== c.date) days.push(d = { date: c.date, calls: [] });
      d.calls.push(c);
    }
    for (const d of days) {
      d.total = d.calls.length; d.done = d.calls.filter(c => c.done).length; d.todo = d.total - d.done;
      const left = d.calls.filter(c => !c.done).map(c => ({ ...c, movable: !c.timed }));
      d.drive = left.length >= 2 && root.HP_DRIVE ? root.HP_DRIVE.bestOrder(o.base, left, o.roadFactor) : null;
    }
    return {
      days,
      totals: { total: list.length, done: list.filter(c => c.done).length, todo: list.filter(c => !c.done).length,
        warranty: list.filter(c => c.kind === 'warranty').length, needsWO: list.filter(c => c.needsWO).length },
    };
  }

  root.HP_CAPACITY = { compute, jayman };
})(typeof globalThis !== 'undefined' ? globalThis : window);
