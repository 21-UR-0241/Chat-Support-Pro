// backend/queue-manager.js
const { Queue, Worker } = require('bullmq');
const Redis = require('ioredis');
const db = require('./database');

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
const connection = new Redis(redisUrl, {
  maxRetriesPerRequest: null,
  tls: process.env.REDIS_TLS === 'true' ? {} : undefined
});

class QueueManager {
  constructor() {
    this.webhookQueue = new Queue('webhooks', { connection });
    this.highPriorityQueue = new Queue('webhooks-high', { connection });
    this.initWorkers();
    console.log('✅ Queue Manager initialized');
  }

  async queueWebhook(store, topic, payload, priority = 'normal') {
    const queue = priority === 'high' ? this.highPriorityQueue : this.webhookQueue;

    const jobId = `${store.id}:${topic}:${payload?.id || payload?.admin_graphql_api_id || Date.now()}`;

    await queue.add('process-webhook', {
      storeId: store.id,
      storeIdentifier: store.store_identifier,
      shopDomain: store.shop_domain,
      topic,
      payload,
      receivedAt: new Date().toISOString()
    }, {
      jobId,
      attempts: 3,
      backoff: { type: 'exponential', delay: 2000 },
      removeOnComplete: 100,
      removeOnFail: 500
    });
  }

  initWorkers() {
    new Worker('webhooks', async (job) => {
      await this.processWebhook(job.data);
    }, { connection, concurrency: 10 });

    new Worker('webhooks-high', async (job) => {
      await this.processWebhook(job.data);
    }, { connection, concurrency: 5 });
  }

  async processWebhook(data) {
    const { storeId, topic, payload } = data;

    try {
      const store = await db.getStoreById(storeId);
      if (!store) return;

      await db.insertWebhookLog({
        storeId,
        topic,
        payload,
        headers: {}
      });

      await this.handleWebhookTopic(store, topic, payload);
    } catch (error) {
      console.error('❌ Error processing webhook:', error);
      throw error;
    }
  }

  async handleWebhookTopic(store, topic, payload) {
    const normalizedTopic = topic.replace(/-/g, '/');
    const { broadcastToAgents } = require('./websocket-server');

    switch (normalizedTopic) {
      case 'customers/create':
        broadcastToAgents({ type: 'webhook', event: 'customer_created', storeId: store.id, data: { customerId: payload.id, email: payload.email, name: `${payload.first_name} ${payload.last_name}` } });
        break;
      case 'customers/update':
        const redisManager = require('./redis-manager');
        await redisManager.invalidateCustomerContext(store.id, payload.email);
        break;
      case 'orders/create':
        broadcastToAgents({ type: 'webhook', event: 'order_created', storeId: store.id, data: { orderId: payload.id, orderName: payload.name, customerEmail: payload.email, totalPrice: payload.total_price, currency: payload.currency } });
        break;
      case 'orders/cancelled':
        break;
      case 'app/uninstalled':
        await db.updateStoreSettings(store.id, { is_active: false, websocket_connected: false });
        break;
      default:
        break;
    }
  }
}

module.exports = new QueueManager();