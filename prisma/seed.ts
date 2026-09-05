import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });
const before = new Date("2026-09-04T12:00:00.000Z");

const symbols = [
  ["AAPL", { price: 228, epsSurprise: 4, analystScore: 6, institutionalOwnership: 2, riskScore: 3, peRatio: 28, technicalScore: 5 }],
  ["NVDA", { price: 142, epsSurprise: 8, analystScore: -7, institutionalOwnership: 4, riskScore: 2, peRatio: 34, technicalScore: 9 }],
  ["MSFT", { price: 512, epsSurprise: 3, analystScore: 5, institutionalOwnership: 1, riskScore: -2, peRatio: 31, technicalScore: 4 }],
  ["AMZN", { price: 236, epsSurprise: -3, analystScore: 2, institutionalOwnership: 3, riskScore: 5, peRatio: 42, technicalScore: -4 }],
  ["TSLA", { price: 338, epsSurprise: 5, analystScore: -4, institutionalOwnership: -2, riskScore: 8, peRatio: 96, technicalScore: 7 }],
  ["COST", { price: 978, epsSurprise: 2, analystScore: 4, institutionalOwnership: 2, riskScore: 1, peRatio: 49, technicalScore: 3 }],
  ["JPM", { price: 291, epsSurprise: 6, analystScore: 3, institutionalOwnership: 5, riskScore: -3, peRatio: 14, technicalScore: 6 }],
  ["LLY", { price: 811, epsSurprise: 7, analystScore: 8, institutionalOwnership: 4, riskScore: 6, peRatio: 58, technicalScore: 10 }],
  ["NFLX", { price: 742, epsSurprise: 1, analystScore: 6, institutionalOwnership: 3, riskScore: 2, peRatio: 39, technicalScore: 5 }],
] as const;

async function main() {
  const user = await prisma.user.upsert({ where: { email: "demo@undertow.local" }, update: { lastVisit: null }, create: { email: "demo@undertow.local" } });
  await prisma.watchlistItem.deleteMany({ where: { userId: user.id } });
  for (const [symbol, signals] of symbols) {
    await prisma.watchlistItem.create({ data: { userId: user.id, symbol } });
    await prisma.thesisSnapshot.deleteMany({ where: { symbol } });
    await prisma.thesisSnapshot.create({ data: { symbol, fetchedAt: before, signals } });
  }
  console.log(`Seeded ${symbols.length} symbols for ${user.email}.`);
}

main().finally(() => prisma.$disconnect());