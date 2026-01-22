/**
 * Shopify Chat Widget Initializer - Production Ready
 * Version: 2.0.0
 */
(function() {
  'use strict';

  // ============================================
  // CONFIGURATION & VALIDATION
  // ============================================
  const isCheckoutPage = window.location.pathname.includes('/checkouts') ||
                        window.location.pathname.includes('/thank_you') ||
                        window.location.pathname.includes('/orders/') ||
                        window.location.pathname.match(/\/\d+\/thank_you/);

  if (isCheckoutPage) {
    console.log('[Chat Widget] Disabled on checkout/order pages');
    return;
  }

  const root = document.getElementById('shopify-chat-widget-root');
  if (!root) {
    console.error('[Chat Widget] Root element not found');
    return;
  }

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

  if (!config.apiUrl || !config.wsUrl || !config.shopDomain) {
    console.error('[Chat Widget] Missing required configuration');
    return;
  }

  config.storeIdentifier = config.shopDomain
    .replace('.myshopify.com', '')
    .replace(/\./g, '-');

  console.log('[Chat Widget] Initializing for store:', config.storeIdentifier);

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
      this.sessionToken = null;

      this.init();
    }

    async init() {
      if (config.enableGdpr && !PrivacyManager.hasConsent()) {
        this.showConsentBanner();
        return;
      }

      await this.verifyStore();
      if (!this.storeActive) {
        console.log('[Chat Widget] Store is not active');
        return;
      }

      this.customerEmail = this.getCustomerEmail();
      this.customerName = this.getCustomerName();

      // ✅ fetch session token
      await this.fetchSessionToken();

      this.injectStyles();
      this.injectHTML();
      this.setupEventListeners();
      this.applyPosition();

      this.isInitialized = true;

      const savedConversationId = localStorage.getItem('chat_conversation_id');
      if (savedConversationId) {
        this.conversationId = parseInt(savedConversationId);
      }
    }

    /**
     * Fetch widget session token
     */
    async fetchSessionToken() {
      try {
        const res = await fetch(`${this.config.apiUrl}/api/widget/session?store=${this.config.storeIdentifier}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        this.sessionToken = data.token;
      } catch (error) {
        console.error('[Chat Widget] Failed to fetch session token:', error);
        this.sessionToken = null;
      }
    }

    /**
     * Verify store is active and get settings
     */
    async verifyStore() {
      try {
        const response = await fetch(
          `${this.config.apiUrl}/api/widget/settings?store=${this.config.storeIdentifier}`,
          { method: 'GET', headers: { 'Content-Type': 'application/json' } }
        );

        if (!response.ok) {
          console.error('[Chat Widget] Store verification failed:', response.status);
          return;
        }

        const data = await response.json();
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
            flex: 1; padding: 10px; background: ${this.config.color}; color: white;
            border: none; border-radius: 6px; cursor: pointer; font-weight: 600;
          ">Accept</button>
          <button id="chat-consent-decline" style="
            flex: 1; padding: 10px; background: #f0f0f0; color: #333;
            border: none; border-radius: 6px; cursor: pointer;
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

    getCustomerEmail() {
      if (window.Shopify?.customerEmail) return window.Shopify.customerEmail;
      if (window.ShopifyAnalytics?.meta?.page?.customerId) {
        const id = window.ShopifyAnalytics.meta.page.customerId;
        return `customer_${id}@shopify.com`;
      }
      let email = localStorage.getItem('chat_guest_email');
      if (!email) {
        email = `guest_${Date.now()}_${Math.random().toString(36).substr(2, 9)}@guest.local`;
        localStorage.setItem('chat_guest_email', email);
      }
      return email;
    }

    getCustomerName() {
      const saved = localStorage.getItem('chat_customer_name');
      if (saved) return saved;
      if (window.Shopify?.customerName) return window.Shopify.customerName;
      return 'Guest';
    }

    injectStyles() {
      if (document.getElementById('shopify-chat-widget-styles')) return;
      const style = document.createElement('style');
      style.id = 'shopify-chat-widget-styles';
      style.textContent = `/* styles omitted for brevity (keep your existing CSS here) */`;
      document.head.appendChild(style);
    }

    injectHTML() {
      const html = `
        <button class="shopify-chat-button" id="shopify-chat-button" aria-label="Open chat" data-unread="0">💬</button>
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
            <input type="text" class="shopify-chat-input" id="shopify-chat-input" placeholder="Type your message..." autocomplete="off" />
            <button class="shopify-chat-send" id="shopify-chat-send">Send</button>
          </div>
        </div>
      `;
      root.insertAdjacentHTML('beforeend', html);
    }

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

      let typingTimeout;
      input.addEventListener('input', () => {
        if (this.conversationId && this.ws && this.ws.readyState === WebSocket.OPEN) {
          this.sendTyping(true);
          clearTimeout(typingTimeout);
          typingTimeout = setTimeout(() => this.sendTyping(false), 1000);
        }
      });

      window.addEventListener('beforeunload', () => this.cleanup());
    }

    applyPosition() {
      const button = document.getElementById('shopify-chat-button');
      const windowEl = document.getElementById('shopify-chat-window');

      const isLeft = this.config.position === 'bottom-left';
      button.style.bottom = `${this.config.bottomSpacing}px`;
      if (isLeft) {
        button.style.left = `${this.config.sideSpacing}px`;
      } else {
        button.style.right = `${this.config.sideSpacing}px`;
      }

      if (window.innerWidth > 480) {
        windowEl.style.bottom = `${this.config.bottomSpacing + 70}px`;
        if (isLeft) {
          windowEl.style.left = `${this.config.sideSpacing}px`;
        } else {
          windowEl.style.right = `${this.config.sideSpacing}px`;
        }
      }
    }

    async open() {
      this.isOpen = true;
      this.unreadCount = 0;

      const windowEl = document.getElementById('shopify-chat-window');
      const button = document.getElementById('shopify-chat-button');

      windowEl.classList.add('open');
      button.classList.remove('has-notification');
      button.setAttribute('data-unread', '0');

      document.getElementById('shopify-chat-input').focus();

      if (!this.conversationId) {
        await this.startConversation();
      }
    }

    close() {
      this.isOpen = false;
      document.getElementById('shopify-chat-window').classList.remove('open');
    }

    async startConversation() {
      try {
        const response = await fetch(`${this.config.apiUrl}/api/conversations`, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            ...(this.sessionToken ? { 'Authorization': `Bearer ${this.sessionToken}` } : {})
          },
          body: JSON.stringify({
            storeIdentifier: this.config.storeIdentifier,
            customerEmail: this.customerEmail,
            customerName: this.customerName,
            initialMessage: 'Customer opened chat'
          })
        });

        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        const data = await response.json();
        this.conversationId = data.id;
        localStorage.setItem('chat_conversation_id', this.conversationId);

        console.log('[Chat Widget] Conversation started:', this.conversationId);

        this.connectWebSocket();
        this.addMessage('agent', 'Support Team', this.config.welcomeMessage);
      } catch (error) {
        console.error('[Chat Widget] Failed to start conversation:', error);
        this.showError('Unable to connect to chat. Please try again.');
      }
    }

    connectWebSocket() {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) return;

      try {
        this.ws = new WebSocket(this.config.wsUrl);

        this.ws.onopen = () => {
          this.reconnectAttempts = 0;

          this.ws.send(JSON.stringify({
            type: 'join',
            role: 'customer',
            conversationId: this.conversationId,
            storeId: this.config.storeIdentifier,
            token: this.sessionToken
          }));

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

        this.ws.onclose = () => {
          if (this.conversationId && this.reconnectAttempts < this.maxReconnectAttempts) {
            this.reconnectAttempts++;
            const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
            setTimeout(() => this.connectWebSocket(), delay);
          }
        };
      } catch (error) {
        console.error('[Chat Widget] WebSocket connection failed:', error);
      }
    }

    handleWebSocketMessage(data) {
      switch (data.type) {
        case 'new_message':
          if (data.message && data.message.sender_type === 'agent') {
            this.addMessage('agent', data.message.sender_name || 'Agent', data.message.content);
            if (!this.isOpen) this.showNotification();
          }
          break;
        case 'agent_typing':
          this.showTypingIndicator(data.isTyping, data.sender);
          break;
        case 'error':
          this.showError(data.message || 'An error occurred');
          break;
      }
    }

    async sendMessage() {
      const input = document.getElementById('shopify-chat-input');
      const sendButton = document.getElementById('shopify-chat-send');
      const message = input.value.trim();
      if (!message) return;

      if (!this.conversationId) {
        this.showError('Please wait while we connect...');
        return;
      }

      input.disabled = true;
      sendButton.disabled = true;

      this.addMessage('customer', 'You', message);
      input.value = '';

      try {
        const response = await fetch(`${this.config.apiUrl}/api/messages`, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            ...(this.sessionToken ? { 'Authorization': `Bearer ${this.sessionToken}` } : {})
          },
          body: JSON.stringify({
            conversationId: this.conversationId,
            storeId: this.config.storeIdentifier,
            senderType: 'customer',
            senderName: this.customerName,
            content: message
          })
        });

        if (!response.ok) throw new Error('Failed to send message');
      } catch (error) {
        this.showError('Message failed to send. Please try again.');
        this.messageQueue.push(message);
      } finally {
        input.disabled = false;
        sendButton.disabled = false;
        input.focus();
      }
    }

    flushMessageQueue() {
      while (this.messageQueue.length > 0) {
        const message = this.messageQueue.shift();
        document.getElementById('shopify-chat-input').value = message;
        this.sendMessage();
      }
    }

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

      const error = container.querySelector('.shopify-chat-error');
      if (error) error.remove();
    }

    showError(message) {
      const container = document.getElementById('shopify-chat-messages');
      const existing = container.querySelector('.shopify-chat-error');
      if (existing) existing.remove();

      const errorDiv = document.createElement('div');
      errorDiv.className = 'shopify-chat-error';
      errorDiv.textContent = message;
      container.appendChild(errorDiv);
      container.scrollTop = container.scrollHeight;
    }

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

    showNotification() {
      this.unreadCount++;
      const button = document.getElementById('shopify-chat-button');
      button.classList.add('has-notification');
      button.setAttribute('data-unread', this.unreadCount.toString());
    }

    cleanup() {
      if (this.ws) this.ws.close();
    }

    adjustColor(color, percent) {
      const num = parseInt(color.replace('#', ''), 16);
      const amt = Math.round(2.55 * percent);
      const R = Math.min(255, Math.max(0, (num >> 16) + amt));
      const G = Math.min(255, Math.max(0, (num >> 8 & 0x00FF) + amt));
      const B = Math.min(255, Math.max(0, (num & 0x0000FF) + amt));
      return '#' + (0x1000000 + R * 0x10000 + G * 0x100 + B).toString(16).slice(1);
    }

    escapeHtml(text) {
      const div = document.createElement('div');
      div.textContent = text;
      return div.innerHTML;
    }
  }

  function initWidget() {
    try {
      new ShopifyChatWidget(config);
      console.log('[Chat Widget] Successfully initialized');
    } catch (error) {
      console.error('[Chat Widget] Initialization failed:', error);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initWidget);
  } else {
    initWidget();
  }
})();