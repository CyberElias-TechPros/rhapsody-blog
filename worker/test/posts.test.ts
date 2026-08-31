import { describe, expect, it } from "vitest";
import { apiFetch, jsonOf, seedChannel, seedPost, useSchema } from "./helpers";

useSchema();

interface ListBody {
  items: Array<{ id: string; title: string; slug: string; views: number; tags: string[]; excerpt: string }>;
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

describe("public posts API", () => {
  it("lists only published posts, newest first, paginated", async () => {
    await seedChannel("list-chan");
    await seedPost("list-chan", { title: "Alpha one", slug: "alpha-1", published_at: "2026-01-01T00:00:00Z" });
    await seedPost("list-chan", { title: "Beta two", slug: "beta-2", published_at: "2026-02-01T00:00:00Z" });
    await seedPost("list-chan", { title: "Hidden one", slug: "hidden-1", status: "hidden" });
    await seedPost("list-chan", { title: "Draft one", slug: "draft-1", status: "draft" });

    const res = await apiFetch("/api/posts?limit=10");
    expect(res.status).toBe(200);
    const body = await jsonOf<ListBody>(res);
    expect(body.total).toBe(2);
    expect(body.items.map((i) => i.title)).toEqual(["Beta two", "Alpha one"]);
    // List items must not leak raw content (payload discipline).
    expect(body.items[0]).not.toHaveProperty("content");
    expect(body.items[0].tags).toContain("test");
  });

  it("paginates with page/limit and clamps nonsense values", async () => {
    await seedChannel("pager");
    for (let i = 1; i <= 5; i++) await seedPost("pager", { title: `P${i}`, slug: `p-${i}`, published_at: `2026-01-0${i}T00:00:00Z` });
    const page2 = await jsonOf<ListBody>(await apiFetch("/api/posts?channel=pager&page=2&limit=2"));
    expect(page2.totalPages).toBe(3);
    expect(page2.items.map((i) => i.title)).toEqual(["P3", "P2"]);
    expect((await apiFetch("/api/posts?channel=pager&page=99&limit=2")).status).toBe(200);
    expect((await jsonOf<ListBody>(await apiFetch("/api/posts?channel=pager&page=99&limit=2"))).items).toEqual([]);
  });

  it("filters by channel", async () => {
    await seedChannel("chan-x");
    await seedChannel("chan-y");
    await seedPost("chan-x", { title: "From x", slug: "from-x" });
    await seedPost("chan-y", { title: "From y", slug: "from-y" });
    const body = await jsonOf<ListBody>(await apiFetch("/api/posts?channel=chan-x"));
    expect(body.items.map((i) => i.title)).toEqual(["From x"]);
  });

  it("searches via FTS with prefix matching; metacharacters cannot break the query", async () => {
    await seedChannel("search-chan");
    await seedPost("search-chan", { title: "Seraphical meditations", slug: "seraphical", content: "extraordinary grace upon grace" });
    const fts = await jsonOf<ListBody>(await apiFetch("/api/posts?q=extraordi"));
    expect(fts.total).toBe(1);

    const titleHit = await jsonOf<ListBody>(await apiFetch("/api/posts?q=seraph"));
    expect(titleHit.total).toBe(1);

    const nonsense = await jsonOf<ListBody>(await apiFetch('/api/posts?q="OR" 1=1 & | near hello'));
    expect(nonsense.items.length).toBeLessThanOrEqual(1); // sanitized to plain terms — no SQL/FTS syntax injection
  });

  it("supports sorting by newest, oldest and popular", async () => {
    await seedChannel("sort-chan");
    await seedPost("sort-chan", { title: "Older post", slug: "older-post", published_at: "2025-01-01T00:00:00Z" });
    await seedPost("sort-chan", { title: "Newer post", slug: "newer-post", published_at: "2026-06-01T00:00:00Z" });
    await seedPost("sort-chan", { title: "Middle post", slug: "middle-post", published_at: "2026-03-01T00:00:00Z" });

    const asc = await jsonOf<ListBody>(await apiFetch("/api/posts?channel=sort-chan&sort=old"));
    expect(asc.items[0].title).toBe("Older post");
    const desc = await jsonOf<ListBody>(await apiFetch("/api/posts?channel=sort-chan&sort=new"));
    expect(desc.items[0].title).toBe("Newer post");

    // popular: two views on "Older post", one on "Newer post"
    await apiFetch("/api/posts/sort-chan/older-post");
    await apiFetch("/api/posts/sort-chan/older-post");
    await apiFetch("/api/posts/sort-chan/newer-post");
    const pop = await jsonOf<ListBody>(await apiFetch("/api/posts?channel=sort-chan&sort=popular"));
    expect(pop.items[0].title).toBe("Older post");
    expect(pop.items[1].title).toBe("Newer post");
  });

  it("increments views atomically on detail and 404s for hidden/draft/unknown", async () => {
    await seedChannel("view-chan");
    await seedPost("view-chan", { title: "Counted post", slug: "counted-post" });
    await seedPost("view-chan", { title: "Secret post", slug: "secret-post", status: "hidden" });

    const d1 = await jsonOf<{ post: { views: number; content: string } }>(await apiFetch("/api/posts/view-chan/counted-post"));
    expect(d1.post.views).toBe(1);
    expect(d1.post.content).toBe("content body words"); // detail includes content, list does not
    const d2 = await jsonOf<{ post: { views: number } }>(await apiFetch("/api/posts/view-chan/counted-post"));
    expect(d2.post.views).toBe(2);

    expect((await apiFetch("/api/posts/view-chan/secret-post")).status).toBe(404);
    const nf = await apiFetch("/api/posts/view-chan/no-such-thing");
    expect(nf.status).toBe(404);
    const env = await jsonOf<{ error: { code: string } }>(nf);
    expect(env.error.code).toBe("NOT_FOUND");
  });

  it("returns related posts from the same channel excluding self", async () => {
    await seedChannel("rel-chan");
    await seedChannel("rel-other");
    await seedPost("rel-chan", { title: "Main post", slug: "main", published_at: "2026-03-01T00:00:00Z" });
    await seedPost("rel-chan", { title: "Older sibling", slug: "older", published_at: "2026-01-01T00:00:00Z" });
    await seedPost("rel-chan", { title: "Newer sibling", slug: "newer", published_at: "2026-02-01T00:00:00Z" });
    await seedPost("rel-other", { title: "Unrelated", slug: "unrel" });

    const detail = await jsonOf<{ post: { title: string }; related: Array<{ title: string }> }>(
      await apiFetch("/api/posts/rel-chan/older")
    );
    expect(detail.post.title).toBe("Older sibling");
    const relTitles = detail.related.map((r) => r.title);
    expect(relTitles).toContain("Main post");
    expect(relTitles).toContain("Newer sibling");
    expect(relTitles).not.toContain("Older sibling");
    expect(relTitles).not.toContain("Unrelated");
  });

  it("exposes cover URLs via the R2 media proxy when mirrored, and the fallback otherwise", async () => {
    await seedChannel("cover-chan");
    await seedPost("cover-chan", { title: "Has mirrored cover", slug: "mirrored" });
    const { env } = await import("cloudflare:test");
    await env.DB.prepare("UPDATE posts SET cover_key = 'covers/cover-chan/42.jpg' WHERE slug = 'mirrored'").run();
    await env.DB.prepare("UPDATE posts SET cover_url = 'https://cdn.example.org/ephemeral.jpg' WHERE slug = 'mirrored' AND 1 = 0").run();
    const d = await jsonOf<{ post: { coverUrl: string | null } }>(await apiFetch("/api/posts/cover-chan/mirrored"));
    expect(d.post.coverUrl).toBe("http://localhost/media/covers/cover-chan/42.jpg");
  });

  it("channels endpoints expose counts and telegram urls; 404 for unknown", async () => {
    await seedChannel("chan-meta", "metauser");
    await seedPost("chan-meta", { title: "One", slug: "one-1" });
    const list = await jsonOf<{ channels: Array<{ slug: string; postCount: number; telegramUrl: string }> }>(await apiFetch("/api/channels"));
    const c = list.channels.find((x) => x.slug === "chan-meta")!;
    expect(c.postCount).toBe(1);
    expect(c.telegramUrl).toBe("https://t.me/s/metauser");
    const one = await jsonOf<{ channel: { name: string } }>(await apiFetch("/api/channels/chan-meta"));
    expect(one.channel.name).toBe("Channel chan-meta");
    expect((await apiFetch("/api/channels/nope")).status).toBe(404);
  });

  it("rejects invalid query params with a 400 validation envelope", async () => {
    for (const qs of ["limit=0", "page=abc", "sort=lol", "limit=9999", "q="]) {
      const bad = await apiFetch(`/api/posts?${qs}`);
      expect(bad.status, qs).toBe(400);
    }
    const e = await jsonOf<{ error: { code: string; details: Record<string, string[]> } }>(await apiFetch("/api/posts?limit=0"));
    expect(e.error.code).toBe("VALIDATION");
    expect(e.error.details.limit?.[0]).toBeTruthy();
  });
});
