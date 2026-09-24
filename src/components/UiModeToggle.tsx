"use client";

import { useStore } from '@/state/store';

/**
 * Simple | Advanced segmented toggle. Simple mode hides the fiddly
 * controls (per-year growth tuning, raises, full perks/401k editors);
 * Advanced reveals everything. The choice persists in localStorage.
 */
export default function UiModeToggle() {
  const { uiMode, setUiMode } = useStore();

  return (
    <div
      className="flex items-center gap-0.5 rounded-full border border-border/60 bg-muted/50 p-1"
      role="group"
      aria-label="Interface complexity"
    >
      {(['simple', 'advanced'] as const).map((mode) => {
        const active = uiMode === mode;
        return (
          <button
            key={mode}
            type="button"
            onClick={() => setUiMode(mode)}
            aria-pressed={active}
            className={`rounded-full px-3 py-1 text-xs font-semibold capitalize transition-colors ${
              active
                ? 'bg-foreground text-background shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {mode}
          </button>
        );
      })}
    </div>
  );
}
