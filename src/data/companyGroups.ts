import { z } from 'zod';

/**
 * Shared company-group taxonomy for the leaderboard tables.
 * One group per entry; the UI renders filter checkboxes from these and
 * re-computes each table's ranking over the visible rows.
 * Kept in its own module so both dataset files can import it without
 * creating an import cycle through lib/leaderboard.
 */
export const CompanyGroup = z.enum([
  'big-tech',
  'ai',
  'startups',
  'consumer',
  'enterprise',
  'defense',
]);
export type TCompanyGroup = z.infer<typeof CompanyGroup>;

export const COMPANY_GROUP_LABELS: Record<TCompanyGroup, string> = {
  'big-tech': 'Big Tech',
  ai: 'AI labs & infra',
  startups: 'Startups',
  consumer: 'Consumer',
  enterprise: 'Enterprise',
  defense: 'Defense tech',
};

/** All groups in checkbox display order. */
export const COMPANY_GROUPS: TCompanyGroup[] = [
  'big-tech',
  'ai',
  'startups',
  'consumer',
  'enterprise',
  'defense',
];
