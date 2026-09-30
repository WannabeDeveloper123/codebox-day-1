// Route params arrive as strings; anything that isn't a positive integer is treated as not found
function parseId(value) {
  if (!/^[1-9]\d{0,9}$/.test(value)) return null;
  const id = Number(value);
  return id <= 2147483647 ? id : null;
}

function isNonEmptyString(value, maxLength) {
  return typeof value === "string" && value.trim().length > 0 && value.trim().length <= maxLength;
}

// Sleeper player ids are short strings of letters and digits (e.g. "4046")
function isPlayerId(value) {
  return typeof value === "string" && /^[A-Za-z0-9]{1,12}$/.test(value);
}

module.exports = { parseId, isNonEmptyString, isPlayerId };
