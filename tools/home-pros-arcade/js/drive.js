/* Driving order for a day's calls. Shared by the Customer Service report
   (game + booking server) and Rosa's booking helper.

   Jayman calls only have to happen on their day; the time doesn't matter.
   So within a day we can swap which call goes in which time slot to cut
   driving. Timed calls (warranty visits) stay exactly where they are.
   Distance is straight-line km x a road factor, from the shop and back:
   good enough to rank orders, not a GPS route.                            */
(function (root) {
  const km = (a, b) => {
    const R = 6371, r = Math.PI / 180;
    const h = Math.sin((b.lat - a.lat) * r / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin((b.lon - a.lon) * r / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(h));
  };

  // stops in time order -> km from base, through every stop, back to base
  function routeKm(base, stops, roadFactor) {
    let d = 0, at = base;
    for (const s of stops) { if (s.lat == null) continue; d += km(at, s); at = s; }
    return Math.round((d + km(at, base)) * (roadFactor || 1.3));
  }

  function permutations(a) {
    if (a.length <= 1) return [a];
    const out = [];
    a.forEach((x, i) => permutations(a.slice(0, i).concat(a.slice(i + 1))).forEach(p => out.push([x].concat(p))));
    return out;
  }

  /* calls: [{ id, start: 'HH:MM', lat, lon, movable: bool, ... }] for one day.
     Movable calls trade time slots among themselves; fixed calls keep theirs.
     Returns { currentKm, bestKm, saveKm, order: [{ ...call, newStart }] }.  */
  function bestOrder(base, calls, roadFactor) {
    const sorted = calls.slice().sort((a, b) => a.start.localeCompare(b.start));
    const currentKm = routeKm(base, sorted, roadFactor);
    const movable = sorted.filter(c => c.movable && c.lat != null);
    const times = movable.map(c => c.start);
    let best = { km: currentKm, assign: movable.map(c => c) };
    if (movable.length >= 2 && movable.length <= 7) {
      for (const p of permutations(movable)) {
        const placed = sorted.map(c => (c.movable && c.lat != null ? null : c));
        let k = 0;
        const withTimes = sorted.map((c, i) => placed[i] || Object.assign({}, p[k], { start: times[k++] }));
        const d = routeKm(base, withTimes.slice().sort((a, b) => a.start.localeCompare(b.start)), roadFactor);
        if (d < best.km) best = { km: d, assign: p };
      }
    }
    const newStart = new Map(best.assign.map((c, i) => [c.id, times[i]]));
    const order = sorted.map(c => Object.assign({}, c, { newStart: newStart.get(c.id) || c.start }))
      .sort((a, b) => a.newStart.localeCompare(b.newStart));
    return { currentKm, bestKm: best.km, saveKm: currentKm - best.km, order };
  }

  // Added driving if a new stop goes into a given slot of a day's calls.
  function addedKm(base, calls, stop, roadFactor) {
    const sorted = calls.slice().sort((a, b) => a.start.localeCompare(b.start));
    const before = routeKm(base, sorted, roadFactor);
    const after = routeKm(base, sorted.concat([stop]).sort((a, b) => a.start.localeCompare(b.start)), roadFactor);
    return after - before;
  }

  root.HP_DRIVE = { km, routeKm, bestOrder, addedKm };
})(typeof globalThis !== 'undefined' ? globalThis : window);
