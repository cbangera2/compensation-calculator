import { describe, expect, it, vi } from 'vitest';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import type { TOffer } from '@/models/types';

// Regression test: the Compare tab's ranking section must follow the
// Nominal / Purchasing-power toggle. It used to always sort by purchasing
// power (and show PP values as the headline) even in Nominal mode, so with
// the toggle off a $200k SF offer ranked below a $150k Austin offer.
//
// Nominal Y1: Alpha $200k > Gamma $170k > Beta $150k
// PP Y1:      Beta $150k > Gamma $141,667 > Alpha $136,054
// In default (Nominal) mode the ranking must be Alpha, Gamma, Beta with
// nominal headlines and no "(nominal ...)" sublabels.

function mockOffer(name: string, base: number, colFactor: number, location: string): TOffer {
  return {
    id: name,
    name,
    currency: 'USD',
    startDate: '2026-01-01',
    location,
    base: { startAnnual: base },
    colFactor,
    raises: [],
    signingBonuses: [],
    relocationBonuses: [],
    benefits: [],
    miscRecurring: [],
    equityGrants: [],
    growth: { yoy: [0, 0, 0, 0] },
    assumptions: { horizonYears: 4, colAdjust: 1 },
  } as unknown as TOffer;
}

const mockState = vi.hoisted(() => ({
  offers: [] as TOffer[],
  activeIndex: 0,
  compareSelection: [] as number[],
}));

vi.mock('@/state/store', () => ({
  // Handles both useStore() and useStore(selector) call shapes.
  useStore: (sel?: (s: typeof mockState) => unknown) => (sel ? sel(mockState) : mockState),
}));

import ComparisonChart from '@/components/ComparisonChart';

function rankOrder(html: string): Array<[number, string]> {
  const re = /#(?:<!-- -->)?(\d)<\/span>\s*<span[^>]*>([^<]+)<\/span>/g;
  const out: Array<[number, string]> = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) out.push([Number(m[1]), m[2]]);
  return out;
}

describe('compare ranking follows the Nominal/PP toggle', () => {
  it('ranks by nominal Year-1 in Nominal mode (the default)', () => {
    mockState.offers = [
      mockOffer('Alpha', 200000, 1.47, 'San Francisco, CA'),
      mockOffer('Beta', 150000, 1.0, 'Austin, TX'),
      mockOffer('Gamma', 170000, 1.2, 'Denver, CO'),
    ];
    const html = renderToString(createElement(ComparisonChart));

    expect(html).toContain('Nominal ranking · Year 1');
    expect(html).not.toContain('Purchasing power ranking · Year 1');

    // Nominal order: Alpha ($200k) > Gamma ($170k) > Beta ($150k),
    // even though purchasing power would rank Beta first.
    expect(rankOrder(html)).toEqual([
      [1, 'Alpha'],
      [2, 'Gamma'],
      [3, 'Beta'],
    ]);

    // Headlines are nominal values, not purchasing-power values.
    expect(html).toContain('$200,000');
    expect(html).not.toContain('$136,054');
    // No "(nominal ...)" sublabel in Nominal mode — the headline IS nominal.
    expect(html).not.toContain('(nominal');
    // The PP-only insight callout stays hidden in Nominal mode.
    expect(html).not.toContain('Insight:');
  });
});
