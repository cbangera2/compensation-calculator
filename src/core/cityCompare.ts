// City-to-city purchasing-power comparison for renters.
//
// Pure logic — no React. Converts a nominal comp figure earned in one city
// into the nominal comp you'd need in another city for equivalent
// purchasing power, using (a) COL factors and (b) a rough state-income-tax
// differential on the cash portion of comp.
//
// TAX RATES ARE ROUGH ESTIMATES — not tax advice, not filing-accurate:
//  - CA 9.3%:  top marginal bracket, used as a rough "marginal-ish" proxy
//              for a high earner's effective state rate in the Bay Area.
//  - NY 9.5%:  rough state effective estimate (~6.5%) PLUS an ~3% NYC
//              local income-tax estimate folded in. NYC's headline rate is
//              state + city; modeling state-only materially overstated NYC
//              take-home, so the ~3% local estimate is included here.
//              Approximate — the real NYC local tax is bracketed, not flat.
//  - DC 7.0%:  rough effective estimate at ~$150K gross (DC brackets run
//              4% up to 10.75%; ~$150K lands near ~7.4% effective).
//  - MI 4.25%: flat state rate (local city income taxes ignored).
//  - TX / WA 0%: no state income tax.
// These ignore federal tax, FICA, deductions, credits, and the very different
// tax timing of equity (RSU/option) income. They exist to show the DIRECTION
// and rough SIZE of the state-tax gap between two offers, nothing more.

import { CITY_PRESETS, RENTER_COL_ESTIMATES } from '@/lib/col';

export type CompareCity = {
  key: string;
  /** Full display name, e.g. "Bay Area (Sunnyvale, CA)". */
  name: string;
  /** Short name for sentences, e.g. "Bay Area". */
  shortName: string;
  /** Cost-of-living factor; higher = more expensive. */
  colFactor: number;
  /** Rough effective income-tax rate on cash comp (0–1). Estimate only.
   *  For NYC this folds in an ~3% NYC local income-tax estimate on top of
   *  the ~6.5% state estimate (see module header). */
  stateTaxRate: number;
  /**
   * True when colFactor comes from the renter-based model in col.ts
   * (room in a shared 2BR + car/metro + state tax on ~$150K, calibrated on
   * a real Ann Arbor data point). False when it falls back to the generic
   * headline-COL presets, which assume a homeowner/family household.
   */
  renterModel: boolean;
};

function renterCity(
  key: string,
  name: string,
  shortName: string,
  stateTaxRate: number
): CompareCity {
  const preset = RENTER_COL_ESTIMATES.find((c) => c.key === key);
  if (!preset) throw new Error(`cityCompare: missing renter COL estimate for key "${key}"`);
  return { key, name, shortName, colFactor: preset.factor, stateTaxRate, renterModel: true };
}

function presetCity(
  key: string,
  name: string,
  shortName: string,
  stateTaxRate: number
): CompareCity {
  const preset = CITY_PRESETS.find((c) => c.key === key);
  if (!preset) throw new Error(`cityCompare: missing city preset for key "${key}"`);
  return { key, name, shortName, colFactor: preset.factor, stateTaxRate, renterModel: false };
}

/** Cities available in the comparison tool, cheapest reference first. */
export const COMPARE_CITIES: CompareCity[] = [
  renterCity('renter-ann-arbor', 'Ann Arbor, MI', 'Ann Arbor', 0.0425),
  renterCity('renter-sunnyvale', 'Bay Area (Sunnyvale, CA)', 'Bay Area', 0.093),
  renterCity('renter-dc', 'Washington, DC', 'DC', 0.07),
  presetCity('sea', 'Seattle, WA', 'Seattle', 0),
  // 0.095 = ~6.5% NY state estimate + ~3% NYC local estimate (see header).
  presetCity('nyc', 'New York, NY', 'NYC', 0.095),
  presetCity('aus', 'Austin, TX', 'Austin', 0),
];

export function getCompareCity(key: string): CompareCity | undefined {
  return COMPARE_CITIES.find((c) => c.key === key);
}

/**
 * Filing status used to nudge the rough state-tax estimate.
 *
 * Only two options on purpose: married filing jointly roughly doubles the
 * standard deduction and widens state brackets, so the effective state rate
 * lands ~10–20% below the single-filer estimate at ~$150–200K of cash comp.
 * We apply a flat 0.85× factor to the city rate — a deliberate
 * simplification stacked on top of already-rough rates, not tax advice.
 * 'single' (the default) is 1.0×, i.e. the documented rates as-is.
 */
export type HouseholdType = 'single' | 'married';

export const HOUSEHOLD_TAX_FACTOR: Record<HouseholdType, number> = {
  single: 1,
  married: 0.85,
};

export type CityCompareInput = {
  from: CompareCity;
  to: CompareCity;
  /** Annualized nominal total comp earned in the from-city. */
  nominalComp: number;
  /** Fraction of comp treated as cash and hit by the state tax rate. 0–1, default 1. */
  cashFraction?: number;
  /** Filing status adjusting the state-tax estimate. Default 'single' (no adjustment). */
  household?: HouseholdType;
};

export type CityComparison = {
  from: CompareCity;
  to: CompareCity;
  nominalComp: number;
  /** cashFraction after clamping to 0–1. */
  cashFraction: number;
  /** Household filing status used for this comparison. */
  household: HouseholdType;
  /**
   * True when from and to come from DIFFERENT COL models (one renter-model,
   * one generic-preset). Deliberate design choice, documented here: we do
   * NOT rescale the generic presets onto the Ann Arbor base, because any
   * such rescaling would need a proxy that doesn't exist in the renter
   * basket (e.g. treating generic Detroit 0.85 as Ann Arbor 1.00) and would
   * paper over the deeper basket mismatch — the renter model prices a
   * shared-room renter lifestyle while headline presets assume a
   * homeowner/family household. No multiplicative fix reconciles different
   * baskets, so instead of fabricating comparability we flag cross-model
   * pairs and show a visible caveat in the UI. Within-model pairs are on a
   * consistent base and need no caveat.
   */
  crossModel: boolean;
  /**
   * Purchasing power of the offer: nominal comp deflated by the from-city
   * COL factor (pre-tax). Expressed in Ann-Arbor-dollar terms when the
   * from-city uses the renter model; generic-preset cities are on a
   * US-average base instead (see crossModel).
   */
  purchasingPower: number;
  /** Nominal to-city comp with equal purchasing power (COL only, no tax). */
  equivalentColOnly: number;
  /**
   * Nominal to-city comp with equal AFTER-TAX purchasing power
   * (COL + state-tax differential on the cash portion).
   *
   * Solved from: E·(1 − f·r_to)/c_to = N·(1 − f·r_from)/c_from
   * where N = nominal, f = cash fraction, r = state rate, c = COL factor.
   */
  equivalentAfterTax: number;
  /** Estimated annual state tax on the cash portion, at the stated nominal comp. */
  fromStateTax: number;
  /** Estimated annual state tax on the cash portion, at the equivalent to-city comp. */
  toStateTax: number;
  /** Extra state tax per year at the equivalent to-city comp (negative = you save). */
  taxDelta: number;
  /** Plain-English summary of the result. */
  verdict: string;
};

const clamp01 = (n: number): number =>
  Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : 1;

function fmt(n: number): string {
  return `$${Math.round(n).toLocaleString('en-US')}`;
}

export function compareCities(input: CityCompareInput): CityComparison {
  const { from, to } = input;
  const nominalComp = Number.isFinite(input.nominalComp) && input.nominalComp > 0
    ? input.nominalComp
    : 0;
  const cashFraction = clamp01(input.cashFraction ?? 1);
  const household: HouseholdType =
    input.household === 'married' ? 'married' : 'single';
  const taxFactor = HOUSEHOLD_TAX_FACTOR[household];
  // Effective city rates after the household adjustment. CompareCity.stateTaxRate
  // stays the single-filer estimate; the toggle only scales it for the math.
  const fromRate = from.stateTaxRate * taxFactor;
  const toRate = to.stateTaxRate * taxFactor;

  const empty: CityComparison = {
    from,
    to,
    nominalComp,
    cashFraction,
    household,
    crossModel: from.renterModel !== to.renterModel,
    purchasingPower: 0,
    equivalentColOnly: 0,
    equivalentAfterTax: 0,
    fromStateTax: 0,
    toStateTax: 0,
    taxDelta: 0,
    verdict:
      nominalComp <= 0
        ? 'Enter a comp figure above $0 to compare cities.'
        : '',
  };
  if (nominalComp <= 0) return empty;

  if (from.key === to.key) {
    return {
      ...empty,
      equivalentColOnly: nominalComp,
      equivalentAfterTax: nominalComp,
      purchasingPower: nominalComp / from.colFactor,
      fromStateTax: nominalComp * cashFraction * fromRate,
      toStateTax: nominalComp * cashFraction * toRate,
      verdict: `${fmt(nominalComp)} in ${from.shortName} is ${fmt(nominalComp)} in ${to.shortName} — same city, no adjustment needed.`,
    };
  }

  const cashComp = nominalComp * cashFraction;
  const fromStateTax = cashComp * fromRate;
  const purchasingPower = nominalComp / from.colFactor;
  const equivalentColOnly = (nominalComp * to.colFactor) / from.colFactor;

  // After-tax equivalence: E·(1 − f·r_to) = N·(1 − f·r_from)·(c_to / c_from).
  // The (1 − f·r_to) denominator can't hit zero with real-world rates
  // (f ≤ 1, r ≤ 0.093), but guard anyway and fall back to the COL-only figure.
  const fromKeepRate = 1 - cashFraction * fromRate;
  const toKeepRate = 1 - cashFraction * toRate;
  const equivalentAfterTax =
    toKeepRate > 0
      ? (nominalComp * fromKeepRate * (to.colFactor / from.colFactor)) / toKeepRate
      : equivalentColOnly;

  const toStateTax = equivalentAfterTax * cashFraction * toRate;
  const taxDelta = toStateTax - fromStateTax;

  const parts: string[] = [
    `A ${fmt(nominalComp)} ${from.shortName} offer ≈ ${fmt(equivalentAfterTax)} in ${to.shortName} after cost-of-living and state-tax differences.`,
  ];
  if (Math.abs(taxDelta) >= 500) {
    const householdNote =
      household === 'married' ? ' (married filing jointly estimate)' : '';
    parts.push(
      `You'd pay roughly ${fmt(Math.abs(taxDelta))}/yr ${taxDelta >= 0 ? 'more' : 'less'} in state income tax${householdNote} (estimate, cash portion only).`
    );
  }

  return {
    from,
    to,
    nominalComp,
    cashFraction,
    household,
    crossModel: from.renterModel !== to.renterModel,
    purchasingPower,
    equivalentColOnly,
    equivalentAfterTax,
    fromStateTax,
    toStateTax,
    taxDelta,
    verdict: parts.join(' '),
  };
}
