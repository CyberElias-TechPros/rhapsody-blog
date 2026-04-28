import { connectDB } from '../config/db.js';
import { seedChannels } from '../services/seed.js';
import { syncAllChannels } from '../services/telegramSync.js';

(async () => {
  await connectDB();
  await seedChannels();
  const results = await syncAllChannels();
  console.log(JSON.stringify(results, null, 2));
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
