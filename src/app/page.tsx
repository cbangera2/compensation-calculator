"use client";

import { Suspense, useEffect, useState, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import OfferForm from '@/components/OfferForm';
import YearChart from '@/components/YearChart';
import YearTable from '@/components/YearTable';
import MultiOfferBar from '@/components/MultiOfferBar';
import ComparisonChart from '@/components/ComparisonChart';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import EquityExplorer from '@/components/EquityExplorer';
import YearExtras from '@/components/YearExtras';
import ShareHydrator from '@/components/ShareHydrator';
import ComparisonAdjustments from '@/components/ComparisonAdjustments';
import ComparisonTrendChart from '@/components/ComparisonTrendChart';
import ComparisonStockChart from '@/components/ComparisonStockChart';
import CompareShareButton from '@/components/CompareShareButton';
import ComparePicker from '@/components/ComparePicker';
import DecisionHelpers from '@/components/DecisionHelpers';
import StatCards from '@/components/StatCards';
import StartupPanel from '@/components/StartupPanel';
import BenchmarkPanel from '@/components/BenchmarkPanel';
import LeaderboardPanel from '@/components/LeaderboardPanel';
import LiveTotals from '@/components/LiveTotals';
import RaisePlannerPanel from '@/components/RaisePlannerPanel';
import CityComparePanel from '@/components/CityComparePanel';
import ThemeToggle from '@/components/ThemeToggle';
import UiModeToggle from '@/components/UiModeToggle';
import OnboardingNudge from '@/components/OnboardingNudge';
import SidebarNav from '@/components/SidebarNav';
import { SidebarProvider } from '@/components/ui/sidebar';
import { useStore } from '@/state/store';
import ActiveOfferStrip, { isValidTabValue, type TabValue } from '@/components/ActiveOfferStrip';
import { TAB_GROUPS } from '@/lib/tabs';

function HomeContent() {
  const searchParams = useSearchParams();
  const [tab, setTab] = useState<TabValue>(() => {
    const param = searchParams.get('tab');
    return isValidTabValue(param) ? param : 'calc';
  });
  const { sidebarCollapsed, setSidebarCollapsed } = useStore();

  // Sync tab changes to the URL so tabs are deep-linkable and shareable.
  // Uses pushState so browser back/forward moves between tabs.
  const handleTabChange = useCallback((v: TabValue) => {
    setTab(v);
    const url = new URL(window.location.href);
    url.searchParams.set('tab', v);
    window.history.pushState(null, '', url.toString());
  }, []);

  // Keep tab state in sync when the user navigates with back/forward.
  useEffect(() => {
    const onPopState = () => {
      const param = new URL(window.location.href).searchParams.get('tab');
      if (isValidTabValue(param)) setTab(param);
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  // Programmatic tab switching for cross-tab deep links, e.g.
  // window.dispatchEvent(new CustomEvent('compcalc:switch-tab', { detail: 'compare' }))
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (isValidTabValue(detail)) handleTabChange(detail);
    };
    window.addEventListener('compcalc:switch-tab', handler);
    return () => window.removeEventListener('compcalc:switch-tab', handler);
  }, [handleTabChange]);

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(59,130,246,0.10),_transparent_55%)] pb-20">
      <Suspense fallback={null}>
        <ShareHydrator />
      </Suspense>
      <SidebarProvider
        open={!sidebarCollapsed}
        onOpenChange={(open) => setSidebarCollapsed(!open)}
      >
      <Tabs value={tab} onValueChange={(v) => { if (isValidTabValue(v)) handleTabChange(v); }} className="min-w-0 gap-0 md:flex-row">
        <SidebarNav activeTab={tab} onTabChange={(v) => { if (isValidTabValue(v)) handleTabChange(v); }} />
        <div className="min-w-0 flex-1">
          {/* Slim sticky top bar: live totals on desktop, section picker on mobile */}
          <div className="sticky top-0 z-30 border-b border-border/60 bg-background/85 backdrop-blur-md">
            <div className="hidden md:block">
              <div className="flex justify-end px-6 py-2">
                <LiveTotals />
              </div>
            </div>
            {/* Mobile: section picker on top, only the active section's
                tabs below. No more 7-pill horizontal scroll. */}
            <div className="px-4 py-2 md:hidden">
              <div className="flex gap-0.5 rounded-full bg-muted/60 p-1" role="group" aria-label="Sections">
                {TAB_GROUPS.map((group) => {
                  const isActiveGroup = group.tabs.some((t) => t.value === tab);
                  return (
                    <button
                      key={group.label}
                      type="button"
                      onClick={() => handleTabChange(group.tabs[0].value)}
                      aria-pressed={isActiveGroup}
                      className={`flex-1 rounded-full px-2 py-1.5 text-xs font-semibold transition-colors ${
                        isActiveGroup
                          ? 'bg-foreground text-background shadow-sm'
                          : 'text-muted-foreground'
                      }`}
                    >
                      {group.label}
                    </button>
                  );
                })}
              </div>
              <TabsList className="mt-2 flex flex-wrap gap-1.5 bg-transparent p-0" aria-label="Tabs">
                {TAB_GROUPS.find((g) => g.tabs.some((t) => t.value === tab))?.tabs.map((t) => (
                  <TabsTrigger
                    key={t.value}
                    value={t.value}
                    className="rounded-full border border-border/60 px-3.5 py-1.5 text-[13px] font-medium data-[state=active]:border-transparent data-[state=active]:bg-foreground data-[state=active]:text-background data-[state=active]:shadow-sm"
                  >
                    {t.label}
                  </TabsTrigger>
                ))}
              </TabsList>
              <div className="mt-1.5 border-t border-border/40 pt-1.5">
                <ActiveOfferStrip />
              </div>
            </div>
          </div>

          <div className="mx-auto flex w-full max-w-7xl flex-col gap-4 px-4 pb-8 pt-6 sm:gap-6 sm:px-6 sm:pb-12 sm:pt-8">
            <header className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground/80">
                  Model your offers
                </p>
                <h1 className="mt-1 text-xl font-bold tracking-tight text-foreground sm:text-3xl">
                  Compare compensation packages with clarity.
                </h1>
              </div>
              <div className="flex items-center gap-2">
                <UiModeToggle />
                <ThemeToggle />
              </div>
            </header>

            <OnboardingNudge />

            <MultiOfferBar />

            <StatCards />

            <div className="pt-4 sm:pt-6">
              <TabsContent value="calc" className="space-y-5 sm:space-y-8">
                <div className="grid gap-4 sm:gap-6 xl:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] xl:items-start">
                  <div className="order-2 xl:order-1">
                    <OfferForm />
                  </div>
                  <div className="order-1 flex flex-col gap-4 sm:gap-6 xl:order-2">
                    <YearChart />
                    <YearExtras />
                  </div>
                </div>
                <YearTable />
              </TabsContent>
              <TabsContent value="compare" className="space-y-4 sm:space-y-6">
                <div className="flex justify-end">
                  <CompareShareButton />
                </div>
                <ComparePicker />
                <ComparisonChart />
                <div className="grid gap-4 sm:gap-6 lg:grid-cols-2">
                  <ComparisonTrendChart />
                  <ComparisonStockChart />
                </div>
                <ComparisonAdjustments />
                <DecisionHelpers />
              </TabsContent>
              <TabsContent value="growth">
                <EquityExplorer />
              </TabsContent>
              <TabsContent value="startup">
                <StartupPanel />
              </TabsContent>
              <TabsContent value="benchmarks">
                <BenchmarkPanel />
              </TabsContent>
              <TabsContent value="leaderboard">
                <LeaderboardPanel />
              </TabsContent>
              <TabsContent value="raises">
                <RaisePlannerPanel />
              </TabsContent>
              <TabsContent value="cities">
                <CityComparePanel />
              </TabsContent>
            </div>
          </div>
        </div>
      </Tabs>
      </SidebarProvider>
    </main>
  );
}

export default function Home() {
  return (
    <Suspense fallback={null}>
      <HomeContent />
    </Suspense>
  );
}

// (Removed demo table to keep page server-safe and avoid client hooks here)
