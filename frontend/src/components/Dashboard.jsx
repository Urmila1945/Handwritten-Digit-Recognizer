import { useEffect, useState } from 'react'
import axios from 'axios'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line, CartesianGrid, Legend } from 'recharts'

export default function Dashboard() {
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    axios.get('/api/dashboard').then(r => { setStats(r.data); setLoading(false) }).catch(() => setLoading(false))
  }, [])

  if (loading) return <div className="card"><div className="spinner" /></div>
  if (!stats) return <div className="card text-red">Failed to load dashboard</div>

  const confMatrix = stats.confusion_matrix
  const digits = [0,1,2,3,4,5,6,7,8,9]

  return (
    <div>
      <div className="grid2">
        <div className="card">
          <h2>📈 Model Metrics</h2>
          {[
            { label: 'Accuracy', val: `${(stats.accuracy * 100).toFixed(2)}%`, color: '#52c47a' },
            { label: 'Precision', val: `${(stats.precision * 100).toFixed(2)}%`, color: '#6c63ff' },
            { label: 'Recall', val: `${(stats.recall * 100).toFixed(2)}%`, color: '#63b3ff' },
            { label: 'F1 Score', val: `${(stats.f1 * 100).toFixed(2)}%`, color: '#f0c040' },
            { label: 'Total Predictions', val: stats.total_predictions, color: '#aaa' },
          ].map(m => (
            <div key={m.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem 0', borderBottom: '1px solid #2a2a4a' }}>
              <span className="text-muted">{m.label}</span>
              <span style={{ color: m.color, fontWeight: 700 }}>{m.val}</span>
            </div>
          ))}
        </div>

        <div className="card">
          <h2>📊 Per-Digit Accuracy</h2>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={digits.map(d => ({ digit: d, acc: (stats.per_digit_accuracy?.[d] || 0) * 100 }))}>
              <XAxis dataKey="digit" stroke="#888" />
              <YAxis stroke="#888" domain={[0, 100]} />
              <Tooltip contentStyle={{ background: '#1a1a2e', border: '1px solid #2a2a4a' }} />
              <Bar dataKey="acc" fill="#6c63ff" radius={[4,4,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {stats.training_history && (
        <div className="card mt2">
          <h2>📉 Training History</h2>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={stats.training_history}>
              <CartesianGrid strokeDasharray="3 3" stroke="#2a2a4a" />
              <XAxis dataKey="epoch" stroke="#888" />
              <YAxis stroke="#888" />
              <Tooltip contentStyle={{ background: '#1a1a2e', border: '1px solid #2a2a4a' }} />
              <Legend />
              <Line type="monotone" dataKey="accuracy" stroke="#52c47a" dot={false} />
              <Line type="monotone" dataKey="val_accuracy" stroke="#6c63ff" dot={false} />
              <Line type="monotone" dataKey="loss" stroke="#e05252" dot={false} />
              <Line type="monotone" dataKey="val_loss" stroke="#f0c040" dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {confMatrix && (
        <div className="card mt2">
          <h2>🔲 Confusion Matrix</h2>
          <div style={{ overflowX: 'auto' }}>
            <table className="model-table">
              <thead>
                <tr>
                  <th>P\A</th>
                  {digits.map(d => <th key={d}>{d}</th>)}
                </tr>
              </thead>
              <tbody>
                {digits.map(r => (
                  <tr key={r}>
                    <td style={{ color: '#6c63ff', fontWeight: 700 }}>{r}</td>
                    {digits.map(c => {
                      const val = confMatrix[r]?.[c] || 0
                      const isMax = r === c
                      return (
                        <td key={c} style={{ background: isMax ? '#1a3a2a' : val > 0 ? '#3a1a1a' : 'transparent', color: isMax ? '#52c47a' : val > 0 ? '#e05252' : '#444', textAlign: 'center' }}>
                          {val}
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
