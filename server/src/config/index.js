import 'dotenv/config';

export const config = {
  port: parseInt(process.env.PORT || '4000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  mongoUri: process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/meaning',
  clientOrigin: process.env.CLIENT_ORIGIN || 'http://localhost:8080',
  jwtSecret: process.env.JWT_SECRET || 'dev-secret-change-me',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  telegramChannels: (process.env.TELEGRAM_CHANNELS ||
    'rhapsody_of_realities,PastorChrisOyakhilomeMessageText,pastorchrisbooks,rhapsodylibrary,classicgospelmusic'
  ).split(',').map(s => s.trim()).filter(Boolean),
  syncCron: process.env.SYNC_CRON || '*/15 * * * *',
  adminEmail: process.env.ADMIN_EMAIL || 'admin@meaning.app',
  adminPassword: process.env.ADMIN_PASSWORD || 'ChangeMe!2025',
};
