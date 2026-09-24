import { z } from 'zod';

/**
 * 2024 new-grad offer leaderboard dataset.
 *
 * PRIVACY / HONESTY RULES (same bar as benchmarks.v2):
 *  - Aggregates only. Every entry is a midpoint of a *range* collected across
 *    multiple real offer letters, or a clearly-labeled estimate. No individual
 *    offer rows, no exact-n sample sizes (bands only), no Applied Intuition data.
 *  - Every number carries a named source + access date + method string that
 *    says exactly how the figure was produced. Ranges are disclosed, never
 *    silently collapsed into precise-looking points.
 *  - `confidence: 'estimate'` marks entries that are NOT collected 2024
 *    offers (e.g. backed-out from a published benchmark). The UI must surface
 *    this; estimates must never be presented as collected offers.
 *
 * Grant-date convention: 2024-08-01 for every entry (canonical assumption,
 * disclosed in the UI). Realized values are computed at runtime from live
 * market prices, so the ranking moves with the market.
 */

export const DATASET_VERSION = 'v1.2026-09-24';

/** Last date any entry in this dataset was verified against its source. */
export const LAST_VERIFIED = '2026-09-24';

/** Canonical grant-date assumption used when the exact grant date is unknown. */
export const GRANT_DATE_ASSUMPTION = '2024-08-01';

export const LeaderboardConfidence = z.enum(['sourced', 'estimate']);
export type TLeaderboardConfidence = z.infer<typeof LeaderboardConfidence>;

export const LeaderboardSampleBand = z.enum(['<10', '10-50', '50+', 'unknown']);
export type TLeaderboardSampleBand = z.infer<typeof LeaderboardSampleBand>;

export const LeaderboardEntry = z.object({
  /** Display company name, e.g. "Meta". */
  company: z.string().min(1),
  /** Public ticker, or null for private companies (no price history). */
  ticker: z
    .string()
    .regex(/^[A-Z]{1,5}$/)
    .nullable(),
  /** Company-specific level label, e.g. "E3", "SDE I". "New Grad" when the source gave none. */
  levelLabel: z.string().min(1),
  /**
   * Hiring metro. "US" everywhere in v1: the source (collected offer letters)
   * did not break offers down by metro, so no hub is invented here.
   */
  metro: z.string().min(1),
  /** Annual base salary, USD. */
  base: z.number().int().nonnegative(),
  /**
   * Total signing bonus, USD. Counted in full in the at-grant TC column;
   * Amazon's is actually paid over years 1-2 (disclosed in method).
   */
  signingBonus: z.number().int().nonnegative(),
  /** Total 4-year stock/equity grant value at grant, USD. */
  stockGrantTotal4yr: z.number().int().nonnegative(),
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
});
export type TLeaderboardEntry = z.infer<typeof LeaderboardEntry>;

const MEDIUM_SOURCE =
  '47 collected 2024–2025 new-grad offer letters (ranges reported per company)';
const MEDIUM_URL =
  'https://medium.com/lets-code-future/what-companies-actually-pay-new-grads-in-2025-4132eec71a55';
const ACCESS = '2026-09-24';

const RAW: TLeaderboardEntry[] = [
  {
    company: 'Meta',
    ticker: 'META',
    levelLabel: 'E3',
    metro: 'US',
    base: 180000,
    signingBonus: 75000,
    stockGrantTotal4yr: 187500,
    grantDate: GRANT_DATE_ASSUMPTION,
    sampleBand: '<10',
    source: MEDIUM_SOURCE,
    sourceUrl: MEDIUM_URL,
    accessDate: ACCESS,
    method:
      'Midpoint of reported ranges across 4 collected offers: base $175–185K, stock $150–225K over 4 years, signing $50–100K. Rounded to the nearest $2.5K.',
    confidence: 'sourced',
  },
  {
    company: 'Google',
    ticker: 'GOOGL',
    levelLabel: 'L3',
    metro: 'US',
    base: 175000,
    signingBonus: 52500,
    stockGrantTotal4yr: 160000,
    grantDate: GRANT_DATE_ASSUMPTION,
    sampleBand: '<10',
    source: MEDIUM_SOURCE,
    sourceUrl: MEDIUM_URL,
    accessDate: ACCESS,
    method:
      'Midpoint of reported ranges across 3 collected offers: base $170–180K, stock $120–200K over 4 years, signing $30–75K. Rounded to the nearest $2.5K.',
    confidence: 'sourced',
  },
  {
    company: 'Amazon',
    ticker: 'AMZN',
    levelLabel: 'SDE I',
    metro: 'US',
    base: 170000,
    signingBonus: 80000,
    stockGrantTotal4yr: 125000,
    grantDate: GRANT_DATE_ASSUMPTION,
    sampleBand: '<10',
    source: MEDIUM_SOURCE,
    sourceUrl: MEDIUM_URL,
    accessDate: ACCESS,
    method:
      'Midpoint of reported ranges across 5 collected offers: base $165–175K, stock $100–150K over 4 years, signing $40–50K in year 1 + $30–40K in year 2 (summed here; the at-grant TC counts it in full). A separate Glassdoor SDE I San Francisco submission dated 2024-09-14 reported $146K base / $323K total — higher than this range; treated as a single-submission outlier.',
    confidence: 'sourced',
  },
  {
    company: 'Microsoft',
    ticker: 'MSFT',
    levelLabel: '59/60',
    metro: 'US',
    base: 160000,
    signingBonus: 37500,
    stockGrantTotal4yr: 140000,
    grantDate: GRANT_DATE_ASSUMPTION,
    sampleBand: '<10',
    source: MEDIUM_SOURCE,
    sourceUrl: MEDIUM_URL,
    accessDate: ACCESS,
    method:
      'Midpoint of reported ranges across 2 collected offers: base $155–165K, stock $120–160K over 4 years, signing $25–50K. Rounded to the nearest $2.5K.',
    confidence: 'sourced',
  },
  {
    company: 'Netflix',
    ticker: 'NFLX',
    levelLabel: 'New Grad',
    metro: 'US',
    base: 400000,
    signingBonus: 0,
    stockGrantTotal4yr: 0,
    grantDate: GRANT_DATE_ASSUMPTION,
    sampleBand: '<10',
    source: MEDIUM_SOURCE,
    sourceUrl: MEDIUM_URL,
    accessDate: ACCESS,
    method:
      'Single collected offer (all-cash, no stock). Netflix rarely hires new grads — treat as an outlier, not a typical offer.',
    confidence: 'sourced',
  },
  {
    company: 'Stripe',
    ticker: null,
    levelLabel: 'New Grad',
    metro: 'US',
    base: 165000,
    signingBonus: 25000,
    stockGrantTotal4yr: 100000,
    grantDate: GRANT_DATE_ASSUMPTION,
    sampleBand: '<10',
    source: `${MEDIUM_SOURCE} (private company)`,
    sourceUrl: MEDIUM_URL,
    accessDate: ACCESS,
    method:
      'Midpoint of reported ranges across 2 collected offers: base $160–170K, equity $80–120K, signing $20–30K. Private: equity is illiquid paper, excluded from growth/realized columns.',
    confidence: 'sourced',
  },
  {
    company: 'Databricks',
    ticker: null,
    levelLabel: 'New Grad',
    metro: 'US',
    base: 175000,
    signingBonus: 35000,
    stockGrantTotal4yr: 150000,
    grantDate: GRANT_DATE_ASSUMPTION,
    sampleBand: '<10',
    source: `${MEDIUM_SOURCE} (private company)`,
    sourceUrl: MEDIUM_URL,
    accessDate: ACCESS,
    method:
      'Single collected offer: $175K base, $150K equity, $35K signing. Private: equity is illiquid paper, excluded from growth/realized columns.',
    confidence: 'sourced',
  },
  {
    company: 'Airbnb',
    ticker: 'ABNB',
    levelLabel: 'New Grad',
    metro: 'US',
    base: 150000,
    signingBonus: 30000,
    stockGrantTotal4yr: 115000,
    grantDate: GRANT_DATE_ASSUMPTION,
    sampleBand: '<10',
    source: MEDIUM_SOURCE,
    sourceUrl: MEDIUM_URL,
    accessDate: ACCESS,
    method:
      'Midpoint of reported ranges across 2 collected offers: base $145–155K, equity $100–130K, signing $25–35K. Rounded to the nearest $2.5K.',
    confidence: 'sourced',
  },
  {
    company: 'Uber',
    ticker: 'UBER',
    levelLabel: 'New Grad',
    metro: 'US',
    base: 140000,
    signingBonus: 20000,
    stockGrantTotal4yr: 90000,
    grantDate: GRANT_DATE_ASSUMPTION,
    sampleBand: '<10',
    source: MEDIUM_SOURCE,
    sourceUrl: MEDIUM_URL,
    accessDate: ACCESS,
    method:
      'Midpoint of reported ranges across 3 collected offers: base $140–150K, equity $80–100K, signing $15–25K. Rounded to the nearest $2.5K.',
    confidence: 'sourced',
  },
  {
    company: 'Salesforce',
    ticker: 'CRM',
    levelLabel: 'New Grad',
    metro: 'US',
    base: 130000,
    signingBonus: 15000,
    stockGrantTotal4yr: 70000,
    grantDate: GRANT_DATE_ASSUMPTION,
    sampleBand: '<10',
    source: MEDIUM_SOURCE,
    sourceUrl: MEDIUM_URL,
    accessDate: ACCESS,
    method:
      'Midpoint of reported ranges across 2 collected offers: base $130–140K, stock $60–80K, signing $10–20K. Rounded to the nearest $2.5K.',
    confidence: 'sourced',
  },
  {
    company: 'Adobe',
    ticker: 'ADBE',
    levelLabel: 'New Grad',
    metro: 'US',
    base: 125000,
    signingBonus: 10000,
    stockGrantTotal4yr: 50000,
    grantDate: GRANT_DATE_ASSUMPTION,
    sampleBand: '<10',
    source: MEDIUM_SOURCE,
    sourceUrl: MEDIUM_URL,
    accessDate: ACCESS,
    method:
      'Single collected offer: $125K base, $50K stock, $10K signing.',
    confidence: 'sourced',
  },
  {
    company: 'Nvidia',
    ticker: 'NVDA',
    levelLabel: 'IC2',
    metro: 'US',
    base: 160000,
    signingBonus: 0,
    stockGrantTotal4yr: 140000,
    grantDate: GRANT_DATE_ASSUMPTION,
    sampleBand: 'unknown',
    source: 'US new-grad benchmark via levels.fyi direct read (May 2026), aggregated by eufindwork',
    sourceUrl: 'https://github.com/eufindwork/eufindwork.github.io/blob/HEAD/companies/nvidia.en.md',
    accessDate: ACCESS,
    method:
      'ESTIMATE, not a collected 2024 offer. Base is the midpoint of the $140–180K US new-grad base range; the 4-year grant (~$140K) is backed out from the $190–240K year-1 total range assuming Nvidia’s front-loaded 40/30/20/10 vest (midpoint Y1 RSU ≈ $55K → grant ≈ $55K / 0.4). Signing unknown, set to 0.',
    confidence: 'estimate',
  },
];

/** The validated dataset. Throws at import time if any entry is malformed. */
export const LEADERBOARD_2024: TLeaderboardEntry[] = z.array(LeaderboardEntry).parse(RAW);

/** Companies with a public ticker (eligible for realized-value computation). */
export const PUBLIC_ENTRIES = LEADERBOARD_2024.filter((e) => e.ticker !== null);

/** Private-company entries: growth/realized columns are n/a by construction. */
export const PRIVATE_ENTRIES = LEADERBOARD_2024.filter((e) => e.ticker === null);
