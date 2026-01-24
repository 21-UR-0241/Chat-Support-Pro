/**
 * Shopify API - Complete Multi-Store Implementation
 * Enhanced with rate limiting, caching, and error handling
 * FIXED: priority parameter issue
 */
const rateLimiter = require('./shopify-rate-limiter');
const redisManager = require('./redis-manager');
const crypto = require('crypto');

const API_VERSION = process.env.SHOPIFY_API_VERSION || '2024-01';

/**
 * Enhanced Shopify REST client with rate limiting + retry
 */
function getShopClient(store) {
  return {
    shop: store.shop_domain,
    accessToken: store.access_token,
    storeId: store.id,

    /**
     * Make rate-limited request to Shopify API
     * FIXED: Extract priority and retryCount before passing to fetch
     */
    async request(endpoint, options = {}) {
      const url = `https://${store.shop_domain}/admin/api/${API_VERSION}${endpoint}`;

      const attempt = async () => {
        // Extract custom options that shouldn't be passed to fetch
        // FIX: priority and retryCount are custom options, not fetch options
        const { priority, retryCount, ...fetchOptions } = options;

        const response = await fetch(url, {
          ...fetchOptions,  // FIXED: Now only passes valid fetch options
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
      };

      const retries = options.retryCount ?? 3;
      let lastError;

      for (let i = 0; i <= retries; i++) {
        try {
          return await rateLimiter.schedule(store.id, attempt);
        } catch (err) {
          lastError = err;
          if (i === retries) throw err;
          await new Promise(r => setTimeout(r, 500 * Math.pow(2, i)));
        }
      }

      throw lastError;
    },
  };
}

/**
 * Get customer context from Shopify by email with caching
 */
async function getCustomerContext(store, customerEmail) {
  const cached = await redisManager.getCustomerContext(store.id, customerEmail);
  if (cached) {
    console.log(`✅ Customer context from cache: ${customerEmail}`);
    return cached;
  }

  try {
    console.log(`📊 Fetching customer context for: ${customerEmail} from ${store.shop_domain}`);

    const client = getShopClient(store);

    // Search for customer by email (rate-limited)
    // Note: priority is custom option for internal use, not passed to fetch
    const searchResult = await client.request(
      `/customers/search.json?query=email:${encodeURIComponent(customerEmail)}`,
      { priority: 7 }
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

      await redisManager.cacheCustomerContext(store.id, customerEmail, notFoundContext, 300);
      return notFoundContext;
    }

    console.log(`✅ Customer found: ${customer.first_name} ${customer.last_name}`);

    // Get customer orders
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

    await redisManager.cacheCustomerContext(store.id, customerEmail, context, 1800);
    return context;

  } catch (error) {
    console.error('❌ Error fetching customer context:', error);
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
    const cached = await redisManager.client.get(cacheKey);
    if (cached) return JSON.parse(cached);

    const client = getShopClient(store);
    const result = await client.request(
      `/customers/search.json?query=email:${encodeURIComponent(email)}`,
      { priority: 7 }
    );

    const customer = result.data.customers?.[0] || null;

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
    const cached = await redisManager.client.get(cacheKey);
    if (cached) return JSON.parse(cached);

    const client = getShopClient(store);
    const result = await client.request(`/orders/${orderId}.json`, { priority: 6 });
    const order = result.data.order;

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
    const cached = await redisManager.client.get(cacheKey);
    if (cached) return JSON.parse(cached);

    const client = getShopClient(store);
    const result = await client.request(`/products/${productId}.json`, { priority: 5 });
    const product = result.data.product;

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
      body: JSON.stringify({ customer: { id: customerId, note } }),
      priority: 8
    });

    const customer = result.data.customer;
    await invalidateCustomerCache(store.id, customer.email);

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

    const customerResult = await client.request(`/customers/${customerId}.json`, { priority: 7 });
    const customer = customerResult.data.customer;

    const currentTags = customer.tags ? customer.tags.split(',').map(t => t.trim()) : [];
    const newTags = Array.isArray(tags) ? tags : [tags];
    const allTags = [...new Set([...currentTags, ...newTags])];

    const updateResult = await client.request(`/customers/${customerId}.json`, {
      method: 'PUT',
      body: JSON.stringify({ customer: { id: customerId, tags: allTags.join(', ') } }),
      priority: 8
    });

    const updatedCustomer = updateResult.data.customer;
    await invalidateCustomerCache(store.id, updatedCustomer.email);

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
      body: JSON.stringify({ customer: { id: customerId, ...updates } }),
      priority: 8
    });

    const customer = result.data.customer;
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
    const cached = await redisManager.client.get(cacheKey);
    if (cached) return JSON.parse(cached);

    const client = getShopClient(store);
    const result = await client.request('/shop.json', { priority: 3 });
    const shopInfo = result.data.shop;

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
 * Verify webhook signature (timing-safe)
 */
function verifyWebhookSignature(rawBody, hmacHeader) {
  if (!process.env.SHOPIFY_API_SECRET) {
    console.warn('⚠️ SHOPIFY_API_SECRET not set - skipping webhook verification');
    return true;
  }

  const hash = crypto
    .createHmac('sha256', process.env.SHOPIFY_API_SECRET)
    .update(rawBody, 'utf8')
    .digest('base64');

  return crypto.timingSafeEqual(
    Buffer.from(hash, 'utf8'),
    Buffer.from(hmacHeader || '', 'utf8')
  );
}

/**
 * Register webhooks for a store
 */
async function registerWebhooks(store, webhookUrl) {
  console.log(`\n📡 Registering webhooks for: ${store.shop_domain}`);

  const webhooks = [
    { topic: 'customers/create', address: `${webhookUrl}/${store.shop_domain}/customers-create` },
    { topic: 'customers/update', address: `${webhookUrl}/${store.shop_domain}/customers-update` },
    { topic: 'orders/create', address: `${webhookUrl}/${store.shop_domain}/orders-create` },
    { topic: 'orders/cancelled', address: `${webhookUrl}/${store.shop_domain}/orders-cancelled` },
    { topic: 'app/uninstalled', address: `${webhookUrl}/${store.shop_domain}/app-uninstalled` }
  ];

  const client = getShopClient(store);
  const results = [];

  let existingWebhooks = [];
  try {
    const existingResult = await client.request('/webhooks.json', { priority: 6 });
    existingWebhooks = existingResult.data.webhooks || [];
  } catch {}

  for (const webhook of webhooks) {
    try {
      const exists = existingWebhooks.find(w => w.topic === webhook.topic && w.address === webhook.address);
      if (exists) {
        results.push({ topic: webhook.topic, success: true, id: exists.id, existing: true });
        continue;
      }

      const result = await client.request('/webhooks.json', {
        method: 'POST',
        body: JSON.stringify({ webhook }),
        priority: 8
      });

      results.push({ topic: webhook.topic, success: !!result.data.webhook, id: result.data.webhook?.id, existing: false });
      await new Promise(r => setTimeout(r, 200));
    } catch (error) {
      results.push({ topic: webhook.topic, success: false, error: error.message });
    }
  }

  return results;
}

/**
 * Delete webhook
 */
async function deleteWebhook(store, webhookId) {
  try {
    const client = getShopClient(store);
    await client.request(`/webhooks/${webhookId}.json`, { method: 'DELETE', priority: 7 });
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
  } catch (error) {
    console.error('Error invalidating customer cache:', error);
  }
}

/**
 * Invalidate product cache
 */
async function invalidateProductCache(storeId, productId) {
  try {
    await redisManager.client.del(`product:${storeId}:${productId}`);
    const searchKeys = await redisManager.client.keys(`products:${storeId}:*`);
    if (searchKeys.length > 0) await redisManager.client.del(...searchKeys);
  } catch (error) {
    console.error('Error invalidating product cache:', error);
  }
}

/**
 * Bulk fetch customers (for analytics/reports)
 */
async function bulkFetchCustomers(store, options = {}) {
  const { limit = 250, sinceId = null } = options;

  try {
    const client = getShopClient(store);
    let endpoint = `/customers.json?limit=${limit}`;
    if (sinceId) endpoint += `&since_id=${sinceId}`;

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
  const { limit = 250, sinceId = null, status = 'any', createdAtMin = null } = options;

  try {
    const client = getShopClient(store);
    let endpoint = `/orders.json?limit=${limit}&status=${status}`;
    if (sinceId) endpoint += `&since_id=${sinceId}`;
    if (createdAtMin) endpoint += `&created_at_min=${createdAtMin}`;

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