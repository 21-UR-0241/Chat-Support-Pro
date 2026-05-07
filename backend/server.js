


// module.exports = { app, server };
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const http = require('http');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const db = require('./database');
const shopify = require('./shopify-api');
const { rawBodyMiddleware, handleWebhook } = require('./webhooks');
const { getAuthUrl, handleCallback } = require('./shopify-auth');
const { initWebSocketServer, sendToConversation, broadcastToAgents, getWebSocketStats } = require('./websocket-server');
const { hashPassword, verifyPassword, generateToken, authenticateToken } = require('./auth');
const session = require('express-session');
const shopifyAppRoutes = require('./routes/shopify-app-routes');
const fileRoutes = require('./routes/fileroutes');
const { handleOfflineEmailNotification, cancelPendingEmail, startEmailSweep, stopEmailSweep } = require('../frontend/src/admin/services/emailService');
const aiTrainingRoutes = require('./routes/ai-training-routes');
const { getBrainContext, refreshBrainCache, getBrainSettings } = require('./brain-context');

const app = express();
const server = http.createServer(app);

app.set('trust proxy', 1);

app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
  res.header('Access-Control-Allow-Credentials', 'true');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

console.log('🔌 Initializing WebSocket server...');
initWebSocketServer(server);
console.log('✅ WebSocket server initialized\n');
console.log('\n🚀 Multi-Store Chat Server Starting...\n');

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
    const snakeKey = key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
    snakeObj[snakeKey] = value;
  }
  return snakeObj;
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
  const matched = LEGAL_THREAT_PATTERNS.some(p => p.test(content));
  if (!matched) return null;
  for (const [severity, patterns] of Object.entries(LEGAL_SEVERITY_MAP)) {
    for (const pattern of patterns) {
      const match = content.match(pattern);
      if (match) {
        return { detected: true, severity, matchedTerm: match[0],
          snippet: content.length > 200 ? content.substring(0, 200) + '...' : content };
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
  console.log(`${emoji} [LEGAL FLAG] Severity: ${threat.severity.toUpperCase()} | Conv: ${conversationId} | Term: "${threat.matchedTerm}" | From: ${senderName}`);
  try {
    await pool.query(`
      UPDATE conversations SET priority = 'urgent',
        tags = CASE WHEN tags IS NULL THEN ARRAY['legal-flag'] WHEN NOT ('legal-flag' = ANY(tags)) THEN array_append(tags, 'legal-flag') ELSE tags END,
        legal_flag = TRUE, legal_flag_severity = $1, legal_flag_at = NOW(), legal_flag_term = $2, updated_at = NOW()
      WHERE id = $3
    `, [threat.severity, threat.matchedTerm, conversationId]);
  } catch (dbErr) {
    console.warn('[LEGAL FLAG] Extended columns not found, fallback:', dbErr.message);
    try { await pool.query(`UPDATE conversations SET priority = 'urgent', updated_at = NOW() WHERE id = $1`, [conversationId]); }
    catch (fallbackErr) { console.error('[LEGAL FLAG] Fallback DB update failed:', fallbackErr.message); }
  }
  broadcastToAgents({ type: 'legal_threat_detected', alert: {
    conversationId, storeId, severity: threat.severity, matchedTerm: threat.matchedTerm,
    senderName, snippet: threat.snippet, timestamp: new Date().toISOString(), emoji,
    fromAttachment: threat.fromAttachment || false, documentType: threat.documentType || null,
    message: `${emoji} LEGAL THREAT DETECTED (${threat.severity.toUpperCase()}): "${threat.matchedTerm}" — from ${senderName}`,
  }});
  sendLegalFlagEmail(threat, conversationId, senderName, messageContent, pool).catch(err =>
    console.error('[LEGAL FLAG] Email notification failed:', err.message));
}

async function sendLegalFlagEmail(threat, conversationId, senderName, messageContent, pool) {
  const RESEND_API_KEY = process.env.RESEND_API_KEY;
  const ALERT_EMAIL = process.env.LEGAL_ALERT_EMAIL || process.env.ADMIN_EMAIL;
  if (!RESEND_API_KEY || !ALERT_EMAIL) { console.warn('[LEGAL FLAG] No RESEND_API_KEY or LEGAL_ALERT_EMAIL — skipping'); return; }
  const severity = threat.severity.toUpperCase();
  const emoji = threat.severity === 'critical' ? '🚨' : threat.severity === 'high' ? '⚠️' : '🔔';
  const appUrl = process.env.APP_URL || 'https://your-app.com';
  const sourceLabel = threat.fromAttachment ? `Uploaded Document (${threat.documentType || 'file'})` : 'Chat Message';
  const html = `<div style="font-family:sans-serif;max-width:600px;margin:0 auto">
    <div style="background:${threat.severity==='critical'?'#dc2626':threat.severity==='high'?'#d97706':'#2563eb'};color:white;padding:16px 24px;border-radius:8px 8px 0 0">
      <h1 style="margin:0;font-size:20px">${emoji} Legal Threat Detected — ${severity}</h1></div>
    <div style="background:#f9fafb;border:1px solid #e5e7eb;border-top:none;padding:24px;border-radius:0 0 8px 8px">
      <p><strong>Severity:</strong> ${severity}</p><p><strong>Matched Term:</strong> "${threat.matchedTerm}"</p>
      <p><strong>Source:</strong> ${sourceLabel}</p><p><strong>From:</strong> ${senderName}</p>
      <p><strong>Conversation:</strong> #${conversationId}</p>
      <p><strong>Time:</strong> ${new Date().toLocaleString('en-US',{timeZone:'America/Toronto'})} EST</p>
      <blockquote>"${threat.snippet}"</blockquote>
      <a href="${appUrl}/conversations/${conversationId}" style="display:inline-block;background:#111827;color:white;padding:10px 24px;border-radius:6px;text-decoration:none;font-weight:600">Open Conversation →</a>
    </div></div>`;
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: process.env.EMAIL_FROM || 'alerts@yourdomain.com', to: ALERT_EMAIL,
      subject: `${emoji} [${severity}] Legal Threat — Conv #${conversationId} — "${threat.matchedTerm}"`, html }),
  });
  if (!response.ok) { const err = await response.text(); throw new Error(`Resend API error: ${err}`); }
  console.log(`[LEGAL FLAG] Alert email sent to ${ALERT_EMAIL} for conv #${conversationId}`);
}

async function extractTextFromPDF(fileUrl) {
  try {
    const pdfParse = require('pdf-parse');
    const response = await fetch(fileUrl);
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
    const response = await fetch(fileUrl);
    const buffer = await response.arrayBuffer();
    const base64 = Buffer.from(buffer).toString('base64');
    const mimeType = response.headers.get('content-type') || 'image/jpeg';
    const apiResponse = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: 'claude-haiku-4-5-20251001', max_tokens: 1000, messages: [{ role: 'user', content: [
        { type: 'image', source: { type: 'base64', media_type: mimeType, data: base64 } },
        { type: 'text', text: 'Extract all text from this image exactly as written. Return only the raw text, no commentary.' }
      ]}]}),
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
    console.log(`[LEGAL ATTACH] Extracted ${extractedText.length} chars from file`);
    const docType = detectLegalDocumentType(extractedText);
    if (docType) {
      console.log(`🚨 [LEGAL ATTACH] Legal document detected: ${docType.type}`);
      await handleLegalThreat({ detected: true, severity: docType.severity, matchedTerm: docType.type,
        snippet: extractedText.substring(0, 300), fromAttachment: true, documentType: docType.type },
        conversationId, storeId, senderName, `[ATTACHED DOCUMENT] ${extractedText.substring(0, 500)}`, pool);
      return;
    }
    const threat = detectLegalThreat(extractedText);
    if (threat) { threat.fromAttachment = true; await handleLegalThreat(threat, conversationId, storeId, senderName, extractedText, pool); }
  } catch (err) { console.error('[LEGAL ATTACH] File analysis failed:', err.message); }
}

app.use(helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false, crossOriginResourcePolicy: { policy: "cross-origin" }, frameguard: false }));

app.post('/webhooks/:shop/:topic', rawBodyMiddleware, handleWebhook);
app.use(express.json({ limit: '10mb' }));
app.use(session({ secret: process.env.JWT_SECRET, resave: false, saveUninitialized: false,
  cookie: { secure: process.env.NODE_ENV === 'production', maxAge: 24 * 60 * 60 * 1000 } }));

app.get('/widget-init.js', (req, res) => {
  res.set({ 'Content-Type': 'application/javascript; charset=utf-8', 'Cache-Control': 'public, max-age=3600',
    'X-Content-Type-Options': 'nosniff', 'Access-Control-Allow-Origin': '*' });
  res.sendFile(__dirname + '/public/widget-init.js');
});
app.get('/pepstack-init.js', (req, res) => {
  res.set({ 'Content-Type': 'application/javascript; charset=utf-8', 'Cache-Control': 'public, max-age=3600',
    'X-Content-Type-Options': 'nosniff', 'Access-Control-Allow-Origin': '*' });
  res.sendFile(__dirname + '/public/pepstack-init.js');
});
app.get('/widget.html', (req, res) => {
  res.removeHeader('X-Frame-Options');
  res.set({ 'Content-Type': 'text/html; charset=utf-8', 'X-Content-Type-Options': 'nosniff',
    'Cache-Control': 'no-cache, must-revalidate', 'Content-Security-Policy': "frame-ancestors *" });
  res.sendFile(__dirname + '/public/widget.html');
});
app.use(express.static('public'));

const limiter = rateLimit({ windowMs: 15*60*1000, max: 200, message: 'Too many requests from this IP.',
  standardHeaders: true, legacyHeaders: false,
  skip: (req) => { const h = req.headers.authorization; if (h?.startsWith('Bearer ')) { try { const { verifyToken } = require('./auth'); return !!verifyToken(h.split(' ')[1]); } catch(e){ return false; } } return false; },
  validate: { xForwardedForHeader: false, trustProxy: false } });
const widgetLimiter = rateLimit({ windowMs: 15*60*1000, max: 500, message: 'Too many requests.',
  standardHeaders: true, legacyHeaders: false, validate: { xForwardedForHeader: false, trustProxy: false } });
const loginLimiter = rateLimit({ windowMs: 15*60*1000, max: 5, message: 'Too many login attempts.',
  skipSuccessfulRequests: true, validate: { xForwardedForHeader: false, trustProxy: false } });

app.use('/api/widget/', widgetLimiter);
app.use('/api/customers/', widgetLimiter);
app.use('/api/', limiter);

if (process.env.NODE_ENV === 'production') {
  app.use((req, res, next) => {
    if (req.header('x-forwarded-proto') !== 'https') res.redirect(`https://${req.header('host')}${req.url}`);
    else next();
  });
}
app.use((req, res, next) => { console.log(`${req.method} ${req.path}`); next(); });

app.get('/health', async (req, res) => {
  try {
    await db.testConnection();
    const wsStats = getWebSocketStats();
    res.json({ status: 'healthy', timestamp: new Date().toISOString(), database: 'connected',
      websocket: { active: wsStats.totalConnections > 0, connections: wsStats.totalConnections,
        agents: wsStats.agentCount, customers: wsStats.customerCount,
        authenticated: wsStats.authenticatedCount, activeConversations: wsStats.activeConversations },
      uptime: Math.floor(process.uptime()), version: process.env.npm_package_version || '1.0.0' });
  } catch (error) { res.status(503).json({ status: 'unhealthy', error: error.message, timestamp: new Date().toISOString() }); }
});

// ============ WIDGET API ENDPOINTS ============

app.get('/api/stores/verify', async (req, res) => {
  try {
    const { domain } = req.query;
    if (!domain) return res.status(400).json({ error: 'domain parameter required' });
    const store = await db.getStoreByDomain(domain);
    if (!store || !store.is_active) return res.status(404).json({ error: 'Store not found or inactive', message: 'Please install the chat app from Shopify' });
    res.json({ storeId: store.id, storeIdentifier: store.store_identifier, shopDomain: store.shop_domain, brandName: store.brand_name, active: store.is_active, verified: true });
  } catch (error) { console.error('Store verification error:', error); res.status(500).json({ error: 'Verification failed' }); }
});

app.get('/api/widget/settings', async (req, res) => {
  try {
    const { store: storeIdentifier } = req.query;
    if (!storeIdentifier) return res.status(400).json({ error: 'store parameter required' });
    const store = await db.getStoreByIdentifier(storeIdentifier);
    if (!store || !store.is_active) return res.status(404).json({ error: 'Store not found or inactive' });
    res.json({ storeId: store.id, storeIdentifier: store.store_identifier, brandName: store.brand_name,
      primaryColor: store.primary_color || '#667eea', logoUrl: store.logo_url,
      widgetSettings: store.widget_settings || { position: 'bottom-right', greeting: 'Hi! How can we help you today?', placeholder: 'Type your message...', showAvatar: true },
      businessHours: store.business_hours, timezone: store.timezone || 'UTC' });
  } catch (error) { console.error('Widget settings error:', error); res.status(500).json({ error: 'Failed to fetch settings' }); }
});

app.get('/api/widget/session', async (req, res) => {
  try {
    const { store } = req.query;
    if (!store) return res.status(400).json({ error: 'store parameter required' });
    const storeRecord = await db.getStoreByIdentifier(store);
    if (!storeRecord || !storeRecord.is_active) return res.status(404).json({ error: 'Store not found or inactive' });
    const { generateWidgetToken } = require('./auth');
    const token = generateWidgetToken(storeRecord);
    res.json({ token, expiresIn: process.env.WIDGET_JWT_EXPIRES_IN || '2h' });
  } catch (error) { console.error('Widget session error:', error); res.status(500).json({ error: 'Failed to create widget session' }); }
});

app.get('/api/widget/conversation/lookup', async (req, res) => {
  try {
    const { store, email } = req.query;
    console.log(`🔍 [Widget Lookup] store=${store}, email=${email}`);
    if (!store || !email) return res.status(400).json({ error: 'store and email parameters required' });
    const storeRecord = await db.getStoreByIdentifier(store);
    if (!storeRecord || !storeRecord.is_active) { console.log(`❌ [Widget Lookup] Store not found: ${store}`); return res.status(404).json({ error: 'Store not found or inactive' }); }
    console.log(`✅ [Widget Lookup] Store found: id=${storeRecord.id}`);
    let conversations = await db.getConversations({ storeId: storeRecord.id });
    const getField = (obj, snake, camel) => obj[snake] ?? obj[camel];
    let match = conversations.find(c => getField(c,'customer_email','customerEmail') === email && getField(c,'status','status') === 'open');
    if (!match) match = conversations.find(c => getField(c,'customer_email','customerEmail') === email);
    if (!match) {
      const allConversations = await db.getConversations({});
      const emailMatches = allConversations.filter(c => getField(c,'customer_email','customerEmail') === email);
      const storeMatches = emailMatches.filter(c => {
        const cStoreId = getField(c,'store_id','storeId'); const cStoreIdent = getField(c,'store_identifier','storeIdentifier');
        return String(cStoreId) === String(storeRecord.id) || cStoreIdent === storeRecord.shop_domain || cStoreIdent === storeRecord.store_identifier || cStoreIdent === store;
      });
      match = storeMatches.find(c => getField(c,'status','status') === 'open') || storeMatches[0];
    }
    if (match) { console.log(`✅ [Widget Lookup] Found conv ${match.id}`); res.json({ conversationId: match.id }); }
    else { console.log(`ℹ️ [Widget Lookup] Not found for ${email}`); res.json({ conversationId: null }); }
  } catch (error) { console.error('❌ Widget conversation lookup error:', error); res.status(500).json({ error: 'Lookup failed' }); }
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
    res.json({ employee: snakeToCamel(employee), token, expiresIn: '7d' });
  } catch (error) { console.error('Login error:', error); res.status(500).json({ error: 'Login failed. Please try again.' }); }
});

app.post('/api/employees/logout', authenticateToken, async (req, res) => {
  try { await db.updateEmployeeStatus(req.user.id, { is_online: false }); res.json({ message: 'Logged out successfully' }); }
  catch (error) { console.error('Logout error:', error); res.status(500).json({ error: 'Logout failed' }); }
});

app.get('/api/auth/verify', authenticateToken, async (req, res) => {
  try {
    const employee = await db.getEmployeeByEmail(req.user.email);
    if (!employee || !employee.is_active) return res.status(403).json({ error: 'Invalid session' });
    delete employee.password_hash; delete employee.api_token;
    res.json({ employee: snakeToCamel(employee) });
  } catch (error) { res.status(500).json({ error: 'Verification failed' }); }
});

app.get('/auth', async (req, res) => {
  try {
    const { shop } = req.query;
    if (!shop) return res.status(400).json({ error: 'Shop parameter required' });
    const authUrl = await getAuthUrl(shop);
    res.redirect(authUrl);
  } catch (error) { console.error('Auth error:', error); res.status(500).json({ error: 'Authentication failed' }); }
});

app.get('/auth/callback', handleCallback);
app.use('/shopify', shopifyAppRoutes);
app.use('/api/files', fileRoutes);
app.use('/api/ai/training', aiTrainingRoutes);


// ============ HOURLY DISCORD RESPONSE-TIME REPORT ============

const DISCORD_STATS_WEBHOOK = process.env.DISCORD_STATS_WEBHOOK;

// Format decimal minutes into a precise human-readable string.
//   0.1   -> "6s"
//   0.5   -> "30s"
//   1.0   -> "1m"
//   1.25  -> "1m 15s"
//   18.6  -> "18m 36s"
//   65.5  -> "1h 5m"
//   null  -> "n/a"
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

async function sendHourlyResponseTimeStats() {
  if (!DISCORD_STATS_WEBHOOK) {
    console.log('📊 [Discord Stats] No webhook configured — skipping');
    return;
  }

  try {
    const { rows: perAgent } = await db.pool.query(`
      WITH real_messages AS (
        SELECT id, conversation_id, sender_id, sender_type, sent_at,
          LAG(sender_type) OVER (PARTITION BY conversation_id ORDER BY sent_at) AS prev_sender_type,
          LAG(sent_at)     OVER (PARTITION BY conversation_id ORDER BY sent_at) AS prev_sent_at,
          LAG(read_at)     OVER (PARTITION BY conversation_id ORDER BY sent_at) AS prev_read_at
        FROM messages
        WHERE sender_type IN ('customer', 'agent')
          AND NOT (sender_type = 'agent' AND sender_id IS NULL)
      ),
      rt AS (
        SELECT sender_id,
          EXTRACT(EPOCH FROM (sent_at - COALESCE(prev_read_at, prev_sent_at))) / 60.0 AS minutes
        FROM real_messages
        WHERE sender_type = 'agent'
          AND sender_id IS NOT NULL
          AND prev_sender_type = 'customer'
          AND prev_sent_at IS NOT NULL
          AND sent_at >= NOW() - INTERVAL '1 hour'
          AND EXTRACT(EPOCH FROM (sent_at - COALESCE(prev_read_at, prev_sent_at))) / 60.0 BETWEEN 0 AND 240
      )
      SELECT
        COALESCE(e.employee_name, e.name, 'Unknown #' || rt.sender_id) AS display_name,
        ROUND(AVG(rt.minutes)::numeric, 3) AS avg_minutes,
        ROUND(MIN(rt.minutes)::numeric, 3) AS fastest_minutes,
        COUNT(*)::int AS replies
      FROM rt
      LEFT JOIN employees e ON e.id::text = rt.sender_id
      GROUP BY display_name
      ORDER BY replies DESC, avg_minutes ASC
    `);

    // Skip empty hours — no replies in the past hour means nothing to report.
    if (perAgent.length === 0) {
      console.log('📊 [Discord Stats] No activity in past hour — skipping post');
      return;
    }

    // Team totals for the last hour — same time-from-seen logic
    const { rows: teamRows } = await db.pool.query(`
      WITH real_messages AS (
        SELECT conversation_id, sender_type, sent_at,
          LAG(sender_type) OVER (PARTITION BY conversation_id ORDER BY sent_at) AS prev_sender_type,
          LAG(sent_at)     OVER (PARTITION BY conversation_id ORDER BY sent_at) AS prev_sent_at,
          LAG(read_at)     OVER (PARTITION BY conversation_id ORDER BY sent_at) AS prev_read_at
        FROM messages
        WHERE sender_type IN ('customer', 'agent')
          AND NOT (sender_type = 'agent' AND sender_id IS NULL)
      )
      SELECT
        ROUND(AVG(EXTRACT(EPOCH FROM (sent_at - COALESCE(prev_read_at, prev_sent_at))) / 60.0)::numeric, 3) AS avg_minutes,
        ROUND(MIN(EXTRACT(EPOCH FROM (sent_at - COALESCE(prev_read_at, prev_sent_at))) / 60.0)::numeric, 3) AS fastest_minutes,
        COUNT(*)::int AS total_replies
      FROM real_messages
      WHERE sender_type = 'agent' AND prev_sender_type = 'customer'
        AND prev_sent_at IS NOT NULL
        AND sent_at >= NOW() - INTERVAL '1 hour'
        AND EXTRACT(EPOCH FROM (sent_at - COALESCE(prev_read_at, prev_sent_at))) / 60.0 BETWEEN 0 AND 240
    `);

    const team       = teamRows[0] || {};
    const teamAvg    = team.avg_minutes !== null ? parseFloat(team.avg_minutes) : null;
    const teamFast   = team.fastest_minutes !== null ? parseFloat(team.fastest_minutes) : null;
    const teamTotal  = team.total_replies || 0;

    const fields = perAgent.slice(0, 25).map(r => ({
      name: r.display_name,
      value: `Avg: **${formatDuration(parseFloat(r.avg_minutes))}**\nFastest: ${formatDuration(parseFloat(r.fastest_minutes))}\nReplies: ${r.replies}`,
      inline: true,
    }));

    const description = `**Team avg:** ${formatDuration(teamAvg)}  •  **Fastest:** ${formatDuration(teamFast)}  •  **Replies:** ${teamTotal}`;

    // Colour: green ≤5m, amber ≤30m, red >30m, grey if no data
    const color = teamAvg === null ? 0x6b7280
                : teamAvg <= 5     ? 0x10b981
                : teamAvg <= 30    ? 0xf59e0b
                :                    0xef4444;

    const payload = {
      username: 'Response Time Bot',
      embeds: [{
        title: '⏱️ Hourly Response Time Report',
        description,
        color,
        fields,
        timestamp: new Date().toISOString(),
        footer: { text: 'Past hour • Measured from when agent first viewed the message • Cap 4h per response' },
      }],
    };

    const res = await fetch(DISCORD_STATS_WEBHOOK, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error(`📊 [Discord Stats] Webhook ${res.status}: ${err}`);
    } else {
      console.log(`📊 [Discord Stats] Sent — ${perAgent.length} agents, team avg ${formatDuration(teamAvg)}`);
    }
  } catch (err) {
    console.error('📊 [Discord Stats] Error:', err.message);
  }
}

// ============ DAILY DISCORD ACTIVITY REPORT ============

async function sendDailyActivityStats() {
  const webhook = process.env.DISCORD_DAILY_WEBHOOK || DISCORD_STATS_WEBHOOK;
  if (!webhook) {
    console.log('📊 [Discord Daily] No webhook configured — skipping');
    return;
  }

  try {
    // Conversations: new vs active (any message) in the past 24h
    const { rows: convRows } = await db.pool.query(`
      SELECT
        (SELECT COUNT(*)::int FROM conversations
           WHERE created_at >= NOW() - INTERVAL '24 hours') AS new_convs,
        (SELECT COUNT(DISTINCT conversation_id)::int FROM messages
           WHERE sent_at >= NOW() - INTERVAL '24 hours'
             AND sender_type IN ('customer','agent')
             AND NOT (sender_type = 'agent' AND sender_id IS NULL)) AS active_convs
    `);

    // Sent (agent, excluding auto-reply bots) + received (customer) in last 24h
    const { rows: msgRows } = await db.pool.query(`
      SELECT
        COUNT(*) FILTER (WHERE sender_type = 'agent' AND sender_id IS NOT NULL)::int AS sent_count,
        COUNT(*) FILTER (WHERE sender_type = 'customer')::int                        AS received_count
      FROM messages
      WHERE sent_at >= NOW() - INTERVAL '24 hours'
    `);

    // Per-agent activity in the last 24h
    const { rows: agentRows } = await db.pool.query(`
      SELECT
        COALESCE(e.employee_name, e.name, 'Unknown #' || m.sender_id) AS display_name,
        COUNT(*)::int AS message_count
      FROM messages m
      LEFT JOIN employees e ON e.id::text = m.sender_id
      WHERE m.sender_type = 'agent'
        AND m.sender_id IS NOT NULL
        AND m.sent_at >= NOW() - INTERVAL '24 hours'
      GROUP BY display_name
      ORDER BY message_count DESC
    `);

    const newConvs    = convRows[0]?.new_convs    || 0;
    const activeConvs = convRows[0]?.active_convs || 0;
    const sentCount   = msgRows[0]?.sent_count    || 0;
    const recvCount   = msgRows[0]?.received_count || 0;
    const activeEmps  = agentRows.length;

    const fields = [
      { name: '💬 Conversations', value: `**${activeConvs}** active\n**${newConvs}** new`,        inline: true },
      { name: '📥 Received',      value: `**${recvCount}** customer messages`,                   inline: true },
      { name: '📤 Sent',          value: `**${sentCount}** agent replies`,                       inline: true },
    ];

    if (agentRows.length > 0) {
      const topList = agentRows.slice(0, 15)
        .map(r => `**${r.display_name}** — ${r.message_count} msgs`).join('\n');
      const remainder = agentRows.length > 15 ? `\n_…and ${agentRows.length - 15} more_` : '';
      fields.push({
        name:  `👥 Active Employees (${activeEmps})`,
        value: topList + remainder,
        inline: false,
      });
    } else {
      fields.push({ name: '👥 Active Employees', value: '_No employee activity_', inline: false });
    }

const now  = new Date();
    const then = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const fmtRange = (d) => d.toLocaleString('en-US', {
      timeZone: 'America/Toronto',
      month: 'short', day: 'numeric', 
      hour: 'numeric', minute: '2-digit',
    });

    const payload = {
      username: 'Daily Activity Bot',
      embeds: [{
        title: '📅 Daily Activity Report',
        description: `**${fmtRange(then)} → ${fmtRange(now)}** (ET)`,
        color: 0x3b82f6,
        fields,
        timestamp: now.toISOString(),
        footer: { text: 'Past 24 hours • Excludes auto-replies' },
      }],
    };

    const res = await fetch(webhook, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(payload),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error(`📊 [Discord Daily] Webhook ${res.status}: ${err}`);
    } else {
      console.log(`📊 [Discord Daily] Sent — ${activeConvs} convs (${newConvs} new), ${sentCount} sent, ${recvCount} received, ${activeEmps} agents`);
    }
  } catch (err) {
    console.error('📊 [Discord Daily] Error:', err.message);
  }
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
        `SELECT c.customer_name, s.brand_name, s.shop_domain, s.primary_color, s.email_from_address, s.email_brand_color FROM conversations c JOIN stores s ON c.shop_id = s.id WHERE c.id = $1`,
        [conversationId]);
      if (r.rows.length) {
        const row = r.rows[0];
        brandName = row.brand_name || brandName; brandColor = row.email_brand_color || row.primary_color || brandColor;
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
    const time = new Date().toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
    const safeBody = body.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    const emailHtml = `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1.0"/><title>Message from ${brandName}</title></head>
<body style="margin:0;padding:0;background:#f6f6f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f6f6f7;"><tr><td align="center" style="padding:40px 16px 24px;">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;">
<tr><td style="padding-bottom:24px;"><table cellpadding="0" cellspacing="0"><tr>
<td style="vertical-align:middle;padding-right:10px;"><img src="https://chatsupportpullzone.b-cdn.net/uploads/shopify_logo-removebg-preview.png" width="100" height="auto" alt="Shopify" style="display:block;border:0;"/></td>
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
      method: 'POST', headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: `${brandName} <${fromAddress}>`, to: [to], subject, html: emailHtml, text: `${greeting}\n\n${agentName}:\n${body}` }),
    });
    const resendBody = await resendRes.json();
    if (!resendRes.ok) { console.error('[Email/send] Resend rejected:', resendBody); return res.status(502).json({ error: resendBody?.message || `Resend error ${resendRes.status}` }); }
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
    const brainBlock = brainContext.trim() ? `\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\nSTORE KNOWLEDGE BASE — USE THIS AS YOUR PRIMARY SOURCE\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n${brainContext}\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` : '';
    const systemPrompt = `${brainBlock}You are a peptide protocol advisor for this store. Use the store knowledge base above as your PRIMARY source. Respond ONLY with valid JSON — no markdown, no preamble.\n\nJSON structure:\n{\n  "summary": "2-3 sentence personalised intro",\n  "stack": [{ "name": "Exact product name", "why": "1-2 sentences", "dose": "Dosing guidance" }],\n  "tip": "One practical stack or timing tip"\n}\n\nRules: 2-4 peptides max, exact product names from brain, no disclaimers inside JSON`;
    const userMsg = [`Goal: ${goal}`, age ? `Age: ${age}` : null, sex ? `Sex: ${sex}` : null, height ? `Height: ${height}` : null, weight ? `Weight: ${weight}` : null].filter(Boolean).join('\n');
    const userPrompt = brainContext.trim() ? `${brainBlock}Customer profile:\n${userMsg}\n\nUsing the store knowledge base above, recommend the best peptide stack. Return only JSON.` : `Customer profile:\n${userMsg}\n\nRecommend the best peptide stack. Return only JSON.`;
    const requestBody = JSON.stringify({ model: 'claude-haiku-4-5-20251001', max_tokens: 800, system: systemPrompt, messages: [{ role: 'user', content: userPrompt }] });
    const data = await callAnthropicAPIWithRetry(requestBody, ANTHROPIC_API_KEY);
    const raw = data.content?.[0]?.text || '';
    const cleaned = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    let parsed;
    try { parsed = JSON.parse(cleaned); } catch (e) { console.error('[PepStack] JSON parse error:', raw); return res.status(500).json({ error: 'Failed to parse AI response' }); }
    return res.json(parsed);
  } catch (err) { console.error('[PepStack] Error:', err.message); return res.status(500).json({ error: 'Internal server error' }); }
});

// ============ STORE ENDPOINTS ============

app.get('/api/stores', authenticateToken, async (req, res) => {
  try { const stores = await db.getAllActiveStores(); res.json(stores.map(snakeToCamel)); }
  catch (error) { res.status(500).json({ error: error.message }); }
});
app.get('/api/stores/all', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin access required' });
    const result = await db.pool.query('SELECT * FROM stores ORDER BY brand_name ASC');
    res.json(result.rows.map(snakeToCamel));
  } catch (error) { res.status(500).json({ error: error.message }); }
});
app.post('/api/stores', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin access required' });
    const { storeIdentifier, shopDomain, brandName, isActive } = req.body;
    if (!storeIdentifier || !shopDomain || !brandName) return res.status(400).json({ error: 'storeIdentifier, shopDomain, and brandName are required' });
    const result = await db.pool.query(`INSERT INTO stores (store_identifier, shop_domain, brand_name, is_active, access_token, installed_at, updated_at) VALUES ($1, $2, $3, $4, '', NOW(), NOW()) RETURNING *`, [storeIdentifier, shopDomain, brandName, isActive !== false]);
    res.status(201).json(snakeToCamel(result.rows[0]));
  } catch (error) {
    if (error.code === '23505') return res.status(409).json({ error: 'A store with that identifier or domain already exists' });
    res.status(500).json({ error: error.message });
  }
});
app.put('/api/stores/:id', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin access required' });
    const { shopDomain, brandName, isActive } = req.body;
    const result = await db.pool.query(`UPDATE stores SET shop_domain = $1, brand_name = $2, is_active = $3, updated_at = NOW() WHERE id = $4 RETURNING *`, [shopDomain, brandName, isActive !== false, req.params.id]);
    if (!result.rows[0]) return res.status(404).json({ error: 'Store not found' });
    res.json(snakeToCamel(result.rows[0]));
  } catch (error) { res.status(500).json({ error: error.message }); }
});
app.delete('/api/stores/:id', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin access required' });
    const result = await db.pool.query(`DELETE FROM stores WHERE id = $1 RETURNING id`, [req.params.id]);
    if (!result.rows[0]) return res.status(404).json({ error: 'Store not found' });
    res.json({ success: true });
  } catch (error) { res.status(500).json({ error: error.message }); }
});
app.get('/api/customer-context/:storeId/:email', authenticateToken, async (req, res) => {
  try {
    const store = await db.getStoreByIdentifier(req.params.storeId);
    if (!store) return res.status(404).json({ error: 'Store not found' });
    const context = await shopify.getCustomerContext(store, req.params.email);
    res.json(context);
  } catch (error) { console.error('Customer context error:', error); res.status(500).json({ error: 'Failed to fetch customer context' }); }
});

// ============ CUSTOMER & ORDER LOOKUP ============

app.get('/api/customers/lookup', async (req, res) => {
  try {
    const { store: storeIdentifier, email } = req.query;
    if (!storeIdentifier || !email) return res.status(400).json({ error: 'store and email parameters required' });
    const store = await db.getStoreByIdentifier(storeIdentifier);
    if (!store || !store.is_active) return res.status(404).json({ error: 'Store not found or inactive' });
    const customerContext = await shopify.getCustomerContext(store, email);
    if (!customerContext?.customer) return res.status(404).json({ error: 'Customer not found' });
    const customer = customerContext.customer;
    res.json({ id: customer.id, name: customer.name || `${customer.first_name || ''} ${customer.last_name || ''}`.trim(),
      email: customer.email, phone: customer.phone, createdAt: customer.created_at, updatedAt: customer.updated_at,
      ordersCount: customer.orders_count || 0, totalSpent: customer.total_spent ? parseFloat(customer.total_spent) : 0,
      tags: customer.tags, note: customer.note });
  } catch (error) { console.error('Customer lookup error:', error); res.status(500).json({ error: 'Failed to fetch customer data', message: error.message }); }
});
app.get('/api/customers/orders', async (req, res) => {
  try {
    const { store: storeIdentifier, email } = req.query;
    if (!storeIdentifier || !email) return res.status(400).json({ error: 'store and email parameters required' });
    const store = await db.getStoreByIdentifier(storeIdentifier);
    if (!store || !store.is_active) return res.status(404).json({ error: 'Store not found or inactive' });
    const customerContext = await shopify.getCustomerContext(store, email);
    if (!customerContext?.orders) return res.json([]);
    const formattedOrders = customerContext.orders.map(order => ({
      id: order.id, orderNumber: order.order_number || order.name, status: order.financial_status || 'pending',
      fulfillmentStatus: order.fulfillment_status, total: order.total_price ? parseFloat(order.total_price) : 0,
      currency: order.currency, orderDate: order.created_at,
      items: order.line_items ? order.line_items.map(item => ({ id: item.id, title: item.title, quantity: item.quantity, price: parseFloat(item.price) })) : [],
      trackingNumber: order.tracking_number, trackingUrl: order.tracking_url }));
    formattedOrders.sort((a, b) => new Date(b.orderDate) - new Date(a.orderDate));
    res.json(formattedOrders);
  } catch (error) { console.error('Customer orders error:', error); res.status(500).json({ error: 'Failed to fetch orders', message: error.message }); }
});
app.get('/api/customers/cart', async (req, res) => {
  try {
    const { store: storeIdentifier, email } = req.query;
    if (!storeIdentifier || !email) return res.status(400).json({ error: 'store and email parameters required' });
    const store = await db.getStoreByIdentifier(storeIdentifier);
    if (!store || !store.is_active) return res.status(404).json({ error: 'Store not found or inactive' });
    res.json({ subtotal: 0, items: [], itemCount: 0 });
  } catch (error) { console.error('Customer cart error:', error); res.status(500).json({ error: 'Failed to fetch cart', message: error.message }); }
});
app.post('/api/stores/:storeId/webhooks', authenticateToken, async (req, res) => {
  try {
    const store = await db.getStoreByIdentifier(req.params.storeId);
    if (!store) return res.status(404).json({ error: 'Store not found' });
    const webhookUrl = req.body.webhookUrl || `${process.env.APP_URL}/webhooks`;
    const results = await shopify.registerWebhooks(store, webhookUrl);
    res.json({ results });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

// ============ NOTES ============

app.get('/api/employees/:employeeId/notes', authenticateToken, async (req, res) => {
  try {
    const result = await db.pool.query(`SELECT id, employee_id, employee_name, title, content, created_at, updated_at FROM employee_notes ORDER BY created_at DESC`);
    res.json(result.rows.map(snakeToCamel));
  } catch (error) { console.error('❌ Error fetching notes:', error); res.status(500).json({ error: 'Failed to fetch notes' }); }
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
    const employeeResult = await db.pool.query('SELECT name FROM employees WHERE id = $1', [employeeId]);
    if (employeeResult.rows.length === 0) return res.status(404).json({ error: 'Employee not found' });
    const employeeName = employeeResult.rows[0].name;
    const result = await db.pool.query(`INSERT INTO employee_notes (employee_id, employee_name, title, content, created_at, updated_at) VALUES ($1, $2, $3, $4, NOW(), NOW()) RETURNING id, employee_id, employee_name, title, content, created_at, updated_at`, [employeeId, employeeName, noteTitle, noteContent]);
    res.status(201).json(snakeToCamel(result.rows[0]));
  } catch (error) { console.error('Error creating note:', error); res.status(500).json({ error: 'Failed to create note' }); }
});
app.delete('/api/conversation-notes/:noteId', authenticateToken, async (req, res) => {
  try {
    const noteId = parseInt(req.params.noteId);
    const employeeId = req.user.id;
    const noteResult = await db.pool.query('SELECT employee_id FROM employee_notes WHERE id = $1', [noteId]);
    if (noteResult.rows.length === 0) return res.status(404).json({ error: 'Note not found' });
    if (noteResult.rows[0].employee_id !== employeeId) return res.status(403).json({ error: 'You can only delete your own notes' });
    await db.pool.query('DELETE FROM employee_notes WHERE id = $1', [noteId]);
    res.json({ success: true, message: 'Note deleted' });
  } catch (error) { console.error('Error deleting note:', error); res.status(500).json({ error: 'Failed to delete note' }); }
});

// ============ CONVERSATION ENDPOINTS ============

app.get('/api/conversations', authenticateToken, async (req, res) => {
  try {
    const { storeId, status, limit, offset } = req.query;
    const filters = {};
    if (storeId) filters.storeId = parseInt(storeId);
    // Never include archived in the main inbox feed
    if (status) filters.status = status;
    else filters.excludeArchived = true;
    if (limit) filters.limit = parseInt(limit);
    if (offset) filters.offset = parseInt(offset);
    const conversations = await db.getConversations(filters);
    res.json(conversations.map(snakeToCamel));
  } catch (error) { console.error('Get conversations error:', error); res.status(500).json({ error: error.message }); }
});

app.get('/api/widget/history', async (req, res) => {
  try {
    const { email, excludeConversationId } = req.query;
    if (!email || !email.includes('@')) return res.status(400).json({ error: 'Valid email required' });
    const result = await db.pool.query(`
      SELECT c.id, c.status, c.updated_at, c.shop_id, c.shop_domain,
        COALESCE(s.brand_name, c.shop_domain, 'Unknown Store') AS brand_name,
        m.content AS last_message_content, m.sender_type AS last_message_sender_type, m.timestamp AS last_message_at
      FROM conversations c LEFT JOIN stores s ON c.shop_id = s.id
      LEFT JOIN LATERAL (SELECT content, sender_type, timestamp FROM messages WHERE conversation_id = c.id ORDER BY timestamp DESC LIMIT 1) m ON true
      WHERE c.customer_email = $1 ${excludeConversationId ? 'AND c.id != $2' : ''} ORDER BY c.updated_at DESC
    `, excludeConversationId ? [email, parseInt(excludeConversationId)] : [email]);
    if (!result.rows.length) return res.json({ linkedConversations: [], storeCount: 0, totalConversations: 0 });
    const byStore = {};
    for (const row of result.rows) {
      const storeKey = row.shop_id || row.shop_domain || 'unknown';
      if (!byStore[storeKey]) byStore[storeKey] = { storeIdentifier: row.shop_domain, storeName: row.brand_name, shopId: row.shop_id, conversations: [] };
      byStore[storeKey].conversations.push({ id: row.id, status: row.status, updatedAt: row.updated_at,
        lastMessage: row.last_message_content ? { content: row.last_message_content.substring(0, 80), senderType: row.last_message_sender_type, createdAt: row.last_message_at } : null });
    }
    const storeGroups = Object.values(byStore);
    return res.json({ linkedConversations: storeGroups, storeCount: storeGroups.length, totalConversations: result.rows.length });
  } catch (error) { console.error('❌ [widget/history] Error:', error); return res.status(500).json({ error: 'Failed to fetch history' }); }
});

app.get('/api/conversations/linked/:email', authenticateToken, async (req, res) => {
  try {
    const { email } = req.params; const { excludeConversationId } = req.query;
    if (!email || !email.includes('@')) return res.status(400).json({ error: 'Valid email required' });
    const result = await db.pool.query(`
      SELECT c.id, c.status, c.created_at, c.updated_at, c.shop_domain, c.shop_id,
        COALESCE(s.brand_name, c.shop_domain, 'Unknown Store') AS brand_name,
        m.content AS last_message_content, m.sender_type AS last_message_sender_type, m.timestamp AS last_message_at
      FROM conversations c LEFT JOIN stores s ON c.shop_id = s.id
      LEFT JOIN LATERAL (SELECT content, sender_type, timestamp FROM messages WHERE conversation_id = c.id ORDER BY timestamp DESC LIMIT 1) m ON true
      WHERE c.customer_email = $1 ${excludeConversationId ? 'AND c.id != $2' : ''} ORDER BY c.updated_at DESC
    `, excludeConversationId ? [email, parseInt(excludeConversationId)] : [email]);
    if (!result.rows.length) return res.json({ linkedConversations: [], storeCount: 0 });
    const byStore = {};
    for (const row of result.rows) {
      const storeKey = row.shop_id || row.shop_domain || 'unknown';
      if (!byStore[storeKey]) byStore[storeKey] = { storeIdentifier: row.shop_domain, storeName: row.brand_name, shopId: row.shop_id, conversations: [] };
      byStore[storeKey].conversations.push({ id: row.id, status: row.status, createdAt: row.created_at, updatedAt: row.updated_at, messageCount: 0,
        lastMessage: row.last_message_content ? { content: row.last_message_content, senderType: row.last_message_sender_type, createdAt: row.last_message_at } : null });
    }
    const storeGroups = Object.values(byStore);
    return res.json({ customerEmail: email, linkedConversations: storeGroups, storeCount: storeGroups.length, totalConversations: result.rows.length });
  } catch (error) { console.error('❌ [linked-conversations] Error:', error); return res.status(500).json({ error: 'Failed to fetch linked conversations' }); }
});

// NOTE: /api/conversations/archived must be declared BEFORE /api/conversations/:id
// so Express doesn't treat "archived" as an :id param.
app.get('/api/conversations/archived', authenticateToken, async (req, res) => {
  try {
    const page            = Math.max(1, parseInt(req.query.page)  || 1);
    const limit           = Math.min(100, parseInt(req.query.limit) || 30);
    const offset          = (page - 1) * limit;
    const storeIdentifier = req.query.storeIdentifier || null;

    const params = [limit, offset];
    let whereExtra = '';
    if (storeIdentifier) {
      params.push(storeIdentifier);
      whereExtra = `AND (c.store_identifier = $${params.length} OR c.shop_domain = $${params.length})`;
    }

    const { rows } = await db.pool.query(
      `SELECT c.*, COUNT(*) OVER() AS total_count
         FROM conversations c
        WHERE c.status = 'archived'
              ${whereExtra}
        ORDER BY c.archived_at DESC NULLS LAST, c.updated_at DESC
        LIMIT $1 OFFSET $2`,
      params
    );

    const total = rows.length ? parseInt(rows[0].total_count) : 0;
    return res.json({
      conversations: rows.map(r => { const row = { ...r }; delete row.total_count; return snakeToCamel(row); }),
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (err) {
    console.error('❌ [archived list] Error:', err);
    return res.status(500).json({ error: 'Failed to fetch archived conversations' });
  }
});

app.get('/api/conversations/:id', authenticateToken, async (req, res) => {
  try {
    const conversation = await db.getConversation(parseInt(req.params.id));
    if (!conversation) return res.status(404).json({ error: 'Conversation not found' });
    res.json(snakeToCamel(conversation));
  } catch (error) { console.error('Error fetching conversation:', error); res.status(500).json({ error: error.message }); }
});

app.post('/api/conversations', async (req, res) => {
  try {
    const { storeIdentifier, customerEmail, customerName, initialMessage, fileData } = req.body;
    if (!storeIdentifier || !customerEmail) return res.status(400).json({ error: 'storeIdentifier and customerEmail required' });
    const store = await db.getStoreByIdentifier(storeIdentifier);
    if (!store) return res.status(404).json({ error: 'Store not found' });

    // ── Blacklist check ──────────────────────────────────────
    const blCheck = await db.pool.query(
      `SELECT id FROM blacklist
        WHERE email = $1 AND removed_at IS NULL
          AND (store_identifier IS NULL OR store_identifier = $2)
        LIMIT 1`,
      [customerEmail.toLowerCase().trim(), store.store_identifier]
    );
    if (blCheck.rowCount > 0) {
      console.log(`🚫 [Blacklist] Blocked conversation attempt from ${customerEmail} on ${store.store_identifier}`);
      return res.status(403).json({ error: 'blocked', message: 'Unable to start a conversation at this time.' });
    }
    // ────────────────────────────────────────────────────────

    const conversation = await db.saveConversation({ store_id: store.id, store_identifier: store.shop_domain, customer_email: customerEmail, customer_name: customerName || customerEmail, status: 'open', priority: 'normal' });
    res.json(snakeToCamel(conversation));
    setImmediate(async () => {
      try {
        if (initialMessage) {
          const message = await db.saveMessage({ conversation_id: conversation.id, store_id: store.id, sender_type: 'customer', sender_name: customerName || customerEmail, content: initialMessage, file_data: fileData ? JSON.stringify(fileData) : null });
          broadcastToAgents({ type: 'new_message', message: snakeToCamel(message), conversationId: conversation.id, storeId: store.id });
        }
        broadcastToAgents({ type: 'new_conversation', conversation: snakeToCamel(conversation), storeId: store.id, storeIdentifier });
      } catch (error) { console.error('Background conversation processing error:', error); }
    });
  } catch (error) { console.error('Create conversation error:', error); res.status(500).json({ error: error.message }); }
});


app.put('/api/conversations/:id', authenticateToken, async (req, res) => {
  try { const conversation = await db.updateConversation(parseInt(req.params.id), req.body); res.json(snakeToCamel(conversation)); }
  catch (error) { res.status(500).json({ error: error.message }); }
});
app.put('/api/conversations/:id/read', authenticateToken, async (req, res) => {
  try {
    const conversationId = parseInt(req.params.id);
    await db.markConversationRead(conversationId);
    const updatedConversation = await db.getConversation(conversationId);
    broadcastToAgents({ type: 'conversation_read', conversationId, conversation: snakeToCamel(updatedConversation) });
    res.json({ success: true });
  } catch (error) { console.error('Error marking as read:', error); res.status(500).json({ error: error.message }); }
});
app.put('/api/conversations/:id/unread', authenticateToken, async (req, res) => {
  try {
    const conversationId = parseInt(req.params.id);
    await db.pool.query(`UPDATE conversations SET unread_count = 1, updated_at = NOW() WHERE id = $1`, [conversationId]);
    const updatedConversation = await db.getConversation(conversationId);
    if (!updatedConversation) return res.status(404).json({ error: 'Conversation not found' });
    broadcastToAgents({ type: 'conversation_unread', conversationId, conversation: snakeToCamel(updatedConversation) });
    res.json({ success: true, conversationId });
  } catch (error) { console.error('Error marking as unread:', error); res.status(500).json({ error: error.message }); }
});
app.put('/api/conversations/:id/close', authenticateToken, async (req, res) => {
  try { const conversation = await db.closeConversation(parseInt(req.params.id)); res.json(snakeToCamel(conversation)); }
  catch (error) { res.status(500).json({ error: error.message }); }
});

// ── ARCHIVE ──────────────────────────────────────────────────────────────────

app.patch('/api/conversations/:id/archive', authenticateToken, async (req, res) => {
  try {
    const conversationId = parseInt(req.params.id);
    const result = await db.pool.query(
      `UPDATE conversations
          SET status      = 'archived',
              archived_at = NOW(),
              updated_at  = NOW()
        WHERE id = $1
          AND status != 'archived'
      RETURNING *`,
      [conversationId]
    );

    if (result.rowCount === 0) {
      // Already archived or not found — return current state
      const existing = await db.getConversation(conversationId);
      if (!existing) return res.status(404).json({ error: 'Conversation not found' });
      return res.json(snakeToCamel(existing));
    }

    const archived = snakeToCamel(result.rows[0]);
    broadcastToAgents({ type: 'conversation_archived', conversationId, conversation: archived });
    console.log(`📦 [Archive] Conv #${conversationId} archived by ${req.user.email}`);
    return res.json(archived);
  } catch (err) {
    console.error('❌ [archive] Error:', err);
    return res.status(500).json({ error: 'Failed to archive conversation' });
  }
});

app.patch('/api/conversations/:id/unarchive', authenticateToken, async (req, res) => {
  try {
    const conversationId = parseInt(req.params.id);
    const result = await db.pool.query(
      `UPDATE conversations
          SET status      = 'open',
              archived_at = NULL,
              updated_at  = NOW()
        WHERE id = $1
          AND status = 'archived'
      RETURNING *`,
      [conversationId]
    );

    if (result.rowCount === 0) {
      const existing = await db.getConversation(conversationId);
      if (!existing) return res.status(404).json({ error: 'Conversation not found' });
      return res.json(snakeToCamel(existing));
    }

    const unarchived = snakeToCamel(result.rows[0]);
    broadcastToAgents({ type: 'conversation_unarchived', conversationId, conversation: unarchived });
    console.log(`📬 [Unarchive] Conv #${conversationId} restored by ${req.user.email}`);
    return res.json(unarchived);
  } catch (err) {
    console.error('❌ [unarchive] Error:', err);
    return res.status(500).json({ error: 'Failed to unarchive conversation' });
  }
});

// ── END ARCHIVE ───────────────────────────────────────────────────────────────

// ============ MESSAGE ENDPOINTS ============

app.get('/api/widget/conversations/:id/messages', async (req, res) => {
  try {
    const { store } = req.query;
    if (!store) return res.status(400).json({ error: 'store parameter required' });
    const storeRecord = await db.getStoreByIdentifier(store);
    if (!storeRecord || !storeRecord.is_active) return res.status(404).json({ error: 'Store not found or inactive' });
    const conversationId = parseInt(req.params.id);
    const conversation = await db.getConversation(conversationId);
    if (!conversation) return res.status(404).json({ error: 'Conversation not found' });
    const convStoreId = conversation.shop_id ?? conversation.shopId ?? conversation.store_id ?? conversation.storeId;
    const convStoreIdentifier = conversation.shop_domain ?? conversation.shopDomain ?? conversation.store_identifier ?? conversation.storeIdentifier;
    const storeIdMatch = String(convStoreId) === String(storeRecord.id);
    const identifierMatch = convStoreIdentifier && (convStoreIdentifier === storeRecord.shop_domain || convStoreIdentifier === storeRecord.store_identifier || convStoreIdentifier === store);
    if (!storeIdMatch && !identifierMatch) { console.warn(`❌ [Widget History] Access denied: conv ${conversationId}`); return res.status(403).json({ error: 'Unauthorized' }); }
    const messages = await db.getMessages(conversationId);
    const sanitized = messages.map(m => {
      const { sender_display_name, sender_employee_name, ...safe } = m;
      return snakeToCamel(safe);
    });

    res.json(sanitized);
  } catch (error) { console.error('❌ Widget message history error:', error); res.status(500).json({ error: 'Failed to fetch messages' }); }
});


app.get('/api/conversations/:id/messages', authenticateToken, async (req, res) => {
  try {
    const conversationId = parseInt(req.params.id);
    const messages = await db.getMessages(conversationId);
    await db.markConversationRead(conversationId);
    const updatedConversation = await db.getConversation(conversationId);
    broadcastToAgents({ type: 'conversation_read', conversationId, conversation: snakeToCamel(updatedConversation) });
    res.json(messages.map(snakeToCamel));
  } catch (error) { console.error('Error fetching messages:', error); res.status(500).json({ error: error.message }); }
});

app.post('/api/messages', authenticateToken, async (req, res) => {
  try {
    const { conversationId, senderType, senderName, content, storeId, fileData } = req.body;
    if (!conversationId || !senderType) return res.status(400).json({ error: 'Missing required fields' });
    if (!content && !fileData) return res.status(400).json({ error: 'Message must have text or a file attachment' });
    const timestamp = new Date();
    const tempId = `temp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const tempMessage = { id: tempId, conversationId, storeId, senderType, senderName, content: content || '', fileData, createdAt: timestamp, pending: true };
    sendToConversation(conversationId, { type: 'new_message', message: snakeToCamel(tempMessage) });
    broadcastToAgents({ type: 'new_message', message: snakeToCamel(tempMessage), conversationId, storeId });
    res.json(snakeToCamel(tempMessage));
    setImmediate(async () => {
      try {
        const savedMessage = await db.saveMessage({
          conversation_id: conversationId,
          store_id: storeId,
          sender_type: senderType,
          sender_name: senderName,
          sender_id: senderType === 'agent' ? req.user.id : null,  // ← tracks admin + agent by ID
          content: content || '',
          file_data: fileData ? JSON.stringify(fileData) : null,
          sent_at: timestamp
        });
        const updatedConversation = await db.getConversation(conversationId);
        sendToConversation(conversationId, { type: 'message_confirmed', tempId, message: snakeToCamel(savedMessage) });
        broadcastToAgents({ type: 'message_confirmed', tempId, message: snakeToCamel(savedMessage), conversationId, storeId, conversation: snakeToCamel(updatedConversation) });
        if (senderType === 'agent') handleOfflineEmailNotification(db.pool, savedMessage).catch(err => console.error('[Offline Email] Failed:', err));
      } catch (error) { console.error('Failed to save agent message:', error); sendToConversation(conversationId, { type: 'message_failed', tempId }); }
    });
  } catch (error) { console.error('Send message error:', error); res.status(500).json({ error: error.message }); }
});


app.post('/api/widget/messages', async (req, res) => {
  try {
    const { conversationId, customerEmail, customerName, content, storeIdentifier, fileData } = req.body;
    if (!conversationId) return res.status(400).json({ error: 'Missing required fields' });
    if (!content && !fileData) return res.status(400).json({ error: 'Message must have text or a file attachment' });
    const store = await db.getStoreByIdentifier(storeIdentifier);
    if (!store) return res.status(404).json({ error: 'Store not found' });

    // ── Blacklist check ──────────────────────────────────────
    const blCheck = await db.pool.query(
      `SELECT id FROM blacklist
        WHERE email = $1 AND removed_at IS NULL
          AND (store_identifier IS NULL OR store_identifier = $2)
        LIMIT 1`,
      [customerEmail.toLowerCase().trim(), store.store_identifier]
    );
    if (blCheck.rowCount > 0) {
      console.log(`🚫 [Blacklist] Blocked message from ${customerEmail} on ${store.store_identifier}`);
      return res.status(403).json({ error: 'blocked', message: 'Unable to send messages at this time.' });
    }
    // ────────────────────────────────────────────────────────

    const conversation = await db.getConversation(conversationId);
    if (!conversation) return res.status(404).json({ error: 'conversation_not_found', message: 'This conversation no longer exists' });
    const timestamp = new Date();
    const tempId = `temp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const tempMessage = { id: tempId, conversationId, storeId: store.id, senderType: 'customer', senderName: customerName || customerEmail, content: content || '', fileData, createdAt: timestamp, pending: true };
    sendToConversation(conversationId, { type: 'new_message', message: snakeToCamel(tempMessage) });
    broadcastToAgents({ type: 'new_message', message: snakeToCamel(tempMessage), conversationId, storeId: store.id });
    res.json(snakeToCamel(tempMessage));
    setImmediate(async () => {
      try {
        const savedMessage = await db.saveMessage({ conversation_id: conversationId, store_id: store.id, sender_type: 'customer', sender_name: customerName || customerEmail, content: content || '', file_data: fileData ? JSON.stringify(fileData) : null });
        const updatedConversation = await db.getConversation(conversationId);
        const confirmedMessage = snakeToCamel(savedMessage);
        sendToConversation(conversationId, { type: 'message_confirmed', tempId, message: confirmedMessage });
        broadcastToAgents({ type: 'message_confirmed', tempId, message: confirmedMessage, conversationId, storeId: store.id, conversation: snakeToCamel(updatedConversation) });
        if (content) { const legalThreat = detectLegalThreat(content); if (legalThreat) handleLegalThreat(legalThreat, conversationId, store.id, customerName || customerEmail, content, db.pool).catch(err => console.error('[LEGAL FLAG] Text handler error:', err.message)); }
        if (fileData) analyzeLegalAttachment(fileData, conversationId, store.id, customerName || customerEmail, db.pool).catch(err => console.error('[LEGAL FLAG] Attachment handler error:', err.message));
      } catch (error) { console.error('Failed to save message:', error); sendToConversation(conversationId, { type: 'message_failed', tempId, error: 'Failed to save message' }); }
    });
  } catch (error) { console.error('Widget message error:', error); res.status(500).json({ error: 'Failed to send message', message: error.message }); }
});



app.delete('/api/messages/:id', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin access required' });
    const messageId = parseInt(req.params.id);
    if (isNaN(messageId)) return res.status(400).json({ error: 'Invalid message ID' });
    const existing = await db.pool.query('SELECT id, conversation_id FROM messages WHERE id = $1', [messageId]);
    if (existing.rows.length === 0) return res.status(404).json({ error: 'Message not found' });
    const { conversation_id } = existing.rows[0];
    await db.pool.query('DELETE FROM messages WHERE id = $1', [messageId]);
    console.log(`🗑️ [Messages] Admin ${req.user.email} deleted message ${messageId}`);
    broadcastToAgents({ type: 'message_deleted', messageId, conversationId: conversation_id });
    sendToConversation(conversation_id, { type: 'message_deleted', messageId, conversationId: conversation_id });
    res.json({ success: true, messageId });
  } catch (error) { console.error('❌ Delete message error:', error); res.status(500).json({ error: 'Failed to delete message' }); }
});

app.post('/api/widget/presence', async (req, res) => {
  try {
    const { conversationId, customerEmail, storeId, status, lastActivityAt } = req.body;
    if (!conversationId || !customerEmail) return res.status(400).json({ error: 'conversationId and customerEmail required' });
    const validStatuses = ['online', 'away', 'offline'];
    const safeStatus = validStatuses.includes(status) ? status : 'offline';
    const exists = await db.pool.query('SELECT id FROM conversations WHERE id = $1 LIMIT 1', [conversationId]);
    if (exists.rowCount === 0) return res.status(410).json({ error: 'conversation_not_found', message: 'Conversation no longer exists' });
    await db.pool.query(`INSERT INTO customer_presence (conversation_id, customer_email, store_id, status, last_activity_at, last_heartbeat_at, ws_connected, updated_at) VALUES ($1, $2, $3, $4, $5, NOW(), FALSE, NOW()) ON CONFLICT (conversation_id) DO UPDATE SET status = $4, last_activity_at = $5, last_heartbeat_at = NOW(), updated_at = NOW()`, [conversationId, customerEmail, storeId || null, safeStatus, lastActivityAt || new Date()]);
    if (safeStatus === 'online') cancelPendingEmail(conversationId);
    res.json({ ok: true });
  } catch (error) { console.error('[Presence REST] Error:', error); res.status(500).json({ error: 'Failed to update presence' }); }
});

// ============ BLACKLIST ============

app.post('/api/blacklist', authenticateToken, async (req, res) => {
  const { email, storeIdentifier, allStores = false, reason = null, customerName = null } = req.body;

  if (!email || typeof email !== 'string' || !email.includes('@'))
    return res.status(400).json({ error: 'Valid email is required' });

  const normalizedEmail = email.toLowerCase().trim();
  const normalizedStore = allStores ? null : (storeIdentifier || null);
  const blockedBy       = req.user?.name || req.user?.email || null;

  try {
    const result = await db.pool.query(
      `INSERT INTO blacklist
               (email, store_identifier, reason, customer_name, blocked_by, created_at, removed_at)
        VALUES ($1,    $2,               $3,     $4,            $5,         NOW(),       NULL)
        ON CONFLICT (email, store_identifier)
        DO UPDATE
           SET reason        = EXCLUDED.reason,
               customer_name = EXCLUDED.customer_name,
               blocked_by    = EXCLUDED.blocked_by,
               created_at    = NOW(),
               removed_at    = NULL
      RETURNING *`,
      [normalizedEmail, normalizedStore, reason, customerName, blockedBy]
    );

    let convUpdate;
    if (allStores) {
      convUpdate = await db.pool.query(
        `UPDATE conversations
            SET status     = 'blacklisted',
                updated_at = NOW()
          WHERE customer_email = $1
            AND status NOT IN ('archived', 'blacklisted')
          RETURNING id`,
        [normalizedEmail]
      );
    } else {
      convUpdate = await db.pool.query(
        `UPDATE conversations
            SET status     = 'blacklisted',
                updated_at = NOW()
          WHERE customer_email = $1
            AND status NOT IN ('archived', 'blacklisted')
            AND shop_domain = $2
          RETURNING id`,
        [normalizedEmail, normalizedStore]
      );
    }

    convUpdate.rows.forEach(row => {
      broadcastToAgents({
        type:           'conversation_blacklisted',
        conversationId: row.id,
        email:          normalizedEmail,
      });
    });

    console.log(`🚫 [Blacklist] ${normalizedEmail} blacklisted ${allStores ? 'network-wide' : `on ${normalizedStore}`} by ${blockedBy} — ${convUpdate.rowCount} conv(s) marked`);
    return res.status(201).json(snakeToCamel(result.rows[0]));
  } catch (err) {
    console.error('❌ [blacklist create] Error:', err);
    return res.status(500).json({ error: 'Failed to blacklist customer' });
  }
});

app.get('/api/blacklist', authenticateToken, async (req, res) => {
  const page            = Math.max(1, parseInt(req.query.page)  || 1);
  const limit           = Math.min(200, parseInt(req.query.limit) || 50);
  const offset          = (page - 1) * limit;
  const storeIdentifier = req.query.storeIdentifier || null;
  const emailSearch     = req.query.email           || null;

  try {
    const params  = [limit, offset];
    const filters = ['b.removed_at IS NULL'];

    if (storeIdentifier) {
      params.push(storeIdentifier);
      filters.push(`(b.store_identifier = $${params.length} OR b.store_identifier IS NULL)`);
    }
    if (emailSearch) {
      params.push(`%${emailSearch.toLowerCase()}%`);
      filters.push(`b.email ILIKE $${params.length}`);
    }

    const where = `WHERE ${filters.join(' AND ')}`;
    const { rows } = await db.pool.query(
      `SELECT b.*, COUNT(*) OVER() AS total_count
         FROM blacklist b
        ${where}
        ORDER BY b.created_at DESC
        LIMIT $1 OFFSET $2`,
      params
    );

    const total = rows.length ? parseInt(rows[0].total_count) : 0;
    return res.json({
      entries: rows.map(r => { const row = { ...r }; delete row.total_count; return snakeToCamel(row); }),
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (err) {
    console.error('❌ [blacklist list] Error:', err);
    return res.status(500).json({ error: 'Failed to fetch blacklist' });
  }
});

/**
 * DELETE /api/blacklist/:id
 * Soft-delete (un-blacklist) by row ID.
 *
 * UPDATED: also restores conversations.status → 'open' and broadcasts
 * 'conversation_unblacklisted' WS event so the inbox re-shows them live.
 */
app.delete('/api/blacklist/:id', authenticateToken, async (req, res) => {
  try {
    // 1. Fetch entry first so we have the email + store scope
    const lookup = await db.pool.query(
      `SELECT email, store_identifier FROM blacklist
        WHERE id = $1 AND removed_at IS NULL`,
      [parseInt(req.params.id)]
    );
    if (lookup.rowCount === 0)
      return res.status(404).json({ error: 'Blacklist entry not found or already removed' });

    const { email, store_identifier } = lookup.rows[0];

    // 2. Soft-delete the blacklist entry
    const result = await db.pool.query(
      `UPDATE blacklist
          SET removed_at = NOW()
        WHERE id = $1
          AND removed_at IS NULL
      RETURNING *`,
      [parseInt(req.params.id)]
    );

    // 3. Restore conversations back to 'open'.
    //    store_identifier = NULL  → was a network-wide block, restore all stores.
    //    conversations table uses shop_domain (NOT store_identifier).
    let restored;
    if (store_identifier) {
      restored = await db.pool.query(
        `UPDATE conversations
            SET status     = 'open',
                updated_at = NOW()
          WHERE customer_email = $1
            AND status = 'blacklisted'
            AND shop_domain = $2
          RETURNING id`,
        [email, store_identifier]
      );
    } else {
      restored = await db.pool.query(
        `UPDATE conversations
            SET status     = 'open',
                updated_at = NOW()
          WHERE customer_email = $1
            AND status = 'blacklisted'
          RETURNING id`,
        [email]
      );
    }

    // 4. Broadcast so every agent's inbox re-shows the conversations live.
    //    This fires regardless of which UI path triggered the removal.
    restored.rows.forEach(row => {
      broadcastToAgents({
        type:           'conversation_unblacklisted',
        conversationId: row.id,
        email,
      });
    });

    console.log(`✅ [Blacklist] Entry #${req.params.id} removed by ${req.user.email} — ${restored.rowCount} conversation(s) restored`);
    return res.json({
      success:               true,
      entry:                 snakeToCamel(result.rows[0]),
      restoredConversations: restored.rowCount,
    });
  } catch (err) {
    console.error('❌ [blacklist delete] Error:', err);
    return res.status(500).json({ error: 'Failed to remove blacklist entry' });
  }
});

/**
 * GET /api/blacklist/check
 * Query: email (required), storeIdentifier (optional)
 * UNCHANGED
 */
app.get('/api/blacklist/check', authenticateToken, async (req, res) => {
  const { email, storeIdentifier } = req.query;
  if (!email) return res.status(400).json({ error: 'email query param is required' });

  try {
    const { rows } = await db.pool.query(
      `SELECT * FROM blacklist
        WHERE email       = $1
          AND removed_at  IS NULL
          AND (store_identifier IS NULL OR store_identifier = $2)
        LIMIT 1`,
      [email.toLowerCase().trim(), storeIdentifier || null]
    );

    if (rows.length) return res.json({ blocked: true,  entry: snakeToCamel(rows[0]) });
    return res.json({ blocked: false, entry: null });
  } catch (err) {
    console.error('❌ [blacklist check] Error:', err);
    return res.status(500).json({ error: 'Failed to check blacklist' });
  }
});

// ============ END BLACKLIST ============

// ============ AI STYLE FINGERPRINTING ============

function extractAdminStyle(chatHistory, agentStyleSamples = []) {
  let agentLines = agentStyleSamples.filter(s => s && s.trim().length > 8);
  if (agentLines.length === 0 && chatHistory) {
    agentLines = chatHistory.split('\n').filter(line => line.startsWith('Agent:')).map(line => line.replace(/^Agent:\s*/, '').trim()).filter(line => line.length > 8);
  }
  if (agentLines.length === 0) return null;
  const allText = agentLines.join(' ');
  const avgWords = Math.round(agentLines.reduce((sum, l) => sum + l.split(/\s+/).filter(Boolean).length, 0) / agentLines.length);
  const lengthStyle = avgWords <= 12 ? 'very short (under 12 words)' : avgWords <= 25 ? 'short (12–25 words)' : avgWords <= 55 ? 'medium (25–55 words)' : 'long (55+ words)';
  const greetingLines = agentLines.filter(l => /^(hi|hey|hello|heya|sup)\b/i.test(l.trim()));
  const greetingRatio = greetingLines.length / agentLines.length;
  const greetingNote = greetingRatio >= 0.3 ? `often opens with "${greetingLines[0].split(' ')[0]}" — do the same` : 'usually jumps straight into the reply without a greeting — do the same';
  const lowercaseLines = agentLines.filter(l => /[a-z]/.test(l) && l === l.toLowerCase());
  const writesLowercase = lowercaseLines.length / agentLines.length >= 0.4;
  const exclamationCount = (allText.match(/!/g) || []).length;
  const usesExclamation = exclamationCount / agentLines.length >= 0.4;
  const usesEllipsis = /\.{2,}|…/.test(allText);
  const usesEmoji = /[\u{1F300}-\u{1FFFF}]/u.test(allText);
  const emojiMatches = allText.match(/[\u{1F300}-\u{1FFFF}]/gu) || [];
  const contractions = (allText.match(/\b(i'm|i'll|i've|i'd|we're|we'll|we've|don't|can't|won't|it's|that's|you're|you'll|they're|there's|let's|isn't|wasn't|didn't|couldn't|wouldn't|shouldn't)\b/gi) || []).length;
  const usesContractions = contractions / agentLines.length >= 0.5;
  const vocab = {
    usesJust: /\bjust\b/i.test(allText), usesActually: /\bactually\b/i.test(allText), usesAlright: /\balright\b|\baight\b/i.test(allText),
    usesTotally: /\btotally\b/i.test(allText), usesPerfect: /\bperfect\b/i.test(allText), usesGotIt: /\bgot it\b|\bgotcha\b/i.test(allText),
    usesNoProblem: /\bno problem\b|\bnp\b|\bno worries\b/i.test(allText), usesAbsolutely: /\babsolutely\b/i.test(allText),
    usesSure: /\bsure\b/i.test(allText), usesYep: /\byep\b|\byup\b/i.test(allText),
  };
  const signoffs = { lmk: /\blmk\b|let me know/i.test(allText), reachOut: /reach out|feel free/i.test(allText),
    thankYou: /\bthank you\b/i.test(allText), thanks: /\bthanks[!.]?\s*$/im.test(allText),
    cheers: /\bcheers\b/i.test(allText), takecare: /\btake care\b/i.test(allText) };
  const empathyPatterns = [/so sorry/i, /really sorry/i, /apologize/i, /totally understand/i, /completely understand/i, /i get it/i, /makes sense/i, /that's frustrating/i, /that sucks/i, /not okay/i, /not right/i, /we messed up/i, /our fault/i, /my bad/i];
  const empathyPhrases = empathyPatterns.filter(p => p.test(allText)).map(p => p.source.replace(/\\/g, '').replace(/\\b/g, ''));
  const avgSentences = agentLines.reduce((sum, l) => sum + (l.match(/[.!?]+/g) || []).length, 0) / agentLines.length;
  const writesSingleSentence = avgSentences <= 1.3;
  const writesMultipleSentences = avgSentences >= 2.5;
  const phraseMap = {};
  agentLines.forEach(line => {
    const words = line.toLowerCase().split(/\s+/).filter(Boolean);
    for (let i = 0; i < words.length - 1; i++) {
      const bigram = `${words[i]} ${words[i + 1]}`;
      if (!/^(the |a |an |to |of |in |is |it |at |on |be |by |do |go )/.test(bigram)) phraseMap[bigram] = (phraseMap[bigram] || 0) + 1;
    }
  });
  const recurringPhrases = Object.entries(phraseMap).filter(([, count]) => count >= 2).sort(([, a], [, b]) => b - a).slice(0, 5).map(([phrase]) => phrase);
  const sampleLines = agentLines.filter(l => l.split(/\s+/).length >= 5).slice(-8);
  return { avgWords, lengthStyle, greetingNote, greetingRatio, writesLowercase, usesExclamation, usesEllipsis,
    usesEmoji, emojiMatches: emojiMatches.slice(0, 3), usesContractions, vocab, signoffs, empathyPhrases,
    writesSingleSentence, writesMultipleSentences, recurringPhrases, sampleLines, totalSamplesAnalyzed: agentLines.length };
}

function buildAdminStyleBlock(style) {
  if (!style) return '';
  const rules = [];
  rules.push(`Match the agent's message length: ${style.lengthStyle} per reply.`);
  rules.push(`The agent ${style.greetingNote}.`);
  if (style.writesLowercase) rules.push(`The agent often writes in lowercase — mirror that. Don't correct their casing style.`);
  if (style.usesContractions) rules.push(`Use contractions freely (I'll, we'll, don't, it's, you're) — the agent does.`);
  else rules.push(`Avoid contractions — the agent writes without them.`);
  if (style.usesExclamation) rules.push(`Use exclamation marks naturally — the agent uses them to sound warm and enthusiastic.`);
  else rules.push(`Don't use exclamation marks — the agent keeps an even, calm tone.`);
  if (style.usesEllipsis) rules.push(`The agent uses ellipses (…) as a natural pause or trail-off. Mirror this sparingly.`);
  if (style.usesEmoji && style.emojiMatches.length > 0) rules.push(`The agent uses emoji: ${style.emojiMatches.join(' ')} — use these same ones where natural.`);
  if (style.writesSingleSentence) rules.push(`The agent usually writes in single sentences. Keep replies tight and punchy.`);
  else if (style.writesMultipleSentences) rules.push(`The agent writes in multi-sentence paragraphs — match that flow.`);
  const casualWords = Object.entries(style.vocab).filter(([, v]) => v).map(([k]) => k.replace('uses', '').replace('Uses', '').toLowerCase()).filter(w => w.length > 1);
  if (casualWords.length > 0) rules.push(`The agent naturally uses words like: "${casualWords.join('", "')}". Use them where they fit.`);
  if (style.signoffs.lmk) rules.push(`End with "let me know" or "lmk" when inviting a response.`);
  else if (style.signoffs.reachOut) rules.push(`Close with "feel free to reach out" or similar — the agent uses this.`);
  else if (style.signoffs.cheers) rules.push(`The agent signs off with "cheers" — use this where appropriate.`);
  else if (style.signoffs.takecare) rules.push(`The agent uses "take care" as a sign-off.`);
  if (style.empathyPhrases.length > 0) rules.push(`When empathy is needed, use phrasing close to what the agent actually says: "${style.empathyPhrases.slice(0, 3).join('", "')}".`);
  if (style.recurringPhrases.length > 0) rules.push(`The agent habitually uses these phrases — weave them in naturally: "${style.recurringPhrases.join('", "')}".`);
  const sampleBlock = style.sampleLines.length > 0 ? `\nREAL MESSAGES from this agent — match this exact voice, rhythm, and vocabulary:\n${style.sampleLines.map(l => `  • "${l}"`).join('\n')}` : '';
  return `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ADMIN WRITING STYLE — mirror this precisely (non-negotiable)
Based on ${style.totalSamplesAnalyzed} real messages from this agent.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${rules.map((r, i) => `${i + 1}. ${r}`).join('\n')}
${sampleBlock}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`;
}

// ============ IMAGE ANALYSIS ENDPOINT ============

app.post('/api/ai/analyze-image', authenticateToken, async (req, res) => {
  try {
    const { image, conversationId, storeIdentifier } = req.body;
    if (!image?.base64 || !image?.mimeType) return res.status(400).json({ error: 'image.base64 and image.mimeType are required' });
    const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (!ALLOWED_TYPES.includes(image.mimeType)) return res.status(400).json({ error: 'Unsupported image type. Use JPEG, PNG, GIF, or WebP.' });
    const approxBytes = (image.base64.length * 3) / 4;
    if (approxBytes > 5 * 1024 * 1024) return res.status(400).json({ error: 'Image exceeds 5 MB limit.' });
    const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
    if (!ANTHROPIC_API_KEY) return res.status(500).json({ error: 'AI not configured (missing ANTHROPIC_API_KEY)' });
    console.log(`🖼️  [ImageAnalysis] conv=${conversationId} type=${image.mimeType} approxKB=${Math.round(approxBytes / 1024)}`);
    let storeContext = '';
    if (storeIdentifier) {
      try { const store = await db.getStoreByIdentifier(storeIdentifier); if (store?.brand_name) storeContext = ` for ${store.brand_name}`; }
      catch (_) {}
    }
    const requestBody = JSON.stringify({ model: 'claude-sonnet-4-6', max_tokens: 1024, messages: [{ role: 'user', content: [
    { type: 'image', source: { type: 'base64', media_type: image.mimeType, data: image.base64 } },
    { type: 'text', text: `You are a customer support assistant analyzing a screenshot uploaded by a support agent${storeContext}. Extract and report EVERYTHING visible in this image so the agent can write a precise, accurate reply to the customer.\n\nRead the ENTIRE screenshot carefully and extract:\n\n1. SCREEN TYPE — What kind of screen is this? (order confirmation, tracking page, error message, product page, payment screen, account page, chat/email, invoice, etc.)\n\n2. ALL VISIBLE TEXT — Extract every piece of text you can read: headings, labels, values, statuses, messages, error text, button labels, dates, times, prices, quantities, addresses, names, email addresses, phone numbers, reference numbers, order IDs, tracking numbers, product names, SKUs, descriptions — everything.\n\n3. KEY DATA POINTS — Specifically call out:\n   - Order/reference numbers (exact format, e.g. #1001, ORD-12345)\n   - Order status (pending, fulfilled, shipped, cancelled, refunded, etc.)\n   - Payment status and amounts (exact dollar figures)\n   - Tracking numbers and carrier names\n   - Shipping/delivery dates or estimated dates\n   - Product names, quantities, sizes, variants\n   - Customer name and email if visible\n   - Any error messages or warning text (copy exactly)\n   - Any action items, buttons, or options shown\n\n4. WHAT ISSUE THIS RELATES TO — Based on what you see, what is the customer's likely concern or question?\n\nWrite your response as a clear, structured report. Include every specific value — exact numbers, exact text, exact statuses. Do not summarize or paraphrase data — reproduce it exactly as shown. Plain text only, no markdown.` }
    ]}]});
    const data = await callAnthropicAPIWithRetry(requestBody, ANTHROPIC_API_KEY);
    const analysis = data.content?.[0]?.text || '';
    console.log(`🖼️  [ImageAnalysis] Done — ${analysis.length} chars`);
    return res.json({ analysis });
  } catch (err) { console.error('🖼️  [ImageAnalysis] Error:', err.message); return res.status(500).json({ error: 'Image analysis failed', message: err.message }); }
});

// ============ AI SUGGESTIONS — SINGLE ROUTE ============

app.post('/api/ai/suggestions', authenticateToken, async (req, res) => {
  try {
    const {
      clientMessage, chatHistory, agentStyleSamples = [], recentContext,
      customerName, customerEmail, storeName, analysis, adminNote,
      messageEdited, detailedAnswerMode, adminImage, imageAnalysis,
    } = req.body;

    let brainSettings = req.body.brainSettings || {};
    if (!clientMessage) return res.status(400).json({ error: 'clientMessage is required' });

    const contextQuality  = recentContext?.contextQuality  || 'minimal';
    const messageRichness = recentContext?.messageRichness || 'brief';
    console.log(`✦ [AI] context: ${contextQuality}, richness: ${messageRichness}, agentSamples: ${agentStyleSamples.length}, detailedMode: ${!!detailedAnswerMode}, imageAnalysis: ${!!imageAnalysis}`);

    const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
    if (!ANTHROPIC_API_KEY) {
      const fallback = generateSmartFallbackSuggestions(clientMessage, chatHistory, analysis, adminNote);
      if (detailedAnswerMode) return res.json({ detailedAnswers: [{ label: 'Empathetic', text: fallback[0] || '' }, { label: 'Thorough', text: fallback[1] || '' }, { label: 'Above & Beyond', text: fallback[2] || '' }] });
      return res.json({ suggestions: fallback });
    }

    const conversationState = analyzeConversationState(chatHistory, clientMessage, analysis);
    const analysisBlock     = buildEnhancedAnalysisBlock(analysis, conversationState, recentContext);
    const customerContext   = buildCustomerContext(customerName, customerEmail, conversationState);
    const policyBlock       = buildPolicyBlock();

    const adminStyle      = extractAdminStyle(chatHistory, agentStyleSamples);
    const adminStyleBlock = buildAdminStyleBlock(adminStyle);
    if (adminStyle) console.log(`✦ [AI] Style: avg ${adminStyle.avgWords}w, ${adminStyle.sampleLines.length} samples, lowercase:${adminStyle.writesLowercase}`);
    else console.log(`✦ [AI] No style yet — not enough agent replies`);

    const detectedTopics   = analysis?.detectedTopics || [];
    const detectedIssue    = analysis?.detectedIssue || recentContext?.detectedIssue || '';
    const brainSearchTerms = clientMessage;

    let brainContext = '';
    try {
      brainContext = await getBrainContext(db.pool, brainSearchTerms);
      console.log(`🧠 [Brain] ${brainContext.length} chars for: "${brainSearchTerms.substring(0, 80)}"`);
      if (!brainSettings.length && !brainSettings.tone && !brainSettings.empathy) brainSettings = await getBrainSettings(db.pool);
    } catch (brainErr) { console.error('🧠 [Brain] Failed:', brainErr.message); }

    const brainUserBlock = brainContext?.trim() ? `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\nANSWER FROM BRAIN — BUILD YOUR REPLIES FROM THIS DATA FIRST\nIf the answer to the customer's question exists below, use it immediately.\nDo NOT say "let me check" or "let me get back to you" when the data is here.\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n${brainContext}\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` : '';

    if (detailedAnswerMode) {
      const brainSystemSection = brainContext?.trim() ? `\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\nBRAIN RULES — READ FIRST. Override all other guidelines.\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n${brainContext}\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\nUse brain data as the ONLY source of truth for product info, protocols, dosing, and policies.\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` : '';
      const imageSystemSection = imageAnalysis?.trim() ? `\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\nSCREENSHOT CONTEXT — uploaded by the agent:\n${imageAnalysis.trim()}\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` : '';
      const systemPrompt = `${brainSystemSection}${imageSystemSection}${adminStyleBlock ? `${adminStyleBlock}\n\n` : ''}You are ghostwriting detailed replies for a human support agent. All three styles must sound like the SAME person.\n\nWrite three distinct, highly detailed replies (8–15 sentences each) in flowing paragraphs. No bullet points. Use real values from the conversation only.\n\n${policyBlock ? `Policies:\n${policyBlock}\n` : ''}${customerContext ? `Customer context:\n${customerContext}\n` : ''}${analysisBlock ? `Conversation analysis:\n${analysisBlock}\n` : ''}\nEmpathetic: Deep emotional validation first, then full answer with warmth.\nThorough: Every product detail, step, policy, and expectation. Nothing unanswered.\nAbove & Beyond: Everything in Thorough plus extras — tips, related products, follow-up offer.\n\nReturn ONLY valid JSON:\n{\n  "detailedAnswers": [\n    { "label": "Empathetic",     "text": "..." },\n    { "label": "Thorough",       "text": "..." },\n    { "label": "Above & Beyond", "text": "..." }\n  ]\n}`;
      const userPrompt = `${brainUserBlock}Conversation history:\n${chatHistory || '(none)'}\n\nCustomer's message:\n${clientMessage}${adminNote ? `\nAdmin note: ${adminNote}` : ''}\n\nWrite 3 detailed replies. Return only the JSON.`;
      const requestBody = JSON.stringify({ model: 'claude-sonnet-4-6', max_tokens: 4000, temperature: 0.5, system: systemPrompt, messages: [{ role: 'user', content: userPrompt }] });
      const anthropicData = await callAnthropicAPIWithRetry(requestBody, ANTHROPIC_API_KEY);
      const rawContent = anthropicData.content?.[0]?.text || '';
      console.log(`✦ [AI] Detailed raw (first 300): ${rawContent.substring(0, 300)}`);
      let parsed;
      try { parsed = JSON.parse(rawContent.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim()); }
      catch {
        const fallback = generateSmartFallbackSuggestions(clientMessage, chatHistory, analysis, adminNote);
        return res.json({ detailedAnswers: [{ label: 'Empathetic', text: fallback[0] || rawContent }, { label: 'Thorough', text: fallback[1] || rawContent }, { label: 'Above & Beyond', text: fallback[2] || rawContent }], fallback: true });
      }
      const detailedAnswers = Array.isArray(parsed.detailedAnswers) ? parsed.detailedAnswers.slice(0, 3) : [{ label: 'Empathetic', text: rawContent }, { label: 'Thorough', text: rawContent }, { label: 'Above & Beyond', text: rawContent }];
      return res.json({ detailedAnswers });
    }

const systemPrompt = buildSystemPrompt(
    storeName, customerContext, analysisBlock, policyBlock,
    contextQuality, messageRichness, brainContext, brainSettings,
    adminStyleBlock, imageAnalysis,
    conversationState?.sentiment || analysis?.sentiment || 'neutral'
    );
const userPrompt   = buildUserPrompt(chatHistory, clientMessage, messageEdited, adminNote, conversationState, recentContext, brainContext, imageAnalysis || '');
const requestBody  = JSON.stringify({ model: 'claude-sonnet-4-6', max_tokens: 2500, temperature: 0.3, system: systemPrompt, messages: [{ role: 'user', content: userPrompt }] });

    console.log(`✦ [AI] Calling Anthropic — brain: ${brainContext.length}c, style: ${adminStyleBlock.length}c, image: ${!!imageAnalysis}`);
    const anthropicData = await callAnthropicAPIWithRetry(requestBody, ANTHROPIC_API_KEY);
    const rawContent    = anthropicData.content?.[0]?.text || '';
    console.log(`✦ [AI] Raw (first 300): ${rawContent.substring(0, 300)}`);

    let parsed;
    try { parsed = JSON.parse(rawContent.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim()); }
    catch {
      console.error('✦ [AI] JSON parse failed. Raw:', rawContent.substring(0, 500));
      return res.json({ suggestions: generateSmartFallbackSuggestions(clientMessage, chatHistory, analysis, adminNote), fallback: true });
    }

    let suggestions = Array.isArray(parsed.suggestions) ? parsed.suggestions.slice(0, 3) : Array.isArray(parsed) ? parsed.slice(0, 3) : generateSmartFallbackSuggestions(clientMessage, chatHistory, analysis, adminNote);
    console.log(`✦ [AI] BEFORE VALIDATE (${suggestions.length}):`, JSON.stringify(suggestions));
    suggestions = validateSuggestions(suggestions, conversationState, chatHistory);
    console.log(`✦ [AI] AFTER VALIDATE (${suggestions.length}):`, JSON.stringify(suggestions));
    if (suggestions.length === 0) { console.log('✦ [AI] All suggestions filtered — using fallback'); suggestions = generateSmartFallbackSuggestions(clientMessage, chatHistory, analysis, adminNote); }
    res.json({ suggestions });

  } catch (error) {
    console.error('✦ [AI] Endpoint error:', error.message, error.stack);
    if (req.body?.detailedAnswerMode) {
      const fallback = generateSmartFallbackSuggestions(req.body?.clientMessage || '', req.body?.chatHistory || '', req.body?.analysis || {}, req.body?.adminNote || '');
      return res.json({ detailedAnswers: [{ label: 'Empathetic', text: fallback[0] || 'Unable to generate.' }, { label: 'Thorough', text: fallback[1] || 'Unable to generate.' }, { label: 'Above & Beyond', text: fallback[2] || 'Unable to generate.' }], fallback: true });
    }
    res.json({ suggestions: generateSmartFallbackSuggestions(req.body?.clientMessage || '', req.body?.chatHistory || '', req.body?.analysis || {}, req.body?.adminNote || ''), fallback: true });
  }
});

app.get('/api/ai/brain-debug', authenticateToken, async (req, res) => {
  try {
    const result = await db.pool.query(`SELECT brain_data, updated_at FROM ai_training_brain ORDER BY updated_at DESC LIMIT 1`);
    if (!result.rows.length) return res.json({ status: 'empty', message: 'No brain data in database' });
    const brain = result.rows[0].brain_data; const updatedAt = result.rows[0].updated_at;
    const summary = {}; for (const [key, val] of Object.entries(brain || {})) summary[key] = Array.isArray(val) ? val.length : typeof val;
    const productSample = (brain?.productKnowledge || []).slice(0, 3).map(r => typeof r === 'string' ? r : r?.text);
    return res.json({ status: 'found', updatedAt, categorySummary: summary, productKnowledgeSample: productSample, totalCategories: Object.keys(brain || {}).length });
  } catch (err) { return res.status(500).json({ error: err.message }); }
});

app.post('/api/ai/brain-cache/clear', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin access required' });
    refreshBrainCache();
    return res.json({ ok: true, message: 'Brain cache cleared — next request will reload from DB' });
  } catch (err) { return res.status(500).json({ error: err.message }); }
});

// ============ PROMPT BUILDER FUNCTIONS ============

function buildSystemPrompt(storeName, customerContext, analysisBlock, policyBlock, contextQuality, messageRichness, brainContext = '', brainSettings = {}, adminStyleBlock = '', imageAnalysis = '', sentiment = 'neutral') {
  const hasBrain = brainContext && brainContext.trim().length > 0;
  const brainBlock = hasBrain ? `\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\nBRAIN RULES — READ THIS BEFORE ANYTHING ELSE\nMandatory store-owner instructions. Override ALL other guidelines.\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n${brainContext}\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\nCRITICAL BRAIN ENFORCEMENT:\n1. If the customer is asking about a product, protocol, dosing, or anything the brain rules cover — ANSWER IT NOW. Do NOT say "let me check".\n2. Only stall when the brain does NOT contain the answer AND you genuinely need external info (order status, tracking, account details).\n3. Do NOT cross-apply one product's rule to another.\n4. ALL 3 suggestions must use exact values from the matching brain rule.\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` : '';
  const imageBlock = imageAnalysis && imageAnalysis.trim() ? `\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\nSCREENSHOT DATA — full analysis of the agent's uploaded image\nAll values below are CONFIRMED FACTS extracted from the screenshot.\nReference exact order numbers, statuses, amounts, dates, and names directly in replies.\nDo NOT ask for information that is already visible in this screenshot.\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n${imageAnalysis.trim()}\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` : '';
  const styleSection = adminStyleBlock ? `${adminStyleBlock}\n` : '';
  let contextGuidance = '';
  if (!hasBrain) {
    if (contextQuality === 'minimal') contextGuidance = messageRichness === 'very_brief' || messageRichness === 'brief' ? `⚠️ FIRST BRIEF MESSAGE — greet and ask what they need. Don't assume.` : `ℹ️ DETAILED FIRST MESSAGE — address their concern directly. Ask only for missing critical info.`;
    else if (contextQuality === 'basic') contextGuidance = `ℹ️ BASIC CONTEXT — build on what's been discussed.`;
    else if (contextQuality === 'good') contextGuidance = `✓ GOOD CONTEXT — avoid repeating what's been asked. Move toward resolution.`;
    else if (contextQuality === 'excellent') contextGuidance = `✓ EXCELLENT CONTEXT — customer may be losing patience. Be efficient.`;
  } else {
    contextGuidance = contextQuality === 'minimal' ? `ℹ️ FIRST MESSAGE: Answer what you can from brain rules directly. Only ask follow-up questions for things the brain rules don't cover.` : `✓ Use conversation history + brain rules to give a complete, specific answer.`;
  }

  const len = brainSettings.length || 'medium';
  const tone = brainSettings.tone || 'friendly-professional';
  const empathy = brainSettings.empathy || 'high';

  const isComplexComplaint = messageRichness === 'very_detailed' &&
    (sentiment === 'very_negative' || sentiment === 'negative');
  const lengthRule = len === 'long'
    ? isComplexComplaint
      ? `5–7 sentences. Multi-issue complaint — acknowledge adverse reactions or most critical issue first, then cover order issues and resolution. MAX 140 words per suggestion.`
      : `4–5 sentences. Thorough but concise — cover issue, resolution, and reassurance. MAX 90 words per suggestion.`
    : len === 'short' ? `1–2 sentences. One clear action per reply. MAX 35 words per suggestion.`
    :                   `2–3 sentences. Specific and actionable. MAX 60 words per suggestion.`;

  const toneRule   = tone === 'formal' ? `Formal, professional. No contractions.`
                   : tone === 'casual' ? `Casual, conversational. Contractions encouraged.`
                   :                    `Friendly-professional — warm but not overly casual.`;

  const empathyRule = empathy === 'high' ? `Lead with empathy before solutions.`
                    : empathy === 'low'  ? `Skip empathy preambles. Get straight to the solution.`
                    :                     `Brief empathy acknowledgment, then solution.`;

  const qualityBlock = `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\nREPLY QUALITY (admin-set — non-negotiable):\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\nLENGTH:  ${lengthRule}\nTONE:    ${toneRule}\nEMPATHY: ${empathyRule}`;

  return `${brainBlock}${imageBlock}${styleSection}You are ghostwriting replies for a specific human support agent at ${storeName || 'this store'}. The customer must feel like they are talking to the same knowledgeable person every time.\n\n${qualityBlock}\n\n${contextGuidance}\n\n${customerContext}\n\n${analysisBlock}\n\n${policyBlock}\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\nCORE RULES:\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n1. Every suggestion MUST reference specific details — product names, the customer's stated goal, issue described, or something they actually said. Generic replies are not acceptable.\n2. NEVER say "let me check", "let me find out", or "let me get back to you" when the brain rules already contain the answer.\n3. NEVER say "let me check" for general product/knowledge questions. Only use it for real-time lookups (order status, tracking, account balance).\n4. Never ask for information already provided. Never repeat what the agent already said.\n5. Vary the 3 suggestions — different angles, not the same reply reworded:\n   - Suggestion 1: Direct, complete answer using brain knowledge\n   - Suggestion 2: Same answer with different emphasis or additional context\n   - Suggestion 3: Answer + a natural follow-up or next step\n6. Match the customer's emotional state.\n7. Never use: "I understand your frustration", "I apologize for any inconvenience", "Please be advised", "Kindly", "As per our policy", "That\'s a great question".\n8. No promises on timeframes or amounts unless confirmed.\n9. CRITICAL — JSON LIMIT: Each suggestion string must be short enough to fit inside a JSON value. Never write a suggestion that exceeds the word limit in rule LENGTH above. If you are tempted to write more, cut it — a truncated JSON response causes a complete failure.\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\nRespond ONLY with valid JSON: {"suggestions": ["reply 1", "reply 2", "reply 3"]}`;
}

function buildUserPrompt(chatHistory, clientMessage, messageEdited, adminNote, conversationState, recentContext, brainContext = '', imageAnalysis = '') {
  const msgLower = clientMessage.toLowerCase();
  const isKnowledgeQuestion = /recommend|suggest|best for|good for|help with|goal|looking for|want to|trying to|lose weight|weight loss|fat loss|burn fat|muscle|build|anti.?aging|healing|recovery|sleep|energy|libido|cognitive|focus|what (peptide|product|should)|which (peptide|product)|what do you (have|offer|carry|sell)|how does|how do|what is|tell me about|explain|difference between|compare|dosing|dose|protocol|reconstitut/i.test(msgLower);
  const isOrderQuestion = /order|tracking|shipped|delivery|refund|return|cancel|charge|payment|where is|status|when will/i.test(msgLower);
  const questionType = isKnowledgeQuestion && !isOrderQuestion ? 'PRODUCT/KNOWLEDGE — answer directly from brain data below. Do NOT stall.' : isOrderQuestion ? 'ORDER/ACCOUNT — may need lookup. Ask for order number if not provided.' : 'GENERAL — use brain data if applicable.';
  const brainBlock = brainContext?.trim() ? `\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\nANSWER FROM BRAIN — USE THIS DATA TO WRITE YOUR REPLIES\nThis is the store's knowledge base. Your replies must come from here first.\nIf the answer to the customer's question exists below, use it immediately.\nDo NOT say "let me check" or "let me get back to you" when the data is here.\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n${brainContext}\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` : '';
  const imageBlock = imageAnalysis?.trim() ? `\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\nSCREENSHOT DATA — complete analysis of the agent's uploaded image\nThese are CONFIRMED FACTS from the screenshot. Use them directly in replies.\nDo NOT ask for any information already visible here. Reference exact values.\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n${imageAnalysis.trim()}\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` : '';
  const signals = [`QUESTION TYPE: ${questionType}`];
  if (conversationState?.orderNumber)   signals.push(`Order number: #${conversationState.orderNumber}`);
  if (conversationState?.customerEmail && conversationState.customerEmail !== 'unknown') signals.push(`Customer email: ${conversationState.customerEmail}`);
  const issue = conversationState?.detectedIssue || recentContext?.detectedIssue;
  if (issue) signals.push(`Issue: ${issue.replace(/_/g, ' ')}`);
  const wants = conversationState?.customerWants || recentContext?.customerWants || {};
  const wantsList = Object.entries(wants).filter(([, v]) => v).map(([k]) => k.replace(/_/g, ' '));
  if (wantsList.length > 0) signals.push(`Customer wants: ${wantsList.join(', ')}`);
  if (conversationState?.sentiment && conversationState.sentiment !== 'neutral') signals.push(`Sentiment: ${conversationState.sentiment.replace(/_/g, ' ')}`);
  if (conversationState?.isUrgent) signals.push(`Urgent: yes`);
  if (conversationState?.isRepeat) signals.push(`REPEAT/FOLLOW-UP: already asked about this`);
  if (conversationState?.isWrongItem) signals.push(`WRONG ITEM SENT — do not ask for photo, acknowledge and arrange correct shipment immediately`);
  if (conversationState?.customerConfirmedAddress) signals.push(`Customer confirmed address is same as on order — do NOT ask for address again`);
  if (conversationState?.customerAskingForEmail) signals.push(`Customer is asking for an email address to send documents to — provide support email`);
  const alreadyDone = [];
  if (conversationState?.agentAskedForOrder)      alreadyDone.push('asked for order number');
  if (conversationState?.agentAskedForEmail)      alreadyDone.push('asked for email');
  if (conversationState?.agentAskedForPhoto)      alreadyDone.push('asked for photo');
  if (conversationState?.agentAlreadyApologized)  alreadyDone.push('apologized');
  if (conversationState?.agentOfferedRefund)       alreadyDone.push('offered refund');
  if (conversationState?.agentOfferedReplacement)  alreadyDone.push('offered replacement');
  if (alreadyDone.length > 0) signals.push(`Agent already: ${alreadyDone.join(', ')} — do NOT repeat`);
  const topics = conversationState?.detectedTopics || [];
  if (topics.length > 0) signals.push(`Topics: ${topics.join(', ')}`);
  if (messageEdited) signals.push(`Admin edited this message to guide suggestions`);
  if (imageAnalysis?.trim()) signals.push(`Screenshot provided — treat the screenshot content as the PRIMARY customer message. Generate replies based on what the screenshot shows, not the chat history.`);
  const lastAgent    = recentContext?.lastAgentMessages?.filter(Boolean).at(-1);
  const prevCustomer = recentContext?.lastCustomerMessages?.filter(Boolean).at(-2);
  const recentLines  = [];
  if (lastAgent)    recentLines.push(`Last agent reply: "${lastAgent}"`);
  if (prevCustomer) recentLines.push(`Previous customer message: "${prevCustomer}"`);
  const signalsBlock = `SIGNALS:\n${signals.map(s => `• ${s}`).join('\n')}`;
  const recentBlock  = recentLines.length > 0 ? `\nRECENT:\n${recentLines.join('\n')}` : '';
  const historyBlock = chatHistory ? `\nCONVERSATION HISTORY:\n${chatHistory}` : '';
  const noteBlock    = adminNote ? `\nADMIN NOTE: ${adminNote}` : '';
  return `${brainBlock}${imageBlock}${signalsBlock}${recentBlock}${historyBlock}\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\nCUSTOMER MESSAGE:\n${clientMessage}\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n${noteBlock}\n\nUsing the brain data${imageAnalysis?.trim() ? ' and the screenshot context' : ''} above as your primary source, write 3 specific replies for this customer. Keep each reply within the word limit. Return JSON only.`;
}


function buildEnhancedAnalysisBlock(analysis, conversationState, recentContext) {
  if (!analysis && !conversationState && !recentContext) return '';
  const lines = ['━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'CONVERSATION ANALYSIS (use this to inform your replies):', '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'];
  const richnessLabels = { 'very_detailed': '📝 VERY DETAILED MESSAGE - Customer provided extensive information, use it all', 'detailed': '📝 Detailed message - Good context to work with', 'brief': '💬 Brief message - May need to ask for more information', 'very_brief': '💬 Very brief message - Likely a greeting or need to ask follow-up questions' };
  if (recentContext?.messageRichness && richnessLabels[recentContext.messageRichness]) lines.push(richnessLabels[recentContext.messageRichness]);
  const issueLabels = { 'damaged': '📦 Issue Type: DAMAGED/BROKEN item - Offer replacement or refund', 'wrong_item': '📦 Issue Type: WRONG ITEM received - Apologize, offer replacement', 'missing': '📦 Issue Type: MISSING/NOT RECEIVED - Check tracking, offer reship or refund', 'late': '📦 Issue Type: LATE DELIVERY - Check tracking, explain delay', 'quality': '📦 Issue Type: QUALITY concerns - Gather details, offer refund or replacement' };
  if (recentContext?.detectedIssue) lines.push(issueLabels[recentContext.detectedIssue] || `📦 Issue: ${recentContext.detectedIssue}`);
  if (recentContext?.customerWants) {
    const wants = [];
    if (recentContext.customerWants.refund) wants.push('REFUND'); if (recentContext.customerWants.replacement) wants.push('REPLACEMENT');
    if (recentContext.customerWants.tracking) wants.push('TRACKING INFO'); if (recentContext.customerWants.help) wants.push('GENERAL HELP');
    if (wants.length > 0) lines.push(`🎯 Customer explicitly wants: ${wants.join(' or ')} - Address this directly`);
  }
  const orderNum = conversationState?.orderNumber || analysis?.orderNumber;
  if (orderNum) lines.push(`📦 Order Number: ${orderNum} — MUST reference this in your replies, DO NOT ask for it again`);
  if (conversationState?.productName) lines.push(`🏷️  Product: ${conversationState.productName} — Reference this specifically`);
  if (conversationState?.customerEmail && conversationState.customerEmail !== 'unknown') lines.push(`📧 Email: ${conversationState.customerEmail} — DO NOT ask for email again`);
  if (analysis?.detectedTopics?.length > 0) {
    const topicLabels = { order_status: 'Order Status / Tracking', refund_return: 'Refund / Return / Cancellation', product_issue: 'Product Issue / Damaged / Defective', payment: 'Payment / Billing', discount_promo: 'Discount / Promo Code', product_inquiry: 'Product Inquiry', shipping: 'Shipping Questions', account: 'Account Issue', complaint: 'Complaint / Escalation', gratitude: 'Customer Expressing Thanks', greeting: 'Greeting / Opening' };
    lines.push(`🏷️  Topics: ${analysis.detectedTopics.map(t => topicLabels[t] || t).join(', ')}`);
  }
  const sentimentLabels = { very_negative: '😡 VERY UPSET / ANGRY — Lead with strong empathy, show urgency', negative: '😟 FRUSTRATED / UNHAPPY — Acknowledge their concern with genuine empathy first', neutral: '😐 NEUTRAL — Be professional and efficient', positive: '😊 POSITIVE / FRIENDLY — Match their positive energy', very_positive: '🎉 VERY HAPPY / GRATEFUL — Be warm and brief' };
  if (analysis?.sentiment) lines.push(`${sentimentLabels[analysis.sentiment] || analysis.sentiment}`);
  if (analysis?.isUrgent || conversationState?.isEscalating) lines.push('⚠️  URGENT / ESCALATING — Respond with priority, use phrases like "right now" or "immediately"');
  if (analysis?.isRepeat || conversationState?.customerMessageCount >= 3) lines.push('🔁 CUSTOMER REPEATING / FOLLOWING UP — They feel unheard. Acknowledge the delay and take action NOW.');
  if (conversationState?.isLongConversation) lines.push(`⏰ LONG CONVERSATION (${conversationState.turnCount} messages) — Be efficient and solution-oriented.`);
  if (analysis?.isQuestion) lines.push('❓ Direct question asked — Answer it specifically, don\'t deflect');
  if (analysis?.hasAttachment || conversationState?.hasAttachment) lines.push('📎 Customer sent file/image — Acknowledge you\'ve reviewed it in your response');
  if (analysis?.agentAskedForOrder || conversationState?.agentAskedForOrder) lines.push('🚫 Agent ALREADY asked for order number — DO NOT ask again');
  if (analysis?.agentAskedForEmail || conversationState?.agentAskedForEmail) lines.push('🚫 Agent ALREADY asked for email — DO NOT ask again');
  if (analysis?.agentAskedForPhoto || conversationState?.agentAskedForPhoto) lines.push('🚫 Agent ALREADY asked for photo — DO NOT ask again');
  if (analysis?.agentAlreadyApologized || conversationState?.agentAlreadyApologized) lines.push('🚫 Agent ALREADY apologized — focus on action and solutions');
  if (analysis?.agentOfferedRefund) lines.push('💰 Agent already mentioned refund — Build on that, confirm next steps');
  if (analysis?.agentOfferedReplacement) lines.push('🔄 Agent already offered replacement — Build on that, confirm shipping details');
  const lastMsg = (analysis?.lastAgentText || conversationState?.lastAgentMessage || '').substring(0, 150);
  if (lastMsg) lines.push(`💬 Agent's last message: "${lastMsg}${lastMsg.length >= 150 ? '...' : ''}" — Don't repeat this`);
  return lines.length > 2 ? lines.join('\n') : '';
}

function buildCustomerContext(customerName, customerEmail, conversationState) {
  const lines = [`CUSTOMER: ${customerName || 'Guest'}${customerEmail ? ` (${customerEmail})` : ''}`];
  if (conversationState?.customerHistory) lines.push(`Customer History: ${conversationState.customerHistory.totalOrders || 0} previous orders`);
  return lines.join('\n');
}

function buildPolicyBlock() {
  return `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
BRAND VOICE & ESCALATION:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Brand Voice:
- Friendly but professional — never overly casual or use slang
- Empathetic without being robotic
- Action-oriented — always indicate next steps
- Transparent — if you don't know, say you'll find out

Auto-Escalation Triggers:
- Customer uses words like "lawyer", "sue", "fraud", "scam"
- Customer explicitly asks for manager/supervisor
- 3+ messages about same unresolved issue
- Very negative sentiment + repeat customer`;
}

function analyzeConversationState(chatHistory, clientMessage, analysis) {
  const fullText = `${chatHistory || ''} ${clientMessage || ''}`.toLowerCase();
  const messages = (chatHistory || '').split('\n').filter(m => m.trim());

  const orderMatch = fullText.match(/(?:order|#)\s*#?(\d{4,})/i);
  const orderNumber = orderMatch ? orderMatch[1] : null;

  const emailMatch = fullText.match(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i);
  const customerEmail = emailMatch ? emailMatch[0] : null;

  const PEPTIDE_PRODUCTS = [
    'retatrutide','semaglutide','tirzepatide','bpc-157','bpc157','tb-500','tb500',
    'cjc-1295','ipamorelin','ghk-cu','tesamorelin','sermorelin','nad+','nad',
    'wolverine','glow blend','klow','mots-c','pt-141','selank','semax','epithalon',
    'survodutide','cagrilintide','kisspeptin','follistatin','adipotide','aicar',
    'hexarelin','igf','triptorelin','thymalin','pinealon','oxytocin','ara-290',
    'ss-31','gonadorelin','hcg','hmg','lipo-c','5-amino-1mq','peg-mgf','mgf',
    'ghrp','dsip','vip','ghk','tb500','bpc','reta','tirz','sema',
  ];
  const msgLower = (clientMessage || '').toLowerCase();
  const productName = PEPTIDE_PRODUCTS.find(p => msgLower.includes(p)) || null;

  const isWrongItem =
    /ordered.{0,40}received|sent.{0,30}instead|received.{0,30}instead/i.test(fullText) ||
    /wrong (item|product|vial|size|dose|peptide)/i.test(fullText);

  const wordCount = (clientMessage || '').split(/\s+/).filter(Boolean).length;
  const messageRichness = wordCount >= 30 ? 'very_detailed'
    : wordCount >= 15 ? 'detailed'
    : wordCount >= 5  ? 'brief'
    : 'very_brief';

  const customerConfirmedAddress =
    /address.{0,30}(same|correct|on file|on the order|unchanged)/i.test(msgLower) ||
    /contact.{0,30}(same|correct|on file|on the order)/i.test(msgLower) ||
    /same as.{0,20}order/i.test(msgLower);

  const customerAskingForEmail =
    /email.{0,30}(address|send|reach|contact)/i.test(msgLower) ||
    /where.{0,20}(send|email)/i.test(msgLower);

  const customerMessages = messages.filter(m => m.startsWith('Customer:') || m.startsWith('Client:'));
  const agentMessages    = messages.filter(m => m.startsWith('Agent:')    || m.startsWith('Support:'));
  const customerMessageCount = customerMessages.length;
  const lastAgentMessage = agentMessages[agentMessages.length - 1] || '';

  return {
    orderNumber,
    customerEmail: customerEmail || 'unknown',
    productName,
    customerMessageCount,
    lastAgentMessage,
    messageRichness,
    isWrongItem,
    customerConfirmedAddress,
    customerAskingForEmail,
    agentAskedForOrder:      /order number|order #|order id/i.test(lastAgentMessage),
    agentAskedForEmail:      /email|e-mail address/i.test(lastAgentMessage),
    agentAskedForPhoto:      /photo|picture|image|screenshot/i.test(lastAgentMessage),
    agentAlreadyApologized:  /sorry|apologize|apologies/i.test(lastAgentMessage),
    agentOfferedRefund:      /refund|money back/i.test(lastAgentMessage),
    agentOfferedReplacement: /replacement|replace|reship/i.test(lastAgentMessage),
    isEscalating: /manager|supervisor|escalate|unacceptable|ridiculous|lawsuit|lawyer|sue|fraud|scam|bbb|attorney general/i.test(clientMessage),
    hasAttachment: /attached|attachment|photo|image|screenshot|picture|file/i.test(clientMessage),
    isLongConversation: customerMessageCount >= 4,
    turnCount: Math.max(customerMessageCount, agentMessages.length),
    extractedEntities: {
      ...(orderNumber  && { order_number: orderNumber }),
      ...(productName  && { product: productName }),
      ...(customerEmail && customerEmail !== 'unknown' && { email: customerEmail }),
    },
  };
}


function validateSuggestions(suggestions, conversationState, chatHistory) {
  if (!Array.isArray(suggestions)) return [];
  const hasOrderNumber = !!conversationState?.orderNumber;
  const hasEmail = conversationState?.customerEmail && conversationState.customerEmail !== 'unknown';
  return suggestions.filter((suggestion, index) => {
    if (!suggestion || typeof suggestion !== 'string' || suggestion.trim().length < 10) {
      console.log(`✦ [Validate] Filtered ${index + 1}: too short`); return false;
    }
    if (/as an ai|i'm a bot|i'm an assistant|as an assistant/i.test(suggestion)) {
      console.log(`✦ [Validate] Filtered ${index + 1}: mentions being AI`); return false;
    }
    if (hasOrderNumber && /\b(can you|could you|please provide|would you.*provide|share your).*?(order number|order #|order id)\b/i.test(suggestion) && !/order #?\d+/i.test(suggestion)) {
      console.log(`✦ [Validate] Filtered ${index + 1}: asking for order number already provided`); return false;
    }
    if (hasEmail && /\b(can you|could you|please provide|would you.*provide|share your).*?(email address|your email)\b/i.test(suggestion)) {
      console.log(`✦ [Validate] Filtered ${index + 1}: asking for email already provided`); return false;
    }
    return true;
  });
}

function callAnthropicAPIWithRetry(requestBody, apiKey, retries = 3) {
  const attempt = (attemptsLeft) => new Promise((resolve, reject) => {
    const options = { hostname: 'api.anthropic.com', path: '/v1/messages', method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'Content-Length': Buffer.byteLength(requestBody) } };
    const req = require('https').request(options, apiRes => {
      let body = '';
      apiRes.on('data', chunk => { body += chunk; });
      apiRes.on('end', () => {
        console.log(`✦ [AI] Anthropic response status: ${apiRes.statusCode}`);
        if (apiRes.statusCode !== 200) return reject(new Error(`Anthropic API ${apiRes.statusCode}: ${body.slice(0, 200)}`));
        try { resolve(JSON.parse(body)); } catch (e) { reject(new Error('Invalid JSON from Anthropic')); }
      });
    });
    req.on('error', (err) => {
      const currentAttempt = retries - attemptsLeft + 1;
      console.error(`✦ [AI] Attempt ${currentAttempt}/${retries} failed: ${err.message}`);
      if (attemptsLeft > 0) setTimeout(() => attempt(attemptsLeft - 1).then(resolve).catch(reject), 1500 * currentAttempt);
      else reject(err);
    });
    req.setTimeout(45000, () => { req.destroy(); reject(new Error('Anthropic timeout')); });
    req.write(requestBody); req.end();
  });
  return attempt(retries - 1);
}

// ============ SMART FALLBACK SUGGESTIONS ============

function generateSmartFallbackSuggestions(customerMsg, chatHistory, analysis, adminNote) {
  const lower = (customerMsg || '').toLowerCase();
  const topics = analysis?.detectedTopics || [];
  const sentiment = analysis?.sentiment || 'neutral';
  const isRepeat = analysis?.isRepeat || false;
  const hasOrderNumber = analysis?.hasOrderNumber || /\b\d{4,}\b/.test(customerMsg + chatHistory);
  const hasAttachment = analysis?.hasAttachment || /attach|photo|image/i.test(customerMsg);
  const agentAskedForOrder = analysis?.agentAskedForOrder || false;
  const agentAlreadyApologized = analysis?.agentAlreadyApologized || false;
  const isUrgent = analysis?.isUrgent || false;
  const isLongConversation = analysis?.isLongConversation || false;
  const messageRichness = analysis?.messageRichness || 'brief';

  const customerAlreadyExplained = messageRichness === 'very_detailed' || messageRichness === 'detailed';

  const isWrongItem =
    /ordered.{0,40}received|sent.{0,30}instead|received.{0,30}instead|wrong (item|product|vial|size|dose|peptide)/i.test(customerMsg + chatHistory) ||
    topics.includes('wrong_item');

  const customerProvidedAddress =
    /address.{0,30}(same|correct|on file|on the order|unchanged|hasn.t changed)/i.test(lower) ||
    /contact.{0,30}(same|correct|on file|on the order)/i.test(lower) ||
    /same as.{0,20}order/i.test(lower);

  const customerAskingForEmail =
    /email.{0,30}(address|send|reach|contact)/i.test(lower) ||
    /where.{0,20}(send|email)/i.test(lower);

  let empathyPrefix = '';
  if (sentiment === 'very_negative' && !agentAlreadyApologized) {
    const options = ['I sincerely apologize for this experience.', 'I completely understand how frustrating this must be.', 'I can see this has been really frustrating, and I want to make it right.'];
    empathyPrefix = options[Math.floor(Math.random() * options.length)] + ' ';
  } else if (sentiment === 'negative' && !agentAlreadyApologized) {
    const options = ['I\'m sorry about that.', 'I understand your concern.', 'I appreciate you bringing this to my attention.'];
    empathyPrefix = options[Math.floor(Math.random() * options.length)] + ' ';
  }
  const repeatPrefix = isRepeat ? 'I apologize for the delay getting this resolved. ' : '';
  const urgencySuffix = isUrgent ? ' I\'m treating this as a priority.' : '';

  if (topics.includes('gratitude') && topics.length === 1 && (sentiment === 'positive' || sentiment === 'very_positive')) {
    return ['You\'re very welcome! Don\'t hesitate to reach out if you need anything else.', 'Happy to help! Have a great day.', 'Glad we could get that sorted for you!'];
  }
  if (topics.length === 1 && topics.includes('greeting') && lower.trim().split(/\s+/).length <= 3) {
    return ['Hello! How can I help you today?', 'Hi there! What can I assist you with?', 'Hello! Thanks for reaching out. What do you need help with?'];
  }

  if (topics.includes('product_issue')) {
    if (isWrongItem) {
      if (customerAskingForEmail) {
        return [
          `${empathyPrefix}${repeatPrefix}I'm so sorry about the mix-up — I can see your order and I'm going to get the correct items sent out to you right away. You can reach us at support@pepscustomercare.com to send over your order list, and I'll pull up the details on our end as well.${urgencySuffix}`,
          `${empathyPrefix}That's entirely our error and I apologize. I'll arrange the correct shipment now — please send your order list to support@pepscustomercare.com and I'll cross-reference it against what we have on file.`,
          `${empathyPrefix}${repeatPrefix}I've noted the wrong item issue and I'm on it. Send your order details to support@pepscustomercare.com and I'll make sure the correct products go out to you promptly.${urgencySuffix}`
        ];
      }
      return [
        `${empathyPrefix}${repeatPrefix}I can see your order and I'm sorry about the mix-up. I'll get the correct item sent out to you right away — no need to return anything.${urgencySuffix}`,
        `${empathyPrefix}That's on us and I apologize. Let me pull up your order and arrange the correct shipment immediately. Could you confirm your shipping address is still the same as on the order?`,
        `${empathyPrefix}${repeatPrefix}Wrong item is absolutely our mistake — I'm arranging the correct replacement now. I'll have tracking sent to you as soon as it ships.${urgencySuffix}`
      ];
    }

    if (customerAlreadyExplained) {
      return [
        `${empathyPrefix}${repeatPrefix}Thank you for the detailed breakdown — I have everything I need to get this sorted. Let me pull up your order and arrange the correction right away.${urgencySuffix}`,
        `${empathyPrefix}I can see exactly what's happened from your message. I'm looking at your order now and will get back to you with a resolution shortly.`,
        `${empathyPrefix}${repeatPrefix}Got it — I have all the details I need. I'm going to escalate this now and make sure we get the right items out to you.${urgencySuffix}`
      ];
    }

    if (hasOrderNumber && hasAttachment) return [`${empathyPrefix}${repeatPrefix}Thank you for the photo and order details. I'm reviewing the issue and will get back to you with a solution right away.${urgencySuffix}`, `${empathyPrefix}I can see the issue clearly from the photo. Let me check the best resolution for you — would you prefer a replacement or a refund?`, `${empathyPrefix}${repeatPrefix}I've noted the issue with your order. Let me escalate this to get it resolved as quickly as possible.${urgencySuffix}`];
    if (hasOrderNumber && !hasAttachment && !analysis?.agentAskedForPhoto) return [`${empathyPrefix}Thank you for your order details. Could you send a quick photo of what you received? That will help me process this faster.`, `${empathyPrefix}I've located your order. To help resolve this quickly, could you share a picture of what arrived?`, `${empathyPrefix}${repeatPrefix}A photo would help me determine the best solution for you. Could you send one when you get a chance?${urgencySuffix}`];
    if (!hasOrderNumber && !agentAskedForOrder) return [`${empathyPrefix}I'd like to help resolve this. Could you share your order number so I can pull up the details?`, `${empathyPrefix}That's not the experience we want for you. Could you provide your order number and a brief description of the issue?`, `${empathyPrefix}${repeatPrefix}Let me look into this for you. Can you share your order number and, if possible, a photo of the problem?${urgencySuffix}`];
    return [`${empathyPrefix}I'm looking into this for you now. I'll have an update shortly.${urgencySuffix}`, `${empathyPrefix}Thank you for your patience. I'm checking the available options to resolve this.`, `${empathyPrefix}${repeatPrefix}I want to make sure we get this right. Let me review your case and get back to you with a solution.${urgencySuffix}`];
  }
  if (topics.includes('order_status') || topics.includes('shipping')) {
    if (hasOrderNumber) return [`${repeatPrefix}Thank you for your order number. Let me check the current status and tracking information for you now.${urgencySuffix}`, `${repeatPrefix}I'm pulling up your order details right now. I'll have the latest shipping update for you in just a moment.${urgencySuffix}`, `${repeatPrefix}I can see your order. Let me check with our fulfillment team for the most up-to-date status.${urgencySuffix}`];
    if (!agentAskedForOrder) return [`${empathyPrefix}I'd be happy to check on that for you. Could you share your order number?`, 'I can look that up! I\'ll need your order number or the email address you used at checkout.', `${empathyPrefix}${repeatPrefix}Let me find your order. Could you provide the order number? It should be in your confirmation email.${urgencySuffix}`];
    return [`${repeatPrefix}I'm checking on your order now. I'll update you with the tracking details as soon as I have them.${urgencySuffix}`, 'Thank you for your patience. I\'m looking into the shipping status with our team.', `${repeatPrefix}I want to give you accurate information. Give me just a moment to verify the shipping status.${urgencySuffix}`];
  }
  if (topics.includes('refund_return')) {
    if (hasOrderNumber) return [`${empathyPrefix}${repeatPrefix}I've located your order. Let me review the details and check what return options are available for you.${urgencySuffix}`, `${empathyPrefix}Thank you for your order number. I'm checking the return eligibility now and will let you know the next steps.`, `${empathyPrefix}I have your order pulled up. Could you let me know the reason for the return? That helps me process it faster.`];
    if (!agentAskedForOrder) return [`${empathyPrefix}I'd be happy to help with that. Could you share your order number so I can review the return options?`, `${empathyPrefix}To get started on the return, I'll need your order number. You can find it in your confirmation email.`, `${empathyPrefix}${repeatPrefix}I want to help resolve this. Could you provide your order number and let me know the reason for the return?${urgencySuffix}`];
    return [`${empathyPrefix}I'm reviewing your return request now. I'll update you with the available options shortly.${urgencySuffix}`, `${empathyPrefix}Thank you for your patience. I'm checking the return policy details for your specific order.`, `${empathyPrefix}${repeatPrefix}I'm working on this for you. Would you prefer a refund to your original payment method or a store credit?${urgencySuffix}`];
  }
  if (topics.includes('payment')) {
    if (hasOrderNumber) return [`${empathyPrefix}I can see your order. Let me review the payment details and get back to you.${urgencySuffix}`, `${empathyPrefix}Thank you for the details. I'm checking the billing records for your order now.`, `${empathyPrefix}${repeatPrefix}I'm looking into the payment issue on your order. I'll have an update for you shortly.${urgencySuffix}`];
    return [`${empathyPrefix}I'd like to help sort out this billing issue. Could you share your order number or the email associated with the charge?`, `${empathyPrefix}To investigate the payment concern, could you provide the order number, date, and amount of the charge?`, `${empathyPrefix}${repeatPrefix}I want to get to the bottom of this. Could you share the order number and the last four digits of the card used?${urgencySuffix}`];
  }
  if (topics.includes('discount_promo')) return ['Let me check on that promo code for you. Could you share the code and the items you\'re trying to apply it to?', 'I\'d be happy to help! Could you tell me which promotion you\'re referring to, or share the promo code?', `${empathyPrefix}Let me look into the available promotions for you. What product or category are you interested in?`];
  if (topics.includes('product_inquiry')) return ['Great question! Let me check that information for you. Which specific product are you asking about?', 'I\'d be happy to help with product details. Could you share the product name or a link?', 'Let me find the most accurate information for you. Can you tell me more about what you\'re looking for?'];
  if (topics.includes('account')) return [`${empathyPrefix}I can help with your account. For security, could you confirm the email address associated with it?`, `${empathyPrefix}Let me look into the account issue. Could you describe what's happening when you try to log in?`, `${empathyPrefix}${repeatPrefix}I'll get this sorted for you. Could you share the email on your account so I can investigate?${urgencySuffix}`];
  if (topics.includes('complaint')) {
    if (isLongConversation) return [`${empathyPrefix}${repeatPrefix}I understand this has been a long process and I want to get it resolved for you now. Let me escalate this to ensure it's handled promptly.${urgencySuffix}`, `${empathyPrefix}I can see this hasn't been resolved to your satisfaction. Let me personally make sure we get this taken care of right away.`, `${empathyPrefix}You've been more than patient. I'm going to escalate this and ensure you get a resolution today.${urgencySuffix}`];
    return [`${empathyPrefix}${repeatPrefix}I take your feedback seriously and I want to resolve this for you. Could you share the specific details so I can take action?${urgencySuffix}`, `${empathyPrefix}I hear you, and I want to make this right. Let me look into this and find the best solution.`, `${empathyPrefix}Thank you for letting us know. I'm going to look into this personally and follow up with you.${urgencySuffix}`];
  }
  if (analysis?.isQuestion) return [`${empathyPrefix}${repeatPrefix}That's a great question. Let me find the answer for you — one moment.${urgencySuffix}`, `${empathyPrefix}I'd be happy to help with that. Let me check and get back to you with the details.`, `${empathyPrefix}${repeatPrefix}Let me look into that for you. Could you provide any additional details that might help me find the answer faster?${urgencySuffix}`];
  return [`${empathyPrefix}${repeatPrefix}Thank you for your message. Let me look into this and get back to you shortly.${urgencySuffix}`, `${empathyPrefix}I appreciate you reaching out. Could you provide a bit more detail so I can assist you better?`, `${empathyPrefix}${repeatPrefix}I want to make sure I help you with the right information. Could you tell me a bit more about what you need?${urgencySuffix}`];
}


app.get('/api/employees', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin access required' });

    const employees = await db.getAllEmployees();
    const responseStats = await db.pool.query(`
      WITH real_messages AS (
        SELECT id, conversation_id, sender_id, sender_type, sent_at,
          LAG(sender_type) OVER (PARTITION BY conversation_id ORDER BY sent_at) AS prev_sender_type,
          LAG(sent_at)     OVER (PARTITION BY conversation_id ORDER BY sent_at) AS prev_sent_at
        FROM messages
        WHERE sender_type IN ('customer', 'agent')
          AND NOT (sender_type = 'agent' AND sender_id IS NULL)
      ),
      response_times AS (
        SELECT sender_id,
          EXTRACT(EPOCH FROM (sent_at - prev_sent_at)) / 60.0 AS response_minutes
        FROM real_messages
        WHERE sender_type = 'agent'
          AND sender_id IS NOT NULL
          AND prev_sender_type = 'customer'
          AND prev_sent_at IS NOT NULL
          AND EXTRACT(EPOCH FROM (sent_at - prev_sent_at)) / 60.0 BETWEEN 0 AND 240
      )
      SELECT sender_id,
        ROUND(AVG(response_minutes)::numeric, 1) AS avg_response_minutes,
        ROUND(MIN(response_minutes)::numeric, 1) AS fastest_minutes,
        COUNT(*)::int AS total_responses_counted
      FROM response_times
      GROUP BY sender_id
    `);

    // sender_id is VARCHAR in the DB; normalize to string keys for lookup
    const statsById = {};
    for (const row of responseStats.rows) {
      statsById[String(row.sender_id)] = {
        avgResponseMinutes: row.avg_response_minutes !== null ? parseFloat(row.avg_response_minutes) : null,
        fastestMinutes: row.fastest_minutes !== null ? parseFloat(row.fastest_minutes) : null,
        totalResponsesCounted: row.total_responses_counted,
      };
    }

    // ── Per-agent, per-customer response time breakdown (for CSV export) ──
    // Same 4-hour cap applied for consistency with overall stats above.
    const customerResponseStats = await db.pool.query(`
      WITH real_messages AS (
        SELECT m.id, m.conversation_id, m.sender_id, m.sender_type, m.sent_at,
          c.customer_email,
          LAG(m.sender_type) OVER (PARTITION BY m.conversation_id ORDER BY m.sent_at) AS prev_sender_type,
          LAG(m.sent_at)     OVER (PARTITION BY m.conversation_id ORDER BY m.sent_at) AS prev_sent_at
        FROM messages m
        JOIN conversations c ON c.id = m.conversation_id
        WHERE m.sender_type IN ('customer', 'agent')
          AND NOT (m.sender_type = 'agent' AND m.sender_id IS NULL)
      ),
      rt AS (
        SELECT sender_id, customer_email,
          EXTRACT(EPOCH FROM (sent_at - prev_sent_at)) / 60.0 AS response_minutes
        FROM real_messages
        WHERE sender_type = 'agent'
          AND sender_id IS NOT NULL
          AND prev_sender_type = 'customer'
          AND prev_sent_at IS NOT NULL
          AND EXTRACT(EPOCH FROM (sent_at - prev_sent_at)) / 60.0 BETWEEN 0 AND 240
          AND customer_email IS NOT NULL
          AND customer_email != ''
      )
      SELECT sender_id, customer_email,
        ROUND(AVG(response_minutes)::numeric, 1) AS avg_minutes,
        COUNT(*)::int AS response_count
      FROM rt
      GROUP BY sender_id, customer_email
      ORDER BY sender_id, response_count DESC
    `);

    // Group per-customer rows by agent
    const responsesByAgent = {};
    for (const row of customerResponseStats.rows) {
      const key = String(row.sender_id);
      if (!responsesByAgent[key]) responsesByAgent[key] = [];
      responsesByAgent[key].push({
        customerEmail: row.customer_email,
        avgResponseMinutes: row.avg_minutes !== null ? parseFloat(row.avg_minutes) : null,
        responseCount: row.response_count,
      });
    }

    const enriched = employees.map(emp => {
      const { password_hash, api_token, ...safe } = emp;
      const stats = statsById[String(emp.id)] || {
        avgResponseMinutes: null,
        fastestMinutes: null,
        totalResponsesCounted: 0,
      };
      return {
        ...snakeToCamel(safe),
        ...stats,
        responsesByCustomer: responsesByAgent[String(emp.id)] || [],
      };
    });

    res.json(enriched);
  } catch (error) {
    console.error('Get employees error:', error);
    res.status(500).json({ error: 'Failed to fetch employees' });
  }
});


app.post('/api/employees', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin access required' });
    const { email, name, employeeName, role, password, canViewAllStores, isActive } = req.body;
    if (!email || !name || !password) return res.status(400).json({ error: 'Email, name, and password are required' });
    const password_hash = await hashPassword(password);
    const employee = await db.createEmployee({
      email,
      name,
      employee_name: employeeName || null,
      role: role || 'agent',
      password_hash,
      can_view_all_stores: canViewAllStores !== undefined ? canViewAllStores : true,
      is_active: isActive !== undefined ? isActive : true,
      assigned_stores: []
    });
    delete employee.password_hash; delete employee.api_token;
    res.json(snakeToCamel(employee));
  } catch (error) { console.error('Create employee error:', error); res.status(500).json({ error: error.message }); }
});


app.put('/api/employees/:id', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin access required' });
    const employeeId = parseInt(req.params.id); const updates = req.body;
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
    delete employee.password_hash; delete employee.api_token;
    res.json(snakeToCamel(employee));
  } catch (error) { console.error('Update employee error:', error); res.status(500).json({ error: 'Failed to update employee' }); }
});

app.delete('/api/employees/:id', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin access required' });
    const employeeId = parseInt(req.params.id);
    if (employeeId === req.user.id) return res.status(400).json({ error: 'Cannot delete your own account' });
    await db.deleteEmployee(employeeId);
    res.json({ success: true, message: 'Employee deleted' });
  } catch (error) { console.error('Delete employee error:', error); res.status(500).json({ error: 'Failed to delete employee' }); }
});
app.put('/api/employees/:id/status', authenticateToken, async (req, res) => {
  try { await db.updateEmployeeStatus(parseInt(req.params.id), req.body.status); res.json({ success: true }); }
  catch (error) { res.status(500).json({ error: error.message }); }
});


app.patch('/api/employees/:id/notes-order', authenticateToken, async (req, res) => {
  try {
    const employeeId = parseInt(req.params.id);
    const { order } = req.body;
 
    if (req.user.id !== employeeId && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Forbidden' });
    }
 
    if (!Array.isArray(order)) {
      return res.status(400).json({ error: 'order must be an array of note IDs' });
    }
 
    await db.updateEmployeeNotesOrder(employeeId, order);
    res.json({ success: true });
  } catch (error) {
    console.error('Error saving notes order:', error);
    res.status(500).json({ error: 'Failed to save notes order' });
  }
});

// ============ TEMPLATE ENDPOINTS ============

app.get('/api/templates', authenticateToken, async (req, res) => {
  try { const templates = await db.getTemplatesByUserId(req.user.id); res.json(templates.map(snakeToCamel)); }
  catch (error) { console.error('Get templates error:', error); res.status(500).json({ error: 'Failed to fetch templates' }); }
});
app.post('/api/templates', authenticateToken, async (req, res) => {
  try {
    const { name, content } = req.body;
    if (!name || !content) return res.status(400).json({ error: 'Name and content are required' });
    if (name.length > 255) return res.status(400).json({ error: 'Template name is too long (max 255 characters)' });
    const template = await db.createTemplate({ user_id: req.user.id, name: name.trim(), content: content.trim() });
    res.status(201).json(snakeToCamel(template));
  } catch (error) { console.error('Create template error:', error); res.status(500).json({ error: 'Failed to create template' }); }
});
app.put('/api/templates/:id', authenticateToken, async (req, res) => {
  try {
    const templateId = parseInt(req.params.id); const { name, content } = req.body;
    if (!name || !content) return res.status(400).json({ error: 'Name and content are required' });
    if (name.length > 255) return res.status(400).json({ error: 'Template name is too long (max 255 characters)' });
    const existingTemplate = await db.getTemplateById(templateId);
    if (!existingTemplate) return res.status(404).json({ error: 'Template not found' });
    if (existingTemplate.user_id !== req.user.id) return res.status(403).json({ error: 'Not authorized to update this template' });
    const template = await db.updateTemplate(templateId, { name: name.trim(), content: content.trim() });
    res.json(snakeToCamel(template));
  } catch (error) { console.error('Update template error:', error); res.status(500).json({ error: 'Failed to update template' }); }
});
app.delete('/api/templates/:id', authenticateToken, async (req, res) => {
  try {
    const templateId = parseInt(req.params.id);
    const existingTemplate = await db.getTemplateById(templateId);
    if (!existingTemplate) return res.status(404).json({ error: 'Template not found' });
    if (existingTemplate.user_id !== req.user.id) return res.status(403).json({ error: 'Not authorized to delete this template' });
    await db.deleteTemplate(templateId);
    res.json({ success: true, message: 'Template deleted successfully' });
  } catch (error) { console.error('Delete template error:', error); res.status(500).json({ error: 'Failed to delete template' }); }
});

// ============ ANALYTICS ============

let analyticsCache = null;
let analyticsCacheTimestamp = null;
const ANALYTICS_CACHE_DURATION = 30 * 60 * 1000;

app.get('/api/analytics/common-questions', authenticateToken, async (req, res) => {
  try {
    const { limit = 20, timeframe = 'all' } = req.query;
    if (timeframe === 'all' && analyticsCache && analyticsCacheTimestamp) {
      const cacheAge = Date.now() - analyticsCacheTimestamp;
      if (cacheAge < ANALYTICS_CACHE_DURATION) return res.json({ ...analyticsCache, cached: true, cacheAge: Math.floor(cacheAge / 1000) });
    }
    let dateFilter = '';
    if (timeframe === 'week') dateFilter = `AND m.sent_at >= NOW() - INTERVAL '7 days'`;
    else if (timeframe === 'month') dateFilter = `AND m.sent_at >= NOW() - INTERVAL '30 days'`;
    else if (timeframe === '3months') dateFilter = `AND m.sent_at >= NOW() - INTERVAL '90 days'`;
    const result = await db.pool.query(`SELECT m.content, m.sent_at, m.conversation_id, m.sender_name as customer_name FROM messages m WHERE m.sender_type = 'customer' AND m.content IS NOT NULL AND m.content != '' AND LENGTH(TRIM(m.content)) > 0 ${dateFilter} ORDER BY m.sent_at DESC`);
    const messages = result.rows;
    if (messages.length === 0) return res.json({ summary: { totalMessagesAnalyzed: 0, questionsFound: 0, timeframe }, topQuestions: [], topTopics: [], topIssues: [], sentimentBreakdown: { very_negative: 0, negative: 0, neutral: 0, positive: 0, very_positive: 0 } });
    const questionAnalysis = analyzeCustomerQuestions(messages);
    const response = { summary: { totalMessagesAnalyzed: messages.length, questionsFound: questionAnalysis.questions.length, timeframe },
      topQuestions: questionAnalysis.topQuestions.slice(0, parseInt(limit)), topTopics: questionAnalysis.topTopics.slice(0, 10),
      topIssues: questionAnalysis.topIssues.slice(0, 10), sentimentBreakdown: questionAnalysis.sentimentBreakdown, cached: false };
    if (timeframe === 'all') { analyticsCache = response; analyticsCacheTimestamp = Date.now(); }
    res.json(response);
  } catch (error) { console.error('📊 [Analytics] Error:', error); res.status(500).json({ error: 'Failed to retrieve analytics', message: error.message }); }
});
app.post('/api/analytics/clear-cache', authenticateToken, (req, res) => {
  try {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin access required' });
    analyticsCache = null; analyticsCacheTimestamp = null;
    res.json({ success: true, message: 'Analytics cache cleared' });
  } catch (error) { res.status(500).json({ error: 'Failed to clear cache' }); }
});

function analyzeCustomerQuestions(messages) {
  const questions = []; const topicCounts = {}; const issueCounts = {};
  const sentimentCounts = { very_negative: 0, negative: 0, neutral: 0, positive: 0, very_positive: 0 };
  const topicKeywords = {
    order_status: ['order', 'tracking', 'shipped', 'delivery', 'deliver', 'where is', 'status', 'when will', 'late', 'delayed', 'still waiting', 'hasn\'t arrived', 'not arrived', 'not received', 'haven\'t received', 'never arrived', 'never came', 'taking too long'],
    refund_return: ['refund', 'return', 'money back', 'cancel', 'cancellation', 'exchange'],
    product_issue: ['broken', 'damaged', 'defective', 'wrong item', 'missing', 'not working', 'doesn\'t work', 'issue with'],
    payment: ['payment', 'charged', 'charge', 'billing', 'invoice', 'receipt', 'credit card', 'declined'],
    discount_promo: ['discount', 'coupon', 'promo', 'code', 'sale', 'offer', 'deal'],
    product_inquiry: ['product', 'item', 'size', 'color', 'stock', 'available', 'price', 'how much', 'coa', 'certificate', 'analysis', 'lab report', 'test results', 'dosing', 'dose', 'dosage', 'how to use', 'how much to take', 'instructions', 'how to take', 'usage', 'inject', 'injection', 'reconstitute', 'reconstitution', 'how many', 'how often', 'protocol', 'how long', 'last', 'vial last', 'one vial', 'per week', 'per day', 'bac water', 'needle', 'needles', 'syringe', 'free', 'include', 'comes with', 'do you have', 'do you sell', 'do you carry', 'in stock', 'sell', 'carry', 'offer', 'blend', 'stack'],
    pickup: ['pick up', 'pickup', 'pick-up', 'local pickup', 'come to', 'come directly', 'come by', 'visit', 'your address', 'your location', 'physical location', 'in person', 'physical store', 'store location', 'shop location', 'have a store', 'store in', 'physical location', 'retail location', 'do i have to order online'],
    shipping: ['shipping', 'ship', 'freight', 'express', 'standard', 'free shipping', 'shipping cost', 'uber'],
    account: ['account', 'login', 'password', 'sign in', 'email', 'profile', 'update my'],
  };
  const issueKeywords = { damaged: ['broken', 'damaged', 'defective', 'cracked', 'shattered', 'crushed'], wrong_item: ['wrong item', 'incorrect', 'not what i ordered', 'different'], missing: ['missing', 'didn\'t receive', 'never arrived', 'lost'], late: ['late', 'delayed', 'taking too long', 'still waiting'], quality: ['poor quality', 'cheap', 'not as described', 'disappointed with quality'] };
  const excludePatterns = [
    /^(hi|hey|hello|greetings|good morning|good afternoon|good evening|yo|sup|what's up|whats up)[\s?!.]*$/i, /^how are you(\s+doing)?[\s?!.]*$/i,
    /^(are you|is anyone|is someone|anyone) (there|here|available)[\s?!.]*$/i, /^(thanks|thank you|thx|ty)[\s?!.]*$/i,
    /^(ok|okay|cool|great|awesome|perfect|nice|got it|i see|understood)[\s?!.]*$/i, /^(yes|no|yeah|yep|nope|sure)[\s?!.]*$/i,
    /^[\s?!.]+$/, /^test$/i,
    /\b(is the chat working|did you get my (message|msg)|are you (there|here|receiving)|can you see (this|my message))/i,
    /\b(is anyone (there|here|available|reading)|is this working|hello\?+ anyone)/i,
    /\b(affiliate|partnership|resell|wholesale|bulk order|business opportunity|work with you|collaborate|become (a|an) (partner|reseller|affiliate))/i,
  ];
  messages.forEach(msg => {
    const content = msg.content || ''; const lower = content.toLowerCase().trim();
    if (excludePatterns.some(pattern => pattern.test(lower))) return;
    const spamIndicators = ['shopify store', 'conversion rate', 'funnel flow', 'store optimization', 'i help store owners', 'i noticed your store', 'measurable lifts', 'ecommerce consultant', 'cro expert'];
    if (spamIndicators.some(indicator => lower.includes(indicator))) return;
    if (content.trim().length < 10) return;
    const isQuestion = content.includes('?') || /^(can |could |how |what |where |when |why |is |are |do |does |will |would |who |which |have |may |might )/i.test(content.trim());
    const isInquiry = /\b(late|delayed|still waiting|hasn't arrived|havent received|not received|never arrived|where is|when will)\b/i.test(lower) || /\b(dosing|dose|dosage|how to).{0,30}(information|work|use|take|inject|administer)/i.test(lower) || /\b(how much|how many|how often).{0,30}(take|inject|use|dose|administer|water|bac|injection)/i.test(lower) || /\b(vial|bottle).{0,30}(last|duration|good for).{0,30}(week|month|day|injection)/i.test(lower) || /\b(do you|does it|does this|do they).{0,30}(have|include|come|provide|offer|sell|give|carry)/i.test(lower) || /\b(wondering|help me|can you help|need help).{0,30}(with|figure|understand|how)/i.test(lower);
    if (!isQuestion && !isInquiry) return;
    const detectedTopics = [];
    for (const [topic, keywords] of Object.entries(topicKeywords)) {
      if (keywords.some(kw => lower.includes(kw))) { detectedTopics.push(topic); topicCounts[topic] = (topicCounts[topic] || 0) + 1; }
    }
    const hasBusinessTopic = detectedTopics.length > 0;
    if (!hasBusinessTopic && content.trim().length < 20 && /^(hi|hey|hello|how are you)[\s?!.]*$/i.test(lower)) return;
    let detectedIssue = null;
    for (const [issue, keywords] of Object.entries(issueKeywords)) {
      if (keywords.some(kw => lower.includes(kw))) { detectedIssue = issue; issueCounts[issue] = (issueCounts[issue] || 0) + 1; break; }
    }
    const negCount = ['angry', 'frustrated', 'upset', 'terrible', 'horrible', 'worst', 'unacceptable', 'disappointed'].filter(w => lower.includes(w)).length;
    const posCount = ['thank', 'thanks', 'great', 'awesome', 'perfect', 'helpful', 'appreciate'].filter(w => lower.includes(w)).length;
    let sentiment = 'neutral';
    if (negCount >= 2) sentiment = 'very_negative'; else if (negCount >= 1) sentiment = 'negative';
    else if (posCount >= 2) sentiment = 'very_positive'; else if (posCount >= 1) sentiment = 'positive';
    sentimentCounts[sentiment]++;
    const normalizedQuestion = normalizeQuestion(content);
    if (normalizedQuestion === 'general question' || normalizedQuestion.length < 5) return;
    questions.push({ original: content, normalized: normalizedQuestion, topics: detectedTopics, issue: detectedIssue, sentiment, date: msg.sent_at, conversationId: msg.conversation_id, customerName: msg.customer_name || 'Guest' });
  });
  const questionGroups = {};
  questions.forEach(q => {
    const key = q.normalized;
    if (!questionGroups[key]) questionGroups[key] = { question: q.normalized, examples: [], count: 0, topics: {}, issues: {}, sentiment: { very_negative: 0, negative: 0, neutral: 0, positive: 0, very_positive: 0 } };
    questionGroups[key].count++; questionGroups[key].sentiment[q.sentiment]++;
    if (questionGroups[key].examples.length < 10) questionGroups[key].examples.push(q.original);
    q.topics.forEach(topic => { questionGroups[key].topics[topic] = (questionGroups[key].topics[topic] || 0) + 1; });
    if (q.issue) questionGroups[key].issues[q.issue] = (questionGroups[key].issues[q.issue] || 0) + 1;
  });
  const topQuestions = Object.values(questionGroups).sort((a, b) => b.count - a.count).map(q => ({ question: q.question, count: q.count, examples: q.examples, primaryTopic: Object.keys(q.topics).sort((a, b) => q.topics[b] - q.topics[a])[0] || 'general', primaryIssue: Object.keys(q.issues).sort((a, b) => q.issues[b] - q.issues[a])[0] || null, sentiment: getMostCommonSentiment(q.sentiment) }));
  return { questions, topQuestions, topTopics: Object.entries(topicCounts).sort((a, b) => b[1] - a[1]).map(([topic, count]) => ({ topic, count })), topIssues: Object.entries(issueCounts).sort((a, b) => b[1] - a[1]).map(([issue, count]) => ({ issue, count })), sentimentBreakdown: sentimentCounts };
}

function normalizeQuestion(question) {
  let normalized = question.toLowerCase().trim();
  const pp = { 'pick up': '__PICKUP__', 'pickup': '__PICKUP__', 'pick-up': '__PICKUP__', 'in person': '__INPERSON__', 'physical location': '__PHYSICALLOCATION__', 'physical store': '__PHYSICALSTORE__', 'store location': '__STORELOCATION__', 'have a store': '__HAVEASTORE__', 'still waiting': '__STILLWAITING__', 'not arrived': '__NOTARRIVED__', 'haven\'t received': '__NOTRECEIVED__', 'not received': '__NOTRECEIVED__', 'never arrived': '__NEVERARRIVED__', 'coa document': '__COADOCUMENT__', 'certificate of analysis': '__COA__', 'lab report': '__LABREPORT__', 'how to use': '__HOWTOUSE__', 'how to take': '__HOWTOTAKE__', 'how many': '__HOWMANY__', 'how often': '__HOWOFTEN__', 'reconstitution': '__RECONSTITUTION__', 'bac water': '__BACWATER__', 'bacteriostatic water': '__BACWATER__', 'bacteriostatic': '__BAC__', 'how long': '__HOWLONG__', 'vial last': '__VIALLAST__', 'one vial': '__ONEVIAL__', 'per vial': '__PERVIAL__', 'how many doses': '__HOWMANYDOSES__', 'doses per': '__DOSESPER__', 'do you have': '__DOYOUHAVE__', 'do you sell': '__DOYOUSELL__', 'comes with': '__COMESWITH__', 'come with': '__COMESWITH__' };
  Object.entries(pp).forEach(([phrase, placeholder]) => { normalized = normalized.replace(new RegExp(phrase, 'gi'), placeholder); });
  normalized = normalized.replace(/\b(bpc-?157|bpc 157|bpc157)\b/gi, 'bpc').replace(/\b(tb-?500|tb 500|tb500)\b/gi, 'tb').replace(/\b(ghk-?cu|ghk cu|ghkcu)\b/gi, 'ghk').replace(/\b(cjc-?1295|cjc 1295|cjc1295)\b/gi, 'cjc').replace(/\b(ipamorelin|ipa)\b/gi, 'ipa').replace(/\b(retatrutide|reta|tirz|tirzepatide)\b/gi, 'reta').replace(/\b(tesamorelin|tesa)\b/gi, 'tesa').replace(/\b(semaglutide|sema)\b/gi, 'sema').replace(/\b(wolverine|glow|klow)\b/gi, 'blend');
  normalized = normalized.replace(/\d+/g, '').replace(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi, '').replace(/https?:\/\/[^\s]+/gi, '').replace(/\b(blue|red|black|white|green|yellow|purple|pink|orange|brown|gray|grey)\b/gi, '').replace(/\b(vials?|bottles?|containers?)\b/gi, 'vial').replace(/\b(injections?|shots?|doses?)\b/gi, 'dose').replace(/\b(weeks?|days?|months?)\b/gi, 'period').replace(/\b(order|order number|order #|#)\s*\d*/gi, 'order').replace(/\b(\d+\s*)?(ml|mg|iu|mcg|units?)\b/gi, 'amount');
  normalized = normalized.replace(/^(hey|hi|hello|greetings|good morning|good afternoon|good evening|yo)\s*/gi, '').replace(/where is my|where's my|wheres my/gi, 'where is').replace(/when will|when's|whens/gi, 'when will').replace(/how do i|how can i|how to/gi, 'how do i').replace(/what is|what's|whats/gi, 'what is').replace(/can i|could i|may i/gi, 'can i').replace(/do you|does your|do your|do you guys/gi, 'do you').replace(/i'm|im/gi, 'i am').replace(/don't|dont/gi, 'do not').replace(/can't|cant/gi, 'cannot').replace(/haven't|havent/gi, 'have not');
  normalized = normalized.replace(/\b(please|kindly|just|really|actually|basically|literally|honestly|sorry|um|uh|like|you know|mainly|very|quite|pretty|also|still|even|always|never)\b/gi, '');
  normalized = normalized.replace(/[?!.,:;]+/g, ' ').replace(/\s+/g, ' ').trim();
  Object.entries(pp).forEach(([phrase, placeholder]) => { normalized = normalized.replace(new RegExp(placeholder, 'gi'), phrase); });
  if (normalized.includes('__bacwater__') || normalized.includes('__bac__') || normalized.includes('bac water') || normalized.includes('bacteriostatic')) return 'bac water question';
  if (normalized.includes('__reconstitution__') || normalized.includes('reconstitution solution')) return 'reconstitution solution question';
  if (normalized.includes('coa') || normalized.includes('__coadocument__') || normalized.includes('certificate') || normalized.includes('__labreport__')) return 'coa document question';
  if (normalized.includes('dosing') || normalized.includes('dosage') || normalized.includes('__dosinginfo__')) return 'dosing information question';
  if ((normalized.includes('__howlong__') || normalized.includes('__viallast__')) || (normalized.includes('vial') && normalized.includes('last')) || normalized.includes('__howmanydoses__')) return 'vial duration question';
  if ((normalized.includes('needle') || normalized.includes('syringe')) && (normalized.includes('__comeswith__') || normalized.includes('receive') || normalized.includes('included'))) return 'needles included question';
  if (normalized.includes('__pickup__') || normalized.includes('__inperson__') || normalized.includes('__physicallocation__') || normalized.includes('__physicalstore__') || normalized.includes('__storelocation__') || normalized.includes('__haveastore__')) return 'pickup location question';
  if ((normalized.includes('tracking') || normalized.includes('__notarrived__') || normalized.includes('__stillwaiting__') || normalized.includes('__notreceived__')) && !normalized.includes('edit') && !normalized.includes('change')) return 'tracking delivery question';
  if ((normalized.includes('edit') || normalized.includes('change')) && normalized.includes('order') && !normalized.includes('address')) return 'edit order question';
  if ((normalized.includes('change') || normalized.includes('update')) && normalized.includes('address')) return 'change address question';
  if (normalized.includes('refund') || normalized.includes('money back')) return 'refund question';
  if (normalized.includes('discount') || (normalized.includes('code') && !normalized.includes('postal')) || normalized.includes('promo') || normalized.includes('coupon')) return 'discount code question';
  if (normalized.includes('payment') && (normalized.includes('method') || normalized.includes('accept'))) return 'payment methods question';
  if ((normalized.includes('__doyouhave__') || normalized.includes('__doyousell__')) && !normalized.includes('needle') && !normalized.includes('__bacwater__') && !normalized.includes('coa') && !normalized.includes('__haveastore__')) return 'product availability question';
  if (normalized.includes('refund') || normalized.includes('refunded')) return 'refund question';
  if (normalized.includes('__howlong__') || (normalized.includes('vial') && normalized.includes('last'))) return 'vial duration question';
  const stopWords = new Set(['a','an','the','and','or','but','is','are','was','were','be','been','being','have','has','had','do','does','did','will','would','should','could','may','might','can','of','at','by','for','with','about','as','into','through','before','after','to','from','up','down','in','out','on','off','over','under','again','here','there','when','where','why','all','both','each','few','more','most','other','some','such','only','own','same','so','than','too','now','i','me','my','we','our','you','your','he','him','his','she','her','it','its','they','them','their','this','that','these','those','am','any','because','if','while','how','what','which','who','whom']);
  const words = normalized.split(/\s+/).filter(w => w.length > 0);
  const keywords = words.filter(w => !stopWords.has(w) && w.length >= 3);
  if (keywords.length >= 2) { const filtered = keywords.filter(k => !['order','question','help','know','want','need','get','give','tell','ask','also','still','just','make','take','use','see','find'].includes(k)); if (filtered.length >= 2) return [...filtered].sort().slice(0, 3).join(' '); }
  if (normalized.length < 5) return 'general question';
  return normalized;
}

function getMostCommonSentiment(sentimentCounts) {
  return Object.entries(sentimentCounts).sort((a, b) => b[1] - a[1])[0][0];
}

// ============ STATS ENDPOINTS ============

app.get('/api/stats/dashboard', authenticateToken, async (req, res) => {
  try { const stats = await db.getDashboardStats(req.query); res.json(stats); }
  catch (error) { res.status(500).json({ error: error.message }); }
});




app.get('/api/stats/websocket', authenticateToken, (req, res) => {
  try { const stats = getWebSocketStats(); res.json(stats); }
  catch (error) { res.status(500).json({ error: error.message }); }
});

// Manual trigger for the hourly Discord response-time report
app.post('/api/stats/discord-report/trigger', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }
    if (!process.env.DISCORD_STATS_WEBHOOK) {
      return res.status(400).json({ error: 'DISCORD_STATS_WEBHOOK not configured' });
    }
    sendHourlyResponseTimeStats().catch(err =>
      console.error('📊 [Discord Stats] Manual trigger failed:', err.message)
    );
    res.json({ ok: true, message: 'Discord report triggered — check the channel in a few seconds' });
  } catch (err) {
    console.error('📊 [Discord Stats] Trigger endpoint error:', err.message);
    res.status(500).json({ error: 'Failed to trigger report' });
  }
});

// Manual trigger for the daily Discord activity report
app.post('/api/stats/discord-daily-report/trigger', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }
    const webhook = process.env.DISCORD_DAILY_WEBHOOK || process.env.DISCORD_STATS_WEBHOOK;
    if (!webhook) {
      return res.status(400).json({ error: 'No Discord webhook configured' });
    }
    sendDailyActivityStats().catch(err =>
      console.error('📊 [Discord Daily] Manual trigger failed:', err.message)
    );
    res.json({ ok: true, message: 'Daily Discord report triggered — check the channel in a few seconds' });
  } catch (err) {
    console.error('📊 [Discord Daily] Trigger endpoint error:', err.message);
    res.status(500).json({ error: 'Failed to trigger report' });
  }
});


app.get('/api/stats/response-times/team', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin access required' });

    const { rows } = await db.pool.query(`
      WITH real_messages AS (
        SELECT conversation_id, sender_type, sent_at,
          LAG(sender_type) OVER (PARTITION BY conversation_id ORDER BY sent_at) AS prev_sender_type,
          LAG(sent_at)     OVER (PARTITION BY conversation_id ORDER BY sent_at) AS prev_sent_at
        FROM messages
        WHERE sender_type IN ('customer', 'agent')
          AND NOT (sender_type = 'agent' AND sender_id IS NULL)
      ),
      rt AS (
        SELECT EXTRACT(EPOCH FROM (sent_at - prev_sent_at)) / 60.0 AS minutes
        FROM real_messages
        WHERE sender_type = 'agent' AND prev_sender_type = 'customer'
          AND prev_sent_at IS NOT NULL
          AND EXTRACT(EPOCH FROM (sent_at - prev_sent_at)) / 60.0 BETWEEN 0 AND 240
      )
      SELECT
        ROUND(AVG(minutes)::numeric, 1)  AS avg_minutes,
        ROUND(MIN(minutes)::numeric, 1)  AS fastest_minutes,
        ROUND((PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY minutes))::numeric, 1) AS median_minutes,
        COUNT(*)::int AS total_responses,
        COUNT(*) FILTER (WHERE minutes <= 5)::int  AS under_5_min,
        COUNT(*) FILTER (WHERE minutes <= 30)::int AS under_30_min,
        COUNT(*) FILTER (WHERE minutes > 60)::int  AS over_1_hour
      FROM rt
    `);

    const r = rows[0] || {};
    res.json({
      avgMinutes: r.avg_minutes !== null ? parseFloat(r.avg_minutes) : null,
      medianMinutes: r.median_minutes !== null ? parseFloat(r.median_minutes) : null,
      fastestMinutes: r.fastest_minutes !== null ? parseFloat(r.fastest_minutes) : null,
      totalResponses: r.total_responses || 0,
      under5Min: r.under_5_min || 0,
      under30Min: r.under_30_min || 0,
      over1Hour: r.over_1_hour || 0,
    });
  } catch (error) {
    console.error('Team response stats error:', error);
    res.status(500).json({ error: 'Failed to fetch team response stats' });
  }
});

app.get('/api/conversations/:id/response-stats', authenticateToken, async (req, res) => {
  try {
    const conversationId = parseInt(req.params.id);
    const { rows } = await db.pool.query(`
      WITH real_messages AS (
        SELECT sender_type, sender_name, sent_at,
          LAG(sender_type) OVER (ORDER BY sent_at) AS prev_sender_type,
          LAG(sent_at)     OVER (ORDER BY sent_at) AS prev_sent_at
        FROM messages
        WHERE conversation_id = $1
          AND sender_type IN ('customer', 'agent')
          AND NOT (sender_type = 'agent' AND sender_id IS NULL)
      )
      SELECT sender_name, EXTRACT(EPOCH FROM (sent_at - prev_sent_at)) / 60.0 AS minutes, sent_at
      FROM real_messages
      WHERE sender_type = 'agent' AND prev_sender_type = 'customer' AND prev_sent_at IS NOT NULL
        AND EXTRACT(EPOCH FROM (sent_at - prev_sent_at)) / 60.0 BETWEEN 0 AND 240
      ORDER BY sent_at ASC
    `, [conversationId]);

    const responses = rows.map(r => ({
      senderName: r.sender_name,
      minutes: parseFloat(r.minutes),
      at: r.sent_at,
    }));
    const avg = responses.length
      ? responses.reduce((s, r) => s + r.minutes, 0) / responses.length
      : null;

    res.json({
      conversationId,
      avgResponseMinutes: avg !== null ? Math.round(avg * 10) / 10 : null,
      totalResponses: responses.length,
      responses,
    });
  } catch (error) {
    console.error('Conversation response stats error:', error);
    res.status(500).json({ error: 'Failed to fetch conversation response stats' });
  }
});

// ============ ERROR HANDLER ============

app.use((err, req, res, next) => {
  console.error('SERVER ERROR:', err.message);
  res.status(500).json({ error: 'Internal server error', message: process.env.NODE_ENV === 'development' ? err.message : undefined });
});

// ============ KEEP-ALIVE ============

function setupKeepAlive() {
  if (process.env.KEEP_ALIVE === 'false') { console.log('⏰ Keep-alive disabled'); return; }
  const APP_URL = process.env.APP_URL || `http://localhost:${process.env.PORT || 3000}`;
  const httpModule = APP_URL.startsWith('https') ? require('https') : http;
  console.log('⏰ Keep-alive enabled - pinging every 5 minutes');
  setInterval(() => {
    const now = new Date().toISOString();
    httpModule.get(`${APP_URL}/health`, (res) => {
      let data = ''; res.on('data', chunk => { data += chunk; }); res.on('end', () => { console.log(`⏰ Keep-alive ${res.statusCode === 200 ? 'OK' : 'FAILED'} [${now}]`); });
    }).on('error', err => { console.error(`❌ Keep-alive error [${now}]:`, err.message); });
  }, 5 * 60 * 1000);
  setTimeout(() => { httpModule.get(`${APP_URL}/health`, res => { console.log(`⏰ Initial ping: ${res.statusCode}`); }).on('error', err => { console.error('❌ Initial ping error:', err.message); }); }, 60 * 1000);
}

// ============ START SERVER ============

const PORT = process.env.PORT || 3000;

async function startServer() {
  try {
    await db.testConnection(); console.log('✅ Database connection successful\n');
    await db.initDatabase(); console.log('✅ Database tables initialized\n');
    await db.runMigrations(); console.log('✅ Database migrations completed\n');

    server.listen(PORT, async () => {
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('🚀 MULTI-STORE CHAT SERVER READY');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log(`📍 Server: http://localhost:${PORT}`);
      console.log(`🔌 WebSocket: ws://localhost:${PORT}/ws`);
      console.log(`✦  AI Suggestions: ${process.env.ANTHROPIC_API_KEY ? 'Enabled (Claude)' : 'Fallback mode (no API key)'}`);
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

      // ── Safety: ensure auto_replied_at exists before cron starts ──
      try {
        await db.pool.query(`
          ALTER TABLE conversations
            ADD COLUMN IF NOT EXISTS auto_replied_at TIMESTAMPTZ DEFAULT NULL
        `);
        const check = await db.pool.query(`
          SELECT column_name FROM information_schema.columns
          WHERE table_name = 'conversations' AND column_name = 'auto_replied_at'
        `);
        if (check.rows.length > 0) {
          console.log('✅ [Startup] auto_replied_at column confirmed');
        } else {
          console.error('❌ [Startup] auto_replied_at column STILL missing — auto-reply will not start');
          return;
        }
      } catch (err) {
        console.error('❌ [Startup] Failed to ensure auto_replied_at:', err.message);
        return;
      }

      setupKeepAlive();
      startEmailSweep(db.pool);

// ── Hourly Discord report — aligned to top of every hour ──
      function scheduleNextHourlyReport() {
        const now = new Date();
        const nextHour = new Date(now);
        nextHour.setHours(now.getHours() + 1, 0, 5, 0); // :00:05 of next hour
        const msUntilNextHour = nextHour - now;

        console.log(`📊 [Discord Stats] Next hourly report scheduled for ${nextHour.toLocaleString()} (in ${Math.round(msUntilNextHour / 1000 / 60)}m)`);

        setTimeout(async () => {
          console.log(`📊 [Discord Stats] Hourly tick at ${new Date().toLocaleString()}`);
          try {
            await sendHourlyResponseTimeStats();
          } catch (err) {
            console.error('📊 [Discord Stats] Hourly tick failed:', err.message);
          }
          scheduleNextHourlyReport(); // chain the next one
        }, msUntilNextHour);
      }

      // Startup report only in production — avoids spam during dev nodemon restarts.
      // In dev, the next report comes at the top of the next hour.
      if (process.env.NODE_ENV === 'production') {
        setTimeout(() => {
          console.log('📊 [Discord Stats] Sending startup report (then aligning to top-of-hour)');
          sendHourlyResponseTimeStats().catch(err =>
            console.error('📊 [Discord Stats] Startup report failed:', err.message)
          );
        }, 30 * 1000);
      } else {
        console.log('📊 [Discord Stats] Skipping startup report (dev mode) — next report at top of hour');
      }

      scheduleNextHourlyReport();

      // ── Daily report — fires once per day at DISCORD_DAILY_REPORT_HOUR (default 9 AM server time) ──
      function scheduleNextDailyReport() {
        const REPORT_HOUR = parseInt(process.env.DISCORD_DAILY_REPORT_HOUR || '9', 10);
        const now  = new Date();
        const next = new Date(now);
        next.setHours(REPORT_HOUR, 0, 5, 0);
        if (next <= now) next.setDate(next.getDate() + 1);
        const msUntilNext = next - now;

        console.log(`📊 [Discord Daily] Next daily report scheduled for ${next.toLocaleString()} (in ${Math.round(msUntilNext / 1000 / 60 / 60)}h)`);

        setTimeout(async () => {
          console.log(`📊 [Discord Daily] Daily tick at ${new Date().toLocaleString()}`);
          try {
            await sendDailyActivityStats();
          } catch (err) {
            console.error('📊 [Discord Daily] Daily tick failed:', err.message);
          }
          scheduleNextDailyReport();
        }, msUntilNext);
      }

      scheduleNextDailyReport();


      setInterval(async () => {
        try {
          const result = await db.pool.query(`UPDATE customer_presence SET status = 'offline', ws_connected = FALSE, updated_at = NOW() WHERE status != 'offline' AND last_heartbeat_at < NOW() - INTERVAL '3 minutes' RETURNING conversation_id`);
          if (result.rowCount > 0) console.log(`[Presence] Marked ${result.rowCount} stale sessions offline`);
        } catch (err) { console.error('[Presence] Stale cleanup error:', err); }
      }, 2 * 60 * 1000);

// ============ AUTO-REPLY (9-minute no-response rule) ============
const AUTO_REPLY_TEXT = 'We received your message and will answer you ASAP! We answer as early as next business day, sometimes even within a few hours!';

setInterval(async () => {
  try {
    // LAYER 1: Select candidate conversations.
    // Three conditions must hold:
    //   (a) Status is open (not closed/archived)
    //   (b) 8-hour rate limit not currently active
    //   (c) The single latest message in the conversation IS a customer message
    //       AND that message is at least 9 minutes old
    // Condition (c) uses MAX(sent_at) which inherently excludes ANY non-customer
    // reply — whether from agent, admin, or any other sender_type — because if
    // a non-customer message existed after the customer's, MAX(sent_at) would
    // point to THAT message and the EXISTS clause would fail.
    const { rows } = await db.pool.query(`
      SELECT c.id, c.shop_id
      FROM conversations c
      WHERE c.status = 'open'
        AND (
          c.auto_replied_at IS NULL
          OR c.auto_replied_at < NOW() - INTERVAL '8 hours'
        )
        AND EXISTS (
          SELECT 1 FROM messages m
          WHERE m.conversation_id = c.id
            AND m.sender_type = 'customer'
            AND m.sent_at = (
              SELECT MAX(sent_at) FROM messages WHERE conversation_id = c.id
            )
            AND m.sent_at < NOW() - INTERVAL '9 minutes'
        )
    `);

    for (const conv of rows) {
      try {

        const insertResult = await db.pool.query(
          `INSERT INTO messages
             (conversation_id, shop_id, sender_type, sender_name, content,
              message_type, file_data, sent_at, timestamp)
           SELECT $1, $2, 'agent', 'Support', $3, 'text', NULL, NOW(), NOW()
           WHERE NOT EXISTS (
             SELECT 1 FROM messages
             WHERE conversation_id = $1
               AND sender_type != 'customer'
               AND sent_at > (
                 SELECT MAX(sent_at) FROM messages
                 WHERE conversation_id = $1 AND sender_type = 'customer'
               )
           )
           RETURNING *`,
          [conv.id, conv.shop_id, AUTO_REPLY_TEXT]
        );
        if (insertResult.rows.length === 0) {
          console.log(`🤖 [Auto-reply] Skipped conv #${conv.id} — team replied in the meantime`);
          continue;
        }

        const saved = insertResult.rows[0];
        await db.pool.query(
          `UPDATE conversations
           SET auto_replied_at = NOW(),
               last_message = (
                 SELECT content FROM messages
                 WHERE conversation_id = $1
                   AND sender_type = 'customer'
                 ORDER BY sent_at DESC
                 LIMIT 1
               ),
               last_message_sender_type = 'customer'
           WHERE id = $1`,
          [conv.id]
        );

        const msg = { ...snakeToCamel(saved), isAutoReply: true };

        sendToConversation(conv.id, { type: 'new_message', message: msg });
        broadcastToAgents({ type: 'new_message', message: msg, conversationId: conv.id, storeId: conv.shop_id });

        const correctedConv = await db.pool.query(
          `SELECT c.*,
            (SELECT content FROM messages
             WHERE conversation_id = c.id AND sender_type = 'customer'
             ORDER BY sent_at DESC LIMIT 1) AS last_customer_message
           FROM conversations c WHERE c.id = $1`,
          [conv.id]
        );
        if (correctedConv.rows.length > 0) {
          const convData = snakeToCamel(correctedConv.rows[0]);
          broadcastToAgents({
            type: 'conversation_updated',
            conversationId: conv.id,
            conversation: {
              ...convData,
              lastMessage: convData.lastCustomerMessage || convData.lastMessage,
              lastMessageSenderType: 'customer',
              lastSenderType: 'customer',
            },
          });
        }

        console.log(`🤖 [Auto-reply] Sent to conv #${conv.id}`);
      } catch (err) {
        console.error(`🤖 [Auto-reply] Failed for conv #${conv.id}:`, err.message);
      }
    }
  } catch (err) {
    console.error('🤖 [Auto-reply] Query error:', err.message);
  }
}, 60 * 1000);
// ============ END AUTO-REPLY ============

    });
  } catch (error) {
    console.error('❌ FATAL: Failed to start server:', error.message);
    process.exit(1);
  }
}

startServer();

module.exports = { app, server };