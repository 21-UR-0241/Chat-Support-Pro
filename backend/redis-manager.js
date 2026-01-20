// backend/redis-manager.js
const Redis = require('ioredis');

/**
 * Redis Manager for Caching and Pub/Sub
 * Handles store data, customer context, WebSocket sessions, and cross-server messaging
 */
class RedisManager {
  constructor() {
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
    
    this.client = new Redis(redisUrl, {
      retryStrategy(times) {
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
      maxRetriesPerRequest: 3,
      enableReadyCheck: true,
      lazyConnect: false
    });
    
    this.subscriber = new Redis(redisUrl);
    
    this.client.on('connect', () => {
      console.log('✅ Redis connected');
    });
    
    this.client.on('error', (err) => {
      console.error('❌ Redis error:', err);
    });
    
    this.subscriber.on('error', (err) => {
      console.error('❌ Redis subscriber error:', err);
    });
  }

  // ============================================
  // STORE CACHING
  // ============================================

  async cacheStore(identifier, data, ttl = 3600) {
    try {
      await this.client.setex(
        `store:${identifier}`,
        ttl,
        JSON.stringify(data)
      );
    } catch (error) {
      console.error('Error caching store:', error);
    }
  }

  async getStore(identifier) {
    try {
      const cached = await this.client.get(`store:${identifier}`);
      return cached ? JSON.parse(cached) : null;
    } catch (error) {
      console.error('Error getting store from cache:', error);
      return null;
    }
  }

  async invalidateStore(identifier) {
    try {
      await this.client.del(`store:${identifier}`);
    } catch (error) {
      console.error('Error invalidating store cache:', error);
    }
  }

  // ============================================
  // CUSTOMER CONTEXT CACHING
  // ============================================

  async cacheCustomerContext(storeId, email, data, ttl = 1800) {
    try {
      await this.client.setex(
        `customer_context:${storeId}:${email}`,
        ttl,
        JSON.stringify(data)
      );
    } catch (error) {
      console.error('Error caching customer context:', error);
    }
  }

  async getCustomerContext(storeId, email) {
    try {
      const cached = await this.client.get(`customer_context:${storeId}:${email}`);
      return cached ? JSON.parse(cached) : null;
    } catch (error) {
      console.error('Error getting customer context:', error);
      return null;
    }
  }

  async invalidateCustomerContext(storeId, email) {
    try {
      await this.client.del(`customer_context:${storeId}:${email}`);
    } catch (error) {
      console.error('Error invalidating customer context:', error);
    }
  }

  // ============================================
  // ACTIVE CONVERSATIONS TRACKING
  // ============================================

  async addActiveConversation(storeId, conversationId) {
    try {
      await this.client.sadd(`active:${storeId}`, conversationId);
    } catch (error) {
      console.error('Error adding active conversation:', error);
    }
  }

  async removeActiveConversation(storeId, conversationId) {
    try {
      await this.client.srem(`active:${storeId}`, conversationId);
    } catch (error) {
      console.error('Error removing active conversation:', error);
    }
  }

  async getActiveConversations(storeId) {
    try {
      return await this.client.smembers(`active:${storeId}`);
    } catch (error) {
      console.error('Error getting active conversations:', error);
      return [];
    }
  }

  // ============================================
  // WEBSOCKET SESSION MANAGEMENT
  // ============================================

  async mapSocketToStore(socketId, storeId) {
    try {
      await this.client.setex(`socket:${socketId}`, 7200, storeId);
    } catch (error) {
      console.error('Error mapping socket:', error);
    }
  }

  async getStoreBySocket(socketId) {
    try {
      return await this.client.get(`socket:${socketId}`);
    } catch (error) {
      console.error('Error getting store by socket:', error);
      return null;
    }
  }

  async removeSocket(socketId) {
    try {
      await this.client.del(`socket:${socketId}`);
    } catch (error) {
      console.error('Error removing socket:', error);
    }
  }

  // ============================================
  // PUB/SUB FOR MULTI-SERVER COORDINATION
  // ============================================

  async publishMessage(channel, message) {
    try {
      await this.client.publish(channel, JSON.stringify(message));
    } catch (error) {
      console.error('Error publishing message:', error);
    }
  }

  subscribe(channel, callback) {
    this.subscriber.subscribe(channel, (err, count) => {
      if (err) {
        console.error('Error subscribing to channel:', err);
      } else {
        console.log(`✅ Subscribed to ${channel} (${count} channels)`);
      }
    });
    
    this.subscriber.on('message', (ch, msg) => {
      if (ch === channel) {
        try {
          callback(JSON.parse(msg));
        } catch (error) {
          console.error('Error parsing subscribed message:', error);
        }
      }
    });
  }

  unsubscribe(channel) {
    this.subscriber.unsubscribe(channel);
  }

  // ============================================
  // RATE LIMITING HELPERS
  // ============================================

  async incrementRateLimit(key, windowSeconds = 60) {
    try {
      const current = await this.client.incr(key);
      
      if (current === 1) {
        await this.client.expire(key, windowSeconds);
      }
      
      return current;
    } catch (error) {
      console.error('Error incrementing rate limit:', error);
      return 0;
    }
  }

  async getRateLimit(key) {
    try {
      const count = await this.client.get(key);
      return count ? parseInt(count) : 0;
    } catch (error) {
      console.error('Error getting rate limit:', error);
      return 0;
    }
  }

  // ============================================
  // GENERIC CACHING
  // ============================================

  async set(key, value, ttl = null) {
    try {
      if (ttl) {
        await this.client.setex(key, ttl, JSON.stringify(value));
      } else {
        await this.client.set(key, JSON.stringify(value));
      }
    } catch (error) {
      console.error('Error setting cache:', error);
    }
  }

  async get(key) {
    try {
      const value = await this.client.get(key);
      return value ? JSON.parse(value) : null;
    } catch (error) {
      console.error('Error getting cache:', error);
      return null;
    }
  }

  async del(key) {
    try {
      await this.client.del(key);
    } catch (error) {
      console.error('Error deleting cache:', error);
    }
  }

  async keys(pattern) {
    try {
      return await this.client.keys(pattern);
    } catch (error) {
      console.error('Error getting keys:', error);
      return [];
    }
  }

  async exists(key) {
    try {
      return await this.client.exists(key) === 1;
    } catch (error) {
      console.error('Error checking existence:', error);
      return false;
    }
  }

  // ============================================
  // HEALTH CHECK
  // ============================================

  async ping() {
    try {
      const result = await this.client.ping();
      return result === 'PONG';
    } catch (error) {
      console.error('Redis ping failed:', error);
      return false;
    }
  }

  async getInfo() {
    try {
      const info = await this.client.info();
      return info;
    } catch (error) {
      console.error('Error getting Redis info:', error);
      return null;
    }
  }

  // ============================================
  // CLEANUP
  // ============================================

  async disconnect() {
    try {
      await this.client.quit();
      await this.subscriber.quit();
      console.log('✅ Redis disconnected');
    } catch (error) {
      console.error('Error disconnecting Redis:', error);
    }
  }
}

module.exports = new RedisManager();