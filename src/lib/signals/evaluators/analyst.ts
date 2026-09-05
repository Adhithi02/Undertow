import { SignalEvaluator, ThesisChange, ThesisSnapshot } from "../types";

export class AnalystEvaluator implements SignalEvaluator {
  readonly type = "analyst";

  evaluate(prev: ThesisSnapshot | null, curr: ThesisSnapshot): ThesisChange[] {
    const currScore = curr.signals.analystScore as number | undefined;
    if (currScore === undefined) return [];

    if (!prev) {
      return [{
        type: this.type,
        direction: currScore > 0 ? "positive" : currScore < 0 ? "negative" : "neutral",
        severity: Math.abs(currScore) >= 10 ? 2 : 1,
        summary: `Current analyst score is ${currScore}`,
        isFirstVisit: true,
      }];
    }

    const prevScore = prev.signals.analystScore as number | undefined;
    if (prevScore === undefined || currScore === prevScore) return [];
    const delta = currScore - prevScore;
    if (Math.abs(delta) < 5) return [];

    return [{
      type: this.type,
      direction: delta > 0 ? "positive" : "negative",
      severity: Math.abs(delta) >= 15 ? 3 : Math.abs(delta) >= 10 ? 2 : 1,
      summary: `Analyst score shifted by ${delta > 0 ? "+" : ""}${delta}`,
      isFirstVisit: false,
    }];
  }
}