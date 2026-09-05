export type ThesisChangeType =
  | "earnings"
  | "analyst"
  | "ownership"
  | "risk"
  | "valuation"
  | "technical";

export type Direction = "positive" | "negative" | "neutral";

export interface ThesisChange {
  type: ThesisChangeType;
  direction: Direction;
  severity: 1 | 2 | 3;
  summary: string;
  isFirstVisit: boolean;
}

export interface ThesisSnapshot {
  symbol: string;
  fetchedAt: Date;
  signals: Record<string, unknown>;
}

export interface SignalEvaluator {
  readonly type: ThesisChangeType;
  evaluate(prev: ThesisSnapshot | null, curr: ThesisSnapshot): ThesisChange[];
}
