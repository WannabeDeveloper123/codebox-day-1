const express = require("express");
const { requireAuth } = require("../middleware/auth");
const userService = require("../services/userService");

const router = express.Router();

// requireAuth runs first; the handler only runs for a valid token
router.get("/", requireAuth, async (req, res) => {
  const user = await userService.getProfile(Number(req.user.sub));

  if (!user) {
    return res.status(404).json({ error: "User not found" });
  }

  res.json(user);
});

module.exports = router;
