"use client";
import { useStore } from '@/state/store';
import { computeOffer } from '@/core/compute';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function YearTable() {
  const { offer } = useStore();
  const rows = computeOffer(offer);
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base sm:text-lg">Yearly Table</CardTitle>
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
