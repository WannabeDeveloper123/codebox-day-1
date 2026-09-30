const express = require("express");
const { requireAuth } = require("../middleware/auth");
const todoService = require("../services/todoService");
const { parseId, isNonEmptyString } = require("./helpers");

const router = express.Router();

// Every todo route needs a logged-in user
router.use(requireAuth);

function userId(req) {
  return Number(req.user.sub);
}

router.get("/", async (req, res) => {
  res.json(await todoService.listTodos(userId(req)));
});

router.post("/", async (req, res) => {
  const title = req.body?.title;

  if (!isNonEmptyString(title, 200)) {
    return res.status(400).json({ error: "Title is required (max 200 characters)" });
  }

  const todo = await todoService.createTodo(userId(req), title.trim());
  res.status(201).json(todo);
});

router.put("/:id", async (req, res) => {
  const id = parseId(req.params.id);
  if (!id) return res.status(404).json({ error: "Todo not found" });

  const { title, completed } = req.body ?? {};
  if (title === undefined && completed === undefined) {
    return res.status(400).json({ error: "Nothing to update" });
  }
  if (title !== undefined && !isNonEmptyString(title, 200)) {
    return res.status(400).json({ error: "Title must be 1-200 characters" });
  }
  if (completed !== undefined && typeof completed !== "boolean") {
    return res.status(400).json({ error: "Completed must be true or false" });
  }

  const todo = await todoService.updateTodo(userId(req), id, {
    title: title?.trim(),
    completed,
  });
  if (!todo) return res.status(404).json({ error: "Todo not found" });

  res.json(todo);
});

router.delete("/:id", async (req, res) => {
  const id = parseId(req.params.id);
  const deleted = id && (await todoService.deleteTodo(userId(req), id));

  if (!deleted) return res.status(404).json({ error: "Todo not found" });

  res.status(204).end();
});

module.exports = router;
