import { compressToEncodedURIComponent, decompressFromEncodedURIComponent } from 'lz-string';
import { z } from 'zod';
import { Offer, TOffer } from '@/models/types';

// ---------------------------------------------------------------------------
// v1 payload: exact snapshot (legacy). Kept for backward compatibility.
// ---------------------------------------------------------------------------

const SharePayloadSchema = z.object({
  version: z.literal(1),
  offers: z.array(Offer),
  activeIndex: z.number().int().nonnegative(),
  uiMode: z.enum(['simple', 'advanced']).default('simple'),
});

export type SharePayload = z.infer<typeof SharePayloadSchema>;

// ---------------------------------------------------------------------------
// v2 payload: anonymized snapshot.
// - company names replaced with "Company A/B/C..." aliases
// - location reduced to metro only
// - compensation rounded to nearest $5K
// - dates rounded to quarter ("2025-Q1")
// - internal ids stripped
// ---------------------------------------------------------------------------

const AnonVestingScheduleSchema = z.union([
  z.object({
    model: z.literal('standard'),
    years: z.number().positive(),
    cliffMonths: z.number().int().nonnegative(),
    frequency: z.enum(['monthly', 'quarterly', 'annual']),
    distribution: z.enum(['even', 'frontloaded', 'backloaded']).default('even'),
    cliffPercent: z.number().nonnegative().max(1).default(0),
  }).strict(),
  z.object({
    model: z.literal('explicit'),
    tranches: z.array(
      z.object({ date: z.string(), shares: z.number().nonnegative() }).strict()
    ),
  }).strict(),
  z.object({
    model: z.literal('milestone'),
    steps: z.array(
      z.object({ monthsFromStart: z.number().int().nonnegative(), fraction: z.number().nonnegative() }).strict()
    ),
  }).strict(),
]);

/**
 * Explicit allowlist of what an "anonymous" offer may contain: the Offer shape
 * minus internal ids, with every object `.strict()` so unknown keys fail
 * parsing. This schema must be updated deliberately when the anon payload
 * legitimately grows — it exists so a future sensitive field added to Offer
 * is rejected from anonymous links by default instead of silently flowing
 * into payloads labeled anonymous.
 */
const AnonOfferSchema = z.object({
  name: z.string(),
  currency: z.string().default('USD'),
  startDate: z.string(),
  location: z.string().optional(),
  colFactor: z.number().positive().optional().default(1),
  base: z.object({ startAnnual: z.number().nonnegative() }).strict(),
  raises: z.array(
    z.object({
      effectiveDate: z.string(),
      type: z.enum(['percent', 'absolute']),
      value: z.number(),
    }).strict()
  ).default([]),
  performanceBonus: z.object({
    kind: z.enum(['percent', 'fixed']),
    value: z.number().nonnegative(),
    expectedPayout: z.number().nonnegative().default(1),
  }).strict().optional(),
  signingBonuses: z.array(
    z.object({ amount: z.number().nonnegative(), payDate: z.string() }).strict()
  ).optional(),
  relocationBonuses: z.array(
    z.object({ amount: z.number().nonnegative(), payDate: z.string() }).strict()
  ).optional(),
  benefits: z.array(
    z.object({ name: z.string(), annualValue: z.number().nonnegative(), enabled: z.boolean().default(true) }).strict()
  ).default([]),
  miscRecurring: z.array(
    z.object({ name: z.string(), annualValue: z.number().nonnegative() }).strict()
  ).default([]),
  equityGrants: z.array(
    z.object({
      type: z.enum(['RSU', 'ISO', 'NSO']),
      shares: z.number().nonnegative(),
      strike: z.number().nonnegative().optional(),
      fmv: z.number().nonnegative().optional(),
      targetValue: z.number().nonnegative().optional(),
      targetMode: z.enum(['year1', 'total']).optional(),
      vesting: AnonVestingScheduleSchema,
      grantStartDate: z.string().optional(),
    }).strict()
  ).default([]),
  growth: z.object({ startingPrice: z.number().optional(), yoy: z.array(z.number()) }).strict().optional(),
  startupEquity: z.object({
    enabled: z.boolean().default(false),
    companyName: z.string().default('Example Startup'),
    valuation: z.number().nonnegative().default(1_000_000_000),
    fullyDilutedShares: z.number().positive().default(100_000_000),
    optionGrants: z.array(
      z.object({
        label: z.string().default('Option grant'),
        quantity: z.number().nonnegative(),
        strike: z.number().nonnegative(),
        fmvAtGrant: z.number().nonnegative(),
        vestYears: z.number().positive(),
        cliffMonths: z.number().int().nonnegative().default(12),
      }).strict()
    ).default([]),
    rsuGrants: z.array(
      z.object({
        label: z.string().default('RSU grant'),
        shares: z.number().nonnegative(),
        fmvAtGrant: z.number().nonnegative(),
        doubleTrigger: z.boolean().default(true),
        vestYears: z.number().positive(),
      }).strict()
    ).default([]),
    // Saved scenarios are always stripped to [] by anonymizeOffer (private
    // what-if analysis is never shared). The key stays present so imports
    // keep a valid shape, but the schema rejects any non-empty array so a
    // scenario can never be smuggled through a share link.
    savedScenarios: z.array(z.never()).default([]),
  }).strict().optional(),
  retirement: z.object({
    employeeContributionPercent: z.number().nonnegative().max(1).default(0.06),
    matchRate: z.number().nonnegative().max(1).default(0.5),
    matchCapPercentOfSalary: z.number().nonnegative().max(1).default(0.06),
    employeeContributionCapDollar: z.number().nonnegative().default(23500),
    matchCapMode: z.enum(['percentOfSalary', 'dollar']).default('percentOfSalary'),
    matchCapDollar: z.number().nonnegative().default(0),
  }).strict().optional(),
  assumptions: z.object({
    horizonYears: z.number().int().positive().default(4),
    presentValueRate: z.number().optional(),
    colAdjust: z.number().positive().default(1),
  }).strict().default({ horizonYears: 4, colAdjust: 1 }),
}).strict();

export type TAnonOffer = z.infer<typeof AnonOfferSchema>;

const AnonSharePayloadSchema = z.object({
  version: z.literal(2),
  anon: z.literal(true),
  offers: z.array(AnonOfferSchema),
  activeIndex: z.number().int().nonnegative(),
  uiMode: z.enum(['simple', 'advanced']).default('simple'),
});

export type AnonSharePayload = z.infer<typeof AnonSharePayloadSchema>;

export type AnySharePayload = SharePayload | AnonSharePayload;

export type ParsedShare =
  | { anon: false; payload: SharePayload }
  | { anon: true; payload: AnonSharePayload };

type SnapshotInput = {
  offers: TOffer[];
  activeIndex: number;
  uiMode: 'simple' | 'advanced';
};

export function snapshotToPayload(input: SnapshotInput): SharePayload {
  const offersClone = JSON.parse(JSON.stringify(input.offers)) as TOffer[];
  const activeIndex = Math.min(
    Math.max(input.activeIndex, 0),
    Math.max(offersClone.length - 1, 0),
  );

  return SharePayloadSchema.parse({
    version: 1,
    offers: offersClone,
    activeIndex,
    uiMode: input.uiMode ?? 'simple',
  });
}

export function encodeSharePayload(payload: AnySharePayload): string {
  const json = JSON.stringify(payload);
  return compressToEncodedURIComponent(json);
}

export function buildShareToken(snapshot: SnapshotInput): string {
  return encodeSharePayload(snapshotToPayload(snapshot));
}

// ---------------------------------------------------------------------------
// Anonymization
// ---------------------------------------------------------------------------

const ROUND_GRANULARITY = 5_000;

function roundMoney(value: number, granularity = ROUND_GRANULARITY): number {
  if (!Number.isFinite(value)) return value;
  return Math.round(value / granularity) * granularity;
}

/**
 * Round to 2 significant figures. Fixed steps (Math.round, $1B buckets)
 * zero out small-but-meaningful values like a $0.40 strike or a $1.6B
 * valuation; relative rounding keeps them meaningful while still coarse
 * enough to anonymize.
 */
function roundSig(value: number, digits = 2): number {
  if (!Number.isFinite(value) || value === 0) return value;
  const p = Math.pow(10, digits - Math.ceil(Math.log10(Math.abs(value))));
  return Math.round(value * p) / p;
}

// Share counts are identifying (they match offer letters), so anonymized
// payloads round them to the nearest 100: coarse enough to break exact
// matching against a real grant, fine enough to keep projections meaningful.
const SHARE_GRANULARITY = 100;

function roundShares(value: number): number {
  if (!Number.isFinite(value)) return value;
  return Math.round(value / SHARE_GRANULARITY) * SHARE_GRANULARITY;
}

/** "2025-06-01" -> "2025-Q2". Idempotent for already-rounded values. */
export function roundDateToQuarter(dateStr: string): string {
  if (/^\d{4}-Q[1-4]$/.test(dateStr)) return dateStr;
  const match = /^(\d{4})-(\d{2})/.exec(dateStr);
  if (!match) return dateStr;
  const month = Math.max(1, Math.min(12, parseInt(match[2], 10)));
  const quarter = Math.floor((month - 1) / 3) + 1;
  return `${match[1]}-Q${quarter}`;
}

/** "2025-Q2" -> "2025-04-01" so imported offers stay valid ISO dates for compute. */
export function expandQuarterToDate(dateStr: string): string {
  const match = /^(\d{4})-Q([1-4])$/.exec(dateStr);
  if (!match) return dateStr;
  const month = (parseInt(match[2], 10) - 1) * 3 + 1;
  return `${match[1]}-${String(month).padStart(2, '0')}-01`;
}

/** Company alias for the nth shared offer: "Company A", "Company B", ... */
export function companyAlias(index: number): string {
  if (index >= 0 && index < 26) return `Company ${String.fromCharCode(65 + index)}`;
  return `Company ${index + 1}`;
}

const METRO_KEYWORDS: Array<[string, string[]]> = [
  ['Bay Area', ['san francisco', 'sunnyvale', 'san jose', 'mountain view', 'palo alto', 'menlo park', 'cupertino', 'fremont', 'oakland', 'berkeley', 'bay area', 'silicon valley', 'santa clara', 'redwood city', 'san mateo']],
  ['New York City', ['new york', 'nyc', 'manhattan', 'brooklyn', 'queens', 'jersey city', 'hoboken', 'newark']],
  ['Washington DC', ['washington', 'district of columbia', 'arlington', 'alexandria', 'mclean', 'tysons', 'bethesda', 'reston', 'falls church']],
  ['Seattle', ['seattle', 'bellevue', 'redmond', 'kirkland', 'tacoma']],
  ['Austin', ['austin', 'round rock']],
  ['Boston', ['boston', 'cambridge', 'somerville', 'waltham']],
  ['Los Angeles', ['los angeles', 'santa monica', 'culver city', 'burbank', 'pasadena', 'irvine']],
  ['Chicago', ['chicago', 'evanston', 'schaumburg']],
  ['Denver', ['denver', 'boulder']],
  ['Detroit Metro', ['detroit', 'ann arbor', 'dearborn', 'troy', 'warren']],
  ['Pittsburgh', ['pittsburgh']],
  ['Toronto', ['toronto']],
  ['London', ['london']],
  ['Remote', ['remote']],
];

/** Reduce a location string to metro only, e.g. "San Francisco, CA" -> "Bay Area". */
export function metroOnly(location: string | undefined): string | undefined {
  if (!location) return location;
  const haystack = location.toLowerCase();
  for (const [metro, keywords] of METRO_KEYWORDS) {
    if (keywords.some((kw) => haystack.includes(kw))) return metro;
  }
  return 'Other metro';
}

/**
 * Produce an anonymized copy of one offer: alias name, metro-only location,
 * rounded comp, quarter-rounded dates, no internal ids.
 */
export function anonymizeOffer(offer: TOffer, index: number): TOffer {
  const alias = companyAlias(index);
  const clone = JSON.parse(JSON.stringify(offer)) as TOffer;

  delete clone.id;
  clone.name = alias;
  clone.location = metroOnly(clone.location);
  clone.startDate = roundDateToQuarter(clone.startDate);
  clone.base = { startAnnual: roundMoney(clone.base.startAnnual) };

  clone.raises = (clone.raises ?? []).map((raise) => ({
    ...raise,
    effectiveDate: roundDateToQuarter(raise.effectiveDate),
    value: raise.type === 'absolute' ? roundMoney(raise.value) : raise.value,
  }));

  if (clone.performanceBonus?.kind === 'fixed') {
    clone.performanceBonus = { ...clone.performanceBonus, value: roundMoney(clone.performanceBonus.value) };
  }

  clone.signingBonuses = (clone.signingBonuses ?? []).map((bonus) => ({
    amount: roundMoney(bonus.amount),
    payDate: roundDateToQuarter(bonus.payDate),
  }));
  clone.relocationBonuses = (clone.relocationBonuses ?? []).map((bonus) => ({
    amount: roundMoney(bonus.amount),
    payDate: roundDateToQuarter(bonus.payDate),
  }));

  clone.benefits = (clone.benefits ?? []).map((benefit) => ({
    ...benefit,
    annualValue: roundMoney(benefit.annualValue),
  }));
  clone.miscRecurring = (clone.miscRecurring ?? []).map((item) => ({
    ...item,
    annualValue: roundMoney(item.annualValue),
  }));

  clone.equityGrants = (clone.equityGrants ?? []).map((grant) => {
    const g = { ...grant } as Record<string, unknown>;
    delete g.id;
    if (typeof g.shares === 'number') g.shares = roundShares(g.shares);
    if (typeof g.strike === 'number') g.strike = roundSig(g.strike);
    if (typeof g.fmv === 'number') g.fmv = roundSig(g.fmv);
    if (typeof g.targetValue === 'number') g.targetValue = roundMoney(g.targetValue);
    if (typeof g.grantStartDate === 'string') g.grantStartDate = roundDateToQuarter(g.grantStartDate);
    const vesting = g.vesting as { model?: string; tranches?: Array<{ date: string; shares: number }> } | undefined;
    if (vesting?.model === 'explicit' && Array.isArray(vesting.tranches)) {
      g.vesting = {
        ...vesting,
        tranches: vesting.tranches.map((tranche) => ({
          ...tranche,
          date: roundDateToQuarter(tranche.date),
          shares: roundShares(tranche.shares),
        })),
      };
    }
    return g as TOffer['equityGrants'][number];
  });

  if (clone.growth?.startingPrice != null) {
    clone.growth = { ...clone.growth, startingPrice: roundSig(clone.growth.startingPrice) };
  }

  if (clone.startupEquity) {
    const se = { ...clone.startupEquity };
    se.companyName = alias;
    se.valuation = roundSig(se.valuation);
    // Saved valuation scenarios are private what-if analysis; never shared.
    // Reset to [] (rather than deleting the key) so the imported offer still
    // conforms to the TStartupEquity shape and the Startup tab can't crash
    // on a missing field.
    se.savedScenarios = [];
    se.optionGrants = (se.optionGrants ?? []).map((grant) => {
      const g = { ...grant } as Record<string, unknown>;
      delete g.id;
      g.label = alias;
      if (typeof g.quantity === 'number') g.quantity = roundShares(g.quantity);
      if (typeof g.strike === 'number') g.strike = roundSig(g.strike);
      if (typeof g.fmvAtGrant === 'number') g.fmvAtGrant = roundSig(g.fmvAtGrant);
      return g as (typeof se.optionGrants)[number];
    });
    se.rsuGrants = (se.rsuGrants ?? []).map((grant) => {
      const g = { ...grant } as Record<string, unknown>;
      delete g.id;
      g.label = alias;
      if (typeof g.shares === 'number') g.shares = roundShares(g.shares);
      if (typeof g.fmvAtGrant === 'number') g.fmvAtGrant = roundSig(g.fmvAtGrant);
      return g as (typeof se.rsuGrants)[number];
    });
    clone.startupEquity = se;
  }

  if (clone.retirement) {
    clone.retirement = {
      ...clone.retirement,
      matchCapDollar: roundMoney(clone.retirement.matchCapDollar),
      employeeContributionCapDollar: roundMoney(clone.retirement.employeeContributionCapDollar),
    };
  }

  return clone;
}

/**
 * Build an anonymized share token from a subset of offers.
 * `indices` are positions in the source offers array; aliases are assigned
 * in selection order (first selected -> "Company A").
 */
export function buildAnonymizedToken(offers: TOffer[], indices: number[], uiMode: 'simple' | 'advanced' = 'simple'): string {
  const valid = [...new Set(indices)].filter((i) => i >= 0 && i < offers.length);
  const selected = valid.map((i, aliasIndex) => anonymizeOffer(offers[i], aliasIndex));
  const anonOffers = AnonSharePayloadSchema.parse({
    version: 2,
    anon: true,
    offers: selected,
    activeIndex: 0,
    uiMode,
  });
  return encodeSharePayload(anonOffers);
}

// ---------------------------------------------------------------------------
// Decoding
// ---------------------------------------------------------------------------

/** Max token length accepted for decoding; larger tokens are rejected before
 * decompression to prevent decompression-bomb DoS from crafted links. */
export const MAX_SHARE_TOKEN_LENGTH = 50 * 1024;

/**
 * Decode a share token, detecting whether it is an anonymized (v2) payload.
 * v1 payloads parse exactly as before (backward compatible).
 */
export function parseShareToken(token: string): ParsedShare | null {
  // Reject oversized tokens before decompression: a crafted token is a
  // decompression bomb that can hang the tab. Real share tokens are a few KB.
  if (token.length > MAX_SHARE_TOKEN_LENGTH) {
    console.warn('Rejected oversized share token');
    return null;
  }
  try {
    const json = decompressFromEncodedURIComponent(token);
    if (!json) return null;
    const parsed: unknown = JSON.parse(json);
    const v2 = AnonSharePayloadSchema.safeParse(parsed);
    if (v2.success) return { anon: true, payload: v2.data };
    const v1 = SharePayloadSchema.safeParse(parsed);
    if (v1.success) return { anon: false, payload: v1.data };
    return null;
  } catch (err) {
    console.warn('Failed to decode share token', err);
    return null;
  }
}

/** Backward-compatible decode: returns the payload (v1 or v2) or null. */
export function decodeShareToken(token: string): AnySharePayload | null {
  const parsed = parseShareToken(token);
  return parsed ? parsed.payload : null;
}

export function payloadToSnapshot(payload: SharePayload): SnapshotInput {
  return {
    offers: JSON.parse(JSON.stringify(payload.offers)) as TOffer[],
    activeIndex: payload.activeIndex,
    uiMode: payload.uiMode ?? 'simple',
  };
}

/**
 * Convert an anonymized payload into importable offers: quarter-rounded
 * dates ("2025-Q1") are expanded back to ISO quarter starts ("2025-01-01")
 * so the compute path keeps working. No real names are reintroduced.
 */
export function anonPayloadToOffers(payload: AnonSharePayload): TOffer[] {
  const offers = JSON.parse(JSON.stringify(payload.offers)) as TOffer[];

  return offers.map((offer) => {
    const fixed: TOffer = { ...offer };
    fixed.startDate = expandQuarterToDate(fixed.startDate);
    fixed.raises = (fixed.raises ?? []).map((raise) => ({ ...raise, effectiveDate: expandQuarterToDate(raise.effectiveDate) }));
    fixed.signingBonuses = (fixed.signingBonuses ?? []).map((bonus) => ({ ...bonus, payDate: expandQuarterToDate(bonus.payDate) }));
    fixed.relocationBonuses = (fixed.relocationBonuses ?? []).map((bonus) => ({ ...bonus, payDate: expandQuarterToDate(bonus.payDate) }));
    fixed.equityGrants = (fixed.equityGrants ?? []).map((grant) => {
      const g = { ...grant };
      if (g.grantStartDate) g.grantStartDate = expandQuarterToDate(g.grantStartDate);
      if (g.vesting.model === 'explicit') {
        g.vesting = { ...g.vesting, tranches: g.vesting.tranches.map((tranche) => ({ ...tranche, date: expandQuarterToDate(tranche.date) })) };
      }
      return g;
    });
    return fixed;
  });
}
