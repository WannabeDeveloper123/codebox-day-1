import { useEffect, useState } from "react";
import { api } from "../api.js";
import Spinner from "../components/Spinner.jsx";
import SalaryBar from "../components/SalaryBar.jsx";
import PositionBadge from "../components/PositionBadge.jsx";

const POSITIONS = ["QB", "RB", "WR", "TE"];

export default function PlayersPage({
  team, initialPosition, swapOut, onTeamChange, onSwapDone, onCancelSwap, onGoToTeam, onAuthError,
}) {
  const [position, setPosition] = useState(initialPosition);
  const [search, setSearch] = useState("");
  const [players, setPlayers] = useState([]);
  const [status, setStatus] = useState("loading");
  const [loadError, setLoadError] = useState(null);
  const [actionError, setActionError] = useState(null);
  const [busyId, setBusyId] = useState(null);

  // Reload when the filter changes; wait a moment while the user is typing
  useEffect(() => {
    const params = new URLSearchParams();
    if (position) params.set("position", position);
    if (search.trim()) params.set("search", search.trim());

    let cancelled = false;
    setStatus("loading");
    const timer = setTimeout(async () => {
      try {
        const list = await api(`/api/players?${params}`);
        if (!cancelled) { setPlayers(list); setStatus("success"); }
      } catch (err) {
        if (!cancelled) { setLoadError(err.message); setStatus("error"); }
      }
    }, search ? 250 : 0);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [position, search]);

  const onRoster = new Set(team?.roster.map((p) => p.id));

  async function choose(player) {
    setBusyId(player.id);
    setActionError(null);
    try {
      if (swapOut) {
        onTeamChange(await api(`/api/fantasy/team/players/${swapOut.id}`, { method: "PUT", body: { playerId: player.id } }));
        onSwapDone();
      } else {
        onTeamChange(await api("/api/fantasy/team/players", { method: "POST", body: { playerId: player.id } }));
      }
    } catch (err) {
      if (err.status === 401) onAuthError();
      else setActionError(err.message);
    } finally {
      setBusyId(null);
    }
  }

  function actionFor(player) {
    if (onRoster.has(player.id)) return <span className="muted small">On your team</span>;
    if (!team) return null;
    return (
      <button className="primary small" onClick={() => choose(player)} disabled={busyId !== null}>
        {busyId === player.id ? <Spinner small label="Saving" /> : swapOut ? "Swap in" : "Add"}
      </button>
    );
  }

  return (
    <>
      {swapOut && (
        <div className="banner">
          <span>Swapping out <b>{swapOut.name}</b> (${swapOut.salary}). Pick another {swapOut.position}.</span>
          <button className="ghost small" onClick={onCancelSwap}>Cancel swap</button>
        </div>
      )}

      {team === null && (
        <div className="banner">
          <span>Create a team to start adding players.</span>
          <button className="primary small" onClick={onGoToTeam}>Create team</button>
        </div>
      )}

      <section className="card">
        <div className="players-toolbar">
          <h1>Players</h1>
          {team && <SalaryBar used={team.salaryUsed} cap={team.salaryCap} />}
        </div>

        <div className="filters-row">
          <nav className="filters" aria-label="Filter by position">
            {[null, ...POSITIONS].map((p) => (
              <button
                key={p ?? "all"}
                className={position === p ? "chip active" : "chip"}
                aria-pressed={position === p}
                onClick={() => setPosition(p)}
                disabled={Boolean(swapOut) && p !== swapOut.position}
              >
                {p ?? "All"}
              </button>
            ))}
          </nav>
          <label className="visually-hidden" htmlFor="player-search">Search players</label>
          <input id="player-search" className="search" type="search" placeholder="Search by name" value={search} onChange={(e) => setSearch(e.target.value)} maxLength={40} />
        </div>

        {actionError && <p className="error" role="alert">{actionError}</p>}

        {status === "loading" && <div className="state"><Spinner label="Loading players" /></div>}
        {status === "error" && <p className="error" role="alert">Couldn't load players: {loadError}</p>}
        {status === "success" && players.length === 0 && <p className="state muted">No players match.</p>}
        {status === "success" && players.length > 0 && (
          <table className="players-table">
            <thead>
              <tr><th>Player</th><th className="num">Salary</th><th className="num">Points</th><th><span className="visually-hidden">Action</span></th></tr>
            </thead>
            <tbody>
              {players.map((p) => (
                <tr key={p.id} className={onRoster.has(p.id) ? "mine" : undefined}>
                  <td>
                    <div className="player-cell">
                      <PositionBadge position={p.position} />
                      <div>
                        <div className="player-name">{p.name}</div>
                        <div className="muted small">{p.team}</div>
                      </div>
                    </div>
                  </td>
                  <td className="num">${p.salary}</td>
                  <td className="num">{p.seasonPoints.toFixed(1)}</td>
                  <td className="action">{actionFor(p)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </>
  );
}
