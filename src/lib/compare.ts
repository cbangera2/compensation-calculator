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

/**
 * How many offers the Compare tab auto-picks when the user has no explicit
 * selection. This is the *default*, separate from the viewport-scaled *cap*:
 * desktop can hold 4 but still starts at 3; a phone cap of 2 binds first.
 */
export const DEFAULT_AUTO_COMPARE_COUNT = 3;

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
 * A stored wishlist counts as an explicit user selection when it names at
 * least two valid offers — the minimum for a meaningful comparison.
 * Anything less and the tab auto-fills instead of honoring it.
 */
export function isExplicitCompareSelection(selection: number[], offerCount: number): boolean {
  return cleanCompareSelection(selection, offerCount).length >= 2;
}

/**
 * Effective compare indices: the user's explicit selection when it names at
 * least two valid offers (the minimum for a meaningful comparison),
 * otherwise the active offer plus the next offers in order — i.e. the tab
 * auto-picks DEFAULT_AUTO_COMPARE_COUNT instead of stranding on a single
 * offer whose charts can't render. The auto-pick count is separate from
 * `maxOffers`: desktop can *hold* 4 but *starts* at 3, while a phone cap of
 * 2 binds the auto-pick too. Always 0..maxOffers entries.
 */
export function resolveCompareIndices(
  offerCount: number,
  activeIndex: number,
  selection: number[],
  maxOffers: number = MAX_COMPARE_OFFERS,
): number[] {
  const clean = sanitizeCompareSelection(selection, offerCount, maxOffers);
  if (isExplicitCompareSelection(selection, offerCount)) return clean;
  if (offerCount <= 0) return [];
  const safeActive = Math.max(0, Math.min(activeIndex, offerCount - 1));
  // Seed with the active offer plus any valid explicit picks, then fill up
  // to the auto-pick default (bounded by the viewport cap).
  const target = Math.max(0, Math.min(DEFAULT_AUTO_COMPARE_COUNT, maxOffers));
  const out: number[] = [];
  for (const i of [safeActive, ...clean]) {
    if (!out.includes(i)) out.push(i);
  }
  for (let i = 0; i < offerCount && out.length < target; i++) {
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
 * Whether the compare picker should render. It hides only when every offer
 * is already compared — not merely when the offer count fits the viewport
 * cap, since an explicit selection may omit offers that still need a way
 * back in (e.g. two picks on a phone, then widening to a tablet).
 */
export function shouldShowComparePicker(offerCount: number, effectiveCount: number): boolean {
  return effectiveCount !== offerCount;
}

/**
 * Next compare wishlist after toggling one offer pill in the picker.
 *
 * Works from the user's explicit wishlist when it names at least two valid
 * offers, otherwise seeds from the auto-filled effective selection so the
 * first edit sticks instead of no-opping against the refill. Removing an
 * offer keeps hidden (viewport-capped) selections in the wishlist so they
 * return when the cap grows. Checking a pill while the viewport cap is full
 * swaps the new offer in for the last compared offer that isn't the active
 * one — the active offer is never the replacement victim when another
 * candidate exists — so a phone user can always reach an omitted offer.
 * A newly checked offer moves to the front so it is guaranteed visible.
 */
export function toggleCompareIndex(
  offerCount: number,
  activeIndex: number,
  selection: number[],
  maxOffers: number,
  index: number,
): number[] {
  const clean = cleanCompareSelection(selection, offerCount);
  const effective = resolveCompareIndices(offerCount, activeIndex, selection, maxOffers);
  const base = isExplicitCompareSelection(selection, offerCount) ? clean : effective;
  if (effective.includes(index)) {
    return base.filter((i) => i !== index);
  }
  const next = base.filter((i) => i !== index);
  if (!base.includes(index) && next.length >= maxOffers) {
    const candidates = effective.filter((i) => i !== activeIndex);
    const drop = candidates.length > 0 ? candidates[candidates.length - 1] : effective[effective.length - 1];
    return [index, ...next.filter((i) => i !== drop)];
  }
  return [index, ...next];
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
