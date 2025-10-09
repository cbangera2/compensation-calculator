export default function Home() {
  return (
    <main className="min-h-screen p-8">
      <ShareHydrator />
      <h1 className="text-3xl font-semibold mb-6">Compensation</h1>
      <MultiOfferBar />
      <Tabs defaultValue="calc">
        <TabsList>
          <TabsTrigger value="calc">Calculator</TabsTrigger>
          <TabsTrigger value="compare">Compare</TabsTrigger>
          <TabsTrigger value="col">COL</TabsTrigger>
          <TabsTrigger value="growth">Stock Growth</TabsTrigger>
        </TabsList>
        <TabsContent value="calc">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="space-y-6">
              <OfferForm />
            </div>
            <YearChart />
          </div>
          <div className="mt-6">
            <YearTable />
          </div>
          <div className="mt-6">
            <YearExtras />
          </div>
        </TabsContent>
        <TabsContent value="compare">
          <div className="mt-4 space-y-4">
            <ComparisonChart />
            <div className="grid gap-4 lg:grid-cols-2">
              <ComparisonTrendChart />
              <ComparisonStockChart />
            </div>
            <ComparisonAdjustments />
          </div>
        </TabsContent>
        <TabsContent value="col">
          <div className="mt-4">
            <COLPanel />
          </div>
        </TabsContent>
        <TabsContent value="growth">
          <div className="mt-4">
            <EquityExplorer />
          </div>
        </TabsContent>
      </Tabs>
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

// (Removed demo table to keep page server-safe and avoid client hooks here)
