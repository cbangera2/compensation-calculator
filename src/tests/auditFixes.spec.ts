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
  const offer = Offer.parse({
    name: 'Test',
    startDate: '2024-07-15',
    base: { startAnnual: 142000 },
    equityGrants: [],
    startupEquity: {
      enabled: true,
      companyName: 'Test Startup',
      valuation: 15_000_000_000,
      fullyDilutedShares: 100_509_245,
      optionGrants: [
        {
          quantity: 3091,
          strike: 31.09,
          fmvAtGrant: 136.39,
          vestYears: 4,
          cliffMonths: 12,
          grantStartDate: '2024-07-15',
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
    expect(sharedPayForOfferPick(offer, 'from')).toBeGreaterThan(142000);
  });

  it('returns null for the to-offer pick', () => {
    expect(sharedPayForOfferPick(offer, 'to')).toBeNull();
  });
});
