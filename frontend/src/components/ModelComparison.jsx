import { useState } from 'react'
import axios from 'axios'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, RadarChart, Radar, PolarGrid, PolarAngleAxis } from 'recharts'

const MODELS = ['CNN', 'MLP', 'SVM', 'KNN', 'Random Forest']

export default function ModelComparison() {
  const [results, setResults] = useState(null)
  const [loading, setLoading] = useState(false)
  const [selected, setSelected] = useState(['CNN', 'SVM', 'KNN'])

  const run = async () => {
    setLoading(true)
    try {
      const { data } = await axios.post('/api/compare_models', { models: selected })
      setResults(data)
    } catch { setResults(null) }
    setLoading(false)
  }

  const toggle = (m) => setSelected(s => s.includes(m) ? s.filter(x => x !== m) : [...s, m])

  return (
    <div>
      <div className="card">
        <h2>🤖 Model Comparison</h2>
        <p className="text-muted" style={{ marginBottom: '1rem' }}>Select models to compare on MNIST test set</p>
        <div className="flex-gap">
          {MODELS.map(m => (
            <button key={m} className={`btn ${selected.includes(m) ? 'btn-primary' : ''}`}
              style={!selected.includes(m) ? { background: '#2a2a4a', color: '#aaa' } : {}}
              onClick={() => toggle(m)}>{m}</button>
          ))}
          <button className="btn btn-success" onClick={run} disabled={loading || selected.length === 0}>
            {loading ? <span className="spinner" /> : '▶ Run Comparison'}
          </button>
        </div>
      </div>

      {results && (
        <>
          <div className="card mt2">
            <h2>📊 Results Table</h2>
            <table className="model-table">
              <thead>
                <tr>
                  <th>Model</th><th>Accuracy</th><th>Precision</th><th>Recall</th><th>F1</th><th>Speed</th>
                </tr>
              </thead>
              <tbody>
                {results.map(r => (
                  <tr key={r.model}>
                    <td style={{ fontWeight: 700, color: '#6c63ff' }}>{r.model}</td>
                    <td className="text-green">{(r.accuracy * 100).toFixed(2)}%</td>
                    <td>{(r.precision * 100).toFixed(2)}%</td>
                    <td>{(r.recall * 100).toFixed(2)}%</td>
                    <td>{(r.f1 * 100).toFixed(2)}%</td>
                    <td>
                      <span className={`tag ${r.speed === 'Fast' ? 'tag-green' : r.speed === 'Medium' ? 'tag-blue' : 'tag-red'}`}>
                        {r.speed}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="grid2 mt2">
            <div className="card">
              <h2>📈 Accuracy Comparison</h2>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={results.map(r => ({ model: r.model, accuracy: +(r.accuracy * 100).toFixed(2) }))}>
                  <XAxis dataKey="model" stroke="#888" />
                  <YAxis stroke="#888" domain={[80, 100]} />
                  <Tooltip contentStyle={{ background: '#1a1a2e', border: '1px solid #2a2a4a' }} />
                  <Bar dataKey="accuracy" fill="#6c63ff" radius={[4,4,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="card">
              <h2>🕸 Radar Chart</h2>
              <ResponsiveContainer width="100%" height={220}>
                <RadarChart data={[
                  { metric: 'Accuracy', ...Object.fromEntries(results.map(r => [r.model, +(r.accuracy * 100).toFixed(1)])) },
                  { metric: 'Precision', ...Object.fromEntries(results.map(r => [r.model, +(r.precision * 100).toFixed(1)])) },
                  { metric: 'Recall', ...Object.fromEntries(results.map(r => [r.model, +(r.recall * 100).toFixed(1)])) },
                  { metric: 'F1', ...Object.fromEntries(results.map(r => [r.model, +(r.f1 * 100).toFixed(1)])) },
                ]}>
                  <PolarGrid stroke="#2a2a4a" />
                  <PolarAngleAxis dataKey="metric" stroke="#888" />
                  {results.map((r, i) => (
                    <Radar key={r.model} name={r.model} dataKey={r.model}
                      stroke={['#6c63ff','#52c47a','#63b3ff','#f0c040','#e05252'][i]}
                      fill={['#6c63ff','#52c47a','#63b3ff','#f0c040','#e05252'][i]}
                      fillOpacity={0.15} />
                  ))}
                </RadarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
