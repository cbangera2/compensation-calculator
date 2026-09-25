import {
  GRANT_DATE_BY_YEAR,
  LeaderboardEntry,
  type TLeaderboardEntry,
  type TLeaderboardYear,
} from '@/data/leaderboard2024';
import type { TEquityGrant, TOffer } from '@/models/types';

/**
 * The user's own offers, converted into leaderboard rows.
 *
 * A user entry is a normal TLeaderboardEntry (so every leaderboard math
 * helper — offerTcAtGrant, sorting, COL adjustment — works on it unchanged)
 * plus a marker so the UI can render it distinctly. The entry is validated
 * through the same zod schema as the sourced rows: honesty rules apply.
 *
 * Differences from sourced rows, by construction:
 *  - group is 'user' (its own filter checkbox),
 *  - ticker is null, so growth/realized columns are n/a (no market marking
 *    of a private user-entered grant),
 *  - confidence is 'estimate' with source 'Your custom offer' and a method
 *    that discloses the figures are user-entered,
 *  - grantDate uses the active year's canonical assumption (same convention
 *    as every other row in that year's table).
 */

export type TUserLeaderboardEntry = TLeaderboardEntry & {
  /** Marker flag — always true for converted user offers. */
  isUserOffer: true;
  /** The source TOffer id, so rows stay unique when two offers share a name. */
  offerId: string;
};

/** 4-year grant value at grant prices (no growth), for one public equity grant. */
export function equityGrantTotal4yrAtGrant(grant: TEquityGrant, startingPrice: number): number {
  if (grant.targetValue && grant.targetValue > 0) {
    // Mirrors compute.ts: default target mode is 'year1' (value per year).
    const mode = grant.targetMode ?? 'year1';
    return mode === 'total' ? grant.targetValue : grant.targetValue * 4;
  }
  const price = grant.fmv ?? startingPrice;
  if (grant.type === 'RSU') {
    return grant.shares * price;
  }
  const strike = grant.strike ?? grant.fmv ?? startingPrice;
  return grant.shares * Math.max(0, price - strike);
}

/** Total 4-year stock/equity grant value at grant prices (no growth). */
export function offerStockGrantTotal4yr(offer: TOffer): number {
  const startingPrice = offer.growth?.startingPrice ?? 0;
  let total = 0;
  for (const g of offer.equityGrants ?? []) {
    total += equityGrantTotal4yrAtGrant(g, startingPrice);
  }
  const se = offer.startupEquity;
  if (se?.enabled) {
    for (const g of se.optionGrants ?? []) {
      total += g.quantity * Math.max(0, g.fmvAtGrant - g.strike);
    }
    for (const g of se.rsuGrants ?? []) {
      total += g.shares * g.fmvAtGrant;
    }
  }
  return total;
}

/** Total signing bonus across all signing-bonus payments. */
export function offerSigningTotal(offer: TOffer): number {
  return (offer.signingBonuses ?? []).reduce((acc, b) => acc + b.amount, 0);
}

/**
 * Convert a user offer into a leaderboard entry for the active year tab.
 * Throws if the produced entry fails the leaderboard schema (should never
 * happen — the schema inputs are all sanitized here).
 */
export function offerToLeaderboardEntry(offer: TOffer, year: TLeaderboardYear): TUserLeaderboardEntry {
  const entry = LeaderboardEntry.parse({
    company: offer.name?.trim() || 'Your offer',
    group: 'user',
    ticker: null,
    levelLabel: offer.jobLevel || offer.jobTitle || 'Your offer',
    city: offer.location || 'US',
    base: Math.round(offer.base.startAnnual),
    signingBonus: Math.round(offerSigningTotal(offer)),
    stockGrantTotal4yr: Math.round(offerStockGrantTotal4yr(offer)),
    grantDate: GRANT_DATE_BY_YEAR[year],
    sampleBand: 'unknown',
    source: 'Your custom offer',
    accessDate: new Date().toISOString().slice(0, 10),
    method:
      'User-entered offer from this app; figures taken as entered and the equity grant valued at grant prices with no growth. Not a collected offer.',
    confidence: 'estimate',
  } satisfies TLeaderboardEntry);
  return { ...entry, isUserOffer: true as const, offerId: offer.id ?? offer.name };
}
