"use client";
import React, { useCallback, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { useStore } from '@/state/store';
import { computeOffer } from '@/core/compute';
import { cn, formatCurrency } from '@/lib/utils';
import { CurrencyInput } from '@/components/ui/currency-input';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import ReactEChartsCore from 'echarts-for-react';

// Quick scenario presets
const GROWTH_PRESETS = [
  { label: '−25%', value: -0.25, color: 'bg-red-500' },
  { label: '−10%', value: -0.10, color: 'bg-red-400' },
  { label: 'Flat', value: 0, color: 'bg-gray-400' },
  { label: '+25%', value: 0.25, color: 'bg-green-400' },
  { label: '+50%', value: 0.50, color: 'bg-green-500' },
  { label: '2×', value: 1.0, color: 'bg-emerald-500' },
  { label: '3×', value: 2.0, color: 'bg-emerald-600' },
];

export default function EquityExplorer() {
  const { offer, setOffer } = useStore();

  // Initialize from offer growth price or first grant FMV as a fallback
  const initialPrice = offer.growth?.startingPrice
    ?? offer.equityGrants?.[0]?.fmv
    ?? 10;
  const [currentPrice, setCurrentPrice] = useState<number>(initialPrice);
  const [targetPrice, setTargetPrice] = useState<number>(Math.max(0.01, Math.round((initialPrice * 1.5) * 100) / 100));
  const [valuationToday, setValuationToday] = useState<number>(200_000_000);
  const [projectedValuation, setProjectedValuation] = useState<number>(Math.round(valuationToday * 1.5));
  const [mode, setMode] = useState<'multiplier' | 'price'>('multiplier');
  const [showAdvanced, setShowAdvanced] = useState(false);

  const round2 = (x: number) => Math.round(x * 100) / 100;
  const growthPct = currentPrice > 0 ? ((targetPrice / currentPrice) - 1) * 100 : 0;
  const sliderValue = isFinite(growthPct) ? Math.max(-90, Math.min(500, Math.round(growthPct))) : 0;
  const isPositiveGrowth = growthPct >= 0;

  const rowsAt = useCallback((p: number) => {
    const clone = JSON.parse(JSON.stringify(offer));
    clone.growth = { ...(offer.growth ?? { yoy: [0,0,0,0] }), startingPrice: Math.max(0.01, p) };
    return computeOffer(clone);
  }, [offer]);

  const rowsCurrent = useMemo(() => rowsAt(currentPrice), [rowsAt, currentPrice]);
  const rowsTarget = useMemo(() => rowsAt(targetPrice), [rowsAt, targetPrice]);
  const growthRatio = currentPrice > 0 ? (targetPrice / currentPrice) : 1;
  const rowsTargetDisplay = useMemo(() => {
    if (mode === 'multiplier') {
      return rowsCurrent.map(r => ({
        ...r,
        stock: r.stock * growthRatio,
        total: r.base + r.bonus + r.other + (r.stock * growthRatio),
      }));
    }
    return rowsTarget;
  }, [mode, rowsCurrent, rowsTarget, growthRatio]);

  const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
  const sumStock = (rows: ReturnType<typeof computeOffer>) => sum(rows.map(r => r.stock));
  const sumTotal = (rows: ReturnType<typeof computeOffer>) => sum(rows.map(r => r.total));

  const y1 = rowsCurrent[0];
  const y1Target = rowsTargetDisplay[0];
  const y1StockDelta = (y1Target?.stock ?? 0) - (y1?.stock ?? 0);
  const y1TotalDelta = (y1Target?.total ?? 0) - (y1?.total ?? 0);

  const totalStockCurrent = sumStock(rowsCurrent);
  const totalStockTarget = sumStock(rowsTargetDisplay);
  const totalCompCurrent = sumTotal(rowsCurrent);
  const totalCompTarget = sumTotal(rowsTargetDisplay);

  const applyPreset = (multiplier: number) => {
    const newTarget = round2(currentPrice * (1 + multiplier));
    setTargetPrice(newTarget);
    if (valuationToday > 0) {
      setProjectedValuation(Math.round(valuationToday * (1 + multiplier)));
    }
  };

  // Charts for compensation comparison
  const compChartOptions = useMemo(() => {
    const fmt = (n: number) => formatCurrency(Math.round(n));
    const cats = rowsCurrent.map(r => `Year ${r.year}`);
    const totalsCurrent = rowsCurrent.map(r => Math.round(r.total));
    const totalsTarget = rowsTargetDisplay.map(r => Math.round(r.total));
    const stockCurrent = rowsCurrent.map(r => Math.round(r.stock));
    const stockTarget = rowsTargetDisplay.map(r => Math.round(r.stock));
    
    return {
      totals: {
        tooltip: { trigger: 'axis', valueFormatter: (v: number) => fmt(v) },
        legend: { data: ['Baseline', 'With Growth'], top: 5 },
        grid: { left: 60, right: 20, top: 40, bottom: 30 },
        xAxis: { type: 'category', data: cats, axisLabel: { color: '#6b7280' } },
        yAxis: { type: 'value', axisLabel: { color: '#6b7280', formatter: (v: number) => `$${(v/1000).toFixed(0)}k` } },
        series: [
          { name: 'Baseline', type: 'bar', data: totalsCurrent, itemStyle: { color: '#94a3b8', borderRadius: [4, 4, 0, 0] } },
          { name: 'With Growth', type: 'bar', data: totalsTarget, itemStyle: { color: isPositiveGrowth ? '#22c55e' : '#ef4444', borderRadius: [4, 4, 0, 0] } },
        ],
      },
      stock: {
        tooltip: { trigger: 'axis', valueFormatter: (v: number) => fmt(v) },
        legend: { data: ['Baseline Equity', 'Target Equity'], top: 5 },
        grid: { left: 60, right: 20, top: 40, bottom: 30 },
        xAxis: { type: 'category', data: cats, axisLabel: { color: '#6b7280' } },
        yAxis: { type: 'value', axisLabel: { color: '#6b7280', formatter: (v: number) => `$${(v/1000).toFixed(0)}k` } },
        series: [
          { name: 'Baseline Equity', type: 'bar', data: stockCurrent, itemStyle: { color: '#f59e0b', borderRadius: [4, 4, 0, 0] } },
          { name: 'Target Equity', type: 'bar', data: stockTarget, itemStyle: { color: '#d97706', borderRadius: [4, 4, 0, 0] } },
        ],
      },
    };
  }, [rowsCurrent, rowsTargetDisplay, isPositiveGrowth]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <span className="text-2xl">📈</span>
          Stock Growth Explorer
        </CardTitle>
        <CardDescription>
          See how stock price changes affect your total compensation
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Main growth control - the hero section */}
        <div className="rounded-xl border-2 border-primary/20 bg-gradient-to-br from-primary/5 via-background to-background p-6">
          <div className="grid gap-6 lg:grid-cols-[1fr_auto_1fr]">
            {/* Current price */}
            <div className="space-y-2">
              <Label className="text-sm font-medium text-muted-foreground">Current Stock Price</Label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xl text-muted-foreground">$</span>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={currentPrice}
                  onChange={(e) => setCurrentPrice(Number(e.target.value) || 0.01)}
                  className="w-full h-14 pl-10 pr-4 text-2xl font-semibold rounded-lg border bg-background focus:ring-2 focus:ring-primary/20"
                />
              </div>
            </div>

            {/* Arrow with growth percentage */}
            <div className="flex flex-col items-center justify-center gap-1 py-2">
              <div className={cn(
                "flex items-center justify-center w-16 h-16 rounded-full text-white font-bold text-lg",
                isPositiveGrowth ? "bg-green-500" : "bg-red-500"
              )}>
                {isPositiveGrowth ? '+' : ''}{Math.round(growthPct)}%
              </div>
              <svg className={cn("w-8 h-8", isPositiveGrowth ? "text-green-500" : "text-red-500")} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M14 5l7 7m0 0l-7 7m7-7H3" />
              </svg>
            </div>

            {/* Target price */}
            <div className="space-y-2">
              <Label className="text-sm font-medium text-muted-foreground">Target Stock Price</Label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xl text-muted-foreground">$</span>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={targetPrice}
                  onChange={(e) => {
                    const v = Number(e.target.value) || 0.01;
                    setTargetPrice(v);
                    if (valuationToday > 0 && currentPrice > 0) {
                      setProjectedValuation(Math.round(valuationToday * (v / currentPrice)));
                    }
                  }}
                  className={cn(
                    "w-full h-14 pl-10 pr-4 text-2xl font-semibold rounded-lg border focus:ring-2",
                    isPositiveGrowth 
                      ? "bg-green-50 border-green-200 focus:ring-green-200 dark:bg-green-950/30 dark:border-green-800" 
                      : "bg-red-50 border-red-200 focus:ring-red-200 dark:bg-red-950/30 dark:border-red-800"
                  )}
                />
              </div>
            </div>
          </div>

          {/* Growth slider */}
          <div className="mt-6 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Drag to adjust growth</span>
              <span className={cn(
                "text-sm font-medium px-2 py-0.5 rounded-full",
                isPositiveGrowth ? "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400" : "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400"
              )}>
                {isPositiveGrowth ? '+' : ''}{Math.round(growthPct)}%
              </span>
            </div>
            <Slider
              value={[sliderValue]}
              min={-90}
              max={500}
              step={5}
              onValueChange={(v) => {
                const pct = v[0] / 100;
                const ratio = 1 + pct;
                setTargetPrice(round2(currentPrice * ratio));
                setProjectedValuation(Math.round(valuationToday * ratio));
              }}
              className={cn(
                "[&_[data-slot=slider-track]]:h-3",
                "[&_[data-slot=slider-range]]:transition-colors",
                isPositiveGrowth 
                  ? "[&_[data-slot=slider-range]]:bg-green-500" 
                  : "[&_[data-slot=slider-range]]:bg-red-500"
              )}
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>−90%</span>
              <span>0%</span>
              <span>+100%</span>
              <span>+300%</span>
              <span>+500%</span>
            </div>
          </div>

          {/* Quick preset buttons */}
          <div className="mt-4 flex flex-wrap gap-2">
            {GROWTH_PRESETS.map((preset) => (
              <Button
                key={preset.label}
                variant="outline"
                size="sm"
                onClick={() => applyPreset(preset.value)}
                className={cn(
                  "transition-all hover:scale-105",
                  Math.abs(growthPct / 100 - preset.value) < 0.05 && "ring-2 ring-primary"
                )}
              >
                {preset.label}
              </Button>
            ))}
          </div>
        </div>

        {/* Results summary cards */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <ResultCard
            label="Year 1 Equity"
            value={y1Target?.stock ?? 0}
            baseline={y1?.stock ?? 0}
            delta={y1StockDelta}
            isPositive={isPositiveGrowth}
          />
          <ResultCard
            label="Year 1 Total Comp"
            value={y1Target?.total ?? 0}
            baseline={y1?.total ?? 0}
            delta={y1TotalDelta}
            isPositive={isPositiveGrowth}
          />
          <ResultCard
            label="4-Year Equity"
            value={totalStockTarget}
            baseline={totalStockCurrent}
            delta={totalStockTarget - totalStockCurrent}
            isPositive={isPositiveGrowth}
          />
          <ResultCard
            label="4-Year Total Comp"
            value={totalCompTarget}
            baseline={totalCompCurrent}
            delta={totalCompTarget - totalCompCurrent}
            isPositive={isPositiveGrowth}
            highlight
          />
        </div>

        {/* Charts */}
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-lg border bg-card p-4">
            <h3 className="text-sm font-medium mb-3">Total Compensation by Year</h3>
            <ReactEChartsCore option={compChartOptions.totals} style={{ height: 240, width: '100%' }} />
          </div>
          <div className="rounded-lg border bg-card p-4">
            <h3 className="text-sm font-medium mb-3">Equity Value by Year</h3>
            <ReactEChartsCore option={compChartOptions.stock} style={{ height: 240, width: '100%' }} />
          </div>
        </div>

        {/* Advanced options */}
        <div className="border-t pt-4">
          <button
            type="button"
            onClick={() => setShowAdvanced(v => !v)}
            className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            <svg
              className={cn("w-4 h-4 transition-transform", showAdvanced && "rotate-90")}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
            Advanced Options
          </button>
          
          {showAdvanced && (
            <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4 p-4 rounded-lg bg-muted/30">
              <div>
                <Label className="text-xs">Computation Method</Label>
                <select
                  className="mt-1 w-full h-9 rounded-md border bg-background px-3 text-sm"
                  value={mode}
                  onChange={(e) => setMode(e.target.value as 'multiplier' | 'price')}
                >
                  <option value="multiplier">Multiply equity only</option>
                  <option value="price">Recompute from price</option>
                </select>
                <p className="text-[10px] text-muted-foreground mt-1">How growth affects compensation</p>
              </div>
              <div>
                <Label className="text-xs">Company Valuation Today</Label>
                <CurrencyInput 
                  value={valuationToday} 
                  onValueChange={(v) => {
                    setValuationToday(v);
                    const ratio = currentPrice > 0 ? targetPrice / currentPrice : 1;
                    setProjectedValuation(Math.round(v * ratio));
                  }}
                  className="mt-1 h-9"
                />
                <p className="text-[10px] text-muted-foreground mt-1">Market cap estimate</p>
              </div>
              <div>
                <Label className="text-xs">Projected Valuation</Label>
                <CurrencyInput 
                  value={projectedValuation} 
                  onValueChange={(v) => {
                    setProjectedValuation(v);
                    if (valuationToday > 0) {
                      const ratio = v / valuationToday;
                      setTargetPrice(round2(currentPrice * ratio));
                    }
                  }}
                  className="mt-1 h-9"
                />
                <p className="text-[10px] text-muted-foreground mt-1">Syncs with price ratio</p>
              </div>
              <div className="flex items-end">
                <Button
                  onClick={() => {
                    const next = { ...offer, growth: { ...(offer.growth ?? { yoy: [0,0,0,0] }), startingPrice: Math.max(0.01, targetPrice) } };
                    setOffer(next);
                  }}
                  className="w-full"
                >
                  Apply to Offer
                </Button>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// Result card component
function ResultCard({ 
  label, 
  value, 
  baseline, 
  delta, 
  isPositive,
  highlight = false,
}: { 
  label: string; 
  value: number; 
  baseline: number; 
  delta: number;
  isPositive: boolean;
  highlight?: boolean;
}) {
  const pctChange = baseline > 0 ? Math.round((delta / baseline) * 100) : 0;
  
  return (
    <div className={cn(
      "rounded-lg border p-4 transition-all",
      highlight && "ring-2 ring-primary/20 bg-primary/5"
    )}>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-2xl font-bold mt-1">{formatCurrency(Math.round(value))}</div>
      <div className="flex items-center gap-2 mt-2">
        <span className="text-xs text-muted-foreground">
          vs {formatCurrency(Math.round(baseline))}
        </span>
        <span className={cn(
          "text-xs font-medium px-1.5 py-0.5 rounded",
          isPositive 
            ? "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400" 
            : "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400"
        )}>
          {isPositive ? '+' : ''}{pctChange}%
        </span>
      </div>
    </div>
  );
}
