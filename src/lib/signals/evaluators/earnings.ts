import { SignalEvaluator, ThesisChange, ThesisSnapshot } from "../types";

export const EARNINGS_MEANINGFUL = 5;
export const EARNINGS_SEVERITY_2 = 10;
export const EARNINGS_SEVERITY_3 = 15;

export class EarningsEvaluator implements SignalEvaluator {
  readonly type = "earnings";

  evaluate(prev: ThesisSnapshot | null, curr: ThesisSnapshot): ThesisChange[] {
    const currEps = curr.signals.epsSurprise as number | undefined;
    if (currEps === undefined) return [];

    if (!prev) {
      return [{
        type: this.type,
        direction: currEps > 0 ? "positive" : currEps < 0 ? "negative" : "neutral",
        severity: Math.abs(currEps) >= EARNINGS_SEVERITY_2 ? 2 : 1,
        summary: `EPS surprise is ${currEps}%, a modeled earnings-surprise reading that establishes the baseline.`,
        isFirstVisit: true,
      }];
    }

    const prevEps = prev.signals.epsSurprise as number | undefined;
    if (prevEps === undefined || currEps === prevEps) return [];

    const delta = currEps - prevEps;
    if (Math.abs(delta) < EARNINGS_MEANINGFUL) return [];
    const impact = delta > 0
      ? "Holders have more cover if the growth case is still forming."
      : "There is less room if the next modeled print also disappoints.";

    return [{
      type: this.type,
      direction: delta > 0 ? "positive" : "negative",
      severity: Math.abs(delta) >= EARNINGS_SEVERITY_3 ? 3 : Math.abs(delta) >= EARNINGS_SEVERITY_2 ? 2 : 1,
      summary: `EPS surprise ${delta > 0 ? "increased" : "declined"} by ${Math.abs(delta)} points, indicating a modeled ${delta > 0 ? "improvement" : "weakening"} in earnings surprise. ${impact}`,
      isFirstVisit: false,
    }];
  }
}
