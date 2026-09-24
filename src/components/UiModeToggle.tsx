"use client";

import { useStore } from '@/state/store';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import UiModeToast from '@/components/UiModeToast';

/**
 * Simple | Advanced segmented toggle. Simple mode hides the fiddly
 * controls (per-year growth tuning, raises, full perks/401k editors);
 * Advanced reveals everything. The choice persists in localStorage.
 *
 * A tooltip lists what each mode includes, and switching modes shows a
 * short toast summarizing what appeared or disappeared.
 */
export default function UiModeToggle() {
  const { uiMode, setUiMode } = useStore();

  return (
    <>
      <Tooltip>
        <TooltipTrigger asChild>
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
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-64">
          <p className="font-semibold">Simple</p>
          <p className="opacity-90">Base pay, equity grants, and growth assumptions.</p>
          <p className="mt-2 font-semibold">Advanced</p>
          <p className="opacity-90">
            Everything in Simple, plus raises, retirement match, perks, per-year growth tuning, and import/export.
          </p>
        </TooltipContent>
      </Tooltip>
      <UiModeToast />
    </>
  );
}
