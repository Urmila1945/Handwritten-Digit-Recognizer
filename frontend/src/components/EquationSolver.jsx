import { useRef, useEffect, useState } from 'react'
import axios from 'axios'

export default function EquationSolver() {
  const canvasRef = useRef(null)
  const drawing = useRef(false)
  const timerRef = useRef(null)
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [textInput, setTextInput] = useState('')

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    ctx.fillStyle = '#000'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.strokeStyle = '#fff'
    ctx.lineWidth = 14
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
  }, [])

  const getPos = (e, canvas) => {
    const r = canvas.getBoundingClientRect()
    const src = e.touches ? e.touches[0] : e
    return { x: src.clientX - r.left, y: src.clientY - r.top }
  }

  const startDraw = (e) => {
    drawing.current = true
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    const { x, y } = getPos(e, canvas)
    ctx.beginPath(); ctx.moveTo(x, y)
  }

  const draw = (e) => {
    if (!drawing.current) return
    e.preventDefault()
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    const { x, y } = getPos(e, canvas)
    ctx.lineTo(x, y); ctx.stroke()
    clearTimeout(timerRef.current)
    timerRef.current = setTimeout(predictCanvas, 800)
  }

  const stopDraw = () => { drawing.current = false }

  const predictCanvas = async () => {
    const canvas = canvasRef.current
    setLoading(true)
    try {
      const blob = await new Promise(r => canvas.toBlob(r, 'image/png'))
      const fd = new FormData()
      fd.append('image', blob, 'eq.png')
      const { data } = await axios.post('/api/solve_equation', fd)
      setResult(data)
    } catch { setResult({ error: true }) }
    setLoading(false)
  }

  const solveText = async () => {
    if (!textInput.trim()) return
    setLoading(true)
    try {
      const { data } = await axios.post('/api/solve_text', { expression: textInput })
      setResult(data)
    } catch { setResult({ error: true }) }
    setLoading(false)
  }

  const clear = () => {
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    ctx.fillStyle = '#000'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    setResult(null)
  }

  return (
    <div className="grid2">
      <div>
        <div className="card">
          <h2>➕ Handwritten Equation Solver</h2>
          <p className="text-muted" style={{ marginBottom: '0.8rem' }}>Draw a math expression (e.g. 7+8×5)</p>
          <canvas
            ref={canvasRef} width={560} height={160}
            style={{ border: '2px solid #2a2a4a', borderRadius: 8, cursor: 'crosshair', touchAction: 'none', display: 'block', width: '100%' }}
            onMouseDown={startDraw} onMouseMove={draw} onMouseUp={stopDraw} onMouseLeave={stopDraw}
            onTouchStart={startDraw} onTouchMove={draw} onTouchEnd={stopDraw}
          />
          <div className="flex-gap mt1">
            <button className="btn btn-primary" onClick={predictCanvas} disabled={loading}>
              {loading ? <span className="spinner" /> : 'Solve Drawing'}
            </button>
            <button className="btn btn-danger" onClick={clear}>Clear</button>
          </div>
        </div>

        <div className="card mt2">
          <h2>⌨️ Type Expression</h2>
          <input
            className="equation-input"
            value={textInput}
            onChange={e => setTextInput(e.target.value)}
            placeholder="e.g. 7 + 8 * 5 or (3+4)*2"
            onKeyDown={e => e.key === 'Enter' && solveText()}
          />
          <div className="flex-gap mt1">
            <button className="btn btn-primary" onClick={solveText} disabled={loading}>Solve</button>
            <button className="btn btn-danger" onClick={() => { setTextInput(''); setResult(null) }}>Clear</button>
          </div>
        </div>
      </div>

      <div>
        {result && !result.error && (
          <div className="card">
            <h2>🧮 Solution</h2>
            <div className="text-muted">Expression: <span style={{ color: '#fff' }}>{result.expression}</span></div>
            <div className="equation-result">= {result.result}</div>
            {result.steps?.length > 0 && (
              <div className="steps mt1">
                <div className="text-muted" style={{ marginBottom: '0.5rem' }}>Step-by-step:</div>
                {result.steps.map((s, i) => (
                  <div key={i} className="step">
                    <span className="text-muted">Step {i + 1}:</span> {s}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
        {result?.error && (
          <div className="card">
            <div className="text-red">❌ Could not parse expression. Try typing it instead.</div>
          </div>
        )}
        <div className="card mt2">
          <h2>✅ Supported Operators</h2>
          {['+', '−', '×', '÷', '^', '(', ')'].map(op => (
            <span key={op} className="tag tag-blue" style={{ fontSize: '1.1rem' }}>{op}</span>
          ))}
        </div>
      </div>
    </div>
  )
}
