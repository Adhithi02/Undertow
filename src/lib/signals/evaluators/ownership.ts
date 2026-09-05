import { SignalEvaluator, ThesisChange, ThesisSnapshot } from "../types";

export class OwnershipEvaluator implements SignalEvaluator {
  readonly type = "ownership";

  evaluate(prev: ThesisSnapshot | null, curr: ThesisSnapshot): ThesisChange[] {
    const currOwnership = curr.signals.institutionalOwnership as number | undefined;
    if (currOwnership === undefined) return [];

    if (!prev) {
      return [{
        type: this.type,
        direction: currOwnership > 0 ? "positive" : currOwnership < 0 ? "negative" : "neutral",
        severity: Math.abs(currOwnership) >= 10 ? 2 : 1,
        summary: `Current institutional ownership change is ${currOwnership}%`,
        isFirstVisit: true,
      }];
    }

    const prevOwnership = prev.signals.institutionalOwnership as number | undefined;
    if (prevOwnership === undefined || currOwnership === prevOwnership) return [];
    const delta = currOwnership - prevOwnership;
    if (Math.abs(delta) < 5) return [];

    return [{
      type: this.type,
      direction: delta > 0 ? "positive" : "negative",
      severity: Math.abs(delta) >= 15 ? 3 : Math.abs(delta) >= 10 ? 2 : 1,
      summary: `Institutional ownership shifted by ${delta > 0 ? "+" : ""}${delta}%`,
      isFirstVisit: false,
    }];
  }
}