/**
 * The daily digest: what it sends, and what it refuses to send.
 *
 * These are the pure parts — the address it will read today's article from, the subject line, the
 * HTML and text a reader actually receives, and the escaping that keeps a stray "<" in a scanned
 * book from breaking the email. The sending itself (`sendDailyDigest`) needs D1, a live provider
 * and `/api/today`, so it is covered by its guards rather than by a fake: every reason not to send
 * is a value, not an exception.
 */

import { describe, expect, it } from "vitest";
import {
  DIGEST_CRON,
  digestSubject,
  humanDate,
  renderDigestHtml,
  renderDigestText,
  siteOrigin,
  type DigestDevotional,
} from "../src/services/digest";
import type { Env } from "../src/types";

const envWith = (vars: Partial<Env>) => vars as Env;

const devotional: DigestDevotional = {
  title: "The Mind Is The Battlefield",
  slug: "2026-10-12-adults",
  date: "2026-10-12",
  weekday: "Monday",
  editionTitle: "Rhapsody of Realities — October 2026",
  audienceLabel: "For Adults",
  excerpt: "Renewing your mind is a daily discipline.",
  scripture: "Be ye transformed by the renewing of your mind.",
  scriptureReference: "Romans 12:2",
  message: [
    "Your mind is the instrument through which you receive the word of God.",
    "What you think about, you become; and what you become, you do.",
  ],
  prayer: "Father, I receive a renewed mind, in Jesus' Name. Amen.",
  prayerLabel: "Prayer",
  furtherStudy: ["Romans 12:1-2", "Philippians 4:8"],
  oneYearPlan: ["Jeremiah 32", "Hebrews 4"],
  twoYearPlan: ["1 Kings 11", "Luke 13"],
  words: 320,
  url: "https://rhapsody.example/devotionals/2026-10-12-adults",
  href: "/devotionals/2026-10-12-adults",
  listeningMinutes: 3,
};

const siteUrl = "https://rhapsody.example";
const unsubscribeUrl = "https://rhapsody.example/api/subscribers/unsubscribe?email=a%40b.c&token=signed";

describe("siteOrigin", () => {
  it("accepts a deployed frontend origin and drops its path", () => {
    expect(siteOrigin(envWith({ SITE_URL: "https://rhapsody.example/" }))).toBe("https://rhapsody.example");
    expect(siteOrigin(envWith({ SITE_URL: "http://localhost:3000" }))).toBe("http://localhost:3000");
  });

  it("refuses the values that would make the digest read the wrong site", () => {
    expect(siteOrigin(envWith({ SITE_URL: "" }))).toBeNull();
    expect(siteOrigin(envWith({}))).toBeNull();
    expect(siteOrigin(envWith({ SITE_URL: "https://meaning-api.YOUR_SUBDOMAIN.workers.dev" }))).toBeNull();
    expect(siteOrigin(envWith({ SITE_URL: "not a url" }))).toBeNull();
    expect(siteOrigin(envWith({ SITE_URL: "ftp://rhapsody.example" }))).toBeNull();
  });
});

describe("the subject line and the date", () => {
  it("says which day it is and what the article is called", () => {
    expect(humanDate("2026-10-12")).toBe("12 October");
    expect(digestSubject(devotional)).toBe("Monday 12 October: The Mind Is The Battlefield");
  });

  it("stays an email subject, however long the title is", () => {
    const long = { ...devotional, title: "A".repeat(400) };
    expect(digestSubject(long).length).toBeLessThanOrEqual(150);
  });
});

describe("the email itself", () => {
  it("contains the whole day: article, scripture, prayer, further study and both reading plans", () => {
    const html = renderDigestHtml({ devotional, siteUrl, unsubscribeUrl });
    expect(html).toContain("The Mind Is The Battlefield");
    expect(html).toContain("Be ye transformed by the renewing of your mind.");
    expect(html).toContain("Romans 12:2");
    for (const paragraph of devotional.message) expect(html).toContain(paragraph);
    expect(html).toContain("Father, I receive a renewed mind");
    expect(html).toContain("Philippians 4:8");
    expect(html).toContain("Jeremiah 32");
    expect(html).toContain("Luke 13");
    expect(html).toContain(devotional.url);
  });

  it("links the other editions published the same day", () => {
    const html = renderDigestHtml({
      devotional,
      siteUrl,
      unsubscribeUrl,
      alsoToday: [{ audience: "teens", audienceLabel: "For Teens", slug: "2026-10-12-teens", title: "Guard Your Heart", href: "/devotionals/2026-10-12-teens" }],
    });
    expect(html).toContain("Guard Your Heart");
    expect(html).toContain(`${siteUrl}/devotionals/2026-10-12-teens`);
  });

  it("gives every recipient their own one-click unsubscribe", () => {
    const html = renderDigestHtml({ devotional, siteUrl, unsubscribeUrl });
    // Escaped, because the link carries a query string and an attribute is not raw text.
    expect(html).toContain(unsubscribeUrl.replace(/&/g, "&amp;"));
    const text = renderDigestText({ devotional, siteUrl, unsubscribeUrl });
    expect(text).toContain(unsubscribeUrl);
  });

  it("escapes the corpus rather than trusting it", () => {
    // A scanned book or a mis-set PDF can carry markup; an email that renders it is an email that
    // can be broken (or worse, run code) by its own content.
    const hostile = { ...devotional, title: `<script>alert("x")</script>`, message: [`<img src=x onerror="alert(1)">`] };
    const html = renderDigestHtml({ devotional: hostile, siteUrl, unsubscribeUrl });
    expect(html).not.toContain("<script>");
    expect(html).not.toContain("<img src=x");
    expect(html).toContain("&lt;script&gt;");
  });

  it("has a plain-text twin for the clients that need one", () => {
    const text = renderDigestText({ devotional, siteUrl, unsubscribeUrl });
    expect(text).toContain("The Mind Is The Battlefield");
    expect(text).toContain("Monday 12 October");
    expect(text).not.toContain("<p");
    expect(text).toContain(devotional.url);
    expect(text).toContain("FURTHER STUDY");
  });

  it("reads the shapes /api/today actually sends — prose lists, not arrays", () => {
    const asPrinted = {
      ...devotional,
      furtherStudy: "Romans 8:10-11; John 7:38-39; John 14:17",
      oneYearPlan: "Galatians 1:1-24 & Ecclesiastes 9-12",
      twoYearPlan: "1 Timothy 2:1-15 & Jeremiah 33",
    };
    const html = renderDigestHtml({ devotional: asPrinted, siteUrl, unsubscribeUrl });
    // Further study is one reference per line…
    expect(html).toContain("Romans 8:10-11<br>John 7:38-39<br>John 14:17");
    // …and a reading plan stays one line, because both halves are the same day's reading.
    expect(html).toContain("Galatians 1:1-24 &amp; Ecclesiastes 9-12");
    expect(html).not.toContain("Galatians 1:1-24<br>");
  });

  it("omits the blocks a day does not have, instead of printing empty headings", () => {
    const bare = { ...devotional, prayer: "", furtherStudy: [], twoYearPlan: [], scripture: "" };
    const html = renderDigestHtml({ devotional: bare, siteUrl, unsubscribeUrl });
    expect(html).not.toContain("Further study");
    expect(html).not.toContain("Two-year Bible reading plan");
    expect(html).toContain("One-year Bible reading plan");
  });
});

describe("the schedule", () => {
  it("runs once a day, an hour after the site's own midnight", () => {
    // 04:00 UTC is 05:00 in Lagos (NEXT_PUBLIC_SITE_TIMEZONE), the hour the printed edition is
    // considered published — and `sendDailyDigest` claims the day in D1 so a second fire is a no-op.
    expect(DIGEST_CRON).toBe("0 4 * * *");
  });
});
