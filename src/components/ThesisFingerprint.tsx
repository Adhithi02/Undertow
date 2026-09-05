import { FINGERPRINT_DIMENSIONS, FingerprintDimension, ThesisFingerprint as Fingerprint } from "@/lib/fingerprint";

type TimelinePoint = { fetchedAt: string; current: boolean };

function polygon(vector: number[], center = 90, maxRadius = 56) {
  return vector.map((value, index) => {
    const angle = -Math.PI / 2 + (index * Math.PI * 2) / vector.length;
    const radius = 13 + ((value + 1) / 2) * maxRadius;
    return `${center + Math.cos(angle) * radius},${center + Math.sin(angle) * radius}`;
  }).join(" ");
}

function axisPoint(index: number, count: number, center = 90, radius = 75) {
  const angle = -Math.PI / 2 + (index * Math.PI * 2) / count;
  return { x: center + Math.cos(angle) * radius, y: center + Math.sin(angle) * radius };
}

function Contribution({ dimension }: { dimension: FingerprintDimension }) {
  const contribution = dimension.contribution ?? 0;
  const movement = dimension.difference === null ? "profile pending" : dimension.difference > 0 ? "above profile" : dimension.difference < 0 ? "below profile" : "at profile";
  return <div className="fingerprint-contribution">
    <div><strong>{dimension.label}</strong><span>{movement}</span></div>
    <div className="contribution-track" aria-label={`${dimension.label}: ${contribution}% of unusualness`}><i style={{ width: `${contribution}%` }} /></div>
    <b>{contribution}%</b>
  </div>;
}

function ThesisShape({ fingerprint }: { fingerprint: Fingerprint }) {
  if (!fingerprint.currentVector || !fingerprint.centroidVector) return null;
  return <figure className="thesis-shape">
    <figcaption><span className="mono">Thesis shape</span><small>current vs. historical profile</small></figcaption>
    <svg viewBox="0 0 180 180" role="img" aria-label="Six-dimensional thesis shape comparing current snapshot with historical profile">
      {[26, 48, 70].map(radius => <circle key={radius} cx="90" cy="90" r={radius} className="shape-grid" />)}
      {FINGERPRINT_DIMENSIONS.map((dimension, index) => {
        const point = axisPoint(index, FINGERPRINT_DIMENSIONS.length);
        const label = axisPoint(index, FINGERPRINT_DIMENSIONS.length, 90, 86);
        const textAnchor = label.x < 55 ? "start" : label.x > 125 ? "end" : "middle";
        return <g key={dimension.key}><line x1="90" y1="90" x2={point.x} y2={point.y} className="shape-axis" /><text x={label.x} y={label.y} className="shape-label" textAnchor={textAnchor} dominantBaseline="middle">{dimension.label}</text></g>;
      })}
      <polygon points={polygon(fingerprint.centroidVector)} className="shape-history" />
      <polygon points={polygon(fingerprint.currentVector)} className="shape-current" />
    </svg>
    <p><span className="shape-key current" />Current <span className="shape-key history" />Historical profile</p>
  </figure>;
}

export function ThesisFingerprint({ fingerprint, timeline }: { fingerprint: Fingerprint | null; timeline: TimelinePoint[] }) {
  if (!fingerprint) return null;
  const status = fingerprint.status === "insufficient" ? "History building" : fingerprint.status;
  const contributors = [...fingerprint.dimensions]
    .filter(dimension => dimension.contribution !== null)
    .sort((left, right) => (right.contribution ?? 0) - (left.contribution ?? 0))
    .slice(0, 3);

  return <section className={`fingerprint-panel fingerprint-${fingerprint.status}`} aria-labelledby="fingerprint-heading">
    <div className="fingerprint-heading">
      <div><p className="mono">Experimental ML signal</p><h2 id="fingerprint-heading">Thesis fingerprint</h2><p>Is this modelled thesis state familiar for this stock?</p></div>
      <div className="fingerprint-score"><span>{status}</span><strong>{fingerprint.unusualness ?? "—"}</strong><small>{fingerprint.unusualness === null ? "profile pending" : "unusualness / 100"}</small></div>
    </div>
    <div className="fingerprint-body">
      <div className="fingerprint-read"><p className="fingerprint-interpretation">{fingerprint.interpretation}</p><div className="quality-row"><span><b>{fingerprint.historyCount}</b> prior snapshots</span><span><b>{fingerprint.minimumHistory}</b> required for scoring</span><span>not a return prediction</span></div>{contributors.length > 0 && <div className="contributions"><p className="mono">Primary contributors</p>{contributors.map(dimension => <Contribution key={dimension.key} dimension={dimension} />)}</div>}</div>
      <ThesisShape fingerprint={fingerprint} />
    </div>
    {timeline.length > 0 && <div className="snapshot-timeline"><div><p className="mono">Historical snapshot timeline</p><span>{timeline.length} available modelled records</span></div><ol>{timeline.map((point, index) => <li key={`${point.fetchedAt}-${index}`} className={point.current ? "current" : ""}><i /><time>{new Date(point.fetchedAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</time><small>{point.current ? "current" : "recorded"}</small></li>)}</ol></div>}
    <p className="fingerprint-disclosure">Uses Undertow&apos;s available modelled snapshot history only. It is a deterministic anomaly calculation, not external-market training, a recommendation, or a forecast.</p>
  </section>;
}
