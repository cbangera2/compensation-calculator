"use client";
import ReactEChartsCore from 'echarts-for-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useStore } from '@/state/store';
import { computeOffer } from '@/core/compute';
import { formatCurrency } from '@/lib/utils';

export default function ComparisonChart() {
  const { offers, activeIndex } = useStore();
  if (!offers || offers.length < 2) return null;

  const rowsPerOffer = offers.map((o) => computeOffer(o));
  const horizon = Math.max(...rowsPerOffer.map(r => r.length));
  const years = Array.from({ length: horizon }, (_, i) => `Y${i + 1}`);
  const totals = rowsPerOffer.map(rows => Math.round(rows.reduce((a, r) => a + r.total, 0)));
  const fmt = (n: number) => formatCurrency(Math.round(n));
  const chartKey = `${offers.length}:${offers.map(o => o.name || '').join('|')}:${horizon}`;

  // Prepare per-offer arrays for stacked series
  const byOffer = rowsPerOffer.map((rows) => ({
    base: Array.from({ length: horizon }, (_, y) => Math.round(rows[y]?.base ?? 0)),
    bonus: Array.from({ length: horizon }, (_, y) => Math.round(rows[y]?.bonus ?? 0)),
    stock: Array.from({ length: horizon }, (_, y) => Math.round(rows[y]?.stock ?? 0)),
    other: Array.from({ length: horizon }, (_, y) => Math.round(rows[y]?.other ?? 0)),
    total: Array.from({ length: horizon }, (_, y) => Math.round(rows[y]?.total ?? 0)),
  }));

  const colors: Record<string, string> = {
    Base: '#60a5fa',   // blue-400
    Bonus: '#34d399',  // emerald-400
    Stock: '#f59e0b',  // amber-500
    Other: '#a78bfa',  // violet-400
  };

  type LabelFormatterParam = { dataIndex: number };
  const makeTotalLabel = (offerIdx: number) => ({
    show: true,
    position: 'top' as const,
    formatter: (p: LabelFormatterParam) => fmt(byOffer[offerIdx].total[p.dataIndex] || 0),
  });

  const stackedSeries = offers.flatMap((o, i) => ([
    {
      id: `offer-${i}-base`,
      name: 'Base', type: 'bar' as const, stack: `offer-${i}`,
      itemStyle: { color: colors.Base },
      emphasis: { focus: 'series' as const },
      data: byOffer[i].base,
    },
    {
      id: `offer-${i}-bonus`,
      name: 'Bonus', type: 'bar' as const, stack: `offer-${i}`,
      itemStyle: { color: colors.Bonus },
      emphasis: { focus: 'series' as const },
      data: byOffer[i].bonus,
    },
    {
      id: `offer-${i}-stock`,
      name: 'Stock', type: 'bar' as const, stack: `offer-${i}`,
      itemStyle: { color: colors.Stock },
      emphasis: { focus: 'series' as const },
      data: byOffer[i].stock,
    },
    {
      id: `offer-${i}-other`,
      name: 'Other', type: 'bar' as const, stack: `offer-${i}`,
      itemStyle: { color: colors.Other },
      emphasis: { focus: 'series' as const },
      label: makeTotalLabel(i),
      data: byOffer[i].other,
    },
  ]));

  const option = {
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
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

        const lines: string[] = [`<div><strong>${year}</strong></div>`];
        Object.keys(grouped).sort((a, b) => Number(a) - Number(b)).forEach((key) => {
          const offerIdx = Number(key);
          const { base, bonus, stock, other } = grouped[offerIdx];
          const name = offers[offerIdx]?.name || `Offer ${offerIdx + 1}`;
          const total = byOffer[offerIdx]?.total[dataIndex] ?? base + bonus + stock + other;
          lines.push(`<div style="margin-top:4px;"><strong>${name}</strong> — Total ${fmt(total)}</div>`);
          lines.push(`<div style="padding-left:8px;">• Base ${fmt(base)}</div>`);
          lines.push(`<div style="padding-left:8px;">• Bonus ${fmt(bonus)}</div>`);
          lines.push(`<div style="padding-left:8px;">• Stock ${fmt(stock)}</div>`);
          lines.push(`<div style="padding-left:8px;">• Other ${fmt(other)}</div>`);
        });
        return lines.join('');
      },
    },
    legend: { data: ['Base', 'Bonus', 'Stock', 'Other'] },
    xAxis: { type: 'category', data: years },
    yAxis: { type: 'value' },
    grid: { left: 40, right: 16, top: 28, bottom: 24 },
    series: stackedSeries,
  } as const;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Offer Comparison</CardTitle>
        <div className="text-sm text-muted-foreground flex flex-wrap gap-4">
          {offers.map((o, i) => (
            <div key={i} className={i === activeIndex ? 'font-medium' : ''}>
              {o.name || `Offer ${i + 1}`}: <span className="font-medium">{fmt(totals[i])}</span> total
            </div>
          ))}
        </div>
      </CardHeader>
      <CardContent>
        <ReactEChartsCore key={chartKey} option={option} notMerge style={{ height: 360 }} />
      </CardContent>
    </Card>
  );
}
