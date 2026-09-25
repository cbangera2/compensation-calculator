"use client";

import { useMemo } from 'react';
import { PiggyBank, Wallet, Layers, TrendingUp } from 'lucide-react';
import { useStore } from '@/state/store';
import { computeOffer } from '@/core/compute';
import { cn, formatCurrency } from '@/lib/utils';

type Stat = {
  label: string;
  hint: string;
  value: string;
  delta?: {
    label: string;
    tone: 'positive' | 'negative' | 'neutral';
    title?: string;
  };
  icon: typeof PiggyBank;
};

const toneClass: Record<NonNullable<Stat['delta']>['tone'], string> = {
	positive: 'text-emerald-500 bg-emerald-500/10 border-emerald-500/30',
	negative: 'text-destructive bg-destructive/10 border-destructive/30',
	neutral: 'text-muted-foreground bg-muted/20 border-border/60',
};

export default function StatCards() {
	const { offer } = useStore();
	const { stats } = useMemo(() => {
		const rows = computeOffer(offer);
		const yearOne = rows[0];
		const horizon = offer.assumptions?.horizonYears ?? rows.length;
		const yearTwo = rows[1];

		const cashYearOne = yearOne ? yearOne.base + yearOne.bonus + yearOne.other : 0;
		const totalYearOne = yearOne?.total ?? 0;
		const equityFourYears = rows.slice(0, horizon).reduce((acc, row) => acc + row.stock, 0);
		const totalFourYears = rows.slice(0, horizon).reduce((acc, row) => acc + row.total, 0);

		const deltaTotal = yearTwo ? yearTwo.total - totalYearOne : 0;
		const deltaCash = yearTwo ? (yearTwo.base + yearTwo.bonus + yearTwo.other) - cashYearOne : 0;

		const formatDelta = (value: number): Stat['delta'] => {
			if (Math.abs(value) < 1)
				return {
					label: 'Same as Y2',
					tone: 'neutral',
					title: 'Year 1 total matches Year 2 — your comp is flat across the first two years.',
				};
			const tone = value < 0 ? 'positive' : 'negative';
			const formatted = formatCurrency(Math.abs(value));
			return {
				label: `${value < 0 ? '+' : '-'}${formatted} vs Y2`,
				tone,
				title: `Year 1 total is ${formatted} ${value < 0 ? 'above' : 'below'} the Year 2 total.`,
			};
		};

		const stats: Stat[] = [
			{
				label: 'Year 1 total comp',
				hint: 'Base + bonus + equity + perks in the first 12 months. Pre-tax.',
				value: formatCurrency(totalYearOne),
				delta: formatDelta(deltaTotal),
				icon: TrendingUp,
			},
			{
				label: 'Year 1 cash & perks',
				hint: 'Salary, expected bonus, stipends, and one-time cash.',
				value: formatCurrency(cashYearOne),
				delta: formatDelta(deltaCash),
				icon: Wallet,
			},
			{
				label: 'Equity over 4 years',
				hint: 'Sum of vested stock value within the modeled horizon.',
				value: formatCurrency(equityFourYears),
				icon: Layers,
			},
			{
				label: `${horizon}-year total value`,
				hint: 'All cash, stock, benefits, and stipends across the horizon. Pre-tax.',
				value: formatCurrency(totalFourYears),
				icon: PiggyBank,
			},
		];

		return { stats };
	}, [offer]);

	return (
		<div className="grid grid-cols-2 gap-2.5 sm:gap-4 md:grid-cols-2 xl:grid-cols-4">
			{stats.map((stat) => (
				<article
					key={stat.label}
					className="group flex flex-col justify-between gap-2 rounded-2xl border border-border/50 bg-background/60 p-3 shadow-sm transition-shadow hover:shadow-md sm:gap-3 sm:p-4"
				>
					<div className="flex items-center gap-2">
						<div className="flex min-w-0 flex-1 items-center gap-1.5 text-xs font-medium text-muted-foreground sm:gap-2 sm:text-sm">
							<span className="grid size-7 shrink-0 place-items-center rounded-lg border border-border/50 bg-background/70 text-primary sm:size-9">
								<stat.icon className="size-3.5 sm:size-4" />
							</span>
							<span className="line-clamp-2 font-semibold text-foreground">{stat.label}</span>
						</div>
						{stat.delta ? (
							<span title={stat.delta.title} className={cn('hidden shrink-0 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors sm:inline-flex', toneClass[stat.delta.tone])}>
								{stat.delta.label}
							</span>
						) : null}
					</div>
					<div>
						<div className="flex flex-wrap items-center gap-x-2 gap-y-1">
							<p className="text-lg font-semibold tracking-tight text-foreground tabular-nums sm:text-2xl">{stat.value}</p>
							{stat.delta ? (
								<span title={stat.delta.title} className={cn('inline-flex shrink-0 rounded-full border px-1.5 py-0.5 text-[10px] font-medium transition-colors sm:hidden', toneClass[stat.delta.tone])}>
									{stat.delta.label}
								</span>
							) : null}
						</div>
						<p className="mt-0.5 hidden text-xs text-muted-foreground sm:mt-1 sm:block">{stat.hint}</p>
					</div>
				</article>
			))}
		</div>
	);
}
