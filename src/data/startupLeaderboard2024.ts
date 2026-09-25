import { z } from 'zod';
import { CompanyGroup } from './companyGroups';

/**
 * Top-startups leaderboard dataset: latest private valuations for the hottest
 * private companies, with an ~Aug-2024 anchor where one is honestly known.
 *
 * PRIVACY / HONESTY RULES (same bar as benchmarks.v2 and leaderboard2024):
 *  - Public facts only. Valuations are press-covered funding rounds, tender
 *    offers, or secondary marks — never private cap-table data. Applied
 *    Intuition's valuations are public press facts (owner-verified); its NG
 *    offer column is intentionally null because no *public* 2024 new-grad
 *    aggregate exists and the owner's private data is never used.
 *  - The anchor date is whatever the nearest press-covered mark was; it is
 *    labeled with its real date, never silently treated as exactly Aug 2024.
 *    Null when no 2024-era mark is publicly known.
 *  - 2024 NG offer TC appears ONLY where a levels.fyi entry-level figure
 *    exists, never invented and never private: Stripe and Databricks carry
 *    their Bay Area aggregates over from leaderboard2024.ts; Anduril, Ramp,
 *    Vercel, Rippling, Discord, and OpenAI use their levels.fyi US entry-level
 *    aggregates (no Bay Area entry-level pages exist for these). OpenAI's page
 *    publishes only a median total, so its components are null and its
 *    growth-marked TC is n/a. Applied Intuition's NG offer column is
 *    intentionally null because no *public* new-grad aggregate exists for its
 *    hub and the owner's private data is never used.
 *    The stock portion is stored separately so the growth-marked TC column
 *    can re-price it at the latest valuation.
 *  - Every entry carries its offer city ("United States" — no Bay Area
 *    entry-level pages exist for these companies). Per-offer COL normalization
 *    treats a US aggregate with the US-aggregate factor.
 */

export const STARTUP_DATASET_VERSION = 'v2.2026-09-24';

/** Last date any entry in this dataset was verified against its source. */
export const STARTUP_LAST_VERIFIED = '2026-09-24';

export const StartupConfidence = z.enum(['sourced', 'estimate', 'unavailable']);
export type TStartupConfidence = z.infer<typeof StartupConfidence>;

export const StartupEntry = z
  .object({
    /** Display company name. */
    company: z.string().min(1),
    /** City the NG offer figures are denominated in. "United States" for US-wide
     * levels.fyi aggregates (no Bay Area entry-level pages exist for these). */
    city: z.string().min(1),
    /** Company group for the leaderboard filter checkboxes. */
    group: CompanyGroup,
    /** Latest known valuation, USD. */
    latestValuationUsd: z.number().positive(),
    /** Date of the latest mark, YYYY-MM-DD. */
    latestValuationDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    /** What produced the latest mark, e.g. "Series H, May 2026" / "tender offer, Feb 2025". */
    latestValuationEvent: z.string().min(1),
    /**
     * Nearest press-covered valuation around Aug 2024, USD. Null when no
     * 2024-era mark is publicly known (no silent interpolation).
     */
    valuationAug2024Usd: z.number().positive().nullable(),
    /** Real date of the anchor mark (often not exactly Aug 2024). Null with valuationAug2024Usd. */
    valuationAug2024Date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
    /** What produced the anchor mark. Null with valuationAug2024Usd. */
    valuationAug2024Event: z.string().nullable(),
    /**
     * 2024 new-grad offer TC at grant (base + signing + stock/4), USD.
     * Only where a sourced figure exists; never invented.
     */
    ngOfferTc2024: z.number().int().nonnegative().nullable(),
    /**
     * One year of the 2024 NG stock grant (grant/4), USD. Needed to re-price
     * the stock portion at the latest valuation. Paired with ngOfferTc2024.
     */
    ngStockPerYearAtGrant: z.number().nonnegative().nullable(),
    /**
     * Annual base salary in the 2024 NG offer, USD. Only populated where the
     * dataset has a real component breakdown (Stripe, Databricks); null
     * elsewhere. Used to annualize the one-time signing bonus honestly.
     */
    ngBase2024: z.number().int().nonnegative().nullable(),
    /**
     * One-time signing bonus in the 2024 NG offer, USD. Annualized (÷ 4) in
     * average-annual-TC math — never treated as recurring cash.
     */
    ngSigning2024: z.number().int().nonnegative().nullable(),
    /** Human-readable public source. */
    source: z.string().min(1),
    /** Exact source URL, captured verbatim. */
    sourceUrl: z.string().url().optional(),
    /** Date the source was accessed, YYYY-MM-DD. */
    accessDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    /** Exactly how the numbers were produced; must disclose the anchor date and any caveats. */
    method: z.string().min(1),
    confidence: StartupConfidence,
  })
  .refine(
    (e) =>
      (e.ngStockPerYearAtGrant === null || e.ngOfferTc2024 !== null) &&
      (e.ngBase2024 === null) === (e.ngSigning2024 === null) &&
      (e.ngOfferTc2024 === null || e.ngBase2024 === null || e.ngSigning2024 === null || e.ngStockPerYearAtGrant === null ||
        e.ngBase2024 + e.ngSigning2024 + e.ngStockPerYearAtGrant === e.ngOfferTc2024) &&
      (e.valuationAug2024Usd === null) === (e.valuationAug2024Date === null) &&
      (e.valuationAug2024Usd === null) === (e.valuationAug2024Event === null),
    {
      message:
        'a present stock split requires a present offer TC (a total-only median may stand alone), ngBase2024/ngSigning2024 must be null together, and a present breakdown must sum to the offer TC',
    },
  );
export type TStartupEntry = z.infer<typeof StartupEntry>;

const ACCESS = '2026-09-24';

/**
 * Stripe / Databricks NG offer figures are carried over from leaderboard2024.ts
 * (same sourced ranges, same methods) so the TC/yr-with-growth column prices
 * real 2024 offers against valuation growth. No other company has a sourced
 * 2024 new-grad offer figure in this project, so the rest stay null.
 */
const RAW: TStartupEntry[] = [
  {
    company: 'Anthropic',
    city: 'United States',
    group: 'ai',
    latestValuationUsd: 380e9,
    latestValuationDate: '2026-02-01',
    latestValuationEvent: 'Series G, $30B (Coatue + GIC led)',
    valuationAug2024Usd: 18.4e9,
    valuationAug2024Date: '2024-03-01',
    valuationAug2024Event: 'Amazon strategic investment completion ($2.75B tranche)',
    ngOfferTc2024: null,
    ngStockPerYearAtGrant: null,
    ngBase2024: null,
    ngSigning2024: null,
    source: 'Company funding announcement + Crunchbase round coverage',
    sourceUrl:
      'https://github.com/pedro-bright/the-ledger/blob/HEAD/content/events/2026/53-anthropic-series-h-65b.md',
    accessDate: ACCESS,
    method:
      'Latest: $965B post-money, May 2026 Series H. Anchor: ~$18.4B post, early-2024 Menlo-led round. levels.fyi checked 2026-09-24: the $367K figure is an all-levels aggregate, NOT entry level, so it is not used. No entry-level data on levels.fyi - NG TC is unavailable, never invented.',
    confidence: 'unavailable',
  },
  {
    company: 'Mercor',
    city: 'United States',
    group: 'startups',
    latestValuationUsd: 10e9,
    latestValuationDate: '2025-10-01',
    latestValuationEvent: 'Series C, $350M (Felicis led)',
    valuationAug2024Usd: 250e6,
    valuationAug2024Date: '2024-09-01',
    valuationAug2024Event: 'Series A, ~$30-35M (Benchmark led)',
    ngOfferTc2024: null,
    ngStockPerYearAtGrant: null,
    ngBase2024: null,
    ngSigning2024: null,
    source: 'TechCrunch (Series B); Series C reported by TechCrunch via Beamstart',
    sourceUrl:
      'https://beamstart.com/news/mercor-quintuples-valuation-to-10b-17615810758582',
    accessDate: ACCESS,
    method:
      'Latest: $10B, Oct 2025 Series C $350M led by Felicis (TechCrunch-reported). Anchor: $250M, Sep 2024 Series A $32M led by Benchmark (Forbes/TechCrunch). Reported 2026 $20B talks are talks, not a closed round - excluded. levels.fyi checked 2026-09-24: no entry-level band, only an all-levels median - NG TC is unavailable, never invented.',
    confidence: 'unavailable',
  },
  {
    company: 'Figure AI',
    city: 'United States',
    group: 'startups',
    latestValuationUsd: 39e9,
    latestValuationDate: '2025-09-16',
    latestValuationEvent: 'Series C, $1B+ committed (Parkway VC led)',
    valuationAug2024Usd: 2.6e9,
    valuationAug2024Date: '2024-02-29',
    valuationAug2024Event: 'Series B, $675M (Microsoft, Nvidia, Bezos, OpenAI Startup Fund)',
    ngOfferTc2024: null,
    ngStockPerYearAtGrant: null,
    ngBase2024: null,
    ngSigning2024: null,
    source: 'Reuters',
    sourceUrl:
      'https://www.reuters.com/business/robotics-startup-figure-valued-39-billion-latest-funding-round-2025-09-16/',
    accessDate: ACCESS,
    method:
      'Latest: $39B post-money Series C, Sep 2025. Anchor: $2.6B, Feb 2024 round (both per the same Reuters report). levels.fyi checked 2026-09-24: an entry-level band exists but has zero submissions - NG TC is unavailable, never invented.',
    confidence: 'unavailable',
  },
  {
    company: 'Ramp',
    city: 'United States',
    group: 'startups',
    latestValuationUsd: 32e9,
    latestValuationDate: '2025-11-17',
    latestValuationEvent: 'Series E-3, $300M + tender (Lightspeed led)',
    valuationAug2024Usd: 7.65e9,
    valuationAug2024Date: '2024-04-01',
    valuationAug2024Event: 'Series D, $150M (Khosla + Founders Fund led)',
    ngOfferTc2024: 225800,
    ngStockPerYearAtGrant: 51800,
    ngBase2024: 174000,
    ngSigning2024: 0,
    source: 'levels.fyi',
    sourceUrl:
      'https://www.levels.fyi/companies/ramp/salaries/software-engineer',
    accessDate: ACCESS,
    method:
      'Estimate from levels.fyi New Grad entry-level aggregate (average), 125 submissions, read 2026-09-24: $174K base + $51.8K/yr stock. Signing bonus not reported by levels.fyi; counted as $0 (unknown, not zero). Private company: equity is illiquid paper. US aggregate - no Bay Area entry-level page exists.',
    confidence: 'estimate',
  },
  {
    company: 'OpenAI',
    city: 'United States',
    group: 'ai',
    latestValuationUsd: 852e9,
    latestValuationDate: '2026-03-31',
    latestValuationEvent: 'Series C, $122B (Amazon/Nvidia/SoftBank/a16z)',
    valuationAug2024Usd: 157e9,
    valuationAug2024Date: '2024-10-02',
    valuationAug2024Event: '$6.6B round (Thrive/Microsoft/Nvidia)',
    ngOfferTc2024: 249500,
    ngStockPerYearAtGrant: null,
    ngBase2024: null,
    ngSigning2024: null,
    source: 'levels.fyi',
    sourceUrl:
      'https://www.levels.fyi/companies/openai/salaries/software-engineer',
    accessDate: ACCESS,
    method:
      'levels.fyi L2 entry-level median total only, no component breakdown available. $249.5K median total, 238 submissions, read 2026-09-24. Base/stock/bonus split is not published, so the stock portion cannot be re-priced at valuation growth - TC/yr with growth is n/a. Private company: equity is illiquid paper. US aggregate - no Bay Area entry-level page exists.',
    confidence: 'estimate',
  },
  {
    company: 'Databricks',
    city: 'United States',
    group: 'ai',
    latestValuationUsd: 188e9,
    latestValuationDate: '2026-07-17',
    latestValuationEvent: 'Announced round ~$3B (Coatue led)',
    valuationAug2024Usd: 62e9,
    valuationAug2024Date: '2024-12-17',
    valuationAug2024Event: 'Series J, $10B (Thrive led)',
    ngOfferTc2024: 242500,
    ngStockPerYearAtGrant: 94500,
    ngBase2024: 148000,
    ngSigning2024: 0,
    source: 'levels.fyi',
    sourceUrl:
      'https://www.levels.fyi/companies/databricks/salaries/software-engineer/locations/san-francisco-bay-area',
    accessDate: ACCESS,
    method:
      'Estimate from levels.fyi L3 entry-level aggregate (average), 641 submissions, read 2026-09-24: $148K base + $94.5K/yr stock. Signing bonus not reported by levels.fyi; counted as $0 (unknown, not zero). Private company: equity is illiquid paper. Carried from leaderboard2024.ts (same Bay Area aggregate). Valuation: latest $190B strategic round, Aug 2026; anchor $43B Series I, Sep 2023.',
    confidence: 'estimate',
  },
  {
    company: 'Anduril',
    city: 'United States',
    group: 'defense',
    latestValuationUsd: 30.5e9,
    latestValuationDate: '2025-06-05',
    latestValuationEvent: 'Series G, $2.5B (Founders Fund led)',
    valuationAug2024Usd: 14e9,
    valuationAug2024Date: '2024-08-01',
    valuationAug2024Event: 'Series F, $1.5B (Founders Fund + Sands Capital led)',
    ngOfferTc2024: 227900,
    ngStockPerYearAtGrant: 58900,
    ngBase2024: 169000,
    ngSigning2024: 0,
    source: 'levels.fyi',
    sourceUrl:
      'https://www.levels.fyi/companies/anduril-industries/salaries/software-engineer',
    accessDate: ACCESS,
    method:
      'Estimate from levels.fyi IC2 entry-level aggregate (average), 333 submissions, read 2026-09-24: $169K base + $58.9K/yr stock. Signing bonus not reported by levels.fyi; counted as $0 (unknown, not zero). Private company: equity is illiquid paper. US aggregate - no Bay Area entry-level page exists.',
    confidence: 'estimate',
  },
  {
    company: 'Vercel',
    city: 'United States',
    group: 'startups',
    latestValuationUsd: 9.3e9,
    latestValuationDate: '2025-09-30',
    latestValuationEvent: 'Series F, $300M (Accel + GIC co-led)',
    valuationAug2024Usd: 3.25e9,
    valuationAug2024Date: '2024-05-08',
    valuationAug2024Event: 'Series E, $250M',
    ngOfferTc2024: 206800,
    ngStockPerYearAtGrant: 33800,
    ngBase2024: 173000,
    ngSigning2024: 0,
    source: 'levels.fyi',
    sourceUrl:
      'https://www.levels.fyi/companies/vercel/salaries/software-engineer',
    accessDate: ACCESS,
    method:
      'Estimate from levels.fyi Entry entry-level aggregate (average), 45 submissions, read 2026-09-24: $173K base + $33.8K/yr stock. Thin data (45 submissions). Signing bonus not reported by levels.fyi; counted as $0 (unknown, not zero). Private company: equity is illiquid paper. US aggregate - no Bay Area entry-level page exists.',
    confidence: 'estimate',
  },
  {
    company: 'Rippling',
    city: 'United States',
    group: 'startups',
    latestValuationUsd: 16.8e9,
    latestValuationDate: '2025-05-09',
    latestValuationEvent: 'Series G, $450M (Elad Gil, Sands, GIC, Goldman Sachs)',
    valuationAug2024Usd: 13.5e9,
    valuationAug2024Date: '2024-04-22',
    valuationAug2024Event: 'Series F, $200M (Coatue led)',
    ngOfferTc2024: 203100,
    ngStockPerYearAtGrant: 33100,
    ngBase2024: 170000,
    ngSigning2024: 0,
    source: 'levels.fyi',
    sourceUrl:
      'https://www.levels.fyi/companies/rippling/salaries/software-engineer',
    accessDate: ACCESS,
    method:
      'Estimate from levels.fyi L5 entry-level aggregate (average), 435 submissions, read 2026-09-24: $170K base + $33.1K/yr stock. Signing bonus not reported by levels.fyi; counted as $0 (unknown, not zero). Private company: equity is illiquid paper. US aggregate - no Bay Area entry-level page exists.',
    confidence: 'estimate',
  },
  {
    company: 'Applied Intuition',
    city: 'San Francisco Bay Area',
    group: 'startups',
    latestValuationUsd: 15e9,
    latestValuationDate: '2025-06-17',
    latestValuationEvent: 'Series F, $600M (BlackRock + Kleiner Perkins co-led)',
    valuationAug2024Usd: 6e9,
    valuationAug2024Date: '2024-03-01',
    valuationAug2024Event: 'Series E, $250M',
    ngOfferTc2024: 206600,
    ngStockPerYearAtGrant: 61600,
    ngBase2024: 145000,
    ngSigning2024: 0,
    source: 'levels.fyi',
    sourceUrl:
      'https://www.levels.fyi/companies/applied-intuition/salaries/software-engineer/locations/san-francisco-bay-area',
    accessDate: ACCESS,
    method:
      'Valuations are public press facts: Series E Mar 2024 at $6B; Series F Jun 2025, $600M at $15B (BlackRock + Kleiner Perkins co-led). NG offer from levels.fyi Entry Level aggregate (average), 137 submissions, read 2026-09-24: $145K base + $61.6K/yr stock. TC = base + stock/yr = $206.6K (levels.fyi headline $209K includes a $2.3K/yr bonus, not counted in TC math). Bay Area page shows the same figures as the US aggregate. Stock type: Options (4-yr vest, 25% annually). Private company: equity is illiquid paper. Owner private compensation data is never used.',
    confidence: 'estimate',
  },
  {
    company: 'Stripe',
    city: 'United States',
    group: 'startups',
    latestValuationUsd: 159e9,
    latestValuationDate: '2026-02-01',
    latestValuationEvent: 'Employee tender offer',
    valuationAug2024Usd: 70e9,
    valuationAug2024Date: '2024-11-01',
    valuationAug2024Event: 'Employee tender offer',
    ngOfferTc2024: 191300,
    ngStockPerYearAtGrant: 45300,
    ngBase2024: 146000,
    ngSigning2024: 0,
    source: 'levels.fyi',
    sourceUrl:
      'https://www.levels.fyi/companies/stripe/salaries/software-engineer/locations/san-francisco-bay-area',
    accessDate: ACCESS,
    method:
      'Estimate from levels.fyi L1 entry-level aggregate (average), 1,530 submissions, read 2026-09-24: $146K base + $45.3K/yr stock. Signing bonus not reported by levels.fyi; counted as $0 (unknown, not zero). Private company: equity is illiquid paper. Carried from leaderboard2024.ts (same Bay Area aggregate). Valuation: latest $159B tender, Feb 2026; anchor Sequoia $70B internal mark, Jul 2024.',
    confidence: 'estimate',
  },
  {
    company: 'Perplexity',
    city: 'United States',
    group: 'ai',
    latestValuationUsd: 20e9,
    latestValuationDate: '2025-08-15',
    latestValuationEvent: '$200M round at $20B (closed Aug 2025)',
    valuationAug2024Usd: 9e9,
    valuationAug2024Date: '2024-12-01',
    valuationAug2024Event: '$250M round at $9B (Dec 2024)',
    ngOfferTc2024: null,
    ngStockPerYearAtGrant: null,
    ngBase2024: null,
    ngSigning2024: null,
    source: 'TechFundingNews',
    sourceUrl:
      'https://techfundingnews.com/perplexity-raises-200m-at-20b-valuation-ai-search/',
    accessDate: ACCESS,
    method:
      'Latest: $20B closed round, Aug 2025 (a later reported $30B round is talks, not closed - excluded). Anchor: $9B, Dec 2024. levels.fyi checked 2026-09-24: only mid-level data exists ($507K at 5 YOE), not entry level - NG TC is unavailable, never invented.',
    confidence: 'unavailable',
  },
  {
    company: 'Canva',
    city: 'United States',
    group: 'startups',
    latestValuationUsd: 42e9,
    latestValuationDate: '2026-09-15',
    latestValuationEvent: 'Employee share sale (Bloomberg, Sep 2026)',
    valuationAug2024Usd: 32e9,
    valuationAug2024Date: '2024-06-01',
    valuationAug2024Event: '2024 share sale at $32B',
    ngOfferTc2024: null,
    ngStockPerYearAtGrant: null,
    ngBase2024: null,
    ngSigning2024: null,
    source: 'Bloomberg (via Bloomberg Law)',
    sourceUrl:
      'https://news.bloomberglaw.com/capital-markets/canva-begins-share-sale-at-42-billion-valuation-in-road-to-ipo',
    accessDate: ACCESS,
    method:
      'Latest: $42B employee share sale, Sep 2026 (Bloomberg). Anchor: $32B 2024 share sale (per the same report). levels.fyi checked 2026-09-24: only Australia data exists, not usable for a US leaderboard - NG TC is unavailable, never invented.',
    confidence: 'unavailable',
  },
  {
    company: 'Discord',
    city: 'United States',
    group: 'consumer',
    latestValuationUsd: 8.53e9,
    latestValuationDate: '2026-07-08',
    latestValuationEvent: 'Forge secondary mark, Jul 2026',
    valuationAug2024Usd: null,
    valuationAug2024Date: null,
    valuationAug2024Event: null,
    ngOfferTc2024: 148600,
    ngStockPerYearAtGrant: 14600,
    ngBase2024: 134000,
    ngSigning2024: 0,
    source: 'levels.fyi',
    sourceUrl:
      'https://www.levels.fyi/companies/discord/salaries/software-engineer',
    accessDate: ACCESS,
    method:
      'Estimate from levels.fyi L1 entry-level aggregate (average), 84 submissions, read 2026-09-24: $134K base + $14.6K/yr stock. Signing bonus not reported by levels.fyi; counted as $0 (unknown, not zero). Private company RSU: equity is illiquid paper. US aggregate - no Bay Area entry-level page exists.',
    confidence: 'estimate',
  },
  {
    company: 'Waymo',
    city: 'United States',
    group: 'ai',
    latestValuationUsd: 126e9,
    latestValuationDate: '2026-02-02',
    latestValuationEvent: '$16B round at $126B (Dragoneer/DST/Sequoia led)',
    valuationAug2024Usd: 45e9,
    valuationAug2024Date: '2024-10-01',
    valuationAug2024Event: 'Series C $5.6B at $45B',
    ngOfferTc2024: null,
    ngStockPerYearAtGrant: null,
    ngBase2024: null,
    ngSigning2024: null,
    source: 'press',
    sourceUrl:
      'https://techietory.com/waymo-raises-historic-16-billion-at-126-billion-valuation/',
    accessDate: ACCESS,
    method:
      'Valuations are public press facts: Series C Oct 2024, $5.6B at $45B; $16B round Feb 2026 at $126B post-money (Dragoneer Investment Group, DST Global, Sequoia Capital led). Growth = 126/45 - 1 = +180%. No sourced 2024 new-grad offer figure, so offer TC columns are null.',
    confidence: 'sourced',
  },
];

/** The validated dataset. Throws at import time if any entry is malformed. */
export const STARTUP_LEADERBOARD: TStartupEntry[] = z.array(StartupEntry).parse(RAW);

/** Entries with an anchor valuation (eligible for growth ranking). */
export const ANCHORED_STARTUPS = STARTUP_LEADERBOARD.filter((e) => e.valuationAug2024Usd !== null);

/** Entries without a 2024-era anchor: shown after the ranked rows, labeled clearly. */
export const UNANCHORED_STARTUPS = STARTUP_LEADERBOARD.filter((e) => e.valuationAug2024Usd === null);
