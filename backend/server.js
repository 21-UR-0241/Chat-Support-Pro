// require('dotenv').config();
// const express = require('express');
// const cors = require('cors');
// const http = require('http');
// const rateLimit = require('express-rate-limit');
// const helmet = require('helmet');
// const db = require('./db');
// const shopify = require('./shopify-api');
// const { handleWebhook } = require('./webhooks');
// const { getAuthUrl, handleCallback } = require('./shopify-auth');
// const { initWebSocketServer, sendToConversation, broadcastToAgents, getWebSocketStats } = require('./websocket-server');
// const { hashPassword, verifyPassword, generateToken, authenticateToken } = require('./auth');

// const app = express();
// const server = http.createServer(app);

// // Initialize WebSocket server
// initWebSocketServer(server);

// // Security headers
// app.use(helmet({
//   contentSecurityPolicy: false, // Disable for now to allow inline scripts
// }));

// // Middleware
// app.use(cors({
//   origin: process.env.ALLOWED_ORIGINS === '*' ? '*' : process.env.ALLOWED_ORIGINS?.split(','),
//   credentials: true
// }));
// app.use(express.json());

// // Serve chat widget static files
// app.use(express.static('public'));

// // Rate limiting
// const limiter = rateLimit({
//   windowMs: 15 * 60 * 1000, // 15 minutes
//   max: 100, // Limit each IP to 100 requests per windowMs
//   message: 'Too many requests from this IP, please try again later.',
//   standardHeaders: true,
//   legacyHeaders: false,
// });

// app.use('/api/', limiter);

// // Stricter rate limit for login
// const loginLimiter = rateLimit({
//   windowMs: 15 * 60 * 1000, // 15 minutes
//   max: 5, // Max 5 login attempts
//   message: 'Too many login attempts, please try again later.',
//   skipSuccessfulRequests: true,
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

// // Enhanced health check
// app.get('/health', async (req, res) => {
//   try {
//     // Check database
//     await db.testConnection();
    
//     // Check WebSocket
//     const wsStats = getWebSocketStats();
    
//     res.json({
//       status: 'healthy',
//       timestamp: new Date().toISOString(),
//       database: 'connected',
//       websocket: {
//         active: wsStats.totalConnections > 0,
//         connections: wsStats.totalConnections,
//         agents: wsStats.agentCount,
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

// // Serve widget initializer script (for theme app extension)
// app.get('/widget-init.js', cors({ origin: '*' }), (req, res) => {
//   res.set('Content-Type', 'application/javascript');
//   res.set('Cache-Control', 'public, max-age=3600'); // Cache for 1 hour
//   res.sendFile(__dirname + '/public/widget-init.js');
// });

// // ============ Authentication Endpoints ============

// // Login endpoint
// app.post('/api/employees/login', loginLimiter, async (req, res) => {
//   try {
//     const { email, password } = req.body;
    
//     // Validate input
//     if (!email || !password) {
//       return res.status(400).json({ error: 'Email and password required' });
//     }
    
//     if (!email.includes('@')) {
//       return res.status(400).json({ error: 'Invalid email format' });
//     }
    
//     // Get employee
//     const employee = await db.getEmployeeByEmail(email);
    
//     if (!employee) {
//       return res.status(401).json({ error: 'Invalid email or password' });
//     }
    
//     // Check if active
//     if (!employee.isActive) {
//       return res.status(403).json({ error: 'Account is inactive' });
//     }
    
//     // Verify password
//     const validPassword = await verifyPassword(password, employee.passwordHash);
    
//     if (!validPassword) {
//       return res.status(401).json({ error: 'Invalid email or password' });
//     }
    
//     // Update last login
//     await db.updateEmployeeStatus(employee.id, { 
//       lastLogin: new Date(),
//       isOnline: true 
//     });
    
//     // Generate token
//     const token = generateToken(employee);
    
//     // Remove sensitive data
//     delete employee.passwordHash;
//     delete employee.apiToken;
    
//     res.json({
//       employee,
//       token,
//       expiresIn: '7d'
//     });
//   } catch (error) {
//     console.error('Login error:', error);
//     res.status(500).json({ error: 'Login failed. Please try again.' });
//   }
// });

// // Logout endpoint
// app.post('/api/employees/logout', authenticateToken, async (req, res) => {
//   try {
//     await db.updateEmployeeStatus(req.user.id, { isOnline: false });
//     res.json({ message: 'Logged out successfully' });
//   } catch (error) {
//     console.error('Logout error:', error);
//     res.status(500).json({ error: 'Logout failed' });
//   }
// });

// // Verify token endpoint
// app.get('/api/auth/verify', authenticateToken, async (req, res) => {
//   try {
//     const employee = await db.getEmployeeByEmail(req.user.email);
    
//     if (!employee || !employee.isActive) {
//       return res.status(403).json({ error: 'Invalid session' });
//     }
    
//     delete employee.passwordHash;
//     delete employee.apiToken;
    
//     res.json({ employee });
//   } catch (error) {
//     res.status(500).json({ error: 'Verification failed' });
//   }
// });

// // ============ OAuth Routes ============

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

// // ============ Store Endpoints ============

// // Store registration (public for OAuth flow)
// app.post('/api/stores/register', async (req, res) => {
//   try {
//     const store = await db.registerStore(req.body);
//     res.json(store);
//   } catch (error) {
//     console.error('Register store error:', error);
//     res.status(500).json({ error: error.message });
//   }
// });

// // Get all stores (protected)
// app.get('/api/stores', authenticateToken, async (req, res) => {
//   try {
//     const stores = await db.getAllActiveStores();
//     res.json(stores);
//   } catch (error) {
//     res.status(500).json({ error: error.message });
//   }
// });

// // Get customer context (protected)
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

// // Get customer by ID (protected)
// app.get('/api/customers/:id/context', authenticateToken, async (req, res) => {
//   try {
//     const { storeId } = req.query;
//     const store = await db.getStoreByIdentifier(storeId);
    
//     if (!store) {
//       return res.status(404).json({ error: 'Store not found' });
//     }
    
//     const customer = await shopify.getCustomerByEmail(store, req.params.id);
//     if (!customer) {
//       return res.status(404).json({ error: 'Customer not found' });
//     }
    
//     const orders = await shopify.getCustomerOrders(store, customer.id);
    
//     res.json({
//       customer: {
//         id: customer.id,
//         email: customer.email,
//         first_name: customer.first_name,
//         last_name: customer.last_name,
//         orders_count: customer.orders_count,
//         total_spent: customer.total_spent,
//         created_at: customer.created_at
//       },
//       orders: orders.slice(0, 10)
//     });
//   } catch (error) {
//     console.error('Customer context error:', error);
//     res.status(500).json({ error: 'Failed to fetch customer context' });
//   }
// });

// // ============ Conversation Endpoints ============

// // Create conversation (public - from widget)
// app.post('/api/conversations', async (req, res) => {
//   try {
//     const { storeId, customer_email, customer_name, initial_message } = req.body;
    
//     if (!storeId || !customer_email) {
//       return res.status(400).json({ error: 'storeId and customer_email required' });
//     }
    
//     const store = await db.getStoreByIdentifier(storeId);
//     if (!store) {
//       return res.status(404).json({ error: 'Store not found' });
//     }
    
//     const conversation = await db.saveConversation({
//       shopId: store.id,
//       shopDomain: store.shopDomain,
//       customerEmail: customer_email,
//       customerName: customer_name,
//       status: 'open'
//     });
    
//     // Save initial message
//     if (initial_message) {
//       await db.saveMessage({
//         conversationId: conversation.id,
//         shopId: store.id,
//         senderType: 'customer',
//         senderName: customer_name || customer_email,
//         content: initial_message
//       });
//     }
    
//     res.json(conversation);
//   } catch (error) {
//     console.error('Create conversation error:', error);
//     res.status(500).json({ error: 'Failed to create conversation' });
//   }
// });

// // Get conversations (protected)
// app.get('/api/conversations', authenticateToken, async (req, res) => {
//   try {
//     const conversations = await db.getConversations(req.query);
//     res.json(conversations);
//   } catch (error) {
//     console.error('Get conversations error:', error);
//     res.status(500).json({ error: error.message });
//   }
// });

// // Get single conversation (protected)
// app.get('/api/conversations/:id', authenticateToken, async (req, res) => {
//   try {
//     const conversation = await db.getConversation(parseInt(req.params.id));
    
//     if (!conversation) {
//       return res.status(404).json({ error: 'Conversation not found' });
//     }
    
//     const messages = await db.getMessages(parseInt(req.params.id));
    
//     res.json({
//       ...conversation,
//       messages
//     });
//   } catch (error) {
//     console.error('Get conversation error:', error);
//     res.status(500).json({ error: 'Failed to fetch conversation' });
//   }
// });

// // Update conversation (protected)
// app.put('/api/conversations/:id', authenticateToken, async (req, res) => {
//   try {
//     const conversation = await db.updateConversation(parseInt(req.params.id), req.body);
//     res.json(conversation);
//   } catch (error) {
//     res.status(500).json({ error: error.message });
//   }
// });

// // Close conversation (protected)
// app.put('/api/conversations/:id/close', authenticateToken, async (req, res) => {
//   try {
//     const conversation = await db.closeConversation(parseInt(req.params.id));
//     res.json(conversation);
//   } catch (error) {
//     res.status(500).json({ error: error.message });
//   }
// });

// // ============ Message Endpoints ============

// // Send message (protected for agents, public for customers via widget)
// app.post('/api/messages', async (req, res) => {
//   try {
//     const { conversationId, storeId, senderType, senderName, content } = req.body;
    
//     if (!conversationId || !storeId || !senderType || !content) {
//       return res.status(400).json({ error: 'Missing required fields' });
//     }
    
//     // If agent message, verify authentication
//     if (senderType === 'agent') {
//       const authHeader = req.headers['authorization'];
//       const token = authHeader && authHeader.split(' ')[1];
      
//       if (!token) {
//         return res.status(401).json({ error: 'Authentication required for agent messages' });
//       }
//     }
    
//     const message = await db.saveMessage({
//       conversationId,
//       shopId: storeId,
//       senderType,
//       senderName: senderName || senderType,
//       content
//     });
    
//     // Send via WebSocket to conversation participants
//     sendToConversation(conversationId, {
//       type: 'message',
//       data: message,
//       timestamp: new Date().toISOString()
//     });
    
//     // If customer message, notify all agents
//     if (senderType === 'customer') {
//       broadcastToAgents({
//         type: 'new_message',
//         conversationId,
//         message,
//         timestamp: new Date().toISOString()
//       });
//     }
    
//     res.json(message);
//   } catch (error) {
//     console.error('Send message error:', error);
//     res.status(500).json({ error: 'Failed to send message' });
//   }
// });

// // Get messages (protected)
// app.get('/api/conversations/:id/messages', authenticateToken, async (req, res) => {
//   try {
//     const messages = await db.getMessages(parseInt(req.params.id));
//     res.json(messages);
//   } catch (error) {
//     res.status(500).json({ error: error.message });
//   }
// });

// // ============ Webhook Endpoints ============

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

// app.post('/webhooks/:storeIdentifier/:topic', handleWebhook);

// // App uninstalled webhook
// app.post('/webhooks/app-uninstalled', async (req, res) => {
//   try {
//     const shopDomain = req.get('X-Shopify-Shop-Domain');
//     if (!shopDomain) {
//       return res.status(400).json({ error: 'Missing shop domain' });
//     }
    
//     // Mark store as inactive
//     const store = await db.getStoreByDomain(shopDomain);
//     if (store) {
//       await db.updateStoreSettings(store.id, { isActive: false });
//       console.log(`App uninstalled from: ${shopDomain}`);
//     }
    
//     res.status(200).send('Webhook processed');
//   } catch (error) {
//     console.error('Webhook error:', error);
//     res.status(500).json({ error: 'Webhook processing failed' });
//   }
// });

// // ============ Stats Endpoints ============

// // Dashboard stats (protected)
// app.get('/api/stats/dashboard', authenticateToken, async (req, res) => {
//   try {
//     const stats = await db.getDashboardStats(req.query);
//     res.json(stats);
//   } catch (error) {
//     res.status(500).json({ error: error.message });
//   }
// });

// // WebSocket stats (protected)
// app.get('/api/stats/websocket', authenticateToken, (req, res) => {
//   try {
//     const stats = getWebSocketStats();
//     res.json(stats);
//   } catch (error) {
//     res.status(500).json({ error: error.message });
//   }
// });

// // ============ Employee Endpoints ============

// // Create employee (protected - admin only)
// app.post('/api/employees', authenticateToken, async (req, res) => {
//   try {
//     // Check if user is admin
//     if (req.user.role !== 'admin') {
//       return res.status(403).json({ error: 'Admin access required' });
//     }
    
//     const employee = await db.createEmployee(req.body);
//     res.json(employee);
//   } catch (error) {
//     res.status(500).json({ error: error.message });
//   }
// });

// // Get employee by email (protected)
// app.get('/api/employees/:email', authenticateToken, async (req, res) => {
//   try {
//     const employee = await db.getEmployeeByEmail(req.params.email);
//     if (!employee) {
//       return res.status(404).json({ error: 'Employee not found' });
//     }
    
//     // Remove sensitive data
//     delete employee.passwordHash;
//     delete employee.apiToken;
    
//     res.json(employee);
//   } catch (error) {
//     res.status(500).json({ error: error.message });
//   }
// });

// // Update employee status (protected)
// app.put('/api/employees/:id/status', authenticateToken, async (req, res) => {
//   try {
//     await db.updateEmployeeStatus(parseInt(req.params.id), req.body.status);
//     res.json({ success: true });
//   } catch (error) {
//     res.status(500).json({ error: error.message });
//   }
// });

// // ============ Employee Management (CRUD) ============

// // Get all employees (protected - admin only)
// app.get('/api/employees', authenticateToken, async (req, res) => {
//   try {
//     // Check if user is admin
//     if (req.user.role !== 'admin') {
//       return res.status(403).json({ error: 'Admin access required' });
//     }
    
//     const employees = await db.getAllEmployees();
    
//     // Remove sensitive data
//     const sanitized = employees.map(emp => {
//       const { passwordHash, apiToken, ...safe } = emp;
//       return safe;
//     });
    
//     res.json(sanitized);
//   } catch (error) {
//     console.error('Get employees error:', error);
//     res.status(500).json({ error: 'Failed to fetch employees' });
//   }
// });

// // Update employee (protected - admin only)
// app.put('/api/employees/:id', authenticateToken, async (req, res) => {
//   try {
//     // Check if user is admin
//     if (req.user.role !== 'admin') {
//       return res.status(403).json({ error: 'Admin access required' });
//     }
    
//     const employeeId = parseInt(req.params.id);
//     const updates = req.body;
    
//     // Hash password if provided
//     if (updates.password) {
//       const { hashPassword } = require('./auth');
//       updates.passwordHash = await hashPassword(updates.password);
//       delete updates.password;
//     }
    
//     const employee = await db.updateEmployee(employeeId, updates);
    
//     // Remove sensitive data
//     delete employee.passwordHash;
//     delete employee.apiToken;
    
//     res.json(employee);
//   } catch (error) {
//     console.error('Update employee error:', error);
//     res.status(500).json({ error: 'Failed to update employee' });
//   }
// });

// // Delete employee (protected - admin only)
// app.delete('/api/employees/:id', authenticateToken, async (req, res) => {
//   try {
//     // Check if user is admin
//     if (req.user.role !== 'admin') {
//       return res.status(403).json({ error: 'Admin access required' });
//     }
    
//     const employeeId = parseInt(req.params.id);
    
//     // Don't allow deleting yourself
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

// // Error handler
// app.use((err, req, res, next) => {
//   console.error('Server error:', err);
//   res.status(500).json({ error: 'Internal server error' });
// });

// // Start server
// const PORT = process.env.PORT || 3000;

// async function startServer() {
//   try {
//     await db.testConnection();
//     console.log('✅ Database connected');
    
//     server.listen(PORT, () => {
//       console.log(`✅ Server running on http://localhost:${PORT}`);
//       console.log(`✅ Health check: http://localhost:${PORT}/health`);
//       console.log(`✅ Environment: ${process.env.NODE_ENV || 'development'}`);
//     });
//   } catch (error) {
//     console.error('Failed to start server:', error);
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
const db = require('./db');
const shopify = require('./shopify-api');
const { handleWebhook } = require('./webhooks');
const { getAuthUrl, handleCallback } = require('./shopify-auth');
const { initWebSocketServer, sendToConversation, broadcastToAgents, getWebSocketStats } = require('./websocket-server');
const { hashPassword, verifyPassword, generateToken, authenticateToken } = require('./auth');

const app = express();
const server = http.createServer(app);

// Log server configuration
console.log('\n========================================');
console.log('🚀 SERVER CONFIGURATION');
console.log('========================================');
console.log('NODE_ENV:', process.env.NODE_ENV || 'development');
console.log('PORT:', process.env.PORT || 3000);
console.log('JWT_SECRET exists:', !!process.env.JWT_SECRET);
console.log('ALLOWED_ORIGINS:', process.env.ALLOWED_ORIGINS || 'Not set');
console.log('========================================\n');

// Initialize WebSocket server
initWebSocketServer(server);

// Security headers
app.use(helmet({
  contentSecurityPolicy: false, // Disable for now to allow inline scripts
}));

// Middleware
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS === '*' ? '*' : process.env.ALLOWED_ORIGINS?.split(','),
  credentials: true
}));
app.use(express.json());

// Serve chat widget static files
app.use(express.static('public'));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

app.use('/api/', limiter);

// Stricter rate limit for login
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Max 5 login attempts
  message: 'Too many login attempts, please try again later.',
  skipSuccessfulRequests: true,
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

// Enhanced request logger
app.use((req, res, next) => {
  const timestamp = new Date().toISOString();
  console.log(`\n[${timestamp}] ${req.method} ${req.path}`);
  
  // Log auth header if present
  if (req.headers['authorization']) {
    const token = req.headers['authorization'].split(' ')[1];
    console.log('  🔑 Auth header present:', token ? token.substring(0, 30) + '...' : 'INVALID');
  } else if (req.path.startsWith('/api/') && req.path !== '/api/employees/login') {
    console.log('  ⚠️ No auth header (may be required)');
  }
  
  next();
});

// Enhanced health check
app.get('/health', async (req, res) => {
  try {
    // Check database
    await db.testConnection();
    
    // Check WebSocket
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

// Serve widget initializer script (for theme app extension)
app.get('/widget-init.js', cors({ origin: '*' }), (req, res) => {
  res.set('Content-Type', 'application/javascript');
  res.set('Cache-Control', 'public, max-age=3600'); // Cache for 1 hour
  res.sendFile(__dirname + '/public/widget-init.js');
});

// ============ Authentication Endpoints ============

// Login endpoint
app.post('/api/employees/login', loginLimiter, async (req, res) => {
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🔐 LOGIN ATTEMPT');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  
  try {
    const { email, password } = req.body;
    console.log('📧 Email:', email);
    
    // Validate input
    if (!email || !password) {
      console.log('❌ Missing credentials');
      return res.status(400).json({ error: 'Email and password required' });
    }
    
    if (!email.includes('@')) {
      console.log('❌ Invalid email format');
      return res.status(400).json({ error: 'Invalid email format' });
    }
    
    // Get employee
    console.log('🔍 Looking up employee...');
    const employee = await db.getEmployeeByEmail(email);
    
    if (!employee) {
      console.log('❌ Employee not found');
      return res.status(401).json({ error: 'Invalid email or password' });
    }
    
    console.log('✅ Employee found:', {
      id: employee.id,
      email: employee.email,
      name: employee.name,
      role: employee.role,
      isActive: employee.isActive
    });
    
    // Check if active
    if (!employee.isActive) {
      console.log('❌ Account inactive');
      return res.status(403).json({ error: 'Account is inactive' });
    }
    
    // Verify password
    console.log('🔒 Verifying password...');
    const validPassword = await verifyPassword(password, employee.passwordHash);
    
    if (!validPassword) {
      console.log('❌ Invalid password');
      return res.status(401).json({ error: 'Invalid email or password' });
    }
    
    console.log('✅ Password valid');
    
    // Update last login
    await db.updateEmployeeStatus(employee.id, { 
      lastLogin: new Date(),
      isOnline: true 
    });
    
    // Generate token
    console.log('🎫 Generating token...');
    const token = generateToken(employee);
    console.log('✅ Token generated successfully');
    
    // Remove sensitive data
    delete employee.passwordHash;
    delete employee.apiToken;
    
    console.log('✅ LOGIN SUCCESSFUL - Sending response');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    res.json({
      employee,
      token,
      expiresIn: '7d'
    });
  } catch (error) {
    console.error('❌ LOGIN ERROR:', error);
    console.error('Stack:', error.stack);
    res.status(500).json({ error: 'Login failed. Please try again.' });
  }
});

// Logout endpoint
app.post('/api/employees/logout', authenticateToken, async (req, res) => {
  console.log('🚪 LOGOUT:', req.user.email);
  try {
    await db.updateEmployeeStatus(req.user.id, { isOnline: false });
    res.json({ message: 'Logged out successfully' });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ error: 'Logout failed' });
  }
});

// Verify token endpoint
app.get('/api/auth/verify', authenticateToken, async (req, res) => {
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🔍 TOKEN VERIFICATION REQUEST');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  
  try {
    console.log('👤 User from token:', req.user);
    console.log('📧 Looking up employee:', req.user.email);
    
    const employee = await db.getEmployeeByEmail(req.user.email);
    
    if (!employee) {
      console.log('❌ Employee not found in database');
      return res.status(403).json({ error: 'Invalid session' });
    }
    
    if (!employee.isActive) {
      console.log('❌ Employee account inactive');
      return res.status(403).json({ error: 'Invalid session' });
    }
    
    delete employee.passwordHash;
    delete employee.apiToken;
    
    console.log('✅ Token verified successfully');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    res.json({ employee });
  } catch (error) {
    console.error('❌ VERIFICATION ERROR:', error);
    res.status(500).json({ error: 'Verification failed' });
  }
});

// ============ OAuth Routes ============

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

// ============ Store Endpoints ============

// Store registration (public for OAuth flow)
app.post('/api/stores/register', async (req, res) => {
  try {
    const store = await db.registerStore(req.body);
    res.json(store);
  } catch (error) {
    console.error('Register store error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get all stores (protected)
app.get('/api/stores', authenticateToken, async (req, res) => {
  try {
    const stores = await db.getAllActiveStores();
    res.json(stores);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get customer context (protected)
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

// Get customer by ID (protected)
app.get('/api/customers/:id/context', authenticateToken, async (req, res) => {
  try {
    const { storeId } = req.query;
    const store = await db.getStoreByIdentifier(storeId);
    
    if (!store) {
      return res.status(404).json({ error: 'Store not found' });
    }
    
    const customer = await shopify.getCustomerByEmail(store, req.params.id);
    if (!customer) {
      return res.status(404).json({ error: 'Customer not found' });
    }
    
    const orders = await shopify.getCustomerOrders(store, customer.id);
    
    res.json({
      customer: {
        id: customer.id,
        email: customer.email,
        first_name: customer.first_name,
        last_name: customer.last_name,
        orders_count: customer.orders_count,
        total_spent: customer.total_spent,
        created_at: customer.created_at
      },
      orders: orders.slice(0, 10)
    });
  } catch (error) {
    console.error('Customer context error:', error);
    res.status(500).json({ error: 'Failed to fetch customer context' });
  }
});

// ============ Conversation Endpoints ============

// Create conversation (public - from widget)
app.post('/api/conversations', async (req, res) => {
  try {
    const { storeId, customer_email, customer_name, initial_message } = req.body;
    
    if (!storeId || !customer_email) {
      return res.status(400).json({ error: 'storeId and customer_email required' });
    }
    
    const store = await db.getStoreByIdentifier(storeId);
    if (!store) {
      return res.status(404).json({ error: 'Store not found' });
    }
    
    const conversation = await db.saveConversation({
      shopId: store.id,
      shopDomain: store.shopDomain,
      customerEmail: customer_email,
      customerName: customer_name,
      status: 'open'
    });
    
    // Save initial message
    if (initial_message) {
      await db.saveMessage({
        conversationId: conversation.id,
        shopId: store.id,
        senderType: 'customer',
        senderName: customer_name || customer_email,
        content: initial_message
      });
    }
    
    res.json(conversation);
  } catch (error) {
    console.error('Create conversation error:', error);
    res.status(500).json({ error: 'Failed to create conversation' });
  }
});

// Get conversations (protected)
app.get('/api/conversations', authenticateToken, async (req, res) => {
  try {
    const conversations = await db.getConversations(req.query);
    res.json(conversations);
  } catch (error) {
    console.error('Get conversations error:', error);
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
    
    const messages = await db.getMessages(parseInt(req.params.id));
    
    res.json({
      ...conversation,
      messages
    });
  } catch (error) {
    console.error('Get conversation error:', error);
    res.status(500).json({ error: 'Failed to fetch conversation' });
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

// ============ Message Endpoints ============

// Send message (protected for agents, public for customers via widget)
app.post('/api/messages', async (req, res) => {
  try {
    const { conversationId, storeId, senderType, senderName, content } = req.body;
    
    if (!conversationId || !storeId || !senderType || !content) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    // If agent message, verify authentication
    if (senderType === 'agent') {
      const authHeader = req.headers['authorization'];
      const token = authHeader && authHeader.split(' ')[1];
      
      if (!token) {
        return res.status(401).json({ error: 'Authentication required for agent messages' });
      }
    }
    
    const message = await db.saveMessage({
      conversationId,
      shopId: storeId,
      senderType,
      senderName: senderName || senderType,
      content
    });
    
    // Send via WebSocket to conversation participants
    sendToConversation(conversationId, {
      type: 'message',
      data: message,
      timestamp: new Date().toISOString()
    });
    
    // If customer message, notify all agents
    if (senderType === 'customer') {
      broadcastToAgents({
        type: 'new_message',
        conversationId,
        message,
        timestamp: new Date().toISOString()
      });
    }
    
    res.json(message);
  } catch (error) {
    console.error('Send message error:', error);
    res.status(500).json({ error: 'Failed to send message' });
  }
});

// Get messages (protected)
app.get('/api/conversations/:id/messages', authenticateToken, async (req, res) => {
  try {
    const messages = await db.getMessages(parseInt(req.params.id));
    res.json(messages);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============ Webhook Endpoints ============

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

app.post('/webhooks/:storeIdentifier/:topic', handleWebhook);

// App uninstalled webhook
app.post('/webhooks/app-uninstalled', async (req, res) => {
  try {
    const shopDomain = req.get('X-Shopify-Shop-Domain');
    if (!shopDomain) {
      return res.status(400).json({ error: 'Missing shop domain' });
    }
    
    // Mark store as inactive
    const store = await db.getStoreByDomain(shopDomain);
    if (store) {
      await db.updateStoreSettings(store.id, { isActive: false });
      console.log(`App uninstalled from: ${shopDomain}`);
    }
    
    res.status(200).send('Webhook processed');
  } catch (error) {
    console.error('Webhook error:', error);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

// ============ Stats Endpoints ============

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

// ============ Employee Endpoints ============

// Create employee (protected - admin only)
// Create employee (protected - admin only)
app.post('/api/employees', authenticateToken, async (req, res) => {
  try {
    // Check if user is admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }
    
    console.log('📝 Creating new employee');
    console.log('📋 Request body:', req.body);
    
    // Extract with correct field names (frontend sends camelCase)
    const { email, name, role, password, canViewAllStores, isActive } = req.body;
    
    // Validate required fields
    if (!email || !name || !password) {
      console.log('❌ Missing required fields');
      return res.status(400).json({ error: 'Email, name, and password are required' });
    }
    
    // Hash the password
    console.log('🔒 Hashing password...');
    const password_hash = await hashPassword(password);
    console.log('✅ Password hashed');
    
    // Create employee with hashed password
    // Database expects snake_case field names
    const employee = await db.createEmployee({
      email,
      name,
      role: role || 'agent',
      password_hash,
      can_view_all_stores: canViewAllStores !== undefined ? canViewAllStores : true,
      assigned_stores: []
    });
    
    console.log('✅ Employee created successfully:', employee.email);
    
    // Remove sensitive data before sending response
    delete employee.password_hash;
    delete employee.api_token;
    
    res.json(employee);
  } catch (error) {
    console.error('❌ Create employee error:', error);
    console.error('Stack:', error.stack);
    res.status(500).json({ error: error.message });
  }
});


// Get employee by email (protected)
app.get('/api/employees/:email', authenticateToken, async (req, res) => {
  try {
    const employee = await db.getEmployeeByEmail(req.params.email);
    if (!employee) {
      return res.status(404).json({ error: 'Employee not found' });
    }
    
    // Remove sensitive data
    delete employee.passwordHash;
    delete employee.apiToken;
    
    res.json(employee);
  } catch (error) {
    res.status(500).json({ error: error.message });
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

// ============ Employee Management (CRUD) ============

// Get all employees (protected - admin only)
app.get('/api/employees', authenticateToken, async (req, res) => {
  try {
    // Check if user is admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }
    
    const employees = await db.getAllEmployees();
    
    // Remove sensitive data
    const sanitized = employees.map(emp => {
      const { passwordHash, apiToken, ...safe } = emp;
      return safe;
    });
    
    res.json(sanitized);
  } catch (error) {
    console.error('Get employees error:', error);
    res.status(500).json({ error: 'Failed to fetch employees' });
  }
});

// Update employee (protected - admin only)
app.put('/api/employees/:id', authenticateToken, async (req, res) => {
  try {
    // Check if user is admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }
    
    const employeeId = parseInt(req.params.id);
    const updates = req.body;
    
    // Hash password if provided
    if (updates.password) {
      const { hashPassword } = require('./auth');
      updates.passwordHash = await hashPassword(updates.password);
      delete updates.password;
    }
    
    const employee = await db.updateEmployee(employeeId, updates);
    
    // Remove sensitive data
    delete employee.passwordHash;
    delete employee.apiToken;
    
    res.json(employee);
  } catch (error) {
    console.error('Update employee error:', error);
    res.status(500).json({ error: 'Failed to update employee' });
  }
});

// Delete employee (protected - admin only)
app.delete('/api/employees/:id', authenticateToken, async (req, res) => {
  try {
    // Check if user is admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }
    
    const employeeId = parseInt(req.params.id);
    
    // Don't allow deleting yourself
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

// Error handler
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Start server
const PORT = process.env.PORT || 3000;

async function startServer() {
  try {
    await db.testConnection();
    console.log('✅ Database connected');
    
    server.listen(PORT, () => {
      console.log(`\n✅ Server running on http://localhost:${PORT}`);
      console.log(`✅ Health check: http://localhost:${PORT}/health`);
      console.log(`✅ Environment: ${process.env.NODE_ENV || 'development'}\n`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();

module.exports = { app, server };