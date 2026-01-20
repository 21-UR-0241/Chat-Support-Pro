/**
 * Shopify OAuth - Multi-Store Ready
 * Handles store installation via OAuth
 */

const crypto = require('crypto');
const db = require('./database');

const SHOPIFY_API_KEY = process.env.SHOPIFY_API_KEY;
const SHOPIFY_API_SECRET = process.env.SHOPIFY_API_SECRET;
const SCOPES = process.env.SCOPES || 'read_customers,read_orders,read_products';
const APP_URL = process.env.APP_URL || 'http://localhost:3000';

// Store nonces temporarily (in production, use Redis)
const nonces = new Map();

/**
 * Generate auth URL for OAuth
 */
async function getAuthUrl(shop) {
  // Validate shop domain
  const shopDomain = shop.replace(/https?:\/\//, '').replace(/\/$/, '');
  
  if (!shopDomain.endsWith('.myshopify.com')) {
    throw new Error('Invalid shop domain');
  }
  
  const nonce = crypto.randomBytes(16).toString('hex');
  const redirectUri = `${APP_URL}/auth/callback`;
  
  // Store nonce with timestamp (expire after 10 minutes)
  nonces.set(nonce, {
    shop: shopDomain,
    timestamp: Date.now()
  });
  
  // Clean up old nonces
  cleanupNonces();
  
  const authUrl = `https://${shopDomain}/admin/oauth/authorize?` +
    `client_id=${SHOPIFY_API_KEY}&` +
    `scope=${SCOPES}&` +
    `redirect_uri=${redirectUri}&` +
    `state=${nonce}`;

  console.log('🔐 Generated auth URL for shop:', shopDomain);
  return authUrl;
}

/**
 * Handle OAuth callback
 */
async function handleCallback(req, res) {
  const { shop, code, state, hmac } = req.query;

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🔄 SHOPIFY OAUTH CALLBACK');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('Shop:', shop);
  console.log('State:', state);

  // Validate parameters
  if (!shop || !code || !state) {
    console.log('❌ Missing required parameters');
    return res.status(400).json({ error: 'Missing required parameters' });
  }

  // Verify nonce
  const nonceData = nonces.get(state);
  if (!nonceData || nonceData.shop !== shop) {
    console.log('❌ Invalid nonce or shop mismatch');
    return res.status(403).json({ error: 'Invalid request' });
  }
  
  // Remove used nonce
  nonces.delete(state);

  // Verify HMAC
  if (!verifyHmac(req.query, hmac)) {
    console.log('❌ HMAC verification failed');
    return res.status(403).json({ error: 'Invalid HMAC' });
  }

  try {
    // Exchange code for access token
    const tokenUrl = `https://${shop}/admin/oauth/access_token`;
    const tokenData = {
      client_id: SHOPIFY_API_KEY,
      client_secret: SHOPIFY_API_SECRET,
      code
    };

    console.log('📡 Requesting access token...');
    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(tokenData)
    });

    const data = await response.json();

    if (data.access_token) {
      console.log('✅ Access token obtained');
      
      // Get shop info
      const shopInfo = await getShopInfo(shop, data.access_token);
      
      // Generate unique store identifier
      const storeIdentifier = shop.replace('.myshopify.com', '');
      
      // Register store in database
      const store = await db.registerStore({
        store_identifier: storeIdentifier,
        shop_domain: shop,
        brand_name: shopInfo.name || shop,
        access_token: data.access_token,
        scope: data.scope,
        is_active: true,
        installed_at: new Date(),
        contact_email: shopInfo.email,
        currency: shopInfo.currency,
        timezone: shopInfo.timezone || 'UTC'
      });
      
      console.log('✅ Store registered:', store.id);
      
      // Register webhooks
      const { registerWebhooks } = require('./shopify-api');
      const webhookUrl = `${APP_URL}/webhooks`;
      await registerWebhooks(store, webhookUrl);
      
      console.log('✅ OAuth complete!');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
      
      // Redirect to success page
      res.send(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Installation Complete</title>
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
              display: flex;
              justify-content: center;
              align-items: center;
              height: 100vh;
              margin: 0;
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            }
            .card {
              background: white;
              padding: 2rem;
              border-radius: 8px;
              box-shadow: 0 4px 6px rgba(0,0,0,0.1);
              text-align: center;
              max-width: 400px;
            }
            h1 { color: #2d3748; margin-bottom: 1rem; }
            p { color: #4a5568; line-height: 1.6; }
            .success { color: #48bb78; font-size: 3rem; }
            .store-id { 
              background: #edf2f7; 
              padding: 0.5rem 1rem; 
              border-radius: 4px; 
              font-family: monospace;
              margin: 1rem 0;
            }
            .info {
              margin: 1rem 0;
              padding: 1rem;
              background: #f7fafc;
              border-radius: 4px;
              font-size: 0.9rem;
            }
          </style>
        </head>
        <body>
          <div class="card">
            <div class="success">✓</div>
            <h1>Installation Complete!</h1>
            <p>Your Shopify store has been successfully connected to the messaging app.</p>
            
            <div class="info">
              <strong>Store:</strong> ${shopInfo.name}<br>
              <strong>Domain:</strong> ${shop}
            </div>
            
            <div class="store-id">
              Store ID: ${storeIdentifier}
            </div>
            
            <p><small>Use this ID to configure your chat widget.</small></p>
          </div>
        </body>
        </html>
      `);
    } else {
      console.log('❌ Failed to obtain access token');
      res.status(400).json({ error: 'Failed to obtain access token' });
    }
  } catch (error) {
    console.error('❌ OAuth callback error:', error);
    res.status(500).json({ error: 'OAuth failed: ' + error.message });
  }
}

/**
 * Verify Shopify HMAC
 */
function verifyHmac(query, hmac) {
  const { hmac: _hmac, signature: _signature, ...params } = query;
  
  const message = Object.keys(params)
    .sort()
    .map(key => `${key}=${params[key]}`)
    .join('&');
  
  const generatedHash = crypto
    .createHmac('sha256', SHOPIFY_API_SECRET)
    .update(message)
    .digest('hex');
  
  return generatedHash === hmac;
}

/**
 * Get shop info from Shopify
 */
async function getShopInfo(shop, accessToken) {
  const response = await fetch(`https://${shop}/admin/api/2024-01/shop.json`, {
    headers: {
      'X-Shopify-Access-Token': accessToken,
      'Content-Type': 'application/json'
    }
  });
  
  const data = await response.json();
  return data.shop;
}

/**
 * Clean up expired nonces
 */
function cleanupNonces() {
  const tenMinutesAgo = Date.now() - (10 * 60 * 1000);
  
  for (const [nonce, data] of nonces.entries()) {
    if (data.timestamp < tenMinutesAgo) {
      nonces.delete(nonce);
    }
  }
}

module.exports = {
  getAuthUrl,
  handleCallback,
  verifyHmac
};