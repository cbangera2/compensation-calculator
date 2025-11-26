"use client";
import { useMemo, useState } from 'react';
import ReactEChartsCore from 'echarts-for-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useStore } from '@/state/store';
import { computeOffer } from '@/core/compute';
import { formatCurrency } from '@/lib/utils';
import { Button } from '@/components/ui/button';

export default function ComparisonChart() {
  const { offers, activeIndex } = useStore();
  const [showPurchasingPower, setShowPurchasingPower] = useState(false);

  const rowsPerOffer = useMemo(() => 
    (offers || []).map((o) => computeOffer(o)),
    [offers]
  );

  // Calculate purchasing power data for the summary cards
  const ppData = useMemo(() => {
    return (offers || []).map((offer, idx) => {
      const colFactor = offer.colFactor ?? 1;
      const rows = rowsPerOffer[idx] || [];
      const y1Total = rows[0]?.total ?? 0;
      const total4y = rows.reduce((a, r) => a + r.total, 0);
      const ppY1 = y1Total / colFactor;
      const pp4y = total4y / colFactor;
      return {
        name: offer.name || `Offer ${idx + 1}`,
        location: offer.location || `${colFactor.toFixed(2)}× COL`,
        colFactor,
        nominalY1: y1Total,
        nominal4y: total4y,
        ppY1,
        pp4y,
        index: idx,
      };
    });
  }, [offers, rowsPerOffer]);

  // Sort by purchasing power for ranking
  const ranked = useMemo(() => 
    [...ppData].sort((a, b) => b.ppY1 - a.ppY1),
    [ppData]
  );
  
  if (!offers || offers.length < 2) return null;

  const horizon = Math.max(...rowsPerOffer.map(r => r.length));
  const years = Array.from({ length: horizon }, (_, i) => `Y${i + 1}`);
  const fmt = (n: number) => formatCurrency(Math.round(n));
  const chartKey = `${offers.length}:${offers.map(o => o.name || '').join('|')}:${horizon}:${showPurchasingPower}`;

  // Prepare per-offer arrays for stacked series
  // If showPurchasingPower, divide values by colFactor
  const byOffer = rowsPerOffer.map((rows, i) => {
    const colFactor = offers[i]?.colFactor ?? 1;
    const divisor = showPurchasingPower ? colFactor : 1;
    return {
      base: Array.from({ length: horizon }, (_, y) => Math.round((rows[y]?.base ?? 0) / divisor)),
      bonus: Array.from({ length: horizon }, (_, y) => Math.round((rows[y]?.bonus ?? 0) / divisor)),
      stock: Array.from({ length: horizon }, (_, y) => Math.round((rows[y]?.stock ?? 0) / divisor)),
      other: Array.from({ length: horizon }, (_, y) => Math.round((rows[y]?.other ?? 0) / divisor)),
      total: Array.from({ length: horizon }, (_, y) => Math.round((rows[y]?.total ?? 0) / divisor)),
    };
  });

  const totals = byOffer.map(b => b.total.reduce((a, v) => a + v, 0));

  const maxPP = Math.max(...ppData.map(o => o.ppY1), 1);

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

        const lines: string[] = [`<div><strong>${year}</strong>${showPurchasingPower ? ' (Purchasing Power)' : ''}</div>`];
        Object.keys(grouped).sort((a, b) => Number(a) - Number(b)).forEach((key) => {
          const offerIdx = Number(key);
          const { base, bonus, stock, other } = grouped[offerIdx];
          const name = offers[offerIdx]?.name || `Offer ${offerIdx + 1}`;
          const loc = offers[offerIdx]?.location;
          const total = byOffer[offerIdx]?.total[dataIndex] ?? base + bonus + stock + other;
          lines.push(`<div style="margin-top:4px;"><strong>${name}</strong>${loc ? ` (${loc})` : ''} — Total ${fmt(total)}</div>`);
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

  // Check if there's an interesting insight (lower nominal but higher PP)
  const hasInsight = ranked.length >= 2 && ranked[0].nominalY1 < ranked[ranked.length - 1].nominalY1;

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <CardTitle>Offer Comparison</CardTitle>
            <CardDescription className="mt-1">
              {showPurchasingPower 
                ? 'Showing purchasing power (adjusted for cost of living)'
                : 'Showing nominal compensation'}
            </CardDescription>
          </div>
          <Button 
            variant={showPurchasingPower ? 'default' : 'outline'} 
            size="sm"
            onClick={() => setShowPurchasingPower(v => !v)}
          >
            {showPurchasingPower ? '💰 Purchasing Power' : '💵 Show Purchasing Power'}
          </Button>
        </div>
        <div className="text-sm text-muted-foreground flex flex-wrap gap-4 mt-2">
          {offers.map((o, i) => (
            <div key={i} className={i === activeIndex ? 'font-medium' : ''}>
              {o.name || `Offer ${i + 1}`}: <span className="font-medium">{fmt(totals[i])}</span>
              {showPurchasingPower && <span className="text-xs text-muted-foreground"> PP</span>}
            </div>
          ))}
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <ReactEChartsCore key={chartKey} option={option} notMerge style={{ height: 360 }} />
        
        {/* Purchasing Power Ranking */}
        <div className="rounded-lg border border-green-200 dark:border-green-900 bg-green-50 dark:bg-green-950/30 p-4">
          <h4 className="text-sm font-semibold text-green-800 dark:text-green-200 mb-3">
            🏆 Purchasing Power Ranking (Year 1)
          </h4>
          <div className="space-y-2">
            {ranked.map((data, rank) => {
              const pctOfMax = (data.ppY1 / maxPP) * 100;
              const diff = data.ppY1 - ranked[0].ppY1;
              
              return (
                <div key={data.index} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2">
                      <span className={`font-bold ${rank === 0 ? 'text-green-600 dark:text-green-400' : 'text-muted-foreground'}`}>
                        #{rank + 1}
                      </span>
                      <span className="font-medium">{data.name}</span>
                      <span className="text-xs text-muted-foreground">({data.location})</span>
                    </span>
                    <div className="text-right">
                      <span className={`font-semibold ${rank === 0 ? 'text-green-600 dark:text-green-400' : ''}`}>
                        {fmt(data.ppY1)}
                      </span>
                      <span className="text-xs text-muted-foreground ml-2">
                        (nominal {fmt(data.nominalY1)})
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                      <div 
                        className={`h-full rounded-full ${rank === 0 ? 'bg-green-500' : 'bg-gray-400'}`}
                        style={{ width: `${pctOfMax}%` }}
                      />
                    </div>
                    {rank > 0 && (
                      <span className="text-xs text-red-500 w-20 text-right">
                        -{fmt(Math.abs(diff))}
                      </span>
                    )}
                    {rank === 0 && <span className="w-20" />}
                  </div>
                </div>
              );
            })}
          </div>
          
          {/* Insight callout */}
          {hasInsight && (
            <div className="mt-4 pt-3 border-t border-green-200 dark:border-green-800">
              <p className="text-sm text-green-800 dark:text-green-200">
                <span className="font-semibold">💡 Insight:</span> Even though{' '}
                <strong>{ranked[0].name}</strong> has a lower nominal salary ({fmt(ranked[0].nominalY1)}) 
                than <strong>{ranked[ranked.length - 1].name}</strong> ({fmt(ranked[ranked.length - 1].nominalY1)}), 
                it provides <strong>{fmt(ranked[0].ppY1 - ranked[ranked.length - 1].ppY1)} more</strong> in 
                purchasing power due to the lower cost of living.
              </p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
