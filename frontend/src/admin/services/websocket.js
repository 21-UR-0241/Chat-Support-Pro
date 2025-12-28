/**
 * WebSocket Service
 * Manages WebSocket connection for real-time updates
 */

// Use proper WebSocket URL based on environment
const WS_URL = import.meta.env.PROD
  ? (import.meta.env.VITE_WS_URL || 'wss://your-app.herokuapp.com/ws')
  : 'ws://localhost:3001/ws'; // Direct connection in development

class WebSocketService {
  constructor() {
    this.ws = null;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectDelay = 3000;
    this.listeners = new Map();
    this.employeeId = null;
  }

  /**
   * Connect to WebSocket server
   */
  connect(employeeId) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      console.log('WebSocket already connected');
      return;
    }

    this.employeeId = employeeId;

    try {
      this.ws = new WebSocket(WS_URL);

      this.ws.onopen = () => {
        console.log('✅ WebSocket connected');
        this.reconnectAttempts = 0;

        // Authenticate as agent
        this.send({
          type: 'auth',
          clientType: 'agent',
          employeeId: this.employeeId,
        });

        // Notify listeners
        this.emit('connected');
      };

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          console.log('📨 WebSocket message:', data.type);
          
          // Emit to listeners
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
        this.emit('disconnected');

        // Attempt to reconnect
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
          this.reconnectAttempts++;
          console.log(`Reconnecting... (${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
          
          setTimeout(() => {
            this.connect(this.employeeId);
          }, this.reconnectDelay);
        } else {
          console.error('Max reconnection attempts reached');
          this.emit('max_reconnect_reached');
        }
      };
    } catch (error) {
      console.error('Failed to create WebSocket:', error);
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
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    } else {
      console.warn('WebSocket not connected, cannot send message');
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

    // Return unsubscribe function
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