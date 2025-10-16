"use client";
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
    <div className="space-y-6">
      {/* Retirement Section */}
      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="font-medium text-base">401(k) / Retirement Match</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Configure employer matching and contribution limits
            </p>
          </div>
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
            })}>+ Add Retirement Plan</Button>
          ) : (
            <Button type="button" size="sm" variant="outline" onClick={() => setOffer({ ...offer, retirement: undefined })}>Remove</Button>
          )}
        </div>
        {retirement ? (
          <div className="border rounded-lg p-4 space-y-3 bg-card">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              <div>
                <Label className="text-sm font-medium">Your Contribution</Label>
                <div className="relative mt-1">
                  <Input 
                    type="number" 
                    step={0.5} 
                    value={Math.round((retirement.employeeContributionPercent ?? 0) * 10000) / 100}
                    onChange={(e) => setOffer({ ...offer, retirement: { ...retirement, employeeContributionPercent: Number(e.target.value || '0') / 100 } })} 
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground pointer-events-none">%</span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">% of salary you contribute</p>
              </div>
              <div>
                <Label className="text-sm font-medium">Employer Match Rate</Label>
                <div className="relative mt-1">
                  <Input 
                    type="number" 
                    step={0.5} 
                    value={Math.round((retirement.matchRate ?? 0) * 10000) / 100}
                    onChange={(e) => setOffer({ ...offer, retirement: { ...retirement, matchRate: Number(e.target.value || '0') / 100 } })} 
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground pointer-events-none">%</span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">e.g., 50% = $0.50 per $1</p>
              </div>
              <div>
                <Label className="text-sm font-medium">Match Cap Type</Label>
                <select 
                  className="border rounded px-2 py-2 w-full mt-1" 
                  value={retirement.matchCapMode}
                  onChange={(e) => setOffer({ ...offer, retirement: { ...retirement, matchCapMode: e.target.value as 'percentOfSalary' | 'dollar' } })}
                >
                  <option value="percentOfSalary">% of Salary</option>
                  <option value="dollar">Fixed Dollar Cap</option>
                </select>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {retirement.matchCapMode === 'percentOfSalary' ? (
                <div>
                  <Label className="text-sm font-medium">Match Cap (% of Salary)</Label>
                  <div className="relative mt-1">
                    <Input 
                      type="number" 
                      step={0.5} 
                      value={Math.round((retirement.matchCapPercentOfSalary ?? 0) * 10000) / 100}
                      onChange={(e) => setOffer({ ...offer, retirement: { ...retirement, matchCapPercentOfSalary: Number(e.target.value || '0') / 100 } })} 
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground pointer-events-none">%</span>
                  </div>
                </div>
              ) : (
                <div>
                  <Label className="text-sm font-medium">Match Cap (Fixed $)</Label>
                  <CurrencyInput 
                    value={retirement.matchCapDollar ?? 0}
                    onValueChange={(v) => setOffer({ ...offer, retirement: { ...retirement, matchCapDollar: v } })} 
                  />
                </div>
              )}
              <div>
                <Label className="text-sm font-medium">IRS Contribution Limit</Label>
                <CurrencyInput 
                  value={retirement.employeeContributionCapDollar ?? 0}
                  onValueChange={(v) => setOffer({ ...offer, retirement: { ...retirement, employeeContributionCapDollar: v } })} 
                />
                <p className="text-xs text-muted-foreground mt-1">2024: $23,500 / 2025: $23,500</p>
              </div>
            </div>
            <div className="bg-muted/50 rounded p-3">
              <p className="text-sm font-medium">
                💰 Estimated Match: {formatCurrency(computeRetirementMatch(offer, 0))} in Year 1
              </p>
            </div>
          </div>
        ) : (
          <div className="border-2 border-dashed rounded-lg p-6 text-center">
            <p className="text-sm text-muted-foreground">No retirement plan configured</p>
          </div>
        )}
      </section>

      {/* Benefits Section */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-medium text-base">Annual Benefits</h3>
            <p className="text-xs text-muted-foreground mt-0.5">Health insurance, FSA, gym, etc.</p>
          </div>
          <Button type="button" size="sm" onClick={() => update('benefits', [...benefits, { name: 'Benefit', annualValue: 1000, enabled: true }])}>+ Add Benefit</Button>
        </div>
        {benefits.length === 0 ? (
          <div className="border-2 border-dashed rounded-lg p-6 text-center">
            <p className="text-sm text-muted-foreground">No benefits added yet</p>
          </div>
        ) : (
          <div className="space-y-2">
            {benefits.map((b, i) => (
              <div key={i} className="border rounded-lg p-3 bg-card hover:bg-accent/5 transition-colors">
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
                  <div className="sm:col-span-5">
                    <Label className="text-sm font-medium">Benefit Name</Label>
                    <Input 
                      value={b.name}
                      onChange={(e) => update('benefits', benefits.map((x, idx) => idx === i ? { ...x, name: e.target.value } : x))}
                      placeholder="e.g., Health Insurance"
                      className="mt-1"
                    />
                  </div>
                  <div className="sm:col-span-3">
                    <Label className="text-sm font-medium">Annual Value</Label>
                    <CurrencyInput 
                      value={b.annualValue}
                      onValueChange={(v) => update('benefits', benefits.map((x, idx) => idx === i ? { ...x, annualValue: v } : x))} 
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <Label className="text-sm font-medium">Status</Label>
                    <select 
                      className="border rounded px-2 py-2 w-full mt-1" 
                      value={String(b.enabled)}
                      onChange={(e) => update('benefits', benefits.map((x, idx) => idx === i ? { ...x, enabled: e.target.value === 'true' } : x))}
                    >
                      <option value="true">✓ Enabled</option>
                      <option value="false">✗ Disabled</option>
                    </select>
                  </div>
                  <div className="sm:col-span-2 flex items-end">
                    <Button 
                      type="button" 
                      size="sm" 
                      variant="destructive" 
                      onClick={() => update('benefits', benefits.filter((_, idx) => idx !== i))}
                      className="w-full"
                    >
                      Remove
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Miscellaneous Recurring Section */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-medium text-base">Other Recurring Compensation</h3>
            <p className="text-xs text-muted-foreground mt-0.5">Stipends, allowances, etc.</p>
          </div>
          <Button type="button" size="sm" onClick={() => update('miscRecurring', [...misc, { name: 'Other', annualValue: 500 }])}>+ Add Item</Button>
        </div>
        {misc.length === 0 ? (
          <div className="border-2 border-dashed rounded-lg p-6 text-center">
            <p className="text-sm text-muted-foreground">No miscellaneous items added</p>
          </div>
        ) : (
          <div className="space-y-2">
            {misc.map((m, i) => (
              <div key={i} className="border rounded-lg p-3 bg-card hover:bg-accent/5 transition-colors">
                <div className="grid grid-cols-1 sm:grid-cols-5 gap-3 items-end">
                  <div className="sm:col-span-2">
                    <Label className="text-sm font-medium">Item Name</Label>
                    <Input 
                      value={m.name}
                      onChange={(e) => update('miscRecurring', misc.map((x, idx) => idx === i ? { ...x, name: e.target.value } : x))}
                      placeholder="e.g., Phone Allowance"
                      className="mt-1"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <Label className="text-sm font-medium">Annual Value</Label>
                    <CurrencyInput 
                      value={m.annualValue}
                      onValueChange={(v) => update('miscRecurring', misc.map((x, idx) => idx === i ? { ...x, annualValue: v } : x))} 
                    />
                  </div>
                  <div className="flex items-end">
                    <Button 
                      type="button" 
                      size="sm" 
                      variant="destructive" 
                      onClick={() => update('miscRecurring', misc.filter((_, idx) => idx !== i))}
                      className="w-full"
                    >
                      Remove
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
