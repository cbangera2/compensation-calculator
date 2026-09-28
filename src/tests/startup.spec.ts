import { describe, it, expect } from 'vitest';
import {
  impliedSharePrice,
  optionNetValue,
  rsuValue,
  exerciseCost,
  annualizeGrantValue,
  liquidityKeep,
  valuateStartupEquity,
  sampleStartupEquity,
} from '@/core/startup';
import { StartupEquity } from '@/models/types';

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
  it('values the sample block at its stored valuation (30% illiquidity discount on)', () => {
    const block = sampleStartupEquity();
    const v = valuateStartupEquity(block);
    // $6B / 100M shares = $60/share; 30% discount -> keep 0.7
    expect(v.sharePrice).toBe(60);
    expect(v.liquidityDiscount).toBe(0.3);
    expect(v.grants).toHaveLength(2);

    const [opt, rsu] = v.grants;
    // option grant value at FMV $38: (38-30)*3000 = 24_000; paper net at $60: (60-30)*3000 = 90_000
    expect(opt.kind).toBe('option');
    expect(opt.grantValue).toBe(24_000); // grant-date FMV: never discounted
    expect(opt.netValue).toBe(90_000 * 0.7);
    expect(opt.exerciseCost).toBe(90_000); // cash cost: never discounted
    // annualized at the SCENARIO share price ($60), discounted: 90_000/4 * 0.7
    expect(opt.annualizedGrantValue).toBe(22_500 * 0.7);

    // rsu grant: paper net at $60 = 15_000; discounted = 10_500
    expect(rsu.kind).toBe('rsu');
    expect(rsu.grantValue).toBe(15_000);
    expect(rsu.netValue).toBe(15_000 * 0.7);
    expect(rsu.exerciseCost).toBe(0);
    expect(rsu.annualizedGrantValue).toBe(7_500 * 0.7);

    expect(v.totalGrantValue).toBe(39_000);
    expect(v.totalPaperNetValue).toBe(105_000); // pre-discount paper mark stays visible
    expect(v.totalNetValue).toBe(105_000 * 0.7);
    expect(v.totalExerciseCost).toBe(90_000);
    expect(v.totalAnnualizedGrantValue).toBe(30_000 * 0.7);
  });

  it('supports a valuation override (e.g. from a slider)', () => {
    const block = sampleStartupEquity();
    // $15B -> $150/share, 30% discount
    const v = valuateStartupEquity(block, 15_000_000_000);
    expect(v.sharePrice).toBe(150);
    expect(v.totalNetValue).toBe(((150 - 30) * 3000 + 250 * 150) * 0.7);
    expect(v.totalPaperNetValue).toBe((150 - 30) * 3000 + 250 * 150);
  });

  it('moves the annualized figure when the valuation scenario changes', () => {
    const block = sampleStartupEquity();
    const low = valuateStartupEquity(block, 6_000_000_000); // $60/share
    const high = valuateStartupEquity(block, 15_000_000_000); // $150/share
    // Regression: annualized used to be frozen at grant-FMV basis while
    // total net value moved with the slider. Both must move now.
    expect(high.totalAnnualizedGrantValue).toBeGreaterThan(low.totalAnnualizedGrantValue);
    expect(high.totalAnnualizedGrantValue).toBe(((150 - 30) * 3000 / 4 + (250 * 150) / 2) * 0.7);
    expect(low.totalAnnualizedGrantValue).toBe(((60 - 30) * 3000 / 4 + (250 * 60) / 2) * 0.7);
    // Grant-FMV reference figures stay put.
    expect(high.totalGrantValue).toBe(low.totalGrantValue);
  });

  it('handles an empty block', () => {
    const v = valuateStartupEquity({
      enabled: true,
      companyName: 'Example Startup',
      valuation: 1_000_000_000,
      fullyDilutedShares: 100_000_000,
      liquidityDiscount: 0.3,
      optionGrants: [],
      rsuGrants: [],
      savedScenarios: [],
    });
    expect(v.sharePrice).toBe(10);
    expect(v.grants).toHaveLength(0);
    expect(v.totalNetValue).toBe(0);
    expect(v.totalPaperNetValue).toBe(0);
  });
});

describe('liquidityKeep', () => {
  it('defaults a missing discount to 0.3', () => {
    expect(liquidityKeep({})).toBe(0.7);
    expect(liquidityKeep({ liquidityDiscount: undefined })).toBe(0.7);
    expect(liquidityKeep({ liquidityDiscount: null })).toBe(0.7);
  });

  it('clamps out-of-range discounts', () => {
    expect(liquidityKeep({ liquidityDiscount: 1.5 })).toBe(0);
    expect(liquidityKeep({ liquidityDiscount: -0.2 })).toBe(1);
  });

  it('passes through in-range discounts', () => {
    expect(liquidityKeep({ liquidityDiscount: 0 })).toBe(1);
    expect(liquidityKeep({ liquidityDiscount: 0.2 })).toBeCloseTo(0.8, 10);
  });
});

describe('StartupEquity schema', () => {
  it('defaults liquidityDiscount to 0.3 when absent', () => {
    const parsed = StartupEquity.parse({});
    expect(parsed.liquidityDiscount).toBe(0.3);
  });

  it('rejects discounts outside 0..1', () => {
    expect(() => StartupEquity.parse({ liquidityDiscount: 1.5 })).toThrow();
    expect(() => StartupEquity.parse({ liquidityDiscount: -0.1 })).toThrow();
  });
});

describe('valuateStartupEquity discount behavior', () => {
  it('applies no haircut at 0% discount', () => {
    const block = { ...sampleStartupEquity(), liquidityDiscount: 0 };
    const v = valuateStartupEquity(block);
    expect(v.totalNetValue).toBe(v.totalPaperNetValue);
    expect(v.totalNetValue).toBe(105_000);
  });

  it('zeroes scenario value at 100% discount but keeps grant reference', () => {
    const block = { ...sampleStartupEquity(), liquidityDiscount: 1 };
    const v = valuateStartupEquity(block);
    expect(v.totalNetValue).toBe(0);
    expect(v.totalAnnualizedGrantValue).toBe(0);
    expect(v.totalPaperNetValue).toBe(105_000);
    expect(v.totalGrantValue).toBe(39_000);
    expect(v.totalExerciseCost).toBe(90_000);
  });
});