import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fetchAnalystConsensus } from "@/lib/analyst-context";

describe("fetchAnalystConsensus", () => {
  beforeEach(() => vi.stubEnv("FINNHUB_API_KEY", "test-finnhub-key"));
  afterEach(() => { vi.restoreAllMocks(); vi.unstubAllEnvs(); });

  it("returns the latest valid Finnhub recommendation trend with a transparent total", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify([
      { period: "2026-08", strongBuy: 4, buy: 7, hold: 3, sell: 1, strongSell: 0 },
    ]), { status: 200 })));
    await expect(fetchAnalystConsensus("AAPL")).resolves.toEqual({ period: "2026-08", strongBuy: 4, buy: 7, hold: 3, sell: 1, strongSell: 0, total: 15 });
  });

  it("returns null for unavailable or malformed provider data", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify([{ period: "2026-08", buy: "7" }]), { status: 200 })));
    await expect(fetchAnalystConsensus("AAPL")).resolves.toBeNull();
  });
});
