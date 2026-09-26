import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { useMaxCompareOffers } from '@/lib/useIsMobile';
import { MAX_COMPARE_OFFERS } from '@/lib/compare';

// In a non-browser environment (SSR / vitest node) there is no viewport to
// measure, so the hook must fall back to the default cap — and it must match
// the server HTML to avoid a hydration mismatch.
describe('useMaxCompareOffers', () => {
  it('falls back to MAX_COMPARE_OFFERS without a window', () => {
    function Probe() {
      return createElement('span', null, String(useMaxCompareOffers()));
    }
    expect(renderToString(createElement(Probe))).toContain(`<span>${MAX_COMPARE_OFFERS}</span>`);
  });
});
