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
// This ensures ALL responses have CORS headers
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
  res.header('Access-Control-Allow-Credentials', 'true');
  
  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    return res.sendStatus(204);
  }
  next();
});

// Initialize WebSocket server
initWebSocketServer(server);

console.log('\n🚀 Multi-Store Chat Server Starting...\n');

// ============ HELPER FUNCTIONS ============

// Convert snake_case to camelCase
function snakeToCamel(obj) {
  if (!obj) return obj;
  if (Array.isArray(obj)) return obj.map(snakeToCamel);
  if (typeof obj !== 'object') return obj;
  
  const camelObj = {};
  for (const [key, value] of Object.entries(obj)) {
    const camelKey = key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
    camelObj[camelKey] = value;
  }
  return camelObj;
}

// Convert camelCase to snake_case
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
  frameguard: false  // 🔥 Allow iframe embedding
}));

// ⚠️ IMPORTANT: Webhook route BEFORE express.json()
// Webhooks need raw body for HMAC verification
app.post('/webhooks/:shop/:topic', rawBodyMiddleware, handleWebhook);

// JSON middleware for other routes
app.use(express.json());

// ============ WIDGET STATIC FILES ============
// 🔥 CRITICAL: Widget routes MUST come BEFORE express.static()

// Serve widget initializer with CORS
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

// Serve widget.html with iframe-friendly headers
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

// Serve other static files
app.use(express.static('public'));

// Rate limiting with proper proxy validation
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
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

// Stricter rate limit for login
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

// ============ WIDGET API ENDPOINTS ============

// Verify store is registered (public - called by widget)
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

// Get widget settings (public - called by widget)
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

// Widget session token (public - called by widget)
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

// Login
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

// Logout
app.post('/api/employees/logout', authenticateToken, async (req, res) => {
  try {
    await db.updateEmployeeStatus(req.user.id, { is_online: false });
    res.json({ message: 'Logged out successfully' });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ error: 'Logout failed' });
  }
});

// Verify token
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

// Get all stores (protected)
app.get('/api/stores', authenticateToken, async (req, res) => {
  try {
    const stores = await db.getAllActiveStores();
    
    // Convert to camelCase
    const camelCaseStores = stores.map(store => snakeToCamel(store));
    
    res.json(camelCaseStores);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get customer context from Shopify (protected)
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

// Register webhooks for store (protected)
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

// Get conversations (protected)
app.get('/api/conversations', authenticateToken, async (req, res) => {
  try {
    const { storeId, status, limit, offset } = req.query;
    
    const filters = {};
    if (storeId) filters.storeId = parseInt(storeId);
    if (status) filters.status = status;
    if (limit) filters.limit = parseInt(limit);
    if (offset) filters.offset = parseInt(offset);
    
    const conversations = await db.getConversations(filters);
    res.json(conversations);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get single conversation (protected)
app.get('/api/conversations/:id', authenticateToken, async (req, res) => {
  try {
    const conversation = await db.getConversation(parseInt(req.params.id));
    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found' });
    }
    res.json(conversation);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create conversation (public - can be called by widget)
app.post('/api/conversations', async (req, res) => {
  try {
    const { storeIdentifier, customerEmail, customerName, initialMessage } = req.body;
    
    if (!storeIdentifier || !customerEmail) {
      return res.status(400).json({ error: 'storeIdentifier and customerEmail required' });
    }
    
    // Get store
    const store = await db.getStoreByIdentifier(storeIdentifier);
    if (!store) {
      return res.status(404).json({ error: 'Store not found' });
    }
    
    // Create conversation
    const conversation = await db.saveConversation({
      shopId: store.id,
      shopDomain: store.shop_domain,
      customerEmail,
      customerName: customerName || customerEmail,
      status: 'open',
      createdAt: new Date(),
      updatedAt: new Date()
    });
    
    // If there's an initial message, save it
    if (initialMessage) {
      await db.saveMessage({
        conversationId: conversation.id,
        storeId: store.id,
        senderType: 'customer',
        senderName: customerName || customerEmail,
        content: initialMessage,
        sentAt: new Date()
      });
    }
    
    // Broadcast to agents
    broadcastToAgents({
      type: 'new_conversation',
      conversation,
      storeId: store.id,
      storeIdentifier
    });
    
    res.json(conversation);
  } catch (error) {
    console.error('Create conversation error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Update conversation (protected)
app.put('/api/conversations/:id', authenticateToken, async (req, res) => {
  try {
    const conversation = await db.updateConversation(parseInt(req.params.id), req.body);
    res.json(conversation);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Close conversation (protected)
app.put('/api/conversations/:id/close', authenticateToken, async (req, res) => {
  try {
    const conversation = await db.closeConversation(parseInt(req.params.id));
    res.json(conversation);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============ MESSAGE ENDPOINTS ============

// Get messages (protected)
app.get('/api/conversations/:id/messages', authenticateToken, async (req, res) => {
  try {
    const messages = await db.getMessages(parseInt(req.params.id));
    res.json(messages);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Send message (can be called by widget or agent)
app.post('/api/messages', authenticateToken, async (req, res) => {
  try {
    const { conversationId, senderType, senderName, content, storeId } = req.body;
    
    if (!conversationId || !senderType || !content) {
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
    
    // Send via WebSocket
    sendToConversation(conversationId, {
      type: 'new_message',
      message
    });
    
    res.json(message);
  } catch (error) {
    console.error('Send message error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============ EMPLOYEE ENDPOINTS ============

// Get all employees (protected - admin only)
app.get('/api/employees', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }
    
    const employees = await db.getAllEmployees();
    
    // Convert to camelCase and sanitize
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

// Create employee (protected - admin only)
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

// Update employee (protected - admin only)
app.put('/api/employees/:id', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }
    
    const employeeId = parseInt(req.params.id);
    const updates = req.body;
    
    // Convert camelCase to snake_case for database
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

// Delete employee (protected - admin only)
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

// Update employee status (protected)
app.put('/api/employees/:id/status', authenticateToken, async (req, res) => {
  try {
    await db.updateEmployeeStatus(parseInt(req.params.id), req.body.status);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============ STATS ENDPOINTS ============

// Dashboard stats (protected)
app.get('/api/stats/dashboard', authenticateToken, async (req, res) => {
  try {
    const stats = await db.getDashboardStats(req.query);
    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// WebSocket stats (protected)
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
  console.error('Server error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// ============ KEEP-ALIVE MECHANISM ============
// Prevents Render free tier from sleeping

function setupKeepAlive() {
  if (process.env.KEEP_ALIVE !== 'true') {
    console.log('⏰ Keep-alive disabled');
    return;
  }

  const APP_URL = process.env.APP_URL || `http://localhost:${process.env.PORT || 3000}`;
  
  console.log('⏰ Keep-alive enabled - pinging every 14 minutes');
  
  // Ping every 14 minutes (free tier sleeps after 15 minutes of inactivity)
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
    
  }, 14 * 60 * 1000); // 14 minutes
  
  // Initial ping after 1 minute
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
    await db.testConnection();
    console.log('✅ Database connected');
    
    server.listen(PORT, () => {
      console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('🚀 MULTI-STORE CHAT SERVER READY');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log(`📍 Server: http://localhost:${PORT}`);
      console.log(`🏥 Health: http://localhost:${PORT}/health`);
      console.log(`🔐 OAuth: http://localhost:${PORT}/auth?shop=STORE.myshopify.com`);
      console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
      
      // Setup keep-alive after server starts
      setupKeepAlive();
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();

module.exports = { app, server };
