'use client';

import { useEffect, useState } from 'react';

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
