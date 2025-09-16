import { describe, it, expect } from 'vitest';
import { parseLevelsOfferFromHtml } from '@/lib/levelsImport';

describe('parseLevelsOfferFromHtml - bonus parsing', () => {
  it('parses fixed Average Annual Bonuses as a fixed performance bonus', () => {
    const html = `
      <html><body>
        <div>Average Annual Bonuses $18,750</div>
      </body></html>
    `;
  const offer = parseLevelsOfferFromHtml(html);
  expect(offer.performanceBonus).toBeDefined();
  const pb = offer.performanceBonus!;
  expect(pb.kind).toBe('fixed');
  expect(pb.value).toBe(18750);
  expect(pb.expectedPayout).toBe(1);
  });

  it('supports number suffixes like k in Average Annual Bonuses', () => {
    const html = `
      <html><body>
        <span>Average Annual Bonuses $18.75k</span>
      </body></html>
    `;
  const offer = parseLevelsOfferFromHtml(html);
  expect(offer.performanceBonus).toBeDefined();
  const pb = offer.performanceBonus!;
  expect(pb.kind).toBe('fixed');
  expect(pb.value).toBe(18750);
  });

  it('parses singular label: Average Annual Bonus', () => {
    const html = `
      <div>Average Annual Bonus $12,500</div>
    `;
    const offer = parseLevelsOfferFromHtml(html);
    expect(offer.performanceBonus).toBeDefined();
    const pb = offer.performanceBonus!;
    expect(pb.kind).toBe('fixed');
    expect(pb.value).toBe(12500);
  });

  it('parses variant label: Avg Annual Cash Bonus', () => {
    const html = `
      <div>Avg Annual Cash Bonus $9.2k</div>
    `;
    const offer = parseLevelsOfferFromHtml(html);
    expect(offer.performanceBonus).toBeDefined();
    const pb = offer.performanceBonus!;
    expect(pb.kind).toBe('fixed');
    expect(pb.value).toBe(9200);
  });

  it('parses generic label: Bonus $18,750', () => {
    const html = `
      <div>Bonus</div>
      <p>$18,750</p>
    `;
    const offer = parseLevelsOfferFromHtml(html);
    expect(offer.performanceBonus).toBeDefined();
    const pb = offer.performanceBonus!;
    expect(pb.kind).toBe('fixed');
    expect(pb.value).toBe(18750);
  });

  it('does not mistake Signing Bonus for annual bonus', () => {
    const html = `
      <div>Signing Bonus</div>
      <p>$10,000</p>
    `;
    const offer = parseLevelsOfferFromHtml(html);
    // Should fall back to default percent since no annual bonus present
    expect(offer.performanceBonus).toBeDefined();
    const pb = offer.performanceBonus!;
    expect(pb.kind).toBe('percent');
  });

  it('falls back to percent bonus when fixed average annual bonus not present and JSON has target percent', () => {
    const html = `
      <html><head>
        <script type="application/json">
          {"company":"Acme","baseSalary":120000,"annualTargetBonusPercentage":15,"avgAnnualStockGrantValue":0}
        </script>
      </head><body></body></html>
    `;
  const offer = parseLevelsOfferFromHtml(html);
  expect(offer.performanceBonus).toBeDefined();
  const pb = offer.performanceBonus!;
  expect(pb.kind).toBe('percent');
  // 15% becomes 0.15
  expect(pb.value).toBeCloseTo(0.15, 6);
  });
});
