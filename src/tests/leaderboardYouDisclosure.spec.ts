import { describe, expect, it, vi, beforeEach } from 'vitest';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import type { TOffer } from '@/models/types';

// Regression test for the leaderboard "You" row disclosure:
// user rows intentionally use the board's grant-marking formula
// (base x 4 + signing + marked equity) for comparability, so they differ
// from the Calculator tab's full modeled total by design. The Methodology
// card must say so explicitly instead of implying the numbers agree with
// the calculator.
//
// NOTE: the "You" badge tooltip carries the same disclosure but lives
// inside the price-gated table, which never leaves its loading state under
// renderToString (prices load in useEffect). The badge tooltip is verified
// visually in the browser QA pass instead.

const mockState = vi.hoisted(() => ({
  offers: [] as TOffer[],
}));

vi.mock('@/state/store', () => ({
  useStore: () => mockState,
}));

import LeaderboardPanel from '@/components/LeaderboardPanel';

function html() {
  return renderToString(createElement(LeaderboardPanel));
}

describe('LeaderboardPanel "You" row disclosure', () => {
  beforeEach(() => {
    mockState.offers = [
      {
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
      } as TOffer,
    ];
  });

  it('explains in the Methodology card why "You" rows differ from Calculator totals', () => {
    const out = html();
    expect(out).toContain('&quot;You&quot; rows.');
    expect(out).toContain('identical grant-marking formula');
    expect(out).toContain('apples to apples');
    expect(out).toContain('by design, not a bug');
    expect(out).toContain('this board compares grants');
  });
});
