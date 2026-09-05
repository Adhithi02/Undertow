import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => {
  const users = new Map<string, { id: string; email: string; lastVisit: Date | null }>([
    ["person@example.com", { id: "user_123", email: "person@example.com", lastVisit: null }],
  ]);
  const watchlist = [{ id: "item_1", userId: "user_123", symbol: "AAPL", createdAt: new Date("2026-09-01T00:00:00.000Z") }];
  let currentUser: { id: string; email: string; lastVisit: Date | null } | null = null;
  return {
    users,
    watchlist,
    get currentUser() {
      return currentUser;
    },
    setCurrentUser(user: { id: string; email: string; lastVisit: Date | null } | null) {
      currentUser = user;
    },
    prisma: {
      user: {
        upsert: vi.fn(async ({ where, create }: { where: { email: string }; create: { email: string } }) => {
          const existing = users.get(where.email);
          if (existing) return { id: existing.id, email: existing.email };
          const created = { id: "user_new", email: create.email, lastVisit: null };
          users.set(where.email, created);
          return { id: created.id, email: created.email };
        }),
        findUnique: vi.fn(async ({ where }: { where: { id: string } }) => {
          return [...users.values()].find(user => user.id === where.id) ?? null;
        }),
        update: vi.fn(async ({ where, data }: { where: { id: string }; data: { lastVisit: Date } }) => {
          const user = [...users.values()].find(entry => entry.id === where.id);
          if (!user) throw new Error("missing user");
          user.lastVisit = data.lastVisit;
          return user;
        }),
      },
      watchlistItem: {
        findMany: vi.fn(async ({ where }: { where: { userId: string } }) => watchlist.filter(item => item.userId === where.userId)),
      },
      thesisSnapshot: {
        findFirst: vi.fn(async () => ({
          id: "snapshot_1",
          symbol: "AAPL",
          fetchedAt: new Date("2026-09-04T00:00:00.000Z"),
          signals: { price: 210, epsSurprise: 12, analystScore: -12, institutionalOwnership: 2, riskScore: 3, peRatio: 28, technicalScore: 5 },
        })),
      },
    },
  };
});

vi.mock("@/lib/prisma", () => ({ prisma: state.prisma }));
vi.mock("@/lib/auth", async importOriginal => {
  const actual = await importOriginal<typeof import("@/lib/auth")>();
  return {
    ...actual,
    getCurrentUser: vi.fn(async () => state.currentUser),
  };
});
vi.mock("@/lib/cache", () => ({ cached: (_key: string, compute: () => Promise<unknown>) => compute() }));
vi.mock("@/lib/price", () => ({ fetchLivePrice: vi.fn(async () => null) }));

import { POST as postUser } from "@/app/api/user/route";
import { POST as logout } from "@/app/api/logout/route";
import { GET as getWatchlist } from "@/app/api/watchlist/route";

beforeEach(() => {
  vi.clearAllMocks();
  process.env.AUTH_SECRET = "test-secret";
  state.setCurrentUser(null);
});

describe("logout/login watchlist round-trip", () => {
  it("restores the same watchlist after logout and login with the same email", async () => {
    const login = await postUser(new Request("http://localhost/api/user", { method: "POST", body: JSON.stringify({ email: "person@example.com" }) }));
    expect(login.status).toBe(200);
    state.setCurrentUser(state.users.get("person@example.com") ?? null);

    const firstWatchlist = await getWatchlist();
    expect(firstWatchlist.status).toBe(200);
    const firstBody = await firstWatchlist.json();
    expect(firstBody.items).toHaveLength(1);
    expect(firstBody.items[0].symbol).toBe("AAPL");

    const loggedOut = await logout();
    expect(loggedOut.headers.get("set-cookie")).toContain("Max-Age=0");
    state.setCurrentUser(null);

    const unauthorized = await getWatchlist();
    expect(unauthorized.status).toBe(401);

    const relogin = await postUser(new Request("http://localhost/api/user", { method: "POST", body: JSON.stringify({ email: "person@example.com" }) }));
    expect(relogin.status).toBe(200);
    state.setCurrentUser(state.users.get("person@example.com") ?? null);

    const secondWatchlist = await getWatchlist();
    expect(secondWatchlist.status).toBe(200);
    const secondBody = await secondWatchlist.json();
    expect(secondBody.items).toHaveLength(firstBody.items.length);
    expect(secondBody.items[0].symbol).toBe(firstBody.items[0].symbol);
    expect(secondBody.items[0].id).toBe(firstBody.items[0].id);
    expect(state.prisma.user.upsert).toHaveBeenCalledTimes(2);
  });
});
