import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    $queryRaw: vi.fn(async () => [{ "?column?": 1 }]),
  },
}));

import { prisma } from "@/lib/prisma";
import { GET as getHealth } from "@/app/api/health/route";
import { GET as getDbHealth } from "@/app/api/db-health/route";

beforeEach(() => vi.clearAllMocks());

describe("health routes", () => {
  it("GET /api/health returns 200 without dependencies", async () => {
    const response = await getHealth();
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: "ok" });
  });

  it("GET /api/db-health returns 200 when Prisma can query", async () => {
    const response = await getDbHealth();
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: "ok", db: "connected" });
    expect(prisma.$queryRaw).toHaveBeenCalled();
  });

  it("GET /api/db-health returns 503 on DB failure", async () => {
    vi.mocked(prisma.$queryRaw).mockRejectedValueOnce(new Error("connection refused"));
    const response = await getDbHealth();
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ status: "error", db: "unavailable" });
  });
});
