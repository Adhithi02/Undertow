# Undertow

[Live demo](https://undertow-mocha.vercel.app/) · [Methodology](https://undertow-mocha.vercel.app/how-it-works)

Undertow is a working market-watchlist submission built around one product question:

> What changed since the user last checked, and which changes require review?

The implementation persists a user watchlist and dated thesis snapshots, evaluates six dimensions independently, and returns only threshold-crossing changes. It also includes an experimental, deterministic “Thesis Fingerprint” that identifies when the latest combination of modelled inputs differs from the stock’s own stored history.

## Requirement coverage

| Challenge expectation | Undertow’s implementation |
| --- | --- |
| Create and manage a watchlist | Email-identified prototype workspace, add/remove symbols, duplicate-safe writes |
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

## Low-level architecture

Undertow is a single Next.js deployment: browser components call App Router handlers; handlers coordinate small domain modules; Prisma persists state in PostgreSQL. There are no background workers or hidden services. The diagrams below name the concrete modules and their ownership boundaries.

### 1. Module and dependency map

```mermaid
flowchart TB
  subgraph browser[Browser components]
    dashboard["Dashboard"]
    detail["StockDetail and ThesisFingerprint"]
  end

  subgraph routes[App Router handlers]
    userRoute["POST /api/user"]
    watchlistRoute["GET and POST /api/watchlist"]
    thesisRoute["GET /api/stock/:symbol/thesis"]
    fingerprintRoute["GET /api/stock/:symbol/fingerprint"]
    contextRoute["GET /api/stock/:symbol/market-context"]
    simulateRoute["POST /api/admin/simulate-time"]
  end

  subgraph domain[Domain modules]
    auth["auth.ts"]
    market["market.ts"]
    engine["signals/engine.ts"]
    correlate["signals/correlate.ts"]
    fingerprint["fingerprint.ts"]
    cache["cache.ts"]
  end

  db[(PostgreSQL via Prisma)]
  finnhub["Finnhub HTTP API"]

  dashboard --> userRoute
  dashboard --> watchlistRoute
  dashboard --> simulateRoute
  detail --> thesisRoute
  detail --> fingerprintRoute
  detail --> contextRoute

  userRoute --> auth --> db
  watchlistRoute --> auth
  watchlistRoute --> market --> engine
  watchlistRoute --> cache --> finnhub
  watchlistRoute --> db
  thesisRoute --> auth
  thesisRoute --> market
  thesisRoute --> correlate
  fingerprintRoute --> auth
  fingerprintRoute --> fingerprint --> db
  contextRoute --> auth
  contextRoute --> cache
  simulateRoute --> auth
  simulateRoute --> db
  market --> db
```

`auth.ts` is the only module that signs or verifies the cookie. `market.ts` is the shared access layer for a latest snapshot, the snapshot before a baseline, staleness, and change-engine dispatch. Finnhub is read-only: a failed call falls back to stored data or returns an explicit unavailable state; it never writes to `ThesisSnapshot`.

### 2. Watchlist read sequence

`GET /api/watchlist` is the central request. It creates a first-visit baseline only after it has assembled the response, so a refresh cannot silently move that baseline.

```mermaid
sequenceDiagram
  participant UI as Dashboard
  participant Route as GET /api/watchlist
  participant Auth as auth.ts
  participant DB as PostgreSQL
  participant Market as market.ts
  participant Cache as cache.ts
  participant Finnhub as Finnhub

  UI->>Route: GET with mode live or simulated
  Route->>Auth: requireUser
  Auth->>DB: find user from verified cookie id
  Route->>DB: find watchlist items for user
  loop Five symbols at a time
    Route->>Market: latestSnapshot and previousSnapshot
    Market->>DB: read latest and pre-baseline snapshots
    alt Live mode
      Route->>Cache: cached price lookup
      Cache->>Finnhub: GET quote on cache miss
      Finnhub-->>Cache: price or failure
    end
    Route->>Market: changesSince current and previous
    Market-->>Route: change events and stale state
  end
  opt First visit only
    Route->>DB: set User.lastVisit
  end
  Route-->>UI: item summaries, changes, baselineAt
```

The route processes watchlist items in chunks of five. A live price is display-only; the six modelled inputs used for change detection always come from the stored snapshot.

### 3. Two independent analysis paths

The thesis briefing and the Thesis Fingerprint share stored snapshots but have different outputs and never alter each other.

```mermaid
flowchart LR
  subgraph briefing[Change briefing]
    previous["Previous snapshot before baseline"] --> evaluators["6 field evaluators"]
    current["Latest snapshot"] --> evaluators
    evaluators --> events["Typed change events"]
    events --> scoring["correlateAndDecay"]
    scoring --> result["Final severity, age, and compounding"]
  end

  subgraph anomaly[Thesis Fingerprint]
    history["2 to 24 prior complete snapshots"] --> normalize["Normalize six dimensions"]
    newest["Latest snapshot"] --> normalize
    normalize --> profile["Centroid and dispersion floor"]
    profile --> distance["RMS standardized distance"]
    distance --> unusualness["0 to 100 unusualness and axis contributions"]
  end
```

For the briefing, each evaluator compares one input in the current and previous snapshot. `correlateAndDecay` applies a 72-hour severity half-life, then adds one severity level when more than one non-neutral signal occurs within 48 hours. For the Fingerprint, `fingerprint.ts` reads at most 25 snapshots, requires two prior complete records, and returns a read-only descriptive score; it does not change briefing thresholds or severities.

### 4. Persistence model

```mermaid
erDiagram
  USER {
    string id PK
    string email UK
    datetime lastVisit
  }
  WATCHLIST_ITEM {
    string id PK
    string userId FK
    string symbol
    datetime createdAt
  }
  THESIS_SNAPSHOT {
    string id PK
    string symbol
    datetime fetchedAt
    json signals
  }

  USER ||--o{ WATCHLIST_ITEM : owns
```

`WatchlistItem` is unique on `(userId, symbol)`, making duplicate adds idempotent. `ThesisSnapshot` deliberately has no user or watchlist foreign key: snapshot history is global per ticker and is indexed by `(symbol, fetchedAt)`. Its `signals` JSON holds the modelled price and six thesis inputs. This is a demo simplification, not a multi-tenant market-data model.

### 5. Route contracts and write boundaries

- `POST /api/user` validates and normalizes an email, upserts `User`, then emits a 30-day HTTP-only signed cookie. It does not verify email ownership.
- `GET /api/watchlist` reads `User`, `WatchlistItem`, and `ThesisSnapshot`; it writes `User.lastVisit` only on the first successful read. `POST` and `DELETE` mutate only `WatchlistItem`.
- `GET /api/stock/[symbol]/thesis`, `fingerprint`, and `market-context` are read-only. Each requires the signed cookie and validates the ticker with Zod.
- `POST /api/admin/simulate-time` is the only path that creates a new `ThesisSnapshot`; it copies the latest modelled signals and applies deterministic demo deltas.
- `GET /api/stock/[symbol]/market-context` fetches Finnhub recommendation counts through the 30-second local cache. That response is rendered as supplementary real context and never replaces the modelled `analystScore`.

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
- **Demo simulation access:** any open prototype workspace can run the synthetic snapshot generator; there is no role model yet.
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
