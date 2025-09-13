"use client";
import React, { useMemo, useState } from 'react';
import ReactEChartsCore from 'echarts-for-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { computeOffer } from '@/core/compute';
import { formatCurrency } from '@/lib/utils';
import { useStore } from '@/state/store';

export default function YearChart() {
  const { offer } = useStore();
  const data = computeOffer(offer);
  const total4y = Math.round(data.reduce((a, r) => a + r.total, 0));
  const fmt = (n: number) => formatCurrency(Math.round(n));
  const totals = data.map(r => Math.round(r.total));
  const colors: Record<string, string> = useMemo(() => ({
    Base: '#60a5fa',   // blue-400
    Bonus: '#34d399',  // emerald-400
    Stock: '#f59e0b',  // amber-500
    Other: '#a78bfa',  // violet-400
  }), []);
  const barOption = {
    tooltip: {
      trigger: 'axis',
      valueFormatter: (v: number) => fmt(v),
    },
    legend: { data: ['Base', 'Bonus', 'Stock', 'Other'] },
    xAxis: {
      type: 'category',
      data: data.map((r) => `Y${r.year}`),
    },
    yAxis: { type: 'value' },
    series: [
      { name: 'Base', type: 'bar', stack: 'total', itemStyle: { color: colors.Base }, label: { show: false }, data: data.map(r => Math.round(r.base)) },
      { name: 'Bonus', type: 'bar', stack: 'total', itemStyle: { color: colors.Bonus }, label: { show: false }, data: data.map(r => Math.round(r.bonus)) },
      { name: 'Stock', type: 'bar', stack: 'total', itemStyle: { color: colors.Stock }, label: { show: false }, data: data.map(r => Math.round(r.stock)) },
      { name: 'Other', type: 'bar', stack: 'total', itemStyle: { color: colors.Other },
        label: {
          show: true,
          position: 'top',
          formatter: (p: { dataIndex: number }) => fmt(totals[p.dataIndex] ?? 0),
        },
        data: data.map(r => Math.round(r.other))
      },
    ],
  } as const;

  // Donut breakdown with toggle (1-year vs 4-year)
  const [pieMode, setPieMode] = useState<'y1' | 'four'>('four');
  const sums = useMemo(() => {
    const baseSum = data.reduce((a, r) => a + r.base, 0);
    const bonusSum = data.reduce((a, r) => a + r.bonus, 0);
    const stockSum = data.reduce((a, r) => a + r.stock, 0);
    const otherSum = data.reduce((a, r) => a + r.other, 0);
    return { baseSum, bonusSum, stockSum, otherSum };
  }, [data]);
  const year1 = data[0] || { base: 0, bonus: 0, stock: 0, other: 0 };
  const pieData = pieMode === 'four'
    ? [
        { name: 'Base', value: Math.round(sums.baseSum) },
        { name: 'Bonus', value: Math.round(sums.bonusSum) },
        { name: 'Stock', value: Math.round(sums.stockSum) },
        { name: 'Other', value: Math.round(sums.otherSum) },
      ]
    : [
        { name: 'Base', value: Math.round(year1.base) },
        { name: 'Bonus', value: Math.round(year1.bonus) },
        { name: 'Stock', value: Math.round(year1.stock) },
        { name: 'Other', value: Math.round(year1.other) },
      ];
  const pieOption = {
    tooltip: {
      trigger: 'item',
      formatter: (p: { name: string; value: number; percent: number }) => `${p.name}: ${fmt(p.value)} (${Math.round(p.percent)}%)`,
    },
    legend: { show: true },
    series: [
      {
        name: pieMode === 'four' ? '4-year breakdown' : 'Year 1 breakdown',
        type: 'pie',
        radius: ['55%', '75%'],
        avoidLabelOverlap: true,
        label: { show: true, formatter: '{b}: {d}%' },
        itemStyle: {
          color: (params: { name: keyof typeof colors }) => colors[params.name] || undefined,
        },
        data: pieData,
      },
    ],
  } as const;
  return (
    <Card>
      <CardHeader>
        <CardTitle>Totals by Year</CardTitle>
        <div className="text-sm text-muted-foreground flex items-center gap-3 flex-wrap">
          <p>Total {offer.assumptions?.horizonYears ?? 4}-year Compensation: <span className="font-medium">{fmt(total4y)}</span></p>
          <div className="ml-auto flex items-center gap-2 text-xs">
            <span>Donut:</span>
            <button type="button" className={`px-2 py-1 border rounded ${pieMode==='y1'?'bg-muted':''}`} onClick={() => setPieMode('y1')}>Year 1</button>
            <button type="button" className={`px-2 py-1 border rounded ${pieMode==='four'?'bg-muted':''}`} onClick={() => setPieMode('four')}>4-year</button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <ReactEChartsCore option={barOption} style={{ height: 320 }} />
          <ReactEChartsCore option={pieOption} style={{ height: 320 }} />
        </div>
      </CardContent>
    </Card>
  );
}
