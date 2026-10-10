# legacy/ — the previous Vite + React 18 SPA

This is the **"Meaning"** frontend exactly as it was before the Next.js rebuild: a Vite + React 18 +
TypeScript + Tailwind/shadcn-ui single-page app that mirrored public Telegram channels (Rhapsody of
Realities, Pastor Chris and friends) into blog posts via the Cloudflare Worker API.

It is kept **for reference only**. Nothing at the repo root builds, lints, typechecks or tests it:
`tsconfig.json`, `eslint.config.mjs` and `vitest.config.ts` all exclude this directory.

## Why it is still here

| Reason | Where to look |
| --- | --- |
| The Worker API contract, field by field | `src/lib/api.ts` (mirrored by the root `lib/api.ts`) |
| Design tokens, type scale and the dark palette | `src/index.css` (ported into `app/globals.css`) |
| The admin console's panes and moderation flows | `src/pages/Admin.tsx` (ported into `components/screens/AdminScreen.tsx`) |
| Auth screens, session handling, `RequireRole` gating | `src/pages/Login.tsx`, `Register.tsx`, `src/auth/` |
| Security headers and SPA rewrite rules | `vercel.json` (carried into the root `next.config.ts`) |
| Original meta/OG/font setup | `index.html` (now the root `app/layout.tsx`) |
| The old component tests | `src/components/*.test.tsx` |

## Running it (if you need to)

It has its own lockfile and dependencies, separate from the root project:

```bash
cd legacy
npm install
npm run dev        # Vite dev server on :5173
npm run build      # static bundle in legacy/dist
```

Point it at a Worker the same way as before (`.env` — see `legacy/.env.example`).

## What replaced it

- Routing: `react-router-dom` → Next.js App Router (`app/`), with real URLs, prerendered HTML and
  server components.
- Content: Telegram-synced Worker posts → static Markdown generated from the monthly PDF editions
  (`content/devotionals/`, see the root `README.md`).
- Channels → **editions** (`/channels` became `/editions`).
- Bookmarks (Worker, keyed on post ids) → **saved devotionals** in `localStorage`
  (`hooks/useSavedPosts.ts`), because the static corpus has no server-side ids.
- `framer-motion` → the existing Tailwind keyframes (`fade-in`, `scale-in`, `shimmer`).
- Kept as-is: the Cloudflare Worker API in `/worker`, the JWT storage key, and the auth/admin/
  newsletter screens.
