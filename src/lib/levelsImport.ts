import type { TEquityGrant, TOffer, TVestingSchedule } from '@/models/types';

// Parse a Levels.fyi offer HTML page into a TOffer. Heuristic-based; may break if site changes.
export function parseLevelsOfferFromHtml(html: string): TOffer {
  // Simple extraction heuristics; Levels changes may break these.
  // First, try to parse an embedded JSON payload that contains the offer (observed on saved pages).
  // Then, fallback to regex scraping for visible labels.
  let company = '';
  let base = 0;
  let signing = 0;
  let relocation = 0;
  let location = '';
  let equityTotal = 0; // dollars across 4 yrs if RSUs
  let optionsGranted = 0; // shares
  let strikePrice = 0;
  let preferredPrice = 0;
  let latestValuation = 0;
  let targetBonusPercent = 0; // 0-1
  let averageAnnualBonus = 0; // fixed $ per year if present
  // Vesting info parsed from HTML
  let vestingFractions: number[] | null = null; // e.g., [0.38,0.32,0.20,0.10]
  let totalGrantFromVesting = 0;

  // Helper to coerce numbers from text (with optional suffix K/M/B)
  const num = (s: string | undefined) => (s ? Number(s.replace(/[^0-9.]/g, '')) : 0);
  const numWithSuffix = (s: string | undefined) => {
    if (!s) return 0;
    const m = s.trim().match(/\$?([0-9.,]+)\s*([kKmMbB])?/);
    if (!m) return 0;
    const base = Number(m[1].replace(/,/g, '')) || 0;
    const suf = m[2]?.toLowerCase();
    const mult = suf === 'k' ? 1_000 : suf === 'm' ? 1_000_000 : suf === 'b' ? 1_000_000_000 : 1;
    return base * mult;
  };

  // Attempt 1: Find the embedded JSON object starting with {"uuid":..., ...}
  try {
    const offerJsonMatch = html.match(/(\{\s*"uuid"\s*:[\s\S]*?\})\s*,\s*"currency"\s*:/i);
    if (offerJsonMatch) {
      const obj = JSON.parse(offerJsonMatch[1]);
      company = obj.company || obj.companyInfo?.name || company;
      base = Number(obj.baseSalary || base) || base;
      location = obj.location || location;
      // Bonuses
      const bonusPct = Number(obj.annualTargetBonusPercentage);
      if (!Number.isNaN(bonusPct) && bonusPct > 0) targetBonusPercent = bonusPct / 100;
      // RSU values (avg annual -> approximate total across 4 yrs)
      const avgAnnualStock = Number(obj.avgAnnualStockGrantValue);
      if (!Number.isNaN(avgAnnualStock) && avgAnnualStock > 0) {
        equityTotal = Math.round(avgAnnualStock * 4);
      }
      // Options payload
      const totalOpts = Number(obj.totalOptionsGranted);
      const avgAnnualOpts = Number(obj.avgAnnualOptionsGranted);
      if (!Number.isNaN(totalOpts) && totalOpts > 0) optionsGranted = totalOpts;
      else if (!Number.isNaN(avgAnnualOpts) && avgAnnualOpts > 0) optionsGranted = Math.round(avgAnnualOpts * 4);
      strikePrice = Number(obj.optionStrikePrice || strikePrice) || strikePrice;
      preferredPrice = Number(obj.optionPreferredPrice || preferredPrice) || preferredPrice;
      latestValuation = Number(obj.latestCompanyValuation || latestValuation) || latestValuation;
    }
  } catch { /* ignore parse errors */ }

  // Attempt 2: Look for JSON objects in script tags as a heuristic (alternate builds)
  try {
    const jsonMatches = [...html.matchAll(/<script[^>]*>\s*({[\s\S]*?})\s*<\/script>/g)].map(m => m[1]);
    for (const jm of jsonMatches) {
      try {
        const obj = JSON.parse(jm);
        const text = JSON.stringify(obj).toLowerCase();
        if (text.includes('company') && (text.includes('basesalary') || text.includes('avgannualstockgrantvalue'))) {
          if (obj.company || obj.companyInfo?.name) company = obj.company || obj.companyInfo?.name || company;
          if (obj.base || obj.baseSalary) base = Number(obj.base || obj.baseSalary || base) || base;
          if (obj.signing) signing = Number(obj.signing) || signing;
          if (obj.relocation) relocation = Number(obj.relocation) || relocation;
          if (obj.location) location = obj.location || location;
          if (obj.avgAnnualStockGrantValue) equityTotal = Math.round(Number(obj.avgAnnualStockGrantValue) * 4) || equityTotal;
          if (obj.totalOptionsGranted || obj.avgAnnualOptionsGranted) {
            const total = Number(obj.totalOptionsGranted);
            const annual = Number(obj.avgAnnualOptionsGranted);
            if (!Number.isNaN(total) && total > 0) optionsGranted = total;
            else if (!Number.isNaN(annual) && annual > 0) optionsGranted = Math.round(annual * 4);
          }
          if (obj.optionStrikePrice) strikePrice = Number(obj.optionStrikePrice) || strikePrice;
          if (obj.optionPreferredPrice) preferredPrice = Number(obj.optionPreferredPrice) || preferredPrice;
          if (obj.latestCompanyValuation) latestValuation = Number(obj.latestCompanyValuation) || latestValuation;
          if (obj.annualTargetBonusPercentage) targetBonusPercent = Number(obj.annualTargetBonusPercentage) / 100;
        }
      } catch { /* ignore */ }
    }
  } catch { /* ignore top-level JSON parse */ }

  // Try to parse visible vesting schedule block
  try {
    const header = html.match(/Vesting\s+Schedule\s*\((\d+)\s*yr\)/i);
    if (header && header.index !== undefined) {
      const slice = html.slice(header.index, header.index + 4000);
      // Extract percentages like (38%), (32%), ...
      const pcts = [...slice.matchAll(/\((\d{1,3})%\)/g)].map(m => Number(m[1])).filter(n => !Number.isNaN(n));
      if (pcts.length >= 2) {
        const sum = pcts.reduce((a,b)=>a+b,0);
        if (sum > 0) vestingFractions = pcts.map(n => n/100);
      }
      // Extract Total Grant if present
      const totalMatch = slice.match(/Total\s+Grant:\s*\$([0-9.,]+\s*[kKmMbB]?)/i);
      if (totalMatch) totalGrantFromVesting = numWithSuffix(totalMatch[1]);
    }
  } catch { /* ignore vesting parse */ }

  const find = (label: RegExp) => {
    const m = html.match(label);
    return m?.[1];
  };
  if (!company) company = find(/Company:\s*<[^>]*>\s*([^<]+)/i) || company;
  if (!base) base = num(find(/Base[^$]*\$([0-9,]+)/i)) || base;
  if (!signing) signing = num(find(/Sign(?:ing|\s*On)[^$]*\$([0-9,]+)/i)) || signing;
  if (!relocation) relocation = num(find(/Relocation[^$]*\$([0-9,]+)/i)) || relocation;
  if (!equityTotal) {
    // Prefer "Average Annual Stock (RSUs)" then multiply by 4
    const annualStock = num(find(/Average\s+Annual\s+Stock\s*\(RSUs\)[^$]*\$([0-9,]+)/i));
    if (annualStock) equityTotal = annualStock * 4;
    else equityTotal = num(find(/Equity[^$]*\$([0-9,]+)/i)) || equityTotal;
  }
  // Average Annual Bonus (fixed $) - match singular/plural and common variants
  try {
    const bonusRegex = /(Average|Avg)\s+Annual\s+(?:Cash\s+)?Bonus(?:es)?[^$]*\$([0-9.,]+\s*[kKmMbB]?)/i;
    const bonusMatch = html.match(bonusRegex);
    if (bonusMatch) averageAnnualBonus = numWithSuffix(bonusMatch[2]);
  } catch { /* ignore */ }

  // Generic fallback: element labeled just "Bonus" with a dollar value nearby (avoid Signing/Relocation)
  if (!averageAnnualBonus) {
    try {
      // Work on text-only content to avoid tag boundaries hiding words
      const text = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
      const re = /Bonus(?!\s*(?:Percent|Percentage))[^$]{0,200}\$([0-9.,]+\s*[kKmMbB]?)/i;
      const m = re.exec(text);
      if (m && m.index !== undefined) {
        const pre = text.slice(Math.max(0, m.index - 40), m.index).toLowerCase();
        if (!/(signing|sign\s*on|relocation)/i.test(pre)) {
          averageAnnualBonus = numWithSuffix(m[1]);
        }
      }
    } catch { /* ignore */ }
  }
  // Example specific extractions
  if (!optionsGranted) optionsGranted = num(find(/([0-9,]+)\s*Options?\s+Granted/i)) || optionsGranted;
  if (!strikePrice) strikePrice = num(find(/Current\s+Strike\s+Price[^$]*\$([0-9.]+)/i)) || strikePrice;
  if (!preferredPrice) preferredPrice = num(find(/Preferred\s+Price[^$]*\$([0-9.]+)/i)) || preferredPrice;
  if (!latestValuation) latestValuation = numWithSuffix(find(/Latest\s+Valuation[^$]*\$?([0-9.,]+\s*[kKmMbB]?)/i)) || latestValuation;

  // Prefer Total Grant from vesting when available
  if (totalGrantFromVesting > 0) equityTotal = totalGrantFromVesting;

  // Construct a minimal offer using our schema defaults
  const today = new Date().toISOString().slice(0,10);
  const buildMilestoneVesting = (): TVestingSchedule | undefined => {
    if (!vestingFractions || vestingFractions.length === 0) return undefined;
    // Map Y1..Y4 to months 12,24,36,48 as fractions; engine will scale to total shares
    const steps = vestingFractions.map((f, idx) => ({ monthsFromStart: (idx + 1) * 12, fraction: f }));
    return { model: 'milestone', steps };
  };

  const offer: TOffer = {
    name: company || 'Imported Offer',
    currency: 'USD',
    startDate: today,
    base: { startAnnual: base || 0 },
    raises: [],
    equityGrants: (() => {
      const grants: TEquityGrant[] = [];
      // If we have options info, create an Option grant (default NSO), otherwise if we have equityTotal, create an RSU target grant
      if (optionsGranted > 0) {
        grants.push({
          type: 'NSO',
          shares: optionsGranted,
          strike: strikePrice || undefined,
          fmv: preferredPrice || 10,
          vesting: buildMilestoneVesting() ?? { model: 'standard', years: 4, cliffMonths: 12, frequency: 'monthly', distribution: 'even', cliffPercent: 0.25 },
        });
      } else if (equityTotal > 0) {
        grants.push({
          type: 'RSU',
          shares: 0,
          fmv: preferredPrice || 10,
          targetValue: equityTotal,
          targetMode: 'total',
          vesting: buildMilestoneVesting() ?? { model: 'standard', years: 4, cliffMonths: 12, frequency: 'monthly', distribution: 'even', cliffPercent: 0.25 },
        });
      }
      return grants;
    })(),
    performanceBonus: averageAnnualBonus > 0
      ? { kind: 'fixed', value: averageAnnualBonus, expectedPayout: 1 }
      : (targetBonusPercent
        ? { kind: 'percent', value: targetBonusPercent, expectedPayout: 1 }
        : { kind: 'percent', value: 0.1, expectedPayout: 1 }),
    growth: { startingPrice: preferredPrice || 100, yoy: [0, 0, 0, 0] },
    signingBonuses: signing ? [{ amount: signing, payDate: today }] : [],
    relocationBonuses: relocation ? [{ amount: relocation, payDate: today }] : [],
    benefits: [],
    miscRecurring: [],
    assumptions: { horizonYears: 4, colAdjust: 1 },
    // hint: latestValuation could be used to prepopulate explorer or annotations
  };

  return offer;
}
