export function PriceModeLabel({ mode, source = "watchlist" }: { mode: "live" | "simulated"; source?: "watchlist" | "snapshot" }) {
  const text = source === "snapshot"
    ? "Snapshot price · not a live quote"
    : mode === "live" ? "Price: live quote" : "Price: simulated snapshot";
  return (
    <span className="price-source">
      <span className={`price-mode-dot ${source === "snapshot" ? "simulated" : mode}`} aria-hidden="true" />
      {text}
    </span>
  );
}
