"use client";

import { useEffect, useMemo, useState } from 'react';
import { useStore } from '@/state/store';
import {
  addYearsToIso,
  compareScenarios,
  summarizeScenario,
  type TrajectoryScenario,
} from '@/core/raisePlanner';
import type { TOffer } from '@/models/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { formatCurrency } from '@/lib/utils';
import { Plus, TrendingUp, X, Info } from 'lucide-react';
import MobileCollapse from '@/components/MobileCollapse';
import { useIsMobile } from '@/lib/useIsMobile';

export type RaisePlannerPanelProps = {
  initialScenarios?: TrajectoryScenario[];
  initialHorizonYears?: number;
};

const MAX_SCENARIOS = 3;
const CHART_COLORS = ['#3b82f6', '#10b981', '#f59e0b'];

const DEFAULT_SCENARIOS: TrajectoryScenario[] = [
  { name: 'Steady 4%', annualRaisePct: 0.04, refreshGrantAnnual: 0 },
  { name: 'Strong 8%', annualRaisePct: 0.08, refreshGrantAnnual: 20000 },
];

const fmt = (n: number) => formatCurrency(Math.round(n));

function pctToStr(p: number) {
  return String(Math.round(p * 10000) / 100);
}

function strToPct(s: string) {
  const n = Number(s);
  return Number.isFinite(n) ? n / 100 : 0;
}

function TrajectoryChart({ data }: { data: ReturnType<typeof compareScenarios> }) {
  const isMobile = useIsMobile();
  const W = 720;
  const H = isMobile ? 200 : 260;
  const PAD = { l: 56, r: 16, t: 16, b: 30 };
  const all = data.series.flatMap((s) => s.totals);
  const max = Math.max(1, ...all);
  const lo = Math.min(0, ...all);
  const span = max - lo || 1;
  const innerW = W - PAD.l - PAD.r;
  const innerH = H - PAD.t - PAD.b;
  const x = (i: number) =>
    PAD.l + (data.years.length <= 1 ? innerW / 2 : (i / (data.years.length - 1)) * innerW);
  const y = (v: number) => PAD.t + innerH - ((v - lo) / span) * innerH;
  const yTicks = 4;
  return (
    <div className="w-full overflow-x-auto">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full min-w-0 sm:min-w-[520px]" role="img" aria-label="Total comp trajectory per scenario">
        {Array.from({ length: yTicks + 1 }, (_, t) => {
          const v = lo + (span * t) / yTicks;
          return (
            <g key={t}>
              <line x1={PAD.l} x2={W - PAD.r} y1={y(v)} y2={y(v)} className="stroke-border/60" strokeDasharray="3 4" />
              <text x={PAD.l - 8} y={y(v) + 4} textAnchor="end" className="fill-muted-foreground text-[10px]">
                {fmt(v)}
              </text>
            </g>
          );
        })}
        {data.years.map((yr, i) => (
          <text key={yr} x={x(i)} y={H - 8} textAnchor="middle" className="fill-muted-foreground text-[11px]">
            Y{yr}
          </text>
        ))}
        {data.series.map((s, si) => {
          const pts = s.totals.map((v, i) => `${x(i)},${y(v)}`).join(' ');
          return (
            <g key={s.name}>
              <polyline points={pts} fill="none" stroke={CHART_COLORS[si % CHART_COLORS.length]} strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
              {s.totals.map((v, i) => (
                <circle key={i} cx={x(i)} cy={y(v)} r={3.5} fill={CHART_COLORS[si % CHART_COLORS.length]}>
                  <title>{`${s.name} Y${data.years[i]}: ${fmt(v)}`}</title>
                </circle>
              ))}
            </g>
          );
        })}
      </svg>
      <div className="mt-2 flex flex-wrap gap-4">
        {data.series.map((s, si) => (
          <span key={s.name} className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className="inline-block size-2.5 rounded-full" style={{ background: CHART_COLORS[si % CHART_COLORS.length] }} />
            {s.name}
          </span>
        ))}
      </div>
    </div>
  );
}

function ScenarioEditorFields({
  scenario,
  onChange,
  onRemove,
  canRemove,
}: {
  scenario: TrajectoryScenario;
  onChange: (s: TrajectoryScenario) => void;
  onRemove: () => void;
  canRemove: boolean;
}) {
  const set = (patch: Partial<TrajectoryScenario>) => onChange({ ...scenario, ...patch });
  return (
    <>
      <div className="flex items-center justify-between gap-2">
        <Input
          value={scenario.name}
          onChange={(e) => set({ name: e.target.value })}
          className="h-8 max-w-[160px] text-sm font-semibold"
          aria-label="Scenario name"
        />
        {canRemove && (
          <Button variant="ghost" size="icon" className="size-7" onClick={onRemove} aria-label={`Remove ${scenario.name}`}>
            <X className="size-3.5" />
          </Button>
        )}
      </div>
      <div className="mt-3 grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs">Annual raise %</Label>
          <Input
            type="number"
            min={-100}
            max={500}
            step={0.5}
            value={pctToStr(scenario.annualRaisePct)}
            onChange={(e) => set({ annualRaisePct: strToPct(e.target.value) })}
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Refresh grant $/yr</Label>
          <Input
            type="number"
            min={0}
            step={1000}
            value={Math.round(scenario.refreshGrantAnnual)}
            onChange={(e) => set({ refreshGrantAnnual: Math.max(0, Number(e.target.value) || 0) })}
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Promo year (optional)</Label>
          <Input
            type="number"
            min={1}
            placeholder="—"
            value={scenario.promoYear ?? ''}
            onChange={(e) =>
              set({ promoYear: e.target.value === '' ? undefined : Math.max(1, Math.round(Number(e.target.value) || 1)) })
            }
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Promo bump %</Label>
          <Input
            type="number"
            min={0}
            max={500}
            step={1}
            placeholder="—"
            value={scenario.promoBumpPct != null ? pctToStr(scenario.promoBumpPct) : ''}
            onChange={(e) =>
              set({ promoBumpPct: e.target.value === '' ? undefined : strToPct(e.target.value) })
            }
          />
        </div>
      </div>
    </>
  );
}

export default function RaisePlannerPanel({
  initialScenarios,
  initialHorizonYears = 5,
}: RaisePlannerPanelProps = {}) {
  const { offer, setOffer } = useStore();
  const [scenarios, setScenarios] = useState<TrajectoryScenario[]>(
    initialScenarios && initialScenarios.length ? initialScenarios : DEFAULT_SCENARIOS,
  );
  const [horizon, setHorizon] = useState(initialHorizonYears);
  const [tableScenario, setTableScenario] = useState(0);
  const [saveFlash, setSaveFlash] = useState<string | null>(null);

  useEffect(() => {
    if (!saveFlash) return;
    const t = setTimeout(() => setSaveFlash(null), 2500);
    return () => clearTimeout(t);
  }, [saveFlash]);

  const comparison = useMemo(() => {
    try {
      return compareScenarios(offer, scenarios, horizon);
    } catch {
      return null;
    }
  }, [offer, scenarios, horizon]);

  const summaries = useMemo(() => {
    if (!comparison) return [];
    return comparison.series.map((s, i) => ({
      name: s.name,
      text: summarizeScenario({ scenario: scenarios[i], rows: s.rows }),
      color: CHART_COLORS[i % CHART_COLORS.length],
    }));
  }, [comparison, scenarios]);

  const safeIndex = comparison ? Math.min(tableScenario, comparison.series.length - 1) : 0;

  const addScenario = () => {
    if (scenarios.length >= MAX_SCENARIOS) return;
    setScenarios([...scenarios, { name: `Scenario ${scenarios.length + 1}`, annualRaisePct: 0.05, refreshGrantAnnual: 0 }]);
  };

  // Rebuild the raise schedule projectTrajectory derives from a scenario, so it
  // can be written back onto the offer. Mirrors the raise construction there.
  const buildScenarioRaises = (scenario: TrajectoryScenario): TOffer['raises'] => {
    const raises: TOffer['raises'] = [];
    for (let y = 2; y <= horizon; y++) {
      if (scenario.annualRaisePct !== 0) {
        raises.push({
          effectiveDate: addYearsToIso(offer.startDate, y - 1),
          type: 'percent',
          value: scenario.annualRaisePct,
        });
      }
    }
    const promoYear = scenario.promoYear ?? 0;
    const promoBump = scenario.promoBumpPct ?? 0;
    if (promoYear >= 1 && promoYear <= horizon && promoBump !== 0) {
      raises.push({
        effectiveDate: addYearsToIso(offer.startDate, promoYear - 1),
        type: 'percent',
        value: promoBump,
      });
    }
    return raises;
  };

  const saveScenarioToOffer = () => {
    const scenario = scenarios[safeIndex];
    if (!scenario) return;
    const raises = buildScenarioRaises(scenario);
    if (raises.length === 0) {
      setSaveFlash('No raises in this scenario — nothing to save');
      return;
    }
    setOffer({ ...offer, raises });
    setSaveFlash(`Saved ✓ ${raises.length} raises to offer`);
  };

  const clearOfferRaises = () => {
    setOffer({ ...offer, raises: [] });
    setSaveFlash('Cleared raises from offer');
  };

  const offerRaiseCount = offer.raises?.length ?? 0;

  return (
    <div className="space-y-4 sm:space-y-5">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
            <TrendingUp className="size-4" /> Raise planner
          </CardTitle>
          <CardDescription>
            Project {offer.name}&rsquo;s total comp over the next {horizon} years under up to {MAX_SCENARIOS} scenarios.
            These are projections from your inputs, not predictions.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-2.5 sm:grid-cols-2 sm:gap-3 lg:grid-cols-3">
            {scenarios.map((s, i) => (
              <MobileCollapse
                key={i}
                variant="plain"
                title={s.name}
                description={`${pctToStr(s.annualRaisePct)}%/yr${s.refreshGrantAnnual ? ` · ${fmt(s.refreshGrantAnnual)}/yr refresh` : ''}`}
                className="rounded-xl border border-border/70 bg-background/60"
                desktopClassName="rounded-xl border border-border/70 bg-background/60 p-4"
              >
                <ScenarioEditorFields
                  scenario={s}
                  onChange={(next) => setScenarios(scenarios.map((cur, j) => (j === i ? next : cur)))}
                  onRemove={() => {
                    const next = scenarios.filter((_, j) => j !== i);
                    setScenarios(next);
                    setTableScenario(0);
                  }}
                  canRemove={scenarios.length > 1}
                />
              </MobileCollapse>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {scenarios.length < MAX_SCENARIOS && (
              <Button variant="outline" size="sm" onClick={addScenario}>
                <Plus className="size-3.5" /> Add scenario
              </Button>
            )}
            <div className="flex items-center gap-2">
              <Label className="text-xs text-muted-foreground" htmlFor="rp-horizon">Horizon</Label>
              <Select value={String(horizon)} onValueChange={(v) => setHorizon(Number(v))}>
                <SelectTrigger id="rp-horizon" className="h-8 w-28">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[3, 4, 5, 6, 8, 10].map((n) => (
                    <SelectItem key={n} value={String(n)}>
                      {n} years
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {comparison && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-semibold">Trajectory</CardTitle>
            <CardDescription>Year-by-year total comp per scenario.</CardDescription>
          </CardHeader>
          <CardContent>
            <TrajectoryChart data={comparison} />
            <div className="mt-4 space-y-2">
              {summaries.map((s) => (
                <p key={s.name} className="flex items-start gap-2 text-sm">
                  <span className="mt-1.5 inline-block size-2.5 shrink-0 rounded-full" style={{ background: s.color }} />
                  <span><span className="font-semibold">{s.name}:</span> {s.text}</span>
                </p>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {comparison && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-semibold">Year-by-year breakdown</CardTitle>
            <CardDescription>Components of total comp for the selected scenario.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <Select value={String(safeIndex)} onValueChange={(v) => setTableScenario(Number(v))}>
                <SelectTrigger className="h-8 w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {comparison.series.map((s, i) => (
                    <SelectItem key={s.name} value={String(i)}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button variant="outline" size="sm" onClick={saveScenarioToOffer}>
                Save scenario to offer
              </Button>
              {offerRaiseCount > 0 && (
                <Button variant="ghost" size="sm" onClick={clearOfferRaises}>
                  Clear raises from offer ({offerRaiseCount})
                </Button>
              )}
            </div>
            {saveFlash && (
              <p className="mb-3 text-xs font-medium text-emerald-600 dark:text-emerald-400" aria-live="polite">
                {saveFlash}
              </p>
            )}
            <p className="mb-3 text-xs text-muted-foreground">
              Saving writes this scenario&rsquo;s raises into your offer (replacing any existing raises),
              so the Calculator reflects it. Refresh grants are projections only and are not saved.
            </p>
            <div className="overflow-x-auto rounded-xl border border-border/60">
              <table className="w-full min-w-[560px] text-xs sm:min-w-[640px] sm:text-sm">
                <thead>
                  <tr className="border-b border-border/60 bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="px-2 py-1.5 sm:px-3 sm:py-2">Year</th>
                    <th className="px-2 py-1.5 text-right sm:px-3 sm:py-2">Base</th>
                    <th className="px-2 py-1.5 text-right sm:px-3 sm:py-2">Bonus</th>
                    <th className="px-2 py-1.5 text-right sm:px-3 sm:py-2">Stock (existing)</th>
                    <th className="px-2 py-1.5 text-right sm:px-3 sm:py-2">Refresh</th>
                    <th className="px-2 py-1.5 text-right sm:px-3 sm:py-2">Other</th>
                    <th className="px-2 py-1.5 text-right sm:px-3 sm:py-2">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {comparison.series[safeIndex].rows.map((r) => (
                    <tr key={r.year} className="border-b border-border/40 last:border-0">
                      <td className="px-2 py-1.5 font-medium sm:px-3 sm:py-2">Y{r.year}</td>
                      <td className="px-2 py-1.5 text-right tabular-nums sm:px-3 sm:py-2">{fmt(r.base)}</td>
                      <td className="px-2 py-1.5 text-right tabular-nums sm:px-3 sm:py-2">{fmt(r.bonus)}</td>
                      <td className="px-2 py-1.5 text-right tabular-nums sm:px-3 sm:py-2">{fmt(r.stock)}</td>
                      <td className="px-2 py-1.5 text-right tabular-nums sm:px-3 sm:py-2">{fmt(r.refresh)}</td>
                      <td className="px-2 py-1.5 text-right tabular-nums sm:px-3 sm:py-2">{fmt(r.other)}</td>
                      <td className="px-2 py-1.5 text-right font-semibold tabular-nums sm:px-3 sm:py-2">{fmt(r.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      <MobileCollapse
        variant="plain"
        title="Assumptions"
        description="How these projections are computed"
        className="text-xs text-muted-foreground"
        desktopClassName="flex items-start gap-2 rounded-xl border border-border/60 bg-muted/30 p-3 text-xs text-muted-foreground"
        contentClassName="flex items-start gap-2"
      >
        <Info className="mt-0.5 size-3.5 shrink-0" />
        <p>
          Scenario raises replace any raises in your offer model (no double-counting).
          Existing equity follows the real vest schedule and drops to zero when grants finish vesting.
          Refresh grants vest evenly over 4 years with no stock-price growth assumed. Projection only, not financial advice.
        </p>
      </MobileCollapse>
    </div>
  );
}
