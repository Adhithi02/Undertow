export type AnalystConsensus = {
  period: string;
  strongBuy: number;
  buy: number;
  hold: number;
  sell: number;
  strongSell: number;
  total: number;
};

type RecommendationPayload = Omit<AnalystConsensus, "total">;
type RecommendationCountKey = "strongBuy" | "buy" | "hold" | "sell" | "strongSell";

function isCount(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

function toConsensus(value: unknown): AnalystConsensus | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const row = value as Record<string, unknown>;
  if (typeof row.period !== "string") return null;
  const keys: RecommendationCountKey[] = ["strongBuy", "buy", "hold", "sell", "strongSell"];
  if (!keys.every(key => isCount(row[key]))) return null;
  const consensus = row as unknown as RecommendationPayload;
  return { ...consensus, total: keys.reduce((total, key) => total + consensus[key], 0) };
}

/** Real, supplementary market context. It never writes to or replaces Undertow's modelled analystScore. */
export async function fetchAnalystConsensus(symbol: string): Promise<AnalystConsensus | null> {
  const apiKey = process.env.FINNHUB_API_KEY;
  if (!apiKey) return null;
  try {
    const response = await fetch(
      `https://finnhub.io/api/v1/stock/recommendation?symbol=${encodeURIComponent(symbol)}&token=${encodeURIComponent(apiKey)}`,
      { signal: AbortSignal.timeout(3000), cache: "no-store" },
    );
    if (!response.ok) return null;
    const payload: unknown = await response.json();
    if (!Array.isArray(payload)) return null;
    return toConsensus(payload.find(value => toConsensus(value) !== null) ?? null);
  } catch {
    return null;
  }
}
