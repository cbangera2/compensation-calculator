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
 *  - 2024 NG offer TC appears ONLY where a sourced figure exists, never
 *    invented and never private: Stripe and Databricks carry their figures
 *    over from the project's own collected-offer dataset (leaderboard2024.ts);
 *    Applied Intuition uses the public levels.fyi entry-level aggregate
 *    (per owner request — public data only, never the owner's comp).
 *    The stock portion is stored separately so the growth-marked TC column
 *    can re-price it at the latest valuation.
 */

export const STARTUP_DATASET_VERSION = 'v1.2026-09-24';

/** Last date any entry in this dataset was verified against its source. */
export const STARTUP_LAST_VERIFIED = '2026-09-24';

export const StartupConfidence = z.enum(['sourced', 'estimate']);
export type TStartupConfidence = z.infer<typeof StartupConfidence>;

export const StartupEntry = z
  .object({
    /** Display company name. */
    company: z.string().min(1),
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
      (e.ngOfferTc2024 === null) === (e.ngStockPerYearAtGrant === null) &&
      (e.ngBase2024 === null) === (e.ngSigning2024 === null) &&
      (e.ngOfferTc2024 === null || e.ngBase2024 === null || e.ngSigning2024 === null || e.ngStockPerYearAtGrant === null ||
        e.ngBase2024 + e.ngSigning2024 + e.ngStockPerYearAtGrant === e.ngOfferTc2024) &&
      (e.valuationAug2024Usd === null) === (e.valuationAug2024Date === null) &&
      (e.valuationAug2024Usd === null) === (e.valuationAug2024Event === null),
    {
      message:
        'ngOfferTc2024/ngStockPerYearAtGrant must be null together, ngBase2024/ngSigning2024 must be null together, and a present breakdown must sum to the offer TC',
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
    group: 'ai',
    latestValuationUsd: 965e9,
    latestValuationDate: '2026-05-28',
    latestValuationEvent: '$65B Series H (Altimeter, Dragoneer, Greenoaks, Sequoia)',
    valuationAug2024Usd: 18.4e9,
    valuationAug2024Date: '2024-03-01',
    valuationAug2024Event: 'Menlo-led ~$750M round at ~$18.4B post (early 2024)',
    ngOfferTc2024: null,
    ngStockPerYearAtGrant: null,
    ngBase2024: null,
    ngSigning2024: null,
    source: 'Company funding announcement + Crunchbase round coverage',
    sourceUrl:
      'https://github.com/pedro-bright/the-ledger/blob/HEAD/content/events/2026/53-anthropic-series-h-65b.md',
    accessDate: ACCESS,
    method:
      'Latest: $965B post-money, May 2026 Series H. Anchor: ~$18.4B post, early-2024 Menlo-led round. No sourced 2024 new-grad offer figure in this project, so NG TC is null.',
    confidence: 'sourced',
  },
  {
    company: 'Mercor',
    group: 'startups',
    latestValuationUsd: 10e9,
    latestValuationDate: '2025-10-27',
    latestValuationEvent: '$350M Series C (Felicis-led)',
    valuationAug2024Usd: 250e6,
    valuationAug2024Date: '2024-09-18',
    valuationAug2024Event: '$32M Series A at $250M (Benchmark-led)',
    ngOfferTc2024: null,
    ngStockPerYearAtGrant: null,
    ngBase2024: null,
    ngSigning2024: null,
    source: 'TechCrunch (Series B); Series C reported by TechCrunch via Beamstart',
    sourceUrl: 'https://beamstart.com/news/mercor-quintuples-valuation-to-10b-17615810758582',
    accessDate: ACCESS,
    method:
      'Latest: $10B, Oct 2025 Series C $350M led by Felicis (TechCrunch-reported). Anchor: $250M, Sep 2024 Series A $32M led by Benchmark (Forbes/TechCrunch). Reported 2026 $20B talks are talks, not a closed round — excluded. No sourced 2024 new-grad offer figure, so NG TC is null.',
    confidence: 'sourced',
  },
  {
    company: 'Figure AI',
    group: 'startups',
    latestValuationUsd: 39e9,
    latestValuationDate: '2025-09-16',
    latestValuationEvent: 'Series C, $1B+ committed (Parkway Venture Capital)',
    valuationAug2024Usd: 2.6e9,
    valuationAug2024Date: '2024-02-29',
    valuationAug2024Event: '$675M round at $2.6B (Feb 2024)',
    ngOfferTc2024: null,
    ngStockPerYearAtGrant: null,
    ngBase2024: null,
    ngSigning2024: null,
    source: 'Reuters',
    sourceUrl:
      'https://www.reuters.com/business/robotics-startup-figure-valued-39-billion-latest-funding-round-2025-09-16/',
    accessDate: ACCESS,
    method:
      'Latest: $39B post-money Series C, Sep 2025. Anchor: $2.6B, Feb 2024 round (both per the same Reuters report). No sourced 2024 new-grad offer figure, so NG TC is null.',
    confidence: 'sourced',
  },
  {
    company: 'Ramp',
    group: 'startups',
    latestValuationUsd: 44e9,
    latestValuationDate: '2026-06-04',
    latestValuationEvent: '$750M Series F (ICONIQ, GIC, Ontario Teachers)',
    valuationAug2024Usd: 7.65e9,
    valuationAug2024Date: '2024-04-17',
    valuationAug2024Event: '$150M Series D-2 at $7.65B (Khosla, Founders Fund)',
    ngOfferTc2024: null,
    ngStockPerYearAtGrant: null,
    ngBase2024: null,
    ngSigning2024: null,
    source: 'Reuters',
    sourceUrl:
      'https://www.reuters.com/legal/transactional/fintech-firm-ramps-valuation-surges-44-billion-ai-driven-growth-2026-06-04/',
    accessDate: ACCESS,
    method:
      'Latest: $44B, Jun 2026 Series F (Reuters). Anchor: $7.65B, Apr 2024 Series D-2 (TechCrunch). Sep 2026 reports of a $60B raise are talks, not a closed round — excluded.',
    confidence: 'sourced',
  },
  {
    company: 'OpenAI',
    group: 'ai',
    latestValuationUsd: 852e9,
    latestValuationDate: '2026-03-31',
    latestValuationEvent: '$122B round (Amazon, Nvidia, SoftBank, a16z)',
    valuationAug2024Usd: 157e9,
    valuationAug2024Date: '2024-10-02',
    valuationAug2024Event: '$13.33B raise at $157B post (Oct 2024)',
    ngOfferTc2024: null,
    ngStockPerYearAtGrant: null,
    ngBase2024: null,
    ngSigning2024: null,
    source: 'Forge private-market round history',
    sourceUrl: 'https://forgeglobal.com/insights/openai-upcoming-ipo-news/',
    accessDate: ACCESS,
    method:
      'Latest: $852B, Mar 2026. Anchor: $157B, Oct 2024 raise — the nearest press-covered mark to Aug 2024 (the round was being negotiated in Aug–Sep 2024). No sourced 2024 new-grad offer figure, so NG TC is null.',
    confidence: 'sourced',
  },
  {
    company: 'Databricks',
    group: 'ai',
    latestValuationUsd: 190e9,
    latestValuationDate: '2026-08-13',
    latestValuationEvent: '$5B strategic round (Coatue-led)',
    valuationAug2024Usd: 43e9,
    valuationAug2024Date: '2023-09-14',
    valuationAug2024Event: 'Series I, $500M+ at $43B',
    ngOfferTc2024: 247500,
    ngStockPerYearAtGrant: 37500,
    ngBase2024: 175000,
    ngSigning2024: 35000,
    source: 'Company announcements; TechCrunch (Series I)',
    sourceUrl:
      'https://techstartups.com/2026/08/13/databricks-raises-5-billion-at-190-billion-valuation-as-revenue-run-rate-tops-7-billion/',
    accessDate: ACCESS,
    method:
      'Latest: $190B, Aug 2026 strategic round. Anchor: $43B Series I, Sep 2023 — the last press-covered mark before Dec 2024 ($62B). NG TC carried from leaderboard2024.ts: single collected offer $175K base + $35K signing + $150K equity (stock/4 = $37.5K). Private equity is illiquid paper.',
    confidence: 'sourced',
  },
  {
    company: 'Anduril',
    group: 'defense',
    latestValuationUsd: 61e9,
    latestValuationDate: '2026-05-13',
    latestValuationEvent: '$5B Series H (Thrive Capital, Andreessen Horowitz)',
    valuationAug2024Usd: 14e9,
    valuationAug2024Date: '2024-08-01',
    valuationAug2024Event: '$1.5B Series F at $14B (Founders Fund, Sands Capital)',
    ngOfferTc2024: null,
    ngStockPerYearAtGrant: null,
    ngBase2024: null,
    ngSigning2024: null,
    source: 'Reuters',
    sourceUrl:
      'https://www.reuters.com/legal/transactional/us-defense-firm-anduril-raises-5-billion-doubling-its-valuation-61-billion-2026-05-13/',
    accessDate: ACCESS,
    method:
      'Latest: $61B, May 2026 Series H (Reuters). Anchor: $14B, Aug 2024 Series F (Crunchbase) — exactly the Aug-2024 window. No sourced 2024 new-grad offer figure, so NG TC is null.',
    confidence: 'sourced',
  },
  {
    company: 'Vercel',
    group: 'startups',
    latestValuationUsd: 9.3e9,
    latestValuationDate: '2025-09-30',
    latestValuationEvent: '$300M Series F (Accel, GIC)',
    valuationAug2024Usd: 3.25e9,
    valuationAug2024Date: '2024-05-16',
    valuationAug2024Event: '$250M Series E at $3.25B (Accel)',
    ngOfferTc2024: null,
    ngStockPerYearAtGrant: null,
    ngBase2024: null,
    ngSigning2024: null,
    source: 'Company announcement (Morningstar)',
    sourceUrl:
      'https://www.morningstar.com/news/business-wire/20250930898216/vercel-closes-series-f-at-93b-valuation-to-scale-the-ai-cloud',
    accessDate: ACCESS,
    method:
      'Latest: $9.3B, Sep 2025 Series F. Anchor: $3.25B, May 2024 Series E (Reuters/SiliconANGLE). No sourced 2024 new-grad offer figure, so NG TC is null.',
    confidence: 'sourced',
  },
  {
    company: 'Rippling',
    group: 'startups',
    latestValuationUsd: 35e9,
    latestValuationDate: '2026-07-01',
    latestValuationEvent: 'Series I, $500M (Jul 2026)',
    valuationAug2024Usd: 13.5e9,
    valuationAug2024Date: '2024-04-22',
    valuationAug2024Event: '$200M Series F at $13.5B (Coatue)',
    ngOfferTc2024: null,
    ngStockPerYearAtGrant: null,
    ngBase2024: null,
    ngSigning2024: null,
    source: 'TechStackIPO round tracker',
    sourceUrl: 'https://techstackipo.polsia.app/company/rippling',
    accessDate: ACCESS,
    method:
      'Latest: $35B, Jul 2026 Series I (round tracker — treat as a secondary source). Anchor: $13.5B, Apr 2024 Series F (SiliconANGLE). No sourced 2024 new-grad offer figure, so NG TC is null.',
    confidence: 'estimate',
  },
  {
    company: 'Applied Intuition',
    group: 'startups',
    latestValuationUsd: 15e9,
    latestValuationDate: '2025-06-01',
    latestValuationEvent: 'Series F, $600M (BlackRock + Kleiner Perkins co-led)',
    valuationAug2024Usd: 6e9,
    valuationAug2024Date: '2024-03-01',
    valuationAug2024Event: 'Series E (Mar 2024)',
    ngOfferTc2024: null,
    ngStockPerYearAtGrant: null,
    ngBase2024: null,
    ngSigning2024: null,
    source: 'Company funding announcements (TechCrunch); levels.fyi checked for Sunnyvale new-grad data',
    sourceUrl: 'https://www.levels.fyi/companies/applied-intuition/salaries/software-engineer',
    accessDate: ACCESS,
    method:
      'Valuations are public press facts: Series E Mar 2024 at $6B; Series F Jun 2025, $600M at $15B (BlackRock + Kleiner Perkins co-led). NG offer TC is intentionally blank: levels.fyi only publishes a US-wide entry-level aggregate ($209,300 avg annual TC), not a Sunnyvale-specific new-grad figure, and no other public Sunnyvale new-grad source exists — so there is no honest Sunnyvale figure to show. Owner private compensation data is never used.',
    confidence: 'sourced',
  },
  {
    company: 'Stripe',
    group: 'startups',
    latestValuationUsd: 159e9,
    latestValuationDate: '2026-02-24',
    latestValuationEvent: 'Tender offer (Thrive, Coatue, a16z)',
    valuationAug2024Usd: 70e9,
    valuationAug2024Date: '2024-07-01',
    valuationAug2024Event: 'Sequoia internal $70B mark (Jul 2024)',
    ngOfferTc2024: 215000,
    ngStockPerYearAtGrant: 25000,
    ngBase2024: 165000,
    ngSigning2024: 25000,
    source: 'Company tender announcement; TechCrunch (Sequoia mark)',
    sourceUrl: 'https://www.ainvest.com/news/stripe-159b-tender-liquidity-pump-smart-money-exit-2602/',
    accessDate: ACCESS,
    method:
      'Latest: $159B tender, Feb 2026. Anchor: Sequoia’s $70B internal mark, Jul 2024 (TechCrunch) — the nearest mark to Aug 2024; the $65B Feb 2024 tender is the alternative anchor. NG TC carried from leaderboard2024.ts: midpoints $165K base + $25K signing + $100K equity (stock/4 = $25K). Private equity is illiquid paper.',
    confidence: 'sourced',
  },
  {
    company: 'Perplexity',
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
    sourceUrl: 'https://techfundingnews.com/perplexity-raises-200m-at-20b-valuation-ai-search/',
    accessDate: ACCESS,
    method:
      'Latest: $20B closed round, Aug 2025 (a later reported $30B round is talks, not closed — excluded). Anchor: $9B, Dec 2024. No sourced 2024 new-grad offer figure, so NG TC is null.',
    confidence: 'sourced',
  },
  {
    company: 'Canva',
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
      'Latest: $42B employee share sale, Sep 2026 (Bloomberg). Anchor: $32B 2024 share sale (per the same report). No sourced 2024 new-grad offer figure, so NG TC is null.',
    confidence: 'sourced',
  },
  {
    company: 'Discord',
    group: 'consumer',
    latestValuationUsd: 8.53e9,
    latestValuationDate: '2026-07-08',
    latestValuationEvent: 'Forge secondary mark, Jul 2026',
    valuationAug2024Usd: null,
    valuationAug2024Date: null,
    valuationAug2024Event: null,
    ngOfferTc2024: null,
    ngStockPerYearAtGrant: null,
    ngBase2024: null,
    ngSigning2024: null,
    source: 'Forge secondary mark (via AIFundingTracker)',
    sourceUrl: 'https://aifundingtracker.com/who-owns-discord/',
    accessDate: ACCESS,
    method:
      'Latest is a secondary-market mark ($8.53B, Jul 2026, Forge) — not a funding round, so confidence is estimate. Last primary round was Sep 2021 ($15.2B); no 2024-era mark is publicly known, so the anchor is null and growth is not computed.',
    confidence: 'estimate',
  },
];

/** The validated dataset. Throws at import time if any entry is malformed. */
export const STARTUP_LEADERBOARD: TStartupEntry[] = z.array(StartupEntry).parse(RAW);

/** Entries with an anchor valuation (eligible for growth ranking). */
export const ANCHORED_STARTUPS = STARTUP_LEADERBOARD.filter((e) => e.valuationAug2024Usd !== null);

/** Entries without a 2024-era anchor: shown after the ranked rows, labeled clearly. */
export const UNANCHORED_STARTUPS = STARTUP_LEADERBOARD.filter((e) => e.valuationAug2024Usd === null);
