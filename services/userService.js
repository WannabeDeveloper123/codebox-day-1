const { query } = require("../db/database");

// Public fields only; password_hash never leaves this file
const PUBLIC = "id, name";
const PRIVATE = "id, name, email";

async function getAllUsers() {
  const { rows } = await query(`SELECT ${PUBLIC} FROM users ORDER BY id`);
  return rows;
}

async function getUserById(id) {
  const { rows } = await query(`SELECT ${PUBLIC} FROM users WHERE id = $1`, [id]);
  return rows[0];
}

async function getProfile(id) {
  const { rows } = await query(`SELECT ${PRIVATE} FROM users WHERE id = $1`, [id]);
  return rows[0];
}

async function createUser({ name, email, passwordHash }) {
  const { rows } = await query(
    `INSERT INTO users (name, email, password_hash) VALUES ($1, $2, $3) RETURNING ${PRIVATE}`,
    [name, email, passwordHash]
  );
  return rows[0];
}

async function getUserWithHashByEmail(email) {
  const { rows } = await query(
    `SELECT ${PRIVATE}, password_hash FROM users WHERE email = $1`,
    [email]
  );
  return rows[0];
}

module.exports = { getAllUsers, getUserById, getProfile, createUser, getUserWithHashByEmail };
