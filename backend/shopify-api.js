/**
 * Shopify API - Complete Multi-Store Implementation
 * Enhanced with rate limiting, caching, and error handling
 */

const rateLimiter = require('./shopify-rate-limiter');
const redisManager = require('./redis-manager');

/**
 * Enhanced Shopify REST client with rate limiting
 */
function getShopClient(store) {
  return {
    shop: store.shop_domain,
    accessToken: store.access_token,
    storeId: store.id,
    
    /**
     * Make rate-limited request to Shopify API
     */
    async request(endpoint, options = {}) {
      const url = `https://${store.shop_domain}/admin/api/2024-01${endpoint}`;
      
      // Use rate limiter for this store
      return await rateLimiter.scheduleWithRetry(
        store.id,
        async () => {
          const response = await fetch(url, {
            ...options,
            headers: {
              'Content-Type': 'application/json',
              'X-Shopify-Access-Token': store.access_token,
              ...options.headers,
            },
          });
          
          // Check for errors
          if (!response.ok) {
            const errorText = await response.text();
            
            // Create detailed error
            const error = new Error(`Shopify API error: ${response.status}`);
            error.status = response.status;
            error.statusText = response.statusText;
            error.response = response;
            error.body = errorText;
            
            // Log detailed error
            console.error(`❌ Shopify API Error [${store.shop_domain}]:`, {
              endpoint,
              status: response.status,
              error: errorText.substring(0, 200)
            });
            
            throw error;
          }
          
          const data = await response.json();
          
          // Return both data and response (for headers)
          return {
            data,
            headers: response.headers,
            status: response.status
          };
        },
        {
          priority: options.priority || 5,
          retryCount: options.retryCount || 3
        }
      );
    },
  };
}

/**
 * Get customer context from Shopify by email with caching
 */
async function getCustomerContext(store, customerEmail) {
  // Check cache first
  const cacheKey = `customer_context:${store.id}:${customerEmail}`;
  const cached = await redisManager.getCustomerContext(store.id, customerEmail);
  
  if (cached) {
    console.log(`✅ Customer context from cache: ${customerEmail}`);
    return cached;
  }
  
  try {
    console.log(`📊 Fetching customer context for: ${customerEmail} from ${store.shop_domain}`);
    
    const client = getShopClient(store);
    
    // Search for customer by email (rate-limited)
    const searchResult = await client.request(
      `/customers/search.json?query=email:${encodeURIComponent(customerEmail)}`,
      { priority: 7 } // Higher priority for customer lookups
    );
    
    const customer = searchResult.data.customers?.[0];
    
    if (!customer) {
      console.log('⚠️ Customer not found in Shopify');
      
      const notFoundContext = {
        name: customerEmail,
        email: customerEmail,
        phone: null,
        totalSpent: '0.00',
        ordersCount: 0,
        recentOrders: [],
        tags: [],
        note: null,
        found: false
      };
      
      // Cache "not found" for shorter time
      await redisManager.cacheCustomerContext(store.id, customerEmail, notFoundContext, 300);
      
      return notFoundContext;
    }
    
    console.log(`✅ Customer found: ${customer.first_name} ${customer.last_name}`);
    
    // Get customer orders (rate-limited)
    const ordersResult = await client.request(
      `/customers/${customer.id}/orders.json?limit=10&status=any`,
      { priority: 6 }
    );
    const orders = ordersResult.data.orders || [];
    
    const context = {
      id: customer.id,
      name: `${customer.first_name || ''} ${customer.last_name || ''}`.trim() || customerEmail,
      firstName: customer.first_name,
      lastName: customer.last_name,
      email: customer.email,
      phone: customer.phone,
      totalSpent: customer.total_spent,
      ordersCount: customer.orders_count,
      recentOrders: orders.map(order => ({
        id: order.id,
        name: order.name,
        createdAt: order.created_at,
        totalPrice: order.total_price,
        currency: order.currency,
        financialStatus: order.financial_status,
        fulfillmentStatus: order.fulfillment_status,
        lineItems: order.line_items?.slice(0, 5).map(item => ({
          title: item.title,
          quantity: item.quantity,
          price: item.price
        })) || []
      })),
      tags: customer.tags ? customer.tags.split(',').map(t => t.trim()) : [],
      note: customer.note,
      verified: customer.verified_email,
      createdAt: customer.created_at,
      updatedAt: customer.updated_at,
      found: true
    };
    
    // Cache for 30 minutes
    await redisManager.cacheCustomerContext(store.id, customerEmail, context, 1800);
    
    return context;
    
  } catch (error) {
    console.error('❌ Error fetching customer context:', error);
    
    // Return minimal data on error
    return {
      name: customerEmail,
      email: customerEmail,
      phone: null,
      totalSpent: '0.00',
      ordersCount: 0,
      recentOrders: [],
      tags: [],
      note: null,
      found: false,
      error: error.message
    };
  }
}

/**
 * Get customer by email with caching
 */
async function getCustomerByEmail(store, email) {
  const cacheKey = `customer:${store.id}:${email}`;
  
  try {
    // Check cache
    const cached = await redisManager.client.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }
    
    const client = getShopClient(store);
    const result = await client.request(
      `/customers/search.json?query=email:${encodeURIComponent(email)}`,
      { priority: 7 }
    );
    
    const customer = result.data.customers?.[0] || null;
    
    // Cache for 15 minutes
    if (customer) {
      await redisManager.client.setex(cacheKey, 900, JSON.stringify(customer));
    }
    
    return customer;
  } catch (error) {
    console.error('Error fetching customer:', error);
    return null;
  }
}

/**
 * Get customer orders
 */
async function getCustomerOrders(store, customerId, limit = 50) {
  try {
    const client = getShopClient(store);
    const result = await client.request(
      `/customers/${customerId}/orders.json?limit=${limit}&status=any`,
      { priority: 5 }
    );
    return result.data.orders || [];
  } catch (error) {
    console.error('Error fetching customer orders:', error);
    return [];
  }
}

/**
 * Get single order
 */
async function getOrder(store, orderId) {
  const cacheKey = `order:${store.id}:${orderId}`;
  
  try {
    // Check cache
    const cached = await redisManager.client.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }
    
    const client = getShopClient(store);
    const result = await client.request(`/orders/${orderId}.json`, { priority: 6 });
    const order = result.data.order;
    
    // Cache for 10 minutes
    if (order) {
      await redisManager.client.setex(cacheKey, 600, JSON.stringify(order));
    }
    
    return order;
  } catch (error) {
    console.error('Error fetching order:', error);
    return null;
  }
}

/**
 * Search products with caching
 */
async function searchProducts(store, searchTerm, limit = 10) {
  const cacheKey = `products:${store.id}:${searchTerm}:${limit}`;
  
  try {
    // Check cache
    const cached = await redisManager.client.get(cacheKey);
    if (cached) {
      console.log('✅ Products from cache:', searchTerm);
      return JSON.parse(cached);
    }
    
    const client = getShopClient(store);
    const result = await client.request(
      `/products.json?title=${encodeURIComponent(searchTerm)}&limit=${limit}`,
      { priority: 4 }
    );
    
    const products = result.data.products.map(product => ({
      id: product.id,
      title: product.title,
      handle: product.handle,
      bodyHtml: product.body_html,
      vendor: product.vendor,
      productType: product.product_type,
      price: product.variants?.[0]?.price,
      compareAtPrice: product.variants?.[0]?.compare_at_price,
      images: product.images?.map(img => img.src) || [],
      tags: product.tags ? product.tags.split(',').map(t => t.trim()) : [],
      variants: product.variants?.map(v => ({
        id: v.id,
        title: v.title,
        price: v.price,
        availableForSale: v.available,
        sku: v.sku
      })) || []
    }));
    
    // Cache for 1 hour
    await redisManager.client.setex(cacheKey, 3600, JSON.stringify(products));
    
    return products;
  } catch (error) {
    console.error('Error searching products:', error);
    return [];
  }
}

/**
 * Get product by ID
 */
async function getProduct(store, productId) {
  const cacheKey = `product:${store.id}:${productId}`;
  
  try {
    // Check cache
    const cached = await redisManager.client.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }
    
    const client = getShopClient(store);
    const result = await client.request(`/products/${productId}.json`, { priority: 5 });
    const product = result.data.product;
    
    // Cache for 1 hour
    if (product) {
      await redisManager.client.setex(cacheKey, 3600, JSON.stringify(product));
    }
    
    return product;
  } catch (error) {
    console.error('Error fetching product:', error);
    return null;
  }
}

/**
 * Add note to customer
 */
async function addCustomerNote(store, customerId, note) {
  try {
    const client = getShopClient(store);
    const result = await client.request(`/customers/${customerId}.json`, {
      method: 'PUT',
      body: JSON.stringify({
        customer: {
          id: customerId,
          note: note
        }
      }),
      priority: 8 // High priority for updates
    });
    
    const customer = result.data.customer;
    
    // Invalidate cache
    await invalidateCustomerCache(store.id, customer.email);
    
    console.log(`✅ Note added to customer ${customerId}`);
    return customer;
  } catch (error) {
    console.error('Error adding customer note:', error);
    return null;
  }
}

/**
 * Add tags to customer
 */
async function addCustomerTags(store, customerId, tags) {
  try {
    const client = getShopClient(store);
    
    // Get current customer
    const customerResult = await client.request(`/customers/${customerId}.json`, { priority: 7 });
    const customer = customerResult.data.customer;
    
    // Merge tags
    const currentTags = customer.tags ? customer.tags.split(',').map(t => t.trim()) : [];
    const newTags = Array.isArray(tags) ? tags : [tags];
    const allTags = [...new Set([...currentTags, ...newTags])];
    
    // Update customer
    const updateResult = await client.request(`/customers/${customerId}.json`, {
      method: 'PUT',
      body: JSON.stringify({
        customer: {
          id: customerId,
          tags: allTags.join(', ')
        }
      }),
      priority: 8
    });
    
    const updatedCustomer = updateResult.data.customer;
    
    // Invalidate cache
    await invalidateCustomerCache(store.id, updatedCustomer.email);
    
    console.log(`✅ Tags added to customer ${customerId}:`, newTags);
    return updatedCustomer;
  } catch (error) {
    console.error('Error adding customer tags:', error);
    return null;
  }
}

/**
 * Update customer
 */
async function updateCustomer(store, customerId, updates) {
  try {
    const client = getShopClient(store);
    const result = await client.request(`/customers/${customerId}.json`, {
      method: 'PUT',
      body: JSON.stringify({
        customer: {
          id: customerId,
          ...updates
        }
      }),
      priority: 8
    });
    
    const customer = result.data.customer;
    
    // Invalidate cache
    await invalidateCustomerCache(store.id, customer.email);
    
    return customer;
  } catch (error) {
    console.error('Error updating customer:', error);
    return null;
  }
}

/**
 * Get shop info with caching
 */
async function getShopInfo(store) {
  const cacheKey = `shop_info:${store.id}`;
  
  try {
    // Check cache
    const cached = await redisManager.client.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }
    
    const client = getShopClient(store);
    const result = await client.request('/shop.json', { priority: 3 });
    const shopInfo = result.data.shop;
    
    // Cache for 24 hours (shop info rarely changes)
    if (shopInfo) {
      await redisManager.client.setex(cacheKey, 86400, JSON.stringify(shopInfo));
    }
    
    return shopInfo;
  } catch (error) {
    console.error('Error fetching shop info:', error);
    return null;
  }
}

/**
 * Verify webhook signature
 */
function verifyWebhookSignature(rawBody, hmacHeader) {
  const crypto = require('crypto');
  
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
 * Register webhooks for a store
 */
async function registerWebhooks(store, webhookUrl) {
  console.log(`\n📡 Registering webhooks for: ${store.shop_domain}`);
  
  const webhooks = [
    {
      topic: 'customers/create',
      address: `${webhookUrl}/${store.shop_domain}/customers-create`
    },
    {
      topic: 'customers/update',
      address: `${webhookUrl}/${store.shop_domain}/customers-update`
    },
    {
      topic: 'orders/create',
      address: `${webhookUrl}/${store.shop_domain}/orders-create`
    },
    {
      topic: 'orders/cancelled',
      address: `${webhookUrl}/${store.shop_domain}/orders-cancelled`
    },
    {
      topic: 'app/uninstalled',
      address: `${webhookUrl}/${store.shop_domain}/app-uninstalled`
    }
  ];
  
  const client = getShopClient(store);
  const results = [];
  
  // Get existing webhooks first
  let existingWebhooks = [];
  try {
    const existingResult = await client.request('/webhooks.json', { priority: 6 });
    existingWebhooks = existingResult.data.webhooks || [];
    console.log(`  ℹ️  Found ${existingWebhooks.length} existing webhooks`);
  } catch (error) {
    console.warn('  ⚠️  Could not fetch existing webhooks:', error.message);
  }
  
  for (const webhook of webhooks) {
    try {
      // Check if webhook already exists
      const exists = existingWebhooks.find(w => 
        w.topic === webhook.topic && w.address === webhook.address
      );
      
      if (exists) {
        console.log(`  ✓ Webhook already exists: ${webhook.topic}`);
        results.push({ 
          topic: webhook.topic, 
          success: true, 
          id: exists.id,
          existing: true
        });
        continue;
      }
      
      // Register new webhook
      const result = await client.request('/webhooks.json', {
        method: 'POST',
        body: JSON.stringify({ webhook }),
        priority: 8
      });
      
      results.push({ 
        topic: webhook.topic, 
        success: !!result.data.webhook, 
        id: result.data.webhook?.id,
        existing: false
      });
      
      console.log(`  ✅ Webhook registered: ${webhook.topic}`);
      
      // Small delay between registrations
      await sleep(200);
      
    } catch (error) {
      console.log(`  ❌ Failed to register webhook: ${webhook.topic} - ${error.message}`);
      results.push({ 
        topic: webhook.topic, 
        success: false, 
        error: error.message 
      });
    }
  }
  
  console.log(`✅ Webhook registration complete: ${results.filter(r => r.success).length}/${webhooks.length} successful\n`);
  
  return results;
}

/**
 * Delete webhook
 */
async function deleteWebhook(store, webhookId) {
  try {
    const client = getShopClient(store);
    await client.request(`/webhooks/${webhookId}.json`, {
      method: 'DELETE',
      priority: 7
    });
    
    console.log(`✅ Webhook deleted: ${webhookId}`);
    return true;
  } catch (error) {
    console.error('Error deleting webhook:', error);
    return false;
  }
}

/**
 * Get all webhooks for a store
 */
async function getWebhooks(store) {
  try {
    const client = getShopClient(store);
    const result = await client.request('/webhooks.json', { priority: 5 });
    return result.data.webhooks || [];
  } catch (error) {
    console.error('Error fetching webhooks:', error);
    return [];
  }
}

/**
 * Create draft order (for agents to help customers)
 */
async function createDraftOrder(store, draftOrderData) {
  try {
    const client = getShopClient(store);
    const result = await client.request('/draft_orders.json', {
      method: 'POST',
      body: JSON.stringify({ draft_order: draftOrderData }),
      priority: 8
    });
    
    return result.data.draft_order;
  } catch (error) {
    console.error('Error creating draft order:', error);
    return null;
  }
}

/**
 * Get inventory levels for a product
 */
async function getInventoryLevels(store, inventoryItemId) {
  try {
    const client = getShopClient(store);
    const result = await client.request(
      `/inventory_levels.json?inventory_item_ids=${inventoryItemId}`,
      { priority: 5 }
    );
    return result.data.inventory_levels || [];
  } catch (error) {
    console.error('Error fetching inventory levels:', error);
    return [];
  }
}

/**
 * Invalidate customer cache
 */
async function invalidateCustomerCache(storeId, email) {
  try {
    await redisManager.client.del(`customer_context:${storeId}:${email}`);
    await redisManager.client.del(`customer:${storeId}:${email}`);
    console.log(`🗑️  Cache invalidated for customer: ${email}`);
  } catch (error) {
    console.error('Error invalidating cache:', error);
  }
}

/**
 * Invalidate product cache
 */
async function invalidateProductCache(storeId, productId) {
  try {
    await redisManager.client.del(`product:${storeId}:${productId}`);
    
    // Also invalidate search results (they might contain this product)
    const searchKeys = await redisManager.client.keys(`products:${storeId}:*`);
    if (searchKeys.length > 0) {
      await redisManager.client.del(...searchKeys);
    }
    
    console.log(`🗑️  Cache invalidated for product: ${productId}`);
  } catch (error) {
    console.error('Error invalidating product cache:', error);
  }
}

/**
 * Helper: Sleep function
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Bulk fetch customers (for analytics/reports)
 */
async function bulkFetchCustomers(store, options = {}) {
  const { limit = 250, sinceId = null } = options;
  
  try {
    const client = getShopClient(store);
    let endpoint = `/customers.json?limit=${limit}`;
    
    if (sinceId) {
      endpoint += `&since_id=${sinceId}`;
    }
    
    const result = await client.request(endpoint, { priority: 3 });
    return result.data.customers || [];
  } catch (error) {
    console.error('Error bulk fetching customers:', error);
    return [];
  }
}

/**
 * Bulk fetch orders (for analytics/reports)
 */
async function bulkFetchOrders(store, options = {}) {
  const { 
    limit = 250, 
    sinceId = null,
    status = 'any',
    createdAtMin = null 
  } = options;
  
  try {
    const client = getShopClient(store);
    let endpoint = `/orders.json?limit=${limit}&status=${status}`;
    
    if (sinceId) {
      endpoint += `&since_id=${sinceId}`;
    }
    
    if (createdAtMin) {
      endpoint += `&created_at_min=${createdAtMin}`;
    }
    
    const result = await client.request(endpoint, { priority: 3 });
    return result.data.orders || [];
  } catch (error) {
    console.error('Error bulk fetching orders:', error);
    return [];
  }
}

module.exports = {
  getShopClient,
  getCustomerContext,
  getCustomerByEmail,
  getCustomerOrders,
  getOrder,
  searchProducts,
  getProduct,
  addCustomerNote,
  addCustomerTags,
  updateCustomer,
  getShopInfo,
  verifyWebhookSignature,
  registerWebhooks,
  deleteWebhook,
  getWebhooks,
  createDraftOrder,
  getInventoryLevels,
  invalidateCustomerCache,
  invalidateProductCache,
  bulkFetchCustomers,
  bulkFetchOrders
};