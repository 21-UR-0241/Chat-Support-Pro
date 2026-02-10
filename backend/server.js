
// require('dotenv').config();
// const express = require('express');
// const cors = require('cors');
// const http = require('http');
// const rateLimit = require('express-rate-limit');
// const helmet = require('helmet');
// const db = require('./database');
// const shopify = require('./shopify-api');
// const { rawBodyMiddleware, handleWebhook } = require('./webhooks');
// const { getAuthUrl, handleCallback } = require('./shopify-auth');
// const { initWebSocketServer, sendToConversation, broadcastToAgents, getWebSocketStats } = require('./websocket-server');
// const { hashPassword, verifyPassword, generateToken, authenticateToken } = require('./auth');
// const session = require('express-session');
// const shopifyAppRoutes = require('./routes/shopify-app-routes');
// const fileRoutes = require('./routes/fileroutes');
// const { handleOfflineEmailNotification, cancelPendingEmail, startEmailSweep, stopEmailSweep } = require('../frontend/src/admin/services/emailService');

// const app = express();
// const server = http.createServer(app);

// // Trust only first proxy (Render's load balancer)
// app.set('trust proxy', 1);

// // ============ UNIVERSAL CORS FIX ============
// app.use((req, res, next) => {
//   res.header('Access-Control-Allow-Origin', '*');
//   res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
//   res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
//   res.header('Access-Control-Allow-Credentials', 'true');
  
//   if (req.method === 'OPTIONS') {
//     return res.sendStatus(204);
//   }
//   next();
// });

// // ============ INITIALIZE WEBSOCKET SERVER ============
// console.log('🔌 Initializing WebSocket server...');
// initWebSocketServer(server);
// console.log('✅ WebSocket server initialized\n');

// console.log('\n🚀 Multi-Store Chat Server Starting...\n');

// // ============ HELPER FUNCTIONS ============

// function snakeToCamel(obj) {
//   if (!obj) return obj;
//   if (Array.isArray(obj)) return obj.map(snakeToCamel);
//   if (obj instanceof Date) return obj;
//   if (typeof obj !== 'object') return obj;
  
//   const camelObj = {};
//   for (const [key, value] of Object.entries(obj)) {
//     const camelKey = key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
//     camelObj[camelKey] = typeof value === 'object' && value !== null ? snakeToCamel(value) : value;
//   }
//   return camelObj;
// }

// function camelToSnake(obj) {
//   if (!obj) return obj;
//   if (Array.isArray(obj)) return obj.map(camelToSnake);
//   if (typeof obj !== 'object') return obj;
  
//   const snakeObj = {};
//   for (const [key, value] of Object.entries(obj)) {
//     const snakeKey = key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
//     snakeObj[snakeKey] = value;
//   }
//   return snakeObj;
// }

// // Security headers (relaxed for widget embedding)
// app.use(helmet({
//   contentSecurityPolicy: false,
//   crossOriginEmbedderPolicy: false,
//   crossOriginResourcePolicy: { policy: "cross-origin" },
//   frameguard: false
// }));

// // ⚠️ IMPORTANT: Webhook route BEFORE express.json()
// app.post('/webhooks/:shop/:topic', rawBodyMiddleware, handleWebhook);

// // JSON middleware for other routes
// app.use(express.json());

// app.use(session({
//   secret: process.env.JWT_SECRET,
//   resave: false,
//   saveUninitialized: false,
//   cookie: {
//     secure: process.env.NODE_ENV === 'production',
//     maxAge: 24 * 60 * 60 * 1000 // 24 hours
//   }
// }));

// // ============ WIDGET STATIC FILES ============

// app.get('/widget-init.js', (req, res) => {
//   res.set({
//     'Content-Type': 'application/javascript; charset=utf-8',
//     'Cache-Control': 'public, max-age=3600',
//     'X-Content-Type-Options': 'nosniff',
//     'Access-Control-Allow-Origin': '*',
//     'Access-Control-Allow-Methods': 'GET, OPTIONS',
//     'Access-Control-Allow-Headers': 'Content-Type, Authorization'
//   });
  
//   res.sendFile(__dirname + '/public/widget-init.js');
// });

// app.get('/widget.html', (req, res) => {
//   res.removeHeader('X-Frame-Options');
  
//   res.set({
//     'Content-Type': 'text/html; charset=utf-8',
//     'X-Content-Type-Options': 'nosniff',
//     'Cache-Control': 'no-cache, must-revalidate',
//     'Content-Security-Policy': "frame-ancestors *"
//   });
  
//   res.sendFile(__dirname + '/public/widget.html');
// });

// app.use(express.static('public'));

// // Rate limiting
// const limiter = rateLimit({
//   windowMs: 15 * 60 * 1000,
//   max: 200,
//   message: 'Too many requests from this IP, please try again later.',
//   standardHeaders: true,
//   legacyHeaders: false,
//   skip: (req) => {
//     // Skip rate limiting for authenticated employees (agents/admins)
//     const authHeader = req.headers.authorization;
//     if (authHeader && authHeader.startsWith('Bearer ')) {
//       try {
//         const { verifyToken } = require('./auth');
//         const user = verifyToken(authHeader.split(' ')[1]);
//         return !!user;
//       } catch (e) {
//         return false;
//       }
//     }
//     return false;
//   },
//   validate: {
//     xForwardedForHeader: false,
//     trustProxy: false
//   }
// });

// const widgetLimiter = rateLimit({
//   windowMs: 15 * 60 * 1000,
//   max: 500,
//   message: 'Too many requests, please try again later.',
//   standardHeaders: true,
//   legacyHeaders: false,
//   validate: {
//     xForwardedForHeader: false,
//     trustProxy: false
//   }
// });

// // Apply widget limiter to widget-specific routes BEFORE the general limiter
// app.use('/api/widget/', widgetLimiter);
// app.use('/api/customers/', widgetLimiter);
// app.use('/api/', limiter);

// const loginLimiter = rateLimit({
//   windowMs: 15 * 60 * 1000,
//   max: 5,
//   message: 'Too many login attempts, please try again later.',
//   skipSuccessfulRequests: true,
//   validate: {
//     xForwardedForHeader: false,
//     trustProxy: false
//   }
// });

// // Force HTTPS in production
// if (process.env.NODE_ENV === 'production') {
//   app.use((req, res, next) => {
//     if (req.header('x-forwarded-proto') !== 'https') {
//       res.redirect(`https://${req.header('host')}${req.url}`);
//     } else {
//       next();
//     }
//   });
// }

// // Request logger
// app.use((req, res, next) => {
//   console.log(`${req.method} ${req.path}`);
//   next();
// });

// // ============ HEALTH CHECK ============

// app.get('/health', async (req, res) => {
//   try {
//     await db.testConnection();
//     const wsStats = getWebSocketStats();
    
//     res.json({
//       status: 'healthy',
//       timestamp: new Date().toISOString(),
//       database: 'connected',
//       websocket: {
//         active: wsStats.totalConnections > 0,
//         connections: wsStats.totalConnections,
//         agents: wsStats.agentCount,
//         customers: wsStats.customerCount,
//         authenticated: wsStats.authenticatedCount,
//         activeConversations: wsStats.activeConversations
//       },
//       uptime: Math.floor(process.uptime()),
//       version: process.env.npm_package_version || '1.0.0',
//     });
//   } catch (error) {
//     res.status(503).json({
//       status: 'unhealthy',
//       error: error.message,
//       timestamp: new Date().toISOString(),
//     });
//   }
// });

// // ============ WIDGET API ENDPOINTS ============

// app.get('/api/stores/verify', async (req, res) => {
//   try {
//     const { domain } = req.query;
    
//     if (!domain) {
//       return res.status(400).json({ error: 'domain parameter required' });
//     }
    
//     const store = await db.getStoreByDomain(domain);
    
//     if (!store || !store.is_active) {
//       return res.status(404).json({ 
//         error: 'Store not found or inactive',
//         message: 'Please install the chat app from Shopify'
//       });
//     }
    
//     res.json({
//       storeId: store.id,
//       storeIdentifier: store.store_identifier,
//       shopDomain: store.shop_domain,
//       brandName: store.brand_name,
//       active: store.is_active,
//       verified: true
//     });
//   } catch (error) {
//     console.error('Store verification error:', error);
//     res.status(500).json({ error: 'Verification failed' });
//   }
// });

// app.get('/api/widget/settings', async (req, res) => {
//   try {
//     const { store: storeIdentifier } = req.query;
    
//     if (!storeIdentifier) {
//       return res.status(400).json({ error: 'store parameter required' });
//     }
    
//     const store = await db.getStoreByIdentifier(storeIdentifier);
    
//     if (!store || !store.is_active) {
//       return res.status(404).json({ error: 'Store not found or inactive' });
//     }
    
//     res.json({
//       storeId: store.id,
//       storeIdentifier: store.store_identifier,
//       brandName: store.brand_name,
//       primaryColor: store.primary_color || '#667eea',
//       logoUrl: store.logo_url,
//       widgetSettings: store.widget_settings || {
//         position: 'bottom-right',
//         greeting: 'Hi! How can we help you today?',
//         placeholder: 'Type your message...',
//         showAvatar: true
//       },
//       businessHours: store.business_hours,
//       timezone: store.timezone || 'UTC'
//     });
//   } catch (error) {
//     console.error('Widget settings error:', error);
//     res.status(500).json({ error: 'Failed to fetch settings' });
//   }
// });

// app.get('/api/widget/session', async (req, res) => {
//   try {
//     const { store } = req.query;

//     if (!store) {
//       return res.status(400).json({ error: 'store parameter required' });
//     }

//     const storeRecord = await db.getStoreByIdentifier(store);
//     if (!storeRecord || !storeRecord.is_active) {
//       return res.status(404).json({ error: 'Store not found or inactive' });
//     }

//     const { generateWidgetToken } = require('./auth');
//     const token = generateWidgetToken(storeRecord);

//     res.json({
//       token,
//       expiresIn: process.env.WIDGET_JWT_EXPIRES_IN || '2h'
//     });
//   } catch (error) {
//     console.error('Widget session error:', error);
//     res.status(500).json({ error: 'Failed to create widget session' });
//   }
// });

// // Look up existing conversation for a returning customer
// app.get('/api/widget/conversation/lookup', async (req, res) => {
//   try {
//     const { store, email } = req.query;
//     console.log(`🔍 [Widget Lookup] store=${store}, email=${email}`);
    
//     if (!store || !email) {
//       return res.status(400).json({ error: 'store and email parameters required' });
//     }
    
//     const storeRecord = await db.getStoreByIdentifier(store);
//     if (!storeRecord || !storeRecord.is_active) {
//       console.log(`❌ [Widget Lookup] Store not found for identifier: ${store}`);
//       return res.status(404).json({ error: 'Store not found or inactive' });
//     }
//     console.log(`✅ [Widget Lookup] Store found: id=${storeRecord.id}, identifier=${storeRecord.store_identifier}, domain=${storeRecord.shop_domain}`);
    
//     // Get conversations for this store
//     let conversations = await db.getConversations({ storeId: storeRecord.id });
//     console.log(`📋 [Widget Lookup] getConversations returned ${conversations.length} conversations for storeId=${storeRecord.id}`);
    
//     // Helper to get field value regardless of case (db may return snake or camel)
//     const getField = (obj, snake, camel) => obj[snake] ?? obj[camel];
    
//     // Find matching email - prefer open, then most recent
//     let match = conversations.find(c => 
//       getField(c, 'customer_email', 'customerEmail') === email && getField(c, 'status', 'status') === 'open'
//     );
//     if (!match) {
//       match = conversations.find(c => getField(c, 'customer_email', 'customerEmail') === email);
//     }
    
//     // If not found, try broader search without storeId filter
//     if (!match) {
//       console.log(`⚠️ [Widget Lookup] Not found in store-filtered results, trying broader search...`);
//       const allConversations = await db.getConversations({});
//       console.log(`📋 [Widget Lookup] Broad search returned ${allConversations.length} total conversations`);
      
//       const emailMatches = allConversations.filter(c => getField(c, 'customer_email', 'customerEmail') === email);
//       console.log(`📋 [Widget Lookup] Found ${emailMatches.length} conversations with email=${email}`);
      
//       // Accept any conversation from this store (by id or identifier)
//       const storeMatches = emailMatches.filter(c => {
//         const cStoreId = getField(c, 'store_id', 'storeId');
//         const cStoreIdent = getField(c, 'store_identifier', 'storeIdentifier');
//         return String(cStoreId) === String(storeRecord.id) ||
//           cStoreIdent === storeRecord.shop_domain ||
//           cStoreIdent === storeRecord.store_identifier ||
//           cStoreIdent === store;
//       });
      
//       match = storeMatches.find(c => getField(c, 'status', 'status') === 'open') || storeMatches[0];
//     }
    
//     if (match) {
//       const matchId = match.id;
//       const matchStoreId = getField(match, 'store_id', 'storeId');
//       const matchStatus = getField(match, 'status', 'status');
//       console.log(`✅ [Widget Lookup] Found conversation ${matchId} for ${email} (store_id=${matchStoreId}, status=${matchStatus})`);
//       res.json({ conversationId: matchId });
//     } else {
//       console.log(`ℹ️ [Widget Lookup] No conversation found for ${email} in store ${store}`);
//       res.json({ conversationId: null });
//     }
//   } catch (error) {
//     console.error('❌ Widget conversation lookup error:', error);
//     res.status(500).json({ error: 'Lookup failed' });
//   }
// });

// // ============ AUTHENTICATION ENDPOINTS ============

// app.post('/api/employees/login', loginLimiter, async (req, res) => {
//   try {
//     const { email, password } = req.body;
    
//     if (!email || !password) {
//       return res.status(400).json({ error: 'Email and password required' });
//     }
    
//     if (!email.includes('@')) {
//       return res.status(400).json({ error: 'Invalid email format' });
//     }
    
//     const employee = await db.getEmployeeByEmail(email);
    
//     if (!employee) {
//       return res.status(401).json({ error: 'Invalid email or password' });
//     }
    
//     if (!employee.is_active) {
//       return res.status(403).json({ error: 'Account is inactive' });
//     }
    
//     const validPassword = await verifyPassword(password, employee.password_hash);
    
//     if (!validPassword) {
//       return res.status(401).json({ error: 'Invalid email or password' });
//     }
    
//     await db.updateEmployeeStatus(employee.id, { 
//       last_login: new Date(),
//       is_online: true 
//     });
    
//     const token = generateToken(employee);
    
//     delete employee.password_hash;
//     delete employee.api_token;
    
//     res.json({
//       employee: snakeToCamel(employee),
//       token,
//       expiresIn: '7d'
//     });
//   } catch (error) {
//     console.error('Login error:', error);
//     res.status(500).json({ error: 'Login failed. Please try again.' });
//   }
// });

// app.post('/api/employees/logout', authenticateToken, async (req, res) => {
//   try {
//     await db.updateEmployeeStatus(req.user.id, { is_online: false });
//     res.json({ message: 'Logged out successfully' });
//   } catch (error) {
//     console.error('Logout error:', error);
//     res.status(500).json({ error: 'Logout failed' });
//   }
// });

// app.get('/api/auth/verify', authenticateToken, async (req, res) => {
//   try {
//     const employee = await db.getEmployeeByEmail(req.user.email);
    
//     if (!employee || !employee.is_active) {
//       return res.status(403).json({ error: 'Invalid session' });
//     }
    
//     delete employee.password_hash;
//     delete employee.api_token;
    
//     res.json({ employee: snakeToCamel(employee) });
//   } catch (error) {
//     res.status(500).json({ error: 'Verification failed' });
//   }
// });

// // ============ SHOPIFY OAUTH ROUTES ============

// app.get('/auth', async (req, res) => {
//   try {
//     const { shop } = req.query;
//     if (!shop) {
//       return res.status(400).json({ error: 'Shop parameter required' });
//     }
//     const authUrl = await getAuthUrl(shop);
//     res.redirect(authUrl);
//   } catch (error) {
//     console.error('Auth error:', error);
//     res.status(500).json({ error: 'Authentication failed' });
//   }
// });

// app.get('/auth/callback', handleCallback);

// // ============ SHOPIFY APP ROUTES ============
// app.use('/shopify', shopifyAppRoutes);

// // ============ FILE UPLOAD ROUTES ============
// app.use('/api/files', fileRoutes);

// // ============ STORE ENDPOINTS ============

// app.get('/api/stores', authenticateToken, async (req, res) => {
//   try {
//     const stores = await db.getAllActiveStores();
//     res.json(stores.map(snakeToCamel));
//   } catch (error) {
//     res.status(500).json({ error: error.message });
//   }
// });

// app.get('/api/customer-context/:storeId/:email', authenticateToken, async (req, res) => {
//   try {
//     const store = await db.getStoreByIdentifier(req.params.storeId);
//     if (!store) {
//       return res.status(404).json({ error: 'Store not found' });
//     }
    
//     const context = await shopify.getCustomerContext(store, req.params.email);
//     res.json(context);
//   } catch (error) {
//     console.error('Customer context error:', error);
//     res.status(500).json({ error: 'Failed to fetch customer context' });
//   }
// });

// // ============ CUSTOMER & ORDER LOOKUP ENDPOINTS ============

// app.get('/api/customers/lookup', async (req, res) => {
//   try {
//     const { store: storeIdentifier, email } = req.query;
    
//     if (!storeIdentifier || !email) {
//       return res.status(400).json({ error: 'store and email parameters required' });
//     }
    
//     const store = await db.getStoreByIdentifier(storeIdentifier);
//     if (!store || !store.is_active) {
//       return res.status(404).json({ error: 'Store not found or inactive' });
//     }
    
//     const customerContext = await shopify.getCustomerContext(store, email);
    
//     if (!customerContext || !customerContext.customer) {
//       return res.status(404).json({ error: 'Customer not found' });
//     }
    
//     const customer = customerContext.customer;
    
//     res.json({
//       id: customer.id,
//       name: customer.name || `${customer.first_name || ''} ${customer.last_name || ''}`.trim(),
//       email: customer.email,
//       phone: customer.phone,
//       createdAt: customer.created_at,
//       updatedAt: customer.updated_at,
//       ordersCount: customer.orders_count || 0,
//       totalSpent: customer.total_spent ? parseFloat(customer.total_spent) : 0,
//       tags: customer.tags,
//       note: customer.note
//     });
//   } catch (error) {
//     console.error('Customer lookup error:', error);
//     res.status(500).json({ 
//       error: 'Failed to fetch customer data',
//       message: error.message 
//     });
//   }
// });

// app.get('/api/customers/orders', async (req, res) => {
//   try {
//     const { store: storeIdentifier, email } = req.query;
    
//     if (!storeIdentifier || !email) {
//       return res.status(400).json({ error: 'store and email parameters required' });
//     }
    
//     const store = await db.getStoreByIdentifier(storeIdentifier);
//     if (!store || !store.is_active) {
//       return res.status(404).json({ error: 'Store not found or inactive' });
//     }
    
//     const customerContext = await shopify.getCustomerContext(store, email);
    
//     if (!customerContext || !customerContext.orders) {
//       return res.json([]);
//     }
    
//     const formattedOrders = customerContext.orders.map(order => ({
//       id: order.id,
//       orderNumber: order.order_number || order.name,
//       status: order.financial_status || 'pending',
//       fulfillmentStatus: order.fulfillment_status,
//       total: order.total_price ? parseFloat(order.total_price) : 0,
//       currency: order.currency,
//       orderDate: order.created_at,
//       items: order.line_items ? order.line_items.map(item => ({
//         id: item.id,
//         title: item.title,
//         quantity: item.quantity,
//         price: parseFloat(item.price)
//       })) : [],
//       trackingNumber: order.tracking_number,
//       trackingUrl: order.tracking_url
//     }));
    
//     formattedOrders.sort((a, b) => new Date(b.orderDate) - new Date(a.orderDate));
    
//     res.json(formattedOrders);
//   } catch (error) {
//     console.error('Customer orders error:', error);
//     res.status(500).json({ 
//       error: 'Failed to fetch orders',
//       message: error.message 
//     });
//   }
// });

// app.get('/api/customers/cart', async (req, res) => {
//   try {
//     const { store: storeIdentifier, email } = req.query;
    
//     if (!storeIdentifier || !email) {
//       return res.status(400).json({ error: 'store and email parameters required' });
//     }
    
//     const store = await db.getStoreByIdentifier(storeIdentifier);
//     if (!store || !store.is_active) {
//       return res.status(404).json({ error: 'Store not found or inactive' });
//     }
    
//     res.json({
//       subtotal: 0,
//       items: [],
//       itemCount: 0
//     });
    
//   } catch (error) {
//     console.error('Customer cart error:', error);
//     res.status(500).json({ 
//       error: 'Failed to fetch cart',
//       message: error.message 
//     });
//   }
// });

// app.post('/api/stores/:storeId/webhooks', authenticateToken, async (req, res) => {
//   try {
//     const store = await db.getStoreByIdentifier(req.params.storeId);
//     if (!store) {
//       return res.status(404).json({ error: 'Store not found' });
//     }
    
//     const webhookUrl = req.body.webhookUrl || `${process.env.APP_URL}/webhooks`;
//     const results = await shopify.registerWebhooks(store, webhookUrl);
    
//     res.json({ results });
//   } catch (error) {
//     res.status(500).json({ error: error.message });
//   }
// });

// // ============ CONVERSATION ENDPOINTS ============

// app.get('/api/conversations', authenticateToken, async (req, res) => {
//   try {
//     const { storeId, status, limit, offset } = req.query;
    
//     const filters = {};
//     if (storeId) filters.storeId = parseInt(storeId);
//     if (status) filters.status = status;
//     if (limit) filters.limit = parseInt(limit);
//     if (offset) filters.offset = parseInt(offset);
    
//     const conversations = await db.getConversations(filters);
//     res.json(conversations.map(snakeToCamel));
//   } catch (error) {
//     console.error('Get conversations error:', error);
//     res.status(500).json({ error: error.message });
//   }
// });

// app.get('/api/conversations/:id', authenticateToken, async (req, res) => {
//   try {
//     const conversationId = parseInt(req.params.id);
//     const conversation = await db.getConversation(conversationId);

//     if (!conversation) {
//       return res.status(404).json({ error: 'Conversation not found' });
//     }

//     res.json(snakeToCamel(conversation));
//   } catch (error) {
//     console.error('Error fetching conversation:', error);
//     res.status(500).json({ error: error.message });
//   }
// });

// app.post('/api/conversations', async (req, res) => {
//   try {
//     const { storeIdentifier, customerEmail, customerName, initialMessage, fileData } = req.body;
    
//     if (!storeIdentifier || !customerEmail) {
//       return res.status(400).json({ error: 'storeIdentifier and customerEmail required' });
//     }
    
//     const store = await db.getStoreByIdentifier(storeIdentifier);
//     if (!store) {
//       return res.status(404).json({ error: 'Store not found' });
//     }
    
//     const conversation = await db.saveConversation({
//       store_id: store.id,
//       store_identifier: store.shop_domain,
//       customer_email: customerEmail,
//       customer_name: customerName || customerEmail,
//       status: 'open',
//       priority: 'normal'
//     });
    
//     // Respond IMMEDIATELY
//     res.json(snakeToCamel(conversation));
    
//     // Save initial message and broadcast in background
//     setImmediate(async () => {
//       try {
//         if (initialMessage) {
//           const message = await db.saveMessage({
//             conversation_id: conversation.id,
//             store_id: store.id,
//             sender_type: 'customer',
//             sender_name: customerName || customerEmail,
//             content: initialMessage,
//             file_data: fileData ? JSON.stringify(fileData) : null
//           });
          
//           const camelMessage = snakeToCamel(message);
          
//           // Only broadcastToAgents - no one has joined the conversation yet
//           broadcastToAgents({
//             type: 'new_message',
//             message: camelMessage,
//             conversationId: conversation.id,
//             storeId: store.id
//           });
//         }
        
//         broadcastToAgents({
//           type: 'new_conversation',
//           conversation: snakeToCamel(conversation),
//           storeId: store.id,
//           storeIdentifier
//         });
//       } catch (error) {
//         console.error('Background conversation processing error:', error);
//       }
//     });
    
//   } catch (error) {
//     console.error('Create conversation error:', error);
//     res.status(500).json({ 
//       error: error.message,
//       details: process.env.NODE_ENV === 'development' ? error.stack : undefined
//     });
//   }
// });

// app.put('/api/conversations/:id', authenticateToken, async (req, res) => {
//   try {
//     const conversation = await db.updateConversation(parseInt(req.params.id), req.body);
//     res.json(snakeToCamel(conversation));
//   } catch (error) {
//     res.status(500).json({ error: error.message });
//   }
// });

// app.put('/api/conversations/:id/read', authenticateToken, async (req, res) => {
//   try {
//     const conversationId = parseInt(req.params.id);
    
//     await db.markConversationRead(conversationId);
    
//     const updatedConversation = await db.getConversation(conversationId);
//     broadcastToAgents({
//       type: 'conversation_read',
//       conversationId,
//       conversation: snakeToCamel(updatedConversation)
//     });
    
//     res.json({ success: true });
//   } catch (error) {
//     console.error('Error marking conversation as read:', error);
//     res.status(500).json({ error: error.message });
//   }
// });

// app.put('/api/conversations/:id/close', authenticateToken, async (req, res) => {
//   try {
//     const conversation = await db.closeConversation(parseInt(req.params.id));
//     res.json(snakeToCamel(conversation));
//   } catch (error) {
//     res.status(500).json({ error: error.message });
//   }
// });

// // ============ MESSAGE ENDPOINTS ============

// // Widget-accessible message history (validates by store, no employee auth needed)
// app.get('/api/widget/conversations/:id/messages', async (req, res) => {
//   try {
//     const { store } = req.query;
    
//     if (!store) {
//       return res.status(400).json({ error: 'store parameter required' });
//     }

//     const storeRecord = await db.getStoreByIdentifier(store);
//     if (!storeRecord || !storeRecord.is_active) {
//       return res.status(404).json({ error: 'Store not found or inactive' });
//     }

//     const conversationId = parseInt(req.params.id);
//     const conversation = await db.getConversation(conversationId);

//     if (!conversation) {
//       return res.status(404).json({ error: 'Conversation not found' });
//     }

//     // db may return snake_case or camelCase depending on driver - handle both
//     const convStoreId = conversation.shop_id ?? conversation.shopId ?? conversation.store_id ?? conversation.storeId;
//     const convStoreIdentifier = conversation.shop_domain ?? conversation.shopDomain ?? conversation.store_identifier ?? conversation.storeIdentifier;

//     // Security check: verify conversation belongs to this store
//     const storeIdMatch = String(convStoreId) === String(storeRecord.id);
//     const identifierMatch = convStoreIdentifier && (
//       convStoreIdentifier === storeRecord.shop_domain ||
//       convStoreIdentifier === storeRecord.store_identifier ||
//       convStoreIdentifier === store
//     );
    
//     if (!storeIdMatch && !identifierMatch) {
//       console.warn(`❌ [Widget History] Access denied: conv ${conversationId} store_id=${convStoreId} store_identifier=${convStoreIdentifier} does not match store id=${storeRecord.id} identifier=${storeRecord.store_identifier} domain=${storeRecord.shop_domain}`);
//       return res.status(403).json({ error: 'Unauthorized' });
//     }

//     const messages = await db.getMessages(conversationId);
//     console.log(`✅ [Widget History] Returning ${messages.length} messages for conversation ${conversationId} (matched by ${storeIdMatch ? 'store_id' : 'store_identifier'})`);
//     res.json(messages.map(snakeToCamel));
//   } catch (error) {
//     console.error('❌ Widget message history error:', error);
//     res.status(500).json({ error: 'Failed to fetch messages' });
//   }
// });

// app.get('/api/conversations/:id/messages', authenticateToken, async (req, res) => {
//   try {
//     const conversationId = parseInt(req.params.id);
//     const messages = await db.getMessages(conversationId);

//     await db.markConversationRead(conversationId);
    
//     const updatedConversation = await db.getConversation(conversationId);
//     broadcastToAgents({
//       type: 'conversation_read',
//       conversationId,
//       conversation: snakeToCamel(updatedConversation)
//     });

//     res.json(messages.map(snakeToCamel));
//   } catch (error) {
//     console.error('Error fetching messages:', error);
//     res.status(500).json({ error: error.message });
//   }
// });

// app.post('/api/messages', authenticateToken, async (req, res) => {
//   try {
//     const { conversationId, senderType, senderName, content, storeId, fileData } = req.body;
    
//     if (!conversationId || !senderType) {
//       return res.status(400).json({ error: 'Missing required fields' });
//     }
    
//     if (!content && !fileData) {
//       return res.status(400).json({ error: 'Message must have text or a file attachment' });
//     }
    
//     const timestamp = new Date();
//     const tempId = `temp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
//     const tempMessage = {
//       id: tempId,
//       conversationId: conversationId,
//       storeId: storeId,
//       senderType: senderType,
//       senderName: senderName,
//       content: content || '',
//       fileData: fileData,
//       createdAt: timestamp,
//       pending: true
//     };
    
//     // Broadcast through BOTH channels for reliable delivery
//     sendToConversation(conversationId, {
//       type: 'new_message',
//       message: snakeToCamel(tempMessage)
//     });
    
//     broadcastToAgents({
//       type: 'new_message',
//       message: snakeToCamel(tempMessage),
//       conversationId,
//       storeId
//     });
    
//     // Respond to admin IMMEDIATELY
//     res.json(snakeToCamel(tempMessage));
    
//     // Then save to DB in background
//     setImmediate(async () => {
//       try {
//         const savedMessage = await db.saveMessage({
//           conversation_id: conversationId,
//           store_id: storeId,
//           sender_type: senderType,
//           sender_name: senderName,
//           content: content || '',
//           file_data: fileData ? JSON.stringify(fileData) : null,
//           sent_at: timestamp
//         });
        
//         // Confirm to customer widget (update temp → real ID)
//         sendToConversation(conversationId, {
//           type: 'message_confirmed',
//           tempId: tempId,
//           message: snakeToCamel(savedMessage)
//         });
        
//         // Confirm to all agents (update temp → real ID, update sidebar)
//         broadcastToAgents({
//           type: 'message_confirmed',
//           tempId: tempId,
//           message: snakeToCamel(savedMessage),
//           conversationId,
//           storeId
//         });
        
//         // Send offline email notification if customer is inactive
//         if (senderType === 'agent') {
//           handleOfflineEmailNotification(db.pool, savedMessage).catch(err =>
//             console.error('[Offline Email] Failed:', err)
//           );
//         }
        
//       } catch (error) {
//         console.error('Failed to save agent message:', error);
        
//         sendToConversation(conversationId, {
//           type: 'message_failed',
//           tempId: tempId
//         });
//       }
//     });
    
//   } catch (error) {
//     console.error('Send message error:', error);
//     res.status(500).json({ error: error.message });
//   }
// });

// app.post('/api/widget/messages', async (req, res) => {
//   try {
//     const { conversationId, customerEmail, customerName, content, storeIdentifier, fileData } = req.body;
    
//     if (!conversationId) {
//       return res.status(400).json({ error: 'Missing required fields' });
//     }
    
//     if (!content && !fileData) {
//       return res.status(400).json({ error: 'Message must have text or a file attachment' });
//     }
    
//     const store = await db.getStoreByIdentifier(storeIdentifier);
//     if (!store) {
//       return res.status(404).json({ error: 'Store not found' });
//     }
    
//     const conversation = await db.getConversation(conversationId);
    
//     if (!conversation) {
//       return res.status(404).json({ 
//         error: 'conversation_not_found',
//         message: 'This conversation no longer exists'
//       });
//     }
    
//     const timestamp = new Date();
//     const tempId = `temp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
//     const tempMessage = {
//       id: tempId,
//       conversationId: conversationId,
//       storeId: store.id,
//       senderType: 'customer',
//       senderName: customerName || customerEmail,
//       content: content || '',
//       fileData: fileData,
//       createdAt: timestamp,
//       pending: true
//     };
    
//     // Broadcast through BOTH channels for reliable delivery
//     // Client-side dedup prevents duplicates
//     sendToConversation(conversationId, {
//       type: 'new_message',
//       message: snakeToCamel(tempMessage)
//     });
    
//     broadcastToAgents({
//       type: 'new_message',
//       message: snakeToCamel(tempMessage),
//       conversationId,
//       storeId: store.id
//     });
    
//     // Respond to widget
//     res.json(snakeToCamel(tempMessage));
    
//     // Save to DB in background
//     setImmediate(async () => {
//       try {
//         const savedMessage = await db.saveMessage({
//           conversation_id: conversationId,
//           store_id: store.id,
//           sender_type: 'customer',
//           sender_name: customerName || customerEmail,
//           content: content || '',
//           file_data: fileData ? JSON.stringify(fileData) : null
//         });
        
//         const updatedConversation = await db.getConversation(conversationId);
        
//         const confirmedMessage = snakeToCamel(savedMessage);
        
//         // Confirm to customer widget
//         sendToConversation(conversationId, {
//           type: 'message_confirmed',
//           tempId: tempId,
//           message: confirmedMessage
//         });
        
//         // Confirm to agents (update temp ID → real ID)
//         broadcastToAgents({
//           type: 'message_confirmed',
//           tempId: tempId,
//           message: confirmedMessage,
//           conversationId,
//           storeId: store.id,
//           conversation: snakeToCamel(updatedConversation)
//         });
        
//       } catch (error) {
//         console.error('Failed to save message:', error);
        
//         sendToConversation(conversationId, {
//           type: 'message_failed',
//           tempId: tempId,
//           error: 'Failed to save message'
//         });
//       }
//     });
    
//   } catch (error) {
//     console.error('Widget message error:', error);
//     res.status(500).json({ 
//       error: 'Failed to send message',
//       message: error.message 
//     });
//   }
// });

// // ============ WIDGET PRESENCE TRACKING ============

// app.post('/api/widget/presence', async (req, res) => {
//   try {
//     const { conversationId, customerEmail, storeId, status, lastActivityAt } = req.body;

//     if (!conversationId || !customerEmail) {
//       return res.status(400).json({ error: 'conversationId and customerEmail required' });
//     }

//     const validStatuses = ['online', 'away', 'offline'];
//     const safeStatus = validStatuses.includes(status) ? status : 'offline';

//     await db.pool.query(`
//       INSERT INTO customer_presence 
//         (conversation_id, customer_email, store_id, status, last_activity_at, last_heartbeat_at, ws_connected, updated_at)
//       VALUES ($1, $2, $3, $4, $5, NOW(), FALSE, NOW())
//       ON CONFLICT (conversation_id)
//       DO UPDATE SET
//         status = $4,
//         last_activity_at = $5,
//         last_heartbeat_at = NOW(),
//         updated_at = NOW()
//     `, [conversationId, customerEmail, storeId || null, safeStatus, lastActivityAt || new Date()]);

//     // Cancel pending offline email if customer came back online
//     if (safeStatus === 'online') {
//       cancelPendingEmail(conversationId);
//     }

//     res.json({ ok: true });
//   } catch (error) {
//     console.error('[Presence REST] Error:', error);
//     res.status(500).json({ error: 'Failed to update presence' });
//   }
// });

// // ============ EMPLOYEE ENDPOINTS ============

// app.get('/api/employees', authenticateToken, async (req, res) => {
//   try {
//     if (req.user.role !== 'admin') {
//       return res.status(403).json({ error: 'Admin access required' });
//     }
    
//     const employees = await db.getAllEmployees();
//     const sanitized = employees.map(emp => {
//       const { password_hash, api_token, ...safe } = emp;
//       return snakeToCamel(safe);
//     });
    
//     res.json(sanitized);
//   } catch (error) {
//     console.error('Get employees error:', error);
//     res.status(500).json({ error: 'Failed to fetch employees' });
//   }
// });

// app.post('/api/employees', authenticateToken, async (req, res) => {
//   try {
//     if (req.user.role !== 'admin') {
//       return res.status(403).json({ error: 'Admin access required' });
//     }
    
//     const { email, name, role, password, canViewAllStores, isActive } = req.body;
    
//     if (!email || !name || !password) {
//       return res.status(400).json({ error: 'Email, name, and password are required' });
//     }
    
//     const password_hash = await hashPassword(password);
    
//     const employee = await db.createEmployee({
//       email,
//       name,
//       role: role || 'agent',
//       password_hash,
//       can_view_all_stores: canViewAllStores !== undefined ? canViewAllStores : true,
//       is_active: isActive !== undefined ? isActive : true,
//       assigned_stores: []
//     });
    
//     delete employee.password_hash;
//     delete employee.api_token;
    
//     res.json(snakeToCamel(employee));
//   } catch (error) {
//     console.error('Create employee error:', error);
//     res.status(500).json({ error: error.message });
//   }
// });

// app.put('/api/employees/:id', authenticateToken, async (req, res) => {
//   try {
//     if (req.user.role !== 'admin') {
//       return res.status(403).json({ error: 'Admin access required' });
//     }
    
//     const employeeId = parseInt(req.params.id);
//     const updates = req.body;
    
//     const dbUpdates = {};
//     if (updates.name !== undefined) dbUpdates.name = updates.name;
//     if (updates.email !== undefined) dbUpdates.email = updates.email;
//     if (updates.role !== undefined) dbUpdates.role = updates.role;
//     if (updates.isActive !== undefined) dbUpdates.is_active = updates.isActive;
//     if (updates.canViewAllStores !== undefined) dbUpdates.can_view_all_stores = updates.canViewAllStores;
//     if (updates.assignedStores !== undefined) dbUpdates.assigned_stores = updates.assignedStores;
    
//     if (updates.password) {
//       dbUpdates.password_hash = await hashPassword(updates.password);
//     }
    
//     const employee = await db.updateEmployee(employeeId, dbUpdates);
    
//     delete employee.password_hash;
//     delete employee.api_token;
    
//     res.json(snakeToCamel(employee));
//   } catch (error) {
//     console.error('Update employee error:', error);
//     res.status(500).json({ error: 'Failed to update employee' });
//   }
// });

// app.delete('/api/employees/:id', authenticateToken, async (req, res) => {
//   try {
//     if (req.user.role !== 'admin') {
//       return res.status(403).json({ error: 'Admin access required' });
//     }
    
//     const employeeId = parseInt(req.params.id);
    
//     if (employeeId === req.user.id) {
//       return res.status(400).json({ error: 'Cannot delete your own account' });
//     }
    
//     await db.deleteEmployee(employeeId);
    
//     res.json({ success: true, message: 'Employee deleted' });
//   } catch (error) {
//     console.error('Delete employee error:', error);
//     res.status(500).json({ error: 'Failed to delete employee' });
//   }
// });

// app.put('/api/employees/:id/status', authenticateToken, async (req, res) => {
//   try {
//     await db.updateEmployeeStatus(parseInt(req.params.id), req.body.status);
//     res.json({ success: true });
//   } catch (error) {
//     res.status(500).json({ error: error.message });
//   }
// });

// // ============ TEMPLATE ENDPOINTS ============

// app.get('/api/templates', authenticateToken, async (req, res) => {
//   try {
//     const userId = req.user.id;
//     const templates = await db.getTemplatesByUserId(userId);
//     res.json(templates.map(snakeToCamel));
//   } catch (error) {
//     console.error('Get templates error:', error);
//     res.status(500).json({ error: 'Failed to fetch templates' });
//   }
// });

// app.post('/api/templates', authenticateToken, async (req, res) => {
//   try {
//     const userId = req.user.id;
//     const { name, content } = req.body;
    
//     if (!name || !content) {
//       return res.status(400).json({ error: 'Name and content are required' });
//     }
    
//     if (name.length > 255) {
//       return res.status(400).json({ error: 'Template name is too long (max 255 characters)' });
//     }
    
//     const template = await db.createTemplate({
//       user_id: userId,
//       name: name.trim(),
//       content: content.trim()
//     });
    
//     res.status(201).json(snakeToCamel(template));
//   } catch (error) {
//     console.error('Create template error:', error);
//     res.status(500).json({ error: 'Failed to create template' });
//   }
// });

// app.put('/api/templates/:id', authenticateToken, async (req, res) => {
//   try {
//     const userId = req.user.id;
//     const templateId = parseInt(req.params.id);
//     const { name, content } = req.body;
    
//     if (!name || !content) {
//       return res.status(400).json({ error: 'Name and content are required' });
//     }
    
//     if (name.length > 255) {
//       return res.status(400).json({ error: 'Template name is too long (max 255 characters)' });
//     }
    
//     const existingTemplate = await db.getTemplateById(templateId);
    
//     if (!existingTemplate) {
//       return res.status(404).json({ error: 'Template not found' });
//     }
    
//     if (existingTemplate.user_id !== userId) {
//       return res.status(403).json({ error: 'Not authorized to update this template' });
//     }
    
//     const template = await db.updateTemplate(templateId, {
//       name: name.trim(),
//       content: content.trim()
//     });
    
//     res.json(snakeToCamel(template));
//   } catch (error) {
//     console.error('Update template error:', error);
//     res.status(500).json({ error: 'Failed to update template' });
//   }
// });

// app.delete('/api/templates/:id', authenticateToken, async (req, res) => {
//   try {
//     const userId = req.user.id;
//     const templateId = parseInt(req.params.id);
    
//     const existingTemplate = await db.getTemplateById(templateId);
    
//     if (!existingTemplate) {
//       return res.status(404).json({ error: 'Template not found' });
//     }
    
//     if (existingTemplate.user_id !== userId) {
//       return res.status(403).json({ error: 'Not authorized to delete this template' });
//     }
    
//     await db.deleteTemplate(templateId);
    
//     res.json({ success: true, message: 'Template deleted successfully' });
//   } catch (error) {
//     console.error('Delete template error:', error);
//     res.status(500).json({ error: 'Failed to delete template' });
//   }
// });

// // ============ STATS ENDPOINTS ============

// app.get('/api/stats/dashboard', authenticateToken, async (req, res) => {
//   try {
//     const stats = await db.getDashboardStats(req.query);
//     res.json(stats);
//   } catch (error) {
//     res.status(500).json({ error: error.message });
//   }
// });

// app.get('/api/stats/websocket', authenticateToken, (req, res) => {
//   try {
//     const stats = getWebSocketStats();
//     res.json(stats);
//   } catch (error) {
//     res.status(500).json({ error: error.message });
//   }
// });

// // ============ ERROR HANDLER ============

// app.use((err, req, res, next) => {
//   console.error('SERVER ERROR:', err.message);
//   console.error('Stack:', err.stack);
//   console.error('URL:', req.url);
//   console.error('Method:', req.method);
  
//   res.status(500).json({ 
//     error: 'Internal server error',
//     message: process.env.NODE_ENV === 'development' ? err.message : undefined
//   });
// });

// // ============ KEEP-ALIVE MECHANISM ============

// function setupKeepAlive() {
//   // Enable by default - critical for preventing cold starts on Render
//   if (process.env.KEEP_ALIVE === 'false') {
//     console.log('⏰ Keep-alive disabled');
//     return;
//   }

//   const APP_URL = process.env.APP_URL || `http://localhost:${process.env.PORT || 3000}`;
//   const httpModule = APP_URL.startsWith('https') ? require('https') : http;
  
//   console.log('⏰ Keep-alive enabled - pinging every 5 minutes');
  
//   setInterval(() => {
//     const now = new Date().toISOString();
    
//     httpModule.get(`${APP_URL}/health`, (res) => {
//       let data = '';
      
//       res.on('data', (chunk) => {
//         data += chunk;
//       });
      
//       res.on('end', () => {
//         if (res.statusCode === 200) {
//           console.log(`⏰ Keep-alive ping successful [${now}]`);
//         } else {
//           console.log(`⚠️ Keep-alive ping failed: ${res.statusCode} [${now}]`);
//         }
//       });
//     }).on('error', (err) => {
//       console.error(`❌ Keep-alive ping error [${now}]:`, err.message);
//     });
    
//   }, 5 * 60 * 1000);
  
//   setTimeout(() => {
//     console.log('⏰ Running initial keep-alive ping...');
//     httpModule.get(`${APP_URL}/health`, (res) => {
//       console.log(`⏰ Initial ping: ${res.statusCode}`);
//     }).on('error', (err) => {
//       console.error('❌ Initial ping error:', err.message);
//     });
//   }, 60 * 1000);
// }

// // ============ START SERVER ============

// const PORT = process.env.PORT || 3000;

// async function startServer() {
//   try {
//     console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
//     console.log('🔄 Initializing Multi-Store Chat Server...');
//     console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
//     console.log('📡 Testing database connection...');
//     await db.testConnection();
//     console.log('✅ Database connection successful\n');
    
//     console.log('🗄️  Initializing database tables...');
//     await db.initDatabase();
//     console.log('✅ Database tables initialized\n');
    
//     console.log('🔄 Running database migrations...');
//     await db.runMigrations();
//     console.log('✅ Database migrations completed\n');
    
//     server.listen(PORT, () => {
//       console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
//       console.log('🚀 MULTI-STORE CHAT SERVER READY');
//       console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
//       console.log(`📍 Server: http://localhost:${PORT}`);
//       console.log(`🔌 WebSocket: ws://localhost:${PORT}/ws`);
//       console.log(`🏥 Health: http://localhost:${PORT}/health`);
//       console.log(`🔐 OAuth: http://localhost:${PORT}/auth?shop=STORE.myshopify.com`);
//       console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
//       console.log(`📎 File Upload: Enabled with Bunny.net`);
//       console.log(`📧 Email Notifications: Enabled`);
//       console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
      
//       setupKeepAlive();
//       startEmailSweep(db.pool);
      
//       // Clean up stale presence records every 2 minutes
//       setInterval(async () => {
//         try {
//           const result = await db.pool.query(`
//             UPDATE customer_presence
//             SET status = 'offline', ws_connected = FALSE, updated_at = NOW()
//             WHERE status != 'offline'
//               AND last_heartbeat_at < NOW() - INTERVAL '3 minutes'
//             RETURNING conversation_id
//           `);
//           if (result.rowCount > 0) {
//             console.log(`[Presence] Marked ${result.rowCount} stale sessions offline`);
//           }
//         } catch (err) {
//           console.error('[Presence] Stale cleanup error:', err);
//         }
//       }, 2 * 60 * 1000);
//     });
//   } catch (error) {
//     console.error('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
//     console.error('❌ FATAL: Failed to start server');
//     console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
//     console.error('Error:', error.message);
//     console.error('Stack:', error.stack);
//     console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
//     process.exit(1);
//   }
// }

// startServer();

// module.exports = { app, server };
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const http = require('http');
const https = require('https');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const db = require('./database');
const shopify = require('./shopify-api');
const { rawBodyMiddleware, handleWebhook } = require('./webhooks');
const { getAuthUrl, handleCallback } = require('./shopify-auth');
const { initWebSocketServer, sendToConversation, broadcastToAgents, getWebSocketStats } = require('./websocket-server');
const { hashPassword, verifyPassword, generateToken, authenticateToken } = require('./auth');
const session = require('express-session');
const shopifyAppRoutes = require('./routes/shopify-app-routes');
const fileRoutes = require('./routes/fileroutes');
const { handleOfflineEmailNotification, cancelPendingEmail, startEmailSweep, stopEmailSweep } = require('../frontend/src/admin/services/emailService');

const app = express();
const server = http.createServer(app);

// Trust only first proxy (Render's load balancer)
app.set('trust proxy', 1);

// ============ UNIVERSAL CORS FIX ============
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
  res.header('Access-Control-Allow-Credentials', 'true');
  
  if (req.method === 'OPTIONS') {
    return res.sendStatus(204);
  }
  next();
});

// ============ INITIALIZE WEBSOCKET SERVER ============
console.log('🔌 Initializing WebSocket server...');
initWebSocketServer(server);
console.log('✅ WebSocket server initialized\n');

console.log('\n🚀 Multi-Store Chat Server Starting...\n');

// ============ HELPER FUNCTIONS ============

function snakeToCamel(obj) {
  if (!obj) return obj;
  if (Array.isArray(obj)) return obj.map(snakeToCamel);
  if (obj instanceof Date) return obj;
  if (typeof obj !== 'object') return obj;
  
  const camelObj = {};
  for (const [key, value] of Object.entries(obj)) {
    const camelKey = key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
    camelObj[camelKey] = typeof value === 'object' && value !== null ? snakeToCamel(value) : value;
  }
  return camelObj;
}

function camelToSnake(obj) {
  if (!obj) return obj;
  if (Array.isArray(obj)) return obj.map(camelToSnake);
  if (typeof obj !== 'object') return obj;
  
  const snakeObj = {};
  for (const [key, value] of Object.entries(obj)) {
    const snakeKey = key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
    snakeObj[snakeKey] = value;
  }
  return snakeObj;
}

// Security headers (relaxed for widget embedding)
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: { policy: "cross-origin" },
  frameguard: false
}));

// ⚠️ IMPORTANT: Webhook route BEFORE express.json()
app.post('/webhooks/:shop/:topic', rawBodyMiddleware, handleWebhook);

// JSON middleware for other routes
app.use(express.json());

app.use(session({
  secret: process.env.JWT_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
}));

// ============ WIDGET STATIC FILES ============

app.get('/widget-init.js', (req, res) => {
  res.set({
    'Content-Type': 'application/javascript; charset=utf-8',
    'Cache-Control': 'public, max-age=3600',
    'X-Content-Type-Options': 'nosniff',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization'
  });
  
  res.sendFile(__dirname + '/public/widget-init.js');
});

app.get('/widget.html', (req, res) => {
  res.removeHeader('X-Frame-Options');
  
  res.set({
    'Content-Type': 'text/html; charset=utf-8',
    'X-Content-Type-Options': 'nosniff',
    'Cache-Control': 'no-cache, must-revalidate',
    'Content-Security-Policy': "frame-ancestors *"
  });
  
  res.sendFile(__dirname + '/public/widget.html');
});

app.use(express.static('public'));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      try {
        const { verifyToken } = require('./auth');
        const user = verifyToken(authHeader.split(' ')[1]);
        return !!user;
      } catch (e) {
        return false;
      }
    }
    return false;
  },
  validate: {
    xForwardedForHeader: false,
    trustProxy: false
  }
});

const widgetLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 500,
  message: 'Too many requests, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  validate: {
    xForwardedForHeader: false,
    trustProxy: false
  }
});

app.use('/api/widget/', widgetLimiter);
app.use('/api/customers/', widgetLimiter);
app.use('/api/', limiter);

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: 'Too many login attempts, please try again later.',
  skipSuccessfulRequests: true,
  validate: {
    xForwardedForHeader: false,
    trustProxy: false
  }
});

// Force HTTPS in production
if (process.env.NODE_ENV === 'production') {
  app.use((req, res, next) => {
    if (req.header('x-forwarded-proto') !== 'https') {
      res.redirect(`https://${req.header('host')}${req.url}`);
    } else {
      next();
    }
  });
}

// Request logger
app.use((req, res, next) => {
  console.log(`${req.method} ${req.path}`);
  next();
});

// ============ HEALTH CHECK ============

app.get('/health', async (req, res) => {
  try {
    await db.testConnection();
    const wsStats = getWebSocketStats();
    
    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      database: 'connected',
      websocket: {
        active: wsStats.totalConnections > 0,
        connections: wsStats.totalConnections,
        agents: wsStats.agentCount,
        customers: wsStats.customerCount,
        authenticated: wsStats.authenticatedCount,
        activeConversations: wsStats.activeConversations
      },
      uptime: Math.floor(process.uptime()),
      version: process.env.npm_package_version || '1.0.0',
    });
  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      error: error.message,
      timestamp: new Date().toISOString(),
    });
  }
});

// ============ WIDGET API ENDPOINTS ============

app.get('/api/stores/verify', async (req, res) => {
  try {
    const { domain } = req.query;
    
    if (!domain) {
      return res.status(400).json({ error: 'domain parameter required' });
    }
    
    const store = await db.getStoreByDomain(domain);
    
    if (!store || !store.is_active) {
      return res.status(404).json({ 
        error: 'Store not found or inactive',
        message: 'Please install the chat app from Shopify'
      });
    }
    
    res.json({
      storeId: store.id,
      storeIdentifier: store.store_identifier,
      shopDomain: store.shop_domain,
      brandName: store.brand_name,
      active: store.is_active,
      verified: true
    });
  } catch (error) {
    console.error('Store verification error:', error);
    res.status(500).json({ error: 'Verification failed' });
  }
});

app.get('/api/widget/settings', async (req, res) => {
  try {
    const { store: storeIdentifier } = req.query;
    
    if (!storeIdentifier) {
      return res.status(400).json({ error: 'store parameter required' });
    }
    
    const store = await db.getStoreByIdentifier(storeIdentifier);
    
    if (!store || !store.is_active) {
      return res.status(404).json({ error: 'Store not found or inactive' });
    }
    
    res.json({
      storeId: store.id,
      storeIdentifier: store.store_identifier,
      brandName: store.brand_name,
      primaryColor: store.primary_color || '#667eea',
      logoUrl: store.logo_url,
      widgetSettings: store.widget_settings || {
        position: 'bottom-right',
        greeting: 'Hi! How can we help you today?',
        placeholder: 'Type your message...',
        showAvatar: true
      },
      businessHours: store.business_hours,
      timezone: store.timezone || 'UTC'
    });
  } catch (error) {
    console.error('Widget settings error:', error);
    res.status(500).json({ error: 'Failed to fetch settings' });
  }
});

app.get('/api/widget/session', async (req, res) => {
  try {
    const { store } = req.query;

    if (!store) {
      return res.status(400).json({ error: 'store parameter required' });
    }

    const storeRecord = await db.getStoreByIdentifier(store);
    if (!storeRecord || !storeRecord.is_active) {
      return res.status(404).json({ error: 'Store not found or inactive' });
    }

    const { generateWidgetToken } = require('./auth');
    const token = generateWidgetToken(storeRecord);

    res.json({
      token,
      expiresIn: process.env.WIDGET_JWT_EXPIRES_IN || '2h'
    });
  } catch (error) {
    console.error('Widget session error:', error);
    res.status(500).json({ error: 'Failed to create widget session' });
  }
});

app.get('/api/widget/conversation/lookup', async (req, res) => {
  try {
    const { store, email } = req.query;
    console.log(`🔍 [Widget Lookup] store=${store}, email=${email}`);
    
    if (!store || !email) {
      return res.status(400).json({ error: 'store and email parameters required' });
    }
    
    const storeRecord = await db.getStoreByIdentifier(store);
    if (!storeRecord || !storeRecord.is_active) {
      console.log(`❌ [Widget Lookup] Store not found for identifier: ${store}`);
      return res.status(404).json({ error: 'Store not found or inactive' });
    }
    console.log(`✅ [Widget Lookup] Store found: id=${storeRecord.id}, identifier=${storeRecord.store_identifier}, domain=${storeRecord.shop_domain}`);
    
    let conversations = await db.getConversations({ storeId: storeRecord.id });
    console.log(`📋 [Widget Lookup] getConversations returned ${conversations.length} conversations for storeId=${storeRecord.id}`);
    
    const getField = (obj, snake, camel) => obj[snake] ?? obj[camel];
    
    let match = conversations.find(c => 
      getField(c, 'customer_email', 'customerEmail') === email && getField(c, 'status', 'status') === 'open'
    );
    if (!match) {
      match = conversations.find(c => getField(c, 'customer_email', 'customerEmail') === email);
    }
    
    if (!match) {
      console.log(`⚠️ [Widget Lookup] Not found in store-filtered results, trying broader search...`);
      const allConversations = await db.getConversations({});
      console.log(`📋 [Widget Lookup] Broad search returned ${allConversations.length} total conversations`);
      
      const emailMatches = allConversations.filter(c => getField(c, 'customer_email', 'customerEmail') === email);
      console.log(`📋 [Widget Lookup] Found ${emailMatches.length} conversations with email=${email}`);
      
      const storeMatches = emailMatches.filter(c => {
        const cStoreId = getField(c, 'store_id', 'storeId');
        const cStoreIdent = getField(c, 'store_identifier', 'storeIdentifier');
        return String(cStoreId) === String(storeRecord.id) ||
          cStoreIdent === storeRecord.shop_domain ||
          cStoreIdent === storeRecord.store_identifier ||
          cStoreIdent === store;
      });
      
      match = storeMatches.find(c => getField(c, 'status', 'status') === 'open') || storeMatches[0];
    }
    
    if (match) {
      const matchId = match.id;
      const matchStoreId = getField(match, 'store_id', 'storeId');
      const matchStatus = getField(match, 'status', 'status');
      console.log(`✅ [Widget Lookup] Found conversation ${matchId} for ${email} (store_id=${matchStoreId}, status=${matchStatus})`);
      res.json({ conversationId: matchId });
    } else {
      console.log(`ℹ️ [Widget Lookup] No conversation found for ${email} in store ${store}`);
      res.json({ conversationId: null });
    }
  } catch (error) {
    console.error('❌ Widget conversation lookup error:', error);
    res.status(500).json({ error: 'Lookup failed' });
  }
});

// ============ AUTHENTICATION ENDPOINTS ============

app.post('/api/employees/login', loginLimiter, async (req, res) => {
  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }
    
    if (!email.includes('@')) {
      return res.status(400).json({ error: 'Invalid email format' });
    }
    
    const employee = await db.getEmployeeByEmail(email);
    
    if (!employee) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }
    
    if (!employee.is_active) {
      return res.status(403).json({ error: 'Account is inactive' });
    }
    
    const validPassword = await verifyPassword(password, employee.password_hash);
    
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }
    
    await db.updateEmployeeStatus(employee.id, { 
      last_login: new Date(),
      is_online: true 
    });
    
    const token = generateToken(employee);
    
    delete employee.password_hash;
    delete employee.api_token;
    
    res.json({
      employee: snakeToCamel(employee),
      token,
      expiresIn: '7d'
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed. Please try again.' });
  }
});

app.post('/api/employees/logout', authenticateToken, async (req, res) => {
  try {
    await db.updateEmployeeStatus(req.user.id, { is_online: false });
    res.json({ message: 'Logged out successfully' });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ error: 'Logout failed' });
  }
});

app.get('/api/auth/verify', authenticateToken, async (req, res) => {
  try {
    const employee = await db.getEmployeeByEmail(req.user.email);
    
    if (!employee || !employee.is_active) {
      return res.status(403).json({ error: 'Invalid session' });
    }
    
    delete employee.password_hash;
    delete employee.api_token;
    
    res.json({ employee: snakeToCamel(employee) });
  } catch (error) {
    res.status(500).json({ error: 'Verification failed' });
  }
});

// ============ SHOPIFY OAUTH ROUTES ============

app.get('/auth', async (req, res) => {
  try {
    const { shop } = req.query;
    if (!shop) {
      return res.status(400).json({ error: 'Shop parameter required' });
    }
    const authUrl = await getAuthUrl(shop);
    res.redirect(authUrl);
  } catch (error) {
    console.error('Auth error:', error);
    res.status(500).json({ error: 'Authentication failed' });
  }
});

app.get('/auth/callback', handleCallback);

// ============ SHOPIFY APP ROUTES ============
app.use('/shopify', shopifyAppRoutes);

// ============ FILE UPLOAD ROUTES ============
app.use('/api/files', fileRoutes);

// ============ STORE ENDPOINTS ============

app.get('/api/stores', authenticateToken, async (req, res) => {
  try {
    const stores = await db.getAllActiveStores();
    res.json(stores.map(snakeToCamel));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/customer-context/:storeId/:email', authenticateToken, async (req, res) => {
  try {
    const store = await db.getStoreByIdentifier(req.params.storeId);
    if (!store) {
      return res.status(404).json({ error: 'Store not found' });
    }
    
    const context = await shopify.getCustomerContext(store, req.params.email);
    res.json(context);
  } catch (error) {
    console.error('Customer context error:', error);
    res.status(500).json({ error: 'Failed to fetch customer context' });
  }
});

// ============ CUSTOMER & ORDER LOOKUP ENDPOINTS ============

app.get('/api/customers/lookup', async (req, res) => {
  try {
    const { store: storeIdentifier, email } = req.query;
    
    if (!storeIdentifier || !email) {
      return res.status(400).json({ error: 'store and email parameters required' });
    }
    
    const store = await db.getStoreByIdentifier(storeIdentifier);
    if (!store || !store.is_active) {
      return res.status(404).json({ error: 'Store not found or inactive' });
    }
    
    const customerContext = await shopify.getCustomerContext(store, email);
    
    if (!customerContext || !customerContext.customer) {
      return res.status(404).json({ error: 'Customer not found' });
    }
    
    const customer = customerContext.customer;
    
    res.json({
      id: customer.id,
      name: customer.name || `${customer.first_name || ''} ${customer.last_name || ''}`.trim(),
      email: customer.email,
      phone: customer.phone,
      createdAt: customer.created_at,
      updatedAt: customer.updated_at,
      ordersCount: customer.orders_count || 0,
      totalSpent: customer.total_spent ? parseFloat(customer.total_spent) : 0,
      tags: customer.tags,
      note: customer.note
    });
  } catch (error) {
    console.error('Customer lookup error:', error);
    res.status(500).json({ 
      error: 'Failed to fetch customer data',
      message: error.message 
    });
  }
});

app.get('/api/customers/orders', async (req, res) => {
  try {
    const { store: storeIdentifier, email } = req.query;
    
    if (!storeIdentifier || !email) {
      return res.status(400).json({ error: 'store and email parameters required' });
    }
    
    const store = await db.getStoreByIdentifier(storeIdentifier);
    if (!store || !store.is_active) {
      return res.status(404).json({ error: 'Store not found or inactive' });
    }
    
    const customerContext = await shopify.getCustomerContext(store, email);
    
    if (!customerContext || !customerContext.orders) {
      return res.json([]);
    }
    
    const formattedOrders = customerContext.orders.map(order => ({
      id: order.id,
      orderNumber: order.order_number || order.name,
      status: order.financial_status || 'pending',
      fulfillmentStatus: order.fulfillment_status,
      total: order.total_price ? parseFloat(order.total_price) : 0,
      currency: order.currency,
      orderDate: order.created_at,
      items: order.line_items ? order.line_items.map(item => ({
        id: item.id,
        title: item.title,
        quantity: item.quantity,
        price: parseFloat(item.price)
      })) : [],
      trackingNumber: order.tracking_number,
      trackingUrl: order.tracking_url
    }));
    
    formattedOrders.sort((a, b) => new Date(b.orderDate) - new Date(a.orderDate));
    
    res.json(formattedOrders);
  } catch (error) {
    console.error('Customer orders error:', error);
    res.status(500).json({ 
      error: 'Failed to fetch orders',
      message: error.message 
    });
  }
});

app.get('/api/customers/cart', async (req, res) => {
  try {
    const { store: storeIdentifier, email } = req.query;
    
    if (!storeIdentifier || !email) {
      return res.status(400).json({ error: 'store and email parameters required' });
    }
    
    const store = await db.getStoreByIdentifier(storeIdentifier);
    if (!store || !store.is_active) {
      return res.status(404).json({ error: 'Store not found or inactive' });
    }
    
    res.json({
      subtotal: 0,
      items: [],
      itemCount: 0
    });
    
  } catch (error) {
    console.error('Customer cart error:', error);
    res.status(500).json({ 
      error: 'Failed to fetch cart',
      message: error.message 
    });
  }
});

app.post('/api/stores/:storeId/webhooks', authenticateToken, async (req, res) => {
  try {
    const store = await db.getStoreByIdentifier(req.params.storeId);
    if (!store) {
      return res.status(404).json({ error: 'Store not found' });
    }
    
    const webhookUrl = req.body.webhookUrl || `${process.env.APP_URL}/webhooks`;
    const results = await shopify.registerWebhooks(store, webhookUrl);
    
    res.json({ results });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============ CONVERSATION ENDPOINTS ============

app.get('/api/conversations', authenticateToken, async (req, res) => {
  try {
    const { storeId, status, limit, offset } = req.query;
    
    const filters = {};
    if (storeId) filters.storeId = parseInt(storeId);
    if (status) filters.status = status;
    if (limit) filters.limit = parseInt(limit);
    if (offset) filters.offset = parseInt(offset);
    
    const conversations = await db.getConversations(filters);
    res.json(conversations.map(snakeToCamel));
  } catch (error) {
    console.error('Get conversations error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/conversations/:id', authenticateToken, async (req, res) => {
  try {
    const conversationId = parseInt(req.params.id);
    const conversation = await db.getConversation(conversationId);

    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    res.json(snakeToCamel(conversation));
  } catch (error) {
    console.error('Error fetching conversation:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/conversations', async (req, res) => {
  try {
    const { storeIdentifier, customerEmail, customerName, initialMessage, fileData } = req.body;
    
    if (!storeIdentifier || !customerEmail) {
      return res.status(400).json({ error: 'storeIdentifier and customerEmail required' });
    }
    
    const store = await db.getStoreByIdentifier(storeIdentifier);
    if (!store) {
      return res.status(404).json({ error: 'Store not found' });
    }
    
    const conversation = await db.saveConversation({
      store_id: store.id,
      store_identifier: store.shop_domain,
      customer_email: customerEmail,
      customer_name: customerName || customerEmail,
      status: 'open',
      priority: 'normal'
    });
    
    res.json(snakeToCamel(conversation));
    
    setImmediate(async () => {
      try {
        if (initialMessage) {
          const message = await db.saveMessage({
            conversation_id: conversation.id,
            store_id: store.id,
            sender_type: 'customer',
            sender_name: customerName || customerEmail,
            content: initialMessage,
            file_data: fileData ? JSON.stringify(fileData) : null
          });
          
          const camelMessage = snakeToCamel(message);
          
          broadcastToAgents({
            type: 'new_message',
            message: camelMessage,
            conversationId: conversation.id,
            storeId: store.id
          });
        }
        
        broadcastToAgents({
          type: 'new_conversation',
          conversation: snakeToCamel(conversation),
          storeId: store.id,
          storeIdentifier
        });
      } catch (error) {
        console.error('Background conversation processing error:', error);
      }
    });
    
  } catch (error) {
    console.error('Create conversation error:', error);
    res.status(500).json({ 
      error: error.message,
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

app.put('/api/conversations/:id', authenticateToken, async (req, res) => {
  try {
    const conversation = await db.updateConversation(parseInt(req.params.id), req.body);
    res.json(snakeToCamel(conversation));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/conversations/:id/read', authenticateToken, async (req, res) => {
  try {
    const conversationId = parseInt(req.params.id);
    
    await db.markConversationRead(conversationId);
    
    const updatedConversation = await db.getConversation(conversationId);
    broadcastToAgents({
      type: 'conversation_read',
      conversationId,
      conversation: snakeToCamel(updatedConversation)
    });
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error marking conversation as read:', error);
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/conversations/:id/close', authenticateToken, async (req, res) => {
  try {
    const conversation = await db.closeConversation(parseInt(req.params.id));
    res.json(snakeToCamel(conversation));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============ MESSAGE ENDPOINTS ============

app.get('/api/widget/conversations/:id/messages', async (req, res) => {
  try {
    const { store } = req.query;
    
    if (!store) {
      return res.status(400).json({ error: 'store parameter required' });
    }

    const storeRecord = await db.getStoreByIdentifier(store);
    if (!storeRecord || !storeRecord.is_active) {
      return res.status(404).json({ error: 'Store not found or inactive' });
    }

    const conversationId = parseInt(req.params.id);
    const conversation = await db.getConversation(conversationId);

    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    const convStoreId = conversation.shop_id ?? conversation.shopId ?? conversation.store_id ?? conversation.storeId;
    const convStoreIdentifier = conversation.shop_domain ?? conversation.shopDomain ?? conversation.store_identifier ?? conversation.storeIdentifier;

    const storeIdMatch = String(convStoreId) === String(storeRecord.id);
    const identifierMatch = convStoreIdentifier && (
      convStoreIdentifier === storeRecord.shop_domain ||
      convStoreIdentifier === storeRecord.store_identifier ||
      convStoreIdentifier === store
    );
    
    if (!storeIdMatch && !identifierMatch) {
      console.warn(`❌ [Widget History] Access denied: conv ${conversationId} store_id=${convStoreId} store_identifier=${convStoreIdentifier} does not match store id=${storeRecord.id} identifier=${storeRecord.store_identifier} domain=${storeRecord.shop_domain}`);
      return res.status(403).json({ error: 'Unauthorized' });
    }

    const messages = await db.getMessages(conversationId);
    console.log(`✅ [Widget History] Returning ${messages.length} messages for conversation ${conversationId} (matched by ${storeIdMatch ? 'store_id' : 'store_identifier'})`);
    res.json(messages.map(snakeToCamel));
  } catch (error) {
    console.error('❌ Widget message history error:', error);
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
});

app.get('/api/conversations/:id/messages', authenticateToken, async (req, res) => {
  try {
    const conversationId = parseInt(req.params.id);
    const messages = await db.getMessages(conversationId);

    await db.markConversationRead(conversationId);
    
    const updatedConversation = await db.getConversation(conversationId);
    broadcastToAgents({
      type: 'conversation_read',
      conversationId,
      conversation: snakeToCamel(updatedConversation)
    });

    res.json(messages.map(snakeToCamel));
  } catch (error) {
    console.error('Error fetching messages:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/messages', authenticateToken, async (req, res) => {
  try {
    const { conversationId, senderType, senderName, content, storeId, fileData } = req.body;
    
    if (!conversationId || !senderType) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    if (!content && !fileData) {
      return res.status(400).json({ error: 'Message must have text or a file attachment' });
    }
    
    const timestamp = new Date();
    const tempId = `temp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    const tempMessage = {
      id: tempId,
      conversationId: conversationId,
      storeId: storeId,
      senderType: senderType,
      senderName: senderName,
      content: content || '',
      fileData: fileData,
      createdAt: timestamp,
      pending: true
    };
    
    sendToConversation(conversationId, {
      type: 'new_message',
      message: snakeToCamel(tempMessage)
    });
    
    broadcastToAgents({
      type: 'new_message',
      message: snakeToCamel(tempMessage),
      conversationId,
      storeId
    });
    
    res.json(snakeToCamel(tempMessage));
    
    setImmediate(async () => {
      try {
        const savedMessage = await db.saveMessage({
          conversation_id: conversationId,
          store_id: storeId,
          sender_type: senderType,
          sender_name: senderName,
          content: content || '',
          file_data: fileData ? JSON.stringify(fileData) : null,
          sent_at: timestamp
        });
        
        sendToConversation(conversationId, {
          type: 'message_confirmed',
          tempId: tempId,
          message: snakeToCamel(savedMessage)
        });
        
        broadcastToAgents({
          type: 'message_confirmed',
          tempId: tempId,
          message: snakeToCamel(savedMessage),
          conversationId,
          storeId
        });
        
        if (senderType === 'agent') {
          handleOfflineEmailNotification(db.pool, savedMessage).catch(err =>
            console.error('[Offline Email] Failed:', err)
          );
        }
        
      } catch (error) {
        console.error('Failed to save agent message:', error);
        
        sendToConversation(conversationId, {
          type: 'message_failed',
          tempId: tempId
        });
      }
    });
    
  } catch (error) {
    console.error('Send message error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/widget/messages', async (req, res) => {
  try {
    const { conversationId, customerEmail, customerName, content, storeIdentifier, fileData } = req.body;
    
    if (!conversationId) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    if (!content && !fileData) {
      return res.status(400).json({ error: 'Message must have text or a file attachment' });
    }
    
    const store = await db.getStoreByIdentifier(storeIdentifier);
    if (!store) {
      return res.status(404).json({ error: 'Store not found' });
    }
    
    const conversation = await db.getConversation(conversationId);
    
    if (!conversation) {
      return res.status(404).json({ 
        error: 'conversation_not_found',
        message: 'This conversation no longer exists'
      });
    }
    
    const timestamp = new Date();
    const tempId = `temp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    const tempMessage = {
      id: tempId,
      conversationId: conversationId,
      storeId: store.id,
      senderType: 'customer',
      senderName: customerName || customerEmail,
      content: content || '',
      fileData: fileData,
      createdAt: timestamp,
      pending: true
    };
    
    sendToConversation(conversationId, {
      type: 'new_message',
      message: snakeToCamel(tempMessage)
    });
    
    broadcastToAgents({
      type: 'new_message',
      message: snakeToCamel(tempMessage),
      conversationId,
      storeId: store.id
    });
    
    res.json(snakeToCamel(tempMessage));
    
    setImmediate(async () => {
      try {
        const savedMessage = await db.saveMessage({
          conversation_id: conversationId,
          store_id: store.id,
          sender_type: 'customer',
          sender_name: customerName || customerEmail,
          content: content || '',
          file_data: fileData ? JSON.stringify(fileData) : null
        });
        
        const updatedConversation = await db.getConversation(conversationId);
        
        const confirmedMessage = snakeToCamel(savedMessage);
        
        sendToConversation(conversationId, {
          type: 'message_confirmed',
          tempId: tempId,
          message: confirmedMessage
        });
        
        broadcastToAgents({
          type: 'message_confirmed',
          tempId: tempId,
          message: confirmedMessage,
          conversationId,
          storeId: store.id,
          conversation: snakeToCamel(updatedConversation)
        });
        
      } catch (error) {
        console.error('Failed to save message:', error);
        
        sendToConversation(conversationId, {
          type: 'message_failed',
          tempId: tempId,
          error: 'Failed to save message'
        });
      }
    });
    
  } catch (error) {
    console.error('Widget message error:', error);
    res.status(500).json({ 
      error: 'Failed to send message',
      message: error.message 
    });
  }
});

// ============ WIDGET PRESENCE TRACKING ============

app.post('/api/widget/presence', async (req, res) => {
  try {
    const { conversationId, customerEmail, storeId, status, lastActivityAt } = req.body;

    if (!conversationId || !customerEmail) {
      return res.status(400).json({ error: 'conversationId and customerEmail required' });
    }

    const validStatuses = ['online', 'away', 'offline'];
    const safeStatus = validStatuses.includes(status) ? status : 'offline';

    await db.pool.query(`
      INSERT INTO customer_presence 
        (conversation_id, customer_email, store_id, status, last_activity_at, last_heartbeat_at, ws_connected, updated_at)
      VALUES ($1, $2, $3, $4, $5, NOW(), FALSE, NOW())
      ON CONFLICT (conversation_id)
      DO UPDATE SET
        status = $4,
        last_activity_at = $5,
        last_heartbeat_at = NOW(),
        updated_at = NOW()
    `, [conversationId, customerEmail, storeId || null, safeStatus, lastActivityAt || new Date()]);

    if (safeStatus === 'online') {
      cancelPendingEmail(conversationId);
    }

    res.json({ ok: true });
  } catch (error) {
    console.error('[Presence REST] Error:', error);
    res.status(500).json({ error: 'Failed to update presence' });
  }
});

// ============ AI SUGGESTIONS ENDPOINT ============

app.post('/api/ai/suggestions', authenticateToken, async (req, res) => {
  try {
    const {
      clientMessage,
      chatHistory,
      conversationId,
      customerName,
      customerEmail,
      storeName,
      storeIdentifier,
      analysis,
      adminNote,
      messageEdited
    } = req.body;

    if (!clientMessage) {
      return res.status(400).json({ error: 'clientMessage is required' });
    }

    console.log(`✦ [AI] Request — edited: ${!!messageEdited}, note: "${adminNote || ''}", text: "${clientMessage.substring(0, 80)}..."`);

    const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

    // If no API key configured, return context-aware fallback suggestions
    if (!ANTHROPIC_API_KEY) {
      console.log('✦ [AI] No ANTHROPIC_API_KEY set, using smart fallback suggestions');
      const suggestions = generateSmartFallbackSuggestions(clientMessage, chatHistory, analysis, adminNote);
      return res.json({ suggestions });
    }

    // ── Build a highly contextual system prompt ──
    const analysisBlock = buildAnalysisBlock(analysis);

    const systemPrompt = `You are an expert customer support reply assistant for an e-commerce store. Your job is to suggest exactly 3 reply options that the support agent can immediately send to the customer.

STORE: ${storeName || 'N/A'}
CUSTOMER: ${customerName || 'Guest'}${customerEmail ? ` (${customerEmail})` : ''}

${analysisBlock}

RULES — follow these strictly:
1. Write as the human support agent, NEVER as an AI or bot.
2. Each reply must be 1-3 sentences. Be specific and actionable, not vague.
3. Base every reply on what the customer actually said and the conversation history. Reference specific details they mentioned (order numbers, product names, issues described).
4. Vary the 3 suggestions strategically:
   - Suggestion 1: The most direct, helpful answer to what the customer just asked.
   - Suggestion 2: A slightly different angle, or addresses a secondary concern.
   - Suggestion 3: If info is missing, ask a specific follow-up question. If info is complete, offer an extra step (escalation, follow-up check, additional help).
5. NEVER repeat something the agent already said or already asked for. Read the chat history carefully.
6. Match the customer's energy: if they're upset, acknowledge it with empathy first. If they're casual, be friendly. If they're formal, be professional.
7. If the customer provided an order number, reference it. Do NOT ask for it again.
8. If the customer attached a file/image, acknowledge you've seen it.
9. Do not use emojis unless the customer used them first.
10. Do not make promises about timelines, refund amounts, or outcomes you cannot guarantee.
11. Never say "I understand your frustration" robotically — use natural, varied empathy language.

Respond ONLY with valid JSON: {"suggestions": ["reply 1", "reply 2", "reply 3"]}`;

    // Build the user prompt with optional admin edits/notes
    let userPrompt = chatHistory
      ? `FULL CONVERSATION:\n${chatHistory}\n\nCUSTOMER'S LATEST MESSAGE: ${clientMessage}`
      : `CUSTOMER'S MESSAGE: ${clientMessage}`;

    if (messageEdited) {
      userPrompt += `\n\n⚠️ NOTE: The agent EDITED the customer's message above to clarify or add context. Use the edited version as the basis for your reply suggestions.`;
    }

    if (adminNote && adminNote.trim()) {
      userPrompt += `\n\n📌 AGENT INSTRUCTIONS: ${adminNote.trim()}\n— The agent wants you to incorporate the above instructions into all 3 suggested replies. Follow them carefully.`;
    }

    // ── Call Anthropic Claude API (uses built-in https, works on all Node versions) ──
    const requestBody = JSON.stringify({
      model: process.env.AI_MODEL || 'claude-sonnet-4-20250514',
      max_tokens: 600,
      system: systemPrompt,
      messages: [
        { role: 'user', content: userPrompt },
      ],
    });

    console.log(`✦ [AI] Calling Anthropic API — model: ${process.env.AI_MODEL || 'claude-sonnet-4-20250514'}, key: ${ANTHROPIC_API_KEY.substring(0, 12)}...`);

    const anthropicData = await new Promise((resolve, reject) => {
      const options = {
        hostname: 'api.anthropic.com',
        path: '/v1/messages',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01',
          'Content-Length': Buffer.byteLength(requestBody),
        },
      };

      const apiReq = https.request(options, (apiRes) => {
        let body = '';
        apiRes.on('data', (chunk) => { body += chunk; });
        apiRes.on('end', () => {
          console.log(`✦ [AI] Anthropic response status: ${apiRes.statusCode}`);
          if (apiRes.statusCode !== 200) {
            console.error(`✦ [AI] Anthropic API error ${apiRes.statusCode}:`, body.substring(0, 500));
            reject(new Error(`Anthropic API ${apiRes.statusCode}: ${body.substring(0, 200)}`));
            return;
          }
          try {
            resolve(JSON.parse(body));
          } catch (e) {
            console.error('✦ [AI] Failed to parse Anthropic response:', body.substring(0, 500));
            reject(new Error('Invalid JSON from Anthropic'));
          }
        });
      });

      apiReq.on('error', (err) => {
        console.error('✦ [AI] HTTPS request failed:', err.message);
        reject(err);
      });

      apiReq.setTimeout(15000, () => {
        apiReq.destroy();
        reject(new Error('Anthropic API timeout (15s)'));
      });

      apiReq.write(requestBody);
      apiReq.end();
    });

    const rawContent = anthropicData.content?.[0]?.text || '';
    console.log(`✦ [AI] Raw response (first 200 chars): ${rawContent.substring(0, 200)}`);

    let parsed;
    try {
      const cleaned = rawContent.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
      parsed = JSON.parse(cleaned);
    } catch (parseErr) {
      console.error('✦ [AI] Failed to parse response:', rawContent);
      const suggestions = generateSmartFallbackSuggestions(clientMessage, chatHistory, analysis);
      return res.json({ suggestions, fallback: true });
    }

    const suggestions = Array.isArray(parsed.suggestions)
      ? parsed.suggestions.slice(0, 3)
      : Array.isArray(parsed)
        ? parsed.slice(0, 3)
        : generateSmartFallbackSuggestions(clientMessage, chatHistory, analysis);

    res.json({ suggestions });

  } catch (error) {
    console.error('✦ [AI] Suggestions endpoint error:', error);
    const suggestions = generateSmartFallbackSuggestions(
      req.body?.clientMessage || '',
      req.body?.chatHistory || '',
      req.body?.analysis || {}
    );
    res.json({ suggestions, fallback: true });
  }
});

/**
 * Build an analysis context block for the AI prompt from the frontend's conversation analysis.
 */
function buildAnalysisBlock(analysis) {
  if (!analysis) return '';

  const lines = ['CONVERSATION ANALYSIS (use this to inform your replies):'];

  if (analysis.detectedTopics?.length > 0) {
    const topicLabels = {
      order_status: 'Order Status / Tracking',
      refund_return: 'Refund / Return / Cancellation',
      product_issue: 'Product Issue / Damaged / Defective',
      payment: 'Payment / Billing',
      discount_promo: 'Discount / Promo Code',
      product_inquiry: 'Product Inquiry',
      shipping: 'Shipping Questions',
      account: 'Account Issue',
      complaint: 'Complaint / Escalation',
      gratitude: 'Customer Expressing Thanks',
      greeting: 'Greeting / Opening'
    };
    const labels = analysis.detectedTopics.map(t => topicLabels[t] || t).join(', ');
    lines.push(`- Topics discussed: ${labels}`);
  }

  if (analysis.sentiment) {
    const sentimentLabels = {
      very_negative: 'Very upset / angry — lead with strong empathy and urgency',
      negative: 'Frustrated / unhappy — acknowledge their concern with empathy',
      neutral: 'Neutral tone',
      positive: 'Positive / friendly',
      very_positive: 'Very happy / grateful — match their positive energy'
    };
    lines.push(`- Customer sentiment: ${sentimentLabels[analysis.sentiment] || analysis.sentiment}`);
  }

  if (analysis.isUrgent) lines.push('- ⚠️ Customer marked this as URGENT — respond with priority');
  if (analysis.isRepeat) lines.push('- ⚠️ Customer is REPEATING themselves or following up — they feel unheard. Acknowledge this directly and move forward with action.');
  if (analysis.isQuestion) lines.push('- Customer is asking a direct question — answer it specifically');
  if (analysis.hasOrderNumber) lines.push('- Customer already provided an order number — DO NOT ask for it again, reference it');
  if (analysis.hasEmail) lines.push('- Customer already shared their email — DO NOT ask for it again');
  if (analysis.hasAttachment) lines.push('- Customer sent a file/image — acknowledge you have reviewed it');
  if (analysis.agentAskedForOrder) lines.push('- Agent already asked for order number in a previous message — do NOT ask again');
  if (analysis.agentAlreadyApologized) lines.push('- Agent already apologized — avoid repeating the same apology, focus on action');
  if (analysis.agentAskedForEmail) lines.push('- Agent already asked for email — do NOT ask again');
  if (analysis.agentAskedForPhoto) lines.push('- Agent already asked for a photo — do NOT ask again');
  if (analysis.agentOfferedRefund) lines.push('- Agent already mentioned a refund — build on that, don\'t re-introduce');
  if (analysis.agentOfferedReplacement) lines.push('- Agent already offered a replacement — build on that');
  if (analysis.isLongConversation) lines.push(`- This is a long conversation (${analysis.turnCount} messages) — the customer may be losing patience. Be efficient and solution-oriented.`);
  if (analysis.lastAgentText) lines.push(`- Agent's last message was: "${analysis.lastAgentText.substring(0, 150)}"`);

  return lines.length > 1 ? lines.join('\n') : '';
}

/**
 * Generate smart context-aware fallback suggestions when the AI API is unavailable.
 * Uses the conversation analysis from the frontend to produce relevant replies.
 */
function generateSmartFallbackSuggestions(customerMsg, chatHistory, analysis) {
  const lower = (customerMsg || '').toLowerCase();
  const topics = analysis?.detectedTopics || [];
  const sentiment = analysis?.sentiment || 'neutral';
  const isRepeat = analysis?.isRepeat || false;
  const hasOrderNumber = analysis?.hasOrderNumber || false;
  const hasAttachment = analysis?.hasAttachment || false;
  const agentAskedForOrder = analysis?.agentAskedForOrder || false;
  const agentAlreadyApologized = analysis?.agentAlreadyApologized || false;
  const isUrgent = analysis?.isUrgent || false;
  const isLongConversation = analysis?.isLongConversation || false;

  // ── Empathy prefix based on sentiment ──
  let empathyPrefix = '';
  if (sentiment === 'very_negative' && !agentAlreadyApologized) {
    const options = [
      'I completely understand how frustrating this must be.',
      'I sincerely apologize for this experience.',
      'I can see this has been really frustrating, and I want to make it right.',
    ];
    empathyPrefix = options[Math.floor(Math.random() * options.length)] + ' ';
  } else if (sentiment === 'negative' && !agentAlreadyApologized) {
    const options = [
      'I\'m sorry about that.',
      'I understand your concern.',
      'I appreciate your patience with this.',
    ];
    empathyPrefix = options[Math.floor(Math.random() * options.length)] + ' ';
  }

  // ── Repeat/follow-up prefix ──
  const repeatPrefix = isRepeat ? 'I apologize for the delay in getting this resolved. ' : '';

  // ── Urgency suffix ──
  const urgencySuffix = isUrgent ? ' I\'m treating this as a priority.' : '';

  // ── GRATITUDE ──
  if (topics.includes('gratitude') && !topics.includes('complaint')) {
    return [
      'You\'re welcome! Is there anything else I can help you with?',
      'Happy to help! Don\'t hesitate to reach out if you need anything else.',
      'Glad we could get that sorted for you! Have a great day.'
    ];
  }

  // ── GREETING ONLY ──
  if (topics.length === 1 && topics.includes('greeting')) {
    return [
      'Hello! How can I help you today?',
      'Hi there! Welcome — what can I assist you with?',
      'Hello! Thanks for reaching out. How can I help?'
    ];
  }

  // ── PRODUCT ISSUE ──
  if (topics.includes('product_issue')) {
    if (hasOrderNumber && hasAttachment) {
      return [
        `${empathyPrefix}${repeatPrefix}Thank you for sharing the photo and your order details. I've reviewed the issue and I'm looking into the best resolution for you right away.${urgencySuffix}`,
        `${empathyPrefix}I can see the issue clearly from the photo you sent. Let me check what options we have — would you prefer a replacement or a refund?`,
        `${empathyPrefix}${repeatPrefix}I've noted the issue with your order. I'm escalating this now to get it resolved as quickly as possible.${urgencySuffix}`
      ];
    }
    if (hasOrderNumber && !hasAttachment && !analysis?.agentAskedForPhoto) {
      return [
        `${empathyPrefix}Thank you for your order details. Could you send a photo of the issue? That will help me process this faster.`,
        `${empathyPrefix}I've located your order. To help resolve this quickly, could you share a picture of the damage or defect?`,
        `${empathyPrefix}${repeatPrefix}I want to get this sorted for you. A quick photo of the issue would help me determine the best next step.${urgencySuffix}`
      ];
    }
    if (!hasOrderNumber && !agentAskedForOrder) {
      return [
        `${empathyPrefix}I'd like to help resolve this. Could you share your order number so I can pull up the details?`,
        `${empathyPrefix}That's not the experience we want you to have. Could you provide your order number and a brief description of the issue?`,
        `${empathyPrefix}${repeatPrefix}Let me look into this for you. Can you share your order number and, if possible, a photo of the problem?${urgencySuffix}`
      ];
    }
    return [
      `${empathyPrefix}I'm looking into this for you now. I'll have an update shortly.${urgencySuffix}`,
      `${empathyPrefix}Thank you for your patience. I'm checking the available options to resolve this.`,
      `${empathyPrefix}${repeatPrefix}I want to make sure we get this right. Let me review your case and get back to you with a solution.${urgencySuffix}`
    ];
  }

  // ── ORDER STATUS / SHIPPING ──
  if (topics.includes('order_status') || topics.includes('shipping')) {
    if (hasOrderNumber) {
      return [
        `${repeatPrefix}Thank you for sharing your order number. Let me check the current status and tracking information for you now.${urgencySuffix}`,
        `${repeatPrefix}I'm pulling up your order details right now. I'll have the latest shipping update for you shortly.${urgencySuffix}`,
        `${repeatPrefix}I can see your order in our system. Let me check with our fulfillment team for the most up-to-date status.${urgencySuffix}`
      ];
    }
    if (!agentAskedForOrder) {
      return [
        `${empathyPrefix}I'd be happy to check on that for you. Could you share your order number?`,
        'Of course! To look up your order status, I\'ll need your order number or the email address you used at checkout.',
        `${empathyPrefix}${repeatPrefix}Let me find your order. Could you provide the order number? It usually starts with # and was included in your confirmation email.${urgencySuffix}`
      ];
    }
    return [
      `${repeatPrefix}I'm currently looking into your order. I'll update you as soon as I have the tracking details.${urgencySuffix}`,
      'Thank you for your patience. I\'m checking with our shipping team to get you the latest update.',
      `${repeatPrefix}I want to make sure I give you accurate information. Give me just a moment to verify the shipping status.${urgencySuffix}`
    ];
  }

  // ── REFUND / RETURN ──
  if (topics.includes('refund_return')) {
    if (hasOrderNumber) {
      return [
        `${empathyPrefix}${repeatPrefix}I've located your order. Let me review the details and check what options are available for you.${urgencySuffix}`,
        `${empathyPrefix}Thank you for providing your order details. I'm checking the return/refund eligibility now and will let you know the next steps.`,
        `${empathyPrefix}I have your order pulled up. Could you let me know the reason for the return? That helps me process it faster.`
      ];
    }
    if (!agentAskedForOrder) {
      return [
        `${empathyPrefix}I'd be happy to help with that. Could you share your order number so I can review the return options?`,
        `${empathyPrefix}To get started on the return process, I'll need your order number. You can find it in your confirmation email.`,
        `${empathyPrefix}${repeatPrefix}I want to help resolve this. Could you provide your order number and the reason for the return?${urgencySuffix}`
      ];
    }
    return [
      `${empathyPrefix}I'm reviewing your return request now. I'll update you with the available options shortly.${urgencySuffix}`,
      `${empathyPrefix}Thank you for your patience. I'm checking the return policy details for your specific order.`,
      `${empathyPrefix}${repeatPrefix}I'm working on this for you. Would you prefer a refund to your original payment method or a store credit?${urgencySuffix}`
    ];
  }

  // ── PAYMENT / BILLING ──
  if (topics.includes('payment')) {
    if (hasOrderNumber) {
      return [
        `${empathyPrefix}I can see your order. Let me review the payment details and get back to you.${urgencySuffix}`,
        `${empathyPrefix}Thank you for the details. I'm checking the billing records for your order now.`,
        `${empathyPrefix}${repeatPrefix}I'm looking into the payment issue on your order. I'll have an update for you shortly.${urgencySuffix}`
      ];
    }
    return [
      `${empathyPrefix}I'd like to help sort out this billing issue. Could you share your order number or the email associated with the charge?`,
      `${empathyPrefix}To investigate the payment concern, could you provide the order number and the approximate date and amount of the charge?`,
      `${empathyPrefix}${repeatPrefix}I want to get to the bottom of this. Could you share any details about the charge — the date, amount, and last four digits of the card used?${urgencySuffix}`
    ];
  }

  // ── DISCOUNT / PROMO ──
  if (topics.includes('discount_promo')) {
    return [
      'Let me check on that promo code for you. Could you share the code you\'re trying to use and the items in your cart?',
      'I\'d be happy to help with that! Could you tell me which promotion you\'re referring to, or share the code?',
      `${empathyPrefix}Let me look into the available promotions for you. What product or category are you interested in?`
    ];
  }

  // ── PRODUCT INQUIRY ──
  if (topics.includes('product_inquiry')) {
    return [
      'Great question! Let me check that information for you. Which specific product are you asking about?',
      'I\'d be happy to help with product details. Could you share the product name or a link so I can look it up?',
      'Let me find the most accurate information for you. Can you tell me more about what you\'re looking for?'
    ];
  }

  // ── ACCOUNT ISSUES ──
  if (topics.includes('account')) {
    return [
      `${empathyPrefix}I can help with your account. For security, could you confirm the email address associated with your account?`,
      `${empathyPrefix}Let me look into the account issue. Could you describe what's happening when you try to log in?`,
      `${empathyPrefix}${repeatPrefix}I'll get this sorted for you. Could you share the email address on your account so I can investigate?${urgencySuffix}`
    ];
  }

  // ── COMPLAINT / ESCALATION ──
  if (topics.includes('complaint')) {
    if (isLongConversation) {
      return [
        `${empathyPrefix}${repeatPrefix}I understand this has been a long process and I want to get it resolved for you now. Let me escalate this to ensure it's handled promptly.${urgencySuffix}`,
        `${empathyPrefix}I can see this hasn't been resolved to your satisfaction. Let me personally make sure we get this taken care of right away.`,
        `${empathyPrefix}You've been more than patient. I'm going to escalate this and ensure you get a resolution today.${urgencySuffix}`
      ];
    }
    return [
      `${empathyPrefix}${repeatPrefix}I take your feedback seriously and I want to resolve this for you. Could you share the specific details so I can take action?${urgencySuffix}`,
      `${empathyPrefix}I hear you, and I want to make this right. Let me look into this and find the best solution.`,
      `${empathyPrefix}Thank you for letting us know. I'm going to look into this personally and follow up with you.${urgencySuffix}`
    ];
  }

  // ── CUSTOMER ASKED A QUESTION ──
  if (analysis?.isQuestion) {
    return [
      `${empathyPrefix}${repeatPrefix}That's a great question. Let me find the answer for you — one moment.${urgencySuffix}`,
      `${empathyPrefix}I'd be happy to help with that. Let me check and get back to you with the details.`,
      `${empathyPrefix}${repeatPrefix}Let me look into that for you. Could you provide any additional details that might help me find the answer faster?${urgencySuffix}`
    ];
  }

  // ── GENERIC FALLBACK ──
  return [
    `${empathyPrefix}${repeatPrefix}Thank you for your message. Let me look into this and get back to you shortly.${urgencySuffix}`,
    `${empathyPrefix}I appreciate you reaching out. Could you provide a bit more detail so I can assist you better?`,
    `${empathyPrefix}${repeatPrefix}I want to make sure I help you with the right information. Could you tell me a bit more about what you need?${urgencySuffix}`
  ];
}

// ============ EMPLOYEE ENDPOINTS ============

app.get('/api/employees', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }
    
    const employees = await db.getAllEmployees();
    const sanitized = employees.map(emp => {
      const { password_hash, api_token, ...safe } = emp;
      return snakeToCamel(safe);
    });
    
    res.json(sanitized);
  } catch (error) {
    console.error('Get employees error:', error);
    res.status(500).json({ error: 'Failed to fetch employees' });
  }
});

app.post('/api/employees', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }
    
    const { email, name, role, password, canViewAllStores, isActive } = req.body;
    
    if (!email || !name || !password) {
      return res.status(400).json({ error: 'Email, name, and password are required' });
    }
    
    const password_hash = await hashPassword(password);
    
    const employee = await db.createEmployee({
      email,
      name,
      role: role || 'agent',
      password_hash,
      can_view_all_stores: canViewAllStores !== undefined ? canViewAllStores : true,
      is_active: isActive !== undefined ? isActive : true,
      assigned_stores: []
    });
    
    delete employee.password_hash;
    delete employee.api_token;
    
    res.json(snakeToCamel(employee));
  } catch (error) {
    console.error('Create employee error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/employees/:id', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }
    
    const employeeId = parseInt(req.params.id);
    const updates = req.body;
    
    const dbUpdates = {};
    if (updates.name !== undefined) dbUpdates.name = updates.name;
    if (updates.email !== undefined) dbUpdates.email = updates.email;
    if (updates.role !== undefined) dbUpdates.role = updates.role;
    if (updates.isActive !== undefined) dbUpdates.is_active = updates.isActive;
    if (updates.canViewAllStores !== undefined) dbUpdates.can_view_all_stores = updates.canViewAllStores;
    if (updates.assignedStores !== undefined) dbUpdates.assigned_stores = updates.assignedStores;
    
    if (updates.password) {
      dbUpdates.password_hash = await hashPassword(updates.password);
    }
    
    const employee = await db.updateEmployee(employeeId, dbUpdates);
    
    delete employee.password_hash;
    delete employee.api_token;
    
    res.json(snakeToCamel(employee));
  } catch (error) {
    console.error('Update employee error:', error);
    res.status(500).json({ error: 'Failed to update employee' });
  }
});

app.delete('/api/employees/:id', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }
    
    const employeeId = parseInt(req.params.id);
    
    if (employeeId === req.user.id) {
      return res.status(400).json({ error: 'Cannot delete your own account' });
    }
    
    await db.deleteEmployee(employeeId);
    
    res.json({ success: true, message: 'Employee deleted' });
  } catch (error) {
    console.error('Delete employee error:', error);
    res.status(500).json({ error: 'Failed to delete employee' });
  }
});

app.put('/api/employees/:id/status', authenticateToken, async (req, res) => {
  try {
    await db.updateEmployeeStatus(parseInt(req.params.id), req.body.status);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============ TEMPLATE ENDPOINTS ============

app.get('/api/templates', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const templates = await db.getTemplatesByUserId(userId);
    res.json(templates.map(snakeToCamel));
  } catch (error) {
    console.error('Get templates error:', error);
    res.status(500).json({ error: 'Failed to fetch templates' });
  }
});

app.post('/api/templates', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { name, content } = req.body;
    
    if (!name || !content) {
      return res.status(400).json({ error: 'Name and content are required' });
    }
    
    if (name.length > 255) {
      return res.status(400).json({ error: 'Template name is too long (max 255 characters)' });
    }
    
    const template = await db.createTemplate({
      user_id: userId,
      name: name.trim(),
      content: content.trim()
    });
    
    res.status(201).json(snakeToCamel(template));
  } catch (error) {
    console.error('Create template error:', error);
    res.status(500).json({ error: 'Failed to create template' });
  }
});

app.put('/api/templates/:id', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const templateId = parseInt(req.params.id);
    const { name, content } = req.body;
    
    if (!name || !content) {
      return res.status(400).json({ error: 'Name and content are required' });
    }
    
    if (name.length > 255) {
      return res.status(400).json({ error: 'Template name is too long (max 255 characters)' });
    }
    
    const existingTemplate = await db.getTemplateById(templateId);
    
    if (!existingTemplate) {
      return res.status(404).json({ error: 'Template not found' });
    }
    
    if (existingTemplate.user_id !== userId) {
      return res.status(403).json({ error: 'Not authorized to update this template' });
    }
    
    const template = await db.updateTemplate(templateId, {
      name: name.trim(),
      content: content.trim()
    });
    
    res.json(snakeToCamel(template));
  } catch (error) {
    console.error('Update template error:', error);
    res.status(500).json({ error: 'Failed to update template' });
  }
});

app.delete('/api/templates/:id', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const templateId = parseInt(req.params.id);
    
    const existingTemplate = await db.getTemplateById(templateId);
    
    if (!existingTemplate) {
      return res.status(404).json({ error: 'Template not found' });
    }
    
    if (existingTemplate.user_id !== userId) {
      return res.status(403).json({ error: 'Not authorized to delete this template' });
    }
    
    await db.deleteTemplate(templateId);
    
    res.json({ success: true, message: 'Template deleted successfully' });
  } catch (error) {
    console.error('Delete template error:', error);
    res.status(500).json({ error: 'Failed to delete template' });
  }
});

// ============ STATS ENDPOINTS ============

app.get('/api/stats/dashboard', authenticateToken, async (req, res) => {
  try {
    const stats = await db.getDashboardStats(req.query);
    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/stats/websocket', authenticateToken, (req, res) => {
  try {
    const stats = getWebSocketStats();
    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============ ERROR HANDLER ============

app.use((err, req, res, next) => {
  console.error('SERVER ERROR:', err.message);
  console.error('Stack:', err.stack);
  console.error('URL:', req.url);
  console.error('Method:', req.method);
  
  res.status(500).json({ 
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// ============ KEEP-ALIVE MECHANISM ============

function setupKeepAlive() {
  if (process.env.KEEP_ALIVE === 'false') {
    console.log('⏰ Keep-alive disabled');
    return;
  }

  const APP_URL = process.env.APP_URL || `http://localhost:${process.env.PORT || 3000}`;
  const httpModule = APP_URL.startsWith('https') ? require('https') : http;
  
  console.log('⏰ Keep-alive enabled - pinging every 5 minutes');
  
  setInterval(() => {
    const now = new Date().toISOString();
    
    httpModule.get(`${APP_URL}/health`, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        if (res.statusCode === 200) {
          console.log(`⏰ Keep-alive ping successful [${now}]`);
        } else {
          console.log(`⚠️ Keep-alive ping failed: ${res.statusCode} [${now}]`);
        }
      });
    }).on('error', (err) => {
      console.error(`❌ Keep-alive ping error [${now}]:`, err.message);
    });
    
  }, 5 * 60 * 1000);
  
  setTimeout(() => {
    console.log('⏰ Running initial keep-alive ping...');
    httpModule.get(`${APP_URL}/health`, (res) => {
      console.log(`⏰ Initial ping: ${res.statusCode}`);
    }).on('error', (err) => {
      console.error('❌ Initial ping error:', err.message);
    });
  }, 60 * 1000);
}

// ============ START SERVER ============

const PORT = process.env.PORT || 3000;

async function startServer() {
  try {
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🔄 Initializing Multi-Store Chat Server...');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    console.log('📡 Testing database connection...');
    await db.testConnection();
    console.log('✅ Database connection successful\n');
    
    console.log('🗄️  Initializing database tables...');
    await db.initDatabase();
    console.log('✅ Database tables initialized\n');
    
    console.log('🔄 Running database migrations...');
    await db.runMigrations();
    console.log('✅ Database migrations completed\n');
    
    server.listen(PORT, () => {
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('🚀 MULTI-STORE CHAT SERVER READY');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log(`📍 Server: http://localhost:${PORT}`);
      console.log(`🔌 WebSocket: ws://localhost:${PORT}/ws`);
      console.log(`🏥 Health: http://localhost:${PORT}/health`);
      console.log(`🔐 OAuth: http://localhost:${PORT}/auth?shop=STORE.myshopify.com`);
      console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`📎 File Upload: Enabled with Bunny.net`);
      console.log(`📧 Email Notifications: Enabled`);
      console.log(`✦  AI Suggestions: ${process.env.ANTHROPIC_API_KEY ? 'Enabled (Claude)' : 'Fallback mode (no API key)'}`);
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
      
      setupKeepAlive();
      startEmailSweep(db.pool);
      
      setInterval(async () => {
        try {
          const result = await db.pool.query(`
            UPDATE customer_presence
            SET status = 'offline', ws_connected = FALSE, updated_at = NOW()
            WHERE status != 'offline'
              AND last_heartbeat_at < NOW() - INTERVAL '3 minutes'
            RETURNING conversation_id
          `);
          if (result.rowCount > 0) {
            console.log(`[Presence] Marked ${result.rowCount} stale sessions offline`);
          }
        } catch (err) {
          console.error('[Presence] Stale cleanup error:', err);
        }
      }, 2 * 60 * 1000);
    });
  } catch (error) {
    console.error('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.error('❌ FATAL: Failed to start server');
    console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.error('Error:', error.message);
    console.error('Stack:', error.stack);
    console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    process.exit(1);
  }
}

startServer();

module.exports = { app, server };