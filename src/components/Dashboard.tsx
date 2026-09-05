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
  async function connect(event: FormEvent) { event.preventDefault(); setEmailError(""); if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) { setEmailError("That doesn't look like an email — check it and try again."); return; } setBusy(true); setMessage(""); try { const response = await fetch("/api/user", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: email.trim() }) }); if (!response.ok) throw new Error("Unable to open ledger"); await loadWatchlist(); } catch { setEmailError("We couldn't open your ledger — try again."); } finally { setBusy(false); } }
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
  async function simulate() { setBusy(true); await fetch("/api/admin/simulate-time", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ minutes: 5 }) }); await loadWatchlist(); setMessage("A new market moment is ready to review."); setBusy(false); }
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
  if (!loggedIn) return <main className="auth-shell"><div className="auth-content"><h1>Undertow</h1><p className="auth-prompt">Open your ledger.</p><form onSubmit={connect} noValidate className="auth-form"><input value={email} onChange={event => { setEmail(event.target.value); setEmailError(""); }} type="email" placeholder="your email" aria-label="Email address" aria-invalid={Boolean(emailError)} /><button disabled={busy}>{busy ? <><span className="button-spinner" aria-hidden="true" />Opening...</> : "Continue"}</button></form>{emailError && <p className="form-error">{emailError}</p>}<p className="auth-note">Email-only access. Your ledger is yours.</p><Link href="/how-it-works" className="auth-guide-link">How Undertow works ↗</Link></div></main>;

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
  const lastVisit = watchlist?.baselineAt ? new Date(watchlist.baselineAt) : null;
  const now = watchlist ? new Date(watchlist.lastVisit) : null;

  return (
    <main className="ledger-shell">
      <header className="ledger-header">
        <Link href="/" className="wordmark">Undertow</Link>
        <div className="header-actions"><span className="mono header-email">Ledger / {email || "active"}</span><button className="logout-link" onClick={logout}>Log out</button><Link href="/how-it-works" className="notes-toggle">How it works</Link><div className="mode-toggle-wrap"><div className="mode-toggle" aria-label="Price data mode"><span className="mode-toggle-prefix">Price:</span><button className={dataMode === "live" ? "mode-active" : ""} onClick={() => changeMode("live")} disabled={busy}>Live</button><button className={dataMode === "simulated" ? "mode-active" : ""} onClick={() => changeMode("simulated")} disabled={busy}>Simulated</button></div><p className="mode-toggle-note">This controls watchlist price only. Thesis signals (earnings, analyst, ownership, risk, valuation, technicals) are modelled demo data in both modes — not live provider feeds.</p></div><button className="notes-toggle" onClick={() => setShowNotes(value => !value)}>{showNotes ? "Hide engineering notes" : "Show engineering notes"}</button><button className="simulate-quiet" onClick={simulate} disabled={busy}>{busy ? "Updating..." : "Advance time"}</button></div>
      </header>
      <section className="briefing">
        {lastVisit && now && <p className="last-visit-strip">Last visit: {format(lastVisit, "EEE, h:mm a")} <span>→</span> Now: {format(now, "EEE, h:mm a")} ({relativeDuration(lastVisit, now)})</p>}
        <div className="briefing-title-row"><p className="briefing-date">{firstLook ? "First look: current modelled baseline — not changes since a prior visit." : allChanges.length ? `Since your last visit, ${allChanges.length} thing${allChanges.length === 1 ? "" : "s"} shifted.` : "Since your last visit, nothing meaningful shifted."}</p><div className="briefing-email-action"><button className="email-briefing-button" onClick={emailBriefing} title="Email this briefing" aria-describedby="email-briefing-note">Email me this briefing</button><span id="email-briefing-note">{emailStatus || "Send it to your account email"}</span></div></div>
        <p className="briefing-body">{firstLook ? <>This visit establishes the baseline. Modelled thesis signals below describe current state, not a fabricated move since last time.</> : conflictItem ? <>{conflictItem.symbol} {conflictItem.changes.find(change => change.direction === "positive")?.summary.toLowerCase()}, but {conflictItem.changes.find(change => change.direction === "negative")?.summary.toLowerCase()} — that&apos;s disagreement, not noise. Worth a look.</> : allChanges.length ? <>New evidence appeared across {changedItems.length} of {items.length} tracked {items.length === 1 ? "name" : "names"}. The ledger keeps each signal separate so the next decision starts with the full picture.</> : <>Silence is useful information. Your tracked names remain below their meaningful-change thresholds.</>}</p>
        <p className="attention-summary"><span className="attention-positive">{attentionSummary.positive} positive</span><span className="attention-negative">{attentionSummary.negative} negative</span><span className="attention-conflict">{attentionSummary.conflicts} conflict{attentionSummary.conflicts === 1 ? "" : "s"}</span></p>
      </section>
      <section className="ledger-controls"><div className="ledger-add"><form onSubmit={addSymbol} className="add-ledger-form"><span>+</span><input ref={addRef} value={symbol} onChange={event => setSymbol(event.target.value)} placeholder="Add a symbol" aria-label="Symbol to track" /><button disabled={busy}>Record</button></form><DemoChips onPick={recordSymbol} disabled={busy} /></div><span className="mono control-date">{new Date().toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}</span></section>
      {message && <p className="ledger-message">{message}</p>}
      {items.length === 0 ? <EmptyState onAdd={() => addRef.current?.focus()} onPick={recordSymbol} disabled={busy} /> : <>
        <section className="ledger-entries">{topItems.map(item => { const conflict = !firstLook && hasConflict(item.changes.filter(signal => !signal.isFirstVisit)); const change = item.changes[0]; return <article key={item.id} className={`ledger-entry ${conflict ? "ledger-entry-conflict" : ""}`}><div className="entry-symbol"><Link href={`/stock/${item.symbol}${baselineQuery}`}>{item.symbol}</Link><span className="mono">{item.dataPending ? "--" : item.price !== null ? `$${item.price.toFixed(2)}` : "n/a"}</span><PriceModeLabel mode={dataMode} /></div><div className="entry-change">{item.dataPending ? <><span className="entry-label">data pending</span><p>Waiting for a first snapshot.</p></> : firstLook || change?.isFirstVisit ? <><span className="entry-label">current baseline</span><p>{change ? change.summary : "Modelled current state. No prior visit to compare against."}</p></> : change ? <><span className="entry-label">{conflict ? "signals disagree" : signalNames[change.type]}</span><p>{change.summary}</p></> : <><span className="entry-label quiet-label">unchanged</span><p>Nothing crossed the meaningful-change threshold.</p></>}<p className="current-stats">Modelled current: EPS {item.currentStats.epsSurprise ?? "—"}% · analyst {item.currentStats.analystScore ?? "—"} · risk {item.currentStats.riskScore ?? "—"} · P/E {item.currentStats.peRatio ?? "—"} · technical {item.currentStats.technicalScore ?? "—"}</p>{!firstLook && item.changes.length > 1 && <span className="entry-more">+{item.changes.length - 1} more signal{item.changes.length === 2 ? "" : "s"}</span>}{showNotes && item.changes.map(signal => <EngineeringNote key={signal.type}>{`${signalNames[signal.type] ?? signal.type}: ${thresholdRule(signal.type)}`}</EngineeringNote>)}{showNotes && <EngineeringNote>{conflict ? "Shown independently — the engine never averages conflicting signals into a false consensus." : "Current values are the latest snapshot; changes are benchmarked against your last visit."}</EngineeringNote>}</div><div className="entry-meta">{item.stale && <StaleBadge />}{item.changes.length > 0 && <Link href={`/stock/${item.symbol}${baselineQuery}`} aria-label={`Read ${item.symbol} thesis`}>read ↗</Link>}<button onClick={() => removeSymbol(item.symbol)} aria-label={`Remove ${item.symbol}`}>×</button></div></article>; })}</section>
        <div className="ledger-silence"><span className="mono">{firstLook ? `${unchangedCount} names on the current baseline` : `${unchangedCount} unchanged since last visit`}</span><span>{items.length} entries · {watchlist?.lastVisit ? `checked ${new Date(watchlist.lastVisit).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}` : "just now"}</span></div>
        {showNotes && <div className="ledger-note-bottom"><EngineeringNote>Snapshot batching is concurrency-capped — large watchlists do not fire 50 sequential requests.</EngineeringNote></div>}
      </>}
      <footer className="ledger-footer"><span>Undertow · what moved beneath the surface</span><span className="mono">modelled thesis signals · demo data · on-read intelligence</span></footer>
    </main>
  );
}
