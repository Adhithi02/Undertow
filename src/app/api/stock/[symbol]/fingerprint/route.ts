import { NextResponse } from "next/server";
import { z } from "zod";
import { calculateThesisFingerprint } from "@/lib/fingerprint";
import { prisma } from "@/lib/prisma";
import { normalizeSymbol, requireUser, symbolSchema, toSnapshot } from "@/lib/market";

const paramsSchema = z.object({ symbol: z.string().trim().toUpperCase().regex(symbolSchema) });

/** A new, read-only endpoint; existing thesis route response contracts remain unchanged. */
export async function GET(_request: Request, context: { params: Promise<{ symbol: string }> }) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const { symbol } = paramsSchema.parse(await context.params);
    const snapshots = await prisma.thesisSnapshot.findMany({
      where: { symbol: normalizeSymbol(symbol) },
      orderBy: { fetchedAt: "desc" },
      take: 25,
    });
    const latest = snapshots[0];
    if (!latest) return NextResponse.json({ symbol, dataPending: true, fingerprint: null, timeline: [] });
    const current = toSnapshot(latest);
    const history = snapshots.slice(1).map(toSnapshot);
    const fingerprint = calculateThesisFingerprint(history, current);
    const timeline = [...snapshots]
      .reverse()
      .map(snapshot => ({ fetchedAt: snapshot.fetchedAt.toISOString(), current: snapshot.id === latest.id }));
    return NextResponse.json({ symbol, dataPending: false, fingerprint, timeline });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: "Invalid stock request" }, { status: 400 });
    return NextResponse.json({ error: "Unable to load thesis fingerprint" }, { status: 500 });
  }
}
