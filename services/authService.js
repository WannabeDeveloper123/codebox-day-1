const crypto = require("node:crypto");
const { promisify } = require("node:util");
const jwt = require("jsonwebtoken");
const { requireEnv } = require("../config/env");
const userService = require("./userService");

const scrypt = promisify(crypto.scrypt);
const JWT_SECRET = requireEnv("JWT_SECRET");
const TOKEN_TTL = "1h";

// Stored as "salt:hash" (both hex)
async function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = await scrypt(password, salt, 64);
  return `${salt}:${hash.toString("hex")}`;
}

async function verifyPassword(password, stored) {
  const [salt, hashHex] = stored.split(":");
  const hash = await scrypt(password, salt, 64);
  return crypto.timingSafeEqual(hash, Buffer.from(hashHex, "hex"));
}

// Used when the email doesn't exist, so a login takes the same time either way
const DUMMY_HASH = hashPassword(crypto.randomBytes(16).toString("hex"));

function signToken(user) {
  return jwt.sign({ sub: String(user.id) }, JWT_SECRET, {
    algorithm: "HS256",
    expiresIn: TOKEN_TTL,
  });
}

class EmailTakenError extends Error {}

async function register({ name, email, password }) {
  const passwordHash = await hashPassword(password);
  try {
    const user = await userService.createUser({ name, email, passwordHash });
    return { token: signToken(user), user };
  } catch (err) {
    if (err.code === "23505") throw new EmailTakenError("Email already registered");
    throw err;
  }
}

// Returns null for a wrong email or password (the caller can't tell which)
async function login({ email, password }) {
  const found = await userService.getUserWithHashByEmail(email);
  const ok = await verifyPassword(password, found ? found.password_hash : await DUMMY_HASH);
  if (!found || !ok) return null;

  const { password_hash, ...user } = found;
  return { token: signToken(user), user };
}

module.exports = { register, login, EmailTakenError };
