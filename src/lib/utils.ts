import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(n: number, options?: { decimals?: number }) {
  const decimals = options?.decimals ?? 0;
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: decimals, maximumFractionDigits: decimals }).format(n || 0);
}

export function formatNumber(n: number, options?: { decimals?: number }) {
  const decimals = options?.decimals ?? 0;
  return new Intl.NumberFormat('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals }).format(n || 0);
}

/**
 * Short display form for city/location names used in the UI.
 * "San Francisco Bay Area" -> "SF", "New York, NY" -> "NYC", "Ann Arbor" -> "AA", etc.
 */
export function shortCity(city: string | null | undefined): string {
  if (!city) return '';
  const c = city.trim();
  const lower = c.toLowerCase();
  // Exact matches first
  const exact: Record<string, string> = {
    'san francisco bay area': 'SF',
    'san francisco, ca': 'SF',
    'san francisco': 'SF',
    'new york, ny': 'NYC',
    'new york city': 'NYC',
    'new york': 'NYC',
    'ann arbor': 'AA',
    'ann arbor, mi': 'AA',
    'los angeles, ca': 'LA',
    'los angeles': 'LA',
    us: 'US',
    'united states': 'US',
    'united states of america': 'US',
    remote: 'Remote',
  };
  if (exact[lower]) return exact[lower];
  // "City, ST" -> "City" (e.g. "Austin, TX" -> "Austin", "Seattle, WA" -> "Seattle")
  const m = c.match(/^([^,]+),\s*[A-Z]{2}$/);
  if (m) return m[1].trim();
  return c;
}

/**
 * Disambiguate display names: if multiple items share the same name, append
 * a parenthesized distinguisher. Prefers short location when locations differ,
 * otherwise falls back to a number (e.g. "Google (SF)", "Google (2)").
 */
export function disambiguateNames<T>(
  items: T[],
  getName: (item: T) => string,
  getLocation?: (item: T) => string | null | undefined,
): string[] {
  const counts = new Map<string, number>();
  for (const item of items) {
    const n = getName(item) || 'Untitled';
    counts.set(n, (counts.get(n) ?? 0) + 1);
  }
  const seen = new Map<string, number>();
  return items.map((item) => {
    const name = getName(item) || 'Untitled';
    if ((counts.get(name) ?? 0) <= 1) return name;
    // Duplicate name: try location first
    if (getLocation) {
      const loc = shortCity(getLocation(item));
      if (loc) {
        // Only use location if it actually distinguishes (check siblings)
        const siblings = items.filter((o) => (getName(o) || 'Untitled') === name);
        const locs = new Set(siblings.map((o) => shortCity(getLocation(o))));
        if (locs.size > 1) return `${name} (${loc})`;
      }
    }
    // Fall back to numbering
    const n = (seen.get(name) ?? 0) + 1;
    seen.set(name, n);
    return n === 1 ? name : `${name} (${n})`;
  });
}
