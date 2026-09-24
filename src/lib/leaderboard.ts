import type { TLeaderboardEntry } from '@/data/leaderboard2024';
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
 */
export function offerTcAtGrant(e: EntryNumbers): number {
  return e.base + e.signingBonus + e.stockGrantTotal4yr / 4;
}

/**
 * Realized 4-year value at today's prices:
 *   base*4 + signing + stockGrantTotal4yr / priceAtGrant * priceNow
 * Null for private companies (no ticker) or when prices are unavailable.
 * Vesting schedules, refreshers, and taxes are intentionally ignored —
 * this is a grant-marking comparison, not take-home pay.
 */
export function realized4yr(e: EntryNumbers, prices: GrantPricePoints | null): number | null {
  if (e.ticker === null || prices === null || prices.priceAtGrant <= 0) return null;
  return e.base * 4 + e.signingBonus + (e.stockGrantTotal4yr / prices.priceAtGrant) * prices.priceNow;
}

/** Stock price growth since the grant date, as a fraction. Null when unavailable. */
export function stockGrowthSinceGrant(prices: GrantPricePoints | null): number | null {
  if (prices === null || prices.priceAtGrant <= 0) return null;
  return prices.priceNow / prices.priceAtGrant - 1;
}
