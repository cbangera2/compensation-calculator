'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Download, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  anonPayloadToOffers,
  parseShareToken,
  type AnonSharePayload,
  type SharePayload,
} from '@/lib/share';
import { useStore } from '@/state/store';
import { TOffer } from '@/models/types';
import ShareSummaryView from '@/components/ShareSummaryView';

type SharedInbox =
  | { anon: true; payload: AnonSharePayload }
  | { anon: false; payload: SharePayload };

function displayOffers(inbox: SharedInbox): TOffer[] {
  // Anonymized payloads are shown exactly as shared (aliases, rounded
  // numbers, quarter dates). Cloned so the view can never mutate the inbox.
  return JSON.parse(JSON.stringify(inbox.payload.offers)) as TOffer[];
}

export default function ShareHydrator() {
  const searchParams = useSearchParams();
  const addOffer = useStore((state) => state.addOffer);
  const [inbox, setInbox] = useState<SharedInbox | null>(null);
  const [importedCount, setImportedCount] = useState<number | null>(null);
  const seenTokenRef = useRef<string | null>(null);

  const shareToken = searchParams.get('share');

  // Never overwrite local state automatically: a shared link only stages an
  // inbox preview. Importing is an explicit, append-only action.
  useEffect(() => {
    if (!shareToken || seenTokenRef.current === shareToken) return;
    const parsed = parseShareToken(shareToken);
    seenTokenRef.current = shareToken;
    if (!parsed) return;
    setInbox(parsed.anon ? { anon: true, payload: parsed.payload } : { anon: false, payload: parsed.payload });
  }, [shareToken]);

  const offers = useMemo(() => (inbox ? displayOffers(inbox) : []), [inbox]);

  function clearTokenFromUrl() {
    try {
      const url = new URL(window.location.href);
      url.searchParams.delete('share');
      window.history.replaceState(null, '', url.toString());
    } catch {
      /* non-fatal */
    }
  }

  function dismiss() {
    setInbox(null);
    clearTokenFromUrl();
  }

  function importCopy() {
    const current = inbox;
    if (!current) return;
    const toImport: TOffer[] = current.anon
      ? anonPayloadToOffers(current.payload)
      : (JSON.parse(JSON.stringify(current.payload.offers)) as TOffer[]);
    // Append-only: existing offers and undo history are preserved.
    toImport.forEach((offer) => addOffer(offer));
    setImportedCount(toImport.length);
    setInbox(null);
    clearTokenFromUrl();
  }

  if (importedCount !== null) {
    return (
      <div className="pointer-events-none fixed inset-x-0 top-3 z-40 flex justify-center px-4">
        <div className="pointer-events-auto flex w-full max-w-xl items-center gap-3 rounded-2xl border border-emerald-500/30 bg-background p-4 shadow-xl">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-emerald-500/10">
            <Download className="size-4 text-emerald-600" />
          </span>
          <p className="flex-1 text-sm">
            Imported {importedCount} offer{importedCount === 1 ? '' : 's'} as new {importedCount === 1 ? 'offer' : 'offers'}. Your existing offers were kept.
          </p>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-8 w-8 shrink-0 p-0"
            onClick={() => setImportedCount(null)}
            aria-label="Dismiss"
          >
            <X className="size-4" />
          </Button>
        </div>
      </div>
    );
  }

  // While a share token is staged, the read-only statement view takes over
  // the whole viewport instead of the editor. Local offers stay untouched
  // until the user explicitly imports a copy or dismisses the share.
  if (!inbox) return null;

  return (
    <ShareSummaryView
      offers={offers}
      anon={inbox.anon}
      onImport={importCopy}
      onStartFresh={dismiss}
    />
  );
}
