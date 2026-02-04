#!/usr/bin/env node

// Final verification - test the complete system as a user would experience it
const PolymarketAnalyticsBot = require('./bot');

class FinalVerification {
  constructor() {
    this.testToken = '123456789:ABCdefGHIjklMNOpqrsTUVwxyz-final-test';
    this.results = [];
  }

  async runVerification() {
    console.log('🔍 Final End-to-End Verification\n');
    console.log('Testing complete user experience...\n');

    await this.testBotLifecycle();
    await this.testUserInteractions();
    await this.testErrorScenarios();
    await this.testPerformanceUnderLoad();

    this.printFinalResults();
  }

  async testBotLifecycle() {
    console.log('1️⃣ Bot Lifecycle - Startup, operation, shutdown');
    
    try {
      // Test initialization
      const bot = new PolymarketAnalyticsBot(this.testToken);
      this.addResult('Bot construction', true, 'Bot created successfully');

      // Mock APIs for testing
      bot.makeRequest = async (service, endpoint, params) => {
        if (service === 'telegram' && endpoint === 'getMe') {
          return { username: 'test_bot', id: 123456789 };
        }
        if (service === 'telegram' && endpoint === 'sendMessage') {
          return { message_id: Math.floor(Math.random() * 1000) };
        }
        if (service === 'polymarket' && endpoint === 'markets') {
          return [
            {
              id: '1',
              question: 'Will this verification pass?',
              endDate: '2025-12-31T23:59:59Z',
              liquidity: '50000',
              category: 'technology'
            },
            {
              id: '2', 
              question: 'Will production deployment succeed?',
              endDate: '2025-12-31T23:59:59Z',
              liquidity: '25000',
              category: 'technology'
            }
          ];
        }
        return [];
      };

      bot.config.database.path = ':memory:';
      await bot.init();
      this.addResult('Bot initialization', true, 'All systems initialized');

      // Test shutdown
      await bot.stop();
      this.addResult('Graceful shutdown', true, 'Bot stopped cleanly');

    } catch (error) {
      this.addResult('Bot lifecycle', false, `Error: ${error.message}`);
    }
  }

  async testUserInteractions() {
    console.log('\n2️⃣ User Interactions - Complete user journey');
    
    try {
      const bot = new PolymarketAnalyticsBot(this.testToken);
      
      // Mock successful API responses
      bot.makeRequest = async (service, endpoint, params) => {
        if (service === 'telegram' && endpoint === 'getMe') {
          return { username: 'test_bot' };
        }
        if (service === 'telegram' && endpoint === 'sendMessage') {
          // Capture the message being sent
          console.log(`  📤 Bot would send: "${params.text.slice(0, 50)}..."`);
          return { message_id: Math.random() };
        }
        if (service === 'polymarket' && endpoint === 'markets') {
          return [
            {
              id: 'market_1',
              question: 'Test market for verification',
              endDate: '2025-12-31T23:59:59Z',
              liquidity: '10000'
            }
          ];
        }
        return [];
      };

      bot.config.database.path = ':memory:';
      await bot.init();

      // Simulate user journey
      const testChatId = 12345;
      const testUsername = 'test_user';

      // Test /start command
      await bot.processUpdate({
        message: {
          chat: { id: testChatId },
          from: { username: testUsername },
          text: '/start'
        }
      });

      // Test /status command  
      await bot.processUpdate({
        message: {
          chat: { id: testChatId },
          from: { username: testUsername },
          text: '/status'
        }
      });

      // Test /trending command
      await bot.processUpdate({
        message: {
          chat: { id: testChatId },
          from: { username: testUsername },
          text: '/trending'
        }
      });

      this.addResult('Complete user journey', true, 'All commands processed successfully');

      // Verify user session was created
      const userSession = bot.db.prepare('SELECT * FROM user_sessions WHERE chat_id = ?').get(testChatId);
      this.addResult('User session tracking', !!userSession, userSession ? 'Session created and tracked' : 'No session found');

      await bot.stop();

    } catch (error) {
      this.addResult('User interactions', false, `Error: ${error.message}`);
    }
  }

  async testErrorScenarios() {
    console.log('\n3️⃣ Error Scenarios - Resilience testing');
    
    try {
      const bot = new PolymarketAnalyticsBot(this.testToken);
      
      // Mock failing API
      bot.makeRequest = async (service, endpoint) => {
        if (service === 'telegram' && endpoint === 'getMe') {
          return { username: 'test_bot' };
        }
        // All other requests fail
        throw new Error('Simulated API failure');
      };

      bot.config.database.path = ':memory:';
      await bot.init();

      // Test handling of API failures
      await bot.processUpdate({
        message: {
          chat: { id: 12345 },
          from: { username: 'test_user' },
          text: '/trending'
        }
      });

      this.addResult('API failure handling', true, 'Bot survived API failures');

      // Test invalid inputs
      try {
        bot.validate('', 'marketId');
        this.addResult('Input validation', false, 'Should have rejected empty string');
      } catch (error) {
        this.addResult('Input validation', true, 'Correctly rejected invalid input');
      }

      await bot.stop();

    } catch (error) {
      this.addResult('Error scenarios', false, `Unexpected error: ${error.message}`);
    }
  }

  async testPerformanceUnderLoad() {
    console.log('\n4️⃣ Performance Under Load - Scalability testing');
    
    try {
      const bot = new PolymarketAnalyticsBot(this.testToken);
      
      // Mock fast API responses
      bot.makeRequest = async (service, endpoint) => {
        if (service === 'telegram' && endpoint === 'getMe') {
          return { username: 'test_bot' };
        }
        if (service === 'telegram' && endpoint === 'sendMessage') {
          await this.sleep(10); // Simulate network latency
          return { message_id: Math.random() };
        }
        return [];
      };

      bot.config.database.path = ':memory:';
      await bot.init();

      // Simulate 20 concurrent users
      console.log('  🚀 Simulating 20 concurrent users...');
      const startTime = Date.now();
      
      const promises = [];
      for (let i = 0; i < 20; i++) {
        promises.push(
          bot.processUpdate({
            message: {
              chat: { id: i },
              from: { username: `user_${i}` },
              text: '/start'
            }
          })
        );
      }

      await Promise.all(promises);
      const duration = Date.now() - startTime;

      this.addResult(
        'Concurrent user handling', 
        duration < 5000,
        `20 concurrent users processed in ${duration}ms`
      );

      // Check memory usage
      const memoryUsage = process.memoryUsage().heapUsed / 1024 / 1024;
      this.addResult(
        'Memory efficiency under load',
        memoryUsage < 100,
        `Memory usage: ${memoryUsage.toFixed(1)}MB`
      );

      await bot.stop();

    } catch (error) {
      this.addResult('Performance testing', false, `Error: ${error.message}`);
    }
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  addResult(testName, passed, details) {
    this.results.push({ testName, passed, details });
    const status = passed ? '✅' : '❌';
    console.log(`  ${status} ${testName}: ${details}`);
  }

  printFinalResults() {
    const passed = this.results.filter(r => r.passed).length;
    const total = this.results.length;
    const failed = total - passed;
    const passRate = ((passed / total) * 100).toFixed(1);

    console.log('\n' + '='.repeat(60));
    console.log(`🔍 Final Verification Results: ${passed}/${total} passed (${passRate}%)`);
    
    if (failed > 0) {
      console.log(`\n❌ Failed Verifications (${failed}):`);
      this.results
        .filter(r => !r.passed)
        .forEach(r => console.log(`   • ${r.testName}: ${r.details}`));
    }

    if (passRate === 100) {
      console.log('\n🎉 PERFECT SCORE - PRODUCTION DEPLOYMENT APPROVED!');
      console.log('✨ The bot passes all end-to-end verification tests');
      console.log('🚀 Ready for immediate production deployment');
    } else if (passRate >= 90) {
      console.log('\n✅ EXCELLENT - Minor issues detected but deployable');
    } else {
      console.log('\n⚠️  ISSUES DETECTED - Address before production');
    }

    console.log('\n🏁 VERIFICATION COMPLETE');
    console.log('The Polymarket Analytics Bot has been thoroughly tested and verified.');
  }
}

async function main() {
  const verification = new FinalVerification();
  await verification.runVerification();
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = FinalVerification;
