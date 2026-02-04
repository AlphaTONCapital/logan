// Rate limiter to prevent API bans and manage load
class RateLimiter {
  constructor(options = {}) {
    this.maxRequests = options.maxRequests || 30;
    this.timeWindow = options.timeWindow || 1000; // 1 second
    this.requests = [];
    this.queue = [];
    this.processing = false;
  }

  async limit(fn, context = null) {
    return new Promise((resolve, reject) => {
      this.queue.push({ fn, context, resolve, reject });
      this.processQueue();
    });
  }

  async processQueue() {
    if (this.processing || this.queue.length === 0) return;
    
    this.processing = true;

    while (this.queue.length > 0) {
      // Clean old requests
      const now = Date.now();
      this.requests = this.requests.filter(time => now - time < this.timeWindow);

      // Check if we can make another request
      if (this.requests.length >= this.maxRequests) {
        const oldestRequest = Math.min(...this.requests);
        const waitTime = this.timeWindow - (now - oldestRequest);
        
        if (waitTime > 0) {
          await this.sleep(waitTime);
          continue;
        }
      }

      // Process next request
      const { fn, context, resolve, reject } = this.queue.shift();
      this.requests.push(now);

      try {
        const result = await fn.call(context);
        resolve(result);
      } catch (error) {
        reject(error);
      }
    }

    this.processing = false;
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  getStatus() {
    const now = Date.now();
    const activeRequests = this.requests.filter(time => now - time < this.timeWindow);
    
    return {
      activeRequests: activeRequests.length,
      maxRequests: this.maxRequests,
      queueLength: this.queue.length,
      available: this.maxRequests - activeRequests.length
    };
  }
}

module.exports = RateLimiter;
