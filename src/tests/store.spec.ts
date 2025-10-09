import { beforeAll, beforeEach, describe, expect, it } from 'vitest';

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

describe('store advanced offer updates', () => {
  beforeEach(() => {
    memoryStorage.clear();
    const { resetAll } = useStore.getState();
    resetAll();
  });

  it('updates cost of living multiplier per offer', () => {
    useStore.getState().addOffer();

    useStore.getState().updateOfferAt(1, (offer) => ({
      ...offer,
      assumptions: { ...(offer.assumptions ?? { horizonYears: 4, colAdjust: 1 }), colAdjust: 1.25 },
    }), { recordHistory: false });

    const { offers } = useStore.getState();
    expect(offers).toHaveLength(2);
    expect(offers[1].assumptions?.colAdjust).toBeCloseTo(1.25);
    expect(offers[0].assumptions?.colAdjust).toBeCloseTo(1);
  });

  it('applies growth presets across all offers', () => {
    useStore.getState().addOffer();

    useStore.getState().applyToOffers((offer) => ({
      ...offer,
      growth: { ...(offer.growth ?? {}), yoy: [0.1, 0.1, 0.1, 0.1] },
    }));

    const { offers, offer } = useStore.getState();
    expect(offers.every((o) => o.growth?.yoy?.every((y) => y === 0.1))).toBe(true);
    expect(offer.growth?.yoy).toEqual([0.1, 0.1, 0.1, 0.1]);
  });
});
