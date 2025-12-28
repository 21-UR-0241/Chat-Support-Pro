(function() {
  // Get config from Liquid data attributes
  const container = document.getElementById('chat-widget-container');
  const config = {
    storeId: `store_${container.dataset.storeId}`,
    apiUrl: container.dataset.apiUrl,
    wsUrl: container.dataset.wsUrl,
    primaryColor: container.dataset.primaryColor || '#667eea',
  };
  
  // Initialize chat widget
  class ChatWidget {
    constructor(config) {
      this.config = config;
      this.ws = null;
      this.conversationId = null;
      this.customerEmail = this.getCustomerEmail();
      
      this.injectHTML();
      this.setupEventListeners();
    }
    
    getCustomerEmail() {
      // Get from Shopify if logged in
      if (window.Shopify && window.Shopify.customerEmail) {
        return window.Shopify.customerEmail;
      }
      
      // Try ShopifyAnalytics
      if (window.ShopifyAnalytics?.meta?.page?.customerId) {
        return `customer_${window.ShopifyAnalytics.meta.page.customerId}@shopify.com`;
      }
      
      // Guest user
      let email = localStorage.getItem('chat_guest_email');
      if (!email) {
        email = `guest_${Date.now()}@guest.com`;
        localStorage.setItem('chat_guest_email', email);
      }
      return email;
    }
    
    injectHTML() {
      const html = `
        <style>
          #chat-button {
            position: fixed;
            bottom: 20px;
            right: 20px;
            width: 60px;
            height: 60px;
            border-radius: 50%;
            background: ${this.config.primaryColor};
            color: white;
            border: none;
            cursor: pointer;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            z-index: 99999;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: transform 0.3s;
          }
          
          #chat-button:hover {
            transform: scale(1.1);
          }
          
          #chat-window {
            position: fixed;
            bottom: 90px;
            right: 20px;
            width: 350px;
            height: 500px;
            background: white;
            border-radius: 12px;
            box-shadow: 0 8px 40px rgba(0,0,0,0.2);
            display: none;
            flex-direction: column;
            z-index: 99998;
          }
          
          #chat-window.open {
            display: flex;
          }
          
          #chat-header {
            background: ${this.config.primaryColor};
            color: white;
            padding: 16px;
            border-radius: 12px 12px 0 0;
            display: flex;
            justify-content: space-between;
            align-items: center;
          }
          
          #chat-messages {
            flex: 1;
            padding: 16px;
            overflow-y: auto;
            background: #f7f7f7;
          }
          
          .message {
            margin-bottom: 12px;
            padding: 10px 14px;
            border-radius: 12px;
            max-width: 80%;
            word-wrap: break-word;
          }
          
          .message.customer {
            background: ${this.config.primaryColor};
            color: white;
            margin-left: auto;
          }
          
          .message.agent {
            background: white;
            color: #333;
          }
          
          #chat-input-area {
            padding: 16px;
            border-top: 1px solid #e0e0e0;
            display: flex;
            gap: 8px;
          }
          
          #chat-input {
            flex: 1;
            padding: 10px;
            border: 1px solid #ddd;
            border-radius: 8px;
          }
          
          #chat-send {
            padding: 10px 20px;
            background: ${this.config.primaryColor};
            color: white;
            border: none;
            border-radius: 8px;
            cursor: pointer;
          }
        </style>
        
        <button id="chat-button">💬</button>
        
        <div id="chat-window">
          <div id="chat-header">
            <strong>Chat Support</strong>
            <button id="chat-close" style="background:none;border:none;color:white;font-size:24px;cursor:pointer;">&times;</button>
          </div>
          <div id="chat-messages"></div>
          <div id="chat-input-area">
            <input type="text" id="chat-input" placeholder="Type a message..." />
            <button id="chat-send">Send</button>
          </div>
        </div>
      `;
      
      document.body.insertAdjacentHTML('beforeend', html);
    }
    
    setupEventListeners() {
      document.getElementById('chat-button').onclick = () => this.open();
      document.getElementById('chat-close').onclick = () => this.close();
      document.getElementById('chat-send').onclick = () => this.send();
      document.getElementById('chat-input').onkeypress = (e) => {
        if (e.key === 'Enter') this.send();
      };
    }
    
    async open() {
      document.getElementById('chat-window').classList.add('open');
      
      if (!this.conversationId) {
        await this.startConversation();
      }
    }
    
    close() {
      document.getElementById('chat-window').classList.remove('open');
    }
    
    async startConversation() {
      try {
        const res = await fetch(`${this.config.apiUrl}/api/conversations`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            storeId: this.config.storeId,
            customer_email: this.customerEmail,
            customer_name: 'Guest',
            initial_message: 'Started chat'
          })
        });
        
        const data = await res.json();
        this.conversationId = data.id;
        
        this.connectWebSocket();
        this.addMessage('agent', 'Support', 'Hi! How can we help?');
      } catch (err) {
        console.error('Failed to start conversation:', err);
      }
    }
    
    connectWebSocket() {
      this.ws = new WebSocket(this.config.wsUrl);
      
      this.ws.onopen = () => {
        this.ws.send(JSON.stringify({
          type: 'auth',
          clientType: 'customer',
          storeId: this.config.storeId
        }));
        
        this.ws.send(JSON.stringify({
          type: 'join',
          conversationId: this.conversationId
        }));
      };
      
      this.ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        if (data.type === 'message' && data.data.senderType === 'agent') {
          this.addMessage('agent', data.data.senderName, data.data.content);
        }
      };
    }
    
    async send() {
      const input = document.getElementById('chat-input');
      const message = input.value.trim();
      if (!message) return;
      
      this.addMessage('customer', 'You', message);
      input.value = '';
      
      await fetch(`${this.config.apiUrl}/api/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationId: this.conversationId,
          storeId: this.config.storeId,
          senderType: 'customer',
          content: message
        })
      });
    }
    
    addMessage(type, sender, content) {
      const msg = document.createElement('div');
      msg.className = `message ${type}`;
      msg.innerHTML = `<div style="font-size:12px;opacity:0.8;">${sender}</div><div>${content}</div>`;
      document.getElementById('chat-messages').appendChild(msg);
      document.getElementById('chat-messages').scrollTop = 999999;
    }
  }
  
  // Initialize
  new ChatWidget(config);
})();