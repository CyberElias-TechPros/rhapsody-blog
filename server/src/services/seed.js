import { Channel } from '../models/Channel.js';
import { User } from '../models/User.js';
import { config } from '../config/index.js';

const DEFAULT_CHANNELS = [
  { slug: 'rhapsody-of-realities', name: 'Rhapsody of Realities', username: 'rhapsody_of_realities',
    description: 'Daily devotionals from the world\'s #1 daily devotional.', accent: 'from-primary to-primary-glow' },
  { slug: 'pastor-chris-teachings', name: 'Pastor Chris Teachings', username: 'PastorChrisOyakhilomeMessageText',
    description: 'Inspired teachings from Pastor Chris Oyakhilome.', accent: 'from-amber-600 to-orange-500' },
  { slug: 'pastor-chris-books', name: 'Pastor Chris Books', username: 'pastorchrisbooks',
    description: 'Excerpts from Pastor Chris\' transformative books.', accent: 'from-rose-600 to-amber-500' },
  { slug: 'rhapsody-library', name: 'Rhapsody of Realities Library', username: 'rhapsodylibrary',
    description: 'A growing library of resources, testimonies and editions.', accent: 'from-emerald-600 to-amber-500' },
  { slug: 'classic-gospel-music', name: 'Classic Gospel Music', username: 'classicgospelmusic',
    description: 'Timeless gospel music to lift your spirit every day.', accent: 'from-indigo-600 to-primary-glow' },
];

export const seedChannels = async () => {
  for (const c of DEFAULT_CHANNELS) {
    await Channel.updateOne({ slug: c.slug }, { $setOnInsert: c }, { upsert: true });
  }
};

export const ensureAdmin = async () => {
  const exists = await User.findOne({ role: 'admin' });
  if (exists) return;
  const admin = new User({ name: 'Administrator', email: config.adminEmail, role: 'admin' });
  await admin.setPassword(config.adminPassword);
  await admin.save();
  console.log(`✓ Default admin created: ${config.adminEmail}`);
};
