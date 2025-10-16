"use client";
import { useStore } from '@/state/store';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { buildPricePath, yoyFromCagr, yoyFromRamp } from '@/core/growth';
import { useMemo, useState } from 'react';

export default function GrowthYoyEditor() {
  const { offer, setOffer, setYoY } = useStore();
  const years = offer.assumptions?.horizonYears ?? 4;
  const yoy = offer.growth?.yoy ?? Array.from({ length: years }, () => 0);
  const startingPrice = offer.growth?.startingPrice ?? offer.equityGrants?.[0]?.fmv ?? 10;
  const [advancedOpen, setAdvancedOpen] = useState(false);

  const preview = useMemo(() => buildPricePath(startingPrice, yoy, years), [startingPrice, yoy, years]);

  function update(idx: number, value: number) {
    const next = [...yoy];
    next[idx] = value;
    setYoY(next);
  }

  function setAllYoY(value: number) {
    setYoY(Array.from({ length: years }, () => value));
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3">
        <div className="md:col-span-1">
          <Label htmlFor="starting-price" className="text-sm font-medium">
            Starting Price
          </Label>
          <Input
            id="starting-price"
            type="number"
            step="0.01"
            value={startingPrice}
            onChange={(e) => setOffer({
              ...offer,
              growth: { ...(offer.growth ?? { yoy: Array.from({ length: years }, () => 0) }), startingPrice: Number(e.target.value || '0') },
            })}
            className="mt-1"
          />
          <p className="text-xs text-muted-foreground mt-1">Current FMV ($)</p>
        </div>
        {Array.from({ length: years }).map((_, i) => (
          <div key={i}>
            <Label htmlFor={`yoy-${i}`} className="text-sm font-medium">
              Year {i + 1} Growth
            </Label>
            <div className="relative mt-1">
              <Input
                id={`yoy-${i}`}
                type="number"
                step="0.1"
                value={(yoy[i] ?? 0) * 100}
                onChange={(e) => update(i, Number(e.target.value) / 100)}
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground pointer-events-none">
                %
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Price: ${preview[i + 1]?.toFixed(2) ?? '—'}
            </p>
          </div>
        ))}
      </div>

      <div className="space-y-2">
        <p className="text-xs font-medium text-muted-foreground">Quick Scenarios:</p>
        <div className="flex flex-wrap gap-2">
          <Button type="button" size="sm" onClick={() => setAllYoY(0.1)}>
            📈 Optimistic +10%
          </Button>
          <Button type="button" size="sm" variant="secondary" onClick={() => setAllYoY(0.05)}>
            → Steady +5%
          </Button>
          <Button type="button" size="sm" variant="secondary" onClick={() => setAllYoY(0)}>
            ➡️ Flat 0%
          </Button>
          <Button type="button" size="sm" variant="secondary" onClick={() => setAllYoY(-0.1)}>
            📉 Bearish −10%
          </Button>
        </div>
      </div>

      <div className="pt-2 border-t">
        <button
          type="button"
          onClick={() => setAdvancedOpen((v) => !v)}
          className="flex items-center gap-2 text-sm font-medium hover:underline"
        >
          {advancedOpen ? '▼' : '▶'} Advanced Growth Patterns
        </button>
        
        {advancedOpen && (
          <div className="mt-3 space-y-3 pl-4">
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-2">Complex Scenarios:</p>
              <div className="flex flex-wrap gap-2">
                <Button type="button" size="sm" variant="outline" onClick={() => setYoY(yoyFromCagr(0.15, years))}>
                  🚀 Bull Market +15% CAGR
                </Button>
                <Button type="button" size="sm" variant="outline" onClick={() => setYoY(yoyFromRamp(0.2, 0.05, years))}>
                  📉 Growth Slowdown 20%→5%
                </Button>
                <Button type="button" size="sm" variant="outline" onClick={() => setYoY(yoyFromRamp(-0.1, 0.05, years))}>
                  💪 Recovery −10%→+5%
                </Button>
              </div>
            </div>
            <div className="bg-muted/50 rounded p-3">
              <p className="text-xs font-medium mb-1">Price Preview:</p>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs">
                {preview.map((p, i) => (
                  <div key={i} className="flex justify-between">
                    <span className="font-medium">{i === 0 ? 'Start:' : `Y${i}:`}</span>
                    <span className="font-mono">${p.toFixed(2)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
