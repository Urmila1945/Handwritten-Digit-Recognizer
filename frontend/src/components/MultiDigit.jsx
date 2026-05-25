import { useRef, useState } from 'react'
import axios from 'axios'
import ConfidenceChart from './ConfidenceChart'

export default function MultiDigit() {
  const [preview, setPreview] = useState(null)
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const fileRef = useRef()

  const onFile = (e) => {
    const f = e.target.files[0]
    if (!f) return
    setPreview(URL.createObjectURL(f))
    setResult(null)
  }

  const predict = async () => {
    if (!fileRef.current.files[0]) return
    setLoading(true)
    const fd = new FormData()
    fd.append('image', fileRef.current.files[0])
    try {
      const { data } = await axios.post('/api/predict_multi', fd)
      setResult(data)
    } catch { setResult({ error: true }) }
    setLoading(false)
  }

  return (
    <div className="grid2">
      <div>
        <div className="card">
          <h2>🔢 Multi-Digit Recognition</h2>
          <p className="text-muted" style={{ marginBottom: '1rem' }}>Upload an image with multiple digits (e.g. 27384)</p>
          <label className="upload-area" htmlFor="multi-upload">
            {preview
              ? <img src={preview} alt="preview" style={{ maxWidth: '100%', maxHeight: 200, borderRadius: 6 }} />
              : <div><div style={{ fontSize: '2rem' }}>📁</div><div className="text-muted mt1">Click to upload image</div></div>
            }
          </label>
          <input id="multi-upload" type="file" accept="image/*" ref={fileRef} onChange={onFile} />
          <div className="flex-gap mt1">
            <button className="btn btn-primary" onClick={predict} disabled={loading || !preview}>
              {loading ? <span className="spinner" /> : 'Recognize'}
            </button>
            <button className="btn btn-danger" onClick={() => { setPreview(null); setResult(null) }}>Clear</button>
          </div>
        </div>

        {result && !result.error && (
          <div className="card mt2">
            <h2>📋 Result</h2>
            <div style={{ fontSize: '2.5rem', fontWeight: 700, color: '#6c63ff', textAlign: 'center', letterSpacing: 8 }}>
              {result.number}
            </div>
            <div className="text-muted" style={{ textAlign: 'center', marginTop: '0.5rem' }}>
              {result.digits?.length} digit(s) detected
            </div>
            <div className="flex-gap mt1" style={{ justifyContent: 'center' }}>
              {result.digits?.map((d, i) => (
                <div key={i} className="tag tag-blue" style={{ fontSize: '1rem' }}>
                  {d.digit} <span className="text-muted">({(d.confidence * 100).toFixed(0)}%)</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div>
        {result?.digits?.[0] && (
          <ConfidenceChart probs={result.digits[0].probabilities} top={result.digits[0].digit} />
        )}
        <div className="card mt2">
          <h2>💡 Applications</h2>
          {['📊 Meter reading', '🎓 Roll numbers', '📮 Postal codes', '🧾 Invoice numbers', '📋 Exam sheets'].map(a => (
            <div key={a} className="tag tag-blue" style={{ display: 'block', marginBottom: '0.4rem' }}>{a}</div>
          ))}
        </div>
      </div>
    </div>
  )
}
