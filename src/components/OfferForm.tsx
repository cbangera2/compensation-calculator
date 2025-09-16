"use client";
import { useEffect } from 'react';
import { useStore } from '@/state/store';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import GrowthYoyEditor from '@/components/GrowthYoyEditor';
import GrantsPanel from '@/components/GrantsPanel';
import RaisesEditor from '@/components/RaisesEditor';
import CashPerksPanel from '@/components/CashPerksPanel';
import { CurrencyInput } from '@/components/ui/currency-input';

// PresetLoader removed; defaults can now be imported on demand from Import/Export.

export default function OfferForm() {
  const { offer, setOffer, setBonusValue, undo, redo, addGrant, updateGrant } = useStore();

  // Keyboard shortcuts: Cmd+Z / Shift+Cmd+Z
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const meta = e.metaKey || e.ctrlKey;
      if (!meta) return;
      if (e.key.toLowerCase() === 'z' && !e.shiftKey) {
        e.preventDefault();
        undo();
      } else if ((e.key.toLowerCase() === 'z' && e.shiftKey) || (e.key.toLowerCase() === 'y')) {
        e.preventDefault();
        redo();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [undo, redo]);

  return (
    <Card>
      <CardHeader className="flex flex-col gap-2">
        <div className="flex items-center justify-between">

          <CardTitle>Offer Details</CardTitle>
          <div className="flex items-center gap-2">
            <Button type="button" variant="secondary" onClick={undo} aria-label="Undo">Undo</Button>
            <Button type="button" variant="secondary" onClick={redo} aria-label="Redo">Redo</Button>
          </div>
        </div>
        
      </CardHeader>
      <CardContent>
        <div className="grid gap-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="name">Company</Label>
              <Input id="name" value={offer.name}
                onChange={(e) => setOffer({ ...offer, name: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="startDate">Start date</Label>
              <Input id="startDate" type="date" value={offer.startDate}
                onChange={(e) => setOffer({ ...offer, startDate: e.target.value })}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <Label htmlFor="base.startAnnual">Base salary (annual)</Label>
              <CurrencyInput id="base.startAnnual" value={offer.base.startAnnual}
                onValueChange={(v) => setOffer({ ...offer, base: { ...offer.base, startAnnual: v } })}
                className="w-full"
              />
            </div>
            <div className="lg:col-span-2">
              <Label htmlFor="col-adjust">COL adjustment (×)</Label>
              <Input id="col-adjust" type="number" step="0.05" value={offer.assumptions?.colAdjust ?? 1}
                onChange={(e) => setOffer({ ...offer, assumptions: { ...(offer.assumptions ?? { horizonYears: 4, colAdjust: 1 }), colAdjust: Number(e.target.value || '1') } })}
              />
              <p className="text-xs text-muted-foreground">Applies to base, one-time cash, and perks. 1.0 = no change.</p>
            </div>
            <div className="col-span-1 md:col-span-2 lg:col-span-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>Bonus (percent or cash)</Label>
                  <div className="flex items-center gap-2">
                    <select
                      className="border rounded px-2 py-1"
                      value={offer.performanceBonus?.kind ?? 'percent'}
                      onChange={(e) => {
                        const nextKind = e.target.value as 'percent' | 'fixed';
                        const cur = offer.performanceBonus ?? { kind: 'percent', value: 0, expectedPayout: 1 };
                        const base = offer.base.startAnnual;
                        const converted = nextKind === 'percent'
                          ? (cur.kind === 'fixed' && base > 0 ? Math.min(1, cur.value / base) : cur.value)
                          : (cur.kind === 'percent' ? Math.round(cur.value * base) : cur.value);
                        setOffer({ ...offer, performanceBonus: { ...cur, kind: nextKind, value: converted } });
                      }}
                    >
                      <option value="percent">% of base</option>
                      <option value="fixed">$ cash</option>
                    </select>
                    <Input
                      type="number"
                      step={offer.performanceBonus?.kind === 'percent' ? 0.5 : 100}
                      value={offer.performanceBonus?.kind === 'percent' ? Math.round(((offer.performanceBonus?.value ?? 0) * 1000)) / 10 : (offer.performanceBonus?.value ?? 0)}
                      onChange={(e) => {
                        const v = Number(e.target.value || '0');
                        if ((offer.performanceBonus?.kind ?? 'percent') === 'percent') setBonusValue(v / 100);
                        else setBonusValue(v);
                      }}
                    />
                  </div>
                  <div className="mt-2">
                    <div className="flex items-center gap-3">
                      <Slider
                        value={[Number(offer.performanceBonus?.kind === 'percent' ? (offer.performanceBonus?.value ?? 0) * 100 : (offer.performanceBonus?.value ?? 0))]}
                        onValueChange={(v) => {
                          const raw = v[0];
                          if ((offer.performanceBonus?.kind ?? 'percent') === 'percent') setBonusValue(raw / 100);
                          else setBonusValue(raw);
                        }}
                        min={0}
                        max={offer.performanceBonus?.kind === 'percent' ? 50 : Math.max(10000, Math.ceil(offer.base.startAnnual * 0.25 / 500) * 500)}
                        step={offer.performanceBonus?.kind === 'percent' ? 0.5 : 500}
                      />
                      <span className="text-xs text-muted-foreground whitespace-nowrap">
                        {offer.performanceBonus?.kind === 'percent'
                          ? `${Math.round(((offer.performanceBonus?.value ?? 0) * 1000)) / 10}% (~$${Math.round(((offer.performanceBonus?.value ?? 0) * offer.base.startAnnual)).toLocaleString()})`
                          : `$${Math.round(offer.performanceBonus?.value ?? 0).toLocaleString()} (${Math.round((((offer.performanceBonus?.value ?? 0) / Math.max(1, offer.base.startAnnual)) * 1000)) / 10}%)`}
                      </span>
                    </div>
                  </div>
                </div>
                <div>
                  <Label htmlFor="performanceBonus.expectedPayout">Expected payout (x)</Label>
                  <Input id="performanceBonus.expectedPayout" type="number" step="0.1" value={offer.performanceBonus?.expectedPayout ?? 1}
                    onChange={(e) => {
                      const v = Number(e.target.value || '0');
                      const cur = offer.performanceBonus ?? { kind: 'percent', value: 0, expectedPayout: 1 };
                      setOffer({ ...offer, performanceBonus: { ...cur, expectedPayout: v } });
                    }}
                  />
                </div>
              </div>
            </div>
          </div>

          {
            <div className="grid grid-cols-3 gap-4">
              <div className="col-span-2">
                <Label>Stock grant by $</Label>
                <div className="flex items-center gap-2">
                  {(() => {
                    const grants = offer.equityGrants ?? [];
                    const idx = grants.findIndex(g => g.type === 'RSU');
                    const rsu = idx >= 0 ? grants[idx] : undefined;
                    const startingPrice = (offer.growth?.startingPrice ?? rsu?.fmv ?? 10);
                    const years = 4;
                    const ensureGrant = (patch: { targetValue?: number; targetMode?: 'year1'|'total' }) => {
                      if (idx >= 0) {
                        updateGrant(idx, patch);
                      } else {
                        addGrant({
                          type: 'RSU',
                          shares: 0,
                          fmv: startingPrice,
                          targetValue: (patch.targetValue as number) ?? 40000,
                          targetMode: (patch.targetMode as 'year1'|'total') ?? 'year1',
                          vesting: { model: 'standard', years, cliffMonths: 12, frequency: 'monthly', distribution: 'even', cliffPercent: 0 },
                        });
                      }
                    };
                    return (
                      <>
                        <CurrencyInput
                          placeholder="e.g., 60000"
                          value={rsu?.targetValue ?? 0}
                          onValueChange={(amt) => {
                            ensureGrant({ targetValue: amt });
                          }}
                          className="w-40"
                        />
                        <select
                          className="border rounded px-2 py-2"
                          value={rsu?.targetMode ?? 'year1'}
                          onChange={(e: React.ChangeEvent<HTMLSelectElement>) => {
                            const v = (e.target.value === 'total' ? 'total' : 'year1') as 'year1' | 'total';
                            ensureGrant({ targetMode: v });
                          }}
                        >
                          <option value="year1">1st year value</option>
                          <option value="total">4-year total</option>
                        </select>
                      </>
                    );
                  })()}
                </div>
                <p className="text-xs text-muted-foreground">Uses starting price or FMV to back-calc shares; standard 4y vesting.</p>
              </div>
            </div>
          }

          {
            <div className="grid grid-cols-3 gap-4">
              <div className="col-span-3">
                <Label>One-time bonuses</Label>
                {/* Mobile-first: single column; split to 2 cols on >= sm */}
                <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {(() => {
                    const signing = offer.signingBonuses ?? [];
                    const enabled = signing.length > 0;
                    const amount = signing[0]?.amount ?? 5000;
                    const payDate = signing[0]?.payDate ?? offer.startDate;
                    return (
                      // Stack label and input on mobile to avoid cramped layout
                      <div className="flex flex-col sm:flex-row items-start sm:items-end gap-2">
                        <div className="flex items-center gap-2 flex-1">
                          <input id="signing-enabled" type="checkbox" checked={enabled}
                            onChange={(e) => {
                              if (e.target.checked) {
                                if (!enabled) setOffer({ ...offer, signingBonuses: [{ amount, payDate }] });
                              } else {
                                if (enabled) setOffer({ ...offer, signingBonuses: signing.slice(1) });
                              }
                            }} />
                          <label htmlFor="signing-enabled" className="cursor-pointer">Signing bonus</label>
                        </div>
                        <div className="flex items-center gap-2 w-full sm:w-auto">
                          <span className="text-muted-foreground hidden sm:inline">$</span>
                          <CurrencyInput className="w-full sm:w-28" value={amount} disabled={!enabled}
                            onValueChange={(val) => {
                              if (!enabled) return;
                              const next = [...signing];
                              next[0] = { amount: val, payDate };
                              setOffer({ ...offer, signingBonuses: next });
                            }} />
                        </div>
                      </div>
                    );
                  })()}
                  {(() => {
                    const relocation = offer.relocationBonuses ?? [];
                    const enabled = relocation.length > 0;
                    const amount = relocation[0]?.amount ?? 5000;
                    const payDate = relocation[0]?.payDate ?? offer.startDate;
                    
                    return (
                      <div className="flex flex-col sm:flex-row items-start sm:items-end gap-2">
                        <div className="flex items-center gap-2 flex-1">
                          <input id="relocation-enabled" type="checkbox" checked={enabled}
                            onChange={(e) => {
                              if (e.target.checked) {
                                if (!enabled) setOffer({ ...offer, relocationBonuses: [{ amount, payDate }] });
                              } else {
                                if (enabled) setOffer({ ...offer, relocationBonuses: relocation.slice(1) });
                              }
                            }} />
                          <label htmlFor="relocation-enabled" className="cursor-pointer">Relocation bonus</label>
                        </div>
                        <div className="flex items-center gap-2 w-full sm:w-auto">
                          <span className="text-muted-foreground hidden sm:inline">$</span>
                          <CurrencyInput className="w-full sm:w-28" value={amount} disabled={!enabled}
                            onValueChange={(val) => {
                              if (!enabled) return;
                              const next = [...relocation];
                              next[0] = { amount: val, payDate };
                              setOffer({ ...offer, relocationBonuses: next });
                            }} />
                        </div>
                        
                      </div>
                    );
                  })()}
                </div>
  <p className="text-xs text-muted-foreground mt-1">For multiple payments, open the Cash, Bonuses & Perks section below.</p>
              </div>
            </div>
      }

          <div className="grid grid-cols-3 gap-4">
            <div className="col-span-3">
              <Label>Quick perks</Label>
              {/* Mobile-first: single column; split to 2 cols on >= sm */}
              <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-3">
                {[
                  { name: 'Free breakfast', annualValue: 2600 },
                  { name: 'Free lunch', annualValue: 2600 },
                  { name: 'Free dinner', annualValue: 2600 },
                  { name: 'Gym stipend', annualValue: 1200 },
                  { name: 'Learning stipend', annualValue: 1500 },
                  { name: 'Tuition', annualValue: 1500 },
                  { name: 'HSA', annualValue: 1000 },
                  { name: 'Other stipend', annualValue: 1500 },
                ].map((p) => {
                  const benefits = offer.benefits ?? [];
                  const idx = benefits.findIndex(b => b.name === p.name);
                  const current = idx >= 0 ? benefits[idx] : undefined;
                  const enabled = Boolean(current?.enabled);
                  const amount = current?.annualValue ?? p.annualValue;
                  return (
                    // Stack on mobile; align horizontally from sm
                    <div key={p.name} className="flex flex-col sm:flex-row items-start sm:items-center gap-2 text-sm">
                      <input
                        id={`perk-${p.name}`}
                        type="checkbox"
                        checked={enabled}
                        onChange={(e) => {
                          const next = [...benefits];
                          if (e.target.checked) {
                            if (idx >= 0) next[idx] = { ...next[idx], enabled: true, annualValue: amount };
                            else next.push({ name: p.name, annualValue: amount, enabled: true });
                          } else if (idx >= 0) {
                            next[idx] = { ...next[idx], enabled: false };
                          }
                          setOffer({ ...offer, benefits: next });
                        }}
                      />
                      <label htmlFor={`perk-${p.name}`} className="sm:flex-1 cursor-pointer">{p.name}</label>
                      <div className="flex items-center gap-1 w-full sm:w-auto">
                        <span className="text-muted-foreground hidden sm:inline">$</span>
                        <CurrencyInput
                          aria-label={`${p.name} annual value`}
                          className="w-full sm:w-28"
                          value={amount}
                          disabled={!enabled}
                          onValueChange={(val) => {
                            const next = [...benefits];
                            if (idx >= 0) next[idx] = { ...next[idx], annualValue: val, enabled: true };
                            else next.push({ name: p.name, annualValue: val, enabled: true });
                            setOffer({ ...offer, benefits: next });
                          }}
                        />
                        <span className="text-muted-foreground hidden sm:inline">/yr</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="space-y-3 pt-2">
            <details className="group border rounded p-3">
              <summary className="cursor-pointer font-medium">Stock growth (YoY) and starting price</summary>
              <div className="mt-3">
                <GrowthYoyEditor />
              </div>
            </details>
            <details className="group border rounded p-3">
              <summary className="cursor-pointer font-medium">Equity grants</summary>
              <div className="mt-3">
                <GrantsPanel />
              </div>
            </details>
            <details className="group border rounded p-3">
              <summary className="cursor-pointer font-medium">Raises over time</summary>
              <div className="mt-3">
                <RaisesEditor />
              </div>
            </details>
            <details className="group border rounded p-3">
              <summary className="cursor-pointer font-medium">Cash, bonuses & perks (full)</summary>
              <div className="mt-3">
                <CashPerksPanel />
              </div>
            </details>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
