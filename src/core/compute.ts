import { addYears, addMonths, differenceInCalendarDays, differenceInCalendarMonths, max as maxDate, min as minDate } from 'date-fns';
import { TOffer, TEquityGrant } from '@/models/types';
import { expandVesting } from './vesting';
import { priceAtVest } from './growth';
import { impliedSharePrice } from './startup';

export type YearRow = {
  year: number; // 1-based index
  base: number;
  bonus: number;
  stock: number;
  other: number; // signing/relocation/benefits/misc
  total: number;
};

function startOfYear(offerStart: Date, yearIndex: number) {
  return addYears(offerStart, yearIndex);
}

function endOfYear(offerStart: Date, yearIndex: number) {
  return addYears(offerStart, yearIndex + 1);
}

function clampDaysInRange(rangeStart: Date, rangeEnd: Date, start: Date, end: Date) {
  const s = maxDate([rangeStart, start]);
  const e = minDate([rangeEnd, end]);
  const days = Math.max(0, differenceInCalendarDays(e, s));
  return days;
}

function computeProratedBaseForYear(offer: TOffer, yearIndex: number): number {
  const offerStart = new Date(offer.startDate);
  const yStart = startOfYear(offerStart, yearIndex);
  const yEnd = endOfYear(offerStart, yearIndex);
  const daysInYear = Math.max(1, differenceInCalendarDays(yEnd, yStart));
  const col = offer.assumptions?.colAdjust ?? 1;

  // Build timeline of base changes
  const changes = [
    { date: offer.startDate, type: 'absolute' as const, apply: (b: number) => b },
    ...offer.raises
      .slice()
      .sort((a, b) => a.effectiveDate.localeCompare(b.effectiveDate))
      .map(r => ({
        date: r.effectiveDate,
        type: r.type,
        apply: (b: number) => (r.type === 'percent' ? b * (1 + r.value) : b + r.value),
      })),
  ];

  let currentBase = offer.base.startAnnual;
  // Apply all changes before year start to get starting base for the year
  for (const c of changes) {
    if (new Date(c.date) < yStart) {
      currentBase = c.apply(currentBase);
    }
  }

  // For segments within the year bounded by change dates and year end, prorate
  const innerChanges = changes
    .filter(c => {
      const d = new Date(c.date);
      return d >= yStart && d < yEnd;
    })
    .sort((a, b) => a.date.localeCompare(b.date));

  let accrual = 0;
  let segStart = yStart;
  for (const c of innerChanges) {
    const d = new Date(c.date);
    const segDays = clampDaysInRange(segStart, yEnd, segStart, d);
    accrual += (currentBase * segDays) / daysInYear;
    currentBase = c.apply(currentBase);
    segStart = d;
  }
  // Final segment to year end
  const segDays = clampDaysInRange(segStart, yEnd, segStart, yEnd);
  accrual += (currentBase * segDays) / daysInYear;

  return accrual * col;
}

function computeBonusForYear(offer: TOffer, proratedBase: number): number {
  if (!offer.performanceBonus) return 0;
  const pb = offer.performanceBonus;
  if (pb.kind === 'percent') return proratedBase * pb.value * (pb.expectedPayout ?? 1);
  return pb.value * (pb.expectedPayout ?? 1);
}

/** Year index for stock growth, by elapsed time rather than calendar year: a
 *  tranche vesting 6 months after a July start gets 0 full years of growth. */
function growthYearIndex(d: Date, offerStart: Date): number {
  return Math.max(0, Math.floor(differenceInCalendarMonths(d, offerStart) / 12));
}

function grantValueForYear(offer: TOffer, grant: TEquityGrant, yearIndex: number): number {
  // If grant has a targetValue, compute implied shares first (back-calc)
  let shares = grant.shares;
  const offerStart = new Date(offer.startDate);
  const startingPrice = offer.growth?.startingPrice ?? grant.fmv ?? 10;
  const yoy = offer.growth?.yoy ?? [];
  if (grant.targetValue && grant.targetValue > 0) {
    // Use tranche fractions by expanding with totalShares=1
    const unitTranches = expandVesting(grant.vesting, grant.grantStartDate ?? offer.startDate, 1);
    const trancheInfos = unitTranches.map((t) => {
      const d = new Date(t.date);
      const y = growthYearIndex(d, offerStart);
      const p = priceAtVest(startingPrice, yoy, y);
      // If strike is blank, fall back to FMV or starting price
      const strikeFallback = (grant.strike ?? grant.fmv ?? startingPrice);
      const intrinsic = Math.max(0, p - strikeFallback);
      return { date: d, fraction: t.shares, price: p, intrinsic };
    });
    const mode = grant.targetMode ?? 'year1';
    const denom = (() => {
      if (mode === 'year1') {
        const y1Start = startOfYear(offerStart, 0);
        const y1End = endOfYear(offerStart, 0);
        const filtered = trancheInfos.filter(({ date }) => date > y1Start && date <= y1End);
        const sum = filtered.reduce((acc, ti) => acc + ti.fraction * (grant.type === 'RSU' ? ti.price : ti.intrinsic), 0);
        // Fallback if no Y1 vests
        return sum > 0 ? sum : trancheInfos.slice(0, 1).reduce((acc, ti) => acc + ti.fraction * (grant.type === 'RSU' ? ti.price : ti.intrinsic), 0) || startingPrice;
      }
      // total across all tranches
      const sum = trancheInfos.reduce((acc, ti) => acc + ti.fraction * (grant.type === 'RSU' ? ti.price : ti.intrinsic), 0);
      return sum > 0 ? sum : startingPrice;
    })();
    shares = denom > 0 ? (grant.targetValue / denom) : 0;
  }

  const scheduleTranches = expandVesting(grant.vesting, grant.grantStartDate ?? offer.startDate, shares);
  const yStart = startOfYear(offerStart, yearIndex);
  const yEnd = endOfYear(offerStart, yearIndex);

  let value = 0;
  for (const t of scheduleTranches) {
    const d = new Date(t.date);
    // Use (start, end] window so boundary vests (e.g., 12-month cliff) count in the earlier year
    if (d > yStart && d <= yEnd) {
      // compute year index relative to offer start to apply YoY growth
      const yearsFromStart = growthYearIndex(d, offerStart);
      const price = priceAtVest(startingPrice, yoy, yearsFromStart);
      if (grant.type === 'RSU') {
        value += t.shares * price;
      } else {
        // If strike is blank, fall back to FMV or starting price
        const strike = grant.strike ?? grant.fmv ?? startingPrice;
        value += Math.max(0, price - strike) * t.shares;
      }
    }
  }
  return value;
}

function computeStockForYear(offer: TOffer, yearIndex: number): number {
  return offer.equityGrants.reduce((acc, g) => acc + grantValueForYear(offer, g, yearIndex), 0);
}

/**
 * Value of private-company (startup) equity vesting in a given offer year.
 *
 * Grants vest monthly from their grant start date (default: the offer start
 * date). A cliff vests its accrued portion as a lump at the cliff month;
 * the remainder vests monthly after that. Options are valued at intrinsic
 * value (share price minus strike); RSUs (including double-trigger) at the
 * full scenario share price.
 */
export type StartupGrantYearly = {
  label: string;
  kind: 'option' | 'rsu';
  /** Vested value per offer year (index 0 = year 1). */
  yearly: number[];
};

/** Per-grant yearly vested value for the startup equity block. */
export function computeStartupVesting(offer: TOffer): StartupGrantYearly[] {
  const block = offer.startupEquity;
  const years = offer.assumptions?.horizonYears ?? 4;
  const empty = (): number[] => Array.from({ length: years }, () => 0);
  if (!block?.enabled) return [];
  const sharePrice = impliedSharePrice(block.valuation, block.fullyDilutedShares);
  if (sharePrice <= 0) return [];
  const offerStart = new Date(offer.startDate);
  const inYear = (d: Date, yearIndex: number) => {
    const yStart = startOfYear(offerStart, yearIndex);
    const yEnd = endOfYear(offerStart, yearIndex);
    return d > yStart && d <= yEnd;
  };
  const yearOf = (d: Date): number | null => {
    for (let y = 0; y < years; y++) if (inYear(d, y)) return y;
    return null;
  };

  const out: StartupGrantYearly[] = [];
  for (const g of block.optionGrants ?? []) {
    const grantStart = new Date(g.grantStartDate ?? offer.startDate);
    const totalMonths = Math.max(1, Math.round(g.vestYears * 12));
    const cliff = Math.min(Math.max(0, g.cliffMonths ?? 0), totalMonths);
    const intrinsic = Math.max(0, sharePrice - g.strike);
    const yearly = empty();
    if (intrinsic > 0 && g.quantity > 0) {
      const credit = (date: Date, shares: number) => {
        const y = yearOf(date);
        if (y !== null) yearly[y] += shares * intrinsic;
      };
      if (cliff > 0) {
        // Cliff lump: the pro-rata portion accrued up to the cliff month.
        const cliffShares = (g.quantity * cliff) / totalMonths;
        credit(addMonths(grantStart, cliff), cliffShares);
        const remaining = g.quantity - cliffShares;
        const monthsAfter = totalMonths - cliff;
        for (let m = 1; m <= monthsAfter; m++) {
          credit(addMonths(grantStart, cliff + m), remaining / monthsAfter);
        }
      } else {
        for (let m = 1; m <= totalMonths; m++) {
          credit(addMonths(grantStart, m), g.quantity / totalMonths);
        }
      }
    }
    out.push({ label: g.label, kind: 'option', yearly });
  }
  for (const g of block.rsuGrants ?? []) {
    const grantStart = new Date(g.grantStartDate ?? offer.startDate);
    const totalMonths = Math.max(1, Math.round(g.vestYears * 12));
    const yearly = empty();
    if (g.shares > 0) {
      for (let m = 1; m <= totalMonths; m++) {
        const y = yearOf(addMonths(grantStart, m));
        if (y !== null) yearly[y] += (g.shares / totalMonths) * sharePrice;
      }
    }
    out.push({ label: g.label, kind: 'rsu', yearly });
  }
  return out;
}

function computeStartupStockForYear(offer: TOffer, yearIndex: number, vesting?: StartupGrantYearly[]): number {
  const schedule = vesting ?? computeStartupVesting(offer);
  return schedule.reduce((acc, g) => acc + (g.yearly[yearIndex] ?? 0), 0);
}

function computeOtherForYear(offer: TOffer, yearIndex: number): number {
  const offerStart = new Date(offer.startDate);
  const yStart = startOfYear(offerStart, yearIndex);
  const yEnd = endOfYear(offerStart, yearIndex);
  const col = offer.assumptions?.colAdjust ?? 1;
  let sum = 0;
  // signing/relocation
  for (const s of offer.signingBonuses ?? []) {
    const d = new Date(s.payDate);
    if (d >= yStart && d < yEnd) sum += s.amount * col;
  }
  for (const r of offer.relocationBonuses ?? []) {
    const d = new Date(r.payDate);
    if (d >= yStart && d < yEnd) sum += r.amount * col;
  }
  // benefits/misc recurring
  sum += (offer.benefits ?? []).filter(b => b.enabled).reduce((a, b) => a + b.annualValue * col, 0);
  sum += (offer.miscRecurring ?? []).reduce((a, m) => a + m.annualValue * col, 0);
  // retirement employer match (calculated if present)
  sum += computeRetirementMatch(offer, yearIndex);
  return sum;
}

export function computeOffer(offer: TOffer): YearRow[] {
  const years = offer.assumptions?.horizonYears ?? 4;
  const startupVesting = computeStartupVesting(offer);
  const rows: YearRow[] = [];
  for (let y = 0; y < years; y++) {
    const base = computeProratedBaseForYear(offer, y);
    const bonus = computeBonusForYear(offer, base);
    const stock = computeStockForYear(offer, y) + computeStartupStockForYear(offer, y, startupVesting);
    const other = computeOtherForYear(offer, y);
    const total = base + bonus + stock + other;
    rows.push({ year: y + 1, base, bonus, stock, other, total });
  }
  return rows;
}

// Expose retirement match calculation for UI display
export function computeRetirementMatch(offer: TOffer, yearIndex: number): number {
  if (!offer.retirement) return 0;
  const { employeeContributionPercent, matchRate, matchCapPercentOfSalary, employeeContributionCapDollar, matchCapMode, matchCapDollar } = offer.retirement;
  const base = computeProratedBaseForYear(offer, yearIndex); // already COL-adjusted
  // Employee contribution limited by percent of salary and IRS cap
  const employeeContributionByPercent = employeeContributionPercent * base;
  const employeeContribution = Math.min(employeeContributionByPercent, employeeContributionCapDollar);
  // Employer match base limited by plan cap (percent of salary or dollar) AND how much employee actually contributes
  const planCapByPercent = matchCapPercentOfSalary * base;
  const planCap = matchCapMode === 'dollar' ? matchCapDollar : planCapByPercent;
  const matchBase = Math.min(employeeContribution, planCap);
  return matchBase * matchRate;
}
