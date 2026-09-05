"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ChangeBanner } from "./ChangeBanner";
import { PriceModeLabel } from "./PriceModeLabel";
import { StaleBadge } from "./StaleBadge";
import { ThesisChange } from "@/lib/signals/types";

type Detail = { symbol: string; dataPending: boolean; stale: boolean; snapshot: { fetchedAt: string; signals: Record<string, unknown> } | null; changes: ThesisChange[] };
const labels: Record<string, string> = { epsSurprise: "EPS surprise", analystScore: "Analyst sentiment", institutionalOwnership: "Institutional ownership", riskScore: "Risk score", peRatio: "P/E ratio", technicalScore: "Technical score", price: "Price" };

function hasConflict(changes: ThesisChange[]) {
  return changes.some(change => change.direction === "positive") && changes.some(change => change.direction === "negative");
}

export default function StockDetail({ symbol, since, mode: initialMode }: { symbol: string; since?: string; mode?: "live" | "simulated" }) {
  const [detail, setDetail] = useState<Detail | null>(null);
  const [mode, setMode] = useState<"live" | "simulated">(initialMode ?? "live");
  useEffect(() => {
    if (initialMode) { setMode(initialMode); return; }
    setMode(window.localStorage.getItem("pulse_price_mode") === "simulated" ? "simulated" : "live");
  }, [initialMode]);
  useEffect(() => { const query = since ? `?since=${encodeURIComponent(since)}` : ""; fetch(`/api/stock/${symbol}/thesis${query}`, { cache: "no-store" }).then(response => response.json()).then(setDetail); }, [symbol, since]);
  const signalEntries = useMemo(() => Object.entries(detail?.snapshot?.signals ?? {}), [detail]);
  if (!detail) return <main className="detail-shell"><p className="mono">Pulse / loading evidence</p><p className="loading-line">Reconstructing the thesis...</p></main>;
  const positives = detail.changes.filter(change => change.direction === "positive");
  const negatives = detail.changes.filter(change => change.direction === "negative");
  const conflict = hasConflict(detail.changes);
  const changeStackClass = conflict ? "change-stack change-stack-conflict" : "change-stack";

  return <main className="detail-shell"><Link href="/" className="back-link">← Return to ledger</Link><header className="detail-header"><div><p className="mono">Thesis record / {detail.symbol}</p><h1>{detail.symbol}</h1><p className="detail-subtitle">A dated record of the evidence Pulse found since your last visit.</p><PriceModeLabel mode={mode} /></div><div className="detail-status">{detail.stale && <StaleBadge />}<span className="snapshot-date">Snapshot {detail.snapshot ? new Date(detail.snapshot.fetchedAt).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) : "pending"}</span></div></header>{detail.dataPending ? <section className="pending-panel"><span className="pending-icon">···</span><h2>Evidence is still pending.</h2><p>Pulse has this name on your list, but no thesis snapshot has arrived yet.</p></section> : <><section className={`thesis-verdict ${conflict ? "is-conflicted" : ""}`}><p className="mono">The read</p><h2>{conflict ? "The story is pulling in two directions." : detail.changes.length ? "The thesis has new evidence." : "The thesis is holding steady."}</h2><p>{conflict ? "Positive and negative evidence coexist. Pulse keeps both in view instead of averaging them into a false consensus." : detail.changes.length ? `${detail.changes.length} independent signal${detail.changes.length === 1 ? "" : "s"} moved since your last visit.` : "No signal crossed the meaningful-change threshold since your last visit."}</p></section><section className="detail-layout"><div className="evidence-column"><div className="section-heading"><h2>Signal entries</h2><span>{detail.changes.length ? "since last visit" : "no new evidence"}</span></div>{conflict && <div className="conflict-callout"><strong>Conflict recorded</strong><p>These signals are shown independently because disagreement is itself meaningful.</p></div>}<div className={changeStackClass}>{detail.changes.length ? detail.changes.map((change, index) => <ChangeBanner key={`${change.type}-${index}`} change={change} />) : <div className="steady-panel">The available evidence is unchanged. Your baseline is intact.</div>}</div></div><aside className="ledger-column"><div className="section-heading"><h2>Current snapshot</h2></div><div className="ledger-list">{signalEntries.map(([key, value]) => <div key={key} className="ledger-row"><span>{labels[key] ?? key}</span><strong>{typeof value === "number" && key !== "price" ? `${value}${key === "epsSurprise" || key === "institutionalOwnership" ? "%" : ""}` : String(value)}</strong></div>)}</div><p className="ledger-note">A snapshot is evidence, not a recommendation. Direction is relative to the previous check.</p></aside></section><section className="direction-strip"><div><span className="direction-dot dot-lime" /><strong>{positives.length}</strong> positive shift{positives.length === 1 ? "" : "s"}</div><div><span className="direction-dot dot-coral" /><strong>{negatives.length}</strong> negative shift{negatives.length === 1 ? "" : "s"}</div><div className="direction-caption">Both sides stay in the record.</div></section></>}</main>;
}
