const Bottleneck = require('bottleneck');

class ShopifyRateLimiter {
  constructor() {
    this.limiters = new Map();
  }

  getLimiter(storeId) {
    if (!this.limiters.has(storeId)) {
      this.limiters.set(storeId, new Bottleneck({
        minTime: 500,
        maxConcurrent: 1,
        reservoir: 40,
        reservoirRefreshAmount: 40,
        reservoirRefreshInterval: 1000
      }));
    }
    return this.limiters.get(storeId);
  }

  async schedule(storeId, fn) {
    const limiter = this.getLimiter(storeId);
    return await limiter.schedule(fn);
  }

  // Backwards compatibility if called elsewhere
  async scheduleWithRetry(storeId, fn) {
    return await this.schedule(storeId, fn);
  }
}

module.exports = new ShopifyRateLimiter();