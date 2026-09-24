import { describe, it, expect } from 'vitest';
import { computeOffer } from '@/core/compute';
import type { TOffer, TStartupEquity } from '@/models/types';

function startupOffer(startupEquity: TStartupEquity, startDate = '2024-07-15'): TOffer {
  return {
    name: 'Startup', currency: 'USD', startDate,
    base: { startAnnual: 142_000 },
    raises: [], performanceBonus: undefined,
    signingBonuses: [], relocationBonuses: [],
    benefits: [], miscRecurring: [], equityGrants: [],
    retirement: undefined,
    assumptions: { horizonYears: 4, colAdjust: 1 },
    startupEquity,
  } as unknown as TOffer;
}

function block(overrides: Partial<TStartupEquity> = {}): TStartupEquity {
  return {
    enabled: true,
    companyName: 'TestCo',
    valuation: 15_000_000_000,
    fullyDilutedShares: 100_509_245, // ~$149.24/share
    optionGrants: [],
    rsuGrants: [],
    ...overrides,
  };
}

describe('startup equity feeds computeOffer (regression: equity-over-4-years showed $0)', () => {
  it('includes startup option value in yearly stock rows', () => {
    const offer = startupOffer(block({
      optionGrants: [
        { label: 'new hire', quantity: 3091, strike: 31.09, fmvAtGrant: 136.39, vestYears: 4, cliffMonths: 12 },
      ],
    }));
    const rows = computeOffer(offer);
    const total = rows.reduce((a, r) => a + r.stock, 0);
    // ~3091 * (149.24 - 31.09) fully vested over 4 years
    expect(total).toBeGreaterThan(300_000);
    expect(total).toBeLessThan(450_000);
    // Year 1 vests the 25% cliff lump, matching each later year's 25%
    expect(rows[0].stock).toBeCloseTo(total / 4, -2);
    expect(rows[1].stock).toBeCloseTo(total / 4, -2);
  });

  it('includes double-trigger RSU value in yearly stock rows', () => {
    const offer = startupOffer(block({
      rsuGrants: [
        { label: 'rsus', shares: 1105, fmvAtGrant: 149.24, doubleTrigger: true, vestYears: 4 },
      ],
    }));
    const rows = computeOffer(offer);
    const total = rows.reduce((a, r) => a + r.stock, 0);
    expect(total).toBeGreaterThan(130_000);
    expect(total).toBeLessThan(200_000);
  });

  it('returns 0 stock when the block is disabled or absent', () => {
    const disabled = startupOffer(block({
      enabled: false,
      rsuGrants: [{ label: 'rsus', shares: 1105, fmvAtGrant: 149.24, doubleTrigger: true, vestYears: 4 }],
    }));
    expect(computeOffer(disabled).every((r) => r.stock === 0)).toBe(true);
    const absent = startupOffer(undefined as unknown as TStartupEquity);
    expect(computeOffer(absent).every((r) => r.stock === 0)).toBe(true);
  });

  it('honors grantStartDate for refresh grants', () => {
    const offer = startupOffer(block({
      rsuGrants: [
        { label: 'refresh', shares: 222, fmvAtGrant: 149.24, doubleTrigger: true, vestYears: 2, grantStartDate: '2025-07-15' },
      ],
    }));
    const rows = computeOffer(offer);
    // Grant starts at the beginning of offer-year 2, so year 1 gets nothing
    expect(rows[0].stock).toBe(0);
    expect(rows[1].stock).toBeGreaterThan(0);
  });

  it('adds startup stock on top of public equityGrants without double counting', () => {
    const withStartup = startupOffer(block({
      rsuGrants: [{ label: 'rsus', shares: 100, fmvAtGrant: 149.24, doubleTrigger: false, vestYears: 4 }],
    }));
    const withoutStartup = startupOffer(block({ enabled: false }));
    const a = computeOffer(withStartup).reduce((x, r) => x + r.total, 0);
    const b = computeOffer(withoutStartup).reduce((x, r) => x + r.total, 0);
    expect(a - b).toBeGreaterThan(10_000);
  });
});
