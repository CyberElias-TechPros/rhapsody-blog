# Rhapsody Blog — the daily devotional, published as a blog

Every day's article from the **Rhapsody of Realities** monthly editions — the message, the opening
scripture, the closing prayer (or confession), further study and both Bible reading plans — published
as its own permalink, searchable, shareable and readable in a feed app.

> **Attribution.** Articles are taken from the *Rhapsody of Realities* monthly editions by
> **Pastor Chris Oyakhilome**, © **LoveWorld Publishing** (ISSN 1596-6984). This project republishes
> them with attribution on every page, in the RSS feed and in the article's structured data; all rights
> remain with the publisher. Nothing here is an official LoveWorld property.

The corpus currently spans **61 devotionals**: September 2026 (30 days) and October 2026 (31 days),
about 20,500 words, extracted from the two PDF editions committed at the repo root.

---

## What this repository is

Two independent halves that meet in the browser:

```
┌──────────────────────────────┐                    ┌────────────────────────────────┐
│  Next.js 16 (App Router)     │                    │  Cloudflare Worker  /api       │
│  ├ content/devotionals/*.md  │  ← the blog itself │  D1 · KV · R2 · Cron           │
│  │  (static, build-time)     │                    │  accounts · admin · newsletter │
│  └ prerendered to 77 pages   │ ─── Bearer JWT ──▶ │                                │
└──────────────────────────────┘                    └────────────────────────────────┘
        Vercel / any Node host                                Cloudflare
```

- **The blog is static.** Posts are Markdown files read from disk at build time (`lib/content.ts`),
  so every article is prerendered HTML — no database, no API call, no cold start between a reader
  and the day's devotional.
- **The Worker still owns accounts.** Login, registration, the account page, the admin console and
  newsletter subscriptions all talk to the existing Cloudflare Worker API in `/worker`, unchanged.
  Privileged actions are enforced there, never in the client.

### Where the old app went

The previous Vite + React 18 SPA ("Meaning", which mirrored Telegram channels) is preserved intact in
[`legacy/`](legacy/) for reference — every page, component and test. It is excluded from the root
`tsconfig.json` and ESLint config and is not built by any root script. See `legacy/README.md`.

---

## Repository layout

| Path | What it is |
| --- | --- |
| `app/` | Next.js App Router: routes, layouts, `sitemap.ts`, `robots.ts`, `feed.xml/route.ts` |
| `components/` | UI: `layout/`, `common/`, `ui/` (shadcn-style primitives), `devotional/`, `search/`, `screens/` |
| `lib/` | `content.ts` (Markdown → typed data), `search.ts`, `rss.ts`, `format.ts`, `site.ts`, `api.ts` (Worker client), `types.ts` |
| `auth/` | `AuthProvider` (Worker JWT session) and `RequireRole` (client-side gate) |
| `hooks/` | `useSavedPosts` — localStorage "my library", synced across tabs |
| `content/devotionals/` | **The published posts.** 61 Markdown files, generated from the PDFs |
| `scripts/extract-devotionals.mjs` | PDF → Markdown extractor, with a `--verify` self-check |
| `tests/` | Vitest: extractor units, PDF↔Markdown coverage, content layer, search, format, RSS |
| `worker/` | Cloudflare Worker API (routes, D1 repos, Telegram sync, own test suite) — unchanged |
| `legacy/` | The previous Vite SPA, kept for reference |
| `september-2026-rhapsody.pdf`, `october-2026-rhapsody.pdf` | The source editions |

---

## Routes

| Route | Renders |
| --- | --- |
| `/` | Today's devotional as the hero (falls back to the newest day), edition strip, latest grid |
| `/devotionals` | The library: JS-free filtering by edition, tag and text, with sort links and pagination |
| `/devotionals/YYYY-MM-DD-slug` | One article — dated permalink, e.g. `/devotionals/2026-10-10-the-genius-of-christianity` |
| `/editions` | Both monthly editions with counts and date ranges |
| `/editions/2026-10` | One edition, day 1 first |
| `/search` | Client-side search over a compact index (no round-trip); `?q=` is the source of truth |
| `/about` | What this is, how the corpus is built, the attribution |
| `/feed.xml` | RSS 2.0 carrying each day's **complete** article |
| `/sitemap.xml`, `/robots.txt` | Generated from the corpus |
| `/login`, `/register` | Worker-backed auth screens |
| `/account` | Saved devotionals (local, no account needed) + Worker profile, password and sessions |
| `/admin` | Worker console: channel sync, post moderation, subscribers, users, audit log |

An article page contains, in order: the headline and day, the opening scripture, the message with a
drop cap, the closing prayer or confession, further study, the 1-Year and 2-Year Bible reading plans,
tags, share/save actions, the source attribution (edition, PDF and page numbers), previous/next day
navigation, and more from the same edition.

---

## The content pipeline

The PDFs are the source of truth. Each day occupies a two-page spread whose layout is regular enough
to parse precisely — but only by geometry, not by keywords.

```bash
npm run content:extract    # parse every PDF at the repo root → content/devotionals/*.md
npm run content:verify     # same parse, assert every invariant, write nothing
```

The extractor (`scripts/extract-devotionals.mjs`) works from font size and position, because the
printed text alone is ambiguous:

- the date rule (`tuesday 1`), the all-caps headline, the opening scripture and the body are told
  apart by type size (14pt / 16pt / 12pt / 12pt) and by left margin (55pt vs 41pt per page);
- the **drop cap** is detected as an oversized single glyph whose baseline sits on the *second*
  visual line — it belongs to the line above, and the line it rests on merely wraps around it, so its
  extra indent must never be read as a new paragraph;
- paragraph breaks come from the indent (margin + 22pt), not from vertical gaps, because leading is
  identical inside and between paragraphs;
- the right-hand page is split into message / prayer / further study / reading plans by the position
  of the section labels, and the closing label is `PRAYER` on most days but `CONFESSION` on some;
- running feet (folio, "order on rhapsodyofrealities.org", app adverts) are dropped by *shape* —
  10pt-or-smaller type in the bottom band — because their wording changes between editions.

Each post's frontmatter keeps its provenance: the headline exactly as printed (`titleOriginal`), the
source PDF and the two page numbers it came from, the printed weekday, and the closing label.

### Publishing a new month

1. Drop `<month>-<year>-rhapsody.pdf` at the repo root (the extractor discovers every PDF there).
2. `npm run content:extract` — it writes that month's posts and removes only that month's stale files,
   so re-running is idempotent.
3. `npm test` — the freshness gate fails if the committed Markdown and the PDFs disagree.
4. Commit the new `content/devotionals/*.md` files. No code changes are needed: routes, sitemap,
   feed and editions all derive from the directory.

---

## Tests

```bash
npm test          # 91 tests
npm run typecheck
npm run lint
```

| File | What it guarantees |
| --- | --- |
| `tests/extractor.test.ts` | Title casing, slug generation, excerpt cutting, drop-cap spacing rules |
| `tests/content-extraction.test.ts` | **The contract with the PDFs**: every day extracted, dates consecutive, printed weekday matching the calendar, all per-day invariants, *no printed line of any spread dropped*, and the committed Markdown byte-for-byte in sync with what the extractor produces |
| `tests/content.test.ts` | The content layer as the routes see it: ordering, editions, adjacency, hero fallback, filtering, pagination, search index, stats |
| `tests/search.test.ts` | Tokenising and field-weighted ranking |
| `tests/format.test.ts` | Date and count formatting — never an "Invalid Date" in a page |
| `tests/rss.test.ts` | A complete article per item, XML escaping, well-formed feed |

The coverage check is the one that matters: it re-reads both PDFs, rebuilds every visual line of
every spread, and asserts that each line of real content appears in the extracted fields — allowing
a drop-cap line to match once the cap glyph is split back off. Roughly 3,100 printed lines are
checked; a parsing regression cannot slip through silently.

---

## Local development

Prereqs: **Node 22+** and npm ≥ 10.

```bash
npm install
cp .env.example .env.local
npm run dev            # http://localhost:3000 — the blog works with no Worker running
```

To exercise login, registration, the account page, the admin console or the newsletter form, run the
Worker alongside the frontend:

```bash
npm --prefix worker install
npm --prefix worker run db:migrate:local
npm run worker:dev                                    # wrangler on :8787
WORKER_DEV_URL=http://127.0.0.1:8787 npm run dev      # Next rewrites /api/* and /media/* to it
```

The rewrite exists so the browser keeps talking to a single origin in development; in production set
`NEXT_PUBLIC_API_URL` to the deployed Worker instead.

| Variable | Purpose |
| --- | --- |
| `NEXT_PUBLIC_SITE_URL` | Canonical origin for `og:url`, canonicals, `sitemap.xml` and the feed |
| `NEXT_PUBLIC_API_URL` | Deployed Worker API base, including `/api` |
| `WORKER_DEV_URL` | Dev only — same-origin rewrites to a local `wrangler dev` |

The JWT lives in `localStorage['meaning.auth.token']` (the key is unchanged, so an existing Worker
session keeps working). A `401` dispatches a `meaning:unauthorized` event, which the auth provider
turns into a signed-out state everywhere.

---

## Deployment

**Frontend** — Vercel (or any Node host): `npm run build && npm start`. Set `NEXT_PUBLIC_SITE_URL`
and `NEXT_PUBLIC_API_URL`. The build prerenders the whole corpus; `dynamicParams = false` on the
article and edition routes means an unknown slug is a clean 404 rather than a server render.

**Worker** — `npm run worker:deploy` (wrangler). D1 migrations, KV, R2 and the cron trigger are
configured inside `/worker` exactly as before.

Two things worth knowing:

- **Security headers** are applied in `next.config.ts` (carried over from the old `vercel.json`):
  HSTS, `X-Frame-Options: DENY`, `nosniff`, referrer and permissions policies, plus a CSP. The CSP
  keeps `'unsafe-inline'` for scripts and styles because the App Router emits inline RSC and
  hydration scripts; tightening it to nonces means generating them per request in a `proxy.ts` and
  threading them through the metadata API — deliberate work, not a config flag.
- **Fonts and OG images are runtime/static.** `next/font/google` fetches font files at build time,
  which fails in offline builds, so the root layout links Google Fonts with `preconnect` and the
  Tailwind stacks fall back to Georgia/system-ui. Open Graph uses a static `public/og.jpg` rather
  than `next/og`, which needs font binaries at build time.

---

## Licence and rights

Code in this repository is provided as-is for the purpose of publishing the devotionals with
attribution. **The articles themselves remain the property of LoveWorld Publishing** — see the
attribution note at the top. If you are the publisher and would like any part of this removed or
changed, that request should be honoured immediately.
