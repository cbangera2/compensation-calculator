"use client";
import { useStore } from '@/state/store';
import type { TVestingSchedule, TEquityGrant, TOffer } from '@/models/types';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { useMemo, useState } from 'react';
import { expandVesting } from '@/core/vesting';
import { priceAtVest } from '@/core/growth';

export default function GrantsPanel() {
  const { offer, addGrant, updateGrant, removeGrant } = useStore();
  const grants = offer.equityGrants ?? [];
  const [refYears, setRefYears] = useState(2);
  const [refStartOffset, setRefStartOffset] = useState(12); // months from offer start, default Y2
  const [openAdvanced, setOpenAdvanced] = useState<Record<number, boolean>>({});

  const startingPrice = useMemo(() => offer.growth?.startingPrice ?? 10, [offer.growth?.startingPrice]);

  function addMonthsStr(dateStr: string, months: number) {
    const d = new Date(dateStr);
    d.setMonth(d.getMonth() + months);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  function addRefresher(type: 'RSU' | 'NSO') {
    const price = startingPrice;
    const startDate = addMonthsStr(offer.startDate, refStartOffset);
    const baseGrant = {
      type,
      shares: 0,
      fmv: price,
      targetValue: 40000,
      targetMode: 'year1' as const,
      vesting: { model: 'standard', years: refYears, cliffMonths: Math.min(6, refYears * 12), frequency: 'monthly', distribution: 'even', cliffPercent: 0 } as TVestingSchedule,
      grantStartDate: startDate,
    } as const;
  const grant = type === 'NSO' ? { ...baseGrant, strike: price } : baseGrant;
  addGrant(grant);
  }

  function defaultStandardSchedule(): TVestingSchedule {
    return { model: 'standard', years: 4, cliffMonths: 12, frequency: 'monthly', distribution: 'even', cliffPercent: 0 };
  }
  function defaultMilestoneSchedule(): TVestingSchedule {
    return { model: 'milestone', steps: [
      { monthsFromStart: 12, fraction: 0.25 },
      { monthsFromStart: 24, fraction: 0.25 },
      { monthsFromStart: 36, fraction: 0.25 },
      { monthsFromStart: 48, fraction: 0.25 },
    ] } as TVestingSchedule;
  }
  function defaultExplicitSchedule(startDate: string): TVestingSchedule {
    return { model: 'explicit', tranches: [
      { date: addMonthsStr(startDate, 12), shares: 0.25 },
      { date: addMonthsStr(startDate, 24), shares: 0.25 },
      { date: addMonthsStr(startDate, 36), shares: 0.25 },
      { date: addMonthsStr(startDate, 48), shares: 0.25 },
    ] } as TVestingSchedule;
  }

  function impliedSharesForGrant(offer: TOffer, grant: TEquityGrant): number {
    if (!grant.targetValue || grant.targetValue <= 0) return grant.shares ?? 0;
    const offerStart = new Date(offer.startDate);
    const unitTranches = expandVesting(grant.vesting, grant.grantStartDate ?? offer.startDate, 1);
    const yoy = offer.growth?.yoy ?? [];
    const sp = startingPrice;
    const trancheInfos = unitTranches.map((t) => {
      const d = new Date(t.date);
      const y = Math.max(0, d.getFullYear() - offerStart.getFullYear());
      const p = priceAtVest(sp, yoy, y);
      const strikeFallback = (grant.strike ?? grant.fmv ?? sp);
      const intrinsic = Math.max(0, p - strikeFallback);
      return { date: d, fraction: t.shares, price: p, intrinsic };
    });
    const mode = grant.targetMode ?? 'year1';
    let denom = 0;
    if (mode === 'year1') {
      const y1Start = offerStart;
      const y1End = new Date(offerStart);
      y1End.setFullYear(y1End.getFullYear() + 1);
      denom = trancheInfos
        .filter(({ date }) => date > y1Start && date <= y1End)
        .reduce((acc, ti) => acc + ti.fraction * (grant.type === 'RSU' ? ti.price : ti.intrinsic), 0);
      if (denom === 0 && trancheInfos.length > 0) {
        const ti = trancheInfos[0];
        denom = ti.fraction * (grant.type === 'RSU' ? ti.price : ti.intrinsic);
      }
    } else {
      denom = trancheInfos.reduce((acc, ti) => acc + ti.fraction * (grant.type === 'RSU' ? ti.price : ti.intrinsic), 0);
    }
    if (denom <= 0) denom = sp;
    return grant.targetValue / denom;
  }

  function onTargetChange(index: number, patch: Partial<TEquityGrant>) {
    // If shares blank (0), auto-fill with implied shares
    const g = grants[index];
    const newGrant = { ...g, ...patch } as TEquityGrant;
    let patchWithShares: Partial<TEquityGrant> = { ...patch };
    if ((g.shares ?? 0) <= 0) {
      const implied = impliedSharesForGrant(offer, newGrant);
      if (isFinite(implied) && implied > 0) {
        patchWithShares = { ...patchWithShares, shares: Math.round(implied) };
      }
    }
    updateGrant(index, patchWithShares);
  }

  return (
    <div className="space-y-4">
      {/* Refresher Quick Add */}
      <div className="bg-muted/30 border rounded-lg p-4">
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <Label className="text-sm font-medium">Vesting Period</Label>
              <Input 
                type="number" 
                min={1} 
                step={1} 
                className="w-24 mt-1" 
                value={refYears}
                onChange={(e) => setRefYears(Math.max(1, Math.round(Number(e.target.value || '1'))))} 
              />
              <p className="text-xs text-muted-foreground mt-1">{refYears} year{refYears > 1 ? 's' : ''}</p>
            </div>
            <div>
              <Label className="text-sm font-medium">Grant Start</Label>
              <select 
                className="border rounded px-3 py-2 mt-1" 
                value={refStartOffset}
                onChange={(e) => setRefStartOffset(Number(e.target.value))}
              >
                <option value={0}>Year 1 (offer start)</option>
                <option value={12}>Year 2</option>
                <option value={24}>Year 3</option>
                <option value={36}>Year 4</option>
              </select>
            </div>
            <div className="flex gap-2">
              <Button type="button" size="sm" onClick={() => addRefresher('RSU')}>
                + RSU Grant
              </Button>
              <Button type="button" size="sm" variant="secondary" onClick={() => addRefresher('NSO')}>
                + Stock Option
              </Button>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            💡 Quick add: Creates a new grant with the settings above. Edit full details in the grant cards below.
          </p>
        </div>
      </div>

      {/* Quick Vesting Year Buttons */}
      {grants.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium text-muted-foreground">Quick vesting years:</span>
          {[2, 3, 4].map(y => (
            <button 
              key={y} 
              type="button" 
              className="px-3 py-1 border rounded text-xs font-medium hover:bg-accent transition-colors"
              onClick={() => grants.forEach((g2, j) => {
                if (g2.vesting.model === 'standard') {
                  updateGrant(j, { vesting: { ...g2.vesting, years: y } });
                }
              })}
            >
              Set all to {y}y
            </button>
          ))}
        </div>
      )}

      {/* Grants List */}
      <div className="space-y-3">
      {grants.map((g, i) => {
            const impliedShares = Math.round(impliedSharesForGrant(offer, g));
            const isOpen = !!openAdvanced[i];
            return (
              <div key={i} className="border rounded-lg p-4 space-y-3 bg-card hover:bg-accent/5 transition-colors">
                {/* Grant Header */}
                <div className="flex items-center justify-between pb-2 border-b">
                  <div className="flex items-center gap-2">
                    <span className="text-lg font-semibold">
                      {g.type === 'RSU' ? '📊 RSU' : '📈 Stock Option'} Grant {i + 1}
                    </span>
                    {g.grantStartDate && g.grantStartDate !== offer.startDate && (
                      <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded">
                        Refresher
                      </span>
                    )}
                  </div>
                  <Button 
                    type="button" 
                    size="sm" 
                    variant="destructive" 
                    onClick={() => removeGrant(i)}
                  >
                    Remove
                  </Button>
                </div>

                {/* Basic Configuration */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <Label className="text-sm font-medium">Grant Type</Label>
                    <Input value={g.type} readOnly className="mt-1 bg-muted" />
                  </div>
                  <div>
                    <Label className="text-sm font-medium">Target Value ($)</Label>
                    <Input
                      type="number"
                      value={g.targetValue ?? 0}
                      onChange={(e) => onTargetChange(i, { targetValue: Number(e.target.value || '0') })}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label className="text-sm font-medium">Valuation Mode</Label>
                    <select
                      className="border rounded px-2 py-2 w-full mt-1"
                      value={g.targetMode ?? 'year1'}
                      onChange={(e) => onTargetChange(i, { targetMode: e.target.value as 'year1' | 'total' })}
                    >
                      <option value="year1">Year 1 value</option>
                      <option value="total">4-year total</option>
                    </select>
                  </div>
                </div>

                {/* Implied Shares Info */}
                {(!g.shares || g.shares === 0) && (g.targetValue ?? 0) > 0 && (
                  <div className="bg-blue-50 border border-blue-200 rounded p-2">
                    <p className="text-xs text-blue-700">
                      💡 Calculated shares: <strong>{isFinite(impliedShares) ? impliedShares.toLocaleString() : 0}</strong> shares
                    </p>
                  </div>
                )}

                {/* Advanced Toggle */}
                <div className="pt-2">
                  <button
                    type="button"
                    onClick={() => setOpenAdvanced(o => ({ ...o, [i]: !o[i] }))}
                    className="flex items-center gap-2 text-sm font-medium hover:underline"
                  >
                    {isOpen ? '▼' : '▶'} Advanced Configuration
                  </button>
                </div>

                {isOpen && (
                  <div className="bg-muted/30 rounded-lg p-4 space-y-4">
                    {/* Core Settings Row */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                      <div>
                        <Label className="text-sm font-medium">Vesting Model</Label>
                        <select
                          className="border rounded px-2 py-2 w-full mt-1"
                          value={g.vesting.model}
                          onChange={(e) => {
                            const next = e.target.value as TVestingSchedule['model'];
                            if (next === 'standard') updateGrant(i, { vesting: defaultStandardSchedule() });
                            else if (next === 'milestone') updateGrant(i, { vesting: defaultMilestoneSchedule() });
                            else updateGrant(i, { vesting: defaultExplicitSchedule(g.grantStartDate ?? offer.startDate) });
                          }}
                        >
                          <option value="standard">Standard (Years/Cliff)</option>
                          <option value="milestone">Milestone-based</option>
                          <option value="explicit">Explicit Dates</option>
                        </select>
                      </div>
                      <div>
                        <Label className="text-sm font-medium">Total Shares</Label>
                        <Input
                          type="number"
                          value={g.shares}
                          placeholder={String(isFinite(impliedShares) ? impliedShares : '')}
                          onChange={(e) => updateGrant(i, { shares: Number(e.target.value || '0') })}
                          className="mt-1"
                        />
                      </div>
                      {'strike' in g ? (
                        <div>
                          <Label className="text-sm font-medium">Strike Price ($)</Label>
                          <Input
                            type="number"
                            step={0.01}
                            value={(g as { strike?: number }).strike ?? 0}
                            placeholder={String(g.fmv ?? startingPrice)}
                            onChange={(e) => updateGrant(i, { strike: Number(e.target.value || '0') })}
                            className="mt-1"
                          />
                        </div>
                      ) : (
                        <div>
                          <Label className="text-sm font-medium">FMV at Grant ($)</Label>
                          <Input
                            type="number"
                            step={0.01}
                            value={g.fmv ?? 0}
                            placeholder={String(startingPrice)}
                            onChange={(e) => updateGrant(i, { fmv: Number(e.target.value || '0') })}
                            className="mt-1"
                          />
                        </div>
                      )}
                      <div>
                        <Label className="text-sm font-medium">Grant Start Date</Label>
                        <Input
                          type="date"
                          value={g.grantStartDate ?? offer.startDate}
                          onChange={(e) => updateGrant(i, { grantStartDate: e.target.value })}
                          className="mt-1"
                        />
                      </div>
                    </div>
                    {/* Vesting Schedule Details */}
                    {g.vesting.model === 'standard' ? (
                      <div>
                        <h4 className="text-sm font-medium mb-3">Standard Vesting Schedule</h4>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                          <div>
                            <Label className="text-sm font-medium">Cliff Period</Label>
                            <Input
                              type="number"
                              value={g.vesting.cliffMonths}
                              onChange={(e) => updateGrant(i, { vesting: { ...g.vesting, cliffMonths: Number(e.target.value) } as TVestingSchedule })}
                              className="mt-1"
                            />
                            <p className="text-xs text-muted-foreground mt-1">months</p>
                          </div>
                          <div>
                            <Label className="text-sm font-medium">Total Years</Label>
                            <Input
                              type="number"
                              value={g.vesting.years}
                              onChange={(e) => updateGrant(i, { vesting: { ...g.vesting, years: Number(e.target.value) } as TVestingSchedule })}
                              className="mt-1"
                            />
                            <p className="text-xs text-muted-foreground mt-1">years</p>
                          </div>
                          <div>
                            <Label className="text-sm font-medium">Vesting Frequency</Label>
                            <select
                              className="border rounded px-2 py-2 w-full mt-1"
                              value={g.vesting.frequency}
                              onChange={(e) => updateGrant(i, { vesting: { ...g.vesting, frequency: e.target.value as 'monthly'|'quarterly'|'annual' } as TVestingSchedule })}
                            >
                              <option value="monthly">Monthly</option>
                              <option value="quarterly">Quarterly</option>
                              <option value="annual">Annual</option>
                            </select>
                          </div>
                          <div>
                            <Label className="text-sm font-medium">Distribution</Label>
                            <select
                              className="border rounded px-2 py-2 w-full mt-1"
                              value={g.vesting.distribution ?? 'even'}
                              onChange={(e) => updateGrant(i, { vesting: { ...g.vesting, distribution: e.target.value as 'even'|'frontloaded'|'backloaded' } as TVestingSchedule })}
                            >
                              <option value="even">Even</option>
                              <option value="frontloaded">Front-loaded</option>
                              <option value="backloaded">Back-loaded</option>
                            </select>
                          </div>
                          <div>
                            <Label className="text-sm font-medium">Cliff Percentage</Label>
                            <div className="relative mt-1">
                              <Input
                                type="number"
                                step={0.5}
                                value={Math.round(((g.vesting.cliffPercent ?? 0) * 10000)) / 100}
                                onChange={(e) => updateGrant(i, { vesting: { ...g.vesting, cliffPercent: Number(e.target.value || '0') / 100 } as TVestingSchedule })}
                              />
                              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground pointer-events-none">%</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    ) : g.vesting.model === 'milestone' ? (
                      <div>
                        <div className="flex items-center justify-between mb-3">
                          <h4 className="text-sm font-medium">Milestone-Based Vesting</h4>
                          <Button 
                            type="button" 
                            size="sm" 
                            variant="secondary" 
                            onClick={() => {
                              const vest = g.vesting as Extract<TVestingSchedule, { model: 'milestone' }>;
                              const last = vest.steps[vest.steps.length - 1];
                              const steps: { monthsFromStart: number; fraction: number }[] = vest.steps.concat({ monthsFromStart: (last?.monthsFromStart ?? 0) + 12, fraction: 0 });
                              updateGrant(i, { vesting: { model: 'milestone', steps } as TVestingSchedule });
                            }}
                          >
                            + Add Milestone
                          </Button>
                        </div>
                        <div className="space-y-2">
                          {(g.vesting as Extract<TVestingSchedule, { model: 'milestone' }>).steps.map((s, idx) => (
                            <div key={idx} className="flex flex-col sm:flex-row items-end gap-2 border rounded p-3 bg-background">
                              <div className="flex-1">
                                <Label className="text-sm font-medium">Months from Grant Start</Label>
                                <Input
                                  type="number"
                                  min={0}
                                  value={s.monthsFromStart}
                                  onChange={(e) => {
                                    const vest = g.vesting as Extract<TVestingSchedule, { model: 'milestone' }>;
                                    const steps: { monthsFromStart: number; fraction: number }[] = vest.steps.slice();
                                    steps[idx] = { ...steps[idx], monthsFromStart: Math.max(0, Math.round(Number(e.target.value || '0'))) };
                                    steps.sort((a: { monthsFromStart: number }, b: { monthsFromStart: number }) => a.monthsFromStart - b.monthsFromStart);
                                    updateGrant(i, { vesting: { model: 'milestone', steps } as TVestingSchedule });
                                  }}
                                  className="mt-1"
                                />
                              </div>
                              <div className="flex-1">
                                <Label className="text-sm font-medium">Vesting Weight</Label>
                                <div className="relative mt-1">
                                  <Input
                                    type="number"
                                    step={0.5}
                                    value={Math.round(s.fraction * 1000) / 10}
                                    onChange={(e) => {
                                      const vest = g.vesting as Extract<TVestingSchedule, { model: 'milestone' }>;
                                      const steps: { monthsFromStart: number; fraction: number }[] = vest.steps.slice();
                                      steps[idx] = { ...steps[idx], fraction: Math.max(0, Number(e.target.value || '0') / 100) };
                                      updateGrant(i, { vesting: { model: 'milestone', steps } as TVestingSchedule });
                                    }}
                                  />
                                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground pointer-events-none">%</span>
                                </div>
                              </div>
                              <Button 
                                type="button" 
                                size="sm" 
                                variant="destructive"
                                onClick={() => {
                                  const vest = g.vesting as Extract<TVestingSchedule, { model: 'milestone' }>;
                                  const steps: { monthsFromStart: number; fraction: number }[] = vest.steps.slice();
                                  steps.splice(idx,1);
                                  updateGrant(i, { vesting: { model: 'milestone', steps } as TVestingSchedule });
                                }}
                              >
                                Remove
                              </Button>
                            </div>
                          ))}
                          <p className="text-xs text-muted-foreground pl-1">
                            💡 Weights are automatically scaled to 100%
                          </p>
                        </div>
                      </div>
                    ) : (
                      <div>
                        <div className="flex items-center justify-between mb-3">
                          <h4 className="text-sm font-medium">Explicit Date-Based Vesting</h4>
                          <Button 
                            type="button" 
                            size="sm" 
                            variant="secondary" 
                            onClick={() => {
                              const vest = g.vesting as Extract<TVestingSchedule, { model: 'explicit' }>;
                              const last = vest.tranches[vest.tranches.length - 1];
                              const nextDate = last ? addMonthsStr(last.date.slice(0,10), 12) : addMonthsStr(g.grantStartDate ?? offer.startDate, 12);
                              const tranches: { date: string; shares: number }[] = vest.tranches.concat({ date: new Date(nextDate).toISOString(), shares: 0 });
                              updateGrant(i, { vesting: { model: 'explicit', tranches } as TVestingSchedule });
                            }}
                          >
                            + Add Tranche
                          </Button>
                        </div>
                        <div className="space-y-2">
                          {(g.vesting as Extract<TVestingSchedule, { model: 'explicit' }>).tranches.map((t, idx) => (
                            <div key={idx} className="flex flex-col sm:flex-row items-end gap-2 border rounded p-3 bg-background">
                              <div className="flex-1">
                                <Label className="text-sm font-medium">Vesting Date</Label>
                                <Input
                                  type="date"
                                  value={t.date.slice(0,10)}
                                  onChange={(e) => {
                                    const vest = g.vesting as Extract<TVestingSchedule, { model: 'explicit' }>;
                                    const tranches: { date: string; shares: number }[] = vest.tranches.slice();
                                    tranches[idx] = { ...tranches[idx], date: new Date(e.target.value).toISOString() };
                                    tranches.sort((a: { date: string }, b: { date: string }) => new Date(a.date).getTime() - new Date(b.date).getTime());
                                    updateGrant(i, { vesting: { model: 'explicit', tranches } as TVestingSchedule });
                                  }}
                                  className="mt-1"
                                />
                              </div>
                              <div className="flex-1">
                                <Label className="text-sm font-medium">Vesting Weight</Label>
                                <div className="relative mt-1">
                                  <Input
                                    type="number"
                                    step={0.5}
                                    value={Math.round(t.shares * 1000) / 10}
                                    onChange={(e) => {
                                      const vest = g.vesting as Extract<TVestingSchedule, { model: 'explicit' }>;
                                      const tranches: { date: string; shares: number }[] = vest.tranches.slice();
                                      tranches[idx] = { ...tranches[idx], shares: Math.max(0, Number(e.target.value || '0') / 100) };
                                      updateGrant(i, { vesting: { model: 'explicit', tranches } as TVestingSchedule });
                                    }}
                                  />
                                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground pointer-events-none">%</span>
                                </div>
                              </div>
                              <Button 
                                type="button" 
                                size="sm" 
                                variant="destructive"
                                onClick={() => {
                                  const vest = g.vesting as Extract<TVestingSchedule, { model: 'explicit' }>;
                                  const tranches: { date: string; shares: number }[] = vest.tranches.slice();
                                  tranches.splice(idx,1);
                                  updateGrant(i, { vesting: { model: 'explicit', tranches } as TVestingSchedule });
                                }}
                              >
                                Remove
                              </Button>
                            </div>
                          ))}
                          <p className="text-xs text-muted-foreground pl-1">
                            💡 Weights are automatically scaled to 100%
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        {grants.length === 0 && (
          <div className="border-2 border-dashed rounded-lg p-8 text-center">
            <p className="text-sm text-muted-foreground mb-2">
              No equity grants configured yet
            </p>
            <p className="text-xs text-muted-foreground">
              Use the quick add section above to create a refresher grant, or set your initial grant in Simple mode first.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
