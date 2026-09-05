import { beforeEach, describe, expect, it, vi } from "vitest";

const signalKeys = ["epsSurprise", "analystScore", "institutionalOwnership", "riskScore", "peRatio", "technicalScore", "price"] as const;

const state = vi.hoisted(() => {
  const baseSignals = {
    price: 100,
    epsSurprise: 4,
    analystScore: 6,
    institutionalOwnership: 2,
    riskScore: 3,
    peRatio: 28,
    technicalScore: 5,
  };
  const seededSymbols = ["AAPL", "NVDA", "MSFT", "AMZN", "TSLA", "COST", "JPM", "LLY", "NFLX"] as const;
  const user = { id: "user_1", email: "demo@pulse.local", lastVisit: null as Date | null };
  const snapshots = new Map<string, { id: string; symbol: string; fetchedAt: Date; signals: Record<string, number> }>(
    seededSymbols.map(symbol => [symbol, { id: `snapshot_${symbol}`, symbol, fetchedAt: new Date("2026-09-04T00:00:00.000Z"), signals: { ...baseSignals } }]),
  );
  return {
    baseSignals,
    seededSymbols,
    user,
    snapshots,
    prisma: {
      watchlistItem: {
        findMany: vi.fn(async () => seededSymbols.map((symbol, index) => ({ symbol, userId: user.id, id: `item_${index}` }))),
      },
      thesisSnapshot: {
        findFirst: vi.fn(async ({ where }: { where: { symbol: string } }) => snapshots.get(where.symbol) ?? null),
        create: vi.fn(async ({ data }: { data: { symbol: string; fetchedAt: Date; signals: Record<string, number> } }) => {
          const created = { id: `snapshot_new_${data.symbol}`, ...data };
          snapshots.set(data.symbol, created);
          return created;
        }),
      },
    },
  };
});

vi.mock("@/lib/prisma", () => ({ prisma: state.prisma }));
vi.mock("@/lib/auth", () => ({ getCurrentUser: vi.fn(async () => state.user) }));

import { POST as simulateTime } from "@/app/api/admin/simulate-time/route";
import { ThesisChangeEngine } from "@/lib/signals/engine";
import { signalEvaluators } from "@/lib/signals/registry";
import { toSnapshot } from "@/lib/market";

const engine = new ThesisChangeEngine(signalEvaluators);

beforeEach(() => {
  vi.clearAllMocks();
  for (const symbol of state.seededSymbols) {
    state.snapshots.set(symbol, {
      id: `snapshot_${symbol}`,
      symbol,
      fetchedAt: new Date("2026-09-04T00:00:00.000Z"),
      signals: symbol === "NVDA"
        ? { price: 142, epsSurprise: 8, analystScore: -7, institutionalOwnership: 4, riskScore: 2, peRatio: 34, technicalScore: 9 }
        : { ...state.baseSignals },
    });
  }
});

describe("POST /api/admin/simulate-time coverage", () => {
  it("mutates all six signal fields plus price for every seeded symbol", async () => {
    const before = new Map([...state.snapshots.entries()].map(([symbol, snapshot]) => [symbol, { ...snapshot.signals }]));

    const response = await simulateTime(new Request("http://localhost/api/admin/simulate-time", { method: "POST", body: JSON.stringify({ minutes: 5 }) }));
    expect(response.status).toBe(200);
    expect((await response.json()).updated).toBe(state.seededSymbols.length);

    for (const symbol of state.seededSymbols) {
      const after = state.snapshots.get(symbol)?.signals;
      const prior = before.get(symbol);
      expect(after, symbol).toBeDefined();
      for (const key of signalKeys) {
        expect(after?.[key], `${symbol}.${key}`).not.toBe(prior?.[key]);
      }
    }
  });

  it("keeps NVDA earnings/analyst conflict after simulate-time", async () => {
    const before = state.snapshots.get("NVDA")!;
    await simulateTime(new Request("http://localhost/api/admin/simulate-time", { method: "POST", body: JSON.stringify({ minutes: 5 }) }));
    const after = state.snapshots.get("NVDA")!;
    const changes = engine.computeChanges(toSnapshot(before), toSnapshot(after));
    const types = changes.map(change => change.type);
    expect(types).toContain("earnings");
    expect(types).toContain("analyst");
    expect(changes.some(change => change.direction === "positive")).toBe(true);
    expect(changes.some(change => change.direction === "negative")).toBe(true);
  });
});
