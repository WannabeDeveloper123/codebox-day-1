const express = require("express");
const playerService = require("../services/playerService");
const { POSITIONS } = require("../services/fantasyRules");

const router = express.Router();

// Public: anyone can browse players. ?position=RB&search=allen
router.get("/", async (req, res) => {
  const { position, search } = req.query;

  if (position !== undefined && !POSITIONS.includes(position)) {
    return res.status(400).json({ error: `Position must be one of ${POSITIONS.join(", ")}` });
  }
  if (search !== undefined && (typeof search !== "string" || search.length > 40)) {
    return res.status(400).json({ error: "Search must be 40 characters or fewer" });
  }

  res.json(await playerService.listPlayers({ position, search: search?.trim() || undefined }));
});

module.exports = router;
