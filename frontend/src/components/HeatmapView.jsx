export default function HeatmapView({ heatmap }) {
  if (!heatmap) return null
  return (
    <div className="card mt2">
      <h2>🔥 GradCAM Explainability</h2>
      <p className="text-muted" style={{ marginBottom: '0.8rem' }}>Highlighted regions show where the CNN focused</p>
      <img src={`data:image/png;base64,${heatmap}`} alt="GradCAM heatmap" className="heatmap-img" />
    </div>
  )
}
