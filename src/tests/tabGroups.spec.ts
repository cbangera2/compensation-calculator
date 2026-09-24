import { describe, expect, it } from 'vitest';
import { TAB_GROUPS, isValidTabValue } from '@/components/ActiveOfferStrip';

describe('tab groups', () => {
  it('covers all eight tabs exactly once', () => {
    const values = TAB_GROUPS.flatMap((g) => g.tabs.map((t) => t.value));
    expect(values).toHaveLength(8);
    expect(new Set(values).size).toBe(8);
    expect(values).toEqual(
      expect.arrayContaining(['calc', 'compare', 'growth', 'startup', 'benchmarks', 'leaderboard', 'raises', 'cities']),
    );
  });

  it('groups tabs into the Capture / Understand / Decide flow', () => {
    expect(TAB_GROUPS.map((g) => g.label)).toEqual(['Capture', 'Understand', 'Decide']);
    const byGroup = Object.fromEntries(
      TAB_GROUPS.map((g) => [g.label, g.tabs.map((t) => t.value)]),
    );
    expect(byGroup['Capture']).toEqual(['calc', 'startup']);
    expect(byGroup['Understand']).toEqual(['growth', 'benchmarks', 'leaderboard']);
    expect(byGroup['Decide']).toEqual(['compare', 'raises', 'cities']);
  });

  it('validates compcalc:switch-tab event details', () => {
    expect(isValidTabValue('calc')).toBe(true);
    expect(isValidTabValue('cities')).toBe(true);
    expect(isValidTabValue('benchmarks')).toBe(true);
    expect(isValidTabValue('leaderboard')).toBe(true);
    expect(isValidTabValue('nope')).toBe(false);
    expect(isValidTabValue('')).toBe(false);
    expect(isValidTabValue(undefined)).toBe(false);
    expect(isValidTabValue(null)).toBe(false);
    expect(isValidTabValue(42)).toBe(false);
    expect(isValidTabValue({})).toBe(false);
  });
});
