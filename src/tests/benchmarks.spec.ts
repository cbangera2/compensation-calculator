import { describe, it, expect } from 'vitest';
import {
  findCell,
  percentileForValue,
  compaRatio,
  rangePenetration,
  benchmarkCompanies,
  companyLevelLabel,
  hasBenchmarkData,
  bandPositionLabel,
  datasetVersion,
  cellAgeDays,
  isCellStale,
} from '@/core/benchmarks';
import {
  BENCHMARK_CELLS,
  DATASET_VERSION,
  LAST_VERIFIED,
  datasetFreshness,
} from '@/data/benchmarks.v2';
import type { TBenchmarkCell, TPercentileBands } from '@/data/benchmarks.v2';

const BANDS: TPercentileBands = { p25: 100_000, p50: 150_000, p75: 200_000, p90: 260_000 };

const NOW = new Date('2026-09-24T12:00:00Z');

function cellAt(company: string, level: string, metro: string): TBenchmarkCell {
  const cell = BENCHMARK_CELLS.find(
    (c) => c.company === company && c.level === level && c.metro === metro
  );
  if (!cell) throw new Error(`missing cell ${company} ${level} ${metro}`);
  return cell;
}

describe('dataset version metadata', () => {
  it('is versioned as v2 with a valid last-verified date', () => {
    expect(DATASET_VERSION).toMatch(/^v2\./);
    expect(LAST_VERIFIED).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(new Date(`${LAST_VERIFIED}T00:00:00Z`).getTime()).not.toBeNaN();
  });

  it('exposes version metadata through the core datasetVersion()', () => {
    expect(datasetVersion()).toEqual({
      version: DATASET_VERSION,
      lastVerified: LAST_VERIFIED,
    });
  });
});

describe('isCellStale / cellAgeDays', () => {
  it('treats a freshly verified cell as not stale', () => {
    const cell = { ...BENCHMARK_CELLS[0], accessDate: '2026-09-24' };
    expect(cellAgeDays(cell, NOW)).toBe(0);
    expect(isCellStale(cell, NOW)).toBe(false);
  });

  it('treats a cell older than 12 months as stale', () => {
    const cell = { ...BENCHMARK_CELLS[0], accessDate: '2025-06-01' };
    expect(cellAgeDays(cell, NOW)).toBeGreaterThan(365);
    expect(isCellStale(cell, NOW)).toBe(true);
  });

  it('is not stale at exactly 365 days, stale at 366', () => {
    const at365 = { ...BENCHMARK_CELLS[0], accessDate: '2025-09-24' };
    expect(cellAgeDays(at365, NOW)).toBe(365);
    expect(isCellStale(at365, NOW)).toBe(false);

    const at366 = { ...BENCHMARK_CELLS[0], accessDate: '2025-09-23' };
    expect(cellAgeDays(at366, NOW)).toBe(366);
    expect(isCellStale(at366, NOW)).toBe(true);
  });

  it('never reports negative ages for future access dates', () => {
    const cell = { ...BENCHMARK_CELLS[0], accessDate: '2026-09-25' };
    expect(cellAgeDays(cell, NOW)).toBe(0);
    expect(isCellStale(cell, NOW)).toBe(false);
  });

  it('all shipped v2 cells are fresh as of the verification date', () => {
    for (const cell of BENCHMARK_CELLS) {
      expect(isCellStale(cell, NOW)).toBe(false);
    }
  });
});

describe('findCell', () => {
  it('finds an exact company x level x metro cell', () => {
    const hit = findCell('Meta', 'Mid', 'Bay Area');
    expect(hit).not.toBeNull();
    expect(hit?.cell.company).toBe('Meta');
    expect(hit?.cell.level).toBe('Mid');
    expect(hit?.cell.metro).toBe('Bay Area');
    expect(hit?.cell.companyLevel).toBe('E4');
    expect(hit?.rolledUpFrom).toBeNull();
  });

  it('finds new v2 cells (Meta Seattle, Google Bay Area, Apple Bay Area)', () => {
    const meta = findCell('Meta', 'Mid', 'Seattle');
    expect(meta?.cell.companyLevel).toBe('E4');
    expect(meta?.cell.base.p50).toBe(183_000);
    expect(meta?.rolledUpFrom).toBeNull();

    const google = findCell('Google', 'Senior', 'Bay Area');
    expect(google?.cell.companyLevel).toBe('L5');
    expect(google?.cell.totalComp.p50).toBe(461_000);
    expect(google?.rolledUpFrom).toBeNull();

    const apple = findCell('Apple', 'Entry', 'Bay Area');
    expect(apple?.cell.companyLevel).toBe('ICT2');
    expect(apple?.cell.base.p50).toBe(150_000);
    expect(apple?.rolledUpFrom).toBeNull();
  });

  it('rolls up to another metro when the exact metro is missing', () => {
    // Google Senior has no Seattle cell in v2; Bay Area is the fallback.
    const hit = findCell('Google', 'Senior', 'Seattle');
    expect(hit).not.toBeNull();
    expect(hit?.rolledUpFrom).toBe('Bay Area');
    expect(hit?.cell.metro).toBe('Bay Area');
    expect(hit?.cell.companyLevel).toBe('L5');

    // Apple Senior has no NYC cell; falls back to sourced Bay Area.
    const apple = findCell('Apple', 'Senior', 'NYC');
    expect(apple?.rolledUpFrom).toBe('Bay Area');
    expect(apple?.cell.companyLevel).toBe('ICT4');
  });

  it('returns null when the company x level has no data at all', () => {
    expect(findCell('SpaceX', 'Entry', 'Bay Area')).toBeNull();
    // Microsoft Senior (63-64) Seattle has no published anchor in v2.
    expect(findCell('Microsoft', 'Senior', 'Seattle')).toBeNull();
    expect(findCell('Meta', 'Entry', 'Bay Area')).not.toBeNull();
  });
});

describe('percentileForValue', () => {
  it('returns anchor percentiles exactly', () => {
    expect(percentileForValue(BANDS, 100_000)).toBe(25);
    expect(percentileForValue(BANDS, 150_000)).toBe(50);
    expect(percentileForValue(BANDS, 200_000)).toBe(75);
    expect(percentileForValue(BANDS, 260_000)).toBe(90);
  });

  it('interpolates linearly between anchors', () => {
    // Midpoint of p25..p50 -> ~37/38
    const mid = percentileForValue(BANDS, 125_000);
    expect(mid).toBeGreaterThanOrEqual(37);
    expect(mid).toBeLessThanOrEqual(38);
    // Midpoint of p50..p75 -> ~62/63
    const mid2 = percentileForValue(BANDS, 175_000);
    expect(mid2).toBeGreaterThanOrEqual(62);
    expect(mid2).toBeLessThanOrEqual(63);
  });

  it('extrapolates below p25 with a floor of 1', () => {
    const p = percentileForValue(BANDS, 50_000);
    expect(p).toBeLessThan(25);
    expect(p).toBeGreaterThanOrEqual(1);
    expect(percentileForValue(BANDS, -1_000_000)).toBe(1);
  });

  it('extrapolates above p90 with a cap of 99', () => {
    const p = percentileForValue(BANDS, 400_000);
    expect(p).toBeGreaterThan(90);
    expect(p).toBeLessThanOrEqual(99);
    expect(percentileForValue(BANDS, 10_000_000)).toBe(99);
  });

  it('handles degenerate (equal) bands without NaN', () => {
    const flat: TPercentileBands = { p25: 100_000, p50: 100_000, p75: 100_000, p90: 100_000 };
    const p = percentileForValue(flat, 100_000);
    expect(Number.isFinite(p)).toBe(true);
  });

  it('returns 0 for non-finite values', () => {
    expect(percentileForValue(BANDS, NaN)).toBe(0);
  });

  it('ranks a value at a v2 cell p50 as 50', () => {
    const cell = cellAt('Meta', 'Senior', 'Bay Area');
    expect(percentileForValue(cell.totalComp, cell.totalComp.p50)).toBe(50);
  });
});

describe('compaRatio', () => {
  it('is 1.0 at p50', () => {
    expect(compaRatio(150_000, 150_000)).toBe(1);
  });

  it('scales proportionally', () => {
    expect(compaRatio(75_000, 150_000)).toBe(0.5);
    expect(compaRatio(300_000, 150_000)).toBe(2);
  });

  it('returns 0 for invalid inputs', () => {
    expect(compaRatio(100_000, 0)).toBe(0);
    expect(compaRatio(100_000, -5)).toBe(0);
    expect(compaRatio(NaN, 150_000)).toBe(0);
  });

  it('clamps negative values to 0', () => {
    expect(compaRatio(-10_000, 150_000)).toBe(0);
  });
});

describe('lookup helpers', () => {
  it('lists the ten north-star companies', () => {
    const companies = benchmarkCompanies();
    for (const name of ['Meta', 'Google', 'Apple', 'Microsoft', 'Bloomberg', 'Stripe', 'SpaceX', 'Tesla', 'Anduril', 'Palantir']) {
      expect(companies).toContain(name);
    }
  });

  it('maps generic levels to company labels', () => {
    expect(companyLevelLabel('Meta', 'Entry')).toBe('E3');
    expect(companyLevelLabel('Meta', 'Senior')).toBe('E5');
    expect(companyLevelLabel('Google', 'Mid')).toBe('L4');
    expect(companyLevelLabel('Microsoft', 'Entry')).toBe('59–60');
    expect(companyLevelLabel('Stripe', 'Senior')).toBe('L4 (Staff)');
  });

  it('reports data availability honestly', () => {
    expect(hasBenchmarkData('Meta', 'Mid')).toBe(true);
    expect(hasBenchmarkData('Apple', 'Entry')).toBe(true);
    expect(hasBenchmarkData('Microsoft', 'Entry')).toBe(true);
    expect(hasBenchmarkData('Microsoft', 'Senior')).toBe(false);
    expect(hasBenchmarkData('SpaceX', 'Entry')).toBe(false);
  });

  it('labels band positions in plain words', () => {
    expect(bandPositionLabel(BANDS, 50_000)).toBe('below p25');
    expect(bandPositionLabel(BANDS, 120_000)).toBe('between p25 and p50');
    expect(bandPositionLabel(BANDS, 150_000)).toBe('at p50');
    expect(bandPositionLabel(BANDS, 180_000)).toBe('between p50 and p75');
    expect(bandPositionLabel(BANDS, 230_000)).toBe('between p75 and p90');
    expect(bandPositionLabel(BANDS, 300_000)).toBe('above p90');
  });
});

describe('v2 dataset integrity', () => {
  it('ships 29 cells, all sourced with calibrated spreads', () => {
    expect(BENCHMARK_CELLS).toHaveLength(29);
    for (const cell of BENCHMARK_CELLS) {
      expect(cell.confidence).toBe('sourced');
      expect(cell.spreadSource).toBe('sourced');
    }
  });

  it('has no illustrative cells left', () => {
    const illustrative = BENCHMARK_CELLS.filter(
      (c) => c.confidence === 'illustrative'
    );
    expect(illustrative).toHaveLength(0);
  });

  it('keeps every band ordered p25 <= p50 <= p75 <= p90', () => {
    for (const cell of BENCHMARK_CELLS) {
      expect(cell.base.p25).toBeLessThanOrEqual(cell.base.p50);
      expect(cell.base.p50).toBeLessThanOrEqual(cell.base.p75);
      expect(cell.base.p75).toBeLessThanOrEqual(cell.base.p90);
      expect(cell.totalComp.p25).toBeLessThanOrEqual(cell.totalComp.p50);
      expect(cell.totalComp.p50).toBeLessThanOrEqual(cell.totalComp.p75);
      expect(cell.totalComp.p75).toBeLessThanOrEqual(cell.totalComp.p90);
    }
  });

  it('rounds band edges to the nearest $1K', () => {
    for (const cell of BENCHMARK_CELLS) {
      for (const b of [cell.base, cell.totalComp]) {
        for (const v of [b.p25, b.p75, b.p90]) {
          expect(v % 1000).toBe(0);
        }
      }
    }
  });

  it('anchors p50 on the exact published figures', () => {
    expect(cellAt('Meta', 'Mid', 'Seattle').base.p50).toBe(183_000);
    expect(cellAt('Meta', 'Mid', 'Seattle').totalComp.p50).toBe(291_000);
    expect(cellAt('Google', 'Senior', 'Bay Area').totalComp.p50).toBe(461_000);
    expect(cellAt('Google', 'Entry', 'Seattle').base.p50).toBe(153_143);
    expect(cellAt('Apple', 'Senior', 'Bay Area').totalComp.p50).toBe(355_000);
    expect(cellAt('Microsoft', 'Entry', 'Seattle').base.p50).toBe(133_000);
    expect(cellAt('Microsoft', 'Mid', 'Seattle').totalComp.p50).toBe(198_000);
    expect(cellAt('Stripe', 'Senior', 'Bay Area').totalComp.p50).toBe(786_461);
    expect(cellAt('Palantir', 'Mid', 'Bay Area').base.p50).toBe(150_000);
  });

  it('derives bands from the calibrated v2 spread factors', () => {
    // Meta Bay Area Senior: base p50 228k, total p50 437k.
    const cell = cellAt('Meta', 'Senior', 'Bay Area');
    // base: x0.82 / x1.24 / x1.50
    expect(cell.base.p25).toBe(Math.round((228_000 * 0.82) / 1000) * 1000);
    expect(cell.base.p75).toBe(Math.round((228_000 * 1.24) / 1000) * 1000);
    expect(cell.base.p90).toBe(Math.round((228_000 * 1.5) / 1000) * 1000);
    // total: x0.82 / x1.26 / x1.55
    expect(cell.totalComp.p25).toBe(Math.round((437_000 * 0.82) / 1000) * 1000);
    expect(cell.totalComp.p75).toBe(Math.round((437_000 * 1.26) / 1000) * 1000);
    expect(cell.totalComp.p90).toBe(Math.round((437_000 * 1.55) / 1000) * 1000);
  });

  it('discloses the calibrated spread method on every cell', () => {
    for (const cell of BENCHMARK_CELLS) {
      expect(cell.method).toMatch(/calibrated spread factors/);
      expect(cell.method).toMatch(/not published percentiles/);
      expect(cell.source.length).toBeGreaterThan(0);
      expect(cell.accessDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });

  it('never ships private-company rows (Applied Intuition stays local)', () => {
    const blob = JSON.stringify(BENCHMARK_CELLS).toLowerCase();
    expect(blob).not.toContain('applied intuition');
    expect(BENCHMARK_CELLS.some((c) => /applied/i.test(c.company))).toBe(false);
  });

  it('covers the new v2 company/metro combos', () => {
    const combos = new Set(
      BENCHMARK_CELLS.map((c) => `${c.company}|${c.metro}`)
    );
    for (const combo of [
      'Meta|Seattle',
      'Meta|NYC',
      'Google|Bay Area',
      'Google|Seattle',
      'Apple|Bay Area',
      'Microsoft|Seattle',
    ]) {
      expect(combos.has(combo)).toBe(true);
    }
  });

  it('reports freshness with a version and non-negative age', () => {
    const f = datasetFreshness(new Date('2026-09-24T00:00:00Z'));
    expect(f.version).toBe(DATASET_VERSION);
    expect(f.newestAccessDate).toBe('2026-09-24');
    expect(f.ageDays).toBe(0);
    expect(f.stale).toBe(false);
  });
});

describe('rangePenetration', () => {
  it('is 0 at the p25 floor and 1 at the p90 ceiling', () => {
    expect(rangePenetration(100_000, BANDS)).toBe(0);
    expect(rangePenetration(260_000, BANDS)).toBe(1);
  });

  it('is 0.5 at the band midpoint', () => {
    expect(rangePenetration(180_000, BANDS)).toBe(0.5);
  });

  it('clamps out-of-band values to [0, 1]', () => {
    expect(rangePenetration(50_000, BANDS)).toBe(0);
    expect(rangePenetration(400_000, BANDS)).toBe(1);
  });

  it('uses p25/p90 as the band edges, not p50', () => {
    // p50 sits at 31.25% through the p25..p90 span, not 50%
    expect(rangePenetration(150_000, BANDS)).toBeCloseTo(50_000 / 160_000, 10);
  });

  it('returns 0 for invalid or degenerate bands', () => {
    expect(rangePenetration(NaN, BANDS)).toBe(0);
    expect(rangePenetration(150_000, { ...BANDS, p25: NaN })).toBe(0);
    expect(rangePenetration(150_000, { ...BANDS, p25: 200_000, p90: 200_000 })).toBe(0);
    expect(rangePenetration(150_000, { ...BANDS, p25: 260_000, p90: 100_000 })).toBe(0);
  });
});
