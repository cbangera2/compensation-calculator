import { describe, expect, it } from 'vitest';
import { isValidTabValue } from '@/lib/tabs';
import { impliedSharePrice } from '@/core/startup';

// Tests for PR #16: shareable tab URLs and startup valuation/share-price toggle.

describe('tab URL param validation', () => {
  it('accepts all valid tab values from URL params', () => {
    for (const tab of ['calc', 'equity', 'benchmarks', 'leaderboard', 'compare', 'raises', 'cities']) {
      expect(isValidTabValue(tab)).toBe(true);
    }
  });

  it('rejects invalid tab params (falls back to calc)', () => {
    expect(isValidTabValue('')).toBe(false);
    expect(isValidTabValue('invalid')).toBe(false);
    expect(isValidTabValue('STARTUP')).toBe(false); // case-sensitive
    expect(isValidTabValue(null)).toBe(false);
    expect(isValidTabValue(undefined)).toBe(false);
    expect(isValidTabValue(123)).toBe(false);
  });

  it('resolves initial tab from URL param with calc fallback', () => {
    const resolveTab = (param: string | null) =>
      isValidTabValue(param) ? param : 'calc';
    expect(resolveTab('equity')).toBe('equity');
    expect(resolveTab('compare')).toBe('compare');
    expect(resolveTab('startup')).toBe('calc'); // removed in the Equity merge
    expect(resolveTab(null)).toBe('calc');
    expect(resolveTab('bogus')).toBe('calc');
  });
});

describe('share price mode valuation math', () => {
  // Mirrors the commit logic in StartupPanel: valuation = price × shares,
  // clamped to [MIN_VALUATION, MAX_VALUATION].
  const MIN_VALUATION = 100_000_000; // $100M
  const MAX_VALUATION = 1_000_000_000_000; // $1T

  const priceToValuation = (price: number, fullyDilutedShares: number) =>
    Math.min(
      MAX_VALUATION,
      Math.max(MIN_VALUATION, price * Math.max(1, fullyDilutedShares || 0))
    );

  it('computes valuation as price × fully diluted shares', () => {
    expect(priceToValuation(60, 100_000_000)).toBe(6_000_000_000);
    expect(priceToValuation(10, 50_000_000)).toBe(500_000_000);
  });

  it('round-trips through impliedSharePrice', () => {
    const valuation = priceToValuation(60, 100_000_000);
    expect(impliedSharePrice(valuation, 100_000_000)).toBe(60);
  });

  it('clamps to MIN_VALUATION for tiny prices', () => {
    expect(priceToValuation(0.001, 100_000_000)).toBe(MIN_VALUATION);
  });

  it('clamps to MAX_VALUATION for huge prices', () => {
    expect(priceToValuation(100_000, 100_000_000)).toBe(MAX_VALUATION);
  });

  it('handles degenerate share counts safely', () => {
    // shares of 0/undefined normalize to 1, never divide by zero or NaN
    expect(priceToValuation(60, 0)).toBe(MIN_VALUATION); // 60 × 1 = 60 < min
    expect(Number.isFinite(priceToValuation(60, 0))).toBe(true);
  });

  it('handles fractional share prices', () => {
    // $0.50 × 200M shares = $100M = MIN_VALUATION boundary
    expect(priceToValuation(0.5, 200_000_000)).toBe(100_000_000);
  });
});
