import { pgTable, index, foreignKey, serial, integer, varchar, text, timestamp, unique, boolean, jsonb, numeric, date } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"



export const messages = pgTable("messages", {
	id: serial().primaryKey().notNull(),
	conversationId: integer("conversation_id"),
	senderType: varchar("sender_type", { length: 50 }).notNull(),
	senderName: varchar("sender_name", { length: 255 }),
	content: text().notNull(),
	timestamp: timestamp({ mode: 'string' }).default(sql`CURRENT_TIMESTAMP`),
	shopId: integer("shop_id"),
	senderId: varchar("sender_id", { length: 255 }),
}, (table) => [
	index("idx_messages_conversation_id").using("btree", table.conversationId.asc().nullsLast().op("int4_ops")),
	foreignKey({
			columns: [table.conversationId],
			foreignColumns: [conversations.id],
			name: "messages_conversation_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.shopId],
			foreignColumns: [stores.id],
			name: "messages_shop_id_fkey"
		}).onDelete("cascade"),
]);

export const shops = pgTable("shops", {
	id: serial().primaryKey().notNull(),
	shopDomain: varchar("shop_domain", { length: 255 }).notNull(),
	accessToken: text("access_token").notNull(),
	scope: text(),
	isActive: boolean("is_active").default(true),
	installedAt: timestamp("installed_at", { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`),
	updatedAt: timestamp("updated_at", { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
	index("idx_shops_domain").using("btree", table.shopDomain.asc().nullsLast().op("text_ops")),
	unique("shops_shop_domain_key").on(table.shopDomain),
]);

export const shopSettings = pgTable("shop_settings", {
	id: serial().primaryKey().notNull(),
	shopId: integer("shop_id"),
	widgetColor: varchar("widget_color", { length: 50 }).default('#667eea'),
	welcomeMessage: text("welcome_message").default('Hi! How can we help you today?'),
	businessHours: jsonb("business_hours"),
	autoReplyEnabled: boolean("auto_reply_enabled").default(false),
	createdAt: timestamp("created_at", { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`),
	updatedAt: timestamp("updated_at", { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
	foreignKey({
			columns: [table.shopId],
			foreignColumns: [shops.id],
			name: "shop_settings_shop_id_fkey"
		}).onDelete("cascade"),
	unique("shop_settings_shop_id_key").on(table.shopId),
]);

export const conversations = pgTable("conversations", {
	id: serial().primaryKey().notNull(),
	shopId: integer("shop_id"),
	shopDomain: varchar("shop_domain", { length: 255 }).notNull(),
	customerEmail: varchar("customer_email", { length: 255 }).notNull(),
	customerName: varchar("customer_name", { length: 255 }),
	customerId: varchar("customer_id", { length: 255 }),
	status: varchar({ length: 50 }).default('open'),
	createdAt: timestamp("created_at", { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`),
	updatedAt: timestamp("updated_at", { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`),
	customerPhone: varchar("customer_phone", { length: 50 }),
	priority: varchar({ length: 20 }).default('normal'),
	assignedTo: varchar("assigned_to", { length: 255 }),
	tags: text().array(),
	firstMessageAt: timestamp("first_message_at", { mode: 'string' }),
	lastMessageAt: timestamp("last_message_at", { mode: 'string' }),
	lastCustomerMessageAt: timestamp("last_customer_message_at", { mode: 'string' }),
	lastAgentMessageAt: timestamp("last_agent_message_at", { mode: 'string' }),
	responseTimeSeconds: integer("response_time_seconds"),
	customerMessageCount: integer("customer_message_count").default(0),
	agentMessageCount: integer("agent_message_count").default(0),
	totalMessageCount: integer("total_message_count").default(0),
	closedAt: timestamp("closed_at", { mode: 'string' }),
}, (table) => [
	index("idx_conversations_assigned").using("btree", table.assignedTo.asc().nullsLast().op("text_ops")),
	index("idx_conversations_priority").using("btree", table.priority.asc().nullsLast().op("text_ops")),
	index("idx_conversations_shop_id").using("btree", table.shopId.asc().nullsLast().op("int4_ops")),
	index("idx_conversations_status").using("btree", table.status.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.shopId],
			foreignColumns: [stores.id],
			name: "conversations_shop_id_fkey"
		}).onDelete("cascade"),
]);

export const employees = pgTable("employees", {
	id: serial().primaryKey().notNull(),
	email: varchar({ length: 255 }).notNull(),
	name: varchar({ length: 255 }).notNull(),
	role: varchar({ length: 50 }).default('agent'),
	passwordHash: text("password_hash").notNull(),
	apiToken: text("api_token"),
	lastLogin: timestamp("last_login", { mode: 'string' }),
	canViewAllStores: boolean("can_view_all_stores").default(true),
	assignedStores: integer("assigned_stores").array(),
	isActive: boolean("is_active").default(true),
	isOnline: boolean("is_online").default(false),
	currentStatus: varchar("current_status", { length: 50 }).default('offline'),
	totalConversationsHandled: integer("total_conversations_handled").default(0),
	averageResponseTimeSeconds: integer("average_response_time_seconds").default(0),
	customerSatisfactionScore: numeric("customer_satisfaction_score", { precision: 3, scale:  2 }),
	createdAt: timestamp("created_at", { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`),
	updatedAt: timestamp("updated_at", { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
	unique("employees_email_key").on(table.email),
	unique("employees_api_token_key").on(table.apiToken),
]);

export const agentActivity = pgTable("agent_activity", {
	id: serial().primaryKey().notNull(),
	employeeId: integer("employee_id"),
	conversationId: integer("conversation_id"),
	storeId: integer("store_id"),
	action: varchar({ length: 100 }).notNull(),
	actionData: jsonb("action_data"),
	createdAt: timestamp("created_at", { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
	foreignKey({
			columns: [table.employeeId],
			foreignColumns: [employees.id],
			name: "agent_activity_employee_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.conversationId],
			foreignColumns: [conversations.id],
			name: "agent_activity_conversation_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.storeId],
			foreignColumns: [stores.id],
			name: "agent_activity_store_id_fkey"
		}).onDelete("cascade"),
]);

export const stores = pgTable("stores", {
	id: serial().primaryKey().notNull(),
	storeIdentifier: varchar("store_identifier", { length: 100 }).notNull(),
	shopDomain: varchar("shop_domain", { length: 255 }).notNull(),
	brandName: varchar("brand_name", { length: 255 }).notNull(),
	accessToken: text("access_token").notNull(),
	apiKey: varchar("api_key", { length: 255 }),
	apiSecret: text("api_secret"),
	scope: text(),
	isActive: boolean("is_active").default(true),
	websocketConnected: boolean("websocket_connected").default(false),
	lastWebhookAt: timestamp("last_webhook_at", { mode: 'string' }),
	installedAt: timestamp("installed_at", { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`),
	updatedAt: timestamp("updated_at", { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`),
	timezone: varchar({ length: 50 }).default('UTC'),
	currency: varchar({ length: 3 }).default('USD'),
	logoUrl: text("logo_url"),
	primaryColor: varchar("primary_color", { length: 7 }).default('#667eea'),
	contactEmail: varchar("contact_email", { length: 255 }),
	supportTeam: varchar("support_team", { length: 255 }),
	storeTags: text("store_tags").array(),
	autoReplyEnabled: boolean("auto_reply_enabled").default(false),
	businessHours: jsonb("business_hours"),
	widgetSettings: jsonb("widget_settings"),
}, (table) => [
	unique("stores_store_identifier_key").on(table.storeIdentifier),
	unique("stores_shop_domain_key").on(table.shopDomain),
]);

export const webhookLogs = pgTable("webhook_logs", {
	id: serial().primaryKey().notNull(),
	storeId: integer("store_id"),
	topic: varchar({ length: 255 }).notNull(),
	payload: jsonb(),
	headers: jsonb(),
	processed: boolean().default(false),
	processingError: text("processing_error"),
	receivedAt: timestamp("received_at", { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`),
	processedAt: timestamp("processed_at", { mode: 'string' }),
}, (table) => [
	foreignKey({
			columns: [table.storeId],
			foreignColumns: [stores.id],
			name: "webhook_logs_store_id_fkey"
		}).onDelete("cascade"),
]);

export const cannedResponses = pgTable("canned_responses", {
	id: serial().primaryKey().notNull(),
	storeId: integer("store_id"),
	title: varchar({ length: 255 }).notNull(),
	content: text().notNull(),
	shortcut: varchar({ length: 50 }),
	category: varchar({ length: 100 }),
	usageCount: integer("usage_count").default(0),
	createdBy: integer("created_by"),
	createdAt: timestamp("created_at", { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`),
	updatedAt: timestamp("updated_at", { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
	foreignKey({
			columns: [table.storeId],
			foreignColumns: [stores.id],
			name: "canned_responses_store_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.createdBy],
			foreignColumns: [employees.id],
			name: "canned_responses_created_by_fkey"
		}),
]);

export const analyticsDaily = pgTable("analytics_daily", {
	id: serial().primaryKey().notNull(),
	storeId: integer("store_id"),
	date: date().notNull(),
	totalConversations: integer("total_conversations").default(0),
	newConversations: integer("new_conversations").default(0),
	closedConversations: integer("closed_conversations").default(0),
	totalMessages: integer("total_messages").default(0),
	customerMessages: integer("customer_messages").default(0),
	agentMessages: integer("agent_messages").default(0),
	averageResponseTimeSeconds: integer("average_response_time_seconds"),
	averageResolutionTimeSeconds: integer("average_resolution_time_seconds"),
	firstResponseTimeSeconds: integer("first_response_time_seconds"),
	uniqueCustomers: integer("unique_customers").default(0),
	returningCustomers: integer("returning_customers").default(0),
	createdAt: timestamp("created_at", { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
	foreignKey({
			columns: [table.storeId],
			foreignColumns: [stores.id],
			name: "analytics_daily_store_id_fkey"
		}).onDelete("cascade"),
	unique("analytics_daily_store_id_date_key").on(table.storeId, table.date),
]);
