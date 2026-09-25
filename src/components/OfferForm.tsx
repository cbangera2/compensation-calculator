"use client";
import type { ChangeEvent } from "react";
import { useEffect, useId, useState, useMemo, useRef } from "react";
import { useStore } from "@/state/store";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import GrowthYoyEditor from "@/components/GrowthYoyEditor";
import SimpleGrowthInput from "@/components/SimpleGrowthInput";
import GrantsPanel from "@/components/GrantsPanel";
import RaisesEditor from "@/components/RaisesEditor";
import CashPerksPanel from "@/components/CashPerksPanel";
import { CurrencyInput } from "@/components/ui/currency-input";
import { computeOffer } from "@/core/compute";
import {
  Undo2,
  Redo2,
  ChevronDown,
  ChevronRight,
  Briefcase,
  TrendingUp,
  Settings2,
  MapPin,
  Rocket,
  CalendarClock,
  BarChart3,
} from "lucide-react";
import { CITY_PRESETS } from "@/lib/col";
import { COMPARE_CITIES, type CompareCity } from "@/core/cityCompare";
import { findCell, compaRatio } from "@/core/benchmarks";
import {
  BENCHMARK_COMPANIES,
  BENCHMARK_LEVELS,
  type TBenchmarkMetro,
} from "@/data/benchmarks.v2";

const QUICK_PERKS = [
  { name: "Free meals", annualValue: 5000 },
  { name: "Gym/wellness", annualValue: 1200 },
  { name: "Learning", annualValue: 1500 },
  { name: "HSA", annualValue: 1000 },
] as const;

// --- Intelligence chips: location -> COL, benchmark, startup, raises --------

function getCompareCity(key: string): CompareCity | null {
  return COMPARE_CITIES.find((c) => c.key === key) ?? null;
}

/** Resolve which city preset the Location select should display.
 *  Name match first: several presets share a factor (Chicago/Austin 1.05,
 *  Phoenix/Remote 0.95), so the factor fallback must never shadow an exact
 *  name. Exported for tests. */
export function resolveLocationPresetKey(
  location: string | undefined,
  colFactor: number | undefined
): string {
  return (
    CITY_PRESETS.find((c) => c.name === location)?.key ??
    (typeof colFactor === "number"
      ? CITY_PRESETS.find((c) => Math.abs(c.factor - colFactor) < 0.001)?.key
      : undefined) ??
    "custom"
  );
}

/** Match free-text offer locations to the city-compare dataset. Order matters:
 *  more specific regions first. Exported for tests. */
export function matchCompareCity(location?: string): CompareCity | null {
  const h = (location ?? "").toLowerCase().trim();
  if (!h) return null;
  if (
    /sunnyvale|mountain view|palo alto|menlo park|cupertino|san jose|santa clara|bay area|san francisco/.test(
      h
    )
  )
    return getCompareCity("renter-sunnyvale");
  if (/ann arbor|detroit|dearborn|troy|royal oak/.test(h))
    return getCompareCity("renter-ann-arbor");
  if (
    /washington|arlington|alexandria|mclean|bethesda|district of columbia|\bdc\b/.test(
      h
    )
  )
    return getCompareCity("renter-dc");
  if (/seattle|bellevue|redmond|kirkland/.test(h)) return getCompareCity("sea");
  if (/new york|nyc|manhattan|brooklyn|queens|jersey city|hoboken/.test(h))
    return getCompareCity("nyc");
  if (/austin|round rock/.test(h)) return getCompareCity("aus");
  return null;
}

/** Match free-text offer locations to benchmark metros. findCell rolls up
 *  across metros anyway, so this only needs to be directionally right.
 *  Exported for tests. */
export function metroForBenchmarkLocation(location?: string): TBenchmarkMetro {
  const h = (location ?? "").toLowerCase();
  if (/new york|nyc|manhattan|brooklyn|queens|jersey city/.test(h)) return "NYC";
  if (/seattle|bellevue|redmond|kirkland/.test(h)) return "Seattle";
  if (/austin|round rock/.test(h)) return "Austin";
  if (/detroit|ann arbor|dearborn|troy/.test(h)) return "Detroit/Ann Arbor";
  if (
    /washington|arlington|alexandria|mclean|bethesda|district of columbia|\bdc\b/.test(
      h
    )
  )
    return "DC";
  return "Bay Area";
}

const fmtFactor = (f: number): string => String(Math.round(f * 100) / 100);

function fmtValuation(v: number): string {
  if (v >= 1_000_000_000) {
    const b = v / 1_000_000_000;
    return `$${b >= 10 ? Math.round(b) : Math.round(b * 10) / 10}B`;
  }
  if (v >= 1_000_000) {
    const m = v / 1_000_000;
    return `$${m >= 10 ? Math.round(m) : Math.round(m * 10) / 10}M`;
  }
  return `$${Math.round(v).toLocaleString()}`;
}

function fmtK(v: number): string {
  return `$${Math.round(v / 1000)}k`;
}

function switchTab(tab: string) {
  window.dispatchEvent(
    new CustomEvent("compcalc:switch-tab", { detail: tab })
  );
}

/**
 * True only for an explicit location edit on the same offer — not a mount,
 * offer switch, undo/redo, or import. The COL auto-suggest must only run on
 * explicit edits so it never mutates a stored factor unprompted (and so a
 * global undo restoring the default factor isn't immediately re-applied).
 * Exported for regression tests.
 */
export function isExplicitLocationEdit(
  prev: { index: number; location: string | undefined } | null,
  index: number,
  location: string | undefined
): boolean {
  if (prev === null || prev.index !== index) return false;
  return prev.location !== location;
}

export default function OfferForm() {
  const { offer, setOffer, setBonusValue, undo, redo, addGrant, updateGrant, uiMode, activeIndex } =
    useStore();
  const [collapsed, setCollapsed] = useState(false);
  const [activeTab, setActiveTab] = useState("compensation");
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    raises: false,
    perks: false,
  });
  const contentId = useId();

  // Simple mode hides the Advanced inner tab (raises, full perks/401k).
  // If the user was on it when switching down, fall back to compensation.
  useEffect(() => {
    if (uiMode === "simple" && activeTab === "advanced") {
      setActiveTab("compensation");
    }
  }, [uiMode, activeTab]);

  const toggleSection = (section: string) => {
    setExpandedSections((prev) => ({ ...prev, [section]: !prev[section] }));
  };

  // Keyboard shortcuts: Cmd+Z / Shift+Cmd+Z
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const meta = e.metaKey || e.ctrlKey;
      if (!meta) return;
      if (e.key.toLowerCase() === "z" && !e.shiftKey) {
        e.preventDefault();
        undo();
      } else if (
        (e.key.toLowerCase() === "z" && e.shiftKey) ||
        e.key.toLowerCase() === "y"
      ) {
        e.preventDefault();
        redo();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [undo, redo]);

  // Computed values for summary display
  const totalCash = useMemo(() => {
    const base = offer.base.startAnnual;
    const bonusAmt =
      offer.performanceBonus?.kind === "percent"
        ? (offer.performanceBonus?.value ?? 0) * base
        : (offer.performanceBonus?.value ?? 0);
    return base + bonusAmt * (offer.performanceBonus?.expectedPayout ?? 1);
  }, [offer.base.startAnnual, offer.performanceBonus]);

  const totalEquityY1 = useMemo(() => {
    const grants = offer.equityGrants ?? [];
    const rsu = grants.find((g) => g.type === "RSU");
    if (!rsu?.targetValue) return 0;
    return rsu.targetMode === "year1"
      ? rsu.targetValue
      : Math.round(rsu.targetValue / 4);
  }, [offer.equityGrants]);

  // Compute perks total for breakdown visualization
  const totalPerks = useMemo(() => {
    const signing = (offer.signingBonuses ?? []).reduce((sum, b) => sum + (b.amount ?? 0), 0);
    const relocation = (offer.relocationBonuses ?? []).reduce((sum, b) => sum + (b.amount ?? 0), 0);
    const benefits = (offer.benefits ?? []).reduce((sum, b) => sum + (b.enabled !== false ? (b.annualValue ?? 0) : 0), 0);
    const misc = (offer.miscRecurring ?? []).reduce((sum, m) => sum + (m.annualValue ?? 0), 0);
    return signing + relocation + benefits + misc;
  }, [offer.signingBonuses, offer.relocationBonuses, offer.benefits, offer.miscRecurring]);

  // Breakdown percentages for visual bar. The last segment takes the
  // remainder so independent rounding can't leave the bar at 99%.
  const breakdown = useMemo(() => {
    const total = totalCash + totalEquityY1 + totalPerks;
    if (total === 0) return { cash: 33, equity: 33, perks: 34 };
    const cash = Math.round((totalCash / total) * 100);
    const equity = Math.round((totalEquityY1 / total) * 100);
    return {
      cash,
      equity,
      perks: Math.max(0, 100 - cash - equity),
    };
  }, [totalCash, totalEquityY1, totalPerks]);

  // Compute year-by-year data for mini chart
  const yearData = useMemo(() => {
    const rows = computeOffer(offer);
    const horizon = offer.assumptions?.horizonYears ?? 4;
    return rows.slice(0, horizon);
  }, [offer]);

  // Helper for RSU grant management
  const ensureRsuGrant = (patch: {
    targetValue?: number;
    targetMode?: "year1" | "total";
  }) => {
    const grants = offer.equityGrants ?? [];
    const idx = grants.findIndex((g) => g.type === "RSU");
    const startingPrice = offer.growth?.startingPrice ?? 10;
    if (idx >= 0) {
      updateGrant(idx, patch);
    } else {
      addGrant({
        type: "RSU",
        shares: 0,
        fmv: startingPrice,
        targetValue: patch.targetValue ?? 40000,
        targetMode: patch.targetMode ?? "year1",
        vesting: {
          model: "standard",
          years: 4,
          cliffMonths: 12,
          frequency: "monthly",
          distribution: "even",
          cliffPercent: 0,
        },
      });
    }
  };

  const rsuGrant = useMemo(() => {
    const grants = offer.equityGrants ?? [];
    return grants.find((g) => g.type === "RSU");
  }, [offer.equityGrants]);

  // Location -> COL auto-suggest: fills colFactor from the city-compare dataset
  // only on an explicit location edit for the current offer — never on offer
  // open, undo/redo, or import. colAuto tracks what we applied so the note +
  // undo stay honest; followingMove lets the factor follow when the location
  // changes to a different matched city while the previous value was ours.
  const matchedCity = useMemo(
    () => matchCompareCity(offer.location),
    [offer.location]
  );
  const [colAuto, setColAuto] = useState<{
    key: string;
    factor: number;
    prev: number;
  } | null>(null);
  const [colDismissed, setColDismissed] = useState<string | null>(null);

  // Tracks the last (offer, location) this effect saw. Auto-apply only runs
  // when the location changes for the same offer — an explicit location edit.
  // Offer switches, undo/redo, and imports change the factor without a
  // location edit, and must never mutate the stored colFactor.
  const lastColSeen = useRef<{ index: number; location: string | undefined } | null>(null);

  useEffect(() => {
    const prevSeen = lastColSeen.current;
    const locationEdited = isExplicitLocationEdit(prevSeen, activeIndex, offer.location);
    lastColSeen.current = { index: activeIndex, location: offer.location };

    if (!matchedCity || matchedCity.key === colDismissed) {
      if (colAuto) setColAuto(null);
      return;
    }
    if (!locationEdited) {
      // No explicit location edit: an external change (e.g. undo restoring
      // the default factor) may have moved colFactor away from what we
      // applied — drop the stale note so it stays honest.
      if (colAuto && (offer.colFactor ?? 1) !== colAuto.factor) setColAuto(null);
      return;
    }
    const current = offer.colFactor ?? 1;
    const target = matchedCity.colFactor;
    if (current === target) return; // already aligned
    if (colAuto && colAuto.key === matchedCity.key && current === colAuto.factor)
      return; // note active, nothing to do
    const manualOverride =
      current !== 1 && !(colAuto && current === colAuto.factor);
    const followingMove =
      colAuto !== null &&
      colAuto.key !== matchedCity.key &&
      current === colAuto.factor;
    if (manualOverride && !followingMove) {
      if (colAuto) setColAuto(null);
      return;
    }
    const prev =
      colAuto && current === colAuto.factor ? colAuto.prev : current;
    setColAuto({ key: matchedCity.key, factor: target, prev });
    setOffer({ ...offer, colFactor: target });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matchedCity, offer.location, offer.colFactor, colDismissed, activeIndex]);

  const undoColAuto = () => {
    if (!colAuto) return;
    setOffer({ ...offer, colFactor: colAuto.prev });
    setColDismissed(colAuto.key);
    setColAuto(null);
  };

  const colChipVisible =
    colAuto !== null &&
    matchedCity !== null &&
    colAuto.key === matchedCity.key;

  // Benchmark strip: match the offer name to a benchmark company, infer the
  // level by closest base-salary p50, and show where the offer's base lands.
  // Renders nothing when the company isn't in the dataset or no cell exists.
  const benchmarkStrip = useMemo(() => {
    const name = (offer.name ?? "").trim().toLowerCase();
    if (!name) return null;
    const company = BENCHMARK_COMPANIES.find(
      (c) => c.toLowerCase() === name
    );
    if (!company) return null;
    const metro = metroForBenchmarkLocation(offer.location);
    const base = offer.base.startAnnual ?? 0;
    let best: {
      companyLevel: string;
      cellMetro: string;
      baseP50: number;
      rolledUpFrom: string | null;
    } | null = null;
    let bestDist = Infinity;
    for (const level of BENCHMARK_LEVELS) {
      const lookup = findCell(company, level, metro);
      if (!lookup) continue;
      const dist = Math.abs(lookup.cell.base.p50 - base);
      if (dist < bestDist) {
        bestDist = dist;
        best = {
          companyLevel: lookup.cell.companyLevel,
          cellMetro: lookup.cell.metro,
          baseP50: lookup.cell.base.p50,
          rolledUpFrom: lookup.rolledUpFrom,
        };
      }
    }
    if (!best || best.baseP50 <= 0) return null;
    return {
      company,
      ...best,
      pct: Math.round(compaRatio(base, best.baseP50) * 100),
    };
  }, [offer.name, offer.location, offer.base.startAnnual]);

  const hasGrowth = offer.growth?.yoy?.some((y) => y !== 0) ?? false;
  const hasStartup = offer.startupEquity?.enabled ?? false;
  const raiseCount = offer.raises?.length ?? 0;
  const showChips =
    hasGrowth || colChipVisible || benchmarkStrip !== null || hasStartup || raiseCount > 0;

  return (
    <Card className="border-border/60 overflow-hidden">
      {/* Compact Header with Visual Breakdown */}
      <CardHeader className="border-b border-border/60 py-3 px-4 space-y-3 sm:py-4 sm:px-5">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <CardTitle className="text-base sm:text-lg font-semibold">
              {offer.name || "Offer"}
            </CardTitle>
            <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
              ${Math.round(totalCash + totalEquityY1 + totalPerks).toLocaleString()}/yr
            </span>
          </div>
          <div className="flex items-center gap-1">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-10"
              onClick={undo}
              aria-label="Undo"
            >
              <Undo2 className="size-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-10"
              onClick={redo}
              aria-label="Redo"
            >
              <Redo2 className="size-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-10"
              onClick={() => setCollapsed((prev) => !prev)}
              aria-expanded={!collapsed}
              aria-controls={contentId}
            >
              <ChevronDown
                className={`size-4 transition-transform ${collapsed ? "-rotate-90" : "rotate-0"}`}
              />
            </Button>
          </div>
        </div>
        
        {/* Visual Compensation Breakdown Bar */}
        <div className="space-y-2">
          <div className="flex h-3 w-full overflow-hidden rounded-full bg-muted/30">
            <div 
              className="bg-gradient-to-r from-emerald-500 to-emerald-400 transition-all duration-500"
              style={{ width: `${breakdown.cash}%` }}
              title={`Cash: $${Math.round(totalCash).toLocaleString()} (${breakdown.cash}%)`}
            />
            <div 
              className="bg-gradient-to-r from-amber-500 to-amber-400 transition-all duration-500"
              style={{ width: `${breakdown.equity}%` }}
              title={`Equity: $${Math.round(totalEquityY1).toLocaleString()} (${breakdown.equity}%)`}
            />
            <div 
              className="bg-gradient-to-r from-violet-500 to-violet-400 transition-all duration-500"
              style={{ width: `${breakdown.perks}%` }}
              title={`Perks: $${Math.round(totalPerks).toLocaleString()} (${breakdown.perks}%)`}
            />
          </div>
          <div className="hidden justify-between text-[10px] text-muted-foreground sm:flex">
            <div className="flex items-center gap-1">
              <span className="size-2 rounded-full bg-emerald-500" />
              <span>Cash ${Math.round(totalCash / 1000)}k</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="size-2 rounded-full bg-amber-500" />
              <span>Equity ${Math.round(totalEquityY1 / 1000)}k</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="size-2 rounded-full bg-violet-500" />
              <span>Perks ${Math.round(totalPerks / 1000)}k</span>
            </div>
          </div>
        </div>
        {/* Intelligence chips: provenance + auto-suggests, one shared pill language */}
        {showChips && (
          <div className="flex flex-wrap gap-1.5">
            {/* Growth provenance: shown when the offer carries equity growth assumptions */}
            {hasGrowth && offer.growth?.yoy && (
              <button
                type="button"
                onClick={() => switchTab("equity")}
                className="inline-flex w-fit items-center gap-1.5 rounded-full border border-border bg-muted/50 px-2.5 py-1 text-[11px] text-muted-foreground transition-colors hover:text-foreground"
                title="Edit in Equity tab"
              >
                <TrendingUp className="size-3 shrink-0" />
                <span>
                  Equity growth{" "}
                  {(offer.growth.yoy[0] ?? 0) >= 0 ? "+" : ""}
                  {((offer.growth.yoy[0] ?? 0) * 100).toFixed(1)}%/yr · set in
                  Equity tab
                </span>
                <span className="underline underline-offset-2">edit</span>
              </button>
            )}
            {/* Location -> COL auto-suggest note */}
            {colChipVisible && colAuto && matchedCity && (
              <span
                className="inline-flex w-fit items-center gap-1.5 rounded-full border border-border bg-muted/50 px-2.5 py-1 text-[11px] text-muted-foreground"
                title="COL factor auto-filled from the city dataset because your location matched. Undo restores the previous value."
              >
                <MapPin className="size-3 shrink-0" />
                <span>
                  COL {fmtFactor(colAuto.factor)}× from {matchedCity.shortName}{" "}
                  · auto
                </span>
                <button
                  type="button"
                  onClick={undoColAuto}
                  className="underline underline-offset-2 transition-colors hover:text-foreground"
                >
                  undo
                </button>
              </span>
            )}
            {/* Benchmark strip: where this base lands vs the market p50 */}
            {benchmarkStrip && (
              <span
                className="inline-flex w-fit items-center gap-1.5 rounded-full border border-border bg-muted/50 px-2.5 py-1 text-[11px] text-muted-foreground"
                title={`Benchmark p50, sourced public aggregates${
                  benchmarkStrip.rolledUpFrom
                    ? ` (rolled up from ${benchmarkStrip.rolledUpFrom})`
                    : ""
                }. Not your offer's actual market.`}
              >
                <BarChart3 className="size-3 shrink-0" />
                <span>
                  {benchmarkStrip.company} {benchmarkStrip.companyLevel} ·{" "}
                  {benchmarkStrip.cellMetro} p50 base{" "}
                  {fmtK(benchmarkStrip.baseP50)} — your base is at{" "}
                  {benchmarkStrip.pct}% of market
                </span>
                <span className="text-[10px] opacity-70">
                  benchmark p50, sourced
                </span>
              </span>
            )}
            {/* Startup provenance: shown when startup equity is modeled */}
            {hasStartup && offer.startupEquity && (
              <button
                type="button"
                onClick={() => switchTab("equity")}
                className="inline-flex w-fit items-center gap-1.5 rounded-full border border-border bg-muted/50 px-2.5 py-1 text-[11px] text-muted-foreground transition-colors hover:text-foreground"
                title="Edit in Equity tab"
              >
                <Rocket className="size-3 shrink-0" />
                <span>
                  Valuation {fmtValuation(offer.startupEquity.valuation)} · set
                  in Equity tab
                </span>
                <span className="underline underline-offset-2">edit</span>
              </button>
            )}
            {/* Raises provenance: shown when the offer carries a raise plan */}
            {raiseCount > 0 && (
              <button
                type="button"
                onClick={() => switchTab("raises")}
                className="inline-flex w-fit items-center gap-1.5 rounded-full border border-border bg-muted/50 px-2.5 py-1 text-[11px] text-muted-foreground transition-colors hover:text-foreground"
                title="Edit in Raise Planner"
              >
                <CalendarClock className="size-3 shrink-0" />
                <span>
                  Raise plan · {raiseCount}{" "}
                  {raiseCount === 1 ? "raise" : "raises"} · set in Raise
                  Planner
                </span>
                <span className="underline underline-offset-2">edit</span>
              </button>
            )}
          </div>
        )}
      </CardHeader>

      <CardContent
        id={contentId}
        className={`p-0 ${collapsed ? "hidden" : ""}`}
        aria-hidden={collapsed}
      >
        <Tabs
          value={activeTab}
          onValueChange={setActiveTab}
          className="w-full"
        >
          <TabsList className="w-full justify-start gap-0 rounded-none border-b border-border/60 bg-transparent p-0 h-auto">
            <TabsTrigger
              value="compensation"
              className="h-auto flex-none rounded-none border-0 border-b-2 border-transparent px-3 py-2.5 text-[13px] text-muted-foreground data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:font-medium data-[state=active]:text-foreground data-[state=active]:shadow-none sm:px-4 sm:py-3 sm:text-sm"
            >
              <Briefcase className="size-4 mr-1.5" />
              Compensation
            </TabsTrigger>
            <TabsTrigger
              value="equity"
              className="h-auto flex-none rounded-none border-0 border-b-2 border-transparent px-3 py-2.5 text-[13px] text-muted-foreground data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:font-medium data-[state=active]:text-foreground data-[state=active]:shadow-none sm:px-4 sm:py-3 sm:text-sm"
            >
              <TrendingUp className="size-4 mr-1.5" />
              Equity
            </TabsTrigger>
            {uiMode === "advanced" && (
              <TabsTrigger
                value="advanced"
                className="h-auto flex-none rounded-none border-0 border-b-2 border-transparent px-3 py-2.5 text-[13px] text-muted-foreground data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:font-medium data-[state=active]:text-foreground data-[state=active]:shadow-none sm:px-4 sm:py-3 sm:text-sm"
              >
                <Settings2 className="size-4 mr-1.5" />
                Advanced
              </TabsTrigger>
            )}
          </TabsList>

          {/* COMPENSATION TAB (merged Essentials + Perks) */}
          <TabsContent value="compensation" className="p-4 space-y-4 mt-0 sm:p-5 sm:space-y-5">
            {/* Company Info - Compact Row */}
            <div className="flex flex-wrap gap-3">
              <div className="flex-1 min-w-[180px] space-y-1.5">
                <Label htmlFor="name" className="text-xs text-muted-foreground">
                  Company
                </Label>
                <Input
                  id="name"
                  value={offer.name}
                  onChange={(e: ChangeEvent<HTMLInputElement>) =>
                    setOffer({ ...offer, name: e.target.value })
                  }
                  className="h-9"
                  placeholder="Company name"
                />
              </div>
              <div className="w-[140px] space-y-1.5">
                <Label
                  htmlFor="startDate"
                  className="text-xs text-muted-foreground"
                >
                  Start date
                </Label>
                <Input
                  id="startDate"
                  type="date"
                  value={offer.startDate}
                  onChange={(e: ChangeEvent<HTMLInputElement>) =>
                    setOffer({ ...offer, startDate: e.target.value })
                  }
                  className="h-9"
                />
              </div>
              <div className="flex-1 min-w-[140px] space-y-1.5">
                <Label htmlFor="jobTitle" className="text-xs text-muted-foreground">
                  Job title
                </Label>
                <Input
                  id="jobTitle"
                  value={offer.jobTitle ?? ""}
                  onChange={(e: ChangeEvent<HTMLInputElement>) =>
                    setOffer({ ...offer, jobTitle: e.target.value })
                  }
                  className="h-9"
                  placeholder="Software Engineer"
                />
              </div>
              <div className="w-[120px] space-y-1.5">
                <Label htmlFor="jobLevel" className="text-xs text-muted-foreground">
                  Level
                </Label>
                <Input
                  id="jobLevel"
                  value={offer.jobLevel ?? ""}
                  onChange={(e: ChangeEvent<HTMLInputElement>) =>
                    setOffer({ ...offer, jobLevel: e.target.value })
                  }
                  className="h-9"
                  placeholder="E3 / IC3"
                />
              </div>
              <div className="w-[180px] space-y-1.5">
                <Label
                  htmlFor="location"
                  className="text-xs text-muted-foreground"
                >
                  Location
                </Label>
                <select
                  id="location"
                  className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  value={resolveLocationPresetKey(offer.location, offer.colFactor)}
                  onChange={(e) => {
                    const key = e.target.value;
                    const preset = CITY_PRESETS.find((c) => c.key === key);
                    if (preset) {
                      setOffer({
                        ...offer,
                        location: preset.name,
                        colFactor: preset.factor,
                      });
                    } else {
                      setOffer({
                        ...offer,
                        location: "Custom",
                        colFactor: offer.colFactor ?? 1,
                      });
                    }
                  }}
                >
                  <option value="custom">Custom COL...</option>
                  {CITY_PRESETS.map((c) => (
                    <option key={c.key} value={c.key}>
                      {c.name}
                    </option>
                  ))}
                </select>
                {resolveLocationPresetKey(offer.location, offer.colFactor) === "custom" && (
                  <div className="flex items-center gap-2">
                    <Label htmlFor="custom-col" className="text-xs text-muted-foreground whitespace-nowrap">
                      COL factor
                    </Label>
                    <input
                      id="custom-col"
                      type="number"
                      min={0.1}
                      max={5}
                      step={0.01}
                      className="h-9 w-24 rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      value={offer.colFactor ?? 1}
                      onChange={(e) => {
                        const v = parseFloat(e.target.value);
                        setOffer({
                          ...offer,
                          location: "Custom",
                          colFactor: Number.isFinite(v) && v > 0 ? v : 1,
                        });
                      }}
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Main Compensation Grid */}
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {/* Base Salary */}
              <div className="rounded-lg border border-border/50 bg-gradient-to-br from-emerald-500/5 to-transparent p-3 space-y-2 relative overflow-hidden sm:p-4">
                <div className="absolute bottom-0 left-0 h-1 bg-emerald-500/40 transition-all duration-500" style={{ width: `${Math.min(100, (offer.base.startAnnual / (totalCash + totalEquityY1 + totalPerks || 1)) * 100)}%` }} />
                <Label className="text-sm font-medium flex items-center gap-2">
                  Base Salary
                  <span className="text-[10px] text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded">
                    {Math.round((offer.base.startAnnual / (totalCash + totalEquityY1 + totalPerks || 1)) * 100)}%
                  </span>
                </Label>
                <CurrencyInput
                  id="base.startAnnual"
                  value={offer.base.startAnnual}
                  onValueChange={(v) =>
                    setOffer({ ...offer, base: { ...offer.base, startAnnual: v } })
                  }
                  className="text-lg font-semibold h-11"
                />
                <p className="text-xs text-muted-foreground">Annual</p>
              </div>

              {/* Bonus */}
              <div className="rounded-lg border border-border/50 bg-gradient-to-br from-blue-500/5 to-transparent p-3 space-y-2 relative overflow-hidden sm:p-4">
                <div className="absolute bottom-0 left-0 h-1 bg-blue-500/40 transition-all duration-500" style={{ width: `${Math.min(100, ((totalCash - offer.base.startAnnual) / (totalCash + totalEquityY1 + totalPerks || 1)) * 100)}%` }} />
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-medium flex items-center gap-2">
                    Target Bonus
                    <span className="text-[10px] text-blue-600 dark:text-blue-400 bg-blue-500/10 px-1.5 py-0.5 rounded">
                      {Math.round(((totalCash - offer.base.startAnnual) / (totalCash + totalEquityY1 + totalPerks || 1)) * 100)}%
                    </span>
                  </Label>
                  <select
                    className="h-5 text-xs rounded border-0 bg-transparent px-1 focus-visible:outline-none text-muted-foreground"
                    value={offer.performanceBonus?.kind ?? "percent"}
                    onChange={(e) => {
                      const nextKind = e.target.value as "percent" | "fixed";
                      const cur = offer.performanceBonus ?? {
                        kind: "percent",
                        value: 0,
                        expectedPayout: 1,
                      };
                      const base = offer.base.startAnnual;
                      const converted =
                        nextKind === "percent"
                          ? cur.kind === "fixed" && base > 0
                            ? Math.min(1, cur.value / base)
                            : cur.value
                          : cur.kind === "percent"
                            ? Math.round(cur.value * base)
                            : cur.value;
                      setOffer({
                        ...offer,
                        performanceBonus: { ...cur, kind: nextKind, value: converted },
                      });
                    }}
                  >
                    <option value="percent">%</option>
                    <option value="fixed">$</option>
                  </select>
                </div>
                {offer.performanceBonus?.kind === "fixed" ? (
                  <CurrencyInput
                    value={offer.performanceBonus?.value ?? 0}
                    onValueChange={(v) => setBonusValue(v)}
                    className="text-lg font-semibold h-11"
                  />
                ) : (
                  <div className="relative">
                    <Input
                      type="number"
                      step={1}
                      min={0}
                      max={100}
                      value={Math.round((offer.performanceBonus?.value ?? 0) * 100)}
                      onChange={(e: ChangeEvent<HTMLInputElement>) =>
                        setBonusValue(Number(e.target.value || "0") / 100)
                      }
                      className="text-lg font-semibold h-11 pr-8"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                      %
                    </span>
                  </div>
                )}
                <p className="text-xs text-muted-foreground">
                  ≈ $
                  {Math.round(
                    offer.performanceBonus?.kind === "percent"
                      ? (offer.performanceBonus?.value ?? 0) * offer.base.startAnnual
                      : (offer.performanceBonus?.value ?? 0)
                  ).toLocaleString()}
                  /yr
                </p>
              </div>

              {/* Equity */}
              <div className="rounded-lg border border-border/50 bg-gradient-to-br from-amber-500/5 to-transparent p-3 space-y-2 relative overflow-hidden sm:p-4">
                <div className="absolute bottom-0 left-0 h-1 bg-amber-500/40 transition-all duration-500" style={{ width: `${Math.min(100, (totalEquityY1 / (totalCash + totalEquityY1 + totalPerks || 1)) * 100)}%` }} />
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-medium flex items-center gap-2">
                    Equity
                    <span className="text-[10px] text-amber-600 dark:text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded">
                      {Math.round((totalEquityY1 / (totalCash + totalEquityY1 + totalPerks || 1)) * 100)}%
                    </span>
                  </Label>
                  <select
                    className="h-5 text-xs rounded border-0 bg-transparent px-1 focus-visible:outline-none text-muted-foreground"
                    value={rsuGrant?.targetMode ?? "year1"}
                    onChange={(e: ChangeEvent<HTMLSelectElement>) => {
                      ensureRsuGrant({
                        targetMode: e.target.value as "year1" | "total",
                      });
                    }}
                  >
                    <option value="year1">Y1</option>
                    <option value="total">4yr</option>
                  </select>
                </div>
                <CurrencyInput
                  placeholder="e.g., 60,000"
                  value={rsuGrant?.targetValue ?? 0}
                  onValueChange={(amt) => ensureRsuGrant({ targetValue: amt })}
                  className="text-lg font-semibold h-11"
                />
                {offer.startupEquity?.enabled ? (
                  <button
                    type="button"
                    className="text-xs text-primary hover:underline"
                    onClick={() => switchTab("startup")}
                  >
                    Manage startup grants →
                  </button>
                ) : (
                  <button
                    type="button"
                    className="text-xs text-primary hover:underline"
                    onClick={() => setActiveTab("equity")}
                  >
                    Configure grants →
                  </button>
                )}
              </div>
            </div>

            {/* One-Time & Perks Row */}
            <div className="space-y-3">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Bonuses & Benefits
              </p>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {/* Signing Bonus */}
                {(() => {
                  const signing = offer.signingBonuses ?? [];
                  const enabled = signing.length > 0;
                  const amount = signing[0]?.amount ?? 10000;
                  const payDate = signing[0]?.payDate ?? offer.startDate;
                  return (
                    <label
                      className={`flex items-center gap-3 rounded-lg border p-3 cursor-pointer transition-colors ${enabled ? "border-primary/50 bg-primary/5" : "border-border/50 hover:border-border"}`}
                    >
                      <input
                        type="checkbox"
                        className="size-4 rounded"
                        checked={enabled}
                        onChange={(e: ChangeEvent<HTMLInputElement>) => {
                          if (e.target.checked) {
                            setOffer({
                              ...offer,
                              signingBonuses: [{ amount, payDate }],
                            });
                          } else {
                            setOffer({ ...offer, signingBonuses: [] });
                          }
                        }}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium">Signing</p>
                        {enabled && (
                          <CurrencyInput
                            className="mt-1 h-7 text-sm"
                            value={amount}
                            onValueChange={(val) => {
                              setOffer({
                                ...offer,
                                signingBonuses: [{ amount: val, payDate }],
                              });
                            }}
                            onClick={(e) => e.stopPropagation()}
                          />
                        )}
                      </div>
                    </label>
                  );
                })()}

                {/* Relocation Bonus */}
                {(() => {
                  const relocation = offer.relocationBonuses ?? [];
                  const enabled = relocation.length > 0;
                  const amount = relocation[0]?.amount ?? 10000;
                  const payDate = relocation[0]?.payDate ?? offer.startDate;
                  return (
                    <label
                      className={`flex items-center gap-3 rounded-lg border p-3 cursor-pointer transition-colors ${enabled ? "border-primary/50 bg-primary/5" : "border-border/50 hover:border-border"}`}
                    >
                      <input
                        type="checkbox"
                        className="size-4 rounded"
                        checked={enabled}
                        onChange={(e: ChangeEvent<HTMLInputElement>) => {
                          if (e.target.checked) {
                            setOffer({
                              ...offer,
                              relocationBonuses: [{ amount, payDate }],
                            });
                          } else {
                            setOffer({ ...offer, relocationBonuses: [] });
                          }
                        }}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium">Relocation</p>
                        {enabled && (
                          <CurrencyInput
                            className="mt-1 h-7 text-sm"
                            value={amount}
                            onValueChange={(val) => {
                              setOffer({
                                ...offer,
                                relocationBonuses: [{ amount: val, payDate }],
                              });
                            }}
                            onClick={(e) => e.stopPropagation()}
                          />
                        )}
                      </div>
                    </label>
                  );
                })()}

                {/* Quick Perks */}
                {QUICK_PERKS.map((p) => {
                  const benefits = offer.benefits ?? [];
                  const idx = benefits.findIndex((b) => b.name === p.name);
                  const current = idx >= 0 ? benefits[idx] : undefined;
                  const enabled = Boolean(current?.enabled);
                  const amount = current?.annualValue ?? p.annualValue;
                  return (
                    <label
                      key={p.name}
                      className={`flex items-center gap-3 rounded-lg border p-3 cursor-pointer transition-colors ${enabled ? "border-primary/50 bg-primary/5" : "border-border/50 hover:border-border"}`}
                    >
                      <input
                        type="checkbox"
                        className="size-4 rounded"
                        checked={enabled}
                        onChange={(e: ChangeEvent<HTMLInputElement>) => {
                          const next = [...benefits];
                          if (e.target.checked) {
                            if (idx >= 0)
                              next[idx] = {
                                ...next[idx],
                                enabled: true,
                                annualValue: amount,
                              };
                            else
                              next.push({
                                name: p.name,
                                annualValue: amount,
                                enabled: true,
                              });
                          } else if (idx >= 0) {
                            next[idx] = { ...next[idx], enabled: false };
                          }
                          setOffer({ ...offer, benefits: next });
                        }}
                      />
                      <div className="flex-1 flex items-center justify-between gap-2">
                        <span className="text-sm">{p.name}</span>
                        {enabled && (
                          <CurrencyInput
                            className="w-20 h-6 text-xs"
                            value={amount}
                            onValueChange={(val) => {
                              const next = [...benefits];
                              if (idx >= 0)
                                next[idx] = {
                                  ...next[idx],
                                  annualValue: val,
                                  enabled: true,
                                };
                              else
                                next.push({
                                  name: p.name,
                                  annualValue: val,
                                  enabled: true,
                                });
                              setOffer({ ...offer, benefits: next });
                            }}
                            onClick={(e) => e.stopPropagation()}
                          />
                        )}
                      </div>
                    </label>
                  );
                })}

                {/* 401k Match Toggle */}
                {(() => {
                  const retirement = offer.retirement;
                  const enabled = Boolean(retirement);
                  const matchRate = retirement?.matchRate ?? 0.5;
                  const matchCapPct = retirement?.matchCapPercentOfSalary ?? 0.06;
                  const irsLimit = retirement?.employeeContributionCapDollar ?? 23500;
                  const base = offer.base.startAnnual;
                  // Cap contribution at IRS limit, then apply match
                  const maxContrib = Math.min(base * matchCapPct, irsLimit);
                  const annualMatch = Math.round(maxContrib * matchRate);
                  
                  return (
                    <label
                      className={`flex items-center gap-3 rounded-lg border p-3 cursor-pointer transition-colors ${enabled ? "border-indigo-500/50 bg-indigo-500/5" : "border-border/50 hover:border-border"}`}
                    >
                      <input
                        type="checkbox"
                        className="size-4 rounded"
                        checked={enabled}
                        onChange={(e: ChangeEvent<HTMLInputElement>) => {
                          if (e.target.checked) {
                            setOffer({
                              ...offer,
                              retirement: {
                                employeeContributionPercent: 0.06,
                                matchRate: 0.5,
                                matchCapPercentOfSalary: 0.06,
                                employeeContributionCapDollar: 23500,
                                matchCapMode: 'percentOfSalary',
                                matchCapDollar: 0,
                              },
                            });
                          } else {
                            setOffer({ ...offer, retirement: undefined });
                          }
                        }}
                      />
                      <div 
                        className="flex-1 min-w-0"
                        onClick={(e) => {
                          if (enabled) {
                            e.preventDefault();
                            e.stopPropagation();
                            setActiveTab("advanced");
                            setExpandedSections(prev => ({ ...prev, perks: true }));
                          }
                        }}
                      >
                        <p className="text-sm font-medium">401k Match</p>
                        {enabled && (
                          <p className="text-xs text-indigo-600 dark:text-indigo-400 mt-0.5 hover:underline">
                            +${annualMatch.toLocaleString()}/yr • Edit details →
                          </p>
                        )}
                      </div>
                    </label>
                  );
                })()}
              </div>
            </div>

            {/* 401k Match Utilization Visual */}
            {(() => {
              const retirement = offer.retirement;
              if (!retirement) return null;
              
              const base = offer.base.startAnnual;
              const employeeContribPct = retirement.employeeContributionPercent ?? 0.06;
              const matchRate = retirement.matchRate ?? 0.5;
              const matchCapPct = retirement.matchCapPercentOfSalary ?? 0.06;
              const irsLimit = retirement.employeeContributionCapDollar ?? 23500;
              
              // Your contribution capped at IRS limit
              const yourContrib = Math.min(base * employeeContribPct, irsLimit);
              // Max matchable is the lesser of: salary * matchCapPct OR IRS limit
              const maxMatchableContrib = Math.min(base * matchCapPct, irsLimit);
              // Actual match based on your contribution
              const actualMatch = Math.min(yourContrib, maxMatchableContrib) * matchRate;
              // Max possible match if you contributed optimally
              const maxPossibleMatch = maxMatchableContrib * matchRate;
              const matchPct = maxPossibleMatch > 0 ? (actualMatch / maxPossibleMatch) * 100 : 0;
              
              return (
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab("advanced");
                    setExpandedSections(prev => ({ ...prev, perks: true }));
                  }}
                  className="w-full text-left rounded-lg border border-border/50 bg-gradient-to-br from-indigo-500/5 to-transparent p-3 space-y-3 hover:border-indigo-500/30 transition-colors sm:p-4"
                >
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium">401k Match Utilization</p>
                    <p className="text-xs text-muted-foreground">
                      Click to edit →
                    </p>
                  </div>
                  
                  {/* Circular progress ring */}
                  <div className="flex items-center gap-4">
                    <div className="relative size-16">
                      <svg className="size-16 -rotate-90" viewBox="0 0 36 36">
                        <path
                          d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="3"
                          className="text-muted/30"
                        />
                        <path
                          d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="3"
                          strokeDasharray={`${matchPct}, 100`}
                          className="text-indigo-500 transition-all duration-500"
                        />
                      </svg>
                      <span className="absolute inset-0 flex items-center justify-center text-xs font-bold">
                        {Math.round(matchPct)}%
                      </span>
                    </div>
                    <div className="flex-1 space-y-1 text-xs">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Your contribution ({Math.round(employeeContribPct * 100)}%)</span>
                        <span className="font-medium">${Math.round(yourContrib).toLocaleString()}/yr</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Employer match ({Math.round(matchRate * 100)}%)</span>
                        <span className="font-medium text-indigo-600 dark:text-indigo-400">${Math.round(actualMatch).toLocaleString()}/yr</span>
                      </div>
                      <div className="flex justify-between text-[10px]">
                        <span className="text-muted-foreground">IRS limit: ${irsLimit.toLocaleString()}</span>
                        <span>Max match: ${Math.round(maxPossibleMatch).toLocaleString()}/yr</span>
                      </div>
                    </div>
                  </div>
                  
                  {matchPct < 100 && (
                    <p className="text-[10px] text-amber-600 dark:text-amber-400 bg-amber-500/10 rounded px-2 py-1">
                      💡 Contribute {Math.round(matchCapPct * 100)}% (${Math.round(Math.min(base * matchCapPct, irsLimit)).toLocaleString()}) to get full match
                    </p>
                  )}
                </button>
              );
            })()}
          </TabsContent>

          {/* EQUITY TAB */}
          <TabsContent value="equity" className="p-4 space-y-4 mt-0 sm:p-5 sm:space-y-5">
            {/* Equity Value by Year Visual */}
            <div className="rounded-lg border border-border/50 bg-gradient-to-br from-amber-500/5 to-transparent p-3 space-y-3 sm:p-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">Equity Vesting Timeline</p>
                <p className="text-xs text-muted-foreground">
                  {yearData.length}-year equity: <span className="font-semibold text-amber-600 dark:text-amber-400">${Math.round(yearData.reduce((s, r) => s + r.stock, 0)).toLocaleString()}</span>
                </p>
              </div>
              
              {/* Horizontal Vesting Bars */}
              <div className="space-y-2">
                {yearData.map((row) => {
                  const maxStock = Math.max(...yearData.map(r => r.stock), 1);
                  const pct = (row.stock / maxStock) * 100;
                  return (
                    <div key={row.year} className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground w-6">Y{row.year}</span>
                      <div className="flex-1 h-5 bg-muted/30 rounded overflow-hidden relative">
                        <div 
                          className="h-full bg-gradient-to-r from-amber-500 to-amber-400 rounded transition-all duration-500 flex items-center justify-end pr-2"
                          style={{ width: `${Math.max(pct, 8)}%` }}
                        >
                          <span className="text-[10px] font-medium text-amber-950">${Math.round(row.stock / 1000)}k</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
              
              {/* Cliff indicator if applicable */}
              {rsuGrant?.vesting && 'cliffMonths' in rsuGrant.vesting && rsuGrant.vesting.cliffMonths > 0 && (
                <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                  <span className="size-1.5 rounded-full bg-amber-500" />
                  {rsuGrant.vesting.cliffMonths}-month cliff before first vest
                </p>
              )}
            </div>

            {/* Stock Price Sensitivity */}
            {(() => {
              const basePrice = offer.growth?.startingPrice ?? 100;
              const totalEquity4yr = yearData.reduce((s, r) => s + r.stock, 0);
              const scenarios = [
                { label: '-50%', multiplier: 0.5, color: 'bg-red-400' },
                { label: '-25%', multiplier: 0.75, color: 'bg-orange-400' },
                { label: 'Current', multiplier: 1, color: 'bg-emerald-500' },
                { label: '+25%', multiplier: 1.25, color: 'bg-blue-400' },
                { label: '+50%', multiplier: 1.5, color: 'bg-violet-500' },
              ];
              const maxValue = totalEquity4yr * 1.5;
              return (
                <div className="rounded-lg border border-border/50 bg-gradient-to-br from-blue-500/5 to-transparent p-3 space-y-3 sm:p-4">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium">Stock Price Sensitivity</p>
                    <p className="text-xs text-muted-foreground">
                      Current price: <span className="font-semibold">${basePrice}</span>
                    </p>
                  </div>
                  <div className="space-y-1.5">
                    {scenarios.map((s) => {
                      const value = totalEquity4yr * s.multiplier;
                      const pct = (value / maxValue) * 100;
                      return (
                        <div key={s.label} className="flex items-center gap-2">
                          <span className="text-[10px] text-muted-foreground w-12 text-right">{s.label}</span>
                          <div className="flex-1 h-4 bg-muted/30 rounded overflow-hidden">
                            <div 
                              className={`h-full ${s.color} rounded transition-all duration-500 flex items-center justify-end pr-1.5`}
                              style={{ width: `${pct}%` }}
                            >
                              <span className="text-[9px] font-medium text-white drop-shadow-sm">${Math.round(value / 1000)}k</span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <p className="text-[10px] text-muted-foreground">
                    4-year equity value at different stock prices
                  </p>
                </div>
              );
            })()}

            <div className="space-y-2">
              <h3 className="font-medium text-sm">Equity Growth Assumptions</h3>
              {uiMode === "advanced" ? (
                <GrowthYoyEditor />
              ) : (
                <SimpleGrowthInput />
              )}
            </div>
            <div className="space-y-2">
              <h3 className="font-medium text-sm">All Equity Grants</h3>
              <GrantsPanel />
            </div>
          </TabsContent>

          {/* ADVANCED TAB - Cleaner accordion style */}
          <TabsContent value="advanced" className="mt-0">
            <div className="divide-y divide-border/60">
              {/* Raises Section */}
              <div>
                <button
                  type="button"
                  className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/30 transition-colors sm:px-5 sm:py-4"
                  onClick={() => toggleSection("raises")}
                >
                  <div className="flex items-center gap-3">
                    <ChevronRight
                      className={`size-4 text-muted-foreground transition-transform ${expandedSections.raises ? "rotate-90" : ""}`}
                    />
                    <div className="text-left">
                      <p className="text-sm font-medium">Raises & Salary Growth</p>
                      <p className="text-xs text-muted-foreground">
                        Configure annual raises and promotions
                      </p>
                    </div>
                  </div>
                </button>
                {expandedSections.raises && (
                  <div className="px-4 pb-4 pt-2 sm:px-5 sm:pb-5">
                    <RaisesEditor />
                  </div>
                )}
              </div>

              {/* Full Perks Section */}
              <div>
                <button
                  type="button"
                  className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/30 transition-colors sm:px-5 sm:py-4"
                  onClick={() => toggleSection("perks")}
                >
                  <div className="flex items-center gap-3">
                    <ChevronRight
                      className={`size-4 text-muted-foreground transition-transform ${expandedSections.perks ? "rotate-90" : ""}`}
                    />
                    <div className="text-left">
                      <p className="text-sm font-medium">All Benefits & 401(k)</p>
                      <p className="text-xs text-muted-foreground">
                        Full perks, retirement matching, and recurring benefits
                      </p>
                    </div>
                  </div>
                </button>
                {expandedSections.perks && (
                  <div className="px-4 pb-4 pt-2 sm:px-5 sm:pb-5">
                    <CashPerksPanel />
                  </div>
                )}
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
