"use client";
import React, { useMemo } from 'react';
import ReactEChartsCore from 'echarts-for-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useStore } from '@/state/store';
import { computeOffer } from '@/core/compute';
import { formatCurrency } from '@/lib/utils';

export default function YearExtras() {
  const { offer } = useStore();
  const rows = computeOffer(offer);
  const cats = rows.map(r => `Y${r.year}`);
  const cum = useMemo(() => {
    let t = 0, s = 0;
    return rows.map(r => {
      t += r.total; s += r.stock;
      return { total: Math.round(t), stock: Math.round(s) };
    });
  }, [rows]);

  const fmt = (n: number) => formatCurrency(Math.round(n));

  const optionCum = {
    tooltip: { trigger: 'axis', valueFormatter: (v: number) => fmt(v) },
    legend: { data: ['Cumulative Total', 'Cumulative Stock'] },
    xAxis: { type: 'category', data: cats },
    yAxis: { type: 'value' },
    series: [
      { name: 'Cumulative Total', type: 'line', data: cum.map(x => x.total), smooth: true, areaStyle: { opacity: 0.1 } },
      { name: 'Cumulative Stock', type: 'line', data: cum.map(x => x.stock), smooth: true, areaStyle: { opacity: 0.1 } },
    ],
  } as const;

  const option100 = {
    tooltip: { trigger: 'axis', valueFormatter: (v: number) => `${Math.round(v)}%` },
    legend: { data: ['Base', 'Bonus', 'Stock', 'Other'] },
    xAxis: { type: 'category', data: cats },
    yAxis: { type: 'value', max: 100 },
    series: [
      { name: 'Base', type: 'bar', stack: 'pct', data: rows.map(r => Math.round((r.base / r.total) * 100)), itemStyle: { color: '#60a5fa' } },
      { name: 'Bonus', type: 'bar', stack: 'pct', data: rows.map(r => Math.round((r.bonus / r.total) * 100)), itemStyle: { color: '#34d399' } },
      { name: 'Stock', type: 'bar', stack: 'pct', data: rows.map(r => Math.round((r.stock / r.total) * 100)), itemStyle: { color: '#f59e0b' } },
      { name: 'Other', type: 'bar', stack: 'pct', data: rows.map(r => Math.round((r.other / r.total) * 100)), itemStyle: { color: '#a78bfa' } },
    ],
  } as const;

  return (
    <Card>
      <CardHeader>
        <CardTitle>More Insights</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div>
          <div className="text-sm font-medium mb-2">Cumulative totals</div>
          <ReactEChartsCore option={optionCum} style={{ height: 260 }} />
        </div>
        <div>
          <div className="text-sm font-medium mb-2">Composition per year (100%)</div>
          <ReactEChartsCore option={option100} style={{ height: 260 }} />
        </div>
      </CardContent>
    </Card>
  );
}
