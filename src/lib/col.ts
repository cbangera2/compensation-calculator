// Cost of Living city presets
// Factor represents cost relative to US average (1.0)
// Higher = more expensive, Lower = cheaper

export type CityPreset = {
  key: string;
  name: string;
  factor: number;
};

export const CITY_PRESETS: CityPreset[] = [
  { key: 'sf', name: 'San Francisco, CA', factor: 1.40 },
  { key: 'nyc', name: 'New York, NY', factor: 1.35 },
  { key: 'sea', name: 'Seattle, WA', factor: 1.18 },
  { key: 'mtv', name: 'Mountain View, CA', factor: 1.25 },
  { key: 'la', name: 'Los Angeles, CA', factor: 1.22 },
  { key: 'bos', name: 'Boston, MA', factor: 1.20 },
  { key: 'dc', name: 'Washington, DC', factor: 1.15 },
  { key: 'chi', name: 'Chicago, IL', factor: 1.05 },
  { key: 'aus', name: 'Austin, TX', factor: 1.05 },
  { key: 'den', name: 'Denver, CO', factor: 1.08 },
  { key: 'atl', name: 'Atlanta, GA', factor: 0.98 },
  { key: 'det', name: 'Detroit, MI', factor: 0.85 },
  { key: 'pit', name: 'Pittsburgh, PA', factor: 0.88 },
  { key: 'phx', name: 'Phoenix, AZ', factor: 0.95 },
  { key: 'dal', name: 'Dallas, TX', factor: 0.97 },
  { key: 'hou', name: 'Houston, TX', factor: 0.93 },
  { key: 'remote', name: 'Remote (US avg)', factor: 0.95 },
];

// Helper to find city by key
export function getCityByKey(key: string): CityPreset | undefined {
  return CITY_PRESETS.find(c => c.key === key);
}

// Helper to find city name by factor (with tolerance)
export function getCityNameByFactor(factor: number, tolerance = 0.001): string | undefined {
  const city = CITY_PRESETS.find(c => Math.abs(c.factor - factor) < tolerance);
  return city?.name;
}

// Helper to find preset key by name or factor
export function getPresetKey(location?: string, factor?: number): string {
  if (location) {
    const byName = CITY_PRESETS.find(c => c.name === location);
    if (byName) return byName.key;
  }
  if (factor !== undefined) {
    const byFactor = CITY_PRESETS.find(c => Math.abs(c.factor - factor) < 0.001);
    if (byFactor) return byFactor.key;
  }
  return 'custom';
}

// Format currency helper
export function formatCOLCurrency(n: number): string {
  return `$${Math.round(n).toLocaleString()}`;
}

// Calculate purchasing power
export function calculatePurchasingPower(nominalValue: number, colFactor: number): number {
  return nominalValue / (colFactor || 1);
}
