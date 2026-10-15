# User stories, flows and business rules

Who uses Rhapsody of Realities, what each of them needs, the flow that serves it, and the code
that implements it. Everything marked **local** runs in the browser with no account and no
server: the data is in `localStorage` (see the store table in `lib/reader-data.ts`).

---

## 1. Personas

| Persona | Typical moment | Needs |
| --- | --- | --- |
| **Daily reader** (adult) | 5–7 am, on a phone, often on mobile data | Today's devotional, fast; listen while getting ready; keep the habit |
| **Teen** | After school, on a phone | TeeVo, in their own language; something to share with friends |
| **Parent of a 6–12-year-old** | Bedtime | Early Readers, large type, read aloud |
| **Group sharer** | Morning, WhatsApp | The whole day as one message for family and church groups; a verse image for status |
| **Bible-plan follower** | Any time | Today's 1-year / 2-year portions, tick them off, see progress |
| **Low-data / offline reader** | Travel, no data | Today's and this month's devotionals without a connection |
| **Searcher** | Arrives from Google | "rhapsody of realities today", a date, a month, "TeeVo", "PDF" — the right page, immediately |
| **Low-vision / older reader** | Any | Bigger text, a legible typeface, spacing, contrast, audio |
| **Site owner** | Weekly | Publish each month, keep ads and email working, answer messages |

---

## 2. Stories and flows

### Daily reader

| Story | Flow | Where |
| --- | --- | --- |
| Open today's devotional in one tap | Home or installed app → `/today` → 307 to today's article (site timezone, Lagos) | `app/today/route.ts`, `lib/time.ts` |
| See the day without hunting | Home hero shows today's devotional for the chosen edition, with Read and Listen | `app/(public)/page.tsx` |
| Listen | Listen → player dock; continues across pages; resume where stopped | `components/audio/*` |
| Pick up where I stopped | Re-open an article → "Continue where you left off?" → scrolls to the saved position (**local**) | `components/reader/ReadingTracker.tsx` |
| Keep a streak | Reaching the end (after a minimum reading time) or "Mark as read" credits today; home and `/me` show the streak (**local**) | `lib/reader-data.ts` (`recordProgress`, `currentStreak`) |
| Write what spoke to me | "My notes" under the article autosaves; all notes listed and searchable on `/me` (**local**) | `components/reader/NotesCard.tsx` |
| Be reminded every day | "Daily reminder" → `.ics` file or Google Calendar link with a daily alert opening `/today` | `components/reader/ReminderDialog.tsx`, `lib/reminders.ts` |
| Read yesterday / tomorrow / any date | Day navigation (← →), "Pick another date" → `/calendar`, `/go/yyyy-mm-dd` | `components/devotional/DayNav.tsx`, `app/(public)/calendar`, `app/go/[date]` |

### Teen and parent

| Story | Flow | Where |
| --- | --- | --- |
| Open TeeVo / Early Readers by default | Choose the edition on the home page → cookie → home, `/today`, `/random` and the installed app open that edition | `components/home/AudiencePicker.tsx`, `lib/audience-pref.ts` |
| Land on my edition from search | `/teevo` and `/early-readers`: today's devotional for that edition, recent days, every month, what the edition is, FAQ | `components/hubs/AudienceHub.tsx` |
| The same day for the rest of the family | "The same day, for other readers" under every article | article page |

### Sharer

| Story | Flow | Where |
| --- | --- | --- |
| Send the whole devotional to a WhatsApp group | Share → "Copy full devotional" → WhatsApp-formatted text with *bold* headings and the link | `lib/share-text.ts`, `components/reader/ShareMenu.tsx` |
| Share a link with a rich preview | Share → WhatsApp / Telegram / Facebook / X / email / SMS; every article has its own 1200×630 card | `app/og/devotionals/[slug]/route.tsx`, `lib/og/card.tsx` |
| Post a verse to my status | Share → "Create a verse image" → status, post or square, three colourways → share sheet or download (drawn on the device) | `lib/verse-image.ts`, `components/reader/VerseImageDialog.tsx` |

### Bible-plan follower

| Story | Flow | Where |
| --- | --- | --- |
| See today's portions | `/reading-plans` (any `?date=`, any edition) and the foot of every article | `app/(public)/reading-plans` |
| Open the passage | Every reference is a link to BibleGateway in my chosen translation | `lib/bible.ts`, `components/reader/ScriptureText.tsx` |
| Track progress | Tick each portion; totals on `/reading-plans` and `/me` (**local**) | `components/reader/PlanCheck.tsx`, `PlanProgress.tsx` |

### Offline reader

| Story | Flow | Where |
| --- | --- | --- |
| Install it like an app | "Install the app" (Chrome/Android prompt) or iPhone instructions; opens on `/today` | `components/pwa/*`, `app/manifest.ts` |
| Read without data | The service worker keeps every page opened; offline, cached pages open and anything else shows `/offline` with the saved list | `public/sw.js`, `app/offline` |
| Take a whole month | Edition page → "Save for offline" → all days cached | `components/pwa/SaveOfflineButton.tsx` |

### Searcher (SEO)

| Query people type | Page that answers it |
| --- | --- |
| rhapsody of realities today / for today | `/` (title: "Rhapsody of Realities Today, 15 October 2026: …"), `/today` |
| rhapsody of realities 15 october 2026 / 15th october 2026 / october 15, 2026 | the article (title leads with series + date; description and keywords carry the other spellings) |
| rhapsody of realities october 2026 (+ pdf / download) | `/editions/2026-10` — every day, plus an honest pointer to the official PDF |
| rhapsody teevo / teevo today / rhapsody for teens | `/teevo`, `/editions/2026-10-teens`, teen articles ("Rhapsody of Realities TeeVo 15 October 2026: …") |
| rhapsody of realities for kids / early readers | `/early-readers`, `/kids` |
| rhapsody of realities bible reading plan | `/reading-plans` |
| devotional on romans / john / psalms | `/bible/romans`, … |
| what is rhapsody of realities / who writes it / languages / pdf | `/faq` (FAQPage structured data), home "What is Rhapsody of Realities?" |

Structured data on every relevant page: `WebSite` (root), `Article` + `BreadcrumbList` (articles),
`CollectionPage` + `ItemList` + `BreadcrumbList` (hubs, editions, Bible books), `FAQPage` (`/faq`,
hubs). All built in `lib/seo.ts`.

### Low-vision reader

| Story | Flow | Where |
| --- | --- | --- |
| Make the text bigger and easier | "Aa" → size, typeface (incl. Atkinson Hyperlegible), spacing, width, theme (light/sepia/dark) — applied before first paint on every page (**local**) | `components/reader/ReadingSettingsPanel.tsx`, `READING_PREFS_SCRIPT` |
| Fewer distractions | Focus mode hides everything but the devotional | `components/reader/ReadingToolbar.tsx` |
| Use the keyboard | `?` lists shortcuts: ← → days, T today, / search, L listen, S save, M mark read, F focus | `components/common/KeyboardShortcuts.tsx` |

### Site owner

| Story | Flow | Where |
| --- | --- | --- |
| Publish a new month | Add the PDF → `npm run content:extract` → commit → deploy; sitemap, feed, hubs, calendar and share cards follow automatically | README "Publishing a new month" |
| Readers can reach me | `/contact` → email (`NEXT_PUBLIC_CONTACT_EMAIL`) or a prefilled GitHub issue | `app/(public)/contact` |
| Stay within AdSense policy | Privacy policy with the required cookie disclosures, terms, contact, independent-site disclaimer, `ads.txt`, consent message configured in AdSense for EEA/UK | `app/(public)/privacy`, `lib/site.ts` |

---

## 3. Business rules (and their tests)

| Rule | Implementation | Test |
| --- | --- | --- |
| "Today" is the site zone's date (Lagos), never UTC or build time | `lib/time.ts` | `tests/time.test.ts` |
| Days later in the month are readable but never featured as "today" or put in the feed early | `isReleased`, `getReleasedDevotionals`, `app/feed.xml/route.ts` | `tests/feed-route.test.ts` |
| A devotional counts as read at 90% scrolled *and* after a minimum reading time, or when marked | `recordProgress` (`allowComplete`), `ReadingTracker` | `tests/reader-data.test.ts` |
| A day is credited once per devotional; un-marking the same day removes the credit | `trackProgress`, `markAsUnread`, `uncreditDay` | `tests/reader-data.test.ts`, `tests/reader-components.test.tsx` |
| A streak survives until the end of the day after the last reading | `currentStreak` | `tests/reader-data.test.ts` |
| Resume is offered only between 8% and 92% of an unfinished article | `resumePoint` | `tests/reader-data.test.ts` |
| Preference values are whitelisted wherever they are read (store, cookie, pre-paint script) | `normalisePrefs`, `parseAudienceCookie`, `READING_PREFS_SCRIPT` | `tests/reader-data.test.ts` |
| Export / import only touches `rhapsody.*` keys | `exportLocalData`, `importLocalData` | `tests/local-store.test.ts` |
| The service worker never caches APIs, auth, admin, ads or router payloads | `routeFor` in `public/sw.js` | `tests/service-worker.test.ts` |
| Every page has a canonical URL and a share image | `pageMetadata` | `tests/seo.test.ts` |
| The brand is Rhapsody of Realities everywhere, with the independent-site disclaimer | `lib/site.ts` | `tests/brand.test.ts` |
