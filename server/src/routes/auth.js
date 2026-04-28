import { Router } from 'express';
import { z } from 'zod';
import { User } from '../models/User.js';
import { signToken, requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { HttpError } from '../middleware/error.js';

const router = Router();

const registerSchema = z.object({
  name: z.string().trim().min(2).max(80),
  email: z.string().trim().email().max(255),
  password: z.string().min(8).max(128),
});

router.post('/register', validate(registerSchema), async (req, res, next) => {
  try {
    const { name, email, password } = req.body;
    if (await User.findOne({ email })) throw new HttpError(409, 'Email already in use');
    const user = new User({ name, email });
    await user.setPassword(password);
    await user.save();
    res.status(201).json({ user: user.toSafeJSON(), token: signToken(user) });
  } catch (e) { next(e); }
});

const loginSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(1),
});

router.post('/login', validate(loginSchema), async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user || !(await user.verifyPassword(password))) throw new HttpError(401, 'Invalid credentials');
    user.lastLoginAt = new Date();
    await user.save();
    res.json({ user: user.toSafeJSON(), token: signToken(user) });
  } catch (e) { next(e); }
});

router.get('/me', requireAuth, (req, res) => res.json({ user: req.user.toSafeJSON() }));

export default router;
