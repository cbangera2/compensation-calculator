"use client";

import { useEffect, useState } from 'react';
import { Plus, Copy, Trash2, Download, Share2, RotateCcw, Upload, Globe, FileText, ClipboardPaste } from 'lucide-react';
import { useStore } from '@/state/store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectSeparator, SelectTrigger, SelectValue } from '@/components/ui/select';
import { parseLevelsOfferFromHtml } from '@/lib/levelsImport';
import { Offer } from '@/models/types';
import { buildOfferFromFields, parseOfferLetter } from '@/lib/offerLetterImport';
import type { ExtractedOfferFields, OfferLetterParseResult } from '@/lib/offerLetterImport';
import type { TOffer } from '@/models/types';
import ShareDialog from '@/components/ShareDialog';
import MobileCollapse from '@/components/MobileCollapse';
import { cn } from '@/lib/utils';

const scrollGradient = "pointer-events-none absolute inset-y-0 w-6 bg-gradient-to-r from-background/95 to-transparent";
const fileInputWrapper = "relative inline-flex";
const hiddenInput = "absolute inset-0 z-10 h-full w-full cursor-pointer opacity-0";

export default function MultiOfferBar() {
  const { offers, activeIndex, setActiveIndex, addOffer, duplicateActiveOffer, removeOffer, resetAll, uiMode } = useStore();
  const [presetKey, setPresetKey] = useState<string | undefined>();
  const [levelsUrl, setLevelsUrl] = useState('');
  const [shareOpen, setShareOpen] = useState(false);
  const [offerLetterOpen, setOfferLetterOpen] = useState(false);

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
          const parsed = Offer.safeParse(obj);
          if (!parsed.success) {
            alert(`Import rejected: ${file.name} is not a valid offer (missing or invalid fields).`);
          } else {
            addOffer(parsed.data);
          }
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
      const files = [
        'google',
        'ford',
        'startup',
        'meta',
        'apple',
        'microsoft',
        'bloomberg',
        'stripe',
        'spacex',
        'tesla',
        'anduril',
        'palantir',
      ];
      const offers = await Promise.all(
        files.map((f) => fetch(`presets/${f}.json`).then((r) => r.json()))
      );
      offers.forEach(addOffer);
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

  return (
    <div className="space-y-2 rounded-2xl border border-border/60 bg-background/95 px-3 py-2.5 shadow-sm sm:space-y-3 sm:px-4 sm:py-3">
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="relative min-w-0 flex-1">
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

          <div className="flex flex-wrap items-center gap-1.5">
            <Button type="button" size="sm" variant="secondary" className="gap-1.5" onClick={() => addOffer()}>
              <Plus className="size-4" />
              New
            </Button>
            <Button type="button" size="sm" variant="ghost" className="gap-1.5" onClick={duplicateActiveOffer}>
              <Copy className="size-4" />
              Duplicate
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="gap-1.5 text-destructive hover:text-destructive"
              onClick={() => removeOffer(activeIndex)}
              disabled={offers.length <= 1}
            >
              <Trash2 className="size-4" />
            </Button>
            <span className="mx-1 h-5 w-px bg-border/70" />
            <Button type="button" size="sm" variant="ghost" className="gap-1.5" onClick={exportJSON}>
              <Download className="size-4" />
              <span className="hidden sm:inline">Export</span>
            </Button>
            <Button type="button" size="sm" variant="ghost" className="gap-1.5" onClick={() => setShareOpen(true)}>
              <Share2 className="size-4" />
              <span className="hidden sm:inline">Share link</span>
            </Button>
            <Button type="button" size="sm" variant="ghost" className="gap-1.5 text-destructive hover:text-destructive" onClick={() => { resetAll(); location.reload(); }}>
              <RotateCcw className="size-4" />
            </Button>
          </div>
        </div>
      </div>

      <MobileCollapse
        variant="plain"
        title="Import & presets"
        description="JSON, levels.fyi, offer letters, sample offers"
        contentClassName="flex flex-col gap-2"
        desktopClassName="flex flex-col gap-2 border-t border-border/50 pt-3 lg:flex-row lg:items-center lg:justify-between"
      >
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
            <SelectTrigger size="sm" className="w-[150px]">
              <SelectValue placeholder="Import preset" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="google">Google</SelectItem>
              <SelectItem value="ford">Ford</SelectItem>
              <SelectItem value="startup">Startup</SelectItem>
              <SelectSeparator />
              <SelectItem value="meta">Meta (illustrative)</SelectItem>
              <SelectItem value="apple">Apple (illustrative)</SelectItem>
              <SelectItem value="microsoft">Microsoft (illustrative)</SelectItem>
              <SelectItem value="bloomberg">Bloomberg (illustrative)</SelectItem>
              <SelectItem value="stripe">Stripe (illustrative)</SelectItem>
              <SelectItem value="spacex">SpaceX (illustrative)</SelectItem>
              <SelectItem value="tesla">Tesla (illustrative)</SelectItem>
              <SelectItem value="anduril">Anduril (illustrative)</SelectItem>
              <SelectItem value="palantir">Palantir (illustrative)</SelectItem>
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
              className="h-8 w-44 text-xs sm:w-56"
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
          <Button type="button" variant="outline" size="sm" className="gap-2" onClick={() => setOfferLetterOpen(true)}>
            <ClipboardPaste className="size-4" />
            Paste offer letter
          </Button>
        </div>
      </MobileCollapse>
      <ShareDialog
        open={shareOpen}
        onClose={() => setShareOpen(false)}
        offers={offers}
        activeIndex={activeIndex}
        uiMode={uiMode}
      />
      <OfferLetterDialog
        open={offerLetterOpen}
        onClose={() => setOfferLetterOpen(false)}
        onAdd={(offer) => addOffer(offer)}
      />
    </div>
  );
}

function NumField({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: number | null;
  onChange: (v: number | null) => void;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="text-xs text-muted-foreground">{label}</span>
      <Input
        type="number"
        className="mt-1 h-8 text-sm"
        value={value ?? ''}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value === '' ? null : Number(e.target.value))}
      />
    </label>
  );
}

function TextField({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string | null;
  onChange: (v: string | null) => void;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="text-xs text-muted-foreground">{label}</span>
      <Input
        type="text"
        className="mt-1 h-8 text-sm"
        value={value ?? ''}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value.trim() === '' ? null : e.target.value)}
      />
    </label>
  );
}

/**
 * Paste-offer-letter import dialog. Step 1: paste raw text. Step 2: review the
 * heuristically extracted fields (editable) with an explicit list of what the
 * parser could not detect. Nothing is added until the user confirms.
 */
function OfferLetterDialog({
  open,
  onClose,
  onAdd,
}: {
  open: boolean;
  onClose: () => void;
  onAdd: (offer: TOffer) => void;
}) {
  const [text, setText] = useState('');
  const [step, setStep] = useState<'paste' | 'review'>('paste');
  const [result, setResult] = useState<OfferLetterParseResult | null>(null);
  const [edits, setEdits] = useState<Partial<ExtractedOfferFields>>({});

  // Reset each time the dialog opens.
  useEffect(() => {
    if (open) {
      setText('');
      setStep('paste');
      setResult(null);
      setEdits({});
    }
  }, [open ]);

  // Escape to close + lock body scroll while open.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onClose]);

  if (!open) return null;

  const merged: ExtractedOfferFields | null = result ? { ...result.extracted, ...edits } : null;
  const equityKind = !merged
    ? 'none'
    : merged.optionShares !== null
      ? 'option'
      : merged.rsuShares !== null || merged.rsuValue !== null
        ? 'rsu'
        : 'none';

  function setField<K extends keyof ExtractedOfferFields>(key: K, value: ExtractedOfferFields[K]) {
    setEdits((prev) => ({ ...prev, [key]: value }));
  }

  function handleParse() {
    setResult(parseOfferLetter(text));
    setEdits({});
    setStep('review');
  }

  function handleEquityKindChange(kind: string) {
    if (kind === 'none') {
      setEdits((prev) => ({ ...prev, rsuShares: null, rsuValue: null, optionShares: null, strikePrice: null }));
    } else if (kind === 'rsu') {
      setEdits((prev) => ({ ...prev, optionShares: null, strikePrice: null }));
    } else {
      setEdits((prev) => ({ ...prev, rsuShares: null, rsuValue: null }));
    }
  }

  function handleAdd() {
    if (!merged) return;
    onAdd(buildOfferFromFields(merged));
    onClose();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Paste offer letter"
      onClick={onClose}
    >
      <div
        className="max-h-[92dvh] w-full max-w-xl overflow-y-auto rounded-2xl border border-border bg-background p-4 shadow-xl sm:p-6"
        onClick={(e) => e.stopPropagation()}
      >
        {step === 'paste' ? (
          <div className="space-y-3">
            <div>
              <h2 className="text-base font-semibold">Paste offer letter</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Paste the text of your offer letter. We&apos;ll pull out the numbers — you review them before anything is added.
              </p>
            </div>
            <textarea
              className="min-h-44 w-full rounded-xl border border-border bg-background p-3 text-sm outline-none placeholder:text-muted-foreground/60 focus:border-primary"
              placeholder={'Dear Alex,\n\nWe are pleased to offer you the position of Software Engineer at ExampleCo.\nYour starting base salary will be $150,000 per year...\n\n(paste the full letter text here)'}
              value={text}
              onChange={(e) => setText(e.target.value)}
            />
            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" size="sm" onClick={onClose}>
                Cancel
              </Button>
              <Button type="button" size="sm" disabled={!text.trim()} onClick={handleParse}>
                Parse letter
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <h2 className="text-base font-semibold">Review extracted details</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Heuristic parse — double-check the numbers before adding. Nothing has been saved yet.
              </p>
            </div>

            {merged && result!.unparsed.length > 0 && (
              <div className="rounded-xl bg-amber-500/10 p-2.5 text-xs text-amber-700 dark:text-amber-300">
                Couldn&apos;t detect: {result!.unparsed.join(', ')}. You can fill these in here or after adding.
              </div>
            )}

            {merged && (
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                <TextField label="Company" value={merged.company} onChange={(v) => setField('company', v)} placeholder="Company" />
                <TextField label="Start date" value={merged.startDate} onChange={(v) => setField('startDate', v)} placeholder="YYYY-MM-DD" />
                <TextField label="Location" value={merged.location} onChange={(v) => setField('location', v)} placeholder="City, ST" />
                <NumField label="Base salary ($)" value={merged.base} onChange={(v) => setField('base', v)} />
                <NumField label="Signing bonus ($)" value={merged.signingBonus} onChange={(v) => setField('signingBonus', v)} />
                <NumField label="Relocation ($)" value={merged.relocationBonus} onChange={(v) => setField('relocationBonus', v)} />
                <NumField
                  label="Bonus target (%)"
                  value={merged.targetBonusPercent !== null ? Math.round(merged.targetBonusPercent * 1000) / 10 : null}
                  onChange={(v) => setField('targetBonusPercent', v === null ? null : v / 100)}
                />
                <NumField label="Vest (years)" value={merged.vestYears} onChange={(v) => setField('vestYears', v)} />
                <NumField label="Cliff (months)" value={merged.cliffMonths} onChange={(v) => setField('cliffMonths', v)} />
              </div>
            )}

            {merged && (
              <div className="space-y-2 rounded-xl border border-border/60 p-3">
                <label className="block">
                  <span className="text-xs text-muted-foreground">Equity type</span>
                  <select
                    className="mt-1 h-8 w-full rounded-md border border-border bg-background px-2 text-sm outline-none focus:border-primary"
                    value={equityKind}
                    onChange={(e) => handleEquityKindChange(e.target.value)}
                  >
                    <option value="none">No equity</option>
                    <option value="rsu">RSUs</option>
                    <option value="option">Stock options</option>
                  </select>
                </label>
                {equityKind === 'rsu' && (
                  <div className="grid grid-cols-2 gap-2">
                    <NumField label="RSU shares" value={merged.rsuShares} onChange={(v) => setField('rsuShares', v)} />
                    <NumField label="Grant value ($)" value={merged.rsuValue} onChange={(v) => setField('rsuValue', v)} placeholder="if stated in $" />
                  </div>
                )}
                {equityKind === 'option' && (
                  <div className="grid grid-cols-2 gap-2">
                    <NumField label="Option shares" value={merged.optionShares} onChange={(v) => setField('optionShares', v)} />
                    <NumField label="Strike price ($)" value={merged.strikePrice} onChange={(v) => setField('strikePrice', v)} />
                  </div>
                )}
              </div>
            )}

            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" size="sm" onClick={() => setStep('paste')}>
                Back
              </Button>
              <Button type="button" size="sm" onClick={handleAdd}>
                Add offer
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
