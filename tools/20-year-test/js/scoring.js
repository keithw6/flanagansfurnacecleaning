/* =====================================================================
   Blue Collar Business - The 20-Year Test
   scoring.js : lifestyle, the BCB 100, the four /10 scores,
                time freedom, owner dependency, data confidence

   Every score here is DERIVED from inputs a person can argue with, and
   every one reports the components that produced it. A score you cannot
   take apart is a score nobody should trust on camera.
   ===================================================================== */
(function (global) {
  'use strict';

  var BCB = global.BCB = global.BCB || {};
  var D = BCB.data;

  function clamp(v, lo, hi) { return v < lo ? lo : (v > hi ? hi : v); }
  function avg(a) { var t = 0; for (var i = 0; i < a.length; i++) { t += a[i]; } return a.length ? t / a.length : 0; }
  function round1(v) { return Math.round(v * 10) / 10; }

  /* Weighted roll-up that also hands back its own workings. */
  function weigh(parts) {
    var total = 0, wsum = 0, rows = [];
    for (var i = 0; i < parts.length; i++) {
      var p = parts[i];
      var v = clamp(p.value, 0, 10);
      total += v * p.weight;
      wsum += p.weight;
      rows.push({ key: p.key, label: p.label, value: round1(v), weight: p.weight,
                  points: round1(v * p.weight / 10), why: p.why || '' });
    }
    return { score: wsum ? total / wsum : 0, rows: rows, weightTotal: wsum };
  }

  /* ---------------------------------------------------------------
     LIFESTYLE SCORE (spec s.9) - 0 to 100
     Built from observable facts about the work, not from opinion.
     --------------------------------------------------------------- */
  function lifestyleScore(career, result) {
    var L = career.lifestyle;
    var last = result.rows[result.rows.length - 1];
    var b = last && last.business;

    /* Hours. 40 is the reference week; overtime, evenings, weekends and
       being on call each cost separately because they cost separately
       in real life. */
    var weekly = L.hoursPerWeek + L.overtimeHours + (b ? (b.ownerShare > 0.75 ? 8 : b.ownerShare > 0.25 ? 4 : -6) : 0);
    var hours = 10
      - Math.max(0, weekly - 40) / 3.5
      - L.eveningWork * 0.12 - L.weekendWork * 0.12 - L.onCall * 0.10;

    /* Vacation. Weeks matter, but so does whether you can actually go,
       which for an owner means whether the work survives the absence. */
    var leaveWeeks = b ? (b.hasManager ? 6 : b.ownerShare > 0.75 ? 1 : 3) : L.leaveBusinessWeeks;
    var vacation = clamp(L.vacationWeeks / 5 * 4, 0, 5.5)
                 + L.vacationTakeable * 0.30
                 + clamp(leaveWeeks / 6 * 1.5, 0, 1.5);

    /* Stress. An average would let one brutal component hide behind
       five mild ones, so the worst component is weighted double. */
    var sVals = [L.stress.customer, L.stress.employee, L.stress.liability,
                 L.stress.emergency, L.stress.financial, L.stress.regulatory];
    if (b) {
      /* Ownership adds employee and financial pressure. Real pressure. */
      sVals[1] = Math.max(sVals[1], clamp(b.employees * 0.7 + 2, 2, 10));
      sVals[4] = Math.max(sVals[4], b.ownerShare > 0.5 ? 7 : 6);
    }
    var worst = Math.max.apply(null, sVals);
    var stress = 10 - (avg(sVals) * 0.7 + worst * 0.3);

    var physical = L.physical;
    var mental = L.mental;

    var F = L.flexibility;
    var flexRaw = [F.chooseHours, F.fewerDays, F.remote, F.extendedVac,
                   F.relocate, F.changeEmployer, F.selfEmploy];
    var flexibility = avg(flexRaw);
    if (b) {
      /* Owning the schedule cuts both ways: you set the hours, but the
         business does not stop when you do. */
      flexibility = avg([flexibility, b.hasManager ? 9 : b.ownerShare > 0.75 ? 4 : 6.5]);
    }

    var K = L.security;
    var security = avg([K.demand, K.automation, K.outsourcing, K.recession, K.licensing, K.shortage]);
    if (b) { security = avg([security, clamp(b.ownerDependency, 1, 10)]); }

    var P = L.family;
    var family = avg([P.eveningsHome, P.weekendsOff, P.predictable, P.lowTravel, P.canAttend]);
    if (b && b.ownerShare > 0.75) { family = Math.max(1, family - 1.5); }

    var w = weigh([
      { key: 'hours',       label: 'Hours worked',        value: hours,       weight: 15, why: Math.round(weekly) + ' hrs/week typical' },
      { key: 'vacation',    label: 'Vacation',            value: vacation,    weight: 12, why: L.vacationWeeks + ' weeks, ' + leaveWeeks + '-week absence survivable' },
      { key: 'stress',      label: 'Stress',              value: stress,      weight: 15, why: 'worst pressure ' + worst + '/10' },
      { key: 'physical',    label: 'Physical demands',    value: physical,    weight: 12, why: physical + '/10 (10 = minimal)' },
      { key: 'mental',      label: 'Mental demands',      value: mental,      weight: 8,  why: mental + '/10 (10 = light)' },
      { key: 'flexibility', label: 'Flexibility',         value: flexibility, weight: 14, why: '' },
      { key: 'security',    label: 'Job security',        value: security,    weight: 12, why: '' },
      { key: 'family',      label: 'Family / personal',   value: family,      weight: 12, why: '' }
    ]);
    return { score: Math.round(w.score * 10), outOf: 100, rows: w.rows, weeklyHours: Math.round(weekly) };
  }

  /* ---------------------------------------------------------------
     TIME FREEDOM (spec s.12) - /10
     How much control over their own time this person ends up with.
     --------------------------------------------------------------- */
  function timeFreedom(career, result, safeWithdrawal) {
    var sw = safeWithdrawal == null ? 0.04 : safeWithdrawal;
    var L = career.lifestyle, T = career.traits;
    var last = result.rows[result.rows.length - 1];
    var b = last && last.business;

    var requiredHours = 10 - Math.max(0, (L.hoursPerWeek + L.overtimeHours - 38)) / 3.2;
    var schedule = b ? (b.hasManager ? 9.5 : b.ownerShare > 0.75 ? 4 : 7) : T.scheduleControl;
    var delegate = b ? clamp(b.ownerDependency, 1, 10) : T.delegability;
    var canLeave = b ? (b.hasManager ? 9 : b.ownerShare > 0.75 ? 2 : 5) : clamp(L.vacationWeeks / 4 * 6, 1, 9);
    var paidVac = clamp(L.vacationWeeks / 5 * 8, 0, 10);
    var dependency = b ? clamp(b.ownerDependency, 1, 10) : 5;

    /* The share of the person's income that would keep arriving if they
       stopped working - the thing that actually buys time. */
    var passive = 0;
    if (last) {
      var passiveIncome = last.investments * sw
                        + (last.distributions || 0) * (b ? b.ownerDependency / 10 : 0);
      var need = last.living + last.housingCost;
      passive = clamp(need > 0 ? (passiveIncome / need) * 10 : 0, 0, 10);
    }

    var w = weigh([
      { key: 'hours',      label: 'Required hours',            value: requiredHours, weight: 15 },
      { key: 'schedule',   label: 'Schedule control',          value: schedule,      weight: 15 },
      { key: 'delegate',   label: 'Ability to delegate',       value: delegate,      weight: 15 },
      { key: 'leave',      label: 'Can leave for weeks',       value: canLeave,      weight: 15 },
      { key: 'vacation',   label: 'Paid vacation',             value: paidVac,       weight: 10 },
      { key: 'dependency', label: 'Business runs without you', value: dependency,    weight: 15 },
      { key: 'passive',    label: 'Passive income cover',      value: passive,       weight: 15 }
    ]);
    return { score: round1(w.score), outOf: 10, rows: w.rows };
  }

  /* ---------------------------------------------------------------
     OWNER DEPENDENCY (spec s.13) - /10
     Computed by the engine each year; this packages the final state
     with the reasoning behind it.
     --------------------------------------------------------------- */
  function ownerDependency(result) {
    var last = result.rows[result.rows.length - 1];
    if (!last || !last.business) {
      return { score: null, outOf: 10, applicable: false,
               note: 'No business on this path, so there is nothing to be dependent on the owner.' };
    }
    var b = last.business;
    var prodShare = b.revenue > 0 ? b.ownerProduced / b.revenue : 1;
    var notes = [];
    if (prodShare > 0.6) { notes.push('the owner still personally produces ' + Math.round(prodShare * 100) + '% of revenue'); }
    else if (prodShare > 0.15) { notes.push('the owner produces ' + Math.round(prodShare * 100) + '% of revenue'); }
    else { notes.push('the owner has handed production over'); }
    if (b.hasManager) { notes.push('a manager runs day-to-day operations'); }
    else { notes.push('nobody else runs the operation'); }
    if (b.stepBackBlocked) {
      notes.push('stepping back further would not cover the bank and a liveable draw, so the owner cannot leave the work');
    }
    notes.push(b.employees + (b.employees === 1 ? ' person' : ' people') + ' on payroll');
    return {
      score: round1(b.ownerDependency), outOf: 10, applicable: true,
      productionShare: prodShare, employees: b.employees,
      hasManager: b.hasManager, stepBackBlocked: !!b.stepBackBlocked,
      note: notes.join('; ') + '.'
    };
  }

  /* ---------------------------------------------------------------
     THE FOUR /10 SCORES (spec s.11)
     Career / Owner-Operator / Business Owner / Investor.
     Derived, so they move when the inputs move.
     --------------------------------------------------------------- */
  function fourScores(career, result, other) {
    var T = career.traits, L = career.lifestyle, e = career.education;
    var life = lifestyleScore(career, result);
    var rows = result.rows;
    var last = rows[rows.length - 1];

    /* Entry cost, absolutely rather than relatively: years out of the
       workforce and money spent are the same for everybody. */
    var yearsOut = e.yearsUnpaidSchool || 0;
    var eduCost = result.totals.educationTotalCost;
    var entry = clamp(10 - yearsOut * 0.9 - (eduCost / 30000), 0, 10);

    /* Income as an employee, benchmarked so the number means something
       on its own rather than only against the other career. */
    var startPay = career.stages[0].base + career.stages[0].overtime;
    var midPay = 0;
    for (var i = 0; i < career.stages.length; i++) {
      if (career.stages[i].age <= 30) { midPay = career.stages[i].base + career.stages[i].overtime + career.stages[i].bonus; }
    }
    var incomeScore = clamp(startPay / 12000 * 0.35 + midPay / 22000 * 0.45 + T.incomeCeiling * 0.30, 0, 10);

    var careerScore = weigh([
      { key: 'income',     label: 'Employee income',   value: incomeScore, weight: 30 },
      { key: 'entry',      label: 'Ease of entry',     value: entry,       weight: 20 },
      { key: 'lifestyle',  label: 'Lifestyle',         value: life.score / 10, weight: 25 },
      { key: 'durability', label: 'Career durability', value: T.durability, weight: 15 },
      { key: 'ceiling',    label: 'Income ceiling',    value: T.incomeCeiling, weight: 10 }
    ]);

    var b = career.business;
    var hasBiz = !!(b && b.enabled);
    var lastBiz = last && last.business;

    /* Owner-operator: owning the job. Rewarded for margin and demand,
       penalised for capital and for the hours it costs. */
    var ooScore = weigh([
      { key: 'ease',      label: 'Realistic to start alone', value: T.businessEase, weight: 25 },
      { key: 'capital',   label: 'Low startup capital',      value: T.startupCapital, weight: 20 },
      { key: 'demand',    label: 'Customer demand',          value: T.customerDemand, weight: 20 },
      { key: 'margins',   label: 'Margins',                  value: T.margins, weight: 20 },
      { key: 'hours',     label: 'Hours it costs you',       value: clamp(10 - (L.hoursPerWeek + L.overtimeHours - 40) / 3, 0, 10), weight: 15 }
    ]);

    /* Business owner: employees produce, the owner runs it. */
    var boScore = weigh([
      { key: 'scale',     label: 'Employees can produce',    value: T.scalability, weight: 30 },
      { key: 'margins',   label: 'Margins hold at scale',    value: lastBiz ? clamp(lastBiz.sdeMarginActual * 45, 0, 10) : T.margins, weight: 20 },
      { key: 'demand',    label: 'Demand supports growth',   value: T.customerDemand, weight: 20 },
      { key: 'delegate',  label: 'Work can be delegated',    value: T.delegability, weight: 15 },
      { key: 'recurring', label: 'Recurring revenue',        value: T.recurringRevenue, weight: 15 }
    ]);

    /* Investor: owning it as an asset. Dependency is most of the story. */
    var dep = ownerDependency(result);
    var investorScore = weigh([
      { key: 'dependency', label: 'Runs without the owner', value: dep.applicable ? dep.score : T.scalability * 0.6, weight: 35 },
      { key: 'recurring',  label: 'Recurring revenue',      value: T.recurringRevenue, weight: 20 },
      { key: 'multiple',   label: 'Sale multiple',          value: hasBiz ? clamp(b.valuationMultiple * 2.2, 0, 10) : 2, weight: 20 },
      { key: 'mgmt',       label: 'Management team',        value: lastBiz && lastBiz.hasManager ? 8.5 : (hasBiz ? b.quality.managementTeam : 2), weight: 15 },
      { key: 'assets',     label: 'Asset base',             value: hasBiz ? b.quality.assetBase : 2, weight: 10 }
    ]);

    var overall = avg([careerScore.score, ooScore.score, boScore.score, investorScore.score]);

    return {
      career:        { score: round1(careerScore.score), rows: careerScore.rows },
      ownerOperator: { score: round1(ooScore.score), rows: ooScore.rows },
      businessOwner: { score: round1(boScore.score), rows: boScore.rows },
      investor:      { score: round1(investorScore.score), rows: investorScore.rows },
      overall: round1(overall),
      lifestyle: life
    };
  }

  /* ---------------------------------------------------------------
     THE BLUE COLLAR BUSINESS SCORE (spec s.10) - /100
     The one weighted score, using the spec's weights exactly.
     Financial outcome is the only relative component: it is scored
     against the better of the two careers, because "was this the
     better financial decision" is inherently a comparison.
     --------------------------------------------------------------- */
  function bcbScore(career, result, other, otherResult, safeWithdrawal) {
    var T = career.traits, e = career.education;
    var four = fourScores(career, result, other);
    var life = four.lifestyle;

    /* Relative financial standing: 10 for the leader, scaled below. */
    function rel(mine, theirs) {
      var best = Math.max(mine, theirs);
      if (best <= 0) { return mine >= theirs ? 6 : 4; }
      return clamp(4 + 6 * (mine / best), 0, 10);
    }
    var financial = avg([
      rel(result.totals.netWorth, otherResult.totals.netWorth),
      rel(result.totals.careerEarnings, otherResult.totals.careerEarnings),
      rel(result.totals.investments + result.totals.cash,
          otherResult.totals.investments + otherResult.totals.cash)
    ]);

    var yearsOut = e.yearsUnpaidSchool || 0;
    var entry = clamp(10 - yearsOut * 0.9 - (result.totals.educationTotalCost / 30000), 0, 10);

    var startPay = career.stages[0].base + career.stages[0].overtime;
    var midPay = 0;
    for (var i = 0; i < career.stages.length; i++) {
      if (career.stages[i].age <= 30) { midPay = career.stages[i].base + career.stages[i].overtime; }
    }
    var careerIncome = clamp(startPay / 12000 * 0.35 + midPay / 22000 * 0.35 + T.incomeCeiling * 0.30, 0, 10);

    var businessOpportunity = avg([T.businessEase, T.customerDemand, T.margins, T.startupCapital]);
    var durability = avg([T.durability, career.lifestyle.security.automation, career.lifestyle.security.recession]);

    var dep = ownerDependency(result);
    var wealthBuilding = avg([
      T.wealthBuilding,
      clamp((result.totals.investments + result.totals.cash) / 40000, 0, 10),
      clamp(result.totals.businessEquity / 120000, 0, 10),
      dep.applicable ? dep.score : 3
    ]);

    var w = weigh([
      { key: 'financial',  label: 'Financial outcome',        value: financial,           weight: 25 },
      { key: 'entry',      label: 'Entry opportunity',        value: entry,               weight: 10 },
      { key: 'income',     label: 'Career income',            value: careerIncome,        weight: 10 },
      { key: 'business',   label: 'Business opportunity',     value: businessOpportunity, weight: 15 },
      { key: 'scale',      label: 'Scalability',              value: T.scalability,       weight: 10 },
      { key: 'lifestyle',  label: 'Lifestyle',                value: life.score / 10,     weight: 15 },
      { key: 'durability', label: 'Career durability',        value: durability,          weight: 5 },
      { key: 'wealth',     label: 'Wealth-building potential',value: wealthBuilding,      weight: 10 }
    ]);

    return {
      score: Math.round(w.score * 10), outOf: 100,
      rows: w.rows,
      four: four,
      lifestyle: life,
      timeFreedom: timeFreedom(career, result, safeWithdrawal),
      ownerDependency: dep
    };
  }

  /* ---------------------------------------------------------------
     DATA CONFIDENCE (spec s.18)
     A comparison is only as good as its weakest important input, so
     the roll-up is deliberately unforgiving.
     --------------------------------------------------------------- */
  function confidence(career) {
    var tags = [
      { area: 'Education costs', conf: career.education.conf },
      { area: 'Education debt terms', conf: career.debt.conf },
      { area: 'Income by stage', conf: career.conf },
      { area: 'Business assumptions', conf: (career.business && career.business.conf) || 'estimated' },
      { area: 'Living expenses', conf: career.living.conf },
      { area: 'Lifestyle and scores', conf: 'estimated' }
    ];
    var ranks = tags.map(function (t) { return (D.CONFIDENCE[t.conf] || D.CONFIDENCE.estimated).rank; });
    var mean = avg(ranks);
    var level = mean >= 3.0 ? 'HIGH' : mean >= 2.0 ? 'MEDIUM' : 'LOW';
    return {
      level: level, mean: Math.round(mean * 100) / 100, tags: tags,
      note: level === 'HIGH'
        ? 'Most inputs are documented. Still check the tax and investment assumptions.'
        : level === 'MEDIUM'
          ? 'A mix of documented and typical figures. Replace the estimates with local numbers before publishing.'
          : 'Mostly estimates. Treat every output as a shape, not a figure.'
    };
  }

  /* ---------------------------------------------------------------
     WINNER BY CATEGORY (spec s.23)
     --------------------------------------------------------------- */
  function categoryWinners(sim, scoreA, scoreB) {
    var a = sim.a, b = sim.b;
    function pick(label, aVal, bVal, higherWins, fmt) {
      var aBetter = higherWins ? aVal >= bVal : aVal <= bVal;
      var tie = aVal === bVal;
      return {
        label: label,
        winner: tie ? 'Tie' : (aBetter ? a.name : b.name),
        aValue: aVal, bValue: bVal, tie: tie, fmt: fmt || 'money'
      };
    }
    function ageOrInf(v) { return v == null ? 999 : v; }
    return [
      pick('Best for income',            a.totals.careerEarnings, b.totals.careerEarnings, true),
      pick('Best for lifestyle',         scoreA.lifestyle.score, scoreB.lifestyle.score, true, 'score100'),
      pick('Best for low debt',          a.totals.peakStudentDebt, b.totals.peakStudentDebt, false),
      pick('Best for entrepreneurship',  scoreA.four.ownerOperator.score, scoreB.four.ownerOperator.score, true, 'score10'),
      pick('Best for business ownership',scoreA.four.businessOwner.score, scoreB.four.businessOwner.score, true, 'score10'),
      pick('Best for investment potential', a.totals.investments + a.totals.cash, b.totals.investments + b.totals.cash, true),
      pick('Best for time freedom',      scoreA.timeFreedom.score, scoreB.timeFreedom.score, true, 'score10'),
      pick('Earliest financial freedom', ageOrInf(a.milestones.financialFreedomAgeWithSale), ageOrInf(b.milestones.financialFreedomAgeWithSale), false, 'age'),
      pick('Highest expected net worth', a.totals.netWorth, b.totals.netWorth, true),
      pick('Most wealth per hour worked',a.totals.wealthPerHour, b.totals.wealthPerHour, true, 'money0')
    ];
  }

  /* ---------------------------------------------------------------
     One call, everything scored.
     --------------------------------------------------------------- */
  function scoreAll(sim) {
    var A = sim.cfg.careers.a, B = sim.cfg.careers.b;
    var sw = sim.cfg.safeWithdrawal;
    var sa = bcbScore(A, sim.a, B, sim.b, sw);
    var sb = bcbScore(B, sim.b, A, sim.a, sw);
    return {
      a: sa, b: sb,
      confidenceA: confidence(A),
      confidenceB: confidence(B),
      categories: categoryWinners(sim, sa, sb),
      overallWinner: sa.score === sb.score ? null : (sa.score > sb.score ? sim.a.name : sim.b.name),
      netWorthWinner: sim.a.totals.netWorth === sim.b.totals.netWorth ? null
        : (sim.a.totals.netWorth > sim.b.totals.netWorth ? sim.a.name : sim.b.name)
    };
  }

  BCB.scoring = {
    scoreAll: scoreAll, bcbScore: bcbScore, lifestyleScore: lifestyleScore,
    timeFreedom: timeFreedom, ownerDependency: ownerDependency,
    fourScores: fourScores, confidence: confidence, categoryWinners: categoryWinners
  };

})(typeof window !== 'undefined' ? window : globalThis);
