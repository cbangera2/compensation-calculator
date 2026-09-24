"use client";
import { useStore } from '@/state/store';
import { computeOffer } from '@/core/compute';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Download } from 'lucide-react';

export default function YearTable() {
  const { offer } = useStore();
  const rows = computeOffer(offer);

  function exportCsv() {
    const header = 'Year,Base,Stock,Bonus,Other,Total';
    const lines = rows.map((r) =>
      [r.year, Math.round(r.base), Math.round(r.stock), Math.round(r.bonus), Math.round(r.other), Math.round(r.total)].join(',')
    );
    const csv = [header, ...lines].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const safeName = (offer.name || 'offer').replace(/[^a-z0-9-_]+/gi, '-').toLowerCase();
    a.href = url;
    a.download = `${safeName}-yearly-breakdown.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
        <CardTitle className="text-base sm:text-lg">Yearly Table</CardTitle>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={exportCsv}
          className="h-8 gap-1.5 text-xs text-muted-foreground hover:text-foreground"
        >
          <Download className="size-3.5" />
          CSV
        </Button>
      </CardHeader>
      <CardContent className="px-3 sm:px-6">
        <div className="overflow-auto">
          <table className="min-w-[560px] text-xs tabular-nums sm:min-w-[720px] sm:text-sm">
            <thead>
              <tr className="text-left">
                <th className="py-2 pr-3 sm:pr-4">Year</th>
                <th className="py-2 pr-3 sm:pr-4">Base</th>
                <th className="py-2 pr-3 sm:pr-4">Stock</th>
                <th className="py-2 pr-3 sm:pr-4">Bonus+Other</th>
                <th className="py-2 pr-3 sm:pr-4">Total</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.year} className="border-t border-border">
                  <td className="py-2 pr-3 sm:pr-4">{r.year}</td>
                  <td className="py-2 pr-3 sm:pr-4">${Math.round(r.base).toLocaleString()}</td>
                  <td className="py-2 pr-3 sm:pr-4">${Math.round(r.stock).toLocaleString()}</td>
                  <td className="py-2 pr-3 sm:pr-4">${Math.round(r.bonus + r.other).toLocaleString()}</td>
                  <td className="py-2 pr-3 font-medium sm:pr-4">${Math.round(r.total).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
