

// const { Pool } = require('pg');
// require('dotenv').config();

// const pool = new Pool({
//   connectionString: process.env.DATABASE_URL,
//   ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
//   max: 50, // Increased for 80+ stores
//   idleTimeoutMillis: 30000,
//   connectionTimeoutMillis: 10000,
//   allowExitOnIdle: false, 
// });


// pool.on('error', (err) => {
//   console.error('Unexpected database pool error:', err);
// });

// function parseMessageFileData(message) {
//   if (!message) return message;
  
//   if (message.file_data && typeof message.file_data === 'string') {
//     try {
//       message.file_data = JSON.parse(message.file_data);
//     } catch (error) {
//       console.error('Failed to parse file_data:', error);
//       message.file_data = null;
//     }
//   }
  
//   return message;
// }

// async function initDatabase() {
//   const client = await pool.connect();
  
//   try {
//     console.log('🔄 Checking database initialization...');
    
//     const tablesCheck = await client.query(`
//       SELECT table_name 
//       FROM information_schema.tables 
//       WHERE table_schema = 'public' 
//       AND table_name IN ('stores', 'conversations', 'messages', 'employees')
//     `);
    
//     if (tablesCheck.rows.length > 0) {
//       console.log('✅ Database tables already exist, skipping initialization');
//       return;
//     }
    
//     console.log('📝 Creating database tables...');
    
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
//         agent_replied_at TIMESTAMPTZ,
//         response_time_seconds INTEGER,
        
//         -- Counts
//         customer_message_count INTEGER DEFAULT 0,
//         agent_message_count INTEGER DEFAULT 0,
//         total_message_count INTEGER DEFAULT 0,
//         unread_count INTEGER DEFAULT 0,
//         last_read_at TIMESTAMP,
        
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
//     // MESSAGE TEMPLATES TABLE
//     // ============================================
//     await client.query(`
//       CREATE TABLE IF NOT EXISTS message_templates (
//         id SERIAL PRIMARY KEY,
//         user_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
//         name VARCHAR(255) NOT NULL,
//         content TEXT NOT NULL,
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
//       CREATE INDEX IF NOT EXISTS idx_conversations_agent_replied ON conversations(agent_replied_at) WHERE agent_replied_at IS NOT NULL;
      
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
      
//       -- Message template indexes
//       CREATE INDEX IF NOT EXISTS idx_message_templates_user_id ON message_templates(user_id);
//       CREATE INDEX IF NOT EXISTS idx_message_templates_created ON message_templates(created_at DESC);
      
//       -- Analytics indexes
//       CREATE INDEX IF NOT EXISTS idx_analytics_shop_date ON analytics_daily(shop_id, date);
//     `);
    
//     console.log('✅ Database tables created successfully');
//   } catch (error) {
//     console.error('❌ Error initializing database:', error);
//     throw error;
//   } finally {
//     client.release();
//   }
// }


// async function runMigrations() {
//   console.log('🔄 Running database migrations...');
  
//   try {
//     await migration_001_add_message_columns();
//     await migration_002_add_conversation_metadata();
//     await migration_003_add_unread_fields();
//     await migration_004_add_last_message_fields();
//     await migration_005_add_message_templates();
//     await migration_006_add_file_data_column();
//     await migration_007_add_email_notifications();
//     await migration_008_add_conversation_notes();
//     await migration_009_add_employee_notes();
//     await migration_010_add_ai_training_brain();
//     await migration_011_add_legal_flag_columns();
//     await migration_012_add_agent_replied_at();
    
//     console.log('✅ All migrations completed successfully');
//   } catch (error) {
//     console.error('❌ Migration failed:', error);
//     throw error;
//   }
// }

// async function migration_001_add_message_columns() {
//   const client = await pool.connect();
  
//   try {
//     console.log('📝 [Migration 001] Checking messages table schema...');
    
//     const currentColumns = await client.query(`
//       SELECT column_name 
//       FROM information_schema.columns 
//       WHERE table_name = 'messages'
//     `);
    
//     const existingColumns = currentColumns.rows.map(row => row.column_name);
//     console.log('   Current columns:', existingColumns.join(', '));
    
//     const requiredColumns = [
//       { name: 'message_type', sql: 'VARCHAR(50) DEFAULT \'text\'' },
//       { name: 'attachment_url', sql: 'TEXT' },
//       { name: 'attachment_type', sql: 'VARCHAR(50)' },
//       { name: 'sent_at', sql: 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP' },
//       { name: 'delivered_at', sql: 'TIMESTAMP' },
//       { name: 'read_at', sql: 'TIMESTAMP' },
//       { name: 'failed', sql: 'BOOLEAN DEFAULT false' },
//       { name: 'retry_count', sql: 'INTEGER DEFAULT 0' },
//       { name: 'routed_successfully', sql: 'BOOLEAN DEFAULT true' },
//       { name: 'routing_error', sql: 'TEXT' }
//     ];
    
//     const columnsAdded = [];
    
//     for (const column of requiredColumns) {
//       if (!existingColumns.includes(column.name)) {
//         console.log(`   Adding column: ${column.name}...`);
//         await client.query(`ALTER TABLE messages ADD COLUMN ${column.name} ${column.sql};`);
//         columnsAdded.push(column.name);
//       }
//     }
    
//     if (columnsAdded.length > 0) {
//       console.log(`✅ [Migration 001] Added ${columnsAdded.length} columns: ${columnsAdded.join(', ')}`);
//     } else {
//       console.log('⏭️  [Migration 001] All columns already exist, skipping');
//     }
//   } catch (error) {
//     console.error('❌ [Migration 001] Failed:', error);
//     throw error;
//   } finally {
//     client.release();
//   }
// }

// async function migration_002_add_conversation_metadata() {
//   const client = await pool.connect();
  
//   try {
//     console.log('📝 [Migration 002] Adding cart_subtotal and source columns...');
    
//     const currentColumns = await client.query(`
//       SELECT column_name 
//       FROM information_schema.columns 
//       WHERE table_name = 'conversations'
//     `);
    
//     const existingColumns = currentColumns.rows.map(row => row.column_name);
//     const columnsAdded = [];
    
//     if (!existingColumns.includes('cart_subtotal')) {
//       await client.query(`ALTER TABLE conversations ADD COLUMN cart_subtotal DECIMAL(10, 2) DEFAULT 0;`);
//       columnsAdded.push('cart_subtotal');
//     }
    
//     if (!existingColumns.includes('source')) {
//       await client.query(`ALTER TABLE conversations ADD COLUMN source VARCHAR(100);`);
//       columnsAdded.push('source');
//     }
    
//     await client.query(`
//       CREATE INDEX IF NOT EXISTS idx_conversations_source ON conversations(source);
//       CREATE INDEX IF NOT EXISTS idx_conversations_cart_subtotal ON conversations(cart_subtotal);
//     `);
    
//     if (columnsAdded.length > 0) {
//       console.log(`✅ [Migration 002] Added ${columnsAdded.length} columns: ${columnsAdded.join(', ')}`);
//     } else {
//       console.log('⏭️  [Migration 002] All columns already exist, skipping');
//     }
//   } catch (error) {
//     console.error('❌ [Migration 002] Failed:', error);
//     throw error;
//   } finally {
//     client.release();
//   }
// }

// async function migration_003_add_unread_fields() {
//   const client = await pool.connect();
//   try {
//     console.log('📝 [Migration 003] Adding unread fields...');
//     await client.query(`ALTER TABLE conversations ADD COLUMN IF NOT EXISTS unread_count INTEGER DEFAULT 0;`);
//     await client.query(`ALTER TABLE conversations ADD COLUMN IF NOT EXISTS last_read_at TIMESTAMP;`);
//     console.log('✅ [Migration 003] Completed');
//   } catch (error) {
//     console.error('❌ [Migration 003] Failed:', error);
//     throw error;
//   } finally {
//     client.release();
//   }
// }

// async function migration_004_add_last_message_fields() {
//   const client = await pool.connect();
  
//   try {
//     console.log('📝 [Migration 004] Adding last message tracking fields...');
    
//     const currentColumns = await client.query(`
//       SELECT column_name 
//       FROM information_schema.columns 
//       WHERE table_name = 'conversations'
//     `);
    
//     const existingColumns = currentColumns.rows.map(row => row.column_name);
//     const columnsAdded = [];
    
//     if (!existingColumns.includes('last_message')) {
//       await client.query(`ALTER TABLE conversations ADD COLUMN last_message TEXT;`);
//       columnsAdded.push('last_message');
//     }
    
//     if (!existingColumns.includes('last_message_sender_type')) {
//       await client.query(`ALTER TABLE conversations ADD COLUMN last_message_sender_type VARCHAR(50);`);
//       columnsAdded.push('last_message_sender_type');
//     }
    
//     if (!existingColumns.includes('last_message_at')) {
//       await client.query(`ALTER TABLE conversations ADD COLUMN last_message_at TIMESTAMP;`);
//       columnsAdded.push('last_message_at');
//     }
    
//     console.log('   Populating existing conversations with last messages...');
//     await client.query(`
//       UPDATE conversations c
//       SET 
//         last_message = m.content,
//         last_message_sender_type = m.sender_type,
//         last_message_at = m.timestamp
//       FROM (
//         SELECT DISTINCT ON (conversation_id)
//           conversation_id,
//           content,
//           sender_type,
//           timestamp
//         FROM messages
//         ORDER BY conversation_id, timestamp DESC
//       ) m
//       WHERE c.id = m.conversation_id;
//     `);
    
//     if (columnsAdded.length > 0) {
//       console.log(`✅ [Migration 004] Added ${columnsAdded.length} columns: ${columnsAdded.join(', ')}`);
//     } else {
//       console.log('⏭️  [Migration 004] All columns already exist, skipping');
//     }
    
//     console.log('✅ [Migration 004] Completed');
//   } catch (error) {
//     console.error('❌ [Migration 004] Failed:', error);
//     throw error;
//   } finally {
//     client.release();
//   }
// }

// async function migration_005_add_message_templates() {
//   const client = await pool.connect();
  
//   try {
//     console.log('📝 [Migration 005] Adding message_templates table...');
    
//     const tableCheck = await client.query(`
//       SELECT EXISTS (
//         SELECT FROM information_schema.tables 
//         WHERE table_schema = 'public' 
//         AND table_name = 'message_templates'
//       );
//     `);
    
//     if (tableCheck.rows[0].exists) {
//       console.log('⏭️  [Migration 005] message_templates table already exists, skipping');
//       return;
//     }
    
//     await client.query(`
//       CREATE TABLE message_templates (
//         id SERIAL PRIMARY KEY,
//         user_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
//         name VARCHAR(255) NOT NULL,
//         content TEXT NOT NULL,
//         created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
//         updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
//       );
//     `);
    
//     await client.query(`
//       CREATE INDEX idx_message_templates_user_id ON message_templates(user_id);
//       CREATE INDEX idx_message_templates_created ON message_templates(created_at DESC);
//     `);
    
//     await client.query(`
//       CREATE OR REPLACE FUNCTION update_message_templates_updated_at()
//       RETURNS TRIGGER AS $$
//       BEGIN
//         NEW.updated_at = CURRENT_TIMESTAMP;
//         RETURN NEW;
//       END;
//       $$ language 'plpgsql';
      
//       CREATE TRIGGER trigger_message_templates_updated_at 
//         BEFORE UPDATE ON message_templates 
//         FOR EACH ROW 
//         EXECUTE FUNCTION update_message_templates_updated_at();
//     `);
    
//     console.log('✅ [Migration 005] message_templates table created successfully');
//   } catch (error) {
//     console.error('❌ [Migration 005] Failed:', error);
//     throw error;
//   } finally {
//     client.release();
//   }
// }

// async function migration_006_add_file_data_column() {
//   const client = await pool.connect();
  
//   try {
//     console.log('📝 [Migration 006] Adding file_data column to messages table...');
    
//     const currentColumns = await client.query(`
//       SELECT column_name 
//       FROM information_schema.columns 
//       WHERE table_name = 'messages'
//     `);
    
//     const existingColumns = currentColumns.rows.map(row => row.column_name);
    
//     if (!existingColumns.includes('file_data')) {
//       await client.query(`ALTER TABLE messages ADD COLUMN file_data JSONB;`);
//       await client.query(`
//         CREATE INDEX IF NOT EXISTS idx_messages_file_data 
//         ON messages(file_data) 
//         WHERE file_data IS NOT NULL;
//       `);
//       console.log('✅ [Migration 006] file_data column added successfully');
//     } else {
//       console.log('⏭️  [Migration 006] file_data column already exists, skipping');
//     }
//   } catch (error) {
//     console.error('❌ [Migration 006] Failed:', error);
//     throw error;
//   } finally {
//     client.release();
//   }
// }

// async function migration_007_add_email_notifications() {
//   const client = await pool.connect();

//   try {
//     console.log('📝 [Migration 007] Adding email notification support...');

//     const storeColumns = await client.query(`
//       SELECT column_name FROM information_schema.columns WHERE table_name = 'stores'
//     `);
//     const existing = storeColumns.rows.map(r => r.column_name);
//     const added = [];

//     if (!existing.includes('email_from_name')) {
//       await client.query(`ALTER TABLE stores ADD COLUMN email_from_name VARCHAR(255)`);
//       added.push('email_from_name');
//     }
//     if (!existing.includes('email_from_address')) {
//       await client.query(`ALTER TABLE stores ADD COLUMN email_from_address VARCHAR(255)`);
//       added.push('email_from_address');
//     }
//     if (!existing.includes('email_brand_color')) {
//       await client.query(`ALTER TABLE stores ADD COLUMN email_brand_color VARCHAR(7)`);
//       added.push('email_brand_color');
//     }

//     if (added.length > 0) {
//       console.log(`   Added store columns: ${added.join(', ')}`);
//     } else {
//       console.log('   Store email columns already exist');
//     }

//     const presenceExists = await client.query(`
//       SELECT EXISTS (
//         SELECT FROM information_schema.tables 
//         WHERE table_schema = 'public' AND table_name = 'customer_presence'
//       )
//     `);

//     if (!presenceExists.rows[0].exists) {
//       await client.query(`
//         CREATE TABLE customer_presence (
//           id SERIAL PRIMARY KEY,
//           conversation_id INTEGER NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
//           customer_email VARCHAR(255) NOT NULL,
//           store_id INTEGER REFERENCES stores(id) ON DELETE CASCADE,
//           status VARCHAR(20) NOT NULL DEFAULT 'offline',
//           last_activity_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
//           last_heartbeat_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
//           ws_connected BOOLEAN NOT NULL DEFAULT FALSE,
//           updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
//           UNIQUE(conversation_id)
//         )
//       `);
//       await client.query(`CREATE INDEX idx_presence_conv ON customer_presence(conversation_id)`);
//       await client.query(`CREATE INDEX idx_presence_status ON customer_presence(status)`);
//       console.log('   Created customer_presence table');
//     } else {
//       console.log('   customer_presence table already exists');
//     }

//     const emailLogExists = await client.query(`
//       SELECT EXISTS (
//         SELECT FROM information_schema.tables 
//         WHERE table_schema = 'public' AND table_name = 'offline_email_log'
//       )
//     `);

//     if (!emailLogExists.rows[0].exists) {
//       await client.query(`
//         CREATE TABLE offline_email_log (
//           id SERIAL PRIMARY KEY,
//           conversation_id INTEGER NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
//           message_id INTEGER NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
//           customer_email VARCHAR(255) NOT NULL,
//           resend_id VARCHAR(100),
//           sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
//           UNIQUE(message_id)
//         )
//       `);
//       await client.query(`CREATE INDEX idx_email_log_conv ON offline_email_log(conversation_id, sent_at DESC)`);
//       console.log('   Created offline_email_log table');
//     } else {
//       console.log('   offline_email_log table already exists');
//     }

//     console.log('✅ [Migration 007] Email notification support added');
//   } catch (error) {
//     console.error('❌ [Migration 007] Failed:', error);
//     throw error;
//   } finally {
//     client.release();
//   }
// }

// async function migration_008_add_conversation_notes() {
//   const client = await pool.connect();
  
//   try {
//     console.log('📝 [Migration 008] Adding conversation_notes support...');
    
//     const tableExists = await client.query(`
//       SELECT EXISTS (
//         SELECT FROM information_schema.tables 
//         WHERE table_schema = 'public' AND table_name = 'conversation_notes'
//       )
//     `);
    
//     if (tableExists.rows[0].exists) {
//       console.log('⏭️  [Migration 008] conversation_notes table already exists, skipping');
//       return;
//     }
    
//     await client.query(`
//       CREATE TABLE conversation_notes (
//         id SERIAL PRIMARY KEY,
//         conversation_id INTEGER NOT NULL,
//         employee_id INTEGER NOT NULL,
//         employee_name VARCHAR(255) NOT NULL,
//         content TEXT NOT NULL,
//         created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
//         updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
//         CONSTRAINT fk_conversation_notes_conversation
//           FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
//         CONSTRAINT fk_conversation_notes_employee
//           FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE
//       )
//     `);
    
//     await client.query(`
//       CREATE INDEX idx_conversation_notes_conversation_id ON conversation_notes(conversation_id);
//       CREATE INDEX idx_conversation_notes_employee_id ON conversation_notes(employee_id);
//       CREATE INDEX idx_conversation_notes_created_at ON conversation_notes(created_at DESC);
//       CREATE INDEX idx_conversation_notes_lookup ON conversation_notes(conversation_id, employee_id, created_at DESC);
//     `);
    
//     await client.query(`
//       CREATE OR REPLACE FUNCTION update_conversation_notes_updated_at()
//       RETURNS TRIGGER AS $$
//       BEGIN
//         NEW.updated_at = CURRENT_TIMESTAMP;
//         RETURN NEW;
//       END;
//       $$ language 'plpgsql';
      
//       CREATE TRIGGER trigger_conversation_notes_updated_at 
//         BEFORE UPDATE ON conversation_notes 
//         FOR EACH ROW 
//         EXECUTE FUNCTION update_conversation_notes_updated_at();
//     `);
    
//     console.log('✅ [Migration 008] Conversation notes support added successfully');
//   } catch (error) {
//     console.error('❌ [Migration 008] Failed:', error);
//     throw error;
//   } finally {
//     client.release();
//   }
// }

// async function migration_009_add_employee_notes() {
//   const migrationName = 'Migration 009';
  
//   try {
//     const tableCheck = await pool.query(`
//       SELECT EXISTS (
//         SELECT FROM information_schema.tables 
//         WHERE table_schema = 'public' AND table_name = 'employee_notes'
//       );
//     `);

//     if (tableCheck.rows[0].exists) {
//       console.log(`✅ [${migrationName}] employee_notes table already exists`);
      
//       const titleColumnCheck = await pool.query(`
//         SELECT EXISTS (
//           SELECT FROM information_schema.columns 
//           WHERE table_schema = 'public' AND table_name = 'employee_notes' AND column_name = 'title'
//         );
//       `);
      
//       if (!titleColumnCheck.rows[0].exists) {
//         console.log(`🔄 [${migrationName}] Adding title column...`);
//         await pool.query(`ALTER TABLE employee_notes ADD COLUMN title VARCHAR(200) DEFAULT 'Untitled';`);
//         console.log(`✅ [${migrationName}] Title column added`);
//       }
//       return;
//     }

//     console.log(`🔄 [${migrationName}] Creating employee_notes table...`);

//     await pool.query(`
//       CREATE TABLE employee_notes (
//         id SERIAL PRIMARY KEY,
//         employee_id INTEGER NOT NULL,
//         employee_name VARCHAR(255) NOT NULL,
//         title VARCHAR(200) DEFAULT 'Untitled',
//         content TEXT NOT NULL,
//         created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
//         updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
//         FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE
//       );
//     `);

//     await pool.query(`
//       CREATE INDEX idx_employee_notes_employee_id ON employee_notes(employee_id);
//       CREATE INDEX idx_employee_notes_created_at ON employee_notes(created_at);
//       CREATE INDEX idx_employee_notes_title ON employee_notes(title);
//     `);

//     await pool.query(`
//       CREATE OR REPLACE FUNCTION update_employee_notes_updated_at()
//       RETURNS TRIGGER AS $$
//       BEGIN
//         NEW.updated_at = CURRENT_TIMESTAMP;
//         RETURN NEW;
//       END;
//       $$ LANGUAGE plpgsql;

//       CREATE TRIGGER trigger_employee_notes_updated_at
//         BEFORE UPDATE ON employee_notes
//         FOR EACH ROW
//         EXECUTE FUNCTION update_employee_notes_updated_at();
//     `);

//     console.log(`✅ [${migrationName}] Employee notes table created with title support`);
//   } catch (error) {
//     console.error(`❌ [${migrationName}] Failed:`, error);
//     throw error;
//   }
// }

// async function migration_010_add_ai_training_brain() {
//   const migrationName = 'Migration 010';

//   try {
//     const tableCheck = await pool.query(`
//       SELECT EXISTS (
//         SELECT FROM information_schema.tables
//         WHERE table_schema = 'public' AND table_name = 'ai_training_brain'
//       );
//     `);

//     if (tableCheck.rows[0].exists) {
//       console.log(`✅ [${migrationName}] ai_training_brain table already exists`);
//       return;
//     }

//     console.log(`🔄 [${migrationName}] Creating ai_training_brain table...`);

//     await pool.query(`
//       CREATE TABLE ai_training_brain (
//         id          INTEGER PRIMARY KEY DEFAULT 1,
//         brain_data  JSONB NOT NULL DEFAULT '{}',
//         updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
//         updated_by  TEXT,
//         CONSTRAINT single_row CHECK (id = 1)
//       );
//     `);

//     await pool.query(`
//       INSERT INTO ai_training_brain (id, brain_data)
//       VALUES (1, '{}')
//       ON CONFLICT DO NOTHING;
//     `);

//     console.log(`✅ [${migrationName}] ai_training_brain table created`);
//   } catch (error) {
//     console.error(`❌ [${migrationName}] Failed:`, error);
//     throw error;
//   }
// }

// async function migration_011_add_legal_flag_columns() {
//   const migrationName = 'Migration 011';

//   try {
//     console.log(`📝 [${migrationName}] Adding legal flag columns to conversations...`);

//     await pool.query(`
//       ALTER TABLE conversations
//         ADD COLUMN IF NOT EXISTS legal_flag          BOOLEAN      DEFAULT FALSE,
//         ADD COLUMN IF NOT EXISTS legal_flag_severity VARCHAR(20),
//         ADD COLUMN IF NOT EXISTS legal_flag_at       TIMESTAMPTZ,
//         ADD COLUMN IF NOT EXISTS legal_flag_term     VARCHAR(100);
//     `);

//     await pool.query(`
//       CREATE INDEX IF NOT EXISTS idx_conversations_legal_flag
//         ON conversations(legal_flag)
//         WHERE legal_flag = TRUE;
//     `);

//     console.log(`✅ [${migrationName}] Legal flag columns added`);
//   } catch (error) {
//     console.error(`❌ [${migrationName}] Failed:`, error);
//     throw error;
//   }
// }
// async function migration_012_add_agent_replied_at() {
//   const migrationName = 'Migration 012';

//   try {
//     console.log(`📝 [${migrationName}] Adding agent_replied_at column to conversations...`);

//     await pool.query(`
//       ALTER TABLE conversations
//         ADD COLUMN IF NOT EXISTS agent_replied_at TIMESTAMPTZ;
//     `);

//     await pool.query(`
//       CREATE INDEX IF NOT EXISTS idx_conversations_agent_replied
//         ON conversations(agent_replied_at)
//         WHERE agent_replied_at IS NOT NULL;
//     `);

//     await pool.query(`
//       UPDATE conversations c
//       SET agent_replied_at = first_agent.first_reply
//       FROM (
//         SELECT conversation_id, MIN(timestamp) AS first_reply
//         FROM messages
//         WHERE sender_type = 'agent'
//         GROUP BY conversation_id
//       ) first_agent
//       WHERE c.id = first_agent.conversation_id
//         AND c.agent_replied_at IS NULL;
//     `);

//     console.log(`✅ [${migrationName}] agent_replied_at column added and back-filled`);
//   } catch (error) {
//     console.error(`❌ [${migrationName}] Failed:`, error);
//     throw error;
//   }
// }

// // ============================================
// // STORE FUNCTIONS
// // ============================================

// async function registerStore(storeData) {
//   const {
//     store_identifier, shop_domain, brand_name, access_token, api_key,
//     api_secret, scope, timezone = 'UTC', currency = 'USD', logo_url,
//     primary_color = '#667eea', contact_email, store_tags = []
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
//         shop_domain = $2, brand_name = $3, access_token = $4, api_key = $5,
//         api_secret = $6, scope = $7, timezone = $8, currency = $9,
//         logo_url = $10, primary_color = $11, contact_email = $12,
//         store_tags = $13, updated_at = NOW()
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
//     const result = await pool.query(
//       `UPDATE stores SET ${fields.join(', ')} WHERE id = $${paramCount} RETURNING *`,
//       values
//     );
//     return result.rows[0];
//   } catch (error) {
//     console.error('Error updating store settings:', error);
//     throw error;
//   }
// }

// // ============================================
// // CONVERSATION FUNCTIONS
// // ============================================

// async function saveConversation(data) {
//   const {
//     store_id, store_identifier, customer_email, customer_name, customer_id,
//     customer_phone, status = 'open', priority = 'normal', tags = [],
//     cart_subtotal = 0, source = 'website'
//   } = data;
  
//   try {
//     const result = await pool.query(`
//       INSERT INTO conversations (
//         shop_id, shop_domain, customer_email, customer_name, customer_id,
//         customer_phone, status, priority, tags, cart_subtotal, source, 
//         created_at, updated_at
//       )
//       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW(), NOW())
//       RETURNING *
//     `, [
//       store_id, store_identifier, customer_email, customer_name, customer_id,
//       customer_phone, status, priority, tags, cart_subtotal, source
//     ]);
//     return result.rows[0];
//   } catch (error) {
//     console.error('Error saving conversation:', error);
//     throw error;
//   }
// }

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
//     if (filters.customerEmail) {
//       query += ` AND c.customer_email = $${paramCount}`;
//       params.push(filters.customerEmail);
//       paramCount++;
//     }
//     if (filters.status) {
//       query += ` AND c.status = $${paramCount}`;
//       params.push(filters.status);
//       paramCount++;
//     }
//     if (filters.priority) {
//       query += ` AND c.priority = $${paramCount}`;
//       params.push(filters.priority);
//       paramCount++;
//     }
//     if (filters.assignedTo) {
//       query += ` AND c.assigned_to = $${paramCount}`;
//       params.push(filters.assignedTo);
//       paramCount++;
//     }
//     if (filters.search) {
//       query += ` AND (c.customer_email ILIKE $${paramCount} OR c.customer_name ILIKE $${paramCount})`;
//       params.push(`%${filters.search}%`);
//       paramCount++;
//     }
    
//     const limit = filters.limit;
//     const offset = filters.offset || 0;
//     if (limit) {
//       query += ` ORDER BY c.updated_at DESC LIMIT $${paramCount} OFFSET $${paramCount + 1}`;
//       params.push(limit, offset);
//     } else {
//       query += ` ORDER BY c.updated_at DESC`;
//     }
    
//     const result = await pool.query(query, params);
//     return result.rows;
//   } catch (error) {
//     console.error('Error fetching conversations:', error);
//     throw error;
//   }
// }

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
//     const result = await pool.query(
//       `UPDATE conversations SET ${fields.join(', ')} WHERE id = $${paramCount} RETURNING *`,
//       values
//     );
//     return result.rows[0];
//   } catch (error) {
//     console.error('Error updating conversation:', error);
//     throw error;
//   }
// }

// async function closeConversation(conversationId) {
//   try {
//     const result = await pool.query(`
//       UPDATE conversations 
//       SET status = 'closed', closed_at = NOW(), updated_at = NOW() 
//       WHERE id = $1 RETURNING *
//     `, [conversationId]);
//     return result.rows[0];
//   } catch (error) {
//     console.error('Error closing conversation:', error);
//     throw error;
//   }
// }

// async function assignConversation(conversationId, employeeEmail) {
//   try {
//     const result = await pool.query(`
//       UPDATE conversations SET assigned_to = $1, updated_at = NOW() WHERE id = $2 RETURNING *
//     `, [employeeEmail, conversationId]);
//     return result.rows[0];
//   } catch (error) {
//     console.error('Error assigning conversation:', error);
//     throw error;
//   }
// }

// async function markConversationRead(conversationId) {
//   try {
//     await pool.query(`
//       UPDATE conversations
//       SET unread_count = 0, last_read_at = NOW(), updated_at = NOW()
//       WHERE id = $1
//     `, [conversationId]);
//   } catch (error) {
//     console.error('Error marking conversation read:', error);
//     throw error;
//   }
// }

// // ============================================
// // MESSAGE FUNCTIONS
// // ============================================

// async function saveMessage(data) {
//   const {
//     conversation_id, store_id, sender_type, sender_name, sender_id,
//     content, message_type = 'text', attachment_url, attachment_type, file_data
//   } = data;
  
//   console.log('💾 [saveMessage] Called with:', {
//     conversation_id, sender_type, sender_name,
//     content: content?.substring(0, 30), hasFileData: !!file_data
//   });
  
//   const client = await pool.connect();
  
//   try {
//     await client.query('BEGIN');
    
//     const messageResult = await client.query(`
//       INSERT INTO messages (
//         conversation_id, shop_id, sender_type, sender_name, sender_id,
//         content, message_type, attachment_url, attachment_type, 
//         file_data, sent_at, timestamp
//       )
//       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), NOW())
//       RETURNING *
//     `, [
//       conversation_id, store_id, sender_type, sender_name, sender_id,
//       content, message_type, attachment_url, attachment_type, file_data
//     ]);
    
//     const message = messageResult.rows[0];
//     console.log('✅ [saveMessage] Message inserted, id:', message.id);
    
//     const updateFields = [
//       'total_message_count = total_message_count + 1',
//       'last_message_at = NOW()',
//       'updated_at = NOW()',
//       'last_message = $2',
//       'last_message_sender_type = $3'
//     ];
    
//     if (sender_type === 'customer') {
//       updateFields.push('customer_message_count = customer_message_count + 1');
//       updateFields.push('last_customer_message_at = NOW()');
//       updateFields.push('unread_count = unread_count + 1');
//     } else if (sender_type === 'agent') {
//       updateFields.push('agent_message_count = agent_message_count + 1');
//       updateFields.push('last_agent_message_at = NOW()');
//       // ── Set agent_replied_at once on first agent reply, never overwrite ──
//       updateFields.push('agent_replied_at = COALESCE(agent_replied_at, NOW())');
//       updateFields.push(`
//         response_time_seconds = CASE 
//           WHEN last_agent_message_at IS NULL AND first_message_at IS NOT NULL
//           THEN EXTRACT(EPOCH FROM (NOW() - first_message_at))::INTEGER
//           ELSE response_time_seconds
//         END
//       `);
//     }
    
//     updateFields.push(`first_message_at = COALESCE(first_message_at, NOW())`);
    
//     await client.query(`
//       UPDATE conversations 
//       SET ${updateFields.join(', ')}
//       WHERE id = $1
//     `, [conversation_id, content, sender_type]);
    
//     console.log('✅ [saveMessage] Conversation updated successfully');
    
//     await client.query('COMMIT');
//     return parseMessageFileData(message);
//   } catch (error) {
//     await client.query('ROLLBACK');
//     console.error('❌ [saveMessage] Error:', error);
//     throw error;
//   } finally {
//     client.release();
//   }
// }

// async function getMessages(conversationId, limit = 100) {
//   try {
//     const result = await pool.query(
//       'SELECT * FROM messages WHERE conversation_id = $1 ORDER BY timestamp ASC LIMIT $2',
//       [conversationId, limit]
//     );
//     return result.rows.map(parseMessageFileData);
//   } catch (error) {
//     console.error('Error fetching messages:', error);
//     throw error;
//   }
// }

// async function markMessageDelivered(messageId) {
//   try {
//     await pool.query('UPDATE messages SET delivered_at = NOW() WHERE id = $1', [messageId]);
//   } catch (error) {
//     console.error('Error marking message delivered:', error);
//   }
// }

// async function markMessageRead(messageId) {
//   try {
//     await pool.query('UPDATE messages SET read_at = NOW() WHERE id = $1', [messageId]);
//   } catch (error) {
//     console.error('Error marking message read:', error);
//   }
// }

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

// async function createEmployee(data) {
//   const {
//     email, name, password_hash, role = 'agent',
//     can_view_all_stores = true, assigned_stores = []
//   } = data;
  
//   try {
//     if (!email || !name) throw new Error('Email and name are required');
//     if (!password_hash) throw new Error('password_hash is required');
    
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

// async function getEmployeeByEmail(email) {
//   try {
//     const result = await pool.query(
//       'SELECT * FROM employees WHERE email = $1 AND is_active = true', [email]
//     );
//     return result.rows[0] || null;
//   } catch (error) {
//     console.error('Error fetching employee:', error);
//     throw error;
//   }
// }

// async function getEmployeeById(id) {
//   try {
//     const result = await pool.query(
//       'SELECT * FROM employees WHERE id = $1 AND is_active = true', [id]
//     );
//     return result.rows[0] || null;
//   } catch (error) {
//     console.error('Error fetching employee:', error);
//     throw error;
//   }
// }

// async function getAllEmployees() {
//   try {
//     const result = await pool.query('SELECT * FROM employees ORDER BY created_at DESC');
//     return result.rows;
//   } catch (error) {
//     console.error('Error fetching all employees:', error);
//     throw error;
//   }
// }

// async function updateEmployee(employeeId, updates) {
//   try {
//     const fields = [];
//     const values = [];
//     let paramCount = 1;
//     const allowedFields = ['name', 'email', 'role', 'password_hash', 'is_active', 
//                           'can_view_all_stores', 'assigned_stores', 'last_login', 'is_online'];
//     Object.entries(updates).forEach(([key, value]) => {
//       if (allowedFields.includes(key)) {
//         fields.push(`${key} = $${paramCount}`);
//         values.push(value);
//         paramCount++;
//       }
//     });
//     if (fields.length === 0) throw new Error('No valid fields to update');
//     fields.push(`updated_at = NOW()`);
//     values.push(employeeId);
//     const result = await pool.query(
//       `UPDATE employees SET ${fields.join(', ')} WHERE id = $${paramCount} RETURNING *`,
//       values
//     );
//     return result.rows[0];
//   } catch (error) {
//     console.error('Error updating employee:', error);
//     throw error;
//   }
// }

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

// async function updateEmployeeStatus(employeeId, status) {
//   try {
//     if (typeof status === 'object') {
//       const updates = {};
//       if (status.last_login) updates.last_login = status.last_login;
//       if (status.is_online !== undefined) updates.is_online = status.is_online;
//       if (status.current_status) updates.current_status = status.current_status;
//       return await updateEmployee(employeeId, updates);
//     } else {
//       await pool.query(
//         'UPDATE employees SET current_status = $1, is_online = $2, updated_at = NOW() WHERE id = $3',
//         [status, status === 'online', employeeId]
//       );
//     }
//   } catch (error) {
//     console.error('Error updating employee status:', error);
//   }
// }

// async function logAgentActivity(data) {
//   const { employee_id, conversation_id, store_id, action, action_data } = data;
//   try {
//     await pool.query(`
//       INSERT INTO agent_activity (employee_id, conversation_id, shop_id, action, action_data, created_at)
//       VALUES ($1, $2, $3, $4, $5, NOW())
//     `, [employee_id, conversation_id, store_id, action, action_data]);
//   } catch (error) {
//     console.error('Error logging agent activity:', error);
//   }
// }

// // ============================================
// // WEBHOOK FUNCTIONS
// // ============================================

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

// async function getCannedResponses(storeId) {
//   try {
//     const result = await pool.query(
//       'SELECT * FROM canned_responses WHERE shop_id = $1 ORDER BY category, title', [storeId]
//     );
//     return result.rows;
//   } catch (error) {
//     console.error('Error fetching canned responses:', error);
//     throw error;
//   }
// }

// async function createCannedResponse(data) {
//   const { store_id, title, content, shortcut, category, created_by } = data;
//   try {
//     const result = await pool.query(`
//       INSERT INTO canned_responses (shop_id, title, content, shortcut, category, created_by, created_at, updated_at)
//       VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW()) RETURNING *
//     `, [store_id, title, content, shortcut, category, created_by]);
//     return result.rows[0];
//   } catch (error) {
//     console.error('Error creating canned response:', error);
//     throw error;
//   }
// }

// // ============================================
// // MESSAGE TEMPLATE FUNCTIONS
// // ============================================

// async function getTemplatesByUserId(userId) {
//   try {
//     const result = await pool.query(
//       `SELECT id, user_id, name, content, created_at, updated_at 
//        FROM message_templates WHERE user_id = $1 ORDER BY created_at DESC`,
//       [userId]
//     );
//     return result.rows;
//   } catch (error) {
//     console.error('Error fetching templates:', error);
//     throw error;
//   }
// }

// async function getTemplateById(templateId) {
//   try {
//     const result = await pool.query(
//       `SELECT id, user_id, name, content, created_at, updated_at FROM message_templates WHERE id = $1`,
//       [templateId]
//     );
//     return result.rows[0] || null;
//   } catch (error) {
//     console.error('Error fetching template:', error);
//     throw error;
//   }
// }

// async function createTemplate({ user_id, name, content }) {
//   try {
//     const result = await pool.query(
//       `INSERT INTO message_templates (user_id, name, content) 
//        VALUES ($1, $2, $3) 
//        RETURNING id, user_id, name, content, created_at, updated_at`,
//       [user_id, name, content]
//     );
//     return result.rows[0];
//   } catch (error) {
//     console.error('Error creating template:', error);
//     throw error;
//   }
// }

// async function updateTemplate(templateId, { name, content }) {
//   try {
//     const result = await pool.query(
//       `UPDATE message_templates SET name = $1, content = $2, updated_at = CURRENT_TIMESTAMP 
//        WHERE id = $3 RETURNING id, user_id, name, content, created_at, updated_at`,
//       [name, content, templateId]
//     );
//     return result.rows[0];
//   } catch (error) {
//     console.error('Error updating template:', error);
//     throw error;
//   }
// }

// async function deleteTemplate(templateId) {
//   try {
//     await pool.query('DELETE FROM message_templates WHERE id = $1', [templateId]);
//     return { success: true };
//   } catch (error) {
//     console.error('Error deleting template:', error);
//     throw error;
//   }
// }

// // ============================================
// // ANALYTICS FUNCTIONS
// // ============================================

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

// async function getStoreMetrics(storeId, days = 30) {
//   try {
//     const result = await pool.query(`
//       SELECT date, total_conversations, new_conversations, closed_conversations,
//              total_messages, average_response_time_seconds
//       FROM analytics_daily
//       WHERE shop_id = $1 AND date >= CURRENT_DATE - INTERVAL '${days} days'
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

// async function closePool() {
//   await pool.end();
// }

// // ============================================
// // EXPORTS
// // ============================================

// module.exports = {
//   pool,
//   initDatabase,
//   runMigrations,
//   testConnection,
//   closePool,
//   registerStore,
//   getStoreByIdentifier,
//   getStoreByDomain,
//   getStoreById,
//   getAllActiveStores,
//   updateStoreConnectionStatus,
//   updateStoreSettings,
//   saveConversation,
//   getConversation,
//   getConversations,
//   getConversationCount,
//   updateConversation,
//   closeConversation,
//   assignConversation,
//   markConversationRead,
//   saveMessage,
//   getMessages,
//   markMessageDelivered,
//   markMessageRead,
//   markMessageFailed,
//   createEmployee,
//   getEmployeeByEmail,
//   getEmployeeById,
//   getAllEmployees,
//   updateEmployee,
//   deleteEmployee,
//   updateEmployeeStatus,
//   logAgentActivity,
//   logWebhook,
//   getCannedResponses,
//   createCannedResponse,
//   getTemplatesByUserId,
//   getTemplateById,
//   createTemplate,
//   updateTemplate,
//   deleteTemplate,
//   getDashboardStats,
//   getStoreMetrics,
// };




const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  max: 50,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
  allowExitOnIdle: false, 
});

pool.on('error', (err) => {
  console.error('Unexpected database pool error:', err);
});

function parseMessageFileData(message) {
  if (!message) return message;
  if (message.file_data && typeof message.file_data === 'string') {
    try {
      message.file_data = JSON.parse(message.file_data);
    } catch (error) {
      console.error('Failed to parse file_data:', error);
      message.file_data = null;
    }
  }
  return message;
}

async function initDatabase() {
  const client = await pool.connect();
  
  try {
    console.log('🔄 Checking database initialization...');
    
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
        timezone VARCHAR(50) DEFAULT 'UTC',
        currency VARCHAR(3) DEFAULT 'USD',
        logo_url TEXT,
        primary_color VARCHAR(7) DEFAULT '#667eea',
        contact_email VARCHAR(255),
        support_team VARCHAR(255),
        store_tags TEXT[],
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
        customer_email VARCHAR(255) NOT NULL,
        customer_name VARCHAR(255),
        customer_id VARCHAR(255),
        customer_phone VARCHAR(50),
        status VARCHAR(50) DEFAULT 'open',
        priority VARCHAR(20) DEFAULT 'normal',
        assigned_to VARCHAR(255),
        tags TEXT[],
        first_message_at TIMESTAMP,
        last_message_at TIMESTAMP,
        last_customer_message_at TIMESTAMP,
        last_agent_message_at TIMESTAMP,
        agent_replied_at TIMESTAMPTZ,
        response_time_seconds INTEGER,
        customer_message_count INTEGER DEFAULT 0,
        agent_message_count INTEGER DEFAULT 0,
        total_message_count INTEGER DEFAULT 0,
        unread_count INTEGER DEFAULT 0,
        last_read_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        closed_at TIMESTAMP,
        archived_at TIMESTAMPTZ DEFAULT NULL
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
        sender_type VARCHAR(50) NOT NULL,
        sender_name VARCHAR(255),
        sender_id VARCHAR(255),
        content TEXT NOT NULL,
        message_type VARCHAR(50) DEFAULT 'text',
        attachment_url TEXT,
        attachment_type VARCHAR(50),
        sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        delivered_at TIMESTAMP,
        read_at TIMESTAMP,
        failed BOOLEAN DEFAULT false,
        retry_count INTEGER DEFAULT 0,
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
        password_hash TEXT NOT NULL,
        api_token TEXT UNIQUE,
        last_login TIMESTAMP,
        can_view_all_stores BOOLEAN DEFAULT true,
        assigned_stores INTEGER[],
        is_active BOOLEAN DEFAULT true,
        is_online BOOLEAN DEFAULT false,
        current_status VARCHAR(50) DEFAULT 'offline',
        total_conversations_handled INTEGER DEFAULT 0,
        average_response_time_seconds INTEGER DEFAULT 0,
        customer_satisfaction_score DECIMAL(3,2),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    // ============================================
    // BLACKLIST TABLE (created upfront for fresh installs)
    // ============================================
    await client.query(`
      CREATE TABLE IF NOT EXISTS blacklist (
        id               SERIAL PRIMARY KEY,
        email            VARCHAR(320) NOT NULL,
        store_identifier VARCHAR(255) DEFAULT NULL,
        reason           TEXT         DEFAULT NULL,
        customer_name    VARCHAR(255) DEFAULT NULL,
        blocked_by       VARCHAR(255) DEFAULT NULL,
        created_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
        removed_at       TIMESTAMPTZ  DEFAULT NULL,
        CONSTRAINT blacklist_unique_email_store
          UNIQUE NULLS NOT DISTINCT (email, store_identifier)
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
    // MESSAGE TEMPLATES TABLE
    // ============================================
    await client.query(`
      CREATE TABLE IF NOT EXISTS message_templates (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        content TEXT NOT NULL,
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
        total_conversations INTEGER DEFAULT 0,
        new_conversations INTEGER DEFAULT 0,
        closed_conversations INTEGER DEFAULT 0,
        total_messages INTEGER DEFAULT 0,
        customer_messages INTEGER DEFAULT 0,
        agent_messages INTEGER DEFAULT 0,
        average_response_time_seconds INTEGER,
        average_resolution_time_seconds INTEGER,
        first_response_time_seconds INTEGER,
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
      CREATE INDEX IF NOT EXISTS idx_stores_identifier ON stores(store_identifier);
      CREATE INDEX IF NOT EXISTS idx_stores_domain ON stores(shop_domain);
      CREATE INDEX IF NOT EXISTS idx_stores_active ON stores(is_active) WHERE is_active = true;
      
      CREATE INDEX IF NOT EXISTS idx_conversations_shop ON conversations(shop_id);
      CREATE INDEX IF NOT EXISTS idx_conversations_domain ON conversations(shop_domain);
      CREATE INDEX IF NOT EXISTS idx_conversations_status ON conversations(status);
      CREATE INDEX IF NOT EXISTS idx_conversations_customer_email ON conversations(customer_email);
      CREATE INDEX IF NOT EXISTS idx_conversations_assigned ON conversations(assigned_to);
      CREATE INDEX IF NOT EXISTS idx_conversations_updated ON conversations(updated_at DESC);
      CREATE INDEX IF NOT EXISTS idx_conversations_priority ON conversations(priority);
      CREATE INDEX IF NOT EXISTS idx_conversations_agent_replied ON conversations(agent_replied_at) WHERE agent_replied_at IS NOT NULL;
      CREATE INDEX IF NOT EXISTS idx_conversations_archived_at ON conversations(archived_at) WHERE archived_at IS NOT NULL;
      
      CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id);
      CREATE INDEX IF NOT EXISTS idx_messages_shop ON messages(shop_id);
      CREATE INDEX IF NOT EXISTS idx_messages_timestamp ON messages(timestamp DESC);
      CREATE INDEX IF NOT EXISTS idx_messages_sender_type ON messages(sender_type);
      
      CREATE INDEX IF NOT EXISTS idx_employees_email ON employees(email);
      CREATE INDEX IF NOT EXISTS idx_employees_api_token ON employees(api_token);
      CREATE INDEX IF NOT EXISTS idx_employees_active ON employees(is_active) WHERE is_active = true;
      
      CREATE INDEX IF NOT EXISTS idx_activity_employee ON agent_activity(employee_id);
      CREATE INDEX IF NOT EXISTS idx_activity_conversation ON agent_activity(conversation_id);
      CREATE INDEX IF NOT EXISTS idx_activity_created ON agent_activity(created_at DESC);
      
      CREATE INDEX IF NOT EXISTS idx_webhook_shop ON webhook_logs(shop_id);
      CREATE INDEX IF NOT EXISTS idx_webhook_received ON webhook_logs(received_at DESC);
      CREATE INDEX IF NOT EXISTS idx_webhook_processed ON webhook_logs(processed);
      
      CREATE INDEX IF NOT EXISTS idx_message_templates_user_id ON message_templates(user_id);
      CREATE INDEX IF NOT EXISTS idx_message_templates_created ON message_templates(created_at DESC);
      
      CREATE INDEX IF NOT EXISTS idx_analytics_shop_date ON analytics_daily(shop_id, date);

      CREATE INDEX IF NOT EXISTS idx_blacklist_email ON blacklist(email);
      CREATE INDEX IF NOT EXISTS idx_blacklist_store_identifier ON blacklist(store_identifier) WHERE store_identifier IS NOT NULL;
      CREATE INDEX IF NOT EXISTS idx_blacklist_active ON blacklist(email, store_identifier) WHERE removed_at IS NULL;
    `);
    
    console.log('✅ Database tables created successfully');
  } catch (error) {
    console.error('❌ Error initializing database:', error);
    throw error;
  } finally {
    client.release();
  }
}
async function runMigrations() {
  console.log('🔄 Running database migrations...');
  
  try {
    await migration_001_add_message_columns();
    await migration_002_add_conversation_metadata();
    await migration_003_add_unread_fields();
    await migration_004_add_last_message_fields();
    await migration_005_add_message_templates();
    await migration_006_add_file_data_column();
    await migration_007_add_email_notifications();
    await migration_008_add_conversation_notes();
    await migration_009_add_employee_notes();
    await migration_010_add_ai_training_brain();
    await migration_011_add_legal_flag_columns();
    await migration_012_add_agent_replied_at();
    await migration_013_add_blacklist_and_archive();
    await migration_014_add_auto_replied_at();
    await migration_015_add_notes_order();

    // ── Verify critical columns exist after migrations ──
    const { rows } = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'conversations' 
        AND column_name IN (
          'auto_replied_at',
          'archived_at',
          'agent_replied_at',
          'legal_flag',
          'unread_count',
          'last_message',
          'last_message_sender_type'
        )
      ORDER BY column_name
    `);
    const found = rows.map(r => r.column_name);
    const expected = [
      'agent_replied_at',
      'archived_at',
      'auto_replied_at',
      'last_message',
      'last_message_sender_type',
      'legal_flag',
      'unread_count',
    ];
    const missing = expected.filter(col => !found.includes(col));
    if (missing.length > 0) {
      console.error(`❌ [Migrations] Missing columns after migrations: ${missing.join(', ')}`);
    } else {
      console.log(`✅ [Migrations] All critical columns verified: ${found.join(', ')}`);
    }

    console.log('✅ All migrations completed successfully');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  }
}



async function migration_001_add_message_columns() {
  const client = await pool.connect();
  try {
    console.log('📝 [Migration 001] Checking messages table schema...');
    const currentColumns = await client.query(`
      SELECT column_name FROM information_schema.columns WHERE table_name = 'messages'
    `);
    const existingColumns = currentColumns.rows.map(row => row.column_name);
    console.log('   Current columns:', existingColumns.join(', '));
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
    for (const column of requiredColumns) {
      if (!existingColumns.includes(column.name)) {
        console.log(`   Adding column: ${column.name}...`);
        await client.query(`ALTER TABLE messages ADD COLUMN ${column.name} ${column.sql};`);
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

async function migration_002_add_conversation_metadata() {
  const client = await pool.connect();
  try {
    console.log('📝 [Migration 002] Adding cart_subtotal and source columns...');
    const currentColumns = await client.query(`
      SELECT column_name FROM information_schema.columns WHERE table_name = 'conversations'
    `);
    const existingColumns = currentColumns.rows.map(row => row.column_name);
    const columnsAdded = [];
    if (!existingColumns.includes('cart_subtotal')) {
      await client.query(`ALTER TABLE conversations ADD COLUMN cart_subtotal DECIMAL(10, 2) DEFAULT 0;`);
      columnsAdded.push('cart_subtotal');
    }
    if (!existingColumns.includes('source')) {
      await client.query(`ALTER TABLE conversations ADD COLUMN source VARCHAR(100);`);
      columnsAdded.push('source');
    }
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_conversations_source ON conversations(source);
      CREATE INDEX IF NOT EXISTS idx_conversations_cart_subtotal ON conversations(cart_subtotal);
    `);
    if (columnsAdded.length > 0) {
      console.log(`✅ [Migration 002] Added ${columnsAdded.length} columns: ${columnsAdded.join(', ')}`);
    } else {
      console.log('⏭️  [Migration 002] All columns already exist, skipping');
    }
  } catch (error) {
    console.error('❌ [Migration 002] Failed:', error);
    throw error;
  } finally {
    client.release();
  }
}

async function migration_003_add_unread_fields() {
  const client = await pool.connect();
  try {
    console.log('📝 [Migration 003] Adding unread fields...');
    await client.query(`ALTER TABLE conversations ADD COLUMN IF NOT EXISTS unread_count INTEGER DEFAULT 0;`);
    await client.query(`ALTER TABLE conversations ADD COLUMN IF NOT EXISTS last_read_at TIMESTAMP;`);
    console.log('✅ [Migration 003] Completed');
  } catch (error) {
    console.error('❌ [Migration 003] Failed:', error);
    throw error;
  } finally {
    client.release();
  }
}

async function migration_004_add_last_message_fields() {
  const client = await pool.connect();
  try {
    console.log('📝 [Migration 004] Adding last message tracking fields...');
    const currentColumns = await client.query(`
      SELECT column_name FROM information_schema.columns WHERE table_name = 'conversations'
    `);
    const existingColumns = currentColumns.rows.map(row => row.column_name);
    const columnsAdded = [];
    if (!existingColumns.includes('last_message')) {
      await client.query(`ALTER TABLE conversations ADD COLUMN last_message TEXT;`);
      columnsAdded.push('last_message');
    }
    if (!existingColumns.includes('last_message_sender_type')) {
      await client.query(`ALTER TABLE conversations ADD COLUMN last_message_sender_type VARCHAR(50);`);
      columnsAdded.push('last_message_sender_type');
    }
    if (!existingColumns.includes('last_message_at')) {
      await client.query(`ALTER TABLE conversations ADD COLUMN last_message_at TIMESTAMP;`);
      columnsAdded.push('last_message_at');
    }
    console.log('   Populating existing conversations with last messages...');
    await client.query(`
      UPDATE conversations c
      SET 
        last_message = m.content,
        last_message_sender_type = m.sender_type,
        last_message_at = m.timestamp
      FROM (
        SELECT DISTINCT ON (conversation_id)
          conversation_id, content, sender_type, timestamp
        FROM messages
        ORDER BY conversation_id, timestamp DESC
      ) m
      WHERE c.id = m.conversation_id;
    `);
    if (columnsAdded.length > 0) {
      console.log(`✅ [Migration 004] Added ${columnsAdded.length} columns: ${columnsAdded.join(', ')}`);
    } else {
      console.log('⏭️  [Migration 004] All columns already exist, skipping');
    }
    console.log('✅ [Migration 004] Completed');
  } catch (error) {
    console.error('❌ [Migration 004] Failed:', error);
    throw error;
  } finally {
    client.release();
  }
}

async function migration_005_add_message_templates() {
  const client = await pool.connect();
  try {
    console.log('📝 [Migration 005] Adding message_templates table...');
    const tableCheck = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'message_templates'
      );
    `);
    if (tableCheck.rows[0].exists) {
      console.log('⏭️  [Migration 005] message_templates table already exists, skipping');
      return;
    }
    await client.query(`
      CREATE TABLE message_templates (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        content TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    await client.query(`
      CREATE INDEX idx_message_templates_user_id ON message_templates(user_id);
      CREATE INDEX idx_message_templates_created ON message_templates(created_at DESC);
    `);
    await client.query(`
      CREATE OR REPLACE FUNCTION update_message_templates_updated_at()
      RETURNS TRIGGER AS $$
      BEGIN
        NEW.updated_at = CURRENT_TIMESTAMP;
        RETURN NEW;
      END;
      $$ language 'plpgsql';
      
      CREATE TRIGGER trigger_message_templates_updated_at 
        BEFORE UPDATE ON message_templates 
        FOR EACH ROW 
        EXECUTE FUNCTION update_message_templates_updated_at();
    `);
    console.log('✅ [Migration 005] message_templates table created successfully');
  } catch (error) {
    console.error('❌ [Migration 005] Failed:', error);
    throw error;
  } finally {
    client.release();
  }
}

async function migration_006_add_file_data_column() {
  const client = await pool.connect();
  try {
    console.log('📝 [Migration 006] Adding file_data column to messages table...');
    const currentColumns = await client.query(`
      SELECT column_name FROM information_schema.columns WHERE table_name = 'messages'
    `);
    const existingColumns = currentColumns.rows.map(row => row.column_name);
    if (!existingColumns.includes('file_data')) {
      await client.query(`ALTER TABLE messages ADD COLUMN file_data JSONB;`);
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_messages_file_data 
        ON messages(file_data) 
        WHERE file_data IS NOT NULL;
      `);
      console.log('✅ [Migration 006] file_data column added successfully');
    } else {
      console.log('⏭️  [Migration 006] file_data column already exists, skipping');
    }
  } catch (error) {
    console.error('❌ [Migration 006] Failed:', error);
    throw error;
  } finally {
    client.release();
  }
}

async function migration_007_add_email_notifications() {
  const client = await pool.connect();
  try {
    console.log('📝 [Migration 007] Adding email notification support...');
    const storeColumns = await client.query(`
      SELECT column_name FROM information_schema.columns WHERE table_name = 'stores'
    `);
    const existing = storeColumns.rows.map(r => r.column_name);
    const added = [];
    if (!existing.includes('email_from_name')) {
      await client.query(`ALTER TABLE stores ADD COLUMN email_from_name VARCHAR(255)`);
      added.push('email_from_name');
    }
    if (!existing.includes('email_from_address')) {
      await client.query(`ALTER TABLE stores ADD COLUMN email_from_address VARCHAR(255)`);
      added.push('email_from_address');
    }
    if (!existing.includes('email_brand_color')) {
      await client.query(`ALTER TABLE stores ADD COLUMN email_brand_color VARCHAR(7)`);
      added.push('email_brand_color');
    }
    if (added.length > 0) {
      console.log(`   Added store columns: ${added.join(', ')}`);
    } else {
      console.log('   Store email columns already exist');
    }
    const presenceExists = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'customer_presence'
      )
    `);
    if (!presenceExists.rows[0].exists) {
      await client.query(`
        CREATE TABLE customer_presence (
          id SERIAL PRIMARY KEY,
          conversation_id INTEGER NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
          customer_email VARCHAR(255) NOT NULL,
          store_id INTEGER REFERENCES stores(id) ON DELETE CASCADE,
          status VARCHAR(20) NOT NULL DEFAULT 'offline',
          last_activity_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          last_heartbeat_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          ws_connected BOOLEAN NOT NULL DEFAULT FALSE,
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          UNIQUE(conversation_id)
        )
      `);
      await client.query(`CREATE INDEX idx_presence_conv ON customer_presence(conversation_id)`);
      await client.query(`CREATE INDEX idx_presence_status ON customer_presence(status)`);
      console.log('   Created customer_presence table');
    } else {
      console.log('   customer_presence table already exists');
    }
    const emailLogExists = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'offline_email_log'
      )
    `);
    if (!emailLogExists.rows[0].exists) {
      await client.query(`
        CREATE TABLE offline_email_log (
          id SERIAL PRIMARY KEY,
          conversation_id INTEGER NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
          message_id INTEGER NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
          customer_email VARCHAR(255) NOT NULL,
          resend_id VARCHAR(100),
          sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          UNIQUE(message_id)
        )
      `);
      await client.query(`CREATE INDEX idx_email_log_conv ON offline_email_log(conversation_id, sent_at DESC)`);
      console.log('   Created offline_email_log table');
    } else {
      console.log('   offline_email_log table already exists');
    }
    console.log('✅ [Migration 007] Email notification support added');
  } catch (error) {
    console.error('❌ [Migration 007] Failed:', error);
    throw error;
  } finally {
    client.release();
  }
}

async function migration_008_add_conversation_notes() {
  const client = await pool.connect();
  try {
    console.log('📝 [Migration 008] Adding conversation_notes support...');
    const tableExists = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'conversation_notes'
      )
    `);
    if (tableExists.rows[0].exists) {
      console.log('⏭️  [Migration 008] conversation_notes table already exists, skipping');
      return;
    }
    await client.query(`
      CREATE TABLE conversation_notes (
        id SERIAL PRIMARY KEY,
        conversation_id INTEGER NOT NULL,
        employee_id INTEGER NOT NULL,
        employee_name VARCHAR(255) NOT NULL,
        content TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT fk_conversation_notes_conversation
          FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
        CONSTRAINT fk_conversation_notes_employee
          FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE
      )
    `);
    await client.query(`
      CREATE INDEX idx_conversation_notes_conversation_id ON conversation_notes(conversation_id);
      CREATE INDEX idx_conversation_notes_employee_id ON conversation_notes(employee_id);
      CREATE INDEX idx_conversation_notes_created_at ON conversation_notes(created_at DESC);
      CREATE INDEX idx_conversation_notes_lookup ON conversation_notes(conversation_id, employee_id, created_at DESC);
    `);
    await client.query(`
      CREATE OR REPLACE FUNCTION update_conversation_notes_updated_at()
      RETURNS TRIGGER AS $$
      BEGIN
        NEW.updated_at = CURRENT_TIMESTAMP;
        RETURN NEW;
      END;
      $$ language 'plpgsql';
      
      CREATE TRIGGER trigger_conversation_notes_updated_at 
        BEFORE UPDATE ON conversation_notes 
        FOR EACH ROW 
        EXECUTE FUNCTION update_conversation_notes_updated_at();
    `);
    console.log('✅ [Migration 008] Conversation notes support added successfully');
  } catch (error) {
    console.error('❌ [Migration 008] Failed:', error);
    throw error;
  } finally {
    client.release();
  }
}

async function migration_009_add_employee_notes() {
  const migrationName = 'Migration 009';
  try {
    const tableCheck = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'employee_notes'
      );
    `);
    if (tableCheck.rows[0].exists) {
      console.log(`✅ [${migrationName}] employee_notes table already exists`);
      const titleColumnCheck = await pool.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.columns 
          WHERE table_schema = 'public' AND table_name = 'employee_notes' AND column_name = 'title'
        );
      `);
      if (!titleColumnCheck.rows[0].exists) {
        console.log(`🔄 [${migrationName}] Adding title column...`);
        await pool.query(`ALTER TABLE employee_notes ADD COLUMN title VARCHAR(200) DEFAULT 'Untitled';`);
        console.log(`✅ [${migrationName}] Title column added`);
      }
      return;
    }
    console.log(`🔄 [${migrationName}] Creating employee_notes table...`);
    await pool.query(`
      CREATE TABLE employee_notes (
        id SERIAL PRIMARY KEY,
        employee_id INTEGER NOT NULL,
        employee_name VARCHAR(255) NOT NULL,
        title VARCHAR(200) DEFAULT 'Untitled',
        content TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE
      );
    `);
    await pool.query(`
      CREATE INDEX idx_employee_notes_employee_id ON employee_notes(employee_id);
      CREATE INDEX idx_employee_notes_created_at ON employee_notes(created_at);
      CREATE INDEX idx_employee_notes_title ON employee_notes(title);
    `);
    await pool.query(`
      CREATE OR REPLACE FUNCTION update_employee_notes_updated_at()
      RETURNS TRIGGER AS $$
      BEGIN
        NEW.updated_at = CURRENT_TIMESTAMP;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;

      CREATE TRIGGER trigger_employee_notes_updated_at
        BEFORE UPDATE ON employee_notes
        FOR EACH ROW
        EXECUTE FUNCTION update_employee_notes_updated_at();
    `);
    console.log(`✅ [${migrationName}] Employee notes table created with title support`);
  } catch (error) {
    console.error(`❌ [${migrationName}] Failed:`, error);
    throw error;
  }
}

async function migration_010_add_ai_training_brain() {
  const migrationName = 'Migration 010';
  try {
    const tableCheck = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'ai_training_brain'
      );
    `);
    if (tableCheck.rows[0].exists) {
      console.log(`✅ [${migrationName}] ai_training_brain table already exists`);
      return;
    }
    console.log(`🔄 [${migrationName}] Creating ai_training_brain table...`);
    await pool.query(`
      CREATE TABLE ai_training_brain (
        id          INTEGER PRIMARY KEY DEFAULT 1,
        brain_data  JSONB NOT NULL DEFAULT '{}',
        updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_by  TEXT,
        CONSTRAINT single_row CHECK (id = 1)
      );
    `);
    await pool.query(`
      INSERT INTO ai_training_brain (id, brain_data)
      VALUES (1, '{}')
      ON CONFLICT DO NOTHING;
    `);
    console.log(`✅ [${migrationName}] ai_training_brain table created`);
  } catch (error) {
    console.error(`❌ [${migrationName}] Failed:`, error);
    throw error;
  }
}

async function migration_011_add_legal_flag_columns() {
  const migrationName = 'Migration 011';
  try {
    console.log(`📝 [${migrationName}] Adding legal flag columns to conversations...`);
    await pool.query(`
      ALTER TABLE conversations
        ADD COLUMN IF NOT EXISTS legal_flag          BOOLEAN      DEFAULT FALSE,
        ADD COLUMN IF NOT EXISTS legal_flag_severity VARCHAR(20),
        ADD COLUMN IF NOT EXISTS legal_flag_at       TIMESTAMPTZ,
        ADD COLUMN IF NOT EXISTS legal_flag_term     VARCHAR(100);
    `);
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_conversations_legal_flag
        ON conversations(legal_flag)
        WHERE legal_flag = TRUE;
    `);
    console.log(`✅ [${migrationName}] Legal flag columns added`);
  } catch (error) {
    console.error(`❌ [${migrationName}] Failed:`, error);
    throw error;
  }
}

async function migration_012_add_agent_replied_at() {
  const migrationName = 'Migration 012';
  try {
    console.log(`📝 [${migrationName}] Adding agent_replied_at column to conversations...`);
    await pool.query(`
      ALTER TABLE conversations
        ADD COLUMN IF NOT EXISTS agent_replied_at TIMESTAMPTZ;
    `);
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_conversations_agent_replied
        ON conversations(agent_replied_at)
        WHERE agent_replied_at IS NOT NULL;
    `);
    await pool.query(`
      UPDATE conversations c
      SET agent_replied_at = first_agent.first_reply
      FROM (
        SELECT conversation_id, MIN(timestamp) AS first_reply
        FROM messages
        WHERE sender_type = 'agent'
        GROUP BY conversation_id
      ) first_agent
      WHERE c.id = first_agent.conversation_id
        AND c.agent_replied_at IS NULL;
    `);
    console.log(`✅ [${migrationName}] agent_replied_at column added and back-filled`);
  } catch (error) {
    console.error(`❌ [${migrationName}] Failed:`, error);
    throw error;
  }
}

// ── NEW ──────────────────────────────────────────────────────────────────────
async function migration_013_add_blacklist_and_archive() {
  const migrationName = 'Migration 013';
  try {
    console.log(`📝 [${migrationName}] Adding blacklist table and archived_at column...`);

    // 1. archived_at on conversations
    await pool.query(`
      ALTER TABLE conversations
        ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ DEFAULT NULL;
    `);
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_conversations_archived_at
        ON conversations(archived_at)
        WHERE archived_at IS NOT NULL;
    `);

    // 2. blacklist table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS blacklist (
        id               SERIAL PRIMARY KEY,
        email            VARCHAR(320) NOT NULL,
        store_identifier VARCHAR(255) DEFAULT NULL,
        reason           TEXT         DEFAULT NULL,
        customer_name    VARCHAR(255) DEFAULT NULL,
        blocked_by       VARCHAR(255) DEFAULT NULL,
        created_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
        removed_at       TIMESTAMPTZ  DEFAULT NULL,
        CONSTRAINT blacklist_unique_email_store
          UNIQUE NULLS NOT DISTINCT (email, store_identifier)
      );
    `);

    // 3. indexes on blacklist (IF NOT EXISTS is safe to re-run)
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_blacklist_email
        ON blacklist(email);
      CREATE INDEX IF NOT EXISTS idx_blacklist_store_identifier
        ON blacklist(store_identifier)
        WHERE store_identifier IS NOT NULL;
      CREATE INDEX IF NOT EXISTS idx_blacklist_active
        ON blacklist(email, store_identifier)
        WHERE removed_at IS NULL;
    `);

    console.log(`✅ [${migrationName}] blacklist table and archived_at column ready`);
  } catch (error) {
    console.error(`❌ [${migrationName}] Failed:`, error);
    throw error;
  }
}

async function migration_014_add_auto_replied_at() {
  const migrationName = 'Migration 014';
  try {
    console.log(`📝 [${migrationName}] Adding auto_replied_at to conversations...`);
    await pool.query(`
      ALTER TABLE conversations
        ADD COLUMN IF NOT EXISTS auto_replied_at TIMESTAMPTZ DEFAULT NULL;
    `);
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_conversations_auto_replied_at
        ON conversations(auto_replied_at)
        WHERE auto_replied_at IS NOT NULL;
    `);
    console.log(`✅ [${migrationName}] auto_replied_at column added`);
  } catch (error) {
    console.error(`❌ [${migrationName}] Failed:`, error);
    throw error;
  }
}

async function migration_015_add_notes_order() {
  const migrationName = 'Migration 015';
  try {
    console.log(`📝 [${migrationName}] Adding notes_order column to employees...`);
    await pool.query(`
      ALTER TABLE employees
        ADD COLUMN IF NOT EXISTS notes_order JSONB DEFAULT '[]';
    `);
    console.log(`✅ [${migrationName}] notes_order column added`);
  } catch (error) {
    console.error(`❌ [${migrationName}] Failed:`, error);
    throw error;
  }
}
// ── END NEW ───────────────────────────────────────────────────────────────────

// ============================================
// STORE FUNCTIONS
// ============================================

async function registerStore(storeData) {
  const {
    store_identifier, shop_domain, brand_name, access_token, api_key,
    api_secret, scope, timezone = 'UTC', currency = 'USD', logo_url,
    primary_color = '#667eea', contact_email, store_tags = []
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
        shop_domain = $2, brand_name = $3, access_token = $4, api_key = $5,
        api_secret = $6, scope = $7, timezone = $8, currency = $9,
        logo_url = $10, primary_color = $11, contact_email = $12,
        store_tags = $13, updated_at = NOW()
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
    const result = await pool.query(
      `UPDATE stores SET ${fields.join(', ')} WHERE id = $${paramCount} RETURNING *`,
      values
    );
    return result.rows[0];
  } catch (error) {
    console.error('Error updating store settings:', error);
    throw error;
  }
}

// ============================================
// CONVERSATION FUNCTIONS
// ============================================

async function saveConversation(data) {
  const {
    store_id, store_identifier, customer_email, customer_name, customer_id,
    customer_phone, status = 'open', priority = 'normal', tags = [],
    cart_subtotal = 0, source = 'website'
  } = data;
  try {
    const result = await pool.query(`
      INSERT INTO conversations (
        shop_id, shop_domain, customer_email, customer_name, customer_id,
        customer_phone, status, priority, tags, cart_subtotal, source, 
        created_at, updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW(), NOW())
      RETURNING *
    `, [
      store_id, store_identifier, customer_email, customer_name, customer_id,
      customer_phone, status, priority, tags, cart_subtotal, source
    ]);
    return result.rows[0];
  } catch (error) {
    console.error('Error saving conversation:', error);
    throw error;
  }
}

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
//     if (filters.customerEmail) {
//       query += ` AND c.customer_email = $${paramCount}`;
//       params.push(filters.customerEmail);
//       paramCount++;
//     }
//     if (filters.status) {
//       query += ` AND c.status = $${paramCount}`;
//       params.push(filters.status);
//       paramCount++;
//     }
//     // When no explicit status filter is set, exclude archived from the main inbox.
//     // Pass excludeArchived: true from server.js GET /api/conversations.
//     if (!filters.status && filters.excludeArchived) {
//       query += ` AND c.status != 'archived'`;
//     }
//     if (filters.priority) {
//       query += ` AND c.priority = $${paramCount}`;
//       params.push(filters.priority);
//       paramCount++;
//     }
//     if (filters.assignedTo) {
//       query += ` AND c.assigned_to = $${paramCount}`;
//       params.push(filters.assignedTo);
//       paramCount++;
//     }
//     if (filters.search) {
//       query += ` AND (c.customer_email ILIKE $${paramCount} OR c.customer_name ILIKE $${paramCount})`;
//       params.push(`%${filters.search}%`);
//       paramCount++;
//     }
    
//     const limit = filters.limit;
//     const offset = filters.offset || 0;
//     if (limit) {
//       query += ` ORDER BY c.updated_at DESC LIMIT $${paramCount} OFFSET $${paramCount + 1}`;
//       params.push(limit, offset);
//     } else {
//       query += ` ORDER BY c.updated_at DESC`;
//     }
    
//     const result = await pool.query(query, params);
//     return result.rows;
//   } catch (error) {
//     console.error('Error fetching conversations:', error);
//     throw error;
//   }
// }

async function getConversations(filters = {}) {
  try {
let query = `
  SELECT c.*, s.brand_name, s.logo_url, s.primary_color, s.store_identifier,
    (SELECT content FROM messages 
     WHERE conversation_id = c.id 
       AND sender_type = 'customer'
     ORDER BY id DESC LIMIT 1) AS last_customer_message
  FROM conversations c 
  JOIN stores s ON c.shop_id = s.id 
  WHERE 1=1
`;
    const params = [];
    let paramCount = 1;
    
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
    if (filters.customerEmail) {
      query += ` AND c.customer_email = $${paramCount}`;
      params.push(filters.customerEmail);
      paramCount++;
    }
    if (filters.status) {
      query += ` AND c.status = $${paramCount}`;
      params.push(filters.status);
      paramCount++;
    }
    if (!filters.status && filters.excludeArchived) {
      query += ` AND c.status != 'archived'`;
    }
    if (filters.priority) {
      query += ` AND c.priority = $${paramCount}`;
      params.push(filters.priority);
      paramCount++;
    }
    if (filters.assignedTo) {
      query += ` AND c.assigned_to = $${paramCount}`;
      params.push(filters.assignedTo);
      paramCount++;
    }
    if (filters.search) {
      query += ` AND (c.customer_email ILIKE $${paramCount} OR c.customer_name ILIKE $${paramCount})`;
      params.push(`%${filters.search}%`);
      paramCount++;
    }
    
    const limit = filters.limit;
    const offset = filters.offset || 0;
    if (limit) {
      query += ` ORDER BY c.updated_at DESC LIMIT $${paramCount} OFFSET $${paramCount + 1}`;
      params.push(limit, offset);
    } else {
      query += ` ORDER BY c.updated_at DESC`;
    }
    
    const result = await pool.query(query, params);
    return result.rows;
  } catch (error) {
    console.error('Error fetching conversations:', error);
    throw error;
  }
}

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
    const result = await pool.query(
      `UPDATE conversations SET ${fields.join(', ')} WHERE id = $${paramCount} RETURNING *`,
      values
    );
    return result.rows[0];
  } catch (error) {
    console.error('Error updating conversation:', error);
    throw error;
  }
}

async function closeConversation(conversationId) {
  try {
    const result = await pool.query(`
      UPDATE conversations 
      SET status = 'closed', closed_at = NOW(), updated_at = NOW() 
      WHERE id = $1 RETURNING *
    `, [conversationId]);
    return result.rows[0];
  } catch (error) {
    console.error('Error closing conversation:', error);
    throw error;
  }
}

async function assignConversation(conversationId, employeeEmail) {
  try {
    const result = await pool.query(`
      UPDATE conversations SET assigned_to = $1, updated_at = NOW() WHERE id = $2 RETURNING *
    `, [employeeEmail, conversationId]);
    return result.rows[0];
  } catch (error) {
    console.error('Error assigning conversation:', error);
    throw error;
  }
}

async function markConversationRead(conversationId) {
  try {
    await pool.query(`
      UPDATE conversations
      SET unread_count = 0, last_read_at = NOW(), updated_at = NOW()
      WHERE id = $1
    `, [conversationId]);
  } catch (error) {
    console.error('Error marking conversation read:', error);
    throw error;
  }
}

// ============================================
// MESSAGE FUNCTIONS
// ============================================

async function saveMessage(data) {
  const {
    conversation_id, store_id, sender_type, sender_name, sender_id,
    content, message_type = 'text', attachment_url, attachment_type, file_data
  } = data;
  
  console.log('💾 [saveMessage] Called with:', {
    conversation_id, sender_type, sender_name,
    content: content?.substring(0, 30), hasFileData: !!file_data
  });
  
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    const messageResult = await client.query(`
      INSERT INTO messages (
        conversation_id, shop_id, sender_type, sender_name, sender_id,
        content, message_type, attachment_url, attachment_type, 
        file_data, sent_at, timestamp
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), NOW())
      RETURNING *
    `, [
      conversation_id, store_id, sender_type, sender_name, sender_id,
      content, message_type, attachment_url, attachment_type, file_data
    ]);
    
    const message = messageResult.rows[0];
    console.log('✅ [saveMessage] Message inserted, id:', message.id);
    
    const updateFields = [
      'total_message_count = total_message_count + 1',
      'last_message_at = NOW()',
      'updated_at = NOW()',
      'last_message = $2',
      'last_message_sender_type = $3'
    ];
    
    if (sender_type === 'customer') {
      updateFields.push('customer_message_count = customer_message_count + 1');
      updateFields.push('last_customer_message_at = NOW()');
      updateFields.push('unread_count = unread_count + 1');
      // Auto-reply rate limit: max once per 8 hours per conversation.
      // Keep auto_replied_at set if the last one was within 8h — cron will skip.
      // Reset to NULL only if it's been 8h+ since last auto-reply (or never sent).
      updateFields.push(`
        auto_replied_at = CASE
          WHEN auto_replied_at IS NULL
            OR auto_replied_at < NOW() - INTERVAL '8 hours'
          THEN NULL
          ELSE auto_replied_at
        END
      `);
    } else if (sender_type === 'agent') {
      updateFields.push('agent_message_count = agent_message_count + 1');
      updateFields.push('last_agent_message_at = NOW()');
      updateFields.push('agent_replied_at = COALESCE(agent_replied_at, NOW())');
      updateFields.push(`
        response_time_seconds = CASE 
          WHEN last_agent_message_at IS NULL AND first_message_at IS NOT NULL
          THEN EXTRACT(EPOCH FROM (NOW() - first_message_at))::INTEGER
          ELSE response_time_seconds
        END
      `);
    }
    
    updateFields.push(`first_message_at = COALESCE(first_message_at, NOW())`);
    
    await client.query(`
      UPDATE conversations 
      SET ${updateFields.join(', ')}
      WHERE id = $1
    `, [conversation_id, content, sender_type]);
    
    console.log('✅ [saveMessage] Conversation updated successfully');
    
    await client.query('COMMIT');
    return parseMessageFileData(message);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ [saveMessage] Error:', error);
    throw error;
  } finally {
    client.release();
  }
}

// async function saveMessage(data) {
//   const {
//     conversation_id, store_id, sender_type, sender_name, sender_id,
//     content, message_type = 'text', attachment_url, attachment_type, file_data
//   } = data;
  
//   console.log('💾 [saveMessage] Called with:', {
//     conversation_id, sender_type, sender_name,
//     content: content?.substring(0, 30), hasFileData: !!file_data
//   });
  
//   const client = await pool.connect();
  
//   try {
//     await client.query('BEGIN');
    
//     const messageResult = await client.query(`
//       INSERT INTO messages (
//         conversation_id, shop_id, sender_type, sender_name, sender_id,
//         content, message_type, attachment_url, attachment_type, 
//         file_data, sent_at, timestamp
//       )
//       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), NOW())
//       RETURNING *
//     `, [
//       conversation_id, store_id, sender_type, sender_name, sender_id,
//       content, message_type, attachment_url, attachment_type, file_data
//     ]);
    
//     const message = messageResult.rows[0];
//     console.log('✅ [saveMessage] Message inserted, id:', message.id);
    
//     const updateFields = [
//       'total_message_count = total_message_count + 1',
//       'last_message_at = NOW()',
//       'updated_at = NOW()',
//       'last_message = $2',
//       'last_message_sender_type = $3'
//     ];
    
//     if (sender_type === 'customer') {
//       updateFields.push('customer_message_count = customer_message_count + 1');
//       updateFields.push('last_customer_message_at = NOW()');
//       updateFields.push('unread_count = unread_count + 1');
//        updateFields.push('auto_replied_at = NULL');
//     } else if (sender_type === 'agent') {
//       updateFields.push('agent_message_count = agent_message_count + 1');
//       updateFields.push('last_agent_message_at = NOW()');
//       updateFields.push('agent_replied_at = COALESCE(agent_replied_at, NOW())');
//       updateFields.push(`
//         response_time_seconds = CASE 
//           WHEN last_agent_message_at IS NULL AND first_message_at IS NOT NULL
//           THEN EXTRACT(EPOCH FROM (NOW() - first_message_at))::INTEGER
//           ELSE response_time_seconds
//         END
//       `);
//     }
    
//     updateFields.push(`first_message_at = COALESCE(first_message_at, NOW())`);
    
//     await client.query(`
//       UPDATE conversations 
//       SET ${updateFields.join(', ')}
//       WHERE id = $1
//     `, [conversation_id, content, sender_type]);
    
//     console.log('✅ [saveMessage] Conversation updated successfully');
    
//     await client.query('COMMIT');
//     return parseMessageFileData(message);
//   } catch (error) {
//     await client.query('ROLLBACK');
//     console.error('❌ [saveMessage] Error:', error);
//     throw error;
//   } finally {
//     client.release();
//   }
// }

async function getMessages(conversationId, limit = 100) {
  try {
    const result = await pool.query(
      'SELECT * FROM messages WHERE conversation_id = $1 ORDER BY timestamp ASC LIMIT $2',
      [conversationId, limit]
    );
    return result.rows.map(parseMessageFileData);
  } catch (error) {
    console.error('Error fetching messages:', error);
    throw error;
  }
}

async function markMessageDelivered(messageId) {
  try {
    await pool.query('UPDATE messages SET delivered_at = NOW() WHERE id = $1', [messageId]);
  } catch (error) {
    console.error('Error marking message delivered:', error);
  }
}

async function markMessageRead(messageId) {
  try {
    await pool.query('UPDATE messages SET read_at = NOW() WHERE id = $1', [messageId]);
  } catch (error) {
    console.error('Error marking message read:', error);
  }
}

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

async function createEmployee(data) {
  const {
    email, name, password_hash, role = 'agent',
    can_view_all_stores = true, assigned_stores = []
  } = data;
  try {
    if (!email || !name) throw new Error('Email and name are required');
    if (!password_hash) throw new Error('password_hash is required');
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

async function getEmployeeByEmail(email) {
  try {
    const result = await pool.query(
      'SELECT * FROM employees WHERE email = $1 AND is_active = true', [email]
    );
    return result.rows[0] || null;
  } catch (error) {
    console.error('Error fetching employee:', error);
    throw error;
  }
}

async function getEmployeeById(id) {
  try {
    const result = await pool.query(
      'SELECT * FROM employees WHERE id = $1 AND is_active = true', [id]
    );
    return result.rows[0] || null;
  } catch (error) {
    console.error('Error fetching employee:', error);
    throw error;
  }
}

async function getAllEmployees() {
  try {
    const result = await pool.query('SELECT * FROM employees ORDER BY created_at DESC');
    return result.rows;
  } catch (error) {
    console.error('Error fetching all employees:', error);
    throw error;
  }
}

async function updateEmployee(employeeId, updates) {
  try {
    const fields = [];
    const values = [];
    let paramCount = 1;
    const allowedFields = ['name', 'email', 'role', 'password_hash', 'is_active', 
                          'can_view_all_stores', 'assigned_stores', 'last_login', 'is_online'];
    Object.entries(updates).forEach(([key, value]) => {
      if (allowedFields.includes(key)) {
        fields.push(`${key} = $${paramCount}`);
        values.push(value);
        paramCount++;
      }
    });
    if (fields.length === 0) throw new Error('No valid fields to update');
    fields.push(`updated_at = NOW()`);
    values.push(employeeId);
    const result = await pool.query(
      `UPDATE employees SET ${fields.join(', ')} WHERE id = $${paramCount} RETURNING *`,
      values
    );
    return result.rows[0];
  } catch (error) {
    console.error('Error updating employee:', error);
    throw error;
  }
}

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

async function updateEmployeeStatus(employeeId, status) {
  try {
    if (typeof status === 'object') {
      const updates = {};
      if (status.last_login) updates.last_login = status.last_login;
      if (status.is_online !== undefined) updates.is_online = status.is_online;
      if (status.current_status) updates.current_status = status.current_status;
      return await updateEmployee(employeeId, updates);
    } else {
      await pool.query(
        'UPDATE employees SET current_status = $1, is_online = $2, updated_at = NOW() WHERE id = $3',
        [status, status === 'online', employeeId]
      );
    }
  } catch (error) {
    console.error('Error updating employee status:', error);
  }
}

async function updateEmployeeNotesOrder(employeeId, order) {
  try {
    const result = await pool.query(
      `UPDATE employees SET notes_order = $1, updated_at = NOW() WHERE id = $2 RETURNING notes_order`,
      [JSON.stringify(order), employeeId]
    );
    return result.rows[0];
  } catch (error) {
    console.error('Error updating employee notes order:', error);
    throw error;
  }
}

async function logAgentActivity(data) {
  const { employee_id, conversation_id, store_id, action, action_data } = data;
  try {
    await pool.query(`
      INSERT INTO agent_activity (employee_id, conversation_id, shop_id, action, action_data, created_at)
      VALUES ($1, $2, $3, $4, $5, NOW())
    `, [employee_id, conversation_id, store_id, action, action_data]);
  } catch (error) {
    console.error('Error logging agent activity:', error);
  }
}

// ============================================
// WEBHOOK FUNCTIONS
// ============================================

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

async function getCannedResponses(storeId) {
  try {
    const result = await pool.query(
      'SELECT * FROM canned_responses WHERE shop_id = $1 ORDER BY category, title', [storeId]
    );
    return result.rows;
  } catch (error) {
    console.error('Error fetching canned responses:', error);
    throw error;
  }
}

async function createCannedResponse(data) {
  const { store_id, title, content, shortcut, category, created_by } = data;
  try {
    const result = await pool.query(`
      INSERT INTO canned_responses (shop_id, title, content, shortcut, category, created_by, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW()) RETURNING *
    `, [store_id, title, content, shortcut, category, created_by]);
    return result.rows[0];
  } catch (error) {
    console.error('Error creating canned response:', error);
    throw error;
  }
}

// ============================================
// MESSAGE TEMPLATE FUNCTIONS
// ============================================

async function getTemplatesByUserId(userId) {
  try {
    const result = await pool.query(
      `SELECT id, user_id, name, content, created_at, updated_at 
       FROM message_templates WHERE user_id = $1 ORDER BY created_at DESC`,
      [userId]
    );
    return result.rows;
  } catch (error) {
    console.error('Error fetching templates:', error);
    throw error;
  }
}

async function getTemplateById(templateId) {
  try {
    const result = await pool.query(
      `SELECT id, user_id, name, content, created_at, updated_at FROM message_templates WHERE id = $1`,
      [templateId]
    );
    return result.rows[0] || null;
  } catch (error) {
    console.error('Error fetching template:', error);
    throw error;
  }
}

async function createTemplate({ user_id, name, content }) {
  try {
    const result = await pool.query(
      `INSERT INTO message_templates (user_id, name, content) 
       VALUES ($1, $2, $3) 
       RETURNING id, user_id, name, content, created_at, updated_at`,
      [user_id, name, content]
    );
    return result.rows[0];
  } catch (error) {
    console.error('Error creating template:', error);
    throw error;
  }
}

async function updateTemplate(templateId, { name, content }) {
  try {
    const result = await pool.query(
      `UPDATE message_templates SET name = $1, content = $2, updated_at = CURRENT_TIMESTAMP 
       WHERE id = $3 RETURNING id, user_id, name, content, created_at, updated_at`,
      [name, content, templateId]
    );
    return result.rows[0];
  } catch (error) {
    console.error('Error updating template:', error);
    throw error;
  }
}

async function deleteTemplate(templateId) {
  try {
    await pool.query('DELETE FROM message_templates WHERE id = $1', [templateId]);
    return { success: true };
  } catch (error) {
    console.error('Error deleting template:', error);
    throw error;
  }
}

// ============================================
// ANALYTICS FUNCTIONS
// ============================================

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
      WHERE c.status != 'archived' ${storeFilter}
    `, params);
    return result.rows[0];
  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    throw error;
  }
}

async function getStoreMetrics(storeId, days = 30) {
  try {
    const result = await pool.query(`
      SELECT date, total_conversations, new_conversations, closed_conversations,
             total_messages, average_response_time_seconds
      FROM analytics_daily
      WHERE shop_id = $1 AND date >= CURRENT_DATE - INTERVAL '${days} days'
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

async function closePool() {
  await pool.end();
}

// ============================================
// EXPORTS
// ============================================

module.exports = {
  pool,
  initDatabase,
  runMigrations,
  testConnection,
  closePool,
  registerStore,
  getStoreByIdentifier,
  getStoreByDomain,
  getStoreById,
  getAllActiveStores,
  updateStoreConnectionStatus,
  updateStoreSettings,
  saveConversation,
  getConversation,
  getConversations,
  getConversationCount,
  updateConversation,
  closeConversation,
  assignConversation,
  markConversationRead,
  saveMessage,
  getMessages,
  markMessageDelivered,
  markMessageRead,
  markMessageFailed,
  createEmployee,
  getEmployeeByEmail,
  getEmployeeById,
  getAllEmployees,
  updateEmployee,
  deleteEmployee,
  updateEmployeeStatus,
  logAgentActivity,
  logWebhook,
  getCannedResponses,
  createCannedResponse,
  getTemplatesByUserId,
  getTemplateById,
  createTemplate,
  updateTemplate,
  deleteTemplate,
  getDashboardStats,
  getStoreMetrics,
  updateEmployeeNotesOrder,
};