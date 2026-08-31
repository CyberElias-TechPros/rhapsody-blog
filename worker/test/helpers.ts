import { beforeAll } from "vitest";
import { env, SELF } from "cloudflare:test";
import migration0001 from "../migrations/0001_init.sql?raw";

/**
 * Local miniflare's D1.exec() splits statements line-wise (breaks on multi-line DDL), so we
 * split the migration ourselves — trigger-aware — and run `batch()`. Production applies
 * migrations via `wrangler d1 migrations apply`, which handles this natively.
 * Memoized per test file (the pool isolates storage per file).
 */
function splitStatements(sql: string): string[] {
  const statements: string[] = [];
  let acc = "";
  for (const rawLine of sql.split("\n")) {
    const line = rawLine.trim().startsWith("--") ? "" : rawLine;
    acc += line + "\n";
    const trimmed = acc.trimEnd();
    if (trimmed.endsWith(";")) {
      const insideTrigger = /CREATE TRIGGER/i.test(trimmed) && !/END;$/i.test(trimmed);
      if (!insideTrigger) {
        statements.push(trimmed);
        acc = "";
      }
    }
  }
  if (acc.trim()) statements.push(acc.trimEnd());
  return statements;
}

let schemaPromise: Promise<void> | null = null;
export function ensureSchema(): Promise<void> {
  schemaPromise ??= (async () => {
    const statements = splitStatements(migration0001);
    for (let i = 0; i < statements.length; i += 50) {
      await env.DB.batch(statements.slice(i, i + 50).map((s) => env.DB.prepare(s)));
    }
  })();
  return schemaPromise;
}

/** Register the schema hook for a test file. */
export function useSchema(): void {
  beforeAll(ensureSchema);
}

// ---------------------------------------------------------------
// HTTP helpers
// ---------------------------------------------------------------

let ipCounter = 0;
/** Fresh synthetic client IP per call so unrelated tests never share rate-limit buckets. */
const nextIp = (): string => `198.51.100.${(ipCounter++ % 240) + 10}`;

export interface FetchOpts {
  method?: string;
  body?: unknown;
  token?: string;
  ip?: string;
  headers?: Record<string, string>;
}

export async function apiFetch(path: string, init: FetchOpts = {}): Promise<Response> {
  const headers = new Headers(init.headers);
  if (init.body !== undefined && !headers.has("content-type")) headers.set("content-type", "application/json");
  if (init.token) headers.set("authorization", `Bearer ${init.token}`);
  headers.set("cf-connecting-ip", init.ip ?? nextIp());
  return SELF.fetch(`http://localhost${path}`, {
    method: init.method ?? "GET",
    headers,
    ...(init.body !== undefined ? { body: typeof init.body === "string" ? init.body : JSON.stringify(init.body) } : {}),
  });
}

export async function jsonOf<T>(res: Response): Promise<T> {
  return (await res.json()) as T;
}

// ---------------------------------------------------------------
// Data helpers
// ---------------------------------------------------------------

const PASSWORD = "correct-horse-battery-staple";

export async function registerUser(role: "user" | "editor" | "admin" = "user"): Promise<{ id: string; token: string; email: string; password: string }> {
  const email = `t${crypto.randomUUID().slice(0, 8)}@example.com`;
  const reg = await apiFetch("/api/auth/register", { method: "POST", body: { name: "Test User", email, password: PASSWORD } });
  if (!reg.ok) throw new Error(`register failed: ${reg.status} ${await reg.text()}`);
  const body = await jsonOf<{ user: { id: string }; token: string }>(reg);
  if (role !== "user") {
    await env.DB.prepare("UPDATE users SET role = ? WHERE id = ?").bind(role, body.user.id).run();
    // Re-login so the token carries the promoted role.
    const login = await apiFetch("/api/auth/login", { method: "POST", body: { email, password: PASSWORD } });
    const loginBody = await jsonOf<{ token: string }>(login);
    return { id: body.user.id, token: loginBody.token, email, password: PASSWORD };
  }
  return { id: body.user.id, token: body.token, email, password: PASSWORD };
}

export async function seedChannel(slug: string, username = `tg_${slug}`): Promise<string> {
  const id = `ch_${slug.replace(/[^a-z0-9]/g, "_")}`;
  await env.DB.prepare(
    "INSERT OR IGNORE INTO channels (id, slug, name, username, description, accent) VALUES (?, ?, ?, ?, '', 'from-primary to-primary-glow')"
  ).bind(id, slug, `Channel ${slug}`, username).run();
  return id;
}

export async function seedPost(
  channelSlug: string,
  overrides: Partial<{ title: string; slug: string; content: string; excerpt: string; status: string; published_at: string; telegram_message_id: number; tags: string }> = {}
): Promise<string> {
  const id = crypto.randomUUID();
  const msgId = overrides.telegram_message_id ?? Math.floor(1_000_000_000 + Math.random() * 5_000_000_000);
  const title = overrides.title ?? `Post ${msgId}`;
  const slug = overrides.slug ?? `post-${msgId}`;
  const channel = await env.DB.prepare("SELECT id, name FROM channels WHERE slug = ?").bind(channelSlug).first<{ id: string; name: string }>();
  if (!channel) throw new Error(`channel not found: ${channelSlug}`);
  await env.DB.prepare(
    `INSERT INTO posts (id, channel_id, channel_slug, channel_name, telegram_message_id, telegram_url,
      title, slug, excerpt, content, published_at, reading_minutes, tags, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`
  ).bind(
    id, channel.id, channelSlug, channel.name, msgId,
    `https://t.me/${channelSlug}/${msgId}`, title, slug,
    overrides.excerpt ?? "excerpt text", overrides.content ?? "content body words",
    overrides.published_at ?? "2026-01-01T00:00:00Z",
    overrides.tags ?? '["test"]', overrides.status ?? "published"
  ).run();
  await env.DB
    .prepare("UPDATE channels SET post_count = (SELECT COUNT(*) FROM posts WHERE channel_id = ? AND status='published') WHERE slug = ?")
    .bind(channel.id, channelSlug).run();
  return id;
}

// ---------------------------------------------------------------
// Outbound fetch mocking: tests run in the same isolate as the worker, so swapping
// globalThis.fetch intercepts the Worker's outbound calls. Everything not matching a
// mock rule falls through to the real fetch (which would hit the network).
// ---------------------------------------------------------------

const realFetch = globalThis.fetch.bind(globalThis);

export interface FetchMocks {
  telegramPages: Record<string, string>; // username → /s/ page HTML
  photos?: Record<string, string>; // url → body (defaults: any https://cdn.telegram.test/…*)
  failUrls?: string[]; // exact URLs that reject
}

export function mockOutbound(mocks: FetchMocks): void {
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url =
      typeof input === "string" ? input : input instanceof Request ? input.url : String(input);
    if (mocks.failUrls?.includes(url)) throw new Error(`mocked network failure for ${url}`);
    if (url.startsWith("https://t.me/s/")) {
      const username = decodeURIComponent(url.slice("https://t.me/s/".length).split("/")[0]);
      const page = mocks.telegramPages[username];
      if (page === undefined) throw new Error(`unmocked t.me request: ${url}`);
      return new Response(page, { headers: { "content-type": "text/html; charset=utf-8" } });
    }
    if (url.startsWith("https://cdn.telegram.test/")) {
      const body = mocks.photos?.[url] ?? "FAKE-JPEG-BYTES";
      return new Response(body, {
        headers: { "content-type": "image/jpeg", "content-length": String(new TextEncoder().encode(body).length) },
      });
    }
    return realFetch(input, init);
  }) as typeof fetch;
}

export function restoreOutbound(): void {
  globalThis.fetch = realFetch;
}

/** Build a realistic Telegram /s/ preview page for fixtures. */
export function telegramPageHtml(username: string, messages: Array<{ id: number; text: string; date?: string; photo?: string }>): string {
  const items = messages
    .map(
      (m) => `
    <div class="tgme_widget_message_wrap js-widget_message_wrap">
      <div class="tgme_widget_message text-start wrap js-widget_message" data-post="${username}/${m.id}">
        <div class="tgme_widget_message_text js-message_text" dir="auto">${m.text}</div>
        ${m.photo ? `<a class="tgme_widget_message_photo_wrap" style="background-image:url('${m.photo}')"><i class="icon"> </i></a>` : ""}
        <div class="tgme_widget_message_footer">
          <div class="tgme_widget_message_date"><time datetime="${m.date ?? "2026-08-01T12:00:00+00:00"}">Aug 1</time></div>
        </div>
      </div>
    </div>`
    )
    .join("\n");
  return `<!doctype html><html><body><section class="tgme_channel_info_counter"></section><div class="tgme_channel_history js_message_history">${items}</div></body></html>`;
}
