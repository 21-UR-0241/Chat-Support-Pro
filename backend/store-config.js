// backend/store-config.js
const redisManager = require('./redis-manager');
const db = require('./database');

/**
 * Store Configuration Manager
 * Manages per-store settings and feature flags
 */
class StoreConfigManager {
  async getConfig(storeId) {
    try {
      // Check cache
      const cached = await redisManager.get(`config:${storeId}`);
      if (cached) return cached;
      
      // Fetch from database
      const store = await db.getStoreById(storeId);
      
      if (!store) {
        throw new Error('Store not found');
      }
      
      // Build configuration
      const config = {
        storeId: store.id,
        identifier: store.store_identifier,
        brandName: store.brand_name,
        plan: store.plan || 'free',
        
        limits: {
          maxConcurrentChats: this.getLimit(store, 'concurrent_chats', 10),
          messagesPerDay: this.getLimit(store, 'messages_per_day', 1000),
          agentsAllowed: this.getLimit(store, 'agents', 5),
          messageRetentionDays: this.getLimit(store, 'retention_days', 30)
        },
        
        features: {
          aiResponses: this.hasFeature(store, 'ai_responses', false),
          advancedAnalytics: this.hasFeature(store, 'analytics', true),
          customBranding: this.hasFeature(store, 'branding', store.plan !== 'free'),
          webhooks: true,
          apiAccess: this.hasFeature(store, 'api', store.plan === 'enterprise')
        },
        
        widget: store.widget_settings || {
          position: 'bottom-right',
          primaryColor: store.primary_color || '#667eea',
          greeting: 'Hi! How can we help you today?'
        },
        
        isActive: store.is_active,
        timezone: store.timezone || 'UTC',
        currency: store.currency || 'USD'
      };
      
      // Cache for 1 hour
      await redisManager.set(`config:${storeId}`, config, 3600);
      
      return config;
    } catch (error) {
      console.error('Error getting store config:', error);
      throw error;
    }
  }

  getLimit(store, key, defaultValue) {
    // You can implement plan-based limits here
    const limits = {
      free: {
        concurrent_chats: 5,
        messages_per_day: 500,
        agents: 2,
        retention_days: 7
      },
      basic: {
        concurrent_chats: 20,
        messages_per_day: 5000,
        agents: 10,
        retention_days: 30
      },
      premium: {
        concurrent_chats: 100,
        messages_per_day: 50000,
        agents: 50,
        retention_days: 365
      },
      enterprise: {
        concurrent_chats: 500,
        messages_per_day: 500000,
        agents: 200,
        retention_days: 730
      }
    };
    
    const plan = store.plan || 'free';
    return limits[plan]?.[key] || defaultValue;
  }

  hasFeature(store, feature, defaultValue = false) {
    const planFeatures = {
      free: ['webhooks'],
      basic: ['webhooks', 'analytics', 'branding'],
      premium: ['webhooks', 'analytics', 'branding', 'ai_responses'],
      enterprise: ['webhooks', 'analytics', 'branding', 'ai_responses', 'api']
    };
    
    const plan = store.plan || 'free';
    return planFeatures[plan]?.includes(feature) || defaultValue;
  }

  async invalidateConfig(storeId) {
    await redisManager.del(`config:${storeId}`);
  }

  async checkLimit(storeId, limitType) {
    const config = await this.getConfig(storeId);
    const limit = config.limits[limitType];
    
    // Get current usage from Redis or database
    const current = await this.getCurrentUsage(storeId, limitType);
    
    return {
      limit,
      current,
      remaining: Math.max(0, limit - current),
      exceeded: current >= limit
    };
  }

  async getCurrentUsage(storeId, limitType) {
    // Implement based on limit type
    switch (limitType) {
      case 'maxConcurrentChats':
        const active = await redisManager.getActiveConversations(storeId);
        return active.length;
        
      case 'messagesPerDay':
        const count = await redisManager.get(`usage:${storeId}:messages:today`);
        return count || 0;
        
      case 'agentsAllowed':
        const { pool } = require('./database');
        const result = await pool.query(
          'SELECT COUNT(*) FROM employees WHERE $1 = ANY(assigned_stores) OR can_view_all_stores = true',
          [storeId]
        );
        return parseInt(result.rows[0].count);
        
      default:
        return 0;
    }
  }
}

module.exports = new StoreConfigManager();