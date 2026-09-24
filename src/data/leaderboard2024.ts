import { z } from 'zod';
import { CompanyGroup } from './companyGroups';

/**
 * 2024 new-grad offer leaderboard dataset.
 *
 * PRIVACY / HONESTY RULES (same bar as benchmarks.v2):
 *  - Aggregates only. Every entry is a midpoint of a *range* collected across
 *    multiple real offer letters, or a clearly-labeled estimate. No individual
 *    offer rows, no exact-n sample sizes (bands only). Applied Intuition appears
 *    only via its PUBLIC levels.fyi aggregate (2026 tab) — never private data.
 *  - Every number carries a named source + access date + method string that
 *    says exactly how the figure was produced. Ranges are disclosed, never
 *    silently collapsed into precise-looking points.
 *  - `confidence: 'estimate'` marks entries that are NOT collected 2024
 *    offers (e.g. backed-out from a published benchmark). The UI must surface
 *    this; estimates must never be presented as collected offers.
 *  - `confidence: 'unavailable'` marks entries where no defensible 2024
 *    new-grad offer figure exists. The row is kept for context (e.g. a public
 *    ticker whose stock move is worth showing) with the offer columns
 *    intentionally blank — never estimated.
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
   * Hiring metro. "US" for the v1 collected-offer entries (the source did not
   * break offers down by metro, so no hub is invented). Estimate entries added
   * later carry their source's metro where it is metro-specific.
   */
  metro: z.string().min(1),
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
    // base and the 4-yr stock grant move together; signing may be null on its
    // own when the source aggregate does not report it (counted as $0, with the
    // method disclosing it is unknown rather than zero). All-null offers are
    // only valid with confidence 'unavailable'.
    const offerNull = e.base === null && e.stockGrantTotal4yr === null;
    const offerPresent = e.base !== null && e.stockGrantTotal4yr !== null;
    return (offerNull || offerPresent) && (offerNull === (e.confidence === 'unavailable'));
  },
  {
    message:
      'base/stockGrantTotal4yr must be null together or present together (signing may be null alone when unreported), and null only with confidence "unavailable"',
  },
);
export type TLeaderboardEntry = z.infer<typeof LeaderboardEntry>;

const MEDIUM_SOURCE =
  '47 collected 2024–2025 new-grad offer letters (ranges reported per company)';
const MEDIUM_URL =
  'https://medium.com/lets-code-future/what-companies-actually-pay-new-grads-in-2025-4132eec71a55';
const ACCESS = '2026-09-24';

const RAW: TLeaderboardEntry[] = [
  {
    company: 'Meta',
    group: 'big-tech',
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
    group: 'big-tech',
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
    group: 'big-tech',
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
    group: 'big-tech',
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
    group: 'big-tech',
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
    group: 'startups',
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
    group: 'ai',
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
    group: 'consumer',
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
    group: 'consumer',
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
    group: 'enterprise',
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
    group: 'enterprise',
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
    group: 'big-tech',
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
  {
    company: 'Palantir',
    group: 'defense',
    ticker: 'PLTR',
    levelLabel: 'New Grad',
    metro: 'US',
    base: null,
    signingBonus: null,
    stockGrantTotal4yr: null,
    grantDate: GRANT_DATE_ASSUMPTION,
    sampleBand: 'unknown',
    source: 'N/A — offer data intentionally omitted (see method)',
    accessDate: ACCESS,
    method:
      'OFFER DATA OMITTED, not a collected offer. No defensible 2024 new-grad offer aggregate exists: H1B filings mix seniority levels, Palantir’s new-grad job-posting ranges ($135–145K base) exclude signing and RSU figures, and the one public 0-YOE levels.fyi datapoint ($200K avg annual TC, Feb 2024) keeps its breakdown behind login. The row is kept for PLTR ticker context — the stock-since-Aug-2024 move uses the same canonical anchor as every other entry — and every offer-derived column is intentionally blank rather than estimated.',
    confidence: 'unavailable',
  },
  {
    company: 'Roblox',
    group: 'consumer',
    ticker: 'RBLX',
    levelLabel: 'IC1',
    metro: 'San Mateo, CA',
    base: 150000,
    signingBonus: 22000,
    stockGrantTotal4yr: 352000,
    grantDate: GRANT_DATE_ASSUMPTION,
    sampleBand: '<10',
    source: '2 collected 2024-cycle new-grad offers (teamblind) + Roblox "New Graduate 2024" posting',
    sourceUrl: 'https://www.teamblind.com/post/Offer-Comparison-Bloomberg-vs-Roblox-New-Grad-wz3RpwcF',
    accessDate: ACCESS,
    method:
      'Two independently posted new-grad offers from the fall 2023 hiring cycle (2024 start) report identical figures: $150K base, $88K/yr RSUs (vesting immediately), $22K signing (+$15K relocation, excluded from TC). Roblox\'s own "Security Software Engineer – New Graduate 2024" posting (San Mateo) lists $150,120 base, corroborating. 4-yr stock = $88K × 4.',
    confidence: 'sourced',
  },
  {
    company: 'Arm',
    group: 'big-tech',
    ticker: 'ARM',
    levelLabel: 'Grade 2',
    metro: 'Austin, TX',
    base: 129000,
    signingBonus: null,
    stockGrantTotal4yr: 91600,
    grantDate: GRANT_DATE_ASSUMPTION,
    sampleBand: 'unknown',
    source: 'levels.fyi — Arm Software Engineer, Greater Austin Area (entry-level row)',
    sourceUrl: 'https://www.levels.fyi/companies/arm/salaries/software-engineer/locations/greater-austin-area',
    accessDate: ACCESS,
    method:
      'Estimate backed out from the published levels.fyi entry-level aggregate (Grade 2 Graduate Engineer, Greater Austin Area), read 2026-09-24: $129K base + $22.9K/yr stock (+$17.8K annual bonus, not a signing bonus). 4-yr stock = $22.9K × 4. Signing bonus is not reported in the aggregate and is counted as $0 (unknown, not zero). All-years average, not 2024-specific; 411 Arm SWE submissions tracked.',
    confidence: 'estimate',
  },
  {
    company: 'Apple',
    group: 'big-tech',
    ticker: 'AAPL',
    levelLabel: 'ICT2',
    metro: 'US',
    base: 140000,
    signingBonus: 17500,
    stockGrantTotal4yr: 100000,
    grantDate: GRANT_DATE_ASSUMPTION,
    sampleBand: 'unknown',
    source: 'leonstaff.com Apple salary guide (ICT2 ranges, citing verified 2024/2025 offer threads + levels.fyi medians)',
    sourceUrl: 'https://leonstaff.com/blogs/apple-software-engineer-salary/',
    accessDate: ACCESS,
    method:
      'Estimate from published ICT2 ranges: base $130–150K (midpoint $140K), sign-on $10–25K (midpoint $17.5K, usually split across years 1–2), annual RSU $20–30K → 4-yr stock $80–120K (midpoint $100K). Source states its levels.fyi medians are from May 2026 data and its offer examples from verified 2024–2026 Blind/Reddit threads. Midpoints are derived, not source figures. All-years benchmark, not a collected 2024 offer.',
    confidence: 'estimate',
  },
  {
    company: 'Snap',
    group: 'consumer',
    ticker: 'SNAP',
    levelLabel: 'L3',
    metro: 'US',
    base: 137000,
    signingBonus: null,
    stockGrantTotal4yr: 218000,
    grantDate: GRANT_DATE_ASSUMPTION,
    sampleBand: 'unknown',
    source: 'levels.fyi — Snap Software Engineer (entry-level L3 row), US aggregate',
    sourceUrl: 'https://www.levels.fyi/companies/snap/salaries/software-engineer',
    accessDate: ACCESS,
    method:
      'Estimate backed out from the published levels.fyi entry-level aggregate (L3, US), read 2026-09-24: $137K base + $54.5K/yr stock (+$1.9K bonus). 4-yr stock = $54.5K × 4. Signing bonus is not reported in the aggregate and is counted as $0 (unknown, not zero). Caveat: Snap lists 1-yr, 3-yr, and 4-yr RSU vesting schedules, so the ×4 extrapolation is rough. All-years average, not 2024-specific.',
    confidence: 'estimate',
  },
  {
    company: 'Snowflake',
    group: 'enterprise',
    ticker: 'SNOW',
    levelLabel: 'IC1',
    metro: 'US',
    base: 166000,
    signingBonus: null,
    stockGrantTotal4yr: 228400,
    grantDate: GRANT_DATE_ASSUMPTION,
    sampleBand: 'unknown',
    source: 'levels.fyi — Snowflake Software Engineer, United States (entry-level IC1 row)',
    sourceUrl: 'https://www.levels.fyi/companies/snowflake/salaries/software-engineer/locations/united-states',
    accessDate: ACCESS,
    method:
      'Estimate backed out from the published levels.fyi entry-level aggregate (IC1, US), read 2026-09-24: $166K base + $57.1K/yr stock (+$8.1K bonus). 4-yr stock = $57.1K × 4; Snowflake RSUs vest 25%/yr over 4 years. Signing bonus is not reported in the aggregate and is counted as $0 (unknown, not zero). Cross-checked against the eufindwork May 2026 levels.fyi read (US IC1 ~$239K TC; drifted to ~$231K by Sep 2026 — the Sep 2026 direct read is used). All-years average, not 2024-specific.',
    confidence: 'estimate',
  },
  {
    company: 'Pinterest',
    group: 'consumer',
    ticker: 'PINS',
    levelLabel: 'IC13',
    metro: 'US',
    base: 163000,
    signingBonus: null,
    stockGrantTotal4yr: 194400,
    grantDate: GRANT_DATE_ASSUMPTION,
    sampleBand: 'unknown',
    source: 'levels.fyi — Pinterest Software Engineer (entry-level IC13 row), US aggregate',
    sourceUrl: 'https://www.levels.fyi/companies/pinterest/salaries/software-engineer',
    accessDate: ACCESS,
    method:
      'Estimate backed out from the published levels.fyi entry-level aggregate (IC13 Software Engineer I, US), read 2026-09-24: $163K base + $48.6K/yr stock (+$13.6K bonus). 4-yr stock = $48.6K × 4. Signing bonus is not reported in the aggregate and is counted as $0 (unknown, not zero). Caveat: levels.fyi lists 3-yr and 4-yr vesting schedules at Pinterest; new-hire grants are typically 4-yr but the aggregate does not confirm terms. All-years average, not 2024-specific.',
    confidence: 'estimate',
  },
  {
    company: 'LinkedIn',
    group: 'big-tech',
    ticker: null,
    levelLabel: 'IC2',
    metro: 'US',
    base: 174000,
    signingBonus: null,
    stockGrantTotal4yr: 261200,
    grantDate: GRANT_DATE_ASSUMPTION,
    sampleBand: 'unknown',
    source: 'levels.fyi — LinkedIn Software Engineer (IC2 row), US aggregate',
    sourceUrl: 'https://www.levels.fyi/companies/linkedin/salaries/software-engineer',
    accessDate: ACCESS,
    method:
      'Estimate backed out from the published levels.fyi aggregate (US), read 2026-09-24. Leveling nuance: IC1 is LinkedIn\'s "Apprentice" program for non-traditional backgrounds; traditional new grads enter at IC2: $174K base + $65.3K/yr stock (+$14.4K bonus). 4-yr stock = $65.3K × 4. Signing bonus is not reported in the aggregate and is counted as $0 (unknown, not zero). LinkedIn is a Microsoft subsidiary with no separate ticker — equity is Microsoft RSUs vesting 25%/yr over 4 years — so no price history is modeled and growth/realized columns are n/a. All-years average, not 2024-specific.',
    confidence: 'estimate',
  },
  {
    company: 'ByteDance',
    group: 'consumer',
    ticker: null,
    levelLabel: '1-2',
    metro: 'US',
    base: 154000,
    signingBonus: null,
    stockGrantTotal4yr: 100400,
    grantDate: GRANT_DATE_ASSUMPTION,
    sampleBand: 'unknown',
    source: 'levels.fyi — ByteDance Software Engineer (entry-level 1-2 row), US aggregate',
    sourceUrl: 'https://www.levels.fyi/companies/bytedance/salaries/software-engineer',
    accessDate: ACCESS,
    method:
      'Estimate backed out from the published levels.fyi entry-level aggregate (1-2, US), read 2026-09-24: $154K base + $25.1K/yr stock (+$21.3K bonus). 4-yr stock = $25.1K × 4. Signing bonus is not reported in the aggregate and is counted as $0 (unknown, not zero). Caveats: ByteDance is private — RSU values are self-reported fair values; levels.fyi lists mixed vesting schedules (3-yr and 4-yr), so the ×4 extrapolation is the roughest in this dataset. Private equity is illiquid paper, so growth/realized columns are n/a. All-years average, not 2024-specific.',
    confidence: 'estimate',
  },
];

/** 2025 rows: 8 companies from the collected 2024-2025 offer letters (same
 * source as the 2024 sourced rows), filed under the 2025 canonical grant date.
 * Everything else is honestly absent: no 2025-anchored aggregates were found
 * for any other company, so no other rows exist here. */
const RAW_2025: TLeaderboardEntry[] = [
  {
    company: "Google",
    group: "big-tech",
    ticker: "GOOGL",
    levelLabel: 'New Grad',
    metro: 'US',
    base: 175000,
    signingBonus: 52500,
    stockGrantTotal4yr: 160000,
    grantDate: "2025-08-01",
    sampleBand: '<10',
    source: MEDIUM_SOURCE,
    sourceUrl: "https://medium.com/lets-code-future/what-companies-actually-pay-new-grads-in-2025-4132eec71a55",
    accessDate: "2026-09-24",
    method: "Midpoint of reported ranges across 3 collected 2024-2025 offers (self-reported, anonymized, via Medium); rounded. base $170-180K, stock $120-200K over 4 years, signing $30-75K.",
    confidence: 'sourced',
  },
  {
    company: "Meta",
    group: "big-tech",
    ticker: "META",
    levelLabel: 'New Grad',
    metro: 'US',
    base: 180000,
    signingBonus: 75000,
    stockGrantTotal4yr: 187500,
    grantDate: "2025-08-01",
    sampleBand: '<10',
    source: MEDIUM_SOURCE,
    sourceUrl: "https://medium.com/lets-code-future/what-companies-actually-pay-new-grads-in-2025-4132eec71a55",
    accessDate: "2026-09-24",
    method: "Midpoint of reported ranges across 4 collected 2024-2025 offers (self-reported, anonymized, via Medium); rounded. base $175-185K, stock $150-225K over 4 years, signing $50-100K.",
    confidence: 'sourced',
  },
  {
    company: "Netflix",
    group: "big-tech",
    ticker: "NFLX",
    levelLabel: 'New Grad',
    metro: 'US',
    base: 400000,
    signingBonus: 0,
    stockGrantTotal4yr: 0,
    grantDate: "2025-08-01",
    sampleBand: '<10',
    source: MEDIUM_SOURCE,
    sourceUrl: "https://medium.com/lets-code-future/what-companies-actually-pay-new-grads-in-2025-4132eec71a55",
    accessDate: "2026-09-24",
    method: "Midpoint of reported ranges across 1 collected 2024-2025 offer (self-reported, anonymized, via Medium); rounded. SINGLE DATAPOINT, not an aggregate: one collected all-cash offer ($400K base, no stock). Netflix rarely hires new grads - treat as an outlier, not a typical offer.",
    confidence: 'sourced',
  },
  {
    company: "Amazon",
    group: "big-tech",
    ticker: "AMZN",
    levelLabel: 'New Grad',
    metro: 'US',
    base: 170000,
    signingBonus: 80000,
    stockGrantTotal4yr: 125000,
    grantDate: "2025-08-01",
    sampleBand: '<10',
    source: MEDIUM_SOURCE,
    sourceUrl: "https://medium.com/lets-code-future/what-companies-actually-pay-new-grads-in-2025-4132eec71a55",
    accessDate: "2026-09-24",
    method: "Midpoint of reported ranges across 5 collected 2024-2025 offers (self-reported, anonymized, via Medium); rounded. base $165-175K, stock $100-150K over 4 years, signing $40-50K in year 1 + $30-40K in year 2 (summed here; the at-grant TC counts it in full).",
    confidence: 'sourced',
  },
  {
    company: "Microsoft",
    group: "big-tech",
    ticker: "MSFT",
    levelLabel: 'New Grad',
    metro: 'US',
    base: 160000,
    signingBonus: 37500,
    stockGrantTotal4yr: 140000,
    grantDate: "2025-08-01",
    sampleBand: '<10',
    source: MEDIUM_SOURCE,
    sourceUrl: "https://medium.com/lets-code-future/what-companies-actually-pay-new-grads-in-2025-4132eec71a55",
    accessDate: "2026-09-24",
    method: "Midpoint of reported ranges across 2 collected 2024-2025 offers (self-reported, anonymized, via Medium); rounded. base $155-165K, stock $120-160K over 4 years, signing $25-50K.",
    confidence: 'sourced',
  },
  {
    company: "Stripe",
    group: "startups",
    ticker: null,
    levelLabel: 'New Grad',
    metro: 'US',
    base: 165000,
    signingBonus: 25000,
    stockGrantTotal4yr: 100000,
    grantDate: "2025-08-01",
    sampleBand: '<10',
    source: MEDIUM_SOURCE,
    sourceUrl: "https://medium.com/lets-code-future/what-companies-actually-pay-new-grads-in-2025-4132eec71a55",
    accessDate: "2026-09-24",
    method: "Midpoint of reported ranges across 2 collected 2024-2025 offers (self-reported, anonymized, via Medium); rounded. base $160-170K, equity $80-120K, signing $20-30K. Private: equity is illiquid paper, excluded from growth/realized columns.",
    confidence: 'sourced',
  },
  {
    company: "Databricks",
    group: "ai",
    ticker: null,
    levelLabel: 'New Grad',
    metro: 'US',
    base: 175000,
    signingBonus: 35000,
    stockGrantTotal4yr: 150000,
    grantDate: "2025-08-01",
    sampleBand: '<10',
    source: MEDIUM_SOURCE,
    sourceUrl: "https://medium.com/lets-code-future/what-companies-actually-pay-new-grads-in-2025-4132eec71a55",
    accessDate: "2026-09-24",
    method: "Midpoint of reported ranges across 1 collected 2024-2025 offer (self-reported, anonymized, via Medium); rounded. SINGLE DATAPOINT, not an aggregate: one collected offer ($175K base, $150K equity, $35K signing). Private: equity is illiquid paper, excluded from growth/realized columns.",
    confidence: 'sourced',
  },
  {
    company: "Airbnb",
    group: "consumer",
    ticker: "ABNB",
    levelLabel: 'New Grad',
    metro: 'US',
    base: 150000,
    signingBonus: 30000,
    stockGrantTotal4yr: 115000,
    grantDate: "2025-08-01",
    sampleBand: '<10',
    source: MEDIUM_SOURCE,
    sourceUrl: "https://medium.com/lets-code-future/what-companies-actually-pay-new-grads-in-2025-4132eec71a55",
    accessDate: "2026-09-24",
    method: "Midpoint of reported ranges across 2 collected 2024-2025 offers (self-reported, anonymized, via Medium); rounded. base $145-155K, equity $100-130K, signing $25-35K.",
    confidence: 'sourced',
  },
];

/** 2026 rows: 28 levels.fyi entry-level aggregates (public, all-years rolling
 * averages read 2026-09-24), labeled `estimate` per the dataset rules. Canva is
 * deliberately omitted: its only levels.fyi row is Australia-only (A$), with no
 * US row to rank against USD figures. Palantir, Perplexity, Mercor, and Figure AI
 * have no defensible entry-level aggregate and are omitted as well. Applied
 * Intuition uses the PUBLIC levels.fyi aggregate only — no private data. */
const RAW_2026: TLeaderboardEntry[] = [
  {
    company: "Google",
    group: "big-tech",
    ticker: "GOOGL",
    levelLabel: "L3 SWE II",
    metro: "US",
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
    metro: "US",
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
    metro: "US",
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
    metro: "US",
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
    metro: "US",
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
    metro: "US",
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
    metro: "US",
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
    metro: "US",
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
    metro: "US",
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
    metro: "US",
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
    metro: "US",
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
    metro: "US",
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
    metro: "Austin, TX",
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
    metro: "US",
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
    metro: "US",
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
    metro: "US",
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
    metro: "US",
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
    metro: "US",
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
    metro: "US",
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
    metro: "US",
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
    metro: "US",
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
    metro: "US",
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
    metro: "US",
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
    metro: "US",
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
    metro: "US",
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
    metro: "US",
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
    metro: "US",
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
    metro: "US",
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
