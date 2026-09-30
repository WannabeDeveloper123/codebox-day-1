---
name: api-conventions
description: Use when adding, changing or reviewing an Express API endpoint in this project (anything under routes/, services/, middleware/ or db/), including CRUD endpoints, auth-protected routes, and their tests.
---

# API conventions for this project

Follow these rules for every endpoint. If existing code disagrees with a rule, stop and flag it instead of guessing.

## Layers
- `routes/*.js`: HTTP only. Read `req`, validate input, call a service, send the response. No SQL here.
- `services/*.js`: business logic and all SQL. Services never touch `req`/`res`.
- `db/database.js`: the one shared `pg` Pool. Import `query` from it (or `withTransaction` for multi-step writes); never create another Pool.
- External APIs (e.g. Sleeper in `services/sleeperService.js`) are only called by scripts in `scripts/`, never while handling a request. Routes read the copy saved in Postgres.
- Mount each router in `app.js` under `/api/<resource>`.

## Requests and responses
- Success: send the resource itself as JSON (`res.json(todo)`), not a wrapper object.
- Errors: always `{ "error": "<short human message>" }`. Services signal expected failures by throwing `RuleError` (400), `NotFoundError` (404) or `ConflictError` (409) from `services/errors.js`; `app.js` turns them into responses.
- Status codes: 200 read/update, 201 create (return the created resource), 204 delete (no body),
  400 invalid input, 401 missing/invalid token or bad credentials, 404 not found, 409 conflict (e.g. duplicate email).
- Route `:id` params go through `parseId()` from `routes/helpers.js`; a non-numeric id is a 404.
- Validate every body field's type and length before calling a service. Reject unknown shapes with 400.
- JSON keys are camelCase (`createdAt`), even though database columns are snake_case (`created_at`).

## Security
- Parameterized SQL only (`$1`, `$2`) for every value. Never put request data into SQL text; template
  literals may only insert fixed constants from the code itself (like a column list).
- Protected routes use `requireAuth` from `middleware/auth.js`; the user id is `req.user.sub`.
- Every query on user-owned data filters by the owner's id, so one user can never read or change another's rows.
  A row that exists but belongs to someone else is a 404, not a 403.
- Never return `password_hash` or any secret. Select explicit columns; never `SELECT *` into a response.
- Secrets come from `.env` via `requireEnv()`; never hardcode or add a fallback.

## Tests
- Every new endpoint ships with at least one happy-path and one error-path test in `tests/`.
- Tests run with `npm test` against the `codebox_test` database, never the dev database.
