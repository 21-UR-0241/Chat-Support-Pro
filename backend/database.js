
// // ============================================================================
// // database.js — Chat Support Pro
// // ============================================================================
// // KEY CHANGES vs previous version:
// //  1. Two pools. `pool` (app traffic) keeps statement_timeout: 15s. DDL,
// //     backfills and rollups run on a short-lived `maintenancePool()` with
// //     statement_timeout: 0 — a 15s cap was killing migrations and index builds,
// //     which threw, which made startServer() process.exit(1) → boot loop.
// //  2. keepAlive: true. Without TCP keepalive, idle sockets get silently reaped
// //     between the app and the DB and the next checkout throws
// //     "Connection terminated unexpectedly".
// //  3. schema_migrations ledger + advisory lock. Migrations run ONCE, ever, on
// //     ONE instance. Previously migration_004 rewrote the whole conversations
// //     table on every single boot.
// //  4. refreshResponseStats: 21-day window, upsert instead of DELETE-all,
// //     runs on the maintenance pool under an advisory lock.
// //  5. testConnection() now throws instead of swallowing. The old version
// //     returned false, which made /health's catch block dead code.
// //  6. Trigram/GIN search indexes moved OUT of the boot path — see
// //     scripts/build-search-indexes.js. They take minutes and can never
// //     complete under a 15s statement_timeout.
// // ============================================================================

// const { Pool } = require('pg');
// require('dotenv').config();

// const CONNECTION_STRING = process.env.DATABASE_URL;
// const IS_LOCAL_OR_INTERNAL = /\.internal|localhost|127\.0\.0\.1/.test(CONNECTION_STRING || '');
// const SSL_CONFIG = IS_LOCAL_OR_INTERNAL ? false : { rejectUnauthorized: false };

// // ── Advisory lock IDs (arbitrary but must be stable and unique per job) ──
// const LOCKS = {
//   MIGRATIONS:        915001,
//   RESPONSE_STATS:    915002,
//   PRESENCE_CLEANUP:  915003,
//   AUTO_REPLY:        915004,
//   DISCORD_HOURLY:    915005,
//   DISCORD_DAILY:     915006,
//   BRAIN_PRUNE:       915007,
//   PERF_INDEXES:      915008,
//   SEARCH_INDEXES:    915009,
// };

// // ============================================================================
// // POOLS
// // ============================================================================

// const pool = new Pool({
//   connectionString: CONNECTION_STRING,
//   ssl: SSL_CONFIG,
//   max: Number(process.env.PG_MAX || 20),
//   min: 0,
//   idleTimeoutMillis: 10_000,          // release fast; poolers reap aggressively
//   connectionTimeoutMillis: 20_000,    // room for a cold start
//   statement_timeout: 15_000,          // app queries only — never DDL
//   query_timeout: 20_000,              // client-side guard for dead sockets
//   keepAlive: true,
//   keepAliveInitialDelayMillis: 10_000,
//   application_name: 'csp-web',
//   allowExitOnIdle: false,
// });

// pool.on('error', (err) => {
//   // Idle-client errors MUST be handled or they become uncaught rejections.
//   console.error('[pg] idle client error:', err.message);
// });

// /**
//  * Short-lived pool with NO statement timeout. For migrations, index builds and
//  * heavy rollups. Always end() it when finished.
//  */
// function maintenancePool() {
//   const cs = process.env.DIRECT_DATABASE_URL || CONNECTION_STRING;
//   const internal = /\.internal|localhost|127\.0\.0\.1/.test(cs);
//   return new Pool({
//     connectionString: cs,
//     ssl: internal ? false : { rejectUnauthorized: false },
//     max: 2,
//     statement_timeout: 0,
//     query_timeout: 0,
//     idleTimeoutMillis: 5_000,
//     connectionTimeoutMillis: 30_000,
//     keepAlive: true,
//     keepAliveInitialDelayMillis: 10_000,
//     application_name: 'csp-maintenance',
//     allowExitOnIdle: true,
//   });
// }

// async function withMaintenance(fn) {
//   const mp = maintenancePool();
//   mp.on('error', (e) => console.error('[pg-maint] idle client error:', e.message));
//   try {
//     return await fn(mp);
//   } finally {
//     await mp.end().catch(() => {});
//   }
// }

// /**
//  * Run fn while holding a session-level advisory lock. Returns
//  * { skipped: true } if another instance already holds it.
//  */
// async function withAdvisoryLock(db, lockId, fn) {
//   const client = await db.connect();
//   try {
//     const { rows } = await client.query('SELECT pg_try_advisory_lock($1) AS got', [lockId]);
//     if (!rows[0].got) return { skipped: true };
//     try {
//       const result = await fn(client);
//       return { skipped: false, result };
//     } finally {
//       await client.query('SELECT pg_advisory_unlock($1)', [lockId]).catch(() => {});
//     }
//   } finally {
//     client.release();
//   }
// }

// function getPoolStats() {
//   return { total: pool.totalCount, idle: pool.idleCount, waiting: pool.waitingCount, max: pool.options.max };
// }

// // ============================================================================
// // HELPERS
// // ============================================================================

// function parseMessageFileData(message) {
//   if (!message) return message;
//   if (message.file_data && typeof message.file_data === 'string') {
//     try {
//       message.file_data = JSON.parse(message.file_data);
//     } catch (error) {
//       console.error('Failed to parse file_data:', error.message);
//       message.file_data = null;
//     }
//   }
//   return message;
// }

// // ============================================================================
// // SCHEMA BOOTSTRAP
// // ============================================================================

// async function initDatabase() {
//   return withMaintenance(async (mp) => {
//     console.log('🔄 Checking database initialization...');

//     const tablesCheck = await mp.query(`
//       SELECT table_name
//         FROM information_schema.tables
//        WHERE table_schema = 'public'
//          AND table_name IN ('stores', 'conversations', 'messages', 'employees')
//     `);

//     if (tablesCheck.rows.length > 0) {
//       console.log('✅ Database tables already exist, skipping initialization');
//       return;
//     }

//     console.log('📝 Creating database tables...');

//     await mp.query(`
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
//         timezone VARCHAR(50) DEFAULT 'UTC',
//         currency VARCHAR(3) DEFAULT 'USD',
//         logo_url TEXT,
//         primary_color VARCHAR(7) DEFAULT '#667eea',
//         contact_email VARCHAR(255),
//         support_team VARCHAR(255),
//         store_tags TEXT[],
//         store_group VARCHAR(100),
//         store_group_name VARCHAR(150),
//         auto_reply_enabled BOOLEAN DEFAULT false,
//         business_hours JSONB,
//         widget_settings JSONB
//       )
//     `);

//     await mp.query(`
//       CREATE TABLE IF NOT EXISTS conversations (
//         id SERIAL PRIMARY KEY,
//         shop_id INTEGER REFERENCES stores(id) ON DELETE CASCADE,
//         shop_domain VARCHAR(255) NOT NULL,
//         customer_email VARCHAR(255) NOT NULL,
//         customer_name VARCHAR(255),
//         customer_id VARCHAR(255),
//         customer_phone VARCHAR(50),
//         status VARCHAR(50) DEFAULT 'open',
//         priority VARCHAR(20) DEFAULT 'normal',
//         assigned_to VARCHAR(255),
//         tags TEXT[],
//         first_message_at TIMESTAMP,
//         last_message_at TIMESTAMP,
//         last_customer_message_at TIMESTAMP,
//         last_agent_message_at TIMESTAMP,
//         agent_replied_at TIMESTAMPTZ,
//         response_time_seconds INTEGER,
//         customer_message_count INTEGER DEFAULT 0,
//         agent_message_count INTEGER DEFAULT 0,
//         total_message_count INTEGER DEFAULT 0,
//         unread_count INTEGER DEFAULT 0,
//         last_read_at TIMESTAMP,
//         created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
//         updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
//         closed_at TIMESTAMP,
//         archived_at TIMESTAMPTZ DEFAULT NULL
//       )
//     `);

//     await mp.query(`
//       CREATE TABLE IF NOT EXISTS messages (
//         id SERIAL PRIMARY KEY,
//         conversation_id INTEGER REFERENCES conversations(id) ON DELETE CASCADE,
//         shop_id INTEGER REFERENCES stores(id) ON DELETE CASCADE,
//         sender_type VARCHAR(50) NOT NULL,
//         sender_name VARCHAR(255),
//         sender_id VARCHAR(255),
//         content TEXT NOT NULL,
//         message_type VARCHAR(50) DEFAULT 'text',
//         attachment_url TEXT,
//         attachment_type VARCHAR(50),
//         sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
//         delivered_at TIMESTAMP,
//         read_at TIMESTAMP,
//         failed BOOLEAN DEFAULT false,
//         retry_count INTEGER DEFAULT 0,
//         routed_successfully BOOLEAN DEFAULT true,
//         routing_error TEXT,
//         timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
//       )
//     `);

//     await mp.query(`
//       CREATE TABLE IF NOT EXISTS employees (
//         id SERIAL PRIMARY KEY,
//         email VARCHAR(255) UNIQUE NOT NULL,
//         name VARCHAR(255) NOT NULL,
//         employee_name VARCHAR(255),
//         role VARCHAR(50) DEFAULT 'agent',
//         password_hash TEXT NOT NULL,
//         api_token TEXT UNIQUE,
//         last_login TIMESTAMP,
//         can_view_all_stores BOOLEAN DEFAULT true,
//         assigned_stores INTEGER[],
//         is_active BOOLEAN DEFAULT true,
//         is_online BOOLEAN DEFAULT false,
//         current_status VARCHAR(50) DEFAULT 'offline',
//         total_conversations_handled INTEGER DEFAULT 0,
//         average_response_time_seconds INTEGER DEFAULT 0,
//         customer_satisfaction_score DECIMAL(3,2),
//         created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
//         updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
//       )
//     `);

//     await mp.query(`
//       CREATE TABLE IF NOT EXISTS blacklist (
//         id               SERIAL PRIMARY KEY,
//         email            VARCHAR(320) NOT NULL,
//         store_identifier VARCHAR(255) DEFAULT NULL,
//         reason           TEXT         DEFAULT NULL,
//         customer_name    VARCHAR(255) DEFAULT NULL,
//         blocked_by       VARCHAR(255) DEFAULT NULL,
//         created_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
//         removed_at       TIMESTAMPTZ  DEFAULT NULL,
//         CONSTRAINT blacklist_unique_email_store
//           UNIQUE NULLS NOT DISTINCT (email, store_identifier)
//       )
//     `);

//     await mp.query(`
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

//     await mp.query(`
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

//     await mp.query(`
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

//     await mp.query(`
//       CREATE TABLE IF NOT EXISTS message_templates (
//         id SERIAL PRIMARY KEY,
//         user_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
//         name VARCHAR(255) NOT NULL,
//         content TEXT NOT NULL,
//         created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
//         updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
//       )
//     `);

//     await mp.query(`
//       CREATE TABLE IF NOT EXISTS analytics_daily (
//         id SERIAL PRIMARY KEY,
//         shop_id INTEGER REFERENCES stores(id) ON DELETE CASCADE,
//         date DATE NOT NULL,
//         total_conversations INTEGER DEFAULT 0,
//         new_conversations INTEGER DEFAULT 0,
//         closed_conversations INTEGER DEFAULT 0,
//         total_messages INTEGER DEFAULT 0,
//         customer_messages INTEGER DEFAULT 0,
//         agent_messages INTEGER DEFAULT 0,
//         average_response_time_seconds INTEGER,
//         average_resolution_time_seconds INTEGER,
//         first_response_time_seconds INTEGER,
//         unique_customers INTEGER DEFAULT 0,
//         returning_customers INTEGER DEFAULT 0,
//         created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
//         UNIQUE(shop_id, date)
//       )
//     `);

//     await mp.query(`
//       CREATE INDEX IF NOT EXISTS idx_stores_identifier ON stores(store_identifier);
//       CREATE INDEX IF NOT EXISTS idx_stores_domain ON stores(shop_domain);
//       CREATE INDEX IF NOT EXISTS idx_stores_active ON stores(is_active) WHERE is_active = true;

//       CREATE INDEX IF NOT EXISTS idx_conversations_shop ON conversations(shop_id);
//       CREATE INDEX IF NOT EXISTS idx_conversations_domain ON conversations(shop_domain);
//       CREATE INDEX IF NOT EXISTS idx_conversations_status ON conversations(status);
//       CREATE INDEX IF NOT EXISTS idx_conversations_customer_email ON conversations(customer_email);
//       CREATE INDEX IF NOT EXISTS idx_conversations_assigned ON conversations(assigned_to);
//       CREATE INDEX IF NOT EXISTS idx_conversations_updated ON conversations(updated_at DESC);
//       CREATE INDEX IF NOT EXISTS idx_conversations_priority ON conversations(priority);

//       CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id);
//       CREATE INDEX IF NOT EXISTS idx_messages_shop ON messages(shop_id);
//       CREATE INDEX IF NOT EXISTS idx_messages_timestamp ON messages(timestamp DESC);
//       CREATE INDEX IF NOT EXISTS idx_messages_sender_type ON messages(sender_type);

//       CREATE INDEX IF NOT EXISTS idx_employees_email ON employees(email);
//       CREATE INDEX IF NOT EXISTS idx_employees_api_token ON employees(api_token);
//       CREATE INDEX IF NOT EXISTS idx_employees_active ON employees(is_active) WHERE is_active = true;

//       CREATE INDEX IF NOT EXISTS idx_activity_employee ON agent_activity(employee_id);
//       CREATE INDEX IF NOT EXISTS idx_activity_conversation ON agent_activity(conversation_id);
//       CREATE INDEX IF NOT EXISTS idx_activity_created ON agent_activity(created_at DESC);

//       CREATE INDEX IF NOT EXISTS idx_webhook_shop ON webhook_logs(shop_id);
//       CREATE INDEX IF NOT EXISTS idx_webhook_received ON webhook_logs(received_at DESC);
//       CREATE INDEX IF NOT EXISTS idx_webhook_processed ON webhook_logs(processed);

//       CREATE INDEX IF NOT EXISTS idx_message_templates_user_id ON message_templates(user_id);
//       CREATE INDEX IF NOT EXISTS idx_message_templates_created ON message_templates(created_at DESC);

//       CREATE INDEX IF NOT EXISTS idx_analytics_shop_date ON analytics_daily(shop_id, date);

//       CREATE INDEX IF NOT EXISTS idx_blacklist_email ON blacklist(email);
//       CREATE INDEX IF NOT EXISTS idx_blacklist_store_identifier ON blacklist(store_identifier) WHERE store_identifier IS NOT NULL;
//       CREATE INDEX IF NOT EXISTS idx_blacklist_active ON blacklist(email, store_identifier) WHERE removed_at IS NULL;
//     `);

//     console.log('✅ Database tables created successfully');
//   });
// }

// // ============================================================================
// // MIGRATION RUNNER — ledger + advisory lock, runs each step ONCE ever
// // ============================================================================

// const MIGRATIONS = [
//   ['001_message_columns',        migration_001_add_message_columns],
//   ['002_conversation_metadata',  migration_002_add_conversation_metadata],
//   ['003_unread_fields',          migration_003_add_unread_fields],
//   ['004_last_message_fields',    migration_004_add_last_message_fields],
//   ['005_message_templates',      migration_005_add_message_templates],
//   ['006_file_data_column',       migration_006_add_file_data_column],
//   ['007_email_notifications',    migration_007_add_email_notifications],
//   ['008_conversation_notes',     migration_008_add_conversation_notes],
//   ['009_employee_notes',         migration_009_add_employee_notes],
//   ['010_ai_training_brain',      migration_010_add_ai_training_brain],
//   ['011_legal_flag_columns',     migration_011_add_legal_flag_columns],
//   ['012_agent_replied_at',       migration_012_add_agent_replied_at],
//   ['013_blacklist_and_archive',  migration_013_add_blacklist_and_archive],
//   ['014_auto_replied_at',        migration_014_add_auto_replied_at],
//   ['015_notes_order',            migration_015_add_notes_order],
//   ['016_employee_name',          migration_016_add_employee_name],
//   ['017_promo_tables',           migration_017_add_promo_tables],
//   ['018_performance_indexes',    migration_018_add_performance_indexes],
//   ['019_response_stats_rollup',  migration_019_add_response_stats_rollup],
//   ['020_group_columns',          migration_020_add_group_columns],
//   ['021_store_groups_table',     migration_021_add_store_groups_table],
//   ['022_group_color',            migration_022_add_group_color],
//   ['023_brain_backups',          migration_023_add_brain_backups],
//   ['024_last_message_at_index',  migration_024_last_message_at_index],
// ];

// async function runMigrations() {
//   return withMaintenance(async (mp) => {
//     await mp.query(`
//       CREATE TABLE IF NOT EXISTS schema_migrations (
//         name       TEXT PRIMARY KEY,
//         applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
//       )
//     `);

//     const outcome = await withAdvisoryLock(mp, LOCKS.MIGRATIONS, async () => {
//       const { rows } = await mp.query('SELECT name FROM schema_migrations');
//       const applied = new Set(rows.map(r => r.name));

//       let ran = 0, skipped = 0;
//       for (const [name, fn] of MIGRATIONS) {
//         if (applied.has(name)) { skipped++; continue; }
//         console.log(`📝 [${name}] applying...`);
//         await fn(mp);
//         await mp.query('INSERT INTO schema_migrations (name) VALUES ($1) ON CONFLICT DO NOTHING', [name]);
//         console.log(`✅ [${name}] applied`);
//         ran++;
//       }
//       console.log(`✅ Migrations: ${ran} applied, ${skipped} already present`);

//       // ── Verify critical columns ──
//       const { rows: cols } = await mp.query(`
//         SELECT column_name
//           FROM information_schema.columns
//          WHERE table_name = 'conversations'
//            AND column_name IN ('auto_replied_at','archived_at','agent_replied_at',
//                                'legal_flag','unread_count','last_message','last_message_sender_type')
//       `);
//       const found = cols.map(r => r.column_name);
//       const expected = ['agent_replied_at','archived_at','auto_replied_at','last_message',
//                         'last_message_sender_type','legal_flag','unread_count'];
//       const missing = expected.filter(c => !found.includes(c));
//       if (missing.length) console.error(`❌ [Migrations] Missing columns: ${missing.join(', ')}`);
//       else console.log('✅ [Migrations] All critical columns verified');
//     });

//     if (outcome.skipped) console.log('⏭️  [Migrations] Another instance holds the lock — skipping');
//   });
// }

// // ============================================================================
// // MIGRATIONS  (each receives the maintenance pool — no statement timeout)
// // ============================================================================

// async function migration_001_add_message_columns(db) {
//   const current = await db.query(
//     `SELECT column_name FROM information_schema.columns WHERE table_name = 'messages'`);
//   const existing = current.rows.map(r => r.column_name);
//   const required = [
//     { name: 'message_type',        sql: "VARCHAR(50) DEFAULT 'text'" },
//     { name: 'attachment_url',      sql: 'TEXT' },
//     { name: 'attachment_type',     sql: 'VARCHAR(50)' },
//     { name: 'sent_at',             sql: 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP' },
//     { name: 'delivered_at',        sql: 'TIMESTAMP' },
//     { name: 'read_at',             sql: 'TIMESTAMP' },
//     { name: 'failed',              sql: 'BOOLEAN DEFAULT false' },
//     { name: 'retry_count',         sql: 'INTEGER DEFAULT 0' },
//     { name: 'routed_successfully', sql: 'BOOLEAN DEFAULT true' },
//     { name: 'routing_error',       sql: 'TEXT' },
//   ];
//   for (const col of required) {
//     if (!existing.includes(col.name)) {
//       await db.query(`ALTER TABLE messages ADD COLUMN ${col.name} ${col.sql}`);
//     }
//   }
// }

// async function migration_002_add_conversation_metadata(db) {
//   await db.query(`ALTER TABLE conversations ADD COLUMN IF NOT EXISTS cart_subtotal DECIMAL(10,2) DEFAULT 0`);
//   await db.query(`ALTER TABLE conversations ADD COLUMN IF NOT EXISTS source VARCHAR(100)`);
//   await db.query(`CREATE INDEX IF NOT EXISTS idx_conversations_source ON conversations(source)`);
// }

// async function migration_003_add_unread_fields(db) {
//   await db.query(`ALTER TABLE conversations ADD COLUMN IF NOT EXISTS unread_count INTEGER DEFAULT 0`);
//   await db.query(`ALTER TABLE conversations ADD COLUMN IF NOT EXISTS last_read_at TIMESTAMP`);
// }

// // ⚠️ Contains a full-table backfill. This is the migration that was rewriting
// // the entire conversations table on every boot. Now runs exactly once.
// async function migration_004_add_last_message_fields(db) {
//   await db.query(`ALTER TABLE conversations ADD COLUMN IF NOT EXISTS last_message TEXT`);
//   await db.query(`ALTER TABLE conversations ADD COLUMN IF NOT EXISTS last_message_sender_type VARCHAR(50)`);
//   await db.query(`ALTER TABLE conversations ADD COLUMN IF NOT EXISTS last_message_at TIMESTAMP`);
//   console.log('   [004] backfilling last_message (one-time, may take a while)...');
//   await db.query(`
//     UPDATE conversations c
//        SET last_message = m.content,
//            last_message_sender_type = m.sender_type,
//            last_message_at = m.timestamp
//       FROM (
//         SELECT DISTINCT ON (conversation_id) conversation_id, content, sender_type, timestamp
//           FROM messages ORDER BY conversation_id, timestamp DESC
//       ) m
//      WHERE c.id = m.conversation_id
//        AND c.last_message IS NULL
//   `);
// }

// async function migration_005_add_message_templates(db) {
//   await db.query(`
//     CREATE TABLE IF NOT EXISTS message_templates (
//       id SERIAL PRIMARY KEY,
//       user_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
//       name VARCHAR(255) NOT NULL,
//       content TEXT NOT NULL,
//       created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
//       updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
//     )
//   `);
//   await db.query(`CREATE INDEX IF NOT EXISTS idx_message_templates_user_id ON message_templates(user_id)`);
//   await db.query(`CREATE INDEX IF NOT EXISTS idx_message_templates_created ON message_templates(created_at DESC)`);
//   await db.query(`
//     CREATE OR REPLACE FUNCTION update_message_templates_updated_at()
//     RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = CURRENT_TIMESTAMP; RETURN NEW; END; $$ LANGUAGE plpgsql
//   `);
//   await db.query(`DROP TRIGGER IF EXISTS trigger_message_templates_updated_at ON message_templates`);
//   await db.query(`
//     CREATE TRIGGER trigger_message_templates_updated_at
//       BEFORE UPDATE ON message_templates
//       FOR EACH ROW EXECUTE FUNCTION update_message_templates_updated_at()
//   `);
// }

// async function migration_006_add_file_data_column(db) {
//   await db.query(`ALTER TABLE messages ADD COLUMN IF NOT EXISTS file_data JSONB`);
// }

// async function migration_007_add_email_notifications(db) {
//   await db.query(`ALTER TABLE stores ADD COLUMN IF NOT EXISTS email_from_name VARCHAR(255)`);
//   await db.query(`ALTER TABLE stores ADD COLUMN IF NOT EXISTS email_from_address VARCHAR(255)`);
//   await db.query(`ALTER TABLE stores ADD COLUMN IF NOT EXISTS email_brand_color VARCHAR(7)`);

//   await db.query(`
//     CREATE TABLE IF NOT EXISTS customer_presence (
//       id SERIAL PRIMARY KEY,
//       conversation_id INTEGER NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
//       customer_email VARCHAR(255) NOT NULL,
//       store_id INTEGER REFERENCES stores(id) ON DELETE CASCADE,
//       status VARCHAR(20) NOT NULL DEFAULT 'offline',
//       last_activity_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
//       last_heartbeat_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
//       ws_connected BOOLEAN NOT NULL DEFAULT FALSE,
//       updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
//       UNIQUE(conversation_id)
//     )
//   `);
//   await db.query(`CREATE INDEX IF NOT EXISTS idx_presence_conv ON customer_presence(conversation_id)`);
//   // Partial index — the stale-cleanup job only ever scans non-offline rows.
//   await db.query(`
//     CREATE INDEX IF NOT EXISTS idx_presence_stale
//       ON customer_presence (last_heartbeat_at) WHERE status <> 'offline'
//   `);

//   await db.query(`
//     CREATE TABLE IF NOT EXISTS offline_email_log (
//       id SERIAL PRIMARY KEY,
//       conversation_id INTEGER NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
//       message_id INTEGER NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
//       customer_email VARCHAR(255) NOT NULL,
//       resend_id VARCHAR(100),
//       sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
//       UNIQUE(message_id)
//     )
//   `);
//   await db.query(`CREATE INDEX IF NOT EXISTS idx_email_log_conv ON offline_email_log(conversation_id, sent_at DESC)`);
// }

// async function migration_008_add_conversation_notes(db) {
//   await db.query(`
//     CREATE TABLE IF NOT EXISTS conversation_notes (
//       id SERIAL PRIMARY KEY,
//       conversation_id INTEGER NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
//       employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
//       employee_name VARCHAR(255) NOT NULL,
//       content TEXT NOT NULL,
//       created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
//       updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
//     )
//   `);
//   await db.query(`CREATE INDEX IF NOT EXISTS idx_conversation_notes_lookup
//                     ON conversation_notes(conversation_id, employee_id, created_at DESC)`);
// }

// async function migration_009_add_employee_notes(db) {
//   await db.query(`
//     CREATE TABLE IF NOT EXISTS employee_notes (
//       id SERIAL PRIMARY KEY,
//       employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
//       employee_name VARCHAR(255) NOT NULL,
//       title VARCHAR(200) DEFAULT 'Untitled',
//       content TEXT NOT NULL,
//       created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
//       updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
//     )
//   `);
//   await db.query(`ALTER TABLE employee_notes ADD COLUMN IF NOT EXISTS title VARCHAR(200) DEFAULT 'Untitled'`);
//   await db.query(`CREATE INDEX IF NOT EXISTS idx_employee_notes_employee_id ON employee_notes(employee_id)`);
//   await db.query(`CREATE INDEX IF NOT EXISTS idx_employee_notes_created_at ON employee_notes(created_at DESC)`);
// }

// async function migration_010_add_ai_training_brain(db) {
//   await db.query(`
//     CREATE TABLE IF NOT EXISTS ai_training_brain (
//       id         INTEGER PRIMARY KEY DEFAULT 1,
//       brain_data JSONB NOT NULL DEFAULT '{}',
//       updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
//       updated_by TEXT,
//       CONSTRAINT single_row CHECK (id = 1)
//     )
//   `);
//   await db.query(`INSERT INTO ai_training_brain (id, brain_data) VALUES (1, '{}') ON CONFLICT DO NOTHING`);
// }

// async function migration_011_add_legal_flag_columns(db) {
//   await db.query(`
//     ALTER TABLE conversations
//       ADD COLUMN IF NOT EXISTS legal_flag          BOOLEAN DEFAULT FALSE,
//       ADD COLUMN IF NOT EXISTS legal_flag_severity VARCHAR(20),
//       ADD COLUMN IF NOT EXISTS legal_flag_at       TIMESTAMPTZ,
//       ADD COLUMN IF NOT EXISTS legal_flag_term     VARCHAR(100)
//   `);
//   await db.query(`CREATE INDEX IF NOT EXISTS idx_conversations_legal_flag
//                     ON conversations(legal_flag) WHERE legal_flag = TRUE`);
// }

// // ⚠️ Contains a backfill — one-time only.
// async function migration_012_add_agent_replied_at(db) {
//   await db.query(`ALTER TABLE conversations ADD COLUMN IF NOT EXISTS agent_replied_at TIMESTAMPTZ`);
//   await db.query(`CREATE INDEX IF NOT EXISTS idx_conversations_agent_replied
//                     ON conversations(agent_replied_at) WHERE agent_replied_at IS NOT NULL`);
//   console.log('   [012] backfilling agent_replied_at (one-time)...');
//   await db.query(`
//     UPDATE conversations c
//        SET agent_replied_at = fa.first_reply
//       FROM (SELECT conversation_id, MIN(timestamp) AS first_reply
//               FROM messages WHERE sender_type = 'agent' GROUP BY conversation_id) fa
//      WHERE c.id = fa.conversation_id AND c.agent_replied_at IS NULL
//   `);
// }

// async function migration_013_add_blacklist_and_archive(db) {
//   await db.query(`ALTER TABLE conversations ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ DEFAULT NULL`);
//   await db.query(`CREATE INDEX IF NOT EXISTS idx_conv_archived_at
//                     ON conversations (archived_at DESC NULLS LAST) WHERE status = 'archived'`);
//   await db.query(`
//     CREATE TABLE IF NOT EXISTS blacklist (
//       id               SERIAL PRIMARY KEY,
//       email            VARCHAR(320) NOT NULL,
//       store_identifier VARCHAR(255) DEFAULT NULL,
//       reason           TEXT         DEFAULT NULL,
//       customer_name    VARCHAR(255) DEFAULT NULL,
//       blocked_by       VARCHAR(255) DEFAULT NULL,
//       created_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
//       removed_at       TIMESTAMPTZ  DEFAULT NULL,
//       CONSTRAINT blacklist_unique_email_store UNIQUE NULLS NOT DISTINCT (email, store_identifier)
//     )
//   `);
//   await db.query(`CREATE INDEX IF NOT EXISTS idx_blacklist_active
//                     ON blacklist(email, store_identifier) WHERE removed_at IS NULL`);
// }

// async function migration_014_add_auto_replied_at(db) {
//   await db.query(`ALTER TABLE conversations ADD COLUMN IF NOT EXISTS auto_replied_at TIMESTAMPTZ DEFAULT NULL`);
//   // Supports the auto-reply sweeper's candidate scan directly.
//   await db.query(`CREATE INDEX IF NOT EXISTS idx_conv_open_autoreply
//                     ON conversations (updated_at DESC) WHERE status = 'open'`);
// }

// async function migration_015_add_notes_order(db) {
//   await db.query(`ALTER TABLE employees ADD COLUMN IF NOT EXISTS notes_order JSONB DEFAULT '[]'`);
// }

// async function migration_016_add_employee_name(db) {
//   await db.query(`ALTER TABLE employees ADD COLUMN IF NOT EXISTS employee_name VARCHAR(255)`);
// }

// async function migration_017_add_promo_tables(db) {
//   await db.query(`
//     CREATE TABLE IF NOT EXISTS promo_unsubscribes (
//       id SERIAL PRIMARY KEY,
//       email TEXT NOT NULL UNIQUE,
//       unsubscribed_at TIMESTAMPTZ DEFAULT NOW()
//     )
//   `);
//   await db.query(`CREATE INDEX IF NOT EXISTS idx_promo_unsubscribes_email ON promo_unsubscribes (LOWER(email))`);
//   await db.query(`
//     CREATE TABLE IF NOT EXISTS promo_sent_emails (
//       id SERIAL PRIMARY KEY,
//       email TEXT NOT NULL,
//       store_domain TEXT NOT NULL DEFAULT '',
//       store_name TEXT,
//       discount_code TEXT,
//       sent_at TIMESTAMPTZ DEFAULT NOW()
//     )
//   `);
//   await db.query(`ALTER TABLE promo_sent_emails DROP CONSTRAINT IF EXISTS promo_sent_emails_email_key`).catch(() => {});
//   await db.query(`CREATE UNIQUE INDEX IF NOT EXISTS promo_sent_emails_email_store_uidx
//                     ON promo_sent_emails (LOWER(email), store_domain)`);
//   await db.query(`CREATE INDEX IF NOT EXISTS idx_promo_sent_emails_sent_at ON promo_sent_emails (sent_at DESC)`);
// }

// // Hot-path btree indexes. Safe to build here (fast relative to GIN), and this
// // runs on the maintenance pool so no statement timeout can kill them.
// async function migration_018_add_performance_indexes(db) {
//   const statements = [
//     `CREATE INDEX IF NOT EXISTS idx_messages_conv_customer_lastmsg
//        ON messages (conversation_id, id DESC) WHERE sender_type = 'customer'`,
//     `CREATE INDEX IF NOT EXISTS idx_messages_conv_id
//        ON messages (conversation_id, id DESC)`,
//     `CREATE INDEX IF NOT EXISTS idx_messages_unread_customer
//        ON messages (conversation_id) WHERE sender_type = 'customer' AND read_at IS NULL`,
//     `CREATE INDEX IF NOT EXISTS idx_messages_timestamp_shop
//        ON messages (timestamp DESC, shop_id)`,
//     `CREATE INDEX IF NOT EXISTS idx_messages_conv_sent
//        ON messages (conversation_id, sent_at DESC)`,
//     `CREATE INDEX IF NOT EXISTS idx_messages_agent_sent
//        ON messages (sender_id, sent_at DESC) WHERE sender_type = 'agent' AND sender_id IS NOT NULL`,
//     `CREATE INDEX IF NOT EXISTS idx_messages_sent_at
//        ON messages (sent_at DESC)`,
//     `CREATE INDEX IF NOT EXISTS idx_conv_status_updated
//        ON conversations (status, updated_at DESC)`,
//     `CREATE INDEX IF NOT EXISTS idx_conv_email_shop
//        ON conversations (customer_email, shop_id)`,
//   ];
//   for (const sql of statements) {
//     console.log(`   [018] ${sql.match(/idx_[a-z_]+/)[0]}`);
//     await db.query(sql);
//   }
// }

// async function migration_019_add_response_stats_rollup(db) {
//   await db.query(`
//     CREATE TABLE IF NOT EXISTS agent_response_stats (
//       sender_id               TEXT PRIMARY KEY,
//       avg_response_minutes    NUMERIC,
//       fastest_minutes         NUMERIC,
//       total_responses_counted INTEGER DEFAULT 0,
//       updated_at              TIMESTAMPTZ DEFAULT NOW()
//     )
//   `);
//   await db.query(`
//     CREATE TABLE IF NOT EXISTS agent_customer_response_stats (
//       sender_id      TEXT NOT NULL,
//       customer_email TEXT NOT NULL,
//       avg_minutes    NUMERIC,
//       response_count INTEGER DEFAULT 0,
//       updated_at     TIMESTAMPTZ DEFAULT NOW(),
//       PRIMARY KEY (sender_id, customer_email)
//     )
//   `);
//   await db.query(`ALTER TABLE agent_customer_response_stats
//                     ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW()`);
// }

// async function migration_020_add_group_columns(db) {
//   await db.query(`ALTER TABLE stores ADD COLUMN IF NOT EXISTS store_group VARCHAR(100) DEFAULT NULL`);
//   await db.query(`ALTER TABLE stores ADD COLUMN IF NOT EXISTS store_group_name VARCHAR(150) DEFAULT NULL`);
//   await db.query(`CREATE INDEX IF NOT EXISTS idx_stores_store_group
//                     ON stores(store_group) WHERE store_group IS NOT NULL`);
// }

// async function migration_021_add_store_groups_table(db) {
//   await db.query(`
//     CREATE TABLE IF NOT EXISTS store_groups (
//       id         SERIAL PRIMARY KEY,
//       group_key  VARCHAR(100) UNIQUE NOT NULL,
//       group_name VARCHAR(150) NOT NULL,
//       created_at TIMESTAMPTZ DEFAULT NOW(),
//       updated_at TIMESTAMPTZ DEFAULT NOW()
//     )
//   `);
//   const backfill = await db.query(`
//     INSERT INTO store_groups (group_key, group_name)
//     SELECT DISTINCT ON (store_group) store_group, COALESCE(store_group_name, store_group)
//       FROM stores WHERE store_group IS NOT NULL
//      ORDER BY store_group, updated_at DESC
//     ON CONFLICT (group_key) DO NOTHING
//   `);
//   console.log(`   [021] backfilled ${backfill.rowCount} group(s)`);
// }

// async function migration_022_add_group_color(db) {
//   await db.query(`ALTER TABLE store_groups ADD COLUMN IF NOT EXISTS color VARCHAR(7) DEFAULT '#667eea'`);
// }

// // server.js prunes this table on an interval; make sure it exists so the
// // prune job stops swallowing "relation does not exist".
// async function migration_023_add_brain_backups(db) {
//   await db.query(`
//     CREATE TABLE IF NOT EXISTS ai_training_brain_backups (
//       id           SERIAL PRIMARY KEY,
//       brain_data   JSONB NOT NULL,
//       backed_up_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
//       backed_up_by TEXT
//     )
//   `);
//   await db.query(`CREATE INDEX IF NOT EXISTS idx_brain_backups_at
//                     ON ai_training_brain_backups (backed_up_at DESC)`);
// }


// async function migration_024_last_message_at_index(db) {
//   await db.query(`CREATE INDEX IF NOT EXISTS idx_conversations_last_message_at
//                     ON conversations (last_message_at DESC)`);
// }

// // ============================================================================
// // SEARCH INDEXES — build out of band. See scripts/build-search-indexes.js
// // ============================================================================

// const SEARCH_INDEX_STATEMENTS = [
//   `CREATE EXTENSION IF NOT EXISTS pg_trgm`,
//   `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_messages_content_trgm
//      ON messages USING gin (content gin_trgm_ops)`,
//   `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_conv_email_trgm
//      ON conversations USING gin (customer_email gin_trgm_ops)`,
//   `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_conv_name_trgm
//      ON conversations USING gin (customer_name gin_trgm_ops)`,
// ];

// /**
//  * Builds the trigram search indexes with CONCURRENTLY (no exclusive lock, safe
//  * on live traffic) and no statement timeout. Can take many minutes. Idempotent.
//  */
// async function buildSearchIndexes() {
//   return withMaintenance(async (mp) => {
//     const outcome = await withAdvisoryLock(mp, LOCKS.SEARCH_INDEXES, async (client) => {
//       for (const sql of SEARCH_INDEX_STATEMENTS) {
//         const label = (sql.match(/idx_[a-z_]+/) || ['pg_trgm extension'])[0];
//         const t0 = Date.now();
//         process.stdout.write(`   building ${label} ... `);
//         try {
//           await client.query(sql);
//           console.log(`done in ${Math.round((Date.now() - t0) / 1000)}s`);
//         } catch (e) {
//           // An INVALID index can be left behind if a CONCURRENTLY build is
//           // interrupted; report it so it can be dropped and retried.
//           console.log(`FAILED: ${e.message}`);
//         }
//       }
//     });
//     if (outcome.skipped) console.log('⏭️  Search index build already running elsewhere');
//   });
// }

// /** Reports whether the search indexes exist and are valid. */
// async function checkSearchIndexes() {
//   const { rows } = await pool.query(`
//     SELECT c.relname AS index_name, i.indisvalid AS valid
//       FROM pg_class c
//       JOIN pg_index i ON i.indexrelid = c.oid
//      WHERE c.relname IN ('idx_messages_content_trgm','idx_conv_email_trgm','idx_conv_name_trgm')
//   `);
//   return rows;
// }

// // ============================================================================
// // STORE FUNCTIONS
// // ============================================================================

// async function registerStore(storeData) {
//   const {
//     store_identifier, shop_domain, brand_name, access_token, api_key,
//     api_secret, scope, timezone = 'UTC', currency = 'USD', logo_url,
//     primary_color = '#667eea', contact_email, store_tags = [],
//     store_group = null, store_group_name = null,
//   } = storeData;
//   const result = await pool.query(`
//     INSERT INTO stores (
//       store_identifier, shop_domain, brand_name, access_token, api_key,
//       api_secret, scope, timezone, currency, logo_url, primary_color,
//       contact_email, store_tags, store_group, store_group_name, installed_at, updated_at
//     )
//     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,NOW(),NOW())
//     ON CONFLICT (store_identifier) DO UPDATE SET
//       shop_domain = $2, brand_name = $3, access_token = $4, api_key = $5,
//       api_secret = $6, scope = $7, timezone = $8, currency = $9,
//       logo_url = $10, primary_color = $11, contact_email = $12, store_tags = $13,
//       store_group = COALESCE(stores.store_group, $14),
//       store_group_name = COALESCE(stores.store_group_name, $15),
//       updated_at = NOW()
//     RETURNING *
//   `, [store_identifier, shop_domain, brand_name, access_token, api_key, api_secret, scope,
//       timezone, currency, logo_url, primary_color, contact_email, store_tags,
//       store_group, store_group_name]);
//   return result.rows[0];
// }

// async function getStoreByIdentifier(identifier) {
//   const r = await pool.query(
//     'SELECT * FROM stores WHERE store_identifier = $1 AND is_active = true', [identifier]);
//   return r.rows[0] || null;
// }

// async function getStoreByDomain(domain) {
//   const r = await pool.query(
//     'SELECT * FROM stores WHERE shop_domain = $1 AND is_active = true', [domain]);
//   return r.rows[0] || null;
// }

// async function getStoreById(id) {
//   const r = await pool.query('SELECT * FROM stores WHERE id = $1 AND is_active = true', [id]);
//   return r.rows[0] || null;
// }

// async function getAllActiveStores() {
//   const r = await pool.query('SELECT * FROM stores WHERE is_active = true ORDER BY brand_name ASC');
//   return r.rows;
// }

// async function getStoresByFilters(filters = {}) {
//   let query = 'SELECT * FROM stores WHERE is_active = true';
//   const params = [];
//   if (filters.storeGroup) { params.push(filters.storeGroup); query += ` AND store_group = $${params.length}`; }
//   query += ' ORDER BY brand_name ASC';
//   const r = await pool.query(query, params);
//   return r.rows;
// }

// async function updateStoreConnectionStatus(identifier, isConnected) {
//   try {
//     await pool.query(
//       'UPDATE stores SET websocket_connected = $1, updated_at = NOW() WHERE store_identifier = $2',
//       [isConnected, identifier]);
//   } catch (e) { console.error('Error updating connection status:', e.message); }
// }

// async function updateStoreSettings(storeId, settings) {
//   const fields = [];
//   const values = [];
//   let n = 1;
//   for (const [key, value] of Object.entries(settings)) {
//     fields.push(`${key} = $${n++}`);
//     values.push(value);
//   }
//   fields.push('updated_at = NOW()');
//   values.push(storeId);
//   const r = await pool.query(
//     `UPDATE stores SET ${fields.join(', ')} WHERE id = $${n} RETURNING *`, values);
//   return r.rows[0];
// }

// // ============================================================================
// // CONVERSATION FUNCTIONS
// // ============================================================================

// async function saveConversation(data) {
//   const {
//     store_id, store_identifier, customer_email, customer_name, customer_id,
//     customer_phone, status = 'open', priority = 'normal', tags = [],
//     cart_subtotal = 0, source = 'website',
//   } = data;
//   const r = await pool.query(`
//     INSERT INTO conversations (
//       shop_id, shop_domain, customer_email, customer_name, customer_id,
//       customer_phone, status, priority, tags, cart_subtotal, source, created_at, updated_at
//     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,NOW(),NOW()) RETURNING *
//   `, [store_id, store_identifier, customer_email, customer_name, customer_id,
//       customer_phone, status, priority, tags, cart_subtotal, source]);
//   return r.rows[0];
// }

// async function getConversation(conversationId, storeId = null) {
//   let query = `SELECT c.*, s.brand_name, s.logo_url
//                  FROM conversations c JOIN stores s ON c.shop_id = s.id
//                 WHERE c.id = $1`;
//   const params = [conversationId];
//   if (storeId) { params.push(storeId); query += ` AND c.shop_id = $${params.length}`; }
//   const r = await pool.query(query, params);
//   return r.rows[0] || null;
// }

// // async function getConversations(filters = {}) {
// //   let query = `
// //     SELECT c.*, s.brand_name, s.logo_url, s.primary_color, s.store_identifier,
// //            lcm.content AS last_customer_message
// //       FROM conversations c
// //       JOIN stores s ON c.shop_id = s.id
// //       LEFT JOIN LATERAL (
// //         SELECT content FROM messages
// //          WHERE conversation_id = c.id AND sender_type = 'customer'
// //          ORDER BY id DESC LIMIT 1
// //       ) lcm ON true
// //      WHERE 1=1
// //   `;
// //   const params = [];
// //   let n = 1;
// //   if (filters.storeId)         { query += ` AND c.shop_id = $${n++}`;        params.push(filters.storeId); }
// //   if (filters.storeIdentifier) { query += ` AND c.shop_domain = $${n++}`;    params.push(filters.storeIdentifier); }
// //   if (filters.storeGroup)      { query += ` AND s.store_group = $${n++}`;    params.push(filters.storeGroup); }
// //   if (filters.customerEmail)   { query += ` AND c.customer_email = $${n++}`; params.push(filters.customerEmail); }
// //   if (filters.status)          { query += ` AND c.status = $${n++}`;         params.push(filters.status); }
// //   if (!filters.status && filters.excludeArchived) query += ` AND c.status != 'archived'`;
// //   if (filters.priority)        { query += ` AND c.priority = $${n++}`;       params.push(filters.priority); }
// //   if (filters.assignedTo)      { query += ` AND c.assigned_to = $${n++}`;    params.push(filters.assignedTo); }
// //   if (filters.search) {
// //     query += ` AND (c.customer_email ILIKE $${n} OR c.customer_name ILIKE $${n})`;
// //     params.push(`%${filters.search}%`); n++;
// //   }
// //   const limit  = Math.min(parseInt(filters.limit, 10) || 50, 100);
// //   const offset = Math.max(parseInt(filters.offset, 10) || 0, 0);
// //   query += ` ORDER BY c.updated_at DESC LIMIT $${n} OFFSET $${n + 1}`;
// //   params.push(limit, offset);
// //   const r = await pool.query(query, params);
// //   return r.rows;
// // }

// async function getConversations(filters = {}) {
//   let query = `
//     SELECT c.*, s.brand_name, s.logo_url, s.primary_color, s.store_identifier,
//            lcm.content AS last_customer_message
//       FROM conversations c
//       JOIN stores s ON c.shop_id = s.id
//       LEFT JOIN LATERAL (
//         SELECT content FROM messages
//          WHERE conversation_id = c.id AND sender_type = 'customer'
//          ORDER BY id DESC LIMIT 1
//       ) lcm ON true
//      WHERE 1=1
//   `;
//   const params = [];
//   let n = 1;
//   if (filters.storeId)         { query += ` AND c.shop_id = $${n++}`;        params.push(filters.storeId); }
//   if (filters.storeIdentifier) { query += ` AND c.shop_domain = $${n++}`;    params.push(filters.storeIdentifier); }
//   if (filters.storeGroup)      { query += ` AND s.store_group = $${n++}`;    params.push(filters.storeGroup); }
//   if (filters.customerEmail)   { query += ` AND c.customer_email = $${n++}`; params.push(filters.customerEmail); }
//   if (filters.status)          { query += ` AND c.status = $${n++}`;         params.push(filters.status); }
//   if (!filters.status && filters.excludeArchived) query += ` AND c.status != 'archived'`;
//   if (filters.priority)        { query += ` AND c.priority = $${n++}`;       params.push(filters.priority); }
//   if (filters.assignedTo)      { query += ` AND c.assigned_to = $${n++}`;    params.push(filters.assignedTo); }
//   if (filters.search) {
//     query += ` AND (c.customer_email ILIKE $${n} OR c.customer_name ILIKE $${n})`;
//     params.push(`%${filters.search}%`); n++;
//   }
//   // ── date range: naive-UTC bounds matching the naive last_message_at column.
//   //    Half-open (>= … <) so it stays index-usable. Filters on message activity,
//   //    NOT updated_at (which bumps on read via markConversationRead). ──
//   if (filters.dateFrom) { query += ` AND c.last_message_at >= $${n++}`; params.push(filters.dateFrom); }
//   if (filters.dateTo)   { query += ` AND c.last_message_at <  $${n++}`; params.push(filters.dateTo); }
//   const limit  = Math.min(parseInt(filters.limit, 10) || 50, 100);
//   const offset = Math.max(parseInt(filters.offset, 10) || 0, 0);
//   query += ` ORDER BY c.updated_at DESC LIMIT $${n} OFFSET $${n + 1}`;
//   params.push(limit, offset);
//   const r = await pool.query(query, params);
//   return r.rows;
// }

// async function getConversationCount(filters = {}) {
//   let query = 'SELECT COUNT(*) FROM conversations WHERE 1=1';
//   const params = [];
//   let n = 1;
//   if (filters.storeId) { query += ` AND shop_id = $${n++}`; params.push(filters.storeId); }
//   if (filters.status)  { query += ` AND status = $${n++}`;  params.push(filters.status); }
//   const r = await pool.query(query, params);
//   return parseInt(r.rows[0].count, 10);
// }

// const CONVERSATION_UPDATABLE = new Set([
//   'status', 'priority', 'assigned_to', 'tags', 'customer_name', 'customer_email',
//   'customer_phone', 'customer_id', 'unread_count', 'closed_at', 'archived_at',
//   'last_read_at', 'cart_subtotal', 'source', 'legal_flag', 'legal_flag_severity',
// ]);

// async function updateConversation(conversationId, updates) {
//   const fields = [];
//   const values = [];
//   let n = 1;
//   for (const [key, value] of Object.entries(updates)) {
//     // Whitelist: this is fed straight from req.body in PUT /api/conversations/:id
//     if (!CONVERSATION_UPDATABLE.has(key)) continue;
//     fields.push(`${key} = $${n++}`);
//     values.push(value);
//   }
//   if (!fields.length) throw new Error('No valid fields to update');
//   fields.push('updated_at = NOW()');
//   values.push(conversationId);
//   const r = await pool.query(
//     `UPDATE conversations SET ${fields.join(', ')} WHERE id = $${n} RETURNING *`, values);
//   return r.rows[0];
// }

// async function closeConversation(conversationId) {
//   const r = await pool.query(
//     `UPDATE conversations SET status = 'closed', closed_at = NOW(), updated_at = NOW()
//       WHERE id = $1 RETURNING *`, [conversationId]);
//   return r.rows[0];
// }

// async function assignConversation(conversationId, employeeEmail) {
//   const r = await pool.query(
//     `UPDATE conversations SET assigned_to = $1, updated_at = NOW() WHERE id = $2 RETURNING *`,
//     [employeeEmail, conversationId]);
//   return r.rows[0];
// }

// // Single round trip instead of two sequential UPDATEs.
// async function markConversationRead(conversationId) {
//   await pool.query(`
//     WITH c AS (
//       UPDATE conversations SET unread_count = 0, last_read_at = NOW(), updated_at = NOW()
//        WHERE id = $1
//     )
//     UPDATE messages SET read_at = NOW()
//      WHERE conversation_id = $1 AND sender_type = 'customer' AND read_at IS NULL
//   `, [conversationId]);
// }

// // ============================================================================
// // STORE GROUP FUNCTIONS
// // ============================================================================

// async function getAllStoreGroups() {
//   const r = await pool.query(`
//     SELECT sg.id, sg.group_key AS store_group, sg.group_name AS store_group_name, sg.color,
//            sg.created_at, sg.updated_at,
//            COUNT(s.id) FILTER (WHERE s.is_active = true)::int AS store_count
//       FROM store_groups sg
//       LEFT JOIN stores s ON s.store_group = sg.group_key
//      GROUP BY sg.id, sg.group_key, sg.group_name, sg.color, sg.created_at, sg.updated_at
//      ORDER BY sg.group_name ASC
//   `);
//   return r.rows;
// }

// async function createStoreGroup({ group_key, group_name, color = '#667eea' }) {
//   const r = await pool.query(`
//     INSERT INTO store_groups (group_key, group_name, color, created_at, updated_at)
//     VALUES ($1, $2, $3, NOW(), NOW())
//     RETURNING id, group_key AS store_group, group_name AS store_group_name, color, created_at, updated_at
//   `, [group_key, group_name, color || '#667eea']);
//   return r.rows[0];
// }

// async function updateStoreGroup(id, { group_key, group_name, color }) {
//   const client = await pool.connect();
//   try {
//     await client.query('BEGIN');
//     const existing = await client.query('SELECT * FROM store_groups WHERE id = $1', [id]);
//     if (!existing.rows[0]) { await client.query('ROLLBACK'); return null; }
//     const oldKey = existing.rows[0].group_key;

//     const r = await client.query(`
//       UPDATE store_groups SET group_key = $1, group_name = $2, color = $3, updated_at = NOW()
//        WHERE id = $4
//       RETURNING id, group_key AS store_group, group_name AS store_group_name, color, created_at, updated_at
//     `, [group_key, group_name, color || existing.rows[0].color, id]);

//     // Keep both the key and the denormalised name on stores in sync.
//     if (group_key !== oldKey) {
//       await client.query(
//         `UPDATE stores SET store_group = $1, store_group_name = $2, updated_at = NOW()
//           WHERE store_group = $3`, [group_key, group_name, oldKey]);
//     } else {
//       await client.query(
//         `UPDATE stores SET store_group_name = $1, updated_at = NOW() WHERE store_group = $2`,
//         [group_name, group_key]);
//     }
//     await client.query('COMMIT');
//     return r.rows[0];
//   } catch (e) {
//     await client.query('ROLLBACK').catch(() => {});
//     throw e;
//   } finally {
//     client.release();
//   }
// }

// async function deleteStoreGroup(id, { force = false } = {}) {
//   const client = await pool.connect();
//   try {
//     await client.query('BEGIN');
//     const existing = await client.query('SELECT * FROM store_groups WHERE id = $1', [id]);
//     if (!existing.rows[0]) { await client.query('ROLLBACK'); return { deleted: false, reason: 'not_found' }; }
//     const { group_key } = existing.rows[0];

//     const countResult = await client.query(
//       'SELECT COUNT(*)::int AS n FROM stores WHERE store_group = $1', [group_key]);
//     const storeCount = countResult.rows[0].n;

//     if (storeCount > 0 && !force) {
//       await client.query('ROLLBACK');
//       return { deleted: false, reason: 'has_stores', storeCount };
//     }
//     if (storeCount > 0 && force) {
//       await client.query(
//         `UPDATE stores SET store_group = NULL, store_group_name = NULL, updated_at = NOW()
//           WHERE store_group = $1`, [group_key]);
//     }
//     await client.query('DELETE FROM store_groups WHERE id = $1', [id]);
//     await client.query('COMMIT');
//     return { deleted: true, unassignedStores: storeCount };
//   } catch (e) {
//     await client.query('ROLLBACK').catch(() => {});
//     throw e;
//   } finally {
//     client.release();
//   }
// }

// // ============================================================================
// // MESSAGE FUNCTIONS
// // ============================================================================

// async function saveMessage(data) {
//   const {
//     conversation_id, store_id, sender_type, sender_name, sender_id,
//     content, message_type = 'text', attachment_url, attachment_type, file_data,
//   } = data;

//   const client = await pool.connect();
//   try {
//     await client.query('BEGIN');
//     const messageResult = await client.query(`
//       INSERT INTO messages (
//         conversation_id, shop_id, sender_type, sender_name, sender_id,
//         content, message_type, attachment_url, attachment_type, file_data, sent_at, timestamp
//       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,NOW(),NOW()) RETURNING *
//     `, [conversation_id, store_id, sender_type, sender_name, sender_id,
//         content, message_type, attachment_url, attachment_type, file_data]);
//     const message = messageResult.rows[0];

//     const updateFields = [
//       'total_message_count = total_message_count + 1',
//       'last_message_at = NOW()',
//       'updated_at = NOW()',
//       'last_message = $2',
//       'last_message_sender_type = $3',
//     ];
//     if (sender_type === 'customer') {
//       updateFields.push('customer_message_count = customer_message_count + 1');
//       updateFields.push('last_customer_message_at = NOW()');
//       updateFields.push('unread_count = unread_count + 1');
//       updateFields.push(`auto_replied_at = CASE
//         WHEN auto_replied_at IS NULL OR auto_replied_at < NOW() - INTERVAL '8 hours'
//         THEN NULL ELSE auto_replied_at END`);
//     } else if (sender_type === 'agent') {
//       updateFields.push('agent_message_count = agent_message_count + 1');
//       updateFields.push('last_agent_message_at = NOW()');
//       updateFields.push('agent_replied_at = COALESCE(agent_replied_at, NOW())');
//       updateFields.push(`response_time_seconds = CASE
//         WHEN last_agent_message_at IS NULL AND first_message_at IS NOT NULL
//         THEN EXTRACT(EPOCH FROM (NOW() - first_message_at))::INTEGER
//         ELSE response_time_seconds END`);
//     }
//     updateFields.push('first_message_at = COALESCE(first_message_at, NOW())');

//     await client.query(
//       `UPDATE conversations SET ${updateFields.join(', ')} WHERE id = $1`,
//       [conversation_id, content, sender_type]);
//     await client.query('COMMIT');
//     return parseMessageFileData(message);
//   } catch (error) {
//     await client.query('ROLLBACK').catch(() => {});
//     console.error('❌ [saveMessage] Error:', error.message);
//     throw error;
//   } finally {
//     client.release();
//   }
// }

// /**
//  * getMessages(id)                     → full history, oldest→newest
//  * getMessages(id, { limit })          → newest `limit`, returned oldest→newest
//  * getMessages(id, { limit, before })  → page older than cursor id `before`
//  *
//  * Callers should always pass a limit. The unbounded form pulls the whole thread
//  * through the regex-cast employees join.
//  */
// async function getMessages(conversationId, options = {}) {
//   const { limit = null, before = null } = options;
//   const joinClause = `
//     LEFT JOIN employees e ON (
//       m.sender_type = 'agent' AND m.sender_id IS NOT NULL
//       AND m.sender_id ~ '^[0-9]+$' AND CAST(m.sender_id AS INTEGER) = e.id
//     )`;

//   if (limit) {
//     const params = [conversationId];
//     let cursor = '';
//     if (before) { params.push(before); cursor = `AND m.id < $${params.length}`; }
//     params.push(limit);
//     const r = await pool.query(
//       `SELECT * FROM (
//          SELECT m.*, e.name AS sender_display_name, e.employee_name AS sender_employee_name
//            FROM messages m ${joinClause}
//           WHERE m.conversation_id = $1 ${cursor}
//           ORDER BY m.id DESC LIMIT $${params.length}
//        ) sub ORDER BY sub.id ASC`, params);
//     return r.rows.map(parseMessageFileData);
//   }

//   const r = await pool.query(
//     `SELECT m.*, e.name AS sender_display_name, e.employee_name AS sender_employee_name
//        FROM messages m ${joinClause}
//       WHERE m.conversation_id = $1
//       ORDER BY m.timestamp ASC`, [conversationId]);
//   return r.rows.map(parseMessageFileData);
// }

// async function markMessageDelivered(messageId) {
//   try { await pool.query('UPDATE messages SET delivered_at = NOW() WHERE id = $1', [messageId]); }
//   catch (e) { console.error('Error marking message delivered:', e.message); }
// }

// async function markMessageRead(messageId) {
//   try { await pool.query('UPDATE messages SET read_at = NOW() WHERE id = $1', [messageId]); }
//   catch (e) { console.error('Error marking message read:', e.message); }
// }

// async function markMessageFailed(messageId, error) {
//   try {
//     await pool.query(
//       'UPDATE messages SET failed = true, routing_error = $1, retry_count = retry_count + 1 WHERE id = $2',
//       [error, messageId]);
//   } catch (e) { console.error('Error marking message failed:', e.message); }
// }

// // ============================================================================
// // EMPLOYEE FUNCTIONS
// // ============================================================================

// async function createEmployee(data) {
//   const {
//     email, name, employee_name = null, password_hash, role = 'agent',
//     can_view_all_stores = true, assigned_stores = [],
//   } = data;
//   if (!email || !name) throw new Error('Email and name are required');
//   if (!password_hash) throw new Error('password_hash is required');
//   const r = await pool.query(`
//     INSERT INTO employees (email, name, employee_name, password_hash, role,
//                            can_view_all_stores, assigned_stores, created_at, updated_at)
//     VALUES ($1,$2,$3,$4,$5,$6,$7,NOW(),NOW()) RETURNING *
//   `, [email, name, employee_name, password_hash, role, can_view_all_stores, assigned_stores]);
//   return r.rows[0];
// }

// async function getEmployeeByEmail(email) {
//   const r = await pool.query('SELECT * FROM employees WHERE email = $1 AND is_active = true', [email]);
//   return r.rows[0] || null;
// }

// async function getEmployeeById(id) {
//   const r = await pool.query('SELECT * FROM employees WHERE id = $1 AND is_active = true', [id]);
//   return r.rows[0] || null;
// }

// async function getAllEmployees() {
//   const r = await pool.query('SELECT * FROM employees ORDER BY created_at DESC');
//   return r.rows;
// }

// async function updateEmployee(employeeId, updates) {
//   const allowed = ['name','employee_name','email','role','password_hash','is_active',
//                    'can_view_all_stores','assigned_stores','last_login','is_online','current_status'];
//   const fields = [];
//   const values = [];
//   let n = 1;
//   for (const [key, value] of Object.entries(updates)) {
//     if (!allowed.includes(key)) continue;
//     fields.push(`${key} = $${n++}`);
//     values.push(value);
//   }
//   if (!fields.length) throw new Error('No valid fields to update');
//   fields.push('updated_at = NOW()');
//   values.push(employeeId);
//   const r = await pool.query(
//     `UPDATE employees SET ${fields.join(', ')} WHERE id = $${n} RETURNING *`, values);
//   return r.rows[0];
// }

// async function deleteEmployee(employeeId) {
//   const r = await pool.query(
//     'UPDATE employees SET is_active = false, updated_at = NOW() WHERE id = $1 RETURNING *',
//     [employeeId]);
//   return r.rows[0];
// }

// async function updateEmployeeStatus(employeeId, status) {
//   try {
//     if (status && typeof status === 'object') {
//       const updates = {};
//       if (status.last_login) updates.last_login = status.last_login;
//       if (status.is_online !== undefined) updates.is_online = status.is_online;
//       if (status.current_status) updates.current_status = status.current_status;
//       if (!Object.keys(updates).length) return null;
//       return await updateEmployee(employeeId, updates);
//     }
//     await pool.query(
//       'UPDATE employees SET current_status = $1, is_online = $2, updated_at = NOW() WHERE id = $3',
//       [status, status === 'online', employeeId]);
//   } catch (e) { console.error('Error updating employee status:', e.message); }
// }

// async function updateEmployeeNotesOrder(employeeId, order) {
//   const r = await pool.query(
//     `UPDATE employees SET notes_order = $1, updated_at = NOW() WHERE id = $2 RETURNING notes_order`,
//     [JSON.stringify(order), employeeId]);
//   return r.rows[0];
// }

// async function logAgentActivity(data) {
//   const { employee_id, conversation_id, store_id, action, action_data } = data;
//   try {
//     await pool.query(`
//       INSERT INTO agent_activity (employee_id, conversation_id, shop_id, action, action_data, created_at)
//       VALUES ($1,$2,$3,$4,$5,NOW())
//     `, [employee_id, conversation_id, store_id, action, action_data]);
//   } catch (e) { console.error('Error logging agent activity:', e.message); }
// }

// // ============================================================================
// // RESPONSE-TIME ROLLUP
// // ============================================================================
// // Runs on the maintenance pool (no 15s cap — this is why it never used to
// // complete) under an advisory lock so only one instance recomputes. Window
// // narrowed 90d → configurable (default 21d) and the DELETE-all replaced with
// // an upsert so the table is never empty mid-refresh.

// const STATS_WINDOW_DAYS = Number(process.env.STATS_WINDOW_DAYS || 21);

// async function refreshResponseStats() {
//   return withMaintenance(async (mp) => {
//     const outcome = await withAdvisoryLock(mp, LOCKS.RESPONSE_STATS, async (client) => {
//       const t0 = Date.now();

//       await client.query(`
//         INSERT INTO agent_response_stats
//           (sender_id, avg_response_minutes, fastest_minutes, total_responses_counted, updated_at)
//         WITH real_messages AS (
//           SELECT sender_id, sender_type, sent_at,
//             LAG(sender_type) OVER (PARTITION BY conversation_id ORDER BY sent_at) AS prev_sender_type,
//             LAG(sent_at)     OVER (PARTITION BY conversation_id ORDER BY sent_at) AS prev_sent_at
//           FROM messages
//           WHERE sender_type IN ('customer','agent')
//             AND NOT (sender_type = 'agent' AND sender_id IS NULL)
//             AND sent_at >= NOW() - ($1 || ' days')::interval
//         ),
//         rt AS (
//           SELECT sender_id, EXTRACT(EPOCH FROM (sent_at - prev_sent_at)) / 60.0 AS m
//           FROM real_messages
//           WHERE sender_type = 'agent' AND sender_id IS NOT NULL
//             AND prev_sender_type = 'customer' AND prev_sent_at IS NOT NULL
//             AND EXTRACT(EPOCH FROM (sent_at - prev_sent_at)) / 60.0 BETWEEN 0 AND 240
//         )
//         SELECT sender_id, ROUND(AVG(m)::numeric,1), ROUND(MIN(m)::numeric,1), COUNT(*)::int, NOW()
//           FROM rt GROUP BY sender_id
//         ON CONFLICT (sender_id) DO UPDATE SET
//           avg_response_minutes    = EXCLUDED.avg_response_minutes,
//           fastest_minutes         = EXCLUDED.fastest_minutes,
//           total_responses_counted = EXCLUDED.total_responses_counted,
//           updated_at              = NOW()
//       `, [STATS_WINDOW_DAYS]);

//       await client.query(`
//         INSERT INTO agent_customer_response_stats
//           (sender_id, customer_email, avg_minutes, response_count, updated_at)
//         WITH real_messages AS (
//           SELECT m.sender_id, m.sender_type, m.sent_at, c.customer_email,
//             LAG(m.sender_type) OVER (PARTITION BY m.conversation_id ORDER BY m.sent_at) AS prev_sender_type,
//             LAG(m.sent_at)     OVER (PARTITION BY m.conversation_id ORDER BY m.sent_at) AS prev_sent_at
//           FROM messages m
//           JOIN conversations c ON c.id = m.conversation_id
//           WHERE m.sender_type IN ('customer','agent')
//             AND NOT (m.sender_type = 'agent' AND m.sender_id IS NULL)
//             AND m.sent_at >= NOW() - ($1 || ' days')::interval
//         )
//         SELECT sender_id, customer_email,
//                ROUND(AVG(EXTRACT(EPOCH FROM (sent_at - prev_sent_at)) / 60.0)::numeric, 1),
//                COUNT(*)::int, NOW()
//           FROM real_messages
//          WHERE sender_type = 'agent' AND sender_id IS NOT NULL
//            AND prev_sender_type = 'customer' AND prev_sent_at IS NOT NULL
//            AND EXTRACT(EPOCH FROM (sent_at - prev_sent_at)) / 60.0 BETWEEN 0 AND 240
//            AND customer_email IS NOT NULL AND customer_email <> ''
//          GROUP BY sender_id, customer_email
//         ON CONFLICT (sender_id, customer_email) DO UPDATE SET
//           avg_minutes    = EXCLUDED.avg_minutes,
//           response_count = EXCLUDED.response_count,
//           updated_at     = NOW()
//       `, [STATS_WINDOW_DAYS]);

//       // Drop pairs that fell out of the window entirely.
//       await client.query(
//         `DELETE FROM agent_customer_response_stats WHERE updated_at < NOW() - INTERVAL '7 days'`);

//       console.log(`📊 [Stats] Rollup refreshed in ${Math.round((Date.now() - t0) / 1000)}s (${STATS_WINDOW_DAYS}d window)`);
//     });
//     if (outcome.skipped) console.log('⏭️  [Stats] Rollup already running on another instance');
//   });
// }

// async function getAgentResponseStats() {
//   const { rows } = await pool.query('SELECT * FROM agent_response_stats');
//   const byId = {};
//   for (const r of rows) {
//     byId[String(r.sender_id)] = {
//       avgResponseMinutes: r.avg_response_minutes !== null ? parseFloat(r.avg_response_minutes) : null,
//       fastestMinutes: r.fastest_minutes !== null ? parseFloat(r.fastest_minutes) : null,
//       totalResponsesCounted: r.total_responses_counted,
//     };
//   }
//   return byId;
// }

// async function getAgentCustomerResponseStats() {
//   // Cap per agent so one chatty agent can't return tens of thousands of rows.
//   const { rows } = await pool.query(`
//     SELECT * FROM (
//       SELECT *, ROW_NUMBER() OVER (PARTITION BY sender_id ORDER BY response_count DESC) AS rn
//         FROM agent_customer_response_stats
//     ) t WHERE rn <= 50 ORDER BY sender_id, response_count DESC
//   `);
//   const byAgent = {};
//   for (const r of rows) {
//     const key = String(r.sender_id);
//     if (!byAgent[key]) byAgent[key] = [];
//     byAgent[key].push({
//       customerEmail: r.customer_email,
//       avgResponseMinutes: r.avg_minutes !== null ? parseFloat(r.avg_minutes) : null,
//       responseCount: r.response_count,
//     });
//   }
//   return byAgent;
// }

// // ============================================================================
// // WEBHOOKS / CANNED RESPONSES / TEMPLATES
// // ============================================================================

// async function logWebhook(data) {
//   const { store_id, topic, payload, headers } = data;
//   try {
//     await pool.query(
//       `INSERT INTO webhook_logs (shop_id, topic, payload, headers, received_at)
//        VALUES ($1,$2,$3,$4,NOW())`, [store_id, topic, payload, headers]);
//   } catch (e) { console.error('Error logging webhook:', e.message); }
// }

// async function getCannedResponses(storeId) {
//   const r = await pool.query(
//     'SELECT * FROM canned_responses WHERE shop_id = $1 ORDER BY category, title', [storeId]);
//   return r.rows;
// }

// async function createCannedResponse(data) {
//   const { store_id, title, content, shortcut, category, created_by } = data;
//   const r = await pool.query(`
//     INSERT INTO canned_responses (shop_id, title, content, shortcut, category, created_by, created_at, updated_at)
//     VALUES ($1,$2,$3,$4,$5,$6,NOW(),NOW()) RETURNING *
//   `, [store_id, title, content, shortcut, category, created_by]);
//   return r.rows[0];
// }

// async function getTemplatesByUserId(userId) {
//   const r = await pool.query(
//     `SELECT id, user_id, name, content, created_at, updated_at
//        FROM message_templates WHERE user_id = $1 ORDER BY created_at DESC`, [userId]);
//   return r.rows;
// }

// async function getTemplateById(templateId) {
//   const r = await pool.query(
//     `SELECT id, user_id, name, content, created_at, updated_at
//        FROM message_templates WHERE id = $1`, [templateId]);
//   return r.rows[0] || null;
// }

// async function createTemplate({ user_id, name, content }) {
//   const r = await pool.query(
//     `INSERT INTO message_templates (user_id, name, content) VALUES ($1,$2,$3)
//      RETURNING id, user_id, name, content, created_at, updated_at`, [user_id, name, content]);
//   return r.rows[0];
// }

// async function updateTemplate(templateId, { name, content }) {
//   const r = await pool.query(
//     `UPDATE message_templates SET name = $1, content = $2, updated_at = CURRENT_TIMESTAMP
//       WHERE id = $3 RETURNING id, user_id, name, content, created_at, updated_at`,
//     [name, content, templateId]);
//   return r.rows[0];
// }

// async function deleteTemplate(templateId) {
//   await pool.query('DELETE FROM message_templates WHERE id = $1', [templateId]);
//   return { success: true };
// }

// // ============================================================================
// // ANALYTICS
// // ============================================================================

// async function getDashboardStats(filters = {}) {
//   const params = [];
//   let storeFilter = '';
//   if (filters.storeId) { params.push(filters.storeId); storeFilter = 'AND shop_id = $1'; }

//   const [convStats, msgStats] = await Promise.all([
//     pool.query(`
//       SELECT COUNT(*)                                   AS total_conversations,
//              COUNT(*) FILTER (WHERE status = 'open')     AS open_conversations,
//              COUNT(*) FILTER (WHERE status = 'pending')  AS pending_conversations,
//              COUNT(*) FILTER (WHERE status = 'closed')   AS closed_conversations,
//              COUNT(DISTINCT shop_id)                     AS active_stores,
//              COUNT(DISTINCT customer_email)              AS unique_customers,
//              AVG(response_time_seconds) FILTER (WHERE response_time_seconds IS NOT NULL) AS avg_response_time
//         FROM conversations WHERE status != 'archived' ${storeFilter}
//     `, params),
//     pool.query(
//       `SELECT COUNT(*) AS messages_today FROM messages
//         WHERE timestamp >= CURRENT_DATE ${storeFilter}`, params),
//   ]);

//   return { ...convStats.rows[0], messages_today: msgStats.rows[0].messages_today };
// }

// async function getStoreMetrics(storeId, days = 30) {
//   const safeDays = Math.min(Math.max(parseInt(days, 10) || 30, 1), 365);
//   const r = await pool.query(`
//     SELECT date, total_conversations, new_conversations, closed_conversations,
//            total_messages, average_response_time_seconds
//       FROM analytics_daily
//      WHERE shop_id = $1 AND date >= CURRENT_DATE - ($2 || ' days')::interval
//      ORDER BY date DESC
//   `, [storeId, safeDays]);
//   return r.rows;
// }

// // ============================================================================
// // UTILITY
// // ============================================================================

// /** Throws on failure — callers depend on that. */
// async function testConnection() {
//   const r = await pool.query('SELECT NOW()');
//   return r.rows[0].now;
// }

// /** Retries a cold/suspended DB instead of exiting on the first miss. */
// async function waitForDatabase(attempts = 5) {
//   for (let i = 1; i <= attempts; i++) {
//     try {
//       const now = await testConnection();
//       console.log(`✅ Database connection successful: ${now}`);
//       return true;
//     } catch (e) {
//       if (i === attempts) throw new Error(`Database unreachable after ${attempts} attempts: ${e.message}`);
//       const wait = 2000 * i;
//       console.warn(`⏳ DB not ready (${i}/${attempts}): ${e.message} — retrying in ${wait}ms`);
//       await new Promise(r => setTimeout(r, wait));
//     }
//   }
// }

// async function closePool() {
//   await pool.end().catch(() => {});
// }

// module.exports = {
//   pool,
//   LOCKS,
//   maintenancePool,
//   withMaintenance,
//   withAdvisoryLock,
//   getPoolStats,
//   initDatabase,
//   runMigrations,
//   buildSearchIndexes,
//   checkSearchIndexes,
//   testConnection,
//   waitForDatabase,
//   closePool,
//   registerStore,
//   getStoreByIdentifier,
//   getStoreByDomain,
//   getStoreById,
//   getAllActiveStores,
//   getStoresByFilters,
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
//   updateEmployeeNotesOrder,
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
//   refreshResponseStats,
//   getAgentResponseStats,
//   getAgentCustomerResponseStats,
//   getAllStoreGroups,
//   createStoreGroup,
//   updateStoreGroup,
//   deleteStoreGroup,
// };














const { Pool } = require('pg');
require('dotenv').config();

const CONNECTION_STRING = process.env.DATABASE_URL;
const IS_LOCAL_OR_INTERNAL = /\.internal|localhost|127\.0\.0\.1/.test(CONNECTION_STRING || '');
const SSL_CONFIG = IS_LOCAL_OR_INTERNAL ? false : { rejectUnauthorized: false };

// ── Advisory lock IDs (arbitrary but must be stable and unique per job) ──
const LOCKS = {
  MIGRATIONS:        915001,
  RESPONSE_STATS:    915002,
  PRESENCE_CLEANUP:  915003,
  AUTO_REPLY:        915004,
  DISCORD_HOURLY:    915005,
  DISCORD_DAILY:     915006,
  BRAIN_PRUNE:       915007,
  PERF_INDEXES:      915008,
  SEARCH_INDEXES:    915009,
};

// ============================================================================
// POOLS
// ============================================================================

const pool = new Pool({
  connectionString: CONNECTION_STRING,
  ssl: SSL_CONFIG,
  max: Number(process.env.PG_MAX || 20),
  min: 0,
  idleTimeoutMillis: 10_000,          // release fast; poolers reap aggressively
  connectionTimeoutMillis: 20_000,    // room for a cold start
  statement_timeout: 15_000,          // app queries only — never DDL
  query_timeout: 20_000,              // client-side guard for dead sockets
  keepAlive: true,
  keepAliveInitialDelayMillis: 10_000,
  application_name: 'csp-web',
  allowExitOnIdle: false,
});

pool.on('error', (err) => {
  // Idle-client errors MUST be handled or they become uncaught rejections.
  console.error('[pg] idle client error:', err.message);
});

/**
 * Short-lived pool with NO statement timeout. For migrations, index builds and
 * heavy rollups. Always end() it when finished.
 */
function maintenancePool() {
  const cs = process.env.DIRECT_DATABASE_URL || CONNECTION_STRING;
  const internal = /\.internal|localhost|127\.0\.0\.1/.test(cs);
  return new Pool({
    connectionString: cs,
    ssl: internal ? false : { rejectUnauthorized: false },
    max: 2,
    statement_timeout: 0,
    query_timeout: 0,
    idleTimeoutMillis: 5_000,
    connectionTimeoutMillis: 30_000,
    keepAlive: true,
    keepAliveInitialDelayMillis: 10_000,
    application_name: 'csp-maintenance',
    allowExitOnIdle: true,
  });
}

async function withMaintenance(fn) {
  const mp = maintenancePool();
  mp.on('error', (e) => console.error('[pg-maint] idle client error:', e.message));
  try {
    return await fn(mp);
  } finally {
    await mp.end().catch(() => {});
  }
}

/**
 * Run fn while holding a session-level advisory lock. Returns
 * { skipped: true } if another instance already holds it.
 */
async function withAdvisoryLock(db, lockId, fn) {
  const client = await db.connect();
  try {
    const { rows } = await client.query('SELECT pg_try_advisory_lock($1) AS got', [lockId]);
    if (!rows[0].got) return { skipped: true };
    try {
      const result = await fn(client);
      return { skipped: false, result };
    } finally {
      await client.query('SELECT pg_advisory_unlock($1)', [lockId]).catch(() => {});
    }
  } finally {
    client.release();
  }
}

function getPoolStats() {
  return { total: pool.totalCount, idle: pool.idleCount, waiting: pool.waitingCount, max: pool.options.max };
}

// ============================================================================
// HELPERS
// ============================================================================

function parseMessageFileData(message) {
  if (!message) return message;
  if (message.file_data && typeof message.file_data === 'string') {
    try {
      message.file_data = JSON.parse(message.file_data);
    } catch (error) {
      console.error('Failed to parse file_data:', error.message);
      message.file_data = null;
    }
  }
  return message;
}

/**
 * Coerce a store-id list to a clean INTEGER[] for the employees.assigned_stores
 * column. The admin UI sends ids as strings, and a single bad entry makes the
 * whole array cast fail with a confusing "invalid input syntax" error rather
 * than a validation message, so non-numeric values are dropped here.
 * Duplicates are removed so the column can't drift into a growing list.
 */
function normalizeStoreIds(value) {
  if (value == null) return [];
  const list = Array.isArray(value) ? value : [value];
  const seen = new Set();
  for (const item of list) {
    const n = parseInt(item, 10);
    if (Number.isInteger(n) && n > 0) seen.add(n);
  }
  return [...seen];
}

/**
 * Clean a list of store_group slugs for employees.assigned_groups.
 *
 * Access is granted per GROUP rather than per store: a group is a stable unit
 * an admin actually thinks in, and a store added to `lexar-peptides` tomorrow
 * is automatically visible to everyone assigned that group. Per-store lists go
 * stale the moment the fleet grows.
 */
function normalizeGroupKeys(value) {
  if (value == null) return [];
  const list = Array.isArray(value) ? value : [value];
  const seen = new Set();
  for (const item of list) {
    const key = String(item || '').trim();
    if (key) seen.add(key);
  }
  return [...seen];
}

// ============================================================================
// SCHEMA BOOTSTRAP
// ============================================================================

async function initDatabase() {
  return withMaintenance(async (mp) => {
    console.log('🔄 Checking database initialization...');

    const tablesCheck = await mp.query(`
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

    await mp.query(`
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
        store_group VARCHAR(100),
        store_group_name VARCHAR(150),
        auto_reply_enabled BOOLEAN DEFAULT false,
        business_hours JSONB,
        widget_settings JSONB
      )
    `);

    await mp.query(`
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

    await mp.query(`
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

    await mp.query(`
      CREATE TABLE IF NOT EXISTS employees (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        name VARCHAR(255) NOT NULL,
        employee_name VARCHAR(255),
        role VARCHAR(50) DEFAULT 'agent',
        password_hash TEXT NOT NULL,
        api_token TEXT UNIQUE,
        last_login TIMESTAMP,
        can_view_all_stores BOOLEAN DEFAULT true,
        assigned_stores INTEGER[] DEFAULT '{}',
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

    await mp.query(`
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

    await mp.query(`
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

    await mp.query(`
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

    await mp.query(`
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

    await mp.query(`
      CREATE TABLE IF NOT EXISTS message_templates (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        content TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await mp.query(`
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

    await mp.query(`
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
  });
}

// ============================================================================
// MIGRATION RUNNER — ledger + advisory lock, runs each step ONCE ever
// ============================================================================

const MIGRATIONS = [
  ['001_message_columns',        migration_001_add_message_columns],
  ['002_conversation_metadata',  migration_002_add_conversation_metadata],
  ['003_unread_fields',          migration_003_add_unread_fields],
  ['004_last_message_fields',    migration_004_add_last_message_fields],
  ['005_message_templates',      migration_005_add_message_templates],
  ['006_file_data_column',       migration_006_add_file_data_column],
  ['007_email_notifications',    migration_007_add_email_notifications],
  ['008_conversation_notes',     migration_008_add_conversation_notes],
  ['009_employee_notes',         migration_009_add_employee_notes],
  ['010_ai_training_brain',      migration_010_add_ai_training_brain],
  ['011_legal_flag_columns',     migration_011_add_legal_flag_columns],
  ['012_agent_replied_at',       migration_012_add_agent_replied_at],
  ['013_blacklist_and_archive',  migration_013_add_blacklist_and_archive],
  ['014_auto_replied_at',        migration_014_add_auto_replied_at],
  ['015_notes_order',            migration_015_add_notes_order],
  ['016_employee_name',          migration_016_add_employee_name],
  ['017_promo_tables',           migration_017_add_promo_tables],
  ['018_performance_indexes',    migration_018_add_performance_indexes],
  ['019_response_stats_rollup',  migration_019_add_response_stats_rollup],
  ['020_group_columns',          migration_020_add_group_columns],
  ['021_store_groups_table',     migration_021_add_store_groups_table],
  ['022_group_color',            migration_022_add_group_color],
  ['023_brain_backups',          migration_023_add_brain_backups],
  ['024_last_message_at_index',  migration_024_last_message_at_index],
  ['025_assigned_stores_guard',  migration_025_assigned_stores_guard],
  ['026_assigned_groups',        migration_026_assigned_groups],
];

async function runMigrations() {
  return withMaintenance(async (mp) => {
    await mp.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        name       TEXT PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    const outcome = await withAdvisoryLock(mp, LOCKS.MIGRATIONS, async () => {
      const { rows } = await mp.query('SELECT name FROM schema_migrations');
      const applied = new Set(rows.map(r => r.name));

      let ran = 0, skipped = 0;
      for (const [name, fn] of MIGRATIONS) {
        if (applied.has(name)) { skipped++; continue; }
        console.log(`📝 [${name}] applying...`);
        await fn(mp);
        await mp.query('INSERT INTO schema_migrations (name) VALUES ($1) ON CONFLICT DO NOTHING', [name]);
        console.log(`✅ [${name}] applied`);
        ran++;
      }
      console.log(`✅ Migrations: ${ran} applied, ${skipped} already present`);

      // ── Verify critical columns ──
      const { rows: cols } = await mp.query(`
        SELECT column_name
          FROM information_schema.columns
         WHERE table_name = 'conversations'
           AND column_name IN ('auto_replied_at','archived_at','agent_replied_at',
                               'legal_flag','unread_count','last_message','last_message_sender_type')
      `);
      const found = cols.map(r => r.column_name);
      const expected = ['agent_replied_at','archived_at','auto_replied_at','last_message',
                        'last_message_sender_type','legal_flag','unread_count'];
      const missing = expected.filter(c => !found.includes(c));
      if (missing.length) console.error(`❌ [Migrations] Missing columns: ${missing.join(', ')}`);
      else console.log('✅ [Migrations] All critical columns verified');
    });

    if (outcome.skipped) console.log('⏭️  [Migrations] Another instance holds the lock — skipping');
  });
}

// ============================================================================
// MIGRATIONS  (each receives the maintenance pool — no statement timeout)
// ============================================================================

async function migration_001_add_message_columns(db) {
  const current = await db.query(
    `SELECT column_name FROM information_schema.columns WHERE table_name = 'messages'`);
  const existing = current.rows.map(r => r.column_name);
  const required = [
    { name: 'message_type',        sql: "VARCHAR(50) DEFAULT 'text'" },
    { name: 'attachment_url',      sql: 'TEXT' },
    { name: 'attachment_type',     sql: 'VARCHAR(50)' },
    { name: 'sent_at',             sql: 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP' },
    { name: 'delivered_at',        sql: 'TIMESTAMP' },
    { name: 'read_at',             sql: 'TIMESTAMP' },
    { name: 'failed',              sql: 'BOOLEAN DEFAULT false' },
    { name: 'retry_count',         sql: 'INTEGER DEFAULT 0' },
    { name: 'routed_successfully', sql: 'BOOLEAN DEFAULT true' },
    { name: 'routing_error',       sql: 'TEXT' },
  ];
  for (const col of required) {
    if (!existing.includes(col.name)) {
      await db.query(`ALTER TABLE messages ADD COLUMN ${col.name} ${col.sql}`);
    }
  }
}

async function migration_002_add_conversation_metadata(db) {
  await db.query(`ALTER TABLE conversations ADD COLUMN IF NOT EXISTS cart_subtotal DECIMAL(10,2) DEFAULT 0`);
  await db.query(`ALTER TABLE conversations ADD COLUMN IF NOT EXISTS source VARCHAR(100)`);
  await db.query(`CREATE INDEX IF NOT EXISTS idx_conversations_source ON conversations(source)`);
}

async function migration_003_add_unread_fields(db) {
  await db.query(`ALTER TABLE conversations ADD COLUMN IF NOT EXISTS unread_count INTEGER DEFAULT 0`);
  await db.query(`ALTER TABLE conversations ADD COLUMN IF NOT EXISTS last_read_at TIMESTAMP`);
}

// ⚠️ Contains a full-table backfill. This is the migration that was rewriting
// the entire conversations table on every boot. Now runs exactly once.
async function migration_004_add_last_message_fields(db) {
  await db.query(`ALTER TABLE conversations ADD COLUMN IF NOT EXISTS last_message TEXT`);
  await db.query(`ALTER TABLE conversations ADD COLUMN IF NOT EXISTS last_message_sender_type VARCHAR(50)`);
  await db.query(`ALTER TABLE conversations ADD COLUMN IF NOT EXISTS last_message_at TIMESTAMP`);
  console.log('   [004] backfilling last_message (one-time, may take a while)...');
  await db.query(`
    UPDATE conversations c
       SET last_message = m.content,
           last_message_sender_type = m.sender_type,
           last_message_at = m.timestamp
      FROM (
        SELECT DISTINCT ON (conversation_id) conversation_id, content, sender_type, timestamp
          FROM messages ORDER BY conversation_id, timestamp DESC
      ) m
     WHERE c.id = m.conversation_id
       AND c.last_message IS NULL
  `);
}

async function migration_005_add_message_templates(db) {
  await db.query(`
    CREATE TABLE IF NOT EXISTS message_templates (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
      name VARCHAR(255) NOT NULL,
      content TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await db.query(`CREATE INDEX IF NOT EXISTS idx_message_templates_user_id ON message_templates(user_id)`);
  await db.query(`CREATE INDEX IF NOT EXISTS idx_message_templates_created ON message_templates(created_at DESC)`);
  await db.query(`
    CREATE OR REPLACE FUNCTION update_message_templates_updated_at()
    RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = CURRENT_TIMESTAMP; RETURN NEW; END; $$ LANGUAGE plpgsql
  `);
  await db.query(`DROP TRIGGER IF EXISTS trigger_message_templates_updated_at ON message_templates`);
  await db.query(`
    CREATE TRIGGER trigger_message_templates_updated_at
      BEFORE UPDATE ON message_templates
      FOR EACH ROW EXECUTE FUNCTION update_message_templates_updated_at()
  `);
}

async function migration_006_add_file_data_column(db) {
  await db.query(`ALTER TABLE messages ADD COLUMN IF NOT EXISTS file_data JSONB`);
}

async function migration_007_add_email_notifications(db) {
  await db.query(`ALTER TABLE stores ADD COLUMN IF NOT EXISTS email_from_name VARCHAR(255)`);
  await db.query(`ALTER TABLE stores ADD COLUMN IF NOT EXISTS email_from_address VARCHAR(255)`);
  await db.query(`ALTER TABLE stores ADD COLUMN IF NOT EXISTS email_brand_color VARCHAR(7)`);

  await db.query(`
    CREATE TABLE IF NOT EXISTS customer_presence (
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
  await db.query(`CREATE INDEX IF NOT EXISTS idx_presence_conv ON customer_presence(conversation_id)`);
  // Partial index — the stale-cleanup job only ever scans non-offline rows.
  await db.query(`
    CREATE INDEX IF NOT EXISTS idx_presence_stale
      ON customer_presence (last_heartbeat_at) WHERE status <> 'offline'
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS offline_email_log (
      id SERIAL PRIMARY KEY,
      conversation_id INTEGER NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
      message_id INTEGER NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
      customer_email VARCHAR(255) NOT NULL,
      resend_id VARCHAR(100),
      sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(message_id)
    )
  `);
  await db.query(`CREATE INDEX IF NOT EXISTS idx_email_log_conv ON offline_email_log(conversation_id, sent_at DESC)`);
}

async function migration_008_add_conversation_notes(db) {
  await db.query(`
    CREATE TABLE IF NOT EXISTS conversation_notes (
      id SERIAL PRIMARY KEY,
      conversation_id INTEGER NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
      employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
      employee_name VARCHAR(255) NOT NULL,
      content TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await db.query(`CREATE INDEX IF NOT EXISTS idx_conversation_notes_lookup
                    ON conversation_notes(conversation_id, employee_id, created_at DESC)`);
}

async function migration_009_add_employee_notes(db) {
  await db.query(`
    CREATE TABLE IF NOT EXISTS employee_notes (
      id SERIAL PRIMARY KEY,
      employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
      employee_name VARCHAR(255) NOT NULL,
      title VARCHAR(200) DEFAULT 'Untitled',
      content TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await db.query(`ALTER TABLE employee_notes ADD COLUMN IF NOT EXISTS title VARCHAR(200) DEFAULT 'Untitled'`);
  await db.query(`CREATE INDEX IF NOT EXISTS idx_employee_notes_employee_id ON employee_notes(employee_id)`);
  await db.query(`CREATE INDEX IF NOT EXISTS idx_employee_notes_created_at ON employee_notes(created_at DESC)`);
}

async function migration_010_add_ai_training_brain(db) {
  await db.query(`
    CREATE TABLE IF NOT EXISTS ai_training_brain (
      id         INTEGER PRIMARY KEY DEFAULT 1,
      brain_data JSONB NOT NULL DEFAULT '{}',
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_by TEXT,
      CONSTRAINT single_row CHECK (id = 1)
    )
  `);
  await db.query(`INSERT INTO ai_training_brain (id, brain_data) VALUES (1, '{}') ON CONFLICT DO NOTHING`);
}

async function migration_011_add_legal_flag_columns(db) {
  await db.query(`
    ALTER TABLE conversations
      ADD COLUMN IF NOT EXISTS legal_flag          BOOLEAN DEFAULT FALSE,
      ADD COLUMN IF NOT EXISTS legal_flag_severity VARCHAR(20),
      ADD COLUMN IF NOT EXISTS legal_flag_at       TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS legal_flag_term     VARCHAR(100)
  `);
  await db.query(`CREATE INDEX IF NOT EXISTS idx_conversations_legal_flag
                    ON conversations(legal_flag) WHERE legal_flag = TRUE`);
}

// ⚠️ Contains a backfill — one-time only.
async function migration_012_add_agent_replied_at(db) {
  await db.query(`ALTER TABLE conversations ADD COLUMN IF NOT EXISTS agent_replied_at TIMESTAMPTZ`);
  await db.query(`CREATE INDEX IF NOT EXISTS idx_conversations_agent_replied
                    ON conversations(agent_replied_at) WHERE agent_replied_at IS NOT NULL`);
  console.log('   [012] backfilling agent_replied_at (one-time)...');
  await db.query(`
    UPDATE conversations c
       SET agent_replied_at = fa.first_reply
      FROM (SELECT conversation_id, MIN(timestamp) AS first_reply
              FROM messages WHERE sender_type = 'agent' GROUP BY conversation_id) fa
     WHERE c.id = fa.conversation_id AND c.agent_replied_at IS NULL
  `);
}

async function migration_013_add_blacklist_and_archive(db) {
  await db.query(`ALTER TABLE conversations ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ DEFAULT NULL`);
  await db.query(`CREATE INDEX IF NOT EXISTS idx_conv_archived_at
                    ON conversations (archived_at DESC NULLS LAST) WHERE status = 'archived'`);
  await db.query(`
    CREATE TABLE IF NOT EXISTS blacklist (
      id               SERIAL PRIMARY KEY,
      email            VARCHAR(320) NOT NULL,
      store_identifier VARCHAR(255) DEFAULT NULL,
      reason           TEXT         DEFAULT NULL,
      customer_name    VARCHAR(255) DEFAULT NULL,
      blocked_by       VARCHAR(255) DEFAULT NULL,
      created_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
      removed_at       TIMESTAMPTZ  DEFAULT NULL,
      CONSTRAINT blacklist_unique_email_store UNIQUE NULLS NOT DISTINCT (email, store_identifier)
    )
  `);
  await db.query(`CREATE INDEX IF NOT EXISTS idx_blacklist_active
                    ON blacklist(email, store_identifier) WHERE removed_at IS NULL`);
}

async function migration_014_add_auto_replied_at(db) {
  await db.query(`ALTER TABLE conversations ADD COLUMN IF NOT EXISTS auto_replied_at TIMESTAMPTZ DEFAULT NULL`);
  // Supports the auto-reply sweeper's candidate scan directly.
  await db.query(`CREATE INDEX IF NOT EXISTS idx_conv_open_autoreply
                    ON conversations (updated_at DESC) WHERE status = 'open'`);
}

async function migration_015_add_notes_order(db) {
  await db.query(`ALTER TABLE employees ADD COLUMN IF NOT EXISTS notes_order JSONB DEFAULT '[]'`);
}

async function migration_016_add_employee_name(db) {
  await db.query(`ALTER TABLE employees ADD COLUMN IF NOT EXISTS employee_name VARCHAR(255)`);
}

async function migration_017_add_promo_tables(db) {
  await db.query(`
    CREATE TABLE IF NOT EXISTS promo_unsubscribes (
      id SERIAL PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      unsubscribed_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
  await db.query(`CREATE INDEX IF NOT EXISTS idx_promo_unsubscribes_email ON promo_unsubscribes (LOWER(email))`);
  await db.query(`
    CREATE TABLE IF NOT EXISTS promo_sent_emails (
      id SERIAL PRIMARY KEY,
      email TEXT NOT NULL,
      store_domain TEXT NOT NULL DEFAULT '',
      store_name TEXT,
      discount_code TEXT,
      sent_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
  await db.query(`ALTER TABLE promo_sent_emails DROP CONSTRAINT IF EXISTS promo_sent_emails_email_key`).catch(() => {});
  await db.query(`CREATE UNIQUE INDEX IF NOT EXISTS promo_sent_emails_email_store_uidx
                    ON promo_sent_emails (LOWER(email), store_domain)`);
  await db.query(`CREATE INDEX IF NOT EXISTS idx_promo_sent_emails_sent_at ON promo_sent_emails (sent_at DESC)`);
}

// Hot-path btree indexes. Safe to build here (fast relative to GIN), and this
// runs on the maintenance pool so no statement timeout can kill them.
async function migration_018_add_performance_indexes(db) {
  const statements = [
    `CREATE INDEX IF NOT EXISTS idx_messages_conv_customer_lastmsg
       ON messages (conversation_id, id DESC) WHERE sender_type = 'customer'`,
    `CREATE INDEX IF NOT EXISTS idx_messages_conv_id
       ON messages (conversation_id, id DESC)`,
    `CREATE INDEX IF NOT EXISTS idx_messages_unread_customer
       ON messages (conversation_id) WHERE sender_type = 'customer' AND read_at IS NULL`,
    `CREATE INDEX IF NOT EXISTS idx_messages_timestamp_shop
       ON messages (timestamp DESC, shop_id)`,
    `CREATE INDEX IF NOT EXISTS idx_messages_conv_sent
       ON messages (conversation_id, sent_at DESC)`,
    `CREATE INDEX IF NOT EXISTS idx_messages_agent_sent
       ON messages (sender_id, sent_at DESC) WHERE sender_type = 'agent' AND sender_id IS NOT NULL`,
    `CREATE INDEX IF NOT EXISTS idx_messages_sent_at
       ON messages (sent_at DESC)`,
    `CREATE INDEX IF NOT EXISTS idx_conv_status_updated
       ON conversations (status, updated_at DESC)`,
    `CREATE INDEX IF NOT EXISTS idx_conv_email_shop
       ON conversations (customer_email, shop_id)`,
  ];
  for (const sql of statements) {
    console.log(`   [018] ${sql.match(/idx_[a-z_]+/)[0]}`);
    await db.query(sql);
  }
}

async function migration_019_add_response_stats_rollup(db) {
  await db.query(`
    CREATE TABLE IF NOT EXISTS agent_response_stats (
      sender_id               TEXT PRIMARY KEY,
      avg_response_minutes    NUMERIC,
      fastest_minutes         NUMERIC,
      total_responses_counted INTEGER DEFAULT 0,
      updated_at              TIMESTAMPTZ DEFAULT NOW()
    )
  `);
  await db.query(`
    CREATE TABLE IF NOT EXISTS agent_customer_response_stats (
      sender_id      TEXT NOT NULL,
      customer_email TEXT NOT NULL,
      avg_minutes    NUMERIC,
      response_count INTEGER DEFAULT 0,
      updated_at     TIMESTAMPTZ DEFAULT NOW(),
      PRIMARY KEY (sender_id, customer_email)
    )
  `);
  await db.query(`ALTER TABLE agent_customer_response_stats
                    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW()`);
}

async function migration_020_add_group_columns(db) {
  await db.query(`ALTER TABLE stores ADD COLUMN IF NOT EXISTS store_group VARCHAR(100) DEFAULT NULL`);
  await db.query(`ALTER TABLE stores ADD COLUMN IF NOT EXISTS store_group_name VARCHAR(150) DEFAULT NULL`);
  await db.query(`CREATE INDEX IF NOT EXISTS idx_stores_store_group
                    ON stores(store_group) WHERE store_group IS NOT NULL`);
}

async function migration_021_add_store_groups_table(db) {
  await db.query(`
    CREATE TABLE IF NOT EXISTS store_groups (
      id         SERIAL PRIMARY KEY,
      group_key  VARCHAR(100) UNIQUE NOT NULL,
      group_name VARCHAR(150) NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
  const backfill = await db.query(`
    INSERT INTO store_groups (group_key, group_name)
    SELECT DISTINCT ON (store_group) store_group, COALESCE(store_group_name, store_group)
      FROM stores WHERE store_group IS NOT NULL
     ORDER BY store_group, updated_at DESC
    ON CONFLICT (group_key) DO NOTHING
  `);
  console.log(`   [021] backfilled ${backfill.rowCount} group(s)`);
}

async function migration_022_add_group_color(db) {
  await db.query(`ALTER TABLE store_groups ADD COLUMN IF NOT EXISTS color VARCHAR(7) DEFAULT '#667eea'`);
}

// server.js prunes this table on an interval; make sure it exists so the
// prune job stops swallowing "relation does not exist".
async function migration_023_add_brain_backups(db) {
  await db.query(`
    CREATE TABLE IF NOT EXISTS ai_training_brain_backups (
      id           SERIAL PRIMARY KEY,
      brain_data   JSONB NOT NULL,
      backed_up_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      backed_up_by TEXT
    )
  `);
  await db.query(`CREATE INDEX IF NOT EXISTS idx_brain_backups_at
                    ON ai_training_brain_backups (backed_up_at DESC)`);
}


async function migration_024_last_message_at_index(db) {
  await db.query(`CREATE INDEX IF NOT EXISTS idx_conversations_last_message_at
                    ON conversations (last_message_at DESC)`);
}

// assigned_stores ships in the base CREATE TABLE, but any database created from
// an older bootstrap won't have it — and the per-agent store assignment feature
// silently no-ops rather than erroring if it's missing. NULL is normalised to an
// empty array so `= ANY(assigned_stores)` never has to deal with NULL.
async function migration_025_assigned_stores_guard(db) {
  await db.query(`ALTER TABLE employees ADD COLUMN IF NOT EXISTS assigned_stores INTEGER[] DEFAULT '{}'`);
  await db.query(`ALTER TABLE employees ADD COLUMN IF NOT EXISTS can_view_all_stores BOOLEAN DEFAULT true`);
  await db.query(`UPDATE employees SET assigned_stores = '{}' WHERE assigned_stores IS NULL`);
  await db.query(`ALTER TABLE employees ALTER COLUMN assigned_stores SET DEFAULT '{}'`);
}

// Store access is granted per GROUP. assigned_stores stays on the table as
// legacy data — nothing reads it for permissions any more — and anything
// already in it is converted to the groups those stores belong to, so an
// existing restricted agent doesn't silently lose access on deploy.
async function migration_026_assigned_groups(db) {
  await db.query(`ALTER TABLE employees ADD COLUMN IF NOT EXISTS assigned_groups TEXT[] DEFAULT '{}'`);
  await db.query(`UPDATE employees SET assigned_groups = '{}' WHERE assigned_groups IS NULL`);

  const backfill = await db.query(`
    UPDATE employees e
       SET assigned_groups = sub.groups
      FROM (
        SELECT e2.id,
               ARRAY(
                 SELECT DISTINCT s.store_group
                   FROM stores s
                  WHERE s.id = ANY(e2.assigned_stores)
                    AND s.store_group IS NOT NULL
               ) AS groups
          FROM employees e2
         WHERE e2.can_view_all_stores = false
           AND e2.assigned_stores IS NOT NULL
           AND array_length(e2.assigned_stores, 1) > 0
      ) sub
     WHERE e.id = sub.id
       AND array_length(sub.groups, 1) > 0
       AND (e.assigned_groups IS NULL OR array_length(e.assigned_groups, 1) IS NULL)
  `);
  console.log(`   [026] converted ${backfill.rowCount} employee(s) from per-store to per-group access`);
}

// ============================================================================
// SEARCH INDEXES — build out of band. See scripts/build-search-indexes.js
// ============================================================================

const SEARCH_INDEX_STATEMENTS = [
  `CREATE EXTENSION IF NOT EXISTS pg_trgm`,
  `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_messages_content_trgm
     ON messages USING gin (content gin_trgm_ops)`,
  `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_conv_email_trgm
     ON conversations USING gin (customer_email gin_trgm_ops)`,
  `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_conv_name_trgm
     ON conversations USING gin (customer_name gin_trgm_ops)`,
];

/**
 * Builds the trigram search indexes with CONCURRENTLY (no exclusive lock, safe
 * on live traffic) and no statement timeout. Can take many minutes. Idempotent.
 */
async function buildSearchIndexes() {
  return withMaintenance(async (mp) => {
    const outcome = await withAdvisoryLock(mp, LOCKS.SEARCH_INDEXES, async (client) => {
      for (const sql of SEARCH_INDEX_STATEMENTS) {
        const label = (sql.match(/idx_[a-z_]+/) || ['pg_trgm extension'])[0];
        const t0 = Date.now();
        process.stdout.write(`   building ${label} ... `);
        try {
          await client.query(sql);
          console.log(`done in ${Math.round((Date.now() - t0) / 1000)}s`);
        } catch (e) {
          // An INVALID index can be left behind if a CONCURRENTLY build is
          // interrupted; report it so it can be dropped and retried.
          console.log(`FAILED: ${e.message}`);
        }
      }
    });
    if (outcome.skipped) console.log('⏭️  Search index build already running elsewhere');
  });
}

/** Reports whether the search indexes exist and are valid. */
async function checkSearchIndexes() {
  const { rows } = await pool.query(`
    SELECT c.relname AS index_name, i.indisvalid AS valid
      FROM pg_class c
      JOIN pg_index i ON i.indexrelid = c.oid
     WHERE c.relname IN ('idx_messages_content_trgm','idx_conv_email_trgm','idx_conv_name_trgm')
  `);
  return rows;
}

// ============================================================================
// STORE FUNCTIONS
// ============================================================================

async function registerStore(storeData) {
  const {
    store_identifier, shop_domain, brand_name, access_token, api_key,
    api_secret, scope, timezone = 'UTC', currency = 'USD', logo_url,
    primary_color = '#667eea', contact_email, store_tags = [],
    store_group = null, store_group_name = null,
  } = storeData;
  const result = await pool.query(`
    INSERT INTO stores (
      store_identifier, shop_domain, brand_name, access_token, api_key,
      api_secret, scope, timezone, currency, logo_url, primary_color,
      contact_email, store_tags, store_group, store_group_name, installed_at, updated_at
    )
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,NOW(),NOW())
    ON CONFLICT (store_identifier) DO UPDATE SET
      shop_domain = $2, brand_name = $3, access_token = $4, api_key = $5,
      api_secret = $6, scope = $7, timezone = $8, currency = $9,
      logo_url = $10, primary_color = $11, contact_email = $12, store_tags = $13,
      store_group = COALESCE(stores.store_group, $14),
      store_group_name = COALESCE(stores.store_group_name, $15),
      updated_at = NOW()
    RETURNING *
  `, [store_identifier, shop_domain, brand_name, access_token, api_key, api_secret, scope,
      timezone, currency, logo_url, primary_color, contact_email, store_tags,
      store_group, store_group_name]);
  return result.rows[0];
}

async function getStoreByIdentifier(identifier) {
  const r = await pool.query(
    'SELECT * FROM stores WHERE store_identifier = $1 AND is_active = true', [identifier]);
  return r.rows[0] || null;
}

async function getStoreByDomain(domain) {
  const r = await pool.query(
    'SELECT * FROM stores WHERE shop_domain = $1 AND is_active = true', [domain]);
  return r.rows[0] || null;
}

async function getStoreById(id) {
  const r = await pool.query('SELECT * FROM stores WHERE id = $1 AND is_active = true', [id]);
  return r.rows[0] || null;
}

async function getAllActiveStores() {
  const r = await pool.query('SELECT * FROM stores WHERE is_active = true ORDER BY brand_name ASC');
  return r.rows;
}

/**
 * Lean store list for UI pickers (employee store assignment, filters).
 *
 * Deliberately NOT `SELECT *`: the stores row carries access_token, api_key and
 * api_secret, and any endpoint that hands getAllActiveStores() output to the
 * browser ships live Shopify credentials to the client. This returns only what
 * a picker needs.
 */
async function getStoresForAssignment() {
  const r = await pool.query(`
    SELECT id, store_identifier, shop_domain, brand_name,
           store_group, store_group_name, primary_color, is_active
      FROM stores
     WHERE is_active = true
     ORDER BY store_group NULLS LAST, brand_name ASC
  `);
  return r.rows;
}

async function getStoresByFilters(filters = {}) {
  let query = 'SELECT * FROM stores WHERE is_active = true';
  const params = [];
  if (filters.storeGroup) { params.push(filters.storeGroup); query += ` AND store_group = $${params.length}`; }
  query += ' ORDER BY brand_name ASC';
  const r = await pool.query(query, params);
  return r.rows;
}

async function updateStoreConnectionStatus(identifier, isConnected) {
  try {
    await pool.query(
      'UPDATE stores SET websocket_connected = $1, updated_at = NOW() WHERE store_identifier = $2',
      [isConnected, identifier]);
  } catch (e) { console.error('Error updating connection status:', e.message); }
}

async function updateStoreSettings(storeId, settings) {
  const fields = [];
  const values = [];
  let n = 1;
  for (const [key, value] of Object.entries(settings)) {
    fields.push(`${key} = $${n++}`);
    values.push(value);
  }
  fields.push('updated_at = NOW()');
  values.push(storeId);
  const r = await pool.query(
    `UPDATE stores SET ${fields.join(', ')} WHERE id = $${n} RETURNING *`, values);
  return r.rows[0];
}

// ============================================================================
// CONVERSATION FUNCTIONS
// ============================================================================

async function saveConversation(data) {
  const {
    store_id, store_identifier, customer_email, customer_name, customer_id,
    customer_phone, status = 'open', priority = 'normal', tags = [],
    cart_subtotal = 0, source = 'website',
  } = data;
  const r = await pool.query(`
    INSERT INTO conversations (
      shop_id, shop_domain, customer_email, customer_name, customer_id,
      customer_phone, status, priority, tags, cart_subtotal, source, created_at, updated_at
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,NOW(),NOW()) RETURNING *
  `, [store_id, store_identifier, customer_email, customer_name, customer_id,
      customer_phone, status, priority, tags, cart_subtotal, source]);
  return r.rows[0];
}

async function getConversation(conversationId, storeId = null) {
  let query = `SELECT c.*, s.brand_name, s.logo_url
                 FROM conversations c JOIN stores s ON c.shop_id = s.id
                WHERE c.id = $1`;
  const params = [conversationId];
  if (storeId) { params.push(storeId); query += ` AND c.shop_id = $${params.length}`; }
  const r = await pool.query(query, params);
  return r.rows[0] || null;
}

// async function getConversations(filters = {}) {
//   let query = `
//     SELECT c.*, s.brand_name, s.logo_url, s.primary_color, s.store_identifier,
//            lcm.content AS last_customer_message
//       FROM conversations c
//       JOIN stores s ON c.shop_id = s.id
//       LEFT JOIN LATERAL (
//         SELECT content FROM messages
//          WHERE conversation_id = c.id AND sender_type = 'customer'
//          ORDER BY id DESC LIMIT 1
//       ) lcm ON true
//      WHERE 1=1
//   `;
//   const params = [];
//   let n = 1;
//   if (filters.storeId)         { query += ` AND c.shop_id = $${n++}`;        params.push(filters.storeId); }
//   if (filters.storeIdentifier) { query += ` AND c.shop_domain = $${n++}`;    params.push(filters.storeIdentifier); }
//   if (filters.storeGroup)      { query += ` AND s.store_group = $${n++}`;    params.push(filters.storeGroup); }
//   if (filters.customerEmail)   { query += ` AND c.customer_email = $${n++}`; params.push(filters.customerEmail); }
//   if (filters.status)          { query += ` AND c.status = $${n++}`;         params.push(filters.status); }
//   if (!filters.status && filters.excludeArchived) query += ` AND c.status != 'archived'`;
//   if (filters.priority)        { query += ` AND c.priority = $${n++}`;       params.push(filters.priority); }
//   if (filters.assignedTo)      { query += ` AND c.assigned_to = $${n++}`;    params.push(filters.assignedTo); }
//   if (filters.search) {
//     query += ` AND (c.customer_email ILIKE $${n} OR c.customer_name ILIKE $${n})`;
//     params.push(`%${filters.search}%`); n++;
//   }
//   const limit  = Math.min(parseInt(filters.limit, 10) || 50, 100);
//   const offset = Math.max(parseInt(filters.offset, 10) || 0, 0);
//   query += ` ORDER BY c.updated_at DESC LIMIT $${n} OFFSET $${n + 1}`;
//   params.push(limit, offset);
//   const r = await pool.query(query, params);
//   return r.rows;
// }

async function getConversations(filters = {}) {
  let query = `
    SELECT c.*, s.brand_name, s.logo_url, s.primary_color, s.store_identifier,
           lcm.content AS last_customer_message
      FROM conversations c
      JOIN stores s ON c.shop_id = s.id
      LEFT JOIN LATERAL (
        SELECT content FROM messages
         WHERE conversation_id = c.id AND sender_type = 'customer'
         ORDER BY id DESC LIMIT 1
      ) lcm ON true
     WHERE 1=1
  `;
  const params = [];
  let n = 1;
  if (filters.storeId)         { query += ` AND c.shop_id = $${n++}`;        params.push(filters.storeId); }
  // Permission scope for agents restricted to specific store groups. An empty
  // array must match NOTHING — an unscoped fallback here would hand a
  // restricted agent the entire fleet, so this is checked with Array.isArray,
  // not length. Filtering on s.store_group (already joined, and indexed by
  // idx_stores_store_group) beats expanding a group to 600 shop_ids first.
  if (Array.isArray(filters.storeGroups)) {
    query += ` AND s.store_group = ANY($${n++}::text[])`;
    params.push(normalizeGroupKeys(filters.storeGroups));
  }
  if (filters.storeIdentifier) { query += ` AND c.shop_domain = $${n++}`;    params.push(filters.storeIdentifier); }
  if (filters.storeGroup)      { query += ` AND s.store_group = $${n++}`;    params.push(filters.storeGroup); }
  if (filters.customerEmail)   { query += ` AND c.customer_email = $${n++}`; params.push(filters.customerEmail); }
  if (filters.status)          { query += ` AND c.status = $${n++}`;         params.push(filters.status); }
  if (!filters.status && filters.excludeArchived) query += ` AND c.status != 'archived'`;
  if (filters.priority)        { query += ` AND c.priority = $${n++}`;       params.push(filters.priority); }
  if (filters.assignedTo)      { query += ` AND c.assigned_to = $${n++}`;    params.push(filters.assignedTo); }
  if (filters.search) {
    query += ` AND (c.customer_email ILIKE $${n} OR c.customer_name ILIKE $${n})`;
    params.push(`%${filters.search}%`); n++;
  }
  // ── date range: naive-UTC bounds matching the naive last_message_at column.
  //    Half-open (>= … <) so it stays index-usable. Filters on message activity,
  //    NOT updated_at (which bumps on read via markConversationRead). ──
  if (filters.dateFrom) { query += ` AND c.last_message_at >= $${n++}`; params.push(filters.dateFrom); }
  if (filters.dateTo)   { query += ` AND c.last_message_at <  $${n++}`; params.push(filters.dateTo); }
  const limit  = Math.min(parseInt(filters.limit, 10) || 50, 100);
  const offset = Math.max(parseInt(filters.offset, 10) || 0, 0);
  query += ` ORDER BY c.updated_at DESC LIMIT $${n} OFFSET $${n + 1}`;
  params.push(limit, offset);
  const r = await pool.query(query, params);
  return r.rows;
}

async function getConversationCount(filters = {}) {
  let query = 'SELECT COUNT(*) FROM conversations WHERE 1=1';
  const params = [];
  let n = 1;
  if (filters.storeId) { query += ` AND shop_id = $${n++}`; params.push(filters.storeId); }
  // Must mirror getConversations, or a restricted agent sees "247 conversations"
  // above a list containing 12. No stores join here, so the group filter goes
  // through a subquery.
  if (Array.isArray(filters.storeGroups)) {
    query += ` AND shop_id IN (SELECT id FROM stores WHERE store_group = ANY($${n++}::text[]))`;
    params.push(normalizeGroupKeys(filters.storeGroups));
  }
  if (filters.status)  { query += ` AND status = $${n++}`;  params.push(filters.status); }
  const r = await pool.query(query, params);
  return parseInt(r.rows[0].count, 10);
}

const CONVERSATION_UPDATABLE = new Set([
  'status', 'priority', 'assigned_to', 'tags', 'customer_name', 'customer_email',
  'customer_phone', 'customer_id', 'unread_count', 'closed_at', 'archived_at',
  'last_read_at', 'cart_subtotal', 'source', 'legal_flag', 'legal_flag_severity',
]);

async function updateConversation(conversationId, updates) {
  const fields = [];
  const values = [];
  let n = 1;
  for (const [key, value] of Object.entries(updates)) {
    // Whitelist: this is fed straight from req.body in PUT /api/conversations/:id
    if (!CONVERSATION_UPDATABLE.has(key)) continue;
    fields.push(`${key} = $${n++}`);
    values.push(value);
  }
  if (!fields.length) throw new Error('No valid fields to update');
  fields.push('updated_at = NOW()');
  values.push(conversationId);
  const r = await pool.query(
    `UPDATE conversations SET ${fields.join(', ')} WHERE id = $${n} RETURNING *`, values);
  return r.rows[0];
}

async function closeConversation(conversationId) {
  const r = await pool.query(
    `UPDATE conversations SET status = 'closed', closed_at = NOW(), updated_at = NOW()
      WHERE id = $1 RETURNING *`, [conversationId]);
  return r.rows[0];
}

async function assignConversation(conversationId, employeeEmail) {
  const r = await pool.query(
    `UPDATE conversations SET assigned_to = $1, updated_at = NOW() WHERE id = $2 RETURNING *`,
    [employeeEmail, conversationId]);
  return r.rows[0];
}

// Single round trip instead of two sequential UPDATEs.
async function markConversationRead(conversationId) {
  await pool.query(`
    WITH c AS (
      UPDATE conversations SET unread_count = 0, last_read_at = NOW(), updated_at = NOW()
       WHERE id = $1
    )
    UPDATE messages SET read_at = NOW()
     WHERE conversation_id = $1 AND sender_type = 'customer' AND read_at IS NULL
  `, [conversationId]);
}

// ============================================================================
// STORE GROUP FUNCTIONS
// ============================================================================

async function getAllStoreGroups() {
  const r = await pool.query(`
    SELECT sg.id, sg.group_key AS store_group, sg.group_name AS store_group_name, sg.color,
           sg.created_at, sg.updated_at,
           COUNT(s.id) FILTER (WHERE s.is_active = true)::int AS store_count
      FROM store_groups sg
      LEFT JOIN stores s ON s.store_group = sg.group_key
     GROUP BY sg.id, sg.group_key, sg.group_name, sg.color, sg.created_at, sg.updated_at
     ORDER BY sg.group_name ASC
  `);
  return r.rows;
}

async function createStoreGroup({ group_key, group_name, color = '#667eea' }) {
  const r = await pool.query(`
    INSERT INTO store_groups (group_key, group_name, color, created_at, updated_at)
    VALUES ($1, $2, $3, NOW(), NOW())
    RETURNING id, group_key AS store_group, group_name AS store_group_name, color, created_at, updated_at
  `, [group_key, group_name, color || '#667eea']);
  return r.rows[0];
}

async function updateStoreGroup(id, { group_key, group_name, color }) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const existing = await client.query('SELECT * FROM store_groups WHERE id = $1', [id]);
    if (!existing.rows[0]) { await client.query('ROLLBACK'); return null; }
    const oldKey = existing.rows[0].group_key;

    const r = await client.query(`
      UPDATE store_groups SET group_key = $1, group_name = $2, color = $3, updated_at = NOW()
       WHERE id = $4
      RETURNING id, group_key AS store_group, group_name AS store_group_name, color, created_at, updated_at
    `, [group_key, group_name, color || existing.rows[0].color, id]);

    // Keep both the key and the denormalised name on stores in sync.
    if (group_key !== oldKey) {
      await client.query(
        `UPDATE stores SET store_group = $1, store_group_name = $2, updated_at = NOW()
          WHERE store_group = $3`, [group_key, group_name, oldKey]);
    } else {
      await client.query(
        `UPDATE stores SET store_group_name = $1, updated_at = NOW() WHERE store_group = $2`,
        [group_name, group_key]);
    }
    await client.query('COMMIT');
    return r.rows[0];
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    throw e;
  } finally {
    client.release();
  }
}

async function deleteStoreGroup(id, { force = false } = {}) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const existing = await client.query('SELECT * FROM store_groups WHERE id = $1', [id]);
    if (!existing.rows[0]) { await client.query('ROLLBACK'); return { deleted: false, reason: 'not_found' }; }
    const { group_key } = existing.rows[0];

    const countResult = await client.query(
      'SELECT COUNT(*)::int AS n FROM stores WHERE store_group = $1', [group_key]);
    const storeCount = countResult.rows[0].n;

    if (storeCount > 0 && !force) {
      await client.query('ROLLBACK');
      return { deleted: false, reason: 'has_stores', storeCount };
    }
    if (storeCount > 0 && force) {
      await client.query(
        `UPDATE stores SET store_group = NULL, store_group_name = NULL, updated_at = NOW()
          WHERE store_group = $1`, [group_key]);
    }
    await client.query('DELETE FROM store_groups WHERE id = $1', [id]);
    await client.query('COMMIT');
    return { deleted: true, unassignedStores: storeCount };
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    throw e;
  } finally {
    client.release();
  }
}

// ============================================================================
// MESSAGE FUNCTIONS
// ============================================================================

async function saveMessage(data) {
  const {
    conversation_id, store_id, sender_type, sender_name, sender_id,
    content, message_type = 'text', attachment_url, attachment_type, file_data,
  } = data;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const messageResult = await client.query(`
      INSERT INTO messages (
        conversation_id, shop_id, sender_type, sender_name, sender_id,
        content, message_type, attachment_url, attachment_type, file_data, sent_at, timestamp
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,NOW(),NOW()) RETURNING *
    `, [conversation_id, store_id, sender_type, sender_name, sender_id,
        content, message_type, attachment_url, attachment_type, file_data]);
    const message = messageResult.rows[0];

    const updateFields = [
      'total_message_count = total_message_count + 1',
      'last_message_at = NOW()',
      'updated_at = NOW()',
      'last_message = $2',
      'last_message_sender_type = $3',
    ];
    if (sender_type === 'customer') {
      updateFields.push('customer_message_count = customer_message_count + 1');
      updateFields.push('last_customer_message_at = NOW()');
      updateFields.push('unread_count = unread_count + 1');
      updateFields.push(`auto_replied_at = CASE
        WHEN auto_replied_at IS NULL OR auto_replied_at < NOW() - INTERVAL '8 hours'
        THEN NULL ELSE auto_replied_at END`);
    } else if (sender_type === 'agent') {
      updateFields.push('agent_message_count = agent_message_count + 1');
      updateFields.push('last_agent_message_at = NOW()');
      updateFields.push('agent_replied_at = COALESCE(agent_replied_at, NOW())');
      updateFields.push(`response_time_seconds = CASE
        WHEN last_agent_message_at IS NULL AND first_message_at IS NOT NULL
        THEN EXTRACT(EPOCH FROM (NOW() - first_message_at))::INTEGER
        ELSE response_time_seconds END`);
    }
    updateFields.push('first_message_at = COALESCE(first_message_at, NOW())');

    await client.query(
      `UPDATE conversations SET ${updateFields.join(', ')} WHERE id = $1`,
      [conversation_id, content, sender_type]);
    await client.query('COMMIT');
    return parseMessageFileData(message);
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('❌ [saveMessage] Error:', error.message);
    throw error;
  } finally {
    client.release();
  }
}

/**
 * getMessages(id)                     → full history, oldest→newest
 * getMessages(id, { limit })          → newest `limit`, returned oldest→newest
 * getMessages(id, { limit, before })  → page older than cursor id `before`
 *
 * Callers should always pass a limit. The unbounded form pulls the whole thread
 * through the regex-cast employees join.
 */
async function getMessages(conversationId, options = {}) {
  const { limit = null, before = null } = options;
  const joinClause = `
    LEFT JOIN employees e ON (
      m.sender_type = 'agent' AND m.sender_id IS NOT NULL
      AND m.sender_id ~ '^[0-9]+$' AND CAST(m.sender_id AS INTEGER) = e.id
    )`;

  if (limit) {
    const params = [conversationId];
    let cursor = '';
    if (before) { params.push(before); cursor = `AND m.id < $${params.length}`; }
    params.push(limit);
    const r = await pool.query(
      `SELECT * FROM (
         SELECT m.*, e.name AS sender_display_name, e.employee_name AS sender_employee_name
           FROM messages m ${joinClause}
          WHERE m.conversation_id = $1 ${cursor}
          ORDER BY m.id DESC LIMIT $${params.length}
       ) sub ORDER BY sub.id ASC`, params);
    return r.rows.map(parseMessageFileData);
  }

  const r = await pool.query(
    `SELECT m.*, e.name AS sender_display_name, e.employee_name AS sender_employee_name
       FROM messages m ${joinClause}
      WHERE m.conversation_id = $1
      ORDER BY m.timestamp ASC`, [conversationId]);
  return r.rows.map(parseMessageFileData);
}

async function markMessageDelivered(messageId) {
  try { await pool.query('UPDATE messages SET delivered_at = NOW() WHERE id = $1', [messageId]); }
  catch (e) { console.error('Error marking message delivered:', e.message); }
}

async function markMessageRead(messageId) {
  try { await pool.query('UPDATE messages SET read_at = NOW() WHERE id = $1', [messageId]); }
  catch (e) { console.error('Error marking message read:', e.message); }
}

async function markMessageFailed(messageId, error) {
  try {
    await pool.query(
      'UPDATE messages SET failed = true, routing_error = $1, retry_count = retry_count + 1 WHERE id = $2',
      [error, messageId]);
  } catch (e) { console.error('Error marking message failed:', e.message); }
}

// ============================================================================
// EMPLOYEE FUNCTIONS
// ============================================================================

async function createEmployee(data) {
  const {
    email, name, employee_name = null, password_hash, role = 'agent',
    can_view_all_stores = true, assigned_groups = [], is_active = true,
  } = data;
  if (!email || !name) throw new Error('Email and name are required');
  if (!password_hash) throw new Error('password_hash is required');

  // Full-access accounts store an empty list. Keeping a stale assignment set on
  // a can_view_all_stores account means narrowing access later silently
  // restores whatever was picked months ago.
  const groups = can_view_all_stores ? [] : normalizeGroupKeys(assigned_groups);

  const r = await pool.query(`
    INSERT INTO employees (email, name, employee_name, password_hash, role,
                           can_view_all_stores, assigned_groups, is_active, created_at, updated_at)
    VALUES ($1,$2,$3,$4,$5,$6,$7::text[],$8,NOW(),NOW()) RETURNING *
  `, [email, name, employee_name, password_hash, role, can_view_all_stores, groups, is_active]);
  return r.rows[0];
}

async function getEmployeeByEmail(email) {
  const r = await pool.query('SELECT * FROM employees WHERE email = $1 AND is_active = true', [email]);
  return r.rows[0] || null;
}

async function getEmployeeById(id) {
  const r = await pool.query('SELECT * FROM employees WHERE id = $1 AND is_active = true', [id]);
  return r.rows[0] || null;
}

async function getAllEmployees() {
  const r = await pool.query('SELECT * FROM employees ORDER BY created_at DESC');
  return r.rows;
}

async function updateEmployee(employeeId, updates) {
  const allowed = ['name','employee_name','email','role','password_hash','is_active',
                   'can_view_all_stores','assigned_groups','last_login','is_online','current_status'];
  const fields = [];
  const values = [];
  let n = 1;
  for (const [key, value] of Object.entries(updates)) {
    if (!allowed.includes(key)) continue;
    if (key === 'assigned_groups') {
      // Cast explicitly rather than relying on node-postgres inference — an
      // empty JS array would otherwise arrive as an untyped array literal.
      fields.push(`assigned_groups = $${n++}::text[]`);
      values.push(normalizeGroupKeys(value));
      continue;
    }
    fields.push(`${key} = $${n++}`);
    values.push(value);
  }
  if (!fields.length) throw new Error('No valid fields to update');

  // Granting full access clears the assignment set even when the caller didn't
  // send assigned_groups, so the two columns can never disagree.
  if (updates.can_view_all_stores === true && !('assigned_groups' in updates)) {
    fields.push(`assigned_groups = '{}'::text[]`);
  }

  fields.push('updated_at = NOW()');
  values.push(employeeId);
  const r = await pool.query(
    `UPDATE employees SET ${fields.join(', ')} WHERE id = $${n} RETURNING *`, values);
  return r.rows[0];
}

/**
 * Resolve an employee's store permission scope.
 *
 * Returns { canViewAll: true, groups: null } for unrestricted accounts, or
 * { canViewAll: false, groups: [...] } for restricted ones. Pass groups
 * straight into getConversations({ storeGroups }) — and note that a restricted
 * agent with an empty array correctly sees nothing rather than everything.
 */
async function getEmployeeStoreScope(employeeId) {
  const r = await pool.query(
    'SELECT can_view_all_stores, assigned_groups FROM employees WHERE id = $1', [employeeId]);
  if (!r.rows[0]) return { canViewAll: false, groups: [] };
  const row = r.rows[0];
  if (row.can_view_all_stores) return { canViewAll: true, groups: null };
  return { canViewAll: false, groups: normalizeGroupKeys(row.assigned_groups) };
}

/** True when the employee may act on the given store id. */
async function employeeCanAccessStore(employeeId, storeId) {
  const scope = await getEmployeeStoreScope(employeeId);
  if (scope.canViewAll) return true;
  const id = parseInt(storeId, 10);
  if (!Number.isInteger(id)) return false;
  const { rows } = await pool.query(
    'SELECT store_group FROM stores WHERE id = $1', [id]);
  // A store with no group can only be reached by a full-access account —
  // otherwise an ungrouped store would be visible to everyone or no one by
  // accident rather than by decision.
  if (!rows[0] || !rows[0].store_group) return false;
  return scope.groups.includes(rows[0].store_group);
}

async function deleteEmployee(employeeId) {
  const r = await pool.query(
    'UPDATE employees SET is_active = false, updated_at = NOW() WHERE id = $1 RETURNING *',
    [employeeId]);
  return r.rows[0];
}

async function updateEmployeeStatus(employeeId, status) {
  try {
    if (status && typeof status === 'object') {
      const updates = {};
      if (status.last_login) updates.last_login = status.last_login;
      if (status.is_online !== undefined) updates.is_online = status.is_online;
      if (status.current_status) updates.current_status = status.current_status;
      if (!Object.keys(updates).length) return null;
      return await updateEmployee(employeeId, updates);
    }
    await pool.query(
      'UPDATE employees SET current_status = $1, is_online = $2, updated_at = NOW() WHERE id = $3',
      [status, status === 'online', employeeId]);
  } catch (e) { console.error('Error updating employee status:', e.message); }
}

async function updateEmployeeNotesOrder(employeeId, order) {
  const r = await pool.query(
    `UPDATE employees SET notes_order = $1, updated_at = NOW() WHERE id = $2 RETURNING notes_order`,
    [JSON.stringify(order), employeeId]);
  return r.rows[0];
}

async function logAgentActivity(data) {
  const { employee_id, conversation_id, store_id, action, action_data } = data;
  try {
    await pool.query(`
      INSERT INTO agent_activity (employee_id, conversation_id, shop_id, action, action_data, created_at)
      VALUES ($1,$2,$3,$4,$5,NOW())
    `, [employee_id, conversation_id, store_id, action, action_data]);
  } catch (e) { console.error('Error logging agent activity:', e.message); }
}

// ============================================================================
// RESPONSE-TIME ROLLUP
// ============================================================================
// Runs on the maintenance pool (no 15s cap — this is why it never used to
// complete) under an advisory lock so only one instance recomputes. Window
// narrowed 90d → configurable (default 21d) and the DELETE-all replaced with
// an upsert so the table is never empty mid-refresh.

const STATS_WINDOW_DAYS = Number(process.env.STATS_WINDOW_DAYS || 21);

async function refreshResponseStats() {
  return withMaintenance(async (mp) => {
    const outcome = await withAdvisoryLock(mp, LOCKS.RESPONSE_STATS, async (client) => {
      const t0 = Date.now();

      await client.query(`
        INSERT INTO agent_response_stats
          (sender_id, avg_response_minutes, fastest_minutes, total_responses_counted, updated_at)
        WITH real_messages AS (
          SELECT sender_id, sender_type, sent_at,
            LAG(sender_type) OVER (PARTITION BY conversation_id ORDER BY sent_at) AS prev_sender_type,
            LAG(sent_at)     OVER (PARTITION BY conversation_id ORDER BY sent_at) AS prev_sent_at
          FROM messages
          WHERE sender_type IN ('customer','agent')
            AND NOT (sender_type = 'agent' AND sender_id IS NULL)
            AND sent_at >= NOW() - ($1 || ' days')::interval
        ),
        rt AS (
          SELECT sender_id, EXTRACT(EPOCH FROM (sent_at - prev_sent_at)) / 60.0 AS m
          FROM real_messages
          WHERE sender_type = 'agent' AND sender_id IS NOT NULL
            AND prev_sender_type = 'customer' AND prev_sent_at IS NOT NULL
            AND EXTRACT(EPOCH FROM (sent_at - prev_sent_at)) / 60.0 BETWEEN 0 AND 240
        )
        SELECT sender_id, ROUND(AVG(m)::numeric,1), ROUND(MIN(m)::numeric,1), COUNT(*)::int, NOW()
          FROM rt GROUP BY sender_id
        ON CONFLICT (sender_id) DO UPDATE SET
          avg_response_minutes    = EXCLUDED.avg_response_minutes,
          fastest_minutes         = EXCLUDED.fastest_minutes,
          total_responses_counted = EXCLUDED.total_responses_counted,
          updated_at              = NOW()
      `, [STATS_WINDOW_DAYS]);

      await client.query(`
        INSERT INTO agent_customer_response_stats
          (sender_id, customer_email, avg_minutes, response_count, updated_at)
        WITH real_messages AS (
          SELECT m.sender_id, m.sender_type, m.sent_at, c.customer_email,
            LAG(m.sender_type) OVER (PARTITION BY m.conversation_id ORDER BY m.sent_at) AS prev_sender_type,
            LAG(m.sent_at)     OVER (PARTITION BY m.conversation_id ORDER BY m.sent_at) AS prev_sent_at
          FROM messages m
          JOIN conversations c ON c.id = m.conversation_id
          WHERE m.sender_type IN ('customer','agent')
            AND NOT (m.sender_type = 'agent' AND m.sender_id IS NULL)
            AND m.sent_at >= NOW() - ($1 || ' days')::interval
        )
        SELECT sender_id, customer_email,
               ROUND(AVG(EXTRACT(EPOCH FROM (sent_at - prev_sent_at)) / 60.0)::numeric, 1),
               COUNT(*)::int, NOW()
          FROM real_messages
         WHERE sender_type = 'agent' AND sender_id IS NOT NULL
           AND prev_sender_type = 'customer' AND prev_sent_at IS NOT NULL
           AND EXTRACT(EPOCH FROM (sent_at - prev_sent_at)) / 60.0 BETWEEN 0 AND 240
           AND customer_email IS NOT NULL AND customer_email <> ''
         GROUP BY sender_id, customer_email
        ON CONFLICT (sender_id, customer_email) DO UPDATE SET
          avg_minutes    = EXCLUDED.avg_minutes,
          response_count = EXCLUDED.response_count,
          updated_at     = NOW()
      `, [STATS_WINDOW_DAYS]);

      // Drop pairs that fell out of the window entirely.
      await client.query(
        `DELETE FROM agent_customer_response_stats WHERE updated_at < NOW() - INTERVAL '7 days'`);

      console.log(`📊 [Stats] Rollup refreshed in ${Math.round((Date.now() - t0) / 1000)}s (${STATS_WINDOW_DAYS}d window)`);
    });
    if (outcome.skipped) console.log('⏭️  [Stats] Rollup already running on another instance');
  });
}

async function getAgentResponseStats() {
  const { rows } = await pool.query('SELECT * FROM agent_response_stats');
  const byId = {};
  for (const r of rows) {
    byId[String(r.sender_id)] = {
      avgResponseMinutes: r.avg_response_minutes !== null ? parseFloat(r.avg_response_minutes) : null,
      fastestMinutes: r.fastest_minutes !== null ? parseFloat(r.fastest_minutes) : null,
      totalResponsesCounted: r.total_responses_counted,
    };
  }
  return byId;
}

async function getAgentCustomerResponseStats() {
  // Cap per agent so one chatty agent can't return tens of thousands of rows.
  const { rows } = await pool.query(`
    SELECT * FROM (
      SELECT *, ROW_NUMBER() OVER (PARTITION BY sender_id ORDER BY response_count DESC) AS rn
        FROM agent_customer_response_stats
    ) t WHERE rn <= 50 ORDER BY sender_id, response_count DESC
  `);
  const byAgent = {};
  for (const r of rows) {
    const key = String(r.sender_id);
    if (!byAgent[key]) byAgent[key] = [];
    byAgent[key].push({
      customerEmail: r.customer_email,
      avgResponseMinutes: r.avg_minutes !== null ? parseFloat(r.avg_minutes) : null,
      responseCount: r.response_count,
    });
  }
  return byAgent;
}

// ============================================================================
// WEBHOOKS / CANNED RESPONSES / TEMPLATES
// ============================================================================

async function logWebhook(data) {
  const { store_id, topic, payload, headers } = data;
  try {
    await pool.query(
      `INSERT INTO webhook_logs (shop_id, topic, payload, headers, received_at)
       VALUES ($1,$2,$3,$4,NOW())`, [store_id, topic, payload, headers]);
  } catch (e) { console.error('Error logging webhook:', e.message); }
}

async function getCannedResponses(storeId) {
  const r = await pool.query(
    'SELECT * FROM canned_responses WHERE shop_id = $1 ORDER BY category, title', [storeId]);
  return r.rows;
}

async function createCannedResponse(data) {
  const { store_id, title, content, shortcut, category, created_by } = data;
  const r = await pool.query(`
    INSERT INTO canned_responses (shop_id, title, content, shortcut, category, created_by, created_at, updated_at)
    VALUES ($1,$2,$3,$4,$5,$6,NOW(),NOW()) RETURNING *
  `, [store_id, title, content, shortcut, category, created_by]);
  return r.rows[0];
}

async function getTemplatesByUserId(userId) {
  const r = await pool.query(
    `SELECT id, user_id, name, content, created_at, updated_at
       FROM message_templates WHERE user_id = $1 ORDER BY created_at DESC`, [userId]);
  return r.rows;
}

async function getTemplateById(templateId) {
  const r = await pool.query(
    `SELECT id, user_id, name, content, created_at, updated_at
       FROM message_templates WHERE id = $1`, [templateId]);
  return r.rows[0] || null;
}

async function createTemplate({ user_id, name, content }) {
  const r = await pool.query(
    `INSERT INTO message_templates (user_id, name, content) VALUES ($1,$2,$3)
     RETURNING id, user_id, name, content, created_at, updated_at`, [user_id, name, content]);
  return r.rows[0];
}

async function updateTemplate(templateId, { name, content }) {
  const r = await pool.query(
    `UPDATE message_templates SET name = $1, content = $2, updated_at = CURRENT_TIMESTAMP
      WHERE id = $3 RETURNING id, user_id, name, content, created_at, updated_at`,
    [name, content, templateId]);
  return r.rows[0];
}

async function deleteTemplate(templateId) {
  await pool.query('DELETE FROM message_templates WHERE id = $1', [templateId]);
  return { success: true };
}

// ============================================================================
// ANALYTICS
// ============================================================================

async function getDashboardStats(filters = {}) {
  const params = [];
  let storeFilter = '';
  if (filters.storeId) { params.push(filters.storeId); storeFilter = 'AND shop_id = $1'; }

  const [convStats, msgStats] = await Promise.all([
    pool.query(`
      SELECT COUNT(*)                                   AS total_conversations,
             COUNT(*) FILTER (WHERE status = 'open')     AS open_conversations,
             COUNT(*) FILTER (WHERE status = 'pending')  AS pending_conversations,
             COUNT(*) FILTER (WHERE status = 'closed')   AS closed_conversations,
             COUNT(DISTINCT shop_id)                     AS active_stores,
             COUNT(DISTINCT customer_email)              AS unique_customers,
             AVG(response_time_seconds) FILTER (WHERE response_time_seconds IS NOT NULL) AS avg_response_time
        FROM conversations WHERE status != 'archived' ${storeFilter}
    `, params),
    pool.query(
      `SELECT COUNT(*) AS messages_today FROM messages
        WHERE timestamp >= CURRENT_DATE ${storeFilter}`, params),
  ]);

  return { ...convStats.rows[0], messages_today: msgStats.rows[0].messages_today };
}

async function getStoreMetrics(storeId, days = 30) {
  const safeDays = Math.min(Math.max(parseInt(days, 10) || 30, 1), 365);
  const r = await pool.query(`
    SELECT date, total_conversations, new_conversations, closed_conversations,
           total_messages, average_response_time_seconds
      FROM analytics_daily
     WHERE shop_id = $1 AND date >= CURRENT_DATE - ($2 || ' days')::interval
     ORDER BY date DESC
  `, [storeId, safeDays]);
  return r.rows;
}

// ============================================================================
// UTILITY
// ============================================================================

/** Throws on failure — callers depend on that. */
async function testConnection() {
  const r = await pool.query('SELECT NOW()');
  return r.rows[0].now;
}

/** Retries a cold/suspended DB instead of exiting on the first miss. */
async function waitForDatabase(attempts = 5) {
  for (let i = 1; i <= attempts; i++) {
    try {
      const now = await testConnection();
      console.log(`✅ Database connection successful: ${now}`);
      return true;
    } catch (e) {
      if (i === attempts) throw new Error(`Database unreachable after ${attempts} attempts: ${e.message}`);
      const wait = 2000 * i;
      console.warn(`⏳ DB not ready (${i}/${attempts}): ${e.message} — retrying in ${wait}ms`);
      await new Promise(r => setTimeout(r, wait));
    }
  }
}

async function closePool() {
  await pool.end().catch(() => {});
}

module.exports = {
  pool,
  LOCKS,
  maintenancePool,
  withMaintenance,
  withAdvisoryLock,
  getPoolStats,
  initDatabase,
  runMigrations,
  buildSearchIndexes,
  checkSearchIndexes,
  testConnection,
  waitForDatabase,
  closePool,
  normalizeStoreIds,
  normalizeGroupKeys,
  registerStore,
  getStoreByIdentifier,
  getStoreByDomain,
  getStoreById,
  getAllActiveStores,
  getStoresForAssignment,
  getStoresByFilters,
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
  updateEmployeeNotesOrder,
  getEmployeeStoreScope,
  employeeCanAccessStore,
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
  refreshResponseStats,
  getAgentResponseStats,
  getAgentCustomerResponseStats,
  getAllStoreGroups,
  createStoreGroup,
  updateStoreGroup,
  deleteStoreGroup,
};