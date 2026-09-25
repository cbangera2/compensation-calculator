'use client';

import { useMemo } from 'react';
import { useStore } from '@/state/store';
import { resolveCompareIndices } from '@/lib/compare';
import { useMaxCompareOffers } from '@/lib/useIsMobile';
import type { TOffer } from '@/models/types';

export type ComparedOffer = { offer: TOffer; index: number };

/**
 * The offers the Compare tab renders: at most `useMaxCompareOffers()`
 * (viewport-scaled), each paired with its original store index (needed by
 * components that mutate via updateOfferAt, e.g. ComparisonAdjustments).
 */
export function useComparedOffers(): ComparedOffer[] {
  const offers = useStore((s) => s.offers);
  const activeIndex = useStore((s) => s.activeIndex);
  const compareSelection = useStore((s) => s.compareSelection);
  const maxOffers = useMaxCompareOffers();
  return useMemo(() => {
    const indices = resolveCompareIndices(offers.length, activeIndex, compareSelection, maxOffers);
    const out: ComparedOffer[] = [];
    for (const index of indices) {
      const offer = offers[index];
      if (offer) out.push({ offer, index });
    }
    return out;
  }, [offers, activeIndex, compareSelection, maxOffers]);
}
