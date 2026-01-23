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

// Initialize WebSocket server
initWebSocketServer(server);

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
  
  console.log('📦 Serving widget-init.js with CORS headers');
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
  
  console.log('📦 Serving widget.html for iframe');
  res.sendFile(__dirname + '/public/widget.html');
});

app.use(express.static('public'));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  validate: {
    xForwardedForHeader: false,
    trustProxy: false
  }
});

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

// ============ DEBUG ENDPOINTS (Remove in Production) ============

app.get('/debug/conversation/:id', async (req, res) => {
  try {
    const conversationId = parseInt(req.params.id);
    
    console.log('🔍 DEBUG: Fetching conversation:', conversationId);
    
    const conversation = await db.getConversation(conversationId);
    const messages = await db.getMessages(conversationId);
    
    res.json({
      success: true,
      raw: {
        conversation,
        messages
      },
      converted: {
        conversation: snakeToCamel(conversation),
        messages: messages.map(snakeToCamel)
      },
      messageCount: messages.length
    });
  } catch (error) {
    console.error('❌ Debug error:', error);
    res.status(500).json({ 
      success: false,
      error: error.message,
      stack: error.stack 
    });
  }
});

app.get('/debug/check-tables', async (req, res) => {
  try {
    const client = await db.pool.connect();
    
    try {
      const tables = await client.query(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public'
        ORDER BY table_name;
      `);
      
      const constraints = await client.query(`
        SELECT
          tc.table_name,
          tc.constraint_name,
          tc.constraint_type,
          ccu.table_name AS foreign_table_name,
          ccu.column_name AS foreign_column_name
        FROM information_schema.table_constraints AS tc
        JOIN information_schema.constraint_column_usage AS ccu
          ON ccu.constraint_name = tc.constraint_name
        WHERE tc.constraint_type = 'FOREIGN KEY'
        ORDER BY tc.table_name;
      `);
      
      res.json({
        success: true,
        tables: tables.rows.map(r => r.table_name),
        foreignKeys: constraints.rows
      });
      
    } finally {
      client.release();
    }
    
  } catch (error) {
    res.status(500).json({ 
      error: error.message 
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
    console.log('📖 Fetching conversation:', req.params.id);
    
    const conversation = await db.getConversation(parseInt(req.params.id));
    
    if (!conversation) {
      console.log('❌ Conversation not found:', req.params.id);
      return res.status(404).json({ error: 'Conversation not found' });
    }
    
    console.log('✅ Conversation found:', conversation.id);
    res.json(snakeToCamel(conversation));
  } catch (error) {
    console.error('❌ Error fetching conversation:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/conversations', async (req, res) => {
  try {
    const { storeIdentifier, customerEmail, customerName, initialMessage } = req.body;
    
    console.log('📝 Creating conversation:', { storeIdentifier, customerEmail, customerName });
    
    if (!storeIdentifier || !customerEmail) {
      return res.status(400).json({ error: 'storeIdentifier and customerEmail required' });
    }
    
    const store = await db.getStoreByIdentifier(storeIdentifier);
    if (!store) {
      console.log('❌ Store not found:', storeIdentifier);
      return res.status(404).json({ error: 'Store not found' });
    }
    
    console.log('✅ Store found:', store.id, store.shop_domain);
    
    const conversation = await db.saveConversation({
      store_id: store.id,
      store_identifier: store.shop_domain,
      customer_email: customerEmail,
      customer_name: customerName || customerEmail,
      status: 'open',
      priority: 'normal'
    });
    
    console.log('✅ Conversation created:', conversation.id);
    
    if (initialMessage) {
      console.log('💬 Saving initial message...');
      await db.saveMessage({
        conversation_id: conversation.id,
        store_id: store.id,
        sender_type: 'customer',
        sender_name: customerName || customerEmail,
        content: initialMessage
      });
      console.log('✅ Initial message saved');
    }
    
    broadcastToAgents({
      type: 'new_conversation',
      conversation: snakeToCamel(conversation),
      storeId: store.id,
      storeIdentifier
    });
    
    res.json(snakeToCamel(conversation));
  } catch (error) {
    console.error('❌ Create conversation error:', error);
    console.error('Error stack:', error.stack);
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

app.put('/api/conversations/:id/close', authenticateToken, async (req, res) => {
  try {
    const conversation = await db.closeConversation(parseInt(req.params.id));
    res.json(snakeToCamel(conversation));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============ MESSAGE ENDPOINTS ============

app.get('/api/conversations/:id/messages', authenticateToken, async (req, res) => {
  try {
    console.log('📖 Fetching messages for conversation:', req.params.id);
    
    const messages = await db.getMessages(parseInt(req.params.id));
    
    console.log(`✅ Found ${messages.length} messages`);
    res.json(messages.map(snakeToCamel));
  } catch (error) {
    console.error('❌ Error fetching messages:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/messages', authenticateToken, async (req, res) => {
  try {
    const { conversationId, senderType, senderName, content, storeId } = req.body;
    
    console.log('📨 Sending message:', { conversationId, senderType, senderName, content, storeId });
    
    if (!conversationId || !senderType || !content) {
      console.log('❌ Missing required fields');
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    const message = await db.saveMessage({
      conversation_id: conversationId,
      store_id: storeId,
      sender_type: senderType,
      sender_name: senderName,
      content,
      sent_at: new Date()
    });
    
    console.log('✅ Message saved:', message.id);
    
    const camelMessage = snakeToCamel(message);
    
    // 🔥 IMPORTANT: Send to BOTH conversation participants AND broadcast to agents
    sendToConversation(conversationId, {
      type: 'new_message',
      message: camelMessage
    });
    
    // Also broadcast to all agents for real-time updates
    broadcastToAgents({
      type: 'new_message',
      message: camelMessage,
      conversationId,
      storeId
    });
    
    console.log('✅ Message sent via WebSocket');
    
    res.json(camelMessage);
  } catch (error) {
    console.error('❌ Send message error:', error);
    console.error('Error stack:', error.stack);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/widget/messages', async (req, res) => {
  try {
    const { conversationId, customerEmail, customerName, content, storeIdentifier } = req.body;
    
    console.log('📨 Widget message:', { conversationId, customerEmail, content });
    
    if (!conversationId || !content) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    const store = await db.getStoreByIdentifier(storeIdentifier);
    if (!store) {
      return res.status(404).json({ error: 'Store not found' });
    }
    
    const message = await db.saveMessage({
      conversation_id: conversationId,
      store_id: store.id,
      sender_type: 'customer',
      sender_name: customerName || customerEmail,
      sender_id: customerEmail,
      content,
      message_type: 'text'
    });
    
    console.log('✅ Widget message saved:', message.id);
    
    const camelMessage = snakeToCamel(message);
    
    // Broadcast to agents via WebSocket
    broadcastToAgents({
      type: 'new_message',
      message: camelMessage,
      conversationId,
      storeId: store.id
    });
    
    // Also send to conversation participants
    sendToConversation(conversationId, {
      type: 'new_message',
      message: camelMessage
    });
    
    res.json(camelMessage);
  } catch (error) {
    console.error('❌ Widget message error:', error);
    res.status(500).json({ error: error.message });
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
  console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.error('❌ SERVER ERROR:', err);
  console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.error('Error message:', err.message);
  console.error('Error stack:', err.stack);
  console.error('Request URL:', req.url);
  console.error('Request method:', req.method);
  console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  
  res.status(500).json({ 
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// ============ KEEP-ALIVE MECHANISM ============

function setupKeepAlive() {
  if (process.env.KEEP_ALIVE !== 'true') {
    console.log('⏰ Keep-alive disabled');
    return;
  }

  const APP_URL = process.env.APP_URL || `http://localhost:${process.env.PORT || 3000}`;
  
  console.log('⏰ Keep-alive enabled - pinging every 14 minutes');
  
  setInterval(() => {
    const now = new Date().toISOString();
    
    http.get(`${APP_URL}/health`, (res) => {
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
    
  }, 14 * 60 * 1000);
  
  setTimeout(() => {
    console.log('⏰ Running initial keep-alive ping...');
    http.get(`${APP_URL}/health`, (res) => {
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
    
    // Step 1: Test database connection
    console.log('📡 Testing database connection...');
    await db.testConnection();
    console.log('✅ Database connection successful\n');
    
    // Step 2: Initialize database tables (only if they don't exist)
    console.log('🗄️  Initializing database tables...');
    await db.initDatabase();
    console.log('✅ Database tables initialized\n');
    
    // Step 3: Run database migrations (always runs, checks each migration)
    console.log('🔄 Running database migrations...');
    await db.runMigrations();
    console.log('✅ Database migrations completed\n');
    
    // Step 4: Start the server
    server.listen(PORT, () => {
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('🚀 MULTI-STORE CHAT SERVER READY');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log(`📍 Server: http://localhost:${PORT}`);
      console.log(`🏥 Health: http://localhost:${PORT}/health`);
      console.log(`🔐 OAuth: http://localhost:${PORT}/auth?shop=STORE.myshopify.com`);
      console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
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