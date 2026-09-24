import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export type EmptyStateProps = {
  icon?: ReactNode;
  title: string;
  hint?: string;
  action?: ReactNode;
  className?: string;
};

/**
 * EmptyState — soft dashed placeholder with an icon, a title, and an
 * optional hint/action. Replaces the scattered `border-2 border-dashed`
 * blocks with one consistent, calmer treatment.
 */
export default function EmptyState({ icon, title, hint, action, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        'rounded-xl border border-dashed border-border bg-muted/20 px-4 py-5 text-center sm:py-6',
        className
      )}
    >
      {icon ? (
        <div className="mx-auto mb-2 grid size-9 place-items-center rounded-full bg-muted text-muted-foreground">
          {icon}
        </div>
      ) : null}
      <p className="text-sm font-medium text-foreground">{title}</p>
      {hint ? <p className="mx-auto mt-1 max-w-sm text-xs leading-relaxed text-muted-foreground">{hint}</p> : null}
      {action ? <div className="mt-3 flex justify-center">{action}</div> : null}
    </div>
  );
}
