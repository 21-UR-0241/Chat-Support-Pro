
//backend/db/index.js
require('dotenv').config();
const { drizzle } = require('drizzle-orm/node-postgres');
const { Pool } = require('pg');
const { eq, and, desc, sql, gte, ilike, or } = require('drizzle-orm');
const schema = require('./schema');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  max: 50,
});

const db = drizzle(pool, { schema });

// ============ STORES ============

async function registerStore(data) {
  const [result] = await db.insert(schema.stores).values(data)
    .onConflictDoUpdate({
      target: schema.stores.storeIdentifier,
      set: { ...data, updatedAt: sql`CURRENT_TIMESTAMP` }
    }).returning();
  return result;
}

async function getStoreByIdentifier(identifier) {
  const [result] = await db.select().from(schema.stores)
    .where(and(eq(schema.stores.storeIdentifier, identifier), eq(schema.stores.isActive, true)));
  return result;
}

async function getStoreByDomain(domain) {
  const [result] = await db.select().from(schema.stores)
    .where(and(eq(schema.stores.shopDomain, domain), eq(schema.stores.isActive, true)));
  return result;
}

async function getStoreById(id) {
  const [result] = await db.select().from(schema.stores)
    .where(eq(schema.stores.id, id));
  return result;
}

async function getAllActiveStores() {
  return await db.select().from(schema.stores)
    .where(eq(schema.stores.isActive, true))
    .orderBy(schema.stores.brandName);
}

async function updateStoreSettings(storeId, settings) {
  const [result] = await db.update(schema.stores)
    .set({ ...settings, updatedAt: sql`CURRENT_TIMESTAMP` })
    .where(eq(schema.stores.id, storeId))
    .returning();
  return result;
}

async function updateStoreConnectionStatus(identifier, isConnected) {
  await db.update(schema.stores)
    .set({ websocketConnected: isConnected, updatedAt: sql`CURRENT_TIMESTAMP` })
    .where(eq(schema.stores.storeIdentifier, identifier));
}

// ============ CONVERSATIONS ============

async function saveConversation(data) {
  const [result] = await db.insert(schema.conversations).values(data).returning();
  return result;
}

async function getConversation(conversationId) {
  const [result] = await db.select().from(schema.conversations)
    .where(eq(schema.conversations.id, conversationId));
  return result;
}

async function getConversations(filters = {}) {
  const conditions = [];
  
  if (filters.storeId) conditions.push(eq(schema.conversations.shopId, filters.storeId));
  if (filters.storeIdentifier) conditions.push(eq(schema.conversations.shopDomain, filters.storeIdentifier));
  if (filters.status) conditions.push(eq(schema.conversations.status, filters.status));
  if (filters.search) {
    conditions.push(or(
      ilike(schema.conversations.customerEmail, `%${filters.search}%`),
      ilike(schema.conversations.customerName, `%${filters.search}%`)
    ));
  }
  
  return await db.select().from(schema.conversations)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(schema.conversations.updatedAt))
    .limit(filters.limit || 50)
    .offset(filters.offset || 0);
}

async function updateConversation(conversationId, updates) {
  const [result] = await db.update(schema.conversations)
    .set({ ...updates, updatedAt: sql`CURRENT_TIMESTAMP` })
    .where(eq(schema.conversations.id, conversationId))
    .returning();
  return result;
}

async function closeConversation(conversationId) {
  const [result] = await db.update(schema.conversations)
    .set({ status: 'closed', updatedAt: sql`CURRENT_TIMESTAMP` })
    .where(eq(schema.conversations.id, conversationId))
    .returning();
  return result;
}

// ============ MESSAGES ============

async function saveMessage(data) {
  return await db.transaction(async (tx) => {
    const [message] = await tx.insert(schema.messages).values(data).returning();
    
    // Update conversation timestamp
    await tx.update(schema.conversations)
      .set({ updatedAt: sql`CURRENT_TIMESTAMP` })
      .where(eq(schema.conversations.id, data.conversationId));
    
    return message;
  });
}

async function getMessages(conversationId, limit = 100) {
  return await db.select().from(schema.messages)
    .where(eq(schema.messages.conversationId, conversationId))
    .orderBy(schema.messages.timestamp)
    .limit(limit);
}

// ============ EMPLOYEES ============

async function createEmployee(data) {
  console.log('🔍 DB: Creating employee with data:', data);
  
  // Map snake_case to camelCase for Drizzle schema
  const employeeData = {
    email: data.email,
    name: data.name,
    role: data.role,
    passwordHash: data.password_hash,  // Map snake_case to camelCase
    canViewAllStores: data.can_view_all_stores,
    assignedStores: data.assigned_stores || [],
  };
  
  console.log('🔍 DB: Mapped to camelCase:', employeeData);
  
  const [result] = await db.insert(schema.employees).values(employeeData).returning();
  
  console.log('✅ DB: Employee created:', result.id);
  return result;
}

async function getEmployeeByEmail(email) {
  const [result] = await db.select().from(schema.employees)
    .where(eq(schema.employees.email, email));
  return result;
}

async function getEmployeeById(id) {
  const [result] = await db.select().from(schema.employees)
    .where(eq(schema.employees.id, id));
  return result;
}

async function getAllEmployees() {
  return await db.select().from(schema.employees)
    .orderBy(desc(schema.employees.createdAt));
}

async function updateEmployee(employeeId, updates) {
  const [result] = await db.update(schema.employees)
    .set({ 
      ...updates, 
      updatedAt: sql`CURRENT_TIMESTAMP` 
    })
    .where(eq(schema.employees.id, employeeId))
    .returning();
  return result;
}

async function updateEmployeeStatus(employeeId, status) {
  const updates = typeof status === 'object' ? status : { 
    currentStatus: status, 
    isOnline: status === 'online' 
  };
  
  await db.update(schema.employees)
    .set({ 
      ...updates, 
      updatedAt: sql`CURRENT_TIMESTAMP` 
    })
    .where(eq(schema.employees.id, employeeId));
}

async function deleteEmployee(employeeId) {
  await db.delete(schema.employees)
    .where(eq(schema.employees.id, employeeId));
  return true;
}

// ============ ANALYTICS ============

async function getDashboardStats(filters = {}) {
  const conditions = [];
  if (filters.storeId) conditions.push(eq(schema.conversations.shopId, filters.storeId));
  
  const [result] = await db.select({
    totalConversations: sql`COUNT(DISTINCT ${schema.conversations.id})`,
    openConversations: sql`COUNT(DISTINCT ${schema.conversations.id}) FILTER (WHERE ${schema.conversations.status} = 'open')`,
    activeStores: sql`COUNT(DISTINCT ${schema.conversations.shopId})`,
  }).from(schema.conversations)
    .where(conditions.length > 0 ? and(...conditions) : undefined);
  
  return result;
}

// ============ UTILITIES ============

async function testConnection() {
  const result = await pool.query('SELECT NOW()');
  console.log('✅ Connected:', result.rows[0].now);
  return true;
}

async function closePool() {
  await pool.end();
}

module.exports = {
  db, 
  pool,
  // Stores
  registerStore, 
  getStoreByIdentifier, 
  getStoreByDomain, 
  getStoreById, 
  getAllActiveStores, 
  updateStoreConnectionStatus, 
  updateStoreSettings,
  // Conversations
  saveConversation, 
  getConversation, 
  getConversations, 
  updateConversation, 
  closeConversation,
  // Messages
  saveMessage, 
  getMessages,
  // Employees
  createEmployee, 
  getEmployeeByEmail, 
  getEmployeeById,
  getAllEmployees,
  updateEmployee,
  updateEmployeeStatus,
  deleteEmployee,
  // Analytics
  getDashboardStats, 
  // Utilities
  testConnection, 
  closePool,
};