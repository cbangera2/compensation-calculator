import {
  BENCHMARK_CELLS,
  BENCHMARK_COMPANIES,
  BENCHMARK_LEVELS,
  BENCHMARK_METROS,
  COMPANY_LEVEL_MAP,
  DATASET_VERSION,
  LAST_VERIFIED,
  type TBenchmarkCell,
  type TBenchmarkLevel,
  type TBenchmarkMetro,
  type TPercentileBands,
} from '@/data/benchmarks.v2';

/**
 * Benchmark lookup and percentile math.
 *
 * Pure functions only — no React, no store access. All inputs are plain
 * numbers/strings so this module is trivially unit-testable.
 */

export type CellLookup =
  | { cell: TBenchmarkCell; rolledUpFrom: null }
  | { cell: TBenchmarkCell; rolledUpFrom: TBenchmarkMetro };

/** Metro preference order used when the exact metro has no cell. */
const METRO_FALLBACK_ORDER: TBenchmarkMetro[] = [
  'Bay Area',
  'NYC',
  'Seattle',
  'Austin',
  'DC',
  'Detroit/Ann Arbor',
];

/**
 * Find the benchmark cell for a company x level x metro.
 * Falls back to the same company x level in another metro (Bay Area first)
 * when the exact metro is missing. Returns null when the company x level has
 * no data at all — callers should render "insufficient data", never invent.
 */
export function findCell(
  company: string,
  level: TBenchmarkLevel,
  metro: TBenchmarkMetro
): CellLookup | null {
  const exact = BENCHMARK_CELLS.find(
    (c) => c.company === company && c.level === level && c.metro === metro
  );
  if (exact) return { cell: exact, rolledUpFrom: null };

  for (const fallback of METRO_FALLBACK_ORDER) {
    if (fallback === metro) continue;
    const cell = BENCHMARK_CELLS.find(
      (c) => c.company === company && c.level === level && c.metro === fallback
    );
    if (cell) return { cell, rolledUpFrom: cell.metro };
  }
  return null;
}

/**
 * Estimate the percentile rank of `value` within percentile bands via
 * piecewise-linear interpolation between the (p25, p50, p75, p90) anchors.
 *
 * Values below p25 extrapolate along the p25–p50 segment (floored at 1);
 * values above p90 extrapolate along the p75–p90 segment (capped at 99).
 * Returns an integer in [1, 99]; returns 50 when bands are degenerate.
 */
export function percentileForValue(bands: TPercentileBands, value: number): number {
  if (!Number.isFinite(value)) return 0;
  const points: Array<[number, number]> = [
    [bands.p25, 25],
    [bands.p50, 50],
    [bands.p75, 75],
    [bands.p90, 90],
  ];

  const lerp = (x0: number, y0: number, x1: number, y1: number, x: number): number => {
    if (x1 === x0) return (y0 + y1) / 2;
    return y0 + ((x - x0) / (x1 - x0)) * (y1 - y0);
  };

  if (value <= bands.p25) {
    const [x0, y0] = points[0];
    const [x1, y1] = points[1];
    return Math.max(1, Math.round(lerp(x0, y0, x1, y1, value)));
  }
  if (value >= bands.p90) {
    const [x0, y0] = points[2];
    const [x1, y1] = points[3];
    return Math.min(99, Math.round(lerp(x0, y0, x1, y1, value)));
  }
  for (let i = 0; i < points.length - 1; i += 1) {
    const [x0, y0] = points[i];
    const [x1, y1] = points[i + 1];
    if (value >= x0 && value <= x1) {
      return Math.round(lerp(x0, y0, x1, y1, value));
    }
  }
  return 50;
}

/**
 * Compa-ratio: value as a fraction of the p50 anchor.
 * 1.0 = exactly at p50. Returns 0 for invalid inputs.
 */
export function compaRatio(value: number, p50: number): number {
  if (!Number.isFinite(value) || !Number.isFinite(p50) || p50 <= 0) return 0;
  return Math.max(0, value / p50);
}

/**
 * Range penetration: how far through the band a value sits,
 * (value - bandMin) / (bandMax - bandMin).
 *
 * The dataset publishes no min/max — only p25..p90 — so p25 is used as the
 * band floor and p90 as the band ceiling. This is a modeling choice, not a
 * published range: true offer ranges extend beyond these anchors.
 *
 * Returns a ratio in [0, 1] (clamped: below p25 -> 0, above p90 -> 1).
 * 0.62 = "62% through the band". Returns 0 for invalid or degenerate bands.
 */
export function rangePenetration(value: number, bands: TPercentileBands): number {
  const { p25, p90 } = bands;
  if (!Number.isFinite(value) || !Number.isFinite(p25) || !Number.isFinite(p90)) return 0;
  const span = p90 - p25;
  if (span <= 0) return 0;
  return Math.min(1, Math.max(0, (value - p25) / span));
}

/** All companies present in the level map (some may have no cells yet). */
export function benchmarkCompanies(): string[] {
  return [...BENCHMARK_COMPANIES];
}

/** Generic levels offered by the dataset. */
export function benchmarkLevels(): TBenchmarkLevel[] {
  return [...BENCHMARK_LEVELS];
}

/** Metros offered by the dataset. */
export function benchmarkMetros(): TBenchmarkMetro[] {
  return [...BENCHMARK_METROS];
}

/** Company-specific level label for a generic level, e.g. Meta + Mid -> "E4". */
export function companyLevelLabel(company: string, level: TBenchmarkLevel): string {
  return COMPANY_LEVEL_MAP[company]?.[level] ?? level;
}

/** True when at least one cell exists for the company x level (any metro). */
export function hasBenchmarkData(company: string, level: TBenchmarkLevel): boolean {
  return BENCHMARK_CELLS.some((c) => c.company === company && c.level === level);
}

/** All cells for one company (any level/metro), for overview UIs. */
export function cellsForCompany(company: string): TBenchmarkCell[] {
  return BENCHMARK_CELLS.filter((c) => c.company === company);
}

/**
 * Dataset version metadata: the dataset version string plus the last date
 * any cell was verified against its source.
 */
export function datasetVersion(): { version: string; lastVerified: string } {
  return { version: DATASET_VERSION, lastVerified: LAST_VERIFIED };
}

/** Whole days between a cell's access date and `now`. */
export function cellAgeDays(cell: TBenchmarkCell, now: Date = new Date()): number {
  const accessed = new Date(`${cell.accessDate}T00:00:00Z`).getTime();
  return Math.max(0, Math.floor((now.getTime() - accessed) / 86_400_000));
}

/**
 * True when a cell's access date is older than 12 months (365 days).
 * Stale cells should be re-verified or badged as outdated in the UI —
 * they are not silently dropped, so historical comparisons keep working.
 */
export function isCellStale(cell: TBenchmarkCell, now: Date = new Date()): boolean {
  return cellAgeDays(cell, now) > 365;
}

/**
 * Describe where a value sits relative to bands in plain words,
 * e.g. "around p50", "between p50 and p75", "above p90".
 */
export function bandPositionLabel(bands: TPercentileBands, value: number): string {
  if (value < bands.p25) return 'below p25';
  if (value < bands.p50) return 'between p25 and p50';
  if (value === bands.p50) return 'at p50';
  if (value < bands.p75) return 'between p50 and p75';
  if (value < bands.p90) return 'between p75 and p90';
  return 'above p90';
}
