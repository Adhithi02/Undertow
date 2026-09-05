import { describe, expect, it, vi } from "vitest";
import { ThesisChangeEngine } from "@/lib/signals/engine";
import { SignalEvaluator, ThesisChange, ThesisSnapshot } from "@/lib/signals/types";

describe("ThesisChangeEngine", () => {
  it("delegates to every evaluator and flattens their changes", () => {
    const curr: ThesisSnapshot = { symbol: "AAPL", fetchedAt: new Date(), signals: {} };
    const firstChange: ThesisChange = { type: "earnings", direction: "positive", severity: 1, summary: "first", isFirstVisit: false };
    const secondChange: ThesisChange = { type: "risk", direction: "negative", severity: 2, summary: "second", isFirstVisit: false };
    const first: SignalEvaluator = { type: "earnings", evaluate: vi.fn(() => [firstChange]) };
    const second: SignalEvaluator = { type: "risk", evaluate: vi.fn(() => [secondChange]) };

    const changes = new ThesisChangeEngine([first, second]).computeChanges(null, curr);

    expect(changes).toEqual([firstChange, secondChange]);
    expect(first.evaluate).toHaveBeenCalledWith(null, curr);
    expect(second.evaluate).toHaveBeenCalledWith(null, curr);
  });
});