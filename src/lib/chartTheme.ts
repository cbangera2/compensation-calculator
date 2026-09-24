// chartTheme — shared ECharts design tokens so every chart in the app
// looks like it belongs to the same product. Pure config, no React.
// Data mappings in each component stay untouched; only chrome changes.

import { chartText, chartTooltip } from './useDarkMode';

/** Categorical palette for per-offer series (trend / stock charts). */
export function categoricalPalette(dark: boolean): string[] {
  return dark
    ? ['#818cf8', '#38bdf8', '#34d399', '#fbbf24', '#fb7185', '#a78bfa']
    : ['#6366f1', '#0284c7', '#059669', '#d97706', '#e11d48', '#7c3aed'];
}

/** Compensation-component colors (Base / Bonus / Stock / Other). Same
 *  semantic order in both themes; dark variants are brightened for contrast. */
export function compColors(dark: boolean): Record<'Base' | 'Bonus' | 'Stock' | 'Other', string> {
  return dark
    ? { Base: '#60a5fa', Bonus: '#34d399', Stock: '#fbbf24', Other: '#a78bfa' }
    : { Base: '#3b82f6', Bonus: '#10b981', Stock: '#f59e0b', Other: '#8b5cf6' };
}

/** Refined tooltip chrome: rounded, bordered, soft shadow, tabular numbers. */
export function tooltipStyle(dark: boolean) {
  const tt = chartTooltip(dark);
  return {
    ...tt,
    borderWidth: 1,
    padding: [10, 14] as [number, number],
    extraCssText:
      'border-radius:12px;box-shadow:0 12px 32px -8px rgba(16,24,40,0.22);' +
      'font-variant-numeric:tabular-nums;backdrop-filter:blur(4px);',
    textStyle: {
      ...tt.textStyle,
      fontSize: 12,
      fontFamily: 'inherit',
    },
    axisPointer: {
      type: 'shadow' as const,
      shadowStyle: {
        color: dark ? 'rgba(255,255,255,0.06)' : 'rgba(15,23,42,0.05)',
      },
      lineStyle: {
        color: dark ? 'rgba(255,255,255,0.25)' : 'rgba(15,23,42,0.25)',
        type: 'dashed' as const,
      },
    },
  };
}

/** Subtle dashed gridlines + quiet axis labels. */
export function axisStyle(dark: boolean) {
  const ct = chartText(dark);
  return {
    axisLabel: {
      color: ct.secondary,
      fontSize: 11,
      fontFamily: 'inherit',
      hideOverlap: true,
    },
    axisLine: {
      show: false,
    },
    axisTick: {
      show: false,
    },
    splitLine: {
      lineStyle: {
        color: dark ? 'rgba(255,255,255,0.07)' : 'rgba(15,23,42,0.07)',
        type: [4, 4] as [number, number],
      },
    },
  };
}

/** Quiet legend: smaller type, soft color, comfortable item gap. */
export function legendStyle(dark: boolean, extra: Record<string, unknown> = {}) {
  const ct = chartText(dark);
  return {
    textStyle: { color: ct.primary, fontSize: 12, fontFamily: 'inherit' },
    icon: 'roundRect',
    itemWidth: 14,
    itemHeight: 8,
    itemGap: 16,
    ...extra,
  };
}

/** Smooth, consistent animation across charts. */
export const chartAnimation = {
  animationDuration: 650,
  animationEasing: 'cubicOut' as const,
  animationDelay: (idx: number) => idx * 40,
};

/** Soft bar styling shared by bar charts. */
export const barItemStyle = {
  borderRadius: [6, 6, 0, 0] as [number, number, number, number],
};

/** y-axis currency shorthand ($150k) formatter. */
export function currencyAxisFormatter(v: number): string {
  if (Math.abs(v) >= 1000) return `$${(v / 1000).toFixed(v % 1000 === 0 ? 0 : 1)}k`;
  return `$${v}`;
}
