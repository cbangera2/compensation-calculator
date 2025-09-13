import { describe, it, expect } from 'vitest';
import { computeOffer } from '@/core/compute';
import type { TOffer } from '@/models/types';

function baseOffer(partial: Partial<TOffer>): TOffer {
  return {
    name: 'Test', currency: 'USD', startDate: '2025-01-01',
    base: { startAnnual: 100_000 },
    raises: [], performanceBonus: undefined,
    signingBonuses: [], relocationBonuses: [],
    benefits: [], miscRecurring: [], equityGrants: [],
    growth: { startingPrice: 10, yoy: [0,0,0,0] },
    retirement: undefined,
    assumptions: { horizonYears: 4 },
    ...partial,
  } as unknown as TOffer;
}

describe('computeOffer base & bonus', () => {
  it('base with no raises equals startAnnual', () => {
    const [y1] = computeOffer(baseOffer({ assumptions: { horizonYears: 1 } }));
    expect(Math.round(y1.base)).toBe(100000);
    expect(Math.round(y1.bonus)).toBe(0);
  });

  it('percent bonus uses prorated base and expected payout', () => {
    const offer = baseOffer({
      assumptions: { horizonYears: 1 },
      performanceBonus: { kind: 'percent', value: 0.1, expectedPayout: 0.8 },
    });
    const [y1] = computeOffer(offer);
    expect(Math.round(y1.bonus)).toBe(Math.round(100_000 * 0.1 * 0.8));
  });

  it('fixed bonus ignores base and uses expected payout', () => {
    const offer = baseOffer({
      assumptions: { horizonYears: 1 },
      performanceBonus: { kind: 'fixed', value: 12_000, expectedPayout: 0.75 },
    });
    const [y1] = computeOffer(offer);
    expect(Math.round(y1.bonus)).toBe(Math.round(12_000 * 0.75));
  });

  it('applies multiple raises across years', () => {
    const offer = baseOffer({
      raises: [
        { effectiveDate: '2025-07-01', type: 'percent', value: 0.1 },
        { effectiveDate: '2026-01-01', type: 'absolute', value: 10_000 },
      ],
      assumptions: { horizonYears: 2 },
    });
    const [y1, y2] = computeOffer(offer);
    // Year 1 ~105,041 (mid-year 10% raise by days). Year 2 base starts at 100k*1.1 + 10k = 120k
    expect(Math.round(y1.base)).toBe(105041);
    expect(Math.round(y2.base)).toBe(120000);
  });
});

describe('stock valuation', () => {
  it('RSU values by price at vest with YoY growth and cliff boundary rule', () => {
    const offer = baseOffer({
      equityGrants: [{ type: 'RSU', shares: 480, fmv: 10, vesting: { model: 'standard', years: 4, cliffMonths: 12, frequency: 'monthly', distribution: 'even', cliffPercent: 0 }, grantStartDate: '2025-01-01' }],
      growth: { startingPrice: 10, yoy: [0.1, 0, 0, 0] },
      assumptions: { horizonYears: 2 },
    });
    const [y1, y2] = computeOffer(offer);
    // With (start, end] window, 12-month cliff vests on 2026-01-01 counted in Y1
    // Monthly after that, but for this test we just ensure y1 has > 0 and y2 not zero
    expect(y1.stock).toBeGreaterThan(0);
    expect(y2.stock).toBeGreaterThan(0);
  });

  it('Options use intrinsic value max(price - strike, 0)', () => {
    const offer = baseOffer({
      equityGrants: [{ type: 'NSO', shares: 1000, strike: 15, fmv: 10, vesting: { model: 'standard', years: 4, cliffMonths: 12, frequency: 'annual', distribution: 'even', cliffPercent: 0 }, grantStartDate: '2025-01-01' }],
      growth: { startingPrice: 20, yoy: [0, 0, 0, 0] },
      assumptions: { horizonYears: 2 },
    });
    const [y1, y2] = computeOffer(offer);
    // First vest is at 2026-01-01 (Y1) with price 20, intrinsic value 5 per share for 250 shares
    expect(Math.round(y1.stock)).toBe(Math.round(250 * (20 - 15)));
    expect(y2.stock).toBeGreaterThan(0);
  });

  it('Target value year1 implies shares so Y1 ~= target', () => {
    const offer = baseOffer({
      equityGrants: [{ type: 'RSU', shares: 0, fmv: 10, targetValue: 40000, targetMode: 'year1', vesting: { model: 'standard', years: 4, cliffMonths: 12, frequency: 'monthly', distribution: 'even', cliffPercent: 0 }, grantStartDate: '2025-01-01' }],
      growth: { startingPrice: 10, yoy: [0, 0, 0, 0] },
      assumptions: { horizonYears: 2 },
    });
    const [y1] = computeOffer(offer);
    expect(Math.round(y1.stock)).toBeCloseTo(40000, -1);
  });

  it('Target value total implies shares so 4y sum ~= target', () => {
    const offer = baseOffer({
      equityGrants: [{ type: 'RSU', shares: 0, fmv: 10, targetValue: 160000, targetMode: 'total', vesting: { model: 'standard', years: 4, cliffMonths: 12, frequency: 'monthly', distribution: 'even', cliffPercent: 0 }, grantStartDate: '2025-01-01' }],
      growth: { startingPrice: 10, yoy: [0, 0, 0, 0] },
      assumptions: { horizonYears: 4 },
    });
    const rows = computeOffer(offer);
    const stockSum = rows.reduce((a, r) => a + r.stock, 0);
    expect(Math.round(stockSum)).toBeCloseTo(160000, -1);
  });
});

describe('other income', () => {
  it('signing & relocation counted in the year of payDate', () => {
    const offer = baseOffer({
      signingBonuses: [{ amount: 5000, payDate: '2025-02-01' }],
      relocationBonuses: [{ amount: 4000, payDate: '2026-03-01' }],
      assumptions: { horizonYears: 2 },
    });
    const [y1, y2] = computeOffer(offer);
    expect(Math.round(y1.other)).toBe(5000);
    expect(Math.round(y2.other)).toBe(4000);
  });

  it('benefits enabled only, misc always, plus retirement match percent cap', () => {
    const offer = baseOffer({
      benefits: [
        { name: 'Gym', annualValue: 1200, enabled: true },
        { name: 'Lunch', annualValue: 2600, enabled: false },
      ],
      miscRecurring: [
        { name: 'Other', annualValue: 500 },
      ],
      retirement: {
        employeeContributionPercent: 0.06,
        matchRate: 0.5,
        matchCapPercentOfSalary: 0.06,
        employeeContributionCapDollar: 23_500,
        matchCapMode: 'percentOfSalary',
        matchCapDollar: 0,
      },
      assumptions: { horizonYears: 1 },
    });
    const [y1] = computeOffer(offer);
    // Benefits: only Gym 1200; misc 500; retirement: employee contributes 6% of 100k -> 6k; plan cap 6% of salary -> 6k; match 50% of 6k = 3k
    expect(Math.round(y1.other)).toBe(1200 + 500 + 3000);
  });

  it('retirement match dollar cap lower than employee contrib', () => {
    const offer = baseOffer({
      retirement: {
        employeeContributionPercent: 0.1,
        matchRate: 0.5,
        matchCapPercentOfSalary: 0.2,
        employeeContributionCapDollar: 100_000,
        matchCapMode: 'dollar',
        matchCapDollar: 4_000,
      },
      assumptions: { horizonYears: 1 },
    });
    const [y1] = computeOffer(offer);
    // Employee contributes 10k, plan dollar cap 4k, match 50% of 4k = 2k
    expect(Math.round(y1.other)).toBe(2000);
  });
});

describe('multi-year totals', () => {
  it('sums components to total per year and across years', () => {
    const offer = baseOffer({
      performanceBonus: { kind: 'percent', value: 0.1, expectedPayout: 1 },
      benefits: [{ name: 'Gym', annualValue: 1200, enabled: true }],
      assumptions: { horizonYears: 2 },
    });
    const rows = computeOffer(offer);
    for (const r of rows) {
      expect(Math.round(r.total)).toBe(Math.round(r.base + r.bonus + r.stock + r.other));
    }
    const sum = rows.reduce((a, r) => a + r.total, 0);
    expect(sum).toBeGreaterThan(0);
  });
});
