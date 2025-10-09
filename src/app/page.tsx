export default function Home() {
  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(59,130,246,0.12),_transparent_55%)] pb-20">
      <Suspense fallback={null}>
        <ShareHydrator />
      </Suspense>
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-6 pb-12 pt-12">
        <header className="flex flex-col gap-5">
          <div className="inline-flex w-fit items-center gap-2 rounded-full border border-border/60 bg-background/80 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground/80 shadow-xs">
            Model your offers
          </div>
          <div className="flex flex-col gap-3">
            <h1 className="text-4xl font-bold tracking-tight text-foreground sm:text-5xl">Compare compensation packages with clarity.</h1>
            <p className="max-w-2xl text-base text-muted-foreground sm:text-lg">
              Tune every lever—cash, equity, bonuses, and perks—and instantly see how they play out over multiple years.
            </p>
          </div>
          <MultiOfferBar />
        </header>

        <StatCards />

        <section className="rounded-3xl border border-border/60 bg-background/80 p-4 shadow-lg shadow-black/5 backdrop-blur-sm">
          <Tabs defaultValue="calc" className="gap-6">
            <TabsList className="w-full flex-wrap justify-start gap-2 bg-muted/50 p-1">
              <TabsTrigger value="calc" className="flex-1 min-w-[140px]">Calculator</TabsTrigger>
              <TabsTrigger value="compare" className="flex-1 min-w-[140px]">Compare</TabsTrigger>
              <TabsTrigger value="col" className="flex-1 min-w-[140px]">COL</TabsTrigger>
              <TabsTrigger value="growth" className="flex-1 min-w-[140px]">Stock Growth</TabsTrigger>
            </TabsList>
            <TabsContent value="calc" className="mt-6 space-y-8">
              <div className="grid gap-6 xl:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] xl:items-start">
                <div className="order-2 xl:order-1">
                  <OfferForm />
                </div>
                <div className="order-1 flex flex-col gap-6 xl:order-2">
                  <YearChart />
                  <YearExtras />
                </div>
              </div>
              <YearTable />
            </TabsContent>
            <TabsContent value="compare" className="mt-6 space-y-6">
              <ComparisonChart />
              <div className="grid gap-6 lg:grid-cols-2">
                <ComparisonTrendChart />
                <ComparisonStockChart />
              </div>
              <ComparisonAdjustments />
            </TabsContent>
            <TabsContent value="col" className="mt-6">
              <COLPanel />
            </TabsContent>
            <TabsContent value="growth" className="mt-6">
              <EquityExplorer />
            </TabsContent>
          </Tabs>
        </section>
      </div>
    </main>
  );
}

import OfferForm from '@/components/OfferForm';
import YearChart from '@/components/YearChart';
import YearTable from '@/components/YearTable';
import MultiOfferBar from '@/components/MultiOfferBar';
import ComparisonChart from '@/components/ComparisonChart';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import COLPanel from '@/components/COLPanel';
import EquityExplorer from '@/components/EquityExplorer';
import YearExtras from '@/components/YearExtras';
import ShareHydrator from '@/components/ShareHydrator';
import ComparisonAdjustments from '@/components/ComparisonAdjustments';
import ComparisonTrendChart from '@/components/ComparisonTrendChart';
import ComparisonStockChart from '@/components/ComparisonStockChart';
import StatCards from '@/components/StatCards';
import { Suspense } from 'react';

// (Removed demo table to keep page server-safe and avoid client hooks here)
