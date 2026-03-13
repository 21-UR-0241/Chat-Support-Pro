


// module.exports = { app, server };
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const http = require('http');
const https = require('https');
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
const { handleOfflineEmailNotification, cancelPendingEmail, startEmailSweep, stopEmailSweep } = require('./services/emailService');

//added
const aiTrainingRoutes = require('./routes/ai-training-routes');
const { getBrainContext, refreshBrainCache, getBrainSettings } = require('./brain-context');


const app = express();
const server = http.createServer(app);

// Trust only first proxy (Render's load balancer)
app.set('trust proxy', 1);

// ============ UNIVERSAL CORS FIX ============
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
  res.header('Access-Control-Allow-Credentials', 'true');
  
  if (req.method === 'OPTIONS') {
    return res.sendStatus(204);
  }
  next();
});

// ============ INITIALIZE WEBSOCKET SERVER ============
console.log('🔌 Initializing WebSocket server...');
initWebSocketServer(server);
console.log('✅ WebSocket server initialized\n');

console.log('\n🚀 Multi-Store Chat Server Starting...\n');

// ============ HELPER FUNCTIONS ============

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
    /cease and desist/i,
    /class action/i,
    /attorney general/i,
    /fraud claim/i,
    /breach of contract/i,
    /consumer rights violation/i,
    /press charges|file charges/i,
    /law firm/i,
  ],
  high: [
    /lawsuit|sue\b|suing|litigation/i,
    /attorney|lawyer|legal counsel/i,
    /legal notice|demand letter/i,
    /ftc|federal trade commission/i,
    /criminal|illegal/i,
    /damages|liable|liability/i,
  ],
  medium: [
    /bbb|better business bureau/i,
    /chargeback dispute|credit card dispute/i,
    /report you|file a complaint/i,
    /fraud|scam/i,
    /negligence/i,
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
        return {
          detected: true,
          severity,
          matchedTerm: match[0],
          snippet: content.length > 200 ? content.substring(0, 200) + '...' : content,
        };
      }
    }
  }
  return { detected: true, severity: 'medium', matchedTerm: 'legal keyword', snippet: content.substring(0, 200) };
}

function detectLegalDocumentType(text) {
  const documentSignatures = [
    {
      type: 'Cease and Desist Letter',
      severity: 'critical',
      patterns: [/CEASE AND DESIST/i, /cease.{0,20}desist/i]
    },
    {
      type: 'Demand Letter',
      severity: 'critical',
      patterns: [/DEMAND LETTER/i, /formal demand/i, /hereby demand/i, /demand that you/i, /demand for payment/i]
    },
    {
      type: 'Court Summons / Complaint',
      severity: 'critical',
      patterns: [
        /SUMMONS/i,
        /PLAINTIFF.*DEFENDANT/is,
        /IN THE (SUPERIOR|DISTRICT|SUPREME|CIRCUIT|COUNTY|PROVINCIAL|SMALL CLAIMS) COURT/i,
        /COURT OF (QUEEN|KING)'S BENCH/i,
        /STATEMENT OF CLAIM/i,
        /NOTICE OF CIVIL CLAIM/i,
      ]
    },
    {
      type: 'BBB / Consumer Complaint',
      severity: 'high',
      patterns: [/BETTER BUSINESS BUREAU/i, /BBB COMPLAINT/i, /CONSUMER PROTECTION/i]
    },
    {
      type: 'Chargeback Notice',
      severity: 'high',
      patterns: [/CHARGEBACK/i, /DISPUTE NOTIFICATION/i, /RETRIEVAL REQUEST/i, /REASON CODE.{0,20}(fraud|not received|unauthorized)/i]
    },
    {
      type: 'Notice of Legal Action',
      severity: 'critical',
      patterns: [
        /NOTICE OF (LEGAL ACTION|INTENT TO SUE|LITIGATION)/i,
        /without further legal action/i,
        /legal proceedings will/i,
        /compelled to seek legal/i,
        /pursue legal remedies/i,
      ]
    },
    {
      type: 'Small Claims Filing',
      severity: 'critical',
      patterns: [/SMALL CLAIMS/i, /PLAINTIFF'S CLAIM/i, /CLAIM AMOUNT/i]
    },
  ];

  for (const sig of documentSignatures) {
    if (sig.patterns.some(p => p.test(text))) {
      return { type: sig.type, severity: sig.severity };
    }
  }

  // Structural heuristic: formal legal letter scoring
  const formalLetterScore = [
    /\bRE:\s/i,
    /\bDear (Sir|Madam|Counsel|Mr\.|Ms\.|Mrs\.)/i,
    /\bsincerely yours\b|\byours truly\b|\byours faithfully\b/i,
    /\b(Esq\.|Attorney at Law|Barrister|Solicitor|LLB|JD)\b/i,
    /\bwithout prejudice\b/i,
    /\bpursuant to\b/i,
    /\bhereby (notify|demand|give notice)\b/i,
  ].filter(p => p.test(text)).length;

  if (formalLetterScore >= 3) {
    return { type: 'Formal Legal Correspondence', severity: 'high' };
  }

  return null;
}

async function handleLegalThreat(threat, conversationId, storeId, senderName, messageContent, pool) {
  const emoji = threat.severity === 'critical' ? '🚨' : threat.severity === 'high' ? '⚠️' : '🔔';
  console.log(`${emoji} [LEGAL FLAG] Severity: ${threat.severity.toUpperCase()} | Conv: ${conversationId} | Term: "${threat.matchedTerm}" | From: ${senderName}`);

  try {
    await pool.query(`
      UPDATE conversations
      SET 
        priority = 'urgent',
        tags = CASE 
          WHEN tags IS NULL THEN ARRAY['legal-flag']
          WHEN NOT ('legal-flag' = ANY(tags)) THEN array_append(tags, 'legal-flag')
          ELSE tags
        END,
        legal_flag = TRUE,
        legal_flag_severity = $1,
        legal_flag_at = NOW(),
        legal_flag_term = $2,
        updated_at = NOW()
      WHERE id = $3
    `, [threat.severity, threat.matchedTerm, conversationId]);
  } catch (dbErr) {
    console.warn('[LEGAL FLAG] Extended columns not found, using fallback update:', dbErr.message);
    try {
      await pool.query(`
        UPDATE conversations SET priority = 'urgent', updated_at = NOW() WHERE id = $1
      `, [conversationId]);
    } catch (fallbackErr) {
      console.error('[LEGAL FLAG] Fallback DB update failed:', fallbackErr.message);
    }
  }

  broadcastToAgents({
    type: 'legal_threat_detected',
    alert: {
      conversationId,
      storeId,
      severity: threat.severity,
      matchedTerm: threat.matchedTerm,
      senderName,
      snippet: threat.snippet,
      timestamp: new Date().toISOString(),
      emoji,
      fromAttachment: threat.fromAttachment || false,
      documentType: threat.documentType || null,
      message: `${emoji} LEGAL THREAT DETECTED (${threat.severity.toUpperCase()}): "${threat.matchedTerm}" — from ${senderName}`,
    }
  });

  sendLegalFlagEmail(threat, conversationId, senderName, messageContent, pool).catch(err =>
    console.error('[LEGAL FLAG] Email notification failed:', err.message)
  );
}

async function sendLegalFlagEmail(threat, conversationId, senderName, messageContent, pool) {
  const RESEND_API_KEY = process.env.RESEND_API_KEY;
  const ALERT_EMAIL = process.env.LEGAL_ALERT_EMAIL || process.env.ADMIN_EMAIL;

  if (!RESEND_API_KEY || !ALERT_EMAIL) {
    console.warn('[LEGAL FLAG] No RESEND_API_KEY or LEGAL_ALERT_EMAIL set — skipping email alert');
    return;
  }

  const severity = threat.severity.toUpperCase();
  const emoji = threat.severity === 'critical' ? '🚨' : threat.severity === 'high' ? '⚠️' : '🔔';
  const appUrl = process.env.APP_URL || 'https://your-app.com';
  const sourceLabel = threat.fromAttachment
    ? `Uploaded Document (${threat.documentType || 'file'})`
    : 'Chat Message';

  const html = `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: ${threat.severity === 'critical' ? '#dc2626' : threat.severity === 'high' ? '#d97706' : '#2563eb'};
                  color: white; padding: 16px 24px; border-radius: 8px 8px 0 0;">
        <h1 style="margin: 0; font-size: 20px;">${emoji} Legal Threat Detected — ${severity}</h1>
      </div>
      <div style="background: #f9fafb; border: 1px solid #e5e7eb; border-top: none;
                  padding: 24px; border-radius: 0 0 8px 8px;">
        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="padding: 8px 0; color: #6b7280; width: 140px;">Severity</td>
            <td style="padding: 8px 0; font-weight: 600; color: #111827;">${severity}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #6b7280;">Matched Term</td>
            <td style="padding: 8px 0; font-weight: 600; color: #dc2626;">"${threat.matchedTerm}"</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #6b7280;">Source</td>
            <td style="padding: 8px 0; color: #111827;">${sourceLabel}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #6b7280;">From</td>
            <td style="padding: 8px 0; color: #111827;">${senderName}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #6b7280;">Conversation</td>
            <td style="padding: 8px 0; color: #111827;">#${conversationId}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #6b7280;">Time</td>
            <td style="padding: 8px 0; color: #111827;">${new Date().toLocaleString('en-US', { timeZone: 'America/Toronto' })} EST</td>
          </tr>
        </table>

        <div style="margin-top: 16px; padding: 12px 16px; background: #fff;
                    border-left: 4px solid #dc2626; border-radius: 4px;">
          <p style="margin: 0 0 4px; font-size: 12px; color: #6b7280; text-transform: uppercase;">Content Excerpt</p>
          <p style="margin: 0; color: #374151; font-style: italic;">"${threat.snippet}"</p>
        </div>

        <div style="margin-top: 24px; text-align: center;">
          <a href="${appUrl}/conversations/${conversationId}"
             style="display: inline-block; background: #111827; color: white;
                    padding: 10px 24px; border-radius: 6px; text-decoration: none; font-weight: 600;">
            Open Conversation →
          </a>
        </div>

        <p style="margin-top: 24px; font-size: 12px; color: #9ca3af; text-align: center;">
          This conversation has been automatically flagged and set to URGENT priority.<br>
          Do not ignore — respond or escalate within 24 hours.
        </p>
      </div>
    </div>
  `;

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: process.env.EMAIL_FROM || 'alerts@yourdomain.com',
      to: ALERT_EMAIL,
      subject: `${emoji} [${severity}] Legal Threat — Conv #${conversationId} — "${threat.matchedTerm}"`,
      html,
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Resend API error: ${err}`);
  }

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
  } catch (err) {
    console.error('[PDF Extract] Error:', err.message);
    return '';
  }
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
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1000,
        messages: [{
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: mimeType, data: base64 } },
            { type: 'text', text: 'Extract all text from this image exactly as written. Return only the raw text, no commentary.' }
          ]
        }]
      }),
      signal: AbortSignal.timeout(20000),
    });

    const data = await apiResponse.json();
    return data.content?.[0]?.text || '';
  } catch (err) {
    console.error('[Image OCR] Error:', err.message);
    return '';
  }
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
    } else {
      return;
    }

    if (!extractedText) return;

    console.log(`[LEGAL ATTACH] Extracted ${extractedText.length} chars from file`);

    const docType = detectLegalDocumentType(extractedText);
    if (docType) {
      console.log(`🚨 [LEGAL ATTACH] Legal document detected: ${docType.type}`);
      await handleLegalThreat(
        {
          detected: true,
          severity: docType.severity,
          matchedTerm: docType.type,
          snippet: extractedText.substring(0, 300),
          fromAttachment: true,
          documentType: docType.type,
        },
        conversationId, storeId, senderName,
        `[ATTACHED DOCUMENT] ${extractedText.substring(0, 500)}`,
        pool
      );
      return;
    }

    const threat = detectLegalThreat(extractedText);
    if (threat) {
      threat.fromAttachment = true;
      await handleLegalThreat(threat, conversationId, storeId, senderName, extractedText, pool);
    }

  } catch (err) {
    console.error('[LEGAL ATTACH] File analysis failed:', err.message);
  }
}

// Security headers (relaxed for widget embedding)
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: { policy: "cross-origin" },
  frameguard: false
}));

// ⚠️ IMPORTANT: Webhook route BEFORE express.json()
app.post('/webhooks/:shop/:topic', rawBodyMiddleware, handleWebhook);

// JSON middleware for other routes
// app.use(express.json());

app.use(express.json({ limit: '10mb' }));

app.use(session({
  secret: process.env.JWT_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
}));

// ============ WIDGET STATIC FILES ============

app.get('/widget-init.js', (req, res) => {
  res.set({
    'Content-Type': 'application/javascript; charset=utf-8',
    'Cache-Control': 'public, max-age=3600',
    'X-Content-Type-Options': 'nosniff',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization'
  });
  
  res.sendFile(__dirname + '/public/widget-init.js');
});

app.get('/widget.html', (req, res) => {
  res.removeHeader('X-Frame-Options');
  
  res.set({
    'Content-Type': 'text/html; charset=utf-8',
    'X-Content-Type-Options': 'nosniff',
    'Cache-Control': 'no-cache, must-revalidate',
    'Content-Security-Policy': "frame-ancestors *"
  });
  
  res.sendFile(__dirname + '/public/widget.html');
});

app.use(express.static('public'));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      try {
        const { verifyToken } = require('./auth');
        const user = verifyToken(authHeader.split(' ')[1]);
        return !!user;
      } catch (e) {
        return false;
      }
    }
    return false;
  },
  validate: {
    xForwardedForHeader: false,
    trustProxy: false
  }
});

const widgetLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 500,
  message: 'Too many requests, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  validate: {
    xForwardedForHeader: false,
    trustProxy: false
  }
});

app.use('/api/widget/', widgetLimiter);
app.use('/api/customers/', widgetLimiter);
app.use('/api/', limiter);

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: 'Too many login attempts, please try again later.',
  skipSuccessfulRequests: true,
  validate: {
    xForwardedForHeader: false,
    trustProxy: false
  }
});

// Force HTTPS in production
if (process.env.NODE_ENV === 'production') {
  app.use((req, res, next) => {
    if (req.header('x-forwarded-proto') !== 'https') {
      res.redirect(`https://${req.header('host')}${req.url}`);
    } else {
      next();
    }
  });
}

// Request logger
app.use((req, res, next) => {
  console.log(`${req.method} ${req.path}`);
  next();
});

// ============ HEALTH CHECK ============

app.get('/health', async (req, res) => {
  try {
    await db.testConnection();
    const wsStats = getWebSocketStats();
    
    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      database: 'connected',
      websocket: {
        active: wsStats.totalConnections > 0,
        connections: wsStats.totalConnections,
        agents: wsStats.agentCount,
        customers: wsStats.customerCount,
        authenticated: wsStats.authenticatedCount,
        activeConversations: wsStats.activeConversations
      },
      uptime: Math.floor(process.uptime()),
      version: process.env.npm_package_version || '1.0.0',
    });
  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      error: error.message,
      timestamp: new Date().toISOString(),
    });
  }
});

// ============ WIDGET API ENDPOINTS ============

app.get('/api/stores/verify', async (req, res) => {
  try {
    const { domain } = req.query;
    
    if (!domain) {
      return res.status(400).json({ error: 'domain parameter required' });
    }
    
    const store = await db.getStoreByDomain(domain);
    
    if (!store || !store.is_active) {
      return res.status(404).json({ 
        error: 'Store not found or inactive',
        message: 'Please install the chat app from Shopify'
      });
    }
    
    res.json({
      storeId: store.id,
      storeIdentifier: store.store_identifier,
      shopDomain: store.shop_domain,
      brandName: store.brand_name,
      active: store.is_active,
      verified: true
    });
  } catch (error) {
    console.error('Store verification error:', error);
    res.status(500).json({ error: 'Verification failed' });
  }
});

app.get('/api/widget/settings', async (req, res) => {
  try {
    const { store: storeIdentifier } = req.query;
    
    if (!storeIdentifier) {
      return res.status(400).json({ error: 'store parameter required' });
    }
    
    const store = await db.getStoreByIdentifier(storeIdentifier);
    
    if (!store || !store.is_active) {
      return res.status(404).json({ error: 'Store not found or inactive' });
    }
    
    res.json({
      storeId: store.id,
      storeIdentifier: store.store_identifier,
      brandName: store.brand_name,
      primaryColor: store.primary_color || '#667eea',
      logoUrl: store.logo_url,
      widgetSettings: store.widget_settings || {
        position: 'bottom-right',
        greeting: 'Hi! How can we help you today?',
        placeholder: 'Type your message...',
        showAvatar: true
      },
      businessHours: store.business_hours,
      timezone: store.timezone || 'UTC'
    });
  } catch (error) {
    console.error('Widget settings error:', error);
    res.status(500).json({ error: 'Failed to fetch settings' });
  }
});

app.get('/api/widget/session', async (req, res) => {
  try {
    const { store } = req.query;

    if (!store) {
      return res.status(400).json({ error: 'store parameter required' });
    }

    const storeRecord = await db.getStoreByIdentifier(store);
    if (!storeRecord || !storeRecord.is_active) {
      return res.status(404).json({ error: 'Store not found or inactive' });
    }

    const { generateWidgetToken } = require('./auth');
    const token = generateWidgetToken(storeRecord);

    res.json({
      token,
      expiresIn: process.env.WIDGET_JWT_EXPIRES_IN || '2h'
    });
  } catch (error) {
    console.error('Widget session error:', error);
    res.status(500).json({ error: 'Failed to create widget session' });
  }
});

app.get('/api/widget/conversation/lookup', async (req, res) => {
  try {
    const { store, email } = req.query;
    console.log(`🔍 [Widget Lookup] store=${store}, email=${email}`);
    
    if (!store || !email) {
      return res.status(400).json({ error: 'store and email parameters required' });
    }
    
    const storeRecord = await db.getStoreByIdentifier(store);
    if (!storeRecord || !storeRecord.is_active) {
      console.log(`❌ [Widget Lookup] Store not found for identifier: ${store}`);
      return res.status(404).json({ error: 'Store not found or inactive' });
    }
    console.log(`✅ [Widget Lookup] Store found: id=${storeRecord.id}, identifier=${storeRecord.store_identifier}, domain=${storeRecord.shop_domain}`);
    
    let conversations = await db.getConversations({ storeId: storeRecord.id });
    console.log(`📋 [Widget Lookup] getConversations returned ${conversations.length} conversations for storeId=${storeRecord.id}`);
    
    const getField = (obj, snake, camel) => obj[snake] ?? obj[camel];
    
    let match = conversations.find(c => 
      getField(c, 'customer_email', 'customerEmail') === email && getField(c, 'status', 'status') === 'open'
    );
    if (!match) {
      match = conversations.find(c => getField(c, 'customer_email', 'customerEmail') === email);
    }
    
    if (!match) {
      console.log(`⚠️ [Widget Lookup] Not found in store-filtered results, trying broader search...`);
      const allConversations = await db.getConversations({});
      console.log(`📋 [Widget Lookup] Broad search returned ${allConversations.length} total conversations`);
      
      const emailMatches = allConversations.filter(c => getField(c, 'customer_email', 'customerEmail') === email);
      console.log(`📋 [Widget Lookup] Found ${emailMatches.length} conversations with email=${email}`);
      
      const storeMatches = emailMatches.filter(c => {
        const cStoreId = getField(c, 'store_id', 'storeId');
        const cStoreIdent = getField(c, 'store_identifier', 'storeIdentifier');
        return String(cStoreId) === String(storeRecord.id) ||
          cStoreIdent === storeRecord.shop_domain ||
          cStoreIdent === storeRecord.store_identifier ||
          cStoreIdent === store;
      });
      
      match = storeMatches.find(c => getField(c, 'status', 'status') === 'open') || storeMatches[0];
    }
    
    if (match) {
      const matchId = match.id;
      const matchStoreId = getField(match, 'store_id', 'storeId');
      const matchStatus = getField(match, 'status', 'status');
      console.log(`✅ [Widget Lookup] Found conversation ${matchId} for ${email} (store_id=${matchStoreId}, status=${matchStatus})`);
      res.json({ conversationId: matchId });
    } else {
      console.log(`ℹ️ [Widget Lookup] No conversation found for ${email} in store ${store}`);
      res.json({ conversationId: null });
    }
  } catch (error) {
    console.error('❌ Widget conversation lookup error:', error);
    res.status(500).json({ error: 'Lookup failed' });
  }
});

// ============ AUTHENTICATION ENDPOINTS ============

app.post('/api/employees/login', loginLimiter, async (req, res) => {
  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }
    
    if (!email.includes('@')) {
      return res.status(400).json({ error: 'Invalid email format' });
    }
    
    const employee = await db.getEmployeeByEmail(email);
    
    if (!employee) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }
    
    if (!employee.is_active) {
      return res.status(403).json({ error: 'Account is inactive' });
    }
    
    const validPassword = await verifyPassword(password, employee.password_hash);
    
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }
    
    await db.updateEmployeeStatus(employee.id, { 
      last_login: new Date(),
      is_online: true 
    });
    
    const token = generateToken(employee);
    
    delete employee.password_hash;
    delete employee.api_token;
    
    res.json({
      employee: snakeToCamel(employee),
      token,
      expiresIn: '7d'
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed. Please try again.' });
  }
});

app.post('/api/employees/logout', authenticateToken, async (req, res) => {
  try {
    await db.updateEmployeeStatus(req.user.id, { is_online: false });
    res.json({ message: 'Logged out successfully' });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ error: 'Logout failed' });
  }
});

app.get('/api/auth/verify', authenticateToken, async (req, res) => {
  try {
    const employee = await db.getEmployeeByEmail(req.user.email);
    
    if (!employee || !employee.is_active) {
      return res.status(403).json({ error: 'Invalid session' });
    }
    
    delete employee.password_hash;
    delete employee.api_token;
    
    res.json({ employee: snakeToCamel(employee) });
  } catch (error) {
    res.status(500).json({ error: 'Verification failed' });
  }
});

// ============ SHOPIFY OAUTH ROUTES ============

app.get('/auth', async (req, res) => {
  try {
    const { shop } = req.query;
    if (!shop) {
      return res.status(400).json({ error: 'Shop parameter required' });
    }
    const authUrl = await getAuthUrl(shop);
    res.redirect(authUrl);
  } catch (error) {
    console.error('Auth error:', error);
    res.status(500).json({ error: 'Authentication failed' });
  }
});

app.get('/auth/callback', handleCallback);

// ============ SHOPIFY APP ROUTES ============
app.use('/shopify', shopifyAppRoutes);

// ============ FILE UPLOAD ROUTES ============
app.use('/api/files', fileRoutes);

//added
app.use('/api/ai/training', aiTrainingRoutes);
// ============ STORE ENDPOINTS ============

app.get('/api/stores', authenticateToken, async (req, res) => {
  try {
    const stores = await db.getAllActiveStores();
    res.json(stores.map(snakeToCamel));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/customer-context/:storeId/:email', authenticateToken, async (req, res) => {
  try {
    const store = await db.getStoreByIdentifier(req.params.storeId);
    if (!store) {
      return res.status(404).json({ error: 'Store not found' });
    }
    
    const context = await shopify.getCustomerContext(store, req.params.email);
    res.json(context);
  } catch (error) {
    console.error('Customer context error:', error);
    res.status(500).json({ error: 'Failed to fetch customer context' });
  }
});

// ============ CUSTOMER & ORDER LOOKUP ENDPOINTS ============

app.get('/api/customers/lookup', async (req, res) => {
  try {
    const { store: storeIdentifier, email } = req.query;
    
    if (!storeIdentifier || !email) {
      return res.status(400).json({ error: 'store and email parameters required' });
    }
    
    const store = await db.getStoreByIdentifier(storeIdentifier);
    if (!store || !store.is_active) {
      return res.status(404).json({ error: 'Store not found or inactive' });
    }
    
    const customerContext = await shopify.getCustomerContext(store, email);
    
    if (!customerContext || !customerContext.customer) {
      return res.status(404).json({ error: 'Customer not found' });
    }
    
    const customer = customerContext.customer;
    
    res.json({
      id: customer.id,
      name: customer.name || `${customer.first_name || ''} ${customer.last_name || ''}`.trim(),
      email: customer.email,
      phone: customer.phone,
      createdAt: customer.created_at,
      updatedAt: customer.updated_at,
      ordersCount: customer.orders_count || 0,
      totalSpent: customer.total_spent ? parseFloat(customer.total_spent) : 0,
      tags: customer.tags,
      note: customer.note
    });
  } catch (error) {
    console.error('Customer lookup error:', error);
    res.status(500).json({ 
      error: 'Failed to fetch customer data',
      message: error.message 
    });
  }
});

app.get('/api/customers/orders', async (req, res) => {
  try {
    const { store: storeIdentifier, email } = req.query;
    
    if (!storeIdentifier || !email) {
      return res.status(400).json({ error: 'store and email parameters required' });
    }
    
    const store = await db.getStoreByIdentifier(storeIdentifier);
    if (!store || !store.is_active) {
      return res.status(404).json({ error: 'Store not found or inactive' });
    }
    
    const customerContext = await shopify.getCustomerContext(store, email);
    
    if (!customerContext || !customerContext.orders) {
      return res.json([]);
    }
    
    const formattedOrders = customerContext.orders.map(order => ({
      id: order.id,
      orderNumber: order.order_number || order.name,
      status: order.financial_status || 'pending',
      fulfillmentStatus: order.fulfillment_status,
      total: order.total_price ? parseFloat(order.total_price) : 0,
      currency: order.currency,
      orderDate: order.created_at,
      items: order.line_items ? order.line_items.map(item => ({
        id: item.id,
        title: item.title,
        quantity: item.quantity,
        price: parseFloat(item.price)
      })) : [],
      trackingNumber: order.tracking_number,
      trackingUrl: order.tracking_url
    }));
    
    formattedOrders.sort((a, b) => new Date(b.orderDate) - new Date(a.orderDate));
    
    res.json(formattedOrders);
  } catch (error) {
    console.error('Customer orders error:', error);
    res.status(500).json({ 
      error: 'Failed to fetch orders',
      message: error.message 
    });
  }
});

app.get('/api/customers/cart', async (req, res) => {
  try {
    const { store: storeIdentifier, email } = req.query;
    
    if (!storeIdentifier || !email) {
      return res.status(400).json({ error: 'store and email parameters required' });
    }
    
    const store = await db.getStoreByIdentifier(storeIdentifier);
    if (!store || !store.is_active) {
      return res.status(404).json({ error: 'Store not found or inactive' });
    }
    
    res.json({
      subtotal: 0,
      items: [],
      itemCount: 0
    });
    
  } catch (error) {
    console.error('Customer cart error:', error);
    res.status(500).json({ 
      error: 'Failed to fetch cart',
      message: error.message 
    });
  }
});

app.post('/api/stores/:storeId/webhooks', authenticateToken, async (req, res) => {
  try {
    const store = await db.getStoreByIdentifier(req.params.storeId);
    if (!store) {
      return res.status(404).json({ error: 'Store not found' });
    }
    
    const webhookUrl = req.body.webhookUrl || `${process.env.APP_URL}/webhooks`;
    const results = await shopify.registerWebhooks(store, webhookUrl);
    
    res.json({ results });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});





app.get('/api/employees/:employeeId/notes', authenticateToken, async (req, res) => {
  try {
    const result = await db.pool.query(
      `SELECT 
        id,
        employee_id,
        employee_name,
        title,
        content,
        created_at,
        updated_at
      FROM employee_notes
      ORDER BY created_at DESC`
    );

    console.log(`✅ [Notes] Found ${result.rows.length} total notes`);
    res.json(result.rows.map(snakeToCamel));
  } catch (error) {
    console.error('❌ Error fetching employee notes:', error);
    res.status(500).json({ error: 'Failed to fetch notes' });
  }
});

// Create a new note with title
app.post('/api/conversation-notes', authenticateToken, async (req, res) => {
  try {
    // if (req.user.role !== 'admin') {
    //   return res.status(403).json({ error: 'Admin access required' });
    // }

    const { employeeId, title, content } = req.body;

    if (!employeeId) {
      return res.status(400).json({ error: 'Missing employeeId' });
    }

    if (!title && !content) {
      return res.status(400).json({ error: 'Note must have a title or content' });
    }

    const noteTitle = (title && title.trim()) || 'Untitled';
    const noteContent = (content && content.trim()) || '';

    if (noteTitle.length > 200) {
      return res.status(400).json({ error: 'Title exceeds 200 characters' });
    }

    if (noteContent.length > 5000) {
      return res.status(400).json({ error: 'Content exceeds 5000 characters' });
    }

    const employeeResult = await db.pool.query(
      'SELECT name FROM employees WHERE id = $1',
      [employeeId]
    );

    if (employeeResult.rows.length === 0) {
      return res.status(404).json({ error: 'Employee not found' });
    }

    const employeeName = employeeResult.rows[0].name;

    const result = await db.pool.query(
      `INSERT INTO employee_notes 
        (employee_id, employee_name, title, content, created_at, updated_at)
      VALUES ($1, $2, $3, $4, NOW(), NOW())
      RETURNING id, employee_id, employee_name, title, content, created_at, updated_at`,
      [employeeId, employeeName, noteTitle, noteContent]
    );

    console.log('✅ Note created:', result.rows[0].id, '- Title:', noteTitle);
    res.status(201).json(snakeToCamel(result.rows[0]));
  } catch (error) {
    console.error('Error creating note:', error);
    res.status(500).json({ error: 'Failed to create note' });
  }
});

// Delete a note (unchanged)
app.delete('/api/conversation-notes/:noteId', authenticateToken, async (req, res) => {
  try {
    // if (req.user.role !== 'admin') {
    //   return res.status(403).json({ error: 'Admin access required' });
    // }

    const noteId = parseInt(req.params.noteId);
    const employeeId = req.user.id;

    const noteResult = await db.pool.query(
      'SELECT employee_id FROM employee_notes WHERE id = $1',
      [noteId]
    );

    if (noteResult.rows.length === 0) {
      return res.status(404).json({ error: 'Note not found' });
    }

    if (noteResult.rows[0].employee_id !== employeeId) {
      return res.status(403).json({ error: 'You can only delete your own notes' });
    }

    await db.pool.query('DELETE FROM employee_notes WHERE id = $1', [noteId]);

    console.log('✅ Note deleted:', noteId);
    res.json({ success: true, message: 'Note deleted' });
  } catch (error) {
    console.error('Error deleting note:', error);
    res.status(500).json({ error: 'Failed to delete note' });
  }
});

// ============ CONVERSATION ENDPOINTS ============

app.get('/api/conversations', authenticateToken, async (req, res) => {
  try {
    const { storeId, status, limit, offset } = req.query;
    
    const filters = {};
    if (storeId) filters.storeId = parseInt(storeId);
    if (status) filters.status = status;
    if (limit) filters.limit = parseInt(limit);
    if (offset) filters.offset = parseInt(offset);
    
    const conversations = await db.getConversations(filters);
    res.json(conversations.map(snakeToCamel));
  } catch (error) {
    console.error('Get conversations error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/conversations/:id', authenticateToken, async (req, res) => {
  try {
    const conversationId = parseInt(req.params.id);
    const conversation = await db.getConversation(conversationId);

    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    res.json(snakeToCamel(conversation));
  } catch (error) {
    console.error('Error fetching conversation:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/conversations', async (req, res) => {
  try {
    const { storeIdentifier, customerEmail, customerName, initialMessage, fileData } = req.body;
    
    if (!storeIdentifier || !customerEmail) {
      return res.status(400).json({ error: 'storeIdentifier and customerEmail required' });
    }
    
    const store = await db.getStoreByIdentifier(storeIdentifier);
    if (!store) {
      return res.status(404).json({ error: 'Store not found' });
    }
    
    const conversation = await db.saveConversation({
      store_id: store.id,
      store_identifier: store.shop_domain,
      customer_email: customerEmail,
      customer_name: customerName || customerEmail,
      status: 'open',
      priority: 'normal'
    });
    
    res.json(snakeToCamel(conversation));
    
    setImmediate(async () => {
      try {
        if (initialMessage) {
          const message = await db.saveMessage({
            conversation_id: conversation.id,
            store_id: store.id,
            sender_type: 'customer',
            sender_name: customerName || customerEmail,
            content: initialMessage,
            file_data: fileData ? JSON.stringify(fileData) : null
          });
          
          const camelMessage = snakeToCamel(message);
          
          broadcastToAgents({
            type: 'new_message',
            message: camelMessage,
            conversationId: conversation.id,
            storeId: store.id
          });
        }
        
        broadcastToAgents({
          type: 'new_conversation',
          conversation: snakeToCamel(conversation),
          storeId: store.id,
          storeIdentifier
        });
      } catch (error) {
        console.error('Background conversation processing error:', error);
      }
    });
    
  } catch (error) {
    console.error('Create conversation error:', error);
    res.status(500).json({ 
      error: error.message,
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

app.put('/api/conversations/:id', authenticateToken, async (req, res) => {
  try {
    const conversation = await db.updateConversation(parseInt(req.params.id), req.body);
    res.json(snakeToCamel(conversation));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/conversations/:id/read', authenticateToken, async (req, res) => {
  try {
    const conversationId = parseInt(req.params.id);
    
    await db.markConversationRead(conversationId);
    
    const updatedConversation = await db.getConversation(conversationId);
    broadcastToAgents({
      type: 'conversation_read',
      conversationId,
      conversation: snakeToCamel(updatedConversation)
    });
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error marking conversation as read:', error);
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/conversations/:id/close', authenticateToken, async (req, res) => {
  try {
    const conversation = await db.closeConversation(parseInt(req.params.id));
    res.json(snakeToCamel(conversation));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============ MESSAGE ENDPOINTS ============

app.get('/api/widget/conversations/:id/messages', async (req, res) => {
  try {
    const { store } = req.query;
    
    if (!store) {
      return res.status(400).json({ error: 'store parameter required' });
    }

    const storeRecord = await db.getStoreByIdentifier(store);
    if (!storeRecord || !storeRecord.is_active) {
      return res.status(404).json({ error: 'Store not found or inactive' });
    }

    const conversationId = parseInt(req.params.id);
    const conversation = await db.getConversation(conversationId);

    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    const convStoreId = conversation.shop_id ?? conversation.shopId ?? conversation.store_id ?? conversation.storeId;
    const convStoreIdentifier = conversation.shop_domain ?? conversation.shopDomain ?? conversation.store_identifier ?? conversation.storeIdentifier;

    const storeIdMatch = String(convStoreId) === String(storeRecord.id);
    const identifierMatch = convStoreIdentifier && (
      convStoreIdentifier === storeRecord.shop_domain ||
      convStoreIdentifier === storeRecord.store_identifier ||
      convStoreIdentifier === store
    );
    
    if (!storeIdMatch && !identifierMatch) {
      console.warn(`❌ [Widget History] Access denied: conv ${conversationId} store_id=${convStoreId} store_identifier=${convStoreIdentifier} does not match store id=${storeRecord.id} identifier=${storeRecord.store_identifier} domain=${storeRecord.shop_domain}`);
      return res.status(403).json({ error: 'Unauthorized' });
    }

    const messages = await db.getMessages(conversationId);
    console.log(`✅ [Widget History] Returning ${messages.length} messages for conversation ${conversationId} (matched by ${storeIdMatch ? 'store_id' : 'store_identifier'})`);
    res.json(messages.map(snakeToCamel));
  } catch (error) {
    console.error('❌ Widget message history error:', error);
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
});

app.get('/api/conversations/:id/messages', authenticateToken, async (req, res) => {
  try {
    const conversationId = parseInt(req.params.id);
    const messages = await db.getMessages(conversationId);

    await db.markConversationRead(conversationId);
    
    const updatedConversation = await db.getConversation(conversationId);
    broadcastToAgents({
      type: 'conversation_read',
      conversationId,
      conversation: snakeToCamel(updatedConversation)
    });

    res.json(messages.map(snakeToCamel));
  } catch (error) {
    console.error('Error fetching messages:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/messages', authenticateToken, async (req, res) => {
  try {
    const { conversationId, senderType, senderName, content, storeId, fileData } = req.body;
    
    if (!conversationId || !senderType) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    if (!content && !fileData) {
      return res.status(400).json({ error: 'Message must have text or a file attachment' });
    }
    
    const timestamp = new Date();
    const tempId = `temp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    const tempMessage = {
      id: tempId,
      conversationId: conversationId,
      storeId: storeId,
      senderType: senderType,
      senderName: senderName,
      content: content || '',
      fileData: fileData,
      createdAt: timestamp,
      pending: true
    };
    
    sendToConversation(conversationId, {
      type: 'new_message',
      message: snakeToCamel(tempMessage)
    });
    
    broadcastToAgents({
      type: 'new_message',
      message: snakeToCamel(tempMessage),
      conversationId,
      storeId
    });
    
    res.json(snakeToCamel(tempMessage));
    
    setImmediate(async () => {
      try {
        const savedMessage = await db.saveMessage({
          conversation_id: conversationId,
          store_id: storeId,
          sender_type: senderType,
          sender_name: senderName,
          content: content || '',
          file_data: fileData ? JSON.stringify(fileData) : null,
          sent_at: timestamp
        });
        
        sendToConversation(conversationId, {
          type: 'message_confirmed',
          tempId: tempId,
          message: snakeToCamel(savedMessage)
        });
        
        broadcastToAgents({
          type: 'message_confirmed',
          tempId: tempId,
          message: snakeToCamel(savedMessage),
          conversationId,
          storeId
        });
        
        if (senderType === 'agent') {
          handleOfflineEmailNotification(db.pool, savedMessage).catch(err =>
            console.error('[Offline Email] Failed:', err)
          );
        }
        
      } catch (error) {
        console.error('Failed to save agent message:', error);
        
        sendToConversation(conversationId, {
          type: 'message_failed',
          tempId: tempId
        });
      }
    });
    
  } catch (error) {
    console.error('Send message error:', error);
    res.status(500).json({ error: error.message });
  }
});


//don't remove!
// app.post('/api/widget/messages', async (req, res) => {
//   try {
//     const { conversationId, customerEmail, customerName, content, storeIdentifier, fileData } = req.body;
    
//     if (!conversationId) {
//       return res.status(400).json({ error: 'Missing required fields' });
//     }
    
//     if (!content && !fileData) {
//       return res.status(400).json({ error: 'Message must have text or a file attachment' });
//     }
    
//     const store = await db.getStoreByIdentifier(storeIdentifier);
//     if (!store) {
//       return res.status(404).json({ error: 'Store not found' });
//     }
    
//     const conversation = await db.getConversation(conversationId);
    
//     if (!conversation) {
//       return res.status(404).json({ 
//         error: 'conversation_not_found',
//         message: 'This conversation no longer exists'
//       });
//     }
    
//     const timestamp = new Date();
//     const tempId = `temp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
//     const tempMessage = {
//       id: tempId,
//       conversationId: conversationId,
//       storeId: store.id,
//       senderType: 'customer',
//       senderName: customerName || customerEmail,
//       content: content || '',
//       fileData: fileData,
//       createdAt: timestamp,
//       pending: true
//     };
    
//     sendToConversation(conversationId, {
//       type: 'new_message',
//       message: snakeToCamel(tempMessage)
//     });
    
//     broadcastToAgents({
//       type: 'new_message',
//       message: snakeToCamel(tempMessage),
//       conversationId,
//       storeId: store.id
//     });
    
//     res.json(snakeToCamel(tempMessage));
    
//     setImmediate(async () => {
//       try {
//         const savedMessage = await db.saveMessage({
//           conversation_id: conversationId,
//           store_id: store.id,
//           sender_type: 'customer',
//           sender_name: customerName || customerEmail,
//           content: content || '',
//           file_data: fileData ? JSON.stringify(fileData) : null
//         });
        
//         const updatedConversation = await db.getConversation(conversationId);
        
//         const confirmedMessage = snakeToCamel(savedMessage);
        
//         sendToConversation(conversationId, {
//           type: 'message_confirmed',
//           tempId: tempId,
//           message: confirmedMessage
//         });
        
//         broadcastToAgents({
//           type: 'message_confirmed',
//           tempId: tempId,
//           message: confirmedMessage,
//           conversationId,
//           storeId: store.id,
//           conversation: snakeToCamel(updatedConversation)
//         });
        
//       } catch (error) {
//         console.error('Failed to save message:', error);
        
//         sendToConversation(conversationId, {
//           type: 'message_failed',
//           tempId: tempId,
//           error: 'Failed to save message'
//         });
//       }
//     });
    
//   } catch (error) {
//     console.error('Widget message error:', error);
//     res.status(500).json({ 
//       error: 'Failed to send message',
//       message: error.message 
//     });
//   }
// });

app.post('/api/widget/messages', async (req, res) => {
  try {
    const { conversationId, customerEmail, customerName, content, storeIdentifier, fileData } = req.body;
    
    if (!conversationId) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    if (!content && !fileData) {
      return res.status(400).json({ error: 'Message must have text or a file attachment' });
    }
    
    const store = await db.getStoreByIdentifier(storeIdentifier);
    if (!store) {
      return res.status(404).json({ error: 'Store not found' });
    }
    
    const conversation = await db.getConversation(conversationId);
    
    if (!conversation) {
      return res.status(404).json({ 
        error: 'conversation_not_found',
        message: 'This conversation no longer exists'
      });
    }
    
    const timestamp = new Date();
    const tempId = `temp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    const tempMessage = {
      id: tempId,
      conversationId: conversationId,
      storeId: store.id,
      senderType: 'customer',
      senderName: customerName || customerEmail,
      content: content || '',
      fileData: fileData,
      createdAt: timestamp,
      pending: true
    };
    
    sendToConversation(conversationId, {
      type: 'new_message',
      message: snakeToCamel(tempMessage)
    });
    
    broadcastToAgents({
      type: 'new_message',
      message: snakeToCamel(tempMessage),
      conversationId,
      storeId: store.id
    });
    
    res.json(snakeToCamel(tempMessage));
    
    setImmediate(async () => {
      try {
        const savedMessage = await db.saveMessage({
          conversation_id: conversationId,
          store_id: store.id,
          sender_type: 'customer',
          sender_name: customerName || customerEmail,
          content: content || '',
          file_data: fileData ? JSON.stringify(fileData) : null
        });
        
        const updatedConversation = await db.getConversation(conversationId);
        const confirmedMessage = snakeToCamel(savedMessage);
        
        sendToConversation(conversationId, {
          type: 'message_confirmed',
          tempId: tempId,
          message: confirmedMessage
        });
        
        broadcastToAgents({
          type: 'message_confirmed',
          tempId: tempId,
          message: confirmedMessage,
          conversationId,
          storeId: store.id,
          conversation: snakeToCamel(updatedConversation)
        });

        // ── Legal threat detection ──────────────────────────────
        // 1. Scan text content
        if (content) {
          const legalThreat = detectLegalThreat(content);
          if (legalThreat) {
            handleLegalThreat(
              legalThreat,
              conversationId,
              store.id,
              customerName || customerEmail,
              content,
              db.pool
            ).catch(err => console.error('[LEGAL FLAG] Text handler error:', err.message));
          }
        }

        // 2. Scan file attachments (PDF / image)
        if (fileData) {
          analyzeLegalAttachment(
            fileData,
            conversationId,
            store.id,
            customerName || customerEmail,
            db.pool
          ).catch(err => console.error('[LEGAL FLAG] Attachment handler error:', err.message));
        }
        // ────────────────────────────────────────────────────────

      } catch (error) {
        console.error('Failed to save message:', error);
        
        sendToConversation(conversationId, {
          type: 'message_failed',
          tempId: tempId,
          error: 'Failed to save message'
        });
      }
    });
    
  } catch (error) {
    console.error('Widget message error:', error);
    res.status(500).json({ 
      error: 'Failed to send message',
      message: error.message 
    });
  }
});


// ============ DELETE MESSAGE (admin only) ============

app.delete('/api/messages/:id', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const messageId = parseInt(req.params.id);

    if (isNaN(messageId)) {
      return res.status(400).json({ error: 'Invalid message ID' });
    }

    const existing = await db.pool.query(
      'SELECT id, conversation_id FROM messages WHERE id = $1',
      [messageId]
    );

    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Message not found' });
    }

    const { conversation_id } = existing.rows[0];

    await db.pool.query('DELETE FROM messages WHERE id = $1', [messageId]);

    console.log(`🗑️ [Messages] Admin ${req.user.email} deleted message ${messageId} from conversation ${conversation_id}`);

    // Notify connected clients so the message disappears in real time
    broadcastToAgents({
      type: 'message_deleted',
      messageId,
      conversationId: conversation_id,
    });

    sendToConversation(conversation_id, {
      type: 'message_deleted',
      messageId,
      conversationId: conversation_id,
    });

    res.json({ success: true, messageId });
  } catch (error) {
    console.error('❌ Delete message error:', error);
    res.status(500).json({ error: 'Failed to delete message' });
  }
});



// ============ WIDGET PRESENCE TRACKING ============

app.post('/api/widget/presence', async (req, res) => {
  try {
    const { conversationId, customerEmail, storeId, status, lastActivityAt } = req.body;

    if (!conversationId || !customerEmail) {
      return res.status(400).json({ error: 'conversationId and customerEmail required' });
    }

    const validStatuses = ['online', 'away', 'offline'];
    const safeStatus = validStatuses.includes(status) ? status : 'offline';

    await db.pool.query(`
      INSERT INTO customer_presence 
        (conversation_id, customer_email, store_id, status, last_activity_at, last_heartbeat_at, ws_connected, updated_at)
      VALUES ($1, $2, $3, $4, $5, NOW(), FALSE, NOW())
      ON CONFLICT (conversation_id)
      DO UPDATE SET
        status = $4,
        last_activity_at = $5,
        last_heartbeat_at = NOW(),
        updated_at = NOW()
    `, [conversationId, customerEmail, storeId || null, safeStatus, lastActivityAt || new Date()]);

    if (safeStatus === 'online') {
      cancelPendingEmail(conversationId);
    }

    res.json({ ok: true });
  } catch (error) {
    console.error('[Presence REST] Error:', error);
    res.status(500).json({ error: 'Failed to update presence' });
  }
});


app.post('/api/ai/suggestions', authenticateToken, async (req, res) => {
  try {
      const {
        clientMessage,
        chatHistory,
        recentContext,
        conversationId,
        customerName,
        customerEmail,
        storeName,
        storeIdentifier,
        analysis,
        adminNote,
        messageEdited,
      } = req.body;

      let brainSettings = req.body.brainSettings || {};
      
    if (!clientMessage) {
      return res.status(400).json({ error: 'clientMessage is required' });
    }

    const contextQuality = recentContext?.contextQuality || 'minimal';
    const messageRichness = recentContext?.messageRichness || 'brief';
    
    console.log(`✦ [AI] Request — context: ${contextQuality}, richness: ${messageRichness}, edited: ${!!messageEdited}, note: "${adminNote || ''}", text: "${clientMessage.substring(0, 80)}..."`);

    const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

    if (!ANTHROPIC_API_KEY) {
      console.log('✦ [AI] No ANTHROPIC_API_KEY set, using smart fallback suggestions');
      const suggestions = generateSmartFallbackSuggestions(clientMessage, chatHistory, analysis, adminNote);
      return res.json({ suggestions });
    }
    //don't remove!!
    // const conversationState = analyzeConversationState(chatHistory, clientMessage, analysis);
    // const analysisBlock = buildEnhancedAnalysisBlock(analysis, conversationState, recentContext);
    // const customerContext = buildCustomerContext(customerName, customerEmail, conversationState);
    // const policyBlock = buildPolicyBlock();
    // const systemPrompt = buildSystemPrompt(storeName, customerContext, analysisBlock, policyBlock, contextQuality, messageRichness);
    // const userPrompt = buildUserPrompt(chatHistory, clientMessage, messageEdited, adminNote, conversationState, recentContext);


    //added
    const conversationState = analyzeConversationState(chatHistory, clientMessage, analysis);
    const analysisBlock = buildEnhancedAnalysisBlock(analysis, conversationState, recentContext);
    const customerContext = buildCustomerContext(customerName, customerEmail, conversationState);
    const policyBlock = buildPolicyBlock();
   let brainContext = '';
      try {
        brainContext = await getBrainContext(db.pool, clientMessage);
        if (!brainSettings.length && !brainSettings.tone && !brainSettings.empathy) {
          brainSettings = await getBrainSettings(db.pool);
          if (brainSettings.tone) console.log('🧠 [Brain] Settings loaded from DB (no localStorage)');
        }
      } catch (brainErr) {
        console.error('🧠 [Brain] Failed to load, continuing without:', brainErr.message);
      }
    const systemPrompt = buildSystemPrompt(storeName, customerContext, analysisBlock, policyBlock, contextQuality, messageRichness, brainContext, brainSettings);
    const userPrompt = buildUserPrompt(chatHistory, clientMessage, messageEdited, adminNote, conversationState, recentContext);
    const requestBody = JSON.stringify({
      model: process.env.AI_MODEL || 'claude-sonnet-4-20250514',
      max_tokens: 1500,
      temperature: 0.3,
      system: systemPrompt,
      messages: [
        { role: 'user', content: userPrompt },
      ],
    });

    console.log(`✦ [AI] Calling Anthropic API — model: ${process.env.AI_MODEL || 'claude-sonnet-4-20250514'}`);

    //don't remove!
    // const anthropicData = await callAnthropicAPI(requestBody, ANTHROPIC_API_KEY);

    const anthropicData = await callAnthropicAPIWithRetry(requestBody, ANTHROPIC_API_KEY);

    const rawContent = anthropicData.content?.[0]?.text || '';
    console.log(`✦ [AI] Raw response (first 200 chars): ${rawContent.substring(0, 200)}`);

    let parsed;
    try {
      const cleaned = rawContent.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
      parsed = JSON.parse(cleaned);
    } catch (parseErr) {
      console.error('✦ [AI] Failed to parse response:', rawContent);
      const suggestions = generateSmartFallbackSuggestions(clientMessage, chatHistory, analysis, adminNote);
      return res.json({ suggestions, fallback: true });
    }

    let suggestions = Array.isArray(parsed.suggestions)
      ? parsed.suggestions.slice(0, 3)
      : Array.isArray(parsed)
        ? parsed.slice(0, 3)
        : generateSmartFallbackSuggestions(clientMessage, chatHistory, analysis, adminNote);

        console.log(`✦ [AI] BEFORE VALIDATE:`, JSON.stringify(suggestions));
        console.log(`✦ [AI] orderNumber detected:`, conversationState?.orderNumber);
        suggestions = validateSuggestions(suggestions, conversationState, chatHistory);
        console.log(`✦ [AI] AFTER VALIDATE (${suggestions.length}):`, JSON.stringify(suggestions));

        if (suggestions.length === 0) {
          console.log('✦ [AI] FALLBACK FIRED — all suggestions filtered');
          suggestions = generateSmartFallbackSuggestions(clientMessage, chatHistory, analysis, adminNote);
        } else if (suggestions.length < 3) {
          console.log(`✦ [AI] ${suggestions.length} suggestion(s) passed — returning Claude output only`);
        }

      //don't remove!
    // suggestions = validateSuggestions(suggestions, conversationState, chatHistory);
    // if (suggestions.length < 3) {
    //   const fallbackSuggestions = generateSmartFallbackSuggestions(clientMessage, chatHistory, analysis, adminNote);
    //   suggestions = [...suggestions, ...fallbackSuggestions].slice(0, 3);
    // }

    res.json({ suggestions });

  } catch (error) {
    console.error('✦ [AI] Suggestions endpoint error:', error.message, error.stack);
    const suggestions = generateSmartFallbackSuggestions(
      req.body?.clientMessage || '',
      req.body?.chatHistory || '',
      req.body?.analysis || {},
      req.body?.adminNote || ''
    );
    res.json({ suggestions, fallback: true });
  }
});

app.post('/api/ai/feedback', authenticateToken, async (req, res) => {
  try {
    const { suggestion, context, reason, conversationId } = req.body;
    console.log(`👎 [AI Feedback] Bad suggestion reported — conv: ${conversationId || 'n/a'}, reason: ${reason || 'none'}`);
    // Optional: persist to DB later. For now just log it.
    res.json({ ok: true });
  } catch (error) {
    console.error('AI feedback error:', error);
    res.status(500).json({ error: 'Failed to save feedback' });
  }
});

//don't remove!
// function buildSystemPrompt(storeName, customerContext, analysisBlock, policyBlock, contextQuality, messageRichness) {



//   function buildSystemPrompt(storeName, customerContext, analysisBlock, policyBlock, contextQuality, messageRichness, brainContext = '', brainSettings = {}) {
//   let contextGuidance = '';
  
//   if (contextQuality === 'minimal') {
//     if (messageRichness === 'very_brief' || messageRichness === 'brief') {
//       contextGuidance = `
// ⚠️ LIMITED CONTEXT: Customer's first brief message with no conversation history yet.
// - This is likely a greeting or very general inquiry
// - Your suggestions should be opening responses: greet professionally, ask what they need help with
// - Don't make assumptions - gather information first
// - Keep it friendly and welcoming
// `;
//     } else {
//       contextGuidance = `
// ℹ️ DETAILED FIRST MESSAGE: Customer provided substantial information in their first message.
// - They've given you good context to work with despite no conversation history
// - Focus on addressing their specific concern directly
// - Ask for any missing critical information (order number, photos, etc.)
// - Show you understand their issue and are taking action
// `;
//     }
//   } else if (contextQuality === 'basic') {
//     contextGuidance = `
// ℹ️ BASIC CONTEXT: Early in the conversation (1-2 exchanges).
// - Build on what's been discussed so far
// - Continue gathering information if needed
// - Start moving toward solutions if you have enough details
// - Reference specific things they've mentioned
// `;
//   } else if (contextQuality === 'good') {
//     contextGuidance = `
// ✓ GOOD CONTEXT: You have sufficient conversation history (2+ exchanges each side).
// - Base suggestions on the full conversation context
// - Avoid repeating what's already been asked or said
// - Focus on moving toward resolution
// - Be specific and reference prior discussion points
// `;
//   } else if (contextQuality === 'excellent') {
//     contextGuidance = `
// ✓ EXCELLENT CONTEXT: Rich conversation history with multiple exchanges.
// - You have deep context - use it to provide highly relevant suggestions
// - The customer may be losing patience - be efficient and solution-oriented
// - Avoid any repetition - you know what's been discussed
// - Focus on concrete next steps and resolution
// `;
//   }

//   return `You are an expert customer support reply assistant for ${storeName || 'an e-commerce store'}. Your job is to suggest exactly 3 reply options that the support agent can immediately send to the customer.

// ${contextGuidance}

// ${customerContext}

// ${analysisBlock}

// ${policyBlock}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// CORE RULES — Follow these strictly:
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

// 1. **Write as a human support agent**, NEVER as an AI or bot. Use first person ("I'll check", "Let me help").

// 2. **Each reply must be 1-4 sentences.** Be specific and actionable, not vague or generic.

// 3. **Base every reply on actual details** from the conversation:
//    - Reference specific order numbers, product names, or issues they mentioned
//    - Never ask for information the customer already provided
//    - Never repeat what the agent already said or asked

// 4. **Vary the 3 suggestions strategically:**
//    - Suggestion 1: Direct, helpful answer to their main question
//    - Suggestion 2: Different angle or addresses a secondary concern
//    - Suggestion 3: If info is missing, ask a specific follow-up. If info is complete, offer next step (escalation, confirmation, additional help)

// 5. **Match the customer's emotional state:**
//    - Very upset → Lead with strong empathy, show urgency, take immediate action
//    - Frustrated → Acknowledge concern with empathy, then solution
//    - Neutral → Be professional and efficient
//    - Positive → Match their friendly energy
//    - Grateful → Be warm but brief

// 6. **Never use these robotic phrases:**
//    - "I understand your frustration" (too generic)
//    - "I apologize for any inconvenience"
//    - "Please be advised"
//    - "Kindly"
//    - "As per our policy"
//    - "I appreciate your patience" (unless they've actually been patient)

// 7. **Use natural, varied empathy language:**
//    - "I'm so sorry this happened"
//    - "That's not the experience we want for you"
//    - "I can see how frustrating this must be"
//    - "I completely understand"

// 8. **Don't make promises you can't keep:**
//    - Never promise specific timeframes unless confirmed
//    - Don't promise refund amounts or outcomes
//    - Use phrases like "I'll check" or "Let me review" instead

// 9. **No emojis** unless the customer used them first.

// 10. **If customer is repeating themselves or following up:**
//     - Acknowledge they've been waiting: "I apologize for the delay getting this resolved"
//     - Show action: "Let me prioritize this" or "I'm escalating this now"
//     - Don't make them explain again

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// EXAMPLES OF EXCELLENT REPLIES:
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

// Example 1 - Product Damage:
// Customer: "My order #12345 arrived completely damaged! The box was crushed and the ceramic vase is in pieces."
// Agent should say:
// ✓ "I'm so sorry your order arrived damaged. I've pulled up order #12345 and can see the vase set you ordered. Could you send a quick photo of the damage? I'll get a replacement shipped out right away."
// ✗ "I understand your frustration. Can you provide your order number?"

// Example 2 - Angry Customer:
// Customer: "WHERE IS MY PACKAGE?? I ordered 2 weeks ago and NOTHING! This is ridiculous!"
// Agent should say:
// ✓ "I completely understand your frustration — 2 weeks is too long. Let me check the status of your order right now. Could you share your order number? It's in your confirmation email and starts with #."
// ✗ "I apologize for any inconvenience. Please provide your order number so I can look into this."

// Example 3 - Follow-up (customer already asked):
// Customer: "I'm still waiting for an update on my refund. I asked about this yesterday."
// Agent should say:
// ✓ "I apologize for the delay getting this resolved. Let me check the status of your refund right now and get you an answer within the hour."
// ✗ "Thank you for your patience. Can you provide your order number?"

// Example 4 - Simple Gratitude:
// Customer: "Thanks so much for the refund!"
// Agent should say:
// ✓ "You're very welcome! Don't hesitate to reach out if you need anything else."
// ✗ "I'm glad I could assist you today. Is there anything else I can help you with regarding your order?"

// Example 5 - Multiple Issues:
// Customer: "My order #98765 is late AND I was charged twice! This is unacceptable."
// Agent should say:
// ✓ "I sincerely apologize — that's definitely not right. I've pulled up order #98765 and I can see both issues. Let me check the shipping status and the duplicate charge right now. I'll have answers for you within 10 minutes."
// ✗ "I understand your concern. Let me look into this for you."

// Example 6 - Product Question:
// Customer: "Does the blue hoodie come in size XL?"
// Agent should say:
// ✓ "Great question! Let me check the current stock on the blue hoodie in XL. Which specific style are you looking at — the Classic or the Premium?"
// ✗ "Thank you for your inquiry. Can you provide more details about which product you're interested in?"

// Example 7 - Detailed First Message:
// Customer: "Hi, my order #12345 arrived damaged. The box was crushed and the ceramic vase inside is broken into pieces. I need a refund or replacement ASAP."
// Agent should say:
// ✓ "I'm so sorry your ceramic vase from order #12345 arrived damaged. Could you send a quick photo of the damage? I'll process a replacement for you right away."
// ✗ "Hello! Thank you for contacting us. Can you provide your order number?"

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// THINKING PROCESS:
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

// Before generating replies, quickly think through:
// 1. What is the customer's primary need right now?
// 2. What information do we have vs. what's missing?
// 3. What tone matches their emotional state?
// 4. What has the agent already tried/said/asked?
// 5. Is this a repeat question or follow-up?

// Then generate your 3 suggestions.

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

// ${brainContext ? `
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// ADMIN-TRAINED RULES — HIGHEST PRIORITY (override everything above):
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// ${brainContext}
// ` : ''}
// Respond ONLY with valid JSON in this exact format:
// {"suggestions": ["reply 1", "reply 2", "reply 3"]}`;


// }


function buildSystemPrompt(storeName, customerContext, analysisBlock, policyBlock, contextQuality, messageRichness, brainContext = '', brainSettings = {}) {
  let contextGuidance = '';
  
  if (contextQuality === 'minimal') {
    if (messageRichness === 'very_brief' || messageRichness === 'brief') {
      contextGuidance = `
⚠️ LIMITED CONTEXT: Customer's first brief message with no conversation history yet.
- This is likely a greeting or very general inquiry
- Your suggestions should be opening responses: greet professionally, ask what they need help with
- Don't make assumptions - gather information first
- Keep it friendly and welcoming
`;
    } else {
      contextGuidance = `
ℹ️ DETAILED FIRST MESSAGE: Customer provided substantial information in their first message.
- They've given you good context to work with despite no conversation history
- Focus on addressing their specific concern directly
- Ask for any missing critical information (order number, photos, etc.)
- Show you understand their issue and are taking action
`;
    }
  } else if (contextQuality === 'basic') {
    contextGuidance = `
ℹ️ BASIC CONTEXT: Early in the conversation (1-2 exchanges).
- Build on what's been discussed so far
- Continue gathering information if needed
- Start moving toward solutions if you have enough details
- Reference specific things they've mentioned
`;
  } else if (contextQuality === 'good') {
    contextGuidance = `
✓ GOOD CONTEXT: You have sufficient conversation history (2+ exchanges each side).
- Base suggestions on the full conversation context
- Avoid repeating what's already been asked or said
- Focus on moving toward resolution
- Be specific and reference prior discussion points
`;
  } else if (contextQuality === 'excellent') {
    contextGuidance = `
✓ EXCELLENT CONTEXT: Rich conversation history with multiple exchanges.
- You have deep context - use it to provide highly relevant suggestions
- The customer may be losing patience - be efficient and solution-oriented
- Avoid any repetition - you know what's been discussed
- Focus on concrete next steps and resolution
`;
  }

  // ── Build reply quality block from admin brain settings ──────────────────
  const len = brainSettings.length || 'medium';
  const tone = brainSettings.tone || 'friendly-professional';
  const empathy = brainSettings.empathy || 'high';

  const lengthRule = len === 'long'
    ? `Each reply must be **4-6 sentences minimum**. Write thorough, detailed responses like a knowledgeable human agent. Cover the issue, the resolution path, and reassurance. Never give one-liners or short answers.`
    : len === 'short'
    ? `Each reply must be **1-2 sentences**. Be extremely direct and concise. One clear action or answer per reply.`
    : `Each reply must be **2-4 sentences**. Specific and actionable — enough detail to be helpful, not overwhelming.`;

  const toneRule = tone === 'formal'
    ? `Use formal, professional language throughout. Avoid contractions (use "I will" not "I'll"). No casual phrases.`
    : tone === 'casual'
    ? `Use casual, conversational language. Contractions are encouraged. Sound like a helpful colleague, not a corporate agent.`
    : `Use friendly-professional language — warm and personable but not overly casual. Contractions are fine.`;

  const empathyRule = empathy === 'high'
    ? `Always lead with empathy before jumping to solutions. Acknowledge the customer's experience first.`
    : empathy === 'low'
    ? `Skip empathy preambles. Get straight to the solution — customers want answers, not sympathy.`
    : `Brief empathy acknowledgment is enough before moving to the solution. Don't over-apologize.`;

  const qualityBlock = `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
REPLY QUALITY REQUIREMENTS (set by admin — non-negotiable):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
LENGTH: ${lengthRule}
TONE: ${toneRule}
EMPATHY: ${empathyRule}`;

  return `You are an expert customer support reply assistant for ${storeName || 'an e-commerce store'}. Your job is to suggest exactly 3 reply options that the support agent can immediately send to the customer.

${qualityBlock}

${contextGuidance}

${customerContext}

${analysisBlock}

${policyBlock}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CORE RULES — Follow these strictly:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. **Write as a human support agent**, NEVER as an AI or bot. Use first person ("I'll check", "Let me help").

2. **Reply length:** ${lengthRule}

3. **Base every reply on actual details** from the conversation:
   - Reference specific order numbers, product names, or issues they mentioned
   - Never ask for information the customer already provided
   - Never repeat what the agent already said or asked

4. **Vary the 3 suggestions strategically:**
   - Suggestion 1: Direct, helpful answer to their main question
   - Suggestion 2: Different angle or addresses a secondary concern
   - Suggestion 3: If info is missing, ask a specific follow-up. If info is complete, offer next step (escalation, confirmation, additional help)

5. **Match the customer's emotional state:**
   - Very upset → Lead with strong empathy, show urgency, take immediate action
   - Frustrated → Acknowledge concern with empathy, then solution
   - Neutral → Be professional and efficient
   - Positive → Match their friendly energy
   - Grateful → Be warm but brief

6. **Never use these robotic phrases:**
   - "I understand your frustration" (too generic)
   - "I apologize for any inconvenience"
   - "Please be advised"
   - "Kindly"
   - "As per our policy"
   - "I appreciate your patience" (unless they've actually been patient)

7. **Use natural, varied empathy language:**
   - "I'm so sorry this happened"
   - "That's not the experience we want for you"
   - "I can see how frustrating this must be"
   - "I completely understand"

8. **Don't make promises you can't keep:**
   - Never promise specific timeframes unless confirmed
   - Don't promise refund amounts or outcomes
   - Use phrases like "I'll check" or "Let me review" instead

9. **No emojis** unless the customer used them first.

10. **If customer is repeating themselves or following up:**
    - Acknowledge they've been waiting: "I apologize for the delay getting this resolved"
    - Show action: "Let me prioritize this" or "I'm escalating this now"
    - Don't make them explain again

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
EXAMPLES OF EXCELLENT REPLIES:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Example 1 - Product Damage:
Customer: "My order #12345 arrived completely damaged! The box was crushed and the ceramic vase is in pieces."
Agent should say:
✓ "I'm so sorry your order arrived damaged. I've pulled up order #12345 and can see the vase set you ordered. Could you send a quick photo of the damage? I'll get a replacement shipped out right away."
✗ "I understand your frustration. Can you provide your order number?"

Example 2 - Angry Customer:
Customer: "WHERE IS MY PACKAGE?? I ordered 2 weeks ago and NOTHING! This is ridiculous!"
Agent should say:
✓ "I completely understand your frustration — 2 weeks is too long. Let me check the status of your order right now. Could you share your order number? It's in your confirmation email and starts with #."
✗ "I apologize for any inconvenience. Please provide your order number so I can look into this."

Example 3 - Follow-up (customer already asked):
Customer: "I'm still waiting for an update on my refund. I asked about this yesterday."
Agent should say:
✓ "I apologize for the delay getting this resolved. Let me check the status of your refund right now and get you an answer within the hour."
✗ "Thank you for your patience. Can you provide your order number?"

Example 4 - Simple Gratitude:
Customer: "Thanks so much for the refund!"
Agent should say:
✓ "You're very welcome! Don't hesitate to reach out if you need anything else."
✗ "I'm glad I could assist you today. Is there anything else I can help you with regarding your order?"

Example 5 - Multiple Issues:
Customer: "My order #98765 is late AND I was charged twice! This is unacceptable."
Agent should say:
✓ "I sincerely apologize — that's definitely not right. I've pulled up order #98765 and I can see both issues. Let me check the shipping status and the duplicate charge right now. I'll have answers for you within 10 minutes."
✗ "I understand your concern. Let me look into this for you."

Example 6 - Product Question:
Customer: "Does the blue hoodie come in size XL?"
Agent should say:
✓ "Great question! Let me check the current stock on the blue hoodie in XL. Which specific style are you looking at — the Classic or the Premium?"
✗ "Thank you for your inquiry. Can you provide more details about which product you're interested in?"

Example 7 - Detailed First Message:
Customer: "Hi, my order #12345 arrived damaged. The box was crushed and the ceramic vase inside is broken into pieces. I need a refund or replacement ASAP."
Agent should say:
✓ "I'm so sorry your ceramic vase from order #12345 arrived damaged. Could you send a quick photo of the damage? I'll process a replacement for you right away."
✗ "Hello! Thank you for contacting us. Can you provide your order number?"

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
THINKING PROCESS:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Before generating replies, quickly think through:
1. What is the customer's primary need right now?
2. What information do we have vs. what's missing?
3. What tone matches their emotional state?
4. What has the agent already tried/said/asked?
5. Is this a repeat question or follow-up?

Then generate your 3 suggestions.

${brainContext ? `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ADMIN-TRAINED BRAIN RULES — HIGHEST PRIORITY:
These override tone, length, and all instructions above.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${brainContext}
` : ''}
Respond ONLY with valid JSON in this exact format:
{"suggestions": ["reply 1", "reply 2", "reply 3"]}`;
}



function buildEnhancedAnalysisBlock(analysis, conversationState, recentContext) {
  if (!analysis && !conversationState && !recentContext) return '';

  const lines = ['━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'];
  lines.push('CONVERSATION ANALYSIS (use this to inform your replies):');
  lines.push('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  if (recentContext?.messageRichness) {
    const richnessLabels = {
      'very_detailed': '📝 VERY DETAILED MESSAGE - Customer provided extensive information, use it all',
      'detailed': '📝 Detailed message - Good context to work with',
      'brief': '💬 Brief message - May need to ask for more information',
      'very_brief': '💬 Very brief message - Likely a greeting or need to ask follow-up questions',
    };
    if (richnessLabels[recentContext.messageRichness]) {
      lines.push(richnessLabels[recentContext.messageRichness]);
    }
  }

  if (recentContext?.detectedIssue) {
    const issueLabels = {
      'damaged': '📦 Issue Type: DAMAGED/BROKEN item - Offer replacement or refund, ask for photo if not provided',
      'wrong_item': '📦 Issue Type: WRONG ITEM received - Apologize, offer replacement with return label',
      'missing': '📦 Issue Type: MISSING/NOT RECEIVED - Check tracking, offer reship or refund',
      'late': '📦 Issue Type: LATE DELIVERY - Check tracking, explain delay, offer compensation if significant',
      'quality': '📦 Issue Type: QUALITY concerns - Gather details, offer refund or replacement',
    };
    lines.push(issueLabels[recentContext.detectedIssue] || `📦 Issue: ${recentContext.detectedIssue}`);
  }

  if (recentContext?.customerWants) {
    const wants = [];
    if (recentContext.customerWants.refund) wants.push('REFUND');
    if (recentContext.customerWants.replacement) wants.push('REPLACEMENT');
    if (recentContext.customerWants.tracking) wants.push('TRACKING INFO');
    if (recentContext.customerWants.help) wants.push('GENERAL HELP');
    
    if (wants.length > 0) {
      lines.push(`🎯 Customer explicitly wants: ${wants.join(' or ')} - Address this directly`);
    }
  }

  if (conversationState?.orderNumber || analysis?.orderNumber) {
    const orderNum = conversationState?.orderNumber || analysis?.orderNumber;
    lines.push(`📦 Order Number: ${orderNum} — MUST reference this in your replies, DO NOT ask for it again`);
  }

  if (conversationState?.productName) {
    lines.push(`🏷️  Product: ${conversationState.productName} — Reference this specifically`);
  }

  if (conversationState?.customerEmail && conversationState.customerEmail !== 'unknown') {
    lines.push(`📧 Email: ${conversationState.customerEmail} — DO NOT ask for email again`);
  }

  if (analysis?.detectedTopics?.length > 0) {
    const topicLabels = {
      order_status: 'Order Status / Tracking',
      refund_return: 'Refund / Return / Cancellation',
      product_issue: 'Product Issue / Damaged / Defective',
      payment: 'Payment / Billing',
      discount_promo: 'Discount / Promo Code',
      product_inquiry: 'Product Inquiry',
      shipping: 'Shipping Questions',
      account: 'Account Issue',
      complaint: 'Complaint / Escalation',
      gratitude: 'Customer Expressing Thanks',
      greeting: 'Greeting / Opening'
    };
    const labels = analysis.detectedTopics.map(t => topicLabels[t] || t).join(', ');
    lines.push(`🏷️  Topics: ${labels}`);
  }

  if (analysis?.sentiment) {
    const sentimentLabels = {
      very_negative: '😡 VERY UPSET / ANGRY — Lead with strong empathy, show urgency, take immediate action',
      negative: '😟 FRUSTRATED / UNHAPPY — Acknowledge their concern with genuine empathy first',
      neutral: '😐 NEUTRAL — Be professional and efficient',
      positive: '😊 POSITIVE / FRIENDLY — Match their positive energy',
      very_positive: '🎉 VERY HAPPY / GRATEFUL — Be warm and brief, match their enthusiasm'
    };
    lines.push(`${sentimentLabels[analysis.sentiment] || analysis.sentiment}`);
  }

  if (analysis?.isUrgent || conversationState?.isEscalating) {
    lines.push('⚠️  URGENT / ESCALATING — Respond with priority, show immediate action, use phrases like "right now" or "immediately"');
  }

  if (analysis?.isRepeat || conversationState?.customerMessageCount >= 3) {
    lines.push('🔁 CUSTOMER REPEATING / FOLLOWING UP — They feel unheard. Acknowledge the delay and take action NOW. Don\'t make them explain again.');
  }

  if (conversationState?.isLongConversation) {
    lines.push(`⏰ LONG CONVERSATION (${conversationState.turnCount} messages) — Customer may be losing patience. Be efficient and solution-oriented.`);
  }

  if (analysis?.isQuestion) {
    lines.push('❓ Direct question asked — Answer it specifically, don\'t deflect');
  }

  if (analysis?.hasAttachment || conversationState?.hasAttachment) {
    lines.push('📎 Customer sent file/image — Acknowledge you\'ve reviewed it in your response');
  }

  if (analysis?.agentAskedForOrder || conversationState?.agentAskedForOrder) {
    lines.push('🚫 Agent ALREADY asked for order number — DO NOT ask again, move forward with the information you have');
  }

  if (analysis?.agentAskedForEmail || conversationState?.agentAskedForEmail) {
    lines.push('🚫 Agent ALREADY asked for email — DO NOT ask again');
  }

  if (analysis?.agentAskedForPhoto || conversationState?.agentAskedForPhoto) {
    lines.push('🚫 Agent ALREADY asked for photo — DO NOT ask again, work with what you have or escalate');
  }

  if (analysis?.agentAlreadyApologized || conversationState?.agentAlreadyApologized) {
    lines.push('🚫 Agent ALREADY apologized — Don\'t repeat the same apology, focus on action and solutions');
  }

  if (analysis?.agentOfferedRefund) {
    lines.push('💰 Agent already mentioned refund — Build on that, confirm next steps, don\'t re-introduce the concept');
  }

  if (analysis?.agentOfferedReplacement) {
    lines.push('🔄 Agent already offered replacement — Build on that, confirm shipping details or next steps');
  }

  // Last agent message for context
  if (analysis?.lastAgentText || conversationState?.lastAgentMessage) {
    const lastMsg = (analysis?.lastAgentText || conversationState?.lastAgentMessage || '').substring(0, 150);
    if (lastMsg) {
      lines.push(`💬 Agent's last message: "${lastMsg}${lastMsg.length >= 150 ? '...' : ''}" — Don't repeat this`);
    }
  }

  return lines.length > 2 ? lines.join('\n') : '';
}

/**
 * Build customer context block
 */
function buildCustomerContext(customerName, customerEmail, conversationState) {
  const lines = [];
  
  lines.push(`CUSTOMER: ${customerName || 'Guest'}${customerEmail ? ` (${customerEmail})` : ''}`);
  
  if (conversationState?.customerHistory) {
    const history = conversationState.customerHistory;
    lines.push(`Customer History: ${history.totalOrders || 0} previous orders, ${history.issueCount || 0} past support tickets`);
  }

  return lines.join('\n');
}

/**
 * Build policy and brand voice guidelines
 */
function buildPolicyBlock() {
  return `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
COMPANY POLICIES & BRAND VOICE:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Policies:
- Refund window: 30 days from delivery date
- Always offer replacement before refund for damaged items
- Free return shipping for defective/damaged products
- Escalate to supervisor if customer has contacted 3+ times about same issue
- Price match: Match competitors within 7 days of purchase

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


function buildUserPrompt(chatHistory, clientMessage, messageEdited, adminNote, conversationState, recentContext) {
  let prompt = '';

  if (recentContext?.lastCustomerMessages && recentContext?.lastAgentMessages) {
    const customerMsgs = recentContext.lastCustomerMessages;
    const agentMsgs = recentContext.lastAgentMessages;
    
    if (customerMsgs.length > 0 || agentMsgs.length > 0) {
      prompt += `<recent_conversation_focus>
MOST RECENT EXCHANGE (prioritize this context):

`;
      if (customerMsgs.length > 0) {
        prompt += `Last ${customerMsgs.length} Customer Message(s):
${customerMsgs.map((msg, i) => `${i + 1}. ${msg}`).join('\n')}

`;
      }
      
      if (agentMsgs.length > 0) {
        prompt += `Last ${agentMsgs.length} Agent Response(s):
${agentMsgs.map((msg, i) => `${i + 1}. ${msg}`).join('\n')}

`;
      }
      
      prompt += `⚠️ IMPORTANT: Base your suggestions primarily on this recent exchange. The customer's latest concerns and the agent's recent responses are your top priority.
</recent_conversation_focus>

`;
    }
  }

  if (chatHistory && chatHistory.trim()) {
    prompt += `<full_conversation_history>
${chatHistory}
</full_conversation_history>

`;
  }

  prompt += `<customer_latest_message>
${clientMessage}
</customer_latest_message>`;

  if (conversationState?.extractedEntities && Object.keys(conversationState.extractedEntities).length > 0) {
    prompt += `

<extracted_information>
${Object.entries(conversationState.extractedEntities)
  .map(([key, value]) => `- ${key}: ${value}`)
  .join('\n')}
</extracted_information>`;
  }

  if (messageEdited) {
    prompt += `

<important_note>
⚠️ The agent EDITED the customer's message above to clarify or add context. Use the edited version as the basis for your reply suggestions.
</important_note>`;
  }

  if (adminNote && adminNote.trim()) {
    prompt += `

<agent_special_instructions>
📌 ${adminNote.trim()}

The agent wants you to incorporate the above instructions into ALL 3 suggested replies. This is a high-priority requirement.
</agent_special_instructions>`;
  }

  prompt += `

Generate 3 reply suggestions as JSON: {"suggestions": ["reply 1", "reply 2", "reply 3"]}`;

  return prompt;
}

function analyzeConversationState(chatHistory, clientMessage, analysis) {
  const fullText = `${chatHistory || ''} ${clientMessage || ''}`.toLowerCase();
  const messages = (chatHistory || '').split('\n').filter(m => m.trim());
  const orderMatch = fullText.match(/(?:order|#)\s*#?(\d{4,})/i);
  const orderNumber = orderMatch ? orderMatch[1] : null;
  const emailMatch = fullText.match(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i);
  const customerEmail = emailMatch ? emailMatch[0] : null;
  const productMatch = clientMessage.match(/(blue|red|black|white|green|yellow|purple|pink|orange|brown|gray|grey)\s+(hoodie|shirt|pants|shoes|dress|jacket|sweater|hat|shorts|jeans|blouse|skirt|coat|boots|sneakers|sandals|watch|bag|backpack|wallet|belt|sunglasses|vase|mug|plate|bowl|pillow|blanket|towel|lamp|chair|table|desk|mirror)/i);
  const productName = productMatch ? productMatch[0] : null;
  const customerMessages = messages.filter(m => m.startsWith('Customer:') || m.startsWith('Client:'));
  const agentMessages = messages.filter(m => m.startsWith('Agent:') || m.startsWith('Support:'));
  const customerMessageCount = customerMessages.length;
  const lastAgentMessage = agentMessages[agentMessages.length - 1] || '';
  const agentAskedForOrder = /order number|order #|order id/i.test(lastAgentMessage);
  const agentAskedForEmail = /email|e-mail address/i.test(lastAgentMessage);
  const agentAskedForPhoto = /photo|picture|image|screenshot/i.test(lastAgentMessage);
  const agentAlreadyApologized = /sorry|apologize|apologies/i.test(lastAgentMessage);
  const isEscalating = /manager|supervisor|escalate|unacceptable|ridiculous|lawsuit|lawyer|sue|fraud|scam|bbb|attorney general/i.test(clientMessage);
  const hasAttachment = /attached|attachment|photo|image|screenshot|picture|file/i.test(clientMessage);
  const isLongConversation = customerMessageCount >= 4;
  const turnCount = Math.max(customerMessageCount, agentMessages.length);

  return {
    orderNumber,
    customerEmail: customerEmail || 'unknown',
    productName,
    customerMessageCount,
    lastAgentMessage,
    agentAskedForOrder,
    agentAskedForEmail,
    agentAskedForPhoto,
    agentAlreadyApologized,
    isEscalating,
    hasAttachment,
    isLongConversation,
    turnCount,
    extractedEntities: {
      ...(orderNumber && { order_number: orderNumber }),
      ...(productName && { product: productName }),
      ...(customerEmail && customerEmail !== 'unknown' && { email: customerEmail }),
    },
  };
}

/**
 * Validate suggestions to ensure quality and avoid common mistakes
 */

//don't remove!
// function validateSuggestions(suggestions, conversationState, chatHistory) {
//   if (!Array.isArray(suggestions)) return [];

//   const lastAgentMessage = (conversationState?.lastAgentMessage || '').toLowerCase();
//   const hasOrderNumber = !!conversationState?.orderNumber || conversationState?.hasOrderNumber;
//   const hasEmail = conversationState?.customerEmail && conversationState.customerEmail !== 'unknown';

//   return suggestions.filter((suggestion, index) => {
//     if (!suggestion || typeof suggestion !== 'string') return false;

//     const lowerSuggestion = suggestion.toLowerCase();

//     // Don't ask for info we already have
//     if (hasOrderNumber && /(?:could you|can you|please|would you mind).*(?:order number|order #|order id)/i.test(suggestion)) {
//       console.log(`✦ [AI] Filtered suggestion ${index + 1}: asking for order number we already have`);
//       return false;
//     }

//     if (hasEmail && /(?:could you|can you|please|would you mind).*(?:email|e-mail)/i.test(suggestion)) {
//       console.log(`✦ [AI] Filtered suggestion ${index + 1}: asking for email we already have`);
//       return false;
//     }

//     // Don't repeat what agent just said (check first 50 chars)
//     if (lastAgentMessage && lastAgentMessage.length > 20) {
//       const agentStart = lastAgentMessage.substring(0, 50);
//       const suggestionStart = lowerSuggestion.substring(0, 50);
//       if (agentStart.includes(suggestionStart.substring(0, 30)) || 
//           suggestionStart.includes(agentStart.substring(0, 30))) {
//         console.log(`✦ [AI] Filtered suggestion ${index + 1}: too similar to agent's last message`);
//         return false;
//       }
//     }

//     // Check length (5-60 words)
//     const wordCount = suggestion.split(/\s+/).length;
//     if (wordCount < 5 || wordCount > 150) {
//       console.log(`✦ [AI] Filtered suggestion ${index + 1}: word count ${wordCount} out of range`);
//       return false;
//     }

//     // Avoid robotic phrases
//     const roboticPhrases = [
//       /i apologize for any inconvenience/i,
//       /please be advised/i,
//       /kindly provide/i,
//       /as per our policy/i,
//       /we regret to inform/i,
//     ];
    
//     for (const phrase of roboticPhrases) {
//       if (phrase.test(suggestion)) {
//         console.log(`✦ [AI] Filtered suggestion ${index + 1}: contains robotic phrase`);
//         return false;
//       }
//     }

//     // Avoid AI-like phrases
//     if (/as an ai|i'm a bot|i'm an assistant/i.test(suggestion)) {
//       console.log(`✦ [AI] Filtered suggestion ${index + 1}: mentions being AI`);
//       return false;
//     }

//     return true;
//   });
// }

function validateSuggestions(suggestions, conversationState, chatHistory) {
  if (!Array.isArray(suggestions)) return [];

  const hasOrderNumber = !!conversationState?.orderNumber || conversationState?.hasOrderNumber;
  const hasEmail = conversationState?.customerEmail && conversationState.customerEmail !== 'unknown';

  return suggestions.filter((suggestion, index) => {
    if (!suggestion || typeof suggestion !== 'string' || suggestion.trim().length < 10) {
      console.log(`✦ [AI] Filtered suggestion ${index + 1}: empty or too short`);
      return false;
    }

    // Never let Claude pretend to be an AI/bot
    if (/as an ai|i'm a bot|i'm an assistant|as an assistant/i.test(suggestion)) {
      console.log(`✦ [AI] Filtered suggestion ${index + 1}: mentions being AI`);
      return false;
    }

    // If customer gave order number, don't ask for it again
    if (hasOrderNumber && /\b(can you|could you|please|would you).*?(order number|order #|order id)\b/i.test(suggestion)) {
      console.log(`✦ [AI] Filtered suggestion ${index + 1}: asking for order number already provided`);
      return false;
    }

    // If customer gave email, don't ask for it again
    if (hasEmail && /\b(can you|could you|please|would you).*?(email address|your email)\b/i.test(suggestion)) {
      console.log(`✦ [AI] Filtered suggestion ${index + 1}: asking for email already provided`);
      return false;
    }

    return true;
  });
}

/**
 * Call Anthropic API with proper error handling
 */
// function callAnthropicAPI(requestBody, apiKey) {
//   return new Promise((resolve, reject) => {
//     const options = {
//       hostname: 'api.anthropic.com',
//       path: '/v1/messages',
//       method: 'POST',
//       headers: {
//         'Content-Type': 'application/json',
//         'x-api-key': apiKey,
//         'anthropic-version': '2023-06-01',
//         'Content-Length': Buffer.byteLength(requestBody),
//       },
//     };

//     const apiReq = https.request(options, (apiRes) => {
//       let body = '';
//       apiRes.on('data', (chunk) => { body += chunk; });
//       apiRes.on('end', () => {
//         console.log(`✦ [AI] Anthropic response status: ${apiRes.statusCode}`);
//         if (apiRes.statusCode !== 200) {
//           console.error(`✦ [AI] Anthropic API error ${apiRes.statusCode}:`, body.substring(0, 500));
//           reject(new Error(`Anthropic API ${apiRes.statusCode}: ${body.substring(0, 200)}`));
//           return;
//         }
//         try {
//           resolve(JSON.parse(body));
//         } catch (e) {
//           console.error('✦ [AI] Failed to parse Anthropic response:', body.substring(0, 500));
//           reject(new Error('Invalid JSON from Anthropic'));
//         }
//       });
//     });

//     apiReq.on('error', (err) => {
//       console.error('✦ [AI] HTTPS request failed:', err.message);
//       reject(err);
//     });

//     apiReq.setTimeout(20000, () => {
//       apiReq.destroy();
//       reject(new Error('Anthropic API timeout (20s)'));
//     });

//     apiReq.write(requestBody);
//     apiReq.end();
//   });
// }



function callAnthropicAPI(requestBody, apiKey) {
  return new Promise((resolve, reject) => {



    //don't remove!
    // const options = {
    //   hostname: 'api.anthropic.com',
    //   path: '/v1/messages',
    //   method: 'POST',
    //   headers: {
    //     'Content-Type': 'application/json',
    //     'x-api-key': apiKey,
    //     'anthropic-version': '2023-06-01',
    //     'Content-Length': Buffer.byteLength(requestBody),
    //     'Connection': 'close',
    //   },
    // };
const agent = new https.Agent({ 
  keepAlive: false,
  timeout: 45000,
});

const options = {
  hostname: 'api.anthropic.com',
  path: '/v1/messages',
  method: 'POST',
  agent,
  headers: {
    'Content-Type': 'application/json',
    'x-api-key': apiKey,
    'anthropic-version': '2023-06-01',
    'Content-Length': Buffer.byteLength(requestBody),
    'Connection': 'close',
  },
};



    const apiReq = https.request(options, (apiRes) => {
      let body = '';
      apiRes.on('data', (chunk) => { body += chunk; });
      apiRes.on('end', () => {
        console.log(`✦ [AI] Anthropic response status: ${apiRes.statusCode}`);
        if (apiRes.statusCode !== 200) {
          console.error(`✦ [AI] Anthropic API error ${apiRes.statusCode}:`, body.substring(0, 500));
          reject(new Error(`Anthropic API ${apiRes.statusCode}: ${body.substring(0, 200)}`));
          return;
        }
        try {
          resolve(JSON.parse(body));
        } catch (e) {
          console.error('✦ [AI] Failed to parse Anthropic response:', body.substring(0, 500));
          reject(new Error('Invalid JSON from Anthropic'));
        }
      });
    });

    apiReq.on('error', (err) => {
      console.error('✦ [AI] HTTPS request failed:', err.message);
      reject(err);
    });

    apiReq.setTimeout(45000, () => {
      apiReq.destroy();
      reject(new Error('Anthropic API timeout (45s)'));
    });

    apiReq.write(requestBody);
    apiReq.end();
  });
}


function callAnthropicAPIWithRetry(requestBody, apiKey, retries = 3) {
  const attempt = (attemptsLeft) => new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.anthropic.com',
      path: '/v1/messages',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'Content-Length': Buffer.byteLength(requestBody),
      },
    };

    const req = require('https').request(options, apiRes => {
      let body = '';
      apiRes.on('data', chunk => { body += chunk; });
      apiRes.on('end', () => {
        console.log(`✦ [AI] Anthropic response status: ${apiRes.statusCode}`);
        if (apiRes.statusCode !== 200) {
          return reject(new Error(`Anthropic API ${apiRes.statusCode}: ${body.slice(0, 200)}`));
        }
        try { resolve(JSON.parse(body)); }
        catch (e) { reject(new Error('Invalid JSON from Anthropic')); }
      });
    });

    req.on('error', (err) => {
      const currentAttempt = retries - attemptsLeft + 1;
      console.error(`✦ [AI] Attempt ${currentAttempt}/${retries} failed: ${err.message}`);
      if (attemptsLeft > 0) {
        setTimeout(() => attempt(attemptsLeft - 1).then(resolve).catch(reject), 1500 * currentAttempt);
      } else {
        reject(err);
      }
    });

    req.setTimeout(45000, () => { req.destroy(); reject(new Error('Anthropic timeout')); });
    req.write(requestBody);
    req.end();
  });

  return attempt(retries - 1);
}

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

  let empathyPrefix = '';
  if (sentiment === 'very_negative' && !agentAlreadyApologized) {
    const options = [
      'I sincerely apologize for this experience.',
      'I completely understand how frustrating this must be.',
      'I can see this has been really frustrating, and I want to make it right.',
    ];
    empathyPrefix = options[Math.floor(Math.random() * options.length)] + ' ';
  } else if (sentiment === 'negative' && !agentAlreadyApologized) {
    const options = [
      'I\'m sorry about that.',
      'I understand your concern.',
      'I appreciate you bringing this to my attention.',
    ];
    empathyPrefix = options[Math.floor(Math.random() * options.length)] + ' ';
  }
  const repeatPrefix = isRepeat ? 'I apologize for the delay getting this resolved. ' : '';
  const urgencySuffix = isUrgent ? ' I\'m treating this as a priority.' : '';
  if (topics.includes('gratitude') && !topics.includes('complaint')) {
    return [
      'You\'re very welcome! Don\'t hesitate to reach out if you need anything else.',
      'Happy to help! Have a great day.',
      'Glad we could get that sorted for you!'
    ];
  }

  if (topics.length === 1 && topics.includes('greeting')) {
    return [
      'Hello! How can I help you today?',
      'Hi there! What can I assist you with?',
      'Hello! Thanks for reaching out. What do you need help with?'
    ];
  }

  if (topics.includes('product_issue')) {
    if (hasOrderNumber && hasAttachment) {
      return [
        `${empathyPrefix}${repeatPrefix}Thank you for the photo and order details. I'm reviewing the issue and will get back to you with a solution right away.${urgencySuffix}`,
        `${empathyPrefix}I can see the issue clearly from the photo. Let me check the best resolution for you — would you prefer a replacement or a refund?`,
        `${empathyPrefix}${repeatPrefix}I've noted the issue with your order. Let me escalate this to get it resolved as quickly as possible.${urgencySuffix}`
      ];
    }
    if (hasOrderNumber && !hasAttachment && !analysis?.agentAskedForPhoto) {
      return [
        `${empathyPrefix}Thank you for your order details. Could you send a quick photo of the issue? That will help me process this faster.`,
        `${empathyPrefix}I've located your order. To help resolve this quickly, could you share a picture of the damage or defect?`,
        `${empathyPrefix}${repeatPrefix}A photo would help me determine the best solution for you. Could you send one when you get a chance?${urgencySuffix}`
      ];
    }
    if (!hasOrderNumber && !agentAskedForOrder) {
      return [
        `${empathyPrefix}I'd like to help resolve this. Could you share your order number so I can pull up the details?`,
        `${empathyPrefix}That's not the experience we want for you. Could you provide your order number and a brief description of the issue?`,
        `${empathyPrefix}${repeatPrefix}Let me look into this for you. Can you share your order number and, if possible, a photo of the problem?${urgencySuffix}`
      ];
    }
    return [
      `${empathyPrefix}I'm looking into this for you now. I'll have an update shortly.${urgencySuffix}`,
      `${empathyPrefix}Thank you for your patience. I'm checking the available options to resolve this.`,
      `${empathyPrefix}${repeatPrefix}I want to make sure we get this right. Let me review your case and get back to you with a solution.${urgencySuffix}`
    ];
  }

  // ── ORDER STATUS / SHIPPING ──
  if (topics.includes('order_status') || topics.includes('shipping')) {
    if (hasOrderNumber) {
      return [
        `${repeatPrefix}Thank you for your order number. Let me check the current status and tracking information for you now.${urgencySuffix}`,
        `${repeatPrefix}I'm pulling up your order details right now. I'll have the latest shipping update for you in just a moment.${urgencySuffix}`,
        `${repeatPrefix}I can see your order. Let me check with our fulfillment team for the most up-to-date status.${urgencySuffix}`
      ];
    }
    if (!agentAskedForOrder) {
      return [
        `${empathyPrefix}I'd be happy to check on that for you. Could you share your order number?`,
        'I can look that up! I\'ll need your order number or the email address you used at checkout.',
        `${empathyPrefix}${repeatPrefix}Let me find your order. Could you provide the order number? It should be in your confirmation email.${urgencySuffix}`
      ];
    }
    return [
      `${repeatPrefix}I'm checking on your order now. I'll update you with the tracking details as soon as I have them.${urgencySuffix}`,
      'Thank you for your patience. I\'m looking into the shipping status with our team.',
      `${repeatPrefix}I want to give you accurate information. Give me just a moment to verify the shipping status.${urgencySuffix}`
    ];
  }

  // ── REFUND / RETURN ──
  if (topics.includes('refund_return')) {
    if (hasOrderNumber) {
      return [
        `${empathyPrefix}${repeatPrefix}I've located your order. Let me review the details and check what return options are available for you.${urgencySuffix}`,
        `${empathyPrefix}Thank you for your order number. I'm checking the return eligibility now and will let you know the next steps.`,
        `${empathyPrefix}I have your order pulled up. Could you let me know the reason for the return? That helps me process it faster.`
      ];
    }
    if (!agentAskedForOrder) {
      return [
        `${empathyPrefix}I'd be happy to help with that. Could you share your order number so I can review the return options?`,
        `${empathyPrefix}To get started on the return, I'll need your order number. You can find it in your confirmation email.`,
        `${empathyPrefix}${repeatPrefix}I want to help resolve this. Could you provide your order number and let me know the reason for the return?${urgencySuffix}`
      ];
    }
    return [
      `${empathyPrefix}I'm reviewing your return request now. I'll update you with the available options shortly.${urgencySuffix}`,
      `${empathyPrefix}Thank you for your patience. I'm checking the return policy details for your specific order.`,
      `${empathyPrefix}${repeatPrefix}I'm working on this for you. Would you prefer a refund to your original payment method or a store credit?${urgencySuffix}`
    ];
  }

  // ── PAYMENT / BILLING ──
  if (topics.includes('payment')) {
    if (hasOrderNumber) {
      return [
        `${empathyPrefix}I can see your order. Let me review the payment details and get back to you.${urgencySuffix}`,
        `${empathyPrefix}Thank you for the details. I'm checking the billing records for your order now.`,
        `${empathyPrefix}${repeatPrefix}I'm looking into the payment issue on your order. I'll have an update for you shortly.${urgencySuffix}`
      ];
    }
    return [
      `${empathyPrefix}I'd like to help sort out this billing issue. Could you share your order number or the email associated with the charge?`,
      `${empathyPrefix}To investigate the payment concern, could you provide the order number, date, and amount of the charge?`,
      `${empathyPrefix}${repeatPrefix}I want to get to the bottom of this. Could you share the order number and the last four digits of the card used?${urgencySuffix}`
    ];
  }

  // ── DISCOUNT / PROMO ──
  if (topics.includes('discount_promo')) {
    return [
      'Let me check on that promo code for you. Could you share the code and the items you\'re trying to apply it to?',
      'I\'d be happy to help! Could you tell me which promotion you\'re referring to, or share the promo code?',
      `${empathyPrefix}Let me look into the available promotions for you. What product or category are you interested in?`
    ];
  }

  // ── PRODUCT INQUIRY ──
  if (topics.includes('product_inquiry')) {
    return [
      'Great question! Let me check that information for you. Which specific product are you asking about?',
      'I\'d be happy to help with product details. Could you share the product name or a link?',
      'Let me find the most accurate information for you. Can you tell me more about what you\'re looking for?'
    ];
  }

  // ── ACCOUNT ISSUES ──
  if (topics.includes('account')) {
    return [
      `${empathyPrefix}I can help with your account. For security, could you confirm the email address associated with it?`,
      `${empathyPrefix}Let me look into the account issue. Could you describe what's happening when you try to log in?`,
      `${empathyPrefix}${repeatPrefix}I'll get this sorted for you. Could you share the email on your account so I can investigate?${urgencySuffix}`
    ];
  }

  // ── COMPLAINT / ESCALATION ──
  if (topics.includes('complaint')) {
    if (isLongConversation) {
      return [
        `${empathyPrefix}${repeatPrefix}I understand this has been a long process and I want to get it resolved for you now. Let me escalate this to ensure it's handled promptly.${urgencySuffix}`,
        `${empathyPrefix}I can see this hasn't been resolved to your satisfaction. Let me personally make sure we get this taken care of right away.`,
        `${empathyPrefix}You've been more than patient. I'm going to escalate this and ensure you get a resolution today.${urgencySuffix}`
      ];
    }
    return [
      `${empathyPrefix}${repeatPrefix}I take your feedback seriously and I want to resolve this for you. Could you share the specific details so I can take action?${urgencySuffix}`,
      `${empathyPrefix}I hear you, and I want to make this right. Let me look into this and find the best solution.`,
      `${empathyPrefix}Thank you for letting us know. I'm going to look into this personally and follow up with you.${urgencySuffix}`
    ];
  }

  // ── CUSTOMER ASKED A QUESTION ──
  if (analysis?.isQuestion) {
    return [
      `${empathyPrefix}${repeatPrefix}That's a great question. Let me find the answer for you — one moment.${urgencySuffix}`,
      `${empathyPrefix}I'd be happy to help with that. Let me check and get back to you with the details.`,
      `${empathyPrefix}${repeatPrefix}Let me look into that for you. Could you provide any additional details that might help me find the answer faster?${urgencySuffix}`
    ];
  }

  // ── GENERIC FALLBACK ──
  return [
    `${empathyPrefix}${repeatPrefix}Thank you for your message. Let me look into this and get back to you shortly.${urgencySuffix}`,
    `${empathyPrefix}I appreciate you reaching out. Could you provide a bit more detail so I can assist you better?`,
    `${empathyPrefix}${repeatPrefix}I want to make sure I help you with the right information. Could you tell me a bit more about what you need?${urgencySuffix}`
  ];
}






// ============ EMPLOYEE ENDPOINTS ============

app.get('/api/employees', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }
    
    const employees = await db.getAllEmployees();
    const sanitized = employees.map(emp => {
      const { password_hash, api_token, ...safe } = emp;
      return snakeToCamel(safe);
    });
    
    res.json(sanitized);
  } catch (error) {
    console.error('Get employees error:', error);
    res.status(500).json({ error: 'Failed to fetch employees' });
  }
});

app.post('/api/employees', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }
    
    const { email, name, role, password, canViewAllStores, isActive } = req.body;
    
    if (!email || !name || !password) {
      return res.status(400).json({ error: 'Email, name, and password are required' });
    }
    
    const password_hash = await hashPassword(password);
    
    const employee = await db.createEmployee({
      email,
      name,
      role: role || 'agent',
      password_hash,
      can_view_all_stores: canViewAllStores !== undefined ? canViewAllStores : true,
      is_active: isActive !== undefined ? isActive : true,
      assigned_stores: []
    });
    
    delete employee.password_hash;
    delete employee.api_token;
    
    res.json(snakeToCamel(employee));
  } catch (error) {
    console.error('Create employee error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/employees/:id', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }
    
    const employeeId = parseInt(req.params.id);
    const updates = req.body;
    
    const dbUpdates = {};
    if (updates.name !== undefined) dbUpdates.name = updates.name;
    if (updates.email !== undefined) dbUpdates.email = updates.email;
    if (updates.role !== undefined) dbUpdates.role = updates.role;
    if (updates.isActive !== undefined) dbUpdates.is_active = updates.isActive;
    if (updates.canViewAllStores !== undefined) dbUpdates.can_view_all_stores = updates.canViewAllStores;
    if (updates.assignedStores !== undefined) dbUpdates.assigned_stores = updates.assignedStores;
    
    if (updates.password) {
      dbUpdates.password_hash = await hashPassword(updates.password);
    }
    
    const employee = await db.updateEmployee(employeeId, dbUpdates);
    
    delete employee.password_hash;
    delete employee.api_token;
    
    res.json(snakeToCamel(employee));
  } catch (error) {
    console.error('Update employee error:', error);
    res.status(500).json({ error: 'Failed to update employee' });
  }
});

app.delete('/api/employees/:id', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }
    
    const employeeId = parseInt(req.params.id);
    
    if (employeeId === req.user.id) {
      return res.status(400).json({ error: 'Cannot delete your own account' });
    }
    
    await db.deleteEmployee(employeeId);
    
    res.json({ success: true, message: 'Employee deleted' });
  } catch (error) {
    console.error('Delete employee error:', error);
    res.status(500).json({ error: 'Failed to delete employee' });
  }
});

app.put('/api/employees/:id/status', authenticateToken, async (req, res) => {
  try {
    await db.updateEmployeeStatus(parseInt(req.params.id), req.body.status);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============ TEMPLATE ENDPOINTS ============

app.get('/api/templates', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const templates = await db.getTemplatesByUserId(userId);
    res.json(templates.map(snakeToCamel));
  } catch (error) {
    console.error('Get templates error:', error);
    res.status(500).json({ error: 'Failed to fetch templates' });
  }
});

app.post('/api/templates', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { name, content } = req.body;
    
    if (!name || !content) {
      return res.status(400).json({ error: 'Name and content are required' });
    }
    
    if (name.length > 255) {
      return res.status(400).json({ error: 'Template name is too long (max 255 characters)' });
    }
    
    const template = await db.createTemplate({
      user_id: userId,
      name: name.trim(),
      content: content.trim()
    });
    
    res.status(201).json(snakeToCamel(template));
  } catch (error) {
    console.error('Create template error:', error);
    res.status(500).json({ error: 'Failed to create template' });
  }
});

app.put('/api/templates/:id', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const templateId = parseInt(req.params.id);
    const { name, content } = req.body;
    
    if (!name || !content) {
      return res.status(400).json({ error: 'Name and content are required' });
    }
    
    if (name.length > 255) {
      return res.status(400).json({ error: 'Template name is too long (max 255 characters)' });
    }
    
    const existingTemplate = await db.getTemplateById(templateId);
    
    if (!existingTemplate) {
      return res.status(404).json({ error: 'Template not found' });
    }
    
    if (existingTemplate.user_id !== userId) {
      return res.status(403).json({ error: 'Not authorized to update this template' });
    }
    
    const template = await db.updateTemplate(templateId, {
      name: name.trim(),
      content: content.trim()
    });
    
    res.json(snakeToCamel(template));
  } catch (error) {
    console.error('Update template error:', error);
    res.status(500).json({ error: 'Failed to update template' });
  }
});

app.delete('/api/templates/:id', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const templateId = parseInt(req.params.id);
    
    const existingTemplate = await db.getTemplateById(templateId);
    
    if (!existingTemplate) {
      return res.status(404).json({ error: 'Template not found' });
    }
    
    if (existingTemplate.user_id !== userId) {
      return res.status(403).json({ error: 'Not authorized to delete this template' });
    }
    
    await db.deleteTemplate(templateId);
    
    res.json({ success: true, message: 'Template deleted successfully' });
  } catch (error) {
    console.error('Delete template error:', error);
    res.status(500).json({ error: 'Failed to delete template' });
  }
});






















let analyticsCache = null;
let analyticsCacheTimestamp = null;
const ANALYTICS_CACHE_DURATION = 30 * 60 * 1000;

app.get('/api/analytics/common-questions', authenticateToken, async (req, res) => {
  try {
    console.log('📊 [Analytics] Endpoint called!');
    console.log('📊 [Analytics] Query params:', req.query);
    
    const { 
      limit = 20, 
      timeframe = 'all',
    } = req.query;

    if (timeframe === 'all' && analyticsCache && analyticsCacheTimestamp) {
      const cacheAge = Date.now() - analyticsCacheTimestamp;
      if (cacheAge < ANALYTICS_CACHE_DURATION) {
        console.log(`📊 [Analytics] ✅ Returning cached results (${Math.floor(cacheAge/1000)}s old)`);
        return res.json({
          ...analyticsCache,
          cached: true,
          cacheAge: Math.floor(cacheAge / 1000)
        });
      }
    }

    let dateFilter = '';
    if (timeframe === 'week') {
      dateFilter = `AND m.sent_at >= NOW() - INTERVAL '7 days'`;
    } else if (timeframe === 'month') {
      dateFilter = `AND m.sent_at >= NOW() - INTERVAL '30 days'`;
    } else if (timeframe === '3months') {
      dateFilter = `AND m.sent_at >= NOW() - INTERVAL '90 days'`;
    }

    const query = `
      SELECT 
        m.content,
        m.sent_at,
        m.conversation_id,
        m.sender_name as customer_name
      FROM messages m
      WHERE m.sender_type = 'customer'
        AND m.content IS NOT NULL
        AND m.content != ''
        AND LENGTH(TRIM(m.content)) > 0
        ${dateFilter}
      ORDER BY m.sent_at DESC
    `;

    console.log('📊 [Analytics] Running query...');
    const startTime = Date.now();
    
    const result = await db.pool.query(query);
    const messages = result.rows;

    const queryTime = Date.now() - startTime;
    console.log(`📊 [Analytics] Found ${messages.length} customer messages in ${queryTime}ms`);

    if (messages.length === 0) {
      console.log('📊 [Analytics] No messages found - returning empty results');
      return res.json({
        summary: {
          totalMessagesAnalyzed: 0,
          questionsFound: 0,
          timeframe: timeframe,
        },
        topQuestions: [],
        topTopics: [],
        topIssues: [],
        sentimentBreakdown: { 
          very_negative: 0, 
          negative: 0, 
          neutral: 0, 
          positive: 0, 
          very_positive: 0 
        },
      });
    }

    console.log('📊 [Analytics] Analyzing messages...');
    const analysisStartTime = Date.now();
    const questionAnalysis = analyzeCustomerQuestions(messages);
    const analysisTime = Date.now() - analysisStartTime;

    console.log(`📊 [Analytics] Analysis complete: ${questionAnalysis.questions.length} questions found in ${analysisTime}ms`);

    const response = {
      summary: {
        totalMessagesAnalyzed: messages.length,
        questionsFound: questionAnalysis.questions.length,
        timeframe: timeframe,
        processingTimeMs: queryTime + analysisTime,
      },
      topQuestions: questionAnalysis.topQuestions.slice(0, parseInt(limit)),
      topTopics: questionAnalysis.topTopics.slice(0, 10),
      topIssues: questionAnalysis.topIssues.slice(0, 10),
      sentimentBreakdown: questionAnalysis.sentimentBreakdown,
      cached: false,
    };

    if (timeframe === 'all') {
      analyticsCache = response;
      analyticsCacheTimestamp = Date.now();
      console.log('📊 [Analytics] Results cached for 30 minutes');
    }

    res.json(response);

  } catch (error) {
    console.error('📊 [Analytics] Error:', error);
    console.error('📊 [Analytics] Stack:', error.stack);
    res.status(500).json({ 
      error: 'Failed to retrieve analytics',
      message: error.message 
    });
  }
});

app.post('/api/analytics/clear-cache', authenticateToken, (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }
    
    analyticsCache = null;
    analyticsCacheTimestamp = null;
    
    console.log('📊 [Analytics] Cache cleared by admin:', req.user.email);
    res.json({ success: true, message: 'Analytics cache cleared' });
  } catch (error) {
    console.error('📊 [Analytics] Cache clear error:', error);
    res.status(500).json({ error: 'Failed to clear cache' });
  }
});

//waiting for new domain
// app.post('/api/email/send', authenticateToken, async (req, res) => {
//   const { to, subject, body, conversationId, customerName } = req.body;
  
//   // Using Resend (you already have it from migration_007):
//   const { data, error } = await resend.emails.send({
//     from: 'support@yourdomain.com',
//     to,
//     subject,
//     html: `<p>${body.replace(/\n/g, '<br>')}</p>`,
//   });

//   if (error) return res.status(500).json({ error: error.message });
//   res.json({ ok: true, id: data.id });
// });


function analyzeCustomerQuestions(messages) {
  const questions = [];
  const topicCounts = {};
  const issueCounts = {};
  const sentimentCounts = { very_negative: 0, negative: 0, neutral: 0, positive: 0, very_positive: 0 };

  let totalMessages = 0;
  let filteredByExclude = 0;
  let filteredByLength = 0;
  let notQuestionOrInquiry = 0;
  let noBusinessTopic = 0;
  let normalizedTooShort = 0;
  let pickupDetected = 0;
  let dosingDetected = 0;
  let pickupKept = 0;
  let dosingKept = 0;

const topicKeywords = {
  order_status: [
    'order', 'tracking', 'shipped', 'delivery', 'deliver', 'where is', 'status', 'when will',
    'late', 'delayed', 'still waiting', 'hasn\'t arrived', 'not arrived', 'not received',
    'haven\'t received', 'never arrived', 'never came', 'taking too long'
  ],
  refund_return: ['refund', 'return', 'money back', 'cancel', 'cancellation', 'exchange'],
  product_issue: ['broken', 'damaged', 'defective', 'wrong item', 'missing', 'not working', 'doesn\'t work', 'issue with'],
  payment: ['payment', 'charged', 'charge', 'billing', 'invoice', 'receipt', 'credit card', 'declined'],
  discount_promo: ['discount', 'coupon', 'promo', 'code', 'sale', 'offer', 'deal'],
  product_inquiry: [
    // Basic product questions
    'product', 'item', 'size', 'color', 'stock', 'available', 'price', 'how much',
    // COA/Documentation questions
    'coa', 'certificate', 'analysis', 'lab report', 'test results', 'documentation',
    'lab test', 'purity', 'quality report', 'authenticity', 'verified', 'certified',
    'third party', 'independent test', 'batch', 'lot number', 'actual coa',
    // Dosing/Usage questions
    'dosing', 'dose', 'dosage', 'how to use', 'how much to take', 'instructions',
    'how to take', 'usage', 'how do i use', 'administration', 'inject', 'injection',
    'reconstitute', 'reconstitution', 'mixing', 'prepare', 'preparation',
    'how many', 'frequency', 'how often', 'protocol', 'regimen', 'schedule',
    // Vial duration/longevity questions
    'how long', 'last', 'vial last', 'bottle last', 'supply last', 'one vial',
    'per week', 'per day', 'per month', 'duration', 'longevity', 'how many doses',
    'how many injections', 'servings', 'uses per', 'doses per vial', 'vial contain',
    // Free items / what's included
    'free', 'include', 'comes with', 'receive', 'bac water', 'needle', 'needles', 'syringe',
    'injection supplies', 'what comes with', 'pre mixed', 'pre-mixed', 'premixed',
    // Product information
    'ingredient', 'composition', 'formula', 'concentration', 'strength', 'potency',
    'expiration', 'shelf life', 'storage', 'refrigerate', 'freeze',
    // Product availability - ✅ NEW
    'do you have', 'do you sell', 'do you guys have', 'do you guys sell', 'do you carry',
    'in stock', 'sell', 'carry', 'offer', 'what products', 'which products', 
    'what peptides', 'peptides are there', 'peptides help', 'help lose', 'gain muscle',
    'blend', 'stack', 'wolverine', 'glow', 'klow', 'budget friendly'
  ],
  pickup: [
    'pick up', 'pickup', 'pick-up', 'local pickup', 'store pickup', 'collection', 'collect',
    'come to', 'come directly', 'come by', 'visit', 'stop by', 'go to',
    'your address', 'your location', 'physical location', 'in person', 'physical store',
    'buy at your', 'purchase at your', 'come buy', 'visit your store', 'your shop',
    'at the location', 'at your place', 'store location', 'shop location', 'come get',
    'location', 'address', 'where are you', 'where is your', 'what is your location',
    'store address', 'shop address', 'physical address', 'brick and mortar',
    'brick-and-mortar', 'actual store', 'real store', 'showroom', 'warehouse',
    // ✅ NEW - Store existence questions
    'have a store', 'store in', 'do you have a store', 'is there a store', 
    'have a physical', 'physical location', 'retail location', 'do i have to order online'
  ],
  shipping: ['shipping', 'ship', 'freight', 'express', 'standard', 'free shipping', 'shipping cost', 'uber'],
  account: ['account', 'login', 'password', 'sign in', 'email', 'profile', 'update my'],
};

  const issueKeywords = {
    damaged: ['broken', 'damaged', 'defective', 'cracked', 'shattered', 'crushed'],
    wrong_item: ['wrong item', 'incorrect', 'not what i ordered', 'different'],
    missing: ['missing', 'didn\'t receive', 'never arrived', 'lost'],
    late: ['late', 'delayed', 'taking too long', 'still waiting'],
    quality: ['poor quality', 'cheap', 'not as described', 'disappointed with quality'],
  };


const excludePatterns = [
  /^(hi|hey|hello|greetings|good morning|good afternoon|good evening|yo|sup|what's up|whats up)[\s?!.]*$/i,
  /^how are you(\s+doing)?[\s?!.]*$/i,
  /^(are you|is anyone|is someone|anyone) (there|here|available)[\s?!.]*$/i,
  /^(thanks|thank you|thx|ty)[\s?!.]*$/i,
  /^(ok|okay|cool|great|awesome|perfect|nice|got it|i see|understood)[\s?!.]*$/i,
  /^(yes|no|yeah|yep|nope|sure)[\s?!.]*$/i,
  /^[\s?!.]+$/,
  /^test$/i,
  /\b(is the chat working|did you get my (message|msg)|are you (there|here|receiving)|can you see (this|my message))/i,
  /\b(is anyone (there|here|available|reading)|is this working|hello\?+ anyone)/i,
  /\b(affiliate|partnership|resell|wholesale|bulk order|business opportunity|work with you|collaborate|become (a|an) (partner|reseller|affiliate))/i,
  /\b(how do i (start|become)|interested in (selling|reselling|partnering))/i,
  /^(how do i know what|which one should i|what should i|help me choose)[\s\w]{0,30}$/i,
];


messages.forEach(msg => {
  const content = msg.content || '';
  const lower = content.toLowerCase().trim();

  if (excludePatterns.some(pattern => pattern.test(lower))) {
    return;
  }

  const spamIndicators = [
    'shopify store', 'conversion rate', 'funnel flow', 'store optimization',
    'i help store owners', 'i noticed your store', 'structural gaps',
    'would you like a breakdown', 'measurable lifts', 'revenue growth',
    'ecommerce consultant', 'cro expert', 'conversion triggers'
  ];

  if (spamIndicators.some(indicator => lower.includes(indicator))) {
    return;
  }

  const words = content.split(/\s+/);
  const shortWords = words.filter(w => w.length >= 3);
  if (shortWords.length >= 5) {
    const garbledWords = shortWords.filter(w => 
      !/[aeiou]/i.test(w) && 
      w.length > 3 && 
      !/^(www|http|https|pls|thx|plz|msg|bac|ghk|bpc|coa|mlb|nfl|nba)$/i.test(w)
    );
    
    const garbledRatio = garbledWords.length / shortWords.length;
    if (garbledRatio > 0.3) {
      return;
    }
  }

  if (content.trim().length < 10) {
    return;
  }

  const isQuestion = content.includes('?') || 
    /^(can |could |how |what |where |when |why |is |are |do |does |will |would |who |which |have |may |might )/i.test(content.trim());

const isInquiry = 
  /\b(late|delayed|still waiting|hasn't arrived|havent received|not received|never arrived|where is|when will)\b/i.test(lower) ||
  /\b(order|package|shipment).{0,20}(not|never|still|hasn't|haven't).{0,20}(arrived|received|here|come)/i.test(lower) ||
  /\b(need|want|waiting for|expecting).{0,30}(order|package|shipment|delivery)/i.test(lower) ||
  /\b(track|tracking|status).{0,20}(order|package|shipment)/i.test(lower) ||
  /\b(come|visit|go|stop by).{0,30}(to|at|your|the).{0,20}(address|location|store|shop|place)/i.test(lower) ||
  /\b(buy|purchase|get).{0,20}(at|from|in).{0,20}(your|the).{0,20}(address|location|store|shop|place)/i.test(lower) ||
  /\b(physical|in person|directly).{0,30}(buy|purchase|get|pick|collect)/i.test(lower) ||
  /\b(pick.?up|pickup|collection|collect).{0,30}(these|this|it|physically|in person|the|my|order)/i.test(lower) ||
  /\b(can i|able to|possible to).{0,30}(pick.?up|pickup|collect)/i.test(lower) ||
  /\b(can i|could i|may i).{0,20}(pick|get|buy|purchase|order|collect).{0,20}(these|this|it|them|that).{0,20}(physically|in person|locally|today|tomorrow)/i.test(lower) ||
  /\b(does|do).{0,20}(it|this|they|you).{0,20}come.{0,30}(with|in|as|pre)/i.test(lower) ||
  /\b(come).{0,20}(pre.?mixed|as a liquid|with|in liquid)/i.test(lower) ||
  /\b(if i|when i).{0,30}(purchase|buy|order).{0,50}(will|do|can)/i.test(lower) ||
  /\b(i received|i got|i ordered).{0,50}(but|however|and|though).{0,50}(no|not|missing|confused|question)/i.test(lower) ||
  /\b(wondering|help me|can you help|need help).{0,30}(with|figure|understand|how)/i.test(lower) ||
  /\b(coa|certificate|lab report|test results|documentation).{0,30}(document|available|provide|include|actual)/i.test(lower) ||
  /\b(provide|send|include|give|attach).{0,20}(coa|certificate|lab report|test results|documentation)/i.test(lower) ||
  /\b(third party|independent).{0,20}(test|lab|verification|certified)/i.test(lower) ||
  /\b(purity|quality|authenticity|verified).{0,20}(report|test|document)/i.test(lower) ||
  /\b(dosing|dose|dosage|how to).{0,30}(information|work|use|take|inject|administer)/i.test(lower) ||
  /\b(able to give|provide|send).{0,20}(dosing|dose|dosage|instructions|usage)/i.test(lower) ||
  /\b(how much|how many|how often).{0,30}(take|inject|use|dose|administer|water|bac|injection)/i.test(lower) ||
  /\b(reconstitute|reconstitution|mixing|preparation).{0,20}(instructions|guide|how)/i.test(lower) ||
  /\b(instructions|usage|protocol).{0,20}(for|on|about).{0,20}(product|use|taking)/i.test(lower) ||
  /\b(how long|how many).{0,30}(vial|bottle|supply|container).{0,30}(last|contain|doses|injections)/i.test(lower) ||
  /\b(vial|bottle).{0,30}(last|duration|good for).{0,30}(week|month|day|injection)/i.test(lower) ||
  /\b(one vial|per vial|each vial).{0,30}(last|give|provide|contain)/i.test(lower) ||
  /\b(how many).{0,30}(doses|injections|servings|uses).{0,30}(per|in|from).{0,30}(vial|bottle)/i.test(lower) ||
  /\b(receive|get|include|comes with).{0,30}(free|bac|water|needle|syringe|injection)/i.test(lower) ||
  /\b(free).{0,20}(bac|water|needle|syringe)/i.test(lower) ||
  /\b(do you have|is there|are there|where is|what is|what's).{0,20}(a |an |any |the |your )?(physical|actual|real|brick).{0,20}(store|shop|location|address|place)/i.test(lower) ||
  /\b(physical|actual|brick and mortar|brick-and-mortar).{0,20}(store|shop|location|showroom|address)/i.test(lower) ||
  /\b(store|shop|office).{0,20}(location|address|hours|open|where|in)/i.test(lower) ||
  /\b(your|the).{0,20}(location|address|store location|shop location|physical address)/i.test(lower) ||
  /\b(where|what).{0,20}(is|are).{0,20}(your|the).{0,20}(location|address|store|shop)/i.test(lower) ||
  /\b(location).{0,30}(visit|go to|come to|available|open|hours)/i.test(lower) ||
  /\b(have a store|store in).{0,50}(or do i|do i have to)/i.test(lower) ||
  /\b(dosing|dosage|dose).{0,50}(schedule|chart|guide|recommendation|protocol|included|provided|information)/i.test(lower) ||
  /\b(instructions|directions|usage).{0,30}(included|come with|provided|available|guide)/i.test(lower) ||
  /\b(vial|bottle).{0,30}(size|amount|mg|iu|contain|last)/i.test(lower) ||
  /\b(do you|does it|does this|do they).{0,30}(have|include|come|provide|offer|sell|give|carry)/i.test(lower);

  if (!isQuestion && !isInquiry) {
    return;
  }

  const detectedTopics = [];
  for (const [topic, keywords] of Object.entries(topicKeywords)) {
    if (keywords.some(kw => lower.includes(kw))) {
      detectedTopics.push(topic);
      topicCounts[topic] = (topicCounts[topic] || 0) + 1;
    }
  }

  const hasBusinessTopic = detectedTopics.length > 0;
  const isVeryShortGreeting = content.trim().length < 20 && /^(hi|hey|hello|how are you)[\s?!.]*$/i.test(lower);
  
  if (!hasBusinessTopic && isVeryShortGreeting) {
    return;
  }

  let detectedIssue = null;
  for (const [issue, keywords] of Object.entries(issueKeywords)) {
    if (keywords.some(kw => lower.includes(kw))) {
      detectedIssue = issue;
      issueCounts[issue] = (issueCounts[issue] || 0) + 1;
      break;
    }
  }

  const negativeWords = ['angry', 'frustrated', 'upset', 'terrible', 'horrible', 'worst', 'unacceptable', 'disappointed'];
  const positiveWords = ['thank', 'thanks', 'great', 'awesome', 'perfect', 'helpful', 'appreciate'];
  
  const negCount = negativeWords.filter(w => lower.includes(w)).length;
  const posCount = positiveWords.filter(w => lower.includes(w)).length;

  let sentiment = 'neutral';
  if (negCount >= 2) sentiment = 'very_negative';
  else if (negCount >= 1) sentiment = 'negative';
  else if (posCount >= 2) sentiment = 'very_positive';
  else if (posCount >= 1) sentiment = 'positive';

  sentimentCounts[sentiment]++;

  const normalizedQuestion = normalizeQuestion(content);

  if (normalizedQuestion === 'general question' || normalizedQuestion.length < 5) {
    return;
  }

  questions.push({
    original: content,
    normalized: normalizedQuestion,
    topics: detectedTopics,
    issue: detectedIssue,
    sentiment: sentiment,
    date: msg.sent_at,
    conversationId: msg.conversation_id,
    customerName: msg.customer_name || 'Guest',
  });
});

  // ✅ PRINT DEBUG SUMMARY
  console.log('\n📊 ============ ANALYTICS DEBUG SUMMARY ============');
  console.log(`Total messages processed: ${totalMessages}`);
  console.log(`Filtered by exclude patterns: ${filteredByExclude}`);
  console.log(`Filtered by length < 10: ${filteredByLength}`);
  console.log(`Not question or inquiry: ${notQuestionOrInquiry}`);
  console.log(`No business topic (generic greeting): ${noBusinessTopic}`);
  console.log(`Normalized too short: ${normalizedTooShort}`);
  console.log(`Final questions kept: ${questions.length}`);
  console.log('\n🏪 PICKUP Questions:');
  console.log(`  Detected: ${pickupDetected}`);
  console.log(`  Kept: ${pickupKept}`);
  console.log(`  Lost: ${pickupDetected - pickupKept}`);
  console.log('\n💊 DOSING Questions:');
  console.log(`  Detected: ${dosingDetected}`);
  console.log(`  Kept: ${dosingKept}`);
  console.log(`  Lost: ${dosingDetected - dosingKept}`);
  console.log('================================================\n');

  // Group similar questions
  const questionGroups = {};
  questions.forEach(q => {
    const key = q.normalized;
    if (!questionGroups[key]) {
      questionGroups[key] = {
        question: q.normalized,
        examples: [],
        count: 0,
        topics: {},
        issues: {},
        sentiment: { very_negative: 0, negative: 0, neutral: 0, positive: 0, very_positive: 0 },
      };
    }
    
    questionGroups[key].count++;
    questionGroups[key].sentiment[q.sentiment]++;
    
    if (questionGroups[key].examples.length < 10) {
      questionGroups[key].examples.push(q.original);
    }

    q.topics.forEach(topic => {
      questionGroups[key].topics[topic] = (questionGroups[key].topics[topic] || 0) + 1;
    });

    if (q.issue) {
      questionGroups[key].issues[q.issue] = (questionGroups[key].issues[q.issue] || 0) + 1;
    }
  });

  const topQuestions = Object.values(questionGroups)
    .sort((a, b) => b.count - a.count)
    .map(q => ({
      question: q.question,
      count: q.count,
      examples: q.examples,
      primaryTopic: Object.keys(q.topics).sort((a, b) => q.topics[b] - q.topics[a])[0] || 'general',
      primaryIssue: Object.keys(q.issues).sort((a, b) => q.issues[b] - q.issues[a])[0] || null,
      sentiment: getMostCommonSentiment(q.sentiment),
    }));

  const topTopics = Object.entries(topicCounts)
    .sort((a, b) => b[1] - a[1])
    .map(([topic, count]) => ({ topic, count }));

  const topIssues = Object.entries(issueCounts)
    .sort((a, b) => b[1] - a[1])
    .map(([issue, count]) => ({ issue, count }));

  return {
    questions,
    topQuestions,
    topTopics,
    topIssues,
    sentimentBreakdown: sentimentCounts,
  };
}

function normalizeQuestion(question) {
  let normalized = question.toLowerCase().trim();

  // ✅ STEP 1: PRESERVE important phrases BEFORE general cleanup
  const preservedPhrases = {
    // Pickup/location phrases
    'pick up': '__PICKUP__',
    'pickup': '__PICKUP__',
    'pick-up': '__PICKUP__',
    'local pickup': '__LOCALPICKUP__',
    'store pickup': '__STOREPICKUP__',
    'come to': '__COMETO__',
    'come directly': '__COMEDIRECTLY__',
    'come buy': '__COMEBUY__',
    'come by': '__COMEBY__',
    'come get': '__COMEGET__',
    'your address': '__YOURADDRESS__',
    'your location': '__YOURLOCATION__',
    'your store': '__YOURSTORE__',
    'your shop': '__YOURSHOP__',
    'at your': '__ATYOUR__',
    'in person': '__INPERSON__',
    'physical location': '__PHYSICALLOCATION__',
    'physical store': '__PHYSICALSTORE__',
    'store location': '__STORELOCATION__',
    'have a store': '__HAVEASTORE__',
    'order online': '__ORDERONLINE__',
    // Late delivery phrases
    'still waiting': '__STILLWAITING__',
    'not arrived': '__NOTARRIVED__',
    'hasn\'t arrived': '__NOTARRIVED__',
    'haven\'t received': '__NOTRECEIVED__',
    'not received': '__NOTRECEIVED__',
    'never arrived': '__NEVERARRIVED__',
    'taking too long': '__TOOLONG__',
    // COA/documentation phrases
    'coa document': '__COADOCUMENT__',
    'actual coa': '__ACTUALCOA__',
    'certificate of analysis': '__COA__',
    'lab report': '__LABREPORT__',
    'test results': '__TESTRESULTS__',
    'third party': '__THIRDPARTY__',
    'quality report': '__QUALITYREPORT__',
    // Dosing/usage phrases
    'dosing information': '__DOSINGINFO__',
    'dosing work': '__DOSINGWORK__',
    'how to use': '__HOWTOUSE__',
    'how to take': '__HOWTOTAKE__',
    'how much to': '__HOWMUCHTO__',
    'how many': '__HOWMANY__',
    'how often': '__HOWOFTEN__',
    'able to give': '__ABLETOGIVE__',
    'reconstitution': '__RECONSTITUTION__',
    'reconstitute': '__RECONSTITUTE__',
    'bac water': '__BACWATER__',
    'bacteriostatic water': '__BACWATER__',
    'bacteriostatic': '__BAC__',
    // Vial duration phrases
    'how long': '__HOWLONG__',
    'vial last': '__VIALLAST__',
    'one vial': '__ONEVIAL__',
    'per vial': '__PERVIAL__',
    'each vial': '__EACHVIAL__',
    'bottle last': '__BOTTLELAST__',
    'supply last': '__SUPPLYLAST__',
    'per week': '__PERWEEK__',
    'per day': '__PERDAY__',
    'per month': '__PERMONTH__',
    'how many doses': '__HOWMANYDOSES__',
    'how many injections': '__HOWMANYINJECTIONS__',
    'one injection': '__ONEINJECTION__',
    'doses per': '__DOSESPER__',
    'injections per': '__INJECTIONSPER__',
    // Product availability
    'do you have': '__DOYOUHAVE__',
    'do you sell': '__DOYOUSELL__',
    'do you guys have': '__DOYOUGUYSHAVE__',
    'do you guys sell': '__DOYOUGUYSSELL__',
    'comes with': '__COMESWITH__',
    'come with': '__COMESWITH__',
  };

  // Apply preserved phrases
  Object.entries(preservedPhrases).forEach(([phrase, placeholder]) => {
    const regex = new RegExp(phrase, 'gi');
    normalized = normalized.replace(regex, placeholder);
  });

  // ✅ STEP 2: Normalize specific product names to generic terms
  normalized = normalized
    .replace(/\b(bpc-?157|bpc 157|bpc157)\b/gi, 'bpc')
    .replace(/\b(tb-?500|tb 500|tb500)\b/gi, 'tb')
    .replace(/\b(ghk-?cu|ghk cu|ghkcu)\b/gi, 'ghk')
    .replace(/\b(cjc-?1295|cjc 1295|cjc1295)\b/gi, 'cjc')
    .replace(/\b(ipamorelin|ipa)\b/gi, 'ipa')
    .replace(/\b(mots-?c|mots c|motsc)\b/gi, 'motsc')
    .replace(/\b(retatrutide|reta|tirz|tirzepatide)\b/gi, 'reta')
    .replace(/\b(tesamorelin|tesa)\b/gi, 'tesa')
    .replace(/\b(sermorelin)\b/gi, 'sermorelin')
    .replace(/\b(semaglutide|sema)\b/gi, 'sema')
    .replace(/\b(wolverine|glow|klow)\b/gi, 'blend');

  // ✅ STEP 3: Remove all numbers (order numbers, amounts, etc.)
  normalized = normalized.replace(/\d+/g, '');

  // Remove email addresses
  normalized = normalized.replace(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi, '');

  // Remove dates
  normalized = normalized.replace(/\d{1,2}\/\d{1,2}\/\d{2,4}/g, '');

  // Remove URLs
  normalized = normalized.replace(/https?:\/\/[^\s]+/gi, '');

  // Remove specific colors
  normalized = normalized.replace(/\b(blue|red|black|white|green|yellow|purple|pink|orange|brown|gray|grey)\b/gi, '');

  // ✅ STEP 4: Normalize common variations
  normalized = normalized
    .replace(/\b(vials?|bottles?|containers?)\b/gi, 'vial')
    .replace(/\b(injections?|shots?|doses?)\b/gi, 'dose')
    .replace(/\b(weeks?|days?|months?)\b/gi, 'period')
    .replace(/\b(i live in|i am in|i'm in)\s+[a-z\s]+/gi, 'i live in city')
    .replace(/\b(fredericton|oshawa|calgary|winnipeg|vancouver|toronto|montreal|ottawa|edmonton)\b/gi, 'city')
    .replace(/\b(order|order number|order #|#)\s*\d*/gi, 'order')
    .replace(/\b(\d+\s*)?(ml|mg|iu|mcg|units?)\b/gi, 'amount');

  // ✅ STEP 5: Normalize question starters
  normalized = normalized
    .replace(/^(hey|hi|hello|greetings|good morning|good afternoon|good evening|yo)\s*/gi, '')
    .replace(/\s+(there|guys?|everyone|team|buddy)\s*/gi, ' ')
    .replace(/where is my|where's my|wheres my|where are my/gi, 'where is')
    .replace(/when will|when's|whens|when are|when can/gi, 'when will')
    .replace(/how do i|how can i|how to|how would i|how should i/gi, 'how do i')
    .replace(/what is|what's|whats|what are/gi, 'what is')
    .replace(/can i|could i|may i|am i able to/gi, 'can i')
    .replace(/do you|does your|do your|do you guys/gi, 'do you')
    .replace(/is there|are there/gi, 'is there')
    .replace(/don't|dont|do not/gi, 'do not')
    .replace(/can't|cant|cannot/gi, 'cannot')
    .replace(/won't|wont|will not/gi, 'will not')
    .replace(/i'm|im/gi, 'i am')
    .replace(/you're|youre/gi, 'you are')
    .replace(/didn't|didnt/gi, 'did not')
    .replace(/hasn't|hasnt/gi, 'has not')
    .replace(/haven't|havent/gi, 'have not');

  // ✅ STEP 6: Remove common filler words
  normalized = normalized.replace(/\b(please|kindly|just|really|actually|basically|literally|honestly|sorry|um|uh|like|you know|mainly|very|quite|pretty|also|still|even|always|never)\b/gi, '');

  // Remove extra punctuation
  normalized = normalized.replace(/[?!.,:;]+/g, ' ');

  // Remove extra whitespace
  normalized = normalized.replace(/\s+/g, ' ').trim();

  // ✅ STEP 7: RESTORE preserved phrases
  Object.entries(preservedPhrases).forEach(([phrase, placeholder]) => {
    normalized = normalized.replace(new RegExp(placeholder, 'gi'), phrase);
  });

// ✅ STEP 8: BALANCED KEYWORD-BASED GROUPING
const stopWords = new Set([
  'a', 'an', 'the', 'and', 'or', 'but', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
  'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'should', 'could', 'may', 'might',
  'can', 'of', 'at', 'by', 'for', 'with', 'about', 'as', 'into', 'through', 'during', 'before',
  'after', 'above', 'below', 'to', 'from', 'up', 'down', 'in', 'out', 'on', 'off', 'over', 'under',
  'again', 'further', 'then', 'once', 'here', 'there', 'when', 'where', 'why', 'all', 'both',
  'each', 'few', 'more', 'most', 'other', 'some', 'such', 'only', 'own', 'same', 'so', 'than',
  'too', 'now', 'i', 'me', 'my', 'myself', 'we', 'our', 'ours', 'ourselves', 'you', 'your', 'yours',
  'yourself', 'yourselves', 'he', 'him', 'his', 'himself', 'she', 'her', 'hers', 'herself',
  'it', 'its', 'itself', 'they', 'them', 'their', 'theirs', 'themselves', 'this', 'that', 'these',
  'those', 'am', 'any', 'because', 'if', 'while', 'how', 'what', 'which', 'who', 'whom'
]);

const words = normalized.split(/\s+/).filter(w => w.length > 0);
const keywords = words.filter(w => !stopWords.has(w) && w.length >= 3);

// ✅ SPECIFIC HIGH-PRIORITY GROUPINGS (Group aggressively for key topics)

// 1. BAC water questions - Group ALL BAC water mentions
if (normalized.includes('__bacwater__') || normalized.includes('__bac__') || 
    normalized.includes('bac water') || normalized.includes('bacteriostatic') ||
    (normalized.includes('bac') && !normalized.includes('feedback') && !normalized.includes('back'))) {
  return 'bac water question';
}

// 2. Reconstitution Solution questions (when NOT about BAC water)
if ((normalized.includes('__reconstitution__') || normalized.includes('reconstitution solution')) &&
    !normalized.includes('__bacwater__') && !normalized.includes('__bac__')) {
  return 'reconstitution solution question';
}

// 3. COA questions - Group ALL COA mentions
if (normalized.includes('coa') || normalized.includes('__coadocument__') || 
    normalized.includes('certificate') || normalized.includes('__labreport__') ||
    (normalized.includes('lab') && normalized.includes('report'))) {
  return 'coa document question';
}

// 4. Dosing/usage questions - Group ALL dosing mentions
if (normalized.includes('dosing') || normalized.includes('dosage') || 
    normalized.includes('__dosinginfo__') || normalized.includes('__dosingwork__')) {
  return 'dosing information question';
}

// 5. Vial duration/longevity - How long does vial last, how many doses
if ((normalized.includes('__howlong__') || normalized.includes('__viallast__')) ||
    (normalized.includes('__howmany__') && (normalized.includes('dose') || normalized.includes('vial'))) ||
    (normalized.includes('vial') && normalized.includes('last')) ||
    (normalized.includes('__howmanydoses__') || normalized.includes('__dosesper__'))) {
  return 'vial duration question';
}

// 6. Needles/Syringes included/receive
if ((normalized.includes('needle') || normalized.includes('syringe')) && 
    (normalized.includes('__comeswith__') || normalized.includes('receive') || 
     normalized.includes('included') || normalized.includes('order'))) {
  return 'needles included question';
}

// 7. Pickup/Location questions
if (normalized.includes('__pickup__') || normalized.includes('__cometo__') || 
    normalized.includes('__inperson__') || normalized.includes('__physicallocation__') || 
    normalized.includes('__physicalstore__') || normalized.includes('__storelocation__') ||
    normalized.includes('__haveastore__')) {
  return 'pickup location question';
}

// 8. Tracking/Delivery not received
if ((normalized.includes('tracking') || normalized.includes('__notarrived__') || 
     normalized.includes('__stillwaiting__') || normalized.includes('__notreceived__')) &&
    !normalized.includes('edit') && !normalized.includes('change')) {
  return 'tracking delivery question';
}

// 9. Order edit/change (NOT address)
if ((normalized.includes('edit') || normalized.includes('change')) && 
    normalized.includes('order') && !normalized.includes('address')) {
  return 'edit order question';
}

// 10. Address change
if ((normalized.includes('change') || normalized.includes('update')) && normalized.includes('address')) {
  return 'change address question';
}

// 11. Refund questions
if (normalized.includes('refund') || normalized.includes('refunded') || 
    normalized.includes('reimbursement') || normalized.includes('money back')) {
  return 'refund question';
}

// 12. Discount/promo code
if (normalized.includes('discount') || (normalized.includes('code') && !normalized.includes('postal')) || 
    normalized.includes('promo') || normalized.includes('coupon')) {
  return 'discount code question';
}

// 13. Payment methods
if ((normalized.includes('payment') && normalized.includes('method')) || 
    (normalized.includes('payment') && normalized.includes('accept'))) {
  return 'payment methods question';
}

// 14. Product availability (do you have/sell)
if ((normalized.includes('__doyouhave__') || normalized.includes('__doyousell__')) && 
    !normalized.includes('needle') && !normalized.includes('syringe') && 
    !normalized.includes('__bacwater__') && !normalized.includes('coa') &&
    !normalized.includes('__haveastore__')) {
  return 'product availability question';
}

// 15. Ingredients/China source
if ((normalized.includes('ingredients') || normalized.includes('china') || normalized.includes('source')) &&
    (normalized.includes('come') || normalized.includes('from') || normalized.includes('__doyouhave__'))) {
  return 'ingredients source question';
}

// 16. Vial form (liquid vs powder)
if ((normalized.includes('liquid') || normalized.includes('powder') || normalized.includes('dry')) && 
    (normalized.includes('vial') || normalized.includes('form') || normalized.includes('state'))) {
  return 'vial form question';
}

// 17. Guarantee/delivery guarantee
if (normalized.includes('guarantee') && (normalized.includes('delivery') || normalized.includes('arrival'))) {
  return 'delivery guarantee question';
}

// 18. Mg/dosage sizes - "can we buy highest mg and inject smaller amount"
if ((normalized.includes('amount') || normalized.includes('size')) && 
    (normalized.includes('inject') || normalized.includes('smaller') || normalized.includes('various'))) {
  return 'dosage size flexibility question';
}

// ✅ FALLBACK: Use top 3 keywords (sorted)
if (keywords.length >= 3) {
  const filteredKeywords = keywords.filter(k => 
    !['order', 'question', 'help', 'know', 'want', 'need', 'get', 'give', 'tell', 'ask', 
      'also', 'still', 'just', 'make', 'take', 'use', 'see', 'find'].includes(k)
  );
  
  if (filteredKeywords.length >= 2) {
    const sortedKeywords = [...filteredKeywords].sort().slice(0, 3);
    return sortedKeywords.join(' ');
  }
}

// Final fallback
if (normalized.length < 5) {
  return 'general question';
}

return normalized;
}

function getMostCommonSentiment(sentimentCounts) {
  return Object.entries(sentimentCounts)
    .sort((a, b) => b[1] - a[1])[0][0];
}






















// ============ STATS ENDPOINTS ============

app.get('/api/stats/dashboard', authenticateToken, async (req, res) => {
  try {
    const stats = await db.getDashboardStats(req.query);
    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/stats/websocket', authenticateToken, (req, res) => {
  try {
    const stats = getWebSocketStats();
    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============ ERROR HANDLER ============

app.use((err, req, res, next) => {
  console.error('SERVER ERROR:', err.message);
  console.error('Stack:', err.stack);
  console.error('URL:', req.url);
  console.error('Method:', req.method);
  
  res.status(500).json({ 
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// ============ KEEP-ALIVE MECHANISM ============

function setupKeepAlive() {
  if (process.env.KEEP_ALIVE === 'false') {
    console.log('⏰ Keep-alive disabled');
    return;
  }

  const APP_URL = process.env.APP_URL || `http://localhost:${process.env.PORT || 3000}`;
  const httpModule = APP_URL.startsWith('https') ? require('https') : http;
  
  console.log('⏰ Keep-alive enabled - pinging every 5 minutes');
  
  setInterval(() => {
    const now = new Date().toISOString();
    
    httpModule.get(`${APP_URL}/health`, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        if (res.statusCode === 200) {
          console.log(`⏰ Keep-alive ping successful [${now}]`);
        } else {
          console.log(`⚠️ Keep-alive ping failed: ${res.statusCode} [${now}]`);
        }
      });
    }).on('error', (err) => {
      console.error(`❌ Keep-alive ping error [${now}]:`, err.message);
    });
    
  }, 5 * 60 * 1000);
  
  setTimeout(() => {
    console.log('⏰ Running initial keep-alive ping...');
    httpModule.get(`${APP_URL}/health`, (res) => {
      console.log(`⏰ Initial ping: ${res.statusCode}`);
    }).on('error', (err) => {
      console.error('❌ Initial ping error:', err.message);
    });
  }, 60 * 1000);
}

// ============ START SERVER ============

const PORT = process.env.PORT || 3000;

async function startServer() {
  try {
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🔄 Initializing Multi-Store Chat Server...');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    console.log('📡 Testing database connection...');
    await db.testConnection();
    console.log('✅ Database connection successful\n');
    
    console.log('🗄️  Initializing database tables...');
    await db.initDatabase();
    console.log('✅ Database tables initialized\n');
    
    console.log('🔄 Running database migrations...');
    await db.runMigrations();
    console.log('✅ Database migrations completed\n');
    
    server.listen(PORT, () => {
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('🚀 MULTI-STORE CHAT SERVER READY');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log(`📍 Server: http://localhost:${PORT}`);
      console.log(`🔌 WebSocket: ws://localhost:${PORT}/ws`);
      console.log(`🏥 Health: http://localhost:${PORT}/health`);
      console.log(`🔐 OAuth: http://localhost:${PORT}/auth?shop=STORE.myshopify.com`);
      console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`📎 File Upload: Enabled with Bunny.net`);
      console.log(`📧 Email Notifications: Enabled`);
      console.log(`✦  AI Suggestions: ${process.env.ANTHROPIC_API_KEY ? 'Enabled (Claude)' : 'Fallback mode (no API key)'}`);
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
      
      setupKeepAlive();
      startEmailSweep(db.pool);
      
      setInterval(async () => {
        try {
          const result = await db.pool.query(`
            UPDATE customer_presence
            SET status = 'offline', ws_connected = FALSE, updated_at = NOW()
            WHERE status != 'offline'
              AND last_heartbeat_at < NOW() - INTERVAL '3 minutes'
            RETURNING conversation_id
          `);
          if (result.rowCount > 0) {
            console.log(`[Presence] Marked ${result.rowCount} stale sessions offline`);
          }
        } catch (err) {
          console.error('[Presence] Stale cleanup error:', err);
        }
      }, 2 * 60 * 1000);
    });
  } catch (error) {
    console.error('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.error('❌ FATAL: Failed to start server');
    console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.error('Error:', error.message);
    console.error('Stack:', error.stack);
    console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    process.exit(1);
  }
}

startServer();

module.exports = { app, server };