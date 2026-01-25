
const crypto = require('crypto');
const db = require('./database');
const { registerWebhooks } = require('./shopify-api');

// Environment variables
const SHOPIFY_API_KEY = process.env.SHOPIFY_API_KEY;
const SHOPIFY_API_SECRET = process.env.SHOPIFY_API_SECRET;
const SCOPES = process.env.SCOPES || 'read_customers,read_orders,read_products';
const APP_URL = process.env.APP_URL || 'http://localhost:3000';

// Validate required environment variables
if (!SHOPIFY_API_KEY || !SHOPIFY_API_SECRET) {
  throw new Error('❌ Missing required environment variables: SHOPIFY_API_KEY, SHOPIFY_API_SECRET');
}

// Use Redis (will auto-fallback to stub in development)
let redis;
try {
  redis = require('./redis-manager');
  console.log('✅ Using Redis for OAuth state management');
} catch (error) {
  redis = require('./redis-manager-stub');
  console.log('⚠️  Using Redis stub for OAuth state management');
}

/**
 * Generate auth URL for OAuth
 */
async function getAuthUrl(shop) {
  try {
    // Validate shop domain
    const shopDomain = shop
      .toLowerCase()
      .replace(/https?:\/\//, '')
      .replace(/\/$/, '');
    
    if (!shopDomain.endsWith('.myshopify.com')) {
      throw new Error('Invalid shop domain');
    }
    
    const nonce = crypto.randomBytes(16).toString('hex');
    const redirectUri = `${APP_URL}/auth/callback`;
    
    // Store nonce with timestamp (expire after 10 minutes)
    await redis.set(`oauth_nonce:${nonce}`, { 
      shop: shopDomain,
      timestamp: Date.now()
    }, 600); // 10 min TTL
    
    const authUrl = `https://${shopDomain}/admin/oauth/authorize?` +
      `client_id=${SHOPIFY_API_KEY}&` +
      `scope=${SCOPES}&` +
      `redirect_uri=${redirectUri}&` +
      `state=${nonce}`;

    console.log('🔐 Generated auth URL for shop:', shopDomain);
    return authUrl;
  } catch (error) {
    console.error('❌ Error generating auth URL:', error);
    throw error;
  }
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

  try {
    // Verify nonce
    const nonceData = await redis.get(`oauth_nonce:${state}`);
    if (!nonceData || nonceData.shop !== shop.toLowerCase()) {
      console.log('❌ Invalid nonce or shop mismatch');
      return res.status(403).json({ error: 'Invalid request - nonce verification failed' });
    }
    
    // Remove used nonce
    await redis.del(`oauth_nonce:${state}`);

    // Verify HMAC
    if (!verifyHmac(req.query, hmac)) {
      console.log('❌ HMAC verification failed');
      return res.status(403).json({ error: 'Invalid HMAC' });
    }

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

    if (!response.ok) {
      const errorText = await response.text();
      console.log('❌ Failed to obtain access token:', errorText);
      return res.status(400).json({ error: 'Failed to obtain access token' });
    }

    const data = await response.json();

    if (data.access_token) {
      console.log('✅ Access token obtained');
      
      // Get shop info
      let shopInfo;
      try {
        shopInfo = await getShopInfo(shop, data.access_token);
      } catch (error) {
        console.error('❌ Failed to get shop info:', error);
        return res.status(500).json({ error: 'Failed to retrieve shop information' });
      }
      
      // Generate unique store identifier
      const storeIdentifier = shop.replace('.myshopify.com', '');
      
      // Register store in database
      let store;
      try {
        store = await db.registerStore({
          store_identifier: storeIdentifier,
          shop_domain: shop,
          brand_name: shopInfo.name || shop,
          access_token: data.access_token,
          scope: data.scope,
          is_active: true,
          installed_at: new Date(),
          contact_email: shopInfo.email,
          currency: shopInfo.currency,
          timezone: shopInfo.timezone || shopInfo.iana_timezone || 'UTC'
        });
        
        console.log('✅ Store registered:', store.id);
      } catch (error) {
        console.error('❌ Failed to register store in database:', error);
        return res.status(500).json({ error: 'Failed to register store' });
      }
      
      // Register webhooks (non-blocking)
      const webhookUrl = `${APP_URL}/webhooks`;
      registerWebhooks(store, webhookUrl)
        .then(results => {
          const successful = results.filter(r => r.success).length;
          console.log(`✅ Registered ${successful}/${results.length} webhooks`);
        })
        .catch(error => {
          console.error('⚠️  Webhook registration failed (non-critical):', error);
        });
      
      console.log('✅ OAuth complete!');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
      
      // Redirect to success page
      res.send(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Installation Complete</title>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <style>
            * {
              margin: 0;
              padding: 0;
              box-sizing: border-box;
            }
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
              display: flex;
              justify-content: center;
              align-items: center;
              min-height: 100vh;
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
              padding: 20px;
            }
            .card {
              background: white;
              padding: 3rem;
              border-radius: 12px;
              box-shadow: 0 20px 60px rgba(0,0,0,0.3);
              text-align: center;
              max-width: 500px;
              width: 100%;
              animation: slideUp 0.5s ease-out;
            }
            @keyframes slideUp {
              from {
                opacity: 0;
                transform: translateY(30px);
              }
              to {
                opacity: 1;
                transform: translateY(0);
              }
            }
            .success {
              color: #48bb78;
              font-size: 4rem;
              margin-bottom: 1rem;
              animation: bounce 1s ease-in-out;
            }
            @keyframes bounce {
              0%, 100% { transform: translateY(0); }
              50% { transform: translateY(-10px); }
            }
            h1 {
              color: #2d3748;
              margin-bottom: 1rem;
              font-size: 2rem;
            }
            p {
              color: #4a5568;
              line-height: 1.8;
              margin-bottom: 1.5rem;
              font-size: 1.1rem;
            }
            .info {
              margin: 2rem 0;
              padding: 1.5rem;
              background: #f7fafc;
              border-radius: 8px;
              border-left: 4px solid #667eea;
            }
            .info-row {
              display: flex;
              justify-content: space-between;
              margin: 0.75rem 0;
              padding: 0.5rem 0;
              border-bottom: 1px solid #e2e8f0;
            }
            .info-row:last-child {
              border-bottom: none;
            }
            .label {
              font-weight: 600;
              color: #2d3748;
            }
            .value {
              color: #4a5568;
              font-family: monospace;
            }
            .store-id {
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
              color: white;
              padding: 1rem 1.5rem;
              border-radius: 8px;
              font-family: monospace;
              font-size: 1.2rem;
              font-weight: bold;
              margin: 1.5rem 0;
              box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
            }
            .next-steps {
              text-align: left;
              margin-top: 2rem;
              padding: 1.5rem;
              background: #edf2f7;
              border-radius: 8px;
            }
            .next-steps h3 {
              color: #2d3748;
              margin-bottom: 1rem;
              font-size: 1.1rem;
            }
            .next-steps ol {
              margin-left: 1.5rem;
              color: #4a5568;
              line-height: 1.8;
            }
            .next-steps li {
              margin: 0.5rem 0;
            }
            small {
              color: #718096;
              font-size: 0.9rem;
            }
            .footer {
              margin-top: 2rem;
              padding-top: 1.5rem;
              border-top: 1px solid #e2e8f0;
              color: #718096;
              font-size: 0.9rem;
            }
          </style>
        </head>
        <body>
          <div class="card">
            <div class="success">✓</div>
            <h1>Installation Complete!</h1>
            <p>Your Shopify store has been successfully connected to the messaging system.</p>
            
            <div class="info">
              <div class="info-row">
                <span class="label">Store Name:</span>
                <span class="value">${shopInfo.name}</span>
              </div>
              <div class="info-row">
                <span class="label">Domain:</span>
                <span class="value">${shop}</span>
              </div>
              <div class="info-row">
                <span class="label">Currency:</span>
                <span class="value">${shopInfo.currency}</span>
              </div>
            </div>
            
            <div class="store-id">
              Store ID: ${storeIdentifier}
            </div>
            
            <small>Use this ID to configure your chat widget</small>

            <div class="next-steps">
              <h3>📋 Next Steps:</h3>
              <ol>
                <li>Add the chat widget to your store theme</li>
                <li>Configure your widget settings in the admin panel</li>
                <li>Test the chat functionality with a test customer</li>
                <li>Train your support team on the new system</li>
              </ol>
            </div>

            <div class="footer">
              <strong>Need help?</strong> Contact support or check the documentation
            </div>
          </div>
        </body>
        </html>
      `);
    } else {
      console.log('❌ Access token not found in response');
      res.status(400).json({ error: 'Failed to obtain access token' });
    }
  } catch (error) {
    console.error('❌ OAuth callback error:', error);
    res.status(500).json({ 
      error: 'OAuth failed',
      message: error.message 
    });
  }
}

/**
 * Verify Shopify HMAC
 */
function verifyHmac(query, hmac) {
  if (!hmac) {
    console.error('❌ No HMAC provided');
    return false;
  }

  try {
    const { hmac: _hmac, signature: _signature, ...params } = query;
    
    const message = Object.keys(params)
      .sort()
      .map(key => `${key}=${params[key]}`)
      .join('&');
    
    const generatedHash = crypto
      .createHmac('sha256', SHOPIFY_API_SECRET)
      .update(message)
      .digest('hex');
    
    // Timing-safe comparison
    return crypto.timingSafeEqual(
      Buffer.from(generatedHash, 'utf8'),
      Buffer.from(hmac, 'utf8')
    );
  } catch (error) {
    console.error('❌ HMAC verification error:', error);
    return false;
  }
}

/**
 * Get shop info from Shopify
 */
async function getShopInfo(shop, accessToken) {
  const API_VERSION = process.env.SHOPIFY_API_VERSION || '2024-01';
  
  try {
    const response = await fetch(
      `https://${shop}/admin/api/${API_VERSION}/shop.json`,
      {
        headers: {
          'X-Shopify-Access-Token': accessToken,
          'Content-Type': 'application/json'
        }
      }
    );
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Shopify API error: ${response.status} - ${errorText}`);
    }
    
    const data = await response.json();
    return data.shop;
  } catch (error) {
    console.error('❌ Error fetching shop info:', error);
    throw error;
  }
}

/**
 * Handle app uninstall (webhook)
 */
async function handleAppUninstall(shop) {
  try {
    console.log(`⚠️  App uninstalled from: ${shop}`);
    
    const store = await db.getStoreByDomain(shop);
    if (store) {
      // Mark store as inactive instead of deleting
      await db.updateStoreSettings(store.id, { 
        is_active: false,
        websocket_connected: false
      });
      
      console.log(`✅ Store marked as inactive: ${shop}`);
    }
  } catch (error) {
    console.error('❌ Error handling app uninstall:', error);
  }
}

module.exports = {
  getAuthUrl,
  handleCallback,
  verifyHmac,
  handleAppUninstall
};