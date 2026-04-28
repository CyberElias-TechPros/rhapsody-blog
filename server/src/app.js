import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import { config } from './config/index.js';
import authRoutes from './routes/auth.js';
import channelRoutes from './routes/channels.js';
import postRoutes from './routes/posts.js';
import adminRoutes from './routes/admin.js';
import subscriberRoutes from './routes/subscribers.js';
import { errorHandler, notFound } from './middleware/error.js';

export const createApp = () => {
  const app = express();

  app.use(helmet());
  app.use(cors({ origin: config.clientOrigin, credentials: true }));
  app.use(express.json({ limit: '1mb' }));
  app.use(morgan(config.nodeEnv === 'production' ? 'combined' : 'dev'));

  app.use('/api/', rateLimit({ windowMs: 60_000, max: 120, standardHeaders: true, legacyHeaders: false }));
  app.use('/api/auth/', rateLimit({ windowMs: 15 * 60_000, max: 20 }));

  app.get('/api/health', (_req, res) => res.json({ ok: true, ts: new Date().toISOString() }));

  app.use('/api/auth', authRoutes);
  app.use('/api/channels', channelRoutes);
  app.use('/api/posts', postRoutes);
  app.use('/api/admin', adminRoutes);
  app.use('/api/subscribers', subscriberRoutes);

  app.use(notFound);
  app.use(errorHandler);

  return app;
};
