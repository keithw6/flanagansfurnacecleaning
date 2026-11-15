/* Travel fee. Shared by the game and the booking server.

   Inside a service-area town: free. Outside: distance from the edge of the
   nearest service-area town, doubled for the round trip, times a road
   factor; the first `includedKm` are free and every km after that is
   `perKm`. Settings live in HP_CONFIG.travel.

   Towns we know without looking anything up are listed below. For anything
   else the booking server looks the place up (worker/), and the game in
   demo mode says the fee will be confirmed.                                */
(function (root) {
  // Common places around the service area. lat/lon are town centres.
  const NEARBY = [
    ['Beaumont', 53.3572, -113.4147], ['Devon', 53.3636, -113.7322], ['Calmar', 53.2622, -113.8167],
    ['Nisku', 53.3370, -113.5310], ['Morinville', 53.8022, -113.6497], ['Gibbons', 53.8297, -113.3290],
    ['Bon Accord', 53.8337, -113.4159], ['Legal', 53.9494, -113.5950], ['Redwater', 53.9514, -113.1072],
    ['Bruderheim', 53.8036, -112.9283], ['Lamont', 53.7603, -112.7777], ['Ardrossan', 53.5560, -113.1386],
    ['Namao', 53.7200, -113.4800], ['Villeneuve', 53.6599, -113.8165], ['Onoway', 53.7015, -114.1977],
    ['Alberta Beach', 53.6789, -114.3520], ['Wabamun', 53.5560, -114.4726], ['Entwistle', 53.6020, -114.9960],
    ['Evansburg', 53.5980, -115.0154], ['Thorsby', 53.2289, -114.0503], ['Warburg', 53.1797, -114.3150],
    ['Breton', 53.1117, -114.4691], ['Drayton Valley', 53.2225, -114.9769], ['Millet', 53.0939, -113.4708],
    ['Wetaskiwin', 52.9694, -113.3769], ['Westlock', 54.1522, -113.8573], ['Barrhead', 54.1236, -114.4020],
    ['Athabasca', 54.7192, -113.2856], ['Tofield', 53.3706, -112.6656], ['Mundare', 53.5914, -112.3292],
    ['Vegreville', 53.4950, -112.0510], ['Camrose', 53.0167, -112.8236], ['Smoky Lake', 54.1150, -112.4700],
    ['Whitecourt', 54.1430, -115.6856], ['Ponoka', 52.6766, -113.5815], ['Lacombe', 52.4680, -113.7370],
    ['Red Deer', 52.2690, -113.8116], ['Edson', 53.5817, -116.4395], ['Parkland County', 53.5800, -114.1000],
    ['Sturgeon County', 53.8200, -113.6000], ['Strathcona County', 53.5300, -113.1000], ['Leduc County', 53.2000, -113.6000],
  ].map(([name, lat, lon]) => ({ name, lat, lon }));

  const norm = s => String(s || '').toLowerCase()
    .replace(/\b(ab|alberta|canada)\b/g, ' ').replace(/[^a-z ]/g, ' ').replace(/\s+/g, ' ').trim();

  function km(a, b) {
    const R = 6371, rad = Math.PI / 180;
    const dLat = (b.lat - a.lat) * rad, dLon = (b.lon - a.lon) * rad;
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLon / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(h));
  }

  // Find a town by name in the service area or the nearby list.
  function findTown(text, cfg) {
    cfg = cfg || root.HP_CONFIG;
    const q = norm(text);
    if (!q) return null;
    for (const t of cfg.travel.serviceArea) {
      const names = [t.name, ...(t.aliases || [])].map(norm);
      if (names.some(n => q === n || q.endsWith(' ' + n) || q.includes(n))) return { ...t, inArea: true };
    }
    for (const t of NEARBY) {
      const n = norm(t.name);
      if (q === n || q.endsWith(' ' + n) || q.includes(n)) return { ...t, inArea: false };
    }
    return null;
  }

  // Travel for a point (lat/lon) or a known town.
  function fromPoint(point, label, cfg) {
    cfg = cfg || root.HP_CONFIG;
    const tr = cfg.travel;
    let best = null;
    for (const t of tr.serviceArea) {
      const edge = Math.max(0, km(point, t) - (t.radiusKm || 0));
      if (!best || edge < best.edge) best = { edge, from: t.name };
    }
    if (best.edge === 0) return { known: true, inArea: true, place: label, from: best.from, km: 0, billableKm: 0, fee: 0 };
    const oneWay = best.edge * tr.roadFactor;
    const driven = Math.round(oneWay * (tr.roundTrip ? 2 : 1));
    const billableKm = Math.max(0, driven - tr.includedKm);
    const fee = Math.round(billableKm * tr.perKm * 100) / 100;
    return { known: true, inArea: billableKm === 0 && driven === 0, place: label, from: best.from, km: driven, billableKm, fee };
  }

  function estimate(text, cfg) {
    const town = findTown(text, cfg);
    if (!town) return { known: false, place: String(text || '').trim(), fee: 0, km: 0, billableKm: 0 };
    if (town.inArea) return { known: true, inArea: true, place: town.name, from: town.name, km: 0, billableKm: 0, fee: 0 };
    return fromPoint(town, town.name, cfg);
  }

  root.HP_TRAVEL = { estimate, fromPoint, findTown, km };
})(typeof globalThis !== 'undefined' ? globalThis : window);
