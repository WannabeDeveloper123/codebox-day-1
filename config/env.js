// Load variables from a local .env file, if one exists
try {
  process.loadEnvFile();
} catch (err) {
  if (err.code !== "ENOENT") throw err;
}

function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing ${name}. Copy .env.example to .env and set ${name}.`);
  }
  return value;
}

module.exports = { requireEnv };
