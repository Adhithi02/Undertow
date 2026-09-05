import { Prisma } from "@prisma/client";
import { prisma } from "./prisma";
import { getCurrentUser } from "./auth";
import { ThesisChangeEngine } from "./signals/engine";
import { signalEvaluators } from "./signals/registry";
import { ThesisSnapshot } from "./signals/types";

export const STALE_AFTER_MS = 24 * 60 * 60 * 1000;
export const symbolSchema = /^[A-Z][A-Z0-9.-]{0,9}$/;
const engine = new ThesisChangeEngine(signalEvaluators);

export function normalizeSymbol(symbol: string): string {
  return symbol.trim().toUpperCase();
}

export function isValidSymbol(symbol: string): boolean {
  return symbolSchema.test(normalizeSymbol(symbol));
}

export function toSnapshot(snapshot: { symbol: string; fetchedAt: Date; signals: Prisma.JsonValue }): ThesisSnapshot {
  return {
    symbol: snapshot.symbol,
    fetchedAt: snapshot.fetchedAt,
    signals: snapshot.signals && typeof snapshot.signals === "object" && !Array.isArray(snapshot.signals)
      ? snapshot.signals as Record<string, unknown>
      : {},
  };
}

export function isStale(fetchedAt: Date): boolean {
  return Date.now() - fetchedAt.getTime() > STALE_AFTER_MS;
}

export async function requireUser() {
  return getCurrentUser();
}

export async function latestSnapshot(symbol: string) {
  return prisma.thesisSnapshot.findFirst({
    where: { symbol },
    orderBy: { fetchedAt: "desc" },
  });
}

export async function previousSnapshot(symbol: string, before: Date) {
  return prisma.thesisSnapshot.findFirst({
    where: { symbol, fetchedAt: { lt: before } },
    orderBy: { fetchedAt: "desc" },
  });
}

export function changesSince(current: ThesisSnapshot, previous: ThesisSnapshot | null) {
  return engine.computeChanges(previous, current);
}

export async function inChunks<T, R>(items: T[], worker: (item: T) => Promise<R>, chunkSize = 5): Promise<R[]> {
  const results: R[] = [];
  for (let index = 0; index < items.length; index += chunkSize) {
    results.push(...await Promise.all(items.slice(index, index + chunkSize).map(worker)));
  }
  return results;
}