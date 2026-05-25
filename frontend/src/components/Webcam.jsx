import { useRef, useEffect, useState, useCallback } from 'react'
import axios from 'axios'
import ConfidenceChart from './ConfidenceChart'

export default function Webcam() {
  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  const intervalRef = useRef(null)
  const [active, setActive] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)

  const start = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 320, height: 320 } })
      videoRef.current.srcObject = stream
      setActive(true)
      setError(null)
    } catch { setError('Camera access denied or not available') }
  }

  const stop = () => {
    videoRef.current?.srcObject?.getTracks().forEach(t => t.stop())
    clearInterval(intervalRef.current)
    setActive(false)
  }

  const capture = useCallback(async () => {
    const video = videoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas) return
    const ctx = canvas.getContext('2d')
    ctx.drawImage(video, 0, 0, 280, 280)
    try {
      const blob = await new Promise(r => canvas.toBlob(r, 'image/png'))
      const fd = new FormData()
      fd.append('image', blob, 'webcam.png')
      const { data } = await axios.post('/api/predict', fd)
      setResult(data)
    } catch {}
  }, [])

  useEffect(() => {
    if (active) {
      intervalRef.current = setInterval(capture, 1000)
    } else {
      clearInterval(intervalRef.current)
    }
    return () => clearInterval(intervalRef.current)
  }, [active, capture])

  useEffect(() => () => stop(), [])

  return (
    <div className="grid2">
      <div>
        <div className="card">
          <h2>📷 Webcam Recognition</h2>
          <p className="text-muted" style={{ marginBottom: '1rem' }}>Show a handwritten digit to your camera</p>
          <div className="webcam-container">
            <video ref={videoRef} autoPlay playsInline width={280} height={280}
              style={{ border: '2px solid #2a2a4a', borderRadius: 8, background: '#000', display: 'block' }} />
            {result && !result.unknown && result.prediction !== undefined && (
              <div className="webcam-overlay">{result.prediction}</div>
            )}
          </div>
          <canvas ref={canvasRef} width={280} height={280} style={{ display: 'none' }} />
          <div className="flex-gap mt1">
            {!active
              ? <button className="btn btn-primary" onClick={start}>▶ Start Camera</button>
              : <button className="btn btn-danger" onClick={stop}>⏹ Stop</button>
            }
          </div>
          {error && <div className="text-red mt1">{error}</div>}
        </div>

        {result && !result.unknown && result.prediction !== undefined && (
          <div className="card mt2">
            <div className="prediction-digit">{result.prediction}</div>
            <div className="confidence">{(result.confidence * 100).toFixed(1)}% confident</div>
          </div>
        )}
        {result?.unknown && (
          <div className="card mt2">
            <div className="unknown-box">⚠️ No clear digit detected</div>
          </div>
        )}
      </div>

      <div>
        {result && !result.unknown && <ConfidenceChart probs={result.probabilities} top={result.prediction} />}
        <div className="card mt2">
          <h2>💡 Tips</h2>
          {[
            '✍️ Write digit on white paper',
            '💡 Good lighting helps',
            '📐 Hold paper flat to camera',
            '🔢 One digit at a time',
          ].map(t => <div key={t} className="step">{t}</div>)}
        </div>
      </div>
    </div>
  )
}
