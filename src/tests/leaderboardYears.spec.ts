import { describe, expect, it } from 'vitest';
import {
  GRANT_DATE_ASSUMPTION,
  GRANT_DATE_BY_YEAR,
  LEADERBOARD_2024,
  LEADERBOARD_BY_YEAR,
  LEADERBOARD_YEARS,
} from '../data/leaderboard2024';

describe('leaderboard year keying', () => {
  it('exposes exactly the 2024/2025/2026 tabs, defaulting to 2024', () => {
    expect([...LEADERBOARD_YEARS]).toEqual(['2024', '2025', '2026']);
    expect(LEADERBOARD_YEARS[0]).toBe('2024');
  });

  it('files the full 2024 dataset under the 2024 year', () => {
    expect(LEADERBOARD_BY_YEAR['2024']).toBe(LEADERBOARD_2024);
    expect(LEADERBOARD_BY_YEAR['2024'].length).toBeGreaterThan(0);
  });

  it('files 8 estimate 2025 rows and 28 estimate 2026 rows under their years', () => {
    const y25 = LEADERBOARD_BY_YEAR['2025'];
    const y26 = LEADERBOARD_BY_YEAR['2026'];
    expect(y25).toHaveLength(8);
    expect(y26).toHaveLength(28);
    // 2025 rows are the same levels.fyi all-years aggregates as 2026, filed
    // under the 2025 grant date; no 2025-anchored aggregates exist.
    for (const e of y25) {
      expect(e.grantDate).toBe('2025-08-01');
      expect(e.confidence).toBe('estimate');
      expect(e.sampleBand).toBe('50+');
      expect(e.source.toLowerCase()).toContain('levels.fyi');
      expect(e.sourceUrl).toContain('levels.fyi');
    }
    for (const e of y26) {
      expect(e.grantDate).toBe('2026-08-01');
      expect(e.confidence).toBe('estimate');
    }
    // No invented companies: Palantir/Perplexity/Mercor/Figure AI have no
    // defensible 2025/2026 aggregate and stay absent; Canva is A$-only.
    for (const missing of ['Palantir', 'Perplexity', 'Mercor', 'Figure AI', 'Canva']) {
      expect(y25.some((e) => e.company === missing)).toBe(false);
      expect(y26.some((e) => e.company === missing)).toBe(false);
    }
    // Applied Intuition appears in 2026 via its PUBLIC aggregate only.
    const ai26 = y26.find((e) => e.company === 'Applied Intuition')!;
    expect(ai26).toBeDefined();
    expect(ai26.base).toBe(145000);
    expect(ai26.stockGrantTotal4yr).toBe(246400);
    const hay = JSON.stringify(ai26).toLowerCase();
    for (const leak of ['136.39', '149.24', '31.09', '37.50', 'chirag', 'bangera', 'token=']) {
      expect(hay).not.toContain(leak);
    }
  });

  it('defines a canonical grant-date assumption per year', () => {
    expect(GRANT_DATE_BY_YEAR['2024']).toBe(GRANT_DATE_ASSUMPTION);
    expect(GRANT_DATE_BY_YEAR['2025']).toBe('2025-08-01');
    expect(GRANT_DATE_BY_YEAR['2026']).toBe('2026-08-01');
  });

  it('requires every entry to use its year’s canonical grant date', () => {
    for (const y of LEADERBOARD_YEARS) {
      for (const e of LEADERBOARD_BY_YEAR[y]) {
        expect(e.grantDate).toBe(GRANT_DATE_BY_YEAR[y]);
      }
    }
  });

  it('covers every tab in the year-keyed record', () => {
    expect(Object.keys(LEADERBOARD_BY_YEAR).sort()).toEqual([...LEADERBOARD_YEARS].sort());
  });
});
