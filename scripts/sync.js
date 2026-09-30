// Usage: npm run sync
// Copies NFL players and this season's weekly points from Sleeper into Postgres.
require("../config/env");

const { connectDB, closeDB } = require("../db/database");
const { syncAll } = require("../services/syncService");

async function main() {
  await connectDB();
  try {
    await syncAll();
  } finally {
    await closeDB();
  }
}

main().catch((err) => {
  console.error(`Sync failed: ${err.message}`);
  process.exit(1);
});
