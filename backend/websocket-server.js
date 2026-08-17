

// // backend/websocket-server.js
// const { WebSocketServer, WebSocket } = require('ws');
// const redisManager = process.env.REDIS_URL
//   ? require('./redis-manager')
//   : require('./redis-manager-stub');
// const { verifyToken, verifyWidgetToken } = require('./auth');
// const db = require('./database');

// const connections = new Map();
// let wss = null;

// // Unique per process. Used to ignore our own messages when they come back
// // around via the Redis fan-out (prevents double delivery on the origin server).
// const SERVER_ID = generateId();

// const REAPER_INTERVAL = 30000; // native ping sweep for dead sockets
// const AUTH_TIMEOUT    = 10000; // close sockets that never authenticate

// function generateId() {
//   return Math.random().toString(36).substring(2, 15) +
//          Math.random().toString(36).substring(2, 15);
// }

// function initWebSocketServer(server) {
//   wss = new WebSocketServer({ server, path: '/ws' });

//   console.log('🔌 WebSocket server initializing...');

//   // Subscribe to Redis broadcast channel (agent broadcasts fan out here)
//   redisManager.subscribe('chat:broadcast', (message) => {
//     broadcastAgentsFromRedis(message);
//   });

//   // ── Dead-socket reaper ────────────────────────────────────────────────────
//   // A socket that dies without a close frame (Render drop, laptop sleep, NAT
//   // timeout) can still read as OPEN server-side, so it never fires 'close' and
//   // its entry lingers in `connections` forever — causing duplicate/vanishing
//   // broadcasts and slow memory growth. Native protocol-level ping/pong detects
//   // it: no pong within one interval → terminate(), which fires our normal
//   // 'close' handler and runs the existing presence/Redis cleanup.
//   //
//   // NOTE: this is the WS protocol's own ping()/'pong' frames — completely
//   // separate from the app-level JSON {type:'ping'}/{type:'pong'} the client
//   // uses for its own liveness check. Browsers answer native pings automatically.
//   const reaper = setInterval(() => {
//     wss.clients.forEach((ws) => {
//       if (ws.isAlive === false) {
//         console.log('💀 Reaping unresponsive socket');
//         return ws.terminate(); // → 'close' → cleanup
//       }
//       ws.isAlive = false;
//       try { ws.ping(); } catch { /* socket already gone */ }
//     });
//   }, REAPER_INTERVAL);

//   wss.on('close', () => clearInterval(reaper));

//   wss.on('connection', async (ws, req) => {
//     const connectionId = generateId();
//     const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress;

//     console.log(`✅ New WebSocket connection: ${connectionId} from ${clientIp}`);

//     // Reaper bookkeeping
//     ws.isAlive = true;
//     ws.on('pong', () => { ws.isAlive = true; });

//     // Send initial connection acknowledgment
//     ws.send(JSON.stringify({
//       type: 'connected',
//       connectionId,
//       timestamp: new Date().toISOString()
//     }));

//     // Store connection with basic info
//     connections.set(connectionId, {
//       ws,
//       connectedAt: new Date(),
//       authenticated: false
//     });

//     // ── Auth timeout ──────────────────────────────────────────────────────
//     // A socket that connects and never sends a valid `auth` (or authenticates
//     // via `join`) sits unauthenticated forever. Close it after a grace period.
//     ws._authTimer = setTimeout(() => {
//       const conn = connections.get(connectionId);
//       if (conn && !conn.authenticated) {
//         console.warn(`⏰ Auth timeout — closing unauthenticated socket ${connectionId}`);
//         try { ws.close(); } catch { /* ignore */ }
//       }
//     }, AUTH_TIMEOUT);

//     ws.on('message', async (data) => {
//       try {
//         const message = JSON.parse(data.toString());
//         console.log(`📨 Message from ${connectionId}:`, message.type);
//         await handleWebSocketMessage(ws, connectionId, message);
//       } catch (error) {
//         console.error(`❌ Error handling message from ${connectionId}:`, error);
//         ws.send(JSON.stringify({
//           type: 'error',
//           message: 'Invalid message format',
//           details: error.message
//         }));
//       }
//     });

//     ws.on('close', async () => {
//       if (ws._authTimer) { clearTimeout(ws._authTimer); ws._authTimer = null; }

//       const conn = connections.get(connectionId);
//       if (conn) {
//         console.log(`🔌 WebSocket disconnected: ${connectionId} (role: ${conn.role || 'unknown'})`);

//         // Mark customer presence as offline on disconnect
//         if (conn.role === 'customer' && conn.conversationId) {
//           try {
//             await db.pool.query(`
//               UPDATE customer_presence
//               SET status = 'offline', ws_connected = FALSE, updated_at = NOW()
//               WHERE conversation_id = $1
//             `, [conn.conversationId]);
//           } catch (err) {
//             console.error('[WS Close] Presence cleanup error:', err);
//           }
//         }

//         // Clean up Redis mappings
//         await redisManager.removeSocket(connectionId);

//         if (conn.conversationId && conn.storeId) {
//           await redisManager.removeActiveConversation(conn.storeId, conn.conversationId);
//         }

//         connections.delete(connectionId);
//       }
//     });

//     ws.on('error', (error) => {
//       console.error(`❌ WebSocket error for ${connectionId}:`, error);
//     });
//   });

//   console.log('✅ WebSocket server initialized on /ws');
// }

// async function handleWebSocketMessage(ws, connectionId, message) {
//   const { type } = message;

//   console.log(`📨 Received message:`, JSON.stringify(message)); // Debug full message

//   switch (type) {
//     case 'auth':
//       await handleAuth(ws, connectionId, message);
//       break;

//     case 'join':
//     case 'join_conversation':
//       await handleJoin(ws, connectionId, message);
//       break;

//     case 'leave':
//     case 'leave_conversation':
//       await handleLeave(ws, connectionId, message);
//       break;

//     case 'typing':
//       await handleTyping(connectionId, message);
//       break;

//     case 'presence':
//       await handlePresence(ws, connectionId, message);
//       break;

//     case 'heartbeat':
//       await handleHeartbeat(ws, connectionId, message);
//       break;

//     case 'ping':
//       ws.send(JSON.stringify({ type: 'pong', timestamp: new Date().toISOString() }));
//       break;

//     default:
//       console.warn(`⚠️ Unknown message type: ${type} from ${connectionId}`);
//       ws.send(JSON.stringify({
//         type: 'error',
//         message: `Unknown message type: ${type}`
//       }));
//   }
// }

// // Add leave handler
// async function handleLeave(ws, connectionId, message) {
//   const conn = connections.get(connectionId);
//   if (!conn) {
//     console.warn(`⚠️ Leave from unknown connection: ${connectionId}`);
//     return;
//   }

//   const oldConversationId = conn.conversationId;

//   console.log(`🚪 Leave request: ${connectionId} from conversation ${oldConversationId}`);

//   // Remove conversation ID but keep connection
//   if (conn.conversationId) {
//     delete conn.conversationId;
//     connections.set(connectionId, conn);

//     // Notify others in the conversation
//     if (oldConversationId) {
//       sendToConversation(oldConversationId, {
//         type: conn.role === 'agent' ? 'agent_left' : 'customer_left',
//         conversationId: oldConversationId,
//         name: conn.employeeName || conn.customerName,
//         timestamp: new Date().toISOString()
//       });
//     }
//   }

//   ws.send(JSON.stringify({
//     type: 'left',
//     conversationId: oldConversationId
//   }));
// }


// async function handleAuth(ws, connectionId, message) {
//   const { token, clientType } = message;

//   console.log(`🔐 Auth attempt: ${connectionId}, clientType: ${clientType}`);

//   if (!token) {
//     console.error(`❌ Auth failed: Missing token for ${connectionId}`);
//     ws.send(JSON.stringify({ type: 'error', message: 'Missing token' }));
//     ws.close();
//     return;
//   }

//   // Handle agent authentication
//   if (clientType === 'agent') {
//     try {
//       const user = verifyToken(token);
//       if (!user) {
//         console.error(`❌ Auth failed: Invalid agent token for ${connectionId}`);
//         ws.send(JSON.stringify({ type: 'error', message: 'Unauthorized' }));
//         ws.close();
//         return;
//       }

//       if (ws._authTimer) { clearTimeout(ws._authTimer); ws._authTimer = null; }

//       connections.set(connectionId, {
//         ws,
//         role: 'agent',
//         user,
//         authenticated: true,
//         connectedAt: new Date()
//       });

//       console.log(`✅ Agent authenticated: ${connectionId} (${user.email})`);
//       ws.send(JSON.stringify({ type: 'auth_ok', role: 'agent', user: { id: user.id, email: user.email } }));
//       return;
//     } catch (error) {
//       console.error(`❌ Auth error for ${connectionId}:`, error);
//       ws.send(JSON.stringify({ type: 'error', message: 'Authentication failed' }));
//       ws.close();
//       return;
//     }
//   }

//   // Handle customer authentication (widget)
//   if (clientType === 'customer') {
//     try {
//       const widget = verifyWidgetToken(token);
//       if (!widget) {
//         console.error(`❌ Auth failed: Invalid widget token for ${connectionId}`);
//         ws.send(JSON.stringify({ type: 'error', message: 'Unauthorized' }));
//         ws.close();
//         return;
//       }

//       if (ws._authTimer) { clearTimeout(ws._authTimer); ws._authTimer = null; }

//       connections.set(connectionId, {
//         ws,
//         role: 'customer',
//         storeId: widget.storeId,
//         authenticated: true,
//         connectedAt: new Date()
//       });

//       console.log(`✅ Customer authenticated: ${connectionId} (store: ${widget.storeId})`);
//       ws.send(JSON.stringify({ type: 'auth_ok', role: 'customer' }));

//       await redisManager.mapSocketToStore(connectionId, widget.storeId);
//       return;
//     } catch (error) {
//       console.error(`❌ Auth error for ${connectionId}:`, error);
//       ws.send(JSON.stringify({ type: 'error', message: 'Authentication failed' }));
//       ws.close();
//       return;
//     }
//   }

//   console.error(`❌ Invalid client type: ${clientType}`);
//   ws.send(JSON.stringify({ type: 'error', message: 'Invalid client type' }));
//   ws.close();
// }

// // Replace the handleJoin function in websocket-server.js with this improved version

// async function handleJoin(ws, connectionId, message) {
//   const { conversationId, role, storeId, token, employeeName, customerEmail, customerName } = message;

//   console.log(`🚪 Join request: ${connectionId}, conversation: ${conversationId}, role: ${role}`);

//   if (!conversationId) {
//     console.error(`❌ Join failed: Missing conversationId`);
//     ws.send(JSON.stringify({ type: 'error', message: 'conversationId required' }));
//     return;
//   }

//   const conn = connections.get(connectionId);
//   if (!conn) {
//     console.error(`❌ Join failed: Connection not found`);
//     ws.send(JSON.stringify({ type: 'error', message: 'Connection not found' }));
//     return;
//   }

//   // 🔥 SMART ROLE DETECTION
//   // If role not provided in message, use the role from authenticated connection
//   let effectiveRole = role;

//   if (!effectiveRole && conn.role) {
//     effectiveRole = conn.role; // Use role from authentication
//     console.log(`ℹ️ Role inferred from authentication: ${effectiveRole}`);
//   }

//   if (!effectiveRole) {
//     console.error(`❌ Join failed: Cannot determine role`);
//     ws.send(JSON.stringify({ type: 'error', message: 'Role required or authenticate first' }));
//     return;
//   }

//   console.log(`✅ Using role: ${effectiveRole}`);

//   // Handle customer joining
//   if (effectiveRole === 'customer') {
//     // If not authenticated yet, try to authenticate with token
//     if (!conn.authenticated && token) {
//       try {
//         const widget = verifyWidgetToken(token);
//         if (!widget) {
//           console.error(`❌ Join failed: Invalid token for customer`);
//           ws.send(JSON.stringify({ type: 'error', message: 'Unauthorized' }));
//           ws.close();
//           return;
//         }

//         if (ws._authTimer) { clearTimeout(ws._authTimer); ws._authTimer = null; }

//         conn.authenticated = true;
//         conn.storeId = widget.storeId;
//         await redisManager.mapSocketToStore(connectionId, widget.storeId);
//       } catch (error) {
//         console.error(`❌ Join error:`, error);
//         ws.send(JSON.stringify({ type: 'error', message: 'Authentication failed' }));
//         ws.close();
//         return;
//       }
//     }

//     // Update connection with conversation details
//     conn.conversationId = conversationId;
//     conn.role = 'customer'; // Ensure role is set
//     if (customerEmail) conn.customerEmail = customerEmail;
//     if (customerName) conn.customerName = customerName;
//     if (storeId && !conn.storeId) conn.storeId = storeId;

//     connections.set(connectionId, conn);

//     // Add to active conversations
//     if (conn.storeId) {
//       await redisManager.addActiveConversation(conn.storeId, conversationId);
//     }

//     console.log(`✅ Customer joined conversation: ${conversationId}`);
//     ws.send(JSON.stringify({ type: 'joined', conversationId, role: 'customer' }));

//     // Notify agents that customer joined
//     broadcastToAgents({
//       type: 'customer_joined',
//       conversationId,
//       customerName: conn.customerName,
//       timestamp: new Date().toISOString()
//     });

//     return;
//   }

//   // Handle agent joining
//   if (effectiveRole === 'agent') {
//     // Verify agent is authenticated
//     if (!conn.authenticated || conn.role !== 'agent') {
//       console.error(`❌ Join failed: Agent not authenticated`);
//       ws.send(JSON.stringify({ type: 'error', message: 'Unauthorized - authenticate first' }));
//       ws.close();
//       return;
//     }

//     // Update connection with conversation details
//     conn.conversationId = conversationId;
//     if (employeeName) conn.employeeName = employeeName;

//     connections.set(connectionId, conn);

//     console.log(`✅ Agent joined conversation: ${conversationId} (${conn.user?.email || employeeName || 'agent'})`);
//     ws.send(JSON.stringify({
//       type: 'joined',
//       conversationId,
//       role: 'agent',
//       agentName: conn.user?.name || employeeName
//     }));

//     // Notify customer that agent joined
//     sendToConversation(conversationId, {
//       type: 'agent_joined',
//       conversationId,
//       agentName: conn.user?.name || employeeName || 'Support Agent',
//       timestamp: new Date().toISOString()
//     });

//     return;
//   }

//   console.error(`❌ Join failed: Invalid role: ${effectiveRole}`);
//   ws.send(JSON.stringify({ type: 'error', message: `Invalid role: ${effectiveRole}` }));
// }

// // async function handleTyping(connectionId, message) {
// //   const conn = connections.get(connectionId);
// //   if (!conn || !conn.conversationId) {
// //     console.warn(`⚠️ Typing indicator from unknown connection: ${connectionId}`);
// //     return;
// //   }

// //   const { conversationId, isTyping, senderType, senderName } = message;

// //   console.log(`⌨️ Typing indicator: ${connectionId}, conversation: ${conversationId}, typing: ${isTyping}`);

// //   const typingMessage = {
// //     type: 'typing',
// //     conversationId,
// //     isTyping: isTyping !== false, // Default to true if not specified
// //     senderType: senderType || conn.role,
// //     senderName: senderName || conn.employeeName || conn.customerName || 'Unknown',
// //     timestamp: new Date().toISOString()
// //   };

// //   // Send typing indicator to all other participants in the conversation
// //   let sent = 0;
// //   for (const [id, c] of connections.entries()) {
// //     if (id !== connectionId &&
// //         c.conversationId === conversationId &&
// //         c.ws.readyState === WebSocket.OPEN) {
// //       c.ws.send(JSON.stringify(typingMessage));
// //       sent++;
// //     }
// //   }

// //   console.log(`✅ Typing indicator sent to ${sent} participant(s)`);

// //   // Also publish to Redis for multi-server setups
// //   await redisManager.publishMessage(`conversation:${conversationId}`, typingMessage);
// // }

// async function handleTyping(connectionId, message) {
//   const conn = connections.get(connectionId);
//   if (!conn || !conn.conversationId) {
//     console.warn(`⚠️ Typing indicator from unknown connection: ${connectionId}`);
//     return;
//   }

//   const { conversationId, isTyping, senderType, senderName } = message;

//   // Guard: only relay typing for the conversation this socket is actually joined to.
//   // Blocks a stale/spoofed conversationId (e.g. sent after a join swap) from
//   // fanning a typing event into a conversation this socket no longer belongs to.
//   if (String(conversationId) !== String(conn.conversationId)) {
//     console.warn(`⚠️ Typing conversationId mismatch: joined=${conn.conversationId} claimed=${conversationId}`);
//     return;
//   }

//   console.log(`⌨️ Typing indicator: ${connectionId}, conversation: ${conversationId}, typing: ${isTyping}`);

//   const resolvedName =
//     senderName || conn.employeeName || conn.customerName ||
//     (conn.role === 'agent' ? 'Agent' : 'Customer'); // was 'Unknown' — collapses distinct senders in the client's name-keyed Set

//   const typingMessage = {
//     type: 'typing',
//     conversationId,
//     isTyping: isTyping !== false, // Default to true if not specified
//     senderType: senderType || conn.role,
//     senderName: resolvedName,
//     timestamp: new Date().toISOString()
//   };

//   // Send typing indicator to all other participants in the conversation
//   let sent = 0;
//   for (const [id, c] of connections.entries()) {
//     if (id !== connectionId &&
//         String(c.conversationId) === String(conversationId) && // string-safe: one client may send numeric id, another a string
//         c.ws.readyState === WebSocket.OPEN) {
//       c.ws.send(JSON.stringify(typingMessage));
//       sent++;
//     }
//   }

//   console.log(`✅ Typing indicator sent to ${sent} participant(s)`);

//   // Also publish to Redis for multi-server setups
//   await redisManager.publishMessage(`conversation:${conversationId}`, typingMessage);
// }


// // ============ PRESENCE HANDLERS ============

// async function handlePresence(ws, connectionId, message) {
//   const conn = connections.get(connectionId);
//   if (!conn || conn.role !== 'customer') return;

//   const { conversationId, customerEmail, status, lastActivityAt } = message;
//   if (!conversationId || !customerEmail) return;

//   const validStatuses = ['online', 'away', 'offline'];
//   const safeStatus = validStatuses.includes(status) ? status : 'offline';

//   try {
//     await db.pool.query(`
//       INSERT INTO customer_presence
//         (conversation_id, customer_email, store_id, status, last_activity_at, last_heartbeat_at, ws_connected, updated_at)
//       VALUES ($1, $2, $3, $4, $5, NOW(), TRUE, NOW())
//       ON CONFLICT (conversation_id)
//       DO UPDATE SET
//         status = $4,
//         last_activity_at = $5,
//         last_heartbeat_at = NOW(),
//         ws_connected = TRUE,
//         updated_at = NOW()
//     `, [
//       conversationId,
//       customerEmail,
//       conn.storeId || null,
//       safeStatus,
//       lastActivityAt || new Date()
//     ]);
//   } catch (err) {
//     console.error('[WS Presence] Error:', err);
//   }
// }

// async function handleHeartbeat(ws, connectionId, message) {
//   const conn = connections.get(connectionId);
//   if (!conn || conn.role !== 'customer') {
//     // Still respond with pong for non-customer heartbeats
//     ws.send(JSON.stringify({ type: 'pong', timestamp: new Date().toISOString() }));
//     return;
//   }

//   const { conversationId, status, lastActivityAt } = message;
//   if (!conversationId) {
//     ws.send(JSON.stringify({ type: 'pong', timestamp: new Date().toISOString() }));
//     return;
//   }

//   try {
//     await db.pool.query(`
//       UPDATE customer_presence
//       SET status = $2,
//           last_heartbeat_at = NOW(),
//           last_activity_at = $3,
//           ws_connected = TRUE,
//           updated_at = NOW()
//       WHERE conversation_id = $1
//     `, [conversationId, status || 'online', lastActivityAt || new Date()]);
//   } catch (err) {
//     console.error('[WS Heartbeat] Error:', err);
//   }

//   ws.send(JSON.stringify({ type: 'pong', timestamp: new Date().toISOString() }));
// }

// // ============ BROADCAST FUNCTIONS ============

// function sendToConversation(conversationId, message) {
//   const data = JSON.stringify(message);
//   const target = String(conversationId);
//   let sent = 0;

//   console.log(`📤 Sending to conversation ${conversationId}:`, message.type);

//   for (const conn of connections.values()) {
//     if (String(conn.conversationId) === target && conn.ws.readyState === WebSocket.OPEN) {
//       try {
//         conn.ws.send(data);
//         sent++;
//       } catch (error) {
//         console.error(`❌ Failed to send to connection:`, error);
//       }
//     }
//   }

//   console.log(`✅ Message sent to ${sent} connection(s) in conversation ${conversationId}`);
//   redisManager.publishMessage(`conversation:${conversationId}`, message);
// }

// function broadcastToAgents(message) {
//   const data = JSON.stringify(message);
//   let sent = 0;

//   console.log(`📤 Broadcasting to all agents:`, message.type);

//   // Deliver to agents on THIS server directly (works with the no-Redis stub too)
//   for (const conn of connections.values()) {
//     if (conn.role === 'agent' && conn.ws.readyState === WebSocket.OPEN) {
//       try {
//         conn.ws.send(data);
//         sent++;
//       } catch (error) {
//         console.error(`❌ Failed to send to agent:`, error);
//       }
//     }
//   }

//   console.log(`✅ Message broadcast to ${sent} agent(s)`);

//   // Fan out to OTHER servers via Redis. Tag with our SERVER_ID so we can ignore
//   // it when it echoes back to us (we already delivered locally above).
//   redisManager.publishMessage('chat:broadcast', { ...message, _origin: SERVER_ID });
// }

// // Subscriber for the 'chat:broadcast' channel. Only ever carries agent
// // broadcasts, so it delivers to AGENTS ONLY (never customers), and skips
// // messages this server originated to avoid double delivery.
// function broadcastAgentsFromRedis(message) {
//   if (message && message._origin === SERVER_ID) return; // our own echo — already sent

//   const { _origin, ...clean } = message || {};
//   const data = JSON.stringify(clean);
//   let sent = 0;

//   for (const conn of connections.values()) {
//     if (conn.role === 'agent' && conn.ws.readyState === WebSocket.OPEN) {
//       try {
//         conn.ws.send(data);
//         sent++;
//       } catch (error) {
//         console.error(`❌ Failed to relay broadcast to agent:`, error);
//       }
//     }
//   }

//   console.log(`✅ Relayed Redis broadcast to ${sent} agent(s)`);
// }

// function broadcastToStore(storeId, message) {
//   const data = JSON.stringify(message);
//   let sent = 0;

//   console.log(`📤 Broadcasting to store ${storeId}:`, message.type);

//   for (const conn of connections.values()) {
//     if (conn.storeId === storeId && conn.ws.readyState === WebSocket.OPEN) {
//       try {
//         conn.ws.send(data);
//         sent++;
//       } catch (error) {
//         console.error(`❌ Failed to send to store connection:`, error);
//       }
//     }
//   }

//   console.log(`✅ Message broadcast to ${sent} connection(s) in store ${storeId}`);

//   // Publish to Redis for multi-server setups
//   redisManager.publishMessage(`store:${storeId}`, message);
// }

// function getWebSocketStats() {
//   const stats = {
//     totalConnections: connections.size,
//     agentCount: 0,
//     customerCount: 0,
//     authenticatedCount: 0,
//     stores: new Set(),
//     conversations: new Set()
//   };

//   for (const conn of connections.values()) {
//     if (conn.role === 'agent') stats.agentCount++;
//     if (conn.role === 'customer') stats.customerCount++;
//     if (conn.authenticated) stats.authenticatedCount++;
//     if (conn.storeId) stats.stores.add(conn.storeId);
//     if (conn.conversationId) stats.conversations.add(conn.conversationId);
//   }

//   stats.activeStores = stats.stores.size;
//   stats.activeConversations = stats.conversations.size;
//   delete stats.stores;
//   delete stats.conversations;

//   return stats;
// }

// function closeAll() {
//   console.log(`🔌 Closing all WebSocket connections (${connections.size})`);

//   for (const conn of connections.values()) {
//     if (conn.ws.readyState === WebSocket.OPEN) {
//       try {
//         conn.ws.close();
//       } catch (error) {
//         console.error(`❌ Error closing connection:`, error);
//       }
//     }
//   }

//   connections.clear();
//   console.log('✅ All WebSocket connections closed');
// }

// module.exports = {
//   initWebSocketServer,
//   sendToConversation,
//   broadcastToAgents,
//   broadcastToStore,
//   getWebSocketStats,
//   closeAll
// };






// ============================================================================
// backend/websocket-server.js
// ============================================================================
// KEY CHANGES vs previous version:
//  1. SECURITY: removed `console.log('📨 Received message:', JSON.stringify(message))`.
//     `auth` and `join` frames carry JWTs, and Render retains logs in a
//     searchable store — that line was printing live admin tokens. Payload
//     logging is now keys-only and gated behind WS_DEBUG=true.
//  2. Presence/heartbeat writes are BATCHED. Every heartbeat frame used to do
//     its own UPDATE on the app pool — with a few hundred widget sessions that
//     was the single largest consumer of pool connections. Now buffered in
//     memory and flushed in ONE statement every 15s. Safe because presence is
//     pure liveness data that the 3-minute cleanup job reconciles anyway.
//  3. closeAll() now also stops the reaper and flush timers, so SIGTERM can
//     drain cleanly (server.js must call it — see note at the bottom).
//  4. Disconnect presence writes go through the same buffer instead of firing
//     an immediate UPDATE per closing socket (matters during a mass reconnect).
// ============================================================================

const { WebSocketServer, WebSocket } = require('ws');
const redisManager = process.env.REDIS_URL
  ? require('./redis-manager')
  : require('./redis-manager-stub');
const { verifyToken, verifyWidgetToken } = require('./auth');
const db = require('./database');

const connections = new Map();
let wss = null;
let reaper = null;
let presenceFlushTimer = null;

// Unique per process. Used to ignore our own messages when they come back
// around via the Redis fan-out (prevents double delivery on the origin server).
const SERVER_ID = generateId();

const REAPER_INTERVAL   = 30_000; // native ping sweep for dead sockets
const AUTH_TIMEOUT      = 10_000; // close sockets that never authenticate
const PRESENCE_FLUSH_MS = 15_000; // presence buffer flush cadence

function generateId() {
  return Math.random().toString(36).substring(2, 15) +
         Math.random().toString(36).substring(2, 15);
}

// ============================================================================
// PRESENCE BUFFER
// ============================================================================
// conversationId -> { email, storeId, status, lastActivityAt, wsConnected }
// Last write per conversation wins, which is exactly the semantics we want for
// liveness. Flushed as a single multi-row upsert.

const presenceBuffer = new Map();

function bufferPresence(conversationId, { email, storeId, status, lastActivityAt, wsConnected = true }) {
  if (!conversationId) return;
  const prev = presenceBuffer.get(String(conversationId)) || {};
  presenceBuffer.set(String(conversationId), {
    email: email ?? prev.email ?? null,
    storeId: storeId ?? prev.storeId ?? null,
    status: status ?? prev.status ?? 'online',
    lastActivityAt: lastActivityAt ?? prev.lastActivityAt ?? new Date(),
    wsConnected,
  });
}

async function flushPresence() {
  if (!presenceBuffer.size) return;

  // Snapshot and clear immediately so concurrent heartbeats land in the next batch.
  const batch = [...presenceBuffer.entries()];
  presenceBuffer.clear();

  // Rows without an email cannot satisfy the NOT NULL column on insert. Those
  // are disconnect-only updates for conversations that already have a row, so
  // they are split out and applied as a plain UPDATE.
  const upserts = [];
  const updatesOnly = [];
  for (const [cid, p] of batch) {
    if (p.email) {
      upserts.push({
        cid: Number(cid), email: p.email,
        store: p.storeId == null ? null : Number(p.storeId),
        status: p.status,
        act: (p.lastActivityAt instanceof Date ? p.lastActivityAt : new Date(p.lastActivityAt)).toISOString(),
        wsc: p.wsConnected,
      });
    } else {
      updatesOnly.push({ cid: Number(cid), status: p.status, wsc: p.wsConnected });
    }
  }

  try {
    if (upserts.length) {
      await db.pool.query(`
        INSERT INTO customer_presence
          (conversation_id, customer_email, store_id, status,
           last_activity_at, last_heartbeat_at, ws_connected, updated_at)
        SELECT (v->>'cid')::int,
               v->>'email',
               NULLIF(v->>'store', '')::int,
               v->>'status',
               (v->>'act')::timestamptz,
               NOW(),
               (v->>'wsc')::boolean,
               NOW()
          FROM jsonb_array_elements($1::jsonb) AS v
        ON CONFLICT (conversation_id) DO UPDATE SET
          status            = EXCLUDED.status,
          last_activity_at  = EXCLUDED.last_activity_at,
          last_heartbeat_at = NOW(),
          ws_connected      = EXCLUDED.ws_connected,
          updated_at        = NOW()
      `, [JSON.stringify(upserts)]);
    }

    if (updatesOnly.length) {
      await db.pool.query(`
        UPDATE customer_presence cp
           SET status = v.status, ws_connected = v.wsc, updated_at = NOW()
          FROM (
            SELECT (e->>'cid')::int AS cid, e->>'status' AS status, (e->>'wsc')::boolean AS wsc
              FROM jsonb_array_elements($1::jsonb) AS e
          ) v
         WHERE cp.conversation_id = v.cid
      `, [JSON.stringify(updatesOnly)]);
    }
  } catch (err) {
    // A dropped presence batch is not an incident — the 3-minute cleanup job
    // reconciles stale rows regardless. Warn, do not throw.
    if (err.code === '23503') {
      // Conversation was deleted mid-flight. Nothing to do.
      return;
    }
    console.warn('[WS Presence] flush skipped:', err.message);
  }
}

// ============================================================================
// SERVER INIT
// ============================================================================

function initWebSocketServer(server) {
  wss = new WebSocketServer({ server, path: '/ws' });

  console.log('🔌 WebSocket server initializing...');

  // Subscribe to Redis broadcast channel (agent broadcasts fan out here)
  redisManager.subscribe('chat:broadcast', (message) => {
    broadcastAgentsFromRedis(message);
  });

  // ── Presence flush loop ───────────────────────────────────────────────────
  presenceFlushTimer = setInterval(() => { void flushPresence(); }, PRESENCE_FLUSH_MS);
  presenceFlushTimer.unref();

  // ── Dead-socket reaper ────────────────────────────────────────────────────
  // A socket that dies without a close frame (Render drop, laptop sleep, NAT
  // timeout) can still read as OPEN server-side, so it never fires 'close' and
  // its entry lingers in `connections` forever — causing duplicate/vanishing
  // broadcasts and slow memory growth. Native protocol-level ping/pong detects
  // it: no pong within one interval → terminate(), which fires our normal
  // 'close' handler and runs the existing presence/Redis cleanup.
  //
  // NOTE: this is the WS protocol's own ping()/'pong' frames — completely
  // separate from the app-level JSON {type:'ping'}/{type:'pong'} the client
  // uses for its own liveness check. Browsers answer native pings automatically.
  reaper = setInterval(() => {
    wss.clients.forEach((ws) => {
      if (ws.isAlive === false) {
        console.log('💀 Reaping unresponsive socket');
        return ws.terminate(); // → 'close' → cleanup
      }
      ws.isAlive = false;
      try { ws.ping(); } catch { /* socket already gone */ }
    });
  }, REAPER_INTERVAL);

  wss.on('close', () => {
    clearInterval(reaper);
    clearInterval(presenceFlushTimer);
  });

  wss.on('connection', async (ws, req) => {
    const connectionId = generateId();
    const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress;

    console.log(`✅ New WebSocket connection: ${connectionId} from ${clientIp}`);

    // Reaper bookkeeping
    ws.isAlive = true;
    ws.on('pong', () => { ws.isAlive = true; });

    ws.send(JSON.stringify({
      type: 'connected',
      connectionId,
      timestamp: new Date().toISOString(),
    }));

    connections.set(connectionId, {
      ws,
      connectedAt: new Date(),
      authenticated: false,
    });

    // ── Auth timeout ────────────────────────────────────────────────────────
    // A socket that connects and never sends a valid `auth` (or authenticates
    // via `join`) sits unauthenticated forever. Close it after a grace period.
    ws._authTimer = setTimeout(() => {
      const conn = connections.get(connectionId);
      if (conn && !conn.authenticated) {
        console.warn(`⏰ Auth timeout — closing unauthenticated socket ${connectionId}`);
        try { ws.close(); } catch { /* ignore */ }
      }
    }, AUTH_TIMEOUT);

    ws.on('message', async (data) => {
      let message;
      try {
        message = JSON.parse(data.toString());
      } catch (error) {
        // Malformed frame — never echo the raw body back or log it.
        ws.send(JSON.stringify({ type: 'error', message: 'Invalid message format' }));
        return;
      }
      try {
        await handleWebSocketMessage(ws, connectionId, message);
      } catch (error) {
        console.error(`❌ Error handling ${message?.type || 'message'} from ${connectionId}:`, error.message);
        ws.send(JSON.stringify({ type: 'error', message: 'Failed to handle message' }));
      }
    });

    ws.on('close', async () => {
      if (ws._authTimer) { clearTimeout(ws._authTimer); ws._authTimer = null; }

      const conn = connections.get(connectionId);
      if (!conn) return;

      console.log(`🔌 WebSocket disconnected: ${connectionId} (role: ${conn.role || 'unknown'})`);

      // Buffered rather than an immediate UPDATE: during a mass reconnect
      // (deploy, network blip) hundreds of sockets close at once, and one pool
      // checkout each is exactly the contention we are trying to avoid.
      if (conn.role === 'customer' && conn.conversationId) {
        bufferPresence(conn.conversationId, {
          email: conn.customerEmail,
          storeId: conn.storeId,
          status: 'offline',
          wsConnected: false,
        });
      }

      try {
        await redisManager.removeSocket(connectionId);
        if (conn.conversationId && conn.storeId) {
          await redisManager.removeActiveConversation(conn.storeId, conn.conversationId);
        }
      } catch (err) {
        console.warn('[WS Close] Redis cleanup:', err.message);
      }

      connections.delete(connectionId);
    });

    ws.on('error', (error) => {
      console.error(`❌ WebSocket error for ${connectionId}:`, error.message);
    });
  });

  console.log('✅ WebSocket server initialized on /ws');
}

// ============================================================================
// MESSAGE ROUTER
// ============================================================================

async function handleWebSocketMessage(ws, connectionId, message) {
  const { type } = message;

  // SECURITY: never log the raw payload. `auth` and `join` frames contain JWTs,
  // and platform logs are retained and searchable. Keys only, opt-in.
  if (process.env.WS_DEBUG === 'true') {
    console.log(`📨 ${type} from ${connectionId} — keys: ${Object.keys(message).join(',')}`);
  }

  switch (type) {
    case 'auth':
      await handleAuth(ws, connectionId, message);
      break;

    case 'join':
    case 'join_conversation':
      await handleJoin(ws, connectionId, message);
      break;

    case 'leave':
    case 'leave_conversation':
      await handleLeave(ws, connectionId, message);
      break;

    case 'typing':
      await handleTyping(connectionId, message);
      break;

    case 'presence':
      await handlePresence(ws, connectionId, message);
      break;

    case 'heartbeat':
      await handleHeartbeat(ws, connectionId, message);
      break;

    case 'ping':
      ws.send(JSON.stringify({ type: 'pong', timestamp: new Date().toISOString() }));
      break;

    default:
      console.warn(`⚠️ Unknown message type: ${type} from ${connectionId}`);
      ws.send(JSON.stringify({ type: 'error', message: `Unknown message type: ${type}` }));
  }
}

// ============================================================================
// AUTH
// ============================================================================

async function handleAuth(ws, connectionId, message) {
  const { token, clientType } = message;

  console.log(`🔐 Auth attempt: ${connectionId}, clientType: ${clientType}`);

  if (!token) {
    console.error(`❌ Auth failed: Missing token for ${connectionId}`);
    ws.send(JSON.stringify({ type: 'error', message: 'Missing token' }));
    ws.close();
    return;
  }

  if (clientType === 'agent') {
    try {
      const user = verifyToken(token);
      if (!user) {
        console.error(`❌ Auth failed: Invalid agent token for ${connectionId}`);
        ws.send(JSON.stringify({ type: 'error', message: 'Unauthorized' }));
        ws.close();
        return;
      }

      if (ws._authTimer) { clearTimeout(ws._authTimer); ws._authTimer = null; }

      connections.set(connectionId, {
        ws,
        role: 'agent',
        user,
        authenticated: true,
        connectedAt: new Date(),
      });

      console.log(`✅ Agent authenticated: ${connectionId} (${user.email})`);
      ws.send(JSON.stringify({
        type: 'auth_ok', role: 'agent', user: { id: user.id, email: user.email },
      }));
      return;
    } catch (error) {
      // Log the reason, never the token.
      console.error(`❌ Auth error for ${connectionId}:`, error.message);
      ws.send(JSON.stringify({ type: 'error', message: 'Authentication failed' }));
      ws.close();
      return;
    }
  }

  if (clientType === 'customer') {
    try {
      const widget = verifyWidgetToken(token);
      if (!widget) {
        console.error(`❌ Auth failed: Invalid widget token for ${connectionId}`);
        ws.send(JSON.stringify({ type: 'error', message: 'Unauthorized' }));
        ws.close();
        return;
      }

      if (ws._authTimer) { clearTimeout(ws._authTimer); ws._authTimer = null; }

      connections.set(connectionId, {
        ws,
        role: 'customer',
        storeId: widget.storeId,
        authenticated: true,
        connectedAt: new Date(),
      });

      console.log(`✅ Customer authenticated: ${connectionId} (store: ${widget.storeId})`);
      ws.send(JSON.stringify({ type: 'auth_ok', role: 'customer' }));

      await redisManager.mapSocketToStore(connectionId, widget.storeId);
      return;
    } catch (error) {
      console.error(`❌ Auth error for ${connectionId}:`, error.message);
      ws.send(JSON.stringify({ type: 'error', message: 'Authentication failed' }));
      ws.close();
      return;
    }
  }

  console.error(`❌ Invalid client type: ${clientType}`);
  ws.send(JSON.stringify({ type: 'error', message: 'Invalid client type' }));
  ws.close();
}

// ============================================================================
// JOIN / LEAVE
// ============================================================================

async function handleJoin(ws, connectionId, message) {
  const { conversationId, role, storeId, token, employeeName, customerEmail, customerName } = message;

  console.log(`🚪 Join request: ${connectionId}, conversation: ${conversationId}, role: ${role}`);

  if (!conversationId) {
    console.error('❌ Join failed: Missing conversationId');
    ws.send(JSON.stringify({ type: 'error', message: 'conversationId required' }));
    return;
  }

  const conn = connections.get(connectionId);
  if (!conn) {
    console.error('❌ Join failed: Connection not found');
    ws.send(JSON.stringify({ type: 'error', message: 'Connection not found' }));
    return;
  }

  // If role is absent, fall back to the role established at authentication.
  let effectiveRole = role;
  if (!effectiveRole && conn.role) {
    effectiveRole = conn.role;
    console.log(`ℹ️ Role inferred from authentication: ${effectiveRole}`);
  }
  if (!effectiveRole) {
    console.error('❌ Join failed: Cannot determine role');
    ws.send(JSON.stringify({ type: 'error', message: 'Role required or authenticate first' }));
    return;
  }

  // ── Customer ─────────────────────────────────────────────────────────────
  if (effectiveRole === 'customer') {
    if (!conn.authenticated && token) {
      try {
        const widget = verifyWidgetToken(token);
        if (!widget) {
          console.error('❌ Join failed: Invalid token for customer');
          ws.send(JSON.stringify({ type: 'error', message: 'Unauthorized' }));
          ws.close();
          return;
        }
        if (ws._authTimer) { clearTimeout(ws._authTimer); ws._authTimer = null; }
        conn.authenticated = true;
        conn.storeId = widget.storeId;
        await redisManager.mapSocketToStore(connectionId, widget.storeId);
      } catch (error) {
        console.error('❌ Join error:', error.message);
        ws.send(JSON.stringify({ type: 'error', message: 'Authentication failed' }));
        ws.close();
        return;
      }
    }

    if (!conn.authenticated) {
      ws.send(JSON.stringify({ type: 'error', message: 'Unauthorized - authenticate first' }));
      ws.close();
      return;
    }

    conn.conversationId = conversationId;
    conn.role = 'customer';
    if (customerEmail) conn.customerEmail = customerEmail;
    if (customerName) conn.customerName = customerName;
    if (storeId && !conn.storeId) conn.storeId = storeId;
    connections.set(connectionId, conn);

    if (conn.storeId) {
      await redisManager.addActiveConversation(conn.storeId, conversationId);
    }

    console.log(`✅ Customer joined conversation: ${conversationId}`);
    ws.send(JSON.stringify({ type: 'joined', conversationId, role: 'customer' }));

    broadcastToAgents({
      type: 'customer_joined',
      conversationId,
      customerName: conn.customerName,
      timestamp: new Date().toISOString(),
    });
    return;
  }

  // ── Agent ────────────────────────────────────────────────────────────────
  if (effectiveRole === 'agent') {
    if (!conn.authenticated || conn.role !== 'agent') {
      console.error('❌ Join failed: Agent not authenticated');
      ws.send(JSON.stringify({ type: 'error', message: 'Unauthorized - authenticate first' }));
      ws.close();
      return;
    }

    conn.conversationId = conversationId;
    if (employeeName) conn.employeeName = employeeName;
    connections.set(connectionId, conn);

    console.log(`✅ Agent joined conversation: ${conversationId} (${conn.user?.email || employeeName || 'agent'})`);
    ws.send(JSON.stringify({
      type: 'joined', conversationId, role: 'agent',
      agentName: conn.user?.name || employeeName,
    }));

    sendToConversation(conversationId, {
      type: 'agent_joined',
      conversationId,
      agentName: conn.user?.name || employeeName || 'Support Agent',
      timestamp: new Date().toISOString(),
    });
    return;
  }

  console.error(`❌ Join failed: Invalid role: ${effectiveRole}`);
  ws.send(JSON.stringify({ type: 'error', message: `Invalid role: ${effectiveRole}` }));
}

async function handleLeave(ws, connectionId, message) {
  const conn = connections.get(connectionId);
  if (!conn) {
    console.warn(`⚠️ Leave from unknown connection: ${connectionId}`);
    return;
  }

  const oldConversationId = conn.conversationId;
  console.log(`🚪 Leave request: ${connectionId} from conversation ${oldConversationId}`);

  if (conn.conversationId) {
    delete conn.conversationId;
    connections.set(connectionId, conn);

    if (oldConversationId) {
      sendToConversation(oldConversationId, {
        type: conn.role === 'agent' ? 'agent_left' : 'customer_left',
        conversationId: oldConversationId,
        name: conn.employeeName || conn.customerName,
        timestamp: new Date().toISOString(),
      });
    }
  }

  ws.send(JSON.stringify({ type: 'left', conversationId: oldConversationId }));
}

// ============================================================================
// TYPING
// ============================================================================

async function handleTyping(connectionId, message) {
  const conn = connections.get(connectionId);
  if (!conn || !conn.conversationId) {
    console.warn(`⚠️ Typing indicator from unknown connection: ${connectionId}`);
    return;
  }

  const { conversationId, isTyping, senderType, senderName } = message;

  // Guard: only relay typing for the conversation this socket is actually joined
  // to. Blocks a stale/spoofed conversationId from fanning a typing event into a
  // conversation this socket no longer belongs to.
  if (String(conversationId) !== String(conn.conversationId)) {
    console.warn(`⚠️ Typing conversationId mismatch: joined=${conn.conversationId} claimed=${conversationId}`);
    return;
  }

  // 'Unknown' collapses distinct senders in the client's name-keyed Set.
  const resolvedName =
    senderName || conn.employeeName || conn.customerName ||
    (conn.role === 'agent' ? 'Agent' : 'Customer');

  const typingMessage = {
    type: 'typing',
    conversationId,
    isTyping: isTyping !== false,
    senderType: senderType || conn.role,
    senderName: resolvedName,
    timestamp: new Date().toISOString(),
  };

  let sent = 0;
  for (const [id, c] of connections.entries()) {
    if (id !== connectionId &&
        String(c.conversationId) === String(conversationId) && // one client may send a number, another a string
        c.ws.readyState === WebSocket.OPEN) {
      c.ws.send(JSON.stringify(typingMessage));
      sent++;
    }
  }

  if (process.env.WS_DEBUG === 'true') {
    console.log(`⌨️ Typing relayed to ${sent} participant(s) in ${conversationId}`);
  }

  await redisManager.publishMessage(`conversation:${conversationId}`, typingMessage);
}

// ============================================================================
// PRESENCE / HEARTBEAT  (buffered — no per-frame DB write)
// ============================================================================

async function handlePresence(ws, connectionId, message) {
  const conn = connections.get(connectionId);
  if (!conn || conn.role !== 'customer') return;

  const { conversationId, customerEmail, status, lastActivityAt } = message;
  if (!conversationId || !customerEmail) return;

  const validStatuses = ['online', 'away', 'offline'];
  const safeStatus = validStatuses.includes(status) ? status : 'offline';

  // Remember the email on the connection so a later disconnect can upsert.
  if (!conn.customerEmail) { conn.customerEmail = customerEmail; connections.set(connectionId, conn); }

  bufferPresence(conversationId, {
    email: customerEmail,
    storeId: conn.storeId,
    status: safeStatus,
    lastActivityAt: lastActivityAt || new Date(),
    wsConnected: true,
  });
}

async function handleHeartbeat(ws, connectionId, message) {
  const conn = connections.get(connectionId);

  // Always pong, whatever the role — the client uses it for liveness.
  const pong = JSON.stringify({ type: 'pong', timestamp: new Date().toISOString() });

  if (!conn || conn.role !== 'customer') { ws.send(pong); return; }

  const { conversationId, status, lastActivityAt } = message;
  if (conversationId) {
    bufferPresence(conversationId, {
      email: conn.customerEmail,
      storeId: conn.storeId,
      status: status || 'online',
      lastActivityAt: lastActivityAt || new Date(),
      wsConnected: true,
    });
  }

  ws.send(pong);
}

// ============================================================================
// BROADCAST
// ============================================================================

function sendToConversation(conversationId, message) {
  const data = JSON.stringify(message);
  const target = String(conversationId);
  let sent = 0;

  for (const conn of connections.values()) {
    if (String(conn.conversationId) === target && conn.ws.readyState === WebSocket.OPEN) {
      try { conn.ws.send(data); sent++; }
      catch (error) { console.error('❌ Failed to send to connection:', error.message); }
    }
  }

  if (process.env.WS_DEBUG === 'true') {
    console.log(`📤 ${message.type} → ${sent} connection(s) in conversation ${conversationId}`);
  }

  redisManager.publishMessage(`conversation:${conversationId}`, message);
}

function broadcastToAgents(message) {
  const data = JSON.stringify(message);
  let sent = 0;

  // Deliver to agents on THIS server directly (works with the no-Redis stub too)
  for (const conn of connections.values()) {
    if (conn.role === 'agent' && conn.ws.readyState === WebSocket.OPEN) {
      try { conn.ws.send(data); sent++; }
      catch (error) { console.error('❌ Failed to send to agent:', error.message); }
    }
  }

  if (process.env.WS_DEBUG === 'true') {
    console.log(`📤 ${message.type} → ${sent} agent(s)`);
  }

  // Fan out to OTHER servers via Redis. Tag with our SERVER_ID so we can ignore
  // it when it echoes back to us (we already delivered locally above).
  redisManager.publishMessage('chat:broadcast', { ...message, _origin: SERVER_ID });
}

// Subscriber for the 'chat:broadcast' channel. Only ever carries agent
// broadcasts, so it delivers to AGENTS ONLY (never customers), and skips
// messages this server originated to avoid double delivery.
function broadcastAgentsFromRedis(message) {
  if (message && message._origin === SERVER_ID) return; // our own echo — already sent

  const { _origin, ...clean } = message || {};
  const data = JSON.stringify(clean);
  let sent = 0;

  for (const conn of connections.values()) {
    if (conn.role === 'agent' && conn.ws.readyState === WebSocket.OPEN) {
      try { conn.ws.send(data); sent++; }
      catch (error) { console.error('❌ Failed to relay broadcast to agent:', error.message); }
    }
  }

  if (process.env.WS_DEBUG === 'true') {
    console.log(`✅ Relayed Redis broadcast to ${sent} agent(s)`);
  }
}

function broadcastToStore(storeId, message) {
  const data = JSON.stringify(message);
  let sent = 0;

  for (const conn of connections.values()) {
    if (String(conn.storeId) === String(storeId) && conn.ws.readyState === WebSocket.OPEN) {
      try { conn.ws.send(data); sent++; }
      catch (error) { console.error('❌ Failed to send to store connection:', error.message); }
    }
  }

  if (process.env.WS_DEBUG === 'true') {
    console.log(`📤 ${message.type} → ${sent} connection(s) in store ${storeId}`);
  }

  redisManager.publishMessage(`store:${storeId}`, message);
}

// ============================================================================
// STATS / SHUTDOWN
// ============================================================================

function getWebSocketStats() {
  const stats = {
    totalConnections: connections.size,
    agentCount: 0,
    customerCount: 0,
    authenticatedCount: 0,
    presenceBuffered: presenceBuffer.size,
    stores: new Set(),
    conversations: new Set(),
  };

  for (const conn of connections.values()) {
    if (conn.role === 'agent') stats.agentCount++;
    if (conn.role === 'customer') stats.customerCount++;
    if (conn.authenticated) stats.authenticatedCount++;
    if (conn.storeId) stats.stores.add(conn.storeId);
    if (conn.conversationId) stats.conversations.add(conn.conversationId);
  }

  stats.activeStores = stats.stores.size;
  stats.activeConversations = stats.conversations.size;
  delete stats.stores;
  delete stats.conversations;

  return stats;
}

/**
 * Called from server.js shutdown(). Flushes buffered presence, stops the
 * timers, and sends a clean close frame to every client so they reconnect
 * immediately to the next instance instead of waiting for a socket timeout.
 */
async function closeAll() {
  console.log(`🔌 Closing all WebSocket connections (${connections.size})`);

  clearInterval(reaper);
  clearInterval(presenceFlushTimer);

  // Persist whatever liveness state is buffered before we drop the sockets.
  try { await flushPresence(); } catch { /* best effort */ }

  for (const conn of connections.values()) {
    if (conn.ws.readyState === WebSocket.OPEN) {
      try { conn.ws.close(1001, 'Server shutting down'); }
      catch (error) { console.error('❌ Error closing connection:', error.message); }
    }
  }

  connections.clear();
  console.log('✅ All WebSocket connections closed');
}

module.exports = {
  initWebSocketServer,
  sendToConversation,
  broadcastToAgents,
  broadcastToStore,
  getWebSocketStats,
  closeAll,
  flushPresence,
};