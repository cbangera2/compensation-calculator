'use client';

import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

/**
 * Shared centered dialog: dimmed backdrop, Escape/backdrop-click to close,
 * body scroll locked while open. Replaces the previously hand-rolled copies
 * in ShareDialog, CompareShareButton, MultiOfferBar, and StartupPanel.
 */
export function Modal({
  title,
  description,
  onClose,
  children,
  footer,
  maxWidth = 'max-w-lg',
  hideCloseButton = false,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
  maxWidth?: string;
  hideCloseButton?: boolean;
}) {
  // Stash onClose in a ref so the Escape/scroll-lock effect doesn't re-subscribe
  // on every parent render when call sites pass inline callbacks.
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCloseRef.current();
    };
    window.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, []);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4"
      role="dialog"
      aria-modal="true"
      aria-label={typeof title === 'string' ? title : undefined}
      onClick={onClose}
    >
      <div
        className={cn(
          'max-h-[92dvh] w-full overflow-y-auto rounded-2xl border border-border bg-background p-4 shadow-xl sm:p-6',
          maxWidth,
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold">{title}</h2>
            {description ? <p className="mt-0.5 text-sm text-muted-foreground">{description}</p> : null}
          </div>
          {!hideCloseButton && (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-8 w-8 shrink-0 p-0"
              onClick={onClose}
              aria-label="Close"
            >
              <X className="size-4" />
            </Button>
          )}
        </div>
        <div className="mt-4">{children}</div>
        {footer ? <div className="mt-5 flex justify-end gap-2">{footer}</div> : null}
      </div>
    </div>
  );
}
