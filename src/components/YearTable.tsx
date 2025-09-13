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
        <CardTitle>Yearly Table</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-auto">
          <table className="min-w-[720px] text-sm">
            <thead>
              <tr className="text-left">
                <th className="pr-4 py-2">Year</th>
                <th className="pr-4 py-2">Base</th>
                <th className="pr-4 py-2">Stock</th>
                <th className="pr-4 py-2">Bonus+Other</th>
                <th className="pr-4 py-2">Total</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.year} className="border-t border-gray-200">
                  <td className="pr-4 py-2">{r.year}</td>
                  <td className="pr-4 py-2">${Math.round(r.base).toLocaleString()}</td>
                  <td className="pr-4 py-2">${Math.round(r.stock).toLocaleString()}</td>
                  <td className="pr-4 py-2">${Math.round(r.bonus + r.other).toLocaleString()}</td>
                  <td className="pr-4 py-2 font-medium">${Math.round(r.total).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
