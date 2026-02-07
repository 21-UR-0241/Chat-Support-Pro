

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
//     'Cache-Control': 'public, max-age=3600',
//     'Content-Security-Policy': "frame-ancestors *"
//   });
  
//   res.sendFile(__dirname + '/public/widget.html');
// });

// app.use(express.static('public'));

// // Rate limiting
// const limiter = rateLimit({
//   windowMs: 15 * 60 * 1000,
//   max: 100,
//   message: 'Too many requests from this IP, please try again later.',
//   standardHeaders: true,
//   legacyHeaders: false,
//   validate: {
//     xForwardedForHeader: false,
//     trustProxy: false
//   }
// });

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
//     const { storeIdentifier, customerEmail, customerName, initialMessage } = req.body;
    
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
    
//     if (initialMessage) {
//       const message = await db.saveMessage({
//         conversation_id: conversation.id,
//         store_id: store.id,
//         sender_type: 'customer',
//         sender_name: customerName || customerEmail,
//         content: initialMessage
//       });
      
//       const camelMessage = snakeToCamel(message);
      
//       sendToConversation(conversation.id, {
//         type: 'new_message',
//         message: camelMessage
//       });
      
//       broadcastToAgents({
//         type: 'new_message',
//         message: camelMessage,
//         conversationId: conversation.id,
//         storeId: store.id
//       });
//     }
    
//     broadcastToAgents({
//       type: 'new_conversation',
//       conversation: snakeToCamel(conversation),
//       storeId: store.id,
//       storeIdentifier
//     });
    
//     res.json(snakeToCamel(conversation));
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
    
//     res.json(snakeToCamel(tempMessage));
    
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
        
//         sendToConversation(conversationId, {
//           type: 'message_confirmed',
//           tempId: tempId,
//           message: snakeToCamel(savedMessage)
//         });
        
//         broadcastToAgents({
//           type: 'message_confirmed',
//           tempId: tempId,
//           message: snakeToCamel(savedMessage),
//           conversationId,
//           storeId
//         });
        
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
    
//     sendToConversation(conversationId, {
//       type: 'new_message',
//       message: snakeToCamel(tempMessage)
//     });
    
//     res.json(snakeToCamel(tempMessage));
    
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
        
//         sendToConversation(conversationId, {
//           type: 'message_confirmed',
//           tempId: tempId,
//           message: confirmedMessage
//         });
        
//         broadcastToAgents({
//           type: 'new_message',
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
//   if (process.env.KEEP_ALIVE !== 'true') {
//     console.log('⏰ Keep-alive disabled');
//     return;
//   }

//   const APP_URL = process.env.APP_URL || `http://localhost:${process.env.PORT || 3000}`;
  
//   console.log('⏰ Keep-alive enabled - pinging every 14 minutes');
  
//   setInterval(() => {
//     const now = new Date().toISOString();
    
//     http.get(`${APP_URL}/health`, (res) => {
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
    
//   }, 14 * 60 * 1000);
  
//   setTimeout(() => {
//     console.log('⏰ Running initial keep-alive ping...');
//     http.get(`${APP_URL}/health`, (res) => {
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
//       console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
      
//       setupKeepAlive();
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
    'Cache-Control': 'public, max-age=3600',
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
    // Skip rate limiting for authenticated employees (agents/admins)
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

// Apply widget limiter to widget-specific routes BEFORE the general limiter
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
    
    // Respond IMMEDIATELY
    res.json(snakeToCamel(conversation));
    
    // Save initial message and broadcast in background
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
          
          // Only broadcastToAgents - no one has joined the conversation yet
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

// Widget-accessible message history (validates by store, no employee auth needed)
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

    // Verify this conversation belongs to the requesting store
    if (conversation.store_id !== storeRecord.id) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    const messages = await db.getMessages(conversationId);
    res.json(messages.map(snakeToCamel));
  } catch (error) {
    console.error('Widget message history error:', error);
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
    
    // Broadcast through BOTH channels for reliable delivery
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
    
    // Respond to admin IMMEDIATELY
    res.json(snakeToCamel(tempMessage));
    
    // Then save to DB in background
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
        
        // Confirm to customer widget (update temp → real ID)
        sendToConversation(conversationId, {
          type: 'message_confirmed',
          tempId: tempId,
          message: snakeToCamel(savedMessage)
        });
        
        // Confirm to all agents (update temp → real ID, update sidebar)
        broadcastToAgents({
          type: 'message_confirmed',
          tempId: tempId,
          message: snakeToCamel(savedMessage),
          conversationId,
          storeId
        });
        
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
    
    // Broadcast through BOTH channels for reliable delivery
    // Client-side dedup prevents duplicates
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
    
    // Respond to widget
    res.json(snakeToCamel(tempMessage));
    
    // Save to DB in background
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
        
        // Confirm to customer widget
        sendToConversation(conversationId, {
          type: 'message_confirmed',
          tempId: tempId,
          message: confirmedMessage
        });
        
        // Confirm to agents (update temp ID → real ID)
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
  // Enable by default - critical for preventing cold starts on Render
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
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
      
      setupKeepAlive();
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