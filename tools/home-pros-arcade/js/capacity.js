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

  // Upcoming jobs on one route (the Jayman list uses New Home).
  function jobsOn(items, routeID, from) {
    return items.filter(i => i.routeID === routeID && i.itemType === 'Job' && !/cancel/i.test(i.status || '') && i.startDateTime.slice(0, 10) >= from)
      .sort((a, b) => a.startDateTime.localeCompare(b.startDateTime))
      .map(i => ({ date: i.startDateTime.slice(0, 10), start: i.startDateTime.slice(11, 16), end: i.endDateTime.slice(11, 16), city: i.city || '', status: i.status || '' }));
  }

  root.HP_CAPACITY = { compute, jobsOn };
})(typeof globalThis !== 'undefined' ? globalThis : window);
