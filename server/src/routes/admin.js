import { Router } from 'express';
import { Channel } from '../models/Channel.js';
import { Post } from '../models/Post.js';
import { User } from '../models/User.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { syncAllChannels, syncChannel } from '../services/telegramSync.js';
import { HttpError } from '../middleware/error.js';

const router = Router();
router.use(requireAuth, requireRole('admin', 'editor'));

router.get('/stats', async (_req, res, next) => {
  try {
    const [channels, posts, users] = await Promise.all([
      Channel.countDocuments(),
      Post.countDocuments(),
      User.countDocuments(),
    ]);
    res.json({ channels, posts, users });
  } catch (e) { next(e); }
});

router.post('/sync', async (_req, res, next) => {
  try {
    const results = await syncAllChannels();
    res.json({ results });
  } catch (e) { next(e); }
});

router.post('/sync/:slug', async (req, res, next) => {
  try {
    const channel = await Channel.findOne({ slug: req.params.slug });
    if (!channel) throw new HttpError(404, 'Channel not found');
    res.json({ result: await syncChannel(channel) });
  } catch (e) { next(e); }
});

router.patch('/posts/:id', async (req, res, next) => {
  try {
    const allowed = ['status', 'title', 'excerpt', 'tags'];
    const update = Object.fromEntries(Object.entries(req.body).filter(([k]) => allowed.includes(k)));
    const post = await Post.findByIdAndUpdate(req.params.id, update, { new: true });
    if (!post) throw new HttpError(404, 'Post not found');
    res.json({ post });
  } catch (e) { next(e); }
});

router.delete('/posts/:id', async (req, res, next) => {
  try {
    const r = await Post.findByIdAndDelete(req.params.id);
    if (!r) throw new HttpError(404, 'Post not found');
    res.json({ ok: true });
  } catch (e) { next(e); }
});

export default router;
