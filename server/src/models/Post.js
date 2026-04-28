import mongoose from 'mongoose';

const postSchema = new mongoose.Schema(
  {
    channel: { type: mongoose.Schema.Types.ObjectId, ref: 'Channel', required: true, index: true },
    channelSlug: { type: String, required: true, index: true },
    channelName: { type: String, required: true },

    telegramMessageId: { type: Number, required: true },
    telegramUrl: { type: String, required: true },

    title: { type: String, required: true, trim: true },
    slug: { type: String, required: true, lowercase: true, trim: true, index: true },
    excerpt: { type: String, default: '' },
    content: { type: String, required: true }, // markdown / plain paragraphs
    rawHtml: { type: String, default: '' },
    coverImage: { type: String, default: '' },

    tags: { type: [String], default: [], index: true },
    publishedAt: { type: Date, required: true, index: true },
    readingMinutes: { type: Number, default: 1 },

    status: { type: String, enum: ['published', 'draft', 'hidden'], default: 'published', index: true },
    views: { type: Number, default: 0 },
  },
  { timestamps: true }
);

postSchema.index({ channelSlug: 1, slug: 1 }, { unique: true });
postSchema.index({ channelSlug: 1, telegramMessageId: 1 }, { unique: true });
postSchema.index({ title: 'text', content: 'text', tags: 'text' });

export const Post = mongoose.model('Post', postSchema);
