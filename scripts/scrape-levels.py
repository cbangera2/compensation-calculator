#!/usr/bin/env python3
"""
scrape-levels.py -- refresh entry-level comp aggregates from levels.fyi.

Replaces the manual copy-paste workflow that feeds src/data/leaderboard2024.ts.

WHAT IT DOES
  For each configured company it fetches TWO representations of the
  levels.fyi software-engineer salary page (US and/or Bay Area):

    1. The sanctioned `.md` variant (e.g. .../software-engineer.md),
       which reports per-level MEDIAN total compensation.
    2. The HTML page's "Average Compensation By Level" table,
       which gives the AVERAGE base / stock / bonus component split
       (the .md variant does not include the split).

  and writes a JSON file shaped for conversion into TLeaderboardEntry
  records:

      {
        "company": "Google",
        "levelLabel": "L3",
        "location": "us",
        "totalMedian": 207842,        # from .md -- PRIMARY figure
        "totalAverage": 208000,       # from HTML table -- supplementary
        "total": 207842,              # alias: totalMedian ?? totalAverage
        "base": 157000,               # average component split (HTML)
        "stockPerYear": 38600,
        "bonus": 12300,
        "stockGrantTotal4yr": 154400, # stockPerYear * 4
        "signingBonus": null,         # levels.fyi does not publish signing
        "submissions": 24216,         # company-wide total, may be null
        "sampleBand": "50+",
        "source": "levels.fyi",
        "sourceUrl": "https://www.levels.fyi/companies/google/salaries/software-engineer",
        "mdSourceUrl": "https://www.levels.fyi/companies/google/salaries/software-engineer.md",
        "method": "levels.fyi L3 entry-level median $207,842 (total) + average component split, read 2026-09-24",
        "confidence": "estimate",
        "accessDate": "2026-09-24",
        "status": "ok",
        "error": null,
        "mdError": null               # set when the .md fetch/parse failed
      }

  NOTE on median vs average: levels.fyi's HTML table is explicitly an
  *average*; the .md variant is explicitly a *median*. The leaderboard
  uses totalMedian as the primary figure because medians are robust to
  the outlier-heavy comp distribution. Components remain averages --
  label them honestly downstream.

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
    listed token), waits 3s between requests, and fetches ~26-52 pages per
    run (HTML + .md per company/location) -- human-scale traffic.
  - levels.fyi sanctions machine-readable access via `.md` page variants,
    `llms.txt`, sitemaps, and an official API -- but the `.md` summary only
    carries per-level *total* comp, not the base/stock/bonus split, so the
    script also parses the HTML breakdown table for components.
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
# entry_level is a regex matched against the HTML table's level cell with
# parenthetical qualifiers stripped, e.g. "L3SWE II (Entry Level)" -> "L3SWE II".
# md_level is a regex matched against the level label in the sanctioned .md
# variant's "Levels Breakdown" table, where labels are clean codes
# (e.g. "L3", "E3", "L4"). The two can differ: Amazon's HTML table shows
# "SDE I" while its .md table shows "L4".
# ---------------------------------------------------------------------------
# NOTE: patterns use (?![0-9]) instead of a trailing \b because levels.fyi
# concatenates the level and title without a space in the HTML
# (e.g. "L3SWE II"), which defeats \b.
COMPANIES = [
    {"name": "Google", "slug": "google", "entry_level": r"(?<![A-Z0-9])L3(?![0-9])", "md_level": r"^(?<![A-Z0-9])L3(?![0-9])$", "level_label": "L3"},
    {"name": "Meta", "slug": "meta", "entry_level": r"(?<![A-Z0-9])E3(?![0-9])", "md_level": r"^(?<![A-Z0-9])E3(?![0-9])$", "level_label": "E3"},
    {"name": "Amazon", "slug": "amazon", "entry_level": r"\bSDE\s?I(?![A-Z0-9])", "md_level": r"^(?<![A-Z0-9])L4(?![0-9])$", "level_label": "SDE I"},
    {"name": "Apple", "slug": "apple", "entry_level": r"(?<![A-Z0-9])ICT2(?![0-9])", "md_level": r"^(?<![A-Z0-9])ICT2(?![0-9])$", "level_label": "ICT2"},
    {"name": "Microsoft", "slug": "microsoft", "entry_level": r"(?<![0-9])59(?![0-9])", "md_level": r"^(?<![0-9])59(?![0-9])$", "level_label": "59"},
    {"name": "Netflix", "slug": "netflix", "entry_level": r"(?<![A-Z0-9])L3(?![0-9])", "md_level": r"^(?<![A-Z0-9])L3(?![0-9])$", "level_label": "L3"},
    {"name": "Nvidia", "slug": "nvidia", "entry_level": r"(?<![A-Z0-9])IC1(?![0-9])", "md_level": r"^(?<![A-Z0-9])IC1(?![0-9])$", "level_label": "IC1"},
    {"name": "Roblox", "slug": "roblox", "entry_level": r"(?<![A-Z0-9])IC1(?![0-9])", "md_level": r"^(?<![A-Z0-9])IC1(?![0-9])$", "level_label": "IC1"},
    {"name": "Pinterest", "slug": "pinterest", "entry_level": r"(?<![A-Z0-9])IC13(?![0-9])", "md_level": r"^(?<![A-Z0-9])IC13(?![0-9])$", "level_label": "IC13"},
    {"name": "Snap", "slug": "snap", "entry_level": r"(?<![A-Z0-9])L3(?![0-9])", "md_level": r"^(?<![A-Z0-9])L3(?![0-9])$", "level_label": "L3"},
    {"name": "Snowflake", "slug": "snowflake", "entry_level": r"(?<![A-Z0-9])IC1(?![0-9])", "md_level": r"^(?<![A-Z0-9])IC1(?![0-9])$", "level_label": "IC1"},
    {"name": "Stripe", "slug": "stripe", "entry_level": r"(?<![A-Z0-9])L1(?![0-9])", "md_level": r"^(?<![A-Z0-9])L1(?![0-9])$", "level_label": "L1"},
    {"name": "Databricks", "slug": "databricks", "entry_level": r"(?<![A-Z0-9])L3(?![0-9])", "md_level": r"^(?<![A-Z0-9])L3(?![0-9])$", "level_label": "L3"},
]

BASE_URL = "https://www.levels.fyi/companies/{slug}/salaries/software-engineer"


def md_url_for(slug, location_suffix):
    """.../software-engineer.md or .../software-engineer/locations/san-francisco-bay-area.md"""
    return BASE_URL.format(slug=slug) + location_suffix + ".md"
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
# .md variant: per-level MEDIAN totals (sanctioned machine-readable route).
# The .md page carries a "Levels Breakdown" markdown table:
#   | Level | Median Total Compensation |
#   | L3    | $207,842                  |
# It does NOT include the base/stock/bonus split -- that still comes from
# the HTML table (as averages). Location variants work the same way:
#   .../software-engineer.md
#   .../software-engineer/locations/san-francisco-bay-area.md
# ---------------------------------------------------------------------------
MD_LEVEL_ROW = re.compile(r"^\|\s*([^|]+?)\s*\|\s*([^|]+?)\s*\|$", re.M)


def parse_md_medians(md_body):
    """Return {level_label: median_total} from the .md Levels Breakdown table.

    Scoped to the '### Levels Breakdown' section so other markdown tables
    (if any) elsewhere in the page can't pollute the result.
    """
    section = md_body
    start = md_body.find("### Levels Breakdown")
    if start >= 0:
        section = md_body[start:]
        # end at the next horizontal rule or section header
        end = re.search(r"(?m)^(---|\s*##\s)", section)
        if end:
            section = section[: end.start()]
    medians = {}
    for level, total in MD_LEVEL_ROW.findall(section):
        level = level.strip()
        if level.lower() in ("level", "---"):
            continue
        value = parse_money(total)
        if value is not None:
            medians[level] = value
    return medians


def fetch_md(url, timeout=30):
    """Fetch the .md variant. Returns (status, body)."""
    req = urllib.request.Request(
        url,
        headers={
            "User-Agent": UA,
            "Accept": "text/markdown,text/plain",
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
# Per-company scrape: HTML (average component split) + .md (median totals)
# ---------------------------------------------------------------------------
def scrape_company(company, location_key, location_suffix, read_date, delay=3.0):
    url = BASE_URL.format(slug=company["slug"]) + location_suffix
    md_url = md_url_for(company["slug"], location_suffix)
    rec = {
        "company": company["name"],
        "levelLabel": company["level_label"],
        "location": location_key,
        "totalMedian": None,       # PRIMARY figure -- from .md
        "totalAverage": None,      # supplementary -- from HTML table
        "total": None,             # alias: totalMedian ?? totalAverage
        "base": None,              # average component split (HTML)
        "stockPerYear": None,
        "bonus": None,
        "stockGrantTotal4yr": None,
        "signingBonus": None,
        "submissions": None,
        "sampleBand": "unknown",
        "source": "levels.fyi",
        "sourceUrl": url,
        "mdSourceUrl": md_url,
        "method": "",
        "confidence": "estimate",
        "accessDate": read_date,
        "status": "failed",
        "error": None,
        "mdError": None,
    }

    # --- .md fetch: median totals -----------------------------------------
    # NOTE: the .md route is flaky under this UA (observed 2026-09-24:
    # intermittent HTTP 200 with empty body, flip-flopping between
    # requests). Retry persistently with backoff before falling back to
    # the HTML average -- this script runs quarterly, so waiting is fine.
    md_attempts = 5
    md_backoffs = [15, 30, 45, 60]
    md_body, md_status = "", 0
    for attempt in range(1, md_attempts + 1):
        try:
            md_status, md_body = fetch_md(md_url)
        except urllib.error.HTTPError as e:
            rec["mdError"] = f".md HTTP {e.code}: {e.reason}"
            if e.code in (401, 403):
                rec["mdError"] += " -- median total unavailable"
            md_body = None  # hard failure, don't retry
            break
        except Exception as e:  # noqa: BLE001
            rec["mdError"] = f".md fetch failed: {e}"
            md_body = None
            break
        if md_body and md_body.strip():
            break  # success
        if attempt < md_attempts:
            wait = md_backoffs[attempt - 1]
            print(f"  (.md empty, retry {attempt}/{md_attempts - 1} after {wait}s ...)", flush=True)
            time.sleep(wait)
    if md_body is None:
        pass  # mdError already set by the exception handler
    elif not md_body.strip():
        rec["mdError"] = (
            f".md returned HTTP {md_status} with empty body after "
            f"{md_attempts} attempts (rate-limited); median total unavailable, "
            "falling back to HTML average"
        )
    elif re.search(r"just a moment|cf-chl|challenge-platform", md_body, re.I):
        rec["mdError"] = "bot challenge on .md endpoint; median total unavailable"
    else:
        medians = parse_md_medians(md_body)
        pattern = re.compile(company["md_level"], re.I)
        match = next((lvl for lvl in medians if pattern.search(lvl)), None)
        if match is None:
            rec["mdError"] = (
                f"entry-level /{company['md_level']}/ not in .md table; "
                f"levels seen: {sorted(medians)[:8]}"
            )
        else:
            rec["totalMedian"] = medians[match]

    time.sleep(delay)

    # --- HTML fetch: average component split ------------------------------
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

    rec["totalAverage"] = parse_money(col(i_total))
    rec["base"] = parse_money(col(i_base))
    rec["stockPerYear"] = parse_money(col(i_stock))
    rec["bonus"] = parse_money(col(i_bonus))
    if rec["stockPerYear"] is not None:
        rec["stockGrantTotal4yr"] = rec["stockPerYear"] * 4

    rec["total"] = rec["totalMedian"] if rec["totalMedian"] is not None else rec["totalAverage"]

    subs = extract_submissions(html)
    rec["submissions"] = subs
    rec["sampleBand"] = "50+" if subs and subs >= 50 else "unknown"

    if rec["total"] is None and rec["base"] is None:
        rec["error"] = "entry row found but no parseable figures"
        return rec

    # method text: be explicit about median vs average
    parts = [f"levels.fyi {company['level_label']} entry-level"]
    if rec["totalMedian"] is not None:
        parts.append(f"median total ${rec['totalMedian']:,}")
    else:
        parts.append("median total n/a")
    parts.append("average base/stock/bonus split")
    parts.append(f"read {read_date}")
    rec["method"] = ", ".join(parts)

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
        rec = scrape_company(company, loc_key, LOCATIONS[loc_key], read_date, args.delay)
        results.append(rec)
        if rec["status"] == "ok":
            fmt = lambda v: f"${v:,}" if v is not None else "n/a"  # noqa: E731
            print(f"  ok: median_total={fmt(rec['totalMedian'])} avg_total={fmt(rec['totalAverage'])} "
                  f"base={fmt(rec['base'])} stock/yr={fmt(rec['stockPerYear'])} "
                  f"bonus={fmt(rec['bonus'])} subs={rec['submissions']}")
            if rec["mdError"]:
                print(f"  note: {rec['mdError']}")
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
