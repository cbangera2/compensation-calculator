import { describe, expect, it } from 'vitest';
import {
  normalizeTo100,
  companyNameToTicker,
  defaultCompareTickers,
} from '@/components/EquityExplorer';
import type { MonthlyClose } from '@/lib/market';

function closes(prices: number[]): MonthlyClose[] {
  return prices.map((close, i) => ({
    date: `2021-${String(i + 1).padStart(2, '0')}-01`,
    close,
  }));
}

describe('normalizeTo100', () => {
  it('rebases the first close to 100', () => {
    const pts = normalizeTo100(closes([50, 75, 100]));
    expect(pts).toHaveLength(3);
    expect(pts[0]).toEqual({ date: '2021-01-01', value: 100 });
    expect(pts[1]?.value).toBeCloseTo(150, 9);
    expect(pts[2]?.value).toBeCloseTo(200, 9);
  });

  it('preserves dates in order', () => {
    const pts = normalizeTo100(closes([10, 20]));
    expect(pts.map((p) => p.date)).toEqual(['2021-01-01', '2021-02-01']);
  });

  it('returns [] for empty or degenerate input', () => {
    expect(normalizeTo100([])).toEqual([]);
    expect(normalizeTo100(closes([0, 10]))).toEqual([]);
    expect(normalizeTo100([{ date: '2021-01-01', close: -5 }])).toEqual([]);
  });
});

describe('companyNameToTicker', () => {
  it('maps well-known company names', () => {
    expect(companyNameToTicker('Meta')).toBe('META');
    expect(companyNameToTicker('facebook')).toBe('META');
    expect(companyNameToTicker('Google')).toBe('GOOGL');
    expect(companyNameToTicker('Alphabet')).toBe('GOOGL');
    expect(companyNameToTicker('Apple Inc')).toBe('AAPL');
    expect(companyNameToTicker('Microsoft')).toBe('MSFT');
    expect(companyNameToTicker('Tesla')).toBe('TSLA');
    expect(companyNameToTicker('Palantir')).toBe('PLTR');
  });

  it('accepts raw tickers case-insensitively', () => {
    expect(companyNameToTicker('meta')).toBe('META');
    expect(companyNameToTicker('googl')).toBe('GOOGL');
  });

  it('returns null for private companies and unknowns', () => {
    expect(companyNameToTicker('Stripe')).toBeNull();
    expect(companyNameToTicker('SpaceX')).toBeNull();
    expect(companyNameToTicker('Offer 1')).toBeNull();
    expect(companyNameToTicker('')).toBeNull();
    expect(companyNameToTicker(null)).toBeNull();
    expect(companyNameToTicker(undefined)).toBeNull();
  });
});

describe('defaultCompareTickers', () => {
  it('leads with the offer company ticker when known', () => {
    expect(defaultCompareTickers('Tesla offer', null)).toEqual(['TSLA', 'META']);
  });

  it('falls back to META + GOOGL for generic offer names', () => {
    expect(defaultCompareTickers('Offer 1', null)).toEqual(['META', 'GOOGL']);
    expect(defaultCompareTickers(null, null)).toEqual(['META', 'GOOGL']);
  });

  it('dedupes and caps at two', () => {
    expect(defaultCompareTickers('Meta', 'Facebook')).toEqual(['META', 'GOOGL']);
  });
});
