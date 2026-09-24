"use client";

import { useMemo } from 'react';
import { useStore } from '@/state/store';
import { computeOffer } from '@/core/compute';

function compact(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `$${(n / 1_000_000).toFixed(abs >= 10_000_000 ? 0 : 1)}M`;
  if (abs >= 1_000) return `$${Math.round(n / 1_000)}k`;
  return `$${Math.round(n)}`;
}

/**
 * Tabs grouped into the capture → understand → decide flow. The groups
 * render as tiny inline labels in the scrollable tab bar; the pills
 * themselves keep their existing styling. Exported here (rather than in
 * page.tsx) because Next.js route modules may not export arbitrary values.
 */
export const TAB_GROUPS = [
  {
    label: 'Capture',
    tabs: [
      { value: 'calc', label: 'Calculator' },
      { value: 'startup', label: 'Startup' },
    ],
  },
  {
    label: 'Understand',
    tabs: [
      { value: 'growth', label: 'Stock Growth' },
      { value: 'benchmarks', label: 'Benchmarks' },
    ],
  },
  {
    label: 'Decide',
    tabs: [
      { value: 'compare', label: 'Compare' },
      { value: 'raises', label: 'Raise Planner' },
      { value: 'cities', label: 'City Compare' },
    ],
  },
] as const;

export type TabValue = (typeof TAB_GROUPS)[number]['tabs'][number]['value'];

const TAB_VALUES: readonly string[] = TAB_GROUPS.flatMap((g) => g.tabs.map((t) => t.value));

/**
 * Guard for the `compcalc:switch-tab` window event: only known tab
 * values are allowed to switch tabs.
 */
export function isValidTabValue(detail: unknown): detail is TabValue {
  return typeof detail === 'string' && TAB_VALUES.includes(detail);
}

/**
 * Mobile-only sticky strip: the active offer at a glance (name, base,
 * Year 1 total comp, horizon total). Mirrors the desktop LiveTotals in
 * one compact line so every tab feels like it's analyzing the same offer.
 */
export default function ActiveOfferStrip() {
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
      className="flex items-center gap-2.5 overflow-x-auto whitespace-nowrap text-[11px] tabular-nums md:hidden"
      aria-live="polite"
      title="Modeled totals: base + bonus + equity + perks, pre-tax. Includes startup equity when enabled."
    >
      <span className="max-w-32 shrink-0 truncate font-medium text-foreground/80">{name}</span>
      <span className="shrink-0 text-muted-foreground">
        <span className="mr-1 text-[9px] font-semibold uppercase tracking-wider text-muted-foreground/70">
          Base
        </span>
        {compact(base)}
      </span>
      <span className="shrink-0 text-muted-foreground">
        <span className="mr-1 text-[9px] font-semibold uppercase tracking-wider text-muted-foreground/70">
          Y1
        </span>
        <span className="font-semibold text-foreground/80">{compact(yearOne)}</span>
      </span>
      <span className="shrink-0 text-muted-foreground">
        <span className="mr-1 text-[9px] font-semibold uppercase tracking-wider text-muted-foreground/70">
          {horizon}yr
        </span>
        <span className="font-semibold text-foreground/80">{compact(horizonTotal)}</span>
      </span>
    </div>
  );
}
