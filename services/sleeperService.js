// Reads from the free, public Sleeper API (https://docs.sleeper.com, no key needed).
// Only the sync script calls this; the app itself reads the copy in Postgres.
const BASE_URL = "https://api.sleeper.app/v1";

async function getJson(path) {
  const res = await fetch(BASE_URL + path, { signal: AbortSignal.timeout(60_000) });
  if (!res.ok) throw new Error(`Sleeper ${path} returned ${res.status}`);
  return res.json();
}

// { season: "2026", week: 4, previous_season: "2025", ... }
function getNflState() {
  return getJson("/state/nfl");
}

// Every NFL player keyed by id (about 14 MB)
function getAllPlayers() {
  return getJson("/players/nfl");
}

// Stats keyed by player id; pass a week for one week, or none for season totals
function getStats(season, week) {
  return getJson(`/stats/nfl/regular/${season}${week ? `/${week}` : ""}`);
}

module.exports = { getNflState, getAllPlayers, getStats };
