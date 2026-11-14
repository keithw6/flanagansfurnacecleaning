#!/usr/bin/env python3
"""ServiceMonster customer-outreach helper. Standard library only.

Commands
  probe                      Fetch one record from each resource and print its field names.
                             Run this first: it is how we confirm the API's real field names.
  find   --from --to --area  Build the outreach list: customers served in a date range,
                             in an area, with email/mail eligibility worked out.
  letters --list --body      Render a print-ready HTML file, one letter per page, from a list.

Auth
  SERVICEMONSTER_BASIC_TOKEN  The "Basic token" from ServiceMonster (Settings > API keys).
                              Sent as "Authorization: Basic <token>". If unset, no header is
                              sent, which is right when a network proxy injects the credential.

Customer data is written under ./outreach-output/ (gitignored). Never commit it: this
repository is public.
"""
import argparse
import base64
import csv
import datetime as dt
import html
import json
import os
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request

BASE = os.environ.get("SERVICEMONSTER_BASE_URL", "https://api.servicemonster.net/v1").rstrip("/")
HERE = os.path.dirname(os.path.abspath(__file__))
SKILL_DIR = os.path.dirname(HERE)
PAGE = 100

# Candidate field names, checked case-insensitively in order. The API's exact names are
# confirmed with `probe`; if one is missing, add it here rather than guessing elsewhere.
F = {
    "account_id": ["accountID", "accountId", "account_id"],
    "order_id": ["orderID", "orderId", "order_id"],
    "order_date": ["dateCompleted", "completedDate", "jobDate", "scheduledDate",
                   "orderDate", "dateScheduled", "date", "timeStamp"],
    "order_status": ["orderStatus", "status"],
    "order_type": ["orderType", "type"],
    "order_text": ["note", "notes", "description", "summary", "lineItems", "items", "jobType"],
    "name": ["name", "accountName", "displayName"],
    "first": ["firstName", "first_name"],
    "last": ["lastName", "last_name"],
    "company": ["companyName", "company"],
    "email": ["email", "emailAddress", "email1", "primaryEmail"],
    "phone": ["phone1", "phone", "phoneNumber", "mobilePhone", "cellPhone"],
    "addr1": ["address1", "address", "addressLine1", "street", "streetAddress"],
    "addr2": ["address2", "addressLine2"],
    "city": ["city", "town"],
    "prov": ["state", "province", "region"],
    "postal": ["zip", "postalCode", "zipCode", "postal"],
    "community": ["community", "neighborhood", "neighbourhood", "subdivision", "area"],
    "active": ["active", "isActive"],
    # Any of these being truthy means: do not contact.
    "no_contact": ["doNotContact", "doNotEmail", "doNotMail", "noMarketing",
                   "emailOptOut", "optOut", "unsubscribed", "isDeleted", "deleted"],
    "no_email": ["doNotEmail", "emailOptOut", "unsubscribed", "noEmail"],
    "no_mail": ["doNotMail", "noMail"],
}


def pick(rec, key):
    if not isinstance(rec, dict):
        return None
    lower = {k.lower(): v for k, v in rec.items()}
    for cand in F[key]:
        v = lower.get(cand.lower())
        if v not in (None, "", []):
            return v
    return None


def truthy(v):
    return v is True or (isinstance(v, str) and v.strip().lower() in ("true", "yes", "1", "y"))


# ---------------------------------------------------------------- HTTP

def _headers():
    h = {"Accept": "application/json", "User-Agent": "flanagans-outreach/1.0"}
    tok = os.environ.get("SERVICEMONSTER_BASIC_TOKEN", "").strip()
    if not tok and os.environ.get("SERVICEMONSTER_API_KEY"):
        # Fallback: build a Basic token from key:password if ServiceMonster issued it that way.
        raw = f"{os.environ['SERVICEMONSTER_API_KEY']}:{os.environ.get('SERVICEMONSTER_API_SECRET', '')}"
        tok = base64.b64encode(raw.encode()).decode()
    if tok:
        h["Authorization"] = tok if tok.lower().startswith("basic ") else f"Basic {tok}"
    return h


def get(path, params=None, tries=4):
    url = f"{BASE}/{path.lstrip('/')}"
    if params:
        url += "?" + urllib.parse.urlencode({k: v for k, v in params.items() if v is not None})
    for i in range(tries):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers=_headers()), timeout=60) as r:
                body = r.read().decode("utf-8", "replace")
                return json.loads(body) if body.strip() else None
        except urllib.error.HTTPError as e:
            if e.code in (429, 500, 502, 503, 504) and i < tries - 1:
                time.sleep(2 ** i)
                continue
            detail = e.read().decode("utf-8", "replace")[:300]
            hint = {401: "auth rejected: check SERVICEMONSTER_BASIC_TOKEN",
                    403: "forbidden: the key may lack access, or the network blocks the host",
                    404: "not found: the resource path or ID may differ"}.get(e.code, "")
            sys.exit(f"ServiceMonster {e.code} on {path}. {hint}\n{detail}")
        except urllib.error.URLError as e:
            if i < tries - 1:
                time.sleep(2 ** i)
                continue
            sys.exit(f"Cannot reach {BASE}: {e.reason}. Is api.servicemonster.net allowed on this network?")


def items_of(payload):
    """The list endpoints may return a bare list or wrap it; accept either."""
    if isinstance(payload, list):
        return payload
    if isinstance(payload, dict):
        for k in ("items", "data", "results", "records", "value"):
            if isinstance(payload.get(k), list):
                return payload[k]
        for v in payload.values():
            if isinstance(v, list) and (not v or isinstance(v[0], dict)):
                return v
    return []


def get_all(path, where=None, max_pages=500):
    out, page = [], 0
    while page < max_pages:
        params = {"limit": PAGE, "pageIndex": page}
        if where:
            params.update(where)
        batch = items_of(get(path, params))
        out.extend(batch)
        if len(batch) < PAGE:
            break
        page += 1
        print(f"  {path}: {len(out)} records…", file=sys.stderr)
    return out


# ---------------------------------------------------------------- dates & areas

def parse_date(v):
    if not v:
        return None
    if isinstance(v, (int, float)):
        return dt.datetime.utcfromtimestamp(v / 1000 if v > 1e11 else v).date()
    s = str(v).strip()
    m = re.search(r"/Date\((-?\d+)", s)  # .NET JSON dates
    if m:
        return dt.datetime.utcfromtimestamp(int(m.group(1)) / 1000).date()
    for fmt in ("%Y-%m-%d", "%m/%d/%Y", "%Y/%m/%d", "%d-%b-%Y"):
        try:
            return dt.datetime.strptime(s[:10] if fmt == "%Y-%m-%d" else s.split(" ")[0], fmt).date()
        except ValueError:
            pass
    try:
        return dt.datetime.fromisoformat(s.replace("Z", "+00:00")).date()
    except ValueError:
        return None


def load_areas():
    with open(os.path.join(SKILL_DIR, "areas.json"), encoding="utf-8") as fh:
        return json.load(fh)


def area_rules(spec):
    """Turn "NE Calgary, Airdrie, T3J, Saddle Ridge" into match rules."""
    known = {k.lower(): v for k, v in load_areas()["areas"].items()}
    rules = []
    for term in [t.strip() for t in spec.split(",") if t.strip()]:
        r = known.get(term.lower())
        if r:
            rules.append({"label": term, **r})
        elif re.fullmatch(r"[A-Za-z]\d[A-Za-z]( ?\d[A-Za-z]\d)?", term):
            rules.append({"label": term, "postal_prefixes": [term.replace(" ", "").upper()]})
        else:
            # Unknown term: match it as a city or community name, or as text in the address.
            rules.append({"label": term, "cities": [term], "text": [term]})
    return rules


def match_area(addr, rules):
    city = (addr.get("city") or "").strip().lower()
    postal = (addr.get("postal") or "").replace(" ", "").upper()
    blob = " ".join(str(addr.get(k) or "") for k in ("addr1", "addr2", "city", "community")).lower()
    for r in rules:
        cities = [c.lower() for c in r.get("cities", [])]
        if r.get("quadrant"):
            # Calgary street addresses end in NE/NW/SE/SW, so this one is reliable.
            q = r["quadrant"].lower()
            if city in cities and re.search(rf"\b{q}\b", (addr.get("addr1") or "").lower()):
                return r["label"], "exact"
            continue
        if any(re.search(rf"\b{re.escape(t.lower())}\b", blob) for t in r.get("text", [])):
            return r["label"], "exact"
        if any(postal.startswith(p.upper()) for p in r.get("postal_prefixes", [])):
            return r["label"], r.get("precision", "exact")
        if city and city in cities:
            return r["label"], "exact"
    return None, None


# ---------------------------------------------------------------- build the list

def address_of(rec):
    return {k: pick(rec, k) for k in ("addr1", "addr2", "city", "prov", "postal", "community")}


def cmd_probe(_args):
    for res in ("accounts", "orders", "sites"):
        recs = items_of(get(res, {"limit": 1, "pageIndex": 0}))
        print(f"\n== {res}: {'no records' if not recs else ''}")
        if recs:
            for k, v in recs[0].items():
                shown = "(set)" if v not in (None, "", [], {}) else "(empty)"
                print(f"   {k:32} {type(v).__name__:6} {shown}")
    print("\nField values are hidden on purpose. Update F in sm_outreach.py if names differ.")


def cmd_find(a):
    start, end = parse_date(a.date_from), parse_date(a.date_to)
    if not (start and end) or start > end:
        sys.exit("Give --from and --to as YYYY-MM-DD, with from <= to.")
    rules = area_rules(a.area) if a.area else []
    service_re = re.compile(a.service, re.I) if a.service else None
    today = dt.date.today()

    # Narrow server-side where the API allows it; everything is re-checked locally anyway,
    # so a filter the server ignores costs speed, never correctness.
    where = None
    if a.date_field:
        where = {"wField": a.date_field, "wOperator": "gt",
                 "wValue": (start - dt.timedelta(days=1)).isoformat()}
    print("Fetching orders…", file=sys.stderr)
    orders = get_all("orders", where)

    by_acct = {}
    for o in orders:
        aid = pick(o, "account_id")
        d = parse_date(pick(o, "order_date"))
        if not aid or not d:
            continue
        status = str(pick(o, "order_status") or "").lower()
        if any(s in status for s in ("cancel", "void", "estimate", "quote", "lost")):
            continue
        by_acct.setdefault(str(aid), []).append((d, o))

    cand = {}
    for aid, lst in by_acct.items():
        lst.sort(key=lambda x: x[0])
        in_range = [(d, o) for d, o in lst if start <= d <= end]
        if not in_range:
            continue
        if a.mode == "last" and lst[-1][0] > end:
            continue  # served again since the window: not due
        if service_re and not any(service_re.search(json.dumps(o)) for _, o in in_range):
            continue
        cand[aid] = (in_range, lst[-1][0])

    print(f"{len(cand)} accounts had qualifying service. Fetching account details…", file=sys.stderr)
    rows, skipped = [], {"outside_area": 0, "do_not_contact": 0, "inactive": 0}
    for i, (aid, (in_range, last_d)) in enumerate(sorted(cand.items()), 1):
        acct = get(f"accounts/{aid}") or {}
        if isinstance(acct, list):
            acct = acct[0] if acct else {}
        acct = items_of(acct)[0] if not pick(acct, "account_id") and items_of(acct) else acct
        if truthy(pick(acct, "no_contact")):
            skipped["do_not_contact"] += 1
            continue
        if pick(acct, "active") is False:
            skipped["inactive"] += 1
            continue

        # Service address: the order's own address if it carries one, else the account's.
        o = in_range[-1][1]
        svc = address_of(o) if pick(o, "addr1") else address_of(acct)
        mail = address_of(acct) if pick(acct, "addr1") else svc
        if rules:
            label, precision = match_area(svc, rules)
            if not label:
                skipped["outside_area"] += 1
                continue
        else:
            label, precision = "", ""

        first, last = pick(acct, "first"), pick(acct, "last")
        name = pick(acct, "name") or " ".join(x for x in (first, last) if x) or pick(acct, "company") or ""
        email = (pick(acct, "email") or "").strip()
        valid_email = bool(re.fullmatch(r"[^@\s]+@[^@\s]+\.[^@\s]+", email))
        # CASL: implied consent from a purchase lasts 2 years from that purchase.
        casl_ok = (today - last_d).days <= 730
        email_ok = valid_email and casl_ok and not truthy(pick(acct, "no_email"))
        mail_ok = bool(mail.get("addr1") and mail.get("city") and mail.get("postal")) and not truthy(pick(acct, "no_mail"))
        why = []
        if not valid_email:
            why.append("no valid email")
        elif not casl_ok:
            why.append("last service over 2 yrs ago (CASL)")
        if not mail_ok:
            why.append("incomplete mailing address")

        rows.append({
            "account_id": aid, "name": name, "first_name": first or (name.split(" ")[0] if name else ""),
            "email": email, "phone": pick(acct, "phone") or "",
            "address1": mail.get("addr1") or "", "address2": mail.get("addr2") or "",
            "city": mail.get("city") or "", "province": mail.get("prov") or "AB",
            "postal_code": mail.get("postal") or "",
            "service_address": ", ".join(str(x) for x in (svc.get("addr1"), svc.get("city")) if x),
            "matched_area": label, "area_precision": precision,
            "service_dates_in_range": ";".join(d.isoformat() for d, _ in in_range),
            "last_service": last_d.isoformat(),
            "last_service_text": f"{last_d:%B} {last_d.year}",
            "years_since_last": round((today - last_d).days / 365.25, 1),
            "email_ok": email_ok, "mail_ok": mail_ok, "notes": "; ".join(why),
        })
        if i % 25 == 0:
            print(f"  {i}/{len(cand)} accounts…", file=sys.stderr)

    rows.sort(key=lambda r: (r["matched_area"], r["last_service"]))
    os.makedirs(a.out, exist_ok=True)
    stem = os.path.join(a.out, f"outreach_{start}_{end}_{re.sub(r'[^a-z0-9]+', '-', (a.area or 'all').lower()).strip('-')}")
    with open(stem + ".json", "w", encoding="utf-8") as fh:
        json.dump({"criteria": vars(a), "generated": today.isoformat(), "skipped": skipped,
                   "customers": rows}, fh, indent=1, default=str)
    if rows:
        with open(stem + ".csv", "w", newline="", encoding="utf-8") as fh:
            w = csv.DictWriter(fh, fieldnames=list(rows[0]))
            w.writeheader()
            w.writerows(rows)
    summary = {
        "list_json": stem + ".json", "list_csv": stem + ".csv" if rows else None,
        "orders_scanned": len(orders), "customers": len(rows),
        "email_ready": sum(r["email_ok"] for r in rows),
        "mail_ready": sum(r["mail_ok"] for r in rows),
        "neither": sum(not r["email_ok"] and not r["mail_ok"] for r in rows),
        "approximate_area_matches": sum(r["area_precision"] == "approximate" for r in rows),
        "skipped": skipped,
    }
    print(json.dumps(summary, indent=1))


# ---------------------------------------------------------------- letters

def cmd_letters(a):
    with open(a.list, encoding="utf-8") as fh:
        data = json.load(fh)
    people = [r for r in data["customers"] if r["mail_ok"] and (a.all or not r["email_ok"])]
    with open(a.body, encoding="utf-8") as fh:
        body = fh.read()
    with open(os.path.join(SKILL_DIR, "templates", "letter.html"), encoding="utf-8") as fh:
        shell = fh.read()
    now = dt.date.today()
    today = f"{now:%B} {now.day}, {now.year}"
    pages = []
    for r in people:
        text = body
        for k, v in r.items():
            text = text.replace("{{" + k + "}}", str(v))
        paras = "".join(f"<p>{html.escape(p).replace(chr(10), '<br>')}</p>" for p in text.strip().split("\n\n"))
        addr = "<br>".join(html.escape(x) for x in (
            r["name"], r["address1"], r["address2"],
            f"{r['city']} {r['province']}  {r['postal_code']}") if x.strip())
        pages.append(f'<section class="letter"><div class="date">{today}</div>'
                     f'<div class="to">{addr}</div><div class="body">{paras}</div></section>')
    out = os.path.splitext(a.list)[0] + "_letters.html"
    with open(out, "w", encoding="utf-8") as fh:
        fh.write(shell.replace("<!--LETTERS-->", "\n".join(pages)))
    print(json.dumps({"letters_html": out, "letters": len(pages)}))


def main():
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = p.add_subparsers(dest="cmd", required=True)
    sub.add_parser("probe")
    f = sub.add_parser("find")
    f.add_argument("--from", dest="date_from", required=True)
    f.add_argument("--to", dest="date_to", required=True)
    f.add_argument("--area", default="", help='comma-separated: "NE Calgary, Airdrie, T3J, Saddle Ridge"')
    f.add_argument("--mode", choices=["any", "last"], default="any",
                   help="any: served at least once in range. last: most recent service fell in range")
    f.add_argument("--service", help="regex to require in the order, e.g. 'dryer|vent'")
    f.add_argument("--date-field", default=os.environ.get("SERVICEMONSTER_ORDER_DATE_FIELD"),
                   help="order date field to filter on server-side (confirm with probe)")
    f.add_argument("--out", default="outreach-output")
    l = sub.add_parser("letters")
    l.add_argument("--list", required=True)
    l.add_argument("--body", required=True, help="text file; {{first_name}} etc. are filled per customer")
    l.add_argument("--all", action="store_true", help="also letter customers who will get an email")
    a = p.parse_args()
    {"probe": cmd_probe, "find": cmd_find, "letters": cmd_letters}[a.cmd](a)


if __name__ == "__main__":
    main()
