/* Open-slot finder. Shared by the booking server (real ServiceMonster
   schedule) and the game's demo mode (made-up busy times), so both behave
   the same way.

   All times are "naive local" strings in the business time zone, e.g.
   '2026-11-20T08:00:00', the same shape ServiceMonster uses. Arithmetic is
   done by treating them as UTC, which is exact as long as nothing mixes zones. */
(function (root) {
  const pad = n => String(n).padStart(2, '0');

  // Current wall-clock time in the business time zone, as a naive string.
  function localNow(timeZone, date) {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone, year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
    }).formatToParts(date || new Date());
    const p = Object.fromEntries(parts.map(x => [x.type, x.value]));
    return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:${p.second}`;
  }

  // Accepts '2026-11-20T08:00:00', '2026-11-20T08:00', '11/20/2026 8:00 AM'.
  function parse(s) {
    if (!s) return NaN;
    let m = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/.exec(s);
    if (m) return Date.UTC(+m[1], m[2] - 1, +m[3], +m[4], +m[5]) / 60000;
    m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2})(?::\d{2})?\s*([AP]M)?/i.exec(s);
    if (m) {
      let h = +m[4] % 12;
      if (m[6] && m[6].toUpperCase() === 'PM') h += 12;
      if (!m[6]) h = +m[4];
      return Date.UTC(+m[3], m[1] - 1, +m[2], h, +m[5]) / 60000;
    }
    return NaN;
  }

  function fmt(min) {
    const d = new Date(min * 60000);
    return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}T${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:00`;
  }

  const hm = s => { const [h, m] = s.split(':').map(Number); return h * 60 + m; };

  /* busy: [{ routeID, start, end }]  routes: ['route-guid', ...]
     Returns [{ date, weekday, slots: [{ start, end, label, routeID }] }]   */
  function availability({ cfg, now, busy, routes, hours }) {
    const sc = cfg.schedule;
    const nowMin = parse(now);
    const earliest = nowMin + sc.minLeadHours * 60;
    const durMin = Math.ceil(hours * 60);
    const dayStart = Math.floor(nowMin / 1440) * 1440;
    const byRoute = {};
    for (const r of routes) byRoute[r] = [];
    for (const b of busy || []) {
      const s = parse(b.start), e = parse(b.end);
      if (isNaN(s) || isNaN(e)) continue;
      if (b.routeID in byRoute) byRoute[b.routeID].push([s, e]);
      else if (!b.routeID) for (const r of routes) byRoute[r].push([s, e]); // unassigned blocks everyone
    }

    const days = [];
    for (let i = 0; i <= sc.daysAhead; i++) {
      const d0 = dayStart + i * 1440;
      const date = fmt(d0).slice(0, 10);
      const weekday = new Date(d0 * 60000).getUTCDay();
      if (!sc.workDays.includes(weekday)) continue;
      const slots = [];
      for (const slot of sc.slots) {
        const s = d0 + hm(slot.start);
        const e = s + durMin;
        if (s < earliest || e > d0 + hm(sc.dayEnd)) continue;
        const free = routes.find(r => !byRoute[r].some(([bs, be]) => bs < e && be > s));
        if (free) slots.push({ start: fmt(s), end: fmt(e), label: slot.label, routeID: free });
      }
      if (i === 0 && !slots.length) continue; // don't show today as "full" when it's just late
      days.push({ date, weekday, slots });
    }
    return days;
  }

  function isFree({ cfg, now, busy, routes, hours, start, routeID }) {
    const days = availability({ cfg, now, busy, routes, hours });
    for (const d of days) for (const s of d.slots) {
      if (s.start === start) {
        // the requested route if it is still free, else any free route
        const sMin = parse(start), eMin = sMin + Math.ceil(hours * 60);
        const routeFree = r => !(busy || []).some(b => (b.routeID === r || !b.routeID) && parse(b.start) < eMin && parse(b.end) > sMin);
        if (routeID && routes.includes(routeID) && routeFree(routeID)) return { ...s, routeID };
        return s;
      }
    }
    return null;
  }

  root.HP_SCHEDULE = { localNow, parse, fmt, availability, isFree };
})(typeof globalThis !== 'undefined' ? globalThis : window);
