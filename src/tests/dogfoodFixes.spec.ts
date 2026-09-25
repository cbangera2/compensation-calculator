/**
 * Regression tests for the 2026-09-25 dogfood fix pass:
 *  1. Startup-lab valuation slider reaches $10M (not clamped to $1B).
 *  2. Decision helpers show the startup valuation breakeven.
 *  3. New offers start blank (no inherited sample grants/bonus/raises).
 *  4. Leaderboard "You" rows for startups reprice at the active scenario
 *     (engine level: computeOffer must honor valuation, not grant intrinsic).
 *  5. formatValuation compact formatting.
 *  6. Startup leaderboard method discloses scenario repricing.
 *  7. Preset JSONs carry an explicit colFactor (no fabricated COL insight).
 */
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { valToSliderT, sliderTToVal } from '@/components/StartupPanel';
import { startupBreakevenLine } from '@/components/DecisionHelpers';
import { computeOffer } from '@/core/compute';
import { formatValuation } from '@/lib/utils';
import { offerToLeaderboardEntry } from '@/lib/userLeaderboard';
import type { TOffer, TStartupEquity } from '@/models/types';
import googlePresetJson from '../../public/presets/google.json';
import amazonPresetJson from '../../public/presets/amazon.json';
import metaPresetJson from '../../public/presets/meta.json';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function normalOffer(partial: Partial<TOffer> = {}): TOffer {
  return {
    name: 'DemoTech',
    currency: 'USD',
    startDate: '2025-01-01',
    location: 'San Francisco, CA',
    colFactor: 1.4,
    base: { startAnnual: 165_000 },
    raises: [],
    benefits: [],
    miscRecurring: [],
    equityGrants: [],
    assumptions: { horizonYears: 4, colAdjust: 1 },
    ...partial,
  };
}

function startupBlock(partial: Partial<TStartupEquity> = {}): TStartupEquity {
  return {
    enabled: true,
    companyName: 'DemoLabs',
    valuation: 5_000_000_000,
    fullyDilutedShares: 100_000_000,
    optionGrants: [
      {
        label: 'Options',
        quantity: 12_000,
        strike: 2,
        fmvAtGrant: 2,
        vestYears: 4,
        cliffMonths: 12,
      },
    ],
    rsuGrants: [],
    savedScenarios: [],
    ...partial,
  };
}

function startupOffer(): TOffer {
  return normalOffer({
    name: 'DemoLabs',
    base: { startAnnual: 140_000 },
    startupEquity: startupBlock(),
  });
}

// ---------------------------------------------------------------------------
// 1. Valuation floor: slider reaches $10M, not clamped to $1B
// ---------------------------------------------------------------------------

describe('startup valuation slider range', () => {
  it('bottoms out at $10M', () => {
    expect(sliderTToVal(0)).toBeCloseTo(10_000_000, -5);
  });

  it('tops out at $150B', () => {
    expect(sliderTToVal(1000)).toBeCloseTo(150_000_000_000, -8);
  });

  it('round-trips a seed-stage $50M valuation inside the range', () => {
    const t = valToSliderT(50_000_000);
    expect(t).toBeGreaterThan(0);
    expect(t).toBeLessThan(1000);
    expect(sliderTToVal(t)).toBeCloseTo(50_000_000, -6);
  });
});

// ---------------------------------------------------------------------------
// 2. Startup valuation breakeven in decision helpers
// ---------------------------------------------------------------------------

describe('startupBreakevenLine', () => {
  it('finds the valuation where the startup ties the public offer', () => {
    // DemoTech: $165k x 4 = $660k. DemoLabs: $140k x 4 + 12k options @ $2
    // strike on 100M FD shares. Breakeven: 560k + 12k*(v/1e8 - 2) = 660k
    // -> v ~= $1.03B.
    const line = startupBreakevenLine(startupOffer(), 'DemoLabs', normalOffer(), 'DemoTech');
    expect(line).toContain('DemoLabs wins if it exits above');
    expect(line).toContain('$1B');
    expect(line).toContain('DemoTech pays more');
  });

  it('returns null when the startup block is disabled', () => {
    const off = startupOffer();
    off.startupEquity = startupBlock({ enabled: false });
    expect(startupBreakevenLine(off, 'DemoLabs', normalOffer(), 'DemoTech')).toBeNull();
  });

  it('admits when the startup cannot catch up even at a $1T exit', () => {
    // At a $1T exit the 12k options are worth ~$120M; a $200M/4yr rival is
    // unreachable on valuation alone.
    const rich = normalOffer({ name: 'MegaCorp', base: { startAnnual: 50_000_000 } });
    const line = startupBreakevenLine(startupOffer(), 'DemoLabs', rich, 'MegaCorp');
    expect(line).toContain("can't catch");
  });

  it('admits when the startup wins even in a downside case', () => {
    const poor = normalOffer({ name: 'TinyCo', base: { startAnnual: 50_000 } });
    const line = startupBreakevenLine(startupOffer(), 'DemoLabs', poor, 'TinyCo');
    expect(line).toContain('wins at any exit above');
  });
});

// ---------------------------------------------------------------------------
// 3. New offers start blank
// ---------------------------------------------------------------------------

function createMemoryStorage(): Storage {
  const backing = new Map<string, string>();
  return {
    getItem: (key: string) => backing.get(key) ?? null,
    setItem: (key: string, value: string) => {
      backing.set(key, value);
    },
    removeItem: (key: string) => {
      backing.delete(key);
    },
    clear: () => {
      backing.clear();
    },
    key: (index: number) => Array.from(backing.keys())[index] ?? null,
    get length() {
      return backing.size;
    },
  } as Storage;
}

let memoryStorage: Storage;
let useStore: typeof import('@/state/store')['useStore'];

beforeAll(async () => {
  memoryStorage = createMemoryStorage();
  Object.defineProperty(globalThis as { [key: string]: unknown }, 'localStorage', {
    value: memoryStorage,
    configurable: true,
    writable: false,
  });
  ({ useStore } = await import('@/state/store'));
});

describe('addBlankOffer', () => {
  beforeEach(() => {
    memoryStorage.clear();
    useStore.getState().resetAll();
  });

  it('creates an offer with no sample grants, bonus, raises, or signing', () => {
    useStore.getState().addBlankOffer({ name: 'Fresh' });
    const offers = useStore.getState().offers;
    const fresh = offers[offers.length - 1];
    expect(fresh.name).toBe('Fresh');
    expect(fresh.base.startAnnual).toBe(0);
    expect(fresh.equityGrants).toEqual([]);
    expect(fresh.performanceBonus).toBeUndefined();
    expect(fresh.raises).toEqual([]);
    expect(fresh.signingBonuses ?? []).toEqual([]);
    expect(fresh.relocationBonuses ?? []).toEqual([]);
    expect(fresh.startupEquity).toBeUndefined();
  });

  it('falls back to a generated name when none is given', () => {
    useStore.getState().addBlankOffer();
    const offers = useStore.getState().offers;
    expect(offers[offers.length - 1].name).toMatch(/^Offer \d+$/);
  });
});

// ---------------------------------------------------------------------------
// 4. Engine honors the active startup valuation (leaderboard repricing)
// ---------------------------------------------------------------------------

describe('startup equity repriced at active valuation', () => {
  it('values at-the-money options above zero at a $15B scenario', () => {
    // strike == fmvAtGrant: grant-time intrinsic is $0. The calculator and
    // leaderboard must use the scenario valuation instead.
    const stock4yr = (v: number) =>
      computeOffer({
        ...startupOffer(),
        startupEquity: startupBlock({ valuation: v }),
      }).reduce((s, r) => s + r.stock, 0);
    const at15B = stock4yr(15_000_000_000);
    const at1B = stock4yr(1_000_000_000);
    expect(at15B).toBeGreaterThan(0);
    expect(at15B).toBeGreaterThan(at1B);
    expect(at1B).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// 5. formatValuation
// ---------------------------------------------------------------------------

describe('formatValuation', () => {
  it('compacts millions and billions', () => {
    expect(formatValuation(50_000_000)).toBe('$50M');
    expect(formatValuation(3_250_000_000)).toBe('$3.3B');
    expect(formatValuation(150_000_000_000)).toBe('$150B');
  });

  it('returns an em dash for non-positive or non-finite input', () => {
    expect(formatValuation(0)).toBe('—');
    expect(formatValuation(-5)).toBe('—');
    expect(formatValuation(NaN)).toBe('—');
  });
});

// ---------------------------------------------------------------------------
// 6. Leaderboard method disclosure for startup offers
// ---------------------------------------------------------------------------

describe('offerToLeaderboardEntry startup disclosure', () => {
  it('discloses scenario repricing for startup offers', () => {
    const entry = offerToLeaderboardEntry(startupOffer(), '2024');
    expect(entry.method).toContain('Startup-lab scenario');
  });

  it('does not mention scenarios for public offers', () => {
    const entry = offerToLeaderboardEntry(normalOffer(), '2024');
    expect(entry.method).not.toContain('Startup-lab scenario');
  });
});

// ---------------------------------------------------------------------------
// 7. Preset JSONs carry explicit colFactor
// ---------------------------------------------------------------------------

describe('preset colFactor', () => {
  it('google/amazon/meta presets pin colFactor 1.4 (San Francisco Bay Area)', () => {
    for (const preset of [googlePresetJson, amazonPresetJson, metaPresetJson]) {
      expect(preset.location).toBe('San Francisco Bay Area');
      expect((preset as { colFactor?: number }).colFactor).toBe(1.4);
    }
  });
});
