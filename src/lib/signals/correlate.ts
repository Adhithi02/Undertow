import { ThesisChange } from "./types";

const DECAY_HALF_LIFE_HOURS = 72;
const COMPOUND_WINDOW_HOURS = 48;

export interface ScoredChange extends ThesisChange {
  rawSeverity: 1 | 2 | 3;
  compounding: boolean;
  ageHours: number;
}

export function correlateAndDecay(changes: ThesisChange[], detectedAt: Date, now = new Date()): ScoredChange[] {
  const ageHours = Math.max(0, (now.getTime() - detectedAt.getTime()) / (1000 * 60 * 60));
  const decayFactor = Math.pow(0.5, ageHours / DECAY_HALF_LIFE_HOURS);
  const nonNeutralTypes = new Set(changes.filter(change => change.direction !== "neutral").map(change => change.type));
  const compounding = nonNeutralTypes.size > 1 && ageHours <= COMPOUND_WINDOW_HOURS;

  return changes.map(change => {
    const decayedSeverity = Math.max(1, Math.round(change.severity * decayFactor)) as 1 | 2 | 3;
    const severity = compounding && change.direction !== "neutral"
      ? Math.min(3, decayedSeverity + 1) as 1 | 2 | 3
      : decayedSeverity;

    return {
      ...change,
      severity,
      rawSeverity: change.severity,
      compounding: compounding && change.direction !== "neutral",
      ageHours: Math.round(ageHours),
    };
  });
}