#!/usr/bin/env node

const axios = require('axios');
const Database = require('better-sqlite3');
const config = require('./config');
const Logger = require('./logger');
const RateLimiter = require('./rate-limiter');

class PolymarketAnalyticsBot {
  constructor(botToken) {
    this.validateBotToken(botToken);
    
    this.token = botToken;
    this.offset = 0;
    this.isRunning = false;
    this.config = this.loadConfig();
    
    // Initialize services
    this.logger = new Logger({ level: process.env.LOG_LEVEL || 'info' });
    this.telegramLimiter = new RateLimiter({ 
      maxRequests: this.config.telegram.rateLimits.messagesPerSecond,
      timeWindow: 1000 
    });
    this.polymarketLimiter = new RateLimiter({ 
      maxRequests: this.config.polymarket.rateLimits.requestsPerSecond,
      timeWindow: 1000 
    });
    
    this.db = null;
    this.setupGracefulShutdown();
  }

  validateBotToken(token) {
    // FIXED: More strict token validation
    if (!token || typeof token !== 'string') {
      throw new Error('Bot token must be a string');
    }
    
    const parts = token.split(':');
    if (parts.length !== 2 || !parts[0] || !parts[1] || parts[1].length < 10) {
      throw new Error('Invalid bot token format (must be "botId:secretToken" with valid secret)');
    }
    
    if (!/^\d+$/.test(parts[0])) {
      throw new Error('Invalid bot ID (must be numeric)');
    }
  }

  loadConfig() {
    const env = process.env.NODE_ENV || 'development';
    const baseConfig = { ...config };
    
    if (config[env]) {
      this.deepMerge(baseConfig, config[env]);
    }
    
    return baseConfig;
  }

  deepMerge(target, source) {
    for (const key in source) {
      if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
        target[key] = target[key] || {};
        this.deepMerge(target[key], source[key]);
      } else {
        target[key] = source[key];
      }
    }
  }

  async init() {
    try {
      this.logger.info('Initializing bot...');
      
      await this.setupDatabase();
      await this.validateAPIs();
      
      this.logger.info('Bot initialization complete');
      return true;
    } catch (error) {
      this.logger.error('Bot initialization failed', { error: error.message });
      throw error;
    }
  }

  async setupDatabase() {
    const dbPath = this.config.database.path;
    this.db = new Database(dbPath);
    
    // Apply pragma settings for performance
    for (const [pragma, value] of Object.entries(this.config.database.pragma)) {
      this.db.pragma(`${pragma} = ${value}`);
    }

    this.createTables();
    this.logger.info('Database setup complete', { path: dbPath });
  }

  createTables() {
    const schemas = [
      `CREATE TABLE IF NOT EXISTS markets (
        id TEXT PRIMARY KEY,
        question TEXT NOT NULL,
        end_date TEXT NOT NULL,
        category TEXT,
        liquidity REAL DEFAULT 0,
        outcomes TEXT, -- JSON array
        active INTEGER DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`,
      `CREATE TABLE IF NOT EXISTS user_sessions (
        chat_id INTEGER PRIMARY KEY,
        username TEXT,
        first_seen DATETIME DEFAULT CURRENT_TIMESTAMP,
        last_active DATETIME DEFAULT CURRENT_TIMESTAMP,
        command_count INTEGER DEFAULT 0
      )`,
      `CREATE TABLE IF NOT EXISTS portfolio (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        chat_id INTEGER NOT NULL,
        market_id TEXT NOT NULL,
        position TEXT NOT NULL,
        entry_price REAL NOT NULL,
        quantity INTEGER NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (chat_id) REFERENCES user_sessions (chat_id)
      )`
    ];

    const transaction = this.db.transaction(() => {
      schemas.forEach(schema => this.db.exec(schema));
    });
    
    transaction();

    // Create indexes for performance
    this.db.exec('CREATE INDEX IF NOT EXISTS idx_markets_active ON markets(active, liquidity DESC)');
    this.db.exec('CREATE INDEX IF NOT EXISTS idx_portfolio_user ON portfolio(chat_id, created_at DESC)');
  }

  async validateAPIs() {
    // Validate Telegram API
    try {
      const response = await this.makeRequest('telegram', 'getMe');
      this.logger.info('Telegram API validated', { username: response.username });
    } catch (error) {
      throw new Error(`Telegram API validation failed: ${error.message}`);
    }

    // Test Polymarket API
    try {
      await this.makeRequest('polymarket', 'markets', { limit: 1 });
      this.logger.info('Polymarket API validated');
    } catch (error) {
      this.logger.warn('Polymarket API validation failed', { error: error.message });
    }
  }

  async makeRequest(service, endpoint, params = {}) {
    const limiter = service === 'telegram' ? this.telegramLimiter : this.polymarketLimiter;
    const serviceConfig = this.config[service];

    return limiter.limit(async () => {
      let url;
      if (service === 'telegram') {
        url = `${serviceConfig.apiUrl(this.token)}/${endpoint}`;
      } else {
        url = `${serviceConfig.apiUrl}/${endpoint}`;
      }

      const response = await axios({
        method: endpoint === 'sendMessage' ? 'POST' : 'GET',
        url,
        params: endpoint !== 'sendMessage' ? params : undefined,
        data: endpoint === 'sendMessage' ? params : undefined,
        timeout: serviceConfig.requestTimeout,
        headers: service === 'polymarket' ? { 'User-Agent': serviceConfig.userAgent } : undefined
      });

      if (service === 'telegram' && !response.data.ok) {
        throw new Error(response.data.description || 'Telegram API error');
      }

      return service === 'telegram' ? response.data.result : response.data;
    });
  }

  // FIXED: More strict validation with proper whitespace handling
  validate(input, type, constraints = {}) {
    const validators = {
      chatId: (val) => {
        const id = parseInt(val);
        if (isNaN(id)) throw new Error('Invalid chat ID');
        return id;
      },
      marketId: (val) => {
        if (!val || typeof val !== 'string') {
          throw new Error('Market ID must be a string');
        }
        
        const trimmed = val.trim();
        if (trimmed.length === 0) {
          throw new Error('Market ID cannot be empty or whitespace');
        }
        
        if (trimmed.length < 1 || trimmed.length > 100) {
          throw new Error('Market ID must be 1-100 characters');
        }
        
        return trimmed;
      },
      amount: (val) => {
        const num = parseInt(val);
        if (isNaN(num) || num <= 0 || num > (constraints.max || 1000000)) {
          throw new Error(`Amount must be 1-${constraints.max || 1000000}`);
        }
        return num;
      },
      threshold: (val) => {
        const num = parseFloat(val);
        if (isNaN(num) || num <= 0 || num > 100) {
          throw new Error('Threshold must be 0.1-100%');
        }
        return num;
      }
    };

    return validators[type](input);
  }

  async updateUserSession(chatId, username = null) {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO user_sessions (chat_id, username, last_active, command_count)
      VALUES (?, ?, CURRENT_TIMESTAMP, 
        COALESCE((SELECT command_count FROM user_sessions WHERE chat_id = ?), 0) + 1)
    `);
    
    stmt.run(chatId, username, chatId);
  }

  async sendMessage(chatId, text, options = {}) {
    // Truncate long messages
    if (text.length > this.config.telegram.maxMessageLength) {
      text = text.substring(0, this.config.telegram.maxMessageLength - 4) + '...';
    }

    const params = {
      chat_id: this.validate(chatId, 'chatId'),
      text,
      parse_mode: 'HTML',
      ...options
    };

    try {
      return await this.makeRequest('telegram', 'sendMessage', params);
    } catch (error) {
      this.logger.error('Send message failed', { chatId, error: error.message });
      throw error;
    }
  }

  async getMarkets(options = {}) {
    const params = {
      limit: Math.min(options.limit || this.config.app.maxMarketsPerRequest, 50),
      ...options
    };

    return this.makeRequest('polymarket', 'markets', params);
  }

  async handleStart(chatId, username) {
    await this.updateUserSession(chatId, username);

    const message = `
🎯 <b>Polymarket Analytics Bot v2.0</b>

Professional prediction market analysis without the risk!

<b>📊 Commands:</b>
/trending - Hot markets by liquidity
/latest - Newest markets
/market [id] - Detailed analysis
/status - Bot health check

<b>🎯 Coming Soon:</b>
Paper trading, alerts, watchlists

Get started with /trending! 🚀`;

    return this.sendMessage(chatId, message);
  }

  async handleTrending(chatId) {
    try {
      const markets = await this.getMarkets({ limit: 25 });
      
      if (!Array.isArray(markets) || markets.length === 0) {
        return this.sendMessage(chatId, '📊 No markets found at the moment.');
      }

      // Filter active markets and sort by liquidity
      const activeMarkets = markets
        .filter(m => new Date(m.endDate) > new Date())
        .sort((a, b) => parseFloat(b.liquidity || 0) - parseFloat(a.liquidity || 0))
        .slice(0, 10);

      if (activeMarkets.length === 0) {
        return this.sendMessage(chatId, '📊 No active markets with liquidity found.');
      }

      let message = '🔥 <b>Top Markets by Liquidity</b>\n\n';
      
      activeMarkets.forEach((market, index) => {
        const liquidity = parseFloat(market.liquidity || 0);
        const question = market.question.slice(0, 60);
        const endDate = new Date(market.endDate).toLocaleDateString();
        
        message += `${index + 1}. <b>${question}${question.length === 60 ? '...' : ''}</b>\n`;
        message += `   💰 $${liquidity.toLocaleString()}\n`;
        message += `   📅 ${endDate}\n`;
        message += `   /market_${market.id}\n\n`;
      });

      return this.sendMessage(chatId, message);

    } catch (error) {
      this.logger.error('Trending command failed', { chatId, error: error.message });
      return this.sendMessage(chatId, '❌ Unable to fetch markets. Please try again later.');
    }
  }

  async handleStatus(chatId) {
    const telegramStatus = this.telegramLimiter.getStatus();
    const polymarketStatus = this.polymarketLimiter.getStatus();
    
    // Test database
    let dbStatus = 'OK';
    try {
      this.db.exec('SELECT 1');
    } catch (error) {
      dbStatus = `ERROR: ${error.message}`;
    }

    // Get user stats
    const userCount = this.db.prepare('SELECT COUNT(*) as count FROM user_sessions').get().count;
    const marketCount = this.db.prepare('SELECT COUNT(*) as count FROM markets').get().count;

    const message = `
🏥 <b>Bot Health Status</b>

<b>📊 Database:</b> ${dbStatus}
<b>👥 Users:</b> ${userCount}
<b>📈 Markets Cached:</b> ${marketCount}

<b>🚦 Rate Limits:</b>
• Telegram: ${telegramStatus.available}/${telegramStatus.maxRequests}
• Polymarket: ${polymarketStatus.available}/${polymarketStatus.maxRequests}

<b>📋 Queue:</b>
• Telegram: ${telegramStatus.queueLength}
• Polymarket: ${polymarketStatus.queueLength}

<b>💾 Memory:</b> ${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB

🎯 Status: ${dbStatus === 'OK' ? 'HEALTHY' : 'DEGRADED'}`;

    return this.sendMessage(chatId, message);
  }

  // FIXED: Better error handling that prevents crashes
  async processUpdate(update) {
    if (!update.message || !update.message.text) return;

    const { message } = update;
    const chatId = message.chat.id;
    const text = message.text;
    const username = message.from.username;

    if (!text.startsWith('/')) return;

    const [command, ...args] = text.slice(1).split(' ');
    
    this.logger.debug('Processing command', { command, chatId, username });

    try {
      switch (command.toLowerCase()) {
        case 'start':
        case 'help':
          await this.handleStart(chatId, username);
          break;
        case 'trending':
          await this.handleTrending(chatId);
          break;
        case 'status':
          await this.handleStatus(chatId);
          break;
        default:
          if (command.startsWith('market_')) {
            const marketId = command.replace('market_', '');
            await this.sendMessage(chatId, `🚧 Market analysis for ${marketId} coming soon!`);
          } else {
            await this.sendMessage(chatId, '❌ Unknown command. Use /help for available commands.');
          }
      }
    } catch (error) {
      this.logger.error('Command processing failed', { 
        command, 
        chatId, 
        error: error.message 
      });
      
      // FIXED: Always try to send error message, but don't throw if it fails
      try {
        await this.sendMessage(chatId, '❌ Something went wrong. Please try again later.');
      } catch (sendError) {
        this.logger.error('Failed to send error message', { chatId, error: sendError.message });
        // Don't throw - bot continues running
      }
    }
  }

  async startPolling() {
    if (this.isRunning) return;
    
    this.isRunning = true;
    this.logger.info('Starting bot polling');

    while (this.isRunning) {
      try {
        const updates = await this.makeRequest('telegram', 'getUpdates', {
          offset: this.offset,
          timeout: this.config.telegram.pollTimeout,
          allowed_updates: ['message']
        });

        for (const update of updates) {
          await this.processUpdate(update);
          this.offset = update.update_id + 1;
        }

      } catch (error) {
        this.logger.error('Polling error', { error: error.message });
        await this.sleep(5000);
      }
    }
  }

  async stop() {
    this.logger.info('Stopping bot...');
    this.isRunning = false;
    
    if (this.db) {
      this.db.close();
      this.logger.info('Database closed');
    }
  }

  setupGracefulShutdown() {
    const shutdown = () => {
      this.stop().then(() => process.exit(0));
    };

    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = PolymarketAnalyticsBot;
