"use client";
import { useStore } from '@/state/store';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Stock Growth (YoY) and starting price</CardTitle>
          <Button type="button" variant="secondary" onClick={() => setAdvancedOpen((v) => !v)}>
            {advancedOpen ? 'Hide options' : 'More options'}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div>
            <Label htmlFor={`starting-price`}>Starting price ($)</Label>
            <Input
              id={`starting-price`}
              type="number"
              step="0.01"
              value={startingPrice}
              onChange={(e) => setOffer({
                ...offer,
                growth: { ...(offer.growth ?? { yoy: Array.from({ length: years }, () => 0) }), startingPrice: Number(e.target.value || '0') },
              })}
            />
          </div>
          {Array.from({ length: years }).map((_, i) => (
            <div key={i}>
              <Label htmlFor={`yoy-${i}`}>Y{i + 1} (%)</Label>
              <Input
                id={`yoy-${i}`}
                type="number"
                step="0.1"
                value={(yoy[i] ?? 0) * 100}
                onChange={(e) => update(i, Number(e.target.value) / 100)}
              />
            </div>
          ))}
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button type="button" onClick={() => setAllYoY(0.1)}>Base +10%</Button>
          <Button type="button" onClick={() => setAllYoY(-0.1)} variant="secondary">Bear −10%</Button>
          <Button type="button" onClick={() => setAllYoY(0)} variant="secondary">Flat 0%</Button>
        </div>

        {advancedOpen && (
          <div className="mt-4 space-y-3">
            <div className="flex flex-wrap items-end gap-2">
              <Label className="mr-2">Presets:</Label>
              <Button type="button" variant="secondary" onClick={() => setYoY(yoyFromCagr(0.15, years))}>Bull +15% CAGR</Button>
              <Button type="button" variant="secondary" onClick={() => setYoY(yoyFromRamp(0.2, 0.05, years))}>Decel 20%→5%</Button>
              <Button type="button" variant="secondary" onClick={() => setYoY(yoyFromRamp(-0.1, 0.05, years))}>Recovery −10%→5%</Button>
            </div>
            <div className="text-xs text-muted-foreground">
              Preview: {preview.map((p, i) => `${i === 0 ? 'Start' : `Y${i}`}: $${p.toFixed(2)}`).join('  ·  ')}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
