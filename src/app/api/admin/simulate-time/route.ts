import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

const inputSchema = z.object({ symbol: z.string().trim().toUpperCase().optional(), minutes: z.number().int().positive().optional() }).optional().default({});

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const input = inputSchema.parse(await request.json().catch(() => ({})));
    const symbols = input.symbol ? [input.symbol] : (await prisma.watchlistItem.findMany({ where: { userId: user.id }, select: { symbol: true } })).map(item => item.symbol);
    const snapshots = await Promise.all(symbols.map(async symbol => {
      const latest = await prisma.thesisSnapshot.findFirst({ where: { symbol }, orderBy: { fetchedAt: "desc" } });
      if (!latest) return null;
      const signals = latest.signals && typeof latest.signals === "object" && !Array.isArray(latest.signals) ? { ...(latest.signals as Record<string, unknown>) } : {};
      const deltas: Record<string, number> = { epsSurprise: 8, analystScore: -8, institutionalOwnership: 6, riskScore: 7, peRatio: 6, technicalScore: 8, price: 4 };
      for (const [key, delta] of Object.entries(deltas)) if (typeof signals[key] === "number") signals[key] = (signals[key] as number) + delta;
      return prisma.thesisSnapshot.create({ data: { symbol, fetchedAt: new Date(Date.now() + (input.minutes ?? 1) * 60_000), signals: signals as Prisma.InputJsonValue } });
    }));
    return NextResponse.json({ updated: snapshots.filter(Boolean).length, symbols });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: "Invalid simulation request" }, { status: 400 });
    return NextResponse.json({ error: "Unable to simulate time" }, { status: 500 });
  }
}