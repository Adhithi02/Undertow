import { SignalEvaluator, ThesisChange, ThesisSnapshot } from "../types";

export const VALUATION_MEANINGFUL = 5;
export const VALUATION_SEVERITY_2 = 10;
export const VALUATION_SEVERITY_3 = 15;

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
        summary: `P/E is ${currPe} relative to the modeled valuation baseline. Stretch versus that baseline is the first thing a holder pays for.`,
        isFirstVisit: true,
      }];
    }

    const prevPe = prev.signals.peRatio as number | undefined;
    if (prevPe === undefined || currPe === prevPe) return [];
    const delta = currPe - prevPe;
    if (Math.abs(delta) < VALUATION_MEANINGFUL) return [];
    const impact = delta > 0
      ? "increasing downside sensitivity if expected growth does not materialize."
      : "giving more room if the story takes longer than hoped.";

    return [{
      type: this.type,
      direction: delta < 0 ? "positive" : "negative",
      severity: Math.abs(delta) >= VALUATION_SEVERITY_3 ? 3 : Math.abs(delta) >= VALUATION_SEVERITY_2 ? 2 : 1,
      summary: `P/E ${delta > 0 ? "increased" : "decreased"} materially relative to the modeled valuation baseline, ${impact}`,
      isFirstVisit: false,
    }];
  }
}
