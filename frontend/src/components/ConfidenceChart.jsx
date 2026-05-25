export default function ConfidenceChart({ probs, top }) {
  if (!probs) return null
  const max = Math.max(...probs)
  return (
    <div className="card">
      <h2>📊 Confidence per Digit</h2>
      <div className="bar-chart">
        {probs.map((p, i) => (
          <div key={i} className="bar-row">
            <span className="bar-label">{i}</span>
            <div className="bar-track">
              <div
                className={`bar-fill${i === top ? ' top' : ''}`}
                style={{ width: `${(p * 100).toFixed(1)}%` }}
              >
                {p > 0.05 ? `${(p * 100).toFixed(1)}%` : ''}
              </div>
            </div>
          </div>
        ))}
      </div>
      {probs.filter(p => p > 0.1).length > 1 && (
        <div className="mt1 text-yellow" style={{ fontSize: '0.85rem' }}>
          ⚠️ Possibly: {probs
            .map((p, i) => ({ p, i }))
            .filter(x => x.p > 0.1)
            .sort((a, b) => b.p - a.p)
            .slice(0, 3)
            .map(x => `${x.i} (${(x.p * 100).toFixed(0)}%)`)
            .join(' or ')}
        </div>
      )}
    </div>
  )
}
