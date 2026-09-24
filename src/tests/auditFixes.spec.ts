import { describe, it, expect } from 'vitest';
import { matchCityPresetKey } from '@/lib/col';
import { Offer } from '@/models/types';
import { computeOffer } from '@/core/compute';
import { sharedPayForOfferPick } from '@/components/CityComparePanel';

describe('matchCityPresetKey', () => {
  it('matches renter-estimate presets after stripping parenthetical suffixes', () => {
    expect(matchCityPresetKey('Ann Arbor, MI')).toBe('renter-ann-arbor');
    expect(matchCityPresetKey('ann arbor, mi')).toBe('renter-ann-arbor');
    expect(matchCityPresetKey('Ann Arbor, MI (renter est.)')).toBe('renter-ann-arbor');
  });

  it('matches generic presets by city token', () => {
    expect(matchCityPresetKey('San Francisco, CA')).toBe('sf');
    expect(matchCityPresetKey('New York, NY')).toBe('nyc');
    expect(matchCityPresetKey('Austin, TX')).toBe('aus');
    expect(matchCityPresetKey('Austin, Texas')).toBe('aus');
    expect(matchCityPresetKey('Mountain View, CA')).toBe('mtv');
    expect(matchCityPresetKey('Remote')).toBe('remote');
  });

  it('matches when the location string contains the preset city token', () => {
    expect(matchCityPresetKey('San Francisco Bay Area')).toBe('sf');
  });

  it('returns null for no match or empty input', () => {
    expect(matchCityPresetKey(undefined)).toBeNull();
    expect(matchCityPresetKey('')).toBeNull();
    expect(matchCityPresetKey('Custom')).toBeNull();
    expect(matchCityPresetKey('Springfield')).toBeNull();
  });
});

describe('sharedPayForOfferPick (startup equity regression)', () => {
  // NOTE: generic DemoCo-style fixture. Never put real personal
  // compensation numbers in committed test data.
  const offer = Offer.parse({
    name: 'Test',
    startDate: '2024-08-01',
    base: { startAnnual: 150000 },
    equityGrants: [],
    startupEquity: {
      enabled: true,
      companyName: 'Test Startup',
      valuation: 10_000_000_000,
      fullyDilutedShares: 100_000_000,
      optionGrants: [
        {
          quantity: 2000,
          strike: 25,
          fmvAtGrant: 90,
          vestYears: 4,
          cliffMonths: 12,
          grantStartDate: '2024-08-01',
        },
      ],
      savedScenarios: [],
    },
  });

  it('loads the equity-inclusive year-1 total, not base-only', () => {
    const year1 = computeOffer(offer)[0]?.total ?? 0;
    const expected = Math.round(year1);
    expect(sharedPayForOfferPick(offer, 'from')).toBe(expected);
    // Equity must be included: the loaded pay is strictly above base alone.
    expect(sharedPayForOfferPick(offer, 'from')).toBeGreaterThan(150000);
  });

  it('returns null for the to-offer pick', () => {
    expect(sharedPayForOfferPick(offer, 'to')).toBeNull();
  });
});
