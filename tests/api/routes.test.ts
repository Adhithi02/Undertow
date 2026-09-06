import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => {
  const user = { id: "user_1", email: "person@example.com", lastVisit: null as Date | null };
  const item = { id: "item_1", userId: user.id, symbol: "AAPL", createdAt: new Date("2026-09-01T00:00:00.000Z") };
  // Keep the test inside the 48-hour compounding window regardless of the day it runs.
  const snapshot = { id: "snapshot_1", symbol: "AAPL", fetchedAt: new Date(), signals: { price: 210, epsSurprise: 12, analystScore: -12 } };
  return {
    user,
    item,
    snapshot,
    prisma: {
      user: { update: vi.fn(async ({ data }: { data: { lastVisit: Date } }) => ({ ...user, ...data })) },
      watchlistItem: {
        findMany: vi.fn(async () => [item]),
        findUnique: vi.fn(async () => null),
        upsert: vi.fn(async () => item),
        deleteMany: vi.fn(async () => ({ count: 1 })),
      },
      thesisSnapshot: {
        findFirst: vi.fn(async () => snapshot),
        create: vi.fn(async ({ data }: { data: object }) => ({ ...snapshot, ...data })),
      },
    },
  };
});

vi.mock("@/lib/prisma", () => ({ prisma: state.prisma }));
vi.mock("@/lib/auth", () => ({
  AUTH_COOKIE_NAME: "undertow_user",
  getCurrentUser: vi.fn(async () => state.user),
  getOrCreateUser: vi.fn(async (email: string) => ({ id: state.user.id, email })),
  signUserId: vi.fn(() => "signed-user"),
}));

import { POST as postUser } from "@/app/api/user/route";
import { getOrCreateUser, signUserId } from "@/lib/auth";
import { GET as getWatchlist, POST as postWatchlist } from "@/app/api/watchlist/route";
import { DELETE as deleteWatchlistItem } from "@/app/api/watchlist/[symbol]/route";
import { GET as getThesis } from "@/app/api/stock/[symbol]/thesis/route";
import { POST as simulateTime } from "@/app/api/admin/simulate-time/route";

beforeEach(() => vi.clearAllMocks());

describe("API routes", () => {
  it("integrates POST /api/user", async () => {
    const response = await postUser(new Request("http://localhost/api/user", { method: "POST", body: JSON.stringify({ email: "person@example.com" }) }));
    expect(getOrCreateUser).toHaveBeenCalled();
    expect(signUserId).toHaveBeenCalled();
    expect(response.status, await response.clone().text()).toBe(200);
    expect(response.headers.get("set-cookie")).toContain("undertow_user=signed-user");
  });

  it("integrates GET /api/watchlist and records lastVisit on first visit", async () => {
    const response = await getWatchlist();
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.items[0].symbol).toBe("AAPL");
    expect(body.baselineAt).toBeNull();
    expect(state.prisma.user.update).toHaveBeenCalled();
  });

  it("rejects malformed POST /api/watchlist input with 400", async () => {
    const response = await postWatchlist(new Request("http://localhost/api/watchlist", { method: "POST", body: JSON.stringify({ symbol: "not valid" }) }));
    expect(response.status).toBe(400);
  });

  it("integrates DELETE /api/watchlist/:symbol", async () => {
    const response = await deleteWatchlistItem(new Request("http://localhost/api/watchlist/AAPL", { method: "DELETE" }), { params: Promise.resolve({ symbol: "AAPL" }) });
    expect(response.status).toBe(200);
    expect((await response.json()).deleted).toBe(true);
  });

  it("integrates GET /api/stock/:symbol/thesis", async () => {
    const response = await getThesis(new Request("http://localhost/api/stock/AAPL/thesis"), { params: Promise.resolve({ symbol: "AAPL" }) });
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.snapshot.signals.price).toBe(210);
    expect(body.changes).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: "earnings", compounding: true }),
      expect.objectContaining({ type: "analyst", compounding: true }),
    ]));
  });

  it("integrates POST /api/admin/simulate-time", async () => {
    const response = await simulateTime(new Request("http://localhost/api/admin/simulate-time", { method: "POST", body: JSON.stringify({ minutes: 5 }) }));
    expect(response.status).toBe(200);
    expect((await response.json()).updated).toBe(1);
    expect(state.prisma.thesisSnapshot.create).toHaveBeenCalled();
  });
});
