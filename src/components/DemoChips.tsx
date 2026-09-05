export const DEMO_SYMBOLS = ["AAPL", "NVDA", "MSFT", "AMZN", "TSLA", "COST", "JPM", "LLY", "NFLX"] as const;

export function DemoChips({ onPick, disabled }: { onPick: (symbol: string) => void; disabled?: boolean }) {
  return (
    <p className="demo-chips">
      <span>Demo symbols (modelled thesis data): </span>
      {DEMO_SYMBOLS.map(symbol => (
        <button type="button" key={symbol} disabled={disabled} onClick={() => onPick(symbol)}>{symbol}</button>
      ))}
    </p>
  );
}
