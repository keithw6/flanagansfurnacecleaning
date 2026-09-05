/* =====================================================================
   Blue Collar Business - The 20-Year Test
   engine.js : the year-by-year simulation

   One pass per career, one row per year of life. Everything downstream
   (charts, scores, narrative, PDF) reads those rows. Nothing here
   guesses: if a number is not derivable it comes from the config.

   Money is NOMINAL throughout - dollars of the year they occur in.
   Tax brackets, living costs and the housing price are indexed to
   inflation so they keep pace. Real (today's-dollar) figures are
   reported alongside so the 20-year number is not read too generously.
   ===================================================================== */
(function (global) {
  'use strict';

  var BCB = global.BCB = global.BCB || {};
  var D = BCB.data;

  /* ---------------- small helpers ---------------- */
  function clamp(v, lo, hi) { return v < lo ? lo : (v > hi ? hi : v); }
  function sum(arr) { var t = 0; for (var i = 0; i < arr.length; i++) { t += arr[i]; } return t; }

  /* Level payment on an amortising loan. Returns 0 for a dead loan. */
  function payment(balance, rate, years) {
    if (balance <= 0 || years <= 0) { return 0; }
    if (rate <= 0) { return balance / years; }
    var f = Math.pow(1 + rate, years);
    return balance * rate * f / (f - 1);
  }

  /* Progressive tax on `income` against a bracket table whose
     thresholds and personal credit are indexed by `idx`. */
  function bracketTax(income, table, idx) {
    var taxable = Math.max(0, income - table.credit * idx);
    if (taxable <= 0) { return 0; }
    var tax = 0, prev = 0;
    for (var i = 0; i < table.brackets.length; i++) {
      var top = table.brackets[i][0];
      var rate = table.brackets[i][1];
      var ceil = (top === Infinity) ? Infinity : top * idx;
      var slice = Math.min(taxable, ceil) - prev;
      if (slice > 0) { tax += slice * rate; }
      if (taxable <= ceil) { break; }
      prev = ceil;
    }
    return tax;
  }

  /* Marginal rate at a given income - needed to tax distributions. */
  function marginalRate(income, table, idx) {
    var taxable = Math.max(0, income - table.credit * idx);
    for (var i = 0; i < table.brackets.length; i++) {
      var top = table.brackets[i][0];
      if (taxable <= (top === Infinity ? Infinity : top * idx)) { return table.brackets[i][1]; }
    }
    return table.brackets[table.brackets.length - 1][1];
  }

  function payrollTax(wages, jur, idx) {
    var items = jur.payroll.items, t = 0;
    for (var i = 0; i < items.length; i++) {
      var it = items[i];
      var lo = it.exempt * idx;
      var hi = (it.max === Infinity) ? Infinity : it.max * idx;
      t += Math.max(0, Math.min(wages, hi) - lo) * it.rate;
    }
    return t;
  }

  /* Everything tax in one place so the engine reads cleanly. */
  function makeTaxer(cfg) {
    var jur = D.TAX[cfg.country] || D.TAX.FLAT;
    var reg = (jur.regions && jur.regions[cfg.region]) || { credit: 0, brackets: [[Infinity, 0]] };
    var flat = (cfg.taxMode === 'flat') || jur.flat;
    return {
      jurisdiction: jur,
      region: reg,
      /* wages: employment income + owner salary (payroll applies)
         dividends: business distributions (no payroll, credited rate) */
      compute: function (wages, dividends, deductions, idx) {
        var w = Math.max(0, wages - Math.max(0, deductions));
        if (flat) {
          var r = cfg.flatRate;
          return {
            income: bracketTax(w, { credit: 0, brackets: [[Infinity, r]] }, 1)
                  + dividends * r * jur.dividendFactor,
            payroll: 0,
            marginal: r
          };
        }
        var fed = bracketTax(w, jur.federal, idx);
        var prov = bracketTax(w, reg, idx);
        var mFed = marginalRate(w, jur.federal, idx);
        var mProv = marginalRate(w, reg, idx);
        var marg = mFed + mProv;
        /* Distributions stack on top of wages, so they are taxed at
           the marginal rate, discounted for the dividend credit. */
        var divTax = dividends > 0 ? dividends * marg * jur.dividendFactor : 0;
        return {
          income: fed + prov + divTax,
          payroll: payrollTax(Math.max(0, wages), jur, idx),
          marginal: marg
        };
      },
      /* RRSP/401k-style room. Deducting contributions is worth real
         money over 20 years, so it is modelled rather than ignored. */
      registeredRoom: function (earned, idx) {
        if (cfg.country === 'CA') { return Math.min(earned * 0.18, 32490 * idx); }
        if (cfg.country === 'US') { return Math.min(earned, 23500 * idx); }
        return earned * 0.18;
      }
    };
  }

  /* ---------------------------------------------------------------
     Stage lookup: the last stage whose age has arrived.
     --------------------------------------------------------------- */
  function stageAt(stages, age) {
    var found = null;
    for (var i = 0; i < stages.length; i++) {
      if (stages[i].age <= age) { found = stages[i]; } else { break; }
    }
    return found || stages[0];
  }

  /* ---------------------------------------------------------------
     EDUCATION SCHEDULE
     Returns per-year education spend and whether the person is in
     unpaid school that year (which cuts living costs and work hours).
     --------------------------------------------------------------- */
  function educationSchedule(career, startAge, years) {
    var e = career.education;
    var tuitionYears = Math.max(0, e.tuitionYears || 0);
    var spanYears = Math.max(tuitionYears, Math.ceil(e.yearsEducation || 0), Math.ceil(e.yearsApprenticeship || 0));
    var oneTime = (e.books || 0) + (e.tools || 0) + (e.certification || 0) +
                  (e.licensing || 0) + (e.examFees || 0) + (e.equipment || 0) + (e.other || 0);
    var offsets = (e.familyPaid || 0) + (e.scholarships || 0) + (e.grants || 0);
    var spreadOver = Math.max(1, tuitionYears);

    var sched = [];
    for (var t = 0; t < years; t++) {
      var age = startAge + t;
      var inTuition = t < tuitionYears;
      var gross = (inTuition ? (e.tuitionPerYear || 0) : 0) + (t < spreadOver ? oneTime / spreadOver : 0);
      var offset = t < spreadOver ? offsets / spreadOver : 0;
      /* Unpaid school years are the ones where the person is in class
         rather than earning a trade wage. Fractional years (block
         training in an apprenticeship) count as a share of the year. */
      var unpaidLeft = (e.yearsUnpaidSchool || 0) - t;
      sched.push({
        age: age,
        grossSpend: gross,
        offset: Math.min(offset, gross),
        netSpend: Math.max(0, gross - offset),
        unpaidShare: clamp(unpaidLeft, 0, 1),
        inSchool: t < spanYears
      });
    }
    return {
      rows: sched,
      spanYears: spanYears,
      totalGross: sum(sched.map(function (r) { return r.grossSpend; })),
      totalOffset: sum(sched.map(function (r) { return r.offset; })),
      totalNet: sum(sched.map(function (r) { return r.netSpend; })),
      oneTime: oneTime,
      /* The age professional/trade income actually begins: the first
         stage whose income clears a real full-time wage. */
      firstEarningAge: startAge
    };
  }

  /* The age at which this career starts earning a real full-time
     income - the anchor for the Head Start metric. Defined as the
     first stage paying more than `floor`, which defaults to a
     part-time/summer-work ceiling. */
  function professionalStartAge(career, floor) {
    floor = floor == null ? 30000 : floor;
    for (var i = 0; i < career.stages.length; i++) {
      var s = career.stages[i];
      if ((s.base + s.overtime + s.bonus) > floor) { return s.age; }
    }
    return career.stages[0].age;
  }

  /* ---------------------------------------------------------------
     BUSINESS: one year of the company
     --------------------------------------------------------------- */

  /* The company must clear its own capital costs, not merely break
     even, before the owner is free to walk away from production. */
  /* The manager arrives only once the owner has genuinely handed the
     work over. Tie it to the birthday alone and the business pays for a
     manager it is not yet using. */
  function managerHired(b, age, ownerShare) {
    return !!(b.investorStage && age >= b.investorStage && ownerShare <= 0.5);
  }

  function viabilityFloor(b, cfg, sc, age, idx) {
    var bt = age - b.startAge;
    var idxOpen = Math.pow(1 + cfg.inflation, b.startAge - cfg.startAge);
    var revenue = b.revenueY1 * idxOpen * Math.pow(1 + b.revenueGrowth * sc.revenueGrowth, bt);
    if (b.revenueCeiling > 0) { revenue = Math.min(revenue, b.revenueCeiling * idx); }
    /* Stepping back has to leave enough to cover the equipment, the
       working capital, the bank AND a liveable draw for the owner.
       Nobody hands the work to employees in order to earn nothing. */
    var debtService = payment(b.startupInvestment * b.startupLoanShare * idxOpen,
                              b.startupLoanRate, b.startupLoanYears);
    var minDraw = b.ownerSalary * idx * 0.6;
    return revenue * (b.capexPct + b.workingCapitalPct * 0.2) + debtService + minDraw;
  }

  /* SDE at a hypothetical owner-production share. Used by the
     step-back guard; deliberately mirrors the main build-up. */
  function sdeAtShare(b, cfg, sc, age, idx, share) {
    var bt = age - b.startAge;
    var idxOpen = Math.pow(1 + cfg.inflation, b.startAge - cfg.startAge);
    var revenue = b.revenueY1 * idxOpen * Math.pow(1 + b.revenueGrowth * sc.revenueGrowth, bt);
    if (b.revenueCeiling > 0) { revenue = Math.min(revenue, b.revenueCeiling * idx); }
    var hasManager = managerHired(b, age, share);
    var ownerProduced = Math.min(revenue, b.ownerCapacity * idx * share);
    var revPer = b.revenuePerProducer * idx;
    if (b.marginMode === 'direct') { return revenue * b.operatingMargin * sc.marginFactor; }
    var materials = revenue * b.materialsPct;
    var producers = revPer > 0 ? Math.max(0, revenue - ownerProduced) / revPer : 0;
    var producerCost = producers * b.costPerProducer * idx;
    var overhead = revenue * (b.overheadPct + b.marketingPct)
                 + b.fixedOverhead * idx * Math.pow(revenue / (b.revenueY1 * idxOpen), b.fixedOverheadScaling);
    var managerCost = hasManager ? b.managerSalary * idx : 0;
    return (revenue - materials - producerCost - overhead - managerCost) * sc.marginFactor;
  }

  function businessYear(b, cfg, sc, age, idx) {
    var bt = age - b.startAge;              /* years since opening */
    var growth = b.revenueGrowth * sc.revenueGrowth;
    /* CONVENTION: every business input is stated in today's dollars and
       carried forward by `idx`, the same index as wages and living costs.
       Revenue then grows by the user's rate ON TOP of that being a
       nominal figure, so `idx` is applied at the opening year only.
       Get this wrong in either direction and margins drift for no
       reason anyone can see - costs inflating against a frozen billing
       rate wipes out a healthy company by year ten. */
    var idxOpen = Math.pow(1 + cfg.inflation, b.startAge - cfg.startAge);
    var revenue = b.revenueY1 * idxOpen * Math.pow(1 + growth, bt);
    if (b.revenueCeiling > 0) {
      revenue = Math.min(revenue, b.revenueCeiling * idx);
    }

    /* How much of the work the owner still does personally. Full
       capacity until the business-owner milestone, then a straight
       taper to zero by the investor milestone. This single number
       drives owner dependency, hours worked and time freedom. */
    var targetShare = 1;
    if (b.ownerStage && age >= b.ownerStage) {
      if (b.investorStage && b.investorStage > b.ownerStage) {
        targetShare = clamp(1 - (age - b.ownerStage) / (b.investorStage - b.ownerStage), 0, 1);
      } else {
        targetShare = 0.5;
      }
    }
    /* Step back only as far as the numbers allow. If replacing the
       owner's own production costs more than that production earns,
       the owner stays in the chair - and the dependency score should
       say so rather than the company quietly going bankrupt. */
    var ownerShare = targetShare;
    var forced = false;
    if (targetShare < 1) {
      var atTarget = sdeAtShare(b, cfg, sc, age, idx, targetShare);
      if (atTarget < viabilityFloor(b, cfg, sc, age, idx)) {
        var lo = targetShare, hi = 1;
        for (var it = 0; it < 12; it++) {
          var mid = (lo + hi) / 2;
          if (sdeAtShare(b, cfg, sc, age, idx, mid) < viabilityFloor(b, cfg, sc, age, idx)) { lo = mid; } else { hi = mid; }
        }
        ownerShare = hi;
        forced = ownerShare > targetShare + 0.01;
      }
    }
    var ownerProduced = Math.min(revenue, b.ownerCapacity * idx * ownerShare);
    /* A tech's billing rate rises with inflation exactly as their wage
       does, so both sides of the ratio carry `idx`. */
    var revPerProducer = b.revenuePerProducer * idx;
    var hasManager = managerHired(b, age, ownerShare);

    var materials, producerCost, overhead, managerCost, producers, sde;

    if (b.marginMode === 'direct') {
      materials = revenue * (1 - b.grossMargin);
      sde = revenue * b.operatingMargin * sc.marginFactor;
      producerCost = Math.max(0, revenue * b.grossMargin - sde - revenue * (b.overheadPct + b.marketingPct));
      overhead = revenue * (b.overheadPct + b.marketingPct);
      managerCost = hasManager ? b.managerSalary * idx : 0;
      producers = revPerProducer > 0 ? Math.max(0, revenue - ownerProduced) / revPerProducer : 0;
    } else {
      materials = revenue * b.materialsPct;
      /* Fractional producers on purpose: a half-loaded second truck is
         a real thing, and rounding up invents payroll that nobody pays. */
      producers = revPerProducer > 0 ? Math.max(0, revenue - ownerProduced) / revPerProducer : 0;
      producerCost = producers * b.costPerProducer * idx;
      overhead = revenue * (b.overheadPct + b.marketingPct)
               + b.fixedOverhead * idx * Math.pow(revenue / (b.revenueY1 * idxOpen), b.fixedOverheadScaling);
      managerCost = hasManager ? b.managerSalary * idx : 0;
      sde = (revenue - materials - producerCost - overhead - managerCost) * sc.marginFactor;
    }

    /* EBITDA = profit after paying someone to do everything the owner
       still does personally. This is the number a buyer cares about. */
    var replaceOwnerLabour = revPerProducer > 0
      ? (ownerProduced / revPerProducer) * b.costPerProducer * idx : 0;
    var replaceOwnerMgmt = hasManager ? 0 : b.managerSalary * idx;
    var ebitda = sde - replaceOwnerLabour - replaceOwnerMgmt;

    var capex = revenue * b.capexPct;
    var marketing = revenue * b.marketingPct;
    /* Support staff scale with the work, but not one-for-one. */
    var support = b.supportStaffY1 > 0
      ? b.supportStaffY1 * Math.pow(revenue / (b.revenueY1 * idxOpen), b.fixedOverheadScaling) : 0;

    /* Owner dependency, computed rather than asserted (spec s.13).
       10 = the company runs without the owner. */
    var prodDependency = revenue > 0 ? ownerProduced / revenue : 1;
    var dependency = 10
      - prodDependency * 6                      /* still on the tools */
      - (hasManager ? 0 : 2.2)                  /* nobody runs it but you */
      - (producers < 1 ? 1.2 : 0)               /* no crew at all */
      + (b.quality.recurringRevenue - 5) * 0.15;
    dependency = clamp(dependency, 1, 10);

    return {
      revenue: revenue, materials: materials, producerCost: producerCost,
      overhead: overhead, managerCost: managerCost, marketing: marketing,
      producers: producers,
      supportStaff: support,
      employees: Math.round(producers + support + (hasManager ? 1 : 0)),
      ownerProduced: ownerProduced, ownerShare: ownerShare, hasManager: hasManager,
      targetOwnerShare: targetShare, stepBackBlocked: forced,
      sde: sde, ebitda: ebitda, capex: capex,
      grossMarginActual: revenue > 0 ? (revenue - materials) / revenue : 0,
      sdeMarginActual: revenue > 0 ? sde / revenue : 0,
      ownerDependency: dependency,
      yearsOpen: bt + 1
    };
  }

  /* Valuation. The quality factors move the multiple visibly rather
     than silently, because "why is it worth that" is the first
     question anyone asks. */
  function valueBusiness(b, by, sc, idx) {
    var q = b.quality;
    /* Owner independence is measured, not typed, when the labour model
       is running - it is the same thing the dependency score reports. */
    var quality = [
      by.ownerDependency, q.recurringRevenue, q.customerSpread,
      by.hasManager ? Math.max(q.managementTeam, 7) : q.managementTeam,
      q.assetBase, q.growthRate
    ];
    var avgQ = sum(quality) / quality.length;
    var qFactor = clamp(0.7 + 0.06 * avgQ, 0.55, 1.45);
    var multiple = b.valuationMultiple * qFactor * sc.multipleFactor;

    var base, basis;
    if (b.valuationMethod === 'ebitda')      { base = by.ebitda; basis = 'EBITDA'; }
    else if (b.valuationMethod === 'profit') { base = by.sde - by.capex; basis = 'annual profit after capex'; }
    else if (b.valuationMethod === 'manual') { base = 0; basis = 'user-entered value'; }
    else                                     { base = by.sde; basis = 'SDE'; }

    var value = b.valuationMethod === 'manual'
      ? b.manualValuation * idx
      : Math.max(0, base) * multiple;

    /* A business with no earnings is still worth its equipment. */
    var assetFloor = (b.quality.assetBase / 10) * by.revenue * 0.10;
    value = Math.max(value, assetFloor);

    return {
      value: value, multiple: multiple, baseMultiple: b.valuationMultiple,
      qualityFactor: qFactor, avgQuality: avgQ, basis: basis, base: base,
      assetFloor: assetFloor
    };
  }

  /* ---------------------------------------------------------------
     ONE CAREER, YEAR BY YEAR
     --------------------------------------------------------------- */
  function runCareer(career, cfg, opts) {
    opts = opts || {};
    var sc = D.SCENARIOS[cfg.scenario] || D.SCENARIOS.realistic;
    var taxer = makeTaxer(cfg);
    var startAge = cfg.startAge;
    var years = cfg.years;
    var infl = cfg.inflation;
    var ret = clamp(cfg.investReturn + sc.investReturn, -0.05, 0.20);
    var wageGrowth = Math.max(0, cfg.salaryGrowth + sc.salaryGrowth);

    var b = career.business;
    var bizOn = !!(b && b.enabled && opts.forceEmployee !== true);
    if (opts.forceOwner === true && b) { bizOn = true; }

    var edu = educationSchedule(career, startAge, years);

    /* ---- running state ---- */
    var investments = 0;         /* non-registered + registered combined */
    var registered = 0;          /* tracked separately for the tax deduction */
    var cash = opts.startingCash || 0;
    var studentDebt = 0;
    var studentTuitionDebt = 0;  /* split out for the report */
    var studentLivingDebt = 0;
    var studentPaymentFixed = 0;
    var consumerDebt = 0;
    var bizLoan = 0, bizLoanPayment = 0, bizLine = 0;
    var bizCash = 0;
    var lossStreak = 0;
    var homeValue = 0, mortgage = 0, mortgagePaymentFixed = 0, owned = false;
    var bizFailed = false, bizFailedAge = null;
    var cumEarnings = 0, cumTax = 0, cumHours = 0, cumInvested = 0, cumEduSpend = 0, cumInterest = 0;
    var cumInvestReturns = 0;
    var debtFreeAge = null, firstPositiveNetWorthAge = null, freedomAge = null, freedomSaleAge = null;
    var everBorrowed = false;
    var peakBizValue = 0;

    var housing = cfg.housing;
    var baseLiving = career.living.expenses;
    var rows = [];

    for (var t = 0; t < years; t++) {
      var age = startAge + t;
      var idx = Math.pow(1 + infl, t);          /* inflation index */
      var wageF = Math.pow(1 + wageGrowth, t);  /* wage drift on top of stages */
      var eduRow = edu.rows[t];

      /* ---------- 1. business, if it is running this year ---------- */
      var bizActive = bizOn && age >= b.startAge && !bizFailed;
      var by = null, val = null;
      if (bizActive) {
        by = businessYear(b, cfg, sc, age, idx);
        /* Losing money with the owner already flat out is a failing
           business, not a borrowing opportunity. Wind it up, realise
           what the equipment is worth, and go back to work. */
        if ((by.sde < 0 && by.ownerShare >= 0.99) || lossStreak >= 4) {
          bizFailed = true; bizFailedAge = age; bizActive = false; by = null;
          /* Wind up: the equipment sells, the debt does not vanish. */
          var salvage = (b.quality.assetBase / 10) * 0.10 * b.revenueY1 * idx;
          cash += Math.max(0, bizCash);
          consumerDebt += Math.max(0, bizLoan + bizLine - salvage);
          bizCash = 0; bizLoan = 0; bizLine = 0; bizLoanPayment = 0;
        } else {
          val = valueBusiness(b, by, sc, idx);
          peakBizValue = Math.max(peakBizValue, val.value);
        }
      }

      /* ---------- 2. personal income ---------- */
      var st = stageAt(career.stages, age);
      var employed = !bizActive;
      var wages = 0, overtime = 0, bonus = 0, benefits = 0, pension = 0, vehicle = 0, otherComp = 0;
      if (employed) {
        wages    = st.base * wageF;
        overtime = st.overtime * wageF;
        bonus    = st.bonus * wageF;
        benefits = st.benefits * idx;
        pension  = st.pension * idx;
        vehicle  = st.vehicle * idx;
        otherComp = (st.other || 0) * wageF;
      }

      var ownerSalary = 0, distributions = 0, bizDebtService = 0, retained = 0, ownerSalaryShortfall = 0;
      if (bizActive) {
        /* Opening year: equity in from the owner's own pocket, the
           rest borrowed. */
        if (age === b.startAge) {
          var equityIn = b.startupInvestment * (1 - b.startupLoanShare) * idx;
          bizLoan = b.startupInvestment * b.startupLoanShare * idx;
          bizLoanPayment = payment(bizLoan, b.startupLoanRate, b.startupLoanYears);
          /* Paid from cash first, then by selling investments. */
          var fromCash = Math.min(cash, equityIn);
          cash -= fromCash;
          var shortfall = equityIn - fromCash;
          if (shortfall > 0) {
            var fromInv = Math.min(investments, shortfall);
            investments -= fromInv;
            shortfall -= fromInv;
            if (shortfall > 0) { consumerDebt += shortfall; }
          }
        }

        /* TWO kinds of business debt, kept apart on purpose. The startup
           loan amortises on a fixed schedule and ENDS. An operating line
           revolves. Running both through one balance meant the level
           payment never terminated - every dollar of loss funding
           extended the loan, so the practice paid its opening loan
           forever and bled to death on paper. */
        var loanInterest = bizLoan * b.startupLoanRate;
        var loanPay = Math.min(bizLoanPayment, bizLoan + loanInterest);
        bizLoan = Math.max(0, bizLoan + loanInterest - loanPay);
        if (bizLoan <= 1) { bizLoan = 0; bizLoanPayment = 0; }
        var lineInterest = bizLine * (b.startupLoanRate + 0.02);
        bizLine += lineInterest;
        bizDebtService = loanPay + lineInterest;

        var wcNeed = by.revenue * b.workingCapitalPct;
        var wcPrev = by.yearsOpen > 1
          ? businessYear(b, cfg, sc, age - 1, idx / (1 + infl)).revenue * b.workingCapitalPct : 0;
        var wcDelta = Math.max(0, wcNeed - wcPrev);

        /* The equipment, the working capital and the bank are real cash
           calls, so they are reserved before the owner is paid - but the
           owner is never left on nothing while the company is profitable,
           hence the floor at 40% of target. */
        var reserve = by.capex + bizDebtService + wcDelta;
        var target = b.ownerSalary * Math.pow(1 + b.ownerSalaryGrowth, by.yearsOpen - 1) * idx;
        ownerSalary = clamp(target, 0, Math.max(target * 0.4, by.sde - reserve));
        ownerSalary = Math.max(0, Math.min(ownerSalary, by.sde));
        ownerSalaryShortfall = Math.max(0, target - ownerSalary);

        var freeCash = by.sde - ownerSalary - reserve;
        if (freeCash >= 0) {
          /* Clear the operating line before taking money out. */
          var lineRepay = Math.min(bizLine, freeCash);
          bizLine -= lineRepay;
          var afterLine = freeCash - lineRepay;
          distributions = afterLine * b.distributionShare;
          retained = afterLine - distributions;
          bizCash += retained;
          lossStreak = 0;
        } else {
          var fromBizCash = Math.min(bizCash, -freeCash);
          bizCash -= fromBizCash;
          bizLine += (-freeCash - fromBizCash);
          retained = freeCash;
          lossStreak++;
        }
      }

      /* ---------- 3. education spend and school-year borrowing ---------- */
      var eduSpend = eduRow.netSpend * idx;
      cumEduSpend += eduSpend;

      /* Living costs. Cheaper while in unpaid school, and they creep
         upward with income rather than staying frozen for 20 years. */
      /* A student's cost of living is its own number, not a discount on
         the career's eventual lifestyle. Blending the two is how you end
         up borrowing a professional's living costs for seven years. */
      var studentCost = (career.education.studentLivingCost == null ? 22000 : career.education.studentLivingCost) * idx;
      var livingBase = baseLiving * idx * (1 - eduRow.unpaidShare) + studentCost * eduRow.unpaidShare;
      var housingCost = owned ? homeValue * housing.annualCostPct : 0;

      /* ---------- 4. tax, with one pass for the registered deduction ---------- */
      var wagesTotal = wages + overtime + bonus + otherComp + ownerSalary;
      var earnedForRoom = wagesTotal;
      var tax0 = taxer.compute(wagesTotal, distributions, 0, idx);
      var afterTax0 = wagesTotal + distributions - tax0.income - tax0.payroll;

      /* A floor you cannot live below, plus a share of everything above
         it. Spending tracks income in real life; a single flat figure
         either bankrupts the junior or under-spends the principal. */
      var floorCost = livingBase * 0.6;
      var living = floorCost + career.living.creep * Math.max(0, afterTax0 - floorCost);
      /* Employer-paid benefits and a company truck are not cash, but they
         do displace spending, so they belong on the expense side. */
      living = Math.max(floorCost * 0.8, living - Math.min(benefits + vehicle, livingBase * 0.25));

      /* ---------- 5. cash available before investing ---------- */
      var studentPayment = 0, studentInterest = 0;
      /* Interest accrues from day one; payments start once school ends. */
      if (studentDebt > 0) {
        studentInterest = studentDebt * career.debt.rate;
        var repaying = !eduRow.inSchool;
        if (repaying) {
          if (studentPaymentFixed <= 0) {
            studentPaymentFixed = payment(studentDebt + studentInterest, career.debt.rate, career.debt.termYears);
          }
          studentPayment = Math.min(studentPaymentFixed, studentDebt + studentInterest);
        }
        studentDebt = studentDebt + studentInterest - studentPayment;
        cumInterest += studentInterest;
        everBorrowed = true;
        if (studentDebt <= 1 && debtFreeAge === null) { studentDebt = 0; debtFreeAge = age; }
      }

      /* Buy the house, if this is the year. */
      var mortgagePayment = 0;
      if (housing.enabled && !owned && age >= housing.buyAge) {
        var price = housing.price * idx;
        var down = price * housing.downPct;
        /* Check affordability BEFORE spending anything. Deducting first
           and buying second loses the down payment in every year the
           person cannot yet afford the house. */
        if (cash + investments >= down) {
          var fromCash = Math.min(cash, down);
          cash -= fromCash;
          investments -= (down - fromCash);
          owned = true;
          homeValue = price;
          mortgage = price - down;
          mortgagePaymentFixed = payment(mortgage, housing.mortgageRate, housing.mortgageYears);
          housingCost = homeValue * housing.annualCostPct;
        }
        /* Otherwise ownership simply waits for the down payment. */
      }
      if (owned && mortgage > 0) {
        var mInt = mortgage * housing.mortgageRate;
        mortgagePayment = Math.min(mortgagePaymentFixed, mortgage + mInt);
        mortgage = Math.max(0, mortgage + mInt - mortgagePayment);
      }
      if (owned) { homeValue *= (1 + housing.appreciation); }

      var outflow = living + housingCost + eduSpend + studentPayment + mortgagePayment;
      var investableRaw = afterTax0 - outflow;
      /* Austerity before borrowing: up to 30% comes off discretionary
         spending first. Real households cut back; they do not fund a
         twenty-year shortfall on a credit card. */
      if (investableRaw < 0) {
        var cut = Math.min(-investableRaw, living * 0.30);
        living -= cut;
        outflow -= cut;
        investableRaw += cut;
      }

      /* ---------- 6. invest, or cover the shortfall ---------- */
      var contrib = 0, refund = 0;
      if (investableRaw > 0) {
        contrib = cfg.investing.mode === 'percent'
          ? investableRaw * cfg.investing.percent
          : Math.min(investableRaw, cfg.investing.fixedAmount * idx);
        /* Employer pension is money invested that never touched the
           chequing account - it belongs in the balance. */
        var regContrib = Math.min(contrib * cfg.investing.registeredShare,
                                  taxer.registeredRoom(earnedForRoom, idx));
        var taxWithDeduction = taxer.compute(wagesTotal, distributions, regContrib, idx);
        refund = Math.max(0, tax0.income - taxWithDeduction.income);
        registered += regContrib;
        cash += investableRaw - contrib + refund;
      } else {
        /* Shortfall: cash, then investments, then the credit card. */
        var gap = -investableRaw;
        var useCash = Math.min(cash, gap); cash -= useCash; gap -= useCash;
        if (gap > 0) { var useInv = Math.min(investments, gap); investments -= useInv; gap -= useInv; }
        if (gap > 0) {
          /* A shortfall during school is student borrowing, whether or
             not tuition happened to be charged that year. Sending it to
             a 12% consumer balance instead - which is what happens if
             you key this off tuition alone - misprices the whole of a
             long degree's final years. */
          if (eduRow.inSchool || eduSpend > 0) {
            var eduShare = Math.min(gap, eduSpend);
            studentTuitionDebt += eduShare;
            studentLivingDebt += gap - eduShare;
            studentDebt += gap;
          } else {
            consumerDebt += gap;
          }
        }
      }

      if (consumerDebt > 0) {
        var cInt = consumerDebt * 0.12;
        consumerDebt += cInt;
        var payDown = Math.min(cash * 0.5, consumerDebt);
        cash -= payDown; consumerDebt -= payDown;
      }

      /* Compound. Mid-year convention on the year's contribution. The
         return credited this year is kept separately so the story can
         say how much of the balance was earned rather than deposited. */
      var investReturn = investments * ret + (contrib + pension) * ret / 2;
      investments = investments * (1 + ret) + (contrib + pension) * (1 + ret / 2);
      cash = cash * (1 + Math.min(infl, 0.03));
      cumInvested += contrib + pension;
      cumInvestReturns += investReturn;

      /* ---------- 7. balance sheet ---------- */
      var homeEquity = owned ? Math.max(0, homeValue - mortgage) : 0;
      var bizEquity = bizActive ? (val.value + bizCash - bizLoan - bizLine) : 0;
      var netWorth = investments + cash + homeEquity + bizEquity - studentDebt - consumerDebt;
      if (netWorth > 0 && firstPositiveNetWorthAge === null) { firstPositiveNetWorthAge = age; }

      /* ---------- 8. hours ---------- */
      var L = career.lifestyle;
      var weeksWorked = Math.max(0, 52 - L.vacationWeeks);
      var weekly = L.hoursPerWeek + L.overtimeHours;
      if (bizActive) {
        /* Ownership costs hours, and stepping back gives them back. */
        if (by.ownerShare > 0.75)      { weekly += 8; }
        else if (by.ownerShare > 0.25) { weekly += 4; }
        else                           { weekly -= 6; }
        weeksWorked = Math.max(0, 52 - Math.max(1, L.vacationWeeks * (by.hasManager ? 2 : 0.6)));
      }
      /* Time in class is not time on the clock. Summer and part-time work
         during school is counted at `schoolWorkHours`. */
      var schoolHours = career.education.schoolWorkHours == null ? 700 : career.education.schoolWorkHours;
      var hours = weekly * weeksWorked * (1 - eduRow.unpaidShare) + schoolHours * eduRow.unpaidShare;
      cumHours += hours;

      /* ---------- 9. running totals ---------- */
      var personalIncome = wagesTotal + distributions;
      cumEarnings += personalIncome;
      cumTax += tax0.income + tax0.payroll - refund;

      /* Financial freedom: portfolio withdrawal plus the share of
         distributions that would survive the owner stepping back. */
      var passiveShare = bizActive ? clamp(by.ownerDependency / 10, 0, 1) : 0;
      /* Two honest answers, because they are different lives:
         - keep the business: only the share of distributions that would
           survive you stepping back counts as income you can rely on;
         - sell the business: the equity joins the portfolio and the
           whole thing gets drawn down at the safe rate. */
      var passiveIncome = investments * cfg.safeWithdrawal + distributions * passiveShare;
      var needed = living + housingCost;
      if (freedomAge === null && passiveIncome >= needed) { freedomAge = age; }
      var saleIncome = (investments + Math.max(0, bizEquity)) * cfg.safeWithdrawal;
      if (freedomSaleAge === null && saleIncome >= needed) { freedomSaleAge = age; }

      rows.push({
        t: t, age: age, idx: idx,
        stage: bizActive ? bizPhaseLabel(b, age, by) : st.label,
        phase: bizActive ? bizPhase(b, age, by) : (eduRow.unpaidShare > 0.5 ? 'school' : employmentPhase(career, st)),
        inSchool: eduRow.inSchool, unpaidShare: eduRow.unpaidShare,

        wages: wages, overtime: overtime, bonus: bonus, benefits: benefits,
        pension: pension, vehicle: vehicle, otherComp: otherComp,
        ownerSalary: ownerSalary, distributions: distributions,
        ownerSalaryShortfall: ownerSalaryShortfall,
        personalIncome: personalIncome,
        totalCompensation: personalIncome + benefits + vehicle + pension,

        incomeTax: tax0.income - refund, payroll: tax0.payroll, marginalRate: tax0.marginal,
        afterTax: afterTax0 + refund,

        living: living, housingCost: housingCost, eduSpend: eduSpend,
        studentPayment: studentPayment, studentInterest: studentInterest,
        mortgagePayment: mortgagePayment,
        investable: investableRaw, contribution: contrib + pension,
        investReturn: investReturn, cumInvestReturns: cumInvestReturns,

        investments: investments, cash: cash, registered: registered,
        homeValue: owned ? homeValue : 0, mortgage: mortgage, homeEquity: homeEquity,
        studentDebt: studentDebt, consumerDebt: consumerDebt,
        businessDebt: bizActive ? (bizLoan + bizLine) : 0,
        businessLoan: bizActive ? bizLoan : 0, businessLine: bizActive ? bizLine : 0,
        businessCash: bizActive ? bizCash : 0,
        totalDebt: studentDebt + consumerDebt + mortgage + (bizActive ? (bizLoan + bizLine) : 0),

        business: by, valuation: val,
        businessEquity: bizEquity, businessValue: bizActive ? val.value : 0,
        ownerDependency: bizActive ? by.ownerDependency : null,

        netWorth: netWorth,
        netWorthReal: netWorth / idx,
        cumEarnings: cumEarnings, cumTax: cumTax, cumHours: cumHours,
        cumInvested: cumInvested, cumEduSpend: cumEduSpend,
        hours: hours
      });
    }

    var last = rows[rows.length - 1];
    return {
      name: career.name,
      type: career.type,
      note: career.note,
      career: career,
      rows: rows,
      isOwner: bizOn,
      education: edu,
      professionalStartAge: professionalStartAge(career),
      totals: {
        careerEarnings: last.cumEarnings,
        totalTax: last.cumTax,
        educationGross: edu.totalGross,
        educationOffsets: edu.totalOffset,
        educationNet: last.cumEduSpend,
        educationInterest: cumInterest,
        educationTotalCost: last.cumEduSpend + cumInterest,
        studentTuitionDebt: studentTuitionDebt,
        studentLivingDebt: studentLivingDebt,
        peakStudentDebt: Math.max.apply(null, rows.map(function (r) { return r.studentDebt; })),
        investments: last.investments,
        invested: last.cumInvested,
        investmentGrowth: last.cumInvestReturns,
        cash: last.cash,
        homeEquity: last.homeEquity,
        businessEquity: last.businessEquity,
        businessValue: last.businessValue,
        peakBusinessValue: peakBizValue,
        debt: last.studentDebt + last.consumerDebt + last.mortgage + last.businessDebt,
        netWorth: last.netWorth,
        netWorthReal: last.netWorthReal,
        hours: last.cumHours,
        wealthPerHour: last.cumHours > 0 ? last.netWorth / last.cumHours : 0,
        earningsPerHour: last.cumHours > 0 ? last.cumEarnings / last.cumHours : 0,
        finalOwnerDependency: last.ownerDependency,
        finalEmployees: last.business ? last.business.employees : 0
      },
      milestones: {
        businessFailedAge: bizFailedAge,
        debtFreeAge: debtFreeAge === null && !everBorrowed ? startAge : debtFreeAge,
        neverBorrowed: !everBorrowed,
        firstPositiveNetWorthAge: firstPositiveNetWorthAge,
        financialFreedomAge: freedomAge,
        financialFreedomAgeWithSale: freedomSaleAge,
        businessStartAge: bizOn && b ? b.startAge : null,
        ownerStageAge: bizOn && b && b.ownerStage ? b.ownerStage : null,
        investorStageAge: bizOn && b && b.investorStage ? b.investorStage : null
      }
    };
  }

  function employmentPhase(career, st) {
    var l = (st.label || '').toLowerCase();
    if (l.indexOf('apprentice') >= 0) { return 'apprentice'; }
    if (l.indexOf('helper') >= 0) { return 'helper'; }
    if (l.indexOf('student') >= 0 || l.indexOf('school') >= 0 || l.indexOf('undergrad') >= 0) { return 'school'; }
    if (l.indexOf('lead') >= 0 || l.indexOf('foreman') >= 0 || l.indexOf('manager') >= 0 ||
        l.indexOf('head') >= 0 || l.indexOf('charge') >= 0) { return 'leader'; }
    return 'employee';
  }
  function bizPhase(b, age, by) {
    if (by.hasManager) { return 'investor'; }
    if (b.ownerStage && age >= b.ownerStage) { return 'businessowner'; }
    return 'owneroperator';
  }
  function bizPhaseLabel(b, age, by) {
    var p = bizPhase(b, age, by);
    if (p === 'investor') { return 'Investor - manager runs it'; }
    if (p === 'businessowner') { return 'Business owner - ' + by.employees + ' on payroll'; }
    return 'Owner-operator';
  }

  /* ---------------------------------------------------------------
     THE HEAD START (spec s.15)
     What Career A banks before Career B earns a real income.
     --------------------------------------------------------------- */
  function headStart(a, bResult) {
    var aStart = a.professionalStartAge;
    var bStart = bResult.professionalStartAge;
    var leader = aStart <= bStart ? a : bResult;
    var laggard = aStart <= bStart ? bResult : a;
    var window = Math.abs(bStart - aStart);
    if (window <= 0) { return { years: 0, leader: null }; }

    var upto = laggard.professionalStartAge;
    var lRows = leader.rows.filter(function (r) { return r.age < upto; });
    var gRows = laggard.rows.filter(function (r) { return r.age < upto; });
    if (!lRows.length) { return { years: 0, leader: null }; }
    var lLast = lRows[lRows.length - 1];
    var gLast = gRows.length ? gRows[gRows.length - 1] : null;

    return {
      years: window,
      leader: leader.name,
      laggard: laggard.name,
      fromAge: leader.professionalStartAge,
      toAge: upto,
      incomeEarned: lLast.cumEarnings,
      laggardIncomeEarned: gLast ? gLast.cumEarnings : 0,
      investmentsAccumulated: lLast.investments + lLast.cash,
      pensionIncluded: sum(lRows.map(function (r) { return r.pension; })),
      debtAvoided: gLast ? Math.max(0, gLast.studentDebt - lLast.studentDebt) : 0,
      educationSpendAvoided: gLast ? Math.max(0, gLast.cumEduSpend - lLast.cumEduSpend) : 0,
      netWorthGap: lLast.netWorth - (gLast ? gLast.netWorth : 0),
      total: (lLast.cumEarnings - (gLast ? gLast.cumEarnings : 0))
           + (gLast ? Math.max(0, gLast.studentDebt - lLast.studentDebt) : 0)
    };
  }

  /* First age where the trailing career passes the leader and stays
     passed for the rest of the run. "Stays" matters: a one-year
     crossing during a business start-up is not a catch-up. */
  function crossover(a, b, key) {
    key = key || 'netWorth';
    var n = Math.min(a.rows.length, b.rows.length);
    var aheadAtStart = a.rows[0][key] >= b.rows[0][key];
    for (var i = 0; i < n; i++) {
      var aLead = a.rows[i][key] >= b.rows[i][key];
      if (aLead !== aheadAtStart) {
        var stays = true;
        for (var j = i; j < n; j++) {
          if ((a.rows[j][key] >= b.rows[j][key]) === aheadAtStart) { stays = false; break; }
        }
        if (stays) {
          return {
            age: a.rows[i].age, year: i,
            passer: aLead ? a.name : b.name,
            passed: aLead ? b.name : a.name,
            value: aLead ? a.rows[i][key] : b.rows[i][key]
          };
        }
      }
    }
    return null;
  }

  /* ---------------------------------------------------------------
     PUBLIC ENTRY
     --------------------------------------------------------------- */
  var PROJECT_TO_AGE = 75;

  function run(cfg) {
    var a = runCareer(cfg.careers.a, cfg, cfg.careers.aOpts);
    var b = runCareer(cfg.careers.b, cfg, cfg.careers.bOpts);

    /* The comparison window is what gets reported. But "when does the
       dentist catch up" and "when is each of them free" are usually
       answers that live past year 20, and "never" would be a false
       answer rather than a cautious one. So run the identical model out
       to 75 and mark anything past the window as a projection. */
    var far = null;
    if (cfg.startAge + cfg.years < PROJECT_TO_AGE) {
      var farCfg = JSON.parse(JSON.stringify(cfg));
      farCfg.years = PROJECT_TO_AGE - cfg.startAge;
      farCfg.careers = cfg.careers;
      var fa = runCareer(cfg.careers.a, farCfg, cfg.careers.aOpts);
      var fb = runCareer(cfg.careers.b, farCfg, cfg.careers.bOpts);
      far = { a: fa, b: fb, crossoverNetWorth: crossover(fa, fb, 'netWorth'),
              crossoverInvestments: crossover(fa, fb, 'investments') };
      /* Adopt the projected freedom age when the window could not see it. */
      [[a, fa], [b, fb]].forEach(function (pair) {
        var m = pair[0].milestones, fm = pair[1].milestones;
        if (m.financialFreedomAge === null) { m.financialFreedomAge = fm.financialFreedomAge; m.freedomProjected = true; }
        if (m.financialFreedomAgeWithSale === null) { m.financialFreedomAgeWithSale = fm.financialFreedomAgeWithSale; m.freedomSaleProjected = true; }
        if (m.debtFreeAge === null) { m.debtFreeAge = fm.debtFreeAge; m.debtFreeProjected = true; }
      });
    }

    var xNet = crossover(a, b, 'netWorth');
    var xNetProjected = false;
    if (!xNet && far && far.crossoverNetWorth) { xNet = far.crossoverNetWorth; xNetProjected = true; }

    return {
      cfg: cfg,
      scenario: D.SCENARIOS[cfg.scenario] || D.SCENARIOS.realistic,
      a: a, b: b,
      projection: far,
      projectToAge: PROJECT_TO_AGE,
      headStart: headStart(a, b),
      crossoverNetWorth: xNet,
      crossoverNetWorthProjected: xNetProjected,
      crossoverInvestments: crossover(a, b, 'investments'),
      crossoverEarnings: crossover(a, b, 'cumEarnings')
    };
  }

  /* Same inputs, all three scenarios - for the comparison matrix. */
  function runAllScenarios(cfg) {
    var out = {};
    ['conservative', 'realistic', 'aggressive'].forEach(function (s) {
      var c = JSON.parse(JSON.stringify(cfg));
      c.scenario = s;
      /* JSON round-trip loses nothing here: config is plain data. */
      out[s] = run(c);
    });
    return out;
  }

  /* Employee-versus-owner for a single career (spec s.20). */
  function employeeVsOwner(cfg, which) {
    var c = JSON.parse(JSON.stringify(cfg));
    var career = which === 'b' ? c.careers.b : c.careers.a;
    var asEmployee = runCareer(career, c, { forceEmployee: true });
    var asOwner = runCareer(career, c, { forceOwner: true });
    return { employee: asEmployee, owner: asOwner, career: career.name };
  }

  BCB.engine = {
    run: run,
    runCareer: runCareer,
    runAllScenarios: runAllScenarios,
    employeeVsOwner: employeeVsOwner,
    headStart: headStart,
    crossover: crossover,
    helpers: {
      payment: payment, bracketTax: bracketTax, marginalRate: marginalRate,
      makeTaxer: makeTaxer, businessYear: businessYear, valueBusiness: valueBusiness,
      educationSchedule: educationSchedule, professionalStartAge: professionalStartAge,
      clamp: clamp
    }
  };

})(typeof window !== 'undefined' ? window : globalThis);
