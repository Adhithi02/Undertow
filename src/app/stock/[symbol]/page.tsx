import StockDetail from "@/components/StockDetail";

export default async function StockPage({ params, searchParams }: { params: Promise<{ symbol: string }>; searchParams: Promise<{ since?: string; mode?: string }> }) {
  const { symbol } = await params;
  const { since, mode } = await searchParams;
  const priceMode = mode === "simulated" ? "simulated" : "live";
  return <StockDetail symbol={symbol.toUpperCase()} since={since} mode={priceMode} />;
}