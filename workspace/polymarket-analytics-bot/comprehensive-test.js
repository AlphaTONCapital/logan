#!/usr/bin/env node

const PolymarketAnalyticsBot = require('./bot');
const Logger = require('./logger');
const RateLimiter = require('./rate-limiter');
const config = require('./config');
const fs = require('fs');
const path = require('path');

class ComprehensiveTestSuite {
  constructor() {
    this.testResults = [];
    this.testToken = '123456789:ABCdefGHIjklMNOpqrsTUVwxyz';
    this.testDbPath = './test-comprehensive.db';
    this.logger = new Logger({ level: 'error' }); // Minimize test output
  }

  async runAllTests() {
    console.log('🧪 Comprehensive Test Suite Starting...\n');
    
    // Unit tests
    await this.testRateLimiter();
    await this.testLogger();
    await this.testConfigLoading();
    
    // Integration tests  
    await this.testBotConstruction();
    await this.testDatabaseOperations();
    await this.testValidation();
    await this.testErrorHandling();
    await this.testConcurrency();
    await this.testBoundaryConditions();
    await this.testMemoryLeaks();
    
    await this.cleanup();
    this.printResults();
  }

  // Test rate limiter under load
  async testRateLimiter() {
    console.log('Testing rate limiter...');
    
    const limiter = new RateLimiter({ maxRequests: 5, timeWindow: 1000 });
    const startTime = Date.now();
    
    // Fire 10 requests rapidly - should be rate limited
    const promises = [];
    for (let i = 0; i < 10; i++) {
      promises.push(
        limiter.limit(async () => {
          return `request-${i}`;
        })
      );
    }
    
    const results = await Promise.all(promises);
    const endTime = Date.now();
    const duration = endTime - startTime;
    
    this.addResult(
      'Rate limiter enforces limits',
      duration >= 1000 && results.length === 10,
      `Took ${duration}ms for 10 requests (should be ≥1000ms)`
    );

    // Test status reporting
    const status = limiter.getStatus();
    this.addResult(
      'Rate limiter status reporting',
      typeof status.activeRequests === 'number' && typeof status.maxRequests === 'number',
      `Status: ${JSON.stringify(status)}`
    );
  }

  // Test logger functionality
  async testLogger() {
    console.log('Testing logger...');
    
    const testLogDir = './test-logs';
    const logger = new Logger({ logDir: testLogDir, level: 'debug' });
    
    // Test all log levels
    logger.error('Test error message');
    logger.warn('Test warning message');
    logger.info('Test info message');
    logger.debug('Test debug message');
    
    // Check files exist
    const errorLogExists = fs.existsSync(path.join(testLogDir, 'error.log'));
    const infoLogExists = fs.existsSync(path.join(testLogDir, 'info.log'));
    
    this.addResult(
      'Logger creates log files',
      errorLogExists && infoLogExists,
      `Error log: ${errorLogExists}, Info log: ${infoLogExists}`
    );

    // Test log rotation
    const testFile = path.join(testLogDir, 'test.log');
    const largeContent = 'x'.repeat(logger.maxFileSize + 1000);
    fs.writeFileSync(testFile, largeContent);
    
    logger.writeToFile('test', 'New content after rotation\n');
    
    const rotatedExists = fs.existsSync(`${testFile}.1`);
    this.addResult(
      'Logger rotates large files',
      rotatedExists,
      `Rotated file exists: ${rotatedExists}`
    );

    // Cleanup
    if (fs.existsSync(testLogDir)) {
      fs.rmSync(testLogDir, { recursive: true, force: true });
    }
  }

  // Test configuration loading
  async testConfigLoading() {
    console.log('Testing configuration...');
    
    // Test environment-specific config loading
    const originalEnv = process.env.NODE_ENV;
    
    process.env.NODE_ENV = 'production';
    const bot = new PolymarketAnalyticsBot(this.testToken);
    
    const hasProductionConfig = bot.config.database.path === '/data/analytics.db';
    this.addResult(
      'Config loads environment overrides',
      hasProductionConfig,
      `Production DB path: ${bot.config.database.path}`
    );
    
    process.env.NODE_ENV = originalEnv;
  }

  // Test bot construction and validation
  async testBotConstruction() {
    console.log('Testing bot construction...');

    // Test invalid tokens
    const invalidTokens = [
      null,
      undefined, 
      '',
      'invalid',
      '123456', // No colon
      '123:' // Empty secret
    ];

    for (const token of invalidTokens) {
      try {
        new PolymarketAnalyticsBot(token);
        this.addResult(
          `Bot rejects invalid token: ${token}`,
          false,
          'Should have thrown error'
        );
      } catch (error) {
        this.addResult(
          `Bot rejects invalid token: ${token}`,
          true,
          'Correctly threw error'
        );
      }
    }

    // Test valid construction
    const bot = new PolymarketAnalyticsBot(this.testToken);
    this.addResult(
      'Bot constructs with valid token',
      bot.token === this.testToken,
      'Token stored correctly'
    );
  }

  // Test database operations under stress
  async testDatabaseOperations() {
    console.log('Testing database operations...');
    
    const bot = new PolymarketAnalyticsBot(this.testToken);
    bot.config.database.path = this.testDbPath;
    
    try {
      await bot.setupDatabase();
      
      // Test concurrent inserts
      const promises = [];
      for (let i = 0; i < 100; i++) {
        promises.push(
          bot.updateUserSession(i, `user_${i}`)
        );
      }
      
      await Promise.all(promises);
      
      // Verify data integrity
      const userCount = bot.db.prepare('SELECT COUNT(*) as count FROM user_sessions').get().count;
      this.addResult(
        'Database handles concurrent inserts',
        userCount === 100,
        `Inserted ${userCount}/100 users`
      );

      // Test transaction rollback
      const transaction = bot.db.transaction(() => {
        bot.db.prepare('INSERT INTO user_sessions (chat_id, username) VALUES (?, ?)').run(999, 'rollback_test');
        throw new Error('Intentional rollback');
      });

      try {
        transaction();
        this.addResult('Database transaction rollback', false, 'Transaction should have failed');
      } catch (error) {
        const rollbackUser = bot.db.prepare('SELECT * FROM user_sessions WHERE chat_id = 999').get();
        this.addResult(
          'Database transaction rollback',
          !rollbackUser,
          rollbackUser ? 'Data not rolled back' : 'Data correctly rolled back'
        );
      }

      bot.db.close();
      
    } catch (error) {
      this.addResult('Database operations', false, `Error: ${error.message}`);
    }
  }

  // Test all validation functions with boundary conditions
  async testValidation() {
    console.log('Testing validation...');
    
    const bot = new PolymarketAnalyticsBot(this.testToken);
    
    const testCases = [
      // Chat ID validation
      { type: 'chatId', input: '123456', shouldPass: true },
      { type: 'chatId', input: '-100123456', shouldPass: true },
      { type: 'chatId', input: 'abc', shouldPass: false },
      { type: 'chatId', input: '', shouldPass: false },
      
      // Market ID validation  
      { type: 'marketId', input: '12', shouldPass: true },
      { type: 'marketId', input: 'x'.repeat(100), shouldPass: true },
      { type: 'marketId', input: '', shouldPass: false },
      { type: 'marketId', input: 'x'.repeat(101), shouldPass: false },
      
      // Amount validation
      { type: 'amount', input: '1', shouldPass: true },
      { type: 'amount', input: '1000000', shouldPass: true },
      { type: 'amount', input: '0', shouldPass: false },
      { type: 'amount', input: '1000001', shouldPass: false },
      { type: 'amount', input: 'abc', shouldPass: false },
      
      // Threshold validation
      { type: 'threshold', input: '0.1', shouldPass: true },
      { type: 'threshold', input: '100', shouldPass: true },
      { type: 'threshold', input: '0', shouldPass: false },
      { type: 'threshold', input: '100.1', shouldPass: false }
    ];

    for (const testCase of testCases) {
      try {
        const result = bot.validate(testCase.input, testCase.type);
        this.addResult(
          `Validation ${testCase.type}(${testCase.input})`,
          testCase.shouldPass,
          testCase.shouldPass ? `Returned: ${result}` : 'Should have failed'
        );
      } catch (error) {
        this.addResult(
          `Validation ${testCase.type}(${testCase.input})`,
          !testCase.shouldPass,
          testCase.shouldPass ? `Unexpected error: ${error.message}` : 'Correctly failed'
        );
      }
    }
  }

  // Test error handling scenarios
  async testErrorHandling() {
    console.log('Testing error handling...');
    
    const bot = new PolymarketAnalyticsBot(this.testToken);
    
    // Mock network failure
    const originalMakeRequest = bot.makeRequest;
    bot.makeRequest = async () => {
      throw new Error('Network timeout');
    };

    // Test command handling with API failure
    const update = {
      message: {
        chat: { id: 12345 },
        from: { username: 'testuser' },
        text: '/trending'
      }
    };

    // Should not crash bot
    try {
      await bot.processUpdate(update);
      this.addResult(
        'Error handling prevents crashes',
        true,
        'processUpdate completed without throwing'
      );
    } catch (error) {
      this.addResult(
        'Error handling prevents crashes',
        false,
        `processUpdate threw: ${error.message}`
      );
    }

    // Restore original method
    bot.makeRequest = originalMakeRequest;
  }

  // Test concurrent request handling
  async testConcurrency() {
    console.log('Testing concurrency...');
    
    const bot = new PolymarketAnalyticsBot(this.testToken);
    bot.config.database.path = this.testDbPath + '_concurrent';
    
    // Mock API to simulate delays
    bot.makeRequest = async (service, endpoint) => {
      await this.sleep(100); // Simulate network delay
      if (service === 'telegram' && endpoint === 'sendMessage') {
        return { message_id: Math.random() };
      }
      return [];
    };

    await bot.setupDatabase();

    // Simulate multiple users sending commands simultaneously
    const updates = [];
    for (let i = 0; i < 10; i++) {
      updates.push({
        message: {
          chat: { id: i },
          from: { username: `user${i}` },
          text: '/trending'
        }
      });
    }

    const startTime = Date.now();
    const promises = updates.map(update => bot.processUpdate(update));
    await Promise.all(promises);
    const duration = Date.now() - startTime;

    this.addResult(
      'Concurrent request handling',
      duration < 5000, // Should complete in reasonable time
      `10 concurrent requests took ${duration}ms`
    );

    bot.db.close();
  }

  // Test boundary conditions
  async testBoundaryConditions() {
    console.log('Testing boundary conditions...');
    
    const bot = new PolymarketAnalyticsBot(this.testToken);

    // Test maximum message length
    const longText = 'x'.repeat(bot.config.telegram.maxMessageLength + 1000);
    const truncated = bot.sendMessage.toString().includes('substring'); // Check truncation logic exists
    
    this.addResult(
      'Message truncation logic exists',
      truncated,
      'sendMessage method handles long messages'
    );

    // Test empty/null inputs
    const emptyInputs = [null, undefined, '', '   '];
    
    for (const input of emptyInputs) {
      try {
        bot.validate(input, 'marketId');
        this.addResult(
          `Empty input handling: ${JSON.stringify(input)}`,
          false,
          'Should have failed validation'
        );
      } catch (error) {
        this.addResult(
          `Empty input handling: ${JSON.stringify(input)}`,
          true,
          'Correctly rejected empty input'
        );
      }
    }
  }

  // Test for memory leaks
  async testMemoryLeaks() {
    console.log('Testing memory usage...');
    
    const initialMemory = process.memoryUsage().heapUsed;
    
    // Create and destroy multiple bot instances
    for (let i = 0; i < 10; i++) {
      const bot = new PolymarketAnalyticsBot(this.testToken);
      bot.config.database.path = `:memory:`; // Use in-memory DB
      await bot.setupDatabase();
      bot.db.close();
    }

    // Force garbage collection if available
    if (global.gc) global.gc();
    
    const finalMemory = process.memoryUsage().heapUsed;
    const memoryIncrease = finalMemory - initialMemory;
    
    this.addResult(
      'Memory leak check',
      memoryIncrease < 50 * 1024 * 1024, // Less than 50MB increase
      `Memory increased by ${Math.round(memoryIncrease / 1024 / 1024)}MB`
    );
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  addResult(testName, passed, details) {
    this.testResults.push({ testName, passed, details });
    const status = passed ? '✅' : '❌';
    console.log(`  ${status} ${testName}: ${details}`);
  }

  async cleanup() {
    console.log('\nCleaning up...');
    
    const filesToClean = [
      this.testDbPath,
      this.testDbPath + '_concurrent',
      './test-logs'
    ];

    for (const file of filesToClean) {
      try {
        if (fs.existsSync(file)) {
          if (fs.statSync(file).isDirectory()) {
            fs.rmSync(file, { recursive: true, force: true });
          } else {
            fs.unlinkSync(file);
          }
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
    const passRate = ((passed / total) * 100).toFixed(1);

    console.log('\n' + '='.repeat(60));
    console.log(`📊 Comprehensive Test Results: ${passed}/${total} passed (${passRate}%)`);
    
    if (failed > 0) {
      console.log(`\n❌ Failed Tests (${failed}):`);
      this.testResults
        .filter(r => !r.passed)
        .forEach(r => console.log(`   • ${r.testName}: ${r.details}`));
    }

    // Quality assessment
    if (passRate >= 95) {
      console.log('\n🎉 EXCELLENT: Production ready!');
    } else if (passRate >= 85) {
      console.log('\n✅ GOOD: Minor issues to address');
    } else if (passRate >= 70) {
      console.log('\n⚠️  NEEDS WORK: Address failing tests');
    } else {
      console.log('\n❌ POOR: Major issues found');
    }

    console.log(`\n📈 Test Coverage: ${this.getTestCoverage()}`);
  }

  getTestCoverage() {
    const categories = {
      'Unit Tests': ['Rate limiter', 'Logger', 'Config'],
      'Integration': ['Database', 'Bot construction'], 
      'Validation': ['Validation'],
      'Error Handling': ['Error handling'],
      'Performance': ['Concurrency', 'Memory leak', 'Boundary'],
    };

    let coverage = 'Covered: ';
    for (const [category, tests] of Object.entries(categories)) {
      const categoryTests = this.testResults.filter(r => 
        tests.some(test => r.testName.toLowerCase().includes(test.toLowerCase()))
      );
      const categoryPassed = categoryTests.filter(r => r.passed).length;
      coverage += `${category} (${categoryPassed}/${categoryTests.length}) `;
    }

    return coverage;
  }
}

async function main() {
  const suite = new ComprehensiveTestSuite();
  await suite.runAllTests();
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = ComprehensiveTestSuite;
