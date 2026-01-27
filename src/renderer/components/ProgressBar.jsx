export default function ProgressBar({ value, max }) {
  const percent = max > 0 ? Math.round((value / max) * 100) : 0

  return (
    <div className="progress-bar">
      <div className="progress-fill" style={{ width: `${percent}%` }} />
    </div>
  )
}
