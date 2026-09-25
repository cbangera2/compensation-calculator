import type { TStartupEquity, TValuationScenario } from '@/models/types';

/**
 * Saved valuation scenarios for a startup-equity block, normalized to [].
 * The field can be missing on offers imported from anonymized share links
 * (stripped for privacy) or from older persisted state — every consumer
 * must go through this so the Startup tab can't crash on the missing field.
 */
export function savedScenariosOf(block: TStartupEquity | undefined): TValuationScenario[] {
  return block?.savedScenarios ?? [];
}
