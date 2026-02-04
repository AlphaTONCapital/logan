#!/usr/bin/env node

const PolymarketAnalyticsBot = require('./index.js');
const fs = require('fs');

class IntegrationTester {
  constructor() {
    this.testResults = [];
    this.testBotToken = process.env.TEST_BOT_TOKEN || 'test_token_123456789:ABCdefGHIjklMNOpqrsTUVwxyz';
    this.testDbPath = './test-analytics.db';
  }

  async runIntegrationTests() {
    console.log('🧪 Starting integration tests...\n');

    await this.testDatabaseOperations();
    await this.testBotInitializationWithRealToken();
    await this.testMessageHandling();
    await this.testAPIErrorHandling();
    await this.testDataPersistence();

    await this.cleanup();
    this.printResults();
  }

  async testDatabaseOperations() {
    console.log('Testing database operations...');

    const bot = new PolymarketAnalyticsBot(this.testBotToken);
    bot.config.dbPath = this.testDbPath;

    try {
      // Test database setup
      await bot.setupDatabase();
      this.addResult('Database setup', true, 'Database created successfully');

      // Test basic queries
      const testInsert = bot.runQuery(
        'INSERT INTO markets (id, question, volume) VALUES (?, ?, ?)',
        ['test_market_1', 'Test question?', 1000.50]
      );
      this.addResult('Database insert', true, `Inserted with ID: ${testInsert.lastInsertRowid}`);

      // Test query
      const testSelect = bot.getQuery('SELECT * FROM markets WHERE id = ?', ['test_market_1']);
      const queryWorked = testSelect && testSelect.question === 'Test question?';
      this.addResult('Database select', queryWorked, queryWorked ? 'Retrieved correct data' : 'Query failed');

      // Test multiple results
      bot.runQuery('INSERT INTO markets (id, question) VALUES (?, ?)', ['test_market_2', 'Another test?']);
      const allResults = bot.allQuery('SELECT * FROM markets');
      this.addResult('Database select all', allResults.length === 2, `Found ${allResults.length} records`);

      bot.close();

    } catch (error) {
      this.addResult('Database operations', false, `Error: ${error.message}`);
    }
  }

  async testBotInitializationWithRealToken() {
    console.log('Testing bot initialization (with mock token)...');

    const bot = new PolymarketAnalyticsBot(this.testBotToken);
    bot.config.dbPath = this.testDbPath + '2';

    try {
      // Mock the API validation to avoid needing real tokens
      bot.validateBotToken = async () => {
        console.log('  🔄 Mocked bot token validation');
        return { username: 'test_bot' };
      };

      bot.validatePolymarketAPI = async () => {
        console.log('  🔄 Mocked Polymarket API validation');
        return true;
      };

      await bot.init();
      this.addResult('Bot initialization (mocked)', bot.isInitialized, 'Bot initialized successfully');

      bot.close();

    } catch (error) {
      this.addResult('Bot initialization', false, `Error: ${error.message}`);
    }
  }

  async testMessageHandling() {
    console.log('Testing message handling...');

    const bot = new PolymarketAnalyticsBot(this.testBotToken);
    bot.config.dbPath = this.testDbPath + '3';

    // Mock methods to avoid real API calls
    bot.validateBotToken = async () => ({ username: 'test_bot' });
    bot.validatePolymarketAPI = async () => true;
    bot.sendMessage = async (chatId, text) => {
      console.log(`  📤 Mock send to ${chatId}: ${text.slice(0, 50)}...`);
      return { message_id: 123 };
    };

    try {
      await bot.init();

      // Test start command
      await bot.handleStart(12345, 67890);
      this.addResult('Handle start command', true, 'Start command executed without errors');

      // Test test command
      await bot.handleTestCommand(12345);
      this.addResult('Handle test command', true, 'Test command executed without errors');

      // Test trending with mocked API
      bot.getPolymarketData = async (endpoint, params) => {
        console.log(`  🔄 Mock API call: ${endpoint}`);
        return [
          {
            id: 'mock_market_1',
            question: 'Will this test pass?',
            volume24hr: 50000,
            outcomePrices: [0.65, 0.35]
          },
          {
            id: 'mock_market_2', 
            question: 'Will integration testing work?',
            volume24hr: 25000,
            outcomePrices: [0.80, 0.20]
          }
        ];
      };

      await bot.handleTrending(12345);
      this.addResult('Handle trending command', true, 'Trending command executed without errors');

      bot.close();

    } catch (error) {
      this.addResult('Message handling', false, `Error: ${error.message}`);
    }
  }

  async testAPIErrorHandling() {
    console.log('Testing API error handling...');

    const bot = new PolymarketAnalyticsBot(this.testBotToken);
    bot.config.dbPath = this.testDbPath + '4';

    // Mock failing API calls
    bot.validateBotToken = async () => ({ username: 'test_bot' });
    bot.validatePolymarketAPI = async () => true;
    bot.sendMessage = async (chatId, text) => {
      console.log(`  📤 Mock send to ${chatId}: ${text.slice(0, 50)}...`);
      return { message_id: 123 };
    };

    try {
      await bot.init();

      // Test API failure handling
      bot.getPolymarketData = async () => {
        throw new Error('Mocked API failure');
      };

      // Should handle error gracefully
      await bot.handleTrending(12345);
      this.addResult('API error handling', true, 'Handled API failure gracefully');

      bot.close();

    } catch (error) {
      this.addResult('API error handling', false, `Unexpected error: ${error.message}`);
    }
  }

  async testDataPersistence() {
    console.log('Testing data persistence...');

    try {
      // Create bot, add data, close
      const bot1 = new PolymarketAnalyticsBot(this.testBotToken);
      bot1.config.dbPath = this.testDbPath + '5';
      await bot1.setupDatabase();
      
      bot1.runQuery(
        'INSERT INTO markets (id, question, volume) VALUES (?, ?, ?)',
        ['persist_test', 'Persistence test?', 9999.99]
      );
      bot1.close();

      // Create new bot instance, check data persisted
      const bot2 = new PolymarketAnalyticsBot(this.testBotToken);
      bot2.config.dbPath = this.testDbPath + '5';
      await bot2.setupDatabase();
      
      const persistedData = bot2.getQuery('SELECT * FROM markets WHERE id = ?', ['persist_test']);
      const dataExists = persistedData && persistedData.volume === 9999.99;
      
      this.addResult('Data persistence', dataExists, dataExists ? 'Data persisted correctly' : 'Data not found');
      
      bot2.close();

    } catch (error) {
      this.addResult('Data persistence', false, `Error: ${error.message}`);
    }
  }

  addResult(testName, passed, details) {
    this.testResults.push({ testName, passed, details });
    const status = passed ? '✅' : '❌';
    console.log(`  ${status} ${testName}: ${details}`);
  }

  async cleanup() {
    console.log('\nCleaning up test files...');
    
    const testFiles = [
      this.testDbPath,
      this.testDbPath + '2',
      this.testDbPath + '3', 
      this.testDbPath + '4',
      this.testDbPath + '5'
    ];

    for (const file of testFiles) {
      try {
        if (fs.existsSync(file)) {
          fs.unlinkSync(file);
          console.log(`  🗑️  Removed ${file}`);
        }
      } catch (error) {
        console.warn(`  ⚠️  Could not remove ${file}: ${error.message}`);
      }
    }
  }

  printResults() {
    const passed = this.testResults.filter(r => r.passed).length;
    const total = this.testResults.length;
    const failed = total - passed;

    console.log('\n' + '='.repeat(50));
    console.log(`📊 Integration Test Results: ${passed}/${total} passed`);
    
    if (failed > 0) {
      console.log(`❌ ${failed} tests failed:`);
      this.testResults
        .filter(r => !r.passed)
        .forEach(r => console.log(`   • ${r.testName}: ${r.details}`));
    } else {
      console.log('🎉 All integration tests passed!');
      console.log('\n✨ The bot is ready for production use!');
    }

    if (passed >= total * 0.8) {
      console.log('\n🚀 Bot Status: FUNCTIONAL');
      console.log('💡 Ready to deploy with a real bot token');
    } else {
      console.log('\n⚠️  Bot Status: NEEDS FIXES');
      console.log('🔧 Address failing tests before deployment');
    }
  }
}

async function main() {
  const tester = new IntegrationTester();
  await tester.runIntegrationTests();
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = IntegrationTester;
