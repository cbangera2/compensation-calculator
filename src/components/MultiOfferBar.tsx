"use client";
import { useState } from 'react';
import { useStore } from '@/state/store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue, SelectSeparator } from '@/components/ui/select';

export default function MultiOfferBar() {
  const { offers, activeIndex, setActiveIndex, addOffer, duplicateActiveOffer, removeOffer, resetAll } = useStore();
  const [presetKey, setPresetKey] = useState<string | undefined>(undefined);
  const [levelsUrl, setLevelsUrl] = useState('');

  function exportJSON() {
    const offer = offers[activeIndex];
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
        addOffer(obj);
      } catch {
        alert('Invalid JSON');
      }
    };
    reader.readAsText(file);
    // reset input so same file can be selected again
    event.currentTarget.value = '';
  }
  async function importPreset(path: string) {
    try {
      const resp = await fetch(path);
      const json = await resp.json();
      addOffer(json);
    } catch { alert('Failed to import preset'); }
  }
  async function importAllPresets() {
    try {
      const [g, f, s] = await Promise.all([
  fetch('presets/google.json').then(r => r.json()),
  fetch('presets/ford.json').then(r => r.json()),
  fetch('presets/startup.json').then(r => r.json()),
      ]);
      addOffer(g); addOffer(f); addOffer(s);
      // Optionally, add a blank too
      // addOffer();
    } catch { alert('Failed to import presets'); }
  }
  async function importFromLevels() {
    if (!levelsUrl) return;
    try {
      const resp = await fetch('/api/import/levels', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ url: levelsUrl }) });
      const data = await resp.json();
      if (data?.offer) addOffer(data.offer);
      else alert('Could not import this URL');
    } catch { alert('Import failed'); }
  }
  return (
    <div className="flex flex-wrap items-center gap-2 mb-4">
      {offers.map((o, i) => (
        <button key={i}
          className={`px-3 py-1 rounded border ${i === activeIndex ? 'bg-black text-white border-black' : 'bg-white'}`}
          onClick={() => setActiveIndex(i)}>
          {o.name || `Offer ${i + 1}`}
        </button>
      ))}
      <div className="ml-auto flex gap-2 items-center flex-wrap">
        <Button type="button" size="sm" onClick={() => addOffer()}>New Offer</Button>
        <Button type="button" size="sm" variant="secondary" onClick={duplicateActiveOffer}>Duplicate</Button>
        <Button type="button" size="sm" variant="destructive" onClick={() => removeOffer(activeIndex)} disabled={offers.length <= 1}>Remove</Button>
        <div className="h-5 w-px bg-gray-300 mx-1" />
        <Button type="button" size="sm" variant="outline" onClick={exportJSON}>Export</Button>
  <Button type="button" size="sm" variant="destructive" onClick={() => { resetAll(); location.reload(); }}>Reset all</Button>
        <label className="inline-flex items-center gap-1">
          <span className="text-xs text-muted-foreground">Import JSON</span>
          <input type="file" accept="application/json" className="hidden" onChange={importJSON} />
          <span className="px-2 py-1 border rounded cursor-pointer">Choose</span>
        </label>
        <Select value={presetKey} onValueChange={async (v) => {
          setPresetKey(v);
          if (v === 'all') await importAllPresets();
          else if (v) await importPreset(`presets/${v}.json`);
          setPresetKey(undefined);
        }}>
          <SelectTrigger size="sm">
            <SelectValue placeholder="Import preset" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="google">Google</SelectItem>
            <SelectItem value="ford">Ford</SelectItem>
            <SelectItem value="startup">Startup</SelectItem>
            <SelectSeparator />
            <SelectItem value="all">Import all</SelectItem>
          </SelectContent>
        </Select>
        <div className="flex items-center gap-1">
          <Input placeholder="levels.fyi URL" value={levelsUrl} onChange={(e) => setLevelsUrl(e.target.value)} className="w-56" />
          <Button type="button" size="sm" onClick={importFromLevels}>Import</Button>
        </div>
      </div>
    </div>
  );
}
