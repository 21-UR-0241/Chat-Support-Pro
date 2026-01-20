// backend/monitoring.js
const redisManager = require('./redis-manager');

/**
 * Monitoring and Analytics System
 * Tracks events, metrics, and performance
 */
class Monitoring {
  async trackEvent(storeId, event, data = {}) {
    try {
      // Increment event counter
      await redisManager.client.hincrby(
        `analytics:${storeId}:events`,
        event,
        1
      );
      
      // Store event details
      await redisManager.client.lpush(
        `analytics:${storeId}:event_log`,
        JSON.stringify({
          event,
          data,
          timestamp: Date.now()
        })
      );
      
      // Trim log to last 1000 events
      await redisManager.client.ltrim(
        `analytics:${storeId}:event_log`,
        0,
        999
      );
    } catch (error) {
      console.error('Error tracking event:', error);
    }
  }

  async trackPerformance(storeId, metric, value) {
    try {
      await redisManager.client.zadd(
        `analytics:${storeId}:${metric}`,
        Date.now(),
        value
      );
      
      // Keep only last 24 hours
      const dayAgo = Date.now() - 86400000;
      await redisManager.client.zremrangebyscore(
        `analytics:${storeId}:${metric}`,
        0,
        dayAgo
      );
    } catch (error) {
      console.error('Error tracking performance:', error);
    }
  }

  async getStoreMetrics(storeId) {
    try {
      const events = await redisManager.client.hgetall(`analytics:${storeId}:events`);
      const activeConversations = await redisManager.getActiveConversations(storeId);
      
      return {
        events: events || {},
        activeConversations: activeConversations.length,
        timestamp: Date.now()
      };
    } catch (error) {
      console.error('Error getting store metrics:', error);
      return null;
    }
  }

  async getRecentEvents(storeId, limit = 100) {
    try {
      const events = await redisManager.client.lrange(
        `analytics:${storeId}:event_log`,
        0,
        limit - 1
      );
      
      return events.map(e => JSON.parse(e));
    } catch (error) {
      console.error('Error getting recent events:', error);
      return [];
    }
  }

  async trackApiCall(storeId, endpoint, duration, success = true) {
    await this.trackEvent(storeId, `api_call:${success ? 'success' : 'error'}`);
    await this.trackPerformance(storeId, 'api_response_time', duration);
  }

  async trackWebSocketConnection(storeId, action) {
    await this.trackEvent(storeId, `websocket:${action}`);
  }

  async trackMessage(storeId, senderType) {
    await this.trackEvent(storeId, `message:${senderType}`);
  }
}

module.exports = new Monitoring();