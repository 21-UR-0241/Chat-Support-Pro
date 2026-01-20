// /**
//  * Shopify Webhooks Handler - Multi-Store Ready
//  * Handles real-time events from Shopify
//  */

// const crypto = require('crypto');
// const db = require('./database');
// const { broadcastToAgents } = require('./websocket-server');

// /**
//  * Raw body middleware for webhook verification
//  */
// function rawBodyMiddleware(req, res, next) {
//   let data = '';
//   req.setEncoding('utf8');
  
//   req.on('data', chunk => {
//     data += chunk;
//   });
  
//   req.on('end', () => {
//     req.rawBody = data;
//     try {
//       req.body = JSON.parse(data);
//     } catch (error) {
//       req.body = {};
//     }
//     next();
//   });
// }

// /**
//  * Verify Shopify webhook HMAC
//  */
// function verifyWebhook(rawBody, hmacHeader) {
//   if (!process.env.SHOPIFY_API_SECRET) {
//     console.warn('⚠️ SHOPIFY_API_SECRET not set - skipping webhook verification');
//     return true;
//   }
  
//   const hash = crypto
//     .createHmac('sha256', process.env.SHOPIFY_API_SECRET)
//     .update(rawBody, 'utf8')
//     .digest('base64');
  
//   return hash === hmacHeader;
// }

// /**
//  * Main webhook handler
//  */
// async function handleWebhook(req, res) {
//   const { shop, topic } = req.params;
//   const hmac = req.get('X-Shopify-Hmac-Sha256');
  
//   console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
//   console.log('📬 SHOPIFY WEBHOOK RECEIVED');
//   console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
//   console.log('Topic:', topic);
//   console.log('Shop:', shop);
//   console.log('Time:', new Date().toISOString());
  
//   // Verify webhook (only in production)
//   if (process.env.NODE_ENV === 'production') {
//     if (!verifyWebhook(req.rawBody, hmac)) {
//       console.log('❌ Webhook verification failed');
//       console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
//       return res.status(401).json({ error: 'Webhook verification failed' });
//     }
//     console.log('✅ Webhook verified');
//   } else {
//     console.log('⚠️ Development mode - skipping verification');
//   }
  
//   try {
//     // Get store from database
//     const store = await db.getStoreByDomain(shop);
    
//     if (!store) {
//       console.log('❌ Store not found:', shop);
//       console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
//       return res.status(404).json({ error: 'Store not found' });
//     }
    
//     console.log('✅ Store found:', store.store_identifier);
    
//     // Log webhook to database
//     await db.logWebhook({
//       store_id: store.id,
//       topic,
//       payload: req.body,
//       headers: {
//         'x-shopify-topic': req.get('X-Shopify-Topic'),
//         'x-shopify-shop-domain': req.get('X-Shopify-Shop-Domain'),
//       }
//     });
    
//     // Update last webhook timestamp
//     await db.updateStoreSettings(store.id, {
//       last_webhook_at: new Date()
//     });
    
//     // Process webhook based on topic
//     await processWebhook(store, topic, req.body);
    
//     console.log('✅ Webhook processed successfully');
//     console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
//     res.status(200).send('Webhook processed');
//   } catch (error) {
//     console.error('❌ Webhook processing error:', error);
//     console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
//     res.status(500).json({ error: 'Webhook processing failed' });
//   }
// }

// /**
//  * Process webhook by topic
//  */
// async function processWebhook(store, topic, payload) {
//   const normalizedTopic = topic.replace(/-/g, '/');
  
//   switch (normalizedTopic) {
//     case 'customers/create':
//       await handleCustomerCreate(store, payload);
//       break;
      
//     case 'customers/update':
//       await handleCustomerUpdate(store, payload);
//       break;
      
//     case 'orders/create':
//       await handleOrderCreate(store, payload);
//       break;
      
//     case 'orders/cancelled':
//       await handleOrderCancelled(store, payload);
//       break;
      
//     case 'app/uninstalled':
//       await handleAppUninstalled(store, payload);
//       break;
      
//     default:
//       console.log(`ℹ️ Unhandled webhook topic: ${normalizedTopic}`);
//   }
// }

// /**
//  * Handle customer created webhook
//  */
// async function handleCustomerCreate(store, customer) {
//   console.log(`👤 New customer created: ${customer.email}`);
  
//   // Broadcast to agents
//   broadcastToAgents({
//     type: 'webhook',
//     event: 'customer_created',
//     storeId: store.id,
//     storeIdentifier: store.store_identifier,
//     shopDomain: store.shop_domain,
//     data: {
//       customerId: customer.id,
//       email: customer.email,
//       name: `${customer.first_name} ${customer.last_name}`,
//       totalSpent: customer.total_spent,
//       ordersCount: customer.orders_count
//     },
//     timestamp: new Date().toISOString()
//   });
// }

// /**
//  * Handle customer updated webhook
//  */
// async function handleCustomerUpdate(store, customer) {
//   console.log(`👤 Customer updated: ${customer.email}`);
  
//   // Find active conversations with this customer
//   const conversations = await db.getConversations({
//     storeId: store.id,
//     customerEmail: customer.email,
//     status: 'open'
//   });
  
//   // Broadcast update to agents for each conversation
//   conversations.forEach(conv => {
//     broadcastToAgents({
//       type: 'customer_updated',
//       conversationId: conv.id,
//       storeId: store.id,
//       customer: {
//         customerId: customer.id,
//         email: customer.email,
//         name: `${customer.first_name} ${customer.last_name}`,
//         totalSpent: customer.total_spent,
//         ordersCount: customer.orders_count,
//         tags: customer.tags ? customer.tags.split(',').map(t => t.trim()) : []
//       },
//       timestamp: new Date().toISOString()
//     });
//   });
// }

// /**
//  * Handle order created webhook
//  */
// async function handleOrderCreate(store, order) {
//   console.log(`🛍️ New order created: ${order.name} - ${order.total_price} ${order.currency}`);
  
//   // Find conversations with this customer
//   const conversations = await db.getConversations({
//     storeId: store.id,
//     customerEmail: order.email,
//     status: 'open'
//   });
  
//   // Broadcast new order to agents
//   broadcastToAgents({
//     type: 'webhook',
//     event: 'order_created',
//     storeId: store.id,
//     storeIdentifier: store.store_identifier,
//     shopDomain: store.shop_domain,
//     data: {
//       orderId: order.id,
//       orderName: order.name,
//       customerEmail: order.email,
//       totalPrice: order.total_price,
//       currency: order.currency,
//       financialStatus: order.financial_status,
//       lineItems: order.line_items?.map(item => ({
//         title: item.title,
//         quantity: item.quantity,
//         price: item.price
//       })) || []
//     },
//     conversations: conversations.map(c => c.id),
//     timestamp: new Date().toISOString()
//   });
// }

// /**
//  * Handle order cancelled webhook
//  */
// async function handleOrderCancelled(store, order) {
//   console.log(`❌ Order cancelled: ${order.name}`);
  
//   broadcastToAgents({
//     type: 'webhook',
//     event: 'order_cancelled',
//     storeId: store.id,
//     storeIdentifier: store.store_identifier,
//     data: {
//       orderId: order.id,
//       orderName: order.name,
//       customerEmail: order.email,
//       cancelReason: order.cancel_reason
//     },
//     timestamp: new Date().toISOString()
//   });
// }

// /**
//  * Handle app uninstalled webhook
//  */
// async function handleAppUninstalled(store, payload) {
//   console.log(`🚫 App uninstalled from: ${store.shop_domain}`);
  
//   // Mark store as inactive
//   await db.updateStoreSettings(store.id, {
//     is_active: false,
//     websocket_connected: false
//   });
  
//   // Broadcast to agents
//   broadcastToAgents({
//     type: 'webhook',
//     event: 'app_uninstalled',
//     storeId: store.id,
//     storeIdentifier: store.store_identifier,
//     shopDomain: store.shop_domain,
//     timestamp: new Date().toISOString()
//   });
// }

// module.exports = {
//   rawBodyMiddleware,
//   handleWebhook,
//   verifyWebhook
// };

// backend/webhooks.js
const crypto = require('crypto');
const db = require('./database');
const queueManager = require('./queue-manager');

/**
 * Raw body middleware for webhook verification
 */
function rawBodyMiddleware(req, res, next) {
  let data = '';
  req.setEncoding('utf8');
  
  req.on('data', chunk => {
    data += chunk;
  });
  
  req.on('end', () => {
    req.rawBody = data;
    try {
      req.body = JSON.parse(data);
    } catch (error) {
      req.body = {};
    }
    next();
  });
}

/**
 * Verify Shopify webhook HMAC
 */
function verifyWebhook(rawBody, hmacHeader) {
  if (!process.env.SHOPIFY_API_SECRET) {
    console.warn('⚠️ SHOPIFY_API_SECRET not set - skipping webhook verification');
    return true;
  }
  
  const hash = crypto
    .createHmac('sha256', process.env.SHOPIFY_API_SECRET)
    .update(rawBody, 'utf8')
    .digest('base64');
  
  return hash === hmacHeader;
}

/**
 * Main webhook handler - Now with queue integration
 */
async function handleWebhook(req, res) {
  const { shop, topic } = req.params;
  const hmac = req.get('X-Shopify-Hmac-Sha256');
  
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📬 SHOPIFY WEBHOOK RECEIVED');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('Topic:', topic);
  console.log('Shop:', shop);
  console.log('Time:', new Date().toISOString());
  
  // Verify webhook (only in production)
  if (process.env.NODE_ENV === 'production') {
    if (!verifyWebhook(req.rawBody, hmac)) {
      console.log('❌ Webhook verification failed');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
      return res.status(401).json({ error: 'Webhook verification failed' });
    }
    console.log('✅ Webhook verified');
  } else {
    console.log('⚠️ Development mode - skipping verification');
  }
  
  // Respond immediately to Shopify (they require 200 within 5 seconds)
  res.status(200).send('Webhook queued');
  
  try {
    // Get store from database
    const store = await db.getStoreByDomain(shop);
    
    if (!store) {
      console.log('❌ Store not found:', shop);
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
      return;
    }
    
    console.log('✅ Store found:', store.store_identifier);
    
    // Update last webhook timestamp
    await db.updateStoreSettings(store.id, {
      last_webhook_at: new Date()
    });
    
    // Queue webhook for async processing
    const priority = ['orders/create', 'customers/create'].includes(topic) ? 'high' : 'normal';
    await queueManager.queueWebhook(store, topic, req.body, priority);
    
    console.log('✅ Webhook queued for processing');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  } catch (error) {
    console.error('❌ Webhook queueing error:', error);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  }
}

module.exports = {
  rawBodyMiddleware,
  handleWebhook,
  verifyWebhook
};