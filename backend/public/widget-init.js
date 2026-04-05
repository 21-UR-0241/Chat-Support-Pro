
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






































// (function() {
//   'use strict';

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

// function hexToRgba(hex, alpha) {
//     hex = hex.replace('#', '');
//     if (hex.length === 3) hex = hex[0]+hex[0]+hex[1]+hex[1]+hex[2]+hex[2];
//     var r = parseInt(hex.slice(0,2), 16);
//     var g = parseInt(hex.slice(2,4), 16);
//     var b = parseInt(hex.slice(4,6), 16);
//     return 'rgba(' + r + ',' + g + ',' + b + ',' + alpha + ')';
//   }

//   // Default green theme
//   var T = {name:'Emerald',primary:'#3bbe28',dark:'#2fa01e',light:'#4cd938',shadow:'rgba(59,190,40,0.4)',shadowHover:'rgba(59,190,40,0.55)',headerBg:'linear-gradient(135deg,#3bbe28,#2fa01e)',bubbleRadius:'12px'};

// // Override with Shopify theme colors if provided via Liquid
// if (config.themeColors && config.themeColors.primary) {
//     var p = config.themeColors.primary;
//     var d = config.themeColors.dark  || p;
//     var l = config.themeColors.light || p;
//     T = {
//       name:         'ShopifyTheme',
//       primary:      p,
//       dark:         d,
//       light:        l,
//       shadow:       hexToRgba(p, 0.4),
//       shadowHover:  hexToRgba(p, 0.55),
//       headerBg:     'linear-gradient(135deg,' + d + ',' + p + ')',
//       bubbleRadius: T.bubbleRadius   // keep shape from store-index theme
//     };
//     console.log('[ChatWidget] Theme: Shopify (' + p + ') | Store:', STORE_ID);
//   } else {
//     console.log('[ChatWidget] Theme:', T.name, '| Store:', STORE_ID);
//   }

//   // Build iframe src — pass colors so widget.html can apply them too
//   var iframeSrc = API_URL + '/widget.html?store=' + encodeURIComponent(STORE_ID);
//   if (config.themeColors && config.themeColors.primary) {
//     iframeSrc += '&primary=' + encodeURIComponent(T.primary);
//     iframeSrc += '&dark='    + encodeURIComponent(T.dark);
//     iframeSrc += '&light='   + encodeURIComponent(T.light);
//   }

//   // =========================================================
//   // BUILD WIDGET
//   // =========================================================
//   var widgetContainer = document.createElement('div');
//   widgetContainer.id = 'chat-support-widget';
//   widgetContainer.innerHTML = [
//     '<style>',
//     '  #chat-widget-button {',
//     '    position: fixed;',
//     '    bottom: 20px;',
//     '    left: 20px;',
//     '    height: 52px;',
//     '    border-radius: 26px;',
//     '    background: ' + T.headerBg + ';',
//     '    border: none;',
//     '    cursor: pointer;',
//     '    box-shadow: 0 4px 14px ' + T.shadow + ';',
//     '    display: flex;',
//     '    align-items: center;',
//     '    gap: 7px;',
//     '    padding: 0 20px 0 15px;',
//     '    z-index: 9999;',
//     '    transition: transform 0.2s, box-shadow 0.2s;',
//     '    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;',
//     '  }',
//     '  #chat-widget-button:hover {',
//     '    transform: scale(1.03);',
//     '    box-shadow: 0 6px 20px ' + T.shadowHover + ';',
//     '    opacity: 0.9;',
//     '  }',
//     '  #chat-widget-button .btn-icon {',
//     '    display: flex; align-items: center; justify-content: center;',
//     '    width: 28px; height: 28px;',
//     '  }',
//     '  #chat-widget-button .btn-label {',
//     '    color: white; font-size: 16px; font-weight: 700;',
//     '    letter-spacing: 0.01em; line-height: 1;',
//     '  }',
//     '  #chat-widget-button .icon-open,',
//     '  #chat-widget-button .icon-close {',
//     '    display: flex; align-items: center; justify-content: center;',
//     '  }',
//     '  #chat-widget-button .icon-close  { display: none; }',
//     '  #chat-widget-button.active .icon-open  { display: none; }',
//     '  #chat-widget-button.active .icon-close { display: flex; }',
//     '  #chat-widget-button.active .btn-label  { display: none; }',
//     '  #chat-widget-button.active {',
//     '    width: 52px; height: 52px; padding: 0;',
//     '    justify-content: center; border-radius: 50%;',
//     '  }',
//     '  #chat-widget-iframe {',
//     '    position: fixed;',
//     '    bottom: 84px;',
//     '    left: 20px;',
//     '    width: 380px;',
//     '    height: 560px;',
//     '    border: none;',
//     '    border-radius: ' + T.bubbleRadius + ';',
//     '    box-shadow: 0 8px 30px rgba(0,0,0,0.15);',
//     '    z-index: 9998;',
//     '    display: none;',
//     '    opacity: 0;',
//     '    transform: translateY(10px) scale(0.98);',
//     '    transition: opacity 0.25s ease, transform 0.25s ease;',
//     '  }',
//     '  #chat-widget-iframe.open {',
//     '    display: block; opacity: 1; transform: translateY(0) scale(1);',
//     '  }',
//     '  @media (max-width: 480px) {',
//     '    #chat-widget-iframe,',
//     '    #chat-widget-iframe.open {',
//     '      width: 100vw; height: 100vh;',
//     '      bottom: 0; left: 0; border-radius: 0; transform: none;',
//     '    }',
//     '    #chat-widget-button.active {',
//     '      bottom: 16px; left: 16px; z-index: 10000;',
//     '      background: rgba(0,0,0,0.5); box-shadow: none;',
//     '    }',
//     '  }',
//     '</style>',

//     '<button id="chat-widget-button" aria-label="Chat with us">',
//     '  <span class="btn-icon">',
//     '    <span class="icon-open">',
//     '      <svg width="26" height="26" viewBox="0 0 24 24" fill="white" xmlns="http://www.w3.org/2000/svg">',
//     '        <path d="M2 6C2 4.9 2.9 4 4 4H20C21.1 4 22 4.9 22 6V16C22 17.1 21.1 18 20 18H6L2 22V6Z"/>',
//     '        <circle cx="8"  cy="11.5" r="1.3" fill="' + T.primary + '"/>',
//     '        <circle cx="12" cy="11.5" r="1.3" fill="' + T.primary + '"/>',
//     '        <circle cx="16" cy="11.5" r="1.3" fill="' + T.primary + '"/>',
//     '      </svg>',
//     '    </span>',
//     '    <span class="icon-close">',
//     '      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">',
//     '        <line x1="18" y1="6"  x2="6"  y2="18"></line>',
//     '        <line x1="6"  y1="6"  x2="18" y2="18"></line>',
//     '      </svg>',
//     '    </span>',
//     '  </span>',
//     '  <span class="btn-label">Chat</span>',
//     '</button>',

//     '<iframe',
//     '  id="chat-widget-iframe"',
//     '  src="' + iframeSrc + '"',
//     '  allow="clipboard-write"',
//     '></iframe>'
//   ].join('\n');

//   document.body.appendChild(widgetContainer);

//   // =========================================================
//   // TOGGLE — unchanged
//   // =========================================================
//   var button = document.getElementById('chat-widget-button');
//   var iframe = document.getElementById('chat-widget-iframe');
//   var isOpen = false;

//   button.addEventListener('click', function() {
//     isOpen = !isOpen;
//     if (isOpen) {
//       iframe.style.display = 'block';
//       requestAnimationFrame(function() { iframe.classList.add('open'); });
//       button.classList.add('active');
//     } else {
//       iframe.classList.remove('open');
//       button.classList.remove('active');
//       setTimeout(function() { if (!isOpen) iframe.style.display = 'none'; }, 250);
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

  function hexToRgba(hex, alpha) {
    hex = hex.replace('#', '');
    if (hex.length === 3) hex = hex[0]+hex[0]+hex[1]+hex[1]+hex[2]+hex[2];
    var r = parseInt(hex.slice(0,2), 16);
    var g = parseInt(hex.slice(2,4), 16);
    var b = parseInt(hex.slice(4,6), 16);
    return 'rgba(' + r + ',' + g + ',' + b + ',' + alpha + ')';
  }
  function hashString(s) {
    var h = 5381;
    for (var i = 0; i < s.length; i++) { h = ((h << 5) + h) + s.charCodeAt(i); h |= 0; }
    return Math.abs(h);
  }
  function getThemeIndex(id) {
    if (!id) return 0;
    var n = parseInt(id, 10);
    if (!isNaN(n) && String(n) === String(id) && n > 0)
      return (n - 1) % 10;
    return hashString(String(id)) % 10;
  }

  var T = {
    name: 'Emerald',
    primary: '#3bbe28', dark: '#2fa01e', light: '#4cd938',
    shadow: 'rgba(59,190,40,0.4)', shadowHover: 'rgba(59,190,40,0.55)',
    headerBg: 'linear-gradient(135deg,#3bbe28,#2fa01e)'
  };

  if (config.themeColors && config.themeColors.primary) {
    var p = config.themeColors.primary;
    var d = config.themeColors.dark  || p;
    var l = config.themeColors.light || p;
    T = {
      name: 'ShopifyTheme',
      primary: p, dark: d, light: l,
      shadow: hexToRgba(p, 0.4), shadowHover: hexToRgba(p, 0.55),
      headerBg: 'linear-gradient(135deg,' + d + ',' + p + ')'
    };
    console.log('[ChatWidget] Theme: Shopify (' + p + ') | Store:', STORE_ID);
  } else {
    console.log('[ChatWidget] Theme:', T.name, '| Store:', STORE_ID);
  }

  var iframeSrc = API_URL + '/widget.html?store=' + encodeURIComponent(STORE_ID);
  if (config.themeColors && config.themeColors.primary) {
    iframeSrc += '&primary=' + encodeURIComponent(T.primary);
    iframeSrc += '&dark='    + encodeURIComponent(T.dark);
    iframeSrc += '&light='   + encodeURIComponent(T.light);
  }

  var SVG_CHAT   = '<svg width="24" height="24" viewBox="0 0 24 24" fill="white"><path d="M2 6C2 4.9 2.9 4 4 4H20C21.1 4 22 4.9 22 6V16C22 17.1 21.1 18 20 18H6L2 22V6Z"/><circle cx="8" cy="11.5" r="1.3" fill="'+T.primary+'"/><circle cx="12" cy="11.5" r="1.3" fill="'+T.primary+'"/><circle cx="16" cy="11.5" r="1.3" fill="'+T.primary+'"/></svg>';
  var SVG_BUBBLE = '<svg width="22" height="22" viewBox="0 0 24 24" fill="white"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>';
  var SVG_MSG    = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>';
  var SVG_CHAT_C = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 6C2 4.9 2.9 4 4 4H20C21.1 4 22 4.9 22 6V16C22 17.1 21.1 18 20 18H6L2 22V6Z"/></svg>';
  var SVG_CLOSE  = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';
  var CLOSE_SPAN = '<span class="cwi-close">' + SVG_CLOSE + '</span>';
  var TOGGLE_CSS = '#cwb .cwi-close{display:none;}#cwb.active .cwi-open{display:none;}#cwb.active .cwi-close{display:flex;}';

  function style0() {
    return {
      css: [
        '#cwb{position:fixed;bottom:20px;left:20px;height:52px;border-radius:26px;background:'+T.headerBg+';border:none;cursor:pointer;',
        'box-shadow:0 4px 14px '+T.shadow+';display:flex;align-items:center;gap:8px;padding:0 20px 0 14px;',
        'z-index:9999;transition:transform 0.2s,box-shadow 0.2s,width 0.2s,border-radius 0.2s,padding 0.2s;',
        'font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;}',
        '#cwb:hover{transform:scale(1.03);box-shadow:0 6px 20px '+T.shadowHover+';}',
        '#cwb .cwi-label{color:white;font-size:15px;font-weight:700;letter-spacing:0.01em;}',
        TOGGLE_CSS,
        '#cwb.active .cwi-label{display:none;}',
        '#cwb.active{width:52px;padding:0;justify-content:center;border-radius:50%;}'
      ].join(''),
      html: '<button id="cwb" aria-label="Chat with us"><span class="cwi-open">'+SVG_CHAT+'</span><span class="cwi-label">Chat</span>'+CLOSE_SPAN+'</button>',
      iframeRadius: '16px', iframeBottom: '84px', iframeLeft: '20px'
    };
  }

  function style1() {
    return {
      css: [
        '#cwb{position:fixed;bottom:24px;left:24px;width:56px;height:56px;border-radius:50%;background:'+T.headerBg+';border:none;cursor:pointer;',
        'box-shadow:0 2px 12px '+T.shadow+';display:flex;align-items:center;justify-content:center;',
        'z-index:9999;transition:transform 0.18s,box-shadow 0.18s;}',
        '#cwb:hover{transform:translateY(-3px);box-shadow:0 8px 22px '+T.shadowHover+';}',
        TOGGLE_CSS
      ].join(''),
      html: '<button id="cwb" aria-label="Chat with us"><span class="cwi-open">'+SVG_MSG+'</span>'+CLOSE_SPAN+'</button>',
      iframeRadius: '20px', iframeBottom: '94px', iframeLeft: '24px'
    };
  }

  function style2() {
    return {
      css: [
        '#cwb{position:fixed;bottom:20px;left:20px;width:58px;height:58px;border-radius:18px;background:'+T.headerBg+';border:none;cursor:pointer;',
        'box-shadow:0 4px 16px '+T.shadow+';display:flex;align-items:center;justify-content:center;',
        'z-index:9999;transition:transform 0.2s,box-shadow 0.2s;}',
        '#cwb:hover{transform:scale(1.08);box-shadow:0 8px 24px '+T.shadowHover+';}',
        '#cwb .cw-dot{position:absolute;top:9px;right:9px;width:11px;height:11px;border-radius:50%;background:#a8f09a;border:2.5px solid white;}',
        TOGGLE_CSS,
        '#cwb.active .cw-dot{display:none;}'
      ].join(''),
      html: '<button id="cwb" aria-label="Chat with us" style="position:relative;"><span class="cw-dot"></span><span class="cwi-open">'+SVG_CHAT+'</span>'+CLOSE_SPAN+'</button>',
      iframeRadius: '16px', iframeBottom: '92px', iframeLeft: '20px'
    };
  }

  function style3() {
    return {
      css: [
        '#cwb{position:fixed;bottom:20px;left:20px;height:46px;border-radius:3px;background:'+T.headerBg+';border:none;cursor:pointer;',
        'box-shadow:0 3px 10px '+T.shadow+';display:flex;align-items:center;gap:9px;padding:0 18px;',
        'z-index:9999;transition:transform 0.15s,box-shadow 0.15s;',
        'font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;}',
        '#cwb:hover{transform:translateY(-1px);box-shadow:0 6px 18px '+T.shadowHover+';}',
        '#cwb .cwi-label{color:white;font-size:12px;font-weight:800;letter-spacing:0.12em;text-transform:uppercase;}',
        TOGGLE_CSS,
        '#cwb.active .cwi-label{display:none;}',
        '#cwb.active{width:46px;padding:0;justify-content:center;}'
      ].join(''),
      html: '<button id="cwb" aria-label="Chat with us"><span class="cwi-open">'+SVG_BUBBLE+'</span><span class="cwi-label">Support</span>'+CLOSE_SPAN+'</button>',
      iframeRadius: '3px', iframeBottom: '80px', iframeLeft: '20px'
    };
  }

  function style4() {
    return {
      css: [
        '@keyframes cw-ripple{0%{transform:scale(1);opacity:0.55}100%{transform:scale(1.75);opacity:0}}',
        '#cwb{position:fixed;bottom:24px;left:24px;width:54px;height:54px;border-radius:50%;background:'+T.headerBg+';border:none;cursor:pointer;',
        'box-shadow:0 4px 14px '+T.shadow+';display:flex;align-items:center;justify-content:center;',
        'z-index:9999;transition:transform 0.2s,box-shadow 0.2s;}',
        '#cwb::before{content:"";position:absolute;inset:0;border-radius:50%;background:'+T.primary+';',
        'animation:cw-ripple 2s ease-out infinite;pointer-events:none;}',
        '#cwb:hover{transform:scale(1.08);box-shadow:0 6px 20px '+T.shadowHover+';}',
        TOGGLE_CSS,
        '#cwb.active::before{display:none;}'
      ].join(''),
      html: '<button id="cwb" aria-label="Chat with us"><span class="cwi-open">'+SVG_CHAT+'</span>'+CLOSE_SPAN+'</button>',
      iframeRadius: '20px', iframeBottom: '94px', iframeLeft: '24px'
    };
  }

  function style5() {
    return {
      css: [
        '#cwb{position:fixed;bottom:140px;left:0;height:44px;border-radius:0 10px 10px 0;background:'+T.headerBg+';border:none;cursor:pointer;',
        'box-shadow:3px 2px 14px '+T.shadow+';display:flex;align-items:center;gap:7px;padding:0 16px 0 12px;',
        'z-index:9999;transition:transform 0.2s,box-shadow 0.2s;',
        'font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;}',
        '#cwb:hover{transform:translateX(4px);box-shadow:5px 4px 18px '+T.shadowHover+';}',
        '#cwb .cwi-label{color:white;font-size:13px;font-weight:700;letter-spacing:0.04em;}',
        TOGGLE_CSS,
        '#cwb.active .cwi-label{display:none;}'
      ].join(''),
      html: '<button id="cwb" aria-label="Chat with us"><span class="cwi-open">'+SVG_BUBBLE+'</span><span class="cwi-label">Help</span>'+CLOSE_SPAN+'</button>',
      iframeRadius: '12px', iframeBottom: '50px', iframeLeft: '10px'
    };
  }

  function style6() {
    return {
      css: [
        '#cwb{position:fixed;bottom:20px;left:20px;height:54px;border-radius:14px;background:'+T.headerBg+';border:none;cursor:pointer;',
        'box-shadow:0 4px 20px '+T.shadow+';display:flex;align-items:center;gap:10px;padding:0 18px 0 14px;',
        'z-index:9999;transition:transform 0.2s,box-shadow 0.2s;',
        'font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;}',
        '#cwb:hover{transform:translateY(-2px);box-shadow:0 10px 28px '+T.shadowHover+';}',
        '#cwb .cw-texts{display:flex;flex-direction:column;align-items:flex-start;}',
        '#cwb .cwi-label{color:white;font-size:14px;font-weight:700;line-height:1.2;}',
        '#cwb .cw-sub{color:rgba(255,255,255,0.78);font-size:11px;line-height:1.3;display:flex;align-items:center;gap:4px;}',
        '#cwb .cw-sub::before{content:"";display:inline-block;width:6px;height:6px;border-radius:50%;background:#a8f09a;}',
        TOGGLE_CSS,
        '#cwb.active .cw-texts{display:none;}',
        '#cwb.active{width:54px;height:54px;padding:0;justify-content:center;border-radius:50%;}'
      ].join(''),
      html: '<button id="cwb" aria-label="Chat with us"><span class="cwi-open">'+SVG_MSG+'</span><span class="cw-texts"><span class="cwi-label">Need help?</span><span class="cw-sub">We\'re online</span></span>'+CLOSE_SPAN+'</button>',
      iframeRadius: '14px', iframeBottom: '88px', iframeLeft: '20px'
    };
  }

  function style7() {
    return {
      css: [
        '#cwb{position:fixed;bottom:20px;left:20px;height:54px;border-radius:27px;background:'+T.headerBg+';border:none;cursor:pointer;',
        'box-shadow:0 4px 16px '+T.shadow+';display:flex;align-items:center;padding:0 20px 0 5px;',
        'z-index:9999;transition:transform 0.2s,box-shadow 0.2s,width 0.2s,padding 0.2s;',
        'font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;}',
        '#cwb:hover{transform:scale(1.03);box-shadow:0 6px 22px '+T.shadowHover+';}',
        '#cwb .cw-avatar{width:44px;height:44px;border-radius:50%;background:rgba(255,255,255,0.22);',
        'border:2px solid rgba(255,255,255,0.38);display:flex;align-items:center;justify-content:center;',
        'font-size:14px;font-weight:800;color:white;margin-right:10px;flex-shrink:0;}',
        '#cwb .cwi-label{color:white;font-size:14px;font-weight:700;white-space:nowrap;}',
        TOGGLE_CSS,
        '#cwb.active .cw-avatar{display:none;}',
        '#cwb.active .cwi-label{display:none;}',
        '#cwb.active{width:54px;padding:0;justify-content:center;border-radius:50%;}'
      ].join(''),
      html: '<button id="cwb" aria-label="Chat with us"><span class="cwi-open" style="display:flex;align-items:center;"><span class="cw-avatar">CS</span><span class="cwi-label">Chat with us</span></span>'+CLOSE_SPAN+'</button>',
      iframeRadius: '16px', iframeBottom: '88px', iframeLeft: '20px'
    };
  }

  function style8() {
    return {
      css: [
        '#cwb{position:fixed;bottom:20px;left:20px;width:60px;height:62px;border-radius:14px;background:'+T.headerBg+';border:none;cursor:pointer;',
        'box-shadow:0 4px 16px '+T.shadow+';display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;padding:0;',
        'z-index:9999;transition:transform 0.2s,box-shadow 0.2s;',
        'font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;}',
        '#cwb:hover{transform:translateY(-3px);box-shadow:0 8px 22px '+T.shadowHover+';}',
        '#cwb .cwi-label{color:white;font-size:10px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;line-height:1;}',
        TOGGLE_CSS,
        '#cwb.active .cwi-label{display:none;}',
        '#cwb.active{width:54px;height:54px;border-radius:50%;}'
      ].join(''),
      html: '<button id="cwb" aria-label="Chat with us"><span class="cwi-open">'+SVG_CHAT_C+'</span><span class="cwi-label">Chat</span>'+CLOSE_SPAN+'</button>',
      iframeRadius: '14px', iframeBottom: '96px', iframeLeft: '20px'
    };
  }

  function style9() {
    return {
      css: [
        '#cwb{position:fixed;bottom:20px;left:20px;height:52px;border-radius:26px;',
        'background:'+hexToRgba(T.primary, 0.18)+';',
        'backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);',
        'border:1.5px solid '+hexToRgba(T.primary, 0.55)+';',
        'cursor:pointer;box-shadow:0 4px 20px '+T.shadow+',inset 0 1px 0 rgba(255,255,255,0.25);',
        'display:flex;align-items:center;gap:8px;padding:0 20px 0 14px;',
        'z-index:9999;transition:transform 0.2s,box-shadow 0.2s,background 0.2s;',
        'font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;}',
        '#cwb:hover{transform:scale(1.04);background:'+hexToRgba(T.primary, 0.3)+';box-shadow:0 6px 24px '+T.shadowHover+';}',
        '#cwb .cwi-label{color:white;font-size:15px;font-weight:700;letter-spacing:0.01em;text-shadow:0 1px 4px rgba(0,0,0,0.3);}',
        TOGGLE_CSS,
        '#cwb.active .cwi-label{display:none;}',
        '#cwb.active{width:52px;padding:0;justify-content:center;border-radius:50%;background:'+T.headerBg+';border-color:transparent;}'
      ].join(''),
      html: '<button id="cwb" aria-label="Chat with us"><span class="cwi-open">'+SVG_CHAT+'</span><span class="cwi-label">Chat</span>'+CLOSE_SPAN+'</button>',
      iframeRadius: '16px', iframeBottom: '84px', iframeLeft: '20px'
    };
  }

  var idx = getThemeIndex(STORE_ID);
  var STYLE_FNS = [style0, style1, style2, style3, style4, style5, style6, style7, style8, style9];
  var S = STYLE_FNS[idx]();

  var widgetContainer = document.createElement('div');
  widgetContainer.id = 'chat-support-widget';

  widgetContainer.innerHTML = [
    '<style>',
    S.css,
    '#chat-widget-iframe{position:fixed;bottom:'+S.iframeBottom+';left:'+S.iframeLeft+';width:380px;height:560px;border:none;border-radius:'+S.iframeRadius+';box-shadow:0 8px 30px rgba(0,0,0,0.15);z-index:9998;display:none;opacity:0;transform:translateY(10px) scale(0.98);transition:opacity 0.25s ease,transform 0.25s ease;}',
    '#chat-widget-iframe.open{display:block;opacity:1;transform:translateY(0) scale(1);}',
    '@media(max-width:480px){#chat-widget-iframe,#chat-widget-iframe.open{width:100vw;height:100vh;bottom:0;left:0;border-radius:0;transform:none;}#cwb.active{bottom:16px;left:16px;z-index:10000;background:rgba(0,0,0,0.5)!important;box-shadow:none!important;border:none!important;}}',
    '</style>',
    S.html,
    '<iframe id="chat-widget-iframe" src="' + iframeSrc + '" allow="clipboard-write"></iframe>'
  ].join('\n');

  document.body.appendChild(widgetContainer);

  var button = document.getElementById('cwb');
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

  var STYLE_NAMES = ['Pill','Circle','Square+Dot','Sharp','Pulse','SideTab','Card','Avatar','Stacked','Glass'];
  console.log('✅ Chat Support Pro | Style ' + (idx+1) + ': ' + STYLE_NAMES[idx] + ' | Store:', STORE_ID);
})();