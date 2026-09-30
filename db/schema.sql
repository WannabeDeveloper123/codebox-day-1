CREATE TABLE IF NOT EXISTS users (
  id            SERIAL PRIMARY KEY,
  name          TEXT NOT NULL,
  email         TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS todos (
  id         SERIAL PRIMARY KEY,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title      TEXT NOT NULL,
  completed  BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS todos_user_id_idx ON todos (user_id);

-- Fantasy football: players and weekly points are imported from the Sleeper API
CREATE TABLE IF NOT EXISTS players (
  id       TEXT PRIMARY KEY,
  name     TEXT NOT NULL,
  team     TEXT NOT NULL,
  position TEXT NOT NULL,
  salary   INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS player_week_points (
  player_id TEXT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  season    INTEGER NOT NULL,
  week      INTEGER NOT NULL,
  points    NUMERIC(6, 2) NOT NULL,
  PRIMARY KEY (player_id, season, week)
);

CREATE TABLE IF NOT EXISTS fantasy_teams (
  id         SERIAL PRIMARY KEY,
  user_id    INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS roster_spots (
  team_id   INTEGER NOT NULL REFERENCES fantasy_teams(id) ON DELETE CASCADE,
  player_id TEXT NOT NULL REFERENCES players(id),
  PRIMARY KEY (team_id, player_id)
);
