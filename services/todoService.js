const { query } = require("../db/database");

// Every query filters by user_id, so users only ever see their own todos
const COLUMNS = `id, title, completed, created_at AS "createdAt"`;

async function listTodos(userId) {
  const { rows } = await query(
    `SELECT ${COLUMNS} FROM todos WHERE user_id = $1 ORDER BY id`,
    [userId]
  );
  return rows;
}

async function createTodo(userId, title) {
  const { rows } = await query(
    `INSERT INTO todos (user_id, title) VALUES ($1, $2) RETURNING ${COLUMNS}`,
    [userId, title]
  );
  return rows[0];
}

// Only the fields passed in are changed; returns undefined if not found
async function updateTodo(userId, id, { title, completed }) {
  const { rows } = await query(
    `UPDATE todos
        SET title = COALESCE($3, title),
            completed = COALESCE($4, completed)
      WHERE id = $1 AND user_id = $2
      RETURNING ${COLUMNS}`,
    [id, userId, title ?? null, completed ?? null]
  );
  return rows[0];
}

// Returns true if a todo was deleted
async function deleteTodo(userId, id) {
  const { rowCount } = await query(
    "DELETE FROM todos WHERE id = $1 AND user_id = $2",
    [id, userId]
  );
  return rowCount > 0;
}

module.exports = { listTodos, createTodo, updateTodo, deleteTodo };
