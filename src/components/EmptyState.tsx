import { DemoChips } from "./DemoChips";

export function EmptyState({ onAdd, onPick, disabled }: { onAdd: () => void; onPick: (symbol: string) => void; disabled?: boolean }) {
  return (
    <section className="empty-ledger">
      <p className="mono">No entries yet</p>
      <h2>Your ledger is waiting.</h2>
      <p>Add a symbol and Undertow will record modelled thesis changes from this baseline. Signals are demo data, not live provider feeds.</p>
      <button onClick={onAdd}>Add your first symbol</button>
      <DemoChips onPick={onPick} disabled={disabled} />
    </section>
  );
}
