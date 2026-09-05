import { beforeEach, describe, expect, it, vi } from "vitest";

type Snapshot = { id: string; symbol: string; fetchedAt: Date; signals: Record<string, number> };

const state = vi.hoisted(() => {
  const user = { id: "user_1", email: "person@example.com", lastVisit: null as Date | null };
  const item = { id: "item_1", userId: user.id, symbol: "AAPL", createdAt: new Date("2026-09-01T00:00:00.000Z") };
  const snapshots: Snapshot[] = [];
  return {
    user,
    item,
    snapshots,
    prisma: {
      user: {
        update: vi.fn(async ({ data }: { data: { lastVisit: Date } }) => {
          user.lastVisit = data.lastVisit;
          return { ...user };
        }),
      },
      watchlistItem: { findMany: vi.fn(async () => [item]) },
      thesisSnapshot: {
        findFirst: vi.fn(async ({ where }: { where: { symbol?: string; fetchedAt?: { lt: Date } } }) => {
          const rows = snapshots
            .filter(snapshot => snapshot.symbol === (where.symbol ?? "AAPL"))
            .filter(snapshot => (where.fetchedAt?.lt ? snapshot.fetchedAt < where.fetchedAt.lt : true))
            .sort((a, b) => b.fetchedAt.getTime() - a.fetchedAt.getTime());
          return rows[0] ?? null;
        }),
      },
    },
  };
});

vi.mock("@/lib/prisma", () => ({ prisma: state.prisma }));
vi.mock("@/lib/auth", () => ({ getCurrentUser: vi.fn(async () => state.user) }));
vi.mock("@/lib/cache", () => ({ cached: (_key: string, compute: () => Promise<unknown>) => compute() }));
vi.mock("@/lib/price", () => ({ fetchLivePrice: vi.fn(async () => null) }));

import { GET as getWatchlist } from "@/app/api/watchlist/route";
import { GET as getThesis } from "@/app/api/stock/[symbol]/thesis/route";

const earlySignals = { price: 100, epsSurprise: 4, analystScore: 6, institutionalOwnership: 2, riskScore: 3, peRatio: 20, technicalScore: 5 };
const laterSignals = { price: 110, epsSurprise: 16, analystScore: -8, institutionalOwnership: 14, riskScore: 18, peRatio: 36, technicalScore: 18 };

function seedSnapshot(id: string, fetchedAt: string, signals: Record<string, number>) {
  state.snapshots.push({ id, symbol: "AAPL", fetchedAt: new Date(fetchedAt), signals });
}

beforeEach(() => {
  vi.clearAllMocks();
  state.user.lastVisit = null;
  state.snapshots.length = 0;
  seedSnapshot("snapshot_1", "2026-09-01T00:00:00.000Z", earlySignals);
});

describe("GET /api/watchlist last-visit semantics", () => {
  it("treats a missing lastVisit as a first visit and does not fabricate since-last-visit changes", async () => {
    const response = await getWatchlist(new Request("http://localhost/api/watchlist?mode=simulated"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.baselineAt).toBeNull();
    expect(body.items[0].currentStats.epsSurprise).toBe(4);
    expect(body.items[0].changes.length).toBeGreaterThan(0);
    expect(body.items[0].changes.every((change: { isFirstVisit: boolean }) => change.isFirstVisit)).toBe(true);
    expect(body.items[0].changes.every((change: { summary: string }) => !/since (your )?last visit/i.test(change.summary))).toBe(true);
    expect(state.prisma.user.update).toHaveBeenCalledTimes(1);
    expect(state.user.lastVisit).toBeInstanceOf(Date);
  });

  it("after a first visit, a refresh with the same snapshot does not invent since-last-visit deltas", async () => {
    await getWatchlist(new Request("http://localhost/api/watchlist?mode=simulated"));
    expect(state.user.lastVisit).toBeInstanceOf(Date);

    const response = await getWatchlist(new Request("http://localhost/api/watchlist?mode=simulated"));
    const body = await response.json();

    expect(body.baselineAt).toBe(state.user.lastVisit?.toISOString());
    expect(body.items[0].changes.filter((change: { isFirstVisit: boolean }) => !change.isFirstVisit)).toHaveLength(0);
    expect(state.prisma.user.update).toHaveBeenCalledTimes(1);
  });

  it("keeps first-visit semantics for concurrent duplicate reads before a baseline exists", async () => {
    const [left, right] = await Promise.all([
      getWatchlist(new Request("http://localhost/api/watchlist?mode=simulated")),
      getWatchlist(new Request("http://localhost/api/watchlist?mode=simulated")),
    ]);
    const [leftBody, rightBody] = await Promise.all([left.json(), right.json()]);

    expect(leftBody.baselineAt).toBeNull();
    expect(rightBody.baselineAt).toBeNull();
    expect(leftBody.items[0].changes.every((change: { isFirstVisit: boolean }) => change.isFirstVisit)).toBe(true);
    expect(rightBody.items[0].changes.every((change: { isFirstVisit: boolean }) => change.isFirstVisit)).toBe(true);
  });

  it("on a second visit after a snapshot change, returns real deltas against the stored baseline", async () => {
    state.user.lastVisit = new Date("2026-09-03T00:00:00.000Z");
    seedSnapshot("snapshot_2", "2026-09-05T00:00:00.000Z", laterSignals);

    const response = await getWatchlist(new Request("http://localhost/api/watchlist?mode=simulated"));
    const body = await response.json();

    expect(body.baselineAt).toBe("2026-09-03T00:00:00.000Z");
    expect(body.items[0].changes.length).toBeGreaterThan(0);
    expect(body.items[0].changes.every((change: { isFirstVisit: boolean }) => change.isFirstVisit)).toBe(false);
    expect(body.items[0].changes.map((change: { type: string }) => change.type)).toEqual(
      expect.arrayContaining(["earnings", "analyst", "ownership", "risk", "valuation", "technical"]),
    );
    expect(state.prisma.user.update).not.toHaveBeenCalled();
    expect(state.user.lastVisit.toISOString()).toBe("2026-09-03T00:00:00.000Z");
  });

  it("keeps the same change set across repeated refreshes", async () => {
    state.user.lastVisit = new Date("2026-09-03T00:00:00.000Z");
    seedSnapshot("snapshot_2", "2026-09-05T00:00:00.000Z", laterSignals);

    const first = await (await getWatchlist(new Request("http://localhost/api/watchlist?mode=simulated"))).json();
    const second = await (await getWatchlist(new Request("http://localhost/api/watchlist?mode=simulated"))).json();

    expect(second.baselineAt).toBe(first.baselineAt);
    expect(second.baselineAt).toBe("2026-09-03T00:00:00.000Z");
    expect(second.items[0].changes).toEqual(first.items[0].changes);
    expect(state.user.lastVisit.toISOString()).toBe("2026-09-03T00:00:00.000Z");
    expect(state.prisma.user.update).not.toHaveBeenCalled();
  });

  it("uses a shared baseline for concurrent duplicate reads", async () => {
    state.user.lastVisit = new Date("2026-09-03T00:00:00.000Z");
    seedSnapshot("snapshot_2", "2026-09-05T00:00:00.000Z", laterSignals);

    const [left, right] = await Promise.all([
      getWatchlist(new Request("http://localhost/api/watchlist?mode=simulated")),
      getWatchlist(new Request("http://localhost/api/watchlist?mode=simulated")),
    ]);
    const [leftBody, rightBody] = await Promise.all([left.json(), right.json()]);

    expect(leftBody.baselineAt).toBe("2026-09-03T00:00:00.000Z");
    expect(rightBody.baselineAt).toBe("2026-09-03T00:00:00.000Z");
    expect(leftBody.items[0].changes).toEqual(rightBody.items[0].changes);
    expect(state.prisma.user.update).not.toHaveBeenCalled();
    expect(state.user.lastVisit.toISOString()).toBe("2026-09-03T00:00:00.000Z");
  });

  it("does not present fabricated since-last-visit changes on the thesis page when there is no prior baseline", async () => {
    const response = await getThesis(
      new Request("http://localhost/api/stock/AAPL/thesis?since=1970-01-01T00:00:00.000Z"),
      { params: Promise.resolve({ symbol: "AAPL" }) },
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.changes.length).toBeGreaterThan(0);
    expect(body.changes.every((change: { isFirstVisit: boolean }) => change.isFirstVisit)).toBe(true);
    expect(body.changes.every((change: { summary: string }) => !/since (your )?last visit/i.test(change.summary))).toBe(true);
  });
});
