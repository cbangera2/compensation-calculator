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
  LAST_VERIFIED,
  LEADERBOARD_2024,
  type TLeaderboardEntry,
} from '@/data/leaderboard2024';
import {
  offerTcAtGrant,
  priceAtDate,
  realized4yr,
  stockGrowthSinceGrant,
  type GrantPricePoints,
} from '@/lib/leaderboard';
import type { HistoryStats } from '@/lib/market';
import { formatCurrency, cn } from '@/lib/utils';
import { ArrowDown, ArrowUp, ArrowUpDown, Database, Info, RotateCcw } from 'lucide-react';

type SortKey = 'realized' | 'company' | 'tc' | 'growth';

interface Row {
  entry: TLeaderboardEntry;
  tcAtGrant: number;
  prices: GrantPricePoints | null;
  priceFailed: boolean;
  growth: number | null;
  realized: number | null;
  rank: number | null;
}

function formatPct(x: number): string {
  const sign = x >= 0 ? '+' : '';
  return `${sign}${(x * 100).toFixed(1)}%`;
}

function SortButton({
  label,
  k,
  align = 'left',
  sortKey,
  sortDir,
  onToggle,
}: {
  label: string;
  k: SortKey;
  align?: 'left' | 'right';
  sortKey: SortKey;
  sortDir: 'asc' | 'desc';
  onToggle: (key: SortKey) => void;
}) {
  const active = sortKey === k;
  return (
    <button
      type="button"
      onClick={() => onToggle(k)}
      className={cn(
        'inline-flex items-center gap-1 font-medium hover:text-foreground',
        align === 'right' && 'flex-row-reverse',
      )}
    >
      {label}
      {active ? (
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
}

export default function LeaderboardPanel() {
  const [prices, setPrices] = useState<Record<string, GrantPricePoints>>({});
  const [failed, setFailed] = useState<string[]>([]);
  const [status, setStatus] = useState<'loading' | 'done' | 'error'>('loading');
  const [sortKey, setSortKey] = useState<SortKey>('realized');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setStatus('loading');
      setFailed([]);
      const tickers = [...new Set(LEADERBOARD_2024.map((e) => e.ticker).filter((t): t is string => t !== null))];
      const results = await Promise.all(
        tickers.map(async (t) => {
          try {
            const res = await fetch(`/api/market/history?ticker=${encodeURIComponent(t)}`);
            const json = await res.json();
            if (!res.ok) throw new Error(json?.error ?? `request failed (${res.status})`);
            const stats = json as HistoryStats;
            const anchor = priceAtDate(stats.closes, GRANT_DATE_ASSUMPTION);
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
  }, []);

  const rows: Row[] = useMemo(() => {
    const base: Row[] = LEADERBOARD_2024.map((entry) => {
      const p = entry.ticker ? (prices[entry.ticker] ?? null) : null;
      const priceFailed = entry.ticker !== null && p === null && failed.includes(entry.ticker);
      return {
        entry,
        tcAtGrant: offerTcAtGrant(entry),
        prices: p,
        priceFailed,
        growth: stockGrowthSinceGrant(p),
        realized: realized4yr(entry, p),
        rank: null,
      };
    });
    // Rank by realized value descending; private/failed rows are unranked.
    const ranked = base.filter((r) => r.realized !== null).sort((a, b) => (b.realized as number) - (a.realized as number));
    ranked.forEach((r, i) => {
      r.rank = i + 1;
    });
    return base;
  }, [prices, failed]);

  const sorted = useMemo(() => {
    const dir = sortDir === 'asc' ? 1 : -1;
    const val = (r: Row): number | string => {
      switch (sortKey) {
        case 'company':
          return r.entry.company;
        case 'tc':
          return r.tcAtGrant;
        case 'growth':
          return r.growth ?? Number.NEGATIVE_INFINITY;
        case 'realized':
        default:
          return r.realized ?? Number.NEGATIVE_INFINITY;
      }
    };
    return [...rows].sort((a, b) => {
      const va = val(a);
      const vb = val(b);
      // Nulls (private / failed prices) always sort last.
      const aNull = (sortKey === 'growth' && a.growth === null) || (sortKey === 'realized' && a.realized === null);
      const bNull = (sortKey === 'growth' && b.growth === null) || (sortKey === 'realized' && b.realized === null);
      if (aNull && !bNull) return 1;
      if (bNull && !aNull) return -1;
      if (typeof va === 'string' && typeof vb === 'string') return va.localeCompare(vb) * dir;
      return ((va as number) - (vb as number)) * dir;
    });
  }, [rows, sortKey, sortDir]);

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

  const sortButtonProps = { sortKey, sortDir, onToggle: toggleSort };

  return (
    <div className="space-y-4 sm:space-y-6">
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <CardTitle className="text-base sm:text-lg">2024 New-Grad Leaderboard</CardTitle>
              <CardDescription>
                What 2024 new-grad offers are actually worth today — 4-year grants marked to live market
                prices{asOfDate ? ` as of ${asOfDate}` : ''}.
              </CardDescription>
            </div>
            <span
              title={`Leaderboard dataset ${DATASET_VERSION}, last verified ${LAST_VERIFIED}`}
              className="inline-flex items-center gap-1 rounded-full border border-border/70 bg-muted/40 px-2.5 py-0.5 text-xs font-medium text-muted-foreground"
            >
              <Database className="size-3" />
              {DATASET_VERSION} · verified {LAST_VERIFIED}
            </span>
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
                    <SortButton label="Company" k="company" {...sortButtonProps} />
                  </TableHead>
                  <TableHead>Level</TableHead>
                  <TableHead className="text-right">
                    <SortButton label="2024 offer TC at grant" k="tc" align="right" {...sortButtonProps} />
                  </TableHead>
                  <TableHead className="text-right">
                    <SortButton label="Stock since grant" k="growth" align="right" {...sortButtonProps} />
                  </TableHead>
                  <TableHead className="text-right">
                    <SortButton label="Realized 4yr value today" k="realized" align="right" {...sortButtonProps} />
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sorted.map((r) => (
                  <TableRow key={r.entry.company}>
                    <TableCell className="font-semibold tabular-nums">
                      {r.rank ?? <span className="text-muted-foreground">—</span>}
                    </TableCell>
                    <TableCell>
                      <div className="font-medium">{r.entry.company}</div>
                      {r.entry.confidence === 'estimate' && (
                        <div className="text-xs text-muted-foreground">estimate</div>
                      )}
                      {r.entry.ticker === null && (
                        <div className="text-xs text-muted-foreground">private</div>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{r.entry.levelLabel}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatCurrency(r.tcAtGrant)}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {r.entry.ticker === null ? (
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
                      {r.entry.ticker === null ? (
                        <span className="text-xs font-normal text-muted-foreground">n/a (private)</span>
                      ) : r.priceFailed ? (
                        <span className="text-xs font-normal text-muted-foreground">price unavailable</span>
                      ) : r.realized !== null ? (
                        formatCurrency(r.realized)
                      ) : (
                        <span className="text-xs font-normal text-muted-foreground">—</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
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
          <CardTitle className="flex items-center gap-2 text-sm">
            <Info className="size-4" /> Methodology — read before citing
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-xs leading-relaxed text-muted-foreground">
          <p>
            <strong className="text-foreground">What this is.</strong> 2024 new-grad software-engineer
            offers at 12 companies, ranked by realized 4-year value: base × 4 + signing + the 4-year
            stock grant marked from its grant-date price to today’s price. Grant date is assumed to be{' '}
            {GRANT_DATE_ASSUMPTION} for every entry (disclosed canonical assumption); the price anchor
            is the nearest monthly close.
          </p>
          <p>
            <strong className="text-foreground">Where the numbers come from.</strong> Eleven entries are
            midpoints of ranges across 47 real 2024–2025 new-grad offer letters collected in March 2026
            (source linked per entry in the dataset file). Ranges are disclosed in each entry’s method —
            the midpoints are not exact offers. The Nvidia row is an <em>estimate</em> backed out from a
            published benchmark, not a collected offer, and is labeled as such.
          </p>
          <p>
            <strong className="text-foreground">What it ignores.</strong> Self-reported data with small
            samples (every entry is &lt;10 offers). Pre-tax. Vesting schedules (e.g. Amazon’s 5/15/40/40
            back-load, Nvidia’s 40/30/20/10 front-load), refreshers, bonuses after year 1, and taxes are
            not modeled. Signing bonuses are counted in full in the at-grant TC even when paid over two
            years. Private-company equity (Stripe, Databricks) is illiquid paper — shown as n/a, not zero.
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
