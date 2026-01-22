// backend/websocket-server.js
const { WebSocketServer, WebSocket } = require('ws');
const redisManager = process.env.REDIS_URL 
  ? require('./redis-manager')
  : require('./redis-manager-stub');
const { verifyToken, verifyWidgetToken } = require('./auth');

const connections = new Map();
let wss = null;

function generateId() {
  return Math.random().toString(36).substring(2, 15) + 
         Math.random().toString(36).substring(2, 15);
}

function initWebSocketServer(server) {
  wss = new WebSocketServer({ server, path: '/ws' });

  console.log('🔌 WebSocket server initializing...');

  redisManager.subscribe('chat:broadcast', (message) => {
    broadcastToLocal(message);
  });

  wss.on('connection', async (ws) => {
    const connectionId = generateId();
    console.log(`✅ WebSocket connected: ${connectionId}`);

    ws.send(JSON.stringify({ type: 'connected', connectionId, timestamp: new Date().toISOString() }));

    ws.on('message', async (data) => {
      try {
        const message = JSON.parse(data.toString());
        await handleWebSocketMessage(ws, connectionId, message);
      } catch (error) {
        ws.send(JSON.stringify({ type: 'error', message: 'Invalid message format' }));
      }
    });

    ws.on('close', async () => {
      const conn = connections.get(connectionId);
      if (conn) {
        await redisManager.removeSocket(connectionId);
        if (conn.conversationId) {
          await redisManager.removeActiveConversation(conn.storeId, conn.conversationId);
        }
        connections.delete(connectionId);
      }
    });
  });

  console.log('✅ WebSocket server initialized');
}

async function handleWebSocketMessage(ws, connectionId, message) {
  const { type } = message;

  switch (type) {
    case 'auth':
      await handleAuth(ws, connectionId, message);
      break;
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
      ws.send(JSON.stringify({ type: 'error', message: 'Unknown message type' }));
  }
}

async function handleAuth(ws, connectionId, message) {
  const { token, clientType } = message;

  if (!token) {
    ws.send(JSON.stringify({ type: 'error', message: 'Missing token' }));
    ws.close();
    return;
  }

  if (clientType === 'agent') {
    const user = verifyToken(token);
    if (!user) {
      ws.send(JSON.stringify({ type: 'error', message: 'Unauthorized' }));
      ws.close();
      return;
    }
    connections.set(connectionId, { ws, role: 'agent', user });
    ws.send(JSON.stringify({ type: 'auth_ok', role: 'agent' }));
    return;
  }

  ws.send(JSON.stringify({ type: 'error', message: 'Invalid client type' }));
  ws.close();
}

async function handleJoin(ws, connectionId, message) {
  const { conversationId, role, storeId, token } = message;

  if (!conversationId || !role) {
    ws.send(JSON.stringify({ type: 'error', message: 'conversationId and role required' }));
    return;
  }

  if (role === 'customer') {
    const widget = verifyWidgetToken(token);
    if (!widget) {
      ws.send(JSON.stringify({ type: 'error', message: 'Unauthorized' }));
      ws.close();
      return;
    }

    connections.set(connectionId, {
      ws,
      conversationId,
      role: 'customer',
      storeId: widget.storeId
    });

    await redisManager.mapSocketToStore(connectionId, widget.storeId);
    await redisManager.addActiveConversation(widget.storeId, conversationId);

    ws.send(JSON.stringify({ type: 'joined', conversationId, role }));
    return;
  }

  const conn = connections.get(connectionId);
  if (!conn || conn.role !== 'agent') {
    ws.send(JSON.stringify({ type: 'error', message: 'Unauthorized' }));
    ws.close();
    return;
  }

  conn.conversationId = conversationId;
  connections.set(connectionId, conn);

  ws.send(JSON.stringify({ type: 'joined', conversationId, role }));
}

async function handleTyping(connectionId, message) {
  const conn = connections.get(connectionId);
  if (!conn) return;

  const { conversationId, isTyping, sender } = message;

  for (const [id, c] of connections.entries()) {
    if (id !== connectionId &&
        c.conversationId === conversationId &&
        c.ws.readyState === WebSocket.OPEN) {
      c.ws.send(JSON.stringify({ type: 'agent_typing', conversationId, isTyping, sender }));
    }
  }
}

function sendToConversation(conversationId, message) {
  const data = JSON.stringify(message);
  let sent = 0;

  for (const conn of connections.values()) {
    if (conn.conversationId === conversationId && conn.ws.readyState === WebSocket.OPEN) {
      conn.ws.send(data);
      sent++;
    }
  }

  redisManager.publishMessage(`conversation:${conversationId}`, message);
}

function broadcastToAgents(message) {
  const data = JSON.stringify(message);
  for (const conn of connections.values()) {
    if (conn.role === 'agent' && conn.ws.readyState === WebSocket.OPEN) {
      conn.ws.send(data);
    }
  }
  redisManager.publishMessage('chat:broadcast', message);
}

function broadcastToStore(storeId, message) {
  const data = JSON.stringify(message);
  for (const conn of connections.values()) {
    if (conn.storeId === storeId && conn.ws.readyState === WebSocket.OPEN) {
      conn.ws.send(data);
    }
  }
  redisManager.publishMessage(`store:${storeId}`, message);
}

function broadcastToLocal(message) {
  const data = JSON.stringify(message);
  for (const conn of connections.values()) {
    if (conn.ws.readyState === WebSocket.OPEN) {
      conn.ws.send(data);
    }
  }
}

function getWebSocketStats() {
  const stats = { totalConnections: connections.size, agentCount: 0, customerCount: 0, stores: new Set() };

  for (const conn of connections.values()) {
    if (conn.role === 'agent') stats.agentCount++;
    if (conn.role === 'customer') stats.customerCount++;
    if (conn.storeId) stats.stores.add(conn.storeId);
  }

  stats.activeStores = stats.stores.size;
  delete stats.stores;
  return stats;
}

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