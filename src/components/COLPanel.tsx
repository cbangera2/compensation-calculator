"use client";
import { useMemo, useState } from 'react';
import { useStore } from '@/state/store';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import ReactEChartsCore from 'echarts-for-react';
import { computeOffer } from '@/core/compute';

const CITY_PRESETS: { key: string; name: string; factor: number }[] = [
  { key: 'sf', name: 'San Francisco, CA', factor: 1.40 },
  { key: 'nyc', name: 'New York, NY', factor: 1.35 },
  { key: 'sea', name: 'Seattle, WA', factor: 1.18 },
  { key: 'mtv', name: 'Mountain View, CA', factor: 1.25 },
  { key: 'aus', name: 'Austin, TX', factor: 1.05 },
  { key: 'remote', name: 'Remote (US avg)', factor: 0.95 },
];

const WEIGHTS = { housing: 0.35, food: 0.15, transport: 0.10, other: 0.40 } as const;

function fmt(n: number) {
  return `$${Math.round(n).toLocaleString()}`;
}

export default function COLPanel() {
  const { offer, setOffer } = useStore();
  const currentCOL = offer.assumptions?.colAdjust ?? 1;

  const [cityKey, setCityKey] = useState<string>('');
  const [customFactor, setCustomFactor] = useState<number | ''>('');
  const [fromCity, setFromCity] = useState<string>('');
  const [toCity, setToCity] = useState<string>('');
  const [fromCustom, setFromCustom] = useState<number | ''>('');
  const [toCustom, setToCustom] = useState<number | ''>('');
  const [deltaHousing, setDeltaHousing] = useState<number>(0);
  const [deltaFood, setDeltaFood] = useState<number>(0);
  const [deltaTransport, setDeltaTransport] = useState<number>(0);

  const presetFactor = CITY_PRESETS.find(c => c.key === cityKey)?.factor;
  const baseTarget = (customFactor === '' ? undefined : Number(customFactor)) ?? presetFactor ?? currentCOL;
  const weightedDelta = (WEIGHTS.housing * (deltaHousing / 100)) + (WEIGHTS.food * (deltaFood / 100)) + (WEIGHTS.transport * (deltaTransport / 100));
  const projectedFactor = Math.max(0, baseTarget * (1 + weightedDelta));

  // City-to-city equivalent base
  const fromFactor = (fromCustom === '' ? undefined : Number(fromCustom)) ?? CITY_PRESETS.find(c => c.key === fromCity)?.factor ?? currentCOL;
  const toFactor = (toCustom === '' ? undefined : Number(toCustom)) ?? CITY_PRESETS.find(c => c.key === toCity)?.factor ?? currentCOL;
  const equivalentBase = useMemo(() => offer.base.startAnnual * (toFactor / Math.max(0.0001, fromFactor)), [offer.base.startAnnual, fromFactor, toFactor]);
  const equivRows = useMemo(() => computeOffer({ ...offer, base: { startAnnual: equivalentBase }, assumptions: { ...(offer.assumptions ?? { horizonYears: 4, colAdjust: 1 }), colAdjust: toFactor } }), [offer, equivalentBase, toFactor]);
  const equivY1 = equivRows[0];
  const equiv4y = equivRows.reduce((a, r) => a + r.total, 0);

  const currentRows = useMemo(() => computeOffer(offer), [offer]);
  const projectedRows = useMemo(() => computeOffer({ ...offer, assumptions: { ...(offer.assumptions ?? { horizonYears: 4, colAdjust: 1 }), colAdjust: projectedFactor } }), [offer, projectedFactor]);

  const curY1 = currentRows[0];
  const projY1 = projectedRows[0];
  const curTotal4y = currentRows.reduce((a, r) => a + r.total, 0);
  const projTotal4y = projectedRows.reduce((a, r) => a + r.total, 0);

  const colBarOption = {
    tooltip: { trigger: 'axis' },
    legend: { data: ['Current', 'Projected'] },
    xAxis: { type: 'category', data: ['Base Y1', 'Bonus Y1', 'Stock Y1', 'Other Y1', 'Total Y1', 'Total 4y'] },
    yAxis: { type: 'value' },
    series: [
      { name: 'Current', type: 'bar', data: [curY1.base, curY1.bonus, curY1.stock, curY1.other, curY1.total, curTotal4y].map(Math.round) },
      { name: 'Projected', type: 'bar', data: [projY1.base, projY1.bonus, projY1.stock, projY1.other, projY1.total, projTotal4y].map(Math.round) },
    ],
  } as const;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Cost of Living (COL)</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="space-y-4">
            <div>
              <Label>Current COL (×)</Label>
              <Input
                type="number"
                step="0.05"
                value={currentCOL}
                onChange={(e) =>
                  setOffer({
                    ...offer,
                    assumptions: { ...(offer.assumptions ?? { horizonYears: 4, colAdjust: 1 }), colAdjust: Number(e.target.value || '1') },
                  })
                }
              />
              <p className="text-xs text-muted-foreground mt-1">Applies to base, one-time cash, and perks (not stock).</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Target city</Label>
                <select className="border rounded px-2 py-2 w-full" value={cityKey} onChange={(e) => setCityKey(e.target.value)}>
                  <option value="">Custom</option>
                  {CITY_PRESETS.map(c => (
                    <option key={c.key} value={c.key}>{c.name} ({c.factor.toFixed(2)}×)</option>
                  ))}
                </select>
              </div>
              <div>
                <Label>Target COL (×)</Label>
                <Input
                  type="number"
                  step="0.05"
                  placeholder={presetFactor ? String(presetFactor.toFixed(2)) : '1.00'}
                  value={customFactor}
                  onChange={(e) => setCustomFactor(e.target.value === '' ? '' : Number(e.target.value))}
                />
              </div>
            </div>
            <div>
              <Label>Category differences (vs current)</Label>
              <div className="grid grid-cols-3 gap-3 mt-2">
                <div>
                  <span className="text-xs text-muted-foreground">Housing</span>
                  <Input type="number" step="1" value={deltaHousing} onChange={(e) => setDeltaHousing(Number(e.target.value || '0'))} />
                </div>
                <div>
                  <span className="text-xs text-muted-foreground">Food</span>
                  <Input type="number" step="1" value={deltaFood} onChange={(e) => setDeltaFood(Number(e.target.value || '0'))} />
                </div>
                <div>
                  <span className="text-xs text-muted-foreground">Transport</span>
                  <Input type="number" step="1" value={deltaTransport} onChange={(e) => setDeltaTransport(Number(e.target.value || '0'))} />
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-1">Enter percent differences (+/-). Weights: Housing 35%, Food 15%, Transport 10%.</p>
            </div>
            <div>
              <Label>Projected COL factor</Label>
              <div className="mt-1 text-lg">{projectedFactor.toFixed(2)}×</div>
              <Button className="mt-2" type="button" onClick={() => setOffer({ ...offer, assumptions: { ...(offer.assumptions ?? { horizonYears: 4, colAdjust: 1 }), colAdjust: projectedFactor } })}>Apply to offer</Button>
            </div>
            <div className="border-t pt-4">
              <Label>City-to-city comparison</Label>
              <div className="grid grid-cols-2 gap-3 mt-2">
                <div>
                  <span className="text-xs text-muted-foreground">From</span>
                  <select className="border rounded px-2 py-2 w-full" value={fromCity} onChange={(e) => setFromCity(e.target.value)}>
                    <option value="">Custom</option>
                    {CITY_PRESETS.map(c => (<option key={c.key} value={c.key}>{c.name} ({c.factor.toFixed(2)}×)</option>))}
                  </select>
                  <Input className="mt-1" type="number" step="0.05" placeholder="From COL" value={fromCustom} onChange={(e) => setFromCustom(e.target.value === '' ? '' : Number(e.target.value))} />
                </div>
                <div>
                  <span className="text-xs text-muted-foreground">To</span>
                  <select className="border rounded px-2 py-2 w-full" value={toCity} onChange={(e) => setToCity(e.target.value)}>
                    <option value="">Custom</option>
                    {CITY_PRESETS.map(c => (<option key={c.key} value={c.key}>{c.name} ({c.factor.toFixed(2)}×)</option>))}
                  </select>
                  <Input className="mt-1" type="number" step="0.05" placeholder="To COL" value={toCustom} onChange={(e) => setToCustom(e.target.value === '' ? '' : Number(e.target.value))} />
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-1">Equivalent base to match purchasing power in target city:</p>
              <div className="text-lg">{fmt(equivalentBase)}</div>
            </div>
          </div>
          <div className="space-y-4">
            <div>
              <Label>Year 1 comparison</Label>
              <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
                <div className="text-muted-foreground">Base (COL-adjusted)</div>
                <div>{fmt(curY1.base)} → <b>{fmt(projY1.base)}</b></div>
                <div className="text-muted-foreground">One-time & perks (COL-adjusted)</div>
                <div>{fmt(curY1.other)} → <b>{fmt(projY1.other)}</b></div>
                <div className="text-muted-foreground">Bonus</div>
                <div>{fmt(curY1.bonus)} → <b>{fmt(projY1.bonus)}</b></div>
                <div className="text-muted-foreground">Stock</div>
                <div>{fmt(curY1.stock)} → <b>{fmt(projY1.stock)}</b></div>
                <div className="text-muted-foreground">Total</div>
                <div>{fmt(curY1.total)} → <b>{fmt(projY1.total)}</b></div>
              </div>
            </div>
            <div>
              <Label>4-year total</Label>
              <div className="mt-1 text-lg">{fmt(curTotal4y)} → <b>{fmt(projTotal4y)}</b></div>
              <p className="text-xs text-muted-foreground">Stock is unchanged by COL; base, one-time, and perks scale.</p>
            </div>
            <div>
              <Label>Target city totals (equivalent base)</Label>
              <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
                <div className="text-muted-foreground">Year 1 total</div>
                <div><b>{fmt(equivY1.total)}</b></div>
                <div className="text-muted-foreground">4-year total</div>
                <div><b>{fmt(equiv4y)}</b></div>
              </div>
            </div>
          </div>
          <div className="lg:col-span-2">
            <ReactEChartsCore option={colBarOption} style={{ height: 300 }} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
