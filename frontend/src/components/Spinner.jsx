export default function Spinner({ label = "Loading", small = false }) {
  return (
    <span className={small ? "spinner spinner-small" : "spinner"} role="status">
      <span className="visually-hidden">{label}</span>
    </span>
  );
}
