// Usage: npm run sync
// Copies NFL players and this season's weekly points from Sleeper into Postgres.
require("../config/env");

async function main() {
  // Loaded here so a bad DATABASE_URL is reported by the catch below
  const { connectDB, closeDB, databaseTarget } = require("../db/database");
  const { syncAll } = require("../services/syncService");
  console.log(`Database: ${databaseTarget()}`);
  await connectDB();
  try {
    await syncAll();
  } finally {
    await closeDB();
  }
}

main().catch((err) => {
  console.error(`Sync failed: ${err.message || err.code || err}`);
  process.exit(1);
});
