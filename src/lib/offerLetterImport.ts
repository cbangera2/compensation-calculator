import type { TEquityGrant, TOffer, TVestingSchedule } from '@/models/types';

// Parse raw pasted offer-letter text into a TOffer. Heuristic regex-based,
// same philosophy as levelsImport.ts. NEVER throws: on garbage input it
// returns a partial offer plus an `unparsed` list of what it couldn't find,
// so the user can review/edit before anything becomes an offer.

/** Fields extracted from pasted offer-letter text. null = not found. */
export interface ExtractedOfferFields {
  company: string | null;
  base: number | null;
  signingBonus: number | null;
  relocationBonus: number | null;
  /** 0-1 fraction */
  targetBonusPercent: number | null;
  annualBonusFixed: number | null;
  rsuShares: number | null;
  /** grant dollar value when stated instead of (or in addition to) shares */
  rsuValue: number | null;
  optionShares: number | null;
  strikePrice: number | null;
  vestYears: number | null;
  cliffMonths: number | null;
  /** ISO yyyy-mm-dd */
  startDate: string | null;
  location: string | null;
}

export interface OfferLetterParseResult {
  offer: TOffer;
  extracted: ExtractedOfferFields;
  /** Human-readable labels of fields that could not be detected. */
  unparsed: string[];
}

const MAX_INPUT = 100_000;

const emptyFields = (): ExtractedOfferFields => ({
  company: null,
  base: null,
  signingBonus: null,
  relocationBonus: null,
  targetBonusPercent: null,
  annualBonusFixed: null,
  rsuShares: null,
  rsuValue: null,
  optionShares: null,
  strikePrice: null,
  vestYears: null,
  cliffMonths: null,
  startDate: null,
  location: null,
});

// ---------------------------------------------------------------------------
// money helpers
// ---------------------------------------------------------------------------

function parseMoney(digits: string, suffix: string | undefined): number {
  const n = Number(digits.replace(/,/g, ''));
  if (!Number.isFinite(n) || n <= 0) return 0;
  const s = suffix?.toLowerCase();
  const mult = s === 'k' ? 1_000 : s === 'm' ? 1_000_000 : 1;
  return n * mult;
}

interface MoneyToken {
  value: number;
  start: number;
  end: number;
}

/** All money tokens in a string with their positions. */
function moneyTokens(s: string): MoneyToken[] {
  const out: MoneyToken[] = [];
  const re = /(?:\$\s*)?([0-9]{1,3}(?:,[0-9]{3})+(?:\.[0-9]{1,2})?|[0-9]+(?:\.[0-9]{1,2})?)\s*([kKmM])?\b/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(s)) !== null) {
    const raw = m[0];
    const val = parseMoney(m[1], m[2]);
    if (val <= 0) continue;
    if (raw.includes('$') || m[2] || val >= 1000) {
      out.push({ value: val, start: m.index, end: m.index + raw.length });
    }
  }
  return out;
}

function firstMoney(s: string | null): number | null {
  if (!s) return null;
  const toks = moneyTokens(s);
  return toks.length ? toks[0].value : null;
}

function sliceAfter(text: string, label: RegExp, window = 80): string | null {
  const m = label.exec(text);
  if (!m || m.index === undefined) return null;
  const start = m.index + m[0].length;
  return text.slice(start, start + window);
}

/**
 * Money nearest a label wins: "$20,000 signing bonus" (money just before the
 * label) and "signing bonus of $20,000" (money just after) both work, while
 * numbers from neighboring sentences are ignored. A before-label candidate is
 * only accepted when it sits close to the label (<= 12 chars away).
 */
function moneyAround(text: string, label: RegExp, window = 80): number | null {
  const m = label.exec(text);
  if (!m || m.index === undefined) return null;
  const labelStart = m.index;
  const labelEnd = labelStart + m[0].length;
  const beforeSlice = text.slice(Math.max(0, labelStart - window), labelStart);
  const afterSlice = text.slice(labelEnd, labelEnd + window);
  const befores = moneyTokens(beforeSlice);
  const afters = moneyTokens(afterSlice);
  const b = befores.length ? befores[befores.length - 1] : null;
  const a = afters.length ? afters[0] : null;
  const bDist = b ? beforeSlice.length - b.end : Infinity;
  const aDist = a ? a.start : Infinity;
  const bClose = b !== null && bDist <= 12;
  if (bClose && bDist <= aDist) return b.value;
  if (a) return a.value;
  return bClose ? b.value : null;
}

// ---------------------------------------------------------------------------
// field extractors (each returns null when not found; none throw)
// ---------------------------------------------------------------------------

function extractBase(text: string): number | null {
  // Label-anchored: money right after "base salary" etc. Works even when the
  // same line/sentence later mentions bonuses.
  const labels = [/base\s+salary/i, /annual\s+salary/i, /starting\s+salary/i, /base\s+pay/i, /base\s+compensation/i];
  for (const label of labels) {
    const slice = sliceAfter(text, label, 60);
    if (!slice) continue;
    // The amount should follow the label closely ("base salary will be $165,000").
    const tok = moneyTokens(slice).find((t) => t.start <= 30);
    if (tok && tok.value >= 5000) return tok.value;
  }
  // Fallback: bare "salary" on a line with no bonus mention.
  const lines = text.split('\n');
  for (const line of lines) {
    if (/\bsalary\b/i.test(line) && !/bonus/i.test(line)) {
      const v = moneyAround(line, /\bsalary\b/i, 60);
      if (v !== null && v >= 5000) return v;
    }
  }
  return null;
}

function extractSigning(text: string): number | null {
  return moneyAround(text, /sign(?:ing|[\s-]*on)\s+bonus/i, 70);
}

function extractRelocation(text: string): number | null {
  const v = moneyAround(text, /relocation(?:\s+(?:bonus|assistance|package))?/i, 70);
  // Avoid mistaking a relocation *mention* without dollars for a value.
  return v;
}

function extractTargetBonusPercent(text: string): number | null {
  const pats = [
    /(?:target|annual)\s+bonus[^\n%]{0,50}?(\d+(?:\.\d+)?)\s*%/i,
    /bonus\s+(?:target\s+)?(?:of\s+|at\s+)?(\d+(?:\.\d+)?)\s*%\s*(?:of\s+base\s+salary)?/i,
  ];
  for (const p of pats) {
    const m = p.exec(text);
    if (m) {
      const pct = Number(m[1]);
      if (Number.isFinite(pct) && pct > 0 && pct <= 100) return pct / 100;
    }
  }
  return null;
}

function extractAnnualBonusFixed(text: string): number | null {
  // "annual bonus of $25,000" — only when no percent form matched.
  const slice = sliceAfter(text, /annual\s+bonus/i, 70);
  const v = firstMoney(slice);
  if (v === null) return null;
  // Guard: don't steal a signing-bonus number on a shared line.
  if (/sign/i.test(slice ?? '')) return null;
  return v;
}

function extractRsu(text: string): { shares: number | null; value: number | null } {
  let shares: number | null = null;
  let value: number | null = null;
  // Allow a few words between the number and "RSUs" ("$120,000 in RSUs").
  const re = /(\$?)\s*([0-9]{1,3}(?:,[0-9]{3})*|[0-9]+)(?:\s+[a-z]+){0,3}?\s*(?:RSUs?|restricted\s+stock\s+units?)\b/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const n = Number(m[2].replace(/,/g, ''));
    if (!Number.isFinite(n) || n <= 0) continue;
    if (m[1] === '$') {
      if (value === null) value = n; // "$120,000 in RSUs" = dollar value
    } else if (shares === null && n >= 10) {
      shares = n;
    }
  }
  return { shares, value };
}

function extractOptions(text: string): { shares: number | null; strike: number | null } {
  let shares: number | null = null;
  const re = /(\$?)\s*([0-9]{1,3}(?:,[0-9]{3})*|[0-9]+)(?:\s+[a-z]+){0,2}?\s*(?:stock\s+)?(?:options?|ISOs?|NSOs?)\b/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (m[1] === '$') continue; // dollar-valued option mention; not a share count
    const n = Number(m[2].replace(/,/g, ''));
    if (!Number.isFinite(n) || n < 10) continue;
    if (shares === null) shares = n;
  }
  const strikeSlice = sliceAfter(text, /(?:strike|exercise)\s+price/i, 60);
  const strike = firstMoney(strikeSlice);
  return { shares, strike: strike !== null && strike < 100_000 ? strike : null };
}

function extractEquityValue(text: string): number | null {
  // "equity grant of $200,000", "total equity $X", "stock grant valued at $X"
  const v =
    firstMoney(sliceAfter(text, /(?:total\s+)?equity\s+(?:grant\s+)?(?:of\s+|valued\s+at\s+)?/i, 60)) ??
    firstMoney(sliceAfter(text, /stock\s+grant\s+(?:of\s+|valued\s+at\s+)?/i, 60));
  return v;
}

function extractVesting(text: string): { years: number | null; cliffMonths: number | null } {
  let years: number | null = null;
  const yearPats = [
    /vest(?:ing)?\s+(?:over\s+)?(\d+)\s*[-\s]?years?/i,
    /over\s+a?\s*(\d+)\s*[-\s]?year\s+period/i,
    /(\d+)\s*[-\s]?year\s+vest/i,
  ];
  for (const p of yearPats) {
    const m = p.exec(text);
    if (m) {
      const y = Number(m[1]);
      if (Number.isFinite(y) && y >= 1 && y <= 10) {
        years = y;
        break;
      }
    }
  }
  let cliffMonths: number | null = null;
  const cliffYear = /(\d+)\s*[-\s]?year\s+cliff/i.exec(text) ?? /one[-\s]?year\s+cliff/i.exec(text);
  if (cliffYear) {
    cliffMonths = cliffYear[1] ? Number(cliffYear[1]) * 12 : 12;
  } else if (/\bcliff\b/i.test(text)) {
    cliffMonths = 12; // "cliff" mentioned without a duration: assume standard 1yr
  }
  return { years, cliffMonths };
}

const MONTHS: Record<string, number> = {
  january: 1, february: 2, march: 3, april: 4, may: 5, june: 6,
  july: 7, august: 8, september: 9, october: 10, november: 11, december: 12,
};

function toIso(y: number, mo: number, d: number): string | null {
  if (!Number.isFinite(y) || !Number.isFinite(mo) || !Number.isFinite(d)) return null;
  if (y < 2000 || y > 2100 || mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  return `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

function extractStartDate(text: string): string | null {
  const monthNames = Object.keys(MONTHS).join('|');
  // "start date ... July 15, 2024"
  const withContext = new RegExp(
    `(?:start|commence|begin|join|onboard|effective)[^\\n]{0,100}?\\b(${monthNames})\\w*\\s+(\\d{1,2})(?:st|nd|rd|th)?,?\\s+(\\d{4})`,
    'i',
  );
  let m = withContext.exec(text);
  if (m) {
    const iso = toIso(Number(m[3]), MONTHS[m[1].toLowerCase()], Number(m[2]));
    if (iso) return iso;
  }
  // ISO anywhere: 2024-07-15
  m = /(\d{4})-(\d{1,2})-(\d{1,2})/.exec(text);
  if (m) {
    const iso = toIso(Number(m[1]), Number(m[2]), Number(m[3]));
    if (iso) return iso;
  }
  // US numeric near a start-date mention: 07/15/2024
  const usSlice = sliceAfter(text, /start(?:ing)?\s+date/i, 80) ?? sliceAfter(text, /\bstart\b/i, 80);
  if (usSlice) {
    const um = /(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(usSlice);
    if (um) {
      const iso = toIso(Number(um[3]), Number(um[1]), Number(um[2]));
      if (iso) return iso;
    }
  }
  // Fallback: any month-name date in the letter (often the only date present).
  m = new RegExp(`\\b(${monthNames})\\w*\\s+(\\d{1,2})(?:st|nd|rd|th)?,?\\s+(\\d{4})`, 'i').exec(text);
  if (m) {
    const iso = toIso(Number(m[3]), MONTHS[m[1].toLowerCase()], Number(m[2]));
    if (iso) return iso;
  }
  return null;
}

function cleanCompany(s: string): string | null {
  // Cut role descriptors: "Anduril as a software engineer" -> "Anduril".
  const cut = s.split(/\s+as\s+(?:a|an|the)\s+/i)[0];
  const c = cut.trim().replace(/[.,;!]+$/, '').trim();
  if (c.length < 2 || c.length > 60) return null;
  if (/^(the|our|your|this|a|an)\b/i.test(c)) return null;
  if (/(position|offer|employment|team|role|opportunity|candidate)/i.test(c)) return null;
  if (!/^[A-Z]/.test(c)) return null;
  return c;
}

function extractCompany(text: string): string | null {
  const pats = [
    /(?:pleased|excited|delighted|happy)[^\n.]{0,80}?(?:to offer you|offer of employment)[^\n.]{0,60}?\b(?:at|with)\s+([A-Z][\w&'’.\- ]{1,40}?)(?=[.,\n]|$)/i,
    /\bon behalf of\s+([A-Z][\w&'’.\- ]{1,40}?)(?=[.,\n]|$)/,
    /\bjoin(?:ing)?\s+(?:the\s+team\s+at\s+)?([A-Z][\w&'’.\- ]{1,40}?)(?=[.,\n]|$)/,
    /welcome to\s+([A-Z][\w&'’.\- ]{1,40}?)(?=[!.,\n]|$)/i,
  ];
  for (const p of pats) {
    const m = p.exec(text);
    if (m) {
      const c = cleanCompany(m[1]);
      if (c) return c;
    }
  }
  return null;
}

function extractLocation(text: string): string | null {
  const m = /(?:based in|office in|located in|work\s+in)\s+([A-Z][a-zA-Z .'\-]{2,40}?(?:,\s*[A-Z]{2,3})?)(?=[.\n]|$)/.exec(text);
  if (m) {
    const loc = m[1].trim().replace(/[.,]+$/, '');
    if (loc.length >= 2 && !/remote/i.test(loc)) return loc;
  }
  return null;
}

// ---------------------------------------------------------------------------
// offer construction
// ---------------------------------------------------------------------------

function standardVesting(years: number, cliffMonths: number): TVestingSchedule {
  return {
    model: 'standard',
    years,
    cliffMonths,
    frequency: 'monthly',
    distribution: 'even',
    cliffPercent: 0.25,
  };
}

/** Build a TOffer from extracted (or user-edited) fields. Never throws. */
export function buildOfferFromFields(f: ExtractedOfferFields): TOffer {
  const today = new Date().toISOString().slice(0, 10);
  const startDate = f.startDate ?? today;
  const vesting = standardVesting(f.vestYears ?? 4, f.cliffMonths ?? 12);

  const grants: TEquityGrant[] = [];
  if (f.rsuShares !== null || f.rsuValue !== null) {
    grants.push({
      type: 'RSU',
      shares: f.rsuShares ?? 0,
      fmv: 10,
      ...(f.rsuValue !== null ? { targetValue: f.rsuValue, targetMode: 'total' as const } : {}),
      vesting,
    });
  }
  if (f.optionShares !== null) {
    grants.push({
      type: 'NSO',
      shares: f.optionShares,
      ...(f.strikePrice !== null ? { strike: f.strikePrice } : {}),
      fmv: f.strikePrice ?? 10,
      vesting,
    });
  }

  return {
    name: f.company || 'Pasted Offer',
    currency: 'USD',
    startDate,
    ...(f.location ? { location: f.location } : {}),
    colFactor: 1,
    base: { startAnnual: f.base ?? 0 },
    raises: [],
    equityGrants: grants,
    performanceBonus:
      f.targetBonusPercent !== null
        ? { kind: 'percent', value: f.targetBonusPercent, expectedPayout: 1 }
        : f.annualBonusFixed !== null
          ? { kind: 'fixed', value: f.annualBonusFixed, expectedPayout: 1 }
          : { kind: 'percent', value: 0, expectedPayout: 1 },
    growth: { startingPrice: 100, yoy: [0, 0, 0, 0] },
    signingBonuses: f.signingBonus !== null ? [{ amount: f.signingBonus, payDate: startDate }] : [],
    relocationBonuses: f.relocationBonus !== null ? [{ amount: f.relocationBonus, payDate: startDate }] : [],
    benefits: [],
    miscRecurring: [],
    assumptions: { horizonYears: 4, colAdjust: 1 },
  };
}

/** Parse pasted offer-letter text. Never throws — check `unparsed` for gaps. */
export function parseOfferLetter(input: string): OfferLetterParseResult {
  try {
    const text = String(input ?? '').slice(0, MAX_INPUT);
    const f = emptyFields();
    if (!text.trim()) {
      return { offer: buildOfferFromFields(f), extracted: f, unparsed: allLabels(f) };
    }

    f.company = extractCompany(text);
    f.base = extractBase(text);
    f.signingBonus = extractSigning(text);
    f.relocationBonus = extractRelocation(text);
    f.targetBonusPercent = extractTargetBonusPercent(text);
    if (f.targetBonusPercent === null) f.annualBonusFixed = extractAnnualBonusFixed(text);
    const rsu = extractRsu(text);
    f.rsuShares = rsu.shares;
    f.rsuValue = rsu.value ?? extractEquityValue(text);
    const opts = extractOptions(text);
    f.optionShares = opts.shares;
    f.strikePrice = opts.strike;
    const vest = extractVesting(text);
    f.vestYears = vest.years;
    f.cliffMonths = vest.cliffMonths;
    f.startDate = extractStartDate(text);
    f.location = extractLocation(text);

    return { offer: buildOfferFromFields(f), extracted: f, unparsed: allLabels(f) };
  } catch {
    // Absolute guarantee: never throw on hostile input.
    const f = emptyFields();
    return { offer: buildOfferFromFields(f), extracted: f, unparsed: allLabels(f) };
  }
}

function allLabels(f: ExtractedOfferFields): string[] {
  const missing: string[] = [];
  if (f.company === null) missing.push('company name');
  if (f.base === null) missing.push('base salary');
  if (f.signingBonus === null) missing.push('signing bonus');
  if (f.relocationBonus === null) missing.push('relocation bonus');
  if (f.targetBonusPercent === null && f.annualBonusFixed === null) missing.push('bonus target');
  if (f.rsuShares === null && f.rsuValue === null && f.optionShares === null) missing.push('equity grant');
  if (f.vestYears === null && f.cliffMonths === null) missing.push('vesting schedule');
  if (f.startDate === null) missing.push('start date');
  return missing;
}
