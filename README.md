# Undertow

[Live demo](https://undertow-mocha.vercel.app/) · [Methodology](https://undertow-mocha.vercel.app/how-it-works)

Undertow is a working market-watchlist submission built around one product question:

> What changed since the user last checked, and which changes require review?

The implementation persists a user watchlist and dated thesis snapshots, evaluates six dimensions independently, and returns only threshold-crossing changes. It also includes an experimental, deterministic “Thesis Fingerprint” that identifies when the latest combination of modelled inputs differs from the stock’s own stored history.

## Requirement coverage

| Challenge expectation | Undertow’s implementation |
| --- | --- |
| Create and manage a watchlist | Email-backed user identity, add/remove symbols, duplicate-safe writes |
| View current market information | Optional live Finnhub price, otherwise a clearly labelled snapshot price |
| Return later and understand change | Persistent `lastVisit` baseline and dated `ThesisSnapshot` records |
| Decide what matters | Per-signal thresholds, severity levels, conflict visibility, attention queue |
| Handle imperfect data | Explicit first-visit, stale, pending-data, invalid-input, and provider-failure states |
| Build end-to-end | Next.js UI + API routes + PostgreSQL/Prisma + auth + tests + deployed environment |

## Problem and scope

The brief leaves the definition of a “meaningful” market change open. Undertow interprets it as a material movement in one or more independent thesis dimensions, measured against a persisted user baseline—not a rolling price alert.

| Typical watchlist | Undertow |
| --- | --- |
| “What is the price?” | “What changed in the thesis?” |
| One blended recommendation | Six independent signal dimensions |
| Every movement competes for attention | Small deltas are filtered as noise |
| Agreement is assumed | Conflict is explicitly surfaced |
| No personal context | Comparison is anchored to the user’s baseline |

The key product choice is to avoid a blended buy/sell score. If earnings improve while analyst sentiment weakens, the interface exposes the disagreement instead of reducing it to a neutral average.

## Reviewer walkthrough

1. Open the [live app](https://undertow-mocha.vercel.app/) and sign in with `demo@undertow.local`.
2. Review the baseline ledger. It is labelled as current modelled state—not fabricated “change since last visit.”
3. Click **Run guided demo**. It creates three clearly labelled synthetic future snapshots.
4. Review **What deserves attention**. Items are ranked transparently by severity, conflict, then stale-data risk.
5. Open **NVDA**. Its earnings and analyst dimensions demonstrate conflict.
6. Inspect **Thesis Fingerprint**, the historical timeline, current-versus-profile Thesis Shape, and per-dimension contributors.
7. Review the separate Finnhub analyst-recommendation context when it is available for the configured API plan.

## Data provenance and disclosure

The application distinguishes provider data, demo inputs, and derived calculations in the UI and below.

| Category | What Undertow uses | How it is used |
| --- | --- | --- |
| **Real, optional** | Finnhub current quote | Watchlist price in Live mode |
| **Real, optional** | Finnhub analyst recommendation trend | Supplementary context only; never replaces the modelled analyst signal |
| **Modelled demo data** | Earnings, analyst, ownership, risk, valuation, technical inputs | Seeded and synthetic snapshot fields used to demonstrate the thesis-change workflow |
| **Derived intelligence** | Thresholds, severity, compounding, decay, Thesis Fingerprint | Deterministic calculations over available snapshots; not predictions or investment advice |

The six thesis inputs are **not** represented as live earnings, consensus, RSI, ownership, litigation, or risk feeds. Thesis Fingerprint is experimental anomaly detection over Undertow’s available snapshot history; it is not trained on external market data and does not predict returns.

## Implementation

### Snapshot comparison and user baseline

Each symbol has dated `ThesisSnapshot` records. Undertow compares the latest snapshot to the most recent snapshot before the user’s stored `lastVisit` baseline.

- First visit: shows current baseline evidence, never fabricated historical changes.
- Later visit: shows only material per-dimension deltas.
- Refreshes: retain the existing baseline and therefore the same current change set.

### Independent signal evaluation

| Signal | Snapshot field | Meaningful delta | Favorable direction |
| --- | --- | --- | --- |
| Earnings | `epsSurprise` | ≥ 5 percentage points | Higher |
| Analyst view | `analystScore` | ≥ 5 points | Higher |
| Ownership | `institutionalOwnership` | ≥ 5 percentage points | Higher |
| Risk | `riskScore` | ≥ 5 points | Lower |
| Valuation | `peRatio` | ≥ 5× | Lower |
| Technicals | `technicalScore` | ≥ 5 points | Higher |

Severity is 1 for a meaningful movement, 2 at a delta of 10 or more, and 3 at 15 or more.

### Cross-signal reasoning

The detail view applies a 72-hour severity half-life. When multiple distinct non-neutral signals are detected inside 48 hours, they compound attention by one level, capped at severity 3. The original evaluator thresholds remain independent of this temporal layer.

### Thesis Fingerprint — experimental ML signal

The existing change engine identifies delta events. Thesis Fingerprint separately measures whether the newest six-dimensional state is atypical for the same symbol’s available snapshot history.

It is an isolated, deterministic anomaly detector:

1. Normalize the six modelled fields onto comparable bounded axes.
2. Use prior complete snapshots to calculate a historical centroid and per-dimension population standard deviation.
3. Calculate each standardized departure:

   `dᵢ = |currentᵢ − centroidᵢ| / max(stddevᵢ, 0.10)`

4. Calculate the overall RMS distance across six dimensions.
5. Convert distance to an unusualness score:

   `round(100 × (1 − exp(−distance / 2)))`

The resulting score is bounded to 0–100: **Normal** (<30), **Watch** (30–59), or **Unusual** (≥60). Each dimension contributes according to its share of squared distance. Two prior complete snapshots are required before scoring begins.

This consumes snapshot history only. It does not change signal thresholds, evaluator semantics, change-engine orchestration, correlation/compounding, or decay mathematics.

## Architecture

```mermaid
flowchart TB
  subgraph Client[Next.js client]
    Dashboard[Dashboard / attention queue]
    Detail[Stock detail / fingerprint]
    Guide[Methodology page]
  end

  subgraph API[App Router API]
    User[/api/user]
    Watchlist[/api/watchlist]
    Thesis[/api/stock/:symbol/thesis]
    Fingerprint[/api/stock/:symbol/fingerprint]
    Context[/api/stock/:symbol/market-context]
    Simulate[/api/admin/simulate-time]
  end

  subgraph Domain[Domain layer]
    Engine[ThesisChangeEngine]
    Evaluators[6 independent evaluators]
    Decay[Correlation + decay]
    Anomaly[Thesis Fingerprint]
    Finnhub[Finnhub adapters]
  end

  subgraph Storage[Persistence and providers]
    DB[(PostgreSQL via Prisma)]
    Market[Finnhub API]
  end

  Dashboard --> User
  Dashboard --> Watchlist
  Dashboard --> Simulate
  Detail --> Thesis
  Detail --> Fingerprint
  Detail --> Context
  Watchlist --> Engine
  Thesis --> Engine --> Evaluators
  Thesis --> Decay
  Fingerprint --> Anomaly
  Context --> Finnhub
  Watchlist --> Finnhub
  API --> DB
  Finnhub --> Market
```

### Read paths

**Watchlist**

1. Authenticate with an HMAC-signed, HTTP-only cookie.
2. Load the user’s watchlist and each latest snapshot in batches of five.
3. Resolve live Finnhub price or stored snapshot price by selected mode.
4. Compare the latest snapshot with the pre-baseline snapshot through the unchanged evaluator engine.
5. Persist `lastVisit` only when a user establishes their first baseline.

**Fingerprint**

1. Read up to 25 snapshots for one symbol.
2. Treat the newest as current and the remaining complete snapshots as history.
3. Return unusualness, per-axis contributions, and a timeline through a read-only endpoint.

**Supplementary real analyst context**

1. Read Finnhub’s `GET /stock/recommendation` response through a 30-second in-memory cache.
2. Present recommendation counts, provider period, source, and fetch time separately from modelled inputs.
3. Return an explicit unavailable state for a missing key, unsupported plan, malformed response, or provider failure.

## Reliability and edge cases

| Situation | Behaviour |
| --- | --- |
| First visit | Establishes a baseline; does not invent “since last visit” movement |
| Concurrent first reads | Shared-baseline semantics are tested |
| Duplicate symbol add | Idempotent no-op |
| Symbol with no snapshot | Explicit `dataPending` response and UI state |
| Snapshot older than 24 hours | Data stays visible and receives a stale marker |
| Finnhub failure | Live price falls back to snapshot price; analyst context reports unavailable |
| Invalid email or ticker | Zod validation returns an explicit 400 response |
| Tampered session cookie | Timing-safe HMAC verification rejects it |
| Larger watchlists | Async snapshot work is concurrency-capped at five |
| Too little fingerprint history | “History building” is shown instead of a fabricated score |

## Engineering decisions and trade-offs

- **Persistent baseline, not a refresh timestamp:** a refresh cannot hide a change the user has not reviewed. The trade-off is that `lastVisit` is not a rolling “last page load” marker.
- **Independent dimensions, not a single score:** preserves conflict and makes the rule behind each briefing entry inspectable. The trade-off is a denser interface.
- **Deterministic anomaly detection, not a black-box model:** local execution, reproducible outputs, and direct unit tests. It intentionally does not claim predictive validity.
- **Global snapshots per symbol:** reduces schema and ingestion complexity for the demo. A production design should add source, ownership, and ingestion metadata.
- **Process-local cache:** bounds provider calls in one deployment instance. A multi-instance deployment needs shared caching and invalidation.
- **Email-only identity:** keeps the prototype friction low. It is not an appropriate authentication model for a production financial product.

## Project structure

```text
undertow/
├── prisma/
│   ├── schema.prisma                 # User, WatchlistItem, ThesisSnapshot
│   └── seed.ts                       # 9 demo symbols × 4 modelled snapshots
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── admin/simulate-time/  # Synthetic snapshot generator
│   │   │   ├── stock/[symbol]/
│   │   │   │   ├── thesis/           # Change detail
│   │   │   │   ├── fingerprint/       # Experimental anomaly signal
│   │   │   │   └── market-context/    # Finnhub recommendation context
│   │   │   ├── watchlist/             # Read/add/remove watchlist
│   │   │   └── user, logout, health, db-health, briefing/
│   │   ├── how-it-works/              # Product methodology
│   │   └── stock/[symbol]/            # Research-workstation route
│   ├── components/
│   │   ├── Dashboard.tsx              # Briefing, queue, demo flow
│   │   ├── StockDetail.tsx            # Thesis workstation
│   │   └── ThesisFingerprint.tsx      # Shape, timeline, contributors
│   └── lib/
│       ├── signals/                   # Engine, registry, evaluators, decay
│       ├── fingerprint.ts             # Pure anomaly calculation
│       ├── analyst-context.ts          # Finnhub recommendation adapter
│       ├── auth.ts, market.ts, price.ts, cache.ts, prisma.ts
├── tests/
│   ├── signals/                       # Evaluator, engine, and decay tests
│   ├── api/                           # Route and baseline semantics tests
│   ├── fingerprint.test.ts
│   └── analyst-context.test.ts
└── README.md
```

## API surface

| Route | Purpose |
| --- | --- |
| `POST /api/user` | Create/find email identity and set signed cookie |
| `POST /api/logout` | Clear signed cookie |
| `GET/POST /api/watchlist` | Read or add user watchlist symbols |
| `DELETE /api/watchlist/[symbol]` | Remove a watched symbol |
| `GET /api/stock/[symbol]/thesis` | Current snapshot, change events, decay/compounding detail |
| `GET /api/stock/[symbol]/fingerprint` | Experimental unusualness, contributors, snapshot timeline |
| `GET /api/stock/[symbol]/market-context` | Supplementary Finnhub analyst-recommendation counts |
| `POST /api/admin/simulate-time` | Create one synthetic future snapshot per selected symbol |
| `POST /api/briefing/email` | Deliver user-generated briefing through configured SMTP |
| `GET /api/health` / `GET /api/db-health` | Process and database health checks |

## Local setup

### Prerequisites

- Node.js 20+
- PostgreSQL database, such as Neon

```bash
git clone https://github.com/Adhithi02/pulse.git
cd pulse
cp .env.example .env
npm install
npx prisma migrate deploy
npm run db:seed
npm run dev
```

Set the following in `.env`:

| Variable | Required | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `AUTH_SECRET` or `COOKIE_SECRET` | Yes | HMAC signing secret for the session cookie |
| `FINNHUB_API_KEY` | Optional | Live price and supplementary analyst-context requests |
| `SMTP_*` | Optional | “Email me this briefing” delivery |

Open [http://localhost:3000](http://localhost:3000), sign in with `demo@undertow.local`, and run the guided demo.

## Validation

```bash
npm run test
npm run build
npm run lint
```

The suite covers signal evaluators, engine composition, decay and compounding, auth-cookie integrity, first-visit baseline semantics, concurrency limits, pending/stale data, API input validation, Finnhub failure handling, Fingerprint bounds/contributions/determinism, and analyst-context parsing.

## Limitations and intentional omissions

- **Modelled inputs:** earnings, analyst score, ownership, risk, valuation, and technical values are demo data. They are not live fundamental, consensus, ownership, technical, or risk feeds.
- **Provider coverage:** Finnhub recommendation trends are optional and may be unavailable because of symbol coverage or plan access. Their failure does not produce synthetic real-data context.
- **No external validation of Fingerprint:** unusualness describes distance from stored snapshots; it has not been validated as a predictor of price, returns, or investment outcomes.
- **Snapshot tenancy:** snapshots are keyed globally by ticker, not by user or data source.
- **Demo simulation access:** any authenticated user can run the synthetic snapshot generator; there is no role model yet.
- **Baseline semantics:** the initial baseline persists across refreshes. There is no explicit “mark as reviewed” action to advance it.
- **Caching and jobs:** cache state is process-local; there are no scheduled ingestion jobs, queueing, retries, or provider observability.
- **Authentication:** email identity is unverified and not suitable for a production account system.
- **Testing boundary:** the test suite exercises unit and mocked route behaviour; it does not run browser E2E tests or a real deployed Postgres/Finnhub/SMTP integration test.

## Next steps

1. Add source-attributed real ingestion for one thesis dimension at a time.
2. Move caching and provider-health reporting to shared infrastructure.
3. Add verified authentication and roles for production administration.
4. Introduce source-level freshness and confidence metadata.

---

Undertow is a research-support prototype. It does not provide investment advice, buy/sell recommendations, or return predictions.
