// backend/routes/shopify-app.js
const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const axios = require('axios');

// Shopify App Configuration
const SHOPIFY_API_KEY = process.env.SHOPIFY_API_KEY;
const SHOPIFY_API_SECRET = process.env.SHOPIFY_API_SECRET;
const SHOPIFY_SCOPES = process.env.SHOPIFY_SCOPES || 'read_customers,read_orders,read_themes,write_themes';
const APP_URL = process.env.SHOPIFY_APP_URL;

/**
 * STEP 1: Install Route - Starts OAuth flow
 * URL: https://your-app.com/shopify/install?shop=store-name.myshopify.com
 */
router.get('/install', (req, res) => {
  const shop = req.query.shop;
  
  if (!shop) {
    return res.status(400).send('Missing shop parameter');
  }
  
  // Validate shop domain
  if (!shop.match(/^[a-z0-9-]+\.myshopify\.com$/)) {
    return res.status(400).send('Invalid shop domain');
  }
  
  // Generate random state for security
  const state = crypto.randomBytes(16).toString('hex');
  req.session.state = state;
  req.session.shop = shop;
  
  // Build authorization URL
  const authUrl = `https://${shop}/admin/oauth/authorize?` + 
    `client_id=${SHOPIFY_API_KEY}&` +
    `scope=${SHOPIFY_SCOPES}&` +
    `redirect_uri=${APP_URL}/shopify/callback&` +
    `state=${state}`;
  
  console.log('🔄 [Shopify App] Starting OAuth for shop:', shop);
  res.redirect(authUrl);
});

/**
 * STEP 2: Callback Route - Handles OAuth callback
 * Shopify redirects here after user approves
 */
router.get('/callback', async (req, res) => {
  const { code, hmac, shop, state } = req.query;
  
  // Verify state matches (security check)
  if (state !== req.session.state) {
    return res.status(403).send('Invalid state parameter');
  }
  
  // Verify HMAC (security check)
  const map = Object.assign({}, req.query);
  delete map.hmac;
  delete map.signature;
  
  const message = Object.keys(map)
    .sort()
    .map(key => `${key}=${map[key]}`)
    .join('&');
  
  const generatedHash = crypto
    .createHmac('sha256', SHOPIFY_API_SECRET)
    .update(message)
    .digest('hex');
  
  if (generatedHash !== hmac) {
    return res.status(403).send('HMAC validation failed');
  }
  
  try {
    // Exchange code for permanent access token
    const tokenResponse = await axios.post(
      `https://${shop}/admin/oauth/access_token`,
      {
        client_id: SHOPIFY_API_KEY,
        client_secret: SHOPIFY_API_SECRET,
        code: code
      }
    );
    
    const accessToken = tokenResponse.data.access_token;
    const scope = tokenResponse.data.scope;
    
    console.log('✅ [Shopify App] Access token received for:', shop);
    
    // Save store credentials to database
    await saveStoreCredentials(shop, accessToken, scope);
    
    // Inject widget into theme
    await injectWidgetIntoTheme(shop, accessToken);
    
    // Redirect to success page
    res.redirect(`/success?shop=${shop}`);
    
  } catch (error) {
    console.error('❌ [Shopify App] OAuth error:', error.message);
    res.status(500).send('Installation failed. Please try again.');
  }
});

/**
 * STEP 3: Save Store Credentials
 */
async function saveStoreCredentials(shop, accessToken, scope) {
  const db = require('../database');
  
  const shopDomain = shop;
  const storeIdentifier = shop.replace('.myshopify.com', '');
  
  // Get shop info from Shopify
  const shopInfo = await axios.get(
    `https://${shop}/admin/api/2024-01/shop.json`,
    {
      headers: {
        'X-Shopify-Access-Token': accessToken
      }
    }
  );
  
  const shopData = shopInfo.data.shop;
  
  // Save to database
  await db.registerStore({
    store_identifier: storeIdentifier,
    shop_domain: shopDomain,
    brand_name: shopData.name,
    access_token: accessToken,
    scope: scope,
    timezone: shopData.timezone || 'UTC',
    currency: shopData.currency || 'USD',
    contact_email: shopData.email,
    logo_url: shopData.logo?.src || null
  });
  
  console.log('✅ [Shopify App] Store registered:', storeIdentifier);
}

/**
 * STEP 4: Inject Widget into Theme
 * Automatically adds widget code to theme.liquid
 */
async function injectWidgetIntoTheme(shop, accessToken) {
  try {
    const storeIdentifier = shop.replace('.myshopify.com', '');
    
    // Get active theme
    const themesResponse = await axios.get(
      `https://${shop}/admin/api/2024-01/themes.json`,
      {
        headers: {
          'X-Shopify-Access-Token': accessToken
        }
      }
    );
    
    const activeTheme = themesResponse.data.themes.find(t => t.role === 'main');
    
    if (!activeTheme) {
      throw new Error('No active theme found');
    }
    
    console.log('📝 [Shopify App] Found active theme:', activeTheme.name);
    
    // Get theme.liquid content
    const assetResponse = await axios.get(
      `https://${shop}/admin/api/2024-01/themes/${activeTheme.id}/assets.json?asset[key]=layout/theme.liquid`,
      {
        headers: {
          'X-Shopify-Access-Token': accessToken
        }
      }
    );
    
    let themeContent = assetResponse.data.asset.value;
    
    // Check if widget already installed
    if (themeContent.includes('ChatSupportConfig')) {
      console.log('ℹ️ [Shopify App] Widget already installed');
      return;
    }
    
    // Generate widget injection code
    const widgetCode = `
  {%- comment -%}
  ============================================
  CHAT WIDGET - AUTO CUSTOMER DETECTION
  ============================================
  {%- endcomment -%}
  {% if customer %}
    <script>
      window.chatCustomerData = {
        email: {{ customer.email | json }},
        name: {{ customer.name | json }},
        firstName: {{ customer.first_name | json }},
        lastName: {{ customer.last_name | json }},
        id: {{ customer.id | json }},
        ordersCount: {{ customer.orders_count | json }},
        totalSpent: {{ customer.total_spent | money_without_currency | json }}
      };
      console.log('✅ Customer auto-detected:', window.chatCustomerData.email);
    </script>
  {% endif %}

  {%- comment -%}
  ============================================
  CHAT WIDGET - CART DATA
  ============================================
  {%- endcomment -%}
  {% if cart.item_count > 0 %}
    <script>
      window.chatCartData = {
        subtotal: {{ cart.total_price | money_without_currency | json }},
        itemCount: {{ cart.item_count | json }},
        currency: {{ cart.currency.iso_code | json }},
        items: {{ cart.items | json }}
      };
      console.log('🛒 Cart data available:', window.chatCartData.itemCount, 'items, $' + window.chatCartData.subtotal);
    </script>
  {% endif %}

  {%- comment -%}
  ============================================
  CHAT WIDGET CONFIGURATION & INITIALIZATION
  ============================================
  {%- endcomment -%}
  <script>
    window.ChatSupportConfig = {
      storeId: '${storeIdentifier}',
      apiUrl: '${APP_URL}'
    };
  </script>
  <script src="${APP_URL}/widget-init.js" defer></script>
`;
    
    // Inject before </body>
    const bodyCloseTag = '</body>';
    const bodyIndex = themeContent.lastIndexOf(bodyCloseTag);
    
    if (bodyIndex === -1) {
      throw new Error('Could not find </body> tag in theme.liquid');
    }
    
    const updatedContent = 
      themeContent.slice(0, bodyIndex) + 
      widgetCode + 
      themeContent.slice(bodyIndex);
    
    // Update theme.liquid
    await axios.put(
      `https://${shop}/admin/api/2024-01/themes/${activeTheme.id}/assets.json`,
      {
        asset: {
          key: 'layout/theme.liquid',
          value: updatedContent
        }
      },
      {
        headers: {
          'X-Shopify-Access-Token': accessToken,
          'Content-Type': 'application/json'
        }
      }
    );
    
    console.log('✅ [Shopify App] Widget injected successfully!');
    
  } catch (error) {
    console.error('❌ [Shopify App] Failed to inject widget:', error.message);
    throw error;
  }
}

/**
 * Success Page
 */
router.get('/success', (req, res) => {
  const shop = req.query.shop;
  
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Installation Complete</title>
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
          display: flex;
          align-items: center;
          justify-content: center;
          min-height: 100vh;
          margin: 0;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        }
        .container {
          background: white;
          padding: 48px;
          border-radius: 16px;
          box-shadow: 0 20px 60px rgba(0,0,0,0.3);
          text-align: center;
          max-width: 500px;
        }
        h1 {
          color: #2d3748;
          margin-bottom: 16px;
        }
        p {
          color: #718096;
          line-height: 1.6;
          margin-bottom: 24px;
        }
        .success-icon {
          font-size: 64px;
          margin-bottom: 24px;
        }
        .button {
          display: inline-block;
          background: #667eea;
          color: white;
          padding: 12px 32px;
          border-radius: 8px;
          text-decoration: none;
          font-weight: 600;
        }
        .button:hover {
          background: #5a67d8;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="success-icon">✅</div>
        <h1>Installation Complete!</h1>
        <p>Chat Support Pro has been successfully installed on <strong>${shop}</strong>.</p>
        <p>The chat widget is now active on your store. Customers can start chatting with your support team!</p>
        <a href="https://${shop}/admin" class="button">Go to Store Admin</a>
      </div>
    </body>
    </html>
  `);
});

/**
 * Uninstall Webhook Handler
 * Removes widget when app is uninstalled
 */
router.post('/webhooks/app/uninstalled', async (req, res) => {
  const shop = req.get('X-Shopify-Shop-Domain');
  
  console.log('🗑️ [Shopify App] App uninstalled from:', shop);
  
  // Mark store as inactive in database
  const db = require('../database');
  const store = await db.getStoreByDomain(shop);
  
  if (store) {
    await db.updateStoreSettings(store.id, { is_active: false });
  }
  
  res.status(200).send('OK');
});

module.exports = router;