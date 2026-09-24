"use client";

import ReactEChartsCore from 'echarts-for-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useMemo, useState } from 'react';
import { useComparedOffers } from '@/lib/useComparedOffers';
import { computeOffer } from '@/core/compute';
import { formatCurrency } from '@/lib/utils';
import { useDarkMode } from '@/lib/useDarkMode';
import {
  categoricalPalette,
  tooltipStyle,
  axisStyle,
  legendStyle,
  chartAnimation,
  currencyAxisFormatter,
} from '@/lib/chartTheme';
import { useChartHeight } from '@/lib/useIsMobile';

export default function ComparisonTrendChart() {
  const chartH = useChartHeight(320, 240);
  const compared = useComparedOffers();
  const offers = useMemo(() => compared.map((p) => p.offer), [compared]);
  const dark = useDarkMode();
  const [mode, setMode] = useState<'yearly' | 'cumulative'>('yearly');
  const palette = useMemo(() => categoricalPalette(dark), [dark]);
  const axis = useMemo(() => axisStyle(dark), [dark]);
  if (!offers.length) return null;

  const rowsPerOffer = offers.map((offer) => computeOffer(offer));
  const horizon = Math.max(...rowsPerOffer.map((rows) => rows.length), 0);
  if (horizon === 0) return null;

  const years = Array.from({ length: horizon }, (_, index) => `Y${index + 1}`);

  const series = offers.map((offer, index) => {
    const rows = rowsPerOffer[index];
    let running = 0;
    return {
      name: offer.name || `Offer ${index + 1}`,
      type: 'line' as const,
      smooth: true,
      showSymbol: false,
      areaStyle: { opacity: 0.08 },
      lineStyle: { width: 3 },
      color: palette[index % palette.length],
      data: years.map((_, yearIndex) => {
        const v = Math.round(rows[yearIndex]?.total ?? 0);
        if (mode === 'cumulative') {
          running += v;
          return running;
        }
        return v;
      }),
    };
  });

  const option = {
    ...chartAnimation,
    tooltip: {
      trigger: 'axis',
      ...tooltipStyle(dark),
      formatter: (params: Array<{ seriesName: string; value: number }>) =>
        params
          .map((param) => `${param.seriesName}: <b>${formatCurrency(Math.round(param.value ?? 0))}</b>`)
          .join('<br/>'),
    },
    legend: legendStyle(dark, { type: 'scroll' as const, top: 0 }),
    grid: { left: 8, right: 8, top: 36, bottom: 0, containLabel: true },
    xAxis: {
      type: 'category',
      data: years,
      ...axis,
      splitLine: { show: false },
    },
    yAxis: {
      type: 'value',
      ...axis,
      axisLabel: { ...axis.axisLabel, formatter: currencyAxisFormatter },
    },
    series,
  } as const;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
        <CardTitle className="text-base sm:text-lg">
          {mode === 'cumulative' ? 'Cumulative earnings over time' : 'Total compensation over time'}
        </CardTitle>
        <div
          className="flex shrink-0 items-center gap-0.5 rounded-full border border-border/60 bg-muted/50 p-1"
          role="group"
          aria-label="Trend view"
        >
          {(['yearly', 'cumulative'] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              aria-pressed={mode === m}
              className={`rounded-full px-2.5 py-1 text-[11px] font-semibold capitalize transition-colors ${
                mode === m
                  ? 'bg-foreground text-background shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {m}
            </button>
          ))}
        </div>
      </CardHeader>
      <CardContent>
        <ReactEChartsCore option={option} notMerge style={{ height: chartH }} />
      </CardContent>
    </Card>
  );
}
