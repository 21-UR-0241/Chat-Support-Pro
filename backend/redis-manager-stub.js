// backend/redis-manager-stub.js
// Temporary stub for development without Redis

class RedisManagerStub {
  constructor() {
    console.log('⚠️  Running without Redis (development mode)');
  }

  async cacheStore() {}
  async getStore() { return null; }
  async invalidateStore() {}
  async cacheCustomerContext() {}
  async getCustomerContext() { return null; }
  async invalidateCustomerContext() {}
  async addActiveConversation() {}
  async removeActiveConversation() {}
  async getActiveConversations() { return []; }
  async mapSocketToStore() {}
  async getStoreBySocket() { return null; }
  async removeSocket() {}
  async publishMessage() {}
  
  subscribe(channel, callback) {
    console.log(`📡 Stub: Subscribed to ${channel}`);
  }
  
  unsubscribe() {}
  async incrementRateLimit() { return 0; }
  async getRateLimit() { return 0; }
  async set() {}
  async get() { return null; }
  async del() {}
  async keys() { return []; }
  async exists() { return false; }
  async ping() { return true; }
  async getInfo() { return null; }
  async disconnect() {}
}

module.exports = new RedisManagerStub();