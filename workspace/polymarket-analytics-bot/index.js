#!/usr/bin/env node

// Production entry point
const PolymarketAnalyticsBot = require('./bot');

async function main() {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  
  if (!botToken) {
    console.error('❌ TELEGRAM_BOT_TOKEN environment variable is required!');
    console.log('\n📋 Setup Instructions:');
    console.log('1. Message @BotFather on Telegram');
    console.log('2. Send /newbot and follow prompts');
    console.log('3. Copy your bot token');
    console.log('4. Set token: export TELEGRAM_BOT_TOKEN="your_token"');
    console.log('5. Run: npm start');
    process.exit(1);
  }

  try {
    const bot = new PolymarketAnalyticsBot(botToken);
    await bot.init();
    await bot.startPolling();
  } catch (error) {
    console.error('❌ Bot startup failed:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = main;
