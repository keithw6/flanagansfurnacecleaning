/* =====================================================================
   Blue Collar Business - The 20-Year Test
   presets.js : career presets, tax tables, scenario multipliers, defaults

   HONESTY NOTE (see section 18 of the spec):
   Every number in this file is a STARTING ESTIMATE, not a verified fact.
   Each block carries a `conf` field - one of:
       'verified'  the operator has a document backing this figure
       'industry'  typical published range for the trade/profession
       'estimated' our own reasoned estimate
       'user'      typed in by whoever is running the comparison
   Presets ship as 'industry' or 'estimated' and NEVER as 'verified'.
   The UI must show the tag next to the value. Do not present these as facts.
   ===================================================================== */
(function (global) {
  'use strict';

  var BCB = global.BCB = global.BCB || {};

  /* ---------------------------------------------------------------
     TAX TABLES
     Simplified progressive brackets. Thresholds are indexed to
     inflation inside the engine, because real brackets move too.
     These are approximations for modelling, not tax advice.
     --------------------------------------------------------------- */
  var TAX = {
    CA: {
      label: 'Canada',
      currency: 'CAD',
      federal: {
        credit: 16129,
        rate1: 0.15,
        brackets: [
          [57375, 0.15], [114750, 0.205], [177882, 0.26], [253414, 0.29], [Infinity, 0.33]
        ]
      },
      /* Employee payroll: CPP (base + CPP2) and EI, employee share only. */
      payroll: {
        label: 'CPP + EI',
        items: [
          { name: 'CPP',  rate: 0.0595, exempt: 3500,  max: 71300 },
          { name: 'CPP2', rate: 0.04,   exempt: 71300, max: 81200 },
          { name: 'EI',   rate: 0.0164, exempt: 0,     max: 65700 }
        ]
      },
      /* Small-business corporate rate, used when profit is retained
         in the company rather than paid out to the owner. */
      corporate: { smallBusiness: 0.11, threshold: 500000, general: 0.23 },
      /* Rough grossed-up/credited effective personal rate on
         non-eligible dividends, as a fraction of the personal
         marginal rate. Keeps distributions from being taxed as wages. */
      dividendFactor: 0.78,
      regions: {
        AB: { label: 'Alberta',          credit: 22323, brackets: [[60000,0.08],[151234,0.10],[181481,0.12],[241974,0.13],[362961,0.14],[Infinity,0.15]] },
        BC: { label: 'British Columbia', credit: 12932, brackets: [[49279,0.0506],[98560,0.077],[113158,0.105],[137407,0.1229],[186306,0.147],[259829,0.168],[Infinity,0.205]] },
        ON: { label: 'Ontario',          credit: 12747, brackets: [[52886,0.0505],[105775,0.0915],[150000,0.1116],[220000,0.1216],[Infinity,0.1316]] },
        SK: { label: 'Saskatchewan',     credit: 18991, brackets: [[53463,0.105],[152750,0.125],[Infinity,0.145]] },
        MB: { label: 'Manitoba',         credit: 15780, brackets: [[47564,0.108],[101200,0.1275],[Infinity,0.174]] },
        NS: { label: 'Nova Scotia',      credit: 11744, brackets: [[30507,0.0879],[61015,0.1495],[95883,0.1667],[154650,0.175],[Infinity,0.21]] },
        NB: { label: 'New Brunswick',    credit: 13396, brackets: [[51306,0.094],[102614,0.14],[190060,0.16],[Infinity,0.195]] },
        NL: { label: 'Newfoundland',     credit: 11067, brackets: [[44192,0.087],[88382,0.145],[157792,0.158],[220910,0.178],[282214,0.198],[564429,0.208],[1128858,0.213],[Infinity,0.218]] },
        PE: { label: 'Prince Edward Is.',credit: 14250, brackets: [[33328,0.095],[64656,0.1347],[105000,0.166],[140000,0.1762],[Infinity,0.19]] },
        QC: { label: 'Quebec',           credit: 18571, brackets: [[53255,0.14],[106495,0.19],[129590,0.24],[Infinity,0.2575]] }
      }
    },
    US: {
      label: 'United States',
      currency: 'USD',
      federal: {
        credit: 15000, /* standard deduction, single filer */
        rate1: 0.10,
        brackets: [
          [11925, 0.10], [48475, 0.12], [103350, 0.22], [197300, 0.24],
          [250525, 0.32], [626350, 0.35], [Infinity, 0.37]
        ]
      },
      payroll: {
        label: 'FICA',
        items: [
          { name: 'Social Security', rate: 0.062,  exempt: 0, max: 176100 },
          { name: 'Medicare',        rate: 0.0145, exempt: 0, max: Infinity }
        ]
      },
      corporate: { smallBusiness: 0.21, threshold: Infinity, general: 0.21 },
      dividendFactor: 0.80,
      /* All fifty states plus DC. Single filer, approximate 2025
         brackets, simplified: no local income taxes (NYC, Philadelphia
         and the Ohio municipalities are the ones that bite), no
         state-specific credits beyond a standard deduction or personal
         exemption. Nine states levy no tax on wages. Verify locally. */
      regions: {
        AL: { label: 'Alabama',        credit: 3000,  brackets: [[500,0.02],[3000,0.04],[Infinity,0.05]] },
        AK: { label: 'Alaska (no income tax)',        credit: 0, brackets: [[Infinity, 0]] },
        AZ: { label: 'Arizona',        credit: 14600, brackets: [[Infinity, 0.025]] },
        AR: { label: 'Arkansas',       credit: 2340,  brackets: [[5300,0],[10600,0.02],[15100,0.03],[25000,0.034],[Infinity,0.039]] },
        CA: { label: 'California',     credit: 5540,  brackets: [[10756,0.01],[25499,0.02],[40245,0.04],[55866,0.06],[70606,0.08],[360659,0.093],[432787,0.103],[721314,0.113],[Infinity,0.123]] },
        CO: { label: 'Colorado',       credit: 14600, brackets: [[Infinity, 0.044]] },
        CT: { label: 'Connecticut',    credit: 15000, brackets: [[10000,0.02],[50000,0.045],[100000,0.055],[200000,0.06],[250000,0.065],[500000,0.069],[Infinity,0.0699]] },
        DE: { label: 'Delaware',       credit: 3250,  brackets: [[2000,0],[5000,0.022],[10000,0.039],[20000,0.048],[25000,0.052],[60000,0.0555],[Infinity,0.066]] },
        DC: { label: 'District of Columbia', credit: 14600, brackets: [[10000,0.04],[40000,0.06],[60000,0.065],[250000,0.085],[500000,0.0925],[1000000,0.0975],[Infinity,0.1075]] },
        FL: { label: 'Florida (no income tax)',       credit: 0, brackets: [[Infinity, 0]] },
        GA: { label: 'Georgia',        credit: 12000, brackets: [[Infinity, 0.0539]] },
        HI: { label: 'Hawaii',         credit: 2200,  brackets: [[2400,0.014],[4800,0.032],[9600,0.055],[14400,0.064],[19200,0.068],[24000,0.072],[36000,0.076],[48000,0.079],[150000,0.0825],[175000,0.09],[200000,0.10],[Infinity,0.11]] },
        ID: { label: 'Idaho',          credit: 14600, brackets: [[Infinity, 0.05695]] },
        IL: { label: 'Illinois',       credit: 2850,  brackets: [[Infinity, 0.0495]] },
        IN: { label: 'Indiana',        credit: 1000,  brackets: [[Infinity, 0.03]] },
        IA: { label: 'Iowa',           credit: 14600, brackets: [[Infinity, 0.038]] },
        KS: { label: 'Kansas',         credit: 3605,  brackets: [[23000,0.052],[Infinity,0.0558]] },
        KY: { label: 'Kentucky',       credit: 3160,  brackets: [[Infinity, 0.04]] },
        LA: { label: 'Louisiana',      credit: 12500, brackets: [[Infinity, 0.03]] },
        ME: { label: 'Maine',          credit: 14600, brackets: [[26050,0.058],[61600,0.0675],[Infinity,0.0715]] },
        MD: { label: 'Maryland',       credit: 2700,  brackets: [[1000,0.02],[2000,0.03],[3000,0.04],[100000,0.0475],[125000,0.05],[150000,0.0525],[250000,0.055],[Infinity,0.0575]] },
        MA: { label: 'Massachusetts',  credit: 4400,  brackets: [[1083150,0.05],[Infinity,0.09]] },
        MI: { label: 'Michigan',       credit: 5600,  brackets: [[Infinity, 0.0425]] },
        MN: { label: 'Minnesota',      credit: 14575, brackets: [[32570,0.0535],[106990,0.068],[198630,0.0785],[Infinity,0.0985]] },
        MS: { label: 'Mississippi',    credit: 0,     brackets: [[10000,0],[Infinity,0.044]] },
        MO: { label: 'Missouri',       credit: 14600, brackets: [[1273,0],[2546,0.02],[3819,0.025],[5092,0.03],[6365,0.035],[7638,0.04],[8911,0.045],[Infinity,0.047]] },
        MT: { label: 'Montana',        credit: 14600, brackets: [[20500,0.047],[Infinity,0.059]] },
        NE: { label: 'Nebraska',       credit: 7900,  brackets: [[3700,0.0246],[22170,0.0351],[35730,0.0501],[Infinity,0.052]] },
        NV: { label: 'Nevada (no income tax)',        credit: 0, brackets: [[Infinity, 0]] },
        NH: { label: 'New Hampshire (no wage tax)',   credit: 0, brackets: [[Infinity, 0]] },
        NJ: { label: 'New Jersey',     credit: 1000,  brackets: [[20000,0.014],[35000,0.0175],[40000,0.035],[75000,0.05525],[500000,0.0637],[1000000,0.0897],[Infinity,0.1075]] },
        NM: { label: 'New Mexico',     credit: 14600, brackets: [[5500,0.015],[16500,0.032],[33500,0.043],[66500,0.047],[210000,0.049],[Infinity,0.059]] },
        NY: { label: 'New York',       credit: 8000,  brackets: [[8500,0.04],[11700,0.045],[13900,0.0525],[80650,0.055],[215400,0.06],[1077550,0.0685],[5000000,0.0965],[Infinity,0.103]] },
        NC: { label: 'North Carolina', credit: 12750, brackets: [[Infinity, 0.0425]] },
        ND: { label: 'North Dakota',   credit: 0,     brackets: [[47150,0],[225975,0.0195],[Infinity,0.025]] },
        OH: { label: 'Ohio',           credit: 26050, brackets: [[100000,0.0275],[Infinity,0.035]] },
        OK: { label: 'Oklahoma',       credit: 6350,  brackets: [[1000,0.0025],[2500,0.0075],[3750,0.0175],[4900,0.0275],[7200,0.0375],[Infinity,0.0475]] },
        OR: { label: 'Oregon',         credit: 2745,  brackets: [[4400,0.0475],[11050,0.0675],[125000,0.0875],[Infinity,0.099]] },
        PA: { label: 'Pennsylvania',   credit: 0,     brackets: [[Infinity, 0.0307]] },
        RI: { label: 'Rhode Island',   credit: 10550, brackets: [[79900,0.0375],[181650,0.0475],[Infinity,0.0599]] },
        SC: { label: 'South Carolina', credit: 0,     brackets: [[3560,0],[17830,0.03],[Infinity,0.062]] },
        SD: { label: 'South Dakota (no income tax)',  credit: 0, brackets: [[Infinity, 0]] },
        TN: { label: 'Tennessee (no income tax)',     credit: 0, brackets: [[Infinity, 0]] },
        TX: { label: 'Texas (no income tax)',         credit: 0, brackets: [[Infinity, 0]] },
        UT: { label: 'Utah',           credit: 0,     brackets: [[Infinity, 0.0455]] },
        VT: { label: 'Vermont',        credit: 7400,  brackets: [[47900,0.0335],[116000,0.066],[242000,0.076],[Infinity,0.0875]] },
        VA: { label: 'Virginia',       credit: 8500,  brackets: [[3000,0.02],[5000,0.03],[17000,0.05],[Infinity,0.0575]] },
        WA: { label: 'Washington (no income tax)',    credit: 0, brackets: [[Infinity, 0]] },
        WV: { label: 'West Virginia',  credit: 2000,  brackets: [[10000,0.0236],[25000,0.0315],[40000,0.0354],[60000,0.0472],[Infinity,0.0512]] },
        WI: { label: 'Wisconsin',      credit: 13230, brackets: [[14320,0.035],[28640,0.044],[315310,0.053],[Infinity,0.0765]] },
        WY: { label: 'Wyoming (no income tax)',       credit: 0, brackets: [[Infinity, 0]] }
      }
    },
    FLAT: {
      label: 'Flat effective rate (simplest)',
      currency: 'USD',
      flat: true,
      federal: { credit: 0, rate1: 0.28, brackets: [[Infinity, 0.28]] },
      payroll: { label: 'none', items: [] },
      corporate: { smallBusiness: 0.15, threshold: Infinity, general: 0.15 },
      dividendFactor: 1,
      regions: { NA: { label: 'n/a', credit: 0, brackets: [[Infinity, 0]] } }
    }
  };

  /* ---------------------------------------------------------------
     SCENARIOS
     Multipliers and offsets applied on top of whatever the user
     entered. REALISTIC is the default and leaves inputs alone.
     Aggressive is never the default (spec section 19).
     --------------------------------------------------------------- */
  var SCENARIOS = {
    conservative: {
      label: 'Conservative',
      blurb: 'Slower raises, weaker markets, a business that grows but never takes off. Use this to ask "what if it mostly does not work out?"',
      salaryGrowth: -0.010,      /* absolute offset on the growth rate */
      investReturn: -0.020,
      revenueGrowth: 0.60,       /* multiplier on business revenue growth */
      marginFactor: 0.85,        /* multiplier on operating margin */
      multipleFactor: 0.80,      /* multiplier on the valuation multiple */
      businessFailOdds: 'higher'
    },
    realistic: {
      label: 'Realistic',
      blurb: 'The assumptions as entered. This is the case to quote out loud.',
      salaryGrowth: 0, investReturn: 0, revenueGrowth: 1,
      marginFactor: 1, multipleFactor: 1, businessFailOdds: 'normal'
    },
    aggressive: {
      label: 'Aggressive',
      blurb: 'Everything goes right: strong raises, strong markets, a business that scales cleanly. Real, but it is the top of the range - never present it as the expected outcome.',
      salaryGrowth: +0.010, investReturn: +0.020, revenueGrowth: 1.35,
      marginFactor: 1.15, multipleFactor: 1.25, businessFailOdds: 'lower'
    }
  };

  /* ---------------------------------------------------------------
     CAREER TYPES - the Blue Collar Business progression
     --------------------------------------------------------------- */
  var CAREER_TYPES = [
    { id: 'helper',       label: 'Helper' },
    { id: 'apprentice',   label: 'Apprentice' },
    { id: 'journeyperson',label: 'Journeyperson' },
    { id: 'professional', label: 'Professional employee' },
    { id: 'owneroperator',label: 'Owner-operator' },
    { id: 'businessowner',label: 'Business owner' },
    { id: 'investor',     label: 'Investor' }
  ];

  /* ---------------------------------------------------------------
     Helper so the presets below stay readable.
     stage(age, label, base, ot, bonus, extras)
     --------------------------------------------------------------- */
  function stage(age, label, base, ot, bonus, extras) {
    var s = {
      age: age, label: label, base: base || 0, overtime: ot || 0, bonus: bonus || 0,
      benefits: 0, pension: 0, vehicle: 0, other: 0
    };
    if (extras) { for (var k in extras) { if (extras.hasOwnProperty(k)) s[k] = extras[k]; } }
    return s;
  }

  /* Lifestyle raw inputs. Everything here is an observable fact about
     the work, not a score. scoring.js turns these into the 0-100. */
  function life(o) {
    return {
      hoursPerWeek:   o.hours,
      overtimeHours:  o.ot || 0,
      eveningWork:    o.evening || 0,    /* 0-10, how much evening work */
      weekendWork:    o.weekend || 0,    /* 0-10 */
      onCall:         o.onCall || 0,     /* 0-10 */
      vacationWeeks:  o.vac,
      vacationTakeable: o.vacTake,       /* 0-10, can you actually take it */
      leaveBusinessWeeks: o.leaveWeeks || 0, /* longest absence the work survives */
      stress: {
        customer:   o.sCust || 5,
        employee:   o.sEmp || 0,
        liability:  o.sLiab || 5,
        emergency:  o.sEmerg || 3,
        financial:  o.sFin || 4,
        regulatory: o.sReg || 3
      },
      physical:   o.phys,      /* 1 = brutal, 10 = minimal. Spec section 9. */
      mental:     o.mental,    /* 1 = relentless, 10 = light */
      flexibility: {
        chooseHours: o.fHours || 5,
        fewerDays:   o.fDays || 4,
        remote:      o.fRemote || 1,
        extendedVac: o.fVac || 4,
        relocate:    o.fMove || 6,
        changeEmployer: o.fEmp || 6,
        selfEmploy:  o.fSelf || 5
      },
      security: {
        demand:      o.kDemand || 6,
        automation:  o.kAuto || 6,     /* 10 = safe from automation */
        outsourcing: o.kOut || 6,
        recession:   o.kRec || 5,
        licensing:   o.kLic || 5,      /* 10 = strong licensing moat */
        shortage:    o.kShort || 5
      },
      family: {
        eveningsHome: o.pEve || 6,
        weekendsOff:  o.pWknd || 6,
        predictable:  o.pPred || 6,
        lowTravel:    o.pTravel || 7,
        canAttend:    o.pAttend || 6
      }
    };
  }

  /* Career-level judgement scores, 0-10, feeding the BCB 100-point
     score. These are opinions and the UI labels them as such. */
  function traits(o) {
    return {
      businessEase:   o.bEase,    /* how realistically can one person start this */
      customerDemand: o.demand,
      margins:        o.margins,
      startupCapital: o.capital,  /* 10 = almost none needed */
      scalability:    o.scale,    /* can employees produce without the owner */
      durability:     o.durable,
      wealthBuilding: o.wealth,
      incomeCeiling:  o.ceiling,  /* as an employee */
      scheduleControl: o.schedule || 5,
      delegability:   o.delegate || 5,
      recurringRevenue: o.recurring || 3
    };
  }

  /* Business block. Absent/enabled:false means "stayed an employee". */
  function biz(o) {
    return {
      enabled: o.enabled !== false,
      startAge: o.startAge,
      startupInvestment: o.startup,
      startupLoanShare: o.loanShare == null ? 0.5 : o.loanShare,
      startupLoanRate: o.loanRate == null ? 0.09 : o.loanRate,
      startupLoanYears: o.loanYears == null ? 7 : o.loanYears,
      revenueY1: o.rev,
      revenueGrowth: o.growth,
      revenueCeiling: o.ceiling || 0,      /* 0 = no cap */
      /* --- Margin model ---------------------------------------------
         'model'  builds cost up from labour: materials, producers at a
                  fully-loaded cost, the owner's own billable capacity,
                  then overhead. Margins fall out as an OUTPUT, which is
                  why a solo operator prints a high margin and a mature
                  shop prints a thin one without anyone typing either.
                  It also makes owner dependency a computed number.
         'direct' takes the gross and net operating margins as typed,
                  the way the brief describes. Kept because sometimes you
                  have the real P&L in front of you.
         ------------------------------------------------------------- */
      marginMode: o.marginMode || 'model',
      grossMargin: o.gross,
      operatingMargin: o.net,              /* direct mode: after all costs, before owner comp = SDE margin */
      materialsPct: o.materials == null ? Math.max(0.10, 1 - o.gross) : o.materials,
      /* Billable revenue one producing employee generates. Default is
         2.8x their loaded cost - the rule of thumb service trades use. */
      costPerProducer: o.costPerTech == null ? Math.round((o.marketWage || 90000) * 1.15) : o.costPerTech,
      revenuePerProducer: o.revPerTech == null
        ? Math.round((o.costPerTech == null ? (o.marketWage || 90000) * 1.15 : o.costPerTech) * 2.8)
        : o.revPerTech,
      /* Revenue the owner personally produces while still on the tools.
         Defaulting to year-one revenue says: year one IS the owner. */
      ownerCapacity: o.ownerCapacity == null ? o.rev : o.ownerCapacity,
      overheadPct: o.overheadPct == null ? 0.13 : o.overheadPct,
      fixedOverhead: o.fixedOverhead == null ? 25000 : o.fixedOverhead,
      /* Fixed costs do not stay fixed forever, but they do not scale
         one-for-one either. sqrt(revenue growth) is the compromise. */
      fixedOverheadScaling: o.fixedScaling == null ? 0.5 : o.fixedScaling,
      managerSalary: o.managerSalary == null ? 110000 : o.managerSalary,
      ownerSalary: o.ownerSalary,
      ownerSalaryGrowth: o.ownerSalaryGrowth == null ? 0.03 : o.ownerSalaryGrowth,
      distributionShare: o.distribute == null ? 0.7 : o.distribute,
      employeesY1: o.emp || 0,
      employeeGrowth: o.empGrowth == null ? 0.15 : o.empGrowth,
      trucksY1: o.trucks || 1,
      /* Non-producing staff - front office, assistants, dispatch. They
         sit in overhead, but they are still people on the payroll and
         belong in the headcount the report shows. */
      supportStaffY1: o.support == null ? (o.emp || 0) : o.support,
      capexPct: o.capex == null ? 0.04 : o.capex,
      marketingPct: o.marketing == null ? 0.05 : o.marketing,
      workingCapitalPct: o.wc == null ? 0.05 : o.wc,
      /* Valuation */
      valuationMethod: o.valMethod || 'sde',   /* sde | ebitda | profit | manual */
      valuationMultiple: o.multiple,
      manualValuation: o.manualValue || 0,
      ownerMarketWage: o.marketWage || 90000,  /* cost to replace the owner's own labour */
      /* Quality factors, 0-10, adjust the multiple transparently */
      quality: {
        ownerIndependence: o.qOwner == null ? 4 : o.qOwner,
        recurringRevenue:  o.qRecur == null ? 3 : o.qRecur,
        customerSpread:    o.qSpread == null ? 6 : o.qSpread,
        managementTeam:    o.qMgmt == null ? 3 : o.qMgmt,
        assetBase:         o.qAssets == null ? 5 : o.qAssets,
        growthRate:        o.qGrowth == null ? 6 : o.qGrowth
      },
      /* Milestones flip the owner from doing the work to owning the asset */
      leadStage:  o.leadAge || 0,      /* first employees / running a crew */
      ownerStage: o.ownerAge || 0,     /* employees do most production */
      investorStage: o.investorAge || 0, /* manager runs it */
      conf: 'estimated'
    };
  }

  /* ---------------------------------------------------------------
     CAREER PRESETS
     Alberta / CAD figures unless noted. Ranges are typical rather
     than authoritative - the whole point is that the operator
     replaces them with local numbers they can defend on camera.
     --------------------------------------------------------------- */
  var CAREERS = {

    plumber: {
      name: 'Plumber', type: 'journeyperson', conf: 'industry',
      note: 'Alberta apprenticeship: four years, earning from day one, technical training in blocks.',
      education: {
        studentLivingCost: 16000, schoolWorkHours: 700, studyHoursPerYear: 320,
        yearsEducation: 0, yearsApprenticeship: 4, yearsUnpaidSchool: 0.6, yearsPaidTraining: 3.4,
        tuitionPerYear: 1300, tuitionYears: 4, books: 500, tools: 6500,
        certification: 450, licensing: 350, examFees: 300, equipment: 1200, other: 500,
        familyPaid: 0, scholarships: 1000, grants: 2000, conf: 'industry'
      },
      debt: { rate: 0.065, termYears: 5, conf: 'estimated' },
      stages: [
        stage(18, '1st year apprentice', 42000, 5000, 0, { benefits: 2500 }),
        stage(19, '2nd year apprentice', 50000, 6500, 0, { benefits: 2800 }),
        stage(20, '3rd year apprentice', 58000, 8000, 500, { benefits: 3000, pension: 1500 }),
        stage(21, '4th year apprentice', 66000, 9000, 1000, { benefits: 3200, pension: 2000 }),
        stage(22, 'Journeyperson', 80000, 12000, 2000, { benefits: 3800, pension: 3000, vehicle: 1500 }),
        stage(25, 'Experienced journeyperson', 94000, 14000, 3000, { benefits: 4000, pension: 4000, vehicle: 2500 })
      ],
      business: biz({
        support: 1,
        materials: 0.24, ownerCapacity: 230000, revPerTech: 300000, costPerTech: 108000, overheadPct: 0.13, fixedOverhead: 26000,
        startAge: 27, startup: 35000, rev: 230000, growth: 0.18, ceiling: 3200000,
        gross: 0.56, net: 0.24, ownerSalary: 95000, emp: 0, marketWage: 95000,
        multiple: 3.2, valMethod: 'sde', leadAge: 30, ownerAge: 33, investorAge: 39,
        qOwner: 4, qRecur: 4, qSpread: 7, qMgmt: 3, qAssets: 6, qGrowth: 7
      }),
      lifestyle: life({
        hours: 42, ot: 6, evening: 4, weekend: 4, onCall: 6, vac: 2, vacTake: 5, leaveWeeks: 2,
        sCust: 5, sEmp: 2, sLiab: 5, sEmerg: 7, sFin: 4, sReg: 4,
        phys: 3, mental: 6,
        fHours: 5, fDays: 4, fRemote: 1, fVac: 4, fMove: 8, fEmp: 8, fSelf: 9,
        kDemand: 9, kAuto: 9, kOut: 10, kRec: 6, kLic: 8, kShort: 8,
        pEve: 6, pWknd: 6, pPred: 6, pTravel: 8, pAttend: 6
      }),
      traits: traits({ bEase: 9, demand: 9, margins: 7, capital: 8, scale: 8, durable: 9, wealth: 8, ceiling: 6, schedule: 5, delegate: 7, recurring: 4 }),
      living: { expenses: 42000, creep: 0.25, conf: 'estimated' }
    },

    dentist: {
      name: 'Dentist', type: 'professional', conf: 'industry',
      note: 'Three years of undergraduate prerequisites plus four years of dental school. Four-plus-four is also common - change it if that fits your comparison better.',
      education: {
        studentLivingCost: 24000, schoolWorkHours: 700, studyHoursPerYear: 1950,
        yearsEducation: 7, yearsApprenticeship: 0, yearsUnpaidSchool: 7, yearsPaidTraining: 0,
        tuitionPerYear: 21000, tuitionYears: 7, books: 6000, tools: 12000,
        certification: 2500, licensing: 2500, examFees: 4500, equipment: 3000, other: 8000,
        familyPaid: 20000, scholarships: 6000, grants: 4000, conf: 'industry'
      },
      debt: { rate: 0.068, termYears: 15, conf: 'industry' },
      stages: [
        stage(18, 'Undergrad, summer work', 9000, 0, 0, {}),
        stage(21, 'Dental school, summer work', 7000, 0, 0, {}),
        stage(25, 'Associate dentist', 140000, 0, 8000, { benefits: 2000 }),
        stage(27, 'Established associate', 185000, 0, 15000, { benefits: 2500 }),
        stage(30, 'Senior associate', 215000, 0, 20000, { benefits: 3000 })
      ],
      business: biz({
        support: 5,
        materials: 0.22, ownerCapacity: 950000, revPerTech: 700000, costPerTech: 270000, managerSalary: 120000, overheadPct: 0.26, fixedOverhead: 120000,
        startAge: 32, startup: 650000, loanShare: 0.85, loanRate: 0.075, loanYears: 12,
        rev: 950000, growth: 0.07, ceiling: 2600000,
        gross: 0.68, net: 0.26, ownerSalary: 250000, emp: 5, marketWage: 210000,
        multiple: 3.6, valMethod: 'sde', leadAge: 32, ownerAge: 36, investorAge: 44,
        qOwner: 3, qRecur: 8, qSpread: 9, qMgmt: 5, qAssets: 7, qGrowth: 5
      }),
      lifestyle: life({
        hours: 38, ot: 2, evening: 2, weekend: 2, onCall: 3, vac: 4, vacTake: 7, leaveWeeks: 3,
        sCust: 7, sEmp: 5, sLiab: 9, sEmerg: 4, sFin: 6, sReg: 7,
        phys: 6, mental: 3,
        fHours: 7, fDays: 8, fRemote: 1, fVac: 6, fMove: 4, fEmp: 6, fSelf: 8,
        kDemand: 9, kAuto: 8, kOut: 9, kRec: 7, kLic: 10, kShort: 6,
        pEve: 8, pWknd: 8, pPred: 8, pTravel: 9, pAttend: 8
      }),
      traits: traits({ bEase: 4, demand: 9, margins: 8, capital: 2, scale: 6, durable: 9, wealth: 8, ceiling: 9, schedule: 7, delegate: 5, recurring: 8 }),
      living: { expenses: 62000, creep: 0.30, conf: 'estimated' }
    },

    electrician: {
      name: 'Electrician', type: 'journeyperson', conf: 'industry',
      note: 'Four-year apprenticeship. Slightly cleaner work than plumbing, slightly more competition in residential service.',
      education: {
        studentLivingCost: 16000, schoolWorkHours: 700, studyHoursPerYear: 320,
        yearsEducation: 0, yearsApprenticeship: 4, yearsUnpaidSchool: 0.6, yearsPaidTraining: 3.4,
        tuitionPerYear: 1300, tuitionYears: 4, books: 600, tools: 4500,
        certification: 450, licensing: 400, examFees: 300, equipment: 900, other: 400,
        familyPaid: 0, scholarships: 1000, grants: 2000, conf: 'industry'
      },
      debt: { rate: 0.065, termYears: 5, conf: 'estimated' },
      stages: [
        stage(18, '1st year apprentice', 44000, 4500, 0, { benefits: 2500 }),
        stage(19, '2nd year apprentice', 52000, 6000, 0, { benefits: 2800 }),
        stage(20, '3rd year apprentice', 60000, 7500, 500, { benefits: 3000, pension: 1600 }),
        stage(21, '4th year apprentice', 68000, 8500, 1000, { benefits: 3200, pension: 2200 }),
        stage(22, 'Journeyperson', 82000, 11000, 2000, { benefits: 3800, pension: 3200, vehicle: 1500 }),
        stage(25, 'Experienced journeyperson / foreman', 98000, 13000, 4000, { benefits: 4200, pension: 4500, vehicle: 2500 })
      ],
      business: biz({
        support: 1,
        materials: 0.24, ownerCapacity: 240000, revPerTech: 305000, costPerTech: 110000, overheadPct: 0.13, fixedOverhead: 26000,
        startAge: 28, startup: 40000, rev: 240000, growth: 0.17, ceiling: 3500000,
        gross: 0.55, net: 0.22, ownerSalary: 98000, marketWage: 98000,
        multiple: 3.3, leadAge: 31, ownerAge: 34, investorAge: 40,
        qOwner: 4, qRecur: 4, qSpread: 7, qMgmt: 3, qAssets: 6, qGrowth: 7
      }),
      lifestyle: life({
        hours: 42, ot: 5, evening: 3, weekend: 3, onCall: 5, vac: 2, vacTake: 5, leaveWeeks: 2,
        sCust: 5, sEmp: 2, sLiab: 6, sEmerg: 6, sFin: 4, sReg: 5,
        phys: 4, mental: 6,
        fHours: 5, fDays: 4, fRemote: 1, fVac: 4, fMove: 8, fEmp: 8, fSelf: 9,
        kDemand: 9, kAuto: 9, kOut: 10, kRec: 6, kLic: 8, kShort: 8,
        pEve: 7, pWknd: 7, pPred: 6, pTravel: 8, pAttend: 6
      }),
      traits: traits({ bEase: 8, demand: 9, margins: 7, capital: 7, scale: 8, durable: 9, wealth: 8, ceiling: 6, schedule: 5, delegate: 7, recurring: 4 }),
      living: { expenses: 42000, creep: 0.25, conf: 'estimated' }
    },

    hvac: {
      name: 'HVAC Technician', type: 'journeyperson', conf: 'industry',
      note: 'Strong seasonal overtime, strong service-agreement potential, which is what makes the business version scale.',
      education: {
        studentLivingCost: 16000, schoolWorkHours: 700, studyHoursPerYear: 320,
        yearsEducation: 0, yearsApprenticeship: 4, yearsUnpaidSchool: 0.6, yearsPaidTraining: 3.4,
        tuitionPerYear: 1300, tuitionYears: 4, books: 500, tools: 5500,
        certification: 700, licensing: 350, examFees: 350, equipment: 1500, other: 500,
        familyPaid: 0, scholarships: 800, grants: 2000, conf: 'industry'
      },
      debt: { rate: 0.065, termYears: 5, conf: 'estimated' },
      stages: [
        stage(18, '1st year apprentice', 41000, 6000, 0, { benefits: 2400 }),
        stage(20, '3rd year apprentice', 57000, 9000, 500, { benefits: 3000, pension: 1500 }),
        stage(22, 'Journeyperson', 78000, 14000, 2500, { benefits: 3600, pension: 3000, vehicle: 1800 }),
        stage(25, 'Service lead', 90000, 16000, 4000, { benefits: 4000, pension: 4000, vehicle: 3000 })
      ],
      business: biz({
        support: 1,
        materials: 0.32, ownerCapacity: 250000, revPerTech: 320000, costPerTech: 106000, overheadPct: 0.14, fixedOverhead: 30000,
        startAge: 27, startup: 45000, rev: 250000, growth: 0.19, ceiling: 4000000,
        gross: 0.52, net: 0.23, ownerSalary: 95000, marketWage: 92000,
        multiple: 3.6, leadAge: 30, ownerAge: 33, investorAge: 38,
        qOwner: 5, qRecur: 7, qSpread: 8, qMgmt: 4, qAssets: 6, qGrowth: 8
      }),
      lifestyle: life({
        hours: 44, ot: 8, evening: 6, weekend: 5, onCall: 8, vac: 2, vacTake: 4, leaveWeeks: 1,
        sCust: 6, sEmp: 2, sLiab: 5, sEmerg: 8, sFin: 4, sReg: 4,
        phys: 3, mental: 6,
        fHours: 4, fDays: 3, fRemote: 1, fVac: 3, fMove: 8, fEmp: 8, fSelf: 9,
        kDemand: 9, kAuto: 9, kOut: 10, kRec: 7, kLic: 8, kShort: 9,
        pEve: 5, pWknd: 6, pPred: 5, pTravel: 8, pAttend: 5
      }),
      traits: traits({ bEase: 9, demand: 9, margins: 7, capital: 7, scale: 9, durable: 9, wealth: 9, ceiling: 6, schedule: 4, delegate: 8, recurring: 7 }),
      living: { expenses: 42000, creep: 0.25, conf: 'estimated' }
    },

    welder: {
      name: 'Welder', type: 'journeyperson', conf: 'industry',
      note: 'Very high ceiling on rig and pressure work, but income is tied to projects and to the owner being in the hood.',
      education: {
        studentLivingCost: 16000, schoolWorkHours: 700, studyHoursPerYear: 320,
        yearsEducation: 0, yearsApprenticeship: 3, yearsUnpaidSchool: 0.5, yearsPaidTraining: 2.5,
        tuitionPerYear: 1400, tuitionYears: 3, books: 400, tools: 9000,
        certification: 1400, licensing: 200, examFees: 900, equipment: 4000, other: 600,
        familyPaid: 0, scholarships: 800, grants: 1500, conf: 'industry'
      },
      debt: { rate: 0.065, termYears: 5, conf: 'estimated' },
      stages: [
        stage(18, '1st year apprentice', 44000, 8000, 0, { benefits: 2200 }),
        stage(20, '3rd year apprentice', 62000, 14000, 0, { benefits: 2800, pension: 1500 }),
        stage(21, 'Journeyperson', 84000, 22000, 1500, { benefits: 3400, pension: 3000 }),
        stage(25, 'Pressure / rig welder', 105000, 35000, 3000, { benefits: 3800, pension: 4500, vehicle: 3000 })
      ],
      business: biz({
        support: 1,
        materials: 0.28, ownerCapacity: 260000, revPerTech: 290000, costPerTech: 125000, overheadPct: 0.12, fixedOverhead: 40000,
        startAge: 28, startup: 90000, rev: 260000, growth: 0.14, ceiling: 2200000,
        gross: 0.48, net: 0.22, ownerSalary: 110000, marketWage: 115000,
        multiple: 2.6, leadAge: 32, ownerAge: 36, investorAge: 44,
        qOwner: 3, qRecur: 3, qSpread: 4, qMgmt: 2, qAssets: 7, qGrowth: 5
      }),
      lifestyle: life({
        hours: 50, ot: 14, evening: 6, weekend: 7, onCall: 5, vac: 2, vacTake: 4, leaveWeeks: 2,
        sCust: 4, sEmp: 2, sLiab: 6, sEmerg: 5, sFin: 5, sReg: 4,
        phys: 2, mental: 6,
        fHours: 3, fDays: 3, fRemote: 1, fVac: 5, fMove: 7, fEmp: 7, fSelf: 8,
        kDemand: 7, kAuto: 7, kOut: 8, kRec: 3, kLic: 7, kShort: 6,
        pEve: 4, pWknd: 4, pPred: 4, pTravel: 3, pAttend: 4
      }),
      traits: traits({ bEase: 7, demand: 7, margins: 6, capital: 5, scale: 5, durable: 7, wealth: 7, ceiling: 7, schedule: 3, delegate: 4, recurring: 3 }),
      living: { expenses: 44000, creep: 0.30, conf: 'estimated' }
    },

    hdmechanic: {
      name: 'Heavy-Duty Mechanic', type: 'journeyperson', conf: 'industry',
      note: 'Fleet and shop work. Very steady demand; the business version is capital-heavy because of the shop and tooling.',
      education: {
        studentLivingCost: 16000, schoolWorkHours: 700, studyHoursPerYear: 320,
        yearsEducation: 0, yearsApprenticeship: 4, yearsUnpaidSchool: 0.6, yearsPaidTraining: 3.4,
        tuitionPerYear: 1300, tuitionYears: 4, books: 500, tools: 22000,
        certification: 500, licensing: 300, examFees: 300, equipment: 3000, other: 600,
        familyPaid: 0, scholarships: 1000, grants: 2000, conf: 'industry'
      },
      debt: { rate: 0.065, termYears: 6, conf: 'estimated' },
      stages: [
        stage(18, '1st year apprentice', 43000, 6000, 0, { benefits: 2600, tools: 0 }),
        stage(20, '3rd year apprentice', 60000, 9000, 500, { benefits: 3200, pension: 1800 }),
        stage(22, 'Journeyperson', 84000, 13000, 2000, { benefits: 4000, pension: 3500 }),
        stage(25, 'Shop lead', 98000, 15000, 4000, { benefits: 4400, pension: 5000, vehicle: 2000 })
      ],
      business: biz({
        support: 2,
        materials: 0.34, ownerCapacity: 420000, revPerTech: 330000, costPerTech: 118000, overheadPct: 0.13, fixedOverhead: 60000,
        startAge: 30, startup: 180000, loanShare: 0.6, rev: 420000, growth: 0.13, ceiling: 3000000,
        gross: 0.50, net: 0.20, ownerSalary: 110000, marketWage: 105000,
        multiple: 3.0, leadAge: 32, ownerAge: 35, investorAge: 42,
        qOwner: 4, qRecur: 6, qSpread: 5, qMgmt: 3, qAssets: 8, qGrowth: 5
      }),
      lifestyle: life({
        hours: 45, ot: 7, evening: 4, weekend: 4, onCall: 6, vac: 3, vacTake: 5, leaveWeeks: 2,
        sCust: 4, sEmp: 2, sLiab: 6, sEmerg: 6, sFin: 4, sReg: 4,
        phys: 3, mental: 5,
        fHours: 4, fDays: 4, fRemote: 1, fVac: 4, fMove: 8, fEmp: 8, fSelf: 7,
        kDemand: 8, kAuto: 8, kOut: 9, kRec: 6, kLic: 7, kShort: 9,
        pEve: 6, pWknd: 6, pPred: 6, pTravel: 7, pAttend: 6
      }),
      traits: traits({ bEase: 6, demand: 8, margins: 6, capital: 4, scale: 7, durable: 8, wealth: 7, ceiling: 6, schedule: 4, delegate: 6, recurring: 6 }),
      living: { expenses: 43000, creep: 0.25, conf: 'estimated' }
    },

    softwareengineer: {
      name: 'Software Engineer', type: 'professional', conf: 'industry',
      note: 'Four-year degree, high starting salary, high ceiling - and the only career here with meaningful automation and offshoring exposure.',
      education: {
        studentLivingCost: 22000, schoolWorkHours: 700, studyHoursPerYear: 1350,
        yearsEducation: 4, yearsApprenticeship: 0, yearsUnpaidSchool: 4, yearsPaidTraining: 0,
        tuitionPerYear: 8500, tuitionYears: 4, books: 2000, tools: 3500,
        certification: 500, licensing: 0, examFees: 300, equipment: 1000, other: 3000,
        familyPaid: 8000, scholarships: 5000, grants: 3000, conf: 'industry'
      },
      debt: { rate: 0.065, termYears: 10, conf: 'industry' },
      stages: [
        stage(18, 'Student, co-op terms', 16000, 0, 0, {}),
        stage(22, 'Junior developer', 82000, 0, 4000, { benefits: 4000, pension: 3000 }),
        stage(25, 'Intermediate developer', 115000, 0, 10000, { benefits: 4500, pension: 5000 }),
        stage(29, 'Senior developer', 150000, 0, 20000, { benefits: 5000, pension: 7500 }),
        stage(34, 'Staff / lead', 180000, 0, 35000, { benefits: 5500, pension: 9000 })
      ],
      business: biz({
        support: 1,
        materials: 0.08, ownerCapacity: 180000, revPerTech: 300000, costPerTech: 130000, overheadPct: 0.15, fixedOverhead: 20000,
        startAge: 32, startup: 25000, rev: 180000, growth: 0.22, ceiling: 2500000,
        gross: 0.75, net: 0.30, ownerSalary: 130000, marketWage: 150000,
        multiple: 3.4, leadAge: 34, ownerAge: 37, investorAge: 42,
        qOwner: 5, qRecur: 7, qSpread: 4, qMgmt: 4, qAssets: 2, qGrowth: 7
      }),
      lifestyle: life({
        hours: 42, ot: 3, evening: 3, weekend: 2, onCall: 5, vac: 3, vacTake: 7, leaveWeeks: 3,
        sCust: 4, sEmp: 3, sLiab: 3, sEmerg: 5, sFin: 4, sReg: 2,
        phys: 9, mental: 3,
        fHours: 8, fDays: 6, fRemote: 9, fVac: 6, fMove: 9, fEmp: 8, fSelf: 7,
        kDemand: 7, kAuto: 4, kOut: 3, kRec: 4, kLic: 1, kShort: 4,
        pEve: 7, pWknd: 8, pPred: 7, pTravel: 9, pAttend: 8
      }),
      traits: traits({ bEase: 6, demand: 7, margins: 9, capital: 8, scale: 9, durable: 5, wealth: 8, ceiling: 9, schedule: 8, delegate: 6, recurring: 7 }),
      living: { expenses: 55000, creep: 0.35, conf: 'estimated' }
    },

    accountant: {
      name: 'Accountant (CPA)', type: 'professional', conf: 'industry',
      note: 'Degree plus the CPA program while working. Practice ownership is the real wealth path, and it is a genuinely scalable one.',
      education: {
        studentLivingCost: 21000, schoolWorkHours: 700, studyHoursPerYear: 1400,
        yearsEducation: 4, yearsApprenticeship: 2.5, yearsUnpaidSchool: 4, yearsPaidTraining: 2.5,
        tuitionPerYear: 8000, tuitionYears: 4, books: 2500, tools: 1000,
        certification: 12000, licensing: 1200, examFees: 3500, equipment: 1500, other: 2500,
        familyPaid: 8000, scholarships: 4000, grants: 3000, conf: 'industry'
      },
      debt: { rate: 0.065, termYears: 10, conf: 'industry' },
      stages: [
        stage(18, 'Student, summer work', 11000, 0, 0, {}),
        stage(22, 'Staff accountant / CPA student', 62000, 2000, 2000, { benefits: 3500, pension: 2000 }),
        stage(25, 'CPA, senior accountant', 88000, 0, 6000, { benefits: 4000, pension: 4000 }),
        stage(29, 'Manager', 118000, 0, 14000, { benefits: 4500, pension: 6000 }),
        stage(34, 'Senior manager / controller', 145000, 0, 22000, { benefits: 5000, pension: 8000 })
      ],
      business: biz({
        support: 1,
        materials: 0.05, ownerCapacity: 210000, revPerTech: 260000, costPerTech: 95000, overheadPct: 0.14, fixedOverhead: 35000,
        startAge: 31, startup: 40000, rev: 210000, growth: 0.16, ceiling: 2200000,
        gross: 0.70, net: 0.32, ownerSalary: 120000, marketWage: 125000,
        multiple: 3.8, leadAge: 33, ownerAge: 36, investorAge: 43,
        qOwner: 4, qRecur: 9, qSpread: 8, qMgmt: 4, qAssets: 2, qGrowth: 6
      }),
      lifestyle: life({
        hours: 42, ot: 6, evening: 5, weekend: 4, onCall: 2, vac: 3, vacTake: 5, leaveWeeks: 2,
        sCust: 6, sEmp: 4, sLiab: 7, sEmerg: 2, sFin: 4, sReg: 8,
        phys: 9, mental: 3,
        fHours: 6, fDays: 5, fRemote: 8, fVac: 4, fMove: 7, fEmp: 8, fSelf: 8,
        kDemand: 8, kAuto: 5, kOut: 5, kRec: 7, kLic: 8, kShort: 6,
        pEve: 6, pWknd: 6, pPred: 5, pTravel: 8, pAttend: 6
      }),
      traits: traits({ bEase: 7, demand: 8, margins: 9, capital: 8, scale: 8, durable: 7, wealth: 8, ceiling: 8, schedule: 6, delegate: 7, recurring: 9 }),
      living: { expenses: 50000, creep: 0.30, conf: 'estimated' }
    },

    pharmacist: {
      name: 'Pharmacist', type: 'professional', conf: 'industry',
      note: 'High, flat income. Very little variance either way - the ceiling arrives early and stays.',
      education: {
        studentLivingCost: 23000, schoolWorkHours: 700, studyHoursPerYear: 1800,
        yearsEducation: 6, yearsApprenticeship: 0, yearsUnpaidSchool: 6, yearsPaidTraining: 0,
        tuitionPerYear: 16000, tuitionYears: 6, books: 5000, tools: 1000,
        certification: 2000, licensing: 1800, examFees: 3000, equipment: 1000, other: 5000,
        familyPaid: 15000, scholarships: 5000, grants: 4000, conf: 'industry'
      },
      debt: { rate: 0.068, termYears: 12, conf: 'industry' },
      stages: [
        stage(18, 'Undergrad / pharmacy school, summer work', 9000, 0, 0, {}),
        stage(24, 'Staff pharmacist', 105000, 4000, 3000, { benefits: 4000, pension: 3500 }),
        stage(27, 'Pharmacy manager', 128000, 3000, 8000, { benefits: 4500, pension: 5000 }),
        stage(33, 'Senior / clinical pharmacist', 142000, 2000, 10000, { benefits: 5000, pension: 6000 })
      ],
      business: biz({
        support: 8,
        materials: 0.72, ownerCapacity: 3200000, revPerTech: 900000, costPerTech: 155000, managerSalary: 130000, overheadPct: 0.06, fixedOverhead: 240000,
        startAge: 34, startup: 850000, loanShare: 0.85, loanRate: 0.075, loanYears: 15,
        rev: 3200000, growth: 0.05, ceiling: 6500000,
        gross: 0.24, net: 0.09, ownerSalary: 200000, marketWage: 150000,
        multiple: 4.5, leadAge: 34, ownerAge: 37, investorAge: 45,
        qOwner: 5, qRecur: 9, qSpread: 9, qMgmt: 6, qAssets: 6, qGrowth: 4
      }),
      lifestyle: life({
        hours: 40, ot: 2, evening: 5, weekend: 5, onCall: 2, vac: 3, vacTake: 6, leaveWeeks: 3,
        sCust: 7, sEmp: 4, sLiab: 8, sEmerg: 3, sFin: 3, sReg: 8,
        phys: 7, mental: 4,
        fHours: 6, fDays: 7, fRemote: 2, fVac: 6, fMove: 8, fEmp: 8, fSelf: 5,
        kDemand: 8, kAuto: 6, kOut: 8, kRec: 9, kLic: 10, kShort: 5,
        pEve: 5, pWknd: 5, pPred: 7, pTravel: 9, pAttend: 6
      }),
      traits: traits({ bEase: 3, demand: 8, margins: 3, capital: 1, scale: 6, durable: 8, wealth: 6, ceiling: 6, schedule: 6, delegate: 6, recurring: 9 }),
      living: { expenses: 56000, creep: 0.30, conf: 'estimated' }
    },

    lawyer: {
      name: 'Lawyer', type: 'professional', conf: 'industry',
      note: 'Seven years to call, then a very wide spread. Big-firm partner and small-town practitioner are not the same career.',
      education: {
        studentLivingCost: 25000, schoolWorkHours: 700, studyHoursPerYear: 1600,
        yearsEducation: 7, yearsApprenticeship: 1, yearsUnpaidSchool: 7, yearsPaidTraining: 1,
        tuitionPerYear: 18000, tuitionYears: 7, books: 7000, tools: 2000,
        certification: 4500, licensing: 3500, examFees: 4000, equipment: 2500, other: 9000,
        familyPaid: 20000, scholarships: 8000, grants: 4000, conf: 'industry'
      },
      debt: { rate: 0.068, termYears: 15, conf: 'industry' },
      stages: [
        stage(18, 'Undergrad / law school, summer work', 11000, 0, 0, {}),
        stage(25, 'Articling student', 62000, 0, 0, { benefits: 2500 }),
        stage(26, 'Associate', 115000, 0, 10000, { benefits: 4000, pension: 3000 }),
        stage(30, 'Senior associate', 165000, 0, 25000, { benefits: 4500, pension: 5000 }),
        stage(35, 'Partner track', 240000, 0, 60000, { benefits: 5000, pension: 8000 })
      ],
      business: biz({
        support: 2,
        materials: 0.05, ownerCapacity: 320000, revPerTech: 350000, costPerTech: 130000, overheadPct: 0.16, fixedOverhead: 60000,
        startAge: 33, startup: 90000, rev: 320000, growth: 0.15, ceiling: 3000000,
        gross: 0.72, net: 0.34, ownerSalary: 180000, marketWage: 190000,
        multiple: 2.8, leadAge: 34, ownerAge: 38, investorAge: 46,
        qOwner: 3, qRecur: 4, qSpread: 6, qMgmt: 3, qAssets: 2, qGrowth: 6
      }),
      lifestyle: life({
        hours: 52, ot: 8, evening: 8, weekend: 6, onCall: 6, vac: 3, vacTake: 4, leaveWeeks: 2,
        sCust: 8, sEmp: 4, sLiab: 9, sEmerg: 6, sFin: 5, sReg: 8,
        phys: 9, mental: 2,
        fHours: 4, fDays: 3, fRemote: 6, fVac: 3, fMove: 5, fEmp: 7, fSelf: 8,
        kDemand: 7, kAuto: 5, kOut: 7, kRec: 6, kLic: 10, kShort: 3,
        pEve: 3, pWknd: 4, pPred: 3, pTravel: 6, pAttend: 4
      }),
      traits: traits({ bEase: 6, demand: 7, margins: 9, capital: 6, scale: 6, durable: 7, wealth: 8, ceiling: 10, schedule: 4, delegate: 5, recurring: 4 }),
      living: { expenses: 65000, creep: 0.35, conf: 'estimated' }
    },

    engineer: {
      name: 'Professional Engineer', type: 'professional', conf: 'industry',
      note: 'Four-year degree plus four years to P.Eng. Stable, salaried, and rarely spectacular unless it turns into a firm.',
      education: {
        studentLivingCost: 22000, schoolWorkHours: 700, studyHoursPerYear: 1500,
        yearsEducation: 4, yearsApprenticeship: 4, yearsUnpaidSchool: 4, yearsPaidTraining: 4,
        tuitionPerYear: 9500, tuitionYears: 4, books: 3000, tools: 2000,
        certification: 1500, licensing: 2500, examFees: 1200, equipment: 1500, other: 3000,
        familyPaid: 8000, scholarships: 5000, grants: 3000, conf: 'industry'
      },
      debt: { rate: 0.065, termYears: 10, conf: 'industry' },
      stages: [
        stage(18, 'Student, co-op terms', 15000, 0, 0, {}),
        stage(22, 'EIT', 72000, 1000, 2000, { benefits: 4000, pension: 3000 }),
        stage(26, 'P.Eng.', 100000, 1000, 6000, { benefits: 4500, pension: 5000 }),
        stage(31, 'Senior engineer', 128000, 0, 12000, { benefits: 5000, pension: 7000 }),
        stage(36, 'Engineering manager', 155000, 0, 22000, { benefits: 5500, pension: 9000 })
      ],
      business: biz({
        support: 1,
        materials: 0.08, ownerCapacity: 260000, revPerTech: 300000, costPerTech: 120000, overheadPct: 0.15, fixedOverhead: 35000,
        startAge: 34, startup: 60000, rev: 260000, growth: 0.15, ceiling: 2600000,
        gross: 0.68, net: 0.26, ownerSalary: 140000, marketWage: 140000,
        multiple: 3.2, leadAge: 35, ownerAge: 38, investorAge: 45,
        qOwner: 4, qRecur: 5, qSpread: 5, qMgmt: 4, qAssets: 3, qGrowth: 6
      }),
      lifestyle: life({
        hours: 43, ot: 3, evening: 3, weekend: 2, onCall: 3, vac: 3, vacTake: 7, leaveWeeks: 3,
        sCust: 5, sEmp: 4, sLiab: 8, sEmerg: 3, sFin: 3, sReg: 7,
        phys: 8, mental: 3,
        fHours: 6, fDays: 5, fRemote: 7, fVac: 6, fMove: 7, fEmp: 8, fSelf: 6,
        kDemand: 7, kAuto: 6, kOut: 5, kRec: 5, kLic: 9, kShort: 5,
        pEve: 7, pWknd: 8, pPred: 7, pTravel: 7, pAttend: 7
      }),
      traits: traits({ bEase: 5, demand: 7, margins: 8, capital: 6, scale: 7, durable: 7, wealth: 7, ceiling: 8, schedule: 6, delegate: 6, recurring: 5 }),
      living: { expenses: 52000, creep: 0.30, conf: 'estimated' }
    },

    teacher: {
      name: 'Teacher', type: 'professional', conf: 'industry',
      note: 'Modest ceiling, excellent pension, and the best family calendar of any career on this list. The pension is the wealth engine.',
      education: {
        studentLivingCost: 20000, schoolWorkHours: 700, studyHoursPerYear: 1350,
        yearsEducation: 5, yearsApprenticeship: 0, yearsUnpaidSchool: 5, yearsPaidTraining: 0,
        tuitionPerYear: 7500, tuitionYears: 5, books: 2500, tools: 1500,
        certification: 500, licensing: 400, examFees: 200, equipment: 1000, other: 2500,
        familyPaid: 8000, scholarships: 3000, grants: 3000, conf: 'industry'
      },
      debt: { rate: 0.065, termYears: 10, conf: 'industry' },
      stages: [
        stage(18, 'Student, summer work', 10000, 0, 0, {}),
        stage(23, 'First-year teacher', 66000, 1500, 0, { benefits: 5000, pension: 7000 }),
        stage(27, 'Mid-grid teacher', 88000, 2000, 0, { benefits: 5500, pension: 9500 }),
        stage(33, 'Top of grid', 106000, 2500, 0, { benefits: 6000, pension: 12000 }),
        stage(40, 'Department head', 116000, 2500, 2000, { benefits: 6000, pension: 13500 })
      ],
      business: biz({
        support: 0,
        materials: 0.15, ownerCapacity: 70000, revPerTech: 90000, costPerTech: 45000, managerSalary: 40000, overheadPct: 0.10, fixedOverhead: 6000,
        enabled: false, startAge: 38, startup: 15000, rev: 70000, growth: 0.12, ceiling: 350000,
        gross: 0.80, net: 0.45, ownerSalary: 30000, marketWage: 60000,
        multiple: 1.8, leadAge: 0, ownerAge: 0, investorAge: 0,
        qOwner: 2, qRecur: 5, qSpread: 6, qMgmt: 1, qAssets: 1, qGrowth: 4
      }),
      lifestyle: life({
        hours: 45, ot: 5, evening: 5, weekend: 4, onCall: 1, vac: 12, vacTake: 9, leaveWeeks: 8,
        sCust: 7, sEmp: 2, sLiab: 5, sEmerg: 2, sFin: 2, sReg: 6,
        phys: 7, mental: 4,
        fHours: 3, fDays: 3, fRemote: 2, fVac: 8, fMove: 7, fEmp: 6, fSelf: 3,
        kDemand: 8, kAuto: 9, kOut: 10, kRec: 9, kLic: 9, kShort: 7,
        pEve: 7, pWknd: 8, pPred: 9, pTravel: 10, pAttend: 9
      }),
      traits: traits({ bEase: 3, demand: 5, margins: 6, capital: 8, scale: 3, durable: 9, wealth: 5, ceiling: 3, schedule: 3, delegate: 2, recurring: 5 }),
      living: { expenses: 45000, creep: 0.20, conf: 'estimated' }
    },

    executive: {
      name: 'Corporate Executive', type: 'professional', conf: 'estimated',
      note: 'Assumes the promotions actually land. Most people on this track top out well below the numbers here - treat it as the successful path, not the average one.',
      education: {
        studentLivingCost: 25000, schoolWorkHours: 700, studyHoursPerYear: 1400,
        yearsEducation: 6, yearsApprenticeship: 0, yearsUnpaidSchool: 6, yearsPaidTraining: 0,
        tuitionPerYear: 14000, tuitionYears: 6, books: 4000, tools: 2500,
        certification: 3000, licensing: 0, examFees: 1500, equipment: 2000, other: 6000,
        familyPaid: 20000, scholarships: 6000, grants: 3000, conf: 'estimated'
      },
      debt: { rate: 0.065, termYears: 12, conf: 'estimated' },
      stages: [
        stage(18, 'Undergrad / MBA, summer work', 13000, 0, 0, {}),
        stage(24, 'Analyst', 85000, 0, 10000, { benefits: 4500, pension: 4000 }),
        stage(28, 'Manager', 125000, 0, 25000, { benefits: 5000, pension: 6000 }),
        stage(32, 'Director', 175000, 0, 50000, { benefits: 6000, pension: 9000 }),
        stage(37, 'Vice-president', 250000, 0, 110000, { benefits: 7000, pension: 14000, other: 40000 })
      ],
      business: biz({
        support: 2,
        materials: 0.20, ownerCapacity: 500000, revPerTech: 320000, costPerTech: 130000, managerSalary: 150000, overheadPct: 0.16, fixedOverhead: 60000,
        enabled: false, startAge: 40, startup: 200000, rev: 500000, growth: 0.18, ceiling: 4000000,
        gross: 0.65, net: 0.25, ownerSalary: 200000, marketWage: 200000,
        multiple: 4.0, leadAge: 40, ownerAge: 42, investorAge: 47,
        qOwner: 6, qRecur: 6, qSpread: 5, qMgmt: 7, qAssets: 3, qGrowth: 7
      }),
      lifestyle: life({
        hours: 55, ot: 8, evening: 8, weekend: 6, onCall: 7, vac: 4, vacTake: 4, leaveWeeks: 2,
        sCust: 7, sEmp: 9, sLiab: 7, sEmerg: 6, sFin: 7, sReg: 6,
        phys: 9, mental: 2,
        fHours: 5, fDays: 3, fRemote: 7, fVac: 3, fMove: 4, fEmp: 6, fSelf: 6,
        kDemand: 5, kAuto: 6, kOut: 5, kRec: 3, kLic: 1, kShort: 3,
        pEve: 3, pWknd: 4, pPred: 3, pTravel: 3, pAttend: 3
      }),
      traits: traits({ bEase: 5, demand: 6, margins: 8, capital: 3, scale: 8, durable: 4, wealth: 8, ceiling: 10, schedule: 4, delegate: 8, recurring: 5 }),
      living: { expenses: 85000, creep: 0.40, conf: 'estimated' }
    },

    trucker: {
      name: 'Owner-Operator Trucker', type: 'owneroperator', conf: 'industry',
      note: 'Owns the truck, drives the truck. The classic owner-operator trap: good income, almost no transferable asset.',
      education: {
        studentLivingCost: 15000, schoolWorkHours: 700, studyHoursPerYear: 400,
        yearsEducation: 0, yearsApprenticeship: 0, yearsUnpaidSchool: 0.2, yearsPaidTraining: 0,
        tuitionPerYear: 10000, tuitionYears: 1, books: 200, tools: 800,
        certification: 500, licensing: 900, examFees: 400, equipment: 500, other: 400,
        familyPaid: 0, scholarships: 0, grants: 1000, conf: 'industry'
      },
      debt: { rate: 0.075, termYears: 4, conf: 'estimated' },
      stages: [
        stage(18, 'Yard / local driver', 48000, 6000, 0, { benefits: 2000 }),
        stage(20, 'Company long-haul driver', 72000, 10000, 2000, { benefits: 2800 }),
        stage(23, 'Senior company driver', 85000, 12000, 3000, { benefits: 3200 })
      ],
      business: biz({
        support: 0,
        materials: 0.42, ownerCapacity: 280000, revPerTech: 300000, costPerTech: 95000, managerSalary: 85000, capex: 0.02, overheadPct: 0.10, fixedOverhead: 22000,
        startAge: 25, startup: 160000, loanShare: 0.8, loanRate: 0.09, loanYears: 5,
        rev: 280000, growth: 0.08, ceiling: 1400000,
        gross: 0.40, net: 0.16, ownerSalary: 95000, marketWage: 85000,
        multiple: 2.0, leadAge: 33, ownerAge: 38, investorAge: 0,
        qOwner: 2, qRecur: 5, qSpread: 3, qMgmt: 2, qAssets: 8, qGrowth: 4
      }),
      lifestyle: life({
        hours: 60, ot: 10, evening: 8, weekend: 8, onCall: 7, vac: 2, vacTake: 3, leaveWeeks: 1,
        sCust: 5, sEmp: 2, sLiab: 7, sEmerg: 6, sFin: 8, sReg: 8,
        phys: 5, mental: 5,
        fHours: 4, fDays: 3, fRemote: 1, fVac: 3, fMove: 6, fEmp: 7, fSelf: 9,
        kDemand: 7, kAuto: 4, kOut: 8, kRec: 4, kLic: 5, kShort: 7,
        pEve: 2, pWknd: 3, pPred: 3, pTravel: 1, pAttend: 2
      }),
      traits: traits({ bEase: 8, demand: 7, margins: 4, capital: 3, scale: 5, durable: 5, wealth: 5, ceiling: 5, schedule: 3, delegate: 4, recurring: 5 }),
      living: { expenses: 44000, creep: 0.25, conf: 'estimated' }
    },

    nurse: {
      name: 'Registered Nurse', type: 'professional', conf: 'industry',
      note: 'Four-year degree, strong pension, heavy shift work. Almost no business path unless it becomes an agency.',
      education: {
        studentLivingCost: 21000, schoolWorkHours: 700, studyHoursPerYear: 1600,
        yearsEducation: 4, yearsApprenticeship: 0, yearsUnpaidSchool: 4, yearsPaidTraining: 0,
        tuitionPerYear: 8500, tuitionYears: 4, books: 3000, tools: 1500,
        certification: 1000, licensing: 900, examFees: 1000, equipment: 1200, other: 2500,
        familyPaid: 6000, scholarships: 4000, grants: 3000, conf: 'industry'
      },
      debt: { rate: 0.065, termYears: 10, conf: 'industry' },
      stages: [
        stage(18, 'Student, summer work', 11000, 0, 0, {}),
        stage(22, 'New graduate RN', 80000, 8000, 0, { benefits: 5000, pension: 7000 }),
        stage(26, 'Experienced RN', 98000, 12000, 0, { benefits: 5500, pension: 9000 }),
        stage(32, 'Charge nurse / specialty', 112000, 14000, 2000, { benefits: 6000, pension: 11000 })
      ],
      business: biz({
        support: 2,
        materials: 0.60, ownerCapacity: 400000, revPerTech: 260000, costPerTech: 105000, overheadPct: 0.10, fixedOverhead: 45000,
        enabled: false, startAge: 36, startup: 60000, rev: 400000, growth: 0.20, ceiling: 3000000,
        gross: 0.30, net: 0.14, ownerSalary: 120000, marketWage: 110000,
        multiple: 2.8, leadAge: 37, ownerAge: 40, investorAge: 46,
        qOwner: 5, qRecur: 7, qSpread: 5, qMgmt: 5, qAssets: 2, qGrowth: 7
      }),
      lifestyle: life({
        hours: 40, ot: 8, evening: 9, weekend: 9, onCall: 6, vac: 4, vacTake: 6, leaveWeeks: 3,
        sCust: 8, sEmp: 3, sLiab: 8, sEmerg: 9, sFin: 2, sReg: 7,
        phys: 4, mental: 3,
        fHours: 5, fDays: 7, fRemote: 1, fVac: 5, fMove: 9, fEmp: 9, fSelf: 4,
        kDemand: 10, kAuto: 9, kOut: 9, kRec: 10, kLic: 9, kShort: 10,
        pEve: 3, pWknd: 3, pPred: 4, pTravel: 9, pAttend: 4
      }),
      traits: traits({ bEase: 3, demand: 10, margins: 4, capital: 6, scale: 5, durable: 10, wealth: 5, ceiling: 5, schedule: 5, delegate: 4, recurring: 6 }),
      living: { expenses: 48000, creep: 0.25, conf: 'estimated' }
    },

    /* ---------------- ten more trades ---------------- */
    carpenter: {
      name: 'Carpenter', type: 'journeyperson', conf: 'industry',
      note: 'Four-year Alberta apprenticeship, eight weeks of class a year. Framing and finishing, then a renovation company.',
      education: {
        studentLivingCost: 16000, schoolWorkHours: 700, studyHoursPerYear: 320,
        yearsEducation: 0, yearsApprenticeship: 4, yearsUnpaidSchool: 0.6, yearsPaidTraining: 3.4,
        tuitionPerYear: 1300, tuitionYears: 4, books: 400, tools: 5500,
        certification: 450, licensing: 350, examFees: 300, equipment: 900, other: 500,
        familyPaid: 0, scholarships: 1000, grants: 2000, conf: 'industry'
      },
      debt: { rate: 0.065, termYears: 5, conf: 'estimated' },
      stages: [
        stage(18, '1st year apprentice', 38000, 4000, 0, { benefits: 2200 }),
        stage(19, '2nd year apprentice', 46000, 5000, 0, { benefits: 2500 }),
        stage(20, '3rd year apprentice', 54000, 6000, 500, { benefits: 2800, pension: 1200 }),
        stage(21, '4th year apprentice', 60000, 7000, 800, { benefits: 3000, pension: 1600 }),
        stage(22, 'Journeyperson', 72000, 8000, 1500, { benefits: 3500, pension: 2500, vehicle: 1200 }),
        stage(25, 'Lead carpenter / site super', 82000, 10000, 3000, { benefits: 3800, pension: 3500, vehicle: 2000 })
      ],
      business: biz({
        support: 1,
        materials: 0.38, ownerCapacity: 220000, revPerTech: 260000, costPerTech: 95000, overheadPct: 0.12, fixedOverhead: 26000,
        startAge: 27, startup: 30000, rev: 220000, growth: 0.17, ceiling: 2600000,
        gross: 0.52, net: 0.18, ownerSalary: 85000, emp: 0, marketWage: 82000,
        multiple: 2.8, valMethod: 'sde', leadAge: 30, ownerAge: 34, investorAge: 40,
        qOwner: 4, qRecur: 2, qSpread: 7, qMgmt: 3, qAssets: 5, qGrowth: 6
      }),
      lifestyle: life({
        hours: 42, ot: 5, evening: 3, weekend: 4, onCall: 2, vac: 2, vacTake: 5, leaveWeeks: 2,
        sCust: 5, sEmp: 3, sLiab: 5, sEmerg: 3, sFin: 5, sReg: 4,
        phys: 3, mental: 6,
        fHours: 5, fDays: 4, fRemote: 1, fVac: 4, fMove: 8, fEmp: 8, fSelf: 9,
        kDemand: 8, kAuto: 9, kOut: 10, kRec: 4, kLic: 5, kShort: 7,
        pEve: 6, pWknd: 6, pPred: 5, pTravel: 7, pAttend: 6
      }),
      traits: traits({ bEase: 9, demand: 8, margins: 5, capital: 8, scale: 7, durable: 8, wealth: 7, ceiling: 5, schedule: 5, delegate: 7, recurring: 2 }),
      living: { expenses: 42000, creep: 0.25, conf: 'estimated' }
    },
    autotech: {
      name: 'Automotive Service Technician', type: 'journeyperson', conf: 'industry',
      note: 'Four-year apprenticeship. Flat-rate pay is common; the business is an independent repair shop with real fixed costs.',
      education: {
        studentLivingCost: 16000, schoolWorkHours: 700, studyHoursPerYear: 320,
        yearsEducation: 0, yearsApprenticeship: 4, yearsUnpaidSchool: 0.6, yearsPaidTraining: 3.4,
        tuitionPerYear: 1300, tuitionYears: 4, books: 400, tools: 9000,
        certification: 450, licensing: 350, examFees: 300, equipment: 1500, other: 500,
        familyPaid: 0, scholarships: 1000, grants: 2000, conf: 'industry'
      },
      debt: { rate: 0.065, termYears: 5, conf: 'estimated' },
      stages: [
        stage(18, '1st year apprentice', 36000, 3000, 0, { benefits: 2000 }),
        stage(19, '2nd year apprentice', 42000, 4000, 0, { benefits: 2400 }),
        stage(20, '3rd year apprentice', 50000, 5000, 500, { benefits: 2800, pension: 1000 }),
        stage(21, '4th year apprentice', 58000, 6000, 1000, { benefits: 3000, pension: 1500 }),
        stage(22, 'Journeyperson technician', 70000, 6000, 3000, { benefits: 3500, pension: 2500 }),
        stage(25, 'Senior / diagnostic tech', 78000, 8000, 4000, { benefits: 3800, pension: 3200 })
      ],
      business: biz({
        support: 1,
        materials: 0.36, ownerCapacity: 260000, revPerTech: 300000, costPerTech: 90000, overheadPct: 0.12, fixedOverhead: 40000,
        startAge: 28, startup: 90000, loanShare: 0.7, rev: 400000, growth: 0.12, ceiling: 3000000,
        gross: 0.58, net: 0.16, ownerSalary: 75000, emp: 1, marketWage: 80000,
        multiple: 2.6, valMethod: 'sde', leadAge: 30, ownerAge: 34, investorAge: 41,
        qOwner: 5, qRecur: 6, qSpread: 8, qMgmt: 3, qAssets: 7, qGrowth: 5
      }),
      lifestyle: life({
        hours: 42, ot: 4, evening: 3, weekend: 4, onCall: 1, vac: 2, vacTake: 5, leaveWeeks: 2,
        sCust: 6, sEmp: 3, sLiab: 5, sEmerg: 3, sFin: 5, sReg: 5,
        phys: 4, mental: 6,
        fHours: 4, fDays: 4, fRemote: 1, fVac: 4, fMove: 8, fEmp: 8, fSelf: 7,
        kDemand: 8, kAuto: 7, kOut: 10, kRec: 7, kLic: 6, kShort: 8,
        pEve: 7, pWknd: 6, pPred: 7, pTravel: 9, pAttend: 6
      }),
      traits: traits({ bEase: 6, demand: 9, margins: 5, capital: 4, scale: 7, durable: 8, wealth: 6, ceiling: 5, schedule: 4, delegate: 7, recurring: 6 }),
      living: { expenses: 42000, creep: 0.25, conf: 'estimated' }
    },
    heavyequipment: {
      name: 'Heavy Equipment Operator', type: 'owneroperator', conf: 'industry',
      note: 'Short course, then seat time. Seasonal, overtime-heavy. The business is an excavation contractor, which means iron.',
      education: {
        studentLivingCost: 15000, schoolWorkHours: 700, studyHoursPerYear: 400,
        yearsEducation: 0, yearsApprenticeship: 0, yearsUnpaidSchool: 0.2, yearsPaidTraining: 0,
        tuitionPerYear: 12000, tuitionYears: 1, books: 400, tools: 800,
        certification: 450, licensing: 350, examFees: 300, equipment: 600, other: 500,
        familyPaid: 0, scholarships: 1000, grants: 2000, conf: 'industry'
      },
      debt: { rate: 0.065, termYears: 5, conf: 'estimated' },
      stages: [
        stage(18, 'Labourer / spotter', 42000, 6000, 0, { benefits: 2000 }),
        stage(20, 'Operator', 62000, 12000, 1000, { benefits: 3000, pension: 2000 }),
        stage(23, 'Experienced operator', 74000, 14000, 2000, { benefits: 3500, pension: 3000 }),
        stage(28, 'Lead hand / foreman', 82000, 15000, 3000, { benefits: 3800, pension: 3500 })
      ],
      business: biz({
        support: 0,
        materials: 0.18, ownerCapacity: 320000, revPerTech: 300000, costPerTech: 92000, capex: 0.08, overheadPct: 0.12, fixedOverhead: 35000,
        startAge: 27, startup: 220000, loanShare: 0.8, loanRate: 0.085, loanYears: 6, rev: 320000, growth: 0.10, ceiling: 2000000,
        gross: 0.60, net: 0.20, ownerSalary: 90000, marketWage: 82000,
        multiple: 2.5, valMethod: 'sde', leadAge: 31, ownerAge: 35, investorAge: 42,
        qOwner: 4, qRecur: 3, qSpread: 5, qMgmt: 3, qAssets: 8, qGrowth: 5
      }),
      lifestyle: life({
        hours: 50, ot: 10, evening: 4, weekend: 5, onCall: 3, vac: 2, vacTake: 4, leaveWeeks: 2,
        sCust: 4, sEmp: 3, sLiab: 6, sEmerg: 4, sFin: 6, sReg: 5,
        phys: 5, mental: 6,
        fHours: 3, fDays: 3, fRemote: 1, fVac: 3, fMove: 7, fEmp: 8, fSelf: 7,
        kDemand: 7, kAuto: 6, kOut: 10, kRec: 4, kLic: 4, kShort: 7,
        pEve: 4, pWknd: 5, pPred: 4, pTravel: 5, pAttend: 4
      }),
      traits: traits({ bEase: 6, demand: 7, margins: 6, capital: 3, scale: 6, durable: 7, wealth: 6, ceiling: 5, schedule: 3, delegate: 6, recurring: 3 }),
      living: { expenses: 44000, creep: 0.25, conf: 'estimated' }
    },
    millwright: {
      name: 'Industrial Mechanic (Millwright)', type: 'journeyperson', conf: 'industry',
      note: 'Four-year apprenticeship, plants and mills, shutdown overtime. The business is an industrial maintenance contractor.',
      education: {
        studentLivingCost: 16000, schoolWorkHours: 700, studyHoursPerYear: 320,
        yearsEducation: 0, yearsApprenticeship: 4, yearsUnpaidSchool: 0.6, yearsPaidTraining: 3.4,
        tuitionPerYear: 1300, tuitionYears: 4, books: 400, tools: 7000,
        certification: 450, licensing: 350, examFees: 300, equipment: 1200, other: 500,
        familyPaid: 0, scholarships: 1000, grants: 2000, conf: 'industry'
      },
      debt: { rate: 0.065, termYears: 5, conf: 'estimated' },
      stages: [
        stage(18, '1st year apprentice', 40000, 5000, 0, { benefits: 2500 }),
        stage(19, '2nd year apprentice', 48000, 6000, 0, { benefits: 2800 }),
        stage(20, '3rd year apprentice', 56000, 8000, 500, { benefits: 3000, pension: 1500 }),
        stage(21, '4th year apprentice', 64000, 10000, 1000, { benefits: 3200, pension: 2000 }),
        stage(22, 'Journeyperson millwright', 82000, 14000, 3000, { benefits: 4200, pension: 4000 }),
        stage(25, 'Senior millwright / planner', 92000, 18000, 4000, { benefits: 4500, pension: 5500 })
      ],
      business: biz({
        support: 1,
        materials: 0.22, ownerCapacity: 260000, revPerTech: 320000, costPerTech: 120000, overheadPct: 0.12, fixedOverhead: 40000,
        startAge: 30, startup: 80000, loanShare: 0.6, rev: 380000, growth: 0.15, ceiling: 4000000,
        gross: 0.58, net: 0.22, ownerSalary: 110000, emp: 1, marketWage: 100000,
        multiple: 3.0, valMethod: 'sde', leadAge: 32, ownerAge: 36, investorAge: 42,
        qOwner: 4, qRecur: 5, qSpread: 4, qMgmt: 3, qAssets: 5, qGrowth: 6
      }),
      lifestyle: life({
        hours: 44, ot: 10, evening: 6, weekend: 5, onCall: 6, vac: 3, vacTake: 5, leaveWeeks: 2,
        sCust: 4, sEmp: 3, sLiab: 6, sEmerg: 6, sFin: 4, sReg: 5,
        phys: 4, mental: 6,
        fHours: 3, fDays: 4, fRemote: 1, fVac: 4, fMove: 7, fEmp: 8, fSelf: 7,
        kDemand: 8, kAuto: 8, kOut: 9, kRec: 5, kLic: 7, kShort: 8,
        pEve: 5, pWknd: 5, pPred: 4, pTravel: 5, pAttend: 5
      }),
      traits: traits({ bEase: 6, demand: 8, margins: 6, capital: 6, scale: 6, durable: 8, wealth: 7, ceiling: 7, schedule: 3, delegate: 6, recurring: 5 }),
      living: { expenses: 46000, creep: 0.25, conf: 'estimated' }
    },
    roofer: {
      name: 'Roofer', type: 'journeyperson', conf: 'industry',
      note: 'Two-year apprenticeship. Hard on the body, seasonal, storms make the phone ring. Low barrier to a company of your own.',
      education: {
        studentLivingCost: 15000, schoolWorkHours: 700, studyHoursPerYear: 320,
        yearsEducation: 0, yearsApprenticeship: 2, yearsUnpaidSchool: 0.3, yearsPaidTraining: 1.7,
        tuitionPerYear: 1300, tuitionYears: 2, books: 400, tools: 3500,
        certification: 450, licensing: 350, examFees: 300, equipment: 1500, other: 500,
        familyPaid: 0, scholarships: 1000, grants: 2000, conf: 'industry'
      },
      debt: { rate: 0.065, termYears: 5, conf: 'estimated' },
      stages: [
        stage(18, 'Labourer / 1st year', 38000, 6000, 0, { benefits: 1500 }),
        stage(19, '2nd year apprentice', 46000, 7000, 0, { benefits: 2000 }),
        stage(20, 'Journeyperson roofer', 62000, 10000, 1500, { benefits: 2800, pension: 1500 }),
        stage(24, 'Foreman', 74000, 12000, 3000, { benefits: 3200, pension: 2500, vehicle: 1500 })
      ],
      business: biz({
        support: 1,
        materials: 0.42, ownerCapacity: 240000, revPerTech: 260000, costPerTech: 78000, overheadPct: 0.12, fixedOverhead: 32000,
        startAge: 25, startup: 45000, rev: 380000, growth: 0.20, ceiling: 4000000,
        gross: 0.48, net: 0.18, ownerSalary: 85000, emp: 1, marketWage: 75000,
        multiple: 2.5, valMethod: 'sde', leadAge: 27, ownerAge: 31, investorAge: 37,
        qOwner: 5, qRecur: 2, qSpread: 7, qMgmt: 3, qAssets: 4, qGrowth: 7
      }),
      lifestyle: life({
        hours: 46, ot: 8, evening: 3, weekend: 5, onCall: 4, vac: 2, vacTake: 4, leaveWeeks: 2,
        sCust: 6, sEmp: 4, sLiab: 7, sEmerg: 6, sFin: 6, sReg: 5,
        phys: 1, mental: 7,
        fHours: 4, fDays: 4, fRemote: 1, fVac: 3, fMove: 8, fEmp: 8, fSelf: 9,
        kDemand: 8, kAuto: 9, kOut: 10, kRec: 4, kLic: 4, kShort: 8,
        pEve: 6, pWknd: 5, pPred: 4, pTravel: 8, pAttend: 5
      }),
      traits: traits({ bEase: 9, demand: 8, margins: 5, capital: 7, scale: 8, durable: 7, wealth: 7, ceiling: 4, schedule: 4, delegate: 8, recurring: 2 }),
      living: { expenses: 40000, creep: 0.25, conf: 'estimated' }
    },
    landscaper: {
      name: 'Landscaper', type: 'journeyperson', conf: 'industry',
      note: 'Crew work first, then a landscape construction and maintenance company. Maintenance contracts are the recurring part.',
      education: {
        studentLivingCost: 15000, schoolWorkHours: 700, studyHoursPerYear: 320,
        yearsEducation: 0, yearsApprenticeship: 3, yearsUnpaidSchool: 0.45, yearsPaidTraining: 2.55,
        tuitionPerYear: 1300, tuitionYears: 3, books: 400, tools: 2500,
        certification: 450, licensing: 350, examFees: 300, equipment: 1000, other: 500,
        familyPaid: 0, scholarships: 1000, grants: 2000, conf: 'industry'
      },
      debt: { rate: 0.065, termYears: 5, conf: 'estimated' },
      stages: [
        stage(18, 'Crew member', 36000, 5000, 0, { benefits: 1200 }),
        stage(19, '2nd year', 40000, 5000, 0, { benefits: 1500 }),
        stage(20, '3rd year', 46000, 6000, 500, { benefits: 2000 }),
        stage(21, 'Crew lead', 54000, 8000, 1000, { benefits: 2500, pension: 1000 }),
        stage(24, 'Foreman / estimator', 64000, 9000, 2500, { benefits: 3000, pension: 2000, vehicle: 1500 })
      ],
      business: biz({
        support: 1,
        materials: 0.34, ownerCapacity: 220000, revPerTech: 190000, costPerTech: 62000, overheadPct: 0.12, fixedOverhead: 30000,
        startAge: 24, startup: 60000, loanShare: 0.6, rev: 260000, growth: 0.20, ceiling: 3000000,
        gross: 0.50, net: 0.18, ownerSalary: 75000, emp: 1, marketWage: 65000,
        multiple: 2.6, valMethod: 'sde', leadAge: 26, ownerAge: 30, investorAge: 36,
        qOwner: 5, qRecur: 6, qSpread: 7, qMgmt: 3, qAssets: 6, qGrowth: 7
      }),
      lifestyle: life({
        hours: 50, ot: 8, evening: 3, weekend: 6, onCall: 2, vac: 3, vacTake: 5, leaveWeeks: 3,
        sCust: 5, sEmp: 4, sLiab: 4, sEmerg: 3, sFin: 6, sReg: 3,
        phys: 2, mental: 7,
        fHours: 4, fDays: 4, fRemote: 1, fVac: 5, fMove: 8, fEmp: 8, fSelf: 10,
        kDemand: 7, kAuto: 8, kOut: 10, kRec: 4, kLic: 2, kShort: 6,
        pEve: 6, pWknd: 4, pPred: 4, pTravel: 8, pAttend: 5
      }),
      traits: traits({ bEase: 10, demand: 7, margins: 5, capital: 7, scale: 8, durable: 7, wealth: 6, ceiling: 4, schedule: 4, delegate: 8, recurring: 6 }),
      living: { expenses: 40000, creep: 0.25, conf: 'estimated' }
    },
    ductcleaner: {
      name: 'Furnace & Duct Cleaning Technician', type: 'owneroperator', conf: 'industry',
      note: 'No apprenticeship, a certificate and a truck. Almost the whole outcome is whether the business gets built, which is the point.',
      education: {
        studentLivingCost: 15000, schoolWorkHours: 700, studyHoursPerYear: 150,
        yearsEducation: 0, yearsApprenticeship: 0, yearsUnpaidSchool: 0.2, yearsPaidTraining: 0,
        tuitionPerYear: 1500, tuitionYears: 1, books: 400, tools: 1500,
        certification: 450, licensing: 350, examFees: 300, equipment: 800, other: 500,
        familyPaid: 0, scholarships: 1000, grants: 2000, conf: 'industry'
      },
      debt: { rate: 0.065, termYears: 5, conf: 'estimated' },
      stages: [
        stage(18, 'Helper', 38000, 4000, 0, { benefits: 1200 }),
        stage(19, 'Technician', 46000, 6000, 500, { benefits: 1800 }),
        stage(21, 'Senior technician', 54000, 7000, 1500, { benefits: 2200, pension: 800 }),
        stage(25, 'Lead tech / estimator', 62000, 8000, 3000, { benefits: 2600, pension: 1500, vehicle: 1200 })
      ],
      business: biz({
        support: 1,
        materials: 0.12, ownerCapacity: 200000, revPerTech: 175000, costPerTech: 64000, capex: 0.06, marketing: 0.09, overheadPct: 0.15, fixedOverhead: 30000,
        startAge: 22, startup: 55000, loanShare: 0.7, rev: 200000, growth: 0.15, ceiling: 1500000,
        gross: 0.68, net: 0.22, ownerSalary: 70000, emp: 0, marketWage: 60000,
        multiple: 2.4, valMethod: 'sde', leadAge: 25, ownerAge: 29, investorAge: 35,
        qOwner: 5, qRecur: 5, qSpread: 9, qMgmt: 3, qAssets: 5, qGrowth: 7
      }),
      lifestyle: life({
        hours: 45, ot: 6, evening: 3, weekend: 4, onCall: 2, vac: 2, vacTake: 5, leaveWeeks: 2,
        sCust: 5, sEmp: 3, sLiab: 3, sEmerg: 2, sFin: 5, sReg: 2,
        phys: 3, mental: 7,
        fHours: 5, fDays: 4, fRemote: 1, fVac: 4, fMove: 8, fEmp: 7, fSelf: 10,
        kDemand: 7, kAuto: 9, kOut: 10, kRec: 6, kLic: 3, kShort: 5,
        pEve: 6, pWknd: 6, pPred: 6, pTravel: 8, pAttend: 6
      }),
      traits: traits({ bEase: 10, demand: 7, margins: 7, capital: 8, scale: 8, durable: 7, wealth: 7, ceiling: 3, schedule: 5, delegate: 8, recurring: 5 }),
      living: { expenses: 40000, creep: 0.25, conf: 'estimated' }
    },
    painter: {
      name: 'Painter & Decorator', type: 'journeyperson', conf: 'industry',
      note: 'Three-year apprenticeship. Low capital, thin barriers, so the business is easy to start and hard to make special.',
      education: {
        studentLivingCost: 15000, schoolWorkHours: 700, studyHoursPerYear: 320,
        yearsEducation: 0, yearsApprenticeship: 3, yearsUnpaidSchool: 0.45, yearsPaidTraining: 2.55,
        tuitionPerYear: 1300, tuitionYears: 3, books: 400, tools: 2000,
        certification: 450, licensing: 350, examFees: 300, equipment: 800, other: 500,
        familyPaid: 0, scholarships: 1000, grants: 2000, conf: 'industry'
      },
      debt: { rate: 0.065, termYears: 5, conf: 'estimated' },
      stages: [
        stage(18, '1st year apprentice', 34000, 3000, 0, { benefits: 1500 }),
        stage(19, '2nd year apprentice', 40000, 4000, 0, { benefits: 1800 }),
        stage(20, '3rd year apprentice', 46000, 4000, 500, { benefits: 2200 }),
        stage(21, 'Journeyperson painter', 58000, 6000, 1000, { benefits: 2800, pension: 1500 }),
        stage(25, 'Lead painter', 64000, 7000, 2000, { benefits: 3000, pension: 2000, vehicle: 1000 })
      ],
      business: biz({
        support: 0,
        materials: 0.18, ownerCapacity: 180000, revPerTech: 150000, costPerTech: 62000, overheadPct: 0.13, fixedOverhead: 22000,
        startAge: 25, startup: 20000, rev: 200000, growth: 0.14, ceiling: 1600000,
        gross: 0.62, net: 0.22, ownerSalary: 70000, emp: 0, marketWage: 62000,
        multiple: 2.5, valMethod: 'sde', leadAge: 27, ownerAge: 31, investorAge: 38,
        qOwner: 5, qRecur: 3, qSpread: 8, qMgmt: 3, qAssets: 3, qGrowth: 6
      }),
      lifestyle: life({
        hours: 42, ot: 4, evening: 3, weekend: 3, onCall: 1, vac: 2, vacTake: 5, leaveWeeks: 2,
        sCust: 5, sEmp: 3, sLiab: 3, sEmerg: 2, sFin: 5, sReg: 2,
        phys: 4, mental: 8,
        fHours: 5, fDays: 5, fRemote: 1, fVac: 5, fMove: 8, fEmp: 8, fSelf: 10,
        kDemand: 7, kAuto: 8, kOut: 10, kRec: 4, kLic: 3, kShort: 6,
        pEve: 7, pWknd: 7, pPred: 6, pTravel: 8, pAttend: 7
      }),
      traits: traits({ bEase: 10, demand: 7, margins: 6, capital: 9, scale: 7, durable: 7, wealth: 6, ceiling: 3, schedule: 6, delegate: 7, recurring: 3 }),
      living: { expenses: 40000, creep: 0.25, conf: 'estimated' }
    },
    pipefitter: {
      name: 'Steamfitter-Pipefitter', type: 'journeyperson', conf: 'industry',
      note: 'Four-year apprenticeship, industrial sites and shutdowns, the biggest overtime in the trades. Camp work is common.',
      education: {
        studentLivingCost: 16000, schoolWorkHours: 700, studyHoursPerYear: 320,
        yearsEducation: 0, yearsApprenticeship: 4, yearsUnpaidSchool: 0.6, yearsPaidTraining: 3.4,
        tuitionPerYear: 1300, tuitionYears: 4, books: 400, tools: 6500,
        certification: 450, licensing: 350, examFees: 300, equipment: 1500, other: 500,
        familyPaid: 0, scholarships: 1000, grants: 2000, conf: 'industry'
      },
      debt: { rate: 0.065, termYears: 5, conf: 'estimated' },
      stages: [
        stage(18, '1st year apprentice', 44000, 8000, 0, { benefits: 2500 }),
        stage(19, '2nd year apprentice', 52000, 9000, 0, { benefits: 2800 }),
        stage(20, '3rd year apprentice', 60000, 11000, 500, { benefits: 3000, pension: 2000 }),
        stage(21, '4th year apprentice', 68000, 13000, 1000, { benefits: 3200, pension: 2500 }),
        stage(22, 'Journeyperson', 92000, 20000, 3000, { benefits: 4500, pension: 6000 }),
        stage(25, 'Senior / foreman', 104000, 24000, 5000, { benefits: 4800, pension: 7500 })
      ],
      business: biz({
        support: 2,
        materials: 0.35, ownerCapacity: 300000, revPerTech: 340000, costPerTech: 130000, overheadPct: 0.12, fixedOverhead: 55000,
        startAge: 30, startup: 120000, loanShare: 0.6, rev: 600000, growth: 0.14, ceiling: 6000000,
        gross: 0.50, net: 0.18, ownerSalary: 120000, emp: 1, marketWage: 110000,
        multiple: 3.0, valMethod: 'sde', leadAge: 32, ownerAge: 36, investorAge: 42,
        qOwner: 4, qRecur: 4, qSpread: 4, qMgmt: 3, qAssets: 5, qGrowth: 6
      }),
      lifestyle: life({
        hours: 48, ot: 14, evening: 5, weekend: 6, onCall: 4, vac: 3, vacTake: 4, leaveWeeks: 2,
        sCust: 4, sEmp: 3, sLiab: 6, sEmerg: 5, sFin: 4, sReg: 6,
        phys: 3, mental: 6,
        fHours: 3, fDays: 3, fRemote: 1, fVac: 4, fMove: 6, fEmp: 8, fSelf: 7,
        kDemand: 8, kAuto: 9, kOut: 10, kRec: 4, kLic: 8, kShort: 8,
        pEve: 4, pWknd: 4, pPred: 3, pTravel: 3, pAttend: 4
      }),
      traits: traits({ bEase: 6, demand: 8, margins: 6, capital: 5, scale: 7, durable: 8, wealth: 7, ceiling: 7, schedule: 3, delegate: 6, recurring: 4 }),
      living: { expenses: 48000, creep: 0.25, conf: 'estimated' }
    },
    lineworker: {
      name: 'Powerline Technician', type: 'journeyperson', conf: 'industry',
      note: 'Three-year apprenticeship, storm calls, big overtime, a real pension. Almost always a utility employee - the business path is off by default.',
      education: {
        studentLivingCost: 16000, schoolWorkHours: 700, studyHoursPerYear: 320,
        yearsEducation: 0, yearsApprenticeship: 3, yearsUnpaidSchool: 0.45, yearsPaidTraining: 2.55,
        tuitionPerYear: 1300, tuitionYears: 3, books: 400, tools: 4000,
        certification: 450, licensing: 350, examFees: 300, equipment: 1500, other: 500,
        familyPaid: 0, scholarships: 1000, grants: 2000, conf: 'industry'
      },
      debt: { rate: 0.065, termYears: 5, conf: 'estimated' },
      stages: [
        stage(18, 'Pre-apprentice / groundhand', 50000, 10000, 0, { benefits: 3000, pension: 3000 }),
        stage(19, '2nd year apprentice', 60000, 14000, 0, { benefits: 3500, pension: 4000 }),
        stage(20, '3rd year apprentice', 70000, 16000, 500, { benefits: 4000, pension: 5000 }),
        stage(21, 'Journeyperson PLT', 100000, 24000, 2000, { benefits: 5500, pension: 10000 }),
        stage(25, 'Senior PLT / crew lead', 112000, 28000, 3000, { benefits: 6000, pension: 12000 })
      ],
      business: biz({
        support: 2,
        materials: 0.25, ownerCapacity: 400000, revPerTech: 380000, costPerTech: 150000, capex: 0.08, overheadPct: 0.12, fixedOverhead: 90000,
        enabled: false, startAge: 34, startup: 400000, loanShare: 0.8, loanRate: 0.085, loanYears: 8, rev: 900000, growth: 0.12, ceiling: 8000000,
        gross: 0.55, net: 0.16, ownerSalary: 140000, emp: 2, marketWage: 125000,
        multiple: 3.0, valMethod: 'sde', leadAge: 35, ownerAge: 39, investorAge: 45,
        qOwner: 4, qRecur: 4, qSpread: 3, qMgmt: 4, qAssets: 7, qGrowth: 5
      }),
      lifestyle: life({
        hours: 44, ot: 14, evening: 5, weekend: 6, onCall: 9, vac: 4, vacTake: 6, leaveWeeks: 3,
        sCust: 3, sEmp: 2, sLiab: 8, sEmerg: 8, sFin: 2, sReg: 6,
        phys: 2, mental: 5,
        fHours: 3, fDays: 3, fRemote: 1, fVac: 5, fMove: 6, fEmp: 6, fSelf: 3,
        kDemand: 9, kAuto: 9, kOut: 10, kRec: 8, kLic: 8, kShort: 8,
        pEve: 5, pWknd: 4, pPred: 3, pTravel: 5, pAttend: 4
      }),
      traits: traits({ bEase: 3, demand: 9, margins: 5, capital: 2, scale: 5, durable: 9, wealth: 6, ceiling: 7, schedule: 3, delegate: 5, recurring: 4 }),
      living: { expenses: 46000, creep: 0.25, conf: 'estimated' }
    },

    /* ---------------- ten more professions ---------------- */
    physician: {
      name: 'Family Physician', type: 'professional', conf: 'industry',
      note: 'Four years of undergrad, four of medical school, two of paid residency. Fee-for-service billings less clinic overhead.',
      education: {
        studentLivingCost: 24000, schoolWorkHours: 700, studyHoursPerYear: 2000,
        yearsEducation: 8, yearsApprenticeship: 0, yearsUnpaidSchool: 8, yearsPaidTraining: 0,
        tuitionPerYear: 10250, tuitionYears: 8, books: 6000, tools: 4000,
        certification: 1500, licensing: 1200, examFees: 1500, equipment: 1500, other: 9000,
        familyPaid: 25000, scholarships: 8000, grants: 5000, conf: 'industry'
      },
      debt: { rate: 0.065, termYears: 15, conf: 'industry' },
      stages: [
        stage(18, 'Undergrad, summer work', 9000, 0, 0, {}),
        stage(22, 'Medical school, summer work', 6000, 0, 0, {}),
        stage(26, 'Resident', 72000, 8000, 0, { benefits: 3000 }),
        stage(28, 'Family physician, net of overhead', 230000, 0, 0, {}),
        stage(32, 'Established physician', 260000, 0, 0, {})
      ],
      business: biz({
        support: 4,
        materials: 0.06, ownerCapacity: 480000, revPerTech: 420000, costPerTech: 290000, managerSalary: 85000, overheadPct: 0.14, fixedOverhead: 60000,
        startAge: 31, startup: 180000, loanShare: 0.8, loanRate: 0.07, loanYears: 10, rev: 900000, growth: 0.08, ceiling: 2600000,
        gross: 0.72, net: 0.18, ownerSalary: 240000, emp: 1, marketWage: 240000,
        multiple: 2.5, valMethod: 'sde', leadAge: 31, ownerAge: 36, investorAge: 45,
        qOwner: 3, qRecur: 8, qSpread: 9, qMgmt: 4, qAssets: 5, qGrowth: 4
      }),
      lifestyle: life({
        hours: 50, ot: 6, evening: 4, weekend: 3, onCall: 5, vac: 4, vacTake: 6, leaveWeeks: 3,
        sCust: 7, sEmp: 5, sLiab: 9, sEmerg: 6, sFin: 5, sReg: 8,
        phys: 6, mental: 2,
        fHours: 6, fDays: 7, fRemote: 2, fVac: 5, fMove: 6, fEmp: 7, fSelf: 8,
        kDemand: 10, kAuto: 8, kOut: 10, kRec: 10, kLic: 10, kShort: 9,
        pEve: 6, pWknd: 7, pPred: 6, pTravel: 9, pAttend: 6
      }),
      traits: traits({ bEase: 4, demand: 10, margins: 6, capital: 3, scale: 5, durable: 10, wealth: 7, ceiling: 9, schedule: 6, delegate: 4, recurring: 8 }),
      living: { expenses: 65000, creep: 0.3, conf: 'estimated' }
    },
    veterinarian: {
      name: 'Veterinarian', type: 'professional', conf: 'industry',
      note: 'Two years of pre-vet plus four of veterinary school. Clinic ownership is where the money is, and consolidators pay for clinics.',
      education: {
        studentLivingCost: 22000, schoolWorkHours: 700, studyHoursPerYear: 2000,
        yearsEducation: 6, yearsApprenticeship: 0, yearsUnpaidSchool: 6, yearsPaidTraining: 0,
        tuitionPerYear: 11200, tuitionYears: 6, books: 5000, tools: 3500,
        certification: 1500, licensing: 1200, examFees: 1500, equipment: 1500, other: 6000,
        familyPaid: 15000, scholarships: 6000, grants: 4000, conf: 'industry'
      },
      debt: { rate: 0.066, termYears: 15, conf: 'industry' },
      stages: [
        stage(18, 'Undergrad, summer work', 9000, 0, 0, {}),
        stage(20, 'Vet school, summer work', 6000, 0, 0, {}),
        stage(24, 'Associate veterinarian', 95000, 0, 4000, { benefits: 2500 }),
        stage(27, 'Experienced associate', 118000, 0, 8000, { benefits: 3000 }),
        stage(31, 'Senior associate', 135000, 0, 10000, { benefits: 3500 })
      ],
      business: biz({
        support: 5,
        materials: 0.25, ownerCapacity: 600000, revPerTech: 550000, costPerTech: 165000, managerSalary: 95000, overheadPct: 0.24, fixedOverhead: 130000,
        startAge: 31, startup: 500000, loanShare: 0.8, loanRate: 0.07, loanYears: 12, rev: 1100000, growth: 0.09, ceiling: 3500000,
        gross: 0.68, net: 0.18, ownerSalary: 160000, emp: 2, marketWage: 130000,
        multiple: 4.0, valMethod: 'sde', leadAge: 32, ownerAge: 36, investorAge: 44,
        qOwner: 4, qRecur: 8, qSpread: 9, qMgmt: 5, qAssets: 7, qGrowth: 6
      }),
      lifestyle: life({
        hours: 45, ot: 6, evening: 5, weekend: 5, onCall: 6, vac: 3, vacTake: 6, leaveWeeks: 3,
        sCust: 7, sEmp: 5, sLiab: 7, sEmerg: 7, sFin: 6, sReg: 6,
        phys: 5, mental: 3,
        fHours: 6, fDays: 7, fRemote: 1, fVac: 5, fMove: 7, fEmp: 7, fSelf: 8,
        kDemand: 9, kAuto: 9, kOut: 10, kRec: 7, kLic: 10, kShort: 9,
        pEve: 6, pWknd: 6, pPred: 6, pTravel: 9, pAttend: 6
      }),
      traits: traits({ bEase: 4, demand: 9, margins: 7, capital: 2, scale: 6, durable: 9, wealth: 8, ceiling: 7, schedule: 6, delegate: 5, recurring: 8 }),
      living: { expenses: 56000, creep: 0.3, conf: 'estimated' }
    },
    architect: {
      name: 'Architect', type: 'professional', conf: 'industry',
      note: 'Four-year degree, two-year M.Arch, then a paid internship before registration. Studio hours are long in school and after.',
      education: {
        studentLivingCost: 21000, schoolWorkHours: 700, studyHoursPerYear: 1600,
        yearsEducation: 6, yearsApprenticeship: 0, yearsUnpaidSchool: 6, yearsPaidTraining: 0,
        tuitionPerYear: 8500, tuitionYears: 6, books: 4000, tools: 3500,
        certification: 1500, licensing: 1200, examFees: 1500, equipment: 1500, other: 5000,
        familyPaid: 8000, scholarships: 5000, grants: 3000, conf: 'industry'
      },
      debt: { rate: 0.065, termYears: 12, conf: 'industry' },
      stages: [
        stage(18, 'Undergrad, summer work', 9000, 0, 0, {}),
        stage(22, 'Master of Architecture', 8000, 0, 0, {}),
        stage(24, 'Intern architect', 62000, 3000, 1000, { benefits: 2500 }),
        stage(27, 'Registered architect', 82000, 5000, 3000, { benefits: 3500, pension: 3000 }),
        stage(32, 'Senior architect / associate', 105000, 10000, 8000, { benefits: 4500, pension: 5000 })
      ],
      business: biz({
        support: 1,
        materials: 0.06, ownerCapacity: 260000, revPerTech: 210000, costPerTech: 95000, overheadPct: 0.16, fixedOverhead: 45000,
        startAge: 34, startup: 40000, rev: 350000, growth: 0.14, ceiling: 4000000,
        gross: 0.80, net: 0.22, ownerSalary: 110000, emp: 1, marketWage: 105000,
        multiple: 2.2, valMethod: 'sde', leadAge: 36, ownerAge: 40, investorAge: 47,
        qOwner: 3, qRecur: 3, qSpread: 5, qMgmt: 3, qAssets: 2, qGrowth: 5
      }),
      lifestyle: life({
        hours: 45, ot: 6, evening: 5, weekend: 3, onCall: 1, vac: 3, vacTake: 6, leaveWeeks: 3,
        sCust: 6, sEmp: 3, sLiab: 7, sEmerg: 2, sFin: 5, sReg: 6,
        phys: 8, mental: 4,
        fHours: 6, fDays: 5, fRemote: 6, fVac: 5, fMove: 6, fEmp: 7, fSelf: 7,
        kDemand: 6, kAuto: 6, kOut: 6, kRec: 3, kLic: 8, kShort: 5,
        pEve: 6, pWknd: 7, pPred: 6, pTravel: 8, pAttend: 6
      }),
      traits: traits({ bEase: 5, demand: 6, margins: 6, capital: 8, scale: 5, durable: 6, wealth: 5, ceiling: 7, schedule: 6, delegate: 5, recurring: 3 }),
      living: { expenses: 52000, creep: 0.3, conf: 'estimated' }
    },
    physiotherapist: {
      name: 'Physiotherapist', type: 'professional', conf: 'industry',
      note: 'Four-year degree plus a two-year MScPT. Clinic ownership with associates on a split is the business.',
      education: {
        studentLivingCost: 21000, schoolWorkHours: 700, studyHoursPerYear: 1600,
        yearsEducation: 6, yearsApprenticeship: 0, yearsUnpaidSchool: 6, yearsPaidTraining: 0,
        tuitionPerYear: 10000, tuitionYears: 6, books: 3500, tools: 2500,
        certification: 1500, licensing: 1200, examFees: 1500, equipment: 1500, other: 5000,
        familyPaid: 8000, scholarships: 5000, grants: 3000, conf: 'industry'
      },
      debt: { rate: 0.065, termYears: 12, conf: 'industry' },
      stages: [
        stage(18, 'Undergrad, summer work', 9000, 0, 0, {}),
        stage(22, 'MScPT, summer work', 5000, 0, 0, {}),
        stage(24, 'Physiotherapist', 78000, 3000, 0, { benefits: 3000, pension: 2500 }),
        stage(27, 'Experienced physiotherapist', 90000, 6000, 2000, { benefits: 3500, pension: 3500 }),
        stage(32, 'Senior / clinic lead', 98000, 8000, 4000, { benefits: 4000, pension: 4500 })
      ],
      business: biz({
        support: 2,
        materials: 0.06, ownerCapacity: 250000, revPerTech: 190000, costPerTech: 100000, overheadPct: 0.18, fixedOverhead: 60000,
        startAge: 29, startup: 120000, loanShare: 0.7, rev: 420000, growth: 0.15, ceiling: 3000000,
        gross: 0.78, net: 0.22, ownerSalary: 100000, emp: 1, marketWage: 92000,
        multiple: 3.0, valMethod: 'sde', leadAge: 30, ownerAge: 34, investorAge: 40,
        qOwner: 5, qRecur: 6, qSpread: 8, qMgmt: 4, qAssets: 4, qGrowth: 6
      }),
      lifestyle: life({
        hours: 40, ot: 3, evening: 4, weekend: 2, onCall: 1, vac: 4, vacTake: 7, leaveWeeks: 3,
        sCust: 5, sEmp: 3, sLiab: 5, sEmerg: 2, sFin: 4, sReg: 5,
        phys: 5, mental: 5,
        fHours: 7, fDays: 8, fRemote: 2, fVac: 6, fMove: 8, fEmp: 8, fSelf: 8,
        kDemand: 9, kAuto: 9, kOut: 10, kRec: 7, kLic: 9, kShort: 8,
        pEve: 7, pWknd: 8, pPred: 8, pTravel: 9, pAttend: 7
      }),
      traits: traits({ bEase: 6, demand: 9, margins: 6, capital: 5, scale: 7, durable: 9, wealth: 6, ceiling: 5, schedule: 7, delegate: 6, recurring: 6 }),
      living: { expenses: 50000, creep: 0.3, conf: 'estimated' }
    },
    optometrist: {
      name: 'Optometrist', type: 'professional', conf: 'industry',
      note: 'Three years of undergrad plus four at optometry school, usually out of province. The practice sells frames as well as exams.',
      education: {
        studentLivingCost: 24000, schoolWorkHours: 700, studyHoursPerYear: 1850,
        yearsEducation: 7, yearsApprenticeship: 0, yearsUnpaidSchool: 7, yearsPaidTraining: 0,
        tuitionPerYear: 14000, tuitionYears: 7, books: 4500, tools: 6000,
        certification: 1500, licensing: 1200, examFees: 1500, equipment: 1500, other: 8000,
        familyPaid: 15000, scholarships: 5000, grants: 3000, conf: 'industry'
      },
      debt: { rate: 0.068, termYears: 15, conf: 'industry' },
      stages: [
        stage(18, 'Undergrad, summer work', 9000, 0, 0, {}),
        stage(21, 'Optometry school, summer work', 5000, 0, 0, {}),
        stage(25, 'Associate optometrist', 105000, 0, 5000, { benefits: 2500 }),
        stage(28, 'Experienced associate', 125000, 0, 8000, { benefits: 3000 }),
        stage(32, 'Senior associate', 140000, 0, 10000, { benefits: 3500 })
      ],
      business: biz({
        support: 4,
        materials: 0.30, ownerCapacity: 520000, revPerTech: 480000, costPerTech: 140000, managerSalary: 85000, overheadPct: 0.15, fixedOverhead: 70000,
        startAge: 31, startup: 350000, loanShare: 0.8, loanRate: 0.07, loanYears: 12, rev: 650000, growth: 0.08, ceiling: 2200000,
        gross: 0.64, net: 0.22, ownerSalary: 150000, emp: 0, marketWage: 135000,
        multiple: 3.5, valMethod: 'sde', leadAge: 32, ownerAge: 36, investorAge: 44,
        qOwner: 4, qRecur: 8, qSpread: 9, qMgmt: 5, qAssets: 7, qGrowth: 4
      }),
      lifestyle: life({
        hours: 38, ot: 2, evening: 3, weekend: 3, onCall: 1, vac: 4, vacTake: 7, leaveWeeks: 3,
        sCust: 5, sEmp: 4, sLiab: 6, sEmerg: 2, sFin: 5, sReg: 6,
        phys: 7, mental: 4,
        fHours: 7, fDays: 8, fRemote: 1, fVac: 6, fMove: 5, fEmp: 6, fSelf: 8,
        kDemand: 8, kAuto: 7, kOut: 9, kRec: 7, kLic: 10, kShort: 6,
        pEve: 8, pWknd: 7, pPred: 8, pTravel: 9, pAttend: 8
      }),
      traits: traits({ bEase: 4, demand: 8, margins: 7, capital: 2, scale: 6, durable: 8, wealth: 7, ceiling: 7, schedule: 7, delegate: 5, recurring: 8 }),
      living: { expenses: 56000, creep: 0.3, conf: 'estimated' }
    },
    chiropractor: {
      name: 'Chiropractor', type: 'professional', conf: 'industry',
      note: 'Three years of undergrad plus four at CMCC in Toronto, priced in. Most chiropractors own their clinic early, and it depends on them.',
      education: {
        studentLivingCost: 25000, schoolWorkHours: 700, studyHoursPerYear: 1850,
        yearsEducation: 7, yearsApprenticeship: 0, yearsUnpaidSchool: 7, yearsPaidTraining: 0,
        tuitionPerYear: 18600, tuitionYears: 7, books: 4000, tools: 5000,
        certification: 1500, licensing: 1200, examFees: 1500, equipment: 1500, other: 7000,
        familyPaid: 12000, scholarships: 4000, grants: 3000, conf: 'industry'
      },
      debt: { rate: 0.068, termYears: 15, conf: 'industry' },
      stages: [
        stage(18, 'Undergrad, summer work', 9000, 0, 0, {}),
        stage(21, 'Chiropractic college, summer work', 4000, 0, 0, {}),
        stage(25, 'Associate chiropractor', 70000, 0, 10000, {}),
        stage(28, 'Established chiropractor', 95000, 0, 10000, {}),
        stage(32, 'Senior chiropractor', 115000, 0, 12000, {})
      ],
      business: biz({
        support: 1,
        materials: 0.05, ownerCapacity: 280000, revPerTech: 200000, costPerTech: 100000, overheadPct: 0.18, fixedOverhead: 55000,
        startAge: 27, startup: 90000, loanShare: 0.7, rev: 280000, growth: 0.14, ceiling: 1800000,
        gross: 0.80, net: 0.28, ownerSalary: 100000, emp: 0, marketWage: 90000,
        multiple: 2.2, valMethod: 'sde', leadAge: 30, ownerAge: 35, investorAge: 44,
        qOwner: 2, qRecur: 6, qSpread: 8, qMgmt: 2, qAssets: 3, qGrowth: 5
      }),
      lifestyle: life({
        hours: 40, ot: 3, evening: 4, weekend: 3, onCall: 1, vac: 3, vacTake: 5, leaveWeeks: 2,
        sCust: 5, sEmp: 3, sLiab: 6, sEmerg: 2, sFin: 6, sReg: 6,
        phys: 4, mental: 5,
        fHours: 8, fDays: 8, fRemote: 1, fVac: 5, fMove: 6, fEmp: 5, fSelf: 10,
        kDemand: 6, kAuto: 9, kOut: 10, kRec: 5, kLic: 9, kShort: 4,
        pEve: 7, pWknd: 7, pPred: 8, pTravel: 9, pAttend: 7
      }),
      traits: traits({ bEase: 7, demand: 6, margins: 7, capital: 5, scale: 4, durable: 7, wealth: 5, ceiling: 5, schedule: 8, delegate: 3, recurring: 6 }),
      living: { expenses: 50000, creep: 0.3, conf: 'estimated' }
    },
    financialplanner: {
      name: 'Financial Planner (CFP)', type: 'professional', conf: 'industry',
      note: 'Four-year business degree and the CFP. Salary early, then a book of clients that pays every year and can be sold.',
      education: {
        studentLivingCost: 20000, schoolWorkHours: 700, studyHoursPerYear: 1350,
        yearsEducation: 4, yearsApprenticeship: 0, yearsUnpaidSchool: 4, yearsPaidTraining: 0,
        tuitionPerYear: 7500, tuitionYears: 4, books: 2500, tools: 1500,
        certification: 1500, licensing: 1200, examFees: 1500, equipment: 1500, other: 3000,
        familyPaid: 6000, scholarships: 3000, grants: 2500, conf: 'industry'
      },
      debt: { rate: 0.065, termYears: 10, conf: 'industry' },
      stages: [
        stage(18, 'Undergrad, summer work', 9000, 0, 0, {}),
        stage(22, 'Associate advisor', 52000, 0, 6000, { benefits: 2500, pension: 2000 }),
        stage(25, 'Financial advisor', 68000, 0, 12000, { benefits: 3000, pension: 3000 }),
        stage(29, 'Senior advisor', 90000, 0, 25000, { benefits: 3500, pension: 4500 }),
        stage(34, 'Senior planner', 110000, 0, 35000, { benefits: 4000, pension: 5500 })
      ],
      business: biz({
        support: 1,
        materials: 0.04, ownerCapacity: 320000, revPerTech: 260000, costPerTech: 110000, overheadPct: 0.16, fixedOverhead: 45000,
        startAge: 32, startup: 60000, rev: 320000, growth: 0.14, ceiling: 3000000,
        gross: 0.85, net: 0.30, ownerSalary: 120000, emp: 0, marketWage: 105000,
        multiple: 3.0, valMethod: 'sde', leadAge: 34, ownerAge: 38, investorAge: 45,
        qOwner: 4, qRecur: 9, qSpread: 8, qMgmt: 3, qAssets: 2, qGrowth: 6
      }),
      lifestyle: life({
        hours: 42, ot: 4, evening: 4, weekend: 2, onCall: 1, vac: 3, vacTake: 6, leaveWeeks: 3,
        sCust: 6, sEmp: 3, sLiab: 7, sEmerg: 2, sFin: 6, sReg: 8,
        phys: 9, mental: 5,
        fHours: 7, fDays: 6, fRemote: 7, fVac: 6, fMove: 6, fEmp: 7, fSelf: 8,
        kDemand: 7, kAuto: 5, kOut: 7, kRec: 5, kLic: 6, kShort: 5,
        pEve: 7, pWknd: 8, pPred: 7, pTravel: 8, pAttend: 7
      }),
      traits: traits({ bEase: 6, demand: 7, margins: 8, capital: 7, scale: 6, durable: 6, wealth: 7, ceiling: 8, schedule: 7, delegate: 5, recurring: 9 }),
      living: { expenses: 48000, creep: 0.3, conf: 'estimated' }
    },
    marketingmanager: {
      name: 'Marketing Manager', type: 'professional', conf: 'industry',
      note: 'Four-year degree, then the corporate ladder. The business is an agency, which sells hours and retainers.',
      education: {
        studentLivingCost: 20000, schoolWorkHours: 700, studyHoursPerYear: 1350,
        yearsEducation: 4, yearsApprenticeship: 0, yearsUnpaidSchool: 4, yearsPaidTraining: 0,
        tuitionPerYear: 7500, tuitionYears: 4, books: 2500, tools: 1500,
        certification: 1500, licensing: 1200, examFees: 1500, equipment: 1500, other: 3000,
        familyPaid: 6000, scholarships: 3000, grants: 2500, conf: 'industry'
      },
      debt: { rate: 0.065, termYears: 10, conf: 'industry' },
      stages: [
        stage(18, 'Undergrad, summer work', 9000, 0, 0, {}),
        stage(22, 'Marketing coordinator', 50000, 0, 2000, { benefits: 2500, pension: 2000 }),
        stage(25, 'Marketing specialist', 66000, 0, 4000, { benefits: 3000, pension: 3000 }),
        stage(29, 'Marketing manager', 92000, 0, 8000, { benefits: 3800, pension: 4500 }),
        stage(34, 'Senior manager / director', 120000, 0, 15000, { benefits: 4500, pension: 6000 })
      ],
      business: biz({
        support: 1,
        materials: 0.12, ownerCapacity: 220000, revPerTech: 200000, costPerTech: 85000, overheadPct: 0.14, fixedOverhead: 35000,
        startAge: 31, startup: 25000, rev: 260000, growth: 0.18, ceiling: 4000000,
        gross: 0.80, net: 0.22, ownerSalary: 100000, emp: 1, marketWage: 95000,
        multiple: 2.5, valMethod: 'sde', leadAge: 33, ownerAge: 37, investorAge: 44,
        qOwner: 4, qRecur: 6, qSpread: 5, qMgmt: 3, qAssets: 2, qGrowth: 7
      }),
      lifestyle: life({
        hours: 44, ot: 5, evening: 4, weekend: 2, onCall: 1, vac: 3, vacTake: 6, leaveWeeks: 3,
        sCust: 6, sEmp: 4, sLiab: 3, sEmerg: 2, sFin: 5, sReg: 2,
        phys: 9, mental: 4,
        fHours: 6, fDays: 5, fRemote: 8, fVac: 5, fMove: 7, fEmp: 8, fSelf: 7,
        kDemand: 6, kAuto: 4, kOut: 4, kRec: 3, kLic: 1, kShort: 3,
        pEve: 7, pWknd: 8, pPred: 7, pTravel: 7, pAttend: 7
      }),
      traits: traits({ bEase: 7, demand: 6, margins: 6, capital: 9, scale: 6, durable: 5, wealth: 5, ceiling: 7, schedule: 6, delegate: 6, recurring: 6 }),
      living: { expenses: 50000, creep: 0.3, conf: 'estimated' }
    },
    psychologist: {
      name: 'Psychologist', type: 'professional', conf: 'industry',
      note: 'Four-year degree, two-year master of arts, then supervised hours to register. Private practice is lucrative and entirely you.',
      education: {
        studentLivingCost: 21000, schoolWorkHours: 700, studyHoursPerYear: 1500,
        yearsEducation: 6, yearsApprenticeship: 0, yearsUnpaidSchool: 6, yearsPaidTraining: 0,
        tuitionPerYear: 8000, tuitionYears: 6, books: 3500, tools: 1500,
        certification: 1500, licensing: 1200, examFees: 1500, equipment: 1500, other: 5000,
        familyPaid: 8000, scholarships: 5000, grants: 4000, conf: 'industry'
      },
      debt: { rate: 0.065, termYears: 12, conf: 'industry' },
      stages: [
        stage(18, 'Undergrad, summer work', 9000, 0, 0, {}),
        stage(22, 'Graduate school, summer work', 8000, 0, 0, {}),
        stage(24, 'Provisional psychologist', 68000, 2000, 0, { benefits: 3000, pension: 3000 }),
        stage(26, 'Registered psychologist', 88000, 4000, 0, { benefits: 3500, pension: 5000 }),
        stage(31, 'Senior psychologist', 100000, 6000, 0, { benefits: 4000, pension: 6000 })
      ],
      business: biz({
        support: 1,
        materials: 0.03, ownerCapacity: 200000, revPerTech: 170000, costPerTech: 95000, overheadPct: 0.14, fixedOverhead: 30000,
        startAge: 29, startup: 20000, rev: 180000, growth: 0.15, ceiling: 2000000,
        gross: 0.88, net: 0.32, ownerSalary: 110000, emp: 0, marketWage: 100000,
        multiple: 2.0, valMethod: 'sde', leadAge: 32, ownerAge: 36, investorAge: 44,
        qOwner: 2, qRecur: 5, qSpread: 8, qMgmt: 2, qAssets: 1, qGrowth: 6
      }),
      lifestyle: life({
        hours: 38, ot: 2, evening: 4, weekend: 2, onCall: 2, vac: 4, vacTake: 7, leaveWeeks: 3,
        sCust: 6, sEmp: 2, sLiab: 6, sEmerg: 4, sFin: 4, sReg: 6,
        phys: 9, mental: 3,
        fHours: 8, fDays: 8, fRemote: 8, fVac: 6, fMove: 7, fEmp: 7, fSelf: 9,
        kDemand: 9, kAuto: 8, kOut: 9, kRec: 7, kLic: 9, kShort: 8,
        pEve: 7, pWknd: 8, pPred: 8, pTravel: 9, pAttend: 8
      }),
      traits: traits({ bEase: 8, demand: 9, margins: 8, capital: 9, scale: 4, durable: 8, wealth: 5, ceiling: 6, schedule: 8, delegate: 3, recurring: 5 }),
      living: { expenses: 48000, creep: 0.3, conf: 'estimated' }
    },
    hrmanager: {
      name: 'Human Resources Manager', type: 'professional', conf: 'industry',
      note: 'Four-year degree and the CPHR. A steady corporate ladder; the business is HR consulting, which sells your own hours.',
      education: {
        studentLivingCost: 20000, schoolWorkHours: 700, studyHoursPerYear: 1350,
        yearsEducation: 4, yearsApprenticeship: 0, yearsUnpaidSchool: 4, yearsPaidTraining: 0,
        tuitionPerYear: 7500, tuitionYears: 4, books: 2500, tools: 1500,
        certification: 1500, licensing: 1200, examFees: 1500, equipment: 1500, other: 3000,
        familyPaid: 6000, scholarships: 3000, grants: 2500, conf: 'industry'
      },
      debt: { rate: 0.065, termYears: 10, conf: 'industry' },
      stages: [
        stage(18, 'Undergrad, summer work', 9000, 0, 0, {}),
        stage(22, 'HR coordinator', 52000, 0, 2000, { benefits: 2500, pension: 2500 }),
        stage(25, 'HR generalist', 68000, 0, 4000, { benefits: 3000, pension: 3500 }),
        stage(29, 'HR manager', 95000, 0, 8000, { benefits: 4000, pension: 6000 }),
        stage(34, 'Senior HR manager / director', 120000, 0, 14000, { benefits: 4500, pension: 7500 })
      ],
      business: biz({
        support: 0,
        materials: 0.03, ownerCapacity: 200000, revPerTech: 190000, costPerTech: 100000, overheadPct: 0.12, fixedOverhead: 25000,
        startAge: 33, startup: 15000, rev: 200000, growth: 0.14, ceiling: 2000000,
        gross: 0.85, net: 0.30, ownerSalary: 110000, emp: 0, marketWage: 105000,
        multiple: 2.0, valMethod: 'sde', leadAge: 35, ownerAge: 39, investorAge: 46,
        qOwner: 3, qRecur: 5, qSpread: 5, qMgmt: 2, qAssets: 1, qGrowth: 5
      }),
      lifestyle: life({
        hours: 42, ot: 4, evening: 2, weekend: 1, onCall: 1, vac: 4, vacTake: 7, leaveWeeks: 3,
        sCust: 5, sEmp: 6, sLiab: 5, sEmerg: 3, sFin: 3, sReg: 6,
        phys: 9, mental: 5,
        fHours: 6, fDays: 5, fRemote: 8, fVac: 6, fMove: 7, fEmp: 8, fSelf: 6,
        kDemand: 7, kAuto: 5, kOut: 5, kRec: 5, kLic: 3, kShort: 4,
        pEve: 8, pWknd: 9, pPred: 8, pTravel: 8, pAttend: 8
      }),
      traits: traits({ bEase: 6, demand: 6, margins: 7, capital: 9, scale: 4, durable: 6, wealth: 4, ceiling: 7, schedule: 6, delegate: 4, recurring: 5 }),
      living: { expenses: 50000, creep: 0.3, conf: 'estimated' }
    },

    generic: {
      name: 'Custom career', type: 'professional', conf: 'user',
      note: 'A blank slate. Fill in what you actually know and mark the rest as estimated.',
      education: {
        studentLivingCost: 20000, schoolWorkHours: 700, studyHoursPerYear: 0,
        yearsEducation: 0, yearsApprenticeship: 0, yearsUnpaidSchool: 0, yearsPaidTraining: 0,
        tuitionPerYear: 0, tuitionYears: 0, books: 0, tools: 0,
        certification: 0, licensing: 0, examFees: 0, equipment: 0, other: 0,
        familyPaid: 0, scholarships: 0, grants: 0, conf: 'user'
      },
      debt: { rate: 0.065, termYears: 10, conf: 'user' },
      stages: [ stage(18, 'Starting out', 45000, 0, 0, {}), stage(25, 'Mid-career', 70000, 0, 0, {}) ],
      business: biz({
        support: 1,
        materials: 0.25, ownerCapacity: 200000, revPerTech: 280000, costPerTech: 100000, overheadPct: 0.13, fixedOverhead: 25000,
        enabled: false, startAge: 30, startup: 30000, rev: 200000, growth: 0.15, ceiling: 2000000,
        gross: 0.55, net: 0.20, ownerSalary: 90000, marketWage: 90000, multiple: 3.0,
        leadAge: 32, ownerAge: 35, investorAge: 42
      }),
      lifestyle: life({ hours: 40, ot: 0, vac: 3, vacTake: 6, phys: 6, mental: 5 }),
      traits: traits({ bEase: 5, demand: 5, margins: 5, capital: 5, scale: 5, durable: 5, wealth: 5, ceiling: 5 }),
      living: { expenses: 45000, creep: 0.25, conf: 'user' }
    }
  };

  /* Comparison pairs worth a video, offered as one-click setups. */
  var MATCHUPS = [
    { a: 'plumber',      b: 'dentist',          title: 'Plumber vs Dentist' },
    { a: 'electrician',  b: 'engineer',         title: 'Electrician vs Engineer' },
    { a: 'hvac',         b: 'accountant',       title: 'HVAC Tech vs Accountant' },
    { a: 'hdmechanic',   b: 'pharmacist',       title: 'Heavy-Duty Mechanic vs Pharmacist' },
    { a: 'welder',       b: 'lawyer',           title: 'Welder vs Lawyer' },
    { a: 'plumber',      b: 'softwareengineer', title: 'Plumber vs Software Engineer' },
    { a: 'hvac',         b: 'executive',        title: 'Trade Business Owner vs Corporate Executive' },
    { a: 'electrician',  b: 'teacher',          title: 'Electrician vs Teacher' },
    { a: 'trucker',      b: 'hdmechanic',       title: 'Owner-Operator vs Employee' },
    { a: 'plumber',      b: 'plumber',          title: 'Same trade: employee vs business owner', ownerSplit: true },
    { a: 'ductcleaner',  b: 'physician',        title: 'Duct Cleaner vs Family Doctor' },
    { a: 'carpenter',    b: 'architect',        title: 'Carpenter vs Architect' },
    { a: 'autotech',     b: 'veterinarian',     title: 'Auto Technician vs Veterinarian' },
    { a: 'lineworker',   b: 'financialplanner', title: 'Powerline Tech vs Financial Planner' },
    { a: 'roofer',       b: 'chiropractor',     title: 'Roofer vs Chiropractor' },
    { a: 'pipefitter',   b: 'optometrist',      title: 'Pipefitter vs Optometrist' },
    { a: 'landscaper',   b: 'psychologist',     title: 'Landscaper vs Psychologist' },
    { a: 'millwright',   b: 'marketingmanager', title: 'Millwright vs Marketing Manager' },
    { a: 'heavyequipment', b: 'hrmanager',      title: 'Heavy Equipment Operator vs HR Manager' },
    { a: 'painter',      b: 'physiotherapist',  title: 'Painter vs Physiotherapist' }
  ];

  var GLOBAL_DEFAULTS = {
    startAge: 18,
    years: 20,
    country: 'CA',
    region: 'AB',
    currency: 'CAD',
    inflation: 0.025,
    investReturn: 0.065,
    salaryGrowth: 0.025,
    safeWithdrawal: 0.04,
    scenario: 'realistic',
    taxMode: 'brackets',      /* brackets | flat */
    flatRate: 0.28,
    /* Home ownership is modelled but off by default, because it
       swamps everything else and is not really a career variable. */
    housing: {
      enabled: true, buyAge: 27, price: 480000, downPct: 0.10,
      mortgageRate: 0.052, mortgageYears: 25, appreciation: 0.03,
      annualCostPct: 0.014   /* taxes, insurance, upkeep as % of value */
    },
    investing: { mode: 'percent', percent: 0.6, fixedAmount: 12000, registeredShare: 0.5 }
  };

  var HORIZONS = [
    { label: '10 years', kind: 'years', value: 10 },
    { label: '20 years', kind: 'years', value: 20 },
    { label: '30 years', kind: 'years', value: 30 },
    { label: 'To age 40', kind: 'age', value: 40 },
    { label: 'To age 50', kind: 'age', value: 50 },
    { label: 'To age 55', kind: 'age', value: 55 },
    { label: 'To age 65', kind: 'age', value: 65 }
  ];

  var CONFIDENCE = {
    verified:  { label: 'Verified',        rank: 4, blurb: 'Backed by a document the operator can produce.' },
    industry:  { label: 'Industry average',rank: 3, blurb: 'A typical published range for this work. Verify locally.' },
    user:      { label: 'User supplied',   rank: 2, blurb: 'Typed in for this comparison.' },
    estimated: { label: 'Estimated',       rank: 1, blurb: 'Our reasoned estimate. Treat as a placeholder.' }
  };

  BCB.data = {
    TAX: TAX, SCENARIOS: SCENARIOS, CAREERS: CAREERS, MATCHUPS: MATCHUPS,
    CAREER_TYPES: CAREER_TYPES, GLOBAL_DEFAULTS: GLOBAL_DEFAULTS,
    HORIZONS: HORIZONS, CONFIDENCE: CONFIDENCE,
    stage: stage, life: life, traits: traits, biz: biz
  };

})(typeof window !== 'undefined' ? window : globalThis);
