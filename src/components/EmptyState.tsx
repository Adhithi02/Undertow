export function EmptyState({ onAdd }: { onAdd: () => void }) {
  return <section className="empty-ledger"><p className="mono">No entries yet</p><h2>Your ledger is waiting.</h2><p>Add a symbol and Pulse will record what meaningfully changes from here.</p><button onClick={onAdd}>Add your first symbol</button></section>;
}
