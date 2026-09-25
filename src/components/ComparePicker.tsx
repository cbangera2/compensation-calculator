'use client';

import { useMemo } from 'react';
import { GitCompareArrows } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { useStore } from '@/state/store';
import { MAX_COMPARE_OFFERS, resolveCompareIndices } from '@/lib/compare';
import { cn } from '@/lib/utils';

/**
 * Offer picker for the Compare tab. Compare renders at most
 * MAX_COMPARE_OFFERS offers; when there are more, this picker lets the
 * user choose which ones, with a "showing 3 of N" hint. Hidden when there
 * are 3 or fewer offers (everything is compared anyway).
 */
export default function ComparePicker() {
  const offers = useStore((s) => s.offers);
  const activeIndex = useStore((s) => s.activeIndex);
  const compareSelection = useStore((s) => s.compareSelection);
  const setCompareSelection = useStore((s) => s.setCompareSelection);

  const effective = useMemo(
    () => resolveCompareIndices(offers.length, activeIndex, compareSelection),
    [offers.length, activeIndex, compareSelection],
  );

  if (offers.length <= MAX_COMPARE_OFFERS) return null;

  const selected = new Set(effective);
  const toggle = (index: number) => {
    if (selected.has(index)) {
      const next = effective.filter((i) => i !== index);
      setCompareSelection(next);
    } else if (selected.size < MAX_COMPARE_OFFERS) {
      setCompareSelection([...effective, index]);
    }
  };

  return (
    <Card>
      <CardContent className="flex flex-wrap items-center gap-x-4 gap-y-3 py-3">
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <GitCompareArrows className="size-4 shrink-0" />
          <span>
            Showing <span className="font-semibold text-foreground">{effective.length}</span> of{' '}
            <span className="font-semibold text-foreground">{offers.length}</span> — pick up to{' '}
            {MAX_COMPARE_OFFERS} to compare
          </span>
        </p>
        <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Offers to compare">
          {offers.map((offer, index) => {
            const checked = selected.has(index);
            const disabled = !checked && selected.size >= MAX_COMPARE_OFFERS;
            return (
              <label
                key={index}
                className={cn(
                  'flex cursor-pointer items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition',
                  checked
                    ? 'border-primary/60 bg-primary/10 text-foreground'
                    : 'border-border bg-background text-muted-foreground hover:border-primary/40 hover:text-foreground',
                  disabled && 'cursor-not-allowed opacity-40 hover:border-border hover:text-muted-foreground',
                )}
              >
                <input
                  type="checkbox"
                  className="sr-only"
                  checked={checked}
                  disabled={disabled}
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
