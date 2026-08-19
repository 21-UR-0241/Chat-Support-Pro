


// const WS_URL = import.meta.env.PROD
//   ? (import.meta.env.VITE_WS_URL || 'wss://chat-support-pro.onrender.com/ws')
//   : 'ws://localhost:3000/ws';

// if (import.meta.env.PROD && !WS_URL) {
//   throw new Error('VITE_WS_URL is required in production');
// }

// const HEARTBEAT_INTERVAL = 25000; // < Render's ~60s idle timeout
// const MAX_RECONNECT_DELAY = 30000; // backoff caps here, but never gives up
// const HANDSHAKE_TIMEOUT   = 45000; // Render cold-boot can take 30-60s; must ride it out
// const PONG_TIMEOUT        = 10000; // must see a pong within this of a ping
// const STALE_AFTER         = 30000; // OPEN-but-silent longer than this ⇒ treat as dead

// class WebSocketService {
//   constructor() {
//     this.ws = null;
//     this.reconnectAttempts = 0;
//     this.reconnectDelay = 3000;
//     this.listeners = new Map();
//     this.employeeId = null;
//     this.queue = [];
//     this.isConnecting = false;
//     this.intentionalClose = false;
//     this.authenticated = false;
//     this.connectionId = null;

//     this.heartbeatTimer  = null;
//     this.reconnectTimer  = null;
//     this.connectTimeout  = null;  // handshake watchdog
//     this.pongTimer       = null;  // liveness watchdog

//     // Timestamp of the last inbound frame of ANY kind. Proof of life that
//     // doesn't depend on readyState (which lies for half-open sockets).
//     this.lastInboundAt = 0;

//     // Only enforce pong-liveness once we've actually seen the server reply to a
//     // ping. If the server never speaks 'pong', we never arm the death timer, so
//     // we don't false-positive into a reconnect loop every heartbeat.
//     this.serverSpeaksPong = false;

//     // Recover realtime when the network comes back or the tab is refocused,
//     // even mid-backoff.
//     if (typeof window !== 'undefined') {
//       window.addEventListener('online', () => this.handleNetworkBack());
//       document.addEventListener('visibilitychange', () => {
//         if (document.visibilityState === 'visible') this.handleNetworkBack();
//       });
//     }
//   }

//   /**
//    * Connect to WebSocket server.
//    */
//   connect(employeeId) {
//     if (this.ws && this.ws.readyState === WebSocket.OPEN) {
//       console.log('WebSocket already connected');
//       return;
//     }
//     if (this.isConnecting) return;

//     this.employeeId = employeeId;
//     this.isConnecting = true;
//     this.intentionalClose = false;

//     try {
//       this.ws = new WebSocket(WS_URL);

//       // ── Handshake watchdog ──────────────────────────────────────────────
//       // If a proxy accepts the TCP connection but never completes the WS
//       // upgrade, the socket sits in CONNECTING forever: no onopen, no onclose,
//       // no onerror. Force it closed — close() on a CONNECTING socket fires
//       // onclose, which owns the single reconnect. We do NOT schedule here, or
//       // we'd double-schedule (and double-increment the backoff) against onclose.
//       //
//       // The 45s ceiling is deliberate: a cold Render instance can take 30-60s
//       // to wake, so a shorter timeout would kill every attempt mid-boot and
//       // never let one complete. A warm handshake finishes in well under a
//       // second, so the long ceiling only ever matters during a cold start.
//       this.connectTimeout = setTimeout(() => {
//         if (this.ws && this.ws.readyState === WebSocket.CONNECTING) {
//           console.warn('WS handshake timeout — forcing close to retry');
//           this.isConnecting = false;
//           try { this.ws.close(); } catch { /* onclose runs the reconnect */ }
//         }
//       }, HANDSHAKE_TIMEOUT);

//       this.ws.onopen = () => {
//         console.log('✅ WebSocket connected');
//         this.clearConnectTimeout();
//         if (this.reconnectTimer) { clearTimeout(this.reconnectTimer); this.reconnectTimer = null; }
//         this.reconnectAttempts = 0;
//         this.isConnecting = false;
//         this.lastInboundAt = Date.now(); // opening counts as proof of life

//         // Authenticate as agent using JWT
//         const token = localStorage.getItem('token');
//         this.send({ type: 'auth', clientType: 'agent', token });

//         // Flush queued messages
//         this.queue.forEach(msg => this.ws.send(msg));
//         this.queue = [];
//         this.startHeartbeat();
//         this.emit('open'); // transport open — NOT yet authenticated
//       };

//       this.ws.onmessage = (event) => {
//         // ANY inbound frame is proof the connection is alive. Record it first,
//         // before parsing, so even malformed frames refresh liveness.
//         this.lastInboundAt = Date.now();
//         try {
//           const data = JSON.parse(event.data);
//           if (data.type === 'pong') {
//             // Server is alive — clear the liveness watchdog and remember that
//             // this server implements pong so we keep enforcing it going forward.
//             this.serverSpeaksPong = true;
//             if (this.pongTimer) { clearTimeout(this.pongTimer); this.pongTimer = null; }
//             return; // swallow keepalive replies
//           }

//           // Server's PRE-AUTH ack — sent the instant the socket is accepted,
//           // before we've authenticated. NOT the app-facing "connected" signal.
//           // Swallow it so it can't reach 'connected' listeners.
//           if (data.type === 'connected') {
//             this.connectionId = data.connectionId || null;
//             return;
//           }

//           // Auth confirmed by the server. THIS is the real app-facing
//           // "connected / Live" signal.
//           if (data.type === 'auth_ok') {
//             this.authenticated = true;
//             this.emit('authenticated', data);
//             this.emit('connected', data);
//             return;
//           }

//           this.emit(data.type, data);
//           this.emit('message', data);
//         } catch (error) {
//           console.error('Failed to parse WebSocket message:', error);
//         }
//       };

//       this.ws.onerror = (error) => {
//         console.error('❌ WebSocket error:', error);
//         this.emit('error', error);
//         // Don't schedule here — onclose follows onerror and owns reconnect.
//       };

//       this.ws.onclose = (event) => {
//         console.log(`WebSocket closed (code ${event?.code ?? '?'})`);
//         this.clearConnectTimeout();
//         this.isConnecting = false;
//         this.authenticated = false;
//         this.stopHeartbeat();

//         // Intentional close (logout/unmount): do NOT reconnect.
//         if (this.intentionalClose) {
//           this.intentionalClose = false;
//           return;
//         }

//         this.emit('disconnected');
//         this.scheduleReconnect();
//       };
//     } catch (error) {
//       console.error('Failed to create WebSocket:', error);
//       this.clearConnectTimeout();
//       this.isConnecting = false;
//       this.scheduleReconnect();
//     }
//   }


//   scheduleReconnect() {
//     if (this.intentionalClose) return;
//     if (this.reconnectTimer) return; // one pending attempt at a time
//     if (this.ws && this.ws.readyState === WebSocket.OPEN) return;

//     this.reconnectAttempts++;
//     const base = Math.min(
//       this.reconnectDelay * 2 ** (this.reconnectAttempts - 1),
//       MAX_RECONNECT_DELAY
//     );
//     const delay = base + Math.random() * 1000; // jitter
//     console.log(`Reconnecting in ${Math.round(delay)}ms (attempt ${this.reconnectAttempts})`);
//     this.emit('reconnecting', { attempt: this.reconnectAttempts, delay });

//     this.reconnectTimer = setTimeout(() => {
//       this.reconnectTimer = null;
//       this.connect(this.employeeId);
//     }, delay);
//   }

//   clearConnectTimeout() {
//     if (this.connectTimeout) { clearTimeout(this.connectTimeout); this.connectTimeout = null; }
//   }

//   forceReconnect(reason) {
//     console.warn('Forcing reconnect:', reason);
//     const old = this.ws;
//     if (old) {
//       old.onopen = old.onmessage = old.onerror = old.onclose = null;
//       try { old.close(); } catch { /* ignore */ }
//     }
//     this.ws = null;
//     this.isConnecting = false;
//     this.authenticated = false;
//     this.stopHeartbeat();
//     this.clearConnectTimeout();
//     if (this.reconnectTimer) { clearTimeout(this.reconnectTimer); this.reconnectTimer = null; }
//     this.reconnectAttempts = 0;
//     this.connect(this.employeeId);
//   }

//   /**
//    * Disconnect WebSocket (intentional — will not auto-reconnect).
//    */
//   disconnect() {
//     this.intentionalClose = true;
//     this.stopHeartbeat();
//     this.clearConnectTimeout();
//     if (this.reconnectTimer) { clearTimeout(this.reconnectTimer); this.reconnectTimer = null; }
//     if (this.ws) {
//       try { this.ws.close(); } catch { /* ignore */ }
//       this.ws = null;
//     }
//   }

//   startHeartbeat() {
//     this.stopHeartbeat();
//     this.heartbeatTimer = setInterval(() => {
//       if (this.ws && this.ws.readyState === WebSocket.OPEN) {
//         this.send({ type: 'ping' });

//         if (this.serverSpeaksPong && !this.pongTimer) {
//           this.pongTimer = setTimeout(() => {
//             console.warn('No pong within timeout — connection is stale, forcing reconnect');
//             this.pongTimer = null;
//             try { this.ws.close(); } catch { /* ignore */ } // → onclose → reconnect
//           }, PONG_TIMEOUT);
//         }
//       }
//     }, HEARTBEAT_INTERVAL);
//   }

//   stopHeartbeat() {
//     if (this.heartbeatTimer) { clearInterval(this.heartbeatTimer); this.heartbeatTimer = null; }
//     if (this.pongTimer)      { clearTimeout(this.pongTimer);       this.pongTimer = null; }
//   }

//   handleNetworkBack() {
//     if (this.intentionalClose || !this.employeeId) return;

//     if (this.isConnected()) {
//       const quietMs = Date.now() - (this.lastInboundAt || 0);
//       if (quietMs < STALE_AFTER) return;                 // proven alive recently
//       this.forceReconnect(`silent ${Math.round(quietMs / 1000)}s — half-open`);
//       return;
//     }
//     if (this.isConnecting) return;

//     console.log('🔌 Network/visibility regained — reconnecting');
//     if (this.reconnectTimer) { clearTimeout(this.reconnectTimer); this.reconnectTimer = null; }
//     this.reconnectAttempts = 0;
//     this.connect(this.employeeId);
//   }

//   /**
//    * Send message through WebSocket.
//    */
//   send(data) {
//     const payload = JSON.stringify(data);
//     if (this.ws && this.ws.readyState === WebSocket.OPEN) {
//       this.ws.send(payload);
//     } else {
//       this.queue.push(payload); // flushed on next open
//     }
//   }

//   /**
//    * Join a conversation room.
//    */
//   joinConversation(conversationId) {
//     this.send({ type: 'join', conversationId });
//   }

//   /**
//    * Leave a conversation room.
//    */
//   leaveConversation() {
//     this.send({ type: 'leave' });
//   }

//   /**
//    * Send typing indicator.
//    */
//   sendTyping(conversationId, isTyping) {
//     this.send({
//       type: 'typing',
//       conversationId,
//       isTyping,
//       senderType: 'agent',
//       senderName: 'Customer Support', // generic — the real agent name is never sent to customers
//     });
//   }

//   /**
//    * Register event listener. Returns an unsubscribe fn.
//    */
//   on(event, callback) {
//     if (!this.listeners.has(event)) this.listeners.set(event, []);
//     this.listeners.get(event).push(callback);
//     return () => {
//       const callbacks = this.listeners.get(event);
//       if (callbacks) {
//         const index = callbacks.indexOf(callback);
//         if (index > -1) callbacks.splice(index, 1);
//       }
//     };
//   }

//   /**
//    * Remove event listener.
//    */
//   off(event, callback) {
//     const callbacks = this.listeners.get(event);
//     if (callbacks) {
//       const index = callbacks.indexOf(callback);
//       if (index > -1) callbacks.splice(index, 1);
//     }
//   }

//   /**
//    * Emit event to all listeners.
//    */
//   emit(event, data) {
//     const callbacks = this.listeners.get(event);
//     if (callbacks) {
//       // Iterate a copy so a listener that unsubscribes itself during emit
//       // doesn't cause the next listener to be skipped.
//       [...callbacks].forEach(callback => {
//         try { callback(data); }
//         catch (error) { console.error(`Error in ${event} listener:`, error); }
//       });
//     }
//   }

//   /**
//    * Get connection status.
//    */
//   isConnected() {
//     return !!this.ws && this.ws.readyState === WebSocket.OPEN;
//   }
// }

// export default new WebSocketService();



// ============================================================================
// services/websocket.js — agent WebSocket singleton (Chat Support Pro)
// ============================================================================
// CHANGE vs previous version (single, surgical):
//   handleNetworkBack() now emits a 'resync' event on EVERY refocus / network
//   return, BEFORE its liveness logic. Previously, if the socket was still
//   technically OPEN and had seen inbound traffic recently, this method
//   returned silently — no reconnect, so no 'connected', so nothing told the
//   app to refetch. But broadcastToAgents() on the server is fire-and-forget:
//   a frame dropped while a backgrounded tab's event loop was throttled is
//   gone permanently, leaving the conversation list stale even though the
//   socket never "died." The app only recovered on a full page reload.
//
//   'resync' fires unconditionally on refocus so the app can pull the gap with
//   one cached GET. The reconnect paths below still fire 'connected' as before;
//   a double refetch is harmless (idempotent, server-cached with a short TTL).
//
//   Wire in App.jsx alongside the other ws.on(...) handlers:
//     const uR = ws.on('resync', () => handlersRef.current.refreshConversations());
//   ...and include uR() in the effect's cleanup.
// ============================================================================

const WS_URL = import.meta.env.PROD
  ? (import.meta.env.VITE_WS_URL || 'wss://chat-support-pro.onrender.com/ws')
  : 'ws://localhost:3000/ws';

if (import.meta.env.PROD && !WS_URL) {
  throw new Error('VITE_WS_URL is required in production');
}

const HEARTBEAT_INTERVAL = 25000; // < Render's ~60s idle timeout
const MAX_RECONNECT_DELAY = 30000; // backoff caps here, but never gives up
const HANDSHAKE_TIMEOUT   = 45000; // Render cold-boot can take 30-60s; must ride it out
const PONG_TIMEOUT        = 10000; // must see a pong within this of a ping
const STALE_AFTER         = 30000; // OPEN-but-silent longer than this ⇒ treat as dead

class WebSocketService {
  constructor() {
    this.ws = null;
    this.reconnectAttempts = 0;
    this.reconnectDelay = 3000;
    this.listeners = new Map();
    this.employeeId = null;
    this.queue = [];
    this.isConnecting = false;
    this.intentionalClose = false;
    this.authenticated = false;
    this.connectionId = null;

    this.heartbeatTimer  = null;
    this.reconnectTimer  = null;
    this.connectTimeout  = null;  // handshake watchdog
    this.pongTimer       = null;  // liveness watchdog

    // Timestamp of the last inbound frame of ANY kind. Proof of life that
    // doesn't depend on readyState (which lies for half-open sockets).
    this.lastInboundAt = 0;

    // Only enforce pong-liveness once we've actually seen the server reply to a
    // ping. If the server never speaks 'pong', we never arm the death timer, so
    // we don't false-positive into a reconnect loop every heartbeat.
    this.serverSpeaksPong = false;

    // Recover realtime when the network comes back or the tab is refocused,
    // even mid-backoff.
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => this.handleNetworkBack());
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') this.handleNetworkBack();
      });
    }
  }

  /**
   * Connect to WebSocket server.
   */
  connect(employeeId) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      console.log('WebSocket already connected');
      return;
    }
    if (this.isConnecting) return;

    this.employeeId = employeeId;
    this.isConnecting = true;
    this.intentionalClose = false;

    try {
      this.ws = new WebSocket(WS_URL);

      // ── Handshake watchdog ──────────────────────────────────────────────
      // If a proxy accepts the TCP connection but never completes the WS
      // upgrade, the socket sits in CONNECTING forever: no onopen, no onclose,
      // no onerror. Force it closed — close() on a CONNECTING socket fires
      // onclose, which owns the single reconnect. We do NOT schedule here, or
      // we'd double-schedule (and double-increment the backoff) against onclose.
      //
      // The 45s ceiling is deliberate: a cold Render instance can take 30-60s
      // to wake, so a shorter timeout would kill every attempt mid-boot and
      // never let one complete. A warm handshake finishes in well under a
      // second, so the long ceiling only ever matters during a cold start.
      this.connectTimeout = setTimeout(() => {
        if (this.ws && this.ws.readyState === WebSocket.CONNECTING) {
          console.warn('WS handshake timeout — forcing close to retry');
          this.isConnecting = false;
          try { this.ws.close(); } catch { /* onclose runs the reconnect */ }
        }
      }, HANDSHAKE_TIMEOUT);

      this.ws.onopen = () => {
        console.log('✅ WebSocket connected');
        this.clearConnectTimeout();
        if (this.reconnectTimer) { clearTimeout(this.reconnectTimer); this.reconnectTimer = null; }
        this.reconnectAttempts = 0;
        this.isConnecting = false;
        this.lastInboundAt = Date.now(); // opening counts as proof of life

        // Authenticate as agent using JWT
        const token = localStorage.getItem('token');
        this.send({ type: 'auth', clientType: 'agent', token });

        // Flush queued messages
        this.queue.forEach(msg => this.ws.send(msg));
        this.queue = [];
        this.startHeartbeat();
        this.emit('open'); // transport open — NOT yet authenticated
      };

      this.ws.onmessage = (event) => {
        // ANY inbound frame is proof the connection is alive. Record it first,
        // before parsing, so even malformed frames refresh liveness.
        this.lastInboundAt = Date.now();
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'pong') {
            // Server is alive — clear the liveness watchdog and remember that
            // this server implements pong so we keep enforcing it going forward.
            this.serverSpeaksPong = true;
            if (this.pongTimer) { clearTimeout(this.pongTimer); this.pongTimer = null; }
            return; // swallow keepalive replies
          }

          // Server's PRE-AUTH ack — sent the instant the socket is accepted,
          // before we've authenticated. NOT the app-facing "connected" signal.
          // Swallow it so it can't reach 'connected' listeners.
          if (data.type === 'connected') {
            this.connectionId = data.connectionId || null;
            return;
          }

          // Auth confirmed by the server. THIS is the real app-facing
          // "connected / Live" signal.
          if (data.type === 'auth_ok') {
            this.authenticated = true;
            this.emit('authenticated', data);
            this.emit('connected', data);
            return;
          }

          this.emit(data.type, data);
          this.emit('message', data);
        } catch (error) {
          console.error('Failed to parse WebSocket message:', error);
        }
      };

      this.ws.onerror = (error) => {
        console.error('❌ WebSocket error:', error);
        this.emit('error', error);
        // Don't schedule here — onclose follows onerror and owns reconnect.
      };

      this.ws.onclose = (event) => {
        console.log(`WebSocket closed (code ${event?.code ?? '?'})`);
        this.clearConnectTimeout();
        this.isConnecting = false;
        this.authenticated = false;
        this.stopHeartbeat();

        // Intentional close (logout/unmount): do NOT reconnect.
        if (this.intentionalClose) {
          this.intentionalClose = false;
          return;
        }

        this.emit('disconnected');
        this.scheduleReconnect();
      };
    } catch (error) {
      console.error('Failed to create WebSocket:', error);
      this.clearConnectTimeout();
      this.isConnecting = false;
      this.scheduleReconnect();
    }
  }


  scheduleReconnect() {
    if (this.intentionalClose) return;
    if (this.reconnectTimer) return; // one pending attempt at a time
    if (this.ws && this.ws.readyState === WebSocket.OPEN) return;

    this.reconnectAttempts++;
    const base = Math.min(
      this.reconnectDelay * 2 ** (this.reconnectAttempts - 1),
      MAX_RECONNECT_DELAY
    );
    const delay = base + Math.random() * 1000; // jitter
    console.log(`Reconnecting in ${Math.round(delay)}ms (attempt ${this.reconnectAttempts})`);
    this.emit('reconnecting', { attempt: this.reconnectAttempts, delay });

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect(this.employeeId);
    }, delay);
  }

  clearConnectTimeout() {
    if (this.connectTimeout) { clearTimeout(this.connectTimeout); this.connectTimeout = null; }
  }

  forceReconnect(reason) {
    console.warn('Forcing reconnect:', reason);
    const old = this.ws;
    if (old) {
      old.onopen = old.onmessage = old.onerror = old.onclose = null;
      try { old.close(); } catch { /* ignore */ }
    }
    this.ws = null;
    this.isConnecting = false;
    this.authenticated = false;
    this.stopHeartbeat();
    this.clearConnectTimeout();
    if (this.reconnectTimer) { clearTimeout(this.reconnectTimer); this.reconnectTimer = null; }
    this.reconnectAttempts = 0;
    this.connect(this.employeeId);
  }

  /**
   * Disconnect WebSocket (intentional — will not auto-reconnect).
   */
  disconnect() {
    this.intentionalClose = true;
    this.stopHeartbeat();
    this.clearConnectTimeout();
    if (this.reconnectTimer) { clearTimeout(this.reconnectTimer); this.reconnectTimer = null; }
    if (this.ws) {
      try { this.ws.close(); } catch { /* ignore */ }
      this.ws = null;
    }
  }

  startHeartbeat() {
    this.stopHeartbeat();
    this.heartbeatTimer = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.send({ type: 'ping' });

        if (this.serverSpeaksPong && !this.pongTimer) {
          this.pongTimer = setTimeout(() => {
            console.warn('No pong within timeout — connection is stale, forcing reconnect');
            this.pongTimer = null;
            try { this.ws.close(); } catch { /* ignore */ } // → onclose → reconnect
          }, PONG_TIMEOUT);
        }
      }
    }, HEARTBEAT_INTERVAL);
  }

  stopHeartbeat() {
    if (this.heartbeatTimer) { clearInterval(this.heartbeatTimer); this.heartbeatTimer = null; }
    if (this.pongTimer)      { clearTimeout(this.pongTimer);       this.pongTimer = null; }
  }

  handleNetworkBack() {
    if (this.intentionalClose || !this.employeeId) return;

    // ── THE FIX ────────────────────────────────────────────────────────────
    // Emit 'resync' on EVERY refocus / network return, before any liveness
    // check. A backgrounded tab's event loop is throttled (timers clamped to
    // ~1/min; a minimized renderer can be paused outright), so a broadcast that
    // arrived during that window can be dropped from app state without the
    // socket ever closing. When that happens, none of the branches below fire a
    // reconnect — the socket is still OPEN and recently active — so nothing
    // pulls the missed data and the list stays stale until a manual reload.
    // 'resync' lets the app refetch unconditionally (one cached GET). Reconnect
    // paths still emit 'connected' too; a duplicate refetch is idempotent.
    this.emit('resync');

    if (this.isConnected()) {
      const quietMs = Date.now() - (this.lastInboundAt || 0);
      if (quietMs < STALE_AFTER) return;                 // proven alive recently
      this.forceReconnect(`silent ${Math.round(quietMs / 1000)}s — half-open`);
      return;
    }
    if (this.isConnecting) return;

    console.log('🔌 Network/visibility regained — reconnecting');
    if (this.reconnectTimer) { clearTimeout(this.reconnectTimer); this.reconnectTimer = null; }
    this.reconnectAttempts = 0;
    this.connect(this.employeeId);
  }

  /**
   * Send message through WebSocket.
   */
  send(data) {
    const payload = JSON.stringify(data);
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(payload);
    } else {
      this.queue.push(payload); // flushed on next open
    }
  }

  /**
   * Join a conversation room.
   */
  joinConversation(conversationId) {
    this.send({ type: 'join', conversationId });
  }

  /**
   * Leave a conversation room.
   */
  leaveConversation() {
    this.send({ type: 'leave' });
  }

  /**
   * Send typing indicator.
   */
  sendTyping(conversationId, isTyping) {
    this.send({
      type: 'typing',
      conversationId,
      isTyping,
      senderType: 'agent',
      senderName: 'Customer Support', // generic — the real agent name is never sent to customers
    });
  }

  /**
   * Register event listener. Returns an unsubscribe fn.
   */
  on(event, callback) {
    if (!this.listeners.has(event)) this.listeners.set(event, []);
    this.listeners.get(event).push(callback);
    return () => {
      const callbacks = this.listeners.get(event);
      if (callbacks) {
        const index = callbacks.indexOf(callback);
        if (index > -1) callbacks.splice(index, 1);
      }
    };
  }

  /**
   * Remove event listener.
   */
  off(event, callback) {
    const callbacks = this.listeners.get(event);
    if (callbacks) {
      const index = callbacks.indexOf(callback);
      if (index > -1) callbacks.splice(index, 1);
    }
  }

  /**
   * Emit event to all listeners.
   */
  emit(event, data) {
    const callbacks = this.listeners.get(event);
    if (callbacks) {
      // Iterate a copy so a listener that unsubscribes itself during emit
      // doesn't cause the next listener to be skipped.
      [...callbacks].forEach(callback => {
        try { callback(data); }
        catch (error) { console.error(`Error in ${event} listener:`, error); }
      });
    }
  }

  /**
   * Get connection status.
   */
  isConnected() {
    return !!this.ws && this.ws.readyState === WebSocket.OPEN;
  }
}

export default new WebSocketService();