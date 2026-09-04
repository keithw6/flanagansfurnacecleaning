/* =====================================================================
   Blue Collar Business - The 20-Year Test
   studio.js : the recording rig

   Three pieces that have to stay out of each other's way:

   1. PRESENTATION  full-bleed slides in this window - the thing you
                    capture. Auto-advances on a timer sized to each
                    script block; every key overrides the timer.
   2. PROMPTER      a separate window you put on the other half of the
                    monitor. Its reading line is pinned NEAR THE TOP so
                    your eyeline sits as close to the webcam as it can,
                    and it draws an alignment marker to help you place
                    the window directly under the lens.
   3. WEBCAM        picture-in-picture over the slides, so one window
                    capture carries both.

   The prompter is a real second window rather than an overlay for one
   reason: an overlay is inside the thing you are recording.
   ===================================================================== */
(function (global) {
  'use strict';

  var BCB = global.BCB;
  var C = BCB.charts, N = BCB.narrative;

  var script = null;          /* the generated episode */
  var idx = 0;                /* current beat */
  var playing = false;
  var remaining = 0;          /* seconds left on this beat */
  var ticker = null;
  var promptWin = null;
  var camStream = null;
  var overlay = null;
  var bgLayer = null;

  var prefs = {
    cam: { on: false, corner: 'br', size: 22, shape: 'rounded', mirror: true, deviceId: '', placeholder: true },
    prompter: { fontSize: 34, lineHeight: 1.45, width: 26, readingLine: 18, mirror: false, speed: 1 },
    autoAdvance: true,
    /* 'one'  full-bleed slides, camera floating in a corner
       'two'  explainer column on the left, camera panel on the right
       Studio One's markup and CSS are untouched by mode two; the split
       layout is entirely additive, gated on a class. */
    mode: 'one',
    /* Studio Three only: the frame it composes for. */
    vertical: { ratio: '9:16', safeGuides: true },
    /* Studio Two framing. Defaults match a floating presenter card:
       inset from the edge, rounded, outlined, around 60% of frame
       height and vertically centred. */
    split: { camHeight: 62, camWidth: 26, align: 'center' }
  };
  var PREF_KEY = 'bcb-20-year-test-v1-studio';
  try {
    var saved = localStorage.getItem(PREF_KEY);
    if (saved) {
      var p = JSON.parse(saved);
      if (p.cam) { Object.assign(prefs.cam, p.cam); }
      if (p.prompter) { Object.assign(prefs.prompter, p.prompter); }
      if (typeof p.autoAdvance === 'boolean') { prefs.autoAdvance = p.autoAdvance; }
      if (p.mode === 'one' || p.mode === 'two' || p.mode === 'three') { prefs.mode = p.mode; }
      if (p.vertical) { Object.assign(prefs.vertical, p.vertical); }
      if (p.split) { Object.assign(prefs.split, p.split); }
      prefs.cam.on = false;   /* never auto-open the camera on load */
    }
  } catch (e) { /* storage can throw outright in some contexts */ }
  function savePrefs() {
    try { localStorage.setItem(PREF_KEY, JSON.stringify(prefs)); } catch (e) { /* fine */ }
  }

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c];
    });
  }
  function mmss(sec) {
    sec = Math.max(0, Math.round(sec));
    return Math.floor(sec / 60) + ':' + String(sec % 60).padStart(2, '0');
  }
  function colA() { return getComputedStyle(document.documentElement).getPropertyValue('--series-a').trim(); }
  function colB() { return getComputedStyle(document.documentElement).getPropertyValue('--series-b').trim(); }
  function money(v) {
    if (v == null || !isFinite(v)) { return '-'; }
    return (v < 0 ? '-' : '') + '$' + Math.abs(Math.round(v)).toLocaleString();
  }

  /* =====================================================================
     THE SCRIPT
     ===================================================================== */
  function build() {
    var L = BCB.app.getLast();
    if (!L || !L.sim) { return null; }
    /* Give the scenario beat a real sentence rather than a vague one. */
    var scen = BCB.app.getScenarios && BCB.app.getScenarios();
    if (scen && scen.conservative) {
      var c = scen.conservative;
      var cGap = c.a.totals.netWorth - c.b.totals.netWorth;
      var cWin = cGap >= 0 ? c.a.name : c.b.name;
      var rGap = Math.abs(L.sim.a.totals.netWorth - L.sim.b.totals.netWorth);
      N.setScenarioNote(cWin + ' is still ahead, but by ' + N.say(Math.abs(cGap)) +
        ' instead of ' + N.say(rGap));
    }
    script = N.episodeScript(L.sim, L.scores);
    if (idx >= script.beats.length) { idx = 0; }
    return script;
  }

  function beat() { return script ? script.beats[idx] : null; }

  /* =====================================================================
     BEAT VISUALS
     Each beat names a visual; this turns that into a node. Reuses the
     same chart code as the rest of the app so the slide and the tab
     can never disagree.
     ===================================================================== */
  function seriesFor(key) {
    var L = BCB.app.getLast(), sim = L.sim;
    var STOCKS = { netWorth: 1, investments: 1, totalDebt: 1, businessEquity: 1, cumEarnings: 1 };
    var shift = STOCKS[key] ? 1 : 0;
    return [
      { name: sim.a.name, color: colA(), points: sim.a.rows.map(function (r) { return { x: r.age + shift, y: r[key] }; }) },
      { name: sim.b.name, color: colB(), points: sim.b.rows.map(function (r) { return { x: r.age + shift, y: r[key] }; }) }
    ];
  }
  function markers() {
    var sim = BCB.app.getLast().sim, m = [];
    if (sim.a.milestones.businessStartAge) { m.push({ x: sim.a.milestones.businessStartAge, label: sim.a.name + ' starts business' }); }
    if (sim.b.milestones.businessStartAge) { m.push({ x: sim.b.milestones.businessStartAge, label: sim.b.name + ' starts business' }); }
    return m;
  }
  function bigStat(items) {
    var d = document.createElement('div');
    d.className = 'st-stats';
    d.innerHTML = items.map(function (it) {
      return '<div class="st-stat' + (it.side ? ' side-' + it.side : '') + '">' +
        '<div class="k">' + esc(it.k) + '</div><div class="v">' + esc(it.v) + '</div>' +
        (it.n ? '<div class="n">' + esc(it.n) + '</div>' : '') + '</div>';
    }).join('');
    return d;
  }

  function visualFor(b) {
    var L = BCB.app.getLast(), sim = L.sim, sc = L.scores, cfg = sim.cfg;
    var a = sim.a, bb = sim.b;
    var wrap = document.createElement('div');
    wrap.className = 'st-visual';

    if (b.kind.indexOf('chart:') === 0) {
      var key = b.kind.slice(6);
      /* A 1180-wide frame shrinks every label once the column narrows, so
         each layout gets proportions rather than a scaled-down copy. The
         vertical frame is squarer again and needs the most room per label. */
      var dims = prefs.mode === 'three' ? { w: 780, h: 620, gap: 44 }
               : prefs.mode === 'two'   ? { w: 900, h: 520, gap: 40 }
               :                          { w: 1180, h: 520, gap: 48 };
      wrap.appendChild(C.lineChart({
        series: seriesFor(key), markers: markers(), xTitle: 'Age',
        format: key === 'hours' ? C.fmtNum : C.fmtMoney,
        width: dims.w, height: dims.h, endLabelGap: dims.gap
      }));
      wrap.classList.add('wide');
      return wrap;
    }

    switch (b.kind) {
      case 'brand':
        var brand = document.createElement('div');
        brand.className = 'st-brandcard';
        brand.innerHTML =
          '<div class="st-ladder">' +
          ['Do', 'Lead', 'Build', 'Own', 'Invest'].map(function (step, i) {
            return '<span class="st-rung' + (i === 4 ? ' last' : '') + '">' + step + '</span>';
          }).join('<i class="st-arrow"></i>') +
          '</div>' +
          '<div class="st-vs"><span class="a">' + esc(a.name) + '</span>' +
          '<em>vs</em><span class="b">' + esc(bb.name) + '</span></div>';
        wrap.appendChild(brand);
        wrap.classList.add('wide');
        return wrap;

      case 'outro':
        var outro = document.createElement('div');
        outro.className = 'st-brandcard';
        outro.innerHTML =
          '<div class="st-brandmark">Learn the trade.<br>Build the business.<br>Own the asset.</div>';
        wrap.appendChild(outro);
        return wrap;

      case 'title':
        wrap.appendChild(bigStat([
          { k: 'Starting age', v: String(cfg.startAge) },
          { k: 'Period', v: cfg.years + ' years' },
          { k: 'Finishing at', v: 'age ' + (cfg.startAge + cfg.years) }
        ]));
        return wrap;

      case 'setup':
        wrap.appendChild(bigStat([
          { k: 'Inflation', v: Math.round(cfg.inflation * 1000) / 10 + '%' },
          { k: 'Investment return', v: Math.round(cfg.investReturn * 1000) / 10 + '%' },
          { k: 'Scenario', v: sim.scenario.label },
          { k: 'Same house for both', v: cfg.housing.enabled ? money(cfg.housing.price) : 'no house' }
        ]));
        return wrap;

      case 'headstart':
        var hs = sim.headStart;
        var hero = document.createElement('div');
        hero.className = 'st-hero';
        hero.innerHTML = '<div class="st-hero-num">' + money(hs.total) + '</div>' +
          '<div class="st-hero-sub">' + esc(hs.leader) + "'s " + hs.years + '-year head start, banked before ' +
          esc(hs.laggard) + ' earns a professional income</div>';
        wrap.appendChild(hero);
        wrap.appendChild(bigStat([
          { k: 'Income earned', v: money(hs.incomeEarned) },
          { k: 'Invested and banked', v: money(hs.investmentsAccumulated) },
          { k: 'Education debt avoided', v: money(hs.debtAvoided) },
          { k: 'Tuition avoided', v: money(hs.educationSpendAvoided) }
        ]));
        return wrap;

      case 'education':
        wrap.appendChild(bigStat([
          { k: a.name + ' - all in', v: money(a.totals.educationTotalCost), side: 'a' },
          { k: bb.name + ' - all in', v: money(bb.totals.educationTotalCost), side: 'b' },
          { k: a.name + ' - peak debt', v: money(a.totals.peakStudentDebt), side: 'a' },
          { k: bb.name + ' - peak debt', v: money(bb.totals.peakStudentDebt), side: 'b' }
        ]));
        return wrap;

      case 'business':
        wrap.appendChild(bigStat([
          { k: a.name + ' - business equity', v: money(a.totals.businessEquity), side: 'a',
            n: a.isOwner ? 'started at ' + a.milestones.businessStartAge : 'stayed an employee' },
          { k: bb.name + ' - business equity', v: money(bb.totals.businessEquity), side: 'b',
            n: bb.isOwner ? 'started at ' + bb.milestones.businessStartAge : 'stayed an employee' },
          { k: a.name + ' - on payroll', v: String(a.totals.finalEmployees || 0), side: 'a' },
          { k: bb.name + ' - on payroll', v: String(bb.totals.finalEmployees || 0), side: 'b' }
        ]));
        return wrap;

      case 'dependency':
        var dA = sc.a.ownerDependency, dB = sc.b.ownerDependency;
        wrap.appendChild(bigStat([
          { k: a.name, v: dA.applicable ? dA.score + '/10' : 'no business', side: 'a',
            n: dA.applicable ? (dA.stepBackBlocked ? 'cannot step back' : 'can step back') : '' },
          { k: bb.name, v: dB.applicable ? dB.score + '/10' : 'no business', side: 'b',
            n: dB.applicable ? (dB.stepBackBlocked ? 'cannot step back' : 'can step back') : '' }
        ]));
        return wrap;

      case 'columns':
        var cols = document.createElement('div');
        cols.className = 'st-cols';
        [[a, 'a'], [bb, 'b']].forEach(function (pair) {
          var res = pair[0], t = res.totals;
          var lines = [
            ['Career earnings', money(t.careerEarnings)],
            ['Education, all in', '-' + money(t.educationTotalCost)],
            ['Investments', money(t.investments + t.cash)],
            ['Home equity', money(t.homeEquity)],
            ['Business equity', money(t.businessEquity)],
            ['Debt', '-' + money(t.debt)]
          ];
          cols.innerHTML += '<div class="st-col ' + pair[1] + '">' +
            '<div class="st-col-name">' + esc(res.name) + '</div>' +
            lines.map(function (l) {
              return '<div class="st-col-line"><span>' + esc(l[0]) + '</span><span>' + esc(l[1]) + '</span></div>';
            }).join('') +
            '<div class="st-col-total"><div class="k">Estimated net worth</div>' +
            '<div class="v">' + money(t.netWorth) + '</div></div></div>';
        });
        wrap.appendChild(cols);
        wrap.classList.add('wide');
        return wrap;

      case 'hours':
        wrap.appendChild(bigStat([
          { k: a.name + ' - hours worked', v: Math.round(a.totals.hours).toLocaleString(), side: 'a' },
          { k: bb.name + ' - hours worked', v: Math.round(bb.totals.hours).toLocaleString(), side: 'b' },
          { k: a.name + ' - wealth per hour', v: money(a.totals.wealthPerHour), side: 'a' },
          { k: bb.name + ' - wealth per hour', v: money(bb.totals.wealthPerHour), side: 'b' }
        ]));
        return wrap;

      case 'freedom':
        wrap.appendChild(bigStat([
          { k: a.name + ' - financially free', v: a.milestones.financialFreedomAgeWithSale == null ? 'not reached' : 'age ' + a.milestones.financialFreedomAgeWithSale, side: 'a' },
          { k: bb.name + ' - financially free', v: bb.milestones.financialFreedomAgeWithSale == null ? 'not reached' : 'age ' + bb.milestones.financialFreedomAgeWithSale, side: 'b' },
          { k: a.name + ' - time freedom', v: sc.a.timeFreedom.score + '/10', side: 'a' },
          { k: bb.name + ' - time freedom', v: sc.b.timeFreedom.score + '/10', side: 'b' }
        ]));
        return wrap;

      case 'radar':
        wrap.appendChild(C.radarChart({
          axes: sc.a.lifestyle.rows.map(function (r, i) {
            return { label: r.label.replace(' / personal', ''), a: r.value, b: sc.b.lifestyle.rows[i].value };
          }),
          colorA: colA(), colorB: colB(), size: 560
        }));
        return wrap;

      case 'scores':
        var s = document.createElement('div');
        s.className = 'st-scores';
        [[a, sc.a, 'a'], [bb, sc.b, 'b']].forEach(function (p) {
          s.innerHTML += '<div class="st-score ' + p[2] + '"><div class="who">' + esc(p[0].name) + '</div>' +
            '<div class="n">' + p[1].score + '</div><div class="of">out of 100</div>' +
            '<div class="four">' +
            [['Career', p[1].four.career.score], ['Owner-op', p[1].four.ownerOperator.score],
             ['Business', p[1].four.businessOwner.score], ['Investor', p[1].four.investor.score]]
            .map(function (f) { return '<div><span>' + f[0] + '</span><strong>' + f[1] + '</strong></div>'; }).join('') +
            '</div></div>';
        });
        wrap.appendChild(s);
        wrap.classList.add('wide');
        return wrap;

      case 'categories':
        var cats = document.createElement('div');
        cats.className = 'st-cats';
        cats.innerHTML = sc.categories.map(function (c) {
          var cls = c.tie ? 'tie' : (c.winner === a.name ? 'a' : 'b');
          return '<div class="st-cat"><span>' + esc(c.label) + '</span><strong class="' + cls + '">' +
            esc(c.winner) + '</strong></div>';
        }).join('');
        wrap.appendChild(cats);
        wrap.classList.add('wide');
        return wrap;

      case 'scenarios':
        var scen = BCB.app.getScenarios();
        var tbl = document.createElement('div');
        tbl.className = 'st-scen';
        tbl.innerHTML = ['conservative', 'realistic', 'aggressive'].map(function (k) {
          var r = scen[k];
          return '<div class="st-scen-row' + (k === cfg.scenario ? ' on' : '') + '">' +
            '<span class="lbl">' + k + '</span>' +
            '<span class="a">' + C.fmtMoney(r.a.totals.netWorth) + '</span>' +
            '<span class="b">' + C.fmtMoney(r.b.totals.netWorth) + '</span></div>';
        }).join('');
        tbl.innerHTML = '<div class="st-scen-row head"><span class="lbl"></span><span class="a">' +
          esc(a.name) + '</span><span class="b">' + esc(bb.name) + '</span></div>' + tbl.innerHTML;
        wrap.appendChild(tbl);
        return wrap;

      case 'verdict':
        var v = document.createElement('div');
        v.className = 'st-hero';
        var gap = Math.abs(a.totals.netWorth - bb.totals.netWorth);
        v.innerHTML = '<div class="st-hero-kick">Higher estimated net worth</div>' +
          '<div class="st-hero-num">' + esc(sc.netWorthWinner || 'Level') + '</div>' +
          '<div class="st-hero-sub">' + (sc.netWorthWinner ? 'ahead by ' + money(gap) + ' after ' + cfg.years + ' years' : '') + '</div>';
        wrap.appendChild(v);
        return wrap;
    }
    return wrap;
  }

  /* =====================================================================
     PRESENTATION
     ===================================================================== */
  function openPresentation() {
    if (!build()) { return; }
    if (overlay) { overlay.remove(); }
    var three = prefs.mode === 'three';
    overlay = document.createElement('div');
    overlay.className = 'st-stage' +
      (prefs.mode === 'two' ? ' st-two' : '') +
      (three ? ' st-three ratio-' + prefs.vertical.ratio.replace(':', '-') : '');

    var head =
      '<div class="st-top">' +
        '<div class="st-brand">Blue Collar Business<span>The ' + BCB.app.getLast().sim.cfg.years + '-Year Test</span></div>' +
        '<div class="st-meta"><span id="stCount"></span><span id="stClock"></span></div>' +
      '</div>';
    var body =
      '<div class="st-body"><div class="st-kick" id="stKick"></div>' +
      '<h1 id="stTitle"></h1><div id="stVis"></div></div>';
    var prog = '<div class="st-progress" id="stProg"></div>';
    var camcol = '<div class="st-camcol" id="stCamCol"></div>';

    /* Studio Three composes inside a fixed-ratio frame rather than the
       whole window, because the deliverable is a 9:16 file - what is
       outside the frame is not in the video. The frame is a wrapper, so
       every id below stays where the rest of the code expects it. */
    var inner = three
      ? '<div class="st-frame">' + camcol + head + body + prog +
          (prefs.vertical.safeGuides ? '<div class="st-safe" aria-hidden="true">' +
            '<span class="s-right"></span><span class="s-bottom"></span>' +
            '<em>platform UI sits here</em></div>' : '') +
        '</div>'
      : head + body + prog + (prefs.mode === 'two' ? camcol : '');

    overlay.innerHTML = inner +
      '<div class="st-controls no-print" id="stCtl">' +
        '<button data-act="prev" title="Previous beat (left arrow)">&larr;</button>' +
        '<button data-act="play" title="Play or pause (space)">Play</button>' +
        '<button data-act="next" title="Next beat (right arrow)">&rarr;</button>' +
        '<button data-act="prompter" title="Open the prompter window">Prompter</button>' +
        '<button data-act="cam" title="Toggle the webcam (C)">Camera</button>' +
        '<button data-act="exit" title="Leave the stage (Esc)">Exit</button>' +
      '</div>';
    /* Background sits behind everything on the stage. */
    bgLayer = BCB.media.createLayer();
    overlay.insertBefore(bgLayer, overlay.firstChild);
    document.body.appendChild(overlay);
    document.body.classList.add('st-on');
    BCB.media.load().then(function () { paintBackground(); });
    overlay.addEventListener('click', function (ev) {
      var b = ev.target.closest('[data-act]');
      if (!b) { return; }
      var act = b.dataset.act;
      if (act === 'prev') { go(idx - 1); }
      else if (act === 'next') { go(idx + 1); }
      else if (act === 'play') { toggle(); }
      else if (act === 'prompter') { openPrompter(); }
      else if (act === 'cam') { toggleCam(); }
      else if (act === 'exit') { closePresentation(); }
    });
    document.addEventListener('keydown', onKey);
    /* Hide the controls while you are actually recording. */
    var hideTimer = null;
    function poke() {
      overlay.classList.remove('idle');
      clearTimeout(hideTimer);
      hideTimer = setTimeout(function () { overlay.classList.add('idle'); }, 2600);
    }
    overlay.addEventListener('mousemove', poke);
    poke();

    if (prefs.mode === 'two') { applySplitVars(); }
    if (prefs.cam.on) { startCam(); }
    mountCam();
    go(idx, true);
  }

  function applySplitVars() {
    if (!overlay) { return; }
    overlay.style.setProperty('--split-cam-h', prefs.split.camHeight + '%');
    overlay.style.setProperty('--split-cam-w', prefs.split.camWidth + 'vw');
    overlay.classList.toggle('align-left', prefs.split.align === 'left');
  }

  function closePresentation() {
    stop();
    document.removeEventListener('keydown', onKey);
    if (overlay) { overlay.remove(); overlay = null; }
    document.body.classList.remove('st-on');
    mountCam();   /* put the camera tile back on the studio tab */
  }

  /* In the split layout the picture is content, not just a backdrop:
     the brief for this mode is "text and images on the left". Beats that
     carry their own visual keep it; the rest get the career photograph
     as an inset card above the words. */
  function insetFor(b) {
    if ((prefs.mode !== 'two' && prefs.mode !== 'three') || !BCB.media.manifest) { return null; }
    var VISUAL_HEAVY = { radar: 1, columns: 1, scores: 1, categories: 1, scenarios: 1 };
    if (b.kind.indexOf('chart:') === 0 || VISUAL_HEAVY[b.kind]) { return null; }
    var sim = BCB.app.getLast().sim;
    var asset = null;
    if (b.kind === 'brand') { asset = BCB.media.assetFor('intro', 'still'); }
    else if (b.kind === 'outro') { asset = BCB.media.assetFor('outro', 'still'); }
    else if (b.kind === 'title') { asset = BCB.media.assetFor('title', 'still'); }
    else {
      var hs = sim.headStart;
      var which = (b.id === 'headstart' && hs.leader)
        ? (hs.leader === sim.a.name ? sim.a : sim.b)
        : ((idx % 2 === 0) ? sim.a : sim.b);
      asset = BCB.media.assetFor(which.career, 'still');
    }
    if (!asset) { return null; }
    var fig = document.createElement('div');
    fig.className = 'st-inset';
    var img = document.createElement('img');
    img.alt = '';
    img.setAttribute('aria-hidden', 'true');
    img.addEventListener('error', function () { fig.remove(); });
    img.src = asset.src;
    fig.appendChild(img);
    return fig;
  }

  function renderStage() {
    if (!overlay) { return; }
    var b = beat();
    if (!b) { return; }
    overlay.classList.toggle('chart', b.kind.indexOf('chart:') === 0 || b.kind === 'radar');
    overlay.querySelector('#stKick').textContent = b.kicker || '';
    overlay.querySelector('#stTitle').textContent = b.title;
    var host = overlay.querySelector('#stVis');
    host.innerHTML = '';
    var inset = insetFor(b);
    if (inset) { host.appendChild(inset); }
    host.appendChild(visualFor(b));
    overlay.querySelector('#stCount').textContent = (idx + 1) + ' / ' + script.beats.length;
    overlay.querySelector('#stProg').innerHTML = script.beats.map(function (x, i) {
      return '<i class="' + (i < idx ? 'done' : i === idx ? 'now' : '') + '" style="flex:' + x.seconds + '"></i>';
    }).join('');
    overlay.querySelector('[data-act="play"]').textContent = playing ? 'Pause' : 'Play';
    /* The platform-UI guides are a framing aid, not part of the video:
       visible while you are setting up, gone once you are rolling. Scoped
       to Studio Three so the other two stages keep the exact class list
       they had before this mode existed. */
    if (prefs.mode === 'three') { overlay.classList.toggle('guides-on', !playing); }
    paintBackground();
    tickClock();
  }

  /* Which career's imagery belongs behind this beat. Beats that are
     about one side show that side; shared beats alternate so the
     episode does not sit on one picture for seven minutes. */
  function paintBackground() {
    if (!bgLayer || !BCB.media.manifest) { return; }
    var b = beat();
    if (!b) { return; }
    var L = BCB.app.getLast(), sim = L.sim;
    var reduce = global.matchMedia && global.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var asset = null;

    if (b.kind === 'brand') { asset = BCB.media.assetFor('intro', 'clip'); }
    else if (b.kind === 'outro') { asset = BCB.media.assetFor('outro', 'clip'); }
    else if (b.kind === 'title') { asset = BCB.media.assetFor('title', 'clip'); }
    if (!asset) {
      /* Otherwise use whichever career the beat is really about, and
         fall back to alternating between the two. */
      var hs = sim.headStart;
      var which = null;
      if (b.id === 'headstart' && hs.leader) {
        which = hs.leader === sim.a.name ? sim.a : sim.b;
      } else {
        which = (idx % 2 === 0) ? sim.a : sim.b;
      }
      asset = BCB.media.assetFor(which.career, idx % 3 === 0 ? 'clip' : 'still');
      if (!asset) {
        var other = which === sim.a ? sim.b : sim.a;
        asset = BCB.media.assetFor(other.career, 'still');
      }
    }
    BCB.media.setBackground(bgLayer, asset, BCB.media.intensityFor(b.kind), reduce);
  }

  function tickClock() {
    if (!overlay) { return; }
    var el = overlay.querySelector('#stClock');
    if (el) { el.textContent = mmss(remaining); }
    var now = overlay.querySelector('#stProg .now');
    if (now && beat()) {
      var pctDone = 1 - (remaining / beat().seconds);
      now.style.setProperty('--fill', Math.max(0, Math.min(1, pctDone)) * 100 + '%');
    }
  }

  function go(i, force) {
    if (!script) { return; }
    var n = script.beats.length;
    i = Math.max(0, Math.min(n - 1, i));
    if (i === idx && !force) { return; }
    idx = i;
    remaining = beat().seconds;
    renderStage();
    renderPrompter();
    if (playing) { restartTicker(); }
  }

  function restartTicker() {
    clearInterval(ticker);
    ticker = setInterval(function () {
      remaining -= 0.25;
      tickClock();
      scrollPrompter();
      if (remaining <= 0) {
        if (!prefs.autoAdvance) { remaining = 0; return; }
        if (idx < script.beats.length - 1) { go(idx + 1); }
        else { stop(); }
      }
    }, 250);
  }
  function play() {
    if (!script) { return; }
    playing = true;
    if (remaining <= 0) { remaining = beat().seconds; }
    restartTicker();
    renderStage();
    renderPrompter();
  }
  function stop() {
    playing = false;
    clearInterval(ticker);
    ticker = null;
    if (overlay) { overlay.querySelector('[data-act="play"]').textContent = 'Play'; }
    renderPrompter();
  }
  function toggle() { if (playing) { stop(); } else { play(); } }

  function onKey(ev) {
    if (ev.target && /INPUT|TEXTAREA|SELECT/.test(ev.target.tagName)) { return; }
    var k = ev.key;
    if (k === ' ' || k === 'Spacebar') { ev.preventDefault(); toggle(); }
    else if (k === 'ArrowRight' || k === 'PageDown') { ev.preventDefault(); go(idx + 1); }
    else if (k === 'ArrowLeft' || k === 'PageUp') { ev.preventDefault(); go(idx - 1); }
    else if (k === 'Escape') { closePresentation(); }
    else if (k === 'c' || k === 'C') { toggleCam(); }
    else if (k === 'f' || k === 'F') { toggleFullscreen(); }
    else if (k === 'ArrowUp') { ev.preventDefault(); nudgePrompter(-1); }
    else if (k === 'ArrowDown') { ev.preventDefault(); nudgePrompter(1); }
  }
  function toggleFullscreen() {
    if (!document.fullscreenElement) {
      (document.documentElement.requestFullscreen || function () {}).call(document.documentElement);
    } else if (document.exitFullscreen) { document.exitFullscreen(); }
  }

  /* =====================================================================
     WEBCAM
     ===================================================================== */
  var camWrap = null;
  var camPlaceholder = null;
  var camMessage = '';
  function camNode() {
    if (camWrap) { return camWrap; }
    camWrap = document.createElement('div');
    camWrap.className = 'st-cam';
    camWrap.innerHTML = '<video autoplay playsinline muted></video>';
    /* Drag it anywhere - a fixed corner is rarely the right corner. */
    var drag = null;
    camWrap.addEventListener('pointerdown', function (ev) {
      drag = { x: ev.clientX, y: ev.clientY, r: camWrap.getBoundingClientRect() };
      camWrap.setPointerCapture(ev.pointerId);
      camWrap.classList.add('dragging');
    });
    camWrap.addEventListener('pointermove', function (ev) {
      if (!drag) { return; }
      camWrap.style.left = (drag.r.left + ev.clientX - drag.x) + 'px';
      camWrap.style.top = (drag.r.top + ev.clientY - drag.y) + 'px';
      camWrap.style.right = 'auto'; camWrap.style.bottom = 'auto';
    });
    camWrap.addEventListener('pointerup', function () { drag = null; camWrap.classList.remove('dragging'); });
    return camWrap;
  }
  function applyCamStyle() {
    var w = camNode();
    w.className = 'st-cam shape-' + prefs.cam.shape + (prefs.cam.mirror ? ' mirror' : '');
    w.style.width = prefs.cam.size + 'vw';
    if (!w.style.left) {
      w.style.right = '2.4vw'; w.style.bottom = '2.4vw';
      w.style.left = ''; w.style.top = '';
    }
  }
  /* A framed stand-in exactly where the real picture will sit, so the
     layout can be judged - and rehearsed - before the camera is on. */
  function placeholderNode() {
    if (camPlaceholder) { return camPlaceholder; }
    camPlaceholder = document.createElement('div');
    camPlaceholder.className = 'st-cam st-cam-ghost';
    camPlaceholder.innerHTML =
      '<svg viewBox="0 0 160 90" preserveAspectRatio="xMidYMid slice" aria-hidden="true">' +
      '<rect width="160" height="90" fill="none"></rect>' +
      '<circle cx="80" cy="38" r="15" fill="currentColor" opacity=".38"></circle>' +
      '<path d="M52 84c0-16 12.5-25 28-25s28 9 28 25z" fill="currentColor" opacity=".38"></path>' +
      '</svg><span>Your camera</span>';
    return camPlaceholder;
  }
  function mountCam() {
    var w = camNode();
    applyCamStyle();
    var ghost = placeholderNode();
    if (ghost.parentNode) { ghost.remove(); }
    if (!prefs.cam.on) {
      if (w.parentNode) { w.remove(); }
      /* Show the stand-in on the stage, and in the studio tab's tile. */
      if (prefs.cam.placeholder) {
        var col = overlay && overlay.querySelector('#stCamCol');
        var gHost = col || overlay || document.getElementById('camHost');
        if (gHost) {
          gHost.appendChild(ghost);
          ghost.className = 'st-cam st-cam-ghost' + (col ? ' in-col' : ' shape-' + prefs.cam.shape);
          if (col) {
            /* The column sizes it; clear anything the floating mode set. */
            ghost.style.cssText = '';
          } else if (overlay) {
            ghost.style.position = 'fixed';
            ghost.style.width = prefs.cam.size + 'vw';
            ghost.style.right = '2.4vw'; ghost.style.bottom = '2.4vw';
            ghost.style.left = ''; ghost.style.top = '';
          } else {
            ghost.style.position = 'relative';
            ghost.style.width = '100%';
            ghost.style.right = ghost.style.bottom = ghost.style.left = ghost.style.top = '';
          }
        }
      }
      return;
    }
    var col = overlay && overlay.querySelector('#stCamCol');
    var host = col || overlay || document.getElementById('camHost');
    if (host && w.parentNode !== host) { host.appendChild(w); }
    if (col) {
      /* Filling the column is the whole point of this layout, so the
         camera is not draggable here - the column places it. */
      w.className = 'st-cam in-col' + (prefs.cam.mirror ? ' mirror' : '');
      w.style.cssText = '';
    } else if (!overlay) {
      w.style.position = 'relative'; w.style.left = w.style.top = w.style.right = w.style.bottom = '';
      w.style.width = '100%';
    } else {
      w.style.position = 'fixed';
    }
  }
  function setCamMessage(text) {
    camMessage = text;
    var note = document.getElementById('camNote');
    if (note) { note.textContent = text; }
  }
  function startCam() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setCamMessage('This browser will not give a page camera access here.');
      prefs.cam.on = false; renderStudio(); return;
    }
    var constraints = { audio: false, video: { width: { ideal: 1280 }, height: { ideal: 720 } } };
    if (prefs.cam.deviceId) { constraints.video.deviceId = { exact: prefs.cam.deviceId }; }
    navigator.mediaDevices.getUserMedia(constraints).then(function (stream) {
      camStream = stream;
      prefs.cam.on = true;
      camNode().querySelector('video').srcObject = stream;
      mountCam();
      savePrefs();
      camMessage = 'Camera on. Drag the picture to move it anywhere on the slide.';
      listCams();
      renderStudio();
    }).catch(function (err) {
      prefs.cam.on = false;
      camMessage = err && err.name === 'NotAllowedError'
        ? 'Camera blocked. Allow it for this page - or open the local copy of the file, since a page embedded in another site is usually refused the camera outright.'
        : 'No camera available: ' + (err && err.name ? err.name : 'unknown error') + '.';
      renderStudio();
    });
  }
  function stopCam() {
    if (camStream) { camStream.getTracks().forEach(function (t) { t.stop(); }); camStream = null; }
    prefs.cam.on = false;
    if (camWrap && camWrap.parentNode) { camWrap.remove(); }
    camMessage = '';
    savePrefs();
    renderStudio();
  }
  function toggleCam() { if (prefs.cam.on) { stopCam(); } else { startCam(); } }
  function listCams() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) { return; }
    navigator.mediaDevices.enumerateDevices().then(function (list) {
      var sel = document.getElementById('camDevice');
      if (!sel) { return; }
      var cams = list.filter(function (d) { return d.kind === 'videoinput'; });
      if (!cams.length) { return; }
      sel.innerHTML = cams.map(function (d, i) {
        return '<option value="' + esc(d.deviceId) + '"' + (d.deviceId === prefs.cam.deviceId ? ' selected' : '') +
          '>' + esc(d.label || ('Camera ' + (i + 1))) + '</option>';
      }).join('');
    }).catch(function () { /* labels need permission; not fatal */ });
  }

  /* =====================================================================
     PROMPTER
     A separate window, so it is not inside what you capture. Its reading
     line sits near the TOP of the window: on a monitor with the webcam
     above it, that puts your eyeline as close to the lens as the layout
     allows, which is the whole difference between "reading" and "talking
     to camera".
     ===================================================================== */
  function prompterMarkup() {
    return '<!DOCTYPE html><html><head><meta charset="utf-8"><title>Prompter - The 20-Year Test</title>' +
      '<style>' +
      ':root{color-scheme:dark;--bg:#08090a;--ink:#f6f5f2;--dim:#5d6066;--live:#ffffff;--accent:#eb6834;--rule:#22252a}' +
      '*{margin:0;padding:0;box-sizing:border-box}' +
      'body{background:var(--bg);color:var(--ink);font:16px system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;' +
        'height:100vh;overflow:hidden;display:flex;flex-direction:column}' +
      '.bar{display:flex;align-items:center;gap:14px;padding:8px 14px;border-bottom:1px solid var(--rule);' +
        'font-size:12px;color:var(--dim);flex:none}' +
      '.bar strong{color:var(--ink);font-size:13px}' +
      '.bar .sp{margin-left:auto}' +
      '.bar button{background:#16181b;color:var(--ink);border:1px solid var(--rule);border-radius:5px;' +
        'padding:4px 10px;font:inherit;font-size:12px;cursor:pointer}' +
      '.bar button:hover{border-color:var(--dim)}' +
      '.eyeline{position:fixed;left:0;right:0;z-index:5;border-bottom:1px dashed #2a2e34;height:0;' +
        'pointer-events:none;transition:border-color .3s}' +
      'body.aligning .eyeline{border-bottom-color:#4a5058}' +
      '.eyeline span{position:absolute;left:50%;top:-9px;transform:translateX(-50%);background:var(--bg);' +
        'padding:0 10px;font-size:10.5px;letter-spacing:.14em;text-transform:uppercase;color:var(--accent);' +
        'white-space:nowrap;opacity:0;transition:opacity .3s}' +
      'body.aligning .eyeline span{opacity:1}' +
      '.stage{flex:1;overflow:hidden;position:relative}' +
      '.scroll{position:absolute;left:0;right:0;will-change:transform}' +
      '.col{margin:0 auto;padding:0 24px}' +
      'p{margin:0 0 .55em;color:var(--dim);transition:color .18s}' +
      'p.live{color:var(--live)}' +
      'p.past{color:#3a3d43}' +
      '.beat{margin:0 0 .3em;font-size:.42em;letter-spacing:.12em;text-transform:uppercase;color:var(--accent)}' +
      '.mirror .scroll{transform-origin:center;}' +
      'body.mirror .stage{transform:scaleX(-1)}' +
      '.foot{flex:none;border-top:1px solid var(--rule);padding:7px 14px;font-size:11.5px;color:var(--dim);' +
        'display:flex;gap:16px;align-items:center}' +
      '.foot .keys{margin-left:auto}' +
      '</style></head><body>' +
      '<div class="bar"><strong id="pBeat">-</strong><span id="pPos"></span>' +
        '<span class="sp"></span>' +
        '<button data-p="prev">&larr;</button>' +
        '<button data-p="play">Play</button>' +
        '<button data-p="next">&rarr;</button>' +
        '<button data-p="smaller">A-</button><button data-p="bigger">A+</button>' +
        '<button data-p="up">Higher</button><button data-p="down">Lower</button>' +
        '<button data-p="mirror">Mirror</button></div>' +
      '<div class="eyeline" id="pEye"><span>&uarr; line up this mark under your webcam &uarr;</span></div>' +
      '<div class="stage" id="pStage"><div class="scroll" id="pScroll"><div class="col" id="pCol"></div></div></div>' +
      '<div class="foot"><span id="pClock">0:00</span><span id="pHint">Put this window on the half of the screen under your camera.</span>' +
      '<span class="keys">space play &middot; &larr; &rarr; beat &middot; &uarr; &darr; reading line</span></div>' +
      '</body></html>';
  }

  function openPrompter() {
    if (!build()) { return; }
    var note = document.getElementById('prompterNote');
    try {
      promptWin = global.open('', 'bcbPrompter', 'width=820,height=1000');
    } catch (e) { promptWin = null; }
    if (!promptWin) {
      if (note) {
        note.textContent = 'The browser blocked the pop-out. Allow pop-ups for this page - or, if you are viewing a hosted copy, ' +
          'open the local file instead: an embedded page cannot open windows.';
      }
      return;
    }
    promptWin.document.open();
    promptWin.document.write(prompterMarkup());
    promptWin.document.close();
    /* Same-origin child window, so the DOM is directly reachable - no
       message channel to keep alive and nothing to fall out of sync. */
    promptWin.addEventListener('keydown', function (ev) {
      var k = ev.key;
      if (k === ' ') { ev.preventDefault(); toggle(); }
      else if (k === 'ArrowRight') { ev.preventDefault(); go(idx + 1); }
      else if (k === 'ArrowLeft') { ev.preventDefault(); go(idx - 1); }
      else if (k === 'ArrowUp') { ev.preventDefault(); nudgePrompter(-1); }
      else if (k === 'ArrowDown') { ev.preventDefault(); nudgePrompter(1); }
    });
    promptWin.document.addEventListener('click', function (ev) {
      var b = ev.target.closest('[data-p]');
      if (!b) { return; }
      var p = b.dataset.p;
      if (p === 'prev') { go(idx - 1); }
      else if (p === 'next') { go(idx + 1); }
      else if (p === 'play') { toggle(); }
      else if (p === 'bigger') { prefs.prompter.fontSize = Math.min(72, prefs.prompter.fontSize + 3); }
      else if (p === 'smaller') { prefs.prompter.fontSize = Math.max(16, prefs.prompter.fontSize - 3); }
      else if (p === 'up') { nudgePrompter(-1); }
      else if (p === 'down') { nudgePrompter(1); }
      else if (p === 'mirror') { prefs.prompter.mirror = !prefs.prompter.mirror; }
      savePrefs(); renderPrompter(); renderStudio();
    });
    promptWin.addEventListener('beforeunload', function () { promptWin = null; });
    if (note) { note.textContent = 'Prompter open. Drag it onto the half of the screen below your camera.'; }
    renderPrompter();
  }
  function nudgePrompter(dir) {
    prefs.prompter.readingLine = Math.max(6, Math.min(60, prefs.prompter.readingLine + dir * 3));
    savePrefs(); renderPrompter(); renderStudio();
  }

  function renderPrompter() {
    if (!promptWin || promptWin.closed) { promptWin = null; return; }
    var d = promptWin.document;
    var col = d.getElementById('pCol');
    if (!col) { return; }
    var P = prefs.prompter;
    var b = beat();
    d.body.classList.toggle('mirror', !!P.mirror);
    /* Caption on while you are setting up, off once you are rolling. */
    d.body.classList.toggle('aligning', !playing);
    d.getElementById('pEye').style.top = P.readingLine + 'vh';
    d.getElementById('pBeat').textContent = b ? b.title : '-';
    d.getElementById('pPos').textContent = script ? (idx + 1) + ' / ' + script.beats.length : '';
    d.getElementById('pClock').textContent = mmss(remaining) + (playing ? '' : '  (paused)');
    d.querySelector('[data-p="play"]').textContent = playing ? 'Pause' : 'Play';
    col.style.font = P.fontSize + 'px/' + P.lineHeight + ' system-ui,-apple-system,"Segoe UI",Roboto,sans-serif';
    col.style.maxWidth = P.width + 'em';
    if (!b) { col.innerHTML = ''; return; }
    col.innerHTML = '<div class="beat">' + esc(b.kicker || b.title) + '</div>' +
      b.lines.map(function (l, i) { return '<p data-i="' + i + '">' + esc(l) + '</p>'; }).join('');
    scrollPrompter(true);
  }

  /* Scroll so the line being spoken sits on the reading mark. Paced from
     the beat's own clock, so the words arrive when the slide does. */
  function scrollPrompter(reset) {
    if (!promptWin || promptWin.closed) { return; }
    var d = promptWin.document, b = beat();
    if (!b) { return; }
    var ps = d.querySelectorAll('#pCol p');
    if (!ps.length) { return; }
    var done = 1 - (remaining / b.seconds);
    done = Math.max(0, Math.min(1, done));
    /* Weight each line by its length so a long sentence gets its time. */
    var lens = b.lines.map(function (l) { return Math.max(4, l.split(/\s+/).length); });
    var total = lens.reduce(function (t, x) { return t + x; }, 0);
    var acc = 0, live = 0, within = 0;
    for (var i = 0; i < lens.length; i++) {
      var share = lens[i] / total;
      if (done <= acc + share || i === lens.length - 1) { live = i; within = share ? (done - acc) / share : 0; break; }
      acc += share;
    }
    for (var j = 0; j < ps.length; j++) {
      ps[j].className = j < live ? 'past' : (j === live ? 'live' : '');
    }
    var el = ps[live];
    var top = el.offsetTop + el.offsetHeight * Math.max(0, Math.min(1, within));
    /* The scroller is positioned inside the stage, so the mark has to be
       expressed in the stage's coordinates - measuring it from the top of
       the window leaves every line sitting a toolbar's height too low,
       which is exactly the eyeline this feature exists to fix. */
    var stage = d.getElementById('pStage');
    var stageTop = stage.getBoundingClientRect().top;
    var mark = promptWin.innerHeight * (prefs.prompter.readingLine / 100) - stageTop;
    var y = mark - top - el.offsetHeight * 0.32;
    var sc = d.getElementById('pScroll');
    sc.style.transition = reset ? 'none' : 'transform .25s linear';
    sc.style.transform = 'translateY(' + y + 'px)';
  }

  /* =====================================================================
     THE STUDIO TAB
     ===================================================================== */
  function renderStudio() {
    var host = document.getElementById('studioBody');
    if (!host) { return; }
    if (!build()) { host.innerHTML = '<div class="card"><p>Run a comparison first.</p></div>'; return; }
    var P = prefs.prompter, cam = prefs.cam;
    var mins = Math.floor(script.totalSeconds / 60), secs = script.totalSeconds % 60;

    host.innerHTML =
      '<div class="card"><h2>Recording studio</h2>' +
      '<p class="sub">Slides in this window, script in a second window, camera over the top. Built for one wide ' +
      'screen split in two.</p>' +
      '<div class="tiles" style="margin-bottom:16px">' +
        '<div class="tile"><div class="k">Beats</div><div class="v">' + script.beats.length + '</div></div>' +
        '<div class="tile"><div class="k">Estimated runtime</div><div class="v">' + mins + 'm ' + secs + 's</div>' +
          '<div class="n">at about 155 words a minute</div></div>' +
        '<div class="tile"><div class="k">Comparison</div><div class="v" style="font-size:1.05rem">' +
          esc(BCB.app.getLast().sim.a.name) + ' vs ' + esc(BCB.app.getLast().sim.b.name) + '</div></div>' +
      '</div>' +
      '<div class="st-modes">' +
        [['one', 'Studio One - full frame',
          'Slides fill the screen, camera floats in a corner. Best when the numbers are the story.'],
         ['two', 'Studio Two - explainer and camera',
          'Explainer column on the left for text and images, you on the right at full height. Best when you are the story.'],
         ['three', 'Studio Three - vertical',
          'You on top, explainer underneath, composed inside a 9:16 frame for Reels, TikTok and Shorts.']]
        .map(function (m) {
          return '<button class="st-mode' + (prefs.mode === m[0] ? ' on' : '') + '" data-mode="' + m[0] + '">' +
            '<span class="k">' + esc(m[1]) + '</span><span class="d">' + esc(m[2]) + '</span>' +
            '<span class="dia dia-' + m[0] + '" aria-hidden="true"></span></button>';
        }).join('') +
      '</div>' +
      '<div class="field-inline" style="flex-wrap:wrap;gap:8px">' +
        '<button class="btn" data-st="stage">Start presenting</button>' +
        '<button class="btn btn-o" data-st="prompter">Open prompter window</button>' +
        '<button class="btn btn-o" data-st="cam">' + (cam.on ? 'Turn camera off' : 'Turn camera on') + '</button>' +
      '</div>' +
      '<p class="hint" id="prompterNote" style="margin-top:8px;color:var(--muted);font-size:.8rem"></p>' +
      (prefs.mode === 'two'
        ? '<div class="field-row" style="margin-top:14px">' +
          '<div class="field"><label for="sCamH">Camera height</label>' +
          '<input type="number" id="sCamH" min="30" max="100" step="2" value="' + prefs.split.camHeight + '">' +
          '<div class="hint">% of the frame. 100 fills the column edge to edge; ' +
          'lower floats it as a card.</div></div>' +
          '<div class="field"><label for="sCamW">Camera width</label>' +
          '<input type="number" id="sCamW" min="14" max="45" step="1" value="' + prefs.split.camWidth + '">' +
          '<div class="hint">% of the window width.</div></div>' +
          '<div class="field"><label for="sAlign">Explainer text</label><select id="sAlign">' +
            [['center', 'Centred'], ['left', 'Left-aligned']].map(function (o) {
              return '<option value="' + o[0] + '"' + (prefs.split.align === o[0] ? ' selected' : '') +
                '>' + o[1] + '</option>'; }).join('') +
          '</select></div></div>'
        : '') +
      (prefs.mode === 'three'
        ? '<div class="field-row" style="margin-top:14px">' +
          '<div class="field"><label for="vRatio">Frame</label><select id="vRatio">' +
            [['9:16', '9:16 - Reels, TikTok, Shorts'], ['4:5', '4:5 - Instagram feed'], ['1:1', '1:1 - square']]
            .map(function (r) {
              return '<option value="' + r[0] + '"' + (prefs.vertical.ratio === r[0] ? ' selected' : '') +
                '>' + esc(r[1]) + '</option>'; }).join('') +
          '</select><div class="hint">Everything outside the frame is not in the video. ' +
          'Capture the frame, not the window.</div></div>' +
          '<div class="field"><div class="field-inline" style="margin-top:22px">' +
          '<input type="checkbox" id="vSafe"' + (prefs.vertical.safeGuides ? ' checked' : '') +
          '><label for="vSafe" style="margin:0">Show where platform UI covers the frame</label></div>' +
          '<div class="hint">Captions, buttons and the handle sit over the bottom and right edges. ' +
          'The guides disappear once you press play.</div></div></div>'
        : '') +
      '</div>' +

      '<div class="callout"><strong>Setting it up on one wide screen.</strong> Put the slide window on the half ' +
      'of the screen you are capturing, and the prompter window on the other half - the half your webcam sits above. ' +
      'Then raise the prompter’s reading line until the dashed mark sits just under the lens. Your eyes land on the ' +
      'text and the camera sees you looking at it, which is as close to eye contact as a prompter gets.</div>' +

      '<div class="grid2">' +
      '<div class="card"><h3>Prompter</h3><p class="sub">These apply to the pop-out window.</p>' +
        field('Reading line height', 'readingLine', P.readingLine, 6, 60, 3, '% from the top of the window. Lower number = higher on screen = closer to the lens.') +
        field('Text size', 'fontSize', P.fontSize, 16, 72, 2, 'px') +
        field('Column width', 'width', P.width, 14, 46, 2, 'em. Narrow keeps your eyes from tracking side to side.') +
        field('Line spacing', 'lineHeight', P.lineHeight, 1.1, 2.2, 0.05, '') +
        '<div class="field"><div class="field-inline"><input type="checkbox" id="pMirror"' + (P.mirror ? ' checked' : '') +
          '><label for="pMirror" style="margin:0">Mirror the text (for prompter glass)</label></div></div>' +
        '<div class="field"><div class="field-inline"><input type="checkbox" id="stAuto"' + (prefs.autoAdvance ? ' checked' : '') +
          '><label for="stAuto" style="margin:0">Advance beats automatically</label></div>' +
          '<div class="hint">Arrow keys and space always override the timer.</div></div>' +
      '</div>' +

      '<div class="card"><h3>Camera</h3><p class="sub">Picture-in-picture over the slides, so one capture gets both.</p>' +
        '<div id="camHost" class="st-camhost"></div>' +
        '<p class="hint" id="camNote" style="color:var(--muted);font-size:.8rem;margin:8px 0">' + esc(camMessage) + '</p>' +
        '<div class="field"><label for="camDevice">Camera</label><select id="camDevice"><option>Default camera</option></select></div>' +
        field('Size on screen', 'camSize', cam.size, 10, 40, 1, '% of the window width') +
        '<div class="field"><label for="camShape">Shape</label><select id="camShape">' +
          ['rounded', 'circle', 'square'].map(function (s) {
            return '<option value="' + s + '"' + (cam.shape === s ? ' selected' : '') + '>' + s + '</option>'; }).join('') +
        '</select></div>' +
        '<div class="field"><div class="field-inline"><input type="checkbox" id="camGhost"' + (cam.placeholder ? ' checked' : '') +
          '><label for="camGhost" style="margin:0">Show a placeholder when the camera is off</label></div>' +
          '<div class="hint">Marks exactly where the picture will sit, so you can rehearse the layout.</div></div>' +
        '<div class="field"><div class="field-inline"><input type="checkbox" id="camMirror"' + (cam.mirror ? ' checked' : '') +
          '><label for="camMirror" style="margin:0">Mirror the picture</label></div>' +
          '<div class="hint">Mirrored looks natural to you; unmirrored is what a viewer expects if there is text behind you.</div></div>' +
      '</div></div>' +

      '<div class="card"><h2>The script</h2>' +
      '<p class="sub">Generated from this comparison. Edit any line - the prompter and the timings follow what you type.</p>' +
      script.beats.map(function (b, i) {
        return '<details class="fieldset"' + (i === 0 ? ' open' : '') + '><summary>' + (i + 1) + '. ' + esc(b.title) +
          ' <span style="color:var(--faint);font-weight:400">' + b.seconds + 's</span></summary>' +
          '<textarea data-beat="' + i + '" rows="' + Math.max(3, b.lines.length + 1) + '" ' +
          'style="width:100%;font:inherit;font-size:.9rem;padding:9px;border:1px solid var(--line);border-radius:5px;' +
          'background:var(--surface-1);color:var(--text)">' + esc(b.lines.join('\n')) + '</textarea>' +
          '<div class="hint">One line per sentence. Blank lines are ignored.</div></details>';
      }).join('') +
      '<button class="btn btn-o btn-sm" data-st="regen" style="margin-top:10px">Regenerate from the numbers</button>' +
      '<span class="hint" style="margin-left:10px;color:var(--muted)">Discards your edits.</span>' +
      '</div>' +

      '<div class="card"><h3>Keys while presenting</h3>' +
      '<div class="cats">' +
      [['Space', 'play / pause'], ['&larr; &rarr;', 'previous / next beat'], ['&uarr; &darr;', 'prompter reading line'],
       ['C', 'camera on / off'], ['F', 'fullscreen'], ['Esc', 'leave the stage']]
      .map(function (k) { return '<div class="cat"><span>' + k[0] + '</span><span class="who">' + k[1] + '</span></div>'; }).join('') +
      '</div></div>';

    mountCam();
    listCams();
  }

  function field(label, key, val, min, max, step, hint) {
    return '<div class="field"><label for="st-' + key + '">' + esc(label) + '</label>' +
      '<input type="number" id="st-' + key + '" data-pref="' + key + '" value="' + val + '" min="' + min +
      '" max="' + max + '" step="' + step + '">' +
      (hint ? '<div class="hint">' + esc(hint) + '</div>' : '') + '</div>';
  }

  function onStudioEvent(ev) {
    var t = ev.target;
    var modeBtn = t.closest && t.closest('[data-mode]');
    if (modeBtn && ev.type === 'click') {
      prefs.mode = modeBtn.dataset.mode;
      savePrefs();
      renderStudio();
      return;
    }
    var btn = t.closest && t.closest('[data-st]');
    if (btn && ev.type === 'click') {
      var act = btn.dataset.st;
      if (act === 'stage') { openPresentation(); }
      else if (btn.dataset.mode) { /* handled below */ }
      else if (act === 'prompter') { openPrompter(); }
      else if (act === 'cam') { toggleCam(); }
      else if (act === 'regen') { script = null; build(); renderStudio(); renderPrompter(); }
      return;
    }
    if (t.dataset && t.dataset.pref) {
      var v = parseFloat(t.value);
      if (!isFinite(v)) { return; }
      if (t.dataset.pref === 'camSize') { prefs.cam.size = v; applyCamStyle(); }
      else { prefs.prompter[t.dataset.pref] = v; renderPrompter(); }
      savePrefs();
      return;
    }
    if (t.id === 'sCamH') { prefs.split.camHeight = parseFloat(t.value) || 62; savePrefs(); applySplitVars(); }
    else if (t.id === 'sCamW') { prefs.split.camWidth = parseFloat(t.value) || 26; savePrefs(); applySplitVars(); }
    else if (t.id === 'sAlign') { prefs.split.align = t.value; savePrefs(); applySplitVars(); }
    else if (t.id === 'vRatio') { prefs.vertical.ratio = t.value; savePrefs(); renderStudio(); }
    else if (t.id === 'vSafe') { prefs.vertical.safeGuides = t.checked; savePrefs(); }
    else if (t.id === 'camGhost') { prefs.cam.placeholder = t.checked; savePrefs(); mountCam(); }
    else if (t.id === 'pMirror') { prefs.prompter.mirror = t.checked; savePrefs(); renderPrompter(); }
    else if (t.id === 'stAuto') { prefs.autoAdvance = t.checked; savePrefs(); }
    else if (t.id === 'camMirror') { prefs.cam.mirror = t.checked; savePrefs(); applyCamStyle(); }
    else if (t.id === 'camShape') { prefs.cam.shape = t.value; savePrefs(); applyCamStyle(); }
    else if (t.id === 'camDevice') {
      prefs.cam.deviceId = t.value; savePrefs();
      if (prefs.cam.on) { stopCam(); prefs.cam.on = true; startCam(); }
    } else if (t.dataset && t.dataset.beat != null) {
      var b = script.beats[+t.dataset.beat];
      b.lines = t.value.split('\n').map(function (l) { return l.trim(); }).filter(Boolean);
      b.seconds = Math.max(8, Math.round(b.lines.join(' ').split(/\s+/).filter(Boolean).length / 2.58) + 2);
      renderPrompter();
    }
  }

  function init() {
    document.addEventListener('click', onStudioEvent);
    document.addEventListener('input', onStudioEvent);
    document.addEventListener('change', onStudioEvent);
    renderStudio();
  }

  BCB.studio = {
    init: init,
    refresh: function () {
      /* A changed comparison means a changed script, unless the user is
         mid-take - interrupting a recording to rewrite the prompter
         would be worse than a slightly stale line. */
      if (!playing) { script = null; renderStudio(); renderPrompter(); }
    }
  };

  if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', init); }
  else { init(); }

})(typeof window !== 'undefined' ? window : globalThis);
