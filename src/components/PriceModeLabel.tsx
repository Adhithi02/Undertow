export function PriceModeLabel({ mode }: { mode: "live" | "simulated" }) {
  return (
    <span className="price-source">
      <span className={`price-mode-dot ${mode}`} aria-hidden="true" />
      {mode === "live" ? "live price" : "simulated price"}
    </span>
  );
}
