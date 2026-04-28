# Meaning — Server (Node + Express + MongoDB)

Backend that turns Telegram channel posts into blog articles.

## Stack
- **Node.js + Express** — REST API
- **MongoDB + Mongoose** — data layer
- **JWT auth** — `user`, `editor`, `admin` roles
- **node-cron** — scheduled Telegram sync
- **cheerio + axios** — scrape Telegram public preview pages (`t.me/s/<username>`)
- **zod** — input validation
- **helmet, cors, rate-limit** — security

## Quick start

```bash
cd server
cp .env.example .env       # edit MONGO_URI, JWT_SECRET, ADMIN_PASSWORD
npm install
npm run dev                # http://localhost:4000
```

A default admin is auto-created on first boot using `ADMIN_EMAIL` / `ADMIN_PASSWORD`.

Run a one-off sync without the scheduler:
```bash
npm run sync
```

## Project structure
```
server/
├── src/
│   ├── config/         # env + DB connection
│   ├── middleware/     # auth, validate, error
│   ├── models/         # User, Channel, Post, Subscriber
│   ├── routes/         # auth, channels, posts, admin, subscribers
│   ├── services/       # telegramSync, seed
│   ├── scripts/        # syncOnce
│   ├── app.js          # express factory
│   └── server.js       # boot + cron
├── .env.example
└── package.json
```

## Roles & permissions

| Role     | Read posts | Bookmark | Sync channels | Edit/delete posts | Manage users |
|----------|:----------:|:--------:|:-------------:|:-----------------:|:------------:|
| guest    |     ✓      |          |               |                   |              |
| user     |     ✓      |    ✓     |               |                   |              |
| editor   |     ✓      |    ✓     |       ✓       |         ✓         |              |
| admin    |     ✓      |    ✓     |       ✓       |         ✓         |      ✓       |

## API surface

```
GET    /api/health
POST   /api/auth/register        { name, email, password }
POST   /api/auth/login           { email, password }
GET    /api/auth/me              (Bearer)

GET    /api/channels
GET    /api/channels/:slug

GET    /api/posts?channel=&q=&tag=&page=&limit=
GET    /api/posts/:channelSlug/:slug

POST   /api/subscribers          { email, channels?: string[] }

# Admin / Editor (Bearer)
GET    /api/admin/stats
POST   /api/admin/sync
POST   /api/admin/sync/:slug
PATCH  /api/admin/posts/:id      { status?, title?, excerpt?, tags? }
DELETE /api/admin/posts/:id
```

Standard error envelope:
```json
{ "error": { "code": "VALIDATION", "message": "Validation failed", "details": { ... } } }
```

## Channels (seeded)

| Slug                       | Telegram                                         |
|----------------------------|--------------------------------------------------|
| rhapsody-of-realities      | @rhapsody_of_realities                           |
| pastor-chris-teachings     | @PastorChrisOyakhilomeMessageText                |
| pastor-chris-books         | @pastorchrisbooks                                |
| rhapsody-library           | @rhapsodylibrary                                 |
| classic-gospel-music       | @classicgospelmusic                              |

## Sync strategy

`services/telegramSync.js` fetches `https://t.me/s/<username>` (public preview),
parses messages with cheerio, derives a title from the first line, slugifies it,
and upserts a `Post` document. The unique index `(channelSlug, telegramMessageId)`
makes the sync idempotent. `Channel.lastMessageId` tracks the high-water mark to
skip already-imported messages.

For richer ingestion (media, comments, full history) swap this layer with the
official **Telegram Bot API** (`getUpdates` / channel admin) or **MTProto**
(`gramjs`/`telethon`). The rest of the API stays the same.

## Connecting the React frontend

In the React app create `src/lib/api.ts`:
```ts
const API = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';
export const api = {
  posts: (params: Record<string, string> = {}) =>
    fetch(`${API}/posts?${new URLSearchParams(params)}`).then(r => r.json()),
  post: (channel: string, slug: string) =>
    fetch(`${API}/posts/${channel}/${slug}`).then(r => r.json()),
  channels: () => fetch(`${API}/channels`).then(r => r.json()),
};
```
Then replace the `MOCK_POSTS` imports with `useQuery` calls against `api.posts(...)`.

## Architecture (high-level)

```
┌─────────────┐  HTTPS   ┌──────────────────┐   cron 15m   ┌──────────────┐
│  React SPA  │ ───────▶ │  Express API     │ ───────────▶ │  Telegram    │
│  (Vite)     │ ◀─────── │  + Mongoose      │ ◀─ scrape ── │  t.me/s/...  │
└─────────────┘  JSON    └─────────┬────────┘              └──────────────┘
                                   │
                                   ▼
                            ┌──────────────┐
                            │   MongoDB    │
                            └──────────────┘
```

## User roles, flows & PRD/FRD highlights

**Personas**
- **Guest reader** — discovers content via SEO; can read & search.
- **Registered user** — bookmarks posts, follows channels, subscribes by email.
- **Editor** — triggers syncs, hides/edits posts (moderation).
- **Admin** — everything + manages users.
- **System (cron worker)** — periodic sync; idempotent; failure-tolerant.

**Core flows**
1. `Cron → fetchChannelMessages → upsert Post → update Channel.lastMessageId`
2. `Guest → GET /posts → list → GET /posts/:c/:s → view (+1 view)`
3. `User → POST /auth/register → JWT → bookmark → GET /me`
4. `Editor → POST /admin/sync/:slug → result summary → PATCH posts`
5. `Visitor → POST /subscribers → email captured for digest`

**Robustness**
- Idempotent upserts (compound unique indexes; duplicate-key swallowed).
- Per-channel high-water mark prevents reprocessing.
- Network/HTML failures isolated per channel; one failure doesn't break others.
- Rate-limited public + auth endpoints.
- Strict zod validation, helmet, CORS allow-list, bcrypt(12), JWT expiry.
- Soft moderation via `Post.status` (`published | draft | hidden`).

**Gaps vs. industry-standard (next iteration)**
- Email digest delivery (Resend/SES) — model is in place (`Subscriber`).
- Image/media mirroring to S3/Cloudinary (currently links to Telegram CDN).
- Full-text search → swap Mongo `$text` for Meilisearch/Typesense at scale.
- Comments & reactions, social-login, 2FA, GDPR export/delete endpoints.
- SSR/edge for SEO — port frontend to Next.js when needed.
- Observability: pino + OpenTelemetry + Sentry.
- Tests: vitest + supertest for routes; mocked cheerio fixtures for sync.

## License
MIT — for personal/ministry use. Telegram content remains the property of its
respective channel owners; this app only mirrors and attributes.
