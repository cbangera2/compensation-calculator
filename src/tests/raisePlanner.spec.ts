import { describe, it, expect } from 'vitest';
import {
  projectTrajectory,
  compareScenarios,
  summarizeScenario,
  refreshIncomePerYear,
  addYearsToIso,
  type TrajectoryScenario,
} from '@/core/raisePlanner';
import { computeOffer } from '@/core/compute';
import type { TOffer } from '@/models/types';

function makeOffer(overrides: Partial<TOffer> = {}): TOffer {
  return {
    name: 'Test',
    currency: 'USD',
    startDate: '2025-01-01',
    colFactor: 1,
    base: { startAnnual: 100_000 },
    raises: [],
    equityGrants: [],
    benefits: [],
    miscRecurring: [],
    assumptions: { horizonYears: 4, colAdjust: 1 },
    ...overrides,
  } as TOffer;
}

const FLAT: TrajectoryScenario = { name: 'Flat', annualRaisePct: 0, refreshGrantAnnual: 0 };

describe('projectTrajectory', () => {
  it('with no raises matches computeOffer on a raise-free copy of the offer', () => {
    const offer = makeOffer({ raises: [{ effectiveDate: '2026-01-01', type: 'percent', value: 0.5 }] });
    const { rows } = projectTrajectory(offer, FLAT, 4);
    // Scenario raises replace offer.raises, so rows equal computeOffer with raises stripped.
    const expected = computeOffer({ ...offer, raises: [], assumptions: { horizonYears: 4, colAdjust: 1 } } as TOffer);
    expect(rows).toHaveLength(4);
    rows.forEach((r, i) => {
      expect(Math.round(r.base)).toBe(Math.round(expected[i].base));
      expect(Math.round(r.total)).toBe(Math.round(expected[i].total));
    });
  });

  it('ignores offer.raises (no double-counting)', () => {
    const offer = makeOffer({ raises: [{ effectiveDate: '2026-01-01', type: 'percent', value: 0.2 }] });
    const { rows } = projectTrajectory(offer, { name: 'X', annualRaisePct: 0.08, refreshGrantAnnual: 0 }, 3);
    expect(Math.round(rows[0].base)).toBe(100_000);
    expect(Math.round(rows[1].base)).toBe(108_000);
    expect(Math.round(rows[2].base)).toBe(116_640);
  });

  it('compounds the annual raise each year', () => {
    const { rows } = projectTrajectory(makeOffer(), { name: 'X', annualRaisePct: 0.1, refreshGrantAnnual: 0 }, 3);
    expect(Math.round(rows[0].base)).toBe(100_000);
    expect(Math.round(rows[1].base)).toBe(110_000);
    expect(Math.round(rows[2].base)).toBe(121_000);
  });

  it('models refresh grants as even 4-year vesting', () => {
    const { rows } = projectTrajectory(makeOffer(), { name: 'X', annualRaisePct: 0, refreshGrantAnnual: 20_000 }, 5);
    const refresh = rows.map((r) => Math.round(r.refresh));
    expect(refresh).toEqual([5000, 10000, 15000, 20000, 20000]);
    refresh.forEach((v, i) => expect(Math.round(rows[i].total)).toBe(Math.round(rows[i].base + rows[i].bonus + rows[i].stock + rows[i].other + v)));
  });

  it('applies a promotion bump at the given year only', () => {
    const s: TrajectoryScenario = {
      name: 'X', annualRaisePct: 0.08, refreshGrantAnnual: 0, promoYear: 3, promoBumpPct: 0.15,
    };
    const { rows } = projectTrajectory(makeOffer(), s, 4);
    expect(Math.round(rows[0].base)).toBe(100_000);
    expect(Math.round(rows[1].base)).toBe(108_000);
    // Year 3: 8% annual raise then 15% promo bump
    expect(Math.round(rows[2].base)).toBe(Math.round(108_000 * 1.08 * 1.15));
    // Year 4 continues from the bumped base
    expect(Math.round(rows[3].base)).toBe(Math.round(rows[2].base * 1.08));
  });

  it('ignores a promotion outside the horizon', () => {
    const s: TrajectoryScenario = {
      name: 'X', annualRaisePct: 0.08, refreshGrantAnnual: 0, promoYear: 9, promoBumpPct: 0.5,
    };
    const { rows } = projectTrajectory(makeOffer(), s, 4);
    expect(Math.round(rows[3].base)).toBe(Math.round(100_000 * 1.08 ** 3));
  });

  it('extends the horizon and drops existing stock to zero after vest-out', () => {
    const offer = makeOffer({
      equityGrants: [
        {
          type: 'RSU' as const,
          shares: 4000,
          fmv: 10,
          vesting: { model: 'standard' as const, years: 2, cliffMonths: 0, frequency: 'annual' as const, distribution: 'even' as const, cliffPercent: 0 },
          grantStartDate: '2025-01-01',
        },
      ],
    });
    const { rows } = projectTrajectory(offer, FLAT, 5);
    expect(rows).toHaveLength(5);
    expect(rows[0].stock).toBeGreaterThan(0);
    expect(rows[1].stock).toBeGreaterThan(0);
    // Grants fully vest by year 2; years 3-5 have no existing stock income.
    expect(rows[2].stock).toBe(0);
    expect(rows[4].stock).toBe(0);
  });

  it('scales percent bonuses with the raised base', () => {
    const offer = makeOffer({
      performanceBonus: { kind: 'percent' as const, value: 0.1, expectedPayout: 1 },
    });
    const { rows } = projectTrajectory(offer, { name: 'X', annualRaisePct: 0.1, refreshGrantAnnual: 0 }, 2);
    expect(Math.round(rows[1].bonus)).toBe(11_000);
  });

  it('throws on invalid scenarios', () => {
    expect(() => projectTrajectory(makeOffer(), { name: '', annualRaisePct: 0, refreshGrantAnnual: 0 }, 5)).toThrow();
    expect(() => projectTrajectory(makeOffer(), { name: 'X', annualRaisePct: 0, refreshGrantAnnual: -1 }, 5)).toThrow();
    expect(() => compareScenarios(makeOffer(), [], 5)).toThrow();
  });
});

describe('refreshIncomePerYear', () => {
  it('stacks overlapping refresh grants', () => {
    expect(refreshIncomePerYear(40_000, 5)).toEqual([10_000, 20_000, 30_000, 40_000, 40_000]);
  });
  it('returns zeros for no refresh', () => {
    expect(refreshIncomePerYear(0, 3)).toEqual([0, 0, 0]);
  });
});

describe('compareScenarios', () => {
  it('aligns year rows across scenarios', () => {
    const scenarios: TrajectoryScenario[] = [
      { name: 'Low', annualRaisePct: 0.03, refreshGrantAnnual: 0 },
      { name: 'High', annualRaisePct: 0.08, refreshGrantAnnual: 20_000 },
    ];
    const cmp = compareScenarios(makeOffer(), scenarios, 5);
    expect(cmp.years).toEqual([1, 2, 3, 4, 5]);
    expect(cmp.series.map((s) => s.name)).toEqual(['Low', 'High']);
    expect(cmp.series).toHaveLength(2);
    cmp.series.forEach((s) => {
      expect(s.totals).toHaveLength(5);
      expect(s.rows).toHaveLength(5);
    });
    // Higher scenario beats lower in year 5
    expect(cmp.series[1].totals[4]).toBeGreaterThan(cmp.series[0].totals[4]);
  });
});

describe('summarizeScenario', () => {
  it('mentions year-5 total, raise, refresh, and promo', () => {
    const s: TrajectoryScenario = {
      name: 'Dream', annualRaisePct: 0.08, refreshGrantAnnual: 20_000, promoYear: 2, promoBumpPct: 0.15,
    };
    const result = projectTrajectory(makeOffer(), s, 5);
    const text = summarizeScenario(result);
    const y5 = Math.round(result.rows[4].total).toLocaleString('en-US');
    expect(text).toContain('Year 5');
    expect(text).toContain(y5);
    expect(text).toContain('8%');
    expect(text).toContain('promo in Y2');
    expect(text).toContain('projected');
  });
});

describe('addYearsToIso (timezone regression)', () => {
  it('never shifts the date regardless of local timezone', () => {
    // Regression: new Date('2025-01-01') parses as UTC midnight; formatting
    // back in America/Detroit yielded 2024-12-31, leaking a day of each
    // annual raise into the prior year.
    expect(addYearsToIso('2025-01-01', 1)).toBe('2026-01-01');
    expect(addYearsToIso('2025-07-15', 4)).toBe('2029-07-15');
    expect(addYearsToIso('2024-02-29', 1)).toBe('2025-02-29');
    expect(() => addYearsToIso('not-a-date', 1)).toThrow();
  });
});
