import cron from 'node-cron';
import { createApp } from './app.js';
import { connectDB } from './config/db.js';
import { config } from './config/index.js';
import { ensureAdmin, seedChannels } from './services/seed.js';
import { syncAllChannels } from './services/telegramSync.js';

const start = async () => {
  await connectDB();
  await seedChannels();
  await ensureAdmin();

  const app = createApp();
  app.listen(config.port, () => {
    console.log(`✓ API listening on http://localhost:${config.port}`);
  });

  // Background sync
  if (cron.validate(config.syncCron)) {
    cron.schedule(config.syncCron, async () => {
      console.log('⟳ Running scheduled Telegram sync…');
      try {
        const results = await syncAllChannels();
        const created = results.reduce((n, r) => n + (r.created || 0), 0);
        console.log(`✓ Sync complete — ${created} new posts`);
      } catch (e) {
        console.error('Sync error:', e.message);
      }
    });
    console.log(`✓ Sync scheduled (${config.syncCron})`);
  }
};

start().catch((e) => {
  console.error('Fatal startup error:', e);
  process.exit(1);
});
