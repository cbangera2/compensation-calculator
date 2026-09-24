'use client';

import { useEffect, useMemo, useState } from 'react';
import { Copy, Check, AlertTriangle, ShieldCheck, Link2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/modal';
import { TOffer } from '@/models/types';
import {
  anonymizeOffer,
  buildAnonymizedToken,
  buildShareToken,
  companyAlias,
} from '@/lib/share';
import { cn } from '@/lib/utils';

type ShareDialogProps = {
  open: boolean;
  onClose: () => void;
  offers: TOffer[];
  activeIndex: number;
  uiMode: 'simple' | 'advanced';
};

const usd0 = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
});

function shortDate(dateStr: string): string {
  if (/^\d{4}-Q[1-4]$/.test(dateStr)) return dateStr;
  return dateStr.slice(0, 10);
}

export default function ShareDialog({ open, onClose, offers, activeIndex, uiMode }: ShareDialogProps) {
  const [selected, setSelected] = useState<number[]>([activeIndex]);
  const [anonymize, setAnonymize] = useState(true);
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'error'>('idle');

  // Reset selection each time the dialog opens.
  useEffect(() => {
    if (open) {
      setSelected([activeIndex]);
      setAnonymize(true);
      setCopyState('idle');
    }
  }, [open, activeIndex]);

  const previewRows = useMemo(
    () =>
      selected
        .filter((i) => i >= 0 && i < offers.length)
        .map((offerIndex, aliasIndex) => {          const offer = offers[offerIndex];
          if (anonymize) {
            const anon = anonymizeOffer(offer, aliasIndex);
            return {
              key: offerIndex,
              title: anon.name,
              meta: `${anon.location ?? 'No location'} · ${usd0.format(anon.base.startAnnual)} base · starts ${shortDate(anon.startDate)}`,
            };
          }
          return {
            key: offerIndex,
            title: offer.name || `Offer ${offerIndex + 1}`,
            meta: `${offer.location ?? 'No location'} · ${usd0.format(offer.base.startAnnual)} base · starts ${shortDate(offer.startDate)}`,
          };
        }),
    [selected, offers, anonymize],
  );

  const aliasPosition = useMemo(() => {
    const map = new Map<number, number>();
    selected
      .filter((i) => i >= 0 && i < offers.length)
      .forEach((offerIndex, position) => map.set(offerIndex, position));
    return map;
  }, [selected, offers.length]);

  if (!open) return null;

  function toggleSelected(index: number) {
    setSelected((prev) =>
      prev.includes(index) ? prev.filter((i) => i !== index) : [...prev, index].sort((a, b) => a - b),
    );
  }

  async function copyLink() {
    if (selected.length === 0) return;
    try {
      const token = anonymize
        ? buildAnonymizedToken(offers, selected, uiMode)
        : buildShareToken({
            offers: selected.map((i) => offers[i]),
            activeIndex: selected.includes(activeIndex) ? selected.indexOf(activeIndex) : 0,
            uiMode,
          });
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

  const shareUrlPreview = previewRows.length
    ? previewRows.map((row) => row.title).join(', ')
    : 'No offers selected';

  return (
    <Modal
      title="Share offers"
      description="Pick which offers go into the link and how much detail they carry."
      onClose={onClose}
    >
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Offers in this link</p>
      <div className="mt-2 max-h-44 space-y-1.5 overflow-y-auto">
            {offers.map((offer, index) => {
              const checked = selected.includes(index);
              return (
                <button
                  key={index}
                  type="button"
                  onClick={() => toggleSelected(index)}
                  aria-pressed={checked}
                  className={cn(
                    'flex w-full items-center gap-3 rounded-xl border px-3 py-2 text-left transition-colors',
                    checked ? 'border-primary/50 bg-primary/5' : 'border-border/60 hover:border-border',
                  )}
                >
                  <span
                    className={cn(
                      'flex size-5 shrink-0 items-center justify-center rounded-md border',
                      checked ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-background',
                    )}
                  >
                    {checked && <Check className="size-3.5" />}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium">
                      {anonymize && checked ? companyAlias(aliasPosition.get(index) ?? 0) : (offer.name || `Offer ${index + 1}`)}
                    </span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {offer.location ?? 'No location'} · {usd0.format(offer.base.startAnnual)} base
                    </span>
                  </span>
                </button>
              );
            })}
          </div>

        <button
          type="button"
          onClick={() => setAnonymize((v) => !v)}
          aria-pressed={anonymize}
          className="mt-4 flex w-full items-center justify-between gap-3 rounded-xl border border-border/60 px-3 py-2.5 text-left"
        >
          <span className="flex items-center gap-2.5">
            <ShieldCheck className={cn('size-4', anonymize ? 'text-emerald-600' : 'text-muted-foreground')} />
            <span>
              <span className="block text-sm font-medium">Anonymize this link</span>
              <span className="block text-xs text-muted-foreground">
                Aliases instead of company names, metro-only locations, comp rounded to $5K, dates by quarter.
              </span>
            </span>
          </span>
          <span
            className={cn(
              'relative h-6 w-11 shrink-0 rounded-full transition-colors',
              anonymize ? 'bg-emerald-500' : 'bg-muted',
            )}
          >
            <span
              className={cn(
                'absolute top-0.5 size-5 rounded-full bg-white shadow transition-all',
                anonymize ? 'left-[22px]' : 'left-0.5',
              )}
            />
          </span>
        </button>

        <div className="mt-3 rounded-xl border border-border/60 bg-muted/40 px-3 py-2 sm:mt-4 sm:py-2.5">
          <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            <Link2 className="size-3.5" />
            What the link contains
          </p>
          <div className="mt-1.5 space-y-1">
            {previewRows.map((row) => (
              <p key={row.key} className="text-sm">
                <span className="font-medium">{row.title}</span>
                <span className="text-muted-foreground"> — {row.meta}</span>
              </p>
            ))}
            {!previewRows.length && <p className="text-sm text-muted-foreground">{shareUrlPreview}</p>}
          </div>
        </div>

        <p className="mt-3 flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs sm:mt-4 sm:py-2.5 sm:text-sm">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600" />
          <span>
            Anyone with this link can read it. It cannot be revoked.
            {!anonymize && ' This link includes exact company names and compensation.'}
          </span>
        </p>

        <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="ghost" onClick={onClose} className="w-full sm:w-auto">
            Cancel
          </Button>
          <Button type="button" onClick={copyLink} disabled={selected.length === 0} className="w-full gap-2 sm:w-auto">
            {copyState === 'copied' ? <Check className="size-4" /> : <Copy className="size-4" />}
            {copyState === 'copied' ? 'Link copied' : copyState === 'error' ? 'Copy failed — try again' : 'Copy link'}
          </Button>
        </div>
    </Modal>
  );
}
