import { NextResponse } from "next/server";
import { z } from "zod";
import { fetchAnalystConsensus } from "@/lib/analyst-context";
import { cached } from "@/lib/cache";
import { normalizeSymbol, requireUser, symbolSchema } from "@/lib/market";

const paramsSchema = z.object({ symbol: z.string().trim().toUpperCase().regex(symbolSchema) });

/** Supplemental real-data context; it deliberately does not feed the modelled thesis evaluator. */
export async function GET(_request: Request, context: { params: Promise<{ symbol: string }> }) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const { symbol } = paramsSchema.parse(await context.params);
    const analystConsensus = await cached(`analyst-consensus:${symbol}`, () => fetchAnalystConsensus(normalizeSymbol(symbol)));
    return NextResponse.json({
      symbol,
      analystConsensus,
      source: analystConsensus ? "Finnhub recommendation trends" : null,
      fetchedAt: analystConsensus ? new Date().toISOString() : null,
      disclosure: "Supplementary real analyst-consensus context. It does not replace or alter Undertow's modelled analyst signal.",
    });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: "Invalid stock request" }, { status: 400 });
    return NextResponse.json({ error: "Unable to load market context" }, { status: 500 });
  }
}
