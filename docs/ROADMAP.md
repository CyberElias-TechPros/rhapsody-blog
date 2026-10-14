# Roadmap — what was missing, what is built, what is left

This is the audit behind the recent work, kept as a document rather than a pull-request
description because the questions it answers outlive the branch: *what does a reader need from a
daily devotional site, and which of those needs was this app not meeting?*

The method was to walk the journeys a real reader takes rather than to inventory features.

1. **Land on the home page** → is it today's article, or the day the build happened?
2. **Read it** → can I follow it on a phone, on 40 MB of data, at 6 a.m.?
3. **Not read it** → can I listen while I drive, cook, walk?
4. **Keep it** → can I come back to it tomorrow, without an account?
5. **Find it** → can I search a phrase I half-remember, a book of the Bible, a date?
6. **Plan it** → what do I read today if I want to go through the Bible in a year?
7. **Share it** → does the link preview properly, and does the feed work?
8. **Grow up with it** → is there anything for my child, and for my teenager?
9. **Go deeper** → the daily article is the entry point; where are the books it quotes?
10. **Be told** → if I miss a day, does anything reach me?

Every one of those now has an answer in the product. What follows is what each answer cost, what
is still owed, and — because a roadmap that only lists work is not a decision log — what was
deliberately *not* built.

---

## What was missing, and what is now built

### 1. "Today" was a build artefact, not a date

**The gap.** The home page showed the article for the day the site was last built. On a static
host that is every day but the first, and the fix is not a rebuild schedule — it is refusing to
bake the date in.

**Built.**

| Piece | Where |
| --- | --- |
| Timezone-correct date arithmetic (`todayIso`, `zonedParts`, `msUntilNextMidnight`, …) | `lib/time.ts` |
| The home page resolves the day per request, in the site's own zone | `app/(public)/page.tsx` (`force-dynamic`) |
| `/today` — a server redirect to today's article, whatever device or shortcut opens it | `app/today/route.ts` |
| `GET /api/today` — the same answer as JSON, for the email digest and any other consumer | `app/api/today/route.ts` |
| A client-side rollover at local midnight, for readers whose zone is not the site's | `components/home/DayRollover.tsx` |
| "Latest" on the home page means the newest *released* day, not the newest file | `lib/content.ts` |

The zone is configurable (`NEXT_PUBLIC_SITE_TIMEZONE`, Lagos by default) and falls back rather
than failing if the value is not a real IANA name.

### 2. There was no way to listen

**The gap.** A daily devotional is read at a fixed point in somebody's morning, and the people who
miss it are often the ones driving, commuting, cooking or caring for someone. Text-only meant they
were simply not served.

**Built.**

| Piece | Where |
| --- | --- |
| A speech script per article: title, opening scripture, one part per paragraph, prayer, further study, both reading plans, outro | `lib/tts.ts` → `devotionalScript` |
| The same for books and programme notes, labelled by chapter — or by part where a scan left no chapters — so a listener can step to "Day 3" | `lib/tts.ts` → `resourceScript` |
| Markdown → prose (links keep their words and lose their URLs, em dashes become pauses, entities become words) | `lib/tts.ts` → `toSpeechText` |
| Chunking under the ~15-second ceiling browsers impose, cutting on sentences, then clauses, never mid-word | `lib/tts.ts` → `chunkSection` |
| A player that survives navigation, remembers position, offers rate and voice, and says where it is | `components/audio/*` |
| `Listen` on the home page, on every article, on every book | `components/audio/ListenButton.tsx` |
| An honest duration: 150 words a minute spoken, 200 on the page — a 4 minute read is a 5 minute listen | `lib/tts.ts`, `lib/resources.ts` |
| A studio-voice upgrade the player switches to by itself when a key exists | `app/api/tts/route.ts`, `lib/tts-providers.ts` |

Audio works with **no keys at all**: the browser's own voices read the article, offline, for free.
`NEXT_PUBLIC_TTS_PROVIDER=openai` (or `elevenlabs`) plus that provider's key upgrades the voice;
see `.env.example`.

### 3. The saved shelf did not exist

**The gap.** The bookmark button saved to `localStorage` — local, instant, no account — and then
there was nowhere to *see* what you had saved unless you signed in, which is the one thing local
saving exists to avoid.

**Built.**

| Piece | Where |
| --- | --- |
| `/library` — the reader's own shelf, `noindex`, no account, works offline | `app/(public)/library/page.tsx` |
| The client shelf: loading, empty, populated, offline, and items that have since been unpublished | `components/library/SavedLibrary.tsx` |
| `GET /api/library?slugs=…` — resolves exactly the slugs a device has into cards | `app/api/library/route.ts` |
| The navbar and footer point at it instead of at the account screen | `components/layout/*` |

The route is a lookup, never a store: it caps the request, de-duplicates, reports slugs that no
longer resolve instead of dropping them silently, and answers in card-sized JSON.

### 4. The reading plans were printed on every article and nowhere else

**The gap.** Every edition closes with a one-year and a two-year Bible reading plan. On the site
they were a footnote under an article — no way to ask "what do I read today?", no way to see the
week, no way to keep going when you miss a day.

**Built.** `/reading-plans` — resolves the day (in the site zone, or from `?date=`), shows both
plans for that day across the editions, offers the week ahead, honours `?audience=`, and is
listenable. A malformed date falls back to today rather than 404-ing, because a reader who typed a
date wrong still wants today's plan.

### 5. Everything that was not a daily devotional was invisible

**The gap.** `pdf/` holds books, fasting programmes, service notes and specials. None of them were
on the site, so the daily article quoted material a reader could never follow up on.

**Built.**

| Piece | Where |
| --- | --- |
| An extractor for documents that are not editions: text layer where there is one, OCR where there is not, with furniture (rights pages, address blocks, contents lists, running heads) dropped by rule rather than by hand | `scripts/extract-resources.mjs` |
| A content layer over `content/resources/*.md` — kinds, groups, stats, search, memoised | `lib/resources.ts` |
| `/resources` grouped by what a thing is (books, studies, sermon notes, programme notes) | `app/(public)/resources/page.tsx` |
| `/resources/[slug]` — a sticky table of contents, Listen, Save, Share, structured data, and an explicit caveat where the words were recognised from a scan, with the confidence printed | `app/(public)/resources/[slug]/page.tsx` |
| Books and resources in site search, matched on title, subject and summary | `lib/search.ts`, `components/search/SearchClient.tsx` |
| Books in the sitemap, and in the reader's shelf | `app/sitemap.ts`, `app/api/library/route.ts` |

Ten documents, roughly 83,000 words, three of them recovered from scans at 82–88 % confidence.
Where a book's text was OCR'd, the page says so — a reader deserves to know that "Cod" for "God"
is the scanner's fault and not the author's.

A scan sets its chapter titles in display type on a page of their own, which OCR reads as fragments
of sentences rather than as headings. Two rules keep that honest: the extractor takes a heading from
a structural label only where the label is followed by a number or a capitalised title, so prose that
begins "part of your armour…" stays prose; and `withReadableParts` in `lib/resources.ts` gives a long,
under-structured document numbered parts at the point of presentation, leaving the markdown on disk
exactly what the PDF said. *The Power of Your Mind* — 23,700 words out of a scan — reads as a
sequence of numbered parts plus its author note, and its table of contents works.

### 6. The daily email was promised and never sent

**The gap.** The home page collected addresses and `/about` described a daily email. The Worker had
a subscriber table, signed one-click unsubscribe tokens and `EMAIL_*` variables declared in its
`Env` type — and nothing that sent anything.

**Built.**

| Piece | Where |
| --- | --- |
| Outbound email through the Resend-shaped HTTP API `EMAIL_API_URL` names, with a concurrency ceiling and no exceptions escaping a failed send | `worker/src/services/email.ts` |
| The digest: asks `GET /api/today?full=1` what today's article is, renders it whole (article, scripture, prayer, further study, both plans, links to the other editions), signs a per-recipient unsubscribe, sends once per day | `worker/src/services/digest.ts` |
| A `0 4 * * *` cron — 05:00 in Lagos, an hour after the site's own midnight | `worker/wrangler.jsonc`, `worker/src/index.ts` |
| A `digest_runs` table so an at-least-once cron cannot email everybody twice | `worker/migrations/0002_digest_runs.sql` |
| `RFC 8058` one-click unsubscribe headers, and a token check that accepts the previous 30-day bucket so a link never dies for a reason the reader cannot act on | `worker/src/services/digest.ts`, `worker/src/routes/subscribers.ts` |

Every reason not to send is a value, not an exception: no provider configured, no usable
`SITE_URL`, `/api/today` unreachable, no article for the day, nobody subscribed. The list keeps
growing in D1 either way, so switching email on later is `wrangler secret put`, not a migration.

### 7. Smaller things that were wrong

- **`public/robots.txt` shadowed `app/robots.ts`** and told every crawler the sitemap was at
  `https://meaning-api.YOUR_SUBDOMAIN.workers.dev/sitemap.xml` — a placeholder from an earlier
  project. The static file is gone; the generated one (which also disallows `/account`, `/admin`,
  `/login`, `/register` and `/api/`) is what crawlers get.
- **The Worker's `ALLOWED_ORIGINS` allowed `localhost:8080`** — the legacy Vite app. Local
  development is `next dev` on :3000, so a browser call from the dev server was CORS-blocked.
  Fixed in `worker/wrangler.jsonc`, and its test now asserts the origin that actually calls it.
- **`SITE_URL` in `wrangler.jsonc` pointed at a site that is not this one.** It is empty until set;
  the digest then skips with a log line rather than reading somebody else's `/api/today`.
- **`isValidDateIso('2026-02-30')` returned true** — V8 rolls an impossible day over into March
  rather than rejecting it, so `/reading-plans?date=2026-02-30` would have shown 2 March. The check
  now parses and reads the parts back. (`lib/time.ts`)
- **Two chapters could produce the same table-of-contents anchor** (`## Introduction` twice), which
  sends the reader to the wrong one. Section ids are now de-duplicated with a suffix.
  (`lib/resources.ts`)
- **No web app manifest**, so "Add to home screen" produced a bookmark with no icon and no name,
  opening whatever page it was added from. `app/manifest.ts` + `public/icon.svg` install it as an
  app whose `start_url` is `/today` — opening the icon opens *today*, not the day you installed it.
- **No `prefers-reduced-motion` handling**, on a site that fades every card in and pulses the hero.
  `app/globals.css` now honours it.
- **No CI.** `.github/workflows/ci.yml` runs typecheck, lint, the full test suite and a production
  build for the site, and typecheck plus the Worker test pool for the API, on every push and PR —
  with the slow corpus↔PDF verification one click away under `workflow_dispatch`.
- **Internal maintenance copy was printed to readers** — extraction commands and pipeline notes on
  the editions and devotional pages. Those pages now describe the edition, not the tooling; the
  tooling is documented here and in the README, where the people who need it will look.

---

## What a key unlocks

Nothing in the product is gated behind a key that a reader needs. These are upgrades, and each one
is documented in `.env.example` (frontend) or `worker/.dev.vars.example` (Worker).

| Key | Without it | With it |
| --- | --- | --- |
| `NEXT_PUBLIC_TTS_PROVIDER` + `OPENAI_API_KEY` or `ELEVENLABS_API_KEY` | The browser's own voices read the article, free and offline | A studio voice; the player switches over by itself and falls back if the API fails |
| `NEXT_PUBLIC_SITE_TIMEZONE` | The day is counted in Lagos | The day is counted wherever the edition is published |
| `NEXT_PUBLIC_ADSENSE_CLIENT` + slot ids | No ads, no empty boxes, no layout shift | Ads in the feed, under the article and at the foot of a page |
| `JWT_SECRET`, `ADMIN_EMAIL`, `ADMIN_PASSWORD` (Worker) | Accounts and the admin screens stay off | Sign-in, bookmarks in the cloud, moderation |
| `SITE_URL`, `EMAIL_API_URL`, `EMAIL_API_KEY`, `EMAIL_FROM` (Worker) | Addresses are collected and stored, nothing is sent | The daily email at 05:00 site time |
| `NEXT_PUBLIC_SITE_URL` | Canonical URLs and the sitemap use the deploy's own origin | Canonical URLs and the sitemap use the real domain |

---

## What is still owed, in the order it should be done

1. **Set the production values and deploy.** `NEXT_PUBLIC_SITE_URL`, the Worker's `SITE_URL` and
   `ALLOWED_ORIGINS` (the production domain), and the four email variables. This is configuration,
   not code — everything reads from the environment already, and each unset value degrades to a
   behaviour that is documented above rather than to a crash.
2. **Send one digest to one address before the cron does.** `SITE_URL` + `EMAIL_*` set, subscribe a
   test address, trigger the cron (`wrangler cron trigger meaning-api "0 4 * * *"`) and read what
   arrives in a real inbox. Gmail, Outlook and Apple Mail each render HTML differently, and the
   only way to find that out is to look.
3. **Per-article Open Graph images.** A shared link currently previews the site card, not the day's
   article. This needs the brand fonts available at build time as binaries (`next/font/google`
   cannot be used — builds here run offline), then an image route or a build step. Worth doing:
   shared devotionals are how this site grows.
4. **A resources feed.** `feed.xml` carries the daily devotionals, which is what a feed reader
   wants from a daily site; books are irregular enough that a second feed
   (`/resources-feed.xml`) is the right shape rather than mixing them in.
5. **Bookmarks in the cloud for signed-in readers.** `/library` is per-device by design, and that
   is right for most readers — but somebody who signs in on two devices expects their shelf to
   follow them. The Worker already has a `bookmarks` table; what is missing is a merge on sign-in
   (local slugs POSTed once, server list adopted thereafter) and a "your shelf is on this device"
   note where it applies.
6. **In-book search.** Books are matched on title, subject and summary because shipping 400 KB of
   prose to a phone so one query can look inside it is the wrong trade on the connection this site
   is built for. The honest next step is a server-side search endpoint over the resource bodies,
   not a bigger client bundle.
7. **A "continue reading" position.** The player remembers where it stopped within a session;
   remembering across days (last article opened, last paragraph listened to) is a small
   `localStorage` addition with a disproportionate effect on a daily habit.
8. **One page per chapter for the longest books.** *The Power of Your Mind* is a whole book on one
   page: 23,700 words, 696 KB of HTML before compression. The parts make it navigable and the player
   steps through them, but a 2G connection wants the chapter it asked for and nothing else. The
   parts are already computed in `lib/resources.ts`, so `/resources/[slug]/[part]` is a route and a
   change of `generateStaticParams`, not a re-extraction.
9. **Analytics that are not ad-tech.** Cloudflare Insights is loaded; nothing reads it. A weekly
   note of which editions, audiences and books are actually read would tell the maintainer what to
   extract next — and the corpus is the product.

---

## Deliberately not built

- **No whole-corpus client bundle for search or the shelf.** 850 articles ship as a compact index
  for search (titles, excerpts, dates, scripture references, opening words — no bodies) and the
  shelf resolves through `GET /api/library`. Both alternatives — shipping everything, or
  duplicating the corpus into page props — were considered and rejected on payload grounds.
- **No account required for anything a reader does daily.** Reading, listening, saving, searching,
  planning and the daily email are all available anonymously. Accounts exist for cloud bookmarks
  and moderation, and the site must keep working when the Worker is down: the content layer reads
  the filesystem, so a Worker outage costs the account screen and nothing else.
- **No second implementation of "today" in the Worker.** The digest asks the frontend's
  `/api/today` rather than deriving the date itself, because two implementations of a timezone
  rule drift — and drift here means emailing yesterday's article every morning.
- **No wildcard CSP entries and no loosened directives.** Every third-party origin in
  `lib/security-headers.ts` is explicit, including the ad-quality endpoints and Cloudflare
  Insights. The ~130 "Tracking Prevention blocked access to storage" lines a browser console shows
  are the browser's own tracking protection and cannot be fixed from the site.
- **No `next/font/google`.** Builds run offline here, so fonts stay a runtime `<link>`. This looks
  like a gap in a Lighthouse trace and is a constraint.

---

## How to keep this document honest

It is a snapshot of an audit, not a backlog nobody owns. When one of the items above is built,
move it into the built section with the file that carries it — the table format is deliberate,
because "where does this live?" is the question the next maintainer asks first. When a decision is
reversed, move it out of *deliberately not built* and say what changed.
