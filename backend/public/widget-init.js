
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

  var config   = window.ChatSupportConfig;
  var API_URL  = config.apiUrl || 'http://localhost:3000';
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
  // Store 1→style0, 2→style1 ... 10→style9, 11→style0 ...
  function getIdx(id) {
    if (!id) return 0;
    var n = parseInt(id, 10);
    if (!isNaN(n) && String(n) === String(id) && n > 0) return (n-1) % 10;
    return hashString(String(id)) % 10;
  }

  // ── Color system ──────────────────────────────────────────
  var T = {
    primary:   '#3bbe28',
    dark:      '#2fa01e',
    light:     '#4cd938',
    shadow:    'rgba(59,190,40,0.35)',
    shadowHov: 'rgba(59,190,40,0.55)',
    grad:      'linear-gradient(135deg,#2fa01e,#4cd938)'
  };

  if (config.themeColors && config.themeColors.primary) {
    var cp = config.themeColors.primary;
    var cd = config.themeColors.dark  || cp;
    var cl = config.themeColors.light || cp;
    T.primary   = cp;
    T.dark      = cd;
    T.light     = cl;
    T.shadow    = hexToRgba(cp, 0.35);
    T.shadowHov = hexToRgba(cp, 0.55);
    T.grad      = 'linear-gradient(135deg,'+cd+','+cl+')';
    console.log('[ChatWidget] Shopify color: '+cp+' | Store: '+STORE_ID);
  } else {
    console.log('[ChatWidget] Green fallback | Store: '+STORE_ID);
  }

  // ── iframe src ────────────────────────────────────────────
  var iframeSrc = API_URL+'/widget.html?store='+encodeURIComponent(STORE_ID);
  if (config.themeColors && config.themeColors.primary) {
    iframeSrc += '&primary='+encodeURIComponent(T.primary)
               + '&dark='+encodeURIComponent(T.dark)
               + '&light='+encodeURIComponent(T.light);
  }

  // ── Icons ─────────────────────────────────────────────────
  var ic = {
    // chat bubbles with colored dots
    chat: '<svg width="22" height="22" viewBox="0 0 24 24" fill="white"><path d="M2 6C2 4.9 2.9 4 4 4H20C21.1 4 22 4.9 22 6V16C22 17.1 21.1 18 20 18H6L2 22V6Z"/>'
        + '<circle cx="8" cy="11.5" r="1.25" fill="'+T.primary+'"/>'
        + '<circle cx="12" cy="11.5" r="1.25" fill="'+T.primary+'"/>'
        + '<circle cx="16" cy="11.5" r="1.25" fill="'+T.primary+'"/></svg>',
    // chat bubbles with white dots
    chatW: '<svg width="22" height="22" viewBox="0 0 24 24" fill="white"><path d="M2 6C2 4.9 2.9 4 4 4H20C21.1 4 22 4.9 22 6V16C22 17.1 21.1 18 20 18H6L2 22V6Z"/>'
         + '<circle cx="8" cy="11.5" r="1.25" fill="rgba(255,255,255,0.5)"/>'
         + '<circle cx="12" cy="11.5" r="1.25" fill="rgba(255,255,255,0.5)"/>'
         + '<circle cx="16" cy="11.5" r="1.25" fill="rgba(255,255,255,0.5)"/></svg>',
    // speech bubble outline
    msg: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">'
       + '<path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>',
    // close X
    close: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round">'
         + '<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>',
    // close X dark (for light background buttons)
    closeDark: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#333" stroke-width="2.5" stroke-linecap="round">'
             + '<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>'
  };

  // Shared toggle CSS
  var TCSS = '#cwb .cw-cl{display:none;}#cwb.active .cw-op{display:none;}#cwb.active .cw-cl{display:flex;}';
  // Font family
  var FF = 'font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;';

  function closeBtn(dark) {
    return '<span class="cw-cl" style="display:flex;align-items:center;justify-content:center;">'
         + (dark ? ic.closeDark : ic.close)
         + '</span>';
  }

  // ── 10 Button Styles — all at bottom:24px left:24px ───────
  var STYLES = [

    // 0 — Elevated pill with shimmer top edge
    {
      css: [
        '#cwb{position:fixed;bottom:24px;left:24px;height:54px;border-radius:27px;',
        'background:'+T.grad+';border:none;cursor:pointer;',
        'box-shadow:0 6px 20px '+T.shadow+',0 1px 0 rgba(255,255,255,.28) inset;',
        'display:flex;align-items:center;gap:9px;padding:0 22px 0 14px;z-index:9999;',
        'transition:transform .2s,box-shadow .2s,width .2s,border-radius .2s,padding .2s;'+FF+'}',
        '#cwb:hover{transform:translateY(-2px);box-shadow:0 10px 28px '+T.shadowHov+',0 1px 0 rgba(255,255,255,.28) inset;}',
        '#cwb:active{transform:translateY(0);}',
        '#cwb .cw-lbl{color:#fff;font-size:15px;font-weight:700;letter-spacing:.01em;line-height:1;}',
        TCSS,
        '#cwb.active .cw-lbl{display:none;}',
        '#cwb.active{width:54px;padding:0;justify-content:center;border-radius:50%;}'
      ].join(''),
      html: '<button id="cwb" aria-label="Chat with us">'
          + '<span class="cw-op" style="display:flex;align-items:center;gap:9px;">'
          + ic.chat+'<span class="cw-lbl">Chat</span></span>'
          + closeBtn()+'</button>'
    },

    // 1 — Clean circle with layered shadows
    {
      css: [
        '#cwb{position:fixed;bottom:24px;left:24px;width:58px;height:58px;border-radius:50%;',
        'background:'+T.grad+';border:none;cursor:pointer;',
        'box-shadow:0 4px 6px '+hexToRgba(T.dark,0.25)+',0 8px 24px '+T.shadow+',0 1px 0 rgba(255,255,255,.2) inset;',
        'display:flex;align-items:center;justify-content:center;z-index:9999;',
        'transition:transform .18s cubic-bezier(.34,1.56,.64,1),box-shadow .18s;}',
        '#cwb:hover{transform:scale(1.1);',
        'box-shadow:0 6px 10px '+hexToRgba(T.dark,0.3)+',0 12px 32px '+T.shadowHov+',0 1px 0 rgba(255,255,255,.2) inset;}',
        '#cwb:active{transform:scale(.96);}',
        TCSS
      ].join(''),
      html: '<button id="cwb" aria-label="Chat with us">'
          + '<span class="cw-op">'+ic.msg+'</span>'
          + closeBtn()+'</button>'
    },

   // 2 — Floating pill with label
    {
      css: [
        '#cwb{position:fixed;bottom:24px;left:24px;height:52px;border-radius:26px;',
        'background:'+T.grad+';border:none;cursor:pointer;',
        'box-shadow:0 6px 18px '+T.shadow+',0 1px 0 rgba(255,255,255,.25) inset;',
        'display:flex;align-items:center;gap:9px;padding:0 20px 0 14px;z-index:9999;',
        'transition:transform .2s,box-shadow .2s,width .2s,border-radius .2s,padding .2s;'+FF+'}',
        '#cwb:hover{transform:translateY(-2px);box-shadow:0 10px 26px '+T.shadowHov+';}',
        '#cwb:active{transform:translateY(0);}',
        '#cwb .cw-lbl{color:#fff;font-size:15px;font-weight:700;letter-spacing:.01em;}',
        TCSS,
        '#cwb.active .cw-lbl{display:none;}',
        '#cwb.active{width:52px;padding:0;justify-content:center;border-radius:50%;}'
      ].join(''),
      html: '<button id="cwb" aria-label="Chat with us">'
          + '<span class="cw-op" style="display:flex;align-items:center;gap:9px;">'
          + ic.chat+'<span class="cw-lbl">Chat</span></span>'
          + closeBtn()+'</button>'
    },

    // 3 — White pill with colored left icon block
    {
      css: [
        '#cwb{position:fixed;bottom:24px;left:24px;height:54px;border-radius:27px;',
        'background:#fff;border:none;cursor:pointer;overflow:hidden;',
        'box-shadow:0 6px 22px rgba(0,0,0,.12),0 2px 6px rgba(0,0,0,.08);',
        'display:flex;align-items:center;padding:0 20px 0 0;z-index:9999;',
        'transition:transform .2s,box-shadow .2s,width .2s,padding .2s,border-radius .2s;'+FF+'}',
        '#cwb:hover{transform:translateY(-2px);box-shadow:0 10px 30px rgba(0,0,0,.15);}',
        '#cwb:active{transform:translateY(0);}',
        '#cwb .cw-bar{width:54px;height:54px;background:'+T.grad+';flex-shrink:0;',
        'display:flex;align-items:center;justify-content:center;}',
        '#cwb .cw-lbl{color:#111827;font-size:14px;font-weight:700;padding-left:14px;white-space:nowrap;letter-spacing:.01em;}',
        TCSS,
        '#cwb.active{width:54px;padding:0;border-radius:50%;background:'+T.grad+';overflow:visible;}',
        '#cwb.active .cw-bar{display:none;}',
        '#cwb.active .cw-lbl{display:none;}'
      ].join(''),
      html: '<button id="cwb" aria-label="Chat with us">'
          + '<span class="cw-op" style="display:flex;align-items:center;width:100%;">'
          + '<span class="cw-bar">'+ic.chatW+'</span>'
          + '<span class="cw-lbl">Chat with us</span>'
          + '</span>'
          + closeBtn()+'</button>'
    },

    // 4 — Double pulse ring circle
    {
      css: [
        '@keyframes cw-ring{0%{transform:scale(1);opacity:.6}100%{transform:scale(1.9);opacity:0}}',
        '#cwb{position:fixed;bottom:24px;left:24px;width:56px;height:56px;border-radius:50%;',
        'background:'+T.grad+';border:none;cursor:pointer;',
        'box-shadow:0 4px 16px '+T.shadow+';',
        'display:flex;align-items:center;justify-content:center;z-index:9999;',
        'transition:transform .2s,box-shadow .2s;}',
        '#cwb::before,#cwb::after{content:"";position:absolute;inset:0;border-radius:50%;',
        'background:'+T.primary+';pointer-events:none;}',
        '#cwb::before{animation:cw-ring 2.2s ease-out infinite;}',
        '#cwb::after{animation:cw-ring 2.2s ease-out infinite .8s;}',
        '#cwb:hover{transform:scale(1.1);box-shadow:0 6px 22px '+T.shadowHov+';}',
        '#cwb:active{transform:scale(.96);}',
        TCSS,
        '#cwb.active::before,#cwb.active::after{display:none;}'
      ].join(''),
      html: '<button id="cwb" aria-label="Chat with us">'
          + '<span class="cw-op">'+ic.chat+'</span>'
          + closeBtn()+'</button>'
    },

    // 5 — Outlined ghost pill
    {
      css: [
        '#cwb{position:fixed;bottom:24px;left:24px;height:52px;border-radius:26px;',
        'background:rgba(255,255,255,.08);',
        'border:2px solid '+T.primary+';cursor:pointer;',
        'box-shadow:0 4px 16px '+T.shadow+';',
        'display:flex;align-items:center;gap:10px;padding:0 20px 0 10px;z-index:9999;',
        'transition:transform .2s,box-shadow .2s,background .2s,width .2s,border-radius .2s,padding .2s;'+FF+'}',
        '#cwb:hover{transform:scale(1.03);background:'+hexToRgba(T.primary,.1)+';',
        'box-shadow:0 6px 20px '+T.shadowHov+',0 0 0 4px '+hexToRgba(T.primary,.15)+';}',
        '#cwb:active{transform:scale(.98);}',
        '#cwb .cw-ic{width:34px;height:34px;border-radius:50%;background:'+T.grad+';',
        'display:flex;align-items:center;justify-content:center;flex-shrink:0;',
        'box-shadow:0 2px 6px '+T.shadow+';}',
        '#cwb .cw-lbl{color:'+T.primary+';font-size:14px;font-weight:700;letter-spacing:.01em;}',
        TCSS,
        '#cwb.active .cw-ic{display:none;}',
        '#cwb.active .cw-lbl{display:none;}',
        '#cwb.active{width:52px;padding:0;justify-content:center;',
        'background:'+T.grad+';border-color:transparent;}'
      ].join(''),
      html: '<button id="cwb" aria-label="Chat with us">'
          + '<span class="cw-op" style="display:flex;align-items:center;gap:10px;">'
          + '<span class="cw-ic">'+ic.chatW+'</span>'
          + '<span class="cw-lbl">Chat</span>'
          + '</span>'
          + closeBtn()+'</button>'
    },

    // 6 — Card with icon box + label
    {
      css: [
        '#cwb{position:fixed;bottom:24px;left:24px;height:56px;border-radius:16px;',
        'background:'+T.grad+';border:none;cursor:pointer;',
        'box-shadow:0 6px 22px '+T.shadow+',0 1px 0 rgba(255,255,255,.25) inset;',
        'display:flex;align-items:center;gap:12px;padding:0 20px 0 12px;z-index:9999;',
        'transition:transform .2s,box-shadow .2s,width .2s,padding .2s,border-radius .2s;'+FF+'}',
        '#cwb:hover{transform:translateY(-3px);box-shadow:0 12px 30px '+T.shadowHov+';}',
        '#cwb:active{transform:translateY(0);}',
        '#cwb .cw-ic{width:36px;height:36px;border-radius:10px;',
        'background:rgba(255,255,255,.2);border:1px solid rgba(255,255,255,.3);',
        'display:flex;align-items:center;justify-content:center;flex-shrink:0;}',
        '#cwb .cw-lbl{color:#fff;font-size:15px;font-weight:700;letter-spacing:.01em;}',
        TCSS,
        '#cwb.active .cw-ic{display:none;}',
        '#cwb.active .cw-lbl{display:none;}',
        '#cwb.active{width:56px;height:56px;padding:0;justify-content:center;border-radius:50%;}'
      ].join(''),
      html: '<button id="cwb" aria-label="Chat with us">'
          + '<span class="cw-op" style="display:flex;align-items:center;gap:12px;">'
          + '<span class="cw-ic">'+ic.msg+'</span>'
          + '<span class="cw-lbl">Need help?</span>'
          + '</span>'
          + closeBtn()+'</button>'
    },

    // 7 — Avatar initials + name pill
    {
      css: [
        '#cwb{position:fixed;bottom:24px;left:24px;height:56px;border-radius:28px;',
        'background:'+T.grad+';border:none;cursor:pointer;',
        'box-shadow:0 6px 20px '+T.shadow+',0 1px 0 rgba(255,255,255,.22) inset;',
        'display:flex;align-items:center;padding:0 22px 0 6px;z-index:9999;',
        'transition:transform .2s,box-shadow .2s,width .2s,padding .2s;'+FF+'}',
        '#cwb:hover{transform:translateY(-2px);box-shadow:0 10px 28px '+T.shadowHov+';}',
        '#cwb:active{transform:translateY(0);}',
        '#cwb .cw-av{width:44px;height:44px;border-radius:50%;',
        'background:rgba(255,255,255,.25);border:2px solid rgba(255,255,255,.45);',
        'display:flex;align-items:center;justify-content:center;',
        'font-size:15px;font-weight:800;color:#fff;margin-right:11px;flex-shrink:0;',
        'text-shadow:0 1px 3px rgba(0,0,0,.2);}',
        '#cwb .cw-lbl{color:#fff;font-size:14px;font-weight:700;white-space:nowrap;letter-spacing:.01em;}',
        TCSS,
        '#cwb.active .cw-av{display:none;}',
        '#cwb.active .cw-lbl{display:none;}',
        '#cwb.active{width:56px;padding:0;justify-content:center;border-radius:50%;}'
      ].join(''),
      html: '<button id="cwb" aria-label="Chat with us">'
          + '<span class="cw-op" style="display:flex;align-items:center;">'
          + '<span class="cw-av">CS</span>'
          + '<span class="cw-lbl">Chat with us</span>'
          + '</span>'
          + closeBtn()+'</button>'
    },

    // 8 — Vertical stacked FAB
    {
      css: [
        '#cwb{position:fixed;bottom:24px;left:24px;width:62px;height:64px;border-radius:18px;',
        'background:'+T.grad+';border:none;cursor:pointer;',
        'box-shadow:0 6px 20px '+T.shadow+',0 1px 0 rgba(255,255,255,.22) inset;',
        'display:flex;flex-direction:column;align-items:center;justify-content:center;gap:5px;',
        'padding:0;z-index:9999;transition:transform .2s,box-shadow .2s,border-radius .2s,width .2s,height .2s;'+FF+'}',
        '#cwb:hover{transform:translateY(-3px);box-shadow:0 10px 26px '+T.shadowHov+';border-radius:22px;}',
        '#cwb:active{transform:translateY(0);}',
        '#cwb .cw-lbl{color:#fff;font-size:9px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;line-height:1;}',
        TCSS,
        '#cwb.active .cw-lbl{display:none;}',
        '#cwb.active{border-radius:50%;width:56px;height:56px;}'
      ].join(''),
      html: '<button id="cwb" aria-label="Chat with us">'
          + '<span class="cw-op" style="display:flex;flex-direction:column;align-items:center;gap:5px;">'
          + ic.chatW+'<span class="cw-lbl">Chat</span></span>'
          + closeBtn()+'</button>'
    },

    // 9 — Split pill: frosted icon circle + divider + label
    {
      css: [
        '#cwb{position:fixed;bottom:24px;left:24px;height:54px;border-radius:27px;',
        'background:'+T.grad+';border:none;cursor:pointer;',
        'box-shadow:0 6px 20px '+T.shadow+',0 1px 0 rgba(255,255,255,.25) inset;',
        'display:flex;align-items:center;padding:0 20px 0 6px;z-index:9999;',
        'transition:transform .2s,box-shadow .2s,width .2s,padding .2s,border-radius .2s;'+FF+'}',
        '#cwb:hover{transform:translateY(-2px);box-shadow:0 10px 28px '+T.shadowHov+';}',
        '#cwb:active{transform:translateY(0);}',
        '#cwb .cw-ic{width:42px;height:42px;border-radius:50%;',
        'background:rgba(255,255,255,.2);border:1.5px solid rgba(255,255,255,.35);',
        'display:flex;align-items:center;justify-content:center;flex-shrink:0;}',
        '#cwb .cw-div{width:1px;height:24px;background:rgba(255,255,255,.3);margin:0 14px;flex-shrink:0;}',
        '#cwb .cw-lbl{color:#fff;font-size:14px;font-weight:700;letter-spacing:.01em;white-space:nowrap;}',
        TCSS,
        '#cwb.active .cw-ic{display:none;}',
        '#cwb.active .cw-div{display:none;}',
        '#cwb.active .cw-lbl{display:none;}',
        '#cwb.active{width:54px;padding:0;justify-content:center;border-radius:50%;}'
      ].join(''),
      html: '<button id="cwb" aria-label="Chat with us">'
          + '<span class="cw-op" style="display:flex;align-items:center;">'
          + '<span class="cw-ic">'+ic.chatW+'</span>'
          + '<span class="cw-div"></span>'
          + '<span class="cw-lbl">Chat</span>'
          + '</span>'
          + closeBtn()+'</button>'
    }

  ];

  // ── Pick style by store index ─────────────────────────────
  var idx = getIdx(STORE_ID);
  var S = STYLES[idx] || STYLES[0];

  // ── Build widget ──────────────────────────────────────────
  var wc = document.createElement('div');
  wc.id = 'chat-support-widget';

  // Iframe always at same position regardless of button style
  var iframeCSS = [
    '#chat-widget-iframe{',
    'position:fixed;bottom:90px;left:24px;',
    'width:380px;height:560px;border:none;border-radius:16px;',
    'box-shadow:0 12px 40px rgba(0,0,0,.18),0 4px 12px rgba(0,0,0,.1);',
    'z-index:9998;display:none;opacity:0;',
    'transform:translateY(12px) scale(.97);',
    'transition:opacity .28s cubic-bezier(.4,0,.2,1),transform .28s cubic-bezier(.4,0,.2,1);}',
    '#chat-widget-iframe.open{display:block;opacity:1;transform:translateY(0) scale(1);}',
    '@media(max-width:480px){',
    '#chat-widget-iframe,#chat-widget-iframe.open{',
    'width:100vw;height:100vh;bottom:0;left:0;border-radius:0;transform:none;}',
    '#cwb.active{bottom:16px!important;left:16px!important;z-index:10000;',
    'background:rgba(0,0,0,.55)!important;box-shadow:none!important;border:none!important;}}'
  ].join('');

  wc.innerHTML = '<style>'+S.css+iframeCSS+'</style>'
    + S.html
    + '<iframe id="chat-widget-iframe" src="'+iframeSrc+'" allow="clipboard-write"></iframe>';

  document.body.appendChild(wc);

  // ── Toggle ────────────────────────────────────────────────
  var btn   = document.getElementById('cwb');
  var frame = document.getElementById('chat-widget-iframe');

  if (!btn || !frame) {
    console.error('[ChatWidget] Elements not found');
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
      setTimeout(function() { if (!isOpen) frame.style.display = 'none'; }, 280);
    }
  });

  var names = ['ElevatedPill','SoftCircle','BadgePill','WhitePill','DoublePulse','GhostPill','IconCard','AvatarPill','StackedFAB','SplitPill'];
  console.log('[ChatWidget] Style '+(idx+1)+': '+names[idx]+' | Store: '+STORE_ID);

})();