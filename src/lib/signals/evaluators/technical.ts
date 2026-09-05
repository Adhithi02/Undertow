import { SignalEvaluator, ThesisChange, ThesisSnapshot } from "../types";

export const TECHNICAL_MEANINGFUL = 5;
export const TECHNICAL_SEVERITY_2 = 10;
export const TECHNICAL_SEVERITY_3 = 15;

export class TechnicalEvaluator implements SignalEvaluator {
  readonly type = "technical";

  evaluate(prev: ThesisSnapshot | null, curr: ThesisSnapshot): ThesisChange[] {
    const currScore = curr.signals.technicalScore as number | undefined;
    if (currScore === undefined) return [];

    if (!prev) {
      return [{
        type: this.type,
        direction: currScore > 0 ? "positive" : currScore < 0 ? "negative" : "neutral",
        severity: Math.abs(currScore) >= TECHNICAL_SEVERITY_2 ? 2 : 1,
        summary: `Technical score is ${currScore}, a modeled momentum reading that establishes the baseline — not a thesis by itself.`,
        isFirstVisit: true,
      }];
    }

    const prevScore = prev.signals.technicalScore as number | undefined;
    if (prevScore === undefined || currScore === prevScore) return [];
    const delta = currScore - prevScore;
    if (Math.abs(delta) < TECHNICAL_MEANINGFUL) return [];
    const impact = delta > 0
      ? "Modeled price action is less of a headwind if you are already in the name."
      : "Weaker modeled tape can force a tighter stop even when the fundamental case is unchanged.";

    return [{
      type: this.type,
      direction: delta > 0 ? "positive" : "negative",
      severity: Math.abs(delta) >= TECHNICAL_SEVERITY_3 ? 3 : Math.abs(delta) >= TECHNICAL_SEVERITY_2 ? 2 : 1,
      summary: `Technical score ${delta > 0 ? "strengthened" : "weakened"} by ${Math.abs(delta)} points, indicating ${delta > 0 ? "stronger" : "weaker"} modeled technical momentum. ${impact}`,
      isFirstVisit: false,
    }];
  }
}
