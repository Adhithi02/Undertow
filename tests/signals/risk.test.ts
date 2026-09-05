import { describe, it, expect } from "vitest";
import { RiskEvaluator } from "@/lib/signals/evaluators/risk";
import { ThesisSnapshot } from "@/lib/signals/types";

describe("RiskEvaluator", () => {
  const evaluator = new RiskEvaluator();
  const createSnapshot = (riskScore: number | undefined): ThesisSnapshot => ({ symbol: "AAPL", fetchedAt: new Date(), signals: riskScore !== undefined ? { riskScore } : {} });

  it("1. handles first visit (prev is null)", () => expect(evaluator.evaluate(null, createSnapshot(12))).toMatchObject([{ type: "risk", direction: "negative", isFirstVisit: true, severity: 2 }]));
  it("2. returns empty when no meaningful change between prev and curr", () => expect(evaluator.evaluate(createSnapshot(10), createSnapshot(12))).toHaveLength(0));
  it("3. detects a positive change", () => expect(evaluator.evaluate(createSnapshot(20), createSnapshot(10))).toMatchObject([{ type: "risk", direction: "positive", isFirstVisit: false, severity: 2 }]));
  it("4. detects a negative change", () => expect(evaluator.evaluate(createSnapshot(2), createSnapshot(20))).toMatchObject([{ type: "risk", direction: "negative", isFirstVisit: false, severity: 3 }]));
});