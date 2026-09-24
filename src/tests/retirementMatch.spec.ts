import { describe, expect, it } from 'vitest';
import { differenceInCalendarMonths } from 'date-fns';
import { computeOffer, computeRetirementMatch } from '@/core/compute';
import { expandVesting } from '@/core/vesting';
import { Offer, type TOffer } from '@/models/types';

// Regression tests for the 2026-09-24 audit fixes (C1/I2/I3/I11).
// The I2/I3 tests live here because this spec is the only new test file in
// scope; they may be relocated to core.spec.ts / compute.spec.ts later.

function baseOffer(partial: Partial<TOffer> & { startDate?: string }): TOffer {
  return {
    name: 'Test',
    currency: 'USD',
    startDate: '2025-01-01',
    base: { startAnnual: 100_000 },
    raises: [],
    performanceBonus: undefined,
    signingBonuses: [],
    relocationBonuses: [],
    benefits: [],
    miscRecurring: [],
    equityGrants: [],
    growth: { startingPrice: 10, yoy: [0, 0, 0, 0] },
    retirement: undefined,
    assumptions: { horizonYears: 4, colAdjust: 1 },
    ...partial,
  } as unknown as TOffer;
}

describe('computeRetirementMatch', () => {
  it('returns 0 when there is no retirement block', () => {
    expect(computeRetirementMatch(baseOffer({}), 0)).toBe(0);
  });

  it('computes a standard 6% / 50% match', () => {
    // 6% of 100k = 6,000 contributed; plan caps at 6% of salary = 6,000;
    // match = 50% of 6,000 = 3,000
    const offer = baseOffer({
      retirement: {
        employeeContributionPercent: 0.06,
        matchRate: 0.5,
        matchCapPercentOfSalary: 0.06,
        employeeContributionCapDollar: 24500,
        matchCapMode: 'percentOfSalary',
        matchCapDollar: 0,
      },
    });
    expect(computeRetirementMatch(offer, 0)).toBeCloseTo(3000, 6);
  });

  it('treats percents as fractions (0.06 = 6%, not 6x)', () => {
    const offer = baseOffer({
      retirement: {
        employeeContributionPercent: 0.06,
        matchRate: 1,
        matchCapPercentOfSalary: 1,
        employeeContributionCapDollar: 24500,
        matchCapMode: 'percentOfSalary',
        matchCapDollar: 0,
      },
    });
    // 100% match on 6% of 100k, capped at 100% of salary
    expect(computeRetirementMatch(offer, 0)).toBeCloseTo(6000, 6);
  });

  it('caps the match when the employee contributes less than the plan cap', () => {
    // Employee puts in 2% (2,000); plan would allow 6% (6,000) — match is
    // limited by what the employee actually contributed.
    const offer = baseOffer({
      retirement: {
        employeeContributionPercent: 0.02,
        matchRate: 0.5,
        matchCapPercentOfSalary: 0.06,
        employeeContributionCapDollar: 24500,
        matchCapMode: 'percentOfSalary',
        matchCapDollar: 0,
      },
    });
    expect(computeRetirementMatch(offer, 0)).toBeCloseTo(1000, 6);
  });

  it('supports a fixed dollar match cap', () => {
    const offer = baseOffer({
      retirement: {
        employeeContributionPercent: 0.06,
        matchRate: 0.5,
        matchCapPercentOfSalary: 0.06,
        employeeContributionCapDollar: 24500,
        matchCapMode: 'dollar',
        matchCapDollar: 2000,
      },
    });
    // matchBase = min(6000, 2000) = 2000; match = 1000
    expect(computeRetirementMatch(offer, 0)).toBeCloseTo(1000, 6);
  });

  it('binds employee contributions to the IRS dollar cap', () => {
    // 10% of 300k = 30,000 > 24,500 IRS cap; plan caps match at 6% of salary
    // = 18,000, which binds below the capped contribution.
    const offer = baseOffer({
      startDate: '2025-01-01',
      base: { startAnnual: 300_000 },
      retirement: {
        employeeContributionPercent: 0.1,
        matchRate: 0.5,
        matchCapPercentOfSalary: 0.06,
        employeeContributionCapDollar: 24500,
        matchCapMode: 'percentOfSalary',
        matchCapDollar: 0,
      },
    });
    // matchBase = min(24500, 18000) = 18000; match = 9000
    expect(computeRetirementMatch(offer, 0)).toBeCloseTo(9000, 6);
  });

  it('defaults the IRS elective-deferral cap to $24,500 (2026 limit)', () => {
    const parsed = Offer.parse({
      name: 't',
      startDate: '2025-01-01',
      base: { startAnnual: 100_000 },
      retirement: {},
    });
    expect(parsed.retirement?.employeeContributionCapDollar).toBe(24500);
  });
});

describe('I2 expandVesting with cliffMonths: 0', () => {
  it('produces 48 tranches for a 4-year monthly schedule, first at month 1', () => {
    const tranches = expandVesting(
      { model: 'standard', years: 4, cliffMonths: 0, frequency: 'monthly', distribution: 'even', cliffPercent: 0 },
      '2025-01-01',
      4800
    );
    expect(tranches.length).toBe(48);
    expect(tranches[0].date.startsWith('2025-02')).toBe(true); // no day-0 tranche
    tranches.forEach((t) => expect(t.shares).toBeCloseTo(100, 6));
    const total = tranches.reduce((a, t) => a + t.shares, 0);
    expect(total).toBeCloseTo(4800, 6);
  });

  it('quarterly no-cliff gives 16 tranches starting at month 3', () => {
    const tranches = expandVesting(
      { model: 'standard', years: 4, cliffMonths: 0, frequency: 'quarterly', distribution: 'even', cliffPercent: 0 },
      '2025-01-01',
      1600
    );
    expect(tranches.length).toBe(16);
    // First tranche lands ~3 months after grant start (date-fns end-of-month
    // clamping can put it on Mar 31 local time, so assert elapsed months,
    // not the calendar-month string).
    expect(differenceInCalendarMonths(new Date(tranches[0].date), new Date('2025-01-01'))).toBe(3);
    const total = tranches.reduce((a, t) => a + t.shares, 0);
    expect(total).toBeCloseTo(1600, 6);
  });

  it('keeps existing cliff behavior: cliff tranche plus monthly remainder', () => {
    const tranches = expandVesting(
      { model: 'standard', years: 4, cliffMonths: 12, frequency: 'monthly', distribution: 'even', cliffPercent: 0 },
      '2025-01-01',
      4800
    );
    expect(tranches.length).toBe(37);
    expect(tranches[0].date.startsWith('2026-01')).toBe(true);
    expect(tranches[0].shares).toBeCloseTo(1200, 6); // 25% at the 12-month cliff
    const total = tranches.reduce((a, t) => a + t.shares, 0);
    expect(total).toBeCloseTo(4800, 6);
  });
});

describe('I3 computeOffer indexes growth by elapsed time', () => {
  it('does not apply a full year of growth 6 months after a mid-year start', () => {
    const offer = baseOffer({
      startDate: '2025-07-01',
      equityGrants: [
        {
          type: 'RSU',
          shares: 1200,
          vesting: {
            model: 'standard',
            years: 4,
            cliffMonths: 0,
            frequency: 'monthly',
            distribution: 'even',
            cliffPercent: 0,
          },
          grantStartDate: '2025-07-01',
        },
      ],
      growth: { startingPrice: 100, yoy: [0.1, 0.1, 0.1, 0.1] },
    });
    const [y1, y2] = computeOffer(offer);
    // Year 1 window (2025-07-01, 2026-07-01]: months 1..11 at $100, month 12 at $110.
    // 11 * 25 * 100 + 25 * 110 = 30,250. The old calendar-year indexing priced
    // months 6..12 at $110 and gave 31,750.
    expect(Math.round(y1.stock)).toBe(30250);
    // Year 2: months 13..23 at $110, month 24 at $121 -> 11*25*110 + 25*121 = 33,275
    expect(Math.round(y2.stock)).toBe(33275);
  });
});
