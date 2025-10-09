'use client';

import { useEffect, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { decodeShareToken } from '@/lib/share';
import { useStore } from '@/state/store';

export default function ShareHydrator() {
  const searchParams = useSearchParams();
  const loadSnapshot = useStore((state) => state.loadSnapshot);
  const appliedTokenRef = useRef<string | null>(null);
  const shareToken = searchParams.get('share');

  useEffect(() => {
    if (!shareToken || appliedTokenRef.current === shareToken) return;
    const payload = decodeShareToken(shareToken);
    if (!payload) return;
    appliedTokenRef.current = shareToken;
    loadSnapshot({ offers: payload.offers, activeIndex: payload.activeIndex, uiMode: payload.uiMode });
  }, [shareToken, loadSnapshot]);

  return null;
}
