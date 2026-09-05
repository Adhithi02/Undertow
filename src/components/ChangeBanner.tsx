import { ThesisChange } from "@/lib/signals/types";

const names: Record<string, string> = { earnings: "earnings", analyst: "analyst view", ownership: "ownership", risk: "risk", valuation: "valuation", technical: "technicals" };

export function ChangeBanner({ change }: { change: ThesisChange }) {
  const scored = change as ThesisChange & { compounding?: boolean; rawSeverity?: number };
  const direction = change.direction === "positive" ? "positive" : change.direction === "negative" ? "negative" : "neutral";
  return <article className={`detail-entry detail-${direction}`}><div className="detail-entry-head"><span>{direction === "positive" ? "▲" : direction === "negative" ? "▼" : "—"} {names[change.type] ?? change.type}</span><span className="mono">{scored.compounding ? "compound · " : ""}severity {change.severity}/3</span></div><p>{change.summary}</p><small>{scored.compounding ? `Compounded from raw severity ${scored.rawSeverity ?? change.severity}. ` : ""}{change.isFirstVisit ? "Current evidence, before a baseline is established." : direction === "positive" ? "A favorable shift in the thesis." : direction === "negative" ? "A signal that deserves attention." : "A movement without a clear direction."}</small></article>;
}
