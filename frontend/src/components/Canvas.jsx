import { useRef, useEffect, useState, useCallback } from 'react'
import axios from 'axios'
import ConfidenceChart from './ConfidenceChart'
import HeatmapView from './HeatmapView'

export default function Canvas() {
  const canvasRef = useRef(null)
  const drawing = useRef(false)
  const timerRef = useRef(null)
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [history, setHistory] = useState([])
  const [correction, setCorrection] = useState('')
  const [gameMode, setGameMode] = useState(false)
  const [target, setTarget] = useState(null)
  const [score, setScore] = useState(0)
  const [level, setLevel] = useState(1)
  const [timeLeft, setTimeLeft] = useState(5)
  const gameTimer = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    ctx.fillStyle = '#000'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.strokeStyle = '#fff'
    ctx.lineWidth = 18
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
    ctx.beginPath()
    ctx.moveTo(x, y)
  }

  const draw = (e) => {
    if (!drawing.current) return
    e.preventDefault()
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    const { x, y } = getPos(e, canvas)
    ctx.lineTo(x, y)
    ctx.stroke()
    clearTimeout(timerRef.current)
    timerRef.current = setTimeout(predict, 600)
  }

  const stopDraw = () => { drawing.current = false }

  const predict = useCallback(async () => {
    const canvas = canvasRef.current
    const blank = isBlank(canvas)
    if (blank) return
    setLoading(true)
    try {
      const blob = await new Promise(r => canvas.toBlob(r, 'image/png'))
      const fd = new FormData()
      fd.append('image', blob, 'digit.png')
      const { data } = await axios.post('/api/predict', fd)
      setResult(data)
      if (gameMode && data.prediction !== undefined) checkGame(data.prediction)
      setHistory(h => [{ digit: data.prediction, conf: data.confidence, time: new Date().toLocaleTimeString() }, ...h.slice(0, 9)])
    } catch { setResult({ error: true }) }
    setLoading(false)
  }, [gameMode])

  const isBlank = (canvas) => {
    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    const d = ctx.getImageData(0, 0, canvas.width, canvas.height).data
    return !d.some((v, i) => i % 4 !== 3 && v > 10)
  }

  const clear = () => {
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    ctx.fillStyle = '#000'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    setResult(null)
  }

  const submitCorrection = async () => {
    if (!correction || result === null) return
    try {
      const canvas = canvasRef.current
      const blob = await new Promise(r => canvas.toBlob(r, 'image/png'))
      const fd = new FormData()
      fd.append('image', blob, 'digit.png')
      fd.append('correct_label', correction)
      await axios.post('/api/correct', fd)
      setCorrection('')
    } catch {}
  }

  const startGame = () => {
    setGameMode(true)
    setScore(0)
    setLevel(1)
    newTarget()
  }

  const newTarget = () => {
    setTarget(Math.floor(Math.random() * 10))
    setTimeLeft(5)
    clearInterval(gameTimer.current)
    gameTimer.current = setInterval(() => {
      setTimeLeft(t => {
        if (t <= 1) { clearInterval(gameTimer.current); setGameMode(false); return 0 }
        return t - 1
      })
    }, 1000)
  }

  const checkGame = (pred) => {
    if (pred === target) {
      setScore(s => s + 10)
      setLevel(l => l + 1)
      clear()
      newTarget()
    }
  }

  const speak = (digit) => {
    const words = ['Zero','One','Two','Three','Four','Five','Six','Seven','Eight','Nine']
    if (digit >= 0 && digit <= 9) {
      const u = new SpeechSynthesisUtterance(words[digit])
      window.speechSynthesis.speak(u)
    }
  }

  return (
    <div className="grid2">
      <div>
        <div className="card">
          <h2>✏️ Draw a Digit</h2>
          {gameMode && (
            <div className="result-box" style={{ marginBottom: '1rem' }}>
              <div style={{ textAlign: 'center', fontSize: '1.1rem' }}>
                Write: <span style={{ color: '#6c63ff', fontSize: '2rem', fontWeight: 700 }}>{target}</span>
                <span style={{ marginLeft: '1rem', color: '#f0c040' }}>⏱ {timeLeft}s</span>
              </div>
              <div className="gamify">
                <div className="gamify-stat"><div className="val">{score}</div><div className="lbl">Score</div></div>
                <div className="gamify-stat"><div className="val">{level}</div><div className="lbl">Level</div></div>
              </div>
            </div>
          )}
          <canvas
            ref={canvasRef} width={280} height={280}
            style={{ border: '2px solid #2a2a4a', borderRadius: 8, cursor: 'crosshair', touchAction: 'none', display: 'block' }}
            onMouseDown={startDraw} onMouseMove={draw} onMouseUp={stopDraw} onMouseLeave={stopDraw}
            onTouchStart={startDraw} onTouchMove={draw} onTouchEnd={stopDraw}
          />
          <div className="flex-gap mt1">
            <button className="btn btn-primary" onClick={predict} disabled={loading}>
              {loading ? <span className="spinner" /> : 'Predict'}
            </button>
            <button className="btn btn-danger" onClick={clear}>Clear</button>
            {!gameMode
              ? <button className="btn btn-success" onClick={startGame}>🎮 Game Mode</button>
              : <button className="btn btn-danger" onClick={() => { setGameMode(false); clearInterval(gameTimer.current) }}>Stop Game</button>
            }
          </div>
        </div>

        {result && !result.error && (
          <div className="card mt2">
            <h2>🔍 Result</h2>
            {result.unknown
              ? <div className="unknown-box">⚠️ Unknown / Unclear Input</div>
              : <>
                  <div className="prediction-digit">{result.prediction}</div>
                  <div className="confidence">{(result.confidence * 100).toFixed(1)}% confident</div>
                  <button className="btn btn-primary mt1" style={{ fontSize: '0.8rem' }} onClick={() => speak(result.prediction)}>🔊 Speak</button>
                  <div className="mt1">
                    <span className="text-muted">Handwriting quality: </span>
                    <span className={result.quality_score > 60 ? 'text-green' : result.quality_score > 30 ? 'text-yellow' : 'text-red'}>
                      {result.quality_score}/100 ({result.quality_label})
                    </span>
                  </div>
                  <div className="mt1 flex-gap">
                    <input
                      value={correction} onChange={e => setCorrection(e.target.value)}
                      placeholder="Correct label (0-9)" maxLength={1}
                      style={{ width: 160, padding: '0.4rem 0.8rem', background: '#0f0f1a', border: '1px solid #2a2a4a', borderRadius: 6, color: '#fff' }}
                    />
                    <button className="btn btn-success" onClick={submitCorrection}>✅ Submit Correction</button>
                  </div>
                </>
            }
          </div>
        )}

        {history.length > 0 && (
          <div className="card mt2">
            <h2>📜 History</h2>
            {history.map((h, i) => (
              <div key={i} className="history-item">
                <div className="history-digit">{h.digit}</div>
                <div>
                  <div>{(h.conf * 100).toFixed(1)}% confident</div>
                  <div className="text-muted">{h.time}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div>
        {result && !result.error && !result.unknown && (
          <>
            <ConfidenceChart probs={result.probabilities} top={result.prediction} />
            <HeatmapView heatmap={result.heatmap} />
          </>
        )}
      </div>
    </div>
  )
}
