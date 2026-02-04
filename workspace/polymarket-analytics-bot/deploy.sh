#!/bin/bash

# Polymarket Analytics Bot - Production Deployment Script

set -e

echo "🎯 Polymarket Analytics Bot - Production Deployment"
echo "=================================================="

# Check Node.js
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is required but not installed."
    echo "📦 Install from: https://nodejs.org"
    exit 1
fi

NODE_VERSION=$(node -v | cut -d'v' -f2)
echo "✅ Node.js v$NODE_VERSION detected"

# Install dependencies
echo "📦 Installing dependencies..."
npm install --production

# Check for bot token
if [ -z "$TELEGRAM_BOT_TOKEN" ]; then
    echo ""
    echo "⚠️  TELEGRAM_BOT_TOKEN not found!"
    echo ""
    echo "📋 Setup your bot token:"
    echo "1. Open Telegram and message @BotFather"
    echo "2. Send '/newbot' and follow the prompts"
    echo "3. Copy your bot token"
    echo "4. Run: export TELEGRAM_BOT_TOKEN='your_token_here'"
    echo "5. Run this script again"
    echo ""
    read -p "Do you have a bot token ready? (y/n): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        read -p "Enter your bot token: " BOT_TOKEN
        export TELEGRAM_BOT_TOKEN="$BOT_TOKEN"
        echo "Token set for this session."
    else
        echo "Get your token first, then run this script again."
        exit 1
    fi
fi

echo "🤖 Bot token detected: ${TELEGRAM_BOT_TOKEN:0:10}..."

# Run tests to verify everything works
echo "🧪 Running production tests..."
node test.js
echo ""
node integration-test.js
echo ""

echo "🌐 Testing API connectivity..."
node api-test.js
echo ""

# Offer to start the bot
echo "🎉 Deployment complete! Bot is ready to run."
echo ""
echo "📋 To start your bot:"
echo "   npm start"
echo ""
echo "📋 To test your bot once started:"
echo "   Send '/start' to your bot on Telegram"
echo "   Send '/test' to verify all systems"
echo "   Send '/trending' to see real market data"
echo ""
read -p "Start the bot now? (y/n): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "🚀 Starting bot..."
    npm start
else
    echo "👍 Run 'npm start' when you're ready!"
fi
