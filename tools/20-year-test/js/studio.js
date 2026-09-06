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
  var featureLayer = null;
  var ctaLayer = null;     /* the like / subscribe / bell card */
  var mediaIdx = 0;        /* which of the slide's pictures is showing */
  var bgCycles = false;    /* the background is playing that same list */
  var recDeclined = false;    /* they cancelled the share picker: Space plays without recording */
  var armingRec = false;
  var recTimer = null;
  var recMessage = '';
  var recAlarm = '';       /* a capture that stopped sending pictures */
  var recTest = null;      /* the result of the five second check */

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
    split: { camHeight: 62, camWidth: 26, align: 'center' },
    /* Per-slide layout overrides, keyed by beat id, so a format
       decision made once holds for every episode. */
    beatOpts: {},
    /* How long one picture, and one clip, hold the screen before the
       next takes over. A slide's list repeats until its script is read. */
    media: { imageHold: 5, clipHold: 10, fillInset: 5 }
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
      if (p.beatOpts) { prefs.beatOpts = p.beatOpts; }
      if (p.media) { Object.assign(prefs.media, p.media); }
      /* The single layout dropdown this replaced bundled three separate
         choices into one. Unpack an older setting rather than losing it. */
      if (p.beatLayout) {
        var MIG = { full: { fg: 'fill', cam: 'off' }, fullcam: { fg: 'fill', cam: 'on' }, media: { fg: 'main' } };
        Object.keys(p.beatLayout).forEach(function (k) {
          var m = MIG[p.beatLayout[k]];
          if (m && !prefs.beatOpts[k]) { prefs.beatOpts[k] = Object.assign({}, m); }
        });
      }
      prefs.cam.wanted = !!(p.cam && (p.cam.wanted || p.cam.on));
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
      var rWin = L.scores.netWorthWinner;
      if (Math.abs(cGap) < 1000) {
        N.setScenarioNote('it\'s a dead heat');
      } else if (rWin && cWin !== rWin) {
        N.setScenarioNote('it flips. ' + cWin + ' comes out ahead, by ' + N.say(Math.abs(cGap)));
      } else {
        N.setScenarioNote(cWin + ' is still ahead, but by ' + N.say(Math.abs(cGap)) +
          ' instead of ' + N.say(rGap));
      }
    }
    script = N.episodeScript(L.sim, L.scores, BCB.app.getState().scriptSeed || 0);
    if (idx >= script.beats.length) { idx = 0; }
    return script;
  }

  function beat() { return script ? script.beats[idx] : null; }

  /* =====================================================================
     PER-SLIDE LAYOUT
     A slide can hand its whole frame to the picture or clip pinned to
     it, with or without the camera over the top. Every one of these
     layouts is about that pinned media, so a slide without any falls
     back to the studio's normal layout rather than cutting to black.
     ===================================================================== */
  function optsFor(b) { return (b && prefs.beatOpts[b.id]) || {}; }

  /* Where this slide's own picture plays. Every setting here is about
     that picture, so a slide without one falls back to the studio's
     normal layout rather than cutting to black. */
  function fgFor(b) {
    var v = optsFor(b).fg || '';
    if (!v || v === 'none') { return v; }
    return BCB.media.beatAsset(b.id) ? v : '';
  }
  function bgFor(b) { return optsFor(b).bg || ''; }
  function camFor(b) {
    var v = optsFor(b).cam;
    if (v) { return v; }
    /* A picture filling the frame is the whole slide, so the camera sits
       it out unless you ask for it back. */
    return fgFor(b) === 'fill' ? 'off' : '';
  }

  var SLIDE_OPTS = [
    ['cam', 'Camera', [['', 'Default'], ['on', 'Show it'], ['off', 'Hide it']]],
    ['bg', 'Background', [['', 'Default'], ['career', 'Career picture'], ['none', 'Plain, no picture']]],
    ['fg', 'This slide\u2019s picture', [['', 'Default'], ['card', 'Above the words'],
      ['main', 'Instead of the chart'], ['fill', 'Fills the frame'], ['none', 'Not shown']]]
  ];

  /* =====================================================================
     LIKE, SUBSCRIBE, BELL
     A card that rides over whatever is on screen for five seconds and
     leaves again, so the ask can land in the middle of a sentence
     without taking a slide away from the numbers. Built from the same
     parts as the ladder on the intro card - condensed caps in bordered
     rungs, the one that matters filled orange - so it reads as the same
     show rather than a stock YouTube sticker.
     ===================================================================== */
  var CTA_SECONDS = 5;
  var CTA_ICONS = {
    like: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2.5 10.5h3.8V21H2.5z"/>' +
      '<path d="M7.3 10.2 12 2.4c1.7.1 2.6 1.2 2.2 2.9l-.8 3.3h6.4c1.3 0 2.1 1 1.9 2.3l-1.6 8c-.2 1.1-1.1 1.9-2.2 1.9H7.3z"/></svg>',
    sub: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8.6 5.4 19 12 8.6 18.6z"/></svg>',
    bell: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.2a6.2 6.2 0 0 0-6.2 6.2v3.9L3.6 16v1.1h16.8V16l-2.2-3.7V8.4A6.2 6.2 0 0 0 12 2.2z"/>' +
      '<path d="M9.4 18.6a2.6 2.6 0 0 0 5.2 0z"/></svg>'
  };
  function buildCta() {
    var el = document.createElement('div');
    el.className = 'st-cta';
    el.innerHTML =
      '<div class="st-cta-plate">' +
        '<span class="st-cta-chip" style="--i:0">' + CTA_ICONS.like + '<b>Like</b></span>' +
        '<span class="st-cta-chip go" style="--i:1">' + CTA_ICONS.sub + '<b>Subscribe</b></span>' +
        '<span class="st-cta-chip ring" style="--i:2">' + CTA_ICONS.bell + '<b>Bell</b></span>' +
      '</div>' +
      '<div class="st-cta-tag">A new matchup every episode</div>';
    return el;
  }
  /* On screen from the second it is placed at, for five seconds. Driven
     by the beat's own clock, so it lands in the same place on every take
     and in the recording. */
  function tickCta() {
    if (!ctaLayer || !script) { return; }
    var b = beat();
    if (!b) { ctaLayer.classList.remove('on'); return; }
    var o = optsFor(b);
    if (!o.cta) { ctaLayer.classList.remove('on'); return; }
    var elapsed = Math.max(0, b.seconds - remaining);
    var at = Math.max(0, +o.ctaAt || 0);
    ctaLayer.classList.toggle('on', elapsed >= at && elapsed < at + CTA_SECONDS);
  }

  /* One picture or clip. */
  function mediaNode(asset) {
    var el;
    if (asset.kind === 'clip') {
      el = document.createElement('video');
      el.muted = true; el.loop = true; el.playsInline = true; el.autoplay = true;
    } else {
      el = document.createElement('img');
      el.alt = '';
    }
    el.setAttribute('aria-hidden', 'true');
    el.src = asset.src;
    if (el.play) {
      var pr = el.play();
      if (pr && pr.catch) { pr.catch(function () { /* autoplay refusal is not a failure */ }); }
    }
    return el;
  }

  /* A place on the slide where pictures play, with two slots so one can
     fade up as the last fades out. The host carries the size, so a
     picture of a different shape never makes the words jump. */
  function mediaHost(kind) {
    var host = document.createElement('div');
    host.className = 'st-mediahost as-' + kind;
    host.innerHTML = '<div class="st-mediaslot"></div><div class="st-mediaslot"></div>';
    host.dataset.slot = 'b';
    return host;
  }
  function showInHost(host, asset) {
    if (!host || !asset) { return; }
    if (host.dataset.src === asset.src) { return; }
    host.dataset.src = asset.src;
    var slots = host.querySelectorAll('.st-mediaslot');
    var next = host.dataset.slot === 'a' ? 1 : 0;
    host.dataset.slot = next ? 'b' : 'a';
    var incoming = slots[next], outgoing = slots[next ? 0 : 1];
    /* This slot last held the picture from two swaps ago. Emptying it
       properly is what keeps the number of live clips at two per place
       rather than one for every swap in the episode. */
    BCB.media.release(incoming);
    incoming.innerHTML = '';
    var el = mediaNode(asset);
    /* A picture that never arrives - a dead link, no network - must not
       leave an empty bordered frame sitting on the slide. Fall back to
       whatever was showing, or take the frame away. */
    el.addEventListener('error', function () {
      incoming.classList.remove('on');
      if (outgoing.firstChild) { outgoing.classList.add('on'); }
      else { host.classList.add('empty'); }
    });
    var arrived = function () { host.classList.remove('empty'); };
    el.addEventListener('load', arrived);
    el.addEventListener('loadeddata', arrived);
    incoming.appendChild(el);
    incoming.classList.add('on');
    outgoing.classList.remove('on');
    if (host.__fade) { clearTimeout(host.__fade); }
    host.__fade = setTimeout(function () {
      if (!outgoing.classList.contains('on')) { BCB.media.pauseMedia(outgoing); }
    }, 700);
  }

  /* How long each item in a slide's list holds the screen. */
  function holdFor(asset) {
    var h = asset.kind === 'clip' ? (prefs.media.clipHold || 10) : (prefs.media.imageHold || 5);
    /* A hold of zero would leave the schedule below stepping through
       time without ever advancing. */
    return Math.max(1, h);
  }
  /* Which item should be showing this far into the slide. The list
     repeats, so a short list still covers a long section. */
  function mediaIndexAt(list, elapsed) {
    if (list.length < 2) { return 0; }
    var t = 0, i = 0;
    while (i < 500) {
      t += holdFor(list[i % list.length]);
      if (elapsed < t) { return i % list.length; }
      i++;
    }
    return 0;
  }
  function beatCoverage(list) {
    return list.reduce(function (t, a) { return t + holdFor(a); }, 0);
  }

  /* Walk every place on this slide that plays pictures on to the item
     the clock has reached. Only the picture changes; the chart, the
     headline and the numbers are left alone. */
  function cycleMedia() {
    if (!overlay || !script) { return; }
    var b = beat();
    if (!b) { return; }
    var list = BCB.media.beatAssets(b.id);
    if (list.length < 2) { return; }
    var i = mediaIndexAt(list, Math.max(0, b.seconds - remaining));
    if (i === mediaIdx) { return; }
    mediaIdx = i;
    Array.prototype.forEach.call(overlay.querySelectorAll('.st-mediahost[data-cycles]'), function (h) {
      showInHost(h, list[i]);
    });
    if (bgCycles) { paintBackground(); }
  }

  /* The full-frame layer. */
  function paintFeature(lay, b) {
    if (!featureLayer) { return; }
    BCB.media.release(featureLayer);
    featureLayer.innerHTML = '';
    if (lay !== 'fill') { return; }
    var list = BCB.media.beatAssets(b.id);
    if (!list.length) { return; }
    var host = mediaHost('feature');
    if (list.length > 1) { host.dataset.cycles = '1'; }
    featureLayer.appendChild(host);
    showInHost(host, list[Math.min(mediaIdx, list.length - 1)]);
  }

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
    d.className = 'st-stats' + (items.length === 4 && items.some(function (it) { return it.n; }) ? ' grid4' : '');
    d.innerHTML = items.map(function (it) {
      return '<div class="st-stat' + (it.side ? ' side-' + it.side : '') + '">' +
        '<div class="k">' + esc(it.k) + '</div><div class="v">' + esc(it.v) + '</div>' +
        (it.n ? '<div class="n">' + esc(it.n) + '</div>' : '') + '</div>';
    }).join('');
    return d;
  }

  /* Numbers marked data-count roll up from zero when the slide lands.
     The final text is already in the element, so anything that skips
     the tween (reduced motion, print) shows the right figure. */
  var countRaf = 0;
  function countUp(host) {
    if (countRaf) { global.cancelAnimationFrame(countRaf); countRaf = 0; }
    var reduce = global.matchMedia && global.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var nodes = Array.prototype.slice.call(host.querySelectorAll('[data-count]'));
    if (!nodes.length || reduce) { return; }
    var items = nodes.map(function (n) { return { el: n, target: parseFloat(n.dataset.count) || 0, final: n.textContent, money: !!n.dataset.money }; });
    /* Hold the final width while the shorter numbers roll through, so
       the layout does not breathe in and out during the count. */
    items.forEach(function (it) { it.el.style.minWidth = it.el.getBoundingClientRect().width + 'px'; });
    var t0 = performance.now(), dur = 1300;
    function frame(now) {
      var k = Math.min(1, (now - t0) / dur);
      var e = 1 - Math.pow(1 - k, 3);
      items.forEach(function (it) {
        if (k >= 1) { it.el.textContent = it.final; it.el.style.minWidth = ''; return; }
        var v = it.target * e;
        it.el.textContent = it.money ? money(v) : String(Math.round(v));
      });
      if (k < 1) { countRaf = global.requestAnimationFrame(frame); } else { countRaf = 0; }
    }
    countRaf = global.requestAnimationFrame(frame);
  }

  function visualFor(b) {
    var L = BCB.app.getLast(), sim = L.sim, sc = L.scores, cfg = sim.cfg;
    var a = sim.a, bb = sim.b;
    var wrap = document.createElement('div');
    wrap.className = 'st-visual';

    if (fgFor(b) === 'main') {
      var mine = BCB.media.beatAssets(b.id);
      var mhost = mediaHost('main');
      if (mine.length > 1) { mhost.dataset.cycles = '1'; }
      showInHost(mhost, mine[Math.min(mediaIdx, mine.length - 1)]);
      wrap.appendChild(mhost);
      wrap.classList.add('wide', 'st-mediaonly');
      return wrap;
    }

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
        width: dims.w, height: dims.h, endLabelGap: dims.gap,
        reveal: b.reveal || null
      }));
      wrap.classList.add('wide');
      return wrap;
    }

    switch (b.kind) {
      case 'versus': {
        /* Two fighters, two pictures, one VS. The pictures come from the
           library, or from whatever was pasted for the career. */
        var vs = document.createElement('div');
        vs.className = 'st-versus';
        [[a, 'a'], [bb, 'b']].forEach(function (pair) {
          var res = pair[0];
          var asset = BCB.media.assetFor(res.career, 'still');
          var card = document.createElement('div');
          card.className = 'st-fighter ' + pair[1];
          if (asset) {
            var im = document.createElement('img');
            im.alt = ''; im.setAttribute('aria-hidden', 'true');
            im.addEventListener('error', function () { im.remove(); });
            im.src = asset.src;
            card.appendChild(im);
          }
          var nm = document.createElement('div');
          nm.className = 'name'; nm.textContent = res.name;
          card.appendChild(nm);
          vs.appendChild(card);
          if (pair[1] === 'a') {
            var mid = document.createElement('div');
            mid.className = 'st-vs-mark'; mid.textContent = 'VS';
            vs.appendChild(mid);
          }
        });
        wrap.appendChild(vs);
        wrap.classList.add('wide');
        return wrap;
      }

      case 'disclaimer': {
        var dc = document.createElement('div');
        dc.className = 'st-disclaimer';
        dc.innerHTML =
          '<div class="big">Opinion and entertainment.<br>Not advice.</div>' +
          '<div class="small">Not career, financial, tax or investment advice. Every number is a model output built on ' +
          'assumptions, not a fact about you. Talk to a professional who knows your situation before you act on any of it.</div>';
        wrap.appendChild(dc);
        return wrap;
      }

      case 'close': {
        var cl = document.createElement('div');
        cl.className = 'st-brandcard st-close';
        cl.innerHTML =
          '<div class="st-vs"><span class="a">' + esc(a.name) + '</span><em>vs</em><span class="b">' + esc(bb.name) + '</span></div>' +
          '<div class="st-close-asks">' +
            '<span>Subscribe</span><i></i><span>Comment the next matchup</span><i></i><span>Share it</span>' +
          '</div>' +
          '<div class="st-brandmark">Learn the trade.<br>Build the business.<br>Own the asset.</div>' +
          '<div class="st-fineprint">Opinion and entertainment. Not career, financial, tax or investment advice.</div>';
        wrap.appendChild(cl);
        wrap.classList.add('wide');
        return wrap;
      }

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
            '<div class="v" data-count="' + Math.round(t.netWorth) + '" data-money="1">' + money(t.netWorth) + '</div></div></div>';
        });
        wrap.appendChild(cols);
        wrap.classList.add('wide');
        return wrap;

      case 'hours':
        wrap.appendChild(bigStat([
          { k: a.name + ' - hours, school included', v: Math.round(a.totals.hours).toLocaleString(), side: 'a',
            n: Math.round(a.totals.hoursWork).toLocaleString() + ' on the job \u00b7 ' + Math.round(a.totals.hoursSchool).toLocaleString() + ' in school' },
          { k: bb.name + ' - hours, school included', v: Math.round(bb.totals.hours).toLocaleString(), side: 'b',
            n: Math.round(bb.totals.hoursWork).toLocaleString() + ' on the job \u00b7 ' + Math.round(bb.totals.hoursSchool).toLocaleString() + ' in school' },
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

      case 'invest': {
        /* The rule, then what each of them actually put away. */
        var inv = cfg.investing || {};
        var rule = inv.mode === 'percent'
          ? Math.round((inv.percent || 0) * 100) + '% of what\'s left'
          : money((inv.fixedAmount || 0)) + ' a year';
        var shareOf = function (res) {
          var at = res.rows.reduce(function (t, r) { return t + Math.max(0, r.afterTax); }, 0);
          return at > 0 ? Math.round(res.totals.invested / at * 100) : 0;
        };
        wrap.appendChild(bigStat([
          { k: 'The rule', v: rule, n: 'after living costs, invested every year' },
          { k: a.name + ' - put in', v: money(a.totals.invested), n: shareOf(a) + '% of take-home pay', side: 'a' },
          { k: bb.name + ' - put in', v: money(bb.totals.invested), n: shareOf(bb) + '% of take-home pay', side: 'b' }
        ]));
        return wrap;
      }

      case 'compound': {
        /* A dollar's journey, then the pile: what went in against what
           the market added. Totals are the balance at the end. */
        var r = cfg.investReturn, yrs = cfg.years;
        var full = Math.pow(1 + r, yrs), half = Math.pow(1 + r, Math.max(1, yrs - Math.round(yrs / 2)));
        var grey = '#5f656d';
        wrap.appendChild(bigStat([
          { k: '$1 invested at ' + cfg.startAge, v: '$' + full.toFixed(2) + ' by ' + (cfg.startAge + yrs), n: 'at ' + (r * 100).toFixed(1) + '% a year' },
          { k: '$1 invested at ' + (cfg.startAge + Math.round(yrs / 2)), v: '$' + half.toFixed(2) + ' by ' + (cfg.startAge + yrs), n: 'half the time, ' + Math.round((half - 1) / (full - 1) * 100) + '% of the growth' }
        ]));
        var stack = C.stackChart({
          columns: [a, bb].map(function (res, i) {
            return { name: res.name, parts: [
              { label: 'Put in', value: res.totals.invested, color: grey, ink: '#fff' },
              { label: 'Growth', value: res.totals.investmentGrowth, color: i === 0 ? colA() : colB(), ink: '#fff' }
            ] };
          }),
          totals: [a.totals.investments, bb.totals.investments],
          width: 900, height: 150
        });
        wrap.appendChild(stack);
        wrap.classList.add('wide');
        wrap.classList.add('st-compound');
        return wrap;
      }

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
            '<div class="n" data-count="' + p[1].score + '">' + p[1].score + '</div><div class="of">out of 100</div>' +
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
        '<button data-act="rec" id="stRecBtn" title="Start or stop a take (R)">Record</button>' +
        '<button data-act="exit" title="Leave the stage (Esc)">Exit</button>' +
      '</div>' +
      '<div class="st-take no-print" id="stTake" hidden></div>' +
      '<div class="st-alarm no-print" id="stAlarm" hidden></div>';
    /* Background sits behind everything on the stage. */
    bgLayer = BCB.media.createLayer();
    overlay.insertBefore(bgLayer, overlay.firstChild);
    /* The feature layer belongs inside whatever the mode composes in:
       the vertical frame for Studio Three, the stage otherwise. */
    featureLayer = document.createElement('div');
    featureLayer.className = 'st-feature';
    var inner = overlay.querySelector('.st-frame') || overlay;
    inner.appendChild(featureLayer);
    ctaLayer = buildCta();
    inner.appendChild(ctaLayer);
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
      else if (act === 'rec') { toggleRecording(); }
      else if (act === 'save') { BCB.recorder.saveAs(); }
      else if (act === 'dismiss') { showTake(null); }
      else if (act === 'exit') { closePresentation(); }
      /* A focused button would pin the control pill on screen - and so
         into the recording. Drop focus once the click is handled. */
      if (b.blur) { b.blur(); }
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
    /* The camera is never opened on page load, but it is remembered:
       if it was on last time you presented, it comes back on now. */
    if (prefs.cam.on || prefs.cam.wanted) { startCam(); }
    mountCam();
    recDeclined = false;
    go(idx, true);
    renderRecState();
  }

  function applySplitVars() {
    if (!overlay) { return; }
    overlay.style.setProperty('--split-cam-h', prefs.split.camHeight + '%');
    overlay.style.setProperty('--split-cam-w', prefs.split.camWidth + 'vw');
    overlay.classList.toggle('align-left', prefs.split.align === 'left');
  }

  function closePresentation() {
    stop();
    /* Hand every decoder back before the stage goes, rather than waiting
       for the collector to notice. */
    if (overlay) { BCB.media.release(overlay); }
    /* Leaving the stage ends the take and lets go of the screen share,
       so the browser's "sharing this tab" bar goes away with it. */
    if (BCB.recorder) { BCB.recorder.disarm(); }
    document.removeEventListener('keydown', onKey);
    if (overlay) { overlay.remove(); overlay = null; }
    featureLayer = null;
    ctaLayer = null;
    document.body.classList.remove('st-on');
    mountCam();   /* put the camera tile back on the studio tab */
  }

  /* In the split layout the picture is content, not just a backdrop:
     the brief for this mode is "text and images on the left". Beats that
     carry their own visual keep it; the rest get the career photograph
     as an inset card above the words. */
  function insetFor(b) {
    var fg = fgFor(b);
    /* 'card' asks for the inset in every studio; the rest either place
       the picture elsewhere or take it off the slide entirely. */
    if (fg === 'none' || fg === 'fill' || fg === 'main') { return null; }
    var VISUAL_HEAVY = { radar: 1, columns: 1, scores: 1, categories: 1, scenarios: 1, compound: 1, versus: 1, close: 1 };
    if (b.kind.indexOf('chart:') === 0 || VISUAL_HEAVY[b.kind]) { return null; }
    /* Studio One carries the picture as the background; an inset there
       is for the slides that are otherwise only type and a few numbers. */
    if (fg !== 'card' && prefs.mode === 'one' && !ONE_INSET[b.kind]) { return null; }
    var sim = BCB.app.getLast().sim;
    var own = BCB.media.beatAssets(b.id);
    var asset = own[Math.min(mediaIdx, own.length - 1)] || null;
    if (asset) { /* pinned to this slide */ }
    else if (b.kind === 'brand') { asset = BCB.media.assetFor('intro', 'still'); }
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
    var host = mediaHost('inset');
    /* Only a list the slide owns cycles; a career photograph is one
       picture and stays put. */
    if (own.length > 1) { host.dataset.cycles = '1'; }
    showInHost(host, asset);
    return host;
  }

  var ONE_INSET = { setup: 1, education: 1, business: 1, dependency: 1, hours: 1, freedom: 1,
    invest: 1, disclaimer: 1, outro: 1, title: 1 };
  function renderStage() {
    if (!overlay) { return; }
    var b = beat();
    if (!b) { return; }
    mediaIdx = 0;
    overlay.style.setProperty('--fill-inset', (prefs.media.fillInset || 0) + '%');
    var fg = fgFor(b);
    overlay.classList.toggle('lay-fill', fg === 'fill');
    overlay.classList.toggle('lay-main', fg === 'main');
    overlay.classList.toggle('no-cam', camFor(b) === 'off');
    paintFeature(fg, b);
    mountCam();      /* a feature slide takes the camera away and gives it back */
    overlay.classList.toggle('chart', b.kind.indexOf('chart:') === 0 || b.kind === 'radar');
    overlay.querySelector('#stKick').textContent = b.kicker || '';
    overlay.querySelector('#stTitle').textContent = b.title;
    var host = overlay.querySelector('#stVis');
    BCB.media.release(host);
    host.innerHTML = '';
    var inset = insetFor(b);
    if (inset) { host.appendChild(inset); }
    host.appendChild(visualFor(b));
    countUp(host);
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
    tickCta();
  }

  /* Which career's imagery belongs behind this beat. Beats that are
     about one side show that side; shared beats alternate so the
     episode does not sit on one picture for seven minutes. */
  function paintBackground() {
    if (!bgLayer) { return; }
    var b = beat();
    if (!b) { return; }
    var L = BCB.app.getLast(), sim = L.sim;
    var reduce = global.matchMedia && global.matchMedia('(prefers-reduced-motion: reduce)').matches;
    /* A picture filling the frame already is the background. */
    if (bgFor(b) === 'none' || fgFor(b) === 'fill') {
      bgCycles = false;
      BCB.media.setBackground(bgLayer, null, 0, reduce);
      return;
    }
    /* 'career' keeps the library photograph behind the slide even when
       this slide has its own picture playing somewhere in front. */
    var own = bgFor(b) === 'career' ? [] : BCB.media.beatAssets(b.id);
    bgCycles = own.length > 1;
    var asset = own[Math.min(mediaIdx, own.length - 1)] || null;

    if (asset) { /* pinned to this slide on the Studio tab */ }
    else if (b.kind === 'brand') { asset = BCB.media.assetFor('intro', 'clip'); }
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
      cycleMedia();
      tickCta();
      scrollPrompter();
      if (remaining <= 0) {
        if (!prefs.autoAdvance) { remaining = 0; return; }
        if (idx < script.beats.length - 1) { go(idx + 1); }
        else { stop(); endTake(); }
      }
    }, 250);
  }
  function play() {
    if (!script) { return; }
    var R = BCB.recorder;
    /* Ask for the screen before the clock starts, so the share picker is
       never the first two seconds of the take. If they cancel it, the
       next Play runs without recording rather than nagging. */
    if (overlay && R && R.supported() && R.prefs.autoRecord && !R.isRecording() && !recDeclined) {
      if (armingRec) { return; }
      armingRec = true;
      var frame = prefs.mode === 'three' ? overlay.querySelector('.st-frame') : null;
      R.start({ cropTo: frame }).then(function (ok) {
        armingRec = false;
        if (ok) { beginPlay(); }
        else { recDeclined = true; }
      }).catch(function () {
        /* Never leave the flag set. It gates Play, so a rejection that
           is not caught here stops the episode from ever starting again
           without a reload. */
        armingRec = false;
        recDeclined = true;
        beginPlay();
      });
      return;
    }
    beginPlay();
  }
  function beginPlay() {
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
    else if (k === 'r' || k === 'R') { toggleRecording(); }
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
     RECORDING
     The page records its own tab (recorder.js). Two rules keep the
     indicator out of the file: nothing on the stage itself changes while
     a take runs, and the REC clock lives in the control pill (which
     hides itself) and in the prompter window (which is never captured).
     ===================================================================== */
  function toggleRecording() {
    var R = BCB.recorder;
    if (!R || !overlay) { return; }
    if (R.isRecording()) { R.stop(); return; }
    if (armingRec) { return; }
    armingRec = true;
    recDeclined = false;
    var frame = prefs.mode === 'three' ? overlay.querySelector('.st-frame') : null;
    R.start({ cropTo: frame })
      .then(function () { armingRec = false; })
      .catch(function () { armingRec = false; recDeclined = true; });
  }
  function endTake() {
    var R = BCB.recorder;
    if (R && R.isRecording()) { R.stop(); }
  }
  function fmtBytes(n) {
    if (n > 1e9) { return (n / 1e9).toFixed(2) + ' GB'; }
    if (n > 1e6) { return Math.round(n / 1e6) + ' MB'; }
    return Math.round(n / 1e3) + ' KB';
  }
  function takeSummary(t) {
    var len = t.mediaSeconds == null ? mmss(t.seconds) : mmss(t.mediaSeconds) + ' of video';
    var shortfall = t.mediaSeconds != null && t.seconds > 5 && t.mediaSeconds < t.seconds * 0.8
      ? ' \u00b7 the take ran ' + mmss(t.seconds) : '';
    return 'Take ' + t.take + ' \u00b7 ' + len + shortfall +
      (t.audio === false ? ' \u00b7 no sound' : '') +
      ' \u00b7 ' + fmtBytes(t.bytes) + ' \u00b7 ' + t.name;
  }
  /* The toast above the control pill: a finished take, or why there is
     no recording. Hidden while a take is running. */
  function showTake(take, message) {
    if (!overlay) { return; }
    var el = overlay.querySelector('#stTake');
    if (!el) { return; }
    if (!take && !message) { el.hidden = true; el.innerHTML = ''; return; }
    el.hidden = false;
    el.innerHTML = take
      ? '<span>' + esc(takeSummary(take)) + '</span>' +
        '<button data-act="save">Save the file</button><button data-act="dismiss" title="Hide">&times;</button>'
      : '<span>' + esc(message) + '</span><button data-act="dismiss" title="Hide">&times;</button>';
  }
  function renderRecState() {
    var R = BCB.recorder;
    if (!R) { return; }
    var on = R.isRecording();
    if (!on) { recAlarm = ''; }
    var label = on ? '\u25cf ' + mmss(R.elapsed()) : (armingRec ? 'Starting\u2026' : 'Record');
    if (overlay) {
      var al = overlay.querySelector('#stAlarm');
      if (al) { al.hidden = !recAlarm; al.textContent = recAlarm || ''; }
    }
    if (overlay) {
      var btn = overlay.querySelector('#stRecBtn');
      if (btn) { btn.textContent = label; btn.classList.toggle('rec-on', on); }
    }
    if (promptWin && !promptWin.closed) {
      var pr = promptWin.document.getElementById('pRec');
      if (pr) { pr.className = 'rec' + (on ? ' on' : ''); pr.innerHTML = on ? '<i></i>REC ' + mmss(R.elapsed()) : ''; }
    }
    var card = document.getElementById('recCard');
    if (card && !overlay) { card.innerHTML = recCardMarkup(); listMics(); }
  }
  function onRecorderEvent(evt, data) {
    if (evt === 'start') {
      recMessage = '';
      showTake(null);
      clearInterval(recTimer);
      recTimer = setInterval(renderRecState, 1000);
    } else if (evt === 'stop') {
      clearInterval(recTimer); recTimer = null;
      if (data) { showTake(data); }
      else { showTake(null, 'That take was empty - nothing was saved.'); }
    } else if (evt === 'measured') {
      /* The summary is rewritten once the file has been read back, so
         what it claims is what is in the file. */
      if (data) { showTake(data); }
    } else if (evt === 'stall' || evt === 'short') {
      /* Loud, and it stays: this is the failure that costs a whole take. */
      recMessage = data;
      recAlarm = data;
      showTake(null, data);
    } else if (evt === 'resumed') {
      recAlarm = '';
    } else if (evt === 'error' || evt === 'warn') {
      recMessage = data;
      showTake(null, data);
    }
    renderRecState();
  }
  function recCardMarkup() {
    var R = BCB.recorder;
    if (!R) { return ''; }
    var P = R.prefs;
    var take = R.lastTake();
    var m = R.pickMime();
    var q = P.fps + '-' + P.bitrate;
    var opts = [['30-6', '30 fps \u00b7 6 Mbps - smaller file'], ['30-10', '30 fps \u00b7 10 Mbps - YouTube 1080p'],
      ['30-16', '30 fps \u00b7 16 Mbps - high'], ['60-20', '60 fps \u00b7 20 Mbps - smooth motion']];
    if (!opts.some(function (o) { return o[0] === q; })) { opts.push([q, P.fps + ' fps \u00b7 ' + P.bitrate + ' Mbps']); }
    var html = '<h3>Screen recording</h3>' +
      '<p class="sub">The page records its own tab while you present and hands you the file when the episode ends ' +
      'or you leave the stage. No second app.</p>';
    if (!R.supported()) {
      return html + '<div class="callout">This browser cannot record its own screen. Use Chrome or Edge on a desktop, ' +
        'or point OBS at this window instead.</div>';
    }
    html +=
      '<div class="field"><div class="field-inline"><input type="checkbox" id="recAuto"' + (P.autoRecord ? ' checked' : '') +
        '><label for="recAuto" style="margin:0">Record automatically when I press Play</label></div>' +
        '<div class="hint">The first Play opens the browser\u2019s share picker with this tab already selected. Choose it and the ' +
        'take starts. The prompter window is a separate window, so it is never in the file. R starts or stops a take by hand.</div></div>' +
      '<div class="field"><div class="field-inline"><input type="checkbox" id="recMic"' + (P.includeMic ? ' checked' : '') +
        '><label for="recMic" style="margin:0">Record my microphone into the file</label></div></div>' +
      '<div class="field"><label for="recMicDevice">Microphone</label><select id="recMicDevice"' + (P.includeMic ? '' : ' disabled') +
        '><option value="">Default microphone</option></select></div>' +
      '<div class="field"><label for="recFormat">File format</label><select id="recFormat">' +
        [['auto', 'H.264 MP4 if this browser can, otherwise WebM'], ['mp4', 'Always MP4'], ['webm', 'Always WebM']]
        .map(function (o) { return '<option value="' + o[0] + '"' + (P.format === o[0] ? ' selected' : '') +
          '>' + esc(o[1]) + '</option>'; }).join('') +
      '</select><div class="hint">WebM is written a second at a time, so a crash costs a second. MP4 is written ' +
      'in one piece at the end. If a take ever comes out shorter than it should, try WebM.</div></div>' +
      '<div class="field"><label for="recQuality">Quality</label><select id="recQuality">' +
        opts.map(function (o) { return '<option value="' + o[0] + '"' + (o[0] === q ? ' selected' : '') + '>' + esc(o[1]) + '</option>'; }).join('') +
      '</select><div class="hint">' + (m.ext === 'mp4'
        ? 'Saves as MP4 (H.264), which every editor and platform opens.'
        : 'Saves as WebM. YouTube takes it directly; convert with HandBrake for other editors.') +
        ' Ten minutes at 10 Mbps is about 750 MB.</div></div>' +
      '<p class="hint" style="color:var(--muted);font-size:.8rem">The Studio Three take is cropped to the vertical frame on the way ' +
      'through, so it comes out 9:16. The take lives in the browser\u2019s memory until you save it: reloading the page loses it. ' +
      'Recording works from the local file and the GitHub Pages link, not inside an embedded preview.</p>';
    html += '<div class="field-inline" style="gap:10px;margin-top:12px;flex-wrap:wrap">' +
      '<button class="btn btn-o btn-sm" data-rec="test">Test the setup</button>' +
      '<span class="hint" style="color:var(--muted)">Records five seconds, then reads the file back and tells you ' +
      'what landed. Worth doing before an episode rather than after one.</span></div>' +
      '<div id="recTestOut" class="rec-test' + (recTest ? ' ' + recTest.cls : '') + '"' + (recTest ? '' : ' hidden') + '>' +
      (recTest ? esc(recTest.text) : '') + '</div>';
    if (recMessage) { html += '<p class="hint" style="color:var(--series-b)">' + esc(recMessage) + '</p>'; }
    if (take) {
      html += '<div class="callout" style="display:flex;gap:12px;align-items:center;flex-wrap:wrap">' +
        '<strong>Last take</strong><span>' + esc(takeSummary(take)) + '</span>' +
        '<button class="btn btn-sm" data-rec="save">Save the file</button>' +
        '<a class="btn btn-o btn-sm" href="' + take.url + '" download="' + esc(take.name) + '">Download</a>' +
        '<button class="btn btn-o btn-sm" data-rec="clear">Discard</button></div>';
    }
    return html;
  }
  /* The picture library: what each slot shows now, and a box to paste
     your own link into. Higgsfield: open the image, right-click, copy
     image address. The link has to be public for the browser to load it. */
  function picturesMarkup() {
    var M = BCB.media;
    var L = BCB.app.getLast();
    if (!L) { return '<h3>Pictures and clips</h3><p class="sub">Run a comparison first.</p>'; }
    var slots = [
      ['brand', 'intro', 'Intro and cold open'],
      ['brand', 'title', 'Title card'],
      ['brand', 'outro', 'Outro and close'],
      ['careers', M.idFor(L.sim.a.career), L.sim.a.name],
      ['careers', M.idFor(L.sim.b.career), L.sim.b.name]
    ];
    return '<h3>Pictures and clips</h3>' +
      '<p class="sub">What plays behind and inside the slides. Swap any of them for something you made in ' +
      'Higgsfield: download it and choose the file, or paste its link. Stills are used on ' +
      'most slides, clips on the intro, the outro and every third slide.</p>' +
      '<div class="pic-grid">' +
      slots.map(function (sl) {
        var e = M.libraryEntry(sl[0], sl[1]);
        var box = function (field, own, has, accept, label) {
          var f = M.fileInfo(own) || (/^file:/.test(own) ? { name: 'uploaded file', size: 0 } : null);
          var id = sl[0] + '|' + esc(sl[1]) + '|' + field;
          return '<div class="field"><label>' + label + '</label>' +
            '<div class="pic-row">' +
            (f
              ? '<span class="pic-file" title="' + esc(f.name) + '">' + esc(f.name || 'uploaded file') + ' \u00b7 ' + fmtBytes(f.size) + '</span>' +
                '<button type="button" class="btn btn-o btn-sm" data-picclear="' + id + '">Remove</button>'
              : '<input type="url" data-pic="' + id + '" value="' + esc(own) + '" placeholder="' +
                (has && !own ? 'using the library ' + (field === 'clip' ? 'clip' : 'picture') : 'paste a link') + '">') +
            '<label class="btn btn-o btn-sm pic-upload">Choose file<input type="file" accept="' + accept + '" data-picfile="' + id + '" hidden></label>' +
            '</div></div>';
        };
        return '<div class="pic-slot">' +
          '<div class="pic-thumb">' + (e.stillUrl ? '<img src="' + esc(e.stillUrl) + '" alt="" loading="lazy">' : '<span>no picture</span>') + '</div>' +
          '<div class="pic-fields"><div class="k">' + esc(sl[2]) + '</div>' +
          box('still', e.ownStill, !!e.still, 'image/*', 'Still image') +
          box('clip', e.ownClip, !!e.clip, 'video/mp4,video/webm,video/quicktime', 'Clip (mp4)') +
          '</div></div>';
      }).join('') +
      '</div>' +
      '<div class="field-row" style="margin-top:14px;grid-template-columns:repeat(3,minmax(0,1fr))">' +
      '<div class="field"><label for="holdPic">Hold each picture</label>' +
      '<input type="number" id="holdPic" min="2" max="30" step="1" value="' + prefs.media.imageHold + '">' +
      '<div class="hint">Seconds before the next one takes over. Around five keeps a viewer with you.</div></div>' +
      '<div class="field"><label for="holdClip">Hold each clip</label>' +
      '<input type="number" id="holdClip" min="3" max="60" step="1" value="' + prefs.media.clipHold + '">' +
      '<div class="hint">Seconds. A clip carries its own movement, so it can hold longer than a still.</div></div>' +
      '<div class="field"><label for="fillInset">Margin when a picture fills the frame</label>' +
      '<input type="number" id="fillInset" min="0" max="20" step="1" value="' + prefs.media.fillInset + '">' +
      '<div class="hint">% in from the edge. The whole picture is shown inside it, so nothing runs off screen.</div></div>' +
      '</div>' +
      '<p class="hint" style="color:var(--muted);font-size:.8rem;margin-top:8px">Clear a box or press Remove to go back to the library. ' +
      'Each slide in the script below also has its own box, for a picture that belongs to that one moment. ' +
      'Files and links are kept in this browser only: a different computer, or a cleared browser, starts from the library again.</p>';
  }

  /* The like / subscribe / bell button, and where in the section it
     plays. Kept next to the pictures because it is the same kind of
     decision: what is on screen, and when. */
  function ctaRowMarkup(id, b) {
    var o = prefs.beatOpts[id] || {};
    var on = !!o.cta;
    var at = Math.max(0, +o.ctaAt || 0);
    return '<div class="cta-row">' +
      '<button type="button" class="btn btn-sm ' + (on ? '' : 'btn-o') + '" data-cta="' + esc(id) + '">' +
        (on ? '\u2713 Like, subscribe, bell' : 'Add like, subscribe, bell') + '</button>' +
      (on
        ? '<label class="cta-at">plays at <input type="number" min="0" max="' + (b ? b.seconds : 60) +
          '" step="1" value="' + at + '" data-ctaat="' + esc(id) + '"> seconds in, for five seconds</label>'
        : '<span class="cta-note">Five seconds over whatever is on screen.</span>') +
      '</div>';
  }

  function beatById(id) {
    if (!script) { return null; }
    for (var i = 0; i < script.beats.length; i++) {
      if (script.beats[i].id === id) { return script.beats[i]; }
    }
    return null;
  }
  /* A chart or a table is the slide; pictures play behind it rather
     than taking its place. */
  function isCharty(b) {
    var HEAVY = { radar: 1, columns: 1, scores: 1, categories: 1, scenarios: 1, compound: 1 };
    return !!b && (b.kind.indexOf('chart:') === 0 || HEAVY[b.kind]);
  }
  /* What this slide's list covers against what the script needs. */
  function coverageHint(b, list) {
    if (!b) { return ''; }
    var pic = prefs.media.imageHold || 5, clip = prefs.media.clipHold || 10;
    var tail = isCharty(b) ? ' On this slide they play behind the chart rather than in place of it.' : '';
    if (!list.length) {
      return b.seconds + 's of script. About ' + Math.ceil(b.seconds / pic) + ' pictures, or ' +
        Math.ceil(b.seconds / clip) + ' clips, would fill it.' + tail;
    }
    var covers = beatCoverage(list);
    var pics = list.filter(function (a) { return a.kind !== 'clip'; }).length;
    var clips = list.length - pics;
    var have = pics + (pics === 1 ? ' picture' : ' pictures') +
      (clips ? ' and ' + clips + (clips === 1 ? ' clip' : ' clips') : '');
    if (covers >= b.seconds) {
      return b.seconds + 's of script, ' + have + ' covering ' + covers + 's. Filled.' + tail;
    }
    return b.seconds + 's of script, ' + have + ' covering ' + covers + 's. ' +
      Math.ceil((b.seconds - covers) / pic) + ' more would reach the end; otherwise the list starts over.' + tail;
  }

  function beatPicMarkup(id) {
    var b = beatById(id);
    var list = BCB.media.beatAssets(id);
    return '<div class="field beat-pic" style="margin-top:8px" data-beatslot="' + esc(id) + '">' +
      '<label>Pictures and clips for this slide</label>' +
      (list.length
        ? '<ol class="pic-list">' + list.map(function (a, i) {
            return '<li class="pic-item"><span class="pic-kind ' + a.kind + '">' +
              (a.kind === 'clip' ? 'clip' : 'still') + '</span>' +
              '<span class="pic-file" title="' + esc(a.name) + '">' + esc(a.name) + '</span>' +
              '<span class="pic-secs">' + holdFor(a) + 's</span>' +
              '<button type="button" class="pic-x" data-beatdel="' + esc(id) + '|' + i +
              '" title="Remove">&times;</button></li>';
          }).join('') + '</ol>'
        : '') +
      '<div class="pic-row">' +
      '<input type="url" data-beatadd="' + esc(id) + '" placeholder="Paste a picture or clip link">' +
      '<label class="btn btn-o btn-sm pic-upload">Add files<input type="file" multiple accept="image/*,video/mp4,video/webm,video/quicktime" data-beatfile="' + esc(id) + '" hidden></label>' +
      (list.length ? '<button type="button" class="btn btn-o btn-sm" data-beatclear="' + esc(id) + '">Clear</button>' : '') +
      '</div><div class="hint">' + esc(coverageHint(b, list)) + '</div>' +
      ctaRowMarkup(id, b) +
      '<div class="beat-opts">' +
      SLIDE_OPTS.map(function (o) {
        var cur = (prefs.beatOpts[id] || {})[o[0]] || '';
        return '<div class="field"><label for="' + o[0] + '-' + esc(id) + '">' + esc(o[1]) + '</label>' +
          '<select id="' + o[0] + '-' + esc(id) + '" data-beatopt="' + o[0] + '|' + esc(id) + '">' +
          o[2].map(function (v) {
            return '<option value="' + v[0] + '"' + (cur === v[0] ? ' selected' : '') + '>' + esc(v[1]) + '</option>';
          }).join('') + '</select></div>';
      }).join('') +
      '</div><div class="hint">Hide the camera and the slide fills the screen on its own. The picture settings ' +
      'need at least one picture above; without one the slide keeps its normal layout.</div></div>';
  }
  function redrawBeatSlot(id) {
    var slot = document.querySelector('[data-beatslot="' + id + '"]');
    if (slot) { slot.outerHTML = beatPicMarkup(id); }
    if (overlay) { renderStage(); }
  }
  function refreshPicSlot(scope, key) {
    /* Redraw one library slot in place rather than the whole card. */
    var card = document.getElementById('picCard');
    if (card) { card.innerHTML = picturesMarkup(); }
  }

  function listMics() {
    var sel = document.getElementById('recMicDevice');
    if (!sel || !BCB.recorder) { return; }
    BCB.recorder.listMics().then(function (list) {
      if (!list.length) { return; }
      var cur = BCB.recorder.prefs.micDeviceId;
      sel.innerHTML = '<option value="">Default microphone</option>' + list.map(function (d, i) {
        return '<option value="' + esc(d.deviceId) + '"' + (d.deviceId === cur ? ' selected' : '') + '>' +
          esc(d.label || 'Microphone ' + (i + 1)) + '</option>';
      }).join('');
    });
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
      '</svg><span>Your camera \u00b7 press C to turn it on</span>';
    return camPlaceholder;
  }
  function mountCam() {
    var w = camNode();
    applyCamStyle();
    var ghost = placeholderNode();
    if (ghost.parentNode) { ghost.remove(); }
    /* A feature slide is the picture and nothing else. */
    if (overlay && camFor(beat()) === 'off') {
      if (w.parentNode) { w.remove(); }
      return;
    }
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
  /* Why the camera did not start, in words that say what to do next.
     The browser's own error names are precise and useless on their own. */
  function camFailure(err) {
    var name = (err && err.name) || '';
    var embedded = false;
    try { embedded = global.top !== global.self; } catch (e) { embedded = true; }
    if (name === 'NotAllowedError' || name === 'SecurityError') {
      if (embedded) {
        return 'This page is embedded inside another site, which blocks the camera. Open the GitHub Pages link ' +
          'or the local file in its own browser tab.';
      }
      if (!global.isSecureContext) {
        return 'The browser only allows the camera on an https address or a local file. This page is neither.';
      }
      return 'Camera blocked for this page. Click the camera icon at the right end of the address bar, allow it, ' +
        'then press C again.';
    }
    if (name === 'NotReadableError' || name === 'AbortError' || name === 'TrackStartError') {
      return 'The camera is busy in another app. Close the Windows camera settings preview, Zoom, Teams, OBS ' +
        'or the Camera app, then press C again.';
    }
    if (name === 'NotFoundError' || name === 'OverconstrainedError' || name === 'DevicesNotFoundError') {
      return 'No camera found. Check it is plugged in, and that Windows privacy settings allow desktop apps ' +
        'to use the camera.';
    }
    return 'The camera did not start (' + (name || 'unknown error') + '). Press C to try again.';
  }
  function startCam() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      camFailed('This browser will not give a page camera access here. Use Chrome or Edge, from the local ' +
        'file or the GitHub Pages link.');
      return;
    }
    var constraints = { audio: false, video: { width: { ideal: 1280 }, height: { ideal: 720 } } };
    if (prefs.cam.deviceId) { constraints.video.deviceId = { exact: prefs.cam.deviceId }; }
    camFailed('');
    navigator.mediaDevices.getUserMedia(constraints).then(function (stream) {
      camStream = stream;
      prefs.cam.on = true;
      prefs.cam.wanted = true;
      camNode().querySelector('video').srcObject = stream;
      mountCam();
      savePrefs();
      camMessage = 'Camera on. Drag the picture to move it anywhere on the slide.';
      listCams();
      renderStudio();
    }).catch(function (err) {
      /* A remembered camera that is no longer plugged in should not
         stop the one that is: fall back to the default and try again. */
      var missing = err && (err.name === 'OverconstrainedError' || err.name === 'NotFoundError');
      if (missing && prefs.cam.deviceId) {
        prefs.cam.deviceId = ''; savePrefs();
        startCam();
        return;
      }
      camFailed(camFailure(err));
    });
  }
  /* A failure has to be visible where you are: on the stage it goes on
     the placeholder and the toast, on the tab it goes under the tile. */
  function camFailed(text) {
    prefs.cam.on = false;
    camMessage = text;
    var ghost = placeholderNode().querySelector('span');
    if (ghost) {
      ghost.textContent = text || 'Your camera \u00b7 press C to turn it on';
      ghost.classList.toggle('err', !!text);
    }
    if (text && overlay) { showTake(null, text); }
    if (!overlay) { renderStudio(); }
  }
  function stopCam() {
    if (camStream) { camStream.getTracks().forEach(function (t) { t.stop(); }); camStream = null; }
    prefs.cam.on = false;
    prefs.cam.wanted = false;
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
      '.rec{display:none;color:#ff5a4e;font-weight:600;letter-spacing:.06em;font-size:12px}' +
      '.rec.on{display:inline-flex;align-items:center;gap:6px}' +
      '.rec i{width:9px;height:9px;border-radius:50%;background:#ff3b30;animation:pRecBlink 1s steps(2) infinite}' +
      '@keyframes pRecBlink{50%{opacity:.25}}' +
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
        '<span id="pRec" class="rec"></span>' +
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
    var cue = b && (prefs.beatOpts[b.id] || {}).cta;
    d.getElementById('pBeat').textContent = (b ? b.title : '-') +
      (cue ? '   \u25cf like / subscribe / bell' : '');
    d.getElementById('pPos').textContent = script ? (idx + 1) + ' / ' + script.beats.length : '';
    d.getElementById('pClock').textContent = mmss(remaining) + (playing ? '' : '  (paused)');
    d.querySelector('[data-p="play"]').textContent = playing ? 'Pause' : 'Play';
    renderRecState();
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

      '<div class="card" id="recCard">' + recCardMarkup() + '</div>' +

      '<div class="card" id="picCard">' + picturesMarkup() + '</div>' +

      '<div class="card"><h2>The script</h2>' +
      '<p class="sub">Generated from this comparison. Edit any line - the prompter and the timings follow what you type.</p>' +
      script.beats.map(function (b, i) {
        return '<details class="fieldset"' + (i === 0 ? ' open' : '') + '><summary>' + (i + 1) + '. ' + esc(b.title) +
          ' <span style="color:var(--faint);font-weight:400">' + b.seconds + 's</span></summary>' +
          '<textarea data-beat="' + i + '" rows="' + Math.max(3, b.lines.length + 1) + '" ' +
          'style="width:100%;font:inherit;font-size:.9rem;padding:9px;border:1px solid var(--line);border-radius:5px;' +
          'background:var(--surface-1);color:var(--text)">' + esc(b.lines.join('\n')) + '</textarea>' +
          '<div class="hint">One line per sentence. Blank lines are ignored.</div>' +
          beatPicMarkup(b.id) + '</details>';
      }).join('') +
      '<div class="field-inline" style="flex-wrap:wrap;gap:8px;margin-top:12px">' +
        '<button class="btn btn-o btn-sm" data-st="camoff">Hide the camera on every slide</button>' +
        '<button class="btn btn-o btn-sm" data-st="slidereset">Reset every slide to the studio default</button>' +
      '</div>' +
      '<button class="btn btn-o btn-sm" data-st="reshuffle" style="margin-top:10px">Reshuffle the wording</button>' +
      '<button class="btn btn-o btn-sm" data-st="regen" style="margin-top:10px;margin-left:6px">Regenerate from the numbers</button>' +
      '<span class="hint" style="margin-left:10px;color:var(--muted)">Both discard your edits. Reshuffle keeps the facts and ' +
      'rewrites every sentence; hit it until it sounds like you.</span>' +
      '</div>' +

      '<div class="card"><h3>Keys while presenting</h3>' +
      '<div class="cats">' +
      [['Space', 'play / pause'], ['&larr; &rarr;', 'previous / next beat'], ['&uarr; &darr;', 'prompter reading line'],
       ['C', 'camera on / off'], ['R', 'start / stop a take'], ['F', 'fullscreen'], ['Esc', 'leave the stage']]
      .map(function (k) { return '<div class="cat"><span>' + k[0] + '</span><span class="who">' + k[1] + '</span></div>'; }).join('') +
      '</div></div>';

    mountCam();
    listCams();
    listMics();
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
      else if (act === 'camoff') {
        script.beats.forEach(function (bb) {
          var slot = prefs.beatOpts[bb.id] || (prefs.beatOpts[bb.id] = {});
          slot.cam = 'off';
        });
        savePrefs(); renderStudio(); if (overlay) { renderStage(); }
      }
      else if (act === 'slidereset') {
        prefs.beatOpts = {};
        savePrefs(); renderStudio(); if (overlay) { renderStage(); }
      }
      else if (act === 'regen') { script = null; build(); renderStudio(); renderPrompter(); }
      else if (act === 'reshuffle') {
        var st = BCB.app.getState();
        st.scriptSeed = (st.scriptSeed || 0) + 1;
        script = null; build(); renderStudio(); renderPrompter();
        BCB.app.recompute(true);   /* the YouTube tab shares the seed */
      }
      return;
    }
    var recBtn = t.closest && t.closest('[data-rec]');
    if (recBtn && ev.type === 'click' && BCB.recorder) {
      if (recBtn.dataset.rec === 'save') { BCB.recorder.saveAs(); }
      else if (recBtn.dataset.rec === 'clear') { BCB.recorder.clearTake(); renderRecState(); }
      else if (recBtn.dataset.rec === 'test') {
        recTest = { cls: 'busy', text: 'Recording five seconds\u2026 choose this tab if the picker appears.' };
        var card = document.getElementById('recCard');
        if (card) { card.innerHTML = recCardMarkup(); listMics(); }
        BCB.recorder.selfTest().then(function (r) {
          recTest = {
            cls: r.ok ? 'good' : 'bad',
            text: (r.ok ? 'Ready. ' : 'Not ready. ') + r.why +
              '  Capturing: ' + (r.surface || 'nothing') + '. Video: ' + r.got + 's of 5. Sound: ' + (r.audio ? 'yes' : 'no') + '.'
          };
          var c2 = document.getElementById('recCard');
          if (c2) { c2.innerHTML = recCardMarkup(); listMics(); }
        });
      }
      return;
    }
    if (t.dataset && t.dataset.picfile && ev.type === 'change') {
      var fparts = t.dataset.picfile.split('|');
      var file = t.files && t.files[0];
      if (!file) { return; }
      BCB.media.setFile(fparts[0], fparts[1], fparts[2], file).then(function () {
        refreshPicSlot();
        if (overlay) { renderStage(); }
      });
      return;
    }
    if (t.dataset && t.dataset.beatfile && ev.type === 'change') {
      var bfiles = Array.prototype.slice.call(t.files || []);
      if (!bfiles.length) { return; }
      var bid = t.dataset.beatfile;
      /* One at a time and in order, so the list reads the way they were
         chosen rather than the order the writes happened to finish. */
      bfiles.reduce(function (chain, f) {
        return chain.then(function () { return BCB.media.addBeatFile(bid, f); });
      }, Promise.resolve()).then(function () { redrawBeatSlot(bid); });
      return;
    }
    var ctaBtn = t.closest && t.closest('[data-cta]');
    if (ctaBtn && ev.type === 'click') {
      var cbid = ctaBtn.dataset.cta;
      var cslot = prefs.beatOpts[cbid] || (prefs.beatOpts[cbid] = {});
      if (cslot.cta) { delete cslot.cta; delete cslot.ctaAt; }
      else { cslot.cta = 1; }
      if (!Object.keys(cslot).length) { delete prefs.beatOpts[cbid]; }
      savePrefs();
      redrawBeatSlot(cbid);
      return;
    }
    if (t.dataset && t.dataset.ctaat && ev.type === 'input') {
      var av = parseFloat(t.value);
      if (!isFinite(av) || av < 0) { return; }
      var aslot = prefs.beatOpts[t.dataset.ctaat] || (prefs.beatOpts[t.dataset.ctaat] = {});
      aslot.ctaAt = av;
      savePrefs();
      if (overlay) { tickCta(); }
      return;
    }
    var bdel = t.closest && t.closest('[data-beatdel]');
    if (bdel && ev.type === 'click') {
      var dparts = bdel.dataset.beatdel.split('|');
      BCB.media.removeBeatMedia(dparts[0], +dparts[1]);
      redrawBeatSlot(dparts[0]);
      return;
    }
    var clearBtn = t.closest && t.closest('[data-picclear]');
    if (clearBtn && ev.type === 'click') {
      var cparts = clearBtn.dataset.picclear.split('|');
      BCB.media.setOverride(cparts[0], cparts[1], cparts[2], '');
      refreshPicSlot();
      if (overlay) { renderStage(); }
      return;
    }
    var bclear = t.closest && t.closest('[data-beatclear]');
    if (bclear && ev.type === 'click') {
      BCB.media.clearBeatMedia(bclear.dataset.beatclear);
      redrawBeatSlot(bclear.dataset.beatclear);
      return;
    }
    if (t.dataset && t.dataset.pic && ev.type === 'change') {
      var parts = t.dataset.pic.split('|');
      BCB.media.setOverride(parts[0], parts[1], parts[2], t.value);
      /* Refresh this slot's thumbnail in place; redrawing the whole card
         would pull the box out from under the cursor. */
      var slot = t.closest('.pic-slot');
      if (slot) {
        var e = BCB.media.libraryEntry(parts[0], parts[1]);
        slot.querySelector('.pic-thumb').innerHTML = e.stillUrl ? '<img src="' + esc(e.stillUrl) + '" alt="">' : '<span>no picture</span>';
      }
      if (overlay) { renderStage(); }
      return;
    }
    if (t.dataset && t.dataset.beatopt && ev.type === 'change') {
      var parts = t.dataset.beatopt.split('|'), key = parts[0], bid = parts[1];
      var slot = prefs.beatOpts[bid] || (prefs.beatOpts[bid] = {});
      if (t.value) { slot[key] = t.value; } else { delete slot[key]; }
      if (!Object.keys(slot).length) { delete prefs.beatOpts[bid]; }
      savePrefs();
      if (overlay) { renderStage(); }
      return;
    }
    if (t.dataset && t.dataset.beatadd && ev.type === 'change') {
      if (BCB.media.addBeatMedia(t.dataset.beatadd, t.value)) {
        t.value = '';
        redrawBeatSlot(t.dataset.beatadd);
      }
      return;
    }
    if (t.id === 'fillInset' && ev.type === 'input') {
      var fv = parseFloat(t.value);
      if (!isFinite(fv) || fv < 0) { return; }
      prefs.media.fillInset = fv;
      savePrefs();
      if (overlay) { overlay.style.setProperty('--fill-inset', fv + '%'); }
      return;
    }
    if ((t.id === 'holdPic' || t.id === 'holdClip') && ev.type === 'input') {
      var hv = parseFloat(t.value);
      if (!isFinite(hv) || hv < 1) { return; }
      prefs.media[t.id === 'holdPic' ? 'imageHold' : 'clipHold'] = hv;
      savePrefs();
      /* Every slide's coverage line depends on these two numbers. */
      Array.prototype.forEach.call(document.querySelectorAll('[data-beatslot]'), function (el) {
        el.outerHTML = beatPicMarkup(el.dataset.beatslot);
      });
      if (overlay) { renderStage(); }
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
    else if (t.id === 'recAuto') { BCB.recorder.prefs.autoRecord = t.checked; BCB.recorder.save(); }
    else if (t.id === 'recMic') {
      BCB.recorder.prefs.includeMic = t.checked; BCB.recorder.save();
      var ms = document.getElementById('recMicDevice'); if (ms) { ms.disabled = !t.checked; }
    }
    else if (t.id === 'recMicDevice') { BCB.recorder.prefs.micDeviceId = t.value; BCB.recorder.save(); }
    else if (t.id === 'recFormat') { BCB.recorder.prefs.format = t.value; BCB.recorder.save(); }
    else if (t.id === 'recQuality') {
      var qp = t.value.split('-');
      BCB.recorder.prefs.fps = parseInt(qp[0], 10) || 30;
      BCB.recorder.prefs.bitrate = parseInt(qp[1], 10) || 10;
      BCB.recorder.save();
    }
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
    /* The library arrives after the tab is drawn on a hosted copy, so
       redraw the picture card once it is here. */
    BCB.media.load().then(function () {
      var pc = document.getElementById('picCard');
      if (pc) { pc.innerHTML = picturesMarkup(); }
      Array.prototype.forEach.call(document.querySelectorAll('[data-beatslot]'), function (el) {
        el.outerHTML = beatPicMarkup(el.dataset.beatslot);
      });
    });
    if (BCB.recorder) {
      BCB.recorder.onChange(onRecorderEvent);
      BCB.recorder.setNameSource(function () {
        var L = BCB.app.getLast();
        if (!L) { return ''; }
        var slug = function (n) { return String(n).toLowerCase().replace(/\(.*?\)/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''); };
        return slug(L.sim.a.name) + '-vs-' + slug(L.sim.b.name);
      });
    }
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
