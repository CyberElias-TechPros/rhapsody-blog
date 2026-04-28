import { CHANNELS } from "./channels";

export type BlogPost = {
  id: string;
  channelSlug: string;
  channelName: string;
  title: string;
  slug: string;
  excerpt: string;
  content: string; // markdown-ish / paragraphs separated by \n\n
  coverImage?: string;
  publishedAt: string; // ISO
  readingMinutes: number;
  tags: string[];
  telegramMessageId: number;
  telegramUrl: string;
  views: number;
};

const SAMPLES: Record<string, { title: string; body: string; tags: string[] }[]> = {
  "rhapsody-of-realities": [
    {
      title: "Walking In The Reality Of The New Creation",
      tags: ["devotional", "faith", "identity"],
      body: `The new creation is a divine masterpiece, born of the Spirit and shaped by the Word. To walk in this reality is to recognise that the old has truly passed away.\n\nWhen you understand who you are in Christ, fear loses its grip. Doubt cannot stand where the Word has spoken.\n\nToday, refuse every thought that contradicts the truth of your identity. You are not who circumstances say you are; you are who the Word says you are.`,
    },
    {
      title: "The Power Of A Renewed Mind",
      tags: ["devotional", "growth"],
      body: `Transformation begins in the mind. As you saturate your thoughts in the Word, your perspective shifts and your decisions follow.\n\nA renewed mind sees opportunity where others see obstacles.\n\nMake meditation on the Word your daily practice — and watch divine wisdom direct your steps.`,
    },
  ],
  "pastor-chris-teachings": [
    {
      title: "Understanding The Place Of The Word",
      tags: ["teaching", "word"],
      body: `The Word of God is not a collection of nice sayings. It is the active, creative force that frames our world.\n\nWhen you give the Word first place, you give God first place.\n\nLearn to speak it, declare it, and live it — and the results will be undeniable.`,
    },
  ],
  "pastor-chris-books": [
    {
      title: "Excerpt — How To Make Your Faith Work",
      tags: ["book", "faith"],
      body: `Faith is not wishful thinking. It is the substance and the evidence — the title deed of the unseen.\n\nYour faith works when it rests on what God has said.\n\nThis chapter unpacks the simple, scriptural keys to making your faith deliver consistent results.`,
    },
  ],
  "rhapsody-library": [
    {
      title: "Featured Edition — Spirit, Soul And Body",
      tags: ["library", "edition"],
      body: `A deep look at the tripartite nature of man and how each part functions in the believer's walk.\n\nYou are a spirit. You have a soul. You live in a body.\n\nUnderstanding this changes how you pray, study and live.`,
    },
  ],
  "classic-gospel-music": [
    {
      title: "Hymn Spotlight — Great Is Thy Faithfulness",
      tags: ["music", "hymn"],
      body: `A timeless reminder that morning by morning new mercies we see.\n\nThis classic continues to lift hearts across generations.\n\nPress play, lift your voice, and let worship reset your day.`,
    },
  ],
};

const slugify = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

export const MOCK_POSTS: BlogPost[] = CHANNELS.flatMap((ch, ci) => {
  const items = SAMPLES[ch.slug] ?? [];
  return items.map((item, i) => {
    const id = `${ch.slug}-${i + 1}`;
    const date = new Date(Date.now() - (ci * 3 + i) * 86400000).toISOString();
    return {
      id,
      channelSlug: ch.slug,
      channelName: ch.name,
      title: item.title,
      slug: slugify(item.title),
      excerpt: item.body.split("\n\n")[0].slice(0, 180) + "…",
      content: item.body,
      publishedAt: date,
      readingMinutes: Math.max(2, Math.round(item.body.split(/\s+/).length / 200)),
      tags: item.tags,
      telegramMessageId: 1000 + ci * 100 + i,
      telegramUrl: `${ch.url}/${1000 + ci * 100 + i}`,
      views: Math.floor(Math.random() * 5000) + 200,
    } as BlogPost;
  });
});

export const getPostBySlug = (channelSlug: string, slug: string) =>
  MOCK_POSTS.find(p => p.channelSlug === channelSlug && p.slug === slug);

export const getPostsByChannel = (channelSlug: string) =>
  MOCK_POSTS.filter(p => p.channelSlug === channelSlug);
