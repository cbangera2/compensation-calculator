"use client";

import { useMemo } from 'react';
import { useStore } from '@/state/store';
import { computeOffer } from '@/core/compute';
import { formatCurrency } from '@/lib/utils';

/**
 * Compact live summary for the sticky tab bar: active offer name,
 * base salary, Year 1 total comp and horizon total. Updates on every keystroke.
 */
export default function LiveTotals() {
  const { offer, offers, activeIndex } = useStore();

  const { base, yearOne, horizonTotal, horizon } = useMemo(() => {
    const rows = computeOffer(offer);
    const h = offer.assumptions?.horizonYears ?? rows.length;
    return {
      base: Math.max(0, offer.base?.startAnnual ?? 0),
      yearOne: rows[0]?.total ?? 0,
      horizonTotal: rows.slice(0, h).reduce((acc, r) => acc + r.total, 0),
      horizon: h,
    };
  }, [offer]);

  const name = offers[activeIndex]?.name || offer.name || `Offer ${activeIndex + 1}`;

  return (
    <div
      className="hidden shrink-0 items-center gap-4 md:flex"
      aria-live="polite"
      title="Modeled totals: base + bonus + equity + perks, pre-tax. Includes startup equity when enabled."
    >
      <span className="max-w-36 truncate text-xs font-medium text-muted-foreground">{name}</span>
      <div className="flex items-baseline gap-1.5">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Base</span>
        <span className="text-sm font-bold tabular-nums text-foreground">{formatCurrency(base)}</span>
      </div>
      <div className="flex items-baseline gap-1.5">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Y1</span>
        <span className="text-sm font-bold tabular-nums text-foreground">{formatCurrency(yearOne)}</span>
      </div>
      <div className="flex items-baseline gap-1.5">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{horizon}yr</span>
        <span className="text-sm font-bold tabular-nums text-foreground">{formatCurrency(horizonTotal)}</span>
      </div>
    </div>
  );
}
