/* =====================================================================
   Blue Collar Business - The 20-Year Test
   charts.js : hand-rolled SVG charts, no dependencies

   Built for a screen recording: thick-enough marks, large type, direct
   labels on both series, and a recessive grid. Two series only, ever -
   Career A and Career B - which is why identity is carried by a fixed
   pair of hues plus a direct label, never by colour alone.

   Palette: categorical slots 1 and 2 of the validated default, checked
   all-pairs in both light and dark before use.
   ===================================================================== */
(function (global) {
  'use strict';

  var BCB = global.BCB = global.BCB || {};
  var NS = 'http://www.w3.org/2000/svg';

  function el(name, attrs, text) {
    var n = document.createElementNS(NS, name);
    if (attrs) { for (var k in attrs) { if (attrs.hasOwnProperty(k) && attrs[k] != null) { n.setAttribute(k, attrs[k]); } } }
    if (text != null) { n.textContent = text; }
    return n;
  }
  function fmtMoney(v, currency) {
    var sign = v < 0 ? '-' : '';
    var a = Math.abs(v);
    if (a >= 1e6) { return sign + '$' + (a / 1e6).toFixed(a >= 1e7 ? 1 : 2) + 'M'; }
    if (a >= 1e3) { return sign + '$' + Math.round(a / 1e3) + 'k'; }
    return sign + '$' + Math.round(a);
  }
  function fmtNum(v) { return Math.round(v).toLocaleString(); }

  /* Nice round axis steps, so the gridlines land on numbers a viewer
     can read off the screen without arithmetic. */
  function niceScale(min, max, targetTicks) {
    targetTicks = targetTicks || 5;
    if (min === max) { max = min + 1; }
    var span = max - min;
    var raw = span / targetTicks;
    var mag = Math.pow(10, Math.floor(Math.log(raw) / Math.LN10));
    var norm = raw / mag;
    var step = (norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 2.5 ? 2.5 : norm <= 5 ? 5 : 10) * mag;
    var lo = Math.floor(min / step) * step;
    var hi = Math.ceil(max / step) * step;
    var ticks = [];
    for (var v = lo; v <= hi + step / 2; v += step) { ticks.push(Math.abs(v) < step / 1e6 ? 0 : v); }
    return { lo: lo, hi: hi, step: step, ticks: ticks };
  }

  var PAD = { top: 30, right: 108, bottom: 44, left: 74 };

  /* -------------------------------------------------------------
     LINE CHART - two series over age. The workhorse.
     ------------------------------------------------------------- */
  function lineChart(opts) {
    var w = opts.width || 960, h = opts.height || 400;
    var series = opts.series;             /* [{name, color, points:[{x,y}]}] */
    var fmt = opts.format || fmtMoney;
    var pad = Object.assign({}, PAD, opts.pad || {});
    var iw = w - pad.left - pad.right, ih = h - pad.top - pad.bottom;

    var allY = [], allX = [];
    series.forEach(function (s) { s.points.forEach(function (p) { allY.push(p.y); allX.push(p.x); }); });
    var yMin = Math.min.apply(null, allY), yMax = Math.max.apply(null, allY);
    if (opts.zeroBase !== false) { yMin = Math.min(0, yMin); }
    var ys = niceScale(yMin, yMax, 5);
    var xMin = Math.min.apply(null, allX), xMax = Math.max.apply(null, allX);

    function X(v) { return pad.left + (xMax === xMin ? 0 : (v - xMin) / (xMax - xMin) * iw); }
    function Y(v) { return pad.top + ih - (v - ys.lo) / (ys.hi - ys.lo) * ih; }

    var svg = el('svg', {
      viewBox: '0 0 ' + w + ' ' + h, width: '100%', class: 'bcb-chart',
      role: 'img', 'aria-label': opts.title || 'comparison chart'
    });
    if (opts.title) { svg.appendChild(el('title', null, opts.title)); }

    /* Gridlines and y labels - recessive on purpose. */
    ys.ticks.forEach(function (t) {
      svg.appendChild(el('line', {
        x1: pad.left, x2: pad.left + iw, y1: Y(t), y2: Y(t),
        class: t === 0 ? 'grid grid-zero' : 'grid'
      }));
      svg.appendChild(el('text', { x: pad.left - 9, y: Y(t) + 4, class: 'axis-label', 'text-anchor': 'end' }, fmt(t)));
    });

    /* X axis: every fifth age, plus the last. */
    var xs = [];
    for (var a = xMin; a <= xMax; a++) { if ((a - xMin) % 5 === 0 || a === xMax) { xs.push(a); } }
    xs.forEach(function (a) {
      svg.appendChild(el('text', { x: X(a), y: pad.top + ih + 22, class: 'axis-label', 'text-anchor': 'middle' }, opts.xPrefix ? opts.xPrefix + a : a));
    });
    if (opts.xTitle) {
      svg.appendChild(el('text', { x: pad.left + iw / 2, y: h - 4, class: 'axis-title', 'text-anchor': 'middle' }, opts.xTitle));
    }

    /* Marker lines - business start, the crossover, whatever matters. */
    (opts.markers || []).forEach(function (mk, mi) {
      if (mk.x < xMin || mk.x > xMax) { return; }
      svg.appendChild(el('line', { x1: X(mk.x), x2: X(mk.x), y1: pad.top, y2: pad.top + ih, class: 'marker-line' }));
      /* Stack the captions on separate rows. Two markers a few years
         apart otherwise print straight over each other. */
      svg.appendChild(el('text', {
        x: X(mk.x) + 4, y: pad.top + 11 + (mi % 3) * 13, class: 'marker-label',
        'text-anchor': X(mk.x) > pad.left + iw * 0.72 ? 'end' : 'start'
      }, mk.label));
    });

    series.forEach(function (s, si) {
      var d = s.points.map(function (p, i) { return (i ? 'L' : 'M') + X(p.x).toFixed(1) + ' ' + Y(p.y).toFixed(1); }).join(' ');
      if (opts.area) {
        svg.appendChild(el('path', {
          d: d + ' L' + X(s.points[s.points.length - 1].x) + ' ' + Y(ys.lo) + ' L' + X(s.points[0].x) + ' ' + Y(ys.lo) + ' Z',
          fill: s.color, opacity: 0.10, stroke: 'none'
        }));
      }
      svg.appendChild(el('path', { d: d, fill: 'none', stroke: s.color, 'stroke-width': 2.5,
        'stroke-linejoin': 'round', 'stroke-linecap': 'round', class: 'series-line' }));

      /* Direct label at the end of the line: identity without a
         legend lookup, which is what makes it readable on video. */
      var lastPt = s.points[s.points.length - 1];
      var ly = Y(lastPt.y);
      /* Each end label is two lines - a name and a value - so they need a
         full label's height between them, not a few pixels. */
      if (si === 1 && series[0].points.length) {
        var other = Y(series[0].points[series[0].points.length - 1].y);
        if (Math.abs(ly - other) < 32) { ly = other + (ly >= other ? 32 : -32); }
      }
      ly = Math.max(pad.top + 12, Math.min(pad.top + ih - 6, ly));
      svg.appendChild(el('circle', { cx: X(lastPt.x), cy: Y(lastPt.y), r: 4.5, fill: s.color,
        stroke: 'var(--surface-1)', 'stroke-width': 2 }));
      var g = el('g', { class: 'end-label' });
      g.appendChild(el('text', { x: X(lastPt.x) + 9, y: ly - 2, class: 'end-name', fill: s.color }, s.name));
      g.appendChild(el('text', { x: X(lastPt.x) + 9, y: ly + 12, class: 'end-value' }, fmt(lastPt.y)));
      svg.appendChild(g);
    });

    /* Hover layer: one crosshair, both values. An HTML chart that does
       not answer "what is it at 31" is only half a chart. */
    var hover = el('g', { class: 'hover-layer', style: 'display:none' });
    hover.appendChild(el('line', { class: 'crosshair', y1: pad.top, y2: pad.top + ih }));
    var dots = series.map(function (s) {
      var c = el('circle', { r: 5, fill: s.color, stroke: 'var(--surface-1)', 'stroke-width': 2 });
      hover.appendChild(c); return c;
    });
    svg.appendChild(hover);

    var tip = el('g', { class: 'bcb-tip', style: 'display:none' });
    var tipBg = el('rect', { rx: 5, class: 'tip-bg' });
    tip.appendChild(tipBg);
    var tipLines = [el('text', { class: 'tip-head' }), el('text', { class: 'tip-row' }), el('text', { class: 'tip-row' })];
    tipLines.forEach(function (t) { tip.appendChild(t); });
    svg.appendChild(tip);

    var capture = el('rect', { x: pad.left, y: pad.top, width: iw, height: ih, fill: 'transparent', style: 'cursor:crosshair' });
    svg.appendChild(capture);

    function pointerMove(ev) {
      var pt = svg.getBoundingClientRect();
      var rx = (ev.clientX - pt.left) / pt.width * w;
      var age = Math.round(xMin + (rx - pad.left) / iw * (xMax - xMin));
      age = Math.max(xMin, Math.min(xMax, age));
      hover.style.display = '';
      tip.style.display = '';
      hover.firstChild.setAttribute('x1', X(age));
      hover.firstChild.setAttribute('x2', X(age));
      tipLines[0].textContent = (opts.xPrefix || 'Age ') + age;
      series.forEach(function (s, i) {
        var p = s.points.filter(function (q) { return q.x === age; })[0] || s.points[s.points.length - 1];
        dots[i].setAttribute('cx', X(p.x)); dots[i].setAttribute('cy', Y(p.y));
        tipLines[i + 1].textContent = s.name + '  ' + fmt(p.y);
        tipLines[i + 1].setAttribute('fill', s.color);
      });
      var tw = 0;
      tipLines.forEach(function (t) { tw = Math.max(tw, t.getComputedTextLength ? t.getComputedTextLength() : 90); });
      tw += 20;
      var tx = X(age) + 12;
      if (tx + tw > pad.left + iw) { tx = X(age) - tw - 12; }
      tipBg.setAttribute('x', tx); tipBg.setAttribute('y', pad.top + 6);
      tipBg.setAttribute('width', tw); tipBg.setAttribute('height', 60);
      tipLines.forEach(function (t, i) { t.setAttribute('x', tx + 10); t.setAttribute('y', pad.top + 24 + i * 17); });
    }
    capture.addEventListener('mousemove', pointerMove);
    capture.addEventListener('touchmove', function (e) { if (e.touches[0]) { pointerMove(e.touches[0]); } });
    capture.addEventListener('mouseleave', function () { hover.style.display = 'none'; tip.style.display = 'none'; });

    return svg;
  }

  /* -------------------------------------------------------------
     GROUPED BAR CHART - a handful of paired categories.
     ------------------------------------------------------------- */
  function barChart(opts) {
    var w = opts.width || 960, h = opts.height || 360;
    var cats = opts.categories;    /* [{label, a, b}] */
    var fmt = opts.format || fmtMoney;
    var pad = Object.assign({}, PAD, { right: 24, left: 68 }, opts.pad || {});
    var iw = w - pad.left - pad.right, ih = h - pad.top - pad.bottom;

    var vals = [];
    cats.forEach(function (c) { vals.push(c.a, c.b); });
    var ys = niceScale(Math.min(0, Math.min.apply(null, vals)), Math.max.apply(null, vals), 4);
    function Y(v) { return pad.top + ih - (v - ys.lo) / (ys.hi - ys.lo) * ih; }

    var svg = el('svg', { viewBox: '0 0 ' + w + ' ' + h, width: '100%', class: 'bcb-chart', role: 'img',
      'aria-label': opts.title || 'comparison bars' });
    ys.ticks.forEach(function (t) {
      svg.appendChild(el('line', { x1: pad.left, x2: pad.left + iw, y1: Y(t), y2: Y(t), class: t === 0 ? 'grid grid-zero' : 'grid' }));
      svg.appendChild(el('text', { x: pad.left - 9, y: Y(t) + 4, class: 'axis-label', 'text-anchor': 'end' }, fmt(t)));
    });

    var slot = iw / cats.length;
    var barW = Math.min(38, slot * 0.30);
    cats.forEach(function (c, i) {
      var cx = pad.left + slot * (i + 0.5);
      [[c.a, opts.colorA, -1], [c.b, opts.colorB, 1]].forEach(function (pair) {
        var v = pair[0], colour = pair[1], side = pair[2];
        /* 2px surface gap between the pair, per the mark spec. */
        var x = cx + side * 1 + (side < 0 ? -barW : 0);
        var y = Math.min(Y(v), Y(0)), bh = Math.abs(Y(v) - Y(0));
        var r = el('rect', { x: x, y: y, width: barW, height: Math.max(1, bh), fill: colour, rx: 4 });
        r.appendChild(el('title', null, c.label + ': ' + fmt(v)));
        svg.appendChild(r);
      });
      svg.appendChild(el('text', { x: cx, y: pad.top + ih + 20, class: 'axis-label', 'text-anchor': 'middle' }, c.label));
    });
    return svg;
  }

  /* -------------------------------------------------------------
     RADAR - the eight lifestyle components.
     Two overlapping shapes is the readable limit, which is exactly
     what this tool needs.
     ------------------------------------------------------------- */
  function radarChart(opts) {
    var size = opts.size || 420;
    var cx = size / 2, cy = size / 2 + 6, R = size * 0.33;
    var axes = opts.axes;      /* [{label, a, b}] each 0-10 */
    var n = axes.length;
    var svg = el('svg', { viewBox: '0 0 ' + size + ' ' + size, width: '100%', class: 'bcb-chart bcb-radar',
      role: 'img', 'aria-label': opts.title || 'lifestyle comparison' });

    function pt(i, v) {
      var ang = -Math.PI / 2 + i / n * Math.PI * 2;
      var r = v / 10 * R;
      return [cx + Math.cos(ang) * r, cy + Math.sin(ang) * r];
    }
    [2, 4, 6, 8, 10].forEach(function (ring) {
      var d = axes.map(function (_, i) { var p = pt(i, ring); return (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1); }).join(' ') + ' Z';
      svg.appendChild(el('path', { d: d, class: 'grid', fill: 'none' }));
    });
    axes.forEach(function (ax, i) {
      var p = pt(i, 10);
      svg.appendChild(el('line', { x1: cx, y1: cy, x2: p[0], y2: p[1], class: 'grid' }));
      var lp = pt(i, 12.1);
      var anchor = Math.abs(lp[0] - cx) < 12 ? 'middle' : (lp[0] > cx ? 'start' : 'end');
      svg.appendChild(el('text', { x: lp[0], y: lp[1] + 4, class: 'radar-label', 'text-anchor': anchor }, ax.label));
    });
    [['a', opts.colorA], ['b', opts.colorB]].forEach(function (pair) {
      var key = pair[0], colour = pair[1];
      var d = axes.map(function (ax, i) { var p = pt(i, ax[key]); return (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1); }).join(' ') + ' Z';
      svg.appendChild(el('path', { d: d, fill: colour, 'fill-opacity': 0.14, stroke: colour, 'stroke-width': 2.5, 'stroke-linejoin': 'round' }));
      axes.forEach(function (ax, i) {
        var p = pt(i, ax[key]);
        var c = el('circle', { cx: p[0], cy: p[1], r: 4, fill: colour, stroke: 'var(--surface-1)', 'stroke-width': 1.5 });
        c.appendChild(el('title', null, ax.label + ': ' + ax[key] + '/10'));
        svg.appendChild(c);
      });
    });
    return svg;
  }

  /* -------------------------------------------------------------
     Horizontal score bars - the BCB 100 breakdown.
     ------------------------------------------------------------- */
  function scoreBars(opts) {
    var rows = opts.rows;   /* [{label, a, b, max}] */
    var w = opts.width || 960;
    var rowH = 30, labelW = 190;
    var h = rows.length * rowH + 16;
    var svg = el('svg', { viewBox: '0 0 ' + w + ' ' + h, width: '100%', class: 'bcb-chart', role: 'img',
      'aria-label': opts.title || 'score breakdown' });
    var trackW = w - labelW - 66;
    rows.forEach(function (r, i) {
      var y = 8 + i * rowH;
      svg.appendChild(el('text', { x: 0, y: y + 15, class: 'bar-label' }, r.label));
      svg.appendChild(el('rect', { x: labelW, y: y + 3, width: trackW, height: 9, rx: 4.5, class: 'track' }));
      svg.appendChild(el('rect', { x: labelW, y: y + 3, width: Math.max(2, r.a / (r.max || 10) * trackW), height: 9, rx: 4.5, fill: opts.colorA }));
      svg.appendChild(el('rect', { x: labelW, y: y + 16, width: trackW, height: 9, rx: 4.5, class: 'track' }));
      svg.appendChild(el('rect', { x: labelW, y: y + 16, width: Math.max(2, r.b / (r.max || 10) * trackW), height: 9, rx: 4.5, fill: opts.colorB }));
      svg.appendChild(el('text', { x: w - 60, y: y + 12, class: 'bar-value', fill: opts.colorA }, r.a));
      svg.appendChild(el('text', { x: w - 24, y: y + 25, class: 'bar-value', fill: opts.colorB }, r.b));
    });
    return svg;
  }

  /* Stacked composition of the final net worth - what it is made of. */
  function stackChart(opts) {
    var w = opts.width || 960, h = 170;
    var cols = opts.columns;   /* [{name, parts:[{label,value,color}]}] */
    var svg = el('svg', { viewBox: '0 0 ' + w + ' ' + h, width: '100%', class: 'bcb-chart', role: 'img',
      'aria-label': opts.title || 'net worth composition' });
    var maxTotal = 0;
    cols.forEach(function (c) {
      var t = 0; c.parts.forEach(function (p) { t += Math.max(0, p.value); });
      maxTotal = Math.max(maxTotal, t);
    });
    var barH = 40, gap = 26, left = 130, trackW = w - left - 90;
    cols.forEach(function (c, ci) {
      var y = 14 + ci * (barH + gap);
      svg.appendChild(el('text', { x: 0, y: y + barH / 2 + 5, class: 'bar-label' }, c.name));
      var x = left;
      c.parts.forEach(function (p) {
        if (p.value <= 0) { return; }
        var pw = p.value / maxTotal * trackW;
        var r = el('rect', { x: x, y: y, width: Math.max(1, pw - 2), height: barH, fill: p.color, rx: 3 });
        r.appendChild(el('title', null, p.label + ': ' + fmtMoney(p.value)));
        svg.appendChild(r);
        if (pw > 54) {
          svg.appendChild(el('text', { x: x + pw / 2 - 1, y: y + barH / 2 + 4, class: 'stack-label', 'text-anchor': 'middle' }, fmtMoney(p.value)));
        }
        x += pw;
      });
      svg.appendChild(el('text', { x: x + 8, y: y + barH / 2 + 5, class: 'stack-total' }, fmtMoney(opts.totals[ci])));
    });
    return svg;
  }

  BCB.charts = {
    lineChart: lineChart, barChart: barChart, radarChart: radarChart,
    scoreBars: scoreBars, stackChart: stackChart,
    fmtMoney: fmtMoney, fmtNum: fmtNum, niceScale: niceScale, el: el
  };

})(typeof window !== 'undefined' ? window : globalThis);
