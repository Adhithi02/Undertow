import { NextResponse } from "next/server";
import { z } from "zod";
import { changesSince, isStale, latestSnapshot, normalizeSymbol, previousSnapshot, requireUser, symbolSchema, toSnapshot } from "@/lib/market";
import { correlateAndDecay } from "@/lib/signals/correlate";

const paramsSchema = z.object({ symbol: z.string().trim().toUpperCase().regex(symbolSchema) });
const querySchema = z.object({ since: z.string().datetime({ offset: true }).optional() });

export async function GET(request: Request, context: { params: Promise<{ symbol: string }> }) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const { symbol } = paramsSchema.parse(await context.params);
    const since = querySchema.parse(Object.fromEntries(new URL(request.url).searchParams)).since;
    const latest = await latestSnapshot(normalizeSymbol(symbol));
    if (!latest) return NextResponse.json({ symbol, dataPending: true, snapshot: null, changes: [], stale: false });
    const current = toSnapshot(latest);
    const previous = since ? await previousSnapshot(symbol, new Date(since)) : user.lastVisit ? await previousSnapshot(symbol, user.lastVisit) : null;
    const changes = changesSince(current, previous ? toSnapshot(previous) : null);
    return NextResponse.json({ symbol, dataPending: false, snapshot: { ...current, fetchedAt: current.fetchedAt.toISOString() }, changes: correlateAndDecay(changes, latest.fetchedAt), stale: isStale(latest.fetchedAt) });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: "Invalid stock request" }, { status: 400 });
    return NextResponse.json({ error: "Unable to load thesis" }, { status: 500 });
  }
}