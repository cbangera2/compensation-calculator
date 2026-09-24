import { describe, expect, it, vi, afterEach } from "vitest";
import { crossoverLine, horizonTotalWithGrowth } from "@/components/DecisionHelpers";
import { sharedPayForOfferPick } from "@/components/CityComparePanel";
import { deriveEquityKind, equityKindEdits } from "@/components/MultiOfferBar";
import { isExplicitLocationEdit } from "@/components/OfferForm";
import { growthRatesVary } from "@/components/SimpleGrowthInput";
import { fetchYahooMonthly, fetchStooqMonthly } from "@/lib/market";
import { anonymizeOffer } from "@/lib/share";
import { computeOffer } from "@/core/compute";
import { yoyFromCagr } from "@/core/growth";
import type { ExtractedOfferFields } from "@/lib/offerLetterImport";
import type { TOffer } from "@/models/types";

function testOffer(partial: Partial<TOffer> = {}): TOffer {
  return {
    name: "Test",
    currency: "USD",
    startDate: "2025-01-01",
    base: { startAnnual: 100_000 },
    raises: [],
    signingBonuses: [],
    relocationBonuses: [],
    benefits: [],
    miscRecurring: [],
    equityGrants: [],
    growth: { yoy: [0, 0, 0, 0] },
    assumptions: { horizonYears: 4, colAdjust: 1 },
    ...partial,
  } as unknown as TOffer;
}

const STANDARD_VEST = {
  model: "standard",
  years: 4,
  cliffMonths: 12,
  frequency: "monthly",
  distribution: "even",
  cliffPercent: 0,
} as const;

describe("sharedPayForOfferPick (city compare)", () => {
  it("returns null for a 'to' pick so the from-city pay is never clobbered", () => {
    expect(sharedPayForOfferPick(testOffer(), "to")).toBeNull();
  });

  it("returns the rounded Year 1 total for a 'from' pick", () => {
    const offer = testOffer();
    const expected = Math.max(0, Math.round(computeOffer(offer)[0]?.total ?? 0));
    expect(expected).toBeGreaterThan(0);
    expect(sharedPayForOfferPick(offer, "from")).toBe(expected);
  });
});

describe("horizonTotalWithGrowth (sensitivity scan)", () => {
  it("keeps the per-grant FMV fallback instead of a hardcoded $100", () => {
    const offer = testOffer({
      growth: { yoy: [0.1, 0.1, 0.1, 0.1] }, // no startingPrice
      equityGrants: [
        {
          type: "RSU",
          shares: 400,
          fmv: 20,
          vesting: { ...STANDARD_VEST },
          grantStartDate: "2025-01-01",
        },
      ],
    });
    // Priced at the $20 FMV fallback:
    const expected = computeOffer({
      ...offer,
      growth: { ...offer.growth, yoy: yoyFromCagr(0.1, 4) },
    }).reduce((s, r) => s + r.total, 0);
    expect(horizonTotalWithGrowth(offer, 0.1)).toBeCloseTo(expected, 6);
    // The old bug priced the same shares at $100 (5x inflation):
    const buggy = computeOffer({
      ...offer,
      growth: { startingPrice: 100, yoy: yoyFromCagr(0.1, 4) },
    }).reduce((s, r) => s + r.total, 0);
    expect(Math.abs(horizonTotalWithGrowth(offer, 0.1) - buggy)).toBeGreaterThan(1_000);
  });
});

describe("crossoverLine final-leader takeover", () => {
  it("reports the takeover year when A wins but trailed in year 1", () => {
    // A trails year 1 (90k < 100k) but wins 300k to 290k over 2 years.
    const line = crossoverLine("Alpha", "Beta", [90_000, 300_000], [100_000, 290_000]);
    expect(line).toContain("Alpha");
    expect(line).toContain("pulls ahead in year 2");
    expect(line).not.toMatch(/\$-/);
  });

  it("still reports every-year leadership when the winner never trailed", () => {
    const line = crossoverLine("Alpha", "Beta", [100_000, 210_000], [90_000, 201_000]);
    expect(line).toContain("stays ahead every year");
  });
});

const emptyFields: ExtractedOfferFields = {
  company: null,
  base: null,
  signingBonus: null,
  relocationBonus: null,
  targetBonusPercent: null,
  annualBonusFixed: null,
  rsuShares: null,
  rsuValue: null,
  optionShares: null,
  strikePrice: null,
  vestYears: null,
  cliffMonths: null,
  startDate: null,
  location: null,
};

describe("equity kind select (offer letter import)", () => {
  it("derives 'none' when all equity fields are null", () => {
    expect(deriveEquityKind(null)).toBe("none");
    expect(deriveEquityKind(emptyFields)).toBe("none");
  });

  it("seeds RSU with a non-null value so the select can leave 'none'", () => {
    const edits = equityKindEdits(emptyFields, "rsu");
    expect(edits.rsuShares).not.toBeNull();
    expect(deriveEquityKind({ ...emptyFields, ...edits })).toBe("rsu");
  });

  it("seeds option with a non-null value so the select can leave 'none'", () => {
    const edits = equityKindEdits(emptyFields, "option");
    expect(edits.optionShares).not.toBeNull();
    expect(deriveEquityKind({ ...emptyFields, ...edits })).toBe("option");
  });

  it("preserves parsed values when reseeding", () => {
    expect(equityKindEdits({ ...emptyFields, rsuShares: 250 }, "rsu").rsuShares).toBe(250);
    expect(equityKindEdits({ ...emptyFields, optionShares: 500 }, "option").optionShares).toBe(500);
  });

  it("clears everything for 'none'", () => {
    const edits = equityKindEdits({ ...emptyFields, rsuShares: 250 }, "none");
    expect(deriveEquityKind({ ...emptyFields, ...edits })).toBe("none");
  });
});

describe("isExplicitLocationEdit (COL auto-suggest gate)", () => {
  it("is false on mount (no previous state)", () => {
    expect(isExplicitLocationEdit(null, 0, "Austin")).toBe(false);
  });

  it("is false when switching offers", () => {
    expect(
      isExplicitLocationEdit({ index: 0, location: "Austin" }, 1, "Seattle")
    ).toBe(false);
  });

  it("is false when nothing changed (e.g. undo restoring the factor)", () => {
    expect(
      isExplicitLocationEdit({ index: 0, location: "Austin" }, 0, "Austin")
    ).toBe(false);
  });

  it("is true for an explicit location edit on the same offer", () => {
    expect(
      isExplicitLocationEdit({ index: 0, location: "Austin" }, 0, "Chicago")
    ).toBe(true);
  });
});

describe("growthRatesVary (simple growth input)", () => {
  it("detects differing yearly rates", () => {
    expect(growthRatesVary([0, 0.4])).toBe(true);
  });

  it("is false for uniform, single, or empty series", () => {
    expect(growthRatesVary([0.1, 0.1, 0.1])).toBe(false);
    expect(growthRatesVary([0.2])).toBe(false);
    expect(growthRatesVary([])).toBe(false);
  });
});

describe("market fetch timeouts", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("passes a bounded abort signal to both upstream fetches", async () => {
    const seen: unknown[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, init: { signal?: unknown }) => {
        seen.push(init?.signal);
        throw new Error("boom");
      })
    );
    await expect(fetchYahooMonthly("META")).rejects.toThrow("boom");
    await expect(fetchStooqMonthly("META")).rejects.toThrow("boom");
    expect(seen).toHaveLength(2);
    for (const signal of seen) {
      expect(signal).toBeInstanceOf(AbortSignal);
    }
  });
});

describe("anonymizeOffer sig-fig rounding", () => {
  it("keeps small per-share prices and sub-billion valuations meaningful", () => {
    const offer = testOffer({
      equityGrants: [
        {
          type: "ISO",
          shares: 1_000,
          strike: 0.4,
          fmv: 0.35,
          vesting: { ...STANDARD_VEST },
          grantStartDate: "2025-01-01",
        },
      ],
      startupEquity: {
        enabled: true,
        companyName: "Acme",
        valuation: 1_600_000_000,
        fullyDilutedShares: 80_000_000,
        optionGrants: [],
        rsuGrants: [],
      },
    });
    const anon = anonymizeOffer(offer, 0);
    expect(anon.equityGrants[0].strike).toBe(0.4);
    expect(anon.equityGrants[0].fmv).toBe(0.35);
    expect(anon.startupEquity?.valuation).toBe(1_600_000_000);
  });

  it("still coarsens large values to 2 significant figures", () => {
    const offer = testOffer({
      equityGrants: [
        {
          type: "ISO",
          shares: 1_000,
          strike: 42.5,
          fmv: 55.0,
          vesting: { ...STANDARD_VEST },
          grantStartDate: "2025-01-01",
        },
      ],
      startupEquity: {
        enabled: true,
        companyName: "Acme",
        valuation: 12_345_000_000,
        fullyDilutedShares: 80_000_000,
        optionGrants: [],
        rsuGrants: [],
      },
    });
    const anon = anonymizeOffer(offer, 0);
    expect(anon.equityGrants[0].strike).toBe(43);
    expect(anon.equityGrants[0].fmv).toBe(55);
    expect(anon.startupEquity?.valuation).toBe(12_000_000_000);
  });
});
