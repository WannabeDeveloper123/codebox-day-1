// Vercel runs this file as a serverless function for every /api request (see vercel.json).
// There is no app.listen here: Vercel calls the Express app once per request instead.
require("../config/env");

const app = require("../app");
const { connectDB } = require("../db/database");

module.exports = async (req, res) => {
  try {
    await connectDB();
  } catch (err) {
    console.error(`Could not connect to the database: ${err.message}`);
    res.statusCode = 503;
    res.setHeader("Content-Type", "application/json");
    return res.end(JSON.stringify({ error: "Database unavailable" }));
  }
  return app(req, res);
};
