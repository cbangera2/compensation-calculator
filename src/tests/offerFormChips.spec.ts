import { describe, expect, it } from "vitest";
import {
  matchCompareCity,
  metroForBenchmarkLocation,
} from "@/components/OfferForm";

describe("matchCompareCity", () => {
  it("matches Bay Area variants to the renter Sunnyvale factor", () => {
    for (const loc of [
      "Sunnyvale, CA",
      "San Francisco, CA",
      "Mountain View, CA",
      "Bay Area",
    ]) {
      const c = matchCompareCity(loc);
      expect(c?.key).toBe("renter-sunnyvale");
      expect(c?.colFactor).toBe(1.47);
    }
  });

  it("matches the other renter-model cities", () => {
    expect(matchCompareCity("Ann Arbor, MI")?.key).toBe("renter-ann-arbor");
    expect(matchCompareCity("Detroit, MI")?.key).toBe("renter-ann-arbor");
    expect(matchCompareCity("Washington, DC")?.key).toBe("renter-dc");
  });

  it("matches generic preset cities", () => {
    expect(matchCompareCity("Seattle, WA")?.key).toBe("sea");
    expect(matchCompareCity("New York, NY")?.key).toBe("nyc");
    expect(matchCompareCity("Austin, TX")?.key).toBe("aus");
  });

  it("returns null for empty or unknown locations", () => {
    expect(matchCompareCity(undefined)).toBeNull();
    expect(matchCompareCity("")).toBeNull();
    expect(matchCompareCity("Custom")).toBeNull();
    expect(matchCompareCity("London, UK")).toBeNull();
  });

  it("does not false-positive 'dc' inside other words", () => {
    // \bdc\b should not fire inside e.g. "Adcok"
    expect(matchCompareCity("Adcock, TX")).toBeNull();
  });
});

describe("metroForBenchmarkLocation", () => {
  it("maps common locations to benchmark metros", () => {
    expect(metroForBenchmarkLocation("New York, NY")).toBe("NYC");
    expect(metroForBenchmarkLocation("Seattle, WA")).toBe("Seattle");
    expect(metroForBenchmarkLocation("Austin, TX")).toBe("Austin");
    expect(metroForBenchmarkLocation("Ann Arbor, MI")).toBe("Detroit/Ann Arbor");
    expect(metroForBenchmarkLocation("Washington, DC")).toBe("DC");
  });

  it("defaults to Bay Area for unknown or empty locations", () => {
    expect(metroForBenchmarkLocation("Sunnyvale, CA")).toBe("Bay Area");
    expect(metroForBenchmarkLocation(undefined)).toBe("Bay Area");
    expect(metroForBenchmarkLocation("")).toBe("Bay Area");
  });
});
