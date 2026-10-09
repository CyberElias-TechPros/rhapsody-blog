# Meaning — Telegram channels, reborn as a blog

**Meaning** mirrors public Telegram channels (Rhapsody of Realities, Pastor Chris, and friends),
turns each message into a clean, searchable blog post, and serves it from a fully static React
frontend. Content never rots: media is re-hosted, posts survive source-side edits, and the whole
pipeline is automatic.

- **Frontend** — Vite + React 18 + TypeScript + Tailwind/shadcn-ui, deployed on **Vercel**.
- **Backend** — a single **Cloudflare Worker** API (`/worker`) on **D1** (SQLite), **KV** (rate limiting),
  **R2** (media mirror) and **Cron triggers** (auto-sync every 15 min). No other cloud provider is used.

```
┌────────────────────┐        HTTPS + Bearer JWT        ┌───────────────────────────────┐
│  Vercel (static)   │ ───────────────────────────────▶ │  Cloudflare Worker  /api      │
│  Vite + React SPA  │ ◀─────────────────────────────── │  D1 ─ KV ─ R2 ─ Cron ─ Cache  │
└────────────────────┘        typed JSON + headers       └──────────────┬────────────────
                                                                        │ HTMLRewriter (cf-cacheTtl)
                                                                        ▼
                                                            https://t.me/s/<channel>
```

## Repository layout

| Path | What it is |
| --- | --- |
| `src/` | React SPA (pages, components, typed API client, auth context, admin UI) |
| `worker/` | Cloudflare Worker API — routes, D1 repos, services, Telegram sync, tests |
| `worker/migrations/` | D1 SQL migrations (additive, reversible-by-design; run via wrangler) |
| `vercel.json` | Vercel SPA rewrite + security headers + immutable asset caching |
| `.github/workflows/ci.yml` | CI: typecheck, lint, unit + integration tests, builds |

## Local development

Prereqs: **Node 22+**, npm ≥ 10, and an internet connection for optional live Telegram sync.

```bash
# 1. install both workspaces
npm install
npm --prefix worker install

# 2. terminal A — Worker API on http://127.0.0.1:8787 (local D1/KV/R2 emulation)
cd worker
cp .dev.vars.example .dev.vars      # then set JWT_SECRET to any random string
npx wrangler d1 executions apply --local --file migrations/0001_init.sql   # or: npx wrangler d1 migrations apply DB --local
npx wrangler dev                    # (npm run dev)

# 3. terminal B — frontend on http://localhost:8080
npm run dev                         # Vite proxies /api, /media and /sitemap.xml to :8787
```

To seed an admin account you can either set `ADMIN_EMAIL`/`ADMIN_PASSWORD` in `worker/.dev.vars`
(bootstrap creates it on first sync/run), or register via the UI and run:

```bash
npx wrangler d1 execute DB --local --command \
  "UPDATE users SET role='admin' WHERE email='you@example.com'"
```

``worker/dev/seed_posts.sql` is a **dev-only** fixture (a few sample posts) — never point it at
production; production content comes from the real Telegram sync.

### Quality gates

```bash
npm run typecheck && npm run lint && npm test && npm run build   # frontend
cd worker && npm run typecheck && npm test                        # worker (74 integration tests, miniflare)
npx wrangler deploy --dry-run                                     # bundle + config validation
```

## Environment variables

### Frontend (Vercel project → Settings → Environment Variables)

| Variable | Example | Notes |
| --- | --- | --- |
| `VITE_API_URL` | `https://meaning-api.<sub>.workers.dev/api` | Leave unset in dev (Vite proxy handles it). |
| `VITE_SITE_URL` | `https://meaning.vercel.app` | Canonical origin used for `rel=canonical` / Open Graph URLs. |

### Worker (`worker/.dev.vars` locally; `wrangler secret put` in production)

| Name | Kind | Notes |
| --- | --- | --- |
| `JWT_SECRET` | secret (string, ≥32 chars) | HS256 signing key for auth tokens **and** newsletter unsubscribe HMAC. Rotating it invalidates all sessions and unsubscribe links. |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD` | secrets (optional) | Bootstrap admin — created once on boot if users table is empty. Remove after first login or keep for local convenience. |
| `MEDIA_PUBLIC_URL` | var (optional) | Custom domain/CDN prefix for R2 media; unset → media streams through `/media/*` on the Worker. |
| `ALLOWED_ORIGINS` | var | Comma-separated CORS allowlist (`*.vercel.app` wildcard supported for previews). |
| `SITE_URL` | var | Used in sitemap.xml URLs. |
| `MAX_UPLOAD_BYTES` | var | Upload guard for media mirroring. |

## Production deployment

### 1. Cloudflare (backend)

```bash
cd worker
npm install

# D1 database
npx wrangler d1 create meaning-db
#   → copy the printed database_id into wrangler.jsonc (d1_databases[0].database_id)
npx wrangler d1 migrations apply DB --remote

# KV namespace for rate limiting
npx wrangler kv namespace create RATE_LIMITS
#   → copy the id into wrangler.jsonc (kv_namespaces[0].id)

# R2 bucket for mirrored media
npx wrangler r2 bucket create meaning-media
#   → bucket_name in wrangler.jsonc is already "meaning-media"

# Secrets
openssl rand -hex 32 | pbcopy          # or any 32+ char random secret
npx wrangler secret put JWT_SECRET     # paste it
npx wrangler secret put ADMIN_EMAIL    # optional bootstrap admin
npx wrangler secret put ADMIN_PASSWORD # optional bootstrap admin

# Deploy (cron trigger `*/15 * * * *` ships from wrangler.jsonc)
npx wrangler deploy
```

Then set `vars.ALLOWED_ORIGINS` to include your Vercel origin (the current value already covers
`meaning.vercel.app` + all `*.vercel.app` previews), and optionally bind a custom domain:
Workers Docs → *Custom domain* → e.g. `api.yourdomain.com`.

**Rate limiting hardening (recommended):** KV fixed-window limiting is the baseline; for volume
protection add a Cloudflare WAF rate-limit rule (free tier) on `/*api/auth*` and `/api/posts*`.
The Worker also degrades **open** if KV errors — availability over strictness — which is exactly
why the edge rule matters.

### 2. Vercel (frontend)

1. Import the GitHub repo (root). Framework preset: **Vite**. Build command `npm run build`,
   output `dist` — both already declared in `vercel.json`.
2. Add env vars `VITE_API_URL` and `VITE_SITE_URL` (Production + Preview).
3. Deploy. Vercel serves the SPA with SPA rewrites + security headers (CSP, HSTS, nosniff,
   frame-ancestors…) from `vercel.json`; hashed `/assets/*` are `immutable`.
4. Update `public/robots.txt`'s `Sitemap:` line to the Worker origin.

### First content

Hit `POST /api/admin/sync` from the admin dashboard (or `npx wrangler cron "*/15 * * * *" --test`
for a remote sync run). The cron trigger keeps it flowing every 15 minutes from then on.

## Architecture & product decisions (the why)

- **One Worker, hand-rolled router, zero framework** — small bundle, fast cold starts, full control
  over headers/CORS/cache; no dependency risk for a content API.
- **D1** (SQLite) as the source of truth — relational fits posts/users/follows; free tier covers
  this scale; migrations are additive (`0001_init.sql` creates everything incl. FTS5 virtual table
  + triggers, seeds the five channels). No destructive migrations exist today; future ones must be
  expand→backfill→contract with a release in between.
- **KV `RATE_LIMITS`** for fixed-window rate limits (login 10/15min per IP+email, register 5/h,
  subscribe 10/h, public reads 300/min for anon, admin syncs 6/10min) — cheap, edge-local,
  degrade-open.
- **R2 `MEDIA`** mirrors Telegram photos on ingest (t.me CDN URLs expire fast) and serves them
  through `/media/*` with immutable caching; uploads are size-guarded (`MAX_UPLOAD_BYTES`) and
  content-typed by sniffing magic bytes, never trusting extensions.
- **Cron `*/15 * * * *`** runs the sync; it uses a high-water-mark (`last_message_id`) so each run
  is O(new messages), plus Cloudflare Cache (`cf-cacheTtl: 60`) when fetching `t.me/s/*`.
- **No Queues / no Durable Objects** — deliberately: sync volume (5 channels, ~dozens of msgs/hour)
  doesn't justify them. The only stateful need (per-isolate bootstrap) is handled with
  `waitUntil`-guarded idempotent upserts. Revisit Queues if per-channel scraping needs fan-out or
  retry backoff at 10+ channels.
- **Auth** — HS256 JWT (`jose`, 7-day expiry) carrying `ver` (per-user token version in D1):
  password change / logout-all / admin deactivation bump `ver` → all older tokens die immediately.
  PBKDF2-SHA256 250k iterations password hashes (constant-time compare; unknown-email dummy-KDF
  keeps timing uniform). Registration = 201, wrong credentials = 401 generic — no enumeration.
- **Token storage: localStorage, not cookies** — frontend (Vercel) and API (Cloudflare) are
  cross-site; third-party cookies are blocked by Safari and shrinking everywhere. Risk = XSS token
  theft → mitigated by CSP `script-src 'self'` (no inline, no eval), React auto-escaping, and a
  safe-by-construction markdown renderer. Refresh-token-over-cookies was considered and rejected as
  unnecessary complexity for a 7-day bearer session in this product.
- **Caching** — public `GET /api/posts*`/`/api/channels*` use `caches.default` (edge, `s-maxage`
  60s/120s, `Vary: Origin` handled separately; cache bypassed when Authorization present).
  Invalidation is TTL-based by design — no purge API needed at this write frequency; every response
  carries `x-cache` + `x-request-id` for debugging.
- **Search** — SQLite FTS5 external-content index with insert/update/delete triggers; query
  builder strips FTS operator syntax and builds `"tok"* AND …` prefixes (≤8 tokens); LIKE fallback
  for zero results.
- **Resilience** — Telegram fetch timeout 15s, one failing channel never aborts a bulk sync
  (per-channel result rows incl. `error`), sync is idempotent (`INSERT OR IGNORE` on
  `(channel_slug, telegram_message_id)`), and admin-hidden posts are **never resurrected** by
  re-sync.

## Security notes

- Server-side enforcement everywhere: JWT + `is_active` + role checks on all admin/`/me` routes;
  the frontend guard is UX only. Validation on every input (zod, unknown fields stripped;
  `tags`/`channels` normalized; emails trimmed+lowercased; ≤2000 char URL limits).
- Errors are structured (`{error:{code,message,details}}` + `x-request-id`), 5xx details never
  leak (generic message in prod, error names only surfaced in wrangler tail logs).
- Security headers on every API response: `nosniff`, `DENY`, CSP (`default-src 'none'` for the
  JSON API), `Referrer-Policy: no-referrer`, restrictive `Permissions-Policy`, `no-store` default
  with explicit allowlisting for cached public GETs.
- Open-redirect guard on `?next=` (same-origin only), `rel="noopener noreferrer nofollow"` on all
  outbound links, nofollow + robots policy keep scraping honest.
- CSV export sets `Content-Disposition: attachment`; unsubscribe links are HMAC-signed
  (`JWT_SECRET`), expire in 30 days, and are idempotent.
- Last-admin guard: an admin cannot demote or deactivate themselves (or the only remaining admin).

## Known limitations (deliberate, documented)

1. **No self-service password reset** — email sending isn't in scope; admins reset via D1 (or users
   register anew). UI says so explicitly.
2. **Telegram-only source** — the scraper depends on `t.me/s/<username>` markup; heavy Telegram
   throttling would delay syncs (the 60s fetch cache + retry-on-next-cron design degrades gracefully).
3. **Drafts are editorial-only** — synced posts arrive published by design (the product mirrors a
   broadcast channel); admins can hide/delete, edit metadata, but not create original posts via API.
4. **Rate limits are Worker-side best-effort**; put the Cloudflare WAF rate rule in front for real
   volumetric protection.
5. **`t.me` previews** may lag up to one cron cycle (15 min) — intentional, to bound scraping.

## Testing

- `worker/test/` — 8 files, **74 tests**: migrations, posts/search/pagination, auth lifecycle
  (register/login/me/logout-all/password-change/session-kill), full role matrix on admin endpoints,
  Telegram sync against captured HTML fixtures (incl. R2 cover mirroring via mocked fetch), CORS /
  headers / sitemap / traversal, bookmarks/follows/subscribers ownership, rate-limit 429s.
- `src/**/*.test.tsx?` — **32 tests**: markdown parser safety (no HTML/JS injection), API client
  error mapping (envelope → typed `ApiError`, 401 → session clear), PostCard link/bookmark semantics,
  Login form flows (success, invalid, network error), date/count formatting.
- CI (`.github/workflows/ci.yml`) runs both suites on every PR/push; `wrangler deploy --dry-run`
  guards the Worker build.

## License

Content belongs to the original channel authors; this project mirrors and attributes. Code MIT.
