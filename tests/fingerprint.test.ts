import { describe, expect, it } from "vitest";
import { calculateThesisFingerprint } from "@/lib/fingerprint";
import { ThesisSnapshot } from "@/lib/signals/types";

const values = { epsSurprise: 4, analystScore: 5, institutionalOwnership: 2, riskScore: 3, peRatio: 28, technicalScore: 5 };
function snapshot(overrides: Record<string, unknown> = {}, day = 1): ThesisSnapshot {
  return { symbol: "AAPL", fetchedAt: new Date(`2026-09-0${day}T00:00:00.000Z`), signals: { ...values, ...overrides } };
}

describe("calculateThesisFingerprint", () => {
  const history = [snapshot({ epsSurprise: 2, analystScore: 4, peRatio: 26 }, 1), snapshot({ epsSurprise: 6, analystScore: 6, peRatio: 30 }, 2)];

  it("classifies an identical historical profile as normal", () => {
    const result = calculateThesisFingerprint(history, snapshot({ epsSurprise: 4, analystScore: 5, peRatio: 28 }, 3));
    expect(result.status).toBe("normal");
    expect(result.unusualness).toBe(0);
  });

  it("keeps a small single-dimension move below the unusual classification", () => {
    const result = calculateThesisFingerprint(history, snapshot({ epsSurprise: 7, analystScore: 5, peRatio: 28 }, 3));
    expect(result.status).not.toBe("unusual");
    expect(result.unusualness).toBeGreaterThan(0);
  });

  it("detects a large multidimensional departure and attributes it", () => {
    const result = calculateThesisFingerprint(history, snapshot({ epsSurprise: 18, analystScore: -15, institutionalOwnership: 18, riskScore: 18, peRatio: 90, technicalScore: -16 }, 3));
    expect(result.status).toBe("unusual");
    expect(result.unusualness).toBeGreaterThanOrEqual(60);
    expect(result.dimensions.reduce((total, dimension) => total + (dimension.contribution ?? 0), 0)).toBe(100);
  });

  it("bounds unusualness and produces deterministic output", () => {
    const current = snapshot({ epsSurprise: 20, analystScore: -20, institutionalOwnership: 20, riskScore: 20, peRatio: 120, technicalScore: -20 }, 3);
    const once = calculateThesisFingerprint(history, current);
    const twice = calculateThesisFingerprint(history, current);
    expect(once.unusualness).toBeGreaterThanOrEqual(0);
    expect(once.unusualness).toBeLessThanOrEqual(100);
    expect(twice).toEqual(once);
  });

  it("reports insufficient history without manufacturing a score", () => {
    const result = calculateThesisFingerprint([history[0]], snapshot({}, 2));
    expect(result.status).toBe("insufficient");
    expect(result.unusualness).toBeNull();
  });

  it("handles missing or null inputs without NaN values", () => {
    const result = calculateThesisFingerprint(history, snapshot({ riskScore: null }, 3));
    expect(result.status).toBe("insufficient");
    expect(result.currentVector).toBeNull();
    expect(result.dimensions.every(dimension => Number.isFinite(dimension.value))).toBe(true);
  });
});
