/**
 * Shopify Chat Widget Initializer - Production Ready
 * Version: 2.0.0
 * 
 * Features:
 * - Async loading (doesn't block page load)
 * - Checkout page exclusion
 * - GDPR compliance
 * - Error recovery
 * - Performance optimized
 * - Mobile responsive
 * - XSS protection
 */

(function() {
  'use strict';
  
  // ============================================
  // CONFIGURATION & VALIDATION
  // ============================================
  
  // Don't load on checkout, thank you, or order status pages
  const isCheckoutPage = window.location.pathname.includes('/checkouts') ||
                        window.location.pathname.includes('/thank_you') ||
                        window.location.pathname.includes('/orders/') ||
                        window.location.pathname.match(/\/\d+\/thank_you/);
  
  if (isCheckoutPage) {
    console.log('[Chat Widget] Disabled on checkout/order pages');
    return;
  }
  
  // Get configuration from data attributes
  const root = document.getElementById('shopify-chat-widget-root');
  if (!root) {
    console.error('[Chat Widget] Root element not found');
    return;
  }
  
  // Extract and validate configuration
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
    enableGdpr: root.dataset.enableGdpr === 'true',
  };
  
  // Validate required config
  if (!config.apiUrl || !config.wsUrl || !config.shopDomain) {
    console.error('[Chat Widget] Missing required configuration');
    return;
  }
  
  // Generate store identifier
  config.storeIdentifier = config.shopDomain
    .replace('.myshopify.com', '')
    .replace(/\./g, '-');
  
  console.log('[Chat Widget] Initializing for store:', config.storeIdentifier);
  
  // Check device visibility
  const isMobile = window.innerWidth <= 768;
  if ((isMobile && !config.showOnMobile) || (!isMobile && !config.showOnDesktop)) {
    console.log('[Chat Widget] Hidden on this device type');
    return;
  }
  
  // ============================================
  // PRIVACY & GDPR COMPLIANCE
  // ============================================
  
  class PrivacyManager {
    static hasConsent() {
      if (!config.enableGdpr) return true;
      
      return localStorage.getItem('chat_consent') === 'accepted' ||
             document.cookie.includes('chat_consent=accepted');
    }
    
    static setConsent(accepted) {
      localStorage.setItem('chat_consent', accepted ? 'accepted' : 'declined');
      document.cookie = `chat_consent=${accepted ? 'accepted' : 'declined'}; max-age=31536000; path=/`;
    }
    
    static clearData() {
      localStorage.removeItem('chat_guest_email');
      localStorage.removeItem('chat_customer_name');
      localStorage.removeItem('chat_conversation_id');
      localStorage.removeItem('chat_consent');
    }
  }
  
  // ============================================
  // MAIN CHAT WIDGET CLASS
  // ============================================
  
  class ShopifyChatWidget {
    constructor(config) {
      this.config = config;
      this.ws = null;
      this.conversationId = null;
      this.customerEmail = null;
      this.customerName = null;
      this.isOpen = false;
      this.unreadCount = 0;
      this.reconnectAttempts = 0;
      this.maxReconnectAttempts = 5;
      this.messageQueue = [];
      this.isInitialized = false;
      this.storeActive = false;
      
      this.init();
    }
    
    async init() {
      // Check GDPR consent first
      if (config.enableGdpr && !PrivacyManager.hasConsent()) {
        this.showConsentBanner();
        return;
      }
      
      // Verify store is active
      await this.verifyStore();
      
      if (!this.storeActive) {
        console.log('[Chat Widget] Store is not active');
        return;
      }
      
      this.customerEmail = this.getCustomerEmail();
      this.customerName = this.getCustomerName();
      
      this.injectStyles();
      this.injectHTML();
      this.setupEventListeners();
      this.applyPosition();
      
      this.isInitialized = true;
      
      // Check for persisted conversation
      const savedConversationId = localStorage.getItem('chat_conversation_id');
      if (savedConversationId) {
        this.conversationId = parseInt(savedConversationId);
      }
    }
    
    /**
     * Verify store is active and get settings
     */
    async verifyStore() {
      try {
        const response = await fetch(
          `${this.config.apiUrl}/api/widget/settings?store=${this.config.storeIdentifier}`,
          { 
            method: 'GET',
            headers: { 'Content-Type': 'application/json' }
          }
        );
        
        if (!response.ok) {
          console.error('[Chat Widget] Store verification failed:', response.status);
          return;
        }
        
        const data = await response.json();
        
        // Update config with server settings
        if (data.primaryColor) this.config.color = data.primaryColor;
        if (data.widgetSettings?.greeting) this.config.welcomeMessage = data.widgetSettings.greeting;
        if (data.widgetSettings?.position) this.config.position = data.widgetSettings.position;
        
        this.storeActive = true;
        console.log('[Chat Widget] Store verified:', data.brandName);
      } catch (error) {
        console.error('[Chat Widget] Store verification error:', error);
        this.storeActive = false;
      }
    }
    
    /**
     * Show GDPR consent banner
     */
    showConsentBanner() {
      const banner = document.createElement('div');
      banner.id = 'chat-consent-banner';
      banner.style.cssText = `
        position: fixed;
        bottom: 20px;
        ${this.config.position === 'bottom-left' ? 'left' : 'right'}: 20px;
        max-width: 320px;
        background: white;
        padding: 20px;
        border-radius: 12px;
        box-shadow: 0 8px 30px rgba(0,0,0,0.2);
        z-index: 999999;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        font-size: 14px;
        line-height: 1.5;
      `;
      
      banner.innerHTML = `
        <div style="margin-bottom: 12px; font-weight: 600;">Chat Privacy</div>
        <div style="margin-bottom: 16px; color: #666;">
          We use cookies and local storage to provide chat support. Your conversations are stored securely.
        </div>
        <div style="display: flex; gap: 8px;">
          <button id="chat-consent-accept" style="
            flex: 1;
            padding: 10px;
            background: ${this.config.color};
            color: white;
            border: none;
            border-radius: 6px;
            cursor: pointer;
            font-weight: 600;
          ">Accept</button>
          <button id="chat-consent-decline" style="
            flex: 1;
            padding: 10px;
            background: #f0f0f0;
            color: #333;
            border: none;
            border-radius: 6px;
            cursor: pointer;
          ">Decline</button>
        </div>
      `;
      
      document.body.appendChild(banner);
      
      document.getElementById('chat-consent-accept').addEventListener('click', () => {
        PrivacyManager.setConsent(true);
        banner.remove();
        this.init();
      });
      
      document.getElementById('chat-consent-decline').addEventListener('click', () => {
        PrivacyManager.setConsent(false);
        banner.remove();
      });
    }
    
    /**
     * Get customer email
     */
    getCustomerEmail() {
      // Try Shopify global
      if (window.Shopify?.customerEmail) {
        return window.Shopify.customerEmail;
      }
      
      // Try ShopifyAnalytics
      if (window.ShopifyAnalytics?.meta?.page?.customerId) {
        const id = window.ShopifyAnalytics.meta.page.customerId;
        return `customer_${id}@shopify.com`;
      }
      
      // Use or generate guest email
      let email = localStorage.getItem('chat_guest_email');
      if (!email) {
        email = `guest_${Date.now()}_${Math.random().toString(36).substr(2, 9)}@guest.local`;
        localStorage.setItem('chat_guest_email', email);
      }
      return email;
    }
    
    /**
     * Get customer name
     */
    getCustomerName() {
      const saved = localStorage.getItem('chat_customer_name');
      if (saved) return saved;
      
      // Try to get from Shopify
      if (window.Shopify?.customerName) {
        return window.Shopify.customerName;
      }
      
      return 'Guest';
    }
    
    /**
     * Inject widget styles with scoped naming
     */
    injectStyles() {
      if (document.getElementById('shopify-chat-widget-styles')) return;
      
      const style = document.createElement('style');
      style.id = 'shopify-chat-widget-styles';
      style.textContent = `
        /* Reset and base styles */
        .shopify-chat-button,
        .shopify-chat-window,
        .shopify-chat-window * {
          box-sizing: border-box;
          margin: 0;
          padding: 0;
        }
        
        /* Chat Button */
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
          line-height: 1;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        }
        
        .shopify-chat-button:hover {
          transform: scale(1.1);
          box-shadow: 0 6px 25px rgba(0, 0, 0, 0.2);
        }
        
        .shopify-chat-button:active {
          transform: scale(1.05);
        }
        
        .shopify-chat-button.has-notification::after {
          content: attr(data-unread);
          position: absolute;
          top: -4px;
          right: -4px;
          min-width: 20px;
          height: 20px;
          padding: 0 6px;
          background: #ff4444;
          border-radius: 10px;
          border: 2px solid white;
          color: white;
          font-size: 11px;
          font-weight: 700;
          display: flex;
          align-items: center;
          justify-content: center;
          animation: pulse-notification 2s infinite;
        }
        
        @keyframes pulse-notification {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.15); }
        }
        
        /* Chat Window */
        .shopify-chat-window {
          position: fixed;
          width: 380px;
          height: 600px;
          max-height: calc(100vh - 100px);
          background: white;
          border-radius: 16px;
          box-shadow: 0 8px 40px rgba(0, 0, 0, 0.25);
          display: none;
          flex-direction: column;
          z-index: 999998;
          overflow: hidden;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
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
        
        /* Header */
        .shopify-chat-header {
          background: linear-gradient(135deg, ${this.config.color} 0%, ${this.adjustColor(this.config.color, -20)} 100%);
          color: white;
          padding: 20px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          flex-shrink: 0;
        }
        
        .shopify-chat-header-info {
          flex: 1;
        }
        
        .shopify-chat-header-title {
          font-weight: 600;
          font-size: 16px;
          margin-bottom: 2px;
        }
        
        .shopify-chat-header-subtitle {
          font-size: 13px;
          opacity: 0.9;
        }
        
        .shopify-chat-header-status {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          font-size: 12px;
          margin-top: 4px;
        }
        
        .shopify-chat-status-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: #4ade80;
          animation: pulse 2s infinite;
        }
        
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
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
          flex-shrink: 0;
        }
        
        .shopify-chat-close:hover {
          background: rgba(255, 255, 255, 0.3);
        }
        
        /* Messages Area */
        .shopify-chat-messages {
          flex: 1;
          padding: 20px;
          overflow-y: auto;
          background: #f8f9fa;
          scroll-behavior: smooth;
        }
        
        .shopify-chat-messages::-webkit-scrollbar {
          width: 6px;
        }
        
        .shopify-chat-messages::-webkit-scrollbar-track {
          background: transparent;
        }
        
        .shopify-chat-messages::-webkit-scrollbar-thumb {
          background: #ccc;
          border-radius: 3px;
        }
        
        .shopify-chat-message {
          margin-bottom: 16px;
          animation: messageSlideIn 0.3s ease;
          display: flex;
          flex-direction: column;
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
        
        .shopify-chat-message.customer {
          align-items: flex-end;
        }
        
        .shopify-chat-message.agent {
          align-items: flex-start;
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
          font-size: 14px;
        }
        
        .shopify-chat-message.customer .shopify-chat-message-content {
          background: linear-gradient(135deg, ${this.config.color} 0%, ${this.adjustColor(this.config.color, -20)} 100%);
          color: white;
          border-bottom-right-radius: 4px;
        }
        
        .shopify-chat-message.agent .shopify-chat-message-content {
          background: white;
          color: #333;
          border-bottom-left-radius: 4px;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
        }
        
        .shopify-chat-message-time {
          font-size: 10px;
          opacity: 0.6;
          margin-top: 4px;
        }
        
        /* Typing Indicator */
        .shopify-chat-typing {
          padding: 12px 16px;
          background: white;
          border-radius: 12px;
          width: fit-content;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
          margin-bottom: 16px;
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
        
        /* Input Area */
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
          font-family: inherit;
          transition: border-color 0.2s;
          background: white;
        }
        
        .shopify-chat-input:focus {
          border-color: ${this.config.color};
        }
        
        .shopify-chat-input::placeholder {
          color: #999;
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
          font-family: inherit;
        }
        
        .shopify-chat-send:hover:not(:disabled) {
          transform: translateY(-2px);
        }
        
        .shopify-chat-send:active:not(:disabled) {
          transform: translateY(0);
        }
        
        .shopify-chat-send:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
        
        /* Error Message */
        .shopify-chat-error {
          padding: 12px;
          background: #fee;
          border: 1px solid #fcc;
          border-radius: 8px;
          color: #c33;
          font-size: 13px;
          margin-bottom: 12px;
          text-align: center;
        }
        
        /* Mobile Responsive */
        @media (max-width: 480px) {
          .shopify-chat-window {
            width: 100% !important;
            height: 100% !important;
            max-height: 100vh !important;
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
          
          .shopify-chat-message-content {
            max-width: 85%;
          }
        }
        
        /* Print Styles */
        @media print {
          .shopify-chat-button,
          .shopify-chat-window {
            display: none !important;
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
        <button class="shopify-chat-button" id="shopify-chat-button" aria-label="Open chat" data-unread="0">
          💬
        </button>
        
        <div class="shopify-chat-window" id="shopify-chat-window" role="dialog" aria-label="Chat window" aria-modal="true">
          <div class="shopify-chat-header">
            <div class="shopify-chat-header-info">
              <div class="shopify-chat-header-title">Chat Support</div>
              <div class="shopify-chat-header-subtitle">
                <div class="shopify-chat-header-status">
                  <span class="shopify-chat-status-dot"></span>
                  <span>Online</span>
                </div>
              </div>
            </div>
            <button class="shopify-chat-close" id="shopify-chat-close" aria-label="Close chat">&times;</button>
          </div>
          
          <div class="shopify-chat-messages" id="shopify-chat-messages" role="log" aria-live="polite" aria-atomic="false"></div>
          
          <div class="shopify-chat-input-area">
            <input 
              type="text" 
              class="shopify-chat-input" 
              id="shopify-chat-input" 
              placeholder="Type your message..." 
              aria-label="Message input"
              autocomplete="off"
            />
            <button class="shopify-chat-send" id="shopify-chat-send" aria-label="Send message">Send</button>
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
        if (this.conversationId && this.ws && this.ws.readyState === WebSocket.OPEN) {
          this.sendTyping(true);
          clearTimeout(typingTimeout);
          typingTimeout = setTimeout(() => this.sendTyping(false), 1000);
        }
      });
      
      // Cleanup on page unload
      window.addEventListener('beforeunload', () => this.cleanup());
      
      // Handle visibility change
      document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
          // Page hidden - pause WebSocket pings
        } else {
          // Page visible - resume
          if (this.conversationId && (!this.ws || this.ws.readyState !== WebSocket.OPEN)) {
            this.connectWebSocket();
          }
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
      
      // Window position (mobile uses full screen)
      if (window.innerWidth > 480) {
        window.style.bottom = `${this.config.bottomSpacing + 70}px`;
        if (isLeft) {
          window.style.left = `${this.config.sideSpacing}px`;
          window.style.right = 'auto';
        } else {
          window.style.right = `${this.config.sideSpacing}px`;
          window.style.left = 'auto';
        }
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
      button.setAttribute('data-unread', '0');
      
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
            storeIdentifier: this.config.storeIdentifier,
            customerEmail: this.customerEmail,
            customerName: this.customerName,
            initialMessage: 'Customer opened chat'
          })
        });
        
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        
        const data = await response.json();
        this.conversationId = data.id;
        
        // Persist conversation ID
        localStorage.setItem('chat_conversation_id', this.conversationId);
        
        console.log('[Chat Widget] Conversation started:', this.conversationId);
        
        this.connectWebSocket();
        this.addMessage('agent', 'Support Team', this.config.welcomeMessage);
      } catch (error) {
        console.error('[Chat Widget] Failed to start conversation:', error);
        this.showError('Unable to connect to chat. Please try again.');
      }
    }
    
    /**
     * Connect WebSocket with retry logic
     */
    connectWebSocket() {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        return;
      }
      
      try {
        this.ws = new WebSocket(this.config.wsUrl);
        
        this.ws.onopen = () => {
          console.log('[Chat Widget] WebSocket connected');
          this.reconnectAttempts = 0;
          
          // Join conversation
          this.ws.send(JSON.stringify({
            type: 'join',
            role: 'customer',
            conversationId: this.conversationId,
            storeId: this.config.storeIdentifier
          }));
          
          // Send queued messages
          this.flushMessageQueue();
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
        
        this.ws.onclose = (event) => {
          console.log('[Chat Widget] WebSocket closed:', event.code);
          
          // Attempt reconnection
          if (this.conversationId && this.reconnectAttempts < this.maxReconnectAttempts) {
            this.reconnectAttempts++;
            const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
            console.log(`[Chat Widget] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);
            setTimeout(() => this.connectWebSocket(), delay);
          }
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
        case 'new_message':
          if (data.message && data.message.sender_type === 'agent') {
            this.addMessage('agent', data.message.sender_name || 'Agent', data.message.content);
            if (!this.isOpen) {
              this.showNotification();
            }
          }
          break;
          
        case 'agent_typing':
          this.showTypingIndicator(data.isTyping, data.sender);
          break;
          
        case 'joined':
          console.log('[Chat Widget] Joined conversation');
          break;
          
        case 'error':
          console.error('[Chat Widget] Server error:', data.message);
          this.showError(data.message || 'An error occurred');
          break;
      }
    }
    
    /**
     * Send message
     */
    async sendMessage() {
      const input = document.getElementById('shopify-chat-input');
      const sendButton = document.getElementById('shopify-chat-send');
      const message = input.value.trim();
      
      if (!message) return;
      
      if (!this.conversationId) {
        this.showError('Please wait while we connect...');
        return;
      }
      
      // Disable input while sending
      input.disabled = true;
      sendButton.disabled = true;
      
      // Add to UI immediately
      this.addMessage('customer', 'You', message);
      input.value = '';
      
      try {
        const response = await fetch(`${this.config.apiUrl}/api/messages`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            conversationId: this.conversationId,
            storeId: this.config.storeIdentifier,
            senderType: 'customer',
            senderName: this.customerName,
            content: message
          })
        });
        
        if (!response.ok) {
          throw new Error('Failed to send message');
        }
      } catch (error) {
        console.error('[Chat Widget] Failed to send message:', error);
        this.showError('Message failed to send. Please try again.');
        
        // Queue message for retry
        this.messageQueue.push(message);
      } finally {
        input.disabled = false;
        sendButton.disabled = false;
        input.focus();
      }
    }
    
    /**
     * Flush message queue
     */
    flushMessageQueue() {
      while (this.messageQueue.length > 0) {
        const message = this.messageQueue.shift();
        // Retry sending
        document.getElementById('shopify-chat-input').value = message;
        this.sendMessage();
      }
    }
    
    /**
     * Add message to UI
     */
    addMessage(type, sender, content) {
      const container = document.getElementById('shopify-chat-messages');
      
      const messageDiv = document.createElement('div');
      messageDiv.className = `shopify-chat-message ${type}`;
      
      const now = new Date();
      const time = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      
      messageDiv.innerHTML = `
        <div class="shopify-chat-message-sender">${this.escapeHtml(sender)}</div>
        <div class="shopify-chat-message-content">${this.escapeHtml(content)}</div>
        <div class="shopify-chat-message-time">${time}</div>
      `;
      
      container.appendChild(messageDiv);
      container.scrollTop = container.scrollHeight;
      
      // Remove error if present
      const error = container.querySelector('.shopify-chat-error');
      if (error) error.remove();
    }
    
    /**
     * Show error message
     */
    showError(message) {
      const container = document.getElementById('shopify-chat-messages');
      
      // Remove existing errors
      const existing = container.querySelector('.shopify-chat-error');
      if (existing) existing.remove();
      
      const errorDiv = document.createElement('div');
      errorDiv.className = 'shopify-chat-error';
      errorDiv.textContent = message;
      
      container.appendChild(errorDiv);
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
      button.setAttribute('data-unread', this.unreadCount.toString());
      
      // Play sound (optional)
      // const audio = new Audio('data:audio/wav;base64,...');
      // audio.play().catch(() => {});
    }
    
    /**
     * Cleanup
     */
    cleanup() {
      if (this.ws) {
        this.ws.close();
      }
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
  
  // ============================================
  // INITIALIZATION
  // ============================================
  
  // Wait for DOM to be ready
  function initWidget() {
    try {
      new ShopifyChatWidget(config);
      console.log('[Chat Widget] Successfully initialized');
    } catch (error) {
      console.error('[Chat Widget] Initialization failed:', error);
    }
  }
  
  // Initialize after page load to not block rendering
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initWidget);
  } else {
    // DOM already loaded
    initWidget();
  }
})();