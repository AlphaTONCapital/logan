// Advanced trading strategies and pattern recognition

class TradingStrategies {
  
  // Momentum Strategy: Follow strong price trends
  static momentumStrategy(priceHistory, currentPrice) {
    if (priceHistory.length < 10) return null;
    
    const recent = priceHistory.slice(-10);
    const older = priceHistory.slice(-20, -10);
    
    const recentAvg = recent.reduce((sum, p) => sum + p.price, 0) / recent.length;
    const olderAvg = older.reduce((sum, p) => sum + p.price, 0) / older.length;
    
    const momentum = (recentAvg - olderAvg) / olderAvg;
    
    if (momentum > 0.1) {
      return {
        signal: 'BUY',
        strength: 'Strong',
        reason: `Strong upward momentum: ${(momentum * 100).toFixed(1)}%`,
        confidence: Math.min(momentum * 5, 0.9)
      };
    } else if (momentum < -0.1) {
      return {
        signal: 'SELL',
        strength: 'Strong', 
        reason: `Strong downward momentum: ${(momentum * 100).toFixed(1)}%`,
        confidence: Math.min(Math.abs(momentum) * 5, 0.9)
      };
    }
    
    return null;
  }
  
  // Mean Reversion: Fade extreme prices
  static meanReversionStrategy(priceHistory, currentPrice) {
    if (priceHistory.length < 20) return null;
    
    const prices = priceHistory.slice(-20).map(p => p.price);
    const mean = prices.reduce((sum, p) => sum + p, 0) / prices.length;
    const stdDev = Math.sqrt(
      prices.reduce((sum, p) => sum + Math.pow(p - mean, 2), 0) / prices.length
    );
    
    const zScore = (currentPrice - mean) / stdDev;
    
    if (zScore > 2) {
      return {
        signal: 'SELL',
        strength: 'Moderate',
        reason: `Price is ${zScore.toFixed(1)} standard deviations above mean`,
        confidence: Math.min(Math.abs(zScore) / 3, 0.8)
      };
    } else if (zScore < -2) {
      return {
        signal: 'BUY',
        strength: 'Moderate',
        reason: `Price is ${Math.abs(zScore).toFixed(1)} standard deviations below mean`,
        confidence: Math.min(Math.abs(zScore) / 3, 0.8)
      };
    }
    
    return null;
  }
  
  // Volume Divergence: Price moves without volume support
  static volumeDivergenceStrategy(priceHistory) {
    if (priceHistory.length < 10) return null;
    
    const recent = priceHistory.slice(-5);
    const older = priceHistory.slice(-10, -5);
    
    const priceChange = recent[recent.length - 1].price - older[older.length - 1].price;
    const recentVolumeAvg = recent.reduce((sum, p) => sum + (p.volume || 0), 0) / recent.length;
    const olderVolumeAvg = older.reduce((sum, p) => sum + (p.volume || 0), 0) / older.length;
    
    const volumeChange = (recentVolumeAvg - olderVolumeAvg) / olderVolumeAvg;
    
    // Price going up but volume decreasing = bearish divergence
    if (priceChange > 0.05 && volumeChange < -0.2) {
      return {
        signal: 'SELL',
        strength: 'Moderate',
        reason: 'Bearish divergence: price up but volume declining',
        confidence: 0.6
      };
    }
    
    // Price going down but volume increasing = bullish divergence  
    if (priceChange < -0.05 && volumeChange > 0.2) {
      return {
        signal: 'BUY',
        strength: 'Moderate',
        reason: 'Bullish divergence: price down but volume increasing',
        confidence: 0.6
      };
    }
    
    return null;
  }
  
  // Contrarian Strategy: Fade extreme probabilities
  static contrarianStrategy(currentPrice, volume24hr = 0) {
    const signals = [];
    
    // Extreme low probability with decent volume
    if (currentPrice < 0.15 && volume24hr > 10000) {
      signals.push({
        signal: 'BUY',
        strength: 'High',
        reason: `Undervalued at ${(currentPrice * 100).toFixed(1)}% with good liquidity`,
        confidence: 0.7
      });
    }
    
    // Extreme high probability - look for fade opportunities
    if (currentPrice > 0.85 && volume24hr > 10000) {
      signals.push({
        signal: 'SELL',
        strength: 'Moderate',
        reason: `Potentially overvalued at ${(currentPrice * 100).toFixed(1)}%`,
        confidence: 0.5
      });
    }
    
    return signals.length > 0 ? signals[0] : null;
  }
  
  // Pattern Recognition
  static recognizePatterns(priceHistory) {
    const patterns = [];
    
    if (priceHistory.length < 20) return patterns;
    
    const prices = priceHistory.slice(-20).map(p => p.price);
    
    // Double Bottom Pattern
    const doubleBottom = this.detectDoubleBottom(prices);
    if (doubleBottom) {
      patterns.push({
        pattern: 'Double Bottom',
        signal: 'BUY',
        description: 'Price has tested support level twice',
        confidence: 0.7
      });
    }
    
    // Double Top Pattern  
    const doubleTop = this.detectDoubleTop(prices);
    if (doubleTop) {
      patterns.push({
        pattern: 'Double Top',
        signal: 'SELL',
        description: 'Price has been rejected at resistance twice',
        confidence: 0.7
      });
    }
    
    // Breakout Pattern
    const breakout = this.detectBreakout(prices);
    if (breakout) {
      patterns.push({
        pattern: breakout.type,
        signal: breakout.signal,
        description: breakout.description,
        confidence: breakout.confidence
      });
    }
    
    return patterns;
  }
  
  static detectDoubleBottom(prices) {
    // Look for two similar lows with a peak between them
    const lows = [];
    for (let i = 1; i < prices.length - 1; i++) {
      if (prices[i] < prices[i-1] && prices[i] < prices[i+1]) {
        lows.push({ index: i, price: prices[i] });
      }
    }
    
    if (lows.length >= 2) {
      const [first, second] = lows.slice(-2);
      const priceDiff = Math.abs(first.price - second.price);
      const distanceBetween = second.index - first.index;
      
      if (priceDiff < 0.05 && distanceBetween > 5 && distanceBetween < 15) {
        return true;
      }
    }
    
    return false;
  }
  
  static detectDoubleTop(prices) {
    // Look for two similar highs with a valley between them
    const highs = [];
    for (let i = 1; i < prices.length - 1; i++) {
      if (prices[i] > prices[i-1] && prices[i] > prices[i+1]) {
        highs.push({ index: i, price: prices[i] });
      }
    }
    
    if (highs.length >= 2) {
      const [first, second] = highs.slice(-2);
      const priceDiff = Math.abs(first.price - second.price);
      const distanceBetween = second.index - first.index;
      
      if (priceDiff < 0.05 && distanceBetween > 5 && distanceBetween < 15) {
        return true;
      }
    }
    
    return false;
  }
  
  static detectBreakout(prices) {
    const recent = prices.slice(-5);
    const middle = prices.slice(-15, -5);
    
    const recentHigh = Math.max(...recent);
    const recentLow = Math.min(...recent);
    const middleHigh = Math.max(...middle);
    const middleLow = Math.min(...middle);
    
    // Upward breakout
    if (recentHigh > middleHigh * 1.05) {
      return {
        type: 'Upward Breakout',
        signal: 'BUY',
        description: 'Price broke above recent resistance',
        confidence: 0.6
      };
    }
    
    // Downward breakout
    if (recentLow < middleLow * 0.95) {
      return {
        type: 'Downward Breakout', 
        signal: 'SELL',
        description: 'Price broke below recent support',
        confidence: 0.6
      };
    }
    
    return null;
  }
  
  // Risk Assessment
  static assessRisk(market, priceHistory, position) {
    const risks = [];
    
    // Time to expiry risk
    const daysToExpiry = this.getDaysToExpiry(market.endDate);
    if (daysToExpiry < 7) {
      risks.push({
        type: 'Time Decay',
        level: 'High',
        description: `Only ${daysToExpiry} days until expiry`
      });
    }
    
    // Volatility risk
    const volatility = this.calculateVolatility(priceHistory);
    if (volatility > 0.15) {
      risks.push({
        type: 'High Volatility',
        level: 'Medium',
        description: 'Price swings may be large'
      });
    }
    
    // Liquidity risk
    const volume24hr = parseFloat(market.volume24hr || 0);
    if (volume24hr < 5000) {
      risks.push({
        type: 'Low Liquidity',
        level: 'Medium', 
        description: 'May be difficult to exit position'
      });
    }
    
    return risks;
  }
  
  static getDaysToExpiry(endDate) {
    const now = new Date();
    const expiry = new Date(endDate);
    const diffTime = expiry.getTime() - now.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }
  
  static calculateVolatility(priceHistory) {
    if (priceHistory.length < 10) return 0;
    
    const prices = priceHistory.slice(-10).map(p => p.price);
    const returns = [];
    
    for (let i = 1; i < prices.length; i++) {
      returns.push((prices[i] - prices[i-1]) / prices[i-1]);
    }
    
    const mean = returns.reduce((sum, r) => sum + r, 0) / returns.length;
    const variance = returns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / returns.length;
    
    return Math.sqrt(variance);
  }
}

module.exports = TradingStrategies;
