"use client";
import { useMemo, useState } from 'react';
import ReactEChartsCore from 'echarts-for-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useStore } from '@/state/store';
import { useComparedOffers } from '@/lib/useComparedOffers';
import { matchCityPresetKey } from '@/lib/col';
import { computeOffer } from '@/core/compute';
import { cn, formatCurrency, disambiguateNames } from '@/lib/utils';
import { X } from 'lucide-react';
import { useDarkMode } from '@/lib/useDarkMode';
import {
  compColors,
  tooltipStyle,
  axisStyle,
  legendStyle,
  chartAnimation,
  barItemStyle,
  currencyAxisFormatter,
} from '@/lib/chartTheme';
import { useChartHeight } from '@/lib/useIsMobile';

export default function ComparisonChart() {
  const chartH = useChartHeight(360, 260);
  const { activeIndex } = useStore();
  const compared = useComparedOffers();
  // Compare tab renders at most MAX_COMPARE_OFFERS offers; `compared` pairs
  // each with its original store index for the active-offer highlight.
  const offers = useMemo(() => compared.map((p) => p.offer), [compared]);
  const [showPurchasingPower, setShowPurchasingPower] = useState(false);
  const [ppNudgeDismissed, setPpNudgeDismissed] = useState(false);
  const [ppEverEnabled, setPpEverEnabled] = useState(false);
  const setMode = (pp: boolean) => {
    setShowPurchasingPower(pp);
    if (pp) setPpEverEnabled(true);
  };
  const dark = useDarkMode();
  const colors = useMemo(() => compColors(dark), [dark]);
  const axis = useMemo(() => axisStyle(dark), [dark]);

  const rowsPerOffer = useMemo(() => 
    (offers || []).map((o) => computeOffer(o)),
    [offers]
  );

  const displayNames = useMemo(() =>
    disambiguateNames(offers || [], (o) => o.name, (o) => o.location),
    [offers]
  );

  // Calculate purchasing power data for the summary cards
  const ppData = useMemo(() => {
    return (offers || []).map((offer, idx) => {
      const colFactor = offer.colFactor ?? 1;
      const rows = rowsPerOffer[idx] || [];
      const y1Total = rows[0]?.total ?? 0;
      const total4y = rows.reduce((a, r) => a + r.total, 0);
      const ppY1 = y1Total / colFactor;
      const pp4y = total4y / colFactor;
      return {
        name: displayNames[idx],
        location: offer.location || `${colFactor.toFixed(2)}× COL`,
        colFactor,
        nominalY1: y1Total,
        nominal4y: total4y,
        ppY1,
        pp4y,
        index: idx,
      };
    });
  }, [offers, rowsPerOffer]);

  // Sort by purchasing power for ranking
  const ranked = useMemo(() => 
    [...ppData].sort((a, b) => b.ppY1 - a.ppY1),
    [ppData]
  );

  // Nudge toward purchasing power when offers span different cost-of-living areas.
  // One-time: never auto-switches, dismissed or once-enabled it stays gone.
  const colSpread = useMemo(() => {
    const factors = (offers || []).map((o) => Math.max(o.colFactor ?? 1, 0.01));
    if (factors.length < 2) return 0;
    return Math.max(...factors) / Math.min(...factors) - 1;
  }, [offers]);
  const showNudge = colSpread > 0.05 && !showPurchasingPower && !ppNudgeDismissed && !ppEverEnabled;
  
  if (!offers || offers.length < 2) return null;

  const horizon = Math.max(...rowsPerOffer.map(r => r.length));
  const years = Array.from({ length: horizon }, (_, i) => `Y${i + 1}`);
  const fmt = (n: number) => formatCurrency(Math.round(n));
  const chartKey = `${offers.length}:${offers.map(o => o.name || '').join('|')}:${horizon}:${showPurchasingPower}`;

  // Prepare per-offer arrays for stacked series
  // If showPurchasingPower, divide values by colFactor
  const byOffer = rowsPerOffer.map((rows, i) => {
    const colFactor = offers[i]?.colFactor ?? 1;
    const divisor = showPurchasingPower ? colFactor : 1;
    return {
      base: Array.from({ length: horizon }, (_, y) => Math.round((rows[y]?.base ?? 0) / divisor)),
      bonus: Array.from({ length: horizon }, (_, y) => Math.round((rows[y]?.bonus ?? 0) / divisor)),
      stock: Array.from({ length: horizon }, (_, y) => Math.round((rows[y]?.stock ?? 0) / divisor)),
      other: Array.from({ length: horizon }, (_, y) => Math.round((rows[y]?.other ?? 0) / divisor)),
      total: Array.from({ length: horizon }, (_, y) => Math.round((rows[y]?.total ?? 0) / divisor)),
    };
  });

  const totals = byOffer.map(b => b.total.reduce((a, v) => a + v, 0));

  const maxPP = Math.max(...ppData.map(o => o.ppY1), 1);


  type LabelFormatterParam = { dataIndex: number };
  const makeTotalLabel = (offerIdx: number) => ({
    show: true,
    position: 'top' as const,
    distance: 8,
    fontSize: 11,
    fontWeight: 600,
    fontFamily: 'inherit',
    color: axis.axisLabel.color,
    formatter: (p: LabelFormatterParam) => fmt(byOffer[offerIdx].total[p.dataIndex] || 0),
  });

  const stackedSeries = offers.flatMap((o, i) => ([
    {
      id: `offer-${i}-base`,
      name: 'Base', type: 'bar' as const, stack: `offer-${i}`,
      itemStyle: { color: colors.Base, borderRadius: 0 },
      // Share the category width across offers so bars dodge instead of overlapping.
      barWidth: `${Math.max(10, Math.floor(72 / offers.length))}%`,
      barGap: '30%',
      emphasis: { focus: 'series' as const },
      data: byOffer[i].base,
    },
    {
      id: `offer-${i}-bonus`,
      name: 'Bonus', type: 'bar' as const, stack: `offer-${i}`,
      itemStyle: { color: colors.Bonus, borderRadius: 0 },
      emphasis: { focus: 'series' as const },
      data: byOffer[i].bonus,
    },
    {
      id: `offer-${i}-stock`,
      name: 'Stock', type: 'bar' as const, stack: `offer-${i}`,
      itemStyle: { color: colors.Stock, borderRadius: 0 },
      emphasis: { focus: 'series' as const },
      data: byOffer[i].stock,
    },
    {
      id: `offer-${i}-other`,
      name: 'Other', type: 'bar' as const, stack: `offer-${i}`,
      itemStyle: { color: colors.Other, ...barItemStyle },
      emphasis: { focus: 'series' as const },
      label: makeTotalLabel(i),
      data: byOffer[i].other,
    },
  ]));

  const option = {
    ...chartAnimation,
    tooltip: {
      trigger: 'axis',
      ...tooltipStyle(dark),
      formatter: (params: Array<{ seriesName: 'Base' | 'Bonus' | 'Stock' | 'Other'; value: number; axisValueLabel: string; seriesId?: string; dataIndex: number }>) => {
        const year = params[0]?.axisValueLabel ?? '';
        const dataIndex = params[0]?.dataIndex ?? 0;
        const grouped: Record<number, { base: number; bonus: number; stock: number; other: number }> = {};

        params.forEach((p) => {
          const match = /offer-(\d+)-/.exec(p.seriesId ?? '');
          const offerIdx = match ? Number(match[1]) : 0;
          const entry = grouped[offerIdx] || { base: 0, bonus: 0, stock: 0, other: 0 };
          if (p.seriesName === 'Base') entry.base = p.value ?? 0;
          if (p.seriesName === 'Bonus') entry.bonus = p.value ?? 0;
          if (p.seriesName === 'Stock') entry.stock = p.value ?? 0;
          if (p.seriesName === 'Other') entry.other = p.value ?? 0;
          grouped[offerIdx] = entry;
        });

        const lines: string[] = [`<div><strong>${year}</strong>${showPurchasingPower ? ' (Purchasing Power)' : ''}</div>`];
        Object.keys(grouped).sort((a, b) => Number(a) - Number(b)).forEach((key) => {
          const offerIdx = Number(key);
          const { base, bonus, stock, other } = grouped[offerIdx];
          const name = displayNames[offerIdx] || `Offer ${offerIdx + 1}`;
          const loc = offers[offerIdx]?.location;
          const total = byOffer[offerIdx]?.total[dataIndex] ?? base + bonus + stock + other;
          lines.push(`<div style="margin-top:4px;"><strong>${name}</strong>${loc ? ` (${loc})` : ''} — Total ${fmt(total)}</div>`);
          lines.push(`<div style="padding-left:8px;">• Base ${fmt(base)}</div>`);
          lines.push(`<div style="padding-left:8px;">• Bonus ${fmt(bonus)}</div>`);
          lines.push(`<div style="padding-left:8px;">• Stock ${fmt(stock)}</div>`);
          lines.push(`<div style="padding-left:8px;">• Other ${fmt(other)}</div>`);
        });
        return lines.join('');
      },
    },
    legend: { data: ['Base', 'Bonus', 'Stock', 'Other'], ...legendStyle(dark, { top: 0 }) },
    xAxis: { type: 'category', data: years, ...axis, splitLine: { show: false } },
    yAxis: {
      type: 'value',
      ...axis,
      axisLabel: { ...axis.axisLabel, formatter: currencyAxisFormatter },
    },
    grid: { left: 8, right: 8, top: 36, bottom: 0, containLabel: true },
    series: stackedSeries,
  } as const;

  // Check if there's an interesting insight (lower nominal but higher PP).
  // Only when both locations map to known COL presets — otherwise the "lower
  // cost of living" claim is fabricated from a default 1.0x factor (e.g. an
  // unmapped "San Francisco Bay Area" vs a mapped "San Francisco, CA").
  const hasInsight =
    ranked.length >= 2 &&
    ranked[0].nominalY1 < ranked[ranked.length - 1].nominalY1 &&
    (offers || []).every((o) => matchCityPresetKey(o.location) !== null);

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="text-base sm:text-lg">Offer Comparison</CardTitle>
            <CardDescription className="mt-1">
              {showPurchasingPower 
                ? 'Purchasing power · adjusted for cost of living'
                : 'Nominal compensation'}
            </CardDescription>
          </div>
          <div className="flex rounded-full border border-input bg-muted/40 p-0.5 text-xs font-medium" role="group" aria-label="Comparison units">
            <button
              type="button"
              onClick={() => setMode(false)}
              aria-pressed={!showPurchasingPower}
              className={cn(
                'rounded-full px-3 py-1.5 transition',
                !showPurchasingPower ? 'bg-foreground text-background shadow-sm' : 'text-muted-foreground hover:text-foreground'
              )}
            >
              Nominal
            </button>
            <button
              type="button"
              onClick={() => setMode(true)}
              aria-pressed={showPurchasingPower}
              className={cn(
                'rounded-full px-3 py-1.5 transition',
                showPurchasingPower ? 'bg-foreground text-background shadow-sm' : 'text-muted-foreground hover:text-foreground'
              )}
            >
              Purchasing power
            </button>
          </div>
        </div>
        {showNudge && (
          <div className="mt-3 flex items-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs">
            <p className="flex-1 text-amber-900 dark:text-amber-200">
              These offers span different cost-of-living areas — view in purchasing power?
            </p>
            <button
              type="button"
              onClick={() => setMode(true)}
              className="shrink-0 rounded-full bg-foreground px-3 py-1 font-medium text-background"
            >
              Enable
            </button>
            <button
              type="button"
              onClick={() => setPpNudgeDismissed(true)}
              aria-label="Dismiss purchasing power suggestion"
              className="shrink-0 rounded-full p-1 text-muted-foreground hover:text-foreground"
            >
              <X className="size-3.5" />
            </button>
          </div>
        )}
        <div className="text-sm text-muted-foreground flex flex-wrap gap-4 mt-2">
          {offers.map((o, i) => (
            <div key={compared[i]?.index ?? i} className={compared[i]?.index === activeIndex ? 'font-medium' : ''}>
              {o.name || `Offer ${i + 1}`}: <span className="font-medium">{fmt(totals[i])}</span>
              {showPurchasingPower && <span className="text-xs text-muted-foreground"> PP</span>}
            </div>
          ))}
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <ReactEChartsCore key={chartKey} option={option} notMerge style={{ height: chartH }} />
        
        {/* Purchasing Power Ranking */}
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4">
          <h4 className="mb-3 text-sm font-semibold text-emerald-800 dark:text-emerald-200">
            Purchasing power ranking · Year 1
          </h4>
          <div className="space-y-2">
            {ranked.map((data, rank) => {
              const pctOfMax = (data.ppY1 / maxPP) * 100;
              const diff = data.ppY1 - ranked[0].ppY1;
              
              return (
                <div key={data.index} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2">
                      <span className={`font-bold ${rank === 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground'}`}>
                        #{rank + 1}
                      </span>
                      <span className="font-medium">{data.name}</span>
                      <span className="text-xs text-muted-foreground">({data.location})</span>
                    </span>
                    <div className="text-right">
                      <span className={`font-semibold tabular-nums ${rank === 0 ? 'text-emerald-600 dark:text-emerald-400' : ''}`}>
                        {fmt(data.ppY1)}
                      </span>
                      <span className="text-xs text-muted-foreground ml-2">
                        (nominal {fmt(data.nominalY1)})
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                      <div
                        className={`h-full rounded-full ${rank === 0 ? 'bg-emerald-500' : 'bg-muted-foreground/40'}`}
                        style={{ width: `${pctOfMax}%` }}
                      />
                    </div>
                    {rank > 0 && (
                      <span className="w-20 text-right text-xs tabular-nums text-destructive">
                        -{fmt(Math.abs(diff))}
                      </span>
                    )}
                    {rank === 0 && <span className="w-20" />}
                  </div>
                </div>
              );
            })}
          </div>
          
          {/* Insight callout */}
          {hasInsight && (
            <div className="mt-4 border-t border-emerald-500/25 pt-3">
              <p className="text-sm text-emerald-800 dark:text-emerald-200">
                <span className="font-semibold">Insight:</span> Even though{' '}
                <strong>{ranked[0].name}</strong> has a lower nominal salary ({fmt(ranked[0].nominalY1)}) 
                than <strong>{ranked[ranked.length - 1].name}</strong> ({fmt(ranked[ranked.length - 1].nominalY1)}), 
                it provides <strong>{fmt(ranked[0].ppY1 - ranked[ranked.length - 1].ppY1)} more</strong> in 
                purchasing power due to the lower cost of living.
              </p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
