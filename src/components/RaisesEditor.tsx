"use client";
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useStore } from '@/state/store';

export default function RaisesEditor() {
  const { offer, addRaise, updateRaise, removeRaise } = useStore();
  const raises = offer.raises ?? [];

  function addPercent() {
    addRaise({ effectiveDate: offer.startDate, type: 'percent', value: 0.05 });
  }
  function addAbsolute() {
    addRaise({ effectiveDate: offer.startDate, type: 'absolute', value: 5000 });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div>
          <p className="text-sm text-muted-foreground">
            Model salary increases that occur during your employment period
          </p>
        </div>
        <div className="flex gap-2">
          <Button type="button" size="sm" onClick={addPercent}>
            + Percentage Raise
          </Button>
          <Button type="button" size="sm" variant="secondary" onClick={addAbsolute}>
            + Fixed Amount
          </Button>
        </div>
      </div>

      {raises.length === 0 ? (
        <div className="border-2 border-dashed rounded-lg p-8 text-center">
          <p className="text-sm text-muted-foreground mb-2">
            No raises configured yet
          </p>
          <p className="text-xs text-muted-foreground">
            Add a percentage or fixed dollar raise to model salary changes over time.
            Changes are automatically prorated within the affected year.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {raises.map((r, i) => (
            <div key={i} className="border rounded-lg p-4 bg-card hover:bg-accent/5 transition-colors">
              <div className="grid grid-cols-1 sm:grid-cols-6 gap-3 items-end">
                <div className="sm:col-span-2">
                  <Label className="text-sm font-medium">Effective Date</Label>
                  <Input 
                    type="date" 
                    value={r.effectiveDate}
                    onChange={(e) => updateRaise(i, { effectiveDate: e.target.value })}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label className="text-sm font-medium">Raise Type</Label>
                  <select 
                    className="border rounded px-2 py-2 w-full mt-1" 
                    value={r.type}
                    onChange={(e) => updateRaise(i, { type: e.target.value as 'percent' | 'absolute' })}
                  >
                    <option value="percent">% of Current</option>
                    <option value="absolute">Fixed $</option>
                  </select>
                </div>
                <div className="sm:col-span-2">
                  <Label className="text-sm font-medium">
                    Amount {r.type === 'percent' ? '(%)' : '($ per year)'}
                  </Label>
                  <div className="relative mt-1">
                    <Input
                      type="number"
                      step={r.type === 'percent' ? 0.5 : 1000}
                      value={r.type === 'percent' ? Math.round(r.value * 1000) / 10 : r.value}
                      onChange={(e) => {
                        const v = Number(e.target.value || '0');
                        updateRaise(i, { value: r.type === 'percent' ? v / 100 : v });
                      }}
                    />
                    {r.type === 'percent' && (
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground pointer-events-none">
                        %
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {r.type === 'percent' 
                      ? `${(r.value * 100).toFixed(1)}% increase` 
                      : `+$${r.value.toLocaleString()}/year`
                    }
                  </p>
                </div>
                <div className="flex justify-end">
                  <Button 
                    type="button" 
                    size="sm" 
                    variant="destructive" 
                    onClick={() => removeRaise(i)}
                  >
                    Remove
                  </Button>
                </div>
              </div>
            </div>
          ))}
          <p className="text-xs text-muted-foreground pl-1">
            💡 Tip: Raises are prorated based on the effective date within each year
          </p>
        </div>
      )}
    </div>
  );
}
