import { useEffect, useState } from "react";
import { api, clearToken, getToken, saveToken } from "./api.js";
import LoginPage from "./pages/LoginPage.jsx";
import TeamPage from "./pages/TeamPage.jsx";
import PlayersPage from "./pages/PlayersPage.jsx";
import LeaderboardPage from "./pages/LeaderboardPage.jsx";
import Spinner from "./components/Spinner.jsx";

const TABS = [
  { id: "team", label: "My Team" },
  { id: "players", label: "Players" },
  { id: "leaderboard", label: "Leaderboard" },
];

export default function App() {
  const [user, setUser] = useState(null);
  const [checking, setChecking] = useState(Boolean(getToken()));
  const [tab, setTab] = useState("team");
  // null = no team yet, undefined = still loading
  const [team, setTeam] = useState(undefined);
  const [teamError, setTeamError] = useState(null);
  // Set when the user clicks "Swap" on a rostered player
  const [swapOut, setSwapOut] = useState(null);
  const [playerFilter, setPlayerFilter] = useState(null);

  // On first load, turn a saved token back into a user (or drop it if it expired)
  useEffect(() => {
    if (!getToken()) return;
    api("/api/me")
      .then(setUser)
      // Only forget the token if the server rejected it, not if the server is just down
      .catch((err) => {
        if (err.status === 401 || err.status === 404) clearToken();
      })
      .finally(() => setChecking(false));
  }, []);

  useEffect(() => {
    if (user) loadTeam();
  }, [user]);

  async function loadTeam() {
    setTeam(undefined);
    setTeamError(null);
    try {
      setTeam(await api("/api/fantasy/team"));
    } catch (err) {
      if (err.status === 404) return setTeam(null);
      if (err.status === 401) return logout();
      setTeamError(err.message);
    }
  }

  function handleAuth({ token, user }) {
    saveToken(token);
    setUser(user);
  }

  function logout() {
    clearToken();
    setUser(null);
    setTeam(undefined);
    setTab("team");
  }

  function browsePlayers(position) {
    setPlayerFilter(position ?? null);
    setTab("players");
  }

  function startSwap(player) {
    setSwapOut(player);
    browsePlayers(player.position);
  }

  function finishSwap() {
    setSwapOut(null);
    setTab("team");
  }

  if (checking) {
    return (
      <main className="center">
        <Spinner label="Loading" />
      </main>
    );
  }

  if (!user) return <LoginPage onAuth={handleAuth} />;

  return (
    <div className="shell">
      <header className="appbar">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true">🏈</span>
          <span>CodeBox Fantasy</span>
        </div>
        <nav className="tabs" aria-label="Main">
          {TABS.map((t) => (
            <button
              key={t.id}
              className={tab === t.id ? "tab active" : "tab"}
              aria-current={tab === t.id ? "page" : undefined}
              onClick={() => {
                setSwapOut(null);
                if (t.id === "players") browsePlayers(null);
                else setTab(t.id);
              }}
            >
              {t.label}
            </button>
          ))}
        </nav>
        <div className="account">
          <span className="muted">{user.name}</span>
          <button className="ghost" onClick={logout}>Log out</button>
        </div>
      </header>

      <main className="page">
        {tab === "team" && (
          <TeamPage
            team={team}
            error={teamError}
            onRetry={loadTeam}
            onTeamChange={setTeam}
            onBrowse={browsePlayers}
            onSwap={startSwap}
            onAuthError={logout}
          />
        )}
        {tab === "players" && (
          <PlayersPage
            key={`${playerFilter}-${swapOut?.id}`}
            team={team}
            initialPosition={playerFilter}
            swapOut={swapOut}
            onTeamChange={setTeam}
            onSwapDone={finishSwap}
            onCancelSwap={() => setSwapOut(null)}
            onGoToTeam={() => setTab("team")}
            onAuthError={logout}
          />
        )}
        {tab === "leaderboard" && <LeaderboardPage myTeamId={team?.id} />}
      </main>

      <footer className="footer muted">
        Real NFL players and PPR points from the <a href="https://docs.sleeper.com" target="_blank" rel="noreferrer">Sleeper API</a>.
      </footer>
    </div>
  );
}
