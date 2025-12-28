/**
 * Shopify Chat Widget Initializer
 * Loaded by theme app extension
 * Connects to your custom backend server
 * 
 * This file is served from YOUR server and loaded by the Liquid template
 */

(function() {
  'use strict';
  
  // Get configuration from data attributes set by Liquid template
  const root = document.getElementById('shopify-chat-widget-root');
  if (!root) {
    console.error('[Chat Widget] Root element not found');
    return;
  }
  
  // Extract configuration
  const config = {
    shopDomain: root.dataset.shopDomain,
    apiUrl: root.dataset.apiUrl,
    wsUrl: root.dataset.wsUrl,
    color: root.dataset.widgetColor || '#667eea',
    welcomeMessage: root.dataset.welcomeMessage || 'Hi! How can we help you today?',
    position: root.dataset.position || 'bottom-right',
    bottomSpacing: parseInt(root.dataset.bottomSpacing) || 20,
    sideSpacing: parseInt(root.dataset.sideSpacing) || 20,
    showOnMobile: root.dataset.showOnMobile !== 'false',
    showOnDesktop: root.dataset.showOnDesktop !== 'false',
  };
  
  // Validate required config
  if (!config.apiUrl || !config.wsUrl) {
    console.error('[Chat Widget] Missing required configuration (API URL or WebSocket URL)');
    return;
  }
  
  // Generate store ID from shop domain
  config.storeId = 'store_' + config.shopDomain
    .replace('.myshopify.com', '')
    .replace(/-/g, '_');
  
  console.log('[Chat Widget] Initializing for store:', config.storeId);
  
  // Check device visibility
  const isMobile = window.innerWidth <= 768;
  if ((isMobile && !config.showOnMobile) || (!isMobile && !config.showOnDesktop)) {
    console.log('[Chat Widget] Hidden on this device type');
    return;
  }
  
  /**
   * Main Chat Widget Class
   */
  class ShopifyChatWidget {
    constructor(config) {
      this.config = config;
      this.ws = null;
      this.conversationId = null;
      this.customerEmail = this.getCustomerEmail();
      this.customerName = this.getCustomerName();
      this.isOpen = false;
      this.unreadCount = 0;
      
      this.init();
    }
    
    init() {
      this.injectStyles();
      this.injectHTML();
      this.setupEventListeners();
      this.applyPosition();
    }
    
    /**
     * Get customer email from Shopify or generate guest email
     */
    getCustomerEmail() {
      // Try to get from Shopify global
      if (window.Shopify && window.Shopify.customerEmail) {
        return window.Shopify.customerEmail;
      }
      
      // Try ShopifyAnalytics
      if (window.ShopifyAnalytics?.meta?.page?.customerId) {
        const id = window.ShopifyAnalytics.meta.page.customerId;
        return `customer_${id}@shopify.com`;
      }
      
      // Generate or retrieve guest email
      let email = localStorage.getItem('chat_guest_email');
      if (!email) {
        email = `guest_${Date.now()}_${Math.random().toString(36).substr(2, 9)}@guest.com`;
        localStorage.setItem('chat_guest_email', email);
      }
      return email;
    }
    
    getCustomerName() {
      const name = localStorage.getItem('chat_customer_name');
      return name || 'Guest';
    }
    
    /**
     * Inject widget styles
     */
    injectStyles() {
      if (document.getElementById('shopify-chat-widget-styles')) return;
      
      const style = document.createElement('style');
      style.id = 'shopify-chat-widget-styles';
      style.textContent = `
        /* Chat Widget Styles */
        .shopify-chat-button {
          position: fixed;
          width: 60px;
          height: 60px;
          border-radius: 50%;
          background: linear-gradient(135deg, ${this.config.color} 0%, ${this.adjustColor(this.config.color, -20)} 100%);
          color: white;
          border: none;
          cursor: pointer;
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 999999;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          font-size: 28px;
        }
        
        .shopify-chat-button:hover {
          transform: scale(1.1);
          box-shadow: 0 6px 25px rgba(0, 0, 0, 0.2);
        }
        
        .shopify-chat-button.has-notification::after {
          content: '';
          position: absolute;
          top: 0;
          right: 0;
          width: 16px;
          height: 16px;
          background: #ff4444;
          border-radius: 50%;
          border: 2px solid white;
          animation: pulse-notification 2s infinite;
        }
        
        @keyframes pulse-notification {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.1); }
        }
        
        .shopify-chat-window {
          position: fixed;
          width: 380px;
          height: 550px;
          background: white;
          border-radius: 16px;
          box-shadow: 0 8px 40px rgba(0, 0, 0, 0.25);
          display: none;
          flex-direction: column;
          z-index: 999998;
          overflow: hidden;
          animation: slideUp 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }
        
        .shopify-chat-window.open {
          display: flex;
        }
        
        @keyframes slideUp {
          from {
            opacity: 0;
            transform: translateY(20px) scale(0.95);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }
        
        .shopify-chat-header {
          background: linear-gradient(135deg, ${this.config.color} 0%, ${this.adjustColor(this.config.color, -20)} 100%);
          color: white;
          padding: 20px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          flex-shrink: 0;
        }
        
        .shopify-chat-header-title {
          font-weight: 600;
          font-size: 16px;
        }
        
        .shopify-chat-header-subtitle {
          font-size: 13px;
          opacity: 0.9;
          margin-top: 2px;
        }
        
        .shopify-chat-close {
          background: rgba(255, 255, 255, 0.2);
          border: none;
          color: white;
          width: 32px;
          height: 32px;
          border-radius: 50%;
          font-size: 24px;
          line-height: 1;
          cursor: pointer;
          transition: background 0.2s;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        
        .shopify-chat-close:hover {
          background: rgba(255, 255, 255, 0.3);
        }
        
        .shopify-chat-messages {
          flex: 1;
          padding: 20px;
          overflow-y: auto;
          background: #f8f9fa;
        }
        
        .shopify-chat-message {
          margin-bottom: 16px;
          animation: messageSlideIn 0.3s ease;
        }
        
        @keyframes messageSlideIn {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        
        .shopify-chat-message-sender {
          font-size: 11px;
          font-weight: 600;
          margin-bottom: 6px;
          opacity: 0.7;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        
        .shopify-chat-message-content {
          padding: 12px 16px;
          border-radius: 12px;
          max-width: 75%;
          word-wrap: break-word;
          line-height: 1.5;
        }
        
        .shopify-chat-message.customer .shopify-chat-message-content {
          background: linear-gradient(135deg, ${this.config.color} 0%, ${this.adjustColor(this.config.color, -20)} 100%);
          color: white;
          margin-left: auto;
          border-bottom-right-radius: 4px;
        }
        
        .shopify-chat-message.agent .shopify-chat-message-content {
          background: white;
          color: #333;
          border-bottom-left-radius: 4px;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
        }
        
        .shopify-chat-typing {
          padding: 12px 16px;
          background: white;
          border-radius: 12px;
          width: fit-content;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
        }
        
        .shopify-chat-typing-dots {
          display: flex;
          gap: 4px;
        }
        
        .shopify-chat-typing-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: #999;
          animation: typingBounce 1.4s infinite;
        }
        
        .shopify-chat-typing-dot:nth-child(2) {
          animation-delay: 0.2s;
        }
        
        .shopify-chat-typing-dot:nth-child(3) {
          animation-delay: 0.4s;
        }
        
        @keyframes typingBounce {
          0%, 60%, 100% { transform: translateY(0); }
          30% { transform: translateY(-8px); }
        }
        
        .shopify-chat-input-area {
          padding: 16px;
          border-top: 1px solid #e0e0e0;
          background: white;
          display: flex;
          gap: 10px;
          flex-shrink: 0;
        }
        
        .shopify-chat-input {
          flex: 1;
          padding: 12px 16px;
          border: 2px solid #e0e0e0;
          border-radius: 24px;
          outline: none;
          font-size: 14px;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
          transition: border-color 0.2s;
        }
        
        .shopify-chat-input:focus {
          border-color: ${this.config.color};
        }
        
        .shopify-chat-send {
          padding: 12px 24px;
          background: linear-gradient(135deg, ${this.config.color} 0%, ${this.adjustColor(this.config.color, -20)} 100%);
          color: white;
          border: none;
          border-radius: 24px;
          cursor: pointer;
          font-weight: 600;
          transition: transform 0.2s;
          font-size: 14px;
          white-space: nowrap;
        }
        
        .shopify-chat-send:hover {
          transform: translateY(-2px);
        }
        
        .shopify-chat-send:active {
          transform: translateY(0);
        }
        
        /* Mobile responsive */
        @media (max-width: 480px) {
          .shopify-chat-window {
            width: 100% !important;
            height: 100% !important;
            border-radius: 0 !important;
            top: 0 !important;
            left: 0 !important;
            right: 0 !important;
            bottom: 0 !important;
          }
          
          .shopify-chat-button {
            width: 56px;
            height: 56px;
            font-size: 24px;
          }
        }
      `;
      document.head.appendChild(style);
    }
    
    /**
     * Inject widget HTML
     */
    injectHTML() {
      const html = `
        <button class="shopify-chat-button" id="shopify-chat-button" aria-label="Open chat">
          💬
        </button>
        
        <div class="shopify-chat-window" id="shopify-chat-window" role="dialog" aria-label="Chat window">
          <div class="shopify-chat-header">
            <div>
              <div class="shopify-chat-header-title">Chat Support</div>
              <div class="shopify-chat-header-subtitle">We typically reply in minutes</div>
            </div>
            <button class="shopify-chat-close" id="shopify-chat-close" aria-label="Close chat">&times;</button>
          </div>
          
          <div class="shopify-chat-messages" id="shopify-chat-messages" role="log" aria-live="polite"></div>
          
          <div class="shopify-chat-input-area">
            <input 
              type="text" 
              class="shopify-chat-input" 
              id="shopify-chat-input" 
              placeholder="Type your message..." 
              aria-label="Message input"
            />
            <button class="shopify-chat-send" id="shopify-chat-send">Send</button>
          </div>
        </div>
      `;
      
      root.insertAdjacentHTML('beforeend', html);
    }
    
    /**
     * Setup event listeners
     */
    setupEventListeners() {
      document.getElementById('shopify-chat-button').addEventListener('click', () => this.open());
      document.getElementById('shopify-chat-close').addEventListener('click', () => this.close());
      document.getElementById('shopify-chat-send').addEventListener('click', () => this.sendMessage());
      
      const input = document.getElementById('shopify-chat-input');
      input.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          this.sendMessage();
        }
      });
      
      // Typing indicator
      let typingTimeout;
      input.addEventListener('input', () => {
        if (this.conversationId) {
          this.sendTyping(true);
          clearTimeout(typingTimeout);
          typingTimeout = setTimeout(() => this.sendTyping(false), 1000);
        }
      });
    }
    
    /**
     * Apply position based on config
     */
    applyPosition() {
      const button = document.getElementById('shopify-chat-button');
      const window = document.getElementById('shopify-chat-window');
      
      const isLeft = this.config.position === 'bottom-left';
      
      // Button position
      button.style.bottom = `${this.config.bottomSpacing}px`;
      if (isLeft) {
        button.style.left = `${this.config.sideSpacing}px`;
        button.style.right = 'auto';
      } else {
        button.style.right = `${this.config.sideSpacing}px`;
        button.style.left = 'auto';
      }
      
      // Window position
      window.style.bottom = `${this.config.bottomSpacing + 70}px`;
      if (isLeft) {
        window.style.left = `${this.config.sideSpacing}px`;
        window.style.right = 'auto';
      } else {
        window.style.right = `${this.config.sideSpacing}px`;
        window.style.left = 'auto';
      }
    }
    
    /**
     * Open chat window
     */
    async open() {
      this.isOpen = true;
      this.unreadCount = 0;
      
      const window = document.getElementById('shopify-chat-window');
      const button = document.getElementById('shopify-chat-button');
      
      window.classList.add('open');
      button.classList.remove('has-notification');
      
      document.getElementById('shopify-chat-input').focus();
      
      if (!this.conversationId) {
        await this.startConversation();
      }
    }
    
    /**
     * Close chat window
     */
    close() {
      this.isOpen = false;
      document.getElementById('shopify-chat-window').classList.remove('open');
    }
    
    /**
     * Start new conversation
     */
    async startConversation() {
      try {
        const response = await fetch(`${this.config.apiUrl}/api/conversations`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            storeId: this.config.storeId,
            customer_email: this.customerEmail,
            customer_name: this.customerName,
            initial_message: 'Started chat from Shopify store'
          })
        });
        
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        
        const data = await response.json();
        this.conversationId = data.id;
        
        console.log('[Chat Widget] Conversation started:', this.conversationId);
        
        this.connectWebSocket();
        this.addMessage('agent', 'Support Team', this.config.welcomeMessage);
      } catch (error) {
        console.error('[Chat Widget] Failed to start conversation:', error);
        this.addMessage('system', 'System', 'Unable to connect to chat. Please refresh and try again.');
      }
    }
    
    /**
     * Connect WebSocket
     */
    connectWebSocket() {
      try {
        this.ws = new WebSocket(this.config.wsUrl);
        
        this.ws.onopen = () => {
          console.log('[Chat Widget] WebSocket connected');
          
          // Authenticate
          this.ws.send(JSON.stringify({
            type: 'auth',
            clientType: 'customer',
            storeId: this.config.storeId
          }));
          
          // Join conversation
          this.ws.send(JSON.stringify({
            type: 'join',
            conversationId: this.conversationId
          }));
        };
        
        this.ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            this.handleWebSocketMessage(data);
          } catch (error) {
            console.error('[Chat Widget] Failed to parse message:', error);
          }
        };
        
        this.ws.onerror = (error) => {
          console.error('[Chat Widget] WebSocket error:', error);
        };
        
        this.ws.onclose = () => {
          console.log('[Chat Widget] WebSocket closed, reconnecting in 3s...');
          setTimeout(() => {
            if (this.conversationId) {
              this.connectWebSocket();
            }
          }, 3000);
        };
      } catch (error) {
        console.error('[Chat Widget] WebSocket connection failed:', error);
      }
    }
    
    /**
     * Handle WebSocket messages
     */
    handleWebSocketMessage(data) {
      switch (data.type) {
        case 'message':
          if (data.data && data.data.senderType === 'agent') {
            this.addMessage('agent', data.data.senderName, data.data.content);
            if (!this.isOpen) {
              this.showNotification();
            }
          }
          break;
          
        case 'typing':
          this.showTypingIndicator(data.isTyping, data.sender);
          break;
          
        case 'connected':
        case 'authenticated':
        case 'joined':
          console.log('[Chat Widget]', data.type);
          break;
      }
    }
    
    /**
     * Send message
     */
    async sendMessage() {
      const input = document.getElementById('shopify-chat-input');
      const message = input.value.trim();
      
      if (!message || !this.conversationId) return;
      
      // Add to UI immediately
      this.addMessage('customer', 'You', message);
      input.value = '';
      
      try {
        // Send to API
        await fetch(`${this.config.apiUrl}/api/messages`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            conversationId: this.conversationId,
            storeId: this.config.storeId,
            senderType: 'customer',
            senderName: this.customerName,
            content: message
          })
        });
      } catch (error) {
        console.error('[Chat Widget] Failed to send message:', error);
      }
    }
    
    /**
     * Add message to UI
     */
    addMessage(type, sender, content) {
      const container = document.getElementById('shopify-chat-messages');
      
      const messageDiv = document.createElement('div');
      messageDiv.className = `shopify-chat-message ${type}`;
      messageDiv.innerHTML = `
        <div class="shopify-chat-message-sender">${this.escapeHtml(sender)}</div>
        <div class="shopify-chat-message-content">${this.escapeHtml(content)}</div>
      `;
      
      container.appendChild(messageDiv);
      container.scrollTop = container.scrollHeight;
    }
    
    /**
     * Send typing indicator
     */
    sendTyping(isTyping) {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({
          type: 'typing',
          conversationId: this.conversationId,
          isTyping,
          sender: this.customerName
        }));
      }
    }
    
    /**
     * Show typing indicator
     */
    showTypingIndicator(isTyping, sender) {
      const container = document.getElementById('shopify-chat-messages');
      let indicator = container.querySelector('.shopify-chat-typing');
      
      if (isTyping && !indicator) {
        indicator = document.createElement('div');
        indicator.className = 'shopify-chat-typing';
        indicator.innerHTML = `
          <div class="shopify-chat-typing-dots">
            <div class="shopify-chat-typing-dot"></div>
            <div class="shopify-chat-typing-dot"></div>
            <div class="shopify-chat-typing-dot"></div>
          </div>
        `;
        container.appendChild(indicator);
        container.scrollTop = container.scrollHeight;
      } else if (!isTyping && indicator) {
        indicator.remove();
      }
    }
    
    /**
     * Show notification
     */
    showNotification() {
      this.unreadCount++;
      const button = document.getElementById('shopify-chat-button');
      button.classList.add('has-notification');
    }
    
    /**
     * Adjust color brightness
     */
    adjustColor(color, percent) {
      const num = parseInt(color.replace('#', ''), 16);
      const amt = Math.round(2.55 * percent);
      const R = Math.min(255, Math.max(0, (num >> 16) + amt));
      const G = Math.min(255, Math.max(0, (num >> 8 & 0x00FF) + amt));
      const B = Math.min(255, Math.max(0, (num & 0x0000FF) + amt));
      return '#' + (0x1000000 + R * 0x10000 + G * 0x100 + B).toString(16).slice(1);
    }
    
    /**
     * Escape HTML to prevent XSS
     */
    escapeHtml(text) {
      const div = document.createElement('div');
      div.textContent = text;
      return div.innerHTML;
    }
  }
  
  // Initialize widget
  try {
    new ShopifyChatWidget(config);
    console.log('[Chat Widget] Successfully initialized for:', config.storeId);
  } catch (error) {
    console.error('[Chat Widget] Initialization failed:', error);
  }
})();