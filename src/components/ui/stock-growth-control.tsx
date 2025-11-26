"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { buildPricePath, yoyFromCagr, yoyFromRamp } from "@/core/growth";

// ============================================================================
// Types
// ============================================================================

export interface StockGrowthValue {
  startingPrice: number;
  yoy: number[];
}

export interface StockGrowthControlProps {
  value: StockGrowthValue;
  onChange: (value: StockGrowthValue) => void;
  years?: number;
  /** Compact mode for inline/card usage */
  variant?: "default" | "compact" | "minimal";
  /** Show scenario preset buttons */
  showPresets?: boolean;
  /** Show individual year controls */
  showYearControls?: boolean;
  /** Additional class name */
  className?: string;
}

// ============================================================================
// Presets
// ============================================================================

const QUICK_PRESETS = [
  { key: "optimistic", label: "🚀 +15%", value: 0.15, desc: "Optimistic" },
  { key: "moderate", label: "📈 +8%", value: 0.08, desc: "Moderate" },
  { key: "steady", label: "→ +5%", value: 0.05, desc: "Steady" },
  { key: "flat", label: "— 0%", value: 0, desc: "Flat" },
  { key: "bearish", label: "📉 −10%", value: -0.1, desc: "Bearish" },
] as const;

const ADVANCED_PRESETS = [
  { key: "bull", label: "Bull +20%", generator: (y: number) => yoyFromCagr(0.2, y) },
  { key: "slowdown", label: "Slowdown", generator: (y: number) => yoyFromRamp(0.25, 0.05, y) },
  { key: "recovery", label: "Recovery", generator: (y: number) => yoyFromRamp(-0.15, 0.1, y) },
  { key: "volatile", label: "Volatile", generator: (y: number) => Array.from({ length: y }, (_, i) => (i % 2 === 0 ? 0.15 : -0.05)) },
] as const;

// ============================================================================
// Helper Components
// ============================================================================

function GrowthBadge({ value, size = "default" }: { value: number; size?: "sm" | "default" }) {
  const isPositive = value >= 0;
  return (
    <span
      className={cn(
        "inline-flex items-center font-medium rounded-full",
        size === "sm" ? "px-1.5 py-0.5 text-[10px]" : "px-2 py-0.5 text-xs",
        isPositive
          ? "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400"
          : "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400"
      )}
    >
      {isPositive ? "+" : ""}
      {(value * 100).toFixed(0)}%
    </span>
  );
}

function PricePathDisplay({ prices, compact = false }: { prices: number[]; compact?: boolean }) {
  if (compact) {
    return (
      <div className="flex items-center gap-1 text-xs text-muted-foreground">
        <span className="font-medium">${prices[0]?.toFixed(2)}</span>
        <span>→</span>
        <span className="font-medium">${prices[prices.length - 1]?.toFixed(2)}</span>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap gap-1.5">
      {prices.map((price, i) => (
        <span
          key={i}
          className={cn(
            "rounded-full px-2 py-0.5 text-xs border",
            i === 0 ? "bg-muted font-medium" : "bg-background"
          )}
        >
          {i === 0 ? "Now" : `Y${i}`}: ${price.toFixed(2)}
        </span>
      ))}
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function StockGrowthControl({
  value,
  onChange,
  years = 4,
  variant = "default",
  showPresets = true,
  showYearControls = true,
  className,
}: StockGrowthControlProps) {
  const [showAdvanced, setShowAdvanced] = React.useState(false);

  const { startingPrice, yoy } = value;
  const pricePath = React.useMemo(
    () => buildPricePath(startingPrice, yoy, years),
    [startingPrice, yoy, years]
  );

  // Calculate average growth / CAGR
  const avgGrowth = React.useMemo(() => {
    if (yoy.length === 0) return 0;
    return yoy.reduce((a, b) => a + b, 0) / yoy.length;
  }, [yoy]);

  const cagr = React.useMemo(() => {
    if (pricePath.length < 2 || pricePath[0] <= 0) return 0;
    const endPrice = pricePath[pricePath.length - 1];
    return Math.pow(endPrice / pricePath[0], 1 / years) - 1;
  }, [pricePath, years]);

  // Detect if current YoY matches a preset
  const activePreset = React.useMemo(() => {
    const allSame = yoy.every((v) => Math.abs(v - yoy[0]) < 0.001);
    if (allSame) {
      const match = QUICK_PRESETS.find((p) => Math.abs(p.value - yoy[0]) < 0.001);
      return match?.key ?? null;
    }
    return null;
  }, [yoy]);

  // Handlers
  const setStartingPrice = React.useCallback(
    (price: number) => {
      onChange({ ...value, startingPrice: Math.max(0.01, price) });
    },
    [value, onChange]
  );

  const setAllYoY = React.useCallback(
    (rate: number) => {
      onChange({ ...value, yoy: Array.from({ length: years }, () => rate) });
    },
    [value, onChange, years]
  );

  const setYoYAtIndex = React.useCallback(
    (index: number, rate: number) => {
      const newYoY = [...yoy];
      newYoY[index] = rate;
      onChange({ ...value, yoy: newYoY });
    },
    [value, onChange, yoy]
  );

  const applyAdvancedPreset = React.useCallback(
    (generator: (y: number) => number[]) => {
      onChange({ ...value, yoy: generator(years) });
    },
    [value, onChange, years]
  );

  // ============================================================================
  // Minimal variant - just a slider with badge
  // ============================================================================
  if (variant === "minimal") {
    return (
      <div className={cn("space-y-2", className)}>
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">Avg Growth</span>
          <GrowthBadge value={avgGrowth} size="sm" />
        </div>
        <Slider
          value={[avgGrowth * 100]}
          min={-50}
          max={50}
          step={1}
          onValueChange={([v]) => setAllYoY(v / 100)}
          className={cn(
            "[&_[data-slot=slider-range]]:transition-colors",
            avgGrowth >= 0
              ? "[&_[data-slot=slider-range]]:bg-green-500"
              : "[&_[data-slot=slider-range]]:bg-red-500"
          )}
        />
        <PricePathDisplay prices={pricePath} compact />
      </div>
    );
  }

  // ============================================================================
  // Compact variant - for cards/inline usage
  // ============================================================================
  if (variant === "compact") {
    return (
      <div className={cn("space-y-3", className)}>
        {/* Price and growth summary */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Label className="text-xs text-muted-foreground">Start</Label>
            <div className="relative">
              <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">$</span>
              <Input
                type="number"
                step="0.01"
                min="0.01"
                value={startingPrice}
                onChange={(e) => setStartingPrice(Number(e.target.value) || 0.01)}
                className="h-7 w-20 pl-5 text-xs"
              />
            </div>
          </div>
          <GrowthBadge value={cagr} />
        </div>

        {/* Quick presets as chips */}
        {showPresets && (
          <div className="flex flex-wrap gap-1">
            {QUICK_PRESETS.map((preset) => (
              <Button
                key={preset.key}
                type="button"
                variant="chip"
                size="sm"
                data-active={activePreset === preset.key}
                onClick={() => setAllYoY(preset.value)}
                className="h-6 px-2 text-[10px]"
              >
                {preset.desc}
              </Button>
            ))}
          </div>
        )}

        {/* Year sliders */}
        {showYearControls && (
          <div className="space-y-1.5">
            {Array.from({ length: years }).map((_, i) => {
              const rate = yoy[i] ?? 0;
              const isPositive = rate >= 0;
              return (
                <div key={i} className="grid grid-cols-[40px_1fr_50px] items-center gap-2">
                  <span className="text-[10px] text-muted-foreground">Y{i + 1}</span>
                  <Slider
                    value={[rate * 100]}
                    min={-50}
                    max={50}
                    step={1}
                    onValueChange={([v]) => setYoYAtIndex(i, v / 100)}
                    className={cn(
                      "[&_[data-slot=slider-range]]:transition-colors",
                      isPositive
                        ? "[&_[data-slot=slider-range]]:bg-green-500"
                        : "[&_[data-slot=slider-range]]:bg-red-500"
                    )}
                  />
                  <span className="text-[10px] text-right tabular-nums">
                    {isPositive ? "+" : ""}
                    {(rate * 100).toFixed(0)}%
                  </span>
                </div>
              );
            })}
          </div>
        )}

        {/* Price path */}
        <PricePathDisplay prices={pricePath} compact />
      </div>
    );
  }

  // ============================================================================
  // Default variant - full featured
  // ============================================================================
  return (
    <div className={cn("space-y-5", className)}>
      {/* Header with starting price and CAGR */}
      <div className="flex flex-wrap items-end gap-4">
        <div className="flex-shrink-0">
          <Label className="text-sm font-medium">Current Stock Price</Label>
          <div className="relative mt-1.5">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">$</span>
            <Input
              type="number"
              step="0.01"
              min="0.01"
              value={startingPrice}
              onChange={(e) => setStartingPrice(Number(e.target.value) || 0.01)}
              className="pl-7 w-28"
            />
          </div>
        </div>

        <div className="flex-1 min-w-[200px]">
          <div className="flex items-baseline gap-3">
            <div>
              <div className="text-xs text-muted-foreground">Projected (Y{years})</div>
              <div className="text-xl font-semibold">${pricePath[years]?.toFixed(2) ?? "—"}</div>
            </div>
            <GrowthBadge value={cagr} />
            <span className="text-xs text-muted-foreground">CAGR</span>
          </div>
        </div>
      </div>

      {/* Scenario preset buttons */}
      {showPresets && (
        <div className="space-y-2">
          <Label className="text-sm font-medium">Growth Scenario</Label>
          <div className="grid grid-cols-5 gap-2">
            {QUICK_PRESETS.map((preset) => (
              <TooltipProvider key={preset.key}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      onClick={() => setAllYoY(preset.value)}
                      className={cn(
                        "flex flex-col items-center gap-1 rounded-lg border p-3 transition-all hover:bg-accent",
                        activePreset === preset.key
                          ? "border-primary bg-primary/5 ring-2 ring-primary/20"
                          : "border-border"
                      )}
                    >
                      <span className="text-base">{preset.label.split(" ")[0]}</span>
                      <span className="text-xs font-medium">{preset.desc}</span>
                      <span className="text-[10px] text-muted-foreground">
                        {preset.value >= 0 ? "+" : ""}
                        {(preset.value * 100).toFixed(0)}%/yr
                      </span>
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>{preset.desc}: {preset.value >= 0 ? "+" : ""}{(preset.value * 100).toFixed(0)}% per year</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            ))}
          </div>
        </div>
      )}

      {/* Year-by-year sliders */}
      {showYearControls && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label className="text-sm font-medium">Year-by-Year Growth</Label>
            <span className="text-xs text-muted-foreground">Drag sliders or enter values</span>
          </div>
          <div className="space-y-3 rounded-lg border bg-card/50 p-4">
            {Array.from({ length: years }).map((_, i) => {
              const rate = yoy[i] ?? 0;
              const price = pricePath[i + 1] ?? 0;
              const isPositive = rate >= 0;

              return (
                <div key={i} className="grid grid-cols-[60px_1fr_80px_80px] items-center gap-3">
                  <div className="text-sm font-medium text-muted-foreground">Year {i + 1}</div>
                  <Slider
                    value={[rate * 100]}
                    min={-50}
                    max={50}
                    step={1}
                    onValueChange={([v]) => setYoYAtIndex(i, v / 100)}
                    className={cn(
                      "[&_[data-slot=slider-range]]:transition-colors",
                      isPositive
                        ? "[&_[data-slot=slider-range]]:bg-green-500"
                        : "[&_[data-slot=slider-range]]:bg-red-500"
                    )}
                  />
                  <div className="relative">
                    <Input
                      type="number"
                      step="1"
                      value={Math.round(rate * 100)}
                      onChange={(e) => setYoYAtIndex(i, Number(e.target.value) / 100)}
                      className="pr-6 text-right h-8 text-sm"
                    />
                    <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">%</span>
                  </div>
                  <div className="text-right">
                    <span className="text-sm font-mono">${price.toFixed(2)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Advanced scenarios toggle */}
      <div className="border-t pt-4">
        <button
          type="button"
          onClick={() => setShowAdvanced((v) => !v)}
          className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
        >
          <svg
            className={cn("w-4 h-4 transition-transform", showAdvanced && "rotate-90")}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
          Advanced Scenarios
        </button>

        {showAdvanced && (
          <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-2">
            {ADVANCED_PRESETS.map((preset) => (
              <Button
                key={preset.key}
                type="button"
                variant="outline"
                size="sm"
                onClick={() => applyAdvancedPreset(preset.generator)}
                className="h-auto py-2 flex flex-col"
              >
                <span className="text-xs font-medium">{preset.label}</span>
              </Button>
            ))}
          </div>
        )}
      </div>

      {/* Price path summary */}
      <PricePathDisplay prices={pricePath} />
    </div>
  );
}

// ============================================================================
// Export sub-components for flexibility
// ============================================================================

export { GrowthBadge, PricePathDisplay };
