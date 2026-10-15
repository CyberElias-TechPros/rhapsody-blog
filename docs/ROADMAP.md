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

### 7. The site was named for nothing anyone searches, and readers had no tools of their own

**The gap.** The site was called "Devotional" — a word nobody types — while every search for the
content says "Rhapsody of Realities" and a date. Article titles led with neither. The share image
on every page still said "Meaning. Telegram channels, reborn as a blog", the favicon was a
scaffolding tool's logo, there was no privacy policy (AdSense requires one), no contact page, and
nothing the reader did — beyond bookmarking — was remembered.

**Built.**

| Piece | Where |
| --- | --- |
| Renamed to **Rhapsody of Realities** (short name "Rhapsody"), with an "independent reader site" disclaimer in the footer, About, FAQ and terms | `lib/site.ts`, `components/layout/Footer.tsx` |
| Search copy in one place: titles that lead with series + date ("Rhapsody of Realities 15 October 2026: …", "… TeeVo …"), descriptions, keywords, `pageMetadata()` that never drops the share image | `lib/seo.ts` |
| Structured data: `WebSite` + publication, `Article` with dated headline, `BreadcrumbList`, `CollectionPage`/`ItemList`, `FAQPage` | `lib/seo.ts`, every page |
| Landing pages for what people search: `/teevo`, `/early-readers`, `/calendar`, `/bible` + 47 book pages, `/faq` | `app/(public)/…`, `components/hubs/AudienceHub.tsx` |
| Per-devotional share cards (853, prerendered) and a new site card; Fraunces/Inter WOFF bundled for the renderer | `app/og/devotionals/[slug]/route.tsx`, `app/og.png/route.tsx`, `lib/og/card.tsx`, `assets/fonts/` |
| Favicon, PNG app icons, maskable icon and Apple touch icon generated from the book mark | `scripts/generate-icons.mjs` (`npm run icons`) |
| Privacy policy (incl. the AdSense cookie disclosures and opt-outs), terms, contact (mailto or prefilled GitHub issue) | `app/(public)/privacy`, `terms`, `contact` |
| Reader data, all local: history + resume point, streaks, notes, Bible-plan ticks, reading settings, recent searches, export/import/delete | `lib/reader-data.ts`, `lib/local-store.ts`, `/me` |
| Reading tools: progress bar, "continue where you left off", Aa settings (size, typeface incl. Atkinson Hyperlegible, spacing, width), sepia theme, focus mode, print stylesheet, mark as read | `components/reader/*`, `app/globals.css` |
| Sharing: WhatsApp/Telegram/Facebook/X/email/SMS, copy the whole day WhatsApp-formatted, verse images drawn on canvas | `components/reader/ShareMenu.tsx`, `lib/share-text.ts`, `lib/verse-image.ts` |
| Scripture references link to BibleGateway in the reader's translation | `lib/bible.ts`, `components/reader/ScriptureText.tsx` |
| Daily reminder as a calendar event (`.ics` / Google Calendar) | `lib/reminders.ts`, `components/reader/ReminderDialog.tsx` |
| Edition preference (Adults / TeeVo / Early Readers) remembered in a cookie, so the server renders the right one | `lib/audience-pref.ts`, home, `/today`, `/random` |
| Offline: service worker (network-first pages, cached assets), `/offline` with the saved list, "Save for offline" per edition, install prompt | `public/sw.js`, `components/pwa/*` |
| Keyboard shortcuts (`?`), back-to-top, offline banner, breadcrumbs, "Surprise me" (`/random`), jump to a date (`/go/yyyy-mm-dd`) | `components/common/*`, `app/random`, `app/go/[date]` |
| User stories, flows and business rules, mapped to code and tests | `docs/USER-FLOWS.md` |

### 8. Smaller things that were wrong

- **Production published `http://localhost:3000` as its own address.** With `NEXT_PUBLIC_SITE_URL`
  unset on Vercel, robots.txt, every sitemap entry, the feed's links, every canonical and
  `og:image` tag and the domain printed on the share cards all named localhost — invisible to a
  reader, fatal to indexing and to link previews. An unset value now falls back to Vercel's
  `VERCEL_PROJECT_PRODUCTION_URL` (the project's production domain); `next.config.ts` resolves it
  once and inlines it for every bundle, and the build log warns if neither is available.
  (`lib/site-url.ts`, `tests/site-url.test.ts`)
- **The share image, the favicon and the unsubscribe page carried other names.** `public/og.jpg`
  read "Meaning. Telegram channels, reborn as a blog" on every shared link; `favicon.ico` was a
  scaffolding tool's logo; the Worker's unsubscribe page said "the Meaning digest". All replaced,
  and `tests/brand.test.ts` keeps them from returning.
- **The RSS feed published the whole month on the day it was deployed** — it was built from every
  extracted day, including ones that had not arrived. It now carries released days only and is
  regenerated hourly. (`app/feed.xml/route.ts`, `tests/feed-route.test.ts`)
- **The navigation overflowed between 768 and 1024 px** (six links, a wordmark and two buttons in
  768 px). Links now appear from 1024 px, with a "More" menu; smaller screens use the sheet.
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
| `NEXT_PUBLIC_SITE_URL` | On Vercel, every absolute URL uses the project's production domain (`VERCEL_PROJECT_PRODUCTION_URL`, its shortest custom domain); anywhere else, `http://localhost:3000` | Canonical URLs, share cards, the sitemap and the feed use exactly this origin |
| `NEXT_PUBLIC_CONTACT_EMAIL` | `/contact` opens a prefilled issue on the public GitHub repository | `/contact` shows the address and the form opens the reader's email app |

---

## What is still owed, in the order it should be done

1. **Set the production values and deploy.** `NEXT_PUBLIC_SITE_URL` (the real domain — canonical
   URLs, the sitemap and every share card's absolute URL depend on it; Vercel builds fall back to
   the project's production domain, but setting it pins the domain if another is ever attached),
   `NEXT_PUBLIC_CONTACT_EMAIL`, the Worker's `SITE_URL` and `ALLOWED_ORIGINS`, and the four email
   variables. Configuration, not code: each unset value degrades to documented behaviour rather
   than a crash.
2. **Tell the search engines.** Verify the domain in Google Search Console and Bing Webmaster
   Tools, submit `/sitemap.xml`, and request indexing for `/`, `/teevo`, `/early-readers`,
   `/editions` and `/faq`. Rankings for "rhapsody of realities today" are decided over weeks, by
   how quickly the new day is indexed each morning — watch the Coverage and Performance reports.
3. **Turn on Google's consent message for EEA/UK visitors** (AdSense → Privacy & messaging). A
   Google-certified CMP is required there for personalised ads; the privacy policy already says so.
4. **Send one digest to one address before the cron does.** `SITE_URL` + `EMAIL_*` set, subscribe a
   test address, trigger the cron (`wrangler cron trigger meaning-api "0 4 * * *"`) and read what
   arrives in a real inbox. (The Worker keeps its deployed name `meaning-api`; renaming a deployed
   Worker creates a second one, so do it only with a planned cut-over.)
5. **Permission from the publisher.** The site republishes full copyrighted text with attribution.
   Written permission from LoveWorld Publishing removes the largest legal and AdSense risk
   ("republished content" is a common rejection reason) — the reader tools added here are the
   "unique value" AdSense reviewers look for, but they do not replace a licence.
6. **Sync for signed-in readers.** Notes, history, streaks and plan ticks are per-device by design.
   Somebody who signs in on two devices expects them to follow: extend the Worker's `bookmarks`
   pattern to a single `reader_data` JSON document per user (last-write-wins per key, merged on
   sign-in). The export/import format in `/me` is already that document.
7. **Push notifications** (optional, on top of calendar reminders): VAPID keys, a
   `push_subscriptions` table and a 05:00 sender in the Worker's existing cron.
8. **Other languages.** The publisher translates into thousands of languages; French
   ("Rhapsodie des Réalités") is the obvious first. It needs the PDFs, an extraction pass per
   language, `/fr/...` routes and `hreflang` alternates.
9. **A resources feed and per-audience feeds** (`/teevo/feed.xml`), so teens and parents can
   subscribe to their edition.
10. **In-book search** — a server-side endpoint over resource bodies rather than a bigger bundle.
11. **One page per chapter for the longest books** (`/resources/[slug]/[part]`).
12. **Analytics that are not ad-tech, and error reporting.** Cloudflare Insights is loaded and
    unread; a weekly look at which editions, hubs and searches are used decides what to build and
    extract next. Client errors are currently only logged to the console.
13. **End-to-end tests in CI.** The component tests run in jsdom; a Playwright job (CI can download
    browsers) should cover install, offline and the share sheet on a real Chromium.

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
  like a gap in a Lighthouse trace and is a constraint. (The share-card renderer needs font binaries
  at build time, so `assets/fonts/` carries four OFL-licensed WOFF files for that alone.)
- **No keyword stuffing, hidden text or doorway pages.** The search terms are in titles, headings,
  descriptions, structured data, link text and pages that answer the query (`/teevo`,
  `/editions/2026-10`, `/faq`, `/bible/romans`). Repeating them in hidden or boilerplate text is a
  spam-policy violation that demotes a site — the opposite of the goal.
- **No hosting of the official PDFs.** The monthly PDFs are the publisher's product (sold in print
  and as e-books). Edition pages answer "… PDF" searches honestly: every day to read here, and a
  link to the official edition.

---

## How to keep this document honest

It is a snapshot of an audit, not a backlog nobody owns. When one of the items above is built,
move it into the built section with the file that carries it — the table format is deliberate,
because "where does this live?" is the question the next maintainer asks first. When a decision is
reversed, move it out of *deliberately not built* and say what changed.
