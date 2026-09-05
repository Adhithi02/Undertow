import { SignalEvaluator, ThesisChange, ThesisSnapshot } from "../types";

export class RiskEvaluator implements SignalEvaluator {
  readonly type = "risk";

  evaluate(prev: ThesisSnapshot | null, curr: ThesisSnapshot): ThesisChange[] {
    const currRisk = curr.signals.riskScore as number | undefined;
    if (currRisk === undefined) return [];

    if (!prev) {
      return [{
        type: this.type,
        direction: currRisk < 0 ? "positive" : currRisk > 0 ? "negative" : "neutral",
        severity: Math.abs(currRisk) >= 10 ? 2 : 1,
        summary: `Current risk score is ${currRisk}`,
        isFirstVisit: true,
      }];
    }

    const prevRisk = prev.signals.riskScore as number | undefined;
    if (prevRisk === undefined || currRisk === prevRisk) return [];
    const delta = currRisk - prevRisk;
    if (Math.abs(delta) < 5) return [];

    return [{
      type: this.type,
      direction: delta < 0 ? "positive" : "negative",
      severity: Math.abs(delta) >= 15 ? 3 : Math.abs(delta) >= 10 ? 2 : 1,
      summary: `Risk score shifted by ${delta > 0 ? "+" : ""}${delta}`,
      isFirstVisit: false,
    }];
  }
}