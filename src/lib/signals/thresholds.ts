import { ANALYST_MEANINGFUL, ANALYST_SEVERITY_2, ANALYST_SEVERITY_3 } from "@/lib/signals/evaluators/analyst";
import { EARNINGS_MEANINGFUL, EARNINGS_SEVERITY_2, EARNINGS_SEVERITY_3 } from "@/lib/signals/evaluators/earnings";
import { OWNERSHIP_MEANINGFUL, OWNERSHIP_SEVERITY_2, OWNERSHIP_SEVERITY_3 } from "@/lib/signals/evaluators/ownership";
import { RISK_MEANINGFUL, RISK_SEVERITY_2, RISK_SEVERITY_3 } from "@/lib/signals/evaluators/risk";
import { TECHNICAL_MEANINGFUL, TECHNICAL_SEVERITY_2, TECHNICAL_SEVERITY_3 } from "@/lib/signals/evaluators/technical";
import { VALUATION_MEANINGFUL, VALUATION_SEVERITY_2, VALUATION_SEVERITY_3 } from "@/lib/signals/evaluators/valuation";
import { ThesisChangeType } from "@/lib/signals/types";

function rule(meaningful: number, severity2: number, severity3: number) {
  return `meaningful at ≥${meaningful}pt shift, severity 2 at ≥${severity2}, severity 3 at ≥${severity3}`;
}

const rules: Record<ThesisChangeType, string> = {
  earnings: rule(EARNINGS_MEANINGFUL, EARNINGS_SEVERITY_2, EARNINGS_SEVERITY_3),
  analyst: rule(ANALYST_MEANINGFUL, ANALYST_SEVERITY_2, ANALYST_SEVERITY_3),
  ownership: rule(OWNERSHIP_MEANINGFUL, OWNERSHIP_SEVERITY_2, OWNERSHIP_SEVERITY_3),
  risk: rule(RISK_MEANINGFUL, RISK_SEVERITY_2, RISK_SEVERITY_3),
  valuation: rule(VALUATION_MEANINGFUL, VALUATION_SEVERITY_2, VALUATION_SEVERITY_3),
  technical: rule(TECHNICAL_MEANINGFUL, TECHNICAL_SEVERITY_2, TECHNICAL_SEVERITY_3),
};

export function thresholdRule(type: ThesisChangeType) {
  return rules[type];
}
