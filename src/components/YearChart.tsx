"use client";
import React, { useMemo, useState } from 'react';
import ReactEChartsCore from 'echarts-for-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { computeOffer } from '@/core/compute';
import { formatCurrency } from '@/lib/utils';
import { useStore } from '@/state/store';
import { useDarkMode } from '@/lib/useDarkMode';
import { useChartHeight } from '@/lib/useIsMobile';
import {
  compColors,
  tooltipStyle,
  axisStyle,
  legendStyle,
  chartAnimation,
  barItemStyle,
  currencyAxisFormatter,
} from '@/lib/chartTheme';

export default function YearChart() {
  const chartH = useChartHeight(320, 240);
  const { offer } = useStore();
  const data = computeOffer(offer);
  const total4y = Math.round(data.reduce((a, r) => a + r.total, 0));
  const fmt = (n: number) => formatCurrency(Math.round(n));
  const totals = data.map(r => Math.round(r.total));
  const dark = useDarkMode();
  const colors = useMemo(() => compColors(dark), [dark]);
  const axis = useMemo(() => axisStyle(dark), [dark]);
  const barOption = {
    ...chartAnimation,
    tooltip: {
      trigger: 'axis',
      valueFormatter: (v: number) => fmt(v),
      ...tooltipStyle(dark),
    },
    legend: { data: ['Base', 'Bonus', 'Stock', 'Other'], ...legendStyle(dark, { top: 0 }) },
    grid: { left: 8, right: 8, top: 36, bottom: 0, containLabel: true },
    xAxis: {
      type: 'category',
      data: data.map((r) => `Y${r.year}`),
      ...axis,
      splitLine: { show: false },
    },
    yAxis: {
      type: 'value',
      ...axis,
      axisLabel: { ...axis.axisLabel, formatter: currencyAxisFormatter },
    },
    series: [
      { name: 'Base', type: 'bar', stack: 'total', itemStyle: { color: colors.Base, borderRadius: 0 }, barWidth: '52%', label: { show: false }, data: data.map(r => Math.round(r.base)) },
      { name: 'Bonus', type: 'bar', stack: 'total', itemStyle: { color: colors.Bonus, borderRadius: 0 }, label: { show: false }, data: data.map(r => Math.round(r.bonus)) },
      { name: 'Stock', type: 'bar', stack: 'total', itemStyle: { color: colors.Stock, borderRadius: 0 }, label: { show: false }, data: data.map(r => Math.round(r.stock)) },
      { name: 'Other', type: 'bar', stack: 'total', itemStyle: { color: colors.Other, ...barItemStyle },
        label: {
          show: true,
          position: 'top',
          distance: 8,
          fontSize: 11,
          fontWeight: 600,
          fontFamily: 'inherit',
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
    ...chartAnimation,
    tooltip: {
      trigger: 'item',
      formatter: (p: { name: string; value: number; percent: number }) => `${p.name}: ${fmt(p.value)} (${Math.round(p.percent)}%)`,
      ...tooltipStyle(dark),
    },
    legend: { ...legendStyle(dark, { bottom: 0 }), type: 'scroll' as const },
    series: [
      {
        name: pieMode === 'four' ? '4-year breakdown' : 'Year 1 breakdown',
        type: 'pie',
        radius: ['58%', '78%'],
        center: ['50%', '46%'],
        avoidLabelOverlap: true,
        padAngle: 2,
        label: {
          show: true,
          formatter: '{b}: {d}%',
          fontSize: 11,
          fontFamily: 'inherit',
          color: axis.axisLabel.color,
        },
        labelLine: { length: 10, length2: 8, lineStyle: { color: axis.splitLine.lineStyle.color } },
        itemStyle: {
          borderRadius: 5,
          borderColor: dark ? '#232329' : '#ffffff',
          borderWidth: 2,
          color: (params: { name: keyof typeof colors }) => colors[params.name] || undefined,
        },
        emphasis: { scale: true, scaleSize: 4 },
        data: pieData,
      },
    ],
  } as const;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base sm:text-lg">Totals by Year</CardTitle>
        <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground sm:gap-3">
          <p className="text-xs sm:text-sm">Total {offer.assumptions?.horizonYears ?? 4}-year Compensation: <span className="font-medium tabular-nums text-foreground">{fmt(total4y)}</span></p>
          <div className="ml-auto flex items-center gap-0.5 rounded-full border border-border/60 p-0.5 text-xs">
            <button type="button" onClick={() => setPieMode('y1')}
              className={`min-h-8 rounded-full px-2.5 py-1 transition-colors ${pieMode==='y1'?'bg-foreground font-medium text-background':'text-muted-foreground hover:text-foreground'}`}>Year 1</button>
            <button type="button" onClick={() => setPieMode('four')}
              className={`min-h-8 rounded-full px-2.5 py-1 transition-colors ${pieMode==='four'?'bg-foreground font-medium text-background':'text-muted-foreground hover:text-foreground'}`}>4-year</button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <ReactEChartsCore option={barOption} style={{ height: chartH }} />
          <ReactEChartsCore option={pieOption} style={{ height: chartH }} />
        </div>
      </CardContent>
    </Card>
  );
}
