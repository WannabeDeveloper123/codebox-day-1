const { test } = require("node:test");
const assert = require("node:assert/strict");
const { normalizeDatabaseUrl, describeTarget } = require("../db/databaseUrl");

const HOST = "aws-0-us-west-1.pooler.supabase.com:6543/postgres";

test("a valid URL is left alone", () => {
  const url = `postgresql://postgres.abc:simple123@${HOST}`;
  assert.equal(normalizeDatabaseUrl(`  ${url}\n`), url);
});

test("passwords with URL-breaking characters are escaped", () => {
  const url = normalizeDatabaseUrl(`postgresql://postgres.abc:p#ss/w@rd?1@${HOST}`);
  const parsed = new URL(url);
  assert.equal(decodeURIComponent(parsed.password), "p#ss/w@rd?1");
  assert.equal(parsed.hostname, "aws-0-us-west-1.pooler.supabase.com");
  assert.equal(describeTarget(url), "postgres.abc@aws-0-us-west-1.pooler.supabase.com:6543/postgres");
});

test("errors explain the problem without revealing the password", () => {
  assert.throws(
    () => normalizeDatabaseUrl(`postgresql://postgres.abc:[secretpw]@${HOST}`),
    (err) => /brackets/.test(err.message) && !err.message.includes("secretpw")
  );
  assert.throws(() => normalizeDatabaseUrl("not a url"), /isn't shaped like/);
});
