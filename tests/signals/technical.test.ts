import { describe, it, expect } from "vitest";
import { TechnicalEvaluator } from "@/lib/signals/evaluators/technical";
import { ThesisSnapshot } from "@/lib/signals/types";

describe("TechnicalEvaluator", () => {
  const evaluator = new TechnicalEvaluator();
  const createSnapshot = (technicalScore: number | undefined): ThesisSnapshot => ({ symbol: "AAPL", fetchedAt: new Date(), signals: technicalScore !== undefined ? { technicalScore } : {} });

  it("1. handles first visit (prev is null)", () => expect(evaluator.evaluate(null, createSnapshot(12))).toMatchObject([{ type: "technical", direction: "positive", isFirstVisit: true, severity: 2 }]));
  it("2. returns empty when no meaningful change between prev and curr", () => expect(evaluator.evaluate(createSnapshot(10), createSnapshot(12))).toHaveLength(0));
  it("3. detects a positive change", () => expect(evaluator.evaluate(createSnapshot(10), createSnapshot(20))).toMatchObject([{ type: "technical", direction: "positive", isFirstVisit: false, severity: 2 }]));
  it("4. detects a negative change", () => expect(evaluator.evaluate(createSnapshot(20), createSnapshot(2))).toMatchObject([{ type: "technical", direction: "negative", isFirstVisit: false, severity: 3 }]));
});