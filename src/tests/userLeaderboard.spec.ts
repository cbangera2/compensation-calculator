import { describe, expect, it } from 'vitest';
import {
  equityGrantTotal4yrAtGrant,
  offerSigningTotal,
  offerStockGrantTotal4yr,
  offerToLeaderboardEntry,
} from '../lib/userLeaderboard';
import { offerTcAtGrant } from '../lib/leaderboard';
import type { TOffer } from '@/models/types';

function makeOffer(partial: Partial<TOffer> = {}): TOffer {
  return {
    id: 'offer-1',
    name: 'DemoCo',
    currency: 'USD',
    startDate: '2026-01-01',
    location: 'Ann Arbor, MI',
    base: { startAnnual: 150000 },
    raises: [],
    benefits: [],
    miscRecurring: [],
    equityGrants: [],
    assumptions: { horizonYears: 4, colAdjust: 1 },
    ...partial,
  } as TOffer;
}

const RSU_GRANT = {
  type: 'RSU' as const,
  shares: 1000,
  fmv: 100,
  vesting: {
    model: 'standard' as const,
    years: 4,
    cliffMonths: 12,
    frequency: 'monthly' as const,
    distribution: 'even' as const,
    cliffPercent: 0,
  },
};

describe('equityGrantTotal4yrAtGrant', () => {
  it('values RSUs as shares × FMV', () => {
    expect(equityGrantTotal4yrAtGrant(RSU_GRANT, 50)).toBe(100000);
  });

  it('falls back to the offer starting price when FMV is missing', () => {
    const { fmv: _fmv, ...noFmv } = RSU_GRANT;
    expect(equityGrantTotal4yrAtGrant(noFmv, 120)).toBe(120000);
  });

  it('values options as intrinsic value (shares × max(0, fmv − strike))', () => {
    const opt = { ...RSU_GRANT, type: 'NSO' as const, strike: 40 };
    expect(equityGrantTotal4yrAtGrant(opt, 0)).toBe(1000 * 60);
  });

  it('values underwater options at zero, not negative', () => {
    const opt = { ...RSU_GRANT, type: 'ISO' as const, strike: 200 };
    expect(equityGrantTotal4yrAtGrant(opt, 0)).toBe(0);
  });

  it('uses targetValue directly when targetMode is total', () => {
    const g = { ...RSU_GRANT, targetValue: 200000, targetMode: 'total' as const };
    expect(equityGrantTotal4yrAtGrant(g, 999)).toBe(200000);
  });

  it('annualizes targetValue × 4 when targetMode is year1 (the default)', () => {
    const g = { ...RSU_GRANT, targetValue: 50000, targetMode: 'year1' as const };
    expect(equityGrantTotal4yrAtGrant(g, 999)).toBe(200000);
    const gDefault = { ...RSU_GRANT, targetValue: 50000 };
    expect(equityGrantTotal4yrAtGrant(gDefault, 999)).toBe(200000);
  });
});

describe('offerStockGrantTotal4yr', () => {
  it('sums public grants', () => {
    const offer = makeOffer({ equityGrants: [RSU_GRANT, { ...RSU_GRANT, shares: 500, fmv: 100 }] });
    expect(offerStockGrantTotal4yr(offer)).toBe(150000);
  });

  it('is zero for offers with no equity', () => {
    expect(offerStockGrantTotal4yr(makeOffer())).toBe(0);
  });

  it('includes startup equity at grant-date value', () => {
    const offer = makeOffer({
      startupEquity: {
        enabled: true,
        companyName: 'Example Startup',
        valuation: 1_000_000_000,
        fullyDilutedShares: 100_000_000,
        optionGrants: [
          {
            label: 'Option grant',
            quantity: 1000,
            strike: 10,
            fmvAtGrant: 15,
            vestYears: 4,
            cliffMonths: 12,
          },
        ],
        rsuGrants: [{ label: 'RSU grant', shares: 500, fmvAtGrant: 15, doubleTrigger: true, vestYears: 4 }],
        savedScenarios: [],
      },
    });
    // options: 1000 × (15 − 10) = 5000; RSUs: 500 × 15 = 7500
    expect(offerStockGrantTotal4yr(offer)).toBe(12500);
  });

  it('ignores disabled startup equity', () => {
    const offer = makeOffer({
      startupEquity: {
        enabled: false,
        companyName: 'Example Startup',
        valuation: 1_000_000_000,
        fullyDilutedShares: 100_000_000,
        optionGrants: [
          {
            label: 'Option grant',
            quantity: 1000,
            strike: 10,
            fmvAtGrant: 15,
            vestYears: 4,
            cliffMonths: 12,
          },
        ],
        rsuGrants: [],
        savedScenarios: [],
      },
    });
    expect(offerStockGrantTotal4yr(offer)).toBe(0);
  });
});

describe('offerSigningTotal', () => {
  it('sums all signing bonus payments', () => {
    const offer = makeOffer({
      signingBonuses: [
        { amount: 20000, payDate: '2026-01-15' },
        { amount: 10000, payDate: '2027-01-15' },
      ],
    });
    expect(offerSigningTotal(offer)).toBe(30000);
  });

  it('is zero when there are no signing bonuses', () => {
    expect(offerSigningTotal(makeOffer())).toBe(0);
  });
});

describe('offerToLeaderboardEntry', () => {
  it('produces a schema-valid entry marked as a user offer', () => {
    const offer = makeOffer({
      equityGrants: [RSU_GRANT],
      signingBonuses: [{ amount: 25000, payDate: '2026-01-15' }],
      jobLevel: 'IC2',
    });
    const entry = offerToLeaderboardEntry(offer, '2024');
    expect(entry.isUserOffer).toBe(true);
    expect(entry.offerId).toBe('offer-1');
    expect(entry.company).toBe('DemoCo');
    expect(entry.group).toBe('user');
    expect(entry.ticker).toBeNull();
    expect(entry.base).toBe(150000);
    expect(entry.signingBonus).toBe(25000);
    expect(entry.stockGrantTotal4yr).toBe(100000);
    expect(entry.grantDate).toBe('2024-08-01');
    expect(entry.confidence).toBe('estimate');
    expect(entry.sampleBand).toBe('unknown');
    expect(entry.source).toBe('Your custom offer');
    expect(entry.levelLabel).toBe('IC2');
    expect(entry.city).toBe('Ann Arbor, MI');
  });

  it('uses the active year tab’s canonical grant date', () => {
    const offer = makeOffer();
    expect(offerToLeaderboardEntry(offer, '2025').grantDate).toBe('2025-08-01');
    expect(offerToLeaderboardEntry(offer, '2026').grantDate).toBe('2026-08-01');
  });

  it('falls back gracefully on blank names and missing fields', () => {
    const offer = makeOffer({ name: '   ', location: undefined, jobLevel: undefined, jobTitle: undefined });
    const entry = offerToLeaderboardEntry(offer, '2024');
    expect(entry.company).toBe('Your offer');
    expect(entry.city).toBe('US');
    expect(entry.levelLabel).toBe('Your offer');
  });

  it('rounds fractional dollars to whole ints for the schema', () => {
    const offer = makeOffer({
      base: { startAnnual: 142000.75 },
      equityGrants: [{ ...RSU_GRANT, shares: 333, fmv: 100.5 }],
    });
    const entry = offerToLeaderboardEntry(offer, '2024');
    expect(Number.isInteger(entry.base)).toBe(true);
    expect(Number.isInteger(entry.stockGrantTotal4yr)).toBe(true);
  });

  it('feeds the same offer-TC-at-grant math as sourced rows', () => {
    const offer = makeOffer({
      equityGrants: [RSU_GRANT],
      signingBonuses: [{ amount: 40000, payDate: '2026-01-15' }],
    });
    const entry = offerToLeaderboardEntry(offer, '2024');
    // base + signing + stock/4
    expect(offerTcAtGrant(entry)).toBe(150000 + 40000 + 25000);
  });

  it('keeps distinct offer ids when two offers share a name', () => {
    const a = offerToLeaderboardEntry(makeOffer({ id: 'a', name: 'Acme' }), '2024');
    const b = offerToLeaderboardEntry(makeOffer({ id: 'b', name: 'Acme' }), '2024');
    expect(a.offerId).not.toBe(b.offerId);
  });
});
