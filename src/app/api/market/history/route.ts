import { NextResponse } from 'next/server';
import {
  fetchStooqMonthly,
  fetchYahooMonthly,
  isSupportedTicker,
  toStats,
  type HistoryStats,
} from '@/lib/market';

const TTL_MS = 24 * 3600 * 1000; // ~24h cache, per product spec
const cache = new Map<string, { at: number; data: HistoryStats }>();

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const ticker = (searchParams.get('ticker') ?? '').toUpperCase().trim();

  if (!ticker) {
    return NextResponse.json({ error: 'ticker query param required' }, { status: 400 });
  }
  if (!isSupportedTicker(ticker)) {
    return NextResponse.json(
      {
        error: `unsupported ticker "${ticker}"`,
        supported: ['META', 'GOOGL', 'AAPL', 'MSFT', 'TSLA', 'PLTR'],
        note: 'Private companies (Stripe, SpaceX, Anduril, Bloomberg) have no public price history.',
      },
      { status: 400 },
    );
  }

  const hit = cache.get(ticker);
  if (hit && Date.now() - hit.at < TTL_MS) {
    return NextResponse.json(hit.data, { headers: { 'x-cache': 'hit' } });
  }

  // Primary: Yahoo. Fallback: Stooq. Both throw on bad data.
  let data: HistoryStats | null = null;
  let lastErr: unknown = null;
  try {
    data = toStats(ticker, await fetchYahooMonthly(ticker), 'yahoo');
  } catch (e) {
    lastErr = e;
    try {
      data = toStats(ticker, await fetchStooqMonthly(ticker), 'stooq');
    } catch (e2) {
      lastErr = e2;
    }
  }

  if (!data) {
    console.error('[market/history]', ticker, lastErr);
    return NextResponse.json(
      { error: 'price history unavailable', ticker },
      { status: 502 },
    );
  }

  cache.set(ticker, { at: Date.now(), data });
  return NextResponse.json(data, { headers: { 'x-cache': 'miss' } });
}
