/* Card and bank statements for Penny: turn an uploaded PDF (or photos) into page
   images, have Claude read the transactions, and hand them to Penny's interview.
   HP_STATEMENT.pages(files)      -> Promise<Blob[]>  one JPEG per page (max 12)
   HP_STATEMENT.read(pages, opts) -> Promise<{statement, transactions}>
   PDF pages are drawn with pdf.js (loaded from cdnjs the first time it's needed). */
(function (root) {
  'use strict';
  const PDFJS = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/';
  const MAX_PAGES = 20;          // per statement file
  let pdfjsP = null;

  function script(src) {
    return new Promise((ok, bad) => { const s = document.createElement('script'); s.src = src; s.onload = ok; s.onerror = () => bad(new Error('load ' + src)); document.head.appendChild(s); });
  }
  function pdfjs() {
    if (!pdfjsP) pdfjsP = (async () => {
      // the worker script as a plain script gives pdf.js a "fake worker": no Worker or blob: URLs needed
      await script(PDFJS + 'pdf.min.js');
      await script(PDFJS + 'pdf.worker.min.js');
      root.pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS + 'pdf.worker.min.js';
      return root.pdfjsLib;
    })().catch(e => { pdfjsP = null; throw e; });
    return pdfjsP;
  }
  const toJpeg = c => new Promise(r => c.toBlob(r, 'image/jpeg', 0.85));

  async function imageToJpeg(file) {
    const bmp = await createImageBitmap(file);
    const k = Math.min(1, 1800 / Math.max(bmp.width, bmp.height));
    const c = document.createElement('canvas');
    c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
    const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height); g.drawImage(bmp, 0, 0, c.width, c.height);
    return toJpeg(c);
  }

  // The text of a PDF, page by page, rebuilt into lines (most bank statements are real text).
  async function pdfText(file) {
    const lib = await pdfjs();
    const doc = await lib.getDocument({ data: new Uint8Array(await file.arrayBuffer()), isEvalSupported: false }).promise;
    const out = [];
    for (let i = 1; i <= Math.min(doc.numPages, 30); i++) {
      const tc = await (await doc.getPage(i)).getTextContent();
      const rows = [];
      for (const it of tc.items) {
        if (!it.str || !it.str.trim()) continue;
        const y = it.transform[5], x = it.transform[4];
        let r = rows.find(r => Math.abs(r.y - y) < 3);
        if (!r) { r = { y, parts: [] }; rows.push(r); }
        r.parts.push({ x, s: it.str, w: it.width || 0 });
      }
      rows.sort((a, b) => b.y - a.y);
      const lines = rows.map(r => { r.parts.sort((a, b) => a.x - b.x); let line = '', end = null; for (const q of r.parts) { if (end != null) line += (q.x - end > 12 ? '   ' : q.x - end > 1.5 ? ' ' : ''); line += q.s; end = q.x + q.w; } return line; });
      out.push(`--- page ${i} ---\n` + lines.join('\n'));
    }
    return out.join('\n');
  }

  // What to send for reading: the PDF's own text when it has some, else page images.
  async function prepare(file) {
    if (file.type === 'application/pdf' || /\.pdf$/i.test(file.name || '')) {
      try { const text = await pdfText(file); if (text.replace(/\s/g, '').length > 400) return { text }; } catch (e) { }
    }
    return { images: await pages([file]) };
  }

  async function pages(files) {
    const out = [];
    for (const f of files) {
      if (out.length >= MAX_PAGES) break;
      if (f.type === 'application/pdf' || /\.pdf$/i.test(f.name || '')) {
        const lib = await pdfjs();
        const doc = await lib.getDocument({ data: new Uint8Array(await f.arrayBuffer()), isEvalSupported: false }).promise;
        for (let i = 1; i <= doc.numPages && out.length < MAX_PAGES; i++) {
          const pg = await doc.getPage(i);
          const v0 = pg.getViewport({ scale: 1 }), scale = Math.min(2, 1600 / Math.max(v0.width, v0.height));
          const v = pg.getViewport({ scale });
          const c = document.createElement('canvas'); c.width = Math.ceil(v.width); c.height = Math.ceil(v.height);
          const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height);
          await pg.render({ canvasContext: g, viewport: v }).promise;
          out.push(await toJpeg(c));
        }
      } else if (/^image\//.test(f.type)) out.push(await imageToJpeg(f));
    }
    return out;
  }

  function prompt(categories, from, to) {
    const today = new Date().toISOString().slice(0, 10);
    return 'These images are pages ' + from + ' to ' + to + ' of a credit card or bank statement belonging to Keith Wick, owner of Home Pros Group, '
      + 'a furnace, duct and dryer vent cleaning company in Stony Plain, Alberta, with one service van (a 2012 Chevrolet Express) and a truck-mounted compressor. Today is ' + today + '. '
      + 'Read every transaction on these pages and answer with JSON only, no other text: '
      + '{"statement":{"type":"card or bank","card":"card name, e.g. Visa or Mastercard, or the bank account, e.g. TD Business Chequing","last4":"last 4 digits if shown","holder":"cardholder name as printed","period":"statement period as printed","from":"YYYY-MM-DD","to":"YYYY-MM-DD","year":number,'
      + '"purchasesTotal":number or null (add up the statement\'s own printed summary totals for the period: purchases and other charges, PLUS fees, PLUS interest, PLUS cash advances; null if not shown),"creditsTotal":number or null,'
      + '"depositsTotal":number or null (bank only: total deposits/credits printed for the period),"withdrawalsTotal":number or null (bank only: total withdrawals/debits printed),"openingBalance":number or null,"closingBalance":number or null},'
      + '"transactions":[{"date":"YYYY-MM-DD (the transaction date, use the statement period to get the year right)","description":"merchant as printed",'
      + '"amount":number (positive for purchases and charges, negative for refunds and credits),"kind":"purchase|refund|fee|interest|payment|deposit|withdrawal|transfer|other",'
      + '"category":"one of: ' + categories.join('; ') + '",'
      + '"business":"likely|maybe|personal",'
      + '"question":"one short, friendly question to ask Keith when it is not clearly business, else empty"}]}. '
      + 'List EVERY transaction line printed on these pages, one entry per line, even if there are many; never summarize, merge or skip lines. '
      + 'Include purchases, refunds, card fees and interest; leave out payments made to the card. '
      + 'Likely business: fuel, auto parts and repairs, tires, tools, hardware and building supply, HVAC and compressor suppliers, phone and internet, software, advertising, vehicle insurance and registration. '
      + 'Maybe (ask): restaurants and coffee (client or crew meal?), Costco, Walmart, Amazon, Canadian Tire, Home Depot when the item is unclear, hotels, travel, subscriptions. '
      + 'Likely personal (still list them, ask to confirm): groceries, clothing, entertainment, streaming, pharmacy, liquor, personal care. '
      + 'If this is a BANK account statement (chequing or savings) set statement.type to "bank" and: every deposit or credit is kind "deposit" (amount positive, business "likely" for customer payments, e-transfers received, Jayman or ServiceMonster deposits, else "maybe"); every cheque, pre-authorized debit, bill payment, e-transfer sent, debit card purchase, withdrawal or bank fee is kind "withdrawal" or "fee" (amount positive) and is judged business or personal like a card purchase; a payment to one of Keith\'s own credit cards is kind "payment"; a transfer between his own accounts is kind "transfer"; money out that is not an expense (payroll paid to Keith or staff, CRA payroll remittances, GST or income tax payments, loan principal, owner draws) is kind "other". '
      + 'Never guess an amount you cannot read: skip that line instead of inventing it.';
  }

  function finish(all) {
    const ok = t => t && /^\d{4}-\d\d-\d\d$/.test(t.date || '') && !isNaN(Number(t.amount));
    // bank deposits are kept on their own (money in, never an expense); transfers between Keith's own accounts are dropped
    all.deposits = all.transactions.filter(t => ok(t) && t.kind === 'deposit').map(t => ({ date: t.date, description: t.description, amount: Math.abs(Number(t.amount)), business: t.business || '' })).sort((a, b) => a.date.localeCompare(b.date));
    all.otherOut = all.transactions.filter(t => ok(t) && t.kind === 'other').map(t => ({ date: t.date, description: t.description, amount: Math.abs(Number(t.amount)) })).sort((a, b) => a.date.localeCompare(b.date));
    all.transactions = all.transactions.filter(t => !t || (t.kind !== 'deposit' && t.kind !== 'transfer' && t.kind !== 'other'));
    if (all.deposits.length || all.statement.depositsTotal != null) all.statement.type = 'bank';
    all.transactions = all.transactions.filter(t => t && /^\d{4}-\d\d-\d\d$/.test(t.date || '') && !isNaN(Number(t.amount)) && t.kind !== 'payment' && !/payment\s*-?\s*thank you/i.test(t.description || ''));
    all.transactions.sort((a, b) => a.date.localeCompare(b.date));
    const pur = all.transactions.filter(t => Number(t.amount) > 0).reduce((s, t) => s + Number(t.amount), 0);
    all.check = { found: all.transactions.length, foundPurchases: Math.round(pur * 100) / 100, printed: all.statement.purchasesTotal != null ? Number(all.statement.purchasesTotal) : null };
    all.check.ok = all.check.printed == null ? null : Math.abs(all.check.printed - all.check.foundPurchases) < 1;
    // a bank statement is checked on its deposits (money in), since card payments and transfers out are left out on purpose
    if (all.statement.type === 'bank') {
      const dep = Math.round(all.deposits.reduce((x, t) => x + t.amount, 0) * 100) / 100;
      all.check = { found: all.transactions.length, what: 'deposits', foundPurchases: dep, printed: all.statement.depositsTotal != null ? Number(all.statement.depositsTotal) : null };
      all.check.ok = all.check.printed == null ? null : Math.abs(all.check.printed - dep) < 1;
    }
    return all;
  }

  // part = {text} or {images}; text is read in one go (exact), images two pages at a time
  async function read(part, { categories, onProgress } = {}) {
    const sample = root.claude && root.claude.use ? await root.claude.use('sample') : null;
    if (!sample) throw { code: 'unavailable' };
    if (part.text) {
      if (onProgress) onProgress(1, 1, 1);
      const got = await sample.json(prompt(categories, 1, 'the last').replace('These images are pages 1 to the last of', 'Below is the full text of') + '\n\nSTATEMENT TEXT:\n' + part.text, { modelTier: 'default', cache: false });
      return finish({ statement: (got && got.statement) || {}, transactions: (got && got.transactions) || [] });
    }
    const pageBlobs = part.images || [];
    let per = 2;   // two pages per read keeps every line legible
    try { const l = await sample.limits(); if (!l.images) throw { code: 'images_unavailable' }; per = Math.max(1, Math.min(2, l.images.maxCount || 2)); } catch (e) { if (e && e.code) throw e; }
    const all = { statement: {}, transactions: [] };
    for (let i = 0; i < pageBlobs.length; i += per) {
      const batch = pageBlobs.slice(i, i + per);
      if (onProgress) onProgress(i + 1, Math.min(i + per, pageBlobs.length), pageBlobs.length);
      const got = await sample.json(prompt(categories, i + 1, i + batch.length), { images: batch, modelTier: 'default', cache: false });
      if (got && got.statement) for (const [k, v] of Object.entries(got.statement)) if (v != null && v !== '' && (all.statement[k] == null || all.statement[k] === '')) all.statement[k] = v;
      for (const t of (got && got.transactions) || []) if (t && /^\d{4}-\d\d-\d\d$/.test(t.date || '') && !isNaN(Number(t.amount)) && t.kind !== 'payment') all.transactions.push(t);   // deposits are split off in finish()
    }
    // the same line read twice (page overlap) counts once
    return finish(all);
  }

  root.HP_STATEMENT = { pages, prepare, read, pdfText };
})(window);
