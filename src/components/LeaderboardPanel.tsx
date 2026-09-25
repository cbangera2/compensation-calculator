"use client";

import { useEffect, useMemo, useState } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DATASET_VERSION,
  GRANT_DATE_ASSUMPTION,
  GRANT_DATE_BY_YEAR,
  LAST_VERIFIED,
  LEADERBOARD_BY_YEAR,
  LEADERBOARD_YEARS,
  type TLeaderboardEntry,
  type TLeaderboardYear,
} from '@/data/leaderboard2024';
import {
  STARTUP_DATASET_VERSION,
  STARTUP_LAST_VERIFIED,
  STARTUP_LEADERBOARD,
  type TStartupEntry,
} from '@/data/startupLeaderboard2024';
import {
  COMPANY_GROUPS,
  COMPANY_GROUP_LABELS,
  type TCompanyGroup,
} from '@/data/companyGroups';
import { ALL_CITY_PRESETS, matchCityPresetKey } from '@/lib/col';
import { offerToLeaderboardEntry } from '@/lib/userLeaderboard';
import { useStore } from '@/state/store';
import {
  offerTcAtGrant,
  priceAtDate,
  realized4yr,
  startupTcPerYearWithGrowth,
  stockGrowthSinceGrant,
  tcPerYearWithGrowth,
  valuationGrowthSince2024,
  type GrantPricePoints,
} from '@/lib/leaderboard';
import type { HistoryStats } from '@/lib/market';
import { formatCurrency, cn } from '@/lib/utils';
import { ArrowDown, ArrowUp, ArrowUpDown, Database, Info, RotateCcw } from 'lucide-react';

type SortKey = 'realized' | 'company' | 'tc' | 'growth' | 'tcPerYear';
type StartupSortKey = 'growth' | 'company';

/**
 * Fallback COL factor when an offer's city has no preset (e.g. a US-wide
 * aggregate). Per-offer normalization: adjusted = nominal / offerCityFactor *
 * baseCity.factor, so each row converts FROM its own city (shown under the
 * company name) TO the selected base city.
 */
const BAY_AREA_FACTOR = 1.4;

interface Row {
  entry: TLeaderboardEntry;
  tcAtGrant: number | null;
  prices: GrantPricePoints | null;
  priceFailed: boolean;
  growth: number | null;
  realized: number | null;
  tcPerYear: number | null;
  rank: number | null;
}

interface StartupRow {
  entry: TStartupEntry;
  growth: number | null;
  tcPerYear: number | null;
  rank: number | null;
}

function formatPct(x: number): string {
  const sign = x >= 0 ? '+' : '';
  return `${sign}${(x * 100).toFixed(1)}%`;
}

function formatValuation(usd: number): string {
  if (usd >= 1e9) {
    const b = usd / 1e9;
    return `$${b >= 100 ? Math.round(b).toString() : (Math.round(b * 10) / 10).toString()}B`;
  }
  if (usd >= 1e6) {
    return `$${(Math.round((usd / 1e6) * 10) / 10).toString()}M`;
  }
  return formatCurrency(usd);
}

export default function LeaderboardPanel() {
  const [prices, setPrices] = useState<Record<string, GrantPricePoints>>({});
  const [failed, setFailed] = useState<string[]>([]);
  const [status, setStatus] = useState<'loading' | 'done' | 'error'>('loading');
  const [sortKey, setSortKey] = useState<SortKey>('realized');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [startupSortKey, setStartupSortKey] = useState<StartupSortKey>('growth');
  const [startupSortDir, setStartupSortDir] = useState<'asc' | 'desc'>('desc');
  const [activeGroups, setActiveGroups] = useState<TCompanyGroup[]>([...COMPANY_GROUPS]);
  const [colAdjust, setColAdjust] = useState(false);
  const [baseCityKey, setBaseCityKey] = useState('renter-ann-arbor');
  // Offer-leaderboard year tab. 2024 holds the full dataset; 2025/2026 render
  // honest empty states. The startup valuation table is latest-valuations and
  // is NOT governed by this tab.
  const [year, setYear] = useState<TLeaderboardYear>('2024');

  const entries = LEADERBOARD_BY_YEAR[year];

  /** Growth/realized columns are only computed for the 2024 class. */
  const growthNa = year !== '2024';

  const baseCity = ALL_CITY_PRESETS.find((c) => c.key === baseCityKey) ?? ALL_CITY_PRESETS[0];
  /** COL factor for an offer's city; falls back to Bay Area when the city has no preset. */
  const offerCityFactor = (city: string): number => {
    const preset = ALL_CITY_PRESETS.find((c) => c.key === matchCityPresetKey(city));
    return preset?.factor ?? BAY_AREA_FACTOR;
  };
  const colScaleForCity = (city: string): number =>
    colAdjust ? baseCity.factor / offerCityFactor(city) : 1;
  /** Scale a TC figure from its offer city into base-city purchasing-power dollars. */
  const colAdjFor =
    (city: string) =>
    (n: number | null): number | null =>
      n === null ? null : n * colScaleForCity(city);
  /** Startup-table rows carry no city; they keep the Bay Area assumption. */
  const colAdj = colAdjFor('San Francisco Bay Area');
  const tcSuffix = colAdjust ? ' (adj.)' : '';

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setStatus('loading');
      setFailed([]);
      const tickers = [...new Set(entries.map((e) => e.ticker).filter((t): t is string => t !== null))];
      // Growth/realized are computed only for the 2024 class (two years of
      // market history). 2025/2026 rows show offer TC at grant only — their
      // growth columns render n/a, so no price fetches are needed.
      if (year !== '2024' || tickers.length === 0) {
        setPrices({});
        setFailed([]);
        setStatus('done');
        return;
      }
      const results = await Promise.all(
        tickers.map(async (t) => {
          try {
            const res = await fetch(`/api/market/history?ticker=${encodeURIComponent(t)}`);
            const json = await res.json();
            if (!res.ok) throw new Error(json?.error ?? `request failed (${res.status})`);
            const stats = json as HistoryStats;
            const anchor = priceAtDate(stats.closes, GRANT_DATE_BY_YEAR[year]);
            if (!anchor) throw new Error('no price near grant date');
            return {
              ticker: t,
              points: {
                priceAtGrant: anchor.close,
                priceNow: stats.latestPrice,
                grantAnchorDate: anchor.date,
                asOfDate: stats.latestDate,
              } satisfies GrantPricePoints,
            };
          } catch {
            return { ticker: t, points: null as GrantPricePoints | null };
          }
        }),
      );
      if (cancelled) return;
      const ok: Record<string, GrantPricePoints> = {};
      const bad: string[] = [];
      for (const r of results) {
        if (r.points) ok[r.ticker] = r.points;
        else bad.push(r.ticker);
      }
      setPrices(ok);
      setFailed(bad);
      setStatus(Object.keys(ok).length === 0 ? 'error' : 'done');
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [year, entries]);

  const groupCounts = useMemo(() => {
    const map = new Map<TCompanyGroup, Set<string>>();
    for (const e of [...LEADERBOARD_BY_YEAR[year], ...STARTUP_LEADERBOARD]) {
      if (!map.has(e.group)) map.set(e.group, new Set());
      map.get(e.group)!.add(e.company);
    }
    return map;
  }, [year]);

  const toggleGroup = (g: TCompanyGroup) => {
    setActiveGroups((prev) => (prev.includes(g) ? prev.filter((x) => x !== g) : [...prev, g]));
  };

  const rows: Row[] = useMemo(() => {
    const visible = entries.filter((e) => activeGroups.includes(e.group));
    const base: Row[] = visible.map((entry) => {
      const p = entry.ticker ? (prices[entry.ticker] ?? null) : null;
      const priceFailed = entry.ticker !== null && p === null && failed.includes(entry.ticker);
      const realized = realized4yr(entry, p);
      return {
        entry,
        tcAtGrant: offerTcAtGrant(entry),
        prices: p,
        priceFailed,
        growth: stockGrowthSinceGrant(p),
        realized,
        tcPerYear: tcPerYearWithGrowth(realized),
        rank: null,
      };
    });
    // Rank by realized value descending for the 2024 class; by offer TC at grant
    // for other years (their realized columns are n/a). Private/failed/
    // missing-offer rows are unranked.
    const rankVal = (r: Row): number | null => (year === '2024' ? r.realized : r.tcAtGrant);
    const ranked = base
      .filter((r) => rankVal(r) !== null)
      .sort((a, b) => (rankVal(b) as number) - (rankVal(a) as number));
    ranked.forEach((r, i) => {
      r.rank = i + 1;
    });
    return base;
  }, [prices, failed, activeGroups, entries, year]);

  const sorted = useMemo(() => {
    const dir = sortDir === 'asc' ? 1 : -1;
    const nullRank = (r: Row): boolean =>
      (sortKey === 'growth' && r.growth === null) ||
      (sortKey === 'realized' && r.realized === null) ||
      (sortKey === 'tc' && r.tcAtGrant === null) ||
      (sortKey === 'tcPerYear' && r.tcPerYear === null);
    const val = (r: Row): number | string => {
      switch (sortKey) {
        case 'company':
          return r.entry.company;
        case 'tc':
          return r.tcAtGrant ?? Number.NEGATIVE_INFINITY;
        case 'growth':
          return r.growth ?? Number.NEGATIVE_INFINITY;
        case 'tcPerYear':
          return r.tcPerYear ?? Number.NEGATIVE_INFINITY;
        case 'realized':
        default:
          return r.realized ?? Number.NEGATIVE_INFINITY;
      }
    };
    return [...rows].sort((a, b) => {
      // Nulls (private / failed prices / missing offers) always sort last.
      const aNull = nullRank(a);
      const bNull = nullRank(b);
      if (aNull && !bNull) return 1;
      if (bNull && !aNull) return -1;
      const va = val(a);
      const vb = val(b);
      if (typeof va === 'string' && typeof vb === 'string') return va.localeCompare(vb) * dir;
      return ((va as number) - (vb as number)) * dir;
    });
  }, [rows, sortKey, sortDir]);

  const startupRows: StartupRow[] = useMemo(() => {
    const visible = STARTUP_LEADERBOARD.filter((e) => activeGroups.includes(e.group));
    const base: StartupRow[] = visible.map((entry) => ({
      entry,
      growth: valuationGrowthSince2024(entry),
      tcPerYear: startupTcPerYearWithGrowth(entry),
      rank: null,
    }));
    // Rank by valuation growth descending; unanchored rows are unranked.
    const ranked = base.filter((r) => r.growth !== null).sort((a, b) => (b.growth as number) - (a.growth as number));
    ranked.forEach((r, i) => {
      r.rank = i + 1;
    });
    return base;
  }, [activeGroups]);

  const sortedStartups = useMemo(() => {
    const dir = startupSortDir === 'asc' ? 1 : -1;
    return [...startupRows].sort((a, b) => {
      if (startupSortKey === 'company') return a.entry.company.localeCompare(b.entry.company) * dir;
      // growth: nulls (no 2024 anchor) always sort last.
      const aNull = a.growth === null;
      const bNull = b.growth === null;
      if (aNull && !bNull) return 1;
      if (bNull && !aNull) return -1;
      return (((a.growth ?? 0) - (b.growth ?? 0)) as number) * dir;
    });
  }, [startupRows, startupSortKey, startupSortDir]);

  const asOfDate = useMemo(() => {
    const first = Object.values(prices)[0];
    return first?.asOfDate ?? null;
  }, [prices]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir(key === 'company' ? 'asc' : 'desc');
    }
  };

  const toggleStartupSort = (key: StartupSortKey) => {
    if (startupSortKey === key) {
      setStartupSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setStartupSortKey(key);
      setStartupSortDir(key === 'company' ? 'asc' : 'desc');
    }
  };

  const SortButton = ({ label, k, align = 'left' }: { label: string; k: SortKey; align?: 'left' | 'right' }) => (
    <button
      type="button"
      onClick={() => toggleSort(k)}
      className={cn(
        'inline-flex items-center gap-1 font-medium hover:text-foreground',
        align === 'right' && 'flex-row-reverse',
      )}
    >
      {label}
      {sortKey === k ? (
        sortDir === 'asc' ? (
          <ArrowUp className="size-3.5" />
        ) : (
          <ArrowDown className="size-3.5" />
        )
      ) : (
        <ArrowUpDown className="size-3.5 opacity-40" />
      )}
    </button>
  );

  const StartupSortButton = ({ label, k, align = 'left' }: { label: string; k: StartupSortKey; align?: 'left' | 'right' }) => (
    <button
      type="button"
      onClick={() => toggleStartupSort(k)}
      className={cn(
        'inline-flex items-center gap-1 font-medium hover:text-foreground',
        align === 'right' && 'flex-row-reverse',
      )}
    >
      {label}
      {startupSortKey === k ? (
        startupSortDir === 'asc' ? (
          <ArrowUp className="size-3.5" />
        ) : (
          <ArrowDown className="size-3.5" />
        )
      ) : (
        <ArrowUpDown className="size-3.5 opacity-40" />
      )}
    </button>
  );

  const colNote = colAdjust
    ? ` TC figures in ${baseCity.name} purchasing-power dollars (assumes Bay Area offers).`
    : '';

  return (
    <div className="space-y-4 sm:space-y-6">
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <span className="text-xs font-medium text-muted-foreground">Year:</span>
            <div
              role="tablist"
              aria-label="Offer leaderboard year"
              className="inline-flex rounded-lg border border-border/70 bg-muted/40 p-0.5"
            >
              {LEADERBOARD_YEARS.map((y) => (
                <button
                  key={y}
                  type="button"
                  role="tab"
                  aria-selected={year === y}
                  onClick={() => {
                    setYear(y);
                    // Growth columns are n/a outside 2024, so those classes
                    // default-sort by offer TC at grant instead of realized value.
                    setSortKey(y === '2024' ? 'realized' : 'tc');
                    setSortDir('desc');
                  }}
                  className={cn(
                    'rounded-md px-3 py-1 text-xs font-medium transition-colors',
                    year === y
                      ? 'bg-background text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  {y}
                </button>
              ))}
            </div>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
            <span className="text-xs font-medium text-muted-foreground">Groups:</span>
            {COMPANY_GROUPS.map((g) => (
              <label key={g} className="inline-flex cursor-pointer items-center gap-1.5 text-xs">
                <input
                  type="checkbox"
                  checked={activeGroups.includes(g)}
                  onChange={() => toggleGroup(g)}
                  className="size-3.5 accent-primary"
                  aria-label={`Show ${COMPANY_GROUP_LABELS[g]} companies`}
                />
                {COMPANY_GROUP_LABELS[g]}
                <span className="text-muted-foreground">({groupCounts.get(g)?.size ?? 0})</span>
              </label>
            ))}
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-border/60 pt-3">
            <label className="inline-flex cursor-pointer items-center gap-1.5 text-xs font-medium">
              <input
                type="checkbox"
                checked={colAdjust}
                onChange={(e) => setColAdjust(e.target.checked)}
                className="size-3.5 accent-primary"
                aria-label="Adjust TC figures by cost of living"
              />
              Adjust by COL
            </label>
            {colAdjust && (
              <label className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                Base city:
                <select
                  value={baseCityKey}
                  onChange={(e) => setBaseCityKey(e.target.value)}
                  className="rounded-md border border-border bg-background px-2 py-1 text-xs"
                  aria-label="Base city for COL adjustment"
                >
                  {ALL_CITY_PRESETS.map((c) => (
                    <option key={c.key} value={c.key}>
                      {c.name} ({c.factor.toFixed(2)}×)
                    </option>
                  ))}
                </select>
              </label>
            )}
          </div>
          {colAdjust && (
            <p className="mt-2 text-xs text-muted-foreground">
              TC figures shown in {baseCity.name} purchasing-power dollars. Assumes offers are Bay Area
              dollars — per-offer cities aren&apos;t in the source data, so this is a re-denomination,
              not a per-offer correction.
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <CardTitle className="text-base sm:text-lg">{year} New-Grad Leaderboard</CardTitle>
              <CardDescription>
                {year === '2024' ? (
                  <>
                    What 2024 new-grad offers are actually worth today — 4-year grants marked to live
                    market prices{asOfDate ? ` as of ${asOfDate}` : ''}.{colNote}
                  </>
                ) : (
                  <>
                    What {year} new-grad offers looked like at grant — sourced aggregates, ranked by
                    offer TC at grant. Stock growth is only computed for the 2024 class, so the
                    growth columns here are n/a.{colNote}
                  </>
                )}
              </CardDescription>
            </div>
            {entries.length > 0 && (
              <span
                title={`Leaderboard dataset ${DATASET_VERSION}, last verified ${LAST_VERIFIED}`}
                className="inline-flex items-center gap-1 rounded-full border border-border/70 bg-muted/40 px-2.5 py-0.5 text-xs font-medium text-muted-foreground"
              >
                <Database className="size-3" />
                {DATASET_VERSION} · verified {LAST_VERIFIED}
              </span>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {status === 'loading' && (
            <div className="flex items-center gap-2 py-10 text-sm text-muted-foreground" role="status">
              <RotateCcw className="size-4 animate-spin" />
              Loading live market prices…
            </div>
          )}
          {status === 'error' && (
            <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-sm">
              <p className="font-medium">Couldn’t load market prices.</p>
              <p className="mt-1 text-muted-foreground">
                The price history service is unreachable. The offer data below is still valid — only the
                realized-value columns need prices.
              </p>
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="mt-3 inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium hover:bg-accent"
              >
                <RotateCcw className="size-3.5" /> Retry
              </button>
            </div>
          )}
          {status !== 'loading' && status !== 'error' && (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-14">Rank</TableHead>
                  <TableHead>
                    <SortButton label="Company" k="company" />
                  </TableHead>
                  <TableHead>Level</TableHead>
                  <TableHead className="text-right">
                    <SortButton label={`${year} offer TC at grant${tcSuffix}`} k="tc" align="right" />
                  </TableHead>
                  <TableHead className="text-right">
                    <SortButton label="Stock since grant" k="growth" align="right" />
                  </TableHead>
                  <TableHead className="text-right">
                    <SortButton label={`Realized 4yr value today${tcSuffix}`} k="realized" align="right" />
                  </TableHead>
                  <TableHead className="text-right">
                    <SortButton label={`TC/yr with growth${tcSuffix}`} k="tcPerYear" align="right" />
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {entries.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="whitespace-normal! py-10 text-center">
                      <p className="text-sm font-medium">No sourced offers yet for {year}</p>
                      <p className="mx-auto mt-1 max-w-md text-xs text-muted-foreground">
                        Verified {year} new-grad offer data hasn&apos;t been collected yet. When it is, it
                        will appear here ranked by realized value — nothing is filled in or estimated in
                        the meantime.
                      </p>
                    </TableCell>
                  </TableRow>
                ) : (
                  sorted.map((r) => (
                  <TableRow key={r.entry.company}>
                    <TableCell className="font-semibold tabular-nums">
                      {r.rank ?? <span className="text-muted-foreground">—</span>}
                    </TableCell>
                    <TableCell>
                      <div className="font-medium">{r.entry.company}</div>
                      <div className="text-xs text-muted-foreground">
                        {COMPANY_GROUP_LABELS[r.entry.group]}
                      </div>
                      <div className="text-xs text-muted-foreground">{r.entry.city}</div>
                      {r.entry.confidence === 'estimate' && (
                        <div className="text-xs text-muted-foreground">estimate</div>
                      )}
                      {r.entry.confidence === 'unavailable' && (
                        <div className="text-xs text-muted-foreground">no offer data</div>
                      )}
                      {r.entry.ticker === null && (
                        <div className="text-xs text-muted-foreground">private</div>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{r.entry.levelLabel}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {r.tcAtGrant !== null ? (
                        formatCurrency(colAdjFor(r.entry.city)(r.tcAtGrant) as number)
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {growthNa ? (
                        <span
                          className="text-xs text-muted-foreground"
                          title="Stock growth is only computed for the 2024 class"
                        >
                          n/a
                        </span>
                      ) : r.entry.ticker === null ? (
                        <span className="text-xs text-muted-foreground">n/a (private)</span>
                      ) : r.priceFailed ? (
                        <span className="text-xs text-muted-foreground">price unavailable</span>
                      ) : r.growth !== null ? (
                        <span className={cn(r.growth >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400')}>
                          {formatPct(r.growth)}
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right font-medium tabular-nums">
                      {growthNa ? (
                        <span
                          className="text-xs font-normal text-muted-foreground"
                          title="Realized value is only computed for the 2024 class"
                        >
                          n/a
                        </span>
                      ) : r.entry.ticker === null ? (
                        <span className="text-xs font-normal text-muted-foreground">n/a (private)</span>
                      ) : r.priceFailed ? (
                        <span className="text-xs font-normal text-muted-foreground">price unavailable</span>
                      ) : r.realized !== null ? (
                        formatCurrency(colAdjFor(r.entry.city)(r.realized) as number)
                      ) : (
                        <span className="text-xs font-normal text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {growthNa ? (
                        <span
                          className="text-xs text-muted-foreground"
                          title="Annualized with growth — only computed for the 2024 class"
                        >
                          n/a
                        </span>
                      ) : r.tcPerYear !== null ? (
                        formatCurrency(colAdjFor(r.entry.city)(r.tcPerYear) as number)
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                  </TableRow>
                )))}
              </TableBody>
            </Table>
          )}
          {failed.length > 0 && status === 'done' && (
            <p className="mt-3 text-xs text-muted-foreground">
              Price history unavailable for: {failed.join(', ')}. Those rows show offer data only.
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <CardTitle className="text-base sm:text-lg">Top startups</CardTitle>
              <CardDescription>
                Private-company valuation growth since ~Aug 2024 — how the hottest private grants
                appreciated. Sorted by growth; companies without a 2024-era anchor are listed last,
                unranked.{colNote}
              </CardDescription>
            </div>
            <span
              title={`Startup dataset ${STARTUP_DATASET_VERSION}, last verified ${STARTUP_LAST_VERIFIED}`}
              className="inline-flex items-center gap-1 rounded-full border border-border/70 bg-muted/40 px-2.5 py-0.5 text-xs font-medium text-muted-foreground"
            >
              <Database className="size-3" />
              {STARTUP_DATASET_VERSION} · verified {STARTUP_LAST_VERIFIED}
            </span>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-14">Rank</TableHead>
                <TableHead>
                  <StartupSortButton label="Company" k="company" />
                </TableHead>
                <TableHead className="text-right">Latest valuation</TableHead>
                <TableHead className="text-right">Valuation ~Aug 2024</TableHead>
                <TableHead className="text-right">
                  <StartupSortButton label="Growth since 2024" k="growth" align="right" />
                </TableHead>
                <TableHead className="text-right">2024 NG offer TC{tcSuffix}</TableHead>
                <TableHead className="text-right">TC/yr with growth{tcSuffix}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedStartups.map((r) => (
                <TableRow key={r.entry.company}>
                  <TableCell className="font-semibold tabular-nums">
                    {r.rank ?? <span className="text-muted-foreground">—</span>}
                  </TableCell>
                  <TableCell>
                    <div className="font-medium">{r.entry.company}</div>
                    <div className="text-xs text-muted-foreground">
                      {COMPANY_GROUP_LABELS[r.entry.group]}
                    </div>
                    <div className="text-xs text-muted-foreground">{r.entry.city}</div>
                    {r.entry.confidence === 'estimate' && (
                      <div className="text-xs text-muted-foreground">estimate</div>
                    )}
                    {r.entry.valuationAug2024Usd === null && (
                      <div className="text-xs text-muted-foreground">no 2024 anchor</div>
                    )}
                    {r.entry.ngOfferTc2024 === null && (
                      <div className="text-xs text-muted-foreground">no offer data</div>
                    )}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    <div className="font-medium">{formatValuation(r.entry.latestValuationUsd)}</div>
                    <div className="text-xs font-normal text-muted-foreground">
                      {r.entry.latestValuationDate} · {r.entry.latestValuationEvent}
                    </div>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {r.entry.valuationAug2024Usd !== null ? (
                      <>
                        <div>{formatValuation(r.entry.valuationAug2024Usd)}</div>
                        <div className="text-xs font-normal text-muted-foreground">
                          {r.entry.valuationAug2024Date}
                        </div>
                      </>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {r.growth !== null ? (
                      <span className={cn(r.growth >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400')}>
                        {formatPct(r.growth)}
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {r.entry.ngOfferTc2024 !== null ? (
                      formatCurrency(colAdj(r.entry.ngOfferTc2024) as number)
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right font-medium tabular-nums">
                    {r.tcPerYear !== null ? (
                      formatCurrency(colAdj(r.tcPerYear) as number)
                    ) : (
                      <span className="text-xs font-normal text-muted-foreground">—</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm">
            <Info className="size-4" /> Methodology — read before citing
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-xs leading-relaxed text-muted-foreground">
          <p>
            <strong className="text-foreground">What this is.</strong> New-grad software-engineer
            offers. The 2024 class is ranked by realized 4-year value: base × 4 + signing + the 4-year
            stock grant marked
            from its grant-date price to today’s price. Grant date is assumed to be August of the
            selected year for every entry (disclosed canonical assumption, e.g. {GRANT_DATE_ASSUMPTION}{' '}
            for 2024); the price anchor is the nearest monthly close. <strong className="text-foreground">TC/yr with growth</strong>{' '}
            is the same figure annualized — realized 4-year value ÷ 4, i.e. average annual TC with stock
            growth applied. It assumes the grant vests evenly over 4 years with no refreshers; it is a
            grant-marking comparison, not take-home pay. The 2025/2026 classes rank by offer TC at grant
            instead (growth not computed — see Years).
          </p>
          <p>
            <strong className="text-foreground">Where the numbers come from.</strong> Every comp
            figure comes from levels.fyi and nothing else — no Medium articles, no other sources. Most
            2024 rows are levels.fyi Bay Area entry-level <em>averages</em> (levels.fyi labels them
            &quot;Average Compensation By Level&quot;), read 2026-09-24, with each row&apos;s submission
            count disclosed in its method. levels.fyi aggregates do not report signing bonuses, so those
            rows count signing as $0: unknown, not zero, and the at-grant TC understates offers that had
            one. Arm has no Bay Area aggregate on levels.fyi, so its row uses the Austin aggregate and is
            labeled Austin. Palantir has no entry-level salary band on levels.fyi — only job-posting base
            ranges ($135–155K) — so its row is a postings-based estimate: base is the $145K midpoint and
            equity is null (unknown, not zero), meaning its at-grant TC and realized columns reflect base
            only. LinkedIn and ByteDance have no levels.fyi entry-level data and are shown as insufficient
            data rather than invented. LinkedIn (Microsoft subsidiary) and ByteDance (private) have no
            ticker; their growth/realized columns are n/a by construction.
          </p>
          <p>
            <strong className="text-foreground">Top startups.</strong> Latest private valuations are
            press-covered funding rounds, tender offers, or secondary marks — never private cap-table
            data. Growth = latest ÷ ~Aug-2024 anchor − 1; the anchor is the nearest press-covered 2024-era
            mark, labeled with its real date (never silently treated as exactly Aug 2024). Companies
            without a 2024-era anchor (Discord) are listed last, unranked. &quot;2024 NG offer TC&quot;
            appears only where a levels.fyi entry-level figure exists (Stripe, Databricks from the same
            Bay Area aggregates as the board above; Anduril, Ramp, Vercel, Rippling, Discord, and OpenAI
            from their US-wide aggregates — no Bay Area entry-level pages exist for those). OpenAI&apos;s
            page publishes only a median total, so its breakdown is blank and its growth-marked TC is
            n/a. Companies with no entry-level data on levels.fyi (Anthropic, Perplexity, Figure AI,
            Canva, Mercor) show no offer figures rather than mislabeled ones. Applied Intuition has
            no Sunnyvale-specific public new-grad figure — levels.fyi
            publishes only a US-wide aggregate — so its offer columns are blank rather than mislabeled,
            and owner private comp data is never used. <strong className="text-foreground">TC/yr with growth</strong>{' '}
            re-prices only the stock portion of that TC at valuation growth: one year of the
            stock grant is multiplied by (latest ÷ anchor), base stays fixed, and a one-time
            signing bonus is annualized (÷ 4) rather than counted as recurring cash. Tender-offer and
            secondary-market marks are not equivalent to primary-round valuations; private equity is
            illiquid paper. Palantir is public (PLTR) so it sits on the board above, not here; SpaceX is
            excluded because it reportedly went public in June 2026.
          </p>
          <p>
            <strong className="text-foreground">Years.</strong> The year tabs switch the offer leaderboard
            by graduating class; each year gets its own canonical grant-date assumption (August of that
            year). The <strong className="text-foreground">2025</strong> tab holds 8 levels.fyi
            entry-level aggregates (the same all-years rolling averages as 2026, read 2026-09-24, filed
            under the 2025 grant date — no 2025-anchored aggregates exist). The{' '}
            <strong className="text-foreground">2026</strong>{' '}
            tab holds 28 levels.fyi entry-level aggregates read 2026-09-24 — all-years rolling averages,
            labeled <em>estimate</em>, with their own submission counts; Canva is omitted (Australia-only
            A$ figures) as are Perplexity, Mercor, and Figure AI (no defensible entry-level
            aggregate). Growth/realized columns are computed only for the 2024 class; 2025 and 2026 rank by
            offer TC at grant and their growth columns are n/a — never invented. The Top startups table is
            latest valuations, not year-specific, and is unaffected by the tabs.
          </p>
          <p>
            <strong className="text-foreground">Groups &amp; COL.</strong> The group checkboxes filter
            both tables and each ranking re-computes over the visible rows. Each offer row shows its city
            under the company name. &quot;Adjust by COL&quot; re-denominates TC figures into the selected
            base city&apos;s purchasing-power dollars with a per-offer correction: each row is converted
            <em> from its own city</em> (e.g. Arm&apos;s Austin figures are divided by Austin&apos;s
            factor, Bay Area rows by the Bay Area factor), so it is a genuine normalization, not a blanket
            re-denomination. Valuation and growth columns are never COL-adjusted.
          </p>
          <p>
            <strong className="text-foreground">What it ignores.</strong> Self-reported data: the
            levels.fyi aggregates carry their own submission counts (disclosed per row), and Bay Area
            figures can run hotter than national averages. Pre-tax. Vesting schedules (e.g. Amazon’s
            5/15/40/40 back-load, Nvidia’s 40/30/20/10 front-load), refreshers,
            bonuses after year 1, and taxes are not modeled. Signing bonuses are counted in full in the
            at-grant TC even when paid over two years. Private-company equity (Stripe, Databricks) is
            illiquid paper — shown as n/a, not zero.
          </p>
          <p>
            <strong className="text-foreground">What it is not.</strong> Not a median, not advice, and not
            a claim about what any individual was offered. For comparing which 2024 grants grew the most —
            not for negotiating.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
