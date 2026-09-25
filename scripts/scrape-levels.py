#!/usr/bin/env python3
"""
scrape-levels.py -- refresh entry-level comp aggregates from levels.fyi.

Replaces the manual copy-paste workflow that feeds src/data/leaderboard2024.ts.

WHAT IT DOES
  For each configured company it fetches the levels.fyi software-engineer
  salary page (US and/or Bay Area), parses the "Average Compensation By Level"
  table, pulls the entry-level row (total / base / stock / bonus medians) and
  writes a JSON file shaped for conversion into TLeaderboardEntry records:

      {
        "company": "Google",
        "levelLabel": "L3",
        "location": "us",
        "total": 208000,
        "base": 157000,
        "stockPerYear": 38600,
        "bonus": 12300,
        "stockGrantTotal4yr": 154400,   # stockPerYear * 4
        "signingBonus": null,           # levels.fyi does not publish signing
        "submissions": 24216,           # company-wide total, may be null
        "sampleBand": "50+",
        "source": "levels.fyi",
        "sourceUrl": "https://www.levels.fyi/companies/google/salaries/software-engineer",
        "method": "levels.fyi L3 entry-level aggregate, read 2026-09-24",
        "confidence": "estimate",
        "accessDate": "2026-09-24",
        "status": "ok",
        "error": null
      }

USAGE
  python3 scripts/scrape-levels.py                        # all companies, US only
  python3 scripts/scrape-levels.py --location both         # US + Bay Area
  python3 scripts/scrape-levels.py --companies Google,Meta # subset (good for testing)
  python3 scripts/scrape-levels.py --out /tmp/levels.json --delay 5

POLITENESS / LEGAL NOTES (read before running)
  - levels.fyi robots.txt (checked 2026-09-24): the default `User-agent: *`
    rule is `Allow: /`. The disallow list targets named training crawlers
    and data brokers (e.g. an explicit `Disallow: /` for the `Scrapy` UA).
    This script identifies as `comp-calculator-levels-refresh/1.0` (not a
    listed token), waits 3s between requests, and fetches ~13-26 pages per
    run -- human-scale traffic.
  - levels.fyi offers sanctioned machine-readable routes: append `.md` to
    salary pages (e.g. .../salaries/software-engineer.md), plus llms.txt,
    sitemap.xml, and official API access at https://levels.fyi/api-access/.
    This script parses the HTML breakdown table because the .md summary only
    carries per-level *total* comp, not the base/stock/bonus split the
    leaderboard needs.
  - ATTRIBUTION IS REQUIRED: any derived work must include
    "Data source: Levels.fyi (https://www.levels.fyi)".
  - The .md pages note the data is under the Levels.fyi Data License
    (https://www.levels.fyi/offerings/data/). Check the terms before
    publishing derived data.
  - Do NOT use this to feed AI/ML training corpora -- levels.fyi explicitly
    forbids ingesting its compensation database for model training.
  - If you get HTTP 403 / Cloudflare challenges, STOP and use the manual
    refresh path (or the official API) instead of working around the block.
"""

import argparse
import gzip
import json
import re
import sys
import time
import urllib.error
import urllib.request
import zlib
from datetime import date
from html.parser import HTMLParser

# ---------------------------------------------------------------------------
# Company config: levels.fyi slug + entry-level matcher.
# entry_level is a regex matched against the level cell with parenthetical
# qualifiers stripped, e.g. "L3SWE II (Entry Level)" -> "L3SWE II".
# ---------------------------------------------------------------------------
# NOTE: patterns use (?![0-9]) instead of a trailing \b because levels.fyi
# concatenates the level and title without a space in the HTML
# (e.g. "L3SWE II"), which defeats \b.
COMPANIES = [
    {"name": "Google", "slug": "google", "entry_level": r"(?<![A-Z0-9])L3(?![0-9])", "level_label": "L3"},
    {"name": "Meta", "slug": "meta", "entry_level": r"(?<![A-Z0-9])E3(?![0-9])", "level_label": "E3"},
    {"name": "Amazon", "slug": "amazon", "entry_level": r"\bSDE\s?I(?![A-Z0-9])", "level_label": "SDE I"},
    {"name": "Apple", "slug": "apple", "entry_level": r"(?<![A-Z0-9])ICT2(?![0-9])", "level_label": "ICT2"},
    {"name": "Microsoft", "slug": "microsoft", "entry_level": r"(?<![0-9])59(?![0-9])", "level_label": "59"},
    {"name": "Netflix", "slug": "netflix", "entry_level": r"(?<![A-Z0-9])L3(?![0-9])", "level_label": "L3"},
    {"name": "Nvidia", "slug": "nvidia", "entry_level": r"(?<![A-Z0-9])IC1(?![0-9])", "level_label": "IC1"},
    {"name": "Roblox", "slug": "roblox", "entry_level": r"(?<![A-Z0-9])IC1(?![0-9])", "level_label": "IC1"},
    {"name": "Pinterest", "slug": "pinterest", "entry_level": r"(?<![A-Z0-9])IC13(?![0-9])", "level_label": "IC13"},
    {"name": "Snap", "slug": "snap", "entry_level": r"(?<![A-Z0-9])L3(?![0-9])", "level_label": "L3"},
    {"name": "Snowflake", "slug": "snowflake", "entry_level": r"(?<![A-Z0-9])IC1(?![0-9])", "level_label": "IC1"},
    {"name": "Stripe", "slug": "stripe", "entry_level": r"(?<![A-Z0-9])L1(?![0-9])", "level_label": "L1"},
    {"name": "Databricks", "slug": "databricks", "entry_level": r"(?<![A-Z0-9])L3(?![0-9])", "level_label": "L3"},
]

BASE_URL = "https://www.levels.fyi/companies/{slug}/salaries/software-engineer"
LOCATIONS = {
    "us": "",
    "bay-area": "/locations/san-francisco-bay-area",
}

UA = "comp-calculator-levels-refresh/1.0 (+https://github.com/cbangera2/compensation-calculator)"
ROBOTS_URL = "https://www.levels.fyi/robots.txt"


# ---------------------------------------------------------------------------
# HTML table extraction (stdlib only -- no bs4 dependency)
# ---------------------------------------------------------------------------
class TableExtractor(HTMLParser):
    """Collect every <table> on the page as a list of rows of cell text."""

    def __init__(self):
        super().__init__()
        self.tables = []
        self._table = None
        self._row = None
        self._cell = None

    def handle_starttag(self, tag, attrs):
        if tag == "table":
            self._table = []
        elif tag == "tr" and self._table is not None:
            self._row = []
        elif tag in ("td", "th") and self._row is not None:
            self._cell = []

    def handle_data(self, data):
        if self._cell is not None:
            self._cell.append(data)

    def handle_endtag(self, tag):
        if tag in ("td", "th") and self._cell is not None:
            self._row.append("".join(self._cell).strip())
            self._cell = None
        elif tag == "tr" and self._row is not None:
            self._table.append(self._row)
            self._row = None
        elif tag == "table" and self._table is not None:
            self.tables.append(self._table)
            self._table = None


def parse_money(raw):
    """'$38.6K' -> 38600, '$207,842' -> 207842, '$ --' -> None."""
    if raw is None:
        return None
    s = raw.strip()
    if not s or s in ("--", "$--", "$ --", "—", "-", "n/a", "N/A", "$—"):
        return None
    s = s.replace("$", "").replace(",", "").replace("–", "").strip()
    mult = 1
    if s.endswith("K"):
        mult, s = 1000, s[:-1]
    elif s.endswith("M"):
        mult, s = 1_000_000, s[:-1]
    try:
        return int(round(float(s.strip()) * mult))
    except ValueError:
        return None


def norm_level(cell):
    """'L3SWE II (Entry Level)' -> 'L3SWE II'."""
    return re.sub(r"\(.*?\)", "", cell or "").strip()


def find_comp_table(tables):
    """Return the 'Average Compensation By Level' table (header has Level/Total/Base/Stock)."""
    for t in tables:
        if not t:
            continue
        header = " | ".join(t[0]).lower()
        if "level" in header and "total" in header and "base" in header and "stock" in header:
            return t
    return None


def extract_submissions(html):
    """'Levels.fyi tracks 24,218 Software Engineer salary submissions' -> 24218."""
    m = re.search(r"tracks\s+([\d,]+)\s[^.]{0,80}?salary submissions?", html)
    if m:
        try:
            return int(m.group(1).replace(",", ""))
        except ValueError:
            return None
    return None


# ---------------------------------------------------------------------------
# Fetching
# ---------------------------------------------------------------------------
def fetch(url, timeout=30):
    req = urllib.request.Request(
        url,
        headers={
            "User-Agent": UA,
            "Accept": "text/html,application/xhtml+xml",
            "Accept-Language": "en-US,en;q=0.9",
            "Accept-Encoding": "gzip, deflate",
        },
    )
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        raw = resp.read()
        encoding = resp.headers.get("Content-Encoding", "").lower()
        if "gzip" in encoding:
            raw = gzip.decompress(raw)
        elif "deflate" in encoding:
            raw = zlib.decompress(raw)
        return resp.status, raw.decode("utf-8", errors="replace")


def check_robots():
    """Fetch robots.txt once and report what it says about us. Returns True if clear."""
    print(f"[robots] fetching {ROBOTS_URL}")
    try:
        status, body = fetch(ROBOTS_URL)
    except Exception as e:  # noqa: BLE001
        print(f"[robots] could not fetch robots.txt ({e}); proceeding with caution")
        return True
    if status != 200:
        print(f"[robots] unexpected status {status}; proceeding with caution")
        return True

    # Our UA token is not a listed token, so the `User-agent: *` block governs us.
    verdict = "unknown"
    if re.search(r"User-agent:\s*\*\s*\n\s*Allow:\s*/", body, re.I):
        verdict = "ALLOW /"
    elif re.search(r"User-agent:\s*\*", body, re.I):
        # Fallback: find the default block and check for Allow inside it.
        star_block = re.search(r"User-agent:\s*\*(.*?)(?=User-agent:|\Z)", body, re.S | re.I)
        if star_block and re.search(r"Allow:\s*/", star_block.group(1), re.I):
            verdict = "ALLOW /"
    print(f"[robots] User-agent: * -> {verdict}")
    for token in ("Scrapy", "FirecrawlAgent", "python-requests"):
        if re.search(rf"User-agent:\s*{token}\b.*?Disallow:\s*/", body, re.S | re.I):
            print(f"[robots] note: '{token}' is explicitly disallowed (we do not use it)")
    print("[robots] attribution required: 'Data source: Levels.fyi (https://www.levels.fyi)'")
    print("[robots] data is under the Levels.fyi Data License; check terms before publishing")
    return verdict != "unknown"


# ---------------------------------------------------------------------------
# Per-company scrape
# ---------------------------------------------------------------------------
def scrape_company(company, location_key, location_suffix, read_date):
    url = BASE_URL.format(slug=company["slug"]) + location_suffix
    rec = {
        "company": company["name"],
        "levelLabel": company["level_label"],
        "location": location_key,
        "total": None,
        "base": None,
        "stockPerYear": None,
        "bonus": None,
        "stockGrantTotal4yr": None,
        "signingBonus": None,
        "submissions": None,
        "sampleBand": "unknown",
        "source": "levels.fyi",
        "sourceUrl": url,
        "method": f"levels.fyi {company['level_label']} entry-level aggregate, read {read_date}",
        "confidence": "estimate",
        "accessDate": read_date,
        "status": "failed",
        "error": None,
    }
    try:
        status, html = fetch(url)
    except urllib.error.HTTPError as e:
        rec["error"] = f"HTTP {e.code}: {e.reason}"
        if e.code in (401, 403):
            rec["error"] += " -- blocked; stop and use manual refresh or the official API"
        return rec
    except Exception as e:  # noqa: BLE001 -- network errors, timeouts, DNS
        rec["error"] = f"fetch failed: {e}"
        return rec

    if status != 200:
        rec["error"] = f"HTTP {status}"
        return rec
    if re.search(r"just a moment|cf-chl|challenge-platform", html, re.I):
        rec["error"] = "bot challenge page returned -- blocked; stop and use manual refresh"
        return rec

    extractor = TableExtractor()
    try:
        extractor.feed(html)
    except Exception as e:  # noqa: BLE001
        rec["error"] = f"HTML parse failed: {e}"
        return rec

    table = find_comp_table(extractor.tables)
    if table is None:
        rec["error"] = "compensation table not found (page structure may have changed)"
        return rec

    header = [c.lower() for c in table[0]]
    try:
        i_total = next(i for i, c in enumerate(header) if "total" in c)
        i_base = next(i for i, c in enumerate(header) if "base" in c)
        i_stock = next(i for i, c in enumerate(header) if "stock" in c)
        i_bonus = next(i for i, c in enumerate(header) if "bonus" in c)
    except StopIteration:
        rec["error"] = "table header missing expected columns"
        return rec

    pattern = re.compile(company["entry_level"], re.I)
    row = None
    for r in table[1:]:
        if r and pattern.search(norm_level(r[0])):
            row = r
            break
    if row is None:
        rec["error"] = (
            f"entry-level row matching /{company['entry_level']}/ not found; "
            f"levels seen: {[norm_level(r[0]) for r in table[1:7]]}"
        )
        return rec

    def col(i):
        return row[i] if i < len(row) else None

    rec["total"] = parse_money(col(i_total))
    rec["base"] = parse_money(col(i_base))
    rec["stockPerYear"] = parse_money(col(i_stock))
    rec["bonus"] = parse_money(col(i_bonus))
    if rec["stockPerYear"] is not None:
        rec["stockGrantTotal4yr"] = rec["stockPerYear"] * 4

    subs = extract_submissions(html)
    rec["submissions"] = subs
    rec["sampleBand"] = "50+" if subs and subs >= 50 else "unknown"

    if rec["total"] is None and rec["base"] is None:
        rec["error"] = "entry row found but no parseable figures"
        return rec

    rec["status"] = "ok"
    return rec


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------
def main():
    ap = argparse.ArgumentParser(description="Refresh entry-level comp from levels.fyi")
    ap.add_argument("--companies", default="all",
                    help="comma-separated company names, or 'all' (default)")
    ap.add_argument("--location", choices=["us", "bay-area", "both"], default="us",
                    help="which location pages to fetch (default: us)")
    ap.add_argument("--out", default="scripts/levels-scrape.json",
                    help="output JSON path (default: scripts/levels-scrape.json)")
    ap.add_argument("--delay", type=float, default=3.0,
                    help="seconds between requests (default: 3.0)")
    ap.add_argument("--skip-robots", action="store_true",
                    help="skip the robots.txt check (not recommended)")
    args = ap.parse_args()

    if args.companies == "all":
        selected = COMPANIES
    else:
        wanted = {c.strip().lower() for c in args.companies.split(",")}
        selected = [c for c in COMPANIES if c["name"].lower() in wanted]
        unknown = wanted - {c["name"].lower() for c in selected}
        if unknown:
            print(f"unknown companies: {sorted(unknown)}", file=sys.stderr)
            sys.exit(2)
        if not selected:
            print("no companies selected", file=sys.stderr)
            sys.exit(2)

    loc_keys = ["us", "bay-area"] if args.location == "both" else [args.location]
    read_date = date.today().isoformat()

    if not args.skip_robots:
        check_robots()
        print()

    results = []
    jobs = [(c, lk) for c in selected for lk in loc_keys]
    for idx, (company, loc_key) in enumerate(jobs):
        if idx:
            time.sleep(args.delay)
        label = f"{company['name']} [{loc_key}]"
        print(f"[{idx + 1}/{len(jobs)}] fetching {label} ...", flush=True)
        rec = scrape_company(company, loc_key, LOCATIONS[loc_key], read_date)
        results.append(rec)
        if rec["status"] == "ok":
            fmt = lambda v: f"${v:,}" if v is not None else "n/a"  # noqa: E731
            print(f"  ok: total={fmt(rec['total'])} base={fmt(rec['base'])} "
                  f"stock/yr={fmt(rec['stockPerYear'])} bonus={fmt(rec['bonus'])} "
                  f"subs={rec['submissions']}")
        else:
            print(f"  FAILED: {rec['error']}")

    with open(args.out, "w") as f:
        json.dump(results, f, indent=2)
    print(f"\nwrote {len(results)} records to {args.out}")

    failed = [r for r in results if r["status"] != "ok"]
    print(f"\n{len(results) - len(failed)}/{len(results)} succeeded")
    if failed:
        print("failures:")
        for r in failed:
            print(f"  - {r['company']} [{r['location']}]: {r['error']}")
        sys.exit(1)


if __name__ == "__main__":
    main()
