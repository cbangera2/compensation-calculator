import { describe, expect, it } from 'vitest';
import {
  isExplicitCompareSelection,
  resolveCompareIndices,
  shouldShowComparePicker,
  toggleCompareIndex,
} from '@/lib/compare';

describe('isExplicitCompareSelection', () => {
  it('needs at least two valid offers', () => {
    expect(isExplicitCompareSelection([0, 1], 5)).toBe(true);
    expect(isExplicitCompareSelection([0], 5)).toBe(false);
    expect(isExplicitCompareSelection([], 5)).toBe(false);
    expect(isExplicitCompareSelection([0, 9, 1], 5)).toBe(true);
    expect(isExplicitCompareSelection([0, 9], 5)).toBe(false);
  });
});

describe('toggleCompareIndex', () => {
  // Removing a visible offer must not drop hidden (viewport-capped)
  // selections from the wishlist — they return when the cap grows.
  it('removing a visible offer preserves hidden selections', () => {
    expect(toggleCompareIndex(5, 0, [0, 1, 2, 3], 2, 0)).toEqual([1, 2, 3]);
  });

  // The first edit on an auto-picked tab seeds the wishlist from the
  // effective selection so the toggle visibly sticks.
  it('removing from an auto-picked selection seeds an explicit wishlist', () => {
    // 5 offers, desktop cap 4: the tab auto-picks [0,1,2]; removing offer 1
    // leaves [0,2], which must stick as an explicit 2-pick rather than
    // refilling to [0,1,2].
    expect(toggleCompareIndex(5, 0, [], 4, 1)).toEqual([0, 2]);
  });

  // On a phone (cap 2) with 3 offers, checking the omitted offer swaps it
  // in for the last non-active compared offer instead of being disabled.
  it('checking a pill while full replaces the last non-active offer', () => {
    expect(toggleCompareIndex(3, 0, [0, 1], 2, 2)).toEqual([2, 0]);
  });

  it('never sacrifices the active offer when another candidate exists', () => {
    expect(toggleCompareIndex(4, 0, [0, 1, 2], 3, 3)).toEqual([3, 0, 1]);
  });

  // An already-wishlisted but viewport-hidden offer moves to the front so
  // it becomes visible.
  it('checking a hidden wishlisted offer brings it to the front', () => {
    expect(toggleCompareIndex(5, 0, [0, 1, 2, 3], 2, 2)).toEqual([2, 0, 1, 3]);
  });

  it('checking while under the cap adds to the front', () => {
    expect(toggleCompareIndex(5, 0, [0, 1], 4, 2)).toEqual([2, 0, 1]);
  });

  // Unchecking down to a single offer returns the single pick; the render
  // layer refills to the two-offer minimum from there.
  it('unchecking down to one offer leaves the single pick', () => {
    expect(toggleCompareIndex(3, 0, [0, 1], 2, 1)).toEqual([0]);
  });

  it('ignores invalid indices in the stored wishlist', () => {
    expect(toggleCompareIndex(3, 0, [0, 9, 1, 1], 2, 0)).toEqual([1]);
  });
});

describe('shouldShowComparePicker', () => {
  // The picker is the selection control: visible whenever there is a real
  // choice (3+ offers), even when every offer is already compared — hiding
  // it then would leave no way to uncheck back down.
  it('stays visible when an explicit selection omits an offer that fits the cap', () => {
    const effective = resolveCompareIndices(3, 0, [0, 1], 3);
    expect(effective).toEqual([0, 1]);
    expect(shouldShowComparePicker(3)).toBe(true);
  });

  it('stays visible when all offers are compared so the user can uncheck back down', () => {
    expect(shouldShowComparePicker(4)).toBe(true);
    expect(shouldShowComparePicker(3)).toBe(true);
  });

  it('hides when there is nothing to choose (1-2 offers)', () => {
    expect(shouldShowComparePicker(2)).toBe(false);
    expect(shouldShowComparePicker(1)).toBe(false);
    expect(shouldShowComparePicker(0)).toBe(false);
  });
});
