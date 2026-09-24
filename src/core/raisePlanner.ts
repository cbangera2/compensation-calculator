import { computeOffer, type YearRow } from './compute';
import type { TOffer } from '@/models/types';

/**
 * Raise planner / compensation trajectory model.
 *
 * KEY ASSUMPTIONS (all projections, not predictions):
 *
 * 1. SCENARIO RAISES REPLACE THE OFFER'S MODELED RAISES. `offer.raises`
 *    (the individual raises a user adds via the Raises editor) are ignored
 *    here. Each scenario defines its own full raise schedule so results don't
 *    double-count. This is intentional and disclosed in the UI.
 *
 * 2. EXISTING EQUITY FOLLOWS THE REAL VEST SCHEDULE. We re-run
 *    `computeOffer` on a copy of the offer, so stock income in later years is
 *    exactly what the actual vest calendar produces — it drops to zero once
 *    grants finish vesting. We do NOT flat-extend it, because that would hide
 *    the post-vesting cliff that makes refresh grants matter.
 *
 * 3. REFRESH GRANTS ARE MODELED FLAT. Each year's `refreshGrantAnnual` is
 *    treated as a grant made at the start of that year, vesting evenly over
 *    4 years with no stock-price growth assumed. Existing grants keep the
 *    offer's own growth settings (offer.growth); refresh grants do not.
 */

export type TrajectoryScenario = {
  /** Display name, e.g. "Steady 4%" */
  name: string;
  /** Annual base raise, e.g. 0.08 for 8%. Applied at the start of years 2..N. */
  annualRaisePct: number;
  /** New refresh grant value per year in dollars (grant-date value). */
  refreshGrantAnnual: number;
  /** Optional 1-based year when a one-time promotion bump lands. */
  promoYear?: number;
  /** One-time base bump at promoYear, e.g. 0.15 for 15%. */
  promoBumpPct?: number;
};

export type TrajectoryRow = YearRow & {
  /** Value realized from modeled refresh grants this year. */
  refresh: number;
};

export type TrajectoryResult = {
  scenario: TrajectoryScenario;
  rows: TrajectoryRow[];
};

const REFRESH_VEST_YEARS = 4;

/**
 * Add whole years to a YYYY-MM-DD string with pure string arithmetic.
 * We deliberately avoid `new Date(iso)` here: YYYY-MM-DD parses as UTC
 * midnight, and formatting back in local time shifts the date a day early
 * for negative UTC offsets (e.g. America/Detroit), which leaked a day of
 * each annual raise into the prior year.
 */
export function addYearsToIso(iso: string, years: number): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) throw new Error(`invalid date: ${iso}`);
  const y = Number(m[1]) + years;
  return `${y}-${m[2]}-${m[3]}`;
}

function validateScenario(s: TrajectoryScenario): void {
  if (!s.name.trim()) throw new Error('Scenario name is required');
  if (!Number.isFinite(s.annualRaisePct) || s.annualRaisePct < -1 || s.annualRaisePct > 5) {
    throw new Error(`Invalid annualRaisePct for scenario "${s.name}": must be between -1 and 5`);
  }
  if (!Number.isFinite(s.refreshGrantAnnual) || s.refreshGrantAnnual < 0) {
    throw new Error(`Invalid refreshGrantAnnual for scenario "${s.name}": must be >= 0`);
  }
  const bump = s.promoBumpPct ?? 0;
  if (!Number.isFinite(bump) || bump < -1 || bump > 5) {
    throw new Error(`Invalid promoBumpPct for scenario "${s.name}": must be between -1 and 5`);
  }
}

function clampHorizon(horizonYears: number): number {
  if (!Number.isFinite(horizonYears)) return 5;
  return Math.min(30, Math.max(1, Math.round(horizonYears)));
}

/**
 * Annual refresh income per year: each year's grant vests evenly over
 * REFRESH_VEST_YEARS years starting that same year.
 */
export function refreshIncomePerYear(refreshGrantAnnual: number, horizonYears: number): number[] {
  const perYearShare = refreshGrantAnnual / REFRESH_VEST_YEARS;
  return Array.from({ length: horizonYears }, (_, y) => {
    let sum = 0;
    for (let g = 0; g <= y; g++) {
      if (y - g < REFRESH_VEST_YEARS) sum += perYearShare;
    }
    return sum;
  });
}

/**
 * Project one scenario over `horizonYears` years (default 5).
 * Year numbers are 1-based and relative to offer.startDate.
 */
export function projectTrajectory(
  offer: TOffer,
  scenario: TrajectoryScenario,
  horizonYears = 5,
): TrajectoryResult {
  validateScenario(scenario);
  const N = clampHorizon(horizonYears);

  const raises: TOffer['raises'] = [];
  // Annual raise applies at the start of each subsequent year.
  for (let y = 2; y <= N; y++) {
    raises.push({
      effectiveDate: addYearsToIso(offer.startDate, y - 1),
      type: 'percent' as const,
      value: scenario.annualRaisePct,
    });
  }
  // Promotion bump lands at the start of promoYear (1-based), if in range.
  const promoYear = scenario.promoYear ?? 0;
  const promoBump = scenario.promoBumpPct ?? 0;
  if (promoYear >= 1 && promoYear <= N && promoBump !== 0) {
    raises.push({
      effectiveDate: addYearsToIso(offer.startDate, promoYear - 1),
      type: 'percent' as const,
      value: promoBump,
    });
  }

  // Run the real engine on a copy: scenario raises replace offer.raises.
  const scoped: TOffer = {
    ...offer,
    raises,
    assumptions: { ...(offer.assumptions ?? {}), horizonYears: N } as TOffer['assumptions'],
  };
  const baseRows = computeOffer(scoped);
  const refreshRows = refreshIncomePerYear(scenario.refreshGrantAnnual, N);

  const rows: TrajectoryRow[] = baseRows.map((r, i) => {
    const refresh = refreshRows[i] ?? 0;
    return { ...r, refresh, total: r.total + refresh };
  });
  return { scenario, rows };
}

/** Plain-English summary line for a projected scenario. */
export function summarizeScenario(result: TrajectoryResult): string {
  const { scenario, rows } = result;
  const last = rows[rows.length - 1];
  if (!last) return `${scenario.name}: no years projected`;
  const raisePct = Math.round(scenario.annualRaisePct * 100);
  const refreshPart =
    scenario.refreshGrantAnnual > 0
      ? ` + ${fmtMoney(Math.round(scenario.refreshGrantAnnual))}/yr refresh`
      : '';
  const promoPart =
    scenario.promoYear && scenario.promoBumpPct
      ? `, ${Math.round(scenario.promoBumpPct * 100)}% promo in Y${scenario.promoYear}`
      : '';
  return `At ${raisePct}%/yr${refreshPart}${promoPart}, Year ${last.year} ≈ ${fmtMoney(Math.round(last.total))} total comp (projected)`;
}

function fmtMoney(n: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(n);
}

export type ScenarioComparison = {
  years: number[];
  series: { name: string; totals: number[]; rows: TrajectoryRow[] }[];
};

/** Project 1..n scenarios and align their year rows for charting. */
export function compareScenarios(
  offer: TOffer,
  scenarios: TrajectoryScenario[],
  horizonYears = 5,
): ScenarioComparison {
  if (!scenarios.length) throw new Error('compareScenarios requires at least one scenario');
  const N = clampHorizon(horizonYears);
  const results = scenarios.map((s) => projectTrajectory(offer, s, N));
  return {
    years: results[0].rows.map((r) => r.year),
    series: results.map((r) => ({
      name: r.scenario.name,
      totals: r.rows.map((row) => row.total),
      rows: r.rows,
    })),
  };
}
