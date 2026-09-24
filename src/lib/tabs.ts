/**
 * Single data-driven tab config for the app navigation. Tabs are grouped
 * into the capture → understand → decide flow. The sidebar nav (and the
 * mobile section picker) render straight from this array, so adding a new
 * tab only requires adding an entry here plus its TabsContent in page.tsx.
 *
 * `value` must match the TabsContent `value` for that tab and is the
 * payload of the `compcalc:switch-tab` window event.
 */
export const TAB_GROUPS = [
  {
    label: 'Capture',
    tabs: [
      { value: 'calc', label: 'Calculator' },
      { value: 'startup', label: 'Startup' },
    ],
  },
  {
    label: 'Understand',
    tabs: [
      { value: 'growth', label: 'Stock Growth' },
      { value: 'benchmarks', label: 'Benchmarks' },
    ],
  },
  {
    label: 'Decide',
    tabs: [
      { value: 'compare', label: 'Compare' },
      { value: 'raises', label: 'Raise Planner' },
      { value: 'cities', label: 'City Compare' },
    ],
  },
] as const;

export type TabValue = (typeof TAB_GROUPS)[number]['tabs'][number]['value'];

const TAB_VALUES: readonly string[] = TAB_GROUPS.flatMap((g) => g.tabs.map((t) => t.value));

/**
 * Guard for the `compcalc:switch-tab` window event: only known tab
 * values are allowed to switch tabs.
 */
export function isValidTabValue(detail: unknown): detail is TabValue {
  return typeof detail === 'string' && TAB_VALUES.includes(detail);
}
