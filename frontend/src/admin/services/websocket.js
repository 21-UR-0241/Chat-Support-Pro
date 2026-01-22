/**
 * WebSocket Service
 * Manages WebSocket connection for real-time updates
 */
const WS_URL = import.meta.env.PROD
  ? (import.meta.env.VITE_WS_URL || null)
  : 'ws://localhost:3000/ws';

if (import.meta.env.PROD && !WS_URL) {
  throw new Error('VITE_WS_URL is required in production');
}

class WebSocketService {
  constructor() {
    this.ws = null;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectDelay = 3000;
    this.listeners = new Map();
    this.employeeId = null;
    this.queue = [];
    this.isConnecting = false;
  }

  /**
   * Connect to WebSocket server
   */
  connect(employeeId) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      console.log('WebSocket already connected');
      return;
    }
    if (this.isConnecting) return;

    this.employeeId = employeeId;
    this.isConnecting = true;

    try {
      this.ws = new WebSocket(WS_URL);

      this.ws.onopen = () => {
        console.log('✅ WebSocket connected');
        this.reconnectAttempts = 0;
        this.isConnecting = false;

        // Authenticate as agent using JWT
        const token = localStorage.getItem('token');
        this.send({
          type: 'auth',
          clientType: 'agent',
          token
        });

        // Flush queued messages
        this.queue.forEach(msg => this.ws.send(msg));
        this.queue = [];

        this.emit('connected');
      };

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          this.emit(data.type, data);
          this.emit('message', data);
        } catch (error) {
          console.error('Failed to parse WebSocket message:', error);
        }
      };

      this.ws.onerror = (error) => {
        console.error('❌ WebSocket error:', error);
        this.emit('error', error);
      };

      this.ws.onclose = () => {
        console.log('WebSocket closed');
        this.isConnecting = false;
        this.emit('disconnected');

        if (this.reconnectAttempts < this.maxReconnectAttempts) {
          this.reconnectAttempts++;
          setTimeout(() => this.connect(this.employeeId), this.reconnectDelay);
        } else {
          this.emit('max_reconnect_reached');
        }
      };
    } catch (error) {
      console.error('Failed to create WebSocket:', error);
      this.isConnecting = false;
    }
  }

  /**
   * Disconnect WebSocket
   */
  disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  /**
   * Send message through WebSocket
   */
  send(data) {
    const payload = JSON.stringify(data);

    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(payload);
    } else {
      // Queue while connecting
      this.queue.push(payload);
    }
  }

  /**
   * Join a conversation room
   */
  joinConversation(conversationId) {
    this.send({
      type: 'join',
      conversationId,
    });
  }

  /**
   * Leave a conversation room
   */
  leaveConversation() {
    this.send({
      type: 'leave',
    });
  }

  /**
   * Send typing indicator
   */
  sendTyping(conversationId, isTyping, senderName) {
    this.send({
      type: 'typing',
      conversationId,
      isTyping,
      sender: senderName,
    });
  }

  /**
   * Register event listener
   */
  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event).push(callback);

    return () => {
      const callbacks = this.listeners.get(event);
      if (callbacks) {
        const index = callbacks.indexOf(callback);
        if (index > -1) {
          callbacks.splice(index, 1);
        }
      }
    };
  }

  /**
   * Remove event listener
   */
  off(event, callback) {
    const callbacks = this.listeners.get(event);
    if (callbacks) {
      const index = callbacks.indexOf(callback);
      if (index > -1) {
        callbacks.splice(index, 1);
      }
    }
  }

  /**
   * Emit event to all listeners
   */
  emit(event, data) {
    const callbacks = this.listeners.get(event);
    if (callbacks) {
      callbacks.forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error(`Error in ${event} listener:`, error);
        }
      });
    }
  }

  /**
   * Get connection status
   */
  isConnected() {
    return this.ws && this.ws.readyState === WebSocket.OPEN;
  }
}

export default new WebSocketService();