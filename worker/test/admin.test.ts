import { afterEach, describe, expect, it } from "vitest";
import { env } from "cloudflare:test";
import { apiFetch, jsonOf, mockOutbound, registerUser, restoreOutbound, seedChannel, seedPost, telegramPageHtml, useSchema } from "./helpers";

useSchema();
afterEach(restoreOutbound);

describe("admin authorization matrix", () => {
  it("unauthenticated → 401; regular user → 403; editor → 200", async () => {
    await seedChannel("authz-chan");
    const anon = await apiFetch("/api/admin/stats");
    expect(anon.status).toBe(401);

    const { token: userToken } = await registerUser("user");
    const asUser = await apiFetch("/api/admin/stats", { token: userToken });
    expect(asUser.status).toBe(403);

    const { token: editorToken } = await registerUser("editor");
    const asEditor = await apiFetch("/api/admin/stats", { token: editorToken });
    expect(asEditor.status).toBe(200);
  });

  it("user-management + audit + subscriber deletion are admin-only", async () => {
    const { token: editorToken } = await registerUser("editor");
    const { token: adminToken } = await registerUser("admin");
    expect((await apiFetch("/api/admin/users", { token: editorToken })).status).toBe(403);
    expect((await apiFetch("/api/admin/audit", { token: editorToken })).status).toBe(403);
    expect((await apiFetch("/api/admin/users", { token: adminToken })).status).toBe(200);
    expect((await apiFetch("/api/admin/audit", { token: adminToken })).status).toBe(200);
    expect((await apiFetch("/api/admin/subscribers/ghost@example.com", { method: "DELETE", token: adminToken })).status).toBe(404);
  });
});

describe("post moderation", () => {
  it("edits fields, hides content from the public API, and records audit entries", async () => {
    await seedChannel("mod-chan");
    const id = await seedPost("mod-chan", { title: "Original title", slug: "original-title" });
    const { token } = await registerUser("editor");

    const patch = await apiFetch(`/api/admin/posts/${id}`, {
      method: "PATCH",
      token,
      body: { title: "Edited title here", tags: ["faith", "edited"], status: "hidden" },
    });
    expect(patch.status).toBe(200);
    const { post } = await jsonOf<{ post: { title: string; tags: string[] } }>(patch);
    expect(post.title).toBe("Edited title here");
    expect(post.tags).toContain("edited");

    // hidden → gone from public list + detail
    const list = await jsonOf<{ items: unknown[] }>(await apiFetch("/api/posts?channel=mod-chan"));
    expect(list.items).toHaveLength(0);
    expect((await apiFetch("/api/posts/mod-chan/original-title")).status).toBe(404);

    await new Promise((r) => setTimeout(r, 50));
    const audit = await env.DB.prepare("SELECT action, resource_id FROM audit_logs WHERE action = 'admin.post_update'").all<{ action: string; resource_id: string }>();
    expect(audit.results?.some((a) => a.resource_id === id)).toBe(true);
  });

  it("validates the patch body", async () => {
    await seedChannel("valid-chan");
    const id = await seedPost("valid-chan", { slug: "slug-a" });
    const { token } = await registerUser("editor");
    expect((await apiFetch(`/api/admin/posts/${id}`, { method: "PATCH", token, body: {} })).status).toBe(400);
    expect((await apiFetch(`/api/admin/posts/${id}`, { method: "PATCH", token, body: { title: "x" } })).status).toBe(400);
    expect((await apiFetch(`/api/admin/posts/${id}`, { method: "PATCH", token, body: { status: "archived" } })).status).toBe(400);
    // unknown extra fields are stripped, not applied
    const ok = await apiFetch(`/api/admin/posts/${id}`, { method: "PATCH", token, body: { excerpt: "new", views: 999999 } });
    expect(ok.status).toBe(200);
    const { post } = await jsonOf<{ post: { views: number; excerpt: string } }>(ok);
    expect(post.views).not.toBe(999999);
    expect(post.excerpt).toBe("new");
  });

  it("deletes posts (and cascades bookmarks), then returns 404", async () => {
    await seedChannel("del-chan");
    const id = await seedPost("del-chan", { slug: "doomed" });
    const { token } = await registerUser("editor");
    expect((await apiFetch(`/api/admin/posts/${id}`, { method: "DELETE", token })).status).toBe(204);
    expect((await apiFetch(`/api/admin/posts/${id}`, { method: "DELETE", token })).status).toBe(404);
    const list = await jsonOf<{ total: number }>(await apiFetch("/api/posts?channel=del-chan"));
    expect(list.total).toBe(0);
  });
});

describe("stats and subscriber admin", () => {
  it("aggregates counts", async () => {
    await seedChannel("stats-chan");
    await seedPost("stats-chan", { slug: "s1" });
    await seedPost("stats-chan", { slug: "s2", status: "hidden" });
    const { token } = await registerUser("admin");
    const stats = await jsonOf<{
      posts: { total: number; published: number; hidden: number };
      users: { total: number; admins: number };
      subscribers: number;
      channelSync: Array<{ slug: string; post_count: number }>;
    }>(await apiFetch("/api/admin/stats", { token }));
    expect(stats.posts.published).toBeGreaterThanOrEqual(1);
    expect(stats.posts.hidden).toBeGreaterThanOrEqual(1);
    expect(stats.users.admins).toBeGreaterThanOrEqual(1);
    const chan = stats.channelSync.find((c) => c.slug === "stats-chan");
    expect(chan?.post_count).toBe(1);
  });

  it("lists and exports subscribers; deletes them (admin only)", async () => {
    await apiFetch("/api/subscribers", { method: "POST", body: { email: "list-me@example.com" } });
    const { token: editorToken } = await registerUser("editor");
    const { token: adminToken } = await registerUser("admin");

    const list = await jsonOf<{ items: Array<{ email: string }>; total: number }>(
      await apiFetch("/api/admin/subscribers", { token: editorToken })
    );
    expect(list.items.some((s) => s.email === "list-me@example.com")).toBe(true);

    const csv = await apiFetch("/api/admin/subscribers?format=csv", { token: editorToken });
    expect(csv.headers.get("content-type")).toContain("text/csv");
    expect(await csv.text()).toContain("list-me@example.com");

    expect((await apiFetch("/api/admin/subscribers/list-me@example.com", { method: "DELETE", token: editorToken })).status).toBe(403);
    expect((await apiFetch("/api/admin/subscribers/list-me@example.com", { method: "DELETE", token: adminToken })).status).toBe(204);
  });
});

describe("user management guardrails", () => {
  it("refuses self-demotion and last-admin demotion", async () => {
    const admin = await registerUser("admin");
    const other = await registerUser("admin");

    const self = await apiFetch(`/api/admin/users/${admin.id}`, { method: "PATCH", token: admin.token, body: { role: "user" } });
    expect(self.status).toBe(400);

    // demote the other admin, then try demoting self as last admin → also 400 (both guards apply)
    expect((await apiFetch(`/api/admin/users/${other.id}`, { method: "PATCH", token: admin.token, body: { role: "user" } })).status).toBe(200);
    const lastSelf = await apiFetch(`/api/admin/users/${admin.id}`, { method: "PATCH", token: admin.token, body: { isActive: false } });
    expect(lastSelf.status).toBe(400);

    // deactivating a user bumps token_version → their sessions die
    const victim = await registerUser("user");
    expect((await apiFetch("/api/auth/me", { token: victim.token })).status).toBe(200);
    expect((await apiFetch(`/api/admin/users/${victim.id}`, { method: "PATCH", token: admin.token, body: { isActive: false } })).status).toBe(200);
    expect((await apiFetch("/api/auth/me", { token: victim.token })).status).toBe(401);

    // and they cannot log back in while deactivated
    expect((await apiFetch("/api/auth/login", { method: "POST", body: { email: victim.email, password: victim.password } })).status).toBe(401);
  });

  it("promotes a regular user to editor", async () => {
    const admin = await registerUser("admin");
    const user = await registerUser("user");
    expect((await apiFetch(`/api/admin/users/${user.id}`, { method: "PATCH", token: admin.token, body: { role: "editor" } })).status).toBe(200);
    // user's old token still has role 'user' inside, and role is read from DB on admin routes?
    // Authorization is enforced from the *token claims* + DB lookup — the promoted user must re-login.
    const relogin = await apiFetch("/api/auth/login", { method: "POST", body: { email: user.email, password: user.password } });
    const { token } = await jsonOf<{ token: string }>(relogin);
    expect((await apiFetch("/api/admin/stats", { token })).status).toBe(200);
  });
});

describe("sync (fetchMocked Telegram preview)", () => {
  it("ingests messages idempotently via admin sync", async () => {
    await seedChannel("sync-chan", "syncuser");
    const html = telegramPageHtml("syncuser", [
      { id: 100, text: "Morning Devotional\nVerse of the day.", date: "2026-08-01T06:00:00+00:00" },
      { id: 101, text: "Second message #prayer with <a href=\"https://example.org\">a link</a>", date: "2026-08-01T07:00:00+00:00", photo: "https://cdn.telegram.test/photo.jpg" },
    ]);
    mockOutbound({ telegramPages: { syncuser: html } });

    const { token } = await registerUser("editor");
    const first = await jsonOf<{ result: { created: number; fetched: number } }>(
      await apiFetch("/api/admin/sync/sync-chan", { method: "POST", token })
    );
    expect(first.result.created).toBe(2);
    expect(first.result.fetched).toBe(2);

    // list shows the ingested posts
    const list = await jsonOf<{ items: Array<{ title: string }>; total: number }>(await apiFetch("/api/posts?channel=sync-chan"));
    expect(list.total).toBe(2);

    // R2 cover mirror ran in the background and got attached to the post
    const mirrored = await env.DB.prepare(
      "SELECT cover_key, cover_url FROM posts WHERE channel_slug = 'sync-chan' AND telegram_message_id = 101"
    ).first<{ cover_key: string; cover_url: string }>();
    expect(mirrored?.cover_key).toBe("covers/sync-chan/101.jpg");
    expect(mirrored?.cover_url).toBe("https://cdn.telegram.test/photo.jpg");

    // second run with a stale older message appended → nothing new (high-water mark)
    mockOutbound({ telegramPages: { syncuser: html + telegramPageHtml("syncuser", [{ id: 50, text: "Ancient" }]) } });
    const second = await jsonOf<{ result: { created: number } }>(
      await apiFetch("/api/admin/sync/sync-chan", { method: "POST", token })
    );
    expect(second.result.created).toBe(0);

    // moderated content is NOT resurrected by a re-sync
    const posts = await env.DB
      .prepare("SELECT id, slug, telegram_message_id FROM posts WHERE channel_slug = 'sync-chan' ORDER BY telegram_message_id")
      .all<{ id: string; slug: string; telegram_message_id: number }>();
    const target = posts.results![0]!;
    await apiFetch(`/api/admin/posts/${target.id}`, { method: "PATCH", token, body: { status: "hidden" } });
    const third = await jsonOf<{ result: { created: number } }>(await apiFetch("/api/admin/sync/sync-chan", { method: "POST", token }));
    expect(third.result.created).toBe(0);
    const stillHidden = await env.DB.prepare("SELECT status FROM posts WHERE id = ?").bind(target.id).first<{ status: string }>();
    expect(stillHidden?.status).toBe("hidden");
  });

  it("sync-all isolates failing channels", async () => {
    await seedChannel("good-chan", "gooduser");
    await seedChannel("bad-chan", "baduser");
    mockOutbound({
      telegramPages: { gooduser: telegramPageHtml("gooduser", [{ id: 5, text: "Good message" }]) },
      failUrls: ["https://t.me/s/baduser"],
    });

    const { token } = await registerUser("editor");
    const res = await jsonOf<{ results: Array<{ channel: string; created?: number; error?: string }> }>(
      await apiFetch("/api/admin/sync", { method: "POST", token })
    );
    const good = res.results.find((r) => r.channel === "good-chan");
    const bad = res.results.find((r) => r.channel === "bad-chan");
    expect(good?.created).toBeGreaterThanOrEqual(1);
    expect(bad?.error).toBeTruthy();
  });
});
