'use client';

import { useMemo } from 'react';
import { GitCompareArrows } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { useStore } from '@/state/store';
import { resolveCompareIndices, shouldShowComparePicker, toggleCompareIndex } from '@/lib/compare';
import { useMaxCompareOffers } from '@/lib/useIsMobile';
import { cn } from '@/lib/utils';

/**
 * Offer picker for the Compare tab. Compare renders at most
 * `useMaxCompareOffers()` offers (viewport-scaled). The picker stays
 * visible until every offer is compared, so an explicit short selection
 * keeps a way to add omitted offers after the viewport cap changes. The
 * tab auto-fills up to the max, so unchecking down to one offer refills
 * rather than stranding the charts; checking a pill while full swaps the
 * new offer in for the last non-active compared offer.
 */
export default function ComparePicker() {
  const offers = useStore((s) => s.offers);
  const activeIndex = useStore((s) => s.activeIndex);
  const compareSelection = useStore((s) => s.compareSelection);
  const setCompareSelection = useStore((s) => s.setCompareSelection);
  const maxOffers = useMaxCompareOffers();

  const effective = useMemo(
    () => resolveCompareIndices(offers.length, activeIndex, compareSelection, maxOffers),
    [offers.length, activeIndex, compareSelection, maxOffers],
  );

  // Hide only when every offer is already compared — not merely when the
  // offer count fits the cap, since an explicit selection may omit offers.
  if (!shouldShowComparePicker(offers.length, effective.length)) return null;

  const selected = new Set(effective);
  const toggle = (index: number) => {
    setCompareSelection(toggleCompareIndex(offers.length, activeIndex, compareSelection, maxOffers, index));
  };

  return (
    <Card>
      <CardContent className="flex flex-wrap items-center gap-x-4 gap-y-3 py-3">
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <GitCompareArrows className="size-4 shrink-0" />
          <span>
            Showing <span className="font-semibold text-foreground">{effective.length}</span> of{' '}
            <span className="font-semibold text-foreground">{offers.length}</span> — pick up to{' '}
            {maxOffers} to compare
          </span>
        </p>
        <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Offers to compare">
          {offers.map((offer, index) => {
            const checked = selected.has(index);
            return (
              <label
                key={index}
                className={cn(
                  'flex cursor-pointer items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition',
                  checked
                    ? 'border-primary/60 bg-primary/10 text-foreground'
                    : 'border-border bg-background text-muted-foreground hover:border-primary/40 hover:text-foreground',
                )}
              >
                <input
                  type="checkbox"
                  className="sr-only"
                  checked={checked}
                  onChange={() => toggle(index)}
                  aria-label={`Compare ${offer.name || `Offer ${index + 1}`}`}
                />
                <span className="max-w-[140px] truncate">{offer.name || `Offer ${index + 1}`}</span>
                {index === activeIndex && (
                  <span className="rounded-full bg-primary/20 px-1.5 py-px text-[10px] font-semibold text-primary">
                    active
                  </span>
                )}
              </label>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
