import { TVestingSchedule } from '@/models/types';
import { addMonths, differenceInCalendarMonths } from 'date-fns';

export type Tranche = { date: string; shares: number };

export function expandVesting(
  schedule: TVestingSchedule,
  grantStartDate: string,
  totalShares: number
): Tranche[] {
  if (!schedule || typeof schedule !== 'object' || !('model' in schedule)) {
    throw new TypeError('Invalid vesting schedule: expected an object with a model property');
  }
  if (schedule.model === 'explicit') {
  // If the provided tranches represent fractions (e.g., 0.38, 0.32, ...),
  // scale them to sum to totalShares. If they already look like shares,
  // this still preserves totals.
  const sum = schedule.tranches.reduce((a, t) => a + t.shares, 0) || 1;
  const factor = totalShares / sum;
  return schedule.tranches.map(t => ({ date: t.date, shares: t.shares * factor }));
  }
  if (schedule.model === 'milestone') {
    const start = new Date(grantStartDate);
    const sum = schedule.steps.reduce((a, s) => a + s.fraction, 0) || 1;
    const factor = totalShares / sum;
    return schedule.steps.map(s => ({ date: addMonths(start, s.monthsFromStart).toISOString(), shares: s.fraction * factor }));
  }
  // standard schedule
  const start = new Date(grantStartDate);
  const totalMonths = schedule.years * 12;
  const cliff = schedule.cliffMonths;
  const freq = schedule.frequency;
  const dist = schedule.distribution ?? 'even';
  // If cliffPercent is 0 (unspecified or explicitly zero), default to the
  // proportion of time until the cliff. This matches common plans where a
  // 12-month cliff on a 4-year schedule vests 25% at the cliff.
  const impliedCliffPct = cliff > 0 && totalMonths > 0 ? cliff / totalMonths : 0;
  const rawCliffPct = schedule.cliffPercent ?? 0;
  const cliffPct = Math.max(0, Math.min(1, rawCliffPct > 0 ? rawCliffPct : impliedCliffPct));

  const step = freq === 'monthly' ? 1 : freq === 'quarterly' ? 3 : 12;
  const trancheCount = Math.floor((totalMonths - cliff) / step) + 1; // includes cliff tranche

  // Frontloaded distribution: use a fixed yearly split of 38/32/20/10 for 4-year plans
  // Implementation details:
  // - Allocate the Year 1 share entirely at the cliff tranche.
  // - Distribute Years 2-4 shares evenly across tranches within each year based on frequency.
  // - If cliffPercent is explicitly provided (> 0), respect it and scale the remaining years to sum to (1 - cliffPercent).
  if (dist === 'frontloaded' && schedule.years === 4 && trancheCount > 0 && totalMonths === 48 && cliff >= 12) {
    const tranches: Tranche[] = [];
    const yearlyFractions = [0.38, 0.32, 0.20, 0.10];
    const rawCliffPct = schedule.cliffPercent ?? 0;
    const cliffPct = Math.max(0, Math.min(1, rawCliffPct > 0 ? rawCliffPct : yearlyFractions[0]));
    // Push the cliff tranche with the Year 1 allocation
    const cliffShares = totalShares * cliffPct;
    tranches.push({ date: addMonths(start, cliff).toISOString(), shares: cliffShares });

    // Determine per-year targets for Years 2-4
    const remainingTarget = Math.max(0, 1 - cliffPct);
    const baseRemaining = yearlyFractions.slice(1).reduce((a, b) => a + b, 0) || 1;
    const scale = remainingTarget / baseRemaining;
    const targets = [cliffPct, yearlyFractions[1] * scale, yearlyFractions[2] * scale, yearlyFractions[3] * scale];

    // Gather tranche months by year for Years 2..4
    const perYearMonths: number[][] = [[], [], [], []];
    for (let m = cliff + step; m <= totalMonths; m += step) {
      const yearIdx = Math.ceil(m / 12) - 1; // 0-based; 12->1, 24->1, 25->2, ...
      if (yearIdx >= 1 && yearIdx <= 3) perYearMonths[yearIdx].push(m);
    }
    // Distribute each year's target evenly across its tranches
    for (let y = 1; y <= 3; y++) {
      const months = perYearMonths[y];
      if (months.length === 0) continue;
      const perTranche = totalShares * (targets[y] / months.length);
      for (const m of months) tranches.push({ date: addMonths(start, m).toISOString(), shares: perTranche });
    }
    // Normalize to compensate for floating point drift
    const sum = tranches.reduce((a, t) => a + t.shares, 0) || 1;
    const factor = totalShares / sum;
    return tranches.map(t => ({ ...t, shares: t.shares * factor }));
  }

  // Determine weights per tranche based on distribution
  const weights: number[] = [];
  for (let idx = 0; idx < trancheCount; idx++) {
    if (dist === 'even') weights.push(1);
    else if (dist === 'frontloaded') weights.push(trancheCount - idx);
    else weights.push(idx + 1);
  }
  const weightSum = weights.reduce((a, b) => a + b, 0) || 1;
  const tranches: Tranche[] = [];

  // First tranche at cliff
  const cliffShares = cliffPct > 0 ? totalShares * cliffPct : (weights[0] / weightSum) * totalShares;
  tranches.push({ date: addMonths(start, cliff).toISOString(), shares: cliffShares });
  // Remaining tranches evenly spaced
  // Recompute remaining weights if we forced a cliff percent
  const remainingTotal = Math.max(0, totalShares - cliffShares);
  const remainingWeight = weights.slice(1).reduce((a, b) => a + b, 0) || 1;
  for (let m = cliff + step, idx = 1; m <= totalMonths; m += step, idx++) {
    const portion = remainingTotal * (weights[idx] / remainingWeight);
    tranches.push({ date: addMonths(start, m).toISOString(), shares: portion });
  }
  // Normalize to exactly totalShares due to floating point fuzz
  const sum = tranches.reduce((a, t) => a + t.shares, 0) || 1;
  const factor = totalShares / sum;
  return tranches.map(t => ({ ...t, shares: t.shares * factor }));
}

export function prorateByDateRange(
  yearlyStart: Date,
  yearlyEnd: Date,
  changeDate: Date
) {
  const total = differenceInCalendarMonths(yearlyEnd, yearlyStart) || 12;
  const before = Math.max(0, differenceInCalendarMonths(changeDate, yearlyStart));
  const after = Math.max(0, total - before);
  return { beforeMonths: before, afterMonths: after, totalMonths: total };
}
