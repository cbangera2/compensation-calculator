// Market history helpers: pure parsing + CAGR math for /api/market/history.
// Fetching/caching lives in the route handler; everything here is unit-testable.

export interface MonthlyClose {
  /** YYYY-MM-DD */
  date: string;
  close: number;
}

export interface HistoryStats {
  ticker: string;
  /** most recent monthly close */
  latestPrice: number;
  latestDate: string;
  closes: MonthlyClose[];
  /** realized compound annual growth rates, null when history too short */
  cagr1y: number | null;
  cagr3y: number | null;
  cagr5y: number | null;
  source: 'yahoo' | 'stooq';
  asOf: string;
}

/** Public tickers we serve. Private names (Stripe, SpaceX, Anduril, Bloomberg)
 *  have no public price history and are intentionally excluded. */
export const SUPPORTED_TICKERS = ['META', 'GOOGL', 'AAPL', 'MSFT', 'TSLA', 'PLTR'] as const;

export function isSupportedTicker(t: string): boolean {
  return (SUPPORTED_TICKERS as readonly string[]).includes(t.toUpperCase());
}

const UA = { 'User-Agent': 'Mozilla/5.0 (compatible; comp-calculator/1.0)' };

/** Primary source: Yahoo Finance v8 chart endpoint, monthly bars. */
export async function fetchYahooMonthly(ticker: string): Promise<MonthlyClose[]> {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(
    ticker,
  )}?interval=1mo&range=6y`;
  const res = await fetch(url, {
    headers: UA,
    next: { revalidate: 86400 },
    signal: AbortSignal.timeout(8_000),
  });
  if (!res.ok) throw new Error(`yahoo ${res.status}`);
  const json = await res.json();
  const result = json?.chart?.result?.[0];
  if (!result?.timestamp?.length) throw new Error('yahoo empty result');
  // Yahoo's v8 chart API exposes split/dividend-adjusted closes at
  // indicators.adjclose[0].adjclose (never under quote[0].adjclose). Fall back
  // to raw close only when the adjusted series is absent.
  const closes: (number | null)[] =
    result.indicators?.adjclose?.[0]?.adjclose ?? result.indicators?.quote?.[0]?.close ?? [];
  const out: MonthlyClose[] = [];
  for (let i = 0; i < result.timestamp.length; i++) {
    const c = closes[i];
    if (typeof c === 'number' && isFinite(c) && c > 0) {
      out.push({ date: new Date(result.timestamp[i] * 1000).toISOString().slice(0, 10), close: c });
    }
  }
  if (out.length < 13) throw new Error('yahoo insufficient history');
  return out;
}

/** Fallback source: Stooq daily CSV, resampled to month-end. */
export async function fetchStooqMonthly(ticker: string): Promise<MonthlyClose[]> {
  const url = `https://stooq.com/q/d/l/?s=${encodeURIComponent(ticker.toLowerCase())}.us&i=d`;
  const res = await fetch(url, {
    headers: UA,
    next: { revalidate: 86400 },
    signal: AbortSignal.timeout(8_000),
  });
  if (!res.ok) throw new Error(`stooq ${res.status}`);
  const text = await res.text();
  const lines = text.trim().split('\n').slice(1); // drop header
  const byMonth = new Map<string, MonthlyClose>();
  for (const line of lines) {
    const [date, , , , close] = line.split(',');
    const c = Number(close);
    if (!date || !isFinite(c) || c <= 0) continue;
    byMonth.set(date.slice(0, 7), { date, close: c }); // last row wins = month-end
  }
  const out = [...byMonth.values()].sort((a, b) => (a.date < b.date ? -1 : 1));
  if (out.length < 13) throw new Error('stooq insufficient history');
  return out;
}

/** Realized CAGR between the latest close and the close nearest `years` back. */
export function realizedCagr(closes: MonthlyClose[], years: number): number | null {
  if (closes.length < 2) return null;
  const latest = closes[closes.length - 1];
  const targetTime = new Date(latest.date).getTime() - years * 365.25 * 24 * 3600 * 1000;
  let best = closes[0];
  let bestDiff = Infinity;
  for (const m of closes) {
    const d = Math.abs(new Date(m.date).getTime() - targetTime);
    if (d < bestDiff) {
      bestDiff = d;
      best = m;
    }
  }
  // Anchor must be within ~2 months of the target, else history is too gappy.
  if (bestDiff > 62 * 24 * 3600 * 1000 || best.close <= 0) return null;
  const actualYears =
    (new Date(latest.date).getTime() - new Date(best.date).getTime()) / (365.25 * 24 * 3600 * 1000);
  if (actualYears < years * 0.8) return null;
  return Math.pow(latest.close / best.close, 1 / actualYears) - 1;
}

export function toStats(ticker: string, closes: MonthlyClose[], source: 'yahoo' | 'stooq'): HistoryStats {
  const latest = closes[closes.length - 1];
  return {
    ticker,
    latestPrice: latest.close,
    latestDate: latest.date,
    closes,
    cagr1y: realizedCagr(closes, 1),
    cagr3y: realizedCagr(closes, 3),
    cagr5y: realizedCagr(closes, 5),
    source,
    asOf: new Date().toISOString(),
  };
}
