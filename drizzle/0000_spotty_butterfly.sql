-- Current sql file was generated after introspecting the database
-- If you want to run this migration please uncomment this code before executing migrations
/*
CREATE TABLE "messages" (
	"id" serial PRIMARY KEY NOT NULL,
	"conversation_id" integer,
	"sender_type" varchar(50) NOT NULL,
	"sender_name" varchar(255),
	"content" text NOT NULL,
	"timestamp" timestamp DEFAULT CURRENT_TIMESTAMP,
	"shop_id" integer,
	"sender_id" varchar(255)
);
--> statement-breakpoint
CREATE TABLE "shops" (
	"id" serial PRIMARY KEY NOT NULL,
	"shop_domain" varchar(255) NOT NULL,
	"access_token" text NOT NULL,
	"scope" text,
	"is_active" boolean DEFAULT true,
	"installed_at" timestamp DEFAULT CURRENT_TIMESTAMP,
	"updated_at" timestamp DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT "shops_shop_domain_key" UNIQUE("shop_domain")
);
--> statement-breakpoint
CREATE TABLE "shop_settings" (
	"id" serial PRIMARY KEY NOT NULL,
	"shop_id" integer,
	"widget_color" varchar(50) DEFAULT '#667eea',
	"welcome_message" text DEFAULT 'Hi! How can we help you today?',
	"business_hours" jsonb,
	"auto_reply_enabled" boolean DEFAULT false,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP,
	"updated_at" timestamp DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT "shop_settings_shop_id_key" UNIQUE("shop_id")
);
--> statement-breakpoint
CREATE TABLE "conversations" (
	"id" serial PRIMARY KEY NOT NULL,
	"shop_id" integer,
	"shop_domain" varchar(255) NOT NULL,
	"customer_email" varchar(255) NOT NULL,
	"customer_name" varchar(255),
	"customer_id" varchar(255),
	"status" varchar(50) DEFAULT 'open',
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP,
	"updated_at" timestamp DEFAULT CURRENT_TIMESTAMP,
	"customer_phone" varchar(50),
	"priority" varchar(20) DEFAULT 'normal',
	"assigned_to" varchar(255),
	"tags" text[],
	"first_message_at" timestamp,
	"last_message_at" timestamp,
	"last_customer_message_at" timestamp,
	"last_agent_message_at" timestamp,
	"response_time_seconds" integer,
	"customer_message_count" integer DEFAULT 0,
	"agent_message_count" integer DEFAULT 0,
	"total_message_count" integer DEFAULT 0,
	"closed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "employees" (
	"id" serial PRIMARY KEY NOT NULL,
	"email" varchar(255) NOT NULL,
	"name" varchar(255) NOT NULL,
	"role" varchar(50) DEFAULT 'agent',
	"password_hash" text NOT NULL,
	"api_token" text,
	"last_login" timestamp,
	"can_view_all_stores" boolean DEFAULT true,
	"assigned_stores" integer[],
	"is_active" boolean DEFAULT true,
	"is_online" boolean DEFAULT false,
	"current_status" varchar(50) DEFAULT 'offline',
	"total_conversations_handled" integer DEFAULT 0,
	"average_response_time_seconds" integer DEFAULT 0,
	"customer_satisfaction_score" numeric(3, 2),
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP,
	"updated_at" timestamp DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT "employees_email_key" UNIQUE("email"),
	CONSTRAINT "employees_api_token_key" UNIQUE("api_token")
);
--> statement-breakpoint
CREATE TABLE "agent_activity" (
	"id" serial PRIMARY KEY NOT NULL,
	"employee_id" integer,
	"conversation_id" integer,
	"store_id" integer,
	"action" varchar(100) NOT NULL,
	"action_data" jsonb,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint
CREATE TABLE "stores" (
	"id" serial PRIMARY KEY NOT NULL,
	"store_identifier" varchar(100) NOT NULL,
	"shop_domain" varchar(255) NOT NULL,
	"brand_name" varchar(255) NOT NULL,
	"access_token" text NOT NULL,
	"api_key" varchar(255),
	"api_secret" text,
	"scope" text,
	"is_active" boolean DEFAULT true,
	"websocket_connected" boolean DEFAULT false,
	"last_webhook_at" timestamp,
	"installed_at" timestamp DEFAULT CURRENT_TIMESTAMP,
	"updated_at" timestamp DEFAULT CURRENT_TIMESTAMP,
	"timezone" varchar(50) DEFAULT 'UTC',
	"currency" varchar(3) DEFAULT 'USD',
	"logo_url" text,
	"primary_color" varchar(7) DEFAULT '#667eea',
	"contact_email" varchar(255),
	"support_team" varchar(255),
	"store_tags" text[],
	"auto_reply_enabled" boolean DEFAULT false,
	"business_hours" jsonb,
	"widget_settings" jsonb,
	CONSTRAINT "stores_store_identifier_key" UNIQUE("store_identifier"),
	CONSTRAINT "stores_shop_domain_key" UNIQUE("shop_domain")
);
--> statement-breakpoint
CREATE TABLE "webhook_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"store_id" integer,
	"topic" varchar(255) NOT NULL,
	"payload" jsonb,
	"headers" jsonb,
	"processed" boolean DEFAULT false,
	"processing_error" text,
	"received_at" timestamp DEFAULT CURRENT_TIMESTAMP,
	"processed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "canned_responses" (
	"id" serial PRIMARY KEY NOT NULL,
	"store_id" integer,
	"title" varchar(255) NOT NULL,
	"content" text NOT NULL,
	"shortcut" varchar(50),
	"category" varchar(100),
	"usage_count" integer DEFAULT 0,
	"created_by" integer,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP,
	"updated_at" timestamp DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint
CREATE TABLE "analytics_daily" (
	"id" serial PRIMARY KEY NOT NULL,
	"store_id" integer,
	"date" date NOT NULL,
	"total_conversations" integer DEFAULT 0,
	"new_conversations" integer DEFAULT 0,
	"closed_conversations" integer DEFAULT 0,
	"total_messages" integer DEFAULT 0,
	"customer_messages" integer DEFAULT 0,
	"agent_messages" integer DEFAULT 0,
	"average_response_time_seconds" integer,
	"average_resolution_time_seconds" integer,
	"first_response_time_seconds" integer,
	"unique_customers" integer DEFAULT 0,
	"returning_customers" integer DEFAULT 0,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT "analytics_daily_store_id_date_key" UNIQUE("store_id","date")
);
--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_shop_id_fkey" FOREIGN KEY ("shop_id") REFERENCES "public"."stores"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shop_settings" ADD CONSTRAINT "shop_settings_shop_id_fkey" FOREIGN KEY ("shop_id") REFERENCES "public"."shops"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_shop_id_fkey" FOREIGN KEY ("shop_id") REFERENCES "public"."stores"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_activity" ADD CONSTRAINT "agent_activity_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_activity" ADD CONSTRAINT "agent_activity_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_activity" ADD CONSTRAINT "agent_activity_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "webhook_logs" ADD CONSTRAINT "webhook_logs_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "canned_responses" ADD CONSTRAINT "canned_responses_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "canned_responses" ADD CONSTRAINT "canned_responses_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "analytics_daily" ADD CONSTRAINT "analytics_daily_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_messages_conversation_id" ON "messages" USING btree ("conversation_id" int4_ops);--> statement-breakpoint
CREATE INDEX "idx_shops_domain" ON "shops" USING btree ("shop_domain" text_ops);--> statement-breakpoint
CREATE INDEX "idx_conversations_assigned" ON "conversations" USING btree ("assigned_to" text_ops);--> statement-breakpoint
CREATE INDEX "idx_conversations_priority" ON "conversations" USING btree ("priority" text_ops);--> statement-breakpoint
CREATE INDEX "idx_conversations_shop_id" ON "conversations" USING btree ("shop_id" int4_ops);--> statement-breakpoint
CREATE INDEX "idx_conversations_status" ON "conversations" USING btree ("status" text_ops);
*/