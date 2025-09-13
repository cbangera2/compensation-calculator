import { z } from 'zod';

export const VestingFrequency = z.enum(['monthly', 'quarterly', 'annual']);

export const VestingSchedule = z.union([
  z.object({
    model: z.literal('standard'),
    years: z.number().positive(),
    cliffMonths: z.number().int().nonnegative(),
  frequency: VestingFrequency,
  distribution: z.enum(['even', 'frontloaded', 'backloaded']).default('even'),
  cliffPercent: z.number().nonnegative().max(1).default(0),
  }),
  // Explicit dates and absolute/fractional tranche weights
  z.object({
    model: z.literal('explicit'),
    tranches: z.array(
      z.object({ date: z.string(), shares: z.number().nonnegative() })
    ),
  }),
  // Irregular schedules: milestone steps relative to grant start (in months)
  z.object({
    model: z.literal('milestone'),
    steps: z.array(
      z.object({ monthsFromStart: z.number().int().nonnegative(), fraction: z.number().nonnegative() })
    ),
  }),
]);

export const EquityType = z.enum(['RSU', 'ISO', 'NSO']);

export const EquityGrant = z.object({
  id: z.string().optional(),
  type: EquityType,
  shares: z.number().nonnegative(),
  strike: z.number().nonnegative().optional(),
  fmv: z.number().nonnegative().optional(),
  // When provided, the grant is defined primarily by a target dollar value,
  // and shares are implied from price/strike and schedule. targetMode 'year1'
  // means targetValue applies to Year 1 value; 'total' means across the full schedule.
  targetValue: z.number().nonnegative().optional(),
  targetMode: z.enum(['year1', 'total']).optional(),
  vesting: VestingSchedule,
  grantStartDate: z.string().optional(),
});

export const Raise = z.object({
  effectiveDate: z.string(),
  type: z.enum(['percent', 'absolute']),
  value: z.number(),
});

export const PerformanceBonus = z.object({
  kind: z.enum(['percent', 'fixed']),
  value: z.number().nonnegative(),
  expectedPayout: z.number().nonnegative().default(1),
});

export const Offer = z.object({
  id: z.string().optional(),
  name: z.string(),
  currency: z.string().default('USD'),
  startDate: z.string(),
  base: z.object({ startAnnual: z.number().nonnegative() }),
  raises: z.array(Raise).default([]),
  performanceBonus: PerformanceBonus.optional(),
  signingBonuses: z.array(
    z.object({ amount: z.number().nonnegative(), payDate: z.string() })
  ).optional(),
  relocationBonuses: z.array(
  z.object({ amount: z.number().nonnegative(), payDate: z.string() })
  ).optional(),
  benefits: z.array(z.object({ name: z.string(), annualValue: z.number().nonnegative(), enabled: z.boolean().default(true) })).default([]),
  miscRecurring: z.array(z.object({ name: z.string(), annualValue: z.number().nonnegative() })).default([]),
  equityGrants: z.array(EquityGrant).default([]),
  growth: z.object({ startingPrice: z.number().optional(), yoy: z.array(z.number()) }).optional(),
  retirement: z.object({
    employeeContributionPercent: z.number().nonnegative().max(1).default(0.06),
    matchRate: z.number().nonnegative().max(1).default(0.5),
  matchCapPercentOfSalary: z.number().nonnegative().max(1).default(0.06),
  employeeContributionCapDollar: z.number().nonnegative().default(23500),
  matchCapMode: z.enum(['percentOfSalary', 'dollar']).default('percentOfSalary'),
  matchCapDollar: z.number().nonnegative().default(0),
  }).optional(),
  assumptions: z.object({
    horizonYears: z.number().int().positive().default(4),
    presentValueRate: z.number().optional(),
    colAdjust: z.number().positive().default(1),
  }).default({ horizonYears: 4, colAdjust: 1 }),
});

export type TVestingSchedule = z.infer<typeof VestingSchedule>;
export type TEquityGrant = z.infer<typeof EquityGrant>;
export type TOffer = z.infer<typeof Offer>;
