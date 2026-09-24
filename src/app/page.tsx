"use client";

import { Fragment, Suspense, useEffect, useState } from 'react';
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
import DecisionHelpers from '@/components/DecisionHelpers';
import StatCards from '@/components/StatCards';
import StartupPanel from '@/components/StartupPanel';
import BenchmarkPanel from '@/components/BenchmarkPanel';
import LiveTotals from '@/components/LiveTotals';
import RaisePlannerPanel from '@/components/RaisePlannerPanel';
import CityComparePanel from '@/components/CityComparePanel';
import ThemeToggle from '@/components/ThemeToggle';
import ActiveOfferStrip, { TAB_GROUPS, isValidTabValue, type TabValue } from '@/components/ActiveOfferStrip';

export default function Home() {
  const [tab, setTab] = useState<TabValue>('calc');

  // Programmatic tab switching for cross-tab deep links, e.g.
  // window.dispatchEvent(new CustomEvent('compcalc:switch-tab', { detail: 'compare' }))
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (isValidTabValue(detail)) setTab(detail);
    };
    window.addEventListener('compcalc:switch-tab', handler);
    return () => window.removeEventListener('compcalc:switch-tab', handler);
  }, []);

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(59,130,246,0.10),_transparent_55%)] pb-20">
      <Suspense fallback={null}>
        <ShareHydrator />
      </Suspense>
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
          <ThemeToggle />
        </header>

        <MultiOfferBar />

        <StatCards />

        <Tabs value={tab} onValueChange={(v) => { if (isValidTabValue(v)) setTab(v); }} className="gap-0">
          <div className="sticky top-0 z-30 -mx-4 border-b border-border/60 bg-background/85 px-4 py-2 backdrop-blur-md sm:-mx-6 sm:px-6">
            <div className="flex items-center justify-between gap-4">
              <TabsList className="no-scrollbar h-10 flex-1 justify-start gap-1 overflow-x-auto bg-transparent p-0 md:flex-none">
                {TAB_GROUPS.map((group, gi) => (
                  <Fragment key={group.label}>
                    {gi > 0 && (
                      <span aria-hidden="true" className="mx-1 h-5 w-px shrink-0 self-center bg-border/70" />
                    )}
                    <span className="shrink-0 self-center pr-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground/60">
                      {group.label}
                    </span>
                    {group.tabs.map((t) => (
                      <TabsTrigger
                        key={t.value}
                        value={t.value}
                        className="shrink-0 rounded-full px-4 py-2 text-sm data-[state=active]:bg-foreground data-[state=active]:text-background data-[state=active]:shadow-sm"
                      >
                        {t.label}
                      </TabsTrigger>
                    ))}
                  </Fragment>
                ))}
              </TabsList>
              <LiveTotals />
            </div>
            <div className="mt-1.5 border-t border-border/40 pt-1.5 md:hidden">
              <ActiveOfferStrip />
            </div>
          </div>

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
            <TabsContent value="raises">
              <RaisePlannerPanel />
            </TabsContent>
            <TabsContent value="cities">
              <CityComparePanel />
            </TabsContent>
          </div>
        </Tabs>
      </div>
    </main>
  );
}

// (Removed demo table to keep page server-safe and avoid client hooks here)
