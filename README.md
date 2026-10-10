# Rhapsody Blog — the daily devotional, published as a blog

Every day's article from the **Rhapsody of Realities** monthly editions — the message, the opening
scripture, the closing prayer (or confession), further study and both Bible reading plans — published
as its own permalink, searchable, shareable and readable in a feed app.

> **Attribution.** Articles are taken from the *Rhapsody of Realities* monthly editions by
> **Pastor Chris Oyakhilome**, © **LoveWorld Publishing** (ISSN 1596-6984). This project republishes
> them with attribution on every page, in the RSS feed and in the article's structured data; all rights
> remain with the publisher. Nothing here is an official LoveWorld property.

The corpus currently spans **853 devotionals** — 211,766 words — in three parallel editions of the
same daily reading: **For Adults** (245 days, March–October 2026), **For Teens** (304 days,
January–October) and **For Early Readers** (304 days, January–October). Every one of them is
extracted from the source PDFs: the two published adult months at the repo root, 24 more in
[`pdf/`](pdf). See [Audiences](#audiences) for how the three are kept apart.

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
| `app/` | Next.js App Router: layouts, `sitemap.ts`, `robots.ts`, `feed.xml/route.ts`, and the sign-in/account/admin routes |
| `app/(public)/` | Route group for the reading side of the site (home, library, editions, search, about) — and the only place the AdSense loader is rendered |
| `components/` | UI: `layout/`, `common/`, `ui/` (shadcn-style primitives), `devotional/`, `search/`, `screens/` |
| `lib/` | `content.ts` (Markdown → typed data), `search.ts`, `rss.ts`, `format.ts`, `site.ts`, `api.ts` (Worker client), `types.ts` |
| `auth/` | `AuthProvider` (Worker JWT session) and `RequireRole` (client-side gate) |
| `hooks/` | `useSavedPosts` — localStorage "my library", synced across tabs |
| `lib/ads.ts`, `lib/security-headers.ts` | AdSense config (publisher id, slot ids, gating) and the response headers/CSP |
| `content/devotionals/` | **The published posts.** 853 Markdown files — 28 monthly editions across three audiences |
| `scripts/extract-devotionals.mjs` | PDF → Markdown extractor, with a `--verify` self-check |
| `tests/` | Vitest: extractor units, PDF↔Markdown coverage, content layer, search, format, RSS |
| `worker/` | Cloudflare Worker API (routes, D1 repos, Telegram sync, own test suite) — unchanged |
| `legacy/` | The previous Vite SPA, kept for reference |
| `september-2026-rhapsody.pdf`, `october-2026-rhapsody.pdf` | The two source editions already published as posts |
| `pdf/` | The rest of the source editions: adults March–August, Teens (Teevo) and Early Readers (RORER), plus the Kids issues and non-devotional titles the extractor skips on purpose |

---

## Routes

| Route | Renders |
| --- | --- |
| `/` | Today's devotional as the hero (falls back to the newest day), edition strip, latest grid |
| `/devotionals` | The library: JS-free filtering by audience, edition, tag and text, with sort links and pagination |
| `/devotionals/YYYY-MM-DD-slug` | One article — dated permalink, e.g. `/devotionals/2026-10-10-the-genius-of-christianity` |
| `/editions` | Every monthly edition, grouped by audience, with counts and date ranges |
| `/editions/2026-10`, `/editions/2026-10-teens` | One edition, day 1 first — a readers' edition carries its audience in the slug |
| `/search` | Client-side search over a compact index (no round-trip); `?q=` is the source of truth |
| `/about` | Why the site exists — getting the daily word to everyone — plus attribution and provenance |
| `/feed.xml` | RSS 2.0 carrying each day's **complete** article — the adult edition, which is what the channel is named after |
| `/sitemap.xml`, `/robots.txt`, `/ads.txt` | Generated from the corpus; `ads.txt` authorises Google AdSense |
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
npm run content:extract                     # parse every edition PDF → content/devotionals/*.md
npm run content:verify                      # same parse, assert every invariant, write nothing
npm run content:extract -- --audience teens # one audience only
npm run content:extract -- --pdf pdf/x.pdf --out /tmp/preview   # one file, written elsewhere
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
source PDF and the page numbers it came from, the printed weekday, and the closing label.

### Audiences

Three editions of Rhapsody are parsed into one corpus, and the audience is part of a post's identity.

| Audience | Frontmatter | Edition slug | What the printed page carries |
| --- | --- | --- | --- |
| For Adults | `audience` omitted (the content layer defaults it) | `2026-10` | message · prayer or confession · further study · both reading plans |
| For Teens | `audience: teens` | `2026-10-teens` | message · further study · both plans · **Speak** and **Act** closing blocks |
| For Early Readers | `audience: early-readers` | `2026-10-early-readers` | a short message · a prayer or a confession · further study — no reading plans |

The rules that keep them apart are deliberately boring:

- [`lib/audiences.ts`](lib/audiences.ts) is the app's single source of truth for audience ids, labels
  and the edition suffix. The extractor keeps its own copy of the same table so pdf.js never reaches
  the browser bundle, and the two are checked against each other by `npm test`.
- A readers' post carries its audience *inside* the dated slug — `2026-10-15-teens-my-day-is-blessed`
  — and inside `edition`. So the teens' October and the adults' October are different editions with
  different URLs, and the 61 adult posts published before the readers arrived keep `edition: "2026-09"`
  and their permalinks unchanged.
- A printed section the schema has no field for travels as `extras: [{ label, text }]` and renders after
  the closing card; a printed *Confession* is stored as `prayer` with `prayerLabel: "Confession"`. Both
  survive into the Markdown body and into the RSS item, so nothing printed is lost to a field list.
- Which edition a PDF belongs to is read from its front matter, not its filename: a name that says one
  thing and a cover that says another is reported, and a file that says nothing usable is skipped with a
  reason printed at the end of the run — which is how the Kids (RORK) issues are handled: a comic-and-activity
  magazine whose story pages are pictures, with no article text to recover.
- Audience is a URL parameter everywhere it is offered — `/devotionals?audience=teens`,
  `/search?audience=teens` — so a filtered library is linkable and works without JS. An unrecognised
  value means "all readers", never an error. On an article page, `getDaySiblings` links the same calendar
  day in the other editions under "The same day, for other readers".

The list of editions on `/devotionals` is scoped to the active audience, so a teens listing never offers
a month that edition did not publish.

### Publishing a new month

1. Drop the edition PDF in `pdf/` (the root and `pdf/` are both searched; the readers' editions live
   there). Naming is free-form — `JULY 2026 RORER.pdf` is as findable as `2026-07-rorer.pdf` — because
   the edition's own front matter decides its audience and month.
2. `npm run content:extract` — it writes that month's posts and removes only that month's stale files,
   so re-running is idempotent. (`--verify` writes nothing; a run that both verifies and writes needs
   `--out`.)
3. `npm test` — the freshness gate fails if the committed Markdown and the PDFs disagree.
4. Commit the new `content/devotionals/*.md` files. No code changes are needed: routes, sitemap,
   feed and editions all derive from the directory.

---

## Advertising

Google AdSense is wired in two layers, and both are off in development by default.

1. **Auto ads.** `components/common/AdScript.tsx` renders Google's snippet
   (`adsbygoogle.js?client=ca-pub-9117572925263537`) as a real `<script async>`, so it is present in
   the **served HTML** — that is what AdSense checks when it verifies a domain, and what Auto ads need
   to place units. It is deliberately *not* `next/script`: `afterInteractive` only emits a
   `<link rel="preload">` server-side and injects the tag after hydration, and Next's
   `data-nscript` attribute makes AdSense's loader log `AdSense head tag doesn't support
   data-nscript attribute`. React 19 hoists the plain `async` script into `<head>` and de-duplicates
   it by `src`; `tests/ads.test.tsx` fails if that regresses.

   The loader is rendered from **`app/(public)/layout.tsx`**, not the root layout, so it never loads
   on `/login`, `/register`, `/account` or `/admin` — Auto ads cannot place a unit on a page that
   never receives the script. Those routes sit directly under `app/`, outside the group.
2. **Hand-placed units.** `components/common/AdSlot.tsx` renders the standard `ins.adsbygoogle`
   element and queues one fill per element. Positions are configured in `lib/ads.ts`:

| Position | Where it appears | Slot env var |
| --- | --- | --- |
| `feed` | In the card grids — home ("Latest", mid-grid), `/devotionals` and `/editions/<slug>` every 6 cards, search results below the list | `NEXT_PUBLIC_ADSENSE_SLOT_FEED` |
| `article` | Below the devotional on `/devotionals/<slug>`: after the reading plans and source attribution (before the previous/next day links), and after "More from this edition" | `NEXT_PUBLIC_ADSENSE_SLOT_ARTICLE` |
| `page` | Bottom of `/about`, before the closing call to action | `NEXT_PUBLIC_ADSENSE_SLOT_PAGE` |

**Nothing is placed inside a devotional.** The sequence scripture → message → prayer/confession →
further study → reading plans is never interrupted, and no ad appears on `/login`, `/register`,
`/account`, `/admin` (outside the public group entirely), in the RSS feed, or on a "no results"
screen. `tests/ads.test.tsx` asserts
this against the route sources, so a careless edit fails CI rather than quietly degrading the
reading experience.

Each unit reserves its height, so a filling ad cannot shift the reading plans or the day links
(Core Web Vitals), and it is labelled "Advertisement" to keep it visually separate from editorial
content. Until a slot id exists for a position, that position renders nothing at all — no empty box.

To go live, create three responsive ad units in AdSense and set the `NEXT_PUBLIC_ADSENSE_SLOT_*`
variables (see `.env.example`). `public/ads.txt` already authorises `pub-9117572925263537`; AdSense
flags a domain as "needs attention" without it.

The CSP in `lib/security-headers.ts` allows the AdSense origins in `script-src` and the creative
iframes in `frame-src`. Google adds hosts from time to time — if the console reports a violation
for an ad script, add that origin to `AD_SCRIPT_ORIGINS` rather than loosening the directive.

To preview placements locally:

```bash
NEXT_PUBLIC_ADS_ENABLED=true NEXT_PUBLIC_ADSENSE_SLOT_FEED=1234567890 npm run dev
```

---

## Tests

```bash
npm test          # 116 tests
npm run typecheck
npm run lint
```

| File | What it guarantees |
| --- | --- |
| `tests/extractor.test.ts` | Title casing, slug generation, excerpt cutting, drop-cap spacing rules |
| `tests/content-extraction.test.ts` | **The contract with the PDFs**: every day extracted, dates consecutive, printed weekday matching the calendar, all per-day invariants, *no printed line of any spread dropped*, and the committed Markdown byte-for-byte in sync with what the extractor produces |
| `tests/content.test.ts` | The content layer as the routes see it: ordering across audiences, editions grouped by audience, same-day siblings, adjacency within an edition, hero fallback, filtering, pagination, search index, stats |
| `tests/search.test.ts` | Tokenising and field-weighted ranking |
| `tests/format.test.ts` | Date and count formatting — never an "Invalid Date" in a page |
| `tests/rss.test.ts` | A complete article per item, XML escaping, well-formed feed |
| `tests/ads.test.tsx` | AdSense config and gating, the CSP's ad origins, `ads.txt`, the rendered `ins.adsbygoogle` unit, and the placement policy |

The coverage check is the one that matters: it re-reads the September and October adult PDFs, rebuilding every visual line of
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
| `NEXT_PUBLIC_ADSENSE_CLIENT`, `NEXT_PUBLIC_ADSENSE_SLOT_*`, `NEXT_PUBLIC_ADS_ENABLED` | AdSense publisher id, per-position slot ids, and an on/off override |

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
