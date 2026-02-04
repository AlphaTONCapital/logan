// Configuration management - externalized from main code
module.exports = {
  // Telegram settings
  telegram: {
    apiUrl: (token) => `https://api.telegram.org/bot${token}`,
    maxMessageLength: 4096,
    pollTimeout: 30,
    requestTimeout: 10000,
    rateLimits: {
      messagesPerSecond: 30,
      messagesPerChat: 1,
      retryDelay: 1000
    }
  },

  // Polymarket API settings  
  polymarket: {
    apiUrl: 'https://gamma-api.polymarket.com',
    requestTimeout: 15000,
    userAgent: 'PolymarketAnalyticsBot/2.0',
    rateLimits: {
      requestsPerSecond: 10,
      retryDelay: 2000
    }
  },

  // Database settings
  database: {
    path: process.env.DB_PATH || './analytics.db',
    pragma: {
      journal_mode: 'WAL',
      synchronous: 'NORMAL',
      cache_size: 1000,
      foreign_keys: 'ON'
    }
  },

  // Application settings
  app: {
    volumeThreshold: 1000,
    highVolumeThreshold: 10000,
    maxMarketsPerRequest: 25,
    maxRetries: 3,
    healthCheckInterval: 300000 // 5 minutes
  },

  // Environment-specific overrides
  production: {
    database: {
      path: '/data/analytics.db'
    },
    app: {
      healthCheckInterval: 60000 // 1 minute in production
    }
  },

  development: {
    app: {
      healthCheckInterval: 60000 // 1 minute in dev too
    }
  }
};
