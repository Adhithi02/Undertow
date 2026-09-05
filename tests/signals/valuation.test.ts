import { describe, it, expect } from "vitest";
import { ValuationEvaluator } from "@/lib/signals/evaluators/valuation";
import { ThesisSnapshot } from "@/lib/signals/types";

describe("ValuationEvaluator", () => {
  const evaluator = new ValuationEvaluator();
  const createSnapshot = (peRatio: number | undefined): ThesisSnapshot => ({ symbol: "AAPL", fetchedAt: new Date(), signals: peRatio !== undefined ? { peRatio } : {} });

  it("1. handles first visit (prev is null)", () => expect(evaluator.evaluate(null, createSnapshot(32))).toMatchObject([{ type: "valuation", direction: "negative", isFirstVisit: true, severity: 2 }]));
  it("2. returns empty when no meaningful change between prev and curr", () => expect(evaluator.evaluate(createSnapshot(10), createSnapshot(12))).toHaveLength(0));
  it("3. detects a positive change", () => expect(evaluator.evaluate(createSnapshot(20), createSnapshot(10))).toMatchObject([{ type: "valuation", direction: "positive", isFirstVisit: false, severity: 2 }]));
  it("4. detects a negative change", () => expect(evaluator.evaluate(createSnapshot(2), createSnapshot(20))).toMatchObject([{ type: "valuation", direction: "negative", isFirstVisit: false, severity: 3 }]));
});