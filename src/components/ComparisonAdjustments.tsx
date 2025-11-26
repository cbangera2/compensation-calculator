"use client";

import { useMemo, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { useStore } from '@/state/store';
import { computeOffer } from '@/core/compute';
import { buildPricePath, yoyFromCagr, yoyFromRamp } from '@/core/growth';
import { cn, formatCurrency } from '@/lib/utils';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { CITY_PRESETS } from '@/lib/col';

type Range = { min: number; max: number };

const INITIAL_COL_RANGE: Range = { min: 0.6, max: 2.0 };
const INITIAL_GROWTH_RANGE: Range = { min: -0.5, max: 0.5 };

const growthPresets = [
  { label: 'Bull +15% CAGR', generator: (years: number) => yoyFromCagr(0.15, years) },
  { label: 'Base +8% CAGR', generator: (years: number) => yoyFromCagr(0.08, years) },
  { label: 'Recovery −5→10%', generator: (years: number) => yoyFromRamp(-0.05, 0.10, years) },
  { label: 'Flat 0%', generator: (years: number) => yoyFromCagr(0, years) },
];

function ensureYoY(offer: ReturnType<typeof useStore.getState>['offers'][number]) {
  const years = offer.assumptions?.horizonYears ?? 4;
  const existing = offer.growth?.yoy ?? [];
  return Array.from({ length: years }, (_, idx) => existing[idx] ?? 0);
}

function coerceNumber(value: number, fallback: number) {
  return Number.isFinite(value) ? value : fallback;
}

function expandRange(range: Range, value: number): Range {
  if (!Number.isFinite(value)) return range;
  const paddingBase = Math.max(Math.abs(value) * 0.1, 0.1);
  let min = range.min;
  let max = range.max;
  if (value < min) min = value - paddingBase;
  if (value > max) max = value + paddingBase;
  if (min === max) {
    min -= paddingBase;
    max += paddingBase;
  }
  return { min, max };
}

function clampToRange(value: number, range: Range) {
  if (!Number.isFinite(value)) return range.min;
  if (value < range.min) return range.min;
  if (value > range.max) return range.max;
  return value;
}

export default function ComparisonAdjustments() {
  const { offers, activeIndex, updateOfferAt, applyToOffers } = useStore();
  const [syncCol, setSyncCol] = useState(false);
  const [syncGrowth, setSyncGrowth] = useState(false);
  const [expandedOffer, setExpandedOffer] = useState<number | null>(null);
  const [colRange, setColRange] = useState(() => ({ ...INITIAL_COL_RANGE }));
  const [growthRange, setGrowthRange] = useState(() => ({ ...INITIAL_GROWTH_RANGE }));

  const stats = useMemo(() => offers.map((offer) => {
    const rows = computeOffer(offer);
    const year1 = rows[0];
    const total4y = rows.reduce((acc, row) => acc + row.total, 0);
    return {
      year1Total: year1?.total ?? 0,
      year1Stock: year1?.stock ?? 0,
      total4y,
    };
  }), [offers]);

  const pricePreviews = useMemo(() => offers.map((offer) => {
    const years = offer.assumptions?.horizonYears ?? 4;
    const yoy = ensureYoY(offer);
    const startingPrice = offer.growth?.startingPrice ?? offer.equityGrants?.[0]?.fmv ?? 10;
    return buildPricePath(startingPrice, yoy, years).map((price) => price.toFixed(2));
  }), [offers]);

  if (!offers.length) return null;

  function setColAdjust(index: number, rawValue: number) {
  const next = coerceNumber(rawValue, 1);
  setColRange((prev) => expandRange(prev, next));
    if (syncCol) {
      applyToOffers((offer) => ({
        ...offer,
        colFactor: next,
        location: 'Custom', // Clear city name when manually adjusted
      }));
    } else {
      updateOfferAt(index, (offer) => ({
        ...offer,
        colFactor: next,
        location: 'Custom',
      }));
    }
  }

  function setLocation(index: number, cityKey: string) {
    const preset = CITY_PRESETS.find(c => c.key === cityKey);
    const factor = preset?.factor ?? 1;
    const location = preset?.name ?? 'Custom';
    
    if (syncCol) {
      applyToOffers((offer) => ({
        ...offer,
        colFactor: factor,
        location,
      }));
    } else {
      updateOfferAt(index, (offer) => ({
        ...offer,
        colFactor: factor,
        location,
      }));
    }
  }

  function setStartingPrice(index: number, rawValue: number) {
    const next = Math.max(0, coerceNumber(rawValue, 0));
    if (syncGrowth) {
      applyToOffers((offer) => ({
        ...offer,
        growth: { ...(offer.growth ?? { yoy: ensureYoY(offer) }), startingPrice: next },
      }));
    } else {
      updateOfferAt(index, (offer) => ({
        ...offer,
        growth: { ...(offer.growth ?? { yoy: ensureYoY(offer) }), startingPrice: next },
      }));
    }
  }

  function setYoYValue(offerIndex: number, yearIndex: number, value: number) {
  const nextValue = coerceNumber(value, 0);
  setGrowthRange((prev) => expandRange(prev, nextValue));
    if (syncGrowth) {
      applyToOffers((offer) => {
        const years = offer.assumptions?.horizonYears ?? 4;
        const yoy = ensureYoY(offer);
        if (yearIndex < years) {
          yoy[yearIndex] = nextValue;
        }
        return {
          ...offer,
          growth: { ...(offer.growth ?? {}), yoy },
        };
      });
    } else {
      updateOfferAt(offerIndex, (offer) => {
        const years = offer.assumptions?.horizonYears ?? 4;
        const yoy = ensureYoY(offer);
        if (yearIndex < years) {
          yoy[yearIndex] = nextValue;
        }
        return {
          ...offer,
          growth: { ...(offer.growth ?? {}), yoy },
        };
      });
    }
  }

  function applyGrowthPreset(offerIndex: number, generator: (years: number) => number[]) {
    if (syncGrowth) {
      applyToOffers((offer) => {
        const years = offer.assumptions?.horizonYears ?? 4;
        return {
          ...offer,
          growth: { ...(offer.growth ?? {}), yoy: generator(years) },
        };
      });
    } else {
      updateOfferAt(offerIndex, (offer) => {
        const years = offer.assumptions?.horizonYears ?? 4;
        return {
          ...offer,
          growth: { ...(offer.growth ?? {}), yoy: generator(years) },
        };
      });
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Scenario adjustments</CardTitle>
        <CardDescription>Tune cost of living and stock growth to see how each offer responds.</CardDescription>
        <div className="flex flex-wrap gap-2 pt-2">
          <Button
            type="button"
            size="sm"
            variant={syncCol ? 'default' : 'outline'}
            onClick={() => setSyncCol((value) => !value)}
          >
            {syncCol ? 'COL synced across offers' : 'Sync COL adjustments'}
          </Button>
          <Button
            type="button"
            size="sm"
            variant={syncGrowth ? 'default' : 'outline'}
            onClick={() => setSyncGrowth((value) => !value)}
          >
            {syncGrowth ? 'Growth synced across offers' : 'Sync stock growth'}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {offers.map((offer, index) => {
          const colFactor = coerceNumber(offer.colFactor ?? 1, 1);
          const location = offer.location || '';
          const presetKey = CITY_PRESETS.find(c => c.name === location || Math.abs(c.factor - colFactor) < 0.001)?.key ?? 'custom';
          const yoy = ensureYoY(offer);
          const startingPrice = offer.growth?.startingPrice ?? offer.equityGrants?.[0]?.fmv ?? 10;
          const preview = pricePreviews[index] ?? [];
          const stat = stats[index];
          const years = offer.assumptions?.horizonYears ?? yoy.length;
          const isExpanded = expandedOffer === index;
          const previewLabels = preview.map((price, idx) => (idx === 0 ? `Start $${price}` : `Y${idx} $${price}`));
          const condensed = isExpanded ? previewLabels : previewLabels.slice(0, 3);
          const previewText = condensed.join(' · ') + (condensed.length < previewLabels.length ? ' · …' : '');
          const yoySummary = yoy.map((value, idx) => `Y${idx + 1}: ${(value * 100).toFixed(0)}%`).slice(0, 5);
          const avgGrowth = yoy.length ? yoy.reduce((acc, value) => acc + value, 0) / yoy.length : 0;

          return (
            <div
              key={index}
              className={cn(
                'rounded-md border bg-background/85 px-4 py-3 shadow-sm transition',
                index === activeIndex ? 'border-primary/50 ring-2 ring-primary/10' : 'border-border'
              )}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="space-y-1">
                  <div className="text-sm font-semibold text-foreground">{offer.name || `Offer ${index + 1}`}</div>
                  <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
                    {index === activeIndex ? 'Active offer' : 'Comparison offer'} · {location || `${colFactor.toFixed(2)}× COL`}
                  </div>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="h-7 px-2 text-xs"
                  onClick={() => setExpandedOffer((prev) => (prev === index ? null : index))}
                >
                  {isExpanded ? 'Hide growth controls' : 'Growth details'}
                  {isExpanded ? <ChevronUp className="ml-1 size-3.5" /> : <ChevronDown className="ml-1 size-3.5" />}
                </Button>
              </div>

              <div className="mt-2 grid grid-cols-1 gap-2 text-[11px] text-muted-foreground sm:grid-cols-3">
                <div className="rounded-md border border-muted bg-muted/30 px-3 py-2">
                  <div className="text-xs font-medium text-foreground">{formatCurrency(Math.round(stat?.year1Total ?? 0))}</div>
                  <div>Year 1 total</div>
                </div>
                <div className="rounded-md border border-muted bg-muted/30 px-3 py-2">
                  <div className="text-xs font-medium text-foreground">{formatCurrency(Math.round(stat?.year1Stock ?? 0))}</div>
                  <div>Year 1 stock</div>
                </div>
                <div className="rounded-md border border-muted bg-muted/30 px-3 py-2">
                  <div className="text-xs font-medium text-foreground">{formatCurrency(Math.round(stat?.total4y ?? 0))}</div>
                  <div>4-year total</div>
                </div>
              </div>

              <div className="mt-2 flex flex-wrap items-center gap-1 text-[11px] text-muted-foreground">
                <span className="rounded-full border border-muted bg-muted/40 px-2 py-0.5 font-medium text-foreground">Growth</span>
                <span className="rounded-full border border-muted bg-muted/30 px-2 py-0.5">Start ${startingPrice.toFixed(2)}</span>
                <span className="rounded-full border border-muted bg-muted/30 px-2 py-0.5">Avg {(avgGrowth * 100).toFixed(1)}%</span>
                {!isExpanded && yoySummary.map((label) => (
                  <span key={label} className="rounded-full border border-muted bg-muted/25 px-2 py-0.5">{label}</span>
                ))}
                {!isExpanded && (
                  <span className="ml-1 text-[11px] text-muted-foreground/80">(Adjust in Growth details)</span>
                )}
              </div>

              <div className="mt-3 space-y-3">
                <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
                  <div>
                    <Label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Location / Cost of Living</Label>
                    <div className="mt-1 flex flex-col gap-2">
                      <select 
                        className="h-8 w-full rounded-md border border-input bg-background px-2 text-xs"
                        value={presetKey}
                        onChange={(e) => {
                          const key = e.target.value;
                          if (key === 'custom') {
                            setColAdjust(index, colFactor);
                          } else {
                            setLocation(index, key);
                          }
                        }}
                      >
                        <option value="custom">Custom COL factor...</option>
                        {CITY_PRESETS.map(c => (
                          <option key={c.key} value={c.key}>{c.name} ({c.factor.toFixed(2)}×)</option>
                        ))}
                      </select>
                      {presetKey === 'custom' && (
                        <div className="flex items-center gap-2">
                          <Slider
                            value={[clampToRange(colFactor, colRange)]}
                            min={colRange.min}
                            max={colRange.max}
                            step={0.01}
                            onValueChange={(values) => setColAdjust(index, values[0] ?? colFactor)}
                          />
                          <Input
                            className="h-8 w-20 px-2 text-xs"
                            type="number"
                            step="0.05"
                            value={colFactor.toFixed(2)}
                            onChange={(event) => setColAdjust(index, Number(event.target.value))}
                          />
                        </div>
                      )}
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Starting stock price ($)</Label>
                    <Input
                      className="mt-1 h-8 w-24 px-2 text-xs"
                      type="number"
                      min="0"
                      step="0.01"
                      value={startingPrice}
                      onChange={(event) => setStartingPrice(index, Number(event.target.value))}
                    />
                  </div>
                </div>

                {isExpanded && (
                  <div className="space-y-3 rounded-md border border-dashed border-muted bg-muted/20 p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <Label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Yearly stock growth</Label>
                      <div className="flex flex-wrap gap-1">
                        {growthPresets.map((preset) => (
                          <Button
                            key={preset.label}
                            type="button"
                            variant="secondary"
                            size="sm"
                            className="h-7 px-2 text-xs"
                            onClick={() => applyGrowthPreset(index, preset.generator)}
                          >
                            {preset.label}
                          </Button>
                        ))}
                      </div>
                    </div>
                    <div className="space-y-2">
                      {Array.from({ length: years }).map((_, yearIndex) => (
                        <div key={yearIndex} className="grid grid-cols-[auto,1fr,60px,auto] items-center gap-2 text-[11px]">
                          <span className="font-medium text-muted-foreground">Y{yearIndex + 1}</span>
                          <Slider
                            value={[clampToRange(yoy[yearIndex] ?? 0, growthRange)]}
                            min={growthRange.min}
                            max={growthRange.max}
                            step={0.01}
                            onValueChange={(values) => setYoYValue(index, yearIndex, values[0] ?? yoy[yearIndex] ?? 0)}
                          />
                          <Input
                            className="h-8 w-16 px-2 text-xs"
                            type="number"
                            step="0.5"
                            value={((yoy[yearIndex] ?? 0) * 100).toFixed(1)}
                            onChange={(event) => setYoYValue(index, yearIndex, Number(event.target.value) / 100)}
                          />
                          <span>%</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <p className="text-[11px] text-muted-foreground">Price path: {previewText}</p>
              </div>
            </div>
          );
        })}
        </div>
      </CardContent>
    </Card>
  );
}
