"use client";
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
    <Card>
      <CardHeader>
        <CardTitle>Raises & Mid‑year Changes</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex gap-2 mb-4">
          <Button type="button" onClick={addPercent}>Add % Raise</Button>
          <Button type="button" variant="secondary" onClick={addAbsolute}>Add $ Raise</Button>
        </div>
        <div className="grid gap-3">
          {raises.map((r, i) => (
            <div key={i} className="grid grid-cols-6 gap-3 items-end border rounded p-3">
              <div className="col-span-2">
                <Label>Effective date</Label>
                <Input type="date" value={r.effectiveDate}
                  onChange={(e) => updateRaise(i, { effectiveDate: e.target.value })} />
              </div>
              <div>
                <Label>Type</Label>
                <select className="border rounded px-2 py-2 w-full" value={r.type}
                  onChange={(e) => updateRaise(i, { type: e.target.value as 'percent' | 'absolute' })}>
                  <option value="percent">Percent</option>
                  <option value="absolute">Absolute</option>
                </select>
              </div>
              <div className="col-span-2">
                <Label>Value {r.type === 'percent' ? '(%)' : '($/yr)'}</Label>
                <Input
                  type="number"
                  step={r.type === 'percent' ? 0.5 : 100}
                  value={r.type === 'percent' ? Math.round(r.value * 1000) / 10 : r.value}
                  onChange={(e) => {
                    const v = Number(e.target.value || '0');
                    updateRaise(i, { value: r.type === 'percent' ? v / 100 : v });
                  }}
                />
              </div>
              <div className="flex gap-2">
                <Button type="button" variant="destructive" onClick={() => removeRaise(i)}>Remove</Button>
              </div>
            </div>
          ))}
          {raises.length === 0 && (
            <p className="text-sm text-muted-foreground">No raises yet. Add one above. Changes are prorated within affected years.</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
