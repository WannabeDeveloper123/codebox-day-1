import { useEffect, useState } from "react";
import { api } from "../api.js";
import Spinner from "../components/Spinner.jsx";

export default function LeaderboardPage({ myTeamId }) {
  const [week, setWeek] = useState("");
  const [data, setData] = useState(null);
  const [status, setStatus] = useState("loading");
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setStatus("loading");
    api(`/api/fantasy/leaderboard${week ? `?week=${week}` : ""}`)
      .then((result) => { if (!cancelled) { setData(result); setStatus("success"); } })
      .catch((err) => { if (!cancelled) { setError(err.message); setStatus("error"); } });
    return () => { cancelled = true; };
  }, [week]);

  return (
    <section className="card">
      <div className="players-toolbar">
        <h1>Leaderboard</h1>
        <label className="week-select">
          <span className="muted">Show</span>
          <select value={week} onChange={(e) => setWeek(e.target.value)}>
            <option value="">Whole season</option>
            {data?.weeks.map((w) => <option key={w} value={w}>Week {w}</option>)}
          </select>
        </label>
      </div>

      {status === "loading" && <div className="state"><Spinner label="Loading leaderboard" /></div>}
      {status === "error" && <p className="error" role="alert">Couldn't load the leaderboard: {error}</p>}
      {status === "success" && data.teams.length === 0 && <p className="state muted">No teams yet. Be the first!</p>}
      {status === "success" && data.teams.length > 0 && (
        <ol className="leaderboard">
          {data.teams.map((t) => (
            <li key={t.id} className={t.id === myTeamId ? "mine" : undefined}>
              <span className={`rank rank-${t.rank}`}>{t.rank}</span>
              <div className="lb-team">
                <span className="player-name">{t.name}{t.id === myTeamId && <span className="you">You</span>}</span>
                <span className="muted small">{t.owner}</span>
              </div>
              <span className="lb-points">{t.points.toFixed(1)}<span className="muted small"> pts</span></span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
