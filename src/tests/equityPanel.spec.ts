import { describe, expect, it, vi, beforeEach } from 'vitest';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { sampleStartupEquity } from '@/core/startup';
import type { TOffer } from '@/models/types';

// Regression tests for the Startup + Stock Growth → Equity tab merge:
// the merged tab must show startup modeling above the growth projection
// for startup offers, only the projection for public offers, and a
// combined empty state when the offer has no equity at all.
//
// NOTE: the test mocks the zustand store instead of setState because
// renderToString reads the server snapshot, which doesn't see setState
// mutations (client-only concern; the real app renders client-side).

const mockState = vi.hoisted(() => ({
  offers: [] as TOffer[],
  activeIndex: 0,
  offer: null as TOffer | null,
  updateOfferAt: vi.fn(),
  setOffer: vi.fn(),
}));

vi.mock('@/state/store', () => ({
  useStore: () => mockState,
}));

import EquityPanel from '@/components/EquityPanel';

function baseOffer(partial: Partial<TOffer> = {}): TOffer {
  return {
    id: 'offer-1',
    name: 'DemoCo',
    currency: 'USD',
    startDate: '2026-01-01',
    location: 'San Francisco, CA',
    base: { startAnnual: 165_000 },
    colFactor: 1,
    raises: [],
    signingBonuses: [],
    relocationBonuses: [],
    benefits: [],
    miscRecurring: [],
    equityGrants: [],
    ...partial,
  } as TOffer;
}

function seedOffer(offer: TOffer) {
  mockState.offers = [offer];
  mockState.activeIndex = 0;
  mockState.offer = offer;
}

function html() {
  return renderToString(createElement(EquityPanel));
}

describe('EquityPanel (merged tab)', () => {
  beforeEach(() => {
    seedOffer(baseOffer());
  });

  it('shows startup modeling above the growth projection for startup offers', () => {
    seedOffer(baseOffer({ startupEquity: { ...sampleStartupEquity(), enabled: true } }));
    const out = html();
    // StartupPanel content: valuation slider section
    expect(out).toMatch(/Scenario valuation/i);
    // EquityExplorer content: projection section
    expect(out).toMatch(/Equity Growth Explorer/i);
    // Startup section comes first in the DOM
    expect(out.search(/Scenario valuation/i)).toBeLessThan(
      out.search(/Equity Growth Explorer/i),
    );
  });

  it('shows only the growth projection for public-equity offers', () => {
    seedOffer(
      baseOffer({
        equityGrants: [
          {
            type: 'RSU',
            shares: 100,
            fmv: 100,
            vesting: {
              model: 'standard',
              years: 4,
              cliffMonths: 12,
              frequency: 'quarterly',
              distribution: 'even',
              cliffPercent: 0.25,
            },
          },
        ],
      }),
    );
    const out = html();
    expect(out).toMatch(/Equity Growth Explorer/i);
    expect(out).not.toMatch(/Scenario valuation/i);
    // Compact on-ramp to startup modeling is preserved
    expect(out).toMatch(/Comparing against a startup offer/i);
  });

  it('shows a combined empty state when the offer has no equity', () => {
    const out = html();
    expect(out).toMatch(/No equity modeled yet/i);
    expect(out).toMatch(/Add stock grants/i);
    expect(out).toMatch(/Model startup equity/i);
  });
});
