/* Flat-rate calculator. Pure function of HP_CONFIG + the customer's answers.
   Shared by the game and the booking server so the two can never disagree.

   answers = {
     furnaces: 1-5,          // total furnaces
     ac: true|false,         // any air conditioning
     acCount: 1-furnaces,    // only asked with more than one furnace
     zone: true|false,
     dryer: 'no'|'side'|'roof'
   }
   travel = result of HP_TRAVEL.estimate() (or the server's lookup)       */
(function (root) {
  const int = v => (Number.isInteger(+v) ? +v : NaN);

  function quote(answers, travel, cfg) {
    cfg = cfg || root.HP_CONFIG;
    const p = cfg.prices, h = cfg.hours;
    const a = answers || {};
    const errors = [];
    const lines = [];

    const furnaces = int(a.furnaces);
    if (!(furnaces >= 1 && furnaces <= cfg.maxFurnaces)) errors.push('furnaces');
    const n = furnaces >= 1 ? Math.min(furnaces, cfg.maxFurnaces) : 1;

    lines.push({ key: 'base', label: 'Furnace & duct cleaning', detail: 'Furnace, all ducting, every supply & return register', amount: p.base });
    let hours = h.base;
    if (n > 1) {
      lines.push({ key: 'extraFurnace', label: `Additional furnace${n > 2 ? 's' : ''} x ${n - 1}`, detail: `${money(p.extraFurnace)} each, with its ducting & registers`, amount: (n - 1) * p.extraFurnace });
      hours += (n - 1) * h.extraFurnace;
    }

    if (a.ac === true) {
      const count = n === 1 ? 1 : int(a.acCount);
      if (!(count >= 1 && count <= n)) errors.push('acCount');
      const c = count >= 1 ? Math.min(count, n) : 1;
      lines.push({ key: 'airConditioner', label: `Air conditioning${c > 1 ? ' x ' + c : ''}`, detail: c > 1 ? `${money(p.airConditioner)} each` : '', amount: c * p.airConditioner });
    } else if (a.ac !== false) errors.push('ac');

    if (a.zone === true) { lines.push({ key: 'zone', label: 'Zone system', detail: '', amount: p.zone }); hours += h.zone; }
    else if (a.zone !== false) errors.push('zone');

    if (a.dryer === 'side') { lines.push({ key: 'dryerVent', label: 'Dryer vent cleaning', detail: 'Side-wall exit', amount: p.dryerVent }); hours += h.dryerVent; }
    else if (a.dryer === 'roof') lines.push({ key: 'dryerVent', label: 'Dryer vent (roof exit)', detail: 'Not serviced: we do not go on roofs', amount: 0 });
    else if (a.dryer !== 'no') errors.push('dryer');

    let travelPending = false;
    if (travel) {
      if (!travel.known) {
        travelPending = true;
        lines.push({ key: 'travel', label: 'Travel', detail: 'To be confirmed before your visit', amount: 0 });
      } else if (travel.fee > 0) {
        lines.push({ key: 'travel', label: `Travel to ${travel.place}`, detail: `${travel.billableKm} km past the free ${cfg.travel.includedKm} km, at ${money(cfg.travel.perKm)}/km`, amount: travel.fee });
      } else {
        lines.push({ key: 'travel', label: `Travel to ${travel.place}`, detail: 'In our service area', amount: 0 });
      }
    } else errors.push('travel');

    const subtotal = Math.round(lines.reduce((s, l) => s + l.amount, 0) * 100) / 100;
    const tax = Math.round(subtotal * cfg.tax.rate * 100) / 100;
    const total = Math.round((subtotal + tax) * 100) / 100;
    const summary = lines.map(l => `${l.label}${l.detail ? ' (' + l.detail + ')' : ''}: ${money(l.amount)}`).join('\n');
    return { valid: errors.length === 0, errors, lines, subtotal, tax, total, hours, travelPending, summary };
  }

  function money(n) {
    n = Math.round(n * 100) / 100;
    return '$' + (n % 1 ? n.toFixed(2) : String(n));
  }

  root.HP_PRICING = { quote, money };
})(typeof globalThis !== 'undefined' ? globalThis : window);
