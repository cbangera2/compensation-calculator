"use client";
import type { ChangeEvent, ReactNode } from 'react';
import { useEffect, useId, useState } from 'react';
import { useStore } from '@/state/store';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import GrowthYoyEditor from '@/components/GrowthYoyEditor';
import GrantsPanel from '@/components/GrantsPanel';
import RaisesEditor from '@/components/RaisesEditor';
import CashPerksPanel from '@/components/CashPerksPanel';
import { CurrencyInput } from '@/components/ui/currency-input';
import { Undo2, Redo2, ChevronDown } from 'lucide-react';
import { Separator } from '@/components/ui/separator';

// PresetLoader removed; defaults can now be imported on demand from Import/Export.

// Stable helper components and functions (outside component to prevent re-creation on every render)
const Section = ({ title, description, children }: { title: string; description?: string; children: ReactNode }) => (
  <section className="space-y-4 rounded-xl border border-border/50 bg-background/70 p-4 shadow-xs backdrop-blur-sm">
    <div className="space-y-1">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground/80">{title}</p>
      {description ? (
        <p className="text-sm text-muted-foreground">{description}</p>
      ) : null}
    </div>
    {children}
  </section>
);

const slugify = (label: string) => `perk-${label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;

export default function OfferForm() {
  const { offer, setOffer, setBonusValue, undo, redo, addGrant, updateGrant } = useStore();
  const [collapsed, setCollapsed] = useState(false);
  const contentId = useId();
  

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

  const renderBonusSummary = () => (
    <span className="text-xs text-muted-foreground whitespace-nowrap">
      {offer.performanceBonus?.kind === 'percent'
        ? `${Math.round(((offer.performanceBonus?.value ?? 0) * 1000)) / 10}% (~$${Math.round(((offer.performanceBonus?.value ?? 0) * offer.base.startAnnual)).toLocaleString()})`
        : `$${Math.round(offer.performanceBonus?.value ?? 0).toLocaleString()} (${Math.round((((offer.performanceBonus?.value ?? 0) / Math.max(1, offer.base.startAnnual)) * 1000)) / 10}%)`}
    </span>
  );

  return (
    <Card className="border-border/60">
      <CardHeader className="border-b border-border/60 pb-6">
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="space-y-1">
              <CardTitle className="text-2xl font-semibold">Offer details</CardTitle>
              <CardDescription>Fine-tune cash, equity, and perks for the active offer.</CardDescription>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setCollapsed((prev) => !prev)}
                aria-expanded={!collapsed}
                aria-controls={contentId}
                className="flex items-center gap-1"
              >
                <ChevronDown className={`size-4 transition-transform ${collapsed ? '-rotate-90' : 'rotate-0'}`} />
                {collapsed ? 'Expand' : 'Collapse'}
              </Button>
              <Button type="button" variant="secondary" size="sm" onClick={undo} aria-label="Undo">
                <Undo2 className="size-4" />
                Undo
              </Button>
              <Button type="button" variant="secondary" size="sm" onClick={redo} aria-label="Redo">
                <Redo2 className="size-4" />
                Redo
              </Button>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent
        id={contentId}
        className={`space-y-6 pb-8 pt-6 ${collapsed ? 'hidden' : ''}`}
        aria-hidden={collapsed}
      >
        <Section title="Basics" description="Company context and start timeline.">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="name">Company</Label>
              <Input id="name" value={offer.name}
                onChange={(e: ChangeEvent<HTMLInputElement>) => setOffer({ ...offer, name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="startDate">Start date</Label>
              <Input id="startDate" type="date" value={offer.startDate}
                onChange={(e: ChangeEvent<HTMLInputElement>) => setOffer({ ...offer, startDate: e.target.value })}
              />
            </div>
          </div>
        </Section>

        <Section title="Cash compensation" description="Annual base, bonus expectations, and geo adjustments.">
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            <div className="space-y-2">
              <Label htmlFor="base.startAnnual">Base salary (annual)</Label>
              <CurrencyInput id="base.startAnnual" value={offer.base.startAnnual}
                onValueChange={(v) => setOffer({ ...offer, base: { ...offer.base, startAnnual: v } })}
                className="w-full"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="col-adjust">Cost-of-living multiplier</Label>
              <Input id="col-adjust" type="number" step="0.05" value={offer.assumptions?.colAdjust ?? 1}
                onChange={(e: ChangeEvent<HTMLInputElement>) => setOffer({ ...offer, assumptions: { ...(offer.assumptions ?? { horizonYears: 4, colAdjust: 1 }), colAdjust: Number(e.target.value || '1') } })}
              />
              <p className="text-xs text-muted-foreground">Applies to base, one-time cash, and perks. 1.0 = no adjustment.</p>
            </div>
          </div>

          <Separator className="hidden lg:block" />

          <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
            <div className="space-y-3">
              <Label>Bonus (percent or cash)</Label>
              <div className="flex flex-col gap-3 rounded-lg border border-border/50 bg-background/60 p-3">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
                  <select
                    className="h-9 rounded-md border border-input bg-background px-3 py-1 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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
                    onChange={(e: ChangeEvent<HTMLInputElement>) => {
                      const v = Number(e.target.value || '0');
                      if ((offer.performanceBonus?.kind ?? 'percent') === 'percent') setBonusValue(v / 100);
                      else setBonusValue(v);
                    }}
                  />
                </div>
                <div className="flex flex-col gap-2">
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
                  {renderBonusSummary()}
                </div>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="performanceBonus.expectedPayout">Expected payout multiplier</Label>
              <Input id="performanceBonus.expectedPayout" type="number" step="0.1" value={offer.performanceBonus?.expectedPayout ?? 1}
                onChange={(e: ChangeEvent<HTMLInputElement>) => {
                  const v = Number(e.target.value || '0');
                  const cur = offer.performanceBonus ?? { kind: 'percent', value: 0, expectedPayout: 1 };
                  setOffer({ ...offer, performanceBonus: { ...cur, expectedPayout: v } });
                }}
              />
              <p className="text-xs text-muted-foreground">Adjust up or down if payouts differ from target.</p>
            </div>
          </div>
        </Section>

        <Section title="Equity" description="Estimate annual equity value using the default RSU grant.">
          <div className="grid gap-4">
            <div className="space-y-3">
              <Label>Stock grant by $</Label>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
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
                        className="w-full sm:w-48"
                      />
                      <select
                        className="h-9 rounded-md border border-input bg-background px-3 py-1 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        value={rsu?.targetMode ?? 'year1'}
                        onChange={(e: ChangeEvent<HTMLSelectElement>) => {
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
              <p className="text-xs text-muted-foreground">Uses starting price or FMV to back-calc shares; standard 4 year vesting.</p>
            </div>
          </div>
        </Section>

        <Section title="One-time cash & perks" description="Quick toggles for relocation, signing, and everyday benefits.">
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              {(() => {
                const signing = offer.signingBonuses ?? [];
                const enabled = signing.length > 0;
                const amount = signing[0]?.amount ?? 5000;
                const payDate = signing[0]?.payDate ?? offer.startDate;
                return (
                  <div className="flex flex-col gap-2 rounded-lg border border-border/50 bg-background/60 p-3">
                    <div className="flex items-center justify-between gap-3">
                      <label htmlFor="signing-enabled" className="text-sm font-medium">Signing bonus</label>
                      <input id="signing-enabled" type="checkbox" className="size-4" checked={enabled}
                        onChange={(e: ChangeEvent<HTMLInputElement>) => {
                          if (e.target.checked) {
                            if (!enabled) setOffer({ ...offer, signingBonuses: [{ amount, payDate }] });
                          } else {
                            if (enabled) setOffer({ ...offer, signingBonuses: signing.slice(1) });
                          }
                        }} />
                    </div>
                    <CurrencyInput className="w-full" value={amount} disabled={!enabled}
                      onValueChange={(val) => {
                        if (!enabled) return;
                        const next = [...signing];
                        next[0] = { amount: val, payDate };
                        setOffer({ ...offer, signingBonuses: next });
                      }} />
                  </div>
                );
              })()}
              {(() => {
                const relocation = offer.relocationBonuses ?? [];
                const enabled = relocation.length > 0;
                const amount = relocation[0]?.amount ?? 5000;
                const payDate = relocation[0]?.payDate ?? offer.startDate;
                return (
                  <div className="flex flex-col gap-2 rounded-lg border border-border/50 bg-background/60 p-3">
                    <div className="flex items-center justify-between gap-3">
                      <label htmlFor="relocation-enabled" className="text-sm font-medium">Relocation bonus</label>
                      <input id="relocation-enabled" type="checkbox" className="size-4" checked={enabled}
                        onChange={(e: ChangeEvent<HTMLInputElement>) => {
                          if (e.target.checked) {
                            if (!enabled) setOffer({ ...offer, relocationBonuses: [{ amount, payDate }] });
                          } else {
                            if (enabled) setOffer({ ...offer, relocationBonuses: relocation.slice(1) });
                          }
                        }} />
                    </div>
                    <CurrencyInput className="w-full" value={amount} disabled={!enabled}
                      onValueChange={(val) => {
                        if (!enabled) return;
                        const next = [...relocation];
                        next[0] = { amount: val, payDate };
                        setOffer({ ...offer, relocationBonuses: next });
                      }} />
                  </div>
                );
              })()}
            </div>
            <p className="text-xs text-muted-foreground">For multiple payments, open the Cash, Bonuses &amp; Perks section below.</p>

            <Separator />

            <div className="space-y-3">
              <Label>Quick perks</Label>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
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
                  const inputId = slugify(p.name);
                  return (
                    <div key={p.name} className="flex flex-col gap-2 rounded-lg border border-border/40 bg-background/60 p-3 text-sm sm:flex-row sm:items-center sm:justify-between sm:gap-3">
                      <div className="flex items-center gap-2">
                        <input
                          id={inputId}
                          type="checkbox"
                          className="size-4"
                          checked={enabled}
                          onChange={(e: ChangeEvent<HTMLInputElement>) => {
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
                        <label htmlFor={inputId} className="cursor-pointer font-medium sm:font-normal">{p.name}</label>
                      </div>
                      <div className="flex w-full items-center gap-1 sm:w-auto">
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
        </Section>

        <Section title="Advanced editors" description="Open detailed panels when you need precise control.">
          <div className="space-y-3">
            <details className="group rounded-lg border border-border/50 bg-background/60 p-4 transition-shadow hover:shadow-sm">
              <summary className="cursor-pointer list-none font-medium">Stock growth (YoY) and starting price</summary>
              <div className="mt-3">
                <GrowthYoyEditor />
              </div>
            </details>
            <details className="group rounded-lg border border-border/50 bg-background/60 p-4 transition-shadow hover:shadow-sm">
              <summary className="cursor-pointer list-none font-medium">Equity grants</summary>
              <div className="mt-3">
                <GrantsPanel />
              </div>
            </details>
            <details className="group rounded-lg border border-border/50 bg-background/60 p-4 transition-shadow hover:shadow-sm">
              <summary className="cursor-pointer list-none font-medium">Raises over time</summary>
              <div className="mt-3">
                <RaisesEditor />
              </div>
            </details>
            <details className="group rounded-lg border border-border/50 bg-background/60 p-4 transition-shadow hover:shadow-sm">
              <summary className="cursor-pointer list-none font-medium">Cash, bonuses &amp; perks (full)</summary>
              <div className="mt-3">
                <CashPerksPanel />
              </div>
            </details>
          </div>
        </Section>
      </CardContent>
    </Card>
  );
}
