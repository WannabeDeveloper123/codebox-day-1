export default function PositionBadge({ position }) {
  return <span className={`badge badge-${position.toLowerCase()}`}>{position}</span>;
}
