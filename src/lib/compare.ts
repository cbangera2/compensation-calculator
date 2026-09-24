/**
 * Compare-tab scoping + offer-bar overflow helpers.
 *
 * The Compare tab renders at most MAX_COMPARE_OFFERS offers at a time; the
 * offer bar shows at most a handful of pills and tucks the rest behind a
 * "+N more" menu. Both are pure index math so they're trivially testable.
 */

export const MAX_COMPARE_OFFERS = 3;

/** Dedupe + clamp a user compare selection to valid offer indices. */
export function sanitizeCompareSelection(selection: number[], offerCount: number): number[] {
  const seen = new Set<number>();
  const out: number[] = [];
  for (const i of selection) {
    if (!Number.isInteger(i) || i < 0 || i >= offerCount || seen.has(i)) continue;
    seen.add(i);
    out.push(i);
    if (out.length >= MAX_COMPARE_OFFERS) break;
  }
  return out;
}

/**
 * Effective compare indices: the user's explicit selection when it has any
 * valid entry, otherwise the active offer plus the next offers in order.
 * Always 0..MAX_COMPARE_OFFERS entries.
 */
export function resolveCompareIndices(
  offerCount: number,
  activeIndex: number,
  selection: number[],
): number[] {
  const clean = sanitizeCompareSelection(selection, offerCount);
  if (clean.length > 0) return clean;
  if (offerCount <= 0) return [];
  const safeActive = Math.max(0, Math.min(activeIndex, offerCount - 1));
  const out = [safeActive];
  for (let i = 0; i < offerCount && out.length < MAX_COMPARE_OFFERS; i++) {
    if (i !== safeActive) out.push(i);
  }
  return out;
}

/** Remap a compare selection after the offer at `removedIndex` is deleted. */
export function remapCompareSelectionAfterRemove(selection: number[], removedIndex: number): number[] {
  return selection
    .filter((i) => i !== removedIndex)
    .map((i) => (i > removedIndex ? i - 1 : i));
}

/**
 * Split offer-bar pills into visible + overflow. The first `maxVisible`
 * offers are shown as pills; when there are more, the active offer is
 * always kept visible (swapped into the last slot) and the rest go behind
 * the "+N more" menu.
 */
export function splitOfferBarIndices(
  count: number,
  activeIndex: number,
  maxVisible: number,
): { visible: number[]; overflow: number[] } {
  const visible: number[] = [];
  for (let i = 0; i < count && visible.length < maxVisible; i++) visible.push(i);
  if (count > maxVisible && !visible.includes(activeIndex)) {
    visible[visible.length - 1] = activeIndex;
  }
  const visibleSet = new Set(visible);
  const overflow: number[] = [];
  for (let i = 0; i < count; i++) {
    if (!visibleSet.has(i)) overflow.push(i);
  }
  return { visible, overflow };
}
