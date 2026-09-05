import { describe, expect, it, vi } from "vitest";
vi.mock("@/lib/prisma", () => ({ prisma: { user: { findUnique: vi.fn() } } }));

import { getOrCreateUser, signUserId, verifyUserId, UserStore } from "@/lib/auth";
import { POST as logout } from "@/app/api/logout/route";

describe("email-only auth", () => {
  it("rejects a tampered or invalid cookie", () => {
    const signed = signUserId("user_123", "test-secret");
    expect(verifyUserId(`${signed}tampered`, "test-secret")).toBeNull();
    expect(verifyUserId("not-a-signed-cookie", "test-secret")).toBeNull();
  });

  it("resolves two sessions with the same email to one user", async () => {
    const users = new Map<string, { id: string; email: string }>();
    const store: UserStore = {
      user: {
        upsert: async ({ where, create, select }) => {
          const user = users.get(where.email) ?? { id: "user_123", email: create.email };
          users.set(where.email, user);
          return { id: user.id, email: user.email };
        },
        findUnique: async () => null,
      },
    };

    const first = await getOrCreateUser("person@example.com", store);
    const second = await getOrCreateUser("person@example.com", store);

    expect(second.id).toBe(first.id);
    expect(users.size).toBe(1);
  });

  it("clears the auth cookie on logout", async () => {
    const response = await logout();
    expect(response.status).toBe(200);
    expect(response.headers.get("set-cookie")).toContain("pulse_user=");
    expect(response.headers.get("set-cookie")).toContain("Max-Age=0");
  });
});