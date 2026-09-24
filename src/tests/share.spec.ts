import { describe, expect, it } from 'vitest';
import { compressToEncodedURIComponent, decompressFromEncodedURIComponent } from 'lz-string';
import {
  anonymizeOffer,
  anonPayloadToOffers,
  buildAnonymizedToken,
  buildShareToken,
  companyAlias,
  decodeShareToken,
  metroOnly,
  parseShareToken,
  roundDateToQuarter,
} from '@/lib/share';
import type { TOffer } from '@/models/types';

const baseOffer: TOffer = {
  name: 'TestCo',
  currency: 'USD',
  startDate: '2025-01-01',
  colFactor: 1,
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

/** Offer with deliberately identifying / non-round values to test anonymization. */
function identifyingOffer(): TOffer {
  return {
    id: 'offer-abc-123',
    name: 'Acme Corp',
    currency: 'USD',
    startDate: '2025-06-15',
    location: 'San Francisco, CA',
    colFactor: 1.4,
    base: { startAnnual: 152_347 },
    raises: [{ effectiveDate: '2026-02-01', type: 'absolute', value: 6_231 }],
    performanceBonus: { kind: 'fixed', value: 9_876, expectedPayout: 1 },
    signingBonuses: [{ amount: 11_234, payDate: '2025-06-15' }],
    relocationBonuses: [],
    benefits: [{ name: 'Gym stipend', annualValue: 1_234, enabled: true }],
    miscRecurring: [],
    equityGrants: [
      {
        id: 'grant-xyz-9',
        type: 'ISO',
        shares: 4_837,
        strike: 42.5,
        fmv: 55.0,
        targetValue: 23_456,
        grantStartDate: '2025-06-15',
        vesting: {
          model: 'explicit',
          tranches: [{ date: '2026-06-15', shares: 1_209 }],
        },
      },
    ],
    startupEquity: {
      enabled: true,
      companyName: 'Acme Corp',
      valuation: 12_345_000_000,
      fullyDilutedShares: 80_000_000,
      optionGrants: [
        { id: 'opt-1', label: 'Founder grant', quantity: 9_876, strike: 42.5, fmvAtGrant: 55.0, vestYears: 4, cliffMonths: 12 },
      ],
      rsuGrants: [
        { id: 'rsu-1', label: 'RSU refresh', shares: 2_345, fmvAtGrant: 55.0, doubleTrigger: true, vestYears: 4 },
      ],
    },
    assumptions: { horizonYears: 4, colAdjust: 1 },
  };
}

/** Recursively collect all object keys in a value. */
function allKeys(value: unknown, acc: string[] = []): string[] {
  if (Array.isArray(value)) {
    value.forEach((v) => allKeys(v, acc));
  } else if (value && typeof value === 'object') {
    for (const [k, v] of Object.entries(value)) {
      acc.push(k);
      allKeys(v, acc);
    }
  }
  return acc;
}

describe('share utilities', () => {
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
    expect(parseShareToken('not-a-token')).toBeNull();
  });

  it('detects v1 tokens as non-anonymous (backward compatible)', () => {
    const token = buildShareToken({ offers: [baseOffer], activeIndex: 0, uiMode: 'simple' });
    const parsed = parseShareToken(token);
    expect(parsed).not.toBeNull();
    expect(parsed?.anon).toBe(false);
    if (parsed && !parsed.anon) {
      expect(parsed.payload.version).toBe(1);
      expect(parsed.payload.offers[0].name).toBe('TestCo');
    }
    // decodeShareToken still returns the v1 payload directly
    expect(decodeShareToken(token)?.offers[0].name).toBe('TestCo');
  });
});

describe('anonymized share tokens', () => {
  it('replaces names with aliases and strips ids', () => {
    const anon = anonymizeOffer(identifyingOffer(), 0);
    expect(anon.name).toBe('Company A');
    expect(anon).not.toHaveProperty('id');
    expect(anon.equityGrants[0]).not.toHaveProperty('id');
    expect(anon.startupEquity?.companyName).toBe('Company A');
    expect(anon.startupEquity?.optionGrants[0]).not.toHaveProperty('id');
    expect(anon.startupEquity?.optionGrants[0].label).toBe('Company A');
  });

  it('reduces locations to metro only', () => {
    expect(anonymizeOffer(identifyingOffer(), 0).location).toBe('Bay Area');
    expect(metroOnly('San Francisco, CA')).toBe('Bay Area');
    expect(metroOnly('New York, NY')).toBe('New York City');
    expect(metroOnly('Some Unknown Town, ZZ')).toBe('Other metro');
    expect(metroOnly(undefined)).toBeUndefined();
  });

  it('rounds compensation to the nearest $5K', () => {
    const anon = anonymizeOffer(identifyingOffer(), 0);
    expect(anon.base.startAnnual).toBe(150_000);
    expect(anon.raises[0].value).toBe(5_000);
    expect(anon.performanceBonus?.value).toBe(10_000);
    expect(anon.signingBonuses?.[0].amount).toBe(10_000);
    expect(anon.benefits[0].annualValue).toBe(0);
    expect(anon.equityGrants[0].targetValue).toBe(25_000);
  });

  it('rounds per-share prices to whole dollars and valuation to whole billions', () => {
    const anon = anonymizeOffer(identifyingOffer(), 0);
    expect(anon.equityGrants[0].strike).toBe(43);
    expect(anon.equityGrants[0].fmv).toBe(55);
    expect(anon.startupEquity?.valuation).toBe(12_000_000_000);
    expect(anon.startupEquity?.optionGrants[0].strike).toBe(43);
    expect(anon.startupEquity?.optionGrants[0].fmvAtGrant).toBe(55);
  });

  it('rounds share counts to the nearest 100', () => {
    const anon = anonymizeOffer(identifyingOffer(), 0);
    expect(anon.equityGrants[0].shares).toBe(4_800);
    const vesting = anon.equityGrants[0].vesting;
    if (vesting.model === 'explicit') {
      expect(vesting.tranches[0].shares).toBe(1_200);
    } else {
      throw new Error('expected explicit vesting');
    }
    expect(anon.startupEquity?.optionGrants[0].quantity).toBe(9_900);
    expect(anon.startupEquity?.rsuGrants[0].shares).toBe(2_300);
    expect(anon.startupEquity?.rsuGrants[0]).not.toHaveProperty('id');
  });

  it('rounds dates to quarters', () => {
    expect(roundDateToQuarter('2025-06-15')).toBe('2025-Q2');
    expect(roundDateToQuarter('2026-02-01')).toBe('2026-Q1');
    expect(roundDateToQuarter('2025-Q2')).toBe('2025-Q2'); // idempotent
    const anon = anonymizeOffer(identifyingOffer(), 0);
    expect(anon.startDate).toBe('2025-Q2');
    expect(anon.raises[0].effectiveDate).toBe('2026-Q1');
    expect(anon.signingBonuses?.[0].payDate).toBe('2025-Q2');
    expect(anon.equityGrants[0].grantStartDate).toBe('2025-Q2');
    const vesting = anon.equityGrants[0].vesting;
    if (vesting.model === 'explicit') {
      expect(vesting.tranches[0].date).toBe('2026-Q2');
    } else {
      throw new Error('expected explicit vesting');
    }
  });

  it('assigns aliases in selection order and includes only selected offers', () => {
    const second: TOffer = { ...identifyingOffer(), name: 'Beta LLC', location: 'Austin, TX' };
    const token = buildAnonymizedToken([identifyingOffer(), second], [1], 'simple');
    const parsed = parseShareToken(token);
    expect(parsed?.anon).toBe(true);
    if (parsed?.anon) {
      expect(parsed.payload.offers).toHaveLength(1);
      expect(parsed.payload.offers[0].name).toBe('Company A');
      expect(parsed.payload.offers[0].location).toBe('Austin');
    }
  });

  it('detects anon payloads via parseShareToken and keeps v2 marker', () => {
    const token = buildAnonymizedToken([identifyingOffer()], [0]);
    const parsed = parseShareToken(token);
    expect(parsed).not.toBeNull();
    expect(parsed?.anon).toBe(true);
    if (parsed?.anon) {
      expect(parsed.payload.version).toBe(2);
      expect(parsed.payload.anon).toBe(true);
    }
    // decodeShareToken handles v2 too
    const decoded = decodeShareToken(token);
    expect(decoded).not.toBeNull();
    expect((decoded as { version: number }).version).toBe(2);
  });

  it('expands quarter dates back to ISO dates for safe import', () => {
    const token = buildAnonymizedToken([identifyingOffer()], [0]);
    const parsed = parseShareToken(token);
    expect(parsed?.anon).toBe(true);
    if (parsed?.anon) {
      const imported = anonPayloadToOffers(parsed.payload);
      expect(imported[0].startDate).toBe('2025-04-01');
      expect(imported[0].raises[0].effectiveDate).toBe('2026-01-01');
      expect(imported[0].signingBonuses?.[0].payDate).toBe('2025-04-01');
      // aliases and rounding survive the round-trip; real names do not return
      expect(imported[0].name).toBe('Company A');
      expect(imported[0].location).toBe('Bay Area');
      expect(imported[0].base.startAnnual).toBe(150_000);
      // ISO dates are parseable by the compute path
      expect(new Date(imported[0].startDate).toString()).not.toBe('Invalid Date');
    }
  });

  it('contains no identity fields anywhere in the token', () => {
    const token = buildAnonymizedToken([identifyingOffer()], [0]);
    const raw = decompressFromEncodedURIComponent(token);
    expect(raw).toBeTruthy();
    const json = String(raw);
    // no real names, locations, exact comp, or internal ids recoverable
    expect(json).not.toContain('Acme Corp');
    expect(json).not.toContain('Founder grant');
    expect(json).not.toContain('San Francisco');
    expect(json).not.toContain('152347');
    expect(json).not.toContain('2025-06-15');
    expect(json).not.toContain('offer-abc-123');
    expect(json).not.toContain('grant-xyz-9');
    // exact share counts are identifying (they match offer letters) — none of
    // the pre-rounding counts may survive in the token
    expect(json).not.toContain('4837');
    expect(json).not.toContain('1209');
    expect(json).not.toContain('9876');
    expect(json).not.toContain('2345');
    // the rounded values are what appear instead
    expect(json).toContain('4800');
    expect(json).toContain('9900');
    // aliases present instead
    expect(json).toContain('Company A');
    expect(json).toContain('Bay Area');

    const parsed = parseShareToken(token);
    expect(parsed?.anon).toBe(true);
    if (parsed?.anon) {
      const keys = allKeys(parsed.payload);
      expect(keys).not.toContain('id');
      expect(keys).not.toContain('email');
      expect(keys).not.toContain('phone');
    }
  });

  it('generates sequential company aliases', () => {
    expect(companyAlias(0)).toBe('Company A');
    expect(companyAlias(1)).toBe('Company B');
    expect(companyAlias(25)).toBe('Company Z');
  });

  it('dedupes duplicate share-selection indices', () => {
    const second: TOffer = { ...identifyingOffer(), name: 'Beta LLC', location: 'Austin, TX' };
    const token = buildAnonymizedToken([identifyingOffer(), second], [0, 0, 1, 1]);
    const parsed = parseShareToken(token);
    expect(parsed?.anon).toBe(true);
    if (parsed?.anon) {
      expect(parsed.payload.offers).toHaveLength(2);
      expect(parsed.payload.offers[0].name).toBe('Company A');
      expect(parsed.payload.offers[1].name).toBe('Company B');
    }
  });

  it('rounds retirement dollar caps', () => {
    const offer: TOffer = {
      ...identifyingOffer(),
      retirement: {
        employeeContributionPercent: 0.06,
        matchRate: 0.5,
        matchCapPercentOfSalary: 0.06,
        employeeContributionCapDollar: 23_500,
        matchCapMode: 'dollar',
        matchCapDollar: 12_250,
      },
    };
    const anon = anonymizeOffer(offer, 0);
    expect(anon.retirement?.matchCapDollar).toBe(10_000);
    expect(anon.retirement?.employeeContributionCapDollar).toBe(25_000);
  });

  it('rejects oversized tokens before decompression', () => {
    const big = 'x'.repeat(60 * 1024);
    expect(parseShareToken(big)).toBeNull();
    expect(decodeShareToken(big)).toBeNull();
  });

  it('rejects anon payloads containing fields outside the allowlist', () => {
    const token = buildAnonymizedToken([identifyingOffer()], [0]);
    const raw = decompressFromEncodedURIComponent(token);
    expect(raw).toBeTruthy();
    const payload = JSON.parse(String(raw)) as Record<string, unknown>;
    // simulate a future sensitive field added to the Offer shape
    (payload.offers as Array<Record<string, unknown>>)[0].candidateNotes = 'met at a conference';
    (payload.offers as Array<Record<string, unknown>>)[0].equityGrants = [];
    const tampered = compressToEncodedURIComponent(JSON.stringify(payload));
    expect(parseShareToken(tampered)).toBeNull();
    expect(decodeShareToken(tampered)).toBeNull();
    // untampered token still parses
    expect(parseShareToken(token)?.anon).toBe(true);
  });
});
