-- ---------------------------------------------------------------------------
-- 0002: daily digest bookkeeping.
--
-- The digest cron is at-least-once: Cloudflare can fire it twice, and a retry
-- after a partial failure must not email everybody a second time. One row per
-- run date is the claim — whoever inserts it first owns the day.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS digest_runs (
  -- The site's own date (from /api/today), not the UTC date the cron fired on.
  run_date    TEXT PRIMARY KEY,
  sent        INTEGER NOT NULL DEFAULT 0,
  failed      INTEGER NOT NULL DEFAULT 0,
  -- Why nothing went out: 'no-content' | 'no-subscribers' | 'unconfigured'.
  skipped     TEXT,
  started_at  TEXT NOT NULL,
  finished_at TEXT
);
