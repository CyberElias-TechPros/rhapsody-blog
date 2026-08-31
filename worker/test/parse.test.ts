import { describe, expect, it } from "vitest";
import { parseTelegramPreview } from "../src/services/telegram/parse";
import { telegramPageHtml } from "./helpers";

describe("telegram preview parser", () => {
  it("parses a basic page", async () => {
    const html = telegramPageHtml("mychan", [
      { id: 11, text: "Hello <b>world</b>", date: "2026-08-01T06:30:00+00:00" },
      { id: 12, text: "Second<br>line", date: "2026-08-01T07:00:00+00:00" },
    ]);
    const msgs = await parseTelegramPreview(html, "mychan");
    expect(msgs.map((m) => m.messageId)).toEqual([11, 12]);
    expect(msgs[0]!.text).toBe("Hello world"); // tags stripped, text kept
    expect(msgs[1]!.text).toBe("Second\nline");
    expect(msgs[0]!.publishedAt).toBe(new Date("2026-08-01T06:30:00+00:00").toISOString());
    expect(msgs[0]!.telegramUrl).toBe("https://t.me/mychan/11");
  });

  it("converts links to markdown and drops javascript: hrefs", async () => {
    const html = telegramPageHtml("mychan", [
      { id: 1, text: 'Visit <a href="https://example.org/a?x=1">the site</a> or <a href="javascript:alert(1)">evil</a>' },
    ]);
    const [msg] = await parseTelegramPreview(html, "mychan");
    expect(msg!.text).toBe("Visit [the site](https://example.org/a?x=1) or evil");
  });

  it("ignores quoted reply previews and nested wraps", async () => {
    const html = `
      <div class="tgme_widget_message_wrap">
        <div class="tgme_widget_message" data-post="mychan/5">
          <div class="tgme_widget_message_reply"><div class="tgme_widget_message_text js-message_reply_text">QUOTED — must be ignored</div></div>
          <div class="tgme_widget_message_text js-message_text">REAL message text</div>
        </div>
      </div>`;
    const msgs = await parseTelegramPreview(html, "mychan");
    expect(msgs).toHaveLength(1);
    expect(msgs[0]!.text).toBe("REAL message text");
    expect(msgs[0]!.messageId).toBe(5);
  });

  it("never attributes another channel's message to this one", async () => {
    const html = `
      <div class="tgme_widget_message_wrap">
        <div class="tgme_widget_message" data-post="someoneelse/9">
          <div class="tgme_widget_message_text js-message_text">cross-channel junk</div>
        </div>
      </div>`;
    expect(await parseTelegramPreview(html, "mychan")).toEqual([]);
  });

  it("extracts cover URLs from inline styles", async () => {
    const html = telegramPageHtml("mychan", [
      { id: 9, text: "With photo", photo: "https://cdn-telegram.example/file/photo_proxy_file/01.jpg" },
    ]);
    const [msg] = await parseTelegramPreview(html, "mychan");
    expect(msg!.coverImage).toBe("https://cdn-telegram.example/file/photo_proxy_file/01.jpg");
  });

  it("skips messages with no text (photo-only or service)", async () => {
    const html = `
      <div class="tgme_widget_message_wrap"><div class="tgme_widget_message" data-post="mychan/3">
        <div class="tgme_widget_message_text">   </div>
      </div></div>
      <div class="tgme_widget_message_wrap"><div class="tgme_widget_message" data-post="mychan/4"></div></div>`;
    const msgs = await parseTelegramPreview(html, "mychan");
    expect(msgs).toEqual([]);
  });

  it("decodes entities and normalizes excessive newlines", async () => {
    const html = telegramPageHtml("mychan", [{ id: 1, text: "Tom &amp; Jerry<br><br><br><br>Fin" }]);
    const [msg] = await parseTelegramPreview(html, "mychan");
    expect(msg!.text).toBe("Tom & Jerry\n\nFin");
  });

  it("sorts by message id ascending and dedupes", async () => {
    const one = telegramPageHtml("mychan", [{ id: 20, text: "Twenty" }]);
    const other = telegramPageHtml("mychan", [{ id: 10, text: "Ten" }]);
    const combined = one.replace("</div></body>", "") + "</div>" + other;
    const msgs = await parseTelegramPreview(combined, "mychan");
    expect(msgs.map((m) => m.messageId)).toEqual([10, 20]);
  });

  it("handles empty and garbage pages without throwing", async () => {
    expect(await parseTelegramPreview("", "mychan")).toEqual([]);
    expect(await parseTelegramPreview("<html><body>not a telegram page", "mychan")).toEqual([]);
  });
});
