import { Router } from 'express';
import { Channel } from '../models/Channel.js';

const router = Router();

router.get('/', async (_req, res, next) => {
  try {
    const channels = await Channel.find({ isActive: true }).sort({ name: 1 });
    res.json({ channels });
  } catch (e) { next(e); }
});

router.get('/:slug', async (req, res, next) => {
  try {
    const channel = await Channel.findOne({ slug: req.params.slug, isActive: true });
    if (!channel) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Channel not found' } });
    res.json({ channel });
  } catch (e) { next(e); }
});

export default router;
