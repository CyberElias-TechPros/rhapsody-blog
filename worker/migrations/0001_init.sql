-- 0001_init.sql — Meaning blog schema (Cloudflare D1 / SQLite)
-- Timestamps are stored as ISO-8601 UTC strings truncated to seconds
-- (YYYY-MM-DDTHH:MM:SSZ) so that lexicographic ordering equals temporal ordering.
-- All application writes use the shared `nowIso()` helper to stay consistent.

-- ---------------------------------------------------------------------------
-- Users
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
  id            TEXT PRIMARY KEY,
  name          TEXT NOT NULL CHECK (length(name) BETWEEN 2 AND 80),
  email         TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role          TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'editor', 'admin')),
  is_active     INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  -- Bumped to invalidate every issued JWT for this user (logout-all / deactivation).
  token_version INTEGER NOT NULL DEFAULT 0,
  last_login_at TEXT,
  created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  updated_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_users_role ON users (role);

-- ---------------------------------------------------------------------------
-- Channels (Telegram sources)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS channels (
  id              TEXT PRIMARY KEY,
  slug            TEXT NOT NULL UNIQUE,
  name            TEXT NOT NULL,
  username        TEXT NOT NULL UNIQUE,
  description     TEXT NOT NULL DEFAULT '',
  accent          TEXT NOT NULL DEFAULT 'from-primary to-primary-glow',
  is_active       INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  last_synced_at  TEXT,
  last_message_id INTEGER NOT NULL DEFAULT 0,
  post_count      INTEGER NOT NULL DEFAULT 0,
  created_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  updated_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_channels_active ON channels (is_active, name);

-- ---------------------------------------------------------------------------
-- Posts
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS posts (
  id                  TEXT PRIMARY KEY,
  channel_id          TEXT NOT NULL REFERENCES channels (id) ON DELETE CASCADE,
  channel_slug        TEXT NOT NULL,
  channel_name        TEXT NOT NULL,
  telegram_message_id INTEGER NOT NULL,
  telegram_url        TEXT NOT NULL,
  title               TEXT NOT NULL,
  slug                TEXT NOT NULL,
  excerpt             TEXT NOT NULL DEFAULT '',
  content             TEXT NOT NULL,
  -- Original Telegram CDN URL (may expire); kept for attribution/fallback.
  cover_url           TEXT NOT NULL DEFAULT '',
  -- R2 object key when the cover has been mirrored to R2.
  cover_key           TEXT NOT NULL DEFAULT '',
  tags                TEXT NOT NULL DEFAULT '[]',
  published_at        TEXT NOT NULL,
  reading_minutes     INTEGER NOT NULL DEFAULT 1,
  status              TEXT NOT NULL DEFAULT 'published'
                        CHECK (status IN ('published', 'draft', 'hidden')),
  views               INTEGER NOT NULL DEFAULT 0,
  created_at          TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  updated_at          TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  UNIQUE (channel_slug, slug),
  UNIQUE (channel_slug, telegram_message_id)
);

CREATE INDEX IF NOT EXISTS idx_posts_channel_status_pub ON posts (channel_slug, status, published_at DESC);
CREATE INDEX IF NOT EXISTS idx_posts_status_pub ON posts (status, published_at DESC);
CREATE INDEX IF NOT EXISTS idx_posts_status_views ON posts (status, views DESC);
CREATE INDEX IF NOT EXISTS idx_posts_channel_id ON posts (channel_id);

-- ---------------------------------------------------------------------------
-- Full-text search over posts (FTS5, external-content table kept in sync via triggers)
-- ---------------------------------------------------------------------------
CREATE VIRTUAL TABLE IF NOT EXISTS posts_fts USING fts5(
  title,
  excerpt,
  content,
  tags,
  content = 'posts',
  content_rowid = 'rowid',
  tokenize = 'unicode61 remove_diacritics 2'
);

CREATE TRIGGER IF NOT EXISTS posts_fts_ai AFTER INSERT ON posts BEGIN
  INSERT INTO posts_fts (rowid, title, excerpt, content, tags)
  VALUES (new.rowid, new.title, new.excerpt, new.content, new.tags);
END;

CREATE TRIGGER IF NOT EXISTS posts_fts_ad AFTER DELETE ON posts BEGIN
  INSERT INTO posts_fts (posts_fts, rowid, title, excerpt, content, tags)
  VALUES ('delete', old.rowid, old.title, old.excerpt, old.content, old.tags);
END;

CREATE TRIGGER IF NOT EXISTS posts_fts_au
AFTER UPDATE OF title, excerpt, content, tags ON posts BEGIN
  INSERT INTO posts_fts (posts_fts, rowid, title, excerpt, content, tags)
  VALUES ('delete', old.rowid, old.title, old.excerpt, old.content, old.tags);
  INSERT INTO posts_fts (rowid, title, excerpt, content, tags)
  VALUES (new.rowid, new.title, new.excerpt, new.content, new.tags);
END;

-- ---------------------------------------------------------------------------
-- Subscribers (email digest list — delivery is provider-pluggable)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS subscribers (
  email           TEXT PRIMARY KEY,
  channels        TEXT NOT NULL DEFAULT '[]',
  source          TEXT NOT NULL DEFAULT 'site',
  unsubscribed_at TEXT,
  created_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  updated_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

-- ---------------------------------------------------------------------------
-- Bookmarks & channel follows (registered readers)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS bookmarks (
  user_id    TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  post_id    TEXT NOT NULL REFERENCES posts (id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  PRIMARY KEY (user_id, post_id)
);

CREATE INDEX IF NOT EXISTS idx_bookmarks_user ON bookmarks (user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS channel_follows (
  user_id    TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  channel_id TEXT NOT NULL REFERENCES channels (id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  PRIMARY KEY (user_id, channel_id)
);

-- ---------------------------------------------------------------------------
-- Audit log for sensitive/administrative actions
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS audit_logs (
  id          TEXT PRIMARY KEY,
  actor_id    TEXT,
  actor_email TEXT,
  action      TEXT NOT NULL,
  resource    TEXT NOT NULL,
  resource_id TEXT,
  meta        TEXT NOT NULL DEFAULT '{}',
  ip          TEXT,
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_actor ON audit_logs (actor_id, created_at DESC);

-- ---------------------------------------------------------------------------
-- Seed channels (idempotent — mirrors the former Express bootstrap seed)
-- ---------------------------------------------------------------------------
INSERT OR IGNORE INTO channels (id, slug, name, username, description, accent) VALUES
  ('ch_rhapsody_of_realities', 'rhapsody-of-realities', 'Rhapsody of Realities', 'rhapsody_of_realities',
   'Daily devotionals from the world''s #1 daily devotional — giving your life a meaning.', 'from-primary to-primary-glow'),
  ('ch_pastor_chris_teachings', 'pastor-chris-teachings', 'Pastor Chris Teachings', 'PastorChrisOyakhilomeMessageText',
   'Inspired teachings and messages from Pastor Chris Oyakhilome.', 'from-amber-600 to-orange-500'),
  ('ch_pastor_chris_books', 'pastor-chris-books', 'Pastor Chris Books', 'pastorchrisbooks',
   'Excerpts and full chapters from Pastor Chris'' transformative books.', 'from-rose-600 to-amber-500'),
  ('ch_rhapsody_library', 'rhapsody-library', 'Rhapsody of Realities Library', 'rhapsodylibrary',
   'A growing library of resources, testimonies and editions.', 'from-emerald-600 to-amber-500'),
  ('ch_classic_gospel_music', 'classic-gospel-music', 'Classic Gospel Music', 'classicgospelmusic',
   'Timeless gospel music to lift your spirit every day.', 'from-indigo-600 to-primary-glow');
