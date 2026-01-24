//backend/db/schema.js

const { pgTable, serial, varchar, text, boolean, timestamp, integer, decimal, jsonb, date, unique } = require('drizzle-orm/pg-core');
const { relations } = require('drizzle-orm');

const stores = pgTable('stores', {
  id: serial('id').primaryKey(),
  storeIdentifier: varchar('store_identifier', { length: 100 }).notNull().unique(),
  shopDomain: varchar('shop_domain', { length: 255 }).notNull().unique(),
  brandName: varchar('brand_name', { length: 255 }).notNull(),
  accessToken: text('access_token').notNull(),
  apiKey: varchar('api_key', { length: 255 }),
  apiSecret: text('api_secret'),
  scope: text('scope'),
  isActive: boolean('is_active').default(true),
  websocketConnected: boolean('websocket_connected').default(false),
  lastWebhookAt: timestamp('last_webhook_at'),
  installedAt: timestamp('installed_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
  timezone: varchar('timezone', { length: 50 }).default('UTC'),
  currency: varchar('currency', { length: 3 }).default('USD'),
  logoUrl: text('logo_url'),
  primaryColor: varchar('primary_color', { length: 7 }).default('#667eea'),
  contactEmail: varchar('contact_email', { length: 255 }),
  supportTeam: varchar('support_team', { length: 255 }),
  storeTags: text('store_tags').array(),
  autoReplyEnabled: boolean('auto_reply_enabled').default(false),
  businessHours: jsonb('business_hours'),
  widgetSettings: jsonb('widget_settings'),
});

// ✅ UPDATED: Match actual database structure
const conversations = pgTable('conversations', {
  id: serial('id').primaryKey(),
  shopId: integer('shop_id'),
  shopDomain: varchar('shop_domain', { length: 255 }),
  customerEmail: varchar('customer_email', { length: 255 }),
  customerName: varchar('customer_name', { length: 255 }),
  customerId: varchar('customer_id', { length: 255 }),
  status: varchar('status', { length: 50 }),
  cartSubtotal: decimal('cart_subtotal', { precision: 10, scale: 2 }).default('0'),
  source: varchar('source', { length: 100 }),

  // ✅ Unread tracking
  unreadCount: integer('unread_count').default(0),
  lastReadAt: timestamp('last_read_at'),

  // ✅ ADD THESE NEW FIELDS:
  lastMessage: text('last_message'),
  lastMessageSenderType: varchar('last_message_sender_type', { length: 50 }),
  lastMessageAt: timestamp('last_message_at'),

  createdAt: timestamp('created_at'),
  updatedAt: timestamp('updated_at'),
});

const messages = pgTable('messages', {
  id: serial('id').primaryKey(),
  conversationId: integer('conversation_id').references(() => conversations.id, { onDelete: 'cascade' }),
  storeId: integer('shop_id').references(() => stores.id, { onDelete: 'cascade' }),
  senderType: varchar('sender_type', { length: 50 }).notNull(),
  senderName: varchar('sender_name', { length: 255 }),
  senderId: varchar('sender_id', { length: 255 }),
  content: text('content').notNull(),
  messageType: varchar('message_type', { length: 50 }).default('text'),
  attachmentUrl: text('attachment_url'),
  attachmentType: varchar('attachment_type', { length: 50 }),
  sentAt: timestamp('sent_at').defaultNow(),
  deliveredAt: timestamp('delivered_at'),
  readAt: timestamp('read_at'),
  failed: boolean('failed').default(false),
  retryCount: integer('retry_count').default(0),
  routedSuccessfully: boolean('routed_successfully').default(true),
  routingError: text('routing_error'),
  timestamp: timestamp('timestamp').defaultNow(),
});

const employees = pgTable('employees', {
  id: serial('id').primaryKey(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  name: varchar('name', { length: 255 }).notNull(),
  role: varchar('role', { length: 50 }).default('agent'),
  passwordHash: text('password_hash').notNull(),
  apiToken: text('api_token').unique(),
  lastLogin: timestamp('last_login'),
  canViewAllStores: boolean('can_view_all_stores').default(true),
  assignedStores: integer('assigned_stores').array(),
  isActive: boolean('is_active').default(true),
  isOnline: boolean('is_online').default(false),
  currentStatus: varchar('current_status', { length: 50 }).default('offline'),
  totalConversationsHandled: integer('total_conversations_handled').default(0),
  averageResponseTimeSeconds: integer('average_response_time_seconds').default(0),
  customerSatisfactionScore: decimal('customer_satisfaction_score', { precision: 3, scale: 2 }),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

const agentActivity = pgTable('agent_activity', {
  id: serial('id').primaryKey(),
  employeeId: integer('employee_id').references(() => employees.id, { onDelete: 'cascade' }),
  conversationId: integer('conversation_id').references(() => conversations.id, { onDelete: 'cascade' }),
  storeId: integer('shop_id').references(() => stores.id, { onDelete: 'cascade' }),
  action: varchar('action', { length: 100 }).notNull(),
  actionData: jsonb('action_data'),
  createdAt: timestamp('created_at').defaultNow(),
});

const webhookLogs = pgTable('webhook_logs', {
  id: serial('id').primaryKey(),
  storeId: integer('shop_id').references(() => stores.id, { onDelete: 'cascade' }),
  topic: varchar('topic', { length: 255 }).notNull(),
  payload: jsonb('payload'),
  headers: jsonb('headers'),
  processed: boolean('processed').default(false),
  processingError: text('processing_error'),
  receivedAt: timestamp('received_at').defaultNow(),
  processedAt: timestamp('processed_at'),
});

const cannedResponses = pgTable('canned_responses', {
  id: serial('id').primaryKey(),
  storeId: integer('shop_id').references(() => stores.id, { onDelete: 'cascade' }),
  title: varchar('title', { length: 255 }).notNull(),
  content: text('content').notNull(),
  shortcut: varchar('shortcut', { length: 50 }),
  category: varchar('category', { length: 100 }),
  usageCount: integer('usage_count').default(0),
  createdBy: integer('created_by').references(() => employees.id),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

const analyticsDaily = pgTable('analytics_daily', {
  id: serial('id').primaryKey(),
  storeId: integer('shop_id').references(() => stores.id, { onDelete: 'cascade' }),
  date: date('date').notNull(),
  totalConversations: integer('total_conversations').default(0),
  newConversations: integer('new_conversations').default(0),
  closedConversations: integer('closed_conversations').default(0),
  totalMessages: integer('total_messages').default(0),
  customerMessages: integer('customer_messages').default(0),
  agentMessages: integer('agent_messages').default(0),
  averageResponseTimeSeconds: integer('average_response_time_seconds'),
  averageResolutionTimeSeconds: integer('average_resolution_time_seconds'),
  firstResponseTimeSeconds: integer('first_response_time_seconds'),
  uniqueCustomers: integer('unique_customers').default(0),
  returningCustomers: integer('returning_customers').default(0),
  createdAt: timestamp('created_at').defaultNow(),
}, (table) => ({
  uniqueStoreDate: unique().on(table.storeId, table.date),
}));

module.exports = {
  stores,
  conversations,
  messages,
  employees,
  agentActivity,
  webhookLogs,
  cannedResponses,
  analyticsDaily,
};