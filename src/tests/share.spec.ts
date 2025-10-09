import { describe, expect, it } from 'vitest';
import { buildShareToken, decodeShareToken } from '@/lib/share';
import type { TOffer } from '@/models/types';

describe('share utilities', () => {
  const baseOffer: TOffer = {
    name: 'TestCo',
    currency: 'USD',
    startDate: '2025-01-01',
    base: { startAnnual: 150_000 },
    raises: [],
    performanceBonus: { kind: 'percent', value: 0.1, expectedPayout: 1 },
    signingBonuses: [],
    relocationBonuses: [],
    benefits: [],
    miscRecurring: [],
    equityGrants: [],
    growth: { startingPrice: 100, yoy: [0, 0, 0, 0] },
    assumptions: { horizonYears: 4, colAdjust: 1 },
  };

  it('encodes and decodes a snapshot', () => {
    const token = buildShareToken({ offers: [baseOffer], activeIndex: 0, uiMode: 'advanced' });
    const payload = decodeShareToken(token);
    expect(payload).not.toBeNull();
    expect(payload?.offers).toHaveLength(1);
    expect(payload?.offers[0].name).toBe('TestCo');
    expect(payload?.activeIndex).toBe(0);
    expect(payload?.uiMode).toBe('advanced');
  });

  it('returns null for invalid tokens', () => {
    expect(decodeShareToken('not-a-token')).toBeNull();
  });
});
