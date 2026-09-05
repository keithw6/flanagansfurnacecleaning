/* =====================================================================
   Blue Collar Business - The 20-Year Test
   app.js : state, the generated input form, and every rendered view

   The form is generated from a field schema rather than written out in
   HTML. With this many inputs that is the only way to guarantee that
   everything the engine reads is actually editable - and that each one
   carries its confidence tag.
   ===================================================================== */
(function (global) {
  'use strict';

  var BCB = global.BCB;
  var D = BCB.data, E = BCB.engine, S = BCB.scoring, C = BCB.charts, N = BCB.narrative;
  var STORE_KEY = 'bcb-20-year-test-v1';

  /* ---------------- state ---------------- */
  var state = null;
  var last = {};                       /* the most recent sim/scores */
  var scenarioCache = null;

  function deep(o) { return JSON.parse(JSON.stringify(o)); }
  function get(obj, path) {
    var parts = path.split('.'), cur = obj;
    for (var i = 0; i < parts.length; i++) { if (cur == null) { return undefined; } cur = cur[parts[i]]; }
    return cur;
  }
  function set(obj, path, val) {
    var parts = path.split('.'), cur = obj;
    for (var i = 0; i < parts.length - 1; i++) {
      if (cur[parts[i]] == null) { cur[parts[i]] = {}; }
      cur = cur[parts[i]];
    }
    cur[parts[parts.length - 1]] = val;
  }

  function freshState(aKey, bKey, opts) {
    var g = deep(D.GLOBAL_DEFAULTS);
    g.careers = {
      a: deep(D.CAREERS[aKey || 'plumber']),
      b: deep(D.CAREERS[bKey || 'dentist']),
      aOpts: (opts && opts.aOpts) || null,
      bOpts: (opts && opts.bOpts) || null
    };
    return g;
  }

  /* ---------------- formatting ---------------- */
  function money(v) {
    if (v == null || !isFinite(v)) { return '-'; }
    var sign = v < 0 ? '-' : '';
    return sign + '$' + Math.abs(Math.round(v)).toLocaleString();
  }
  var short = C.fmtMoney;
  function pctTxt(v) { return (v * 100).toFixed(v * 100 % 1 === 0 ? 0 : 1) + '%'; }
  function num(v) { return Math.round(v).toLocaleString(); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
    return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]; }); }
  function confTag(key) {
    var c = D.CONFIDENCE[key] || D.CONFIDENCE.estimated;
    return '<span class="conf conf-' + key + '" title="' + esc(c.blurb) + '">' + esc(c.label) + '</span>';
  }
  function colA() { return getComputedStyle(document.documentElement).getPropertyValue('--series-a').trim(); }
  function colB() { return getComputedStyle(document.documentElement).getPropertyValue('--series-b').trim(); }

  /* =====================================================================
     FIELD SCHEMA
     ===================================================================== */
  var GLOBAL_FIELDS = [
    { path: 'startAge', label: 'Starting age (both)', type: 'int', min: 14, max: 60 },
    { path: 'years', label: 'Comparison period (years)', type: 'int', min: 3, max: 45,
      hint: 'The brief default is 20. Try 10 and 30 as well - the winner can change.' },
    { path: 'country', label: 'Country', type: 'select', options: 'countries' },
    { path: 'region', label: 'Province / state', type: 'select', options: 'regions' },
    { path: 'currency', label: 'Currency label', type: 'text' },
    { path: 'taxMode', label: 'Tax model', type: 'select',
      options: [{ v: 'brackets', l: 'Progressive brackets' }, { v: 'flat', l: 'Flat effective rate' }] },
    { path: 'flatRate', label: 'Flat rate (if used)', type: 'pct' },
    { path: 'inflation', label: 'Inflation', type: 'pct' },
    { path: 'investReturn', label: 'Investment return', type: 'pct',
      hint: 'Nominal, before tax. 6-7% is a common long-run assumption.' },
    { path: 'salaryGrowth', label: 'Wage drift above stages', type: 'pct',
      hint: 'General raises on top of the stage progression you set below.' },
    { path: 'safeWithdrawal', label: 'Safe withdrawal rate', type: 'pct',
      hint: 'Used for the financial-freedom age.' },
    { path: 'investing.mode', label: 'Investing rule', type: 'select',
      options: [{ v: 'percent', l: 'Share of spare cash' }, { v: 'fixed', l: 'Fixed amount per year' }] },
    { path: 'investing.percent', label: 'Share of spare cash invested', type: 'pct' },
    { path: 'investing.fixedAmount', label: 'Fixed annual investment', type: 'money' },
    { path: 'investing.registeredShare', label: 'Share into registered/tax-deferred', type: 'pct',
      hint: 'Deducted from taxable income, within the annual room.' },
    { path: 'housing.enabled', label: 'Model buying a home', type: 'check' },
    { path: 'housing.buyAge', label: 'Age of purchase', type: 'int', min: 18, max: 70 },
    { path: 'housing.price', label: 'Price (today’s dollars)', type: 'money' },
    { path: 'housing.downPct', label: 'Down payment', type: 'pct' },
    { path: 'housing.mortgageRate', label: 'Mortgage rate', type: 'pct' },
    { path: 'housing.mortgageYears', label: 'Amortisation (years)', type: 'int', min: 5, max: 40 },
    { path: 'housing.appreciation', label: 'Home appreciation', type: 'pct' },
    { path: 'housing.annualCostPct', label: 'Taxes, insurance, upkeep', type: 'pct',
      hint: 'Per year, as a share of the home’s value.' }
  ];

  var CAREER_GROUPS = [
    { group: 'Identity', open: true, fields: [
      { path: 'name', label: 'Career name', type: 'text' },
      { path: 'type', label: 'Career type', type: 'select', options: 'careerTypes' },
      { path: 'conf', label: 'Confidence in the income figures', type: 'select', options: 'conf' }
    ] },
    { group: 'Education and training', fields: [
      { path: 'education.yearsEducation', label: 'Years of education', type: 'years' },
      { path: 'education.yearsApprenticeship', label: 'Years of apprenticeship', type: 'years' },
      { path: 'education.yearsUnpaidSchool', label: 'Years of unpaid schooling', type: 'years',
        hint: 'The years with no real wage. This drives the head start.' },
      { path: 'education.yearsPaidTraining', label: 'Years of paid training', type: 'years' },
      { path: 'education.tuitionPerYear', label: 'Tuition per year', type: 'money' },
      { path: 'education.tuitionYears', label: 'Years of tuition', type: 'years' },
      { path: 'education.books', label: 'Books', type: 'money' },
      { path: 'education.tools', label: 'Tools', type: 'money' },
      { path: 'education.certification', label: 'Certification', type: 'money' },
      { path: 'education.licensing', label: 'Licensing', type: 'money' },
      { path: 'education.examFees', label: 'Exam fees', type: 'money' },
      { path: 'education.equipment', label: 'Required equipment', type: 'money' },
      { path: 'education.other', label: 'Other education costs', type: 'money' },
      { path: 'education.studentLivingCost', label: 'Cost of living while in school', type: 'money',
        hint: 'Per year. Borrowed if income does not cover it.' },
      { path: 'education.schoolWorkHours', label: 'Hours worked per school year', type: 'int', min: 0, max: 2500 },
      { path: 'education.studyHoursPerYear', label: 'Hours in class and studying per school year', type: 'int', min: 0, max: 4000,
        hint: 'Class, labs, clinic and study time in the unpaid school years. Counted as hours given to the career.' },
      { path: 'education.familyPaid', label: 'Paid by family', type: 'money' },
      { path: 'education.scholarships', label: 'Scholarships', type: 'money' },
      { path: 'education.grants', label: 'Grants', type: 'money' },
      { path: 'education.conf', label: 'Confidence', type: 'select', options: 'conf' }
    ] },
    { group: 'Education debt', fields: [
      { path: 'debt.rate', label: 'Interest rate', type: 'pct' },
      { path: 'debt.termYears', label: 'Repayment period (years)', type: 'int', min: 1, max: 30 },
      { path: 'debt.conf', label: 'Confidence', type: 'select', options: 'conf' }
    ] },
    { group: 'Living expenses', fields: [
      { path: 'living.expenses', label: 'Living expenses reference', type: 'money',
        hint: '60% of this is the floor; spending rises with income from there.' },
      { path: 'living.creep', label: 'Share of extra income spent', type: 'pct' },
      { path: 'living.conf', label: 'Confidence', type: 'select', options: 'conf' }
    ] },
    { group: 'Business ownership', fields: [
      { path: 'business.enabled', label: 'This person starts a business', type: 'check',
        hint: 'Untick to run the same career as an employee for the whole period.' },
      { path: 'business.startAge', label: 'Age the business starts', type: 'int', min: 16, max: 70 },
      { path: 'business.startupInvestment', label: 'Startup investment', type: 'money' },
      { path: 'business.startupLoanShare', label: 'Share of that borrowed', type: 'pct' },
      { path: 'business.startupLoanRate', label: 'Loan rate', type: 'pct' },
      { path: 'business.startupLoanYears', label: 'Loan term (years)', type: 'int', min: 1, max: 30 },
      { path: 'business.revenueY1', label: 'Revenue, year one', type: 'money' },
      { path: 'business.revenueGrowth', label: 'Annual revenue growth', type: 'pct' },
      { path: 'business.revenueCeiling', label: 'Revenue ceiling', type: 'money',
        hint: 'Today’s dollars; rises with inflation. 0 for no cap.' },
      { path: 'business.marginMode', label: 'How profit is worked out', type: 'select',
        options: [{ v: 'model', l: 'Build up from labour and overhead' }, { v: 'direct', l: 'Use my margins' }],
        hint: 'The build-up makes margin an output and owner dependency a measurement.' },
      { path: 'business.grossMargin', label: 'Gross margin (direct mode)', type: 'pct' },
      { path: 'business.operatingMargin', label: 'Net operating margin (direct mode)', type: 'pct',
        hint: 'After all costs, before the owner’s own pay. Same thing as SDE margin.' },
      { path: 'business.materialsPct', label: 'Materials and subcontractors', type: 'pct' },
      { path: 'business.ownerCapacity', label: 'Revenue the owner produces alone', type: 'money' },
      { path: 'business.revenuePerProducer', label: 'Revenue per producing employee', type: 'money' },
      { path: 'business.costPerProducer', label: 'Cost per producing employee', type: 'money',
        hint: 'Fully loaded - wage, burden, truck, phone.' },
      { path: 'business.supportStaffY1', label: 'Support staff, year one', type: 'years' },
      { path: 'business.overheadPct', label: 'Overhead', type: 'pct' },
      { path: 'business.marketingPct', label: 'Marketing', type: 'pct' },
      { path: 'business.fixedOverhead', label: 'Fixed overhead', type: 'money' },
      { path: 'business.managerSalary', label: 'Operations manager salary', type: 'money',
        hint: 'Hired when the owner actually hands the work over.' },
      { path: 'business.ownerSalary', label: 'Owner salary target', type: 'money' },
      { path: 'business.ownerSalaryGrowth', label: 'Owner salary growth', type: 'pct' },
      { path: 'business.distributionShare', label: 'Share of spare profit distributed', type: 'pct' },
      { path: 'business.capexPct', label: 'Capital expenditure', type: 'pct' },
      { path: 'business.workingCapitalPct', label: 'Working capital', type: 'pct' },
      { path: 'business.leadStage', label: 'Age they start leading a crew', type: 'int', min: 0, max: 70 },
      { path: 'business.ownerStage', label: 'Age employees do most production', type: 'int', min: 0, max: 70 },
      { path: 'business.investorStage', label: 'Age a manager runs it', type: 'int', min: 0, max: 70,
        hint: '0 if that never happens.' },
      { path: 'business.conf', label: 'Confidence', type: 'select', options: 'conf' }
    ] },
    { group: 'Business valuation', fields: [
      { path: 'business.valuationMethod', label: 'Valuation method', type: 'select',
        options: [{ v: 'sde', l: 'Multiple of SDE' }, { v: 'ebitda', l: 'Multiple of EBITDA' },
                  { v: 'profit', l: 'Multiple of profit after capex' }, { v: 'manual', l: 'I will enter a value' }] },
      { path: 'business.valuationMultiple', label: 'Base multiple', type: 'years' },
      { path: 'business.manualValuation', label: 'Value, if entered by hand', type: 'money' },
      { path: 'business.ownerMarketWage', label: 'Cost to replace the owner’s labour', type: 'money' },
      { path: 'business.quality.recurringRevenue', label: 'Recurring revenue', type: 'score' },
      { path: 'business.quality.customerSpread', label: 'Customer spread', type: 'score',
        hint: '10 = no customer matters much; 1 = one customer is everything.' },
      { path: 'business.quality.managementTeam', label: 'Management team', type: 'score' },
      { path: 'business.quality.assetBase', label: 'Equipment and assets', type: 'score' },
      { path: 'business.quality.growthRate', label: 'Growth rate', type: 'score' },
      { path: 'business.quality.ownerIndependence', label: 'Owner independence (if not modelled)', type: 'score' }
    ] },
    { group: 'Hours, vacation and stress', fields: [
      { path: 'lifestyle.hoursPerWeek', label: 'Hours per week', type: 'int', min: 0, max: 90 },
      { path: 'lifestyle.overtimeHours', label: 'Overtime hours per week', type: 'int', min: 0, max: 40 },
      { path: 'lifestyle.eveningWork', label: 'Evening work', type: 'score' },
      { path: 'lifestyle.weekendWork', label: 'Weekend work', type: 'score' },
      { path: 'lifestyle.onCall', label: 'On-call', type: 'score' },
      { path: 'lifestyle.vacationWeeks', label: 'Vacation weeks', type: 'years' },
      { path: 'lifestyle.vacationTakeable', label: 'Can actually take it', type: 'score' },
      { path: 'lifestyle.leaveBusinessWeeks', label: 'Longest absence the work survives (weeks)', type: 'years' },
      { path: 'lifestyle.stress.customer', label: 'Customer responsibility', type: 'score' },
      { path: 'lifestyle.stress.employee', label: 'Employee responsibility', type: 'score' },
      { path: 'lifestyle.stress.liability', label: 'Professional liability', type: 'score' },
      { path: 'lifestyle.stress.emergency', label: 'Emergency calls', type: 'score' },
      { path: 'lifestyle.stress.financial', label: 'Financial pressure', type: 'score' },
      { path: 'lifestyle.stress.regulatory', label: 'Regulatory pressure', type: 'score' }
    ] },
    { group: 'Demands, flexibility, security, family', fields: [
      { path: 'lifestyle.physical', label: 'Physical demands', type: 'score',
        hint: '1 = extremely demanding, 10 = minimal.' },
      { path: 'lifestyle.mental', label: 'Mental demands', type: 'score', hint: '1 = relentless, 10 = light.' },
      { path: 'lifestyle.flexibility.chooseHours', label: 'Choose your hours', type: 'score' },
      { path: 'lifestyle.flexibility.fewerDays', label: 'Work fewer days', type: 'score' },
      { path: 'lifestyle.flexibility.remote', label: 'Work remotely', type: 'score' },
      { path: 'lifestyle.flexibility.extendedVac', label: 'Take extended time off', type: 'score' },
      { path: 'lifestyle.flexibility.relocate', label: 'Move geographically', type: 'score' },
      { path: 'lifestyle.flexibility.changeEmployer', label: 'Change employers', type: 'score' },
      { path: 'lifestyle.flexibility.selfEmploy', label: 'Become self-employed', type: 'score' },
      { path: 'lifestyle.security.demand', label: 'Demand', type: 'score' },
      { path: 'lifestyle.security.automation', label: 'Safe from automation', type: 'score' },
      { path: 'lifestyle.security.outsourcing', label: 'Safe from outsourcing', type: 'score' },
      { path: 'lifestyle.security.recession', label: 'Recession resistance', type: 'score' },
      { path: 'lifestyle.security.licensing', label: 'Licensing barrier', type: 'score' },
      { path: 'lifestyle.security.shortage', label: 'Labour shortage', type: 'score' },
      { path: 'lifestyle.family.eveningsHome', label: 'Evenings at home', type: 'score' },
      { path: 'lifestyle.family.weekendsOff', label: 'Weekends off', type: 'score' },
      { path: 'lifestyle.family.predictable', label: 'Predictable schedule', type: 'score' },
      { path: 'lifestyle.family.lowTravel', label: 'Little travel', type: 'score' },
      { path: 'lifestyle.family.canAttend', label: 'Can attend family events', type: 'score' }
    ] },
    { group: 'Career judgement scores', fields: [
      { path: 'traits.businessEase', label: 'Realistic to start alone', type: 'score' },
      { path: 'traits.customerDemand', label: 'Customer demand', type: 'score' },
      { path: 'traits.margins', label: 'Margins', type: 'score' },
      { path: 'traits.startupCapital', label: 'Low startup capital needed', type: 'score' },
      { path: 'traits.scalability', label: 'Scalability', type: 'score',
        hint: 'Can employees produce revenue without the owner?' },
      { path: 'traits.durability', label: 'Career durability', type: 'score' },
      { path: 'traits.wealthBuilding', label: 'Wealth-building potential', type: 'score' },
      { path: 'traits.incomeCeiling', label: 'Employee income ceiling', type: 'score' },
      { path: 'traits.scheduleControl', label: 'Schedule control', type: 'score' },
      { path: 'traits.delegability', label: 'Work can be delegated', type: 'score' },
      { path: 'traits.recurringRevenue', label: 'Recurring revenue', type: 'score' }
    ] }
  ];

  /* =====================================================================
     FORM RENDERING
     ===================================================================== */
  function optionList(kind) {
    if (kind === 'countries') {
      return Object.keys(D.TAX).map(function (k) { return { v: k, l: D.TAX[k].label }; });
    }
    if (kind === 'regions') {
      var jur = D.TAX[state.country] || D.TAX.FLAT;
      return Object.keys(jur.regions).map(function (k) { return { v: k, l: jur.regions[k].label }; });
    }
    if (kind === 'careerTypes') { return D.CAREER_TYPES.map(function (t) { return { v: t.id, l: t.label }; }); }
    if (kind === 'conf') {
      return Object.keys(D.CONFIDENCE).map(function (k) { return { v: k, l: D.CONFIDENCE[k].label }; });
    }
    return [];
  }

  function fieldHtml(root, f) {
    var v = get(root === 'global' ? state : state.careers[root], f.path);
    var id = 'f-' + root + '-' + f.path.replace(/\./g, '-');
    var input;
    if (f.type === 'check') {
      input = '<div class="field-inline"><input type="checkbox" id="' + id + '" data-root="' + root +
        '" data-path="' + f.path + '" data-type="check"' + (v ? ' checked' : '') +
        '><label for="' + id + '" style="margin:0">' + esc(f.label) + '</label></div>';
      return '<div class="field">' + input + (f.hint ? '<div class="hint">' + esc(f.hint) + '</div>' : '') + '</div>';
    }
    if (f.type === 'select') {
      var opts = typeof f.options === 'string' ? optionList(f.options) : f.options;
      input = '<select id="' + id + '" data-root="' + root + '" data-path="' + f.path + '" data-type="select">' +
        opts.map(function (o) { return '<option value="' + esc(o.v) + '"' + (o.v === v ? ' selected' : '') + '>' + esc(o.l) + '</option>'; }).join('') +
        '</select>';
    } else if (f.type === 'pct') {
      input = '<input type="number" id="' + id + '" data-root="' + root + '" data-path="' + f.path +
        '" data-type="pct" step="0.1" value="' + (v == null ? '' : +(v * 100).toFixed(2)) + '">';
    } else if (f.type === 'text') {
      input = '<input type="text" id="' + id + '" data-root="' + root + '" data-path="' + f.path +
        '" data-type="text" value="' + esc(v) + '">';
    } else if (f.type === 'score') {
      input = '<input type="number" id="' + id + '" data-root="' + root + '" data-path="' + f.path +
        '" data-type="num" min="0" max="10" step="0.5" value="' + (v == null ? '' : v) + '">';
    } else if (f.type === 'years') {
      input = '<input type="number" id="' + id + '" data-root="' + root + '" data-path="' + f.path +
        '" data-type="num" step="0.1" value="' + (v == null ? '' : v) + '">';
    } else if (f.type === 'int') {
      input = '<input type="number" id="' + id + '" data-root="' + root + '" data-path="' + f.path +
        '" data-type="num" step="1"' + (f.min != null ? ' min="' + f.min + '"' : '') +
        (f.max != null ? ' max="' + f.max + '"' : '') + ' value="' + (v == null ? '' : v) + '">';
    } else {
      input = '<input type="number" id="' + id + '" data-root="' + root + '" data-path="' + f.path +
        '" data-type="num" step="100" value="' + (v == null ? '' : Math.round(v)) + '">';
    }
    var suffix = f.type === 'pct' ? ' (%)' : (f.type === 'score' ? ' (0-10)' : '');
    return '<div class="field"><label for="' + id + '">' + esc(f.label) + suffix + '</label>' + input +
      (f.hint ? '<div class="hint">' + esc(f.hint) + '</div>' : '') + '</div>';
  }

  var LOCATION_PATHS = { country: 1, region: 1, currency: 1 };
  function renderGlobalForm() {
    var loc = GLOBAL_FIELDS.filter(function (f) { return LOCATION_PATHS[f.path]; });
    var rest = GLOBAL_FIELDS.filter(function (f) { return !LOCATION_PATHS[f.path]; });
    var jur = D.TAX[state.country] || {};
    var regionCount = jur.regions ? Object.keys(jur.regions).length : 0;
    var notice = state.country === 'CA'
      ? ''
      : '<div class="callout warn" style="margin-top:12px"><strong>Presets are Alberta figures.</strong> ' +
        'Switching the country changes the tax brackets and the currency label, not the wages, tuition or ' +
        'business numbers in the career presets. Those are typical Canadian ranges - for a US comparison, ' +
        'type in local figures for anything that matters. Dental school and law school in particular ' +
        'cost far more in the US than the presets assume.</div>';
    document.getElementById('locationForm').innerHTML =
      '<div class="grid3">' + loc.map(function (f) { return fieldHtml('global', f); }).join('') + '</div>' +
      '<p class="hint" style="margin-top:6px;color:var(--muted)">' + esc(jur.label || state.country) + ' - ' +
      regionCount + ' ' + (state.country === 'CA' ? 'provinces and territories' : 'states and DC') +
      ', simplified brackets indexed to inflation. Not tax advice.</p>' + notice;
    document.getElementById('globalForm').innerHTML =
      rest.map(function (f) { return fieldHtml('global', f); }).join('');
  }

  /* The stage editor: income really does change by career stage, and it
     is the input that matters most, so it gets a real table. */
  function stageEditorHtml(root) {
    var stages = state.careers[root].stages;
    var head = ['Age', 'Stage', 'Base', 'Overtime', 'Bonus', 'Benefits', 'Pension', 'Vehicle', 'Other'];
    var rows = stages.map(function (s, i) {
      function cell(key, w) {
        return '<td><input type="' + (key === 'label' ? 'text' : 'number') + '" data-stage="' + root +
          '" data-i="' + i + '" data-key="' + key + '" value="' + esc(s[key] == null ? 0 : s[key]) +
          '" style="min-width:' + w + 'px"></td>';
      }
      return '<tr>' + cell('age', 46) + cell('label', 118) + cell('base', 74) + cell('overtime', 66) +
        cell('bonus', 62) + cell('benefits', 62) + cell('pension', 62) + cell('vehicle', 58) + cell('other', 58) +
        '<td><button class="del" data-delstage="' + root + '" data-i="' + i + '" title="Remove stage">×</button></td></tr>';
    }).join('');
    return '<div class="tscroll"><table class="stage-table"><thead><tr>' +
      head.map(function (h) { return '<th>' + h + '</th>'; }).join('') + '<th></th></tr></thead><tbody>' +
      rows + '</tbody></table></div>' +
      '<button class="btn btn-o btn-sm" data-addstage="' + root + '" style="margin-top:8px">Add a stage</button>' +
      '<div class="hint">Income applies from that age until the next stage begins. Once a business starts, ' +
      'the owner is paid by the business instead.</div>';
  }

  function renderCareerForm(root) {
    var c = state.careers[root];
    var html = '';
    if (c.note) { html += '<div class="callout">' + esc(c.note) + '</div>'; }
    html += '<div class="field"><label>Load a different preset</label><select data-preset="' + root + '">' +
      '<option value="">- choose a career -</option>' +
      Object.keys(D.CAREERS).map(function (k) {
        return '<option value="' + k + '">' + esc(D.CAREERS[k].name) + '</option>'; }).join('') +
      '</select></div>';
    CAREER_GROUPS.forEach(function (grp) {
      html += '<details class="fieldset"' + (grp.open ? ' open' : '') + '><summary>' + esc(grp.group) + '</summary>';
      html += '<div class="field-row">' + grp.fields.map(function (f) { return fieldHtml(root, f); }).join('') +
        '</div></details>';
    });
    html += '<details class="fieldset" open><summary>Income by career stage</summary>' + stageEditorHtml(root) + '</details>';
    document.getElementById(root === 'a' ? 'formA' : 'formB').innerHTML = html;
    document.getElementById(root === 'a' ? 'nameA' : 'nameB').textContent = c.name;
  }

  function renderMatchups() {
    document.getElementById('matchups').innerHTML = D.MATCHUPS.map(function (m, i) {
      return '<button class="cat" data-matchup="' + i + '" style="cursor:pointer;text-align:left;border:1px solid var(--line);font:inherit">' +
        '<span>' + esc(m.title) + '</span><span class="who">Load</span></button>';
    }).join('');
  }

  function renderScenarioTabs() {
    var keys = ['conservative', 'realistic', 'aggressive'];
    document.getElementById('scenTabs').innerHTML = keys.map(function (k) {
      return '<button data-scen="' + k + '" aria-pressed="' + (state.scenario === k) + '">' +
        esc(D.SCENARIOS[k].label) + '</button>';
    }).join('');
    document.getElementById('scenBlurb').textContent = D.SCENARIOS[state.scenario].blurb;
  }

  /* =====================================================================
     RESULTS
     ===================================================================== */
  function netWorthColumn(res, cls, cfg) {
    var t = res.totals;
    function line(label, v, neg) {
      return '<div class="nw-line"><span>' + esc(label) + '</span><span class="v' + (neg || v < 0 ? ' neg' : '') + '">' +
        (neg ? '-' : '') + money(Math.abs(v)) + '</span></div>';
    }
    var lastRow = res.rows[res.rows.length - 1];
    /* The column has to add up as printed. Home and business equity are
       already net of the mortgage and the business loan, so the only debt
       subtracted here is what is NOT inside an equity line. The rest is
       shown for information, under the equity it is netted against. */
    var personalDebt = lastRow.studentDebt + lastRow.consumerDebt;
    function sub(label, v) {
      return '<div class="nw-line nw-sub"><span>' + esc(label) + '</span><span class="v">' + money(v) + '</span></div>';
    }
    return '<div class="nw-col ' + cls + '">' +
      '<div class="nw-name">' + esc(res.name) + '</div>' +
      '<div class="nw-stage">Ends as: ' + esc(lastRow.stage) + '</div>' +
      line('Career earnings', t.careerEarnings) +
      line('Education, all in', t.educationTotalCost, true) +
      line('Tax paid', t.totalTax, true) +
      '<div style="height:8px"></div>' +
      line('Investments', t.investments) +
      line('Cash', t.cash) +
      line('Home equity', t.homeEquity) +
      (lastRow.mortgage > 0 ? sub('home value ' + money(lastRow.homeValue) + ', mortgage still owing', lastRow.mortgage) : '') +
      line('Business equity', t.businessEquity) +
      (lastRow.businessDebt > 0 ? sub('business value ' + money(lastRow.businessValue) + ', loan still owing', lastRow.businessDebt) : '') +
      line('Education and consumer debt', personalDebt, true) +
      '<div class="nw-total"><div class="lbl">Estimated net worth</div>' +
      '<div class="amt">' + money(t.netWorth) + '</div>' +
      '<div class="real">' + money(t.netWorthReal) + ' in today’s dollars</div>' +
      '<div class="real">Total debt carried: ' + money(t.debt) + '</div></div>' +
      '</div>';
  }

  function headStartHtml(sim) {
    var hs = sim.headStart;
    if (!hs.years) {
      return '<div class="card"><h2>The head start</h2><p class="sub">Both careers start earning at the same age, ' +
        'so neither gets one. This comparison is decided by what happens after that.</p></div>';
    }
    return '<div class="headstart">' +
      '<div class="hs-lbl">The ' + esc(hs.leader) + '’s ' + hs.years + '-year head start</div>' +
      '<div class="hs-big">' + money(hs.total) + '</div>' +
      '<p>What ' + esc(hs.leader) + ' banks between age ' + hs.fromAge + ' and ' + hs.toAge +
      ', while ' + esc(hs.laggard) + ' is still training.</p>' +
      '<div class="hs-parts">' +
      '<div><div class="k">Income earned</div><div class="v">' + money(hs.incomeEarned) + '</div></div>' +
      '<div><div class="k">Invested and banked</div><div class="v">' + money(hs.investmentsAccumulated) + '</div></div>' +
      '<div><div class="k">Education debt avoided</div><div class="v">' + money(hs.debtAvoided) + '</div></div>' +
      '<div><div class="k">Tuition avoided</div><div class="v">' + money(hs.educationSpendAvoided) + '</div></div>' +
      '<div><div class="k">Net worth gap at ' + hs.toAge + '</div><div class="v">' + money(hs.netWorthGap) + '</div></div>' +
      '</div>' +
      '<p style="margin-top:14px;font-size:.86rem;opacity:.8">' +
      (sim.crossoverNetWorth
        ? esc(sim.crossoverNetWorth.passer) + ' catches up and passes ' + esc(sim.crossoverNetWorth.passed) +
          ' at age ' + sim.crossoverNetWorth.age +
          (sim.crossoverNetWorthProjected ? ' - projected, past the end of this window.' : '.')
        : esc(hs.laggard) + ' does not close the gap by age ' + sim.projectToAge + ' on these assumptions.') +
      '</p></div>';
  }

  function tile(k, v, n, cls) {
    return '<div class="tile' + (cls ? ' ' + cls : '') + '"><div class="k">' + esc(k) + '</div>' +
      '<div class="v">' + v + '</div>' + (n ? '<div class="n">' + esc(n) + '</div>' : '') + '</div>';
  }

  function renderResults() {
    var sim = last.sim, sc = last.scores, cfg = state;
    var a = sim.a, b = sim.b;
    var winner = sc.netWorthWinner;
    var gap = Math.abs(a.totals.netWorth - b.totals.netWorth);
    var endAge = cfg.startAge + cfg.years;
    var h = '';

    h += '<div class="hero-result">' +
      '<div class="hero-verdict">' + cfg.years + '-year winner on net worth</div>' +
      '<div class="hero-name">' + esc(winner || 'Too close to call') + '</div>' +
      '<div class="hero-gap">' + (winner ? 'Ahead by <strong>' + money(gap) + '</strong> at age ' + endAge : 'The two finish level') +
      ' &middot; ' + esc(sim.scenario.label) + ' scenario &middot; data confidence ' +
      '<span class="conf conf-' + sc.confidenceA.level + '">' + sc.confidenceA.level + '</span> / ' +
      '<span class="conf conf-' + sc.confidenceB.level + '">' + sc.confidenceB.level + '</span></div></div>';

    h += headStartHtml(sim);

    h += '<div class="card"><h2>Wealth at year ' + cfg.years + '</h2>' +
      '<p class="sub">Age ' + endAge + '. Nominal dollars, with today’s-dollar equivalent underneath.</p>' +
      '<div class="nw-cols">' + netWorthColumn(a, 'a', cfg) + netWorthColumn(b, 'b', cfg) + '</div></div>';

    /* the metrics that make this more than a salary comparison */
    h += '<div class="card"><h2>The numbers that decide it</h2><div class="tiles">' +
      tile('Lifetime hours, school included', num(a.totals.hours), a.name + ' \u00b7 ' + num(a.totals.hoursSchool) + ' in school', 'a-tint') +
      tile('Lifetime hours, school included', num(b.totals.hours), b.name + ' \u00b7 ' + num(b.totals.hoursSchool) + ' in school', 'b-tint') +
      tile('Wealth per hour worked', money(a.totals.wealthPerHour), a.name, 'a-tint') +
      tile('Wealth per hour worked', money(b.totals.wealthPerHour), b.name, 'b-tint') +
      tile('Financial freedom', ageTxt(a.milestones.financialFreedomAgeWithSale),
        a.name + (a.milestones.freedomSaleProjected ? ' (projected)' : ''), 'a-tint') +
      tile('Financial freedom', ageTxt(b.milestones.financialFreedomAgeWithSale),
        b.name + (b.milestones.freedomSaleProjected ? ' (projected)' : ''), 'b-tint') +
      tile('Owner dependency', depTxt(sc.a.ownerDependency), a.name, 'a-tint') +
      tile('Owner dependency', depTxt(sc.b.ownerDependency), b.name, 'b-tint') +
      tile('Debt-free at', ageTxt(a.milestones.debtFreeAge, a.milestones.neverBorrowed), a.name, 'a-tint') +
      tile('Debt-free at', ageTxt(b.milestones.debtFreeAge, b.milestones.neverBorrowed), b.name, 'b-tint') +
      tile('Peak education debt', money(a.totals.peakStudentDebt), a.name, 'a-tint') +
      tile('Peak education debt', money(b.totals.peakStudentDebt), b.name, 'b-tint') +
      '</div>' +
      '<p class="chart-note" style="margin-top:12px">Financial freedom assumes the business is sold and the ' +
      'proceeds drawn at ' + pctTxt(cfg.safeWithdrawal) + '. Keeping it instead gives a later date, because only ' +
      'the profit that survives the owner stepping away is income you can count on.</p></div>';

    /* winner by category */
    h += '<div class="card"><h2>Winner by category</h2><p class="sub">One overall number hides the trade-offs. ' +
      'These do not.</p><div class="cats">' +
      sc.categories.map(function (c) {
        var cls = c.tie ? 'tie' : (c.winner === a.name ? 'a' : 'b');
        return '<div class="cat"><span>' + esc(c.label) + '</span><span class="who ' + cls + '">' +
          esc(c.winner) + '</span></div>';
      }).join('') + '</div></div>';

    /* scenario matrix */
    h += '<div class="card"><h2>All three scenarios</h2>' +
      '<p class="sub">Same inputs, three sets of assumptions. Quote the realistic one; keep the conservative one ' +
      'in your pocket.</p><div class="tscroll"><table class="data"><thead><tr><th>Scenario</th>' +
      '<th>' + esc(a.name) + '</th><th>' + esc(b.name) + '</th><th>Gap</th><th>Ahead</th></tr></thead><tbody>' +
      ['conservative', 'realistic', 'aggressive'].map(function (k) {
        var r = scenarioCache[k];
        var g = r.a.totals.netWorth - r.b.totals.netWorth;
        return '<tr><td>' + esc(D.SCENARIOS[k].label) + (k === state.scenario ? ' &middot; shown' : '') + '</td>' +
          '<td class="a-val">' + money(r.a.totals.netWorth) + '</td>' +
          '<td class="b-val">' + money(r.b.totals.netWorth) + '</td>' +
          '<td>' + money(Math.abs(g)) + '</td>' +
          '<td>' + esc(g >= 0 ? r.a.name : r.b.name) + '</td></tr>';
      }).join('') + '</tbody></table></div></div>';

    /* employee vs owner */
    h += '<div class="card"><h2>Employee or owner</h2>' +
      '<p class="sub">The same career, run both ways. This is usually the biggest single swing in the whole model.</p>' +
      '<div class="grid2" id="evoBody"></div></div>';

    /* year by year */
    h += '<div class="card"><h2>Year by year</h2><p class="sub">Every row the model produced.</p>' +
      yearTable(sim) + '</div>';

    /* confidence */
    h += '<div class="card"><h2>Data confidence</h2>' +
      '<p class="sub">A comparison is only as good as its weakest important input.</p><div class="grid2">' +
      [['a', sc.confidenceA], ['b', sc.confidenceB]].map(function (pair) {
        var res = sim[pair[0]], conf = pair[1];
        return '<div><div class="career-head"><i class="swatch sw-' + pair[0] + '"></i><h3>' + esc(res.name) +
          '</h3><span class="conf conf-' + conf.level + '">' + conf.level + '</span></div>' +
          conf.tags.map(function (t) {
            return '<div class="nw-line"><span>' + esc(t.area) + '</span><span>' + confTag(t.conf) + '</span></div>';
          }).join('') + '<p class="chart-note" style="margin-top:8px">' + esc(conf.note) + '</p></div>';
      }).join('') + '</div>' +
      '<div class="callout warn" style="margin-top:14px"><strong>Sources.</strong> The presets are typical ' +
      'published ranges for each trade and profession, not figures from a single cited study, and they are ' +
      'labelled that way on purpose. Tax brackets are simplified and indexed to inflation. Replace anything ' +
      'that matters with a local number you can defend, and mark it Verified when you have the document.</div></div>';

    document.getElementById('resultsBody').innerHTML = h;
    renderEmployeeVsOwner();
  }

  function ageTxt(v, never) {
    if (never) { return 'Never borrows'; }
    return v == null ? 'Not reached' : String(v);
  }
  function depTxt(dep) { return dep.applicable ? dep.score + '/10' : 'No business'; }

  function yearTable(sim) {
    var rows = sim.a.rows.map(function (ra, i) {
      var rb = sim.b.rows[i];
      return '<tr><td>' + ra.age + '</td>' +
        '<td>' + esc(ra.stage) + '</td><td class="a-val">' + money(ra.personalIncome) + '</td>' +
        '<td class="a-val">' + money(ra.netWorth) + '</td>' +
        '<td>' + esc(rb.stage) + '</td><td class="b-val">' + money(rb.personalIncome) + '</td>' +
        '<td class="b-val">' + money(rb.netWorth) + '</td></tr>';
    }).join('');
    return '<div class="tscroll"><table class="data"><thead><tr><th>Age</th>' +
      '<th>' + esc(sim.a.name) + ' stage</th><th>Income</th><th>Net worth</th>' +
      '<th>' + esc(sim.b.name) + ' stage</th><th>Income</th><th>Net worth</th>' +
      '</tr></thead><tbody>' + rows + '</tbody></table></div>';
  }

  function renderEmployeeVsOwner() {
    var host = document.getElementById('evoBody');
    if (!host) { return; }
    var html = ['a', 'b'].map(function (which) {
      var evo = E.employeeVsOwner(state, which);
      var eNW = evo.employee.totals.netWorth, oNW = evo.owner.totals.netWorth;
      var diff = oNW - eNW;
      return '<div><div class="career-head"><i class="swatch sw-' + which + '"></i><h3>' + esc(evo.career) + '</h3></div>' +
        '<div class="nw-line"><span>Employee for the whole period</span><span class="v">' + money(eNW) + '</span></div>' +
        '<div class="nw-line"><span>Starts a business at ' +
        (state.careers[which].business ? state.careers[which].business.startAge : '-') + '</span><span class="v">' +
        money(oNW) + '</span></div>' +
        '<div class="nw-total"><div class="lbl">Ownership is worth</div><div class="amt">' +
        (diff >= 0 ? '+' : '-') + money(Math.abs(diff)) + '</div>' +
        '<div class="real">' + (diff >= 0
          ? 'over staying employed, if the business works as modelled'
          : 'less than staying employed on these inputs - worth knowing before you quit') + '</div></div></div>';
    }).join('');
    host.innerHTML = html;
  }

  /* =====================================================================
     CHARTS
     ===================================================================== */
  function chartCard(title, note, node, tableFn, legendItems) {
    var card = document.createElement('div');
    card.className = 'chart-card';
    var head = document.createElement('div');
    head.className = 'chart-head';
    head.innerHTML = '<h3>' + esc(title) + '</h3>';
    card.appendChild(head);
    if (note) {
      var n = document.createElement('p'); n.className = 'chart-note'; n.textContent = note; card.appendChild(n);
    }
    var leg = document.createElement('div');
    leg.className = 'legend';
    var items = legendItems || [
      { color: colA(), label: last.sim.a.name },
      { color: colB(), label: last.sim.b.name }
    ];
    leg.innerHTML = items.map(function (it) {
      return '<span><i style="background:' + it.color + '"></i>' + esc(it.label) + '</span>';
    }).join('');
    card.appendChild(leg);
    card.appendChild(node);
    if (tableFn) {
      var btn = document.createElement('button');
      btn.className = 'table-toggle no-print';
      btn.textContent = 'Show the numbers';
      var wrap = document.createElement('div');
      wrap.style.display = 'none';
      wrap.innerHTML = tableFn();
      btn.addEventListener('click', function () {
        var on = wrap.style.display === 'none';
        wrap.style.display = on ? '' : 'none';
        btn.textContent = on ? 'Hide the numbers' : 'Show the numbers';
      });
      card.appendChild(btn); card.appendChild(wrap);
    }
    return card;
  }

  /* Balances are measured at the END of each year, flows during it. Plotting
     both against the same age made every balance chart finish at 37 while
     the headline said 38 - the same number, labelled two different ways. */
  var STOCKS = { netWorth: 1, investments: 1, totalDebt: 1, businessEquity: 1, cumEarnings: 1 };
  function series(key) {
    var sim = last.sim;
    var shift = STOCKS[key] ? 1 : 0;
    function pts(res) {
      return res.rows.map(function (r) { return { x: r.age + shift, y: r[key] }; });
    }
    return [
      { name: sim.a.name, color: colA(), points: pts(sim.a) },
      { name: sim.b.name, color: colB(), points: pts(sim.b) }
    ];
  }
  function seriesTable(key, label) {
    var sim = last.sim;
    return '<div class="tscroll"><table class="data"><thead><tr><th>Age</th><th>' + esc(sim.a.name) +
      '</th><th>' + esc(sim.b.name) + '</th><th>Gap</th></tr></thead><tbody>' +
      sim.a.rows.map(function (ra, i) {
        var rb = sim.b.rows[i];
        return '<tr><td>' + ra.age + '</td><td class="a-val">' + money(ra[key]) + '</td>' +
          '<td class="b-val">' + money(rb[key]) + '</td><td>' + money(ra[key] - rb[key]) + '</td></tr>';
      }).join('') + '</tbody></table></div>';
  }

  function markers() {
    var sim = last.sim, m = [];
    if (sim.a.milestones.businessStartAge) { m.push({ x: sim.a.milestones.businessStartAge, label: sim.a.name + ' starts business' }); }
    if (sim.b.milestones.businessStartAge) { m.push({ x: sim.b.milestones.businessStartAge, label: sim.b.name + ' starts business' }); }
    if (sim.crossoverNetWorth && !sim.crossoverNetWorthProjected) {
      m.push({ x: sim.crossoverNetWorth.age, label: 'crossover' });
    }
    return m;
  }

  function renderCharts() {
    var host = document.getElementById('chartsBody');
    host.innerHTML = '';
    var sim = last.sim, sc = last.scores;

    host.appendChild(chartCard('Net worth', 'Everything owned less everything owed, year by year.',
      C.lineChart({ series: series('netWorth'), markers: markers(), title: 'Net worth over time', xTitle: 'Age' }),
      function () { return seriesTable('netWorth'); }));

    host.appendChild(chartCard('Investment and bank balance',
      'Cash and investments only - no house, no business. The crossover here is usually earlier than the net-worth one.',
      C.lineChart({ series: series('investments'), markers: markers(), title: 'Investments over time', xTitle: 'Age' }),
      function () { return seriesTable('investments'); }));

    host.appendChild(chartCard('Cumulative earnings', 'Gross pay, before tax and before anything is kept.',
      C.lineChart({ series: series('cumEarnings'), markers: markers(), title: 'Cumulative earnings', xTitle: 'Age', area: true }),
      function () { return seriesTable('cumEarnings'); }));

    host.appendChild(chartCard('Annual income', 'Wages, owner salary and distributions in each single year.',
      C.lineChart({ series: series('personalIncome'), markers: markers(), title: 'Annual income', xTitle: 'Age' }),
      function () { return seriesTable('personalIncome'); }));

    host.appendChild(chartCard('Debt outstanding', 'Education debt, mortgage, business debt and consumer debt together.',
      C.lineChart({ series: series('totalDebt'), markers: markers(), title: 'Total debt', xTitle: 'Age' }),
      function () { return seriesTable('totalDebt'); }));

    host.appendChild(chartCard('Hours worked each year',
      'Time on the clock, including overtime, less vacation. School years count only summer and part-time work.',
      C.lineChart({ series: series('hours'), format: C.fmtNum, markers: markers(), title: 'Hours worked', xTitle: 'Age' }),
      function () {
        return '<div class="tscroll"><table class="data"><thead><tr><th>Age</th><th>' + esc(sim.a.name) +
          '</th><th>' + esc(sim.b.name) + '</th></tr></thead><tbody>' +
          sim.a.rows.map(function (ra, i) {
            return '<tr><td>' + ra.age + '</td><td class="a-val">' + num(ra.hours) + '</td><td class="b-val">' +
              num(sim.b.rows[i].hours) + '</td></tr>'; }).join('') + '</tbody></table></div>';
      }));

    if (sim.a.totals.businessValue > 0 || sim.b.totals.businessValue > 0) {
      host.appendChild(chartCard('Business equity', 'Estimated sale value less business debt.',
        C.lineChart({ series: series('businessEquity'), markers: markers(), title: 'Business equity', xTitle: 'Age' }),
        function () { return seriesTable('businessEquity'); }));
    }

    /* what the final number is made of */
    /* Parts of one total, so this uses the ordinal ramp rather than the
       series hues - blue means "Career A" everywhere else on this page and
       must not quietly start meaning "investments" here. The row label
       carries identity instead. */
    var cs = getComputedStyle(document.documentElement);
    var STACK = [1, 2, 3, 4].map(function (i) {
      return { fill: cs.getPropertyValue('--stack-' + i).trim(), ink: cs.getPropertyValue('--stack-ink-' + i).trim() };
    });
    var PART_LABELS = ['Investments', 'Cash', 'Home equity', 'Business equity'];
    var mkParts = function (res) {
      var t = res.totals;
      var vals = [t.investments, t.cash, t.homeEquity, Math.max(0, t.businessEquity)];
      return PART_LABELS.map(function (label, i) {
        return { label: label, value: vals[i], color: STACK[i].fill, ink: STACK[i].ink };
      });
    };
    host.appendChild(chartCard('What the net worth is made of',
      'Parts of each person’s total. Debt is already netted off inside home and business equity.',
      C.stackChart({
        columns: [{ name: sim.a.name, parts: mkParts(sim.a) }, { name: sim.b.name, parts: mkParts(sim.b) }],
        totals: [sim.a.totals.netWorth, sim.b.totals.netWorth]
      }), function () {
        return '<div class="tscroll"><table class="data"><thead><tr><th>Component</th><th>' + esc(sim.a.name) +
          '</th><th>' + esc(sim.b.name) + '</th></tr></thead><tbody>' +
          PART_LABELS.map(function (label, i) {
            return '<tr><td>' + esc(label) + '</td><td class="a-val">' + money(mkParts(sim.a)[i].value) +
              '</td><td class="b-val">' + money(mkParts(sim.b)[i].value) + '</td></tr>';
          }).join('') + '</tbody></table></div>';
      },
      PART_LABELS.map(function (label, i) { return { color: STACK[i].fill, label: label }; })));

    /* lifestyle radar */
    var axes = sc.a.lifestyle.rows.map(function (r, i) {
      return { label: r.label.replace(' / personal', ''), a: r.value, b: sc.b.lifestyle.rows[i].value };
    });
    host.appendChild(chartCard('Lifestyle, component by component',
      'Each axis is 0-10 and further out is better, including physical demands where 10 means minimal.',
      C.radarChart({ axes: axes, colorA: colA(), colorB: colB(), title: 'Lifestyle comparison' }),
      function () {
        return '<div class="tscroll"><table class="data"><thead><tr><th>Component</th><th>Weight</th><th>' +
          esc(sim.a.name) + '</th><th>' + esc(sim.b.name) + '</th></tr></thead><tbody>' +
          sc.a.lifestyle.rows.map(function (r, i) {
            return '<tr><td>' + esc(r.label) + '</td><td>' + r.weight + '</td><td class="a-val">' + r.value +
              '</td><td class="b-val">' + sc.b.lifestyle.rows[i].value + '</td></tr>'; }).join('') +
          '</tbody></table></div>';
      }));

    /* BCB score bars */
    host.appendChild(chartCard('Blue Collar Business score, by component',
      'The weights are the ones in the brief. Only the financial component is scored relative to the other career.',
      C.scoreBars({
        rows: sc.a.rows.map(function (r, i) {
          return { label: r.label + ' (' + r.weight + ')', a: r.value, b: sc.b.rows[i].value, max: 10 };
        }), colorA: colA(), colorB: colB()
      })));

    /* headline comparisons as bars */
    host.appendChild(chartCard('The headline totals', 'Twenty-year totals side by side.',
      C.barChart({
        categories: [
          { label: 'Earnings', a: sim.a.totals.careerEarnings, b: sim.b.totals.careerEarnings },
          { label: 'Tax', a: sim.a.totals.totalTax, b: sim.b.totals.totalTax },
          { label: 'Education', a: sim.a.totals.educationTotalCost, b: sim.b.totals.educationTotalCost },
          { label: 'Investments', a: sim.a.totals.investments, b: sim.b.totals.investments },
          { label: 'Business equity', a: sim.a.totals.businessEquity, b: sim.b.totals.businessEquity },
          { label: 'Net worth', a: sim.a.totals.netWorth, b: sim.b.totals.netWorth }
        ], colorA: colA(), colorB: colB(), height: 320
      })));
  }

  /* =====================================================================
     SCORES
     ===================================================================== */
  function scoreBreakdown(res, s, cls) {
    return '<div class="big-score ' + cls + '">' +
      '<div class="who">' + esc(res.name) + '</div>' +
      '<div class="n">' + s.score + '</div><div class="of">Blue Collar Business score / 100</div>' +
      '<div class="four-scores">' +
      '<div><div class="k">Career</div><div class="v">' + s.four.career.score + '</div></div>' +
      '<div><div class="k">Owner-operator</div><div class="v">' + s.four.ownerOperator.score + '</div></div>' +
      '<div><div class="k">Business owner</div><div class="v">' + s.four.businessOwner.score + '</div></div>' +
      '<div><div class="k">Investor</div><div class="v">' + s.four.investor.score + '</div></div>' +
      '<div><div class="k">Overall / 10</div><div class="v">' + s.four.overall + '</div></div>' +
      '</div></div>';
  }

  function componentTable(rowsA, rowsB, nameA, nameB, max) {
    return '<div class="tscroll"><table class="data"><thead><tr><th>Component</th><th>Weight</th><th>' +
      esc(nameA) + '</th><th>' + esc(nameB) + '</th></tr></thead><tbody>' +
      rowsA.map(function (r, i) {
        return '<tr><td>' + esc(r.label) + (r.why ? ' <span style="color:var(--faint)">' + esc(r.why) + '</span>' : '') +
          '</td><td>' + r.weight + '</td><td class="a-val">' + r.value + '</td>' +
          '<td class="b-val">' + rowsB[i].value + '</td></tr>';
      }).join('') + '</tbody></table></div>';
  }

  function renderScores() {
    var sim = last.sim, sc = last.scores;
    var h = '';
    h += '<div class="card"><h2>The overall score</h2>' +
      '<p class="sub">Weighted exactly as the brief specifies: financial outcome 25, business opportunity 15, ' +
      'lifestyle 15, entry 10, career income 10, scalability 10, wealth-building 10, durability 5.</p>' +
      '<div class="score-pair">' + scoreBreakdown(sim.a, sc.a, 'a') + scoreBreakdown(sim.b, sc.b, 'b') + '</div></div>';

    h += '<div class="card"><h2>Where those points came from</h2>' +
      componentTable(sc.a.rows, sc.b.rows, sim.a.name, sim.b.name) + '</div>';

    h += '<div class="card"><h2>Time freedom</h2>' +
      '<p class="sub">How much control over their own time each one actually ends up with.</p>' +
      '<div class="tiles">' +
      tile('Time freedom', sc.a.timeFreedom.score + '/10', sim.a.name, 'a-tint') +
      tile('Time freedom', sc.b.timeFreedom.score + '/10', sim.b.name, 'b-tint') +
      '</div><div style="margin-top:12px">' +
      componentTable(sc.a.timeFreedom.rows, sc.b.timeFreedom.rows, sim.a.name, sim.b.name) + '</div></div>';

    h += '<div class="card"><h2>Owner dependency</h2>' +
      '<p class="sub">10 means the company keeps producing when the owner stops. 1 means it stops with them. ' +
      'This is computed from what the business actually needs the owner to do, not asserted.</p>' +
      '<div class="grid2">' +
      [['a', sc.a.ownerDependency, sim.a], ['b', sc.b.ownerDependency, sim.b]].map(function (p) {
        var dep = p[1];
        return '<div><div class="career-head"><i class="swatch sw-' + p[0] + '"></i><h3>' + esc(p[2].name) + '</h3></div>' +
          '<div class="nw-total" style="margin:0;border:0;padding:0"><div class="amt">' +
          (dep.applicable ? dep.score + '/10' : 'n/a') + '</div></div>' +
          '<p class="chart-note" style="margin-top:6px">' + esc(dep.note) + '</p></div>';
      }).join('') + '</div></div>';

    h += '<div class="card"><h2>Lifestyle</h2><div class="tiles">' +
      tile('Lifestyle score', sc.a.lifestyle.score + '/100', sim.a.name + ' · ' + sc.a.lifestyle.weeklyHours + ' hrs/wk', 'a-tint') +
      tile('Lifestyle score', sc.b.lifestyle.score + '/100', sim.b.name + ' · ' + sc.b.lifestyle.weeklyHours + ' hrs/wk', 'b-tint') +
      '</div><div style="margin-top:12px">' +
      componentTable(sc.a.lifestyle.rows, sc.b.lifestyle.rows, sim.a.name, sim.b.name) + '</div></div>';

    h += '<div class="card"><h2>The four ownership scores in detail</h2>' +
      [['career', 'Career - as an employee'], ['ownerOperator', 'Owner-operator - owning the job'],
       ['businessOwner', 'Business owner - employees produce'], ['investor', 'Investor - owning the asset']]
      .map(function (pair) {
        return '<h4 style="margin-top:14px">' + esc(pair[1]) + ' &middot; ' +
          sc.a.four[pair[0]].score + ' vs ' + sc.b.four[pair[0]].score + '</h4>' +
          componentTable(sc.a.four[pair[0]].rows, sc.b.four[pair[0]].rows, sim.a.name, sim.b.name);
      }).join('') + '</div>';

    document.getElementById('scoresBody').innerHTML = h;
  }

  /* =====================================================================
     ANALYSIS + YOUTUBE
     ===================================================================== */
  function renderAnalysis() {
    var sim = last.sim, sc = last.scores;
    var h = '<div class="card prose"><h2>The written analysis</h2>' +
      '<p class="sub">Generated from this run. It explains the difference rather than reading the numbers back.</p>';
    h += '<div class="callout"><strong>In short.</strong> ' +
      N.executiveSummary(sim, sc).map(esc).join(' ') + '</div>';
    last.analysis.forEach(function (sec) {
      h += '<h3>' + esc(sec.heading) + '</h3>' +
        sec.paragraphs.map(function (p) { return '<p>' + esc(p) + '</p>'; }).join('');
    });
    h += '</div>';
    document.getElementById('analysisBody').innerHTML = h;
  }

  function renderYouTube() {
    var y = last.youtube;
    var h = '<div class="card prose"><h2>Episode pack</h2>' +
      '<p class="sub">Written from this comparison. Edit freely - it is a starting point, not a script.</p>' +
      '<p class="no-print"><button class="btn btn-o btn-sm" data-reshuffle="1">Reshuffle the wording</button>' +
      '<span class="hint" style="margin-left:10px;color:var(--muted)">Same facts, different sentences. ' +
      'Hit it until it sounds like you.</span></p>';
    h += '<div class="copybox"><h4>Title options</h4><ul>' +
      y.titles.map(function (t) { return '<li>' + esc(t) + '</li>'; }).join('') + '</ul></div>';
    h += '<div class="copybox"><h4>Thumbnail text</h4>' +
      y.thumbnails.map(function (t) { return '<div class="thumb">' + esc(t) + '</div>'; }).join('') + '</div>';
    h += '<div class="copybox"><h4>Opening hook (15-30 seconds)</h4><p>' + esc(y.hook) + '</p></div>';
    h += '<div class="copybox"><h4>Key results</h4><ul>' +
      y.findings.map(function (f) { return '<li>' + esc(f) + '</li>'; }).join('') + '</ul></div>';
    h += '<div class="copybox"><h4>Closing verdict (30-60 seconds)</h4><p>' + esc(y.verdict) + '</p></div>';
    h += '</div>';
    document.getElementById('youtubeBody').innerHTML = h;
  }

  /* =====================================================================
     THE PRINTABLE REPORT - the 25 sections from the brief
     ===================================================================== */
  function renderReport() {
    var sim = last.sim, sc = last.scores, cfg = state;
    var a = sim.a, b = sim.b;
    var host = document.getElementById('reportBody');
    host.innerHTML = '';

    function page(html) {
      var d = document.createElement('div');
      d.className = 'report-page card';
      d.innerHTML = html;
      host.appendChild(d);
      return d;
    }
    function sect(n, title, html) {
      return '<h2>' + n + '. ' + esc(title) + '</h2>' + html;
    }
    function twoCol(fn) {
      return '<div class="grid2"><div><h4>' + esc(a.name) + '</h4>' + fn(a, sc.a) + '</div>' +
             '<div><h4>' + esc(b.name) + '</h4>' + fn(b, sc.b) + '</div></div>';
    }
    function kv(label, v) { return '<div class="nw-line"><span>' + esc(label) + '</span><span class="v">' + v + '</span></div>'; }

    /* 1. cover */
    page('<div class="report-cover"><div class="hero-verdict">Blue Collar Business</div>' +
      '<h1 style="font-size:2.6rem;margin:6px 0 4px">The ' + cfg.years + '-Year Test</h1>' +
      '<div class="hero-name" style="font-size:2rem">' + esc(a.name) + ' vs ' + esc(b.name) + '</div>' +
      '<p class="hero-gap">Who really comes out ahead after ' + cfg.years + ' years?</p>' +
      '<p style="margin-top:22px;color:var(--muted)">Age ' + cfg.startAge + ' to ' + (cfg.startAge + cfg.years) +
      ' &middot; ' + esc(sim.scenario.label) + ' assumptions &middot; ' + esc(cfg.currency) + ' &middot; ' +
      esc((D.TAX[cfg.country] || {}).label || cfg.country) + '</p>' +
      '<p style="margin-top:18px;font-size:.85rem;color:var(--faint);max-width:70ch">A model, not a measurement. ' +
      'Every figure is the arithmetic consequence of the assumptions listed in section 25. Not financial, tax, ' +
      'career or investment advice.</p>' +
      '<p style="margin-top:auto;padding-top:24px;font-family:var(--h);text-transform:uppercase;letter-spacing:.1em;font-size:.8rem">' +
      'Learn the trade. Build the business. Own the asset.</p></div>');

    /* 2. executive summary */
    page(sect(2, 'Executive summary',
      '<ul class="prose">' + N.executiveSummary(sim, sc).map(function (l) { return '<li>' + esc(l) + '</li>'; }).join('') + '</ul>' +
      '<div class="nw-cols" style="margin-top:14px">' + netWorthColumn(a, 'a', cfg) + netWorthColumn(b, 'b', cfg) + '</div>'));

    /* 3. career overview */
    page(sect(3, 'Career overview', twoCol(function (res, s) {
      return kv('Career type', esc((D.CAREER_TYPES.filter(function (t) { return t.id === res.type; })[0] || {}).label || res.type)) +
        kv('First real wage at', res.professionalStartAge) +
        kv('Ends the period as', esc(res.rows[res.rows.length - 1].stage)) +
        kv('Builds a business', res.isOwner ? 'Yes, from age ' + res.milestones.businessStartAge : 'No') +
        kv('Blue Collar Business score', s.score + '/100') +
        (res.note ? '<p class="chart-note" style="margin-top:8px">' + esc(res.note) + '</p>' : '');
    })));

    /* 4. education and training */
    page(sect(4, 'Education and training', twoCol(function (res) {
      var e = res.career.education, t = res.totals;
      return kv('Years of education', e.yearsEducation) +
        kv('Years of apprenticeship', e.yearsApprenticeship) +
        kv('Years of unpaid schooling', e.yearsUnpaidSchool) +
        kv('Years of paid training', e.yearsPaidTraining) +
        kv('Tuition, total', money(e.tuitionPerYear * e.tuitionYears)) +
        kv('Tools, books, equipment', money(e.tools + e.books + e.equipment)) +
        kv('Certification, licensing, exams', money(e.certification + e.licensing + e.examFees)) +
        kv('Gross cost', money(t.educationGross)) +
        kv('Family, scholarships, grants', '-' + money(t.educationOffsets)) +
        kv('Net cost paid', money(t.educationNet));
    }) + '<div class="callout" style="margin-top:12px"><strong>Lost earnings.</strong> ' +
      (sim.headStart.years
        ? esc(sim.headStart.leader) + ' earns ' + money(sim.headStart.incomeEarned) + ' before ' +
          esc(sim.headStart.laggard) + ' earns a professional income at all - see section 7.'
        : 'Both start earning at the same age, so neither loses earning years to training.') + '</div>'));

    /* 5. education debt */
    page(sect(5, 'Education debt', twoCol(function (res) {
      var t = res.totals, m = res.milestones;
      var borrowed = t.studentTuitionDebt + t.studentLivingDebt;
      return kv('Peak debt', money(t.peakStudentDebt)) +
        kv('Borrowed for tuition and fees', money(t.studentTuitionDebt)) +
        kv('Borrowed for living costs in school', money(t.studentLivingDebt)) +
        kv('Interest accrued before repayment', money(Math.max(0, t.peakStudentDebt - borrowed))) +
        kv('Interest rate', pctTxt(res.career.debt.rate)) +
        kv('Repayment period', res.career.debt.termYears + ' years') +
        kv('Total interest paid', money(t.educationInterest)) +
        kv('Total cost including financing', money(t.educationTotalCost)) +
        kv('Debt-free at', ageTxt(m.debtFreeAge, m.neverBorrowed) + (m.debtFreeProjected ? ' (projected)' : ''));
    })));

    /* 6. earnings progression */
    var p6 = page(sect(6, 'Earnings progression', ''));
    p6.appendChild(C.lineChart({ series: series('personalIncome'), markers: markers(), xTitle: 'Age', title: 'Annual income' }));
    p6.insertAdjacentHTML('beforeend', yearTable(sim));

    /* 7. head start */
    page(sect(7, 'Head-start analysis', headStartHtml(sim)));

    /* 8. investment growth */
    var p8 = page(sect(8, 'Investment growth', '<p class="chart-note">Cash and investments only.</p>'));
    p8.appendChild(C.lineChart({ series: series('investments'), markers: markers(), xTitle: 'Age', title: 'Investments' }));
    p8.insertAdjacentHTML('beforeend', milestoneBalanceTable());

    /* 9-10. business ownership and value */
    page(sect(9, 'Business ownership', twoCol(function (res) {
      if (!res.isOwner) { return '<p>Stays an employee for the whole period.</p>'; }
      var bz = res.career.business, lastRow = res.rows[res.rows.length - 1], by = lastRow.business;
      return kv('Business starts at', bz.startAge) +
        kv('Startup investment', money(bz.startupInvestment)) +
        kv('Share borrowed', pctTxt(bz.startupLoanShare)) +
        kv('Revenue, year one', money(bz.revenueY1)) +
        kv('Revenue at year ' + cfg.years, by ? money(by.revenue) : '-') +
        kv('People on payroll', by ? by.employees : '-') +
        kv('Gross margin achieved', by ? pctTxt(by.grossMarginActual) : '-') +
        kv('SDE margin achieved', by ? pctTxt(by.sdeMarginActual) : '-') +
        kv('Owner salary', money(lastRow.ownerSalary)) +
        kv('Distributions', money(lastRow.distributions)) +
        kv('Owner still produces', by ? pctTxt(by.revenue ? by.ownerProduced / by.revenue : 0) : '-');
    })));

    page(sect(10, 'Business value', twoCol(function (res) {
      if (!res.isOwner) { return '<p>No business, so no business equity.</p>'; }
      var lastRow = res.rows[res.rows.length - 1], v = lastRow.valuation;
      if (!v) { return '<p>The business did not survive to the end of the period.</p>'; }
      return kv('Valuation basis', esc(v.basis)) +
        kv('Base figure', money(v.base)) +
        kv('Base multiple', v.baseMultiple.toFixed(2) + 'x') +
        kv('Quality adjustment', '×' + v.qualityFactor.toFixed(2) + ' (avg ' + v.avgQuality.toFixed(1) + '/10)') +
        kv('Effective multiple', v.multiple.toFixed(2) + 'x') +
        kv('Estimated business value', money(lastRow.businessValue)) +
        kv('Business debt', '-' + money(lastRow.businessDebt)) +
        kv('Business cash', money(lastRow.businessCash)) +
        kv('Owner business equity', money(lastRow.businessEquity));
    })));

    /* 11. net worth progression */
    var p11 = page(sect(11, 'Net-worth progression', ''));
    p11.appendChild(C.lineChart({ series: series('netWorth'), markers: markers(), xTitle: 'Age', title: 'Net worth' }));
    p11.insertAdjacentHTML('beforeend', milestoneNetWorthTable());

    /* 12-13. lifestyle and hours */
    var p12 = page(sect(12, 'Work and lifestyle comparison',
      componentTable(sc.a.lifestyle.rows, sc.b.lifestyle.rows, a.name, b.name)));
    p12.appendChild(C.radarChart({
      axes: sc.a.lifestyle.rows.map(function (r, i) {
        return { label: r.label.replace(' / personal', ''), a: r.value, b: sc.b.lifestyle.rows[i].value }; }),
      colorA: colA(), colorB: colB(), size: 380
    }));

    page(sect(13, 'Lifetime hours worked',
      '<div class="tiles">' +
      tile('Total hours over ' + cfg.years + ' years', num(a.totals.hours), a.name + ' \u00b7 ' + num(a.totals.hoursWork) + ' on the job, ' + num(a.totals.hoursSchool) + ' in school', 'a-tint') +
      tile('Total hours over ' + cfg.years + ' years', num(b.totals.hours), b.name + ' \u00b7 ' + num(b.totals.hoursWork) + ' on the job, ' + num(b.totals.hoursSchool) + ' in school', 'b-tint') +
      tile('Typical week', sc.a.lifestyle.weeklyHours + ' hrs', a.name, 'a-tint') +
      tile('Typical week', sc.b.lifestyle.weeklyHours + ' hrs', b.name, 'b-tint') +
      '</div><p class="chart-note" style="margin-top:10px">Vacation removed. Years of unpaid schooling count only ' +
      'summer and part-time work.</p>'));

    /* 14. wealth per hour */
    page(sect(14, 'Wealth created per hour worked',
      '<div class="tiles">' +
      tile('Net worth per hour', money(a.totals.wealthPerHour), a.name, 'a-tint') +
      tile('Net worth per hour', money(b.totals.wealthPerHour), b.name, 'b-tint') +
      tile('Gross earnings per hour', money(a.totals.earningsPerHour), a.name, 'a-tint') +
      tile('Gross earnings per hour', money(b.totals.earningsPerHour), b.name, 'b-tint') +
      '</div>'));

    /* 15. financial freedom */
    page(sect(15, 'Financial-freedom estimate', twoCol(function (res) {
      var m = res.milestones;
      return kv('Selling the business', ageTxt(m.financialFreedomAgeWithSale) +
          (m.freedomSaleProjected ? ' (projected)' : '')) +
        kv('Keeping the business', ageTxt(m.financialFreedomAge) + (m.freedomProjected ? ' (projected)' : '')) +
        kv('First positive net worth', ageTxt(m.firstPositiveNetWorthAge)) +
        kv('Withdrawal rate used', pctTxt(cfg.safeWithdrawal));
    }) + '<p class="chart-note" style="margin-top:10px">Anything past age ' + (cfg.startAge + cfg.years) +
      ' is a projection on the same assumptions, run out to ' + sim.projectToAge + '.</p>'));

    /* 16-20. the scores */
    page(sect(16, 'Career score', componentTable(sc.a.four.career.rows, sc.b.four.career.rows, a.name, b.name) +
      '<p class="chart-note">' + esc(a.name) + ' ' + sc.a.four.career.score + '/10 &middot; ' +
      esc(b.name) + ' ' + sc.b.four.career.score + '/10</p>'));
    page(sect(17, 'Owner-operator score', componentTable(sc.a.four.ownerOperator.rows, sc.b.four.ownerOperator.rows, a.name, b.name) +
      '<p class="chart-note">' + esc(a.name) + ' ' + sc.a.four.ownerOperator.score + '/10 &middot; ' +
      esc(b.name) + ' ' + sc.b.four.ownerOperator.score + '/10</p>'));
    page(sect(18, 'Business-owner score', componentTable(sc.a.four.businessOwner.rows, sc.b.four.businessOwner.rows, a.name, b.name) +
      '<p class="chart-note">' + esc(a.name) + ' ' + sc.a.four.businessOwner.score + '/10 &middot; ' +
      esc(b.name) + ' ' + sc.b.four.businessOwner.score + '/10</p>'));
    page(sect(19, 'Investor score', componentTable(sc.a.four.investor.rows, sc.b.four.investor.rows, a.name, b.name) +
      '<p class="chart-note">' + esc(a.name) + ' ' + sc.a.four.investor.score + '/10 &middot; ' +
      esc(b.name) + ' ' + sc.b.four.investor.score + '/10</p>' +
      '<h4 style="margin-top:16px">Owner dependency</h4>' + twoCol(function (res, s) {
        return '<p>' + (s.ownerDependency.applicable ? '<strong>' + s.ownerDependency.score + '/10.</strong> ' : '') +
          esc(s.ownerDependency.note) + '</p>'; })));

    var p20 = page(sect(20, 'Blue Collar Business overall score',
      '<div class="score-pair">' + scoreBreakdown(a, sc.a, 'a') + scoreBreakdown(b, sc.b, 'b') + '</div>' +
      componentTable(sc.a.rows, sc.b.rows, a.name, b.name)));
    p20.appendChild(C.scoreBars({
      rows: sc.a.rows.map(function (r, i) { return { label: r.label, a: r.value, b: sc.b.rows[i].value, max: 10 }; }),
      colorA: colA(), colorB: colB()
    }));

    /* 21. scenarios */
    page(sect(21, 'Conservative, realistic and aggressive',
      '<div class="tscroll"><table class="data"><thead><tr><th>Scenario</th><th>' + esc(a.name) + '</th><th>' +
      esc(b.name) + '</th><th>Gap</th><th>Ahead</th></tr></thead><tbody>' +
      ['conservative', 'realistic', 'aggressive'].map(function (k) {
        var r = scenarioCache[k], g = r.a.totals.netWorth - r.b.totals.netWorth;
        return '<tr><td>' + esc(D.SCENARIOS[k].label) + '</td><td class="a-val">' + money(r.a.totals.netWorth) +
          '</td><td class="b-val">' + money(r.b.totals.netWorth) + '</td><td>' + money(Math.abs(g)) +
          '</td><td>' + esc(g >= 0 ? r.a.name : r.b.name) + '</td></tr>';
      }).join('') + '</tbody></table></div>' +
      ['conservative', 'realistic', 'aggressive'].map(function (k) {
        return '<p class="chart-note"><strong>' + esc(D.SCENARIOS[k].label) + '.</strong> ' +
          esc(D.SCENARIOS[k].blurb) + '</p>'; }).join('')));

    /* 22. the analysis */
    page(sect(22, 'Final analysis', '<div class="prose">' + last.analysis.map(function (s) {
      return '<h3>' + esc(s.heading) + '</h3>' + s.paragraphs.map(function (p) { return '<p>' + esc(p) + '</p>'; }).join('');
    }).join('') + '</div>'));

    /* 23. winner by category */
    page(sect(23, 'Winner by category', '<div class="cats">' + sc.categories.map(function (c) {
      var cls = c.tie ? 'tie' : (c.winner === a.name ? 'a' : 'b');
      return '<div class="cat"><span>' + esc(c.label) + '</span><span class="who ' + cls + '">' + esc(c.winner) + '</span></div>';
    }).join('') + '</div>' +
      '<h4 style="margin-top:16px">Employee or owner</h4>' +
      '<div class="grid2">' + ['a', 'b'].map(function (which) {
        var evo = E.employeeVsOwner(state, which);
        var d = evo.owner.totals.netWorth - evo.employee.totals.netWorth;
        return '<div><h4>' + esc(evo.career) + '</h4>' +
          kv('As an employee', money(evo.employee.totals.netWorth)) +
          kv('As an owner', money(evo.owner.totals.netWorth)) +
          kv('Ownership is worth', (d >= 0 ? '+' : '-') + money(Math.abs(d))) + '</div>';
      }).join('') + '</div>'));

    /* 24. verdict */
    page(sect(24, 'The ' + cfg.years + '-year verdict',
      '<div class="hero-result" style="margin:0"><div class="hero-verdict">Higher estimated net worth</div>' +
      '<div class="hero-name">' + esc(sc.netWorthWinner || 'Level') + '</div>' +
      '<div class="hero-gap">' + (sc.netWorthWinner ? 'by ' + money(Math.abs(a.totals.netWorth - b.totals.netWorth)) : '') +
      '</div></div>' +
      '<div class="prose" style="margin-top:14px"><p>' + esc(last.youtube.verdict) + '</p></div>'));

    /* 25. sources and assumptions */
    page(sect(25, 'Sources and assumptions',
      '<h4>Global assumptions</h4>' +
      kv('Starting age', cfg.startAge) + kv('Period', cfg.years + ' years') +
      kv('Jurisdiction', esc(((D.TAX[cfg.country] || {}).regions || {})[cfg.region] ?
        D.TAX[cfg.country].regions[cfg.region].label + ', ' + D.TAX[cfg.country].label : cfg.country)) +
      kv('Inflation', pctTxt(cfg.inflation)) + kv('Investment return', pctTxt(cfg.investReturn)) +
      kv('Wage drift above stages', pctTxt(cfg.salaryGrowth)) +
      kv('Safe withdrawal rate', pctTxt(cfg.safeWithdrawal)) +
      kv('Tax model', cfg.taxMode === 'flat' ? 'Flat ' + pctTxt(cfg.flatRate) : 'Progressive brackets, indexed to inflation') +
      kv('Scenario', esc(sim.scenario.label)) +
      '<h4 style="margin-top:16px">Data confidence</h4>' +
      '<div class="grid2">' + [['a', sc.confidenceA], ['b', sc.confidenceB]].map(function (p) {
        return '<div><h4>' + esc(sim[p[0]].name) + ' &middot; ' + p[1].level + '</h4>' +
          p[1].tags.map(function (t) { return kv(t.area, (D.CONFIDENCE[t.conf] || {}).label || t.conf); }).join('') +
          '<p class="chart-note">' + esc(p[1].note) + '</p></div>';
      }).join('') + '</div>' +
      '<h4 style="margin-top:16px">What this model does not do</h4>' +
      '<ul class="prose">' +
      '<li>It does not price the chance of a business failing. It shows what happens if the business works, ' +
      'except where the numbers stop working on their own - in which case it says so.</li>' +
      '<li>Tax is simplified: federal and provincial or state brackets with payroll contributions and a ' +
      'registered-savings deduction. No credits, no spouse, no dependants, no capital-gains treatment on a sale.</li>' +
      '<li>Investment returns are a smooth annual rate. Real markets are not smooth, and sequence matters.</li>' +
      '<li>Preset figures are typical published ranges for each trade or profession, not values from a single ' +
      'cited source. They are labelled Industry average or Estimated for that reason. Nothing ships as Verified.</li>' +
      '<li>It is not financial, tax, career or investment advice.</li>' +
      '</ul>'));
  }

  function milestoneAges() {
    var out = [], cfg = state;
    for (var age = 20; age <= cfg.startAge + cfg.years; age += 5) {
      if (age >= cfg.startAge) { out.push(age); }
    }
    var endAge = cfg.startAge + cfg.years;
    if (out[out.length - 1] !== endAge) { out.push(endAge); }
    return out;
  }
  function milestoneTable(key, label) {
    var sim = last.sim;
    var ages = milestoneAges();
    function at(res, age) {
      var r = res.rows.filter(function (x) { return x.age === age; })[0];
      return r ? r[key] : null;
    }
    return '<div class="tscroll"><table class="data"><thead><tr><th>Age</th><th>' + esc(sim.a.name) + '</th><th>' +
      esc(sim.b.name) + '</th><th>Gap</th></tr></thead><tbody>' +
      ages.map(function (age) {
        var av = at(sim.a, age), bv = at(sim.b, age);
        if (av == null || bv == null) { return ''; }
        return '<tr><td>' + age + '</td><td class="a-val">' + money(av) + '</td><td class="b-val">' + money(bv) +
          '</td><td>' + money(av - bv) + '</td></tr>';
      }).join('') + '</tbody></table></div>';
  }
  function milestoneBalanceTable() { return milestoneTable('investments'); }
  function milestoneNetWorthTable() { return milestoneTable('netWorth'); }

  /* =====================================================================
     RECOMPUTE + RENDER
     ===================================================================== */
  var renderTimer = null;
  function recompute(skipForms) {
    try {
      var sim = E.run(state);
      var scores = S.scoreAll(sim);
      last = {
        sim: sim, scores: scores,
        analysis: N.analysis(sim, scores),
        youtube: N.youtube(sim, scores, state.scriptSeed || 0)
      };
      scenarioCache = E.runAllScenarios(state);
      renderResults();
      renderCharts();
      renderScores();
      renderAnalysis();
      renderYouTube();
      renderReport();
      /* A changed comparison means a changed script. */
      if (BCB.studio && BCB.studio.refresh) { BCB.studio.refresh(); }
      if (!skipForms) {
        document.getElementById('nameA').textContent = state.careers.a.name;
        document.getElementById('nameB').textContent = state.careers.b.name;
      }
    } catch (err) {
      /* A bad input should not blank the whole tool. */
      document.getElementById('resultsBody').innerHTML =
        '<div class="card"><h2>That combination broke the model</h2><p class="sub">' + esc(err.message) +
        '</p><p>Change the input you just edited, or reset to defaults.</p></div>';
      if (global.console) { console.error(err); }
    }
  }
  function scheduleRecompute() {
    clearTimeout(renderTimer);
    renderTimer = setTimeout(function () { recompute(true); }, 180);
  }

  /* =====================================================================
     EVENTS
     ===================================================================== */
  function onInput(ev) {
    var t = ev.target;
    if (t.dataset.path) {
      var root = t.dataset.root === 'global' ? state : state.careers[t.dataset.root];
      var type = t.dataset.type, val;
      if (type === 'check') { val = t.checked; }
      else if (type === 'pct') { val = (parseFloat(t.value) || 0) / 100; }
      else if (type === 'num') { val = parseFloat(t.value); if (!isFinite(val)) { val = 0; } }
      else { val = t.value; }
      set(root, t.dataset.path, val);
      /* Changing country changes which regions exist. */
      if (t.dataset.path === 'country') {
        var regs = optionList('regions');
        if (!regs.filter(function (r) { return r.v === state.region; }).length) { state.region = regs[0].v; }
        state.currency = (D.TAX[state.country] || {}).currency || state.currency;
        renderGlobalForm();
      }
      if (t.dataset.path === 'name') {
        document.getElementById(t.dataset.root === 'a' ? 'nameA' : 'nameB').textContent = t.value;
      }
      scheduleRecompute();
      return;
    }
    if (t.dataset.stage) {
      var stages = state.careers[t.dataset.stage].stages;
      var s = stages[+t.dataset.i];
      if (!s) { return; }
      s[t.dataset.key] = t.dataset.key === 'label' ? t.value : (parseFloat(t.value) || 0);
      if (t.dataset.key === 'age') {
        stages.sort(function (x, y) { return x.age - y.age; });
      }
      scheduleRecompute();
    }
  }

  function onClick(ev) {
    var t = ev.target.closest('[data-matchup],[data-scen],[data-addstage],[data-delstage],[data-reshuffle],.tab');
    if (!t) { return; }
    if (t.dataset.reshuffle) {
      state.scriptSeed = (state.scriptSeed || 0) + 1;
      recompute(true);
      return;
    }
    if (t.classList.contains('tab')) {
      document.querySelectorAll('.tab').forEach(function (x) { x.setAttribute('aria-selected', String(x === t)); });
      document.querySelectorAll('.panel').forEach(function (p) {
        p.classList.toggle('on', p.id === 'panel-' + t.dataset.panel);
        p.classList.toggle('print-me', p.id === 'panel-' + t.dataset.panel);
      });
      window.scrollTo(0, 0);
      return;
    }
    if (t.dataset.matchup != null) {
      var m = D.MATCHUPS[+t.dataset.matchup];
      state = freshState(m.a, m.b, m.ownerSplit
        ? { aOpts: { forceEmployee: true }, bOpts: { forceOwner: true } } : null);
      if (m.ownerSplit) {
        state.careers.a.name = state.careers.a.name + ' (employee)';
        state.careers.b.name = state.careers.b.name + ' (owner)';
      }
      renderAllForms();
      recompute();
      return;
    }
    if (t.dataset.scen) {
      state.scenario = t.dataset.scen;
      renderScenarioTabs();
      recompute(true);
      return;
    }
    if (t.dataset.addstage) {
      var arr = state.careers[t.dataset.addstage].stages;
      var lastS = arr[arr.length - 1];
      arr.push(D.stage(lastS ? lastS.age + 3 : state.startAge, 'New stage',
        lastS ? Math.round(lastS.base * 1.15) : 50000, 0, 0, {}));
      renderCareerForm(t.dataset.addstage);
      recompute(true);
      return;
    }
    if (t.dataset.delstage) {
      var st = state.careers[t.dataset.delstage].stages;
      if (st.length > 1) { st.splice(+t.dataset.i, 1); renderCareerForm(t.dataset.delstage); recompute(true); }
    }
  }

  function onChange(ev) {
    var t = ev.target;
    if (t.dataset.preset) {
      if (!t.value) { return; }
      var keep = state.careers[t.dataset.preset].name;
      state.careers[t.dataset.preset] = deep(D.CAREERS[t.value]);
      state.careers[t.dataset.preset === 'a' ? 'aOpts' : 'bOpts'] = null;
      renderCareerForm(t.dataset.preset);
      recompute();
      return;
    }
    if (t.dataset.path || t.dataset.stage) { onInput(ev); }
  }

  function renderAllForms() {
    renderGlobalForm();
    renderCareerForm('a');
    renderCareerForm('b');
    renderScenarioTabs();
  }

  function msg(text) {
    var el = document.getElementById('saveMsg');
    el.textContent = text;
    setTimeout(function () { if (el.textContent === text) { el.textContent = ''; } }, 4000);
  }

  function init() {
    state = freshState('plumber', 'dentist');
    renderMatchups();
    renderAllForms();
    recompute();

    document.addEventListener('input', onInput);
    document.addEventListener('change', onChange);
    document.addEventListener('click', onClick);

    document.getElementById('panel-setup').classList.add('print-me');

    document.getElementById('themeBtn').addEventListener('click', function () {
      var cur = document.documentElement.getAttribute('data-theme');
      var next = cur === 'dark' ? 'light' : (cur === 'light' ? 'dark' : 'dark');
      document.documentElement.setAttribute('data-theme', next);
      try { localStorage.setItem(STORE_KEY + '-theme', next); } catch (e) { /* private mode */ }
      recompute(true);   /* charts read their colours from CSS variables */
    });
    try {
      var savedTheme = localStorage.getItem(STORE_KEY + '-theme');
      if (savedTheme) { document.documentElement.setAttribute('data-theme', savedTheme); }
    } catch (e) { /* storage can throw outright, not just return null */ }

    document.getElementById('saveBtn').addEventListener('click', function () {
      try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); msg('Saved in this browser.'); }
      catch (e) { msg('Could not save - this browser is blocking storage. Export the JSON instead.'); }
    });
    document.getElementById('loadBtn').addEventListener('click', function () {
      try {
        var raw = localStorage.getItem(STORE_KEY);
        if (!raw) { msg('Nothing saved yet.'); return; }
        state = JSON.parse(raw);
        renderAllForms(); recompute(); msg('Loaded.');
      } catch (e) { msg('Could not read the saved comparison.'); }
    });
    document.getElementById('exportBtn').addEventListener('click', function () {
      var json = JSON.stringify(state, null, 2);
      var name = (state.careers.a.name + '-vs-' + state.careers.b.name + '-20-year-test.json')
        .replace(/[^a-z0-9.-]+/gi, '-').toLowerCase();
      /* Always show it: a browser-started download is blocked outright in a
         sandboxed frame, and a button that silently does nothing is worse
         than no button. */
      var box = document.getElementById('exportBox');
      box.hidden = false;
      box.querySelector('textarea').value = json;
      box.querySelector('textarea').select();
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(json).then(function () { msg('Copied to the clipboard.'); },
          function () { msg('Select the text below and copy it.'); });
      } else {
        msg('Select the text below and copy it.');
      }
      try {
        var blob = new Blob([json], { type: 'application/json' });
        var a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = name;
        document.body.appendChild(a); a.click(); a.remove();
        setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
      } catch (e) { /* sandboxed - the textarea above is the answer */ }
    });
    document.getElementById('importFile').addEventListener('change', function (ev) {
      var f = ev.target.files[0];
      if (!f) { return; }
      var fr = new FileReader();
      fr.onload = function () {
        try {
          var loaded = JSON.parse(fr.result);
          if (!loaded.careers || !loaded.careers.a || !loaded.careers.b) { throw new Error('Not a 20-Year Test file.'); }
          state = loaded; renderAllForms(); recompute(); msg('Imported.');
        } catch (e) { msg('That file did not load: ' + e.message); }
      };
      fr.readAsText(f);
      ev.target.value = '';
    });
    document.getElementById('resetBtn').addEventListener('click', function () {
      state = freshState('plumber', 'dentist'); renderAllForms(); recompute(); msg('Back to defaults.');
    });
    document.getElementById('printBtn').addEventListener('click', function () { window.print(); });
  }

  if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', init); }
  else { init(); }

  BCB.app = {
    getState: function () { return state; },
    getLast: function () { return last; },
    getScenarios: function () { return scenarioCache; },
    recompute: recompute
  };

})(typeof window !== 'undefined' ? window : globalThis);
