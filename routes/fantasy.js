const express = require("express");
const { requireAuth } = require("../middleware/auth");
const fantasyService = require("../services/fantasyService");
const { isNonEmptyString, isPlayerId } = require("./helpers");

const router = express.Router();

// Public leaderboard: ?week=3, or no week for the whole season
router.get("/leaderboard", async (req, res) => {
  const { week } = req.query;
  if (week !== undefined && !/^([1-9]|1\d|2[0-2])$/.test(week)) {
    return res.status(400).json({ error: "Week must be a number from 1 to 22" });
  }
  res.json(await fantasyService.getLeaderboard(week === undefined ? null : Number(week)));
});

// Everything below is about the logged-in user's own team
router.use("/team", requireAuth);

function userId(req) {
  return Number(req.user.sub);
}

function readTeamName(req, res) {
  const name = req.body?.name;
  if (!isNonEmptyString(name, 40)) {
    res.status(400).json({ error: "Team name is required (max 40 characters)" });
    return null;
  }
  return name.trim();
}

function readPlayerId(value, res) {
  if (!isPlayerId(value)) {
    res.status(400).json({ error: "A valid playerId is required" });
    return null;
  }
  return value;
}

router.get("/team", async (req, res) => {
  const team = await fantasyService.getTeam(userId(req));
  if (!team) return res.status(404).json({ error: "You don't have a team yet" });
  res.json(team);
});

router.post("/team", async (req, res) => {
  const name = readTeamName(req, res);
  if (!name) return;
  res.status(201).json(await fantasyService.createTeam(userId(req), name));
});

router.put("/team", async (req, res) => {
  const name = readTeamName(req, res);
  if (!name) return;
  res.json(await fantasyService.renameTeam(userId(req), name));
});

router.delete("/team", async (req, res) => {
  await fantasyService.deleteTeam(userId(req));
  res.status(204).end();
});

router.post("/team/players", async (req, res) => {
  const playerId = readPlayerId(req.body?.playerId, res);
  if (!playerId) return;
  res.status(201).json(await fantasyService.addPlayer(userId(req), playerId));
});

// Swap: PUT /team/players/<leaving id> with { "playerId": "<joining id>" }
router.put("/team/players/:playerId", async (req, res) => {
  if (!isPlayerId(req.params.playerId)) {
    return res.status(404).json({ error: "That player isn't on your team" });
  }
  const joiningId = readPlayerId(req.body?.playerId, res);
  if (!joiningId) return;
  res.json(await fantasyService.swapPlayer(userId(req), req.params.playerId, joiningId));
});

router.delete("/team/players/:playerId", async (req, res) => {
  if (!isPlayerId(req.params.playerId)) {
    return res.status(404).json({ error: "That player isn't on your team" });
  }
  res.json(await fantasyService.dropPlayer(userId(req), req.params.playerId));
});

module.exports = router;
