"use client";

import Link from "next/link";
import { format, intervalToDuration } from "date-fns";
import { FormEvent, useEffect, useRef, useState } from "react";
import { EmptyState } from "./EmptyState";
import { DemoChips } from "./DemoChips";
import { PriceModeLabel } from "./PriceModeLabel";
import { StaleBadge } from "./StaleBadge";
import { ThesisChange } from "@/lib/signals/types";
import { thresholdRule } from "@/lib/signals/thresholds";

type WatchItem = { id: string; symbol: string; createdAt: string; price: number | null; currentStats: { epsSurprise: number | null; analystScore: number | null; riskScore: number | null; peRatio: number | null; technicalScore: number | null }; changes: ThesisChange[]; dataPending: boolean; stale: boolean; fetchedAt: string | null };
type WatchlistResponse = { items: WatchItem[]; lastVisit: string; baselineAt: string | null };
const signalNames: Record<string, string> = { earnings: "earnings", analyst: "analyst view", ownership: "ownership", risk: "risk", valuation: "valuation", technical: "technicals" };

function hasConflict(changes: ThesisChange[]) { return changes.some(change => change.direction === "positive") && changes.some(change => change.direction === "negative"); }
function formatPrice(price: number | null) { return price !== null ? `$${price.toFixed(2)}` : "n/a"; }
function formatBriefingEmail(items: WatchItem[], lastVisit: Date | null, now: Date | null) {
  const firstLook = !lastVisit;
  const changes = firstLook ? [] : items.flatMap(item => item.changes.filter(change => !change.isFirstVisit));
  const conflicts = firstLook ? 0 : items.filter(item => hasConflict(item.changes.filter(change => !change.isFirstVisit))).length;
  const positive = changes.filter(change => change.direction === "positive").length;
  const negative = changes.filter(change => change.direction === "negative").length;
  const window = lastVisit && now ? `Last look: ${format(lastVisit, "EEE, h:mm a")} → ${format(now, "EEE, h:mm a")}` : "First look at this ledger.";
  const headline = firstLook
    ? `Current modelled baseline across ${items.length} name${items.length === 1 ? "" : "s"} — not changes since a prior visit.`
    : changes.length
      ? `${changes.length} meaningful shift${changes.length === 1 ? "" : "s"} across ${items.length} name${items.length === 1 ? "" : "s"}.`
      : `Nothing crossed a threshold across ${items.length} name${items.length === 1 ? "" : "s"}.`;
  const ranked = [...items].sort((a, b) => (Math.max(...b.changes.map(change => change.severity), 0) - Math.max(...a.changes.map(change => change.severity), 0)) || b.changes.length - a.changes.length);
  const entries = ranked.map(item => {
    const price = item.dataPending ? "awaiting a first snapshot" : `price ${formatPrice(item.price)}`;
    if (item.dataPending) return `${item.symbol}\n  Still waiting on a first snapshot.`;
    if (firstLook || item.changes.every(change => change.isFirstVisit)) return `${item.symbol}\n  First look. Current modelled baseline, not a change since last visit.\n  ${price}`;
    if (!item.changes.length) return `${item.symbol}\n  Quiet. Nothing crossed the threshold.\n  ${price}`;
    const disagreement = hasConflict(item.changes) ? "  Signals disagree — both stay on the record.\n" : "";
    const lines = item.changes.map(change => `  • ${change.summary}`).join("\n");
    return `${item.symbol}${hasConflict(item.changes) ? "  —  disagreement" : ""}\n${disagreement}${lines}\n  ${price}`;
  }).join("\n\n");
  return [
    "UNDERTOW",
    "What's moving beneath the surface",
    "",
    window,
    headline,
    `${positive} positive  ·  ${negative} negative  ·  ${conflicts} conflict${conflicts === 1 ? "" : "s"}`,
    "",
    entries,
    "",
    "—",
    "A dated record of evidence, not a recommendation.",
    "Conflicting signals are left un-averaged on purpose.",
  ].join("\n");
}
function EngineeringNote({ children }: { children: string }) { return <p className="engineering-note">{children}</p>; }
function relativeDuration(start: Date, end: Date) { const duration = intervalToDuration({ start, end }); const parts = []; if (duration.days) parts.push(`${duration.days} day${duration.days === 1 ? "" : "s"}`); if (duration.hours) parts.push(`${duration.hours} hour${duration.hours === 1 ? "" : "s"}`); return parts.length ? parts.join(", ") : "less than an hour"; }
function readStoredMode(): "live" | "simulated" {
  if (typeof window === "undefined") return "live";
  return window.localStorage.getItem("undertow_price_mode") === "simulated" ? "simulated" : "live";
}
function LoadingSkeleton({ slow }: { slow: boolean }) {
  return (
    <main className="ledger-shell ledger-skeleton">
      <header className="ledger-header"><Link href="/" className="wordmark">Undertow</Link></header>
      <div className="skeleton-line" />
      <div className="skeleton-line short" />
      <div className="skeleton-rows"><div className="skeleton-row" /><div className="skeleton-row" /><div className="skeleton-row" /></div>
      {slow && <p className="skeleton-note">waking up the ledger...</p>}
    </main>
  );
}

export default function Dashboard() {
  const [email, setEmail] = useState("");
  const [loggedIn, setLoggedIn] = useState(false);
  const [watchlist, setWatchlist] = useState<WatchlistResponse | null>(null);
  const [symbol, setSymbol] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [emailError, setEmailError] = useState("");
  const [showNotes, setShowNotes] = useState(false);
  const [dataMode, setDataMode] = useState<"live" | "simulated">("live");
  const [emailStatus, setEmailStatus] = useState("");
  const [booting, setBooting] = useState(true);
  const [slowBoot, setSlowBoot] = useState(false);
  const addRef = useRef<HTMLInputElement>(null);

  async function loadWatchlist(mode = dataMode) {
    const response = await fetch(`/api/watchlist?mode=${mode}`, { cache: "no-store" });
    if (response.status === 401) { setLoggedIn(false); setWatchlist(null); return false; }
    if (!response.ok) throw new Error("Unable to load watchlist");
    setWatchlist(await response.json());
    setLoggedIn(true);
    return true;
  }
  const loadWatchlistRef = useRef(loadWatchlist);
  useEffect(() => {
    loadWatchlistRef.current = loadWatchlist;
  });
  useEffect(() => {
    const mode = readStoredMode();
    const slowTimer = window.setTimeout(() => setSlowBoot(true), 3000);
    const frame = window.requestAnimationFrame(() => setDataMode(mode));
    loadWatchlistRef.current(mode)
      .catch(() => setMessage("Open your ledger to begin."))
      .finally(() => { window.clearTimeout(slowTimer); setBooting(false); setSlowBoot(false); });
    return () => window.cancelAnimationFrame(frame);
  }, []);
  async function openWorkspace(candidateEmail: string) {
    const normalizedEmail = candidateEmail.trim();
    setEmailError("");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) { setEmailError("That doesn't look like an email — check it and try again."); return; }
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/user", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: normalizedEmail }) });
      if (!response.ok) throw new Error("Unable to open workspace");
      setEmail(normalizedEmail);
      await loadWatchlist();
    } catch { setEmailError("We couldn't open this workspace — try again."); } finally { setBusy(false); }
  }
  async function connect(event: FormEvent) { event.preventDefault(); await openWorkspace(email); }
  async function recordSymbol(ticker: string) {
    if (!ticker.trim()) { addRef.current?.focus(); return; }
    setBusy(true);
    setMessage("");
    const response = await fetch("/api/watchlist", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ symbol: ticker }) });
    const body = await response.json();
    setMessage(response.ok ? (body.duplicate ? `${body.symbol} is already in the ledger.` : `${body.symbol} added to the ledger.`) : "That symbol does not look right — check it and try again.");
    if (response.ok) { setSymbol(""); await loadWatchlist(); }
    setBusy(false);
  }
  async function addSymbol(event: FormEvent) { event.preventDefault(); await recordSymbol(symbol); }
  async function simulate() {
    setBusy(true);
    try {
      await Promise.all([5, 10, 15].map(minutes => fetch("/api/admin/simulate-time", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ minutes }) })));
      await loadWatchlist();
      setMessage("Three synthetic snapshots are ready: inspect NVDA for conflict and Thesis Fingerprint change.");
    } catch { setMessage("The synthetic demo could not be generated. Try again."); } finally { setBusy(false); }
  }
  async function removeSymbol(stock: string) { setBusy(true); await fetch(`/api/watchlist/${stock}`, { method: "DELETE" }); await loadWatchlist(); setMessage(`${stock} removed from the ledger.`); setBusy(false); }
  async function changeMode(mode: "live" | "simulated") {
    setDataMode(mode);
    window.localStorage.setItem("undertow_price_mode", mode);
    setBusy(true);
    try { await loadWatchlist(mode); } finally { setBusy(false); }
  }
  async function logout() {
    await fetch("/api/logout", { method: "POST" });
    setLoggedIn(false);
    setWatchlist(null);
    setEmail("");
    setSymbol("");
    setMessage("");
    setEmailError("");
    setShowNotes(false);
  }
  async function emailBriefing() {
    if (!watchlist) return;
    setEmailStatus("Sending...");
    const text = formatBriefingEmail(watchlist.items, watchlist.baselineAt ? new Date(watchlist.baselineAt) : null, new Date(watchlist.lastVisit));
    const response = await fetch("/api/briefing/email", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text }) });
    setEmailStatus(response.ok ? "Sent" : ((await response.json()).error ?? "Couldn't send"));
  }

  if (booting) return <LoadingSkeleton slow={slowBoot} />;
  if (!loggedIn) return <main className="auth-shell"><div className="auth-content"><h1>Undertow</h1><p className="auth-prompt">Open a workspace.</p><p className="auth-intro">Use an email to create or return to a prototype workspace.</p><form onSubmit={connect} noValidate className="auth-form"><input value={email} onChange={event => { setEmail(event.target.value); setEmailError(""); }} type="email" placeholder="your email" aria-label="Workspace email" aria-invalid={Boolean(emailError)} /><button disabled={busy}>{busy ? <><span className="button-spinner" aria-hidden="true" />Opening...</> : "Open workspace"}</button></form><div className="demo-workspace"><span className="mono">Public demo</span><p>Explore the pre-seeded NVDA conflict and Thesis Fingerprint flow without entering an email.</p><button type="button" onClick={() => openWorkspace("demo@undertow.local")} disabled={busy}>Explore demo workspace ↗</button></div>{emailError && <p className="form-error">{emailError}</p>}<p className="auth-note">Prototype identity only: Undertow does not verify email ownership. Do not use an email that belongs to someone else.</p><Link href="/how-it-works" className="auth-guide-link">How Undertow works ↗</Link></div></main>;

  const items = watchlist?.items ?? [];
  const firstLook = !watchlist?.baselineAt;
  const allChanges = firstLook ? [] : items.flatMap(item => item.changes.filter(change => !change.isFirstVisit));
  const changedItems = items.filter(item => item.changes.some(change => !change.isFirstVisit));
  const attentionSummary = {
    positive: allChanges.filter(change => change.direction === "positive").length,
    negative: allChanges.filter(change => change.direction === "negative").length,
    conflicts: items.filter(item => hasConflict(item.changes.filter(change => !change.isFirstVisit))).length,
  };
  const unchangedCount = items.filter(item => !item.changes.some(change => !change.isFirstVisit) && !item.dataPending).length;
  const baselineQuery = watchlist?.baselineAt
    ? `?since=${encodeURIComponent(watchlist.baselineAt)}&mode=${dataMode}`
    : `?since=${encodeURIComponent("1970-01-01T00:00:00.000Z")}&mode=${dataMode}`;
  const conflictItem = firstLook ? undefined : items.find(item => hasConflict(item.changes.filter(change => !change.isFirstVisit)));
  const topItems = [...items].sort((a, b) => (Math.max(...b.changes.map(change => change.severity), 0) - Math.max(...a.changes.map(change => change.severity), 0)) || b.changes.length - a.changes.length);
  const attentionQueue = [...items].filter(item => !item.dataPending).sort((left, right) => {
    const score = (item: WatchItem) => Math.max(...item.changes.map(change => change.severity), 0) * 10 + (hasConflict(item.changes) ? 5 : 0) + (item.stale ? 2 : 0);
    return score(right) - score(left);
  }).slice(0, 3);
  const lastVisit = watchlist?.baselineAt ? new Date(watchlist.baselineAt) : null;
  const now = watchlist ? new Date(watchlist.lastVisit) : null;

  return (
    <main className="ledger-shell">
      <header className="ledger-header">
        <Link href="/" className="wordmark">Undertow<span>.</span></Link>
        <div className="header-actions"><span className="mono header-email">Thesis monitor / {email || "active"}</span><button className="logout-link" onClick={logout}>Log out</button><Link href="/how-it-works" className="notes-toggle">Methodology</Link><div className="mode-toggle-wrap"><div className="mode-toggle" aria-label="Price data mode"><span className="mode-toggle-prefix">Price:</span><button className={dataMode === "live" ? "mode-active" : ""} onClick={() => changeMode("live")} disabled={busy}>Live</button><button className={dataMode === "simulated" ? "mode-active" : ""} onClick={() => changeMode("simulated")} disabled={busy}>Simulated</button></div><p className="mode-toggle-note">Price only. All six thesis inputs remain modelled demo data.</p></div><button className="notes-toggle" onClick={() => setShowNotes(value => !value)}>{showNotes ? "Hide method notes" : "Show method notes"}</button></div>
      </header>
      <section className="briefing">
        <p className="briefing-kicker mono">Research briefing · track the thesis, not just the ticker</p>{lastVisit && now && <p className="last-visit-strip">Baseline: {format(lastVisit, "EEE, h:mm a")} <span>→</span> Current snapshot: {format(now, "EEE, h:mm a")} ({relativeDuration(lastVisit, now)})</p>}
        <div className="briefing-title-row"><p className="briefing-date">{firstLook ? "First look: current modelled baseline — not changes since a prior visit." : allChanges.length ? `Since your last visit, ${allChanges.length} thing${allChanges.length === 1 ? "" : "s"} shifted.` : "Since your last visit, nothing meaningful shifted."}</p><div className="briefing-email-action"><button className="email-briefing-button" onClick={emailBriefing} title="Email this briefing" aria-describedby="email-briefing-note">Email me this briefing</button><span id="email-briefing-note">{emailStatus || "Send it to your account email"}</span></div></div>
        <p className="briefing-body">{firstLook ? <>This visit establishes the baseline. Modelled thesis signals below describe current state, not a fabricated move since last time.</> : conflictItem ? <>{conflictItem.symbol} {conflictItem.changes.find(change => change.direction === "positive")?.summary.toLowerCase()}, but {conflictItem.changes.find(change => change.direction === "negative")?.summary.toLowerCase()} — that&apos;s disagreement, not noise. Worth a look.</> : allChanges.length ? <>New evidence appeared across {changedItems.length} of {items.length} tracked {items.length === 1 ? "name" : "names"}. The ledger keeps each signal separate so the next decision starts with the full picture.</> : <>Silence is useful information. Your tracked names remain below their meaningful-change thresholds.</>}</p>
        <p className="attention-summary"><span className="attention-positive">{attentionSummary.positive} positive</span><span className="attention-negative">{attentionSummary.negative} negative</span><span className="attention-conflict">{attentionSummary.conflicts} conflict{attentionSummary.conflicts === 1 ? "" : "s"}</span></p>
      </section>
      <section className="simulation-panel" aria-label="Synthetic thesis evolution demo">
        <div><p className="mono">Guided modelled demo</p><h2>Simulate thesis evolution</h2><p>Generate three synthetic future snapshots, then open NVDA to review a visible conflict and its updated Thesis Fingerprint.</p><div className="simulation-steps"><span>1. Baseline</span><i>→</i><span>2. Three snapshots</span><i>→</i><span>3. Change detected</span><i>→</i><span>4. Fingerprint updated</span></div></div>
        <button onClick={simulate} disabled={busy}>{busy ? "Generating snapshots..." : "Run guided demo"}</button>
      </section>
      {!firstLook && attentionQueue.length > 0 && <section className="attention-queue" aria-labelledby="attention-queue-heading"><div className="attention-queue-heading"><div><p className="mono">Priority review</p><h2 id="attention-queue-heading">What deserves attention</h2></div><p>Ranked transparently by change severity, recorded conflict, then stale-data risk. Open a record to inspect Thesis Unusualness.</p></div><div className="attention-queue-items">{attentionQueue.map((item, index) => { const severity = Math.max(...item.changes.map(change => change.severity), 0); const conflict = hasConflict(item.changes); return <Link key={item.id} className="attention-queue-item" href={`/stock/${item.symbol}${baselineQuery}`}><span className="mono">0{index + 1}</span><strong>{item.symbol}</strong><div className="attention-badges"><em>{severity ? `severity ${severity}/3` : "quiet"}</em>{conflict && <b>conflict</b>}{item.stale && <b>stale</b>}</div><i>Open ↗</i></Link>; })}</div></section>}
      <section className="ledger-controls"><div className="ledger-add"><form onSubmit={addSymbol} className="add-ledger-form"><span>+</span><input ref={addRef} value={symbol} onChange={event => setSymbol(event.target.value)} placeholder="Add a symbol" aria-label="Symbol to track" /><button disabled={busy}>Record</button></form><DemoChips onPick={recordSymbol} disabled={busy} /></div><span className="mono control-date">{new Date().toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}</span></section>
      {message && <p className="ledger-message">{message}</p>}
      {items.length === 0 ? <EmptyState onAdd={() => addRef.current?.focus()} onPick={recordSymbol} disabled={busy} /> : <>
        <section className="ledger-entries">{topItems.map(item => { const conflict = !firstLook && hasConflict(item.changes.filter(signal => !signal.isFirstVisit)); const change = item.changes[0]; const severity = Math.max(...item.changes.map(signal => signal.severity), 0); return <article key={item.id} className={`ledger-entry ${conflict ? "ledger-entry-conflict" : ""}`}><div className="entry-symbol"><Link href={`/stock/${item.symbol}${baselineQuery}`}>{item.symbol}</Link><span className="mono">{item.dataPending ? "--" : item.price !== null ? `$${item.price.toFixed(2)}` : "n/a"}</span><PriceModeLabel mode={dataMode} /></div><div className="entry-change">{item.dataPending ? <><span className="entry-label">data pending</span><p>Waiting for a first snapshot.</p></> : firstLook || change?.isFirstVisit ? <><span className="entry-label">baseline established</span><p>{change ? change.summary : "Modelled current state. No prior visit to compare against."}</p></> : change ? <><span className="entry-label">{conflict ? "conflicting evidence" : signalNames[change.type]}</span><p>{change.summary}</p></> : <><span className="entry-label quiet-label">no material movement</span><p>Nothing crossed the meaningful-change threshold.</p></>}<p className="current-stats">Modelled current: EPS {item.currentStats.epsSurprise ?? "—"}% · analyst {item.currentStats.analystScore ?? "—"} · risk {item.currentStats.riskScore ?? "—"} · P/E {item.currentStats.peRatio ?? "—"} · technical {item.currentStats.technicalScore ?? "—"}</p>{!firstLook && item.changes.length > 1 && <span className="entry-more">+{item.changes.length - 1} more independent signal{item.changes.length === 2 ? "" : "s"}</span>}{showNotes && item.changes.map(signal => <EngineeringNote key={signal.type}>{`${signalNames[signal.type] ?? signal.type}: ${thresholdRule(signal.type)}`}</EngineeringNote>)}{showNotes && <EngineeringNote>{conflict ? "Shown independently — the engine never averages conflicting signals into a false consensus." : "Current values are the latest snapshot; changes are benchmarked against your last visit."}</EngineeringNote>}</div><div className="entry-meta">{severity > 0 && <span className={`severity-pill severity-${severity}`}>severity {severity}/3</span>}{item.stale && <StaleBadge />}{item.changes.length > 0 && <Link href={`/stock/${item.symbol}${baselineQuery}`} aria-label={`Read ${item.symbol} thesis`}>Open record ↗</Link>}<button onClick={() => removeSymbol(item.symbol)} aria-label={`Remove ${item.symbol}`}>×</button></div></article>; })}</section>
        <div className="ledger-silence"><span className="mono">{firstLook ? `${unchangedCount} names on the current baseline` : `${unchangedCount} unchanged since last visit`}</span><span>{items.length} entries · {watchlist?.lastVisit ? `checked ${new Date(watchlist.lastVisit).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}` : "just now"}</span></div>
        {showNotes && <div className="ledger-note-bottom"><EngineeringNote>Snapshot batching is concurrency-capped — large watchlists do not fire 50 sequential requests.</EngineeringNote></div>}
      </>}
      <footer className="ledger-footer"><span>Undertow · what moved beneath the surface</span><span className="mono">modelled thesis signals · demo data · on-read intelligence</span></footer>
    </main>
  );
}
