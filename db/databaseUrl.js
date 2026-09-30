// Makes a pasted connection string usable, or explains what's wrong with it
// without ever including the password in the message.

function isValid(url) {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

// Splits postgresql://user:password@host:port/db by hand, taking the LAST "@"
// as the end of the password, since passwords may contain "@" themselves.
function splitUrl(url) {
  const match = url.match(/^(postgres(?:ql)?:\/\/)([^:]*):(.*)@([^@]*)$/s);
  if (!match) return null;
  const [, scheme, user, password, rest] = match;
  return { scheme, user, password, rest };
}

function describeProblem(url) {
  const hints = [];
  if (/\s/.test(url)) hints.push("it contains spaces or line breaks");
  if (/^["']|["']$/.test(url)) hints.push("it is wrapped in quotes");
  if (/^DATABASE_URL=/i.test(url)) hints.push('the value starts with "DATABASE_URL=" (paste only the part after =)');
  if (url.includes("YOUR-PASSWORD")) hints.push("it still contains [YOUR-PASSWORD]");

  const parts = splitUrl(url);
  if (!parts) {
    hints.push("it isn't shaped like postgresql://user:password@host:port/database");
  } else {
    if (/^\[.*\]$/.test(parts.password)) hints.push("the password is still wrapped in [ ] brackets (remove them)");
    hints.push(`user "${parts.user}", host/port/db "${parts.rest}", password ${parts.password.length} characters`);
  }
  return `DATABASE_URL is not a valid connection string: ${hints.join("; ")}`;
}

function normalizeDatabaseUrl(url) {
  const trimmed = url.trim();
  const parts = splitUrl(trimmed);

  // Supabase shows [YOUR-PASSWORD]; keeping the brackets is a common slip
  const bracketed = parts && /^\[.*\]$/.test(parts.password);
  if (!bracketed && isValid(trimmed)) return trimmed;

  // Most often the password has characters like # @ / ? that must be escaped
  if (parts && !bracketed) {
    const escaped = `${parts.scheme}${parts.user}:${encodeURIComponent(parts.password)}@${parts.rest}`;
    if (isValid(escaped)) return escaped;
  }
  throw new Error(describeProblem(trimmed));
}

// Safe to log: shows where we connect, never the password
function describeTarget(url) {
  const parsed = new URL(url);
  return `${parsed.username}@${parsed.hostname}:${parsed.port || 5432}${parsed.pathname}`;
}

module.exports = { normalizeDatabaseUrl, describeTarget };
