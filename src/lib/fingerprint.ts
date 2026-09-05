import { ThesisSnapshot } from "@/lib/signals/types";

export type FingerprintStatus = "insufficient" | "normal" | "watch" | "unusual";

type DimensionDefinition = {
  key: "epsSurprise" | "analystScore" | "institutionalOwnership" | "riskScore" | "peRatio" | "technicalScore";
  label: string;
  normalize: (value: number) => number;
};

// The fixed transforms put unlike modelled inputs on comparable, bounded axes
// before the historical profile is calculated. They are not market forecasts.
const clamp = (value: number) => Math.max(-1, Math.min(1, value));

export const FINGERPRINT_DIMENSIONS: readonly DimensionDefinition[] = [
  { key: "epsSurprise", label: "Earnings", normalize: value => clamp(value / 20) },
  { key: "analystScore", label: "Analyst view", normalize: value => clamp(value / 20) },
  { key: "institutionalOwnership", label: "Ownership", normalize: value => clamp(value / 20) },
  { key: "riskScore", label: "Risk", normalize: value => clamp(value / 20) },
  { key: "peRatio", label: "Valuation", normalize: value => {
    if (value <= 0) return -1;
    return clamp(((Math.log(value) - Math.log(10)) / (Math.log(120) - Math.log(10))) * 2 - 1);
  } },
  { key: "technicalScore", label: "Technicals", normalize: value => clamp(value / 20) },
];

const MIN_HISTORY = 2;
const DISPERSION_FLOOR = 0.1;

export type FingerprintDimension = {
  key: string;
  label: string;
  value: number;
  centroid: number | null;
  difference: number | null;
  standardizedDistance: number | null;
  contribution: number | null;
};

export type ThesisFingerprint = {
  status: FingerprintStatus;
  unusualness: number | null;
  distance: number | null;
  historyCount: number;
  minimumHistory: number;
  currentVector: number[] | null;
  centroidVector: number[] | null;
  dimensions: FingerprintDimension[];
  interpretation: string;
};

function toVector(snapshot: ThesisSnapshot): number[] | null {
  const values = FINGERPRINT_DIMENSIONS.map(dimension => snapshot.signals[dimension.key]);
  if (!values.every(value => typeof value === "number" && Number.isFinite(value))) return null;
  return values.map((value, index) => FINGERPRINT_DIMENSIONS[index].normalize(value as number));
}

function average(values: number[]) {
  return values.reduce((total, value) => total + value, 0) / values.length;
}

function emptyDimensions(current: number[] | null): FingerprintDimension[] {
  return FINGERPRINT_DIMENSIONS.map((dimension, index) => ({
    key: dimension.key,
    label: dimension.label,
    value: current?.[index] ?? 0,
    centroid: null,
    difference: null,
    standardizedDistance: null,
    contribution: null,
  }));
}

/**
 * A small, deterministic anomaly detector. It uses prior complete snapshots
 * only: each axis is normalized, compared with its historical centroid, and
 * scaled by historical dispersion (with a 0.10 normalized floor).
 */
export function calculateThesisFingerprint(history: ThesisSnapshot[], current: ThesisSnapshot): ThesisFingerprint {
  const currentVector = toVector(current);
  const historyVectors = history.map(toVector).filter((vector): vector is number[] => vector !== null);

  if (!currentVector) {
    return {
      status: "insufficient", unusualness: null, distance: null, historyCount: historyVectors.length,
      minimumHistory: MIN_HISTORY, currentVector: null, centroidVector: null, dimensions: emptyDimensions(null),
      interpretation: "The fingerprint needs all six modelled inputs in the current snapshot before it can compare thesis shape.",
    };
  }

  if (historyVectors.length < MIN_HISTORY) {
    return {
      status: "insufficient", unusualness: null, distance: null, historyCount: historyVectors.length,
      minimumHistory: MIN_HISTORY, currentVector, centroidVector: null, dimensions: emptyDimensions(currentVector),
      interpretation: `Historical profile is still forming: ${historyVectors.length} of ${MIN_HISTORY} prior complete snapshots are available.`,
    };
  }

  const centroidVector = FINGERPRINT_DIMENSIONS.map((_, index) => average(historyVectors.map(vector => vector[index])));
  const dispersions = FINGERPRINT_DIMENSIONS.map((_, index) => {
    const variance = average(historyVectors.map(vector => (vector[index] - centroidVector[index]) ** 2));
    return Math.max(Math.sqrt(variance), DISPERSION_FLOOR);
  });
  const standardized = currentVector.map((value, index) => Math.abs(value - centroidVector[index]) / dispersions[index]);
  const squaredDistance = standardized.map(value => value ** 2);
  const distance = Math.sqrt(average(squaredDistance));
  const unusualness = Math.round(Math.min(100, 100 * (1 - Math.exp(-distance / 2))));
  const status: FingerprintStatus = unusualness >= 60 ? "unusual" : unusualness >= 30 ? "watch" : "normal";
  const totalSquaredDistance = squaredDistance.reduce((total, value) => total + value, 0);
  const dimensions = FINGERPRINT_DIMENSIONS.map((dimension, index) => ({
    key: dimension.key,
    label: dimension.label,
    value: currentVector[index],
    centroid: centroidVector[index],
    difference: currentVector[index] - centroidVector[index],
    standardizedDistance: standardized[index],
    contribution: totalSquaredDistance > 0 ? Math.round((squaredDistance[index] / totalSquaredDistance) * 100) : 0,
  }));
  const primary = [...dimensions]
    .sort((left, right) => (right.contribution ?? 0) - (left.contribution ?? 0))
    .filter(dimension => (dimension.contribution ?? 0) > 0)
    .slice(0, 3)
    .map(dimension => dimension.label.toLowerCase());
  const lead = primary.length ? ` Strongest departures: ${primary.join(", ")}.` : "";
  const interpretation = status === "normal"
    ? "The current modelled thesis composition remains close to its available historical profile."
    : status === "watch"
      ? `The current modelled thesis composition is meaningfully different from its available historical profile.${lead}`
      : `The current modelled thesis composition is materially different from its available historical profile.${lead}`;

  return { status, unusualness, distance, historyCount: historyVectors.length, minimumHistory: MIN_HISTORY, currentVector, centroidVector, dimensions, interpretation };
}
