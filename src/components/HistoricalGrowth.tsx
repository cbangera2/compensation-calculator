'use client';

import { useState } from 'react';
import { Loader2, History } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import MobileCollapse from '@/components/MobileCollapse';
import { cn } from '@/lib/utils';
import { SUPPORTED_TICKERS, type HistoryStats } from '@/lib/market';

function CagrChip({ label, value }: { label: string; value: number | null }) {
  if (value == null || !Number.isFinite(value)) {
    return (
      <span className="inline-flex items-baseline gap-1.5">
        <span className="text-xs text-muted-foreground">{label}</span>
        <span className="text-sm font-semibold text-muted-foreground">n/a</span>
      </span>
    );
  }
  const pos = value >= 0;
  return (
    <span className="inline-flex items-baseline gap-1.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span
        className={cn(
          'text-lg font-bold tabular-nums',
          pos ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'
        )}
      >
        {pos ? '+' : ''}
        {(value * 100).toFixed(1)}%
      </span>
    </span>
  );
}

/**
 * HistoricalGrowth — realized CAGR lookup for public tech tickers.
 * Collapsed on mobile; the numbers shown are historical and labeled
 * non-predictive. "Apply 5y CAGR" drives the explorer's target price
 * exactly like the growth slider does.
 */
export default function HistoricalGrowth({ onApplyCagr }: { onApplyCagr: (cagr: number) => void }) {
  const [ticker, setTicker] = useState<string>(SUPPORTED_TICKERS[0]);
  const [status, setStatus] = useState<'idle' | 'loading' | 'done' | 'error'>('idle');
  const [data, setData] = useState<HistoryStats | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchHistory = async () => {
    setStatus('loading');
    setError(null);
    try {
      const res = await fetch(`/api/market/history?ticker=${encodeURIComponent(ticker)}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? `request failed (${res.status})`);
      setData(json as HistoryStats);
      setStatus('done');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'request failed');
      setStatus('error');
    }
  };

  return (
    <MobileCollapse
      variant="plain"
      title="Historical growth"
      description="Realized CAGRs · historical, not predictive"
      desktopClassName="rounded-xl border border-border/60 bg-muted/20 p-4 sm:p-5"
      contentClassName="space-y-3"
    >
      <div className="flex flex-wrap items-center gap-2">
        <div className="hidden items-center gap-2 sm:flex">
          <History className="size-4 text-muted-foreground" />
          <div>
            <p className="text-sm font-semibold text-foreground">Historical growth</p>
            <p className="text-xs text-muted-foreground">Realized CAGRs — historical, not predictive</p>
          </div>
        </div>
        <div className="flex w-full items-center gap-2 sm:ml-auto sm:w-auto">
          <Select value={ticker} onValueChange={setTicker}>
            <SelectTrigger className="h-9 flex-1 sm:w-28 sm:flex-none" aria-label="Ticker">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SUPPORTED_TICKERS.map((t) => (
                <SelectItem key={t} value={t}>
                  {t}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button size="sm" className="min-h-9" onClick={fetchHistory} disabled={status === 'loading'}>
            {status === 'loading' && <Loader2 className="size-3.5 animate-spin" />}
            {status === 'loading' ? 'Loading…' : 'Use historical'}
          </Button>
        </div>
      </div>

      {status === 'error' && (
        <p className="text-xs text-destructive">
          Couldn&apos;t load {ticker} history{error ? `: ${error}` : ''}. Try again in a bit.
        </p>
      )}

      {status === 'done' && data && (
        <div className="flex flex-wrap items-center gap-x-6 gap-y-3 border-t border-border/50 pt-3">
          <CagrChip label="1y CAGR" value={data.cagr1y} />
          <CagrChip label="3y CAGR" value={data.cagr3y} />
          <CagrChip label="5y CAGR" value={data.cagr5y} />
          <span className="text-xs tabular-nums text-muted-foreground">
            {data.ticker} latest ${data.latestPrice.toFixed(2)} ({data.latestDate}) · {data.source} · as of{' '}
            {data.asOf}
          </span>
          {data.cagr5y != null && Number.isFinite(data.cagr5y) && (
            <Button size="sm" variant="secondary" className="min-h-9" onClick={() => onApplyCagr(data.cagr5y as number)}>
              Apply 5y CAGR
            </Button>
          )}
        </div>
      )}
    </MobileCollapse>
  );
}
