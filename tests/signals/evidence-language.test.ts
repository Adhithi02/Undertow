import { describe, expect, it } from "vitest";
import { AnalystEvaluator } from "@/lib/signals/evaluators/analyst";
import { EarningsEvaluator } from "@/lib/signals/evaluators/earnings";
import { OwnershipEvaluator } from "@/lib/signals/evaluators/ownership";
import { RiskEvaluator } from "@/lib/signals/evaluators/risk";
import { TechnicalEvaluator } from "@/lib/signals/evaluators/technical";
import { ValuationEvaluator } from "@/lib/signals/evaluators/valuation";
import { ThesisSnapshot } from "@/lib/signals/types";

const forbidden = /RSI|litigation|insider|buy\/hold\/sell|buy, hold, and sell|Street consensus|versus consensus/i;

function snapshot(signals: Record<string, number>): ThesisSnapshot {
  return { symbol: "AAPL", fetchedAt: new Date(), signals };
}

describe("evaluator evidence language", () => {
  const cases = [
    [new AnalystEvaluator(), snapshot({ analystScore: 10 }), snapshot({ analystScore: 2 })],
    [new EarningsEvaluator(), snapshot({ epsSurprise: 10 }), snapshot({ epsSurprise: 2 })],
    [new OwnershipEvaluator(), snapshot({ institutionalOwnership: 10 }), snapshot({ institutionalOwnership: 2 })],
    [new RiskEvaluator(), snapshot({ riskScore: 2 }), snapshot({ riskScore: 18 })],
    [new TechnicalEvaluator(), snapshot({ technicalScore: 10 }), snapshot({ technicalScore: 2 })],
    [new ValuationEvaluator(), snapshot({ peRatio: 20 }), snapshot({ peRatio: 36 })],
  ] as const;

  it("phrases first-visit and delta summaries as modeled readings from existing snapshot fields", () => {
    for (const [evaluator, prev, curr] of cases) {
      const first = evaluator.evaluate(null, curr);
      const delta = evaluator.evaluate(prev, curr);
      expect(first[0]?.summary, evaluator.type).toMatch(/model/i);
      expect(delta[0]?.summary, evaluator.type).toMatch(/model/i);
      expect(first[0]?.isFirstVisit, evaluator.type).toBe(true);
      expect(first[0]?.summary, evaluator.type).not.toMatch(/since (your )?last visit/i);
      expect(first[0]?.summary, evaluator.type).not.toMatch(forbidden);
      expect(delta[0]?.summary, evaluator.type).not.toMatch(forbidden);
    }
  });
});
