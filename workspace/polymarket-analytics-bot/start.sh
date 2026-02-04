#!/bin/bash

# Polymarket Analytics Bot Startup Script

set -e

echo "🎯 Starting Polymarket Analytics Bot..."

# Check if .env exists
if [ ! -f .env ]; then
    echo "❌ .env file not found!"
    echo "📝 Copy .env.example to .env and add your bot token"
    exit 1
fi

# Check if dependencies are installed
if [ ! -d node_modules ]; then
    echo "📦 Installing dependencies..."
    npm install
fi

# Check if bot token is set
if ! grep -q "TELEGRAM_BOT_TOKEN=" .env || grep -q "your_bot_token_here" .env; then
    echo "❌ Bot token not configured in .env file"
    echo "🤖 Get a token from @BotFather on Telegram"
    exit 1
fi

echo "🚀 Launching bot..."
npm start
