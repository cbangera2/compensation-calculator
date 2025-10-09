"use client";

import { useEffect, useMemo, useState } from 'react';
import { Plus, Copy, Trash2, Download, Share2, RotateCcw, Upload, Globe, FileText, Check, AlertCircle } from 'lucide-react';
import { useStore } from '@/state/store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectSeparator, SelectTrigger, SelectValue } from '@/components/ui/select';
import { parseLevelsOfferFromHtml } from '@/lib/levelsImport';
import { buildShareToken } from '@/lib/share';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';

const scrollGradient = "pointer-events-none absolute inset-y-0 w-6 bg-gradient-to-r from-background/95 to-transparent";
const fileInputWrapper = "relative inline-flex";
const hiddenInput = "absolute inset-0 z-10 h-full w-full cursor-pointer opacity-0";

export default function MultiOfferBar() {
  const { offers, activeIndex, setActiveIndex, addOffer, duplicateActiveOffer, removeOffer, resetAll, uiMode } = useStore();
  const [presetKey, setPresetKey] = useState<string | undefined>();
  const [levelsUrl, setLevelsUrl] = useState('');
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'error'>('idle');

  useEffect(() => {
    if (copyState === 'idle') return;
    const timer = window.setTimeout(() => setCopyState('idle'), 2500);
    return () => window.clearTimeout(timer);
  }, [copyState]);

  const shareIcon = useMemo(() => {
    if (copyState === 'copied') return <Check className="size-4" />;
    if (copyState === 'error') return <AlertCircle className="size-4" />;
    return <Share2 className="size-4" />;
  }, [copyState]);

  const shareLabel = copyState === 'copied' ? 'Link copied' : copyState === 'error' ? 'Copy failed' : 'Share link';

  function exportJSON() {
    const offer = offers[activeIndex];
    const blob = new Blob([JSON.stringify(offer, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${offer.name || 'offer'}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  function importJSON(event: React.ChangeEvent<HTMLInputElement>) {
    const files = event.target.files;
    if (!files?.length) return;

    const input = event.currentTarget;
    const readers = Array.from(files).map((file) => new Promise<void>((resolve) => {
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const obj = JSON.parse(String(reader.result));
          addOffer(obj);
        } catch {
          alert(`Invalid JSON in ${file.name}`);
        }
        resolve();
      };
      reader.onerror = () => {
        alert(`Failed to read ${file.name}`);
        resolve();
      };
      reader.readAsText(file);
    }));

    void Promise.all(readers).finally(() => {
      input.value = '';
    });
  }

  async function importPreset(path: string) {
    try {
      const resp = await fetch(path);
      const json = await resp.json();
      addOffer(json);
    } catch {
      alert('Failed to import preset');
    }
  }

  async function importAllPresets() {
    try {
      const [g, f, s] = await Promise.all([
        fetch('presets/google.json').then((r) => r.json()),
        fetch('presets/ford.json').then((r) => r.json()),
        fetch('presets/startup.json').then((r) => r.json()),
      ]);
      addOffer(g);
      addOffer(f);
      addOffer(s);
    } catch {
      alert('Failed to import presets');
    }
  }

  async function importFromLevels() {
    if (!levelsUrl) return;
    try {
      const resp = await fetch('/api/import/levels', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ url: levelsUrl }),
      });
      if (resp.ok) {
        const data = await resp.json();
        if (data?.offer) {
          addOffer(data.offer);
          return;
        }
      }
      try {
        const proxied = await fetch(`https://api.allorigins.win/raw?url=${encodeURIComponent(levelsUrl)}`);
        if (proxied.ok) {
          const html = await proxied.text();
          const offer = parseLevelsOfferFromHtml(html);
          addOffer(offer);
          return;
        }
      } catch {
        /* ignore proxy failure */
      }
      alert('On GitHub Pages, server import is unavailable. Please use "Upload Levels HTML" (save the page as HTML and upload).');
    } catch {
      alert('Import failed');
    }
  }

  function importLevelsHtmlFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const html = String(reader.result);
        const offer = parseLevelsOfferFromHtml(html);
        addOffer(offer);
      } catch {
        alert('Could not parse this HTML file');
      }
    };
    reader.readAsText(file);
    event.currentTarget.value = '';
  }

  async function copyShareUrl() {
    try {
      const token = buildShareToken({ offers, activeIndex, uiMode });
      const url = new URL(window.location.href);
      url.searchParams.set('share', token);
      const shareUrl = url.toString();
      try {
        await navigator.clipboard.writeText(shareUrl);
        setCopyState('copied');
      } catch {
        setCopyState('error');
        window.prompt('Copy this link', shareUrl);
      }
    } catch (err) {
      console.error('Failed to build share URL', err);
      setCopyState('error');
    }
  }

  return (
    <div className="mb-4 space-y-4 rounded-xl border bg-background/95 px-4 py-3 shadow-sm">
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Offers</span>
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" size="sm" variant="outline" className="gap-2" onClick={exportJSON}>
              <Download className="size-4" />
              Export JSON
            </Button>
            <Button type="button" size="sm" variant="outline" className="gap-2" onClick={copyShareUrl}>
              {shareIcon}
              <span>{shareLabel}</span>
            </Button>
            <Button type="button" size="sm" variant="destructive" className="gap-2" onClick={() => { resetAll(); location.reload(); }}>
              <RotateCcw className="size-4" />
              Reset all
            </Button>
          </div>
        </div>

        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="relative flex-1">
            <div className="flex snap-x snap-mandatory gap-2 overflow-x-auto pb-1 pr-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {offers.map((offer, index) => (
                <Button
                  key={index}
                  type="button"
                  variant="chip"
                  size="pill"
                  data-active={index === activeIndex}
                  className={cn('snap-start font-medium', 'max-w-[180px] truncate')}
                  onClick={() => setActiveIndex(index)}
                >
                  {offer.name || `Offer ${index + 1}`}
                </Button>
              ))}
            </div>
            <div className={cn(scrollGradient, 'left-0')} />
            <div className={cn(scrollGradient, 'right-0 rotate-180')} />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" size="sm" variant="secondary" className="gap-2" onClick={() => addOffer()}>
              <Plus className="size-4" />
              New offer
            </Button>
            <Button type="button" size="sm" variant="outline" className="gap-2" onClick={duplicateActiveOffer}>
              <Copy className="size-4" />
              Duplicate
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost-destructive"
              className="gap-2"
              onClick={() => removeOffer(activeIndex)}
              disabled={offers.length <= 1}
            >
              <Trash2 className="size-4" />
              Remove
            </Button>
          </div>
        </div>
      </div>

      <Separator />

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <label className={fileInputWrapper}>
            <input type="file" accept="application/json" multiple className={hiddenInput} onChange={importJSON} />
            <Button type="button" variant="outline" size="sm" className="pointer-events-none gap-2">
              <Upload className="size-4" />
              Import JSON
            </Button>
          </label>
          <Select
            value={presetKey}
            onValueChange={async (value) => {
              setPresetKey(value);
              if (value === 'all') await importAllPresets();
              else if (value) await importPreset(`presets/${value}.json`);
              setPresetKey(undefined);
            }}
          >
            <SelectTrigger size="sm" className="w-[170px]">
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
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-2">
            <Input
              placeholder="levels.fyi URL"
              value={levelsUrl}
              onChange={(e) => setLevelsUrl(e.target.value)}
              className="w-52 sm:w-64"
            />
            <Button type="button" size="sm" variant="secondary" className="gap-2" onClick={importFromLevels}>
              <Globe className="size-4" />
              Import URL
            </Button>
          </div>
          <label className={fileInputWrapper}>
            <input type="file" accept="text/html,.html" className={hiddenInput} onChange={importLevelsHtmlFile} />
            <Button type="button" variant="outline" size="sm" className="pointer-events-none gap-2">
              <FileText className="size-4" />
              Upload HTML
            </Button>
          </label>
        </div>
      </div>
    </div>
  );
}
