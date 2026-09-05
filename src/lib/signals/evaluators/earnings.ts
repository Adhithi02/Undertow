import { SignalEvaluator, ThesisChange, ThesisSnapshot } from "../types";

export class EarningsEvaluator implements SignalEvaluator {
  readonly type = "earnings";

  evaluate(prev: ThesisSnapshot | null, curr: ThesisSnapshot): ThesisChange[] {
    const currEps = curr.signals.epsSurprise as number | undefined;
    if (currEps === undefined) return [];

    if (!prev) {
      return [{
        type: this.type,
        direction: currEps > 0 ? "positive" : currEps < 0 ? "negative" : "neutral",
        severity: Math.abs(currEps) >= 10 ? 2 : 1,
        summary: `Current EPS surprise is ${currEps}%`,
        isFirstVisit: true,
      }];
    }

    const prevEps = prev.signals.epsSurprise as number | undefined;
    if (prevEps === undefined || currEps === prevEps) return [];

    const delta = currEps - prevEps;
    // Hardcoded threshold: < 5% change is not considered "meaningful"
    if (Math.abs(delta) < 5) return [];

    return [{
      type: this.type,
      direction: delta > 0 ? "positive" : "negative",
      severity: Math.abs(delta) >= 15 ? 3 : Math.abs(delta) >= 10 ? 2 : 1,
      summary: `EPS surprise shifted by ${delta > 0 ? "+" : ""}${delta}%`,
      isFirstVisit: false,
    }];
  }
}
