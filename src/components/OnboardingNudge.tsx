"use client";

import { useEffect, useState } from 'react';
import { X, Calculator, TrendingUp, GitCompareArrows } from 'lucide-react';

const STEPS = [
  { icon: Calculator, title: 'Enter your offer', text: 'Base, bonus, equity on the Calculator tab' },
  { icon: TrendingUp, title: 'Tune scenarios', text: 'Stock growth, startup value, raises' },
  { icon: GitCompareArrows, title: 'Compare', text: 'Stack offers side by side and share' },
];

const KEY = 'compcalc-onboarded';

/**
 * First-run guide: three steps, dismissible, never shows again once
 * dismissed. Gives new users the capture → understand → decide flow
 * in one glance.
 */
export default function OnboardingNudge() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      if (!localStorage.getItem(KEY)) setVisible(true);
    } catch {
      setVisible(true);
    }
  }, []);

  function dismiss() {
    try {
      localStorage.setItem(KEY, '1');
    } catch {
      /* non-fatal */
    }
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div className="relative overflow-hidden rounded-2xl border border-border/60 bg-gradient-to-br from-primary/8 via-transparent to-transparent p-4 sm:p-5">
      <button
        type="button"
        onClick={dismiss}
        aria-label="Dismiss guide"
        className="absolute right-3 top-3 rounded-full p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
      >
        <X className="size-4" />
      </button>
      <p className="text-sm font-semibold">How this works</p>
      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        {STEPS.map((step, i) => (
          <div key={step.title} className="flex items-start gap-2.5">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
              <step.icon className="size-4" />
            </span>
            <div className="min-w-0">
              <p className="text-[13px] font-medium">
                <span className="mr-1.5 text-muted-foreground">{i + 1}.</span>
                {step.title}
              </p>
              <p className="text-xs text-muted-foreground">{step.text}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
