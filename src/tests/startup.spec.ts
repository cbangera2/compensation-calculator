import { describe, it, expect } from 'vitest';
import {
  impliedSharePrice,
  optionNetValue,
  rsuValue,
  exerciseCost,
  annualizeGrantValue,
  valuateStartupEquity,
  sampleStartupEquity,
} from '@/core/startup';

describe('impliedSharePrice', () => {
  it('divides valuation by fully diluted shares', () => {
    expect(impliedSharePrice(6_000_000_000, 100_000_000)).toBe(60);
  });

  it('returns 0 for non-positive or invalid share counts', () => {
    expect(impliedSharePrice(1_000_000_000, 0)).toBe(0);
    expect(impliedSharePrice(1_000_000_000, -5)).toBe(0);
    expect(impliedSharePrice(1_000_000_000, NaN)).toBe(0);
  });

  it('clamps negative valuations to 0', () => {
    expect(impliedSharePrice(-100, 100_000_000)).toBe(0);
  });
});

describe('optionNetValue', () => {
  it('computes intrinsic value in the money', () => {
    // 3000 options, $30 strike, $60 share price -> (60-30)*3000 = 90_000
    expect(optionNetValue(3000, 30, 60)).toBe(90_000);
  });

  it('is 0 when underwater', () => {
    expect(optionNetValue(3000, 80, 60)).toBe(0);
  });

  it('is 0 at exactly the strike', () => {
    expect(optionNetValue(3000, 60, 60)).toBe(0);
  });
});

describe('rsuValue', () => {
  it('values shares at the share price', () => {
    expect(rsuValue(250, 60)).toBe(15_000);
  });

  it('is 0 for zero shares', () => {
    expect(rsuValue(0, 60)).toBe(0);
  });
});

describe('exerciseCost', () => {
  it('is strike times quantity', () => {
    expect(exerciseCost(3000, 30)).toBe(90_000);
  });

  it('is 0 for zero quantity', () => {
    expect(exerciseCost(0, 30)).toBe(0);
  });
});

describe('annualizeGrantValue', () => {
  it('spreads value evenly over vest years', () => {
    expect(annualizeGrantValue(120_000, 4)).toBe(30_000);
  });

  it('supports fractional vest years', () => {
    expect(annualizeGrantValue(15_000, 2)).toBe(7_500);
  });

  it('returns 0 for non-positive vest years', () => {
    expect(annualizeGrantValue(15_000, 0)).toBe(0);
  });
});

describe('valuateStartupEquity', () => {
  it('values the sample block at its stored valuation', () => {
    const block = sampleStartupEquity();
    const v = valuateStartupEquity(block);
    // $6B / 100M shares = $60/share
    expect(v.sharePrice).toBe(60);
    expect(v.grants).toHaveLength(2);

    const [opt, rsu] = v.grants;
    // option grant value at FMV $38: (38-30)*3000 = 24_000; net at $60: (60-30)*3000 = 90_000
    expect(opt.kind).toBe('option');
    expect(opt.grantValue).toBe(24_000);
    expect(opt.netValue).toBe(90_000);
    expect(opt.exerciseCost).toBe(90_000);
    // annualized at the SCENARIO share price ($60), not grant FMV: 90_000/4
    expect(opt.annualizedGrantValue).toBe(22_500);

    // rsu grant: 250 shares @ $60 FMV = 15_000; net at $60 = 15_000
    expect(rsu.kind).toBe('rsu');
    expect(rsu.grantValue).toBe(15_000);
    expect(rsu.netValue).toBe(15_000);
    expect(rsu.exerciseCost).toBe(0);
    expect(rsu.annualizedGrantValue).toBe(7_500);

    expect(v.totalGrantValue).toBe(39_000);
    expect(v.totalNetValue).toBe(105_000);
    expect(v.totalExerciseCost).toBe(90_000);
    expect(v.totalAnnualizedGrantValue).toBe(30_000);
  });

  it('supports a valuation override (e.g. from a slider)', () => {
    const block = sampleStartupEquity();
    // $15B -> $150/share
    const v = valuateStartupEquity(block, 15_000_000_000);
    expect(v.sharePrice).toBe(150);
    expect(v.totalNetValue).toBe((150 - 30) * 3000 + 250 * 150);
  });

  it('moves the annualized figure when the valuation scenario changes', () => {
    const block = sampleStartupEquity();
    const low = valuateStartupEquity(block, 6_000_000_000); // $60/share
    const high = valuateStartupEquity(block, 15_000_000_000); // $150/share
    // Regression: annualized used to be frozen at grant-FMV basis while
    // total net value moved with the slider. Both must move now.
    expect(high.totalAnnualizedGrantValue).toBeGreaterThan(low.totalAnnualizedGrantValue);
    expect(high.totalAnnualizedGrantValue).toBe((150 - 30) * 3000 / 4 + (250 * 150) / 2);
    expect(low.totalAnnualizedGrantValue).toBe((60 - 30) * 3000 / 4 + (250 * 60) / 2);
    // Grant-FMV reference figures stay put.
    expect(high.totalGrantValue).toBe(low.totalGrantValue);
  });

  it('handles an empty block', () => {
    const v = valuateStartupEquity({
      enabled: true,
      companyName: 'Example Startup',
      valuation: 1_000_000_000,
      fullyDilutedShares: 100_000_000,
      optionGrants: [],
      rsuGrants: [],
      savedScenarios: [],
    });
    expect(v.sharePrice).toBe(10);
    expect(v.grants).toHaveLength(0);
    expect(v.totalNetValue).toBe(0);
  });
});
