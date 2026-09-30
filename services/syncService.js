const { query } = require("../db/database");
const sleeper = require("./sleeperService");
const { POSITIONS } = require("./fantasyRules");

const MIN_SALARY = 4;
const MAX_SALARY = 20;
const ROOKIE_SALARY = 6;

// Turns Sleeper's player list into our rows. Keeps active QB/RB/WR/TE players who
// scored last season or are highly ranked, and prices them by last season's PPR
// points relative to the best player at their position.
function buildPlayers(allPlayers, lastSeasonStats) {
  const candidates = Object.values(allPlayers).filter((p) => {
    if (!p.active || !p.team || !POSITIONS.includes(p.position)) return false;
    const points = lastSeasonStats[p.player_id]?.pts_ppr ?? 0;
    return points > 20 || (p.search_rank ?? Infinity) <= 300;
  });

  const bestByPosition = {};
  for (const p of candidates) {
    const points = lastSeasonStats[p.player_id]?.pts_ppr ?? 0;
    bestByPosition[p.position] = Math.max(bestByPosition[p.position] ?? 0, points);
  }

  return candidates.map((p) => {
    const points = lastSeasonStats[p.player_id]?.pts_ppr ?? 0;
    const salary = points > 0
      ? Math.round(MIN_SALARY + (MAX_SALARY - MIN_SALARY) * (points / bestByPosition[p.position]))
      : ROOKIE_SALARY;
    return {
      id: p.player_id,
      name: p.full_name || `${p.first_name} ${p.last_name}`,
      team: p.team,
      position: p.position,
      salary,
    };
  });
}

async function savePlayers(players) {
  await query(
    `INSERT INTO players (id, name, team, position, salary)
     SELECT * FROM unnest($1::text[], $2::text[], $3::text[], $4::text[], $5::int[])
     ON CONFLICT (id) DO UPDATE
       SET name = EXCLUDED.name, team = EXCLUDED.team,
           position = EXCLUDED.position, salary = EXCLUDED.salary`,
    [
      players.map((p) => p.id),
      players.map((p) => p.name),
      players.map((p) => p.team),
      players.map((p) => p.position),
      players.map((p) => p.salary),
    ]
  );
}

// Saves one week's PPR points for players we track; returns how many rows were saved
async function saveWeekPoints(season, week, stats) {
  const entries = Object.entries(stats).filter(([, s]) => typeof s.pts_ppr === "number");
  if (entries.length === 0) return 0;

  const { rowCount } = await query(
    `INSERT INTO player_week_points (player_id, season, week, points)
     SELECT t.id, $3, $4, t.points
       FROM unnest($1::text[], $2::numeric[]) AS t(id, points)
       JOIN players ON players.id = t.id
     ON CONFLICT (player_id, season, week) DO UPDATE SET points = EXCLUDED.points`,
    [entries.map(([id]) => id), entries.map(([, s]) => s.pts_ppr), season, week]
  );
  return rowCount;
}

// Imports players and every week played so far this season
async function syncAll(log = console.log) {
  const state = await sleeper.getNflState();
  const season = Number(state.season);
  const currentWeek = Number(state.week);
  log(`Sleeper says: ${season} season, week ${currentWeek}`);

  const [allPlayers, lastSeason] = await Promise.all([
    sleeper.getAllPlayers(),
    sleeper.getStats(state.previous_season),
  ]);
  const players = buildPlayers(allPlayers, lastSeason);
  await savePlayers(players);
  log(`Saved ${players.length} players`);

  for (let week = 1; week <= currentWeek; week++) {
    const saved = await saveWeekPoints(season, week, await sleeper.getStats(season, week));
    log(saved ? `Week ${week}: saved points for ${saved} players` : `Week ${week}: no games yet`);
  }
}

module.exports = { buildPlayers, savePlayers, saveWeekPoints, syncAll };
