import { relations } from "drizzle-orm/relations";
import { conversations, messages, stores, shops, shopSettings, employees, agentActivity, webhookLogs, cannedResponses, analyticsDaily } from "./schema";

export const messagesRelations = relations(messages, ({one}) => ({
	conversation: one(conversations, {
		fields: [messages.conversationId],
		references: [conversations.id]
	}),
	store: one(stores, {
		fields: [messages.shopId],
		references: [stores.id]
	}),
}));

export const conversationsRelations = relations(conversations, ({one, many}) => ({
	messages: many(messages),
	store: one(stores, {
		fields: [conversations.shopId],
		references: [stores.id]
	}),
	agentActivities: many(agentActivity),
}));

export const storesRelations = relations(stores, ({many}) => ({
	messages: many(messages),
	conversations: many(conversations),
	agentActivities: many(agentActivity),
	webhookLogs: many(webhookLogs),
	cannedResponses: many(cannedResponses),
	analyticsDailies: many(analyticsDaily),
}));

export const shopSettingsRelations = relations(shopSettings, ({one}) => ({
	shop: one(shops, {
		fields: [shopSettings.shopId],
		references: [shops.id]
	}),
}));

export const shopsRelations = relations(shops, ({many}) => ({
	shopSettings: many(shopSettings),
}));

export const agentActivityRelations = relations(agentActivity, ({one}) => ({
	employee: one(employees, {
		fields: [agentActivity.employeeId],
		references: [employees.id]
	}),
	conversation: one(conversations, {
		fields: [agentActivity.conversationId],
		references: [conversations.id]
	}),
	store: one(stores, {
		fields: [agentActivity.storeId],
		references: [stores.id]
	}),
}));

export const employeesRelations = relations(employees, ({many}) => ({
	agentActivities: many(agentActivity),
	cannedResponses: many(cannedResponses),
}));

export const webhookLogsRelations = relations(webhookLogs, ({one}) => ({
	store: one(stores, {
		fields: [webhookLogs.storeId],
		references: [stores.id]
	}),
}));

export const cannedResponsesRelations = relations(cannedResponses, ({one}) => ({
	store: one(stores, {
		fields: [cannedResponses.storeId],
		references: [stores.id]
	}),
	employee: one(employees, {
		fields: [cannedResponses.createdBy],
		references: [employees.id]
	}),
}));

export const analyticsDailyRelations = relations(analyticsDaily, ({one}) => ({
	store: one(stores, {
		fields: [analyticsDaily.storeId],
		references: [stores.id]
	}),
}));