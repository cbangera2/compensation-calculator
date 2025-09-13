import { describe, it, expect } from 'vitest';
import { computeOffer } from '@/core/compute';

describe('raises proration', () => {
  it('prorates a mid-year percent raise', () => {
    const offer = {
      name: 'Test', currency: 'USD', startDate: '2025-01-01',
      base: { startAnnual: 100_000 },
  raises: [{ effectiveDate: '2025-07-01', type: 'percent' as const, value: 0.10 }],
      equityGrants: [], growth: { startingPrice: 10, yoy: [0,0,0,0] },
      benefits: [], miscRecurring: [],
      assumptions: { horizonYears: 1 },
    };
    const [y1] = computeOffer(offer);
  // Day-level proration yields ~105,041
  expect(Math.round(y1.base)).toBe(105041);
  });

  it('prorates an absolute raise', () => {
    const offer = {
      name: 'Test', currency: 'USD', startDate: '2025-01-01',
      base: { startAnnual: 100_000 },
  raises: [{ effectiveDate: '2025-04-01', type: 'absolute' as const, value: 12_000 }],
      equityGrants: [], growth: { startingPrice: 10, yoy: [0,0,0,0] },
      benefits: [], miscRecurring: [],
      assumptions: { horizonYears: 1 },
    };
    const [y1] = computeOffer(offer);
  // Day-level proration yields ~109,041
  expect(Math.round(y1.base)).toBe(109041);
  });
});
