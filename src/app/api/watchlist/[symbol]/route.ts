import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { normalizeSymbol, requireUser, symbolSchema } from "@/lib/market";

const paramsSchema = z.object({ symbol: z.string().trim().toUpperCase().regex(symbolSchema) });

export async function DELETE(_request: Request, context: { params: Promise<{ symbol: string }> }) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const { symbol } = paramsSchema.parse(await context.params);
    const result = await prisma.watchlistItem.deleteMany({ where: { userId: user.id, symbol: normalizeSymbol(symbol) } });
    return NextResponse.json({ symbol, deleted: result.count > 0 });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: "Invalid symbol" }, { status: 400 });
    return NextResponse.json({ error: "Unable to remove symbol" }, { status: 500 });
  }
}