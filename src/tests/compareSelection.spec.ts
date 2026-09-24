import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  MAX_COMPARE_OFFERS,
  remapCompareSelectionAfterRemove,
  resolveCompareIndices,
  sanitizeCompareSelection,
  splitOfferBarIndices,
} from '@/lib/compare';

describe('compare selection helpers', () => {
  it('caps the compare tab at 3 offers', () => {
    expect(MAX_COMPARE_OFFERS).toBe(3);
  });

  it('defaults to the active offer plus the next two', () => {
    expect(resolveCompareIndices(7, 0, [])).toEqual([0, 1, 2]);
    expect(resolveCompareIndices(7, 5, [])).toEqual([5, 0, 1]);
    expect(resolveCompareIndices(2, 1, [])).toEqual([1, 0]);
    expect(resolveCompareIndices(1, 0, [])).toEqual([0]);
    expect(resolveCompareIndices(0, 0, [])).toEqual([]);
  });

  it('honors an explicit user selection', () => {
    expect(resolveCompareIndices(7, 0, [4, 5, 6])).toEqual([4, 5, 6]);
    expect(resolveCompareIndices(7, 0, [2, 6])).toEqual([2, 6]);
  });

  it('sanitizes selections: dedupes, drops invalid, caps at 3', () => {
    expect(sanitizeCompareSelection([1, 1, 9, -2, 2, 3, 4], 7)).toEqual([1, 2, 3]);
    expect(sanitizeCompareSelection([0.5, 2], 7)).toEqual([2]);
    expect(resolveCompareIndices(7, 0, [9, 10])).toEqual([0, 1, 2]); // nothing valid -> default
  });

  it('remaps the selection when an offer is removed', () => {
    expect(remapCompareSelectionAfterRemove([0, 2, 4], 2)).toEqual([0, 3]);
    expect(remapCompareSelectionAfterRemove([1, 3], 0)).toEqual([0, 2]);
    expect(remapCompareSelectionAfterRemove([5], 5)).toEqual([]);
  });
});

describe('offer bar overflow split', () => {
  it('shows everything when it fits', () => {
    expect(splitOfferBarIndices(4, 0, 5)).toEqual({ visible: [0, 1, 2, 3], overflow: [] });
    expect(splitOfferBarIndices(5, 4, 5)).toEqual({ visible: [0, 1, 2, 3, 4], overflow: [] });
  });

  it('tucks the rest behind +N more', () => {
    expect(splitOfferBarIndices(7, 0, 5)).toEqual({ visible: [0, 1, 2, 3, 4], overflow: [5, 6] });
  });

  it('always keeps the active offer visible', () => {
    const { visible, overflow } = splitOfferBarIndices(7, 6, 5);
    expect(visible).toContain(6);
    expect(overflow).not.toContain(6);
    expect(visible).toHaveLength(5);
    expect(overflow).toEqual([4, 5]);
  });

  it('handles a single offer', () => {
    expect(splitOfferBarIndices(1, 0, 5)).toEqual({ visible: [0], overflow: [] });
  });
});

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

describe('store compare selection', () => {
  beforeEach(() => {
    memoryStorage.clear();
    useStore.getState().resetAll();
  });

  it('starts empty and sanitizes on set', () => {
    expect(useStore.getState().compareSelection).toEqual([]);
    useStore.getState().addOffer();
    useStore.getState().addOffer();
    useStore.getState().setCompareSelection([0, 0, 5, 1, 2]);
    // 5 is out of range (3 offers), dupes dropped, capped at 3
    expect(useStore.getState().compareSelection).toEqual([0, 1, 2]);
  });

  it('remaps the selection when an offer is removed', () => {
    const s = useStore.getState();
    s.addOffer();
    s.addOffer();
    s.addOffer();
    useStore.getState().setCompareSelection([1, 3]);
    useStore.getState().removeOffer(1);
    expect(useStore.getState().compareSelection).toEqual([2]);
  });

  it('clears the selection on reset', () => {
    useStore.getState().addOffer();
    useStore.getState().setCompareSelection([0, 1]);
    useStore.getState().resetAll();
    expect(useStore.getState().compareSelection).toEqual([]);
  });
});
