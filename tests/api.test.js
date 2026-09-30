// Always use the test database, never the dev one (set before anything loads .env)
process.env.DATABASE_URL =
  process.env.TEST_DATABASE_URL || "postgresql://localhost:5432/codebox_test";

const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const app = require("../app");
const { connectDB, closeDB, query } = require("../db/database");

let server;
let base;

before(async () => {
  await connectDB();
  await query("TRUNCATE users, todos RESTART IDENTITY CASCADE");
  server = app.listen(0);
  base = `http://localhost:${server.address().port}`;
});

after(async () => {
  server.close();
  await closeDB();
});

async function api(method, path, { body, token } = {}) {
  const headers = {};
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(base + path, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  return { status: res.status, body: text ? JSON.parse(text) : null };
}

async function registerUser(name) {
  const email = `${name.toLowerCase()}@test.dev`;
  const res = await api("POST", "/api/auth/register", {
    body: { name, email, password: "password123" },
  });
  assert.equal(res.status, 201);
  return res.body.token;
}

test("GET / still says hello", async () => {
  const res = await fetch(base + "/");
  assert.equal(res.status, 200);
  assert.equal(await res.text(), "Hello from CodeBox!");
});

test("register returns a token and never the password hash", async () => {
  const res = await api("POST", "/api/auth/register", {
    body: { name: "Alex", email: "Alex@Test.dev", password: "password123" },
  });
  assert.equal(res.status, 201);
  assert.ok(res.body.token);
  assert.deepEqual(res.body.user, { id: 1, name: "Alex", email: "alex@test.dev" });
  assert.ok(!JSON.stringify(res.body).includes("password"));
});

test("register rejects bad input and duplicate emails", async () => {
  const short = await api("POST", "/api/auth/register", {
    body: { name: "Sam", email: "sam@test.dev", password: "short" },
  });
  assert.equal(short.status, 400);

  const badEmail = await api("POST", "/api/auth/register", {
    body: { name: "Sam", email: "not-an-email", password: "password123" },
  });
  assert.equal(badEmail.status, 400);

  const duplicate = await api("POST", "/api/auth/register", {
    body: { name: "Alex 2", email: "alex@test.dev", password: "password123" },
  });
  assert.equal(duplicate.status, 409);
});

test("login works with the right password and fails otherwise", async () => {
  const ok = await api("POST", "/api/auth/login", {
    body: { email: "alex@test.dev", password: "password123" },
  });
  assert.equal(ok.status, 200);
  assert.ok(ok.body.token);

  const wrong = await api("POST", "/api/auth/login", {
    body: { email: "alex@test.dev", password: "wrong-password" },
  });
  assert.equal(wrong.status, 401);

  const unknown = await api("POST", "/api/auth/login", {
    body: { email: "nobody@test.dev", password: "password123" },
  });
  assert.equal(unknown.status, 401);
  assert.deepEqual(unknown.body, wrong.body);
});

test("GET /api/me needs a valid token", async () => {
  assert.equal((await api("GET", "/api/me")).status, 401);
  assert.equal((await api("GET", "/api/me", { token: "not.a.token" })).status, 401);

  const token = await registerUser("Casey");
  const me = await api("GET", "/api/me", { token });
  assert.equal(me.status, 200);
  assert.equal(me.body.email, "casey@test.dev");
});

test("public user routes return names only", async () => {
  const list = await api("GET", "/api/users");
  assert.equal(list.status, 200);
  assert.deepEqual(Object.keys(list.body[0]).sort(), ["id", "name"]);

  assert.equal((await api("GET", "/api/users/1")).status, 200);
  assert.equal((await api("GET", "/api/users/999")).status, 404);
  assert.equal((await api("GET", "/api/users/abc")).status, 404);
});

test("todos: full CRUD for the owner", async () => {
  const token = await registerUser("Dana");

  const created = await api("POST", "/api/todos", { token, body: { title: "  Buy milk  " } });
  assert.equal(created.status, 201);
  assert.equal(created.body.title, "Buy milk");
  assert.equal(created.body.completed, false);
  const id = created.body.id;

  const list = await api("GET", "/api/todos", { token });
  assert.equal(list.status, 200);
  assert.deepEqual(list.body.map((t) => t.id), [id]);

  const updated = await api("PUT", `/api/todos/${id}`, { token, body: { completed: true } });
  assert.equal(updated.status, 200);
  assert.equal(updated.body.completed, true);
  assert.equal(updated.body.title, "Buy milk");

  const renamed = await api("PUT", `/api/todos/${id}`, { token, body: { title: "Buy oat milk" } });
  assert.equal(renamed.body.title, "Buy oat milk");
  assert.equal(renamed.body.completed, true);

  assert.equal((await api("DELETE", `/api/todos/${id}`, { token })).status, 204);
  assert.equal((await api("DELETE", `/api/todos/${id}`, { token })).status, 404);
  assert.deepEqual((await api("GET", "/api/todos", { token })).body, []);
});

test("todos: validation errors", async () => {
  const token = await registerUser("Eli");
  const { body: todo } = await api("POST", "/api/todos", { token, body: { title: "Walk dog" } });

  assert.equal((await api("POST", "/api/todos", { token, body: { title: "   " } })).status, 400);
  assert.equal((await api("POST", "/api/todos", { token, body: {} })).status, 400);
  assert.equal((await api("POST", "/api/todos", { token, body: { title: "x".repeat(201) } })).status, 400);
  assert.equal((await api("PUT", `/api/todos/${todo.id}`, { token, body: {} })).status, 400);
  assert.equal((await api("PUT", `/api/todos/${todo.id}`, { token, body: { completed: "yes" } })).status, 400);
  assert.equal((await api("PUT", "/api/todos/abc", { token, body: { completed: true } })).status, 404);
});

test("todos: users cannot see or change each other's todos", async () => {
  const owner = await registerUser("Frankie");
  const other = await registerUser("Gray");
  const { body: todo } = await api("POST", "/api/todos", { token: owner, body: { title: "Private" } });

  assert.deepEqual((await api("GET", "/api/todos", { token: other })).body, []);
  assert.equal((await api("PUT", `/api/todos/${todo.id}`, { token: other, body: { completed: true } })).status, 404);
  assert.equal((await api("DELETE", `/api/todos/${todo.id}`, { token: other })).status, 404);

  const stillThere = await api("GET", "/api/todos", { token: owner });
  assert.equal(stillThere.body[0].completed, false);
});

test("todos need a token; bad JSON and unknown routes return JSON errors", async () => {
  assert.equal((await api("GET", "/api/todos")).status, 401);
  assert.equal((await api("POST", "/api/todos", { body: { title: "x" } })).status, 401);

  const badJson = await fetch(base + "/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "{not json",
  });
  assert.equal(badJson.status, 400);
  assert.deepEqual(await badJson.json(), { error: "Invalid request body" });

  const missing = await api("GET", "/api/nope");
  assert.equal(missing.status, 404);
  assert.deepEqual(missing.body, { error: "Not found" });
});
