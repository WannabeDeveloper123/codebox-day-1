export default function SalaryBar({ used, cap }) {
  const left = cap - used;
  const percent = Math.min(100, Math.round((used / cap) * 100));

  return (
    <div className="salary">
      <div className="salary-labels">
        <span>Salary used <b>${used}</b> of ${cap}</span>
        <span className={left < 5 ? "warn" : "muted"}>${left} left</span>
      </div>
      <div className="salary-track" role="progressbar" aria-valuenow={used} aria-valuemin={0} aria-valuemax={cap} aria-label="Salary used">
        <div className="salary-fill" style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}
