
//backend/shopify-handler.js
const db = require('./db');

/**
 * Get shop by domain from database (using Drizzle)
 */
async function getShopByDomain(domain) {
  try {
    return await db.getStoreByDomain(domain);
  } catch (error) {
    console.error('Error fetching shop:', error);
    throw error;
  }
}

/**
 * Get shop by identifier
 */
async function getShopByIdentifier(identifier) {
  try {
    return await db.getStoreByIdentifier(identifier);
  } catch (error) {
    console.error('Error fetching shop:', error);
    throw error;
  }
}

/**
 * Create Shopify REST client for a shop
 */
function getShopClient(shop) {
  const fetch = require('node-fetch');
  
  return {
    shop: shop.shopDomain,
    accessToken: shop.accessToken,
    
    async request(endpoint, options = {}) {
      const url = `https://${shop.shopDomain}/admin/api/2024-01${endpoint}`;
      
      const response = await fetch(url, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          'X-Shopify-Access-Token': shop.accessToken,
          ...options.headers,
        },
      });
      
      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Shopify API error: ${response.status} - ${error}`);
      }
      
      return response.json();
    },
  };
}

/**
 * Fetch customer from Shopify
 */
async function getCustomer(client, customerId) {
  try {
    const data = await client.request(`/customers/${customerId}.json`);
    return data.customer;
  } catch (error) {
    console.error('Error fetching customer:', error);
    return null;
  }
}

/**
 * Fetch customer orders from Shopify
 */
async function getCustomerOrders(client, customerId) {
  try {
    const data = await client.request(`/customers/${customerId}/orders.json?limit=50`);
    return data.orders || [];
  } catch (error) {
    console.error('Error fetching customer orders:', error);
    return [];
  }
}

/**
 * Search customer by email
 */
async function searchCustomerByEmail(client, email) {
  try {
    const data = await client.request(`/customers/search.json?query=email:${encodeURIComponent(email)}`);
    return data.customers?.[0] || null;
  } catch (error) {
    console.error('Error searching customer:', error);
    return null;
  }
}

/**
 * Middleware to verify shop and attach to request
 */
async function verifyShop(req, res, next) {
  try {
    const shopDomain = req.get('X-Shop-Domain');
    
    if (!shopDomain) {
      return res.status(401).json({ error: 'Shop domain header is required' });
    }
    
    const shop = await getShopByDomain(shopDomain);
    
    if (!shop) {
      return res.status(404).json({ error: 'Shop not found or inactive' });
    }
    
    // Attach shop and client to request object
    req.shop = shop;
    req.shopifyClient = getShopClient(shop);
    
    next();
  } catch (error) {
    console.error('Shop verification error:', error);
    res.status(500).json({ error: 'Shop verification failed' });
  }
}

/**
 * Middleware to verify shop by identifier
 */
async function verifyShopByIdentifier(req, res, next) {
  try {
    const storeId = req.get('X-Store-Id') || req.params.storeId || req.query.storeId;
    
    if (!storeId) {
      return res.status(401).json({ error: 'Store ID required' });
    }
    
    const shop = await getShopByIdentifier(storeId);
    
    if (!shop) {
      return res.status(404).json({ error: 'Store not found or inactive' });
    }
    
    // Attach shop and client to request object
    req.shop = shop;
    req.shopifyClient = getShopClient(shop);
    
    next();
  } catch (error) {
    console.error('Shop verification error:', error);
    res.status(500).json({ error: 'Shop verification failed' });
  }
}

module.exports = {
  getShopByDomain,
  getShopByIdentifier,
  getShopClient,
  getCustomer,
  getCustomerOrders,
  searchCustomerByEmail,
  verifyShop,
  verifyShopByIdentifier,
};