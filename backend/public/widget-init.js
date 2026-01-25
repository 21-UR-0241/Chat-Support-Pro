

(function() {
  'use strict';

  // Check if config exists
  if (!window.ChatSupportConfig) {
    console.error('ChatSupportConfig not found. Please configure the widget.');
    return;
  }

  const config = window.ChatSupportConfig;
  const API_URL = config.apiUrl || 'http://localhost:3000';
  const STORE_ID = config.storeId;

  if (!STORE_ID) {
    console.error('Chat Widget: storeId is required');
    return;
  }

  // Create widget container
  const widgetContainer = document.createElement('div');
  widgetContainer.id = 'chat-support-widget';
  widgetContainer.innerHTML = `
    <style>
      #chat-widget-button {
        position: fixed;
        bottom: 20px;
        right: 20px;
        width: 60px;
        height: 60px;
        border-radius: 50%;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        border: none;
        cursor: pointer;
        box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 9999;
        transition: transform 0.2s;
      }
      #chat-widget-button:hover {
        transform: scale(1.1);
      }
      #chat-widget-button svg {
        width: 28px;
        height: 28px;
        fill: white;
      }
      #chat-widget-iframe {
        position: fixed;
        bottom: 90px;
        right: 20px;
        width: 380px;
        height: 600px;
        border: none;
        border-radius: 12px;
        box-shadow: 0 8px 24px rgba(0,0,0,0.15);
        z-index: 9998;
        display: none;
      }
      @media (max-width: 480px) {
        #chat-widget-iframe {
          width: calc(100vw - 40px);
          height: calc(100vh - 120px);
          bottom: 90px;
          right: 20px;
        }
      }
    </style>

    <button id="chat-widget-button" aria-label="Open chat">
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
        <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H6l-2 2V4h16v12z"/>
      </svg>
    </button>

    <iframe 
      id="chat-widget-iframe" 
      src="${API_URL}/widget.html?store=${STORE_ID}"
      allow="clipboard-write"
    ></iframe>
  `;

  // Add to page
  document.body.appendChild(widgetContainer);

  // Toggle widget
  const button = document.getElementById('chat-widget-button');
  const iframe = document.getElementById('chat-widget-iframe');
  
  button.addEventListener('click', function() {
    if (iframe.style.display === 'none' || !iframe.style.display) {
      iframe.style.display = 'block';
    } else {
      iframe.style.display = 'none';
    }
  });

  console.log('✅ Chat Support Pro widget loaded');
})();