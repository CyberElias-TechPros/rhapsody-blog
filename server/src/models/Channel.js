import mongoose from 'mongoose';

const channelSchema = new mongoose.Schema(
  {
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
    name: { type: String, required: true },
    username: { type: String, required: true, unique: true, trim: true },
    description: { type: String, default: '' },
    accent: { type: String, default: 'from-primary to-primary-glow' },
    isActive: { type: Boolean, default: true },
    lastSyncedAt: { type: Date },
    lastMessageId: { type: Number, default: 0 },
    postCount: { type: Number, default: 0 },
  },
  { timestamps: true }
);

export const Channel = mongoose.model('Channel', channelSchema);
