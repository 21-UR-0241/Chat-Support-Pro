
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
    console.error('[ChatWidget] ChatSupportConfig not found.');
    return;
  }

  var config  = window.ChatSupportConfig;
  var API_URL = config.apiUrl || 'http://localhost:3000';
  var STORE_ID = config.storeId;

  if (!STORE_ID) {
    console.error('[ChatWidget] storeId is required');
    return;
  }

  // ── Utilities ─────────────────────────────────────────────
  function hexToRgba(hex, alpha) {
    hex = hex.replace('#', '');
    if (hex.length === 3) hex = hex[0]+hex[0]+hex[1]+hex[1]+hex[2]+hex[2];
    var r = parseInt(hex.slice(0,2), 16);
    var g = parseInt(hex.slice(2,4), 16);
    var b = parseInt(hex.slice(4,6), 16);
    return 'rgba('+r+','+g+','+b+','+alpha+')';
  }
  function hashString(s) {
    var h = 5381;
    for (var i = 0; i < s.length; i++) { h = ((h<<5)+h)+s.charCodeAt(i); h|=0; }
    return Math.abs(h);
  }
  // Store 1→0, 2→1 ... 10→9, 11→0, 12→1 ...
  function getIdx(id) {
    if (!id) return 0;
    var n = parseInt(id, 10);
    if (!isNaN(n) && String(n) === String(id) && n > 0) return (n-1) % 10;
    return hashString(String(id)) % 10;
  }

  // ── Color system ──────────────────────────────────────────
  var T = {
    primary:    '#3bbe28',
    dark:       '#2fa01e',
    light:      '#4cd938',
    shadow:     'rgba(59,190,40,0.4)',
    shadowHov:  'rgba(59,190,40,0.55)',
    grad:       'linear-gradient(135deg,#3bbe28,#2fa01e)'
  };

  if (config.themeColors && config.themeColors.primary) {
    var cp = config.themeColors.primary;
    var cd = config.themeColors.dark  || cp;
    var cl = config.themeColors.light || cp;
    T.primary   = cp;
    T.dark      = cd;
    T.light     = cl;
    T.shadow    = hexToRgba(cp, 0.4);
    T.shadowHov = hexToRgba(cp, 0.55);
    T.grad      = 'linear-gradient(135deg,'+cd+','+cp+')';
    console.log('[ChatWidget] Shopify theme color: '+cp+' | Store: '+STORE_ID);
  } else {
    console.log('[ChatWidget] Green fallback | Store: '+STORE_ID);
  }

  // ── iframe src ────────────────────────────────────────────
  var iframeSrc = API_URL+'/widget.html?store='+encodeURIComponent(STORE_ID);
  if (config.themeColors && config.themeColors.primary) {
    iframeSrc += '&primary='+encodeURIComponent(T.primary);
    iframeSrc += '&dark='+encodeURIComponent(T.dark);
    iframeSrc += '&light='+encodeURIComponent(T.light);
  }

  // ── Shared SVGs ───────────────────────────────────────────
  var ic = {
    chat: '<svg width="24" height="24" viewBox="0 0 24 24" fill="white"><path d="M2 6C2 4.9 2.9 4 4 4H20C21.1 4 22 4.9 22 6V16C22 17.1 21.1 18 20 18H6L2 22V6Z"/>'
        + '<circle cx="8" cy="11.5" r="1.3" fill="'+T.primary+'"/>'
        + '<circle cx="12" cy="11.5" r="1.3" fill="'+T.primary+'"/>'
        + '<circle cx="16" cy="11.5" r="1.3" fill="'+T.primary+'"/></svg>',
    bubble: '<svg width="22" height="22" viewBox="0 0 24 24" fill="white"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>',
    msg: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">'
       + '<path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>',
    chatO: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round">'
         + '<path d="M2 6C2 4.9 2.9 4 4 4H20C21.1 4 22 4.9 22 6V16C22 17.1 21.1 18 20 18H6L2 22V6Z"/></svg>',
    close: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round">'
         + '<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>'
  };

  // Shared toggle CSS — open/close icon switching
  var TCSS = [
    '#cwb .cw-cl{display:none;}',
    '#cwb.active .cw-op{display:none;}',
    '#cwb.active .cw-cl{display:flex;}'
  ].join('');

  function closeBtn() { return '<span class="cw-cl">'+ic.close+'</span>'; }

  // ── 10 Button Styles ──────────────────────────────────────
  var STYLES = [

    // 0 — Pill with "Chat" label
    {
      css: [
        '#cwb{position:fixed;bottom:20px;left:20px;height:52px;border-radius:26px;background:'+T.grad+';',
        'border:none;cursor:pointer;box-shadow:0 4px 14px '+T.shadow+';',
        'display:flex;align-items:center;gap:8px;padding:0 20px 0 14px;z-index:9999;',
        'transition:transform .2s,box-shadow .2s,width .2s,border-radius .2s,padding .2s;',
        'font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;}',
        '#cwb:hover{transform:scale(1.03);box-shadow:0 6px 20px '+T.shadowHov+';}',
        '#cwb .cw-lbl{color:#fff;font-size:15px;font-weight:700;letter-spacing:.01em;}',
        TCSS,
        '#cwb.active .cw-lbl{display:none;}',
        '#cwb.active{width:52px;padding:0;justify-content:center;border-radius:50%;}'
      ].join(''),
      html: '<button id="cwb" aria-label="Chat with us">'
          + '<span class="cw-op">'+ic.chat+'</span>'
          + '<span class="cw-lbl">Chat</span>'
          + closeBtn()+'</button>',
      ir:'16px', ib:'84px', il:'20px'
    },

    // 1 — Minimal clean circle
    {
      css: [
        '#cwb{position:fixed;bottom:24px;left:24px;width:56px;height:56px;border-radius:50%;',
        'background:'+T.grad+';border:none;cursor:pointer;box-shadow:0 2px 12px '+T.shadow+';',
        'display:flex;align-items:center;justify-content:center;z-index:9999;',
        'transition:transform .18s,box-shadow .18s;}',
        '#cwb:hover{transform:translateY(-3px);box-shadow:0 8px 22px '+T.shadowHov+';}',
        TCSS
      ].join(''),
      html: '<button id="cwb" aria-label="Chat with us">'
          + '<span class="cw-op">'+ic.msg+'</span>'
          + closeBtn()+'</button>',
      ir:'20px', ib:'94px', il:'24px'
    },

    // 2 — Rounded square with live green dot
    {
      css: [
        '#cwb{position:fixed;bottom:20px;left:20px;width:58px;height:58px;border-radius:18px;',
        'background:'+T.grad+';border:none;cursor:pointer;box-shadow:0 4px 16px '+T.shadow+';',
        'display:flex;align-items:center;justify-content:center;z-index:9999;',
        'transition:transform .2s,box-shadow .2s;position:relative;}',
        '#cwb:hover{transform:scale(1.08);box-shadow:0 8px 24px '+T.shadowHov+';}',
        '#cwb .cw-dot{position:absolute;top:9px;right:9px;width:11px;height:11px;',
        'border-radius:50%;background:#a8f09a;border:2.5px solid #fff;}',
        TCSS,
        '#cwb.active .cw-dot{display:none;}'
      ].join(''),
      html: '<button id="cwb" aria-label="Chat with us" style="position:relative;">'
          + '<span class="cw-dot"></span>'
          + '<span class="cw-op">'+ic.chat+'</span>'
          + closeBtn()+'</button>',
      ir:'16px', ib:'92px', il:'20px'
    },

    // 3 — Sharp rectangle, UPPERCASE label
    {
      css: [
        '#cwb{position:fixed;bottom:20px;left:20px;height:46px;border-radius:3px;',
        'background:'+T.grad+';border:none;cursor:pointer;box-shadow:0 3px 10px '+T.shadow+';',
        'display:flex;align-items:center;gap:9px;padding:0 18px;z-index:9999;',
        'transition:transform .15s,box-shadow .15s;',
        'font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;}',
        '#cwb:hover{transform:translateY(-1px);box-shadow:0 6px 18px '+T.shadowHov+';}',
        '#cwb .cw-lbl{color:#fff;font-size:12px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;}',
        TCSS,
        '#cwb.active .cw-lbl{display:none;}',
        '#cwb.active{width:46px;padding:0;justify-content:center;}'
      ].join(''),
      html: '<button id="cwb" aria-label="Chat with us">'
          + '<span class="cw-op">'+ic.bubble+'</span>'
          + '<span class="cw-lbl">Support</span>'
          + closeBtn()+'</button>',
      ir:'3px', ib:'80px', il:'20px'
    },

    // 4 — Circle with animated pulse ring
    {
      css: [
        '@keyframes cw-pulse{0%{transform:scale(1);opacity:.55}100%{transform:scale(1.75);opacity:0}}',
        '#cwb{position:fixed;bottom:24px;left:24px;width:54px;height:54px;border-radius:50%;',
        'background:'+T.grad+';border:none;cursor:pointer;box-shadow:0 4px 14px '+T.shadow+';',
        'display:flex;align-items:center;justify-content:center;z-index:9999;',
        'transition:transform .2s,box-shadow .2s;}',
        '#cwb::before{content:"";position:absolute;inset:0;border-radius:50%;background:'+T.primary+';',
        'animation:cw-pulse 2s ease-out infinite;pointer-events:none;}',
        '#cwb:hover{transform:scale(1.08);box-shadow:0 6px 20px '+T.shadowHov+';}',
        TCSS,
        '#cwb.active::before{display:none;}'
      ].join(''),
      html: '<button id="cwb" aria-label="Chat with us">'
          + '<span class="cw-op">'+ic.chat+'</span>'
          + closeBtn()+'</button>',
      ir:'20px', ib:'94px', il:'24px'
    },

    // 5 — Side tab attached to left edge
    {
      css: [
        '#cwb{position:fixed;bottom:140px;left:0;height:44px;border-radius:0 10px 10px 0;',
        'background:'+T.grad+';border:none;cursor:pointer;box-shadow:3px 2px 14px '+T.shadow+';',
        'display:flex;align-items:center;gap:7px;padding:0 16px 0 12px;z-index:9999;',
        'transition:transform .2s,box-shadow .2s;',
        'font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;}',
        '#cwb:hover{transform:translateX(4px);box-shadow:5px 4px 18px '+T.shadowHov+';}',
        '#cwb .cw-lbl{color:#fff;font-size:13px;font-weight:700;letter-spacing:.04em;}',
        TCSS,
        '#cwb.active .cw-lbl{display:none;}'
      ].join(''),
      html: '<button id="cwb" aria-label="Chat with us">'
          + '<span class="cw-op">'+ic.bubble+'</span>'
          + '<span class="cw-lbl">Help</span>'
          + closeBtn()+'</button>',
      ir:'12px', ib:'50px', il:'10px'
    },

    // 6 — Card: "Need help?" + "We're online" subtitle
    {
      css: [
        '#cwb{position:fixed;bottom:20px;left:20px;height:54px;border-radius:14px;',
        'background:'+T.grad+';border:none;cursor:pointer;box-shadow:0 4px 20px '+T.shadow+';',
        'display:flex;align-items:center;gap:10px;padding:0 18px 0 14px;z-index:9999;',
        'transition:transform .2s,box-shadow .2s;',
        'font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;}',
        '#cwb:hover{transform:translateY(-2px);box-shadow:0 10px 28px '+T.shadowHov+';}',
        '#cwb .cw-txt{display:flex;flex-direction:column;align-items:flex-start;}',
        '#cwb .cw-lbl{color:#fff;font-size:14px;font-weight:700;line-height:1.2;}',
        '#cwb .cw-sub{color:rgba(255,255,255,.78);font-size:11px;display:flex;align-items:center;gap:4px;}',
        '#cwb .cw-sub::before{content:"";display:inline-block;width:6px;height:6px;border-radius:50%;background:#a8f09a;}',
        TCSS,
        '#cwb.active .cw-txt{display:none;}',
        '#cwb.active{width:54px;height:54px;padding:0;justify-content:center;border-radius:50%;}'
      ].join(''),
      html: '<button id="cwb" aria-label="Chat with us">'
          + '<span class="cw-op">'+ic.msg+'</span>'
          + '<span class="cw-txt">'
          + '<span class="cw-lbl">Need help?</span>'
          + '<span class="cw-sub">We\'re online</span>'
          + '</span>'
          + closeBtn()+'</button>',
      ir:'14px', ib:'88px', il:'20px'
    },

    // 7 — Avatar initials + "Chat with us"
    {
      css: [
        '#cwb{position:fixed;bottom:20px;left:20px;height:54px;border-radius:27px;',
        'background:'+T.grad+';border:none;cursor:pointer;box-shadow:0 4px 16px '+T.shadow+';',
        'display:flex;align-items:center;padding:0 20px 0 5px;z-index:9999;',
        'transition:transform .2s,box-shadow .2s,width .2s,padding .2s;',
        'font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;}',
        '#cwb:hover{transform:scale(1.03);box-shadow:0 6px 22px '+T.shadowHov+';}',
        '#cwb .cw-av{width:44px;height:44px;border-radius:50%;',
        'background:rgba(255,255,255,.22);border:2px solid rgba(255,255,255,.38);',
        'display:flex;align-items:center;justify-content:center;',
        'font-size:14px;font-weight:800;color:#fff;margin-right:10px;flex-shrink:0;}',
        '#cwb .cw-lbl{color:#fff;font-size:14px;font-weight:700;white-space:nowrap;}',
        TCSS,
        '#cwb.active .cw-av{display:none;}',
        '#cwb.active .cw-lbl{display:none;}',
        '#cwb.active{width:54px;padding:0;justify-content:center;border-radius:50%;}'
      ].join(''),
      html: '<button id="cwb" aria-label="Chat with us">'
          + '<span class="cw-op" style="display:flex;align-items:center;">'
          + '<span class="cw-av">CS</span>'
          + '<span class="cw-lbl">Chat with us</span>'
          + '</span>'
          + closeBtn()+'</button>',
      ir:'16px', ib:'88px', il:'20px'
    },

    // 8 — Vertical stacked (icon top, label bottom)
    {
      css: [
        '#cwb{position:fixed;bottom:20px;left:20px;width:60px;height:62px;border-radius:14px;',
        'background:'+T.grad+';border:none;cursor:pointer;box-shadow:0 4px 16px '+T.shadow+';',
        'display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;',
        'padding:0;z-index:9999;transition:transform .2s,box-shadow .2s;',
        'font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;}',
        '#cwb:hover{transform:translateY(-3px);box-shadow:0 8px 22px '+T.shadowHov+';}',
        '#cwb .cw-lbl{color:#fff;font-size:10px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;line-height:1;}',
        TCSS,
        '#cwb.active .cw-lbl{display:none;}',
        '#cwb.active{width:54px;height:54px;border-radius:50%;}'
      ].join(''),
      html: '<button id="cwb" aria-label="Chat with us">'
          + '<span class="cw-op">'+ic.chatO+'</span>'
          + '<span class="cw-lbl">Chat</span>'
          + closeBtn()+'</button>',
      ir:'14px', ib:'96px', il:'20px'
    },

    // 9 — Glassmorphism frosted pill
    {
      css: [
        '#cwb{position:fixed;bottom:20px;left:20px;height:52px;border-radius:26px;',
        'background:'+hexToRgba(T.primary, 0.18)+';',
        'backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);',
        'border:1.5px solid '+hexToRgba(T.primary, 0.55)+';',
        'cursor:pointer;',
        'box-shadow:0 4px 20px '+T.shadow+',inset 0 1px 0 rgba(255,255,255,.25);',
        'display:flex;align-items:center;gap:8px;padding:0 20px 0 14px;z-index:9999;',
        'transition:transform .2s,box-shadow .2s,background .2s;',
        'font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;}',
        '#cwb:hover{transform:scale(1.04);background:'+hexToRgba(T.primary, 0.3)+';box-shadow:0 6px 24px '+T.shadowHov+';}',
        '#cwb .cw-lbl{color:#fff;font-size:15px;font-weight:700;text-shadow:0 1px 4px rgba(0,0,0,.3);}',
        TCSS,
        '#cwb.active .cw-lbl{display:none;}',
        '#cwb.active{width:52px;padding:0;justify-content:center;border-radius:50%;',
        'background:'+T.grad+';border-color:transparent;}'
      ].join(''),
      html: '<button id="cwb" aria-label="Chat with us">'
          + '<span class="cw-op">'+ic.chat+'</span>'
          + '<span class="cw-lbl">Chat</span>'
          + closeBtn()+'</button>',
      ir:'16px', ib:'84px', il:'20px'
    }

  ];

  // ── Pick style ────────────────────────────────────────────
  var idx = getIdx(STORE_ID);
  var S = STYLES[idx];

  if (!S) {
    console.error('[ChatWidget] Style index out of range:', idx);
    S = STYLES[0];
  }

  // ── Build widget ──────────────────────────────────────────
  var wc = document.createElement('div');
  wc.id = 'chat-support-widget';

  var iframeCSS = [
    '#chat-widget-iframe{',
    'position:fixed;bottom:'+S.ib+';left:'+S.il+';',
    'width:380px;height:560px;border:none;',
    'border-radius:'+S.ir+';',
    'box-shadow:0 8px 30px rgba(0,0,0,.15);',
    'z-index:9998;display:none;opacity:0;',
    'transform:translateY(10px) scale(.98);',
    'transition:opacity .25s ease,transform .25s ease;}',
    '#chat-widget-iframe.open{display:block;opacity:1;transform:translateY(0) scale(1);}',
    '@media(max-width:480px){',
    '#chat-widget-iframe,#chat-widget-iframe.open{',
    'width:100vw;height:100vh;bottom:0;left:0;border-radius:0;transform:none;}',
    '#cwb.active{bottom:16px!important;left:16px!important;z-index:10000;',
    'background:rgba(0,0,0,.5)!important;box-shadow:none!important;border:none!important;}}'
  ].join('');

  wc.innerHTML = '<style>'+S.css+iframeCSS+'</style>'
    + S.html
    + '<iframe id="chat-widget-iframe" src="'+iframeSrc+'" allow="clipboard-write"></iframe>';

  document.body.appendChild(wc);

  // ── Toggle ────────────────────────────────────────────────
  var btn   = document.getElementById('cwb');
  var frame = document.getElementById('chat-widget-iframe');

  if (!btn || !frame) {
    console.error('[ChatWidget] Could not find button or iframe elements');
    return;
  }

  var isOpen = false;

  btn.addEventListener('click', function() {
    isOpen = !isOpen;
    if (isOpen) {
      frame.style.display = 'block';
      requestAnimationFrame(function() { frame.classList.add('open'); });
      btn.classList.add('active');
    } else {
      frame.classList.remove('open');
      btn.classList.remove('active');
      setTimeout(function() { if (!isOpen) frame.style.display = 'none'; }, 250);
    }
  });

  var names = ['Pill','Circle','Square+Dot','Sharp','Pulse','SideTab','Card','Avatar','Stacked','Glass'];
  console.log('[ChatWidget] Loaded | Style '+(idx+1)+': '+names[idx]+' | Store: '+STORE_ID);

})();