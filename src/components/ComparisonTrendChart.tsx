"use client";

import ReactEChartsCore from 'echarts-for-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useStore } from '@/state/store';
import { computeOffer } from '@/core/compute';
import { formatCurrency } from '@/lib/utils';

const palette = ['#6366f1', '#ec4899', '#14b8a6', '#f97316', '#0ea5e9', '#8b5cf6'];

export default function ComparisonTrendChart() {
  const { offers } = useStore();
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
      areaStyle: { opacity: 0.08 },
      lineStyle: { width: 3 },
      color: palette[index % palette.length],
      data: years.map((_, yearIndex) => Math.round(rows[yearIndex]?.total ?? 0)),
    };
  });

  const option = {
    tooltip: {
      trigger: 'axis',
      formatter: (params: Array<{ seriesName: string; value: number }>) =>
        params
          .map((param) => `${param.seriesName}: <b>${formatCurrency(Math.round(param.value ?? 0))}</b>`)
          .join('<br/>'),
    },
    legend: {
      type: 'scroll',
    },
    grid: { left: 64, right: 16, top: 32, bottom: 24, containLabel: true },
    xAxis: {
      type: 'category',
      data: years,
    },
    yAxis: {
      type: 'value',
    },
    series,
  } as const;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Total compensation over time</CardTitle>
      </CardHeader>
      <CardContent>
        <ReactEChartsCore option={option} notMerge style={{ height: 320 }} />
      </CardContent>
    </Card>
  );
}
