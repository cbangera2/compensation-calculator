"use client";

import { useEffect, useMemo, useState } from 'react';
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
import { Plus, Trash2, Sparkles, ChevronDown, FilePlus2, X } from 'lucide-react';
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

/**
 * ModalShell — centered dialog over a dimmed backdrop. Clicking the backdrop
 * or pressing Escape closes it. Matches the ShareDialog pattern.
 */
function ModalShell({
  title,
  description,
  onClose,
  children,
  footer,
}: {
  title: string;
  description?: string;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={onClose}
    >
      <div
        className="max-h-[92dvh] w-full max-w-lg overflow-y-auto rounded-2xl border border-border bg-background p-4 shadow-xl sm:p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold">{title}</h2>
            {description ? (
              <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>
            ) : null}
          </div>
          <Button type="button" size="sm" variant="ghost" className="h-8 w-8 shrink-0 p-0" onClick={onClose} aria-label="Close">
            <X className="size-4" />
          </Button>
        </div>
        <div className="mt-4">{children}</div>
        {footer ? <div className="mt-5 flex justify-end gap-2">{footer}</div> : null}
      </div>
    </div>
  );
}

type NewOptionGrant = Omit<TStartupOptionGrant, 'id'>;
type NewRsuGrant = Omit<TStartupRsuGrant, 'id'>;

/** Form for adding an option or RSU grant via modal. */
function AddGrantForm({
  mode,
  defaultLabel,
  sharePrice,
  offerStartDate,
  onSubmit,
}: {
  mode: 'option' | 'rsu';
  defaultLabel: string;
  sharePrice: number;
  offerStartDate: string;
  onSubmit: (grant: NewOptionGrant | NewRsuGrant) => void;
}) {
  const money = Math.round(sharePrice * 100) / 100;
  const [label, setLabel] = useState(defaultLabel);
  const [quantity, setQuantity] = useState(mode === 'option' ? '1000' : '250');
  const [strike, setStrike] = useState(String(money));
  const [fmvAtGrant, setFmvAtGrant] = useState(String(money));
  const [vestYears, setVestYears] = useState(mode === 'option' ? '4' : '2');
  const [cliffMonths, setCliffMonths] = useState('12');
  const [doubleTrigger, setDoubleTrigger] = useState(true);
  const [grantStartDate, setGrantStartDate] = useState('');

  function submit() {
    const qty = Math.max(0, toNumber(quantity, 0));
    if (mode === 'option') {
      onSubmit({
        label: label.trim() || defaultLabel,
        quantity: qty,
        strike: Math.max(0, toNumber(strike, money)),
        fmvAtGrant: Math.max(0, toNumber(fmvAtGrant, money)),
        vestYears: Math.max(0.25, toNumber(vestYears, 4)),
        cliffMonths: Math.max(0, Math.round(toNumber(cliffMonths, 12))),
        grantStartDate: grantStartDate || undefined,
      } satisfies NewOptionGrant);
    } else {
      onSubmit({
        label: label.trim() || defaultLabel,
        shares: qty,
        fmvAtGrant: Math.max(0, toNumber(fmvAtGrant, money)),
        doubleTrigger,
        vestYears: Math.max(0.25, toNumber(vestYears, 2)),
        grantStartDate: grantStartDate || undefined,
      } satisfies NewRsuGrant);
    }
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <div className="grid grid-cols-2 gap-3 sm:gap-4">
        <Field label="Grant label" className="col-span-2">
          <Input value={label} onChange={(e) => setLabel(e.target.value)} autoFocus />
        </Field>
        <Field label={mode === 'option' ? 'Quantity' : 'Shares'}>
          <Input type="number" min={0} value={quantity} onChange={(e) => setQuantity(e.target.value)} />
        </Field>
        {mode === 'option' ? (
          <Field label="Strike $">
            <Input type="number" min={0} step={0.01} value={strike} onChange={(e) => setStrike(e.target.value)} />
          </Field>
        ) : null}
        <Field label="FMV at grant $">
          <Input type="number" min={0} step={0.01} value={fmvAtGrant} onChange={(e) => setFmvAtGrant(e.target.value)} />
        </Field>
        <Field label="Vest years">
          <Input type="number" min={0.25} step={0.25} value={vestYears} onChange={(e) => setVestYears(e.target.value)} />
        </Field>
        {mode === 'option' ? (
          <Field label="Cliff months">
            <Input type="number" min={0} step={1} value={cliffMonths} onChange={(e) => setCliffMonths(e.target.value)} />
          </Field>
        ) : (
          <Field label="Double trigger">
            <select
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={doubleTrigger ? 'yes' : 'no'}
              onChange={(e) => setDoubleTrigger(e.target.value === 'yes')}
            >
              <option value="yes">Yes</option>
              <option value="no">No</option>
            </select>
          </Field>
        )}
        <Field label="Grant start date" className="col-span-2">
          <Input type="date" value={grantStartDate} onChange={(e) => setGrantStartDate(e.target.value)} />
          <p className="mt-1 text-xs text-muted-foreground">
            When vesting starts. Leave blank to use the offer start date ({offerStartDate}).
          </p>
        </Field>
      </div>
      <div className="mt-5 flex justify-end gap-2">
        <Button type="submit">Add grant</Button>
      </div>
    </form>
  );
}

export default function StartupPanel() {
  const { offers, activeIndex, updateOfferAt } = useStore();
  const offer = offers[activeIndex];

  const [addMode, setAddMode] = useState<'option' | 'rsu' | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ kind: 'option' | 'rsu'; index: number; label: string } | null>(null);

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

  const addOptionGrant = (grant: NewOptionGrant) => {
    patch((b) => ({
      ...b,
      optionGrants: [...b.optionGrants, { ...grant, id: uid('opt') } as TStartupOptionGrant],
    }));
    setAddMode(null);
  };

  const addRsuGrant = (grant: NewRsuGrant) => {
    patch((b) => ({
      ...b,
      rsuGrants: [...b.rsuGrants, { ...grant, id: uid('rsu') } as TStartupRsuGrant],
    }));
    setAddMode(null);
  };

  const confirmDelete = () => {
    if (!deleteTarget) return;
    const { kind, index } = deleteTarget;
    patch((b) =>
      kind === 'option'
        ? { ...b, optionGrants: b.optionGrants.filter((_, i) => i !== index) }
        : { ...b, rsuGrants: b.rsuGrants.filter((_, i) => i !== index) }
    );
    setDeleteTarget(null);
  };

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
          <Button size="sm" onClick={() => setAddMode('option')}>
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
                onRemove={() => setDeleteTarget({ kind: 'option', index: i, label: g.label })}
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
                    <Field label="Grant start">
                      <Input type="date" value={g.grantStartDate ?? ''} onChange={(e) => updateOptionGrant(i, { grantStartDate: e.target.value || undefined })} />
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
          <Button size="sm" onClick={() => setAddMode('rsu')}>
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
                onRemove={() => setDeleteTarget({ kind: 'rsu', index: i, label: g.label })}
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
                    <Field label="Grant start">
                      <Input type="date" value={g.grantStartDate ?? ''} onChange={(e) => updateRsuGrant(i, { grantStartDate: e.target.value || undefined })} />
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

      {addMode ? (
        <ModalShell
          title={addMode === 'option' ? 'Add option grant' : 'Add RSU grant'}
          description={
            addMode === 'option'
              ? 'Options are valued at the scenario share price minus the strike.'
              : 'RSUs convert to shares at the scenario share price.'
          }
          onClose={() => setAddMode(null)}
        >
          <AddGrantForm
            mode={addMode}
            defaultLabel={
              addMode === 'option'
                ? `Option grant ${(block?.optionGrants.length ?? 0) + 1}`
                : `RSU grant ${(block?.rsuGrants.length ?? 0) + 1}`
            }
            sharePrice={sharePrice}
            offerStartDate={offer.startDate}
            onSubmit={(grant) => {
              if (addMode === 'option') addOptionGrant(grant as NewOptionGrant);
              else addRsuGrant(grant as NewRsuGrant);
            }}
          />
        </ModalShell>
      ) : null}

      {deleteTarget ? (
        <ModalShell
          title={`Delete ${deleteTarget.kind === 'option' ? 'option' : 'RSU'} grant?`}
          description={`"${deleteTarget.label}" will be removed. This can't be undone.`}
          onClose={() => setDeleteTarget(null)}
          footer={
            <>
              <Button type="button" variant="outline" onClick={() => setDeleteTarget(null)}>
                Cancel
              </Button>
              <Button type="button" variant="destructive" onClick={confirmDelete}>
                Delete grant
              </Button>
            </>
          }
        >
          <p className="text-sm text-muted-foreground">
            The grant&apos;s vested value will be removed from all totals and charts.
          </p>
        </ModalShell>
      ) : null}
    </div>
  );
}
