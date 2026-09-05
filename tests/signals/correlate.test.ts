import { describe, expect, it } from "vitest";
import { correlateAndDecay } from "@/lib/signals/correlate";
import { ThesisChange } from "@/lib/signals/types";

const change = (type: ThesisChange["type"], direction: ThesisChange["direction"], severity: ThesisChange["severity"]): ThesisChange => ({
  type, direction, severity, summary: type, isFirstVisit: false,
});

describe("correlateAndDecay", () => {
  const detectedAt = new Date("2026-01-01T00:00:00.000Z");

  it("keeps a single fresh change unchanged and non-compounding", () => {
    const result = correlateAndDecay([change("earnings", "positive", 2)], detectedAt, detectedAt);
    expect(result[0]).toMatchObject({ severity: 2, rawSeverity: 2, compounding: false, ageHours: 0 });
  });

  it("compounds different non-neutral signal types within the window", () => {
    const result = correlateAndDecay([
      change("earnings", "positive", 1),
      change("analyst", "negative", 2),
    ], detectedAt, new Date("2026-01-02T00:00:00.000Z"));
    expect(result).toMatchObject([
      { compounding: true, severity: 2 },
      { compounding: true, severity: 3 },
    ]);
  });

  it("decays old severity but never below one", () => {
    const result = correlateAndDecay([change("earnings", "positive", 3)], detectedAt, new Date("2026-01-10T00:00:00.000Z"));
    expect(result[0].severity).toBe(1);
    expect(result[0].ageHours).toBe(216);
  });

  it("does not compound neutral changes", () => {
    const result = correlateAndDecay([
      change("earnings", "neutral", 2),
      change("analyst", "neutral", 3),
    ], detectedAt, detectedAt);
    expect(result.every(item => !item.compounding)).toBe(true);
    expect(result.map(item => item.severity)).toEqual([2, 3]);
  });
});