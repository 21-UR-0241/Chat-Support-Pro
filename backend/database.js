// //backend/database.js
// const { Pool } = require('pg');
// require('dotenv').config();

// /**
//  * Multi-Store Database Module
//  * 
//  * Handles database operations for centralized multi-store chat system
//  * Supports 80+ Shopify stores with unified management
//  */

// // Create PostgreSQL connection pool
// const pool = new Pool({
//   connectionString: process.env.DATABASE_URL,
//   ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
//   max: 50, // Increased for 80+ stores
//   idleTimeoutMillis: 30000,
//   connectionTimeoutMillis: 2000,
// });

// // Pool error handling
// pool.on('error', (err) => {
//   console.error('Unexpected database pool error:', err);
// });

// /**
//  * Initialize all database tables for multi-store system
//  */
// async function initDatabase() {
//   const client = await pool.connect();
  
//   try {
//     console.log('Initializing multi-store database...');
    
//     // ============================================
//     // STORES TABLE
//     // ============================================
//     await client.query(`
//       CREATE TABLE IF NOT EXISTS stores (
//         id SERIAL PRIMARY KEY,
//         store_identifier VARCHAR(100) UNIQUE NOT NULL,
//         shop_domain VARCHAR(255) UNIQUE NOT NULL,
//         brand_name VARCHAR(255) NOT NULL,
//         access_token TEXT NOT NULL,
//         api_key VARCHAR(255),
//         api_secret TEXT,
//         scope TEXT,
//         is_active BOOLEAN DEFAULT true,
//         websocket_connected BOOLEAN DEFAULT false,
//         last_webhook_at TIMESTAMP,
//         installed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
//         updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        
//         -- Store metadata
//         timezone VARCHAR(50) DEFAULT 'UTC',
//         currency VARCHAR(3) DEFAULT 'USD',
//         logo_url TEXT,
//         primary_color VARCHAR(7) DEFAULT '#667eea',
        
//         -- Business info
//         contact_email VARCHAR(255),
//         support_team VARCHAR(255),
//         store_tags TEXT[],
        
//         -- Settings
//         auto_reply_enabled BOOLEAN DEFAULT false,
//         business_hours JSONB,
//         widget_settings JSONB
//       )
//     `);
    
//     // ============================================
//     // CONVERSATIONS TABLE
//     // ============================================
//     await client.query(`
//       CREATE TABLE IF NOT EXISTS conversations (
//         id SERIAL PRIMARY KEY,
//         shop_id INTEGER REFERENCES stores(id) ON DELETE CASCADE,
//         shop_domain VARCHAR(255) NOT NULL,
        
//         -- Customer info
//         customer_email VARCHAR(255) NOT NULL,
//         customer_name VARCHAR(255),
//         customer_id VARCHAR(255),
//         customer_phone VARCHAR(50),
        
//         -- Conversation metadata
//         status VARCHAR(50) DEFAULT 'open',
//         priority VARCHAR(20) DEFAULT 'normal',
//         assigned_to VARCHAR(255),
//         tags TEXT[],
        
//         -- Tracking
//         first_message_at TIMESTAMP,
//         last_message_at TIMESTAMP,
//         last_customer_message_at TIMESTAMP,
//         last_agent_message_at TIMESTAMP,
//         response_time_seconds INTEGER,
        
//         -- Counts
//         customer_message_count INTEGER DEFAULT 0,
//         agent_message_count INTEGER DEFAULT 0,
//         total_message_count INTEGER DEFAULT 0,
        
//         created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
//         updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
//         closed_at TIMESTAMP
//       )
//     `);
    
//     // ============================================
//     // MESSAGES TABLE
//     // ============================================
//     await client.query(`
//       CREATE TABLE IF NOT EXISTS messages (
//         id SERIAL PRIMARY KEY,
//         conversation_id INTEGER REFERENCES conversations(id) ON DELETE CASCADE,
//         shop_id INTEGER REFERENCES stores(id) ON DELETE CASCADE,
        
//         -- Message content
//         sender_type VARCHAR(50) NOT NULL,
//         sender_name VARCHAR(255),
//         sender_id VARCHAR(255),
//         content TEXT NOT NULL,
        
//         -- Message metadata
//         message_type VARCHAR(50) DEFAULT 'text',
//         attachment_url TEXT,
//         attachment_type VARCHAR(50),
        
//         -- Delivery tracking
//         sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
//         delivered_at TIMESTAMP,
//         read_at TIMESTAMP,
//         failed BOOLEAN DEFAULT false,
//         retry_count INTEGER DEFAULT 0,
        
//         -- Routing
//         routed_successfully BOOLEAN DEFAULT true,
//         routing_error TEXT,
        
//         timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
//       )
//     `);
    
//     // ============================================
//     // EMPLOYEES/AGENTS TABLE
//     // ============================================
//     await client.query(`
//       CREATE TABLE IF NOT EXISTS employees (
//         id SERIAL PRIMARY KEY,
//         email VARCHAR(255) UNIQUE NOT NULL,
//         name VARCHAR(255) NOT NULL,
//         role VARCHAR(50) DEFAULT 'agent',
        
//         -- Authentication
//         password_hash TEXT NOT NULL,
//         api_token TEXT UNIQUE,
//         last_login TIMESTAMP,
        
//         -- Permissions
//         can_view_all_stores BOOLEAN DEFAULT true,
//         assigned_stores INTEGER[],
        
//         -- Status
//         is_active BOOLEAN DEFAULT true,
//         is_online BOOLEAN DEFAULT false,
//         current_status VARCHAR(50) DEFAULT 'offline',
        
//         -- Stats
//         total_conversations_handled INTEGER DEFAULT 0,
//         average_response_time_seconds INTEGER DEFAULT 0,
//         customer_satisfaction_score DECIMAL(3,2),
        
//         created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
//         updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
//       )
//     `);
    
//     // ============================================
//     // AGENT ACTIVITY LOG
//     // ============================================
//     await client.query(`
//       CREATE TABLE IF NOT EXISTS agent_activity (
//         id SERIAL PRIMARY KEY,
//         employee_id INTEGER REFERENCES employees(id) ON DELETE CASCADE,
//         conversation_id INTEGER REFERENCES conversations(id) ON DELETE CASCADE,
//         shop_id INTEGER REFERENCES stores(id) ON DELETE CASCADE,
        
//         action VARCHAR(100) NOT NULL,
//         action_data JSONB,
        
//         created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
//       )
//     `);
    
//     // ============================================
//     // WEBHOOK LOGS
//     // ============================================
//     await client.query(`
//       CREATE TABLE IF NOT EXISTS webhook_logs (
//         id SERIAL PRIMARY KEY,
//         shop_id INTEGER REFERENCES stores(id) ON DELETE CASCADE,
        
//         topic VARCHAR(255) NOT NULL,
//         payload JSONB,
//         headers JSONB,
        
//         processed BOOLEAN DEFAULT false,
//         processing_error TEXT,
        
//         received_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
//         processed_at TIMESTAMP
//       )
//     `);
    
//     // ============================================
//     // CANNED RESPONSES
//     // ============================================
//     await client.query(`
//       CREATE TABLE IF NOT EXISTS canned_responses (
//         id SERIAL PRIMARY KEY,
//         shop_id INTEGER REFERENCES stores(id) ON DELETE CASCADE,
        
//         title VARCHAR(255) NOT NULL,
//         content TEXT NOT NULL,
//         shortcut VARCHAR(50),
//         category VARCHAR(100),
        
//         usage_count INTEGER DEFAULT 0,
        
//         created_by INTEGER REFERENCES employees(id),
//         created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
//         updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
//       )
//     `);
    
//     // ============================================
//     // ANALYTICS TABLE
//     // ============================================
//     await client.query(`
//       CREATE TABLE IF NOT EXISTS analytics_daily (
//         id SERIAL PRIMARY KEY,
//         shop_id INTEGER REFERENCES stores(id) ON DELETE CASCADE,
//         date DATE NOT NULL,
        
//         -- Conversation metrics
//         total_conversations INTEGER DEFAULT 0,
//         new_conversations INTEGER DEFAULT 0,
//         closed_conversations INTEGER DEFAULT 0,
        
//         -- Message metrics
//         total_messages INTEGER DEFAULT 0,
//         customer_messages INTEGER DEFAULT 0,
//         agent_messages INTEGER DEFAULT 0,
        
//         -- Performance metrics
//         average_response_time_seconds INTEGER,
//         average_resolution_time_seconds INTEGER,
//         first_response_time_seconds INTEGER,
        
//         -- Customer metrics
//         unique_customers INTEGER DEFAULT 0,
//         returning_customers INTEGER DEFAULT 0,
        
//         created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        
//         UNIQUE(shop_id, date)
//       )
//     `);
    
//     // ============================================
//     // CREATE INDEXES
//     // ============================================
//     await client.query(`
//       -- Store indexes
//       CREATE INDEX IF NOT EXISTS idx_stores_identifier ON stores(store_identifier);
//       CREATE INDEX IF NOT EXISTS idx_stores_domain ON stores(shop_domain);
//       CREATE INDEX IF NOT EXISTS idx_stores_active ON stores(is_active) WHERE is_active = true;
      
//       -- Conversation indexes
//       CREATE INDEX IF NOT EXISTS idx_conversations_shop ON conversations(shop_id);
//       CREATE INDEX IF NOT EXISTS idx_conversations_domain ON conversations(shop_domain);
//       CREATE INDEX IF NOT EXISTS idx_conversations_status ON conversations(status);
//       CREATE INDEX IF NOT EXISTS idx_conversations_customer_email ON conversations(customer_email);
//       CREATE INDEX IF NOT EXISTS idx_conversations_assigned ON conversations(assigned_to);
//       CREATE INDEX IF NOT EXISTS idx_conversations_updated ON conversations(updated_at DESC);
//       CREATE INDEX IF NOT EXISTS idx_conversations_priority ON conversations(priority);
      
//       -- Message indexes
//       CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id);
//       CREATE INDEX IF NOT EXISTS idx_messages_shop ON messages(shop_id);
//       CREATE INDEX IF NOT EXISTS idx_messages_timestamp ON messages(timestamp DESC);
//       CREATE INDEX IF NOT EXISTS idx_messages_sender_type ON messages(sender_type);
      
//       -- Employee indexes
//       CREATE INDEX IF NOT EXISTS idx_employees_email ON employees(email);
//       CREATE INDEX IF NOT EXISTS idx_employees_api_token ON employees(api_token);
//       CREATE INDEX IF NOT EXISTS idx_employees_active ON employees(is_active) WHERE is_active = true;
      
//       -- Activity log indexes
//       CREATE INDEX IF NOT EXISTS idx_activity_employee ON agent_activity(employee_id);
//       CREATE INDEX IF NOT EXISTS idx_activity_conversation ON agent_activity(conversation_id);
//       CREATE INDEX IF NOT EXISTS idx_activity_created ON agent_activity(created_at DESC);
      
//       -- Webhook log indexes
//       CREATE INDEX IF NOT EXISTS idx_webhook_shop ON webhook_logs(shop_id);
//       CREATE INDEX IF NOT EXISTS idx_webhook_received ON webhook_logs(received_at DESC);
//       CREATE INDEX IF NOT EXISTS idx_webhook_processed ON webhook_logs(processed);
      
//       -- Analytics indexes
//       CREATE INDEX IF NOT EXISTS idx_analytics_shop_date ON analytics_daily(shop_id, date);
//     `);
    
//     console.log('✅ Multi-store database tables created successfully');
//   } catch (error) {
//     console.error('❌ Error initializing database:', error);
//     throw error;
//   } finally {
//     client.release();
//   }
// }

// // ============================================
// // STORE FUNCTIONS
// // ============================================

// /**
//  * Register a new store
//  */
// async function registerStore(storeData) {
//   const {
//     store_identifier,
//     shop_domain,
//     brand_name,
//     access_token,
//     api_key,
//     api_secret,
//     scope,
//     timezone = 'UTC',
//     currency = 'USD',
//     logo_url,
//     primary_color = '#667eea',
//     contact_email,
//     store_tags = []
//   } = storeData;
  
//   try {
//     const result = await pool.query(`
//       INSERT INTO stores (
//         store_identifier, shop_domain, brand_name, access_token, api_key, 
//         api_secret, scope, timezone, currency, logo_url, primary_color, 
//         contact_email, store_tags, installed_at, updated_at
//       )
//       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, NOW(), NOW())
//       ON CONFLICT (store_identifier) 
//       DO UPDATE SET 
//         shop_domain = $2,
//         brand_name = $3,
//         access_token = $4,
//         api_key = $5,
//         api_secret = $6,
//         scope = $7,
//         timezone = $8,
//         currency = $9,
//         logo_url = $10,
//         primary_color = $11,
//         contact_email = $12,
//         store_tags = $13,
//         updated_at = NOW()
//       RETURNING *
//     `, [
//       store_identifier, shop_domain, brand_name, access_token, api_key,
//       api_secret, scope, timezone, currency, logo_url, primary_color,
//       contact_email, store_tags
//     ]);
    
//     return result.rows[0];
//   } catch (error) {
//     console.error('Error registering store:', error);
//     throw error;
//   }
// }

// /**
//  * Get store by identifier
//  */
// async function getStoreByIdentifier(identifier) {
//   try {
//     const result = await pool.query(
//       'SELECT * FROM stores WHERE store_identifier = $1 AND is_active = true',
//       [identifier]
//     );
//     return result.rows[0] || null;
//   } catch (error) {
//     console.error('Error fetching store:', error);
//     throw error;
//   }
// }

// /**
//  * Get store by domain
//  */
// async function getStoreByDomain(domain) {
//   try {
//     const result = await pool.query(
//       'SELECT * FROM stores WHERE shop_domain = $1 AND is_active = true',
//       [domain]
//     );
//     return result.rows[0] || null;
//   } catch (error) {
//     console.error('Error fetching store:', error);
//     throw error;
//   }
// }

// /**
//  * Get store by ID
//  */
// async function getStoreById(id) {
//   try {
//     const result = await pool.query(
//       'SELECT * FROM stores WHERE id = $1 AND is_active = true',
//       [id]
//     );
//     return result.rows[0] || null;
//   } catch (error) {
//     console.error('Error fetching store:', error);
//     throw error;
//   }
// }

// /**
//  * Get all active stores
//  */
// async function getAllActiveStores() {
//   try {
//     const result = await pool.query(
//       'SELECT * FROM stores WHERE is_active = true ORDER BY brand_name ASC'
//     );
//     return result.rows;
//   } catch (error) {
//     console.error('Error fetching stores:', error);
//     throw error;
//   }
// }

// /**
//  * Update store WebSocket connection status
//  */
// async function updateStoreConnectionStatus(identifier, isConnected) {
//   try {
//     await pool.query(
//       'UPDATE stores SET websocket_connected = $1, updated_at = NOW() WHERE store_identifier = $2',
//       [isConnected, identifier]
//     );
//   } catch (error) {
//     console.error('Error updating connection status:', error);
//   }
// }

// /**
//  * Update store settings
//  */
// async function updateStoreSettings(storeId, settings) {
//   try {
//     const fields = [];
//     const values = [];
//     let paramCount = 1;
    
//     Object.entries(settings).forEach(([key, value]) => {
//       fields.push(`${key} = $${paramCount}`);
//       values.push(value);
//       paramCount++;
//     });
    
//     fields.push(`updated_at = NOW()`);
//     values.push(storeId);
    
//     const query = `
//       UPDATE stores 
//       SET ${fields.join(', ')} 
//       WHERE id = $${paramCount}
//       RETURNING *
//     `;
    
//     const result = await pool.query(query, values);
//     return result.rows[0];
//   } catch (error) {
//     console.error('Error updating store settings:', error);
//     throw error;
//   }
// }

// // ============================================
// // CONVERSATION FUNCTIONS
// // ============================================

// /**
//  * Save a new conversation
//  */
// async function saveConversation(data) {
//   const {
//     store_id,
//     store_identifier,
//     customer_email,
//     customer_name,
//     customer_id,
//     customer_phone,
//     status = 'open',
//     priority = 'normal',
//     tags = []
//   } = data;
  
//   try {
//     const result = await pool.query(`
//       INSERT INTO conversations (
//         shop_id, shop_domain, customer_email, customer_name, customer_id,
//         customer_phone, status, priority, tags, created_at, updated_at
//       )
//       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())
//       RETURNING *
//     `, [
//       store_id, store_identifier, customer_email, customer_name, customer_id,
//       customer_phone, status, priority, tags
//     ]);
    
//     return result.rows[0];
//   } catch (error) {
//     console.error('Error saving conversation:', error);
//     throw error;
//   }
// }

// /**
//  * Get a single conversation by ID
//  */
// async function getConversation(conversationId, storeId = null) {
//   try {
//     let query = 'SELECT c.*, s.brand_name, s.logo_url FROM conversations c JOIN stores s ON c.shop_id = s.id WHERE c.id = $1';
//     const params = [conversationId];
    
//     if (storeId) {
//       query += ' AND c.shop_id = $2';
//       params.push(storeId);
//     }
    
//     const result = await pool.query(query, params);
//     return result.rows[0] || null;
//   } catch (error) {
//     console.error('Error fetching conversation:', error);
//     throw error;
//   }
// }

// /**
//  * Get conversations with filters (multi-store aware)
//  */
// async function getConversations(filters = {}) {
//   try {
//     let query = `
//       SELECT c.*, s.brand_name, s.logo_url, s.primary_color, s.store_identifier
//       FROM conversations c 
//       JOIN stores s ON c.shop_id = s.id 
//       WHERE 1=1
//     `;
//     const params = [];
//     let paramCount = 1;
    
//     // Filter by store
//     if (filters.storeId) {
//       query += ` AND c.shop_id = $${paramCount}`;
//       params.push(filters.storeId);
//       paramCount++;
//     }
    
//     if (filters.storeIdentifier) {
//       query += ` AND c.shop_domain = $${paramCount}`;
//       params.push(filters.storeIdentifier);
//       paramCount++;
//     }
    
//     // Filter by customer email
//     if (filters.customerEmail) {
//       query += ` AND c.customer_email = $${paramCount}`;
//       params.push(filters.customerEmail);
//       paramCount++;
//     }
    
//     // Filter by status
//     if (filters.status) {
//       query += ` AND c.status = $${paramCount}`;
//       params.push(filters.status);
//       paramCount++;
//     }
    
//     // Filter by priority
//     if (filters.priority) {
//       query += ` AND c.priority = $${paramCount}`;
//       params.push(filters.priority);
//       paramCount++;
//     }
    
//     // Filter by assigned agent
//     if (filters.assignedTo) {
//       query += ` AND c.assigned_to = $${paramCount}`;
//       params.push(filters.assignedTo);
//       paramCount++;
//     }
    
//     // Search by customer
//     if (filters.search) {
//       query += ` AND (c.customer_email ILIKE $${paramCount} OR c.customer_name ILIKE $${paramCount})`;
//       params.push(`%${filters.search}%`);
//       paramCount++;
//     }
    
//     // Pagination
//     const limit = filters.limit || 50;
//     const offset = filters.offset || 0;
    
//     query += ` ORDER BY c.updated_at DESC LIMIT $${paramCount} OFFSET $${paramCount + 1}`;
//     params.push(limit, offset);
    
//     const result = await pool.query(query, params);
//     return result.rows;
//   } catch (error) {
//     console.error('Error fetching conversations:', error);
//     throw error;
//   }
// }

// /**
//  * Get conversation count
//  */
// async function getConversationCount(filters = {}) {
//   try {
//     let query = 'SELECT COUNT(*) FROM conversations WHERE 1=1';
//     const params = [];
//     let paramCount = 1;
    
//     if (filters.storeId) {
//       query += ` AND shop_id = $${paramCount}`;
//       params.push(filters.storeId);
//       paramCount++;
//     }
    
//     if (filters.status) {
//       query += ` AND status = $${paramCount}`;
//       params.push(filters.status);
//       paramCount++;
//     }
    
//     const result = await pool.query(query, params);
//     return parseInt(result.rows[0].count);
//   } catch (error) {
//     console.error('Error counting conversations:', error);
//     throw error;
//   }
// }

// /**
//  * Update conversation
//  */
// async function updateConversation(conversationId, updates) {
//   try {
//     const fields = [];
//     const values = [];
//     let paramCount = 1;
    
//     Object.entries(updates).forEach(([key, value]) => {
//       fields.push(`${key} = $${paramCount}`);
//       values.push(value);
//       paramCount++;
//     });
    
//     fields.push(`updated_at = NOW()`);
//     values.push(conversationId);
    
//     const query = `
//       UPDATE conversations 
//       SET ${fields.join(', ')} 
//       WHERE id = $${paramCount}
//       RETURNING *
//     `;
    
//     const result = await pool.query(query, values);
//     return result.rows[0];
//   } catch (error) {
//     console.error('Error updating conversation:', error);
//     throw error;
//   }
// }

// /**
//  * Close conversation
//  */
// async function closeConversation(conversationId) {
//   try {
//     const result = await pool.query(`
//       UPDATE conversations 
//       SET status = 'closed', closed_at = NOW(), updated_at = NOW() 
//       WHERE id = $1
//       RETURNING *
//     `, [conversationId]);
    
//     return result.rows[0];
//   } catch (error) {
//     console.error('Error closing conversation:', error);
//     throw error;
//   }
// }

// /**
//  * Assign conversation to agent
//  */
// async function assignConversation(conversationId, employeeEmail) {
//   try {
//     const result = await pool.query(`
//       UPDATE conversations 
//       SET assigned_to = $1, updated_at = NOW() 
//       WHERE id = $2
//       RETURNING *
//     `, [employeeEmail, conversationId]);
    
//     return result.rows[0];
//   } catch (error) {
//     console.error('Error assigning conversation:', error);
//     throw error;
//   }
// }

// // ============================================
// // MESSAGE FUNCTIONS
// // ============================================

// /**
//  * Save a new message
//  */
// async function saveMessage(data) {
//   const {
//     conversation_id,
//     store_id,
//     sender_type,
//     sender_name,
//     sender_id,
//     content,
//     message_type = 'text',
//     attachment_url,
//     attachment_type
//   } = data;
  
//   const client = await pool.connect();
  
//   try {
//     await client.query('BEGIN');
    
//     // Insert message
//     const messageResult = await client.query(`
//       INSERT INTO messages (
//         conversation_id, shop_id, sender_type, sender_name, sender_id,
//         content, message_type, attachment_url, attachment_type, 
//         sent_at, timestamp
//       )
//       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())
//       RETURNING *
//     `, [
//       conversation_id, store_id, sender_type, sender_name, sender_id,
//       content, message_type, attachment_url, attachment_type
//     ]);
    
//     const message = messageResult.rows[0];
    
//     // Update conversation counters and timestamps
//     const updateFields = [
//       'total_message_count = total_message_count + 1',
//       'last_message_at = NOW()',
//       'updated_at = NOW()'
//     ];
    
//     if (sender_type === 'customer') {
//       updateFields.push('customer_message_count = customer_message_count + 1');
//       updateFields.push('last_customer_message_at = NOW()');
//     } else if (sender_type === 'agent') {
//       updateFields.push('agent_message_count = agent_message_count + 1');
//       updateFields.push('last_agent_message_at = NOW()');
      
//       // Calculate response time if this is first agent message
//       updateFields.push(`
//         response_time_seconds = CASE 
//           WHEN last_agent_message_at IS NULL AND first_message_at IS NOT NULL
//           THEN EXTRACT(EPOCH FROM (NOW() - first_message_at))::INTEGER
//           ELSE response_time_seconds
//         END
//       `);
//     }
    
//     // Set first_message_at if not set
//     updateFields.push(`
//       first_message_at = COALESCE(first_message_at, NOW())
//     `);
    
//     await client.query(`
//       UPDATE conversations 
//       SET ${updateFields.join(', ')}
//       WHERE id = $1
//     `, [conversation_id]);
    
//     await client.query('COMMIT');
    
//     return message;
//   } catch (error) {
//     await client.query('ROLLBACK');
//     console.error('Error saving message:', error);
//     throw error;
//   } finally {
//     client.release();
//   }
// }

// /**
//  * Get messages for a conversation
//  */
// async function getMessages(conversationId, limit = 100) {
//   try {
//     const result = await pool.query(
//       'SELECT * FROM messages WHERE conversation_id = $1 ORDER BY timestamp ASC LIMIT $2',
//       [conversationId, limit]
//     );
    
//     return result.rows;
//   } catch (error) {
//     console.error('Error fetching messages:', error);
//     throw error;
//   }
// }

// /**
//  * Mark message as delivered
//  */
// async function markMessageDelivered(messageId) {
//   try {
//     await pool.query(
//       'UPDATE messages SET delivered_at = NOW() WHERE id = $1',
//       [messageId]
//     );
//   } catch (error) {
//     console.error('Error marking message delivered:', error);
//   }
// }

// /**
//  * Mark message as read
//  */
// async function markMessageRead(messageId) {
//   try {
//     await pool.query(
//       'UPDATE messages SET read_at = NOW() WHERE id = $1',
//       [messageId]
//     );
//   } catch (error) {
//     console.error('Error marking message read:', error);
//   }
// }

// /**
//  * Mark message as failed
//  */
// async function markMessageFailed(messageId, error) {
//   try {
//     await pool.query(
//       'UPDATE messages SET failed = true, routing_error = $1, retry_count = retry_count + 1 WHERE id = $2',
//       [error, messageId]
//     );
//   } catch (err) {
//     console.error('Error marking message failed:', err);
//   }
// }

// // ============================================
// // EMPLOYEE FUNCTIONS
// // ============================================

// /**
//  * Create employee/agent
//  */
// async function createEmployee(data) {
//   const {
//     email,
//     name,
//     password_hash,
//     role = 'agent',
//     can_view_all_stores = true,
//     assigned_stores = []
//   } = data;
  
//   try {
//     // Validate required fields
//     if (!email || !name) {
//       throw new Error('Email and name are required');
//     }
    
//     if (!password_hash) {
//       throw new Error('password_hash is required. Password must be hashed before calling createEmployee');
//     }
    
//     const result = await pool.query(`
//       INSERT INTO employees (
//         email, name, password_hash, role, can_view_all_stores, 
//         assigned_stores, created_at, updated_at
//       )
//       VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
//       RETURNING *
//     `, [email, name, password_hash, role, can_view_all_stores, assigned_stores]);
    
//     return result.rows[0];
//   } catch (error) {
//     console.error('Error creating employee:', error);
//     throw error;
//   }
// }

// /**
//  * Get employee by email
//  */
// async function getEmployeeByEmail(email) {
//   try {
//     const result = await pool.query(
//       'SELECT * FROM employees WHERE email = $1 AND is_active = true',
//       [email]
//     );
//     return result.rows[0] || null;
//   } catch (error) {
//     console.error('Error fetching employee:', error);
//     throw error;
//   }
// }

// /**
//  * Get employee by ID
//  */
// async function getEmployeeById(id) {
//   try {
//     const result = await pool.query(
//       'SELECT * FROM employees WHERE id = $1 AND is_active = true',
//       [id]
//     );
//     return result.rows[0] || null;
//   } catch (error) {
//     console.error('Error fetching employee:', error);
//     throw error;
//   }
// }

// /**
//  * Get all employees (for admin management)
//  */
// async function getAllEmployees() {
//   try {
//     const result = await pool.query(
//       'SELECT * FROM employees ORDER BY created_at DESC'
//     );
//     return result.rows;
//   } catch (error) {
//     console.error('Error fetching all employees:', error);
//     throw error;
//   }
// }

// /**
//  * Update employee
//  */
// async function updateEmployee(employeeId, updates) {
//   try {
//     const fields = [];
//     const values = [];
//     let paramCount = 1;
    
//     // Only allow certain fields to be updated
//     const allowedFields = ['name', 'email', 'role', 'password_hash', 'is_active', 
//                           'can_view_all_stores', 'assigned_stores', 'last_login', 'is_online'];
    
//     Object.entries(updates).forEach(([key, value]) => {
//       if (allowedFields.includes(key)) {
//         fields.push(`${key} = $${paramCount}`);
//         values.push(value);
//         paramCount++;
//       }
//     });
    
//     if (fields.length === 0) {
//       throw new Error('No valid fields to update');
//     }
    
//     fields.push(`updated_at = NOW()`);
//     values.push(employeeId);
    
//     const query = `
//       UPDATE employees 
//       SET ${fields.join(', ')} 
//       WHERE id = $${paramCount}
//       RETURNING *
//     `;
    
//     const result = await pool.query(query, values);
//     return result.rows[0];
//   } catch (error) {
//     console.error('Error updating employee:', error);
//     throw error;
//   }
// }

// /**
//  * Delete employee (soft delete - mark as inactive)
//  */
// async function deleteEmployee(employeeId) {
//   try {
//     const result = await pool.query(
//       'UPDATE employees SET is_active = false, updated_at = NOW() WHERE id = $1 RETURNING *',
//       [employeeId]
//     );
//     return result.rows[0];
//   } catch (error) {
//     console.error('Error deleting employee:', error);
//     throw error;
//   }
// }

// /**
//  * Update employee status
//  */
// async function updateEmployeeStatus(employeeId, status) {
//   try {
//     // Handle both object and direct status updates
//     if (typeof status === 'object') {
//       // New format: { last_login: Date, is_online: boolean }
//       const updates = {};
//       if (status.last_login) updates.last_login = status.last_login;
//       if (status.is_online !== undefined) updates.is_online = status.is_online;
//       if (status.current_status) updates.current_status = status.current_status;
      
//       return await updateEmployee(employeeId, updates);
//     } else {
//       // Old format: just a status string
//       await pool.query(
//         'UPDATE employees SET current_status = $1, is_online = $2, updated_at = NOW() WHERE id = $3',
//         [status, status === 'online', employeeId]
//       );
//     }
//   } catch (error) {
//     console.error('Error updating employee status:', error);
//   }
// }

// /**
//  * Log agent activity
//  */
// async function logAgentActivity(data) {
//   const { employee_id, conversation_id, store_id, action, action_data } = data;
  
//   try {
//     await pool.query(`
//       INSERT INTO agent_activity (
//         employee_id, conversation_id, shop_id, action, action_data, created_at
//       )
//       VALUES ($1, $2, $3, $4, $5, NOW())
//     `, [employee_id, conversation_id, store_id, action, action_data]);
//   } catch (error) {
//     console.error('Error logging agent activity:', error);
//   }
// }

// // ============================================
// // WEBHOOK FUNCTIONS
// // ============================================

// /**
//  * Log webhook
//  */
// async function logWebhook(data) {
//   const { store_id, topic, payload, headers } = data;
  
//   try {
//     await pool.query(`
//       INSERT INTO webhook_logs (shop_id, topic, payload, headers, received_at)
//       VALUES ($1, $2, $3, $4, NOW())
//     `, [store_id, topic, payload, headers]);
//   } catch (error) {
//     console.error('Error logging webhook:', error);
//   }
// }

// // ============================================
// // CANNED RESPONSES
// // ============================================

// /**
//  * Get canned responses for store
//  */
// async function getCannedResponses(storeId) {
//   try {
//     const result = await pool.query(
//       'SELECT * FROM canned_responses WHERE shop_id = $1 ORDER BY category, title',
//       [storeId]
//     );
//     return result.rows;
//   } catch (error) {
//     console.error('Error fetching canned responses:', error);
//     throw error;
//   }
// }

// /**
//  * Create canned response
//  */
// async function createCannedResponse(data) {
//   const { store_id, title, content, shortcut, category, created_by } = data;
  
//   try {
//     const result = await pool.query(`
//       INSERT INTO canned_responses (
//         shop_id, title, content, shortcut, category, created_by, created_at, updated_at
//       )
//       VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
//       RETURNING *
//     `, [store_id, title, content, shortcut, category, created_by]);
    
//     return result.rows[0];
//   } catch (error) {
//     console.error('Error creating canned response:', error);
//     throw error;
//   }
// }

// // ============================================
// // ANALYTICS FUNCTIONS
// // ============================================

// /**
//  * Get dashboard stats
//  */
// async function getDashboardStats(filters = {}) {
//   try {
//     let storeFilter = '';
//     const params = [];
    
//     if (filters.storeId) {
//       storeFilter = 'AND c.shop_id = $1';
//       params.push(filters.storeId);
//     }
    
//     const result = await pool.query(`
//       SELECT 
//         COUNT(DISTINCT c.id) as total_conversations,
//         COUNT(DISTINCT c.id) FILTER (WHERE c.status = 'open') as open_conversations,
//         COUNT(DISTINCT c.id) FILTER (WHERE c.status = 'pending') as pending_conversations,
//         COUNT(DISTINCT c.id) FILTER (WHERE c.status = 'closed') as closed_conversations,
//         COUNT(DISTINCT c.shop_id) as active_stores,
//         COUNT(DISTINCT m.id) FILTER (WHERE DATE(m.timestamp) = CURRENT_DATE) as messages_today,
//         AVG(c.response_time_seconds) FILTER (WHERE c.response_time_seconds IS NOT NULL) as avg_response_time,
//         COUNT(DISTINCT c.customer_email) as unique_customers
//       FROM conversations c
//       LEFT JOIN messages m ON m.conversation_id = c.id
//       WHERE 1=1 ${storeFilter}
//     `, params);
    
//     return result.rows[0];
//   } catch (error) {
//     console.error('Error fetching dashboard stats:', error);
//     throw error;
//   }
// }

// /**
//  * Get store performance metrics
//  */
// async function getStoreMetrics(storeId, days = 30) {
//   try {
//     const result = await pool.query(`
//       SELECT 
//         date,
//         total_conversations,
//         new_conversations,
//         closed_conversations,
//         total_messages,
//         average_response_time_seconds
//       FROM analytics_daily
//       WHERE shop_id = $1 
//         AND date >= CURRENT_DATE - INTERVAL '${days} days'
//       ORDER BY date DESC
//     `, [storeId]);
    
//     return result.rows;
//   } catch (error) {
//     console.error('Error fetching store metrics:', error);
//     throw error;
//   }
// }

// // ============================================
// // UTILITY FUNCTIONS
// // ============================================

// /**
//  * Test database connection
//  */
// async function testConnection() {
//   try {
//     const result = await pool.query('SELECT NOW()');
//     console.log('✅ Database connection successful:', result.rows[0].now);
//     return true;
//   } catch (error) {
//     console.error('❌ Database connection failed:', error);
//     return false;
//   }
// }

// /**
//  * Close database pool
//  */
// async function closePool() {
//   await pool.end();
// }

// // ============================================
// // EXPORTS
// // ============================================

// module.exports = {
//   pool,
  
//   // Database management
//   initDatabase,
//   testConnection,
//   closePool,
  
//   // Store functions
//   registerStore,
//   getStoreByIdentifier,
//   getStoreByDomain,
//   getStoreById,
//   getAllActiveStores,
//   updateStoreConnectionStatus,
//   updateStoreSettings,
  
//   // Conversation functions
//   saveConversation,
//   getConversation,
//   getConversations,
//   getConversationCount,
//   updateConversation,
//   closeConversation,
//   assignConversation,
  
//   // Message functions
//   saveMessage,
//   getMessages,
//   markMessageDelivered,
//   markMessageRead,
//   markMessageFailed,
  
//   // Employee functions
//   createEmployee,
//   getEmployeeByEmail,
//   getEmployeeById,
//   getAllEmployees,
//   updateEmployee,
//   deleteEmployee,
//   updateEmployeeStatus,
//   logAgentActivity,
  
//   // Webhook functions
//   logWebhook,
  
//   // Canned responses
//   getCannedResponses,
//   createCannedResponse,
  
//   // Analytics
//   getDashboardStats,
//   getStoreMetrics,
// };


//backend/database.js
const { Pool } = require('pg');
require('dotenv').config();

/**
 * Multi-Store Database Module
 * 
 * Handles database operations for centralized multi-store chat system
 * Supports 80+ Shopify stores with unified management
 */

// Create PostgreSQL connection pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  max: 50, // Increased for 80+ stores
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// Pool error handling
pool.on('error', (err) => {
  console.error('Unexpected database pool error:', err);
});

// ============================================
// DATABASE INITIALIZATION (Fresh Installs Only)
// ============================================

/**
 * Initialize all database tables for multi-store system
 * NOTE: This only runs if tables don't exist. Use runMigrations() for schema updates.
 */
async function initDatabase() {
  const client = await pool.connect();
  
  try {
    console.log('🔄 Checking database initialization...');
    
    // Check if tables already exist
    const tablesCheck = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN ('stores', 'conversations', 'messages', 'employees')
    `);
    
    if (tablesCheck.rows.length > 0) {
      console.log('✅ Database tables already exist, skipping initialization');
      return;
    }
    
    console.log('📝 Creating database tables...');
    
    // ============================================
    // STORES TABLE
    // ============================================
    await client.query(`
      CREATE TABLE IF NOT EXISTS stores (
        id SERIAL PRIMARY KEY,
        store_identifier VARCHAR(100) UNIQUE NOT NULL,
        shop_domain VARCHAR(255) UNIQUE NOT NULL,
        brand_name VARCHAR(255) NOT NULL,
        access_token TEXT NOT NULL,
        api_key VARCHAR(255),
        api_secret TEXT,
        scope TEXT,
        is_active BOOLEAN DEFAULT true,
        websocket_connected BOOLEAN DEFAULT false,
        last_webhook_at TIMESTAMP,
        installed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        
        -- Store metadata
        timezone VARCHAR(50) DEFAULT 'UTC',
        currency VARCHAR(3) DEFAULT 'USD',
        logo_url TEXT,
        primary_color VARCHAR(7) DEFAULT '#667eea',
        
        -- Business info
        contact_email VARCHAR(255),
        support_team VARCHAR(255),
        store_tags TEXT[],
        
        -- Settings
        auto_reply_enabled BOOLEAN DEFAULT false,
        business_hours JSONB,
        widget_settings JSONB
      )
    `);
    
    // ============================================
    // CONVERSATIONS TABLE
    // ============================================
    await client.query(`
      CREATE TABLE IF NOT EXISTS conversations (
        id SERIAL PRIMARY KEY,
        shop_id INTEGER REFERENCES stores(id) ON DELETE CASCADE,
        shop_domain VARCHAR(255) NOT NULL,
        
        -- Customer info
        customer_email VARCHAR(255) NOT NULL,
        customer_name VARCHAR(255),
        customer_id VARCHAR(255),
        customer_phone VARCHAR(50),
        
        -- Conversation metadata
        status VARCHAR(50) DEFAULT 'open',
        priority VARCHAR(20) DEFAULT 'normal',
        assigned_to VARCHAR(255),
        tags TEXT[],
        
        -- Tracking
        first_message_at TIMESTAMP,
        last_message_at TIMESTAMP,
        last_customer_message_at TIMESTAMP,
        last_agent_message_at TIMESTAMP,
        response_time_seconds INTEGER,
        
        -- Counts
        customer_message_count INTEGER DEFAULT 0,
        agent_message_count INTEGER DEFAULT 0,
        total_message_count INTEGER DEFAULT 0,
        
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        closed_at TIMESTAMP
      )
    `);
    
    // ============================================
    // MESSAGES TABLE
    // ============================================
    await client.query(`
      CREATE TABLE IF NOT EXISTS messages (
        id SERIAL PRIMARY KEY,
        conversation_id INTEGER REFERENCES conversations(id) ON DELETE CASCADE,
        shop_id INTEGER REFERENCES stores(id) ON DELETE CASCADE,
        
        -- Message content
        sender_type VARCHAR(50) NOT NULL,
        sender_name VARCHAR(255),
        sender_id VARCHAR(255),
        content TEXT NOT NULL,
        
        -- Message metadata
        message_type VARCHAR(50) DEFAULT 'text',
        attachment_url TEXT,
        attachment_type VARCHAR(50),
        
        -- Delivery tracking
        sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        delivered_at TIMESTAMP,
        read_at TIMESTAMP,
        failed BOOLEAN DEFAULT false,
        retry_count INTEGER DEFAULT 0,
        
        -- Routing
        routed_successfully BOOLEAN DEFAULT true,
        routing_error TEXT,
        
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    // ============================================
    // EMPLOYEES/AGENTS TABLE
    // ============================================
    await client.query(`
      CREATE TABLE IF NOT EXISTS employees (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        name VARCHAR(255) NOT NULL,
        role VARCHAR(50) DEFAULT 'agent',
        
        -- Authentication
        password_hash TEXT NOT NULL,
        api_token TEXT UNIQUE,
        last_login TIMESTAMP,
        
        -- Permissions
        can_view_all_stores BOOLEAN DEFAULT true,
        assigned_stores INTEGER[],
        
        -- Status
        is_active BOOLEAN DEFAULT true,
        is_online BOOLEAN DEFAULT false,
        current_status VARCHAR(50) DEFAULT 'offline',
        
        -- Stats
        total_conversations_handled INTEGER DEFAULT 0,
        average_response_time_seconds INTEGER DEFAULT 0,
        customer_satisfaction_score DECIMAL(3,2),
        
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    // ============================================
    // AGENT ACTIVITY LOG
    // ============================================
    await client.query(`
      CREATE TABLE IF NOT EXISTS agent_activity (
        id SERIAL PRIMARY KEY,
        employee_id INTEGER REFERENCES employees(id) ON DELETE CASCADE,
        conversation_id INTEGER REFERENCES conversations(id) ON DELETE CASCADE,
        shop_id INTEGER REFERENCES stores(id) ON DELETE CASCADE,
        
        action VARCHAR(100) NOT NULL,
        action_data JSONB,
        
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    // ============================================
    // WEBHOOK LOGS
    // ============================================
    await client.query(`
      CREATE TABLE IF NOT EXISTS webhook_logs (
        id SERIAL PRIMARY KEY,
        shop_id INTEGER REFERENCES stores(id) ON DELETE CASCADE,
        
        topic VARCHAR(255) NOT NULL,
        payload JSONB,
        headers JSONB,
        
        processed BOOLEAN DEFAULT false,
        processing_error TEXT,
        
        received_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        processed_at TIMESTAMP
      )
    `);
    
    // ============================================
    // CANNED RESPONSES
    // ============================================
    await client.query(`
      CREATE TABLE IF NOT EXISTS canned_responses (
        id SERIAL PRIMARY KEY,
        shop_id INTEGER REFERENCES stores(id) ON DELETE CASCADE,
        
        title VARCHAR(255) NOT NULL,
        content TEXT NOT NULL,
        shortcut VARCHAR(50),
        category VARCHAR(100),
        
        usage_count INTEGER DEFAULT 0,
        
        created_by INTEGER REFERENCES employees(id),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    // ============================================
    // ANALYTICS TABLE
    // ============================================
    await client.query(`
      CREATE TABLE IF NOT EXISTS analytics_daily (
        id SERIAL PRIMARY KEY,
        shop_id INTEGER REFERENCES stores(id) ON DELETE CASCADE,
        date DATE NOT NULL,
        
        -- Conversation metrics
        total_conversations INTEGER DEFAULT 0,
        new_conversations INTEGER DEFAULT 0,
        closed_conversations INTEGER DEFAULT 0,
        
        -- Message metrics
        total_messages INTEGER DEFAULT 0,
        customer_messages INTEGER DEFAULT 0,
        agent_messages INTEGER DEFAULT 0,
        
        -- Performance metrics
        average_response_time_seconds INTEGER,
        average_resolution_time_seconds INTEGER,
        first_response_time_seconds INTEGER,
        
        -- Customer metrics
        unique_customers INTEGER DEFAULT 0,
        returning_customers INTEGER DEFAULT 0,
        
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        
        UNIQUE(shop_id, date)
      )
    `);
    
    // ============================================
    // CREATE INDEXES
    // ============================================
    await client.query(`
      -- Store indexes
      CREATE INDEX IF NOT EXISTS idx_stores_identifier ON stores(store_identifier);
      CREATE INDEX IF NOT EXISTS idx_stores_domain ON stores(shop_domain);
      CREATE INDEX IF NOT EXISTS idx_stores_active ON stores(is_active) WHERE is_active = true;
      
      -- Conversation indexes
      CREATE INDEX IF NOT EXISTS idx_conversations_shop ON conversations(shop_id);
      CREATE INDEX IF NOT EXISTS idx_conversations_domain ON conversations(shop_domain);
      CREATE INDEX IF NOT EXISTS idx_conversations_status ON conversations(status);
      CREATE INDEX IF NOT EXISTS idx_conversations_customer_email ON conversations(customer_email);
      CREATE INDEX IF NOT EXISTS idx_conversations_assigned ON conversations(assigned_to);
      CREATE INDEX IF NOT EXISTS idx_conversations_updated ON conversations(updated_at DESC);
      CREATE INDEX IF NOT EXISTS idx_conversations_priority ON conversations(priority);
      
      -- Message indexes
      CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id);
      CREATE INDEX IF NOT EXISTS idx_messages_shop ON messages(shop_id);
      CREATE INDEX IF NOT EXISTS idx_messages_timestamp ON messages(timestamp DESC);
      CREATE INDEX IF NOT EXISTS idx_messages_sender_type ON messages(sender_type);
      
      -- Employee indexes
      CREATE INDEX IF NOT EXISTS idx_employees_email ON employees(email);
      CREATE INDEX IF NOT EXISTS idx_employees_api_token ON employees(api_token);
      CREATE INDEX IF NOT EXISTS idx_employees_active ON employees(is_active) WHERE is_active = true;
      
      -- Activity log indexes
      CREATE INDEX IF NOT EXISTS idx_activity_employee ON agent_activity(employee_id);
      CREATE INDEX IF NOT EXISTS idx_activity_conversation ON agent_activity(conversation_id);
      CREATE INDEX IF NOT EXISTS idx_activity_created ON agent_activity(created_at DESC);
      
      -- Webhook log indexes
      CREATE INDEX IF NOT EXISTS idx_webhook_shop ON webhook_logs(shop_id);
      CREATE INDEX IF NOT EXISTS idx_webhook_received ON webhook_logs(received_at DESC);
      CREATE INDEX IF NOT EXISTS idx_webhook_processed ON webhook_logs(processed);
      
      -- Analytics indexes
      CREATE INDEX IF NOT EXISTS idx_analytics_shop_date ON analytics_daily(shop_id, date);
    `);
    
    console.log('✅ Database tables created successfully');
  } catch (error) {
    console.error('❌ Error initializing database:', error);
    throw error;
  } finally {
    client.release();
  }
}

// ============================================
// DATABASE MIGRATIONS SYSTEM
// ============================================

/**
 * Run all database migrations in order
 * Migrations are idempotent and can be run multiple times safely
 */
async function runMigrations() {
  console.log('🔄 Running database migrations...');
  
  try {
    // Run each migration in order
    await migration_001_add_message_columns();
    
    // Add future migrations here:
    // await migration_002_add_new_feature();
    // await migration_003_add_indexes();
    
    console.log('✅ All migrations completed successfully');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  }
}

/**
 * Migration 001: Add all missing columns to messages table
 * Adds: message_type, attachment_url, attachment_type, sent_at, 
 *       delivered_at, read_at, failed, retry_count, routed_successfully, routing_error
 */
async function migration_001_add_message_columns() {
  const client = await pool.connect();
  
  try {
    console.log('📝 [Migration 001] Checking messages table schema...');
    
    // Get current columns
    const currentColumns = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'messages'
    `);
    
    const existingColumns = currentColumns.rows.map(row => row.column_name);
    console.log('   Current columns:', existingColumns.join(', '));
    
    // Define all columns that should exist
    const requiredColumns = [
      { name: 'message_type', sql: 'VARCHAR(50) DEFAULT \'text\'' },
      { name: 'attachment_url', sql: 'TEXT' },
      { name: 'attachment_type', sql: 'VARCHAR(50)' },
      { name: 'sent_at', sql: 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP' },
      { name: 'delivered_at', sql: 'TIMESTAMP' },
      { name: 'read_at', sql: 'TIMESTAMP' },
      { name: 'failed', sql: 'BOOLEAN DEFAULT false' },
      { name: 'retry_count', sql: 'INTEGER DEFAULT 0' },
      { name: 'routed_successfully', sql: 'BOOLEAN DEFAULT true' },
      { name: 'routing_error', sql: 'TEXT' }
    ];
    
    const columnsAdded = [];
    
    // Add each missing column
    for (const column of requiredColumns) {
      if (!existingColumns.includes(column.name)) {
        console.log(`   Adding column: ${column.name}...`);
        await client.query(`
          ALTER TABLE messages 
          ADD COLUMN ${column.name} ${column.sql};
        `);
        columnsAdded.push(column.name);
      }
    }
    
    if (columnsAdded.length > 0) {
      console.log(`✅ [Migration 001] Added ${columnsAdded.length} columns: ${columnsAdded.join(', ')}`);
    } else {
      console.log('⏭️  [Migration 001] All columns already exist, skipping');
    }
  } catch (error) {
    console.error('❌ [Migration 001] Failed:', error);
    throw error;
  } finally {
    client.release();
  }
}

// ============================================
// STORE FUNCTIONS
// ============================================

/**
 * Register a new store
 */
async function registerStore(storeData) {
  const {
    store_identifier,
    shop_domain,
    brand_name,
    access_token,
    api_key,
    api_secret,
    scope,
    timezone = 'UTC',
    currency = 'USD',
    logo_url,
    primary_color = '#667eea',
    contact_email,
    store_tags = []
  } = storeData;
  
  try {
    const result = await pool.query(`
      INSERT INTO stores (
        store_identifier, shop_domain, brand_name, access_token, api_key, 
        api_secret, scope, timezone, currency, logo_url, primary_color, 
        contact_email, store_tags, installed_at, updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, NOW(), NOW())
      ON CONFLICT (store_identifier) 
      DO UPDATE SET 
        shop_domain = $2,
        brand_name = $3,
        access_token = $4,
        api_key = $5,
        api_secret = $6,
        scope = $7,
        timezone = $8,
        currency = $9,
        logo_url = $10,
        primary_color = $11,
        contact_email = $12,
        store_tags = $13,
        updated_at = NOW()
      RETURNING *
    `, [
      store_identifier, shop_domain, brand_name, access_token, api_key,
      api_secret, scope, timezone, currency, logo_url, primary_color,
      contact_email, store_tags
    ]);
    
    return result.rows[0];
  } catch (error) {
    console.error('Error registering store:', error);
    throw error;
  }
}

/**
 * Get store by identifier
 */
async function getStoreByIdentifier(identifier) {
  try {
    const result = await pool.query(
      'SELECT * FROM stores WHERE store_identifier = $1 AND is_active = true',
      [identifier]
    );
    return result.rows[0] || null;
  } catch (error) {
    console.error('Error fetching store:', error);
    throw error;
  }
}

/**
 * Get store by domain
 */
async function getStoreByDomain(domain) {
  try {
    const result = await pool.query(
      'SELECT * FROM stores WHERE shop_domain = $1 AND is_active = true',
      [domain]
    );
    return result.rows[0] || null;
  } catch (error) {
    console.error('Error fetching store:', error);
    throw error;
  }
}

/**
 * Get store by ID
 */
async function getStoreById(id) {
  try {
    const result = await pool.query(
      'SELECT * FROM stores WHERE id = $1 AND is_active = true',
      [id]
    );
    return result.rows[0] || null;
  } catch (error) {
    console.error('Error fetching store:', error);
    throw error;
  }
}

/**
 * Get all active stores
 */
async function getAllActiveStores() {
  try {
    const result = await pool.query(
      'SELECT * FROM stores WHERE is_active = true ORDER BY brand_name ASC'
    );
    return result.rows;
  } catch (error) {
    console.error('Error fetching stores:', error);
    throw error;
  }
}

/**
 * Update store WebSocket connection status
 */
async function updateStoreConnectionStatus(identifier, isConnected) {
  try {
    await pool.query(
      'UPDATE stores SET websocket_connected = $1, updated_at = NOW() WHERE store_identifier = $2',
      [isConnected, identifier]
    );
  } catch (error) {
    console.error('Error updating connection status:', error);
  }
}

/**
 * Update store settings
 */
async function updateStoreSettings(storeId, settings) {
  try {
    const fields = [];
    const values = [];
    let paramCount = 1;
    
    Object.entries(settings).forEach(([key, value]) => {
      fields.push(`${key} = $${paramCount}`);
      values.push(value);
      paramCount++;
    });
    
    fields.push(`updated_at = NOW()`);
    values.push(storeId);
    
    const query = `
      UPDATE stores 
      SET ${fields.join(', ')} 
      WHERE id = $${paramCount}
      RETURNING *
    `;
    
    const result = await pool.query(query, values);
    return result.rows[0];
  } catch (error) {
    console.error('Error updating store settings:', error);
    throw error;
  }
}

// ============================================
// CONVERSATION FUNCTIONS
// ============================================

/**
 * Save a new conversation
 */
async function saveConversation(data) {
  const {
    store_id,
    store_identifier,
    customer_email,
    customer_name,
    customer_id,
    customer_phone,
    status = 'open',
    priority = 'normal',
    tags = []
  } = data;
  
  try {
    const result = await pool.query(`
      INSERT INTO conversations (
        shop_id, shop_domain, customer_email, customer_name, customer_id,
        customer_phone, status, priority, tags, created_at, updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())
      RETURNING *
    `, [
      store_id, store_identifier, customer_email, customer_name, customer_id,
      customer_phone, status, priority, tags
    ]);
    
    return result.rows[0];
  } catch (error) {
    console.error('Error saving conversation:', error);
    throw error;
  }
}

/**
 * Get a single conversation by ID
 */
async function getConversation(conversationId, storeId = null) {
  try {
    let query = 'SELECT c.*, s.brand_name, s.logo_url FROM conversations c JOIN stores s ON c.shop_id = s.id WHERE c.id = $1';
    const params = [conversationId];
    
    if (storeId) {
      query += ' AND c.shop_id = $2';
      params.push(storeId);
    }
    
    const result = await pool.query(query, params);
    return result.rows[0] || null;
  } catch (error) {
    console.error('Error fetching conversation:', error);
    throw error;
  }
}

/**
 * Get conversations with filters (multi-store aware)
 */
async function getConversations(filters = {}) {
  try {
    let query = `
      SELECT c.*, s.brand_name, s.logo_url, s.primary_color, s.store_identifier
      FROM conversations c 
      JOIN stores s ON c.shop_id = s.id 
      WHERE 1=1
    `;
    const params = [];
    let paramCount = 1;
    
    // Filter by store
    if (filters.storeId) {
      query += ` AND c.shop_id = $${paramCount}`;
      params.push(filters.storeId);
      paramCount++;
    }
    
    if (filters.storeIdentifier) {
      query += ` AND c.shop_domain = $${paramCount}`;
      params.push(filters.storeIdentifier);
      paramCount++;
    }
    
    // Filter by customer email
    if (filters.customerEmail) {
      query += ` AND c.customer_email = $${paramCount}`;
      params.push(filters.customerEmail);
      paramCount++;
    }
    
    // Filter by status
    if (filters.status) {
      query += ` AND c.status = $${paramCount}`;
      params.push(filters.status);
      paramCount++;
    }
    
    // Filter by priority
    if (filters.priority) {
      query += ` AND c.priority = $${paramCount}`;
      params.push(filters.priority);
      paramCount++;
    }
    
    // Filter by assigned agent
    if (filters.assignedTo) {
      query += ` AND c.assigned_to = $${paramCount}`;
      params.push(filters.assignedTo);
      paramCount++;
    }
    
    // Search by customer
    if (filters.search) {
      query += ` AND (c.customer_email ILIKE $${paramCount} OR c.customer_name ILIKE $${paramCount})`;
      params.push(`%${filters.search}%`);
      paramCount++;
    }
    
    // Pagination
    const limit = filters.limit || 50;
    const offset = filters.offset || 0;
    
    query += ` ORDER BY c.updated_at DESC LIMIT $${paramCount} OFFSET $${paramCount + 1}`;
    params.push(limit, offset);
    
    const result = await pool.query(query, params);
    return result.rows;
  } catch (error) {
    console.error('Error fetching conversations:', error);
    throw error;
  }
}

/**
 * Get conversation count
 */
async function getConversationCount(filters = {}) {
  try {
    let query = 'SELECT COUNT(*) FROM conversations WHERE 1=1';
    const params = [];
    let paramCount = 1;
    
    if (filters.storeId) {
      query += ` AND shop_id = $${paramCount}`;
      params.push(filters.storeId);
      paramCount++;
    }
    
    if (filters.status) {
      query += ` AND status = $${paramCount}`;
      params.push(filters.status);
      paramCount++;
    }
    
    const result = await pool.query(query, params);
    return parseInt(result.rows[0].count);
  } catch (error) {
    console.error('Error counting conversations:', error);
    throw error;
  }
}

/**
 * Update conversation
 */
async function updateConversation(conversationId, updates) {
  try {
    const fields = [];
    const values = [];
    let paramCount = 1;
    
    Object.entries(updates).forEach(([key, value]) => {
      fields.push(`${key} = $${paramCount}`);
      values.push(value);
      paramCount++;
    });
    
    fields.push(`updated_at = NOW()`);
    values.push(conversationId);
    
    const query = `
      UPDATE conversations 
      SET ${fields.join(', ')} 
      WHERE id = $${paramCount}
      RETURNING *
    `;
    
    const result = await pool.query(query, values);
    return result.rows[0];
  } catch (error) {
    console.error('Error updating conversation:', error);
    throw error;
  }
}

/**
 * Close conversation
 */
async function closeConversation(conversationId) {
  try {
    const result = await pool.query(`
      UPDATE conversations 
      SET status = 'closed', closed_at = NOW(), updated_at = NOW() 
      WHERE id = $1
      RETURNING *
    `, [conversationId]);
    
    return result.rows[0];
  } catch (error) {
    console.error('Error closing conversation:', error);
    throw error;
  }
}

/**
 * Assign conversation to agent
 */
async function assignConversation(conversationId, employeeEmail) {
  try {
    const result = await pool.query(`
      UPDATE conversations 
      SET assigned_to = $1, updated_at = NOW() 
      WHERE id = $2
      RETURNING *
    `, [employeeEmail, conversationId]);
    
    return result.rows[0];
  } catch (error) {
    console.error('Error assigning conversation:', error);
    throw error;
  }
}

// ============================================
// MESSAGE FUNCTIONS
// ============================================

/**
 * Save a new message
 */
async function saveMessage(data) {
  const {
    conversation_id,
    store_id,
    sender_type,
    sender_name,
    sender_id,
    content,
    message_type = 'text',
    attachment_url,
    attachment_type
  } = data;
  
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    // Insert message
    const messageResult = await client.query(`
      INSERT INTO messages (
        conversation_id, shop_id, sender_type, sender_name, sender_id,
        content, message_type, attachment_url, attachment_type, 
        sent_at, timestamp
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())
      RETURNING *
    `, [
      conversation_id, store_id, sender_type, sender_name, sender_id,
      content, message_type, attachment_url, attachment_type
    ]);
    
    const message = messageResult.rows[0];
    
    // Update conversation counters and timestamps
    const updateFields = [
      'total_message_count = total_message_count + 1',
      'last_message_at = NOW()',
      'updated_at = NOW()'
    ];
    
    if (sender_type === 'customer') {
      updateFields.push('customer_message_count = customer_message_count + 1');
      updateFields.push('last_customer_message_at = NOW()');
    } else if (sender_type === 'agent') {
      updateFields.push('agent_message_count = agent_message_count + 1');
      updateFields.push('last_agent_message_at = NOW()');
      
      // Calculate response time if this is first agent message
      updateFields.push(`
        response_time_seconds = CASE 
          WHEN last_agent_message_at IS NULL AND first_message_at IS NOT NULL
          THEN EXTRACT(EPOCH FROM (NOW() - first_message_at))::INTEGER
          ELSE response_time_seconds
        END
      `);
    }
    
    // Set first_message_at if not set
    updateFields.push(`
      first_message_at = COALESCE(first_message_at, NOW())
    `);
    
    await client.query(`
      UPDATE conversations 
      SET ${updateFields.join(', ')}
      WHERE id = $1
    `, [conversation_id]);
    
    await client.query('COMMIT');
    
    return message;
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error saving message:', error);
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Get messages for a conversation
 */
async function getMessages(conversationId, limit = 100) {
  try {
    const result = await pool.query(
      'SELECT * FROM messages WHERE conversation_id = $1 ORDER BY timestamp ASC LIMIT $2',
      [conversationId, limit]
    );
    
    return result.rows;
  } catch (error) {
    console.error('Error fetching messages:', error);
    throw error;
  }
}

/**
 * Mark message as delivered
 */
async function markMessageDelivered(messageId) {
  try {
    await pool.query(
      'UPDATE messages SET delivered_at = NOW() WHERE id = $1',
      [messageId]
    );
  } catch (error) {
    console.error('Error marking message delivered:', error);
  }
}

/**
 * Mark message as read
 */
async function markMessageRead(messageId) {
  try {
    await pool.query(
      'UPDATE messages SET read_at = NOW() WHERE id = $1',
      [messageId]
    );
  } catch (error) {
    console.error('Error marking message read:', error);
  }
}

/**
 * Mark message as failed
 */
async function markMessageFailed(messageId, error) {
  try {
    await pool.query(
      'UPDATE messages SET failed = true, routing_error = $1, retry_count = retry_count + 1 WHERE id = $2',
      [error, messageId]
    );
  } catch (err) {
    console.error('Error marking message failed:', err);
  }
}

// ============================================
// EMPLOYEE FUNCTIONS
// ============================================

/**
 * Create employee/agent
 */
async function createEmployee(data) {
  const {
    email,
    name,
    password_hash,
    role = 'agent',
    can_view_all_stores = true,
    assigned_stores = []
  } = data;
  
  try {
    // Validate required fields
    if (!email || !name) {
      throw new Error('Email and name are required');
    }
    
    if (!password_hash) {
      throw new Error('password_hash is required. Password must be hashed before calling createEmployee');
    }
    
    const result = await pool.query(`
      INSERT INTO employees (
        email, name, password_hash, role, can_view_all_stores, 
        assigned_stores, created_at, updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
      RETURNING *
    `, [email, name, password_hash, role, can_view_all_stores, assigned_stores]);
    
    return result.rows[0];
  } catch (error) {
    console.error('Error creating employee:', error);
    throw error;
  }
}

/**
 * Get employee by email
 */
async function getEmployeeByEmail(email) {
  try {
    const result = await pool.query(
      'SELECT * FROM employees WHERE email = $1 AND is_active = true',
      [email]
    );
    return result.rows[0] || null;
  } catch (error) {
    console.error('Error fetching employee:', error);
    throw error;
  }
}

/**
 * Get employee by ID
 */
async function getEmployeeById(id) {
  try {
    const result = await pool.query(
      'SELECT * FROM employees WHERE id = $1 AND is_active = true',
      [id]
    );
    return result.rows[0] || null;
  } catch (error) {
    console.error('Error fetching employee:', error);
    throw error;
  }
}

/**
 * Get all employees (for admin management)
 */
async function getAllEmployees() {
  try {
    const result = await pool.query(
      'SELECT * FROM employees ORDER BY created_at DESC'
    );
    return result.rows;
  } catch (error) {
    console.error('Error fetching all employees:', error);
    throw error;
  }
}

/**
 * Update employee
 */
async function updateEmployee(employeeId, updates) {
  try {
    const fields = [];
    const values = [];
    let paramCount = 1;
    
    // Only allow certain fields to be updated
    const allowedFields = ['name', 'email', 'role', 'password_hash', 'is_active', 
                          'can_view_all_stores', 'assigned_stores', 'last_login', 'is_online'];
    
    Object.entries(updates).forEach(([key, value]) => {
      if (allowedFields.includes(key)) {
        fields.push(`${key} = $${paramCount}`);
        values.push(value);
        paramCount++;
      }
    });
    
    if (fields.length === 0) {
      throw new Error('No valid fields to update');
    }
    
    fields.push(`updated_at = NOW()`);
    values.push(employeeId);
    
    const query = `
      UPDATE employees 
      SET ${fields.join(', ')} 
      WHERE id = $${paramCount}
      RETURNING *
    `;
    
    const result = await pool.query(query, values);
    return result.rows[0];
  } catch (error) {
    console.error('Error updating employee:', error);
    throw error;
  }
}

/**
 * Delete employee (soft delete - mark as inactive)
 */
async function deleteEmployee(employeeId) {
  try {
    const result = await pool.query(
      'UPDATE employees SET is_active = false, updated_at = NOW() WHERE id = $1 RETURNING *',
      [employeeId]
    );
    return result.rows[0];
  } catch (error) {
    console.error('Error deleting employee:', error);
    throw error;
  }
}

/**
 * Update employee status
 */
async function updateEmployeeStatus(employeeId, status) {
  try {
    // Handle both object and direct status updates
    if (typeof status === 'object') {
      // New format: { last_login: Date, is_online: boolean }
      const updates = {};
      if (status.last_login) updates.last_login = status.last_login;
      if (status.is_online !== undefined) updates.is_online = status.is_online;
      if (status.current_status) updates.current_status = status.current_status;
      
      return await updateEmployee(employeeId, updates);
    } else {
      // Old format: just a status string
      await pool.query(
        'UPDATE employees SET current_status = $1, is_online = $2, updated_at = NOW() WHERE id = $3',
        [status, status === 'online', employeeId]
      );
    }
  } catch (error) {
    console.error('Error updating employee status:', error);
  }
}

/**
 * Log agent activity
 */
async function logAgentActivity(data) {
  const { employee_id, conversation_id, store_id, action, action_data } = data;
  
  try {
    await pool.query(`
      INSERT INTO agent_activity (
        employee_id, conversation_id, shop_id, action, action_data, created_at
      )
      VALUES ($1, $2, $3, $4, $5, NOW())
    `, [employee_id, conversation_id, store_id, action, action_data]);
  } catch (error) {
    console.error('Error logging agent activity:', error);
  }
}

// ============================================
// WEBHOOK FUNCTIONS
// ============================================

/**
 * Log webhook
 */
async function logWebhook(data) {
  const { store_id, topic, payload, headers } = data;
  
  try {
    await pool.query(`
      INSERT INTO webhook_logs (shop_id, topic, payload, headers, received_at)
      VALUES ($1, $2, $3, $4, NOW())
    `, [store_id, topic, payload, headers]);
  } catch (error) {
    console.error('Error logging webhook:', error);
  }
}

// ============================================
// CANNED RESPONSES
// ============================================

/**
 * Get canned responses for store
 */
async function getCannedResponses(storeId) {
  try {
    const result = await pool.query(
      'SELECT * FROM canned_responses WHERE shop_id = $1 ORDER BY category, title',
      [storeId]
    );
    return result.rows;
  } catch (error) {
    console.error('Error fetching canned responses:', error);
    throw error;
  }
}

/**
 * Create canned response
 */
async function createCannedResponse(data) {
  const { store_id, title, content, shortcut, category, created_by } = data;
  
  try {
    const result = await pool.query(`
      INSERT INTO canned_responses (
        shop_id, title, content, shortcut, category, created_by, created_at, updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
      RETURNING *
    `, [store_id, title, content, shortcut, category, created_by]);
    
    return result.rows[0];
  } catch (error) {
    console.error('Error creating canned response:', error);
    throw error;
  }
}

// ============================================
// ANALYTICS FUNCTIONS
// ============================================

/**
 * Get dashboard stats
 */
async function getDashboardStats(filters = {}) {
  try {
    let storeFilter = '';
    const params = [];
    
    if (filters.storeId) {
      storeFilter = 'AND c.shop_id = $1';
      params.push(filters.storeId);
    }
    
    const result = await pool.query(`
      SELECT 
        COUNT(DISTINCT c.id) as total_conversations,
        COUNT(DISTINCT c.id) FILTER (WHERE c.status = 'open') as open_conversations,
        COUNT(DISTINCT c.id) FILTER (WHERE c.status = 'pending') as pending_conversations,
        COUNT(DISTINCT c.id) FILTER (WHERE c.status = 'closed') as closed_conversations,
        COUNT(DISTINCT c.shop_id) as active_stores,
        COUNT(DISTINCT m.id) FILTER (WHERE DATE(m.timestamp) = CURRENT_DATE) as messages_today,
        AVG(c.response_time_seconds) FILTER (WHERE c.response_time_seconds IS NOT NULL) as avg_response_time,
        COUNT(DISTINCT c.customer_email) as unique_customers
      FROM conversations c
      LEFT JOIN messages m ON m.conversation_id = c.id
      WHERE 1=1 ${storeFilter}
    `, params);
    
    return result.rows[0];
  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    throw error;
  }
}

/**
 * Get store performance metrics
 */
async function getStoreMetrics(storeId, days = 30) {
  try {
    const result = await pool.query(`
      SELECT 
        date,
        total_conversations,
        new_conversations,
        closed_conversations,
        total_messages,
        average_response_time_seconds
      FROM analytics_daily
      WHERE shop_id = $1 
        AND date >= CURRENT_DATE - INTERVAL '${days} days'
      ORDER BY date DESC
    `, [storeId]);
    
    return result.rows;
  } catch (error) {
    console.error('Error fetching store metrics:', error);
    throw error;
  }
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

/**
 * Test database connection
 */
async function testConnection() {
  try {
    const result = await pool.query('SELECT NOW()');
    console.log('✅ Database connection successful:', result.rows[0].now);
    return true;
  } catch (error) {
    console.error('❌ Database connection failed:', error);
    return false;
  }
}

/**
 * Close database pool
 */
async function closePool() {
  await pool.end();
}

// ============================================
// EXPORTS
// ============================================

module.exports = {
  pool,
  
  // Database management
  initDatabase,
  runMigrations,
  testConnection,
  closePool,
  
  // Store functions
  registerStore,
  getStoreByIdentifier,
  getStoreByDomain,
  getStoreById,
  getAllActiveStores,
  updateStoreConnectionStatus,
  updateStoreSettings,
  
  // Conversation functions
  saveConversation,
  getConversation,
  getConversations,
  getConversationCount,
  updateConversation,
  closeConversation,
  assignConversation,
  
  // Message functions
  saveMessage,
  getMessages,
  markMessageDelivered,
  markMessageRead,
  markMessageFailed,
  
  // Employee functions
  createEmployee,
  getEmployeeByEmail,
  getEmployeeById,
  getAllEmployees,
  updateEmployee,
  deleteEmployee,
  updateEmployeeStatus,
  logAgentActivity,
  
  // Webhook functions
  logWebhook,
  
  // Canned responses
  getCannedResponses,
  createCannedResponse,
  
  // Analytics
  getDashboardStats,
  getStoreMetrics,
};