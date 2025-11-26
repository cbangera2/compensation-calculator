"use client";
import type { ChangeEvent } from "react";
import { useEffect, useId, useState, useMemo } from "react";
import { useStore } from "@/state/store";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import GrowthYoyEditor from "@/components/GrowthYoyEditor";
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
} from "lucide-react";
import { CITY_PRESETS } from "@/lib/col";

const QUICK_PERKS = [
  { name: "Free meals", annualValue: 5000 },
  { name: "Gym/wellness", annualValue: 1200 },
  { name: "Learning", annualValue: 1500 },
  { name: "HSA", annualValue: 1000 },
] as const;

export default function OfferForm() {
  const { offer, setOffer, setBonusValue, undo, redo, addGrant, updateGrant } =
    useStore();
  const [collapsed, setCollapsed] = useState(false);
  const [activeTab, setActiveTab] = useState("compensation");
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    raises: false,
    perks: false,
  });
  const contentId = useId();

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

  // Breakdown percentages for visual bar
  const breakdown = useMemo(() => {
    const total = totalCash + totalEquityY1 + totalPerks;
    if (total === 0) return { cash: 33, equity: 33, perks: 34 };
    return {
      cash: Math.round((totalCash / total) * 100),
      equity: Math.round((totalEquityY1 / total) * 100),
      perks: Math.round((totalPerks / total) * 100),
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

  return (
    <Card className="border-border/60 overflow-hidden">
      {/* Compact Header with Visual Breakdown */}
      <CardHeader className="border-b border-border/60 py-4 px-5 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <CardTitle className="text-lg font-semibold">
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
              className="size-8"
              onClick={undo}
              aria-label="Undo"
            >
              <Undo2 className="size-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-8"
              onClick={redo}
              aria-label="Redo"
            >
              <Redo2 className="size-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-8"
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
          <div className="flex justify-between text-[10px] text-muted-foreground">
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
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 py-3 text-sm"
            >
              <Briefcase className="size-4 mr-1.5" />
              Compensation
            </TabsTrigger>
            <TabsTrigger
              value="equity"
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 py-3 text-sm"
            >
              <TrendingUp className="size-4 mr-1.5" />
              Equity
            </TabsTrigger>
            <TabsTrigger
              value="advanced"
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 py-3 text-sm"
            >
              <Settings2 className="size-4 mr-1.5" />
              Advanced
            </TabsTrigger>
          </TabsList>

          {/* COMPENSATION TAB (merged Essentials + Perks) */}
          <TabsContent value="compensation" className="p-5 space-y-5 mt-0">
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
                  value={
                    CITY_PRESETS.find(
                      (c) =>
                        c.name === offer.location ||
                        (offer.colFactor &&
                          Math.abs(c.factor - offer.colFactor) < 0.001)
                    )?.key ?? "custom"
                  }
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
              </div>
            </div>

            {/* Main Compensation Grid */}
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {/* Base Salary */}
              <div className="rounded-lg border border-border/50 bg-gradient-to-br from-emerald-500/5 to-transparent p-4 space-y-2 relative overflow-hidden">
                <div className="absolute bottom-0 left-0 h-1 bg-emerald-500/40 transition-all duration-500" style={{ width: `${Math.min(100, (offer.base.startAnnual / (totalCash + totalEquityY1 + totalPerks || 1)) * 100)}%` }} />
                <Label className="text-sm font-medium flex items-center gap-2">
                  Base Salary
                  <span className="text-[10px] text-emerald-600 bg-emerald-500/10 px-1.5 py-0.5 rounded">
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
              <div className="rounded-lg border border-border/50 bg-gradient-to-br from-blue-500/5 to-transparent p-4 space-y-2 relative overflow-hidden">
                <div className="absolute bottom-0 left-0 h-1 bg-blue-500/40 transition-all duration-500" style={{ width: `${Math.min(100, ((totalCash - offer.base.startAnnual) / (totalCash + totalEquityY1 + totalPerks || 1)) * 100)}%` }} />
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-medium flex items-center gap-2">
                    Target Bonus
                    <span className="text-[10px] text-blue-600 bg-blue-500/10 px-1.5 py-0.5 rounded">
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
              <div className="rounded-lg border border-border/50 bg-gradient-to-br from-amber-500/5 to-transparent p-4 space-y-2 relative overflow-hidden">
                <div className="absolute bottom-0 left-0 h-1 bg-amber-500/40 transition-all duration-500" style={{ width: `${Math.min(100, (totalEquityY1 / (totalCash + totalEquityY1 + totalPerks || 1)) * 100)}%` }} />
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-medium flex items-center gap-2">
                    Equity
                    <span className="text-[10px] text-amber-600 bg-amber-500/10 px-1.5 py-0.5 rounded">
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
                <button
                  type="button"
                  className="text-xs text-primary hover:underline"
                  onClick={() => setActiveTab("equity")}
                >
                  Configure grants →
                </button>
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
                          <p className="text-xs text-indigo-600 mt-0.5 hover:underline">
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
                  className="w-full text-left rounded-lg border border-border/50 bg-gradient-to-br from-indigo-500/5 to-transparent p-4 space-y-3 hover:border-indigo-500/30 transition-colors"
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
                        <span className="font-medium text-indigo-600">${Math.round(actualMatch).toLocaleString()}/yr</span>
                      </div>
                      <div className="flex justify-between text-[10px]">
                        <span className="text-muted-foreground">IRS limit: ${irsLimit.toLocaleString()}</span>
                        <span>Max match: ${Math.round(maxPossibleMatch).toLocaleString()}/yr</span>
                      </div>
                    </div>
                  </div>
                  
                  {matchPct < 100 && (
                    <p className="text-[10px] text-amber-600 bg-amber-500/10 rounded px-2 py-1">
                      💡 Contribute {Math.round(matchCapPct * 100)}% (${Math.round(Math.min(base * matchCapPct, irsLimit)).toLocaleString()}) to get full match
                    </p>
                  )}
                </button>
              );
            })()}
          </TabsContent>

          {/* EQUITY TAB */}
          <TabsContent value="equity" className="p-5 space-y-5 mt-0">
            {/* Equity Value by Year Visual */}
            <div className="rounded-lg border border-border/50 bg-gradient-to-br from-amber-500/5 to-transparent p-4 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">Equity Vesting Timeline</p>
                <p className="text-xs text-muted-foreground">
                  {yearData.length}-year equity: <span className="font-semibold text-amber-600">${Math.round(yearData.reduce((s, r) => s + r.stock, 0)).toLocaleString()}</span>
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
                <div className="rounded-lg border border-border/50 bg-gradient-to-br from-blue-500/5 to-transparent p-4 space-y-3">
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
              <h3 className="font-medium text-sm">Stock Growth Assumptions</h3>
              <GrowthYoyEditor />
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
                  className="w-full flex items-center justify-between px-5 py-4 hover:bg-muted/30 transition-colors"
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
                  <div className="px-5 pb-5 pt-2">
                    <RaisesEditor />
                  </div>
                )}
              </div>

              {/* Full Perks Section */}
              <div>
                <button
                  type="button"
                  className="w-full flex items-center justify-between px-5 py-4 hover:bg-muted/30 transition-colors"
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
                  <div className="px-5 pb-5 pt-2">
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
