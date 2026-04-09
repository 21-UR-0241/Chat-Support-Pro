
// (function() {
//   'use strict';

//   if (!window.ChatSupportConfig) {
//     console.error('[ChatWidget] ChatSupportConfig not found.');
//     return;
//   }

//   var config   = window.ChatSupportConfig;
//   var API_URL  = config.apiUrl || 'http://localhost:3000';
//   var STORE_ID = config.storeId;

//   if (!STORE_ID) {
//     console.error('[ChatWidget] storeId is required');
//     return;
//   }

//   // ── Utilities ─────────────────────────────────────────────
//   function hexToRgba(hex, alpha) {
//     hex = hex.replace('#', '');
//     if (hex.length === 3) hex = hex[0]+hex[0]+hex[1]+hex[1]+hex[2]+hex[2];
//     var r = parseInt(hex.slice(0,2), 16);
//     var g = parseInt(hex.slice(2,4), 16);
//     var b = parseInt(hex.slice(4,6), 16);
//     return 'rgba('+r+','+g+','+b+','+alpha+')';
//   }
//   function hashString(s) {
//     var h = 5381;
//     for (var i = 0; i < s.length; i++) { h = ((h<<5)+h)+s.charCodeAt(i); h|=0; }
//     return Math.abs(h);
//   }
//   function getIdx(id) {
//     if (!id) return 0;
//     var n = parseInt(id, 10);
//     if (!isNaN(n) && String(n) === String(id) && n > 0) return (n-1) % 10;
//     return hashString(String(id)) % 10;
//   }

//   // ── Color system ──────────────────────────────────────────
//   var T = {
//     primary:   '#3bbe28',
//     dark:      '#2fa01e',
//     light:     '#4cd938',
//     shadow:    'rgba(59,190,40,0.35)',
//     shadowHov: 'rgba(59,190,40,0.55)',
//     grad:      'linear-gradient(135deg,#2fa01e,#4cd938)'
//   };

//   if (config.themeColors && config.themeColors.primary) {
//     var cp = config.themeColors.primary;
//     var cd = config.themeColors.dark  || cp;
//     var cl = config.themeColors.light || cp;
//     T.primary   = cp;
//     T.dark      = cd;
//     T.light     = cl;
//     T.shadow    = hexToRgba(cp, 0.35);
//     T.shadowHov = hexToRgba(cp, 0.55);
//     T.grad      = 'linear-gradient(135deg,'+cd+','+cl+')';
//     console.log('[ChatWidget] Shopify color: '+cp+' | Store: '+STORE_ID);
//   } else {
//     console.log('[ChatWidget] Green fallback | Store: '+STORE_ID);
//   }

//   // ── iframe src ────────────────────────────────────────────
//   var iframeSrc = API_URL+'/widget.html?store='+encodeURIComponent(STORE_ID);
//   if (config.themeColors && config.themeColors.primary) {
//     iframeSrc += '&primary='+encodeURIComponent(T.primary)
//                + '&dark='+encodeURIComponent(T.dark)
//                + '&light='+encodeURIComponent(T.light);
//   }

//   // ── Icons ─────────────────────────────────────────────────
//   var ic = {
//     chat: '<svg width="22" height="22" viewBox="0 0 24 24" fill="white"><path d="M2 6C2 4.9 2.9 4 4 4H20C21.1 4 22 4.9 22 6V16C22 17.1 21.1 18 20 18H6L2 22V6Z"/>'
//         + '<circle cx="8" cy="11.5" r="1.25" fill="'+T.primary+'"/>'
//         + '<circle cx="12" cy="11.5" r="1.25" fill="'+T.primary+'"/>'
//         + '<circle cx="16" cy="11.5" r="1.25" fill="'+T.primary+'"/></svg>',

//     chatW: '<svg width="22" height="22" viewBox="0 0 24 24" fill="white"><path d="M2 6C2 4.9 2.9 4 4 4H20C21.1 4 22 4.9 22 6V16C22 17.1 21.1 18 20 18H6L2 22V6Z"/>'
//          + '<circle cx="8" cy="11.5" r="1.25" fill="rgba(255,255,255,0.5)"/>'
//          + '<circle cx="12" cy="11.5" r="1.25" fill="rgba(255,255,255,0.5)"/>'
//          + '<circle cx="16" cy="11.5" r="1.25" fill="rgba(255,255,255,0.5)"/></svg>',

//     msg: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">'
//        + '<path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>'
//   };

//   // No X button — toggle is handled by click only
//   var TCSS = '#cwb.active{opacity:.9;}';
//   var FF   = 'font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;';

//   // ── 10 Button Styles — all at bottom:24px left:24px ───────
//   var STYLES = [

//     // 0 — Elevated pill
//     {
//       css: [
//         '#cwb{position:fixed;bottom:24px;left:24px;height:54px;border-radius:27px;',
//         'background:'+T.grad+';border:none;cursor:pointer;',
//         'box-shadow:0 6px 20px '+T.shadow+',0 1px 0 rgba(255,255,255,.28) inset;',
//         'display:flex;align-items:center;gap:9px;padding:0 22px 0 14px;z-index:9999;',
//         'transition:transform .2s,box-shadow .2s;'+FF+'}',
//         '#cwb:hover{transform:translateY(-2px);box-shadow:0 10px 28px '+T.shadowHov+',0 1px 0 rgba(255,255,255,.28) inset;}',
//         '#cwb:active{transform:translateY(0);}',
//         '#cwb .cw-lbl{color:#fff;font-size:15px;font-weight:700;letter-spacing:.01em;line-height:1;}',
//         TCSS
//       ].join(''),
//       html: '<button id="cwb" aria-label="Chat with us">'
//           + '<span style="display:flex;align-items:center;gap:9px;">'
//           + ic.chat+'<span class="cw-lbl">Chat</span></span>'
//           + '</button>'
//     },

//     // 1 — Clean circle with layered shadows
//     {
//       css: [
//         '#cwb{position:fixed;bottom:24px;left:24px;width:58px;height:58px;border-radius:50%;',
//         'background:'+T.grad+';border:none;cursor:pointer;',
//         'box-shadow:0 4px 6px '+hexToRgba(T.dark,0.25)+',0 8px 24px '+T.shadow+',0 1px 0 rgba(255,255,255,.2) inset;',
//         'display:flex;align-items:center;justify-content:center;z-index:9999;',
//         'transition:transform .18s cubic-bezier(.34,1.56,.64,1),box-shadow .18s;}',
//         '#cwb:hover{transform:scale(1.1);',
//         'box-shadow:0 6px 10px '+hexToRgba(T.dark,0.3)+',0 12px 32px '+T.shadowHov+',0 1px 0 rgba(255,255,255,.2) inset;}',
//         '#cwb:active{transform:scale(.96);}',
//         TCSS
//       ].join(''),
//       html: '<button id="cwb" aria-label="Chat with us">'+ic.msg+'</button>'
//     },

//     // 2 — Floating pill with label
//     {
//       css: [
//         '#cwb{position:fixed;bottom:24px;left:24px;height:52px;border-radius:26px;',
//         'background:'+T.grad+';border:none;cursor:pointer;',
//         'box-shadow:0 6px 18px '+T.shadow+',0 1px 0 rgba(255,255,255,.25) inset;',
//         'display:flex;align-items:center;gap:9px;padding:0 20px 0 14px;z-index:9999;',
//         'transition:transform .2s,box-shadow .2s;'+FF+'}',
//         '#cwb:hover{transform:translateY(-2px);box-shadow:0 10px 26px '+T.shadowHov+';}',
//         '#cwb:active{transform:translateY(0);}',
//         '#cwb .cw-lbl{color:#fff;font-size:15px;font-weight:700;letter-spacing:.01em;}',
//         TCSS
//       ].join(''),
//       html: '<button id="cwb" aria-label="Chat with us">'
//           + '<span style="display:flex;align-items:center;gap:9px;">'
//           + ic.chat+'<span class="cw-lbl">Chat</span></span>'
//           + '</button>'
//     },

//     // 3 — White pill with colored left icon block
//     {
//       css: [
//         '#cwb{position:fixed;bottom:24px;left:24px;height:54px;border-radius:27px;',
//         'background:#fff;border:none;cursor:pointer;overflow:hidden;',
//         'box-shadow:0 6px 22px rgba(0,0,0,.12),0 2px 6px rgba(0,0,0,.08);',
//         'display:flex;align-items:center;padding:0 20px 0 0;z-index:9999;',
//         'transition:transform .2s,box-shadow .2s;'+FF+'}',
//         '#cwb:hover{transform:translateY(-2px);box-shadow:0 10px 30px rgba(0,0,0,.15);}',
//         '#cwb:active{transform:translateY(0);}',
//         '#cwb .cw-bar{width:54px;height:54px;background:'+T.grad+';flex-shrink:0;',
//         'display:flex;align-items:center;justify-content:center;}',
//         '#cwb .cw-lbl{color:#111827;font-size:14px;font-weight:700;padding-left:14px;white-space:nowrap;letter-spacing:.01em;}',
//         TCSS
//       ].join(''),
//       html: '<button id="cwb" aria-label="Chat with us">'
//           + '<span style="display:flex;align-items:center;width:100%;">'
//           + '<span class="cw-bar">'+ic.chatW+'</span>'
//           + '<span class="cw-lbl">Chat with us</span>'
//           + '</span>'
//           + '</button>'
//     },

//     // 4 — Double pulse ring circle
//     {
//       css: [
//         '@keyframes cw-ring{0%{transform:scale(1);opacity:.6}100%{transform:scale(1.9);opacity:0}}',
//         '#cwb{position:fixed;bottom:24px;left:24px;width:56px;height:56px;border-radius:50%;',
//         'background:'+T.grad+';border:none;cursor:pointer;',
//         'box-shadow:0 4px 16px '+T.shadow+';',
//         'display:flex;align-items:center;justify-content:center;z-index:9999;',
//         'transition:transform .2s,box-shadow .2s;}',
//         '#cwb::before,#cwb::after{content:"";position:absolute;inset:0;border-radius:50%;',
//         'background:'+T.primary+';pointer-events:none;}',
//         '#cwb::before{animation:cw-ring 2.2s ease-out infinite;}',
//         '#cwb::after{animation:cw-ring 2.2s ease-out infinite .8s;}',
//         '#cwb:hover{transform:scale(1.1);box-shadow:0 6px 22px '+T.shadowHov+';}',
//         '#cwb:active{transform:scale(.96);}',
//         TCSS
//       ].join(''),
//       html: '<button id="cwb" aria-label="Chat with us">'+ic.chat+'</button>'
//     },

    // 5 — Solid pill with frosted icon circle
    // {
    //   css: [
    //     '#cwb{position:fixed;bottom:24px;left:24px;height:52px;border-radius:26px;',
    //     'background:'+T.grad+';border:none;cursor:pointer;',
    //     'box-shadow:0 6px 18px '+T.shadow+',0 1px 0 rgba(255,255,255,.25) inset;',
    //     'display:flex;align-items:center;padding:0 20px 0 6px;z-index:9999;',
    //     'transition:transform .2s,box-shadow .2s;'+FF+'}',
    //     '#cwb:hover{transform:translateY(-2px);box-shadow:0 10px 26px '+T.shadowHov+';}',
    //     '#cwb:active{transform:translateY(0);}',
    //     '#cwb .cw-ic{width:40px;height:40px;border-radius:50%;',
    //     'background:rgba(255,255,255,.22);border:1.5px solid rgba(255,255,255,.35);',
    //     'display:flex;align-items:center;justify-content:center;flex-shrink:0;margin-right:10px;}',
    //     '#cwb .cw-lbl{color:#fff;font-size:14px;font-weight:700;letter-spacing:.01em;}',
    //     TCSS
    //   ].join(''),
    //   html: '<button id="cwb" aria-label="Chat with us">'
    //       + '<span style="display:flex;align-items:center;">'
    //       + '<span class="cw-ic">'+ic.chatW+'</span>'
    //       + '<span class="cw-lbl">Chat</span>'
    //       + '</span>'
    //       + '</button>'
    // },

//     // 6 — Rounded card with icon box + label
//     {
//       css: [
//         '#cwb{position:fixed;bottom:24px;left:24px;height:56px;border-radius:16px;',
//         'background:'+T.grad+';border:none;cursor:pointer;',
//         'box-shadow:0 6px 22px '+T.shadow+',0 1px 0 rgba(255,255,255,.25) inset;',
//         'display:flex;align-items:center;gap:12px;padding:0 20px 0 12px;z-index:9999;',
//         'transition:transform .2s,box-shadow .2s;'+FF+'}',
//         '#cwb:hover{transform:translateY(-3px);box-shadow:0 12px 30px '+T.shadowHov+';}',
//         '#cwb:active{transform:translateY(0);}',
//         '#cwb .cw-ic{width:36px;height:36px;border-radius:10px;',
//         'background:rgba(255,255,255,.2);border:1px solid rgba(255,255,255,.3);',
//         'display:flex;align-items:center;justify-content:center;flex-shrink:0;}',
//         '#cwb .cw-lbl{color:#fff;font-size:15px;font-weight:700;letter-spacing:.01em;}',
//         TCSS
//       ].join(''),
//       html: '<button id="cwb" aria-label="Chat with us">'
//           + '<span style="display:flex;align-items:center;gap:12px;">'
//           + '<span class="cw-ic">'+ic.msg+'</span>'
//           + '<span class="cw-lbl">Need help?</span>'
//           + '</span>'
//           + '</button>'
//     },

//     // 7 — Avatar initials + name pill
//     {
//       css: [
//         '#cwb{position:fixed;bottom:24px;left:24px;height:56px;border-radius:28px;',
//         'background:'+T.grad+';border:none;cursor:pointer;',
//         'box-shadow:0 6px 20px '+T.shadow+',0 1px 0 rgba(255,255,255,.22) inset;',
//         'display:flex;align-items:center;padding:0 22px 0 6px;z-index:9999;',
//         'transition:transform .2s,box-shadow .2s;'+FF+'}',
//         '#cwb:hover{transform:translateY(-2px);box-shadow:0 10px 28px '+T.shadowHov+';}',
//         '#cwb:active{transform:translateY(0);}',
//         '#cwb .cw-av{width:44px;height:44px;border-radius:50%;',
//         'background:rgba(255,255,255,.25);border:2px solid rgba(255,255,255,.45);',
//         'display:flex;align-items:center;justify-content:center;',
//         'font-size:15px;font-weight:800;color:#fff;margin-right:11px;flex-shrink:0;',
//         'text-shadow:0 1px 3px rgba(0,0,0,.2);}',
//         '#cwb .cw-lbl{color:#fff;font-size:14px;font-weight:700;white-space:nowrap;letter-spacing:.01em;}',
//         TCSS
//       ].join(''),
//       html: '<button id="cwb" aria-label="Chat with us">'
//           + '<span style="display:flex;align-items:center;">'
//           + '<span class="cw-av">CS</span>'
//           + '<span class="cw-lbl">Chat with us</span>'
//           + '</span>'
//           + '</button>'
//     },

//     // 8 — Single pulse ring circle
//     {
//       css: [
//         '@keyframes cw-pulse{0%{transform:scale(1);opacity:.6}100%{transform:scale(1.8);opacity:0}}',
//         '#cwb{position:fixed;bottom:24px;left:24px;width:56px;height:56px;border-radius:50%;',
//         'background:'+T.grad+';border:none;cursor:pointer;',
//         'box-shadow:0 4px 16px '+T.shadow+';',
//         'display:flex;align-items:center;justify-content:center;z-index:9999;',
//         'transition:transform .2s,box-shadow .2s;}',
//         '#cwb::before{content:"";position:absolute;inset:0;border-radius:50%;',
//         'background:'+T.primary+';pointer-events:none;',
//         'animation:cw-pulse 2s ease-out infinite;}',
//         '#cwb:hover{transform:scale(1.1);box-shadow:0 6px 22px '+T.shadowHov+';}',
//         '#cwb:active{transform:scale(.96);}',
//         '#cwb.active::before{display:none;}',
//         TCSS
//       ].join(''),
//       html: '<button id="cwb" aria-label="Chat with us">'+ic.chat+'</button>'
//     },

//     // 9 — Split pill: frosted icon circle + divider + label
//     {
//       css: [
//         '#cwb{position:fixed;bottom:24px;left:24px;height:54px;border-radius:27px;',
//         'background:'+T.grad+';border:none;cursor:pointer;',
//         'box-shadow:0 6px 20px '+T.shadow+',0 1px 0 rgba(255,255,255,.25) inset;',
//         'display:flex;align-items:center;padding:0 20px 0 6px;z-index:9999;',
//         'transition:transform .2s,box-shadow .2s;'+FF+'}',
//         '#cwb:hover{transform:translateY(-2px);box-shadow:0 10px 28px '+T.shadowHov+';}',
//         '#cwb:active{transform:translateY(0);}',
//         '#cwb .cw-ic{width:42px;height:42px;border-radius:50%;',
//         'background:rgba(255,255,255,.2);border:1.5px solid rgba(255,255,255,.35);',
//         'display:flex;align-items:center;justify-content:center;flex-shrink:0;}',
//         '#cwb .cw-div{width:1px;height:24px;background:rgba(255,255,255,.3);margin:0 14px;flex-shrink:0;}',
//         '#cwb .cw-lbl{color:#fff;font-size:14px;font-weight:700;letter-spacing:.01em;white-space:nowrap;}',
//         TCSS
//       ].join(''),
//       html: '<button id="cwb" aria-label="Chat with us">'
//           + '<span style="display:flex;align-items:center;">'
//           + '<span class="cw-ic">'+ic.chatW+'</span>'
//           + '<span class="cw-div"></span>'
//           + '<span class="cw-lbl">Chat</span>'
//           + '</span>'
//           + '</button>'
//     }

//   ];

//   // ── Pick style by store index ─────────────────────────────
//   var idx = getIdx(STORE_ID);
//   var S = STYLES[idx] || STYLES[0];

//   // ── Build widget ──────────────────────────────────────────
//   var wc = document.createElement('div');
//   wc.id = 'chat-support-widget';

//   var iframeCSS = [
//     '#chat-widget-iframe{',
//     'position:fixed;bottom:90px;left:24px;',
//     'width:380px;height:560px;border:none;border-radius:16px;',
//     'box-shadow:0 12px 40px rgba(0,0,0,.18),0 4px 12px rgba(0,0,0,.1);',
//     'z-index:9998;display:none;opacity:0;',
//     'transform:translateY(12px) scale(.97);',
//     'transition:opacity .28s cubic-bezier(.4,0,.2,1),transform .28s cubic-bezier(.4,0,.2,1);}',
//     '#chat-widget-iframe.open{display:block;opacity:1;transform:translateY(0) scale(1);}',
//     '@media(max-width:480px){',
//     '#chat-widget-iframe,#chat-widget-iframe.open{',
//     'width:100vw;height:100vh;bottom:0;left:0;border-radius:0;transform:none;}',
//     '#cwb{bottom:16px!important;left:16px!important;}}'
//   ].join('');

//   wc.innerHTML = '<style>'+S.css+iframeCSS+'</style>'
//     + S.html
//     + '<iframe id="chat-widget-iframe" src="'+iframeSrc+'" allow="clipboard-write"></iframe>';

//   document.body.appendChild(wc);

//   // ── Toggle ────────────────────────────────────────────────
//   var btn   = document.getElementById('cwb');
//   var frame = document.getElementById('chat-widget-iframe');

//   if (!btn || !frame) {
//     console.error('[ChatWidget] Elements not found');
//     return;
//   }

//   var isOpen = false;
//   btn.addEventListener('click', function() {
//     isOpen = !isOpen;
//     if (isOpen) {
//       frame.style.display = 'block';
//       requestAnimationFrame(function() { frame.classList.add('open'); });
//       btn.classList.add('active');
//     } else {
//       frame.classList.remove('open');
//       btn.classList.remove('active');
//       setTimeout(function() { if (!isOpen) frame.style.display = 'none'; }, 280);
//     }
//   });

//   var names = ['ElevatedPill','SoftCircle','FloatingPill','WhitePill','DoublePulse','SolidPill','IconCard','AvatarPill','PulseCircle','SplitPill'];
//   console.log('[ChatWidget] Style '+(idx+1)+': '+names[idx]+' | Store: '+STORE_ID);

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

  // ── Icons (one unique per style) ──────────────────────────
  var ic = {

    // Style 0 — Chat bubble with 3 dots
    s0: '<svg width="22" height="22" viewBox="0 0 24 24" fill="white"><path d="M2 6C2 4.9 2.9 4 4 4H20C21.1 4 22 4.9 22 6V16C22 17.1 21.1 18 20 18H6L2 22V6Z"/>'
      + '<circle cx="8" cy="11.5" r="1.25" fill="'+T.primary+'"/>'
      + '<circle cx="12" cy="11.5" r="1.25" fill="'+T.primary+'"/>'
      + '<circle cx="16" cy="11.5" r="1.25" fill="'+T.primary+'"/></svg>',

    // Style 1 — Headset
    s1: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">'
      + '<path d="M3 11a9 9 0 1 1 18 0"/>'
      + '<rect x="2" y="11" width="4" height="7" rx="2"/>'
      + '<rect x="18" y="11" width="4" height="7" rx="2"/>'
      + '<path d="M22 18v1a4 4 0 0 1-4 4h-3"/></svg>',

    // Style 2 — Two overlapping speech bubbles
    s2: '<svg width="22" height="22" viewBox="0 0 24 24" fill="white">'
      + '<path d="M3 5C3 3.9 3.9 3 5 3H16C17.1 3 18 3.9 18 5V13C18 14.1 17.1 15 16 15H9L5 19V5Z" fill-opacity="0.55"/>'
      + '<path d="M8 9C8 7.9 8.9 7 10 7H20C21.1 7 22 7.9 22 9V17C22 18.1 21.1 19 20 19H13L9 23V9Z"/></svg>',

    // Style 3 — Envelope
    s3: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">'
      + '<rect x="2" y="4" width="20" height="16" rx="2"/>'
      + '<path d="m22 7-10 7L2 7"/></svg>',

    // Style 4 — Question mark circle
    s4: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">'
      + '<circle cx="12" cy="12" r="10"/>'
      + '<path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/>'
      + '<circle cx="12" cy="17" r=".5" fill="white"/></svg>',

    // Style 5 — Lightning bolt
    s5: '<svg width="22" height="22" viewBox="0 0 24 24" fill="white"><path d="M13 2L4.5 13.5H11L10 22L20.5 9.5H14L13 2Z"/></svg>',

    // Style 6 — Bell (no dot)
    s6: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="'+T.primary+'" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">'
      + '<path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>'
      + '<path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>',

    // Style 7 — CS initials (avatar, no svg needed)

    // Style 8 — Smiley face
    s8: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">'
      + '<circle cx="12" cy="12" r="10"/>'
      + '<path d="M8 14s1.5 2 4 2 4-2 4-2"/>'
      + '<line x1="9" y1="9" x2="9.01" y2="9" stroke-width="3"/>'
      + '<line x1="15" y1="9" x2="15.01" y2="9" stroke-width="3"/></svg>',

    // Style 9 — Chat bubble with heart
    s9: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="'+T.primary+'" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">'
      + '<path d="M2 6C2 4.9 2.9 4 4 4H20C21.1 4 22 4.9 22 6V16C22 17.1 21.1 18 20 18H6L2 22V6Z" fill="none"/>'
      + '<path d="M12 14s-3.5-2.2-3.5-4.3A1.8 1.8 0 0 1 12 9a1.8 1.8 0 0 1 3.5.7C15.5 11.8 12 14 12 14Z" fill="'+T.primary+'" stroke="none"/></svg>'
  };

  var TCSS = '#cwb.active{opacity:.9;}';
  var FF   = 'font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;';

  // ── 10 Button Styles ──────────────────────────────────────
  var STYLES = [

    // 0 — Gradient pill
    {
      css: [
        '#cwb{position:fixed;bottom:24px;left:24px;height:54px;border-radius:27px;',
        'background:'+T.grad+';border:none;cursor:pointer;',
        'box-shadow:0 6px 20px '+T.shadow+',0 1px 0 rgba(255,255,255,.28) inset;',
        'display:flex;align-items:center;gap:9px;padding:0 22px 0 14px;z-index:9999;',
        'transition:transform .2s,box-shadow .2s;'+FF+'}',
        '#cwb:hover{transform:translateY(-2px);box-shadow:0 10px 28px '+T.shadowHov+';}',
        '#cwb:active{transform:translateY(0);}',
        '#cwb .cw-lbl{color:#fff;font-size:15px;font-weight:700;letter-spacing:.01em;line-height:1;}',
        TCSS
      ].join(''),
      html: '<button id="cwb" aria-label="Chat with us">'
          + '<span style="display:flex;align-items:center;gap:9px;">'
          + ic.s0+'<span class="cw-lbl">Chat</span></span>'
          + '</button>'
    },

// 1 — Soft pill with icon circle
{
  css: [
    '#cwb{position:fixed;bottom:24px;left:24px;height:50px;border-radius:25px;',
    'background:'+T.grad+';border:none;cursor:pointer;',
    'box-shadow:0 4px 14px '+T.shadow+';',
    'display:flex;align-items:center;padding:0 18px 0 6px;z-index:9999;',
    'transition:transform .2s,box-shadow .2s;'+FF+'}',
    '#cwb:hover{transform:translateY(-2px);box-shadow:0 8px 22px '+T.shadowHov+';}',
    '#cwb:active{transform:translateY(0);}',
    '#cwb .cw-ic{width:38px;height:38px;border-radius:19px;',
    'background:rgba(255,255,255,.28);',
    'display:flex;align-items:center;justify-content:center;flex-shrink:0;margin-right:10px;}',
    '#cwb .cw-lbl{color:#fff;font-size:14px;font-weight:700;letter-spacing:.01em;}',
    TCSS
  ].join(''),
  html: '<button id="cwb" aria-label="Chat">'
      + '<span style="display:flex;align-items:center;">'
      + '<span class="cw-ic">'+ic.s1+'</span>'
      + '<span class="cw-lbl">Chat</span>'
      + '</span>'
      + '</button>'
},

    // 2 — Glassmorphism pill
    {
      css: [
        '#cwb{position:fixed;bottom:24px;left:24px;height:52px;border-radius:26px;',
        'background:'+hexToRgba(T.primary, 0.18)+';border:1.5px solid '+hexToRgba(T.light, 0.45)+';cursor:pointer;',
        'backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);',
        'box-shadow:0 4px 24px '+T.shadow+';',
        'display:flex;align-items:center;gap:9px;padding:0 20px 0 14px;z-index:9999;',
        'transition:transform .2s,background .2s,box-shadow .2s;'+FF+'}',
        '#cwb:hover{background:'+hexToRgba(T.primary, 0.28)+';transform:translateY(-2px);box-shadow:0 8px 28px '+T.shadowHov+';}',
        '#cwb:active{transform:translateY(0);}',
        '#cwb .cw-lbl{color:#fff;font-size:15px;font-weight:700;text-shadow:0 1px 4px rgba(0,0,0,.3);}',
        TCSS
      ].join(''),
      html: '<button id="cwb" aria-label="Talk to us">'
          + '<span style="display:flex;align-items:center;gap:9px;">'
          + ic.s2+'<span class="cw-lbl">Talk to Us</span></span>'
          + '</button>'
    },

    // 3 — White pill with colored left block
    {
      css: [
        '#cwb{position:fixed;bottom:24px;left:24px;height:54px;border-radius:27px;',
        'background:#fff;border:none;cursor:pointer;overflow:hidden;',
        'box-shadow:0 6px 22px rgba(0,0,0,.12),0 2px 6px rgba(0,0,0,.08);',
        'display:flex;align-items:center;padding:0 20px 0 0;z-index:9999;',
        'transition:transform .2s,box-shadow .2s;'+FF+'}',
        '#cwb:hover{transform:translateY(-2px);box-shadow:0 10px 30px rgba(0,0,0,.15);}',
        '#cwb:active{transform:translateY(0);}',
        '#cwb .cw-bar{width:54px;height:54px;background:'+T.grad+';flex-shrink:0;',
        'display:flex;align-items:center;justify-content:center;}',
        '#cwb .cw-lbl{color:#111827;font-size:14px;font-weight:700;padding-left:14px;white-space:nowrap;}',
        TCSS
      ].join(''),
      html: '<button id="cwb" aria-label="Chat with us">'
          + '<span style="display:flex;align-items:center;width:100%;">'
          + '<span class="cw-bar">'+ic.s3+'</span>'
          + '<span class="cw-lbl">Chat with us</span>'
          + '</span>'
          + '</button>'
    },

// 4 — Double pulse pill
{
  css: [
    '@keyframes cw-ring{0%{transform:scale(1);opacity:.6}100%{transform:scale(1.9);opacity:0}}',
    '#cwb{position:fixed;bottom:24px;left:24px;height:50px;border-radius:25px;',
    'background:'+T.grad+';border:none;cursor:pointer;',
    'box-shadow:0 4px 16px '+T.shadow+';',
    'display:flex;align-items:center;padding:0 18px 0 6px;z-index:9999;',
    'transition:transform .2s,box-shadow .2s;'+FF+'}',
    '#cwb::before,#cwb::after{content:"";position:absolute;inset:0;border-radius:25px;',
    'background:'+T.primary+';pointer-events:none;z-index:-1;}',
    '#cwb::before{animation:cw-ring 2.2s ease-out infinite;}',
    '#cwb::after{animation:cw-ring 2.2s ease-out infinite .8s;}',
    '#cwb:hover{transform:scale(1.04);box-shadow:0 6px 22px '+T.shadowHov+';}',
    '#cwb:active{transform:scale(.96);}',
    '#cwb .cw-ic{width:38px;height:38px;border-radius:19px;',
    'background:rgba(255,255,255,.28);',
    'display:flex;align-items:center;justify-content:center;flex-shrink:0;margin-right:10px;}',
    '#cwb .cw-lbl{color:#fff;font-size:14px;font-weight:700;letter-spacing:.01em;}',
    TCSS
  ].join(''),
  html: '<button id="cwb" aria-label="Chat with us">'
      + '<span style="display:flex;align-items:center;">'
      + '<span class="cw-ic">'+ic.s0+'</span>'
      + '<span class="cw-lbl">Chat</span>'
      + '</span>'
      + '</button>'
},

// 5 — Gradient pill with frosted icon badge
{
  css: [
    '#cwb{position:fixed;bottom:24px;left:24px;height:52px;border-radius:14px;',
    'background:'+T.grad+';border:none;cursor:pointer;',
    'box-shadow:0 6px 20px '+T.shadow+';',
    'display:flex;align-items:center;padding:0 18px 0 6px;z-index:9999;',
    'transition:transform .2s,box-shadow .2s;'+FF+'}',
    '#cwb:hover{transform:translateY(-2px);box-shadow:0 10px 28px '+T.shadowHov+';}',
    '#cwb:active{transform:translateY(0);}',
    '#cwb .cw-ic{width:40px;height:40px;border-radius:10px;',
    'background:rgba(255,255,255,.22);border:1.5px solid rgba(255,255,255,.35);',
    'display:flex;align-items:center;justify-content:center;flex-shrink:0;margin-right:12px;}',
    '#cwb .cw-lbl{color:#fff;font-size:14px;font-weight:700;letter-spacing:.02em;}',
    TCSS
  ].join(''),
  html: '<button id="cwb" aria-label="Contact us">'
      + '<span style="display:flex;align-items:center;">'
      + '<span class="cw-ic">'+ic.s5+'</span>'
      + '<span class="cw-lbl">Contact Us</span>'
      + '</span>'
      + '</button>'
},

    // 6 — Ghost outline pill
    {
      css: [
        '#cwb{position:fixed;bottom:24px;left:24px;height:52px;border-radius:26px;',
        'background:transparent;border:2px solid '+T.primary+';cursor:pointer;',
        'display:flex;align-items:center;gap:9px;padding:0 20px 0 14px;z-index:9999;',
        'transition:background .2s,box-shadow .2s,transform .2s;'+FF+'}',
        '#cwb:hover{background:'+T.primary+';box-shadow:0 6px 20px '+T.shadow+';transform:translateY(-2px);}',
        '#cwb:hover .cw-lbl{color:#fff;}',
        '#cwb:active{transform:translateY(0);}',
        '#cwb .cw-lbl{color:'+T.primary+';font-size:15px;font-weight:700;transition:color .2s;}',
        TCSS
      ].join(''),
      html: '<button id="cwb" aria-label="Contact support">'
          + '<span style="display:flex;align-items:center;gap:9px;">'
          + ic.s6
          + '<span class="cw-lbl">Support</span>'
          + '</span>'
          + '</button>'
    },

    // 7 — Avatar initials pill
    {
      css: [
        '#cwb{position:fixed;bottom:24px;left:24px;height:56px;border-radius:28px;',
        'background:'+T.grad+';border:none;cursor:pointer;',
        'box-shadow:0 6px 20px '+T.shadow+',0 1px 0 rgba(255,255,255,.22) inset;',
        'display:flex;align-items:center;padding:0 22px 0 6px;z-index:9999;',
        'transition:transform .2s,box-shadow .2s;'+FF+'}',
        '#cwb:hover{transform:translateY(-2px);box-shadow:0 10px 28px '+T.shadowHov+';}',
        '#cwb:active{transform:translateY(0);}',
        '#cwb .cw-av{width:44px;height:44px;border-radius:50%;',
        'background:rgba(255,255,255,.25);border:2px solid rgba(255,255,255,.45);',
        'display:flex;align-items:center;justify-content:center;',
        'font-size:15px;font-weight:800;color:#fff;margin-right:11px;flex-shrink:0;}',
        '#cwb .cw-lbl{color:#fff;font-size:14px;font-weight:700;white-space:nowrap;}',
        TCSS
      ].join(''),
      html: '<button id="cwb" aria-label="Chat with us">'
          + '<span style="display:flex;align-items:center;">'
          + '<span class="cw-av">CS</span>'
          + '<span class="cw-lbl">Chat with us</span>'
          + '</span>'
          + '</button>'
    },

    
    {
      css: [
        '#cwb{position:fixed;bottom:24px;left:24px;height:52px;border-radius:26px;',
        'background:'+T.grad+';border:none;cursor:pointer;',
        'box-shadow:0 6px 18px '+T.shadow+',0 1px 0 rgba(255,255,255,.25) inset;',
        'display:flex;align-items:center;padding:0 20px 0 6px;z-index:9999;',
        'transition:transform .2s,box-shadow .2s;'+FF+'}',
        '#cwb:hover{transform:translateY(-2px);box-shadow:0 10px 26px '+T.shadowHov+';}',
        '#cwb:active{transform:translateY(0);}',
        '#cwb .cw-ic{width:40px;height:40px;border-radius:50%;',
        'background:rgba(255,255,255,.22);border:1.5px solid rgba(255,255,255,.35);',
        'display:flex;align-items:center;justify-content:center;flex-shrink:0;margin-right:10px;}',
        '#cwb .cw-lbl{color:#fff;font-size:14px;font-weight:700;letter-spacing:.01em;}',
        TCSS
      ].join(''),
      html: '<button id="cwb" aria-label="Chat with us">'
          + '<span style="display:flex;align-items:center;">'
          + '<span class="cw-ic">'+ic.chatW+'</span>'
          + '<span class="cw-lbl">Chat</span>'
          + '</span>'
          + '</button>'
    },
    // 9 — White rounded card with top accent strip
    {
      css: [
        '#cwb{position:fixed;bottom:24px;left:24px;height:54px;border-radius:14px;',
        'background:#fff;border:none;cursor:pointer;overflow:hidden;',
        'box-shadow:0 6px 20px rgba(0,0,0,.12);',
        'display:flex;align-items:center;padding:0 18px;gap:12px;z-index:9999;',
        'transition:transform .2s,box-shadow .2s;'+FF+'}',
        '#cwb::before{content:"";position:absolute;top:0;left:0;right:0;height:3px;background:'+T.grad+';}',
        '#cwb:hover{transform:translateY(-2px);box-shadow:0 10px 28px rgba(0,0,0,.15);}',
        '#cwb:active{transform:translateY(0);}',
        '#cwb .cw-lbl{color:#111827;font-size:14px;font-weight:700;white-space:nowrap;}',
        TCSS
      ].join(''),
      html: '<button id="cwb" aria-label="Help">'
          + '<span style="display:flex;align-items:center;gap:12px;">'
          + ic.s9
          + '<span class="cw-lbl">Help</span>'
          + '</span>'
          + '</button>'
    }

  ];

  // ── Pick style by store index ─────────────────────────────
  var idx = getIdx(STORE_ID);
  var S = STYLES[idx] || STYLES[0];

  // ── Build widget ──────────────────────────────────────────
  var wc = document.createElement('div');
  wc.id = 'chat-support-widget';

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
    '#cwb{bottom:16px!important;left:16px!important;}}'
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

  var names = ['ElevatedPill','FlatCircle','GlassPill','WhitePill','DoublePulse','DarkPill','GhostPill','AvatarPill','NeonCircle','AccentCard'];
  console.log('[ChatWidget] Style '+(idx+1)+': '+names[idx]+' | Store: '+STORE_ID);

})();