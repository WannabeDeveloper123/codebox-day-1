const jwt = require("jsonwebtoken");
const { requireEnv } = require("../config/env");

// No fallback: the server refuses to start without a secret
const JWT_SECRET = requireEnv("JWT_SECRET");

function requireAuth(req, res, next) {
  const header = req.get("Authorization") || "";
  const [scheme, token] = header.split(" ");

  if (scheme !== "Bearer" || !token) {
    return res.status(401).json({ error: "Missing token" });
  }

  try {
    // Checks the signature and expiration, and only accepts HS256
    req.user = jwt.verify(token, JWT_SECRET, { algorithms: ["HS256"] });
    next();
  } catch (err) {
    const message = err.name === "TokenExpiredError" ? "Token expired" : "Invalid token";
    return res.status(401).json({ error: message });
  }
}

module.exports = { requireAuth };
