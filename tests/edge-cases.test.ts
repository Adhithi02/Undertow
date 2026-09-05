import { describe, expect, it, vi } from "vitest";
vi.mock("@/lib/prisma", () => ({ prisma: {} }));
vi.mock("@/lib/auth", () => ({ getCurrentUser: vi.fn() }));

import { inChunks } from "@/lib/market";
import { ThesisChangeEngine } from "@/lib/signals/engine";
import { signalEvaluators } from "@/lib/signals/registry";
import { EarningsEvaluator } from "@/lib/signals/evaluators/earnings";

describe("edge-case invariants", () => {
  it("renders current state on a first visit", () => {
    const result = new EarningsEvaluator().evaluate(null, { symbol: "AAPL", fetchedAt: new Date(), signals: { epsSurprise: 12 } });
    expect(result[0].isFirstVisit).toBe(true);
    expect(result[0].summary).toMatch(/baseline/i);
    expect(result[0].summary).not.toMatch(/since last visit/i);
    expect(result[0].summary).not.toMatch(/versus consensus/i);
  });

  it("keeps conflicting signals independent", () => {
    const changes = new ThesisChangeEngine(signalEvaluators).computeChanges(null, { symbol: "NVDA", fetchedAt: new Date(), signals: { epsSurprise: 12, analystScore: -12 } });
    expect(changes.map(change => change.type)).toEqual(expect.arrayContaining(["earnings", "analyst"]));
    expect(changes).toHaveLength(2);
  });

  it("caps batch concurrency at five", async () => {
    let active = 0;
    let maximum = 0;
    await inChunks(Array.from({ length: 12 }, (_, index) => index), async item => {
      active += 1;
      maximum = Math.max(maximum, active);
      await Promise.resolve(item);
      active -= 1;
      return item;
    });
    expect(maximum).toBeLessThanOrEqual(5);
  });
});