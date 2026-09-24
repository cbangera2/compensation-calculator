import { describe, expect, it, vi, afterEach } from 'vitest';
import {
  fetchYahooMonthly,
  isSupportedTicker,
  realizedCagr,
  toStats,
  type MonthlyClose,
} from '@/lib/market';

function monthly(startYear: number, months: number, startPrice: number, monthlyGrowth: number): MonthlyClose[] {
  const out: MonthlyClose[] = [];
  let price = startPrice;
  for (let i = 0; i < months; i++) {
    const d = new Date(Date.UTC(startYear, i, 1));
    out.push({ date: d.toISOString().slice(0, 10), close: price });
    price *= 1 + monthlyGrowth;
  }
  return out;
}

describe('market history math', () => {
  it('supports the public north-star tickers only', () => {
    expect(isSupportedTicker('meta')).toBe(true);
    expect(isSupportedTicker('PLTR')).toBe(true);
    expect(isSupportedTicker('SPCX')).toBe(false); // unverified / not public
    expect(isSupportedTicker('')).toBe(false);
  });

  it('recovers the known growth rate from synthetic history', () => {
    // ~12% annual for 6 years
    const closes = monthly(2020, 73, 100, Math.pow(1.12, 1 / 12) - 1);
    const cagr5 = realizedCagr(closes, 5);
    expect(cagr5).not.toBeNull();
    expect(cagr5!).toBeCloseTo(0.12, 2);
    const cagr1 = realizedCagr(closes, 1);
    expect(cagr1!).toBeCloseTo(0.12, 2);
  });

  it('returns null when history is too short', () => {
    const closes = monthly(2025, 6, 100, 0.01);
    expect(realizedCagr(closes, 5)).toBeNull();
    expect(realizedCagr(closes, 3)).toBeNull();
    expect(realizedCagr(closes, 1)).toBeNull();
  });

  it('skips bad months without crashing', () => {
    const closes = monthly(2020, 73, 100, 0.005);
    closes[30] = { date: closes[30].date, close: 0 }; // corrupt month
    const cagr5 = realizedCagr(closes, 5);
    expect(cagr5).not.toBeNull();
  });

  it('toStats wires latest price, cagrs, and source', () => {
    const closes = monthly(2020, 73, 50, Math.pow(1.2, 1 / 12) - 1);
    const s = toStats('META', closes, 'yahoo');
    expect(s.ticker).toBe('META');
    expect(s.latestPrice).toBeCloseTo(closes[closes.length - 1].close, 6);
    expect(s.cagr5y!).toBeCloseTo(0.2, 2);
    expect(s.source).toBe('yahoo');
    expect(s.asOf).toBeTruthy();
  });
});

describe('fetchYahooMonthly adjusted close', () => {
  afterEach(() => vi.unstubAllGlobals());

  // Mock a Yahoo v8 chart payload shaped like the real API: split/dividend
  // adjusted closes live at indicators.adjclose[0].adjclose, raw closes at
  // indicators.quote[0].close.
  function yahooPayload(rawCloses: number[], adjCloses: number[] | null) {
    const start = Date.UTC(2020, 0, 1);
    const timestamps = rawCloses.map((_, i) => Math.floor(start / 1000) + i * 30 * 86400);
    const indicators: { quote: unknown[]; adjclose?: unknown[] } = {
      quote: [
        { close: rawCloses, open: rawCloses, high: rawCloses, low: rawCloses, volume: rawCloses.map(() => 1000) },
      ],
    };
    if (adjCloses) indicators.adjclose = [{ adjclose: adjCloses }];
    return { chart: { result: [{ timestamp: timestamps, indicators }], error: null } };
  }

  function stubFetch(payload: unknown) {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: true, json: async () => payload }))
    );
  }

  it('uses the split-adjusted series, not raw closes', async () => {
    // Simulates a 4:1 split: raw closes trade ~400, adjusted series ~100,
    // growing at the same rate.
    const raw = Array.from({ length: 14 }, (_, i) => 400 * (1 + 0.01 * i));
    const adj = Array.from({ length: 14 }, (_, i) => 100 * (1 + 0.01 * i));
    stubFetch(yahooPayload(raw, adj));
    const closes = await fetchYahooMonthly('AAPL');
    expect(closes).toHaveLength(14);
    closes.forEach((c, i) => expect(c.close).toBeCloseTo(adj[i], 6));
    expect(closes[0].close).not.toBeCloseTo(raw[0], 0);
  });

  it('falls back to raw close when the adjusted series is absent', async () => {
    const raw = Array.from({ length: 14 }, (_, i) => 200 * (1 + 0.01 * i));
    stubFetch(yahooPayload(raw, null));
    const closes = await fetchYahooMonthly('META');
    expect(closes).toHaveLength(14);
    closes.forEach((c, i) => expect(c.close).toBeCloseTo(raw[i], 6));
  });
});
