import { Router } from 'express';
import { z } from 'zod';
import { Post } from '../models/Post.js';
import { validate } from '../middleware/validate.js';

const router = Router();

const listQuery = z.object({
  channel: z.string().optional(),
  q: z.string().optional(),
  tag: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(12),
});

router.get('/', validate(listQuery, 'query'), async (req, res, next) => {
  try {
    const { channel, q, tag, page, limit } = req.query;
    const filter = { status: 'published' };
    if (channel) filter.channelSlug = channel;
    if (tag) filter.tags = tag;
    if (q) filter.$text = { $search: q };

    const [items, total] = await Promise.all([
      Post.find(filter).sort({ publishedAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
      Post.countDocuments(filter),
    ]);

    res.json({ items, page, limit, total, totalPages: Math.ceil(total / limit) });
  } catch (e) { next(e); }
});

router.get('/:channelSlug/:slug', async (req, res, next) => {
  try {
    const { channelSlug, slug } = req.params;
    const post = await Post.findOneAndUpdate(
      { channelSlug, slug, status: 'published' },
      { $inc: { views: 1 } },
      { new: true }
    ).lean();
    if (!post) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Post not found' } });
    res.json({ post });
  } catch (e) { next(e); }
});

export default router;
