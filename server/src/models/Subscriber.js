import mongoose from 'mongoose';

const subscriberSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
    channels: [{ type: String }], // channel slugs
    confirmed: { type: Boolean, default: false },
    unsubscribedAt: { type: Date },
  },
  { timestamps: true }
);

export const Subscriber = mongoose.model('Subscriber', subscriberSchema);
