import { describe, it, expect } from "vitest";
import { EarningsEvaluator } from "@/lib/signals/evaluators/earnings";
import { ThesisSnapshot } from "@/lib/signals/types";

describe("EarningsEvaluator", () => {
  const evaluator = new EarningsEvaluator();
  
  const createSnapshot = (epsSurprise: number | undefined): ThesisSnapshot => ({
    symbol: "AAPL",
    fetchedAt: new Date(),
    signals: epsSurprise !== undefined ? { epsSurprise } : {},
  });

  it("1. handles first visit (prev is null)", () => {
    const curr = createSnapshot(12);
    const changes = evaluator.evaluate(null, curr);
    expect(changes).toHaveLength(1);
    expect(changes[0]).toMatchObject({
      type: "earnings",
      direction: "positive",
      isFirstVisit: true,
      severity: 2,
    });
  });

  it("2. returns empty when no meaningful change between prev and curr", () => {
    const prev = createSnapshot(10);
    const curr = createSnapshot(12); // delta is 2, threshold is 5
    const changes = evaluator.evaluate(prev, curr);
    expect(changes).toHaveLength(0);
  });

  it("3. detects a positive change", () => {
    const prev = createSnapshot(10);
    const curr = createSnapshot(20); // delta is +10
    const changes = evaluator.evaluate(prev, curr);
    expect(changes).toHaveLength(1);
    expect(changes[0]).toMatchObject({
      type: "earnings",
      direction: "positive",
      isFirstVisit: false,
      severity: 2,
    });
  });

  it("4. detects a negative change", () => {
    const prev = createSnapshot(20);
    const curr = createSnapshot(2); // delta is -18
    const changes = evaluator.evaluate(prev, curr);
    expect(changes).toHaveLength(1);
    expect(changes[0]).toMatchObject({
      type: "earnings",
      direction: "negative",
      isFirstVisit: false,
      severity: 3,
    });
  });
});
