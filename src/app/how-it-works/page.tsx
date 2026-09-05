import Link from "next/link";

const steps = [
  ["01", "Open your ledger", "Enter an email. Pulse creates or finds your identity and keeps the ledger tied to you with a signed, HTTP-only cookie."],
  ["02", "Record the names you care about", "Add symbols to your watchlist. Duplicate entries are ignored, and an empty ledger always has a clear next action."],
  ["03", "Come back to the evidence", "Pulse compares the latest thesis snapshot with the point when you last visited, not with an arbitrary market timestamp."],
  ["04", "Read what deserves attention", "Earnings, analyst view, ownership, risk, valuation, and technical changes stay independent. Agreement can compound; disagreement stays visible."],
];

const signals = [
  ["Earnings", "EPS surprise", "5 percentage points"],
  ["Analyst view", "Analyst score", "5 points"],
  ["Ownership", "Institutional ownership", "5 percentage points"],
  ["Risk", "Risk score", "5 points"],
  ["Valuation", "P/E ratio", "5 points"],
  ["Technicals", "Technical score", "5 points"],
];

export default function HowItWorksPage() {
  return <main className="walkthrough-shell"><header className="walkthrough-header"><Link href="/" className="wordmark">Pulse</Link><Link href="/" className="walkthrough-back">Return to ledger ↗</Link></header><section className="walkthrough-intro"><p className="mono">A short field guide</p><h1>How Pulse reads the market.</h1><p>Pulse is not trying to give you more prices. It keeps a dated record of the evidence that changed, so returning to your watchlist feels like opening a clear briefing instead of starting from zero.</p></section><section className="walkthrough-steps"><div className="walkthrough-section-label">The flow</div>{steps.map(([number, title, description]) => <article className="walkthrough-step" key={number}><span className="mono walkthrough-number">{number}</span><div><h2>{title}</h2><p>{description}</p></div></article>)}</section><section className="walkthrough-signals"><div className="walkthrough-section-label">What counts as meaningful</div><div className="signal-table">{signals.map(([name, field, threshold]) => <div className="signal-line" key={name}><strong>{name}</strong><span>{field}</span><span className="mono">Δ {threshold}</span></div>)}</div><p className="walkthrough-note">A smaller movement is left alone. Severity rises as a change grows. Risk and valuation read inversely: lower risk and lower P/E are favorable.</p></section><section className="walkthrough-benchmark"><div className="walkthrough-section-label">How the benchmark works</div><div className="benchmark-lines"><p><strong>1. Establish a baseline.</strong> On each watchlist read, Pulse remembers the previous `lastVisit` timestamp and finds the latest snapshot before it.</p><p><strong>2. Compare like with like.</strong> Each evaluator compares only its own current signal with that prior snapshot. Price movement alone cannot create an earnings or analyst change.</p><p><strong>3. Ignore noise.</strong> Deltas below 5 units are not meaningful. A delta from 5 to 9 is severity 1, 10 to 14 is severity 2, and 15 or more is severity 3.</p><p><strong>4. Let time matter.</strong> Correlation applies a 72-hour severity half-life. Different non-neutral signals within 48 hours can compound, capped at severity 3.</p></div></section><section className="walkthrough-conflict"><span className="conflict-mark">↯</span><div><h2>Disagreement is a result.</h2><p>If earnings improve while analysts downgrade, Pulse does not average the two into a comfortable neutral. Both entries remain in the record, and their co-occurrence can compound attention.</p></div></section><section className="walkthrough-demo"><div><p className="mono">Try the loop</p><h2>Advance time, then return.</h2><p>The demo uses simulated thesis signals so the before-and-after behavior is easy to see. Price can be fetched live from Finnhub when configured; every other signal remains simulated.</p></div><Link href="/" className="walkthrough-cta">Open Pulse ↗</Link></section><footer className="ledger-footer"><span>Pulse · a record of what moved</span><span className="mono">field guide / 01</span></footer></main>;
}
