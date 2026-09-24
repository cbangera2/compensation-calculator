"use client";

import { useMemo, useState } from 'react';
import { useIsMobile } from '@/lib/useIsMobile';
import { useStore } from '@/state/store';
import type { TOffer, TStartupEquity, TStartupOptionGrant, TStartupRsuGrant } from '@/models/types';
import { impliedSharePrice, valuateStartupEquity, sampleStartupEquity } from '@/core/startup';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { formatCurrency, formatNumber } from '@/lib/utils';
import { cn } from '@/lib/utils';
import { Plus, Trash2, Sparkles, ChevronDown, FilePlus2 } from 'lucide-react';
import EmptyState from '@/components/EmptyState';

const MIN_VALUATION = 1_000_000_000; // $1B
const MAX_VALUATION = 150_000_000_000; // $150B

const VALUATION_PRESETS = [
  { label: '$1B', value: 1_000_000_000 },
  { label: '$5B', value: 5_000_000_000 },
  { label: '$15B', value: 15_000_000_000 },
  { label: '$50B', value: 50_000_000_000 },
  { label: '$150B', value: 150_000_000_000 },
];

function valToSliderT(valuation: number): number {
  const v = Math.min(MAX_VALUATION, Math.max(MIN_VALUATION, valuation || MIN_VALUATION));
  const t = (Math.log10(v) - Math.log10(MIN_VALUATION)) / (Math.log10(MAX_VALUATION) - Math.log10(MIN_VALUATION));
  return Math.round(t * 1000);
}

function sliderTToVal(t: number): number {
  const f = Math.min(1, Math.max(0, t / 1000));
  return Math.pow(10, Math.log10(MIN_VALUATION) + f * (Math.log10(MAX_VALUATION) - Math.log10(MIN_VALUATION)));
}

function toNumber(value: string, fallback: number): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function uid(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}`;
}

function Field({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={className}>
      <Label className="text-xs font-medium text-muted-foreground">{label}</Label>
      <div className="mt-1.5">{children}</div>
    </div>
  );
}

/**
 * GrantAccordion — full card on desktop; on mobile a collapsed summary row
 * (label + net value, delete stays visible) with the fields one tap away.
 */
function GrantAccordion({
  label,
  netValue,
  labelInput,
  onRemove,
  removeLabel,
  children,
}: {
  label: string;
  netValue: string | null;
  labelInput: React.ReactNode;
  onRemove: () => void;
  removeLabel: string;
  children: React.ReactNode;
}) {
  const isMobile = useIsMobile();
  const [open, setOpen] = useState(false);

  const netBlock = netValue ? (
    <div className="text-right">
      <div className="text-xl font-bold tabular-nums text-foreground">{netValue}</div>
      <div className="text-[11px] text-muted-foreground">net value</div>
    </div>
  ) : null;

  const deleteBtn = (
    <Button size="sm" variant="ghost" onClick={onRemove} aria-label={removeLabel}>
      <Trash2 className="size-4" />
    </Button>
  );

  if (!isMobile) {
    return (
      <Card>
        <CardContent className="pt-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            {labelInput}
            <div className="flex items-center gap-4">
              {netBlock}
              {deleteBtn}
            </div>
          </div>
          {children}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <div className="flex items-center gap-1 pl-4 pr-2">
        <button
          type="button"
          aria-expanded={open}
          onClick={() => setOpen((o) => !o)}
          className="flex min-h-[54px] min-w-0 flex-1 items-center justify-between gap-3 py-2.5 text-left"
        >
          <span className="min-w-0">
            <span className="block truncate text-sm font-semibold text-foreground">{label}</span>
            {netValue ? (
              <span className="mt-0.5 block text-xs tabular-nums text-muted-foreground">{netValue} net</span>
            ) : null}
          </span>
          <ChevronDown
            className={cn('size-4 shrink-0 text-muted-foreground transition-transform duration-200', open && 'rotate-180')}
          />
        </button>
        {deleteBtn}
      </div>
      {open ? (
        <CardContent className="pt-0">
          {labelInput}
          {children}
        </CardContent>
      ) : null}
    </Card>
  );
}

export default function StartupPanel() {
  const { offers, activeIndex, updateOfferAt } = useStore();
  const offer = offers[activeIndex];

  const block: TStartupEquity | undefined = offer?.startupEquity;

  const patch = (fn: (b: TStartupEquity) => TStartupEquity) => {
    if (!offer) return;
    updateOfferAt(activeIndex, (o: TOffer) => ({
      ...o,
      startupEquity: fn(o.startupEquity ?? { ...sampleStartupEquity(), enabled: true }),
    }));
  };

  const valuation = useMemo(() => {
    if (!block) return null;
    return valuateStartupEquity(block);
  }, [block]);

  const sharePrice = block ? impliedSharePrice(block.valuation, block.fullyDilutedShares) : 0;

  if (!offer) return null;

  if (!block?.enabled) {
    return (
      <Card className="mx-auto max-w-xl">
        <CardHeader className="text-center">
          <div className="mx-auto mb-2 grid size-11 place-items-center rounded-2xl bg-primary/10 text-primary">
            <Sparkles className="size-5" />
          </div>
          <CardTitle className="text-base sm:text-lg">Startup mode</CardTitle>
          <CardDescription className="text-sm">
            Model private-company equity: valuation-driven share price, option grants
            with strike prices, double-trigger RSUs, and exercise costs.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col items-center gap-3 pb-8">
          <Button size="lg" onClick={() => patch(() => sampleStartupEquity())}>
            Load sample data
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() =>
              patch(() => ({
                ...sampleStartupEquity(),
                enabled: true,
                companyName: '',
                optionGrants: [],
                rsuGrants: [],
              }))
            }
          >
            Start from scratch
          </Button>
          <p className="text-xs text-muted-foreground">Sample data is fictional and for demonstration only.</p>
        </CardContent>
      </Card>
    );
  }

  const addOptionGrant = () =>
    patch((b) => ({
      ...b,
      optionGrants: [
        ...b.optionGrants,
        {
          id: uid('opt'),
          label: `Option grant ${b.optionGrants.length + 1}`,
          quantity: 1000,
          strike: Math.round(sharePrice * 100) / 100,
          fmvAtGrant: Math.round(sharePrice * 100) / 100,
          vestYears: 4,
          cliffMonths: 12,
        } as TStartupOptionGrant,
      ],
    }));

  const addRsuGrant = () =>
    patch((b) => ({
      ...b,
      rsuGrants: [
        ...b.rsuGrants,
        {
          id: uid('rsu'),
          label: `RSU grant ${b.rsuGrants.length + 1}`,
          shares: 250,
          fmvAtGrant: Math.round(sharePrice * 100) / 100,
          doubleTrigger: true,
          vestYears: 2,
        } as TStartupRsuGrant,
      ],
    }));

  const removeOptionGrant = (id?: string, index?: number) =>
    patch((b) => ({
      ...b,
      optionGrants: b.optionGrants.filter((g, i) => (id ? g.id !== id : i !== index)),
    }));

  const removeRsuGrant = (id?: string, index?: number) =>
    patch((b) => ({
      ...b,
      rsuGrants: b.rsuGrants.filter((g, i) => (id ? g.id !== id : i !== index)),
    }));

  const updateOptionGrant = (index: number, partial: Partial<TStartupOptionGrant>) =>
    patch((b) => ({
      ...b,
      optionGrants: b.optionGrants.map((g, i) => (i === index ? { ...g, ...partial } : g)),
    }));

  const updateRsuGrant = (index: number, partial: Partial<TStartupRsuGrant>) =>
    patch((b) => ({
      ...b,
      rsuGrants: b.rsuGrants.map((g, i) => (i === index ? { ...g, ...partial } : g)),
    }));

  return (
    <div className="space-y-6">
      {/* Valuation hero */}
      <Card className="overflow-hidden">
        <div className="bg-gradient-to-br from-primary/8 via-transparent to-transparent px-4 pt-4 sm:px-6 sm:pt-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                Scenario valuation
              </p>
              <div className="mt-2 flex flex-wrap items-baseline gap-x-4 gap-y-1">
                <span className="text-3xl font-bold tabular-nums tracking-tight text-foreground sm:text-5xl">
                  {formatCurrency(sharePrice, { decimals: 2 })}
                </span>
                <span className="text-sm text-muted-foreground">implied per share</span>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                {formatCurrency(block.valuation)} valuation · {formatNumber(block.fullyDilutedShares)} fully diluted shares
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => patch(() => sampleStartupEquity())}>
                Reload sample
              </Button>
              <Button variant="ghost" size="sm" onClick={() => patch((b) => ({ ...b, enabled: false }))}>
                Disable
              </Button>
            </div>
          </div>

          <div className="mt-4 sm:mt-6">
            <Slider
              value={[valToSliderT(block.valuation)]}
              min={0}
              max={1000}
              step={1}
              onValueChange={(v) => patch((b) => ({ ...b, valuation: sliderTToVal(v[0] ?? 0) }))}
              className="py-2 [&_[data-slot=slider-track]]:h-2.5 [&_[data-slot=slider-thumb]]:size-6"
            />
            <div className="mt-3 flex flex-wrap gap-2">
              {VALUATION_PRESETS.map((p) => {
                const active = Math.abs(block.valuation - p.value) / p.value < 0.02;
                return (
                  <Button
                    key={p.label}
                    size="sm"
                    variant={active ? 'default' : 'outline'}
                    className="rounded-full min-h-10"
                    onClick={() => patch((b) => ({ ...b, valuation: p.value }))}
                  >
                    {p.label}
                  </Button>
                );
              })}
              <div className="ml-auto flex items-center gap-2">
                <Input
                  type="number"
                  className="h-8 w-24 px-2 text-xs"
                  min={1}
                  step={1}
                  aria-label="Valuation in billions"
                  value={Math.round(block.valuation / 1_000_000_000)}
                  onChange={(e) =>
                    patch((b) => ({
                      ...b,
                      valuation: Math.min(
                        MAX_VALUATION,
                        Math.max(MIN_VALUATION, toNumber(e.target.value, b.valuation / 1_000_000_000) * 1_000_000_000)
                      ),
                    }))
                  }
                />
                <span className="text-xs text-muted-foreground">$B</span>
              </div>
            </div>
          </div>

          <div className="mt-4 grid gap-3 pb-4 sm:mt-6 sm:gap-4 sm:pb-6 md:grid-cols-2">
            <Field label="Company name">
              <Input
                value={block.companyName}
                onChange={(e) => patch((b) => ({ ...b, companyName: e.target.value }))}
                placeholder="Example Startup"
              />
            </Field>
            <Field label="Fully diluted shares outstanding">
              <Input
                type="number"
                min={1}
                value={block.fullyDilutedShares}
                onChange={(e) => patch((b) => ({ ...b, fullyDilutedShares: Math.max(1, toNumber(e.target.value, b.fullyDilutedShares)) }))}
              />
            </Field>
          </div>
        </div>

        {valuation && (
          <CardContent className="grid grid-cols-2 gap-2 border-t border-border/60 pt-4 sm:gap-3 sm:pt-5 lg:grid-cols-4">
            {[
              { label: 'Total net value', value: formatCurrency(valuation.totalNetValue), big: true },
              { label: 'Annualized grant value', value: `${formatCurrency(valuation.totalAnnualizedGrantValue)}/yr` },
              { label: 'Total exercise cost', value: formatCurrency(valuation.totalExerciseCost) },
              { label: 'Grants', value: formatNumber(valuation.grants.length) },
            ].map((s) => (
              <div key={s.label} className="rounded-xl border border-border/60 bg-muted/20 px-3 py-2.5 sm:px-4 sm:py-3">
                <div className={cn('font-bold tabular-nums text-foreground', s.big ? 'text-xl sm:text-2xl' : 'text-base sm:text-lg')}>{s.value}</div>
                <div className="mt-0.5 text-xs text-muted-foreground">{s.label}</div>
                {s.label === 'Annualized grant value' && (
                  <div className="mt-1 text-[11px] leading-snug text-muted-foreground">
                    Intrinsic value at grant FMV — max(FMV − strike, 0) × quantity — not the headline offer value. At-the-money options show $0. Double-trigger status and cliff timing aren&apos;t modeled; value is spread evenly across vest years.
                  </div>
                )}
              </div>
            ))}
          </CardContent>
        )}
      </Card>

      {/* Option grants */}
      <section>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-foreground sm:text-base">Option grants</h2>
            <p className="text-xs text-muted-foreground">Strike price × quantity is the cash cost to exercise. Grant value is intrinsic value at grant FMV, not headline offer value.</p>
          </div>
          <Button size="sm" onClick={addOptionGrant}>
            <Plus className="mr-1 size-4" /> Add option grant
          </Button>
        </div>
        <div className="space-y-4">
          {block.optionGrants.length === 0 && (
            <EmptyState
              icon={<FilePlus2 className="size-4" />}
              title="No option grants yet"
              hint="Add one to model strike prices and exercise cost."
            />
          )}
          {block.optionGrants.map((g, i) => {
            const v = valuation?.grants[i];
            return (
              <GrantAccordion
                key={g.id ?? i}
                label={g.label}
                netValue={v ? formatCurrency(v.netValue) : null}
                onRemove={() => removeOptionGrant(g.id, i)}
                removeLabel="Remove option grant"
                labelInput={
                  <Input
                    className="h-9 max-w-64 border-transparent bg-transparent px-2 text-base font-semibold shadow-none focus-visible:border-input focus-visible:bg-background"
                    value={g.label}
                    aria-label="Grant label"
                    onChange={(e) => updateOptionGrant(i, { label: e.target.value })}
                  />
                }
              >
                  <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-5">
                    <Field label="Quantity">
                      <Input type="number" min={0} value={g.quantity} onChange={(e) => updateOptionGrant(i, { quantity: Math.max(0, toNumber(e.target.value, g.quantity)) })} />
                    </Field>
                    <Field label="Strike $">
                      <Input type="number" min={0} step="0.01" value={g.strike} onChange={(e) => updateOptionGrant(i, { strike: Math.max(0, toNumber(e.target.value, g.strike)) })} />
                    </Field>
                    <Field label="FMV at grant $">
                      <Input type="number" min={0} step="0.01" value={g.fmvAtGrant} onChange={(e) => updateOptionGrant(i, { fmvAtGrant: Math.max(0, toNumber(e.target.value, g.fmvAtGrant)) })} />
                    </Field>
                    <Field label="Vest years">
                      <Input type="number" min={0.25} step="0.25" value={g.vestYears} onChange={(e) => updateOptionGrant(i, { vestYears: Math.max(0.25, toNumber(e.target.value, g.vestYears)) })} />
                    </Field>
                    <Field label="Cliff months">
                      <Input type="number" min={0} step={1} value={g.cliffMonths} onChange={(e) => updateOptionGrant(i, { cliffMonths: Math.max(0, Math.round(toNumber(e.target.value, g.cliffMonths))) })} />
                    </Field>
                  </div>
                  {v && (
                    <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 border-t border-border/50 pt-3 text-xs text-muted-foreground">
                      <span>Exercise cost: <span className="font-medium text-foreground">{formatCurrency(v.exerciseCost)}</span></span>
                      <span>Annualized: <span className="font-medium text-foreground">{formatCurrency(v.annualizedGrantValue)}/yr</span></span>
                    </div>
                  )}
              </GrantAccordion>
            );
          })}
        </div>
      </section>

      {/* RSU grants */}
      <section>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-foreground sm:text-base">RSU grants</h2>
            <p className="text-xs text-muted-foreground">No strike — double-trigger RSUs convert at a liquidity event.</p>
          </div>
          <Button size="sm" onClick={addRsuGrant}>
            <Plus className="mr-1 size-4" /> Add RSU grant
          </Button>
        </div>
        <div className="space-y-4">
          {block.rsuGrants.length === 0 && (
            <EmptyState
              icon={<FilePlus2 className="size-4" />}
              title="No RSU grants yet"
              hint="Double-trigger RSUs convert at a liquidity event."
            />
          )}
          {block.rsuGrants.map((g, i) => {
            const v = valuation?.grants[block.optionGrants.length + i];
            return (
              <GrantAccordion
                key={g.id ?? i}
                label={g.label}
                netValue={v ? formatCurrency(v.netValue) : null}
                onRemove={() => removeRsuGrant(g.id, i)}
                removeLabel="Remove RSU grant"
                labelInput={
                  <Input
                    className="h-9 max-w-64 border-transparent bg-transparent px-2 text-base font-semibold shadow-none focus-visible:border-input focus-visible:bg-background"
                    value={g.label}
                    aria-label="Grant label"
                    onChange={(e) => updateRsuGrant(i, { label: e.target.value })}
                  />
                }
              >
                  <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
                    <Field label="Shares">
                      <Input type="number" min={0} value={g.shares} onChange={(e) => updateRsuGrant(i, { shares: Math.max(0, toNumber(e.target.value, g.shares)) })} />
                    </Field>
                    <Field label="FMV at grant $">
                      <Input type="number" min={0} step="0.01" value={g.fmvAtGrant} onChange={(e) => updateRsuGrant(i, { fmvAtGrant: Math.max(0, toNumber(e.target.value, g.fmvAtGrant)) })} />
                    </Field>
                    <Field label="Vest years">
                      <Input type="number" min={0.25} step="0.25" value={g.vestYears} onChange={(e) => updateRsuGrant(i, { vestYears: Math.max(0.25, toNumber(e.target.value, g.vestYears)) })} />
                    </Field>
                    <Field label="Double trigger">
                      <select
                        className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                        value={g.doubleTrigger ? 'yes' : 'no'}
                        onChange={(e) => updateRsuGrant(i, { doubleTrigger: e.target.value === 'yes' })}
                      >
                        <option value="yes">Yes</option>
                        <option value="no">No</option>
                      </select>
                    </Field>
                  </div>
                  {v && (
                    <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 border-t border-border/50 pt-3 text-xs text-muted-foreground">
                      <span>Annualized: <span className="font-medium text-foreground">{formatCurrency(v.annualizedGrantValue)}/yr</span></span>
                    </div>
                  )}
              </GrantAccordion>
            );
          })}
        </div>
      </section>
    </div>
  );
}
