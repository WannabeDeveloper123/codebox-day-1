const fs = require("node:fs");
const path = require("node:path");
const { Pool } = require("pg");
const { requireEnv } = require("../config/env");

// Hosted databases like Supabase need SSL; local Postgres doesn't
const ssl = process.env.DATABASE_SSL === "true" ? { rejectUnauthorized: false } : undefined;

// The one connection pool for the whole app. Every service imports this module.
const pool = new Pool({ connectionString: requireEnv("DATABASE_URL"), ssl });

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

// Called once at startup: checks the connection and creates tables if needed
async function connectDB() {
  await pool.query("SELECT 1");
  const schema = fs.readFileSync(path.join(__dirname, "schema.sql"), "utf8");
  await pool.query(schema);
}

function closeDB() {
  return pool.end();
}

module.exports = { query, withTransaction, connectDB, closeDB };
