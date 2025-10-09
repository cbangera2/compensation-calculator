"use client";

import ReactEChartsCore from 'echarts-for-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useStore } from '@/state/store';
import { computeOffer } from '@/core/compute';
import { formatCurrency } from '@/lib/utils';

const palette = ['#f59e0b', '#fb7185', '#67e8f9', '#a855f7', '#34d399', '#f97316'];

export default function ComparisonStockChart() {
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
      lineStyle: { width: 3 },
      areaStyle: { opacity: 0.12 },
      color: palette[index % palette.length],
      data: years.map((_, yearIndex) => Math.round(rows[yearIndex]?.stock ?? 0)),
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
        <CardTitle>Equity value trajectory</CardTitle>
      </CardHeader>
      <CardContent>
        <ReactEChartsCore option={option} notMerge style={{ height: 320 }} />
      </CardContent>
    </Card>
  );
}
