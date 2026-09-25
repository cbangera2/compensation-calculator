"use client";

import {
  ArrowLeftRight,
  BarChart3,
  Calculator,
  MapPin,
  PiggyBank,
  TrendingUp,
  Trophy,
  type LucideIcon,
} from 'lucide-react';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  SidebarTrigger,
} from '@/components/ui/sidebar';
import { TAB_GROUPS, type TabValue } from '@/lib/tabs';

const TAB_ICONS: Record<TabValue, LucideIcon> = {
  calc: Calculator,
  equity: TrendingUp,
  benchmarks: BarChart3,
  leaderboard: Trophy,
  compare: ArrowLeftRight,
  raises: PiggyBank,
  cities: MapPin,
};

/**
 * App navigation built on the real shadcn sidebar primitives.
 * Driven by TAB_GROUPS: adding a tab there (plus its TabsContent in
 * page.tsx) is all it takes to extend the nav. Renders inside the
 * page-level <Tabs> root; each nav item is a TabsTrigger (asChild)
 * rendering a SidebarMenuButton, so tab ids/values, roving-focus
 * keyboard nav, and switching behavior are unchanged.
 * Collapse state lives in SidebarProvider (wired to the persisted
 * store value in page.tsx); on mobile this renders as a Sheet.
 */
export default function SidebarNav({ activeTab, onTabChange }: { activeTab: TabValue; onTabChange: (v: TabValue) => void }) {
  return (
    <Sidebar collapsible="icon" aria-label="Primary">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <div aria-label="CompCalc home">
                <span className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sm font-bold text-sidebar-primary-foreground">
                  C
                </span>
                <span className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-bold">CompCalc</span>
                </span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        {TAB_GROUPS.map((group) => (
          <SidebarGroup key={group.label}>
            <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu aria-label={`${group.label} tabs`}>
                {group.tabs.map((t) => {
                  const Icon = TAB_ICONS[t.value];
                  return (
                    <SidebarMenuItem key={t.value}>
                      <SidebarMenuButton
                        isActive={activeTab === t.value}
                        tooltip={t.label}
                        onClick={() => onTabChange(t.value)}
                      >
                        <Icon aria-hidden="true" />
                        <span>{t.label}</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild tooltip="Toggle sidebar">
              <SidebarTrigger aria-label="Toggle sidebar" />
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  );
}
