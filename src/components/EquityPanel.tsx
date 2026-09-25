"use client";

import { useStore } from '@/state/store';
import { sampleStartupEquity } from '@/core/startup';
import { Button } from '@/components/ui/button';
import { Rocket, PiggyBank } from 'lucide-react';
import EmptyState from '@/components/EmptyState';
import StartupPanel from '@/components/StartupPanel';
import EquityExplorer from '@/components/EquityExplorer';

function switchTab(tab: string) {
  window.dispatchEvent(new CustomEvent('compcalc:switch-tab', { detail: tab }));
}

/**
 * Equity tab — the merged home for equity modeling, replacing the old
 * separate Startup and Stock Growth tabs. Startup equity structure
 * (valuation, option grants, scenarios) sits above the growth projection,
 * which seeds itself from the startup valuation for private offers and
 * from grant FMV plus ticker history for public ones.
 */
export default function EquityPanel() {
  const { offers, activeIndex, updateOfferAt } = useStore();
  const offer = offers[activeIndex];
  const hasStartup = !!offer?.startupEquity?.enabled;
  const hasPublicEquity = (offer?.equityGrants?.length ?? 0) > 0;

  const enableStartupSample = () => {
    if (!offer) return;
    updateOfferAt(activeIndex, (o) => ({
      ...o,
      startupEquity: { ...sampleStartupEquity(), enabled: true },
    }));
  };

  // No equity modeled at all — one empty state with both on-ramps.
  if (!offer || (!hasStartup && !hasPublicEquity)) {
    return (
      <EmptyState
        icon={<PiggyBank className="size-4" />}
        title="No equity modeled yet"
        hint="Add public stock grants or model private-company equity with valuation scenarios — the projection below adapts to whichever you choose."
        action={
          <div className="flex flex-wrap items-center justify-center gap-2">
            <Button size="sm" onClick={() => switchTab('calc')}>
              Add stock grants
            </Button>
            <Button size="sm" variant="outline" onClick={enableStartupSample}>
              <Rocket className="size-3" />
              Model startup equity
            </Button>
          </div>
        }
      />
    );
  }

  return (
    <div className="space-y-6 sm:space-y-8">
      {hasStartup && <StartupPanel />}
      <EquityExplorer />
      {/* Public-only offer: compact on-ramp to startup modeling, preserving
          what the old standalone Startup tab offered via its empty state. */}
      {!hasStartup && hasPublicEquity && (
        <EmptyState
          icon={<Rocket className="size-4" />}
          title="Comparing against a startup offer?"
          hint="Model private-company equity on this offer with valuation scenarios and option grants."
          action={
            <Button size="sm" variant="outline" onClick={enableStartupSample}>
              Model startup equity
            </Button>
          }
        />
      )}
    </div>
  );
}
