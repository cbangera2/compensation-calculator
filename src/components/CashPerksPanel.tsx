"use client";
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { CurrencyInput } from '@/components/ui/currency-input';
import { useStore } from '@/state/store';
import { computeRetirementMatch } from '@/core/compute';
import { formatCurrency } from '@/lib/utils';

export default function CashPerksPanel() {
  const { offer, setOffer } = useStore();
  const benefits = offer.benefits ?? [];
  const misc = offer.miscRecurring ?? [];
  const retirement = offer.retirement;

  function update<K extends keyof typeof offer>(k: K, next: (typeof offer)[K]) {
    setOffer({ ...offer, [k]: next });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Cash, Bonuses & Perks</CardTitle>
      </CardHeader>
      <CardContent>
        {/* Signing and relocation are managed in the main form; omitted here to avoid duplication. */}

        <section className="space-y-2 mb-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="font-medium">Retirement</h3>
            {!retirement ? (
              <Button type="button" size="sm" onClick={() => setOffer({
                ...offer,
                retirement: {
                  employeeContributionPercent: 0.06,
                  matchRate: 0.5,
                  matchCapPercentOfSalary: 0.06,
                  employeeContributionCapDollar: 23500,
                  matchCapMode: 'percentOfSalary',
                  matchCapDollar: 0,
                }
              })}>Add</Button>
            ) : (
              <Button type="button" size="sm" variant="destructive" onClick={() => setOffer({ ...offer, retirement: undefined })}>Remove</Button>
            )}
          </div>
          {retirement ? (
            <div className="space-y-2">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-2 items-end">
                <div>
                  <Label>Your contribution %</Label>
                  <Input type="number" step={0.5} value={Math.round((retirement.employeeContributionPercent ?? 0) * 10000) / 100}
                    onChange={(e) => setOffer({ ...offer, retirement: { ...retirement, employeeContributionPercent: Number(e.target.value || '0') / 100 } })} />
                </div>
                <div>
                  <Label>Match rate %</Label>
                  <Input type="number" step={0.5} value={Math.round((retirement.matchRate ?? 0) * 10000) / 100}
                    onChange={(e) => setOffer({ ...offer, retirement: { ...retirement, matchRate: Number(e.target.value || '0') / 100 } })} />
                </div>
                <div>
                  <Label>Cap type</Label>
                  <select className="border rounded px-2 py-2 w-full" value={retirement.matchCapMode}
                    onChange={(e) => setOffer({ ...offer, retirement: { ...retirement, matchCapMode: e.target.value as 'percentOfSalary' | 'dollar' } })}>
                    <option value="percentOfSalary">% of salary</option>
                    <option value="dollar">$ cap</option>
                  </select>
                </div>
                {retirement.matchCapMode === 'percentOfSalary' ? (
                  <div>
                    <Label>Cap % of salary</Label>
                    <Input type="number" step={0.5} value={Math.round((retirement.matchCapPercentOfSalary ?? 0) * 10000) / 100}
                      onChange={(e) => setOffer({ ...offer, retirement: { ...retirement, matchCapPercentOfSalary: Number(e.target.value || '0') / 100 } })} />
                  </div>
                ) : (
                  <div>
                    <Label>Cap $</Label>
                    <CurrencyInput value={retirement.matchCapDollar ?? 0}
                      onValueChange={(v) => setOffer({ ...offer, retirement: { ...retirement, matchCapDollar: v } })} />
                  </div>
                )}
                <div>
                  <Label>Your IRS cap $</Label>
                  <CurrencyInput value={retirement.employeeContributionCapDollar ?? 0}
                    onValueChange={(v) => setOffer({ ...offer, retirement: { ...retirement, employeeContributionCapDollar: v } })} />
                </div>
              </div>
              <div className="text-sm text-muted-foreground">
                Employer match (calculated): {formatCurrency(computeRetirementMatch(offer, 0))} in Year 1
              </div>
            </div>
          ) : (
            <div className="text-sm text-muted-foreground">No retirement plan configured.</div>
          )}
        </section>

        <section className="space-y-2 mb-4">
          <div className="flex items-center justify-between">
            <h3 className="font-medium">Benefits ($/yr)</h3>
            <Button type="button" size="sm" onClick={() => update('benefits', [...benefits, { name: 'Benefit', annualValue: 1000, enabled: true }])}>Add</Button>
          </div>
          <div className="grid gap-2">
            {benefits.map((b, i) => (
              <div key={i} className="grid grid-cols-1 sm:grid-cols-6 gap-2 items-end">
                <div className="sm:col-span-2">
                  <Label>Name</Label>
                  <Input value={b.name}
                    onChange={(e) => update('benefits', benefits.map((x, idx) => idx === i ? { ...x, name: e.target.value } : x))} />
                </div>
                <div>
                  <Label>Annual $</Label>
                  <CurrencyInput value={b.annualValue}
                    onValueChange={(v) => update('benefits', benefits.map((x, idx) => idx === i ? { ...x, annualValue: v } : x))} />
                </div>
                <div>
                  <Label>Enabled</Label>
                  <select className="border rounded px-2 py-2 w-full" value={String(b.enabled)}
                    onChange={(e) => update('benefits', benefits.map((x, idx) => idx === i ? { ...x, enabled: e.target.value === 'true' } : x))}>
                    <option value="true">Yes</option>
                    <option value="false">No</option>
                  </select>
                </div>
                <div className="sm:col-span-2" />
                <div className="sm:col-span-1">
                  <Button type="button" variant="destructive" onClick={() => update('benefits', benefits.filter((_, idx) => idx !== i))}>Remove</Button>
                </div>
              </div>
            ))}
            {benefits.length === 0 && <p className="text-sm text-muted-foreground">No benefits listed.</p>}
          </div>
        </section>

        <section className="space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="font-medium">Misc recurring ($/yr)</h3>
            <Button type="button" size="sm" onClick={() => update('miscRecurring', [...misc, { name: 'Other', annualValue: 500 }])}>Add</Button>
          </div>
          <div className="grid gap-2">
            {misc.map((m, i) => (
              <div key={i} className="grid grid-cols-1 sm:grid-cols-5 gap-2 items-end">
                <div className="sm:col-span-2">
                  <Label>Name</Label>
                  <Input value={m.name}
                    onChange={(e) => update('miscRecurring', misc.map((x, idx) => idx === i ? { ...x, name: e.target.value } : x))} />
                </div>
                <div>
                  <Label>Annual $</Label>
                  <CurrencyInput value={m.annualValue}
                    onValueChange={(v) => update('miscRecurring', misc.map((x, idx) => idx === i ? { ...x, annualValue: v } : x))} />
                </div>
                <div className="sm:col-span-1" />
                <div className="sm:col-span-1">
                  <Button type="button" variant="destructive" onClick={() => update('miscRecurring', misc.filter((_, idx) => idx !== i))}>Remove</Button>
                </div>
              </div>
            ))}
            {misc.length === 0 && <p className="text-sm text-muted-foreground">No misc items.</p>}
          </div>
        </section>
      </CardContent>
    </Card>
  );
}
