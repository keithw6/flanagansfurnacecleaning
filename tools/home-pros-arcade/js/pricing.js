/* Flat-rate calculator. Pure function of HP_CONFIG + the customer's answers.
   Shared by the game and the booking server so the two can never disagree.

   selection = {
     services: ['furnace', 'dryer'],
     answers:  { furnace: { home: 'bung', furnaces: '1', sanitize: 'no' },
                 dryer:   { exit: 'ground' } }
   }                                                                        */
(function (root) {
  const ORDER = ['furnace', 'dryer'];

  function quote(selection, cfg) {
    cfg = cfg || root.HP_CONFIG;
    const errors = [];
    const lines = [];
    let hours = 0;
    const wanted = ORDER.filter(s => selection && Array.isArray(selection.services) && selection.services.includes(s));
    if (!wanted.length) errors.push('No service selected');
    const both = wanted.includes('furnace') && wanted.includes('dryer');

    for (const key of wanted) {
      const svc = cfg.services[key];
      const answers = (selection.answers && selection.answers[key]) || {};
      let svcTotal = svc.base || 0;
      let svcHours = both && key === 'dryer' ? cfg.bundle.extraHours : (svc.durationHours || 0);
      const parts = [];

      svc.questions.forEach((q, qi) => {
        const opt = q.options.find(o => o.id === answers[q.id]);
        if (!opt) { errors.push(`Missing answer: ${svc.label} / ${q.id}`); return; }
        let price = opt.price || 0;
        // Dryer vent booked with a duct clean: the first question's price becomes
        // the bundle price, keeping the difference between the options.
        if (both && key === 'dryer' && qi === 0) {
          const cheapest = Math.min(...q.options.map(o => o.price || 0));
          price = cfg.bundle.dryerWithFurnace + (price - cheapest);
        }
        svcTotal += price;
        svcHours += opt.hours || 0;
        parts.push({ question: q.id, tag: q.tag || q.id, answer: opt.id, label: opt.label, price });
      });

      lines.push({ service: key, label: both && key === 'dryer' ? svc.label + ' (bundle)' : svc.label, amount: svcTotal, parts });
      hours += svcHours;
    }

    const subtotal = lines.reduce((s, l) => s + l.amount, 0);
    const tax = Math.round(subtotal * cfg.tax.rate * 100) / 100;
    const total = Math.round((subtotal + tax) * 100) / 100;
    const summary = lines.map(l => `${l.label}: ${l.parts.map(p => `${p.tag}: ${p.label}`).join(', ')} ($${l.amount})`).join(' | ');
    return { valid: errors.length === 0, errors, lines, subtotal, tax, total, hours, summary };
  }

  function money(n) {
    return '$' + (Math.round(n * 100) / 100).toFixed(n % 1 ? 2 : 0);
  }

  root.HP_PRICING = { quote, money };
})(typeof globalThis !== 'undefined' ? globalThis : window);
