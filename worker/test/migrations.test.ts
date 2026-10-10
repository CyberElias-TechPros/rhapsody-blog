import { env } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import { useSchema } from "./helpers";

useSchema();

describe("schema", () => {
  it("applies D1 migrations automatically (tables + seeds exist)", async () => {
    const tables = await env.DB.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name IN ('users','posts','channels','subscribers','bookmarks','audit_logs','posts_fts')"
    ).all<{ name: string }>();
    expect((tables.results ?? []).map((r) => r.name).sort()).toEqual(
      ["audit_logs", "bookmarks", "channels", "posts", "posts_fts", "subscribers", "users"]
    );
    const chans = await env.DB.prepare("SELECT COUNT(*) AS n FROM channels").first<{ n: number }>();
    expect(chans?.n).toBe(5); // seed channels from migration
  });

  it("FTS index is populated for inserted posts", async () => {
    const { seedChannel, seedPost } = await import("./helpers");
    await seedChannel("fts-check");
    await seedPost("fts-check", { title: "Zephyrine morning devotional", content: "uniquefossiltoken lorem ipsum" });
    const hit = await env.DB.prepare(
      "SELECT p.title FROM posts p JOIN posts_fts ON posts_fts.rowid = p.rowid WHERE posts_fts MATCH ?"
    ).bind('"uniquefossiltoken"*').first<{ title: string }>();
    expect(hit?.title).toBe("Zephyrine morning devotional");
  });
});
