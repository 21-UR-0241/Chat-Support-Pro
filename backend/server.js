
// require('dotenv').config();
// const express = require('express');
// const cors = require('cors');
// const http = require('http');
// const compression = require('compression');           // NEW
// const rateLimit = require('express-rate-limit');
// const helmet = require('helmet');
// const db = require('./database');
// const shopify = require('./shopify-api');
// const { rawBodyMiddleware, handleWebhook } = require('./webhooks');
// const { getAuthUrl, handleCallback } = require('./shopify-auth');
// const { initWebSocketServer, sendToConversation, broadcastToAgents, getWebSocketStats } = require('./websocket-server');
// const { hashPassword, verifyPassword, generateToken, authenticateToken } = require('./auth');
// const session = require('express-session');
// const shopifyAppRoutes = require('./routes/shopify-app-routes');
// const fileRoutes = require('./routes/fileroutes');
// const { handleOfflineEmailNotification, cancelPendingEmail, startEmailSweep, stopEmailSweep } = require('../frontend/src/admin/services/emailService');
// const aiTrainingRoutes = require('./routes/ai-training-routes');
// const { getBrainContext, refreshBrainCache, getBrainSettings } = require('./brain-context');
// // ── AI suggestion module (extracted) ──
// const { callAnthropicAPIWithRetry } = require('./lib/ai-suggestions'); // used by /pepstack
// const createAiRoutes = require('./routes/ai-routes');

// const app = express();
// const server = http.createServer(app);

// app.set('trust proxy', 1);


// const ALLOWED_ORIGINS = [
//   'https://chat-support-pro.onrender.com',
//   'https://chat-support-pro.vercel.app',
//   'http://localhost:5173',
//   'http://localhost:3000',
//   'http://localhost:8080',
// ];

// app.use((req, res, next) => {
//   const origin = req.headers.origin;
//   if (ALLOWED_ORIGINS.includes(origin)) {
//     res.header('Access-Control-Allow-Origin', origin);
//     res.header('Access-Control-Allow-Credentials', 'true');
//   }
//   res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
//   res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
//   if (req.method === 'OPTIONS') return res.sendStatus(204);
//   next();
// });

// app.use('/api', (req, res, next) => {
//   if (req.method === 'GET') res.set('Cache-Control', 'no-store');
//   next();
// });

// let lastHourlyReportAt = 0;
// let lastDailyReportAt  = 0;
// const REPORT_COOLDOWN  = 60_000;

// // ── Compression — cuts payload sizes 60-80% ──────────────────────────────────
// app.use(compression({ level: 1, threshold: 2048 }));

// console.log('🔌 Initializing WebSocket server...');
// initWebSocketServer(server);
// console.log('✅ WebSocket server initialized\n');
// console.log('\n🚀 Multi-Store Chat Server Starting...\n');

// // ============ UTILITY FUNCTIONS ============

// function snakeToCamel(obj) {
//   if (!obj) return obj;
//   if (Array.isArray(obj)) return obj.map(snakeToCamel);
//   if (obj instanceof Date) return obj;
//   if (typeof obj !== 'object') return obj;
//   const camelObj = {};
//   for (const [key, value] of Object.entries(obj)) {
//     const camelKey = key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
//     camelObj[camelKey] = typeof value === 'object' && value !== null ? snakeToCamel(value) : value;
//   }
//   return camelObj;
// }

// function camelToSnake(obj) {
//   if (!obj) return obj;
//   if (Array.isArray(obj)) return obj.map(camelToSnake);
//   if (typeof obj !== 'object') return obj;
//   const snakeObj = {};
//   for (const [key, value] of Object.entries(obj)) {
//     const snakeKey = key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
//     snakeObj[snakeKey] = value;
//   }
//   return snakeObj;
// }

// // ============ WRITE-INVALIDATED CACHE ============
// // Unlike TTL caches, this is always fresh — cleared the moment data changes.
// // Safe for single-instance Render deployments. If you ever scale to 2+ instances,
// // migrate to Redis and use pub/sub invalidation.

// class WriteInvalidatedCache {
//   constructor() { this.store = new Map(); }
//   get(key) { return this.store.get(key) ?? null; }
//   set(key, value) { this.store.set(key, value); return value; }
//   invalidate(key) { this.store.delete(key); }
//   invalidatePrefix(prefix) {
//     for (const key of this.store.keys()) {
//       if (key.startsWith(prefix)) this.store.delete(key);
//     }
//   }
//   invalidateAll() { this.store.clear(); }
// }

// const appCache = new WriteInvalidatedCache();

// // ============ STORE LOOKUP WITH CACHE ============

// async function getCachedStore(identifier) {
//   if (!identifier) return null;
//   const key = `store:${identifier}`;
//   const cached = appCache.get(key);
//   if (cached) return cached;
//   const store = await db.getStoreByIdentifier(identifier);
//   if (store) appCache.set(key, store);
//   return store;
// }

// function invalidateStoreCache(identifier) {
//   if (identifier) appCache.invalidate(`store:${identifier}`);
//   appCache.invalidatePrefix('stores:active');   // was: appCache.invalidate('stores:active')
//   appCache.invalidate('stores:all');
// }

// // function invalidateStoreCache(identifier) {
// //   if (identifier) appCache.invalidate(`store:${identifier}`);
// //   appCache.invalidate('stores:active');
// //   appCache.invalidate('stores:all');
// // }

// // ============ DEBOUNCED READ BROADCAST ============
// // Collapses rapid-fire conversation_read events into a single broadcast.

// const readBroadcastTimers = new Map();

// function debouncedReadBroadcast(conversationId, conversationData) {
//   clearTimeout(readBroadcastTimers.get(conversationId));
//   readBroadcastTimers.set(conversationId, setTimeout(() => {
//     broadcastToAgents({ type: 'conversation_read', conversationId, conversation: conversationData });
//     readBroadcastTimers.delete(conversationId);
//   }, 300));
// }

// // ============ LEGAL THREAT DETECTION ============

// const LEGAL_THREAT_PATTERNS = [
//   /\b(lawsuit|sue|suing|sued|litigation|litigate|legal action|take you to court|taking you to court|file a suit|filing a suit|small claims|civil suit|class action)\b/i,
//   /\b(attorney|lawyer|legal counsel|solicitor|barrister|my lawyer|my attorney|legal team|law firm)\b/i,
//   /\b(cease and desist|c&d|cease desist|legal notice|formal notice|demand letter|legal demand|legal letter)\b/i,
//   /\b(bbb|better business bureau|ftc|federal trade commission|attorney general|consumer protection|chargeback dispute|credit card dispute|fraud claim|report you|file a complaint|regulatory complaint)\b/i,
//   /\b(fraud|scam|illegal|criminal|press charges|file charges|police report|law enforcement|stolen|theft|deceptive practices)\b/i,
//   /\b(damages|compensation|liable|liability|negligence|breach of contract|consumer rights violation)\b/i,
// ];

// const LEGAL_SEVERITY_MAP = {
//   critical: [
//     /cease and desist/i, /class action/i, /attorney general/i, /fraud claim/i,
//     /breach of contract/i, /consumer rights violation/i, /press charges|file charges/i, /law firm/i,
//   ],
//   high: [
//     /lawsuit|sue\b|suing|litigation/i, /attorney|lawyer|legal counsel/i,
//     /legal notice|demand letter/i, /ftc|federal trade commission/i,
//     /criminal|illegal/i, /damages|liable|liability/i,
//   ],
//   medium: [
//     /bbb|better business bureau/i, /chargeback dispute|credit card dispute/i,
//     /report you|file a complaint/i, /fraud|scam/i, /negligence/i,
//   ],
// };

// function detectLegalThreat(content) {
//   if (!content || typeof content !== 'string') return null;
//   const matched = LEGAL_THREAT_PATTERNS.some(p => p.test(content));
//   if (!matched) return null;
//   for (const [severity, patterns] of Object.entries(LEGAL_SEVERITY_MAP)) {
//     for (const pattern of patterns) {
//       const match = content.match(pattern);
//       if (match) {
//         return { detected: true, severity, matchedTerm: match[0],
//           snippet: content.length > 200 ? content.substring(0, 200) + '...' : content };
//       }
//     }
//   }
//   return { detected: true, severity: 'medium', matchedTerm: 'legal keyword', snippet: content.substring(0, 200) };
// }

// function detectLegalDocumentType(text) {
//   const documentSignatures = [
//     { type: 'Cease and Desist Letter', severity: 'critical', patterns: [/CEASE AND DESIST/i, /cease.{0,20}desist/i] },
//     { type: 'Demand Letter', severity: 'critical', patterns: [/DEMAND LETTER/i, /formal demand/i, /hereby demand/i, /demand that you/i, /demand for payment/i] },
//     { type: 'Court Summons / Complaint', severity: 'critical', patterns: [/SUMMONS/i, /PLAINTIFF.*DEFENDANT/is, /IN THE (SUPERIOR|DISTRICT|SUPREME|CIRCUIT|COUNTY|PROVINCIAL|SMALL CLAIMS) COURT/i, /COURT OF (QUEEN|KING)'S BENCH/i, /STATEMENT OF CLAIM/i, /NOTICE OF CIVIL CLAIM/i] },
//     { type: 'BBB / Consumer Complaint', severity: 'high', patterns: [/BETTER BUSINESS BUREAU/i, /BBB COMPLAINT/i, /CONSUMER PROTECTION/i] },
//     { type: 'Chargeback Notice', severity: 'high', patterns: [/CHARGEBACK/i, /DISPUTE NOTIFICATION/i, /RETRIEVAL REQUEST/i, /REASON CODE.{0,20}(fraud|not received|unauthorized)/i] },
//     { type: 'Notice of Legal Action', severity: 'critical', patterns: [/NOTICE OF (LEGAL ACTION|INTENT TO SUE|LITIGATION)/i, /without further legal action/i, /legal proceedings will/i, /compelled to seek legal/i, /pursue legal remedies/i] },
//     { type: 'Small Claims Filing', severity: 'critical', patterns: [/SMALL CLAIMS/i, /PLAINTIFF'S CLAIM/i, /CLAIM AMOUNT/i] },
//   ];
//   for (const sig of documentSignatures) {
//     if (sig.patterns.some(p => p.test(text))) return { type: sig.type, severity: sig.severity };
//   }
//   const formalLetterScore = [
//     /\bRE:\s/i, /\bDear (Sir|Madam|Counsel|Mr\.|Ms\.|Mrs\.)/i,
//     /\bsincerely yours\b|\byours truly\b|\byours faithfully\b/i,
//     /\b(Esq\.|Attorney at Law|Barrister|Solicitor|LLB|JD)\b/i,
//     /\bwithout prejudice\b/i, /\bpursuant to\b/i, /\bhereby (notify|demand|give notice)\b/i,
//   ].filter(p => p.test(text)).length;
//   if (formalLetterScore >= 3) return { type: 'Formal Legal Correspondence', severity: 'high' };
//   return null;
// }

// async function handleLegalThreat(threat, conversationId, storeId, senderName, messageContent, pool) {
//   const emoji = threat.severity === 'critical' ? '🚨' : threat.severity === 'high' ? '⚠️' : '🔔';
//   console.log(`${emoji} [LEGAL FLAG] Severity: ${threat.severity.toUpperCase()} | Conv: ${conversationId} | Term: "${threat.matchedTerm}" | From: ${senderName}`);
//   try {
//     await pool.query(`
//       UPDATE conversations SET priority = 'urgent',
//         tags = CASE WHEN tags IS NULL THEN ARRAY['legal-flag'] WHEN NOT ('legal-flag' = ANY(tags)) THEN array_append(tags, 'legal-flag') ELSE tags END,
//         legal_flag = TRUE, legal_flag_severity = $1, legal_flag_at = NOW(), legal_flag_term = $2, updated_at = NOW()
//       WHERE id = $3
//     `, [threat.severity, threat.matchedTerm, conversationId]);
//   } catch (dbErr) {
//     console.warn('[LEGAL FLAG] Extended columns not found, fallback:', dbErr.message);
//     try { await pool.query(`UPDATE conversations SET priority = 'urgent', updated_at = NOW() WHERE id = $1`, [conversationId]); }
//     catch (fallbackErr) { console.error('[LEGAL FLAG] Fallback DB update failed:', fallbackErr.message); }
//   }
//   broadcastToAgents({ type: 'legal_threat_detected', alert: {
//     conversationId, storeId, severity: threat.severity, matchedTerm: threat.matchedTerm,
//     senderName, snippet: threat.snippet, timestamp: new Date().toISOString(), emoji,
//     fromAttachment: threat.fromAttachment || false, documentType: threat.documentType || null,
//     message: `${emoji} LEGAL THREAT DETECTED (${threat.severity.toUpperCase()}): "${threat.matchedTerm}" — from ${senderName}`,
//   }});
//   sendLegalFlagEmail(threat, conversationId, senderName, messageContent, pool).catch(err =>
//     console.error('[LEGAL FLAG] Email notification failed:', err.message));
// }

// async function sendLegalFlagEmail(threat, conversationId, senderName, messageContent, pool) {
//   const RESEND_API_KEY = process.env.RESEND_API_KEY;
//   const ALERT_EMAIL = process.env.LEGAL_ALERT_EMAIL || process.env.ADMIN_EMAIL;
//   if (!RESEND_API_KEY || !ALERT_EMAIL) { console.warn('[LEGAL FLAG] No RESEND_API_KEY or LEGAL_ALERT_EMAIL — skipping'); return; }
//   const severity = threat.severity.toUpperCase();
//   const emoji = threat.severity === 'critical' ? '🚨' : threat.severity === 'high' ? '⚠️' : '🔔';
//   const appUrl = process.env.APP_URL || 'https://your-app.com';
//   const sourceLabel = threat.fromAttachment ? `Uploaded Document (${threat.documentType || 'file'})` : 'Chat Message';
//   const html = `<div style="font-family:sans-serif;max-width:600px;margin:0 auto">
//     <div style="background:${threat.severity==='critical'?'#dc2626':threat.severity==='high'?'#d97706':'#2563eb'};color:white;padding:16px 24px;border-radius:8px 8px 0 0">
//       <h1 style="margin:0;font-size:20px">${emoji} Legal Threat Detected — ${severity}</h1></div>
//     <div style="background:#f9fafb;border:1px solid #e5e7eb;border-top:none;padding:24px;border-radius:0 0 8px 8px">
//       <p><strong>Severity:</strong> ${severity}</p><p><strong>Matched Term:</strong> "${threat.matchedTerm}"</p>
//       <p><strong>Source:</strong> ${sourceLabel}</p><p><strong>From:</strong> ${senderName}</p>
//       <p><strong>Conversation:</strong> #${conversationId}</p>
//       <p><strong>Time:</strong> ${new Date().toLocaleString('en-US',{timeZone:'America/Toronto'})} EST</p>
//       <blockquote>"${threat.snippet}"</blockquote>
//       <a href="${appUrl}/conversations/${conversationId}" style="display:inline-block;background:#111827;color:white;padding:10px 24px;border-radius:6px;text-decoration:none;font-weight:600">Open Conversation →</a>
//     </div></div>`;
//   const response = await fetch('https://api.resend.com/emails', {
//     method: 'POST',
//     headers: { 'Authorization': `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
//     body: JSON.stringify({ from: process.env.EMAIL_FROM || 'alerts@yourdomain.com', to: ALERT_EMAIL,
//       subject: `${emoji} [${severity}] Legal Threat — Conv #${conversationId} — "${threat.matchedTerm}"`, html }),
//   });
//   if (!response.ok) { const err = await response.text(); throw new Error(`Resend API error: ${err}`); }
//   console.log(`[LEGAL FLAG] Alert email sent to ${ALERT_EMAIL} for conv #${conversationId}`);
// }

// async function extractTextFromPDF(fileUrl) {
//   try {
//     const pdfParse = require('pdf-parse');
//     const response = await fetch(fileUrl);
//     if (!response.ok) throw new Error(`Failed to fetch PDF: ${response.status}`);
//     const buffer = await response.arrayBuffer();
//     const data = await pdfParse(Buffer.from(buffer));
//     return data.text || '';
//   } catch (err) { console.error('[PDF Extract] Error:', err.message); return ''; }
// }

// async function extractTextFromImage(fileUrl) {
//   const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
//   if (!ANTHROPIC_API_KEY) return '';
//   try {
//     const response = await fetch(fileUrl);
//     const buffer = await response.arrayBuffer();
//     const base64 = Buffer.from(buffer).toString('base64');
//     const mimeType = response.headers.get('content-type') || 'image/jpeg';
//     const apiResponse = await fetch('https://api.anthropic.com/v1/messages', {
//       method: 'POST',
//       headers: { 'Content-Type': 'application/json', 'x-api-key': ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
//       body: JSON.stringify({ model: 'claude-haiku-4-5-20251001', max_tokens: 1000, messages: [{ role: 'user', content: [
//         { type: 'image', source: { type: 'base64', media_type: mimeType, data: base64 } },
//         { type: 'text', text: 'Extract all text from this image exactly as written. Return only the raw text, no commentary.' }
//       ]}]}),
//       signal: AbortSignal.timeout(20000),
//     });
//     const data = await apiResponse.json();
//     return data.content?.[0]?.text || '';
//   } catch (err) { console.error('[Image OCR] Error:', err.message); return ''; }
// }

// async function analyzeLegalAttachment(fileData, conversationId, storeId, senderName, pool) {
//   const fileUrl = fileData?.url || fileData?.fileUrl;
//   const mimeType = fileData?.mimeType || fileData?.type || '';
//   if (!fileUrl) return;
//   console.log(`[LEGAL ATTACH] Scanning file: ${fileUrl} (${mimeType})`);
//   try {
//     let extractedText = '';
//     if (mimeType === 'application/pdf' || fileUrl.endsWith('.pdf')) {
//       extractedText = await extractTextFromPDF(fileUrl);
//     } else if (mimeType.startsWith('image/') || /\.(jpg|jpeg|png|webp|gif)$/i.test(fileUrl)) {
//       extractedText = await extractTextFromImage(fileUrl);
//     } else { return; }
//     if (!extractedText) return;
//     console.log(`[LEGAL ATTACH] Extracted ${extractedText.length} chars from file`);
//     const docType = detectLegalDocumentType(extractedText);
//     if (docType) {
//       console.log(`🚨 [LEGAL ATTACH] Legal document detected: ${docType.type}`);
//       await handleLegalThreat({ detected: true, severity: docType.severity, matchedTerm: docType.type,
//         snippet: extractedText.substring(0, 300), fromAttachment: true, documentType: docType.type },
//         conversationId, storeId, senderName, `[ATTACHED DOCUMENT] ${extractedText.substring(0, 500)}`, pool);
//       return;
//     }
//     const threat = detectLegalThreat(extractedText);
//     if (threat) { threat.fromAttachment = true; await handleLegalThreat(threat, conversationId, storeId, senderName, extractedText, pool); }
//   } catch (err) { console.error('[LEGAL ATTACH] File analysis failed:', err.message); }
// }

// app.use(helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false, crossOriginResourcePolicy: { policy: "cross-origin" }, frameguard: false }));

// app.post('/webhooks/:shop/:topic', rawBodyMiddleware, handleWebhook);
// app.use(express.json({ limit: '10mb' }));
// app.use(session({ secret: process.env.JWT_SECRET, resave: false, saveUninitialized: false,
//   cookie: { secure: process.env.NODE_ENV === 'production', maxAge: 24 * 60 * 60 * 1000 } }));

// app.get('/widget-init.js', (req, res) => {
//   res.set({ 'Content-Type': 'application/javascript; charset=utf-8', 'Cache-Control': 'public, max-age=3600',
//     'X-Content-Type-Options': 'nosniff', 'Access-Control-Allow-Origin': '*' });
//   res.sendFile(__dirname + '/public/widget-init.js');
// });
// app.get('/pepstack-init.js', (req, res) => {
//   res.set({ 'Content-Type': 'application/javascript; charset=utf-8', 'Cache-Control': 'public, max-age=3600',
//     'X-Content-Type-Options': 'nosniff', 'Access-Control-Allow-Origin': '*' });
//   res.sendFile(__dirname + '/public/pepstack-init.js');
// });
// app.get('/widget.html', (req, res) => {
//   res.removeHeader('X-Frame-Options');
//   res.set({ 'Content-Type': 'text/html; charset=utf-8', 'X-Content-Type-Options': 'nosniff',
//     'Cache-Control': 'no-cache, must-revalidate', 'Content-Security-Policy': "frame-ancestors *" });
//   res.sendFile(__dirname + '/public/widget.html');
// });
// // app.use(express.static('public'));
// app.use(express.static(__dirname + '/public'));



// const limiter = rateLimit({ windowMs: 15*60*1000, max: 500, message: 'Too many requests from this IP.',
//   standardHeaders: true, legacyHeaders: false,
//   skip: (req) => { const h = req.headers.authorization; if (h?.startsWith('Bearer ')) { try { const { verifyToken } = require('./auth'); return !!verifyToken(h.split(' ')[1]); } catch(e){ return false; } } return false; },
//   validate: { xForwardedForHeader: false, trustProxy: false } });


// const widgetLimiter = rateLimit({ windowMs: 15*60*1000, max: 500, message: 'Too many requests.',
//   standardHeaders: true, legacyHeaders: false, validate: { xForwardedForHeader: false, trustProxy: false } });


// const loginLimiter = rateLimit({
//   windowMs: 15 * 60 * 1000,
//   max: 50,
//   skipSuccessfulRequests: true,
//   handler: (req, res) => {
//     const origin = req.headers.origin;
//     if (ALLOWED_ORIGINS.includes(origin)) {
//       res.header('Access-Control-Allow-Origin', origin);
//       res.header('Access-Control-Allow-Credentials', 'true');
//     }
//     res.status(429).json({ error: 'Too many login attempts. Please try again in 15 minutes.' });
//   },
// });

//   const promoRoutes = require('./routes/promo-routes');
// app.use('/api/promo', promoRoutes);

// app.use('/api/widget/', widgetLimiter);
// app.use('/api/customers/', widgetLimiter);
// app.use('/api/', limiter);

// if (process.env.NODE_ENV === 'production') {
//   app.use((req, res, next) => {
//     if (req.header('x-forwarded-proto') !== 'https') res.redirect(`https://${req.header('host')}${req.url}`);
//     else next();
//   });
// }

// if (process.env.NODE_ENV !== 'production') {
//   app.use((req, res, next) => { console.log(`${req.method} ${req.path}`); next(); });
// }

// app.get('/health', async (req, res) => {
//   try {
//     await db.testConnection();
//     const wsStats = getWebSocketStats();
//     res.json({ status: 'healthy', timestamp: new Date().toISOString(), database: 'connected',
//       websocket: { active: wsStats.totalConnections > 0, connections: wsStats.totalConnections,
//         agents: wsStats.agentCount, customers: wsStats.customerCount,
//         authenticated: wsStats.authenticatedCount, activeConversations: wsStats.activeConversations },
//       uptime: Math.floor(process.uptime()), version: process.env.npm_package_version || '1.0.0' });
//   } catch (error) { res.status(503).json({ status: 'unhealthy', error: error.message, timestamp: new Date().toISOString() }); }
// });

// // ============ WIDGET API ENDPOINTS ============

// // app.get('/api/stores/groups', authenticateToken, async (req, res) => {
// //   try {
// //     const { rows } = await db.pool.query(`
// //       SELECT store_group, store_group_name, COUNT(*)::int AS store_count
// //       FROM stores
// //       WHERE is_active = true AND store_group IS NOT NULL
// //       GROUP BY store_group, store_group_name
// //       ORDER BY store_group_name NULLS LAST, store_group ASC
// //     `);
// //     res.json(rows.map(snakeToCamel));
// //   } catch (error) {
// //     console.error('Get store groups error:', error);
// //     res.status(500).json({ error: 'Failed to fetch store groups' });
// //   }
// // });

// app.get('/api/stores/verify', async (req, res) => {
//   try {
//     const { domain } = req.query;
//     if (!domain) return res.status(400).json({ error: 'domain parameter required' });
//     const store = await db.getStoreByDomain(domain);
//     if (!store || !store.is_active) return res.status(404).json({ error: 'Store not found or inactive', message: 'Please install the chat app from Shopify' });
//     res.json({ storeId: store.id, storeIdentifier: store.store_identifier, shopDomain: store.shop_domain, brandName: store.brand_name, active: store.is_active, verified: true });
//   } catch (error) { console.error('Store verification error:', error); res.status(500).json({ error: 'Verification failed' }); }
// });



// app.get('/api/widget/settings', async (req, res) => {
//   try {
//     const { store: storeIdentifier } = req.query;
//     if (!storeIdentifier) return res.status(400).json({ error: 'store parameter required' });
//     const store = await getCachedStore(storeIdentifier);                          // OPTIMISED
//     if (!store || !store.is_active) return res.status(404).json({ error: 'Store not found or inactive' });
//     res.json({ storeId: store.id, storeIdentifier: store.store_identifier, brandName: store.brand_name,
//       primaryColor: store.primary_color || '#667eea', logoUrl: store.logo_url,
//       widgetSettings: store.widget_settings || { position: 'bottom-right', greeting: 'Hi! How can we help you today?', placeholder: 'Type your message...', showAvatar: true },
//       businessHours: store.business_hours, timezone: store.timezone || 'UTC' });
//   } catch (error) { console.error('Widget settings error:', error); res.status(500).json({ error: 'Failed to fetch settings' }); }
// });

// app.get('/api/widget/session', async (req, res) => {
//   try {
//     const { store } = req.query;
//     if (!store) return res.status(400).json({ error: 'store parameter required' });
//     const storeRecord = await getCachedStore(store);                              // OPTIMISED
//     if (!storeRecord || !storeRecord.is_active) return res.status(404).json({ error: 'Store not found or inactive' });
//     const { generateWidgetToken } = require('./auth');
//     const token = generateWidgetToken(storeRecord);
//     res.json({ token, expiresIn: process.env.WIDGET_JWT_EXPIRES_IN || '2h' });
//   } catch (error) { console.error('Widget session error:', error); res.status(500).json({ error: 'Failed to create widget session' }); }
// });

// // OPTIMISED — was doing a full table scan as fallback
// app.get('/api/widget/conversation/lookup', async (req, res) => {
//   try {
//     const { store, email } = req.query;
//     if (!store || !email) return res.status(400).json({ error: 'store and email parameters required' });

//     const storeRecord = await getCachedStore(store);
//     if (!storeRecord || !storeRecord.is_active)
//       return res.status(404).json({ error: 'Store not found or inactive' });

//     // Single indexed query — no more full table scan fallback
//     const { rows } = await db.pool.query(
//       `SELECT id FROM conversations
//         WHERE customer_email = $1
//           AND shop_id = $2
//         ORDER BY
//           CASE WHEN status = 'open' THEN 0 ELSE 1 END,
//           updated_at DESC
//         LIMIT 1`,
//       [email, storeRecord.id]
//     );

//     return res.json({ conversationId: rows[0]?.id ?? null });
//   } catch (error) {
//     console.error('Widget lookup error:', error);
//     return res.status(500).json({ error: 'Lookup failed' });
//   }
// });




// app.get('/api/stores/groups', authenticateToken, async (req, res) => {
//   try {
//     const groups = await db.getAllStoreGroups();
//     res.json(groups.map(snakeToCamel));
//   } catch (error) {
//     console.error('Get store groups error:', error);
//     res.status(500).json({ error: 'Failed to fetch store groups' });
//   }
// });

// // app.post('/api/stores/groups', authenticateToken, async (req, res) => {
// //   try {
// //     if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin access required' });
// //     const { groupKey, groupName } = req.body;
// //     if (!groupKey?.trim())  return res.status(400).json({ error: 'groupKey is required' });
// //     if (!groupName?.trim()) return res.status(400).json({ error: 'groupName is required' });
// //     const group = await db.createStoreGroup({ group_key: groupKey.trim(), group_name: groupName.trim() });
// //     res.status(201).json(snakeToCamel({ ...group, store_count: 0 }));
// //   } catch (error) {
// //     if (error.code === '23505') return res.status(409).json({ error: 'A group with that key already exists' });
// //     res.status(500).json({ error: error.message });
// //   }
// // });

// // app.put('/api/stores/groups/:id', authenticateToken, async (req, res) => {
// //   try {
// //     if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin access required' });
// //     const { groupKey, groupName } = req.body;
// //     if (!groupKey?.trim())  return res.status(400).json({ error: 'groupKey is required' });
// //     if (!groupName?.trim()) return res.status(400).json({ error: 'groupName is required' });
// //     const group = await db.updateStoreGroup(req.params.id, { group_key: groupKey.trim(), group_name: groupName.trim() });
// //     if (!group) return res.status(404).json({ error: 'Group not found' });
// //     appCache.invalidatePrefix('stores:active');
// //     appCache.invalidate('stores:all');
// //     res.json(snakeToCamel(group));
// //   } catch (error) {
// //     if (error.code === '23505') return res.status(409).json({ error: 'A group with that key already exists' });
// //     res.status(500).json({ error: error.message });
// //   }
// // });


// async function resolveGroupId(identifier) {
//   if (identifier == null) return null;
//   if (/^\d+$/.test(String(identifier))) return parseInt(identifier, 10); // already an id
//   const { rows } = await db.pool.query(
//     `SELECT id FROM store_groups WHERE group_key = $1 LIMIT 1`,
//     [String(identifier)]
//   );
//   return rows[0]?.id ?? null;
// }

// app.post('/api/stores/groups', authenticateToken, async (req, res) => {
//   try {
//     if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin access required' });
//     const { groupKey, groupName, color } = req.body;
//     if (!groupKey?.trim())  return res.status(400).json({ error: 'groupKey is required' });
//     if (!groupName?.trim()) return res.status(400).json({ error: 'groupName is required' });
//     const group = await db.createStoreGroup({ group_key: groupKey.trim(), group_name: groupName.trim(), color });
//     res.status(201).json(snakeToCamel({ ...group, store_count: 0 }));
//   } catch (error) {
//     if (error.code === '23505') return res.status(409).json({ error: 'A group with that key already exists' });
//     res.status(500).json({ error: error.message });
//   }
// });

// app.put('/api/stores/groups/:id', authenticateToken, async (req, res) => {
//   try {
//     if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin access required' });
//     const { groupKey, groupName, color } = req.body;
//     if (!groupKey?.trim())  return res.status(400).json({ error: 'groupKey is required' });
//     if (!groupName?.trim()) return res.status(400).json({ error: 'groupName is required' });

//     const id = await resolveGroupId(req.params.id);
//     if (id == null) return res.status(404).json({ error: 'Group not found' });

//     const group = await db.updateStoreGroup(id, { group_key: groupKey.trim(), group_name: groupName.trim(), color });
//     if (!group) return res.status(404).json({ error: 'Group not found' });

//     // keep the denormalised name on stores in sync with the renamed group
//     await db.pool.query(
//       `UPDATE stores SET store_group_name = $2, updated_at = NOW() WHERE store_group = $1`,
//       [groupKey.trim(), groupName.trim()]
//     );

//     appCache.invalidatePrefix('stores:active');
//     appCache.invalidate('stores:all');
//     res.json(snakeToCamel(group));
//   } catch (error) {
//     if (error.code === '23505') return res.status(409).json({ error: 'A group with that key already exists' });
//     res.status(500).json({ error: error.message });
//   }
// });

// app.delete('/api/stores/groups/:id', authenticateToken, async (req, res) => {
//   try {
//     if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin access required' });
//     const force = req.query.force === 'true';

//     const id = await resolveGroupId(req.params.id);
//     if (id == null) return res.status(404).json({ error: 'Group not found' });

//     const result = await db.deleteStoreGroup(id, { force });
//     if (result.reason === 'not_found') return res.status(404).json({ error: 'Group not found' });
//     if (result.reason === 'has_stores') {
//       return res.status(409).json({
//         error: `Group has ${result.storeCount} store(s) assigned. Pass ?force=true to unassign them and delete anyway.`,
//         storeCount: result.storeCount,
//       });
//     }
//     appCache.invalidatePrefix('stores:active');
//     appCache.invalidate('stores:all');
//     res.json({ success: true, unassignedStores: result.unassignedStores || 0 });
//   } catch (error) { res.status(500).json({ error: error.message }); }
// });


// // ============ AUTHENTICATION ENDPOINTS ============

// app.post('/api/employees/login', loginLimiter, async (req, res) => {
//   try {
//     const { email, password } = req.body;
//     if (!email || !password) return res.status(400).json({ error: 'Email and password required' });
//     if (!email.includes('@')) return res.status(400).json({ error: 'Invalid email format' });
//     const employee = await db.getEmployeeByEmail(email);
//     if (!employee) return res.status(401).json({ error: 'Invalid email or password' });
//     if (!employee.is_active) return res.status(403).json({ error: 'Account is inactive' });
//     const validPassword = await verifyPassword(password, employee.password_hash);
//     if (!validPassword) return res.status(401).json({ error: 'Invalid email or password' });
//     await db.updateEmployeeStatus(employee.id, { last_login: new Date(), is_online: true });
//     const token = generateToken(employee);
//     delete employee.password_hash; delete employee.api_token;
//     res.json({ employee: snakeToCamel(employee), token, expiresIn: '7d' });
//   } catch (error) { console.error('Login error:', error); res.status(500).json({ error: 'Login failed. Please try again.' }); }
// });

// app.post('/api/employees/logout', authenticateToken, async (req, res) => {
//   try { await db.updateEmployeeStatus(req.user.id, { is_online: false }); res.json({ message: 'Logged out successfully' }); }
//   catch (error) { console.error('Logout error:', error); res.status(500).json({ error: 'Logout failed' }); }
// });

// app.get('/api/auth/verify', authenticateToken, async (req, res) => {
//   try {
//     const cacheKey = `auth:${req.user.email}`;
//     let employee = appCache.get(cacheKey);
//     if (!employee) {
//       employee = await db.getEmployeeByEmail(req.user.email);
//       if (employee) {
//         const { password_hash, api_token, ...safe } = employee;
//         employee = safe;
//         appCache.set(cacheKey, employee);
//         setTimeout(() => appCache.invalidate(cacheKey), 30 * 1000);
//       }
//     }
//     if (!employee || !employee.is_active) return res.status(403).json({ error: 'Invalid session' });
//     res.json({ employee: snakeToCamel(employee) });
//   } catch (error) { res.status(500).json({ error: 'Verification failed' }); }
// });


// app.get('/auth', async (req, res) => {
//   try {
//     const { shop } = req.query;
//     if (!shop) return res.status(400).json({ error: 'Shop parameter required' });
//     const authUrl = await getAuthUrl(shop);
//     res.redirect(authUrl);
//   } catch (error) { console.error('Auth error:', error); res.status(500).json({ error: 'Authentication failed' }); }
// });

// app.get('/auth/callback', handleCallback);
// app.use('/shopify', shopifyAppRoutes);
// app.use('/api/files', fileRoutes);
// app.use('/api/ai/training', aiTrainingRoutes);
// // ── AI suggestion routes (analyze-image, suggestions, brain-debug, brain-cache/clear) ──
// // Mounted AFTER /api/ai/training so the more-specific training mount resolves first.
// app.use('/api/ai', createAiRoutes({ getCachedStore }));

// // ============ HOURLY DISCORD RESPONSE-TIME REPORT ============

// const DISCORD_STATS_WEBHOOK = process.env.DISCORD_STATS_WEBHOOK;

// function formatDuration(minutes) {
//   if (minutes == null) return 'n/a';
//   const totalSeconds = Math.round(minutes * 60);
//   if (totalSeconds < 60) return `${totalSeconds}s`;
//   if (totalSeconds < 3600) {
//     const m = Math.floor(totalSeconds / 60);
//     const s = totalSeconds % 60;
//     return s === 0 ? `${m}m` : `${m}m ${s}s`;
//   }
//   const h = Math.floor(totalSeconds / 3600);
//   const m = Math.floor((totalSeconds % 3600) / 60);
//   return m === 0 ? `${h}h` : `${h}h ${m}m`;
// }

// async function sendHourlyResponseTimeStats() {
//   if (!DISCORD_STATS_WEBHOOK) { console.log('📊 [Discord Stats] No webhook configured — skipping'); return; }
//   try {
//     const { rows: perAgent } = await db.pool.query(`
//       WITH real_messages AS (
//         SELECT id, conversation_id, sender_id, sender_type, sent_at,
//           LAG(sender_type) OVER (PARTITION BY conversation_id ORDER BY sent_at) AS prev_sender_type,
//           LAG(sent_at)     OVER (PARTITION BY conversation_id ORDER BY sent_at) AS prev_sent_at,
//           LAG(read_at)     OVER (PARTITION BY conversation_id ORDER BY sent_at) AS prev_read_at
//         FROM messages
//         WHERE sender_type IN ('customer', 'agent')
//           AND NOT (sender_type = 'agent' AND sender_id IS NULL)
//       ),
//       rt AS (
//         SELECT sender_id,
//           EXTRACT(EPOCH FROM (sent_at - COALESCE(prev_read_at, prev_sent_at))) / 60.0 AS minutes
//         FROM real_messages
//         WHERE sender_type = 'agent'
//           AND sender_id IS NOT NULL
//           AND prev_sender_type = 'customer'
//           AND prev_sent_at IS NOT NULL
//           AND sent_at >= NOW() - INTERVAL '1 hour'
//           AND EXTRACT(EPOCH FROM (sent_at - COALESCE(prev_read_at, prev_sent_at))) / 60.0 BETWEEN 0 AND 240
//       )
//       SELECT
//         COALESCE(e.employee_name, e.name, 'Unknown #' || rt.sender_id) AS display_name,
//         ROUND(AVG(rt.minutes)::numeric, 3) AS avg_minutes,
//         ROUND(MIN(rt.minutes)::numeric, 3) AS fastest_minutes,
//         COUNT(*)::int AS replies
//       FROM rt
//       LEFT JOIN employees e ON e.id::text = rt.sender_id
//       GROUP BY display_name
//       ORDER BY replies DESC, avg_minutes ASC
//     `);
//     if (perAgent.length === 0) { console.log('📊 [Discord Stats] No activity in past hour — skipping post'); return; }
//     const { rows: teamRows } = await db.pool.query(`
//       WITH real_messages AS (
//         SELECT conversation_id, sender_type, sent_at,
//           LAG(sender_type) OVER (PARTITION BY conversation_id ORDER BY sent_at) AS prev_sender_type,
//           LAG(sent_at)     OVER (PARTITION BY conversation_id ORDER BY sent_at) AS prev_sent_at,
//           LAG(read_at)     OVER (PARTITION BY conversation_id ORDER BY sent_at) AS prev_read_at
//         FROM messages
//         WHERE sender_type IN ('customer', 'agent')
//           AND NOT (sender_type = 'agent' AND sender_id IS NULL)
//       )
//       SELECT
//         ROUND(AVG(EXTRACT(EPOCH FROM (sent_at - COALESCE(prev_read_at, prev_sent_at))) / 60.0)::numeric, 3) AS avg_minutes,
//         ROUND(MIN(EXTRACT(EPOCH FROM (sent_at - COALESCE(prev_read_at, prev_sent_at))) / 60.0)::numeric, 3) AS fastest_minutes,
//         COUNT(*)::int AS total_replies
//       FROM real_messages
//       WHERE sender_type = 'agent' AND prev_sender_type = 'customer'
//         AND prev_sent_at IS NOT NULL
//         AND sent_at >= NOW() - INTERVAL '1 hour'
//         AND EXTRACT(EPOCH FROM (sent_at - COALESCE(prev_read_at, prev_sent_at))) / 60.0 BETWEEN 0 AND 240
//     `);
//     const team = teamRows[0] || {};
//     const teamAvg = team.avg_minutes !== null ? parseFloat(team.avg_minutes) : null;
//     const teamFast = team.fastest_minutes !== null ? parseFloat(team.fastest_minutes) : null;
//     const teamTotal = team.total_replies || 0;
//     const fields = perAgent.slice(0, 25).map(r => ({
//       name: r.display_name,
//       value: `Avg: **${formatDuration(parseFloat(r.avg_minutes))}**\nFastest: ${formatDuration(parseFloat(r.fastest_minutes))}\nReplies: ${r.replies}`,
//       inline: true,
//     }));
//     const description = `**Team avg:** ${formatDuration(teamAvg)}  •  **Fastest:** ${formatDuration(teamFast)}  •  **Replies:** ${teamTotal}`;
//     const color = teamAvg === null ? 0x6b7280 : teamAvg <= 5 ? 0x10b981 : teamAvg <= 30 ? 0xf59e0b : 0xef4444;
//     const payload = { username: 'Response Time Bot', embeds: [{ title: '⏱️ Hourly Response Time Report', description, color, fields, timestamp: new Date().toISOString(), footer: { text: 'Past hour • Measured from when agent first viewed the message • Cap 4h per response' } }] };
//     const res = await fetch(DISCORD_STATS_WEBHOOK, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
//     if (!res.ok) { const err = await res.text(); console.error(`📊 [Discord Stats] Webhook ${res.status}: ${err}`); }
//     else { console.log(`📊 [Discord Stats] Sent — ${perAgent.length} agents, team avg ${formatDuration(teamAvg)}`); }
//   } catch (err) { console.error('📊 [Discord Stats] Error:', err.message); }
// }

// // ============ DAILY DISCORD ACTIVITY REPORT ============

// async function sendDailyActivityStats() {
//   const webhook = process.env.DISCORD_DAILY_WEBHOOK;
//   if (!webhook) { console.log('📊 [Discord Daily] No DISCORD_DAILY_WEBHOOK configured — skipping'); return; }
//   try {
//     const [convRows, msgRows, agentRows] = await Promise.all([          // OPTIMISED — parallel
//       db.pool.query(`
//         SELECT
//           (SELECT COUNT(*)::int FROM conversations WHERE created_at >= NOW() - INTERVAL '24 hours') AS new_convs,
//           (SELECT COUNT(DISTINCT conversation_id)::int FROM messages WHERE sent_at >= NOW() - INTERVAL '24 hours' AND sender_type IN ('customer','agent') AND NOT (sender_type = 'agent' AND sender_id IS NULL)) AS active_convs
//       `),
//       db.pool.query(`
//         SELECT
//           COUNT(*) FILTER (WHERE sender_type = 'agent' AND sender_id IS NOT NULL)::int AS sent_count,
//           COUNT(*) FILTER (WHERE sender_type = 'customer')::int AS received_count
//         FROM messages WHERE sent_at >= NOW() - INTERVAL '24 hours'
//       `),
//       db.pool.query(`
//         SELECT COALESCE(e.employee_name, e.name, 'Unknown #' || m.sender_id) AS display_name, COUNT(*)::int AS message_count
//         FROM messages m LEFT JOIN employees e ON e.id::text = m.sender_id
//         WHERE m.sender_type = 'agent' AND m.sender_id IS NOT NULL AND m.sent_at >= NOW() - INTERVAL '24 hours'
//         GROUP BY display_name ORDER BY message_count DESC
//       `)
//     ]);
//     const newConvs = convRows.rows[0]?.new_convs || 0;
//     const activeConvs = convRows.rows[0]?.active_convs || 0;
//     const sentCount = msgRows.rows[0]?.sent_count || 0;
//     const recvCount = msgRows.rows[0]?.received_count || 0;
//     const activeEmps = agentRows.rows.length;
//     const fields = [
//       { name: '💬 Conversations', value: `**${activeConvs}** active\n**${newConvs}** new`, inline: true },
//       { name: '📥 Received', value: `**${recvCount}** customer messages`, inline: true },
//       { name: '📤 Sent', value: `**${sentCount}** agent replies`, inline: true },
//     ];
//     if (agentRows.rows.length > 0) {
//       const topList = agentRows.rows.slice(0, 15).map(r => `**${r.display_name}** — ${r.message_count} msgs`).join('\n');
//       const remainder = agentRows.rows.length > 15 ? `\n_…and ${agentRows.rows.length - 15} more_` : '';
//       fields.push({ name: `👥 Active Employees (${activeEmps})`, value: topList + remainder, inline: false });
//     } else {
//       fields.push({ name: '👥 Active Employees', value: '_No employee activity_', inline: false });
//     }
//     const now = new Date();
//     const then = new Date(now.getTime() - 24 * 60 * 60 * 1000);
//     const fmtRange = (d) => d.toLocaleString('en-US', { timeZone: 'America/Toronto', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
//     const payload = { username: 'Daily Activity Bot', embeds: [{ title: '📅 Daily Activity Report', description: `**${fmtRange(then)} → ${fmtRange(now)}** (ET)`, color: 0x3b82f6, fields, timestamp: now.toISOString(), footer: { text: 'Past 24 hours • Excludes auto-replies' } }] };
//     const res = await fetch(webhook, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
//     if (!res.ok) { const err = await res.text(); console.error(`📊 [Discord Daily] Webhook ${res.status}: ${err}`); }
//     else { console.log(`📊 [Discord Daily] Sent — ${activeConvs} convs (${newConvs} new), ${sentCount} sent, ${recvCount} received, ${activeEmps} agents`); }
//   } catch (err) { console.error('📊 [Discord Daily] Error:', err.message); }
// }

// // ============ EMAIL SEND ============

// app.post('/api/email/send', authenticateToken, async (req, res) => {
//   const { to, subject, body, conversationId, customerName } = req.body;
//   if (!to || !subject || !body) return res.status(400).json({ error: 'to, subject, and body are required' });
//   try {
//     let brandName = 'Support', brandColor = '#1a5632', fromAddress = 'support@pepscustomercare.com';
//     let storeDomain = '', resolvedName = customerName || '';
//     if (conversationId) {
//       const r = await db.pool.query(
//         `SELECT c.customer_name, s.brand_name, s.shop_domain, s.primary_color, s.email_from_address, s.email_brand_color FROM conversations c JOIN stores s ON c.shop_id = s.id WHERE c.id = $1`,
//         [conversationId]);
//       if (r.rows.length) {
//         const row = r.rows[0];
//         brandName = row.brand_name || brandName; brandColor = row.email_brand_color || row.primary_color || brandColor;
//         fromAddress = row.email_from_address || fromAddress;
//         storeDomain = (row.shop_domain || '').replace(/^https?:\/\//, '').replace(/\/$/, '');
//         resolvedName = resolvedName || row.customer_name || '';
//       }
//     }
//     const apiKey = process.env.RESEND_API_KEY;
//     if (!apiKey) return res.status(500).json({ error: 'Email service not configured (missing RESEND_API_KEY)' });
//     const agentName = req.user?.name || req.user?.email || 'Support Team';
//     const year = new Date().getFullYear();
//     const greeting = resolvedName ? `Hi ${resolvedName},` : 'Hi there,';
//     const time = new Date().toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
//     const safeBody = body.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
//     const emailHtml = `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1.0"/><title>Message from ${brandName}</title></head>
// <body style="margin:0;padding:0;background:#f6f6f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
// <table width="100%" cellpadding="0" cellspacing="0" style="background:#f6f6f7;"><tr><td align="center" style="padding:40px 16px 24px;">
// <table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;">
// <tr><td style="padding-bottom:24px;"><table cellpadding="0" cellspacing="0"><tr>
// <td style="vertical-align:middle;padding-right:10px;"><img src="https://chatsupportpullzone.b-cdn.net/uploads/shopify_logo-removebg-preview.png" width="100" height="auto" alt="Shopify" style="display:block;border:0;"/></td>
// <td style="vertical-align:middle;"><span style="font-size:16px;font-weight:600;color:#202223;">${brandName}</span></td></tr></table></td></tr>
// <tr><td style="background:#fff;border-radius:8px;border:1px solid #e1e3e5;overflow:hidden;">
// <table width="100%" cellpadding="0" cellspacing="0"><tr><td style="height:4px;background:${brandColor};border-radius:8px 8px 0 0;"></td></tr></table>
// <table width="100%" cellpadding="0" cellspacing="0"><tr><td style="padding:32px 36px 36px;">
// <h1 style="margin:0 0 4px;font-size:22px;font-weight:700;color:#202223;">You have a new message</h1>
// <p style="margin:0 0 24px;font-size:14px;color:#6d7175;line-height:1.5;">${greeting} You have a new message from <strong>${agentName}</strong> at <strong>${brandName}</strong>.</p>
// <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;"><tr><td style="height:1px;background:#e1e3e5;"></td></tr></table>
// <table width="100%" cellpadding="0" cellspacing="0"><tr><td>
// <p style="margin:0 0 6px;font-size:13px;font-weight:600;color:#212326;">${agentName} <span style="font-size:12px;color:#8c9196;font-weight:400;margin-left:8px;">${time}</span></p>
// <div style="background:#f6f6f7;border-radius:6px;padding:14px 16px;font-size:14px;color:#202223;line-height:1.6;white-space:pre-wrap;border:1px solid #e1e3e5;">${safeBody}</div>
// </td></tr></table></td></tr></table></td></tr>
// <tr><td style="padding:24px 0 0;text-align:center;">
// <p style="margin:0 0 4px;font-size:12px;color:#8c9196;">This message was sent to you by the support team at ${storeDomain || brandName}.</p>
// <p style="margin:0;font-size:11px;color:#babec3;">&copy; ${year} ${brandName}</p></td></tr>
// </table></td></tr></table></body></html>`;
//     const resendRes = await fetch('https://api.resend.com/emails', {
//       method: 'POST', headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
//       body: JSON.stringify({ from: `${brandName} <${fromAddress}>`, to: [to], subject, html: emailHtml, text: `${greeting}\n\n${agentName}:\n${body}` }),
//     });
//     const resendBody = await resendRes.json();
//     if (!resendRes.ok) { console.error('[Email/send] Resend rejected:', resendBody); return res.status(502).json({ error: resendBody?.message || `Resend error ${resendRes.status}` }); }
//     console.log(`[Email/send] ✅ Sent to ${to} conv ${conversationId}`);
//     res.json({ ok: true, id: resendBody.id });
//   } catch (err) { console.error('[Email/send] Error:', err.message); res.status(500).json({ error: err.message }); }
// });

// // ============ PEPSTACK RECOMMENDATIONS ============

// app.post('/pepstack', async (req, res) => {
//   try {
//     const { goal, age, sex, height, weight } = req.body;
//     if (!goal) return res.status(400).json({ error: 'goal is required' });
//     const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
//     if (!ANTHROPIC_API_KEY) return res.status(500).json({ error: 'AI not configured' });
//     const brainSearchTerms = [goal, age ? `age ${age}` : '', sex || '', weight || ''].filter(Boolean).join(' ');
//     let brainContext = '', brainSettings = {};
//     try {
//       brainContext = await getBrainContext(db.pool, brainSearchTerms);
//       brainSettings = await getBrainSettings(db.pool);
//       console.log(`🧬 [PepStack] Brain loaded: ${brainContext.length} chars for goal="${goal}"`);
//     } catch (brainErr) { console.warn('[PepStack] Brain load failed:', brainErr.message); }
//     const brainBlock = brainContext.trim() ? `\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\nSTORE KNOWLEDGE BASE — USE THIS AS YOUR PRIMARY SOURCE\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n${brainContext}\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` : '';
//     const systemPrompt = `${brainBlock}You are a peptide protocol advisor for this store. Use the store knowledge base above as your PRIMARY source. Respond ONLY with valid JSON — no markdown, no preamble.\n\nJSON structure:\n{\n  "summary": "2-3 sentence personalised intro",\n  "stack": [{ "name": "Exact product name", "why": "1-2 sentences", "dose": "Dosing guidance" }],\n  "tip": "One practical stack or timing tip"\n}\n\nRules: 2-4 peptides max, exact product names from brain, no disclaimers inside JSON`;
//     const userMsg = [`Goal: ${goal}`, age ? `Age: ${age}` : null, sex ? `Sex: ${sex}` : null, height ? `Height: ${height}` : null, weight ? `Weight: ${weight}` : null].filter(Boolean).join('\n');
//     const userPrompt = brainContext.trim() ? `${brainBlock}Customer profile:\n${userMsg}\n\nUsing the store knowledge base above, recommend the best peptide stack. Return only JSON.` : `Customer profile:\n${userMsg}\n\nRecommend the best peptide stack. Return only JSON.`;
//     const requestBody = JSON.stringify({ model: 'claude-haiku-4-5-20251001', max_tokens: 800, system: systemPrompt, messages: [{ role: 'user', content: userPrompt }] });
//     const data = await callAnthropicAPIWithRetry(requestBody, ANTHROPIC_API_KEY);
//     const raw = data.content?.[0]?.text || '';
//     const cleaned = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
//     let parsed;
//     try { parsed = JSON.parse(cleaned); } catch (e) { console.error('[PepStack] JSON parse error:', raw); return res.status(500).json({ error: 'Failed to parse AI response' }); }
//     return res.json(parsed);
//   } catch (err) { console.error('[PepStack] Error:', err.message); return res.status(500).json({ error: 'Internal server error' }); }
// });

// // ============ STORE ENDPOINTS ============

// app.get('/api/stores', authenticateToken, async (req, res) => {
//   try {
//     const { storeGroup } = req.query;
//     const cacheKey = storeGroup ? `stores:active:${storeGroup}` : 'stores:active';
//     const cached = appCache.get(cacheKey);
//     if (cached) return res.json(cached);
//     const stores = storeGroup
//       ? await db.getStoresByFilters({ storeGroup })
//       : await db.getAllActiveStores();
//     const result = stores.map(snakeToCamel);
//     appCache.set(cacheKey, result);
//     res.json(result);
//   } catch (error) { res.status(500).json({ error: error.message }); }
// });


// app.get('/api/stores/all', authenticateToken, async (req, res) => {
//   try {
//     if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin access required' });
//     const cached = appCache.get('stores:all');
//     if (cached) return res.json(cached);
//     const result = await db.pool.query('SELECT * FROM stores ORDER BY brand_name ASC');
//     const stores = result.rows.map(snakeToCamel);
//     appCache.set('stores:all', stores);
//     res.json(stores);
//   } catch (error) { res.status(500).json({ error: error.message }); }
// });



// app.post('/api/stores', authenticateToken, async (req, res) => {
//   try {
//     if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin access required' });
//     const { storeIdentifier, shopDomain, brandName, isActive, storeGroup, storeGroupName } = req.body;
//     if (!storeIdentifier || !shopDomain || !brandName) return res.status(400).json({ error: 'storeIdentifier, shopDomain, and brandName are required' });
//     const result = await db.pool.query(
//       `INSERT INTO stores (store_identifier, shop_domain, brand_name, is_active, store_group, store_group_name, access_token, installed_at, updated_at)
//        VALUES ($1, $2, $3, $4, $5, $6, '', NOW(), NOW()) RETURNING *`,
//       [storeIdentifier, shopDomain, brandName, isActive !== false, storeGroup ?? 'peptides-group', storeGroupName ?? null]
//     );
//     appCache.invalidatePrefix('stores:active'); 
//     appCache.invalidate('stores:all');
//     res.status(201).json(snakeToCamel(result.rows[0]));
//   } catch (error) {
//     if (error.code === '23505') return res.status(409).json({ error: 'A store with that identifier or domain already exists' });
//     res.status(500).json({ error: error.message });
//   }
// });


// // app.post('/api/stores', authenticateToken, async (req, res) => {
// //   try {
// //     if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin access required' });
// //     const { storeIdentifier, shopDomain, brandName, isActive } = req.body;
// //     if (!storeIdentifier || !shopDomain || !brandName) return res.status(400).json({ error: 'storeIdentifier, shopDomain, and brandName are required' });
// //     const result = await db.pool.query(`INSERT INTO stores (store_identifier, shop_domain, brand_name, is_active, access_token, installed_at, updated_at) VALUES ($1, $2, $3, $4, '', NOW(), NOW()) RETURNING *`, [storeIdentifier, shopDomain, brandName, isActive !== false]);
// //     // Invalidate store list caches
// //     appCache.invalidate('stores:active');
// //     appCache.invalidate('stores:all');
// //     res.status(201).json(snakeToCamel(result.rows[0]));
// //   } catch (error) {
// //     if (error.code === '23505') return res.status(409).json({ error: 'A store with that identifier or domain already exists' });
// //     res.status(500).json({ error: error.message });
// //   }
// // });

// // app.put('/api/stores/:id', authenticateToken, async (req, res) => {
// //   try {
// //     if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin access required' });
// //     const { shopDomain, brandName, isActive } = req.body;
// //     const result = await db.pool.query(`UPDATE stores SET shop_domain = $1, brand_name = $2, is_active = $3, updated_at = NOW() WHERE id = $4 RETURNING *`, [shopDomain, brandName, isActive !== false, req.params.id]);
// //     if (!result.rows[0]) return res.status(404).json({ error: 'Store not found' });
// //     // Invalidate all store caches for this store
// //     invalidateStoreCache(result.rows[0].store_identifier);
// //     invalidateStoreCache(result.rows[0].shop_domain);
// //     res.json(snakeToCamel(result.rows[0]));
// //   } catch (error) { res.status(500).json({ error: error.message }); }
// // });


// app.put('/api/stores/:id', authenticateToken, async (req, res) => {
//   try {
//     if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin access required' });
//     const { shopDomain, brandName, isActive, storeGroup, storeGroupName } = req.body;
//     const result = await db.pool.query(
//       `UPDATE stores SET shop_domain = $1, brand_name = $2, is_active = $3, store_group = $4, store_group_name = $5, updated_at = NOW() WHERE id = $6 RETURNING *`,
//       [shopDomain, brandName, isActive !== false, storeGroup ?? null, storeGroupName ?? null, req.params.id]
//     );
//     if (!result.rows[0]) return res.status(404).json({ error: 'Store not found' });
//     // Invalidate all store caches for this store
//     invalidateStoreCache(result.rows[0].store_identifier);
//     invalidateStoreCache(result.rows[0].shop_domain);
//     res.json(snakeToCamel(result.rows[0]));
//   } catch (error) { res.status(500).json({ error: error.message }); }
// });


// app.patch('/api/stores/:id/group', authenticateToken, async (req, res) => {
//   try {
//     if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin access required' });
//     const { storeGroup, storeGroupName } = req.body;
//     const result = await db.pool.query(
//       `UPDATE stores
//          SET store_group = COALESCE($1, store_group),
//              store_group_name = COALESCE($2, store_group_name),
//              updated_at = NOW()
//        WHERE id = $3
//        RETURNING *`,
//       [storeGroup ?? null, storeGroupName ?? null, req.params.id]
//     );
//     if (!result.rows[0]) return res.status(404).json({ error: 'Store not found' });
//     invalidateStoreCache(result.rows[0].store_identifier);
//     invalidateStoreCache(result.rows[0].shop_domain);
//     res.json(snakeToCamel(result.rows[0]));
//   } catch (error) { res.status(500).json({ error: error.message }); }
// });


// app.delete('/api/stores/:id', authenticateToken, async (req, res) => {
//   try {
//     if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin access required' });
//     // Fetch before delete so we can invalidate by identifier
//     const lookup = await db.pool.query('SELECT store_identifier, shop_domain FROM stores WHERE id = $1', [req.params.id]);
//     const result = await db.pool.query(`DELETE FROM stores WHERE id = $1 RETURNING id`, [req.params.id]);
//     if (!result.rows[0]) return res.status(404).json({ error: 'Store not found' });
//     if (lookup.rows[0]) {
//       invalidateStoreCache(lookup.rows[0].store_identifier);
//       invalidateStoreCache(lookup.rows[0].shop_domain);
//     }
//     res.json({ success: true });
//   } catch (error) { res.status(500).json({ error: error.message }); }
// });

// app.get('/api/customer-context/:storeId/:email', authenticateToken, async (req, res) => {
//   try {
//     const store = await getCachedStore(req.params.storeId);                       // OPTIMISED
//     if (!store) return res.status(404).json({ error: 'Store not found' });
//     const context = await shopify.getCustomerContext(store, req.params.email);
//     res.json(context);
//   } catch (error) { console.error('Customer context error:', error); res.status(500).json({ error: 'Failed to fetch customer context' }); }
// });

// // ============ CUSTOMER & ORDER LOOKUP ============

// app.get('/api/customers/lookup', async (req, res) => {
//   try {
//     const { store: storeIdentifier, email } = req.query;
//     if (!storeIdentifier || !email) return res.status(400).json({ error: 'store and email parameters required' });
//     const store = await getCachedStore(storeIdentifier);
//     if (!store || !store.is_active) return res.status(404).json({ error: 'Store not found or inactive' });
//     const cacheKey = `shopify:${store.id}:${email}`;
//     let customerContext = appCache.get(cacheKey);
//     if (!customerContext) {
//       customerContext = await shopify.getCustomerContext(store, email);
//       if (customerContext) {
//         appCache.set(cacheKey, customerContext);
//         setTimeout(() => appCache.invalidate(cacheKey), 5 * 60 * 1000);
//       }
//     }
//     if (!customerContext?.customer) return res.status(404).json({ error: 'Customer not found' });
//     const customer = customerContext.customer;
//     res.json({ id: customer.id, name: customer.name || `${customer.first_name || ''} ${customer.last_name || ''}`.trim(),
//       email: customer.email, phone: customer.phone, createdAt: customer.created_at, updatedAt: customer.updated_at,
//       ordersCount: customer.orders_count || 0, totalSpent: customer.total_spent ? parseFloat(customer.total_spent) : 0,
//       tags: customer.tags, note: customer.note });
//   } catch (error) { console.error('Customer lookup error:', error); res.status(500).json({ error: 'Failed to fetch customer data', message: error.message }); }
// });



// app.get('/api/customers/orders', async (req, res) => {
//   try {
//     const { store: storeIdentifier, email } = req.query;
//     if (!storeIdentifier || !email) return res.status(400).json({ error: 'store and email parameters required' });
//     const store = await getCachedStore(storeIdentifier);
//     if (!store || !store.is_active) return res.status(404).json({ error: 'Store not found or inactive' });
//     const cacheKey = `shopify:${store.id}:${email}`;
//     let customerContext = appCache.get(cacheKey);
//     if (!customerContext) {
//       customerContext = await shopify.getCustomerContext(store, email);
//       if (customerContext) {
//         appCache.set(cacheKey, customerContext);
//         setTimeout(() => appCache.invalidate(cacheKey), 5 * 60 * 1000);
//       }
//     }
//     if (!customerContext?.orders) return res.json([]);
//     const formattedOrders = customerContext.orders.map(order => ({
//       id: order.id, orderNumber: order.order_number || order.name, status: order.financial_status || 'pending',
//       fulfillmentStatus: order.fulfillment_status, total: order.total_price ? parseFloat(order.total_price) : 0,
//       currency: order.currency, orderDate: order.created_at,
//       items: order.line_items ? order.line_items.map(item => ({ id: item.id, title: item.title, quantity: item.quantity, price: parseFloat(item.price) })) : [],
//       trackingNumber: order.tracking_number, trackingUrl: order.tracking_url }));
//     formattedOrders.sort((a, b) => new Date(b.orderDate) - new Date(a.orderDate));
//     res.json(formattedOrders);
//   } catch (error) { console.error('Customer orders error:', error); res.status(500).json({ error: 'Failed to fetch orders', message: error.message }); }
// });


// app.get('/api/customers/cart', (req, res) => {
//   res.json({ subtotal: 0, items: [], itemCount: 0 });
// });


// app.post('/api/stores/:storeId/webhooks', authenticateToken, async (req, res) => {
//   try {
//     const store = await getCachedStore(req.params.storeId);                       // OPTIMISED
//     if (!store) return res.status(404).json({ error: 'Store not found' });
//     const webhookUrl = req.body.webhookUrl || `${process.env.APP_URL}/webhooks`;
//     const results = await shopify.registerWebhooks(store, webhookUrl);
//     res.json({ results });
//   } catch (error) { res.status(500).json({ error: error.message }); }
// });

// // ============ NOTES ============

// app.get('/api/employees/:employeeId/notes', authenticateToken, async (req, res) => {
//   try {
//     const result = await db.pool.query(
//       `SELECT id, employee_id, employee_name, title, content, created_at, updated_at
//          FROM employee_notes
//         ORDER BY created_at DESC
//         LIMIT 500`
//     );
//     res.json(result.rows.map(snakeToCamel));
//   } catch (error) { console.error('❌ Error fetching notes:', error); res.status(500).json({ error: 'Failed to fetch notes' }); }
// });

// app.post('/api/conversation-notes', authenticateToken, async (req, res) => {
//   try {
//     const { employeeId, title, content } = req.body;
//     if (!employeeId) return res.status(400).json({ error: 'Missing employeeId' });
//     if (!title && !content) return res.status(400).json({ error: 'Note must have a title or content' });
//     const noteTitle = (title && title.trim()) || 'Untitled';
//     const noteContent = (content && content.trim()) || '';
//     if (noteTitle.length > 200) return res.status(400).json({ error: 'Title exceeds 200 characters' });
//     if (noteContent.length > 5000) return res.status(400).json({ error: 'Content exceeds 5000 characters' });
//     const employeeName = req.user.name || req.user.email || 'Unknown';
//     const result = await db.pool.query(`INSERT INTO employee_notes (employee_id, employee_name, title, content, created_at, updated_at) VALUES ($1, $2, $3, $4, NOW(), NOW()) RETURNING id, employee_id, employee_name, title, content, created_at, updated_at`, [employeeId, employeeName, noteTitle, noteContent]);
//     res.status(201).json(snakeToCamel(result.rows[0]));
//   } catch (error) { console.error('Error creating note:', error); res.status(500).json({ error: 'Failed to create note' }); }
// });


// app.delete('/api/conversation-notes/:noteId', authenticateToken, async (req, res) => {
//   try {
//     const noteId = parseInt(req.params.noteId);
//     const employeeId = req.user.id;
//     const noteResult = await db.pool.query('SELECT employee_id FROM employee_notes WHERE id = $1', [noteId]);
//     if (noteResult.rows.length === 0) return res.status(404).json({ error: 'Note not found' });
//     if (noteResult.rows[0].employee_id !== employeeId) return res.status(403).json({ error: 'You can only delete your own notes' });
//     await db.pool.query('DELETE FROM employee_notes WHERE id = $1', [noteId]);
//     res.json({ success: true, message: 'Note deleted' });
//   } catch (error) { console.error('Error deleting note:', error); res.status(500).json({ error: 'Failed to delete note' }); }
// });

// // ============ CONVERSATION ENDPOINTS ============

// // app.get('/api/conversations', authenticateToken, async (req, res) => {
// //   try {
// //     const { storeId, status, limit, offset } = req.query;
// //     const filters = {};
// //     if (storeId) filters.storeId = parseInt(storeId);
// //     if (status) filters.status = status;
// //     else filters.excludeArchived = true;
// //     if (limit) filters.limit = parseInt(limit);
// //     if (offset) filters.offset = parseInt(offset);

// //     const cacheKey = `convs:${storeId || 'all'}:${status || 'open'}:${limit || 'def'}:${offset || '0'}`;
// //     const cached = appCache.get(cacheKey);
// //     if (cached) return res.json(cached);

// //     const conversations = await db.getConversations(filters);
// //     const result = conversations.map(snakeToCamel);
// //     appCache.set(cacheKey, result);
// //     setTimeout(() => appCache.invalidate(cacheKey), 10 * 1000);

// //     res.json(result);
// //   } catch (error) { console.error('Get conversations error:', error); res.status(500).json({ error: error.message }); }
// // });


// app.get('/api/conversations', authenticateToken, async (req, res) => {
//   try {
//     const { storeId, status, limit, offset, storeGroup } = req.query;
//     const filters = {};
//     if (storeId) filters.storeId = parseInt(storeId);
//     if (status) filters.status = status;
//     else filters.excludeArchived = true;
//     if (limit) filters.limit = parseInt(limit);
//     if (offset) filters.offset = parseInt(offset);
//     if (storeGroup) filters.storeGroup = storeGroup;

//     const cacheKey = `convs:${storeId || 'all'}:${status || 'open'}:${limit || 'def'}:${offset || '0'}:${storeGroup || 'allgroups'}`;
//     const cached = appCache.get(cacheKey);
//     if (cached) return res.json(cached);

//     const conversations = await db.getConversations(filters);
//     const result = conversations.map(snakeToCamel);
//     appCache.set(cacheKey, result);
//     setTimeout(() => appCache.invalidate(cacheKey), 10 * 1000);

//     res.json(result);
//   } catch (error) { console.error('Get conversations error:', error); res.status(500).json({ error: error.message }); }
// });


// app.get('/api/widget/history', async (req, res) => {
//   try {
//     const { email, excludeConversationId } = req.query;
//     if (!email || !email.includes('@')) return res.status(400).json({ error: 'Valid email required' });
//     const result = await db.pool.query(`
//       SELECT c.id, c.status, c.updated_at, c.shop_id, c.shop_domain,
//         COALESCE(s.brand_name, c.shop_domain, 'Unknown Store') AS brand_name,
//         m.content AS last_message_content, m.sender_type AS last_message_sender_type, m.timestamp AS last_message_at
//       FROM conversations c LEFT JOIN stores s ON c.shop_id = s.id
//       LEFT JOIN LATERAL (SELECT content, sender_type, timestamp FROM messages WHERE conversation_id = c.id ORDER BY timestamp DESC LIMIT 1) m ON true
//       WHERE c.customer_email = $1 ${excludeConversationId ? 'AND c.id != $2' : ''} ORDER BY c.updated_at DESC
//     `, excludeConversationId ? [email, parseInt(excludeConversationId)] : [email]);
//     if (!result.rows.length) return res.json({ linkedConversations: [], storeCount: 0, totalConversations: 0 });
//     const byStore = {};
//     for (const row of result.rows) {
//       const storeKey = row.shop_id || row.shop_domain || 'unknown';
//       if (!byStore[storeKey]) byStore[storeKey] = { storeIdentifier: row.shop_domain, storeName: row.brand_name, shopId: row.shop_id, conversations: [] };
//       byStore[storeKey].conversations.push({ id: row.id, status: row.status, updatedAt: row.updated_at,
//         lastMessage: row.last_message_content ? { content: row.last_message_content.substring(0, 80), senderType: row.last_message_sender_type, createdAt: row.last_message_at } : null });
//     }
//     const storeGroups = Object.values(byStore);
//     return res.json({ linkedConversations: storeGroups, storeCount: storeGroups.length, totalConversations: result.rows.length });
//   } catch (error) { console.error('❌ [widget/history] Error:', error); return res.status(500).json({ error: 'Failed to fetch history' }); }
// });

// app.get('/api/conversations/linked/:email', authenticateToken, async (req, res) => {
//   try {
//     const { email } = req.params; const { excludeConversationId } = req.query;
//     if (!email || !email.includes('@')) return res.status(400).json({ error: 'Valid email required' });

//     const cacheKey = `linked:${email}:${excludeConversationId || 'none'}`;
//     const cached = appCache.get(cacheKey);
//     if (cached) return res.json(cached);

//     const result = await db.pool.query(`
//       SELECT c.id, c.status, c.created_at, c.updated_at, c.shop_domain, c.shop_id,
//         COALESCE(s.brand_name, c.shop_domain, 'Unknown Store') AS brand_name,
//         m.content AS last_message_content, m.sender_type AS last_message_sender_type, m.timestamp AS last_message_at
//       FROM conversations c LEFT JOIN stores s ON c.shop_id = s.id
//       LEFT JOIN LATERAL (SELECT content, sender_type, timestamp FROM messages WHERE conversation_id = c.id ORDER BY timestamp DESC LIMIT 1) m ON true
//       WHERE c.customer_email = $1 ${excludeConversationId ? 'AND c.id != $2' : ''} ORDER BY c.updated_at DESC
//     `, excludeConversationId ? [email, parseInt(excludeConversationId)] : [email]);

//     if (!result.rows.length) return res.json({ linkedConversations: [], storeCount: 0 });

//     const byStore = {};
//     for (const row of result.rows) {
//       const storeKey = row.shop_id || row.shop_domain || 'unknown';
//       if (!byStore[storeKey]) byStore[storeKey] = { storeIdentifier: row.shop_domain, storeName: row.brand_name, shopId: row.shop_id, conversations: [] };
//       byStore[storeKey].conversations.push({ id: row.id, status: row.status, createdAt: row.created_at, updatedAt: row.updated_at, messageCount: 0,
//         lastMessage: row.last_message_content ? { content: row.last_message_content, senderType: row.last_message_sender_type, createdAt: row.last_message_at } : null });
//     }
//     const storeGroups = Object.values(byStore);
//     const response = { customerEmail: email, linkedConversations: storeGroups, storeCount: storeGroups.length, totalConversations: result.rows.length };

//     appCache.set(cacheKey, response);
//     setTimeout(() => appCache.invalidate(cacheKey), 15 * 1000);

//     return res.json(response);
//   } catch (error) { console.error('❌ [linked-conversations] Error:', error); return res.status(500).json({ error: 'Failed to fetch linked conversations' }); }
// });


// app.get('/api/conversations/search', authenticateToken, async (req, res) => {
//   try {
//     const q = (req.query.q || '').trim();
//     if (q.length < 2) return res.json([]);
//     const limit = Math.min(200, parseInt(req.query.limit) || 100);
//     const { storeGroup, storeId } = req.query;

//     const likeEscape = (s) => s.replace(/[\\%_]/g, (c) => '\\' + c);
//     const pattern = `%${likeEscape(q)}%`;

//     const params = [pattern, limit];
//     const scope = [];
//     if (storeGroup) {
//       params.push(storeGroup);
//       scope.push(`c.shop_id IN (SELECT id FROM stores WHERE store_group = $${params.length})`);
//     }
//     if (storeId) {
//       params.push(storeId);
//       scope.push(`(c.store_identifier = $${params.length} OR c.shop_domain = $${params.length})`);
//     }
//     const scopeSql = scope.length ? `AND ${scope.join(' AND ')}` : '';

//     // matched = ids hit by name/email/OR any message body; then enrich with the
//     // latest message so preview + sort match the normal list. Lateral aliases
//     // override same-named conversation columns (last-wins in node-pg).
//     const { rows } = await db.pool.query(`
//       WITH matched AS (
//         SELECT c.id
//         FROM conversations c
//         WHERE c.status NOT IN ('archived','blacklisted','blacklist')
//           ${scopeSql}
//           AND (
//             c.customer_name  ILIKE $1
//             OR c.customer_email ILIKE $1
//             OR EXISTS (
//               SELECT 1 FROM messages m
//               WHERE m.conversation_id = c.id AND m.content ILIKE $1
//             )
//           )
//       )
//       SELECT c.*,
//              lm.content     AS last_message,
//              lm.sender_type AS last_message_sender_type,
//              lm.sent_at     AS last_message_at
//       FROM conversations c
//       JOIN matched ON matched.id = c.id
//       LEFT JOIN LATERAL (
//         SELECT content, sender_type, sent_at
//         FROM messages WHERE conversation_id = c.id
//         ORDER BY sent_at DESC LIMIT 1
//       ) lm ON true
//       ORDER BY lm.sent_at DESC NULLS LAST
//       LIMIT $2
//     `, params);

//     res.json(rows.map(snakeToCamel));
//   } catch (error) {
//     console.error('Conversation search error:', error);
//     res.status(500).json({ error: 'Search failed' });
//   }
// });

// app.get('/api/conversations/archived', authenticateToken, async (req, res) => {
//   try {
//     const page = Math.max(1, parseInt(req.query.page) || 1);
//     const limit = Math.min(100, parseInt(req.query.limit) || 30);
//     const offset = (page - 1) * limit;
//     const storeIdentifier = req.query.storeIdentifier || null;
//     const params = [limit, offset];
//     let whereExtra = '';
//     if (storeIdentifier) {
//       params.push(storeIdentifier);
//       whereExtra = `AND (c.store_identifier = $${params.length} OR c.shop_domain = $${params.length})`;
//     }
//     const { rows } = await db.pool.query(
//       `SELECT c.*, COUNT(*) OVER() AS total_count FROM conversations c WHERE c.status = 'archived' ${whereExtra} ORDER BY c.archived_at DESC NULLS LAST, c.updated_at DESC LIMIT $1 OFFSET $2`,
//       params
//     );
//     const total = rows.length ? parseInt(rows[0].total_count) : 0;
//     return res.json({
//       conversations: rows.map(r => { const row = { ...r }; delete row.total_count; return snakeToCamel(row); }),
//       pagination: { page, limit, total, pages: Math.ceil(total / limit) },
//     });
//   } catch (err) { console.error('❌ [archived list] Error:', err); return res.status(500).json({ error: 'Failed to fetch archived conversations' }); }
// });

// app.get('/api/conversations/:id', authenticateToken, async (req, res) => {
//   try {
//     const conversation = await db.getConversation(parseInt(req.params.id));
//     if (!conversation) return res.status(404).json({ error: 'Conversation not found' });
//     res.json(snakeToCamel(conversation));
//   } catch (error) { console.error('Error fetching conversation:', error); res.status(500).json({ error: error.message }); }
// });

// app.post('/api/conversations', async (req, res) => {
//   try {
//     const { storeIdentifier, customerEmail, customerName, initialMessage, fileData } = req.body;
//     if (!storeIdentifier || !customerEmail) return res.status(400).json({ error: 'storeIdentifier and customerEmail required' });
//     const store = await getCachedStore(storeIdentifier);                          // OPTIMISED
//     if (!store) return res.status(404).json({ error: 'Store not found' });
//     const blCheck = await db.pool.query(
//       `SELECT id FROM blacklist WHERE email = $1 AND removed_at IS NULL AND (store_identifier IS NULL OR store_identifier = $2) LIMIT 1`,
//       [customerEmail.toLowerCase().trim(), store.store_identifier]
//     );
//     if (blCheck.rowCount > 0) {
//       console.log(`🚫 [Blacklist] Blocked conversation attempt from ${customerEmail} on ${store.store_identifier}`);
//       return res.status(403).json({ error: 'blocked', message: 'Unable to start a conversation at this time.' });
//     }
//     const conversation = await db.saveConversation({ store_id: store.id, store_identifier: store.shop_domain, customer_email: customerEmail, customer_name: customerName || customerEmail, status: 'open', priority: 'normal' });
//     res.json(snakeToCamel(conversation));
//     setImmediate(async () => {
//       try {
//         if (initialMessage) {
//           const message = await db.saveMessage({ conversation_id: conversation.id, store_id: store.id, sender_type: 'customer', sender_name: customerName || customerEmail, content: initialMessage, file_data: fileData ? JSON.stringify(fileData) : null });
//           broadcastToAgents({ type: 'new_message', message: snakeToCamel(message), conversationId: conversation.id, storeId: store.id });
//         }
//         broadcastToAgents({ type: 'new_conversation', conversation: snakeToCamel(conversation), storeId: store.id, storeIdentifier });
//       } catch (error) { console.error('Background conversation processing error:', error); }
//     });
//   } catch (error) { console.error('Create conversation error:', error); res.status(500).json({ error: error.message }); }
// });

// app.put('/api/conversations/:id', authenticateToken, async (req, res) => {
//   try { const conversation = await db.updateConversation(parseInt(req.params.id), req.body); res.json(snakeToCamel(conversation)); }
//   catch (error) { res.status(500).json({ error: error.message }); }
// });

// app.put('/api/conversations/:id/read', authenticateToken, async (req, res) => {
//   try {
//     const conversationId = parseInt(req.params.id);
//     await db.markConversationRead(conversationId);
//     res.json({ success: true });
//     // Broadcast AFTER responding — client doesn't need to wait for this
//     setImmediate(async () => {
//       try {
//         const updatedConversation = await db.getConversation(conversationId);
//         if (updatedConversation) debouncedReadBroadcast(conversationId, snakeToCamel(updatedConversation)); // OPTIMISED
//       } catch (e) { console.error('[read broadcast] Error:', e.message); }
//     });
//   } catch (error) { console.error('Error marking as read:', error); res.status(500).json({ error: error.message }); }
// });

// app.put('/api/conversations/:id/unread', authenticateToken, async (req, res) => {
//   try {
//     const conversationId = parseInt(req.params.id);
//     await db.pool.query(`UPDATE conversations SET unread_count = 1, updated_at = NOW() WHERE id = $1`, [conversationId]);
//     const updatedConversation = await db.getConversation(conversationId);
//     if (!updatedConversation) return res.status(404).json({ error: 'Conversation not found' });
//     broadcastToAgents({ type: 'conversation_unread', conversationId, conversation: snakeToCamel(updatedConversation) });
//     res.json({ success: true, conversationId });
//   } catch (error) { console.error('Error marking as unread:', error); res.status(500).json({ error: error.message }); }
// });

// app.put('/api/conversations/:id/close', authenticateToken, async (req, res) => {
//   try { const conversation = await db.closeConversation(parseInt(req.params.id)); res.json(snakeToCamel(conversation)); }
//   catch (error) { res.status(500).json({ error: error.message }); }
// });

// // ── ARCHIVE ───────────────────────────────────────────────────────────────────

// app.patch('/api/conversations/:id/archive', authenticateToken, async (req, res) => {
//   try {
//     const conversationId = parseInt(req.params.id);
//     const result = await db.pool.query(
//       `UPDATE conversations SET status = 'archived', archived_at = NOW(), updated_at = NOW() WHERE id = $1 AND status != 'archived' RETURNING *`,
//       [conversationId]
//     );
//     if (result.rowCount === 0) {
//       const existing = await db.getConversation(conversationId);
//       if (!existing) return res.status(404).json({ error: 'Conversation not found' });
//       return res.json(snakeToCamel(existing));
//     }
//     const archived = snakeToCamel(result.rows[0]);
//     broadcastToAgents({ type: 'conversation_archived', conversationId, conversation: archived });
//     console.log(`📦 [Archive] Conv #${conversationId} archived by ${req.user.email}`);
//     return res.json(archived);
//   } catch (err) { console.error('❌ [archive] Error:', err); return res.status(500).json({ error: 'Failed to archive conversation' }); }
// });

// app.patch('/api/conversations/:id/unarchive', authenticateToken, async (req, res) => {
//   try {
//     const conversationId = parseInt(req.params.id);
//     const result = await db.pool.query(
//       `UPDATE conversations SET status = 'open', archived_at = NULL, updated_at = NOW() WHERE id = $1 AND status = 'archived' RETURNING *`,
//       [conversationId]
//     );
//     if (result.rowCount === 0) {
//       const existing = await db.getConversation(conversationId);
//       if (!existing) return res.status(404).json({ error: 'Conversation not found' });
//       return res.json(snakeToCamel(existing));
//     }
//     const unarchived = snakeToCamel(result.rows[0]);
//     broadcastToAgents({ type: 'conversation_unarchived', conversationId, conversation: unarchived });
//     console.log(`📬 [Unarchive] Conv #${conversationId} restored by ${req.user.email}`);
//     return res.json(unarchived);
//   } catch (err) { console.error('❌ [unarchive] Error:', err); return res.status(500).json({ error: 'Failed to unarchive conversation' }); }
// });

// // ── END ARCHIVE ───────────────────────────────────────────────────────────────

// // ============ MESSAGE ENDPOINTS ============

// app.get('/api/widget/conversations/:id/messages', async (req, res) => {
//   try {
//     const { store } = req.query;
//     if (!store) return res.status(400).json({ error: 'store parameter required' });
//     const storeRecord = await getCachedStore(store);                              // OPTIMISED
//     if (!storeRecord || !storeRecord.is_active) return res.status(404).json({ error: 'Store not found or inactive' });
//     const conversationId = parseInt(req.params.id);
//     const conversation = await db.getConversation(conversationId);
//     if (!conversation) return res.status(404).json({ error: 'Conversation not found' });
//     const convStoreId = conversation.shop_id ?? conversation.shopId ?? conversation.store_id ?? conversation.storeId;
//     const convStoreIdentifier = conversation.shop_domain ?? conversation.shopDomain ?? conversation.store_identifier ?? conversation.storeIdentifier;
//     const storeIdMatch = String(convStoreId) === String(storeRecord.id);
//     const identifierMatch = convStoreIdentifier && (convStoreIdentifier === storeRecord.shop_domain || convStoreIdentifier === storeRecord.store_identifier || convStoreIdentifier === store);
//     if (!storeIdMatch && !identifierMatch) { console.warn(`❌ [Widget History] Access denied: conv ${conversationId}`); return res.status(403).json({ error: 'Unauthorized' }); }
//     const messages = await db.getMessages(conversationId);
//     const sanitized = messages.map(m => {
//       const { sender_display_name, sender_employee_name, ...safe } = m;
//       return snakeToCamel(safe);
//     });
//     res.json(sanitized);
//   } catch (error) { console.error('❌ Widget message history error:', error); res.status(500).json({ error: 'Failed to fetch messages' }); }
// });

// // OPTIMISED — parallel fetch + mark read, respond early, broadcast after
// app.get('/api/conversations/:id/messages', authenticateToken, async (req, res) => {
//   try {
//     const conversationId = parseInt(req.params.id);

//     // Fetch messages and mark read in parallel — neither depends on the other
//     const [messages] = await Promise.all([
//       db.getMessages(conversationId),
//       db.markConversationRead(conversationId),
//     ]);

//     // Return to client immediately
//     res.json(messages.map(snakeToCamel));

//     // Broadcast after — agents don't block the requesting client
//     setImmediate(async () => {
//       try {
//         const updatedConversation = await db.getConversation(conversationId);
//         if (updatedConversation) debouncedReadBroadcast(conversationId, snakeToCamel(updatedConversation)); // OPTIMISED
//       } catch (e) { console.error('[messages broadcast] Error:', e.message); }
//     });
//   } catch (error) { console.error('Error fetching messages:', error); res.status(500).json({ error: error.message }); }
// });


// app.post('/api/messages', authenticateToken, async (req, res) => {
//   try {
//     const { conversationId, senderType, senderName, content, storeId, fileData, clientMsgId } = req.body;
//     if (!conversationId || !senderType) return res.status(400).json({ error: 'Missing required fields' });
//     if (!content && !fileData) return res.status(400).json({ error: 'Message must have text or a file attachment' });
//     const timestamp = new Date();
//     const tempId = `temp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
//     const tempMessage = { id: tempId, clientMsgId: clientMsgId || null, conversationId, storeId, senderType, senderName, content: content || '', fileData, createdAt: timestamp, pending: true };
//     sendToConversation(conversationId, { type: 'new_message', message: snakeToCamel(tempMessage) });
//     broadcastToAgents({ type: 'new_message', message: snakeToCamel(tempMessage), conversationId, storeId });
//     res.json(snakeToCamel(tempMessage));
//     setImmediate(async () => {
//       try {
//         const savedMessage = await db.saveMessage({
//           conversation_id: conversationId, store_id: storeId, sender_type: senderType, sender_name: senderName,
//           sender_id: senderType === 'agent' ? req.user.id : null,
//           content: content || '', file_data: fileData ? JSON.stringify(fileData) : null, sent_at: timestamp
//         });
//         const confirmed = { ...snakeToCamel(savedMessage), clientMsgId: clientMsgId || null };
//         const updatedConversation = await db.getConversation(conversationId);
//         sendToConversation(conversationId, { type: 'message_confirmed', tempId, clientMsgId: clientMsgId || null, message: confirmed });
//         broadcastToAgents({ type: 'message_confirmed', tempId, clientMsgId: clientMsgId || null, message: confirmed, conversationId, storeId, conversation: snakeToCamel(updatedConversation) });
//         if (senderType === 'agent') handleOfflineEmailNotification(db.pool, savedMessage).catch(err => console.error('[Offline Email] Failed:', err));
//       } catch (error) { console.error('Failed to save agent message:', error); sendToConversation(conversationId, { type: 'message_failed', tempId, clientMsgId: clientMsgId || null }); }
//     });
//   } catch (error) { console.error('Send message error:', error); res.status(500).json({ error: error.message }); }
// });


// app.post('/api/widget/messages', async (req, res) => {
//   try {
//     const { conversationId, customerEmail, customerName, content, storeIdentifier, fileData } = req.body;
//     if (!conversationId) return res.status(400).json({ error: 'Missing required fields' });
//     if (!content && !fileData) return res.status(400).json({ error: 'Message must have text or a file attachment' });
//     const [store, conversation] = await Promise.all([
//       getCachedStore(storeIdentifier),
//       db.getConversation(conversationId),
//     ]);
//     if (!store) return res.status(404).json({ error: 'Store not found' });
//     if (!conversation) return res.status(404).json({ error: 'conversation_not_found', message: 'This conversation no longer exists' });
//     const blCheck = await db.pool.query(
//       `SELECT id FROM blacklist WHERE email = $1 AND removed_at IS NULL AND (store_identifier IS NULL OR store_identifier = $2) LIMIT 1`,
//       [customerEmail.toLowerCase().trim(), store.store_identifier]
//     );
//     if (blCheck.rowCount > 0) {
//       console.log(`🚫 [Blacklist] Blocked message from ${customerEmail} on ${store.store_identifier}`);
//       return res.status(403).json({ error: 'blocked', message: 'Unable to send messages at this time.' });
//     }
//     const timestamp = new Date();
//     const tempId = `temp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
//     const tempMessage = { id: tempId, conversationId, storeId: store.id, senderType: 'customer', senderName: customerName || customerEmail, content: content || '', fileData, createdAt: timestamp, pending: true };
//     sendToConversation(conversationId, { type: 'new_message', message: snakeToCamel(tempMessage) });
//     broadcastToAgents({ type: 'new_message', message: snakeToCamel(tempMessage), conversationId, storeId: store.id });
//     res.json(snakeToCamel(tempMessage));
//     setImmediate(async () => {
//       try {
//         const savedMessage = await db.saveMessage({ conversation_id: conversationId, store_id: store.id, sender_type: 'customer', sender_name: customerName || customerEmail, content: content || '', file_data: fileData ? JSON.stringify(fileData) : null });
//         const updatedConversation = await db.getConversation(conversationId);
//         const confirmedMessage = snakeToCamel(savedMessage);
//         sendToConversation(conversationId, { type: 'message_confirmed', tempId, message: confirmedMessage });
//         broadcastToAgents({ type: 'message_confirmed', tempId, message: confirmedMessage, conversationId, storeId: store.id, conversation: snakeToCamel(updatedConversation) });
//         if (content) { const legalThreat = detectLegalThreat(content); if (legalThreat) handleLegalThreat(legalThreat, conversationId, store.id, customerName || customerEmail, content, db.pool).catch(err => console.error('[LEGAL FLAG] Text handler error:', err.message)); }
//         if (fileData) analyzeLegalAttachment(fileData, conversationId, store.id, customerName || customerEmail, db.pool).catch(err => console.error('[LEGAL FLAG] Attachment handler error:', err.message));
//       } catch (error) { console.error('Failed to save message:', error); sendToConversation(conversationId, { type: 'message_failed', tempId, error: 'Failed to save message' }); }
//     });
//   } catch (error) { console.error('Widget message error:', error); res.status(500).json({ error: 'Failed to send message', message: error.message }); }
// });



// app.delete('/api/messages/:id', authenticateToken, async (req, res) => {
//   try {
//     if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin access required' });
//     const messageId = parseInt(req.params.id);
//     if (isNaN(messageId)) return res.status(400).json({ error: 'Invalid message ID' });
//     const existing = await db.pool.query('SELECT id, conversation_id FROM messages WHERE id = $1', [messageId]);
//     if (existing.rows.length === 0) return res.status(404).json({ error: 'Message not found' });
//     const { conversation_id } = existing.rows[0];
//     await db.pool.query('DELETE FROM messages WHERE id = $1', [messageId]);
//     console.log(`🗑️ [Messages] Admin ${req.user.email} deleted message ${messageId}`);
//     broadcastToAgents({ type: 'message_deleted', messageId, conversationId: conversation_id });
//     sendToConversation(conversation_id, { type: 'message_deleted', messageId, conversationId: conversation_id });
//     res.json({ success: true, messageId });
//   } catch (error) { console.error('❌ Delete message error:', error); res.status(500).json({ error: 'Failed to delete message' }); }
// });

// app.post('/api/widget/presence', async (req, res) => {
//   try {
//     const { conversationId, customerEmail, storeId, status, lastActivityAt } = req.body;
//     if (!conversationId || !customerEmail) return res.status(400).json({ error: 'conversationId and customerEmail required' });
//     const validStatuses = ['online', 'away', 'offline'];
//     const safeStatus = validStatuses.includes(status) ? status : 'offline';
//     await db.pool.query(`INSERT INTO customer_presence (conversation_id, customer_email, store_id, status, last_activity_at, last_heartbeat_at, ws_connected, updated_at) VALUES ($1, $2, $3, $4, $5, NOW(), FALSE, NOW()) ON CONFLICT (conversation_id) DO UPDATE SET status = $4, last_activity_at = $5, last_heartbeat_at = NOW(), updated_at = NOW()`, [conversationId, customerEmail, storeId || null, safeStatus, lastActivityAt || new Date()]);
//     if (safeStatus === 'online') cancelPendingEmail(conversationId);
//     res.json({ ok: true });
//   } catch (error) {
//     if (error.code === '23503') return res.status(410).json({ error: 'conversation_not_found', message: 'Conversation no longer exists' });
//     console.error('[Presence REST] Error:', error);
//     res.status(500).json({ error: 'Failed to update presence' });
//   }
// });

// // ============ BLACKLIST ============

// app.post('/api/blacklist', authenticateToken, async (req, res) => {
//   const { email, storeIdentifier, allStores = false, reason = null, customerName = null } = req.body;
//   if (!email || typeof email !== 'string' || !email.includes('@')) return res.status(400).json({ error: 'Valid email is required' });
//   const normalizedEmail = email.toLowerCase().trim();
//   const normalizedStore = allStores ? null : (storeIdentifier || null);
//   const blockedBy = req.user?.name || req.user?.email || null;
//   try {
//     const result = await db.pool.query(
//       `INSERT INTO blacklist (email, store_identifier, reason, customer_name, blocked_by, created_at, removed_at) VALUES ($1, $2, $3, $4, $5, NOW(), NULL) ON CONFLICT (email, store_identifier) DO UPDATE SET reason = EXCLUDED.reason, customer_name = EXCLUDED.customer_name, blocked_by = EXCLUDED.blocked_by, created_at = NOW(), removed_at = NULL RETURNING *`,
//       [normalizedEmail, normalizedStore, reason, customerName, blockedBy]
//     );
//     let convUpdate;
//     if (allStores) {
//       convUpdate = await db.pool.query(`UPDATE conversations SET status = 'blacklisted', updated_at = NOW() WHERE customer_email = $1 AND status NOT IN ('archived', 'blacklisted') RETURNING id`, [normalizedEmail]);
//     } else {
//       convUpdate = await db.pool.query(`UPDATE conversations SET status = 'blacklisted', updated_at = NOW() WHERE customer_email = $1 AND status NOT IN ('archived', 'blacklisted') AND shop_domain = $2 RETURNING id`, [normalizedEmail, normalizedStore]);
//     }
//     convUpdate.rows.forEach(row => broadcastToAgents({ type: 'conversation_blacklisted', conversationId: row.id, email: normalizedEmail }));
//     console.log(`🚫 [Blacklist] ${normalizedEmail} blacklisted ${allStores ? 'network-wide' : `on ${normalizedStore}`} by ${blockedBy} — ${convUpdate.rowCount} conv(s) marked`);
//     return res.status(201).json(snakeToCamel(result.rows[0]));
//   } catch (err) { console.error('❌ [blacklist create] Error:', err); return res.status(500).json({ error: 'Failed to blacklist customer' }); }
// });

// app.get('/api/blacklist', authenticateToken, async (req, res) => {
//   const page = Math.max(1, parseInt(req.query.page) || 1);
//   const limit = Math.min(200, parseInt(req.query.limit) || 50);
//   const offset = (page - 1) * limit;
//   const storeIdentifier = req.query.storeIdentifier || null;
//   const emailSearch = req.query.email || null;
//   try {
//     const params = [limit, offset];
//     const filters = ['b.removed_at IS NULL'];
//     if (storeIdentifier) { params.push(storeIdentifier); filters.push(`(b.store_identifier = $${params.length} OR b.store_identifier IS NULL)`); }
//     if (emailSearch) { params.push(`%${emailSearch.toLowerCase()}%`); filters.push(`b.email ILIKE $${params.length}`); }
//     const where = `WHERE ${filters.join(' AND ')}`;
//     const { rows } = await db.pool.query(`SELECT b.*, COUNT(*) OVER() AS total_count FROM blacklist b ${where} ORDER BY b.created_at DESC LIMIT $1 OFFSET $2`, params);
//     const total = rows.length ? parseInt(rows[0].total_count) : 0;
//     return res.json({ entries: rows.map(r => { const row = { ...r }; delete row.total_count; return snakeToCamel(row); }), pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
//   } catch (err) { console.error('❌ [blacklist list] Error:', err); return res.status(500).json({ error: 'Failed to fetch blacklist' }); }
// });

// app.delete('/api/blacklist/:id', authenticateToken, async (req, res) => {
//   try {
//     const lookup = await db.pool.query(`SELECT email, store_identifier FROM blacklist WHERE id = $1 AND removed_at IS NULL`, [parseInt(req.params.id)]);
//     if (lookup.rowCount === 0) return res.status(404).json({ error: 'Blacklist entry not found or already removed' });
//     const { email, store_identifier } = lookup.rows[0];
//     const result = await db.pool.query(`UPDATE blacklist SET removed_at = NOW() WHERE id = $1 AND removed_at IS NULL RETURNING *`, [parseInt(req.params.id)]);
//     let restored;
//     if (store_identifier) {
//       restored = await db.pool.query(`UPDATE conversations SET status = 'open', updated_at = NOW() WHERE customer_email = $1 AND status = 'blacklisted' AND shop_domain = $2 RETURNING id`, [email, store_identifier]);
//     } else {
//       restored = await db.pool.query(`UPDATE conversations SET status = 'open', updated_at = NOW() WHERE customer_email = $1 AND status = 'blacklisted' RETURNING id`, [email]);
//     }
//     restored.rows.forEach(row => broadcastToAgents({ type: 'conversation_unblacklisted', conversationId: row.id, email }));
//     console.log(`✅ [Blacklist] Entry #${req.params.id} removed by ${req.user.email} — ${restored.rowCount} conversation(s) restored`);
//     return res.json({ success: true, entry: snakeToCamel(result.rows[0]), restoredConversations: restored.rowCount });
//   } catch (err) { console.error('❌ [blacklist delete] Error:', err); return res.status(500).json({ error: 'Failed to remove blacklist entry' }); }
// });

// app.get('/api/blacklist/check', authenticateToken, async (req, res) => {
//   const { email, storeIdentifier } = req.query;
//   if (!email) return res.status(400).json({ error: 'email query param is required' });
//   try {
//     const { rows } = await db.pool.query(`SELECT * FROM blacklist WHERE email = $1 AND removed_at IS NULL AND (store_identifier IS NULL OR store_identifier = $2) LIMIT 1`, [email.toLowerCase().trim(), storeIdentifier || null]);
//     if (rows.length) return res.json({ blocked: true, entry: snakeToCamel(rows[0]) });
//     return res.json({ blocked: false, entry: null });
//   } catch (err) { console.error('❌ [blacklist check] Error:', err); return res.status(500).json({ error: 'Failed to check blacklist' }); }
// });

// // ============ END BLACKLIST ============

// // ============ AI SUGGESTION FEATURE ============
// // All AI reply-suggestion logic (style fingerprinting, prompt builders,
// // conversation-state analysis, validation, humanizer, Anthropic/DeepSeek client,
// // smart fallbacks) now lives in:
// //   • lib/ai-suggestions.js   — pure helpers + Anthropic client
// //   • routes/ai-routes.js     — /api/ai/analyze-image, /suggestions,
// //                               /brain-debug, /brain-cache/clear
// // Mounted above via: app.use('/api/ai', createAiRoutes({ getCachedStore }))
// // callAnthropicAPIWithRetry is imported at the top for /pepstack.

// // ============ EMPLOYEE ENDPOINTS ============

// app.get('/api/employees', authenticateToken, async (req, res) => {
//   try {
//     if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin access required' });

//     const cached = appCache.get('employees:list');
//     if (cached) return res.json(cached);

//     const [employees, statsById, responsesByAgent] = await Promise.all([
//       db.getAllEmployees(),
//       db.getAgentResponseStats(),
//       db.getAgentCustomerResponseStats(),
//     ]);

//     const enriched = employees.map(emp => {
//       const { password_hash, api_token, ...safe } = emp;
//       return {
//         ...snakeToCamel(safe),
//         ...(statsById[String(emp.id)] || { avgResponseMinutes: null, fastestMinutes: null, totalResponsesCounted: 0 }),
//         responsesByCustomer: responsesByAgent[String(emp.id)] || [],
//       };
//     });

//     appCache.set('employees:list', enriched);
//     res.json(enriched);
//   } catch (error) {
//     console.error('Get employees error:', error);
//     res.status(500).json({ error: 'Failed to fetch employees' });
//   }
// });


// app.post('/api/employees', authenticateToken, async (req, res) => {
//   try {
//     if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin access required' });
//     const { email, name, employeeName, role, password, canViewAllStores, isActive } = req.body;
//     if (!email || !name || !password) return res.status(400).json({ error: 'Email, name, and password are required' });
//     const password_hash = await hashPassword(password);
//     const employee = await db.createEmployee({ email, name, employee_name: employeeName || null, role: role || 'agent', password_hash, can_view_all_stores: canViewAllStores !== undefined ? canViewAllStores : true, is_active: isActive !== undefined ? isActive : true, assigned_stores: [] });
//     appCache.invalidate('employees:list');                                         // INVALIDATE
//     delete employee.password_hash; delete employee.api_token;
//     res.json(snakeToCamel(employee));
//   } catch (error) { console.error('Create employee error:', error); res.status(500).json({ error: error.message }); }
// });

// app.put('/api/employees/:id', authenticateToken, async (req, res) => {
//   try {
//     if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin access required' });
//     const employeeId = parseInt(req.params.id); const updates = req.body;
//     const dbUpdates = {};
//     if (updates.name !== undefined) dbUpdates.name = updates.name;
//     if (updates.employeeName !== undefined) dbUpdates.employee_name = updates.employeeName;
//     if (updates.email !== undefined) dbUpdates.email = updates.email;
//     if (updates.role !== undefined) dbUpdates.role = updates.role;
//     if (updates.isActive !== undefined) dbUpdates.is_active = updates.isActive;
//     if (updates.canViewAllStores !== undefined) dbUpdates.can_view_all_stores = updates.canViewAllStores;
//     if (updates.assignedStores !== undefined) dbUpdates.assigned_stores = updates.assignedStores;
//     if (updates.password) dbUpdates.password_hash = await hashPassword(updates.password);
//     const employee = await db.updateEmployee(employeeId, dbUpdates);
//     appCache.invalidate('employees:list');                                         // INVALIDATE
//     delete employee.password_hash; delete employee.api_token;
//     res.json(snakeToCamel(employee));
//   } catch (error) { console.error('Update employee error:', error); res.status(500).json({ error: 'Failed to update employee' }); }
// });

// app.delete('/api/employees/:id', authenticateToken, async (req, res) => {
//   try {
//     if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin access required' });
//     const employeeId = parseInt(req.params.id);
//     if (employeeId === req.user.id) return res.status(400).json({ error: 'Cannot delete your own account' });
//     await db.deleteEmployee(employeeId);
//     appCache.invalidate('employees:list');                                         // INVALIDATE
//     res.json({ success: true, message: 'Employee deleted' });
//   } catch (error) { console.error('Delete employee error:', error); res.status(500).json({ error: 'Failed to delete employee' }); }
// });

// app.put('/api/employees/:id/status', authenticateToken, async (req, res) => {
//   try {
//     await db.updateEmployeeStatus(parseInt(req.params.id), req.body.status);
//     appCache.invalidate('employees:list');                                         // INVALIDATE
//     res.json({ success: true });
//   } catch (error) { res.status(500).json({ error: error.message }); }
// });

// app.patch('/api/employees/:id/notes-order', authenticateToken, async (req, res) => {
//   try {
//     const employeeId = parseInt(req.params.id);
//     const { order } = req.body;
//     if (req.user.id !== employeeId && req.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
//     if (!Array.isArray(order)) return res.status(400).json({ error: 'order must be an array of note IDs' });
//     await db.updateEmployeeNotesOrder(employeeId, order);
//     res.json({ success: true });
//   } catch (error) { console.error('Error saving notes order:', error); res.status(500).json({ error: 'Failed to save notes order' }); }
// });

// // ============ TEMPLATE ENDPOINTS ============

// app.get('/api/templates', authenticateToken, async (req, res) => {
//   try {
//     const cacheKey = `templates:${req.user.id}`;
//     const cached = appCache.get(cacheKey);
//     if (cached) return res.json(cached);
//     const templates = await db.getTemplatesByUserId(req.user.id);
//     const result = templates.map(snakeToCamel);
//     appCache.set(cacheKey, result);
//     res.json(result);
//   } catch (error) { console.error('Get templates error:', error); res.status(500).json({ error: 'Failed to fetch templates' }); }
// });

// app.post('/api/templates', authenticateToken, async (req, res) => {
//   try {
//     const { name, content } = req.body;
//     if (!name || !content) return res.status(400).json({ error: 'Name and content are required' });
//     if (name.length > 255) return res.status(400).json({ error: 'Template name is too long (max 255 characters)' });
//     const template = await db.createTemplate({ user_id: req.user.id, name: name.trim(), content: content.trim() });
//     appCache.invalidate(`templates:${req.user.id}`);
//     res.status(201).json(snakeToCamel(template));
//   } catch (error) { console.error('Create template error:', error); res.status(500).json({ error: 'Failed to create template' }); }
// });

// app.put('/api/templates/:id', authenticateToken, async (req, res) => {
//   try {
//     const templateId = parseInt(req.params.id); const { name, content } = req.body;
//     if (!name || !content) return res.status(400).json({ error: 'Name and content are required' });
//     if (name.length > 255) return res.status(400).json({ error: 'Template name is too long (max 255 characters)' });
//     const existingTemplate = await db.getTemplateById(templateId);
//     if (!existingTemplate) return res.status(404).json({ error: 'Template not found' });
//     if (existingTemplate.user_id !== req.user.id) return res.status(403).json({ error: 'Not authorized to update this template' });
//     const template = await db.updateTemplate(templateId, { name: name.trim(), content: content.trim() });
//     appCache.invalidate(`templates:${req.user.id}`);
//     res.json(snakeToCamel(template));
//   } catch (error) { console.error('Update template error:', error); res.status(500).json({ error: 'Failed to update template' }); }
// });

// app.delete('/api/templates/:id', authenticateToken, async (req, res) => {
//   try {
//     const templateId = parseInt(req.params.id);
//     const existingTemplate = await db.getTemplateById(templateId);
//     if (!existingTemplate) return res.status(404).json({ error: 'Template not found' });
//     if (existingTemplate.user_id !== req.user.id) return res.status(403).json({ error: 'Not authorized to delete this template' });
//     await db.deleteTemplate(templateId);
//     appCache.invalidate(`templates:${req.user.id}`);
//     res.json({ success: true, message: 'Template deleted successfully' });
//   } catch (error) { console.error('Delete template error:', error); res.status(500).json({ error: 'Failed to delete template' }); }
// });


// // ============ STATS ENDPOINTS ============

// app.get('/api/stats/dashboard', authenticateToken, async (req, res) => {
//   try {
//     const cacheKey = `stats:dashboard:${JSON.stringify(req.query)}`;
//     const cached = appCache.get(cacheKey);
//     if (cached) return res.json(cached);
//     const stats = await db.getDashboardStats(req.query);
//     appCache.set(cacheKey, stats);
//     setTimeout(() => appCache.invalidate(cacheKey), 30 * 1000);
//     res.json(stats);
//   } catch (error) { res.status(500).json({ error: error.message }); }
// });


// app.get('/api/stats/websocket', authenticateToken, (req, res) => {
//   try { const stats = getWebSocketStats(); res.json(stats); }
//   catch (error) { res.status(500).json({ error: error.message }); }
// });


// app.post('/api/stats/discord-report/trigger', authenticateToken, async (req, res) => {
//   try {
//     if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin access required' });
//     if (!process.env.DISCORD_STATS_WEBHOOK) return res.status(400).json({ error: 'DISCORD_STATS_WEBHOOK not configured' });
//     const now = Date.now();
//     if (now - lastHourlyReportAt < REPORT_COOLDOWN)
//       return res.status(429).json({ error: 'Report triggered less than 1 minute ago. Please wait.' });
//     lastHourlyReportAt = now;
//     sendHourlyResponseTimeStats().catch(err => console.error('📊 [Discord Stats] Manual trigger failed:', err.message));
//     res.json({ ok: true, message: 'Discord report triggered — check the channel in a few seconds' });
//   } catch (err) { console.error('📊 [Discord Stats] Trigger endpoint error:', err.message); res.status(500).json({ error: 'Failed to trigger report' }); }
// });

// app.post('/api/stats/discord-daily-report/trigger', authenticateToken, async (req, res) => {
//   try {
//     if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin access required' });
//     if (!process.env.DISCORD_DAILY_WEBHOOK) return res.status(400).json({ error: 'DISCORD_DAILY_WEBHOOK not configured' });
//     const now = Date.now();
//     if (now - lastDailyReportAt < REPORT_COOLDOWN)
//       return res.status(429).json({ error: 'Report triggered less than 1 minute ago. Please wait.' });
//     lastDailyReportAt = now;
//     sendDailyActivityStats().catch(err => console.error('📊 [Discord Daily] Manual trigger failed:', err.message));
//     res.json({ ok: true, message: 'Daily Discord report triggered — check the channel in a few seconds' });
//   } catch (err) { console.error('📊 [Discord Daily] Trigger endpoint error:', err.message); res.status(500).json({ error: 'Failed to trigger report' }); }
// });



// // OPTIMISED — added 90-day filter + 5min cache
// app.get('/api/stats/response-times/team', authenticateToken, async (req, res) => {
//   try {
//     if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin access required' });
//     const cached = appCache.get('stats:response-times:team');
//     if (cached) return res.json(cached);
//     const { rows } = await db.pool.query(`
//       WITH real_messages AS (
//         SELECT conversation_id, sender_type, sent_at,
//           LAG(sender_type) OVER (PARTITION BY conversation_id ORDER BY sent_at) AS prev_sender_type,
//           LAG(sent_at)     OVER (PARTITION BY conversation_id ORDER BY sent_at) AS prev_sent_at
//         FROM messages
//         WHERE sender_type IN ('customer', 'agent')
//           AND NOT (sender_type = 'agent' AND sender_id IS NULL)
//           AND sent_at >= NOW() - INTERVAL '90 days'
//       ),
//       rt AS (
//         SELECT EXTRACT(EPOCH FROM (sent_at - prev_sent_at)) / 60.0 AS minutes
//         FROM real_messages
//         WHERE sender_type = 'agent' AND prev_sender_type = 'customer'
//           AND prev_sent_at IS NOT NULL
//           AND EXTRACT(EPOCH FROM (sent_at - prev_sent_at)) / 60.0 BETWEEN 0 AND 240
//       )
//       SELECT
//         ROUND(AVG(minutes)::numeric, 1) AS avg_minutes,
//         ROUND(MIN(minutes)::numeric, 1) AS fastest_minutes,
//         ROUND((PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY minutes))::numeric, 1) AS median_minutes,
//         COUNT(*)::int AS total_responses,
//         COUNT(*) FILTER (WHERE minutes <= 5)::int  AS under_5_min,
//         COUNT(*) FILTER (WHERE minutes <= 30)::int AS under_30_min,
//         COUNT(*) FILTER (WHERE minutes > 60)::int  AS over_1_hour
//       FROM rt
//     `);
//     const r = rows[0] || {};
//     const result = { avgMinutes: r.avg_minutes !== null ? parseFloat(r.avg_minutes) : null, medianMinutes: r.median_minutes !== null ? parseFloat(r.median_minutes) : null, fastestMinutes: r.fastest_minutes !== null ? parseFloat(r.fastest_minutes) : null, totalResponses: r.total_responses || 0, under5Min: r.under_5_min || 0, under30Min: r.under_30_min || 0, over1Hour: r.over_1_hour || 0 };
//     appCache.set('stats:response-times:team', result);
//     setTimeout(() => appCache.invalidate('stats:response-times:team'), 5 * 60 * 1000);
//     res.json(result);
//   } catch (error) { console.error('Team response stats error:', error); res.status(500).json({ error: 'Failed to fetch team response stats' }); }
// });


// app.get('/api/conversations/:id/response-stats', authenticateToken, async (req, res) => {
//   try {
//     const conversationId = parseInt(req.params.id);
//     const cacheKey = `stats:conv:${conversationId}`;
//     const cached = appCache.get(cacheKey);
//     if (cached) return res.json(cached);
//     const { rows } = await db.pool.query(`
//       WITH real_messages AS (
//         SELECT sender_type, sender_name, sent_at,
//           LAG(sender_type) OVER (ORDER BY sent_at) AS prev_sender_type,
//           LAG(sent_at)     OVER (ORDER BY sent_at) AS prev_sent_at
//         FROM messages
//         WHERE conversation_id = $1
//           AND sender_type IN ('customer', 'agent')
//           AND NOT (sender_type = 'agent' AND sender_id IS NULL)
//       )
//       SELECT sender_name, EXTRACT(EPOCH FROM (sent_at - prev_sent_at)) / 60.0 AS minutes, sent_at
//       FROM real_messages
//       WHERE sender_type = 'agent' AND prev_sender_type = 'customer' AND prev_sent_at IS NOT NULL
//         AND EXTRACT(EPOCH FROM (sent_at - prev_sent_at)) / 60.0 BETWEEN 0 AND 240
//       ORDER BY sent_at ASC
//     `, [conversationId]);
//     const responses = rows.map(r => ({ senderName: r.sender_name, minutes: parseFloat(r.minutes), at: r.sent_at }));
//     const avg = responses.length ? responses.reduce((s, r) => s + r.minutes, 0) / responses.length : null;
//     const result = { conversationId, avgResponseMinutes: avg !== null ? Math.round(avg * 10) / 10 : null, totalResponses: responses.length, responses };
//     appCache.set(cacheKey, result);
//     setTimeout(() => appCache.invalidate(cacheKey), 60 * 1000);
//     res.json(result);
//   } catch (error) { console.error('Conversation response stats error:', error); res.status(500).json({ error: 'Failed to fetch conversation response stats' }); }
// });
// // ============ ERROR HANDLER ============

// app.use((err, req, res, next) => {
//   console.error('SERVER ERROR:', err.message);
//   res.status(500).json({ error: 'Internal server error', message: process.env.NODE_ENV === 'development' ? err.message : undefined });
// });

// // ============ KEEP-ALIVE ============

// function setupKeepAlive() {
//   if (process.env.KEEP_ALIVE === 'false') { console.log('⏰ Keep-alive disabled'); return; }
//   const APP_URL = process.env.APP_URL || `http://localhost:${process.env.PORT || 3000}`;
//   const httpModule = APP_URL.startsWith('https') ? require('https') : http;
//   console.log('⏰ Keep-alive enabled - pinging every 5 minutes');
//   setInterval(() => {
//     const now = new Date().toISOString();
//     httpModule.get(`${APP_URL}/health`, (res) => {
//       let data = ''; res.on('data', chunk => { data += chunk; }); res.on('end', () => { console.log(`⏰ Keep-alive ${res.statusCode === 200 ? 'OK' : 'FAILED'} [${now}]`); });
//     }).on('error', err => { console.error(`❌ Keep-alive error [${now}]:`, err.message); });
//   }, 5 * 60 * 1000);
//   setTimeout(() => { httpModule.get(`${APP_URL}/health`, res => { console.log(`⏰ Initial ping: ${res.statusCode}`); }).on('error', err => { console.error('❌ Initial ping error:', err.message); }); }, 60 * 1000);
// }

// // ============ PERFORMANCE INDEXES ============

// async function createPerformanceIndexes() {
//   const indexes = [
//     `CREATE INDEX IF NOT EXISTS idx_conv_status_updated ON conversations (status, updated_at DESC)`,
//     `CREATE INDEX IF NOT EXISTS idx_messages_conv_sent ON messages (conversation_id, sent_at DESC)`,
//     `CREATE INDEX IF NOT EXISTS idx_messages_agent_sent ON messages (sender_id, sent_at DESC) WHERE sender_type = 'agent' AND sender_id IS NOT NULL`,
//     `CREATE INDEX IF NOT EXISTS idx_conv_email_shop ON conversations (customer_email, shop_id)`,
//     `CREATE INDEX IF NOT EXISTS idx_employees_active ON employees (email) WHERE is_active = true`,
//     `CREATE INDEX IF NOT EXISTS idx_blacklist_email ON blacklist (email) WHERE removed_at IS NULL`,
//     `CREATE INDEX IF NOT EXISTS idx_presence_conv ON customer_presence (conversation_id)`,
//     `CREATE INDEX IF NOT EXISTS idx_conv_archived_at ON conversations (archived_at DESC NULLS LAST) WHERE status = 'archived'`,
//     `CREATE EXTENSION IF NOT EXISTS pg_trgm`,
//     `CREATE INDEX IF NOT EXISTS idx_messages_content_trgm ON messages USING gin (content gin_trgm_ops)`,
//     `CREATE INDEX IF NOT EXISTS idx_conv_email_trgm ON conversations USING gin (customer_email gin_trgm_ops)`,
//     `CREATE INDEX IF NOT EXISTS idx_conv_name_trgm  ON conversations USING gin (customer_name  gin_trgm_ops)`,
//   ];
//   const results = await Promise.allSettled(indexes.map(sql => db.pool.query(sql)));
//   const created = results.filter(r => r.status === 'fulfilled').length;
//   results.forEach((r) => { if (r.status === 'rejected') console.warn(`⚠️ [Indexes] Skipped: ${r.reason.message.substring(0, 80)}`); });
//   console.log(`✅ [Indexes] ${created}/${indexes.length} performance indexes ensured`);
// }
// // ============ START SERVER ============

// const PORT = process.env.PORT || 3000;

// // Add these two cooldown guards at the top of the file (module level, outside startServer):


// async function startServer() {
//   try {
//     await db.testConnection(); console.log('✅ Database connection successful\n');

//     await Promise.all([
//       db.initDatabase().then(() => console.log('✅ Database tables initialized\n')),
//       db.runMigrations().then(() => console.log('✅ Database migrations completed\n')),
//     ]);

//     server.listen(PORT, async () => {
//       console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
//       console.log('🚀 MULTI-STORE CHAT SERVER READY');
//       console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
//       console.log(`📍 Server: http://localhost:${PORT}`);
//       console.log(`🔌 WebSocket: ws://localhost:${PORT}/ws`);
//       console.log(`✦  AI Suggestions: ${process.env.ANTHROPIC_API_KEY ? 'Enabled (Claude)' : 'Fallback mode (no API key)'}`);
//       console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

//       try {
//         await db.pool.query(`ALTER TABLE conversations ADD COLUMN IF NOT EXISTS auto_replied_at TIMESTAMPTZ DEFAULT NULL`);
//         console.log('✅ [Startup] auto_replied_at column confirmed');
//       } catch (err) { console.error('❌ [Startup] Failed to ensure auto_replied_at:', err.message); return; }

//       createPerformanceIndexes().catch(err => console.error('⚠️ [Indexes] Error:', err.message));

//       setupKeepAlive();
//       startEmailSweep(db.pool);
      
//       setTimeout(() => db.refreshResponseStats().catch(e => console.error('📊 [Stats] initial refresh:', e.message)), 30 * 1000);
//       setInterval(() => db.refreshResponseStats().catch(e => console.error('📊 [Stats] interval refresh:', e.message)), 10 * 60 * 1000);
//       // ── Hourly Discord report ──
//       function scheduleNextHourlyReport() {
//         const now = new Date();
//         const nextHour = new Date(now);
//         nextHour.setHours(now.getHours() + 1, 0, 5, 0);
//         const msUntilNextHour = nextHour - now;
//         console.log(`📊 [Discord Stats] Next hourly report in ${Math.round(msUntilNextHour / 1000 / 60)}m`);
//         setTimeout(async () => {
//           console.log(`📊 [Discord Stats] Hourly tick at ${new Date().toLocaleString()}`);
//           try { await sendHourlyResponseTimeStats(); } catch (err) { console.error('📊 [Discord Stats] Hourly tick failed:', err.message); }
//           scheduleNextHourlyReport();
//         }, msUntilNextHour);
//       }
//       if (process.env.NODE_ENV === 'production') {
//         setTimeout(() => sendHourlyResponseTimeStats().catch(err => console.error('📊 [Discord Stats] Startup report failed:', err.message)), 5 * 60 * 1000);
//       } else { console.log('📊 [Discord Stats] Skipping startup report (dev mode)'); }
//       scheduleNextHourlyReport();

//       // ── Daily report ──
//       function scheduleNextDailyReport() {
//         const REPORT_HOUR = parseInt(process.env.DISCORD_DAILY_REPORT_HOUR || '9', 10);
//         const now = new Date();
//         const next = new Date(now);
//         next.setHours(REPORT_HOUR, 0, 5, 0);
//         if (next <= now) next.setDate(next.getDate() + 1);
//         const msUntilNext = next - now;
//         console.log(`📊 [Discord Daily] Next daily report in ${Math.round(msUntilNext / 1000 / 60 / 60)}h`);
//         setTimeout(async () => {
//           console.log(`📊 [Discord Daily] Daily tick at ${new Date().toLocaleString()}`);
//           try { await sendDailyActivityStats(); } catch (err) { console.error('📊 [Discord Daily] Daily tick failed:', err.message); }
//           scheduleNextDailyReport();
//         }, msUntilNext);
//       }
//       scheduleNextDailyReport();

//       // ── Presence stale cleanup ──
//       setInterval(async () => {
//         try {
//           const result = await db.pool.query(`UPDATE customer_presence SET status = 'offline', ws_connected = FALSE, updated_at = NOW() WHERE status != 'offline' AND last_heartbeat_at < NOW() - INTERVAL '3 minutes' RETURNING conversation_id`);
//           if (result.rowCount > 0) console.log(`[Presence] Marked ${result.rowCount} stale sessions offline`);
//         } catch (err) { console.error('[Presence] Stale cleanup error:', err); }
//       }, 2 * 60 * 1000);

//       // ============ AUTO-REPLY (9-minute no-response rule) ============
//       const AUTO_REPLY_TEXT = 'Thanks for reaching out! We’re available 24/7 and will get back to you as soon as possible. We’re always here and ready to help!';

//       setInterval(async () => {
//         try {
//           // CHANGE 1 — single CTE pass, eliminates the two correlated subqueries
//           const { rows } = await db.pool.query(`
//             WITH last_msgs AS (
//               SELECT
//                 conversation_id,
//                 MAX(sent_at)                                           AS last_sent_at,
//                 MAX(sent_at) FILTER (WHERE sender_type != 'customer')  AS last_agent_at
//               FROM messages
//               WHERE sent_at >= NOW() - INTERVAL '24 hours'
//               GROUP BY conversation_id
//             )
//             SELECT c.id, c.shop_id
//             FROM conversations c
//             JOIN last_msgs lm ON lm.conversation_id = c.id
//             WHERE c.status = 'open'
//               AND (c.auto_replied_at IS NULL OR c.auto_replied_at < NOW() - INTERVAL '8 hours')
//               AND lm.last_sent_at < NOW() - INTERVAL '9 minutes'
//               AND lm.last_agent_at IS NULL
//             LIMIT 20
//           `);

//           // CHANGE 2 — parallel loop, all 20 convs fire simultaneously
//           await Promise.allSettled(rows.map(async (conv) => {
//             try {
//               const insertResult = await db.pool.query(
//                 `INSERT INTO messages (conversation_id, shop_id, sender_type, sender_name, content, message_type, file_data, sent_at, timestamp)
//                  SELECT $1, $2, 'agent', 'Support', $3, 'text', NULL, NOW(), NOW()
//                  WHERE NOT EXISTS (
//                    SELECT 1 FROM messages WHERE conversation_id = $1 AND sender_type != 'customer'
//                    AND sent_at > (SELECT MAX(sent_at) FROM messages WHERE conversation_id = $1 AND sender_type = 'customer')
//                  )
//                  RETURNING *`,
//                 [conv.id, conv.shop_id, AUTO_REPLY_TEXT]
//               );
//               if (insertResult.rows.length === 0) {
//                 console.log(`🤖 [Auto-reply] Skipped conv #${conv.id} — team replied in the meantime`);
//                 return;
//               }
//               const saved = insertResult.rows[0];

//               // CHANGE 3 — UPDATE and correctedConv SELECT run in parallel
//               const [, correctedConv] = await Promise.all([
//                 db.pool.query(
//                   `UPDATE conversations SET auto_replied_at = NOW(),
//                      last_message = (SELECT content FROM messages WHERE conversation_id = $1 AND sender_type = 'customer' ORDER BY sent_at DESC LIMIT 1),
//                      last_message_sender_type = 'customer'
//                    WHERE id = $1`,
//                   [conv.id]
//                 ),
//                 db.pool.query(
//                   `SELECT c.*, (SELECT content FROM messages WHERE conversation_id = c.id AND sender_type = 'customer' ORDER BY sent_at DESC LIMIT 1) AS last_customer_message
//                    FROM conversations c WHERE c.id = $1`,
//                   [conv.id]
//                 ),
//               ]);

//               const msg = { ...snakeToCamel(saved), isAutoReply: true };
//               sendToConversation(conv.id, { type: 'new_message', message: msg });
//               broadcastToAgents({ type: 'new_message', message: msg, conversationId: conv.id, storeId: conv.shop_id });

//               if (correctedConv.rows.length > 0) {
//                 const convData = snakeToCamel(correctedConv.rows[0]);
//                 broadcastToAgents({ type: 'conversation_updated', conversationId: conv.id, conversation: { ...convData, lastMessage: convData.lastCustomerMessage || convData.lastMessage, lastMessageSenderType: 'customer', lastSenderType: 'customer' } });
//               }
//               console.log(`🤖 [Auto-reply] Sent to conv #${conv.id}`);
//             } catch (err) { console.error(`🤖 [Auto-reply] Failed for conv #${conv.id}:`, err.message); }
//           }));
//         } catch (err) { console.error('🤖 [Auto-reply] Query error:', err.message); }
//       }, 60 * 1000);
//       // ============ END AUTO-REPLY ============

//       // ============ AI BRAIN BACKUP CLEANUP ============
//       async function pruneOldBackups() {
//         try {
//           const result = await db.pool.query(`DELETE FROM ai_training_brain_backups WHERE backed_up_at < NOW() - INTERVAL '30 days' RETURNING id`);
//           if (result.rowCount > 0) console.log(`🧹 [Brain Backups] Pruned ${result.rowCount} backup(s) older than 30 days`);
//         } catch (err) { if (!err.message.includes('does not exist')) console.error('🧹 [Brain Backups] Prune error:', err.message); }
//       }
//       setTimeout(() => pruneOldBackups(), 5 * 60 * 1000);
//       setInterval(() => pruneOldBackups(), 24 * 60 * 60 * 1000);
//       // ============ END BRAIN BACKUP CLEANUP ============
//     });
//   } catch (error) {
//     console.error('❌ FATAL: Failed to start server:', error.message);
//     process.exit(1);
//   }
// }

// startServer();

// module.exports = { app, server };









































// ============================================================================
// server.js — Multi-Store Chat Server (Chat Support Pro)
// ============================================================================
// KEY CHANGES vs previous version:
//  1. /health is now DB-free (liveness). /health/db is the readiness probe and
//     never returns 503. Point the platform health check at /health.
//  2. All background jobs run under Postgres advisory locks, so only ONE
//     instance runs each — no more multiplied pool pressure or double Discord
//     posts. Each job uses a single dedicated connection and runs its queries
//     sequentially on it.
//  3. Auto-reply sweeper: LIMIT 10, sequential on one connection. Was firing
//     up to 60 concurrent pool checkouts per tick, which starved everything
//     else (that is what killed the presence cleanup).
//  4. Trigram/GIN indexes removed from boot. Run `node scripts/build-search-indexes.js`
//     once. createPerformanceIndexes() is gone — those live in migration 018 now.
//  5. Cache has real TTLs. Was creating one unbounded setTimeout per request.
//  6. express-session scoped to /auth and /shopify only (default MemoryStore
//     leaks on every request otherwise).
//  7. getMessages always called with a limit.
//  8. Hourly Discord report CTEs bounded to 6h — they were computing LAG over
//     the entire messages table on every run.
//  9. Graceful shutdown clears intervals and drains the pool.
// ============================================================================

require('dotenv').config();
const express = require('express');
const http = require('http');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const session = require('express-session');

const db = require('./database');
const shopify = require('./shopify-api');
const { rawBodyMiddleware, handleWebhook } = require('./webhooks');
const { getAuthUrl, handleCallback } = require('./shopify-auth');
const { initWebSocketServer, sendToConversation, broadcastToAgents, getWebSocketStats, closeAll } = require('./websocket-server');
const { hashPassword, verifyPassword, generateToken, authenticateToken } = require('./auth');
const shopifyAppRoutes = require('./routes/shopify-app-routes');
const fileRoutes = require('./routes/fileroutes');
const { handleOfflineEmailNotification, cancelPendingEmail, startEmailSweep, stopEmailSweep } = require('../frontend/src/admin/services/emailService');
const aiTrainingRoutes = require('./routes/ai-training-routes');
const { getBrainContext, refreshBrainCache, getBrainSettings } = require('./brain-context');
const { callAnthropicAPIWithRetry } = require('./lib/ai-suggestions');
const createAiRoutes = require('./routes/ai-routes');
const promoRoutes = require('./routes/promo-routes');

const app = express();
const server = http.createServer(app);

app.set('trust proxy', 1);

// ── Interval registry so shutdown can clear everything ──────────────────────
const timers = [];
function every(ms, fn, label) {
  const t = setInterval(fn, ms);
  timers.push({ t, label });
  return t;
}

// ============ CORS ============

const ALLOWED_ORIGINS = [
  'https://chat-support-pro.onrender.com',
  'https://chat-support-pro.vercel.app',
  'http://localhost:5173',
  'http://localhost:3000',
  'http://localhost:8080',
];

app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (ALLOWED_ORIGINS.includes(origin)) {
    res.header('Access-Control-Allow-Origin', origin);
    res.header('Access-Control-Allow-Credentials', 'true');
  }
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

app.use('/api', (req, res, next) => {
  if (req.method === 'GET') res.set('Cache-Control', 'no-store');
  next();
});

app.use(compression({ level: 1, threshold: 2048 }));

let lastHourlyReportAt = 0;
let lastDailyReportAt = 0;
const REPORT_COOLDOWN = 60_000;

console.log('🔌 Initializing WebSocket server...');
initWebSocketServer(server);
console.log('✅ WebSocket server initialized\n');
console.log('🚀 Multi-Store Chat Server Starting...\n');

// ============ UTILITY FUNCTIONS ============

function snakeToCamel(obj) {
  if (!obj) return obj;
  if (Array.isArray(obj)) return obj.map(snakeToCamel);
  if (obj instanceof Date) return obj;
  if (typeof obj !== 'object') return obj;
  const camelObj = {};
  for (const [key, value] of Object.entries(obj)) {
    const camelKey = key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
    camelObj[camelKey] = typeof value === 'object' && value !== null ? snakeToCamel(value) : value;
  }
  return camelObj;
}

function camelToSnake(obj) {
  if (!obj) return obj;
  if (Array.isArray(obj)) return obj.map(camelToSnake);
  if (typeof obj !== 'object') return obj;
  const snakeObj = {};
  for (const [key, value] of Object.entries(obj)) {
    snakeObj[key.replace(/[A-Z]/g, l => `_${l.toLowerCase()}`)] = value;
  }
  return snakeObj;
}

/** Run async fn over items with bounded concurrency. */
async function mapLimit(items, limit, fn) {
  const out = [];
  for (let i = 0; i < items.length; i += limit) {
    out.push(...await Promise.allSettled(items.slice(i, i + limit).map(fn)));
  }
  return out;
}

// ============ CACHE (write-invalidated + optional TTL) ============
// Entries are cleared on write. A TTL can be attached per entry; expiry is
// checked lazily on read instead of arming a setTimeout per request (the old
// version leaked one timer per cache miss).

class AppCache {
  constructor(maxEntries = 5000) { this.store = new Map(); this.max = maxEntries; }
  get(key) {
    const e = this.store.get(key);
    if (!e) return null;
    if (e.exp !== null && Date.now() > e.exp) { this.store.delete(key); return null; }
    return e.value;
  }
  set(key, value, ttlMs = null) {
    if (this.store.size >= this.max) {
      // Cheap eviction: drop the oldest insertion.
      const oldest = this.store.keys().next().value;
      if (oldest !== undefined) this.store.delete(oldest);
    }
    this.store.set(key, { value, exp: ttlMs ? Date.now() + ttlMs : null });
    return value;
  }
  invalidate(key) { this.store.delete(key); }
  invalidatePrefix(prefix) {
    for (const key of this.store.keys()) if (key.startsWith(prefix)) this.store.delete(key);
  }
  invalidateAll() { this.store.clear(); }
  sweep() {
    const now = Date.now();
    for (const [k, e] of this.store) if (e.exp !== null && now > e.exp) this.store.delete(k);
  }
  get size() { return this.store.size; }
}

const appCache = new AppCache();
every(5 * 60 * 1000, () => appCache.sweep(), 'cache-sweep');

const TTL = {
  AUTH: 30 * 1000,
  CONVS: 10 * 1000,
  LINKED: 15 * 1000,
  SHOPIFY: 5 * 60 * 1000,
  STATS: 30 * 1000,
  STATS_TEAM: 5 * 60 * 1000,
  STATS_CONV: 60 * 1000,
};

// ============ STORE LOOKUP WITH CACHE ============

async function getCachedStore(identifier) {
  if (!identifier) return null;
  const key = `store:${identifier}`;
  const cached = appCache.get(key);
  if (cached) return cached;
  const store = await db.getStoreByIdentifier(identifier);
  if (store) appCache.set(key, store);
  return store;
}

function invalidateStoreCache(identifier) {
  if (identifier) appCache.invalidate(`store:${identifier}`);
  appCache.invalidatePrefix('stores:active');
  appCache.invalidate('stores:all');
  appCache.invalidatePrefix('convs:');
}

// ============ DEBOUNCED READ BROADCAST ============

const readBroadcastTimers = new Map();

function debouncedReadBroadcast(conversationId, conversationData) {
  clearTimeout(readBroadcastTimers.get(conversationId));
  readBroadcastTimers.set(conversationId, setTimeout(() => {
    broadcastToAgents({ type: 'conversation_read', conversationId, conversation: conversationData });
    readBroadcastTimers.delete(conversationId);
  }, 300));
}

// ============ LEGAL THREAT DETECTION ============

const LEGAL_THREAT_PATTERNS = [
  /\b(lawsuit|sue|suing|sued|litigation|litigate|legal action|take you to court|taking you to court|file a suit|filing a suit|small claims|civil suit|class action)\b/i,
  /\b(attorney|lawyer|legal counsel|solicitor|barrister|my lawyer|my attorney|legal team|law firm)\b/i,
  /\b(cease and desist|c&d|cease desist|legal notice|formal notice|demand letter|legal demand|legal letter)\b/i,
  /\b(bbb|better business bureau|ftc|federal trade commission|attorney general|consumer protection|chargeback dispute|credit card dispute|fraud claim|report you|file a complaint|regulatory complaint)\b/i,
  /\b(fraud|scam|illegal|criminal|press charges|file charges|police report|law enforcement|stolen|theft|deceptive practices)\b/i,
  /\b(damages|compensation|liable|liability|negligence|breach of contract|consumer rights violation)\b/i,
];

const LEGAL_SEVERITY_MAP = {
  critical: [
    /cease and desist/i, /class action/i, /attorney general/i, /fraud claim/i,
    /breach of contract/i, /consumer rights violation/i, /press charges|file charges/i, /law firm/i,
  ],
  high: [
    /lawsuit|sue\b|suing|litigation/i, /attorney|lawyer|legal counsel/i,
    /legal notice|demand letter/i, /ftc|federal trade commission/i,
    /criminal|illegal/i, /damages|liable|liability/i,
  ],
  medium: [
    /bbb|better business bureau/i, /chargeback dispute|credit card dispute/i,
    /report you|file a complaint/i, /fraud|scam/i, /negligence/i,
  ],
};

function detectLegalThreat(content) {
  if (!content || typeof content !== 'string') return null;
  if (!LEGAL_THREAT_PATTERNS.some(p => p.test(content))) return null;
  for (const [severity, patterns] of Object.entries(LEGAL_SEVERITY_MAP)) {
    for (const pattern of patterns) {
      const match = content.match(pattern);
      if (match) {
        return {
          detected: true, severity, matchedTerm: match[0],
          snippet: content.length > 200 ? content.substring(0, 200) + '...' : content,
        };
      }
    }
  }
  return { detected: true, severity: 'medium', matchedTerm: 'legal keyword', snippet: content.substring(0, 200) };
}

function detectLegalDocumentType(text) {
  const documentSignatures = [
    { type: 'Cease and Desist Letter', severity: 'critical', patterns: [/CEASE AND DESIST/i, /cease.{0,20}desist/i] },
    { type: 'Demand Letter', severity: 'critical', patterns: [/DEMAND LETTER/i, /formal demand/i, /hereby demand/i, /demand that you/i, /demand for payment/i] },
    { type: 'Court Summons / Complaint', severity: 'critical', patterns: [/SUMMONS/i, /PLAINTIFF.*DEFENDANT/is, /IN THE (SUPERIOR|DISTRICT|SUPREME|CIRCUIT|COUNTY|PROVINCIAL|SMALL CLAIMS) COURT/i, /COURT OF (QUEEN|KING)'S BENCH/i, /STATEMENT OF CLAIM/i, /NOTICE OF CIVIL CLAIM/i] },
    { type: 'BBB / Consumer Complaint', severity: 'high', patterns: [/BETTER BUSINESS BUREAU/i, /BBB COMPLAINT/i, /CONSUMER PROTECTION/i] },
    { type: 'Chargeback Notice', severity: 'high', patterns: [/CHARGEBACK/i, /DISPUTE NOTIFICATION/i, /RETRIEVAL REQUEST/i, /REASON CODE.{0,20}(fraud|not received|unauthorized)/i] },
    { type: 'Notice of Legal Action', severity: 'critical', patterns: [/NOTICE OF (LEGAL ACTION|INTENT TO SUE|LITIGATION)/i, /without further legal action/i, /legal proceedings will/i, /compelled to seek legal/i, /pursue legal remedies/i] },
    { type: 'Small Claims Filing', severity: 'critical', patterns: [/SMALL CLAIMS/i, /PLAINTIFF'S CLAIM/i, /CLAIM AMOUNT/i] },
  ];
  for (const sig of documentSignatures) {
    if (sig.patterns.some(p => p.test(text))) return { type: sig.type, severity: sig.severity };
  }
  const formalLetterScore = [
    /\bRE:\s/i, /\bDear (Sir|Madam|Counsel|Mr\.|Ms\.|Mrs\.)/i,
    /\bsincerely yours\b|\byours truly\b|\byours faithfully\b/i,
    /\b(Esq\.|Attorney at Law|Barrister|Solicitor|LLB|JD)\b/i,
    /\bwithout prejudice\b/i, /\bpursuant to\b/i, /\bhereby (notify|demand|give notice)\b/i,
  ].filter(p => p.test(text)).length;
  if (formalLetterScore >= 3) return { type: 'Formal Legal Correspondence', severity: 'high' };
  return null;
}

async function handleLegalThreat(threat, conversationId, storeId, senderName, messageContent, pool) {
  const emoji = threat.severity === 'critical' ? '🚨' : threat.severity === 'high' ? '⚠️' : '🔔';
  console.log(`${emoji} [LEGAL FLAG] ${threat.severity.toUpperCase()} | Conv: ${conversationId} | "${threat.matchedTerm}" | From: ${senderName}`);
  try {
    await pool.query(`
      UPDATE conversations SET priority = 'urgent',
        tags = CASE WHEN tags IS NULL THEN ARRAY['legal-flag']
                    WHEN NOT ('legal-flag' = ANY(tags)) THEN array_append(tags, 'legal-flag')
                    ELSE tags END,
        legal_flag = TRUE, legal_flag_severity = $1, legal_flag_at = NOW(),
        legal_flag_term = $2, updated_at = NOW()
      WHERE id = $3
    `, [threat.severity, threat.matchedTerm, conversationId]);
  } catch (dbErr) {
    console.warn('[LEGAL FLAG] Extended columns not found, fallback:', dbErr.message);
    try {
      await pool.query(`UPDATE conversations SET priority = 'urgent', updated_at = NOW() WHERE id = $1`, [conversationId]);
    } catch (fallbackErr) {
      console.error('[LEGAL FLAG] Fallback DB update failed:', fallbackErr.message);
    }
  }
  broadcastToAgents({
    type: 'legal_threat_detected',
    alert: {
      conversationId, storeId, severity: threat.severity, matchedTerm: threat.matchedTerm,
      senderName, snippet: threat.snippet, timestamp: new Date().toISOString(), emoji,
      fromAttachment: threat.fromAttachment || false, documentType: threat.documentType || null,
      message: `${emoji} LEGAL THREAT DETECTED (${threat.severity.toUpperCase()}): "${threat.matchedTerm}" — from ${senderName}`,
    },
  });
  sendLegalFlagEmail(threat, conversationId, senderName, messageContent, pool)
    .catch(err => console.error('[LEGAL FLAG] Email notification failed:', err.message));
}

async function sendLegalFlagEmail(threat, conversationId, senderName, messageContent, pool) {
  const RESEND_API_KEY = process.env.RESEND_API_KEY;
  const ALERT_EMAIL = process.env.LEGAL_ALERT_EMAIL || process.env.ADMIN_EMAIL;
  if (!RESEND_API_KEY || !ALERT_EMAIL) {
    console.warn('[LEGAL FLAG] No RESEND_API_KEY or LEGAL_ALERT_EMAIL — skipping');
    return;
  }
  const severity = threat.severity.toUpperCase();
  const emoji = threat.severity === 'critical' ? '🚨' : threat.severity === 'high' ? '⚠️' : '🔔';
  const appUrl = process.env.APP_URL || 'https://your-app.com';
  const sourceLabel = threat.fromAttachment ? `Uploaded Document (${threat.documentType || 'file'})` : 'Chat Message';
  const html = `<div style="font-family:sans-serif;max-width:600px;margin:0 auto">
    <div style="background:${threat.severity === 'critical' ? '#dc2626' : threat.severity === 'high' ? '#d97706' : '#2563eb'};color:white;padding:16px 24px;border-radius:8px 8px 0 0">
      <h1 style="margin:0;font-size:20px">${emoji} Legal Threat Detected — ${severity}</h1></div>
    <div style="background:#f9fafb;border:1px solid #e5e7eb;border-top:none;padding:24px;border-radius:0 0 8px 8px">
      <p><strong>Severity:</strong> ${severity}</p><p><strong>Matched Term:</strong> "${threat.matchedTerm}"</p>
      <p><strong>Source:</strong> ${sourceLabel}</p><p><strong>From:</strong> ${senderName}</p>
      <p><strong>Conversation:</strong> #${conversationId}</p>
      <p><strong>Time:</strong> ${new Date().toLocaleString('en-US', { timeZone: 'America/Toronto' })} EST</p>
      <blockquote>"${threat.snippet}"</blockquote>
      <a href="${appUrl}/conversations/${conversationId}" style="display:inline-block;background:#111827;color:white;padding:10px 24px;border-radius:6px;text-decoration:none;font-weight:600">Open Conversation →</a>
    </div></div>`;
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: process.env.EMAIL_FROM || 'alerts@yourdomain.com', to: ALERT_EMAIL,
      subject: `${emoji} [${severity}] Legal Threat — Conv #${conversationId} — "${threat.matchedTerm}"`, html,
    }),
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) throw new Error(`Resend API error: ${await response.text()}`);
  console.log(`[LEGAL FLAG] Alert email sent to ${ALERT_EMAIL} for conv #${conversationId}`);
}

async function extractTextFromPDF(fileUrl) {
  try {
    const pdfParse = require('pdf-parse');
    const response = await fetch(fileUrl, { signal: AbortSignal.timeout(20000) });
    if (!response.ok) throw new Error(`Failed to fetch PDF: ${response.status}`);
    const buffer = await response.arrayBuffer();
    const data = await pdfParse(Buffer.from(buffer));
    return data.text || '';
  } catch (err) { console.error('[PDF Extract] Error:', err.message); return ''; }
}

async function extractTextFromImage(fileUrl) {
  const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
  if (!ANTHROPIC_API_KEY) return '';
  try {
    const response = await fetch(fileUrl, { signal: AbortSignal.timeout(20000) });
    const buffer = await response.arrayBuffer();
    const base64 = Buffer.from(buffer).toString('base64');
    const mimeType = response.headers.get('content-type') || 'image/jpeg';
    const apiResponse = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001', max_tokens: 1000,
        messages: [{ role: 'user', content: [
          { type: 'image', source: { type: 'base64', media_type: mimeType, data: base64 } },
          { type: 'text', text: 'Extract all text from this image exactly as written. Return only the raw text, no commentary.' },
        ] }],
      }),
      signal: AbortSignal.timeout(20000),
    });
    const data = await apiResponse.json();
    return data.content?.[0]?.text || '';
  } catch (err) { console.error('[Image OCR] Error:', err.message); return ''; }
}

async function analyzeLegalAttachment(fileData, conversationId, storeId, senderName, pool) {
  const fileUrl = fileData?.url || fileData?.fileUrl;
  const mimeType = fileData?.mimeType || fileData?.type || '';
  if (!fileUrl) return;
  console.log(`[LEGAL ATTACH] Scanning file: ${fileUrl} (${mimeType})`);
  try {
    let extractedText = '';
    if (mimeType === 'application/pdf' || fileUrl.endsWith('.pdf')) {
      extractedText = await extractTextFromPDF(fileUrl);
    } else if (mimeType.startsWith('image/') || /\.(jpg|jpeg|png|webp|gif)$/i.test(fileUrl)) {
      extractedText = await extractTextFromImage(fileUrl);
    } else { return; }
    if (!extractedText) return;
    console.log(`[LEGAL ATTACH] Extracted ${extractedText.length} chars`);
    const docType = detectLegalDocumentType(extractedText);
    if (docType) {
      console.log(`🚨 [LEGAL ATTACH] Legal document detected: ${docType.type}`);
      await handleLegalThreat({
        detected: true, severity: docType.severity, matchedTerm: docType.type,
        snippet: extractedText.substring(0, 300), fromAttachment: true, documentType: docType.type,
      }, conversationId, storeId, senderName, `[ATTACHED DOCUMENT] ${extractedText.substring(0, 500)}`, pool);
      return;
    }
    const threat = detectLegalThreat(extractedText);
    if (threat) {
      threat.fromAttachment = true;
      await handleLegalThreat(threat, conversationId, storeId, senderName, extractedText, pool);
    }
  } catch (err) { console.error('[LEGAL ATTACH] File analysis failed:', err.message); }
}

// ============ MIDDLEWARE ============

app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  frameguard: false,
}));

app.post('/webhooks/:shop/:topic', rawBodyMiddleware, handleWebhook);
app.use(express.json({ limit: '10mb' }));

// Session is only needed for the Shopify OAuth handshake. Mounting it globally
// with the default MemoryStore leaks an entry per request and eventually
// OOM-restarts the process.
const shopifySession = session({
  secret: process.env.JWT_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: { secure: process.env.NODE_ENV === 'production', maxAge: 24 * 60 * 60 * 1000 },
});
app.use('/auth', shopifySession);
app.use('/shopify', shopifySession);

app.get('/widget-init.js', (req, res) => {
  res.set({
    'Content-Type': 'application/javascript; charset=utf-8', 'Cache-Control': 'public, max-age=3600',
    'X-Content-Type-Options': 'nosniff', 'Access-Control-Allow-Origin': '*',
  });
  res.sendFile(__dirname + '/public/widget-init.js');
});

app.get('/pepstack-init.js', (req, res) => {
  res.set({
    'Content-Type': 'application/javascript; charset=utf-8', 'Cache-Control': 'public, max-age=3600',
    'X-Content-Type-Options': 'nosniff', 'Access-Control-Allow-Origin': '*',
  });
  res.sendFile(__dirname + '/public/pepstack-init.js');
});

app.get('/widget.html', (req, res) => {
  res.removeHeader('X-Frame-Options');
  res.set({
    'Content-Type': 'text/html; charset=utf-8', 'X-Content-Type-Options': 'nosniff',
    'Cache-Control': 'no-cache, must-revalidate', 'Content-Security-Policy': 'frame-ancestors *',
  });
  res.sendFile(__dirname + '/public/widget.html');
});

app.use(express.static(__dirname + '/public'));

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, max: 500, message: 'Too many requests from this IP.',
  standardHeaders: true, legacyHeaders: false,
  skip: (req) => {
    const h = req.headers.authorization;
    if (h?.startsWith('Bearer ')) {
      try { const { verifyToken } = require('./auth'); return !!verifyToken(h.split(' ')[1]); }
      catch { return false; }
    }
    return false;
  },
  validate: { xForwardedForHeader: false, trustProxy: false },
});

const widgetLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, max: 500, message: 'Too many requests.',
  standardHeaders: true, legacyHeaders: false,
  validate: { xForwardedForHeader: false, trustProxy: false },
});

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, max: 50, skipSuccessfulRequests: true,
  handler: (req, res) => {
    const origin = req.headers.origin;
    if (ALLOWED_ORIGINS.includes(origin)) {
      res.header('Access-Control-Allow-Origin', origin);
      res.header('Access-Control-Allow-Credentials', 'true');
    }
    res.status(429).json({ error: 'Too many login attempts. Please try again in 15 minutes.' });
  },
});

app.use('/api/promo', promoRoutes);
app.use('/api/widget/', widgetLimiter);
app.use('/api/customers/', widgetLimiter);
app.use('/api/', limiter);

if (process.env.NODE_ENV === 'production') {
  app.use((req, res, next) => {
    if (req.header('x-forwarded-proto') !== 'https') {
      res.redirect(`https://${req.header('host')}${req.url}`);
    } else next();
  });
}

if (process.env.NODE_ENV !== 'production') {
  app.use((req, res, next) => { console.log(`${req.method} ${req.path}`); next(); });
}

// ============ HEALTH ============
// /health = liveness. No DB. Point the platform health check HERE. A DB blip
// must not cause a restart — restarts drop every WebSocket and re-run boot
// work, which was making the outage self-sustaining.

app.get('/health', (req, res) => {
  const ws = getWebSocketStats();
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: Math.floor(process.uptime()),
    websocket: {
      active: ws.totalConnections > 0, connections: ws.totalConnections,
      agents: ws.agentCount, customers: ws.customerCount,
      authenticated: ws.authenticatedCount, activeConversations: ws.activeConversations,
    },
    version: process.env.npm_package_version || '1.0.0',
  });
});

// /health/db = readiness/diagnostics. Reports degraded, never 503.
app.get('/health/db', async (req, res) => {
  const started = Date.now();
  try {
    const now = await db.testConnection();
    res.json({ database: 'connected', serverTime: now, latencyMs: Date.now() - started, pool: db.getPoolStats() });
  } catch (error) {
    res.json({ database: 'degraded', error: error.message, latencyMs: Date.now() - started, pool: db.getPoolStats() });
  }
});

// Ops visibility: pool saturation + search index validity in one place.
app.get('/health/diagnostics', authenticateToken, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin access required' });
  try {
    const [indexes, activity] = await Promise.all([
      db.checkSearchIndexes(),
      db.pool.query(`
        SELECT state, count(*)::int AS n, max(now() - state_change) AS oldest
          FROM pg_stat_activity WHERE datname = current_database() GROUP BY state
      `),
    ]);
    res.json({
      pool: db.getPoolStats(),
      cacheEntries: appCache.size,
      searchIndexes: indexes,
      dbActivity: activity.rows,
      uptime: Math.floor(process.uptime()),
      memoryMb: Math.round(process.memoryUsage().rss / 1024 / 1024),
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ============ WIDGET API ENDPOINTS ============

app.get('/api/stores/verify', async (req, res) => {
  try {
    const { domain } = req.query;
    if (!domain) return res.status(400).json({ error: 'domain parameter required' });
    const store = await db.getStoreByDomain(domain);
    if (!store || !store.is_active) {
      return res.status(404).json({ error: 'Store not found or inactive', message: 'Please install the chat app from Shopify' });
    }
    res.json({
      storeId: store.id, storeIdentifier: store.store_identifier, shopDomain: store.shop_domain,
      brandName: store.brand_name, active: store.is_active, verified: true,
    });
  } catch (error) { console.error('Store verification error:', error.message); res.status(500).json({ error: 'Verification failed' }); }
});

app.get('/api/widget/settings', async (req, res) => {
  try {
    const { store: storeIdentifier } = req.query;
    if (!storeIdentifier) return res.status(400).json({ error: 'store parameter required' });
    const store = await getCachedStore(storeIdentifier);
    if (!store || !store.is_active) return res.status(404).json({ error: 'Store not found or inactive' });
    res.json({
      storeId: store.id, storeIdentifier: store.store_identifier, brandName: store.brand_name,
      primaryColor: store.primary_color || '#667eea', logoUrl: store.logo_url,
      widgetSettings: store.widget_settings || {
        position: 'bottom-right', greeting: 'Hi! How can we help you today?',
        placeholder: 'Type your message...', showAvatar: true,
      },
      businessHours: store.business_hours, timezone: store.timezone || 'UTC',
    });
  } catch (error) { console.error('Widget settings error:', error.message); res.status(500).json({ error: 'Failed to fetch settings' }); }
});

app.get('/api/widget/session', async (req, res) => {
  try {
    const { store } = req.query;
    if (!store) return res.status(400).json({ error: 'store parameter required' });
    const storeRecord = await getCachedStore(store);
    if (!storeRecord || !storeRecord.is_active) return res.status(404).json({ error: 'Store not found or inactive' });
    const { generateWidgetToken } = require('./auth');
    const token = generateWidgetToken(storeRecord);
    res.json({ token, expiresIn: process.env.WIDGET_JWT_EXPIRES_IN || '2h' });
  } catch (error) { console.error('Widget session error:', error.message); res.status(500).json({ error: 'Failed to create widget session' }); }
});

app.get('/api/widget/conversation/lookup', async (req, res) => {
  try {
    const { store, email } = req.query;
    if (!store || !email) return res.status(400).json({ error: 'store and email parameters required' });
    const storeRecord = await getCachedStore(store);
    if (!storeRecord || !storeRecord.is_active) return res.status(404).json({ error: 'Store not found or inactive' });
    const { rows } = await db.pool.query(
      `SELECT id FROM conversations
        WHERE customer_email = $1 AND shop_id = $2
        ORDER BY CASE WHEN status = 'open' THEN 0 ELSE 1 END, updated_at DESC
        LIMIT 1`, [email, storeRecord.id]);
    return res.json({ conversationId: rows[0]?.id ?? null });
  } catch (error) { console.error('Widget lookup error:', error.message); return res.status(500).json({ error: 'Lookup failed' }); }
});

// ============ STORE GROUPS ============

app.get('/api/stores/groups', authenticateToken, async (req, res) => {
  try {
    const groups = await db.getAllStoreGroups();
    res.json(groups.map(snakeToCamel));
  } catch (error) { console.error('Get store groups error:', error.message); res.status(500).json({ error: 'Failed to fetch store groups' }); }
});

async function resolveGroupId(identifier) {
  if (identifier == null) return null;
  if (/^\d+$/.test(String(identifier))) return parseInt(identifier, 10);
  const { rows } = await db.pool.query(
    `SELECT id FROM store_groups WHERE group_key = $1 LIMIT 1`, [String(identifier)]);
  return rows[0]?.id ?? null;
}

app.post('/api/stores/groups', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin access required' });
    const { groupKey, groupName, color } = req.body;
    if (!groupKey?.trim()) return res.status(400).json({ error: 'groupKey is required' });
    if (!groupName?.trim()) return res.status(400).json({ error: 'groupName is required' });
    const group = await db.createStoreGroup({ group_key: groupKey.trim(), group_name: groupName.trim(), color });
    res.status(201).json(snakeToCamel({ ...group, store_count: 0 }));
  } catch (error) {
    if (error.code === '23505' || error.code === '23505') return res.status(409).json({ error: 'A group with that key already exists' });
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/stores/groups/:id', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin access required' });
    const { groupKey, groupName, color } = req.body;
    if (!groupKey?.trim()) return res.status(400).json({ error: 'groupKey is required' });
    if (!groupName?.trim()) return res.status(400).json({ error: 'groupName is required' });
    const id = await resolveGroupId(req.params.id);
    if (id == null) return res.status(404).json({ error: 'Group not found' });
    const group = await db.updateStoreGroup(id, {
      group_key: groupKey.trim(), group_name: groupName.trim(), color,
    });
    if (!group) return res.status(404).json({ error: 'Group not found' });
    appCache.invalidatePrefix('stores:active');
    appCache.invalidate('stores:all');
    appCache.invalidatePrefix('convs:');
    res.json(snakeToCamel(group));
  } catch (error) {
    if (error.code === '23505') return res.status(409).json({ error: 'A group with that key already exists' });
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/stores/groups/:id', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin access required' });
    const force = req.query.force === 'true';
    const id = await resolveGroupId(req.params.id);
    if (id == null) return res.status(404).json({ error: 'Group not found' });
    const result = await db.deleteStoreGroup(id, { force });
    if (result.reason === 'not_found') return res.status(404).json({ error: 'Group not found' });
    if (result.reason === 'has_stores') {
      return res.status(409).json({
        error: `Group has ${result.storeCount} store(s) assigned. Pass ?force=true to unassign them and delete anyway.`,
        storeCount: result.storeCount,
      });
    }
    appCache.invalidatePrefix('stores:active');
    appCache.invalidate('stores:all');
    appCache.invalidatePrefix('convs:');
    res.json({ success: true, unassignedStores: result.unassignedStores || 0 });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

// ============ AUTHENTICATION ENDPOINTS ============

app.post('/api/employees/login', loginLimiter, async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password required' });
    if (!email.includes('@')) return res.status(400).json({ error: 'Invalid email format' });
    const employee = await db.getEmployeeByEmail(email);
    if (!employee) return res.status(401).json({ error: 'Invalid email or password' });
    if (!employee.is_active) return res.status(403).json({ error: 'Account is inactive' });
    const validPassword = await verifyPassword(password, employee.password_hash);
    if (!validPassword) return res.status(401).json({ error: 'Invalid email or password' });
    await db.updateEmployeeStatus(employee.id, { last_login: new Date(), is_online: true });
    const token = generateToken(employee);
    delete employee.password_hash; delete employee.api_token;
    appCache.invalidate('employees:list');
    res.json({ employee: snakeToCamel(employee), token, expiresIn: '7d' });
  } catch (error) { console.error('Login error:', error.message); res.status(500).json({ error: 'Login failed. Please try again.' }); }
});

app.post('/api/employees/logout', authenticateToken, async (req, res) => {
  try {
    await db.updateEmployeeStatus(req.user.id, { is_online: false });
    appCache.invalidate('employees:list');
    res.json({ message: 'Logged out successfully' });
  } catch (error) { console.error('Logout error:', error.message); res.status(500).json({ error: 'Logout failed' }); }
});

app.get('/api/auth/verify', authenticateToken, async (req, res) => {
  try {
    const cacheKey = `auth:${req.user.email}`;
    let employee = appCache.get(cacheKey);
    if (!employee) {
      employee = await db.getEmployeeByEmail(req.user.email);
      if (employee) {
        const { password_hash, api_token, ...safe } = employee;
        employee = safe;
        appCache.set(cacheKey, employee, TTL.AUTH);
      }
    }
    if (!employee || !employee.is_active) return res.status(403).json({ error: 'Invalid session' });
    res.json({ employee: snakeToCamel(employee) });
  } catch (error) { res.status(500).json({ error: 'Verification failed' }); }
});

app.get('/auth', async (req, res) => {
  try {
    const { shop } = req.query;
    if (!shop) return res.status(400).json({ error: 'Shop parameter required' });
    const authUrl = await getAuthUrl(shop);
    res.redirect(authUrl);
  } catch (error) { console.error('Auth error:', error.message); res.status(500).json({ error: 'Authentication failed' }); }
});

app.get('/auth/callback', handleCallback);
app.use('/shopify', shopifyAppRoutes);
app.use('/api/files', fileRoutes);
app.use('/api/ai/training', aiTrainingRoutes);
app.use('/api/ai', createAiRoutes({ getCachedStore }));

// ============ DISCORD REPORTS ============

const DISCORD_STATS_WEBHOOK = process.env.DISCORD_STATS_WEBHOOK;

function formatDuration(minutes) {
  if (minutes == null) return 'n/a';
  const totalSeconds = Math.round(minutes * 60);
  if (totalSeconds < 60) return `${totalSeconds}s`;
  if (totalSeconds < 3600) {
    const m = Math.floor(totalSeconds / 60);
    const s = totalSeconds % 60;
    return s === 0 ? `${m}m` : `${m}m ${s}s`;
  }
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

// NOTE: the real_messages CTEs are now bounded to 6 hours. Previously they had
// no time filter at all, so every hourly run computed LAG() over the ENTIRE
// messages table. 6h is enough context: the outer filter caps a response at
// 240 minutes and the reporting window is 1 hour.
async function sendHourlyResponseTimeStats() {
  if (!DISCORD_STATS_WEBHOOK) { console.log('📊 [Discord Stats] No webhook configured — skipping'); return; }
  try {
    const { rows: perAgent } = await db.pool.query(`
      WITH real_messages AS (
        SELECT id, conversation_id, sender_id, sender_type, sent_at,
          LAG(sender_type) OVER (PARTITION BY conversation_id ORDER BY sent_at) AS prev_sender_type,
          LAG(sent_at)     OVER (PARTITION BY conversation_id ORDER BY sent_at) AS prev_sent_at,
          LAG(read_at)     OVER (PARTITION BY conversation_id ORDER BY sent_at) AS prev_read_at
        FROM messages
        WHERE sender_type IN ('customer','agent')
          AND NOT (sender_type = 'agent' AND sender_id IS NULL)
          AND sent_at >= NOW() - INTERVAL '6 hours'
      ),
      rt AS (
        SELECT sender_id,
               EXTRACT(EPOCH FROM (sent_at - COALESCE(prev_read_at, prev_sent_at))) / 60.0 AS minutes
        FROM real_messages
        WHERE sender_type = 'agent' AND sender_id IS NOT NULL
          AND prev_sender_type = 'customer' AND prev_sent_at IS NOT NULL
          AND sent_at >= NOW() - INTERVAL '1 hour'
          AND EXTRACT(EPOCH FROM (sent_at - COALESCE(prev_read_at, prev_sent_at))) / 60.0 BETWEEN 0 AND 240
      )
      SELECT COALESCE(e.employee_name, e.name, 'Unknown #' || rt.sender_id) AS display_name,
             ROUND(AVG(rt.minutes)::numeric, 3) AS avg_minutes,
             ROUND(MIN(rt.minutes)::numeric, 3) AS fastest_minutes,
             COUNT(*)::int AS replies
        FROM rt LEFT JOIN employees e ON e.id::text = rt.sender_id
       GROUP BY display_name
       ORDER BY replies DESC, avg_minutes ASC
    `);
    if (perAgent.length === 0) { console.log('📊 [Discord Stats] No activity in past hour — skipping post'); return; }

    const { rows: teamRows } = await db.pool.query(`
      WITH real_messages AS (
        SELECT conversation_id, sender_type, sent_at,
          LAG(sender_type) OVER (PARTITION BY conversation_id ORDER BY sent_at) AS prev_sender_type,
          LAG(sent_at)     OVER (PARTITION BY conversation_id ORDER BY sent_at) AS prev_sent_at,
          LAG(read_at)     OVER (PARTITION BY conversation_id ORDER BY sent_at) AS prev_read_at
        FROM messages
        WHERE sender_type IN ('customer','agent')
          AND NOT (sender_type = 'agent' AND sender_id IS NULL)
          AND sent_at >= NOW() - INTERVAL '6 hours'
      )
      SELECT ROUND(AVG(EXTRACT(EPOCH FROM (sent_at - COALESCE(prev_read_at, prev_sent_at))) / 60.0)::numeric, 3) AS avg_minutes,
             ROUND(MIN(EXTRACT(EPOCH FROM (sent_at - COALESCE(prev_read_at, prev_sent_at))) / 60.0)::numeric, 3) AS fastest_minutes,
             COUNT(*)::int AS total_replies
        FROM real_messages
       WHERE sender_type = 'agent' AND prev_sender_type = 'customer'
         AND prev_sent_at IS NOT NULL
         AND sent_at >= NOW() - INTERVAL '1 hour'
         AND EXTRACT(EPOCH FROM (sent_at - COALESCE(prev_read_at, prev_sent_at))) / 60.0 BETWEEN 0 AND 240
    `);

    const team = teamRows[0] || {};
    const teamAvg = team.avg_minutes !== null && team.avg_minutes !== undefined ? parseFloat(team.avg_minutes) : null;
    const teamFast = team.fastest_minutes !== null && team.fastest_minutes !== undefined ? parseFloat(team.fastest_minutes) : null;
    const teamTotal = team.total_replies || 0;

    const fields = perAgent.slice(0, 25).map(r => ({
      name: r.display_name,
      value: `Avg: **${formatDuration(parseFloat(r.avg_minutes))}**\nFastest: ${formatDuration(parseFloat(r.fastest_minutes))}\nReplies: ${r.replies}`,
      inline: true,
    }));
    const description = `**Team avg:** ${formatDuration(teamAvg)}  •  **Fastest:** ${formatDuration(teamFast)}  •  **Replies:** ${teamTotal}`;
    const color = teamAvg === null ? 0x6b7280 : teamAvg <= 5 ? 0x10b981 : teamAvg <= 30 ? 0xf59e0b : 0xef4444;
    const payload = {
      username: 'Response Time Bot',
      embeds: [{
        title: '⏱️ Hourly Response Time Report', description, color, fields,
        timestamp: new Date().toISOString(),
        footer: { text: 'Past hour • Measured from when agent first viewed the message • Cap 4h per response' },
      }],
    };
    const r = await fetch(DISCORD_STATS_WEBHOOK, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload), signal: AbortSignal.timeout(15000),
    });
    if (!r.ok) console.error(`📊 [Discord Stats] Webhook ${r.status}: ${await r.text()}`);
    else console.log(`📊 [Discord Stats] Sent — ${perAgent.length} agents, team avg ${formatDuration(teamAvg)}`);
  } catch (err) { console.error('📊 [Discord Stats] Error:', err.message); }
}

async function sendDailyActivityStats() {
  const webhook = process.env.DISCORD_DAILY_WEBHOOK;
  if (!webhook) { console.log('📊 [Discord Daily] No DISCORD_DAILY_WEBHOOK configured — skipping'); return; }
  try {
    const [convRows, msgRows, agentRows] = await Promise.all([
      db.pool.query(`
        SELECT
          (SELECT COUNT(*)::int FROM conversations WHERE created_at >= NOW() - INTERVAL '24 hours') AS new_convs,
          (SELECT COUNT(DISTINCT conversation_id)::int FROM messages
            WHERE sent_at >= NOW() - INTERVAL '24 hours'
              AND sender_type IN ('customer','agent')
              AND NOT (sender_type = 'agent' AND sender_id IS NULL)) AS active_convs
      `),
      db.pool.query(`
        SELECT COUNT(*) FILTER (WHERE sender_type = 'agent' AND sender_id IS NOT NULL)::int AS sent_count,
               COUNT(*) FILTER (WHERE sender_type = 'customer')::int AS received_count
          FROM messages WHERE sent_at >= NOW() - INTERVAL '24 hours'
      `),
      db.pool.query(`
        SELECT COALESCE(e.employee_name, e.name, 'Unknown #' || m.sender_id) AS display_name,
               COUNT(*)::int AS message_count
          FROM messages m LEFT JOIN employees e ON e.id::text = m.sender_id
         WHERE m.sender_type = 'agent' AND m.sender_id IS NOT NULL
           AND m.sent_at >= NOW() - INTERVAL '24 hours'
         GROUP BY display_name ORDER BY message_count DESC
      `),
    ]);
    const newConvs = convRows.rows[0]?.new_convs || 0;
    const activeConvs = convRows.rows[0]?.active_convs || 0;
    const sentCount = msgRows.rows[0]?.sent_count || 0;
    const recvCount = msgRows.rows[0]?.received_count || 0;
    const activeEmps = agentRows.rows.length;

    const fields = [
      { name: '💬 Conversations', value: `**${activeConvs}** active\n**${newConvs}** new`, inline: true },
      { name: '📥 Received', value: `**${recvCount}** customer messages`, inline: true },
      { name: '📤 Sent', value: `**${sentCount}** agent replies`, inline: true },
    ];
    if (agentRows.rows.length > 0) {
      const topList = agentRows.rows.slice(0, 15).map(r => `**${r.display_name}** — ${r.message_count} msgs`).join('\n');
      const remainder = agentRows.rows.length > 15 ? `\n_…and ${agentRows.rows.length - 15} more_` : '';
      fields.push({ name: `👥 Active Employees (${activeEmps})`, value: topList + remainder, inline: false });
    } else {
      fields.push({ name: '👥 Active Employees', value: '_No employee activity_', inline: false });
    }

    const now = new Date();
    const then = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const fmtRange = (d) => d.toLocaleString('en-US', {
      timeZone: 'America/Toronto', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
    });
    const payload = {
      username: 'Daily Activity Bot',
      embeds: [{
        title: '📅 Daily Activity Report',
        description: `**${fmtRange(then)} → ${fmtRange(now)}** (ET)`,
        color: 0x3b82f6, fields, timestamp: now.toISOString(),
        footer: { text: 'Past 24 hours • Excludes auto-replies' },
      }],
    };
    const r = await fetch(webhook, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload), signal: AbortSignal.timeout(15000),
    });
    if (!r.ok) console.error(`📊 [Discord Daily] Webhook ${r.status}: ${await r.text()}`);
    else console.log(`📊 [Discord Daily] Sent — ${activeConvs} convs (${newConvs} new), ${sentCount} sent, ${recvCount} received`);
  } catch (err) { console.error('📊 [Discord Daily] Error:', err.message); }
}

// ============ EMAIL SEND ============

app.post('/api/email/send', authenticateToken, async (req, res) => {
  const { to, subject, body, conversationId, customerName } = req.body;
  if (!to || !subject || !body) return res.status(400).json({ error: 'to, subject, and body are required' });
  try {
    let brandName = 'Support', brandColor = '#1a5632', fromAddress = 'support@pepscustomercare.com';
    let storeDomain = '', resolvedName = customerName || '';
    if (conversationId) {
      const r = await db.pool.query(
        `SELECT c.customer_name, s.brand_name, s.shop_domain, s.primary_color,
                s.email_from_address, s.email_brand_color
           FROM conversations c JOIN stores s ON c.shop_id = s.id WHERE c.id = $1`,
        [conversationId]);
      if (r.rows.length) {
        const row = r.rows[0];
        brandName = row.brand_name || brandName;
        brandColor = row.email_brand_color || row.primary_color || brandColor;
        fromAddress = row.email_from_address || fromAddress;
        storeDomain = (row.shop_domain || '').replace(/^https?:\/\//, '').replace(/\/$/, '');
        resolvedName = resolvedName || row.customer_name || '';
      }
    }
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) return res.status(500).json({ error: 'Email service not configured (missing RESEND_API_KEY)' });
    const agentName = req.user?.name || req.user?.email || 'Support Team';
    const year = new Date().getFullYear();
    const greeting = resolvedName ? `Hi ${resolvedName},` : 'Hi there,';
    const time = new Date().toLocaleString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit',
    });
    const safeBody = body.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const emailHtml = `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1.0"/><title>Message from ${brandName}</title></head>
<body style="margin:0;padding:0;background:#f6f6f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f6f6f7;"><tr><td align="center" style="padding:40px 16px 24px;">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;">
<tr><td style="padding-bottom:24px;"><table cellpadding="0" cellspacing="0"><tr>
<td style="vertical-align:middle;padding-right:10px;"><img src="https://chatsupportpullzone.b-cdn.net/uploads/shopify_logo-removebg-preview.png" width="100" height="28" alt="Shopify" style="display:block;border:0;"/></td>
<td style="vertical-align:middle;"><span style="font-size:16px;font-weight:600;color:#202223;">${brandName}</span></td></tr></table></td></tr>
<tr><td style="background:#fff;border-radius:8px;border:1px solid #e1e3e5;overflow:hidden;">
<table width="100%" cellpadding="0" cellspacing="0"><tr><td style="height:4px;background:${brandColor};border-radius:8px 8px 0 0;"></td></tr></table>
<table width="100%" cellpadding="0" cellspacing="0"><tr><td style="padding:32px 36px 36px;">
<h1 style="margin:0 0 4px;font-size:22px;font-weight:700;color:#202223;">You have a new message</h1>
<p style="margin:0 0 24px;font-size:14px;color:#6d7175;line-height:1.5;">${greeting} You have a new message from <strong>${agentName}</strong> at <strong>${brandName}</strong>.</p>
<table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;"><tr><td style="height:1px;background:#e1e3e5;"></td></tr></table>
<table width="100%" cellpadding="0" cellspacing="0"><tr><td>
<p style="margin:0 0 6px;font-size:13px;font-weight:600;color:#212326;">${agentName} <span style="font-size:12px;color:#8c9196;font-weight:400;margin-left:8px;">${time}</span></p>
<div style="background:#f6f6f7;border-radius:6px;padding:14px 16px;font-size:14px;color:#202223;line-height:1.6;white-space:pre-wrap;border:1px solid #e1e3e5;">${safeBody}</div>
</td></tr></table></td></tr></table></td></tr>
<tr><td style="padding:24px 0 0;text-align:center;">
<p style="margin:0 0 4px;font-size:12px;color:#8c9196;">This message was sent to you by the support team at ${storeDomain || brandName}.</p>
<p style="margin:0;font-size:11px;color:#babec3;">&copy; ${year} ${brandName}</p></td></tr>
</table></td></tr></table></body></html>`;

    const resendRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: `${brandName} <${fromAddress}>`, to: [to], subject, html: emailHtml,
        text: `${greeting}\n\n${agentName}:\n${body}`,
      }),
      signal: AbortSignal.timeout(20000),
    });
    const resendBody = await resendRes.json();
    if (!resendRes.ok) {
      console.error('[Email/send] Resend rejected:', resendBody);
      return res.status(502).json({ error: resendBody?.message || `Resend error ${resendRes.status}` });
    }
    console.log(`[Email/send] ✅ Sent to ${to} conv ${conversationId}`);
    res.json({ ok: true, id: resendBody.id });
  } catch (err) { console.error('[Email/send] Error:', err.message); res.status(500).json({ error: err.message }); }
});

// ============ PEPSTACK RECOMMENDATIONS ============

app.post('/pepstack', async (req, res) => {
  try {
    const { goal, age, sex, height, weight } = req.body;
    if (!goal) return res.status(400).json({ error: 'goal is required' });
    const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
    if (!ANTHROPIC_API_KEY) return res.status(500).json({ error: 'AI not configured' });

    const brainSearchTerms = [goal, age ? `age ${age}` : '', sex || '', weight || ''].filter(Boolean).join(' ');
    let brainContext = '', brainSettings = {};
    try {
      brainContext = await getBrainContext(db.pool, brainSearchTerms);
      brainSettings = await getBrainSettings(db.pool);
      console.log(`🧬 [PepStack] Brain loaded: ${brainContext.length} chars for goal="${goal}"`);
    } catch (brainErr) { console.warn('[PepStack] Brain load failed:', brainErr.message); }

    const bar = '━'.repeat(59);
    const brainBlock = brainContext.trim()
      ? `\n${bar}\nSTORE KNOWLEDGE BASE — USE THIS AS YOUR PRIMARY SOURCE\n${bar}\n${brainContext}\n${bar}\n`
      : '';
    const systemPrompt = `${brainBlock}You are a peptide protocol advisor for this store. Use the store knowledge base above as your PRIMARY source. Respond ONLY with valid JSON — no markdown, no preamble.\n\nJSON structure:\n{\n  "summary": "2-3 sentence personalised intro",\n  "stack": [{ "name": "Exact product name", "why": "1-2 sentences", "dose": "Dosing guidance" }],\n  "tip": "One practical stack or timing tip"\n}\n\nRules: 2-4 peptides max, exact product names from brain, no disclaimers inside JSON`;
    const userMsg = [
      `Goal: ${goal}`, age ? `Age: ${age}` : null, sex ? `Sex: ${sex}` : null,
      height ? `Height: ${height}` : null, weight ? `Weight: ${weight}` : null,
    ].filter(Boolean).join('\n');
    const userPrompt = brainContext.trim()
      ? `${brainBlock}Customer profile:\n${userMsg}\n\nUsing the store knowledge base above, recommend the best peptide stack. Return only JSON.`
      : `Customer profile:\n${userMsg}\n\nRecommend the best peptide stack. Return only JSON.`;

    const requestBody = JSON.stringify({
      model: 'claude-haiku-4-5-20251001', max_tokens: 800,
      system: systemPrompt, messages: [{ role: 'user', content: userPrompt }],
    });
    const data = await callAnthropicAPIWithRetry(requestBody, ANTHROPIC_API_KEY);
    const raw = data.content?.[0]?.text || '';
    const cleaned = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    try { return res.json(JSON.parse(cleaned)); }
    catch { console.error('[PepStack] JSON parse error:', raw.substring(0, 200)); return res.status(500).json({ error: 'Failed to parse AI response' }); }
  } catch (err) { console.error('[PepStack] Error:', err.message); return res.status(500).json({ error: 'Internal server error' }); }
});

// ============ STORE ENDPOINTS ============

app.get('/api/stores', authenticateToken, async (req, res) => {
  try {
    const { storeGroup } = req.query;
    const cacheKey = storeGroup ? `stores:active:${storeGroup}` : 'stores:active';
    const cached = appCache.get(cacheKey);
    if (cached) return res.json(cached);
    const stores = storeGroup
      ? await db.getStoresByFilters({ storeGroup })
      : await db.getAllActiveStores();
    const result = stores.map(snakeToCamel);
    appCache.set(cacheKey, result);
    res.json(result);
  } catch (error) { res.status(500).json({ error: error.message }); }
});

app.get('/api/stores/all', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin access required' });
    const cached = appCache.get('stores:all');
    if (cached) return res.json(cached);
    const result = await db.pool.query('SELECT * FROM stores ORDER BY brand_name ASC');
    const stores = result.rows.map(snakeToCamel);
    appCache.set('stores:all', stores);
    res.json(stores);
  } catch (error) { res.status(500).json({ error: error.message }); }
});

app.post('/api/stores', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin access required' });
    const { storeIdentifier, shopDomain, brandName, isActive, storeGroup, storeGroupName } = req.body;
    if (!storeIdentifier || !shopDomain || !brandName) {
      return res.status(400).json({ error: 'storeIdentifier, shopDomain, and brandName are required' });
    }
    const result = await db.pool.query(
      `INSERT INTO stores (store_identifier, shop_domain, brand_name, is_active, store_group,
                           store_group_name, access_token, installed_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,'',NOW(),NOW()) RETURNING *`,
      [storeIdentifier, shopDomain, brandName, isActive !== false,
       storeGroup ?? 'peptides-group', storeGroupName ?? null]);
    appCache.invalidatePrefix('stores:active');
    appCache.invalidate('stores:all');
    res.status(201).json(snakeToCamel(result.rows[0]));
  } catch (error) {
    if (error.code === '23505') return res.status(409).json({ error: 'A store with that identifier or domain already exists' });
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/stores/:id', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin access required' });
    const { shopDomain, brandName, isActive, storeGroup, storeGroupName } = req.body;
    const result = await db.pool.query(
      `UPDATE stores SET shop_domain = $1, brand_name = $2, is_active = $3,
              store_group = $4, store_group_name = $5, updated_at = NOW()
        WHERE id = $6 RETURNING *`,
      [shopDomain, brandName, isActive !== false, storeGroup ?? null, storeGroupName ?? null, req.params.id]);
    if (!result.rows[0]) return res.status(404).json({ error: 'Store not found' });
    invalidateStoreCache(result.rows[0].store_identifier);
    invalidateStoreCache(result.rows[0].shop_domain);
    res.json(snakeToCamel(result.rows[0]));
  } catch (error) { res.status(500).json({ error: error.message }); }
});

app.patch('/api/stores/:id/group', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin access required' });
    const { storeGroup, storeGroupName } = req.body;
    const result = await db.pool.query(
      `UPDATE stores SET store_group = COALESCE($1, store_group),
                         store_group_name = COALESCE($2, store_group_name),
                         updated_at = NOW()
        WHERE id = $3 RETURNING *`,
      [storeGroup ?? null, storeGroupName ?? null, req.params.id]);
    if (!result.rows[0]) return res.status(404).json({ error: 'Store not found' });
    invalidateStoreCache(result.rows[0].store_identifier);
    invalidateStoreCache(result.rows[0].shop_domain);
    res.json(snakeToCamel(result.rows[0]));
  } catch (error) { res.status(500).json({ error: error.message }); }
});

app.delete('/api/stores/:id', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin access required' });
    const lookup = await db.pool.query(
      'SELECT store_identifier, shop_domain FROM stores WHERE id = $1', [req.params.id]);
    const result = await db.pool.query('DELETE FROM stores WHERE id = $1 RETURNING id', [req.params.id]);
    if (!result.rows[0]) return res.status(404).json({ error: 'Store not found' });
    if (lookup.rows[0]) {
      invalidateStoreCache(lookup.rows[0].store_identifier);
      invalidateStoreCache(lookup.rows[0].shop_domain);
    }
    res.json({ success: true });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

app.get('/api/customer-context/:storeId/:email', authenticateToken, async (req, res) => {
  try {
    const store = await getCachedStore(req.params.storeId);
    if (!store) return res.status(404).json({ error: 'Store not found' });
    const context = await shopify.getCustomerContext(store, req.params.email);
    res.json(context);
  } catch (error) { console.error('Customer context error:', error.message); res.status(500).json({ error: 'Failed to fetch customer context' }); }
});

// ============ CUSTOMER & ORDER LOOKUP ============

async function getCachedShopifyContext(store, email) {
  const cacheKey = `shopify:${store.id}:${email}`;
  let ctx = appCache.get(cacheKey);
  if (!ctx) {
    ctx = await shopify.getCustomerContext(store, email);
    if (ctx) appCache.set(cacheKey, ctx, TTL.SHOPIFY);
  }
  return ctx;
}

app.get('/api/customers/lookup', async (req, res) => {
  try {
    const { store: storeIdentifier, email } = req.query;
    if (!storeIdentifier || !email) return res.status(400).json({ error: 'store and email parameters required' });
    const store = await getCachedStore(storeIdentifier);
    if (!store || !store.is_active) return res.status(404).json({ error: 'Store not found or inactive' });
    const customerContext = await getCachedShopifyContext(store, email);
    if (!customerContext?.customer) return res.status(404).json({ error: 'Customer not found' });
    const customer = customerContext.customer;
    res.json({
      id: customer.id,
      name: customer.name || `${customer.first_name || ''} ${customer.last_name || ''}`.trim(),
      email: customer.email, phone: customer.phone,
      createdAt: customer.created_at, updatedAt: customer.updated_at,
      ordersCount: customer.orders_count || 0,
      totalSpent: customer.total_spent ? parseFloat(customer.total_spent) : 0,
      tags: customer.tags, note: customer.note,
    });
  } catch (error) {
    console.error('Customer lookup error:', error.message);
    res.status(500).json({ error: 'Failed to fetch customer data', message: error.message });
  }
});

app.get('/api/customers/orders', async (req, res) => {
  try {
    const { store: storeIdentifier, email } = req.query;
    if (!storeIdentifier || !email) return res.status(400).json({ error: 'store and email parameters required' });
    const store = await getCachedStore(storeIdentifier);
    if (!store || !store.is_active) return res.status(404).json({ error: 'Store not found or inactive' });
    const customerContext = await getCachedShopifyContext(store, email);
    if (!customerContext?.orders) return res.json([]);
    const formattedOrders = customerContext.orders.map(order => ({
      id: order.id, orderNumber: order.order_number || order.name,
      status: order.financial_status || 'pending', fulfillmentStatus: order.fulfillment_status,
      total: order.total_price ? parseFloat(order.total_price) : 0,
      currency: order.currency, orderDate: order.created_at,
      items: order.line_items ? order.line_items.map(item => ({
        id: item.id, title: item.title, quantity: item.quantity, price: parseFloat(item.price),
      })) : [],
      trackingNumber: order.tracking_number, trackingUrl: order.tracking_url,
    }));
    formattedOrders.sort((a, b) => new Date(b.orderDate) - new Date(a.orderDate));
    res.json(formattedOrders);
  } catch (error) {
    console.error('Customer orders error:', error.message);
    res.status(500).json({ error: 'Failed to fetch orders', message: error.message });
  }
});

app.get('/api/customers/cart', (req, res) => {
  res.json({ subtotal: 0, items: [], itemCount: 0 });
});

app.post('/api/stores/:storeId/webhooks', authenticateToken, async (req, res) => {
  try {
    const store = await getCachedStore(req.params.storeId);
    if (!store) return res.status(404).json({ error: 'Store not found' });
    const webhookUrl = req.body.webhookUrl || `${process.env.APP_URL}/webhooks`;
    const results = await shopify.registerWebhooks(store, webhookUrl);
    res.json({ results });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

// ============ NOTES ============

app.get('/api/employees/:employeeId/notes', authenticateToken, async (req, res) => {
  try {
    const result = await db.pool.query(
      `SELECT id, employee_id, employee_name, title, content, created_at, updated_at
         FROM employee_notes ORDER BY created_at DESC LIMIT 500`);
    res.json(result.rows.map(snakeToCamel));
  } catch (error) { console.error('❌ Error fetching notes:', error.message); res.status(500).json({ error: 'Failed to fetch notes' }); }
});

app.post('/api/conversation-notes', authenticateToken, async (req, res) => {
  try {
    const { employeeId, title, content } = req.body;
    if (!employeeId) return res.status(400).json({ error: 'Missing employeeId' });
    if (!title && !content) return res.status(400).json({ error: 'Note must have a title or content' });
    const noteTitle = (title && title.trim()) || 'Untitled';
    const noteContent = (content && content.trim()) || '';
    if (noteTitle.length > 200) return res.status(400).json({ error: 'Title exceeds 200 characters' });
    if (noteContent.length > 5000) return res.status(400).json({ error: 'Content exceeds 5000 characters' });
    const employeeName = req.user.name || req.user.email || 'Unknown';
    const result = await db.pool.query(
      `INSERT INTO employee_notes (employee_id, employee_name, title, content, created_at, updated_at)
       VALUES ($1,$2,$3,$4,NOW(),NOW())
       RETURNING id, employee_id, employee_name, title, content, created_at, updated_at`,
      [employeeId, employeeName, noteTitle, noteContent]);
    res.status(201).json(snakeToCamel(result.rows[0]));
  } catch (error) { console.error('Error creating note:', error.message); res.status(500).json({ error: 'Failed to create note' }); }
});

app.delete('/api/conversation-notes/:noteId', authenticateToken, async (req, res) => {
  try {
    const noteId = parseInt(req.params.noteId, 10);
    if (Number.isNaN(noteId)) return res.status(400).json({ error: 'Invalid note ID' });
    const employeeId = req.user.id;
    const noteResult = await db.pool.query('SELECT employee_id FROM employee_notes WHERE id = $1', [noteId]);
    if (noteResult.rows.length === 0) return res.status(404).json({ error: 'Note not found' });
    if (noteResult.rows[0].employee_id !== employeeId && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'You can only delete your own notes' });
    }
    await db.pool.query('DELETE FROM employee_notes WHERE id = $1', [noteId]);
    res.json({ success: true, message: 'Note deleted' });
  } catch (error) { console.error('Error deleting note:', error.message); res.status(500).json({ error: 'Failed to delete note' }); }
});

// ============ CONVERSATION ENDPOINTS ============

// app.get('/api/conversations', authenticateToken, async (req, res) => {
//   try {
//     const { storeId, status, limit, offset, storeGroup } = req.query;
//     const filters = {};
//     if (storeId) filters.storeId = parseInt(storeId, 10);
//     if (status) filters.status = status;
//     else filters.excludeArchived = true;
//     if (limit) filters.limit = parseInt(limit, 10);
//     if (offset) filters.offset = parseInt(offset, 10);
//     if (storeGroup) filters.storeGroup = storeGroup;

//     const cacheKey = `convs:${storeId || 'all'}:${status || 'open'}:${limit || 'def'}:${offset || '0'}:${storeGroup || 'allgroups'}`;
//     const cached = appCache.get(cacheKey);
//     if (cached) return res.json(cached);

//     const conversations = await db.getConversations(filters);
//     const result = conversations.map(snakeToCamel);
//     appCache.set(cacheKey, result, TTL.CONVS);
//     res.json(result);
//   } catch (error) { console.error('Get conversations error:', error.message); res.status(500).json({ error: error.message }); }
// });


app.get('/api/conversations', authenticateToken, async (req, res) => {
  try {
    const { storeId, status, limit, offset, storeGroup, dateFrom, dateTo } = req.query;
    const filters = {};
    if (storeId) filters.storeId = parseInt(storeId, 10);
    if (status) filters.status = status;
    else filters.excludeArchived = true;
    if (limit) filters.limit = parseInt(limit, 10);
    if (offset) filters.offset = parseInt(offset, 10);
    if (storeGroup) filters.storeGroup = storeGroup;
    // Naive-UTC bounds ('YYYY-MM-DD HH:MM:SS.SSS') built client-side from the
    // agent's local day — compared against the naive last_message_at column.
    if (dateFrom) filters.dateFrom = dateFrom;
    if (dateTo) filters.dateTo = dateTo;

    // NOTE: the date bounds MUST be part of the key — otherwise a date-filtered
    // request and an unfiltered one collide and serve each other's rows.
    const cacheKey = `convs:${storeId || 'all'}:${status || 'open'}:${limit || 'def'}:${offset || '0'}:${storeGroup || 'allgroups'}:${dateFrom || 'any'}:${dateTo || 'any'}`;
    const cached = appCache.get(cacheKey);
    if (cached) return res.json(cached);

    const conversations = await db.getConversations(filters);
    const result = conversations.map(snakeToCamel);
    appCache.set(cacheKey, result, TTL.CONVS);
    res.json(result);
  } catch (error) { console.error('Get conversations error:', error.message); res.status(500).json({ error: error.message }); }
});


app.get('/api/widget/history', async (req, res) => {
  try {
    const { email, excludeConversationId } = req.query;
    if (!email || !email.includes('@')) return res.status(400).json({ error: 'Valid email required' });
    const params = excludeConversationId ? [email, parseInt(excludeConversationId, 10)] : [email];
    const result = await db.pool.query(`
      SELECT c.id, c.status, c.updated_at, c.shop_id, c.shop_domain,
             COALESCE(s.brand_name, c.shop_domain, 'Unknown Store') AS brand_name,
             m.content AS last_message_content, m.sender_type AS last_message_sender_type,
             m.timestamp AS last_message_at
        FROM conversations c
        LEFT JOIN stores s ON c.shop_id = s.id
        LEFT JOIN LATERAL (
          SELECT content, sender_type, timestamp FROM messages
           WHERE conversation_id = c.id ORDER BY timestamp DESC LIMIT 1
        ) m ON true
       WHERE c.customer_email = $1 ${excludeConversationId ? 'AND c.id != $2' : ''}
       ORDER BY c.updated_at DESC LIMIT 100
    `, params);
    if (!result.rows.length) return res.json({ linkedConversations: [], storeCount: 0, totalConversations: 0 });
    const byStore = {};
    for (const row of result.rows) {
      const storeKey = row.shop_id || row.shop_domain || 'unknown';
      if (!byStore[storeKey]) {
        byStore[storeKey] = {
          storeIdentifier: row.shop_domain, storeName: row.brand_name,
          shopId: row.shop_id, conversations: [],
        };
      }
      byStore[storeKey].conversations.push({
        id: row.id, status: row.status, updatedAt: row.updated_at,
        lastMessage: row.last_message_content ? {
          content: row.last_message_content.substring(0, 80),
          senderType: row.last_message_sender_type, createdAt: row.last_message_at,
        } : null,
      });
    }
    const storeGroups = Object.values(byStore);
    return res.json({
      linkedConversations: storeGroups, storeCount: storeGroups.length,
      totalConversations: result.rows.length,
    });
  } catch (error) { console.error('❌ [widget/history] Error:', error.message); return res.status(500).json({ error: 'Failed to fetch history' }); }
});

app.get('/api/conversations/linked/:email', authenticateToken, async (req, res) => {
  try {
    const { email } = req.params;
    const { excludeConversationId } = req.query;
    if (!email || !email.includes('@')) return res.status(400).json({ error: 'Valid email required' });

    const cacheKey = `linked:${email}:${excludeConversationId || 'none'}`;
    const cached = appCache.get(cacheKey);
    if (cached) return res.json(cached);

    const params = excludeConversationId ? [email, parseInt(excludeConversationId, 10)] : [email];
    const result = await db.pool.query(`
      SELECT c.id, c.status, c.created_at, c.updated_at, c.shop_domain, c.shop_id,
             COALESCE(s.brand_name, c.shop_domain, 'Unknown Store') AS brand_name,
             m.content AS last_message_content, m.sender_type AS last_message_sender_type,
             m.timestamp AS last_message_at
        FROM conversations c
        LEFT JOIN stores s ON c.shop_id = s.id
        LEFT JOIN LATERAL (
          SELECT content, sender_type, timestamp FROM messages
           WHERE conversation_id = c.id ORDER BY timestamp DESC LIMIT 1
        ) m ON true
       WHERE c.customer_email = $1 ${excludeConversationId ? 'AND c.id != $2' : ''}
       ORDER BY c.updated_at DESC LIMIT 200
    `, params);

    if (!result.rows.length) return res.json({ linkedConversations: [], storeCount: 0 });

    const byStore = {};
    for (const row of result.rows) {
      const storeKey = row.shop_id || row.shop_domain || 'unknown';
      if (!byStore[storeKey]) {
        byStore[storeKey] = {
          storeIdentifier: row.shop_domain, storeName: row.brand_name,
          shopId: row.shop_id, conversations: [],
        };
      }
      byStore[storeKey].conversations.push({
        id: row.id, status: row.status, createdAt: row.created_at, updatedAt: row.updated_at,
        messageCount: 0,
        lastMessage: row.last_message_content ? {
          content: row.last_message_content, senderType: row.last_message_sender_type,
          createdAt: row.last_message_at,
        } : null,
      });
    }
    const storeGroups = Object.values(byStore);
    const response = {
      customerEmail: email, linkedConversations: storeGroups,
      storeCount: storeGroups.length, totalConversations: result.rows.length,
    };
    appCache.set(cacheKey, response, TTL.LINKED);
    return res.json(response);
  } catch (error) { console.error('❌ [linked-conversations] Error:', error.message); return res.status(500).json({ error: 'Failed to fetch linked conversations' }); }
});

app.get('/api/conversations/search', authenticateToken, async (req, res) => {
  try {
    const q = (req.query.q || '').trim();
    if (q.length < 2) return res.json([]);
    const limit = Math.min(200, parseInt(req.query.limit, 10) || 100);
    const { storeGroup, storeId } = req.query;

    const likeEscape = (s) => s.replace(/[\\%_]/g, (c) => '\\' + c);
    const pattern = `%${likeEscape(q)}%`;

    const params = [pattern, limit];
    const scope = [];
    if (storeGroup) {
      params.push(storeGroup);
      scope.push(`c.shop_id IN (SELECT id FROM stores WHERE store_group = $${params.length})`);
    }
    if (storeId) {
      params.push(storeId);
      scope.push(`(c.store_identifier = $${params.length} OR c.shop_domain = $${params.length})`);
    }
    const scopeSql = scope.length ? `AND ${scope.join(' AND ')}` : '';

    const { rows } = await db.pool.query(`
      WITH matched AS (
        SELECT c.id FROM conversations c
         WHERE c.status NOT IN ('archived','blacklisted','blacklist')
           ${scopeSql}
           AND (
             c.customer_name ILIKE $1
             OR c.customer_email ILIKE $1
             OR EXISTS (SELECT 1 FROM messages m
                         WHERE m.conversation_id = c.id AND m.content ILIKE $1)
           )
         LIMIT $2
      )
      SELECT c.*, lm.content AS last_message, lm.sender_type AS last_message_sender_type,
             lm.sent_at AS last_message_at
        FROM conversations c
        JOIN matched ON matched.id = c.id
        LEFT JOIN LATERAL (
          SELECT content, sender_type, sent_at FROM messages
           WHERE conversation_id = c.id ORDER BY sent_at DESC LIMIT 1
        ) lm ON true
       ORDER BY lm.sent_at DESC NULLS LAST
       LIMIT $2
    `, params);

    res.json(rows.map(snakeToCamel));
  } catch (error) { console.error('Conversation search error:', error.message); res.status(500).json({ error: 'Search failed' }); }
});

app.get('/api/conversations/archived', authenticateToken, async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, parseInt(req.query.limit, 10) || 30);
    const offset = (page - 1) * limit;
    const storeIdentifier = req.query.storeIdentifier || null;
    const params = [limit, offset];
    let whereExtra = '';
    if (storeIdentifier) {
      params.push(storeIdentifier);
      whereExtra = `AND (c.store_identifier = $${params.length} OR c.shop_domain = $${params.length})`;
    }
    const { rows } = await db.pool.query(
      `SELECT c.*, COUNT(*) OVER() AS total_count FROM conversations c
        WHERE c.status = 'archived' ${whereExtra}
        ORDER BY c.archived_at DESC NULLS LAST, c.updated_at DESC LIMIT $1 OFFSET $2`, params);
    const total = rows.length ? parseInt(rows[0].total_count, 10) : 0;
    return res.json({
      conversations: rows.map(r => { const row = { ...r }; delete row.total_count; return snakeToCamel(row); }),
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (err) { console.error('❌ [archived list] Error:', err.message); return res.status(500).json({ error: 'Failed to fetch archived conversations' }); }
});

app.get('/api/conversations/:id', authenticateToken, async (req, res) => {
  try {
    const conversation = await db.getConversation(parseInt(req.params.id, 10));
    if (!conversation) return res.status(404).json({ error: 'Conversation not found' });
    res.json(snakeToCamel(conversation));
  } catch (error) { console.error('Error fetching conversation:', error.message); res.status(500).json({ error: error.message }); }
});

app.post('/api/conversations', async (req, res) => {
  try {
    const { storeIdentifier, customerEmail, customerName, initialMessage, fileData } = req.body;
    if (!storeIdentifier || !customerEmail) {
      return res.status(400).json({ error: 'storeIdentifier and customerEmail required' });
    }
    const store = await getCachedStore(storeIdentifier);
    if (!store) return res.status(404).json({ error: 'Store not found' });

    const blCheck = await db.pool.query(
      `SELECT id FROM blacklist
        WHERE email = $1 AND removed_at IS NULL
          AND (store_identifier IS NULL OR store_identifier = $2) LIMIT 1`,
      [customerEmail.toLowerCase().trim(), store.store_identifier]);
    if (blCheck.rowCount > 0) {
      console.log(`🚫 [Blacklist] Blocked conversation attempt from ${customerEmail} on ${store.store_identifier}`);
      return res.status(403).json({ error: 'blocked', message: 'Unable to start a conversation at this time.' });
    }

    const conversation = await db.saveConversation({
      store_id: store.id, store_identifier: store.shop_domain,
      customer_email: customerEmail, customer_name: customerName || customerEmail,
      status: 'open', priority: 'normal',
    });
    appCache.invalidatePrefix('convs:');
    res.json(snakeToCamel(conversation));

    setImmediate(async () => {
      try {
        if (initialMessage) {
          const message = await db.saveMessage({
            conversation_id: conversation.id, store_id: store.id, sender_type: 'customer',
            sender_name: customerName || customerEmail, content: initialMessage,
            file_data: fileData ? JSON.stringify(fileData) : null,
          });
          broadcastToAgents({
            type: 'new_message', message: snakeToCamel(message),
            conversationId: conversation.id, storeId: store.id,
          });
        }
        broadcastToAgents({
          type: 'new_conversation', conversation: snakeToCamel(conversation),
          storeId: store.id, storeIdentifier,
        });
      } catch (error) { console.error('Background conversation processing error:', error.message); }
    });
  } catch (error) { console.error('Create conversation error:', error.message); res.status(500).json({ error: error.message }); }
});

app.put('/api/conversations/:id', authenticateToken, async (req, res) => {
  try {
    const conversation = await db.updateConversation(parseInt(req.params.id, 10), req.body);
    if (!conversation) return res.status(404).json({ error: 'Conversation not found' });
    appCache.invalidatePrefix('convs:');
    res.json(snakeToCamel(conversation));
  } catch (error) { res.status(500).json({ error: error.message }); }
});

app.put('/api/conversations/:id/read', authenticateToken, async (req, res) => {
  try {
    const conversationId = parseInt(req.params.id, 10);
    await db.markConversationRead(conversationId);
    res.json({ success: true });
    setImmediate(async () => {
      try {
        const updated = await db.getConversation(conversationId);
        if (updated) debouncedReadBroadcast(conversationId, snakeToCamel(updated));
      } catch (e) { console.error('[read broadcast] Error:', e.message); }
    });
  } catch (error) { console.error('Error marking as read:', error.message); res.status(500).json({ error: error.message }); }
});

app.put('/api/conversations/:id/unread', authenticateToken, async (req, res) => {
  try {
    const conversationId = parseInt(req.params.id, 10);
    await db.pool.query(
      `UPDATE conversations SET unread_count = 1, updated_at = NOW() WHERE id = $1`, [conversationId]);
    const updated = await db.getConversation(conversationId);
    if (!updated) return res.status(404).json({ error: 'Conversation not found' });
    broadcastToAgents({ type: 'conversation_unread', conversationId, conversation: snakeToCamel(updated) });
    res.json({ success: true, conversationId });
  } catch (error) { console.error('Error marking as unread:', error.message); res.status(500).json({ error: error.message }); }
});

app.put('/api/conversations/:id/close', authenticateToken, async (req, res) => {
  try {
    const conversation = await db.closeConversation(parseInt(req.params.id, 10));
    if (!conversation) return res.status(404).json({ error: 'Conversation not found' });
    appCache.invalidatePrefix('convs:');
    res.json(snakeToCamel(conversation));
  } catch (error) { res.status(500).json({ error: error.message }); }
});

// ── ARCHIVE ─────────────────────────────────────────────────────────────────

app.patch('/api/conversations/:id/archive', authenticateToken, async (req, res) => {
  try {
    const conversationId = parseInt(req.params.id, 10);
    const result = await db.pool.query(
      `UPDATE conversations SET status = 'archived', archived_at = NOW(), updated_at = NOW()
        WHERE id = $1 AND status != 'archived' RETURNING *`, [conversationId]);
    if (result.rowCount === 0) {
      const existing = await db.getConversation(conversationId);
      if (!existing) return res.status(404).json({ error: 'Conversation not found' });
      return res.json(snakeToCamel(existing));
    }
    const archived = snakeToCamel(result.rows[0]);
    appCache.invalidatePrefix('convs:');
    broadcastToAgents({ type: 'conversation_archived', conversationId, conversation: archived });
    console.log(`📦 [Archive] Conv #${conversationId} archived by ${req.user.email}`);
    return res.json(archived);
  } catch (err) { console.error('❌ [archive] Error:', err.message); return res.status(500).json({ error: 'Failed to archive conversation' }); }
});

app.patch('/api/conversations/:id/unarchive', authenticateToken, async (req, res) => {
  try {
    const conversationId = parseInt(req.params.id, 10);
    const result = await db.pool.query(
      `UPDATE conversations SET status = 'open', archived_at = NULL, updated_at = NOW()
        WHERE id = $1 AND status = 'archived' RETURNING *`, [conversationId]);
    if (result.rowCount === 0) {
      const existing = await db.getConversation(conversationId);
      if (!existing) return res.status(404).json({ error: 'Conversation not found' });
      return res.json(snakeToCamel(existing));
    }
    const unarchived = snakeToCamel(result.rows[0]);
    appCache.invalidatePrefix('convs:');
    broadcastToAgents({ type: 'conversation_unarchived', conversationId, conversation: unarchived });
    console.log(`📬 [Unarchive] Conv #${conversationId} restored by ${req.user.email}`);
    return res.json(unarchived);
  } catch (err) { console.error('❌ [unarchive] Error:', err.message); return res.status(500).json({ error: 'Failed to unarchive conversation' }); }
});

// ============ MESSAGE ENDPOINTS ============

const MESSAGE_PAGE_DEFAULT = Number(process.env.MESSAGE_PAGE_SIZE || 200);
const MESSAGE_PAGE_MAX = 500;

function messagePageOptions(req) {
  return {
    limit: Math.min(MESSAGE_PAGE_MAX, parseInt(req.query.limit, 10) || MESSAGE_PAGE_DEFAULT),
    before: req.query.before ? parseInt(req.query.before, 10) : null,
  };
}

app.get('/api/widget/conversations/:id/messages', async (req, res) => {
  try {
    const { store } = req.query;
    if (!store) return res.status(400).json({ error: 'store parameter required' });
    const storeRecord = await getCachedStore(store);
    if (!storeRecord || !storeRecord.is_active) return res.status(404).json({ error: 'Store not found or inactive' });

    const conversationId = parseInt(req.params.id, 10);
    const conversation = await db.getConversation(conversationId);
    if (!conversation) return res.status(404).json({ error: 'Conversation not found' });

    const convStoreId = conversation.shop_id ?? conversation.shopId ?? conversation.store_id ?? conversation.storeId;
    const convStoreIdentifier = conversation.shop_domain ?? conversation.shopDomain
      ?? conversation.store_identifier ?? conversation.storeIdentifier;
    const storeIdMatch = String(convStoreId) === String(storeRecord.id);
    const identifierMatch = convStoreIdentifier && (
      convStoreIdentifier === storeRecord.shop_domain ||
      convStoreIdentifier === storeRecord.store_identifier ||
      convStoreIdentifier === store);
    if (!storeIdMatch && !identifierMatch) {
      console.warn(`❌ [Widget History] Access denied: conv ${conversationId}`);
      return res.status(403).json({ error: 'Unauthorized' });
    }

    const messages = await db.getMessages(conversationId, messagePageOptions(req));
    const sanitized = messages.map(m => {
      const { sender_display_name, sender_employee_name, ...safe } = m;
      return snakeToCamel(safe);
    });
    res.json(sanitized);
  } catch (error) { console.error('❌ Widget message history error:', error.message); res.status(500).json({ error: 'Failed to fetch messages' }); }
});

app.get('/api/conversations/:id/messages', authenticateToken, async (req, res) => {
  try {
    const conversationId = parseInt(req.params.id, 10);
    const [messages] = await Promise.all([
      db.getMessages(conversationId, messagePageOptions(req)),
      db.markConversationRead(conversationId),
    ]);
    res.json(messages.map(snakeToCamel));
    setImmediate(async () => {
      try {
        const updated = await db.getConversation(conversationId);
        if (updated) debouncedReadBroadcast(conversationId, snakeToCamel(updated));
      } catch (e) { console.error('[messages broadcast] Error:', e.message); }
    });
  } catch (error) { console.error('Error fetching messages:', error.message); res.status(500).json({ error: error.message }); }
});

app.post('/api/messages', authenticateToken, async (req, res) => {
  try {
    const { conversationId, senderType, senderName, content, storeId, fileData, clientMsgId } = req.body;
    if (!conversationId || !senderType) return res.status(400).json({ error: 'Missing required fields' });
    if (!content && !fileData) return res.status(400).json({ error: 'Message must have text or a file attachment' });

    const timestamp = new Date();
    const tempId = `temp-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
    const tempMessage = {
      id: tempId, clientMsgId: clientMsgId || null, conversationId, storeId,
      senderType, senderName, content: content || '', fileData, createdAt: timestamp, pending: true,
    };
    sendToConversation(conversationId, { type: 'new_message', message: snakeToCamel(tempMessage) });
    broadcastToAgents({ type: 'new_message', message: snakeToCamel(tempMessage), conversationId, storeId });
    res.json(snakeToCamel(tempMessage));

    setImmediate(async () => {
      try {
        const savedMessage = await db.saveMessage({
          conversation_id: conversationId, store_id: storeId, sender_type: senderType,
          sender_name: senderName, sender_id: senderType === 'agent' ? req.user.id : null,
          content: content || '', file_data: fileData ? JSON.stringify(fileData) : null,
        });
        const confirmed = { ...snakeToCamel(savedMessage), clientMsgId: clientMsgId || null };
        const updatedConversation = await db.getConversation(conversationId);
        appCache.invalidatePrefix('convs:');
        sendToConversation(conversationId, {
          type: 'message_confirmed', tempId, clientMsgId: clientMsgId || null, message: confirmed,
        });
        broadcastToAgents({
          type: 'message_confirmed', tempId, clientMsgId: clientMsgId || null, message: confirmed,
          conversationId, storeId, conversation: snakeToCamel(updatedConversation),
        });
        if (senderType === 'agent') {
          handleOfflineEmailNotification(db.pool, savedMessage)
            .catch(err => console.error('[Offline Email] Failed:', err.message));
        }
      } catch (error) {
        console.error('Failed to save agent message:', error.message);
        sendToConversation(conversationId, { type: 'message_failed', tempId, clientMsgId: clientMsgId || null });
      }
    });
  } catch (error) { console.error('Send message error:', error.message); res.status(500).json({ error: error.message }); }
});

app.post('/api/widget/messages', async (req, res) => {
  try {
    const { conversationId, customerEmail, customerName, content, storeIdentifier, fileData } = req.body;
    if (!conversationId) return res.status(400).json({ error: 'Missing required fields' });
    if (!content && !fileData) return res.status(400).json({ error: 'Message must have text or a file attachment' });
    if (!customerEmail) return res.status(400).json({ error: 'customerEmail required' });

    const [store, conversation] = await Promise.all([
      getCachedStore(storeIdentifier),
      db.getConversation(conversationId),
    ]);
    if (!store) return res.status(404).json({ error: 'Store not found' });
    if (!conversation) {
      return res.status(404).json({ error: 'conversation_not_found', message: 'This conversation no longer exists' });
    }

    const blCheck = await db.pool.query(
      `SELECT id FROM blacklist
        WHERE email = $1 AND removed_at IS NULL
          AND (store_identifier IS NULL OR store_identifier = $2) LIMIT 1`,
      [customerEmail.toLowerCase().trim(), store.store_identifier]);
    if (blCheck.rowCount > 0) {
      console.log(`🚫 [Blacklist] Blocked message from ${customerEmail} on ${store.store_identifier}`);
      return res.status(403).json({ error: 'blocked', message: 'Unable to send messages at this time.' });
    }

    const timestamp = new Date();
    const tempId = `temp-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
    const tempMessage = {
      id: tempId, conversationId, storeId: store.id, senderType: 'customer',
      senderName: customerName || customerEmail, content: content || '',
      fileData, createdAt: timestamp, pending: true,
    };
    sendToConversation(conversationId, { type: 'new_message', message: snakeToCamel(tempMessage) });
    broadcastToAgents({ type: 'new_message', message: snakeToCamel(tempMessage), conversationId, storeId: store.id });
    res.json(snakeToCamel(tempMessage));

    setImmediate(async () => {
      try {
        const savedMessage = await db.saveMessage({
          conversation_id: conversationId, store_id: store.id, sender_type: 'customer',
          sender_name: customerName || customerEmail, content: content || '',
          file_data: fileData ? JSON.stringify(fileData) : null,
        });
        const updatedConversation = await db.getConversation(conversationId);
        const confirmedMessage = snakeToCamel(savedMessage);
        appCache.invalidatePrefix('convs:');
        sendToConversation(conversationId, { type: 'message_confirmed', tempId, message: confirmedMessage });
        broadcastToAgents({
          type: 'message_confirmed', tempId, message: confirmedMessage, conversationId,
          storeId: store.id, conversation: snakeToCamel(updatedConversation),
        });
        if (content) {
          const legalThreat = detectLegalThreat(content);
          if (legalThreat) {
            handleLegalThreat(legalThreat, conversationId, store.id, customerName || customerEmail, content, db.pool)
              .catch(err => console.error('[LEGAL FLAG] Text handler error:', err.message));
          }
        }
        if (fileData) {
          analyzeLegalAttachment(fileData, conversationId, store.id, customerName || customerEmail, db.pool)
            .catch(err => console.error('[LEGAL FLAG] Attachment handler error:', err.message));
        }
      } catch (error) {
        console.error('Failed to save message:', error.message);
        sendToConversation(conversationId, { type: 'message_failed', tempId, error: 'Failed to save message' });
      }
    });
  } catch (error) {
    console.error('Widget message error:', error.message);
    res.status(500).json({ error: 'Failed to send message', message: error.message });
  }
});

app.delete('/api/messages/:id', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin access required' });
    const messageId = parseInt(req.params.id, 10);
    if (Number.isNaN(messageId)) return res.status(400).json({ error: 'Invalid message ID' });
    const existing = await db.pool.query('SELECT id, conversation_id FROM messages WHERE id = $1', [messageId]);
    if (existing.rows.length === 0) return res.status(404).json({ error: 'Message not found' });
    const { conversation_id } = existing.rows[0];
    await db.pool.query('DELETE FROM messages WHERE id = $1', [messageId]);
    appCache.invalidatePrefix('convs:');
    console.log(`🗑️ [Messages] Admin ${req.user.email} deleted message ${messageId}`);
    broadcastToAgents({ type: 'message_deleted', messageId, conversationId: conversation_id });
    sendToConversation(conversation_id, { type: 'message_deleted', messageId, conversationId: conversation_id });
    res.json({ success: true, messageId });
  } catch (error) { console.error('❌ Delete message error:', error.message); res.status(500).json({ error: 'Failed to delete message' }); }
});

app.post('/api/widget/presence', async (req, res) => {
  try {
    const { conversationId, customerEmail, storeId, status, lastActivityAt } = req.body;
    if (!conversationId || !customerEmail) {
      return res.status(400).json({ error: 'conversationId and customerEmail required' });
    }
    const validStatuses = ['online', 'away', 'offline'];
    const safeStatus = validStatuses.includes(status) ? status : 'offline';
    await db.pool.query(`
      INSERT INTO customer_presence (conversation_id, customer_email, store_id, status,
                                     last_activity_at, last_heartbeat_at, ws_connected, updated_at)
      VALUES ($1,$2,$3,$4,$5,NOW(),FALSE,NOW())
      ON CONFLICT (conversation_id) DO UPDATE SET
        status = $4, last_activity_at = $5, last_heartbeat_at = NOW(), updated_at = NOW()
    `, [conversationId, customerEmail, storeId || null, safeStatus, lastActivityAt || new Date()]);
    if (safeStatus === 'online') cancelPendingEmail(conversationId);
    res.json({ ok: true });
  } catch (error) {
    if (error.code === '23503') {
      return res.status(410).json({ error: 'conversation_not_found', message: 'Conversation no longer exists' });
    }
    console.error('[Presence REST] Error:', error.message);
    res.status(500).json({ error: 'Failed to update presence' });
  }
});

// ============ BLACKLIST ============

app.post('/api/blacklist', authenticateToken, async (req, res) => {
  const { email, storeIdentifier, allStores = false, reason = null, customerName = null } = req.body;
  if (!email || typeof email !== 'string' || !email.includes('@')) {
    return res.status(400).json({ error: 'Valid email is required' });
  }
  const normalizedEmail = email.toLowerCase().trim();
  const normalizedStore = allStores ? null : (storeIdentifier || null);
  const blockedBy = req.user?.name || req.user?.email || null;
  try {
    const result = await db.pool.query(`
      INSERT INTO blacklist (email, store_identifier, reason, customer_name, blocked_by, created_at, removed_at)
      VALUES ($1,$2,$3,$4,$5,NOW(),NULL)
      ON CONFLICT (email, store_identifier) DO UPDATE SET
        reason = EXCLUDED.reason, customer_name = EXCLUDED.customer_name,
        blocked_by = EXCLUDED.blocked_by, created_at = NOW(), removed_at = NULL
      RETURNING *
    `, [normalizedEmail, normalizedStore, reason, customerName, blockedBy]);

    const convUpdate = allStores
      ? await db.pool.query(
          `UPDATE conversations SET status = 'blacklisted', updated_at = NOW()
            WHERE customer_email = $1 AND status NOT IN ('archived','blacklisted') RETURNING id`,
          [normalizedEmail])
      : await db.pool.query(
          `UPDATE conversations SET status = 'blacklisted', updated_at = NOW()
            WHERE customer_email = $1 AND status NOT IN ('archived','blacklisted')
              AND shop_domain = $2 RETURNING id`,
          [normalizedEmail, normalizedStore]);

    appCache.invalidatePrefix('convs:');
    convUpdate.rows.forEach(row =>
      broadcastToAgents({ type: 'conversation_blacklisted', conversationId: row.id, email: normalizedEmail }));
    console.log(`🚫 [Blacklist] ${normalizedEmail} blacklisted ${allStores ? 'network-wide' : `on ${normalizedStore}`} by ${blockedBy} — ${convUpdate.rowCount} conv(s)`);
    return res.status(201).json(snakeToCamel(result.rows[0]));
  } catch (err) { console.error('❌ [blacklist create] Error:', err.message); return res.status(500).json({ error: 'Failed to blacklist customer' }); }
});

app.get('/api/blacklist', authenticateToken, async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(200, parseInt(req.query.limit, 10) || 50);
  const offset = (page - 1) * limit;
  const storeIdentifier = req.query.storeIdentifier || null;
  const emailSearch = req.query.email || null;
  try {
    const params = [limit, offset];
    const filters = ['b.removed_at IS NULL'];
    if (storeIdentifier) {
      params.push(storeIdentifier);
      filters.push(`(b.store_identifier = $${params.length} OR b.store_identifier IS NULL)`);
    }
    if (emailSearch) {
      params.push(`%${emailSearch.toLowerCase()}%`);
      filters.push(`b.email ILIKE $${params.length}`);
    }
    const { rows } = await db.pool.query(
      `SELECT b.*, COUNT(*) OVER() AS total_count FROM blacklist b
        WHERE ${filters.join(' AND ')} ORDER BY b.created_at DESC LIMIT $1 OFFSET $2`, params);
    const total = rows.length ? parseInt(rows[0].total_count, 10) : 0;
    return res.json({
      entries: rows.map(r => { const row = { ...r }; delete row.total_count; return snakeToCamel(row); }),
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (err) { console.error('❌ [blacklist list] Error:', err.message); return res.status(500).json({ error: 'Failed to fetch blacklist' }); }
});

app.delete('/api/blacklist/:id', authenticateToken, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const lookup = await db.pool.query(
      `SELECT email, store_identifier FROM blacklist WHERE id = $1 AND removed_at IS NULL`, [id]);
    if (lookup.rowCount === 0) return res.status(404).json({ error: 'Blacklist entry not found or already removed' });
    const { email, store_identifier } = lookup.rows[0];
    const result = await db.pool.query(
      `UPDATE blacklist SET removed_at = NOW() WHERE id = $1 AND removed_at IS NULL RETURNING *`, [id]);
    const restored = store_identifier
      ? await db.pool.query(
          `UPDATE conversations SET status = 'open', updated_at = NOW()
            WHERE customer_email = $1 AND status = 'blacklisted' AND shop_domain = $2 RETURNING id`,
          [email, store_identifier])
      : await db.pool.query(
          `UPDATE conversations SET status = 'open', updated_at = NOW()
            WHERE customer_email = $1 AND status = 'blacklisted' RETURNING id`, [email]);
    appCache.invalidatePrefix('convs:');
    restored.rows.forEach(row =>
      broadcastToAgents({ type: 'conversation_unblacklisted', conversationId: row.id, email }));
    console.log(`✅ [Blacklist] Entry #${id} removed by ${req.user.email} — ${restored.rowCount} conversation(s) restored`);
    return res.json({ success: true, entry: snakeToCamel(result.rows[0]), restoredConversations: restored.rowCount });
  } catch (err) { console.error('❌ [blacklist delete] Error:', err.message); return res.status(500).json({ error: 'Failed to remove blacklist entry' }); }
});

app.get('/api/blacklist/check', authenticateToken, async (req, res) => {
  const { email, storeIdentifier } = req.query;
  if (!email) return res.status(400).json({ error: 'email query param is required' });
  try {
    const { rows } = await db.pool.query(
      `SELECT * FROM blacklist WHERE email = $1 AND removed_at IS NULL
        AND (store_identifier IS NULL OR store_identifier = $2) LIMIT 1`,
      [email.toLowerCase().trim(), storeIdentifier || null]);
    if (rows.length) return res.json({ blocked: true, entry: snakeToCamel(rows[0]) });
    return res.json({ blocked: false, entry: null });
  } catch (err) { console.error('❌ [blacklist check] Error:', err.message); return res.status(500).json({ error: 'Failed to check blacklist' }); }
});

// ============ EMPLOYEE ENDPOINTS ============

app.get('/api/employees', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin access required' });
    const cached = appCache.get('employees:list');
    if (cached) return res.json(cached);

    const [employees, statsById, responsesByAgent] = await Promise.all([
      db.getAllEmployees(),
      db.getAgentResponseStats(),
      db.getAgentCustomerResponseStats(),
    ]);

    const enriched = employees.map(emp => {
      const { password_hash, api_token, ...safe } = emp;
      return {
        ...snakeToCamel(safe),
        ...(statsById[String(emp.id)] || { avgResponseMinutes: null, fastestMinutes: null, totalResponsesCounted: 0 }),
        responsesByCustomer: responsesByAgent[String(emp.id)] || [],
      };
    });

    appCache.set('employees:list', enriched, 60 * 1000);
    res.json(enriched);
  } catch (error) { console.error('Get employees error:', error.message); res.status(500).json({ error: 'Failed to fetch employees' }); }
});

app.post('/api/employees', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin access required' });
    const { email, name, employeeName, role, password, canViewAllStores, isActive } = req.body;
    if (!email || !name || !password) return res.status(400).json({ error: 'Email, name, and password are required' });
    const password_hash = await hashPassword(password);
    const employee = await db.createEmployee({
      email, name, employee_name: employeeName || null, role: role || 'agent', password_hash,
      can_view_all_stores: canViewAllStores !== undefined ? canViewAllStores : true,
      is_active: isActive !== undefined ? isActive : true, assigned_stores: [],
    });
    appCache.invalidate('employees:list');
    delete employee.password_hash; delete employee.api_token;
    res.json(snakeToCamel(employee));
  } catch (error) { console.error('Create employee error:', error.message); res.status(500).json({ error: error.message }); }
});

app.put('/api/employees/:id', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin access required' });
    const employeeId = parseInt(req.params.id, 10);
    const updates = req.body;
    const dbUpdates = {};
    if (updates.name !== undefined) dbUpdates.name = updates.name;
    if (updates.employeeName !== undefined) dbUpdates.employee_name = updates.employeeName;
    if (updates.email !== undefined) dbUpdates.email = updates.email;
    if (updates.role !== undefined) dbUpdates.role = updates.role;
    if (updates.isActive !== undefined) dbUpdates.is_active = updates.isActive;
    if (updates.canViewAllStores !== undefined) dbUpdates.can_view_all_stores = updates.canViewAllStores;
    if (updates.assignedStores !== undefined) dbUpdates.assigned_stores = updates.assignedStores;
    if (updates.password) dbUpdates.password_hash = await hashPassword(updates.password);
    const employee = await db.updateEmployee(employeeId, dbUpdates);
    appCache.invalidate('employees:list');
    appCache.invalidatePrefix('auth:');
    if (employee) { delete employee.password_hash; delete employee.api_token; }
    res.json(snakeToCamel(employee));
  } catch (error) { console.error('Update employee error:', error.message); res.status(500).json({ error: 'Failed to update employee' }); }
});

app.delete('/api/employees/:id', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin access required' });
    const employeeId = parseInt(req.params.id, 10);
    if (employeeId === req.user.id) return res.status(400).json({ error: 'Cannot delete your own account' });
    await db.deleteEmployee(employeeId);
    appCache.invalidate('employees:list');
    appCache.invalidatePrefix('auth:');
    res.json({ success: true, message: 'Employee deleted' });
  } catch (error) { console.error('Delete employee error:', error.message); res.status(500).json({ error: 'Failed to delete employee' }); }
});

app.put('/api/employees/:id/status', authenticateToken, async (req, res) => {
  try {
    await db.updateEmployeeStatus(parseInt(req.params.id, 10), req.body.status);
    appCache.invalidate('employees:list');
    res.json({ success: true });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

app.patch('/api/employees/:id/notes-order', authenticateToken, async (req, res) => {
  try {
    const employeeId = parseInt(req.params.id, 10);
    const { order } = req.body;
    if (req.user.id !== employeeId && req.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
    if (!Array.isArray(order)) return res.status(400).json({ error: 'order must be an array of note IDs' });
    await db.updateEmployeeNotesOrder(employeeId, order);
    res.json({ success: true });
  } catch (error) { console.error('Error saving notes order:', error.message); res.status(500).json({ error: 'Failed to save notes order' }); }
});

// ============ TEMPLATE ENDPOINTS ============

app.get('/api/templates', authenticateToken, async (req, res) => {
  try {
    const cacheKey = `templates:${req.user.id}`;
    const cached = appCache.get(cacheKey);
    if (cached) return res.json(cached);
    const templates = await db.getTemplatesByUserId(req.user.id);
    const result = templates.map(snakeToCamel);
    appCache.set(cacheKey, result);
    res.json(result);
  } catch (error) { console.error('Get templates error:', error.message); res.status(500).json({ error: 'Failed to fetch templates' }); }
});

app.post('/api/templates', authenticateToken, async (req, res) => {
  try {
    const { name, content } = req.body;
    if (!name || !content) return res.status(400).json({ error: 'Name and content are required' });
    if (name.length > 255) return res.status(400).json({ error: 'Template name is too long (max 255 characters)' });
    const template = await db.createTemplate({ user_id: req.user.id, name: name.trim(), content: content.trim() });
    appCache.invalidate(`templates:${req.user.id}`);
    res.status(201).json(snakeToCamel(template));
  } catch (error) { console.error('Create template error:', error.message); res.status(500).json({ error: 'Failed to create template' }); }
});

app.put('/api/templates/:id', authenticateToken, async (req, res) => {
  try {
    const templateId = parseInt(req.params.id, 10);
    const { name, content } = req.body;
    if (!name || !content) return res.status(400).json({ error: 'Name and content are required' });
    if (name.length > 255) return res.status(400).json({ error: 'Template name is too long (max 255 characters)' });
    const existing = await db.getTemplateById(templateId);
    if (!existing) return res.status(404).json({ error: 'Template not found' });
    if (existing.user_id !== req.user.id) return res.status(403).json({ error: 'Not authorized to update this template' });
    const template = await db.updateTemplate(templateId, { name: name.trim(), content: content.trim() });
    appCache.invalidate(`templates:${req.user.id}`);
    res.json(snakeToCamel(template));
  } catch (error) { console.error('Update template error:', error.message); res.status(500).json({ error: 'Failed to update template' }); }
});

app.delete('/api/templates/:id', authenticateToken, async (req, res) => {
  try {
    const templateId = parseInt(req.params.id, 10);
    const existing = await db.getTemplateById(templateId);
    if (!existing) return res.status(404).json({ error: 'Template not found' });
    if (existing.user_id !== req.user.id) return res.status(403).json({ error: 'Not authorized to delete this template' });
    await db.deleteTemplate(templateId);
    appCache.invalidate(`templates:${req.user.id}`);
    res.json({ success: true, message: 'Template deleted successfully' });
  } catch (error) { console.error('Delete template error:', error.message); res.status(500).json({ error: 'Failed to delete template' }); }
});

// ============ STATS ENDPOINTS ============

app.get('/api/stats/dashboard', authenticateToken, async (req, res) => {
  try {
    const cacheKey = `stats:dashboard:${JSON.stringify(req.query)}`;
    const cached = appCache.get(cacheKey);
    if (cached) return res.json(cached);
    const stats = await db.getDashboardStats(req.query);
    appCache.set(cacheKey, stats, TTL.STATS);
    res.json(stats);
  } catch (error) { res.status(500).json({ error: error.message }); }
});

app.get('/api/stats/websocket', authenticateToken, (req, res) => {
  try { res.json(getWebSocketStats()); }
  catch (error) { res.status(500).json({ error: error.message }); }
});

app.post('/api/stats/discord-report/trigger', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin access required' });
    if (!process.env.DISCORD_STATS_WEBHOOK) return res.status(400).json({ error: 'DISCORD_STATS_WEBHOOK not configured' });
    const now = Date.now();
    if (now - lastHourlyReportAt < REPORT_COOLDOWN) {
      return res.status(429).json({ error: 'Report triggered less than 1 minute ago. Please wait.' });
    }
    lastHourlyReportAt = now;
    sendHourlyResponseTimeStats().catch(err => console.error('📊 [Discord Stats] Manual trigger failed:', err.message));
    res.json({ ok: true, message: 'Discord report triggered — check the channel in a few seconds' });
  } catch (err) { console.error('📊 [Discord Stats] Trigger error:', err.message); res.status(500).json({ error: 'Failed to trigger report' }); }
});

app.post('/api/stats/discord-daily-report/trigger', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin access required' });
    if (!process.env.DISCORD_DAILY_WEBHOOK) return res.status(400).json({ error: 'DISCORD_DAILY_WEBHOOK not configured' });
    const now = Date.now();
    if (now - lastDailyReportAt < REPORT_COOLDOWN) {
      return res.status(429).json({ error: 'Report triggered less than 1 minute ago. Please wait.' });
    }
    lastDailyReportAt = now;
    sendDailyActivityStats().catch(err => console.error('📊 [Discord Daily] Manual trigger failed:', err.message));
    res.json({ ok: true, message: 'Daily Discord report triggered — check the channel in a few seconds' });
  } catch (err) { console.error('📊 [Discord Daily] Trigger error:', err.message); res.status(500).json({ error: 'Failed to trigger report' }); }
});

// Admin: force a rollup refresh without waiting for the hourly tick.
app.post('/api/stats/response-times/refresh', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin access required' });
    res.json({ ok: true, message: 'Rollup refresh started — check server logs' });
    db.refreshResponseStats()
      .then(() => appCache.invalidate('employees:list'))
      .catch(e => console.error('📊 [Stats] Manual refresh failed:', e.message));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/stats/response-times/team', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin access required' });
    const cached = appCache.get('stats:response-times:team');
    if (cached) return res.json(cached);
    const windowDays = Number(process.env.STATS_WINDOW_DAYS || 21);
    const { rows } = await db.pool.query(`
      WITH real_messages AS (
        SELECT conversation_id, sender_type, sent_at,
          LAG(sender_type) OVER (PARTITION BY conversation_id ORDER BY sent_at) AS prev_sender_type,
          LAG(sent_at)     OVER (PARTITION BY conversation_id ORDER BY sent_at) AS prev_sent_at
        FROM messages
        WHERE sender_type IN ('customer','agent')
          AND NOT (sender_type = 'agent' AND sender_id IS NULL)
          AND sent_at >= NOW() - ($1 || ' days')::interval
      ),
      rt AS (
        SELECT EXTRACT(EPOCH FROM (sent_at - prev_sent_at)) / 60.0 AS minutes
        FROM real_messages
        WHERE sender_type = 'agent' AND prev_sender_type = 'customer' AND prev_sent_at IS NOT NULL
          AND EXTRACT(EPOCH FROM (sent_at - prev_sent_at)) / 60.0 BETWEEN 0 AND 240
      )
      SELECT ROUND(AVG(minutes)::numeric,1) AS avg_minutes,
             ROUND(MIN(minutes)::numeric,1) AS fastest_minutes,
             ROUND((PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY minutes))::numeric,1) AS median_minutes,
             COUNT(*)::int AS total_responses,
             COUNT(*) FILTER (WHERE minutes <= 5)::int  AS under_5_min,
             COUNT(*) FILTER (WHERE minutes <= 30)::int AS under_30_min,
             COUNT(*) FILTER (WHERE minutes > 60)::int  AS over_1_hour
        FROM rt
    `, [windowDays]);
    const r = rows[0] || {};
    const result = {
      avgMinutes: r.avg_minutes !== null ? parseFloat(r.avg_minutes) : null,
      medianMinutes: r.median_minutes !== null ? parseFloat(r.median_minutes) : null,
      fastestMinutes: r.fastest_minutes !== null ? parseFloat(r.fastest_minutes) : null,
      totalResponses: r.total_responses || 0,
      under5Min: r.under_5_min || 0, under30Min: r.under_30_min || 0, over1Hour: r.over_1_hour || 0,
      windowDays,
    };
    appCache.set('stats:response-times:team', result, TTL.STATS_TEAM);
    res.json(result);
  } catch (error) { console.error('Team response stats error:', error.message); res.status(500).json({ error: 'Failed to fetch team response stats' }); }
});

app.get('/api/conversations/:id/response-stats', authenticateToken, async (req, res) => {
  try {
    const conversationId = parseInt(req.params.id, 10);
    const cacheKey = `stats:conv:${conversationId}`;
    const cached = appCache.get(cacheKey);
    if (cached) return res.json(cached);
    const { rows } = await db.pool.query(`
      WITH real_messages AS (
        SELECT sender_type, sender_name, sent_at,
          LAG(sender_type) OVER (ORDER BY sent_at) AS prev_sender_type,
          LAG(sent_at)     OVER (ORDER BY sent_at) AS prev_sent_at
        FROM messages
        WHERE conversation_id = $1
          AND sender_type IN ('customer','agent')
          AND NOT (sender_type = 'agent' AND sender_id IS NULL)
      )
      SELECT sender_name, EXTRACT(EPOCH FROM (sent_at - prev_sent_at)) / 60.0 AS minutes, sent_at
        FROM real_messages
       WHERE sender_type = 'agent' AND prev_sender_type = 'customer' AND prev_sent_at IS NOT NULL
         AND EXTRACT(EPOCH FROM (sent_at - prev_sent_at)) / 60.0 BETWEEN 0 AND 240
       ORDER BY sent_at ASC
    `, [conversationId]);
    const responses = rows.map(r => ({ senderName: r.sender_name, minutes: parseFloat(r.minutes), at: r.sent_at }));
    const avg = responses.length ? responses.reduce((s, r) => s + r.minutes, 0) / responses.length : null;
    const result = {
      conversationId,
      avgResponseMinutes: avg !== null ? Math.round(avg * 10) / 10 : null,
      totalResponses: responses.length, responses,
    };
    appCache.set(cacheKey, result, TTL.STATS_CONV);
    res.json(result);
  } catch (error) { console.error('Conversation response stats error:', error.message); res.status(500).json({ error: 'Failed to fetch conversation response stats' }); }
});

// ============ ERROR HANDLER ============

app.use((err, req, res, next) => {
  console.error('SERVER ERROR:', err.message);
  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined,
  });
});

// ============ KEEP-ALIVE ============

function setupKeepAlive() {
  if (process.env.KEEP_ALIVE === 'false') { console.log('⏰ Keep-alive disabled'); return; }
  const APP_URL = process.env.APP_URL || `http://localhost:${process.env.PORT || 3000}`;
  const httpModule = APP_URL.startsWith('https') ? require('https') : http;
  console.log('⏰ Keep-alive enabled — pinging /health every 5 minutes');
  every(5 * 60 * 1000, () => {
    const now = new Date().toISOString();
    // /health is DB-free, so keep-alive can never itself trip a DB timeout.
    httpModule.get(`${APP_URL}/health`, (res) => {
      res.resume();
      res.on('end', () => {
        if (res.statusCode !== 200) console.warn(`⏰ Keep-alive FAILED ${res.statusCode} [${now}]`);
      });
    }).on('error', err => console.error(`❌ Keep-alive error [${now}]:`, err.message));
  }, 'keep-alive');
}

// ============ BACKGROUND JOBS ============
// Every job below:
//   • holds a Postgres advisory lock, so only ONE instance runs it
//   • uses ONE dedicated connection and runs its queries sequentially on it
// This is the fix for the pool exhaustion that produced
// "Connection terminated due to connection timeout" in the presence cleanup.

const redisManager = require('./redis-manager');

const jobRunning = new Set();

// TTL must be slightly SHORTER than the job interval, or ticks get skipped.
const JOB_LOCK_TTL = {
  'presence-cleanup': 150,   // interval  180s
  'auto-reply':        50,   // interval   60s
  'discord-hourly':  3300,   // interval 3600s
  'discord-daily':  82800,   // interval 86400s
  'brain-prune':    82800,   // interval 86400s
};

async function acquireJobLock(name) {
  const ttl = JOB_LOCK_TTL[name] || 50;
  try {
    // NX = only if absent, EX = always with a TTL. Never explicitly released:
    // expiry IS the release, so a crashed instance cannot strand it.
    const ok = await redisManager.client.set(`joblock:${name}`, String(process.pid), 'EX', ttl, 'NX');
    return ok === 'OK';
  } catch (e) {
    // Redis unreachable: fall back to the in-process guard. Duplicate work is
    // better than jobs silently never running.
    console.warn(`[${name}] lock unavailable (${e.message}) — proceeding unlocked`);
    return true;
  }
}

async function runJob(name, _lockId, fn) {
  if (jobRunning.has(name)) return;              // no overlapping ticks in-process
  if (db.pool.waitingCount > 0) {                // pool saturated — retry next tick
    console.warn(`[${name}] pool saturated (waiting=${db.pool.waitingCount}) — skipping tick`);
    return;
  }
  if (!(await acquireJobLock(name))) return;     // another instance owns this window

  jobRunning.add(name);
  // Only check out a connection for jobs that take one. The Discord reporters
  // are zero-arity and do their own pool.query + a 15s HTTP call — no reason to
  // pin a connection across that.
  const needsClient = fn.length > 0;
  const client = needsClient ? await db.pool.connect().catch(() => null) : null;
  if (needsClient && !client) { jobRunning.delete(name); return; }
  try {
    await fn(client);
  } catch (err) {
    console.warn(`[${name}] skipped:`, err.message);   // a skipped tick is not an incident
  } finally {
    if (client) client.release();
    jobRunning.delete(name);
  }
}

// ── Presence stale cleanup ──
async function cleanupStalePresence(client) {
  const result = await client.query(`
    UPDATE customer_presence
       SET status = 'offline', ws_connected = FALSE, updated_at = NOW()
     WHERE status != 'offline'
       AND last_heartbeat_at < NOW() - INTERVAL '3 minutes'
     RETURNING conversation_id
  `);
  if (result.rowCount > 0) console.log(`[Presence] Marked ${result.rowCount} stale sessions offline`);
}

// ── Auto-reply (9-minute no-response rule) ──
const AUTO_REPLY_TEXT = 'Thanks for reaching out! We\u2019re available 24/7 and will get back to you as soon as possible. We\u2019re always here and ready to help!';
const AUTO_REPLY_BATCH = Number(process.env.AUTO_REPLY_BATCH || 10);

async function runAutoReply(client) {
  const { rows } = await client.query(`
    WITH last_msgs AS (
      SELECT conversation_id,
             MAX(sent_at)                                          AS last_sent_at,
             MAX(sent_at) FILTER (WHERE sender_type != 'customer')  AS last_agent_at
        FROM messages
       WHERE sent_at >= NOW() - INTERVAL '24 hours'
       GROUP BY conversation_id
    )
    SELECT c.id, c.shop_id
      FROM conversations c
      JOIN last_msgs lm ON lm.conversation_id = c.id
     WHERE c.status = 'open'
       AND (c.auto_replied_at IS NULL OR c.auto_replied_at < NOW() - INTERVAL '8 hours')
       AND lm.last_sent_at < NOW() - INTERVAL '9 minutes'
       AND lm.last_agent_at IS NULL
     LIMIT $1
  `, [AUTO_REPLY_BATCH]);

  if (!rows.length) return;

  // Sequential on the single lock connection. The previous version fanned all
  // 20 rows out in parallel with 3 queries each — up to 60 concurrent pool
  // checkouts per tick, which starved every other query including this job's
  // siblings.
  for (const conv of rows) {
    try {
      const insertResult = await client.query(`
        INSERT INTO messages (conversation_id, shop_id, sender_type, sender_name, content,
                              message_type, file_data, sent_at, timestamp)
        SELECT $1, $2, 'agent', 'Support', $3, 'text', NULL, NOW(), NOW()
         WHERE NOT EXISTS (
           SELECT 1 FROM messages
            WHERE conversation_id = $1 AND sender_type != 'customer'
              AND sent_at > (SELECT MAX(sent_at) FROM messages
                              WHERE conversation_id = $1 AND sender_type = 'customer')
         )
        RETURNING *
      `, [conv.id, conv.shop_id, AUTO_REPLY_TEXT]);

      if (insertResult.rows.length === 0) {
        console.log(`🤖 [Auto-reply] Skipped conv #${conv.id} — team replied in the meantime`);
        continue;
      }
      const saved = insertResult.rows[0];

      await client.query(`
        UPDATE conversations
           SET auto_replied_at = NOW(),
               last_message = (SELECT content FROM messages
                                WHERE conversation_id = $1 AND sender_type = 'customer'
                                ORDER BY sent_at DESC LIMIT 1),
               last_message_sender_type = 'customer'
         WHERE id = $1
      `, [conv.id]);

      const correctedConv = await client.query(`
        SELECT c.*, (SELECT content FROM messages
                      WHERE conversation_id = c.id AND sender_type = 'customer'
                      ORDER BY sent_at DESC LIMIT 1) AS last_customer_message
          FROM conversations c WHERE c.id = $1
      `, [conv.id]);

      const msg = { ...snakeToCamel(saved), isAutoReply: true };
      sendToConversation(conv.id, { type: 'new_message', message: msg });
      broadcastToAgents({ type: 'new_message', message: msg, conversationId: conv.id, storeId: conv.shop_id });

      if (correctedConv.rows.length > 0) {
        const convData = snakeToCamel(correctedConv.rows[0]);
        broadcastToAgents({
          type: 'conversation_updated', conversationId: conv.id,
          conversation: {
            ...convData,
            lastMessage: convData.lastCustomerMessage || convData.lastMessage,
            lastMessageSenderType: 'customer', lastSenderType: 'customer',
          },
        });
      }
      console.log(`🤖 [Auto-reply] Sent to conv #${conv.id}`);
    } catch (err) { console.error(`🤖 [Auto-reply] Failed for conv #${conv.id}:`, err.message); }
  }
  appCache.invalidatePrefix('convs:');
}

// ── AI brain backup pruning ──
async function pruneOldBackups(client) {
  const result = await client.query(
    `DELETE FROM ai_training_brain_backups
      WHERE backed_up_at < NOW() - INTERVAL '30 days' RETURNING id`);
  if (result.rowCount > 0) console.log(`🧹 [Brain Backups] Pruned ${result.rowCount} backup(s) older than 30 days`);
}

// ============ SCHEDULERS ============

function scheduleNextHourlyReport() {
  const now = new Date();
  const nextHour = new Date(now);
  nextHour.setHours(now.getHours() + 1, 0, 5, 0);
  const ms = nextHour - now;
  console.log(`📊 [Discord Stats] Next hourly report in ${Math.round(ms / 60000)}m`);
  const t = setTimeout(async () => {
    await runJob('discord-hourly', db.LOCKS.DISCORD_HOURLY, async () => {
      await sendHourlyResponseTimeStats();
    });
    scheduleNextHourlyReport();
  }, ms);
  timers.push({ t, label: 'discord-hourly', isTimeout: true });
}

function scheduleNextDailyReport() {
  const REPORT_HOUR = parseInt(process.env.DISCORD_DAILY_REPORT_HOUR || '9', 10);
  const now = new Date();
  const next = new Date(now);
  next.setHours(REPORT_HOUR, 0, 5, 0);
  if (next <= now) next.setDate(next.getDate() + 1);
  const ms = next - now;
  console.log(`📊 [Discord Daily] Next daily report in ${Math.round(ms / 3600000)}h`);
  const t = setTimeout(async () => {
    await runJob('discord-daily', db.LOCKS.DISCORD_DAILY, async () => {
      await sendDailyActivityStats();
    });
    scheduleNextDailyReport();
  }, ms);
  timers.push({ t, label: 'discord-daily', isTimeout: true });
}

function startBackgroundJobs() {
  // Presence cleanup — every 3 minutes (matches the 3-minute stale threshold).
  every(3 * 60 * 1000,
    () => runJob('presence-cleanup', db.LOCKS.PRESENCE_CLEANUP, cleanupStalePresence),
    'presence-cleanup');

  // Auto-reply sweeper — every minute.
  every(60 * 1000,
    () => runJob('auto-reply', db.LOCKS.AUTO_REPLY, runAutoReply),
    'auto-reply');

  // Response-stats rollup — hourly, on the maintenance pool (no 15s cap).
  // Was every 10 minutes and always dying at the statement timeout.
  setTimeout(() => {
    db.refreshResponseStats()
      .then(() => appCache.invalidate('employees:list'))
      .catch(e => console.error('📊 [Stats] initial refresh:', e.message));
  }, 60 * 1000);
  every(60 * 60 * 1000, () => {
    db.refreshResponseStats()
      .then(() => appCache.invalidate('employees:list'))
      .catch(e => console.error('📊 [Stats] interval refresh:', e.message));
  }, 'response-stats');

  // Brain backup pruning — daily.
  setTimeout(() => runJob('brain-prune', db.LOCKS.BRAIN_PRUNE, pruneOldBackups), 5 * 60 * 1000);
  every(24 * 60 * 60 * 1000,
    () => runJob('brain-prune', db.LOCKS.BRAIN_PRUNE, pruneOldBackups),
    'brain-prune');

  // Discord reports.
  if (process.env.NODE_ENV === 'production') {
    setTimeout(() => {
      runJob('discord-hourly', db.LOCKS.DISCORD_HOURLY, () => sendHourlyResponseTimeStats());
    }, 5 * 60 * 1000);
  } else {
    console.log('📊 [Discord Stats] Skipping startup report (dev mode)');
  }
  scheduleNextHourlyReport();
  scheduleNextDailyReport();

    if (process.env.DB_WARM_PING !== 'false') {
    every(4 * 60 * 1000, () => {
      db.pool.query('SELECT 1')
        .catch(e => console.warn('[db-warm] ping failed:', e.message));
    }, 'db-warm');
  }

  // Pool telemetry. Set PG_POOL_LOG=true when diagnosing timeouts: if `waiting`
  // spikes on the minute boundary, a background job is still starving the pool.
  if (process.env.PG_POOL_LOG === 'true') {
    every(30 * 1000, () => {
      const s = db.getPoolStats();
      console.log(`[pg] total=${s.total} idle=${s.idle} waiting=${s.waiting} max=${s.max} cache=${appCache.size}`);
    }, 'pool-log');
  }
}

// ============ START SERVER ============

const PORT = process.env.PORT || 3000;

async function startServer() {
  try {
    // Retries a cold/suspended DB rather than exiting on the first miss.
    await db.waitForDatabase(5);

    // Migrations are ledgered and lock-guarded — safe to call on every boot,
    // and a no-op after the first successful run.
    await db.initDatabase();
    console.log('✅ Database tables initialized');
    await db.runMigrations();
    console.log('✅ Database migrations completed\n');

    // Warn (don't block) if the trigram search indexes are missing — without
    // them /api/conversations/search sequentially scans `messages`.
    db.checkSearchIndexes()
      .then(rows => {
        const valid = rows.filter(r => r.valid).map(r => r.index_name);
        if (valid.length < 3) {
          console.warn(`⚠️  Search indexes missing or invalid (${valid.length}/3 valid).`);
          console.warn('   Run once: node scripts/build-search-indexes.js');
        } else {
          console.log('✅ Search indexes present and valid');
        }
      })
      .catch(() => {});

    server.listen(PORT, () => {
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('🚀 MULTI-STORE CHAT SERVER READY');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log(`📍 Server: http://localhost:${PORT}`);
      console.log(`🔌 WebSocket: ws://localhost:${PORT}/ws`);
      console.log(`🗄️  Pool max: ${db.getPoolStats().max}`);
      console.log(`✦  AI Suggestions: ${process.env.ANTHROPIC_API_KEY ? 'Enabled (Claude)' : 'Fallback mode (no API key)'}`);
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

      setupKeepAlive();
      // startEmailSweep(db.pool);
            if (process.env.NODE_ENV === 'production' || process.env.EMAIL_SWEEP === 'true') {
        startEmailSweep(db.pool);
      } else {
        console.log('📧 [Email Sweep] Disabled in dev (set EMAIL_SWEEP=true to enable)');
      }
      startBackgroundJobs();
    });
  } catch (error) {
    console.error('❌ FATAL: Failed to start server:', error.message);
    process.exit(1);
  }
}

// ============ GRACEFUL SHUTDOWN ============

let shuttingDown = false;

async function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`\n🛑 ${signal} received — shutting down gracefully`);

  // Stop new scheduled work first so nothing starts mid-drain.
  for (const { t, isTimeout } of timers) {
    if (isTimeout) clearTimeout(t); else clearInterval(t);
  }
  for (const t of readBroadcastTimers.values()) clearTimeout(t);
  readBroadcastTimers.clear();

  try { stopEmailSweep?.(); } catch (e) { /* optional */ }

  // Backstop in case any step below hangs.
  const forceExit = setTimeout(() => {
    console.error('⚠️  Forced exit after 15s');
    process.exit(1);
  }, 15_000);

  // Order matters: sockets flush buffered presence (needs the DB) and fire
  // close handlers that touch Redis, so both must still be alive here.
  try { await closeAll(); } catch (e) { console.warn('WS close:', e.message); }
  try { await redisManager.disconnect(); } catch (e) { console.warn('Redis disconnect:', e.message); }

  server.close(async () => {
    try { await db.closePool(); console.log('✅ Pool drained'); }
    catch (e) { console.error('Pool drain error:', e.message); }
    clearTimeout(forceExit);
    process.exit(0);
  });
}


process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
process.once('SIGUSR2', () => shutdown('SIGUSR2'));
process.on('unhandledRejection', (reason) => {
  console.error('UNHANDLED REJECTION:', reason?.message || reason);
});
process.on('uncaughtException', (err) => {
  console.error('UNCAUGHT EXCEPTION:', err.message, err.stack);
  shutdown('uncaughtException');
});

startServer();

module.exports = { app, server };