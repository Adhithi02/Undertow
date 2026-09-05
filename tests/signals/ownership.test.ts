import { describe, it, expect } from "vitest";
import { OwnershipEvaluator } from "@/lib/signals/evaluators/ownership";
import { ThesisSnapshot } from "@/lib/signals/types";

describe("OwnershipEvaluator", () => {
  const evaluator = new OwnershipEvaluator();
  const createSnapshot = (institutionalOwnership: number | undefined): ThesisSnapshot => ({ symbol: "AAPL", fetchedAt: new Date(), signals: institutionalOwnership !== undefined ? { institutionalOwnership } : {} });

  it("1. handles first visit (prev is null)", () => expect(evaluator.evaluate(null, createSnapshot(12))).toMatchObject([{ type: "ownership", direction: "positive", isFirstVisit: true, severity: 2 }]));
  it("2. returns empty when no meaningful change between prev and curr", () => expect(evaluator.evaluate(createSnapshot(10), createSnapshot(12))).toHaveLength(0));
  it("3. detects a positive change", () => expect(evaluator.evaluate(createSnapshot(10), createSnapshot(20))).toMatchObject([{ type: "ownership", direction: "positive", isFirstVisit: false, severity: 2 }]));
  it("4. detects a negative change", () => expect(evaluator.evaluate(createSnapshot(20), createSnapshot(2))).toMatchObject([{ type: "ownership", direction: "negative", isFirstVisit: false, severity: 3 }]));
});