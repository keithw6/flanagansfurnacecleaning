/* Penny's monthly expense report as a PDF, built in the browser with no
   libraries: Helvetica text, simple tables and the receipt photos (JPEG).
   HP_EXPENSE_PDF.build({month, items, photos, made}) -> Promise<Uint8Array>
     month  'YYYY-MM'
     items  [{date, vendor, category, amount, gst, paidWith, note, photoId}]
     photos { photoId: {bytes: Uint8Array, w, h} }   JPEG bytes and size      */
(function (root) {
  'use strict';
  const W = 612, H = 792, M = 42;                       // US Letter, margins
  const GREEN = [0.247, 0.667, 0.208], INK = [0.13, 0.13, 0.13], DIM = [0.42, 0.42, 0.42], LINE = [0.85, 0.87, 0.85];
  const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const money = n => '$' + Number(n || 0).toLocaleString('en-CA', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  // Where an expense came from: a card statement (by card) or a receipt entered in the arcade
  const sourceOf = x => x && x.enteredIn === 'statement' ? (x.paidWith || 'Card statement') : 'Receipts';
  const longDate = iso => { const [y, m, d] = iso.split('-').map(Number); return `${MONTHS[m - 1].slice(0, 3)} ${d}, ${y}`; };

  // Helvetica widths (1/1000 em) for ASCII 32..126; others ~556
  const HW = [278,278,355,556,556,889,667,191,333,333,389,584,278,333,278,278,556,556,556,556,556,556,556,556,556,556,278,278,584,584,584,556,1015,667,667,722,722,667,611,778,722,278,500,667,556,833,722,778,667,778,722,667,611,722,667,944,667,667,611,278,278,278,469,556,333,556,556,500,556,556,278,556,556,222,222,500,222,833,556,556,556,556,333,500,278,556,500,722,500,500,500,334,260,334,584];
  const HBW = [278,333,474,556,556,889,722,238,333,333,389,584,278,333,278,278,556,556,556,556,556,556,556,556,556,556,333,333,584,584,584,611,975,722,722,722,722,667,611,778,722,278,556,722,611,833,722,778,667,778,722,667,611,722,667,944,667,667,611,333,278,333,584,556,333,556,611,556,611,556,333,611,611,278,278,556,278,889,611,611,611,611,389,556,333,611,556,778,556,556,500,389,280,389,584];
  const clean = s => String(s == null ? '' : s).replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/[–—]/g, '-').replace(/…/g, '...').replace(/[^\x20-\x7e\xa0-\xff]/g, '?');
  const width = (s, size, bold) => { let w = 0; for (const ch of clean(s)) { const c = ch.charCodeAt(0); w += (c >= 32 && c <= 126 ? (bold ? HBW : HW)[c - 32] : 556); } return w * size / 1000; };
  const fit = (s, size, max, bold) => { s = clean(s); if (width(s, size, bold) <= max) return s; while (s.length > 1 && width(s + '...', size, bold) > max) s = s.slice(0, -1); return s + '...'; };
  const esc = s => clean(s).replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
  const rgb = c => c.map(v => v.toFixed(3)).join(' ');

  function Page() { this.ops = []; this.imgs = []; }
  Page.prototype.text = function (x, y, s, o = {}) {
    const size = o.size || 10, f = o.bold ? 'F2' : 'F1';
    let tx = x; if (o.align === 'right') tx = x - width(s, size, o.bold); else if (o.align === 'center') tx = x - width(s, size, o.bold) / 2;
    this.ops.push(`BT /${f} ${size} Tf ${rgb(o.color || INK)} rg ${tx.toFixed(2)} ${(H - y).toFixed(2)} Td (${esc(s)}) Tj ET`);
  };
  Page.prototype.rect = function (x, y, w, h, color) { this.ops.push(`${rgb(color)} rg ${x.toFixed(2)} ${(H - y - h).toFixed(2)} ${w.toFixed(2)} ${h.toFixed(2)} re f`); };
  Page.prototype.line = function (x1, y1, x2, y2, color, lw) { this.ops.push(`${rgb(color || LINE)} RG ${lw || 0.6} w ${x1} ${H - y1} m ${x2} ${H - y2} l S`); };
  Page.prototype.image = function (name, x, y, w, h) { this.ops.push(`q ${w.toFixed(2)} 0 0 ${h.toFixed(2)} ${x.toFixed(2)} ${(H - y - h).toFixed(2)} cm /${name} Do Q`); this.imgs.push(name); };

  function header(p, title, sub) {
    p.rect(0, 0, W, 6, GREEN);
    p.text(M, 40, 'HOME PROS GROUP', { size: 15, bold: true, color: GREEN });
    p.text(M, 54, 'Furnace, Duct & Dryer Vent Cleaning  |  53 Umbach Rd, Stony Plain, AB  |  780-932-7337', { size: 8, color: DIM });
    p.text(W - M, 40, title, { size: 13, bold: true, align: 'right' });
    p.text(W - M, 54, sub, { size: 8, color: DIM, align: 'right' });
    p.line(M, 64, W - M, 64, GREEN, 1.2);
  }

  async function build({ month, items, photos, made }) {
    const [y, m] = month.split('-').map(Number);
    const title = `Expense report: ${MONTHS[m - 1]} ${y}`;
    const sub = `Prepared by Penny (Accounts), ${made}`;
    items = items.slice().sort((a, b) => (a.date + a.vendor).localeCompare(b.date + b.vendor));
    const pages = [];
    let p = new Page(); pages.push(p); header(p, title, sub);
    const tot = items.reduce((s, x) => s + Number(x.amount || 0), 0), gst = items.reduce((s, x) => s + Number(x.gst || 0), 0);
    const meals = items.filter(x => /meal/i.test(x.category || '')).reduce((s, x) => s + Number(x.amount || 0), 0);

    // summary boxes
    let yy = 82;
    const box = (x, w, label, val) => { p.rect(x, yy, w, 44, [0.95, 0.97, 0.95]); p.text(x + 10, yy + 16, label, { size: 8, color: DIM }); p.text(x + 10, yy + 35, val, { size: 14, bold: true }); };
    const bw = (W - 2 * M - 24) / 4;
    box(M, bw, 'Items', String(items.length));
    box(M + bw + 8, bw, 'Total paid (incl. GST)', money(tot));
    box(M + 2 * (bw + 8), bw, 'GST paid (ITCs)', money(gst));
    box(M + 3 * (bw + 8), bw, 'Before GST', money(tot - gst));
    yy += 66;

    // by category
    p.text(M, yy, 'BY CATEGORY', { size: 9, bold: true, color: GREEN }); yy += 14;
    const cats = {};
    for (const x of items) { const c = x.category || 'Other'; cats[c] = cats[c] || { n: 0, a: 0, g: 0 }; cats[c].n++; cats[c].a += Number(x.amount || 0); cats[c].g += Number(x.gst || 0); }
    const cx = [M, M + 300, M + 380, W - M];
    p.text(cx[0], yy, 'Category', { size: 8, color: DIM }); p.text(cx[1], yy, 'Receipts', { size: 8, color: DIM, align: 'right' });
    p.text(cx[2] + 60, yy, 'GST', { size: 8, color: DIM, align: 'right' }); p.text(cx[3], yy, 'Total', { size: 8, color: DIM, align: 'right' }); yy += 5; p.line(M, yy, W - M, yy);
    for (const [c, v] of Object.entries(cats).sort((a, b) => b[1].a - a[1].a)) {
      yy += 14; p.text(cx[0], yy, fit(c, 9, 280)); p.text(cx[1], yy, String(v.n), { size: 9, align: 'right' }); p.text(cx[2] + 60, yy, money(v.g), { size: 9, align: 'right' }); p.text(cx[3], yy, money(v.a), { size: 9, align: 'right' });
    }
    yy += 6; p.line(M, yy, W - M, yy); yy += 14;
    p.text(cx[0], yy, 'Total', { size: 9, bold: true }); p.text(cx[1], yy, String(items.length), { size: 9, bold: true, align: 'right' });
    p.text(cx[2] + 60, yy, money(gst), { size: 9, bold: true, align: 'right' }); p.text(cx[3], yy, money(tot), { size: 9, bold: true, align: 'right' });
    // by source: receipts and each card statement, combined above
    const srcs = {};
    for (const x of items) { const c = sourceOf(x); srcs[c] = srcs[c] || { n: 0, a: 0, g: 0 }; srcs[c].n++; srcs[c].a += Number(x.amount || 0); srcs[c].g += Number(x.gst || 0); }
    if (Object.keys(srcs).length) {
      yy += 24; p.text(M, yy, 'BY SOURCE', { size: 9, bold: true, color: GREEN }); yy += 14;
      p.text(cx[0], yy, 'Source', { size: 8, color: DIM }); p.text(cx[1], yy, 'Items', { size: 8, color: DIM, align: 'right' });
      p.text(cx[2] + 60, yy, 'GST', { size: 8, color: DIM, align: 'right' }); p.text(cx[3], yy, 'Total', { size: 8, color: DIM, align: 'right' }); yy += 5; p.line(M, yy, W - M, yy);
      for (const [c, v] of Object.entries(srcs).sort((a, b) => (a[0] === 'Receipts' ? -1 : b[0] === 'Receipts' ? 1 : a[0].localeCompare(b[0])))) {
        yy += 14; p.text(cx[0], yy, fit(c, 9, 280)); p.text(cx[1], yy, String(v.n), { size: 9, align: 'right' }); p.text(cx[2] + 60, yy, money(v.g), { size: 9, align: 'right' }); p.text(cx[3], yy, money(v.a), { size: 9, align: 'right' });
      }
      yy += 6; p.line(M, yy, W - M, yy); yy += 14;
      p.text(cx[0], yy, 'Combined', { size: 9, bold: true }); p.text(cx[1], yy, String(items.length), { size: 9, bold: true, align: 'right' });
      p.text(cx[2] + 60, yy, money(gst), { size: 9, bold: true, align: 'right' }); p.text(cx[3], yy, money(tot), { size: 9, bold: true, align: 'right' });
    }
    if (meals) { yy += 16; p.text(M, yy, `Meals are 50% deductible: ${money(meals)} spent, ${money(meals / 2)} deductible.`, { size: 8, color: DIM }); }
    const reimb = items.filter(x => x.reimburse);
    if (reimb.length) { yy += 16; p.text(M, yy, `Paid personally and owed back: ${reimb.map(x => x.reimburse).filter((v, i, a) => a.indexOf(v) === i).join(', ')} ${money(reimb.reduce((s, x) => s + Number(x.amount || 0), 0))} (${reimb.length} item${reimb.length === 1 ? '' : 's'}, marked * below).`, { size: 8, bold: true }); }
    yy += 26;

    // every receipt
    const col = [M, M + 62, M + 210, M + 330, M + 412, W - M - 62, W - M];
    const tableHead = () => {
      p.text(M, yy, 'ALL EXPENSES (RECEIPTS AND CARD STATEMENTS)', { size: 9, bold: true, color: GREEN }); yy += 14;
      ['Date', 'Where', 'Category', 'Source'].forEach((h, i) => p.text(col[i], yy, h, { size: 8, color: DIM }));
      p.text(col[5], yy, 'GST', { size: 8, color: DIM, align: 'right' }); p.text(col[6], yy, 'Amount', { size: 8, color: DIM, align: 'right' });
      yy += 5; p.line(M, yy, W - M, yy);
    };
    tableHead();
    const photoNo = {}; let pn = 0;
    items.forEach(x => { if (x.photoId && photos[x.photoId]) photoNo[x.photoId + '|' + x.date + '|' + x.amount] = ++pn; });
    const tag = x => photoNo[x.photoId + '|' + x.date + '|' + x.amount];
    items.forEach((x, i) => {
      const rowH = x.note ? 26 : 15;
      if (yy + rowH > H - 50) { p = new Page(); pages.push(p); header(p, title, sub); yy = 84; tableHead(); }
      yy += 13;
      p.text(col[0], yy, longDate(x.date), { size: 8.5 });
      const mark = tag(x) ? '  [photo ' + tag(x) + ']' : '';
      p.text(col[1], yy, fit(x.vendor, 8.5, 142 - width(mark, 8.5)) + mark, { size: 8.5 });
      p.text(col[2], yy, fit(x.category, 8.5, 116), { size: 8.5 });
      const card = String(x.paidWith || ''), l4 = (card.match(/(\d{4})\s*$/) || [])[1], kind = /master/i.test(card) ? 'MC' : /visa/i.test(card) ? 'Visa' : 'Card';
      p.text(col[3], yy, fit(x.enteredIn === 'statement' ? (l4 ? `${kind} ${l4}` : card) : 'Receipt', 8.5, 78), { size: 8.5 });
      p.text(col[5], yy, money(x.gst), { size: 8.5, align: 'right' });
      p.text(col[6], yy, money(x.amount) + (x.reimburse ? '*' : ''), { size: 8.5, align: 'right' });
      if (x.note) { yy += 11; p.text(col[1], yy, fit(x.note, 7.5, W - M - col[1] - 70), { size: 7.5, color: DIM }); }
      yy += 3; p.line(M, yy, W - M, yy, [0.92, 0.93, 0.92], 0.4);
    });
    if (!items.length) { yy += 16; p.text(M, yy, 'No receipts filed for this month yet.', { size: 9, color: DIM }); }
    yy += 22;
    if (yy > H - 70) { p = new Page(); pages.push(p); header(p, title, sub); yy = 90; }
    p.text(M, yy, 'Amounts include GST. GST paid is claimable as input tax credits. Keep the paper receipts; photos follow on the next pages.', { size: 7.5, color: DIM });

    // receipt photos, two per page
    const withPhoto = items.filter(x => tag(x)).map(x => ({ x, i: tag(x) }));
    const images = {};
    for (let k = 0; k < withPhoto.length; k++) {
      if (k % 2 === 0) { p = new Page(); pages.push(p); header(p, title, sub); }
      const { x, i } = withPhoto[k], ph = photos[x.photoId], name = 'Im' + (k + 1);
      images[name] = ph;
      const top = k % 2 === 0 ? 80 : 80 + (H - 120) / 2, boxH = (H - 120) / 2 - 30, boxW = W - 2 * M;
      p.text(M, top + 10, `[photo ${i}] ${longDate(x.date)}  -  ${fit(x.vendor, 10, 300, true)}  -  ${money(x.amount)}`, { size: 10, bold: true });
      const s = Math.min(boxW / ph.w, (boxH - 16) / ph.h), w = ph.w * s, h = ph.h * s;
      p.image(name, M + (boxW - w) / 2, top + 18, w, h);
    }
    pages.forEach((pg, n) => pg.text(W / 2, H - 22, `${title}  |  page ${n + 1} of ${pages.length}`, { size: 7.5, color: DIM, align: 'center' }));

    return assemble(pages, images);
  }

  // A profit and loss statement: one page, a label column and value columns.
  // lines: [{label, values: [number|null], bold, indent, rule, dim, note}]
  function buildPL({ title, sub, cols, lines, notes }) {
    const p = new Page(); header(p, title, sub);
    let yy = 92;
    const right = [W - M - 110, W - M];
    cols.forEach((c, i) => p.text(right[i], yy, c, { size: 9, bold: true, align: 'right', color: GREEN }));
    yy += 6; p.line(M, yy, W - M, yy, GREEN, 0.8);
    for (const l of lines) {
      if (l.gap) { yy += 10; continue; }
      if (l.head) { yy += 18; p.text(M, yy, l.head, { size: 9, bold: true, color: GREEN }); yy += 2; continue; }
      yy += 15;
      if (l.rule) { p.line(M, yy - 11, W - M, yy - 11); }
      p.text(M + (l.indent ? 14 : 0), yy, fit(l.label, l.bold ? 10 : 9.5, 300, l.bold), { size: l.bold ? 10 : 9.5, bold: !!l.bold, color: l.dim ? DIM : INK });
      (l.values || []).forEach((v, i) => { if (v != null) p.text(right[i], yy, (v < 0 ? '-' : '') + money(Math.abs(v)), { size: l.bold ? 10 : 9.5, bold: !!l.bold, align: 'right', color: l.dim ? DIM : INK }); });
      if (l.note) { yy += 11; p.text(M + (l.indent ? 14 : 0), yy, fit(l.note, 7.5, W - 2 * M - 30), { size: 7.5, color: DIM }); }
    }
    yy += 30;
    for (const n of notes || []) { p.text(M, yy, fit(n, 7.5, W - 2 * M), { size: 7.5, color: DIM }); yy += 11; }
    p.text(W / 2, H - 22, title, { size: 7.5, color: DIM, align: 'center' });
    return assemble([p], {});
  }

  // A multi-page report of tables (the accountant package). Runs onto new pages as needed.
  // sections: [{head, intro: [lines], cols: [{label, w, align}], rows: [[cell...]], total: [cell...], bold: [rowIndex]}]
  // cells are strings (already formatted); a column w is its share of the page width.
  function buildReport({ title, sub, summary, sections, notes }) {
    const pages = [];
    let p, yy;
    const top = 92, bottom = H - 48, full = W - 2 * M;
    const newPage = () => { p = new Page(); header(p, title, sub); pages.push(p); yy = top; };
    const need = h => { if (yy + h > bottom) { newPage(); return true; } return false; };
    newPage();
    if (summary && summary.length) {
      const bw = (full - 10 * (summary.length - 1)) / summary.length;
      summary.forEach((s, i) => {
        const x = M + i * (bw + 10);
        p.rect(x, yy - 4, bw, 44, [0.94, 0.97, 0.94]);
        p.text(x + 8, yy + 10, fit(s.label, 7.5, bw - 16), { size: 7.5, color: DIM });
        p.text(x + 8, yy + 30, fit(s.value, 13, bw - 16, true), { size: 13, bold: true });
      });
      yy += 58;
    }
    for (const sec of sections) {
      const cols = sec.cols || [], tw = cols.reduce((a, c) => a + (c.w || 1), 0);
      const xs = []; let acc = M; cols.forEach(c => { const w = full * (c.w || 1) / tw; xs.push({ x: acc, w }); acc += w; });
      const colHead = () => {
        if (!cols.length) return;
        yy += 14;
        cols.forEach((c, i) => p.text(c.align === 'right' ? xs[i].x + xs[i].w - 4 : xs[i].x, yy, fit(c.label, 7.5, xs[i].w - 6, true), { size: 7.5, bold: true, color: GREEN, align: c.align === 'right' ? 'right' : undefined }));
        yy += 4; p.line(M, yy, W - M, yy, GREEN, 0.6);
      };
      const row = (cells, bold) => {
        if (need(13)) colHead();
        yy += 12;
        cells.forEach((v, i) => { if (!cols[i]) return; const right = cols[i].align === 'right'; p.text(right ? xs[i].x + xs[i].w - 4 : xs[i].x, yy, fit(v, 8, xs[i].w - 6, bold), { size: 8, bold, align: right ? 'right' : undefined }); });
      };
      need(60);
      yy += 22; p.text(M, yy, sec.head, { size: 10, bold: true, color: GREEN });
      for (const l of sec.intro || []) { need(11); yy += 11; p.text(M, yy, fit(l, 7.5, full), { size: 7.5, color: DIM }); }
      if (!(sec.rows || []).length && sec.empty) { yy += 13; p.text(M, yy, sec.empty, { size: 8.5, color: DIM }); continue; }
      colHead();
      (sec.rows || []).forEach((r, k) => row(r, (sec.bold || []).includes(k)));
      if (sec.total) { need(16); yy += 3; p.line(M, yy, W - M, yy, INK, 0.6); row(sec.total, true); }
    }
    if (notes && notes.length) {
      need(30); yy += 22; p.text(M, yy, 'NOTES', { size: 9, bold: true, color: GREEN });
      for (const n of notes) {
        // wrap long notes
        const words = clean(n).split(' '); let lineS = '';
        const flush = () => { need(11); yy += 11; p.text(M, yy, lineS, { size: 7.5, color: DIM }); lineS = ''; };
        for (const w of words) { if (width(lineS + ' ' + w, 7.5) > full && lineS) flush(); lineS = lineS ? lineS + ' ' + w : w; }
        if (lineS) flush();
        yy += 3;
      }
    }
    pages.forEach((pg, i) => pg.text(W / 2, H - 22, `${clean(title)}  |  page ${i + 1} of ${pages.length}`, { size: 7.5, color: DIM, align: 'center' }));
    return assemble(pages, {});
  }

  function assemble(pages, images) {
    const enc = new TextEncoder(), latin = s => Uint8Array.from(s, c => c.charCodeAt(0) & 255);
    const parts = [], offsets = [];
    let len = 0;
    const push = b => { parts.push(b); len += b.length; };
    const obj = (n, body) => { offsets[n] = len; push(latin(`${n} 0 obj\n`)); for (const b of [].concat(body)) push(typeof b === 'string' ? latin(b) : b); push(latin('\nendobj\n')); };
    push(latin('%PDF-1.4\n%\xe2\xe3\xcf\xd3\n'));
    const names = Object.keys(images), imgObj = {};
    let n = 5;
    names.forEach(nm => { imgObj[nm] = n++; });
    const pageObjs = pages.map(() => { const a = n; n += 2; return a; });
    obj(1, '<< /Type /Catalog /Pages 2 0 R >>');
    obj(2, `<< /Type /Pages /Kids [${pageObjs.map(o => o + ' 0 R').join(' ')}] /Count ${pages.length} >>`);
    obj(3, '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>');
    obj(4, '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>');
    names.forEach(nm => {
      const im = images[nm];
      obj(imgObj[nm], [`<< /Type /XObject /Subtype /Image /Width ${im.w} /Height ${im.h} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${im.bytes.length} >>\nstream\n`, im.bytes, '\nendstream']);
    });
    pages.forEach((pg, i) => {
      const content = latin(pg.ops.join('\n'));
      const xo = [...new Set(pg.imgs)].map(nm => `/${nm} ${imgObj[nm]} 0 R`).join(' ');
      obj(pageObjs[i], `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${W} ${H}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >>${xo ? ' /XObject << ' + xo + ' >>' : ''} >> /Contents ${pageObjs[i] + 1} 0 R >>`);
      obj(pageObjs[i] + 1, [`<< /Length ${content.length} >>\nstream\n`, content, '\nendstream']);
    });
    const xref = len, count = n;
    let x = `xref\n0 ${count}\n0000000000 65535 f \n`;
    for (let k = 1; k < count; k++) x += String(offsets[k] || 0).padStart(10, '0') + ' 00000 n \n';
    push(latin(x + `trailer\n<< /Size ${count} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`));
    const out = new Uint8Array(len); let o = 0; for (const b of parts) { out.set(b, o); o += b.length; }
    void enc;
    return out;
  }

  // Turn any image (from a URL or Blob) into baseline JPEG bytes + size, so the PDF can embed it.
  async function jpeg(src) {
    const blob = src instanceof Blob ? src : await (await fetch(src)).blob();
    const bmp = await createImageBitmap(blob);
    const k = Math.min(1, 1400 / Math.max(bmp.width, bmp.height));
    const c = document.createElement('canvas');
    c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
    const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height); g.drawImage(bmp, 0, 0, c.width, c.height);
    const out = await new Promise(r => c.toBlob(r, 'image/jpeg', 0.82));
    return { bytes: new Uint8Array(await out.arrayBuffer()), w: c.width, h: c.height };
  }

  root.HP_EXPENSE_PDF = { sourceOf, buildPL, buildReport, build, jpeg, MONTHS, money };
})(window);
