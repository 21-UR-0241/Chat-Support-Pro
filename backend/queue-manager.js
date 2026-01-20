// backend/queue-manager.js
const { Queue, Worker } = require('bullmq');
const Redis = require('ioredis');
const db = require('./database');

const connection = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
  maxRetriesPerRequest: null
});

/**
 * Queue Manager for Async Webhook Processing
 * Prevents webhook timeouts and enables reliable processing
 */
class QueueManager {
  constructor() {
    this.webhookQueue = new Queue('webhooks', { connection });
    this.highPriorityQueue = new Queue('webhooks-high', { connection });
    
    this.initWorkers();
    
    console.log('✅ Queue Manager initialized');
  }

  async queueWebhook(store, topic, payload, priority = 'normal') {
    const queue = priority === 'high' ? this.highPriorityQueue : this.webhookQueue;
    
    try {
      await queue.add('process-webhook', {
        storeId: store.id,
        storeIdentifier: store.store_identifier,
        shopDomain: store.shop_domain,
        topic,
        payload,
        receivedAt: new Date().toISOString()
      }, {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000
        },
        removeOnComplete: 100,
        removeOnFail: 500
      });
      
      console.log(`✅ Webhook queued: ${topic} for ${store.shop_domain}`);
    } catch (error) {
      console.error('❌ Error queueing webhook:', error);
    }
  }

  initWorkers() {
    // Normal priority worker
    new Worker('webhooks', async (job) => {
      console.log(`🔄 Processing webhook: ${job.data.topic} for ${job.data.shopDomain}`);
      await this.processWebhook(job.data);
    }, { 
      connection,
      concurrency: 10
    });

    // High priority worker
    new Worker('webhooks-high', async (job) => {
      console.log(`⚡ Processing HIGH priority webhook: ${job.data.topic}`);
      await this.processWebhook(job.data);
    }, { 
      connection,
      concurrency: 5
    });
  }

  async processWebhook(data) {
    const { storeId, topic, payload } = data;
    
    try {
      const store = await db.getStoreById(storeId);
      
      if (!store) {
        console.error('Store not found:', storeId);
        return;
      }
      
      // Log webhook
      await db.logWebhook({
        store_id: storeId,
        topic,
        payload,
        headers: {}
      });
      
      // Process based on topic
      await this.handleWebhookTopic(store, topic, payload);
      
      console.log(`✅ Webhook processed: ${topic}`);
    } catch (error) {
      console.error('❌ Error processing webhook:', error);
      throw error; // Will trigger retry
    }
  }

  async handleWebhookTopic(store, topic, payload) {
    const normalizedTopic = topic.replace(/-/g, '/');
    
    const { broadcastToAgents } = require('./websocket-server');
    
    switch (normalizedTopic) {
      case 'customers/create':
        console.log(`👤 New customer: ${payload.email}`);
        broadcastToAgents({
          type: 'webhook',
          event: 'customer_created',
          storeId: store.id,
          data: {
            customerId: payload.id,
            email: payload.email,
            name: `${payload.first_name} ${payload.last_name}`
          }
        });
        break;
        
      case 'customers/update':
        console.log(`👤 Customer updated: ${payload.email}`);
        // Invalidate cache
        const redisManager = require('./redis-manager');
        await redisManager.invalidateCustomerContext(store.id, payload.email);
        break;
        
      case 'orders/create':
        console.log(`🛍️  New order: ${payload.name} - ${payload.total_price} ${payload.currency}`);
        broadcastToAgents({
          type: 'webhook',
          event: 'order_created',
          storeId: store.id,
          data: {
            orderId: payload.id,
            orderName: payload.name,
            customerEmail: payload.email,
            totalPrice: payload.total_price,
            currency: payload.currency
          }
        });
        break;
        
      case 'orders/cancelled':
        console.log(`❌ Order cancelled: ${payload.name}`);
        break;
        
      case 'app/uninstalled':
        console.log(`🚫 App uninstalled: ${store.shop_domain}`);
        await db.updateStoreSettings(store.id, {
          is_active: false,
          websocket_connected: false
        });
        break;
        
      default:
        console.log(`ℹ️  Unhandled webhook: ${normalizedTopic}`);
    }
  }

  async getQueueStatus() {
    const normalCounts = await this.webhookQueue.getJobCounts();
    const highCounts = await this.highPriorityQueue.getJobCounts();
    
    return {
      normal: normalCounts,
      high: highCounts,
      total: {
        waiting: normalCounts.waiting + highCounts.waiting,
        active: normalCounts.active + highCounts.active,
        completed: normalCounts.completed + highCounts.completed,
        failed: normalCounts.failed + highCounts.failed
      }
    };
  }

  async clearQueues() {
    await this.webhookQueue.obliterate();
    await this.highPriorityQueue.obliterate();
    console.log('✅ Queues cleared');
  }
}

module.exports = new QueueManager();