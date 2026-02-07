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
        width: 56px;
        height: 56px;
        border-radius: 50%;
        background: #008060;
        border: none;
        cursor: pointer;
        box-shadow: 0 4px 12px rgba(0, 128, 96, 0.4);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 9999;
        transition: transform 0.2s, box-shadow 0.2s;
        padding: 0;
      }
      #chat-widget-button:hover {
        transform: scale(1.05);
        box-shadow: 0 6px 16px rgba(0, 128, 96, 0.5);
      }
      #chat-widget-button svg {
        width: 26px;
        height: 26px;
      }
      #chat-widget-button .icon-open,
      #chat-widget-button .icon-close {
        display: flex;
        align-items: center;
        justify-content: center;
      }
      #chat-widget-button .icon-close {
        display: none;
      }
      #chat-widget-button.active .icon-open {
        display: none;
      }
      #chat-widget-button.active .icon-close {
        display: flex;
      }
      #chat-widget-iframe {
        position: fixed;
        bottom: 88px;
        right: 20px;
        width: 380px;
        height: 560px;
        border: none;
        border-radius: 16px;
        box-shadow: 0 8px 30px rgba(0, 0, 0, 0.15);
        z-index: 9998;
        display: none;
        opacity: 0;
        transform: translateY(10px) scale(0.98);
        transition: opacity 0.25s ease, transform 0.25s ease;
      }
      #chat-widget-iframe.open {
        display: block;
        opacity: 1;
        transform: translateY(0) scale(1);
      }
      @media (max-width: 480px) {
        #chat-widget-iframe,
        #chat-widget-iframe.open {
          width: 100vw;
          height: 100vh;
          bottom: 0;
          right: 0;
          border-radius: 0;
          transform: none;
        }
        #chat-widget-button.active {
          bottom: 16px;
          right: 16px;
          z-index: 10000;
          background: rgba(0, 0, 0, 0.5);
          box-shadow: none;
        }
      }
    </style>

    <button id="chat-widget-button" aria-label="Chat with us">
      <span class="icon-open">
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/>
        </svg>
      </span>
      <span class="icon-close">
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <line x1="18" y1="6" x2="6" y2="18"></line>
          <line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>
      </span>
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
  let isOpen = false;
  
  button.addEventListener('click', function() {
    isOpen = !isOpen;
    
    if (isOpen) {
      iframe.style.display = 'block';
      // Trigger animation on next frame
      requestAnimationFrame(() => {
        iframe.classList.add('open');
      });
      button.classList.add('active');
    } else {
      iframe.classList.remove('open');
      button.classList.remove('active');
      // Wait for animation to finish before hiding
      setTimeout(() => {
        if (!isOpen) iframe.style.display = 'none';
      }, 250);
    }
  });

  console.log('✅ Chat Support Pro widget loaded');
})();