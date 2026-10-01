// Vercel runs this file as a serverless function for every /api request (see vercel.json).
// There is no app.listen here: Vercel calls the Express app once per request instead.

function sendJson(res, status, body) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(body));
}

// Loading the app reads required settings (JWT_SECRET, DATABASE_URL). If one is
// missing or malformed, answer with a short reason instead of crashing, so the
// problem is visible without digging through logs. Details stay in the logs.
let app;
let connectDB;
let startupError;
try {
  require("../config/env");
  app = require("../app");
  ({ connectDB } = require("../db/database"));
} catch (err) {
  startupError = err;
  console.error(`Startup failed: ${err.message}`);
}

function publicReason(err) {
  const firstClause = err.message.split(":")[0];
  return /^(Missing [A-Z_]+|DATABASE_URL is not a valid connection string)/.test(firstClause)
    ? firstClause.replace(/\. Copy .*/, "")
    : "Server failed to start";
}

module.exports = async (req, res) => {
  if (startupError) {
    return sendJson(res, 500, { error: "Server configuration error", reason: publicReason(startupError) });
  }
  try {
    await connectDB();
  } catch (err) {
    console.error(`Could not connect to the database: ${err.message || err.code || err}`);
    return sendJson(res, 503, { error: "Database unavailable" });
  }
  return app(req, res);
};
