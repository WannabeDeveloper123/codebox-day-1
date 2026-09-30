require("./config/env");

const app = require("./app");
const { connectDB, closeDB } = require("./db/database");

const PORT = process.env.PORT || 3000;

async function start() {
  try {
    await connectDB();
  } catch (err) {
    console.error(`Could not connect to the database: ${err.message}`);
    console.error("Check DATABASE_URL (in .env locally, or your host's environment variables) and that the database is reachable.");
    process.exit(1);
  }

  const server = app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
  });

  // Close the HTTP server and the database pool cleanly on Ctrl+C or a platform stop
  for (const signal of ["SIGINT", "SIGTERM"]) {
    process.once(signal, () => {
      server.close(() => closeDB().then(() => process.exit(0)));
    });
  }
}

start();
