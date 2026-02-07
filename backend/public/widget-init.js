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
        bottom: 80px;
        right: 20px;
        height: 52px;
        border-radius: 26px;
        background: #3bbe28;
        border: none;
        cursor: pointer;
        box-shadow: 0 4px 14px rgba(59, 190, 40, 0.4);
        display: flex;
        align-items: center;
        gap: 7px;
        padding: 0 20px 0 15px;
        z-index: 9999;
        transition: transform 0.2s, box-shadow 0.2s, background 0.2s;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      }
      #chat-widget-button:hover {
        transform: scale(1.03);
        box-shadow: 0 6px 20px rgba(59, 190, 40, 0.5);
        background: #33a822;
      }
      #chat-widget-button .btn-icon {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 28px;
        height: 28px;
      }
      #chat-widget-button .btn-label {
        color: white;
        font-size: 16px;
        font-weight: 700;
        letter-spacing: 0.01em;
        line-height: 1;
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
      #chat-widget-button.active .btn-label {
        display: none;
      }
      #chat-widget-button.active {
        width: 52px;
        height: 52px;
        padding: 0;
        justify-content: center;
        border-radius: 50%;
      }
      #chat-widget-iframe {
        position: fixed;
        bottom: 144px;
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
      <span class="btn-icon">
        <span class="icon-open">
          <svg width="26" height="26" viewBox="0 0 24 24" fill="white" xmlns="http://www.w3.org/2000/svg">
            <path d="M2 6C2 4.9 2.9 4 4 4H20C21.1 4 22 4.9 22 6V16C22 17.1 21.1 18 20 18H6L2 22V6Z"/>
            <circle cx="8" cy="11.5" r="1.3" fill="#3bbe28"/>
            <circle cx="12" cy="11.5" r="1.3" fill="#3bbe28"/>
            <circle cx="16" cy="11.5" r="1.3" fill="#3bbe28"/>
          </svg>
        </span>
        <span class="icon-close">
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </span>
      </span>
      <span class="btn-label">Chat</span>
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
      requestAnimationFrame(() => {
        iframe.classList.add('open');
      });
      button.classList.add('active');
    } else {
      iframe.classList.remove('open');
      button.classList.remove('active');
      setTimeout(() => {
        if (!isOpen) iframe.style.display = 'none';
      }, 250);
    }
  });

  console.log('✅ Chat Support Pro widget loaded');
})();