import { describe, it, expect } from "vitest";
import { AnalystEvaluator } from "@/lib/signals/evaluators/analyst";
import { ThesisSnapshot } from "@/lib/signals/types";

describe("AnalystEvaluator", () => {
  const evaluator = new AnalystEvaluator();
  const createSnapshot = (analystScore: number | undefined): ThesisSnapshot => ({ symbol: "AAPL", fetchedAt: new Date(), signals: analystScore !== undefined ? { analystScore } : {} });

  it("1. handles first visit (prev is null)", () => expect(evaluator.evaluate(null, createSnapshot(12))).toMatchObject([{ type: "analyst", direction: "positive", isFirstVisit: true, severity: 2 }]));
  it("2. returns empty when no meaningful change between prev and curr", () => expect(evaluator.evaluate(createSnapshot(10), createSnapshot(12))).toHaveLength(0));
  it("3. detects a positive change", () => expect(evaluator.evaluate(createSnapshot(10), createSnapshot(20))).toMatchObject([{ type: "analyst", direction: "positive", isFirstVisit: false, severity: 2 }]));
  it("4. detects a negative change", () => expect(evaluator.evaluate(createSnapshot(20), createSnapshot(2))).toMatchObject([{ type: "analyst", direction: "negative", isFirstVisit: false, severity: 3 }]));
});