const { query, withTransaction } = require("../db/database");
const { getCurrentSeason, getScoredWeeks } = require("./playerService");
const { SALARY_CAP, ROSTER_SLOTS, ROSTER_SIZE } = require("./fantasyRules");
const { RuleError, NotFoundError, ConflictError } = require("./errors");

async function findTeam(db, userId, { lock = false } = {}) {
  const { rows } = await db.query(
    `SELECT id, name FROM fantasy_teams WHERE user_id = $1${lock ? " FOR UPDATE" : ""}`,
    [userId]
  );
  return rows[0];
}

async function getRoster(db, teamId, season) {
  const { rows } = await db.query(
    `SELECT p.id, p.name, p.team, p.position, p.salary,
            COALESCE(sum(w.points), 0)::float8 AS "seasonPoints"
       FROM roster_spots r
       JOIN players p ON p.id = r.player_id
       LEFT JOIN player_week_points w ON w.player_id = p.id AND w.season = $2
      WHERE r.team_id = $1
      GROUP BY p.id
      ORDER BY p.position, p.salary DESC`,
    [teamId, season]
  );
  return rows;
}

async function findPlayer(db, playerId) {
  const { rows } = await db.query(
    "SELECT id, name, position, salary FROM players WHERE id = $1",
    [playerId]
  );
  if (!rows[0]) throw new NotFoundError("Player not found");
  return rows[0];
}

// Throws a RuleError if adding `player` (and removing `leaving`, for a swap) breaks a rule
function checkRules(roster, player, leaving) {
  const remaining = leaving ? roster.filter((p) => p.id !== leaving.id) : roster;

  if (remaining.some((p) => p.id === player.id)) {
    throw new RuleError(`${player.name} is already on your team`);
  }
  if (remaining.length >= ROSTER_SIZE) {
    throw new RuleError(`Your roster is full (${ROSTER_SIZE} players). Drop someone first.`);
  }
  const atPosition = remaining.filter((p) => p.position === player.position).length;
  if (atPosition >= ROSTER_SLOTS[player.position]) {
    throw new RuleError(`You already have ${ROSTER_SLOTS[player.position]} ${player.position}. Drop or swap one first.`);
  }
  const salary = remaining.reduce((sum, p) => sum + p.salary, 0) + player.salary;
  if (salary > SALARY_CAP) {
    throw new RuleError(`${player.name} ($${player.salary}) would put you $${salary - SALARY_CAP} over the $${SALARY_CAP} cap`);
  }
}

async function getTeam(userId) {
  const team = await findTeam({ query }, userId);
  if (!team) return undefined;

  const season = await getCurrentSeason();
  const roster = await getRoster({ query }, team.id, season);
  return {
    ...team,
    season,
    roster,
    salaryUsed: roster.reduce((sum, p) => sum + p.salary, 0),
    salaryCap: SALARY_CAP,
    slots: ROSTER_SLOTS,
    seasonPoints: roster.reduce((sum, p) => sum + p.seasonPoints, 0),
  };
}

async function createTeam(userId, name) {
  try {
    await query("INSERT INTO fantasy_teams (user_id, name) VALUES ($1, $2)", [userId, name]);
  } catch (err) {
    if (err.code === "23505") throw new ConflictError("You already have a team");
    throw err;
  }
  return getTeam(userId);
}

async function renameTeam(userId, name) {
  const { rowCount } = await query(
    "UPDATE fantasy_teams SET name = $2 WHERE user_id = $1",
    [userId, name]
  );
  if (!rowCount) throw new NotFoundError("You don't have a team yet");
  return getTeam(userId);
}

async function deleteTeam(userId) {
  const { rowCount } = await query("DELETE FROM fantasy_teams WHERE user_id = $1", [userId]);
  if (!rowCount) throw new NotFoundError("You don't have a team yet");
}

// Locks the team row so two quick clicks can't both squeeze under the cap
async function addPlayer(userId, playerId) {
  await withTransaction(async (db) => {
    const team = await findTeam(db, userId, { lock: true });
    if (!team) throw new NotFoundError("Create a team first");

    const player = await findPlayer(db, playerId);
    checkRules(await getRoster(db, team.id, 0), player);
    await db.query("INSERT INTO roster_spots (team_id, player_id) VALUES ($1, $2)", [team.id, player.id]);
  });
  return getTeam(userId);
}

async function dropPlayer(userId, playerId) {
  const { rowCount } = await query(
    `DELETE FROM roster_spots
      WHERE player_id = $2
        AND team_id = (SELECT id FROM fantasy_teams WHERE user_id = $1)`,
    [userId, playerId]
  );
  if (!rowCount) throw new NotFoundError("That player isn't on your team");
  return getTeam(userId);
}

// Replaces one rostered player with another at the same position, in one step
async function swapPlayer(userId, outId, inId) {
  await withTransaction(async (db) => {
    const team = await findTeam(db, userId, { lock: true });
    if (!team) throw new NotFoundError("Create a team first");

    const roster = await getRoster(db, team.id, 0);
    const leaving = roster.find((p) => p.id === outId);
    if (!leaving) throw new NotFoundError("That player isn't on your team");

    const joining = await findPlayer(db, inId);
    if (joining.position !== leaving.position) {
      throw new RuleError(`Swap a ${leaving.position} for another ${leaving.position}`);
    }
    checkRules(roster, joining, leaving);

    await db.query("DELETE FROM roster_spots WHERE team_id = $1 AND player_id = $2", [team.id, outId]);
    await db.query("INSERT INTO roster_spots (team_id, player_id) VALUES ($1, $2)", [team.id, inId]);
  });
  return getTeam(userId);
}

// Every team ranked by points for one week, or the whole season when week is null
async function getLeaderboard(week) {
  const season = await getCurrentSeason();
  const weeks = await getScoredWeeks(season);
  const { rows } = await query(
    `SELECT t.id, t.name, u.name AS owner,
            COALESCE(sum(w.points), 0)::float8 AS points
       FROM fantasy_teams t
       JOIN users u ON u.id = t.user_id
       LEFT JOIN roster_spots r ON r.team_id = t.id
       LEFT JOIN player_week_points w
              ON w.player_id = r.player_id AND w.season = $1
             AND ($2::int IS NULL OR w.week = $2)
      GROUP BY t.id, u.name
      ORDER BY points DESC, t.name`,
    [season, week]
  );

  // Teams with equal points share a rank
  let rank = 0;
  const teams = rows.map((row, i) => {
    if (i === 0 || row.points !== rows[i - 1].points) rank = i + 1;
    return { rank, ...row, points: Math.round(row.points * 100) / 100 };
  });
  return { season, weeks, week, teams };
}

module.exports = {
  getTeam, createTeam, renameTeam, deleteTeam,
  addPlayer, dropPlayer, swapPlayer, getLeaderboard,
};
