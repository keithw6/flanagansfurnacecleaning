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

    var peakDebt = say(Math.max(a.totals.peakStudentDebt, b.totals.peakStudentDebt));
    var waitedWins = winner === hs.laggard;
    var hook = hs.years > 0
      ? pk(
          'One of them starts earning at ' + cfg.startAge + '. The other spends ' + hs.years +
            ' years in school first and comes out owing ' + peakDebt + '. ' +
            (waitedWins ? 'And the one who waited ends up ahead anyway.' : 'And ' + cfg.years + ' years later, the one who waited is still behind.') +
            ' So which choice actually paid? We\'re running both of them through the Blue Collar Business ' +
            cfg.years + '-Year Test.',
          'Here\'s a question I get asked a lot. Is it smarter to spend ' + hs.years +
            ' years in school and come out as ' + hs.laggard + '? Or start earning at ' + cfg.startAge +
            ' as ' + hs.leader + '? Everyone has an opinion. Almost nobody has done the math. ' +
            'So I did the math. ' + cfg.years + ' years. Both careers. Everything counted.',
          hs.leader + ' and ' + hs.laggard + ' both start at ' + cfg.startAge +
            '. One of them is earning by next week. The other is ' + hs.years + ' years and ' + peakDebt +
            ' of debt away from a first real paycheque. ' +
            (waitedWins ? 'And the one who waited still wins. Or do they?' : 'And here\'s the thing. The head start never gets caught.') +
            ' Let\'s run it.',
          'I want to show you something that changed how I think about careers. Not salaries. Anyone can look up a salary. ' +
            'What a career actually leaves you with after ' + cfg.years + ' years. Today it\'s ' + A + ' against ' + B +
            '. And I think the answer is going to surprise some of you.'
        )
      : pk(
          'Two people. Same age. Same starting line. One stays an employee, one builds a business. ' +
            cfg.years + ' years later, the gap between them is ' + say(gap) +
            '. We\'re running both through the Blue Collar Business ' + cfg.years + '-Year Test.',
          'Same trade. Same start date. Same wages for the first few years. The only difference is that one of them ' +
            'starts a company and the other one doesn\'t. ' + cfg.years + ' years on, they\'re ' + say(gap) +
            ' apart. Let me show you where that gap comes from.',
          'What\'s a business actually worth to the person who builds it? Not in theory. In dollars, after ' +
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
    var verdict = !winner
      ? pk('This one is a draw. ' + say(a.totals.netWorth) + ' against ' + say(b.totals.netWorth) + ' after ' + cfg.years + ' years, which is the same number for our purposes. ',
           'Dead heat. ' + A + ' and ' + B + ' land within a rounding error of each other. ') +
        pk('Which means the money is not the deciding factor here. The hours, the stress, and whether you own anything at the end are. ',
           'So the decision is not about the total. It comes down to the life around it: the hours, the wear, and what you own when you stop. ') +
        flipCondition(A, B, a, b) + ' ' +
        pk('Learn the trade. Build the business. Own the asset.',
           'The ladder is the same either way. Learn the trade, build the business, own the asset.')
      : pk(
        winner + ' comes out ahead on this one. ' + say(wRes.totals.netWorth) + ' against ' +
          say(lRes.totals.netWorth) + ' after ' + cfg.years + ' years. But hear the why before you take that as advice. ',
        'So. ' + winner + ' wins. ' + say(wRes.totals.netWorth) + ' to ' + say(lRes.totals.netWorth) +
          '. Before anyone runs off and quits their job, let me tell you why. The why matters more than the number. ',
        'The scoreboard says ' + winner + ', by about ' + say(gap) + '. That\'s the headline. ' +
          'Here\'s the part the headline leaves out. '
      ) +
      (wonOnTime
        ? pk(
            hs.leader + ' did not win on income. ' + earnedMore + ' out-earned them. ' + hs.leader + ' won on time. ' + hs.years +
              ' extra years of earning. No student debt. And a business built while the other one was still in school. ',
            hs.leader + ' never had the bigger paycheque. ' + earnedMore + ' earned more, and it wasn\'t close. ' +
              'What ' + hs.leader + ' had was ' + hs.years + ' years. ' + hs.years + ' years of wages. No student loan. ' +
              'And a business already running by the time the other one graduated. ',
            'This wasn\'t a salary win. It was a calendar win. ' + hs.leader + ' started ' + hs.years + ' years earlier. ' +
              'In this model, that head start is worth more than ' + earnedMore + '\'s higher pay ever catches up to. '
          )
        : pk(
            winner + ' won on income and kept enough of it to matter. ',
            winner + ' simply earned more and hung on to enough of it. Sometimes it really is that straightforward. ',
            'This one, ' + winner + ' earned the win the boring way - more money in, enough of it kept. '
          )) +
      pk(
        'Change the assumptions and you change the answer. ',
        'And I want to be honest with you. Move a couple of the inputs and this flips. ',
        'Now. None of this is carved in stone. '
      ) +
      flipCondition(winner, loser, wRes, lRes) + ' ' +
      pk(
        'The point of the ' + cfg.years + '-Year Test is not to crown a trade. It\'s to show that the decision is ' +
          'never just what the job pays. It\'s what you earn, what it cost to get in, what you kept, how many hours ' +
          'it took, and whether you finish with an asset or just a good income. Learn the trade. Build the business. Own the asset.',
        'I don\'t run these to crown a winner. I run them because "what does it pay" is the wrong question, and almost everyone ' +
          'asks it. The right questions are: what did it cost to get in? What did you keep? What did it take out of your week? ' +
          'And do you own anything at the end? Learn the trade. Build the business. Own the asset.',
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
      bits.push('If ' + loser + ' grows the business harder, or opens a second location, the gap closes fast.');
    } else {
      bits.push('If ' + loser + ' can get the business off their own back so it keeps earning without them, this flips.');
    }
    if (wRes.isOwner) {
      bits.push('If ' + winner + "'s business never grows past a one-person operation, it flips harder the other way.");
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

  /* Break a paragraph into prompter lines, one sentence each, so the
     live-line highlight has something to follow. */
  function sentences(text) {
    var parts = String(text || '').replace(/([.!?])\s+(?=["$A-Z0-9])/g, '$1\n').split('\n')
      .map(function (l) { return l.trim(); }).filter(Boolean);
    /* A two-word sentence ("So.") is a pause, not a line: it rides with
       the sentence after it, and a line stays under about fourteen words
       so it fits the prompter column in one or two rows. */
    var out = [];
    parts.forEach(function (p) {
      var last = out[out.length - 1];
      var words = function (t) { return t.split(/\s+/).length; };
      if (last && (words(last) < 5 || (words(p) < 5 && words(last) + words(p) <= 14))) { out[out.length - 1] = last + ' ' + p; }
      else { out.push(p); }
    });
    return out;
  }

  function episodeScript(sim, scores, seed) {
    var pk = makePicker(seed || 0, 'ep');
    var a = sim.a, b = sim.b, cfg = sim.cfg;
    var A = a.name, B = b.name;
    var endAge = cfg.startAge + cfg.years;
    var hs = sim.headStart;
    var yt = youtube(sim, scores, seed);
    var winner = scores.netWorthWinner;
    var gap = Math.abs(a.totals.netWorth - b.totals.netWorth);
    var earnMore = a.totals.careerEarnings > b.totals.careerEarnings ? a : b;
    var earnGap = Math.abs(a.totals.careerEarnings - b.totals.careerEarnings);
    var depA = scores.a.ownerDependency, depB = scores.b.ownerDependency;
    var peakDebt = Math.max(a.totals.peakStudentDebt, b.totals.peakStudentDebt);
    var where = cfg.country === 'US' ? 'state' : (cfg.country === 'CA' ? 'province' : 'place');
    var years = cfg.years;
    /* Hours are easier to feel per week than per career. */
    function perWeek(res) { return Math.round(res.totals.hours / (years * 50)); }
    function thousands(res) { return Math.round(res.totals.hours / 1000) + ' thousand'; }

    var beats = [];
    var names = [A, B];
    function beat(id, kind, title, kicker, lines, extra) {
      lines = [].concat.apply([], lines.filter(Boolean).map(function (l) { return Array.isArray(l) ? l : [l]; }))
        .map(function (l) { return humanise(l, names); });
      beats.push(Object.assign({ id: id, kind: kind, title: title, kicker: kicker, lines: lines, seconds: beatSeconds(lines) }, extra || {}));
    }
    function rowAt(res, age) {
      var hit = null;
      res.rows.forEach(function (r) { if (r.age <= age) { hit = r; } });
      return hit || res.rows[0];
    }
    function schoolEnds(res) {
      for (var i = 0; i < res.rows.length; i++) { if (!res.rows[i].inSchool) { return res.rows[i].age; } }
      return null;
    }
    /* One career's pay over a stretch of years, said the way a person
       would: what it was, what it became, and what happened in between. */
    function payStory(res, from, to) {
      var r0 = rowAt(res, from), r1 = rowAt(res, to);
      var ends = schoolEnds(res);
      var startedBiz = res.milestones.businessStartAge && res.milestones.businessStartAge > from && res.milestones.businessStartAge <= to;
      /* An apprentice is "in school" on the schedule and on a full wage
         at the same time. That is a different story from a student. */
      var paidTraining = r0.inSchool && r0.personalIncome >= 30000;
      if (paidTraining && r1.inSchool) {
        return pk(res.name + ' is learning on the job. Paid from day one: ' + say(r0.personalIncome) + ' at ' + from + ', ' + say(r1.personalIncome) + ' by ' + to + '.',
                  'For ' + res.name + ', training is a paycheque. ' + say(r0.personalIncome) + ' in year one, ' + say(r1.personalIncome) + ' by ' + to + '.',
                  res.name + ' earns while learning. ' + say(r0.personalIncome) + ' to start, ' + say(r1.personalIncome) + ' by ' + to + '.');
      }
      if (paidTraining && !r1.inSchool) {
        return pk(res.name + ' is paid right through training, and finishes it at ' + ends + '. By ' + to + ', ' + say(r1.personalIncome) + ' a year.',
                  res.name + ' earns all the way through the apprenticeship, from ' + say(r0.personalIncome) + ' to ' + say(r1.personalIncome) + ' a year by ' + to + '. Fully qualified at ' + ends + '.',
                  'No unpaid years for ' + res.name + '. ' + say(r0.personalIncome) + ' as a first-year, ' + say(r1.personalIncome) + ' by ' + to + ', qualified at ' + ends + '.');
      }
      if (r0.inSchool && r1.inSchool) {
        return pk(res.name + ' is in school this whole stretch, earning about ' + say(r1.personalIncome) + ' a year on the side.',
                  'For ' + res.name + ', these are school years. Part-time money, roughly ' + say(r1.personalIncome) + ' a year.',
                  res.name + ' is still studying. Call it ' + say(r1.personalIncome) + ' a year from part-time work.');
      }
      if (r0.inSchool && !r1.inSchool) {
        return pk(res.name + ' finishes school at ' + ends + ' and is earning ' + say(r1.personalIncome) + ' by ' + to + '.',
                  'At ' + ends + ', ' + res.name + ' is done with school. By ' + to + ' the pay is ' + say(r1.personalIncome) + ' a year.',
                  res.name + ' gets out of school at ' + ends + '. First real paycheques. ' + say(r1.personalIncome) + ' a year by ' + to + '.');
      }
      if (startedBiz) {
        return pk(res.name + ' goes from ' + say(r0.personalIncome) + ' to ' + say(r1.personalIncome) + ' a year. The business starts at ' + res.milestones.businessStartAge + ', and you can see it in the line.',
                  'This is where ' + res.name + ' starts the business, at ' + res.milestones.businessStartAge + '. Pay goes from ' + say(r0.personalIncome) + ' to ' + say(r1.personalIncome) + ' a year.',
                  res.name + ': ' + say(r0.personalIncome) + ' at ' + from + ', ' + say(r1.personalIncome) + ' at ' + to + '. The bend in the line is the business opening at ' + res.milestones.businessStartAge + '.');
      }
      return pk(res.name + ' goes from ' + say(r0.personalIncome) + ' to ' + say(r1.personalIncome) + ' a year.',
                res.name + ': ' + say(r0.personalIncome) + ' at ' + from + ', ' + say(r1.personalIncome) + ' by ' + to + '.',
                'For ' + res.name + ', pay climbs from ' + say(r0.personalIncome) + ' to ' + say(r1.personalIncome) + '.');
    }
    function peakPay(res) {
      var best = res.rows[0];
      res.rows.forEach(function (r) { if (r.personalIncome > best.personalIncome) { best = r; } });
      return best;
    }

    /* ---- intro: who we are, who is on the block ---- */
    beat('brand', 'brand', 'Blue Collar Business',
      'Learn the trade. Build the business. Own the asset.',
      [pk('Welcome to Blue Collar Business.',
          'Hey. Welcome back to Blue Collar Business.',
          'This is Blue Collar Business. If you\'re new here, here\'s the whole idea in one breath.'),
       pk('This channel runs on one idea. A trade isn\'t the ceiling. It\'s the front door. You learn the trade, you build a business on it, and one day you own something that pays you whether you show up or not.',
          'Everything here comes back to one thing. A trade is a starting line, not a finish line. Learn it. Build a business on it. End up owning something that earns while you sleep.',
          'Simple ladder. Learn the trade. Build the business. Own the asset. Most people stop on the first rung and never find out what the other two pay.'),
       pk('And the way we test that is the ' + years + '-Year Test. Two careers. Same starting age. Side by side for ' + years + ' years. And we count everything, not just the paycheque. What it cost to get in, what you kept, how many hours it took, and whether you end up owning anything.',
          'To check it, we run the ' + years + '-Year Test. Take two careers, start them at the same age, and follow both for ' + years + ' years. Not just the pay. The debt, the tax, the hours, and whether there\'s a business at the end.',
          'So we built a test. Two careers. Same age. ' + years + ' years. And we don\'t stop at salary, because salary is honestly the least interesting number in here. We count the debt, the tax, the hours, and what you actually own at the end.'),
       pk('Today: ' + A + ' against ' + B + '.',
          'Today it\'s ' + A + ' versus ' + B + '. Let\'s go.',
          'On the block today, ' + A + ' and ' + B + '.')]);

    /* ---- the hook ---- */
    beat('open', 'title', A + ' vs ' + B, 'The ' + years + '-Year Test',
      [sentences(yt.hook),
       pk('Same starting age. Same town. Same tax, same inflation, same market.',
          'Same age, same town, same tax rules, same boring market returns. I\'ve held all of that still on purpose.',
          'Everything that isn\'t the career is identical. Same age. Same town. Same tax. Same luck.'),
       pk('The only thing that changes is the career.',
          'One thing changes. The career. That\'s it.',
          'So whatever gap shows up at the end, the career did that.')]);

    /* ---- what we hold constant ---- */
    beat('setup', 'setup', 'The setup', 'What we\'re holding constant',
      [pk('Both of them start at ' + cfg.startAge + '. We follow them for ' + years + ' years, to age ' + endAge + '.',
          'Two people, both ' + cfg.startAge + ' years old. We follow them to ' + endAge + '.',
          'Start at ' + cfg.startAge + '. Finish at ' + endAge + '. ' + years + ' years, start to finish.'),
       pk('Same ' + where + ', same tax, same inflation, same investment returns. And the same house.',
          'They live in the same ' + where + '. They pay the same tax. Their investments grow at the same rate. And, this matters, they buy the same house.',
          'Same tax. Same inflation. Same returns. Same house. I\'m not testing luck, I\'m testing the career.'),
       pk('That\'s on purpose. If I let the house or the market differ, I\'d be measuring something other than the career.',
          'If I let any of that move, I\'d be comparing two lives, not two careers. So it all stays put.',
          'The moment one of them gets a cheaper house or a luckier decade, the comparison is worthless. So they don\'t.')]);

    /* ---- head start ---- */
    if (hs.years > 0) {
      beat('headstart', 'headstart', 'The head start', hs.leader + ' banks ' + say(hs.total),
        [pk('Here\'s the part almost nobody puts a number on.',
            'This is the slide I built the whole test around.',
            'Okay. This is the one people underestimate.'),
         pk(hs.leader + ' is earning a full wage for ' + hs.years + ' years before ' + hs.laggard + ' earns a real paycheque.',
            'For ' + hs.years + ' straight years, ' + hs.leader + ' is getting paid and ' + hs.laggard + ' is paying tuition.',
            'While ' + hs.laggard + ' is in class, ' + hs.leader + ' is on the clock. For ' + hs.years + ' years.'),
         pk('In that window, ' + hs.leader + ' takes home about ' + say(hs.incomeEarned) + '. And roughly ' + say(hs.investmentsAccumulated) + ' of it is saved and invested.',
            'Add it up and ' + hs.leader + ' earns around ' + say(hs.incomeEarned) + ' in that time. Something like ' + say(hs.investmentsAccumulated) + ' of that is actually sitting in the bank.',
            say(hs.incomeEarned) + ' earned. ' + say(hs.investmentsAccumulated) + ' kept and invested. All before the other one has a job.'),
         hs.debtAvoided > 1000
           ? pk('And no student loan. ' + hs.laggard + ' is carrying about ' + say(hs.debtAvoided) + ' that ' + hs.leader + ' never borrowed.',
                'Meanwhile ' + hs.laggard + ' owes roughly ' + say(hs.debtAvoided) + '. ' + hs.leader + ' owes nothing.',
                'Oh, and there\'s no loan. ' + hs.laggard + ' is ' + say(hs.debtAvoided) + ' in the hole by comparison.')
           : pk('And they do it without borrowing to get there.', 'No debt to get there, either.'),
         pk('Call it ' + say(hs.total) + ' of head start before the other career even begins.',
            'All in, that\'s about ' + say(hs.total) + ' of head start. Before the race even starts.',
            'Put a number on it: ' + say(hs.total) + '. That\'s the gap on day one of ' + hs.laggard + '\'s career.')]);
    }

    /* ---- education ---- */
    beat('education', 'education', 'What the education cost', 'Including the interest',
      [pk('Education isn\'t just tuition. It\'s tuition, plus the years you weren\'t earning, plus the interest on what you borrowed.',
          'People think school costs whatever the tuition is. It doesn\'t. The real price tag has three parts. Tuition. The years you weren\'t earning. And the interest.',
          'Tuition is the sticker price. The real price is tuition, plus lost years, plus interest. And it\'s a lot bigger.'),
       pk('All in, that\'s ' + say(a.totals.educationTotalCost) + ' for ' + A + ' and ' + say(b.totals.educationTotalCost) + ' for ' + B + '.',
          'For ' + A + ', the whole thing comes to about ' + say(a.totals.educationTotalCost) + '. For ' + B + ', ' + say(b.totals.educationTotalCost) + '.',
          say(a.totals.educationTotalCost) + ' versus ' + say(b.totals.educationTotalCost) + '. ' + A + ' first, ' + B + ' second.'),
       peakDebt > 5000
         ? pk('The debt peaks at ' + say(peakDebt) + '. And it\'s growing the whole time it\'s waiting to be paid.',
              'At the worst point the loan is ' + say(peakDebt) + '. And it\'s charging interest while they\'re still in class.',
              'The loan tops out at ' + say(peakDebt) + '. Interest doesn\'t wait for graduation.')
         : pk('Neither of them borrows much to get qualified.', 'No real debt on either side here. Rarer than it should be.')]);

    /* ---- earnings, told in stages ----
       The same chart three times, each slide drawing on the next
       stretch of years, so the pay is a story with a shape rather than
       one line that appears finished. */
    var S = cfg.startAge;
    var stops = years > 12 ? [S + 5, S + 10] : [S + Math.round(years / 2)];
    var stageNames = years > 12
      ? [['The first five years', 'Ages ' + S + ' to ' + (S + 5)], ['Years six to ten', 'Ages ' + (S + 5) + ' to ' + (S + 10)]]
      : [['The first half', 'Ages ' + S + ' to ' + stops[0]]];
    var prev = null;
    stops.forEach(function (to, si) {
      var from = prev == null ? S : prev;
      beat('earnings' + (si + 1), 'chart:personalIncome', stageNames[si][0], stageNames[si][1],
        [si === 0
          ? pk('Let\'s take the pay in pieces, because the shape matters as much as the total.',
               'Now the paycheque. I want to show you how it builds, not just where it ends up.',
               'Here\'s the income, and we\'ll walk it in stages. Watch the shape.')
          : pk('Next stretch.', 'Now the next ' + (to - from) + ' years.', 'Keep watching the lines.'),
         payStory(a, from, to),
         payStory(b, from, to),
         si === 0
           ? pk('Early on, the gap is mostly about who is working at all.',
                'This first stretch is not about talent. It\'s about who has a job.',
                'Nothing clever yet. One of them is earning and one of them is getting ready to.')
           : pk('This is where the careers start to look like themselves.',
                'By now, each of them is doing the job they trained for. The lines start to tell the truth.',
                'These are the years where the choice starts to pay off, one way or the other.')],
        { reveal: { from: from, to: to } });
      prev = to;
    });
    var pkA = peakPay(a), pkB = peakPay(b);
    beat('earnings', 'chart:personalIncome', 'What they actually earn', 'The full ' + years + ' years',
      [pk('And here\'s the whole run.', 'Now the full picture.', 'Let the lines finish.'),
       pk(A + ' peaks at ' + say(pkA.personalIncome) + ' a year, at age ' + pkA.age + '. ' + B + ' peaks at ' + say(pkB.personalIncome) + ', at ' + pkB.age + '.',
          'Best year for ' + A + ': ' + say(pkA.personalIncome) + ', at ' + pkA.age + '. Best year for ' + B + ': ' + say(pkB.personalIncome) + ', at ' + pkB.age + '.',
          'Top pay is ' + say(pkA.personalIncome) + ' for ' + A + ' and ' + say(pkB.personalIncome) + ' for ' + B + '.'),
       pk(earnMore.name + ' out-earns the other one over the ' + years + ' years. By about ' + say(earnGap) + ', before tax.',
          'Over ' + years + ' years, ' + earnMore.name + ' earns more. Roughly ' + say(earnGap) + ' more, before tax.',
          earnMore.name + ' wins on pay. And not by a little. ' + say(earnGap) + ' over the period.'),
       pk('Hold on to that number. It\'s the one everybody quotes, and it\'s not the one that decides this.',
          'Remember that number. Everyone leads with it. It turns out not to be the one that matters.',
          'That\'s the number in the job ad. Let\'s see how much of it survives contact with real life.')],
      { reveal: { from: prev, to: S + years } });

    /* ---- investing: the habit, then what compounding did with it ---- */
    var inv = cfg.investing || {};
    var ruleText = inv.mode === 'percent'
      ? Math.round((inv.percent || 0) * 100) + ' percent of whatever is left'
      : say(inv.fixedAmount || 0) + ' a year';
    var retPct = (cfg.investReturn * 100).toFixed(1).replace(/\.0$/, '');
    var dollarFull = Math.pow(1 + cfg.investReturn, years);
    var halfYears = years - Math.round(years / 2);
    var dollarHalf = Math.pow(1 + cfg.investReturn, halfYears);
    var growA = a.totals.investmentGrowth, growB = b.totals.investmentGrowth;
    var bigGrow = growA >= growB ? a : b;
    beat('invest', 'invest', 'The investing habit', 'Pay yourself first',
      [pk('Now, the part of this that people skip. Investing.',
          'Here\'s the quiet part of the model. It matters more than almost anything on the pay slide.',
          'Let\'s talk about the boring habit that ends up doing most of the work.'),
       pk('Both of them follow the same rule. Pay the bills, and ' + ruleText + ' gets invested. Not spent. Invested.',
          'Same rule for both. After living costs, ' + ruleText + ' goes into investments. Every single year.',
          'The rule is simple. Cover the bills, and ' + ruleText + ' gets put away. Every year, no exceptions.'),
       pk('Over the ' + years + ' years, ' + A + ' puts in about ' + say(a.totals.invested) + '. ' + B + ' puts in about ' + say(b.totals.invested) + '.',
          'That adds up to ' + say(a.totals.invested) + ' from ' + A + ' and ' + say(b.totals.invested) + ' from ' + B + '.',
          A + ' saves ' + say(a.totals.invested) + ' over the run. ' + B + ', ' + say(b.totals.invested) + '.'),
       pk('That\'s money they never see. It goes out the day it comes in. Which is exactly why it works.',
          'Nobody misses money they never had in their chequing account. That\'s the whole trick.',
          'It\'s not a lot at a time. It\'s the every-year part that matters.')]);

    beat('compound', 'compound', 'Money that makes money', 'Compound growth at ' + retPct + '%',
      [pk('Here\'s why. The returns get reinvested, so next year you earn returns on the returns. Slowly at first. Then not slowly.',
          'This is compound growth. Your money earns money, and then that money earns money. It feels like nothing for years. Then it doesn\'t.',
          'Compounding is boring for a decade and then it isn\'t. The growth starts growing.'),
       pk('At ' + retPct + ' percent a year, a dollar invested at ' + S + ' is worth ' + '$' + dollarFull.toFixed(2) + ' by ' + endAge + '. The same dollar invested at ' + (S + Math.round(years / 2)) + ' is only worth ' + '$' + dollarHalf.toFixed(2) + '.',
          'Put a dollar in at ' + S + ' and at ' + retPct + ' percent it\'s ' + '$' + dollarFull.toFixed(2) + ' by ' + endAge + '. Wait until ' + (S + Math.round(years / 2)) + ' to put it in, and it\'s ' + '$' + dollarHalf.toFixed(2) + '.',
          'A dollar at ' + S + ' becomes ' + '$' + dollarFull.toFixed(2) + '. A dollar at ' + (S + Math.round(years / 2)) + ' becomes ' + '$' + dollarHalf.toFixed(2) + '. Half the time, ' + Math.round((dollarHalf - 1) / (dollarFull - 1) * 100) + ' percent of the growth. Time is the ingredient.'),
       pk('So look at the pile. ' + A + ' put in ' + say(a.totals.invested) + ' and the market added ' + say(growA) + '. ' + B + ' put in ' + say(b.totals.invested) + ' and the market added ' + say(growB) + '.',
          'The grey part is what they put in. The coloured part is what it earned on its own. ' + say(growA) + ' for ' + A + '. ' + say(growB) + ' for ' + B + '.',
          'What went in, and what it grew. ' + A + ': ' + say(a.totals.invested) + ' in, ' + say(growA) + ' of growth. ' + B + ': ' + say(b.totals.invested) + ' in, ' + say(growB) + ' of growth.'),
       pk('That ' + say(bigGrow.totals.investmentGrowth) + ' is money ' + bigGrow.name + ' never worked an hour for.',
          'Nobody worked for that ' + say(bigGrow.totals.investmentGrowth) + '. It showed up because the money was left alone.',
          'That growth is the closest thing to free money in this whole test. And it only shows up if you start.')]);

    beat('investments', 'chart:investments', 'The bank balance', 'Cash and investments only',
      [pk('This is just cash and investments. No house. No business.',
          'Strip out the house and the business and this is what\'s left. Money in accounts.',
          'This is the money you could actually spend on a Tuesday. Nothing you\'d have to sell first.'),
       sim.crossoverInvestments
         ? pk('They cross at age ' + sim.crossoverInvestments.age + '. That\'s the moment the bigger paycheque finally catches the earlier start.',
              'Watch age ' + sim.crossoverInvestments.age + '. That\'s where the higher income finally overtakes the head start.',
              'The lines cross at ' + sim.crossoverInvestments.age + '. Before that, the head start is winning. After it, the income is.')
         : pk('They never cross. The early money grows faster than the late money arrives.',
              'And they don\'t cross. Not in ' + years + ' years. The early money keeps growing faster than the bigger paycheque can catch it.',
              'No crossover. The head start just keeps pulling away.'),
       pk('That early gap is the head start, sitting in an index fund, doing what money does when you leave it alone.',
          'That early gap? That\'s the head start, invested, quietly growing on its own.',
          'Early on, that\'s not skill or effort. It\'s just time. Money that got a ' + (hs.years || 'few') + '-year start on the other money.')]);

    /* ---- business ---- */
    beat('business', 'business', 'The business', 'Where the real money is made',
      [(a.isOwner || b.isOwner)
        ? pk('This is where a career comparison usually stops. It shouldn\'t.',
             'Most career comparisons end right before this slide. That\'s a bit like reviewing a restaurant from the parking lot.',
             'Here\'s the part every salary comparison leaves out.')
        : pk('Neither of these two builds a business. Worth saying out loud.',
             'Nobody starts a company in this one. Keep that in mind, because it changes everything when someone does.'),
       a.isOwner
         ? pk(A + ' starts a business at ' + a.milestones.businessStartAge + '.', 'At ' + a.milestones.businessStartAge + ', ' + A + ' goes out on their own.', A + ' opens the doors at ' + a.milestones.businessStartAge + '.')
         : pk(A + ' stays an employee the whole way.', A + ' never leaves the paycheque.'),
       b.isOwner
         ? pk(B + ' starts one at ' + b.milestones.businessStartAge + '.', B + ' does the same at ' + b.milestones.businessStartAge + '.', 'For ' + B + ', it\'s age ' + b.milestones.businessStartAge + '.')
         : pk(B + ' stays an employee the whole way.', B + ' works for someone else, start to finish.'),
       (a.totals.businessEquity > 0 || b.totals.businessEquity > 0)
         ? pk('By the end, the business itself is worth about ' + say(a.totals.businessEquity) + ' to ' + A + ' and ' + say(b.totals.businessEquity) + ' to ' + B + '. That\'s after what\'s still owed on it.',
              'At the finish line, what the business is worth, minus what\'s owed on it, comes to ' + say(a.totals.businessEquity) + ' for ' + A + ' and ' + say(b.totals.businessEquity) + ' for ' + B + '.',
              'What the business is worth at ' + endAge + ': ' + say(a.totals.businessEquity) + ' and ' + say(b.totals.businessEquity) + '. That\'s money an employee simply doesn\'t have.')
         : pk('So there\'s no business value on either side of this one.', 'Zero business value, both sides. Which is the point.')]);

    /* ---- dependency ---- */
    if (depA.applicable || depB.applicable) {
      var stuck = (depA.applicable && depA.stepBackBlocked) ? A : ((depB.applicable && depB.stepBackBlocked) ? B : null);
      beat('dependency', 'dependency', 'Owner dependency', 'Can it run without you?',
        [pk('But not every business is the same kind of thing to own. This is the score I care about most.',
            'Now. Two businesses can be worth the same on paper and be completely different things to own. This score is how I tell them apart.',
            'This is my favourite number in the whole test, and almost nobody tracks it.'),
         pk('It\'s out of ten. Ten means the company keeps earning when the owner stops. One means it stops dead.',
            'Out of ten. Ten, the business runs without you. One, the business is you. Take a week off and the revenue takes a week off too.',
            'Simple scale. Ten: you could disappear for a month. One: if you stop, the money stops.'),
         (depA.applicable && depB.applicable)
           ? pk(A + ' scores ' + depA.score + '. ' + B + ' scores ' + depB.score + '.',
                A + ': ' + depA.score + '. ' + B + ': ' + depB.score + '.',
                'It\'s ' + depA.score + ' for ' + A + ' and ' + depB.score + ' for ' + B + '.')
           : (depA.applicable ? A + ' scores ' + depA.score + ' out of ten.' : B + ' scores ' + depB.score + ' out of ten.'),
         stuck
           ? pk(stuck + ' can\'t step back. Hand the work to staff, and what\'s left won\'t cover the loan and a living wage.',
                'And here\'s the trap. ' + stuck + ' can\'t get out. Hand the work to employees and the numbers stop working. The bank doesn\'t get paid, and neither do they.',
                stuck + ' is stuck in it. The business only makes money while they personally do the work. Try to step back and it falls over.')
           : pk('That difference is the difference between owning an asset and owning a job.',
                'That gap is what separates a business you can sell from a job you happen to own.'),
         pk('A business that only works while you\'re in it is a job with extra paperwork.',
            'If it only runs while you\'re there, you didn\'t build a business. You built a job with a payroll.',
            'Owning a job is fine. Just don\'t mistake it for owning an asset.')]);
    }

    /* ---- net worth chart ---- */
    beat('networth', 'chart:netWorth', 'Net worth over time', 'Everything owned, less everything owed',
      [pk('Put it all together and this is the shape of the two lives.',
          'Add it all up. House, business, investments, minus every debt. This is what you get.',
          'This is everything. Every asset, every debt, both careers, ' + years + ' years.'),
       sim.crossoverNetWorth
         ? pk(sim.crossoverNetWorth.passer + ' passes ' + sim.crossoverNetWorth.passed + ' at age ' + sim.crossoverNetWorth.age + (sim.crossoverNetWorthProjected ? '. That\'s past the end of our window, so treat it as a projection.' : '.'),
              'The lines cross at ' + sim.crossoverNetWorth.age + '. That\'s ' + sim.crossoverNetWorth.passer + ' going past ' + sim.crossoverNetWorth.passed + (sim.crossoverNetWorthProjected ? '. That\'s outside the ' + years + ' years, so it\'s a projection, not a result.' : '.'))
         : pk('They never cross. On these numbers, the gap never closes.',
              'And no, they don\'t cross. Not by ' + endAge + '. Not after it either, on these numbers.',
              'No crossover. I ran it out to 75 to check. The gap holds.'),
       pk('Look at where each line bends. Those bends are decisions, not luck.',
          'Look at the kinks in the lines. Every one of those is a decision. A business started. A loan paid off. A house bought.',
          'See the bends? That\'s not the market. That\'s a choice somebody made.')]);

    /* ---- wealth columns ---- */
    beat('wealth', 'columns', 'Wealth at year ' + years, 'Age ' + endAge,
      [pk('So here\'s the scoreboard at ' + endAge + '.',
          'Final numbers. Age ' + endAge + '.',
          'Right. ' + years + ' years in, here\'s where they stand.'),
       pk(A + ' finishes at ' + say(a.totals.netWorth) + '. ' + B + ' finishes at ' + say(b.totals.netWorth) + '.',
          say(a.totals.netWorth) + ' for ' + A + '. ' + say(b.totals.netWorth) + ' for ' + B + '.',
          A + ': ' + say(a.totals.netWorth) + '. ' + B + ': ' + say(b.totals.netWorth) + '.'),
       winner
         ? pk(winner + ' is ahead by about ' + say(gap) + '.', 'That\'s ' + winner + ' up by ' + say(gap) + '.', say(gap) + ' between them. ' + winner + ' on top.')
         : 'They finish level.',
       (winner && earnMore.name !== winner)
         ? pk('Now go back to the pay chart. ' + earnMore.name + ' earned more and still finished behind.',
              'Go back to the pay chart for a second. ' + earnMore.name + ' earned more. ' + earnMore.name + ' finished behind. Sit with that.',
              'So the bigger paycheque lost. ' + earnMore.name + ' out-earned ' + winner + ' and still ended up with less.')
         : pk('Which is roughly what the pay chart said would happen.', 'No surprise there. The pay chart called it.')]);

    /* ---- hours ---- */
    beat('hours', 'hours', 'What it cost in hours', 'The number nobody counts',
      [pk('Money is only half of it. Here\'s the time.',
          'Okay. Now the cost nobody puts on a spreadsheet. Hours. We put it on a spreadsheet.',
          'Let\'s talk about the price you pay in time, because it\'s not the same for both.'),
       pk(A + ' works about ' + thousands(a) + ' hours over the ' + years + ' years. ' + B + ' works about ' + thousands(b) + '.',
          thousands(a) + ' hours for ' + A + '. ' + thousands(b) + ' for ' + B + '.',
          'Over ' + years + ' years, ' + A + ' puts in roughly ' + thousands(a) + ' hours. ' + B + ', about ' + thousands(b) + '.'),
       pk('That\'s about ' + perWeek(a) + ' hours a week for ' + A + ' and ' + perWeek(b) + ' for ' + B + '. Every week. For ' + years + ' years.',
          'Per week, that\'s roughly ' + perWeek(a) + ' hours for ' + A + ' against ' + perWeek(b) + ' for ' + B + '.',
          'Call it ' + perWeek(a) + ' hours a week versus ' + perWeek(b) + '. That difference is your evenings.'),
       pk('Divide the net worth by the hours, and every hour worked built ' + say(a.totals.wealthPerHour) + ' of wealth for ' + A + ' and ' + say(b.totals.wealthPerHour) + ' for ' + B + '.',
          'So per hour on the clock, that\'s ' + say(a.totals.wealthPerHour) + ' of net worth for ' + A + ' and ' + say(b.totals.wealthPerHour) + ' for ' + B + '.',
          'Wealth per hour worked: ' + say(a.totals.wealthPerHour) + ' for ' + A + '. ' + say(b.totals.wealthPerHour) + ' for ' + B + '.'),
       pk('That\'s a very different way to rank two careers. I think it\'s a fairer one.',
          'I\'d argue that\'s the fairest single number in the whole test.',
          'If you only remember one number from this video, make it that one.')]);

    /* ---- lifestyle ---- */
    beat('lifestyle', 'radar', 'The life around the money', 'Eight components, out of ten',
      [pk('Hours, vacation, stress, wear and tear on your body, flexibility, security, family time.',
          'This is the stuff that doesn\'t show up in a bank balance. Hours. Holidays. Stress. Your back. Your evenings.',
          'Eight things that decide whether you actually like your life. None of them are money.'),
       pk('Further out is better on every line. Including the physical one, where ten means the work is easy on your body.',
          'Bigger shape, better life. That includes the physical line. A ten there means your knees still work at ' + endAge + '.',
          'Read it as: more area, better life. Even the physical one. A ten means the job goes easy on you.'),
       pk('Neither shape is better. They\'re different trades, and you have to know which one you can live inside for ' + years + ' years.',
          'There\'s no winner on this slide. There\'s the shape you could live in for two decades and the shape you couldn\'t.',
          'I\'m not calling this one. Look at the two shapes and ask which set of trade-offs you\'d actually accept.')]);

    /* ---- freedom ---- */
    beat('freedom', 'freedom', 'When they get free', 'Selling the business, drawing at ' + Math.round(cfg.safeWithdrawal * 100) + '%',
      [pk('Financial freedom. The age where they could sell the business, invest the money, and live on what it earns.',
          'When can each of them stop, if they want to? Sell the business, invest the money, live on the returns.',
          'The "I could stop tomorrow" age. Cash out the business, and how soon does the money cover the bills on its own?'),
       a.milestones.financialFreedomAgeWithSale
         ? pk(A + ' gets there around ' + a.milestones.financialFreedomAgeWithSale + '.', 'For ' + A + ', roughly age ' + a.milestones.financialFreedomAgeWithSale + '.')
         : A + ' doesn\'t get there on these numbers.',
       b.milestones.financialFreedomAgeWithSale
         ? pk(B + ' gets there around ' + b.milestones.financialFreedomAgeWithSale + '.', B + ', about ' + b.milestones.financialFreedomAgeWithSale + '.')
         : B + ' doesn\'t get there on these numbers.',
       pk('Keep the business instead of selling it, and that date moves later. Only the profit that keeps coming without you counts as income you can rely on.',
          'If they keep the business, it\'s later. Because only the part of the profit that doesn\'t need them in the building actually counts.',
          'Hold on to the business and the date slides out. Profit that needs you on site isn\'t retirement income. It\'s a job.')]);

    /* ---- scores ---- */
    beat('scores', 'scores', 'The Blue Collar Business score', 'Out of one hundred',
      [pk('We score both of them out of a hundred. Money is the biggest single piece, but it\'s only a quarter of it.',
          'Everything rolls up into one score out of a hundred. Money is the biggest piece, and it\'s still only twenty-five points.',
          'One number, out of a hundred. And before anyone says it: yes, money counts. It\'s a quarter of the score. Not all of it.'),
       pk(A + ' comes out at ' + scores.a.score + '. ' + B + ' at ' + scores.b.score + '.',
          scores.a.score + ' for ' + A + '. ' + scores.b.score + ' for ' + B + '.',
          A + ' scores ' + scores.a.score + '. ' + B + ' scores ' + scores.b.score + '.'),
       pk('Underneath that are the four scores this channel is really about. As an employee. As an owner-operator. As a business owner. As an investor.',
          'Under the hood are four smaller scores. How you do as an employee, as an owner-operator, as a business owner, and as an investor.',
          'The four numbers beneath it are the ones I actually care about. Employee. Owner-operator. Business owner. Investor.'),
       pk('That\'s the whole ladder. Do the work. Lead the work. Own the work. Then own the thing that does the work.',
          'That\'s the ladder. Do it, lead it, own it, then own the thing that does it without you.',
          'Same ladder every time. Do, lead, own, invest.')]);

    /* ---- categories ---- */
    beat('categories', 'categories', 'Winner by category', 'Because one number hides the trade',
      [pk('One number always hides something. So here it is, pulled apart.',
          'A single score always buries the trade-offs. So let\'s pull it apart.',
          'I don\'t trust one number, and neither should you. Here\'s the breakdown.'),
       pk('Income, lifestyle, debt, starting a business, growing it, time freedom, net worth.',
          'Best pay. Best lifestyle. Least debt. Best to start a business in. Easiest to grow. Most free time. Highest net worth.',
          'Pay, lifestyle, debt, business potential, growth, time, net worth. Who wins each one.'),
       pk('Nobody wins all of them. And the ones you\'d lose are the ones you have to be honest with yourself about.',
          'Nobody sweeps this. Nobody ever sweeps this. The categories you\'d lose are exactly the ones to be honest about before you commit.',
          'Notice it\'s split. It\'s always split. The question is which losses you can live with.')]);

    /* ---- scenarios ---- */
    beat('scenarios', 'scenarios', 'If I\'m wrong', 'Conservative, realistic, aggressive',
      [pk('Now let me argue against myself.',
          'Okay. Let me try to break my own result before the comments do.',
          'Here\'s where I stress-test this. I\'d rather do it than have you do it for me.'),
       pk('The conservative case means smaller raises, a weaker market, and a business that grows but never takes off.',
          'Conservative means everything goes a bit worse. Smaller raises. A weaker decade in the market. A business that stays small.',
          'The cautious version. Raises are smaller, the market underperforms, and the business is fine but never really takes off.'),
       pk('On the cautious numbers, ' + (scenarioLead() || 'the answer gets a lot closer') + '.',
          'Run it that way and ' + (scenarioLead() || 'it tightens up a lot') + '.',
          'And on those numbers, ' + (scenarioLead() || 'the gap narrows') + '.'),
       pk('I quote the realistic number. The conservative number is the one I\'d plan around.',
          'I\'ll say the realistic figure out loud. I\'d plan my life around the cautious one.',
          'The headline is the realistic case. If it were my money, I\'d budget on the cautious case.')]);

    /* ---- verdict ---- */
    beat('verdict', 'verdict', 'The ' + years + '-year verdict', winner || 'Too close to call', [sentences(yt.verdict)]);

    /* ---- outro ---- */
    beat('outro', 'outro', 'Run your own numbers', '',
      [pk('Here\'s what I\'d take away from this one.',
          'So what do you do with this?',
          'Let me leave you with the thing that actually matters here.'),
       pk('The job you pick matters. What you do with it after year five matters more. And almost nobody runs those numbers before they commit twenty years to an answer.',
          'The career matters less than what you do with it once you\'re in. That second part is where all the money is. It\'s also the part nobody models.',
          'Picking the job is maybe a third of it. What you build on top of the job is the rest. Almost nobody does that math before they commit.'),
       pk('So run yours. Put in what they actually pay where you live. Put in the business you\'d actually start. See if the answer holds.',
          'So go run your own. Real local wages. The business you\'d actually open. See if the answer survives.',
          'Do it with your own numbers. Your town\'s wages, your tuition, the business you\'d really start. Then see what twenty years looks like. It\'s usually not what you expected.'),
       pk('If you want the next one, subscribe. We run a different pair every episode, and the ones that surprise me go out first.',
          'Subscribe if you want the next matchup. Different pair every time, and I always lead with the ones that surprised me.',
          'There\'s a new pair every episode. Hit subscribe and I\'ll show you the ones that didn\'t go the way I expected.'),
       pk('Learn the trade. Build the business. Own the asset. See you next time.',
          'Learn the trade, build the business, own the asset. See you in the next one.',
          'Learn the trade. Build the business. Own the asset. That\'s it. See you next time.')]);

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
