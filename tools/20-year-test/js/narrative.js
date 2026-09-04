/* =====================================================================
   Blue Collar Business - The 20-Year Test
   narrative.js : the written analysis and the YouTube pack

   The rule from the brief (s.22 and s.26): explain the difference,
   do not re-read the numbers aloud, and never declare an occupation
   universally better. Where the model produces an uncomfortable
   answer for the blue-collar side, say so plainly - an audience can
   tell when a comparison has its thumb on the scale.
   ===================================================================== */
(function (global) {
  'use strict';

  var BCB = global.BCB = global.BCB || {};

  function money(v) {
    var sign = v < 0 ? '-' : '';
    var a = Math.abs(Math.round(v));
    return sign + '$' + a.toLocaleString();
  }
  function moneyShort(v) {
    var sign = v < 0 ? '-' : '';
    var a = Math.abs(v);
    if (a >= 1e6) { return sign + '$' + (a / 1e6).toFixed(a >= 1e7 ? 1 : 2) + 'M'; }
    if (a >= 1e3) { return sign + '$' + Math.round(a / 1e3) + 'k'; }
    return sign + '$' + Math.round(a);
  }
  function pct(v) { return Math.round(v * 100) + '%'; }
  function plural(n, s, p) { return n === 1 ? s : (p || s + 's'); }

  /* Who leads on a measure, and by how much - phrased for prose. */
  function lead(aName, bName, aVal, bVal, higherWins) {
    var aBetter = higherWins ? aVal > bVal : aVal < bVal;
    var gap = Math.abs(aVal - bVal);
    return {
      winner: aVal === bVal ? null : (aBetter ? aName : bName),
      loser: aVal === bVal ? null : (aBetter ? bName : aName),
      gap: gap,
      ratio: Math.min(aVal, bVal) !== 0 ? Math.max(aVal, bVal) / Math.min(aVal, bVal) : null
    };
  }

  /* ---------------------------------------------------------------
     THE ANALYSIS (spec s.22)
     Returns an array of {heading, paragraphs:[...]} so the report and
     the on-screen panel can share it.
     --------------------------------------------------------------- */
  function analysis(sim, scores) {
    var a = sim.a, b = sim.b, cfg = sim.cfg;
    var sa = scores.a, sb = scores.b;
    var A = a.name, B = b.name;
    var endAge = cfg.startAge + cfg.years;
    var out = [];
    var hs = sim.headStart;

    /* ---- the head start ---- */
    var p = [];
    if (hs.years > 0) {
      p.push(hs.leader + ' is earning a full-time wage ' + hs.years + ' ' + plural(hs.years, 'year') +
        ' before ' + hs.laggard + ' earns a professional income at all. Over that window ' + hs.leader +
        ' banks ' + money(hs.incomeEarned) + ' in gross pay and walks into their mid-twenties with ' +
        money(hs.investmentsAccumulated) + ' behind them, while ' + hs.laggard +
        (hs.debtAvoided > 1000
          ? ' is carrying ' + money(hs.debtAvoided) + ' of education debt that ' + hs.leader + ' simply never took on.'
          : ' is only starting to earn.'));
      p.push('That is the part of this comparison people underestimate. It is not just the ' +
        hs.years + ' ' + plural(hs.years, 'year') + ' of missing salary - it is ' + hs.years +
        ' years of compounding that never happened, on top of a debt balance that grows while it waits. ' +
        'Put together, the gap at age ' + hs.toAge + ' is roughly ' + money(hs.total) + '.');
      if (sim.crossoverNetWorth) {
        p.push(sim.crossoverNetWorth.passer + ' closes that gap and moves ahead at age ' +
          sim.crossoverNetWorth.age +
          (sim.crossoverNetWorthProjected
            ? ', though that is past the end of this ' + cfg.years + '-year window - it is a projection on the same assumptions, not a result the comparison itself measured.'
            : '. From there the higher professional income does the work.'));
      } else {
        p.push('On these assumptions ' + hs.laggard + ' does not close that gap - not by age ' + endAge +
          ' and not by ' + sim.projectToAge + ' on the same numbers. That is a strong claim, so it is worth ' +
          'stress-testing: drop the business growth rate, or run the conservative scenario, and see whether it holds.');
      }
    } else {
      p.push('Both careers start earning at the same age, so neither gets a head start. ' +
        'This comparison is decided by what happens after that, not by who started first.');
    }
    out.push({ heading: 'Who gets the head start', paragraphs: p });

    /* ---- lifetime earnings vs what was kept ---- */
    var earn = lead(A, B, a.totals.careerEarnings, b.totals.careerEarnings, true);
    var worth = lead(A, B, a.totals.netWorth, b.totals.netWorth, true);
    p = [];
    p.push(earn.winner
      ? earn.winner + ' earns more over the ' + cfg.years + ' years - ' +
        money(Math.abs(a.totals.careerEarnings - b.totals.careerEarnings)) + ' more in total pay.'
      : 'Total earnings come out level.');
    if (worth.winner && earn.winner && worth.winner !== earn.winner) {
      p.push('And yet ' + worth.winner + ' finishes with the higher net worth. That is the whole argument of this exercise: ' +
        'what you earn and what you keep are different numbers. ' + earn.winner + ' pays more tax, started later, ' +
        'carried more debt, or spent more of it - and the gross figure hides all of that.');
    } else if (worth.winner) {
      p.push(worth.winner + ' both earns more and keeps more, finishing ' +
        money(Math.abs(a.totals.netWorth - b.totals.netWorth)) + ' ahead. When the same career wins on income and on ' +
        'net worth, the comparison is not close and should not be presented as though it were.');
    }
    p.push('Tax takes ' + money(a.totals.totalTax) + ' from ' + A + ' and ' + money(b.totals.totalTax) +
      ' from ' + B + ' over the period. Education, financing included, costs ' + A + ' ' +
      money(a.totals.educationTotalCost) + ' against ' + money(b.totals.educationTotalCost) + ' for ' + B + '.');
    out.push({ heading: 'Earning versus keeping', paragraphs: p });

    /* ---- risk and debt ---- */
    p = [];
    var debtLead = lead(A, B, a.totals.peakStudentDebt, b.totals.peakStudentDebt, false);
    if (debtLead.winner) {
      p.push(debtLead.loser + ' carries the heavier education debt, peaking at ' +
        money(Math.max(a.totals.peakStudentDebt, b.totals.peakStudentDebt)) + '. ' +
        debtFreePhrase(A, a) + ', ' + debtFreePhrase(B, b) + '.');
    } else {
      p.push('Neither career takes on meaningful education debt.');
    }
    var aRisk = a.isOwner, bRisk = b.isOwner;
    if (aRisk || bRisk) {
      var risky = [];
      if (aRisk) { risky.push(A + ' puts ' + money(a.career.business.startupInvestment) + ' of capital at risk starting a business at ' + a.career.business.startAge); }
      if (bRisk) { risky.push(B + ' puts ' + money(b.career.business.startupInvestment) + ' of capital at risk starting a business at ' + b.career.business.startAge); }
      p.push(risky.join('; ') + '. That is real downside, and this model does not price the chance of failure - ' +
        'it shows what happens if the business works. The conservative scenario is the closest thing here to a ' +
        'reality check, and it is the number to quote if you are being careful.');
    }
    if (a.milestones.businessFailedAge || b.milestones.businessFailedAge) {
      var failed = a.milestones.businessFailedAge ? A : B;
      var failAge = a.milestones.businessFailedAge || b.milestones.businessFailedAge;
      p.push('Worth flagging: on these inputs ' + failed + "'s business does not survive - it stops covering its own " +
        'costs and winds up at age ' + failAge + '. That is the model refusing to pretend, not a glitch.');
    }
    out.push({ heading: 'Who takes the risk', paragraphs: p });

    /* ---- lifestyle ---- */
    p = [];
    var lifeLead = lead(A, B, sa.lifestyle.score, sb.lifestyle.score, true);
    p.push(lifeLead.winner
      ? lifeLead.winner + ' has the better working life on balance - ' + sa.lifestyle.score + ' against ' +
        sb.lifestyle.score + ' out of 100 - but the totals hide the trade.'
      : 'The two score level on lifestyle overall, which makes the components the interesting part.');
    /* Name the two biggest component gaps rather than listing all eight. */
    var gaps = sa.lifestyle.rows.map(function (r, i) {
      return { label: r.label, aV: r.value, bV: sb.lifestyle.rows[i].value, d: r.value - sb.lifestyle.rows[i].value };
    }).sort(function (x, y) { return Math.abs(y.d) - Math.abs(x.d); });
    gaps.slice(0, 3).forEach(function (g) {
      var better = g.d > 0 ? A : B;
      var worse = g.d > 0 ? B : A;
      p.push(g.label + ': ' + better + ' scores ' + Math.max(g.aV, g.bV) + '/10 against ' +
        Math.min(g.aV, g.bV) + '/10 for ' + worse + '. ' + lifestyleComment(g.label, better, worse));
    });
    p.push(A + ' works about ' + Math.round(a.totals.hours).toLocaleString() + ' hours over the period, ' +
      B + ' about ' + Math.round(b.totals.hours).toLocaleString() + '. Per hour on the clock, ' +
      'that is ' + money(a.totals.wealthPerHour) + ' of net worth built for ' + A + ' and ' +
      money(b.totals.wealthPerHour) + ' for ' + B + '.');
    out.push({ heading: 'The lifestyle trade', paragraphs: p });

    /* ---- ownership, scalability, dependency ---- */
    p = [];
    var depA = sa.ownerDependency, depB = sb.ownerDependency;
    if (depA.applicable || depB.applicable) {
      if (depA.applicable && depB.applicable) {
        var dl = lead(A, B, depA.score, depB.score, true);
        p.push('Both build a business, but they are not the same asset. ' + A + ' scores ' + depA.score +
          '/10 on owner dependency and ' + B + ' scores ' + depB.score + '/10, where 10 means the company keeps ' +
          'producing when the owner stops. ' + (dl.winner ? dl.winner + "'s business is the more sellable one." : ''));
      } else {
        var owner = depA.applicable ? A : B;
        var dep = depA.applicable ? depA : depB;
        p.push(owner + ' ends the period owning a business scoring ' + dep.score +
          '/10 on owner dependency; the other path builds no business asset at all.');
      }
      [[A, depA], [B, depB]].forEach(function (pair) {
        if (pair[1].applicable) { p.push(pair[0] + ': ' + pair[1].note); }
      });
      if ((depA.applicable && depA.stepBackBlocked) || (depB.applicable && depB.stepBackBlocked)) {
        var stuck = (depA.applicable && depA.stepBackBlocked) ? A : B;
        p.push('That is the finding worth dwelling on. ' + stuck + ' cannot actually step back from the work: ' +
          'the moment they hand production to employees, what is left will not cover the bank and a liveable draw. ' +
          'A business that only works while you are in it is a job with extra paperwork, however good the income.');
      }
    } else {
      p.push('Neither path builds a business here. Both finish with a portfolio and a house, which makes this a ' +
        'comparison of two salaries - and the employee-versus-owner toggle is the more interesting question to run next.');
    }
    if (a.totals.businessEquity > 0 || b.totals.businessEquity > 0) {
      p.push('Business equity at the end: ' + money(a.totals.businessEquity) + ' for ' + A + ', ' +
        money(b.totals.businessEquity) + ' for ' + B + '. That is the estimated sale value less what is owed, ' +
        'and it is the single largest swing factor in this whole comparison.');
    }
    out.push({ heading: 'Ownership and what it is worth', paragraphs: p });

    /* ---- time freedom and independence ---- */
    p = [];
    var tfLead = lead(A, B, sa.timeFreedom.score, sb.timeFreedom.score, true);
    p.push(tfLead.winner
      ? tfLead.winner + ' ends up with more control over their own time - ' + sa.timeFreedom.score + ' against ' +
        sb.timeFreedom.score + ' out of 10.'
      : 'Time freedom comes out level at ' + sa.timeFreedom.score + '/10.');
    var fa = a.milestones.financialFreedomAgeWithSale, fb = b.milestones.financialFreedomAgeWithSale;
    if (fa || fb) {
      p.push('Selling the business and living off the proceeds at a ' + pct(cfg.safeWithdrawal) +
        ' withdrawal rate, ' + (fa ? A + ' reaches financial independence around age ' + fa : A + ' does not get there on these numbers') +
        ' and ' + (fb ? B + ' around age ' + fb : B + ' does not get there on these numbers') + '. ' +
        'Keeping the business rather than selling it changes that materially, because only the part of the profit ' +
        'that survives the owner stepping away counts as income you can rely on.');
    }
    out.push({ heading: 'Time freedom and independence', paragraphs: p });

    /* ---- who each is actually for ---- */
    p = [];
    p.push('Neither of these is the better career in the abstract, and the comparison should not be presented as though ' +
      'one occupation beats another. What it shows is which set of trade-offs each one asks you to accept.');
    p.push(A + ' suits someone who ' + personalityFor(a, sa) + '.');
    p.push(B + ' suits someone who ' + personalityFor(b, sb) + '.');
    var swing = [];
    if (a.isOwner || b.isOwner) { swing.push('whether the business actually gets built'); }
    swing.push('how long each person stays out of the workforce');
    swing.push('what the education really costs where you live');
    p.push('And the answer moves on a handful of inputs: ' + swing.join(', ') +
      '. Change those and the winner can change with them, which is the honest thing to say on camera.');
    out.push({ heading: 'Who each career is for', paragraphs: p });

    return out;
  }

  /* "Clear of it at 18" is nonsense for someone who never borrowed. */
  function debtFreePhrase(name, res) {
    var m = res.milestones;
    if (m.neverBorrowed) { return name + ' never borrows at all'; }
    if (m.debtFreeAge == null) { return name + ' is still repaying past the end of the window'; }
    return name + ' is clear of it at ' + m.debtFreeAge +
      (m.debtFreeProjected ? ' (projected, past the window)' : '');
  }

  function lifestyleComment(label, better, worse) {
    var map = {
      'Hours worked': 'Hours are the tax you pay in time, and it never shows up on a pay stub.',
      'Vacation': 'Time off you cannot take is not time off.',
      'Stress': 'Different kinds of pressure, not different amounts of toughness.',
      'Physical demands': 'The body keeps the invoice, and it comes due in the fifties.',
      'Mental demands': 'Sustained concentration and liability are real costs even when the day is short.',
      'Flexibility': 'Flexibility is what lets a career survive a change at home.',
      'Job security': 'Security is worth most in the years you least expect to need it.',
      'Family / personal': 'Evenings and weekends are the part nobody gets back.'
    };
    return map[label] || '';
  }

  function personalityFor(res, score) {
    var bits = [];
    var t = res.career.traits, L = res.career.lifestyle;
    if (res.isOwner && score.ownerDependency.applicable && score.ownerDependency.score >= 6) {
      bits.push('wants to build something that can run without them');
    } else if (res.isOwner) {
      bits.push('is willing to own the job before they own an asset');
    } else {
      bits.push('would rather have a predictable pay cheque than a balance sheet');
    }
    if (L.physical <= 4) { bits.push('can take physical work for two decades'); }
    if (L.physical >= 8) { bits.push('wants to keep their body out of the job'); }
    if (t.incomeCeiling >= 8) { bits.push('is aiming at a high professional ceiling'); }
    if (res.education.spanYears >= 5) { bits.push('is prepared to spend years in school and borrow to do it'); }
    if (res.education.spanYears <= 1) { bits.push('wants to start earning immediately'); }
    if (score.lifestyle.rows[7].value >= 7) { bits.push('values a predictable family calendar'); }
    return bits.slice(0, 3).join(', and ');
  }

  /* ---------------------------------------------------------------
     YOUTUBE PACK (spec s.25)
     --------------------------------------------------------------- */
  function youtube(sim, scores) {
    var a = sim.a, b = sim.b, cfg = sim.cfg;
    var A = a.name, B = b.name;
    var endAge = cfg.startAge + cfg.years;
    var hs = sim.headStart;
    var winner = scores.netWorthWinner;
    var loser = winner === A ? B : A;
    var wRes = winner === A ? a : b;
    var lRes = winner === A ? b : a;
    var gap = Math.abs(a.totals.netWorth - b.totals.netWorth);

    var titles = [
      A + ' vs ' + B + " - Who's Richer After " + cfg.years + ' Years?',
      'I Ran ' + A + ' vs ' + B + ' Through ' + cfg.years + ' Years of Math. The Winner Surprised Me.',
      A + ' vs ' + B + ': The ' + cfg.years + '-Year Test',
      'Who Wins At ' + endAge + ' - The ' + A + ' Or The ' + B + '?',
      'The ' + (hs.years > 0 ? hs.years + '-Year Head Start' : 'Ownership Gap') + ' That Decides ' + A + ' vs ' + B
    ];

    var thumbs = [
      'WHO WINS AT ' + endAge + '?',
      moneyShort(gap) + ' APART',
      hs.years > 0 ? hs.years + ' YEAR HEAD START' : 'OWNER VS EMPLOYEE',
      'RICHER AT ' + endAge
    ];

    var hook = hs.years > 0
      ? 'One of them starts earning at ' + cfg.startAge + '. The other spends ' + hs.years +
        ' years in school first and comes out owing ' + moneyShort(Math.max(a.totals.peakStudentDebt, b.totals.peakStudentDebt)) +
        '. But ' + (winner === hs.laggard ? 'the one who waited ends up ahead anyway' :
        'twenty years later the one who waited is still behind') + '. So which decision actually paid? ' +
        "We're running both of them through the Blue Collar Business " + cfg.years + '-Year Test.'
      : 'Two people, same age, same starting line - one stays an employee, one builds a business. ' +
        cfg.years + ' years later the gap between them is ' + moneyShort(gap) +
        ". We're running both through the Blue Collar Business " + cfg.years + '-Year Test.';

    var findings = [];
    if (hs.years > 0) {
      findings.push(hs.leader + "'s " + hs.years + '-year head start is worth about ' + moneyShort(hs.total) +
        ' by the time ' + hs.laggard + ' starts earning.');
    }
    findings.push(winner + ' finishes ahead by ' + moneyShort(gap) + ' - ' + moneyShort(wRes.totals.netWorth) +
      ' against ' + moneyShort(lRes.totals.netWorth) + '.');
    var earnMore = a.totals.careerEarnings > b.totals.careerEarnings ? A : B;
    if (earnMore !== winner) {
      findings.push(earnMore + ' earns more over the ' + cfg.years + ' years and still finishes behind. ' +
        'Gross pay is not the scoreboard.');
    }
    if (a.totals.businessEquity > 0 || b.totals.businessEquity > 0) {
      var eqLead = a.totals.businessEquity > b.totals.businessEquity ? a : b;
      findings.push('Business equity does most of the damage: ' + moneyShort(eqLead.totals.businessEquity) +
        ' of ' + eqLead.name + "'s net worth is the company itself.");
    }
    var depA = scores.a.ownerDependency, depB = scores.b.ownerDependency;
    if (depA.applicable && depB.applicable) {
      findings.push('Owner dependency splits them ' + depA.score + '/10 to ' + depB.score +
        '/10 - one of these businesses can be sold, the other mostly cannot.');
    }
    if ((depA.applicable && depA.stepBackBlocked) || (depB.applicable && depB.stepBackBlocked)) {
      findings.push((depA.stepBackBlocked ? A : B) + ' literally cannot step back from the work - the numbers ' +
        'stop working the moment they hand it over.');
    }
    findings.push(A + ' works ' + Math.round(a.totals.hours / 1000) + ',000 hours to get there; ' + B + ' works ' +
      Math.round(b.totals.hours / 1000) + ',000.');
    var wph = a.totals.wealthPerHour > b.totals.wealthPerHour ? a : b;
    findings.push('Per hour worked, ' + wph.name + ' builds ' + money(wph.totals.wealthPerHour) + ' of net worth.');
    if (a.milestones.financialFreedomAgeWithSale && b.milestones.financialFreedomAgeWithSale) {
      findings.push('Financial independence lands at ' + a.milestones.financialFreedomAgeWithSale + ' for ' + A +
        ' and ' + b.milestones.financialFreedomAgeWithSale + ' for ' + B + '.');
    }
    findings.push('Education costs ' + moneyShort(a.totals.educationTotalCost) + ' against ' +
      moneyShort(b.totals.educationTotalCost) + ' once you count the interest.');

    var verdict = winner + ' comes out ahead on this one - ' + moneyShort(wRes.totals.netWorth) + ' against ' +
      moneyShort(lRes.totals.netWorth) + ' after ' + cfg.years + ' years. But read why before you take that as advice. ' +
      (hs.years > 0 && winner === hs.leader
        ? hs.leader + ' did not win on income - ' + (a.totals.careerEarnings > b.totals.careerEarnings ? A : B) +
          ' out-earned them. They won on time: ' + hs.years + ' extra years of earning, no education debt, and ' +
          'a business built while the other one was still in school. '
        : winner + ' won on income and kept enough of it to matter. ') +
      'Change the assumptions and you change the answer. ' + flipCondition(winner, loser, wRes, lRes) + ' ' +
      'The point of the ' + cfg.years + '-Year Test is not to crown a trade. It is to show that the decision is ' +
      'never just what the job pays - it is what you earn, what it cost to get in, what you kept, how many hours ' +
      'it took, and whether you finished with an asset or just a good income. Learn the trade, build the business, ' +
      'own the asset.';

    return {
      titles: titles, thumbnails: thumbs, hook: hook,
      findings: findings.slice(0, 10), verdict: verdict
    };
  }

  /* What would actually have to change for the result to reverse. Has to
     be checked against the run: telling the audience the loser could
     "build a business instead" when they already built one is the kind
     of error that costs the channel its credibility. */
  function flipCondition(winner, loser, wRes, lRes) {
    var bits = [];
    if (!lRes.isOwner) {
      bits.push('If ' + loser + ' builds a business instead of staying employed, this flips.');
    } else if (lRes.totals.businessEquity < wRes.totals.businessEquity) {
      bits.push('If ' + loser + " grows the business harder - or buys a second location instead of one - the gap closes fast.");
    } else {
      bits.push('If ' + loser + ' can get the business off their own back so it keeps earning without them, this flips.');
    }
    if (wRes.isOwner) {
      bits.push('If ' + winner + "'s business never gets past being a one-truck operation, it flips harder the other way.");
    } else {
      bits.push('And if ' + winner + ' never gets the raises this assumes, it narrows just as quickly.');
    }
    return bits.join(' ');
  }

  /* ---------------------------------------------------------------
     EXECUTIVE SUMMARY - the short version, for the top of the report.
     --------------------------------------------------------------- */
  function executiveSummary(sim, scores) {
    var a = sim.a, b = sim.b, cfg = sim.cfg;
    var winner = scores.netWorthWinner;
    var gap = Math.abs(a.totals.netWorth - b.totals.netWorth);
    var hs = sim.headStart;
    var lines = [];
    lines.push('Over ' + cfg.years + ' years from age ' + cfg.startAge + ' to ' + (cfg.startAge + cfg.years) +
      ', on ' + sim.scenario.label.toLowerCase() + ' assumptions, ' +
      (winner ? winner + ' finishes with the higher estimated net worth by ' + money(gap) + '.'
              : 'the two finish level on estimated net worth.'));
    if (hs.years > 0) {
      lines.push(hs.leader + ' earns for ' + hs.years + ' years before ' + hs.laggard +
        ' earns a professional income, a head start worth roughly ' + money(hs.total) + '.');
    }
    lines.push(a.name + ' scores ' + scores.a.score + '/100 on the Blue Collar Business score against ' +
      scores.b.score + '/100 for ' + b.name + '.');
    lines.push('Data confidence: ' + scores.confidenceA.level + ' for ' + a.name + ', ' +
      scores.confidenceB.level + ' for ' + b.name + '. Every figure here is a model output, not a measurement.');
    return lines;
  }


  /* ---------------------------------------------------------------
     EPISODE SCRIPT
     The comparison, broken into beats you can narrate one at a time.
     Numbers are rounded to something a person can actually say out
     loud - the slide carries the exact figure, the script carries the
     spoken one. Durations are estimated from word count at roughly
     155 words a minute, which is a relaxed on-camera pace.
     --------------------------------------------------------------- */
  function say(v) {
    var a = Math.abs(v);
    if (a >= 1e6) { return (v < 0 ? '-' : '') + '$' + (a / 1e6).toFixed(a >= 1e7 ? 1 : 2) + ' million'; }
    if (a >= 1e5) { return (v < 0 ? '-' : '') + '$' + Math.round(a / 1000) + ',000'; }
    if (a >= 1e4) { return (v < 0 ? '-' : '') + '$' + (Math.round(a / 1000)) + ',000'; }
    if (a >= 1e3) { return (v < 0 ? '-' : '') + '$' + (Math.round(a / 100) * 100).toLocaleString(); }
    return (v < 0 ? '-' : '') + '$' + Math.round(a).toLocaleString();
  }

  function beatSeconds(lines) {
    var words = lines.join(' ').split(/\s+/).filter(Boolean).length;
    return Math.max(8, Math.round(words / 2.58) + 2);
  }

  function episodeScript(sim, scores) {
    var a = sim.a, b = sim.b, cfg = sim.cfg;
    var A = a.name, B = b.name;
    var endAge = cfg.startAge + cfg.years;
    var hs = sim.headStart;
    var yt = youtube(sim, scores);
    var winner = scores.netWorthWinner;
    var loser = winner === A ? B : A;
    var wRes = winner === A ? a : b;
    var lRes = winner === A ? b : a;
    var gap = Math.abs(a.totals.netWorth - b.totals.netWorth);
    var earnMore = a.totals.careerEarnings > b.totals.careerEarnings ? a : b;
    var depA = scores.a.ownerDependency, depB = scores.b.ownerDependency;

    var beats = [];
    function beat(id, kind, title, kicker, lines) {
      beats.push({ id: id, kind: kind, title: title, kicker: kicker, lines: lines,
                   seconds: beatSeconds(lines) });
    }

    beat('brand', 'brand', 'Blue Collar Business',
      'Learn the trade. Build the business. Own the asset.',
      ['Welcome to Blue Collar Business.',
       'This channel is about one idea: a trade is not the ceiling, it is the entry point. ' +
         'You learn the trade, you build the business, and eventually you own an asset that ' +
         'works whether you show up or not.',
       'And the way we test that idea is the 20-Year Test. We take two careers, start them at ' +
         'the same age, run them side by side, and count everything - not just the salary. ' +
         'What you earned, what it cost to get in, what you kept, how many hours it took, and ' +
         'whether you finished with a business or just a good income.',
       'Today: ' + A + ' against ' + B + '.']);

    beat('open', 'title', A + ' vs ' + B,
      'The ' + cfg.years + '-Year Test',
      [yt.hook,
       'Same starting age. Same city. Same assumptions about tax, inflation and returns.',
       'The only thing that changes is the career decision.']);

    beat('setup', 'setup', 'The setup', 'What we are holding constant',
      ['Both of them start at ' + cfg.startAge + '. We run it for ' + cfg.years + ' years, to age ' + endAge + '.',
       'Same province, same tax model, same inflation, same investment return, same house.',
       'That is deliberate. If I let the house or the market differ between them, I would be measuring something other than the career.']);

    if (hs.years > 0) {
      beat('headstart', 'headstart', 'The head start', hs.leader + ' banks ' + say(hs.total),
        ['Here is the part almost nobody puts a number on.',
         hs.leader + ' is earning a full wage for ' + hs.years + ' years before ' + hs.laggard + ' earns a professional income at all.',
         'In that window ' + hs.leader + ' takes home about ' + say(hs.incomeEarned) + ' and has roughly ' + say(hs.investmentsAccumulated) + ' banked and invested.',
         hs.debtAvoided > 1000
           ? 'And they avoid about ' + say(hs.debtAvoided) + ' of education debt that the other one is carrying.'
           : 'And they do it without borrowing to get there.',
         'Call it ' + say(hs.total) + ' of head start before the other career even starts.']);
    }

    beat('education', 'education', 'What the education cost', 'Including the interest',
      ['Education is not just tuition. It is tuition, plus the years you were not earning, plus the interest on what you borrowed.',
       'All in, that is ' + say(a.totals.educationTotalCost) + ' for ' + A + ' and ' + say(b.totals.educationTotalCost) + ' for ' + B + '.',
       (Math.max(a.totals.peakStudentDebt, b.totals.peakStudentDebt) > 5000
         ? 'Peak debt hits ' + say(Math.max(a.totals.peakStudentDebt, b.totals.peakStudentDebt)) + '. That balance is growing the whole time it is waiting to be paid.'
         : 'Neither of them takes on serious debt to get qualified.')]);

    beat('earnings', 'chart:personalIncome', 'What they actually earn', 'Year by year',
      ['Now watch the income.',
       earnMore.name + ' out-earns the other one over the ' + cfg.years + ' years, by about ' +
         say(Math.abs(a.totals.careerEarnings - b.totals.careerEarnings)) + ' in gross pay.',
       'Hold on to that, because gross pay is the number everybody quotes and it is not the number that decides this.']);

    beat('investments', 'chart:investments', 'The bank balance', 'Cash and investments only',
      ['This is just cash and investments. No house, no business.',
       sim.crossoverInvestments
         ? 'They cross over at age ' + sim.crossoverInvestments.age + '. That is the moment the higher income finally overtakes the earlier start.'
         : 'They never cross over. The earlier start compounds faster than the higher income can catch it.',
       'The gap you see early on is the head start doing its work in a brokerage account.']);

    beat('business', 'business', 'The business', 'Where the real money is made',
      [(a.isOwner || b.isOwner)
        ? 'This is where a career comparison usually stops, and it should not.'
        : 'Neither of these two builds a business, which is worth saying out loud.',
       a.isOwner ? A + ' starts a business at ' + a.milestones.businessStartAge + '.' : A + ' stays an employee the whole way.',
       b.isOwner ? B + ' starts one at ' + b.milestones.businessStartAge + '.' : B + ' stays an employee the whole way.',
       (a.totals.businessEquity > 0 || b.totals.businessEquity > 0)
         ? 'By the end, that is ' + say(a.totals.businessEquity) + ' of business equity for ' + A + ' and ' + say(b.totals.businessEquity) + ' for ' + B + '.'
         : 'So there is no business equity on either side of this one.']);

    if (depA.applicable || depB.applicable) {
      var stuck = (depA.applicable && depA.stepBackBlocked) ? A : ((depB.applicable && depB.stepBackBlocked) ? B : null);
      beat('dependency', 'dependency', 'Owner dependency', 'Can it run without you?',
        ['But not all businesses are the same asset, and this is the score I care most about.',
         'Ten means the company keeps producing when the owner stops. One means it stops dead.',
         (depA.applicable && depB.applicable)
           ? A + ' scores ' + depA.score + ' out of ten. ' + B + ' scores ' + depB.score + '.'
           : (depA.applicable ? A + ' scores ' + depA.score + ' out of ten.' : B + ' scores ' + depB.score + ' out of ten.'),
         stuck
           ? stuck + ' literally cannot step back. The moment they hand the work to employees, what is left will not cover the bank and a liveable draw.'
           : 'That difference is the difference between owning an asset and owning a job.',
         'A business that only works while you are in it is a job with extra paperwork.']);
    }

    beat('networth', 'chart:netWorth', 'Net worth over time', 'Everything owned, less everything owed',
      ['Put all of it together and this is the shape of the two lives.',
       sim.crossoverNetWorth
         ? (sim.crossoverNetWorth.passer + ' passes ' + sim.crossoverNetWorth.passed + ' at age ' + sim.crossoverNetWorth.age +
            (sim.crossoverNetWorthProjected ? ', which is past the end of our window, so treat that as a projection.' : '.'))
         : 'They never cross. On these assumptions the gap never closes.',
       'Notice where each line bends. Those bends are decisions, not luck.']);

    beat('wealth', 'columns', 'Wealth at year ' + cfg.years, 'Age ' + endAge,
      ['So here is the scoreboard at ' + endAge + '.',
       A + ' finishes at ' + say(a.totals.netWorth) + '. ' + B + ' finishes at ' + say(b.totals.netWorth) + '.',
       (winner ? winner + ' is ahead by about ' + say(gap) + '.' : 'They finish level.'),
       (winner && earnMore.name !== winner)
         ? 'And read that against the income slide, because ' + earnMore.name + ' earned more and still finished behind.'
         : 'Which is roughly what the income slide told us it would be.']);

    beat('hours', 'hours', 'What it cost in hours', 'The number nobody counts',
      ['Money is only half of it. Here is the time.',
       A + ' works about ' + Math.round(a.totals.hours / 1000) + ' thousand hours over the period. ' + B + ' works about ' + Math.round(b.totals.hours / 1000) + ' thousand.',
       'Per hour on the clock, that is ' + say(a.totals.wealthPerHour) + ' of net worth for ' + A + ' and ' + say(b.totals.wealthPerHour) + ' for ' + B + '.',
       'That is a very different way to rank two careers, and I think it is a fairer one.']);

    beat('lifestyle', 'radar', 'The life around the money', 'Eight components, out of ten',
      ['Hours, vacation, stress, physical wear, flexibility, security, family time.',
       'Further out is better on every axis, including physical demands, where ten means the work is easy on your body.',
       'Neither shape is better. They are different trades, and you have to know which one you can live inside for twenty years.']);

    beat('freedom', 'freedom', 'When they get free', 'Selling the business, drawing at ' + Math.round(cfg.safeWithdrawal * 100) + '%',
      ['Financial independence. Sell the business, live off the proceeds.',
       (a.milestones.financialFreedomAgeWithSale ? A + ' gets there around ' + a.milestones.financialFreedomAgeWithSale + '.' : A + ' does not get there on these numbers.'),
       (b.milestones.financialFreedomAgeWithSale ? B + ' gets there around ' + b.milestones.financialFreedomAgeWithSale + '.' : B + ' does not get there on these numbers.'),
       'Keeping the business instead of selling it pushes that later, because only the profit that survives you stepping away is income you can count on.']);

    beat('scores', 'scores', 'The Blue Collar Business score', 'Out of one hundred',
      ['We score both of them out of a hundred. Financial outcome is the biggest single weight, but it is only a quarter of it.',
       A + ' comes out at ' + scores.a.score + '. ' + B + ' at ' + scores.b.score + '.',
       'And underneath that are the four that matter to this channel. Career, owner-operator, business owner, investor.',
       'That is the whole progression. Do the work, lead the work, own the work, own the asset.']);

    beat('categories', 'categories', 'Winner by category', 'Because one number hides the trade',
      ['One number always hides something, so here it is broken apart.',
       'Income, lifestyle, debt, entrepreneurship, scalability, time freedom, net worth.',
       'Almost nobody wins all of them, and the ones you lose are the ones you have to be honest with yourself about.']);

    beat('scenarios', 'scenarios', 'If I am wrong', 'Conservative, realistic, aggressive',
      ['Now let me argue against myself.',
       'Conservative assumes slower raises, weaker markets, a business that grows but never takes off.',
       'On conservative, ' + (scenarioLead(sim, scores) || 'the answer gets a lot closer') + '.',
       'I quote the realistic number. But the conservative number is the one I would plan around.']);

    beat('verdict', 'verdict', 'The ' + cfg.years + '-year verdict', winner || 'Too close to call',
      [yt.verdict]);

    beat('outro', 'outro', 'Run your own numbers',
      '',
      ['Here is what I would take away from this one.',
       'The job you pick matters. But what you do with it after year five matters more, and ' +
         'almost nobody runs those numbers before they commit twenty years to an answer.',
       'So run yours. Change the wage to what they actually pay where you live. Change the ' +
         'business to the one you would actually start. See whether the answer holds.',
       'If you want the next one, subscribe - we run a different pair every episode, and the ' +
         'ones that surprise me are the ones I put out first.',
       'Learn the trade. Build the business. Own the asset. See you next time.']);

    return {
      beats: beats,
      totalSeconds: beats.reduce(function (t, x) { return t + x.seconds; }, 0),
      titles: yt.titles,
      thumbnails: yt.thumbnails
    };
  }

  /* One line on how the conservative case reads, for the scenario beat.
     Filled in by the caller when it has the scenario runs; falls back to
     something true but unspecific rather than inventing a figure. */
  var scenarioNote = null;
  function setScenarioNote(text) { scenarioNote = text; }
  function scenarioLead() { return scenarioNote; }

  BCB.narrative = {
    analysis: analysis, youtube: youtube, executiveSummary: executiveSummary,
    episodeScript: episodeScript, setScenarioNote: setScenarioNote,
    money: money, moneyShort: moneyShort, say: say
  };

})(typeof window !== 'undefined' ? window : globalThis);
