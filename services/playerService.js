const { query } = require("../db/database");

// The season shown in the app: the newest one we have points for
async function getCurrentSeason() {
  const { rows } = await query("SELECT max(season) AS season FROM player_week_points");
  return rows[0].season;
}

async function getScoredWeeks(season) {
  const { rows } = await query(
    "SELECT DISTINCT week FROM player_week_points WHERE season = $1 ORDER BY week",
    [season]
  );
  return rows.map((r) => r.week);
}

// Escapes % and _ so a search for "a_b" matches literally
function likePattern(text) {
  return `%${text.replace(/[\\%_]/g, "\\$&")}%`;
}

async function listPlayers({ position, search, limit = 200 }) {
  const season = await getCurrentSeason();
  const { rows } = await query(
    `SELECT p.id, p.name, p.team, p.position, p.salary,
            COALESCE(sum(w.points), 0)::float8 AS "seasonPoints"
       FROM players p
       LEFT JOIN player_week_points w ON w.player_id = p.id AND w.season = $1
      WHERE ($2::text IS NULL OR p.position = $2)
        AND ($3::text IS NULL OR p.name ILIKE $3)
      GROUP BY p.id
      ORDER BY p.salary DESC, "seasonPoints" DESC, p.name
      LIMIT $4`,
    [season, position ?? null, search ? likePattern(search) : null, limit]
  );
  return rows;
}

module.exports = { getCurrentSeason, getScoredWeeks, listPlayers };
