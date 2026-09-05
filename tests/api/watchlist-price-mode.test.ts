import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => {
  const user = { id: "user_1", email: "person@example.com", lastVisit: null as Date | null };
  const item = { id: "item_1", userId: user.id, symbol: "AAPL", createdAt: new Date("2026-09-01T00:00:00.000Z") };
  type Snapshot = { id: string; symbol: string; fetchedAt: Date; signals: Record<string, unknown> };
  let snapshot: Snapshot = {
    id: "snapshot_1",
    symbol: "AAPL",
    fetchedAt: new Date("2026-09-04T00:00:00.000Z"),
    signals: { price: 210, epsSurprise: 12, analystScore: -12 },
  };
  return {
    user,
    item,
    get snapshot() {
      return snapshot;
    },
    setSnapshot(next: Snapshot) {
      snapshot = next;
    },
    prisma: {
      user: { update: vi.fn(async ({ data }: { data: { lastVisit: Date } }) => ({ ...user, ...data })) },
      watchlistItem: { findMany: vi.fn(async () => [item]) },
      thesisSnapshot: {
        findFirst: vi.fn(async () => snapshot),
        create: vi.fn(async ({ data }: { data: { symbol: string; fetchedAt: Date; signals: Record<string, unknown> } }) => {
          snapshot = { id: "snapshot_2", ...data };
          return snapshot;
        }),
      },
    },
  };
});

vi.mock("@/lib/prisma", () => ({ prisma: state.prisma }));
vi.mock("@/lib/auth", () => ({ getCurrentUser: vi.fn(async () => state.user) }));
vi.mock("@/lib/cache", () => ({ cached: (_key: string, compute: () => Promise<unknown>) => compute() }));
vi.mock("@/lib/price", () => ({ fetchLivePrice: vi.fn() }));

import { fetchLivePrice } from "@/lib/price";
import { GET as getWatchlist } from "@/app/api/watchlist/route";
import { POST as simulateTime } from "@/app/api/admin/simulate-time/route";

beforeEach(() => {
  vi.clearAllMocks();
  state.setSnapshot({
    id: "snapshot_1",
    symbol: "AAPL",
    fetchedAt: new Date("2026-09-04T00:00:00.000Z"),
    signals: { price: 210, epsSurprise: 12, analystScore: -12 },
  });
});

describe("GET /api/watchlist price mode", () => {
  it("returns Finnhub price in live mode after simulate-time, not the snapshot price", async () => {
    vi.mocked(fetchLivePrice).mockResolvedValue(175.5);

    const simulateResponse = await simulateTime(
      new Request("http://localhost/api/admin/simulate-time", { method: "POST", body: JSON.stringify({ minutes: 5 }) }),
    );
    expect(simulateResponse.status).toBe(200);
    expect(state.snapshot.signals.price).toBe(214);

    const response = await getWatchlist(new Request("http://localhost/api/watchlist?mode=live"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(fetchLivePrice).toHaveBeenCalledWith("AAPL");
    expect(body.items[0].price).toBe(175.5);
    expect(body.items[0].price).not.toBe(214);
  });

  it("returns snapshot price in simulated mode without calling Finnhub", async () => {
    const response = await getWatchlist(new Request("http://localhost/api/watchlist?mode=simulated"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(fetchLivePrice).not.toHaveBeenCalled();
    expect(body.items[0].price).toBe(210);
  });

  it("falls back to snapshot price in live mode only when Finnhub returns null", async () => {
    vi.mocked(fetchLivePrice).mockResolvedValue(null);

    const response = await getWatchlist(new Request("http://localhost/api/watchlist?mode=live"));
    const body = await response.json();

    expect(fetchLivePrice).toHaveBeenCalledWith("AAPL");
    expect(body.items[0].price).toBe(210);
  });
});
