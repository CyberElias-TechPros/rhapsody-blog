import axios from 'axios';
import * as cheerio from 'cheerio';
import slugify from 'slugify';
import { Channel } from '../models/Channel.js';
import { Post } from '../models/Post.js';

const PREVIEW_BASE = 'https://t.me/s';

const computeReadingMinutes = (text) => Math.max(1, Math.round(text.split(/\s+/).length / 200));

const extractTitle = (text) => {
  const firstLine = text.split('\n').map(s => s.trim()).find(Boolean) || 'Untitled';
  return firstLine.length > 120 ? firstLine.slice(0, 117) + '…' : firstLine;
};

const slugFor = (title, messageId) => {
  const base = slugify(title, { lower: true, strict: true }).slice(0, 80) || 'post';
  return `${base}-${messageId}`;
};

/**
 * Fetch the public preview HTML page for a channel and parse messages.
 * Note: Telegram preview pages expose recent messages without auth.
 * For production-grade ingestion, swap this with the Bot API or MTProto.
 */
export async function fetchChannelMessages(username) {
  const url = `${PREVIEW_BASE}/${username}`;
  const { data: html } = await axios.get(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; MeaningBot/1.0)' },
    timeout: 15000,
  });
  const $ = cheerio.load(html);
  const messages = [];

  $('.tgme_widget_message_wrap').each((_, el) => {
    const $el = $(el);
    const dataPost = $el.find('.tgme_widget_message').attr('data-post'); // e.g. channel/12345
    if (!dataPost) return;
    const messageId = parseInt(dataPost.split('/').pop(), 10);
    if (!Number.isFinite(messageId)) return;

    const $text = $el.find('.tgme_widget_message_text').first();
    const text = $text.text().trim();
    if (!text) return;

    const html = $text.html() || '';
    const dateAttr = $el.find('.tgme_widget_message_date time').attr('datetime');
    const publishedAt = dateAttr ? new Date(dateAttr) : new Date();
    const photoStyle = $el.find('.tgme_widget_message_photo_wrap').attr('style') || '';
    const cover = (photoStyle.match(/background-image:url\('([^']+)'\)/) || [])[1] || '';

    messages.push({
      messageId,
      text,
      html,
      publishedAt,
      coverImage: cover,
      telegramUrl: `https://t.me/${dataPost}`,
    });
  });

  return messages;
}

export async function syncChannel(channelDoc) {
  const messages = await fetchChannelMessages(channelDoc.username);
  let created = 0;
  let maxId = channelDoc.lastMessageId || 0;

  for (const m of messages) {
    if (m.messageId <= channelDoc.lastMessageId) continue;
    const title = extractTitle(m.text);
    const slug = slugFor(title, m.messageId);
    const paragraphs = m.text.split('\n').map(s => s.trim()).filter(Boolean);
    const content = paragraphs.join('\n\n');
    const excerpt = paragraphs.slice(1).join(' ').slice(0, 200) || paragraphs[0].slice(0, 200);

    try {
      await Post.create({
        channel: channelDoc._id,
        channelSlug: channelDoc.slug,
        channelName: channelDoc.name,
        telegramMessageId: m.messageId,
        telegramUrl: m.telegramUrl,
        title,
        slug,
        excerpt,
        content,
        rawHtml: m.html,
        coverImage: m.coverImage,
        publishedAt: m.publishedAt,
        readingMinutes: computeReadingMinutes(m.text),
        tags: [channelDoc.slug],
      });
      created++;
      if (m.messageId > maxId) maxId = m.messageId;
    } catch (e) {
      if (e.code !== 11000) console.error(`Post insert failed (${channelDoc.slug}/${m.messageId}):`, e.message);
    }
  }

  channelDoc.lastSyncedAt = new Date();
  channelDoc.lastMessageId = maxId;
  channelDoc.postCount = await Post.countDocuments({ channel: channelDoc._id });
  await channelDoc.save();

  return { channel: channelDoc.slug, fetched: messages.length, created };
}

export async function syncAllChannels() {
  const channels = await Channel.find({ isActive: true });
  const results = [];
  for (const c of channels) {
    try { results.push(await syncChannel(c)); }
    catch (e) { results.push({ channel: c.slug, error: e.message }); }
  }
  return results;
}
