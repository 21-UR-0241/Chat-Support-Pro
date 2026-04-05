
// (function() {
//   'use strict';

//   // Check if config exists
//   if (!window.ChatSupportConfig) {
//     console.error('ChatSupportConfig not found. Please configure the widget.');
//     return;
//   }

//   const config = window.ChatSupportConfig;
//   const API_URL = config.apiUrl || 'http://localhost:3000';
//   const STORE_ID = config.storeId;

//   if (!STORE_ID) {
//     console.error('Chat Widget: storeId is required');
//     return;
//   }

//   // Create widget container
//   const widgetContainer = document.createElement('div');
//   widgetContainer.id = 'chat-support-widget';
//   widgetContainer.innerHTML = `
//     <style>
//       #chat-widget-button {
//         position: fixed;
//         bottom: 20px;
//         left: 20px;
//         height: 52px;
//         border-radius: 26px;
//         background: #3bbe28;
//         border: none;
//         cursor: pointer;
//         box-shadow: 0 4px 14px rgba(59, 190, 40, 0.4);
//         display: flex;
//         align-items: center;
//         gap: 7px;
//         padding: 0 20px 0 15px;
//         z-index: 9999;
//         transition: transform 0.2s, box-shadow 0.2s, background 0.2s;
//         font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
//       }
//       #chat-widget-button:hover {
//         transform: scale(1.03);
//         box-shadow: 0 6px 20px rgba(59, 190, 40, 0.5);
//         background: #33a822;
//       }
//       #chat-widget-button .btn-icon {
//         display: flex;
//         align-items: center;
//         justify-content: center;
//         width: 28px;
//         height: 28px;
//       }
//       #chat-widget-button .btn-label {
//         color: white;
//         font-size: 16px;
//         font-weight: 700;
//         letter-spacing: 0.01em;
//         line-height: 1;
//       }
//       #chat-widget-button .icon-open,
//       #chat-widget-button .icon-close {
//         display: flex;
//         align-items: center;
//         justify-content: center;
//       }
//       #chat-widget-button .icon-close {
//         display: none;
//       }
//       #chat-widget-button.active .icon-open {
//         display: none;
//       }
//       #chat-widget-button.active .icon-close {
//         display: flex;
//       }
//       #chat-widget-button.active .btn-label {
//         display: none;
//       }
//       #chat-widget-button.active {
//         width: 52px;
//         height: 52px;
//         padding: 0;
//         justify-content: center;
//         border-radius: 50%;
//       }
//       #chat-widget-iframe {
//         position: fixed;
//         bottom: 84px;
//         left: 20px;
//         width: 380px;
//         height: 560px;
//         border: none;
//         border-radius: 16px;
//         box-shadow: 0 8px 30px rgba(0, 0, 0, 0.15);
//         z-index: 9998;
//         display: none;
//         opacity: 0;
//         transform: translateY(10px) scale(0.98);
//         transition: opacity 0.25s ease, transform 0.25s ease;
//       }
//       #chat-widget-iframe.open {
//         display: block;
//         opacity: 1;
//         transform: translateY(0) scale(1);
//       }
//       @media (max-width: 480px) {
//         #chat-widget-iframe,
//         #chat-widget-iframe.open {
//           width: 100vw;
//           height: 100vh;
//           bottom: 0;
//           left: 0;
//           border-radius: 0;
//           transform: none;
//         }
//         #chat-widget-button.active {
//           bottom: 16px;
//           left: 16px;
//           z-index: 10000;
//           background: rgba(0, 0, 0, 0.5);
//           box-shadow: none;
//         }
//       }
//     </style>

//     <button id="chat-widget-button" aria-label="Chat with us">
//       <span class="btn-icon">
//         <span class="icon-open">
//           <svg width="26" height="26" viewBox="0 0 24 24" fill="white" xmlns="http://www.w3.org/2000/svg">
//             <path d="M2 6C2 4.9 2.9 4 4 4H20C21.1 4 22 4.9 22 6V16C22 17.1 21.1 18 20 18H6L2 22V6Z"/>
//             <circle cx="8" cy="11.5" r="1.3" fill="#3bbe28"/>
//             <circle cx="12" cy="11.5" r="1.3" fill="#3bbe28"/>
//             <circle cx="16" cy="11.5" r="1.3" fill="#3bbe28"/>
//           </svg>
//         </span>
//         <span class="icon-close">
//           <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
//             <line x1="18" y1="6" x2="6" y2="18"></line>
//             <line x1="6" y1="6" x2="18" y2="18"></line>
//           </svg>
//         </span>
//       </span>
//       <span class="btn-label">Chat</span>
//     </button>

//     <iframe 
//       id="chat-widget-iframe" 
//       src="${API_URL}/widget.html?store=${STORE_ID}"
//       allow="clipboard-write"
//     ></iframe>
//   `;

//   // Add to page
//   document.body.appendChild(widgetContainer);

//   // Toggle widget
//   const button = document.getElementById('chat-widget-button');
//   const iframe = document.getElementById('chat-widget-iframe');
//   let isOpen = false;
  
//   button.addEventListener('click', function() {
//     isOpen = !isOpen;
    
//     if (isOpen) {
//       iframe.style.display = 'block';
//       requestAnimationFrame(() => {
//         iframe.classList.add('open');
//       });
//       button.classList.add('active');
//     } else {
//       iframe.classList.remove('open');
//       button.classList.remove('active');
//       setTimeout(() => {
//         if (!isOpen) iframe.style.display = 'none';
//       }, 250);
//     }
//   });

//   console.log('✅ Chat Support Pro widget loaded');
// })();



(function() {
  'use strict';

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

  // =========================================================
  // THEME SYSTEM
  // Priority:
  //   1. config.themeColors  — colors from Shopify theme Liquid
  //   2. THEMES[index]       — rotating store-index fallback
  // =========================================================
  var THEMES = [
    { name:'Emerald', primary:'#3bbe28', dark:'#2fa01e', light:'#4cd938',
      shadow:'rgba(59,190,40,0.4)',   shadowHover:'rgba(59,190,40,0.55)',
      headerBg:'linear-gradient(135deg,#3bbe28,#2fa01e)', bubbleRadius:'12px' },
    { name:'Ocean',   primary:'#2563eb', dark:'#1d4ed8', light:'#3b82f6',
      shadow:'rgba(37,99,235,0.4)',   shadowHover:'rgba(37,99,235,0.55)',
      headerBg:'linear-gradient(135deg,#1d4ed8,#2563eb)', bubbleRadius:'18px' },
    { name:'Violet',  primary:'#7c3aed', dark:'#6d28d9', light:'#8b5cf6',
      shadow:'rgba(124,58,237,0.4)',  shadowHover:'rgba(124,58,237,0.55)',
      headerBg:'linear-gradient(135deg,#6d28d9,#7c3aed)', bubbleRadius:'16px' },
    { name:'Sunset',  primary:'#ea580c', dark:'#c2410c', light:'#f97316',
      shadow:'rgba(234,88,12,0.4)',   shadowHover:'rgba(234,88,12,0.55)',
      headerBg:'linear-gradient(135deg,#c2410c,#f97316)', bubbleRadius:'8px'  },
    { name:'Rose',    primary:'#e11d48', dark:'#be123c', light:'#fb7185',
      shadow:'rgba(225,29,72,0.4)',   shadowHover:'rgba(225,29,72,0.55)',
      headerBg:'linear-gradient(135deg,#be123c,#e11d48)', bubbleRadius:'20px' },
    { name:'Teal',    primary:'#0891b2', dark:'#0e7490', light:'#22d3ee',
      shadow:'rgba(8,145,178,0.4)',   shadowHover:'rgba(8,145,178,0.55)',
      headerBg:'linear-gradient(135deg,#0e7490,#22d3ee)', bubbleRadius:'12px' },
    { name:'Indigo',  primary:'#4f46e5', dark:'#4338ca', light:'#6366f1',
      shadow:'rgba(79,70,229,0.4)',   shadowHover:'rgba(79,70,229,0.55)',
      headerBg:'linear-gradient(135deg,#4338ca,#6366f1)', bubbleRadius:'14px' },
    { name:'Amber',   primary:'#d97706', dark:'#b45309', light:'#f59e0b',
      shadow:'rgba(217,119,6,0.4)',   shadowHover:'rgba(217,119,6,0.55)',
      headerBg:'linear-gradient(135deg,#b45309,#f59e0b)', bubbleRadius:'6px'  }
  ];

  function hashString(s) {
    var h = 5381;
    for (var i = 0; i < s.length; i++) { h = ((h << 5) + h) + s.charCodeAt(i); h |= 0; }
    return Math.abs(h);
  }

  function getThemeIndex(id) {
    if (!id) return 0;
    var n = parseInt(id, 10);
    if (!isNaN(n) && String(n) === String(id) && n > 0)
      return Math.floor((n - 1) / 10) % THEMES.length;
    return Math.floor(hashString(String(id)) / 10) % THEMES.length;
  }

  function hexToRgba(hex, alpha) {
    hex = hex.replace('#', '');
    if (hex.length === 3) hex = hex[0]+hex[0]+hex[1]+hex[1]+hex[2]+hex[2];
    var r = parseInt(hex.slice(0,2), 16);
    var g = parseInt(hex.slice(2,4), 16);
    var b = parseInt(hex.slice(4,6), 16);
    return 'rgba(' + r + ',' + g + ',' + b + ',' + alpha + ')';
  }

// Default to Emerald (green) unless Shopify theme colors are provided
var T = THEMES[0];

// Override with Shopify theme colors if provided via Liquid
if (config.themeColors && config.themeColors.primary) {
    var p = config.themeColors.primary;
    var d = config.themeColors.dark  || p;
    var l = config.themeColors.light || p;
    T = {
      name:         'ShopifyTheme',
      primary:      p,
      dark:         d,
      light:        l,
      shadow:       hexToRgba(p, 0.4),
      shadowHover:  hexToRgba(p, 0.55),
      headerBg:     'linear-gradient(135deg,' + d + ',' + p + ')',
      bubbleRadius: T.bubbleRadius   // keep shape from store-index theme
    };
    console.log('[ChatWidget] Theme: Shopify (' + p + ') | Store:', STORE_ID);
  } else {
    console.log('[ChatWidget] Theme:', T.name, '| Store:', STORE_ID);
  }

  // Build iframe src — pass colors so widget.html can apply them too
  var iframeSrc = API_URL + '/widget.html?store=' + encodeURIComponent(STORE_ID);
  if (config.themeColors && config.themeColors.primary) {
    iframeSrc += '&primary=' + encodeURIComponent(T.primary);
    iframeSrc += '&dark='    + encodeURIComponent(T.dark);
    iframeSrc += '&light='   + encodeURIComponent(T.light);
  }

  // =========================================================
  // BUILD WIDGET
  // =========================================================
  var widgetContainer = document.createElement('div');
  widgetContainer.id = 'chat-support-widget';
  widgetContainer.innerHTML = [
    '<style>',
    '  #chat-widget-button {',
    '    position: fixed;',
    '    bottom: 20px;',
    '    left: 20px;',
    '    height: 52px;',
    '    border-radius: 26px;',
    '    background: ' + T.headerBg + ';',
    '    border: none;',
    '    cursor: pointer;',
    '    box-shadow: 0 4px 14px ' + T.shadow + ';',
    '    display: flex;',
    '    align-items: center;',
    '    gap: 7px;',
    '    padding: 0 20px 0 15px;',
    '    z-index: 9999;',
    '    transition: transform 0.2s, box-shadow 0.2s;',
    '    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;',
    '  }',
    '  #chat-widget-button:hover {',
    '    transform: scale(1.03);',
    '    box-shadow: 0 6px 20px ' + T.shadowHover + ';',
    '    opacity: 0.9;',
    '  }',
    '  #chat-widget-button .btn-icon {',
    '    display: flex; align-items: center; justify-content: center;',
    '    width: 28px; height: 28px;',
    '  }',
    '  #chat-widget-button .btn-label {',
    '    color: white; font-size: 16px; font-weight: 700;',
    '    letter-spacing: 0.01em; line-height: 1;',
    '  }',
    '  #chat-widget-button .icon-open,',
    '  #chat-widget-button .icon-close {',
    '    display: flex; align-items: center; justify-content: center;',
    '  }',
    '  #chat-widget-button .icon-close  { display: none; }',
    '  #chat-widget-button.active .icon-open  { display: none; }',
    '  #chat-widget-button.active .icon-close { display: flex; }',
    '  #chat-widget-button.active .btn-label  { display: none; }',
    '  #chat-widget-button.active {',
    '    width: 52px; height: 52px; padding: 0;',
    '    justify-content: center; border-radius: 50%;',
    '  }',
    '  #chat-widget-iframe {',
    '    position: fixed;',
    '    bottom: 84px;',
    '    left: 20px;',
    '    width: 380px;',
    '    height: 560px;',
    '    border: none;',
    '    border-radius: ' + T.bubbleRadius + ';',
    '    box-shadow: 0 8px 30px rgba(0,0,0,0.15);',
    '    z-index: 9998;',
    '    display: none;',
    '    opacity: 0;',
    '    transform: translateY(10px) scale(0.98);',
    '    transition: opacity 0.25s ease, transform 0.25s ease;',
    '  }',
    '  #chat-widget-iframe.open {',
    '    display: block; opacity: 1; transform: translateY(0) scale(1);',
    '  }',
    '  @media (max-width: 480px) {',
    '    #chat-widget-iframe,',
    '    #chat-widget-iframe.open {',
    '      width: 100vw; height: 100vh;',
    '      bottom: 0; left: 0; border-radius: 0; transform: none;',
    '    }',
    '    #chat-widget-button.active {',
    '      bottom: 16px; left: 16px; z-index: 10000;',
    '      background: rgba(0,0,0,0.5); box-shadow: none;',
    '    }',
    '  }',
    '</style>',

    '<button id="chat-widget-button" aria-label="Chat with us">',
    '  <span class="btn-icon">',
    '    <span class="icon-open">',
    '      <svg width="26" height="26" viewBox="0 0 24 24" fill="white" xmlns="http://www.w3.org/2000/svg">',
    '        <path d="M2 6C2 4.9 2.9 4 4 4H20C21.1 4 22 4.9 22 6V16C22 17.1 21.1 18 20 18H6L2 22V6Z"/>',
    '        <circle cx="8"  cy="11.5" r="1.3" fill="' + T.primary + '"/>',
    '        <circle cx="12" cy="11.5" r="1.3" fill="' + T.primary + '"/>',
    '        <circle cx="16" cy="11.5" r="1.3" fill="' + T.primary + '"/>',
    '      </svg>',
    '    </span>',
    '    <span class="icon-close">',
    '      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">',
    '        <line x1="18" y1="6"  x2="6"  y2="18"></line>',
    '        <line x1="6"  y1="6"  x2="18" y2="18"></line>',
    '      </svg>',
    '    </span>',
    '  </span>',
    '  <span class="btn-label">Chat</span>',
    '</button>',

    '<iframe',
    '  id="chat-widget-iframe"',
    '  src="' + iframeSrc + '"',
    '  allow="clipboard-write"',
    '></iframe>'
  ].join('\n');

  document.body.appendChild(widgetContainer);

  // =========================================================
  // TOGGLE — unchanged
  // =========================================================
  var button = document.getElementById('chat-widget-button');
  var iframe = document.getElementById('chat-widget-iframe');
  var isOpen = false;

  button.addEventListener('click', function() {
    isOpen = !isOpen;
    if (isOpen) {
      iframe.style.display = 'block';
      requestAnimationFrame(function() { iframe.classList.add('open'); });
      button.classList.add('active');
    } else {
      iframe.classList.remove('open');
      button.classList.remove('active');
      setTimeout(function() { if (!isOpen) iframe.style.display = 'none'; }, 250);
    }
  });

  console.log('✅ Chat Support Pro widget loaded');
})();




