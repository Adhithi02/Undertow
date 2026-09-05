import { AnalystEvaluator } from "./evaluators/analyst";
import { EarningsEvaluator } from "./evaluators/earnings";
import { OwnershipEvaluator } from "./evaluators/ownership";
import { RiskEvaluator } from "./evaluators/risk";
import { TechnicalEvaluator } from "./evaluators/technical";
import { ValuationEvaluator } from "./evaluators/valuation";
import { SignalEvaluator } from "./types";

export const signalEvaluators: SignalEvaluator[] = [
  new EarningsEvaluator(),
  new AnalystEvaluator(),
  new OwnershipEvaluator(),
  new RiskEvaluator(),
  new ValuationEvaluator(),
  new TechnicalEvaluator(),
];