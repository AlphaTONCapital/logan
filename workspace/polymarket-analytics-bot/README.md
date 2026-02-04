# 🎯 Polymarket Analytics Bot

A comprehensive Telegram bot that provides data-driven insights for Polymarket prediction markets without any real money betting. Get professional-grade analytics, paper trading, and market intelligence to sharpen your prediction market skills.

## ✨ Features

### 📊 Market Analytics
- **Trending Markets**: Real-time top markets by volume
- **Deep Market Analysis**: Price trends, volatility, volume analysis
- **Search**: Find specific markets by keywords
- **Historical Data**: Track price movements over time

### 📈 Advanced Insights  
- **Trading Signals**: Algorithmic buy/sell recommendations
- **Trend Analysis**: Bullish/bearish momentum detection
- **Volatility Metrics**: Risk assessment for each market
- **Volume Spike Detection**: Identify unusual market activity

### 🔔 Smart Alerts
- **Price Change Alerts**: Get notified on significant moves
- **Volume Alerts**: Track unusual trading activity
- **Custom Thresholds**: Set your own alert parameters
- **Multiple Markets**: Monitor entire watchlists

### 📋 Paper Trading
- **Virtual Portfolio**: Practice with fake money
- **Position Tracking**: Monitor P&L in real-time
- **Trade History**: Review past performance
- **Strategy Testing**: Experiment without risk

### 🧠 Educational Tools
- **Market Guides**: Learn prediction market basics
- **Trading Strategies**: Professional techniques explained
- **Glossary**: Understand key terminology
- **Pattern Recognition**: Identify recurring market behaviors

## 🚀 Quick Start

### 1. Create Telegram Bot
```bash
# Message @BotFather on Telegram
# Send: /newbot
# Follow prompts to create your bot
# Copy the token (format: 123456789:ABCdefGHIjklMNOpqrsTUVwxyz)
```

### 2. Setup Environment
```bash
# Clone or download the bot files
cd polymarket-analytics-bot

# Install dependencies
npm install

# Set your bot token
export TELEGRAM_BOT_TOKEN="your_token_here"

# Start the bot
npm start
```

### 3. Start Using
```bash
# Find your bot on Telegram and send:
/start
```

## 📱 Bot Commands

### Basic Commands
- `/start` - Welcome message and feature overview
- `/help` - Show all available commands
- `/trending` - Top markets by 24h volume
- `/search [query]` - Find markets by keyword

### Market Analysis
- `/market [id]` - Detailed analysis of specific market
- `/price [id]` - Current pricing and trend data
- `/volume` - Highest volume markets
- `/analysis [id]` - Advanced technical analysis

### Alerts & Tracking
- `/alert [market_id] [threshold_%]` - Set price alerts
- `/watchlist` - View your tracked markets
- `/alerts` - Manage all your alerts

### Paper Trading
- `/portfolio` - View your virtual positions
- `/buy [market_id] [position] [amount]` - Make paper trade
- `/sell [position_id]` - Close paper position
- `/history` - Trade history and performance

### Educational
- `/guide` - Prediction market basics
- `/strategies` - Trading strategy explanations
- `/glossary` - Key terms and definitions
- `/patterns` - Common market patterns

## 🎯 Usage Examples

### Get Market Analysis
```
/market 0x1234567890abcdef
```
Returns:
- Current prices for all outcomes
- 24h volume and total volume
- Price trend analysis
- Volatility metrics
- Trading signals

### Set Price Alerts
```
/alert 0x1234567890abcdef 5
```
Get notified when the market moves 5% or more in either direction.

### Paper Trading
```
/buy 0x1234567890abcdef yes 100
```
Buy 100 shares of "Yes" position for practice.

### Search Markets
```
/search bitcoin trump election
```
Find markets related to your keywords.

## 🔧 Advanced Features

### Smart Trading Signals

The bot analyzes multiple factors to generate trading signals:

1. **Volume Analysis**: Identifies unusual trading activity
2. **Price Momentum**: Detects strong directional moves  
3. **Volatility Patterns**: Assesses risk levels
4. **Historical Trends**: Uses past data for predictions

### Market Intelligence

- **Sentiment Indicators**: Gauge market mood
- **Liquidity Analysis**: Assess ease of trading
- **Risk Metrics**: Understand position risks
- **Correlation Analysis**: Find related markets

### Portfolio Analytics

- **Performance Tracking**: Monitor your paper trading success
- **Risk Assessment**: Understand your exposure
- **Diversification Analysis**: Optimize your positions
- **Strategy Backtesting**: Test approaches on historical data

## 📊 Data Sources

- **Polymarket API**: Real-time market data
- **Historical Database**: SQLite storage for trends
- **Price History**: Continuous price tracking
- **Volume Metrics**: Trading activity monitoring

## 🛡️ Safety Features

### No Real Money
- **100% Paper Trading**: All trades are virtual
- **Educational Focus**: Learning without financial risk
- **No Payment Integration**: Cannot spend real money

### Privacy Protection
- **Local Database**: Your data stays on the server
- **No Personal Info**: Only Telegram chat IDs stored
- **Secure API**: Read-only market data access

## 🔍 Understanding the Analytics

### Price Trends
- **Bullish**: Sustained upward movement (↗️)
- **Bearish**: Sustained downward movement (↘️)  
- **Sideways**: No clear direction (➡️)

### Volatility Levels
- **High**: Frequent large price swings
- **Medium**: Moderate price variation
- **Low**: Stable pricing

### Volume Indicators
- **High Volume**: Increased market interest
- **Volume Spikes**: Significant news or events
- **Low Volume**: Limited trading activity

### Trading Signals
- **🔥 High Volume**: Unusual trading activity
- **📈 Strong Momentum**: Clear price direction
- **🎲 Low Probability**: High potential upside
- **🔒 High Confidence**: Consider contrarian plays

## 🎓 Learning Resources

### Prediction Market Basics
1. **What are prediction markets?** Platforms for trading on future events
2. **How do prices work?** Prices reflect probability of outcomes
3. **Why trade predictions?** Test forecasting skills and insights
4. **Market efficiency**: Prices incorporate all available information

### Trading Strategies
1. **Contrarian Trading**: Fade extreme probabilities
2. **Momentum Following**: Ride strong trends
3. **Volume Trading**: Follow unusual activity
4. **Event-Based**: Trade on news and catalysts

### Risk Management
1. **Position Sizing**: Don't risk too much on one trade
2. **Diversification**: Spread risk across multiple markets
3. **Stop Losses**: Know when to exit losing positions
4. **Time Decay**: Consider time until market resolution

## 🤝 Contributing

Want to improve the bot? Here's how:

### Feature Requests
- Open an issue describing the feature
- Explain the use case and benefit
- Provide examples if possible

### Bug Reports
- Describe the issue clearly
- Include steps to reproduce
- Share relevant error messages

### Code Contributions
- Fork the repository
- Create a feature branch
- Submit a pull request

## 📋 Roadmap

### Upcoming Features
- [ ] News sentiment analysis integration
- [ ] Multi-timeframe chart analysis  
- [ ] Advanced portfolio analytics
- [ ] Custom strategy backtesting
- [ ] Market correlation analysis
- [ ] Social sentiment indicators
- [ ] Automated trade suggestions
- [ ] Performance leaderboards

### Future Integrations
- [ ] Additional prediction market platforms
- [ ] TradingView chart integration
- [ ] News API connections
- [ ] Social media sentiment
- [ ] Economic calendar events

## ⚡ Performance Tips

### For Users
1. **Use specific market IDs** for faster analysis
2. **Set targeted alerts** to avoid notification spam
3. **Review portfolio regularly** to track performance
4. **Start with small paper positions** to learn

### For Developers
1. **Rate limiting**: Built-in API call throttling
2. **Caching**: Market data cached for efficiency  
3. **Database optimization**: Indexed queries for speed
4. **Error handling**: Robust error recovery

## 🔐 Security

### Bot Security
- No admin commands exposed
- Read-only market data access
- Input validation on all commands
- No sensitive data logging

### User Privacy
- Only stores necessary data
- No personal information collected
- Local database storage
- No third-party data sharing

## 📞 Support

### Getting Help
1. **In-bot help**: Use `/help` command
2. **Documentation**: Read this README
3. **Issues**: Open GitHub issues for bugs
4. **Community**: Join discussions

### Common Issues
- **Bot not responding**: Check token is valid
- **Market not found**: Verify market ID format
- **Data missing**: API may be temporarily down
- **Alerts not working**: Check subscription settings

## 📜 License

MIT License - Feel free to modify and distribute.

## 🎉 Credits

Built with ❤️ by Aton AI for the prediction market community.

**Technologies Used:**
- Node.js & npm
- Telegram Bot API  
- Polymarket API
- SQLite database
- Axios for HTTP requests
- date-fns for time handling

---

*Disclaimer: This bot is for educational purposes only. All trading is virtual/paper trading with no real money involved. Past performance doesn't guarantee future results.*
