"use client";

import { useEffect, useRef, useState } from 'react';
import { useStore } from '@/state/store';

const MODE_COPY = {
  simple: {
    title: 'Simple mode on',
    body: 'Base pay, equity grants, and growth assumptions. Raises, retirement match, perks, and per-year growth tuning are hidden.',
  },
  advanced: {
    title: 'Advanced mode on',
    body: 'Everything in Simple, plus the Advanced tab: raises, retirement match, perks, per-year growth tuning, and import/export.',
  },
} as const;

/**
 * Brief auto-dismissing notice summarizing what a mode change did.
 * Only fires on change, never on first load.
 */
export default function UiModeToast() {
  const uiMode = useStore((s) => s.uiMode);
  const prevMode = useRef(uiMode);
  const [visible, setVisible] = useState(false);
  const timer = useRef<number | null>(null);

  useEffect(() => {
    if (prevMode.current === uiMode) return;
    prevMode.current = uiMode;
    setVisible(true);
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setVisible(false), 5000);
    return () => {
      if (timer.current) window.clearTimeout(timer.current);
    };
  }, [uiMode]);

  if (!visible) return null;
  const copy = MODE_COPY[uiMode];

  return (
    <div
      className="pointer-events-none fixed inset-x-0 bottom-6 z-50 flex justify-center px-4"
      role="status"
      aria-live="polite"
    >
      <div className="pointer-events-auto w-full max-w-md rounded-2xl border border-border bg-background p-4 shadow-xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-foreground">{copy.title}</p>
            <p className="mt-0.5 text-sm text-muted-foreground">{copy.body}</p>
          </div>
          <button
            type="button"
            onClick={() => setVisible(false)}
            aria-label="Dismiss"
            className="shrink-0 rounded-md px-2 py-1 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            Dismiss
          </button>
        </div>
      </div>
    </div>
  );
}
