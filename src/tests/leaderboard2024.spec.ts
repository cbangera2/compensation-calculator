import { describe, expect, it } from 'vitest';
import {
  GRANT_DATE_ASSUMPTION,
  LEADERBOARD_2024,
  LeaderboardEntry,
  PRIVATE_ENTRIES,
  PUBLIC_ENTRIES,
} from '@/data/leaderboard2024';
import {
  offerTcAtGrant,
  priceAtDate,
  realized4yr,
  stockGrowthSinceGrant,
  type GrantPricePoints,
} from '@/lib/leaderboard';
import { isSupportedTicker } from '@/lib/market';
import type { MonthlyClose } from '@/lib/market';

const prices: GrantPricePoints = {
  priceAtGrant: 100,
  priceNow: 150,
  grantAnchorDate: '2024-08-01',
  asOfDate: '2026-08-31',
};

describe('leaderboard2024 dataset', () => {
  it('has a defensible number of aggregate entries', () => {
    expect(LEADERBOARD_2024.length).toBeGreaterThanOrEqual(10);
  });

  it('every entry parses the schema', () => {
    for (const e of LEADERBOARD_2024) {
      expect(() => LeaderboardEntry.parse(e)).not.toThrow();
    }
  });

  it('uses the canonical grant-date assumption everywhere', () => {
    for (const e of LEADERBOARD_2024) {
      expect(e.grantDate).toBe(GRANT_DATE_ASSUMPTION);
    }
  });

  it('every public entry has a ticker the market API supports', () => {
    for (const e of PUBLIC_ENTRIES) {
      expect(e.ticker).not.toBeNull();
      expect(isSupportedTicker(e.ticker as string)).toBe(true);
    }
    expect(PUBLIC_ENTRIES.length).toBeGreaterThan(0);
  });

  it('no private/null-ticker entry can make a growth claim', () => {
    expect(PRIVATE_ENTRIES.length).toBeGreaterThan(0);
    for (const e of PRIVATE_ENTRIES) {
      expect(e.ticker).toBeNull();
      // Realized value falls back to the at-grant 4-year figure when an
      // offer exists (no price-derived growth is ever applied without a
      // ticker), and stays null when there is no offer data at all.
      if (e.base !== null) {
        const atGrant4yr = e.base * 4 + (e.signingBonus ?? 0) + (e.stockGrantTotal4yr ?? 0);
        expect(realized4yr(e, prices)).toBe(atGrant4yr);
        expect(realized4yr(e, null)).toBe(atGrant4yr);
      } else {
        expect(realized4yr(e, prices)).toBeNull();
        expect(realized4yr(e, null)).toBeNull();
      }
    }
  });

  it('every entry documents its source and method honestly', () => {
    for (const e of LEADERBOARD_2024) {
      expect(e.source.length).toBeGreaterThan(0);
      expect(e.method.length).toBeGreaterThan(0);
      expect(e.accessDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });

  it('estimates are labeled as estimates', () => {
    const estimates = LEADERBOARD_2024.filter((e) => e.confidence === 'estimate');
    expect(estimates.length).toBeGreaterThan(0);
    for (const e of estimates) {
      expect(e.method.toLowerCase()).toContain('estimate');
    }
  });
});

describe('leaderboard realized-value math', () => {
  const entry = {
    ticker: 'META',
    base: 100000,
    signingBonus: 20000,
    stockGrantTotal4yr: 400000,
  };

  it('computes offer TC at grant as base + signing + grant/4', () => {
    expect(offerTcAtGrant(entry)).toBe(100000 + 20000 + 100000);
  });

  it('computes realized 4yr value with mocked prices', () => {
    // base*4 + signing + grant/priceAtGrant*priceNow
    expect(realized4yr(entry, prices)).toBe(400000 + 20000 + (400000 / 100) * 150);
  });

  it('falls back to at-grant 4-year value when prices are unavailable', () => {
    // base*4 + signing + grant (no price-derived growth without prices)
    expect(realized4yr(entry, null)).toBe(400000 + 20000 + 400000);
    expect(realized4yr(entry, { ...prices, priceAtGrant: 0 })).toBe(400000 + 20000 + 400000);
  });

  it('computes stock growth since grant as a fraction', () => {
    expect(stockGrowthSinceGrant(prices)).toBeCloseTo(0.5, 10);
    expect(stockGrowthSinceGrant(null)).toBeNull();
  });

  it('picks the monthly close nearest the grant date', () => {
    const closes: MonthlyClose[] = [
      { date: '2024-06-30', close: 90 },
      { date: '2024-07-31', close: 95 },
      { date: '2024-08-31', close: 110 },
    ];
    expect(priceAtDate(closes, '2024-08-01')?.close).toBe(95);
    expect(priceAtDate([], '2024-08-01')).toBeNull();
  });
});

describe('startup leaderboard dataset', () => {
  it('has 14 entries and every entry parses the schema', async () => {
    const { STARTUP_LEADERBOARD, StartupEntry } = await import('@/data/startupLeaderboard2024');
    expect(STARTUP_LEADERBOARD.length).toBe(14);
    for (const e of STARTUP_LEADERBOARD) {
      expect(() => StartupEntry.parse(e)).not.toThrow();
    }
  });

  it('every entry carries a valid company group', async () => {
    const { STARTUP_LEADERBOARD } = await import('@/data/startupLeaderboard2024');
    const { CompanyGroup, COMPANY_GROUPS, COMPANY_GROUP_LABELS } = await import('@/data/companyGroups');
    for (const e of [...LEADERBOARD_2024, ...STARTUP_LEADERBOARD]) {
      expect(CompanyGroup.safeParse(e.group).success).toBe(true);
    }
    for (const g of COMPANY_GROUPS) {
      expect(COMPANY_GROUP_LABELS[g].length).toBeGreaterThan(0);
    }
  });

  it('all valuations are positive and latest >= anchor when anchored', async () => {
    const { STARTUP_LEADERBOARD } = await import('@/data/startupLeaderboard2024');
    for (const e of STARTUP_LEADERBOARD) {
      expect(e.latestValuationUsd).toBeGreaterThan(0);
      if (e.valuationAug2024Usd !== null) {
        expect(e.valuationAug2024Usd).toBeGreaterThan(0);
        expect(e.latestValuationUsd).toBeGreaterThanOrEqual(e.valuationAug2024Usd);
      }
    }
  });

  it('computes valuation growth since 2024 as latest/anchor - 1', async () => {
    const { STARTUP_LEADERBOARD } = await import('@/data/startupLeaderboard2024');
    const { valuationGrowthSince2024, valuationGrowthMultiple } = await import('@/lib/leaderboard');
    const stripe = STARTUP_LEADERBOARD.find((e) => e.company === 'Stripe')!;
    expect(valuationGrowthSince2024(stripe)).toBeCloseTo(159 / 70 - 1, 10);
    expect(valuationGrowthMultiple(stripe)).toBeCloseTo(159 / 70, 10);
  });

  it('returns null growth for entries without a 2024 anchor', async () => {
    const { STARTUP_LEADERBOARD } = await import('@/data/startupLeaderboard2024');
    const { valuationGrowthSince2024, startupTcPerYearWithGrowth } = await import('@/lib/leaderboard');
    const discord = STARTUP_LEADERBOARD.find((e) => e.company === 'Discord')!;
    expect(discord.valuationAug2024Usd).toBeNull();
    expect(valuationGrowthSince2024(discord)).toBeNull();
    expect(startupTcPerYearWithGrowth(discord)).toBeNull();
  });

  it('annualizes one-time signing bonuses instead of counting them as recurring cash', async () => {
    const { STARTUP_LEADERBOARD } = await import('@/data/startupLeaderboard2024');
    const { startupTcPerYearWithGrowth } = await import('@/lib/leaderboard');
    const stripe = STARTUP_LEADERBOARD.find((e) => e.company === 'Stripe')!;
    // base + signing/4 + one year of stock × growth multiple
    expect(startupTcPerYearWithGrowth(stripe)).toBeCloseTo(146000 + 0 / 4 + 45300 * (159 / 70), 6);
    const databricks = STARTUP_LEADERBOARD.find((e) => e.company === 'Databricks')!;
    expect(startupTcPerYearWithGrowth(databricks)).toBeCloseTo(148000 + 0 / 4 + 94500 * (190 / 43), 6);
  });

  it('Applied Intuition uses only public figures', async () => {
    const { STARTUP_LEADERBOARD } = await import('@/data/startupLeaderboard2024');
    const { startupTcPerYearWithGrowth } = await import('@/lib/leaderboard');
    const ai = STARTUP_LEADERBOARD.find((e) => e.company === 'Applied Intuition')!;
    const haystack = JSON.stringify(ai).toLowerCase();
    // No private/internal numbers: share prices, strikes, personal identifiers, private URLs.
    for (const leak of ['136.39', '149.24', '31.09', '37.50', 'chirag', 'bangera', 'token=']) {
      expect(haystack).not.toContain(leak);
    }
    // Bay Area entry-level aggregate found on levels.fyi (read 2026-09-24):
    // $145K base + $61.6K/yr stock, TC = $206.6K. Breakdown sums honestly.
    expect(ai.ngOfferTc2024).toBe(206600);
    expect(ai.ngBase2024).toBe(145000);
    expect(ai.ngStockPerYearAtGrant).toBe(61600);
    expect(ai.ngSigning2024).toBe(0);
    expect(startupTcPerYearWithGrowth(ai)).not.toBeNull();
    // Valuations are still the public press-covered anchors.
    expect(ai.latestValuationUsd).toBe(15e9);
    expect(ai.valuationAug2024Usd).toBe(6e9);
  });

  it('rejects startup entries whose breakdown does not sum to the offer TC', async () => {
    const { STARTUP_LEADERBOARD, StartupEntry } = await import('@/data/startupLeaderboard2024');
    const stripe = STARTUP_LEADERBOARD.find((e) => e.company === 'Stripe')!;
    expect(() => StartupEntry.parse({ ...stripe, ngBase2024: 1 })).toThrow();
    expect(() => StartupEntry.parse({ ...stripe, ngOfferTc2024: 100000 })).toThrow();
  });
});

describe('leaderboard null-offer handling (unavailable rows)', () => {
  const bytedance = () => LEADERBOARD_2024.find((e) => e.company === 'ByteDance')!;

  it('levels.fyi-missing companies are unavailable with null offer components', () => {
    for (const name of ['ByteDance', 'LinkedIn']) {
      const e = LEADERBOARD_2024.find((x) => x.company === name)!;
      expect(e, name).toBeDefined();
      expect(e.base).toBeNull();
      expect(e.signingBonus).toBeNull();
      expect(e.stockGrantTotal4yr).toBeNull();
      expect(e.confidence).toBe('unavailable');
      expect(e.source).toBe('levels.fyi');
      expect(e.sourceUrl).toContain('levels.fyi/companies/');
    }
  });

  it('Palantir keeps its levels.fyi postings-based estimate', () => {
    const p = LEADERBOARD_2024.find((e) => e.company === 'Palantir')!;
    expect(p.ticker).toBe('PLTR');
    expect(p.base).toBe(145000);
    expect(p.signingBonus).toBeNull();
    expect(p.stockGrantTotal4yr).toBeNull();
    expect(p.confidence).toBe('estimate');
    expect(p.source).toBe('levels.fyi');
    expect(p.method).toContain('no equity data available');
  });

  it('null offers produce no offer-derived values but keep the stock move', async () => {
    const { tcPerYearWithGrowth, stockGrowthSinceGrant } = await import('@/lib/leaderboard');
    const b = bytedance();
    expect(offerTcAtGrant(b)).toBeNull();
    expect(realized4yr(b, prices)).toBeNull();
    expect(tcPerYearWithGrowth(realized4yr(b, prices))).toBeNull();
    expect(stockGrowthSinceGrant(prices)).toBeCloseTo(0.5, 10);
  });

  it('rejects partially-null offer fields and nulls without unavailable confidence', () => {
    const meta = LEADERBOARD_2024.find((e) => e.company === 'Meta')!;
    expect(() => LeaderboardEntry.parse({ ...meta, base: null })).toThrow();
    expect(() => LeaderboardEntry.parse({ ...meta, base: null, signingBonus: null, stockGrantTotal4yr: null })).toThrow();
    expect(() => LeaderboardEntry.parse({ ...bytedance(), confidence: 'sourced' })).toThrow();
    expect(() => LeaderboardEntry.parse({ ...bytedance(), base: 100000, signingBonus: 0, stockGrantTotal4yr: 0 })).toThrow();
    // Palantir's null stock grant is only valid on an estimate (no equity data published).
    const palantir = LEADERBOARD_2024.find((e) => e.company === 'Palantir')!;
    expect(() => LeaderboardEntry.parse({ ...palantir, confidence: 'sourced' })).toThrow();
    expect(() => LeaderboardEntry.parse(palantir)).not.toThrow();
  });

  it('counts unreported signing as $0 in TC math, disclosed as unknown', () => {
    const snap = LEADERBOARD_2024.find((e) => e.company === 'Snap')!;
    expect(snap.signingBonus).toBe(0);
    expect(snap.base).toBe(136000);
    expect(snap.stockGrantTotal4yr).toBe(205600);
    expect(() => LeaderboardEntry.parse(snap)).not.toThrow();
    // Unknown signing is counted as $0 in TC math, disclosed in method.
    expect(offerTcAtGrant(snap)).toBe(136000 + 0 + 205600 / 4);
    expect(snap.method.toLowerCase()).toContain('unknown, not zero');
  });

  it('postings-based null stock counts as $0 in TC math (base only)', async () => {
    const palantir = LEADERBOARD_2024.find((e) => e.company === 'Palantir')!;
    expect(offerTcAtGrant(palantir)).toBe(145000);
    expect(realized4yr(palantir, prices)).toBeCloseTo(145000 * 4, 10);
  });

  it('2024 rows are levels.fyi Bay Area entry-level averages with honest estimate labeling', () => {
    const estimates = LEADERBOARD_2024.filter((e) => e.confidence === 'estimate');
    expect(estimates.length).toBeGreaterThan(15);
    for (const e of estimates) {
      expect(() => LeaderboardEntry.parse(e)).not.toThrow();
      expect(e.source).toBe('levels.fyi');
      expect(e.sourceUrl).toContain('levels.fyi');
      expect(e.method).toContain('read 2026-09-24');
    }
    // Bay Area aggregates carry the required method format; averages, not medians.
    const google = LEADERBOARD_2024.find((e) => e.company === 'Google')!;
    expect(google.base).toBe(162000);
    expect(google.stockGrantTotal4yr).toBe(165200);
    expect(google.method).toContain('levels.fyi L3 entry-level aggregate (average), 24,223 submissions, read 2026-09-24');
    expect(google.method.toLowerCase()).not.toContain('median');
    // Every row carries its offer city; Arm is Austin-only.
    for (const e of LEADERBOARD_2024) {
      expect(e.city.length).toBeGreaterThan(0);
    }
    expect(LEADERBOARD_2024.find((e) => e.company === 'Arm')!.city).toBe('Austin');
    expect(google.city).toBe('San Francisco Bay Area');
    // Null-ticker private/subsidiary entries cannot make growth claims.
    for (const name of ['LinkedIn', 'ByteDance']) {
      const e = LEADERBOARD_2024.find((x) => x.company === name)!;
      expect(e.ticker).toBeNull();
      expect(realized4yr(e, prices)).toBeNull();
    }
    // Tesla, AMD, Broadcom were researched and left out: no honest 2024 figure.
    for (const name of ['Tesla', 'AMD', 'Broadcom']) {
      expect(LEADERBOARD_2024.find((x) => x.company === name)).toBeUndefined();
    }
  });
});

describe('tcPerYearWithGrowth', () => {
  it('annualizes the realized 4-year value', async () => {
    const { tcPerYearWithGrowth } = await import('@/lib/leaderboard');
    expect(tcPerYearWithGrowth(1020000)).toBe(255000);
    expect(tcPerYearWithGrowth(0)).toBe(0);
    expect(tcPerYearWithGrowth(null)).toBeNull();
  });
});

describe('leaderboard COL adjustment', () => {
  it('Ann Arbor is the 1.00 base and conversion scales by base/Bay-Area factors', async () => {
    const { ALL_CITY_PRESETS } = await import('@/lib/col');
    const byKey = (key: string) => ALL_CITY_PRESETS.find((c) => c.key === key);
    const annArbor = byKey('renter-ann-arbor');
    expect(annArbor?.factor).toBe(1.0);
    const bayAreaFactor = 1.4;
    // Same formula the panel applies: nominal / BAY_AREA_FACTOR * base.factor
    expect(200000 * (annArbor!.factor / bayAreaFactor)).toBeCloseTo(142857.14, 1);
    const sunnyvale = byKey('renter-sunnyvale');
    expect(200000 * (sunnyvale!.factor / bayAreaFactor)).toBeCloseTo(210000, 0);
    expect(byKey('nope')).toBeUndefined();
  });
});

describe('leaderboard group filters', () => {
  it('each group selects the expected companies across both tables', async () => {
    const { STARTUP_LEADERBOARD } = await import('@/data/startupLeaderboard2024');
    const inGroups = (groups: string[]) => ({
      public: LEADERBOARD_2024.filter((e) => groups.includes(e.group)).map((e) => e.company),
      startups: STARTUP_LEADERBOARD.filter((e) => groups.includes(e.group)).map((e) => e.company),
    });
    const ai = inGroups(['ai']);
    expect(ai.public).toEqual(['Databricks', 'Waymo', 'Applied Intuition']);
    expect(ai.startups).toEqual(expect.arrayContaining(['Anthropic', 'OpenAI', 'Perplexity']));
    const defense = inGroups(['defense']);
    expect(defense.public).toEqual(['Palantir']);
    expect(defense.startups).toEqual(['Anduril']);
    // Unchecking everything but big-tech hides every startup row.
    const bigTechOnly = inGroups(['big-tech']);
    expect(bigTechOnly.startups).toEqual([]);
    expect(bigTechOnly.public).toEqual(
      expect.arrayContaining(['Meta', 'Google', 'Amazon', 'Microsoft', 'Netflix', 'Nvidia', 'Apple', 'Arm', 'LinkedIn'])
    );
    // New research-backed companies land in the right groups.
    const consumer = inGroups(['consumer']);
    expect(consumer.public).toEqual(expect.arrayContaining(['Airbnb', 'Uber', 'Roblox', 'Snap', 'Pinterest', 'ByteDance']));
    expect(inGroups(['enterprise']).public).toEqual(expect.arrayContaining(['Salesforce', 'Adobe', 'Snowflake']));
  });
});

describe('no illustrative wording in leaderboard data or UI', () => {
  it('leaderboard datasets, lib, and panel contain no "illustrative"', async () => {
    const { readFileSync } = await import('node:fs');
    const files = [
      '../data/leaderboard2024.ts',
      '../data/startupLeaderboard2024.ts',
      '../data/companyGroups.ts',
      '../lib/leaderboard.ts',
      '../components/LeaderboardPanel.tsx',
    ];
    for (const f of files) {
      const text = readFileSync(new URL(f, import.meta.url), 'utf8').toLowerCase();
      expect(text, f).not.toContain('illustrative');
    }
  });
});

describe('leaderboard offer cities for per-offer COL normalization', () => {
  it('maps each 2024 offer city to a COL preset factor', async () => {
    const { ALL_CITY_PRESETS, matchCityPresetKey } = await import('@/lib/col');
    const factorFor = (city: string): number => {
      const preset = ALL_CITY_PRESETS.find((c) => c.key === matchCityPresetKey(city));
      return preset?.factor ?? 1.4;
    };
    // Bay Area rows normalize with the SF factor; Arm normalizes from Austin.
    expect(factorFor('San Francisco Bay Area')).toBe(1.4);
    expect(factorFor('Austin')).toBe(1.05);
    const arm = LEADERBOARD_2024.find((e) => e.company === 'Arm')!;
    expect(arm.city).toBe('Austin');
    const bayRows = LEADERBOARD_2024.filter(
      (e) => e.confidence === 'estimate' && e.company !== 'Arm' && e.city !== 'US',
    );
    expect(bayRows.length).toBeGreaterThan(15);
    for (const e of bayRows) {
      expect(e.city).toBe('San Francisco Bay Area');
    }
    // US-aggregate rows (no Bay Area entry-level page) carry city 'US' and
    // normalize with the default factor; they are labeled as US aggregates.
    const usRows = LEADERBOARD_2024.filter((e) => e.city === 'US' && e.confidence === 'estimate');
    expect(usRows.length).toBe(5);
    for (const e of usRows) {
      expect(e.method).toContain('US aggregate');
    }
    // Per-offer normalization actually moves Arm vs a Bay Area row:
    // same nominal $100K is worth more from Austin than from the Bay Area.
    const baseCity = ALL_CITY_PRESETS.find((c) => c.key === 'renter-ann-arbor')!;
    const adj = (city: string, n: number) => (n * baseCity.factor) / factorFor(city);
    expect(adj('Austin', 100000)).toBeGreaterThan(adj('San Francisco Bay Area', 100000));
  });
});
