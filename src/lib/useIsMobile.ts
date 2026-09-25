'use client';

import { useEffect, useState } from 'react';
import { MAX_COMPARE_OFFERS } from '@/lib/compare';

const MOBILE_QUERY = '(max-width: 639.98px)';

/**
 * useIsMobile — true when the viewport is below the `sm` breakpoint.
 * Used for the mobile-compact pass: collapsed sections, smaller chart
 * heights, tighter type. Desktop rendering is never changed.
 *
 * Initializes to false so server HTML and the first client render match
 * (no hydration mismatch); syncs to the real viewport in an effect.
 */
export function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState<boolean>(false);

  useEffect(() => {
    const mq = window.matchMedia(MOBILE_QUERY);
    const onChange = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    setIsMobile(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  return isMobile;
}

/** Chart heights: compact on mobile, full density on desktop. */
export function useChartHeight(desktop: number, mobile: number): number {
  return useIsMobile() ? mobile : desktop;
}

const COMPARE_SM_QUERY = '(min-width: 640px)';
const COMPARE_LG_QUERY = '(min-width: 1024px)';

/**
 * useMaxCompareOffers — how many offers the Compare tab renders, scaled to
 * viewport width instead of a hard cap: 2 on phones, 3 on small tablets,
 * 4 on desktop. Initializes to MAX_COMPARE_OFFERS so server HTML and the
 * first client render match (no hydration mismatch); syncs in an effect.
 */
export function useMaxCompareOffers(): number {
  const [max, setMax] = useState<number>(MAX_COMPARE_OFFERS);

  useEffect(() => {
    const sm = window.matchMedia(COMPARE_SM_QUERY);
    const lg = window.matchMedia(COMPARE_LG_QUERY);
    const sync = () => setMax(lg.matches ? 4 : sm.matches ? 3 : 2);
    sync();
    sm.addEventListener('change', sync);
    lg.addEventListener('change', sync);
    return () => {
      sm.removeEventListener('change', sync);
      lg.removeEventListener('change', sync);
    };
  }, []);

  return max;
}
