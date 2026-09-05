import { SignalEvaluator, ThesisChange, ThesisSnapshot } from "../types";

export const OWNERSHIP_MEANINGFUL = 5;
export const OWNERSHIP_SEVERITY_2 = 10;
export const OWNERSHIP_SEVERITY_3 = 15;

export class OwnershipEvaluator implements SignalEvaluator {
  readonly type = "ownership";

  evaluate(prev: ThesisSnapshot | null, curr: ThesisSnapshot): ThesisChange[] {
    const currOwnership = curr.signals.institutionalOwnership as number | undefined;
    if (currOwnership === undefined) return [];

    if (!prev) {
      return [{
        type: this.type,
        direction: currOwnership > 0 ? "positive" : currOwnership < 0 ? "negative" : "neutral",
        severity: Math.abs(currOwnership) >= OWNERSHIP_SEVERITY_2 ? 2 : 1,
        summary: `Institutional ownership change is ${currOwnership}%, a modeled sponsorship reading that establishes the baseline.`,
        isFirstVisit: true,
      }];
    }

    const prevOwnership = prev.signals.institutionalOwnership as number | undefined;
    if (prevOwnership === undefined || currOwnership === prevOwnership) return [];
    const delta = currOwnership - prevOwnership;
    if (Math.abs(delta) < OWNERSHIP_MEANINGFUL) return [];
    const impact = delta > 0
      ? "Deeper modeled institutional books can steady the tape, but crowded holders also exit together."
      : "Thinning modeled sponsorship can leave a name more sensitive to the next piece of news.";

    return [{
      type: this.type,
      direction: delta > 0 ? "positive" : "negative",
      severity: Math.abs(delta) >= OWNERSHIP_SEVERITY_3 ? 3 : Math.abs(delta) >= OWNERSHIP_SEVERITY_2 ? 2 : 1,
      summary: `Institutional ownership ${delta > 0 ? "increased" : "declined"} by ${Math.abs(delta)} points, indicating a modeled ${delta > 0 ? "increase" : "decrease"} in institutional sponsorship. ${impact}`,
      isFirstVisit: false,
    }];
  }
}
