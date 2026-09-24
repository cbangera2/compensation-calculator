import { describe, expect, it } from "vitest";
import { crossoverLine } from "@/components/DecisionHelpers";
import { resolveLocationPresetKey } from "@/components/OfferForm";

describe("crossoverLine", () => {
  it("never renders a negative dollar sign when A leads", () => {
    // A ends $9k ahead of B (gap negative from B's perspective)
    const line = crossoverLine("Alpha", "Beta", [100_000, 210_000], [90_000, 201_000]);
    expect(line).toContain("Alpha");
    expect(line).toContain("ahead");
    expect(line).not.toMatch(/\$-/);
  });

  it("never renders a negative dollar sign when B leads", () => {
    const line = crossoverLine("Alpha", "Beta", [90_000, 201_000], [100_000, 210_000]);
    expect(line).toContain("Beta");
    expect(line).toContain("ahead");
    expect(line).not.toMatch(/\$-/);
  });

  it("reports dead even when the gap is ~zero", () => {
    const line = crossoverLine("Alpha", "Beta", [100_000], [100_000]);
    expect(line).toMatch(/dead even/i);
  });
});

describe("resolveLocationPresetKey", () => {
  it("prefers the exact name over a shared factor (Austin vs Chicago)", () => {
    // Both Chicago and Austin are 1.05; Chicago sorts first.
    expect(resolveLocationPresetKey("Austin, TX", 1.05)).toBe("aus");
    expect(resolveLocationPresetKey("Chicago, IL", 1.05)).toBe("chi");
  });

  it("prefers the exact name over a shared factor (Remote vs Phoenix)", () => {
    // Both Phoenix and Remote are 0.95; Phoenix sorts first.
    expect(resolveLocationPresetKey("Remote (US avg)", 0.95)).toBe("remote");
    expect(resolveLocationPresetKey("Phoenix, AZ", 0.95)).toBe("phx");
  });

  it("falls back to a factor match when the name is unknown", () => {
    expect(resolveLocationPresetKey("Somewhere, XX", 1.4)).toBe("sf");
  });

  it("falls back to custom when nothing matches", () => {
    expect(resolveLocationPresetKey("Somewhere, XX", 2.5)).toBe("custom");
    expect(resolveLocationPresetKey(undefined, undefined)).toBe("custom");
  });
});
