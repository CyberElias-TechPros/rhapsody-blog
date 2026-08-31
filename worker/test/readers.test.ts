import { describe, expect, it } from "vitest";
import { env } from "cloudflare:test";
import { apiFetch, jsonOf, registerUser, seedChannel, seedPost, useSchema } from "./helpers";

useSchema();

describe("bookmarks + follows (ownership-scoped)", () => {
  it("anonymous access is rejected", async () => {
    expect((await apiFetch("/api/me/bookmarks")).status).toBe(401);
    expect((await apiFetch("/api/me/follows")).status).toBe(401);
    expect((await apiFetch("/api/me/bookmarks/00000000-0000-4000-8000-000000000000", { method: "POST" })).status).toBe(401);
  });

  it("adds, lists, and removes a bookmark; rejects unknown/hidden posts", async () => {
    await seedChannel("bm-chan");
    const postA = await seedPost("bm-chan", { slug: "a" });
    const hidden = await seedPost("bm-chan", { slug: "h", status: "hidden" });
    const { token } = await registerUser();

    expect((await apiFetch(`/api/me/bookmarks/${postA}`, { method: "POST", token })).status).toBe(201);
    expect((await apiFetch(`/api/me/bookmarks/${postA}`, { method: "POST", token })).status).toBe(201); // idempotent
    let list = await jsonOf<{ items: Array<{ id: string }> }>(await apiFetch("/api/me/bookmarks", { token }));
    expect(list.items.map((i) => i.id)).toEqual([postA]);

    const ids = await jsonOf<{ ids: string[] }>(await apiFetch("/api/me/bookmarks/ids", { token }));
    expect(ids.ids).toContain(postA);

    expect((await apiFetch(`/api/me/bookmarks/${hidden}`, { method: "POST", token })).status).toBe(404);
    expect((await apiFetch("/api/me/bookmarks/not-a-uuid", { method: "POST", token })).status).toBe(400);

    expect((await apiFetch(`/api/me/bookmarks/${postA}`, { method: "DELETE", token })).status).toBe(204);
    list = await jsonOf<{ items: Array<{ id: string }> }>(await apiFetch("/api/me/bookmarks", { token }));
    expect(list.items).toHaveLength(0);
  });

  it("bookmarks are private: one user cannot see or delete another's", async () => {
    await seedChannel("priv-chan");
    const post = await seedPost("priv-chan", { slug: "p1" });
    const alice = await registerUser();
    const bob = await registerUser();
    await apiFetch(`/api/me/bookmarks/${post}`, { method: "POST", token: alice.token });

    const bobList = await jsonOf<{ items: unknown[] }>(await apiFetch("/api/me/bookmarks", { token: bob.token }));
    expect(bobList.items).toHaveLength(0);

    await apiFetch(`/api/me/bookmarks/${post}`, { method: "DELETE", token: bob.token }); // no-op for bob
    const aliceList = await jsonOf<{ items: unknown[] }>(await apiFetch("/api/me/bookmarks", { token: alice.token }));
    expect(aliceList.items).toHaveLength(1);

    // deleting the post removes orphan bookmarks via FK cascade
    const { token: adminToken } = await registerUser("admin");
    await apiFetch(`/api/admin/posts/${post}`, { method: "DELETE", token: adminToken });
    const count = await env.DB.prepare("SELECT COUNT(*) AS n FROM bookmarks WHERE post_id = ?").bind(post).first<{ n: number }>();
    expect(count?.n).toBe(0);
  });

  it("follows channels by slug", async () => {
    await seedChannel("follow-me");
    await seedChannel("nope-chan");
    const { token } = await registerUser();
    expect((await apiFetch("/api/me/follows/follow-me", { method: "POST", token })).status).toBe(201);
    const list = await jsonOf<{ items: Array<{ slug: string }> }>(await apiFetch("/api/me/follows", { token }));
    expect(list.items.map((c) => c.slug)).toEqual(["follow-me"]);

    expect((await apiFetch("/api/me/follows/ghost-chan", { method: "POST", token })).status).toBe(404);
    expect((await apiFetch("/api/me/follows/BAD SLUG!", { method: "POST", token })).status).toBe(400);

    expect((await apiFetch("/api/me/follows/follow-me", { method: "DELETE", token })).status).toBe(204);
    const after = await jsonOf<{ items: unknown[] }>(await apiFetch("/api/me/follows", { token }));
    expect(after.items).toHaveLength(0);
  });

  it("deleting a channel's last post keeps channel row healthy", async () => {
    await seedChannel("drain-chan");
    const p = await seedPost("drain-chan", { slug: "only" });
    const { token } = await registerUser("admin");
    await apiFetch(`/api/admin/posts/${p}`, { method: "DELETE", token });
    const ch = await apiFetch("/api/channels/drain-chan");
    expect(ch.status).toBe(200);
  });
});

describe("subscribers", () => {
  it("subscribes, dedupes on re-subscribe, filters unknown channels", async () => {
    await seedChannel("known-chan");
    const r1 = await apiFetch("/api/subscribers", { method: "POST", body: { email: "Fan@Example.com", channels: ["known-chan", "bogus-chan"] } });
    expect(r1.status).toBe(201);
    const b1 = await jsonOf<{ subscriber: { email: string; channels: string[] } }>(r1);
    expect(b1.subscriber.email).toBe("fan@example.com");
    expect(b1.subscriber.channels).toEqual(["known-chan"]);

    // re-subscribe is an update, not a duplicate
    await apiFetch("/api/subscribers", { method: "POST", body: { email: "fan@example.com", channels: [] } });
    const { results } = await env.DB.prepare("SELECT COUNT(*) AS c FROM subscribers WHERE email = 'fan@example.com'").all<{ c: number }>();
    expect(results![0]!.c).toBe(1);
  });

  it("rejects invalid emails", async () => {
    for (const email of ["nope", "a@b", "a b@example.com", "x".repeat(300) + "@example.com"]) {
      const r = await apiFetch("/api/subscribers", { method: "POST", body: { email } });
      expect(r.status, email.slice(0, 20)).toBe(400);
    }
  });

  it("unsubscribe requires a valid signed token", async () => {
    await apiFetch("/api/subscribers", { method: "POST", body: { email: "unsub@example.com" } });
    const { makeUnsubscribeToken } = await import("../src/routes/subscribers");
    const bad = await apiFetch("/api/subscribers/unsubscribe?email=unsub@example.com&token=deadbeefdeadbeef");
    expect(bad.status).toBe(403);

    const good = makeUnsubscribeToken(env.JWT_SECRET!, "unsub@example.com", Date.now());
    const res = await apiFetch(`/api/subscribers/unsubscribe?email=unsub@example.com&token=${good}`);
    expect(res.status).toBe(200);
    const row = await env.DB.prepare("SELECT unsubscribed_at IS NOT NULL AS gone FROM subscribers WHERE email = 'unsub@example.com'")
      .first<{ gone: number }>();
    expect(row?.gone).toBe(1);
  });

  it("rate-limits subscribe per IP", async () => {
    const ip = "203.0.113.200";
    let limited = false;
    for (let i = 0; i < 14; i++) {
      const r = await apiFetch("/api/subscribers", { method: "POST", body: { email: `s${i}@example.com` }, ip });
      if (r.status === 429) { limited = true; break; }
    }
    expect(limited).toBe(true);
  });
});
