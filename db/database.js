const fs = require("node:fs");
const path = require("node:path");
const { Pool } = require("pg");
const { requireEnv } = require("../config/env");

// Hosted databases like Supabase need SSL; local Postgres doesn't
const ssl = process.env.DATABASE_SSL === "true" ? { rejectUnauthorized: false } : undefined;

// The one connection pool for the whole app. Every service imports this module.
// On Vercel each function instance gets its own pool, so keep it to one connection
// to stay under Supabase's connection limit.
const pool = new Pool({
  connectionString: requireEnv("DATABASE_URL"),
  ssl,
  max: process.env.VERCEL ? 1 : 10,
});

function query(text, params) {
  return pool.query(text, params);
}

// Runs fn(client) inside BEGIN/COMMIT on a client borrowed from the pool,
// rolling back if fn throws
async function withTransaction(fn) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

let connecting;

// Checks the connection and creates tables if needed. Runs once: later calls reuse
// the same result, so the Vercel function can call it on every request.
function connectDB() {
  connecting ??= (async () => {
    await pool.query("SELECT 1");
    const schema = fs.readFileSync(path.join(__dirname, "schema.sql"), "utf8");
    await pool.query(schema);
  })().catch((err) => {
    connecting = undefined; // let the next call try again
    throw err;
  });
  return connecting;
}

function closeDB() {
  return pool.end();
}

module.exports = { query, withTransaction, connectDB, closeDB };
