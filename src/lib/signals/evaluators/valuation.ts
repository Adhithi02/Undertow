import { SignalEvaluator, ThesisChange, ThesisSnapshot } from "../types";

export class ValuationEvaluator implements SignalEvaluator {
  readonly type = "valuation";

  evaluate(prev: ThesisSnapshot | null, curr: ThesisSnapshot): ThesisChange[] {
    const currPe = curr.signals.peRatio as number | undefined;
    if (currPe === undefined) return [];

    if (!prev) {
      return [{
        type: this.type,
        direction: currPe < 0 ? "positive" : currPe > 0 ? "negative" : "neutral",
        severity: currPe >= 30 ? 2 : 1,
        summary: `Current P/E ratio is ${currPe}`,
        isFirstVisit: true,
      }];
    }

    const prevPe = prev.signals.peRatio as number | undefined;
    if (prevPe === undefined || currPe === prevPe) return [];
    const delta = currPe - prevPe;
    if (Math.abs(delta) < 5) return [];

    return [{
      type: this.type,
      direction: delta < 0 ? "positive" : "negative",
      severity: Math.abs(delta) >= 15 ? 3 : Math.abs(delta) >= 10 ? 2 : 1,
      summary: `P/E ratio shifted by ${delta > 0 ? "+" : ""}${delta}`,
      isFirstVisit: false,
    }];
  }
}