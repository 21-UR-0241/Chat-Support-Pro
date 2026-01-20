// backend/websocket-server.js
const { WebSocketServer, WebSocket } = require('ws');
const redisManager = require('./redis-manager');

const connections = new Map();
let wss = null;

function generateId() {
  return Math.random().toString(36).substring(2, 15) + 
         Math.random().toString(36).substring(2, 15);
}

/**
 * Initialize WebSocket server with Redis pub/sub
 */
function initWebSocketServer(server) {
  wss = new WebSocketServer({ server });
  
  console.log('🔌 WebSocket server initializing...');
  
  // Subscribe to Redis for cross-server message broadcasting
  redisManager.subscribe('chat:broadcast', (message) => {
    broadcastToLocal(message);
  });
  
  wss.on('connection', async (ws, req) => {
    const connectionId = generateId();
    console.log(`✅ WebSocket connected: ${connectionId}`);
    
    // Send welcome message
    ws.send(JSON.stringify({
      type: 'connected',
      connectionId,
      timestamp: new Date().toISOString()
    }));
    
    ws.on('message', async (data) => {
      try {
        const message = JSON.parse(data.toString());
        await handleWebSocketMessage(ws, connectionId, message);
      } catch (error) {
        console.error('Error handling WebSocket message:', error);
        ws.send(JSON.stringify({
          type: 'error',
          message: 'Invalid message format'
        }));
      }
    });
    
    ws.on('close', async () => {
      console.log(`❌ WebSocket disconnected: ${connectionId}`);
      const conn = connections.get(connectionId);
      
      if (conn) {
        // Remove from Redis
        await redisManager.removeSocket(connectionId);
        
        // Remove from active conversations
        if (conn.conversationId) {
          await redisManager.removeActiveConversation(conn.storeId, conn.conversationId);
        }
        
        connections.delete(connectionId);
      }
    });
    
    ws.on('error', (error) => {
      console.error(`WebSocket error ${connectionId}:`, error);
    });
  });
  
  console.log('✅ WebSocket server initialized');
}

/**
 * Handle incoming WebSocket messages
 */
async function handleWebSocketMessage(ws, connectionId, message) {
  const { type } = message;
  
  switch (type) {
    case 'join':
      await handleJoin(ws, connectionId, message);
      break;
      
    case 'typing':
      await handleTyping(connectionId, message);
      break;
      
    case 'ping':
      ws.send(JSON.stringify({ type: 'pong' }));
      break;
      
    default:
      console.log(`Unknown message type: ${type}`);
  }
}

/**
 * Handle join conversation
 */
async function handleJoin(ws, connectionId, message) {
  const { conversationId, role, storeId } = message;
  
  if (!conversationId || !role) {
    ws.send(JSON.stringify({
      type: 'error',
      message: 'conversationId and role required'
    }));
    return;
  }
  
  // Store connection info
  connections.set(connectionId, {
    ws,
    conversationId,
    role, // 'customer' or 'agent'
    storeId: storeId || null
  });
  
  // Store in Redis for multi-server support
  if (storeId) {
    await redisManager.mapSocketToStore(connectionId, storeId);
    await redisManager.addActiveConversation(storeId, conversationId);
  }
  
  console.log(`User joined conversation ${conversationId} as ${role}`);
  
  ws.send(JSON.stringify({
    type: 'joined',
    conversationId,
    role
  }));
}

/**
 * Handle typing indicator
 */
async function handleTyping(connectionId, message) {
  const conn = connections.get(connectionId);
  
  if (!conn) return;
  
  const { conversationId, isTyping, sender } = message;
  
  // Broadcast to other connections in same conversation
  for (const [id, c] of connections.entries()) {
    if (id !== connectionId && 
        c.conversationId === conversationId && 
        c.ws.readyState === WebSocket.OPEN) {
      c.ws.send(JSON.stringify({
        type: 'agent_typing',
        conversationId,
        isTyping,
        sender
      }));
    }
  }
}

/**
 * Send message to specific conversation
 */
function sendToConversation(conversationId, message) {
  const data = JSON.stringify(message);
  let sent = 0;
  
  for (const conn of connections.values()) {
    if (conn.conversationId === conversationId && conn.ws.readyState === WebSocket.OPEN) {
      conn.ws.send(data);
      sent++;
    }
  }
  
  console.log(`📤 Message sent to ${sent} connections in conversation ${conversationId}`);
  
  // Also publish to Redis for other servers
  redisManager.publishMessage(`conversation:${conversationId}`, message);
}

/**
 * Broadcast to all agent connections
 */
function broadcastToAgents(message) {
  const data = JSON.stringify(message);
  let sent = 0;
  
  for (const conn of connections.values()) {
    if (conn.role === 'agent' && conn.ws.readyState === WebSocket.OPEN) {
      conn.ws.send(data);
      sent++;
    }
  }
  
  console.log(`📢 Broadcast to ${sent} agents`);
  
  // Publish to Redis for other servers
  redisManager.publishMessage('chat:broadcast', message);
}

/**
 * Broadcast to specific store
 */
function broadcastToStore(storeId, message) {
  const data = JSON.stringify(message);
  let sent = 0;
  
  for (const conn of connections.values()) {
    if (conn.storeId === storeId && conn.ws.readyState === WebSocket.OPEN) {
      conn.ws.send(data);
      sent++;
    }
  }
  
  console.log(`📢 Broadcast to ${sent} connections in store ${storeId}`);
  
  // Publish to Redis
  redisManager.publishMessage(`store:${storeId}`, message);
}

/**
 * Broadcast to local connections only (from Redis)
 */
function broadcastToLocal(message) {
  const data = JSON.stringify(message);
  let sent = 0;
  
  for (const conn of connections.values()) {
    if (conn.ws.readyState === WebSocket.OPEN) {
      conn.ws.send(data);
      sent++;
    }
  }
  
  if (sent > 0) {
    console.log(`📡 Redis broadcast to ${sent} local connections`);
  }
}

/**
 * Get WebSocket stats
 */
function getWebSocketStats() {
  const stats = {
    totalConnections: connections.size,
    agentCount: 0,
    customerCount: 0,
    stores: new Set()
  };
  
  for (const conn of connections.values()) {
    if (conn.role === 'agent') stats.agentCount++;
    if (conn.role === 'customer') stats.customerCount++;
    if (conn.storeId) stats.stores.add(conn.storeId);
  }
  
  stats.activeStores = stats.stores.size;
  delete stats.stores;
  
  return stats;
}

/**
 * Close all connections
 */
function closeAll() {
  for (const conn of connections.values()) {
    if (conn.ws.readyState === WebSocket.OPEN) {
      conn.ws.close();
    }
  }
  connections.clear();
}

module.exports = {
  initWebSocketServer,
  sendToConversation,
  broadcastToAgents,
  broadcastToStore,
  getWebSocketStats,
  closeAll
};