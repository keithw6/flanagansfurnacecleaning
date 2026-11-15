/* Home Pros booking server (Cloudflare Worker).

   The game runs in the customer's browser, so it can never hold the
   ServiceMonster API key. This small server does, and does three things:

     GET  /api/availability?services=furnace,dryer&answers=...   open times
     POST /api/book                                             book a job
     GET  /api/health                                           config check

   It recomputes the price and re-checks the time slot itself; nothing the
   browser sends about money or availability is trusted.

   Secrets (set with `wrangler secret put NAME`):
     SM_API_TOKEN     ServiceMonster API token (the part after "Basic ")
     RESEND_API_KEY   optional, for the manager notification email
   Plain vars (wrangler.toml [vars]):
     ALLOWED_ORIGINS  comma-separated, e.g. https://homeprosgroup.com
     SM_ROUTE_IDS     comma-separated ServiceMonster route GUIDs to book onto
     MANAGER_EMAIL    where new-booking alerts go
     FROM_EMAIL       sender for that alert, on a domain verified in Resend
     LEAD_SOURCE      lead source name shown in ServiceMonster                */

import '../../js/config.js';
import '../../js/pricing.js';
import '../../js/schedule.js';

const CFG = globalThis.HP_CONFIG;
const { quote, money } = globalThis.HP_PRICING;
const SCHED = globalThis.HP_SCHEDULE;
const SM = 'https://api.servicemonster.net/v1';

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    const cors = corsHeaders(req, env);
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    try {
      if (url.pathname === '/api/health') return json({ ok: true, configured: !!env.SM_API_TOKEN, routes: routes(env).length }, 200, cors);
      if (url.pathname === '/api/availability' && req.method === 'GET') return json(await availability(url, env), 200, cors);
      if (url.pathname === '/api/book' && req.method === 'POST') {
        const { status, body } = await book(req, env);
        return json(body, status, cors);
      }
      return json({ error: 'not_found' }, 404, cors);
    } catch (err) {
      console.error(err && err.stack || err);
      return json({ error: 'server_error' }, 502, cors);
    }
  },
};

/* ------------------------------------------------------------------ */

function routes(env) {
  return String(env.SM_ROUTE_IDS || '').split(',').map(s => s.trim()).filter(Boolean);
}

function corsHeaders(req, env) {
  const origin = req.headers.get('Origin') || '';
  const allowed = String(env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);
  const ok = allowed.includes(origin) || allowed.includes('*');
  return {
    'Access-Control-Allow-Origin': ok ? origin : (allowed[0] || ''),
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Vary': 'Origin',
  };
}

function json(body, status, headers) {
  return new Response(JSON.stringify(body), {
    status, headers: { ...headers, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}

async function sm(env, path, init = {}) {
  const res = await fetch(SM + path, {
    ...init,
    headers: { 'Content-Type': 'application/json', Authorization: 'Basic ' + env.SM_API_TOKEN, ...(init.headers || {}) },
  });
  const text = await res.text();
  let data; try { data = JSON.parse(text); } catch { data = text; }
  if (!res.ok) throw new Error(`ServiceMonster ${init.method || 'GET'} ${path} -> ${res.status}: ${text.slice(0, 300)}`);
  return data;
}

// Everything already on the schedule between now and the end of the booking window.
async function busyTimes(env, now) {
  const start = now.slice(0, 10);
  const endMin = SCHED.parse(now) + (CFG.schedule.daysAhead + 1) * 1440;
  const end = SCHED.fmt(endMin).slice(0, 10);
  const data = await sm(env, `/scheduling?startDate=${start}&endDate=${end}&getJobColor=false`);
  const items = Array.isArray(data) ? data : (data.items || []);
  return items
    .filter(i => !/cancel/i.test(i.status || i.jobStatus || ''))
    .map(i => ({ routeID: i.routeID || i.RouteID, start: i.StartDateTime || i.startDateTime, end: i.EndDateTime || i.endDateTime }));
}

function readSelection(obj) {
  const services = Array.isArray(obj.services) ? obj.services : String(obj.services || '').split(',');
  let answers = obj.answers || {};
  if (typeof answers === 'string') { try { answers = JSON.parse(answers); } catch { answers = {}; } }
  return { services: services.filter(Boolean), answers };
}

async function availability(url, env) {
  const sel = readSelection({ services: url.searchParams.get('services'), answers: url.searchParams.get('answers') });
  const q = quote(sel, CFG);
  if (!q.valid) return { error: 'bad_selection', details: q.errors };
  const now = SCHED.localNow(CFG.business.timeZone);
  const busy = await busyTimes(env, now);
  const days = SCHED.availability({ cfg: CFG, now, busy, routes: routes(env), hours: q.hours });
  // routeIDs stay server-side; the browser only needs the start time
  return { days: days.map(d => ({ ...d, slots: d.slots.map(({ start, end, label }) => ({ start, end, label })) })) };
}

const clean = (v, max) => String(v == null ? '' : v).replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, max);

async function book(req, env) {
  let body;
  try { body = await req.json(); } catch { return { status: 400, body: { error: 'bad_json' } }; }
  if (body.website) return { status: 200, body: { ok: true } }; // honeypot: bots fill hidden fields

  const sel = readSelection(body);
  const q = quote(sel, CFG);
  if (!q.valid) return { status: 400, body: { error: 'bad_selection', details: q.errors } };

  const c = body.customer || {};
  const customer = {
    firstName: clean(c.firstName, 64), lastName: clean(c.lastName, 64),
    phone: clean(c.phone, 32), email: clean(c.email, 128),
    address: clean(c.address, 64), city: clean(c.city, 64), postal: clean(c.postal, 32).toUpperCase().replace(/^([A-Z]\d[A-Z])[ -]?(\d[A-Z]\d)$/, '$1 $2'),
    notes: clean(c.notes, 1000),
  };
  const missing = ['firstName', 'lastName', 'phone', 'email', 'address', 'city', 'postal'].filter(k => !customer[k]);
  if (missing.length) return { status: 400, body: { error: 'missing_fields', fields: missing } };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customer.email)) return { status: 400, body: { error: 'bad_email' } };
  if (customer.phone.replace(/\D/g, '').length < 10) return { status: 400, body: { error: 'bad_phone' } };

  const start = clean(body.start, 19);
  const now = SCHED.localNow(CFG.business.timeZone);
  const busy = await busyTimes(env, now);
  const slot = SCHED.isFree({ cfg: CFG, now, busy, routes: routes(env), hours: q.hours, start });
  if (!slot) return { status: 409, body: { error: 'slot_taken' } };

  const note = [
    `BOOKED ONLINE (Arcade Storefront)`,
    `Quoted flat rate: ${money(q.subtotal)} + ${CFG.tax.label} ${money(q.tax)} = ${money(q.total)}`,
    ...q.lines.map(l => `- ${l.label} ${money(l.amount)}: ${l.parts.map(p => `${p.tag}: ${p.label}`).join('; ')}`),
    customer.notes ? `Customer notes: ${customer.notes}` : '',
  ].filter(Boolean).join('\n');

  // Web Lead with selectedTime + routeID: ServiceMonster creates the account,
  // site, order and the scheduled job in one call, and emails the customer.
  const lead = await sm(env, '/webleads', {
    method: 'POST',
    body: JSON.stringify({
      customerFirstName: customer.firstName,
      customerLastName: customer.lastName,
      phone: customer.phone,
      email: customer.email,
      address1: customer.address,
      city: customer.city,
      state: CFG.business.province,
      zip: customer.postal,
      country: CFG.business.country,
      note: note.slice(0, 4000),
      source: 'Arcade Storefront',
      leadSourceName: env.LEAD_SOURCE || 'Website - Arcade Storefront',
      services: q.lines.map(l => l.label).join(', ').slice(0, 256),
      duration: q.hours,
      routeID: slot.routeID,
      selectedTime: slot.start,
      notifyClient: true,
    }),
  });

  const reference = (lead && (lead.orderNumber || lead.id || lead.webLeadID || lead.orderID)) || '';
  const when = describeSlot(slot);
  let managerEmailed = false;
  try { managerEmailed = await notifyManager(env, { customer, q, when, note, reference }); }
  catch (e) { console.error('manager email failed', e); }

  return { status: 200, body: { ok: true, reference: String(reference), when, total: q.total, managerEmailed } };
}

function describeSlot(slot) {
  const d = new Date(SCHED.parse(slot.start) * 60000);
  const day = d.toLocaleDateString('en-CA', { weekday: 'long', month: 'long', day: 'numeric', timeZone: 'UTC' });
  return `${day}, arrival ${slot.label}`;
}

async function notifyManager(env, { customer, q, when, note, reference }) {
  if (!env.RESEND_API_KEY || !env.MANAGER_EMAIL || !env.FROM_EMAIL) return false;
  const esc = s => String(s).replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));
  const html = `
    <h2>New online booking: ${esc(money(q.total))}</h2>
    <p><b>${esc(when)}</b></p>
    <p>${esc(customer.firstName)} ${esc(customer.lastName)}<br>
       ${esc(customer.phone)} &middot; ${esc(customer.email)}<br>
       ${esc(customer.address)}, ${esc(customer.city)} ${esc(customer.postal)}</p>
    <pre style="font:14px/1.4 monospace">${esc(note)}</pre>
    ${reference ? `<p>ServiceMonster reference: ${esc(reference)}</p>` : ''}`;
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + env.RESEND_API_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: env.FROM_EMAIL, to: env.MANAGER_EMAIL.split(',').map(s => s.trim()),
      reply_to: customer.email,
      subject: `New booking: ${customer.firstName} ${customer.lastName}, ${when}`,
      html,
    }),
  });
  return res.ok;
}
