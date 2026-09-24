"use client";

import { useStore } from "@/state/store";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/**
 * True when the per-year YoY rates differ — Simple mode must not present
 * their average as one applied rate.
 * Exported for regression tests.
 */
export function growthRatesVary(yoy: number[]): boolean {
  return yoy.length > 1 && yoy.some((v) => Math.abs(v - yoy[0]!) > 1e-9);
}

/**
 * Simple-mode stock growth: one "expected annual growth %" number instead
 * of the per-year YoY editor. Writes the same value into every horizon year
 * so the compute path stays untouched. Advanced mode gets the full editor.
 */
export default function SimpleGrowthInput() {
  const { offer, setOffer } = useStore();
  const horizon = offer.assumptions?.horizonYears ?? 4;
  const yoy = offer.growth?.yoy ?? [];
  const avg = yoy.length
    ? yoy.reduce((s, v) => s + v, 0) / yoy.length
    : 0;
  // A mixed per-year series must not be presented as one applied rate.
  const varies = growthRatesVary(yoy);
  const avgPct = Math.round(avg * 100);

  function setAll(percent: number) {
    const v = Number.isFinite(percent) ? percent / 100 : 0;
    setOffer({
      ...offer,
      growth: {
        ...offer.growth,
        startingPrice: offer.growth?.startingPrice ?? offer.equityGrants?.[0]?.fmv ?? 10,
        yoy: Array.from({ length: horizon }, () => v),
      },
    });
  }

  return (
    <div className="rounded-lg border border-border/50 p-3 sm:p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Label className="text-sm font-medium">Expected annual growth</Label>
          {varies && (
            <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[11px] font-medium text-amber-600 dark:text-amber-400">
              Varies by year
            </span>
          )}
        </div>
        <div className="relative w-28">
          <Input
            type="number"
            step={1}
            value={avgPct}
            onChange={(e) => setAll(Number(e.target.value || "0"))}
            className="h-10 pr-8 text-right font-semibold"
            aria-label="Expected annual stock growth percent"
          />
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
            %
          </span>
        </div>
      </div>
      <p className="mt-1.5 text-xs text-muted-foreground">
        {varies
          ? `Yearly rates differ — showing the average (${avgPct}%), not what's applied. Type a value to use one rate for every year, or switch to Advanced for per-year control.`
          : "Applied to every year. Switch to Advanced for per-year control."}
      </p>
    </div>
  );
}
