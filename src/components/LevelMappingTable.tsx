"use client";

import {
  GENERIC_BANDS,
  MAPPED_COMPANIES,
  levelMappingFor,
  type LevelVerification,
} from '@/data/levelMapping';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { ArrowLeftRight } from 'lucide-react';

const STATUS_STYLE: Record<LevelVerification, string> = {
  verified:
    'border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  inferred:
    'border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300',
  unverified:
    'border-border/70 bg-muted/40 text-muted-foreground',
};

function StatusBadge({ status, note }: { status: LevelVerification; note?: string }) {
  return (
    <span
      title={note}
      className={cn(
        'inline-flex items-center rounded-full border px-1.5 py-px text-[10px] font-semibold',
        STATUS_STYLE[status],
      )}
    >
      {status}
    </span>
  );
}

/**
 * Cross-company level mapping matrix. Rows are companies, columns are the
 * generic Entry / Mid / Senior bands; each cell shows the company's real
 * level label plus a verification marker. Anything the data doesn't support
 * is marked unverified, never guessed.
 */
export default function LevelMappingTable() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
          <ArrowLeftRight className="size-4 text-muted-foreground" />
          Level mapping
        </CardTitle>
        <CardDescription>
          How company levels line up across the 10 north-star companies. Same
          column means roughly the same seniority.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
          <table className="w-full min-w-[560px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-border/60">
                <th className="py-2 pr-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Company
                </th>
                {GENERIC_BANDS.map((band) => (
                  <th
                    key={band}
                    className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground"
                  >
                    {band}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {MAPPED_COMPANIES.map((company) => (
                <tr key={company} className="border-b border-border/40 last:border-0">
                  <td className="py-2.5 pr-3 font-semibold whitespace-nowrap">
                    {company}
                  </td>
                  {GENERIC_BANDS.map((band) => {
                    const mapping = levelMappingFor(company, band);
                    if (!mapping) return <td key={band} className="px-3 py-2.5" />;
                    return (
                      <td key={band} className="px-3 py-2.5">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="font-medium tabular-nums whitespace-nowrap">
                            {mapping.companyLevel}
                          </span>
                          <StatusBadge
                            status={mapping.verification}
                            note={mapping.note}
                          />
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
          Level labels are community-reported mappings (e.g. levels.fyi), not
          official company ladders. <span className="font-medium">verified</span>{' '}
          means a standard, deep-coverage mapping;{' '}
          <span className="font-medium">inferred</span> from thinner
          data; <span className="font-medium">unverified</span> means the
          company publishes no ladder and the label is a placeholder. Hover a
          badge for the reasoning.
        </p>
      </CardContent>
    </Card>
  );
}
