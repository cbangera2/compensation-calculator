'use client';

import { useState, type ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { useIsMobile } from '@/lib/useIsMobile';
import { cn } from '@/lib/utils';

export type MobileCollapseProps = {
  /** Summary row title shown on mobile when collapsed. */
  title: ReactNode;
  /** Optional smaller line under the title on mobile. */
  description?: ReactNode;
  /** Desktop card header content (rendered verbatim on desktop, card variant only). */
  header?: ReactNode;
  /** Body content. */
  children: ReactNode;
  className?: string;
  /** Extra classes for the body wrapper. */
  contentClassName?: string;
  /**
   * 'card' (default): desktop renders a Card with header + content.
   * 'plain': desktop renders children inside a div with `desktopClassName`
   * (falls back to `className`); mobile uses a bordered container.
   */
  variant?: 'card' | 'plain';
  desktopClassName?: string;
};

/**
 * MobileCollapse — renders `children` inside a normal Card on desktop
 * (header + content, unchanged density), and as a collapsed tappable
 * section on mobile so secondary content is one tap away instead of
 * pushing primary numbers down the page.
 */
export default function MobileCollapse({
  title,
  description,
  header,
  children,
  className,
  contentClassName,
  variant = 'card',
  desktopClassName,
}: MobileCollapseProps) {
  const isMobile = useIsMobile();
  const [open, setOpen] = useState(false);

  if (!isMobile) {
    if (variant === 'plain') return <div className={desktopClassName ?? className}>{children}</div>;
    return (
      <Card className={className}>
        {header ? <CardHeader>{header}</CardHeader> : null}
        <CardContent className={contentClassName}>{children}</CardContent>
      </Card>
    );
  }

  const toggle = (
    <button
      type="button"
      aria-expanded={open}
      onClick={() => setOpen((o) => !o)}
      className="flex min-h-[54px] w-full items-center justify-between gap-3 px-4 py-2.5 text-left"
    >
      <span className="min-w-0">
        <span className="block truncate text-sm font-semibold text-foreground">{title}</span>
        {description ? (
          <span className="mt-0.5 block truncate text-xs text-muted-foreground">{description}</span>
        ) : null}
      </span>
      <ChevronDown
        className={cn(
          'size-4 shrink-0 text-muted-foreground transition-transform duration-200',
          open && 'rotate-180'
        )}
      />
    </button>
  );
  const body = open ? <div className={cn('px-4 pb-4', contentClassName)}>{children}</div> : null;

  if (variant === 'plain') {
    return (
      <div className={cn('rounded-xl border border-border/60 bg-muted/30', className)}>
        {toggle}
        {body}
      </div>
    );
  }

  return (
    <Card className={className}>
      {toggle}
      {body}
    </Card>
  );
}
