"use client";

import { useEffect, useMemo, useState } from 'react';
import { useStore } from '@/state/store';
import { computeOffer } from '@/core/compute';
import {
  findCell,
  percentileForValue,
  compaRatio,
  rangePenetration,
  benchmarkCompanies,
  benchmarkLevels,
  benchmarkMetros,
  companyLevelLabel,
  bandPositionLabel,
  datasetVersion,
  cellAgeDays,
  isCellStale,
} from '@/core/benchmarks';
import {
  BENCHMARK_COMPANIES,
  BENCHMARK_LEVELS,
  freshnessLabel,
  type TBenchmarkCell,
  type TBenchmarkLevel,
  type TBenchmarkMetro,
  type TPercentileBands,
} from '@/data/benchmarks.v2';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Offer, type TOffer } from '@/models/types';
import LevelMappingTable from '@/components/LevelMappingTable';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { formatCurrency } from '@/lib/utils';
import { cn } from '@/lib/utils';
import { AlertTriangle, Database, Info, History, Plus } from 'lucide-react';
import EmptyState from '@/components/EmptyState';
import MobileCollapse from '@/components/MobileCollapse';

export type BenchmarkPanelProps = {
  initialCompany?: string;
  initialLevel?: TBenchmarkLevel;
  initialMetro?: TBenchmarkMetro;
};

/** Small muted pill naming the dataset version + last verification date. */
function DatasetBadge() {
  const { version, lastVerified } = datasetVersion();
  const short = version.startsWith('v') ? version.split('.')[0] : version;
  return (
    <span
      title={`Benchmark dataset ${version}, last verified ${lastVerified}`}
      className="inline-flex items-center gap-1 rounded-full border border-border/70 bg-muted/40 px-2.5 py-0.5 text-xs font-medium text-muted-foreground"
    >
      <Database className="size-3" />
      dataset {short} · verified {lastVerified}
    </span>
  );
}

function ConfidenceBadge({ cell }: { cell: TBenchmarkCell }) {
  if (cell.confidence === 'illustrative') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/40 bg-amber-500/10 px-2.5 py-0.5 text-xs font-semibold text-amber-600 dark:text-amber-400">
        <AlertTriangle className="size-3" />
        Illustrative
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2.5 py-0.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
      <Database className="size-3" />
      Sourced
    </span>
  );
}

function BandChart({
  bands,
  value,
  valueLabel,
}: {
  bands: TPercentileBands;
  value: number;
  valueLabel: string;
}) {
  const lo = Math.min(bands.p25 * 0.85, value * 0.98);
  const hi = Math.max(bands.p90 * 1.1, value * 1.02);
  const span = Math.max(hi - lo, 1);
  const pct = (v: number) => Math.min(100, Math.max(0, ((v - lo) / span) * 100));

  const left = pct(bands.p25);
  const width = Math.max(pct(bands.p90) - left, 1);
  const markerLeft = pct(value);

  return (
    <div>
      <div className="relative h-12 sm:h-16">
        {/* band region p25..p90 */}
        <div
          className="absolute top-5 h-6 rounded-full bg-gradient-to-r from-emerald-200 via-emerald-300 to-emerald-400 dark:from-emerald-900 dark:via-emerald-800 dark:to-emerald-700"
          style={{ left: `${left}%`, width: `${width}%` }}
        />
        {/* quartile ticks */}
        {[bands.p50, bands.p75].map((t) => (
          <div
            key={t}
            className="absolute top-5 h-6 w-px bg-white/80 dark:bg-black/40"
            style={{ left: `${pct(t)}%` }}
          />
        ))}
        {/* user marker */}
        <div className="absolute top-0 bottom-0" style={{ left: `${markerLeft}%` }}>
          <div className="absolute -top-0.5 left-1/2 -translate-x-1/2 rounded-full bg-foreground px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap text-background shadow">
            {valueLabel}
          </div>
          <div className="absolute top-5 bottom-1 left-1/2 w-0.5 -translate-x-1/2 rounded bg-foreground" />
        </div>
      </div>
      <div className="flex items-center justify-between text-[11px] text-muted-foreground">
        <span>p25 {formatCurrency(bands.p25)}</span>
        <span className="font-medium text-foreground">p50 {formatCurrency(bands.p50)}</span>
        <span>p75 {formatCurrency(bands.p75)}</span>
        <span>p90 {formatCurrency(bands.p90)}</span>
      </div>
    </div>
  );
}

function BandSection({
  title,
  bands,
  value,
  offerName,
}: {
  title: string;
  bands: TPercentileBands;
  value: number;
  offerName: string;
}) {
  const pctile = percentileForValue(bands, value);
  const ratio = compaRatio(value, bands.p50);
  const penetration = rangePenetration(value, bands);
  const penetrationPct = Math.round(penetration * 100);
  return (
    <div className="space-y-2.5 rounded-xl border border-border/60 p-3 sm:space-y-3 sm:p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h4 className="text-sm font-semibold text-foreground">{title}</h4>
        <p className="text-xs text-muted-foreground">
          {offerName}: {formatCurrency(value)} · {bandPositionLabel(bands, value)}
        </p>
      </div>
      <BandChart bands={bands} value={value} valueLabel={formatCurrency(value)} />
      <div className="flex flex-wrap gap-x-8 gap-y-2">
        <div>
          <div className="text-xl font-bold tracking-tight text-foreground tabular-nums sm:text-2xl">p{pctile}</div>
          <div className="text-[11px] text-muted-foreground">estimated percentile in band</div>
        </div>
        <div>
          <div className="text-xl font-bold tracking-tight text-foreground tabular-nums sm:text-2xl">
            {ratio.toFixed(2)}×
          </div>
          <div className="text-[11px] text-muted-foreground">compa-ratio vs p50</div>
        </div>
        <div>
          <div className="text-xl font-bold tracking-tight text-foreground tabular-nums sm:text-2xl">
            {penetrationPct}%
          </div>
          <div className="text-[11px] text-muted-foreground">range penetration in band</div>
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        You&rsquo;re {penetrationPct}% through the band — 0% is the p25 floor, 100% is the p90 ceiling.
      </p>
    </div>
  );
}

/** Source / freshness / staleness line for the About-this-data block. */
function ProvenanceMeta({ cell }: { cell: TBenchmarkCell }) {
  const age = cellAgeDays(cell);
  const stale = isCellStale(cell);
  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-1">
      <span>
        Source: <span className="font-medium text-foreground">{cell.source}</span>
      </span>
      <span>
        Accessed: <span className="font-medium text-foreground">{cell.accessDate}</span>
      </span>
      <span>
        Sample:{' '}
        <span className="font-medium text-foreground">
          {cell.sampleBand === 'unknown' ? 'size undisclosed' : `${cell.sampleBand} submissions`}
        </span>
      </span>
      <span className="font-medium text-foreground">{freshnessLabel(age)}</span>
      {stale && (
        <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-[11px] font-semibold text-amber-700 dark:text-amber-300">
          <History className="size-3" />
          stale · needs re-verification
        </span>
      )}
    </div>
  );
}

/**
 * BenchmarkPanel — percentile-band comparison for the active offer.
 *
 * Self-contained: reads the active offer from the zustand store, renders
 * company/level/metro selectors, band visualizations with a "you are here"
 * marker, compa-ratio readouts, and full provenance labels.
 *
 * NOT wired into page.tsx — mount it wherever the shell wants it:
 *   <BenchmarkPanel />
 *   <BenchmarkPanel initialCompany="Google" initialLevel="Mid" initialMetro="NYC" />
 */
export default function BenchmarkPanel({
  initialCompany = 'Meta',
  initialLevel = 'Entry',
  initialMetro = 'Bay Area',
}: BenchmarkPanelProps) {
  const { offer, addOffer } = useStore();
  const [company, setCompany] = useState(initialCompany);
  const [level, setLevel] = useState<TBenchmarkLevel>(initialLevel);
  const [metro, setMetro] = useState<TBenchmarkMetro>(initialMetro);

  /**
   * Pre-select company/level from the active offer: case-insensitive match of
   * the offer name against the benchmark companies and of the offer's job
   * level against the benchmark level labels. Falls back to the props when
   * there is no match.
   */
  const derivedCompany = useMemo(() => {
    const name = offer?.name?.trim();
    if (name) {
      const hit = BENCHMARK_COMPANIES.find((c) => c.toLowerCase() === name.toLowerCase());
      if (hit) return hit;
    }
    return initialCompany;
  }, [offer?.name, initialCompany]);

  const derivedLevel = useMemo(() => {
    const jobLevel = offer?.jobLevel?.trim();
    if (jobLevel) {
      const hit = BENCHMARK_LEVELS.find((l) => l.toLowerCase() === jobLevel.toLowerCase());
      if (hit) return hit;
    }
    return initialLevel;
  }, [offer?.jobLevel, initialLevel]);

  // Keep the selectors in sync with the active offer so switching offers
  // re-targets the panel. User edits still win until the offer changes.
  useEffect(() => {
    setCompany(derivedCompany);
  }, [derivedCompany]);

  useEffect(() => {
    setLevel(derivedLevel);
  }, [derivedLevel]);

  useEffect(() => {
    setMetro(initialMetro);
  }, [initialMetro]);

  const { baseValue, totalValue } = useMemo(() => {
    if (!offer) return { baseValue: 0, totalValue: 0 };
    const rows = computeOffer(offer);
    return {
      baseValue: offer.base.startAnnual ?? 0,
      totalValue: rows[0]?.total ?? 0,
    };
  }, [offer]);

  const lookup = useMemo(() => findCell(company, level, metro), [company, level, metro]);
  const cell = lookup?.cell ?? null;

  /**
   * Bridge: Benchmarks → Compare. Builds a synthetic, honestly-labeled
   * illustrative offer from this cell's p50 bands (base at base.p50, the
   * remainder of totalComp.p50 as a 4-year even RSU grant) and drops it into
   * the offer list, then jumps to the Compare tab.
   */
  const addCellToCompare = () => {
    if (!cell) return;
    const today = new Date().toISOString().slice(0, 10);
    const equityTotal = Math.max(0, Math.round(cell.totalComp.p50 - cell.base.p50));
    const candidate = {
      name: `${company} ${cell.companyLevel} · ${cell.metro} (benchmark p50)`,
      startDate: today,
      location: cell.metro,
      base: { startAnnual: Math.max(0, Math.round(cell.base.p50)) },
      equityGrants:
        equityTotal > 0
          ? [
              {
                type: 'RSU' as const,
                shares: 0,
                targetValue: equityTotal,
                targetMode: 'total' as const,
                vesting: {
                  model: 'standard' as const,
                  years: 4,
                  cliffMonths: 0,
                  frequency: 'monthly' as const,
                  distribution: 'even' as const,
                  cliffPercent: 0,
                },
                grantStartDate: today,
              },
            ]
          : [],
    };
    const parsed = Offer.safeParse(candidate);
    if (!parsed.success) {
      console.warn('benchmark offer failed validation', parsed.error.flatten());
      return;
    }
    const synthetic: TOffer = parsed.data;
    addOffer(synthetic);
    window.dispatchEvent(new CustomEvent('compcalc:switch-tab', { detail: 'compare' }));
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="text-base sm:text-lg">Benchmarks</CardTitle>
            <CardDescription>
              How {offer?.name || 'your offer'} compares to public compensation bands.
            </CardDescription>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {cell && <ConfidenceBadge cell={cell} />}
            <DatasetBadge />
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 sm:space-y-6">
        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <Label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Company
            </Label>
            <Select value={company} onValueChange={setCompany}>
              <SelectTrigger className="mt-1 w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {benchmarkCompanies().map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Level
            </Label>
            <Select value={level} onValueChange={(v) => setLevel(v as TBenchmarkLevel)}>
              <SelectTrigger className="mt-1 w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {benchmarkLevels().map((l) => (
                  <SelectItem key={l} value={l}>
                    {l} ({companyLevelLabel(company, l)})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Metro
            </Label>
            <Select value={metro} onValueChange={(v) => setMetro(v as TBenchmarkMetro)}>
              <SelectTrigger className="mt-1 w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {benchmarkMetros().map((m) => (
                  <SelectItem key={m} value={m}>
                    {m}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {!cell ? (
          <EmptyState
            icon={<Info className="size-4" />}
            title="Insufficient data"
            hint={`No public benchmark for ${company} · ${level} (${companyLevelLabel(company, level)}) in ${metro} yet. v2 only ships cells with enough public observations — this combo was suppressed rather than estimated.`}
          />
        ) : (
          <>
            {lookup?.rolledUpFrom && (
              <p className="rounded-lg border border-border/60 bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
                No {metro} data for this combo — showing {lookup.rolledUpFrom} bands instead.
              </p>
            )}
            {cell.confidence === 'illustrative' && (
              <p
                className={cn(
                  'rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs',
                  'text-amber-700 dark:text-amber-300'
                )}
              >
                Illustrative estimate: no public aggregate was found for this cell in v2 research.
                Use for rough planning only, not negotiation.
              </p>
            )}

            <div className="space-y-4">
              <BandSection
                title={`Base salary — ${company} ${cell.companyLevel}`}
                bands={cell.base}
                value={baseValue}
                offerName={offer?.name || 'Your offer'}
              />
              <BandSection
                title={`Total comp — ${company} ${cell.companyLevel}`}
                bands={cell.totalComp}
                value={totalValue}
                offerName={offer?.name || 'Your offer'}
              />
            </div>

            <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border/60 bg-muted/30 p-3">
              <p className="min-w-[180px] flex-1 text-xs leading-relaxed text-muted-foreground">
                Illustrative only: adds this cell&rsquo;s p50 bands as a
                benchmark-derived offer (base + 4-yr even RSU) so you can
                compare your offers against the market.
              </p>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={addCellToCompare}
                className="shrink-0"
              >
                <Plus className="size-3.5" />
                Add to Compare
              </Button>
            </div>

            <MobileCollapse
              variant="plain"
              title="About this data"
              description={`${cell.source} · ${freshnessLabel(cellAgeDays(cell))}`}
              className="text-xs text-muted-foreground"
              desktopClassName="space-y-1.5 rounded-xl border border-border/60 bg-muted/30 p-4 text-xs text-muted-foreground"
              contentClassName="space-y-1.5"
            >
              <ProvenanceMeta cell={cell} />
              <p className="leading-relaxed">Method: {cell.method}</p>
            </MobileCollapse>
          </>
        )}

        <MobileCollapse
          title="Cross-company level mapping"
          description="How levels translate between companies"
          className="mt-2"
        >
          <LevelMappingTable />
        </MobileCollapse>
      </CardContent>
    </Card>
  );
}
