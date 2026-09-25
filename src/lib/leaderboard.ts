import type { TLeaderboardEntry } from '@/data/leaderboard2024';
import { STARTUP_LEADERBOARD, type TStartupEntry } from '@/data/startupLeaderboard2024';
import type { MonthlyClose } from './market';

/**
 * Pure realized-value math for the 2024 new-grad leaderboard.
 * Price fetching lives in the component; everything here is unit-testable.
 */

export interface GrantPricePoints {
  /** Monthly close nearest the grant date. */
  priceAtGrant: number;
  /** Most recent monthly close. */
  priceNow: number;
  /** The monthly-close date used as the grant anchor, YYYY-MM-DD. */
  grantAnchorDate: string;
  /** The most recent monthly-close date, YYYY-MM-DD. */
  asOfDate: string;
}

type EntryNumbers = Pick<
  TLeaderboardEntry,
  'ticker' | 'base' | 'signingBonus' | 'stockGrantTotal4yr'
>;

/** True when the entry carries an offer figure. Signing may be null on its own
 * (unreported in the source aggregate) — it is then counted as $0, with the
 * entry's method disclosing it is unknown rather than zero. A null stock
 * grant on a postings-based estimate (base present, no equity data published)
 * is likewise counted as $0 in TC math, disclosed in the method. */
function hasOffer(e: EntryNumbers): e is EntryNumbers & {
  base: number;
} {
  return e.base !== null;
}

/** Monthly close nearest `date` (YYYY-MM-DD). Null when there is no history. */
export function priceAtDate(closes: MonthlyClose[], date: string): MonthlyClose | null {
  if (closes.length === 0) return null;
  const target = new Date(`${date}T00:00:00Z`).getTime();
  let best = closes[0];
  let bestDiff = Math.abs(new Date(`${best.date}T00:00:00Z`).getTime() - target);
  for (const c of closes.slice(1)) {
    const d = Math.abs(new Date(`${c.date}T00:00:00Z`).getTime() - target);
    if (d < bestDiff) {
      bestDiff = d;
      best = c;
    }
  }
  return best;
}

/**
 * Annualized first-year total comp at grant prices:
 * base + signing (counted in full) + one quarter of the 4-year stock grant.
 * A null signing bonus (unreported by the source) counts as $0 — the entry's
 * method must disclose it is unknown, not zero. A null stock grant
 * (postings-based estimate whose source published no equity data) likewise
 * counts as $0. Null when the offer figure is intentionally unavailable.
 */
export function offerTcAtGrant(e: EntryNumbers): number | null {
  if (!hasOffer(e)) return null;
  return e.base + (e.signingBonus ?? 0) + (e.stockGrantTotal4yr ?? 0) / 4;
}

/**
 * Realized 4-year value at today's prices:
 *   base*4 + signing + stockGrantTotal4yr / priceAtGrant * priceNow
 * Null for private companies (no ticker), unavailable offer data, or when
 * prices are missing. Vesting schedules, refreshers, and taxes are
 * intentionally ignored — this is a grant-marking comparison, not take-home pay.
 */
export function realized4yr(e: EntryNumbers, prices: GrantPricePoints | null): number | null {
  if (!hasOffer(e)) return null;
  if (e.ticker === null || prices === null || prices.priceAtGrant <= 0) return null;
  return e.base * 4 + (e.signingBonus ?? 0) + ((e.stockGrantTotal4yr ?? 0) / prices.priceAtGrant) * prices.priceNow;
}

/** Stock price growth since the grant date, as a fraction. Null when unavailable. */
export function stockGrowthSinceGrant(prices: GrantPricePoints | null): number | null {
  if (prices === null || prices.priceAtGrant <= 0) return null;
  return prices.priceNow / prices.priceAtGrant - 1;
}

/**
 * Average annual TC with stock growth applied: realized4yr / 4.
 * Same grant-marking comparison as realized4yr, just annualized.
 */
export function tcPerYearWithGrowth(realized4yrValue: number | null): number | null {
  if (realized4yrValue === null) return null;
  return realized4yrValue / 4;
}

// ---------------------------------------------------------------------------
// Startup valuation-growth leaderboard math
// ---------------------------------------------------------------------------

// (TStartupEntry is already imported at the top of this file.)

/**
 * Valuation growth since the ~Aug-2024 anchor, as a fraction:
 *   latestValuationUsd / valuationAug2024Usd - 1
 * Null when the anchor is missing (never silently interpolated) or invalid.
 */
export function valuationGrowthSince2024(e: TStartupEntry): number | null {
  if (e.valuationAug2024Usd === null || e.valuationAug2024Usd <= 0) return null;
  return e.latestValuationUsd / e.valuationAug2024Usd - 1;
}

/**
 * Growth multiplier (1 + growth) for re-pricing an anchored grant.
 */
export function valuationGrowthMultiple(e: TStartupEntry): number | null {
  const g = valuationGrowthSince2024(e);
  return g === null ? null : 1 + g;
}

/**
 * Average annual TC with valuation growth applied, for startups where a
 * sourced 2024 new-grad offer exists. Only the stock portion is re-priced at
 * the latest valuation; cash stays fixed. When a base/signing breakdown
 * exists, the one-time signing bonus is annualized (÷ 4) instead of being
 * counted as recurring cash. Null when either the NG offer or the
 * 2024 anchor valuation is missing.
 */
export function startupTcPerYearWithGrowth(e: TStartupEntry): number | null {
  const multiple = valuationGrowthMultiple(e);
  if (e.ngOfferTc2024 === null || e.ngStockPerYearAtGrant === null || multiple === null) return null;
  if (e.ngBase2024 !== null && e.ngSigning2024 !== null) {
    return e.ngBase2024 + e.ngSigning2024 / 4 + e.ngStockPerYearAtGrant * multiple;
  }
  // Annual-TC sources (e.g. levels.fyi aggregates): the non-stock portion is
  // genuinely recurring annual cash, so it stays fixed.
  return e.ngOfferTc2024 - e.ngStockPerYearAtGrant + e.ngStockPerYearAtGrant * multiple;
}
