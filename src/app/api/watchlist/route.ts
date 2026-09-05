import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { changesSince, inChunks, isStale, latestSnapshot, previousSnapshot, requireUser, symbolSchema, toSnapshot } from "@/lib/market";
import { cached } from "@/lib/cache";
import { fetchLivePrice } from "@/lib/price";

const addSchema = z.object({ symbol: z.string().trim().toUpperCase().regex(symbolSchema) });
const watchlistItemSchema = z.object({
  id: z.string(), symbol: z.string(), createdAt: z.string(), price: z.number().nullable(),
  currentStats: z.object({ epsSurprise: z.number().nullable(), analystScore: z.number().nullable(), riskScore: z.number().nullable(), peRatio: z.number().nullable(), technicalScore: z.number().nullable() }),
  changes: z.array(z.unknown()), dataPending: z.boolean(), stale: z.boolean(), fetchedAt: z.string().nullable(),
});
const outputSchema = z.object({ items: z.array(watchlistItemSchema), lastVisit: z.string(), baselineAt: z.string().nullable() });

export async function GET(request?: Request) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const mode = new URL(request?.url ?? "http://localhost/api/watchlist").searchParams.get("mode") === "simulated" ? "simulated" : "live";

  const baselineAt = user.lastVisit;
  const items = await prisma.watchlistItem.findMany({ where: { userId: user.id }, orderBy: { createdAt: "asc" } });
  const result = await inChunks(items, async item => {
    const [latest, livePrice] = await Promise.all([
      latestSnapshot(item.symbol),
      mode === "live" ? cached(`price:${item.symbol}`, () => fetchLivePrice(item.symbol)) : Promise.resolve(null),
    ]);
    const snapshotPrice = (() => {
      if (!latest) return null;
      const price = toSnapshot(latest).signals.price;
      return typeof price === "number" && price > 0 ? price : null;
    })();
    const displayPrice = mode === "simulated" ? snapshotPrice : livePrice ?? snapshotPrice;
    if (!latest) return { id: item.id, symbol: item.symbol, createdAt: item.createdAt.toISOString(), price: displayPrice, currentStats: { epsSurprise: null, analystScore: null, riskScore: null, peRatio: null, technicalScore: null }, changes: [], dataPending: true, stale: false, fetchedAt: null };
    const current = toSnapshot(latest);
    const previous = baselineAt ? await previousSnapshot(item.symbol, baselineAt) : null;
    const changes = changesSince(current, previous ? toSnapshot(previous) : null);
    const numberOrNull = (value: unknown) => typeof value === "number" && Number.isFinite(value) ? value : null;
    return { id: item.id, symbol: item.symbol, createdAt: item.createdAt.toISOString(), price: displayPrice, currentStats: { epsSurprise: numberOrNull(current.signals.epsSurprise), analystScore: numberOrNull(current.signals.analystScore), riskScore: numberOrNull(current.signals.riskScore), peRatio: numberOrNull(current.signals.peRatio), technicalScore: numberOrNull(current.signals.technicalScore) }, changes, dataPending: false, stale: isStale(latest.fetchedAt), fetchedAt: latest.fetchedAt.toISOString() };
  });
  const visitedAt = new Date();
  if (!baselineAt) {
    await prisma.user.update({ where: { id: user.id }, data: { lastVisit: visitedAt } });
  }
  return NextResponse.json(outputSchema.parse({ items: result, lastVisit: visitedAt.toISOString(), baselineAt: baselineAt?.toISOString() ?? null }));
}

export async function POST(request: Request) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const { symbol } = addSchema.parse(await request.json());
    const existing = await prisma.watchlistItem.findUnique({ where: { userId_symbol: { userId: user.id, symbol } } });
    if (existing) return NextResponse.json({ id: existing.id, symbol: existing.symbol, created: false, duplicate: true });
    const item = await prisma.watchlistItem.upsert({ where: { userId_symbol: { userId: user.id, symbol } }, update: {}, create: { userId: user.id, symbol } });
    return NextResponse.json({ id: item.id, symbol: item.symbol, created: true, duplicate: false }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: "Invalid symbol" }, { status: 400 });
    return NextResponse.json({ error: "Unable to update watchlist" }, { status: 500 });
  }
}