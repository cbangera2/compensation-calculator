"use client";
import React, { useMemo } from 'react';
import ReactEChartsCore from 'echarts-for-react';
import { CardTitle } from '@/components/ui/card';
import { useStore } from '@/state/store';
import { computeOffer, computeStartupVesting } from '@/core/compute';
import { formatCurrency } from '@/lib/utils';
import { useDarkMode } from '@/lib/useDarkMode';
import {
  compColors,
  categoricalPalette,
  tooltipStyle,
  axisStyle,
  legendStyle,
  chartAnimation,
  barItemStyle,
  currencyAxisFormatter,
} from '@/lib/chartTheme';
import { useChartHeight } from '@/lib/useIsMobile';
import MobileCollapse from '@/components/MobileCollapse';

export default function YearExtras() {
  const chartH = useChartHeight(260, 200);
  const { offer } = useStore();
  const dark = useDarkMode();
  const colors = useMemo(() => compColors(dark), [dark]);
  const catPalette = useMemo(() => categoricalPalette(dark), [dark]);
  const axis = useMemo(() => axisStyle(dark), [dark]);
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

  const startupVesting = useMemo(() => computeStartupVesting(offer), [offer]);
  const activeStartupGrants = useMemo(
    () => startupVesting.filter((g) => g.yearly.some((v) => v > 0.5)),
    [startupVesting]
  );

  const optionVest = {
    ...chartAnimation,
    tooltip: { trigger: 'axis', valueFormatter: (v: number) => fmt(v), ...tooltipStyle(dark) },
    legend: { data: activeStartupGrants.map((g) => g.label), ...legendStyle(dark, { top: 0 }) },
    grid: { left: 8, right: 8, top: 36, bottom: 0, containLabel: true },
    xAxis: { type: 'category', data: cats, ...axis, splitLine: { show: false } },
    yAxis: {
      type: 'value',
      ...axis,
      axisLabel: { ...axis.axisLabel, formatter: currencyAxisFormatter },
    },
    series: activeStartupGrants.map((g, i) => ({
      name: g.label,
      type: 'bar',
      stack: 'vest',
      data: g.yearly.map((v) => Math.round(v)),
      itemStyle: i === activeStartupGrants.length - 1
        ? { color: catPalette[i % catPalette.length], ...barItemStyle }
        : { color: catPalette[i % catPalette.length], borderRadius: 0 },
      barWidth: '52%',
    })),
  } as const;

  const optionCum = {
    ...chartAnimation,
    tooltip: { trigger: 'axis', valueFormatter: (v: number) => fmt(v), ...tooltipStyle(dark) },
    legend: { data: ['Cumulative Total', 'Cumulative Stock'], ...legendStyle(dark, { top: 0 }) },
    grid: { left: 8, right: 8, top: 36, bottom: 0, containLabel: true },
    xAxis: { type: 'category', data: cats, ...axis, splitLine: { show: false } },
    yAxis: {
      type: 'value',
      ...axis,
      axisLabel: { ...axis.axisLabel, formatter: currencyAxisFormatter },
    },
    series: [
      {
        name: 'Cumulative Total', type: 'line', data: cum.map(x => x.total), smooth: true,
        showSymbol: false, lineStyle: { width: 3, color: catPalette[0] },
        areaStyle: { opacity: 0.08, color: catPalette[0] },
      },
      {
        name: 'Cumulative Stock', type: 'line', data: cum.map(x => x.stock), smooth: true,
        showSymbol: false, lineStyle: { width: 3, color: colors.Stock },
        areaStyle: { opacity: 0.08, color: colors.Stock },
      },
    ],
  } as const;

  const option100 = {
    ...chartAnimation,
    tooltip: { trigger: 'axis', valueFormatter: (v: number) => `${Math.round(v)}%`, ...tooltipStyle(dark) },
    legend: { data: ['Base', 'Bonus', 'Stock', 'Other'], ...legendStyle(dark, { top: 0 }) },
    grid: { left: 8, right: 8, top: 36, bottom: 0, containLabel: true },
    xAxis: { type: 'category', data: cats, ...axis, splitLine: { show: false } },
    yAxis: { type: 'value', max: 100, ...axis },
    series: [
      { name: 'Base', type: 'bar', stack: 'pct', data: rows.map(r => Math.round((r.base / r.total) * 100)), itemStyle: { color: colors.Base, borderRadius: 0 }, barWidth: '52%' },
      { name: 'Bonus', type: 'bar', stack: 'pct', data: rows.map(r => Math.round((r.bonus / r.total) * 100)), itemStyle: { color: colors.Bonus, borderRadius: 0 } },
      { name: 'Stock', type: 'bar', stack: 'pct', data: rows.map(r => Math.round((r.stock / r.total) * 100)), itemStyle: { color: colors.Stock, borderRadius: 0 } },
      { name: 'Other', type: 'bar', stack: 'pct', data: rows.map(r => Math.round((r.other / r.total) * 100)), itemStyle: { color: colors.Other, ...barItemStyle } },
    ],
  } as const;

  return (
    <MobileCollapse
      title="More insights"
      description="Cumulative totals, yearly mix, and vesting by grant"
      header={<CardTitle className="text-sm font-semibold">More insights</CardTitle>}
      contentClassName="space-y-6"
    >
        <div>
          <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Cumulative totals</div>
          <ReactEChartsCore option={optionCum} style={{ height: chartH }} />
        </div>
        <div>
          <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Composition per year (100%)</div>
          <ReactEChartsCore option={option100} style={{ height: chartH }} />
        </div>
        {activeStartupGrants.length > 0 && (
          <div>
            <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Equity vesting by grant</div>
            <ReactEChartsCore option={optionVest} style={{ height: chartH }} />
          </div>
        )}
    </MobileCollapse>
  );
}
