/**
 * valuationMarks.ts — dated manual valuation marks for private companies.
 *
 * PUBLIC TIER ONLY. These are press-reported financing rounds and tender
 * offers, used to seed manual valuation marks in the startup-equity UI.
 * Every mark carries a source and a status:
 *   - 'announced': company-confirmed or contemporaneous press reporting
 *   - 'reported': widely reported by press, not formally confirmed
 *   - 'estimated': secondary/indicative data, or a round reported as
 *     "not formally closed" — do not treat as authoritative.
 *
 * Deliberately EXCLUDED: any SpaceX IPO claim (e.g. a June 2026 IPO or an
 * "SPCX" ticker). Those reports are unverified; SpaceX is treated as private
 * here until a confirmed listing exists.
 *
 * Bloomberg has no employee equity program — there is nothing to mark.
 * See NO_EQUITY_COMPANIES below.
 */

/** How much we trust a mark. */
export type ValuationMarkStatus = 'announced' | 'reported' | 'estimated';

export interface ValuationMark {
  company: 'Stripe' | 'SpaceX' | 'Anduril';
  /** Month of the mark, YYYY-MM. */
  date: string;
  /** e.g. "Series G", "tender offer", "409A". */
  event: string;
  /** Post-money / implied valuation in USD. */
  valuationUSD: number;
  /** Per-share price in USD, when reported. */
  sharePriceUSD?: number;
  /** Amount raised in the round, in USD, when reported. */
  amountRaisedUSD?: number;
  /** Human-readable attribution, e.g. "TechCrunch (Jun 5, 2025)". */
  source: string;
  status: ValuationMarkStatus;
  note?: string;
}

export const VALUATION_MARKS: ValuationMark[] = [
  // ---------------- Stripe ----------------
  {
    company: 'Stripe',
    date: '2023-03',
    event: 'Series I',
    valuationUSD: 50_000_000_000,
    amountRaisedUSD: 6_500_000_000,
    source: 'TechCrunch (Mar 2023)',
    status: 'announced',
  },
  {
    company: 'Stripe',
    date: '2024-02',
    event: 'tender offer',
    valuationUSD: 65_000_000_000,
    source: 'TechCrunch (Feb 2024)',
    status: 'announced',
    note: 'Employee liquidity tender; over $1B of shares purchased.',
  },
  {
    company: 'Stripe',
    date: '2024-07',
    event: 'tender offer',
    valuationUSD: 70_000_000_000,
    sharePriceUSD: 27.51,
    source: 'Bloomberg / The Information (Jul 2024)',
    status: 'reported',
  },
  {
    company: 'Stripe',
    date: '2025-02',
    event: 'tender offer',
    valuationUSD: 91_500_000_000,
    source: 'Company-announced (Feb 27, 2025)',
    status: 'announced',
  },
  {
    company: 'Stripe',
    date: '2025-09',
    event: '409A valuation',
    valuationUSD: 106_700_000_000,
    source: 'Secondary reporting (Sep 2025)',
    status: 'estimated',
    note: 'Reported 409A mark, not a transaction price; treat as indicative.',
  },
  // ---------------- SpaceX ----------------
  {
    company: 'SpaceX',
    date: '2024-12',
    event: 'tender offer',
    valuationUSD: 350_000_000_000,
    sharePriceUSD: 185,
    source: 'Reuters (Dec 2024)',
    status: 'reported',
  },
  {
    company: 'SpaceX',
    date: '2025-07',
    event: 'tender offer',
    valuationUSD: 400_000_000_000,
    sharePriceUSD: 212,
    source: 'Fortune (Dec 2025, citing prior tender)',
    status: 'reported',
  },
  {
    company: 'SpaceX',
    date: '2025-12',
    event: 'tender offer',
    valuationUSD: 800_000_000_000,
    sharePriceUSD: 421,
    source: 'Reuters / Bloomberg (Dec 13, 2025)',
    status: 'reported',
    note: 'Secondary share sale; up to ~$2.56B in shares.',
  },
  // ---------------- Anduril ----------------
  {
    company: 'Anduril',
    date: '2022-12',
    event: 'Series E',
    valuationUSD: 8_500_000_000,
    amountRaisedUSD: 1_480_000_000,
    source: 'Press reports (Dec 2022)',
    status: 'reported',
  },
  {
    company: 'Anduril',
    date: '2024-08',
    event: 'Series F',
    valuationUSD: 14_000_000_000,
    amountRaisedUSD: 1_500_000_000,
    source: 'TechCrunch (Aug 2024)',
    status: 'reported',
  },
  {
    company: 'Anduril',
    date: '2025-06',
    event: 'Series G',
    valuationUSD: 30_500_000_000,
    amountRaisedUSD: 2_500_000_000,
    source: 'TechCrunch (Jun 5, 2025)',
    status: 'announced',
    note: 'Led by Founders Fund ($1B check); reported 8x oversubscribed.',
  },
  {
    company: 'Anduril',
    date: '2026-03',
    event: 'Series H',
    valuationUSD: 60_000_000_000,
    amountRaisedUSD: 4_000_000_000,
    source: 'Bloomberg / Axios / WSJ (Mar 2026)',
    status: 'estimated',
    note: 'Reported as raising; not formally announced as closed.',
  },
];

/** Private companies in the north-star set with no employee equity to mark. */
export const NO_EQUITY_COMPANIES: { company: string; note: string }[] = [
  {
    company: 'Bloomberg',
    note: 'No equity program — compensation is cash salary plus discretionary bonus. There is no valuation to mark; model Bloomberg offers as cash-only.',
  },
];

/** All marks for one company, newest first. */
export function marksForCompany(
  company: ValuationMark['company'],
): ValuationMark[] {
  return VALUATION_MARKS.filter((m) => m.company === company).sort((a, b) =>
    b.date.localeCompare(a.date),
  );
}

/** The most recent mark for a company (or undefined when none exists). */
export function latestMark(
  company: ValuationMark['company'],
): ValuationMark | undefined {
  return marksForCompany(company)[0];
}
