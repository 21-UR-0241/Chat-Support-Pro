// backend/shopify-rate-limiter.js
const Bottleneck = require('bottleneck');

class ShopifyRateLimiter {
  constructor() {
    // Shopify allows 2 requests/second per store
    this.limiters = new Map();
  }
  
  getLimiter(storeId) {
    if (!this.limiters.has(storeId)) {
      this.limiters.set(storeId, new Bottleneck({
        minTime: 500, // 2 requests per second max
        maxConcurrent: 1,
        reservoir: 40, // Bucket size (Shopify's bucket is 40)
        reservoirRefreshAmount: 40,
        reservoirRefreshInterval: 1000 // Refill every second
      }));
    }
    return this.limiters.get(storeId);
  }
  
  async schedule(storeId, fn) {
    const limiter = this.getLimiter(storeId);
    return await limiter.schedule(fn);
  }
}

module.exports = new ShopifyRateLimiter();