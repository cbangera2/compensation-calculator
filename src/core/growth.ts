export function applyYoYGrowth(startingPrice: number, yoy: number[], yearIndex: number) {
  // Returns price at start of given year index after applying growth cumulatively
  let price = startingPrice;
  for (let i = 0; i < yearIndex; i++) {
    const g = typeof yoy[i] === 'number' ? yoy[i]! : 0;
    price = price * (1 + g);
  }
  return price;
}

export function priceAtVest(startingPrice: number, yoy: number[], yearIndex: number) {
  return applyYoYGrowth(startingPrice, yoy, yearIndex);
}

// Convenience: build a YoY array from a constant CAGR value (as decimal, e.g., 0.1 for 10%)
export function yoyFromCagr(cagr: number, years: number): number[] {
  return Array.from({ length: years }, () => cagr || 0);
}

// Convenience: linearly interpolate YoY from start% to end% across years
export function yoyFromRamp(start: number, end: number, years: number): number[] {
  if (years <= 1) return [start];
  const arr: number[] = [];
  for (let i = 0; i < years; i++) {
    const t = i / (years - 1);
    arr.push(start + (end - start) * t);
  }
  return arr;
}

// Build the price path for preview: price at the start of each year 0..years
export function buildPricePath(startingPrice: number, yoy: number[], years: number): number[] {
  const path: number[] = [];
  for (let i = 0; i <= years; i++) {
    path.push(applyYoYGrowth(startingPrice, yoy, i));
  }
  return path;
}
