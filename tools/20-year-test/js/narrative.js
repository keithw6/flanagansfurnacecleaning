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
  function youtube(sim, scores, seed) {
    var pk = makePicker(seed || 0, 'yt');
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

    var peakDebt = moneyShort(Math.max(a.totals.peakStudentDebt, b.totals.peakStudentDebt));
    var waitedWins = winner === hs.laggard;
    var hook = hs.years > 0
      ? pk(
          'One of them starts earning at ' + cfg.startAge + '. The other spends ' + hs.years +
            ' years in school first and comes out owing ' + peakDebt + '. But ' +
            (waitedWins ? 'the one who waited ends up ahead anyway' : cfg.years + ' years later the one who waited is still behind') +
            ". So which decision actually paid? We're running both of them through the Blue Collar Business " +
            cfg.years + '-Year Test.',
          'Here\'s a question I get asked a lot. Is it smarter to go to school for ' + hs.years +
            ' years and come out as a ' + hs.laggard.toLowerCase() + ', or start earning at ' + cfg.startAge +
            ' as a ' + hs.leader.toLowerCase() + '? Everyone has an opinion. Almost nobody has done the math. ' +
            'So I did the math. ' + cfg.years + ' years, both careers, everything counted.',
          'A ' + hs.leader.toLowerCase() + ' and a ' + hs.laggard.toLowerCase() + ' start at ' + cfg.startAge +
            '. One of them is earning by next week. The other is ' + hs.years + ' years and ' + peakDebt +
            ' of debt away from their first real paycheque. ' +
            (waitedWins ? 'And the one who waited still wins. Or does it?' : 'And here\'s the thing - the head start never gets caught.') +
            ' Let\'s run it.',
          'I want to show you something that changed how I think about careers. Not salaries - anyone can look up a salary. ' +
            'What a career actually leaves you with after ' + cfg.years + ' years. Today it\'s ' + A + ' against ' + B +
            ', and I think the answer is going to surprise some of you.'
        )
      : pk(
          'Two people, same age, same starting line - one stays an employee, one builds a business. ' +
            cfg.years + ' years later the gap between them is ' + moneyShort(gap) +
            ". We're running both through the Blue Collar Business " + cfg.years + '-Year Test.',
          'Same trade. Same start date. Same wages for the first few years. The only difference is that one of them ' +
            'starts a company and the other one doesn\'t. ' + cfg.years + ' years on, they\'re ' + moneyShort(gap) +
            ' apart. Let me show you where that gap comes from.',
          'What\'s a business actually worth to the person who builds it? Not in theory - in dollars, after ' +
            cfg.years + ' years, against the exact same career as an employee. That\'s today\'s test.'
        );

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

    var earnedMore = a.totals.careerEarnings > b.totals.careerEarnings ? A : B;
    var wonOnTime = hs.years > 0 && winner === hs.leader;
    var verdict =
      pk(
        winner + ' comes out ahead on this one - ' + moneyShort(wRes.totals.netWorth) + ' against ' +
          moneyShort(lRes.totals.netWorth) + ' after ' + cfg.years + ' years. But read why before you take that as advice. ',
        'So. ' + winner + ' wins. ' + moneyShort(wRes.totals.netWorth) + ' to ' + moneyShort(lRes.totals.netWorth) +
          '. Before anyone runs off and quits their job, let me tell you why, because the why matters more than the number. ',
        'The scoreboard says ' + winner + ', by about ' + moneyShort(gap) + '. That\'s the headline. ' +
          'Here\'s the part the headline leaves out. '
      ) +
      (wonOnTime
        ? pk(
            hs.leader + ' did not win on income - ' + earnedMore + ' out-earned them. They won on time: ' + hs.years +
              ' extra years of earning, no education debt, and a business built while the other one was still in school. ',
            hs.leader + ' never had the bigger paycheque. ' + earnedMore + ' earned more, and it wasn\'t close. ' +
              'What ' + hs.leader + ' had was ' + hs.years + ' years - ' + hs.years + ' years of wages, of compounding, of no ' +
              'student loan, and a business already running by the time the other one graduated. ',
            'This wasn\'t a salary win. It was a calendar win. ' + hs.leader + ' started ' + hs.years + ' years earlier, ' +
              'and in this model that head start is worth more than ' + earnedMore + '\'s higher pay ever catches up to. '
          )
        : pk(
            winner + ' won on income and kept enough of it to matter. ',
            winner + ' simply earned more and hung on to enough of it. Sometimes it really is that straightforward. ',
            'This one, ' + winner + ' earned the win the boring way - more money in, enough of it kept. '
          )) +
      pk(
        'Change the assumptions and you change the answer. ',
        'And I want to be honest with you: move a couple of the inputs and this flips. ',
        'Now - none of this is carved in stone. '
      ) +
      flipCondition(winner, loser, wRes, lRes) + ' ' +
      pk(
        'The point of the ' + cfg.years + '-Year Test is not to crown a trade. It is to show that the decision is ' +
          'never just what the job pays - it is what you earn, what it cost to get in, what you kept, how many hours ' +
          'it took, and whether you finished with an asset or just a good income. Learn the trade, build the business, own the asset.',
        'I don\'t run these to crown a winner. I run them because "what does it pay" is the wrong question, and almost everyone ' +
          'asks it. The right questions are what it cost to get in, what you kept, what it took out of your week, and whether ' +
          'you own anything at the end. Learn the trade. Build the business. Own the asset.',
        'That\'s the whole idea behind this channel. A job is what you do. A business is what you build. An asset is what ' +
          'you own when you stop. Pick the career that gets you to the third one. Learn the trade, build the business, own the asset.'
      );

    var names = [A, B];
    return {
      titles: titles, thumbnails: thumbs,
      hook: humanise(hook, names),
      findings: findings.slice(0, 10).map(function (f) { return humanise(f, names); }),
      verdict: humanise(verdict, names)
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
     WORDING VARIANTS
     Every line of the script has two to four genuinely different
     phrasings - different rhythm and structure, not swapped synonyms.
     A seeded pick keeps a comparison stable across reloads, and
     "reshuffle" bumps the seed so the whole episode re-rolls. The
     point is that no two episodes open the same way, and none of them
     read like a form letter.
     --------------------------------------------------------------- */
  function hash(str) {
    var h = 2166136261;
    for (var i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }
  /* People say "the plumber", not "Plumber". Career names arrive as
     labels - "Plumber", "Accountant (CPA)", "Plumber (employee)" - and
     in spoken prose they need an article, lower case, and the bracket
     turned into words. Done once here, on the finished sentence, so the
     seventy lines that mention a name do not each have to remember. */
  function spokenForm(name) {
    var m = name.match(/^(.*?)\s*\((.*?)\)\s*$/);
    var base = m ? m[1] : name;
    var tag = m ? m[2].toLowerCase() : '';
    /* Keep initialisms; lower-case ordinary words. */
    var words = base.split(' ').map(function (w) {
      return /^[A-Z]{2,}$/.test(w.replace(/[^A-Za-z]/g, '')) ? w : w.toLowerCase();
    }).join(' ');
    if (tag === 'employee' || tag === 'owner') { return 'the ' + words + ' as an ' + tag; }
    return 'the ' + words;
  }
  function humanise(text, names) {
    if (!text) { return text; }
    names.forEach(function (n) {
      if (!n) { return; }
      var spoken = spokenForm(n);
      var Spoken = spoken.charAt(0).toUpperCase() + spoken.slice(1);
      var escd = n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      /* Sentence start gets a capital; anywhere else, lower case.
         A trailing possessive rides along either way. */
      text = text.replace(new RegExp('(^|[.!?]\\s+|:\\s+)' + escd + '(?!\\w)', 'g'), function (_, pre) { return pre + Spoken; });
      text = text.replace(new RegExp('(^|[^\\w])' + escd + '(?!\\w)', 'g'), function (_, pre) { return pre + spoken; });
    });
    return text;
  }

  function makePicker(seed, scope) {
    var n = 0;
    return function pick() {
      var opts = Array.prototype.slice.call(arguments);
      if (opts.length === 1 && Array.isArray(opts[0])) { opts = opts[0]; }
      var i = hash(scope + '|' + seed + '|' + (n++)) % opts.length;
      return opts[i];
    };
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

  function episodeScript(sim, scores, seed) {
    var pk = makePicker(seed || 0, 'ep');
    var a = sim.a, b = sim.b, cfg = sim.cfg;
    var A = a.name, B = b.name;
    var al = A.toLowerCase(), bl = B.toLowerCase();
    var endAge = cfg.startAge + cfg.years;
    var hs = sim.headStart;
    var yt = youtube(sim, scores, seed);
    var winner = scores.netWorthWinner;
    var wRes = winner === A ? a : b;
    var lRes = winner === A ? b : a;
    var gap = Math.abs(a.totals.netWorth - b.totals.netWorth);
    var earnMore = a.totals.careerEarnings > b.totals.careerEarnings ? a : b;
    var depA = scores.a.ownerDependency, depB = scores.b.ownerDependency;
    var peakDebt = Math.max(a.totals.peakStudentDebt, b.totals.peakStudentDebt);

    var beats = [];
    var names = [A, B];
    function beat(id, kind, title, kicker, lines) {
      lines = lines.filter(Boolean).map(function (l) { return humanise(l, names); });
      beats.push({ id: id, kind: kind, title: title, kicker: kicker, lines: lines, seconds: beatSeconds(lines) });
    }

    /* ---- intro: who we are, who is on the block ---- */
    beat('brand', 'brand', 'Blue Collar Business',
      'Learn the trade. Build the business. Own the asset.',
      [pk('Welcome to Blue Collar Business.',
          'Hey - welcome back to Blue Collar Business.',
          'This is Blue Collar Business. If you\'re new here, here\'s the idea in one breath.'),
       pk('This channel is about one idea: a trade is not the ceiling, it\'s the entry point. You learn the trade, you build the business, and eventually you own an asset that works whether you show up or not.',
          'Everything on this channel comes back to one thing. A trade is a starting line, not a finish line. Learn it, build a business on it, and end up owning something that pays you whether you\'re on the tools or not.',
          'The whole channel is built on a simple progression. Learn the trade. Build the business. Own the asset. Most people stop at the first step and never find out what the other two are worth.'),
       pk('And the way we test that idea is the ' + cfg.years + '-Year Test. Two careers, same starting age, run side by side, and we count everything - not just the salary. What you earned, what it cost to get in, what you kept, how many hours it took, and whether you finished with a business or just a good income.',
          'To test it, we run something I call the ' + cfg.years + '-Year Test. Take two careers, start them at the same age, and follow both for ' + cfg.years + ' years counting everything. Not just pay - what it cost to get in, what you kept, the hours, and whether there\'s an asset at the end.',
          'So we built a test. Two careers, same age, ' + cfg.years + ' years. And we don\'t stop at salary, because salary is the least interesting number in the whole thing. We count the debt, the tax, the hours, and what you actually own at the end.'),
       pk('Today: ' + A + ' against ' + B + '.',
          'Today it\'s ' + A + ' versus ' + B + '. Let\'s go.',
          'On the block today - the ' + al + ' and the ' + bl + '.')]);

    /* ---- the hook ---- */
    beat('open', 'title', A + ' vs ' + B, 'The ' + cfg.years + '-Year Test',
      [yt.hook,
       pk('Same starting age. Same city. Same assumptions about tax, inflation and returns.',
          'Same age, same town, same tax rules, same market returns. I\'ve held all of that still on purpose.',
          'Everything that isn\'t the career is identical - the age they start, the city, the tax, what the market does.'),
       pk('The only thing that changes is the career decision.',
          'The one variable is the choice. That\'s it.',
          'So whatever gap shows up at the end, the career did that.')]);

    /* ---- what we hold constant ---- */
    beat('setup', 'setup', 'The setup', 'What we\'re holding constant',
      [pk('Both of them start at ' + cfg.startAge + '. We run it for ' + cfg.years + ' years, to age ' + endAge + '.',
          'Two people, both ' + cfg.startAge + ' years old. We follow them to ' + endAge + '.',
          'Start age ' + cfg.startAge + ', finish at ' + endAge + '. ' + cfg.years + ' years, start to finish.'),
       pk('Same province, same tax model, same inflation, same investment return, same house.',
          'They live in the same place, pay the same tax, get the same return on their investments, and - this matters - they buy the same house.',
          'Same tax. Same inflation. Same returns. And I gave them the exact same house, because the house is not the thing I\'m testing.'),
       pk('That\'s deliberate. If I let the house or the market differ between them, I\'d be measuring something other than the career.',
          'If I let any of that vary I\'d be comparing two lives, not two careers. So it all stays fixed.',
          'The moment one of them gets a cheaper house or a luckier decade in the market, the comparison is meaningless. So they don\'t.')]);

    /* ---- head start ---- */
    if (hs.years > 0) {
      beat('headstart', 'headstart', 'The head start', hs.leader + ' banks ' + say(hs.total),
        [pk('Here\'s the part almost nobody puts a number on.',
            'This is the slide I built the whole test around.',
            'Okay. This is the one people underestimate.'),
         pk(hs.leader + ' is earning a full wage for ' + hs.years + ' years before ' + hs.laggard + ' earns a professional income at all.',
            'For ' + hs.years + ' straight years, ' + hs.leader + ' is getting paid and ' + hs.laggard + ' is paying tuition.',
            'While ' + hs.laggard + ' is in school, ' + hs.leader + ' is on the clock. ' + hs.years + ' years of that.'),
         pk('In that window ' + hs.leader + ' takes home about ' + say(hs.incomeEarned) + ' and has roughly ' + say(hs.investmentsAccumulated) + ' banked and invested.',
            'Add it up and ' + hs.leader + ' has earned around ' + say(hs.incomeEarned) + ' in that time, with something like ' + say(hs.investmentsAccumulated) + ' actually sitting in the bank.',
            say(hs.incomeEarned) + ' earned. ' + say(hs.investmentsAccumulated) + ' kept and invested. All before the other one has a job.'),
         hs.debtAvoided > 1000
           ? pk('And they avoid about ' + say(hs.debtAvoided) + ' of education debt that the other one is carrying.',
                'Meanwhile ' + hs.laggard + ' is carrying roughly ' + say(hs.debtAvoided) + ' of debt that ' + hs.leader + ' simply never took on.',
                'Oh - and there\'s no loan. ' + hs.laggard + ' is ' + say(hs.debtAvoided) + ' in the hole by comparison.')
           : pk('And they do it without borrowing to get there.', 'No debt to get there, either.'),
         pk('Call it ' + say(hs.total) + ' of head start before the other career even starts.',
            'All in, that\'s about ' + say(hs.total) + ' of head start. Before the race even begins.',
            'Put a number on it: ' + say(hs.total) + '. That\'s the gap on day one of ' + hs.laggard + '\'s career.')]);
    }

    /* ---- education ---- */
    beat('education', 'education', 'What the education cost', 'Including the interest',
      [pk('Education isn\'t just tuition. It\'s tuition, plus the years you weren\'t earning, plus the interest on what you borrowed.',
          'People think education costs whatever the tuition is. It doesn\'t. It costs tuition, plus every year you weren\'t earning, plus interest.',
          'Tuition is the sticker price. The real price is tuition plus lost years plus interest, and it\'s a lot bigger.'),
       pk('All in, that\'s ' + say(a.totals.educationTotalCost) + ' for ' + A + ' and ' + say(b.totals.educationTotalCost) + ' for ' + B + '.',
          'For ' + A + ' the whole thing comes to about ' + say(a.totals.educationTotalCost) + '. For ' + B + ', ' + say(b.totals.educationTotalCost) + '.',
          say(a.totals.educationTotalCost) + ' versus ' + say(b.totals.educationTotalCost) + '. ' + A + ' first, ' + B + ' second.'),
       peakDebt > 5000
         ? pk('Peak debt hits ' + say(peakDebt) + '. That balance is growing the whole time it\'s waiting to be paid.',
              'At the worst point the debt is ' + say(peakDebt) + ' - and it\'s compounding while they\'re still in class.',
              'The loan peaks at ' + say(peakDebt) + '. Interest doesn\'t wait for graduation.')
         : pk('Neither of them takes on serious debt to get qualified.', 'No real debt on either side here, which is rarer than it should be.')]);

    /* ---- earnings ---- */
    beat('earnings', 'chart:personalIncome', 'What they actually earn', 'Year by year',
      [pk('Now watch the income.', 'Here\'s the pay, year by year.', 'Let\'s look at what they actually take home.'),
       pk(earnMore.name + ' out-earns the other one over the ' + cfg.years + ' years, by about ' + say(Math.abs(a.totals.careerEarnings - b.totals.careerEarnings)) + ' in gross pay.',
          'Over ' + cfg.years + ' years, ' + earnMore.name + ' earns more - roughly ' + say(Math.abs(a.totals.careerEarnings - b.totals.careerEarnings)) + ' more, before tax.',
          earnMore.name + ' wins on pay. Not by a little, either - ' + say(Math.abs(a.totals.careerEarnings - b.totals.careerEarnings)) + ' over the period.'),
       pk('Hold on to that, because gross pay is the number everybody quotes and it\'s not the number that decides this.',
          'Remember that number. Everyone leads with it, and it turns out not to be the one that matters.',
          'That\'s the figure you\'d see in a job ad. Keep it in your head - we\'re about to find out how much of it survives.')]);

    /* ---- investments ---- */
    beat('investments', 'chart:investments', 'The bank balance', 'Cash and investments only',
      [pk('This is just cash and investments. No house, no business.',
          'Strip out the house and the business and this is what\'s left - money in accounts.',
          'Pure liquid money here. Nothing you\'d have to sell.'),
       sim.crossoverInvestments
         ? pk('They cross over at age ' + sim.crossoverInvestments.age + '. That\'s the moment the higher income finally overtakes the earlier start.',
              'Watch age ' + sim.crossoverInvestments.age + '. That\'s where the bigger paycheque finally catches the head start.',
              'The lines cross at ' + sim.crossoverInvestments.age + '. Everything before that is the head start winning; everything after is income winning.')
         : pk('They never cross over. The earlier start compounds faster than the higher income can catch it.',
              'And they don\'t cross. Not in ' + cfg.years + ' years. The early money keeps compounding faster than the late money arrives.',
              'No crossover. The head start just keeps pulling away.'),
       pk('The gap you see early on is the head start doing its work in a brokerage account.',
          'That early gap? That\'s the head start, sitting in an index fund, doing what compounding does.',
          'Early on, that\'s not skill or effort. It\'s time in the market.')]);

    /* ---- business ---- */
    beat('business', 'business', 'The business', 'Where the real money is made',
      [(a.isOwner || b.isOwner)
        ? pk('This is where a career comparison usually stops, and it shouldn\'t.',
             'Most career comparisons end before this slide. That\'s the mistake.',
             'Here\'s the part every salary comparison leaves out.')
        : pk('Neither of these two builds a business, which is worth saying out loud.',
             'Nobody starts a company in this one. Keep that in mind, because it changes everything when someone does.'),
       a.isOwner
         ? pk(A + ' starts a business at ' + a.milestones.businessStartAge + '.', 'At ' + a.milestones.businessStartAge + ', ' + A + ' goes out on their own.', A + ' opens the doors at ' + a.milestones.businessStartAge + '.')
         : pk(A + ' stays an employee the whole way.', A + ' never leaves the paycheque.'),
       b.isOwner
         ? pk(B + ' starts one at ' + b.milestones.businessStartAge + '.', B + ' does the same at ' + b.milestones.businessStartAge + '.', 'For ' + B + ', it\'s age ' + b.milestones.businessStartAge + '.')
         : pk(B + ' stays an employee the whole way.', B + ' works for someone else start to finish.'),
       (a.totals.businessEquity > 0 || b.totals.businessEquity > 0)
         ? pk('By the end, that\'s ' + say(a.totals.businessEquity) + ' of business equity for ' + A + ' and ' + say(b.totals.businessEquity) + ' for ' + B + '.',
              'And by the finish line the business itself is worth ' + say(a.totals.businessEquity) + ' to ' + A + ' and ' + say(b.totals.businessEquity) + ' to ' + B + ', after what\'s owed on it.',
              'Business equity at ' + endAge + ': ' + say(a.totals.businessEquity) + ' and ' + say(b.totals.businessEquity) + '. That\'s money that doesn\'t exist for an employee.')
         : pk('So there\'s no business equity on either side of this one.', 'Zero business equity, both sides. Which is the point.')]);

    /* ---- dependency ---- */
    if (depA.applicable || depB.applicable) {
      var stuck = (depA.applicable && depA.stepBackBlocked) ? A : ((depB.applicable && depB.stepBackBlocked) ? B : null);
      beat('dependency', 'dependency', 'Owner dependency', 'Can it run without you?',
        [pk('But not all businesses are the same asset, and this is the score I care most about.',
            'Now - two businesses can be worth the same on paper and be completely different things to own. This score is how I tell them apart.',
            'This is my favourite number in the whole test, and almost nobody tracks it.'),
         pk('Ten means the company keeps producing when the owner stops. One means it stops dead.',
            'It\'s out of ten. Ten, the business runs without you. One, the business is you.',
            'Simple scale. Ten: you could take a month off. One: if you stop, the revenue stops.'),
         (depA.applicable && depB.applicable)
           ? pk(A + ' scores ' + depA.score + ' out of ten. ' + B + ' scores ' + depB.score + '.',
                A + ': ' + depA.score + '. ' + B + ': ' + depB.score + '.',
                'It\'s ' + depA.score + ' for ' + A + ' and ' + depB.score + ' for ' + B + '.')
           : (depA.applicable ? A + ' scores ' + depA.score + ' out of ten.' : B + ' scores ' + depB.score + ' out of ten.'),
         stuck
           ? pk(stuck + ' literally cannot step back. The moment they hand the work to employees, what\'s left won\'t cover the bank and a liveable draw.',
                'And here\'s the trap: ' + stuck + ' can\'t get out. Hand the work to staff and the numbers stop working - the loan doesn\'t get paid and neither do they.',
                stuck + ' is stuck in it. The business only makes money while they personally do the work. Try to step back and it falls over.')
           : pk('That difference is the difference between owning an asset and owning a job.',
                'That gap is what separates a business you can sell from a job you happen to own.'),
         pk('A business that only works while you\'re in it is a job with extra paperwork.',
            'If it only runs while you\'re there, you didn\'t build a business. You built a job with a payroll.',
            'Owning a job is fine. Just don\'t confuse it with owning an asset.')]);
    }

    /* ---- net worth chart ---- */
    beat('networth', 'chart:netWorth', 'Net worth over time', 'Everything owned, less everything owed',
      [pk('Put all of it together and this is the shape of the two lives.',
          'Add it all up - house, business, investments, minus every debt - and this is what you get.',
          'This is everything. Every asset, every liability, both careers, ' + cfg.years + ' years.'),
       sim.crossoverNetWorth
         ? pk(sim.crossoverNetWorth.passer + ' passes ' + sim.crossoverNetWorth.passed + ' at age ' + sim.crossoverNetWorth.age + (sim.crossoverNetWorthProjected ? ', which is past the end of our window, so treat that as a projection.' : '.'),
              'The lines cross at ' + sim.crossoverNetWorth.age + ' - that\'s ' + sim.crossoverNetWorth.passer + ' going past ' + sim.crossoverNetWorth.passed + (sim.crossoverNetWorthProjected ? '. That\'s outside the ' + cfg.years + ' years, so it\'s a projection, not a result.' : '.'))
         : pk('They never cross. On these assumptions the gap never closes.',
              'And no, they don\'t cross. Not by ' + endAge + ', and not after it either, on these numbers.',
              'No crossover. I ran it out to 75 to check. The gap holds.'),
       pk('Notice where each line bends. Those bends are decisions, not luck.',
          'Look at the kinks in the lines. Every one of those is a decision - a business started, a loan paid off, a house bought.',
          'See the bends? That\'s not the market. That\'s a choice somebody made.')]);

    /* ---- wealth columns ---- */
    beat('wealth', 'columns', 'Wealth at year ' + cfg.years, 'Age ' + endAge,
      [pk('So here\'s the scoreboard at ' + endAge + '.',
          'Final numbers. Age ' + endAge + '.',
          'Right. ' + cfg.years + ' years in, here\'s where they stand.'),
       pk(A + ' finishes at ' + say(a.totals.netWorth) + '. ' + B + ' finishes at ' + say(b.totals.netWorth) + '.',
          say(a.totals.netWorth) + ' for ' + A + '. ' + say(b.totals.netWorth) + ' for ' + B + '.',
          A + ': ' + say(a.totals.netWorth) + '. ' + B + ': ' + say(b.totals.netWorth) + '.'),
       winner
         ? pk(winner + ' is ahead by about ' + say(gap) + '.', 'That\'s ' + winner + ' up by ' + say(gap) + '.', say(gap) + ' between them, ' + winner + ' on top.')
         : 'They finish level.',
       (winner && earnMore.name !== winner)
         ? pk('And read that against the income slide, because ' + earnMore.name + ' earned more and still finished behind.',
              'Now go back to the pay chart. ' + earnMore.name + ' earned more. ' + earnMore.name + ' finished behind. Sit with that for a second.',
              'Which means the person with the bigger paycheque lost. ' + earnMore.name + ' out-earned ' + winner + ' and still ended up with less.')
         : pk('Which is roughly what the income slide told us it would be.', 'No surprise there - the pay chart called it.')]);

    /* ---- hours ---- */
    beat('hours', 'hours', 'What it cost in hours', 'The number nobody counts',
      [pk('Money is only half of it. Here\'s the time.',
          'Okay, now the cost nobody puts on a spreadsheet. Hours.',
          'Let\'s talk about the price you pay in time, because it\'s not the same for both.'),
       pk(A + ' works about ' + Math.round(a.totals.hours / 1000) + ' thousand hours over the period. ' + B + ' works about ' + Math.round(b.totals.hours / 1000) + ' thousand.',
          Math.round(a.totals.hours / 1000) + ' thousand hours for ' + A + '. ' + Math.round(b.totals.hours / 1000) + ' thousand for ' + B + '.',
          'Over ' + cfg.years + ' years ' + A + ' puts in roughly ' + Math.round(a.totals.hours / 1000) + ' thousand hours, ' + B + ' about ' + Math.round(b.totals.hours / 1000) + ' thousand.'),
       pk('Per hour on the clock, that\'s ' + say(a.totals.wealthPerHour) + ' of net worth for ' + A + ' and ' + say(b.totals.wealthPerHour) + ' for ' + B + '.',
          'Divide the net worth by the hours and you get ' + say(a.totals.wealthPerHour) + ' an hour for ' + A + ', ' + say(b.totals.wealthPerHour) + ' for ' + B + '.',
          'So every hour worked built ' + say(a.totals.wealthPerHour) + ' of wealth for ' + A + ' and ' + say(b.totals.wealthPerHour) + ' for ' + B + '.'),
       pk('That\'s a very different way to rank two careers, and I think it\'s a fairer one.',
          'I\'d argue that\'s the fairest single number in the whole test.',
          'If you only remember one metric from this video, make it that one.')]);

    /* ---- lifestyle ---- */
    beat('lifestyle', 'radar', 'The life around the money', 'Eight components, out of ten',
      [pk('Hours, vacation, stress, physical wear, flexibility, security, family time.',
          'This is the stuff that doesn\'t show up in a bank balance. Hours, holidays, stress, your body, your evenings.',
          'Eight things that decide whether you actually like your life. None of them are money.'),
       pk('Further out is better on every axis, including physical demands, where ten means the work is easy on your body.',
          'Bigger shape, better life. That includes the physical axis - ten there means the job goes easy on your knees and your back.',
          'Read it as: the more area, the better. Even the physical one - a ten means minimal wear on your body.'),
       pk('Neither shape is better. They\'re different trades, and you have to know which one you can live inside for twenty years.',
          'There\'s no winner on this slide. There\'s the shape you could live in for two decades and the shape you couldn\'t.',
          'I\'m not going to call this one. Look at the two shapes and ask which set of trade-offs you\'d actually accept.')]);

    /* ---- freedom ---- */
    beat('freedom', 'freedom', 'When they get free', 'Selling the business, drawing at ' + Math.round(cfg.safeWithdrawal * 100) + '%',
      [pk('Financial independence. Sell the business, live off the proceeds.',
          'When can each of them stop? Sell the business, invest the money, live on the returns.',
          'The retirement question. Cash out the business, and how soon does the money cover the bills?'),
       a.milestones.financialFreedomAgeWithSale
         ? pk(A + ' gets there around ' + a.milestones.financialFreedomAgeWithSale + '.', 'For ' + A + ', roughly age ' + a.milestones.financialFreedomAgeWithSale + '.')
         : A + ' doesn\'t get there on these numbers.',
       b.milestones.financialFreedomAgeWithSale
         ? pk(B + ' gets there around ' + b.milestones.financialFreedomAgeWithSale + '.', B + ', about ' + b.milestones.financialFreedomAgeWithSale + '.')
         : B + ' doesn\'t get there on these numbers.',
       pk('Keeping the business instead of selling it pushes that later, because only the profit that survives you stepping away is income you can count on.',
          'If they keep the business instead, it\'s later - because only the part of the profit that doesn\'t depend on them showing up actually counts.',
          'Hold onto the business and the date moves out. Profit that needs you in the building isn\'t retirement income.')]);

    /* ---- scores ---- */
    beat('scores', 'scores', 'The Blue Collar Business score', 'Out of one hundred',
      [pk('We score both of them out of a hundred. Financial outcome is the biggest single weight, but it\'s only a quarter of it.',
          'Everything rolls up into one score out of a hundred. Money is the biggest piece, but it\'s still only twenty-five points.',
          'One number, out of a hundred. And before anyone says it - yes, money counts. It\'s a quarter of the score, not all of it.'),
       pk(A + ' comes out at ' + scores.a.score + '. ' + B + ' at ' + scores.b.score + '.',
          scores.a.score + ' for ' + A + '. ' + scores.b.score + ' for ' + B + '.',
          A + ' scores ' + scores.a.score + ', ' + B + ' scores ' + scores.b.score + '.'),
       pk('And underneath that are the four that matter to this channel. Career, owner-operator, business owner, investor.',
          'Under the hood are the four scores this channel is really about: as an employee, as an owner-operator, as a business owner, and as an investor.',
          'The four numbers beneath it are the ones I actually care about. Employee. Owner-operator. Business owner. Investor.'),
       pk('That\'s the whole progression. Do the work, lead the work, own the work, own the asset.',
          'That\'s the ladder. Do it, lead it, own it, then own the thing that does it without you.',
          'Same progression every time. Do, lead, build, own, invest.')]);

    /* ---- categories ---- */
    beat('categories', 'categories', 'Winner by category', 'Because one number hides the trade',
      [pk('One number always hides something, so here it is broken apart.',
          'A single score always buries the trade-offs. So let\'s pull it apart.',
          'I don\'t trust one number, and neither should you. Here\'s the breakdown.'),
       pk('Income, lifestyle, debt, entrepreneurship, scalability, time freedom, net worth.',
          'Best for income. Best for lifestyle. Lowest debt. Best to start a business in. Most scalable. Most time freedom. Highest net worth.',
          'Pay, lifestyle, debt, business potential, scale, time, net worth - who wins each one.'),
       pk('Almost nobody wins all of them, and the ones you lose are the ones you have to be honest with yourself about.',
          'Nobody sweeps this. And the categories you\'d lose are exactly the ones you need to be honest about before you commit.',
          'Notice it\'s split. It\'s always split. The question is which losses you can live with.')]);

    /* ---- scenarios ---- */
    beat('scenarios', 'scenarios', 'If I\'m wrong', 'Conservative, realistic, aggressive',
      [pk('Now let me argue against myself.',
          'Okay, let me try to break my own result.',
          'Here\'s where I stress-test this, because I\'d rather do it than have you do it in the comments.'),
       pk('Conservative assumes slower raises, weaker markets, a business that grows but never takes off.',
          'The conservative case is: raises are smaller, the market underperforms, and the business is fine but never really takes off.',
          'Conservative means everything goes a bit worse. Smaller raises, a weaker decade in the market, a business that stays small.'),
       pk('On conservative, ' + (scenarioLead() || 'the answer gets a lot closer') + '.',
          'Run it that way and ' + (scenarioLead() || 'it tightens up considerably') + '.',
          'And on those numbers, ' + (scenarioLead() || 'the gap narrows') + '.'),
       pk('I quote the realistic number. But the conservative number is the one I\'d plan around.',
          'I\'ll say the realistic figure out loud. I\'d plan my life around the conservative one.',
          'Headline is the realistic case. If it were my money, I\'d budget on the conservative case.')]);

    /* ---- verdict ---- */
    beat('verdict', 'verdict', 'The ' + cfg.years + '-year verdict', winner || 'Too close to call', [yt.verdict]);

    /* ---- outro ---- */
    beat('outro', 'outro', 'Run your own numbers', '',
      [pk('Here\'s what I\'d take away from this one.',
          'So what do you do with this?',
          'Let me leave you with the thing that actually matters here.'),
       pk('The job you pick matters. But what you do with it after year five matters more, and almost nobody runs those numbers before they commit twenty years to an answer.',
          'The career matters less than what you do with it once you\'re in. That second part is where all the money is, and it\'s the part nobody models.',
          'Picking the job is maybe a third of it. What you build on top of the job is the rest, and almost nobody runs that math before they commit.'),
       pk('So run yours. Change the wage to what they actually pay where you live. Change the business to the one you\'d actually start. See whether the answer holds.',
          'So go run your own. Put in real local wages. Put in the business you\'d actually open. See if the answer survives.',
          'Do it with your own numbers. Your city\'s wages, your tuition, the business you\'d really start. Then see what twenty years looks like.'),
       pk('If you want the next one, subscribe - we run a different pair every episode, and the ones that surprise me are the ones I put out first.',
          'Subscribe if you want the next matchup. Different pair every time, and I always lead with the ones that surprised me.',
          'There\'s a new pair every episode. Hit subscribe and I\'ll show you the ones that didn\'t go the way I expected.'),
       pk('Learn the trade. Build the business. Own the asset. See you next time.',
          'Learn the trade, build the business, own the asset. See you in the next one.',
          'Learn the trade. Build the business. Own the asset. That\'s it - see you next time.')]);

    return {
      beats: beats,
      totalSeconds: beats.reduce(function (t, x) { return t + x.seconds; }, 0),
      titles: yt.titles,
      thumbnails: yt.thumbnails,
      seed: seed || 0
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
