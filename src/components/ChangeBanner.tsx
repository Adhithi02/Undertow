import { ThesisChange } from "@/lib/signals/types";

const names: Record<string, string> = { earnings: "earnings", analyst: "analyst view", ownership: "ownership", risk: "risk", valuation: "valuation", technical: "technicals" };

export function ChangeBanner({ change }: { change: ThesisChange }) {
  const scored = change as ThesisChange & { compounding?: boolean; rawSeverity?: number };
  const direction = change.direction === "positive" ? "positive" : change.direction === "negative" ? "negative" : "neutral";
  return <article className={`detail-entry detail-${direction}`}>
    <div className="detail-entry-head">
      <span>{direction === "positive" ? "▲" : direction === "negative" ? "▼" : "—"} {names[change.type] ?? change.type}</span>
      <span className="mono">{scored.compounding ? "compound · " : ""}severity {change.severity}/3</span>
    </div>
    <p>{change.summary}</p>
    {change.previousValue !== undefined && change.currentValue !== undefined && (
      <p className="mono" style={{ fontSize: '0.8rem', opacity: 0.7, margin: '0.25rem 0' }}>
        {change.previousValue}{change.unit ?? ""} → {change.currentValue}{change.unit ?? ""}
        {" "}(Δ {change.currentValue - change.previousValue > 0 ? "+" : ""}{change.currentValue - change.previousValue}{change.unit ?? ""})
      </p>
    )}
    <small style={{ color: 'var(--text-muted)' }}>
      {scored.compounding ? `Compounded (+1) from raw severity ${scored.rawSeverity ?? change.severity} due to multiple signals aligning within 48h. ` : ""}
      {change.isFirstVisit 
        ? "Current evidence, before a baseline is established." 
        : direction === "positive" ? "A favorable shift in the thesis." : direction === "negative" ? "A signal that deserves attention." : "A movement without a clear direction."}
      {!change.isFirstVisit && " Severity decays via a 72-hour half-life."}
    </small>
  </article>;
}
