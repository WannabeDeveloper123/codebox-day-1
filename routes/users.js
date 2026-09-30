const express = require("express");
const userService = require("../services/userService");
const { parseId } = require("./helpers");

const router = express.Router();

// Mounted at /api/users in app.js, so "/" here is /api/users
router.get("/", async (req, res) => {
  res.json(await userService.getAllUsers());
});

router.get("/:id", async (req, res) => {
  const id = parseId(req.params.id);
  const user = id && (await userService.getUserById(id));

  if (!user) {
    return res.status(404).json({ error: "User not found" });
  }

  res.json(user);
});

module.exports = router;
