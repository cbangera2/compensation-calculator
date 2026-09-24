"use client";
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { useStore } from '@/state/store';
import { computeOffer } from '@/core/compute';
import { cn, formatCurrency } from '@/lib/utils';
import { CurrencyInput } from '@/components/ui/currency-input';
import { Button } from '@/components/ui/button';
import { TrendingUp, Loader2 } from 'lucide-react';
import { Slider } from '@/components/ui/slider';
import ReactEChartsCore from 'echarts-for-react';
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
import HistoricalGrowth from '@/components/HistoricalGrowth';
import { useChartHeight } from '@/lib/useIsMobile';
import {
  SUPPORTED_TICKERS,
  isSupportedTicker,
  type HistoryStats,
  type MonthlyClose,
} from '@/lib/market';

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

/** A price series rebased so the first point equals 100. */
export interface IndexedPoint {
  date: string;
  /** index value, 100 = starting price */
  value: number;
}

/**
 * Rebase monthly closes to an index starting at 100 so companies with
 * wildly different share prices plot on the same scale. Pure.
 */
export function normalizeTo100(closes: MonthlyClose[]): IndexedPoint[] {
  if (closes.length === 0) return [];
  const base = closes[0]?.close;
  if (base == null || !isFinite(base) || base <= 0) return [];
  return closes.map((c) => ({ date: c.date, value: (c.close / base) * 100 }));
}

const COMPANY_TICKER_PATTERNS: Array<[RegExp, string]> = [
  [/meta|facebook/i, 'META'],
  [/google|alphabet/i, 'GOOGL'],
  [/apple/i, 'AAPL'],
  [/microsoft/i, 'MSFT'],
  [/tesla/i, 'TSLA'],
  [/palantir/i, 'PLTR'],
];

/**
 * Map a free-text company/offer name to a supported public ticker.
 * Returns null for private companies and unknown names. Pure.
 */
export function companyNameToTicker(name: string | null | undefined): string | null {
  const n = (name ?? '').trim();
  if (!n) return null;
  if (isSupportedTicker(n)) return n.toUpperCase();
  for (const [re, ticker] of COMPANY_TICKER_PATTERNS) {
    if (re.test(n)) return ticker;
  }
  return null;
}

/**
 * Default 2-ticker compare set: the offer's company first when it maps to a
 * public ticker, then well-known large-cap fallbacks. Pure.
 */
export function defaultCompareTickers(
  offerName?: string | null,
  startupCompanyName?: string | null,
): string[] {
  const out: string[] = [];
  for (const name of [offerName, startupCompanyName]) {
    const t = companyNameToTicker(name);
    if (t && !out.includes(t)) out.push(t);
  }
  for (const t of SUPPORTED_TICKERS) {
    if (out.length >= 2) break;
    if (!out.includes(t)) out.push(t);
  }
  return out.slice(0, 2);
}

export default function EquityExplorer() {
  const chartH = useChartHeight(240, 190);
  const { offer, setOffer } = useStore();
  const dark = useDarkMode();

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
  // Flash the confirmed annual rate briefly after saving a scenario to the offer.
  const [saveFlash, setSaveFlash] = useState<number | null>(null);
  useEffect(() => {
    if (saveFlash === null) return;
    const t = window.setTimeout(() => setSaveFlash(null), 2500);
    return () => window.clearTimeout(t);
  }, [saveFlash]);

  // Compare-companies mode: 2-4 tickers, ~5y monthly histories indexed to 100.
  const [compareMode, setCompareMode] = useState(false);
  const [compareTickers, setCompareTickers] = useState<string[]>(() =>
    defaultCompareTickers(offer.name, offer.startupEquity?.companyName),
  );
  const [compareStatus, setCompareStatus] = useState<'idle' | 'loading' | 'done' | 'error'>('idle');
  const [compareSeries, setCompareSeries] = useState<Record<string, HistoryStats>>({});
  const [compareError, setCompareError] = useState<string | null>(null);

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

  // Drive the scenario from a realized 5y CAGR: compound the annualized rate
  // over the projection horizon, so the target price reflects that rate
  // sustained for the full horizon rather than a one-shot +g% bump.
  const applyHistoricalCagr = (cagr: number) => {
    const horizonYears = offer.assumptions?.horizonYears ?? 4;
    const ratio = Math.pow(1 + cagr, horizonYears);
    setTargetPrice(round2(currentPrice * ratio));
    if (valuationToday > 0) {
      setProjectedValuation(Math.round(valuationToday * ratio));
    }
  };

  // Write the explored scenario back into the offer's growth assumptions:
  // startingPrice = current price, yoy = the annualized rate implied by the
  // current -> target path, compounded over the offer's horizon. Nothing else
  // on the offer is touched.
  const saveScenarioToOffer = () => {
    const horizon = offer.assumptions?.horizonYears ?? 4;
    const safeCurrent = Math.max(0.01, currentPrice);
    const safeTarget = Math.max(0.01, targetPrice);
    const raw = Math.pow(safeTarget / safeCurrent, 1 / horizon) - 1;
    const annualRate = Math.max(-0.9, Math.min(5, raw));
    setOffer({
      ...offer,
      growth: {
        startingPrice: safeCurrent,
        yoy: Array.from({ length: horizon }, () => annualRate),
      },
    });
    setSaveFlash(annualRate);
  };

  const formatAnnualRate = (r: number) =>
    `${r >= 0 ? '+' : ''}${(r * 100).toFixed(1)}%/yr`;

  // ---- Compare-companies mode -------------------------------------------
  const invalidCompareTickers = useMemo(
    () =>
      compareTickers
        .map((t) => t.trim().toUpperCase())
        .filter((t) => t.length > 0 && !isSupportedTicker(t)),
    [compareTickers],
  );

  const setCompareTickerAt = (index: number, value: string) => {
    const clean = value.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 6);
    setCompareTickers((prev) => prev.map((t, i) => (i === index ? clean : t)));
  };

  const fetchCompareSeries = async () => {
    const unique = [
      ...new Set(
        compareTickers.map((t) => t.trim().toUpperCase()).filter((t) => isSupportedTicker(t)),
      ),
    ];
    if (unique.length < 2) return;
    setCompareStatus('loading');
    setCompareError(null);
    try {
      const pairs = await Promise.all(
        unique.map(async (t) => {
          const res = await fetch(`/api/market/history?ticker=${encodeURIComponent(t)}`);
          const json = await res.json();
          if (!res.ok) throw new Error(json?.error ?? `request failed (${res.status})`);
          return [t, json as HistoryStats] as const;
        }),
      );
      setCompareSeries(Object.fromEntries(pairs));
      setCompareStatus('done');
    } catch (e) {
      setCompareError(e instanceof Error ? e.message : 'request failed');
      setCompareStatus('error');
    }
  };

  /** Load a company's realized 5y CAGR into the single-company scenario. */
  const useCompareRate = (cagr: number) => {
    applyHistoricalCagr(cagr);
    setCompareMode(false);
  };

  const compareChartOption = useMemo(() => {
    const ax = axisStyle(dark);
    const palette = categoricalPalette(dark);
    const entries = compareTickers
      .map((t) => t.trim().toUpperCase())
      .filter((t) => t.length > 0)
      .map((ticker, i) => ({
        ticker,
        stats: compareSeries[ticker],
        color: palette[i % palette.length] ?? '#6366f1',
      }))
      .filter(
        (e): e is { ticker: string; stats: HistoryStats; color: string } =>
          !!e.stats && e.stats.closes.length > 1,
      );
    const perTicker = entries.map((e) => {
      const pts = normalizeTo100(e.stats.closes);
      return new Map(pts.map((p) => [p.date, Math.round(p.value * 10) / 10]));
    });
    const dates = [...new Set(perTicker.flatMap((m) => [...m.keys()]))].sort();
    return {
      tooltip: {
        trigger: 'axis',
        valueFormatter: (v: number | null) => (v == null ? '—' : v.toFixed(1)),
        ...tooltipStyle(dark),
      },
      legend: legendStyle(dark),
      grid: { left: 8, right: 12, top: 44, bottom: 4, containLabel: true },
      xAxis: {
        type: 'category',
        data: dates,
        axisLabel: { ...ax.axisLabel, formatter: (v: string) => v.slice(0, 7) },
        axisLine: ax.axisLine,
        axisTick: ax.axisTick,
      },
      yAxis: {
        type: 'value',
        axisLabel: { ...ax.axisLabel, formatter: (v: number) => v.toFixed(0) },
        axisLine: ax.axisLine,
        axisTick: ax.axisTick,
        splitLine: ax.splitLine,
      },
      series: entries.map((e, i) => ({
        name: e.ticker,
        type: 'line',
        showSymbol: false,
        connectNulls: true,
        data: dates.map((d) => perTicker[i]?.get(d) ?? null),
        lineStyle: { width: 2, color: e.color },
        itemStyle: { color: e.color },
        emphasis: { focus: 'series' },
        ...(i === 0
          ? {
              markLine: {
                silent: true,
                symbol: 'none',
                label: { formatter: 'start', fontSize: 10, color: ax.axisLabel.color },
                lineStyle: { type: 'dashed', color: ax.axisLabel.color, opacity: 0.5 },
                data: [{ yAxis: 100 }],
              },
            }
          : {}),
      })),
      ...chartAnimation,
    };
  }, [compareTickers, compareSeries, dark]);

  // Charts for compensation comparison (shared premium theme)
  const compChartOptions = useMemo(() => {
    const fmt = (n: number) => formatCurrency(Math.round(n));
    const cats = rowsCurrent.map(r => `Year ${r.year}`);
    const totalsCurrent = rowsCurrent.map(r => Math.round(r.total));
    const totalsTarget = rowsTargetDisplay.map(r => Math.round(r.total));
    const stockCurrent = rowsCurrent.map(r => Math.round(r.stock));
    const stockTarget = rowsTargetDisplay.map(r => Math.round(r.stock));
    const ax = axisStyle(dark);
    const growthColor = isPositiveGrowth
      ? (dark ? '#34d399' : '#10b981')
      : (dark ? '#f87171' : '#ef4444');

    const base = {
      tooltip: { trigger: 'axis', valueFormatter: (v: number) => fmt(v), ...tooltipStyle(dark) },
      legend: legendStyle(dark),
      grid: { left: 8, right: 12, top: 44, bottom: 4, containLabel: true },
      xAxis: { type: 'category', data: cats, axisLabel: ax.axisLabel, axisLine: ax.axisLine, axisTick: ax.axisTick },
      yAxis: {
        type: 'value',
        axisLabel: { ...ax.axisLabel, formatter: currencyAxisFormatter },
        axisLine: ax.axisLine,
        axisTick: ax.axisTick,
        splitLine: ax.splitLine,
      },
      ...chartAnimation,
    };

    return {
      totals: {
        ...base,
        series: [
          { name: 'Baseline', type: 'bar', data: totalsCurrent, itemStyle: { ...barItemStyle, color: dark ? '#64748b' : '#94a3b8' } },
          { name: 'With Growth', type: 'bar', data: totalsTarget, itemStyle: { ...barItemStyle, color: growthColor } },
        ],
      },
      stock: {
        ...base,
        series: [
          { name: 'Baseline Equity', type: 'bar', data: stockCurrent, itemStyle: { ...barItemStyle, color: compColors(dark).Stock } },
          { name: 'Target Equity', type: 'bar', data: stockTarget, itemStyle: { ...barItemStyle, color: dark ? '#b45309' : '#d97706' } },
        ],
      },
    };
  }, [rowsCurrent, rowsTargetDisplay, isPositiveGrowth, dark]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
          <TrendingUp className="size-5 text-primary" />
          Stock Growth Explorer
        </CardTitle>
        <CardDescription>
          See how stock price changes affect your total compensation
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 sm:space-y-6">
        {/* Mode toggle: single-company scenario vs multi-company comparison */}
        <div
          className="flex w-full rounded-full border border-border/70 bg-muted/40 p-1 sm:w-fit"
          role="tablist"
          aria-label="Explorer mode"
        >
          {(
            [
              ['single', 'Single company'],
              ['compare', 'Compare companies'],
            ] as const
          ).map(([value, label]) => {
            const selected = compareMode === (value === 'compare');
            return (
              <button
                key={value}
                type="button"
                role="tab"
                aria-selected={selected}
                onClick={() => setCompareMode(value === 'compare')}
                className={cn(
                  'min-h-9 flex-1 rounded-full px-4 py-1.5 text-sm font-medium transition-colors sm:flex-none',
                  selected
                    ? 'bg-foreground text-background shadow-sm'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {label}
              </button>
            );
          })}
        </div>

        {compareMode ? (
          <div className="space-y-4">
            <div className="rounded-xl border border-border/60 p-4 sm:p-5">
              <Label className="text-sm font-medium">Companies to compare (2–4)</Label>
              <p className="mt-0.5 text-xs text-muted-foreground">
                ~5y monthly history, indexed to 100. Historical, not predictive.
              </p>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {compareTickers.map((t, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <input
                      value={t}
                      onChange={(e) => setCompareTickerAt(i, e.target.value)}
                      placeholder="META"
                      aria-label={`Ticker ${i + 1}`}
                      className="h-10 w-full rounded-lg border bg-background px-3 text-sm font-semibold uppercase tracking-wide"
                    />
                    {compareTickers.length > 2 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="min-h-9 shrink-0"
                        onClick={() =>
                          setCompareTickers((prev) => prev.filter((_, j) => j !== i))
                        }
                      >
                        Remove
                      </Button>
                    )}
                  </div>
                ))}
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                {compareTickers.length < 4 && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="min-h-9"
                    onClick={() => setCompareTickers((prev) => [...prev, ''])}
                  >
                    + Add company
                  </Button>
                )}
                <Button
                  type="button"
                  size="sm"
                  className="min-h-9"
                  disabled={
                    compareStatus === 'loading' ||
                    invalidCompareTickers.length > 0 ||
                    compareTickers.filter((tt) => tt.trim()).length < 2
                  }
                  onClick={fetchCompareSeries}
                >
                  {compareStatus === 'loading' && <Loader2 className="size-3.5 animate-spin" />}
                  {compareStatus === 'loading' ? 'Loading…' : 'Compare'}
                </Button>
              </div>
              {invalidCompareTickers.length > 0 && (
                <p className="mt-2 text-xs text-destructive">
                  Unsupported ticker{invalidCompareTickers.length > 1 ? 's' : ''}:{' '}
                  {invalidCompareTickers.join(', ')}. Try {SUPPORTED_TICKERS.join(', ')}.
                </p>
              )}
              {compareStatus === 'idle' && (
                <p className="mt-2 text-xs text-muted-foreground">
                  Enter 2–4 tickers and hit Compare.
                </p>
              )}
              {compareStatus === 'error' && (
                <p className="mt-2 text-xs text-destructive">
                  Couldn&apos;t load history{compareError ? `: ${compareError}` : ''}. Try again in a bit.
                </p>
              )}
            </div>

            {compareStatus === 'done' && (
              <>
                <div className="rounded-lg border bg-card p-3 sm:p-4">
                  <h3 className="mb-2 text-sm font-medium sm:mb-3">
                    5-year growth, indexed to 100
                  </h3>
                  <ReactEChartsCore
                    option={compareChartOption}
                    style={{ height: chartH, width: '100%' }}
                  />
                </div>
                <div className="grid grid-cols-2 gap-2.5 sm:gap-4 lg:grid-cols-4">
                  {compareTickers
                    .map((tt) => tt.trim().toUpperCase())
                    .filter((tt) => tt.length > 0)
                    .map((ticker) => (
                      <CompareCompanyCard
                        key={ticker}
                        ticker={ticker}
                        stats={compareSeries[ticker] ?? null}
                        onUseRate={useCompareRate}
                      />
                    ))}
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Realized 5y CAGRs from split/dividend-adjusted monthly closes. Past performance
                  doesn&apos;t predict your grant&apos;s future.
                </p>
              </>
            )}
          </div>
        ) : (
          <>
        {/* Main growth control - the hero section */}
        <div className="rounded-xl border-2 border-primary/20 bg-gradient-to-br from-primary/5 via-background to-background p-4 sm:p-6">
          <div className="grid gap-4 sm:gap-6 lg:grid-cols-[1fr_auto_1fr]">
            {/* Current price */}
            <div className="space-y-2">
              <Label className="text-sm font-medium text-muted-foreground">Current Stock Price</Label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-lg text-muted-foreground sm:text-xl">$</span>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={currentPrice}
                  onChange={(e) => setCurrentPrice(Number(e.target.value) || 0.01)}
                  className="w-full h-12 pl-10 pr-4 text-xl font-semibold rounded-lg border bg-background focus:ring-2 focus:ring-primary/20 sm:h-14 sm:text-2xl"
                />
              </div>
            </div>

            {/* Arrow with growth percentage */}
            <div className="flex flex-col items-center justify-center gap-1 py-2">
              <div className={cn(
                "flex items-center justify-center w-14 h-14 rounded-full text-white font-bold text-base sm:w-16 sm:h-16 sm:text-lg",
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
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-lg text-muted-foreground sm:text-xl">$</span>
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
                    "w-full h-12 pl-10 pr-4 text-xl font-semibold rounded-lg border focus:ring-2 sm:h-14 sm:text-2xl",
                    isPositiveGrowth 
                      ? "bg-green-50 border-green-200 focus:ring-green-200 dark:bg-green-950/30 dark:border-green-800" 
                      : "bg-red-50 border-red-200 focus:ring-red-200 dark:bg-red-950/30 dark:border-red-800"
                  )}
                />
              </div>
            </div>
          </div>

          {/* Growth slider */}
          <div className="mt-4 space-y-3 sm:mt-6">
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
                  "transition-all hover:scale-105 min-h-10",
                  Math.abs(growthPct / 100 - preset.value) < 0.05 && "ring-2 ring-primary"
                )}
              >
                {preset.label}
              </Button>
            ))}
          </div>

          {/* Write-back bridge: push the explored scenario into the offer */}
          <div className="mt-3">
            <Button
              onClick={saveScenarioToOffer}
              variant={saveFlash !== null ? "default" : "secondary"}
              className="w-full min-h-10"
            >
              {saveFlash !== null
                ? `Saved ✓ ${formatAnnualRate(saveFlash)} to offer`
                : "Save scenario to offer"}
            </Button>
            {saveFlash === null && (
              <p className="mt-1.5 text-[11px] text-muted-foreground">
                Writes this price path into the offer&apos;s equity growth assumptions.
              </p>
            )}
          </div>
        </div>

        <HistoricalGrowth onApplyCagr={applyHistoricalCagr} />
        <p className="text-xs text-muted-foreground">
          Apply 5y CAGR compounds the realized 5-year annual rate over your{' '}
          {offer.assumptions?.horizonYears ?? 4}-year projection horizon.
        </p>

        {/* Results summary cards */}
        <div className="grid grid-cols-2 gap-2.5 sm:gap-4 lg:grid-cols-4">
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
        <div className="grid gap-4 sm:gap-6 lg:grid-cols-2">
          <div className="rounded-lg border bg-card p-3 sm:p-4">
            <h3 className="text-sm font-medium mb-2 sm:mb-3">Total Compensation by Year</h3>
            <ReactEChartsCore option={compChartOptions.totals} style={{ height: chartH, width: '100%' }} />
          </div>
          <div className="rounded-lg border bg-card p-3 sm:p-4">
            <h3 className="text-sm font-medium mb-2 sm:mb-3">Equity Value by Year</h3>
            <ReactEChartsCore option={compChartOptions.stock} style={{ height: chartH, width: '100%' }} />
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
            <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 p-4 rounded-lg bg-muted/30">
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
            </div>
          )}
        </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

// Per-company card in compare mode: realized 5y CAGR + one-tap load into the
// single-company scenario (which the Save-to-offer bridge then picks up).
function CompareCompanyCard({
  ticker,
  stats,
  onUseRate,
}: {
  ticker: string;
  stats: HistoryStats | null;
  onUseRate: (cagr: number) => void;
}) {
  const cagr = stats?.cagr5y;
  const hasCagr = cagr != null && Number.isFinite(cagr);
  const pos = (cagr ?? 0) >= 0;
  return (
    <div className="rounded-lg border p-3 sm:p-4">
      <div className="text-sm font-bold tracking-wide">{ticker}</div>
      {stats ? (
        <>
          <div
            className={cn(
              'mt-1 text-xl font-bold tabular-nums sm:text-2xl',
              hasCagr
                ? pos
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : 'text-red-600 dark:text-red-400'
                : 'text-muted-foreground',
            )}
          >
            {hasCagr ? `${pos ? '+' : ''}${(cagr * 100).toFixed(1)}%` : 'n/a'}
          </div>
          <div className="text-[11px] text-muted-foreground">5y CAGR</div>
          <div className="mt-1 text-[11px] tabular-nums text-muted-foreground">
            ${stats.latestPrice.toFixed(2)} · {stats.latestDate}
          </div>
          {hasCagr && (
            <Button
              type="button"
              size="sm"
              variant="secondary"
              className="mt-2 min-h-9 w-full"
              onClick={() => onUseRate(cagr)}
            >
              Use this rate
            </Button>
          )}
        </>
      ) : (
        <div className="mt-1 text-xs text-muted-foreground">No data loaded.</div>
      )}
    </div>
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
      "rounded-lg border p-3 transition-all sm:p-4",
      highlight && "ring-2 ring-primary/20 bg-primary/5"
    )}>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-lg font-bold mt-1 tabular-nums sm:text-2xl">{formatCurrency(Math.round(value))}</div>
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
