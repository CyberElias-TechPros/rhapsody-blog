import { Router } from 'express';
import { z } from 'zod';
import { Subscriber } from '../models/Subscriber.js';
import { validate } from '../middleware/validate.js';

const router = Router();

const subSchema = z.object({
  email: z.string().trim().email(),
  channels: z.array(z.string()).optional().default([]),
});

router.post('/', validate(subSchema), async (req, res, next) => {
  try {
    const { email, channels } = req.body;
    const sub = await Subscriber.findOneAndUpdate(
      { email },
      { email, channels, unsubscribedAt: null },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    res.status(201).json({ subscriber: { id: sub._id, email: sub.email, channels: sub.channels } });
  } catch (e) { next(e); }
});

export default router;
