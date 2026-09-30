const express = require("express");
const authRouter = require("./routes/auth");
const fantasyRouter = require("./routes/fantasy");
const meRouter = require("./routes/me");
const playersRouter = require("./routes/players");
const todosRouter = require("./routes/todos");
const usersRouter = require("./routes/users");
const { AppError } = require("./services/errors");

const app = express();

// Don't advertise the framework in every response header
app.disable("x-powered-by");

app.use(express.json({ limit: "10kb" }));

app.get("/", (req, res) => {
  res.send("Hello from CodeBox!");
});

app.use("/api/auth", authRouter);
app.use("/api/fantasy", fantasyRouter);
app.use("/api/me", meRouter);
app.use("/api/players", playersRouter);
app.use("/api/todos", todosRouter);
app.use("/api/users", usersRouter);

// Unknown routes get JSON too, not Express's default HTML page
app.use((req, res) => {
  res.status(404).json({ error: "Not found" });
});

// Rule and not-found errors from services carry their own status; malformed JSON
// is the client's fault; anything else is ours
app.use((err, req, res, next) => {
  if (err instanceof AppError) {
    return res.status(err.status).json({ error: err.message });
  }
  if (err.type === "entity.parse.failed" || err.type === "entity.too.large") {
    return res.status(400).json({ error: "Invalid request body" });
  }
  console.error(err);
  res.status(500).json({ error: "Something went wrong" });
});

module.exports = app;
