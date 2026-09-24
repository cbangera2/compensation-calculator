import { describe, expect, it } from 'vitest';
import {
  GRANT_DATE_ASSUMPTION,
  LEADERBOARD_2024,
  LeaderboardEntry,
  PRIVATE_ENTRIES,
  PUBLIC_ENTRIES,
} from '@/data/leaderboard2024';
import {
  offerTcAtGrant,
  priceAtDate,
  realized4yr,
  stockGrowthSinceGrant,
  type GrantPricePoints,
} from '@/lib/leaderboard';
import { isSupportedTicker } from '@/lib/market';
import type { MonthlyClose } from '@/lib/market';

const prices: GrantPricePoints = {
  priceAtGrant: 100,
  priceNow: 150,
  grantAnchorDate: '2024-08-01',
  asOfDate: '2026-08-31',
};

describe('leaderboard2024 dataset', () => {
  it('has a defensible number of aggregate entries and none from Applied Intuition', () => {
    expect(LEADERBOARD_2024.length).toBeGreaterThanOrEqual(10);
    const haystack = JSON.stringify(LEADERBOARD_2024).toLowerCase();
    expect(haystack).not.toContain('applied intuition');
  });

  it('every entry parses the schema', () => {
    for (const e of LEADERBOARD_2024) {
      expect(() => LeaderboardEntry.parse(e)).not.toThrow();
    }
  });

  it('uses the canonical grant-date assumption everywhere', () => {
    for (const e of LEADERBOARD_2024) {
      expect(e.grantDate).toBe(GRANT_DATE_ASSUMPTION);
    }
  });

  it('every public entry has a ticker the market API supports', () => {
    for (const e of PUBLIC_ENTRIES) {
      expect(e.ticker).not.toBeNull();
      expect(isSupportedTicker(e.ticker as string)).toBe(true);
    }
    expect(PUBLIC_ENTRIES.length).toBeGreaterThan(0);
  });

  it('no private/null-ticker entry can make a growth claim', () => {
    expect(PRIVATE_ENTRIES.length).toBeGreaterThan(0);
    for (const e of PRIVATE_ENTRIES) {
      expect(e.ticker).toBeNull();
      // Realized value is undefined for private companies by construction,
      // even if live prices were somehow provided.
      expect(realized4yr(e, prices)).toBeNull();
      expect(realized4yr(e, null)).toBeNull();
    }
  });

  it('every entry documents its source and method honestly', () => {
    for (const e of LEADERBOARD_2024) {
      expect(e.source.length).toBeGreaterThan(0);
      expect(e.method.length).toBeGreaterThan(0);
      expect(e.accessDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });

  it('estimates are labeled as estimates', () => {
    const estimates = LEADERBOARD_2024.filter((e) => e.confidence === 'estimate');
    expect(estimates.length).toBeGreaterThan(0);
    for (const e of estimates) {
      expect(e.method.toLowerCase()).toContain('estimate');
    }
  });
});

describe('leaderboard realized-value math', () => {
  const entry = {
    ticker: 'META',
    base: 100000,
    signingBonus: 20000,
    stockGrantTotal4yr: 400000,
  };

  it('computes offer TC at grant as base + signing + grant/4', () => {
    expect(offerTcAtGrant(entry)).toBe(100000 + 20000 + 100000);
  });

  it('computes realized 4yr value with mocked prices', () => {
    // base*4 + signing + grant/priceAtGrant*priceNow
    expect(realized4yr(entry, prices)).toBe(400000 + 20000 + (400000 / 100) * 150);
  });

  it('returns null realized value when prices are unavailable', () => {
    expect(realized4yr(entry, null)).toBeNull();
    expect(realized4yr(entry, { ...prices, priceAtGrant: 0 })).toBeNull();
  });

  it('computes stock growth since grant as a fraction', () => {
    expect(stockGrowthSinceGrant(prices)).toBeCloseTo(0.5, 10);
    expect(stockGrowthSinceGrant(null)).toBeNull();
  });

  it('picks the monthly close nearest the grant date', () => {
    const closes: MonthlyClose[] = [
      { date: '2024-06-30', close: 90 },
      { date: '2024-07-31', close: 95 },
      { date: '2024-08-31', close: 110 },
    ];
    expect(priceAtDate(closes, '2024-08-01')?.close).toBe(95);
    expect(priceAtDate([], '2024-08-01')).toBeNull();
  });
});
