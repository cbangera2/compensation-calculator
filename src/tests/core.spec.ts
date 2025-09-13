import { describe, it, expect } from 'vitest';
import { applyYoYGrowth } from '@/core/growth';
import { expandVesting } from '@/core/vesting';

describe('growth', () => {
  it('applies YoY growth cumulatively', () => {
    expect(applyYoYGrowth(100, [0.1, -0.1, 0.2], 0)).toBe(100);
    expect(applyYoYGrowth(100, [0.1, -0.1, 0.2], 1)).toBeCloseTo(110);
    expect(applyYoYGrowth(100, [0.1, -0.1, 0.2], 2)).toBeCloseTo(99);
  });
});

describe('vesting', () => {
  it('expands a standard schedule with cliff', () => {
    const tranches = expandVesting(
      { model: 'standard', years: 4, cliffMonths: 12, frequency: 'monthly', distribution: 'even', cliffPercent: 0 },
      '2025-01-01',
      4800
    );
    expect(tranches.length).toBeGreaterThan(0);
    const total = tranches.reduce((a, t) => a + t.shares, 0);
    expect(total).toBeCloseTo(4800, 6);
  });

  it('defaults cliff vest to time proportion when cliffPercent not provided', () => {
    // 4y (48 months) with 12m cliff -> 25% at cliff
    const totalShares = 4800;
    const tranches = expandVesting(
      { model: 'standard', years: 4, cliffMonths: 12, frequency: 'monthly', distribution: 'even', cliffPercent: 0 },
      '2025-01-01',
      totalShares
    );
    const first = tranches[0];
    expect(first).toBeDefined();
    expect(first.date.startsWith('2026-01')).toBeTruthy();
    expect(first.shares).toBeCloseTo(totalShares * 0.25, 6);
    const sum = tranches.reduce((a, t) => a + t.shares, 0);
    expect(sum).toBeCloseTo(totalShares, 6);
  });
});
