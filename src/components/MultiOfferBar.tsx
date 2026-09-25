"use client";

import { useEffect, useRef, useState } from 'react';
import { Plus, Copy, Trash2, Download, Share2, RotateCcw, Upload, Globe, FileText, ClipboardPaste, ChevronDown } from 'lucide-react';
import { useStore } from '@/state/store';
import { splitOfferBarIndices } from '@/lib/compare';
import { useIsMobile } from '@/lib/useIsMobile';
import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/modal';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectSeparator, SelectTrigger, SelectValue } from '@/components/ui/select';
import { parseLevelsOfferFromHtml } from '@/lib/levelsImport';
import { Offer } from '@/models/types';
import { buildOfferFromFields, parseOfferLetter } from '@/lib/offerLetterImport';
import type { ExtractedOfferFields, OfferLetterParseResult } from '@/lib/offerLetterImport';
import type { TOffer } from '@/models/types';
import ShareDialog from '@/components/ShareDialog';
import { cn, disambiguateNames } from '@/lib/utils';
import OfferModal from '@/components/OfferModal';

const fileInputWrapper = "relative inline-flex";
const hiddenInput = "absolute inset-0 z-10 h-full w-full cursor-pointer opacity-0";

/**
 * Derive the equity-kind select value from the merged parse fields.
 * Exported for regression tests.
 */
export function deriveEquityKind(merged: ExtractedOfferFields | null): 'none' | 'rsu' | 'option' {
  if (!merged) return 'none';
  if (merged.optionShares !== null) return 'option';
  if (merged.rsuShares !== null || merged.rsuValue !== null) return 'rsu';
  return 'none';
}

/**
 * Edits patch for an equity-kind select change. Selecting rsu/option from
 * 'none' seeds the chosen kind with a non-null value (preserving any parsed
 * value) so the select can actually leave 'none' and its inputs render;
 * the unselected kind's fields are cleared.
 * Exported for regression tests.
 */
export function equityKindEdits(
  merged: ExtractedOfferFields | null,
  kind: string
): Partial<ExtractedOfferFields> {
  if (kind === 'none') {
    return { rsuShares: null, rsuValue: null, optionShares: null, strikePrice: null };
  }
  if (kind === 'rsu') {
    return {
      optionShares: null,
      strikePrice: null,
      rsuShares: merged?.rsuShares ?? (merged?.rsuValue != null ? null : 0),
    };
  }
  return {
    rsuShares: null,
    rsuValue: null,
    optionShares: merged?.optionShares ?? 0,
  };
}

/**
 * ImportMenu — single dropdown consolidating every import path (JSON file,
 * levels.fyi URL, Levels HTML upload, offer-letter paste, sample presets).
 * Closes on outside click or Escape.
 */
function ImportMenu({
  levelsUrl,
  setLevelsUrl,
  onImportLevels,
  onImportJsonFile,
  onImportHtmlFile,
  presetKey,
  onPresetSelect,
  onPasteOfferLetter,
}: {
  levelsUrl: string;
  setLevelsUrl: (v: string) => void;
  onImportLevels: () => void;
  onImportJsonFile: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onImportHtmlFile: (e: React.ChangeEvent<HTMLInputElement>) => void;
  presetKey: string | undefined;
  onPresetSelect: (value: string) => void;
  onPasteOfferLetter: () => void;
}) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  // On mobile the menu is fixed-positioned to the viewport (the toolbar
  // trigger sits too far left for a right-anchored dropdown), so capture
  // the trigger's viewport position when opening.
  const [menuTop, setMenuTop] = useState<number | null>(null);
  // True when the menu should anchor to the viewport (mobile) rather than
  // the trigger (desktop sm+).
  const [viewportAnchored, setViewportAnchored] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (!menuRef.current || menuRef.current.contains(e.target as Node)) return;
      // The nested preset Select renders its options in a body-level radix
      // portal, outside the menu element. Treat pointerdowns there as inside
      // the menu — otherwise picking a preset closes the menu on pointerdown
      // and unmounts the Select before the selection registers.
      const target = e.target as Element | null;
      if (target?.closest?.('[data-radix-popper-content-wrapper]')) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [open ]);

  const close = () => setOpen(false);

  const menuRow =
    'flex min-h-[44px] w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-left text-sm text-foreground transition-colors hover:bg-muted';
  const sectionLabel =
    'px-3 pb-1 pt-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground';

  return (
    <div ref={menuRef} className="relative">
      <Button
        ref={triggerRef}
        type="button"
        size="sm"
        variant="outline"
        className="gap-1.5"
        onClick={() => {
          if (!open) {
            const rect = triggerRef.current?.getBoundingClientRect();
            const mobile = window.matchMedia('(max-width: 639px)').matches;
            setViewportAnchored(mobile);
            setMenuTop(mobile && rect ? Math.round(rect.bottom + 8) : null);
          }
          setOpen((o) => !o);
        }}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label="Import offer"
      >
        <Upload className="size-4" />
        <span className="hidden sm:inline">Import</span>
        <ChevronDown className={cn('size-3.5 transition-transform', open && 'rotate-180')} />
      </Button>
      {open && (
        <div
          role="menu"
          aria-label="Import offer"
          style={viewportAnchored && menuTop != null ? { top: menuTop } : undefined}
          className="fixed inset-x-3 z-50 max-h-[70vh] overflow-y-auto rounded-xl border border-border bg-background p-1.5 shadow-xl sm:absolute sm:inset-x-auto sm:right-0 sm:mt-2 sm:w-80"
        >
          <p className={sectionLabel}>From file</p>
          <label className={cn(fileInputWrapper, 'w-full')}>
            <input type="file" accept="application/json" multiple className={hiddenInput} onChange={(e) => { onImportJsonFile(e); close(); }} />
            <span role="menuitem" className={cn(menuRow, 'pointer-events-none')}>
              <Upload className="size-4 shrink-0 text-muted-foreground" />
              Import JSON
            </span>
          </label>
          <label className={cn(fileInputWrapper, 'w-full')}>
            <input type="file" accept="text/html,.html" className={hiddenInput} onChange={(e) => { onImportHtmlFile(e); close(); }} />
            <span role="menuitem" className={cn(menuRow, 'pointer-events-none')}>
              <FileText className="size-4 shrink-0 text-muted-foreground" />
              Upload Levels HTML
            </span>
          </label>

          <p className={sectionLabel}>From levels.fyi</p>
          <div className="px-1.5 pb-1">
            <div className="flex items-center gap-1.5">
              <Input
                placeholder="levels.fyi URL"
                value={levelsUrl}
                onChange={(e) => setLevelsUrl(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    onImportLevels();
                    close();
                  }
                }}
                className="h-8 text-xs"
                aria-label="levels.fyi URL"
              />
              <Button
                type="button"
                size="sm"
                variant="secondary"
                className="shrink-0 gap-1.5"
                disabled={!levelsUrl.trim()}
                onClick={() => {
                  onImportLevels();
                  close();
                }}
              >
                <Globe className="size-4" />
                Go
              </Button>
            </div>
          </div>

          <p className={sectionLabel}>From offer letter</p>
          <button
            type="button"
            role="menuitem"
            className={menuRow}
            onClick={() => {
              onPasteOfferLetter();
              close();
            }}
          >
            <ClipboardPaste className="size-4 shrink-0 text-muted-foreground" />
            Paste offer letter
          </button>

          <p className={sectionLabel}>Sample presets</p>
          <div className="px-1.5 pb-1.5">
            <Select value={presetKey} onValueChange={(v) => { onPresetSelect(v); close(); }}>
              <SelectTrigger size="sm" className="w-full">
                <SelectValue placeholder="Import preset" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="google">Google</SelectItem>
                <SelectItem value="ford">Ford</SelectItem>
                <SelectItem value="startup">Startup</SelectItem>
                <SelectSeparator />
                <SelectItem value="meta">Meta</SelectItem>
                <SelectItem value="apple">Apple</SelectItem>
                <SelectItem value="microsoft">Microsoft</SelectItem>
                <SelectItem value="bloomberg">Bloomberg</SelectItem>
                <SelectItem value="stripe">Stripe</SelectItem>
                <SelectItem value="spacex">SpaceX</SelectItem>
                <SelectItem value="tesla">Tesla</SelectItem>
                <SelectItem value="anduril">Anduril</SelectItem>
                <SelectItem value="palantir">Palantir</SelectItem>
                <SelectSeparator />
                <SelectItem value="all">Import all</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      )}
    </div>
  );
}

export default function MultiOfferBar() {
  const { offers, activeIndex, setActiveIndex, addOffer, duplicateActiveOffer, removeOffer, resetAll, uiMode } = useStore();
  const isMobile = useIsMobile();
  // Pills for the first few offers; the rest tuck behind a "+N more" menu.
  // The active offer is always kept visible. No horizontal scroll trap.
  const { visible: visibleOfferIndices, overflow: overflowOfferIndices } = splitOfferBarIndices(
    offers.length,
    activeIndex,
    isMobile ? 3 : 5,
  );
  const [presetKey, setPresetKey] = useState<string | undefined>();
  const [levelsUrl, setLevelsUrl] = useState('');
  const [shareOpen, setShareOpen] = useState(false);
  const [offerLetterOpen, setOfferLetterOpen] = useState(false);
  const [offerModalOpen, setOfferModalOpen] = useState(false);
  const [editOfferIndex, setEditOfferIndex] = useState<number | null>(null);

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
        files.map((f) => fetch(`/presets/${f}.json`).then((r) => r.json()))
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

  async function handlePresetSelect(value: string) {
    setPresetKey(value);
    if (value === 'all') await importAllPresets();
    else if (value) await importPreset(`/presets/${value}.json`);
    setPresetKey(undefined);
  }

  const displayNames = disambiguateNames(offers, (o) => o.name, (o) => o.location);

  return (
    <div className="rounded-2xl border border-border/60 bg-background/95 px-3 py-2.5 shadow-sm sm:px-4 sm:py-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            {visibleOfferIndices.map((index) => {
              return (
                <Button
                  key={index}
                  type="button"
                  variant="chip"
                  size="pill"
                  data-active={index === activeIndex}
                  className={cn('min-w-0 font-medium', 'max-w-[180px] truncate')}
                  onClick={() => setActiveIndex(index)}
                  onDoubleClick={() => { setEditOfferIndex(index); setOfferModalOpen(true); }}
                  title="Double-click to rename"
                >
                  {displayNames[index]}
                </Button>
              );
            })}
            {overflowOfferIndices.length > 0 && (
              // Controlled with a constant empty value so the trigger always
              // reads "+N more" (it acts as a menu, not a value display).
              <Select value="" onValueChange={(v) => setActiveIndex(Number(v))}>
                <SelectTrigger
                  aria-label={`${overflowOfferIndices.length} more offers`}
                  className="h-8 w-auto gap-1 rounded-full border-dashed px-3 text-xs font-medium text-muted-foreground hover:text-foreground"
                >
                  <SelectValue placeholder={`+${overflowOfferIndices.length} more`} />
                </SelectTrigger>
                <SelectContent>
                  {overflowOfferIndices.map((index) => {
                    return (
                      <SelectItem key={index} value={String(index)}>
                        <span className="max-w-[220px] truncate">{displayNames[index]}</span>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <Button type="button" size="sm" variant="secondary" className="gap-1.5" onClick={() => { setEditOfferIndex(null); setOfferModalOpen(true); }}>
            <Plus className="size-4" />
            New
          </Button>
          <ImportMenu
            levelsUrl={levelsUrl}
            setLevelsUrl={setLevelsUrl}
            onImportLevels={importFromLevels}
            onImportJsonFile={importJSON}
            onImportHtmlFile={importLevelsHtmlFile}
            presetKey={presetKey}
            onPresetSelect={handlePresetSelect}
            onPasteOfferLetter={() => setOfferLetterOpen(true)}
          />
          <Button type="button" size="sm" variant="secondary" className="gap-1.5" onClick={() => setShareOpen(true)}>
            <Share2 className="size-4" />
            <span className="hidden sm:inline">Share link</span>
          </Button>
          <span className="mx-1 h-5 w-px bg-border/70" aria-hidden="true" />
          <Button type="button" size="sm" variant="ghost" className="gap-1.5" onClick={duplicateActiveOffer} title="Duplicate active offer">
            <Copy className="size-4" />
            <span className="hidden sm:inline">Duplicate</span>
          </Button>
          <Button type="button" size="sm" variant="ghost" className="gap-1.5" onClick={exportJSON} title="Export active offer as JSON">
            <Download className="size-4" />
            <span className="hidden sm:inline">Export</span>
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="gap-1.5 text-destructive hover:text-destructive"
            onClick={() => removeOffer(activeIndex)}
            disabled={offers.length <= 1}
            aria-label="Delete active offer"
            title="Delete active offer"
          >
            <Trash2 className="size-4" />
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="gap-1.5 text-destructive hover:text-destructive"
            onClick={() => { resetAll(); location.reload(); }}
            aria-label="Reset all offers"
            title="Reset all offers"
          >
            <RotateCcw className="size-4" />
          </Button>
        </div>
      </div>
      <OfferModal
        open={offerModalOpen}
        onClose={() => setOfferModalOpen(false)}
        editIndex={editOfferIndex}
      />
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

  if (!open) return null;

  const merged: ExtractedOfferFields | null = result ? { ...result.extracted, ...edits } : null;
  const equityKind = deriveEquityKind(merged);

  function setField<K extends keyof ExtractedOfferFields>(key: K, value: ExtractedOfferFields[K]) {
    setEdits((prev) => ({ ...prev, [key]: value }));
  }

  function handleParse() {
    setResult(parseOfferLetter(text));
    setEdits({});
    setStep('review');
  }

  function handleEquityKindChange(kind: string) {
    setEdits((prev) => ({ ...prev, ...equityKindEdits(merged, kind) }));
  }

  function handleAdd() {
    if (!merged) return;
    onAdd(buildOfferFromFields(merged));
    onClose();
  }

  const isPasteStep = step === 'paste';
  return (
    <Modal
      title={isPasteStep ? 'Paste offer letter' : 'Review extracted details'}
      description={
        isPasteStep
          ? 'Paste the text of your offer letter. We\u2019ll pull out the numbers \u2014 you review them before anything is added.'
          : 'Heuristic parse \u2014 double-check the numbers before adding. Nothing has been saved yet.'
      }
      onClose={onClose}
      maxWidth="max-w-xl"
      hideCloseButton
    >
      {step === 'paste' ? (
          <div className="space-y-3">
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
    </Modal>
  );
}
