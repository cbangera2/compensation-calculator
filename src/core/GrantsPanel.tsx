"use client";
import { useStore } from '@/state/store';
import type { TVestingSchedule, TEquityGrant, TOffer } from '@/models/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
    <Card>
      <CardHeader>
        <CardTitle>Equity Grants & Refreshers</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="border rounded p-3">
            <div className="flex flex-wrap items-end gap-3">
              <div>
                <Label>Refresher years</Label>
                <Input type="number" min={1} step={1} className="w-24" value={refYears}
                  onChange={(e) => setRefYears(Math.max(1, Math.round(Number(e.target.value || '1'))))} />
              </div>
              <div>
                <Label>Start at</Label>
                <select className="border rounded px-2 py-2" value={refStartOffset}
                  onChange={(e) => setRefStartOffset(Number(e.target.value))}>
                  <option value={0}>Y1 (offer start)</option>
                  <option value={12}>Y2</option>
                  <option value={24}>Y3</option>
                  <option value={36}>Y4</option>
                </select>
              </div>
              <Button type="button" onClick={() => addRefresher('RSU')}>Add Refresher RSU</Button>
              <Button type="button" variant="secondary" onClick={() => addRefresher('NSO')}>Add Refresher Option</Button>
            </div>
            <p className="text-xs text-muted-foreground mt-2">Adds a new grant with your chosen start and years. Edit details below.</p>
          </div>

          <div className="grid gap-3">
          {grants.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-2">
              <span className="text-xs text-muted-foreground">Quick years:</span>
              {[2,3,4].map(y => (
                <button key={y} type="button" className="px-2 py-1 border rounded text-xs"
                  onClick={() => grants.forEach((g2, j) => {
                    if (g2.vesting.model === 'standard') {
                      updateGrant(j, { vesting: { ...g2.vesting, years: y } });
                    }
                  })}>
                  {y}y
                </button>
              ))}
            </div>
          )}
          {grants.map((g, i) => {
            // Hooks cannot be called inside map callbacks conditionally; compute directly.
            const impliedShares = Math.round(impliedSharesForGrant(offer, g));
            const isOpen = !!openAdvanced[i];
            return (
              <div key={i} className="border rounded p-3 space-y-3">
                <div className="grid grid-cols-7 gap-3 items-end">
                  <div>
                    <Label>Type</Label>
                    <Input value={g.type} readOnly />
                  </div>
                  <div>
                    <Label>Target $</Label>
                    <Input
                      type="number"
                      value={g.targetValue ?? 0}
                      onChange={(e) => onTargetChange(i, { targetValue: Number(e.target.value || '0') })}
                    />
                  </div>
                  <div>
                    <Label>Target mode</Label>
                    <select
                      className="border rounded px-2 py-2 w-full"
                      value={g.targetMode ?? 'year1'}
                      onChange={(e) => onTargetChange(i, { targetMode: e.target.value as 'year1' | 'total' })}
                    >
                      <option value="year1">Year 1 value</option>
                      <option value="total">4-year total</option>
                    </select>
                  </div>
                  <div className="col-span-2 text-xs text-muted-foreground self-center">
                    {(!g.shares || g.shares === 0) && (g.targetValue ?? 0) > 0 ? (
                      <span>Implied shares: {isFinite(impliedShares) ? impliedShares : 0}</span>
                    ) : (
                      <span>&nbsp;</span>
                    )}
                  </div>
                  <div className="flex gap-2 justify-end">
                    <Button type="button" variant="secondary" onClick={() => setOpenAdvanced(o => ({ ...o, [i]: !o[i] }))}>
                      {isOpen ? 'Hide advanced' : 'Advanced'}
                    </Button>
                    <Button type="button" variant="destructive" onClick={() => removeGrant(i)}>Remove</Button>
                  </div>
                </div>

                {isOpen && (
                  <div className="grid grid-cols-7 gap-3 items-end">
                    <div>
                      <Label>Shares</Label>
                      <Input
                        type="number"
                        value={g.shares}
                        placeholder={String(isFinite(impliedShares) ? impliedShares : '')}
                        onChange={(e) => updateGrant(i, { shares: Number(e.target.value || '0') })}
                      />
                    </div>
                    {'strike' in g ? (
                      <div>
                        <Label>Strike</Label>
                        <Input
                          type="number"
                          step={0.01}
                          value={(g as { strike?: number }).strike ?? 0}
                          placeholder={String(g.fmv ?? startingPrice)}
                          onChange={(e) => updateGrant(i, { strike: Number(e.target.value || '0') })}
                        />
                      </div>
                    ) : (
                      <div>
                        <Label>FMV</Label>
                        <Input
                          type="number"
                          step={0.01}
                          value={g.fmv ?? 0}
                          placeholder={String(startingPrice)}
                          onChange={(e) => updateGrant(i, { fmv: Number(e.target.value || '0') })}
                        />
                      </div>
                    )}
                    <div>
                      <Label>Grant start</Label>
                      <Input
                        type="date"
                        value={g.grantStartDate ?? offer.startDate}
                        onChange={(e) => updateGrant(i, { grantStartDate: e.target.value })}
                      />
                    </div>
                    {g.vesting.model === 'standard' ? (
                      <>
                        <div>
                          <Label>Cliff (months)</Label>
                          <Input
                            type="number"
                            value={g.vesting.cliffMonths}
                            onChange={(e) => updateGrant(i, { vesting: { ...g.vesting, cliffMonths: Number(e.target.value) } as TVestingSchedule })}
                          />
                        </div>
                        <div>
                          <Label>Years</Label>
                          <Input
                            type="number"
                            value={g.vesting.years}
                            onChange={(e) => updateGrant(i, { vesting: { ...g.vesting, years: Number(e.target.value) } as TVestingSchedule })}
                          />
                        </div>
                        <div>
                          <Label>Frequency</Label>
                          <select
                            className="border rounded px-2 py-2 w-full"
                            value={g.vesting.frequency}
                            onChange={(e) => updateGrant(i, { vesting: { ...g.vesting, frequency: e.target.value as 'monthly'|'quarterly'|'annual' } as TVestingSchedule })}
                          >
                            <option value="monthly">Monthly</option>
                            <option value="quarterly">Quarterly</option>
                            <option value="annual">Annual</option>
                          </select>
                        </div>
                        <div>
                          <Label>Distribution</Label>
                          <select
                            className="border rounded px-2 py-2 w-full"
                            value={g.vesting.distribution ?? 'even'}
                            onChange={(e) => updateGrant(i, { vesting: { ...g.vesting, distribution: e.target.value as 'even'|'frontloaded'|'backloaded' } as TVestingSchedule })}
                          >
                            <option value="even">Even</option>
                            <option value="frontloaded">Frontloaded</option>
                            <option value="backloaded">Backloaded</option>
                          </select>
                        </div>
                        <div>
                          <Label>Cliff %</Label>
                          <Input
                            type="number"
                            step={0.5}
                            value={Math.round(((g.vesting.cliffPercent ?? 0) * 10000)) / 100}
                            onChange={(e) => updateGrant(i, { vesting: { ...g.vesting, cliffPercent: Number(e.target.value || '0') / 100 } as TVestingSchedule })}
                          />
                        </div>
                      </>
                    ) : (
                      <div className="col-span-5 text-xs text-muted-foreground">Explicit vesting: edit tranches in JSON (Import/Export).</div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
          {grants.length === 0 && (
            <p className="text-sm text-muted-foreground">
              No grants yet. Set a stock grant by $ in Simple mode; then adjust vesting here.
            </p>
          )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
