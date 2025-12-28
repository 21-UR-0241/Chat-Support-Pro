/**
 * WebSocket Server
 * Handles real-time communication for multi-store chat
 */

const WebSocket = require('ws');

let wss;
const conversationClients = new Map(); // conversationId -> Set<WebSocket>
const storeClients = new Map(); // storeId -> Set<WebSocket>
const agentClients = new Map(); // employeeId -> WebSocket

/**
 * Initialize WebSocket server
 */
function initWebSocketServer(server) {
  wss = new WebSocket.Server({ 
    server,
    path: '/ws'  // Match client connection path
  });

  wss.on('connection', (ws, req) => {
    console.log('New WebSocket connection established');
    console.log('Client IP:', req.socket.remoteAddress);

    ws.isAlive = true;
    ws.on('pong', () => {
      ws.isAlive = true;
    });

    ws.on('message', (message) => {
      try {
        const data = JSON.parse(message);
        handleWebSocketMessage(ws, data);
      } catch (error) {
        console.error('WebSocket message error:', error);
        ws.send(JSON.stringify({
          type: 'error',
          message: 'Invalid message format'
        }));
      }
    });

    ws.on('close', (code, reason) => {
      console.log(`WebSocket closed. Code: ${code}, Reason: ${reason}`);
      handleDisconnect(ws);
    });

    ws.on('error', (error) => {
      console.error('WebSocket error:', error);
    });

    // Send welcome message
    try {
      ws.send(JSON.stringify({
        type: 'connected',
        message: 'Connected to chat server',
        timestamp: new Date().toISOString()
      }));
    } catch (error) {
      console.error('Error sending welcome message:', error);
    }
  });

  // Heartbeat to detect broken connections
  const interval = setInterval(() => {
    wss.clients.forEach((ws) => {
      if (ws.isAlive === false) {
        console.log('Terminating inactive connection');
        return ws.terminate();
      }
      ws.isAlive = false;
      ws.ping();
    });
  }, 30000);

  wss.on('close', () => {
    console.log('WebSocket server closing...');
    clearInterval(interval);
  });

  wss.on('error', (error) => {
    console.error('WebSocket server error:', error);
  });

  console.log('✅ WebSocket server initialized on path: /ws');
  console.log('   Clients can connect to: ws://localhost:3000/ws');
}

/**
 * Handle incoming WebSocket messages
 */
function handleWebSocketMessage(ws, data) {
  const { type, conversationId, storeId, employeeId, clientType } = data;

  switch (type) {
    case 'auth':
      handleAuth(ws, data);
      break;

    case 'join':
      if (conversationId) {
        joinConversation(ws, conversationId);
      }
      break;

    case 'leave':
      leaveConversation(ws);
      break;

    case 'typing':
      handleTyping(ws, data);
      break;

    default:
      console.log('Unknown message type:', type);
  }
}

/**
 * Handle client authentication
 */
function handleAuth(ws, data) {
  const { clientType, employeeId, storeId, conversationId } = data;

  ws.clientType = clientType;
  ws.employeeId = employeeId;
  ws.storeId = storeId;
  ws.conversationId = conversationId;

  if (clientType === 'agent' && employeeId) {
    agentClients.set(employeeId, ws);
    console.log(`Agent ${employeeId} connected`);
  }

  if (clientType === 'customer' && storeId) {
    if (!storeClients.has(storeId)) {
      storeClients.set(storeId, new Set());
    }
    storeClients.get(storeId).add(ws);
    console.log(`Customer connected to store ${storeId}`);
  }

  if (conversationId) {
    joinConversation(ws, conversationId);
  }

  ws.send(JSON.stringify({
    type: 'auth_success',
    clientType
  }));
}

/**
 * Join a conversation room
 */
function joinConversation(ws, conversationId) {
  ws.conversationId = conversationId;

  if (!conversationClients.has(conversationId)) {
    conversationClients.set(conversationId, new Set());
  }
  conversationClients.get(conversationId).add(ws);

  console.log(`Client joined conversation ${conversationId}`);
}

/**
 * Leave conversation room
 */
function leaveConversation(ws) {
  if (ws.conversationId) {
    const clients = conversationClients.get(ws.conversationId);
    if (clients) {
      clients.delete(ws);
      if (clients.size === 0) {
        conversationClients.delete(ws.conversationId);
      }
    }
    ws.conversationId = null;
  }
}

/**
 * Handle typing indicator
 */
function handleTyping(ws, data) {
  const { conversationId, isTyping, sender } = data;

  if (!conversationId) return;

  const clients = conversationClients.get(conversationId);
  if (clients) {
    const message = JSON.stringify({
      type: 'typing',
      conversationId,
      isTyping,
      sender
    });

    clients.forEach(client => {
      if (client !== ws && client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    });
  }
}

/**
 * Handle client disconnect
 */
function handleDisconnect(ws) {
  // Remove from conversation
  leaveConversation(ws);

  // Remove from agent clients
  if (ws.employeeId) {
    agentClients.delete(ws.employeeId);
    console.log(`Agent ${ws.employeeId} disconnected`);
  }

  // Remove from store clients
  if (ws.storeId) {
    const clients = storeClients.get(ws.storeId);
    if (clients) {
      clients.delete(ws);
      if (clients.size === 0) {
        storeClients.delete(ws.storeId);
      }
    }
    console.log(`Customer disconnected from store ${ws.storeId}`);
  }
}

/**
 * Send message to specific conversation
 */
function sendToConversation(conversationId, message) {
  const clients = conversationClients.get(conversationId);
  if (!clients) {
    console.log(`No clients in conversation ${conversationId}`);
    return;
  }

  const messageStr = JSON.stringify(message);
  let sentCount = 0;

  clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(messageStr);
      sentCount++;
    }
  });

  console.log(`Sent message to ${sentCount} clients in conversation ${conversationId}`);
}

/**
 * Broadcast message to all agents
 */
function broadcastToAgents(message) {
  const messageStr = JSON.stringify(message);
  let sentCount = 0;

  agentClients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(messageStr);
      sentCount++;
    }
  });

  console.log(`Broadcast to ${sentCount} agents`);
}

/**
 * Send message to all clients in a store
 */
function sendToStore(storeId, message) {
  const clients = storeClients.get(storeId);
  if (!clients) return;

  const messageStr = JSON.stringify(message);

  clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(messageStr);
    }
  });
}

/**
 * Get WebSocket statistics
 */
function getWebSocketStats() {
  return {
    totalConnections: wss ? wss.clients.size : 0,
    agentCount: agentClients.size,
    activeConversations: conversationClients.size,
    storeCount: storeClients.size,
    conversationClients: Array.from(conversationClients.entries()).map(([id, clients]) => ({
      conversationId: id,
      clientCount: clients.size
    })),
    storeClients: Array.from(storeClients.entries()).map(([id, clients]) => ({
      storeId: id,
      clientCount: clients.size
    }))
  };
}

module.exports = {
  initWebSocketServer,
  sendToConversation,
  broadcastToAgents,
  sendToStore,
  getWebSocketStats
};