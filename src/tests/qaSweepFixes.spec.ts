import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { savedScenariosOf } from '@/lib/startup';
import ErrorPage from '@/app/error';
import {
  anonymizeOffer,
  buildAnonymizedToken,
  parseShareToken,
  anonPayloadToOffers,
} from '@/lib/share';
import { offerToLeaderboardEntry } from '@/lib/userLeaderboard';
import type { TOffer, TStartupEquity, TValuationScenario } from '@/models/types';

const SCENARIO: TValuationScenario = {
  name: 'Series F',
  valuation: 15_000_000_000,
  fullyDilutedShares: 100_000_000,
};

function startupBlock(partial: Partial<TStartupEquity> = {}): TStartupEquity {
  return {
    enabled: true,
    companyName: 'DemoCo',
    valuation: 12_000_000_000,
    fullyDilutedShares: 80_000_000,
    optionGrants: [],
    rsuGrants: [],
    savedScenarios: [],
    ...partial,
  } as TStartupEquity;
}

function offerWithStartup(partial: Partial<TStartupEquity> = {}): TOffer {
  return {
    id: 'offer-1',
    name: 'DemoCo',
    currency: 'USD',
    startDate: '2026-01-01',
    location: 'Ann Arbor, MI',
    base: { startAnnual: 150_000 },
    colFactor: 1,
    raises: [],
    signingBonuses: [],
    relocationBonuses: [],
    benefits: [],
    miscRecurring: [],
    equityGrants: [],
    growth: { yoy: [0, 0, 0, 0] },
    startupEquity: startupBlock(partial),
    assumptions: { horizonYears: 4, colAdjust: 1 },
  } as TOffer;
}

describe('savedScenariosOf (Startup tab crash regression)', () => {
  it('returns [] for an undefined block', () => {
    expect(savedScenariosOf(undefined)).toEqual([]);
  });

  it('returns [] when the field is missing (anonymized-import / legacy shape)', () => {
    const block = startupBlock();
    delete (block as Record<string, unknown>).savedScenarios;
    expect(savedScenariosOf(block)).toEqual([]);
  });

  it('passes existing scenarios through untouched', () => {
    expect(savedScenariosOf(startupBlock({ savedScenarios: [SCENARIO] }))).toEqual([SCENARIO]);
  });
});

describe('anonymizeOffer startup scenarios (crash producer fix)', () => {
  it('resets savedScenarios to [] instead of deleting the key', () => {
    const anon = anonymizeOffer(offerWithStartup({ savedScenarios: [SCENARIO] }), 0);
    // Privacy: the private what-if scenarios are never shared...
    expect(anon.startupEquity?.savedScenarios).toEqual([]);
    // ...but the key stays present so the import keeps a valid shape.
    expect(anon.startupEquity).toHaveProperty('savedScenarios');
  });

  it('anonymized startup block flows through savedScenariosOf without crashing', () => {
    const anon = anonymizeOffer(offerWithStartup({ savedScenarios: [SCENARIO] }), 0);
    expect(() => savedScenariosOf(anon.startupEquity)).not.toThrow();
    expect(savedScenariosOf(anon.startupEquity)).toEqual([]);
  });

  it('full share round-trip: token -> import -> Startup tab data access never crashes', () => {
    const token = buildAnonymizedToken([offerWithStartup({ savedScenarios: [SCENARIO] })], [0], 'simple');
    const parsed = parseShareToken(token);
    expect(parsed?.anon).toBe(true);
    if (!parsed || !parsed.anon) throw new Error('expected an anonymized payload');
    const imported = anonPayloadToOffers(parsed.payload);
    // The exact reported crash: StartupPanel reading .length on the missing field.
    expect(() => savedScenariosOf(imported[0].startupEquity).length).not.toThrow();
    expect(savedScenariosOf(imported[0].startupEquity)).toEqual([]);
  });
});

describe('error boundary (app/error.tsx)', () => {
  it('renders a Back to calculator escape alongside Try again', () => {
    const html = renderToString(
      createElement(ErrorPage, { error: new Error('boom'), reset: () => {} }),
    );
    expect(html).toContain('Back to calculator');
    expect(html).toContain('Try again');
    expect(html).toContain('Something went wrong');
  });
});

describe('user leaderboard entries', () => {
  it('marks entries as user offers with a stable offerId', () => {
    const entry = offerToLeaderboardEntry(offerWithStartup(), '2024');
    expect(entry.isUserOffer).toBe(true);
    expect(entry.offerId).toBe('offer-1');
    expect(entry.group).toBe('user');
  });

  it('gives distinct offerIds to same-company offers (stable React keys)', () => {
    const a = offerToLeaderboardEntry({ ...offerWithStartup(), id: 'offer-a', name: 'DemoCo' }, '2024');
    const b = offerToLeaderboardEntry({ ...offerWithStartup(), id: 'offer-b', name: 'DemoCo' }, '2024');
    expect(a.offerId).not.toBe(b.offerId);
  });

  it('values equity grants at grant prices with no growth', () => {
    const entry = offerToLeaderboardEntry(offerWithStartup(), '2024');
    // 150k base, no signing, no equity grants -> 150k/yr offer TC at grant
    expect(entry.base).toBe(150_000);
    expect(entry.ticker).toBeNull();
  });
});
