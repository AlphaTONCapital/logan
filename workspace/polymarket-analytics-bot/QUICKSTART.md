# ⚡ Quick Start Guide

## 1️⃣ Get Bot Token
1. Open Telegram and message [@BotFather](https://t.me/BotFather)
2. Send `/newbot` and follow prompts
3. Copy your bot token (format: `123456789:ABCdefGHIjklMNOpqrsTUVwxyz`)

## 2️⃣ Setup Bot
```bash
cd polymarket-analytics-bot
./install.sh
```

## 3️⃣ Configure Token
```bash
# Edit .env file and add your token
nano .env

# Add this line:
TELEGRAM_BOT_TOKEN=your_actual_token_here
```

## 4️⃣ Start Bot
```bash
./start.sh
```

## 5️⃣ Use Bot
1. Find your bot on Telegram
2. Send `/start` to begin
3. Try `/trending` to see hot markets!

## 🎯 Popular Commands
- `/trending` - See what's hot
- `/search bitcoin` - Find crypto markets  
- `/market [id]` - Deep analysis
- `/buy [market] [position] [amount]` - Paper trade
- `/portfolio` - Check your positions

**You're ready to go!** 🚀
