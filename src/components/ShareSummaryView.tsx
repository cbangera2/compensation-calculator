'use client';

import { useEffect, useMemo } from 'react';
import { ArrowRight, Download, ShieldCheck, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { TOffer } from '@/models/types';
import {
  compaRatio,
  findCell,
  percentileForValue,
} from '@/core/benchmarks';
import {
  BENCHMARK_COMPANIES,
  BENCHMARK_LEVELS,
  COMPANY_LEVEL_MAP,
  type TBenchmarkLevel,
  type TBenchmarkMetro,
} from '@/data/benchmarks.v2';
import {
  annualizeGrantValue,
  impliedSharePrice,
  optionNetValue,
  rsuValue,
} from '@/core/startup';
import { compColors } from '@/lib/chartTheme';
import { useDarkMode } from '@/lib/useDarkMode';

// ---------------------------------------------------------------------------
// Annualized "total rewards" math for the statement view.
//
// Shared offers carry quarter-rounded dates ("2025-Q2") in v2 payloads, so
// the full computeOffer() path (which parses dates) is deliberately avoided
// here. Instead we annualize each component with transparent, static math:
// base + expected bonus + annualized equity + annual perks. One-time cash
// (signing / relocation) is reported separately, not folded into the headline.
// ---------------------------------------------------------------------------

export type AnnualizedComponents = {
  base: number;
  bonus: number;
  equity: number;
  perks: number;
  oneTime: number;
  total: number;
};

type GrantLike = TOffer['equityGrants'][number];

function vestYearsOf(vesting: GrantLike['vesting']): number {
  if (!vesting) return 4;
  if (vesting.model === 'standard') return Math.max(1, vesting.years || 4);
  if (vesting.model === 'milestone') {
    const months = vesting.steps.map((s) => s.monthsFromStart ?? 0);
    const maxMonths = months.length > 0 ? Math.max(...months) : 0;
    return Math.max(1, Math.round(maxMonths / 12) || 4);
  }
  return 4; // explicit tranches: term unknown, assume a 4-year grant
}

function annualizedPublicGrant(grant: GrantLike): number {
  let totalValue = 0;
  if (grant.targetValue != null && grant.targetValue > 0) {
    // targetMode 'year1' means the target is already a first-year value.
    if (grant.targetMode === 'year1') return Math.max(0, grant.targetValue);
    totalValue = grant.targetValue;
  } else {
    const price = grant.fmv ?? 0;
    if (grant.type === 'RSU') {
      totalValue = Math.max(0, grant.shares) * Math.max(0, price);
    } else {
      totalValue = Math.max(0, grant.shares) * Math.max(0, price - (grant.strike ?? 0));
    }
  }
  return annualizeGrantValue(totalValue, vestYearsOf(grant.vesting));
}

export function annualizeOffer(offer: TOffer): AnnualizedComponents {
  const base = Math.max(0, offer.base?.startAnnual ?? 0);

  let bonus = 0;
  const pb = offer.performanceBonus;
  if (pb) {
    const payout = pb.expectedPayout ?? 1;
    bonus = pb.kind === 'percent' ? base * pb.value * payout : pb.value * payout;
  }
  bonus = Math.max(0, bonus);

  const oneTime =
    (offer.signingBonuses ?? []).reduce((s, b) => s + Math.max(0, b.amount), 0) +
    (offer.relocationBonuses ?? []).reduce((s, b) => s + Math.max(0, b.amount), 0);

  const perks =
    (offer.benefits ?? [])
      .filter((b) => b.enabled)
      .reduce((s, b) => s + Math.max(0, b.annualValue), 0) +
    (offer.miscRecurring ?? []).reduce((s, m) => s + Math.max(0, m.annualValue), 0);

  let equity = 0;
  for (const grant of offer.equityGrants ?? []) equity += annualizedPublicGrant(grant);

  const se = offer.startupEquity;
  if (se?.enabled) {
    const price = impliedSharePrice(se.valuation ?? 0, se.fullyDilutedShares ?? 0);
    for (const og of se.optionGrants ?? []) {
      equity += annualizeGrantValue(optionNetValue(og.quantity, og.strike, price), Math.max(1, og.vestYears || 4));
    }
    for (const rg of se.rsuGrants ?? []) {
      equity += annualizeGrantValue(rsuValue(rg.shares, price), Math.max(1, rg.vestYears || 4));
    }
  }

  const total = base + bonus + equity + perks;
  return { base, bonus, equity, perks, oneTime, total };
}

// ---------------------------------------------------------------------------
// Benchmark context: only when the shared offer names a real benchmark
// company. Anonymized payloads ("Company A") never match and are omitted
// silently. Level is inferred by closest base-salary p50 and labeled as
// approximate — never presented as a known fact.
// ---------------------------------------------------------------------------

type BenchmarkContext = {
  company: string;
  companyLevel: string;
  level: TBenchmarkLevel;
  metro: TBenchmarkMetro;
  percentile: number;
  compa: number;
  rolledUp: boolean;
};

function metroForLocation(location: string | undefined): TBenchmarkMetro {
  const h = (location ?? '').toLowerCase();
  if (/san francisco|sunnyvale|san jose|mountain view|palo alto|bay area|silicon valley|santa clara|oakland|berkeley|santa monica/.test(h))
    return 'Bay Area';
  if (/new york|nyc|manhattan|brooklyn|queens|jersey city/.test(h)) return 'NYC';
  if (/seattle|bellevue|redmond|kirkland/.test(h)) return 'Seattle';
  if (/austin|round rock/.test(h)) return 'Austin';
  if (/detroit|ann arbor|dearborn|troy/.test(h)) return 'Detroit/Ann Arbor';
  if (/washington|arlington|alexandria|mclean|bethesda|district of columbia|\bdc\b/.test(h)) return 'DC';
  return 'Bay Area'; // findCell rolls up across metros anyway
}

function benchmarkContextFor(offer: TOffer, annualized: AnnualizedComponents): BenchmarkContext | null {
  const name = (offer.name ?? '').trim().toLowerCase();
  if (!name) return null;
  const company = BENCHMARK_COMPANIES.find((c) => c.toLowerCase() === name);
  if (!company) return null;

  const metro = metroForLocation(offer.location);

  // Infer level by closest base-salary p50 across levels for this company.
  let level: TBenchmarkLevel | null = null;
  let bestDist = Infinity;
  for (const candidate of BENCHMARK_LEVELS) {
    const lookup = findCell(company, candidate, metro);
    if (!lookup) continue;
    const dist = Math.abs(lookup.cell.base.p50 - annualized.base);
    if (dist < bestDist) {
      bestDist = dist;
      level = candidate;
    }
  }
  if (!level) return null;

  const lookup = findCell(company, level, metro);
  if (!lookup) return null;
  const percentile = percentileForValue(lookup.cell.totalComp, annualized.total);
  if (!Number.isFinite(percentile) || percentile <= 0) return null;

  return {
    company,
    companyLevel: COMPANY_LEVEL_MAP[company]?.[level] ?? level,
    level,
    metro: lookup.cell.metro,
    percentile,
    compa: compaRatio(annualized.total, lookup.cell.totalComp.p50),
    rolledUp: lookup.rolledUpFrom !== null,
  };
}

// ---------------------------------------------------------------------------
// Formatting helpers (no Date parsing — shared dates may be "2025-Q2").
// ---------------------------------------------------------------------------

const usd0 = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
});

function usdCompact(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 1_000_000) return `$${(value / 1_000_000).toFixed(abs >= 10_000_000 ? 0 : 1)}M`;
  if (abs >= 1_000) return `$${Math.round(value / 1_000)}k`;
  return usd0.format(Math.round(value));
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "2025-Q2" -> "Q2 2025"; "2025-06-01" -> "Jun 2025"; anything else as-is. */
function formatStartDate(dateStr: string | undefined): string {
  if (!dateStr) return 'No start date';
  const quarter = /^(\d{4})-Q([1-4])$/.exec(dateStr);
  if (quarter) return `Q${quarter[2]} ${quarter[1]}`;
  const iso = /^(\d{4})-(\d{2})/.exec(dateStr);
  if (iso) {
    const month = Math.max(1, Math.min(12, parseInt(iso[2], 10)));
    return `${MONTHS[month - 1]} ${iso[1]}`;
  }
  return dateStr;
}

// ---------------------------------------------------------------------------
// Statement card for one shared offer.
// ---------------------------------------------------------------------------

function ComponentBars({ parts, dark }: { parts: AnnualizedComponents; dark: boolean }) {
  const colors = compColors(dark);
  const segments = [
    { key: 'base', label: 'Base', value: parts.base, color: colors.Base },
    { key: 'bonus', label: 'Bonus', value: parts.bonus, color: colors.Bonus },
    { key: 'equity', label: 'Equity', value: parts.equity, color: colors.Stock },
    { key: 'perks', label: 'Perks', value: parts.perks, color: colors.Other },
  ] as const;
  const total = parts.total;

  return (
    <div>
      <div
        className="flex h-3 w-full overflow-hidden rounded-full bg-muted"
        role="img"
        aria-label={`Pay mix: base ${usd0.format(parts.base)}, bonus ${usd0.format(parts.bonus)}, equity ${usd0.format(parts.equity)}, perks ${usd0.format(parts.perks)}`}
      >
        {segments.map((s) =>
          s.value > 0 && total > 0 ? (
            <div key={s.key} style={{ width: `${(s.value / total) * 100}%`, backgroundColor: s.color }} />
          ) : null
        )}
      </div>
      <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2">
        {segments.map((s) => (
          <div key={s.key} className="flex min-w-0 items-center gap-2">
            <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: s.color }} aria-hidden />
            <dt className="shrink-0 text-xs text-muted-foreground">{s.label}</dt>
            <dd className="ml-auto truncate text-sm font-semibold tabular-nums">{usdCompact(s.value)}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function BenchmarkStrip({ ctx }: { ctx: BenchmarkContext }) {
  const pct = Math.max(1, Math.min(99, ctx.percentile));
  return (
    <div className="rounded-xl bg-muted/40 px-3 py-2.5">
      <div className="flex items-baseline justify-between gap-2">
        <p className="min-w-0 truncate text-xs font-medium">
          vs {ctx.company} {ctx.companyLevel}
          <span className="font-normal text-muted-foreground"> · {ctx.metro} band</span>
        </p>
        <p className="shrink-0 text-sm font-bold tabular-nums">p{pct}</p>
      </div>
      <div className="relative mt-2 h-1.5 rounded-full bg-muted" aria-hidden>
        <div
          className="absolute top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-background bg-foreground shadow"
          style={{ left: `${pct}%` }}
        />
      </div>
      <p className="mt-1.5 text-[11px] leading-snug text-muted-foreground">
        About the {pct}th percentile of the public band · {ctx.compa.toFixed(2)}× the median. Level matched by
        closest base salary — approximate.
      </p>
    </div>
  );
}

function OfferStatementCard({ offer, anon }: { offer: TOffer; anon: boolean }) {
  const dark = useDarkMode();
  const parts = useMemo(() => annualizeOffer(offer), [offer]);
  const bench = useMemo(() => benchmarkContextFor(offer, parts), [offer, parts]);

  return (
    <Card className="overflow-hidden">
      <CardContent className="space-y-4 p-4 sm:p-5">
        <div className="min-w-0">
          <h2 className="truncate text-lg font-semibold tracking-tight">{offer.name || 'Untitled offer'}</h2>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">
            {[offer.location ?? (anon ? 'Metro withheld' : 'No location'), `starts ${formatStartDate(offer.startDate)}`]
              .filter(Boolean)
              .join(' · ')}
          </p>
        </div>

        <div>
          <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
            Annualized total comp
          </p>
          <p className="mt-1 text-4xl font-bold tracking-tight tabular-nums sm:text-5xl">
            {usd0.format(Math.round(parts.total))}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">base + bonus + equity + perks per year</p>
        </div>

        <ComponentBars parts={parts} dark={dark} />

        {parts.oneTime > 0 && (
          <p className="text-xs text-muted-foreground">
            <span className="font-medium text-foreground">+ {usd0.format(Math.round(parts.oneTime))}</span>{' '}
            one-time cash (signing{offer.relocationBonuses?.length ? ' + relocation' : ''})
          </p>
        )}

        {bench && <BenchmarkStrip ctx={bench} />}
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Full-screen read-only share view. Rendered INSTEAD of the editor while a
// ?share= token is staged. Never touches the user's local offers.
// ---------------------------------------------------------------------------

export type ShareSummaryViewProps = {
  offers: TOffer[];
  anon: boolean;
  onImport: () => void;
  onStartFresh: () => void;
};

export default function ShareSummaryView({ offers, anon, onImport, onStartFresh }: ShareSummaryViewProps) {
  // Lock background scroll and allow Escape to dismiss while the takeover is up.
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onStartFresh();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
    };
  }, [onStartFresh]);

  const count = offers.length;

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto bg-background"
      role="dialog"
      aria-modal="true"
      aria-label="Shared compensation summary"
    >
      <div className="mx-auto w-full max-w-xl px-4 pb-12 pt-6 sm:pt-10">
        <header className="mb-5 flex items-start gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10">
            <ArrowRight className="size-5 text-primary" aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-semibold tracking-tight">Shared compensation</h1>
              {anon && (
                <span className="inline-flex items-center gap-1 rounded-full border border-border bg-muted/60 px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                  <ShieldCheck className="size-3" aria-hidden />
                  anonymized
                </span>
              )}
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              Someone shared {count} {anon ? 'anonymized ' : ''}offer{count === 1 ? '' : 's'} with you.{' '}
              {anon
                ? 'Names are aliases, locations are metro-only, and numbers are rounded.'
                : 'This is a read-only preview.'}{' '}
              Your offers are untouched.
            </p>
          </div>
        </header>

        <div className="space-y-4">
          {offers.map((offer, i) => (
            <OfferStatementCard key={i} offer={offer} anon={anon} />
          ))}
        </div>

        <div className="mt-6 grid gap-2.5 sm:grid-cols-2">
          <Button type="button" onClick={onImport} className="h-12 gap-2 text-[15px] sm:h-11 sm:text-sm">
            <Download className="size-4" aria-hidden />
            Open in editor
            <span className="font-normal opacity-70">(imports a copy)</span>
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={onStartFresh}
            className="h-12 gap-2 text-[15px] sm:h-11 sm:text-sm"
          >
            <Sparkles className="size-4" aria-hidden />
            Make your own
          </Button>
        </div>

        <p className="mt-4 text-center text-xs leading-relaxed text-muted-foreground">
          Read-only preview — nothing is imported until you choose. Anyone with this link can read it; it cannot
          be revoked.
        </p>
      </div>
    </div>
  );
}
