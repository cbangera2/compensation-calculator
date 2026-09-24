import { describe, it, expect } from 'vitest';
import {
  COMPARE_CITIES,
  compareCities,
  getCompareCity,
} from '@/core/cityCompare';

const sunnyvale = getCompareCity('renter-sunnyvale')!;
const annArbor = getCompareCity('renter-ann-arbor')!;
const seattle = getCompareCity('sea')!;
const austin = getCompareCity('aus')!;

describe('getCompareCity', () => {
  it('exposes the renter-model cities with their documented factors', () => {
    expect(sunnyvale.colFactor).toBe(1.47);
    expect(sunnyvale.renterModel).toBe(true);
    expect(annArbor.colFactor).toBe(1.0);
    expect(annArbor.renterModel).toBe(true);
    expect(getCompareCity('renter-dc')!.colFactor).toBe(1.2);
  });

  it('falls back to generic presets for cities without renter data', () => {
    expect(seattle.renterModel).toBe(false);
    expect(seattle.colFactor).toBe(1.18);
    expect(austin.stateTaxRate).toBe(0);
  });

  it('returns undefined for an unknown key', () => {
    expect(getCompareCity('nope')).toBeUndefined();
  });

  it('has unique keys', () => {
    const keys = COMPARE_CITIES.map((c) => c.key);
    expect(new Set(keys).size).toBe(keys.length);
  });
});

describe('compareCities', () => {
  it('converts Sunnyvale -> Ann Arbor with the 1.47 anchor (COL only)', () => {
    const r = compareCities({ from: sunnyvale, to: annArbor, nominalComp: 200_000 });
    // 200_000 * 1.00 / 1.47
    expect(r.equivalentColOnly).toBeCloseTo(136054.42, 1);
    expect(r.purchasingPower).toBeCloseTo(136054.42, 1);
  });

  it('round-trips Ann Arbor -> Sunnyvale', () => {
    const r = compareCities({ from: annArbor, to: sunnyvale, nominalComp: 136054.42 });
    expect(r.equivalentColOnly).toBeCloseTo(200_000, 0);
  });

  it('applies the state-tax differential on the cash portion', () => {
    const r = compareCities({ from: sunnyvale, to: annArbor, nominalComp: 200_000, cashFraction: 1 });
    // CA ~9.3% on $200K cash
    expect(r.fromStateTax).toBeCloseTo(18_600, 0);
    // Moving to lower-tax MI means the after-tax equivalent is BELOW the COL-only figure
    expect(r.equivalentAfterTax).toBeLessThan(r.equivalentColOnly);
    // Exact formula: N·(1 − r_from)/(1 − r_to)·(c_to/c_from)
    const expected = (200_000 * (1 - 0.093) * (1.0 / 1.47)) / (1 - 0.0425);
    expect(r.equivalentAfterTax).toBeCloseTo(expected, 1);
    // Tax delta is a saving (negative)
    expect(r.taxDelta).toBeLessThan(0);
  });

  it('tax differential flips sign moving into a higher-tax city', () => {
    const r = compareCities({ from: austin, to: sunnyvale, nominalComp: 150_000 });
    expect(r.fromStateTax).toBe(0);
    expect(r.toStateTax).toBeGreaterThan(0);
    expect(r.taxDelta).toBeGreaterThan(0);
    expect(r.equivalentAfterTax).toBeGreaterThan(r.equivalentColOnly);
  });

  it('honors cashFraction < 1 (equity portion escapes the state-tax hit)', () => {
    const all = compareCities({ from: sunnyvale, to: annArbor, nominalComp: 200_000, cashFraction: 1 });
    const half = compareCities({ from: sunnyvale, to: annArbor, nominalComp: 200_000, cashFraction: 0.5 });
    expect(half.fromStateTax).toBeCloseTo(all.fromStateTax / 2, 0);
    // Less cash exposed to the tax gap -> after-tax equivalent closer to COL-only
    expect(Math.abs(half.equivalentAfterTax - half.equivalentColOnly)).toBeLessThan(
      Math.abs(all.equivalentAfterTax - all.equivalentColOnly)
    );
  });

  it('clamps cashFraction to 0–1', () => {
    const over = compareCities({ from: sunnyvale, to: annArbor, nominalComp: 100_000, cashFraction: 1.5 });
    expect(over.cashFraction).toBe(1);
    const under = compareCities({ from: sunnyvale, to: annArbor, nominalComp: 100_000, cashFraction: -0.2 });
    expect(under.cashFraction).toBe(0);
    expect(under.fromStateTax).toBe(0);
    // No tax exposure -> after-tax equivalent equals COL-only
    expect(under.equivalentAfterTax).toBeCloseTo(under.equivalentColOnly, 6);
  });

  it('is an identity for the same city', () => {
    const r = compareCities({ from: sunnyvale, to: sunnyvale, nominalComp: 200_000 });
    expect(r.equivalentColOnly).toBe(200_000);
    expect(r.equivalentAfterTax).toBe(200_000);
    expect(r.verdict).toContain('same city');
  });

  it('handles zero / negative / NaN comp gracefully', () => {
    for (const nominalComp of [0, -50_000, NaN]) {
      const r = compareCities({ from: sunnyvale, to: annArbor, nominalComp });
      expect(r.equivalentColOnly).toBe(0);
      expect(r.equivalentAfterTax).toBe(0);
      expect(r.verdict).toContain('above $0');
    }
  });

  it('writes a plain-English verdict with both city names', () => {
    const r = compareCities({ from: sunnyvale, to: annArbor, nominalComp: 200_000 });
    expect(r.verdict).toContain('Bay Area');
    expect(r.verdict).toContain('Ann Arbor');
    expect(r.verdict).toContain('≈');
  });
});

describe('household toggle', () => {
  it('defaults to single (no adjustment) when omitted', () => {
    const def = compareCities({ from: sunnyvale, to: annArbor, nominalComp: 200_000 });
    const single = compareCities({ from: sunnyvale, to: annArbor, nominalComp: 200_000, household: 'single' });
    expect(def.household).toBe('single');
    expect(def.fromStateTax).toBe(single.fromStateTax);
    expect(def.equivalentAfterTax).toBe(single.equivalentAfterTax);
  });

  it('married filing jointly scales the state-tax estimate by 0.85×', () => {
    const single = compareCities({ from: sunnyvale, to: annArbor, nominalComp: 200_000, household: 'single' });
    const married = compareCities({ from: sunnyvale, to: annArbor, nominalComp: 200_000, household: 'married' });
    expect(married.household).toBe('married');
    expect(married.fromStateTax).toBeCloseTo(single.fromStateTax * 0.85, 6);
    // Exact formula with adjusted rates: N·(1 − f·0.85·r_from)/(1 − f·0.85·r_to)·(c_to/c_from)
    const expected =
      (200_000 * (1 - 0.85 * 0.093) * (1.0 / 1.47)) / (1 - 0.85 * 0.0425);
    expect(married.equivalentAfterTax).toBeCloseTo(expected, 1);
    // Smaller tax gap -> after-tax equivalent closer to COL-only
    expect(Math.abs(married.equivalentAfterTax - married.equivalentColOnly)).toBeLessThan(
      Math.abs(single.equivalentAfterTax - single.equivalentColOnly)
    );
  });

  it('labels the verdict when the married adjustment is active', () => {
    const r = compareCities({ from: sunnyvale, to: annArbor, nominalComp: 200_000, household: 'married' });
    expect(r.verdict).toContain('married filing jointly');
  });

  it('applies the factor on the same-city path too', () => {
    const r = compareCities({ from: sunnyvale, to: sunnyvale, nominalComp: 200_000, household: 'married' });
    expect(r.fromStateTax).toBeCloseTo(200_000 * 0.093 * 0.85, 0);
    expect(r.equivalentAfterTax).toBe(200_000);
  });

  it('treats an unknown household value as single', () => {
    const r = compareCities({
      from: sunnyvale,
      to: annArbor,
      nominalComp: 200_000,
      household: 'divorced' as unknown as 'single',
    });
    expect(r.household).toBe('single');
    expect(r.fromStateTax).toBeCloseTo(200_000 * 0.093, 0);
  });
});

const nyc = getCompareCity('nyc')!;

describe('NYC local tax (I8)', () => {
  it('pins the NYC effective rate at ~9.5% (state ~6.5% + ~3% NYC local estimate)', () => {
    expect(nyc.stateTaxRate).toBe(0.095);
  });

  it('applies the folded-in rate to NYC as the from-city', () => {
    const r = compareCities({ from: nyc, to: austin, nominalComp: 200_000 });
    expect(r.fromStateTax).toBeCloseTo(19_000, 6);
  });

  it('applies the folded-in rate to NYC as the to-city', () => {
    const r = compareCities({ from: austin, to: nyc, nominalComp: 100_000 });
    expect(r.toStateTax).toBeCloseTo(r.equivalentAfterTax * 0.095, 6);
  });

  it('stacks the married 0.85× factor on top of the NYC rate', () => {
    const r = compareCities({ from: nyc, to: austin, nominalComp: 200_000, household: 'married' });
    expect(r.fromStateTax).toBeCloseTo(200_000 * 0.095 * 0.85, 6);
  });
});

describe('cross-model flag (I9)', () => {
  it('is false for same-model pairs', () => {
    expect(compareCities({ from: sunnyvale, to: annArbor, nominalComp: 200_000 }).crossModel).toBe(false);
    expect(compareCities({ from: austin, to: seattle, nominalComp: 100_000 }).crossModel).toBe(false);
  });

  it('is true for cross-model pairs in either direction', () => {
    expect(compareCities({ from: sunnyvale, to: nyc, nominalComp: 200_000 }).crossModel).toBe(true);
    expect(compareCities({ from: nyc, to: sunnyvale, nominalComp: 200_000 }).crossModel).toBe(true);
    expect(compareCities({ from: annArbor, to: austin, nominalComp: 100_000 }).crossModel).toBe(true);
  });

  it('is set even on the zero-comp early-return path', () => {
    const r = compareCities({ from: sunnyvale, to: nyc, nominalComp: 0 });
    expect(r.crossModel).toBe(true);
    expect(r.equivalentAfterTax).toBe(0);
  });

  it('keeps generic-preset pairs on a consistent base (round-trip)', () => {
    const out = compareCities({ from: seattle, to: austin, nominalComp: 118_000 });
    // 118_000 * 1.05 / 1.18
    expect(out.equivalentColOnly).toBeCloseTo(105_000, 0);
    const back = compareCities({ from: austin, to: seattle, nominalComp: out.equivalentColOnly });
    expect(back.equivalentColOnly).toBeCloseTo(118_000, 0);
  });

  it('does not touch the calibrated renter-model factors', () => {
    expect(getCompareCity('renter-ann-arbor')!.colFactor).toBe(1.0);
    expect(getCompareCity('renter-dc')!.colFactor).toBe(1.2);
    expect(getCompareCity('renter-sunnyvale')!.colFactor).toBe(1.47);
  });
});
