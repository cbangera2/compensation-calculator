"use client";

import { useMemo, useState } from 'react';
import { ArrowLeftRight, ChevronDown } from 'lucide-react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CurrencyInput } from '@/components/ui/currency-input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Slider } from '@/components/ui/slider';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { formatCurrency } from '@/lib/utils';
import { useStore } from '@/state/store';
import { computeOffer } from '@/core/compute';
import {
  COMPARE_CITIES,
  compareCities,
  getCompareCity,
  type CompareCity,
  type HouseholdType,
} from '@/core/cityCompare';

/**
 * Offer location → benchmark metro matcher (mirrors the helper in
 * ShareSummaryView). Returns '' when nothing matches so the caller can
 * leave the city selector untouched.
 */
function metroForLocation(location: string | undefined): string {
  const h = (location ?? '').toLowerCase();
  if (
    /san francisco|sunnyvale|san jose|mountain view|palo alto|bay area|silicon valley|santa clara|oakland|berkeley|santa monica/.test(
      h
    )
  )
    return 'Bay Area';
  if (/new york|nyc|manhattan|brooklyn|queens|jersey city/.test(h)) return 'NYC';
  if (/seattle|bellevue|redmond|kirkland/.test(h)) return 'Seattle';
  if (/austin|round rock/.test(h)) return 'Austin';
  if (/detroit|ann arbor|dearborn|troy/.test(h)) return 'Detroit/Ann Arbor';
  if (/washington|arlington|alexandria|mclean|bethesda|district of columbia|\bdc\b/.test(h))
    return 'DC';
  return '';
}

/** Benchmark metro → city-compare city key. */
const METRO_TO_CITY_KEY: Record<string, string> = {
  'Bay Area': 'renter-sunnyvale',
  'Detroit/Ann Arbor': 'renter-ann-arbor',
  DC: 'renter-dc',
  Seattle: 'sea',
  NYC: 'nyc',
  Austin: 'aus',
};

function CityPicker({
  id,
  label,
  value,
  onChange,
  city,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (key: string) => void;
  city: CompareCity | undefined;
}) {
  return (
    <div className="space-y-1.5 min-w-0">
      <Label htmlFor={id}>{label}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger id={id} className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {COMPARE_CITIES.map((c) => (
            <SelectItem key={c.key} value={c.key}>
              {c.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <p className="text-[11px] leading-tight text-muted-foreground">
        COL ×{city?.colFactor.toFixed(2)} ·{' '}
        {city?.renterModel ? 'renter model' : 'generic preset'}
      </p>
    </div>
  );
}

/** Compact offer picker: fills comp + city from a saved offer, or "Custom…"
 *  to keep the manual inputs. */
function OfferPicker({
  id,
  label,
  value,
  onChange,
  offers,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  offers: { name: string }[];
}) {
  return (
    <div className="space-y-1.5 min-w-0">
      <Label htmlFor={id} className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger id={id} className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="custom">Custom…</SelectItem>
          {offers.map((o, i) => (
            <SelectItem key={i} value={String(i)}>
              {o.name || `Offer ${i + 1}`}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

export default function CityComparePanel() {
  const offers = useStore((s) => s.offers);
  const [fromKey, setFromKey] = useState('renter-sunnyvale');
  const [toKey, setToKey] = useState('renter-ann-arbor');
  const [comp, setComp] = useState(200_000);
  const [cashPct, setCashPct] = useState(100);
  const [household, setHousehold] = useState<HouseholdType>('single');
  // Offer pickers: 'custom' preserves the manual inputs above; picking an
  // offer fills comp with its Y1 total and the city from its location.
  const [fromOffer, setFromOffer] = useState('custom');
  const [toOffer, setToOffer] = useState('custom');

  const from = getCompareCity(fromKey);
  const to = getCompareCity(toKey);

  const applyOffer = (index: number, which: 'from' | 'to') => {
    const picked = offers[index];
    if (!picked) return;
    const y1 = computeOffer(picked)[0]?.total ?? 0;
    setComp(Math.max(0, Math.round(y1)));
    const cityKey = METRO_TO_CITY_KEY[metroForLocation(picked.location)];
    if (cityKey && getCompareCity(cityKey)) {
      if (which === 'from') setFromKey(cityKey);
      else setToKey(cityKey);
    }
  };

  const onFromOfferChange = (v: string) => {
    setFromOffer(v);
    if (v !== 'custom') applyOffer(Number(v), 'from');
  };

  const onToOfferChange = (v: string) => {
    setToOffer(v);
    if (v !== 'custom') applyOffer(Number(v), 'to');
  };

  const result = useMemo(() => {
    if (!from || !to) return null;
    return compareCities({ from, to, nominalComp: comp, cashFraction: cashPct / 100, household });
  }, [from, to, comp, cashPct, household]);

  const swap = () => {
    setFromKey(toKey);
    setToKey(fromKey);
  };

  const saving = result !== null && result.taxDelta < 0;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base sm:text-lg">City Compare</CardTitle>
        <CardDescription>
          What an offer is really worth, renter-style — purchasing power plus the
          state-tax gap.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-2 sm:grid-cols-2">
          <OfferPicker
            id="city-offer-from"
            label="From offer"
            value={fromOffer}
            onChange={onFromOfferChange}
            offers={offers}
          />
          <OfferPicker
            id="city-offer-to"
            label="To offer"
            value={toOffer}
            onChange={onToOfferChange}
            offers={offers}
          />
        </div>

        <div className="grid grid-cols-[1fr_auto_1fr] items-end gap-2">
          <CityPicker
            id="city-from"
            label="Offer city"
            value={fromKey}
            onChange={setFromKey}
            city={from}
          />
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={swap}
            aria-label="Swap cities"
            className="mb-5 h-10 w-10 shrink-0"
          >
            <ArrowLeftRight className="h-4 w-4" />
          </Button>
          <CityPicker
            id="city-to"
            label="Compare to"
            value={toKey}
            onChange={setToKey}
            city={to}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="city-comp">Annual comp (total)</Label>
            <CurrencyInput
              id="city-comp"
              value={comp}
              onValueChange={(v) => setComp(Math.max(0, Math.round(v || 0)))}
              placeholder="e.g., 200,000"
              className="h-11 text-lg font-semibold tabular-nums"
            />
          </div>
          <div className="space-y-1.5">
            <div className="flex items-baseline justify-between">
              <Label htmlFor="city-cash">Cash portion</Label>
              <span className="text-sm font-medium tabular-nums">{cashPct}%</span>
            </div>
            <Slider
              id="city-cash"
              value={[cashPct]}
              min={0}
              max={100}
              step={5}
              onValueChange={(v) => setCashPct(v[0])}
              className="pt-2"
              aria-label="Cash portion of comp"
            />
            <p className="text-[11px] leading-tight text-muted-foreground">
              State tax is estimated on this share only
            </p>
          </div>
        </div>

        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <Label id="city-household-label">Household</Label>
            <p className="text-[11px] leading-tight text-muted-foreground">
              Nudges the state-tax estimate
            </p>
          </div>
          <div
            role="group"
            aria-labelledby="city-household-label"
            className="flex shrink-0 items-center gap-0.5 rounded-full border border-border/60 p-0.5 text-xs"
          >
            {(['single', 'married'] as HouseholdType[]).map((h) => (
              <button
                key={h}
                type="button"
                aria-pressed={household === h}
                title={h === 'married' ? 'Married filing jointly' : 'Single filer'}
                onClick={() => setHousehold(h)}
                className={`min-h-8 rounded-full px-2.5 py-1 transition-colors ${
                  household === h
                    ? 'bg-foreground font-medium text-background'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {h === 'single' ? 'Single' : 'Married, joint'}
              </button>
            ))}
          </div>
        </div>

        {result && (
          <>
            <Separator />
            <div className="space-y-3">
              {result.crossModel && (
                <p className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs leading-relaxed text-amber-700 dark:text-amber-300">
                  Cross-model comparison: {result.from.shortName} uses the{' '}
                  {result.from.renterModel ? 'renter model' : 'generic headline presets'}
                  , {result.to.shortName} uses the{' '}
                  {result.to.renterModel ? 'renter model' : 'generic headline presets'}
                  . They assume different households (renter vs homeowner/family),
                  so treat the equivalence as rough.
                </p>
              )}
              <div>
                <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  Equivalent in {result.to.shortName}
                </p>
                <p className="text-3xl font-bold tabular-nums sm:text-4xl">
                  ≈ {formatCurrency(result.equivalentAfterTax)}
                </p>
                <p className="text-sm text-muted-foreground">
                  after cost-of-living and state-tax differences
                </p>
              </div>

              <dl className="space-y-1.5 text-sm">
                <div className="flex items-baseline justify-between gap-2">
                  <dt className="text-muted-foreground">COL-only equivalent</dt>
                  <dd className="font-medium tabular-nums">
                    {formatCurrency(result.equivalentColOnly)}
                  </dd>
                </div>
                <div className="flex items-baseline justify-between gap-2">
                  <dt className="text-muted-foreground">
                    Est. state tax · {result.from.shortName}
                  </dt>
                  <dd className="font-medium tabular-nums">
                    {formatCurrency(result.fromStateTax)}/yr
                  </dd>
                </div>
                <div className="flex items-baseline justify-between gap-2">
                  <dt className="text-muted-foreground">
                    Est. state tax · {result.to.shortName}
                  </dt>
                  <dd className="font-medium tabular-nums">
                    {formatCurrency(result.toStateTax)}/yr
                  </dd>
                </div>
                <div className="flex items-baseline justify-between gap-2">
                  <dt className="text-muted-foreground">Tax difference</dt>
                  <dd
                    className={cn(
                      'font-medium tabular-nums',
                      saving
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : 'text-red-600 dark:text-red-400'
                    )}
                  >
                    {result.taxDelta < 0 ? '−' : '+'}
                    {formatCurrency(Math.abs(result.taxDelta))}/yr
                  </dd>
                </div>
              </dl>

              <p className="rounded-md bg-muted/50 px-3 py-2 text-sm leading-snug">
                {result.verdict}
              </p>
            </div>
          </>
        )}

        <details className="group rounded-md border border-border bg-muted/30 px-3 py-2">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-2 text-sm font-medium text-muted-foreground [&::-webkit-details-marker]:hidden">
            Methodology &amp; caveats
            <ChevronDown className="h-4 w-4 shrink-0 transition-transform group-open:rotate-180" />
          </summary>
          <ul className="mt-2 list-disc space-y-1.5 pl-5 text-xs leading-relaxed text-muted-foreground">
            <li>
              Ann Arbor, DC, and Sunnyvale use a renter model: room in a shared
              2BR + car/metro + state tax on ~$150K, calibrated on a real Ann
              Arbor data point ($1,100/mo with a roommate). Factors: Ann Arbor
              1.00, DC ≈1.20, Sunnyvale ≈1.47.
            </li>
            <li>
              Seattle, NYC, and Austin fall back to generic headline COL
              presets, which assume a homeowner/family household — less
              accurate for renters. Comparing one of these against a
              renter-model city shows a cross-model warning above.
            </li>
            <li>
              State-tax rates are rough estimates, not tax advice: CA ~9.3%, NY
              ~9.5% (incl. ~3% NYC local tax (estimate)), DC ~7%, MI 4.25%
              flat, TX &amp; WA 0%. Applied to the cash portion only.
            </li>
            <li>
              Household toggle: married filing jointly applies a 0.85× factor
              to those rates — wider brackets and a doubled standard deduction
              shave roughly 10–20% off the effective rate at ~$150–200K. A
              rough adjustment on rough rates, not tax advice.
            </li>
            <li>
              Ignores federal tax, FICA, deductions, and equity tax timing
              (RSUs/options are taxed differently and later than salary).
            </li>
          </ul>
        </details>
      </CardContent>
    </Card>
  );
}
