"use client";
import React, { useCallback, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { useStore } from '@/state/store';
import { computeOffer } from '@/core/compute';
import { formatCurrency } from '@/lib/utils';
import { CurrencyInput } from '@/components/ui/currency-input';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import ReactEChartsCore from 'echarts-for-react';

// Simple equity exploration: enter price today and a target price, compare comp growth
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

  const round2 = (x: number) => Math.round(x * 100) / 100;
  const growthPct = currentPrice > 0 ? ((targetPrice / currentPrice) - 1) * 100 : 0;
  const sliderValue = isFinite(growthPct) ? Math.max(-90, Math.min(500, Math.round(growthPct))) : 0;

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

  return (
    <Card>
      <CardHeader>
        <CardTitle>Equity Explorer</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end">
          <div>
            <Label>Price today ($/share)</Label>
            <CurrencyInput value={currentPrice} onValueChange={setCurrentPrice} />
            <div className="text-xs text-muted-foreground mt-1">Baseline uses this price only</div>
          </div>
          <div>
            <Label>Target price ($/share)</Label>
            <CurrencyInput value={targetPrice} onValueChange={(v) => {
              setTargetPrice(v);
              if (valuationToday > 0 && currentPrice > 0) {
                setProjectedValuation(Math.round(valuationToday * (v / currentPrice)));
              }
            }} />
            <div className="text-xs text-muted-foreground mt-1">Change to see new comp at this price</div>
          </div>
          <div className="flex flex-wrap items-end gap-2">
            <Button variant="secondary" onClick={() => setTargetPrice(Math.round(currentPrice * 1.1 * 100) / 100)}>+10%</Button>
            <Button variant="secondary" onClick={() => setTargetPrice(Math.round(currentPrice * 1.25 * 100) / 100)}>+25%</Button>
            <Button variant="secondary" onClick={() => setTargetPrice(Math.round(currentPrice * 1.5 * 100) / 100)}>+50%</Button>
            <Button variant="secondary" onClick={() => setTargetPrice(Math.round(currentPrice * 2 * 100) / 100)}>2×</Button>
            <Button variant="secondary" onClick={() => setTargetPrice(Math.round(currentPrice * 3 * 100) / 100)}>3×</Button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end">
          <div>
            <Label>Computation method</Label>
            <select
              className="border rounded px-2 py-2 w-full"
              value={mode}
              onChange={(e) => setMode((e.target.value as 'multiplier'|'price'))}
            >
              <option value="multiplier">Multiply equity only</option>
              <option value="price">Recompute from price</option>
            </select>
            <div className="text-xs text-muted-foreground mt-1">Multiplier scales only the stock portion by growth</div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end">
          <div>
            <Label>Company value today</Label>
            <CurrencyInput value={valuationToday} onValueChange={(v) => {
              // Preserve current growth% if possible
              setValuationToday(v);
              const ratio = currentPrice > 0 ? targetPrice / currentPrice : 1;
              setProjectedValuation(Math.round(v * ratio));
            }} />
            <div className="text-xs text-muted-foreground mt-1">Market cap or valuation estimate</div>
          </div>
          <div>
            <Label>Projected value</Label>
            <CurrencyInput value={projectedValuation} onValueChange={(v) => {
              setProjectedValuation(v);
              if (valuationToday > 0) {
                const ratio = v / valuationToday;
                setTargetPrice(round2(currentPrice * ratio));
              }
            }} />
            <div className="text-xs text-muted-foreground mt-1">Sets target price proportionally</div>
          </div>
          <div className="px-2">
            <Label>Growth (%)</Label>
            <div className="mt-2">
              <Slider
                value={[sliderValue]}
                min={-90}
                max={500}
                step={1}
                onValueChange={(v) => {
                  const pct = v[0] / 100;
                  const ratio = 1 + pct;
                  setTargetPrice(round2(currentPrice * ratio));
                  setProjectedValuation(Math.round(valuationToday * ratio));
                }}
              />
              <div className="text-xs text-muted-foreground mt-1">{Math.round(sliderValue)}% vs today</div>
            </div>
          </div>
        </div>

    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="p-4 rounded border">
            <div className="text-xs text-muted-foreground">Year 1 equity</div>
      <div className="text-xl sm:text-2xl font-semibold">{formatCurrency(Math.round(y1Target?.stock ?? 0))}</div>
            <div className="text-xs text-muted-foreground mt-1">Baseline: {formatCurrency(Math.round(y1?.stock ?? 0))} ({y1?.stock ? Math.round((y1StockDelta / y1.stock) * 100) : 0}%)</div>
          </div>
          <div className="p-4 rounded border">
            <div className="text-xs text-muted-foreground">Year 1 total comp</div>
      <div className="text-xl sm:text-2xl font-semibold">{formatCurrency(Math.round(y1Target?.total ?? 0))}</div>
            <div className="text-xs text-muted-foreground mt-1">Baseline: {formatCurrency(Math.round(y1?.total ?? 0))} ({y1?.total ? Math.round((y1TotalDelta / y1.total) * 100) : 0}%)</div>
          </div>
          <div className="p-4 rounded border">
            <div className="text-xs text-muted-foreground">4-year equity total</div>
      <div className="text-xl sm:text-2xl font-semibold">{formatCurrency(Math.round(totalStockTarget))}</div>
            <div className="text-xs text-muted-foreground mt-1">Baseline: {formatCurrency(Math.round(totalStockCurrent))} ({totalStockCurrent ? Math.round(((totalStockTarget - totalStockCurrent) / totalStockCurrent) * 100) : 0}%)</div>
          </div>
        </div>

    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="p-4 rounded border">
            <div className="text-xs text-muted-foreground">4-year total comp</div>
      <div className="text-xl sm:text-2xl font-semibold">{formatCurrency(Math.round(totalCompTarget))}</div>
            <div className="text-xs text-muted-foreground mt-1">Baseline: {formatCurrency(Math.round(totalCompCurrent))} ({totalCompCurrent ? Math.round(((totalCompTarget - totalCompCurrent) / totalCompCurrent) * 100) : 0}%)</div>
          </div>
      <div className="p-4 rounded border sm:col-span-2 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div>
              <div className="text-xs text-muted-foreground">Apply modeled price to offer</div>
              <div className="text-sm text-muted-foreground">Sets Growth → Starting price to {formatCurrency(targetPrice, { decimals: 2 })}</div>
            </div>
            <Button
              onClick={() => {
                const next = { ...offer, growth: { ...(offer.growth ?? { yoy: [0,0,0,0] }), startingPrice: Math.max(0.01, targetPrice) } };
                setOffer(next);
              }}
            >Apply</Button>
          </div>
        </div>

        {(() => {
          const fmt = (n: number) => formatCurrency(Math.round(n));
          const cats = rowsCurrent.map(r => `Y${r.year}`);
          const totalsCurrent = rowsCurrent.map(r => Math.round(r.total));
          const totalsTarget = rowsTargetDisplay.map(r => Math.round(r.total));
          const stockCurrent = rowsCurrent.map(r => Math.round(r.stock));
          const stockTarget = rowsTargetDisplay.map(r => Math.round(r.stock));
          const optionTotals = {
            tooltip: { trigger: 'axis', valueFormatter: (v: number) => fmt(v) },
            legend: { data: ['Baseline Total', 'Target Total'] },
            xAxis: { type: 'category', data: cats },
            yAxis: { type: 'value' },
            series: [
              { name: 'Baseline Total', type: 'bar', data: totalsCurrent, itemStyle: { color: '#94a3b8' } },
              { name: 'Target Total', type: 'bar', data: totalsTarget, itemStyle: { color: '#2563eb' } },
            ],
          } as const;
          const optionStock = {
            tooltip: { trigger: 'axis', valueFormatter: (v: number) => fmt(v) },
            legend: { data: ['Baseline Stock', 'Target Stock'] },
            xAxis: { type: 'category', data: cats },
            yAxis: { type: 'value' },
            series: [
              { name: 'Baseline Stock', type: 'bar', data: stockCurrent, itemStyle: { color: '#f59e0b' }, barGap: '30%' },
              { name: 'Target Stock', type: 'bar', data: stockTarget, itemStyle: { color: '#d97706' } },
            ],
          } as const;
          return (
      <div className="grid grid-cols-1 gap-4">
              <div>
                <div className="text-sm font-medium mb-2">Total compensation: baseline vs target</div>
        <ReactEChartsCore option={optionTotals} style={{ height: 260, width: '100%' }} />
              </div>
              <div>
                <div className="text-sm font-medium mb-2">Equity value: baseline vs target</div>
        <ReactEChartsCore option={optionStock} style={{ height: 260, width: '100%' }} />
              </div>
            </div>
          );
        })()}
      </CardContent>
    </Card>
  );
}
