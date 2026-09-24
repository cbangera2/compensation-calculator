"use client";

import ReactEChartsCore from 'echarts-for-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useMemo } from 'react';
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

export default function ComparisonStockChart() {
  const chartH = useChartHeight(320, 240);
  const compared = useComparedOffers();
  const offers = useMemo(() => compared.map((p) => p.offer), [compared]);
  const dark = useDarkMode();
  const palette = useMemo(() => categoricalPalette(dark), [dark]);
  const axis = useMemo(() => axisStyle(dark), [dark]);
  if (!offers.length) return null;

  const rowsPerOffer = offers.map((offer) => computeOffer(offer));
  const horizon = Math.max(...rowsPerOffer.map((rows) => rows.length), 0);
  if (horizon === 0) return null;

  const years = Array.from({ length: horizon }, (_, index) => `Y${index + 1}`);

  const series = offers.map((offer, index) => {
    const rows = rowsPerOffer[index];
    return {
      name: offer.name || `Offer ${index + 1}`,
      type: 'line' as const,
      smooth: true,
      showSymbol: false,
      lineStyle: { width: 3 },
      areaStyle: { opacity: 0.12 },
      color: palette[index % palette.length],
      data: years.map((_, yearIndex) => Math.round(rows[yearIndex]?.stock ?? 0)),
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
      <CardHeader>
        <CardTitle className="text-base sm:text-lg">Equity value trajectory</CardTitle>
      </CardHeader>
      <CardContent>
        <ReactEChartsCore option={option} notMerge style={{ height: chartH }} />
      </CardContent>
    </Card>
  );
}
