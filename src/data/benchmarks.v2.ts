import { z } from 'zod';

/**
 * Benchmark dataset v2 — public compensation aggregates for offer comparison.
 *
 * PUBLIC TIER ONLY. Privacy rules enforced in this file:
 *  - Aggregates only; band edges rounded to the nearest $1K.
 *  - Sample sizes are bands ("<10" | "10-50" | "50+" | "unknown"), never exact n.
 *  - Cells with fewer than 5 observations are not shipped; missing
 *    company x level x metro combos resolve to "insufficient data" in the UI.
 *  - No Applied Intuition data, no individual offer rows, anywhere.
 *
 * What changed from v1 (2026-09-24):
 *  - Coverage grew from 17 cells (13 sourced + 4 illustrative) to 29 cells,
 *    all with sourced p50 anchors. The 4 illustrative placeholders are gone:
 *    the 3 Apple Bay Area cells are replaced by levels.fyi published averages
 *    (ICT2/ICT3/ICT4) and the Microsoft Mid placeholder is replaced by
 *    levels.fyi Microsoft Seattle averages (levels 59-62); the Apple NYC
 *    illustrative cell was removed (rolls up to sourced Bay Area via fallback).
 *  - New coverage: Meta Seattle + NYC (E3/E4/E5), Google Bay Area (L3/L4/L5),
 *    Google Seattle (L3/L4), Apple Bay Area (ICT2/ICT3/ICT4),
 *    Microsoft Seattle (Entry = 59-60 avg, Mid = 61-62 avg).
 *  - The p25/p75/p90 spread factors are no longer arbitrary v1 constants.
 *    They are CALIBRATED on published percentile distributions (see
 *    SPREAD_CALIBRATION below). Every cell carries spreadSource: 'sourced'
 *    plus a method string naming the calibration, so the UI can show which
 *    bands are distribution-calibrated vs modeled. levels.fyi still publishes
 *    level *averages*, not percentiles, so p25/p75/p90 remain estimates —
 *    calibrated ones, honestly labeled.
 *  - New: LAST_VERIFIED export and per-cell sourceUrl where the exact source
 *    URL was captured verbatim.
 *
 * Spread calibration (base pay, ratios vs the published average/center):
 *  - Glassdoor "Meta Software Engineer" US: p25 $121,195 / center $151,699 /
 *    p75 $192,396 / p90 $236,653 (28,549 submissions) ->
 *    0.80 / 1.27 / 1.56
 *  - Glassdoor "Meta Software Engineer" San Francisco (~106 submissions):
 *    p25 $158,199 / center $196,875 / p75 $248,071 / p90 $303,371 ->
 *    0.80 / 1.26 / 1.54
 *  - Glassdoor "Meta Software Engineer IV" (~233 submissions):
 *    p25 $161,698 / center $196,315 / p75 $241,929 / p90 $290,396 ->
 *    0.82 / 1.23 / 1.48
 *  - Glassdoor "Meta Software Engineer IC5, Seattle" (~25 submissions):
 *    p25 $144,511 / center $169,500 / p75 $202,312 / p90 $236,492 ->
 *    0.85 / 1.19 / 1.40
 *  Consensus base spread: p25 x0.82, p75 x1.24, p90 x1.50.
 *  (Level-specific samples track the pooled samples, so applying the pooled
 *  shape to a level anchor is defensible.)
 *
 * Spread calibration (total comp, ratios vs published median):
 *  - Glassdoor "Apple Software Engineer, San Francisco" total pay
 *    (~4.3k salaries): typical range $247K-$397K, median $310K ->
 *    p25/med 0.80, p75/med 1.28
 *  - Glassdoor "Meta Senior Software Engineer, San Francisco" total pay
 *    (~1.1k salaries): typical range $342K-$525K, median $417K ->
 *    p25/med 0.82, p75/med 1.26
 *  Consensus total spread: p25 x0.82, p75 x1.26. No published p90 for total
 *  comp was found, so total p90 (x1.55) is a MODELED equity-driven upper
 *  tail — disclosed in every cell's method.
 *
 * All calibration sources accessed 2026-09-24.
 */

export const DATASET_VERSION = 'v2.2026-09-24';

/** Last date any cell in this dataset was verified against its source. */
export const LAST_VERIFIED = '2026-09-24';

export const BenchmarkLevel = z.enum(['Entry', 'Mid', 'Senior']);
export type TBenchmarkLevel = z.infer<typeof BenchmarkLevel>;

export const BenchmarkMetro = z.enum([
  'Bay Area',
  'Seattle',
  'NYC',
  'Austin',
  'Detroit/Ann Arbor',
  'DC',
]);
export type TBenchmarkMetro = z.infer<typeof BenchmarkMetro>;

export const PercentileBands = z
  .object({
    p25: z.number().nonnegative(),
    p50: z.number().nonnegative(),
    p75: z.number().nonnegative(),
    p90: z.number().nonnegative(),
  })
  .refine((b) => b.p25 <= b.p50 && b.p50 <= b.p75 && b.p75 <= b.p90, {
    message: 'percentile bands must be ordered p25 <= p50 <= p75 <= p90',
  });
export type TPercentileBands = z.infer<typeof PercentileBands>;

export const SampleBand = z.enum(['<10', '10-50', '50+', 'unknown']);
export type TSampleBand = z.infer<typeof SampleBand>;

export const BenchmarkConfidence = z.enum(['sourced', 'illustrative']);
export type TBenchmarkConfidence = z.infer<typeof BenchmarkConfidence>;

/**
 * How a cell's p25/p75/p90 band edges were derived.
 *  - 'sourced': spread factors calibrated on published percentile
 *    distributions (named in the cell's `method`); p50 is the published
 *    aggregate anchor. The bands are still estimates, but the spread shape
 *    comes from real distributions rather than an arbitrary constant.
 *  - 'modeled': fixed/arbitrary spread factors (v1 style). No v2 cell uses
 *    this; the value exists so the UI can keep distinguishing if a modeled
 *    cell is ever added back.
 */
export const SpreadSource = z.enum(['sourced', 'modeled']);
export type TSpreadSource = z.infer<typeof SpreadSource>;

export const BenchmarkCell = z.object({
  /** Display company name, e.g. "Meta". */
  company: z.string().min(1),
  /** Company-specific level label, e.g. "E4" (see COMPANY_LEVEL_MAP). */
  companyLevel: z.string().min(1),
  level: BenchmarkLevel,
  metro: BenchmarkMetro,
  base: PercentileBands,
  totalComp: PercentileBands,
  sampleBand: SampleBand,
  /** Human-readable public source, e.g. "levels.fyi — Meta SWE, SF Bay Area". */
  source: z.string().min(1),
  /** Exact source URL, captured verbatim. Optional: older cells lack it. */
  sourceUrl: z.string().url().optional(),
  /** Date the source was accessed, YYYY-MM-DD. */
  accessDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  /** Exactly how the numbers were produced; must disclose calibrated bands. */
  method: z.string().min(1),
  confidence: BenchmarkConfidence,
  spreadSource: SpreadSource,
});
export type TBenchmarkCell = z.infer<typeof BenchmarkCell>;

/** Generic level -> per-company level label. Labels are community-reported
 *  mappings (e.g. levels.fyi), not official company ladders. */
export const COMPANY_LEVEL_MAP: Record<string, Record<TBenchmarkLevel, string>> = {
  Meta: { Entry: 'E3', Mid: 'E4', Senior: 'E5' },
  Google: { Entry: 'L3', Mid: 'L4', Senior: 'L5' },
  Apple: { Entry: 'ICT2', Mid: 'ICT3', Senior: 'ICT4' },
  Microsoft: { Entry: '59–60', Mid: '61–62', Senior: '63–64' },
  Bloomberg: { Entry: 'SWE 1', Mid: 'SWE 2', Senior: 'SWE 3' },
  Stripe: { Entry: 'L1–L2', Mid: 'L3', Senior: 'L4 (Staff)' },
  SpaceX: { Entry: 'T2', Mid: 'T3', Senior: 'T4' },
  Tesla: { Entry: 'P2', Mid: 'P3', Senior: 'P4' },
  Anduril: { Entry: 'E1', Mid: 'E2', Senior: 'E3' },
  Palantir: { Entry: 'L3', Mid: 'L4', Senior: 'L5' },
};

export const BENCHMARK_COMPANIES: string[] = Object.keys(COMPANY_LEVEL_MAP);

export const BENCHMARK_METROS: TBenchmarkMetro[] = [
  'Bay Area',
  'Seattle',
  'NYC',
  'Austin',
  'Detroit/Ann Arbor',
  'DC',
];

export const BENCHMARK_LEVELS: TBenchmarkLevel[] = ['Entry', 'Mid', 'Senior'];

// ---------------------------------------------------------------------------
// v2 band calibration
// ---------------------------------------------------------------------------

/** Base-pay spread factors, calibrated on published Glassdoor percentile
 *  distributions (see header). Applied to the published base anchor (p50). */
const BASE_SPREAD = { p25: 0.82, p75: 1.24, p90: 1.5 };
/** Total-comp spread factors. p25/p75 calibrated on Glassdoor total-pay
 *  typical ranges; p90 is a modeled equity-driven upper tail. */
const TOTAL_SPREAD = { p25: 0.82, p75: 1.26, p90: 1.55 };

/**
 * Honest-disclosure paragraph appended to every v2 cell's method. States
 * plainly that p25/p75/p90 are calibrated estimates, not published
 * percentiles, and names the calibration samples.
 */
const SPREAD_DISCLOSURE =
  'Bands: p25/p75/p90 are not published percentiles for this level/metro. ' +
  'They equal the p50 anchor x calibrated spread factors ' +
  '(base x0.82/x1.24/x1.50; total x0.82/x1.26/x1.55). ' +
  'Factors calibrated on published pay distributions accessed 2026-09-24: ' +
  'Glassdoor base-pay percentiles for Meta SWE ' +
  '(US ~28.5k submissions: p25/avg 0.80, p75/avg 1.27, p90/avg 1.56; ' +
  'San Francisco ~106: 0.80/1.26/1.54; SWE-IV ~233: 0.82/1.23/1.48; ' +
  'IC5 Seattle ~25: 0.85/1.19/1.40) and Glassdoor total-pay typical ranges ' +
  '(Apple SWE San Francisco ~4.3k: p25/med 0.80, p75/med 1.28; ' +
  'Meta Senior SWE San Francisco ~1.1k: 0.82/1.26). ' +
  'Within-level spread is assumed to match the published pooled/role-wide spread; ' +
  'total-comp p90 (x1.55) is a modeled equity-driven upper tail.';

const round1k = (n: number): number => Math.round(n / 1000) * 1000;

type SourcedCellInput = {
  company: keyof typeof COMPANY_LEVEL_MAP;
  level: TBenchmarkLevel;
  metro: TBenchmarkMetro;
  /** Published base anchor (becomes base p50; kept exact). */
  baseAnchor: number;
  /** Published total-comp anchor (becomes totalComp p50; kept exact). */
  totalAnchor: number;
  source: string;
  sourceUrl?: string;
  accessDate: string;
  method: string;
  sampleBand: TSampleBand;
};

/**
 * Build a v2 cell from a published p50 anchor pair.
 * p50 stays exactly the published figure; p25/p75/p90 are the anchor x the
 * calibrated v2 spread factors, rounded to the nearest $1K.
 */
function sourcedCell(input: SourcedCellInput): TBenchmarkCell {
  const base: TPercentileBands = {
    p25: round1k(input.baseAnchor * BASE_SPREAD.p25),
    p50: input.baseAnchor,
    p75: round1k(input.baseAnchor * BASE_SPREAD.p75),
    p90: round1k(input.baseAnchor * BASE_SPREAD.p90),
  };
  const totalComp: TPercentileBands = {
    p25: round1k(input.totalAnchor * TOTAL_SPREAD.p25),
    p50: input.totalAnchor,
    p75: round1k(input.totalAnchor * TOTAL_SPREAD.p75),
    p90: round1k(input.totalAnchor * TOTAL_SPREAD.p90),
  };
  return BenchmarkCell.parse({
    company: input.company,
    companyLevel: COMPANY_LEVEL_MAP[input.company][input.level],
    level: input.level,
    metro: input.metro,
    base,
    totalComp,
    sampleBand: input.sampleBand,
    source: input.source,
    ...(input.sourceUrl ? { sourceUrl: input.sourceUrl } : {}),
    accessDate: input.accessDate,
    method: `${input.method} ${SPREAD_DISCLOSURE}`,
    confidence: 'sourced',
    spreadSource: 'sourced',
  });
}

// ---------------------------------------------------------------------------
// v2 cells — every anchor is a published public aggregate, accessed 2026-09-24
// ---------------------------------------------------------------------------

const CELLS: TBenchmarkCell[] = [
  // --- Meta, SF Bay Area (levels.fyi; ~14.0k Meta SWE submissions) ---
  ...(['Entry', 'Mid', 'Senior'] as const).map((level) => {
    const anchors = {
      Entry: { base: 145_000, total: 185_000 },
      Mid: { base: 186_000, total: 297_000 },
      Senior: { base: 228_000, total: 437_000 },
    }[level];
    return sourcedCell({
      company: 'Meta',
      level,
      metro: 'Bay Area',
      baseAnchor: anchors.base,
      totalAnchor: anchors.total,
      source: 'levels.fyi — Meta Software Engineer, San Francisco Bay Area',
      accessDate: '2026-09-24',
      method:
        'p50 = levels.fyi "Average Compensation By Level" row average for Meta SWE in SF Bay Area (E3/E4/E5 rows); ~14.0k Software Engineer submissions tracked at Meta.',
      sampleBand: '50+',
    });
  }),

  // --- Meta, Greater Seattle Area (levels.fyi, last updated 2026-09-24) ---
  ...(['Entry', 'Mid', 'Senior'] as const).map((level) => {
    const anchors = {
      Entry: { base: 132_000, total: 177_000 },
      Mid: { base: 183_000, total: 291_000 },
      Senior: { base: 219_000, total: 457_000 },
    }[level];
    return sourcedCell({
      company: 'Meta',
      level,
      metro: 'Seattle',
      baseAnchor: anchors.base,
      totalAnchor: anchors.total,
      source: 'levels.fyi — Meta Software Engineer, Greater Seattle Area',
      sourceUrl:
        'https://www.levels.fyi/companies/meta/salaries/software-engineer/locations/greater-seattle-area',
      accessDate: '2026-09-24',
      method:
        'p50 = levels.fyi "Average Compensation By Level" row average for Meta SWE in Greater Seattle Area (E3/E4/E5 rows); page reports 14,037 Meta SWE submissions, last updated 2026-09-24.',
      sampleBand: '50+',
    });
  }),

  // --- Meta, New York City Area (levels.fyi, last updated 2026-09-24) ---
  ...(['Entry', 'Mid', 'Senior'] as const).map((level) => {
    const anchors = {
      Entry: { base: 147_000, total: 180_000 },
      Mid: { base: 197_000, total: 307_000 },
      Senior: { base: 228_000, total: 453_000 },
    }[level];
    return sourcedCell({
      company: 'Meta',
      level,
      metro: 'NYC',
      baseAnchor: anchors.base,
      totalAnchor: anchors.total,
      source: 'levels.fyi — Meta Software Engineer, New York City Area',
      sourceUrl:
        'https://www.levels.fyi/companies/meta/salaries/software-engineer/locations/new-york-city-area',
      accessDate: '2026-09-24',
      method:
        'p50 = levels.fyi "Average Compensation By Level" row average for Meta SWE in New York City Area (E3/E4/E5 rows), last updated 2026-09-24.',
      sampleBand: '50+',
    });
  }),

  // --- Google, SF Bay Area (levels.fyi, last updated 2026-09-24; ~24.2k submissions) ---
  ...(['Entry', 'Mid', 'Senior'] as const).map((level) => {
    const anchors = {
      Entry: { base: 162_000, total: 209_000 },
      Mid: { base: 201_000, total: 315_000 },
      Senior: { base: 241_000, total: 461_000 },
    }[level];
    return sourcedCell({
      company: 'Google',
      level,
      metro: 'Bay Area',
      baseAnchor: anchors.base,
      totalAnchor: anchors.total,
      source: 'levels.fyi — Google Software Engineer, San Francisco Bay Area',
      sourceUrl:
        'https://www.levels.fyi/companies/google/salaries/software-engineer/locations/san-francisco-bay-area',
      accessDate: '2026-09-24',
      method:
        'p50 = levels.fyi "Average Compensation By Level" row average for Google SWE in SF Bay Area (L3/L4/L5 rows); ~24.2k Software Engineer submissions tracked at Google, last updated 2026-09-24.',
      sampleBand: '50+',
    });
  }),

  // --- Google, Greater Seattle Area (levels.fyi L3/L4 level pages) ---
  ...(
    [
      {
        level: 'Entry' as const,
        base: 153_143,
        total: 201_663,
        detail:
          'p50 = levels.fyi published "Average Annual Total Compensation" for Google L3 Software Engineer in Greater Seattle Area (base $153,143; total $201,663; ~3.8k SWE submissions).',
      },
      {
        level: 'Mid' as const,
        base: 181_278,
        total: 326_855,
        detail:
          'p50 = levels.fyi published "Average Annual Total Compensation" for Google L4 Software Engineer in Greater Seattle Area (base $181,278; total $326,855; ~7.2k SWE submissions).',
      },
    ]
  ).map(({ level, base, total, detail }) =>
    sourcedCell({
      company: 'Google',
      level,
      metro: 'Seattle',
      baseAnchor: base,
      totalAnchor: total,
      source: 'levels.fyi — Google Software Engineer, Greater Seattle Area',
      sourceUrl:
        level === 'Entry'
          ? 'https://www.levels.fyi/companies/google/salaries/software-engineer/levels/l3/locations/greater-seattle-area'
          : 'https://www.levels.fyi/companies/google/salaries/software-engineer/levels/l4/locations/greater-seattle-area',
      accessDate: '2026-09-24',
      method: detail,
      sampleBand: '50+',
    })
  ),

  // --- Google, NYC (levels.fyi) ---
  ...(['Entry', 'Mid', 'Senior'] as const).map((level) => {
    const anchors = {
      Entry: { base: 159_000, total: 200_000 },
      Mid: { base: 191_000, total: 281_000 },
      Senior: { base: 237_000, total: 397_000 },
    }[level];
    return sourcedCell({
      company: 'Google',
      level,
      metro: 'NYC',
      baseAnchor: anchors.base,
      totalAnchor: anchors.total,
      source: 'levels.fyi — Google Software Engineer, New York City Area',
      accessDate: '2026-09-24',
      method:
        'p50 = levels.fyi "Average Compensation By Level" row average for Google SWE in NYC Area (L3/L4/L5 rows); ~24.2k Software Engineer submissions tracked at Google.',
      sampleBand: '50+',
    });
  }),

  // --- Google, Austin (levels.fyi) ---
  ...(['Entry', 'Mid', 'Senior'] as const).map((level) => {
    const anchors = {
      Entry: { base: 160_000, total: 194_000 },
      Mid: { base: 167_000, total: 264_000 },
      Senior: { base: 194_000, total: 347_000 },
    }[level];
    return sourcedCell({
      company: 'Google',
      level,
      metro: 'Austin',
      baseAnchor: anchors.base,
      totalAnchor: anchors.total,
      source: 'levels.fyi — Google Software Engineer, Greater Austin Area',
      accessDate: '2026-09-24',
      method:
        'p50 = levels.fyi "Average Compensation By Level" row average for Google SWE in Greater Austin Area (L3/L4/L5 rows).',
      sampleBand: '50+',
    });
  }),

  // --- Apple, SF Bay Area (levels.fyi, last updated 2026-09-24; ~7.1k submissions) ---
  // Replaces the v1 illustrative Apple cells with sourced averages.
  ...(['Entry', 'Mid', 'Senior'] as const).map((level) => {
    const anchors = {
      Entry: { base: 150_000, total: 182_000 },
      Mid: { base: 177_000, total: 251_000 },
      Senior: { base: 216_000, total: 355_000 },
    }[level];
    return sourcedCell({
      company: 'Apple',
      level,
      metro: 'Bay Area',
      baseAnchor: anchors.base,
      totalAnchor: anchors.total,
      source: 'levels.fyi — Apple Software Engineer, San Francisco Bay Area',
      sourceUrl:
        'https://www.levels.fyi/companies/apple/salaries/software-engineer/locations/san-francisco-bay-area',
      accessDate: '2026-09-24',
      method:
        'p50 = levels.fyi "Average Compensation By Level" row average for Apple SWE in SF Bay Area (ICT2/ICT3/ICT4 rows); 7,138 SWE submissions tracked at Apple, last updated 2026-09-24.',
      sampleBand: '50+',
    });
  }),

  // --- Microsoft, Greater Seattle Area (levels.fyi, last updated 2026-09-24) ---
  // Replaces the v1 illustrative Microsoft cell. Generic Entry spans 59-60
  // and Mid spans 61-62, so p50 = mean of the two published level-row averages.
  sourcedCell({
    company: 'Microsoft',
    level: 'Entry',
    metro: 'Seattle',
    baseAnchor: (126_000 + 140_000) / 2,
    totalAnchor: (161_000 + 188_000) / 2,
    source: 'levels.fyi — Microsoft Software Engineer, Greater Seattle Area',
    sourceUrl:
      'https://www.levels.fyi/companies/microsoft/salaries/software-engineer/locations/greater-seattle-area?dma=819',
    accessDate: '2026-09-24',
    method:
      'p50 = mean of the levels.fyi published row averages for Microsoft SWE levels 59 and 60 in Greater Seattle Area (59: base $126k/total $161k; 60: base $140k/total $188k); ~20.7k SWE submissions tracked at Microsoft, last updated 2026-09-24. Averaging is documented because the generic Entry bucket spans 59-60.',
    sampleBand: '50+',
  }),
  sourcedCell({
    company: 'Microsoft',
    level: 'Mid',
    metro: 'Seattle',
    baseAnchor: (156_000 + 166_000) / 2,
    totalAnchor: (191_000 + 205_000) / 2,
    source: 'levels.fyi — Microsoft Software Engineer, Greater Seattle Area',
    sourceUrl:
      'https://www.levels.fyi/companies/microsoft/salaries/software-engineer/locations/greater-seattle-area?dma=819',
    accessDate: '2026-09-24',
    method:
      'p50 = mean of the levels.fyi published row averages for Microsoft SWE levels 61 and 62 in Greater Seattle Area (61: base $156k/total $191k; 62: base $166k/total $205k); ~20.7k SWE submissions tracked at Microsoft, last updated 2026-09-24. Averaging is documented because the generic Mid bucket spans 61-62.',
    sampleBand: '50+',
  }),

  // --- Palantir, Bay Area (GSDC 2026 FDE Salary Report; splits modeled) ---
  ...(['Entry', 'Mid', 'Senior'] as const).map((level) => {
    const anchors = {
      Entry: { base: 130_000, total: 190_000 },
      Mid: { base: 150_000, total: 245_000 },
      Senior: { base: 175_000, total: 325_000 },
    }[level];
    return sourcedCell({
      company: 'Palantir',
      level,
      metro: 'Bay Area',
      baseAnchor: anchors.base,
      totalAnchor: anchors.total,
      source:
        'GSDC 2026 FDE Salary Report (citing Levels.fyi May 2026, Glassdoor 2026, Blind)',
      accessDate: '2026-09-24',
      method:
        'p50 = GSDC 2026 report "Palantir — pay split" table (L3/L4/L5 modeled base+RSU+bonus). The report itself states splits are modeled; actual offers vary by team, location, and equity timing. Exact sample size undisclosed.',
      sampleBand: 'unknown',
    });
  }),

  // --- Stripe, Bay Area Senior (levels.fyi L4 Staff Engineer, SF Bay Area) ---
  sourcedCell({
    company: 'Stripe',
    level: 'Senior',
    metro: 'Bay Area',
    baseAnchor: 293_545, // reported $293,545
    totalAnchor: 786_461, // reported $786,461
    source:
      'levels.fyi — Stripe L4 (Staff Engineer) Software Engineer, San Francisco Bay Area',
    accessDate: '2026-09-24',
    method:
      'p50 = levels.fyi average annual total compensation for Stripe L4 Software Engineer in SF Bay Area (base $293,545; stock $436,825; bonus $56,091). Single-level aggregate; Stripe ladder is shifted (L4 = Staff), mapped to generic Senior.',
    sampleBand: 'unknown',
  }),
];

/** Validated dataset. Throws at import time if any cell is malformed. */
export const BENCHMARK_CELLS: TBenchmarkCell[] = z.array(BenchmarkCell).parse(CELLS);

export type DatasetFreshness = {
  version: string;
  newestAccessDate: string;
  ageDays: number;
  /** True when the newest access date is older than 180 days. */
  stale: boolean;
};

/** Freshness of the dataset as a whole, based on the newest cell access date. */
export function datasetFreshness(asOf: Date = new Date()): DatasetFreshness {
  const dates = BENCHMARK_CELLS.map((c) => c.accessDate).sort();
  const newestAccessDate = dates[dates.length - 1] ?? '1970-01-01';
  const ageDays = Math.max(
    0,
    Math.round(
      (asOf.getTime() - new Date(`${newestAccessDate}T00:00:00Z`).getTime()) / 86_400_000
    )
  );
  return { version: DATASET_VERSION, newestAccessDate, ageDays, stale: ageDays > 180 };
}

/** Short human label for a freshness age, e.g. "updated today" / "updated 12d ago". */
export function freshnessLabel(ageDays: number): string {
  if (ageDays <= 0) return 'updated today';
  if (ageDays === 1) return 'updated yesterday';
  if (ageDays < 30) return `updated ${ageDays}d ago`;
  const months = Math.round(ageDays / 30);
  return `updated ~${months}mo ago`;
}
