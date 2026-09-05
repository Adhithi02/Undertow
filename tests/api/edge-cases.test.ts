import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  user: { id: "user_1", email: "person@example.com", lastVisit: null as Date | null },
  item: { id: "item_1", userId: "user_1", symbol: "AAPL", createdAt: new Date("2026-09-01T00:00:00.000Z") },
  snapshot: { id: "snapshot_1", symbol: "AAPL", fetchedAt: new Date("2026-09-04T00:00:00.000Z"), signals: { price: 210, epsSurprise: 12 } },
  prisma: {
    user: { update: vi.fn(async () => state.user) },
    watchlistItem: { findMany: vi.fn(async (): Promise<Array<typeof state.item>> => [state.item]), findUnique: vi.fn(async (): Promise<typeof state.item | null> => null) },
    thesisSnapshot: { findFirst: vi.fn(async (): Promise<typeof state.snapshot | null> => state.snapshot) },
  },
}));

vi.mock("@/lib/prisma", () => ({ prisma: state.prisma }));
vi.mock("@/lib/auth", () => ({ getCurrentUser: vi.fn(async () => state.user) }));

import { GET as getWatchlist, POST as postWatchlist } from "@/app/api/watchlist/route";
import { GET as getThesis } from "@/app/api/stock/[symbol]/thesis/route";

beforeEach(() => vi.clearAllMocks());

describe("API edge cases", () => {
  it("returns an explicit empty watchlist", async () => {
    state.prisma.watchlistItem.findMany.mockResolvedValueOnce([]);
    const response = await getWatchlist();
    expect((await response.json()).items).toEqual([]);
  });

  it("returns data pending when a symbol has no snapshot", async () => {
    state.prisma.thesisSnapshot.findFirst.mockResolvedValueOnce(null);
    const response = await getThesis(new Request("http://localhost/api/stock/NEW/thesis"), { params: Promise.resolve({ symbol: "NEW" }) });
    expect((await response.json()).dataPending).toBe(true);
  });

  it("marks an old snapshot stale while retaining its data", async () => {
    state.prisma.thesisSnapshot.findFirst.mockResolvedValueOnce({ ...state.snapshot, fetchedAt: new Date("2020-01-01T00:00:00.000Z") });
    const response = await getThesis(new Request("http://localhost/api/stock/AAPL/thesis"), { params: Promise.resolve({ symbol: "AAPL" }) });
    const body = await response.json();
    expect(body.stale).toBe(true);
    expect(body.snapshot.signals.price).toBe(210);
  });

  it("treats duplicate adds as an idempotent no-op", async () => {
    state.prisma.watchlistItem.findUnique.mockResolvedValueOnce(state.item);
    const response = await postWatchlist(new Request("http://localhost/api/watchlist", { method: "POST", body: JSON.stringify({ symbol: "AAPL" }) }));
    expect((await response.json()).duplicate).toBe(true);
  });
});