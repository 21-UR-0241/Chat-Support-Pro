// // backend/routes/shopify-app-routes.js
// const express = require('express');
// const router = express.Router();
// const crypto = require('crypto');
// const axios = require('axios');

// // Shopify App Configuration
// const SHOPIFY_API_KEY = process.env.SHOPIFY_API_KEY;
// const SHOPIFY_API_SECRET = process.env.SHOPIFY_API_SECRET;
// const SHOPIFY_SCOPES = process.env.SHOPIFY_SCOPES || 'read_customers,read_orders,read_themes,write_themes';
// const APP_URL = process.env.SHOPIFY_APP_URL;

// /**
//  * STEP 1: Install Route - Starts OAuth flow
//  * URL: https://your-app.com/shopify/install?shop=store-name.myshopify.com
//  */
// router.get('/install', (req, res) => {
//   const shop = req.query.shop;
  
//   if (!shop) {
//     return res.status(400).send('Missing shop parameter');
//   }
  
//   // Validate shop domain
//   if (!shop.match(/^[a-z0-9-]+\.myshopify\.com$/)) {
//     return res.status(400).send('Invalid shop domain');
//   }
  
//   // Generate random state for security
//   const state = crypto.randomBytes(16).toString('hex');
//   req.session.state = state;
//   req.session.shop = shop;
  
//   // 🔍 DEBUG LOGGING
//   console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
//   console.log('🔍 SHOPIFY OAUTH DEBUG - INSTALL ROUTE');
//   console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
//   console.log('Shop:', shop);
//   console.log('State:', state);
//   console.log('');
//   console.log('Environment Variables:');
//   console.log('  SHOPIFY_API_KEY:', SHOPIFY_API_KEY ? `${SHOPIFY_API_KEY.substring(0, 10)}...` : 'MISSING ❌');
//   console.log('  SHOPIFY_API_SECRET:', SHOPIFY_API_SECRET ? 'SET ✅' : 'MISSING ❌');
//   console.log('  SHOPIFY_SCOPES:', SHOPIFY_SCOPES);
//   console.log('  SHOPIFY_APP_URL:', APP_URL || 'MISSING ❌');
//   console.log('');
  
//   const redirectUri = `${APP_URL}/shopify/callback`;
//   console.log('Constructed Redirect URI:', redirectUri);
//   console.log('');
  
//   // Build authorization URL
//   const authUrl = `https://${shop}/admin/oauth/authorize?` + 
//     `client_id=${SHOPIFY_API_KEY}&` +
//     `scope=${SHOPIFY_SCOPES}&` +
//     `redirect_uri=${redirectUri}&` +
//     `state=${state}`;
  
//   console.log('Full Authorization URL:');
//   console.log(authUrl);
//   console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  
//   res.redirect(authUrl);
// });

// /**
//  * STEP 2: Callback Route - Handles OAuth callback
//  * Shopify redirects here after user approves
//  */
// router.get('/callback', async (req, res) => {
//   const { code, hmac, shop, state } = req.query;
  
//   console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
//   console.log('🔄 SHOPIFY CALLBACK RECEIVED');
//   console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
//   console.log('Shop:', shop);
//   console.log('Code:', code ? 'RECEIVED ✅' : 'MISSING ❌');
//   console.log('HMAC:', hmac ? 'RECEIVED ✅' : 'MISSING ❌');
//   console.log('State:', state);
//   console.log('Session State:', req.session.state);
//   console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  
//   // Verify state matches (security check)
//   if (state !== req.session.state) {
//     console.error('❌ State validation failed!');
//     return res.status(403).send('Invalid state parameter');
//   }
  
//   // Verify HMAC (security check)
//   const map = Object.assign({}, req.query);
//   delete map.hmac;
//   delete map.signature;
  
//   const message = Object.keys(map)
//     .sort()
//     .map(key => `${key}=${map[key]}`)
//     .join('&');
  
//   const generatedHash = crypto
//     .createHmac('sha256', SHOPIFY_API_SECRET)
//     .update(message)
//     .digest('hex');
  
//   if (generatedHash !== hmac) {
//     console.error('❌ HMAC validation failed!');
//     console.error('Expected:', generatedHash);
//     console.error('Received:', hmac);
//     return res.status(403).send('HMAC validation failed');
//   }
  
//   console.log('✅ State and HMAC validation passed');
  
//   try {
//     // Exchange code for permanent access token
//     console.log('🔄 Exchanging code for access token...');
//     const tokenResponse = await axios.post(
//       `https://${shop}/admin/oauth/access_token`,
//       {
//         client_id: SHOPIFY_API_KEY,
//         client_secret: SHOPIFY_API_SECRET,
//         code: code
//       }
//     );
    
//     const accessToken = tokenResponse.data.access_token;
//     const scope = tokenResponse.data.scope;
    
//     console.log('✅ [Shopify App] Access token received for:', shop);
    
//     // Save store credentials to database
//     await saveStoreCredentials(shop, accessToken, scope);
    
//     // Inject widget into theme
//     await injectWidgetIntoTheme(shop, accessToken);
    
//     // Redirect to success page
//     res.redirect(`/shopify/success?shop=${shop}`);
    
//   } catch (error) {
//     console.error('❌ [Shopify App] OAuth error:', error.message);
//     console.error('Error details:', error.response?.data || error);
//     res.status(500).send('Installation failed. Please try again.');
//   }
// });

// /**
//  * STEP 3: Save Store Credentials
//  */
// async function saveStoreCredentials(shop, accessToken, scope) {
//   const db = require('../database');
  
//   const shopDomain = shop;
//   const storeIdentifier = shop.replace('.myshopify.com', '');
  
//   console.log('💾 Saving store credentials for:', storeIdentifier);
  
//   try {
//     // Get shop info from Shopify
//     const shopInfo = await axios.get(
//       `https://${shop}/admin/api/2024-01/shop.json`,
//       {
//         headers: {
//           'X-Shopify-Access-Token': accessToken
//         }
//       }
//     );
    
//     const shopData = shopInfo.data.shop;
    
//     // Save to database
//     await db.registerStore({
//       store_identifier: storeIdentifier,
//       shop_domain: shopDomain,
//       brand_name: shopData.name,
//       access_token: accessToken,
//       scope: scope,
//       timezone: shopData.timezone || 'UTC',
//       currency: shopData.currency || 'USD',
//       contact_email: shopData.email,
//       logo_url: shopData.logo?.src || null
//     });
    
//     console.log('✅ [Shopify App] Store registered:', storeIdentifier);
//   } catch (error) {
//     console.error('❌ Failed to save store credentials:', error.message);
//     throw error;
//   }
// }

// /**
//  * STEP 4: Inject Widget into Theme
//  * Automatically adds widget code to theme.liquid
//  */
// async function injectWidgetIntoTheme(shop, accessToken) {
//   try {
//     const storeIdentifier = shop.replace('.myshopify.com', '');
    
//     console.log('📝 Injecting widget for:', storeIdentifier);
    
//     // Get active theme
//     const themesResponse = await axios.get(
//       `https://${shop}/admin/api/2024-01/themes.json`,
//       {
//         headers: {
//           'X-Shopify-Access-Token': accessToken
//         }
//       }
//     );
    
//     const activeTheme = themesResponse.data.themes.find(t => t.role === 'main');
    
//     if (!activeTheme) {
//       throw new Error('No active theme found');
//     }
    
//     console.log('📝 [Shopify App] Found active theme:', activeTheme.name);
    
//     // Get theme.liquid content
//     const assetResponse = await axios.get(
//       `https://${shop}/admin/api/2024-01/themes/${activeTheme.id}/assets.json?asset[key]=layout/theme.liquid`,
//       {
//         headers: {
//           'X-Shopify-Access-Token': accessToken
//         }
//       }
//     );
    
//     let themeContent = assetResponse.data.asset.value;
    
//     // Check if widget already installed
//     if (themeContent.includes('ChatSupportConfig')) {
//       console.log('ℹ️ [Shopify App] Widget already installed');
//       return;
//     }
    
//     // Generate widget injection code
//     const widgetCode = `
//   {%- comment -%}
//   ============================================
//   CHAT WIDGET - AUTO CUSTOMER DETECTION
//   ============================================
//   {%- endcomment -%}
//   {% if customer %}
//     <script>
//       window.chatCustomerData = {
//         email: {{ customer.email | json }},
//         name: {{ customer.name | json }},
//         firstName: {{ customer.first_name | json }},
//         lastName: {{ customer.last_name | json }},
//         id: {{ customer.id | json }},
//         ordersCount: {{ customer.orders_count | json }},
//         totalSpent: {{ customer.total_spent | money_without_currency | json }}
//       };
//       console.log('✅ Customer auto-detected:', window.chatCustomerData.email);
//     </script>
//   {% endif %}

//   {%- comment -%}
//   ============================================
//   CHAT WIDGET - CART DATA
//   ============================================
//   {%- endcomment -%}
//   {% if cart.item_count > 0 %}
//     <script>
//       window.chatCartData = {
//         subtotal: {{ cart.total_price | money_without_currency | json }},
//         itemCount: {{ cart.item_count | json }},
//         currency: {{ cart.currency.iso_code | json }},
//         items: {{ cart.items | json }}
//       };
//       console.log('🛒 Cart data available:', window.chatCartData.itemCount, 'items, $' + window.chatCartData.subtotal);
//     </script>
//   {% endif %}

//   {%- comment -%}
//   ============================================
//   CHAT WIDGET CONFIGURATION & INITIALIZATION
//   ============================================
//   {%- endcomment -%}
//   <script>
//     window.ChatSupportConfig = {
//       storeId: '${storeIdentifier}',
//       apiUrl: '${APP_URL}'
//     };
//   </script>
//   <script src="${APP_URL}/widget-init.js" defer></script>
// `;
    
//     // Inject before </body>
//     const bodyCloseTag = '</body>';
//     const bodyIndex = themeContent.lastIndexOf(bodyCloseTag);
    
//     if (bodyIndex === -1) {
//       throw new Error('Could not find </body> tag in theme.liquid');
//     }
    
//     const updatedContent = 
//       themeContent.slice(0, bodyIndex) + 
//       widgetCode + 
//       themeContent.slice(bodyIndex);
    
//     // Update theme.liquid
//     await axios.put(
//       `https://${shop}/admin/api/2024-01/themes/${activeTheme.id}/assets.json`,
//       {
//         asset: {
//           key: 'layout/theme.liquid',
//           value: updatedContent
//         }
//       },
//       {
//         headers: {
//           'X-Shopify-Access-Token': accessToken,
//           'Content-Type': 'application/json'
//         }
//       }
//     );
    
//     console.log('✅ [Shopify App] Widget injected successfully!');
    
//   } catch (error) {
//     console.error('❌ [Shopify App] Failed to inject widget:', error.message);
//     throw error;
//   }
// }

// /**
//  * Success Page
//  */
// router.get('/success', (req, res) => {
//   const shop = req.query.shop;
  
//   console.log('✅ Showing success page for:', shop);
  
//   res.send(`
//     <!DOCTYPE html>
//     <html>
//     <head>
//       <title>Installation Complete</title>
//       <style>
//         body {
//           font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
//           display: flex;
//           align-items: center;
//           justify-content: center;
//           min-height: 100vh;
//           margin: 0;
//           background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
//         }
//         .container {
//           background: white;
//           padding: 48px;
//           border-radius: 16px;
//           box-shadow: 0 20px 60px rgba(0,0,0,0.3);
//           text-align: center;
//           max-width: 500px;
//         }
//         h1 {
//           color: #2d3748;
//           margin-bottom: 16px;
//         }
//         p {
//           color: #718096;
//           line-height: 1.6;
//           margin-bottom: 24px;
//         }
//         .success-icon {
//           font-size: 64px;
//           margin-bottom: 24px;
//         }
//         .button {
//           display: inline-block;
//           background: #667eea;
//           color: white;
//           padding: 12px 32px;
//           border-radius: 8px;
//           text-decoration: none;
//           font-weight: 600;
//         }
//         .button:hover {
//           background: #5a67d8;
//         }
//       </style>
//     </head>
//     <body>
//       <div class="container">
//         <div class="success-icon">✅</div>
//         <h1>Installation Complete!</h1>
//         <p>Chat Support Pro has been successfully installed on <strong>${shop}</strong>.</p>
//         <p>The chat widget is now active on your store. Customers can start chatting with your support team!</p>
//         <a href="https://${shop}/admin" class="button">Go to Store Admin</a>
//       </div>
//     </body>
//     </html>
//   `);
// });

// /**
//  * Uninstall Webhook Handler
//  * Removes widget when app is uninstalled
//  */
// router.post('/webhooks/app/uninstalled', async (req, res) => {
//   const shop = req.get('X-Shopify-Shop-Domain');
  
//   console.log('🗑️ [Shopify App] App uninstalled from:', shop);
  
//   // Mark store as inactive in database
//   const db = require('../database');
//   const store = await db.getStoreByDomain(shop);
  
//   if (store) {
//     await db.updateStoreSettings(store.id, { is_active: false });
//   }
  
//   res.status(200).send('OK');
// });

// module.exports = router;




// backend/routes/shopify-app-routes.js
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
 * DEBUG ENDPOINT - Check Configuration
 * URL: https://your-app.com/shopify/install/debug?shop=store-name.myshopify.com
 */
router.get('/install/debug', (req, res) => {
  const shop = req.query.shop || 'test-store.myshopify.com';
  
  const config = {
    SHOPIFY_API_KEY: SHOPIFY_API_KEY ? `${SHOPIFY_API_KEY.substring(0, 10)}... (${SHOPIFY_API_KEY.length} chars)` : '❌ MISSING',
    SHOPIFY_API_KEY_EXISTS: !!SHOPIFY_API_KEY,
    SHOPIFY_API_SECRET_EXISTS: !!SHOPIFY_API_SECRET,
    SHOPIFY_SCOPES: SHOPIFY_SCOPES,
    SHOPIFY_APP_URL: APP_URL || '❌ MISSING',
    redirectUri: APP_URL ? `${APP_URL}/shopify/callback` : '❌ CANNOT CONSTRUCT'
  };
  
  let authUrl = 'CANNOT GENERATE - MISSING CONFIG';
  let canGenerate = false;
  
  if (APP_URL && SHOPIFY_API_KEY) {
    const redirectUri = `${APP_URL}/shopify/callback`;
    authUrl = `https://${shop}/admin/oauth/authorize?` + 
      `client_id=${SHOPIFY_API_KEY}&` +
      `scope=${SHOPIFY_SCOPES}&` +
      `redirect_uri=${encodeURIComponent(redirectUri)}&` +
      `state=test123`;
    canGenerate = true;
  }
  
  res.json({
    timestamp: new Date().toISOString(),
    status: canGenerate ? '✅ READY' : '❌ CONFIGURATION ERROR',
    config,
    generatedAuthUrl: authUrl,
    expectedShopifyPartnersConfig: {
      appUrl: 'https://chat-support-pro.onrender.com',
      redirectUrls: ['https://chat-support-pro.onrender.com/shopify/callback'],
      distribution: 'Custom distribution with store added',
      clientId: 'Must match SHOPIFY_API_KEY'
    },
    troubleshooting: {
      step1: 'Verify all environment variables are set in Render',
      step2: 'Check Shopify Partners → App → Configuration → Redirect URLs matches',
      step3: 'Check Shopify Partners → App → Distribution is set to Custom',
      step4: 'Add your store domain to allowed stores list',
      step5: 'Client ID in Partners must match SHOPIFY_API_KEY'
    },
    testInstallUrl: `https://chat-support-pro.onrender.com/shopify/install?shop=${shop}`
  });
});

/**
 * STEP 1: Install Route - Starts OAuth flow
 * URL: https://your-app.com/shopify/install?shop=store-name.myshopify.com
 */
router.get('/install', (req, res) => {
  const shop = req.query.shop;
  
  if (!shop) {
    return res.status(400).send(`
      <h1>❌ Missing Shop Parameter</h1>
      <p>Usage: /shopify/install?shop=your-store.myshopify.com</p>
      <a href="/shopify/install/debug">View Debug Info</a>
    `);
  }
  
  // Validate shop domain
  if (!shop.match(/^[a-z0-9-]+\.myshopify\.com$/)) {
    return res.status(400).send(`
      <h1>❌ Invalid Shop Domain</h1>
      <p>Shop must be in format: store-name.myshopify.com</p>
      <p>You provided: ${shop}</p>
    `);
  }
  
  // ✅ VALIDATE ENVIRONMENT VARIABLES
  if (!SHOPIFY_API_KEY || !SHOPIFY_API_SECRET || !APP_URL) {
    console.error('❌ CRITICAL: Missing environment variables!');
    return res.status(500).send(`
      <h1>❌ Configuration Error</h1>
      <p>The app is not properly configured.</p>
      <h3>Missing Environment Variables:</h3>
      <ul>
        <li>SHOPIFY_API_KEY: ${SHOPIFY_API_KEY ? '✅ Set' : '❌ MISSING'}</li>
        <li>SHOPIFY_API_SECRET: ${SHOPIFY_API_SECRET ? '✅ Set' : '❌ MISSING'}</li>
        <li>SHOPIFY_APP_URL: ${APP_URL ? '✅ Set' : '❌ MISSING'}</li>
      </ul>
      <p><a href="/shopify/install/debug?shop=${shop}">View Debug Info</a></p>
    `);
  }
  
  // Generate random state for security
  const state = crypto.randomBytes(16).toString('hex');
  
  // Check if session is available
  if (!req.session) {
    console.error('❌ Session middleware not configured!');
    return res.status(500).send(`
      <h1>❌ Session Error</h1>
      <p>Session middleware is not configured. Please check server.js</p>
    `);
  }
  
  req.session.state = state;
  req.session.shop = shop;
  
  // Save session before redirecting
  req.session.save((err) => {
    if (err) {
      console.error('❌ Session save error:', err);
      return res.status(500).send('Session error. Please try again.');
    }
    
    // 🔍 DEBUG LOGGING
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🔍 SHOPIFY OAUTH DEBUG - INSTALL ROUTE');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('Shop:', shop);
    console.log('State:', state);
    console.log('Session ID:', req.sessionID);
    console.log('');
    console.log('Environment Variables:');
    console.log('  SHOPIFY_API_KEY:', SHOPIFY_API_KEY ? `${SHOPIFY_API_KEY.substring(0, 10)}...` : 'MISSING ❌');
    console.log('  SHOPIFY_API_SECRET:', SHOPIFY_API_SECRET ? 'SET ✅' : 'MISSING ❌');
    console.log('  SHOPIFY_SCOPES:', SHOPIFY_SCOPES);
    console.log('  SHOPIFY_APP_URL:', APP_URL);
    console.log('');
    
    const redirectUri = `${APP_URL}/shopify/callback`;
    console.log('Constructed Redirect URI:', redirectUri);
    console.log('');
    
    // Build authorization URL
    const authUrl = `https://${shop}/admin/oauth/authorize?` + 
      `client_id=${SHOPIFY_API_KEY}&` +
      `scope=${SHOPIFY_SCOPES}&` +
      `redirect_uri=${encodeURIComponent(redirectUri)}&` +
      `state=${state}`;
    
    console.log('Full Authorization URL:');
    console.log(authUrl);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    res.redirect(authUrl);
  });
});

/**
 * STEP 2: Callback Route - Handles OAuth callback
 * Shopify redirects here after user approves
 */
router.get('/callback', async (req, res) => {
  const { code, hmac, shop, state } = req.query;
  
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🔄 SHOPIFY CALLBACK RECEIVED');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('Shop:', shop);
  console.log('Code:', code ? 'RECEIVED ✅' : 'MISSING ❌');
  console.log('HMAC:', hmac ? 'RECEIVED ✅' : 'MISSING ❌');
  console.log('State:', state);
  console.log('Session State:', req.session?.state);
  console.log('Session exists:', !!req.session);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  
  // Check if session exists
  if (!req.session) {
    console.error('❌ No session found in callback!');
    return res.status(403).send('Session expired. Please try installing again.');
  }
  
  // Verify state matches (security check)
  if (state !== req.session.state) {
    console.error('❌ State validation failed!');
    console.error('Expected:', req.session.state);
    console.error('Received:', state);
    return res.status(403).send('Invalid state parameter. Please try installing again.');
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
    console.error('❌ HMAC validation failed!');
    console.error('Expected:', generatedHash);
    console.error('Received:', hmac);
    return res.status(403).send('HMAC validation failed');
  }
  
  console.log('✅ State and HMAC validation passed');
  
  try {
    // Exchange code for permanent access token
    console.log('🔄 Exchanging code for access token...');
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
    
    console.log('✅ Access token received for:', shop);
    console.log('   Scope:', scope);
    
    // Save store credentials to database
    await saveStoreCredentials(shop, accessToken, scope);
    
    // Inject widget into theme
    try {
      await injectWidgetIntoTheme(shop, accessToken);
    } catch (widgetError) {
      console.error('⚠️  Widget injection failed (non-critical):', widgetError.message);
      // Continue anyway - store is registered
    }
    
    // Clear session
    req.session.state = null;
    req.session.shop = null;
    
    // Redirect to success page
    res.redirect(`/shopify/success?shop=${shop}`);
    
  } catch (error) {
    console.error('❌ OAuth error:', error.message);
    console.error('Error details:', error.response?.data || error);
    res.status(500).send(`
      <h1>❌ Installation Failed</h1>
      <p>${error.message}</p>
      <p><a href="/shopify/install?shop=${shop}">Try Again</a></p>
    `);
  }
});

/**
 * STEP 3: Save Store Credentials
 */
async function saveStoreCredentials(shop, accessToken, scope) {
  const db = require('../database');
  
  const shopDomain = shop;
  const storeIdentifier = shop.replace('.myshopify.com', '');
  
  console.log('💾 Saving store credentials for:', storeIdentifier);
  
  try {
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
    
    console.log('📊 Shop Info:');
    console.log('   Name:', shopData.name);
    console.log('   Email:', shopData.email);
    console.log('   Currency:', shopData.currency);
    console.log('   Timezone:', shopData.timezone);
    
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
      logo_url: shopData.logo?.src || null,
      is_active: true
    });
    
    console.log('✅ Store registered:', storeIdentifier);
  } catch (error) {
    console.error('❌ Failed to save store credentials:', error.message);
    throw error;
  }
}

/**
 * STEP 4: Inject Widget into Theme
 * Automatically adds widget code to theme.liquid
 */
async function injectWidgetIntoTheme(shop, accessToken) {
  try {
    const storeIdentifier = shop.replace('.myshopify.com', '');
    
    console.log('📝 Injecting widget for:', storeIdentifier);
    
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
    
    console.log('📝 Found active theme:', activeTheme.name);
    
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
      console.log('ℹ️  Widget already installed');
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
    
    console.log('✅ Widget injected successfully!');
    
  } catch (error) {
    console.error('❌ Failed to inject widget:', error.message);
    throw error;
  }
}

/**
 * Success Page
 */
router.get('/success', (req, res) => {
  const shop = req.query.shop;
  
  console.log('✅ Showing success page for:', shop);
  
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Installation Complete</title>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1">
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
  
  console.log('🗑️  App uninstalled from:', shop);
  
  try {
    // Mark store as inactive in database
    const db = require('../database');
    const store = await db.getStoreByDomain(shop);
    
    if (store) {
      await db.updateStoreSettings(store.id, { is_active: false });
      console.log('✅ Store marked as inactive');
    }
  } catch (error) {
    console.error('❌ Uninstall webhook error:', error.message);
  }
  
  res.status(200).send('OK');
});

module.exports = router;