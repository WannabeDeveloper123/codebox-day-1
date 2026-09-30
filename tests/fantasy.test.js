// Always use the test database, never the dev one (set before anything loads .env)
process.env.DATABASE_URL =
  process.env.TEST_DATABASE_URL || "postgresql://localhost:5432/codebox_test";

const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const app = require("../app");
const { connectDB, closeDB, query } = require("../db/database");
const { buildPlayers } = require("../services/syncService");

let server;
let base;

// A small fixed player pool, so tests never depend on the Sleeper API
const PLAYERS = [
  ["qb1", "Star Quarterback", "BUF", "QB", 20],
  ["qb2", "Cheap Quarterback", "NYJ", "QB", 5],
  ["rb1", "Star Runner", "SF", "RB", 20],
  ["rb2", "Solid Runner", "DET", "RB", 12],
  ["rb3", "Cheap Runner", "NE", "RB", 4],
  ["wr1", "Star Receiver", "LAR", "WR", 20],
  ["wr2", "Solid Receiver", "SEA", "WR", 14],
  ["wr3", "Cheap Receiver", "MIA", "WR", 4],
  ["te1", "Star Tight End", "ARI", "TE", 20],
  ["te2", "Cheap Tight End", "KC", "TE", 4],
];

before(async () => {
  await connectDB();
  await query("TRUNCATE users, players, player_week_points RESTART IDENTITY CASCADE");
  for (const p of PLAYERS) {
    await query("INSERT INTO players (id, name, team, position, salary) VALUES ($1, $2, $3, $4, $5)", p);
  }
  await query(
    `INSERT INTO player_week_points (player_id, season, week, points) VALUES
       ('qb1', 2026, 1, 25.5), ('qb1', 2026, 2, 10),
       ('rb1', 2026, 1, 20),   ('qb2', 2026, 1, 8),
       ('wr1', 2026, 2, 30)`
  );
  server = app.listen(0);
  base = `http://localhost:${server.address().port}`;
});

after(async () => {
  server.close();
  await closeDB();
});

async function api(method, path, { body, token } = {}) {
  const headers = {};
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(base + path, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  return { status: res.status, body: text ? JSON.parse(text) : null };
}

async function registerUser(name) {
  const res = await api("POST", "/api/auth/register", {
    body: { name, email: `${name.toLowerCase()}@test.dev`, password: "password123" },
  });
  assert.equal(res.status, 201);
  return res.body.token;
}

async function teamWith(name, playerIds) {
  const token = await registerUser(name);
  assert.equal((await api("POST", "/api/fantasy/team", { token, body: { name: `${name} FC` } })).status, 201);
  for (const playerId of playerIds) {
    const res = await api("POST", "/api/fantasy/team/players", { token, body: { playerId } });
    assert.equal(res.status, 201, JSON.stringify(res.body));
  }
  return token;
}

test("buildPlayers keeps active skill players and prices them by position", () => {
  const all = {
    1: { player_id: "1", full_name: "Top QB", position: "QB", team: "BUF", active: true, search_rank: 5 },
    2: { player_id: "2", full_name: "Half QB", position: "QB", team: "NYJ", active: true, search_rank: 90 },
    3: { player_id: "3", full_name: "Rookie RB", position: "RB", team: "NE", active: true, search_rank: 40 },
    4: { player_id: "4", full_name: "Kicker", position: "K", team: "KC", active: true, search_rank: 10 },
    5: { player_id: "5", full_name: "Retired WR", position: "WR", team: null, active: false },
    6: { player_id: "6", full_name: "Bench TE", position: "TE", team: "MIA", active: true, search_rank: 999 },
  };
  const lastSeason = { 1: { pts_ppr: 400 }, 2: { pts_ppr: 200 }, 6: { pts_ppr: 5 } };

  const players = buildPlayers(all, lastSeason);
  assert.deepEqual(
    players.map((p) => [p.id, p.salary]),
    [["1", 20], ["2", 12], ["3", 6]]
  );
});

test("players list is public and filters by position and search", async () => {
  const rbs = await api("GET", "/api/players?position=RB");
  assert.equal(rbs.status, 200);
  assert.deepEqual(rbs.body.map((p) => p.id), ["rb1", "rb2", "rb3"]);
  assert.equal(rbs.body[0].seasonPoints, 20);

  const search = await api("GET", "/api/players?search=cheap");
  assert.equal(search.body.length, 4);

  assert.equal((await api("GET", "/api/players?position=K")).status, 400);
});

test("team CRUD: create, read, rename, delete", async () => {
  const token = await registerUser("Owner");

  assert.equal((await api("GET", "/api/fantasy/team", { token })).status, 404);
  assert.equal((await api("POST", "/api/fantasy/team", { token, body: { name: "" } })).status, 400);

  const created = await api("POST", "/api/fantasy/team", { token, body: { name: "Gridiron Gang" } });
  assert.equal(created.status, 201);
  assert.equal(created.body.name, "Gridiron Gang");
  assert.equal(created.body.salaryCap, 100);
  assert.deepEqual(created.body.roster, []);

  assert.equal((await api("POST", "/api/fantasy/team", { token, body: { name: "Again" } })).status, 409);

  const renamed = await api("PUT", "/api/fantasy/team", { token, body: { name: "Blitz Squad" } });
  assert.equal(renamed.body.name, "Blitz Squad");

  assert.equal((await api("DELETE", "/api/fantasy/team", { token })).status, 204);
  assert.equal((await api("GET", "/api/fantasy/team", { token })).status, 404);
});

test("team routes need a token", async () => {
  assert.equal((await api("GET", "/api/fantasy/team")).status, 401);
  assert.equal((await api("POST", "/api/fantasy/team/players", { body: { playerId: "qb1" } })).status, 401);
});

test("roster rules: positions, duplicates, salary cap", async () => {
  const token = await teamWith("Rules", ["qb1", "rb1"]);

  const dupe = await api("POST", "/api/fantasy/team/players", { token, body: { playerId: "qb1" } });
  assert.equal(dupe.status, 400);
  assert.match(dupe.body.error, /already on your team/);

  const secondQb = await api("POST", "/api/fantasy/team/players", { token, body: { playerId: "qb2" } });
  assert.equal(secondQb.status, 400);
  assert.match(secondQb.body.error, /already have 1 QB/);

  // $40 used; + $20 + $20 + $14 = $94, then a $12 runner would be $106
  for (const playerId of ["wr1", "te1", "wr2"]) {
    const res = await api("POST", "/api/fantasy/team/players", { token, body: { playerId } });
    assert.equal(res.status, 201);
  }
  const overCap = await api("POST", "/api/fantasy/team/players", { token, body: { playerId: "rb2" } });
  assert.equal(overCap.status, 400);
  assert.match(overCap.body.error, /\$6 over the \$100 cap/);

  const team = await api("GET", "/api/fantasy/team", { token });
  assert.equal(team.body.salaryUsed, 94);
  assert.equal(team.body.roster.length, 5);

  assert.equal((await api("POST", "/api/fantasy/team/players", { token, body: { playerId: "nope" } })).status, 404);
  assert.equal((await api("POST", "/api/fantasy/team/players", { token, body: { playerId: "bad id!" } })).status, 400);
});

test("swap and drop players", async () => {
  const token = await teamWith("Swapper", ["qb2", "rb3", "wr3"]);

  const wrongPosition = await api("PUT", "/api/fantasy/team/players/qb2", { token, body: { playerId: "rb1" } });
  assert.equal(wrongPosition.status, 400);

  const swapped = await api("PUT", "/api/fantasy/team/players/qb2", { token, body: { playerId: "qb1" } });
  assert.equal(swapped.status, 200);
  assert.deepEqual(swapped.body.roster.map((p) => p.id).sort(), ["qb1", "rb3", "wr3"]);

  assert.equal((await api("PUT", "/api/fantasy/team/players/qb2", { token, body: { playerId: "qb1" } })).status, 404);

  const dropped = await api("DELETE", "/api/fantasy/team/players/wr3", { token });
  assert.equal(dropped.status, 200);
  assert.equal(dropped.body.roster.length, 2);
  assert.equal((await api("DELETE", "/api/fantasy/team/players/wr3", { token })).status, 404);
});

test("leaderboard ranks teams by season and by week", async () => {
  await query("TRUNCATE users RESTART IDENTITY CASCADE");
  await teamWith("Alpha", ["qb1"]);         // 25.5 + 10 = 35.5, week 2: 10
  await teamWith("Bravo", ["wr1", "qb2"]);  // 30 + 8 = 38,     week 2: 30
  await teamWith("Charlie", []);            // 0

  const season = await api("GET", "/api/fantasy/leaderboard");
  assert.equal(season.status, 200);
  assert.equal(season.body.season, 2026);
  assert.deepEqual(season.body.weeks, [1, 2]);
  assert.deepEqual(
    season.body.teams.map((t) => [t.rank, t.name, t.points]),
    [[1, "Bravo FC", 38], [2, "Alpha FC", 35.5], [3, "Charlie FC", 0]]
  );
  assert.ok(!JSON.stringify(season.body).includes("email"));

  const week1 = await api("GET", "/api/fantasy/leaderboard?week=1");
  assert.deepEqual(week1.body.teams.map((t) => [t.name, t.points]), [
    ["Alpha FC", 25.5], ["Bravo FC", 8], ["Charlie FC", 0],
  ]);

  assert.equal((await api("GET", "/api/fantasy/leaderboard?week=0")).status, 400);
});
