import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fetchLivePrice } from "@/lib/price";

describe("fetchLivePrice", () => {
  beforeEach(() => vi.stubEnv("FINNHUB_API_KEY", "test-finnhub-key"));
  afterEach(() => { vi.restoreAllMocks(); vi.unstubAllEnvs(); });

  it("returns the current price from a successful response", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ c: 123.45 }), { status: 200 })));
    await expect(fetchLivePrice("AAPL")).resolves.toBe(123.45);
  });

  it("returns null for a non-200 response", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("unavailable", { status: 503 })));
    await expect(fetchLivePrice("AAPL")).resolves.toBeNull();
  });

  it("returns null for timeout or network failures", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network failure")));
    await expect(fetchLivePrice("AAPL")).resolves.toBeNull();
  });

  it("returns null when the response has no valid current price", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ d: 123 }), { status: 200 })));
    await expect(fetchLivePrice("AAPL")).resolves.toBeNull();
  });
});