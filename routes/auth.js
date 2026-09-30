const express = require("express");
const authService = require("../services/authService");
const { isNonEmptyString } = require("./helpers");

const router = express.Router();

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function readCredentials(body) {
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body?.password === "string" ? body.password : "";
  return { email, password };
}

router.post("/register", async (req, res) => {
  const { email, password } = readCredentials(req.body);
  const name = req.body?.name;

  if (!isNonEmptyString(name, 50)) {
    return res.status(400).json({ error: "Name is required (max 50 characters)" });
  }
  if (!EMAIL_PATTERN.test(email) || email.length > 254) {
    return res.status(400).json({ error: "A valid email is required" });
  }
  if (password.length < 8 || password.length > 128) {
    return res.status(400).json({ error: "Password must be 8-128 characters" });
  }

  try {
    const result = await authService.register({ name: name.trim(), email, password });
    res.status(201).json(result);
  } catch (err) {
    if (err instanceof authService.EmailTakenError) {
      return res.status(409).json({ error: err.message });
    }
    throw err;
  }
});

router.post("/login", async (req, res) => {
  const { email, password } = readCredentials(req.body);

  if (!email || !password) {
    return res.status(400).json({ error: "Email and password are required" });
  }

  const result = await authService.login({ email, password });
  if (!result) {
    return res.status(401).json({ error: "Invalid email or password" });
  }

  res.json(result);
});

module.exports = router;
