"use client";

import {
  ArrowLeftRight,
  BarChart3,
  Calculator,
  ChevronsLeft,
  ChevronsRight,
  MapPin,
  PiggyBank,
  Rocket,
  TrendingUp,
  Trophy,
  type LucideIcon,
} from 'lucide-react';
import { TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { TAB_GROUPS, type TabValue } from '@/lib/tabs';
import { useStore } from '@/state/store';
import { cn } from '@/lib/utils';

const TAB_ICONS: Record<TabValue, LucideIcon> = {
  calc: Calculator,
  startup: Rocket,
  growth: TrendingUp,
  benchmarks: BarChart3,
  leaderboard: Trophy,
  compare: ArrowLeftRight,
  raises: PiggyBank,
  cities: MapPin,
};

const EXPANDED_WIDTH = 'w-[232px]';
const COLLAPSED_WIDTH = 'w-16';

/**
 * Left-rail navigation replacing the old horizontal tab strip.
 * Driven entirely by TAB_GROUPS: adding a tab there (plus its
 * TabsContent in page.tsx) is all it takes to extend the nav.
 * Renders inside the page-level <Tabs> root, so TabsTrigger keeps the
 * exact same tab ids/values and switching behavior as before.
 */
export default function SidebarNav() {
  const { sidebarCollapsed, setSidebarCollapsed } = useStore();
  const collapsed = sidebarCollapsed;

  return (
    <TooltipProvider delayDuration={200}>
      <aside
        aria-label="Primary"
        data-collapsed={collapsed}
        className={cn(
          'sticky top-0 z-40 hidden h-screen shrink-0 flex-col border-r border-border/40 bg-background transition-[width] duration-200 ease-in-out md:flex',
          collapsed ? COLLAPSED_WIDTH : EXPANDED_WIDTH
        )}
      >
        {/* Brand row */}
        <div className={cn('flex h-16 items-center border-b border-border/40', collapsed ? 'justify-center px-2' : 'gap-2.5 px-5')}>
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 to-blue-700 text-base font-bold text-white shadow-sm">
            C
          </span>
          {!collapsed && (
            <span className="truncate text-[15px] font-bold tracking-tight text-foreground">CompCalc</span>
          )}
        </div>

        {/* Tab groups */}
        <nav className="flex-1 space-y-6 overflow-y-auto px-3 py-5" aria-label="Tabs">
          {TAB_GROUPS.map((group) => (
            <div key={group.label}>
              {collapsed ? (
                <div aria-hidden="true" className="mx-3 mb-2 border-t border-border/40" />
              ) : (
                <p className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground/60">
                  {group.label}
                </p>
              )}
              <TabsList
                aria-label={group.label}
                className="flex h-auto w-full flex-col items-stretch gap-1 bg-transparent p-0"
              >
                {group.tabs.map((t) => {
                  const Icon = TAB_ICONS[t.value];
                  const trigger = (
                    <TabsTrigger
                      key={t.value}
                      value={t.value}
                      className={cn(
                        'flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-muted-foreground transition-all duration-150',
                        'hover:bg-accent hover:text-foreground',
                        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background',
                        'data-[state=active]:bg-accent data-[state=active]:text-foreground data-[state=active]:font-semibold',
                        'border-0 shadow-none',
                        collapsed && 'justify-center px-0'
                      )}
                    >
                      <Icon className="h-[18px] w-[18px] shrink-0" aria-hidden="true" />
                      {!collapsed && <span className="truncate">{t.label}</span>}
                    </TabsTrigger>
                  );
                  return collapsed ? (
                    <Tooltip key={t.value}>
                      <TooltipTrigger asChild>{trigger}</TooltipTrigger>
                      <TooltipContent side="right">{t.label}</TooltipContent>
                    </Tooltip>
                  ) : (
                    trigger
                  );
                })}
              </TabsList>
            </div>
          ))}
        </nav>

        {/* Collapse toggle */}
        <div className={cn('border-t border-border/40 p-3', collapsed && 'flex justify-center')}>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={() => setSidebarCollapsed(!collapsed)}
                aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                aria-expanded={!collapsed}
                className="flex h-9 w-9 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {collapsed ? (
                  <ChevronsRight className="h-[18px] w-[18px]" aria-hidden="true" />
                ) : (
                  <ChevronsLeft className="h-[18px] w-[18px]" aria-hidden="true" />
                )}
              </button>
            </TooltipTrigger>
            <TooltipContent side="right">
              {collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            </TooltipContent>
          </Tooltip>
        </div>
      </aside>
    </TooltipProvider>
  );
}
