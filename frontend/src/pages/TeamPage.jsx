import { useState } from "react";
import { api } from "../api.js";
import Spinner from "../components/Spinner.jsx";
import SalaryBar from "../components/SalaryBar.jsx";
import PositionBadge from "../components/PositionBadge.jsx";

// Lays the roster out as fixed slots: QB, RB, RB, WR, WR, TE
function buildSlots(team) {
  const slots = [];
  for (const [position, count] of Object.entries(team.slots)) {
    const players = team.roster.filter((p) => p.position === position);
    for (let i = 0; i < count; i++) slots.push({ position, player: players[i] });
  }
  return slots;
}

function points(value) {
  return value.toFixed(1);
}

export default function TeamPage({ team, error, onRetry, onTeamChange, onBrowse, onSwap, onAuthError }) {
  const [actionError, setActionError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState("");

  async function run(request) {
    setBusy(true);
    setActionError(null);
    try {
      onTeamChange(await request());
      return true;
    } catch (err) {
      if (err.status === 401) onAuthError();
      else setActionError(err.message);
      return false;
    } finally {
      setBusy(false);
    }
  }

  if (team === undefined && !error) {
    return <div className="state"><Spinner label="Loading your team" /></div>;
  }

  if (error) {
    return (
      <div className="card state">
        <p>Couldn't load your team: {error}</p>
        <button className="ghost" onClick={onRetry}>Try again</button>
      </div>
    );
  }

  if (team === null) {
    const create = (e) => {
      e.preventDefault();
      if (!name.trim()) return;
      run(() => api("/api/fantasy/team", { method: "POST", body: { name: name.trim() } }));
    };
    return (
      <section className="card create-team">
        <h1>Create your team</h1>
        <p className="muted">Pick 1 QB, 2 RBs, 2 WRs and 1 TE without going over the $100 salary cap. You score real PPR points from this NFL season.</p>
        <form className="inline-form" onSubmit={create}>
          <label className="visually-hidden" htmlFor="team-name">Team name</label>
          <input id="team-name" placeholder="Team name" value={name} onChange={(e) => setName(e.target.value)} maxLength={40} />
          <button className="primary" disabled={busy || !name.trim()}>Create team</button>
        </form>
        {actionError && <p className="error" role="alert">{actionError}</p>}
      </section>
    );
  }

  async function rename(e) {
    e.preventDefault();
    const trimmed = name.trim();
    if (trimmed && trimmed !== team.name) {
      const ok = await run(() => api("/api/fantasy/team", { method: "PUT", body: { name: trimmed } }));
      if (!ok) return;
    }
    setEditing(false);
  }

  async function deleteTeam() {
    if (!window.confirm(`Delete "${team.name}"? Your roster will be cleared.`)) return;
    await run(async () => {
      await api("/api/fantasy/team", { method: "DELETE" });
      return null;
    });
  }

  const drop = (player) =>
    run(() => api(`/api/fantasy/team/players/${player.id}`, { method: "DELETE" }));

  const slots = buildSlots(team);

  return (
    <>
      <section className="card team-header">
        {editing ? (
          <form className="inline-form" onSubmit={rename}>
            <label className="visually-hidden" htmlFor="rename">Team name</label>
            <input id="rename" value={name} onChange={(e) => setName(e.target.value)} maxLength={40} autoFocus />
            <button className="primary" disabled={busy}>Save</button>
            <button type="button" className="ghost" onClick={() => setEditing(false)}>Cancel</button>
          </form>
        ) : (
          <div className="team-title">
            <h1>{team.name}</h1>
            <button className="ghost small" onClick={() => { setName(team.name); setEditing(true); }}>Rename</button>
          </div>
        )}
        <div className="stat-row">
          <div className="stat"><span className="stat-value">{points(team.seasonPoints)}</span><span className="muted">{team.season ?? ""} points</span></div>
          <div className="stat"><span className="stat-value">{team.roster.length}/{slots.length}</span><span className="muted">players</span></div>
        </div>
        <SalaryBar used={team.salaryUsed} cap={team.salaryCap} />
        {actionError && <p className="error" role="alert">{actionError}</p>}
      </section>

      <section className="card">
        <h2>Roster</h2>
        <ul className="slots">
          {slots.map(({ position, player }, i) => (
            <li key={player?.id ?? `${position}-${i}`} className={player ? "slot" : "slot empty"}>
              <PositionBadge position={position} />
              {player ? (
                <>
                  <div className="slot-player">
                    <span className="player-name">{player.name}</span>
                    <span className="muted small">{player.team} · ${player.salary} · {points(player.seasonPoints)} pts</span>
                  </div>
                  <div className="slot-actions">
                    <button className="ghost small" onClick={() => onSwap(player)} disabled={busy}>Swap</button>
                    <button className="ghost small danger" onClick={() => drop(player)} disabled={busy} aria-label={`Drop ${player.name}`}>Drop</button>
                  </div>
                </>
              ) : (
                <>
                  <span className="slot-player muted">Empty {position} slot</span>
                  <button className="primary small" onClick={() => onBrowse(position)}>Find a {position}</button>
                </>
              )}
            </li>
          ))}
        </ul>
      </section>

      <button className="ghost danger delete-team" onClick={deleteTeam} disabled={busy}>Delete team</button>
    </>
  );
}
