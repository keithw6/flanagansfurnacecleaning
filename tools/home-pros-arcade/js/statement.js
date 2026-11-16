/* Card and bank statements for Penny: turn an uploaded PDF (or photos) into page
   images, have Claude read the transactions, and hand them to Penny's interview.
   HP_STATEMENT.pages(files)      -> Promise<Blob[]>  one JPEG per page (max 12)
   HP_STATEMENT.read(pages, opts) -> Promise<{statement, transactions}>
   PDF pages are drawn with pdf.js (loaded from cdnjs the first time it's needed). */
(function (root) {
  'use strict';
  const PDFJS = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/';
  const MAX_PAGES = 12;
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
      + '{"statement":{"card":"card name, e.g. Visa or Mastercard or bank account","last4":"last 4 digits if shown","period":"statement period as printed","year":number},'
      + '"transactions":[{"date":"YYYY-MM-DD (the transaction date, use the statement period to get the year right)","description":"merchant as printed",'
      + '"amount":number (positive for purchases and charges, negative for refunds and credits),"kind":"purchase|refund|fee|interest|payment",'
      + '"category":"one of: ' + categories.join('; ') + '",'
      + '"business":"likely|maybe|personal",'
      + '"question":"one short, friendly question to ask Keith when it is not clearly business, else empty"}]}. '
      + 'Include purchases, refunds, card fees and interest; leave out payments made to the card. '
      + 'Likely business: fuel, auto parts and repairs, tires, tools, hardware and building supply, HVAC and compressor suppliers, phone and internet, software, advertising, vehicle insurance and registration. '
      + 'Maybe (ask): restaurants and coffee (client or crew meal?), Costco, Walmart, Amazon, Canadian Tire, Home Depot when the item is unclear, hotels, travel, subscriptions. '
      + 'Likely personal (still list them, ask to confirm): groceries, clothing, entertainment, streaming, pharmacy, liquor, personal care. '
      + 'Never guess an amount you cannot read: skip that line instead of inventing it.';
  }

  async function read(pageBlobs, { categories, onProgress } = {}) {
    const sample = root.claude && root.claude.use ? await root.claude.use('sample') : null;
    if (!sample) throw { code: 'unavailable' };
    let per = 4;
    try { const l = await sample.limits(); if (!l.images) throw { code: 'images_unavailable' }; per = Math.max(1, Math.min(6, l.images.maxCount || 4)); } catch (e) { if (e && e.code) throw e; }
    const all = { statement: {}, transactions: [] };
    for (let i = 0; i < pageBlobs.length; i += per) {
      const batch = pageBlobs.slice(i, i + per);
      if (onProgress) onProgress(i + 1, Math.min(i + per, pageBlobs.length), pageBlobs.length);
      const got = await sample.json(prompt(categories, i + 1, i + batch.length), { images: batch, modelTier: 'default', cache: false });
      if (got && got.statement) for (const [k, v] of Object.entries(got.statement)) if (v && !all.statement[k]) all.statement[k] = v;
      for (const t of (got && got.transactions) || []) if (t && /^\d{4}-\d\d-\d\d$/.test(t.date || '') && !isNaN(Number(t.amount)) && t.kind !== 'payment') all.transactions.push(t);
    }
    // the same line read twice (page overlap) counts once
    const seen = new Set();
    all.transactions = all.transactions.filter(t => { const k = t.date + '|' + Number(t.amount).toFixed(2) + '|' + String(t.description || '').toLowerCase().slice(0, 18); if (seen.has(k)) return false; seen.add(k); return true; })
      .sort((a, b) => a.date.localeCompare(b.date));
    return all;
  }

  root.HP_STATEMENT = { pages, read };
})(window);
