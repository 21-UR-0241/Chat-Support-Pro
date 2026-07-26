/*!
 * chat-core.js — Headless Chat Support Pro core.
 * Owns the entire backend contract (REST + WebSocket + presence + upload +
 * optimistic send + dedup + session recovery). Renders NOTHING.
 *
 * A view subscribes with core.on(event, fn) and drives it with core.send(),
 * core.submitEmail(), core.setPresence(), core.prepareFile(), core.close().
 *
 * Events emitted:
 *   ready        {brandName, greeting, placeholder, theme}
 *   stage        'email' | 'chat'
 *   status       {state:'online'|'connecting'|'offline', text}
 *   history      [msg]                       (array, oldest→newest)
 *   message      msg                         (a single new message to append)
 *   message:update {tempId, status:'confirmed'|'failed', id?}
 *   message:delete id
 *   typing       true|false                  (agent typing)
 *   upload:progress percent
 *   system       text                        (inline notice, e.g. HEIC help)
 *   blocked                                  (403 — store disabled)
 *
 * msg shape (normalized): {id, senderType, senderName, content, fileData, timestamp, pending}
 */
(function (global) {
  'use strict';

  var GREET =
    'We have 24/7 customer service by chat. It\u2019s the best way to reach us. ' +
    'We always try to answer within 15 minutes when possible';
  var HEIC_PATH_RE = /file:\/\/[^\s]*\.hei[cf]/i;
  var TOKEN_REFRESH_INTERVAL = 5 * 60 * 1000;
  var ACTIVITY_EVENTS = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll', 'click'];
  var INACTIVE_THRESHOLD = 2 * 60 * 1000;
  var HEARTBEAT_INTERVAL = 30 * 1000;
  var PRESENCE_UPDATE_INTERVAL = 60 * 1000;

  function createChatCore(opts) {
    opts = opts || {};
    var params = new URLSearchParams(global.location.search);
    var STORE_ID = opts.storeId || params.get('store');
    // API host resolution order: explicit opt → ?api= param → the iframe's own origin.
    // Passing ?api= lets the widget HTML be hosted anywhere, not only on the API origin.
    var apiParam = params.get('api');
    var API_URL = opts.apiUrl || (apiParam ? decodeURIComponent(apiParam) : global.location.origin);
    var wsParam = params.get('ws');
    var WS_URL = opts.wsUrl || (wsParam ? decodeURIComponent(wsParam) : API_URL.replace(/^http/, 'ws') + '/ws');

    // ---- tiny event emitter ---------------------------------------------
    var listeners = {};
    function on(evt, fn) { (listeners[evt] = listeners[evt] || []).push(fn); return api; }
    function off(evt, fn) {
      if (!listeners[evt]) return api;
      listeners[evt] = listeners[evt].filter(function (f) { return f !== fn; });
      return api;
    }
    function emit(evt, payload) {
      (listeners[evt] || []).forEach(function (f) {
        try { f(payload); } catch (e) { console.error('[ChatCore] listener error', evt, e); }
      });
    }

    // ---- state ----------------------------------------------------------
    var conversationId = null, ws = null, wsToken = null, tokenLastRefreshed = null;
    var customerEmail = null, customerName = null, customerData = null;
    var customerOrders = [], customerCart = null, storeSettings = null;
    var reconnectAttempts = 0, maxReconnectAttempts = 5, reconnectDelay = 2000;
    var displayedMessageIds = new Set(), historyLoaded = false, messageSource = null;
    var uploading = false;
    var lastActivityTime = Date.now(), isPageVisible = true, isCustomerActive = true;
    var heartbeatTimer = null, presenceApiTimer = null, activityThrottleTimer = null;

    // ---- theme (parsed, handed to the view; core never touches DOM) ------
    function hexToRgba(hex, a) {
      hex = hex.replace('#', '');
      if (hex.length === 3) hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
      var r = parseInt(hex.slice(0, 2), 16), g = parseInt(hex.slice(2, 4), 16), b = parseInt(hex.slice(4, 6), 16);
      return 'rgba(' + r + ',' + g + ',' + b + ',' + a + ')';
    }
    function parseTheme() {
      var cp = params.get('primary');
      if (!cp) return null;
      var p = decodeURIComponent(cp);
      var d = params.get('dark') ? decodeURIComponent(params.get('dark')) : p;
      var l = params.get('light') ? decodeURIComponent(params.get('light')) : p;
      return { primary: p, dark: d, light: l, glow: hexToRgba(p, 0.35) };
    }
    // build a theme from a single hex (used for the DB primary_color fallback)
    function themeFromHex(p) {
      if (!p || typeof p !== 'string') return null;
      p = p.trim();
      if (!/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(p)) return null;
      if (p.toLowerCase() === '#667eea') return null;   // API default = "unset" → keep native
      return { primary: p, dark: p, light: p, glow: hexToRgba(p, 0.35) };
    }

    // ---- fetch helpers --------------------------------------------------
    function fetchWithTimeout(url, options, timeout) {
      timeout = timeout === undefined ? 15000 : timeout;
      var c = new AbortController();
      var id = setTimeout(function () { c.abort(); }, timeout);
      return fetch(url, Object.assign({}, options, { signal: c.signal }))
        .then(function (r) { clearTimeout(id); return r; })
        .catch(function (e) {
          clearTimeout(id);
          if (e.name === 'AbortError') throw new Error('Request timeout');
          throw e;
        });
    }
    async function fetchWithRetry(url, options, timeout, retries) {
      timeout = timeout === undefined ? 15000 : timeout;
      retries = retries === undefined ? 2 : retries;
      for (var a = 0; a <= retries; a++) {
        try { return await fetchWithTimeout(url, options, a === 0 ? timeout + 15000 : timeout); }
        catch (e) { if (a === retries) throw e; await new Promise(function (r) { setTimeout(r, 1000 * (a + 1)); }); }
      }
    }

    // ---- token ----------------------------------------------------------
    async function ensureFreshToken(force) {
      var now = Date.now();
      if (!force && wsToken && tokenLastRefreshed && (now - tokenLastRefreshed) < TOKEN_REFRESH_INTERVAL) return wsToken;
      try {
        var r = await fetchWithRetry(
          API_URL + '/api/widget/session?store=' + STORE_ID + (conversationId ? '&conversationId=' + conversationId : ''),
          {}, 10000, 1
        );
        if (r.ok) { var d = await r.json(); wsToken = d.token; tokenLastRefreshed = now; return wsToken; }
      } catch (e) { console.error('[Token] Error:', e); }
      return wsToken;
    }

    // ---- customer detection / storage -----------------------------------
    function isValidEmail(e) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e); }
    function detectMessageSource() {
      var s = params.get('source') || params.get('channel');
      if (s) { messageSource = s; return; }
      var ref = global.document.referrer;
      if (ref) { try { messageSource = new URL(ref).hostname; } catch (e) { messageSource = 'Website'; } }
      else messageSource = 'Direct';
    }
    function autoDetectCustomer() {
      try {
        if (global.parent && global.parent.chatCustomerData) {
          var d = global.parent.chatCustomerData;
          return { email: d.email, name: d.name || d.firstName };
        }
      } catch (e) {}
      var ue = params.get('email');
      if (ue && isValidEmail(ue)) return { email: ue, name: params.get('name') || null };
      try {
        var se = localStorage.getItem('chat_email_' + STORE_ID), sn = localStorage.getItem('chat_name_' + STORE_ID);
        if (se && isValidEmail(se)) return { email: se, name: sn || null };
      } catch (e) {}
      return null;
    }

    // ---- customer data fetches -----------------------------------------
    async function fetchCustomerData(email) {
      if (!email) return null;
      try {
        var r = await fetchWithTimeout(API_URL + '/api/customers/lookup?store=' + STORE_ID + '&email=' + encodeURIComponent(email), {}, 12000);
        if (r.ok) { customerData = await r.json(); return customerData; }
      } catch (e) { console.error('Failed to fetch customer:', e); }
      return null;
    }
    async function fetchCustomerOrders(email) {
      if (!email) return [];
      try {
        var r = await fetchWithTimeout(API_URL + '/api/customers/orders?store=' + STORE_ID + '&email=' + encodeURIComponent(email), {}, 12000);
        if (r.ok) { customerOrders = await r.json(); return customerOrders; }
      } catch (e) { console.error('Failed to fetch orders:', e); }
      return [];
    }
    async function fetchCustomerCart(email) {
      if (!email) return null;
      try { if (global.parent && global.parent.chatCartData) { customerCart = global.parent.chatCartData; return customerCart; } } catch (e) {}
      try {
        var r = await fetchWithTimeout(API_URL + '/api/customers/cart?store=' + STORE_ID + '&email=' + encodeURIComponent(email), {}, 12000);
        if (r.ok) { customerCart = await r.json(); return customerCart; }
      } catch (e) { console.error('Failed to fetch cart:', e); }
      return null;
    }
    async function loadCustomerData() {
      if (!customerEmail) return;
      try { await Promise.all([fetchCustomerData(customerEmail), fetchCustomerOrders(customerEmail), fetchCustomerCart(customerEmail)]); }
      catch (e) { console.error('Failed to load customer data:', e); }
    }
    async function lookupConversation(email) {
      if (!email || !STORE_ID) return null;
      try {
        var r = await fetchWithTimeout(API_URL + '/api/widget/conversation/lookup?store=' + STORE_ID + '&email=' + encodeURIComponent(email), {}, 10000);
        if (r.ok) { var d = await r.json(); if (d.conversationId) return d.conversationId; }
      } catch (e) { console.error('[Lookup] Error:', e); }
      return null;
    }

    // ---- normalize a raw message from any source ------------------------
    function normalize(msg) {
      var fileData = msg.fileData || msg.file_data || null;
      if (typeof fileData === 'string') { try { fileData = JSON.parse(fileData); } catch (e) { fileData = null; } }
      return {
        id: msg.id,
        senderType: msg.senderType || msg.sender_type || msg.type || 'agent',
        senderName: msg.senderName || msg.sender_name || msg.sender || 'Support',
        content: msg.content || msg.message || msg.text || '',
        fileData: fileData,
        timestamp: msg.createdAt || msg.created_at || msg.timestamp || new Date().toISOString(),
        pending: !!msg.pending,
        conversationId: msg.conversationId || msg.conversation_id
      };
    }

    // ---- history --------------------------------------------------------
    async function loadConversationHistory() {
      if (!conversationId || historyLoaded || !STORE_ID) return;
      try {
        var url = API_URL + '/api/widget/conversations/' + conversationId + '/messages?store=' + STORE_ID;
        var response;
        try { response = await fetchWithRetry(url, { headers: { 'Content-Type': 'application/json' } }, 20000, 2); }
        catch (fe) { return; }
        if (!response.ok) {
          if (response.status === 404) { localStorage.removeItem('chat_conv_' + STORE_ID); conversationId = null; }
          return;
        }
        var data;
        try { data = JSON.parse(await response.text()); } catch (e) { return; }
        var messages = Array.isArray(data) ? data : (data.messages || data.data || []);
        if (messages.length > 0) {
          var out = [];
          messages.forEach(function (m) {
            var n = normalize(m);
            if (displayedMessageIds.has(n.id)) return;
            displayedMessageIds.add(n.id);
            out.push(n);
          });
          historyLoaded = true;
          emit('history', out);
        }
      } catch (error) { console.error('[History] Error:', error); }
    }

    // ---- presence -------------------------------------------------------
    function onUserActivity() {
      lastActivityTime = Date.now();
      if (!isCustomerActive) { isCustomerActive = true; sendPresenceUpdate('online'); }
    }
    function startActivityTracking() {
      ACTIVITY_EVENTS.forEach(function (evt) {
        global.document.addEventListener(evt, function () {
          if (activityThrottleTimer) return;
          activityThrottleTimer = setTimeout(function () { activityThrottleTimer = null; }, 1000);
          onUserActivity();
        }, { passive: true });
      });
      global.document.addEventListener('visibilitychange', function () {
        isPageVisible = !global.document.hidden;
        if (isPageVisible) onUserActivity(); else { isCustomerActive = false; sendPresenceUpdate('away'); }
      });
      global.addEventListener('focus', function () { isPageVisible = true; onUserActivity(); });
      global.addEventListener('blur', function () { isPageVisible = false; isCustomerActive = false; sendPresenceUpdate('away'); });
      heartbeatTimer = setInterval(function () {
        if (Date.now() - lastActivityTime >= INACTIVE_THRESHOLD && isCustomerActive) { isCustomerActive = false; sendPresenceUpdate('away'); }
        sendPresenceHeartbeat();
      }, HEARTBEAT_INTERVAL);
      presenceApiTimer = setInterval(function () { sendPresenceViaApi(); }, PRESENCE_UPDATE_INTERVAL);
    }
    function stopActivityTracking() { if (heartbeatTimer) clearInterval(heartbeatTimer); if (presenceApiTimer) clearInterval(presenceApiTimer); }
    function sendPresenceUpdate(status) {
      if (!conversationId) return;
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'presence', conversationId: parseInt(conversationId), status: status, customerEmail: customerEmail, lastActivityAt: new Date(lastActivityTime).toISOString() }));
      } else sendPresenceViaApi(status);
    }
    function sendPresenceHeartbeat() {
      if (ws && ws.readyState === WebSocket.OPEN && conversationId)
        ws.send(JSON.stringify({ type: 'heartbeat', conversationId: parseInt(conversationId), status: isCustomerActive ? 'online' : 'away', customerEmail: customerEmail, lastActivityAt: new Date(lastActivityTime).toISOString() }));
    }
    function sendPresenceViaApi(statusOverride) {
      if (!conversationId || !customerEmail || !STORE_ID) return;
      var status = statusOverride || (isCustomerActive ? 'online' : 'away');
      fetch(API_URL + '/api/widget/presence', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversationId: parseInt(conversationId), customerEmail: customerEmail, storeIdentifier: STORE_ID, status: status, lastActivityAt: new Date(lastActivityTime).toISOString() })
      }).then(function (res) {
        if (res.status === 410) { stopActivityTracking(); conversationId = null; localStorage.removeItem('chat_conv_' + STORE_ID); }
      }).catch(function (err) { console.warn('[Presence API] Failed:', err.message); });
    }
    global.addEventListener('beforeunload', function () {
      if (conversationId && customerEmail) {
        var payload = JSON.stringify({ conversationId: parseInt(conversationId), customerEmail: customerEmail, storeIdentifier: STORE_ID, status: 'offline', lastActivityAt: new Date(lastActivityTime).toISOString() });
        if (navigator.sendBeacon) navigator.sendBeacon(API_URL + '/api/widget/presence', new Blob([payload], { type: 'application/json' }));
        if (ws && ws.readyState === WebSocket.OPEN) { ws.send(JSON.stringify({ type: 'presence', conversationId: parseInt(conversationId), status: 'offline', customerEmail: customerEmail })); ws.close(); }
      }
    });

    // ---- websocket ------------------------------------------------------
    async function connectWebSocket() {
      if (ws && (ws.readyState === WebSocket.CONNECTING || ws.readyState === WebSocket.OPEN)) return;
      if (!conversationId) return;
      try {
        emit('status', { state: 'connecting', text: 'Connecting...' });
        await ensureFreshToken(reconnectAttempts > 0);
        if (!wsToken) { emit('status', { state: 'offline', text: 'No token' }); return; }
        if (ws) { ws.close(); ws = null; }
        ws = new WebSocket(WS_URL);
        ws.onopen = function () { reconnectAttempts = 0; ws.send(JSON.stringify({ type: 'auth', token: wsToken, clientType: 'customer' })); };
        ws.onmessage = function (event) { try { handleWebSocketMessage(JSON.parse(event.data)); } catch (e) { console.error('[WebSocket] Parse error:', e); } };
        ws.onerror = function () { emit('status', { state: 'offline', text: 'Error' }); };
        ws.onclose = function () {
          emit('status', { state: 'offline', text: 'Disconnected' });
          ws = null;
          if (reconnectAttempts < maxReconnectAttempts && conversationId) {
            reconnectAttempts++;
            emit('status', { state: 'connecting', text: 'Reconnecting...' });
            setTimeout(function () { connectWebSocket(); }, reconnectDelay * reconnectAttempts);
          } else if (reconnectAttempts >= maxReconnectAttempts) emit('status', { state: 'offline', text: 'Offline' });
        };
      } catch (e) { console.error('[WebSocket] Failed:', e); emit('status', { state: 'offline', text: 'Failed' }); }
    }
    function handleWebSocketMessage(data) {
      switch (data.type) {
        case 'connected': break;
        case 'auth_ok':
          emit('status', { state: 'online', text: GREET });
          ws.send(JSON.stringify({ type: 'join_conversation', conversationId: parseInt(conversationId), role: 'customer', token: wsToken, customerEmail: customerEmail, customerName: customerName, storeId: storeSettings ? storeSettings.storeId : undefined }));
          sendPresenceUpdate('online');
          break;
        case 'joined': emit('status', { state: 'online', text: GREET }); break;
        case 'new_message': if (data.message) { onUserActivity(); routeIncoming(data.message); } break;
        case 'message_confirmed': emit('message:update', { tempId: data.tempId, status: 'confirmed', id: data.message && data.message.id }); break;
        case 'message_failed': emit('message:update', { tempId: data.tempId, status: 'failed' }); break;
        case 'typing': if (data.isTyping && data.senderType === 'agent') emit('typing', true); else if (!data.isTyping) emit('typing', false); break;
        case 'message_deleted': if (data.messageId) { displayedMessageIds.delete(data.messageId); emit('message:delete', data.messageId); } break;
        case 'error':
          console.error('[WebSocket] Error:', data.message);
          if (data.message && (data.message.includes('token') || data.message.includes('auth'))) { wsToken = null; tokenLastRefreshed = null; }
          break;
      }
    }
    function routeIncoming(message) {
      var msg = normalize(message);
      if (msg.conversationId && msg.conversationId !== parseInt(conversationId)) return;
      if (displayedMessageIds.has(msg.id)) return;
      // our own customer message echoed back — just record id, view already shows it
      if (msg.senderType === 'customer') { displayedMessageIds.add(msg.id); return; }
      emit('typing', false);
      displayedMessageIds.add(msg.id);
      emit('message', msg);
    }

    // ---- file prep (HEIC convert + size guard) --------------------------
    async function prepareFile(file) {
      if (!file) return null;
      var maxSize = 10 * 1024 * 1024;
      var isHeic = file.type === 'image/heic' || file.type === 'image/heif' || /\.hei[cf]$/i.test(file.name);
      if (isHeic) {
        if (typeof global.heic2any !== 'function') { emit('system', heicHelp()); throw new Error('HEIC unsupported'); }
        try {
          var blob = await global.heic2any({ blob: file, toType: 'image/jpeg', quality: 0.85 });
          file = new File([blob], file.name.replace(/\.hei[cf]$/i, '.jpg'), { type: 'image/jpeg' });
        } catch (err) { console.error('HEIC conversion failed:', err); emit('system', heicHelp()); throw err; }
      }
      if (file.size > maxSize) throw new Error('File size must be less than 10MB');
      return file;
    }
    function heicHelp() { return '\ud83d\udcf1 To send this photo:\n1. Open it in the Photos app\n2. Tap Share \u2192 Copy Photo\n3. Paste here again'; }
    function isHeicPath(text) { return HEIC_PATH_RE.test((text || '').trim()); }

    async function uploadFile(file) {
      uploading = true;
      var fd = new FormData(); fd.append('file', file);
      var xhr = new XMLHttpRequest();
      xhr.upload.addEventListener('progress', function (e) { if (e.lengthComputable) emit('upload:progress', Math.round(e.loaded * 100 / e.total)); });
      try {
        return await new Promise(function (res, rej) {
          xhr.addEventListener('load', function () { if (xhr.status >= 200 && xhr.status < 300) res(JSON.parse(xhr.responseText)); else rej(new Error('Upload failed: ' + xhr.status)); });
          xhr.addEventListener('error', function () { rej(new Error('Upload failed')); });
          xhr.open('POST', API_URL + '/api/files/upload'); xhr.send(fd);
        });
      } finally { uploading = false; emit('upload:progress', 0); }
    }

    // ---- send -----------------------------------------------------------
    async function send(text, file) {
      var message = (text || '').trim();
      if (!message && !file) return;
      if (uploading) return;
      if (message && isHeicPath(message)) { emit('system', heicHelp()); return; }
      onUserActivity();
      var tempId = 'temp-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
      var fileData = null;
      if (file) {
        try {
          var ur = await uploadFile(file);
          fileData = { url: ur.url, name: file.name, type: file.type, size: file.size };
        } catch (e) { emit('system', 'Failed to upload file. Please try again.'); throw e; }
      }
      // optimistic echo to the view
      emit('message', { id: tempId, senderType: 'customer', senderName: customerName || 'You', content: message, fileData: fileData, timestamp: new Date().toISOString(), pending: true });

      try {
        if (!conversationId) {
          await ensureFreshToken(true);
          var response = await fetchWithRetry(API_URL + '/api/conversations', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ storeIdentifier: STORE_ID, customerEmail: customerEmail, customerName: customerName, initialMessage: message || (fileData ? '\ud83d\udcce ' + fileData.name : ''), customerData: customerData, hasOrders: customerOrders.length > 0, orderCount: customerOrders.length, cartSubtotal: customerCart ? customerCart.subtotal || 0 : 0, source: messageSource || 'website', fileData: fileData })
          }, 15000, 2);
          if (response.status === 403) { emit('message:delete', tempId); emit('blocked'); return; }
          if (!response.ok) throw new Error('Failed to create conversation');
          var conv = await response.json();
          conversationId = conv.id; localStorage.setItem('chat_conv_' + STORE_ID, conversationId);
          emit('message:update', { tempId: tempId, status: 'confirmed', id: tempId });
          sendPresenceUpdate('online');
          if (wsToken && !ws) connectWebSocket().catch(function () {});
          var ar = 'Thanks for reaching out! An agent will be with you shortly.';
          if (customerData && customerData.name) ar = 'Hi ' + customerData.name + '! ' + ar;
          if (customerOrders.length > 0) ar += ' We can see you have ' + customerOrders.length + ' order' + (customerOrders.length !== 1 ? 's' : '') + ' with us.';
          emit('message', { id: 'auto-' + tempId, senderType: 'agent', senderName: 'Support Team', content: ar, timestamp: new Date().toISOString() });
        } else {
          await ensureFreshToken(false);
          var r2 = await fetchWithRetry(API_URL + '/api/widget/messages', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ conversationId: parseInt(conversationId), customerEmail: customerEmail, customerName: customerName, content: message || '', storeIdentifier: STORE_ID, tempId: tempId, customerData: customerData, hasOrders: customerOrders.length > 0, cartSubtotal: customerCart ? customerCart.subtotal || 0 : 0, source: messageSource || 'website', fileData: fileData })
          }, 15000, 2);
          if (!r2.ok) {
            var ed = await r2.json().catch(function () { return {}; });
            emit('message:update', { tempId: tempId, status: 'failed' });
            if (r2.status === 403) { emit('message:delete', tempId); emit('blocked'); return; }
            if (ed.error && (ed.error.includes('conversation') || ed.error === 'conversation_not_found' || ed.error.includes('token') || ed.error.includes('unauthorized'))) {
              // session expired → wipe, recreate, replay this exact message
              localStorage.removeItem('chat_conv_' + STORE_ID);
              conversationId = null; wsToken = null; tokenLastRefreshed = null; historyLoaded = false;
              if (ws && ws.readyState === WebSocket.OPEN) { ws.close(); ws = null; }
              emit('message:delete', tempId);
              emit('system', 'Session expired. Creating new conversation...');
              await new Promise(function (r) { setTimeout(r, 800); });
              return send(message, null); // replay
            } else throw new Error(ed.error || 'Failed to send');
          } else {
            var sm = await r2.json();
            emit('message:update', { tempId: tempId, status: 'confirmed', id: sm.id });
            if (sm.id) displayedMessageIds.add(sm.id);
          }
        }
      } catch (error) {
        console.error('Send failed:', error);
        if (error.message && (error.message.includes('token') || error.message.includes('unauthorized'))) { wsToken = null; tokenLastRefreshed = null; }
        emit('message:update', { tempId: tempId, status: 'failed' });
        emit('system', error.message === 'Request timeout' ? 'Connection is slow. Please try sending again.' : 'Failed to send. Please try again.');
        throw error;
      }
    }

    // typing signal from the view (debounced by the view)
    function notifyTyping(isTyping) {
      if (ws && ws.readyState === WebSocket.OPEN && conversationId)
        ws.send(JSON.stringify({ type: 'typing', conversationId: parseInt(conversationId), isTyping: !!isTyping, senderType: 'customer', senderName: customerName || 'Customer' }));
    }

    // ---- stage transitions ---------------------------------------------
    async function enterChat() {
      emit('stage', 'chat');
      if (conversationId && !historyLoaded) { await loadConversationHistory(); await ensureFreshToken(true); }
      startActivityTracking();
      sendPresenceUpdate('online');
      if (conversationId && wsToken) { setTimeout(function () { connectWebSocket(); }, 500); }
      else if (conversationId) {
        emit('status', { state: 'connecting', text: 'Connecting...' });
        try { await ensureFreshToken(true); if (wsToken) connectWebSocket(); else emit('status', { state: 'online', text: GREET }); }
        catch (e) { emit('status', { state: 'online', text: GREET }); }
      } else emit('status', { state: 'online', text: GREET });
    }

    async function submitEmail(email, name) {
      email = (email || '').trim();
      if (!isValidEmail(email)) throw new Error('invalid_email');
      customerEmail = email; customerName = (name || '').trim() || 'Guest';
      localStorage.setItem('chat_email_' + STORE_ID, customerEmail);
      localStorage.setItem('chat_name_' + STORE_ID, customerName);
      var lu = await lookupConversation(customerEmail);
      if (lu) { conversationId = String(lu); localStorage.setItem('chat_conv_' + STORE_ID, conversationId); }
      await enterChat();
      loadCustomerData();
    }

    // ---- settings + init ------------------------------------------------
    async function loadSettings() {
      var out = { brandName: 'Chat Support', greeting: null, placeholder: null, storeId: undefined, primaryColor: null };
      try {
        var r = await fetchWithRetry(API_URL + '/api/widget/settings?store=' + STORE_ID, {}, 15000, 2);
        if (r.ok) {
          storeSettings = await r.json();
          out.brandName = storeSettings.brandName || 'Chat Support';
          out.storeId = storeSettings.storeId;
          out.primaryColor = storeSettings.primaryColor || null;
          if (storeSettings.widgetSettings) {
            out.greeting = storeSettings.widgetSettings.greeting || null;
            out.placeholder = storeSettings.widgetSettings.placeholder || null;
          }
        }
        await ensureFreshToken(true);
      } catch (e) { console.error('[Settings] Error:', e); }
      return out;
    }

    async function init() {
      if (!STORE_ID) console.error('[ChatCore] No store ID');
      try {
        detectMessageSource();
        var settings = await loadSettings();
        var theme = parseTheme() || themeFromHex(settings.primaryColor);
        emit('ready', { brandName: settings.brandName, greeting: settings.greeting, placeholder: settings.placeholder, theme: theme });
        var det = autoDetectCustomer();
        if (det) {
          customerEmail = det.email; customerName = det.name || 'Guest';
          localStorage.setItem('chat_email_' + STORE_ID, customerEmail);
          if (customerName) localStorage.setItem('chat_name_' + STORE_ID, customerName);
          conversationId = localStorage.getItem('chat_conv_' + STORE_ID);
          if (!conversationId && customerEmail) {
            var lu = await lookupConversation(customerEmail);
            if (lu) { conversationId = String(lu); localStorage.setItem('chat_conv_' + STORE_ID, conversationId); }
          }
          await loadCustomerData();
          await enterChat();
        } else {
          emit('stage', 'email');
          emit('status', { state: 'online', text: GREET });
        }
      } catch (e) { console.error('[ChatCore] Fatal:', e); emit('status', { state: 'offline', text: 'Offline' }); }
    }

    function close() {
      try { if (global.parent && global.parent !== global) global.parent.postMessage({ type: 'chat-widget-close', store: STORE_ID }, '*'); }
      catch (e) { console.warn('[ChatCore] Close postMessage failed:', e); }
    }

    var api = {
      init: init, on: on, off: off,
      submitEmail: submitEmail, send: send, prepareFile: prepareFile,
      notifyTyping: notifyTyping, setPresence: sendPresenceUpdate, close: close,
      isValidEmail: isValidEmail, isHeicPath: isHeicPath,
      get storeId() { return STORE_ID; },
      get greeting() { return GREET; },
      get customerName() { return customerName; }
    };
    return api;
  }

  global.ChatCore = { create: createChatCore, GREET: GREET };
})(window);