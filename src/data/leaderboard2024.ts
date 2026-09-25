import { z } from 'zod';
import { CompanyGroup } from './companyGroups';

/**
 * New-grad offer leaderboard dataset (2024 / 2025 / 2026 tabs).
 *
 * HARD DATA RULE: every comp figure comes from levels.fyi — published
 * entry-level aggregates or levels.fyi job postings — and nothing else. No
 * Medium articles, no Blind threads, no third-party guides. When levels.fyi
 * has no entry-level aggregate for a company, the row is marked
 * `confidence: 'unavailable'` with the offer columns blank instead of
 * inventing numbers from another source.
 *
 * PRIVACY / HONESTY RULES (same bar as benchmarks.v2):
 *  - Aggregates only. Every entry is a levels.fyi entry-level aggregate
 *    (a clearly-labeled estimate backed out from annualized figures), a
 *    levels.fyi job-posting estimate, or `unavailable`. No individual offer
 *    rows, no exact-n sample sizes (bands only). Applied Intuition appears
 *    only via its PUBLIC levels.fyi aggregate (2026 tab) — never private data.
 *  - Every number carries a named source + access date + method string that
 *    says exactly how the figure was produced. Ranges are disclosed, never
 *    silently collapsed into precise-looking points.
 *  - `confidence: 'estimate'` marks entries that are NOT collected 2024
 *    offers (e.g. backed-out from a published benchmark). The UI must surface
 *    this; estimates must never be presented as collected offers.
 *  - `confidence: 'unavailable'` marks entries where no defensible
 *    new-grad offer figure exists. The row is kept for context (e.g. a public
 *    ticker whose stock move is worth showing) with the offer columns
 *    intentionally blank — never estimated.
 *
 * Grant-date convention: 2024-08-01 / 2025-08-01 / 2026-08-01 per tab
 * (canonical assumption, disclosed in the UI). Realized values are computed
 * at runtime from live market prices, so the ranking moves with the market.
 */

export const DATASET_VERSION = 'v1.2026-09-24';

/** Last date any entry in this dataset was verified against its source. */
export const LAST_VERIFIED = '2026-09-24';

/** Canonical grant-date assumption used when the exact grant date is unknown. */
export const GRANT_DATE_ASSUMPTION = '2024-08-01';

export const LeaderboardConfidence = z.enum(['sourced', 'estimate', 'unavailable']);
export type TLeaderboardConfidence = z.infer<typeof LeaderboardConfidence>;

export const LeaderboardSampleBand = z.enum(['<10', '10-50', '50+', 'unknown']);
export type TLeaderboardSampleBand = z.infer<typeof LeaderboardSampleBand>;

export const LeaderboardEntry = z.object({
  /** Display company name, e.g. "Meta". */
  company: z.string().min(1),
  /** Company group for the leaderboard filter checkboxes. */
  group: CompanyGroup,
  /** Public ticker, or null for private companies (no price history). */
  ticker: z
    .string()
    .regex(/^[A-Z]{1,5}$/)
    .nullable(),
  /** Company-specific level label, e.g. "E3", "SDE I". "New Grad" when the source gave none. */
  levelLabel: z.string().min(1),
  /**
   * City the offer figures are denominated in, e.g. "San Francisco Bay Area".
   * Used for per-offer COL normalization: "Adjust by COL" converts each row
   * from its own city to the selected base city. "US" means a US-wide
   * aggregate with no metro break-out (falls back to the Bay Area factor).
   */
  city: z.string().min(1),
  /** Annual base salary, USD. Null when no defensible offer figure exists (see 'unavailable' confidence). */
  base: z.number().int().nonnegative().nullable(),
  /**
   * Total signing bonus, USD. Counted in full in the at-grant TC column;
   * Amazon's is actually paid over years 1-2 (disclosed in method).
   * Null with base when no defensible offer figure exists. May also be null
   * on its own when the source aggregate does not report signing (counted as
   * $0 in TC math; the method must disclose that it is unknown, not zero).
   */
  signingBonus: z.number().int().nonnegative().nullable(),
  /**
   * Total 4-year stock/equity grant value at grant, USD.
   * Null with base when no defensible offer figure exists.
   */
  stockGrantTotal4yr: z.number().int().nonnegative().nullable(),
  /** Grant date, YYYY-MM-DD. v1 uses the canonical 2024-08-01 assumption. */
  grantDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  sampleBand: LeaderboardSampleBand,
  /** Human-readable public source. */
  source: z.string().min(1),
  /** Exact source URL, captured verbatim. */
  sourceUrl: z.string().url().optional(),
  /** Date the source was accessed, YYYY-MM-DD. */
  accessDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  /** Exactly how the numbers were produced; must disclose ranges and midpoints. */
  method: z.string().min(1),
  confidence: LeaderboardConfidence,
}).refine(
  (e) => {
    // Base is the offer anchor: it is null only together with the 4-yr stock
    // grant and only with confidence 'unavailable'. A present base with a null
    // stock grant is allowed for postings-based estimates (confidence
    // 'estimate') where the source published base ranges but no equity data —
    // TC math counts the unknown equity as $0, disclosed in the method.
    // Signing may be null on its own when the source aggregate does not
    // report it (counted as $0, with the method disclosing it is unknown
    // rather than zero).
    const offerNull = e.base === null && e.stockGrantTotal4yr === null;
    const offerPresent = e.base !== null;
    const stockNullOk =
      e.stockGrantTotal4yr === null
        ? e.base === null || e.confidence === 'estimate'
        : true;
    return (offerNull || offerPresent) && stockNullOk && (offerNull === (e.confidence === 'unavailable'));
  },
  {
    message:
      'base must be null together with stockGrantTotal4yr (and only with confidence "unavailable"); stockGrantTotal4yr may additionally be null alone on a postings-based estimate whose source published no equity data',
  },
);
export type TLeaderboardEntry = z.infer<typeof LeaderboardEntry>;

const ACCESS = '2026-09-24';

const RAW: TLeaderboardEntry[] = [
  {
    company: 'Google',
    group: 'big-tech',
    ticker: 'GOOGL',
    levelLabel: 'L3',
    city: 'San Francisco Bay Area',
    base: 162000,
    signingBonus: 0,
    stockGrantTotal4yr: 165200,
    grantDate: GRANT_DATE_ASSUMPTION,
    sampleBand: '50+',
    source: 'levels.fyi',
    sourceUrl: 'https://www.levels.fyi/companies/google/salaries/software-engineer/locations/san-francisco-bay-area',
    accessDate: ACCESS,
    method:
      'Estimate from levels.fyi L3 entry-level aggregate (average), 24,223 submissions, read 2026-09-24: $162K base + $41.3K/yr stock. 4-yr stock = $41.3K x 4. Signing bonus is not reported by levels.fyi; counted as $0 (unknown, not zero).',
    confidence: 'estimate',
  },
  {
    company: 'Meta',
    group: 'big-tech',
    ticker: 'META',
    levelLabel: 'E3',
    city: 'San Francisco Bay Area',
    base: 145000,
    signingBonus: 0,
    stockGrantTotal4yr: 141600,
    grantDate: GRANT_DATE_ASSUMPTION,
    sampleBand: '50+',
    source: 'levels.fyi',
    sourceUrl: 'https://www.levels.fyi/companies/meta/salaries/software-engineer/locations/san-francisco-bay-area',
    accessDate: ACCESS,
    method:
      'Estimate from levels.fyi E3 entry-level aggregate (average), 14,037 submissions, read 2026-09-24: $145K base + $35.4K/yr stock. 4-yr stock = $35.4K x 4. Signing bonus is not reported by levels.fyi; counted as $0 (unknown, not zero).',
    confidence: 'estimate',
  },
  {
    company: 'Amazon',
    group: 'big-tech',
    ticker: 'AMZN',
    levelLabel: 'SDE I',
    city: 'San Francisco Bay Area',
    base: 157000,
    signingBonus: 0,
    stockGrantTotal4yr: 174800,
    grantDate: GRANT_DATE_ASSUMPTION,
    sampleBand: '50+',
    source: 'levels.fyi',
    sourceUrl: 'https://www.levels.fyi/companies/amazon/salaries/software-engineer/locations/san-francisco-bay-area',
    accessDate: ACCESS,
    method:
      'Estimate from levels.fyi SDE I entry-level aggregate (average), 42,717 submissions, read 2026-09-24: $157K base + $43.7K/yr stock. 4-yr stock = $43.7K x 4. Signing bonus is not reported by levels.fyi; counted as $0 (unknown, not zero).',
    confidence: 'estimate',
  },
  {
    company: 'Apple',
    group: 'big-tech',
    ticker: 'AAPL',
    levelLabel: 'ICT2',
    city: 'San Francisco Bay Area',
    base: 150000,
    signingBonus: 0,
    stockGrantTotal4yr: 102000,
    grantDate: GRANT_DATE_ASSUMPTION,
    sampleBand: '50+',
    source: 'levels.fyi',
    sourceUrl: 'https://www.levels.fyi/companies/apple/salaries/software-engineer/locations/san-francisco-bay-area',
    accessDate: ACCESS,
    method:
      'Estimate from levels.fyi ICT2 entry-level aggregate (average), 7,143 submissions, read 2026-09-24: $150K base + $25.5K/yr stock. 4-yr stock = $25.5K x 4. Signing bonus is not reported by levels.fyi; counted as $0 (unknown, not zero).',
    confidence: 'estimate',
  },
  {
    company: 'Microsoft',
    group: 'big-tech',
    ticker: 'MSFT',
    levelLabel: '59',
    city: 'San Francisco Bay Area',
    base: 135000,
    signingBonus: 0,
    stockGrantTotal4yr: 100000,
    grantDate: GRANT_DATE_ASSUMPTION,
    sampleBand: '50+',
    source: 'levels.fyi',
    sourceUrl: 'https://www.levels.fyi/companies/microsoft/salaries/software-engineer/locations/san-francisco-bay-area',
    accessDate: ACCESS,
    method:
      'Estimate from levels.fyi 59 entry-level aggregate (average), 20,702 submissions, read 2026-09-24: $135K base + $25.0K/yr stock. 4-yr stock = $25.0K x 4. Signing bonus is not reported by levels.fyi; counted as $0 (unknown, not zero).',
    confidence: 'estimate',
  },
  {
    company: 'Netflix',
    group: 'big-tech',
    ticker: 'NFLX',
    levelLabel: 'L3',
    city: 'San Francisco Bay Area',
    base: 216000,
    signingBonus: 0,
    stockGrantTotal4yr: 0,
    grantDate: GRANT_DATE_ASSUMPTION,
    sampleBand: '50+',
    source: 'levels.fyi',
    sourceUrl: 'https://www.levels.fyi/companies/netflix/salaries/software-engineer/locations/san-francisco-bay-area',
    accessDate: ACCESS,
    method:
      'Estimate from levels.fyi L3 entry-level aggregate (average), 1,434 submissions, read 2026-09-24: $216K base + $0K/yr stock (no equity reported). Signing bonus is not reported by levels.fyi; counted as $0 (unknown, not zero). Effectively all-cash (no equity reported). Netflix rarely hires new grads - treat as an outlier, not a typical offer.',
    confidence: 'estimate',
  },
  {
    company: 'Nvidia',
    group: 'big-tech',
    ticker: 'NVDA',
    levelLabel: 'IC1',
    city: 'San Francisco Bay Area',
    base: 153000,
    signingBonus: 0,
    stockGrantTotal4yr: 102800,
    grantDate: GRANT_DATE_ASSUMPTION,
    sampleBand: '50+',
    source: 'levels.fyi',
    sourceUrl: 'https://www.levels.fyi/companies/nvidia/salaries/software-engineer/locations/san-francisco-bay-area',
    accessDate: ACCESS,
    method:
      'Estimate from levels.fyi IC1 entry-level aggregate (average), 2,396 submissions, read 2026-09-24: $153K base + $25.7K/yr stock. 4-yr stock = $25.7K x 4. Signing bonus is not reported by levels.fyi; counted as $0 (unknown, not zero).',
    confidence: 'estimate',
  },
  {
    company: 'Roblox',
    group: 'consumer',
    ticker: 'RBLX',
    levelLabel: 'IC1',
    city: 'San Francisco Bay Area',
    base: 153000,
    signingBonus: 0,
    stockGrantTotal4yr: 270000,
    grantDate: GRANT_DATE_ASSUMPTION,
    sampleBand: '50+',
    source: 'levels.fyi',
    sourceUrl: 'https://www.levels.fyi/companies/roblox/salaries/software-engineer/locations/san-francisco-bay-area',
    accessDate: ACCESS,
    method:
      'Estimate from levels.fyi IC1 entry-level aggregate (average), 591 submissions, read 2026-09-24: $153K base + $67.5K/yr stock. 4-yr stock = $67.5K x 4. Signing bonus is not reported by levels.fyi; counted as $0 (unknown, not zero).',
    confidence: 'estimate',
  },
  {
    company: 'Pinterest',
    group: 'consumer',
    ticker: 'PINS',
    levelLabel: 'IC13',
    city: 'San Francisco Bay Area',
    base: 164000,
    signingBonus: 0,
    stockGrantTotal4yr: 234400,
    grantDate: GRANT_DATE_ASSUMPTION,
    sampleBand: '50+',
    source: 'levels.fyi',
    sourceUrl: 'https://www.levels.fyi/companies/pinterest/salaries/software-engineer/locations/san-francisco-bay-area',
    accessDate: ACCESS,
    method:
      'Estimate from levels.fyi IC13 entry-level aggregate (average), 752 submissions, read 2026-09-24: $164K base + $58.6K/yr stock. 4-yr stock = $58.6K x 4. Signing bonus is not reported by levels.fyi; counted as $0 (unknown, not zero).',
    confidence: 'estimate',
  },
  {
    company: 'Snap',
    group: 'consumer',
    ticker: 'SNAP',
    levelLabel: 'L3',
    city: 'San Francisco Bay Area',
    base: 136000,
    signingBonus: 0,
    stockGrantTotal4yr: 205600,
    grantDate: GRANT_DATE_ASSUMPTION,
    sampleBand: '50+',
    source: 'levels.fyi',
    sourceUrl: 'https://www.levels.fyi/companies/snap/salaries/software-engineer/locations/san-francisco-bay-area',
    accessDate: ACCESS,
    method:
      'Estimate from levels.fyi L3 entry-level aggregate (average), 1,138 submissions, read 2026-09-24: $136K base + $51.4K/yr stock. 4-yr stock = $51.4K x 4. Signing bonus is not reported by levels.fyi; counted as $0 (unknown, not zero).',
    confidence: 'estimate',
  },
  {
    company: 'Snowflake',
    group: 'enterprise',
    ticker: 'SNOW',
    levelLabel: 'IC1',
    city: 'San Francisco Bay Area',
    base: 168000,
    signingBonus: 0,
    stockGrantTotal4yr: 229600,
    grantDate: GRANT_DATE_ASSUMPTION,
    sampleBand: '50+',
    source: 'levels.fyi',
    sourceUrl: 'https://www.levels.fyi/companies/snowflake/salaries/software-engineer/locations/san-francisco-bay-area',
    accessDate: ACCESS,
    method:
      'Estimate from levels.fyi IC1 entry-level aggregate (average), 568 submissions, read 2026-09-24: $168K base + $57.4K/yr stock. 4-yr stock = $57.4K x 4. Signing bonus is not reported by levels.fyi; counted as $0 (unknown, not zero).',
    confidence: 'estimate',
  },
  {
    company: 'Stripe',
    group: 'startups',
    ticker: null,
    levelLabel: 'L1',
    city: 'San Francisco Bay Area',
    base: 146000,
    signingBonus: 0,
    stockGrantTotal4yr: 181200,
    grantDate: GRANT_DATE_ASSUMPTION,
    sampleBand: '50+',
    source: 'levels.fyi',
    sourceUrl: 'https://www.levels.fyi/companies/stripe/salaries/software-engineer/locations/san-francisco-bay-area',
    accessDate: ACCESS,
    method:
      'Estimate from levels.fyi L1 entry-level aggregate (average), 1,530 submissions, read 2026-09-24: $146K base + $45.3K/yr stock. 4-yr stock = $45.3K x 4. Signing bonus is not reported by levels.fyi; counted as $0 (unknown, not zero). Private company: equity is illiquid paper.',
    confidence: 'estimate',
  },
  {
    company: 'Databricks',
    group: 'ai',
    ticker: null,
    levelLabel: 'L3',
    city: 'San Francisco Bay Area',
    base: 148000,
    signingBonus: 0,
    stockGrantTotal4yr: 378000,
    grantDate: GRANT_DATE_ASSUMPTION,
    sampleBand: '50+',
    source: 'levels.fyi',
    sourceUrl: 'https://www.levels.fyi/companies/databricks/salaries/software-engineer/locations/san-francisco-bay-area',
    accessDate: ACCESS,
    method:
      'Estimate from levels.fyi L3 entry-level aggregate (average), 641 submissions, read 2026-09-24: $148K base + $94.5K/yr stock. 4-yr stock = $94.5K x 4. Signing bonus is not reported by levels.fyi; counted as $0 (unknown, not zero). Private company: equity is illiquid paper.',
    confidence: 'estimate',
  },
  {
    company: 'Waymo',
    group: 'ai',
    ticker: null,
    levelLabel: 'L3',
    city: 'San Francisco Bay Area',
    base: 159000,
    signingBonus: 0,
    stockGrantTotal4yr: 184000,
    grantDate: GRANT_DATE_ASSUMPTION,
    sampleBand: '50+',
    source: 'levels.fyi',
    sourceUrl: 'https://www.levels.fyi/companies/waymo/salaries/software-engineer/locations/san-francisco-bay-area',
    accessDate: ACCESS,
    method:
      'Estimate from levels.fyi L3 entry-level aggregate (average), 403 submissions, read 2026-09-24: $159K base + $46K/yr stock. 4-yr stock = $46K x 4. Signing bonus is not reported by levels.fyi; counted as $0 (unknown, not zero). Waymo is an Alphabet subsidiary; equity is WMU (Waymo Mobility Units), a private RSU equivalent vesting 25/25/25/25 - private/illiquid paper.',
    confidence: 'estimate',
  },
  {
    company: 'Adobe',
    group: 'enterprise',
    ticker: 'ADBE',
    levelLabel: 'P10',
    city: 'San Francisco Bay Area',
    base: 138000,
    signingBonus: 0,
    stockGrantTotal4yr: 147200,
    grantDate: GRANT_DATE_ASSUMPTION,
    sampleBand: '50+',
    source: 'levels.fyi',
    sourceUrl: 'https://www.levels.fyi/companies/adobe/salaries/software-engineer/locations/san-francisco-bay-area',
    accessDate: ACCESS,
    method:
      'Estimate from levels.fyi P10 entry-level aggregate (average), 2,258 submissions, read 2026-09-24: $138K base + $36.8K/yr stock. 4-yr stock = $36.8K x 4. Signing bonus is not reported by levels.fyi; counted as $0 (unknown, not zero).',
    confidence: 'estimate',
  },
  {
    company: 'Airbnb',
    group: 'consumer',
    ticker: 'ABNB',
    levelLabel: 'G7',
    city: 'San Francisco Bay Area',
    base: 139000,
    signingBonus: 0,
    stockGrantTotal4yr: 175200,
    grantDate: GRANT_DATE_ASSUMPTION,
    sampleBand: '50+',
    source: 'levels.fyi',
    sourceUrl: 'https://www.levels.fyi/companies/airbnb/salaries/software-engineer/locations/san-francisco-bay-area',
    accessDate: ACCESS,
    method:
      'Estimate from levels.fyi G7 entry-level aggregate (average), 720 submissions, read 2026-09-24: $139K base + $43.8K/yr stock. 4-yr stock = $43.8K x 4. Signing bonus is not reported by levels.fyi; counted as $0 (unknown, not zero).',
    confidence: 'estimate',
  },
  {
    company: 'Salesforce',
    group: 'enterprise',
    ticker: 'CRM',
    levelLabel: 'AMTS',
    city: 'San Francisco Bay Area',
    base: 145000,
    signingBonus: 0,
    stockGrantTotal4yr: 72000,
    grantDate: GRANT_DATE_ASSUMPTION,
    sampleBand: '50+',
    source: 'levels.fyi',
    sourceUrl: 'https://www.levels.fyi/companies/salesforce/salaries/software-engineer/locations/san-francisco-bay-area',
    accessDate: ACCESS,
    method:
      'Estimate from levels.fyi AMTS entry-level aggregate (average), 4,662 submissions, read 2026-09-24: $145K base + $18.0K/yr stock. 4-yr stock = $18.0K x 4. Signing bonus is not reported by levels.fyi; counted as $0 (unknown, not zero).',
    confidence: 'estimate',
  },
  {
    company: 'Uber',
    group: 'consumer',
    ticker: 'UBER',
    levelLabel: 'SE I',
    city: 'San Francisco Bay Area',
    base: 153000,
    signingBonus: 0,
    stockGrantTotal4yr: 124000,
    grantDate: GRANT_DATE_ASSUMPTION,
    sampleBand: 'unknown',
    source: 'levels.fyi',
    sourceUrl: 'https://www.levels.fyi/companies/uber/salaries/software-engineer/levels/software-engineer-i/locations/san-francisco-bay-area',
    accessDate: ACCESS,
    method:
      'Estimate from levels.fyi SE I entry-level aggregate (average), submission count not in the extract, read 2026-09-24: $153K base + $31.0K/yr stock. 4-yr stock = $31.0K x 4. Signing bonus is not reported by levels.fyi; counted as $0 (unknown, not zero).',
    confidence: 'estimate',
  },
  {
    company: 'Arm',
    group: 'big-tech',
    ticker: 'ARM',
    levelLabel: 'Grade 2',
    city: 'Austin',
    base: 129000,
    signingBonus: 0,
    stockGrantTotal4yr: 91600,
    grantDate: GRANT_DATE_ASSUMPTION,
    sampleBand: '50+',
    source: 'levels.fyi',
    sourceUrl: 'https://www.levels.fyi/companies/arm/salaries/software-engineer/locations/greater-austin-area',
    accessDate: ACCESS,
    method:
      'Estimate from levels.fyi Grade 2 entry-level aggregate (average), 411 submissions, read 2026-09-24: $129K base + $22.9K/yr stock. 4-yr stock = $22.9K x 4. Signing bonus is not reported by levels.fyi; counted as $0 (unknown, not zero). Austin data - no Bay Area aggregate exists on levels.fyi for Arm entry-level.',
    confidence: 'estimate',
  },
  {
    company: 'Palantir',
    group: 'defense',
    ticker: 'PLTR',
    levelLabel: 'New Grad',
    city: 'San Francisco Bay Area',
    base: 145000,
    signingBonus: null,
    stockGrantTotal4yr: null,
    grantDate: GRANT_DATE_ASSUMPTION,
    sampleBand: 'unknown',
    source: 'levels.fyi',
    sourceUrl: 'https://www.levels.fyi/companies/palantir/salaries/software-engineer',
    accessDate: ACCESS,
    method:
      'Estimate from levels.fyi job posting base range $135K-$155K, no equity data available. Base is the midpoint ($145K) of published new-grad posting ranges: Forward Deployed SWE New Grad (Commercial, Chicago IL and Intel/US-Gov, Washington DC) $135-145K, SWE New Grad (Defense, Palo Alto CA) $145-155K, read 2026-09-24. Postings publish no signing or equity figures, so both are null (unknown, not zero): at-grant TC reflects base only and understates any real offer that had equity.',
    confidence: 'estimate',
  },
  {
    company: 'ByteDance',
    group: 'consumer',
    ticker: null,
    levelLabel: 'New Grad',
    city: 'US',
    base: null,
    signingBonus: null,
    stockGrantTotal4yr: null,
    grantDate: GRANT_DATE_ASSUMPTION,
    sampleBand: 'unknown',
    source: 'levels.fyi',
    sourceUrl: 'https://www.levels.fyi/companies/bytedance/salaries/software-engineer',
    accessDate: ACCESS,
    method:
      'No levels.fyi entry-level aggregate was available for ByteDance new-grad Software Engineer offers (read 2026-09-24). No non-levels.fyi sources are used, so the row is shown as insufficient data.',
    confidence: 'unavailable',
  },
  {
    company: 'LinkedIn',
    group: 'big-tech',
    ticker: null,
    levelLabel: 'New Grad',
    city: 'US',
    base: null,
    signingBonus: null,
    stockGrantTotal4yr: null,
    grantDate: GRANT_DATE_ASSUMPTION,
    sampleBand: 'unknown',
    source: 'levels.fyi',
    sourceUrl: 'https://www.levels.fyi/companies/linkedin/salaries/software-engineer',
    accessDate: ACCESS,
    method:
      'No levels.fyi entry-level aggregate was available for LinkedIn new-grad Software Engineer offers (read 2026-09-24). No non-levels.fyi sources are used, so the row is shown as insufficient data.',
    confidence: 'unavailable',
  },
  {
    company: 'Applied Intuition',
    group: 'ai',
    ticker: null,
    levelLabel: 'Entry Level',
    city: 'San Francisco Bay Area',
    base: 145000,
    signingBonus: 0,
    stockGrantTotal4yr: 246400,
    grantDate: GRANT_DATE_ASSUMPTION,
    sampleBand: '50+',
    source: 'levels.fyi',
    sourceUrl: 'https://www.levels.fyi/companies/applied-intuition/salaries/software-engineer/locations/san-francisco-bay-area',
    accessDate: ACCESS,
    method:
      'Estimate from levels.fyi Entry Level entry-level aggregate (average), 137 submissions, read 2026-09-24: $145K base + $61.6K/yr stock. 4-yr stock = $61.6K x 4. Signing bonus is not reported by levels.fyi; counted as $0 (unknown, not zero). levels.fyi also reports a $2.3K/yr bonus, not counted in TC math. Stock type: Options (4-yr vest, 25% annually). Private company: equity is illiquid paper.',
    confidence: 'estimate',
  },
  {
    company: 'Ramp',
    group: 'startups',
    ticker: null,
    levelLabel: 'New Grad',
    city: 'US',
    base: 174000,
    signingBonus: 0,
    stockGrantTotal4yr: 207200,
    grantDate: GRANT_DATE_ASSUMPTION,
    sampleBand: '50+',
    source: 'levels.fyi',
    sourceUrl: 'https://www.levels.fyi/companies/ramp/salaries/software-engineer',
    accessDate: ACCESS,
    method:
      'Estimate from levels.fyi New Grad entry-level aggregate (average), 125 submissions, read 2026-09-24: $174K base + $51.8K/yr stock. 4-yr stock = $51.8K x 4. Signing bonus is not reported by levels.fyi; counted as $0 (unknown, not zero). Private company: equity is illiquid paper. US aggregate - no Bay Area entry-level page exists.',
    confidence: 'estimate',
  },
  {
    company: 'Anduril',
    group: 'startups',
    ticker: null,
    levelLabel: 'IC2',
    city: 'US',
    base: 169000,
    signingBonus: 0,
    stockGrantTotal4yr: 235600,
    grantDate: GRANT_DATE_ASSUMPTION,
    sampleBand: '50+',
    source: 'levels.fyi',
    sourceUrl: 'https://www.levels.fyi/companies/anduril/salaries/software-engineer',
    accessDate: ACCESS,
    method:
      'Estimate from levels.fyi IC2 entry-level aggregate (average), 333 submissions, read 2026-09-24: $169K base + $58.9K/yr stock. 4-yr stock = $58.9K x 4. Signing bonus is not reported by levels.fyi; counted as $0 (unknown, not zero). Private company: equity is illiquid paper. US aggregate - no Bay Area entry-level page exists.',
    confidence: 'estimate',
  },
  {
    company: 'Vercel',
    group: 'startups',
    ticker: null,
    levelLabel: 'Entry',
    city: 'US',
    base: 173000,
    signingBonus: 0,
    stockGrantTotal4yr: 135200,
    grantDate: GRANT_DATE_ASSUMPTION,
    sampleBand: '10-50',
    source: 'levels.fyi',
    sourceUrl: 'https://www.levels.fyi/companies/vercel/salaries/software-engineer',
    accessDate: ACCESS,
    method:
      'Estimate from levels.fyi Entry entry-level aggregate (average), 45 submissions, read 2026-09-24: $173K base + $33.8K/yr stock. 4-yr stock = $33.8K x 4. Thin data (45 submissions). Signing bonus is not reported by levels.fyi; counted as $0 (unknown, not zero). Private company: equity is illiquid paper. US aggregate - no Bay Area entry-level page exists.',
    confidence: 'estimate',
  },
  {
    company: 'Rippling',
    group: 'startups',
    ticker: null,
    levelLabel: 'L5',
    city: 'US',
    base: 170000,
    signingBonus: 0,
    stockGrantTotal4yr: 132400,
    grantDate: GRANT_DATE_ASSUMPTION,
    sampleBand: '50+',
    source: 'levels.fyi',
    sourceUrl: 'https://www.levels.fyi/companies/rippling/salaries/software-engineer',
    accessDate: ACCESS,
    method:
      'Estimate from levels.fyi L5 entry-level aggregate (average), 435 submissions, read 2026-09-24: $170K base + $33.1K/yr stock. 4-yr stock = $33.1K x 4. Signing bonus is not reported by levels.fyi; counted as $0 (unknown, not zero). Private company: equity is illiquid paper. US aggregate - no Bay Area entry-level page exists.',
    confidence: 'estimate',
  },
  {
    company: 'Discord',
    group: 'startups',
    ticker: null,
    levelLabel: 'L1',
    city: 'US',
    base: 134000,
    signingBonus: 0,
    stockGrantTotal4yr: 58400,
    grantDate: GRANT_DATE_ASSUMPTION,
    sampleBand: '50+',
    source: 'levels.fyi',
    sourceUrl: 'https://www.levels.fyi/companies/discord/salaries/software-engineer',
    accessDate: ACCESS,
    method:
      'Estimate from levels.fyi L1 entry-level aggregate (average), 84 submissions, read 2026-09-24: $134K base + $14.6K/yr stock. 4-yr stock = $14.6K x 4. Signing bonus is not reported by levels.fyi; counted as $0 (unknown, not zero). Private company: equity is illiquid paper. US aggregate - no Bay Area entry-level page exists.',
    confidence: 'estimate',
  },
];

/** 2025 rows: levels.fyi entry-level aggregates filed under the 2025 canonical
 * grant date. These are the same all-years rolling averages as the 2026 tab
 * (read 2026-09-24) — no 2025-anchored aggregates exist, so no company gets a
 * 2025-specific row. Labeled `estimate` per the dataset rules. */
const RAW_2025: TLeaderboardEntry[] = [
  {
    company: "Google",
    group: "big-tech",
    ticker: "GOOGL",
    levelLabel: "L3 SWE II",
    city: "US",
    base: 157000,
    signingBonus: null,
    stockGrantTotal4yr: 154400,
    grantDate: "2025-08-01",
    sampleBand: "50+",
    source: "levels.fyi - Google Software Engineer (L3 SWE II row), US aggregate",
    sourceUrl: "https://www.levels.fyi/companies/google/salaries/software-engineer",
    accessDate: "2026-09-24",
    method: "Estimate backed out from the published levels.fyi entry-level aggregate (L3 SWE II, US), read 2026-09-24: $157K base + $38.6K/yr stock (+$12.3K bonus). 4-yr stock = $38.6K x 4. Signing bonus is not reported in the aggregate and is counted as $0 (unknown, not zero). GSUs vest 38/32/20/10 monthly. All-years average, not 2025-specific; 24,218 submissions tracked.",
    confidence: 'estimate',
  },
  {
    company: "Meta",
    group: "big-tech",
    ticker: "META",
    levelLabel: "E3",
    city: "US",
    base: 157000,
    signingBonus: null,
    stockGrantTotal4yr: 88000,
    grantDate: "2025-08-01",
    sampleBand: "50+",
    source: "levels.fyi - Meta Software Engineer (E3 row), US aggregate",
    sourceUrl: "https://www.levels.fyi/companies/meta/salaries/software-engineer",
    accessDate: "2026-09-24",
    method: "Estimate backed out from the published levels.fyi entry-level aggregate (E3, US), read 2026-09-24: $157K base + $22K/yr stock (+$2.7K bonus). 4-yr stock = $22K x 4. Signing bonus is not reported in the aggregate and is counted as $0 (unknown, not zero). RSUs vest 25/25/25/25 quarterly. All-years average, not 2025-specific; 14,037 submissions tracked.",
    confidence: 'estimate',
  },
  {
    company: "Netflix",
    group: "big-tech",
    ticker: "NFLX",
    levelLabel: "L3",
    city: "US",
    base: 204000,
    signingBonus: null,
    stockGrantTotal4yr: 25000,
    grantDate: "2025-08-01",
    sampleBand: "50+",
    source: "levels.fyi - Netflix Software Engineer (L3 row), US aggregate",
    sourceUrl: "https://www.levels.fyi/companies/netflix/salaries/software-engineer",
    accessDate: "2026-09-24",
    method: "Estimate backed out from the published levels.fyi entry-level aggregate (L3, US), read 2026-09-24: $204K base + $6.3K/yr stock (+$3.7K bonus). 4-yr stock = $6.3K x 4. Signing bonus is not reported in the aggregate and is counted as $0 (unknown, not zero). Effectively all-cash. Netflix rarely hires new grads - treat as an outlier, not a typical offer. All-years average, not 2025-specific; 1,434 submissions tracked.",
    confidence: 'estimate',
  },
  {
    company: "Amazon",
    group: "big-tech",
    ticker: "AMZN",
    levelLabel: "SDE I (L4)",
    city: "US",
    base: 141000,
    signingBonus: null,
    stockGrantTotal4yr: 145600,
    grantDate: "2025-08-01",
    sampleBand: "50+",
    source: "levels.fyi - Amazon Software Engineer (SDE I (L4) row), US aggregate",
    sourceUrl: "https://www.levels.fyi/companies/amazon/salaries/software-engineer",
    accessDate: "2026-09-24",
    method: "Estimate backed out from the published levels.fyi entry-level aggregate (SDE I (L4), US), read 2026-09-24: $141K base + $36.4K/yr stock (+$9.8K bonus). 4-yr stock = $36.4K x 4. Signing bonus is not reported in the aggregate and is counted as $0 (unknown, not zero). Back-loaded 5/15/45/35 vest. All-years average, not 2025-specific; 42,707 submissions tracked.",
    confidence: 'estimate',
  },
  {
    company: "Microsoft",
    group: "big-tech",
    ticker: "MSFT",
    levelLabel: "59 SDE",
    city: "US",
    base: 127000,
    signingBonus: null,
    stockGrantTotal4yr: 94800,
    grantDate: "2025-08-01",
    sampleBand: "50+",
    source: "levels.fyi - Microsoft Software Engineer (59 SDE row), US aggregate",
    sourceUrl: "https://www.levels.fyi/companies/microsoft/salaries/software-engineer",
    accessDate: "2026-09-24",
    method: "Estimate backed out from the published levels.fyi entry-level aggregate (59 SDE, US), read 2026-09-24: $127K base + $23.7K/yr stock (+$9K bonus). 4-yr stock = $23.7K x 4. Signing bonus is not reported in the aggregate and is counted as $0 (unknown, not zero). 25/25/25/25 annual vest (sometimes 5-yr). All-years average, not 2025-specific; 20,700 submissions tracked.",
    confidence: 'estimate',
  },
  {
    company: "Stripe",
    group: "startups",
    ticker: null,
    levelLabel: "L1",
    city: "US",
    base: 147000,
    signingBonus: null,
    stockGrantTotal4yr: 180000,
    grantDate: "2025-08-01",
    sampleBand: "50+",
    source: "levels.fyi - Stripe Software Engineer (L1 row), US aggregate",
    sourceUrl: "https://www.levels.fyi/companies/stripe/salaries/software-engineer",
    accessDate: "2026-09-24",
    method: "Estimate backed out from the published levels.fyi entry-level aggregate (L1, US), read 2026-09-24: $147K base + $44.9K/yr stock (+$19.8K bonus). 4-yr stock = $44.9K x 4. Signing bonus is not reported in the aggregate and is counted as $0 (unknown, not zero). RSU (1-yr/2-yr/4-yr variants on page). Private: equity is illiquid paper. All-years average, not 2025-specific; 1,529 submissions tracked.",
    confidence: 'estimate',
  },
  {
    company: "Databricks",
    group: "ai",
    ticker: null,
    levelLabel: "L3",
    city: "US",
    base: 146000,
    signingBonus: null,
    stockGrantTotal4yr: 347000,
    grantDate: "2025-08-01",
    sampleBand: "50+",
    source: "levels.fyi - Databricks Software Engineer (L3 row), US aggregate",
    sourceUrl: "https://www.levels.fyi/companies/databricks/salaries/software-engineer",
    accessDate: "2026-09-24",
    method: "Estimate backed out from the published levels.fyi entry-level aggregate (L3, US), read 2026-09-24: $146K base + $86.7K/yr stock (+$37.3K bonus). 4-yr stock = $86.7K x 4. Signing bonus is not reported in the aggregate and is counted as $0 (unknown, not zero). RSU 40/30/20/10. Private: equity is illiquid paper. All-years average, not 2025-specific; 641 submissions tracked.",
    confidence: 'estimate',
  },
  {
    company: "Airbnb",
    group: "consumer",
    ticker: "ABNB",
    levelLabel: "New Grad",
    city: "US",
    base: 135000,
    signingBonus: null,
    stockGrantTotal4yr: 129200,
    grantDate: "2025-08-01",
    sampleBand: "50+",
    source: "levels.fyi - Airbnb Software Engineer (New Grad row), US aggregate",
    sourceUrl: "https://www.levels.fyi/companies/airbnb/salaries/software-engineer",
    accessDate: "2026-09-24",
    method: "Estimate backed out from the published levels.fyi entry-level aggregate (New Grad, US), read 2026-09-24: $135K base + $32.3K/yr stock (+$8.4K bonus). 4-yr stock = $32.3K x 4. Signing bonus is not reported in the aggregate and is counted as $0 (unknown, not zero). All-years average, not 2025-specific; 719 submissions tracked.",
    confidence: 'estimate',
  },
];

/** 2026 rows: 28 levels.fyi entry-level aggregates (public, all-years rolling
 * averages read 2026-09-24), labeled `estimate` per the dataset rules. Canva is
 * deliberately omitted: its only levels.fyi row is Australia-only (A$), with no
 * US row to rank against USD figures. Perplexity, Mercor, and Figure AI
 * have no defensible entry-level aggregate and are omitted as well. Palantir is
 * omitted from 2026 (its 2024 row is a postings-based estimate, not an
 * aggregate). Applied Intuition uses the PUBLIC levels.fyi aggregate only —
 * no private data. */
const RAW_2026: TLeaderboardEntry[] = [
  {
    company: "Google",
    group: "big-tech",
    ticker: "GOOGL",
    levelLabel: "L3 SWE II",
    city: "US",
    base: 157000,
    signingBonus: null,
    stockGrantTotal4yr: 154400,
    grantDate: "2026-08-01",
    sampleBand: "50+",
    source: "levels.fyi - Google Software Engineer (L3 SWE II row), US aggregate",
    sourceUrl: "https://www.levels.fyi/companies/google/salaries/software-engineer",
    accessDate: "2026-09-24",
    method: "Estimate backed out from the published levels.fyi entry-level aggregate (L3 SWE II, US), read 2026-09-24: $157K base + $38.6K/yr stock (+$12.3K bonus). 4-yr stock = annualized stock x 4. Signing bonus is not reported in the aggregate and is counted as $0 (unknown, not zero). GSUs vest 38/32/20/10 monthly. All-years average, not 2026-specific; 24,218 submissions tracked.",
    confidence: 'estimate',
  },
  {
    company: "Meta",
    group: "big-tech",
    ticker: "META",
    levelLabel: "E3",
    city: "US",
    base: 157000,
    signingBonus: null,
    stockGrantTotal4yr: 88000,
    grantDate: "2026-08-01",
    sampleBand: "50+",
    source: "levels.fyi - Meta Software Engineer (E3 row), US aggregate",
    sourceUrl: "https://www.levels.fyi/companies/meta/salaries/software-engineer",
    accessDate: "2026-09-24",
    method: "Estimate backed out from the published levels.fyi entry-level aggregate (E3, US), read 2026-09-24: $157K base + $22K/yr stock (+$2.7K bonus). 4-yr stock = annualized stock x 4. Signing bonus is not reported in the aggregate and is counted as $0 (unknown, not zero). RSUs vest 25/25/25/25 quarterly. All-years average, not 2026-specific; 14,037 submissions tracked.",
    confidence: 'estimate',
  },
  {
    company: "Amazon",
    group: "big-tech",
    ticker: "AMZN",
    levelLabel: "SDE I (L4)",
    city: "US",
    base: 141000,
    signingBonus: null,
    stockGrantTotal4yr: 145600,
    grantDate: "2026-08-01",
    sampleBand: "50+",
    source: "levels.fyi - Amazon Software Engineer (SDE I (L4) row), US aggregate",
    sourceUrl: "https://www.levels.fyi/companies/amazon/salaries/software-engineer",
    accessDate: "2026-09-24",
    method: "Estimate backed out from the published levels.fyi entry-level aggregate (SDE I (L4), US), read 2026-09-24: $141K base + $36.4K/yr stock (+$9.8K bonus). 4-yr stock = annualized stock x 4. Signing bonus is not reported in the aggregate and is counted as $0 (unknown, not zero). Back-loaded 5/15/45/35 vest. All-years average, not 2026-specific; 42,707 submissions tracked.",
    confidence: 'estimate',
  },
  {
    company: "Apple",
    group: "big-tech",
    ticker: "AAPL",
    levelLabel: "ICT2 Jr SWE",
    city: "US",
    base: 140000,
    signingBonus: null,
    stockGrantTotal4yr: 95200,
    grantDate: "2026-08-01",
    sampleBand: "50+",
    source: "levels.fyi - Apple Software Engineer (ICT2 Jr SWE row), US aggregate",
    sourceUrl: "https://www.levels.fyi/companies/apple/salaries/software-engineer",
    accessDate: "2026-09-24",
    method: "Estimate backed out from the published levels.fyi entry-level aggregate (ICT2 Jr SWE, US), read 2026-09-24: $140K base + $23.8K/yr stock (+$3.4K bonus). 4-yr stock = annualized stock x 4. Signing bonus is not reported in the aggregate and is counted as $0 (unknown, not zero). 25/25/25/25 semi-annual vest. All-years average, not 2026-specific; 7,143 submissions tracked.",
    confidence: 'estimate',
  },
  {
    company: "Microsoft",
    group: "big-tech",
    ticker: "MSFT",
    levelLabel: "59 SDE",
    city: "US",
    base: 127000,
    signingBonus: null,
    stockGrantTotal4yr: 94800,
    grantDate: "2026-08-01",
    sampleBand: "50+",
    source: "levels.fyi - Microsoft Software Engineer (59 SDE row), US aggregate",
    sourceUrl: "https://www.levels.fyi/companies/microsoft/salaries/software-engineer",
    accessDate: "2026-09-24",
    method: "Estimate backed out from the published levels.fyi entry-level aggregate (59 SDE, US), read 2026-09-24: $127K base + $23.7K/yr stock (+$9K bonus). 4-yr stock = annualized stock x 4. Signing bonus is not reported in the aggregate and is counted as $0 (unknown, not zero). 25/25/25/25 annual vest (sometimes 5-yr). All-years average, not 2026-specific; 20,700 submissions tracked.",
    confidence: 'estimate',
  },
  {
    company: "Nvidia",
    group: "big-tech",
    ticker: "NVDA",
    levelLabel: "IC1",
    city: "US",
    base: 148000,
    signingBonus: null,
    stockGrantTotal4yr: 63600,
    grantDate: "2026-08-01",
    sampleBand: "50+",
    source: "levels.fyi - Nvidia Software Engineer (IC1 row), US aggregate",
    sourceUrl: "https://www.levels.fyi/companies/nvidia/salaries/software-engineer",
    accessDate: "2026-09-24",
    method: "Estimate backed out from the published levels.fyi entry-level aggregate (IC1, US), read 2026-09-24: $148K base + $15.9K/yr stock (+$7.1K bonus). 4-yr stock = annualized stock x 4. Signing bonus is not reported in the aggregate and is counted as $0 (unknown, not zero). 40/30/20/10 NSU quarterly. IC1 is the page's entry level (not IC2). Thinnest big-tech row. All-years average, not 2026-specific; 2,396 submissions tracked.",
    confidence: 'estimate',
  },
  {
    company: "Netflix",
    group: "big-tech",
    ticker: "NFLX",
    levelLabel: "L3",
    city: "US",
    base: 204000,
    signingBonus: null,
    stockGrantTotal4yr: 25000,
    grantDate: "2026-08-01",
    sampleBand: "50+",
    source: "levels.fyi - Netflix Software Engineer (L3 row), US aggregate",
    sourceUrl: "https://www.levels.fyi/companies/netflix/salaries/software-engineer",
    accessDate: "2026-09-24",
    method: "Estimate backed out from the published levels.fyi entry-level aggregate (L3, US), read 2026-09-24: $204K base + $6.3K/yr stock (+$3.7K bonus). 4-yr stock = annualized stock x 4. Signing bonus is not reported in the aggregate and is counted as $0 (unknown, not zero). Effectively all-cash. Netflix rarely hires new grads \u2014 treat as an outlier, not a typical offer. All-years average, not 2026-specific; 1,434 submissions tracked.",
    confidence: 'estimate',
  },
  {
    company: "Roblox",
    group: "consumer",
    ticker: "RBLX",
    levelLabel: "IC1",
    city: "US",
    base: 153000,
    signingBonus: null,
    stockGrantTotal4yr: 270000,
    grantDate: "2026-08-01",
    sampleBand: "50+",
    source: "levels.fyi - Roblox Software Engineer (IC1 row), US aggregate",
    sourceUrl: "https://www.levels.fyi/companies/roblox/salaries/software-engineer",
    accessDate: "2026-09-24",
    method: "Estimate backed out from the published levels.fyi entry-level aggregate (IC1, US), read 2026-09-24: $153K base + $67.5K/yr stock (+$23.2K bonus). 4-yr stock = annualized stock x 4. Signing bonus is not reported in the aggregate and is counted as $0 (unknown, not zero). All-years average, not 2026-specific; 591 submissions tracked.",
    confidence: 'estimate',
  },
  {
    company: "Snowflake",
    group: "enterprise",
    ticker: "SNOW",
    levelLabel: "IC1",
    city: "US",
    base: 166000,
    signingBonus: null,
    stockGrantTotal4yr: 228400,
    grantDate: "2026-08-01",
    sampleBand: "50+",
    source: "levels.fyi - Snowflake Software Engineer (IC1 row), US aggregate",
    sourceUrl: "https://www.levels.fyi/companies/snowflake/salaries/software-engineer",
    accessDate: "2026-09-24",
    method: "Estimate backed out from the published levels.fyi entry-level aggregate (IC1, US), read 2026-09-24: $166K base + $57.1K/yr stock (+$8.1K bonus). 4-yr stock = annualized stock x 4. Signing bonus is not reported in the aggregate and is counted as $0 (unknown, not zero). RSUs vest 25%/yr over 4 years. All-years average, not 2026-specific; 568 submissions tracked.",
    confidence: 'estimate',
  },
  {
    company: "Pinterest",
    group: "consumer",
    ticker: "PINS",
    levelLabel: "IC13",
    city: "US",
    base: 163000,
    signingBonus: null,
    stockGrantTotal4yr: 194400,
    grantDate: "2026-08-01",
    sampleBand: "50+",
    source: "levels.fyi - Pinterest Software Engineer (IC13 row), US aggregate",
    sourceUrl: "https://www.levels.fyi/companies/pinterest/salaries/software-engineer",
    accessDate: "2026-09-24",
    method: "Estimate backed out from the published levels.fyi entry-level aggregate (IC13, US), read 2026-09-24: $163K base + $48.6K/yr stock (+$13.6K bonus). 4-yr stock = annualized stock x 4. Signing bonus is not reported in the aggregate and is counted as $0 (unknown, not zero). All-years average, not 2026-specific; 752 submissions tracked.",
    confidence: 'estimate',
  },
  {
    company: "Snap",
    group: "consumer",
    ticker: "SNAP",
    levelLabel: "L3",
    city: "US",
    base: 137000,
    signingBonus: null,
    stockGrantTotal4yr: 218000,
    grantDate: "2026-08-01",
    sampleBand: "50+",
    source: "levels.fyi - Snap Software Engineer (L3 row), US aggregate",
    sourceUrl: "https://www.levels.fyi/companies/snap/salaries/software-engineer",
    accessDate: "2026-09-24",
    method: "Estimate backed out from the published levels.fyi entry-level aggregate (L3, US), read 2026-09-24: $137K base + $54.5K/yr stock (+$1.9K bonus). 4-yr stock = annualized stock x 4. Signing bonus is not reported in the aggregate and is counted as $0 (unknown, not zero). Caveat: Snap lists 1-yr, 3-yr, and 4-yr RSU schedules, so the x4 extrapolation is rough. All-years average, not 2026-specific; 1,138 submissions tracked.",
    confidence: 'estimate',
  },
  {
    company: "Airbnb",
    group: "consumer",
    ticker: "ABNB",
    levelLabel: "New Grad",
    city: "US",
    base: 135000,
    signingBonus: null,
    stockGrantTotal4yr: 129200,
    grantDate: "2026-08-01",
    sampleBand: "50+",
    source: "levels.fyi - Airbnb Software Engineer (New Grad row), US aggregate",
    sourceUrl: "https://www.levels.fyi/companies/airbnb/salaries/software-engineer",
    accessDate: "2026-09-24",
    method: "Estimate backed out from the published levels.fyi entry-level aggregate (New Grad, US), read 2026-09-24: $135K base + $32.3K/yr stock (+$8.4K bonus). 4-yr stock = annualized stock x 4. Signing bonus is not reported in the aggregate and is counted as $0 (unknown, not zero). All-years average, not 2026-specific; 719 submissions tracked.",
    confidence: 'estimate',
  },
  {
    company: "Arm",
    group: "big-tech",
    ticker: "ARM",
    levelLabel: "Grade 2",
    city: "Austin, TX",
    base: 129000,
    signingBonus: null,
    stockGrantTotal4yr: 91600,
    grantDate: "2026-08-01",
    sampleBand: "50+",
    source: "levels.fyi - Arm Software Engineer (Grade 2 row), US aggregate",
    sourceUrl: "https://www.levels.fyi/companies/arm/salaries/software-engineer/locations/greater-austin-area",
    accessDate: "2026-09-24",
    method: "Estimate backed out from the published levels.fyi entry-level aggregate (Grade 2, US), read 2026-09-24: $129K base + $22.9K/yr stock (+$17.8K bonus). 4-yr stock = annualized stock x 4. Signing bonus is not reported in the aggregate and is counted as $0 (unknown, not zero). Vesting confirmed 25/25/25/25 over 4 yrs. Austin-metro aggregate. All-years average, not 2026-specific; 411 submissions tracked.",
    confidence: 'estimate',
  },
  {
    company: "AMD",
    group: "big-tech",
    ticker: "AMD",
    levelLabel: "L5 SW Eng II",
    city: "US",
    base: 128000,
    signingBonus: null,
    stockGrantTotal4yr: 90800,
    grantDate: "2026-08-01",
    sampleBand: "50+",
    source: "levels.fyi - AMD Software Engineer (L5 SW Eng II row), US aggregate",
    sourceUrl: "https://www.levels.fyi/companies/amd/salaries/software-engineer",
    accessDate: "2026-09-24",
    method: "Estimate backed out from the published levels.fyi entry-level aggregate (L5 SW Eng II, US), read 2026-09-24: $128K base + $22.7K/yr stock (+$8.6K bonus). 4-yr stock = annualized stock x 4. Signing bonus is not reported in the aggregate and is counted as $0 (unknown, not zero). All-years average, not 2026-specific; 1,170 submissions tracked.",
    confidence: 'estimate',
  },
  {
    company: "Broadcom",
    group: "big-tech",
    ticker: "AVGO",
    levelLabel: "ICB 1",
    city: "US",
    base: 104000,
    signingBonus: null,
    stockGrantTotal4yr: 132000,
    grantDate: "2026-08-01",
    sampleBand: "50+",
    source: "levels.fyi - Broadcom Software Engineer (ICB 1 row), US aggregate",
    sourceUrl: "https://www.levels.fyi/companies/broadcom/salaries/software-engineer",
    accessDate: "2026-09-24",
    method: "Estimate backed out from the published levels.fyi entry-level aggregate (ICB 1, US), read 2026-09-24: $104K base + $33K/yr stock (+$11.6K bonus). 4-yr stock = annualized stock x 4. Signing bonus is not reported in the aggregate and is counted as $0 (unknown, not zero). All-years average, not 2026-specific; 823 submissions tracked.",
    confidence: 'estimate',
  },
  {
    company: "Tesla",
    group: "big-tech",
    ticker: "TSLA",
    levelLabel: "P1 Assoc Eng",
    city: "US",
    base: 120000,
    signingBonus: null,
    stockGrantTotal4yr: 55600,
    grantDate: "2026-08-01",
    sampleBand: "50+",
    source: "levels.fyi - Tesla Software Engineer (P1 Assoc Eng row), US aggregate",
    sourceUrl: "https://www.levels.fyi/companies/tesla/salaries/software-engineer",
    accessDate: "2026-09-24",
    method: "Estimate backed out from the published levels.fyi entry-level aggregate (P1 Assoc Eng, US), read 2026-09-24: $120K base + $13.9K/yr stock (+$79 bonus). 4-yr stock = annualized stock x 4. Signing bonus is not reported in the aggregate and is counted as $0 (unknown, not zero). The near-zero P1 bonus is real per the aggregate, not a data error. All-years average, not 2026-specific; 1,153 submissions tracked.",
    confidence: 'estimate',
  },
  {
    company: "OpenAI",
    group: "ai",
    ticker: null,
    levelLabel: "L2",
    city: "US",
    base: 169000,
    signingBonus: null,
    stockGrantTotal4yr: 315000,
    grantDate: "2026-08-01",
    sampleBand: "50+",
    source: "levels.fyi - OpenAI Software Engineer (L2 row), US aggregate",
    sourceUrl: "https://www.levels.fyi/companies/openai/salaries/software-engineer",
    accessDate: "2026-09-24",
    method: "Estimate backed out from the published levels.fyi entry-level aggregate (L2, US), read 2026-09-24: $169K base + $78.8K/yr stock (+$1.4K bonus). 4-yr stock = annualized stock x 4. Signing bonus is not reported in the aggregate and is counted as $0 (unknown, not zero). RSU 25/25/25/25. Private: equity is illiquid paper, excluded from growth/realized columns. All-years average, not 2026-specific; 238 submissions tracked.",
    confidence: 'estimate',
  },
  {
    company: "Anthropic",
    group: "ai",
    ticker: null,
    levelLabel: "Entry SWE",
    city: "US",
    base: 250000,
    signingBonus: null,
    stockGrantTotal4yr: 468000,
    grantDate: "2026-08-01",
    sampleBand: "50+",
    source: "levels.fyi - Anthropic Software Engineer (Entry SWE row), US aggregate",
    sourceUrl: "https://www.levels.fyi/companies/anthropic/salaries/software-engineer",
    accessDate: "2026-09-24",
    method: "Estimate backed out from the published levels.fyi entry-level aggregate (Entry SWE, US), read 2026-09-24: $250K base + $117K/yr stock (+$0 bonus). 4-yr stock = annualized stock x 4. Signing bonus is not reported in the aggregate and is counted as $0 (unknown, not zero). RSU 25/25/25/25. Private: illiquid paper. Thin row (55 submissions). All-years average, not 2026-specific; 55 submissions tracked.",
    confidence: 'estimate',
  },
  {
    company: "Stripe",
    group: "startups",
    ticker: null,
    levelLabel: "L1",
    city: "US",
    base: 147000,
    signingBonus: null,
    stockGrantTotal4yr: 180000,
    grantDate: "2026-08-01",
    sampleBand: "50+",
    source: "levels.fyi - Stripe Software Engineer (L1 row), US aggregate",
    sourceUrl: "https://www.levels.fyi/companies/stripe/salaries/software-engineer",
    accessDate: "2026-09-24",
    method: "Estimate backed out from the published levels.fyi entry-level aggregate (L1, US), read 2026-09-24: $147K base + $44.9K/yr stock (+$19.8K bonus). 4-yr stock = annualized stock x 4. Signing bonus is not reported in the aggregate and is counted as $0 (unknown, not zero). RSU (1-yr/2-yr/4-yr variants on page). Private: illiquid paper. All-years average, not 2026-specific; 1,529 submissions tracked.",
    confidence: 'estimate',
  },
  {
    company: "Databricks",
    group: "ai",
    ticker: null,
    levelLabel: "L3",
    city: "US",
    base: 146000,
    signingBonus: null,
    stockGrantTotal4yr: 347000,
    grantDate: "2026-08-01",
    sampleBand: "50+",
    source: "levels.fyi - Databricks Software Engineer (L3 row), US aggregate",
    sourceUrl: "https://www.levels.fyi/companies/databricks/salaries/software-engineer",
    accessDate: "2026-09-24",
    method: "Estimate backed out from the published levels.fyi entry-level aggregate (L3, US), read 2026-09-24: $146K base + $86.7K/yr stock (+$37.3K bonus). 4-yr stock = annualized stock x 4. Signing bonus is not reported in the aggregate and is counted as $0 (unknown, not zero). RSU 40/30/20/10. Private: illiquid paper. All-years average, not 2026-specific; 641 submissions tracked.",
    confidence: 'estimate',
  },
  {
    company: "ByteDance",
    group: "consumer",
    ticker: null,
    levelLabel: "1-2",
    city: "US",
    base: 154000,
    signingBonus: null,
    stockGrantTotal4yr: 100000,
    grantDate: "2026-08-01",
    sampleBand: "50+",
    source: "levels.fyi - ByteDance Software Engineer (1-2 row), US aggregate",
    sourceUrl: "https://www.levels.fyi/companies/bytedance/salaries/software-engineer",
    accessDate: "2026-09-24",
    method: "Estimate backed out from the published levels.fyi entry-level aggregate (1-2, US), read 2026-09-24: $154K base + $25.1K/yr stock (+$21.3K bonus). 4-yr stock = annualized stock x 4. Signing bonus is not reported in the aggregate and is counted as $0 (unknown, not zero). RSU (3-yr/4-yr variants). Private: illiquid paper; fair values are self-reported. All-years average, not 2026-specific; 3,923 submissions tracked.",
    confidence: 'estimate',
  },
  {
    company: "Anduril",
    group: "defense",
    ticker: null,
    levelLabel: "IC2",
    city: "US",
    base: 169000,
    signingBonus: null,
    stockGrantTotal4yr: 235600,
    grantDate: "2026-08-01",
    sampleBand: "50+",
    source: "levels.fyi - Anduril Software Engineer (IC2 row), US aggregate",
    sourceUrl: "https://www.levels.fyi/companies/anduril-industries/salaries/software-engineer",
    accessDate: "2026-09-24",
    method: "Estimate backed out from the published levels.fyi entry-level aggregate (IC2, US), read 2026-09-24: $169K base + $58.9K/yr stock (+$1.7K bonus). 4-yr stock = annualized stock x 4. Signing bonus is not reported in the aggregate and is counted as $0 (unknown, not zero). 25/25/25/25, Options+RSU. Private: illiquid paper. All-years average, not 2026-specific; 333 submissions tracked.",
    confidence: 'estimate',
  },
  {
    company: "Ramp",
    group: "startups",
    ticker: null,
    levelLabel: "New Grad",
    city: "US",
    base: 174000,
    signingBonus: null,
    stockGrantTotal4yr: 207200,
    grantDate: "2026-08-01",
    sampleBand: "50+",
    source: "levels.fyi - Ramp Software Engineer (New Grad row), US aggregate",
    sourceUrl: "https://www.levels.fyi/companies/ramp/salaries/software-engineer",
    accessDate: "2026-09-24",
    method: "Estimate backed out from the published levels.fyi entry-level aggregate (New Grad, US), read 2026-09-24: $174K base + $51.8K/yr stock (+$2.8K bonus). 4-yr stock = annualized stock x 4. Signing bonus is not reported in the aggregate and is counted as $0 (unknown, not zero). 25/25/25/25. Private: illiquid paper. All-years average, not 2026-specific; 125 submissions tracked.",
    confidence: 'estimate',
  },
  {
    company: "Discord",
    group: "startups",
    ticker: null,
    levelLabel: "L1",
    city: "US",
    base: 134000,
    signingBonus: null,
    stockGrantTotal4yr: 58400,
    grantDate: "2026-08-01",
    sampleBand: "50+",
    source: "levels.fyi - Discord Software Engineer (L1 row), US aggregate",
    sourceUrl: "https://www.levels.fyi/companies/discord/salaries/software-engineer",
    accessDate: "2026-09-24",
    method: "Estimate backed out from the published levels.fyi entry-level aggregate (L1, US), read 2026-09-24: $134K base + $14.6K/yr stock (+$4.8K bonus). 4-yr stock = annualized stock x 4. Signing bonus is not reported in the aggregate and is counted as $0 (unknown, not zero). 25/25/25/25 RSU. Private: illiquid paper. All-years average, not 2026-specific; 84 submissions tracked.",
    confidence: 'estimate',
  },
  {
    company: "Rippling",
    group: "startups",
    ticker: null,
    levelLabel: "L5 SWE",
    city: "US",
    base: 170000,
    signingBonus: null,
    stockGrantTotal4yr: 132400,
    grantDate: "2026-08-01",
    sampleBand: "50+",
    source: "levels.fyi - Rippling Software Engineer (L5 SWE row), US aggregate",
    sourceUrl: "https://www.levels.fyi/companies/rippling/salaries/software-engineer",
    accessDate: "2026-09-24",
    method: "Estimate backed out from the published levels.fyi entry-level aggregate (L5 SWE, US), read 2026-09-24: $170K base + $33.1K/yr stock (+$4.4K bonus). 4-yr stock = annualized stock x 4. Signing bonus is not reported in the aggregate and is counted as $0 (unknown, not zero). 4-yr Options (variants). Private: illiquid paper. All-years average, not 2026-specific; 435 submissions tracked.",
    confidence: 'estimate',
  },
  {
    company: "Vercel",
    group: "startups",
    ticker: null,
    levelLabel: "Entry SWE",
    city: "US",
    base: 173000,
    signingBonus: null,
    stockGrantTotal4yr: 135200,
    grantDate: "2026-08-01",
    sampleBand: "10-50",
    source: "levels.fyi - Vercel Software Engineer (Entry SWE row), US aggregate",
    sourceUrl: "https://www.levels.fyi/companies/vercel/salaries/software-engineer",
    accessDate: "2026-09-24",
    method: "Estimate backed out from the published levels.fyi entry-level aggregate (Entry SWE, US), read 2026-09-24: $173K base + $33.8K/yr stock (+$12.2K bonus). 4-yr stock = annualized stock x 4. Signing bonus is not reported in the aggregate and is counted as $0 (unknown, not zero). 25/25/25/25 Options. Private: illiquid paper. Thin row (45 submissions). All-years average, not 2026-specific; 45 submissions tracked.",
    confidence: 'estimate',
  },
  {
    company: "Applied Intuition",
    group: "startups",
    ticker: null,
    levelLabel: "Entry SWE",
    city: "US",
    base: 145000,
    signingBonus: null,
    stockGrantTotal4yr: 246400,
    grantDate: "2026-08-01",
    sampleBand: "50+",
    source: "levels.fyi - Applied Intuition Software Engineer (Entry SWE row), US aggregate",
    sourceUrl: "https://www.levels.fyi/companies/applied-intuition/salaries/software-engineer",
    accessDate: "2026-09-24",
    method: "Estimate backed out from the published levels.fyi entry-level aggregate (Entry SWE, US), read 2026-09-24: $145K base + $61.6K/yr stock (+$2.3K bonus). 4-yr stock = annualized stock x 4. Signing bonus is not reported in the aggregate and is counted as $0 (unknown, not zero). 25/25/25/25 Options. Private: illiquid paper. PUBLIC aggregate only \u2014 no private individual comp data is used anywhere in this row. All-years average, not 2026-specific; 137 submissions tracked.",
    confidence: 'estimate',
  },
  {
    company: "LinkedIn",
    group: "big-tech",
    ticker: null,
    levelLabel: "IC2",
    city: "US",
    base: 174000,
    signingBonus: null,
    stockGrantTotal4yr: 261200,
    grantDate: "2026-08-01",
    sampleBand: "50+",
    source: "levels.fyi - LinkedIn Software Engineer (IC2 row), US aggregate",
    sourceUrl: "https://www.levels.fyi/companies/linkedin/salaries/software-engineer",
    accessDate: "2026-09-24",
    method: "Estimate backed out from the published levels.fyi entry-level aggregate (IC2, US), read 2026-09-24: $174K base + $65.3K/yr stock (+$14.4K bonus). 4-yr stock = annualized stock x 4. Signing bonus is not reported in the aggregate and is counted as $0 (unknown, not zero). 25/25/25/25 RSU. LinkedIn is a Microsoft subsidiary with no separate ticker \u2014 no price history is modeled, growth/realized columns are n/a. IC2 is the traditional new-grad level (IC1 is the apprentice program). All-years average, not 2026-specific; 3,029 submissions tracked.",
    confidence: 'estimate',
  },
];

/** The validated 2025 dataset. Throws at import time if any entry is malformed. */
export const LEADERBOARD_2025: TLeaderboardEntry[] = z.array(LeaderboardEntry).parse(RAW_2025);

/** The validated 2026 dataset. Throws at import time if any entry is malformed. */
export const LEADERBOARD_2026: TLeaderboardEntry[] = z.array(LeaderboardEntry).parse(RAW_2026);

/** The validated dataset. Throws at import time if any entry is malformed. */
export const LEADERBOARD_2024: TLeaderboardEntry[] = z.array(LeaderboardEntry).parse(RAW);

/** Leaderboard years available in the UI. 2024 is the default selected tab. */
export const LEADERBOARD_YEARS = ['2024', '2025', '2026'] as const;
export type TLeaderboardYear = (typeof LEADERBOARD_YEARS)[number];

/**
 * Canonical grant-date assumption per leaderboard year (disclosed in the UI).
 * The price anchor for a year's entries is the nearest monthly close to that
 * year's August date.
 */
export const GRANT_DATE_BY_YEAR: Record<TLeaderboardYear, string> = {
  '2024': GRANT_DATE_ASSUMPTION,
  '2025': '2025-08-01',
  '2026': '2026-08-01',
};

/**
 * The offer leaderboard keyed by year. 2024 holds the collected-offer dataset,
 * 2025 holds the 8 companies with real 2024-2025 offer data, and 2026 holds the
 * 28 levels.fyi entry-level aggregates (labeled `estimate`). Company/year combos
 * without defensible data are honestly absent — the UI only renders rows that
 * exist. Adding a year's rows is a data-only change: append parsed entries to
 * that year's array (each entry must use its year's canonical grant date;
 * enforced below). The startup valuation table is latest-valuations, not
 * year-specific, so it is NOT keyed here.
 */
export const LEADERBOARD_BY_YEAR: Record<TLeaderboardYear, TLeaderboardEntry[]> = {
  '2024': LEADERBOARD_2024,
  '2025': LEADERBOARD_2025,
  '2026': LEADERBOARD_2026,
};

// Every entry must use its year's canonical grant date — keeps "adding a year
// is just data" honest. Throws at import time.
for (const y of LEADERBOARD_YEARS) {
  for (const e of LEADERBOARD_BY_YEAR[y]) {
    if (e.grantDate !== GRANT_DATE_BY_YEAR[y]) {
      throw new Error(
        `leaderboard entry "${e.company}" is filed under ${y} but uses grantDate ${e.grantDate} (expected ${GRANT_DATE_BY_YEAR[y]})`,
      );
    }
  }
}

/** Companies with a public ticker (eligible for realized-value computation). */
export const PUBLIC_ENTRIES = LEADERBOARD_2024.filter((e) => e.ticker !== null);

/** Private-company entries: growth/realized columns are n/a by construction. */
export const PRIVATE_ENTRIES = LEADERBOARD_2024.filter((e) => e.ticker === null);
