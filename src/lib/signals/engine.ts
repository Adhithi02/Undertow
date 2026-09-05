import { SignalEvaluator, ThesisChange, ThesisSnapshot } from "./types";

export class ThesisChangeEngine {
  constructor(private evaluators: SignalEvaluator[]) {}

  computeChanges(prev: ThesisSnapshot | null, curr: ThesisSnapshot): ThesisChange[] {
    return this.evaluators.flatMap(evaluator => evaluator.evaluate(prev, curr));
  }
}