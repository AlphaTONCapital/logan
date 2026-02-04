#!/bin/bash

set -e

echo "🎯 Installing Polymarket Analytics Bot..."

# Check Node.js installation
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is required but not installed."
    echo "📦 Install from: https://nodejs.org"
    exit 1
fi

# Check Node version
NODE_VERSION=$(node -v | cut -d'v' -f2)
if ! node -p "require('semver').gte('$NODE_VERSION', '18.0.0')" &> /dev/null; then
    echo "❌ Node.js 18.0.0 or higher required. Current: v$NODE_VERSION"
    exit 1
fi

echo "✅ Node.js v$NODE_VERSION detected"

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Check if .env exists
if [ ! -f .env ]; then
    echo "📝 Creating .env file from template..."
    cp .env.example .env
    echo ""
    echo "🤖 NEXT STEPS:"
    echo "1. Get bot token from @BotFather on Telegram"
    echo "2. Edit .env file and add your token"
    echo "3. Run: npm start"
    echo ""
else
    echo "✅ .env file already exists"
fi

# Make scripts executable
chmod +x install.sh

echo "🎉 Installation complete!"
echo ""
echo "🚀 To start the bot:"
echo "   npm start"
echo ""
echo "📖 Read README.md for full documentation"
