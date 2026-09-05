import { SignalEvaluator, ThesisChange, ThesisSnapshot } from "../types";

export const RISK_MEANINGFUL = 5;
export const RISK_SEVERITY_2 = 10;
export const RISK_SEVERITY_3 = 15;

export class RiskEvaluator implements SignalEvaluator {
  readonly type = "risk";

  evaluate(prev: ThesisSnapshot | null, curr: ThesisSnapshot): ThesisChange[] {
    const currRisk = curr.signals.riskScore as number | undefined;
    if (currRisk === undefined) return [];

    if (!prev) {
      return [{
        type: this.type,
        direction: currRisk < 0 ? "positive" : currRisk > 0 ? "negative" : "neutral",
        severity: Math.abs(currRisk) >= RISK_SEVERITY_2 ? 2 : 1,
        summary: `Risk score is ${currRisk}, a modeled reading of overall risk exposure that establishes the baseline.`,
        isFirstVisit: true,
      }];
    }

    const prevRisk = prev.signals.riskScore as number | undefined;
    if (prevRisk === undefined || currRisk === prevRisk) return [];
    const delta = currRisk - prevRisk;
    if (Math.abs(delta) < RISK_MEANINGFUL) return [];
    const impact = delta < 0
      ? "That eases modeled risk overhang and de-risks the position if the core thesis still holds."
      : "That raises modeled risk exposure and leaves less margin if the thesis is slow to play out.";

    return [{
      type: this.type,
      direction: delta < 0 ? "positive" : "negative",
      severity: Math.abs(delta) >= RISK_SEVERITY_3 ? 3 : Math.abs(delta) >= RISK_SEVERITY_2 ? 2 : 1,
      summary: `Risk score ${delta > 0 ? "increased" : "declined"} by ${Math.abs(delta)} points, indicating a modeled ${delta > 0 ? "increase" : "decrease"} in overall risk exposure. ${impact}`,
      isFirstVisit: false,
    }];
  }
}
