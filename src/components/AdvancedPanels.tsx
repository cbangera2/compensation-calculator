"use client";
import GrowthYoyEditor from '@/components/GrowthYoyEditor';
import GrantsPanel from '@/components/GrantsPanel';
import RaisesEditor from '@/components/RaisesEditor';
import CashPerksPanel from '@/components/CashPerksPanel';
import { useStore } from '@/state/store';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export default function AdvancedPanels() {
  const { uiMode } = useStore();
  if (uiMode !== 'advanced') return null;
  return (
    <div className="mt-6">
      <Card>
        <CardHeader>
          <CardTitle>Advanced</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            <GrowthYoyEditor />
            <GrantsPanel />
            <RaisesEditor />
            <CashPerksPanel />
            <PersistencePanel />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function PersistencePanel() {
  const { offer, setOffer } = useStore();
  function exportJSON() {
    const blob = new Blob([JSON.stringify(offer, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `${offer.name || 'offer'}.json`; a.click();
    URL.revokeObjectURL(url);
  }
  function importJSON(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const obj = JSON.parse(String(reader.result));
        // Basic shape guard: rely on zod at form submit, here we accept and let UI reflect
        setOffer(obj);
  } catch {
        alert('Invalid JSON');
      }
    };
    reader.readAsText(file);
  }
  return (
    <Card>
      <CardHeader>
        <CardTitle>Import / Export</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-3">
          <Button type="button" onClick={exportJSON}>Export Offer JSON</Button>
          <label className="inline-flex items-center gap-2 cursor-pointer">
            <span className="px-3 py-2 border rounded">Import JSON</span>
            <input type="file" accept="application/json" className="hidden" onChange={importJSON} />
          </label>
        </div>
      </CardContent>
    </Card>
  );
}
