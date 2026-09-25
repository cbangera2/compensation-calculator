"use client";

import { useEffect } from 'react';
import { AlertTriangle, Home, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';

/**
 * Route-level error boundary for the whole app. Catches client render
 * exceptions (e.g. a tab crashing on malformed imported data) and offers two
 * recoveries: retry the render, or bail out to the Calculator tab with a
 * full reload so a broken tab can't trap the user.
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Surface client crashes for debugging; never rendered to the user.
    console.error('App error boundary caught:', error);
  }, [error]);

  const goHome = () => {
    window.location.href = '/?tab=calc';
  };

  return (
    <main className="mx-auto flex min-h-[60vh] w-full max-w-lg flex-col items-center justify-center gap-4 px-6 py-16 text-center">
      <span className="grid size-12 place-items-center rounded-2xl border border-destructive/30 bg-destructive/10 text-destructive">
        <AlertTriangle className="size-6" />
      </span>
      <div>
        <h1 className="text-xl font-bold tracking-tight text-foreground">
          Something went wrong
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          This view hit an unexpected error and couldn&apos;t render. Your offers
          are saved — pick a way back below.
        </p>
      </div>
      <div className="flex flex-wrap items-center justify-center gap-2.5">
        <Button type="button" onClick={goHome} className="gap-2">
          <Home className="size-4" />
          Back to calculator
        </Button>
        <Button type="button" variant="outline" onClick={reset} className="gap-2">
          <RotateCcw className="size-4" />
          Try again
        </Button>
      </div>
    </main>
  );
}
