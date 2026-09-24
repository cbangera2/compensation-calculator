"use client";

import { useMemo } from 'react';
import { ArrowLeftRight, CalendarClock, TrendingUp } from 'lucide-react';
import { useStore } from '@/state/store';
import { computeOffer, type YearRow } from '@/core/compute';
import { yoyFromCagr } from '@/core/growth';
import { formatCurrency } from '@/lib/utils';
import type { TOffer } from '@/models/types';
import MobileCollapse from '@/components/MobileCollapse';
import EmptyState from '@/components/EmptyState';
import { CardTitle } from '@/components/ui/card';

/**
 * DecisionHelpers — plain-English decision aids for the compare tab.
 *
 * For every pair of offers it derives three insights from the same
 * computeOffer engine the charts use, so the numbers always agree with
 * what the user sees above:
 *  1. Crossover year — the first year cumulative comp of B overtakes A.
 *  2. Sensitivity — the breakeven constant growth rate for the loser's
 *     stock that would flip the horizon winner (bisection scan).
 *  3. Vesting timing — front-loaded vs back-loaded equity, plus 1-year
 *     cliff asymmetry.
 *
 * Note: grants with a targetValue re-peg their implied share count to
 * the modeled price path inside computeOffer. The sensitivity scan uses
 * the same semantics as the Stock Growth tab's growth slider, so the
 * breakeven rate agrees with what dragging that slider would show.
 */

type PairInsight = {
  key: string;
  aName: string;
  bName: string;
  crossoverLine: string;
  sensitivityLine: string;
  vestingLines: string[];
};

const SCAN_LO = -0.5; // -50%/yr
const SCAN_HI = 1.0; // +100%/yr
const VESTING_DIFF_THRESHOLD = 0.1; // 10pp front-load difference worth flagging

function offerLabel(offer: TOffer, index: number): string {
  const name = offer.name?.trim();
  return name ? name : `Offer ${index + 1}`;
}

function cumulativeTotals(rows: YearRow[]): number[] {
  const out: number[] = [];
  let sum = 0;
  for (const r of rows) {
    sum += r.total;
    out.push(sum);
  }
  return out;
}

/** Pad a cumulative series to length H by repeating its final value. */
function padTo(values: number[], h: number): number[] {
  const out = values.slice(0, h);
  const last = out.length ? out[out.length - 1]! : 0;
  while (out.length < h) out.push(last);
  return out;
}

/** Compact dollar formatting for inline copy: $42k, $1.2M. */
function fmtShort(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `$${Math.round(n / 1_000)}k`;
  return formatCurrency(Math.round(n));
}

/**
 * Horizon cumulative total for an offer with its growth replaced by a
 * constant annual rate g. Used by the sensitivity bisection.
 */
function horizonTotalWithGrowth(offer: TOffer, g: number): number {
  const horizon = offer.assumptions?.horizonYears ?? 4;
  const rows = computeOffer({
    ...offer,
    growth: {
      startingPrice: offer.growth?.startingPrice ?? 100,
      yoy: yoyFromCagr(g, horizon),
    },
  });
  return rows.reduce((s, r) => s + r.total, 0);
}

function crossoverLine(aName: string, bName: string, cumA: number[], cumB: number[]): string {
  const h = Math.max(cumA.length, cumB.length, 1);
  const A = padTo(cumA, h);
  const B = padTo(cumB, h);
  const gap = B[h - 1]! - A[h - 1]!;

  let crossYear = -1;
  for (let i = 0; i < h; i++) {
    if (B[i]! > A[i]!) {
      crossYear = i + 1;
      break;
    }
  }

  if (Math.abs(gap) < 0.5) {
    return crossYear > 0
      ? `Dead even over ${h} years — ${bName} catches up in year ${crossYear}.`
      : `Dead even over ${h} years.`;
  }
  const leader = gap > 0 ? bName : aName;
  const ahead = fmtShort(gap);
  if (crossYear < 0) {
    return `${leader} stays ahead every year — ends ${ahead} ahead over ${h} years.`;
  }
  if (crossYear === 1) {
    return `${leader} leads from year 1 — ends ${ahead} ahead over ${h} years.`;
  }
  return `${leader} pulls ahead in year ${crossYear} — ends ${ahead} ahead over ${h} years.`;
}

function sensitivityLine(
  winner: TOffer,
  winnerName: string,
  loser: TOffer,
  loserName: string
): string {
  const loserRows = computeOffer(loser);
  const loserEquity = loserRows.reduce((s, r) => s + r.stock, 0);
  if (!(loserEquity > 0)) {
    return `Stock growth can't flip this — the gap is decided by cash, not equity.`;
  }

  const winnerCum = computeOffer(winner).reduce((s, r) => s + r.total, 0);
  const diff = (g: number) => horizonTotalWithGrowth(loser, g) - winnerCum;
  const lo = diff(SCAN_LO);
  const hi = diff(SCAN_HI);
  if (!Number.isFinite(lo) || !Number.isFinite(hi)) {
    return `Couldn't pin down a breakeven growth rate for ${loserName}.`;
  }
  if (lo >= 0) {
    return `${loserName} wins no matter what the stock does — even at -50%/yr.`;
  }
  if (hi <= 0) {
    return `${winnerName} wins even if ${loserName}'s stock grew 100%/yr.`;
  }
  // diff is non-decreasing in g (stock value rises with the price path),
  // so bisection converges on the smallest g where the loser ties.
  let a = SCAN_LO;
  let b = SCAN_HI;
  for (let i = 0; i < 40; i++) {
    const m = (a + b) / 2;
    if (diff(m) >= 0) b = m;
    else a = m;
  }
  const breakeven = (a + b) / 2;
  return `${winnerName} wins unless ${loserName}'s stock grows \u2265 ${Math.round(breakeven * 100)}%/yr.`;
}

function vestingLines(
  aName: string,
  bName: string,
  rowsA: YearRow[],
  rowsB: YearRow[]
): string[] {
  const lines: string[] = [];
  const eqA = rowsA.reduce((s, r) => s + r.stock, 0);
  const eqB = rowsB.reduce((s, r) => s + r.stock, 0);
  if (!(eqA > 0) || !(eqB > 0)) return lines;

  // 1-year cliff asymmetry: one offer vests nothing in year 1, the other does.
  const cliffA = rowsA.length > 0 && rowsA[0]!.stock <= 0;
  const cliffB = rowsB.length > 0 && rowsB[0]!.stock <= 0;
  if (cliffA !== cliffB) {
    const cliffed = cliffA ? aName : bName;
    const other = cliffA ? bName : aName;
    lines.push(`${cliffed} has a 1-year cliff — no equity vests in year 1, while ${other} pays from the start.`);
  }

  // Front-loaded vs back-loaded: share of equity vesting in the first half.
  const h = Math.max(rowsA.length, rowsB.length, 1);
  const split = Math.max(1, Math.ceil(h / 2));
  const frontFrac = (rows: YearRow[]) => {
    const total = rows.reduce((s, r) => s + r.stock, 0);
    const first = rows.slice(0, split).reduce((s, r) => s + r.stock, 0);
    return total > 0 ? first / total : 0;
  };
  const fA = frontFrac(rowsA);
  const fB = frontFrac(rowsB);
  if (Math.abs(fA - fB) >= VESTING_DIFF_THRESHOLD) {
    const [frontName, frontF, backName, backF] =
      fA > fB ? [aName, fA, bName, fB] : [bName, fB, aName, fA];
    lines.push(
      `${frontName} is more front-loaded — ${Math.round(frontF * 100)}% of equity vests in years 1–${split} vs ${Math.round(backF * 100)}% for ${backName}.`
    );
  }
  return lines;
}

function buildInsights(offers: TOffer[]): PairInsight[] {
  const insights: PairInsight[] = [];
  const rowsPerOffer = offers.map((o) => computeOffer(o));
  for (let i = 0; i < offers.length; i++) {
    for (let j = i + 1; j < offers.length; j++) {
      const a = offers[i]!;
      const b = offers[j]!;
      const aName = offerLabel(a, i);
      const bName = offerLabel(b, j);
      const rowsA = rowsPerOffer[i]!;
      const rowsB = rowsPerOffer[j]!;
      const cumA = cumulativeTotals(rowsA);
      const cumB = cumulativeTotals(rowsB);
      const h = Math.max(cumA.length, cumB.length, 1);
      const totalA = padTo(cumA, h)[h - 1]!;
      const totalB = padTo(cumB, h)[h - 1]!;
      const isTie = Math.abs(totalA - totalB) < 0.5;
      // Ties are vanishingly rare with real numbers; break them by year-1 cash.
      const aWins = totalA >= totalB;
      insights.push({
        key: `${i}-${j}`,
        aName,
        bName,
        crossoverLine: crossoverLine(aName, bName, cumA, cumB),
        sensitivityLine: isTie
          ? `Neck and neck at current assumptions — any stock-growth edge decides it.`
          : aWins
            ? sensitivityLine(a, aName, b, bName)
            : sensitivityLine(b, bName, a, aName),
        vestingLines: vestingLines(aName, bName, rowsA, rowsB),
      });
    }
  }
  return insights;
}

function InsightRow({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2 text-sm leading-snug text-foreground">
      <span className="mt-0.5 shrink-0 text-muted-foreground">{icon}</span>
      <span>{children}</span>
    </li>
  );
}

export default function DecisionHelpers() {
  const { offers } = useStore();
  const insights = useMemo(() => buildInsights(offers), [offers]);

  if (offers.length < 2) {
    return (
      <EmptyState
        icon={<ArrowLeftRight className="size-4" />}
        title="Add a second offer to unlock decision helpers"
        hint="Crossover year, breakeven growth rates, and vesting-timing callouts appear here once you're comparing two or more offers."
      />
    );
  }

  return (
    <MobileCollapse
      title="Decision helpers"
      description="Crossover year · breakeven growth · vesting timing"
      header={<CardTitle className="text-base sm:text-lg">Decision helpers</CardTitle>}
      contentClassName="space-y-4"
    >
      <div className="divide-y divide-border/60">
        {insights.map((ins) => (
          <div key={ins.key} className="space-y-2 py-3 first:pt-0 last:pb-0">
            <p className="text-sm font-semibold text-foreground">
              {ins.aName} <span className="font-normal text-muted-foreground">vs</span> {ins.bName}
            </p>
            <ul className="space-y-1.5">
              <InsightRow icon={<ArrowLeftRight className="size-4" />}>
                {ins.crossoverLine}
              </InsightRow>
              <InsightRow icon={<TrendingUp className="size-4" />}>
                {ins.sensitivityLine}
              </InsightRow>
              {ins.vestingLines.map((line, k) => (
                <InsightRow key={k} icon={<CalendarClock className="size-4" />}>
                  {line}
                </InsightRow>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <p className="text-xs leading-relaxed text-muted-foreground">
        Breakevens assume a constant annual growth rate for the trailing offer&apos;s stock and the
        same horizon as the comparison above. Projections, not predictions.
      </p>
    </MobileCollapse>
  );
}
