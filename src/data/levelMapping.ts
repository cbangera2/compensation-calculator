/**
 * levelMapping.ts — cross-company level mapping for the 10 north-star companies.
 *
 * Maps each company's real level labels onto the generic bands (Entry / Mid /
 * Senior) used by the benchmark core, and therefore onto each other
 * (Google L4 <-> Meta E4 <-> Apple ICT3 ...).
 *
 * Company level labels come from COMPANY_LEVEL_MAP in benchmarks.v2.ts so the
 * two files cannot drift apart. The VERIFICATION map below is the honest part:
 * every (company, band) pair is graded
 *   - 'verified'   — standard community mapping (levels.fyi), deep coverage
 *   - 'inferred'   — plausible inference from thinner community data
 *   - 'unverified' — company publishes no ladder; label is a placeholder
 * Anything not 'verified' must render with its marker in the UI, never as fact.
 */

import { COMPANY_LEVEL_MAP } from './benchmarks.v2';

export type GenericBand = 'Entry' | 'Mid' | 'Senior';

export type LevelVerification = 'verified' | 'inferred' | 'unverified';

export interface CompanyLevelMapping {
  company: string;
  band: GenericBand;
  /** Real company level label, e.g. "E4". */
  companyLevel: string;
  verification: LevelVerification;
  note?: string;
}

const BANDS: GenericBand[] = ['Entry', 'Mid', 'Senior'];

/**
 * Verification status + note per (company, band). Keyed by company; a single
 * entry may cover all bands or override per band.
 */
const VERIFICATION: Record<
  string,
  | { status: LevelVerification; note?: string }
  | Partial<Record<GenericBand, { status: LevelVerification; note?: string }>>
> = {
  Meta: {
    status: 'verified',
    note: 'Canonical community mapping; E3/E4/E5 <-> Google L3/L4/L5 is the industry-standard reference.',
  },
  Google: {
    status: 'verified',
    note: 'Reference ladder the other mappings are expressed against.',
  },
  Apple: {
    status: 'verified',
    note: 'ICT2/ICT3/ICT4 <-> L3/L4/L5 is the standard levels.fyi mapping.',
  },
  Microsoft: {
    Entry: { status: 'verified', note: 'Levels 59-60 map cleanly to entry band.' },
    Mid: { status: 'verified', note: 'Levels 61-62 map cleanly to mid band.' },
    Senior: {
      status: 'inferred',
      note: 'Levels 63-64 span the L4/L5 boundary; community mapping varies.',
    },
  },
  Palantir: {
    status: 'inferred',
    note: 'Palantir uses Google-style L-levels; mapping inferred from community data with thinner coverage.',
  },
  Tesla: {
    status: 'inferred',
    note: 'Tesla P-levels appear in community data but the ladder is unpublished; mapping is approximate.',
  },
  Stripe: {
    status: 'unverified',
    note: 'Stripe does not publish levels and community data is thin; labels are placeholders.',
  },
  SpaceX: {
    status: 'unverified',
    note: 'SpaceX publishes no engineering ladder; T-labels are placeholders.',
  },
  Anduril: {
    status: 'unverified',
    note: 'Anduril IC levels are reported inconsistently; E-labels are not confirmed.',
  },
  Bloomberg: {
    status: 'unverified',
    note: 'Bloomberg publishes no SWE bands; labels are placeholders.',
  },
};

function verificationFor(
  company: string,
  band: GenericBand,
): { status: LevelVerification; note?: string } {
  const entry = VERIFICATION[company];
  if (!entry) return { status: 'unverified', note: 'No mapping data.' };
  if ('status' in entry) return entry;
  return entry[band] ?? { status: 'unverified', note: 'No mapping data.' };
}

/** Flat list of every (company, band) mapping with verification metadata. */
export const LEVEL_MAPPINGS: CompanyLevelMapping[] = Object.keys(
  COMPANY_LEVEL_MAP,
).flatMap((company) =>
  BANDS.map((band) => {
    const { status, note } = verificationFor(company, band);
    return {
      company,
      band,
      companyLevel: COMPANY_LEVEL_MAP[company][band],
      verification: status,
      note,
    };
  }),
);

/** Companies in mapping-table order. */
export const MAPPED_COMPANIES: string[] = Object.keys(COMPANY_LEVEL_MAP);

export const GENERIC_BANDS: GenericBand[] = BANDS;

/** Look up one cell of the mapping matrix. */
export function levelMappingFor(
  company: string,
  band: GenericBand,
): CompanyLevelMapping | undefined {
  return LEVEL_MAPPINGS.find((m) => m.company === company && m.band === band);
}
