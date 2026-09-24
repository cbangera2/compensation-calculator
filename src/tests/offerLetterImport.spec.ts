import { describe, expect, it } from 'vitest';
import { buildOfferFromFields, parseOfferLetter } from '@/lib/offerLetterImport';

const FULL_LETTER = `
Dear Alex,

We are pleased to offer you the position of Software Engineer at Google.
Your starting base salary will be $165,000 per year, paid semi-monthly.

You will receive a signing bonus of $25,000, payable within 30 days of your start date.

Your annual bonus target will be 15% of your base salary, based on company and individual performance.

You will be granted 1,200 RSUs, vesting over 4 years with a one-year cliff.

We look forward to you joining us. Your start date will be August 1, 2024.
You will be based in Mountain View, CA.

Sincerely,
The Google Recruiting Team
`;

describe('parseOfferLetter', () => {
  it('parses a full realistic offer letter', () => {
    const r = parseOfferLetter(FULL_LETTER);
    expect(r.extracted.base).toBe(165_000);
    expect(r.extracted.signingBonus).toBe(25_000);
    expect(r.extracted.targetBonusPercent).toBeCloseTo(0.15);
    expect(r.extracted.rsuShares).toBe(1200);
    expect(r.extracted.vestYears).toBe(4);
    expect(r.extracted.cliffMonths).toBe(12);
    expect(r.extracted.startDate).toBe('2024-08-01');
    expect(r.extracted.company).toBe('Google');
    expect(r.extracted.location).toBe('Mountain View, CA');
    expect(r.unparsed).not.toContain('base salary');
    expect(r.unparsed).not.toContain('vesting schedule');
  });

  it('builds a valid offer from a full parse', () => {
    const r = parseOfferLetter(FULL_LETTER);
    expect(r.offer.name).toBe('Google');
    expect(r.offer.base.startAnnual).toBe(165_000);
    expect(r.offer.signingBonuses).toEqual([{ amount: 25_000, payDate: '2024-08-01' }]);
    expect(r.offer.performanceBonus).toEqual({ kind: 'percent', value: 0.15, expectedPayout: 1 });
    expect(r.offer.equityGrants).toHaveLength(1);
    expect(r.offer.equityGrants[0].type).toBe('RSU');
    expect(r.offer.equityGrants[0].shares).toBe(1200);
    expect(r.offer.equityGrants[0].vesting).toMatchObject({ model: 'standard', years: 4, cliffMonths: 12 });
  });

  it('parses an options grant with strike price', () => {
    const r = parseOfferLetter(`
      We are excited to offer you a role at Stripe.
      Base salary: $150,000 annually.
      You will receive 10,000 stock options with a strike price of $25.50 per share.
      Options vest over 4 years.
    `);
    expect(r.extracted.company).toBe('Stripe');
    expect(r.extracted.base).toBe(150_000);
    expect(r.extracted.optionShares).toBe(10_000);
    expect(r.extracted.strikePrice).toBeCloseTo(25.5);
    const grant = r.offer.equityGrants.find((g) => g.type === 'NSO');
    expect(grant).toBeDefined();
    expect(grant!.shares).toBe(10_000);
    expect(grant!.strike).toBeCloseTo(25.5);
  });

  it('understands k shorthand ("145k")', () => {
    const r = parseOfferLetter('Your base salary will be 145k per year. Signing bonus of 20k.');
    expect(r.extracted.base).toBe(145_000);
    expect(r.extracted.signingBonus).toBe(20_000);
  });

  it('parses number-before-label format ("$20,000 signing bonus")', () => {
    const r = parseOfferLetter('This offer includes a $20,000 signing bonus and $8,000 relocation bonus.');
    expect(r.extracted.signingBonus).toBe(20_000);
    expect(r.extracted.relocationBonus).toBe(8_000);
  });

  it('parses relocation assistance', () => {
    const r = parseOfferLetter('Base salary $130,000. We provide relocation assistance of $10,000 to help you move.');
    expect(r.extracted.relocationBonus).toBe(10_000);
    expect(r.unparsed).toContain('signing bonus');
  });

  it('does not confuse bonus numbers with base salary', () => {
    const r = parseOfferLetter(`
      Base salary: $150,000 per year.
      Target bonus: 20% of base salary.
      Signing bonus: $25,000.
    `);
    expect(r.extracted.base).toBe(150_000);
    expect(r.extracted.signingBonus).toBe(25_000);
    expect(r.extracted.targetBonusPercent).toBeCloseTo(0.2);
  });

  it('parses a fixed annual bonus when no percent is given', () => {
    const r = parseOfferLetter('Base salary $140,000. Annual bonus of $15,000 paid each December.');
    expect(r.extracted.targetBonusPercent).toBeNull();
    expect(r.extracted.annualBonusFixed).toBe(15_000);
    expect(r.offer.performanceBonus).toEqual({ kind: 'fixed', value: 15_000, expectedPayout: 1 });
  });

  it('parses dollar-valued RSU grants ("$120,000 in RSUs")', () => {
    const r = parseOfferLetter('You will receive $120,000 in RSUs vesting over 4 years.');
    expect(r.extracted.rsuValue).toBe(120_000);
    expect(r.extracted.rsuShares).toBeNull();
    const grant = r.offer.equityGrants[0];
    expect(grant.type).toBe('RSU');
    expect(grant.targetValue).toBe(120_000);
    expect(grant.targetMode).toBe('total');
  });

  it('parses ISO start dates', () => {
    const r = parseOfferLetter('Base salary $100,000. Your start date is 2025-03-01.');
    expect(r.extracted.startDate).toBe('2025-03-01');
  });

  it('parses US numeric start dates near a start-date mention', () => {
    const r = parseOfferLetter('Base salary $100,000. Start date: 08/01/2024.');
    expect(r.extracted.startDate).toBe('2024-08-01');
  });

  it('parses vesting with explicit cliff years', () => {
    const r = parseOfferLetter('Grant of 5,000 RSUs with 4 year vest and 2 year cliff.');
    expect(r.extracted.vestYears).toBe(4);
    expect(r.extracted.cliffMonths).toBe(24);
  });

  it('detects company via "join X" phrasing', () => {
    const r = parseOfferLetter('We are thrilled to have you join Anduril as a software engineer. Base salary $170,000.');
    expect(r.extracted.company).toBe('Anduril');
    expect(r.extracted.base).toBe(170_000);
  });

  it('rejects generic phrases as company names', () => {
    const r = parseOfferLetter('We are pleased to offer you the position. Base salary $170,000.');
    expect(r.extracted.company).toBeNull();
    expect(r.unparsed).toContain('company name');
  });

  it('never throws on garbage input and lists everything as unparsed', () => {
    const r = parseOfferLetter('lorem ipsum dolor sit amet !!! ### $$$ asdf 12345');
    expect(r.offer.base.startAnnual).toBe(0);
    expect(r.offer.name).toBe('Pasted Offer');
    expect(r.unparsed).toContain('base salary');
    expect(r.unparsed).toContain('equity grant');
    expect(r.unparsed).toContain('start date');
    expect(r.unparsed).toContain('company name');
  });

  it('never throws on empty, null, or undefined input', () => {
    expect(() => parseOfferLetter('')).not.toThrow();
    expect(() => parseOfferLetter('   \n\t  ')).not.toThrow();
    expect(() => parseOfferLetter(null as unknown as string)).not.toThrow();
    expect(() => parseOfferLetter(undefined as unknown as string)).not.toThrow();
    const r = parseOfferLetter('');
    expect(r.unparsed.length).toBeGreaterThan(0);
  });

  it('never throws on very long input (truncates safely)', () => {
    const big = 'Base salary $150,000. ' + 'x'.repeat(500_000);
    const r = parseOfferLetter(big);
    expect(r.extracted.base).toBe(150_000);
  });

  it('buildOfferFromFields honors user edits', () => {
    const r = parseOfferLetter(FULL_LETTER);
    const edited = buildOfferFromFields({ ...r.extracted, base: 180_000, company: 'EditedCo' });
    expect(edited.base.startAnnual).toBe(180_000);
    expect(edited.name).toBe('EditedCo');
    // untouched fields survive
    expect(edited.signingBonuses).toEqual([{ amount: 25_000, payDate: '2024-08-01' }]);
  });

  it('flags vesting schedule as unparsed when absent', () => {
    const r = parseOfferLetter('Base salary $150,000. Signing bonus $10,000.');
    expect(r.unparsed).toContain('vesting schedule');
    expect(r.unparsed).toContain('equity grant');
    expect(r.unparsed).not.toContain('base salary');
  });
});
