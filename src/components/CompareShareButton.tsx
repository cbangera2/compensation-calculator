'use client';

import { useMemo, useState } from 'react';
import { Share2, Copy, Check, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/modal';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useStore } from '@/state/store';
import { useComparedOffers } from '@/lib/useComparedOffers';
import { buildAnonymizedToken } from '@/lib/share';
import { cn } from '@/lib/utils';

/**
 * "Share this comparison" for the Compare tab. Builds an anonymized
 * multi-offer share token for exactly the offers the compare charts
 * render (the picker-scoped selection), then presents a copyable link.
 * Not mounted anywhere yet — the parent mounts it.
 */
export default function CompareShareButton() {
  const { offers, uiMode } = useStore();
  const [open, setOpen] = useState(false);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copyState, setCopyState] = useState<'idle' | 'copied'>('idle');

  // Same derivation the compare charts use: the picker-scoped offers
  // (viewport-scaled max via useComparedOffers), paired with original store indices.
  const compared = useComparedOffers();
  const comparedIndices = useMemo(
    () => compared.map((p) => p.index),
    [compared],
  );
  const canShare = comparedIndices.length >= 2;

  function buildLink() {
    setError(null);
    setCopyState('idle');
    try {
      const token = buildAnonymizedToken(offers, comparedIndices, uiMode);
      const url = new URL(window.location.href);
      url.searchParams.set('share', token);
      setShareUrl(url.toString());
    } catch (err) {
      console.error('Failed to build comparison share link', err);
      setShareUrl(null);
      setError('Could not build the share link. Try again — the offers may contain data the share format rejects.');
    }
  }

  async function copyLink() {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopyState('copied');
    } catch {
      window.prompt('Copy this link', shareUrl);
    }
  }

  const trigger = (
    <Button
      type="button"
      variant="outline"
      size="sm"
      disabled={!canShare}
      onClick={() => {
        setOpen(true);
        buildLink();
      }}
      className={cn('gap-2', !canShare && 'cursor-not-allowed opacity-50')}
      aria-disabled={!canShare}
    >
      <Share2 className="size-4" />
      Share this comparison
    </Button>
  );

  return (
    <TooltipProvider>
      {canShare ? (
        trigger
      ) : (
        <Tooltip>
          <TooltipTrigger asChild>{trigger}</TooltipTrigger>
          <TooltipContent>
            <p className="max-w-48">Add at least two offers to compare and share the comparison.</p>
          </TooltipContent>
        </Tooltip>
      )}

      {open && (
        <Modal
          title="Share this comparison"
          description={`An anonymized link with the ${comparedIndices.length} offers in this comparison.`}
          onClose={() => setOpen(false)}
        >

            <p className="mt-4 flex items-start gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs sm:text-sm">
              <ShieldCheck className="mt-0.5 size-4 shrink-0 text-emerald-600" />
              <span>
                Company names are aliased, locations are metro-only, and equity is rounded — no personal details
                leave your device.
              </span>
            </p>

            {error ? (
              <p className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-600">
                {error}
              </p>
            ) : (
              shareUrl && (
                <div className="mt-4 flex items-stretch gap-2">
                  <input
                    readOnly
                    value={shareUrl}
                    onFocus={(e) => e.target.select()}
                    className="min-w-0 flex-1 rounded-xl border border-border/60 bg-muted/40 px-3 py-2 text-xs tabular-nums text-muted-foreground"
                    aria-label="Share link"
                  />
                  <Button type="button" onClick={copyLink} className="shrink-0 gap-2">
                    {copyState === 'copied' ? <Check className="size-4" /> : <Copy className="size-4" />}
                    {copyState === 'copied' ? 'Copied' : 'Copy'}
                  </Button>
                </div>
              )
            )}

            <p className="mt-3 text-xs text-muted-foreground">
              Anyone with this link can read it. It cannot be revoked.
            </p>

            <div className="mt-4 flex justify-end">
              <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
                Done
              </Button>
            </div>
        </Modal>
      )}
    </TooltipProvider>
  );
}
