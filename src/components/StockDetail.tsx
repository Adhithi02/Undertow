"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ChangeBanner } from "./ChangeBanner";
import { PriceModeLabel } from "./PriceModeLabel";
import { StaleBadge } from "./StaleBadge";
import { ThesisFingerprint } from "./ThesisFingerprint";
import { ThesisFingerprint as Fingerprint } from "@/lib/fingerprint";
import { ThesisChange } from "@/lib/signals/types";

type Detail = { symbol: string; dataPending: boolean; stale: boolean; snapshot: { fetchedAt: string; signals: Record<string, unknown> } | null; changes: ThesisChange[] };
type FingerprintResponse = { fingerprint: Fingerprint | null; timeline: { fetchedAt: string; current: boolean }[] };
const labels: Record<string, string> = { epsSurprise: "EPS surprise (modelled)", analystScore: "Analyst sentiment (modelled)", institutionalOwnership: "Institutional ownership (modelled)", riskScore: "Risk score (modelled)", peRatio: "P/E ratio (modelled)", technicalScore: "Technical score (modelled)", price: "Snapshot price" };

function hasConflict(changes: ThesisChange[]) {
  return changes.some(change => change.direction === "positive") && changes.some(change => change.direction === "negative");
}

export default function StockDetail({ symbol, since, mode: initialMode }: { symbol: string; since?: string; mode?: "live" | "simulated" }) {
  const [detail, setDetail] = useState<Detail | null>(null);
  const [fingerprint, setFingerprint] = useState<FingerprintResponse | null>(null);
  const [storedMode, setStoredMode] = useState<"live" | "simulated">("live");
  useEffect(() => {
    if (initialMode) return;
    const frame = window.requestAnimationFrame(() => {
      setStoredMode(window.localStorage.getItem("undertow_price_mode") === "simulated" ? "simulated" : "live");
    });
    return () => window.cancelAnimationFrame(frame);
  }, [initialMode]);
  const mode = initialMode ?? storedMode;
  useEffect(() => {
    const query = since ? `?since=${encodeURIComponent(since)}` : "";
    fetch(`/api/stock/${symbol}/thesis${query}`, { cache: "no-store" }).then(response => response.json()).then(setDetail);
    fetch(`/api/stock/${symbol}/fingerprint`, { cache: "no-store" }).then(response => response.ok ? response.json() : null).then(setFingerprint);
  }, [symbol, since]);
  const signalEntries = useMemo(() => Object.entries(detail?.snapshot?.signals ?? {}), [detail]);
  if (!detail) return <main className="detail-shell"><p className="mono">Undertow / loading evidence</p><p className="loading-line">Reconstructing the thesis...</p></main>;
  const firstVisit = detail.changes.length > 0 && detail.changes.every(change => change.isFirstVisit);
  const sinceVisitChanges = firstVisit ? [] : detail.changes.filter(change => !change.isFirstVisit);
  const positives = sinceVisitChanges.filter(change => change.direction === "positive");
  const negatives = sinceVisitChanges.filter(change => change.direction === "negative");
  const conflict = !firstVisit && hasConflict(sinceVisitChanges);
  const changeStackClass = conflict ? "change-stack change-stack-conflict" : "change-stack";

  return <main className="detail-shell"><Link href="/" className="back-link">← Return to thesis monitor</Link><header className="detail-header"><div><p className="mono">Research workstation / {detail.symbol}</p><h1>{detail.symbol}</h1><p className="detail-subtitle">{firstVisit ? "Current modelled baseline from the latest thesis snapshot. This is not a list of changes since a prior visit." : "A dated record of modelled thesis evidence since your last visit. Signals are demo/modelled, not live vendor feeds."}</p><PriceModeLabel mode={mode} source="snapshot" /></div><div className="detail-status">{detail.stale && <StaleBadge />}<span className="snapshot-date">Snapshot {detail.snapshot ? new Date(detail.snapshot.fetchedAt).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) : "pending"}</span></div></header>{detail.dataPending ? <section className="pending-panel"><span className="pending-icon">···</span><h2>Evidence is still pending.</h2><p>Undertow has this name on your list, but no thesis snapshot has arrived yet.</p></section> : <><section className={`thesis-verdict ${conflict ? "is-conflicted" : ""}`}><p className="mono">What changed</p><h2>{firstVisit ? "This is the current baseline." : conflict ? "The story is pulling in two directions." : sinceVisitChanges.length ? "The thesis has new evidence." : "The thesis is holding steady."}</h2><p>{firstVisit ? "There is no previous visit to compare against, so current modelled readings are shown as state, not as fabricated changes." : conflict ? "Positive and negative evidence coexist. Undertow keeps both in view instead of averaging them into a false consensus." : sinceVisitChanges.length ? `${sinceVisitChanges.length} independent modelled signal${sinceVisitChanges.length === 1 ? "" : "s"} moved since your last visit.` : "No signal crossed the meaningful-change threshold since your last visit."}</p></section><ThesisFingerprint fingerprint={fingerprint?.fingerprint ?? null} timeline={fingerprint?.timeline ?? []} /><section className="detail-layout"><div className="evidence-column"><div className="section-heading"><h2>Signal-by-signal explanation</h2><span>{firstVisit ? "current baseline" : sinceVisitChanges.length ? "since last visit" : "no new evidence"}</span></div>{conflict && <div className="conflict-callout"><strong>Cross-signal conflict recorded</strong><p>These signals are shown independently because disagreement is itself meaningful.</p></div>}<div className={changeStackClass}>{firstVisit ? <div className="steady-panel">Current modelled snapshot values are in the ledger at right. They are the baseline, not changes since last visit.</div> : sinceVisitChanges.length ? sinceVisitChanges.map((change, index) => <ChangeBanner key={`${change.type}-${index}`} change={change} />) : <div className="steady-panel">The available evidence is unchanged. Your baseline is intact.</div>}</div></div><aside className="ledger-column"><div className="section-heading"><h2>Thesis snapshot</h2></div><div className="ledger-list">{signalEntries.map(([key, value]) => <div key={key} className="ledger-row"><span>{labels[key] ?? key}</span><strong>{typeof value === "number" && key !== "price" ? `${value}${key === "epsSurprise" || key === "institutionalOwnership" ? "%" : ""}` : key === "price" && typeof value === "number" ? `$${value.toFixed(2)}` : String(value)}</strong></div>)}</div><p className="ledger-note">Quality: modelled demo inputs. Snapshot fields are not live earnings, consensus, RSI, or litigation feeds. Direction is relative to the previous check.</p></aside></section><section className="direction-strip"><div><span className="direction-dot dot-lime" /><strong>{positives.length}</strong> positive shift{positives.length === 1 ? "" : "s"}</div><div><span className="direction-dot dot-coral" /><strong>{negatives.length}</strong> negative shift{negatives.length === 1 ? "" : "s"}</div><div className="direction-caption">Both sides stay in the record.</div></section></>}</main>;
}
