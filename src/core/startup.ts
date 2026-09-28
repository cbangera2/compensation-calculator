import type { TStartupEquity, TStartupOptionGrant, TStartupRsuGrant } from '@/models/types';

/**
 * Startup (private-company) equity math.
 *
 * All functions are pure and operate on plain numbers so they can be reused
 * by the UI, tests, and any future compute integration. Valuations are in
 * dollars; share counts are fully-diluted share counts.
 *
 * The illiquidity discount (DLOM) is applied to the scenario-priced equity
 * value only — never to cash, and never to the grant-date FMV reference.
 */

/** Keep factor after the block's illiquidity discount: 1 - clamp(discount, 0, 1). */
export function liquidityKeep(block: { liquidityDiscount?: number | null }): number {
  const d = block.liquidityDiscount ?? 0.3;
  return 1 - Math.min(1, Math.max(0, d));
}

/** Implied price per share from a scenario valuation. */
export function impliedSharePrice(valuation: number, fullyDilutedShares: number): number {
  if (!Number.isFinite(valuation) || !Number.isFinite(fullyDilutedShares) || fullyDilutedShares <= 0) {
    return 0;
  }
  return Math.max(0, valuation) / fullyDilutedShares;
}

/** Net (intrinsic) value of an option grant at a given share price. */
export function optionNetValue(quantity: number, strike: number, sharePrice: number): number {
  if (!Number.isFinite(quantity) || !Number.isFinite(strike) || !Number.isFinite(sharePrice)) return 0;
  return Math.max(0, sharePrice - strike) * Math.max(0, quantity);
}

/** Value of an RSU grant at a given share price (no strike). */
export function rsuValue(shares: number, sharePrice: number): number {
  if (!Number.isFinite(shares) || !Number.isFinite(sharePrice)) return 0;
  return Math.max(0, shares) * Math.max(0, sharePrice);
}

/** Cash required to exercise an option grant (strike x quantity). */
export function exerciseCost(quantity: number, strike: number): number {
  if (!Number.isFinite(quantity) || !Number.isFinite(strike)) return 0;
  return Math.max(0, quantity) * Math.max(0, strike);
}

/** Spread a grant's total value evenly across its vesting years. */
export function annualizeGrantValue(totalValue: number, vestYears: number): number {
  if (!Number.isFinite(totalValue) || !Number.isFinite(vestYears) || vestYears <= 0) return 0;
  return Math.max(0, totalValue) / vestYears;
}

export type StartupGrantValuation = {
  label: string;
  kind: 'option' | 'rsu';
  /** Value of the grant at grant-date FMV (reference only; not annualized). */
  grantValue: number;
  /** Net value at the scenario share price. */
  netValue: number;
  /** Cash to exercise (options only; 0 for RSUs). */
  exerciseCost: number;
  /** netValue (at the scenario share price) spread across vest years. Moves with the valuation scenario. */
  annualizedGrantValue: number;
};

export type StartupEquityValuation = {
  sharePrice: number;
  /** Illiquidity discount applied to scenario-priced values (0..1). */
  liquidityDiscount: number;
  grants: StartupGrantValuation[];
  totalGrantValue: number;
  /** Sum of scenario-priced grant values BEFORE the discount (the paper mark). */
  totalPaperNetValue: number;
  /** Sum of scenario-priced grant values AFTER the discount. */
  totalNetValue: number;
  totalExerciseCost: number;
  /** Total grant value annualized across each grant's own vest schedule. */
  totalAnnualizedGrantValue: number;
};

function valuateOptionGrant(grant: TStartupOptionGrant, sharePrice: number): StartupGrantValuation {
  const grantValue = optionNetValue(grant.quantity, grant.strike, grant.fmvAtGrant);
  const netValue = optionNetValue(grant.quantity, grant.strike, sharePrice);
  const cost = exerciseCost(grant.quantity, grant.strike);
  return {
    label: grant.label,
    kind: 'option',
    grantValue,
    netValue,
    exerciseCost: cost,
    annualizedGrantValue: annualizeGrantValue(netValue, grant.vestYears),
  };
}

function valuateRsuGrant(grant: TStartupRsuGrant, sharePrice: number): StartupGrantValuation {
  const grantValue = rsuValue(grant.shares, grant.fmvAtGrant);
  const netValue = rsuValue(grant.shares, sharePrice);
  return {
    label: grant.label,
    kind: 'rsu',
    grantValue,
    netValue,
    exerciseCost: 0,
    annualizedGrantValue: annualizeGrantValue(netValue, grant.vestYears),
  };
}

/**
 * Value a full startup equity block at a scenario valuation.
 * `valuationOverride` lets callers price the block at a different valuation
 * than the one stored on the block (e.g. from a slider).
 */
export function valuateStartupEquity(
  block: TStartupEquity,
  valuationOverride?: number
): StartupEquityValuation {
  const valuation = valuationOverride ?? block.valuation;
  const sharePrice = impliedSharePrice(valuation, block.fullyDilutedShares);
  const keep = liquidityKeep(block);
  const raw: StartupGrantValuation[] = [
    ...(block.optionGrants ?? []).map((g) => valuateOptionGrant(g, sharePrice)),
    ...(block.rsuGrants ?? []).map((g) => valuateRsuGrant(g, sharePrice)),
  ];
  // The illiquidity discount applies to scenario-priced values only: net
  // value and its annualized spread. Grant-date FMV (grantValue) and exercise
  // cost are reference figures and stay undiscounted. annualizeGrantValue is
  // linear in netValue, so scaling the annualized figure by `keep` matches
  // annualizing the discounted net value exactly.
  const grants = raw.map((g) => ({
    ...g,
    netValue: g.netValue * keep,
    annualizedGrantValue: g.annualizedGrantValue * keep,
  }));
  return {
    sharePrice,
    // Rounded so the exposed figure is clean (1 - 0.7 is 0.30000000000000004 in IEEE).
    liquidityDiscount: Math.round((1 - keep) * 1e6) / 1e6,
    grants,
    totalGrantValue: grants.reduce((a, g) => a + g.grantValue, 0),
    totalPaperNetValue: raw.reduce((a, g) => a + g.netValue, 0),
    totalNetValue: grants.reduce((a, g) => a + g.netValue, 0),
    totalExerciseCost: grants.reduce((a, g) => a + g.exerciseCost, 0),
    totalAnnualizedGrantValue: grants.reduce((a, g) => a + g.annualizedGrantValue, 0),
  };
}

/** Sample block used for demos/tests. Contains no real company data. */
export function sampleStartupEquity(): TStartupEquity {
  return {
    enabled: true,
    companyName: 'Example Startup',
    valuation: 6_000_000_000,
    fullyDilutedShares: 100_000_000,
    liquidityDiscount: 0.3,
    optionGrants: [
      {
        label: 'New hire option grant',
        quantity: 3000,
        strike: 30,
        fmvAtGrant: 38,
        vestYears: 4,
        cliffMonths: 12,
      },
    ],
    rsuGrants: [
      {
        label: 'Refresh RSUs',
        shares: 250,
        fmvAtGrant: 60,
        doubleTrigger: true,
        vestYears: 2,
      },
    ],
    savedScenarios: [],
  };
}
