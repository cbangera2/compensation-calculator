/**
 * Compare-tab scoping + offer-bar overflow helpers.
 *
 * The Compare tab renders at most `maxOffers` offers at a time (see
 * `useMaxCompareOffers` — the cap scales with viewport width instead of a
 * hard constant). The offer bar shows at most a handful of pills and tucks
 * the rest behind a "+N more" menu. Both are pure index math so they're
 * trivially testable.
 */

/** Default compare cap (used for SSR and non-component contexts). */
export const MAX_COMPARE_OFFERS = 3;

/** Dedupe + drop invalid indices. No count cap — the render layer caps. */
export function cleanCompareSelection(selection: number[], offerCount: number): number[] {
  const seen = new Set<number>();
  const out: number[] = [];
  for (const i of selection) {
    if (!Number.isInteger(i) || i < 0 || i >= offerCount || seen.has(i)) continue;
    seen.add(i);
    out.push(i);
  }
  return out;
}

/** Dedupe + clamp a user compare selection to valid offer indices. */
export function sanitizeCompareSelection(
  selection: number[],
  offerCount: number,
  maxOffers: number = MAX_COMPARE_OFFERS,
): number[] {
  return cleanCompareSelection(selection, offerCount).slice(0, Math.max(0, maxOffers));
}

/**
 * Effective compare indices: the user's explicit selection when it names at
 * least two valid offers (the minimum for a meaningful comparison),
 * otherwise the active offer plus the next offers in order — i.e. the tab
 * always auto-fills up to `maxOffers` instead of stranding on a single
 * offer whose charts can't render. Always 0..maxOffers entries.
 */
export function resolveCompareIndices(
  offerCount: number,
  activeIndex: number,
  selection: number[],
  maxOffers: number = MAX_COMPARE_OFFERS,
): number[] {
  const clean = sanitizeCompareSelection(selection, offerCount, maxOffers);
  if (clean.length >= 2) return clean;
  if (offerCount <= 0) return [];
  const safeActive = Math.max(0, Math.min(activeIndex, offerCount - 1));
  // Seed with the active offer plus any valid explicit picks, then fill up
  // to maxOffers in index order — the tab auto-fills instead of stranding
  // on a lone offer whose charts can't render.
  const out: number[] = [];
  for (const i of [safeActive, ...clean]) {
    if (!out.includes(i)) out.push(i);
  }
  for (let i = 0; i < offerCount && out.length < maxOffers; i++) {
    if (!out.includes(i)) out.push(i);
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
