import { SignalEvaluator, ThesisChange, ThesisSnapshot } from "../types";

export const ANALYST_MEANINGFUL = 5;
export const ANALYST_SEVERITY_2 = 10;
export const ANALYST_SEVERITY_3 = 15;

export class AnalystEvaluator implements SignalEvaluator {
  readonly type = "analyst";

  evaluate(prev: ThesisSnapshot | null, curr: ThesisSnapshot): ThesisChange[] {
    const currScore = curr.signals.analystScore as number | undefined;
    if (currScore === undefined) return [];

    if (!prev) {
      return [{
        type: this.type,
        direction: currScore > 0 ? "positive" : currScore < 0 ? "negative" : "neutral",
        severity: Math.abs(currScore) >= ANALYST_SEVERITY_2 ? 2 : 1,
        summary: `Analyst sentiment score is ${currScore}, a modeled reading of current sentiment that establishes the baseline.`,
        isFirstVisit: true,
      }];
    }

    const prevScore = prev.signals.analystScore as number | undefined;
    if (prevScore === undefined || currScore === prevScore) return [];
    const delta = currScore - prevScore;
    if (Math.abs(delta) < ANALYST_MEANINGFUL) return [];
    const impact = delta > 0
      ? "That is easier to lean on as modeled sponsorship, though the move can already be reflected in price."
      : "Modeled coverage is less of a tailwind if you still need sentiment on side.";

    return [{
      type: this.type,
      direction: delta > 0 ? "positive" : "negative",
      severity: Math.abs(delta) >= ANALYST_SEVERITY_3 ? 3 : Math.abs(delta) >= ANALYST_SEVERITY_2 ? 2 : 1,
      summary: `Analyst sentiment score ${delta > 0 ? "increased" : "declined"} by ${Math.abs(delta)} points, indicating a modeled ${delta > 0 ? "strengthening" : "weakening"} in sentiment. ${impact}`,
      isFirstVisit: false,
    }];
  }
}
