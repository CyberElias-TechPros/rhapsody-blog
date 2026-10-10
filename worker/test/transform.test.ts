import { describe, expect, it } from "vitest";
import { computeReadingMinutes, deriveTags, deriveTitle, slugFor, stripLinks, transformMessage } from "../src/services/telegram/transform";
import { buildFtsQuery } from "../src/repos/posts";
import { isValidMediaKey, mediaKeyFor } from "../src/services/media";
import { hashPassword, verifyPassword } from "../src/lib/password";
import { slugify, truncate } from "../src/lib/util";

describe("transform", () => {
  it("derives a clean title from the first line, stripping markdown links", () => {
    expect(deriveTitle("God's Love\n\nsecond para", 42)).toBe("God's Love");
    expect(deriveTitle("[Read more](https://example.org) today\nrest", 7)).toBe("Read more today");
    expect(deriveTitle("   \n\nAfter blank", 1)).toBe("After blank");
    expect(deriveTitle("x".repeat(200), 9).length).toBeLessThanOrEqual(120);
  });

  it("slugifies deterministically with the message id suffix", () => {
    expect(slugFor("The Power Of A Renewed Mind!", 123)).toBe("the-power-of-a-renewed-mind-123");
    expect(slugFor("!!!???", 1)).toBe("post-1");
  });

  it("slugify handles unicode and long strings", () => {
    expect(slugify("Café Élévation")).toBe("cafe-elevation");
    expect(slugify("a".repeat(200)).length).toBe(80);
  });

  it("extracts hashtags plus the channel slug as tags", () => {
    expect(deriveTags("A message with #Faith and #prayer #faith again", "my-chan")).toEqual(["faith", "prayer", "my-chan"]);
    expect(deriveTags("no tags here", "ch")).toEqual(["ch"]);
  });

  it("computes reading minutes from word count", () => {
    expect(computeReadingMinutes("one two three")).toBe(1);
    expect(computeReadingMinutes(Array.from({ length: 400 }, () => "word").join(" "))).toBe(2);
  });

  it("stripLinks keeps labels", () => {
    expect(stripLinks("see [docs](https://a.b) now")).toBe("see docs now");
  });

  it("transformMessage shapes full post fields", () => {
    const out = transformMessage(
      {
        messageId: 10,
        text: "Title line\n\nbody para one\nbody para two",
        publishedAt: "2026-08-01T10:00:00.000Z",
        coverImage: "",
        telegramUrl: "https://t.me/x/10",
      },
      { slug: "chan", name: "Chan" }
    );
    expect(out.title).toBe("Title line");
    expect(out.slug).toBe("title-line-10");
    expect(out.content).toBe("Title line\n\nbody para one\n\nbody para two");
    expect(out.excerpt).toBe("body para one body para two");
    expect(out.readingMinutes).toBeGreaterThanOrEqual(1);
  });

  it("excerpt falls back to the first paragraph for single-paragraph messages", () => {
    const out = transformMessage(
      { messageId: 11, text: "Single paragraph only", publishedAt: "2026-08-01T10:00:00.000Z", coverImage: "", telegramUrl: "x" },
      { slug: "c", name: "C" }
    );
    expect(out.excerpt).toBe("Single paragraph only");
  });
});

describe("fts query builder", () => {
  it("tokenizes, prefixes, and strips operators", () => {
    expect(buildFtsQuery("hello world")).toBe('"hello"* AND "world"*');
    expect(buildFtsQuery('NEAR/a b "quoted"')).toBe('"near"* AND "quoted"*'); // 1-char tokens dropped
    expect(buildFtsQuery("  ")).toBeNull();
    expect(buildFtsQuery("!! ??")).toBeNull();
  });

  it("caps the number of clauses", () => {
    const q = buildFtsQuery(Array.from({ length: 30 }, (_, i) => `term${i}`).join(" "))!;
    expect(q.split(" AND ").length).toBe(8);
  });
});

describe("media keys", () => {
  it("only mirrors recognized image extensions", () => {
    expect(mediaKeyFor("chan", 5, "https://cdn/x.JPG")).toBe("covers/chan/5.jpg");
    expect(mediaKeyFor("chan", 5, "https://cdn/x.webp?v=2")).toBe("covers/chan/5.webp");
    expect(mediaKeyFor("chan", 5, "https://cdn/x.mp4")).toBeNull();
  });

  it("validates media keys strictly (no traversal, no injection)", () => {
    expect(isValidMediaKey("covers/chan/5.jpg")).toBe(true);
    expect(isValidMediaKey("covers/../etc/5.jpg")).toBe(false);
    expect(isValidMediaKey("secrets/5.jpg")).toBe(false);
    expect(isValidMediaKey("covers/chan/5.jpg?a=1")).toBe(false);
    expect(isValidMediaKey("covers/chan/$(rm -rf).jpg")).toBe(false);
  });
});

describe("passwords", () => {
  it("round-trips and rejects mismatches/corrupt hashes", async () => {
    const hash = await hashPassword("s3cret-passphrase!");
    expect(hash.startsWith("pbkdf2-sha256$250000$")).toBe(true);
    expect(await verifyPassword("s3cret-passphrase!", hash)).toBe(true);
    expect(await verifyPassword("wrong", hash)).toBe(false);
    expect(await verifyPassword("x", "garbage")).toBe(false);
    expect(await verifyPassword("x", "pbkdf2-sha256$9$00$00")).toBe(false); // iterations too low
  });
});

describe("truncate", () => {
  it("adds ellipsis", () => {
    expect(truncate("abcdef", 4)).toBe("abc…");
    expect(truncate("abc", 4)).toBe("abc");
  });
});
